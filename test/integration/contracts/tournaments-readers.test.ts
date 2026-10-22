// test/integration/contracts/tournaments-readers.test.ts
// K2e, the readers moved to tournament_sections: what the endpoints that
// answer with a tournament must still do, seen from outside.
//
// - every reader follows the table when the JSON mirror is stale, and no
//   answer carries the sections or round_schedule JSON text
// - the pages read what they read before: every column passes through, a
//   section keeps the fields its JSON element had (and leaves out the ones
//   it left out), and gains id, cap and fees; entryFee is the regular price
// - an archived section is hidden where entry is offered and comes back
//   under the same id when its name returns (decision 7)
// - lists ask for their sections in bounded batches, detail pages in one
// - the settings save is the same on a replay and leaves the sections alone
// - the manage page's own round trip is idempotent and cannot reach into
//   another event
// - the rating report: dates with their weekday, "US Chess", ties, an event
//   with no end date, and the order of sections
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../../domain/contracts'
import { onRequestGet as tournamentsGet } from '../../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../../functions/api/tournaments/[id]'
import { onRequestGet as manageGet } from '../../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as registrationSettingsPatch } from '../../../functions/api/admin/tournaments/[id]/registration'
import { onRequestGet as ratingReportGet } from '../../../functions/api/admin/tournaments/[id]/rating-report'
import { onRequestPatch as tournamentPatch } from '../../../functions/api/admin/tournaments/[id]'
import { onRequestPost as tournamentPost } from '../../../functions/api/admin/tournaments'
import { onRequestGet as clearinghouseGet } from '../../../functions/api/clearinghouse'
import { onRequestGet as clubGet } from '../../../functions/api/clubs/[id]'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)
afterEach(() => { vi.restoreAllMocks() })

// ── Helpers ──────────────────────────────────────────────────────────

interface Section {
  id: string
  name: string
  entryFee: number
  cap: number | null
  fees: { regular: number; early: number | null; late: number | null }
  [field: string]: unknown
}

interface SectionRow {
  id: string
  name: string
  position: number
  fee_regular: number | null
  fee_early: number | null
  fee_late: number | null
  cap: number | null
  archived_at: string | null
  extra_json: string | null
}

const rowsOf = async (tournamentId: string) =>
  (await env.DB.prepare(
    `SELECT id, name, position, fee_regular, fee_early, fee_late, cap, archived_at, extra_json FROM tournament_sections
      WHERE tournament_id = ? ORDER BY archived_at IS NOT NULL, position`,
  ).bind(tournamentId).all<SectionRow>()).results

const liveRowsOf = async (tournamentId: string) => (await rowsOf(tournamentId)).filter((r) => r.archived_at === null)

const mirrorNames = async (tournamentId: string) =>
  (JSON.parse((await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>())!.sections) as Array<string | { name: string }>)
    .map((s) => (typeof s === 'string' ? s : s.name))

const tournamentRow = (tournamentId: string) =>
  env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<Record<string, unknown>>()

/** Early less $5 before September 1, late plus $10 after September 10. */
const addTiers = (tournamentId: string) =>
  env.DB.prepare(
    `UPDATE tournaments SET early_deadline = '2026-09-01T23:59', early_discount = 5, late_after = '2026-09-10T12:00', late_fee = 10 WHERE id = ?`,
  ).bind(tournamentId).run()

interface Setup {
  admin: string
  clubId: string
  tournamentId: string
}

interface Answers {
  /** Every body, by the endpoint that gave it. */
  bodies: Record<string, unknown>
  /** The sections of the event in each. */
  sections: Record<string, Section[]>
  /** The tournament object in each (the whole tournaments row as answered). */
  tournaments: Record<string, Record<string, unknown>>
}

/**
 * The event as each endpoint that returns it answers. The registration
 * settings and the admin edit are PATCHes with nothing to change. The admin
 * edit writes round_schedule, which fires the 0053 update trigger and so
 * re-reads the JSON mirror into the rows; a test that changes the rows
 * alone, leaving the mirror behind, passes `edit: false`.
 */
async function readEverywhere({ admin, clubId, tournamentId }: Setup, opts: { edit?: boolean } = {}): Promise<Answers> {
  const bodies: Record<string, unknown> = {}
  const sections: Record<string, Section[]> = {}
  const tournaments: Record<string, Record<string, unknown>> = {}
  const take = (name: string, body: unknown, tournament: Record<string, unknown> | undefined) => {
    expect(tournament, name).toBeDefined()
    bodies[name] = body
    tournaments[name] = tournament!
    sections[name] = tournament!.sections as Section[]
  }

  type Wrapped = { tournament: Record<string, unknown> }
  type Listed = { tournaments: Array<Record<string, unknown>> }

  const publicList = await (await invoke(tournamentsGet, { path: '/api/tournaments' })).json<Listed>()
  take('list', publicList, publicList.tournaments.find((t) => t.id === tournamentId))
  const staffList = await (await invoke(tournamentsGet, { as: admin, path: '/api/tournaments' })).json<Listed>()
  take('staff list', staffList, staffList.tournaments.find((t) => t.id === tournamentId))
  const detail = await (await invoke(tournamentGet, { params: { id: tournamentId } })).json<Wrapped>()
  take('detail', detail, detail.tournament)
  const manage = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } })).json<Wrapped>()
  take('manage', manage, manage.tournament)
  const settings = await invoke(registrationSettingsPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: {} })
  expect(settings.status).toBe(200)
  const settingsBody = await settings.json<Wrapped>()
  take('registration settings', settingsBody, settingsBody.tournament)
  if (opts.edit !== false) {
    const edit = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: {} })
    expect(edit.status).toBe(200)
    const editBody = await edit.json<Wrapped>()
    take('admin edit', editBody, editBody.tournament)
  }

  const feed = await (await invoke(clearinghouseGet, { path: '/api/clearinghouse?state=all&upcoming=false' })).json<Listed>()
  bodies['clearinghouse'] = feed
  sections['clearinghouse'] = feed.tournaments.find((t) => t.id === tournamentId)?.sections as Section[]
  const club = await (await invoke(clubGet, { params: { id: clubId } })).json<Listed>()
  bodies['club'] = club
  sections['club'] = club.tournaments.find((t) => t.id === tournamentId)?.sections as Section[]
  for (const name of Object.keys(sections)) expect(sections[name], name).toBeInstanceOf(Array)
  return { bodies, sections, tournaments }
}

