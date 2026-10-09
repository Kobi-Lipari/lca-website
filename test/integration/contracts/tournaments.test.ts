// test/integration/contracts/tournaments.test.ts
// The endpoints that answer with a tournament or its sections read them
// from tournament_sections (K2e) and keep their contracts
// (domain/contracts/events.ts and clubs.ts): the event page, the manage
// page's load, the registration settings save, the rating report, the
// clearinghouse feed and the club page. Each section carries its id, its
// cap and its prices beside every field the JSON element had, so the pages
// (unchanged in this step) read what they read before. Lists read the
// sections of every event together, never one query per event. The manage
// page and the setup wizard send sections back as they got them, and that
// changes nothing it should not.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestGet as tournamentsGet } from '../../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../../functions/api/tournaments/[id]'
import { onRequestGet as manageGet } from '../../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as registrationSettingsPatch } from '../../../functions/api/admin/tournaments/[id]/registration'
import { onRequestGet as ratingReportGet } from '../../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as tournamentPatch } from '../../../functions/api/admin/tournaments/[id]'
import { onRequestPost as tournamentPost } from '../../../functions/api/admin/tournaments'
import { onRequestGet as clearinghouseGet } from '../../../functions/api/clearinghouse'
import { onRequestGet as clubGet } from '../../../functions/api/clubs/[id]'
import {
  seedAdmin,
  seedClub,
  seedDirector,
  seedMember,
  seedRegistration,
  seedTournament,
  seedTournamentDirector,
} from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)
afterEach(() => { vi.restoreAllMocks() })

interface SectionRow {
  id: string
  name: string
  position: number
  fee_regular: number | null
  fee_early: number | null
  fee_late: number | null
  cap: number | null
  archived_at: string | null
}

const sectionRows = async (tournamentId: string) =>
  (await env.DB.prepare(
    `SELECT id, name, position, fee_regular, fee_early, fee_late, cap, archived_at FROM tournament_sections
      WHERE tournament_id = ? ORDER BY archived_at IS NOT NULL, position`,
  ).bind(tournamentId).all<SectionRow>()).results

const liveRows = async (tournamentId: string) => (await sectionRows(tournamentId)).filter((r) => r.archived_at === null)

const legacyJson = async (tournamentId: string) =>
  JSON.parse((await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>())!.sections) as unknown[]

const tournamentRow = (tournamentId: string) => env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first()

/** SQL text of each statement prepared on the database while `run` runs. */
async function preparedDuring(run: () => Promise<unknown>): Promise<string[]> {
  const spy = vi.spyOn(env.DB, 'prepare')
  try {
    await run()
    return spy.mock.calls.map((call) => String(call[0]))
  } finally {
    spy.mockRestore()
  }
}

/**
 * A completed, rated event with early and late prices, a schedule, two
 * players who played one game (the first wins a $100 prize), a player on
 * the waitlist, and a cap on one section.
 */
