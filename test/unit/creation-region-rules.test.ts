// test/unit/creation-region-rules.test.ts
//
// The regional representative's cells of the creation rules in
// domain/events/creation.ts (WS09 step 16; criterion 14's grants, D21 and
// D24), each its own case, with rolesOn passed as false and as true and
// never mocked:
// - a person whose standing is the region alone creates for a club their
//   seats keep and for no club outside it, and never an LCA-run event;
//   names directors only on a club event in the region they drafted; and is
//   refused a fee above $0 with rolesOn false and with rolesOn true;
// - a club rep who also holds a seat keeps today's rule on their own club
//   and gets $0 only on another club in the region;
// - an LCA admin with a seat charges as today, and so does a president or a
//   standing director with a seat on an LCA-run event;
// - a person with no regionClubIds, as creationPerson gives everyone while
//   REGION_EVENTS_ON is unset, gets every answer an empty list gives, which
//   is today's answer for the same grant;
// - with rolesOn, a regional representative may delete their own
//   unpublished draft with no entries, as any creator who could create it
//   now may, and with rolesOn false only an LCA admin deletes.
// Every club and person here is made up.
import { describe, expect, it } from 'vitest'
import {
  canAssignDirectors,
  canChargeFees,
  canCreate,
  canDeleteDraft,
  type CreationEvent,
  type CreationGrant,
  type CreationPerson,
} from '../../domain/events/creation'

const ME = 'member-player-one'
const SOMEONE = 'member-player-two'
const OWN = 'club-example-chess'
const IN_REGION = 'club-example-knights'
const OUTSIDE = 'club-example-rooks'
const STATES = [false, true] as const

/** A person whose only standing is the seat, keeping two clubs. */
const regional: CreationPerson = { grant: 'regional_rep', memberId: ME, repClubId: null, regionClubIds: [OWN, IN_REGION] }
/** A club rep of OWN whose seat keeps OWN and IN_REGION. */
const repWithSeat: CreationPerson = { grant: 'club_rep', memberId: ME, repClubId: OWN, regionClubIds: [OWN, IN_REGION] }
/** An LCA admin whose seat keeps the same two clubs. */
const adminWithSeat: CreationPerson = { grant: 'admin', memberId: ME, repClubId: null, regionClubIds: [OWN, IN_REGION] }

const event = (clubId: string | null, createdBy: string | null = ME): CreationEvent => ({ clubId, createdBy })

describe('a person whose standing is the region alone', () => {
  it('creates for a club in the region, in both states', () => {
    for (const on of STATES) {
      expect(canCreate(regional, OWN, on), String(on)).toBe(true)
      expect(canCreate(regional, IN_REGION, on), String(on)).toBe(true)
    }
  })

  it('does not create for a club outside the region', () => {
    for (const on of STATES) expect(canCreate(regional, OUTSIDE, on), String(on)).toBe(false)
  })

  it('does not create an LCA-run event', () => {
    for (const on of STATES) expect(canCreate(regional, null, on), String(on)).toBe(false)
  })

  it('names directors on a club event in the region it drafted', () => {
    for (const on of STATES) expect(canAssignDirectors(regional, event(IN_REGION, ME), on), String(on)).toBe(true)
  })

  it('does not name directors on a club event in the region someone else drafted, or that no one known drafted', () => {
    for (const on of STATES) {
      expect(canAssignDirectors(regional, event(IN_REGION, SOMEONE), on), String(on)).toBe(false)
      expect(canAssignDirectors(regional, event(IN_REGION, null), on), String(on)).toBe(false)
    }
  })

  it('does not name directors on its own draft outside the region, or on an LCA-run event it made', () => {
    for (const on of STATES) {
      expect(canAssignDirectors(regional, event(OUTSIDE, ME), on), String(on)).toBe(false)
      expect(canAssignDirectors(regional, event(null, ME), on), String(on)).toBe(false)
    }
  })

  it('is refused a fee above $0 on a club event in the region with CREATION_ROLES_ON unset', () => {
    expect(canChargeFees(regional, event(IN_REGION), false)).toBe(false)
    expect(canChargeFees(regional, event(OWN, SOMEONE), false)).toBe(false)
  })

  it('is refused a fee above $0 on a club event in the region with CREATION_ROLES_ON set', () => {
    expect(canChargeFees(regional, event(IN_REGION), true)).toBe(false)
    expect(canChargeFees(regional, event(OWN, SOMEONE), true)).toBe(false)
  })

  it('elsewhere answers the fee as its grant does today: everyone with rolesOn false, D24\'s list alone with rolesOn true, which holds no representative', () => {
    for (const clubId of [OUTSIDE, null]) {
      expect(canChargeFees(regional, event(clubId), false), String(clubId)).toBe(true)
      expect(canChargeFees(regional, event(clubId), true), String(clubId)).toBe(false)
    }
  })

  it('reads the same for the grant none beside the same clubs: the rules read the clubs, not the grant\'s name', () => {
    const named: CreationPerson = { ...regional, grant: 'none' }
    for (const on of STATES) {
      for (const clubId of [OWN, IN_REGION, OUTSIDE, null]) {
        expect(canCreate(named, clubId, on), `${clubId}, ${on}`).toBe(canCreate(regional, clubId, on))
        expect(canAssignDirectors(named, event(clubId), on), `${clubId}, ${on}`).toBe(canAssignDirectors(regional, event(clubId), on))
      }
      expect(canChargeFees(named, event(IN_REGION), on), String(on)).toBe(false)
    }
  })
})

