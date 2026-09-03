// src/pages/AccountSecurityPage.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, ShieldAlert, KeyRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import {
  listTotpFactors,
  removeFactor,
  startTotpEnrollment,
  verifyTotpCode,
  type EnrollResult,
  type FactorSummary,
} from '@/lib/mfa'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function AccountSecurityPage() {
  usePageTitle('Account Security')
  const { role, assuranceLevel, refreshAssurance } = useAuth()

  const [factors, setFactors] = useState<FactorSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState<EnrollResult | null>(null)
  const [code, setCode] = useState('')
  const [stepUpCode, setStepUpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const isAdmin = role === 'lca_admin'
  const verified = factors.filter((f) => f.status === 'verified')
  const hasVerified = verified.length > 0

  // No setState before the first await, so this stays safe to call straight
  // from an effect. `loading` starts true, so the initial render is covered
  // without setting it here.
  const load = useCallback(async () => {
    try {
      setFactors(await listTotpFactors())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load security settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Wrapped rather than called directly so the state updates happen in an
    // async callback, not synchronously inside the effect body.
    async function run() {
      await load()
    }
    run()
  }, [load])

  async function beginEnrollment() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      // Clear out unverified leftovers first: every abandoned run through
      // this screen leaves one behind, and Supabase caps how many exist.
      for (const stale of factors.filter((f) => f.status === 'unverified')) {
        await removeFactor(stale.id).catch(() => {})
      }
      setEnrolling(await startTotpEnrollment())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start setup')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!enrolling) return
    setBusy(true)
    setError(null)
    try {
      await verifyTotpCode(enrolling.factorId, code)
      setEnrolling(null)
      setCode('')
      setNotice('Two-factor authentication is on. You will be asked for a code when you log in.')
      await load()
      await refreshAssurance()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'That code was not accepted. Codes expire quickly — try the current one.',
      )
    } finally {
      setBusy(false)
    }
  }

  /**
   * Steps an already-enrolled session up to aal2.
   *
   * Enrolling verifies the session it was performed in, but any later
   * session starts at aal1 and only the login screen offered a way to
   * answer the challenge. Someone already signed in when they enrolled — or
   * signed in through a path that skipped the prompt — had no route back.
   */
  async function handleStepUp(event: FormEvent<HTMLFormElement>) {
    const factorId = verified[0]?.id
    event.preventDefault()
    if (!factorId) return

    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await verifyTotpCode(factorId, stepUpCode)
      setStepUpCode('')
      setNotice('This session is verified. Admin pages are available again.')
      await refreshAssurance()
    } catch {
      setError('That code was not accepted. Codes change every 30 seconds — try the current one.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(factorId: string) {
    setBusy(true)
    setError(null)
    try {
      await removeFactor(factorId)
      setNotice('Two-factor authentication removed.')
      await load()
      await refreshAssurance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that factor')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Account Security
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Two-factor authentication adds a code from your phone on top of
                your password.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-12">
        {isAdmin && !hasVerified && (
          <div className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-destructive" />
              <h2 className="font-bold text-destructive">
                Required for your account
              </h2>
            </div>
            <p className="mt-2 text-sm text-foreground/80">
              Admin accounts can email every member, view the full member list,
              and sign in as other people. Because of that, two-factor
              authentication is mandatory — the admin panel stays locked until
              you finish setting it up.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              If you lose access to your authenticator app, contact the
              webmaster to have it reset. There are no self-service backup
              codes.
            </p>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <KeyRound className="size-5 text-[#c8a94a]" />
            <h2 className="text-lg font-bold text-[#1a2744]">
              Authenticator app
            </h2>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : enrolling ? (
            <form onSubmit={handleVerify} className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this with Google Authenticator, 1Password, Authy, or any
                similar app, then enter the six-digit code it shows.
              </p>

              <div
                className="mx-auto w-fit rounded-lg border bg-white p-3"
                // Supabase returns the QR as SVG markup it generated itself.
                dangerouslySetInnerHTML={{ __html: enrolling.qrCode }}
              />

              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Can't scan the code?</summary>
                <p className="mt-2 break-all font-mono text-[11px]">
                  {enrolling.secret}
                </p>
              </details>

              <div className="space-y-2">
                <Label htmlFor="code">Six-digit code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={busy}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className={goldButtonClass} disabled={busy}>
                  {busy ? 'Checking…' : 'Turn on'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setEnrolling(null)
                    setCode('')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : hasVerified ? (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-emerald-600" />
                <span className="font-medium text-emerald-800">
                  On for this account
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                This session is {assuranceLevel === 'aal2' ? 'verified' : 'not yet verified'}.
              </p>

              {/* A session created before enrolment — or any session that has
                  not answered a challenge — sits at aal1. Admin pages need
                  aal2, and RoleProtectedRoute sends people here when they do
                  not have it, so without this form the page they are sent to
                  in order to fix the problem offers no way to fix it. */}
              {assuranceLevel !== 'aal2' && (
                <form onSubmit={handleStepUp} className="mt-4 rounded-lg border border-[#c8a94a]/50 bg-[#c8a94a]/8 p-4">
                  <p className="text-sm font-medium text-[#1a2744]">
                    Verify this session
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isAdmin
                      ? 'The admin panel needs a verified session. Enter the current code from your authenticator app.'
                      : 'Enter the current code from your authenticator app to verify this session.'}
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="stepUpCode" className="text-xs">
                        Six-digit code
                      </Label>
                      <Input
                        id="stepUpCode"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        className="w-36"
                        value={stepUpCode}
                        onChange={(e) => setStepUpCode(e.target.value)}
                        required
                        disabled={busy}
                      />
                    </div>
                    <Button type="submit" className={goldButtonClass} disabled={busy}>
                      {busy ? 'Verifying…' : 'Verify'}
                    </Button>
                  </div>
                </form>
              )}

              <div className="mt-4 space-y-2">
                {verified.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  >
                    <span className="text-sm">{f.friendlyName ?? 'Authenticator app'}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => handleRemove(f.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Removing this will lock you out of the admin panel until you
                  set it up again.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Not set up. You'll enter a code from your phone each time you log
                in.
              </p>
              <Button
                type="button"
                className={cn('mt-4', goldButtonClass)}
                disabled={busy}
                onClick={beginEnrollment}
              >
                {busy ? 'Starting…' : 'Set up two-factor authentication'}
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          <Link to="/dashboard" className="text-[#1a2744] hover:underline">
            ← Back to dashboard
          </Link>
        </p>
      </section>
    </div>
  )
}
