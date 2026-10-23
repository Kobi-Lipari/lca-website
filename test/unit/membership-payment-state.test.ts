// test/unit/membership-payment-state.test.ts
//
// The words a member reads about a membership payment: never "payment
// received" for money that never moved, the date in the site's style, and
// the right next step for each state.
import { describe, expect, it } from 'vitest'

import { paymentStateCopy, startedOn } from '../../src/areas/membership/paymentState'

describe('startedOn', () => {
  // Noon UTC, so the calendar day is the same in every time zone a test can run in.
  it('reads the database timestamp as UTC and writes the weekday, month, day and year', () => {
    expect(startedOn('2026-10-16 12:00:00')).toBe('Friday, October 16, 2026')
  })

  it('reads an ISO timestamp too', () => {
    expect(startedOn('2026-10-16T12:00:00.000Z')).toBe('Friday, October 16, 2026')
  })

  it('drops the date rather than printing Invalid Date', () => {
    expect(startedOn('not a date')).toBeNull()
    expect(startedOn(null)).toBeNull()
    expect(startedOn(undefined)).toBeNull()
  })
})

describe('paymentStateCopy', () => {
  it('says nothing was charged whenever nothing was', () => {
    for (const state of ['open', 'expired', 'none'] as const) {
      const copy = paymentStateCopy(state)
      expect(copy.body).toMatch(/nothing (has been|was) charged/i)
      expect(copy.heading).not.toMatch(/received|confirmed/i)
    }
  })

  it('offers the way back to the Stripe page only while it is still open', () => {
    expect(paymentStateCopy('open').canFinishPaying).toBe(true)
    for (const state of ['paid', 'processing', 'expired', 'unknown', 'none'] as const) {
      expect(paymentStateCopy(state).canFinishPaying).toBe(false)
    }
  })

  it('offers "check again" and support only where the answer can still change', () => {
    for (const state of ['processing', 'unknown'] as const) {
      expect(paymentStateCopy(state).canCheckAgain).toBe(true)
      expect(paymentStateCopy(state).offerSupport).toBe(true)
    }
    for (const state of ['paid', 'open', 'expired', 'none'] as const) {
      expect(paymentStateCopy(state).canCheckAgain).toBe(false)
      expect(paymentStateCopy(state).offerSupport).toBe(false)
    }
  })

  it('names the day the payment was started when it is known', () => {
    expect(paymentStateCopy('open', '2026-10-16 12:00:00').body).toContain('on Friday, October 16, 2026')
    expect(paymentStateCopy('open').body).not.toContain(' on ')
  })

  it('confirms only a paid membership', () => {
    expect(paymentStateCopy('paid').heading).toBe('Membership confirmed')
  })
})
