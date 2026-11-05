// test/integration/directors-edges.test.ts
//
// Naming and removing an event's directors, POST and DELETE
// /api/admin/tournaments/[id]/directors (D21, the row "Name or remove
// directors" of brief 1.4's table "Who may do what on an event", criterion
// 14), at its edges (WS08 step 5).
// - Every person against every kind of event, with CREATION_ROLES_ON unset
//   and set. Unset, the endpoint admits whom it admitted before the step, an
//   LCA admin and the organizing club's rep, worked out here from the two
//   roles its gate named then. Set, it admits those and, besides them, only
//   someone with a current term on the President seat, whatever their role,
//   on an LCA-run event they created. A visitor gets 401, and an event that
//   does not exist 404 before the rule, in both states. Unset, nothing reads
//   the seat; set, the seat is read once a call, only after the event is
//   found and never for an LCA admin.
// - The seat as it is at each request: a term that has ended, a term on
//   another seat and the seat made inactive give nothing; a handover and two
//   holders at once give each president their own drafts and no other's.
// - The right is the event's creator, not a director row: the president
//   named on an LCA admin's event names nothing there, and the president who
//   removes their own row from their draft still names on it; a draft an LCA
//   admin moves to a club is no longer the president's to name on, since the
//   president names only on an LCA-run event they created, and becomes the
//   club rep's.
// - Replays: the president's naming and removing write what an LCA admin's
//   write, and a second naming adds no row.
// - The gate comes before the body, and the body's checks are as before.
// - Listing the directors is as before: the seat gives nothing there.
// - The one-event director the president names saves each setup step with
//   the body today's manage page sends for it (Details with every key it
//   holds and the sections sent back with their fees, Registration settings
//   with the early and late dates, Schedule with a round added, the rating
//   report's settings), opens and closes registration, starts and finishes
//   the event and hides and publishes it again, each changing only what it
//   sends.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter
// on the mocked module, as test/integration/directors.test.ts reads it.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import {
  onRequestDelete as removeDirector,
  onRequestGet as listDirectors,
  onRequestPost as assignDirector,
} from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as getManage } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as patchRegistrationStatus } from '../../functions/api/admin/tournaments/[id]/registration'
import { seedAdmin, seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
import { flushWaitUntil, invoke, resetHarness } from './harness'

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

/** The two states of CREATION_ROLES_ON. */
const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

/** Today's refusal of a naming or a removal, kept word for word. */
const NAMING_WORDS = "Only admins and the organizing club's rep can assign directors"

const name = (as: string | undefined, id: string, memberId?: string) =>
  invoke(assignDirector, { method: 'POST', as, params: { id }, body: memberId === undefined ? {} : { memberId } })
const unname = (as: string | undefined, id: string, memberId?: string) =>
  invoke(removeDirector, { method: 'DELETE', as, params: { id }, body: memberId === undefined ? {} : { memberId } })
const save = (as: string, id: string, body: Record<string, unknown>) => invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })

/** The event's directors, as tournament_directors holds them, in member id order. */
async function directorsOf(tournamentId: string): Promise<string[]> {
  const { results } = await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ? ORDER BY member_id')
    .bind(tournamentId).all<{ member_id: string }>()
  return results.map((r) => r.member_id)
}

/** The activity log's rows of one action about the event: who did it, and to whom. */
async function logOf(action: string, tournamentId: string) {
  const { results } = await env.DB.prepare(
    "SELECT actor_id, target_member_id FROM admin_audit_log WHERE action = ? AND json_extract(detail, '$.tournament_id') = ? ORDER BY created_at, id",
  ).bind(action, tournamentId).all<{ actor_id: string; target_member_id: string | null }>()
  return results
}

/** The event's row, every column as stored. */
const eventOf = (tournamentId: string) =>
  env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<Record<string, unknown>>()

/** The columns two rows of one table hold differently. */
function changed(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  return Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).sort()
}

