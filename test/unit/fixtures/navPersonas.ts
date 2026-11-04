// test/unit/fixtures/navPersonas.ts
//
// The people the navigation tests draw, one list for both suites:
// test/unit/nav.test.ts reads it under vitest, and test/a11y/signedIn.ts
// under the browser tests, which plant each person's session in the page and
// answer the site's calls for them. So this file imports nothing at run time:
// the browser tests cannot resolve the site's @/ paths, and every import below
// is a type, which is erased before the file runs. It imports nothing from
// vitest either.
//
// Every person, address, club and event here is made up. Ids follow
// scripts/seed/fixtures.sql ("fx-" and a name), and where a person fits one
// the seed already holds, it is that person (Riley, Morgan, Dana with Robin
// and Quinn, Jordan and Avery Fixture), with the seed's own children, seats
// and entries, so a later test that asks the real server for a seeded row
// lines up; test/integration/nav-personas.test.ts checks that it does.
// Dates are worked out from the day the list is made for, so a membership
// that ends in 20 days, or ended 20 days ago, stays so on any day.
import type { MemberRole } from '@/areas/admin/roles'
import type { ApiManagedClub, ApiMySeat } from '@/areas/governance/api'
import type { ApiChild } from '@/areas/households/api'
import type { ApiDirectedTournament, ApiMember } from '@/areas/membership/api'
import type { ApiRegistration } from '@/areas/registration/api'
import type { MyLcaPerson } from '@/lib/nav'

/** The short name a test uses for each person. */
export const PERSONA_KEYS = [
  'signed-out',
  'active-member',
  'renews-soon',
  'expired-member',
  'parent',
  'director',
  'club-rep',
  'regional-rep',
  'officer',
  'president',
  'admin',
  'everything',
] as const

export type PersonaKey = (typeof PERSONA_KEYS)[number]

/** The account links today's More menu can show, as Navbar.tsx writes them, in its order. */
export const TODAYS_ACCOUNT_LINKS = ['Admin panel', 'Workspace', 'Board inbox', 'My region’s clubs'] as const

/** The sign-in service's own record of a person: what the planted session carries. */
export interface PersonaUser {
  readonly id: string
  readonly email: string
  readonly fullName: string
}

/** What the site's calls get for a signed-in person, shaped as the server answers them. */
export interface PersonaAnswers {
  /** POST /api/me, which the site sends first, so that the member's row exists. */
  readonly synced: { readonly member: ApiMember }
  /** GET /api/me. */
  readonly me: {
    readonly member: ApiMember
    readonly registrations: ApiRegistration[]
    readonly directedTournaments: ApiDirectedTournament[]
    readonly children: ApiChild[]
  }
  /** GET /api/board/my-seats. */
  readonly mySeats: { readonly seats: ApiMySeat[]; readonly managedClubs: ApiManagedClub[] }
  /** GET /api/me/event-mode; null answers 204 with no body, as for someone with no event this week. */
  readonly eventMode: unknown
  /** GET /api/live/now; null answers 204 with no body, as when no event is being played. */
  readonly liveNow: unknown
}

/** One person the tests can draw. */
export interface NavPersona {
  readonly key: PersonaKey
  /** Who this is, in plain words, for the names of tests. */
  readonly title: string
  /** Null for the visitor who is signed out. */
  readonly user: PersonaUser | null
  /** The assurance level the session carries: aal2 for the LCA admins, who have a second factor. */
  readonly aal: 'aal1' | 'aal2' | null
  readonly answers: PersonaAnswers | null
  /** What the My LCA menu reads; null when signed out. */
  readonly holds: MyLcaPerson | null
  /** The account links today's More menu shows this person, in order. */
  readonly todaysRoleLinks: readonly string[]
  /**
   * The labels of the rows the new header's My LCA menu gives this person, in
   * order, on the a11y-on build (myLcaRail and newMembership off) and before
   * the sign-in context holds the children (no Family row): plain data for
   * the browser tests, which cannot load src/lib/nav.ts, and which
   * test/unit/nav.test.ts holds equal to myLcaRows. Empty when signed out.
   */
  readonly myLcaMenuRows: readonly string[]
}

const DAY = 24 * 60 * 60 * 1000

/** A date as the database stores one, the given number of days from today. */
const dateFrom = (today: Date, days: number) => new Date(today.getTime() + days * DAY).toISOString().slice(0, 10)

/** A time as the database stores one ("2026-10-23 12:00:00"), the given number of days from today. */
const timeFrom = (today: Date, days: number) => new Date(today.getTime() + days * DAY).toISOString().slice(0, 19).replace('T', ' ')

