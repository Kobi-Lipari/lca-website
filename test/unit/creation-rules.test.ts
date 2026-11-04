// test/unit/creation-rules.test.ts
//
// The creation rules in domain/events/creation.ts, cell by cell of brief
// 1.4's table "Who may do what on an event" as the first part of WS08 builds
// it, grant by grant, with CREATION_ROLES_ON set and unset (rolesOn true and
// false): who may create (D20, Q2 and Q37), who may set an entry fee above $0
// (D24), who may name or remove an event's directors (D21) and who may delete
// a draft; that LCA's affiliate ID is allowed on every event now (D23); and
// when a save raises a fee, read as a rise in what an entrant pays at any
// tier. The database half, functions/utils/events/creation.ts, is held to its
// order here against a stand-in for the database, and on a D1 database built
// from the migrations in test/integration/creation-grant.test.ts.
import { describe, expect, it } from 'vitest'
import {
  canAssignDirectors,
  canChargeFees,
  canCreate,
  canDeleteDraft,
  feesRaised,
  FEES_NEED_PAYOUT_ACCOUNT,
  lcaAffiliateAllowed,
  LCA_RUN_ONLY,
  type CreationEvent,
  type CreationGrant,
  type CreationPerson,
} from '../../domain/events/creation'
import type { TierFees } from '../../domain/events/sections'
import { creationGrant, creationPerson, creatorGrant, holdsPresidentSeat, type GrantMember } from '../../functions/utils/events/creation'

const ME = 'member-me'
const SOMEONE = 'member-someone'
const CLUB = 'club-own'
const OTHER = 'club-other'

const person = (grant: CreationGrant, repClubId: string | null = null): CreationPerson => ({ grant, memberId: ME, repClubId })

const ADMIN = person('admin')
const PRESIDENT = person('president')
const STANDING = person('standing_director')
const REP = person('club_rep', CLUB)
/** A club rep who holds the President seat: the seat gives the grant, and the role keeps the club. */
const REP_PRESIDENT = person('president', CLUB)
const NONE = person('none')

const event = (clubId: string | null, createdBy: string | null): CreationEvent => ({ clubId, createdBy })
const draft = (clubId: string | null, createdBy: string | null, isVisible = 0, entries = 0) => ({ clubId, createdBy, isVisible, entries })

describe('canCreate: who may create an event, and for which club', () => {
  const CASES: ReadonlyArray<readonly [string, CreationPerson, string | null, boolean, boolean]> = [
    ['an LCA admin, an LCA-run event, unset', ADMIN, null, false, true],
    ['an LCA admin, a club event, unset', ADMIN, OTHER, false, true],
    ['an LCA admin, an LCA-run event, set', ADMIN, null, true, true],
    ['an LCA admin, a club event, set', ADMIN, OTHER, true, true],
    ['the president, an LCA-run event, set', PRESIDENT, null, true, true],
    ['the president, a club event, set: refused, LCA-run events only', PRESIDENT, CLUB, true, false],
    ['the president, an LCA-run event, unset: refused, as today', PRESIDENT, null, false, false],
    ['a standing director, an LCA-run event, set', STANDING, null, true, true],
    ['a standing director, a club event, set: refused, LCA-run events only (Q37)', STANDING, CLUB, true, false],
    ['a standing director, an LCA-run event, unset: refused, as today', STANDING, null, false, false],
    ['a club rep, its own club, unset', REP, CLUB, false, true],
    ['a club rep, its own club, set', REP, CLUB, true, true],
    ['a club rep, another club, unset', REP, OTHER, false, false],
    ['a club rep, another club, set', REP, OTHER, true, false],
    ['a club rep, an LCA-run event, unset', REP, null, false, false],
    ['a club rep, an LCA-run event, set', REP, null, true, false],
    ['a club rep who holds the seat, its own club, set', REP_PRESIDENT, CLUB, true, true],
    ['a club rep who holds the seat, an LCA-run event, set', REP_PRESIDENT, null, true, true],
    ['a club rep who holds the seat, another club, set', REP_PRESIDENT, OTHER, true, false],
    ['no grant, an LCA-run event, set', NONE, null, true, false],
    ['no grant, a club event, set', NONE, CLUB, true, false],
    ['no grant, an LCA-run event, unset', NONE, null, false, false],
  ]

  it.each(CASES)('%s', (_who, who, clubId, rolesOn, expected) => {
    expect(canCreate(who, clubId, rolesOn)).toBe(expected)
  })

  it('says why a standing director or the president is refused a club, in plain words', () => {
    expect(LCA_RUN_ONLY).toBe('Standing directors and the president create LCA-run events, not a club\'s.')
  })
})

