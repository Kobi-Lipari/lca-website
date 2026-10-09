// domain/format/centralTime.ts
// The one definition of the Central wall-clock conversion, used by the
// server (registration deadlines, pricing, the daily-emails worker through
// functions/utils/time.ts) and by the browser (src/lib/lcaTime.ts).
//
// The LCA runs on Central time. Directors type dates and times into the
// site as Louisiana wall-clock time (a datetime-local input sends
// "2026-10-17T18:00" with no zone). Workers run on UTC, so comparing that
// string to "now" directly closed registration 5–6 hours early.
//
// The zone and the instant-to-Central reading come from ./date, so the site
// has one time-zone constant and one place that asks Intl for Central time.
// This file adds only the other direction: wall-clock text to an instant.

import { CENTRAL_TIME_ZONE, zonedParts } from './date'

/** Louisiana's zone, under the name the server code has always used. */
export const LCA_TIME_ZONE = CENTRAL_TIME_ZONE

/** Minutes the zone is ahead of UTC at the given instant (Central: -300 or -360). */
function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  // Zone offsets are whole minutes, so reading the start of the minute is exact.
  const minuteMs = Math.floor(instantMs / 60000) * 60000
  const p = zonedParts(minuteMs, { timeZone })
  if (!p || p.hour === undefined || p.minute === undefined) return Number.NaN
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute)
  return Math.round((asUtc - minuteMs) / 60000)
}

/**
 * The instant a stored date/time refers to. Values with an explicit zone
 * ("Z" or "+hh:mm") are taken as-is; bare wall-clock values are Central.
 * A bare date ("2026-10-17") means the end of that day.
 */
export function lcaTimeToMs(value: string, timeZone = LCA_TIME_ZONE): number {
  const v = value.trim()
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(v)) return new Date(v).getTime()
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(v)
  if (!m) return new Date(v).getTime()
  const [, y, mo, d, h, mi, s] = m
  const dateOnly = h === undefined
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d),
    dateOnly ? 23 : Number(h), dateOnly ? 59 : Number(mi), dateOnly ? 59 : Number(s ?? 0))
  // Two passes settle the offset across a daylight-saving change.
  let guess = wall - zoneOffsetMinutes(wall, timeZone) * 60000
  guess = wall - zoneOffsetMinutes(guess, timeZone) * 60000
  return guess
}

/** True once the stored close time has passed. */
export function hasPassed(value: string | null | undefined, nowMs = Date.now()): boolean {
  if (!value) return false
  const t = lcaTimeToMs(value)
  return Number.isFinite(t) && t <= nowMs
}
