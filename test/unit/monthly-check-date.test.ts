// test/unit/monthly-check-date.test.ts
//
// The monthly check's day (domain/clubs/monthlyCheck.ts): the first Monday
// of each month at 8:00 AM Central time, in summer time and in winter time,
// due on that Monday alone, from 8:00 AM to the last minute of that day.
// Every case passes the time in, as a UTC instant, so the machine's own
// clock and zone play no part.
import { describe, expect, it } from 'vitest'
import {
  CHECK_HOUR,
  checkMonthWords,
  dayText,
  firstMondayOf,
  isCheckDue,
  nextCheckDate,
  nextCheckWords,
} from '../../domain/clubs/monthlyCheck'

/** A UTC instant from its parts, the way a test names an exact moment. */
const utc = (text: string) => Date.parse(`${text}Z`)
const next = (text: string) => dayText(nextCheckDate(utc(text)))

describe('the first Monday of a month', () => {
  it('is the right day for every month from November 2026 to January 2028', () => {
    const expected: Array<[number, number, number]> = [
      [2026, 11, 2], [2026, 12, 7],
      [2027, 1, 4], [2027, 2, 1], [2027, 3, 1], [2027, 4, 5], [2027, 5, 3], [2027, 6, 7],
      [2027, 7, 5], [2027, 8, 2], [2027, 9, 6], [2027, 10, 4], [2027, 11, 1], [2027, 12, 6],
      [2028, 1, 3],
    ]
    for (const [year, month, day] of expected) expect(firstMondayOf(year, month), `${year}-${month}`).toBe(day)
    expect(CHECK_HOUR).toBe(8)
  })
})

describe('isCheckDue', () => {
  it('is due on Monday, December 7, 2026 at 8:00 AM Central, in winter time, and not at 7:59 AM', () => {
    // Central standard time is six hours behind UTC.
    expect(isCheckDue(utc('2026-12-07T14:00:00'))).toBe(true)
    expect(isCheckDue(utc('2026-12-07T13:59:00'))).toBe(false)
    expect(isCheckDue(utc('2026-12-07T13:59:59'))).toBe(false)
  })

  it('is due on Monday, July 5, 2027 at 8:00 AM Central, in summer time, and not at 7:59 AM', () => {
    // Central daylight time is five hours behind UTC.
    expect(isCheckDue(utc('2027-07-05T13:00:00'))).toBe(true)
    expect(isCheckDue(utc('2027-07-05T12:59:00'))).toBe(false)
  })

  it('is due on a first of the month that is a Monday: Mon, Feb 1, Mon, Mar 1 and Mon, Nov 1, 2027', () => {
    expect(isCheckDue(utc('2027-02-01T14:00:00'))).toBe(true)
    expect(isCheckDue(utc('2027-03-01T14:00:00'))).toBe(true)
    // Mon, Nov 1, 2027 is before the clock change of Sun, Nov 7, so summer time still holds.
    expect(isCheckDue(utc('2027-11-01T13:00:00'))).toBe(true)
    expect(isCheckDue(utc('2027-11-01T12:59:00'))).toBe(false)
    // Sun, Nov 1, 2026 is a first of the month but no Monday; the first Monday is the 2nd.
    expect(isCheckDue(utc('2026-11-01T15:00:00'))).toBe(false)
    expect(isCheckDue(utc('2026-11-02T14:00:00'))).toBe(true)
  })

  it('stays due to the last minute of that Monday in Central time, though UTC has turned to Tuesday, and is not due at midnight', () => {
    expect(isCheckDue(utc('2026-12-08T05:59:00'))).toBe(true)
    expect(isCheckDue(utc('2026-12-08T05:59:59'))).toBe(true)
    expect(isCheckDue(utc('2026-12-08T06:00:00'))).toBe(false)
    // In summer time the day ends an hour sooner in UTC.
    expect(isCheckDue(utc('2027-07-06T04:59:00'))).toBe(true)
    expect(isCheckDue(utc('2027-07-06T05:00:00'))).toBe(false)
  })

  it('is not due on the Sunday evening before in Central time, when UTC already reads Monday', () => {
    expect(isCheckDue(utc('2026-12-07T02:00:00'))).toBe(false)
    expect(isCheckDue(utc('2026-12-07T05:59:00'))).toBe(false)
  })

  it('is not due the day after, on the Wednesday after a first Monday, or on the second Monday', () => {
    expect(isCheckDue(utc('2026-12-08T15:00:00'))).toBe(false)
    expect(isCheckDue(utc('2026-12-09T15:00:00'))).toBe(false)
    expect(isCheckDue(utc('2026-12-14T15:00:00'))).toBe(false)
    expect(isCheckDue(utc('2027-03-08T15:00:00'))).toBe(false)
    expect(isCheckDue(utc('2027-11-08T15:00:00'))).toBe(false)
  })

  it('is not due on the two clock changes of 2027, Sun, Mar 14 and Sun, Nov 7, and is due on the first Monday after each at 8:00 AM', () => {
    for (const hour of ['07', '08', '09', '13', '14', '15']) {
      expect(isCheckDue(utc(`2027-03-14T${hour}:00:00`)), `Mar 14 ${hour}`).toBe(false)
      expect(isCheckDue(utc(`2027-11-07T${hour}:00:00`)), `Nov 7 ${hour}`).toBe(false)
    }
    // Mon, Apr 5, 2027, in summer time.
    expect(isCheckDue(utc('2027-04-05T13:00:00'))).toBe(true)
    expect(isCheckDue(utc('2027-04-05T12:59:00'))).toBe(false)
    // Mon, Dec 6, 2027, in winter time.
    expect(isCheckDue(utc('2027-12-06T14:00:00'))).toBe(true)
    expect(isCheckDue(utc('2027-12-06T13:59:00'))).toBe(false)
  })

  it('takes a Date as well as epoch milliseconds, and is false for a time that is no time', () => {
    expect(isCheckDue(new Date('2026-12-07T14:00:00Z'))).toBe(true)
    expect(isCheckDue(Number.NaN)).toBe(false)
  })
})