/** How many of the statements a call prepares read a term on a seat. */
async function seatReads<T>(call: () => Promise<T>): Promise<{ result: T; reads: number }> {
  const spy = vi.spyOn(env.DB, 'prepare')
  try {
    const result = await call()
    return { result, reads: spy.mock.calls.filter((c) => /\bboard_seat_assignments\b/.test(String(c[0]))).length }
  } finally {
    spy.mockRestore()
  }
}

let seq = 0

async function seatId(slug: string): Promise<string> {
  const row = await env.DB.prepare('SELECT id FROM board_members WHERE slug = ?').bind(slug).first<{ id: string }>()
  if (!row) throw new Error(`no seat whose slug is ${slug}`)
  return row.id
}

/** A current term on the seat, as the seats page gives one. */
async function seatOn(memberId: string, slug: string): Promise<void> {
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)')
    .bind(`edge-term-${++seq}`, await seatId(slug), memberId).run()
}

/** Ends every current term the member holds, as the seats page ends one. */
const endTerms = (memberId: string) =>
  env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL").bind(memberId).run()

/** A member with a current term on the President seat, in the role given. */
async function seatedAs(role: string, clubId?: string): Promise<string> {
  const id = await seedMember({ role, clubId: clubId ?? null })
  await seedPresident(id)
  return id
}

