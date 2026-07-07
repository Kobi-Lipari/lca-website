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
  test: 0.5, // TODO: remove this tier before public launch — board demo only
}

const TIER_LABELS: Record<string, string> = {
  adult: 'LCA Adult Membership (1 year)',
  scholastic: 'LCA Scholastic Membership (1 year)',
  family: 'LCA Family Membership (1 year)',
  senior: 'LCA Senior Membership (1 year)',
  test: 'LCA Test Membership (demo)',
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authed = await requireAuthedMember(context.request, context.env)
  if (isResponse(authed)) return authed

  const body = await parseJsonBody<CheckoutBody>(context.request)
  const tier = body?.tier ?? 'regular'

  if (!TIER_PRICES[tier]) {
    return errorResponse('Invalid membership tier', 400)
  }

  const paymentId = `pay-membership-${authed.member.id}-${Date.now().toString(36)}`
  const amount = TIER_PRICES[tier]
  const origin = new URL(context.request.url).origin

  const session = await createCheckoutSession(context.env.STRIPE_SECRET_KEY, {
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