describe('nextCheckDate', () => {
  it('gives this month\'s first Monday before its 8:00 AM, and next month\'s from 8:00 AM that Monday', () => {
    expect(next('2026-11-14T19:00:00')).toBe('2026-12-07')
    expect(next('2026-12-01T12:00:00')).toBe('2026-12-07')
    expect(next('2026-12-07T13:59:00')).toBe('2026-12-07')
    expect(next('2026-12-07T14:00:00')).toBe('2027-01-04')
    expect(next('2026-12-08T05:59:00')).toBe('2027-01-04')
  })

  it('gives the right Monday in summer time, at 7:59 AM and 8:00 AM Central', () => {
    expect(next('2027-07-05T12:59:00')).toBe('2027-07-05')
    expect(next('2027-07-05T13:00:00')).toBe('2027-08-02')
  })

  it('turns from December to January of the next year', () => {
    expect(next('2026-12-31T23:00:00')).toBe('2027-01-04')
    // 11:59 PM on Thu, Dec 31, 2026 in Central time is already Jan 1 in UTC.
    expect(next('2027-01-01T05:59:00')).toBe('2027-01-04')
    expect(next('2027-12-06T14:00:00')).toBe('2028-01-03')
    expect(next('2027-12-31T12:00:00')).toBe('2028-01-03')
  })

  it('gives the first Monday after each clock change of 2027, and a first of the month that is a Monday', () => {
    expect(next('2027-03-14T15:00:00')).toBe('2027-04-05')
    expect(next('2027-11-07T15:00:00')).toBe('2027-12-06')
    expect(next('2027-01-20T15:00:00')).toBe('2027-02-01')
    expect(next('2027-02-01T13:59:00')).toBe('2027-02-01')
    expect(next('2027-02-01T14:00:00')).toBe('2027-03-01')
  })
})

describe('the words a page shows', () => {
  it('writes the next check as a date with its weekday and year and a time as 8:00 AM', () => {
    expect(nextCheckWords(utc('2026-11-14T19:00:00'))).toEqual({ day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' })
    expect(nextCheckWords(utc('2027-06-10T19:00:00'))).toEqual({ day: '2027-07-05', date: 'Mon, Jul 5, 2027', time: '8:00 AM' })
  })

  it('writes a stored check\'s month in Central time, so a late evening save keeps its own month', () => {
    expect(checkMonthWords('2026-09-12 14:00:00')).toBe('Sep 2026')
    // 9:30 PM Central on Wed, Sep 30, 2026 is Oct 1 in UTC.
    expect(checkMonthWords('2026-10-01 02:30:00')).toBe('Sep 2026')
    expect(checkMonthWords('2027-01-01 05:59:00')).toBe('Dec 2026')
    expect(checkMonthWords(null)).toBe('')
    expect(checkMonthWords('not a stamp')).toBe('')
  })
})
