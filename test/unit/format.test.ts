// How the site writes scores, dates, times and time controls (domain/format).
// Brief 0.1 rule 7: half points as ½, a weekday on every date, "7:00 PM",
// and a plain companion for chess clock shorthand.
import { describe, expect, it } from 'vitest'
import {
  describeTimeControl,
  formatDate,
  formatScore,
  formatTime,
  formatTimeControl,
} from '../../domain/format'
import * as viaSiteAlias from '@/lib/format'
import * as viaDomainAlias from '@domain/format'

describe('formatScore', () => {
  it.each([
    [0, '0'],
    [0.5, '½'],
    [1, '1'],
    [3.5, '3½'],
    [10, '10'],
    [13.5, '13½'],
  ])('%s is %s', (score, text) => {
    expect(formatScore(score)).toBe(text)
  })

  it('never prints a decimal point for a half point', () => {
    for (let halves = 0; halves <= 40; halves++) {
      const text = formatScore(halves / 2)
      expect(text, String(halves / 2)).not.toContain('.')
      expect(text.endsWith('½')).toBe(halves % 2 === 1)
    }
  })

  it('reads numeric strings, as D1 and JSON can give them', () => {
    expect(formatScore('3.5')).toBe('3½')
    expect(formatScore('0.5')).toBe('½')
    expect(formatScore('4')).toBe('4')
    expect(formatScore(' 2.0 ')).toBe('2')
  })

  it('handles negatives, -0 and float noise', () => {
    expect(formatScore(-0)).toBe('0')
    expect(formatScore(-0.5)).toBe('-½')
    expect(formatScore(-1.5)).toBe('-1½')
    expect(formatScore(0.1 + 0.2 + 0.2)).toBe('½')
  })

  it('leaves text it cannot read as given, and gives "" for nothing', () => {
    expect(formatScore('3½')).toBe('3½')
    expect(formatScore('bye')).toBe('bye')
    expect(formatScore(null)).toBe('')
    expect(formatScore(undefined)).toBe('')
    expect(formatScore(Number.NaN)).toBe('')
  })
})

