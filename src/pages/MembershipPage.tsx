import { Link } from 'react-router-dom'
import { Check, CreditCard, Shield, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    id: 'regular',
    name: 'Regular Member',
    price: 35,
    period: 'per year',
    description:
      'Full LCA membership for adult players. Includes discounted tournament entry and access to all member events.',
    highlighted: true,
  },
  {
    id: 'scholastic',
    name: 'Scholastic Member',
    price: 20,
    period: 'per year',
    description:
      'For players under 18. Same benefits as regular membership at a reduced rate to support youth chess.',
  },
  {
    id: 'club',
    name: 'Club Membership',
    price: 150,
    period: 'per year',
    description:
      'Annual affiliation for chess clubs. Includes club page on the LCA site, tournament hosting privileges, and group member discounts.',
  },
]

const benefits: MembershipBenefit[] = [
  {
    icon: Trophy,
    title: 'Discounted Tournament Entry',
    description:
      'Save on entry fees at every LCA-sanctioned tournament across Louisiana.',
  },
  {
    icon: Users,
    title: 'Member Profile',
    description:
      'Your official LCA profile with USCF ID, rating tracking, and tournament history.',
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
  regular: [
    'Discounted tournament entry fees',
    'Member profile and history',
    'Voting rights in LCA elections',
    'Membership card and confirmation',
    'Access to member-only events',
  ],
  scholastic: [
    'Discounted tournament entry fees',
    'Member profile and history',
    'Scholastic tournament access',
    'Membership card and confirmation',
    'Youth coaching event discounts',
  ],
  club: [
    'Official club page on LCA website',
    'Tournament hosting privileges',
    'Group member discount codes',
    'Club representative dashboard access',
    'Listed in affiliated clubs directory',
  ],
}

const goldButtonClass =
  'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

export function MembershipPage() {
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
                state. Members receive exclusive benefits, discounted entry
                fees, and a voice in the organization.
              </p>
            </div>
          </div>
        </div>
      </section>

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
            Placeholder pricing — final rates to be confirmed by the LCA board.
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

                <Button
                  asChild
                  className={cn('mt-6 w-full', goldButtonClass)}
                >
                  <Link to="/register">Join Now</Link>
                </Button>
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
                Create an account and select your membership tier. Scholastic
                members must be under 18 at the time of registration.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white">
                2
              </span>
              <span>
                Pay annual dues online. Club memberships are billed to the club
                representative on behalf of the organization.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1a2744] text-xs font-bold text-white">
                3
              </span>
              <span>
                Receive your membership confirmation and access your member
                dashboard to register for tournaments and track your history.
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

      <section className="bg-[#1a2744] text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center px-6 py-12 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to Join?
          </h2>
          <p className="mt-3 max-w-xl text-white/80">
            Become part of Louisiana&apos;s official chess community. Membership
            is annual and renews each calendar year.
          </p>
          <Button asChild size="lg" className={cn('mt-8', goldButtonClass)}>
            <Link to="/register">Join Now</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}