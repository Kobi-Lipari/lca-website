// test/integration/region-events-answers.test.ts
//
// What the server tells the pages about a regional representative's club
// events (WS09 step 19), through the real handlers on a D1 database built
// from every migration: GET /api/admin/clubs/[id]'s `eventRights` and its
// rows' wait columns, and GET /api/admin/tournaments/[id]/manage's
// `approval`. REGION_EVENTS_ON and CREATION_ROLES_ON are false in the tree;
// here each is read through a getter on its mocked module, set for the cases
// of the step and unset for the cases that hold what ships. No case sends
// mail. Every club, region, person and event here is made up ("Example
// Knights Club", "Player One", example.org).
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet as clubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as directorsGet } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { adminClubResponseSchema } from '../../domain/contracts/clubs'
import { tournamentManageResponseSchema } from '../../domain/contracts/events'
import { ADMIN_CLUB_COLUMNS } from '../../functions/utils/clubs/adminAnswer'
import { officersWithoutEmail } from '../../functions/utils/clubs/memberView'
import { readKeeperColumns, readPlaces } from '../../functions/utils/clubs/save'
import { invoke, resetHarness, type Aal } from './harness'
import { countingDb } from './mailRuns'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'

const flags = vi.hoisted(() => ({ keepersOn: true, regionOn: true, rolesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
  flags.regionOn = true
  flags.rolesOn = false
})
afterEach(() => {
  flags.keepersOn = false
  flags.regionOn = false
  flags.rolesOn = false
})

let seq = 0
const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

/** A regional seat over the region, held now by the member. */
async function seat(memberId: string, region: string): Promise<void> {
  const id = `seat-${++seq}-${crypto.randomUUID().slice(0, 6)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** A made-up club in its own region, its own rep, the region's representative, another region's, an observer, a plain member and an LCA admin. */
async function example() {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Knights Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const representative = await seedMember({ fullName: 'Player One' })
  await seat(representative, region)
  const otherRegion = await seedMember({ fullName: 'Player Two' })
  await seat(otherRegion, newRegion())
  return {
    clubId,
    representative,
    otherRegion,
    ownRep: await seedMember({ role: 'club_rep', clubId, fullName: 'Player Three' }),
    observer: await seedMember({ role: 'lca_observer', fullName: 'Player Four' }),
    member: await seedMember({ fullName: 'Player Five' }),
    admin: await seedAdmin(),
  }
}

/** An event of the club in a state of the wait, drafted by the member. */
async function event(clubId: string, createdBy: string | null, state: 'none' | 'draft' | 'review' | 'approved', visible = state === 'approved' || state === 'none'): Promise<string> {
  const id = await seedTournament({ clubId, createdBy, isVisible: visible, name: `Example Club Quads ${++seq}` })
  if (state === 'none') return id
  const [requested, approved] = state === 'draft' ? [null, null] : state === 'review' ? ['2026-11-14 18:00:00', null] : ['2026-11-14 18:00:00', '2026-11-16 15:00:00']
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ?, approved_at = ? WHERE id = ?').bind(requested, approved, id).run()
  return id
}

const aalOf = (who: string, admin: string): Aal => (who === admin ? 'aal2' : 'aal1')

// The club GET's own statements as the base (57fd960) words them, copied
// from that file, so the unset run is held to the base and not to itself.
const BASE_OFFICERS_SQL = 'SELECT co.id, co.member_id, co.role, m.full_name, m.email\n     FROM club_officers co\n     JOIN members m ON co.member_id = m.id\n     WHERE co.club_id = ? ORDER BY co.created_at'
const BASE_VISIBLE_EVENTS_SQL = 'SELECT id, name, date, end_date, status, is_visible, registration_status\n     FROM tournaments WHERE club_id = ? AND is_visible = 1 ORDER BY date DESC'
const BASE_ALL_EVENTS_SQL = 'SELECT id, name, date, end_date, status, is_visible, registration_status\n     FROM tournaments WHERE club_id = ? ORDER BY date DESC'

async function club(as: string, clubId: string, aal: Aal = 'aal1', db?: D1Database) {
  return invoke(clubGet, { as, aal, params: { id: clubId }, ...(db ? { env: { DB: db } } : {}) })
}

describe('GET /api/admin/clubs/[id] with REGION_EVENTS_ON set: what each person may do with the club\'s events', () => {
  it('answers eventRights from the create\'s own rules for each person the GET admits, under its strict contract', async () => {
    const p = await example()
    const expected: Array<[string, Record<string, unknown>]> = [
      [p.admin, { add: 'yes', manage: true, decide: true, askPayout: false }],
      [p.ownRep, { add: 'yes', manage: true, decide: false, askPayout: false }],
      [p.representative, { add: 'for_approval', manage: true, decide: false, askPayout: false }],
      [p.observer, { add: 'no', manage: false, decide: false, askPayout: false }],
    ]
    for (const [who, rights] of expected) {
      const res = await club(who, p.clubId, aalOf(who, p.admin))
      expect(res.status, who).toBe(200)
      const body = await res.json()
      expect(adminClubResponseSchema.safeParse(body).success, who).toBe(true)
      expect(body.eventRights, who).toEqual(rights)
    }
  })

  it('says a payout request can go through only while CREATION_ROLES_ON is set', async () => {
    const p = await example()
    flags.rolesOn = true
    expect((await (await club(p.representative, p.clubId)).json()).eventRights).toEqual({ add: 'for_approval', manage: true, decide: false, askPayout: true })
  })

  it('gives the region\'s representative the club\'s events as it gives them to its own rep, hidden drafts among them, each with the wait\'s columns', async () => {
    const p = await example()
    const listed = await event(p.clubId, null, 'none')
    const draft = await event(p.clubId, p.representative, 'draft')
    const review = await event(p.clubId, p.representative, 'review')
    const approved = await event(p.clubId, p.representative, 'approved')
    await env.DB.prepare('UPDATE tournaments SET approved_at = \' \' WHERE id = ?').bind(draft).run()
    const forRep = (await (await club(p.representative, p.clubId)).json()).tournaments as Array<Record<string, unknown>>
    const forOwnRep = (await (await club(p.ownRep, p.clubId)).json()).tournaments as Array<Record<string, unknown>>
    expect(forRep).toEqual(forOwnRep)
    const byId = new Map(forRep.map((t) => [t.id, t]))
    expect(byId.get(listed)).toMatchObject({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null })
    expect(byId.get(draft)).toMatchObject({ is_visible: 0, needs_lca_approval: 1, approval_requested_at: null, approved_at: null })
    expect(byId.get(review)).toMatchObject({ is_visible: 0, needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: null })
    expect(byId.get(approved)).toMatchObject({ is_visible: 1, approved_at: '2026-11-16 15:00:00' })
    // The roster rule stands: the representative is still given no roster and no officer's email.
    const body = await (await club(p.representative, p.clubId)).json()
    expect(body.roster).toEqual([])
    expect(body.rosterKeptBack).toBe(true)
  })

  it('role safety: refuses another region\'s representative and a plain member exactly as before, and gives no one rights the create would refuse', async () => {
    const p = await example()
    await event(p.clubId, p.representative, 'draft')
    for (const who of [p.otherRegion, p.member]) {
      const res = await club(who, p.clubId)
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    // What the answer says of the add is what the create does: the observer's create is refused, the representative's is marked.
    const refused = await invoke(createTournament, { method: 'POST', as: p.observer, body: { name: 'Example Refused Quads', location: 'Example City', date: '2027-02-06', entryFee: 0, clubId: p.clubId } })
    expect(refused.status).toBe(403)
    const made = await invoke(createTournament, { method: 'POST', as: p.representative, body: { name: 'Example Region Quads', location: 'Example City', date: '2027-02-06', entryFee: 0, clubId: p.clubId } })
    expect(made.status).toBe(201)
    expect((await made.json<{ tournament: { needs_lca_approval: number } }>()).tournament.needs_lca_approval).toBe(1)
  })

  it('with the constant unset the answer is checkpoint S\'s, byte for byte, with no query more', async () => {
    const p = await example()
    await event(p.clubId, null, 'none')
    await event(p.clubId, p.representative, 'draft')
    flags.regionOn = false
    const off = countingDb()
    const res = await club(p.representative, p.clubId, 'aal1', off.db)
    expect(res.status).toBe(200)
    const text = await res.response.clone().text()
    const body = JSON.parse(text)
    expect(Object.keys(body)).toEqual(['club', 'officers', 'roster', 'rosterKeptBack', 'tournaments', 'places'])
    expect(body.tournaments).toHaveLength(1)
    expect(Object.keys(body.tournaments[0])).toEqual(['id', 'name', 'date', 'end_date', 'status', 'is_visible', 'registration_status'])
    // The statements are the base's, one for one: the club found by its id,
    // the person and their seat as requireClubView asks, then the handler's
    // own five reads in the base's words, the tournaments' read with the
    // visible events only.
    expect(off.ran.map((r) => r.sql)).toEqual([
      'SELECT id FROM clubs WHERE id = ?',
      'SELECT * FROM members WHERE id = ?',
      'SELECT * FROM members WHERE id = ?',
      expect.stringContaining('FROM board_seat_assignments a'),
      `SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?`,
      BASE_OFFICERS_SQL,
      BASE_VISIBLE_EVENTS_SQL,
      expect.stringMatching(/^SELECT slug, about_text, .* FROM clubs WHERE id = \?$/),
      expect.stringMatching(/^SELECT id, name, street, note, latitude, longitude FROM club_places WHERE club_id = \?/),
    ])
    expect(off.ran.some((r) => r.sql.includes('needs_lca_approval'))).toBe(false)
    // And the body is the base's byte for byte, built here the base's way
    // from the same rows: the club with its keeper columns, its officers
    // without their emails, no roster, the visible events, its places.
    const clubRow = await env.DB.prepare(`SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?`).bind(p.clubId).first()
    const officerRows = (await env.DB.prepare(BASE_OFFICERS_SQL).bind(p.clubId).all<Record<string, unknown>>()).results
    const baseBody = {
      club: { ...clubRow, ...(await readKeeperColumns(env.DB, p.clubId)) },
      officers: officersWithoutEmail(officerRows),
      roster: [],
      rosterKeptBack: true,
      tournaments: (await env.DB.prepare(BASE_VISIBLE_EVENTS_SQL).bind(p.clubId).all()).results,
      places: await readPlaces(env.DB, p.clubId),
    }
    expect(text).toBe(JSON.stringify(baseBody))
    // With it set the same person costs the rights' reads more; unset, none of them is made.
    flags.regionOn = true
    const on = countingDb()
    await club(p.representative, p.clubId, 'aal1', on.db)
    expect(on.ran.length).toBeGreaterThan(off.ran.length)
    const kept = (ran: typeof off.ran) => ran.filter((r) => !r.sql.includes('FROM tournaments')).map((r) => r.sql)
    for (const sql of kept(off.ran)) expect(kept(on.ran), sql).toContain(sql)
    flags.regionOn = false
    // The same statements as before for an LCA admin too: the tournaments' one read, unfiltered.
    const admin = countingDb()
    const forAdmin = await (await club(p.admin, p.clubId, 'aal2', admin.db)).json()
    expect(forAdmin.eventRights).toBeUndefined()
    expect(forAdmin.tournaments).toHaveLength(2)
    expect(admin.ran.filter((r) => r.sql.includes('FROM tournaments')).map((r) => r.sql)).toEqual([BASE_ALL_EVENTS_SQL])
    expect(admin.ran.some((r) => r.sql.includes('needs_lca_approval') || r.sql.includes('board_seat_assignments'))).toBe(false)
    flags.regionOn = true
    const adminOn = countingDb()
    await club(p.admin, p.clubId, 'aal2', adminOn.db)
    expect(adminOn.ran.filter((r) => r.sql.includes('FROM tournaments'))).toHaveLength(admin.ran.filter((r) => r.sql.includes('FROM tournaments')).length)
  })
})

async function manage(as: string, id: string, aal: Aal = 'aal1', db?: D1Database) {
  return invoke(manageGet, { as, aal, params: { id }, ...(db ? { env: { DB: db } } : {}) })
}

describe('GET /api/admin/tournaments/[id]/manage with REGION_EVENTS_ON set: who may move the event through the wait', () => {
  it('gives Submit to the drafter in their region and to an LCA admin, Approve and Ask for changes to an LCA admin, and neither to the club\'s rep or a named director', async () => {
    const p = await example()
    const draft = await event(p.clubId, p.representative, 'draft')
    const director = await seedMember({ fullName: 'Player Six' })
    await seedTournamentDirector(draft, director)
    const expected: Array<[string, Record<string, boolean>]> = [
      [p.representative, { maySubmit: true, mayDecide: false }],
      [p.admin, { maySubmit: true, mayDecide: true }],
      [p.ownRep, { maySubmit: false, mayDecide: false }],
      [director, { maySubmit: false, mayDecide: false }],
      [p.observer, { maySubmit: false, mayDecide: false }],
    ]
    for (const [who, approval] of expected) {
      const res = await manage(who, draft, aalOf(who, p.admin))
      expect(res.status, who).toBe(200)
      const body = await res.json()
      expect(tournamentManageResponseSchema.safeParse(body).success, who).toBe(true)
      expect(body.approval, who).toEqual(approval)
    }
  })

  it('gives no move on an event not marked or one approved, and asks no seat for them', async () => {
    const p = await example()
    const runs: Record<string, string[]> = {}
    for (const state of ['none', 'approved', 'draft'] as const) {
      const id = await event(p.clubId, p.representative, state)
      const db = countingDb()
      const body = await (await manage(p.representative, id, 'aal1', db.db)).json()
      if (state !== 'draft') expect(body.approval, state).toEqual({ maySubmit: false, mayDecide: false })
      runs[state] = db.ran.map((r) => r.sql)
    }
    // The guard asks the person's seat once for every event; the rights ask
    // nothing after the directors' read for an event not marked or approved.
    const seatReads = (ran: string[]) => ran.filter((sql) => sql.includes('board_seat_assignments')).length
    for (const state of ['none', 'approved']) {
      expect(runs[state].at(-1), state).toContain('SELECT td.member_id')
      expect(seatReads(runs[state]), state).toBe(1)
    }
    expect(runs.approved).toEqual(runs.none)
    // A draft's Submit is the one that asks, after the same statements: its seat's clubs.
    expect(runs.draft.slice(0, runs.none.length)).toEqual(runs.none)
    const asked = runs.draft.slice(runs.none.length)
    expect(asked).toHaveLength(1)
    expect(asked[0]).toContain('board_seat_assignments')
  })

  it('role safety: lets the region\'s representative, and the guard\'s question, in only for an event of their region', async () => {
    const p = await example()
    const draft = await event(p.clubId, p.representative, 'draft')
    expect((await invoke(directorsGet, { as: p.representative, aal: 'aal1', params: { id: draft } })).status).toBe(200)
    for (const who of [p.otherRegion, p.member]) {
      expect((await manage(who, draft)).status, who).toBe(403)
      expect((await invoke(directorsGet, { as: who, aal: 'aal1', params: { id: draft } })).status, who).toBe(403)
    }
  })

  it('with the constant unset carries no approval key and makes no query more', async () => {
    const p = await example()
    const draft = await event(p.clubId, p.representative, 'draft')
    flags.regionOn = false
    const off = countingDb()
    const body = await (await manage(p.admin, draft, 'aal2', off.db)).json()
    expect(Object.keys(body)).toEqual(['tournament', 'roster', 'games', 'standings', 'prizes', 'directors'])
    flags.regionOn = true
    const on = countingDb()
    await manage(p.admin, draft, 'aal2', on.db)
    // An LCA admin's rights ask no seat, so the answer costs what it cost before.
    expect(on.ran.map((r) => r.sql)).toEqual(off.ran.map((r) => r.sql))
    expect((await (await manage(p.representative, draft)).json()).approval).toEqual({ maySubmit: true, mayDecide: false })
    flags.regionOn = false
    expect((await manage(p.representative, draft)).status).toBe(403)
  })
})
