// test/unit/creation-rules-matrix.test.ts
//
// The creation rules of domain/events/creation.ts asked about every person
// and every event at once, with CREATION_ROLES_ON unset and set (rolesOn
// false and true), and held to what the brief's table "Who may do what on
// an event" says for all of them, not cell by cell:
// - unset, each rule answers what today's handlers answer: an LCA admin
//   creates for any club or none, names any event's directors and deletes
//   any event; a club rep creates for its own club and names its own club's
//   directors; anyone the manage check admits may set a fee;
// - setting it only widens who may create, name directors and delete a
//   draft, and only narrows who may set a fee above $0, and what it widens
//   is the president's and the standing director's LCA-run events, the
//   president's naming on events the president created, and a creator's
//   delete of an unpublished draft with no entries;
// - set, the table's rows hold for every grant: a club's events are created
//   by an LCA admin and the club's own rep alone, an LCA-run event by an LCA
//   admin, the president and a standing director alone, a standing director
//   names no directors (D21), a creator deletes only their own unpublished
//   draft with no entries while the grant that let them create still holds,
//   and only D24's list sets a fee above $0, whatever the event;
// - a grant the rules do not know (WS09's representative, before it joins
//   D24's list) keeps a club rep's own rights and nothing else;
// - no rule changes the person or the event it is asked about, and every
//   rule takes rolesOn with no default.
import { describe, expect, it } from 'vitest'
import {
  canAssignDirectors,
  canChargeFees,
  canCreate,
  canDeleteDraft,
  feesRaised,
  lcaAffiliateAllowed,
  type CreationEvent,
  type CreationGrant,
  type CreationPerson,
} from '../../domain/events/creation'

const ME = 'member-me'
const SOMEONE = 'member-someone'
const OWN = 'club-own'
const OTHER = 'club-other'

const GRANTS: readonly CreationGrant[] = ['admin', 'president', 'standing_director', 'club_rep', 'none']
const STATES = [false, true] as const
/** Every person: each grant, alone or beside the club the person manages as its rep. */
const PEOPLE: readonly CreationPerson[] = GRANTS.flatMap((grant) => [null, OWN].map((repClubId) => ({ grant, memberId: ME, repClubId })))
/** Where an event belongs: LCA-run (no club), the person's own club, another club. */
const CLUBS = [null, OWN, OTHER] as const
/** Every event: each club, created by the person, by someone else, or by no one known. */
const EVENTS: readonly CreationEvent[] = CLUBS.flatMap((clubId) => [ME, SOMEONE, null].map((createdBy) => ({ clubId, createdBy })))
type Draft = CreationEvent & { isVisible: number; entries: number }
/** Every draft: each event, unpublished or published, with no entries, one or several. */
const DRAFTS: readonly Draft[] = EVENTS.flatMap((event) => [0, 1].flatMap((isVisible) => [0, 1, 4].map((entries) => ({ ...event, isVisible, entries }))))

const who = (p: CreationPerson) => (p.repClubId ? `${p.grant} beside the rep of ${p.repClubId}` : p.grant)
const where = (clubId: string | null) => clubId ?? 'an LCA-run event'
const what = (e: CreationEvent) => `${where(e.clubId)} created by ${e.createdBy ?? 'no one known'}`
const draftName = (d: Draft) => `${what(d)}, ${d.isVisible ? 'published' : 'unpublished'}, ${d.entries} entries`
const state = (on: boolean) => (on ? 'set' : 'unset')