/** Where, in a body, `sections` or `round_schedule` is not a list: the JSON column let out as text. */
function leakedJsonText(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leakedJsonText(v, `${path}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, v]) =>
    (key === 'sections' || key === 'round_schedule') && !Array.isArray(v)
      ? [`${path}.${key}`]
      : leakedJsonText(v, `${path}.${key}`))
}

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

const sectionQueries = (sql: string[]) => sql.filter((q) => /\btournament_sections\b/.test(q))

/** One query per 90 events (D1 binds at most 100 parameters to a statement), none over the limit. */
function expectBounded(sql: string[], events: number) {
  const queries = sectionQueries(sql)
  expect(queries).toHaveLength(Math.ceil(events / 90))
  for (const q of queries) expect((q.match(/\?/g) ?? []).length).toBeLessThanOrEqual(100)
}

/** n visible events of a club, each with a section of its own, in plain SQL (the 0053 trigger makes the rows). */
async function seedClubEvents(clubId: string, n: number, prefix: string): Promise<string[]> {
  const ids = Array.from({ length: n }, (_, i) => `${prefix}-${String(i).padStart(3, '0')}`)
  for (let from = 0; from < n; from += 40) {
    await env.DB.batch(ids.slice(from, from + 40).map((id, i) => env.DB.prepare(
      `INSERT INTO tournaments (id, name, location, date, entry_fee, sections, rounds, club_id) VALUES (?, ?, 'Kenner, LA', '2026-10-24', 20, ?, 4, ?)`,
    ).bind(id, `Event ${from + i}`, JSON.stringify([{ name: 'Open', entryFee: 20 }, { name: `S${from + i}`, entryFee: 5 }]), clubId)))
  }
  return ids
}

/** A club event with two sections and early and late prices. */
async function seedTiered(): Promise<Setup & { other: string }> {
  const admin = await seedAdmin()
  const clubId = await seedClub({ name: 'Kenner Chess Club' })
  const tournamentId = await seedTournament({
    clubId,
    entryFee: 30,
    sections: [
      { name: 'Open', entryFee: 30 },
      { name: 'U1200', entryFee: 10, ratingMax: 1199, unratedOk: true, rulesSet: true },
    ],
  })
  await addTiers(tournamentId)
  return { admin, clubId, tournamentId, other: await seedTournament() }
}

const names = (sections: Section[]) => sections.map((s) => s.name)

// ── The table, not the mirror ─────────────────────────────────────────

describe('every reader follows the table when the JSON mirror is stale', () => {
  it('a renamed row, its own prices and cap, and a row the JSON never listed show in all of them', async () => {
    const setup = await seedTiered()
    const { tournamentId } = setup
    const [open, small] = await liveRowsOf(tournamentId)
    // Table edits only: the mirror still says U1200 and knows no Extra.
    await env.DB.prepare(
      `UPDATE tournament_sections SET name = 'U1300', fee_regular = 12, fee_early = 7, fee_late = 18, cap = 10 WHERE id = ?`,
    ).bind(small.id).run()
    await env.DB.prepare(
      `INSERT INTO tournament_sections (id, tournament_id, position, name) VALUES ('sec-extra-readers', ?, 2, 'Extra')`,
    ).bind(tournamentId).run()
    expect(await mirrorNames(tournamentId)).toEqual(['Open', 'U1200'])

    const { sections } = await readEverywhere(setup, { edit: false })
    for (const [endpoint, list] of Object.entries(sections)) {
      expect(names(list), endpoint).toEqual(['Open', 'U1300', 'Extra'])
      expect(list.map((s) => s.id), endpoint).toEqual([open.id, small.id, 'sec-extra-readers'])
      expect(list.map((s) => [s.entryFee, s.fees, s.cap]), endpoint).toEqual([
        [30, { regular: 30, early: 25, late: 40 }, null],
        [12, { regular: 12, early: 7, late: 18 }, 10],
        [30, { regular: 30, early: 25, late: 40 }, null],
      ])
    }
  })

  it('a row the table has archived is gone from all of them, whatever the mirror lists', async () => {
    const setup = await seedTiered()
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'U1200'`).bind(setup.tournamentId).run()
    expect(await mirrorNames(setup.tournamentId)).toContain('U1200')
    const { sections } = await readEverywhere(setup, { edit: false })
    for (const [endpoint, list] of Object.entries(sections)) expect(names(list), endpoint).toEqual(['Open'])
  })

  it('a mirror that is not JSON at all changes nothing', async () => {
    const setup = await seedTiered()
    await env.DB.prepare(`UPDATE tournaments SET sections = 'not json', round_schedule = 'also not json' WHERE id = ?`).bind(setup.tournamentId).run()
    const { sections, tournaments } = await readEverywhere(setup)
    for (const [endpoint, list] of Object.entries(sections)) expect(names(list), endpoint).toEqual(['Open', 'U1200'])
    for (const [endpoint, tournament] of Object.entries(tournaments)) expect(tournament.round_schedule, endpoint).toEqual([])
  })
})

