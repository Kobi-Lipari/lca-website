// test/integration/contracts/admin-tournaments.test.ts
// POST /api/admin/tournaments and PATCH /api/admin/tournaments/[id] keep
// their contracts (domain/contracts/events.ts): the real handlers, rows from
// the factories. The requests are the bodies adminCreateTournament and
// adminUpdateTournament in src/lib/api.ts send; the answers are every
// column of the tournament with its section rows, ids included. Refusals
// keep the plain { error } body, and a body that breaks the request contract
// gets { error, fields }.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestPost as createTournament } from '../../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../../functions/api/admin/tournaments/[id]'
import { seedAdmin, seedClub, seedDirector, seedMember, seedTournament, seedTournamentDirector } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const create = contracts['admin/tournaments'].POST
const edit = contracts['admin/tournaments/[id]'].PATCH

const liveRows = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT id, name, position FROM tournament_sections WHERE tournament_id = ? AND archived_at IS NULL ORDER BY position')
    .bind(tournamentId).all<{ id: string; name: string; position: number }>()).results

/** What the wizard sends (TournamentWizard handleCreate). */
const wizardBody = (clubId?: string) => ({
  name: 'Contract Probe Open',
  location: 'Kenner, LA',
  date: '2026-10-24',
  endDate: '2026-10-25',
  venue: 'Kenner Community Center',
  entryFee: 30,
  sections: [
    { name: 'Open', entryFee: 30, prizeFund: '$500 based on 30' },
    {
      name: 'U1400', entryFee: 20, ratingMax: 1399, unratedOk: true, rulesSet: true,
      prizes: { place: [{ amount: 100 }, { label: 'Trophy' }], classes: [{ label: 'Top U1000', ratingMax: 999, prizes: [{ amount: 25 }] }] },
    },
  ],
  rounds: 5,
  maxPlayers: 60,
  description: 'Two days, five rounds.',
  isRated: true,
  status: 'upcoming',
  timeControl: 'G/90+30',
  registrationClosesAt: '2026-10-23T21:00',
  customDetails: [{ title: 'Parking', body: 'Free on site.' }],
  ...(clubId ? { clubId } : {}),
})

describe('POST /api/admin/tournaments contract', () => {
  it('takes what the wizard sends', () => {
    expect(create.request.safeParse(wizardBody('club-1')).success).toBe(true)
    expect(create.request.safeParse({ name: 'Bare', location: 'Kenner, LA', date: '2026-10-24', entryFee: 15 }).success).toBe(true)
  })

  it('answers an admin with every column and the section rows, ids included', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const result = await invoke(createTournament, { method: 'POST', as: admin, body: wizardBody(clubId) })
    expect(result.status).toBe(201)
    const { tournament } = await expectContract(result, create.response)
    expect(tournament.club_id).toBe(clubId)
    expect(tournament.is_visible).toBe(0)
    expect(typeof tournament.custom_details).toBe('string')
    expect(tournament.sections.map((s, i) => [s.id, s.name, i])).toEqual((await liveRows(tournament.id)).map((r) => [r.id, r.name, r.position]))
    expect(tournament.sections[0]).toMatchObject({ entryFee: 30, prizeFund: '$500 based on 30', cap: null, fees: { regular: 30, early: null, late: null } })
    expect(tournament.sections[1]).toMatchObject({ ratingMax: 1399, unratedOk: true, rulesSet: true })
  })

  it('answers a club rep creating for their own club, and the default Open section', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const result = await invoke(createTournament, {
      method: 'POST', as: rep, body: { name: 'Rep Open', location: 'Kenner, LA', date: '2026-10-31', entryFee: 15 },
    })
    expect(result.status).toBe(201)
    const { tournament } = await expectContract(result, create.response)
    expect(tournament.sections.map((s) => [s.name, s.entryFee])).toEqual([['Open', 15]])
  })

  it('role safety: a rep for another club, a director and a member are refused with { error }', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()
    const otherClub = await invoke(createTournament, { method: 'POST', as: rep, body: wizardBody(other) })
    expect(otherClub.status).toBe(403)
    await expectContract(otherClub, errorBodySchema)
    for (const who of [await seedDirector(), await seedMember()]) {
      const res = await invoke(createTournament, { method: 'POST', as: who, body: wizardBody() })
      expect(res.status).toBe(403)
      await expectContract(res, errorBodySchema)
    }
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()).toEqual(before)
  })

  it('role safety: no sign-in is 401 with { error } and creates nothing', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()
    const res = await invoke(createTournament, { method: 'POST', body: wizardBody() })
    expect(res.status).toBe(401)
    await expectContract(res, errorBodySchema)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments').first<{ n: number }>()).toEqual(before)
  })

  it('a section list that breaks the contract is 400 with fields; repeated names are 400 with { error }', async () => {
    const admin = await seedAdmin()
    const tooLong = await invoke(createTournament, {
      method: 'POST', as: admin, body: { ...wizardBody(), sections: [{ name: 'x'.repeat(81), entryFee: 5 }] },
    })
    expect(tooLong.status).toBe(400)
    expect((await expectContract(tooLong, fieldErrorBodySchema)).fields).toHaveProperty('sections.0.name')

    const repeated = await invoke(createTournament, {
      method: 'POST', as: admin, body: { ...wizardBody(), sections: [{ name: 'Open', entryFee: 5 }, { name: 'Open', entryFee: 6 }] },
    })
    expect(repeated.status).toBe(400)
    expect(await expectContract(repeated, errorBodySchema)).toEqual({ error: 'Two sections are named “Open”. Give each section its own name.' })
  })
})