/** A hidden draft made through the create, by the member: the president's is LCA-run, with the president as its first director. */
async function draftBy(as: string): Promise<string> {
  const res = await invoke(createTournament, {
    method: 'POST', as, body: { name: `Naming probe ${++seq}`, location: 'Alexandria, LA', date: '2026-12-12', entryFee: 20 },
  })
  expect(res.status, `create by ${as}`).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

/** Who might name a director: their label, the member id they sign in with (none for a visitor), and what the rule reads of them. */
interface Person {
  label: string
  as?: string
  role?: string
  club?: string | null
  seat: boolean
}

async function everyone(club: string, otherClub: string): Promise<Person[]> {
  const person = async (label: string, role: string, opts: { club?: string; seat?: boolean } = {}): Promise<Person> => {
    const as = opts.seat ? await seatedAs(role, opts.club) : await seedMember({ role, clubId: opts.club ?? null })
    return { label, as, role, club: opts.club ?? null, seat: !!opts.seat }
  }
  return [
    { label: 'a visitor', seat: false },
    { label: 'a token the sign-in service refuses', as: 'invalid-token', seat: false },
    await person('a member', 'member'),
    await person('a member whose account names the club', 'member', { club }),
    await person('an auditor', 'lca_auditor'),
    await person('an officer who holds no seat', 'lca_officer'),
    await person('an observer who holds no seat', 'lca_observer'),
    await person('the president, an LCA observer', 'lca_observer', { seat: true }),
    await person('the president, an LCA officer', 'lca_officer', { seat: true }),
    await person('a member who holds the President seat', 'member', { seat: true }),
    await person('a standing director', 'tournament_director'),
    await person('a standing director who holds the President seat', 'tournament_director', { seat: true }),
    await person('the club\'s rep', 'club_rep', { club }),
    await person('another club\'s rep', 'club_rep', { club: otherClub }),
    await person('a club rep with no club', 'club_rep'),
    await person('the club\'s rep who holds the President seat', 'club_rep', { club, seat: true }),
    await person('an LCA admin', 'lca_admin'),
  ]
}

/** The kinds of event a naming is asked about: the event's club ('club' for the club, null for none) and its creator. */
const EVENT_KINDS: ReadonlyArray<readonly [string, 'club' | null | 'missing', 'self' | 'admin' | null]> = [
  ['the club\'s event the person created', 'club', 'self'],
  ['the club\'s event an LCA admin created', 'club', 'admin'],
  ['an LCA-run event the person created', null, 'self'],
  ['an LCA-run event an LCA admin created', null, 'admin'],
  ['an LCA-run event with no creator recorded', null, null],
  ['an event that does not exist', 'missing', null],
]

/** Whom the gate admitted before WS08 step 5: an LCA admin, and the rep of the club that organizes the event. */
const admittedBefore = (p: Person, clubId: string | null) =>
  p.role === 'lca_admin' || (p.role === 'club_rep' && !!clubId && p.club === clubId)

describe.each(STATES)('every person against every kind of event, with CREATION_ROLES_ON %s', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('names and removes as the rule says, with today\'s words, 401 and 404, and writes a director row and a row in the activity log only when it admits', async () => {
    const club = await seedClub()
    const otherClub = await seedClub()
    const admin = await seedAdmin()
    for (const p of await everyone(club, otherClub)) {
      const signedIn = p.as !== undefined && p.as !== 'invalid-token'
      for (const [kind, where, creator] of EVENT_KINDS) {
        const label = `${p.label}, ${kind}`
        const clubId = where === 'club' ? club : null
        const createdBy = creator === 'self' ? (signedIn ? p.as! : null) : creator === 'admin' ? admin : null
        const id = where === 'missing' ? `no-such-event-${++seq}` : await seedTournament({ isVisible: false, clubId, createdBy })
        const standing = where === 'missing' ? null : await seedMember()
        if (standing) await seedTournamentDirector(id, standing)
        // The seat names only on an LCA-run event its holder created: an event with a club the holder made earlier, as a club's
        // rep or as an LCA admin, is not one the president drafted (checkpoint K's review).
        const admits = admittedBefore(p, clubId) || (rolesOn && p.seat && clubId === null && createdBy !== null && createdBy === p.as)
        const status = !signedIn ? 401 : where === 'missing' ? 404 : null

        const helper = await seedMember()
        const named = await seatReads(() => name(p.as, id, helper))
        const removed = standing ? await seatReads(() => unname(p.as, id, standing)) : null

        if (status === 401) {
          for (const answer of [named.result, ...(removed ? [removed.result] : [])]) {
            expect([answer.status, await answer.json()], label).toEqual([401, { error: 'Unauthorized' }])
          }
        } else if (status === 404) {
          expect([named.result.status, await named.result.json()], label).toEqual([404, { error: 'Tournament not found' }])
        } else if (admits) {
          expect(named.result.status, label).toBe(201)
          expect(removed?.result.status, label).toBe(200)
        } else {
          for (const answer of [named.result, removed!.result]) {
            expect([answer.status, await answer.json()], label).toEqual([403, { error: NAMING_WORDS }])
          }
        }
        if (where !== 'missing') {
          const granted = status === null && admits
          // Named, then the standing director removed: the helper alone; refused, the standing director alone.
          expect(await directorsOf(id), label).toEqual(granted ? [helper] : [standing!])
          expect(await logOf('director_assign', id), label).toEqual(granted ? [{ actor_id: p.as, target_member_id: helper }] : [])
          expect(await logOf('director_remove', id), label).toEqual(granted ? [{ actor_id: p.as, target_member_id: standing }] : [])
        }
        // The seat: never read while the constant is unset; once a call when set, after the event is found and not for an LCA admin.
        const expectedReads = rolesOn && signedIn && where !== 'missing' && p.role !== 'lca_admin' ? 1 : 0
        expect(named.reads, `${label}, the naming's reads of the seat`).toBe(expectedReads)
        if (removed) expect(removed.reads, `${label}, the removal's reads of the seat`).toBe(expectedReads)
      }
    }
  })
})

