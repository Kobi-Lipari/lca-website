// functions/api/membership/checkout.ts
import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import { errorResponse, handleOptions, jsonResponse, parseJsonBody } from '../../utils/response'
import { createCheckoutSession } from '../../utils/stripe'

interface CheckoutBody {
  tier?: string
}

const TIER_PRICES: Record<string, number> = {
  adult: 15,
  scholastic: 5,
  family: 25,
  senior: 10,
}

const TIER_LABELS: Record<string, string> = {
  adult: 'LCA Adult Membership (1 year)',
  scholastic: 'LCA Scholastic Membership (1 year)',
  family: 'LCA Family Membership (1 year)',
  senior: 'LCA Senior Membership (1 year)',
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<CheckoutBody>(context.request)
  const tier = body?.tier

  // Tier is required — the old '?? "regular"' fallback wasn't a real tier
  // and rejected any request without one anyway.
  if (!tier || TIER_PRICES[tier] === undefined) {
    return errorResponse('Invalid membership tier', 400)
  }

  const paymentId = `pay-membership-${authed.member.id}-${Date.now().toString(36)}`
  const amount = TIER_PRICES[tier]
  const origin = new URL(context.request.url).origin

  let session: { id: string; url: string }
  try {
    session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
      productName: TIER_LABELS[tier],
      amountUsd: amount,
      successUrl: `${origin}/membership/success?paymentId=${paymentId}`,
      cancelUrl: `${origin}/membership`,
      clientReferenceId: paymentId,
      metadata: {
        payment_id: paymentId,
        member_id: authed.member.id,
        tier,
        type: 'membership',
      },
    })
  } catch (err) {
    console.error('Stripe session creation failed:', err)
    return errorResponse(
      'Could not start the payment process. Please try again in a moment.',
      502,
    )
  }

  await context.env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id)
     VALUES (?, ?, ?, 'membership', ?, 'pending', ?)`
  ).bind(paymentId, authed.member.id, amount, tier, session.id).run()

  return jsonResponse({
    paymentId,
    tier,
    amount,
    paymentUrl: session.url,
    successUrl: `/membership/success?paymentId=${paymentId}`,
  })
}
