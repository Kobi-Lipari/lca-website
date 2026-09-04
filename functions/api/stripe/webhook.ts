// functions/api/stripe/webhook.ts
import type { Env } from '../../types'
import { jsonResponse, errorResponse } from '../../utils/response'
import { verifyStripeSignature } from '../../utils/stripe'

/**
 * A year on from whichever is later: today, or the membership already held.
 *
 * Renewing used to always set expiry to twelve months from the day the payment
 * cleared, so anyone who renewed before lapsing paid a full year and forfeited
 * whatever they had left. Extending from the existing expiry is what "renew"
 * means everywhere else.
 *
 * Falls back to today when there is no current expiry, or when the stored one
 * is in the past — a lapsed member starts their year now, not from the date
 * they let it slide.
 */
export function renewalExpiry(
  currentExpiry: string | null | undefined,
  today: Date = new Date(),
): string {
  const from = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`)

  if (currentExpiry) {
    const existing = new Date(`${currentExpiry}T00:00:00Z`)
    if (!Number.isNaN(existing.getTime()) && existing > from) {
      existing.setUTCFullYear(existing.getUTCFullYear() + 1)
      return existing.toISOString().slice(0, 10)
    }
  }

  from.setUTCFullYear(from.getUTCFullYear() + 1)
  return from.toISOString().slice(0, 10)
}

/**
 * The part of a Stripe event this handler reads.
 *
 * Deliberately narrow rather than a full Stripe type: everything here is
 * optional because it arrives from the network, and writing it out is what
 * forces the metadata lookups below to be guarded instead of assumed.
 */
interface StripeWebhookEvent {
  type?: string
  data?: {
    object?: {
      payment_intent?: string | null
      metadata?: {
        payment_id?: string
        type?: string
        member_id?: string
        registration_id?: string
      }
    }
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const signature = context.request.headers.get('stripe-signature')
  const rawBody = await context.request.text()

  if (!signature || !(await verifyStripeSignature(rawBody, signature, context.env.STRIPE_WEBHOOK_SECRET))) {
    return errorResponse('Invalid signature', 400)
  }

  const event = JSON.parse(rawBody) as StripeWebhookEvent

  if (event.type === 'checkout.session.completed') {
    const session = event.data?.object
    // A completed-checkout event with no session object is not something we
    // can act on. Acknowledge it so Stripe stops retrying rather than
    // throwing and inviting the same malformed delivery back.
    if (!session) return jsonResponse({ received: true })
    const paymentId = session.metadata?.payment_id
    const type = session.metadata?.type

    // Donations: mark the payment completed, no other records to update
    if (type === 'donation') {
      if (paymentId) {
        await context.env.DB.prepare(
          `UPDATE payments SET status = 'completed', stripe_payment_intent = ? WHERE id = ?`
        ).bind(session.payment_intent ?? null, paymentId).run()
      }
      return jsonResponse({ received: true })
    }

    // Tournament entries: complete the payment and confirm the registration
    if (type === 'tournament') {
      const registrationId = session.metadata?.registration_id
      if (paymentId && registrationId) {
        const payment = await context.env.DB.prepare(
          `SELECT status FROM payments WHERE id = ?`
        ).bind(paymentId).first<{ status: string }>()

        // Idempotency guard: Stripe retries delivery, and the retry-pay flow
        // can produce multiple sessions for one payment
        if (payment && payment.status !== 'completed') {
          await context.env.DB.batch([
            context.env.DB.prepare(
              `UPDATE payments SET status = 'completed', stripe_payment_intent = ? WHERE id = ?`
            ).bind(session.payment_intent ?? null, paymentId),
            context.env.DB.prepare(
              `UPDATE registrations SET payment_status = 'paid' WHERE id = ?`
            ).bind(registrationId),
          ])
        }
      }
      return jsonResponse({ received: true })
    }

    // Memberships: activate the member on successful payment.
    // Explicit type check so unknown types no-op safely.
    if (type === 'membership') {
      const memberId = session.metadata?.member_id
      if (!paymentId || !memberId) {
        return jsonResponse({ received: true })
      }

      const payment = await context.env.DB.prepare(
        `SELECT status FROM payments WHERE id = ?`
      ).bind(paymentId).first<{ status: string }>()

      // Idempotency guard: Stripe can retry webhook delivery
      if (payment && payment.status !== 'completed') {
        const member = await context.env.DB.prepare(
          `SELECT membership_expiry FROM members WHERE id = ?`
        ).bind(memberId).first<{ membership_expiry: string | null }>()

        const expiry = renewalExpiry(member?.membership_expiry)
        await context.env.DB.batch([
          context.env.DB.prepare(
            `UPDATE payments SET status = 'completed', stripe_payment_intent = ? WHERE id = ?`
          ).bind(session.payment_intent ?? null, paymentId),
          context.env.DB.prepare(
            `UPDATE members SET membership_status = 'active', membership_expiry = ? WHERE id = ?`
          ).bind(expiry, memberId),
        ])
      }
    }
  }

  return jsonResponse({ received: true })
}
