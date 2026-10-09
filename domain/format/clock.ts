// domain/format/clock.ts
// Times as the site writes them: 12-hour clock with AM or PM ("7:00 PM").
// Noon is "12:00 PM" and midnight is "12:00 AM".
//
// Accepts a bare clock time from a round schedule ("19:00"), a stored
// Louisiana wall-clock date and time ("2026-10-24T19:00"), or an instant
// (a Date, epoch milliseconds, or an ISO string with a zone), which is shown
// in Central time. A datetime('now') column holds UTC and is passed with
// `{ stored: 'utc' }` (see date.ts). The text is built by hand rather than
// by Intl, because newer locale data puts a narrow no-break space before "PM".

import { zonedParts, type DateInput, type StoredAs } from './date'

const CLOCK = /^(\d{1,2}):(\d{2})(?::\d{2})?$/

function twelveHour(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

export interface FormatTimeOptions {
  /** Zone for instants. Defaults to Central. */
  timeZone?: string
  /** Pass 'utc' for datetime('now') columns. Defaults to Louisiana wall-clock. */
  stored?: StoredAs
}

/**
 * "7:00 PM". A string that cannot be read as a time (including a date with
 * no time) is returned as given; any other unreadable value gives "".
 */
export function formatTime(value: DateInput | null | undefined, options: FormatTimeOptions = {}): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') {
    const m = CLOCK.exec(value.trim())
    if (m) {
      const hour = Number(m[1])
      const minute = Number(m[2])
      return hour < 24 && minute < 60 ? twelveHour(hour, minute) : value
    }
  }
  const parts = zonedParts(value, options)
  if (!parts || parts.hour === undefined || parts.minute === undefined) {
    return typeof value === 'string' ? value : ''
  }
  return twelveHour(parts.hour, parts.minute)
}
