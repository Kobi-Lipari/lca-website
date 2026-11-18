// domain/clubs/pageWords.ts
//
// The words a club page writes that are not the club's own: the line under
// the club's name, the sections' headings and their boxes' labels, and an
// event's dates. The new club page the site draws (src/areas/clubs/) and the
// page the server writes before any script (functions/utils/clubs/pageHtml.ts)
// both read them here, so a search engine reads the same words a visitor
// sees once the page has drawn.
//
// Plain code with no zod: it imports only the date format, so the site's
// bundle can carry it. What it returns is plain text, not text made safe for
// HTML; whatever writes it into HTML escapes it there.
import { formatDate } from '../format/date'

/**
 * The one line the site writes under the club's name: "Chess club in
 * {city}, Louisiana · {region}". With no region the line ends at
 * Louisiana, and with no city it reads "Chess club in Louisiana", so it
 * never says "null" and never ends on a dot.
 */
export function cityLine(city: string | null | undefined, region: string | null | undefined): string {
  const town = (city ?? '').trim()
  const place = town ? `Chess club in ${town}, Louisiana` : 'Chess club in Louisiana'
  const area = (region ?? '').trim()
  return area ? `${place} · ${area}` : place
}

/** About's heading: "About {club}". */
export function aboutHeading(name: string): string {
  return `About ${name}`
}

/** When and where's heading: "When and where {club} meets". */
export function whenAndWhereHeading(name: string): string {
  return `When and where ${name} meets`
}

/** The heading over the club's events. */
export const EVENTS_HEADING = 'Events'

/** The label over how the club meets, in its own words. */
export const STATEMENT_LABEL = 'How the club meets'

/** The labels of About's boxes, each drawn only when the club filled it in. */
export const ABOUT_LABELS: Readonly<Record<'cost' | 'welcome' | 'online', string>> = { cost: 'Cost', welcome: 'Who is welcome', online: 'Find us online' }

/** The words for the two ticks of Who is welcome. */
export const ABOUT_TICKS: Readonly<Record<'weekendPlay' | 'scholasticFriendly', string>> = { weekendPlay: 'The club plays on weekends', scholasticFriendly: 'Scholastic friendly' }

/** The event's date with its weekday and year, and its last day too for an event of more than one day. */
export function eventDates(event: { date: string; end_date: string | null }): string {
  const first = formatDate(event.date, { year: true })
  if (!event.end_date || event.end_date === event.date) return first
  return `${first} to ${formatDate(event.end_date, { year: true })}`
}

/** The heading over the club's Contact section, in the section nav, on the page and in the page written before any script. */
export const CONTACT_HEADING = 'Contact'

/** The one line the page written before any script puts under Contact: no form, no name of a volunteer, no address. */
export const CONTACT_WRITTEN_LINE = 'You can send the club a message through this site. Its address stays private.'
