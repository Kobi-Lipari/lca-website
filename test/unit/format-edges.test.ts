// Edges of the domain/format helpers that format.test.ts does not pin down:
// the exact minute of each 2026 clock change, midnight in Central time on
// either side of a change, year and leap-day boundaries, an explicit zone,
// null end dates, and the plain-language rules for the source text itself.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { describeTimeControl, formatDate, formatScore, formatTime, formatTimeControl } from '../../domain/format'

const DOMAIN_FORMAT = resolve(__dirname, '../../domain/format')

describe('formatTime at the minute of each 2026 clock change', () => {
  it.each([
    ['2026-03-08T07:59:00Z', '1:59 AM'], // last minute of CST
    ['2026-03-08T08:00:00Z', '3:00 AM'], // clocks jump 2:00 AM to 3:00 AM; 2:xx never shows
    ['2026-11-01T06:59:00Z', '1:59 AM'], // 1:59 AM CDT
    ['2026-11-01T07:00:00Z', '1:00 AM'], // clocks go back; 1:00 AM again, now CST
    ['2026-11-01T08:00:00Z', '2:00 AM'],
  ])('%s shows %s', (instant, text) => {
    expect(formatTime(instant)).toBe(text)
  })

  it('never shows a 2 o\'clock hour on the spring change day', () => {
    const start = Date.parse('2026-03-08T00:00:00Z')
    // From 06:00Z (12:00 AM CST) to 09:00Z (4:00 AM CDT), a 2:xx AM must not occur.
    for (let m = 6 * 60; m < 9 * 60; m += 5) {
      expect(formatTime(start + m * 60_000)).not.toMatch(/^2:\d\d AM$/)
    }
  })
})

describe('midnight in Central time', () => {
  it('is 12:00 AM and the new day, in CDT and in CST', () => {
    expect(formatTime('2026-10-24T05:00:00Z')).toBe('12:00 AM') // CDT
    expect(formatDate('2026-10-24T05:00:00Z')).toBe('Sat, Oct 24')
    expect(formatTime('2026-10-24T04:59:00Z')).toBe('11:59 PM')
    expect(formatDate('2026-10-24T04:59:00Z')).toBe('Fri, Oct 23')

    expect(formatTime('2026-12-05T06:00:00Z')).toBe('12:00 AM') // CST
    expect(formatDate('2026-12-05T06:00:00Z')).toBe('Sat, Dec 5')
    expect(formatTime('2026-12-05T05:59:00Z')).toBe('11:59 PM')
    expect(formatDate('2026-12-05T05:59:00Z')).toBe('Fri, Dec 4')
  })

  it('is 12:00 AM on the day of each clock change', () => {
    expect(formatTime('2026-03-08T06:00:00Z')).toBe('12:00 AM') // CST, Sun, Mar 8
    expect(formatTime('2026-11-01T05:00:00Z')).toBe('12:00 AM') // CDT, Sun, Nov 1
    expect(formatDate('2026-03-08T06:00:00Z')).toBe('Sun, Mar 8')
    expect(formatDate('2026-11-01T05:00:00Z')).toBe('Sun, Nov 1')
  })

  it('a stored 24:00-style or 12-hour value is not misread as midnight or noon', () => {
    expect(formatTime('24:00')).toBe('24:00')
    expect(formatTime('12:00')).toBe('12:00 PM')
    expect(formatTime('00:00')).toBe('12:00 AM')
    expect(formatTime('00:30')).toBe('12:30 AM')
    expect(formatTime('12:30')).toBe('12:30 PM')
    expect(formatTime('13:00')).toBe('1:00 PM')
  })
})