describe('PATCH /api/admin/tournaments/[id] contract', () => {
  it('takes what the manage page sends', () => {
    expect(edit.request.safeParse({
      name: 'Renamed', venue: null, endDate: null, entryFee: 25, rounds: 4, maxPlayers: null, description: null,
      isRated: true, pairingSystem: 'fide', accelerated: true, keepApart: 'family_club', isStateChampionship: false,
      timeControl: 'G/60;d5', sections: [{ name: 'Open', entryFee: 25 }], customDetails: [{ title: 'Food', body: 'Concessions.' }],
      roundSchedule: [{ round: 1, date: '2026-10-24', time: '10:00' }], isVisible: true, registrationClosesAt: null,
      earlyDeadline: '2026-10-01T23:59', earlyDiscount: 5, lateAfter: null, lateFee: 0, memberDiscount: 0, clubId: null,
      reportSettings: { affiliateId: 'A6000001', sections: { Open: { ratingSystem: 'R', sendCrosstable: true } } },
    }).success).toBe(true)
    expect(edit.request.safeParse({ sections: null }).success).toBe(true)
    expect(edit.request.safeParse({ sections: 'Open' }).success).toBe(false)
  })

  it('answers with every column and the live section rows, ids included', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 10 }] })
    const result = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { description: 'Bring a clock.', sections: [{ name: 'Open', entryFee: 30 }, { name: 'Reserve', entryFee: 15, prizeFund: '$100' }] },
    })
    expect(result.status).toBe(200)
    const { tournament } = await expectContract(result, edit.response)
    expect(tournament.description).toBe('Bring a clock.')
    expect(tournament.sections.map((s, i) => [s.id, s.name, i])).toEqual((await liveRows(tournamentId)).map((r) => [r.id, r.name, r.position]))
    expect(tournament.sections.map((s) => s.entryFee)).toEqual([30, 15])
  })

  it('prices each section from the tournament: entryFee is the regular price, fees carries the early and late prices', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 25, sections: [{ name: 'Open', entryFee: 40 }, { name: 'Free', entryFee: 0 }, { name: 'Reserve' } as { name: string; entryFee: number }] })
    const result = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { earlyDeadline: '2026-09-01T23:59', earlyDiscount: 5, lateAfter: '2026-09-10T12:00', lateFee: 10 },
    })
    expect(result.status).toBe(200)
    const { tournament } = await expectContract(result, edit.response)
    expect(tournament.sections.map((s) => [s.name, s.entryFee, s.fees])).toEqual([
      ['Open', 40, { regular: 40, early: 35, late: 50 }],
      ['Free', 0, { regular: 0, early: null, late: null }],
      ['Reserve', 25, { regular: 25, early: 20, late: 35 }],
    ])
  })

  it('answers with round_schedule read into a list and no JSON text of the sections (step 12)', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const roundSchedule = [{ round: 1, date: '2026-09-12', time: '10:00' }, { round: 2, date: '2026-09-12', time: '14:00' }]
    const res = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { roundSchedule } })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, edit.response)
    expect(tournament.round_schedule).toEqual(roundSchedule)
    expect(tournament.sections.every((s) => typeof s === 'object')).toBe(true)
    // The stored text is unchanged: only the answer reads it.
    const stored = await env.DB.prepare('SELECT round_schedule FROM tournaments WHERE id = ?').bind(tournamentId).first<{ round_schedule: string }>()
    expect(JSON.parse(stored!.round_schedule)).toEqual(roundSchedule)

    const created = await invoke(createTournament, { method: 'POST', as: admin, body: wizardBody() })
    expect((await expectContract(created, create.response)).tournament.round_schedule).toEqual([])
  })

  it('answers an assigned director and the owning club rep', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const rep = await seedMember({ role: 'club_rep', clubId })
    const td = await seedDirector()
    await seedTournamentDirector(tournamentId, td)
    for (const who of [rep, td]) {
      const res = await invoke(patchTournament, { method: 'PATCH', as: who, params: { id: tournamentId }, body: { name: `Edited by ${who}` } })
      expect(res.status).toBe(200)
      await expectContract(res, edit.response)
    }
  })

  it('role safety: another club’s rep gets 403, and only an admin may change the organizing club', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const before = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()
    const rowsBefore = await liveRows(tournamentId)

    const otherRep = await seedMember({ role: 'club_rep', clubId: otherClub })
    const foreign = await invoke(patchTournament, {
      method: 'PATCH', as: otherRep, params: { id: tournamentId }, body: { sections: [{ name: 'Hijacked', entryFee: 0 }] },
    })
    expect(foreign.status).toBe(403)
    await expectContract(foreign, errorBodySchema)

    const ownRep = await seedMember({ role: 'club_rep', clubId })
    const move = await invoke(patchTournament, {
      method: 'PATCH', as: ownRep, params: { id: tournamentId }, body: { clubId: otherClub, sections: [{ name: 'Moved', entryFee: 0 }] },
    })
    expect(move.status).toBe(403)
    expect(await expectContract(move, errorBodySchema)).toEqual({ error: 'Only LCA admins can change the organizing club' })

    expect(await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()).toEqual(before)
    expect(await liveRows(tournamentId)).toEqual(rowsBefore)

    const admin = await seedAdmin()
    const moved = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { clubId: otherClub } })
    expect(moved.status).toBe(200)
    expect((await expectContract(moved, edit.response)).tournament.club_id).toBe(otherClub)
  })

  it('role safety: no sign-in is 401 and a plain member is 403, and neither changes the event', async () => {
    const tournamentId = await seedTournament()
    const before = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()
    const rowsBefore = await liveRows(tournamentId)
    const body = { name: 'Hijacked', sections: [{ name: 'Hijacked', entryFee: 0 }] }
    const anonymous = await invoke(patchTournament, { method: 'PATCH', params: { id: tournamentId }, body })
    expect(anonymous.status).toBe(401)
    await expectContract(anonymous, errorBodySchema)
    const member = await invoke(patchTournament, { method: 'PATCH', as: await seedMember(), params: { id: tournamentId }, body })
    expect(member.status).toBe(403)
    await expectContract(member, errorBodySchema)
    expect(await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()).toEqual(before)
    expect(await liveRows(tournamentId)).toEqual(rowsBefore)
  })

  it('refusals keep the plain { error } body: repeated names, a section with entries, a missing tournament', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    await env.DB.prepare(
      `INSERT INTO registrations (id, tournament_id, member_id, section) VALUES ('contract-entry', ?, ?, 'Reserve')`,
    ).bind(tournamentId, await seedMember()).run()

    const repeated = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ name: 'Open', entryFee: 0 }, { name: 'Open', entryFee: 5 }] },
    })
    expect(repeated.status).toBe(400)
    await expectContract(repeated, errorBodySchema)

    const removing = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ name: 'Open', entryFee: 0 }] },
    })
    expect(removing.status).toBe(400)
    expect(await expectContract(removing, errorBodySchema)).toEqual({ error: '1 entry is in the Reserve section. Move it to another section first.' })

    const missing = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: 'no-such-event' }, body: { name: 'x' } })
    expect(missing.status).toBe(404)
    await expectContract(missing, errorBodySchema)
  })

  it('a body that breaks the request contract is 400 with fields', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const res = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ name: '', entryFee: 5 }, { name: 'Open', cap: 0 }] },
    })
    expect(res.status).toBe(400)
    const { fields } = await expectContract(res, fieldErrorBodySchema)
    expect(Object.keys(fields).sort()).toEqual(['sections.0.name', 'sections.1.cap'])
  })

  it('takes the stored list back as it is: bare names and old values of another type, with a section added', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    // An event saved long ago: sections stored as bare names and an old
    // element with its price as text. The 0053 trigger makes the rows.
    const stored = ['Open', 'U1400', { name: 'Reserve', entryFee: '40', prizeFund: 700 }]
    await env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').bind(JSON.stringify(stored), tournamentId).run()
    const before = await liveRows(tournamentId)
    expect(before.map((r) => r.name)).toEqual(['Open', 'U1400', 'Reserve'])

    const sent = [...stored, { name: 'Scholastic', entryFee: 0 }]
    expect(edit.request.safeParse({ sections: sent }).success).toBe(true)
    const res = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: sent } })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, edit.response)

    // The JSON keeps exactly what was sent; the rows keep their ids and gain the new one.
    const row = await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>()
    expect(JSON.parse(row!.sections)).toEqual(sent)
    const after = await liveRows(tournamentId)
    expect(after.slice(0, 3).map((r) => r.id)).toEqual(before.map((r) => r.id))
    expect(tournament.sections.map((s) => [s.id, s.name])).toEqual(after.map((r) => [r.id, r.name]))
    // The price stored as text is not a price: Reserve pays the event's entry fee,
    // and the text stays with the row's other keys, as the trigger keeps it.
    expect(tournament.sections.map((s) => s.entryFee)).toEqual([25, 25, 25, 0])
    const reserve = await env.DB.prepare('SELECT fee_regular, prize_fund, extra_json FROM tournament_sections WHERE id = ?')
      .bind(before[2].id).first<{ fee_regular: number | null; prize_fund: string | null; extra_json: string | null }>()
    expect(reserve).toEqual({ fee_regular: null, prize_fund: null, extra_json: JSON.stringify({ entryFee: '40', prizeFund: 700 }) })
  })

  it('a known key of its column\'s type must still be valid; a bare name must still be a name', () => {
    expect(edit.request.safeParse({ sections: [{ name: 'Open', entryFee: -1 }] }).success).toBe(false)
    expect(edit.request.safeParse({ sections: ['Open', ''] }).success).toBe(false)
    expect(edit.request.safeParse({ sections: ['x'.repeat(81)] }).success).toBe(false)
    expect(edit.request.safeParse({ sections: [{ name: 'Open', prizes: [] }] }).success).toBe(false)
    expect(create.request.safeParse({ sections: ['Open', { name: 'U1400', entryFee: '20' }] }).success).toBe(true)
  })
})