describe('with CREATION_ROLES_ON set, the seat as it is at each request', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('a term that has ended, a term on another seat and the seat made inactive give nothing on the draft the president made, while the rows named stay; a new term, and the seat active again, give the right back', async () => {
    const president = await seatedAs('lca_observer')
    const id = await draftBy(president)
    const first = await seedMember()
    expect((await name(president, id, first)).status).toBe(201)

    await endTerms(president)
    const second = await seedMember()
    for (const answer of [await name(president, id, second), await unname(president, id, first)]) {
      expect([answer.status, await answer.json()]).toEqual([403, { error: NAMING_WORDS }])
    }
    expect(await directorsOf(id)).toEqual([president, first].sort())

    await seatOn(president, 'vice-president')
    expect((await name(president, id, second)).status).toBe(403)

    await seatOn(president, 'president')
    expect((await name(president, id, second)).status).toBe(201)

    const seat = await seatId('president')
    const third = await seedMember()
    await env.DB.prepare('UPDATE board_members SET is_active = 0 WHERE id = ?').bind(seat).run()
    try {
      expect((await name(president, id, third)).status).toBe(403)
    } finally {
      await env.DB.prepare('UPDATE board_members SET is_active = 1 WHERE id = ?').bind(seat).run()
    }
    expect((await name(president, id, third)).status).toBe(201)
    expect(await directorsOf(id)).toEqual([president, first, second, third].sort())
    expect((await logOf('director_assign', id)).map((r) => r.target_member_id)).toEqual([first, second, third])
  })

  it('a handover and two holders at once: each president names on the drafts they made and on no other president\'s, and a president whose term has ended on none', async () => {
    const before = await seatedAs('lca_observer')
    const beforeDraft = await draftBy(before)
    await endTerms(before)
    const now = await seatedAs('lca_observer')
    const nowDraft = await draftBy(now)
    const also = await seatedAs('lca_officer')
    const alsoDraft = await draftBy(also)
    const cases: ReadonlyArray<readonly [string, string, string, number]> = [
      ['the president now, on their own draft', now, nowDraft, 201],
      ['the president now, on the draft of the president before', now, beforeDraft, 403],
      ['the president before, on their own draft', before, beforeDraft, 403],
      ['the second holder, on their own draft', also, alsoDraft, 201],
      ['the second holder, on the other holder\'s draft', also, nowDraft, 403],
      ['the president now, on the second holder\'s draft', now, alsoDraft, 403],
    ]
    for (const [label, as, id, status] of cases) {
      const helper = await seedMember()
      const res = await name(as, id, helper)
      expect(res.status, label).toBe(status)
      expect((await directorsOf(id)).includes(helper), label).toBe(status === 201)
    }
  })
})

describe('with CREATION_ROLES_ON set, the right is the event\'s creator, not a director row', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('the president named on an LCA admin\'s event as one of its directors names and removes nothing there', async () => {
    const admin = await seedAdmin()
    const president = await seatedAs('lca_observer')
    const id = await draftBy(admin)
    expect((await name(admin, id, president)).status).toBe(201)
    const other = await seedMember()
    expect((await name(admin, id, other)).status).toBe(201)
    for (const answer of [await name(president, id, await seedMember()), await unname(president, id, other)]) {
      expect([answer.status, await answer.json()]).toEqual([403, { error: NAMING_WORDS }])
    }
    expect(await directorsOf(id)).toEqual([president, other].sort())
    expect((await logOf('director_assign', id)).map((r) => r.actor_id)).toEqual([admin, admin])
  })

  it('the president who removes their own row from their draft still names on it, themselves again among those named', async () => {
    const president = await seatedAs('lca_observer')
    const id = await draftBy(president)
    expect(await directorsOf(id)).toEqual([president])
    expect((await unname(president, id, president)).status).toBe(200)
    expect(await directorsOf(id)).toEqual([])
    const helper = await seedMember()
    expect((await name(president, id, helper)).status).toBe(201)
    expect((await name(president, id, president)).status).toBe(201)
    expect(await directorsOf(id)).toEqual([president, helper].sort())
    expect(await logOf('director_remove', id)).toEqual([{ actor_id: president, target_member_id: president }])
  })

  it('a draft the president made that an LCA admin moves to a club is no longer the president\'s to name on, since the president names only on an LCA-run event they created, and becomes the club rep\'s, not another club\'s rep\'s', async () => {
    const club = await seedClub()
    const otherClub = await seedClub()
    const admin = await seedAdmin()
    const president = await seatedAs('lca_observer')
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const otherRep = await seedMember({ role: 'club_rep', clubId: otherClub })
    const id = await draftBy(president)
    expect((await name(rep, id, await seedMember())).status).toBe(403)
    expect((await save(admin, id, { clubId: club })).status).toBe(200)
    expect((await eventOf(id))?.club_id).toBe(club)
    for (const [as, status] of [[president, 403], [rep, 201], [otherRep, 403]] as const) {
      const helper = await seedMember()
      expect((await name(as, id, helper)).status, as).toBe(status)
      expect((await directorsOf(id)).includes(helper), as).toBe(status === 201)
    }
  })
})