describe('a club rep who also holds a seat', () => {
  it('keeps today\'s rule on its own club: creates, names directors on any of its events and charges, in both states', () => {
    for (const on of STATES) {
      expect(canCreate(repWithSeat, OWN, on), String(on)).toBe(true)
      expect(canAssignDirectors(repWithSeat, event(OWN, SOMEONE), on), String(on)).toBe(true)
      expect(canChargeFees(repWithSeat, event(OWN, SOMEONE), on), String(on)).toBe(true)
      expect(canChargeFees(repWithSeat, event(OWN), on), String(on)).toBe(true)
    }
  })

  it('gets $0 only on another club in the region, in both states', () => {
    for (const on of STATES) {
      expect(canChargeFees(repWithSeat, event(IN_REGION), on), String(on)).toBe(false)
      expect(canChargeFees(repWithSeat, event(IN_REGION, SOMEONE), on), String(on)).toBe(false)
    }
  })

  it('creates for another club in the region, and names directors there only on its own draft', () => {
    for (const on of STATES) {
      expect(canCreate(repWithSeat, IN_REGION, on), String(on)).toBe(true)
      expect(canAssignDirectors(repWithSeat, event(IN_REGION, ME), on), String(on)).toBe(true)
      expect(canAssignDirectors(repWithSeat, event(IN_REGION, SOMEONE), on), String(on)).toBe(false)
    }
  })

  it('gains nothing outside the region from the seat', () => {
    for (const on of STATES) {
      expect(canCreate(repWithSeat, OUTSIDE, on), String(on)).toBe(false)
      expect(canAssignDirectors(repWithSeat, event(OUTSIDE, ME), on), String(on)).toBe(false)
      expect(canChargeFees(repWithSeat, event(OUTSIDE), on), String(on)).toBe(true)
    }
  })
})

describe('an LCA admin with a seat', () => {
  it('charges as today on every club and on an LCA-run event, in both states', () => {
    for (const on of STATES) {
      for (const clubId of [OWN, IN_REGION, OUTSIDE, null]) expect(canChargeFees(adminWithSeat, event(clubId, SOMEONE), on), `${clubId}, ${on}`).toBe(true)
    }
  })

  it('creates and names directors everywhere, as today', () => {
    for (const on of STATES) {
      for (const clubId of [OWN, IN_REGION, OUTSIDE, null]) {
        expect(canCreate(adminWithSeat, clubId, on), `${clubId}, ${on}`).toBe(true)
        expect(canAssignDirectors(adminWithSeat, event(clubId, SOMEONE), on), `${clubId}, ${on}`).toBe(true)
      }
    }
  })
})

