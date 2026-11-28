// src/areas/clubs/clubPageRows.ts
//
// The plain code of the rest of the new club page (WS09 step 22): how each
// of the club's events, news rows and nearest clubs is said, and the foot
// line's words. Every rule here is one the site already keeps elsewhere,
// written again for the answer's rows, which carry the keys a visitor's
// event answers carry and no more:
//
// - an event's state in words, by the words the club's own events list
//   (src/areas/clubs/components/ClubEventsList.tsx) and the status tags
//   (src/lib/badgeStatus.ts) already use;
// - Register, offered exactly where the events list offers it
//   (src/pages/TournamentsPage.tsx): registration open, and the event not
//   finished; it leads to the event's own page on this site;
// - the count, in the events pages' words (registrationSummary in
//   src/areas/events/clearinghouse.ts): "N of M spots filled", or "N
//   registered" with no limit, and nothing with no limit and no one in;
// - every date with its weekday and year, by formatDate, and both ends of an
//   event of more than one day; a news row whose date cannot be read is
//   drawn with no date.
//
// A nearest club's distance is the server's words, drawn as given. A
// component file exports only components, so these live here, apart from
// src/areas/clubs/clubPage.ts, whose files write no date at all.
import { formatDate } from '@/lib/format'
import { STATUS_LABELS, type BadgeStatus } from '@/lib/badgeStatus'
import { zonedParts } from '@domain/format/date'
import type { ClubPageEvent, ClubPageResponse } from '@domain/contracts'

/** An event's state: the status tag it takes and its words beside the tag's mark. */
export interface EventState {
  status: BadgeStatus
  words: string
}

/** An event whose entries have reached its limit, as the event's own page counts it. */
export function eventFull(event: Pick<ClubPageEvent, 'max_players' | 'registered_count'>): boolean {
  return !!event.max_players && event.registered_count >= event.max_players
}

/**
 * An event's state in words: Finished, Under way, or how its registration
 * stands (open, full, opening soon, or closed), each beside its tag's mark.
 */
export function eventState(event: Pick<ClubPageEvent, 'status' | 'registration_status' | 'max_players' | 'registered_count'>): EventState {
  if (event.status === 'completed') return { status: 'closed', words: 'Finished' }
  if (event.status === 'active') return { status: 'live', words: 'Under way' }
  if (event.registration_status === 'open') {
    return eventFull(event) ? { status: 'full', words: STATUS_LABELS.full } : { status: 'open', words: STATUS_LABELS.open }
  }
  if (event.registration_status === 'draft') return { status: 'soon', words: STATUS_LABELS.soon }
  return { status: 'closed', words: STATUS_LABELS.closed }
}

/** Whether the page offers Register: the events list's own rule, registration open and the event not finished. */
export function offersRegister(event: Pick<ClubPageEvent, 'status' | 'registration_status'>): boolean {
  return event.registration_status === 'open' && event.status !== 'completed'
}

/** The event's own page on this site. */
export function eventAddress(id: string): string {
  return `/tournaments/${encodeURIComponent(id)}`
}

/** The count in the events pages' words, or null where they say none. */
export function eventCount(event: Pick<ClubPageEvent, 'max_players' | 'registered_count'>): string | null {
  if (event.max_players) return `${event.registered_count} of ${event.max_players} spots filled`
  return event.registered_count > 0 ? `${event.registered_count} registered` : null
}

/**
 * The event's date with its weekday and year, and its last day too for an
 * event of more than one day. Its words live in domain/clubs/pageWords.ts,
 * which the page the server writes before any script reads too.
 */
export { eventDates } from '@domain/clubs/pageWords'

/** A news row's date with its weekday and year, or null when it cannot be read as a date. */
export function newsDate(value: string): string | null {
  return zonedParts(value) ? formatDate(value, { year: true }) : null
}

type Nearest = ClubPageResponse['nearest'][number]

/** The heading over the nearest clubs: "Chess clubs near {city}", or "Chess clubs nearby" for a club with no city. */
export function nearbyHeading(city: string | null | undefined): string {
  const town = (city ?? '').trim()
  return town ? `Chess clubs near ${town}` : 'Chess clubs nearby'
}

/**
 * The line under a nearest club's name: its city, the distance as the server
 * gives it, and how it meets in its own words, in quotation marks, or
 * "Schedule not listed" where it has said nothing. A part with nothing in it
 * is left out, so no dot dangles.
 */
export function nearbyLine(club: Pick<Nearest, 'city' | 'distance' | 'statement'>): string {
  const statement = club.statement?.trim() ? `“${club.statement.trim()}”` : 'Schedule not listed'
  return [club.city.trim(), club.distance.trim(), statement].filter(Boolean).join(' · ')
}

/** Where the foot line says the club is: "{city}, Louisiana", or Louisiana alone for a club with no city. */
export function footPlace(city: string | null | undefined): string {
  const town = (city ?? '').trim()
  return town ? `${town}, Louisiana` : 'Louisiana'
}