describe('with CREATION_ROLES_ON unset, every rule answers as today', () => {
  it('canCreate: an LCA admin for any club or none, a club rep for its own club only, and no one else', () => {
    for (const p of PEOPLE) {
      for (const clubId of CLUBS) {
        const today = p.grant === 'admin' || (clubId !== null && clubId === p.repClubId)
        expect(canCreate(p, clubId, false), `${who(p)}, ${where(clubId)}`).toBe(today)
      }
    }
  })

  it('canAssignDirectors: an LCA admin on any event, a club rep on its own club\'s events, and no one else', () => {
    for (const p of PEOPLE) {
      for (const e of EVENTS) {
        const today = p.grant === 'admin' || (e.clubId !== null && e.clubId === p.repClubId)
        expect(canAssignDirectors(p, e, false), `${who(p)}, ${what(e)}`).toBe(today)
      }
    }
  })

  it('canDeleteDraft: an LCA admin alone, whatever the event, its creator included', () => {
    for (const p of PEOPLE) {
      for (const d of DRAFTS) expect(canDeleteDraft(p, d, false), `${who(p)}, ${draftName(d)}`).toBe(p.grant === 'admin')
    }
  })

  it('canChargeFees: everyone, since today anyone the manage check admits may set a fee', () => {
    for (const p of PEOPLE) {
      for (const e of EVENTS) expect(canChargeFees(p, e, false), `${who(p)}, ${what(e)}`).toBe(true)
    }
  })
})

describe('setting CREATION_ROLES_ON only widens creating, naming and deleting, and only narrows fees', () => {
  it('no one who may create, name directors or delete with it unset is refused once it is set', () => {
    for (const p of PEOPLE) {
      for (const clubId of CLUBS) if (canCreate(p, clubId, false)) expect(canCreate(p, clubId, true), `${who(p)}, ${where(clubId)}`).toBe(true)
      for (const e of EVENTS) if (canAssignDirectors(p, e, false)) expect(canAssignDirectors(p, e, true), `${who(p)}, ${what(e)}`).toBe(true)
      for (const d of DRAFTS) if (canDeleteDraft(p, d, false)) expect(canDeleteDraft(p, d, true), `${who(p)}, ${draftName(d)}`).toBe(true)
    }
  })

  it('no one refused a fee with it unset may set one once it is set', () => {
    for (const p of PEOPLE) {
      for (const e of EVENTS) if (!canChargeFees(p, e, false)) expect(canChargeFees(p, e, true), `${who(p)}, ${what(e)}`).toBe(false)
    }
  })

  it('what it widens: the president\'s and a standing director\'s LCA-run events, and nothing else on create', () => {
    const widened = PEOPLE.flatMap((p) => CLUBS.filter((c) => canCreate(p, c, true) && !canCreate(p, c, false)).map((c) => `${who(p)}, ${where(c)}`))
    expect(widened).toEqual([
      'president, an LCA-run event',
      `president beside the rep of ${OWN}, an LCA-run event`,
      'standing_director, an LCA-run event',
      `standing_director beside the rep of ${OWN}, an LCA-run event`,
    ])
  })

  it('what it widens: the president\'s naming on an event the president created, and nothing else on naming', () => {
    const widened = PEOPLE.flatMap((p) => EVENTS.filter((e) => canAssignDirectors(p, e, true) && !canAssignDirectors(p, e, false)).map((e) => `${who(p)}, ${what(e)}`))
    expect(widened).toEqual([
      `president, an LCA-run event created by ${ME}`,
      `president, ${OWN} created by ${ME}`,
      `president, ${OTHER} created by ${ME}`,
      `president beside the rep of ${OWN}, an LCA-run event created by ${ME}`,
      `president beside the rep of ${OWN}, ${OTHER} created by ${ME}`,
    ])
  })

  it('what it widens: a creator\'s delete of their own unpublished draft with no entries, and nothing else on delete', () => {
    for (const p of PEOPLE) {
      for (const d of DRAFTS) {
        if (!canDeleteDraft(p, d, true) || canDeleteDraft(p, d, false)) continue
        const name = `${who(p)}, ${draftName(d)}`
        expect(p.grant, name).not.toBe('admin')
        expect([d.createdBy, d.isVisible, d.entries], name).toEqual([ME, 0, 0])
      }
    }
  })

  it('what it narrows: the fee of a person with no grant, and no one else\'s', () => {
    const narrowed = PEOPLE.filter((p) => EVENTS.some((e) => canChargeFees(p, e, false) && !canChargeFees(p, e, true))).map(who)
    expect(narrowed).toEqual(['none', `none beside the rep of ${OWN}`])
  })
})

