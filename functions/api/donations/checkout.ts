import type { Env } from '../../types'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { createCheckoutSession } from '../../utils/stripe'

interface DonateBody {
  amount?: number
  memberId?: string | null
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<DonateBody>(context.request)
  const amount = body?.amount

  if (!amount || typeof amount !== 'number' || amount < 1) {
    return errorResponse('Donation amount must be at least $1', 400)
  }
  if (amount > 10000) {
    return errorResponse('For donations over $10,000, please contact the board directly', 400)
  }

  const paymentId = `pay-donation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const origin = new URL(context.request.url).origin

  const session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
    productName: 'Donation to Louisiana Chess Association',
    amountUsd: amount,
    successUrl: `${origin}/donate/success?paymentId=${paymentId}`,
    cancelUrl: `${origin}/`,
    clientReferenceId: paymentId,
    metadata: {
      payment_id: paymentId,
      type: 'donation',
      member_id: body?.memberId ?? '',
    },
  })

  await context.env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id)
     VALUES (?, ?, ?, 'donation', 'donation', 'pending', ?)`
  ).bind(paymentId, body?.memberId ?? null, amount, session.id).run()

  return jsonResponse({ paymentId, paymentUrl: session.url })
}