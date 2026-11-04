// test/integration/tournament-create-rules.test.ts
//
// D20 on the create (WS08 step 3): who may create is the creation rules'
// answer, asked about the club the request names, or a club rep's own club
// when it names none, and nothing else in POST /api/admin/tournaments
// decides it. Every person brief 1.4's table names, with and without a
// current term on the President seat, asks for an LCA-run event, a club's
// event and another club's event, with CREATION_ROLES_ON unset and set, and
// each answer is held to the table, written out below on its own, not read
// from the rules:
// - the answer is 201 exactly when canCreate (domain/events/creation.ts)
//   says yes for the person creationPerson reads and that club, with the one
//   exception the plan keeps: a club rep with no club is refused by today's
//   check, in today's words, whatever its seat;
// - a refusal carries the words of the first check that refuses, and
//   writes no event, no director row and no audit entry;
// - a create writes a hidden draft with its creator, the club it should
//   have, the membership requirement on for an LCA-run event and off for a
//   club's event that sends no value, the creator's director row for the
//   president and a standing director who is no club's rep and for no one
//   else, and the audit entry with the grant only while the constant is set.
// With canCreate made to refuse, every creator is refused with "Forbidden"
// and nothing is written, so no create gets past the rules; and the rules
// are asked about the club the event would have, with the constant the
// create read: a club rep's own club when it sends none, its seat or not,
// so they are never asked about an LCA-run event for a club rep.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module, and canCreate through a wrapper on the mocked rules
// module, which asks the real rule unless a case makes it refuse.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LCA_RUN_ONLY } from '../../domain/events/creation'
import { creationPerson, type GrantMember } from '../../functions/utils/events/creation'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { seedClub, seedMember, seedPresident } from './factories'
import { invoke, resetHarness } from './harness'

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

/** What the create asked canCreate, case by case, and whether a case makes it refuse. */
const rules = vi.hoisted(() => ({
  refuse: false,
  asked: [] as Array<{ grant: string; repClubId: string | null; clubId: string | null; rolesOn: boolean }>,
}))
vi.mock('../../domain/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../domain/events/creation')>()
  return {
    ...real,
    canCreate: (...args: Parameters<typeof real.canCreate>) => {
      const [person, clubId, rolesOn] = args
      rules.asked.push({ grant: person.grant, repClubId: person.repClubId, clubId, rolesOn })
      return !rules.refuse && real.canCreate(...args)
    },
  }
})

beforeEach(() => {
  resetHarness()
  rules.asked.length = 0
})
afterEach(() => {
  flags.rolesOn = false
  rules.refuse = false
  vi.restoreAllMocks()
})

/** The real rule, for the cross-check: the mocked module's canCreate only records what it is asked. */
const realRules = await vi.importActual<typeof import('../../domain/events/creation')>('../../domain/events/creation')

const STATES: ReadonlyArray<readonly [string, boolean]> = [['unset', false], ['set', true]]

const NOT_LINKED = 'Your account is not linked to a club yet. Ask an LCA admin to assign you one.'
const OTHER_CLUB = 'Club reps can only create tournaments for their club'

/** Who asks, as the brief's table names them: the role the account holds and whether it has a club. */
const PEOPLE: ReadonlyArray<readonly [string, string, boolean]> = [
  ['a plain member', 'member', false],
  ['an auditor', 'lca_auditor', false],
  ['an officer', 'lca_officer', false],
  ['an observer', 'lca_observer', false],
  ['a standing director', 'tournament_director', false],
  ['a club rep', 'club_rep', true],
  ['a club rep with no club', 'club_rep', false],
  ['an LCA admin', 'lca_admin', false],
]

/** The club a request names: none, the first club (a club rep's own), or a second club. */
type Choice = 'none' | 'first' | 'second'
const CHOICES: readonly Choice[] = ['none', 'first', 'second']

interface Outcome {
  status: 201 | 403
  error?: string
  club?: Choice
  directorRow?: boolean
  grant?: string
}

