// test/integration/sections-triggers.test.ts
//
// The 0053 triggers in the Workers runtime, driven by the handlers as they
// are today, none of which knows the sections and schedules tables exist:
//
// - registrations.ts (free, paid and waitlist entries), registrations/batch.ts,
//   the director's walk-ins and the section move in registrations/[id].ts get
//   section_id and schedule_id filled in
// - the admin POST creates the section rows and the primary schedule
// - the soak case: the admin PATCH adds a section, renames one, removes one
//   and changes round_schedule; afterwards the live rows match the JSON, the
//   primary rounds match round_schedule, and an entry into the new section
//   has its section_id
// - the admin DELETE still removes a tournament with entries
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness, stripeSessions } from './harness'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestPost as registrationsPost } from '../../functions/api/registrations'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPost as walkInPost } from '../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'

beforeEach(resetHarness)

interface SectionRow {
  id: string
  position: number
  name: string
  fee_regular: number | null
  fee_early: number | null
  fee_late: number | null
  cap: number | null
  prize_fund: string | null
  archived_at: string | null
}

const sectionsOf = async (tournamentId: string) =>
  (await env.DB.prepare(
    'SELECT * FROM tournament_sections WHERE tournament_id = ? ORDER BY archived_at IS NOT NULL, position, name',
  ).bind(tournamentId).all<SectionRow>()).results

const live = async (tournamentId: string) => (await sectionsOf(tournamentId)).filter((s) => s.archived_at === null)
const archived = async (tournamentId: string) => (await sectionsOf(tournamentId)).filter((s) => s.archived_at !== null)

const primaryOf = async (tournamentId: string) => {
  const rows = (await env.DB.prepare(
    'SELECT id, label FROM tournament_schedules WHERE tournament_id = ? AND is_primary = 1 AND archived_at IS NULL',
  ).bind(tournamentId).all<{ id: string; label: string }>()).results
  expect(rows, `one live primary schedule for ${tournamentId}`).toHaveLength(1)
  return rows[0]
}

const roundsOf = async (tournamentId: string) => {
  const { id } = await primaryOf(tournamentId)
  return (await env.DB.prepare('SELECT round, date, time FROM tournament_schedule_rounds WHERE schedule_id = ? ORDER BY round')
    .bind(id).all<{ round: number; date: string | null; time: string | null }>()).results
}

const entryOf = (tournamentId: string, memberId: string) =>
  env.DB.prepare('SELECT id, section, section_id, schedule_id FROM registrations WHERE tournament_id = ? AND member_id = ?')
    .bind(tournamentId, memberId)
    .first<{ id: string; section: string; section_id: string | null; schedule_id: string | null }>()

/** The entry points at the live section of its own name and at the primary schedule. */
async function expectLinked(tournamentId: string, memberId: string, section: string) {
  const entry = await entryOf(tournamentId, memberId)
  expect(entry?.section).toBe(section)
  const row = (await live(tournamentId)).find((s) => s.name === section)
  expect(row, `live section ${section}`).toBeDefined()
  expect(entry?.section_id).toBe(row?.id)
  expect(entry?.schedule_id).toBe((await primaryOf(tournamentId)).id)
}

const openEntries = (tournamentId: string) =>
  env.DB.prepare(`UPDATE tournaments SET registration_status = 'open' WHERE id = ?`).bind(tournamentId).run()

describe('tournaments made by the factory and the admin POST', () => {
  it('a seeded tournament has its section rows and one primary schedule', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25, prizeFund: '$500' }, { name: 'U1200', entryFee: 0 }] })
    const rows = await live(tournamentId)
    expect(rows.map((r) => [r.name, r.position, r.fee_regular, r.prize_fund])).toEqual([['Open', 0, 25, '$500'], ['U1200', 1, 0, null]])
    expect(await primaryOf(tournamentId)).toMatchObject({ label: 'Main schedule' })
  })

  it('the unchanged admin POST creates the rows, with the default Open section when none is sent', async () => {
    const admin = await seedAdmin()
    const withSections = await invoke(createTournament, {
      method: 'POST',
      as: admin,
      body: {
        name: 'Section Probe Open', location: 'Kenner, LA', date: '2026-10-24', entryFee: 30,
        sections: [{ name: 'Open', entryFee: 30, prizeFund: '$800' }, { name: 'U1400', entryFee: 20 }],
      },
    })
    expect(withSections.status).toBe(201)
    const { tournament } = await withSections.json<{ tournament: { id: string; sections: string } }>()
    expect(JSON.parse(tournament.sections)).toEqual([{ name: 'Open', entryFee: 30, prizeFund: '$800' }, { name: 'U1400', entryFee: 20 }])
    expect((await live(tournament.id)).map((r) => [r.name, r.fee_regular, r.prize_fund])).toEqual([['Open', 30, '$800'], ['U1400', 20, null]])
    expect(await roundsOf(tournament.id)).toEqual([])

    const bare = await invoke(createTournament, {
      method: 'POST', as: admin, body: { name: 'Bare Probe', location: 'Kenner, LA', date: '2026-10-31', entryFee: 15 },
    })
    expect(bare.status).toBe(201)
    const { tournament: plain } = await bare.json<{ tournament: { id: string } }>()
    expect((await live(plain.id)).map((r) => [r.name, r.fee_regular])).toEqual([['Open', 15]])
    await primaryOf(plain.id)
  })

  it('a refused POST (plain member) creates no rows', async () => {
    const before = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_sections').first<{ n: number }>()
    const member = await seedMember()
    const res = await invoke(createTournament, {
      method: 'POST', as: member, body: { name: 'Nope', location: 'Kenner, LA', date: '2026-10-31', entryFee: 15 },
    })
    expect(res.status).toBe(403)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_sections').first<{ n: number }>()).toEqual(before)
  })
})

