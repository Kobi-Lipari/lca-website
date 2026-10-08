// domain/format/date.ts
// Dates as the site writes them: weekday first, then month and day
// ("Sat, Oct 24"), with the year only when asked for ("Sat, Oct 24, 2026").
//
// The LCA runs on Central time. A bare stored value ("2026-10-24" or a
// datetime-local "2026-10-24T19:00") is already Louisiana wall-clock time and
// is read as written. A value that names an instant (a Date, epoch
// milliseconds, or an ISO string ending in "Z" or "+hh:mm") is converted to
// Central first, so an evening round stored in UTC still lands on its
// Louisiana day across both clock changes.
//
// Columns filled by SQLite's datetime('now') (created_at, updated_at, sent_at,
// recorded_at and the like) look like wall-clock text, "2026-10-24 02:30:00",
// but hold UTC. Pass those with `{ stored: 'utc' }` so they are converted to
// Central like any other instant; without it they would show 5 or 6 hours
// off, and late-evening rows on the next day. Announcement start and end
// times are stored as Louisiana wall-clock text and keep the default.
//
// Weekday and month names come from the tables below rather than from Intl,
// so the text is the same in browsers, Node and Workers whatever locale data
// each one ships with. Intl is used only to find the Central calendar day.

/** Louisiana's zone. Used by the format helpers; index.ts does not export it. */
export const CENTRAL_TIME_ZONE = 'America/Chicago'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** A stored date or time: a string from the database, epoch milliseconds, or a Date. */
export type DateInput = string | number | Date

/** Calendar and clock parts in a zone. `hour` and `minute` are absent for a date with no time. */
export interface ZonedParts {
  year: number
  month: number
  day: number
  hour?: number
  minute?: number
}

/**
 * How a bare "YYYY-MM-DD HH:MM[:SS]" string was stored. 'wallClock' (the
 * default) means Louisiana time as written; 'utc' means a UTC timestamp such
 * as SQLite's datetime('now'). A date with no time is a calendar day either way.
 */
export type StoredAs = 'wallClock' | 'utc'

export interface ZonedPartsOptions {
  /** Zone to show instants in. Defaults to Central. */
  timeZone?: string
  /** How a bare date and time string was stored. Defaults to 'wallClock'. */
  stored?: StoredAs
}

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?)?$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function zoneFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric',
    })
    formatters.set(timeZone, f)
  }
  return f
}

function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(Date.UTC(year, month - 1, day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
}

/**
 * Reads a stored value into calendar and clock parts in `timeZone`.
 * Returns null when the value cannot be read as a date.
 */
export function zonedParts(value: DateInput, options: ZonedPartsOptions = {}): ZonedParts | null {
  const { timeZone = CENTRAL_TIME_ZONE, stored = 'wallClock' } = options
  let ms: number
  if (typeof value === 'string') {
    const v = value.trim()
    const m = WALL_CLOCK.exec(v)
    if (m) {
      const [, y, mo, d, h, mi] = m
      const parts: ZonedParts = { year: Number(y), month: Number(mo), day: Number(d) }
      if (!isRealDate(parts.year, parts.month, parts.day)) return null
      if (h !== undefined) {
        parts.hour = Number(h)
        parts.minute = Number(mi)
        if (parts.hour > 23 || parts.minute > 59) return null
      }
      if (stored === 'wallClock' || parts.hour === undefined) return parts
      // A UTC timestamp written without a zone: read it as the instant it is.
      ms = Date.parse(`${v.replace(' ', 'T')}Z`)
    } else {
      // Only full ISO instants are read; anything looser is left to the caller.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(v)) return null
      ms = Date.parse(v)
    }
  } else {
    ms = value instanceof Date ? value.getTime() : value
  }
  if (!Number.isFinite(ms)) return null

  const raw = zoneFormatter(timeZone).formatToParts(new Date(ms))
  const get = (type: string) => Number(raw.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
  }
}

export interface FormatDateOptions {
  /** Add the year: "Sat, Oct 24, 2026". Off by default. */
  year?: boolean
  /** Zone for instants. Defaults to Central. */
  timeZone?: string
  /** Pass 'utc' for datetime('now') columns. Defaults to Louisiana wall-clock. */
  stored?: StoredAs
}

/**
 * "Sat, Oct 24" (or "Sat, Oct 24, 2026" with `year`). Every date the site
 * shows carries its weekday. A string that cannot be read is returned as
 * given, so a bad value shows up rather than disappearing; any other
 * unreadable value gives "".
 */
export function formatDate(value: DateInput | null | undefined, options: FormatDateOptions = {}): string {
  if (value === null || value === undefined) return ''
  const parts = zonedParts(value, options)
  if (!parts) return typeof value === 'string' ? value : ''
  const weekday = WEEKDAYS[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()]
  const text = `${weekday}, ${MONTHS[parts.month - 1]} ${parts.day}`
  return options.year ? `${text}, ${parts.year}` : text
}
