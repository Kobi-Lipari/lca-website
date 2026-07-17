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

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PageHeroProps {
  title: ReactNode
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
  eyebrow = 'Louisiana Chess Association',
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
  return (
    <section className={cn('border-b-[3px] border-[#c8a94a] bg-[#1a2744] text-white', className)}>
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
            className="inline-flex items-center gap-1.5 text-sm text-white/55 transition-colors hover:text-[#c8a94a]"
          >
            <ArrowLeft className="size-3.5" /> {backTo.label}
          </Link>
        )}

        {eyebrow && (
          <div
            className={cn(
              'inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]',
              backTo ? 'mt-4 block w-fit' : 'mb-1',
            )}
          >
            {eyebrow}
          </div>
        )}

        <div
          className={cn(
            (backTo && !eyebrow) && 'mt-4',
            aside && cn(
              'flex flex-col gap-4 sm:flex-row sm:justify-between',
              asideAlign === 'end' ? 'sm:items-end' : 'sm:items-start',
            ),
          )}
        >
          <div className="min-w-0">
            {badges ? (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
                {badges}
              </div>
            ) : (
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
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
        </div>

        {children && (
          <div className="mt-4 border-t border-white/10 py-2">{children}</div>
        )}
      </div>
    </section>
  )
}