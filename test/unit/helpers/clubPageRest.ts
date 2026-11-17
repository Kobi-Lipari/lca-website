// test/unit/helpers/clubPageRest.ts
//
// Made-up answers of GET /api/clubs/:address/page for the rest of the new
// club page (WS09 step 22), each held to the answer's own contract: a
// fuller club with three events in different states (one open with a
// limit, one full over two days, one finished), two news rows and three
// nearest clubs, in the order the server gives them (events and news
// newest first). Built on step 21's made-up answers, whose file is left as
// it is. Every name, address and club here is made up.
import { clubPageResponseSchema, type ClubPageEvent, type ClubPageResponse } from '@domain/contracts'
import { bareAnswer, fullAnswer } from './clubPageAnswer'

export const OPEN_EVENT: ClubPageEvent = {
  id: 'e-example-quads', name: 'Example Saturday Quads', date: '2026-12-05', end_date: null,
  status: 'upcoming', registration_status: 'open', max_players: 16, registered_count: 6,
}
export const FULL_EVENT: ClubPageEvent = {
  id: 'e-example-championship', name: 'Example Club Championship', date: '2026-12-12', end_date: '2026-12-13',
  status: 'upcoming', registration_status: 'open', max_players: 40, registered_count: 40,
}
export const PAST_EVENT: ClubPageEvent = {
  id: 'e-example-fall', name: 'Example Fall Open', date: '2026-10-24', end_date: null,
  status: 'completed', registration_status: 'closed', max_players: null, registered_count: 22,
}

export const NEWS: ClubPageResponse['news'] = [
  { id: 'n-example-results', title: 'Example results are in', excerpt: 'The crosstable from Saturday, and two games worth a look.', news_date: '2026-11-14' },
  { id: 'n-example-clocks', title: 'Two more clocks needed', excerpt: 'Saturdays are filling up. Bring a spare clock if you have one.', news_date: '2026-11-03' },
]

export const NEAREST: ClubPageResponse['nearest'] = [
  { name: 'Example Pawns Club', city: 'Example City', slug: 'example-pawns-club', statement: 'Sundays at 2:00 PM at Example Hall.', distance: 'less than 1 mi' },
  { name: 'Example Knights Club', city: 'Example Town', slug: 'example-knights-club', statement: null, distance: 'about 5 mi' },
  { name: 'Example Rooks Club', city: 'Example Village', slug: 'example-rooks-club', statement: 'Fridays from 6:00 PM, open to anyone.', distance: 'about 20 mi' },
]

/** The fuller club with every block this step draws: three events, two news rows and three nearest clubs. */
export function restAnswer(patch: Partial<Pick<ClubPageResponse, 'events' | 'news' | 'nearest' | 'sections'>> & { club?: Partial<ClubPageResponse['club']> } = {}): ClubPageResponse {
  const base = fullAnswer()
  return clubPageResponseSchema.parse({
    ...base,
    club: { ...base.club, ...patch.club },
    sections: patch.sections ?? ['about', 'when_and_where', 'events', 'news', 'contact'],
    events: patch.events ?? [FULL_EVENT, OPEN_EVENT, PAST_EVENT],
    news: patch.news ?? NEWS,
    nearest: patch.nearest ?? NEAREST,
  })
}

/** The bare club with parts of it replaced, held to the answer's own contract. */
export function bareWith(patch: Partial<Pick<ClubPageResponse, 'events' | 'news' | 'nearest' | 'sections' | 'places'>>): ClubPageResponse {
  return clubPageResponseSchema.parse({ ...bareAnswer(), ...patch })
}
