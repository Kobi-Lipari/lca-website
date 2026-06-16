import type { Env } from '../../types'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface StripeWebhookEvent {
  type?: string
  data?: {
    object?: {
      id?: string
      metadata?: {
        payment_id?: string
        member_id?: string
      }
    }
  }
}

function oneYearFromNow(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

async function completePayment(
  db: D1Database,
  paymentId: string,
): Promise<boolean> {
  const payment = await db
    .prepare('SELECT * FROM payments WHERE id = ?')
    .bind(paymentId)
    .first<{
      id: string
      member_id: string
      type: string
      reference_id: string
      status: string
    }>()

  if (!payment || payment.status === 'completed') {
    return false
  }

  if (payment.type === 'membership') {
    await db.batch([
      db.prepare(`UPDATE payments SET status = 'completed' WHERE id = ?`).bind(
        payment.id,
      ),
      db
        .prepare(
          `UPDATE members SET membership_status = 'active', membership_expiry = ? WHERE id = ?`,
        )
        .bind(oneYearFromNow(), payment.member_id),
    ])
    return true
  }

  if (payment.type === 'tournament') {
    await db.batch([
      db.prepare(`UPDATE payments SET status = 'completed' WHERE id = ?`).bind(
        payment.id,
      ),
      db
        .prepare(
          `UPDATE registrations SET payment_status = 'paid' WHERE id = ?`,
        )
        .bind(payment.reference_id),
    ])
    return true
  }

  return false
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<StripeWebhookEvent & { paymentId?: string }>(
    context.request,
  )

  if (!body) {
    return errorResponse('Invalid JSON body', 400)
  }

  // Placeholder: accept { paymentId } for testing until Stripe webhook is configured
  if (body.paymentId) {
    const webhookSecret = context.env.STRIPE_WEBHOOK_SECRET
    const providedSecret = context.request.headers.get('X-LCA-Webhook-Secret')
    if (webhookSecret && providedSecret !== webhookSecret) {
      return errorResponse('Unauthorized', 401)
    }

    const updated = await completePayment(context.env.DB, body.paymentId)
    if (!updated) {
      return errorResponse('Payment not found or already completed', 404)
    }
    return jsonResponse({ received: true })
  }

  // Future Stripe webhook shape
  if (body.type === 'checkout.session.completed') {
    const paymentId = body.data?.object?.metadata?.payment_id
    if (paymentId) {
      await completePayment(context.env.DB, paymentId)
    }
    return jsonResponse({ received: true })
  }

  return jsonResponse({ received: true, ignored: true })
}
