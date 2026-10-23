// functions/api/membership/confirm.ts
//
// POST { paymentId? }: where a membership payment stands, in words the
// success page and the profile can show. With no paymentId the member's
// latest membership payment is checked, so "what is going on with my
// membership?" has an answer from any device, not only the tab that paid.
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { activateMembershipPayment } from '../../utils/membership/membershipActivation'
import { retrieveCheckoutSession } from '../../utils/stripe'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'

interface ConfirmBody {
  paymentId?: string | null
}

interface PaymentRow {
  id: string
  status: string
  reference_id: string
  stripe_session_id: string | null
  created_at: string
}

/**
 * What happened to the payment, as the pages tell it:
 * - paid: the money moved and the membership is active.
 * - processing: Stripe has the checkout but the payment has not cleared yet.
 * - open: the Stripe page was never finished; nothing has been charged and
 *   the member can still finish paying there (paymentUrl).
 * - expired: the Stripe page lapsed with nothing charged; start again.
 * - unknown: Stripe could not be asked (unreachable, or a payment with no
 *   Stripe session, such as one taken by hand).
 * - none: this member has never started a membership payment.
 */
export type PaymentState = 'paid' | 'processing' | 'open' | 'expired' | 'unknown' | 'none'

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = (await parseJsonBody<ConfirmBody>(context.request)) ?? {}
  const paymentId = typeof body.paymentId === 'string' && body.paymentId ? body.paymentId : null

  const payment = paymentId
    ? await context.env.DB.prepare(
        `SELECT id, status, reference_id, stripe_session_id, created_at
           FROM payments
          WHERE id = ? AND member_id = ? AND type = 'membership'`,
      ).bind(paymentId, authed.member.id).first<PaymentRow>()
    : await context.env.DB.prepare(
        `SELECT id, status, reference_id, stripe_session_id, created_at
           FROM payments
          WHERE member_id = ? AND type = 'membership'
          ORDER BY created_at DESC, rowid DESC
          LIMIT 1`,
      ).bind(authed.member.id).first<PaymentRow>()

  if (!payment) {
    if (paymentId) return errorResponse('Payment not found', 404)
    const member = await context.env.DB.prepare('SELECT * FROM members WHERE id = ?')
      .bind(authed.member.id)
      .first()
    const paymentState: PaymentState = 'none'
    return jsonResponse({ member, tier: null, paymentState, pending: true })
  }

  const respond = async (paymentState: PaymentState, extra: Record<string, unknown> = {}) => {
    const member = await context.env.DB.prepare('SELECT * FROM members WHERE id = ?')
      .bind(authed.member.id)
      .first()
    return jsonResponse({
      member,
      tier: payment.reference_id,
      paymentId: payment.id,
      startedAt: payment.created_at,
      paymentState,
      ...(paymentState === 'paid' ? { alreadyConfirmed: true } : { pending: true }),
      ...extra,
    })
  }

  if (payment.status === 'completed') {
    return respond('paid')
  }
  if (payment.status === 'failed') {
    return respond('expired')
  }

  // Still pending in our records. That used to be the end of it: this route
  // only ever read D1, so a webhook that never arrived left the payment
  // pending and the member pending, permanently, with nothing able to notice.
  // Ask Stripe whether the money actually moved.
  if (!payment.stripe_session_id) {
    return respond('unknown')
  }

  let session
  try {
    session = await retrieveCheckoutSession(
      context.env.STRIPE_SECRET_KEY,
      payment.stripe_session_id,
    )
  } catch (err) {
    // Stripe being unreachable is not evidence of anything. Say so and let
    // the member check again, which is what the success page offers.
    console.warn(
      `Could not confirm payment ${payment.id} with Stripe: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return respond('unknown')
  }

  if (!session) return respond('unknown')

  if (session.payment_status === 'paid') {
    await activateMembershipPayment(context.env.DB, {
      paymentId: payment.id,
      memberId: authed.member.id,
      paymentIntent: session.payment_intent,
    })
    return respond('paid')
  }

  if (session.status === 'expired') {
    // Nothing was charged and nothing can be now. Record it, so the row
    // stops reading as a payment in progress.
    await context.env.DB.prepare(
      `UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'`,
    ).bind(payment.id).run()
    return respond('expired')
  }

  if (session.status === 'complete') {
    return respond('processing')
  }

  return respond('open', { paymentUrl: session.url })
}
