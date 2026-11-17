// domain/clubs/monthlyCheck.ts
//
// When the monthly check of the club listings lands, and the words a page
// shows for a club's last check. The check lands on the first Monday of each
// month at 8:00 AM in the association's own clock, Central time
// (America/Chicago), in summer time and in winter time alike, and it is due
// on that Monday alone, from 8:00 AM to the end of that day. So a switch
// turned on later in a month sends nothing by itself until the next first
// Monday.
//
// Pure date work: every function takes the time as an argument, reads no
// clock of its own and makes no query. Nothing is imported but the site's
// own date helpers in domain/format.

import { formatDate, zonedParts, type DateInput } from '../format/date'
import { formatTime } from '../format/clock'

/**
 * The words for a club whose listing does not say how it meets: the monthly
 * check's email and the page its Still accurate link opens both show them, so
 * the person reads on the page what the email said.
 */
export const NO_STATEMENT = 'How the club meets is not listed yet.'

/** The hour of the day, in Central time, the monthly check lands at. */
export const CHECK_HOUR = 8

/** A calendar day in Central time. */
export interface CheckDay {
  year: number
  month: number
  day: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** The weekday of a calendar day, 0 for Sunday to 6 for Saturday. */
function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** The day of the month that is the month's first Monday, 1 to 7. */
export function firstMondayOf(year: number, month: number): number {
  return 1 + ((8 - weekdayOf(year, month, 1)) % 7)
}

/** The day as "YYYY-MM-DD". */
export function dayText(day: CheckDay): string {
  return `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`
}

/** The moment as Central calendar and clock parts, or null when it is not a moment. */
function centralNow(now: Date | number): Required<CheckDay & { hour: number; minute: number }> | null {
  const parts = zonedParts(now)
  if (!parts || parts.hour === undefined || parts.minute === undefined) return null
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute }
}

/**
 * True only on the first Monday of the month, from 8:00 AM Central to the
 * last minute of that day. Every other day, and that Monday before 8:00 AM,
 * is false.
 */
export function isCheckDue(now: Date | number): boolean {
  const at = centralNow(now)
  if (!at) return false
  return at.day === firstMondayOf(at.year, at.month) && at.hour >= CHECK_HOUR
}

/**
 * The day of the next monthly check after `now`: this month's first Monday
 * while its 8:00 AM is still to come, and next month's first Monday from
 * 8:00 AM on that Monday, when this month's check has landed. December
 * turns to January of the next year.
 */
export function nextCheckDate(now: Date | number): CheckDay {
  const at = centralNow(now) ?? { year: 1970, month: 1, day: 1, hour: 0, minute: 0 }
  const thisMonth = firstMondayOf(at.year, at.month)
  if (at.day < thisMonth || (at.day === thisMonth && at.hour < CHECK_HOUR)) {
    return { year: at.year, month: at.month, day: thisMonth }
  }
  const year = at.month === 12 ? at.year + 1 : at.year
  const month = at.month === 12 ? 1 : at.month + 1
  return { year, month, day: firstMondayOf(year, month) }
}

/**
 * The next check as a page shows it: the day ("2026-12-07"), the date with
 * its weekday and year ("Mon, Dec 7, 2026") and the time ("8:00 AM"), each
 * from the site's own date and time helpers.
 */
export function nextCheckWords(now: Date | number): { day: string; date: string; time: string } {
  const day = dayText(nextCheckDate(now))
  return {
    day,
    date: formatDate(day, { year: true }),
    time: formatTime(`${day}T${String(CHECK_HOUR).padStart(2, '0')}:00`),
  }
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const

/**
 * The key of a month's check: the first Monday of the Central month `now`
 * falls in, as "2026-12-07". The monthly check marks each person it sends to
 * under this key, so one month's marks never stand for the next. Empty for a
 * time that is not one.
 */
export function checkMonthKey(now: Date | number): string {
  const at = centralNow(now)
  return at ? dayText({ year: at.year, month: at.month, day: firstMondayOf(at.year, at.month) }) : ''
}

/**
 * A month in words, read in Central time: "December 2026". Takes a moment
 * or a stamp stored in UTC by datetime('now'), so a check marked late on the
 * last evening of a month in Louisiana is that month's. Empty for no stamp.
 */
export function monthInWords(value: DateInput | null | undefined): string {
  if (value === null || value === undefined) return ''
  const parts = zonedParts(value, { stored: 'utc' })
  return parts ? `${LONG_MONTHS[parts.month - 1]} ${parts.year}` : ''
}

/**
 * The month of a stamp stored in UTC by datetime('now'), read in Central
 * time: "Sep 2026". A save late on the last evening of a month in Louisiana
 * is that month's, though UTC has turned to the next. Empty for no stamp.
 */
export function checkMonthWords(stamp: DateInput | null | undefined): string {
  if (stamp === null || stamp === undefined) return ''
  const parts = zonedParts(stamp, { stored: 'utc' })
  return parts ? `${MONTHS[parts.month - 1]} ${parts.year}` : ''
}
