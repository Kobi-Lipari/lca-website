// functions/utils/membership/membershipActivation.ts
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

import { syncFamilyCoverage } from '../family'

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
 * Two callers can race: the webhook and the success page can arrive in
 * either order, or together. Reading the status and then writing it would let
 * both win, and both would extend the expiry, handing someone two years for
 * one payment. So the member update and the payment claim go in one batch,
 * which D1 runs as a transaction: the member row changes only while the
 * payment is still unclaimed, and only the caller whose claim actually
 * changed a row reports 'activated'.
 *
 * The two writes used to be separate statements, payment first. A failure
 * between them left the payment 'completed' and the member 'pending', and
 * every retry then stopped at 'already-completed', so nothing ever repaired
 * it. In one transaction either both land or neither, and Stripe's retry or
 * the success page runs it again.
 */
export async function activateMembershipPayment(
  db: D1Database,
  params: { paymentId: string; memberId: string; paymentIntent?: string | null },
): Promise<ActivationResult> {
  const member = await db
    .prepare('SELECT membership_expiry FROM members WHERE id = ?')
    .bind(params.memberId)
    .first<{ membership_expiry: string | null }>()

  if (!member) return 'no-member'

  // The tier bought is stored on the payment (reference_id). Recording it on
  // the member is what lets a family membership extend to the children.
  const payment = await db
    .prepare('SELECT reference_id, status FROM payments WHERE id = ?')
    .bind(params.paymentId)
    .first<{ reference_id: string | null; status: string }>()
  if (payment?.status === 'completed') return 'already-completed'
  const tier = payment?.reference_id && KNOWN_TIERS.has(payment.reference_id) ? payment.reference_id : null

  const [, claim] = await db.batch([
    db
      .prepare(
        `UPDATE members
            SET membership_status = 'active', membership_expiry = ?,
                membership_type = COALESCE(?, membership_type)
          WHERE id = ?
            AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND status != 'completed')`,
      )
      .bind(renewalExpiry(member.membership_expiry), tier, params.memberId, params.paymentId),
    db
      .prepare(
        `UPDATE payments
            SET status = 'completed',
                stripe_payment_intent = COALESCE(?, stripe_payment_intent)
          WHERE id = ? AND status != 'completed'`,
      )
      .bind(params.paymentIntent ?? null, params.paymentId),
  ])

  if (!claim || claim.meta.changes === 0) return 'already-completed'

  if (tier === 'family') await syncFamilyCoverage(db, params.memberId)

  return 'activated'
}
