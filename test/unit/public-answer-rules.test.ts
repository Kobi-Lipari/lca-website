// test/unit/public-answer-rules.test.ts
//
// The rules of the Phase 0 trim of the public answers, case by case and
// with no database (brief section 4; D15, D29):
// - the list's manager rule, eventsManagedBy, names exactly the events the
//   detail's own rule names (an observer, or canManageTournament), for every
//   role, guests included, each way the viewer's club can stand to the
//   event's, with and without an assignment; and a hand-written table holds
//   the answers themselves, so the two rules cannot agree on a wrong one;
// - publicTournamentAnswer takes out the three keys by their exact names,
//   keeps a manager's stored nulls, keeps the other keys in their order,
//   and gives the same answer when it is applied again;
// - the contracts still check the three when they are there (optional is not
//   "anything"), on the list row and the detail alike; the club page's
//   contact_email is an address or null when present; and an officer is
//   exactly an id, a role and a name.
import { describe, expect, it } from 'vitest'
import type { MemberRow } from '../../functions/types'
import { MEMBER_ROLES, canManageTournament } from '../../functions/utils/admin/permissions'
import { isObserver } from '../../functions/utils/auth'
import { eventsManagedBy, publicTournamentAnswer } from '../../functions/utils/events/publicAnswer'
import { clubDetailResponseSchema, tournamentDetailSchema, tournamentListItemSchema } from '../../domain/contracts'

// ── A stand-in for the database ──────────────────────────────────────

interface World {
  /** Each event's organizing club. */
  clubOf: Record<string, string | null>
  /** Who is assigned to direct which event. */
  directs: Array<{ tournamentId: string; memberId: string }>
}

/** The three reads the two rules make, answered from `world`; any other read fails the test. */
function worldDb(world: World) {
  const reads: string[] = []
  const db = {
    prepare(sql: string) {
      const text = sql.replace(/\s+/g, ' ').trim()
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              reads.push(text)
              if (text === 'SELECT club_id FROM tournaments WHERE id = ?') {
                const id = String(args[0])
                return id in world.clubOf ? { club_id: world.clubOf[id] } : null
              }
              if (text === 'SELECT 1 FROM tournament_directors WHERE tournament_id = ? AND member_id = ?') {
                return world.directs.some((d) => d.tournamentId === args[0] && d.memberId === args[1]) ? { 1: 1 } : null
              }
              throw new Error(`a read neither rule makes: ${text}`)
            },
            async all() {
              reads.push(text)
              if (text === 'SELECT tournament_id FROM tournament_directors WHERE member_id = ?') {
                return { results: world.directs.filter((d) => d.memberId === args[0]).map((d) => ({ tournament_id: d.tournamentId })) }
              }
              throw new Error(`a read neither rule makes: ${text}`)
            },
          }
        },
      }
    },
  }
  return { db: db as unknown as D1Database, reads }
}

const ROLES: string[] = [...MEMBER_ROLES, 'guest']
const VIEWER_CLUBS = ['bayou', 'delta', null] as const
const EVENT_CLUBS = ['bayou', null] as const

/** Both rules' answers for one viewer and one event. */
async function bothRules(role: string, clubId: string | null, eventClub: string | null, assigned: boolean) {
  const world: World = { clubOf: { e1: eventClub }, directs: assigned ? [{ tournamentId: 'e1', memberId: 'm1' }] : [] }
  const member = { id: 'm1', role, club_id: clubId } as unknown as MemberRow
  const detail = isObserver(member) || await canManageTournament(worldDb(world).db, member, 'e1')
  const list = (await eventsManagedBy(worldDb(world).db, { role, id: 'm1', clubId }))({ id: 'e1', club_id: eventClub })
  return { detail, list }
}