describe('entries written by the unchanged handlers', () => {
  it('registrations.ts: a free entry, a paid entry and a waitlist entry each get section_id and schedule_id', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 2, sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 0 }] })

    const free = await seedMember({ uscfRating: 1000 })
    expect((await invoke(registrationsPost, { method: 'POST', as: free, body: { tournamentId, section: 'U1200' } })).status).toBe(201)
    await expectLinked(tournamentId, free, 'U1200')

    const paid = await seedMember()
    expect((await invoke(registrationsPost, { method: 'POST', as: paid, body: { tournamentId, section: 'Open' } })).status).toBe(201)
    expect(stripeSessions).toHaveLength(1)
    await expectLinked(tournamentId, paid, 'Open')

    const late = await seedMember()
    expect((await invoke(registrationsPost, { method: 'POST', as: late, body: { tournamentId, section: 'Open', waitlist: true } })).status).toBe(201)
    await expectLinked(tournamentId, late, 'Open')
  })

  it('batch.ts: a parent entering themselves and a child', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'U800', entryFee: 0 }] })
    const parent = await seedMember()
    const child = await seedMember({ uscfRating: 600 })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: child, section: 'U800' }] },
    })
    expect(res.status).toBe(201)
    await expectLinked(tournamentId, parent, 'Open')
    await expectLinked(tournamentId, child, 'U800')
  })

  it('walk-ins.ts: a walk-in entered by the director', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 15 }] })
    const res = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId }, body: { fullName: 'Door Player', section: 'Reserve' },
    })
    expect(res.status).toBe(201)
    const { guestId } = await res.json<{ guestId: string }>()
    await expectLinked(tournamentId, guestId, 'Reserve')
  })

  it('registrations/[id].ts: moving an entry to another section moves its section_id', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }, { name: 'Reserve', entryFee: 0 }] })
    const player = await seedMember()
    const regId = await seedRegistration({ tournamentId, memberId: player, section: 'Open' })
    await expectLinked(tournamentId, player, 'Open')
    const res = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: regId }, body: { section: 'Reserve' } })
    expect(res.status).toBe(200)
    await expectLinked(tournamentId, player, 'Reserve')
  })
})

