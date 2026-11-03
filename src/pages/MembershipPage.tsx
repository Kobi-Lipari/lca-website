// src/pages/MembershipPage.tsx
import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, CreditCard, Shield, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { createMembershipCheckout, type ApiMember } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { FAMILY_MEMBERSHIP_CHILDREN } from '@/lib/family'
import { MEMBERSHIP_TIER_PRICES } from '@domain/membership/tiers'

interface MembershipTier {
  id: string
  name: string
  /** The tier in one word, as the button under a signed-in member's choice says it. */
  short: string
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
    short: 'Adult',
    price: MEMBERSHIP_TIER_PRICES.adult,
    period: 'per year',
    description: 'For players 18 and up.',
    highlighted: true,
  },
  {
    id: 'scholastic',
    name: 'LCA Scholastic Membership',
    short: 'Scholastic',
    price: MEMBERSHIP_TIER_PRICES.scholastic,
    period: 'per year',
    description: 'For K-12 students. Same benefits as adult membership at a reduced rate to support youth chess.',
  },
  {
    id: 'family',
    name: 'LCA Family Membership',
    short: 'Family',
    price: MEMBERSHIP_TIER_PRICES.family,
    period: 'per year',
    description: `Covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. Add your children on your profile and they are covered automatically.`,
  },
  {
    id: 'senior',
    name: 'LCA Senior Membership',
    short: 'Senior',
    price: MEMBERSHIP_TIER_PRICES.senior,
    period: 'per year',
    description: 'For members 65 and up. Full membership benefits at a reduced rate.',
  },
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
      'Your official LCA profile connected with US Chess ID, rating tracking, and tournament history.',
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
  'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90'

/**
 * The tier a signed-in member's choice starts on. Adult, as K asked on
 * Tuesday, November 3, 2026: it costs a little more than Scholastic and
 * Senior, so the line above the cards says so, and the other three tiers
 * are one click or one arrow key away.
 *
 * One exception: a guardian whose own Family membership is active starts on
 * Family, because renewing as another tier ends their children's cover when
 * that membership runs out. A child it covers starts on Adult like everyone
 * else. The family membership is the guardian's, not the child's, but the
 * site writes the same type and status (family, active) on each covered
 * child's record too (syncFamilyCoverage in functions/utils/family.ts), so
 * guardian_id, the guardian's member id on a child's record, is what tells
 * the two apart. An expired Family membership, or any other tier, starts on
 * Adult.
 */
function startingTier(member: ApiMember | null): string {
  const ownActiveFamily =
    member?.membership_type === 'family' && member.membership_status === 'active' && !member.guardian_id
  return ownActiveFamily ? 'family' : 'adult'
}

/** Scholastic's and Senior's prices, said the same way whichever tier the choice starts on. */
const LOWER_PRICES =
  `Scholastic ($${MEMBERSHIP_TIER_PRICES.scholastic}, for K-12 students) ` +
  `or Senior ($${MEMBERSHIP_TIER_PRICES.senior}, for 65 and up), so if one of those fits you, choose it below.`

/** The line above a signed-in member's choice, every price read from the one price list checkout charges. */
const CHOICE_NOTE =
  `Adult is chosen to start, at $${MEMBERSHIP_TIER_PRICES.adult} a year. ` +
  `That is a little more than ${LOWER_PRICES} ` +
  `Family ($${MEMBERSHIP_TIER_PRICES.family}) covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children.`

/** The same line for a member whose choice starts on Family, so it never says Adult is chosen when it is not. */
const FAMILY_CHOICE_NOTE =
  `Family is chosen to start, at $${MEMBERSHIP_TIER_PRICES.family} a year, and covers you and up to ${FAMILY_MEMBERSHIP_CHILDREN} children. ` +
  `Adult is $${MEMBERSHIP_TIER_PRICES.adult} a year, a little more than ${LOWER_PRICES}`

/** Why the choice starts on Family, said under the line to that member only. */
const FAMILY_REASON = 'Your family membership covers the children on your account. Renewing as another tier ends their cover when your current membership runs out.'