describe('canChargeFees: who may set an entry fee above $0 (D24)', () => {
  /** Each grant, and whether it may with the constant set: D24's list, LCA admins, the president, standing directors and club reps. */
  const EVERYONE: ReadonlyArray<readonly [string, CreationPerson, boolean]> = [
    ['an LCA admin', ADMIN, true],
    ['the president', PRESIDENT, true],
    ['a standing director', STANDING, true],
    ['a club rep', REP, true],
    ['a club rep who holds the seat', REP_PRESIDENT, true],
    ['no grant', NONE, false],
  ]
  const ANY_EVENT = event(null, SOMEONE)

  it.each(EVERYONE)('%s may with the constant unset, as today', (_who, who) => {
    expect(canChargeFees(who, ANY_EVENT, false)).toBe(true)
  })

  it.each(EVERYONE)('%s, with the constant set, only if on D24\'s list', (_who, who, mayCharge) => {
    expect(canChargeFees(who, ANY_EVENT, true)).toBe(mayCharge)
  })

  it('reads the event for nothing yet: the same answer on a club event, an LCA-run event and one the person created', () => {
    for (const on of [event(CLUB, SOMEONE), event(null, SOMEONE), event(null, ME), event(OTHER, null)]) {
      expect(canChargeFees(NONE, on, true)).toBe(false)
      expect(canChargeFees(STANDING, on, true)).toBe(true)
      expect(canChargeFees(NONE, on, false)).toBe(true)
    }
  })

  it('refuses a raise in plain words: G1\'s title and its last sentence', () => {
    expect(FEES_NEED_PAYOUT_ACCOUNT).toBe('Entry fees need a payout account first. Until then, your event can run at $0.')
  })
})

describe('canAssignDirectors: who may name or remove an event\'s directors (D21)', () => {
  const CASES: ReadonlyArray<readonly [string, CreationPerson, CreationEvent, boolean, boolean]> = [
    ['an LCA admin, an LCA-run event someone else created, unset', ADMIN, event(null, SOMEONE), false, true],
    ['an LCA admin, a club event someone else created, set', ADMIN, event(OTHER, SOMEONE), true, true],
    ['a club rep, its own club\'s event, unset', REP, event(CLUB, SOMEONE), false, true],
    ['a club rep, its own club\'s event, set', REP, event(CLUB, SOMEONE), true, true],
    ['a club rep, another club\'s event, set', REP, event(OTHER, SOMEONE), true, false],
    ['a club rep, an LCA-run event it created, set', REP, event(null, ME), true, false],
    ['a club rep who holds the seat, its own club\'s event someone else created, set', REP_PRESIDENT, event(CLUB, SOMEONE), true, true],
    ['a club rep who holds the seat, its own club\'s event, unset', REP_PRESIDENT, event(CLUB, SOMEONE), false, true],
    ['the president, an event the president created, set', PRESIDENT, event(null, ME), true, true],
    ['the president, an event the president created, unset', PRESIDENT, event(null, ME), false, false],
    ['the president, an event someone else created, set', PRESIDENT, event(null, SOMEONE), true, false],
    ['the president, a club event someone else created, set', PRESIDENT, event(CLUB, SOMEONE), true, false],
    ['a standing director, an event they created, set: never', STANDING, event(null, ME), true, false],
    ['no grant, an event they created, set', NONE, event(null, ME), true, false],
  ]

  it.each(CASES)('%s', (_who, who, on, rolesOn, expected) => {
    expect(canAssignDirectors(who, on, rolesOn)).toBe(expected)
  })
})

