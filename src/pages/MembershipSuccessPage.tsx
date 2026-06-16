import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { confirmMembership } from '@/lib/api'
import { cn } from '@/lib/utils'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

function MembershipSuccessContent() {
  const [searchParams] = useSearchParams()
  const { refreshMember } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    async function confirm() {
      const paymentId =
        searchParams.get('paymentId') ??
        sessionStorage.getItem('lca_pending_payment_id')

      if (!paymentId) {
        setError('No payment ID found. Complete checkout from the membership page first.')
        setLoading(false)
        return
      }

      try {
        await confirmMembership(paymentId)
        sessionStorage.removeItem('lca_pending_payment_id')
        await refreshMember()
        setConfirmed(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Confirmation failed')
      } finally {
        setLoading(false)
      }
    }
    confirm()
  }, [searchParams, refreshMember])

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      {loading && (
        <p className="text-muted-foreground">Confirming your membership…</p>
      )}

      {error && (
        <>
          <p className="text-destructive">{error}</p>
          <Button asChild className="mt-6" variant="outline">
            <Link to="/membership">Back to membership</Link>
          </Button>
        </>
      )}

      {confirmed && !error && (
        <>
          <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">
            Membership confirmed
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your LCA membership is now active. You can register for tournaments
            from your dashboard.
          </p>
          <Button asChild className={cn('mt-8', goldButtonClass)}>
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
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
