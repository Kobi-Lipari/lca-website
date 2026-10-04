import { describe, expect, it } from 'vitest'
import { serverTime } from '../../src/lib/serverTime'

describe('database timestamps shown in the browser', () => {
  it('are read as UTC, not as the local time of whoever is looking', () => {
    // A support message stored at 21:05 UTC is 4:05 PM in Louisiana. Parsed
    // with new Date() alone it came out as 9:05 PM.
    expect(serverTime('2026-10-04 21:05:00').toISOString()).toBe('2026-10-04T21:05:00.000Z')
  })

  it('leaves a value that already says its zone alone', () => {
    expect(serverTime('2026-10-04T21:05:00.000Z').toISOString()).toBe('2026-10-04T21:05:00.000Z')
  })
})
