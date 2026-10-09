// test/integration/domain-format.test.ts
// domain/ is imported by relative path from code that runs in the Workers
// runtime. These checks run the format helpers inside workerd, where Intl
// and the America/Chicago zone data are the platform's, not Node's, and
// confirm the output matches what the site shows.
import { describe, it, expect } from 'vitest'
import { formatDate, formatScore, formatTime, formatTimeControl } from '../../domain/format'

describe('domain/format in the Workers runtime', () => {
  it('has no browser globals to lean on', () => {
    expect(typeof (globalThis as { window?: unknown }).window).toBe('undefined')
    expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined')
  })

  it('writes scores with ½, never .5', () => {
    expect(formatScore(0)).toBe('0')
    expect(formatScore(0.5)).toBe('½')
    expect(formatScore(3.5)).toBe('3½')
    expect(formatScore(10)).toBe('10')
  })

  it('writes dates in Central time with the weekday, across both 2026 clock changes', () => {
    expect(formatDate('2026-10-25T00:00:00Z')).toBe('Sat, Oct 24')
    expect(formatDate('2026-10-24', { year: true })).toBe('Sat, Oct 24, 2026')
    expect(formatDate('2026-03-09T04:30:00Z')).toBe('Sun, Mar 8')
    expect(formatDate('2026-03-09T05:30:00Z')).toBe('Mon, Mar 9')
    expect(formatDate('2026-11-02T05:30:00Z')).toBe('Sun, Nov 1')
    expect(formatDate('2026-11-02T06:30:00Z')).toBe('Mon, Nov 2')
  })

  it('writes times as 7:00 PM with a plain space, including noon, midnight and the change minutes', () => {
    expect(formatTime('2026-10-25T00:00:00Z')).toBe('7:00 PM')
    expect(formatTime('2026-10-24T17:00:00Z')).toBe('12:00 PM')
    expect(formatTime('2026-10-24T05:00:00Z')).toBe('12:00 AM')
    expect(formatTime('2026-03-08T08:00:00Z')).toBe('3:00 AM')
    expect(formatTime('2026-11-01T07:00:00Z')).toBe('1:00 AM')
    expect(formatTime(new Date('2026-12-05T01:00:00Z'))).toMatch(/^7:00 PM$/)
  })

  it("reads a datetime('now') column as UTC when told to, as D1 writes it", () => {
    expect(formatDate('2026-10-24 02:30:00', { stored: 'utc' })).toBe('Fri, Oct 23')
    expect(formatTime('2026-10-24 02:30:00', { stored: 'utc' })).toBe('9:30 PM')
  })

  it('adds the plain companion to time controls and leaves unknown text alone', () => {
    expect(formatTimeControl('G/90+30')).toBe('G/90+30 · 90 min each + 30 sec per move')
    expect(formatTimeControl('G/30;d5')).toBe('G/30;d5 · 30 min each + 5 sec delay')
    expect(formatTimeControl('G/60')).toBe('G/60 · 60 min each')
    expect(formatTimeControl('40/90, SD/30;d5')).toBe('40/90, SD/30;d5')
  })

  it('shows nothing for a missing end date', () => {
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
})
