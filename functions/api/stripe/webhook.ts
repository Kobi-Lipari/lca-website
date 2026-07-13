// functions/api/stripe/webhook.ts
import type { Env } from '../../types'
import { jsonResponse, errorResponse } from '../../utils/response'
import { verifyStripeSignature } from '../../utils/stripe'

function oneYearFromNow(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const signature = context.request.headers.get('stripe-signature')
  const rawBody = await context.request.text()

  if (!signature || !(await verifyStripeSignature(rawBody, signature, context.env.STRIPE_WEBHOOK_SECRET))) {
    return errorResponse('Invalid signature', 400)
  }

  const event = JSON.parse(rawBody) as any

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
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
        const expiry = oneYearFromNow()
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