describe('with CREATION_ROLES_ON set, the table holds for every grant', () => {
  it('a club\'s event is created by an LCA admin or that club\'s own rep alone, in either state', () => {
    for (const p of PEOPLE) {
      for (const clubId of [OWN, OTHER]) {
        for (const on of STATES) {
          if (canCreate(p, clubId, on)) expect(p.grant === 'admin' || p.repClubId === clubId, `${who(p)}, ${clubId}, ${state(on)}`).toBe(true)
        }
      }
    }
  })

  it('an LCA-run event is created by an LCA admin, the president or a standing director alone, never a club rep for it', () => {
    for (const p of PEOPLE) {
      expect(canCreate(p, null, true), who(p)).toBe(['admin', 'president', 'standing_director'].includes(p.grant))
    }
  })

  it('a standing director names no event\'s directors (D21), and the president only those of an event the president created', () => {
    for (const e of EVENTS) {
      for (const on of STATES) {
        expect(canAssignDirectors({ grant: 'standing_director', memberId: ME, repClubId: null }, e, on), `${what(e)}, ${state(on)}`).toBe(false)
        expect(canAssignDirectors({ grant: 'president', memberId: ME, repClubId: null }, e, on), `${what(e)}, ${state(on)}`).toBe(on && e.createdBy === ME)
        expect(canAssignDirectors({ grant: 'none', memberId: ME, repClubId: null }, e, on), `${what(e)}, ${state(on)}`).toBe(false)
      }
    }
  })

  it('a club rep names its own club\'s directors whatever grant stands beside it, and never another club\'s or an LCA-run event\'s', () => {
    for (const grant of GRANTS) {
      const p: CreationPerson = { grant, memberId: ME, repClubId: OWN }
      for (const on of STATES) {
        expect(canAssignDirectors(p, { clubId: OWN, createdBy: SOMEONE }, on), `${grant}, ${state(on)}`).toBe(true)
        if (grant === 'admin') continue
        expect(canAssignDirectors(p, { clubId: OTHER, createdBy: SOMEONE }, on), `${grant}, ${state(on)}`).toBe(false)
        expect(canAssignDirectors(p, { clubId: null, createdBy: SOMEONE }, on), `${grant}, ${state(on)}`).toBe(false)
      }
    }
  })

  it('a creator deletes only their own unpublished draft with no entries, while the grant that let them create it still holds', () => {
    for (const p of PEOPLE.filter((x) => x.grant !== 'admin')) {
      for (const d of DRAFTS) {
        const allowed = d.createdBy === ME && d.isVisible === 0 && d.entries === 0 && canCreate(p, d.clubId, true)
        expect(canDeleteDraft(p, d, true), `${who(p)}, ${draftName(d)}`).toBe(allowed)
      }
    }
  })

  it('an LCA admin deletes any event, published or not, with entries or not, whoever created it, in either state', () => {
    for (const repClubId of [null, OWN]) {
      for (const d of DRAFTS) {
        for (const on of STATES) expect(canDeleteDraft({ grant: 'admin', memberId: ME, repClubId }, d, on), `${draftName(d)}, ${state(on)}`).toBe(true)
      }
    }
  })

  it('only D24\'s list sets a fee above $0, and the event changes no one\'s answer', () => {
    for (const p of PEOPLE) {
      const answers = new Set(EVENTS.map((e) => canChargeFees(p, e, true)))
      expect([...answers], who(p)).toEqual([p.grant !== 'none'])
    }
  })

  it('LCA\'s affiliate ID is allowed on every event (D23), drafts and published events alike', () => {
    for (const e of [...EVENTS, ...DRAFTS]) expect(lcaAffiliateAllowed(e), what(e)).toBe(true)
  })
})

