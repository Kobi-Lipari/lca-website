// test/unit/scan-day.test.ts — which day a scan counts against.
import { describe, expect, it } from 'vitest'
import { scanDay } from '../../functions/utils/scan/day'

describe('scanDay', () => {
  it('uses the Louisiana date, not the UTC one', () => {
    // 10 pm Central on the 27th is already the 28th in UTC.
    expect(scanDay(new Date('2026-09-28T03:00:00Z'))).toBe('2026-09-27')
  })

  it('rolls over at midnight Central in summer (CDT, UTC-5)', () => {
    expect(scanDay(new Date('2026-07-01T04:59:00Z'))).toBe('2026-06-30')
    expect(scanDay(new Date('2026-07-01T05:00:00Z'))).toBe('2026-07-01')
  })

  it('rolls over at midnight Central in winter (CST, UTC-6)', () => {
    expect(scanDay(new Date('2026-01-15T05:59:00Z'))).toBe('2026-01-14')
    expect(scanDay(new Date('2026-01-15T06:00:00Z'))).toBe('2026-01-15')
  })
})
