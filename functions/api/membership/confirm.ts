// functions/api/membership/confirm.ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { activateMembershipPayment } from '../../utils/membershipActivation'
import { retrieveCheckoutSession } from '../../utils/stripe'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'

interface ConfirmBody {
  paymentId?: string
}

interface PaymentRow {
  id: string
  status: string
  reference_id: string
  stripe_session_id: string | null
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<ConfirmBody>(context.request)
  if (!body?.paymentId) {
    return errorResponse('paymentId is required', 400)
  }

  const payment = await context.env.DB.prepare(
    `SELECT id, status, reference_id, stripe_session_id
       FROM payments
      WHERE id = ? AND member_id = ? AND type = 'membership'`,
  ).bind(body.paymentId, authed.member.id).first<PaymentRow>()

  if (!payment) {
    return errorResponse('Payment not found', 404)
  }

  const respond = async (alreadyConfirmed: boolean) => {
    const member = await context.env.DB.prepare('SELECT * FROM members WHERE id = ?')
      .bind(authed.member.id)
      .first()
    return jsonResponse({
      member,
      tier: payment.reference_id,
      ...(alreadyConfirmed ? { alreadyConfirmed: true } : { pending: true }),
    })
  }

  if (payment.status === 'completed') {
    return respond(true)
  }

  // Still pending in our records. That used to be the end of it: this route
  // only ever read D1, so a webhook that never arrived left the payment
  // pending and the member pending, permanently, with nothing able to notice.
  // Ask Stripe whether the money actually moved.
  if (!payment.stripe_session_id) {
    return respond(false)
  }

  let session
  try {
    session = await retrieveCheckoutSession(
      context.env.STRIPE_SECRET_KEY,
      payment.stripe_session_id,
    )
  } catch (err) {
    // Stripe being unreachable is not evidence of anything. Report pending
    // and let the member retry, which is what the success page offers.
    console.warn(
      `Could not confirm payment ${payment.id} with Stripe: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    return respond(false)
  }

  if (session?.payment_status !== 'paid') {
    return respond(false)
  }

  await activateMembershipPayment(context.env.DB, {
    paymentId: payment.id,
    memberId: authed.member.id,
    paymentIntent: session.payment_intent,
  })

  return respond(true)
}