describe('a grant the rules do not know keeps a club rep\'s own rights and nothing else', () => {
  /** WS09's regional representative, before the rules name it: not on D24's list, and no grant to create. */
  const REPRESENTATIVE = 'regional_representative' as unknown as CreationGrant

  it('is refused every fee above $0, every LCA-run event, and every delete but of a draft of the club it manages as a rep', () => {
    for (const repClubId of [null, OWN]) {
      const p: CreationPerson = { grant: REPRESENTATIVE, memberId: ME, repClubId }
      for (const e of EVENTS) expect(canChargeFees(p, e, true), what(e)).toBe(false)
      expect(canCreate(p, null, true)).toBe(false)
      const outsideItsClub = DRAFTS.filter((d) => d.clubId === null || d.clubId !== repClubId)
      for (const d of outsideItsClub) expect(canDeleteDraft(p, d, true), `${repClubId ?? 'no club'}: ${draftName(d)}`).toBe(false)
    }
  })

  it('creates and names directors for the club it manages as a club rep, and no other', () => {
    const p: CreationPerson = { grant: REPRESENTATIVE, memberId: ME, repClubId: OWN }
    for (const on of STATES) {
      expect([canCreate(p, OWN, on), canCreate(p, OTHER, on), canCreate(p, null, on)], state(on)).toEqual([true, false, false])
      expect(canAssignDirectors(p, { clubId: OWN, createdBy: SOMEONE }, on), state(on)).toBe(true)
      expect(canAssignDirectors(p, { clubId: OTHER, createdBy: ME }, on), state(on)).toBe(false)
    }
  })
})

describe('the rules read what they are given and nothing else', () => {
  /** A copy that throws on any write, since an ES module runs in strict mode. */
  const frozen = <T extends object>(value: T): T => Object.freeze({ ...value })

  it('change no person and no event they are asked about', () => {
    for (const p of PEOPLE.map(frozen)) {
      for (const on of STATES) {
        for (const clubId of CLUBS) expect(() => canCreate(p, clubId, on)).not.toThrow()
        for (const e of EVENTS.map(frozen)) {
          expect(() => canChargeFees(p, e, on)).not.toThrow()
          expect(() => canAssignDirectors(p, e, on)).not.toThrow()
          expect(() => lcaAffiliateAllowed(e)).not.toThrow()
        }
        for (const d of DRAFTS.map(frozen)) expect(() => canDeleteDraft(p, d, on)).not.toThrow()
      }
    }
  })

  it('answer for the member asked about, never for the id they are given in a creator\'s place', () => {
    const president: CreationPerson = { grant: 'president', memberId: SOMEONE, repClubId: null }
    expect(canAssignDirectors(president, { clubId: null, createdBy: ME }, true)).toBe(false)
    expect(canAssignDirectors(president, { clubId: null, createdBy: SOMEONE }, true)).toBe(true)
    expect(canDeleteDraft(president, { clubId: null, createdBy: ME, isVisible: 0, entries: 0 }, true)).toBe(false)
    expect(canDeleteDraft(president, { clubId: null, createdBy: SOMEONE, isVisible: 0, entries: 0 }, true)).toBe(true)
  })

  it.each([
    ['canCreate', canCreate, 3],
    ['canChargeFees', canChargeFees, 3],
    ['canAssignDirectors', canAssignDirectors, 3],
    ['canDeleteDraft', canDeleteDraft, 3],
    ['lcaAffiliateAllowed', lcaAffiliateAllowed, 1],
    ['feesRaised', feesRaised, 2],
  ] as const)('%s has no default on any parameter, rolesOn among them where it takes one', (_name, rule, length) => {
    // A parameter with a default, and every one after it, is left out of a function's length.
    expect(rule.length).toBe(length)
  })
})