describe('no answer carries the sections or the round schedule as JSON text', () => {
  it('holds for every endpoint that returns a tournament, with a schedule stored and with none', async () => {
    const setup = await seedTiered()
    const schedule = [{ round: 1, date: '2026-09-12', time: '10:00' }, { round: 2, date: '2026-09-12', time: '14:30' }]
    await env.DB.prepare(`UPDATE tournaments SET round_schedule = ? WHERE id = ?`).bind(JSON.stringify(schedule), setup.tournamentId).run()
    const withSchedule = await readEverywhere(setup)
    for (const [endpoint, body] of Object.entries(withSchedule.bodies)) expect(leakedJsonText(body), endpoint).toEqual([])
    for (const [endpoint, tournament] of Object.entries(withSchedule.tournaments)) expect(tournament.round_schedule, endpoint).toEqual(schedule)

    await env.DB.prepare(`UPDATE tournaments SET round_schedule = '[]' WHERE id = ?`).bind(setup.tournamentId).run()
    const without = await readEverywhere(setup)
    for (const [endpoint, body] of Object.entries(without.bodies)) expect(leakedJsonText(body), endpoint).toEqual([])
    for (const [endpoint, tournament] of Object.entries(without.tournaments)) expect(tournament.round_schedule, endpoint).toEqual([])
  })

  it('holds for the answer to creating an event, with a name that is not a section anywhere else', async () => {
    const admin = await seedAdmin()
    const res = await invoke(tournamentPost, {
      method: 'POST', as: admin,
      body: { name: 'Fresh Open', location: 'Kenner, LA', date: '2026-11-14', entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }, 'K-5'] },
    })
    expect(res.status).toBe(201)
    const body = await expectContract(res, contracts['admin/tournaments'].POST.response)
    expect(leakedJsonText(body)).toEqual([])
    expect(body.tournament.sections.map((s) => [s.name, s.entryFee, s.fees.regular])).toEqual([['Open', 20, 20], ['K-5', 20, 20]])
  })

  it('the checker itself sees a JSON string where a list belongs', () => {
    expect(leakedJsonText({ tournament: { sections: '[]', round_schedule: [] } })).toEqual(['$.tournament.sections'])
    expect(leakedJsonText({ tournaments: [{ round_schedule: '[]', sections: [] }] })).toEqual(['$.tournaments[0].round_schedule'])
    expect(leakedJsonText({ tournaments: [{ round_schedule: [], sections: [{ name: 'Open' }] }] })).toEqual([])
  })
})

// ── The same fields for the pages ─────────────────────────────────────

