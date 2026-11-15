// test/unit/monthly-check-edges.test.ts
//
// More cases for the monthly check's day (domain/clubs/monthlyCheck.ts):
// midnight itself, the days either side of the 2026 and 2027 clock changes,
// a leap year, a sweep of every quarter hour of 2027, and the month of a
// stored stamp at midnight Central. Every case passes the time in.
import { describe, expect, it } from 'vitest'
import { zonedParts } from '../../domain/format/date'
import {
  type CheckDay,
  checkMonthWords,
  dayText,
  firstMondayOf,
  isCheckDue,
  nextCheckDate,
  nextCheckWords,
} from '../../domain/clubs/monthlyCheck'

const utc = (text: string) => Date.parse(`${text}Z`)
const next = (text: string) => dayText(nextCheckDate(utc(text)))

/** The Central calendar day of an instant, from the site's own helper. */
const todayCentral = (t: number): CheckDay => {
  const p = zonedParts(t)!
  return { year: p.year, month: p.month, day: p.day }
}

describe('midnight and the clock changes, in Central time', () => {
  it('is not due at midnight itself on a first Monday, in winter and in summer time: the hour reads 0, never 24', () => {
    expect(isCheckDue(utc('2026-12-07T06:00:00'))).toBe(false)
    expect(isCheckDue(utc('2027-07-05T05:00:00'))).toBe(false)
    // Still to come at midnight, so the next check is that day.
    expect(next('2026-12-07T06:00:00')).toBe('2026-12-07')
    expect(next('2027-07-05T05:00:00')).toBe('2027-07-05')
  })

  it('reads Mon, Nov 2, 2026, the day after the clocks went back, in winter time: 7:59 AM is not yet due and 8:00 AM is', () => {
    // 7:59 AM CST is 13:59 UTC; read as summer time it would be 8:59 AM and wrongly due.
    expect(isCheckDue(utc('2026-11-02T13:59:00'))).toBe(false)
    expect(isCheckDue(utc('2026-11-02T14:00:00'))).toBe(true)
    expect(next('2026-11-02T13:59:00')).toBe('2026-11-02')
    expect(next('2026-11-02T14:00:00')).toBe('2026-12-07')
  })

  it('reads Mon, Mar 2, 2026, before the clocks went forward, in winter time, and Mon, Apr 6, 2026 in summer time', () => {
    expect(isCheckDue(utc('2026-03-02T13:59:00'))).toBe(false)
    expect(isCheckDue(utc('2026-03-02T14:00:00'))).toBe(true)
    expect(isCheckDue(utc('2026-04-06T12:59:00'))).toBe(false)
    expect(isCheckDue(utc('2026-04-06T13:00:00'))).toBe(true)
    expect(next('2026-03-02T14:00:00')).toBe('2026-04-06')
  })

  it('is right in a leap year: the first Monday of Feb 2028 is the 7th, of Mar 2028 the 6th', () => {
    expect(firstMondayOf(2028, 2)).toBe(7)
    expect(firstMondayOf(2028, 3)).toBe(6)
    expect(isCheckDue(utc('2028-02-07T14:00:00'))).toBe(true)
    expect(isCheckDue(utc('2028-02-29T15:00:00'))).toBe(false)
    expect(next('2028-02-29T15:00:00')).toBe('2028-03-06')
  })

  it('across every quarter hour of 2027 is due on 12 days alone, each for 16 hours from 8:00 AM, and the next check is always a first Monday still to come', () => {
    const quarter = 15 * 60 * 1000
    const start = utc('2027-01-01T00:00:00')
    const end = utc('2028-01-01T00:00:00')
    let due = 0
    for (let t = start; t < end; t += quarter) {
      const isDue = isCheckDue(t)
      if (isDue) due++
      const day = nextCheckDate(t)
      // A Monday, and the first of its month.
      expect(new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()).toBe(1)
      expect(day.day).toBeLessThanOrEqual(7)
      // The next check is never today: on the Monday after 8:00 AM it is a later month's.
      if (isDue) expect(day.day === firstMondayOf(day.year, day.month) && dayText(day) !== dayText(todayCentral(t))).toBe(true)
    }
    // 12 Mondays, 16 hours each, 4 quarter hours an hour.
    expect(due).toBe(12 * 16 * 4)
  })

  it('writes the December to January turn with its weekday and year', () => {
    expect(nextCheckWords(utc('2026-12-20T18:00:00'))).toEqual({ day: '2027-01-04', date: 'Mon, Jan 4, 2027', time: '8:00 AM' })
    expect(nextCheckWords(utc('2027-12-20T18:00:00'))).toEqual({ day: '2028-01-03', date: 'Mon, Jan 3, 2028', time: '8:00 AM' })
  })

  it('reads the month of a stored stamp at midnight Central in summer and winter time', () => {
    // Midnight, Sep 1, 2026 in Central daylight time is 05:00 UTC.
    expect(checkMonthWords('2026-09-01 05:00:00')).toBe('Sep 2026')
    expect(checkMonthWords('2026-09-01 04:59:59')).toBe('Aug 2026')
    // Midnight, Dec 1, 2026 in Central standard time is 06:00 UTC.
    expect(checkMonthWords('2026-12-01 06:00:00')).toBe('Dec 2026')
    expect(checkMonthWords('2026-12-01 05:59:59')).toBe('Nov 2026')
    expect(checkMonthWords('2026-01-01 03:00:00')).toBe('Dec 2025')
  })
})
