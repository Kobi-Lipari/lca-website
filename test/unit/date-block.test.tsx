// @vitest-environment jsdom
//
// DateBlock (WS01 step 26): a date as a block, its words from formatDate
// (domain/format/date.ts, through src/lib/format.ts), so it always carries
// its weekday, inside a <time> whose dateTime is a valid date string for the
// same Central calendar day: for a bare date, a Louisiana wall-clock time and
// an instant alike, across both 2026 clock changes. Not the other formatDate
// in src/areas/events/clearinghouse.ts, which writes no weekday.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DateBlock } from '@/components/DateBlock'
import { formatDate } from '@/lib/format'

afterEach(cleanup)

const WEEKDAY = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), /
/** A valid date string in HTML: four or more digits of year, then month and day. */
const VALID_DATE = /^\d{4,}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

function drawn(value: Parameters<typeof DateBlock>[0]['value'], options: { year?: boolean; stored?: 'utc' | 'wallClock' } = {}) {
  const { container } = render(<DateBlock value={value} {...options} />)
  const time = container.querySelector('time')
  return { container, time, words: time?.querySelector('.sr-only')?.textContent ?? null }
}

describe('the date and its weekday', () => {
  it.each([
    ['a bare date', '2026-10-24', 'Sat, Oct 24', '2026-10-24'],
    ['a Louisiana wall-clock time', '2026-11-07T19:00', 'Sat, Nov 7', '2026-11-07'],
    ['a wall-clock time written with a space', '2026-11-07 19:00:00', 'Sat, Nov 7', '2026-11-07'],
    ['an instant in UTC, the evening before in Central time', '2026-12-05T03:00:00Z', 'Fri, Dec 4', '2026-12-04'],
    ['an instant with an offset', '2026-10-24T23:30:00-05:00', 'Sat, Oct 24', '2026-10-24'],
    ['the spring clock change', '2026-03-08', 'Sun, Mar 8', '2026-03-08'],
    ['the autumn clock change', '2026-11-01', 'Sun, Nov 1', '2026-11-01'],
    ['an instant on the autumn clock change night', '2026-11-01T06:30:00Z', 'Sun, Nov 1', '2026-11-01'],
  ])('%s: formatDate\'s words, with the weekday, inside a <time> of the same day', (_, value, words, day) => {
    const { time, words: said } = drawn(value)
    expect(time).not.toBeNull()
    expect(said).toBe(words)
    expect(said).toBe(formatDate(value))
    expect(said).toMatch(WEEKDAY)
    expect(time!.getAttribute('datetime')).toBe(day)
    expect(time!.getAttribute('datetime')).toMatch(VALID_DATE)
  })

  it('reads a Date and epoch milliseconds as the instants they are', () => {
    const instant = Date.UTC(2026, 11, 5, 3, 0)
    for (const value of [new Date(instant), instant]) {
      const { time, words } = drawn(value)
      expect(words).toBe('Fri, Dec 4')
      expect(time!.getAttribute('datetime')).toBe('2026-12-04')
      cleanup()
    }
  })

  it('reads a stored UTC timestamp as UTC when told, as formatDate does', () => {
    const { time, words } = drawn('2026-10-25 02:30:00', { stored: 'utc' })
    expect(words).toBe('Sat, Oct 24')
    expect(time!.getAttribute('datetime')).toBe('2026-10-24')
  })

  it('adds the year when asked, in the words and under the month', () => {
    const { time, words } = drawn('2026-10-24', { year: true })
    expect(words).toBe('Sat, Oct 24, 2026')
    const shown = [...time!.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent)
    expect(shown).toEqual(['Sat', '24', 'Oct', '2026'])
  })
})

describe('the block', () => {
  it('stacks the weekday, the day and the month for the eye, and gives a screen reader formatDate\'s words once', () => {
    const { time } = drawn('2026-10-24')
    expect(time!.getAttribute('data-slot')).toBe('date-block')
    const shown = [...time!.querySelectorAll('[aria-hidden="true"]')].map((s) => s.textContent)
    expect(shown).toEqual(['Sat', '24', 'Oct'])
    const read = [...time!.children].filter((c) => c.getAttribute('aria-hidden') !== 'true').map((c) => c.textContent)
    expect(read).toEqual(['Sat, Oct 24'])
    expect(time!.querySelector('.sr-only')!.className).toBe('sr-only')
  })

  it('is the boards\' date tile, drawn in tokens that follow the look', () => {
    const { time } = drawn('2026-10-24')
    const classes = time!.className.split(' ')
    for (const cls of ['w-16', 'min-h-16', 'rounded-lg', 'border-hairline', 'bg-surface', 'text-ink']) expect(classes, cls).toContain(cls)
    for (const part of time!.querySelectorAll('[aria-hidden="true"]')) {
      expect(part.className).not.toMatch(/text-(?:lca|gold)|#[0-9a-f]{3,6}/i)
    }
  })

  it('takes a caller\'s className', () => {
    const { time } = drawn('2026-10-24')
    expect(time!.className).not.toContain('mt-2')
    cleanup()
    const { container } = render(<DateBlock value="2026-10-24" className="mt-2" />)
    expect(container.querySelector('time')!.className.split(' ')).toContain('mt-2')
  })
})

describe('values it cannot read', () => {
  it('shows a string it cannot read as given, outside a <time>', () => {
    const { container } = render(<DateBlock value="To be announced" />)
    expect(container.querySelector('time')).toBeNull()
    expect(container.textContent).toBe('To be announced')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty string', ''],
  ])('shows nothing for %s', (_, value) => {
    const { container } = render(<DateBlock value={value} />)
    expect(container.innerHTML).toBe('')
  })

  it('a date that does not exist is not read', () => {
    const { container } = render(<DateBlock value="2026-02-30" />)
    expect(container.querySelector('time')).toBeNull()
    expect(container.textContent).toBe('2026-02-30')
  })
})

describe('where its words come from', () => {
  it('imports the weekday-bearing formatDate, not the clearinghouse one', () => {
    const source = readFileSync(join(__dirname, '../../src/components/DateBlock.tsx'), 'utf8')
    expect(source).toContain("import { formatDate } from '@/lib/format'")
    expect(source).toContain("from '@domain/format/date'")
    expect(source).not.toMatch(/clearinghouse/)
  })
})
