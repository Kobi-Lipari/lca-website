import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface ConfirmBody {
  paymentId?: string
}

function oneYearFromNow(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() + 1)
  return date.toISOString().slice(0, 10)
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<ConfirmBody>(context.request)
  if (!body?.paymentId) {
    return errorResponse('paymentId is required', 400)
  }

  const payment = await context.env.DB.prepare(
    `SELECT * FROM payments WHERE id = ? AND member_id = ? AND type = 'membership'`,
  )
    .bind(body.paymentId, authed.member.id)
    .first<{
      id: string
      status: string
      reference_id: string
    }>()

  if (!payment) {
    return errorResponse('Payment not found', 404)
  }

  if (payment.status === 'completed') {
    const member = await context.env.DB.prepare(
      'SELECT * FROM members WHERE id = ?',
    )
      .bind(authed.member.id)
      .first()
    return jsonResponse({ member, alreadyConfirmed: true })
  }

  const expiry = oneYearFromNow()

  await context.env.DB.batch([
    context.env.DB.prepare(
      `UPDATE payments SET status = 'completed' WHERE id = ?`,
    ).bind(payment.id),
    context.env.DB.prepare(
      `UPDATE members SET membership_status = 'active', membership_expiry = ? WHERE id = ?`,
    ).bind(expiry, authed.member.id),
  ])

  const member = await context.env.DB.prepare(
    'SELECT * FROM members WHERE id = ?',
  )
    .bind(authed.member.id)
    .first()

  return jsonResponse({ member, tier: payment.reference_id })
}