describe('the pages read what they read before', () => {
  it('every column of the tournaments row passes through unchanged, except the two JSON columns', async () => {
    const setup = await seedTiered()
    const { tournamentId } = setup
    await env.DB.prepare(
      `UPDATE tournaments SET venue = 'Hall A', end_date = '2026-09-13', time_control = 'G/60;d5', max_players = 40, is_rated = 1,
         round_schedule = ?, custom_details = ? WHERE id = ?`,
    ).bind(
      JSON.stringify([{ round: 1, date: '2026-09-12', time: '10:00' }]),
      JSON.stringify([{ title: 'Parking', body: 'Free.' }]),
      tournamentId,
    ).run()
    const { results: info } = await env.DB.prepare('PRAGMA table_info(tournaments)').all<{ name: string }>()
    const columns = info.map((c) => c.name)
    expect(columns).toEqual(expect.arrayContaining(['sections', 'round_schedule', 'custom_details']))

    const { tournaments } = await readEverywhere(setup)
    const row = (await tournamentRow(tournamentId))!
    for (const [endpoint, tournament] of Object.entries(tournaments)) {
      for (const column of columns.filter((c) => c !== 'sections' && c !== 'round_schedule')) {
        // The detail and manage pages answer custom_details as a list; the rest leave it as stored.
        if (column === 'custom_details' && (endpoint === 'detail' || endpoint === 'manage')) {
          expect(tournament[column], `${endpoint}.${column}`).toEqual([{ title: 'Parking', body: 'Free.' }])
          continue
        }
        expect(tournament[column], `${endpoint}.${column}`).toEqual(row[column])
      }
    }
    // The list and the setup wizard parse custom_details themselves.
    expect(tournaments['list'].custom_details).toBe(row.custom_details)
    expect(typeof tournaments['staff list'].custom_details).toBe('string')
    // The list also joins the club's name and colour.
    expect(tournaments['list']).toMatchObject({ club_name: 'Kenner Chess Club' })
    expect(Object.keys(tournaments['list'])).toContain('club_color')
  })

  it('every section has an id, a cap and its three prices, and entryFee is the regular price, in every endpoint', async () => {
    const setup = await seedTiered()
    const { sections } = await readEverywhere(setup)
    const live = await liveRowsOf(setup.tournamentId)
    for (const [endpoint, list] of Object.entries(sections)) {
      expect(list, endpoint).toHaveLength(2)
      list.forEach((s, i) => {
        expect(s.id, endpoint).toBe(live[i].id)
        expect(s.entryFee, endpoint).toBe(s.fees.regular)
        expect(Object.keys(s.fees).sort(), endpoint).toEqual(['early', 'late', 'regular'])
        expect(s.cap === null || typeof s.cap === 'number', endpoint).toBe(true)
      })
      expect(list.map((s) => s.fees), endpoint).toEqual([
        { regular: 30, early: 25, late: 40 },
        { regular: 10, early: 5, late: 20 },
      ])
    }
  })

  it('a section\'s own prices, and a free section, price the same everywhere', async () => {
    const setup = await seedTiered()
    const { tournamentId } = setup
    await env.DB.prepare(`UPDATE tournament_sections SET fee_regular = 18, fee_early = 12, fee_late = 30 WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
    await env.DB.prepare(`UPDATE tournament_sections SET fee_regular = 0 WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    const { sections } = await readEverywhere(setup, { edit: false })
    for (const [endpoint, list] of Object.entries(sections)) {
      expect(list.map((s) => [s.name, s.entryFee, s.fees]), endpoint).toEqual([
        ['Open', 18, { regular: 18, early: 12, late: 30 }],
        // Free stays free: no early discount or late fee on nothing.
        ['U1200', 0, { regular: 0, early: null, late: null }],
      ])
    }
  })

  it('a section keeps the fields its JSON element had, and leaves out the ones it left out', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const tournamentId = await seedTournament({
      clubId,
      entryFee: 30,
      sections: [
        { name: 'Open', entryFee: 30, prizeFund: '$100 guaranteed', ratingMax: 1999, unratedOk: false, rulesSet: true, prizes: { place: [{ amount: 100, label: '1st' }] } },
        { name: 'Quads', entryFee: 0 },
        'Reserve' as unknown as { name: string; entryFee: number },
      ],
    })
    const { sections } = await readEverywhere({ admin, clubId, tournamentId })
    for (const [endpoint, list] of Object.entries(sections)) {
      const [open, quads, reserve] = list
      // A false is a value, not a missing one.
      expect(open, endpoint).toMatchObject({ prizeFund: '$100 guaranteed', ratingMax: 1999, unratedOk: false, rulesSet: true, prizes: { place: [{ amount: 100, label: '1st' }] } })
      for (const absent of ['prizeFund', 'unratedOk', 'prizes']) {
        expect(quads, `${endpoint} Quads`).not.toHaveProperty(absent)
        expect(reserve, `${endpoint} Reserve`).not.toHaveProperty(absent)
      }
      expect(quads, endpoint).toMatchObject({ name: 'Quads', entryFee: 0 })
      // A section stored as a bare name is the event's fee, as a section object.
      expect(reserve, endpoint).toMatchObject({ name: 'Reserve', entryFee: 30, fees: { regular: 30, early: null, late: null } })
      expect(reserve.rulesSet, endpoint).toBe(false)
    }
  })

  it('a section\'s extra keys in the JSON are kept in what the manage page loads', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await env.DB.prepare(`UPDATE tournaments SET sections = ? WHERE id = ?`)
      .bind(JSON.stringify([{ name: 'Open', entryFee: 25, note: 'Bring a clock', maxByes: 2 }]), tournamentId).run()
    expect((await liveRowsOf(tournamentId))[0].extra_json).toContain('Bring a clock')
    const { tournament } = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } })).json<{ tournament: { sections: Array<Record<string, unknown>> } }>()
    expect(tournament.sections[0]).toMatchObject({ name: 'Open', entryFee: 25, note: 'Bring a clock', maxByes: 2 })

    // The manage page saves its sections as it loaded them, with a new fee: the keys stay in the row and the JSON.
    const saved = await invoke(tournamentPatch, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { sections: [{ ...tournament.sections[0], entryFee: 30 }] },
    })
    expect(saved.status).toBe(200)
    const [row] = await liveRowsOf(tournamentId)
    expect(JSON.parse(row.extra_json!)).toEqual({ note: 'Bring a clock', maxByes: 2 })
    const mirror = await env.DB.prepare('SELECT sections FROM tournaments WHERE id = ?').bind(tournamentId).first<{ sections: string }>()
    expect(JSON.parse(mirror!.sections)).toEqual([{ name: 'Open', entryFee: 30, note: 'Bring a clock', maxByes: 2, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: false }])
    const { tournament: after } = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } })).json<{ tournament: { sections: Array<Record<string, unknown>> } }>()
    expect(after.sections[0]).toMatchObject({ entryFee: 30, note: 'Bring a clock', maxByes: 2 })
  })
})

// ── The archive rule ──────────────────────────────────────────────────

