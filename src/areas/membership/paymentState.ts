// src/areas/membership/paymentState.ts
//
// The words for each state a membership payment can be in. The success page
// and the profile both read them from here, so a member who was never
// charged is never told "Payment received", and one whose Stripe page is
// still open is offered the way back to it.
import type { confirmMembership } from './api'

/** What POST /api/membership/confirm answers (the shape is declared on the call). */
export type MembershipPaymentCheck = Awaited<ReturnType<typeof confirmMembership>>

/**
 * Where a membership payment stands. 'paid' is the only state in which the
 * membership is active; every other state says nothing was charged, or that
 * the answer is not in yet.
 */
export type MembershipPaymentState = MembershipPaymentCheck['paymentState']

export interface PaymentStateCopy {
  /** The page heading. */
  heading: string
  /** One or two plain sentences under it. */
  body: string
  /** Whether a "Check again" button makes sense: the answer can still change. */
  canCheckAgain: boolean
  /** Whether the Stripe page can still be finished (the API gives its address). */
  canFinishPaying: boolean
  /** Whether to point at the support page. */
  offerSupport: boolean
}

/**
 * The date a payment was started, in the site's words: weekday, month, day
 * and year. The database stores "YYYY-MM-DD HH:MM:SS" in UTC. Returns null
 * for anything it cannot read, so a bad value drops the sentence instead
 * of printing "Invalid Date".
 */
export function startedOn(startedAt: string | null | undefined): string | null {
  if (!startedAt) return null
  const iso = startedAt.includes('T') ? startedAt : `${startedAt.replace(' ', 'T')}Z`
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function paymentStateCopy(state: MembershipPaymentState, startedAt?: string | null): PaymentStateCopy {
  const started = startedOn(startedAt)
  const when = started ? ` on ${started}` : ''
  switch (state) {
    case 'paid':
      return {
        heading: 'Membership confirmed',
        body: 'Your payment went through and your membership is active.',
        canCheckAgain: false,
        canFinishPaying: false,
        offerSupport: false,
      }
    case 'processing':
      return {
        heading: 'Your payment is still being processed',
        body: 'Stripe has your payment and is finishing it. This usually takes a few seconds. Check again in a moment.',
        canCheckAgain: true,
        canFinishPaying: false,
        offerSupport: true,
      }
    case 'open':
      return {
        heading: 'Your payment was not completed',
        body: `You started a membership payment${when} but did not finish it, so nothing has been charged. You can finish paying now, or start again from the membership page whenever you are ready.`,
        canCheckAgain: false,
        canFinishPaying: true,
        offerSupport: false,
      }
    case 'expired':
      return {
        heading: 'That checkout has expired',
        body: `The payment page you opened${when} has timed out, and nothing was charged. Try again when you are ready.`,
        canCheckAgain: false,
        canFinishPaying: false,
        offerSupport: false,
      }
    case 'none':
      return {
        heading: 'No membership payment on your account',
        body: 'You have an account but have not started a membership payment yet, so nothing has been charged. Join from the membership page whenever you are ready.',
        canCheckAgain: false,
        canFinishPaying: false,
        offerSupport: false,
      }
    case 'unknown':
    default:
      return {
        heading: 'We could not check your payment right now',
        body: `We could not reach our payment provider to confirm the payment you started${when}. If you paid, your membership will show on your profile as soon as it clears. Check again in a moment, or write to us and we will sort it out.`,
        canCheckAgain: true,
        canFinishPaying: false,
        offerSupport: true,
      }
  }
}