async function seedPlayedEvent(opts: { clubId?: string } = {}) {
  const tournamentId = await seedTournament({
    clubId: opts.clubId ?? null,
    entryFee: 30,
    rounds: 1,
    isRated: true,
    status: 'completed',
    sections: [
      { name: 'Open', entryFee: 30, prizeFund: '$100 guaranteed', prizes: { place: [{ amount: 100, label: '1st' }] } },
      { name: 'U1200', entryFee: 10, ratingMax: 1199, unratedOk: true, rulesSet: true },
    ],
  })
  await env.DB.prepare(
    `UPDATE tournaments SET early_deadline = '2026-09-01T23:59', early_discount = 5, late_after = '2026-09-10T12:00', late_fee = 10,
       round_schedule = ?, custom_details = ? WHERE id = ?`,
  ).bind(
    JSON.stringify([{ round: 1, date: '2026-09-12', time: '10:00' }]),
    JSON.stringify([{ title: 'Parking', body: 'Free in the back lot.' }]),
    tournamentId,
  ).run()
  await env.DB.prepare(`UPDATE tournament_sections SET cap = 24 WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
  const winner = await seedMember({ fullName: 'Alice Winner', uscfId: '11111111', uscfRating: 1800 })
  const loser = await seedMember({ fullName: 'Bob Second', uscfId: '22222222', uscfRating: 1600 })
  const waiting = await seedMember({ fullName: 'Cara Waiting' })
  await seedRegistration({ tournamentId, memberId: winner, section: 'Open', byeRounds: [2] })
  await seedRegistration({ tournamentId, memberId: loser, section: 'Open' })
  const waitlisted = await seedRegistration({ tournamentId, memberId: waiting, section: 'Open' })
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(waitlisted).run()
  await env.DB.prepare(
    `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
     VALUES (?, ?, 1, 1, 'Open', ?, ?, '1-0')`,
  ).bind(`g-${tournamentId}`, tournamentId, winner, loser).run()
  return { tournamentId, winner, loser }
}

/** Every key and value of each legacy JSON element is in the answer's section of the same place. */
async function keepsTheLegacyFields(tournamentId: string, sections: unknown[]) {
  const legacy = await legacyJson(tournamentId)
  expect(sections).toHaveLength(legacy.length)
  legacy.forEach((element, i) => expect(sections[i]).toMatchObject(element as object))
}

describe('GET /api/tournaments/[id] contract', () => {
  const contract = contracts['tournaments/[id]'].GET

  it('holds for a finished event: sections from the table with ids, caps and prices, standings, prizes and the viewer\'s entry', async () => {
    const { tournamentId, winner } = await seedPlayedEvent()
    const result = await invoke(tournamentGet, { as: winner, params: { id: tournamentId }, path: `/api/tournaments/${tournamentId}` })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)

    const rows = await liveRows(tournamentId)
    expect(body.tournament.sections.map((s) => [s.id, s.name, s.cap])).toEqual(rows.map((r) => [r.id, r.name, r.cap]))
    expect(body.tournament.sections.map((s) => [s.entryFee, s.fees])).toEqual([
      [30, { regular: 30, early: 25, late: 40 }],
      [10, { regular: 10, early: 5, late: 20 }],
    ])
    // The page reads the fields the JSON element had; each is still there, unchanged.
    await keepsTheLegacyFields(tournamentId, body.tournament.sections)
    expect(body.tournament.round_schedule).toEqual([{ round: 1, date: '2026-09-12', time: '10:00' }])
    expect(body.tournament.custom_details).toEqual([{ title: 'Parking', body: 'Free in the back lot.' }])
    expect(body.tournament.waitlist_count).toBe(1)
    expect(body.roster.map((r) => r.full_name)).toEqual(['Alice Winner', 'Bob Second'])
    expect(body.standings[0]).toMatchObject({ member_id: winner, score: 1, place: 1 })
    expect(body.prizes).toEqual([expect.objectContaining({ member_id: winner, section: 'Open', cash: 100 })])
    expect(body.myRegistration?.bye_rounds).toEqual([2])
  })

  it('holds signed out, with no entry, and publishes no prizes before the event is completed', async () => {
    const tournamentId = await seedTournament()
    const body = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contract.response)
    expect(body.myRegistration).toBeNull()
    expect(body.prizes).toEqual([])
    expect(body.tournament.round_schedule).toEqual([])
    expect(body.tournament.custom_details).toEqual([])
  })

  it('reads the rows, not the JSON column, and leaves an archived section out of entry', async () => {
    const tournamentId = await seedTournament()
    // The JSON still lists U1200 but its row is archived; then the JSON is broken outright.
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    await env.DB.prepare(`UPDATE tournaments SET sections = 'not json' WHERE id = ?`).bind(tournamentId).run()
    const body = await expectContract(await invoke(tournamentGet, { params: { id: tournamentId } }), contract.response)
    expect(body.tournament.sections.map((s) => s.name)).toEqual(['Open'])
  })

  it('role safety: a hidden draft is 404 for no sign-in, a plain member and another club\'s rep; its managers see it', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const tournamentId = await seedTournament({ clubId, isVisible: false })
    const strangers = [undefined, await seedMember(), await seedMember({ role: 'club_rep', clubId: otherClub })]
    for (const as of strangers) {
      const res = await invoke(tournamentGet, { as, params: { id: tournamentId } })
      expect(res.status, String(as)).toBe(404)
      expect(await res.response.text()).not.toContain('U1200')
    }
    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    for (const as of [await seedAdmin(), await seedMember({ role: 'club_rep', clubId }), director, await seedMember({ role: 'lca_observer' })]) {
      const res = await invoke(tournamentGet, { as, params: { id: tournamentId } })
      expect(res.status, as).toBe(200)
      await expectContract(res, contract.response)
    }
  })
})

describe('GET /api/admin/tournaments/[id]/manage contract', () => {
  const contract = contracts['admin/tournaments/[id]/manage'].GET

  it('holds with the whole roster, games, standings, prizes and directors, and the live sections from the table', async () => {
    const clubId = await seedClub()
    const { tournamentId, winner } = await seedPlayedEvent({ clubId })
    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()

    const result = await invoke(manageGet, { as: director, params: { id: tournamentId } })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    expect(body.tournament.sections.map((s) => [s.name, s.fees])).toEqual([['Open', { regular: 30, early: 25, late: 40 }]])
    expect(body.tournament.round_schedule).toEqual([{ round: 1, date: '2026-09-12', time: '10:00' }])
    expect(body.roster).toHaveLength(3)
    expect(body.roster.find((r) => r.member_id === winner)?.bye_rounds).toEqual([2])
    expect(body.games).toHaveLength(1)
    expect(body.prizes).toEqual([expect.objectContaining({ member_id: winner, cash: 100 })])
    expect(body.directors.map((d) => d.member_id)).toEqual([director])
  })

  it('keeps every field the JSON element had, for the setup form', async () => {
    const { tournamentId } = await seedPlayedEvent()
    const body = await expectContract(await invoke(manageGet, { as: await seedAdmin(), params: { id: tournamentId } }), contract.response)
    await keepsTheLegacyFields(tournamentId, body.tournament.sections)
  })

  it('role safety: a plain member and another club\'s rep get 403, no sign-in is 401', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    for (const as of [await seedMember(), await seedMember({ role: 'club_rep', clubId: await seedClub() })]) {
      expect((await invoke(manageGet, { as, params: { id: tournamentId } })).status).toBe(403)
    }
    expect((await invoke(manageGet, { params: { id: tournamentId } })).status).toBe(401)
    for (const as of [await seedMember({ role: 'club_rep', clubId }), await seedMember({ role: 'lca_observer' })]) {
      await expectContract(await invoke(manageGet, { as, params: { id: tournamentId } }), contract.response)
    }
  })
})

describe('the manage page sends its sections back as it got them', () => {
  const edit = contracts['admin/tournaments/[id]'].PATCH

  async function loaded() {
    const admin = await seedAdmin()
    const { tournamentId } = await seedPlayedEvent()
    const body = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } }))
      .json<{ tournament: { sections: Array<Record<string, unknown>> } }>()
    return { admin, tournamentId, sections: body.tournament.sections }
  }

  it('unchanged: the save is taken and no row changes, so worked-out prices stay worked out', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const before = await sectionRows(tournamentId)
    const res = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections } })
    expect(res.status).toBe(200)
    await expectContract(res, edit.response)
    expect(await sectionRows(tournamentId)).toEqual(before)
    expect(before.map((r) => [r.fee_early, r.fee_late])).toEqual([[null, null], [null, null]])
  })

  it('with a fee changed and a section added, as the form does it: the new fee is taken and early and late follow it', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const changed = [{ ...sections[0], entryFee: 35 }, sections[1], { name: 'Reserve', entryFee: 15 }]
    const res = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: changed } })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, edit.response)
    expect(tournament.sections.map((s) => [s.name, s.fees])).toEqual([
      ['Open', { regular: 35, early: 30, late: 45 }],
      ['U1200', { regular: 10, early: 5, late: 20 }],
      ['Reserve', { regular: 15, early: 10, late: 25 }],
    ])
    const rows = await liveRows(tournamentId)
    expect(rows.map((r) => [r.name, r.fee_regular, r.fee_early, r.fee_late, r.cap])).toEqual([
      ['Open', 35, null, null, null],
      ['U1200', 10, null, null, 24],
      ['Reserve', 15, null, null, null],
    ])
    // The JSON mirror holds no id, cap or prices.
    expect(JSON.stringify(await legacyJson(tournamentId))).not.toMatch(/"(id|cap|fees)"/)
  })

  it('a section\'s own early or late price is still set by sending fees without regular', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const own = [{ ...sections[0], fees: { early: 22 } }, sections[1]]
    const res = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: own } })
    expect(res.status).toBe(200)
    expect((await liveRows(tournamentId)).map((r) => [r.name, r.fee_early])).toEqual([['Open', 22], ['U1200', null]])
  })
})

describe('the setup wizard copies an event\'s sections from the list', () => {
  const create = contracts['admin/tournaments'].POST

  it('creates new rows: ids from the other event are not used and its worked-out prices are not taken as the new event\'s own', async () => {
    const admin = await seedAdmin()
    const { tournamentId: source } = await seedPlayedEvent()
    const list = await (await invoke(tournamentsGet, { as: admin, path: '/api/tournaments' }))
      .json<{ tournaments: Array<{ id: string; sections: Array<Record<string, unknown>> }> }>()
    const copied = list.tournaments.find((t) => t.id === source)!.sections
    const res = await invoke(tournamentPost, {
      method: 'POST', as: admin,
      body: { name: 'Copied Open', location: 'Kenner, LA', date: '2026-11-14', entryFee: 30, sections: copied },
    })
    expect(res.status).toBe(201)
    const { tournament } = await expectContract(res, create.response)
    const sourceIds = new Set((await sectionRows(source)).map((r) => r.id))
    const rows = await liveRows(tournament.id)
    expect(rows.map((r) => r.name)).toEqual(['Open', 'U1200'])
    expect(rows.some((r) => sourceIds.has(r.id))).toBe(false)
    expect(rows.map((r) => [r.fee_regular, r.fee_early, r.fee_late, r.cap])).toEqual([[30, null, null, null], [10, null, null, 24]])
    // The new event has no early or late price yet.
    expect(tournament.sections.map((s) => s.fees)).toEqual([
      { regular: 30, early: null, late: null },
      { regular: 10, early: null, late: null },
    ])
  })
})

describe('PATCH /api/admin/tournaments/[id]/registration contract', () => {
  const contract = contracts['admin/tournaments/[id]/registration'].PATCH

  it('saves the settings and answers with the sections and round_schedule as lists', async () => {
    const admin = await seedAdmin()
    const { tournamentId } = await seedPlayedEvent()
    expect(contract.request.safeParse({ registration_status: 'closed', reminder_1_enabled: false }).success).toBe(true)
    const res = await invoke(registrationSettingsPatch, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { registration_status: 'closed', reminder_1_days_before: 3, reminder_2_enabled: false },
    })
    expect(res.status).toBe(200)
    const { tournament } = await expectContract(res, contract.response)
    expect(tournament).toMatchObject({ registration_status: 'closed', reminder_1_days_before: 3, reminder_2_enabled: 0 })
    expect(tournament.sections.map((s) => [s.id, s.name])).toEqual((await liveRows(tournamentId)).map((r) => [r.id, r.name]))
    expect(tournament.round_schedule).toEqual([{ round: 1, date: '2026-09-12', time: '10:00' }])
  })

  it('a malformed body is 400 in the { error, fields } shape and writes nothing', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const before = await tournamentRow(tournamentId)
    for (const body of [{ registration_status: 'maybe' }, { reminder_1_days_before: 'soon' }]) {
      const res = await invoke(registrationSettingsPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body })
      expect(res.status).toBe(400)
      await expectContract(res, fieldErrorBodySchema)
    }
    const notJson = await invoke(registrationSettingsPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, rawBody: '{', headers: { 'Content-Type': 'application/json' } })
    expect(notJson.status).toBe(400)
    expect(await tournamentRow(tournamentId)).toEqual(before)
  })

  it('role safety: a plain member and another club\'s rep get 403, no sign-in is 401, and nothing is written; the club\'s rep and a director pass', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const before = await tournamentRow(tournamentId)
    const body = { registration_status: 'closed' }
    for (const as of [await seedMember(), await seedMember({ role: 'club_rep', clubId: await seedClub() }), await seedMember({ role: 'lca_observer' })]) {
      expect((await invoke(registrationSettingsPatch, { method: 'PATCH', as, params: { id: tournamentId }, body })).status).toBe(403)
    }
    expect((await invoke(registrationSettingsPatch, { method: 'PATCH', params: { id: tournamentId }, body })).status).toBe(401)
    expect(await tournamentRow(tournamentId)).toEqual(before)

    const director = await seedDirector()
    await seedTournamentDirector(tournamentId, director)
    for (const as of [await seedMember({ role: 'club_rep', clubId }), director]) {
      await expectContract(await invoke(registrationSettingsPatch, { method: 'PATCH', as, params: { id: tournamentId }, body }), contract.response)
    }
  })
})

describe('GET /api/admin/tournaments/[id]/rating-report contract', () => {
  const contract = contracts['admin/tournaments/[id]/rating-report'].GET

  it('holds, and keeps an archived section that was played (the report is history)', async () => {
    const admin = await seedAdmin()
    const { tournamentId } = await seedPlayedEvent()
    // Blitz was never in the JSON; its entries made an archived row of that name.
    const a = await seedMember({ fullName: 'Dan Blitz', uscfId: '33333333', uscfRating: 1500 })
    const b = await seedMember({ fullName: 'Eve Blitz', uscfId: '44444444', uscfRating: 1400 })
    await seedRegistration({ tournamentId, memberId: a, section: 'Blitz' })
    await seedRegistration({ tournamentId, memberId: b, section: 'Blitz' })
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result)
       VALUES (?, ?, 1, 1, 'Blitz', ?, ?, '1/2-1/2')`,
    ).bind(`gb-${tournamentId}`, tournamentId, a, b).run()
    expect((await sectionRows(tournamentId)).find((r) => r.name === 'Blitz')?.archived_at).not.toBeNull()
    expect(JSON.stringify(await legacyJson(tournamentId))).not.toContain('Blitz')

    const result = await invoke(ratingReportGet, { as: admin, params: { id: tournamentId } })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    // U1200 had nobody play, so it is left out; Blitz comes after the live sections.
    expect(body.sections.map((s) => s.name)).toEqual(['Open', 'Blitz'])
    expect(body.sections[1].players.map((p) => [p.name, p.score])).toEqual([['Dan Blitz', 0.5], ['Eve Blitz', 0.5]])
    expect(body.validationErrors).toEqual([])
  })

  it('says US Chess, not USCF, and gives an expiry date with its weekday', async () => {
    const admin = await seedAdmin()
    const { tournamentId, winner, loser } = await seedPlayedEvent()
    await env.DB.prepare(`UPDATE members SET uscf_id = NULL WHERE id = ?`).bind(winner).run()
    await env.DB.prepare(`UPDATE members SET uscf_expiration = '2026-08-31' WHERE id = ?`).bind(loser).run()
    const body = await expectContract(await invoke(ratingReportGet, { as: admin, params: { id: tournamentId } }), contract.response)
    expect(body.validationErrors).toEqual([
      'Alice Winner (Open) has no US Chess ID. The report cannot be submitted until one is added.',
      'Bob Second (Open): US Chess membership expired Mon, Aug 31, 2026. It must be renewed before US Chess will rate the event.',
    ])

    const unrated = await seedTournament({ isRated: false })
    const res = await invoke(ratingReportGet, { as: admin, params: { id: unrated } })
    expect(res.status).toBe(400)
    const { error } = await res.json<{ error: string }>()
    expect(error).toBe('This tournament is not US Chess rated, so it has no rating report.')
    expect(error).not.toContain('USCF')
  })

  it('role safety: a plain member and another club\'s rep get 403, no sign-in is 401', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId, isRated: true })
    for (const as of [await seedMember(), await seedMember({ role: 'club_rep', clubId: await seedClub() })]) {
      expect((await invoke(ratingReportGet, { as, params: { id: tournamentId } })).status).toBe(403)
    }
    expect((await invoke(ratingReportGet, { params: { id: tournamentId } })).status).toBe(401)
    await expectContract(await invoke(ratingReportGet, { as: await seedMember({ role: 'club_rep', clubId }), params: { id: tournamentId } }), contract.response)
  })
})