describe('an archived section (decision 7)', () => {
  const sectionsFor = async (setup: Setup & { other: string }) => (await readEverywhere(setup)).sections

  it('is hidden where entry is offered, and comes back under the same id when its name returns', async () => {
    const setup = await seedTiered()
    const { admin, tournamentId } = setup
    const [open, small] = await liveRowsOf(tournamentId)

    // The director takes the empty section out.
    const removed = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ id: open.id, name: 'Open', entryFee: 30 }] } })
    expect(removed.status).toBe(200)
    expect((await rowsOf(tournamentId)).find((r) => r.id === small.id)?.archived_at).not.toBeNull()
    for (const [endpoint, list] of Object.entries(await sectionsFor(setup))) expect(names(list), endpoint).toEqual(['Open'])

    // The name returns, with no id: the archived row is revived, not copied.
    const back = await invoke(tournamentPatch, {
      method: 'PATCH', as: admin, params: { id: tournamentId },
      body: { sections: [{ id: open.id, name: 'Open', entryFee: 30 }, { name: 'U1200', entryFee: 10, ratingMax: 1199 }] },
    })
    expect(back.status).toBe(200)
    expect(await rowsOf(tournamentId)).toHaveLength(2)
    for (const [endpoint, list] of Object.entries(await sectionsFor(setup))) {
      expect(list.map((s) => [s.id, s.name]), endpoint).toEqual([[open.id, 'Open'], [small.id, 'U1200']])
    }
  })

  it('never hides entries: a section with a player is refused, and every reader still lists it', async () => {
    const setup = await seedTiered()
    const { admin, tournamentId } = setup
    const [open] = await liveRowsOf(tournamentId)
    await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'U1200' })
    const refused = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ id: open.id, name: 'Open', entryFee: 30 }] } })
    expect(refused.status).toBe(400)
    expect((await refused.json<{ error: string }>()).error).toBe('1 entry is in the U1200 section. Move it to another section first.')
    expect((await rowsOf(tournamentId)).every((r) => r.archived_at === null)).toBe(true)
    for (const [endpoint, list] of Object.entries(await sectionsFor(setup))) expect(names(list), endpoint).toEqual(['Open', 'U1200'])
  })

  it('a withdrawn player does not keep a section from being archived', async () => {
    const setup = await seedTiered()
    const { admin, tournamentId } = setup
    const [open] = await liveRowsOf(tournamentId)
    const reg = await seedRegistration({ tournamentId, memberId: await seedMember(), section: 'U1200' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(reg).run()
    const removed = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [{ id: open.id, name: 'Open', entryFee: 30 }] } })
    expect(removed.status).toBe(200)
    for (const [endpoint, list] of Object.entries(await sectionsFor(setup))) expect(names(list), endpoint).toEqual(['Open'])
  })
})

// ── Bounded queries ───────────────────────────────────────────────────

describe('lists read the sections of all their events in batches that fit D1', () => {
  it('the club page: 90 events take one section query, 91 take two, and every event has its own sections', async () => {
    const clubId = await seedClub()
    const ninety = await seedClubEvents(clubId, 90, 'club-a')
    let sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(clubGet, { params: { id: clubId } }), contracts['clubs/[id]'].GET.response)
      expect(body.tournaments).toHaveLength(90)
      for (const [i, id] of [0, 45, 89].map((n) => [n, ninety[n]] as const)) {
        expect(body.tournaments.find((t) => t.id === id)?.sections.map((s) => s.name)).toEqual(['Open', `S${i}`])
      }
    })
    expectBounded(sql, 90)
    expect(sectionQueries(sql)).toHaveLength(1)

    await seedClubEvents(clubId, 1, 'club-b')
    sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(clubGet, { params: { id: clubId } }), contracts['clubs/[id]'].GET.response)
      expect(body.tournaments).toHaveLength(91)
      expect(body.tournaments.every((t) => t.sections.length === 2)).toBe(true)
    })
    expectBounded(sql, 91)
    expect(sectionQueries(sql)).toHaveLength(2)
  })

  it('the staff list, which also holds drafts, is batched the same way', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    await seedClubEvents(clubId, 100, 'staff')
    await env.DB.prepare(`UPDATE tournaments SET is_visible = 0 WHERE id LIKE 'staff-0%'`).run()
    let count = 0
    const sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(tournamentsGet, { as: admin, path: '/api/tournaments' }), contracts['tournaments'].GET.response)
      count = body.tournaments.length
      expect(body.tournaments.filter((t) => t.id.startsWith('staff-0')).every((t) => t.sections.length === 2)).toBe(true)
    })
    expect(count).toBeGreaterThanOrEqual(100)
    expectBounded(sql, count)
  })

  it('the clearinghouse asks only for the events it keeps: completed ones and another state need none', async () => {
    const clubId = await seedClub()
    await seedClubEvents(clubId, 100, 'feed')
    await env.DB.prepare(`UPDATE tournaments SET status = 'completed' WHERE id LIKE 'feed-0%'`).run()

    let kept = 0
    let sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(clearinghouseGet, { path: '/api/clearinghouse' }), contracts['clearinghouse'].GET.response)
      const lca = body.tournaments.filter((t) => t.source === 'lca')
      kept = lca.length
      expect(lca.map((t) => t.id)).not.toContain('feed-000')
      expect(lca.filter((t) => t.id.startsWith('feed-')).every((t) => t.sections.length === 2)).toBe(true)
    })
    expect(kept).toBeGreaterThanOrEqual(1)
    expectBounded(sql, kept)

    sql = await preparedDuring(async () => {
      const body = await expectContract(await invoke(clearinghouseGet, { path: '/api/clearinghouse?state=AL&upcoming=false' }), contracts['clearinghouse'].GET.response)
      expect(body.tournaments.filter((t) => t.source === 'lca')).toEqual([])
    })
    expect(sectionQueries(sql)).toEqual([])
  })

  it('one event\'s page asks for its sections once, however many it has', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: Array.from({ length: 12 }, (_, i) => ({ name: `Section ${i + 1}`, entryFee: 10 })) })
    const reads: Array<[string, () => Promise<unknown>]> = [
      ['detail', () => invoke(tournamentGet, { params: { id: tournamentId } })],
      ['manage', () => invoke(manageGet, { as: admin, params: { id: tournamentId } })],
      ['registration settings', () => invoke(registrationSettingsPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: {} })],
    ]
    for (const [endpoint, run] of reads) {
      const sql = await preparedDuring(run)
      expect(sectionQueries(sql), endpoint).toHaveLength(1)
    }
  })
})

