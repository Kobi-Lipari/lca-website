// test/integration/public-tournament-columns.test.ts
//
// The four columns of migration 0070 (WS09 step 16), needs_lca_approval,
// approval_requested_at, approved_at and approved_by, through the real
// handlers on D1, in both worlds a merge can meet:
// - with the columns there, the two public tournament answers a visitor
//   reads, signed out or signed in without managing the event, are byte for
//   byte the copy taken from the base's code before this step, for a seeded
//   event not marked for approval; an event's managers, an LCA admin and the
//   club's rep, get the four keys in the list and in the detail, and the
//   manage page's answer carries them too, each answer under its contract;
// - on a database the migration has not reached (the four columns dropped
//   for the cases, and put back after), the two public answers are byte for
//   byte the same copy, and the member delete answers as before, with one
//   log line naming no member; the other way round, a create that passes
//   its checks fails there and writes nothing, while a setup save answers
//   as before, which is why the migration must land first;
// - an event marked for approval: a visitor gets none of the four keys in
//   the list or the detail, a plain member and another club's rep neither,
//   and its managers get them as stored;
// - the member delete sets approved_by to NULL on the events the member
//   approved and keeps their approved_at, leaves another approver's as they
//   were, answers as before with the column missing, stops on any other
//   failure, and lets only an LCA admin delete.
// Every club, person and event here is made up.
import { env } from 'cloudflare:test'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { MANAGER_ONLY_TOURNAMENT_KEYS } from '../../domain/contracts/events'
import { APPROVALS_UNCLEARED_LOG, onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { laggingDb } from './clubTables'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { expectContract, invoke, resetHarness } from './harness'
import { migrationModules, splitSql } from './setup'

beforeEach(resetHarness)
afterEach(() => {
  vi.restoreAllMocks()
})

const FOUR = ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by'] as const
const CLUB = 'example-chess-club'
const REP = 'player-one'
const EVENT = 'example-fall-open'

/**
 * The two answers a visitor got from the base's code, before this step, for
 * the event seedExample writes: taken once from GET /api/tournaments and GET
 * /api/tournaments/[id], signed out, and kept here as they were sent.
 */
const BASE_LIST = `{"tournaments":[{"id":"example-fall-open","name":"Example Fall Open","location":"Kenner, LA","venue":null,"date":"2026-10-24","end_date":null,"entry_fee":25,"sections":[{"id":"example-open","name":"Open","entryFee":25,"ratingMax":null,"ratingMin":null,"gradeMin":null,"gradeMax":null,"rulesSet":false,"cap":null,"fees":{"regular":25,"early":null,"late":null}},{"id":"example-u1200","name":"U1200","entryFee":0,"ratingMax":null,"ratingMin":null,"gradeMin":null,"gradeMax":null,"rulesSet":false,"cap":null,"fees":{"regular":0,"early":null,"late":null}}],"rounds":4,"max_players":null,"status":"upcoming","description":null,"registration_deadline":null,"club_id":"example-chess-club","created_at":"2026-11-01 18:00:00","registration_status":"open","registration_opens_at":null,"reminder_1_days_before":7,"reminder_1_enabled":1,"reminder_2_days_before":1,"reminder_2_enabled":1,"is_rated":0,"is_visible":1,"round_schedule":[],"registration_closes_at":null,"custom_details":null,"time_control":null,"registration_url":null,"eligibility":null,"organizer":null,"pairing_system":"uscf","early_deadline":null,"early_discount":0,"late_after":null,"late_fee":0,"member_discount":0,"accelerated":0,"is_state_championship":0,"requires_lca_membership":1,"club_color":"#c8a94a","club_name":"Example Chess Club","schedules":[{"id":"example-main","label":"Main schedule","timeControl":null,"isPrimary":true,"mergeRound":null,"rounds":[]}]}]}`
const BASE_DETAIL = `{"tournament":{"id":"example-fall-open","name":"Example Fall Open","location":"Kenner, LA","venue":null,"date":"2026-10-24","end_date":null,"entry_fee":25,"sections":[{"id":"example-open","name":"Open","entryFee":25,"ratingMax":null,"ratingMin":null,"gradeMin":null,"gradeMax":null,"rulesSet":false,"cap":null,"fees":{"regular":25,"early":null,"late":null}},{"id":"example-u1200","name":"U1200","entryFee":0,"ratingMax":null,"ratingMin":null,"gradeMin":null,"gradeMax":null,"rulesSet":false,"cap":null,"fees":{"regular":0,"early":null,"late":null}}],"rounds":4,"max_players":null,"status":"upcoming","description":null,"registration_deadline":null,"club_id":"example-chess-club","created_at":"2026-11-01 18:00:00","registration_status":"open","registration_opens_at":null,"reminder_1_days_before":7,"reminder_1_enabled":1,"reminder_2_days_before":1,"reminder_2_enabled":1,"is_rated":0,"is_visible":1,"round_schedule":[],"registration_closes_at":null,"custom_details":[],"time_control":null,"registration_url":null,"eligibility":null,"organizer":null,"pairing_system":"uscf","early_deadline":null,"early_discount":0,"late_after":null,"late_fee":0,"member_discount":0,"accelerated":0,"is_state_championship":0,"requires_lca_membership":1,"schedules":[{"id":"example-main","label":"Main schedule","timeControl":null,"isPrimary":true,"mergeRound":null,"rounds":[]}],"waitlist_count":0},"roster":[],"pairings":[],"standings":[],"prizes":[],"myRegistration":null}`

/** The club, its rep, who created the event, and the event, each with the fixed ids and times the stored copy holds. */
async function seedExample(): Promise<void> {
  await seedClub({ id: CLUB, name: 'Example Chess Club', city: 'Baton Rouge' })
  await seedMember({ id: REP, fullName: 'Player One', email: 'player.one@example.org', role: 'club_rep', clubId: CLUB })
  await seedTournament({ id: EVENT, name: 'Example Fall Open', date: '2026-10-24', clubId: CLUB, createdBy: REP, entryFee: 25 })
  await env.DB.batch([
    env.DB.prepare(`UPDATE tournaments SET created_at = '2026-11-01 18:00:00' WHERE id = ?`).bind(EVENT),
    env.DB.prepare(`UPDATE tournament_sections SET id = 'example-open' WHERE tournament_id = ? AND name = 'Open'`).bind(EVENT),
    env.DB.prepare(`UPDATE tournament_sections SET id = 'example-u1200' WHERE tournament_id = ? AND name = 'U1200'`).bind(EVENT),
    env.DB.prepare(`UPDATE tournament_schedules SET id = 'example-main' WHERE tournament_id = ?`).bind(EVENT),
  ])
}

const listText = async (as?: string) => (await invoke(tournamentsGet, { as })).response.text()
const detailText = async (id: string, as?: string) => (await invoke(tournamentGet, { as, params: { id } })).response.text()
const columnsOf = async () => (await env.DB.prepare('PRAGMA table_info(tournaments)').all<{ name: string }>()).results.map((c) => c.name)

/** Drops the four columns, as a database before 0070 stands. */
async function dropTheFour(): Promise<void> {
  for (const column of [...FOUR].reverse()) await env.DB.prepare(`ALTER TABLE tournaments DROP COLUMN ${column}`).run()
}

/** Runs migration 0070's own statements again, so the columns come back as the migration adds them. */
async function runMigration0070(): Promise<void> {
  const path = Object.keys(migrationModules).find((p) => p.endsWith('/0070_club_event_approval.sql'))
  expect(path).toBeDefined()
  for (const statement of splitSql(migrationModules[path!])) await env.DB.prepare(statement).run()
}

describe('with the four columns there', () => {
  let admin = ''
  let member = ''
  beforeAll(async () => {
    await seedExample()
    admin = await seedAdmin()
    member = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
  })

  it('has the four columns at the end of the table, as 0070 adds them', async () => {
    expect((await columnsOf()).slice(-4)).toEqual([...FOUR])
  })

  it('answers a signed-out visitor the public list byte for byte as the base did', async () => {
    expect(await listText()).toBe(BASE_LIST)
  })

  it('answers a signed-out visitor the public detail byte for byte as the base did', async () => {
    expect(await detailText(EVENT)).toBe(BASE_DETAIL)
  })

  it('answers a signed-in member who does not manage the event the same bytes, in the list and the detail', async () => {
    expect(await listText(member)).toBe(BASE_LIST)
    expect(await detailText(EVENT, member)).toBe(BASE_DETAIL)
  })

  it('gives the event\'s managers the four keys, 0 and three nulls on a row nobody has written, in the list and the detail', async () => {
    for (const [who, as] of [['an LCA admin', admin], ['the club\'s rep', REP]] as const) {
      const list = await expectContract(await invoke(tournamentsGet, { as }), contracts.tournaments.GET.response)
      const row = list.tournaments.find((t) => t.id === EVENT)
      expect(row, who).toMatchObject({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null, approved_by: null })
      const detail = await expectContract(await invoke(tournamentGet, { as, params: { id: EVENT } }), contracts['tournaments/[id]'].GET.response)
      expect(detail.tournament, who).toMatchObject({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null, approved_by: null })
    }
  })

  it('answers the manage page the four keys under its strict contract, an answer only the event\'s managers read', async () => {
    const body = await expectContract(await invoke(manageGet, { as: admin, params: { id: EVENT } }), contracts['admin/tournaments/[id]/manage'].GET.response)
    expect(body.tournament).toMatchObject({ needs_lca_approval: 0, approval_requested_at: null, approved_at: null, approved_by: null })
    expect((await invoke(manageGet, { as: member, params: { id: EVENT } })).status).toBe(403)
  })

  it('names the four among the keys the public answers keep for managers', () => {
    expect(MANAGER_ONLY_TOURNAMENT_KEYS).toEqual(expect.arrayContaining([...FOUR]))
  })
})

describe('on a database the migration has not reached', () => {
  let admin = ''
  beforeAll(async () => {
    admin = await seedAdmin()
    await dropTheFour()
  })
  afterAll(async () => {
    await runMigration0070()
    expect((await columnsOf()).slice(-4)).toEqual([...FOUR])
  })

  it('has none of the four columns', async () => {
    const columns = await columnsOf()
    for (const column of FOUR) expect(columns, column).not.toContain(column)
  })

  it('answers a signed-out visitor the public list and the public detail byte for byte as the base did', async () => {
    expect(await listText()).toBe(BASE_LIST)
    expect(await detailText(EVENT)).toBe(BASE_DETAIL)
  })

  it('answers the event\'s managers without the four keys, since the row has none', async () => {
    const list = await (await invoke(tournamentsGet, { as: admin })).json<{ tournaments: Array<Record<string, unknown>> }>()
    const detail = await (await invoke(tournamentGet, { as: admin, params: { id: EVENT } })).json<{ tournament: Record<string, unknown> }>()
    for (const key of FOUR) {
      expect(Object.hasOwn(list.tournaments.find((t) => t.id === EVENT)!, key), key).toBe(false)
      expect(Object.hasOwn(detail.tournament, key), key).toBe(false)
    }
  })

  it('meets the window the other way round, the new build before 0070 has run: a create that passes its checks fails and writes nothing, and a setup save answers as before', async () => {
    // Drizzle names every column of the schema in the create's insert, so the insert names the four; the Pages
    // Function answers the error as a 500. The save's read names each column in double quotes, which D1 reads as text
    // where the column is missing, and its update names none of the four.
    const name = 'Example Probe Open'
    await expect(invoke(createTournament, { method: 'POST', as: admin, body: { name, location: 'Kenner, LA', date: '2026-12-12', entryFee: 0 } }))
      .rejects.toThrow(/has no column named needs_lca_approval/)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE name = ?').bind(name).first<{ n: number }>()).toEqual({ n: 0 })
    const other = await seedTournament({ name: 'Example Save Open', clubId: CLUB, entryFee: 0, isVisible: false })
    const saved = await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id: other }, body: { venue: 'Example Hall' } })
    expect(saved.status).toBe(200)
    expect(await env.DB.prepare('SELECT venue FROM tournaments WHERE id = ?').bind(other).first()).toEqual({ venue: 'Example Hall' })
  })

  it('deletes a member as before, with one log line naming no member', async () => {
    const leaving = await seedMember({ fullName: 'Player Three', email: 'player.three@example.org' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: leaving } })
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe('{"success":true,"authDeleted":false}')
    const lines = warn.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('member delete: '))
    expect(lines).toEqual([[APPROVALS_UNCLEARED_LOG]])
    expect(JSON.stringify(lines)).not.toContain(leaving)
    expect(JSON.stringify(lines)).not.toContain('player.three')
    expect(await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(leaving).first()).toBeNull()
  })
})