describe('with CREATION_ROLES_ON set, replays', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('the president\'s naming and removing on their draft write what an LCA admin\'s write on theirs: a second naming adds no row and answers the same list, a removal of someone not named answers 200, and each request is in the activity log', async () => {
    /** One run of the requests, by the person on their own draft, as statuses, the directors named and the log's counts. */
    async function run(as: string, id: string) {
      const creator = await directorsOf(id)
      const helper = await seedMember()
      const stranger = await seedMember()
      const steps = [
        () => name(as, id, helper), () => name(as, id, helper),
        () => unname(as, id, helper), () => unname(as, id, helper), () => unname(as, id, stranger),
      ]
      const statuses: number[] = []
      const named: string[][] = []
      const answered: unknown[] = []
      for (const step of steps) {
        const res = await step()
        statuses.push(res.status)
        const list = (await res.json<{ directors: Array<{ member_id: string }> }>()).directors.map((d) => d.member_id)
        answered.push(list.filter((m) => !creator.includes(m)).map((m) => (m === helper ? 'helper' : m)))
        named.push((await directorsOf(id)).filter((m) => !creator.includes(m)).map((m) => (m === helper ? 'helper' : m)))
      }
      return {
        statuses,
        named,
        answered,
        log: [(await logOf('director_assign', id)).length, (await logOf('director_remove', id)).length],
        removedStranger: (await logOf('director_remove', id)).some((r) => r.target_member_id === stranger),
      }
    }
    const president = await seatedAs('lca_observer')
    const admin = await seedAdmin()
    const presidents = await run(president, await draftBy(president))
    const admins = await run(admin, await draftBy(admin))
    expect(presidents).toEqual(admins)
    expect(presidents.statuses).toEqual([201, 201, 200, 200, 200])
    expect(presidents.named).toEqual([['helper'], ['helper'], [], [], []])
    expect(presidents.answered).toEqual(presidents.named)
  })
})

describe('with CREATION_ROLES_ON set, the gate comes before the body', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('on the president\'s draft a missing member id is 400 and a member who is not there or a guest 404; on another\'s event the same requests are refused first; an event that does not exist is 404 before either; and nothing is written', async () => {
    const president = await seatedAs('lca_observer')
    const own = await draftBy(president)
    const admins = await draftBy(await seedAdmin())
    const guest = await seedMember({ role: 'guest' })
    const logBefore = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n
    const cases: ReadonlyArray<readonly [string, Promise<{ status: number; json: <T>() => Promise<T> }>, number, string]> = [
      ['naming with no member id, own draft', name(president, own), 400, 'memberId is required'],
      ['removing with no member id, own draft', unname(president, own), 400, 'memberId is required'],
      ['naming someone who is not there, own draft', name(president, own, 'no-such-member'), 404, 'Member not found'],
      ['naming a guest, own draft', name(president, own, guest), 404, 'Member not found'],
      ['naming with no member id, an LCA admin\'s draft', name(president, admins), 403, NAMING_WORDS],
      ['removing with no member id, an LCA admin\'s draft', unname(president, admins), 403, NAMING_WORDS],
      ['naming someone who is not there, an LCA admin\'s draft', name(president, admins, 'no-such-member'), 403, NAMING_WORDS],
      ['naming with no member id, an event that does not exist', name(president, 'no-such-event'), 404, 'Tournament not found'],
    ]
    for (const [label, pending, status, words] of cases) {
      const res = await pending
      expect([res.status, await res.json()], label).toEqual([status, { error: words }])
    }
    expect(await directorsOf(own)).toEqual([president])
    expect(await directorsOf(admins)).toEqual([])
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n).toBe(logBefore)
  })
})

