// test/integration/membership-activation.test.ts
//
// A paid membership must end up active even when the first attempt to record
// it fails part-way. Stripe redelivers a webhook that got a 500, and the
// success page asks again, so a retry always comes; it has to be able to
// finish the job.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness, signStripePayload } from './harness'
import { seedMember } from './factories'

import { onRequestPost as webhookPost } from '../../functions/api/stripe/webhook'

beforeEach(resetHarness)

async function membershipPaid(paymentId: string, memberId: string) {
  const rawBody = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { payment_intent: 'pi_membership', metadata: { type: 'membership', payment_id: paymentId, member_id: memberId } } },
  })
  return invoke(webhookPost, {
    method: 'POST', rawBody, headers: { 'stripe-signature': await signStripePayload(rawBody) },
  })
}

describe('a membership payment whose first delivery fails part-way', () => {
  it('is activated by the retry', async () => {
    const memberId = await seedMember({ membershipStatus: 'pending' })
    const paymentId = `pay-${memberId}`
    await env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, 25, 'membership', 'adult', 'pending')`,
    ).bind(paymentId, memberId).run()

    // Stands in for the database failing between two statements: the member
    // row cannot be updated during the first delivery.
    await env.DB.prepare(
      `CREATE TRIGGER fail_member_update BEFORE UPDATE OF membership_status ON members
       BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`,
    ).run()
    try {
      await expect(membershipPaid(paymentId, memberId)).rejects.toThrow(/simulated failure/)
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_member_update').run()
    }

    // Nothing half-done: the payment is still open for the retry to claim.
    const afterFailure = await env.DB.prepare('SELECT status FROM payments WHERE id = ?')
      .bind(paymentId).first<{ status: string }>()
    expect(afterFailure?.status).toBe('pending')

    expect((await membershipPaid(paymentId, memberId)).status).toBe(200)

    const member = await env.DB.prepare('SELECT membership_status, membership_expiry, membership_type FROM members WHERE id = ?')
      .bind(memberId).first<{ membership_status: string; membership_expiry: string | null; membership_type: string | null }>()
    expect(member?.membership_status).toBe('active')
    expect(member?.membership_expiry).toBeTruthy()
    expect(member?.membership_type).toBe('adult')
    const payment = await env.DB.prepare('SELECT status, stripe_payment_intent FROM payments WHERE id = ?')
      .bind(paymentId).first<{ status: string; stripe_payment_intent: string | null }>()
    expect(payment).toEqual({ status: 'completed', stripe_payment_intent: 'pi_membership' })
  })

  it('a second delivery after a clean one still extends the membership only once', async () => {
    const memberId = await seedMember({ membershipStatus: 'pending' })
    const paymentId = `pay-${memberId}`
    await env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
       VALUES (?, ?, 25, 'membership', 'adult', 'pending')`,
    ).bind(paymentId, memberId).run()

    await membershipPaid(paymentId, memberId)
    const first = await env.DB.prepare('SELECT membership_expiry FROM members WHERE id = ?')
      .bind(memberId).first<{ membership_expiry: string }>()
    await Promise.all([membershipPaid(paymentId, memberId), membershipPaid(paymentId, memberId)])
    const again = await env.DB.prepare('SELECT membership_expiry FROM members WHERE id = ?')
      .bind(memberId).first<{ membership_expiry: string }>()
    expect(again?.membership_expiry).toBe(first?.membership_expiry)
  })
})
