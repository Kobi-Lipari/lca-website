// src/lib/lcaTime.ts
// (Mirror of functions/utils/time.ts; keep the two identical below this header.)
//
// The LCA runs on Central time. Directors type dates and times into the
// site as Louisiana wall-clock time (a datetime-local input sends
// "2026-10-17T18:00" with no zone). Workers run on UTC, so comparing that
// string to "now" directly closed registration 5–6 hours early.

export const LCA_TIME_ZONE = 'America/Chicago'

/** Minutes the zone is ahead of UTC at the given instant (Central: -300 or -360). */
function zoneOffsetMinutes(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - instantMs) / 60000)
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
