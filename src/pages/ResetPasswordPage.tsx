// src/pages/ResetPasswordPage.tsx
import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'

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
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function ResetPasswordPage() {
  usePageTitle('Reset Password')
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  // Supabase sends the user back with a token in the URL hash.
  // We need to wait for the session to be established before allowing reset.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string) => {
        if (event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      },
    )
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <KeyRound className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Reset Password
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Choose a new password for your LCA account.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mx-auto max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl text-[#1a2744]">
                Choose a new password
              </CardTitle>
              <CardDescription>
                Your new password must be at least 6 characters.
              </CardDescription>
            </CardHeader>

            {!sessionReady ? (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Verifying your reset link…
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  If this takes too long,{' '}
                  <Link
                    to="/forgot-password"
                    className="text-[#c8a94a] hover:underline"
                  >
                    request a new link
                  </Link>
                  .
                </p>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  {error && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={submitting}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="new-password"
                      required
                      minLength={6}
                      disabled={submitting}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className={cn('w-full', goldButtonClass)}
                    disabled={submitting}
                  >
                    {submitting ? 'Updating...' : 'Update Password'}
                  </Button>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}