describe('formatDate', () => {
  it('puts the weekday first, with the year only when asked', () => {
    expect(formatDate('2026-10-24')).toBe('Sat, Oct 24')
    expect(formatDate('2026-10-24', { year: true })).toBe('Sat, Oct 24, 2026')
    expect(formatDate('2027-01-01', { year: true })).toBe('Fri, Jan 1, 2027')
  })

  it('reads a stored Louisiana wall-clock value as written', () => {
    expect(formatDate('2026-10-24T19:00')).toBe('Sat, Oct 24')
    expect(formatDate('2026-10-24 23:59:59')).toBe('Sat, Oct 24')
    // 2:30 AM on Sun, Mar 8, 2026 does not exist in Central time; the date is still that Sunday.
    expect(formatDate('2026-03-08T02:30')).toBe('Sun, Mar 8')
  })

  it("reads a datetime('now') column as UTC when told to", () => {
    // SQLite's datetime('now') writes UTC with a space and no zone. 02:30 UTC on
    // Oct 24 is 9:30 PM CDT on Fri, Oct 23, not 2:30 AM on Saturday.
    expect(formatDate('2026-10-24 02:30:00', { stored: 'utc' })).toBe('Fri, Oct 23')
    expect(formatTime('2026-10-24 02:30:00', { stored: 'utc' })).toBe('9:30 PM')
    // Either side of the autumn change, the offset follows Central time.
    expect(formatTime('2026-11-01 06:30:00', { stored: 'utc' })).toBe('1:30 AM') // CDT
    expect(formatTime('2026-11-01 07:30:00', { stored: 'utc' })).toBe('1:30 AM') // CST
    expect(formatDate('2026-11-02 05:30:00', { stored: 'utc', year: true })).toBe('Sun, Nov 1, 2026')
    // Without the option the same text is Louisiana wall-clock, as announcements store it.
    expect(formatDate('2026-10-24 02:30:00')).toBe('Sat, Oct 24')
    expect(formatTime('2026-10-24 02:30:00')).toBe('2:30 AM')
    // A date with no time is a calendar day whichever way it was stored.
    expect(formatDate('2026-10-24', { stored: 'utc' })).toBe('Sat, Oct 24')
    // Values that already name their zone are unaffected.
    expect(formatTime('2026-10-25T00:00:00Z', { stored: 'utc' })).toBe('7:00 PM')
    expect(formatTime('19:00', { stored: 'utc' })).toBe('7:00 PM')
    expect(formatDate('2026-02-30 10:00:00', { stored: 'utc' })).toBe('2026-02-30 10:00:00')
  })

  it('shows an evening round stored in UTC on its Louisiana day', () => {
    // 7:00 PM CDT on Sat, Oct 24 is 00:00 UTC on Oct 25.
    expect(formatDate('2026-10-25T00:00:00Z')).toBe('Sat, Oct 24')
    expect(formatDate(Date.parse('2026-10-25T00:00:00Z'))).toBe('Sat, Oct 24')
    expect(formatDate(new Date('2026-10-25T00:00:00Z'))).toBe('Sat, Oct 24')
    expect(formatDate('2026-10-24T19:00:00-05:00')).toBe('Sat, Oct 24')
  })

  describe('across the spring change, Sun, Mar 8, 2026 (clocks go forward at 2:00 AM)', () => {
    it.each([
      ['2026-03-08T05:30:00Z', 'Sat, Mar 7'], // 11:30 PM CST Saturday
      ['2026-03-08T06:30:00Z', 'Sun, Mar 8'], // 12:30 AM CST Sunday
      ['2026-03-08T08:30:00Z', 'Sun, Mar 8'], // 3:30 AM CDT, just after the change
      ['2026-03-09T04:30:00Z', 'Sun, Mar 8'], // 11:30 PM CDT Sunday
      ['2026-03-09T05:30:00Z', 'Mon, Mar 9'], // 12:30 AM CDT Monday; a fixed UTC-6 would still say Sunday
    ])('%s is %s', (instant, text) => {
      expect(formatDate(instant)).toBe(text)
    })
  })

  describe('across the autumn change, Sun, Nov 1, 2026 (clocks go back at 2:00 AM)', () => {
    it.each([
      ['2026-11-01T04:30:00Z', 'Sat, Oct 31'], // 11:30 PM CDT Saturday
      ['2026-11-01T05:30:00Z', 'Sun, Nov 1'], // 12:30 AM CDT Sunday
      ['2026-11-01T06:30:00Z', 'Sun, Nov 1'], // 1:30 AM CDT, the first time round
      ['2026-11-01T07:30:00Z', 'Sun, Nov 1'], // 1:30 AM CST, the second time round
      ['2026-11-02T05:30:00Z', 'Sun, Nov 1'], // 11:30 PM CST Sunday; a fixed UTC-5 would say Monday
      ['2026-11-02T06:30:00Z', 'Mon, Nov 2'], // 12:30 AM CST Monday
    ])('%s is %s', (instant, text) => {
      expect(formatDate(instant)).toBe(text)
    })
  })

  it('always carries a weekday', () => {
    const start = Date.parse('2026-01-01T12:00:00Z')
    for (let d = 0; d < 366; d++) {
      expect(formatDate(start + d * 86_400_000)).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}$/)
    }
  })

  it('leaves text it cannot read as given, and gives "" for nothing', () => {
    expect(formatDate('TBA')).toBe('TBA')
    expect(formatDate('2026-02-30')).toBe('2026-02-30')
    expect(formatDate('Oct 24')).toBe('Oct 24')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate(Number.NaN)).toBe('')
    expect(formatDate(new Date('nope'))).toBe('')
  })
})