describe.each(STATES)('listing the directors, with CREATION_ROLES_ON %s, is as before', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('reads no seat: a member who holds the seat lists the draft they made and direct and not an LCA admin\'s event, and an observer who holds no seat lists any', async () => {
    const seated = await seatedAs('member')
    const own = await seedTournament({ isVisible: false, createdBy: seated })
    await seedTournamentDirector(own, seated)
    const admins = await seedTournament({ isVisible: false, createdBy: await seedAdmin() })
    const observer = await seedMember({ role: 'lca_observer' })
    const cases: ReadonlyArray<readonly [string, string, string, number]> = [
      ['the seated member, the draft they direct', seated, own, 200],
      ['the seated member, an LCA admin\'s event', seated, admins, 403],
      ['an observer, an LCA admin\'s event', observer, admins, 200],
    ]
    const logBefore = (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n
    for (const [label, as, id, status] of cases) {
      const { result, reads } = await seatReads(() => invoke(listDirectors, { as, params: { id } }))
      expect(result.status, label).toBe(status)
      if (status === 403) expect(await result.json(), label).toEqual({ error: 'Forbidden' })
      else expect((await result.json<{ directors: Array<{ member_id: string }> }>()).directors.map((d) => d.member_id), label).toEqual(await directorsOf(id))
      expect(reads, label).toBe(0)
    }
    // A read: the rows are as they were.
    expect([await directorsOf(own), await directorsOf(admins)]).toEqual([[seated], []])
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())?.n).toBe(logBefore)
  })
})