/**
 * What the table says for one request, written out on its own. The grant is
 * the brief's order: an LCA admin first; with the constant set, the seat,
 * whatever the role, then the tournament_director role; then a club rep with
 * a club; else none. A club rep keeps its own club's path whatever its grant
 * (Q2); the president and a standing director create LCA-run events only,
 * each as its first director (D20, Q37); an LCA admin creates for any club or
 * none; everyone else is refused.
 */
function expected(role: string, hasClub: boolean, seat: boolean, choice: Choice, rolesOn: boolean): Outcome {
  const grant = role === 'lca_admin' ? 'admin'
    : rolesOn && seat ? 'president'
      : rolesOn && role === 'tournament_director' ? 'standing_director'
        : role === 'club_rep' && hasClub ? 'club_rep'
          : 'none'
  if (role === 'club_rep') {
    if (!hasClub) return { status: 403, error: NOT_LINKED }
    if (choice === 'second') return { status: 403, error: OTHER_CLUB }
    return { status: 201, club: 'first', directorRow: false, grant }
  }
  if (grant === 'admin') return { status: 201, club: choice, directorRow: false, grant }
  if (grant === 'president' || grant === 'standing_director') {
    return choice === 'none' ? { status: 201, club: 'none', directorRow: true, grant } : { status: 403, error: LCA_RUN_ONLY }
  }
  return { status: 403, error: 'Forbidden' }
}

let seq = 0

async function memberRow(id: string): Promise<GrantMember> {
  const row = await env.DB.prepare('SELECT id, role, club_id FROM members WHERE id = ?').bind(id).first<GrantMember>()
  if (!row) throw new Error(`no member ${id}`)
  return row
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  return (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0
}

const probeBody = (name: string, clubId: string | null) => ({
  name, location: 'Kenner, LA', date: '2026-12-12', entryFee: 20, ...(clubId ? { clubId } : {}),
})

describe.each(STATES)('who may create, with CREATION_ROLES_ON %s: the rules\' answer and the table\'s (D20, Q2, Q37)', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it.each(PEOPLE)('%s, with and without the President seat, for an LCA-run event, a club and another club', async (who, role, hasClub) => {
    for (const seat of [false, true]) {
      for (const choice of CHOICES) {
        const first = await seedClub()
        const second = await seedClub()
        const clubOf: Record<Choice, string | null> = { none: null, first, second }
        const id = await seedMember({ role, clubId: hasClub ? first : null })
        if (seat) await seedPresident(id)
        const name = `Rules probe ${++seq}`
        const label = `${who}${seat ? ' who holds the President seat' : ''}, ${choice === 'none' ? 'an LCA-run event' : choice === 'first' ? (hasClub ? 'its own club' : 'a club') : 'another club'}`

        const res = await invoke(createTournament, { method: 'POST', as: id, body: probeBody(name, clubOf[choice]) })
        const want = expected(role, hasClub, seat, choice, rolesOn)
        expect(res.status, label).toBe(want.status)

        // The rules' answer for the person the create reads and the club the request names, or a club rep's own when it names none.
        const person = await creationPerson(env.DB, await memberRow(id), rolesOn)
        const rulesSay = realRules.canCreate(person, clubOf[choice] ?? person.repClubId, rolesOn)
        if (role === 'club_rep' && !hasClub) {
          // Today's check on a club rep with no club comes first, whatever the seat; only the seat with the constant set makes the rules say yes.
          expect(rulesSay, label).toBe(rolesOn && seat && choice === 'none')
        } else {
          expect(res.status === 201, label).toBe(rulesSay)
        }

        const events = (await env.DB.prepare('SELECT id, club_id, created_by, is_visible, requires_lca_membership FROM tournaments WHERE name = ?')
          .bind(name).all<{ id: string; club_id: string | null; created_by: string; is_visible: number; requires_lca_membership: number }>()).results
        if (want.status === 403) {
          expect(await res.json(), label).toEqual({ error: want.error })
          expect(events, label).toEqual([])
          expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE member_id = ?', id), label).toBe(0)
          expect(await count('SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = \'tournament_create\' AND target_label = ?', name), label).toBe(0)
          continue
        }
        const { tournament } = await res.json<{ tournament: { id: string } }>()
        const club = clubOf[want.club!]
        expect(events, label).toEqual([{ id: tournament.id, club_id: club, created_by: id, is_visible: 0, requires_lca_membership: club ? 0 : 1 }])
        const directors = (await env.DB.prepare('SELECT member_id FROM tournament_directors WHERE tournament_id = ?')
          .bind(tournament.id).all<{ member_id: string }>()).results.map((r) => r.member_id)
        expect(directors, label).toEqual(want.directorRow ? [id] : [])
        const audit = await env.DB.prepare('SELECT actor_id, detail FROM admin_audit_log WHERE action = \'tournament_create\' AND target_label = ?')
          .bind(name).all<{ actor_id: string; detail: string }>()
        expect(audit.results.map((r) => [r.actor_id, JSON.parse(r.detail)]), label).toEqual([
          [id, rolesOn ? { tournament_id: tournament.id, grant: want.grant } : { tournament_id: tournament.id }],
        ])
      }
    }
  })
})