/** A tier's own extras under its price, each with a tick. Every tier's list is empty for now. */
function TierBenefitList({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn('mt-6 flex-1 space-y-2', className)}>
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm text-muted-foreground"
        >
          <Check className="mt-0.5 size-4 shrink-0 text-gold-ink" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Each card's way in for a visitor who is not signed in: sign-up, which brings them back here. */
function JoinNowLink() {
  return (
    <Button asChild className={cn('mt-6 w-full', goldButtonClass)}>
      <Link to="/register" state={{ from: '/membership' }}>
        Join Now
      </Link>
    </Button>
  )
}

/**
 * A signed-in member's join or renewal: the four tiers as one group of radio
 * buttons, Adult chosen to start (Family for an active Family member), and
 * one gold button under them that names the choice and its price and starts
 * the checkout for that tier.
 */
function TierChoice({ member }: { member: ApiMember | null }) {
  const noteId = useId()
  const reasonId = useId()
  // The member's own pick, or a press of the button, wins over the record.
  // Until they do either, the choice follows the record, so an active Family
  // member whose record arrives after the page is drawn still starts on
  // Family, and a record that arrives while a checkout is asked for leaves
  // the choice on the tier that checkout is for.
  const [picked, setPicked] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const start = startingTier(member)
  const keepsFamily = start === 'family'
  const chosen = tiers.find((tier) => tier.id === (picked ?? start)) ?? tiers[0]
  const status = member?.membership_status
  // No membership yet is a first join, any other status a renewal. While the
  // member's record is still on its way the status is not known, so the
  // button says both, as every tier's button did before.
  const verb = status === 'none' ? 'Join' : status ? 'Renew' : 'Join or renew'

  async function handleCheckout() {
    setPicked(chosen.id)
    setLoading(true)
    setError(null)
    try {
      const checkout = await createMembershipCheckout(chosen.id)
      sessionStorage.setItem('lca_pending_payment_id', checkout.paymentId)
      // Same tab, on purpose. This used to open Stripe in a new tab after
      // the request came back, and browsers, phones above all, block a new
      // tab that is not opened straight from the tap. The button then went
      // quiet, nothing opened, and the member was left with a payment that
      // never started. Stripe sends the member back here when it is done.
      window.location.assign(checkout.paymentUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* The choice holds while its checkout is asked for, so the payment is for the tier the button named. */}
      <fieldset
        className="mt-6 min-w-0"
        disabled={loading}
        aria-describedby={keepsFamily ? `${noteId} ${reasonId}` : noteId}
      >
        <legend className="text-lg font-semibold text-ink">Choose your membership</legend>
        <p id={noteId} className="mt-1 max-w-3xl text-sm text-ink">
          {keepsFamily ? FAMILY_CHOICE_NOTE : CHOICE_NOTE}
        </p>
        {keepsFamily && (
          <p id={reasonId} className="mt-1 max-w-3xl text-sm text-ink">
            {FAMILY_REASON}
          </p>
        )}
        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          {tiers.map((tier) => {
            const isChosen = tier.id === chosen.id
            const items = tierBenefits[tier.id]
            return (
              <div
                key={tier.id}
                className={cn(
                  'flex flex-col rounded-xl border bg-card shadow-sm',
                  isChosen ? 'border-lca-gold ring-2 ring-lca-gold/30' : 'hover:border-ink/30',
                )}
              >
                {/* The whole card is the radio's label. The spaces between its parts keep the radio's spoken name in words, as the card reads. */}
                <label className="flex flex-1 cursor-pointer flex-col p-6">
                  <span className="mb-3 flex h-6 items-center gap-2">
                    <input
                      type="radio"
                      name="membership-tier"
                      value={tier.id}
                      checked={isChosen}
                      onChange={() => setPicked(tier.id)}
                      className="size-4 shrink-0 accent-ink"
                    />
                    {/* The word is for the eye, beside the gold ring; a screen reader hears the radio's own checked state. */}
                    {isChosen && (
                      <span aria-hidden="true" className="rounded-full bg-lca-gold/20 px-2.5 py-0.5 text-xs font-medium text-ink">
                        Selected
                      </span>
                    )}
                  </span>{' '}
                  <span className="text-xl font-bold text-ink">{tier.name}</span>{' '}
                  <span className="mt-2 text-sm text-muted-foreground">{tier.description}</span>{' '}
                  <span className="mt-4">
                    <span className="text-3xl font-bold text-ink">${tier.price}</span>{' '}
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  </span>
                </label>
                {items.length > 0 && <TierBenefitList items={items} className="mt-0 flex-none px-6 pb-6" />}
              </div>
            )
          })}
        </div>
      </fieldset>
      <div className="mt-6">
        {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
        <Button
          type="button"
          className={cn('w-full sm:w-auto', goldButtonClass)}
          disabled={loading}
          onClick={handleCheckout}
        >
          {loading ? 'Starting checkout…' : `${verb} as ${chosen.short}, $${chosen.price} a year`}
        </Button>
        {status === 'active' && (
          <p className="mt-2 text-sm text-ink">
            Renewing now adds a year on top of the time you have left.
          </p>
        )}
      </div>
    </>
  )
}

export function MembershipPage() {
  usePageTitle('Membership')
  const { user, member } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      <section className="border-b-4 border-lca-gold bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex items-center gap-3">
            <Users className="size-8 text-lca-gold sm:size-10" />
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

      {member && member.membership_status !== 'active' && (
        <section className="border-b bg-muted/40">
          <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-ink">
            {member.membership_status === 'expired' ? (
              <>Your membership has <strong>expired</strong>{member.membership_expiry ? <> (it ran through {formatDate(member.membership_expiry, { year: true })})</> : null}. Renew below to keep your member benefits.</>
            ) : (
              <>No LCA membership on this account yet. Join below, or{' '}
                <Link to="/membership/success" className="font-medium underline">check your last payment</Link> if you already tried.</>
            )}
          </div>
        </section>
      )}

      {member?.membership_status === 'active' && (
        <section className="border-b bg-ok-50">
          <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-ok-900">
            Your membership is <strong>active</strong>
            {member.membership_expiry && (
              <> through {formatDate(member.membership_expiry, { year: true })}</>
            )}
            .{' '}
            <button
              type="button"
              className="font-medium text-ink underline"
              onClick={() => navigate('/dashboard')}
            >
              View my profile
            </button>
          </div>
        </section>
      )}

      <section className="bg-muted/30">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h2 className="text-2xl font-bold text-ink">
            Membership Tiers
          </h2>
          {user ? (
            <TierChoice member={member} />
          ) : (
            <ul className="mt-8 grid gap-3 lg:grid-cols-4">
              {tiers.map((tier) => (
                <li
                  key={tier.id}
                  className={cn(
                    'flex flex-col rounded-xl border bg-card p-6 shadow-sm',
                    tier.highlighted && 'border-lca-gold ring-2 ring-lca-gold/30',
                  )}
                >
                  {tier.highlighted && (
                    <span className="mb-3 w-fit rounded-full bg-lca-gold/20 px-2.5 py-0.5 text-xs font-medium text-ink">
                      Most Popular
                    </span>
                  )}

                  <h3 className="text-xl font-bold text-ink">{tier.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {tier.description}
                  </p>

                  <div className="mt-4">
                    <span className="text-3xl font-bold text-ink">
                      ${tier.price}
                    </span>
                    <span className="ml-1 text-sm text-muted-foreground">
                      {tier.period}
                    </span>
                  </div>

                  <TierBenefitList items={tierBenefits[tier.id]} />

                  <JoinNowLink />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <h2 className="text-2xl font-bold text-ink">Member Benefits</h2>
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
              <benefit.icon className="size-6 shrink-0 text-gold-ink" />
              <div>
                <h3 className="font-semibold text-ink">{benefit.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {benefit.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="text-xl font-bold text-ink">
            How Membership Works
          </h2>
          <ol className="mt-4 space-y-4 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                1
              </span>
              <span>
                Create a free account (or log in) and pick the membership that fits you.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                2
              </span>
              <span>
                Pay your annual dues securely by card. A membership lasts one year, and renewing early adds the year on top of the time you have left.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                3
              </span>
              <span>
                Your membership is active as soon as payment goes through, and you'll see it on your profile. If it doesn't show within a few minutes, contact us and we'll sort it out.
              </span>
            </li>
          </ol>

          {/* A signed-in member already has the choice above, so only a visitor who is signed out is asked to log in. */}
          {!user && (
            <p className="mt-6 text-sm text-muted-foreground">
              Already a member?{' '}
              <Link to="/login" className="font-medium text-ink hover:underline">
                Log in to renew
              </Link>{' '}
              or manage your account.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