describe('GET /api/clearinghouse contract', () => {
  const contract = contracts['clearinghouse'].GET

  it('holds for LCA events with their live sections and partner events with none; drafts stay out', async () => {
    const clubId = await seedClub({ name: 'Kenner Chess Club' })
    const { tournamentId } = await seedPlayedEvent({ clubId })
    await env.DB.prepare(`UPDATE tournaments SET status = 'upcoming' WHERE id = ?`).bind(tournamentId).run()
    const draft = await seedTournament({ name: 'Secret draft', isVisible: false })
    await env.DB.prepare(
      `INSERT INTO clearinghouse (id, name, start_date, end_date, organizer, city, state, venue, rating_system, eligibility, contact, link, is_lca)
       VALUES ('ch-1', 'Gulf Coast Open', '2030-01-05', '2030-01-06', 'Gulf Coast CC', 'Mobile', 'AL', NULL, 'US Chess', 'Open', 'td@example.org', 'https://example.org/gco', 0)`,
    ).run()

    expect(contract.query?.safeParse({ state: 'all', upcoming: 'false' }).success).toBe(true)
    const result = await invoke(clearinghouseGet, { path: '/api/clearinghouse?state=all' })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    const lca = body.tournaments.find((t) => t.id === tournamentId)
    expect(lca?.source).toBe('lca')
    expect(lca?.sections.map((s) => [s.id, s.name, s.cap])).toEqual((await liveRows(tournamentId)).map((r) => [r.id, r.name, r.cap]))
    expect(lca?.registered_count).toBe(2)
    await keepsTheLegacyFields(tournamentId, lca!.sections)
    const partner = body.tournaments.find((t) => t.id === 'ch-1')
    expect(partner).toMatchObject({ source: 'clearinghouse', sections: [], entry_fee: null })
    expect(body.tournaments.map((t) => t.id)).not.toContain(draft)
  })
})