describe('the list\'s manager rule is the detail\'s', () => {
  it('for every role, guests included, every club the viewer may hold, both kinds of event, with and without an assignment', async () => {
    let cases = 0
    let managed = 0
    for (const role of ROLES) {
      for (const clubId of VIEWER_CLUBS) {
        for (const eventClub of EVENT_CLUBS) {
          for (const assigned of [false, true]) {
            const { detail, list } = await bothRules(role, clubId, eventClub, assigned)
            expect(list, `${role} of ${String(clubId)}, an event of ${String(eventClub)}, ${assigned ? 'assigned' : 'not assigned'}`).toBe(detail)
            cases += 1
            if (list) managed += 1
          }
        }
      }
    }
    expect(cases).toBe(ROLES.length * VIEWER_CLUBS.length * EVENT_CLUBS.length * 2)
    expect(managed).toBeGreaterThan(0)
    expect(managed).toBeLessThan(cases)
  })

  it.each([
    ['an LCA admin, unassigned, of no club', 'lca_admin', null, 'bayou', false, true],
    ['an observer, unassigned', 'lca_observer', null, 'bayou', false, true],
    ['an officer, unassigned', 'lca_officer', 'delta', null, false, true],
    ['the organizing club\'s rep', 'club_rep', 'bayou', 'bayou', false, true],
    ['another club\'s rep', 'club_rep', 'delta', 'bayou', false, false],
    ['another club\'s rep assigned to direct it', 'club_rep', 'delta', 'bayou', true, true],
    ['a rep of no club, for an event of no club', 'club_rep', null, null, false, false],
    ['a director of the organizing club, unassigned', 'tournament_director', 'bayou', 'bayou', false, false],
    ['a plain member assigned to direct it', 'member', null, 'bayou', true, true],
    ['a member of the organizing club, unassigned', 'member', 'bayou', 'bayou', false, false],
    ['an auditor, unassigned', 'lca_auditor', 'bayou', 'bayou', false, false],
    ['a guest assigned to direct it', 'guest', 'bayou', 'bayou', true, false],
  ] as const)('%s', async (_label, role, clubId, eventClub, assigned, manages) => {
    const { detail, list } = await bothRules(role, clubId, eventClub, assigned)
    expect(list).toBe(manages)
    expect(detail).toBe(manages)
  })

  it('makes no read for someone signed out, an admin, an observer or a guest, and one for anyone else, whatever they direct', async () => {
    const world: World = { clubOf: {}, directs: [{ tournamentId: 'e1', memberId: 'm1' }, { tournamentId: 'e2', memberId: 'm1' }] }
    for (const [viewer, reads] of [
      [null, 0],
      [{ role: 'lca_admin', id: 'm1', clubId: null }, 0],
      [{ role: 'lca_observer', id: 'm1', clubId: null }, 0],
      [{ role: 'lca_officer', id: 'm1', clubId: null }, 0],
      [{ role: 'guest', id: 'm1', clubId: null }, 0],
      [{ role: 'member', id: 'm1', clubId: null }, 1],
      [{ role: 'club_rep', id: 'm1', clubId: 'bayou' }, 1],
      [{ role: 'lca_auditor', id: 'm1', clubId: null }, 1],
    ] as const) {
      const stand = worldDb(world)
      const manages = await eventsManagedBy(stand.db, viewer)
      for (const id of ['e1', 'e2', 'e3']) manages({ id, club_id: 'bayou' })
      expect(stand.reads, JSON.stringify(viewer)).toHaveLength(reads)
    }
  })
})

// ── The strip ────────────────────────────────────────────────────────

/** A tournament answer as toTournamentResponse makes it, cut down: the three, a column named like one of them, and the rest. */
const answer = () => ({
  id: 't1',
  name: 'Bayou Fall Open',
  created_by: null as string | null,
  created_at: '2026-10-01 12:00:00',
  club_id: 'bayou',
  keep_apart: 'family',
  report_settings: null as string | null,
  status: 'upcoming',
  sections: [{ name: 'Open', entryFee: 25 }],
})

