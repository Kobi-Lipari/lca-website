// src/pages/RegisterPage.tsx
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

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
import { useAuth } from '@/contexts/AuthContext'
import UscfSearchInput, { type UscfPlayerResult } from '@/components/uscf/UscfSearchInput'
import { cn } from '@/lib/utils'

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function RegisterPage() {
  const { user, loading, signUp, syncMember } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [uscfIdTyped, setUscfIdTyped] = useState(false)
  const [uscfPlayer, setUscfPlayer] = useState<UscfPlayerResult | null>(null)

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)

    const formData = new FormData(event.currentTarget)
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setSubmitting(false)
      return
    }

    if (uscfIdTyped && !uscfPlayer) {
      setError('Please select a valid USCF record from the search results, or clear the USCF ID field.')
      setSubmitting(false)
      return
    }

    const { error: signUpError, needsEmailConfirmation } = await signUp(
      email,
      password,
      {
        fullName: name,
        uscfId: uscfPlayer?.uscfId,
      },
    )

    if (signUpError) {
      setError(signUpError)
      setSubmitting(false)
      return
    }

    if (needsEmailConfirmation) {
      setSuccess(
        'Account created! Check your email to confirm your address, then log in.',
      )
      setSubmitting(false)
      return
    }

    try {
      await syncMember()
    } catch {
      // Continue even if D1 sync fails
    }

    navigate('/dashboard', { replace: true })
  }

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <UserPlus className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Create Account
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Join the Louisiana Chess Association to register for tournaments,
                manage your membership, and connect with clubs statewide.
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
                Member Registration
              </CardTitle>
              <CardDescription>
                Create your LCA account. You can add or purchase membership
                after signing up.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {success}
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Jane Doe"
                    autoComplete="name"
                    required
                    disabled={submitting}
                  />
                </div>

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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    disabled={submitting}
                  />
                </div>

                <UscfSearchInput
                  onSelect={(player) => setUscfPlayer(player)}
                  onIdInput={(hasInput) => setUscfIdTyped(hasInput)}
                  initialUscfId=""
                />

                {uscfPlayer && (
                  <p className="text-xs text-muted-foreground">
                    Rating {uscfPlayer.rating ?? 'unrated'} will be saved to
                    your profile automatically.
                  </p>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className={cn('w-full', goldButtonClass)}
                  disabled={submitting}
                >
                  {submitting ? 'Creating account...' : 'Create Account'}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-medium text-[#c8a94a] hover:underline"
                  >
                    Log in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </section>
    </div>
  )
}