describe.each(STATES)('the create asks the rules, with CREATION_ROLES_ON %s', (_state, rolesOn) => {
  beforeEach(() => {
    flags.rolesOn = rolesOn
  })

  it('with canCreate made to refuse, every creator is refused with "Forbidden", and nothing is written', async () => {
    rules.refuse = true
    const club = await seedClub()
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const creators: ReadonlyArray<readonly [string, string, string | null]> = [
      ['an LCA admin, for no club', await seedMember({ role: 'lca_admin' }), null],
      ['an LCA admin, for a club', await seedMember({ role: 'lca_admin' }), club],
      ['a club rep, for its own club', await seedMember({ role: 'club_rep', clubId: club }), null],
      ...(rolesOn
        ? [['a standing director', await seedMember({ role: 'tournament_director' }), null], ['the president', president, null]] as const
        : []),
    ]
    const events = await count('SELECT COUNT(*) AS n FROM tournaments')
    const rows = await count('SELECT COUNT(*) AS n FROM tournament_directors')
    for (const [who, id, clubId] of creators) {
      const res = await invoke(createTournament, { method: 'POST', as: id, body: probeBody(`Refused probe ${++seq}`, clubId) })
      expect(res.status, who).toBe(403)
      expect(await res.json(), who).toEqual({ error: 'Forbidden' })
    }
    expect(rules.asked).toHaveLength(creators.length)
    expect(await count('SELECT COUNT(*) AS n FROM tournaments')).toBe(events)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors')).toBe(rows)
  })

  it('asks about the club the event would have, with the constant it read: a club rep\'s own club when it sends none, its seat or not', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    const seatedRep = await seedMember({ role: 'club_rep', clubId: own })
    await seedPresident(seatedRep)
    const admin = await seedMember({ role: 'lca_admin' })
    const director = await seedMember({ role: 'tournament_director' })
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const asks: ReadonlyArray<readonly [string, string, string | null, { grant: string; repClubId: string | null; clubId: string | null } | null]> = [
      ['a club rep, sending no club', rep, null, { grant: 'club_rep', repClubId: own, clubId: own }],
      ['a club rep, naming its own club', rep, own, { grant: 'club_rep', repClubId: own, clubId: own }],
      ['a club rep who holds the seat, sending no club', seatedRep, null, { grant: rolesOn ? 'president' : 'club_rep', repClubId: own, clubId: own }],
      // Refused before the rules are asked: another club is the club rep's own refusal.
      ['a club rep, naming another club', rep, other, null],
      ['an LCA admin, for a club', admin, other, { grant: 'admin', repClubId: null, clubId: other }],
      ['an LCA admin, for no club', admin, null, { grant: 'admin', repClubId: null, clubId: null }],
      // With the constant unset, refused at the first check, before the rules are asked.
      ['a standing director, for no club', director, null, rolesOn ? { grant: 'standing_director', repClubId: null, clubId: null } : null],
      ['the president, for no club', president, null, rolesOn ? { grant: 'president', repClubId: null, clubId: null } : null],
    ]
    for (const [who, id, clubId, asked] of asks) {
      rules.asked.length = 0
      await invoke(createTournament, { method: 'POST', as: id, body: probeBody(`Asked probe ${++seq}`, clubId) })
      expect(rules.asked, who).toEqual(asked ? [{ ...asked, rolesOn }] : [])
    }
  })
})
