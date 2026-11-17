// test/unit/creation-marked-events.test.ts
//
// The fee rule on an event marked for an LCA admin's approval (WS09 step 17),
// as canChargeFees in domain/events/creation.ts gives it, with rolesOn passed
// as false and as true and never mocked:
// - on a marked event, approved or not, only an LCA admin and the club's own
//   rep may raise what an entrant pays; everyone else is refused, a director
//   a representative names included, in both states of rolesOn;
// - the mark counts only when it is the number 1, as mayList reads it, since
//   a database the migration has not reached answers the column's name as
//   text: text, true, 0, 2, null and a missing key mark nothing, and the
//   answer is then the one an unmarked event gets;
// - an event not marked answers as it did before the rule, for every grant;
// - the rule reads the event's club, not who drafted it.
// Every club and person here is made up.
import { describe, expect, it } from 'vitest'
import {
  canChargeFees,
  regionAlone,
  type CreationEvent,
  type CreationGrant,
  type CreationPerson,
} from '../../domain/events/creation'

const ME = 'member-player-one'
const SOMEONE = 'member-player-two'
const CLUB = 'club-example-chess'
const OTHER = 'club-example-rooks'
const STATES = [false, true] as const
const GRANTS: readonly CreationGrant[] = ['admin', 'president', 'standing_director', 'club_rep', 'regional_rep', 'none']

const person = (grant: CreationGrant, repClubId: string | null = null, regionClubIds: string[] = []): CreationPerson => ({ grant, memberId: ME, repClubId, regionClubIds })
const marked = (extra: Partial<CreationEvent> = {}): CreationEvent => ({ clubId: CLUB, createdBy: SOMEONE, needsLcaApproval: 1, ...extra })
const unmarked = (extra: Partial<CreationEvent> = {}): CreationEvent => ({ clubId: CLUB, createdBy: SOMEONE, ...extra })

describe('a raised fee on an event marked for approval', () => {
  it.each(STATES)('is refused everyone but an LCA admin and the club\'s own rep, rolesOn %s', (on) => {
    for (const grant of ['president', 'standing_director', 'regional_rep', 'none'] as const) {
      expect(canChargeFees(person(grant), marked(), on), grant).toBe(false)
    }
    // A club rep of another club is no more the event's rep than a director is.
    expect(canChargeFees(person('club_rep', OTHER), marked(), on)).toBe(false)
    expect(canChargeFees(person('admin'), marked(), on)).toBe(true)
    expect(canChargeFees(person('club_rep', CLUB), marked(), on)).toBe(true)
  })

  it.each(STATES)('keeps an LCA admin who holds a seat over the club charging, rolesOn %s', (on) => {
    expect(canChargeFees(person('admin', null, [CLUB]), marked(), on)).toBe(true)
  })

  it.each(STATES)('is refused the club\'s own rep only as the region\'s representative of another club, rolesOn %s', (on) => {
    const rep = person('club_rep', CLUB, [CLUB, OTHER])
    expect(canChargeFees(rep, marked({ clubId: CLUB }), on)).toBe(true)
    expect(canChargeFees(rep, marked({ clubId: OTHER }), on)).toBe(false)
  })

  it.each(STATES)('does not depend on who drafted the event, rolesOn %s', (on) => {
    for (const createdBy of [ME, SOMEONE, null]) {
      expect(canChargeFees(person('standing_director'), marked({ createdBy }), on), String(createdBy)).toBe(false)
      expect(canChargeFees(person('admin'), marked({ createdBy }), on), String(createdBy)).toBe(true)
    }
  })

  it.each(STATES)('holds for an event whose club the person does not keep in a region, rolesOn %s', (on) => {
    expect(canChargeFees(person('standing_director', null, []), marked(), on)).toBe(false)
    expect(canChargeFees(person('standing_director', null, [CLUB]), marked(), on)).toBe(false)
  })
})

describe('the mark counts only as the number 1', () => {
  const NOT_MARKS: ReadonlyArray<[string, unknown]> = [
    ['the column\'s name as text', 'needs_lca_approval'],
    ['the text "1"', '1'],
    ['true', true],
    ['0', 0],
    ['2', 2],
    ['null', null],
    ['undefined', undefined],
  ]

  it.each(NOT_MARKS)('reads %s as not marked, and answers as an unmarked event does, in both states', (_label, value) => {
    for (const on of STATES) {
      for (const grant of GRANTS) {
        const asked = person(grant, grant === 'club_rep' ? CLUB : null)
        const event = { ...unmarked(), needsLcaApproval: value as number }
        expect(canChargeFees(asked, event, on), `${grant} ${on}`).toBe(canChargeFees(asked, unmarked(), on))
      }
    }
  })

  it('leaves a missing key as the create passes it, so the create asks nothing of the mark', () => {
    expect(canChargeFees(person('standing_director'), { clubId: CLUB, createdBy: ME }, false)).toBe(true)
    expect(canChargeFees(person('standing_director'), { clubId: CLUB, createdBy: ME }, true)).toBe(true)
  })
})

describe('an event not marked answers as before, for every grant', () => {
  it('lets everyone the manage check admits charge while rolesOn is false, but not a person whose standing is the region alone', () => {
    for (const grant of GRANTS) {
      expect(canChargeFees(person(grant), unmarked(), false), grant).toBe(true)
    }
    expect(canChargeFees(person('regional_rep', null, [CLUB]), unmarked(), false)).toBe(false)
    expect(canChargeFees(person('standing_director', null, [CLUB]), unmarked(), false)).toBe(false)
  })

  it('lets D24\'s list charge while rolesOn is true, and no one else', () => {
    for (const grant of ['admin', 'president', 'standing_director', 'club_rep'] as const) {
      expect(canChargeFees(person(grant, grant === 'club_rep' ? CLUB : null), unmarked(), true), grant).toBe(true)
    }
    for (const grant of ['regional_rep', 'none'] as const) {
      expect(canChargeFees(person(grant), unmarked(), true), grant).toBe(false)
    }
  })

  it('leaves an LCA-run event, which no representative marks, as before', () => {
    expect(canChargeFees(person('standing_director'), { clubId: null, createdBy: ME }, false)).toBe(true)
    expect(canChargeFees(person('standing_director'), { clubId: null, createdBy: ME }, true)).toBe(true)
  })
})

describe('regionAlone, which the create reads to mark the event', () => {
  it('is true for a club the person\'s seats keep and they neither administer nor run as its rep', () => {
    expect(regionAlone(person('regional_rep', null, [CLUB]), CLUB)).toBe(true)
    expect(regionAlone(person('standing_director', null, [CLUB]), CLUB)).toBe(true)
    expect(regionAlone(person('president', null, [CLUB]), CLUB)).toBe(true)
    expect(regionAlone(person('club_rep', OTHER, [CLUB, OTHER]), CLUB)).toBe(true)
  })

  it('is false for an LCA admin, the club\'s own rep, a club outside the region, an LCA-run event and a person with no seat', () => {
    expect(regionAlone(person('admin', null, [CLUB]), CLUB)).toBe(false)
    expect(regionAlone(person('club_rep', CLUB, [CLUB]), CLUB)).toBe(false)
    expect(regionAlone(person('regional_rep', null, [CLUB]), OTHER)).toBe(false)
    expect(regionAlone(person('regional_rep', null, [CLUB]), null)).toBe(false)
    expect(regionAlone(person('standing_director', null, []), CLUB)).toBe(false)
  })
})
