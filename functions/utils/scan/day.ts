// functions/utils/scan/day.ts

/**
 * The day a scan counts against, as YYYY-MM-DD in Louisiana time, so the
 * allowance resets at midnight for the people using it. (It used to be the
 * UTC date, which rolled over at 6 or 7 in the evening here.) en-CA is used
 * only because it formats dates as YYYY-MM-DD.
 */
export function scanDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
