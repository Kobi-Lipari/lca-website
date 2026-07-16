// src/pages/MembershipPage.tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, CreditCard, Shield, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { createMembershipCheckout } from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

interface MembershipTier {
  id: string
  name: string
  price: number
  period: string
  description: string
  highlighted?: boolean
}

interface MembershipBenefit {
  icon: typeof Trophy
  title: string
  description: string
}

const tiers: MembershipTier[] = [
  {
    id: 'adult',
    name: 'LCA Adult Membership',
    price: 15,
    period: 'per year',
    description: 'For players 18 and up.',
    highlighted: true,
  },
  {
    id: 'scholastic',
    name: 'LCA Scholastic Membership',
    price: 5,
    period: 'per year',
    description: 'For K–12 students. Same benefits as adult membership at a reduced rate to support youth chess.',
  },
  {
    id: 'family',
    name: 'LCA Family Membership',
    price: 25,
    period: 'per year',
    description: 'Covers 1 adult and up to 3 dependents. The best value for households with multiple players.',
  },
  {
    id: 'senior',
    name: 'LCA Senior Membership',
    price: 10,
    period: 'per year',
    description: 'For members 65 and up. Full membership benefits at a reduced rate.',
  },/*
  {
    id: 'test',
    name: 'Test Membership',
    price: 0.50,
    period: 'demo only — remove before launch',
    description: 'Confirms the full Stripe checkout, webhook, and activation flow with a real transaction.',
  },*/
]

const benefits: MembershipBenefit[] = [
  {
    icon: Trophy,
    title: 'LCA Tournament Entry',
    description:
      'Eligible to enter LCA run tournaments across Louisiana.',
  },
  {
    icon: Users,
    title: 'Member Profile',
    description:
      'Your official LCA profile connected with USCF ID, rating tracking, and tournament history.',
  },
  {
    icon: Shield,
    title: 'Voting Rights',
    description:
      'Regular members can vote in LCA board elections and on association bylaws.',
  },
  {
    icon: CreditCard,
    title: 'Online Registration',
    description:
      'Register and pay for tournaments online with your member account.',
  },
]

const tierBenefits: Record<string, string[]> = {
  adult: [

  ],
  scholastic: [
  
  ],
  family: [

  ],
  senior: [
 
  ],/*
  test: [

  ],*/
}

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

function TierButton({
  tierId,
  user,
}: {
  tierId: string
  user: ReturnType<typeof useAuth>['user']
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const checkout = await createMembershipCheckout(tierId)
      sessionStorage.setItem('lca_pending_payment_id', checkout.paymentId)
      window.open(checkout.paymentUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <Button asChild className={cn('mt-6 w-full', goldButtonClass)}>
        <Link to="/register" state={{ from: '/membership' }}>
          Join Now
        </Link>
      </Button>
    )
  }

  return (
    <div className="mt-6">
      {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        className={cn('w-full', goldButtonClass)}
        disabled={loading}
        onClick={handleCheckout}
      >
        {loading ? 'Starting checkout…' : 'Join / Renew'}
      </Button>
    </div>
  )
}

export function MembershipPage() {
  usePageTitle('Membership')
  const { user, member } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      <section className="border-b-4 border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-[#c8a94a] sm:size-10" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                LCA Membership
              </h1>
              <p className="mt-2 max-w-2xl text-white/80">
                Join the Louisiana Chess Association and support chess across the
                state.
              </p>
            </div>
          </div>
        </div>
      </section>

      {member?.membership_status === 'active' && (
        <section className="border-b bg-emerald-50">
          <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-emerald-900">
            Your membership is <strong>active</strong>
            {member.membership_expiry && (
              <> through {member.membership_expiry}</>
            )}
            .{' '}
            <button
              type="button"
              className="font-medium text-[#1a2744] underline"
              onClick={() => navigate('/dashboard')}
            >
              View dashboard
            </button>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-12">
        <h2 className="text-2xl font-bold text-[#1a2744]">Member Benefits</h2>
        <p className="mt-1 text-muted-foreground">
          Every membership tier includes access to the LCA community and
          platform.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {benefits.map((benefit) => (
            <li
              key={benefit.title}
              className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm"
            >
              <benefit.icon className="size-6 shrink-0 text-[#c8a94a]" />
              <div>
                <h3 className="font-semibold text-[#1a2744]">{benefit.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-bold text-[#1a2744]">
            Membership Tiers
          </h2>
          <p className="mt-1 text-muted-foreground">
            Pay securely via Stripe. Placeholder payment links until live
            Stripe products are configured.
          </p>

          <ul className="mt-8 grid gap-6 lg:grid-cols-3">
            {tiers.map((tier) => (
              <li
                key={tier.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-card p-6 shadow-sm',
                  tier.highlighted && 'border-[#c8a94a] ring-2 ring-[#c8a94a]/30',
                )}
              >
                {tier.highlighted && (
                  <span className="mb-3 w-fit rounded-full bg-[#c8a94a]/20 px-2.5 py-0.5 text-xs font-medium text-[#1a2744]">
                    Most Popular
                  </span>
                )}

                <h3 className="text-xl font-bold text-[#1a2744]">{tier.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {tier.description}
                </p>

                <div className="mt-4">
                  <span className="text-3xl font-bold text-[#1a2744]">
                    ${tier.price}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    {tier.period}
                  </span>
                </div>

                <ul className="mt-6 flex-1 space-y-2">
                  {tierBenefits[tier.id].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-[#c8a94a]" />
                      {item}
                    </li>
                  ))}
                </ul>

                <TierButton tierId={tier.id} user={user} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-[#1a2744]">
            How Membership Works
          </h2>
          <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white">
                1
              </span>
              <span>
                Create an account and select your membership tier.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white">
                2
              </span>
              <span>
                Pay annual dues. A pending payment record is created in your account.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white">
                3
              </span>
              <span>
                Shortly after payment, you should be able to see your membership active in your dashboard.
              </span>
            </li>
          </ol>

          <p className="mt-6 text-sm text-muted-foreground">
            Already a member?{' '}
            <Link to="/login" className="font-medium text-[#c8a94a] hover:underline">
              Log in to renew
            </Link>{' '}
            or manage your account.
          </p>
        </div>
      </section>
    </div>
  )
}

