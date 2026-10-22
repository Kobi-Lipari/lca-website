// src/components/PageHero.tsx
//
// The shared Hybrid-2 page hero: navy panel, 3px gold bottom border,
// max-w-6xl container, gold eyebrow pill. Extracted from TournamentsPage,
// ClubsPage, and TournamentDetailPage so new pages (Scholastic, News,
// governance) assemble instead of re-implementing.
//
// Slots, each earned by an existing page:
//   backTo    — back-link above the title (TournamentDetailPage)
//   eyebrow   — gold pill; defaults to 'Louisiana Chess Association',
//               pass null to hide (detail-style pages use backTo instead)
//   badges    — pills rendered inline with the title (TournamentDetailPage)
//   meta      — icon meta row under the title (TournamentDetailPage)
//   aside     — right-hand column: stat grid (ClubsPage) or action button
//               (TournamentDetailPage); asideAlign picks sm:items-end vs start
//   children  — full-width bottom row separated by a white/10 border
//               (TournamentsPage filter bar)
//
// NOT for the HomePage slideshow hero — that one is intentionally bespoke.
//
// Inside HeritageLayout (src/contexts/heritage-layout.ts) the title takes the
// heritage look's display hook (data-heritage="display"), and under the new
// look a hero with no aside of its own shows the seal on the right from 640px
// up. Everywhere else the hero draws exactly what it drew before.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Seal } from '@/components/Seal'
import { useHeritageHook, useHeritageOrnaments } from '@/contexts/heritage-layout'
import { cn } from '@/lib/utils'

export interface PageHeroProps {
  title: ReactNode
  /** Opt-in gold chip. Omitted by default — K retired it everywhere except the homepage. */
  eyebrow?: string | null
  subtitle?: ReactNode
  backTo?: { to: string; label: string }
  badges?: ReactNode
  meta?: ReactNode
  aside?: ReactNode
  asideAlign?: 'start' | 'end'
  size?: 'compact' | 'default'
  children?: ReactNode
  className?: string
}

export function PageHero({
  title,
  eyebrow,
  subtitle,
  backTo,
  badges,
  meta,
  aside,
  asideAlign = 'start',
  size = 'default',
  children,
  className,
}: PageHeroProps) {
  const hook = useHeritageHook()
  const seal = useHeritageOrnaments() && !aside
  return (
    <section className={cn('border-b-[3px] border-lca-gold bg-brand-navy text-white', className)}>
      <div
        className={cn(
          'mx-auto max-w-6xl px-6',
          size === 'compact' ? 'pt-8' : 'pt-10',
          children ? 'pb-0' : size === 'compact' ? 'pb-8' : 'pb-10',
        )}
      >
        {backTo && (
          <Link
            to={backTo.to}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-lca-gold"
          >
            <ArrowLeft className="size-3.5" /> {backTo.label}
          </Link>
        )}

        {eyebrow && (
          <div
            className={cn(
              'inline-block rounded-full border border-lca-gold/50 bg-lca-gold/15 px-2.5 py-0.5 text-[10px] text-gold-on-dark-badge',
              backTo ? 'mt-4 block w-fit' : 'mb-1',
            )}
          >
            {eyebrow}
          </div>
        )}

        <div
          className={cn(
            (backTo && !eyebrow) && 'mt-4',
            (aside || seal) && cn(
              'flex flex-col gap-4 sm:flex-row sm:justify-between',
              asideAlign === 'end' ? 'sm:items-end' : 'sm:items-start',
            ),
          )}
        >
          <div className="min-w-0">
            {badges ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 data-heritage={hook('display')} className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                {badges}
              </div>
            ) : (
              <h1 data-heritage={hook('display')} className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
            )}
            {subtitle && (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">{subtitle}</p>
            )}
            {meta && (
              <div className="mt-2 flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-6">
                {meta}
              </div>
            )}
          </div>
          {aside && <div className="flex-shrink-0">{aside}</div>}
          {seal && <Seal className="hidden sm:block" />}
        </div>

        {children && (
          <div className="mt-4 border-t border-white/10 py-2">{children}</div>
        )}
      </div>
    </section>
  )
}