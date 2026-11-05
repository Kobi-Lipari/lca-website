// test/integration/tournament-delete-edges.test.ts
//
// The delete of an event, DELETE /api/admin/tournaments/[id], at its edges
// (WS08 step 5: the delete half of criterion 14, and the standing rule that
// the server answers as today while CREATION_ROLES_ON is unset).
// - Unset, the handler answers what it answered before the step, byte for
//   byte, for every caller and every kind of event. A copy of that handler,
//   word for word as it stood at 1627670, is run on a twin of each event:
//   the two give the same status, words and headers, leave the same rows,
//   write no row in the activity log, and prepare the same statements in the
//   same order, the caller's own member row aside, which the new handler
//   reads once before requireAdmin reads it again (the verify item
//   "requireAdmin after requireAuthedMember"). So nothing about the event is
//   read before requireAdmin has answered.
// - Set, an LCA admin's answers are still those, with the entries counted
//   after the event is read and the row in the activity log after the six
//   deletes. Every other caller who may not delete gets one answer, the same
//   status, words and headers as today's "Forbidden", for an event that does
//   not exist, another's hidden draft, a published event and the event a
//   one-event director directs, and no delete is prepared for them.
// - Set, a creator deletes with a session that has no second factor, which
//   only an admin's delete asks for (the decision "An admin's delete keeps
//   its two-step sign-in"); the entries counted are every registrations row,
//   withdrawn and waitlisted ones too; the president's right ends with the
//   term on the seat and comes back with a new one; a club rep's goes while
//   an LCA admin has moved its draft to another club and comes back when it
//   is moved back; a club rep who holds the seat deletes with the
//   president's grant.
// - Set, a creator's delete takes every row under the event and none under
//   another event; a second delete of the same event is refused, or not
//   found for an admin, and writes no second row; and the activity log's
//   Events filter finds the row an LCA admin reads.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter
// on the mocked module, as test/integration/tournament-create.test.ts reads
// it, so each case runs in the state its name gives.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../../functions/types'
import { isResponse, requireAdmin } from '../../functions/utils/auth'
import { errorResponse, jsonResponse } from '../../functions/utils/response'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestDelete as deleteTournament, onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as auditGet } from '../../functions/api/admin/audit'
import {
  seedAdmin, seedClub, seedDirector, seedMember, seedPresident, seedRegistration, seedTournament, seedTournamentDirector,
} from './factories'
import { invoke, resetHarness, type Aal } from './harness'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.rolesOn = false
  vi.restoreAllMocks()
})

/**
 * DELETE /api/admin/tournaments/[id] as it stood before WS08 step 5, at
 * 1627670, word for word: the answer the unset state is held to.
 */
const todayDelete = async (context: EventContext<Env, string, unknown>): Promise<Response> => {
  const tournamentId = context.params.id as string
  const authResult = await requireAdmin(context.request, context.env)
  if (isResponse(authResult)) return authResult

  const existing = await context.env.DB.prepare(
    'SELECT * FROM tournaments WHERE id = ?',
  ).bind(tournamentId).first()

  if (!existing) return errorResponse('Tournament not found', 404)

  await context.env.DB.prepare('DELETE FROM registrations WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_games WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_directors WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_reminders WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournament_attendee_reminders WHERE tournament_id = ?').bind(tournamentId).run()
  await context.env.DB.prepare('DELETE FROM tournaments WHERE id = ?').bind(tournamentId).run()

  return jsonResponse({ success: true })
}

/** The statement both handlers prepare to read the caller's own member row. */
const MEMBER_READ = 'SELECT * FROM members WHERE id = ?'
/** The six deletes, in the order today's handler runs them. */
const SIX_DELETES = [
  'delete registrations', 'delete tournament_games', 'delete tournament_directors',
  'delete tournament_reminders', 'delete tournament_attendee_reminders', 'delete tournaments',
]

