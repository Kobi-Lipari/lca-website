// src/pages/LoginPage.tsx
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/auth-context'
import { listTotpFactors, needsChallenge, verifyTotpCode } from '@/lib/mfa'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const goldButtonClass =
  'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'

export function LoginPage() {
  usePageTitle('Log In')
  const { user, loading, signIn, syncMember, refreshAssurance } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** Set once the password is accepted but a second factor is still owed. */
  const [challengeFactorId, setChallengeFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')

  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/dashboard'

  // Two things have to be true before it is safe to redirect away.
  //
  // A password-only session already has a `user`, so redirecting on that
  // alone would skip straight past the code prompt. `submitting` closes a
  // race that made the prompt unreachable entirely: signInWithPassword
  // establishes the aal1 session, which fires onAuthStateChange, which sets
  // `user` and re-renders this page — all while handleSubmit is still
  // awaiting the challenge check. Without the `submitting` guard that
  // re-render redirected to the dashboard mid-flight, leaving the member
  // signed in at aal1 with no way to ever answer the challenge.
  if (!loading && user && !challengeFactorId && !submitting) {
    return <Navigate to={redirectTo} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error: signInError } = await signIn(email, password)

    if (signInError) {
      setError(signInError)
      setSubmitting(false)
      return
    }

    // With a verified factor the session is only aal1 until a code is
    // accepted, so stop and ask rather than landing them somewhere that
    // will refuse them.
    try {
      if (await needsChallenge()) {
        const verified = (await listTotpFactors()).find(
          (f) => f.status === 'verified',
        )
        if (verified) {
          setChallengeFactorId(verified.id)
          setSubmitting(false)
          return
        }
      }
    } catch {
      // If the check itself fails, carry on: the server still refuses
      // anything that genuinely needs aal2.
    }

    await finishLogin()
  }

  async function finishLogin() {
    try {
      await syncMember()
    } catch {
      // Continue even if D1 sync fails
    }
    navigate(redirectTo, { replace: true })
  }

  async function handleChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!challengeFactorId) return
    setError(null)
    setSubmitting(true)
    try {
      await verifyTotpCode(challengeFactorId, code)
      await refreshAssurance()
      await finishLogin()
    } catch {
      setError('That code was not accepted. Codes change every 30 seconds — try the current one.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <section className="border-b-4 border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <LogIn className="size-8 text-lca-gold sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Log In
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Access your LCA member account to register for tournaments,
                manage your membership, and view your history.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-lca-navy">
                {challengeFactorId ? 'Enter your code' : 'Member Login'}
              </CardTitle>
              <CardDescription>
                {challengeFactorId
                  ? 'Open your authenticator app and enter the six-digit code for LCA.'
                  : 'Enter your email and password to sign in to your account.'}
              </CardDescription>
            </CardHeader>

            {challengeFactorId ? (
              <form onSubmit={handleChallenge}>
                <CardContent className="space-y-4">
                  {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="totp">Six-digit code</Label>
                    <Input
                      id="totp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      autoFocus
                      required
                      disabled={submitting}
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className={cn('w-full', goldButtonClass)}
                    disabled={submitting}
                  >
                    {submitting ? 'Checking...' : 'Verify'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Lost access to your authenticator? Contact the webmaster to
                    have it reset.
                  </p>
                </CardFooter>
              </form>
            ) : (
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link
                      to="/forgot-password"
                      className="text-xs text-lca-navy hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={submitting}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className={cn('w-full', goldButtonClass)}
                  disabled={submitting}
                >
                  {submitting ? 'Signing in...' : 'Log In'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <Link
                    to="/register"
                    className="font-medium text-lca-navy hover:underline"
                  >
                    Create one
                  </Link>
                </p>
              </CardFooter>
            </form>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}