describe('the soak case: the unchanged admin PATCH edits sections and rounds', () => {
  it('adds, renames and removes sections and replaces the rounds; the rows follow the JSON and new entries link', async () => {
    const admin = await seedAdmin()
    const created = await invoke(createTournament, {
      method: 'POST',
      as: admin,
      body: {
        name: 'Soak Open', location: 'Kenner, LA', date: '2026-11-07', entryFee: 30,
        sections: [{ name: 'Open', entryFee: 30 }, { name: 'U1600', entryFee: 25 }, { name: 'Reserve', entryFee: 20 }],
      },
    })
    expect(created.status).toBe(201)
    const tournamentId = (await created.json<{ tournament: { id: string } }>()).tournament.id
    await openEntries(tournamentId)

    const first = await invoke(patchTournament, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { roundSchedule: [{ round: 1, date: '2026-11-07', time: '10:00' }, { round: 2, date: '2026-11-07', time: '14:00' }] },
    })
    expect(first.status).toBe(200)
    expect(await roundsOf(tournamentId)).toEqual([
      { round: 1, date: '2026-11-07', time: '10:00' },
      { round: 2, date: '2026-11-07', time: '14:00' },
    ])

    const before = await live(tournamentId)
    const openId = before.find((s) => s.name === 'Open')?.id as string
    const u1600Id = before.find((s) => s.name === 'U1600')?.id as string
    // A cap set by the later setup page; the sync must never touch it.
    await env.DB.prepare('UPDATE tournament_sections SET cap = 40 WHERE id = ?').bind(openId).run()
    const u1600Player = await seedMember({ uscfRating: 1500 })
    await seedRegistration({ tournamentId, memberId: u1600Player, section: 'U1600' })

    // Old code renames U1600 to U1800 by sending the new name; Reserve goes
    // and Scholastic arrives; the round times change.
    const sections = [{ name: 'Open', entryFee: 35, prizeFund: '$900' }, { name: 'U1800', entryFee: 25 }, { name: 'Scholastic', entryFee: 0 }]
    const roundSchedule = [
      { round: 1, date: '2026-11-07', time: '09:30' },
      { round: 2, date: '2026-11-07', time: '13:30' },
      { round: 3, date: '2026-11-08', time: '10:00' },
    ]
    const res = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections, roundSchedule } })
    expect(res.status).toBe(200)

    // The JSON is unchanged in shape and stays what the handler wrote.
    const stored = await env.DB.prepare('SELECT sections, round_schedule FROM tournaments WHERE id = ?').bind(tournamentId)
      .first<{ sections: string; round_schedule: string }>()
    expect(JSON.parse(stored?.sections as string)).toEqual(sections)
    expect(JSON.parse(stored?.round_schedule as string)).toEqual(roundSchedule)

    // Live rows match the JSON: names, order, fees and prize funds.
    const after = await live(tournamentId)
    expect(after.map((s) => ({ name: s.name, position: s.position, fee: s.fee_regular, prize: s.prize_fund }))).toEqual(
      sections.map((s, position) => ({ name: s.name, position, fee: s.entryFee, prize: s.prizeFund ?? null })),
    )
    const open = after.find((s) => s.name === 'Open') as SectionRow
    expect(open).toMatchObject({ id: openId, cap: 40, fee_early: null, fee_late: null })
    expect((await archived(tournamentId)).map((s) => s.name).sort()).toEqual(['Reserve', 'U1600'])
    expect((await archived(tournamentId)).find((s) => s.name === 'U1600')?.id).toBe(u1600Id)

    // The primary rounds match round_schedule.
    expect(await roundsOf(tournamentId)).toEqual(roundSchedule)

    // The entry made under the old name keeps its (now archived) section.
    expect((await entryOf(tournamentId, u1600Player))?.section_id).toBe(u1600Id)

    // An entry into the new section links to it.
    // The admin POST makes a rated event, which asks for a US Chess ID.
    const kid = await seedMember({ uscfId: '30000001' })
    const kidRes = await invoke(registrationsPost, { method: 'POST', as: kid, body: { tournamentId, section: 'Scholastic' } })
    expect(kidRes.status, JSON.stringify(await kidRes.json())).toBe(201)
    await expectLinked(tournamentId, kid, 'Scholastic')
    const scholastic = after.find((s) => s.name === 'Scholastic')
    expect((await entryOf(tournamentId, kid))?.section_id).toBe(scholastic?.id)

    // A PATCH that does not touch sections or rounds leaves every row as it was.
    const rowsBefore = await sectionsOf(tournamentId)
    const roundsBefore = await roundsOf(tournamentId)
    expect((await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { description: 'Bring a clock.' } })).status).toBe(200)
    expect(await sectionsOf(tournamentId)).toEqual(rowsBefore)
    expect(await roundsOf(tournamentId)).toEqual(roundsBefore)
  })

  it('a refused PATCH (a plain member) changes no rows', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 10 }] })
    const rowsBefore = await sectionsOf(tournamentId)
    const member = await seedMember()
    const res = await invoke(patchTournament, {
      method: 'PATCH', as: member, params: { id: tournamentId }, body: { sections: [{ name: 'Hijacked', entryFee: 0 }] },
    })
    expect(res.status).toBe(403)
    expect(await sectionsOf(tournamentId)).toEqual(rowsBefore)
  })

  it('the unchanged admin DELETE still removes a tournament with entries, and its rows go with it', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 0 }] })
    await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'Open' })
    const res = await invoke(deleteTournament, { method: 'DELETE', as: admin, params: { id: tournamentId } })
    expect(res.status).toBe(200)
    expect(await sectionsOf(tournamentId)).toEqual([])
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournament_schedules WHERE tournament_id = ?').bind(tournamentId).first()).toEqual({ n: 0 })
  })
})