describe('publicTournamentAnswer', () => {
  it('takes out the three by their exact names, keeping created_at, whose name starts the same, and every other key in its order', () => {
    const trimmed = publicTournamentAnswer(answer(), false)
    expect(Object.keys(trimmed)).toEqual(['id', 'name', 'created_at', 'club_id', 'status', 'sections'])
    expect(trimmed).toEqual({ id: 't1', name: 'Bayou Fall Open', created_at: '2026-10-01 12:00:00', club_id: 'bayou', status: 'upcoming', sections: [{ name: 'Open', entryFee: 25 }] })
  })

  it('keeps a manager\'s stored nulls as keys that are there, not keys left out', () => {
    const kept = publicTournamentAnswer(answer(), true)
    for (const key of ['created_by', 'keep_apart', 'report_settings']) expect(Object.hasOwn(kept, key), key).toBe(true)
    expect(JSON.parse(JSON.stringify(kept))).toMatchObject({ created_by: null, keep_apart: 'family', report_settings: null })
  })

  it('gives the same answer applied again, so an answer trimmed twice is an answer trimmed once', () => {
    const once = publicTournamentAnswer(answer(), false)
    expect(publicTournamentAnswer(once, false)).toEqual(once)
    expect(publicTournamentAnswer(publicTournamentAnswer(answer(), true), true)).toEqual(answer())
  })

  it('leaves no trace of the three in the text a visitor is sent', () => {
    const text = JSON.stringify(publicTournamentAnswer({ ...answer(), created_by: 'mem-9', report_settings: '{"affiliateId":"A6000001"}' }, false))
    for (const word of ['created_by', 'keep_apart', 'report_settings', 'mem-9', 'A6000001']) expect(text, word).not.toContain(word)
  })
})

// ── The contracts ────────────────────────────────────────────────────

/** A schema's shape, as the tests below read it. */
type Shape = Record<string, { safeParse: (value: unknown) => { success: boolean } }>

describe('the contracts check the three when they are there', () => {
  const schemas: Array<[string, Shape]> = [
    ['the public list row', tournamentListItemSchema.shape as unknown as Shape],
    ['the public detail', tournamentDetailSchema.shape as unknown as Shape],
  ]

  it.each(schemas)('%s: each may be left out, takes its stored shape, and refuses any other', (_name, shape) => {
    const { created_by: createdBy, keep_apart: keepApart, report_settings: reportSettings } = shape
    for (const key of [createdBy, keepApart, reportSettings]) expect(key.safeParse(undefined).success).toBe(true)

    expect(createdBy.safeParse('mem-1').success).toBe(true)
    expect(createdBy.safeParse(null).success).toBe(true)
    expect(createdBy.safeParse('').success).toBe(false)
    expect(createdBy.safeParse(42).success).toBe(false)

    for (const value of ['family', 'family_club', 'none']) expect(keepApart.safeParse(value).success, value).toBe(true)
    expect(keepApart.safeParse(null).success).toBe(false)
    expect(keepApart.safeParse('everyone').success).toBe(false)

    expect(reportSettings.safeParse('{"affiliateId":"A6000001"}').success).toBe(true)
    expect(reportSettings.safeParse(null).success).toBe(true)
    expect(reportSettings.safeParse({ affiliateId: 'A6000001' }).success).toBe(false)
  })

  it('the club page\'s contact_email may be left out, and when there is an address or null', () => {
    const contactEmail = (clubDetailResponseSchema.shape.club.shape as unknown as Shape).contact_email
    expect(contactEmail.safeParse(undefined).success).toBe(true)
    expect(contactEmail.safeParse(null).success).toBe(true)
    expect(contactEmail.safeParse('club@example.org').success).toBe(true)
    expect(contactEmail.safeParse(42).success).toBe(false)
  })

  it('an officer on the club page is exactly an id, a role and a name: the admin\'s member_id and email are refused', () => {
    const officer = clubDetailResponseSchema.shape.officers.element
    expect(Object.keys(officer.shape).sort()).toEqual(['full_name', 'id', 'role'])
    const pat = { id: 'o1', role: 'President', full_name: 'Pat Officer' }
    expect(officer.safeParse(pat).success).toBe(true)
    expect(officer.safeParse({ ...pat, member_id: 'mem-1' }).success).toBe(false)
    expect(officer.safeParse({ ...pat, email: 'pat@example.org' }).success).toBe(false)
  })
})
