// An event's line in the letter, from what the person typed into "An event": one plain paragraph, its parts joined
// by " · " as the board draws them. The day or days come first, then the name, the place, "run by" whoever runs it,
// and last the link's own words as a link, with " ↗" after them as the board draws every event link.
//
// Days are the date field's "YYYY-MM-DD" and are read as calendar days, so no time zone ever moves one. Their words
// come from formatDate, the site's own formatter, so every day carries its weekday. A span never uses a dash:
// "Sat to Sun, Feb 6 to 7, 2027". A day in the past is fine, since a letter of results can name an event that has
// happened.
//
// No React here, so the line's rules can be tested alone.
import { formatDate } from '@/lib/format'
import { keepableAddress } from './letterRules'

/** What the person typed into "An event", each as the field holds it. */
export interface EventFields {
  name: string
  firstDay: string
  lastDay: string
  place: string
  runBy: string
  link: string
  linkWords: string
}

export type EventField = keyof EventFields

/** The form with nothing typed in it. */
export const EMPTY_EVENT: EventFields = { name: '', firstDay: '', lastDay: '', place: '', runBy: '', link: '', linkWords: '' }

/** A field the line cannot be written from, and why, in words shown beside it. */
export interface EventRefusal {
  field: EventField
  words: string
}

/** The parts of a paragraph in the letter's editor: plain text, and one text with a link mark. */
export interface EventTextNode {
  type: 'text'
  text: string
  marks?: { type: 'link'; attrs: { href: string } }[]
}

export interface EventParagraph {
  type: 'paragraph'
  content: EventTextNode[]
}

/** Between the line's parts, as the board draws them. */
export const PART_JOIN = ' · '
/** After a link's words, as the board draws every event link. */
export const LINK_ARROW = ' ↗'

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

interface DayWords {
  key: string
  weekday: string
  month: string
  day: string
  year: string
}

/** A date field's value in formatDate's own words, or null when it is not a real calendar day. */
function dayWords(value: string): DayWords | null {
  const v = value.trim()
  const m = CALENDAR_DAY.exec(v)
  if (!m) return null
  // formatDate gives back an unreadable string as it was given.
  const text = formatDate(v)
  if (text === v) return null
  const [weekday, monthDay] = text.split(', ')
  const [month, day] = monthDay.split(' ')
  return { key: v, weekday, month, day, year: m[1] }
}

/**
 * The day or days of an event: "Sat, Jan 9, 2027"; "Sat to Sun, Feb 6 to 7, 2027"; "Sat to Mon, Jan 30 to Feb 1,
 * 2027"; "Thu to Sat, Dec 30, 2027 to Jan 1, 2028". An empty last day, or one equal to the first, is one day.
 * Null when the first day cannot be read, or the last day cannot be read or is before the first.
 */
export function eventDays(firstDay: string, lastDay = ''): string | null {
  const first = dayWords(firstDay)
  if (!first) return null
  if (lastDay.trim() === '' || lastDay.trim() === first.key) return formatDate(first.key, { year: true })
  const last = dayWords(lastDay)
  if (!last || last.key < first.key) return null
  const weekdays = `${first.weekday} to ${last.weekday}`
  if (first.year !== last.year) {
    return `${weekdays}, ${first.month} ${first.day}, ${first.year} to ${last.month} ${last.day}, ${last.year}`
  }
  if (first.month !== last.month) return `${weekdays}, ${first.month} ${first.day} to ${last.month} ${last.day}, ${first.year}`
  return `${weekdays}, ${first.month} ${first.day} to ${last.day}, ${first.year}`
}

/** Every field the line cannot be written from, in the form's order, each with its words. Empty when all is well. */
export function checkEvent(fields: EventFields): EventRefusal[] {
  const refusals: EventRefusal[] = []
  if (fields.name.trim() === '') refusals.push({ field: 'name', words: "Write the event's name." })
  if (fields.firstDay.trim() === '') refusals.push({ field: 'firstDay', words: 'Choose the first day.' })
  else if (!dayWords(fields.firstDay)) refusals.push({ field: 'firstDay', words: 'That first day is not a date.' })
  else if (fields.lastDay.trim() !== '') {
    const last = dayWords(fields.lastDay)
    if (!last) refusals.push({ field: 'lastDay', words: 'That last day is not a date.' })
    else if (last.key < fields.firstDay.trim()) refusals.push({ field: 'lastDay', words: 'The last day is before the first day.' })
  }
  const hasLink = fields.link.trim() !== ''
  if (hasLink && keepableAddress(fields.link) === null) {
    refusals.push({
      field: 'link',
      words: 'The email cannot keep that address. Start it with https://, http:// or mailto: and leave out spaces and quote marks.',
    })
  }
  if (hasLink && fields.linkWords.trim() === '') refusals.push({ field: 'linkWords', words: "Write the link's words." })
  if (!hasLink && fields.linkWords.trim() !== '') refusals.push({ field: 'link', words: 'Add the address for these words, or clear the words.' })
  return refusals
}

/**
 * The line as one paragraph for the letter's editor, or null when checkEvent refuses a field. The text parts are
 * joined by " · "; the link's words carry the link and the " ↗" follows them, outside the link.
 */
export function eventLine(fields: EventFields): EventParagraph | null {
  if (checkEvent(fields).length > 0) return null
  const days = eventDays(fields.firstDay, fields.lastDay)
  if (days === null) return null
  const parts = [days, fields.name.trim(), fields.place.trim(), fields.runBy.trim() ? `run by ${fields.runBy.trim()}` : '']
  const text = parts.filter((part) => part !== '').join(PART_JOIN)
  const href = fields.link.trim() ? keepableAddress(fields.link) : null
  if (href === null) return { type: 'paragraph', content: [{ type: 'text', text }] }
  return {
    type: 'paragraph',
    content: [
      { type: 'text', text: text + PART_JOIN },
      { type: 'text', text: fields.linkWords.trim(), marks: [{ type: 'link', attrs: { href } }] },
      { type: 'text', text: LINK_ARROW },
    ],
  }
}

/** The line's words as a reader sees them, the link's words included: for tests and the form's own checks. */
export function eventLineText(line: EventParagraph): string {
  return line.content.map((node) => node.text).join('')
}