/** What a statement does, for the reads and writes the delete makes; anything else is kept as its text. */
function kindOf(sql: string): string {
  if (sql === MEMBER_READ) return 'member'
  if (sql === 'SELECT * FROM tournaments WHERE id = ?') return 'event'
  if (sql === 'SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?') return 'entries'
  if (/\bboard_seat_assignments\b/.test(sql)) return 'seat'
  const removal = /^DELETE FROM (\w+) WHERE (?:tournament_id|id) = \?$/.exec(sql)
  if (removal) return `delete ${removal[1]}`
  if (/^INSERT INTO admin_audit_log\b/.test(sql)) return 'log'
  return sql
}

/** Runs the call with every statement it prepares kept, in order, its runs of white space made one space. */
async function traced<T>(call: () => Promise<T>): Promise<{ result: T; statements: string[] }> {
  const spy = vi.spyOn(env.DB, 'prepare')
  try {
    const result = await call()
    return { result, statements: spy.mock.calls.map((c) => String(c[0]).replace(/\s+/g, ' ').trim()) }
  } finally {
    spy.mockRestore()
  }
}

/** An answer as the browser gets it: the status, the body's own bytes and every header. */
async function wire(response: Response) {
  return {
    status: response.status,
    body: await response.clone().text(),
    headers: [...response.headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
  }
}

/** Today's refusal of anyone but an LCA admin, as requireRole builds it. */
const FORBIDDEN = () => wire(errorResponse('Forbidden', 403))

const count = async (sql: string, ...binds: unknown[]) => (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0
const logRows = () => count('SELECT COUNT(*) AS n FROM admin_audit_log')
const deleteRowsOf = async (tournamentId: string) => {
  const { results } = await env.DB.prepare(
    "SELECT actor_id, target_member_id, target_label, detail FROM admin_audit_log WHERE action = 'tournament_delete' AND json_extract(detail, '$.tournament_id') = ?",
  ).bind(tournamentId).all<{ actor_id: string; target_member_id: string | null; target_label: string | null; detail: string }>()
  return results.map((r) => ({ ...r, detail: JSON.parse(r.detail) as unknown }))
}

/** The rows the database holds under an event, table by table. */
async function under(tournamentId: string) {
  const of = (table: string, column = 'tournament_id') => count(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = ?`, tournamentId)
  return {
    tournaments: await of('tournaments', 'id'),
    registrations: await of('registrations'),
    tournament_games: await of('tournament_games'),
    tournament_directors: await of('tournament_directors'),
    tournament_reminders: await of('tournament_reminders'),
    tournament_attendee_reminders: await of('tournament_attendee_reminders'),
    tournament_sections: await of('tournament_sections'),
    tournament_schedules: await of('tournament_schedules'),
  }
}

let seq = 0

/** A reminder asked for, a reminder sent and a game, one row in each of the three tables the delete clears besides entries and directors. */
async function addRowsUnder(tournamentId: string): Promise<void> {
  const member = await seedMember()
  const other = await seedMember()
  const n = ++seq
  await env.DB.prepare('INSERT INTO tournament_reminders (id, member_id, tournament_id, email) VALUES (?, ?, ?, ?)')
    .bind(`rem-${n}`, member, tournamentId, `${member}@test.lca`).run()
  await env.DB.prepare('INSERT INTO tournament_attendee_reminders (id, tournament_id, member_id, reminder_number) VALUES (?, ?, ?, 1)')
    .bind(`att-${n}`, tournamentId, member).run()
  await env.DB.prepare("INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result) VALUES (?, ?, 1, 1, 'Open', ?, ?, 'pending')")
    .bind(`game-${n}`, tournamentId, member, other).run()
}

/** The president as the brief keeps the role: an LCA observer with a current term on the President seat. */
async function seedSeatedObserver(): Promise<string> {
  const id = await seedMember({ role: 'lca_observer' })
  await seedPresident(id)
  return id
}

/** Ends every current term the member holds on a seat, as the seats page ends one. */
const endTerms = (memberId: string) =>
  env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL").bind(memberId).run()

/** A hidden draft made through the create, by the member, with the body's club if any. */
async function createdBy(as: string, clubId?: string): Promise<string> {
  const res = await invoke(createTournament, {
    method: 'POST', as, body: { name: `Delete probe ${++seq}`, location: 'Lake Charles, LA', date: '2026-12-19', entryFee: 20, ...(clubId ? { clubId } : {}) },
  })
  expect(res.status, `create by ${as}`).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

const remove = (handler: typeof deleteTournament | typeof todayDelete, id: string, as?: string, aal: Aal = 'aal2') =>
  invoke(handler, { method: 'DELETE', as, params: { id }, aal })

/** Everyone who might ask for a delete: who they are, the member id they sign in with (none for a visitor) and their session. */
interface Caller {
  label: string
  as?: string
  aal?: Aal
  club?: string
}

async function everyCaller(): Promise<Caller[]> {
  const club = await seedClub()
  const seatedRep = await seedMember({ role: 'club_rep', clubId: club })
  await seedPresident(seatedRep)
  return [
    { label: 'a visitor' },
    { label: 'a token the sign-in service refuses', as: 'invalid-token' },
    { label: 'a member', as: await seedMember() },
    { label: 'an auditor', as: await seedMember({ role: 'lca_auditor' }) },
    { label: 'an officer who holds no seat', as: await seedMember({ role: 'lca_officer' }) },
    { label: 'the president, an LCA observer who holds the seat', as: await seedSeatedObserver() },
    { label: 'a standing director', as: await seedDirector() },
    { label: 'the club\'s rep', as: await seedMember({ role: 'club_rep', clubId: club }), club },
    { label: 'the club\'s rep who holds the President seat', as: seatedRep, club },
    { label: 'an LCA admin with two-step sign-in', as: await seedAdmin() },
    { label: 'an LCA admin without it', as: await seedAdmin(), aal: 'aal1' },
  ]
}

/** The kinds of event a delete is asked about. */
const KINDS = ['the caller\'s own unpublished draft with no entries', 'a published event with an entry, two directors, reminders and a game', 'an event that does not exist'] as const
type Kind = (typeof KINDS)[number]

/** One event of the kind, for the caller; its twin is a second call. */
async function seedKind(kind: Kind, caller: Caller): Promise<string> {
  const signedIn = caller.as && caller.as !== 'invalid-token' ? caller.as : null
  if (kind === 'an event that does not exist') return `no-such-event-${++seq}`
  if (kind === 'the caller\'s own unpublished draft with no entries') {
    const id = await seedTournament({ isVisible: false, createdBy: signedIn, clubId: caller.club ?? null })
    if (signedIn) await seedTournamentDirector(id, signedIn)
    return id
  }
  const id = await seedTournament({ clubId: caller.club ?? null })
  await seedRegistration({ tournamentId: id, memberId: await seedMember() })
  await seedTournamentDirector(id, await seedMember())
  await seedTournamentDirector(id, await seedMember())
  await addRowsUnder(id)
  return id
}

describe('with CREATION_ROLES_ON unset, the delete is today\'s, byte for byte', () => {
  it('for every caller and every kind of event, today\'s handler and the new one on twin events give the same answer, leave the same rows and prepare the same statements, the caller\'s member row aside', async () => {
    const callers = await everyCaller()
    for (const caller of callers) {
      for (const kind of KINDS) {
        const label = `${caller.label}, ${kind}`
        const [a, b] = [await seedKind(kind, caller), await seedKind(kind, caller)]
        expect(await under(a), label).toEqual(await under(b))
        const logBefore = await logRows()

        const today = await traced(() => remove(todayDelete, a, caller.as, caller.aal))
        const now = await traced(() => remove(deleteTournament, b, caller.as, caller.aal))

        expect(await wire(now.result.response), label).toEqual(await wire(today.result.response))
        expect(await under(b), label).toEqual(await under(a))
        expect(await logRows(), label).toBe(logBefore)
        // The same statements in the same order, but for the one more read of the caller's own row.
        const others = (statements: string[]) => statements.filter((s) => s !== MEMBER_READ)
        expect(others(now.statements), label).toEqual(others(today.statements))
        const reads = (statements: string[]) => statements.filter((s) => s === MEMBER_READ).length
        expect(reads(now.statements), label).toBe(reads(today.statements) === 0 ? 0 : reads(today.statements) + 1)
        // Nothing reads the seat, counts the entries or writes the log.
        expect(now.statements.map(kindOf).filter((k) => ['seat', 'entries', 'log'].includes(k)), label).toEqual([])
      }
    }
  })

  it('anyone but an LCA admin with two-step sign-in is answered before anything about the event is read, whether it exists or not', async () => {
    const callers = (await everyCaller()).filter((c) => c.label !== 'an LCA admin with two-step sign-in')
    for (const caller of callers) {
      for (const kind of KINDS) {
        const id = await seedKind(kind, caller)
        const before = await under(id)
        const { result, statements } = await traced(() => remove(deleteTournament, id, caller.as, caller.aal))
        expect(result.status, `${caller.label}, ${kind}`).toBe(caller.as === undefined || caller.as === 'invalid-token' ? 401 : 403)
        expect(statements.map(kindOf).filter((k) => k !== 'member'), `${caller.label}, ${kind}`).toEqual([])
        expect(await under(id), `${caller.label}, ${kind}`).toEqual(before)
      }
    }
  })
})

describe('with CREATION_ROLES_ON set, an LCA admin\'s delete answers as today and is logged', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('with and without two-step sign-in, for every kind of event, the answer and the rows are today\'s; a delete that happens counts the entries after the event is read and writes one row after the six deletes', async () => {
    for (const aal of ['aal2', 'aal1'] as const) {
      for (const kind of KINDS) {
        const admin = await seedAdmin()
        const caller: Caller = { label: `an LCA admin, ${aal}`, as: admin, aal }
        const label = `${caller.label}, ${kind}`
        const [a, b] = [await seedKind(kind, caller), await seedKind(kind, caller)]
        const entries = await count('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', b)
        const visible = await count('SELECT is_visible AS n FROM tournaments WHERE id = ?', b)
        const name = (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(b).first<{ name: string }>())?.name

        const today = await traced(() => remove(todayDelete, a, admin, aal))
        const now = await traced(() => remove(deleteTournament, b, admin, aal))

        expect(await wire(now.result.response), label).toEqual(await wire(today.result.response))
        expect(await under(b), label).toEqual(await under(a))
        const deleted = aal === 'aal2' && kind !== 'an event that does not exist'
        const expected = today.statements.filter((s) => s !== MEMBER_READ).map(kindOf)
        if (deleted) {
          expected.splice(expected.indexOf('event') + 1, 0, 'entries')
          expected.push('log')
        }
        expect(now.statements.filter((s) => s !== MEMBER_READ).map(kindOf), label).toEqual(expected)
        expect(now.statements.map(kindOf), label).not.toContain('seat')
        expect(await deleteRowsOf(b), label).toEqual(deleted
          ? [{ actor_id: admin, target_member_id: null, target_label: name, detail: { tournament_id: b, entries, was_visible: visible, grant: 'admin' } }]
          : [])
      }
    }
  })
})

describe('with CREATION_ROLES_ON set, one answer for everyone who may not delete', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a member, an auditor, an officer, an observer, the president, a standing director, a club rep and a one-event director get today\'s "Forbidden", byte for byte, for an event that does not exist, another\'s hidden draft, a draft with no creator recorded, a published event and the event the one-event director directs, and no delete is prepared', async () => {
    const club = await seedClub()
    const admin = await seedAdmin()
    const oneEvent = await seedMember()
    const presidentsDraft = await createdBy(await seedSeatedObserver())
    await seedTournamentDirector(presidentsDraft, oneEvent)
    const events = {
      'an event that does not exist': 'no-such-event',
      'an LCA admin\'s hidden draft with no entries': await createdBy(admin),
      'the club\'s hidden draft an LCA admin made': await createdBy(admin, club),
      'a hidden draft with no creator recorded': await seedTournament({ isVisible: false, createdBy: null }),
      'a published event with an entry': await seedTournament({ clubId: club }),
      'the president\'s draft a one-event director directs': presidentsDraft,
    }
    await seedRegistration({ tournamentId: events['a published event with an entry'], memberId: await seedMember() })
    const askers: ReadonlyArray<readonly [string, string]> = [
      ['a member', await seedMember()],
      ['an auditor', await seedMember({ role: 'lca_auditor' })],
      ['an officer who holds no seat', await seedMember({ role: 'lca_officer' })],
      ['an observer who holds no seat', await seedMember({ role: 'lca_observer' })],
      ['the president', await seedSeatedObserver()],
      ['a standing director', await seedDirector()],
      ['the club\'s rep', await seedMember({ role: 'club_rep', clubId: club })],
      ['the one-event director', oneEvent],
    ]
    const forbidden = await FORBIDDEN()
    const logBefore = await logRows()
    for (const [who, as] of askers) {
      for (const [what, id] of Object.entries(events)) {
        const before = await under(id)
        const { result, statements } = await traced(() => remove(deleteTournament, id, as))
        expect(await wire(result.response), `${who}, ${what}`).toEqual(forbidden)
        expect(statements.map(kindOf).filter((k) => k.startsWith('delete ') || k === 'log'), `${who}, ${what}`).toEqual([])
        expect(await under(id), `${who}, ${what}`).toEqual(before)
      }
    }
    expect(await logRows()).toBe(logBefore)
  })
})

describe('with CREATION_ROLES_ON set, a creator\'s delete', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('asks no second factor: a standing director, the president and a club rep each delete their own draft with a session that has none, and the row names their grant', async () => {
    const club = await seedClub()
    const creators: ReadonlyArray<readonly [string, string, string | undefined]> = [
      ['standing_director', await seedDirector(), undefined],
      ['president', await seedSeatedObserver(), undefined],
      ['club_rep', await seedMember({ role: 'club_rep', clubId: club }), undefined],
    ]
    for (const [grant, creator, clubId] of creators) {
      const id = await createdBy(creator, clubId)
      const { result, statements } = await traced(() => remove(deleteTournament, id, creator, 'aal1'))
      expect(result.status, grant).toBe(200)
      expect(await result.json(), grant).toEqual({ success: true })
      // Read before any delete: the event, its entries and the person's seat; then today's six, then the row.
      const kinds = statements.map(kindOf).filter((k) => k !== 'member')
      expect(kinds.slice(0, 2), grant).toEqual(['event', 'entries'])
      expect(kinds.slice(-7), grant).toEqual([...SIX_DELETES, 'log'])
      expect(kinds.indexOf('seat'), grant).toBeLessThan(kinds.indexOf(SIX_DELETES[0]))
      expect(await under(id), grant).toEqual({
        tournaments: 0, registrations: 0, tournament_games: 0, tournament_directors: 0, tournament_reminders: 0,
        tournament_attendee_reminders: 0, tournament_sections: 0, tournament_schedules: 0,
      })
      expect((await deleteRowsOf(id)).map((r) => [r.actor_id, r.target_member_id, (r.detail as { grant: string }).grant]), grant).toEqual([[creator, null, grant]])
    }
  })

  it('counts every registrations row as an entry: a withdrawn entry alone, or a waitlisted one alone, keeps the draft from its creator, and an LCA admin\'s row counts all of them', async () => {
    const director = await seedDirector()
    const drafts: string[] = []
    for (const column of ['withdrawn_at', 'waitlisted_at', null] as const) {
      const id = await createdBy(director)
      const entry = await seedRegistration({ tournamentId: id, memberId: await seedMember(), paymentStatus: 'pending' })
      if (column) await env.DB.prepare(`UPDATE registrations SET ${column} = datetime('now') WHERE id = ?`).bind(entry).run()
      const before = await under(id)
      const res = await remove(deleteTournament, id, director)
      expect(res.status, String(column)).toBe(403)
      expect(await res.json(), String(column)).toEqual({ error: 'Forbidden' })
      expect(await under(id), String(column)).toEqual(before)
      expect(await deleteRowsOf(id), String(column)).toEqual([])
      drafts.push(id)
    }
    // One draft with all three: an LCA admin deletes it, and the row counts three entries.
    const [withAll] = drafts
    await seedRegistration({ tournamentId: withAll, memberId: await seedMember() })
    const waiting = await seedRegistration({ tournamentId: withAll, memberId: await seedMember(), paymentStatus: 'pending' })
    await env.DB.prepare("UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?").bind(waiting).run()
    const admin = await seedAdmin()
    expect((await remove(deleteTournament, withAll, admin)).status).toBe(200)
    expect((await deleteRowsOf(withAll)).map((r) => r.detail)).toEqual([{ tournament_id: withAll, entries: 3, was_visible: 0, grant: 'admin' }])
  })

  it('the president\'s right goes with the term on the seat: refused once the term ends, the draft and its rows kept, and let through again with a new term', async () => {
    const president = await seedSeatedObserver()
    const id = await createdBy(president)
    const before = await under(id)
    await endTerms(president)
    const refused = await remove(deleteTournament, id, president)
    expect(refused.status).toBe(403)
    expect(await wire(refused.response)).toEqual(await FORBIDDEN())
    expect(await under(id)).toEqual(before)
    expect(await deleteRowsOf(id)).toEqual([])

    await seedPresident(president)
    const res = await remove(deleteTournament, id, president)
    expect(res.status).toBe(200)
    expect((await under(id)).tournaments).toBe(0)
    expect((await deleteRowsOf(id)).map((r) => (r.detail as { grant: string }).grant)).toEqual(['president'])
  })

  it('a club rep\'s right goes while an LCA admin has moved its draft to another club, and comes back once it is moved back', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    const admin = await seedAdmin()
    const id = await createdBy(rep)
    expect((await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?').bind(id).first<{ club_id: string }>())?.club_id).toBe(own)

    expect((await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id }, body: { clubId: other } })).status).toBe(200)
    const refused = await remove(deleteTournament, id, rep)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Forbidden' })
    expect((await under(id)).tournaments).toBe(1)

    expect((await invoke(patchTournament, { method: 'PATCH', as: admin, params: { id }, body: { clubId: own } })).status).toBe(200)
    const res = await remove(deleteTournament, id, rep)
    expect(res.status).toBe(200)
    expect((await under(id)).tournaments).toBe(0)
    expect((await deleteRowsOf(id)).map((r) => [r.actor_id, (r.detail as { grant: string }).grant])).toEqual([[rep, 'club_rep']])
  })

  it('a club rep who holds the President seat deletes its own club\'s draft and an LCA-run draft it made, each with the president\'s grant, and not another club\'s', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    await seedPresident(rep)
    const clubDraft = await createdBy(rep)
    const lcaRun = await seedTournament({ isVisible: false, createdBy: rep, clubId: null })
    const othersDraft = await seedTournament({ isVisible: false, createdBy: rep, clubId: other })

    const refused = await remove(deleteTournament, othersDraft, rep)
    expect(refused.status).toBe(403)
    expect((await under(othersDraft)).tournaments).toBe(1)
    for (const id of [clubDraft, lcaRun]) {
      const res = await remove(deleteTournament, id, rep)
      expect(res.status, id).toBe(200)
      expect((await under(id)).tournaments, id).toBe(0)
      expect((await deleteRowsOf(id)).map((r) => (r.detail as { grant: string }).grant), id).toEqual(['president'])
    }
  })

  it('takes every row under the event, the named director\'s and the sections\' among them, and none under another event', async () => {
    const president = await seedSeatedObserver()
    const id = await createdBy(president)
    await seedTournamentDirector(id, await seedMember())
    await addRowsUnder(id)
    const kept = await createdBy(await seedSeatedObserver())
    await seedTournamentDirector(kept, await seedMember())
    await addRowsUnder(kept)
    const keptBefore = await under(kept)
    expect(await under(id)).toEqual({ ...keptBefore })
    expect(Object.entries(keptBefore).filter(([table, n]) => table !== 'registrations' && n === 0)).toEqual([])

    expect((await remove(deleteTournament, id, president)).status).toBe(200)
    expect(Object.values(await under(id)).every((n) => n === 0)).toBe(true)
    expect(await under(kept)).toEqual(keptBefore)
  })
})

describe('a second delete of the same event', () => {
  it('with CREATION_ROLES_ON set, the creator\'s is refused with the one "Forbidden" and an LCA admin\'s is not found, and each event has one row in the activity log', async () => {
    flags.rolesOn = true
    const director = await seedDirector()
    const admin = await seedAdmin()
    const own = await createdBy(director)
    const any = await seedTournament()

    expect((await remove(deleteTournament, own, director)).status).toBe(200)
    const again = await remove(deleteTournament, own, director)
    expect(await wire(again.response)).toEqual(await FORBIDDEN())
    expect((await remove(deleteTournament, any, admin)).status).toBe(200)
    const adminAgain = await remove(deleteTournament, any, admin)
    expect(adminAgain.status).toBe(404)
    expect(await adminAgain.json()).toEqual({ error: 'Tournament not found' })
    expect((await deleteRowsOf(own)).length).toBe(1)
    expect((await deleteRowsOf(any)).length).toBe(1)
  })

  it('with CREATION_ROLES_ON unset, an LCA admin\'s second delete is not found, and neither writes a row', async () => {
    const admin = await seedAdmin()
    const id = await seedTournament()
    const logBefore = await logRows()
    expect((await remove(deleteTournament, id, admin)).status).toBe(200)
    expect((await remove(deleteTournament, id, admin)).status).toBe(404)
    expect(await logRows()).toBe(logBefore)
  })
})

/** The Events filter's list of actions as the activity log sends it since WS08 step 5 (src/areas/admin/components/AuditLogPanel.tsx). */
const EVENTS_FILTER = 'tournament_create,tournament_publish,tournament_unpublish,tournament_delete,round_paired,round_delete,pairing_edit,tournament_complete,announcement_sent,director_assign,director_remove,registration_withdraw,registration_reinstate,waitlist_offer'

describe('the activity log\'s Events filter', () => {
  /** Whether an entry of the log is about the event: the database is shared by every case of the file. */
  const aboutEvent = (entry: { detail: string | null }, tournamentId: string) =>
    (JSON.parse(entry.detail ?? 'null') as { tournament_id?: string } | null)?.tournament_id === tournamentId
  const read = async (as: string, actions: string) => {
    const res = await invoke(auditGet, { as, path: `/api/admin/audit?action=${encodeURIComponent(actions)}&limit=200` })
    expect(res.status).toBe(200)
    return (await res.json<{ entries: Array<{ action: string; actor_id: string; target_label: string | null; detail: string | null }> }>()).entries
  }

  it('with CREATION_ROLES_ON set, finds a creator\'s delete for an LCA admin and for the president, who reads the log as an observer', async () => {
    flags.rolesOn = true
    const director = await seedDirector()
    const id = await createdBy(director)
    const name = (await env.DB.prepare('SELECT name FROM tournaments WHERE id = ?').bind(id).first<{ name: string }>())?.name
    expect((await remove(deleteTournament, id, director)).status).toBe(200)
    expect(EVENTS_FILTER.split(',').length).toBeLessThanOrEqual(20)
    for (const reader of [await seedAdmin(), await seedSeatedObserver()]) {
      const found = (await read(reader, EVENTS_FILTER)).filter((e) => e.action === 'tournament_delete' && aboutEvent(e, id))
      expect(found.map((e) => [e.actor_id, e.target_label, JSON.parse(e.detail ?? 'null')])).toEqual([
        [director, name, { tournament_id: id, entries: 0, was_visible: 0, grant: 'standing_director' }],
      ])
      // The list without the new action, as it stood before the step, does not find it.
      const before = EVENTS_FILTER.split(',').filter((a) => a !== 'tournament_delete').join(',')
      expect((await read(reader, before)).filter((e) => aboutEvent(e, id)).map((e) => e.action)).toEqual(['tournament_create'])
    }
  })

  it('with CREATION_ROLES_ON unset, finds no delete after an LCA admin\'s, since none is written', async () => {
    const admin = await seedAdmin()
    const id = await seedTournament()
    expect((await remove(deleteTournament, id, admin)).status).toBe(200)
    expect((await read(admin, EVENTS_FILTER)).filter((e) => aboutEvent(e, id))).toEqual([])
  })
})
