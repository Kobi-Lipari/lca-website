// src/pages/MembershipSuccessPage.tsx
//
// Where a membership payment stands, in plain words. Stripe sends the member
// here after checkout with the payment id in the address; the profile links
// here with no id to check the latest payment from any device. Every state
// says whether anything was charged and what to do next.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock, CreditCard } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { confirmMembership } from '@/lib/api'
import { paymentStateCopy, type MembershipPaymentCheck } from '@/areas/membership/paymentState'
import { cn } from '@/lib/utils'
import { FAMILY_MEMBERSHIP_CHILDREN } from '@/lib/family'

const goldButtonClass =
  'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90'

function MembershipSuccessContent() {
  const [searchParams] = useSearchParams()
  const { refreshMember } = useAuth()
  // The id Stripe sent back, else the one kept when checkout started, else
  // nothing: the server then checks the member's latest payment.
  const paymentId =
    searchParams.get('paymentId') ?? sessionStorage.getItem('lca_pending_payment_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<MembershipPaymentCheck | null>(null)

  // A paid answer also refreshes the signed-in member, so the header and
  // the profile stop saying pending without another page load.
  async function settle(result: MembershipPaymentCheck) {
    if (result.paymentState === 'paid') {
      sessionStorage.removeItem('lca_pending_payment_id')
      await refreshMember()
    }
    return result
  }

  useEffect(() => {
    let cancelled = false
    confirmMembership(paymentId)
      .then(settle)
      .then((result) => { if (!cancelled) setCheck(result) })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not check payment status')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRetry() {
    setLoading(true)
    setError(null)
    try {
      setCheck(await settle(await confirmMembership(paymentId)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check payment status')
    } finally {
      setLoading(false)
    }
  }

  const state = check?.paymentState ?? null
  const tier = check?.tier ?? null
  const copy = state ? paymentStateCopy(state, check?.startedAt) : null

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      {loading && (
        <p className="text-muted-foreground" role="status">Checking your payment…</p>
      )}

      {!loading && error && (
        <>
          <p className="text-destructive">{error}</p>
          <Button type="button" className={cn('mt-6', goldButtonClass)} onClick={handleRetry}>
            Check again
          </Button>
          <Button asChild className="mt-3" variant="outline">
            <Link to="/membership">Back to membership</Link>
          </Button>
        </>
      )}

      {!loading && !error && copy && state === 'paid' && (
        <>
          <CheckCircle2 className="mx-auto size-12 text-ok-600" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-bold text-ink">{copy.heading}</h1>
          {tier === 'family' ? (
            <>
              <p className="mt-2 text-muted-foreground">
                Your LCA family membership is now active and covers you and up to {FAMILY_MEMBERSHIP_CHILDREN} children.
              </p>
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-lca-gold/50 bg-lca-gold/10 p-4 text-left">
                <p className="font-semibold text-ink">One more step: add your children</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your membership covers them as soon as they're added to your profile. It takes a minute: just their name,
                  and their US Chess ID if they have one.
                </p>
              </div>
              <Button asChild className={cn('mt-6', goldButtonClass)}>
                <Link to="/dashboard?family=setup#family">Add your children</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-muted-foreground">
                Your LCA {tier ? `${tier} ` : ''}membership is now active. You can
                register for tournaments from your profile.
              </p>
              <Button asChild className={cn('mt-8', goldButtonClass)}>
                <Link to="/dashboard">Go to my profile</Link>
              </Button>
            </>
          )}
        </>
      )}

      {!loading && !error && copy && state !== 'paid' && (
        <>
          {state === 'processing' || state === 'unknown'
            ? <Clock className="mx-auto size-12 text-gold-ink" aria-hidden="true" />
            : <CreditCard className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />}
          <h1 className="mt-4 text-2xl font-bold text-ink">{copy.heading}</h1>
          <p className="mt-2 text-muted-foreground">{copy.body}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {copy.canFinishPaying && check?.paymentUrl && (
              <Button asChild className={goldButtonClass}>
                <a href={check.paymentUrl}>Finish paying</a>
              </Button>
            )}
            {copy.canCheckAgain && (
              <Button type="button" className={goldButtonClass} onClick={handleRetry}>
                Check again
              </Button>
            )}
            <Button asChild variant={copy.canFinishPaying || copy.canCheckAgain ? 'outline' : 'default'}
              className={copy.canFinishPaying || copy.canCheckAgain ? undefined : goldButtonClass}>
              <Link to="/membership">{state === 'none' || state === 'expired' ? 'Go to the membership page' : 'Back to membership'}</Link>
            </Button>
            {copy.offerSupport && (
              <Link to="/support" className="text-sm font-medium text-ink underline">
                Write to support
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function MembershipSuccessPage() {
  return (
    <ProtectedRoute>
      <MembershipSuccessContent />
    </ProtectedRoute>
  )
}
