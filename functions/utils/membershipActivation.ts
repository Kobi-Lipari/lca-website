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

import { syncFamilyCoverage } from './family'

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

const KNOWN_TIERS = new Set(['adult', 'scholastic', 'family', 'senior'])

export type ActivationResult = 'activated' | 'already-completed' | 'no-member'

/**
 * Completes a membership payment and activates the member, once.
 *
 * Two callers can now race — the webhook and the success page can arrive in
 * either order, or together. Reading the status and then writing it would let
 * both win, and both would extend the expiry, handing someone two years for
 * one payment. So the payment row is CLAIMED with a conditional update, and
 * the membership changes only in the same transaction as a claim that
 * actually changed a row.
 */
export async function activateMembershipPayment(
  db: D1Database,
  params: { paymentId: string; memberId: string; paymentIntent?: string | null },
): Promise<ActivationResult> {
  const member = await db
    .prepare('SELECT membership_expiry FROM members WHERE id = ?')
    .bind(params.memberId)
    .first<{ membership_expiry: string | null }>()

  // The tier bought is stored on the payment (reference_id). Recording it on
  // the member is what lets a family membership extend to the children.
  const payment = await db
    .prepare('SELECT reference_id FROM payments WHERE id = ?')
    .bind(params.paymentId)
    .first<{ reference_id: string | null }>()
  const tier = payment?.reference_id && KNOWN_TIERS.has(payment.reference_id) ? payment.reference_id : null

  // One batch, so one transaction: the member is activated only while the
  // payment is still unclaimed, and the payment is claimed with it. These
  // used to be separate statements with the claim first. When the member
  // update then failed, the payment was already 'completed', so every retry
  // (Stripe redelivering, the success page) saw it as done and the member
  // who had paid was never activated.
  const [, claim] = await db.batch([
    db
      .prepare(
        `UPDATE members
            SET membership_status = 'active', membership_expiry = ?1,
                membership_type = COALESCE(?2, membership_type)
          WHERE id = ?3
            AND EXISTS (SELECT 1 FROM payments WHERE id = ?4 AND status != 'completed')`,
      )
      .bind(renewalExpiry(member?.membership_expiry), tier, params.memberId, params.paymentId),
    db
      .prepare(
        `UPDATE payments
            SET status = 'completed',
                stripe_payment_intent = COALESCE(?, stripe_payment_intent)
          WHERE id = ? AND status != 'completed'`,
      )
      .bind(params.paymentIntent ?? null, params.paymentId),
  ])

  if (claim.meta.changes === 0) return 'already-completed'
  if (!member) return 'no-member'

  if (tier === 'family') await syncFamilyCoverage(db, params.memberId)

  return 'activated'
}