interface MemberFacts {
  id: string
  email: string
  fullName: string
  status: ApiMember['membership_status']
  /** Days from today to the membership's end; negative once it has ended. */
  endsIn: number
  type: string
  role: MemberRole
  clubId: string | null
  rating: number | null
}

function member(today: Date, facts: MemberFacts): ApiMember {
  return {
    id: facts.id,
    email: facts.email,
    full_name: facts.fullName,
    uscf_id: null,
    uscf_rating: facts.rating,
    uscf_rating_updated_at: null,
    membership_status: facts.status,
    membership_expiry: dateFrom(today, facts.endsIn),
    membership_type: facts.type,
    uscf_expiration: null,
    role: facts.role,
    club_id: facts.clubId,
    created_at: timeFrom(today, -400),
  }
}

function child(today: Date, id: string, fullName: string, rating: number | null, endsIn: number): ApiChild {
  return {
    id,
    full_name: fullName,
    uscf_id: null,
    uscf_rating: rating,
    membership_status: 'active',
    membership_expiry: dateFrom(today, endsIn),
    membership_type: 'family',
    created_at: timeFrom(today, -380),
    uscf_expiration: null,
  }
}

/** The seed's events that someone here is entered in: name, place and days from today. */
const ENTERED_EVENTS = {
  'fx-t-open': { name: 'Fixture Fall Open', place: 'Baton Rouge, LA', inDays: 24 },
  'fx-t-done': { name: 'Fixture Summer Championship', place: 'Baton Rouge, LA', inDays: -30 },
} as const

interface EntryFacts {
  id: string
  event: keyof typeof ENTERED_EVENTS
  /** Who plays: the person, or one of their children. */
  memberId: string
  playerName: string
  section: string
  /** How many days ago the entry was made. */
  daysAgo: number
  /** 1 for a child's entry, which GET /api/me lists for the parent; 0 for the person's own. */
  isChildEntry: 0 | 1
}

/** An entry as GET /api/me lists it, with its event's name, date and place; every entry in the seed is paid. */
function entry(today: Date, facts: EntryFacts): ApiRegistration {
  const event = ENTERED_EVENTS[facts.event]
  return {
    id: facts.id,
    tournament_id: facts.event,
    member_id: facts.memberId,
    section: facts.section,
    payment_status: 'paid',
    registered_at: timeFrom(today, -facts.daysAgo),
    tournament_name: event.name,
    tournament_date: dateFrom(today, event.inDays),
    tournament_location: event.place,
    player_name: facts.playerName,
    is_child_entry: facts.isChildEntry,
    withdrawn_at: null,
    waitlisted_at: null,
  }
}

function seat(today: Date, id: string, slug: string, role: string, category: ApiMySeat['category'], since: number, regions: string[]): ApiMySeat {
  return { id, slug, role, category, started_at: timeFrom(today, -since), regions }
}

interface SignedInFacts {
  key: PersonaKey
  title: string
  member: MemberFacts
  aal?: 'aal2'
  children?: ApiChild[]
  /** The person's entries and their children's, newest first, as GET /api/me lists them. */
  registrations?: ApiRegistration[]
  directs?: ApiDirectedTournament[]
  seats?: ApiMySeat[]
  managedClubs?: ApiManagedClub[]
  /** As AuthContext works it out: a current seat, an LCA admin, or a view-only admin. */
  isBoardMember: boolean
  todaysRoleLinks: string[]
  myLcaMenuRows: string[]
}

function signedIn(today: Date, facts: SignedInFacts): NavPersona {
  const row = member(today, facts.member)
  const children = facts.children ?? []
  const directs = facts.directs ?? []
  const seats = facts.seats ?? []
  const managedClubs = facts.managedClubs ?? []
  return {
    key: facts.key,
    title: facts.title,
    user: { id: facts.member.id, email: facts.member.email, fullName: facts.member.fullName },
    aal: facts.aal ?? 'aal1',
    answers: {
      synced: { member: row },
      me: { member: row, registrations: facts.registrations ?? [], directedTournaments: directs, children },
      mySeats: { seats, managedClubs },
      eventMode: null,
      liveNow: null,
    },
    holds: {
      role: facts.member.role,
      isBoardMember: facts.isBoardMember,
      managedClubs: managedClubs.length,
      directedEvents: directs.length,
      hasChildren: children.length > 0,
    },
    todaysRoleLinks: facts.todaysRoleLinks,
    myLcaMenuRows: facts.myLcaMenuRows,
  }
}