describe('with CREATION_ROLES_ON set, the one-event director the president names runs the event with the bodies today\'s manage page sends', () => {
  beforeEach(() => {
    flags.rolesOn = true
  })

  it('saves Details with every key the tab holds and the sections sent back with their fees, Registration settings with the early and late dates, Schedule with a round added and the rating report\'s settings, each changing only what it sends', async () => {
    const president = await seatedAs('lca_observer')
    const id = await draftBy(president)
    const director = await seedMember()
    expect((await name(president, id, director)).status).toBe(201)
    const sectionRows = async () => (await env.DB.prepare(
      'SELECT id, name, fee_regular, fee_early, fee_late, prize_fund, archived_at FROM tournament_sections WHERE tournament_id = ? ORDER BY position, id',
    ).bind(id).all()).results

    // Details: the page sends every key that differs from what it loaded, the sections whole, as the manage answer gave them.
    const manage = await invoke(getManage, { as: director, params: { id } })
    expect(manage.status).toBe(200)
    const { tournament } = await manage.json<{ tournament: { sections: Array<Record<string, unknown>> } }>()
    let before = await eventOf(id)
    expect(before?.pairing_system).not.toBe('fide')
    const sectionsBefore = await sectionRows()
    const details = {
      name: 'Cenla Winter Open',
      date: '2026-12-19',
      endDate: '2026-12-20',
      location: 'Pineville, LA',
      venue: 'Parish Hall',
      description: 'Five rounds over two days.',
      maxPlayers: 60,
      isRated: !before?.is_rated,
      pairingSystem: 'fide',
      accelerated: !before?.accelerated,
      keepApart: before?.keep_apart === 'family_club' ? 'none' : 'family_club',
      timeControl: 'G/90;d5',
      sections: tournament.sections.map((s, i) => (i === 0 ? { ...s, prizeFund: '$300 based on 30' } : s)),
      customDetails: [{ title: 'Parking', body: 'Free parking behind the hall.' }],
    }
    const detailsRes = await save(director, id, details)
    expect(detailsRes.status).toBe(200)
    expect(changed(before, await eventOf(id))).toEqual([
      'accelerated', 'custom_details', 'date', 'description', 'end_date', 'is_rated', 'keep_apart', 'location',
      'max_players', 'name', 'pairing_system', 'sections', 'time_control', 'venue',
    ])
    const sectionsAfter = await sectionRows()
    expect(sectionsAfter.map((r) => ({ ...r, prize_fund: null }))).toEqual(sectionsBefore.map((r) => ({ ...r, prize_fund: null })))
    expect((sectionsAfter[0] as { prize_fund: string | null }).prize_fund).toBe('$300 based on 30')

    // Registration settings: an early deadline with a discount, a late date with no late fee, and a close time.
    before = await eventOf(id)
    const registration = {
      registrationClosesAt: '2026-12-11T18:00',
      earlyDeadline: '2026-11-30T23:59',
      earlyDiscount: 5,
      lateAfter: '2026-12-10T12:00',
    }
    expect((await save(director, id, registration)).status).toBe(200)
    expect(changed(before, await eventOf(id))).toEqual(['early_deadline', 'early_discount', 'late_after', 'registration_closes_at'])

    // Schedule: one round more, with a time for each round, as the tab sends both.
    before = await eventOf(id)
    const rounds = Number(before?.rounds) + 1
    const roundSchedule = Array.from({ length: rounds }, (_, i) => ({ round: i + 1, date: i < 3 ? '2026-12-19' : '2026-12-20', time: `${String(9 + 3 * (i % 3)).padStart(2, '0')}:00` }))
    const scheduleRes = await save(director, id, { rounds, roundSchedule })
    expect(scheduleRes.status).toBe(200)
    expect(changed(before, await eventOf(id))).toEqual(['round_schedule', 'rounds'])
    expect((await scheduleRes.json<{ tournament: { round_schedule: unknown } }>()).tournament.round_schedule).toEqual(roundSchedule)

    // The rating report's settings, as its panel saves them.
    before = await eventOf(id)
    const reportSettings = { affiliateId: 'A6000001', chiefTdId: '12345678', assistantTdId: '', city: 'Pineville', state: 'LA', zip: '71360', scholastic: false }
    expect((await save(director, id, { reportSettings })).status).toBe(200)
    expect(changed(before, await eventOf(id))).toEqual(['report_settings'])
    expect(JSON.parse(String((await eventOf(id))?.report_settings))).toEqual(reportSettings)

    expect(await directorsOf(id)).toEqual([president, director].sort())
  })

  it('opens and closes registration, starts and finishes the event, and publishes, hides and publishes it again, each in the activity log as the director\'s where today\'s save logs it', async () => {
    const president = await seatedAs('lca_observer')
    const id = await draftBy(president)
    const director = await seedMember()
    expect((await name(president, id, director)).status).toBe(201)

    for (const status of ['open', 'closed'] as const) {
      const before = await eventOf(id)
      const res = await invoke(patchRegistrationStatus, { method: 'PATCH', as: director, params: { id }, body: { registration_status: status } })
      expect(res.status, status).toBe(200)
      await flushWaitUntil()
      expect(changed(before, await eventOf(id)), status).toEqual(['registration_status'])
      expect((await eventOf(id))?.registration_status, status).toBe(status)
    }
    for (const status of ['active', 'completed'] as const) {
      const before = await eventOf(id)
      expect((await save(director, id, { status })).status, status).toBe(200)
      expect(changed(before, await eventOf(id)), status).toEqual(['status'])
    }
    expect(await logOf('tournament_complete', id)).toEqual([{ actor_id: director, target_member_id: null }])
    for (const isVisible of [true, false, true]) {
      const before = await eventOf(id)
      expect((await save(director, id, { isVisible })).status, String(isVisible)).toBe(200)
      expect(changed(before, await eventOf(id)), String(isVisible)).toEqual(['is_visible'])
    }
    expect((await logOf('tournament_publish', id)).map((r) => r.actor_id)).toEqual([director, director])
    expect((await logOf('tournament_unpublish', id)).map((r) => r.actor_id)).toEqual([director])
  })
})

