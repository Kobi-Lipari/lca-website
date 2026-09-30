import { describe, expect, it } from 'vitest'
import { hasPassed, lcaTimeToMs } from '../../functions/utils/time'

describe('Central wall-clock times', () => {
  it('reads a datetime-local value as Central time, across daylight saving', () => {
    expect(new Date(lcaTimeToMs('2026-10-17T18:00')).toISOString()).toBe('2026-10-17T23:00:00.000Z') // CDT
    expect(new Date(lcaTimeToMs('2026-01-15T18:00')).toISOString()).toBe('2026-01-16T00:00:00.000Z') // CST
  })

  it('treats a bare date as the end of that day', () => {
    expect(new Date(lcaTimeToMs('2026-10-17')).toISOString()).toBe('2026-10-18T04:59:59.000Z')
  })

  it('keeps an explicit zone as given', () => {
    expect(new Date(lcaTimeToMs('2026-10-17T18:00:00Z')).toISOString()).toBe('2026-10-17T18:00:00.000Z')
  })

  it('does not close registration hours early', () => {
    // 6 PM Central close; at 5 PM Central (22:00 UTC) it is still open.
    const fivePmCentral = Date.parse('2026-10-17T22:00:00Z')
    expect(hasPassed('2026-10-17T18:00', fivePmCentral)).toBe(false)
    expect(hasPassed('2026-10-17T18:00', fivePmCentral + 2 * 3600_000)).toBe(true)
  })
})
