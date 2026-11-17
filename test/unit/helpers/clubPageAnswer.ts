// test/unit/helpers/clubPageAnswer.ts
//
// Made-up answers of GET /api/clubs/:address/page for the new club page's
// tests (WS09 step 21), each held to the answer's own contract, and the
// sessions the page is read in: a visitor who is not signed in, a plain
// member, the club's own rep and the region's representative. Every name,
// address and club here is made up.
import type { AuthContextValue } from '@/contexts/AuthContext'
import { clubPageResponseSchema, type ClubPageResponse } from '@domain/contracts'

export const CLUB_ID = 'c-example-club'
export const CLUB_SLUG = 'example-chess-club'
export const ABOUT_ONE = 'A friendly made-up club for casual and rated games, open to every level.'
export const STATEMENT = 'First and third Tuesdays at 7:00 PM at Example Library.'
export const TOLD = 'Last checked November 2026'

/** A club with only the five basics, as most clubs start: one sentence, how it meets, a place, and a contact that stays private. */
export function bareAnswer(): ClubPageResponse {
  return clubPageResponseSchema.parse({
    club: { id: CLUB_ID, slug: CLUB_SLUG, name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', color: '#1a2744', logo: null },
    sections: ['about', 'when_and_where', 'contact'],
    about: { text: ABOUT_ONE, cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false },
    statement: { text: STATEMENT, told: TOLD },
    places: [{ name: 'Example Library', street: null, note: null, latitude: 30.1, longitude: -91.2 }],
    contact: { name: 'Player One' },
    events: [],
    news: [],
    nearest: [],
  })
}

export const ABOUT_LONG = 'We have met in Example City for years. Most Saturdays you will find a dozen of us playing long games.\n\nWednesdays are casual: no clocks, and people wander in from 6:00 PM.'
export const STATEMENT_LONG = 'Saturdays from 10:00 AM at Example Library: long games. Wednesdays from 6:00 PM at Example Cafe: casual games, no clock needed.'

/** A fuller club: longer words, Cost, Who is welcome with both ticks, its links, its own colour and two places. */
export function fullAnswer(): ClubPageResponse {
  return clubPageResponseSchema.parse({
    club: { id: CLUB_ID, slug: CLUB_SLUG, name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', color: '#2e6b4f', logo: null },
    sections: ['about', 'when_and_where', 'events', 'news', 'contact'],
    about: {
      text: ABOUT_LONG,
      cost: 'Free. Saturday rated games are $5 toward the room.',
      welcome: 'All ages and all levels. Bring a board if you have one.',
      facebook: 'https://www.facebook.com/example-chess-club',
      website: 'https://example.org/chess',
      other: 'javascript:alert(1)',
      weekend_play: true,
      scholastic_friendly: true,
    },
    statement: { text: STATEMENT_LONG, told: 'Last checked October 2026' },
    places: [
      { name: 'Example Library', street: '1 Example Street, Example City', note: 'Meeting room past the front desk.', latitude: 30.1, longitude: -91.2 },
      { name: 'Example Cafe', street: null, note: 'Tables at the back.', latitude: null, longitude: null },
    ],
    contact: { name: 'Player One' },
    events: [{ id: 'e-example', name: 'Example Open', date: '2026-12-05', end_date: null, status: 'upcoming', registration_status: 'open', max_players: 40, registered_count: 12 }],
    news: [{ id: 'n-example', title: 'Example news', excerpt: 'Made up.', news_date: '2026-11-01' }],
    nearest: [],
  })
}

/** The session's fields the page reads, with everything else a signed-in page might touch. */
function session(fields: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
    assuranceLevel: null, mfaRequired: false, loading: false, memberLoading: false, directedTournamentIds: [], directedTournaments: [],
    signOut: async () => {}, impersonating: null, exitImpersonation: async () => {}, refreshMember: async () => {},
    ...fields,
  } as unknown as AuthContextValue
}

export const visitor = () => session({})
export const plainMember = () => session({
  user: { id: 'm-one' } as never, role: 'member', member: { id: 'm-one', role: 'member', club_id: CLUB_ID, full_name: 'Player One' } as never,
})
export const clubRep = (clubId = CLUB_ID) => session({
  user: { id: 'm-two' } as never, role: 'club_rep', member: { id: 'm-two', role: 'club_rep', club_id: clubId, full_name: 'Player Two' } as never,
})
export const regionRep = () => session({
  user: { id: 'm-three' } as never, role: 'member', member: { id: 'm-three', role: 'member', club_id: null, full_name: 'Player Three' } as never,
  seats: [{ id: 's-example', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }] as never,
  managedClubs: [{ id: CLUB_ID, name: 'Example Chess Club', region: 'Bayou Region' }],
})
