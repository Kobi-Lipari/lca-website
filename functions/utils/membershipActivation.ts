// functions/utils/membershipActivation.ts
//
// Turning a paid membership into an active one, in one place.
//
// This used to live only in the Stripe webhook, which made webhook delivery
// the single point of failure for every membership sold: if it did not
// arrive, the payment stayed 'pending' and the member stayed 'pending'
// forever, with nothing in the product able to notice or recover. The
// success page asked D1 whether the webhook had landed and, when it had not,
// simply said so.
//
// Both the webhook and the success page now call this, so a membership
// activates on whichever arrives first.

/**
 * A year on from whichever is later: today, or the membership already held.
 *
 * Renewing used to always set expiry to twelve months from the day the payment
 * cleared, so anyone who renewed before lapsing paid a full year and forfeited
 * whatever they had left. Extending from the existing expiry is what "renew"
 * means everywhere else.
 *
 * Falls back to today when there is no current expiry, or when the stored one
 * is in the past — a lapsed member starts their year now, not from the date
 * they let it slide.
 */
export function renewalExpiry(
  currentExpiry: string | null | undefined,
  today: Date = new Date(),
): string {
  const from = new Date(`${today.toISOString().slice(0, 10)}T00:00:00Z`)

  if (currentExpiry) {
    const existing = new Date(`${currentExpiry}T00:00:00Z`)
    if (!Number.isNaN(existing.getTime()) && existing > from) {
      existing.setUTCFullYear(existing.getUTCFullYear() + 1)
      return existing.toISOString().slice(0, 10)
    }
  }

  from.setUTCFullYear(from.getUTCFullYear() + 1)
  return from.toISOString().slice(0, 10)
}

export type ActivationResult = 'activated' | 'already-completed' | 'no-member'

/**
 * Completes a membership payment and activates the member, once.
 *
 * Two callers can now race — the webhook and the success page can arrive in
 * either order, or together. Reading the status and then writing it would let
 * both win, and both would extend the expiry, handing someone two years for
 * one payment. So the payment row is CLAIMED first with a conditional update,
 * and only the caller whose UPDATE actually changed a row goes on to touch
 * the membership.
 */
export async function activateMembershipPayment(
  db: D1Database,
  params: { paymentId: string; memberId: string; paymentIntent?: string | null },
): Promise<ActivationResult> {
  const claim = await db
    .prepare(
      `UPDATE payments
          SET status = 'completed',
              stripe_payment_intent = COALESCE(?, stripe_payment_intent)
        WHERE id = ? AND status != 'completed'`,
    )
    .bind(params.paymentIntent ?? null, params.paymentId)
    .run()

  if (claim.meta.changes === 0) return 'already-completed'

  const member = await db
    .prepare('SELECT membership_expiry FROM members WHERE id = ?')
    .bind(params.memberId)
    .first<{ membership_expiry: string | null }>()

  if (!member) return 'no-member'

  await db
    .prepare(
      `UPDATE members
          SET membership_status = 'active', membership_expiry = ?
        WHERE id = ?`,
    )
    .bind(renewalExpiry(member.membership_expiry), params.memberId)
    .run()

  return 'activated'
}