describe('canDeleteDraft: who may delete an event', () => {
  const CASES: ReadonlyArray<readonly [string, CreationPerson, ReturnType<typeof draft>, boolean, boolean]> = [
    ['an LCA admin, a published event with entries someone else created, unset', ADMIN, draft(null, SOMEONE, 1, 4), false, true],
    ['an LCA admin, a published event with entries someone else created, set', ADMIN, draft(CLUB, SOMEONE, 1, 4), true, true],
    ['a standing director, their unpublished draft with no entries, set', STANDING, draft(null, ME), true, true],
    ['the president, their unpublished draft with no entries, set', PRESIDENT, draft(null, ME), true, true],
    ['a club rep, its own club\'s draft it created, set', REP, draft(CLUB, ME), true, true],
    ['a club rep who holds the seat, its own club\'s draft it created, set', REP_PRESIDENT, draft(CLUB, ME), true, true],
    ['a standing director, their draft once published, set', STANDING, draft(null, ME, 1, 0), true, false],
    ['a standing director, their draft once it has an entry, set', STANDING, draft(null, ME, 0, 1), true, false],
    ['a creator whose grant is gone, set', NONE, draft(null, ME), true, false],
    ['a former club rep, the club\'s draft they created, set', person('none'), draft(CLUB, ME), true, false],
    ['a club rep who became a standing director, the club\'s draft they created as its rep, set', STANDING, draft(CLUB, ME), true, false],
    ['a standing director, a draft someone else created, set', STANDING, draft(null, SOMEONE), true, false],
    ['a standing director, their unpublished draft with no entries, unset: only an LCA admin, as today', STANDING, draft(null, ME), false, false],
    ['a club rep, its own club\'s draft it created, unset: only an LCA admin, as today', REP, draft(CLUB, ME), false, false],
  ]

  it.each(CASES)('%s', (_who, who, on, rolesOn, expected) => {
    expect(canDeleteDraft(who, on, rolesOn)).toBe(expected)
  })
})

describe('lcaAffiliateAllowed: LCA\'s affiliate ID on the rating report (D23)', () => {
  it.each([
    ['an LCA-run event', event(null, SOMEONE)],
    ['a club event', event(CLUB, SOMEONE)],
    ['an event whose creator is not known', event(null, null)],
  ] as const)('is allowed on %s, as on every event until Phase 4', (_what, on) => {
    expect(lcaAffiliateAllowed(on)).toBe(true)
  })
})

describe('feesRaised: a rise in what an entrant pays at any tier', () => {
  const fees = (regular: number, early: number | null = null, late: number | null = null): TierFees => ({ regular, early, late })
  const entry = (key: string, tiers: TierFees) => ({ key, fees: tiers })
  const BASE = [entry('event', fees(20)), entry('open', fees(20)), entry('u1200', fees(15))]

  const CASES: ReadonlyArray<readonly [string, ReadonlyArray<{ key: string; fees: TierFees }>, ReadonlyArray<{ key: string; fees: TierFees }>, boolean]> = [
    ['equal lists', BASE, BASE.map((e) => entry(e.key, { ...e.fees })), false],
    ['a regular price raised', BASE, [BASE[0], entry('open', fees(25)), BASE[2]], true],
    ['a regular price lowered', BASE, [BASE[0], entry('open', fees(15)), BASE[2]], false],
    ['an early price that appears below regular', BASE, [BASE[0], entry('open', fees(20, 15)), BASE[2]], false],
    ['an early price that appears above regular', BASE, [BASE[0], entry('open', fees(20, 25)), BASE[2]], true],
    ['a late price that appears above regular', BASE, [BASE[0], entry('open', fees(20, null, 25)), BASE[2]], true],
    ['a late price that appears below regular', BASE, [BASE[0], entry('open', fees(20, null, 15)), BASE[2]], false],
    ['a late price that was set and is now null', [entry('open', fees(20, null, 25))], [entry('open', fees(20))], false],
    ['a new section at $0', BASE, [...BASE, entry('new', fees(0))], false],
    ['a new section at $20', BASE, [...BASE, entry('new', fees(20))], true],
    ['a section removed from the list', BASE, [BASE[0], BASE[1]], false],
    ['an echoed list with every tier null', BASE, BASE.map((e) => entry(e.key, fees(e.fees.regular, null, null))), false],
    ['an early price that rises toward regular', [entry('open', fees(20, 15))], [entry('open', fees(20, 18))], true],
    ['a discount that grows', [entry('open', fees(20, 15))], [entry('open', fees(20, 10))], false],
    ['the event\'s own fee raised, every section as it was', BASE, [entry('event', fees(30)), BASE[1], BASE[2]], true],
    ['the same prices in another order', BASE, [BASE[2], BASE[0], BASE[1]], false],
  ]

  it.each(CASES)('%s', (_what, before, after, expected) => {
    expect(feesRaised(before, after)).toBe(expected)
  })
})