describe('a president or a standing director with a seat', () => {
  it('charges on an LCA-run event as today, and gets $0 on a club in the region', () => {
    for (const grant of ['president', 'standing_director'] as const) {
      const person: CreationPerson = { grant, memberId: ME, repClubId: null, regionClubIds: [IN_REGION] }
      for (const on of STATES) {
        expect(canChargeFees(person, event(null), on), `${grant}, ${on}`).toBe(true)
        expect(canChargeFees(person, event(IN_REGION), on), `${grant}, ${on}`).toBe(false)
      }
    }
  })
})

describe('with no regionClubIds, as every person reads while REGION_EVENTS_ON is unset', () => {
  const GRANTS: readonly CreationGrant[] = ['admin', 'president', 'standing_director', 'club_rep', 'regional_rep', 'none']
  const EVENTS: readonly CreationEvent[] = [OWN, IN_REGION, OUTSIDE, null].flatMap((clubId) => [ME, SOMEONE, null].map((createdBy) => ({ clubId, createdBy })))

  it('answers every rule as an empty list does, for every grant, club, creator and state', () => {
    for (const grant of GRANTS) {
      for (const repClubId of [null, OWN]) {
        const absent: CreationPerson = { grant, memberId: ME, repClubId }
        const empty: CreationPerson = { ...absent, regionClubIds: [] }
        for (const on of STATES) {
          for (const e of EVENTS) {
            const label = `${grant}, rep of ${repClubId}, ${e.clubId} by ${e.createdBy}, ${on}`
            expect(canCreate(absent, e.clubId, on), label).toBe(canCreate(empty, e.clubId, on))
            expect(canChargeFees(absent, e, on), label).toBe(canChargeFees(empty, e, on))
            expect(canAssignDirectors(absent, e, on), label).toBe(canAssignDirectors(empty, e, on))
            for (const isVisible of [0, 1]) {
              expect(canDeleteDraft(absent, { ...e, isVisible, entries: 0 }, on), label).toBe(canDeleteDraft(empty, { ...e, isVisible, entries: 0 }, on))
            }
          }
        }
      }
    }
  })

  it('gives the regional_rep name with no clubs nothing: no create, no naming, and the fee as the grant none has it', () => {
    const bare: CreationPerson = { grant: 'regional_rep', memberId: ME, repClubId: null }
    const none: CreationPerson = { grant: 'none', memberId: ME, repClubId: null }
    for (const on of STATES) {
      for (const e of EVENTS) {
        expect(canCreate(bare, e.clubId, on)).toBe(false)
        expect(canAssignDirectors(bare, e, on)).toBe(false)
        expect(canChargeFees(bare, e, on)).toBe(canChargeFees(none, e, on))
      }
    }
  })
})

describe('deleting a draft', () => {
  it('with rolesOn, lets a regional representative delete its own unpublished draft in the region with no entries, and nothing else', () => {
    expect(canDeleteDraft(regional, { ...event(IN_REGION, ME), isVisible: 0, entries: 0 }, true)).toBe(true)
    expect(canDeleteDraft(regional, { ...event(IN_REGION, ME), isVisible: 1, entries: 0 }, true)).toBe(false)
    expect(canDeleteDraft(regional, { ...event(IN_REGION, ME), isVisible: 0, entries: 1 }, true)).toBe(false)
    expect(canDeleteDraft(regional, { ...event(IN_REGION, SOMEONE), isVisible: 0, entries: 0 }, true)).toBe(false)
    expect(canDeleteDraft(regional, { ...event(OUTSIDE, ME), isVisible: 0, entries: 0 }, true)).toBe(false)
  })

  it('with rolesOn false, lets no one but an LCA admin delete, as today', () => {
    expect(canDeleteDraft(regional, { ...event(IN_REGION, ME), isVisible: 0, entries: 0 }, false)).toBe(false)
    expect(canDeleteDraft(adminWithSeat, { ...event(IN_REGION, SOMEONE), isVisible: 1, entries: 4 }, false)).toBe(true)
  })
})