describe('calendar boundaries', () => {
  it('crosses the new year in Central time', () => {
    expect(formatDate('2027-01-01T05:59:00Z', { year: true })).toBe('Thu, Dec 31, 2026')
    expect(formatDate('2027-01-01T06:00:00Z', { year: true })).toBe('Fri, Jan 1, 2027')
  })

  it('knows leap days', () => {
    expect(formatDate('2028-02-29', { year: true })).toBe('Tue, Feb 29, 2028')
    expect(formatDate('2027-02-29')).toBe('2027-02-29') // not a real date, shown as given
    expect(formatDate('2028-03-01')).toBe('Wed, Mar 1')
  })

  it('gives the right weekday for every month in 2026', () => {
    const first = ['Thu', 'Sun', 'Sun', 'Wed', 'Fri', 'Mon', 'Wed', 'Sat', 'Tue', 'Thu', 'Sun', 'Tue']
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    first.forEach((wd, i) => {
      const mm = String(i + 1).padStart(2, '0')
      expect(formatDate(`2026-${mm}-01`)).toBe(`${wd}, ${names[i]} 1`)
    })
  })

  it('does not zero-pad the day', () => {
    expect(formatDate('2026-10-04')).toBe('Sun, Oct 4')
  })

  it('honours an explicit zone for instants only', () => {
    expect(formatDate('2026-10-25T00:00:00Z', { timeZone: 'UTC' })).toBe('Sun, Oct 25')
    expect(formatTime('2026-10-25T00:00:00Z', { timeZone: 'UTC' })).toBe('12:00 AM')
    expect(formatDate('2026-10-24T19:00', { timeZone: 'UTC' })).toBe('Sat, Oct 24')
  })
})

describe('missing and empty data (an event with no end_date, a TBA time)', () => {
  it('shows nothing for a null or undefined end date, never "null" or "Invalid Date"', () => {
    for (const v of [null, undefined]) {
      expect(formatDate(v)).toBe('')
      expect(formatDate(v, { year: true })).toBe('')
      expect(formatTime(v)).toBe('')
    }
  })

  it('an empty string is returned as given, not guessed at', () => {
    expect(formatDate('')).toBe('')
    expect(formatTime('')).toBe('')
    expect(formatTimeControl('')).toBe('')
    expect(formatScore('')).toBe('')
    expect(describeTimeControl('')).toBeNull()
  })

  it('no output ever contains "NaN", "undefined", "null" or "Invalid"', () => {
    const outputs = [
      formatScore(Number.NaN), formatScore(undefined), formatScore(null), formatScore(Infinity),
      formatDate(Number.NaN), formatDate(new Date('x')), formatDate(undefined),
      formatTime(Number.NaN), formatTime(new Date('x')), formatTime(undefined),
      formatTimeControl(undefined), formatTimeControl(null),
    ]
    for (const o of outputs) expect(o).not.toMatch(/NaN|undefined|null|Invalid|Infinity/)
  })
})

describe('scores', () => {
  it('ties: equal half-point totals format identically', () => {
    expect(formatScore(4.5)).toBe(formatScore('4.5'))
    expect(formatScore(4.5)).toBe('4½')
  })

  it('a large field total still reads cleanly', () => {
    expect(formatScore(99.5)).toBe('99½')
    expect(formatScore(100)).toBe('100')
  })

  it('a value that is not a whole or half point is shown as its number, with no rounding', () => {
    expect(formatScore(2.25)).toBe('2.25')
  })
})

describe('time controls', () => {
  it('is idempotent: formatting a formatted control leaves it alone', () => {
    const once = formatTimeControl('G/90+30')
    expect(formatTimeControl(once)).toBe(once)
  })

  it('does not read a number into a text that only contains one', () => {
    for (const text of ['Round 1 at G/60 sharp', 'G/', 'G/abc', '90+30', 'G/90+', 'G/1000']) {
      expect(formatTimeControl(text), text).toBe(text)
    }
  })

  it('G/30;d5 says delay, not per move', () => {
    const t = formatTimeControl('G/30;d5')
    expect(t).toContain('5 sec delay')
    expect(t).not.toContain('per move')
  })
})

describe('plain-language rules in the source of domain/format', () => {
  const sources = readdirSync(DOMAIN_FORMAT)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(join(DOMAIN_FORMAT, f), 'utf8')] as const)

  it('finds the helper files', () => {
    expect(sources.map(([f]) => f).sort()).toEqual(['centralTime.ts', 'clock.ts', 'date.ts', 'index.ts', 'score.ts', 'timeControl.ts'])
  })

  it.each(sources)('%s never says USCF', (_f, src) => {
    expect(src).not.toMatch(/USCF/)
  })

  it('no helper uses the locale clock formatter that puts a no-break space before PM', () => {
    for (const [f, src] of sources) expect(src, f).not.toMatch(/toLocaleTimeString|hour12|dayPeriod/)
  })
})