/** The twelve people, worked out for `today`. */
export function navPersonas(today: Date = new Date()): NavPersona[] {
  const capital: ApiManagedClub = { id: 'fx-club-capital', name: 'Fixture Capital Chess Club', region: 'South Central Louisiana' }
  const north: ApiManagedClub = { id: 'fx-club-north', name: 'Fixture North Chess Club', region: 'North Louisiana' }
  return [
    {
      key: 'signed-out',
      title: 'a visitor who is signed out',
      user: null,
      aal: null,
      answers: null,
      holds: null,
      todaysRoleLinks: [],
      myLcaMenuRows: [],
    },
    signedIn(today, {
      key: 'active-member',
      title: 'an active member',
      member: { id: 'fx-m-p5', email: 'riley.fixture@example.org', fullName: 'Riley Fixture', status: 'active', endsIn: 250, type: 'senior', role: 'member', clubId: 'fx-club-capital', rating: 1730 },
      registrations: [entry(today, { id: 'fx-r-done-5', event: 'fx-t-done', memberId: 'fx-m-p5', playerName: 'Riley Fixture', section: 'Open', daysAgo: 37, isChildEntry: 0 })],
      isBoardMember: false,
      todaysRoleLinks: [],
      myLcaMenuRows: ['My LCA', 'Log out'],
    }),
    signedIn(today, {
      key: 'renews-soon',
      title: 'a member whose membership ends within 30 days',
      member: { id: 'fx-m-renew', email: 'harper.fixture@example.org', fullName: 'Harper Fixture', status: 'active', endsIn: 20, type: 'adult', role: 'member', clubId: 'fx-club-north', rating: 1504 },
      isBoardMember: false,
      todaysRoleLinks: [],
      myLcaMenuRows: ['My LCA', 'Log out'],
    }),
    signedIn(today, {
      key: 'expired-member',
      title: 'a member whose membership has expired',
      member: { id: 'fx-m-p4', email: 'morgan.fixture@example.org', fullName: 'Morgan Fixture', status: 'expired', endsIn: -20, type: 'adult', role: 'member', clubId: null, rating: 1288 },
      registrations: [entry(today, { id: 'fx-r-done-4', event: 'fx-t-done', memberId: 'fx-m-p4', playerName: 'Morgan Fixture', section: 'Open', daysAgo: 38, isChildEntry: 0 })],
      isBoardMember: false,
      todaysRoleLinks: [],
      myLcaMenuRows: ['My LCA', 'Log out'],
    }),
    signedIn(today, {
      key: 'parent',
      title: 'a parent of two',
      member: { id: 'fx-m-guardian', email: 'dana.fixture@example.org', fullName: 'Dana Fixture', status: 'active', endsIn: 300, type: 'family', role: 'member', clubId: 'fx-club-capital', rating: null },
      children: [child(today, 'fx-m-child-1', 'Robin Fixture', 845, 300), child(today, 'fx-m-child-2', 'Quinn Fixture', null, 300)],
      registrations: [
        entry(today, { id: 'fx-r-open-2', event: 'fx-t-open', memberId: 'fx-m-child-1', playerName: 'Robin Fixture', section: 'Scholastic', daysAgo: 5, isChildEntry: 1 }),
        entry(today, { id: 'fx-r-open-3', event: 'fx-t-open', memberId: 'fx-m-child-2', playerName: 'Quinn Fixture', section: 'Scholastic', daysAgo: 5, isChildEntry: 1 }),
      ],
      isBoardMember: false,
      todaysRoleLinks: [],
      myLcaMenuRows: ['My LCA', 'Log out'],
    }),
    signedIn(today, {
      key: 'director',
      title: 'the director of one event',
      member: { id: 'fx-m-director', email: 'parker.fixture@example.org', fullName: 'Parker Fixture', status: 'active', endsIn: 180, type: 'adult', role: 'tournament_director', clubId: 'fx-club-capital', rating: 1802 },
      directs: [{ id: 'fx-t-open', name: 'Fixture Fall Open', date: dateFrom(today, 24), status: 'upcoming' }],
      isBoardMember: false,
      todaysRoleLinks: ['Workspace'],
      myLcaMenuRows: ['My LCA', 'Workspace', 'Log out'],
    }),
    signedIn(today, {
      key: 'club-rep',
      title: 'a club rep',
      member: { id: 'fx-m-club-rep', email: 'cameron.fixture@example.org', fullName: 'Cameron Fixture', status: 'active', endsIn: 120, type: 'adult', role: 'club_rep', clubId: 'fx-club-capital', rating: 1590 },
      isBoardMember: false,
      todaysRoleLinks: ['Workspace'],
      myLcaMenuRows: ['My LCA', 'Workspace', 'Log out'],
    }),
    signedIn(today, {
      key: 'regional-rep',
      title: 'a regional representative',
      member: { id: 'fx-m-p2', email: 'jordan.fixture@example.org', fullName: 'Jordan Fixture', status: 'active', endsIn: 150, type: 'adult', role: 'member', clubId: 'fx-club-north', rating: 1655 },
      registrations: [entry(today, { id: 'fx-r-done-2', event: 'fx-t-done', memberId: 'fx-m-p2', playerName: 'Jordan Fixture', section: 'Open', daysAgo: 40, isChildEntry: 0 })],
      seats: [seat(today, 'fx-seat-rep', 'fixture-regional-representative', 'Fixture Regional Representative', 'regional_rep', 120, ['North Louisiana'])],
      managedClubs: [north],
      isBoardMember: true,
      todaysRoleLinks: ['Board inbox', 'My region’s clubs'],
      myLcaMenuRows: ['My LCA', 'Board inbox', 'My region’s clubs', 'Log out'],
    }),
    signedIn(today, {
      key: 'officer',
      title: 'an LCA officer',
      member: { id: 'fx-m-p1', email: 'avery.fixture@example.org', fullName: 'Avery Fixture', status: 'active', endsIn: 200, type: 'adult', role: 'lca_officer', clubId: 'fx-club-capital', rating: 1910 },
      registrations: [
        entry(today, { id: 'fx-r-open-1', event: 'fx-t-open', memberId: 'fx-m-p1', playerName: 'Avery Fixture', section: 'Open', daysAgo: 6, isChildEntry: 0 }),
        entry(today, { id: 'fx-r-done-1', event: 'fx-t-done', memberId: 'fx-m-p1', playerName: 'Avery Fixture', section: 'Open', daysAgo: 40, isChildEntry: 0 }),
      ],
      seats: [seat(today, 'fx-seat-officer', 'fixture-secretary', 'Fixture Secretary', 'officer', 200, [])],
      isBoardMember: true,
      todaysRoleLinks: ['Admin panel', 'Board inbox'],
      myLcaMenuRows: ['My LCA', 'Board inbox', 'Admin (view only)', 'Log out'],
    }),
    signedIn(today, {
      key: 'president',
      title: 'the president',
      member: { id: 'fx-m-president', email: 'reese.fixture@example.org', fullName: 'Reese Fixture', status: 'active', endsIn: 220, type: 'adult', role: 'lca_observer', clubId: 'fx-club-north', rating: 1840 },
      seats: [seat(today, 'fx-seat-president', 'fixture-president', 'Fixture President', 'officer', 300, [])],
      isBoardMember: true,
      todaysRoleLinks: ['Admin panel', 'Board inbox'],
      myLcaMenuRows: ['My LCA', 'Board inbox', 'Admin (view only)', 'Log out'],
    }),
    signedIn(today, {
      key: 'admin',
      title: 'an LCA admin',
      member: { id: 'fx-m-admin', email: 'blake.fixture@example.org', fullName: 'Blake Fixture', status: 'active', endsIn: 240, type: 'adult', role: 'lca_admin', clubId: null, rating: null },
      aal: 'aal2',
      isBoardMember: true,
      todaysRoleLinks: ['Admin panel', 'Board inbox'],
      myLcaMenuRows: ['My LCA', 'Board inbox', 'Admin', 'Log out'],
    }),
    signedIn(today, {
      key: 'everything',
      title: 'one person holding everything',
      member: { id: 'fx-m-everything', email: 'jamie.fixture@example.org', fullName: 'Jamie Fixture', status: 'active', endsIn: 260, type: 'family', role: 'lca_admin', clubId: 'fx-club-capital', rating: 1750 },
      aal: 'aal2',
      children: [child(today, 'fx-m-child-3', 'Skyler Fixture', 610, 260), child(today, 'fx-m-child-4', 'Rowan Fixture', null, 260)],
      directs: [{ id: 'fx-t-quads', name: 'Fixture Saturday Quads', date: dateFrom(today, 10), status: 'upcoming' }],
      seats: [
        seat(today, 'fx-seat-treasurer', 'fixture-treasurer', 'Fixture Treasurer', 'officer', 90, []),
        seat(today, 'fx-seat-rep-south', 'fixture-south-central-representative', 'Fixture South Central Representative', 'regional_rep', 60, ['South Central Louisiana']),
      ],
      managedClubs: [capital],
      isBoardMember: true,
      todaysRoleLinks: ['Admin panel', 'Board inbox'],
      myLcaMenuRows: ['My LCA', 'Board inbox', 'Admin', 'Log out'],
    }),
  ]
}

/** One person from the list, by key. */
export function navPersona(key: PersonaKey, today: Date = new Date()): NavPersona {
  const found = navPersonas(today).find((p) => p.key === key)
  if (!found) throw new Error(`No persona named ${key}`)
  return found
}
