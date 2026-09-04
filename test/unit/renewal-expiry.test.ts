// test/unit/renewal-expiry.test.ts
import { describe, expect, it } from 'vitest'
import { renewalExpiry } from '../../functions/api/stripe/webhook'

const JUN_15 = new Date('2026-06-15T12:00:00Z')

describe('renewalExpiry', () => {
  it('gives a lapsed member a year from today', () => {
    // Expired last year — they start fresh rather than being credited for
    // the months they were not a member.
    expect(renewalExpiry('2025-11-01', JUN_15)).toBe('2027-06-15')
  })

  it('gives a brand new member a year from today', () => {
    expect(renewalExpiry(null, JUN_15)).toBe('2027-06-15')
    expect(renewalExpiry(undefined, JUN_15)).toBe('2027-06-15')
  })

  it('extends from the existing expiry when renewing early', () => {
    // The bug this replaces: renewing on 15 June with three months left used
    // to return 2027-06-15, silently discarding until 2026-09-30.
    expect(renewalExpiry('2026-09-30', JUN_15)).toBe('2027-09-30')
  })

  it('never loses time, however early the renewal', () => {
    // Eleven months early. The member keeps every day they paid for.
    expect(renewalExpiry('2027-05-01', JUN_15)).toBe('2028-05-01')
  })

  it('treats an expiry of today as lapsed rather than extending it', () => {
    // Same-day is the boundary; today is not "later than today", so the year
    // runs from now. Either reading is defensible — this pins the choice.
    expect(renewalExpiry('2026-06-15', JUN_15)).toBe('2027-06-15')
  })

  it('falls back to today when the stored expiry is unparseable', () => {
    // A malformed row must not produce an Invalid Date written back to D1.
    expect(renewalExpiry('not-a-date', JUN_15)).toBe('2027-06-15')
    expect(renewalExpiry('', JUN_15)).toBe('2027-06-15')
  })

  it('handles a leap day without drifting', () => {
    // 29 Feb 2028 + 1 year has no 29 Feb to land on. JS rolls to 1 March,
    // which is the behaviour to be aware of, not a bug to hide.
    expect(renewalExpiry('2028-02-29', new Date('2027-01-01T12:00:00Z'))).toBe('2029-03-01')
  })

  it('returns a plain YYYY-MM-DD, which is what the column stores', () => {
    expect(renewalExpiry('2026-09-30', JUN_15)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(renewalExpiry(null, JUN_15)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
