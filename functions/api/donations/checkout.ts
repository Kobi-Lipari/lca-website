// functions/api/donations/checkout.ts
import type { Env } from '../../types'
import { optionalAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { createCheckoutSession } from '../../utils/stripe'

/**
 * Only the amount comes from the body.
 *
 * memberId used to be accepted here and written straight into
 * payments.member_id. This endpoint is unauthenticated, so anyone could
 * attribute a donation to any member id they cared to name. Nothing ever
 * sent it — the donate button only posts an amount — so it was pure attack
 * surface, and signed-in donors were recorded as anonymous either way.
 */
interface DonateBody {
  amount?: number
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const body = await parseJsonBody<DonateBody>(context.request)
  const amount = body?.amount

  // Donations stay open to anyone, signed in or not. When there is a session
  // we take the member from it, never from the request — which also means a
  // signed-in donor finally gets credited, which they previously did not.
  const authed = await optionalAuthedMember(context.request, context.env)
  const memberId = authed?.member.id ?? null

  if (!amount || typeof amount !== 'number' || amount < 1) {
    return errorResponse('Donation amount must be at least $1', 400)
  }
  if (amount > 10000) {
    return errorResponse('For donations over $10,000, please contact the board directly', 400)
  }

  const paymentId = `pay-donation-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const origin = new URL(context.request.url).origin

  let session: { id: string; url: string }
  try {
    session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
      productName: 'Donation to Louisiana Chess Association',
      amountUsd: amount,
      successUrl: `${origin}/donate/success?paymentId=${paymentId}`,
      cancelUrl: `${origin}/`,
      clientReferenceId: paymentId,
      metadata: {
        payment_id: paymentId,
        type: 'donation',
        member_id: memberId ?? '',
      },
    })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return errorResponse('Could not start the payment process. Please try again in a moment.', 502)
  }

  await context.env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id)
     VALUES (?, ?, ?, 'donation', 'donation', 'pending', ?)`,
  ).bind(paymentId, memberId, amount, session.id).run()

  return jsonResponse({ paymentId, paymentUrl: session.url })
}