describe('formatTime', () => {
  it.each([
    ['19:00', '7:00 PM'],
    ['07:05', '7:05 AM'],
    ['9:30', '9:30 AM'],
    ['12:00', '12:00 PM'],
    ['00:00', '12:00 AM'],
    ['12:30:00', '12:30 PM'],
    ['23:59', '11:59 PM'],
  ])('clock time %s is %s', (value, text) => {
    expect(formatTime(value)).toBe(text)
  })

  it('reads stored wall-clock values as Louisiana time', () => {
    expect(formatTime('2026-10-24T19:00')).toBe('7:00 PM')
    expect(formatTime('2026-10-24T12:00')).toBe('12:00 PM')
    expect(formatTime('2026-10-24T00:00')).toBe('12:00 AM')
  })

  it('shows instants in Central time on either side of a clock change', () => {
    expect(formatTime('2026-10-25T00:00:00Z')).toBe('7:00 PM') // CDT
    expect(formatTime('2026-12-05T01:00:00Z')).toBe('7:00 PM') // CST
    expect(formatTime(new Date('2026-03-08T18:00:00Z'))).toBe('1:00 PM') // CDT, the day of the change
    expect(formatTime(Date.parse('2026-11-01T18:00:00Z'))).toBe('12:00 PM') // CST, the day of the change
    expect(formatTime('2026-11-01T05:00:00Z')).toBe('12:00 AM') // CDT, just before the change
  })

  it('uses a plain space before AM and PM, never the no-break spaces newer locale data uses', () => {
    for (const text of [formatTime('2026-10-25T00:00:00Z'), formatTime('09:15')]) {
      expect(text).toMatch(/^\d{1,2}:\d{2} [AP]M$/)
      expect(text).not.toMatch(/[\u00a0\u202f]/)
    }
  })

  it('leaves text it cannot read as given, and gives "" for nothing', () => {
    expect(formatTime('2026-10-24')).toBe('2026-10-24')
    expect(formatTime('25:00')).toBe('25:00')
    expect(formatTime('7:00 PM')).toBe('7:00 PM')
    expect(formatTime('after round 3')).toBe('after round 3')
    expect(formatTime(null)).toBe('')
    expect(formatTime(Number.NaN)).toBe('')
  })
})

describe('formatTimeControl', () => {
  it.each([
    ['G/90+30', 'G/90+30 · 90 min each + 30 sec per move'],
    ['G/30;d5', 'G/30;d5 · 30 min each + 5 sec delay'],
    ['G/60', 'G/60 · 60 min each'],
    ['G/90;d5', 'G/90;d5 · 90 min each + 5 sec delay'],
    ['G/20d5', 'G/20d5 · 20 min each + 5 sec delay'],
    ['G/45 d5', 'G/45 d5 · 45 min each + 5 sec delay'],
    ['G/90+30i', 'G/90+30i · 90 min each + 30 sec per move'],
    ['G/15 inc 5', 'G/15 inc 5 · 15 min each + 5 sec per move'],
    ['g/5+2', 'g/5+2 · 5 min each + 2 sec per move'],
    ['SD/30', 'SD/30 · 30 min each'],
    ['  G/60  ', 'G/60 · 60 min each'],
  ])('%s becomes %s', (shorthand, text) => {
    expect(formatTimeControl(shorthand)).toBe(text)
  })

  it('returns text it does not recognise unchanged', () => {
    for (const text of ['40/90, SD/30;d5', 'Game in 60', 'Rapid', 'G/0', 'G/90+30 · 90 min each + 30 sec per move', '']) {
      expect(formatTimeControl(text)).toBe(text)
    }
    expect(formatTimeControl(null)).toBe('')
    expect(formatTimeControl(undefined)).toBe('')
  })

  it('gives the companion on its own for places that show it separately', () => {
    expect(describeTimeControl('G/90+30')).toBe('90 min each + 30 sec per move')
    expect(describeTimeControl('Rapid')).toBeNull()
  })
})

describe('where the helpers can be imported from', () => {
  it('src/lib/format.ts re-exports domain/format, so the brief path and @domain give the same functions', () => {
    for (const name of ['formatScore', 'formatDate', 'formatTime', 'formatTimeControl', 'describeTimeControl'] as const) {
      expect(viaSiteAlias[name], name).toBe(viaDomainAlias[name])
    }
    expect(viaDomainAlias.formatScore).toBe(formatScore)
  })
})