describe('an event marked for approval', () => {
  const MARKED = 'example-winter-open'
  let admin = ''
  let member = ''
  let otherRep = ''
  beforeAll(async () => {
    admin = await seedAdmin()
    member = await seedMember({ fullName: 'Player Four', email: 'player.four@example.org' })
    const other = await seedClub({ name: 'Example Second Club' })
    otherRep = await seedMember({ role: 'club_rep', clubId: other, fullName: 'Player Five', email: 'player.five@example.org' })
    await seedTournament({ id: MARKED, name: 'Example Winter Open', date: '2026-12-12', clubId: CLUB, createdBy: REP, entryFee: 0 })
    await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = '2026-11-14 18:00:00' WHERE id = ?`).bind(MARKED).run()
  })

  it('gives a visitor, a plain member and another club\'s rep none of the four keys, in the list and the detail, and every other column as stored', async () => {
    const row = (await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(MARKED).first<Record<string, unknown>>())!
    for (const [who, as] of [['a visitor', undefined], ['a plain member', member], ['another club\'s rep', otherRep]] as const) {
      const list = await expectContract(await invoke(tournamentsGet, { as }), contracts.tournaments.GET.response)
      const listed = list.tournaments.find((t) => t.id === MARKED) as Record<string, unknown> | undefined
      const detail = await expectContract(await invoke(tournamentGet, { as, params: { id: MARKED } }), contracts['tournaments/[id]'].GET.response)
      for (const answer of [listed, detail.tournament as Record<string, unknown>]) {
        expect(answer, who).toBeDefined()
        for (const key of MANAGER_ONLY_TOURNAMENT_KEYS) expect(Object.hasOwn(answer!, key), `${who}: ${key}`).toBe(false)
        expect(answer!.name, who).toBe(row.name)
      }
    }
  })

  it('gives its managers the four keys as stored, in the list and the detail', async () => {
    const stored = { needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: null, approved_by: null }
    for (const [who, as] of [['an LCA admin', admin], ['the club\'s rep', REP]] as const) {
      const list = await expectContract(await invoke(tournamentsGet, { as }), contracts.tournaments.GET.response)
      expect(list.tournaments.find((t) => t.id === MARKED), who).toMatchObject(stored)
      const detail = await expectContract(await invoke(tournamentGet, { as, params: { id: MARKED } }), contracts['tournaments/[id]'].GET.response)
      expect(detail.tournament, who).toMatchObject(stored)
    }
  })
})

describe('the member delete and approved_by', () => {
  const ANSWER = '{"success":true,"authDeleted":false}'
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})
  const remove = (as: string | undefined, id: string, db?: D1Database) =>
    invoke(memberDelete, { method: 'DELETE', as, params: { id }, env: db ? { DB: db } : undefined })
  const exists = async (id: string) => (await env.DB.prepare('SELECT id FROM members WHERE id = ?').bind(id).first()) !== null
  /** An event the member approved, as an LCA admin's approval will write it. */
  async function approvedBy(memberId: string, name: string): Promise<string> {
    const id = await seedTournament({ name, clubId: CLUB, entryFee: 0 })
    await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = '2026-11-14 18:00:00', approved_at = '2026-11-15 18:00:00', approved_by = ? WHERE id = ?`)
      .bind(memberId, id).run()
    return id
  }
  const marks = async (id: string) => env.DB.prepare('SELECT needs_lca_approval, approved_at, approved_by FROM tournaments WHERE id = ?').bind(id).first()

  it('sets approved_by to NULL on the events the member approved, keeps approved_at, and leaves another approver\'s as they were', async () => {
    const admin = await seedAdmin()
    const leaving = await seedMember({ role: 'lca_admin', fullName: 'Player Six', email: 'player.six@example.org' })
    const staying = await seedMember({ role: 'lca_admin', fullName: 'Player Seven', email: 'player.seven@example.org' })
    const mine = [await approvedBy(leaving, 'Example Spring Open'), await approvedBy(leaving, 'Example Summer Open')]
    const theirs = await approvedBy(staying, 'Example Autumn Open')
    const warn = quiet()
    const res = await remove(admin, leaving)
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(leaving)).toBe(false)
    expect(warn.mock.calls.map(([line]) => line)).not.toContain(APPROVALS_UNCLEARED_LOG)
    for (const id of mine) expect(await marks(id)).toEqual({ needs_lca_approval: 1, approved_at: '2026-11-15 18:00:00', approved_by: null })
    expect(await marks(theirs)).toEqual({ needs_lca_approval: 1, approved_at: '2026-11-15 18:00:00', approved_by: staying })
  })

  it('answers as before with the column not there yet: the delete succeeds, with one log line naming no member', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Eight', email: 'player.eight@example.org' })
    const warn = quiet()
    const res = await remove(admin, member, laggingDb({ name: 'approved_by', kind: 'column' }))
    expect(res.status).toBe(200)
    expect(await res.response.text()).toBe(ANSWER)
    expect(await exists(member)).toBe(false)
    const lines = warn.mock.calls.filter(([line]) => typeof line === 'string' && line.startsWith('member delete: '))
    expect(lines).toEqual([[APPROVALS_UNCLEARED_LOG]])
    expect(JSON.stringify(lines)).not.toContain(member)
    expect(JSON.stringify(lines)).not.toContain('player.eight')
  })

  it('does not take another failure of the clear for a missing column: the delete stops and the member stays', async () => {
    const admin = await seedAdmin()
    const member = await seedMember({ fullName: 'Player Nine', email: 'player.nine@example.org' })
    const db = env.DB
    const failing = {
      prepare: (sql: string) => (sql.startsWith('SELECT approved_by FROM tournaments')
        ? { all: async () => { throw new Error('D1_ERROR: database is locked: SQLITE_BUSY') } }
        : db.prepare(sql)),
      batch: (statements: D1PreparedStatement[]) => db.batch(statements),
    } as unknown as D1Database
    await expect(remove(admin, member, failing)).rejects.toThrow(/database is locked/)
    expect(await exists(member)).toBe(true)
  })

  it('role safety: a club\'s rep, a member and a visitor are refused and no event\'s approver moves', async () => {
    const target = await seedMember({ role: 'lca_admin', fullName: 'Player Ten', email: 'player.ten@example.org' })
    const event = await approvedBy(target, 'Example Holiday Open')
    const plain = await seedMember({ fullName: 'Player Eleven', email: 'player.eleven@example.org' })
    for (const [who, as, status] of [['a club\'s rep', REP, 403], ['a member', plain, 403], ['a visitor', undefined, 401]] as const) {
      expect((await remove(as, target)).status, who).toBe(status)
    }
    expect(await exists(target)).toBe(true)
    expect(await marks(event)).toEqual({ needs_lca_approval: 1, approved_at: '2026-11-15 18:00:00', approved_by: target })
  })
})