describe('the database half: the grant in its order, against a stand-in for the database', () => {
  type Db = Parameters<typeof holdsPresidentSeat>[0]

  /** A stand-in that knows the members who hold the President seat now and the events' creators, and keeps every statement it is asked. */
  function standIn(seatHolders: readonly string[] = [], creators: Readonly<Record<string, GrantMember>> = {}) {
    const asked: Array<{ sql: string; args: unknown[] }> = []
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            asked.push({ sql, args })
            if (sql.includes('board_seat_assignments')) return seatHolders.includes(String(args[0])) ? { 1: 1 } : null
            if (sql.includes('FROM tournaments t JOIN members m')) return creators[String(args[0])] ?? null
            throw new Error(`a statement the stand-in does not know: ${sql}`)
          },
        }),
      }),
    }
    return { db: db as unknown as Db, asked }
  }
  const member = (role: string, club_id: string | null = null): GrantMember => ({ id: ME, role, club_id })

  it('reads the President seat as a current assignment to the active seat whose slug is president', async () => {
    const { db, asked } = standIn([ME])
    expect(await holdsPresidentSeat(db, ME)).toBe(true)
    expect(await holdsPresidentSeat(db, SOMEONE)).toBe(false)
    expect(asked.map((a) => a.args)).toEqual([[ME], [SOMEONE]])
    const sql = asked[0].sql.replace(/\s+/g, ' ')
    for (const piece of ['FROM board_seat_assignments a', 'JOIN board_members s ON s.id = a.seat_id', 'a.member_id = ?', 'a.ended_at IS NULL', 's.is_active = 1', 's.slug = \'president\'', 'LIMIT 1']) {
      expect(sql, piece).toContain(piece)
    }
  })

  const GRANTS: ReadonlyArray<readonly [string, GrantMember, boolean, boolean, CreationGrant]> = [
    ['an LCA admin who holds the seat, set', member('lca_admin'), true, true, 'admin'],
    ['an LCA admin, unset', member('lca_admin'), false, false, 'admin'],
    ['an officer who holds the seat, set', member('lca_observer'), true, true, 'president'],
    ['an officer who holds the seat, unset', member('lca_observer'), true, false, 'none'],
    ['a tournament director who holds the seat, set: the seat wins', member('tournament_director'), true, true, 'president'],
    ['a tournament director, set', member('tournament_director'), false, true, 'standing_director'],
    ['a tournament director, unset', member('tournament_director'), false, false, 'none'],
    ['a club rep who holds the seat, set: the seat wins', member('club_rep', CLUB), true, true, 'president'],
    ['a club rep who holds the seat, unset', member('club_rep', CLUB), true, false, 'club_rep'],
    ['a club rep, set', member('club_rep', CLUB), false, true, 'club_rep'],
    ['a club rep with no club, set', member('club_rep'), false, true, 'none'],
    ['a member, set', member('member'), false, true, 'none'],
  ]

  it.each(GRANTS)('%s', async (_who, who, holdsSeat, rolesOn, expected) => {
    const { db } = standIn(holdsSeat ? [ME] : [])
    expect(await creationGrant(db, who, rolesOn)).toBe(expected)
  })

  it('never reads the seat with the constant unset, nor for an LCA admin', async () => {
    const { db, asked } = standIn([ME])
    for (const role of ['lca_observer', 'tournament_director', 'club_rep', 'member']) await creationGrant(db, member(role, CLUB), false)
    await creationGrant(db, member('lca_admin'), true)
    expect(asked).toEqual([])
  })

  it('keeps a club rep\'s club beside the grant, whatever the grant, and gives no one else a club', async () => {
    const { db } = standIn([ME])
    expect(await creationPerson(db, member('club_rep', CLUB), true)).toEqual({ grant: 'president', memberId: ME, repClubId: CLUB })
    expect(await creationPerson(db, member('club_rep', CLUB), false)).toEqual({ grant: 'club_rep', memberId: ME, repClubId: CLUB })
    expect(await creationPerson(db, member('tournament_director', CLUB), true)).toEqual({ grant: 'president', memberId: ME, repClubId: null })
    expect(await creationPerson(db, member('lca_admin', CLUB), true)).toEqual({ grant: 'admin', memberId: ME, repClubId: null })
  })

  it('reads the creator\'s grant now, by the event, and null when the event or its creator is missing', async () => {
    const { db, asked } = standIn([], { 't-1': { id: SOMEONE, role: 'tournament_director', club_id: null } })
    expect(await creatorGrant(db, 't-1', true)).toBe('standing_director')
    expect(await creatorGrant(db, 't-1', false)).toBe('none')
    expect(await creatorGrant(db, 't-missing', true)).toBeNull()
    expect(asked.filter((a) => a.sql.includes('FROM tournaments t')).map((a) => a.args)).toEqual([['t-1'], ['t-1'], ['t-missing']])
    // The seat is read for the creator, not for the member who asks.
    expect(asked.filter((a) => a.sql.includes('board_seat_assignments')).map((a) => a.args)).toEqual([[SOMEONE]])
  })
})