// ── The registration settings save ────────────────────────────────────

describe('PATCH /api/admin/tournaments/[id]/registration, replayed and partial', () => {
  const patch = (as: string, tournamentId: string, body: unknown) =>
    invoke(registrationSettingsPatch, { method: 'PATCH', as, params: { id: tournamentId }, body })

  it('the same save twice gives the same answer and the same rows, and the sections are not touched', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ registrationStatus: 'draft' })
    const sectionsBefore = await rowsOf(tournamentId)
    const mirrorBefore = (await tournamentRow(tournamentId))!.sections
    const body = { registration_status: 'closed', reminder_1_days_before: 3, reminder_2_enabled: false }

    const first = await patch(admin, tournamentId, body)
    const second = await patch(admin, tournamentId, body)
    expect(first.status).toBe(200)
    expect(await second.json()).toEqual(await first.json())
    expect(await rowsOf(tournamentId)).toEqual(sectionsBefore)
    expect((await tournamentRow(tournamentId))!.sections).toBe(mirrorBefore)
  })

  it('a key left out keeps its column, and a null opening time clears it', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await patch(admin, tournamentId, { registration_status: 'closed', reminder_1_days_before: 3, registration_opens_at: '2026-09-01T09:00' })
    const partial = await expectContract(await patch(admin, tournamentId, { reminder_2_enabled: false }), contracts['admin/tournaments/[id]/registration'].PATCH.response)
    expect(partial.tournament).toMatchObject({ registration_status: 'closed', reminder_1_days_before: 3, registration_opens_at: '2026-09-01T09:00', reminder_2_enabled: 0 })
    const cleared = await expectContract(await patch(admin, tournamentId, { registration_opens_at: null }), contracts['admin/tournaments/[id]/registration'].PATCH.response)
    expect(cleared.tournament).toMatchObject({ registration_status: 'closed', registration_opens_at: null, reminder_1_days_before: 3 })
  })

  it('an event that is not there is 404 with no data', async () => {
    const admin = await seedAdmin()
    const res = await patch(admin, 'no-such-event', { registration_status: 'open' })
    expect(res.status).toBe(404)
    expect(await res.response.text()).not.toContain('sections')
  })

  it('answers with archived sections left out', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'U1200'`).bind(tournamentId).run()
    const { tournament } = await expectContract(await patch(admin, tournamentId, {}), contracts['admin/tournaments/[id]/registration'].PATCH.response)
    expect(tournament.sections.map((s) => s.name)).toEqual(['Open'])
  })
})

// ── The manage page's round trip ──────────────────────────────────────

describe('the manage page saves what it loaded', () => {
  async function loaded() {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      sections: [{ name: 'Open', entryFee: 30 }, { name: 'U1200', entryFee: 10, ratingMax: 1199 }, { name: 'K-5', entryFee: 5 }],
    })
    await addTiers(tournamentId)
    const manage = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } })).json<{ tournament: { sections: Array<Record<string, unknown>> } }>()
    return { admin, tournamentId, sections: manage.tournament.sections }
  }
  const save = (admin: string, tournamentId: string, sections: unknown) =>
    invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections } })

  it('saved twice, it gives the same rows, the same mirror and the same answer', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const first = await save(admin, tournamentId, sections)
    const rowsAfterFirst = await rowsOf(tournamentId)
    const mirrorAfterFirst = (await tournamentRow(tournamentId))!.sections
    const second = await save(admin, tournamentId, sections)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(await rowsOf(tournamentId)).toEqual(rowsAfterFirst)
    expect((await tournamentRow(tournamentId))!.sections).toBe(mirrorAfterFirst)
    const a = (await first.json<{ tournament: { sections: unknown } }>()).tournament.sections
    const b = (await second.json<{ tournament: { sections: unknown } }>()).tournament.sections
    expect(b).toEqual(a)
    expect(b).toEqual(sections)
  })

  it('reordered, the same rows keep their ids and every reader follows the new order', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const before = await liveRowsOf(tournamentId)
    const reversed = [...sections].reverse()
    expect((await save(admin, tournamentId, reversed)).status).toBe(200)
    const after = await liveRowsOf(tournamentId)
    expect(after.map((r) => [r.id, r.position])).toEqual([...before].reverse().map((r, i) => [r.id, i]))
    expect(await mirrorNames(tournamentId)).toEqual(['K-5', 'U1200', 'Open'])
    const detail = await (await invoke(tournamentGet, { params: { id: tournamentId } })).json<{ tournament: { sections: Section[] } }>()
    expect(names(detail.tournament.sections)).toEqual(['K-5', 'U1200', 'Open'])
    const list = await (await invoke(tournamentsGet, { path: '/api/tournaments' })).json<{ tournaments: Array<{ id: string; sections: Section[] }> }>()
    expect(names(list.tournaments.find((t) => t.id === tournamentId)!.sections)).toEqual(['K-5', 'U1200', 'Open'])
  })

  it('a section from another event is refused whole, in words, and writes nothing', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const stranger = (await liveRowsOf(await seedTournament()))[0]
    const before = await rowsOf(tournamentId)
    const mirror = (await tournamentRow(tournamentId))!.sections
    const res = await save(admin, tournamentId, [{ ...sections[0], id: stranger.id }, sections[1], sections[2]])
    expect(res.status).toBe(400)
    expect((await res.json<{ error: string }>()).error).toBe('One of these sections is not part of this event. Reload the page and try again.')
    expect(await rowsOf(tournamentId)).toEqual(before)
    expect((await tournamentRow(tournamentId))!.sections).toBe(mirror)
  })

  it('an edit made on the loaded sections moves only that row', async () => {
    const { admin, tournamentId, sections } = await loaded()
    const before = await liveRowsOf(tournamentId)
    const edited = sections.map((s) => (s.name === 'U1200' ? { ...s, prizeFund: '$50', cap: 16 } : s))
    expect((await save(admin, tournamentId, edited)).status).toBe(200)
    const after = await liveRowsOf(tournamentId)
    expect(after.map((r) => [r.id, r.cap])).toEqual([[before[0].id, null], [before[1].id, 16], [before[2].id, null]])
    const detail = await (await invoke(tournamentGet, { params: { id: tournamentId } })).json<{ tournament: { sections: Section[] } }>()
    expect(detail.tournament.sections[1]).toMatchObject({ name: 'U1200', prizeFund: '$50', cap: 16, fees: { regular: 10, early: 5, late: 20 } })
    expect(detail.tournament.sections[0].fees).toEqual({ regular: 30, early: 25, late: 40 })
  })
})

// ── The rating report ─────────────────────────────────────────────────

describe('GET /api/admin/tournaments/[id]/rating-report, from the section rows', () => {
  const contract = contracts['admin/tournaments/[id]/rating-report'].GET

  /** Four players in two games, a tie on rating between two more, and one game in a second section. */
  async function playedEvent(date: string) {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({
      date, isRated: true, rounds: 1, status: 'completed',
      sections: [{ name: 'Open', entryFee: 20 }, { name: 'U1200', entryFee: 10, ratingMax: 1199 }],
    })
    const make = (fullName: string, uscfId: string, rating: number, expiration: string | null = null) =>
      seedMember({ fullName, uscfId, uscfRating: rating }).then(async (id) => {
        if (expiration) await env.DB.prepare('UPDATE members SET uscf_expiration = ? WHERE id = ?').bind(expiration, id).run()
        return id
      })
    const players = {
      ann: await make('Ann Rook', '10000001', 1800, '2026-11-01'),
      ben: await make('Ben Knight', '10000002', 1700, '2026-11-02'),
      cy: await make('Cy Bishop', '10000003', 1600, '2026-03-07T23:30:00'),
      dee: await make('Dee Pawn', '10000004', 1500),
      zed: await make('Zed Tie', '10000005', 1400),
      amy: await make('Amy Tie', '10000006', 1400),
      gus: await make('Gus Small', '10000007', 900),
      hal: await make('Hal Small', '10000008', 800),
    }
    for (const [key, id] of Object.entries(players)) {
      await seedRegistration({ tournamentId, memberId: id, section: key === 'gus' || key === 'hal' ? 'U1200' : 'Open' })
    }
    const game = (id: string, board: number, section: string, white: string, black: string, result: string) =>
      env.DB.prepare(
        `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result) VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
      ).bind(`${id}-${tournamentId}`, tournamentId, board, section, white, black, result).run()
    await game('g1', 1, 'Open', players.ann, players.ben, '1/2-1/2')
    await game('g2', 2, 'Open', players.cy, players.dee, '1/2-1/2')
    await game('g3', 3, 'Open', players.zed, players.amy, '1-0')
    await game('g4', 1, 'U1200', players.gus, players.hal, '0-1')
    return { admin, tournamentId, players }
  }

  const report = async (admin: string, tournamentId: string) => {
    const res = await invoke(ratingReportGet, { as: admin, params: { id: tournamentId } })
    expect(res.status).toBe(200)
    return expectContract(res, contract.response)
  }

  it('numbers players by rating, then name when they tie, and scores a draw as one half each', async () => {
    const { admin, tournamentId } = await playedEvent('2026-11-02')
    const body = await report(admin, tournamentId)
    const open = body.sections.find((s) => s.name === 'Open')!
    expect(open.players.map((p) => [p.pairingNum, p.name, p.score])).toEqual([
      [1, 'Ann Rook', 0.5], [2, 'Ben Knight', 0.5], [3, 'Cy Bishop', 0.5], [4, 'Dee Pawn', 0.5],
      // Same rating: Amy sorts before Zed, so Amy is 5. Zed won as White.
      [5, 'Amy Tie', 0], [6, 'Zed Tie', 1],
    ])
    expect(open.players[0].rounds).toEqual([{ round: 1, code: 'D', opponentPairingNum: 2, color: 'W' }])
    expect(open.players[4].rounds).toEqual([{ round: 1, code: 'L', opponentPairingNum: 6, color: 'B' }])
  })

  it('lists live sections in the order the director set, and follows a reorder', async () => {
    const { admin, tournamentId } = await playedEvent('2026-11-02')
    expect((await report(admin, tournamentId)).sections.map((s) => s.name)).toEqual(['Open', 'U1200'])
    const manage = await (await invoke(manageGet, { as: admin, params: { id: tournamentId } })).json<{ tournament: { sections: unknown[] } }>()
    const reorder = await invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections: [...manage.tournament.sections].reverse() } })
    expect(reorder.status).toBe(200)
    expect((await report(admin, tournamentId)).sections.map((s) => s.name)).toEqual(['U1200', 'Open'])
  })

  it('lists a section once when a live row takes the name an archived row still holds', async () => {
    const { admin, tournamentId } = await playedEvent('2026-11-02')
    const load = async () => (await (await invoke(manageGet, { as: admin, params: { id: tournamentId } }))
      .json<{ tournament: { sections: Array<Record<string, unknown>> } }>()).tournament.sections
    const patch = (sections: unknown[]) => invoke(tournamentPatch, { method: 'PATCH', as: admin, params: { id: tournamentId }, body: { sections } })
    const [open, small] = await load()
    // Reserve is added, then taken out while still empty, so its row is archived.
    expect((await patch([open, small, { name: 'Reserve', entryFee: 10 }])).status).toBe(200)
    expect((await patch([open, small])).status).toBe(200)
    // U1200 keeps its id and takes the name the archived row still holds.
    expect((await patch([open, { ...small, name: 'Reserve' }])).status).toBe(200)
    const held = await rowsOf(tournamentId)
    expect(held.filter((r) => r.name === 'Reserve').map((r) => r.archived_at === null).sort()).toEqual([false, true])

    const body = await report(admin, tournamentId)
    expect(body.sections.map((s) => s.name)).toEqual(['Open', 'Reserve'])
    expect(body.sections[1].players.map((p) => p.name)).toEqual(['Gus Small', 'Hal Small'])
    expect(new Set(body.validationErrors).size).toBe(body.validationErrors.length)
  })

  it('writes an expired membership with the weekday, around the clock changes in America/Chicago', async () => {
    // Event on Monday, November 2, 2026, the day after the clocks went back.
    const { admin, tournamentId } = await playedEvent('2026-11-02')
    const body = await report(admin, tournamentId)
    // Ben's membership runs to the event day: not expired. Cy's ended the day before the clocks went forward.
    expect(body.validationErrors).toEqual([
      'Ann Rook (Open): US Chess membership expired Sun, Nov 1, 2026. It must be renewed before US Chess will rate the event.',
      'Cy Bishop (Open): US Chess membership expired Sat, Mar 7, 2026. It must be renewed before US Chess will rate the event.',
    ])
    for (const message of body.validationErrors) {
      expect(message).not.toContain('USCF')
    }
  })

  it('a membership that ends on the first day of a multi-day event is not expired', async () => {
    const { admin, tournamentId, players } = await playedEvent('2026-03-08')
    await env.DB.prepare(`UPDATE members SET uscf_expiration = '2026-03-08' WHERE id IN (?, ?)`).bind(players.ann, players.cy).run()
    await env.DB.prepare(`UPDATE members SET uscf_expiration = '2026-03-07' WHERE id = ?`).bind(players.ben).run()
    await env.DB.prepare(`UPDATE tournaments SET end_date = '2026-03-09' WHERE id = ?`).bind(tournamentId).run()
    const body = await report(admin, tournamentId)
    expect(body.validationErrors).toEqual([
      'Ben Knight (Open): US Chess membership expired Sat, Mar 7, 2026. It must be renewed before US Chess will rate the event.',
    ])
    expect(body.tournament).toMatchObject({ startDate: '2026-03-08', endDate: '2026-03-09' })
  })

  it('an event with no end date reports its start date as the end', async () => {
    const { admin, tournamentId } = await playedEvent('2026-11-02')
    expect((await tournamentRow(tournamentId))!.end_date).toBeNull()
    const body = await report(admin, tournamentId)
    expect(body.tournament).toMatchObject({ startDate: '2026-11-02', endDate: '2026-11-02' })
  })

  it('an event nobody played gives an empty report, not an error', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ isRated: true })
    const body = await report(admin, tournamentId)
    expect(body.sections).toEqual([])
    expect(body.validationErrors).toEqual([])
  })

  it('an unknown event is 404', async () => {
    const res = await invoke(ratingReportGet, { as: await seedAdmin(), params: { id: 'no-such-event' } })
    expect(res.status).toBe(404)
  })
})
