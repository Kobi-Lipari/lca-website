// @vitest-environment jsdom
//
// DateBlock at the edges of a Central day (WS01 step 26): midnight on either
// side of both 2026 clock changes, the hour the spring change skips and the
// hour the autumn change repeats, the turn of the year and a leap day. The
// words are formatDate's, so they always carry the weekday, and the <time>'s
// dateTime is the same Central calendar day as a valid date string. Every
// half hour across the four days around each clock change is checked
// against Intl's own reading of America/Chicago, so the words, the stacked
// parts and dateTime can never name different days.
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DateBlock } from '@/components/DateBlock'
import { formatDate } from '@/lib/format'

afterEach(cleanup)

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** A valid date string in HTML: four or more digits of year, then month and day. */
const VALID_DATE = /^\d{4,}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** The Central calendar day of an instant, read by Intl on its own. */
const central = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })
const centralDay = (ms: number) => central.format(new Date(ms))

interface Drawn {
  dateTime: string | null
  /** What a screen reader hears: formatDate's words, once. */
  heard: string | null
  /** The stacked parts a sighted reader sees: weekday, day, month and the year when asked. */
  seen: string[]
}

function drawn(value: Parameters<typeof DateBlock>[0]['value'], options: { year?: boolean; stored?: 'utc' | 'wallClock' } = {}): Drawn {
  cleanup()
  const { container } = render(<DateBlock value={value} {...options} />)
  const time = container.querySelector('time')
  return {
    dateTime: time?.getAttribute('datetime') ?? null,
    heard: time?.querySelector('.sr-only')?.textContent ?? null,
    seen: time ? [...time.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent ?? '') : [],
  }
}

/** The words, the parts and dateTime all name one day; returns that day. */
function oneDay(d: Drawn): string {
  expect(d.dateTime).toMatch(VALID_DATE)
  const [y, m, day] = d.dateTime!.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]
  // With the year asked for, the words and the parts end with it.
  const withYear = d.seen.length === 4
  expect(d.heard).toBe(`${weekday}, ${MONTHS[m - 1]} ${day}${withYear ? `, ${y}` : ''}`)
  expect(d.seen).toEqual([weekday, String(day), MONTHS[m - 1], ...(withYear ? [String(y)] : [])])
  return d.dateTime!
}

describe('midnight in Central time, for an instant', () => {
  it.each([
    // Daylight time (UTC-5): midnight is 05:00Z.
    ['the last second of Sat, Oct 24', '2026-10-25T04:59:59Z', '2026-10-24', 'Sat, Oct 24'],
    ['midnight that starts Sun, Oct 25', '2026-10-25T05:00:00Z', '2026-10-25', 'Sun, Oct 25'],
    ['the last millisecond of Sat, Oct 24', '2026-10-25T04:59:59.999Z', '2026-10-24', 'Sat, Oct 24'],
    // Standard time (UTC-6): midnight is 06:00Z.
    ['the last second of Fri, Dec 4', '2026-12-05T05:59:59Z', '2026-12-04', 'Fri, Dec 4'],
    ['midnight that starts Sat, Dec 5', '2026-12-05T06:00:00Z', '2026-12-05', 'Sat, Dec 5'],
    // Written with Louisiana's own offset.
    ['a minute before midnight, written with -05:00', '2026-10-24T23:59:00-05:00', '2026-10-24', 'Sat, Oct 24'],
    ['midnight, written with -06:00', '2026-12-05T00:00:00-06:00', '2026-12-05', 'Sat, Dec 5'],
  ])('%s', (_, value, day, words) => {
    const d = drawn(value)
    expect(oneDay(d)).toBe(day)
    expect(d.heard).toBe(words)
    expect(d.heard).toBe(formatDate(value))
  })
})

describe('the 2026 clock changes, for an instant', () => {
  it.each([
    // Spring: Sun, Mar 8 starts at 06:00Z (still standard time) and ends at 05:00Z on Mar 9 (daylight time).
    ['the last second of Sat, Mar 7', '2026-03-08T05:59:59Z', '2026-03-07'],
    ['midnight that starts Sun, Mar 8', '2026-03-08T06:00:00Z', '2026-03-08'],
    ['1:59:59 AM, the last second before the clocks go forward', '2026-03-08T07:59:59Z', '2026-03-08'],
    ['3:00 AM, the first second after', '2026-03-08T08:00:00Z', '2026-03-08'],
    ['the last second of Sun, Mar 8', '2026-03-09T04:59:59Z', '2026-03-08'],
    ['midnight that starts Mon, Mar 9', '2026-03-09T05:00:00Z', '2026-03-09'],
    // Autumn: Sun, Nov 1 starts at 05:00Z (daylight time) and ends at 06:00Z on Nov 2 (standard time).
    ['the last second of Sat, Oct 31', '2026-11-01T04:59:59Z', '2026-10-31'],
    ['midnight that starts Sun, Nov 1', '2026-11-01T05:00:00Z', '2026-11-01'],
    ['the first 1:30 AM', '2026-11-01T06:30:00Z', '2026-11-01'],
    ['the second 1:30 AM', '2026-11-01T07:30:00Z', '2026-11-01'],
    ['the last second of Sun, Nov 1', '2026-11-02T05:59:59Z', '2026-11-01'],
    ['midnight that starts Mon, Nov 2', '2026-11-02T06:00:00Z', '2026-11-02'],
  ])('%s', (_, value, day) => {
    expect(oneDay(drawn(value))).toBe(day)
  })

  it.each([
    ['spring', Date.UTC(2026, 2, 6, 0, 0)],
    ['autumn', Date.UTC(2026, 9, 30, 0, 0)],
  ])('every half hour across the four days around the %s change names the day Intl does', (_, start) => {
    const wrong: string[] = []
    for (let ms = start; ms < start + 4 * 24 * 3600_000; ms += 30 * 60_000) {
      for (const value of [ms, new Date(ms), new Date(ms).toISOString()]) {
        const d = drawn(value)
        const want = centralDay(ms)
        if (d.dateTime !== want) wrong.push(`${new Date(ms).toISOString()} (${typeof value}) gave ${d.dateTime}, not ${want}`)
        else oneDay(d)
      }
    }
    expect(wrong).toEqual([])
  })
})

