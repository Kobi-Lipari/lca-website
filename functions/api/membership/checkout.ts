import type { Env } from '../../types'
import { isResponse, requireAuthedMember } from '../../utils/auth'
import {
  errorResponse,
  handleOptions,
  jsonResponse,
  parseJsonBody,
} from '../../utils/response'

interface CheckoutBody {
  tier?: string
}

const TIER_PRICES: Record<string, number> = {
  regular: 35,
  scholastic: 20,
  club: 150,
}

function membershipPaymentUrl(env: Env, tier: string): string {
  const urls: Record<string, string | undefined> = {
    regular: env.STRIPE_MEMBERSHIP_REGULAR_URL,
    scholastic: env.STRIPE_MEMBERSHIP_SCHOLASTIC_URL,
    club: env.STRIPE_MEMBERSHIP_CLUB_URL,
  }
  return (
    urls[tier] ??
    env.STRIPE_MEMBERSHIP_URL ??
    'https://buy.stripe.com/test_lca_membership_placeholder'
  )
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

  await context.env.DB.prepare(
    `INSERT INTO payments (id, member_id, amount, type, reference_id, status)
     VALUES (?, ?, ?, 'membership', ?, 'pending')`,
  )
    .bind(paymentId, authed.member.id, amount, tier)
    .run()

  return jsonResponse({
    paymentId,
    tier,
    amount,
    paymentUrl: membershipPaymentUrl(context.env, tier),
    successUrl: `/membership/success?paymentId=${paymentId}`,
  })
}