describe('GET /api/clubs/[id] contract', () => {
  const contract = contracts['clubs/[id]'].GET

  it('holds, with each visible event\'s live sections as a list and no drafts', async () => {
    const clubId = await seedClub({ name: 'Kenner Chess Club' })
    const officer = await seedMember({ fullName: 'Pat Officer' })
    await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES ('off-1', ?, ?, 'President')`).bind(clubId, officer).run()
    await env.DB.prepare(`INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES ('news-1', ?, 'Club night', '2026-10-01', 'Every Tuesday.')`).bind(clubId).run()
    const shown = await seedTournament({ clubId, sections: [{ name: 'Open', entryFee: 20 }, 'K-5' as unknown as { name: string; entryFee: number }] })
    const draft = await seedTournament({ clubId, isVisible: false })

    const result = await invoke(clubGet, { params: { id: clubId } })
    expect(result.status).toBe(200)
    const body = await expectContract(result, contract.response)
    expect(body.tournaments.map((t) => t.id)).toEqual([shown])
    expect(body.tournaments[0].sections.map((s) => [s.id, s.name, s.entryFee])).toEqual(
      (await liveRows(shown)).map((r) => [r.id, r.name, r.name === 'Open' ? 20 : 25]),
    )
    expect(body.tournaments.map((t) => t.id)).not.toContain(draft)
    expect(body.officers.map((o) => o.full_name)).toEqual(['Pat Officer'])
    expect(body.news.map((n) => n.title)).toEqual(['Club night'])
  })
})

describe('lists read every event\'s sections together', () => {
  let batch = 0

  /** n visible events, each with two sections, put in with plain SQL (the 0053 trigger makes the rows). */
  async function seedMany(n: number): Promise<string[]> {
    const prefix = `many-${++batch}`
    const ids = Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}`)
    await env.DB.batch(ids.map((id, i) => env.DB.prepare(
      `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, rounds) VALUES (?, ?, 'Kenner, LA', '2026-10-24', 20, ?, 4)`,
    ).bind(id, `Event ${i}`, JSON.stringify([{ name: 'Open', entryFee: 20 }, { name: `U${1000 + i}`, entryFee: 5 }]))))
    return ids
  }

  const sectionQueries = (sql: string[]) => sql.filter((q) => /\btournament_sections\b/.test(q))

  /** One query per 90 events (D1 binds at most 100 parameters to a statement), each under the limit. */
  function bounded(sql: string[], events: number) {
    const queries = sectionQueries(sql)
    expect(queries).toHaveLength(Math.ceil(events / 90))
    for (const q of queries) expect((q.match(/\?/g) ?? []).length).toBeLessThanOrEqual(100)
  }

  it('GET /api/tournaments: 150 events or more take one section query per 90 events, not one each, and every event has its own', async () => {
    const ids = await seedMany(150)
    let body: { tournaments: Array<{ id: string; sections: Array<{ name: string }> }> } | undefined
    const sql = await preparedDuring(async () => {
      body = await expectContract(await invoke(tournamentsGet, { path: '/api/tournaments' }), contracts['tournaments'].GET.response)
    })
    expect(body!.tournaments.length).toBeGreaterThanOrEqual(150)
    bounded(sql, body!.tournaments.length)
    for (const [i, id] of ids.entries()) {
      expect(body!.tournaments.find((t) => t.id === id)?.sections.map((s) => s.name)).toEqual(['Open', `U${1000 + i}`])
    }
  })

  it('GET /api/clearinghouse: the same for the LCA events it lists', async () => {
    const ids = await seedMany(150)
    let body: { tournaments: Array<{ id: string; source: string; sections: unknown[] }> } | undefined
    const sql = await preparedDuring(async () => {
      body = await expectContract(await invoke(clearinghouseGet, { path: '/api/clearinghouse?state=all' }), contracts['clearinghouse'].GET.response)
    })
    const lca = body!.tournaments.filter((t) => t.source === 'lca')
    expect(lca.length).toBeGreaterThanOrEqual(150)
    bounded(sql, lca.length)
    for (const id of ids) expect(body!.tournaments.find((t) => t.id === id)?.sections).toHaveLength(2)
  })

  it('a list with no events asks for no sections at all', async () => {
    const clubId = await seedClub()
    const sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(clubGet, { params: { id: clubId } }), contracts['clubs/[id]'].GET.response)
      expect(body.tournaments).toEqual([])
    })
    expect(sectionQueries(sql)).toEqual([])
  })
})
