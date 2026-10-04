import { describe, expect, it } from 'vitest'
import { serverTime } from '../../src/lib/serverTime'

describe('database timestamps shown in the browser', () => {
  it('are read as UTC, not as the local time of whoever is looking', () => {
    // A support message stored at 21:05 UTC is 4:05 PM in Louisiana. Parsed
    // with new Date() alone it came out as 9:05 PM.
    expect(serverTime('2026-10-04 21:05:00').toISOString()).toBe('2026-10-04T21:05:00.000Z')
  })

  it('fall on the right day where only the date is shown', () => {
    // The dashboard's ticket list shows the date alone. A ticket updated at
    // 8:30 PM in Louisiana is stored as 01:30 UTC the next day; read as
    // local time it showed tomorrow's date.
    const shown = serverTime('2026-10-05 01:30:00')
      .toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
    expect(shown).toBe('10/4/2026')
  })

  it('leaves a value that already says its zone alone', () => {
    expect(serverTime('2026-10-04T21:05:00.000Z').toISOString()).toBe('2026-10-04T21:05:00.000Z')
  })
})