describe('with CREATION_ROLES_ON set, the table\'s rows on the membership switch and on publishing, grant by grant', () => {
  beforeEach(() => {
    flags.rolesOn = true
    // The standing director's publish sends D22's notice to every LCA admin
    // the file has seeded by then, 400 ms apart (WS08 step 6). Here
    // setTimeout calls back on the next microtask, so the waits take no time.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
      queueMicrotask(callback)
      return 0
    }) as unknown as typeof setTimeout)
  })

  /** Today's refusal of the membership switch for anyone but an LCA admin and the organizing club's rep. */
  const MEMBERSHIP_WORDS = "Only the organizing club's rep or an LCA admin can change whether an LCA membership is required"

  it('an LCA admin switches on a club\'s draft and on an LCA-run one, the club\'s rep on its club\'s draft, a rep who holds the seat on its club\'s draft but not on the LCA-run draft it made; the president, a standing director and a one-event director never; every one of them publishes what they run, and another club\'s rep runs nothing', async () => {
    const club = await seedClub()
    const otherClub = await seedClub()
    const admin = await seedAdmin()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const seatedRep = await seatedAs('club_rep', club)
    const president = await seatedAs('lca_observer')
    const standing = await seedMember({ role: 'tournament_director' })
    const oneEvent = await seedMember()
    const otherRep = await seedMember({ role: 'club_rep', clubId: otherClub })

    /** A hidden draft of the club's (made by its rep) or LCA-run (made through the create, or seeded for the seated rep). */
    const clubDraft = () => draftBy(rep)
    const seatedLcaRun = async () => {
      const id = await seedTournament({ isVisible: false, createdBy: seatedRep, clubId: null })
      await seedTournamentDirector(id, seatedRep)
      return id
    }
    const presidentsDraftDirectedBy = async (member: string) => {
      const id = await draftBy(president)
      expect((await name(president, id, member)).status).toBe(201)
      return id
    }
    const cases: ReadonlyArray<readonly [string, string, () => Promise<string>, 200 | 'membership' | 'forbidden', 200 | 'forbidden']> = [
      ['an LCA admin, the club\'s draft', admin, clubDraft, 200, 200],
      ['an LCA admin, an LCA-run draft', admin, () => draftBy(admin), 200, 200],
      ['the club\'s rep, its club\'s draft', rep, clubDraft, 200, 200],
      ['the rep who holds the seat, its club\'s draft', seatedRep, () => draftBy(seatedRep), 200, 200],
      ['the rep who holds the seat, the LCA-run draft it made', seatedRep, seatedLcaRun, 'membership', 200],
      ['the president, their own draft', president, () => draftBy(president), 'membership', 200],
      ['a standing director, their own draft', standing, () => draftBy(standing), 'membership', 200],
      ['a one-event director, the president\'s draft', oneEvent, () => presidentsDraftDirectedBy(oneEvent), 'membership', 200],
      ['another club\'s rep, the club\'s draft', otherRep, clubDraft, 'forbidden', 'forbidden'],
    ]
    for (const [label, as, make, membership, publish] of cases) {
      const id = await make()
      const before = await eventOf(id)
      // The switch as it stands, so a save let through changes nothing; the refusal is the gate's.
      const switched = await save(as, id, { requiresLcaMembership: before?.requires_lca_membership === 1 })
      const refusal = membership === 'membership' ? MEMBERSHIP_WORDS : 'Forbidden'
      if (membership === 200) expect(switched.status, label).toBe(200)
      else expect([switched.status, await switched.json()], label).toEqual([403, { error: refusal }])
      expect(await eventOf(id), label).toEqual(before)

      const published = await save(as, id, { isVisible: true })
      if (publish === 200) {
        expect(published.status, label).toBe(200)
        // A standing director's first publish also sets the review mark, D22's notice to the LCA admins (WS08 step 6).
        expect(changed(before, await eventOf(id)), label).toEqual(as === standing ? ['is_visible', 'review_notified_at'] : ['is_visible'])
        expect(await logOf('tournament_publish', id), label).toEqual([{ actor_id: as, target_member_id: null }])
      } else {
        expect([published.status, await published.json()], label).toEqual([403, { error: 'Forbidden' }])
        expect(await eventOf(id), label).toEqual(before)
      }
    }
  })
})