describe('Louisiana wall-clock times, read as written', () => {
  it.each([
    ['midnight', '2026-10-24T00:00', '2026-10-24'],
    ['a minute before midnight', '2026-10-24T23:59', '2026-10-24'],
    ['2:30 AM on Mar 8, an hour the clocks skip', '2026-03-08T02:30', '2026-03-08'],
    ['1:30 AM on Nov 1, an hour the clocks repeat', '2026-11-01T01:30', '2026-11-01'],
    ['7:00 PM, with seconds and a space', '2026-11-07 19:00:00', '2026-11-07'],
    ['a bare date with spaces round it', ' 2026-10-24 ', '2026-10-24'],
  ])('%s', (_, value, day) => {
    expect(oneDay(drawn(value))).toBe(day)
  })

  it('a datetime(\'now\') column told it is UTC turns into Central time, across midnight and the autumn change', () => {
    expect(oneDay(drawn('2026-10-25 04:59:59', { stored: 'utc' }))).toBe('2026-10-24')
    expect(oneDay(drawn('2026-10-25 05:00:00', { stored: 'utc' }))).toBe('2026-10-25')
    expect(oneDay(drawn('2026-11-02 05:59:59', { stored: 'utc' }))).toBe('2026-11-01')
    // The same text read as wall-clock time stays on its own day.
    expect(oneDay(drawn('2026-10-25 04:59:59'))).toBe('2026-10-25')
    // A bare date is a calendar day however it was stored.
    expect(oneDay(drawn('2026-10-25', { stored: 'utc' }))).toBe('2026-10-25')
  })
})

describe('the turn of the year and a leap day', () => {
  it('names the Central year in the words, the parts and dateTime on New Year\'s Eve', () => {
    const eve = drawn('2027-01-01T05:59:59Z', { year: true })
    expect(oneDay(eve)).toBe('2026-12-31')
    expect(eve.heard).toBe('Thu, Dec 31, 2026')
    expect(eve.seen).toEqual(['Thu', '31', 'Dec', '2026'])
    const day = drawn('2027-01-01T06:00:00Z', { year: true })
    expect(oneDay(day)).toBe('2027-01-01')
    expect(day.heard).toBe('Fri, Jan 1, 2027')
    expect(day.seen).toEqual(['Fri', '1', 'Jan', '2027'])
  })

  it('reads Feb 29 in a leap year and leaves it as written in another', () => {
    expect(oneDay(drawn('2028-02-29'))).toBe('2028-02-29')
    expect(drawn('2028-02-29').heard).toBe('Tue, Feb 29')
    cleanup()
    const { container } = render(<DateBlock value="2027-02-29" />)
    expect(container.querySelector('time')).toBeNull()
    expect(container.textContent).toBe('2027-02-29')
  })

  it('every weekday and every month has its three letters in the words and the parts', () => {
    // The first of each month of 2026, and the seven days of the week of Oct 18.
    const firsts = MONTHS.map((_, i) => `2026-${String(i + 1).padStart(2, '0')}-01`)
    const week = Array.from({ length: 7 }, (_, i) => `2026-10-${String(18 + i).padStart(2, '0')}`)
    const months = new Set<string>()
    const weekdays = new Set<string>()
    for (const value of [...firsts, ...week]) {
      const d = drawn(value)
      oneDay(d)
      weekdays.add(d.seen[0])
      months.add(d.seen[2])
    }
    expect([...months].sort()).toEqual([...MONTHS].sort())
    expect([...weekdays].sort()).toEqual([...WEEKDAYS].sort())
  })
})

describe('values that are not a date', () => {
  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['an invalid Date', new Date(Number.NaN)],
  ])('%s gives no <time>, no dateTime and no words', (_, value) => {
    const { container } = render(<DateBlock value={value} />)
    expect(container.querySelector('time')).toBeNull()
    expect(container.querySelector('[datetime]')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it.each([
    ['a month that does not exist', '2026-13-01'],
    ['an hour that does not exist', '2026-10-24T24:30'],
    ['a date written the American way', '10/24/2026'],
    ['words', 'To be announced'],
  ])('%s is shown as given, outside a <time>, so a bad value shows up rather than disappearing', (_, value) => {
    const { container } = render(<DateBlock value={value} />)
    expect(container.querySelector('time')).toBeNull()
    expect(container.textContent).toBe(value)
  })
})
