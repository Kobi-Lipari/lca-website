// src/pages/ForgotPasswordPage.tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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

export function ForgotPasswordPage() {
  usePageTitle('Forgot Password')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    )

    if (resetError) {
      setError(resetError.message)
      setSubmitting(false)
      return
    }

    setSent(true)
    setSubmitting(false)
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <KeyRound className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Forgot Password
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Enter your email and we'll send you a link to reset your
                password.
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
                Reset your password
              </CardTitle>
              <CardDescription>
                We'll send a reset link to your email address.
              </CardDescription>
            </CardHeader>

            {sent ? (
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-medium text-emerald-800">
                    Check your email
                  </p>
                  <p className="mt-1 text-sm text-emerald-700">
                    If an account exists for <strong>{email}</strong>, you'll
                    receive a password reset link shortly.
                  </p>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  <Link
                    to="/login"
                    className="font-medium text-[#1a2744] hover:underline"
                  >
                    Back to log in
                  </Link>
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      disabled={submitting}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-4">
                  <Button
                    type="submit"
                    className={cn('w-full', goldButtonClass)}
                    disabled={submitting}
                  >
                    {submitting ? 'Sending...' : 'Send reset link'}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Remember your password?{' '}
                    <Link
                      to="/login"
                      className="font-medium text-[#1a2744] hover:underline"
                    >
                      Log in
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