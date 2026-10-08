// domain/membership/tiers.ts
//
// LCA membership prices in whole US dollars, one year each. Checkout charges
// these (functions/api/membership/checkout.ts) and the membership page shows
// them (src/pages/MembershipPage.tsx), so the two cannot disagree.

export const MEMBERSHIP_TIER_PRICES = {
  adult: 15,
  scholastic: 5,
  family: 25,
  senior: 10,
} as const

export type MembershipTier = keyof typeof MEMBERSHIP_TIER_PRICES

export function isMembershipTier(value: unknown): value is MembershipTier {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MEMBERSHIP_TIER_PRICES, value)
}
