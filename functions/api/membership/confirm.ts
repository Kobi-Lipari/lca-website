import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, jsonResponse, parseJsonBody } from '../../utils/response'

interface ConfirmBody {
  paymentId?: string
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<ConfirmBody>(context.request)
  if (!body?.paymentId) {
    return errorResponse('paymentId is required', 400)
  }

  const payment = await context.env.DB.prepare(
    `SELECT * FROM payments WHERE id = ? AND member_id = ? AND type = 'membership'`
  ).bind(body.paymentId, authed.member.id).first<{ id: string; status: string; reference_id: string }>()

  if (!payment) {
    return errorResponse('Payment not found', 404)
  }

  const member = await context.env.DB.prepare('SELECT * FROM members WHERE id = ?')
    .bind(authed.member.id)
    .first()

  if (payment.status === 'completed') {
    return jsonResponse({ member, tier: payment.reference_id, alreadyConfirmed: true })
  }

  // Webhook may not have arrived yet (Stripe delivers async, usually within seconds)
  return jsonResponse({ member, tier: payment.reference_id, pending: true })
}