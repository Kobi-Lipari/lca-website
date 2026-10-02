import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Clock } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { confirmMembership } from '@/lib/api'
import { cn } from '@/lib/utils'
import { FAMILY_MEMBERSHIP_CHILDREN } from '@/lib/family'

const goldButtonClass =
  'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

function MembershipSuccessContent() {
  const [searchParams] = useSearchParams()
  const { refreshMember } = useAuth()
  const paymentId =
    searchParams.get('paymentId') ?? sessionStorage.getItem('lca_pending_payment_id')

  // Nothing to wait for without a payment id, so the missing-id state is the
  // first render rather than something an effect corrects afterwards.
  const [loading, setLoading] = useState(!!paymentId)
  const [error, setError] = useState<string | null>(
    paymentId ? null : 'No payment ID found. Complete checkout from the membership page first.',
  )
  const [status, setStatus] = useState<'active' | 'pending' | null>(null)
  const [tier, setTier] = useState<string | null>(null)

  async function checkStatus() {
    if (!paymentId) return

    try {
      const result = await confirmMembership(paymentId)
      setTier(result.tier ?? null)
      if (result.alreadyConfirmed) {
        sessionStorage.removeItem('lca_pending_payment_id')
        await refreshMember()
        setStatus('active')
      } else {
        // Webhook hasn't landed yet — this is expected, usually resolves within a few seconds
        setStatus('pending')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check payment status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!paymentId) return
    let cancelled = false
    confirmMembership(paymentId)
      .then(async (result) => {
        if (cancelled) return
        setTier(result.tier ?? null)
        if (result.alreadyConfirmed) {
          sessionStorage.removeItem('lca_pending_payment_id')
          await refreshMember()
          if (!cancelled) setStatus('active')
        } else {
          // The webhook has not landed yet — expected, and usually resolves
          // within a few seconds.
          setStatus('pending')
        }
      })
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
    await checkStatus()
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      {loading && (
        <p className="text-muted-foreground">Checking your payment status…</p>
      )}

      {!loading && error && (
        <>
          <p className="text-destructive">{error}</p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/membership">Back to membership</Link>
          </Button>
        </>
      )}

      {!loading && !error && status === 'pending' && (
        <>
          <Clock className="mx-auto size-12 text-lca-gold" />
          <h1 className="mt-4 text-2xl font-bold text-lca-navy">
            Payment received — activating your membership
          </h1>
          <p className="mt-2 text-muted-foreground">
            Stripe confirmed your payment. It usually takes just a few seconds for
            your membership to activate. If this doesn't update shortly, try
            refreshing.
          </p>
          <Button type="button" className={cn('mt-8', goldButtonClass)} onClick={handleRetry}>
            Check again
          </Button>
        </>
      )}

      {!loading && !error && status === 'active' && (
        <>
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-lca-navy">
            Membership confirmed
          </h1>
          {tier === 'family' ? (
            <>
              <p className="mt-2 text-muted-foreground">
                Your LCA family membership is now active and covers you and up to {FAMILY_MEMBERSHIP_CHILDREN} children.
              </p>
              <div className="mx-auto mt-6 max-w-md rounded-xl border border-lca-gold/50 bg-lca-gold/10 p-4 text-left">
                <p className="font-semibold text-lca-navy">One more step: add your children</p>
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