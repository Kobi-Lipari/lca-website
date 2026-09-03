// src/components/StatusBadge.tsx
//
// Shared status pill + registration dot for the Hybrid-2 pages.
//
// StatusBadge: generic rounded pill. `tone` picks the color family, `on`
// picks the surface variant — the same status needs different classes on
// the navy hero vs. light cards, which is why every page grew its own
// bespoke pill classes before this existed.
//
// TOURNAMENT_STATUS: preset mapping for the tournament lifecycle badge
// (replaces TournamentDetailPage's local statusConfig when that page is
// refit in a later pass).
//
// StatusDot: unified three-state registration dot. Previously forked —
// HomePage had three states, TournamentsPage had two (anything non-open
// showed gold "Opening soon", including closed registration). Unified on
// the honest three-state version per approval: open→green, draft→gold,
// everything else→gray "Coming soon".

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone = 'gold' | 'emerald' | 'red' | 'blue' | 'muted'
export type BadgeSurface = 'navy' | 'light'

const TONE_CLASSES: Record<BadgeSurface, Record<BadgeTone, string>> = {
  navy: {
    gold: 'bg-lca-gold/20 text-lca-gold',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    red: 'bg-red-500/20 text-red-300',
    blue: 'bg-blue-500/20 text-blue-200',
    muted: 'bg-white/10 text-white/60',
  },
  light: {
    gold: 'bg-lca-gold/20 text-[#7a5c00]',
    emerald: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    blue: 'border border-blue-200 bg-blue-50 text-blue-800',
    muted: 'bg-muted text-muted-foreground',
  },
}

export function StatusBadge({
  tone,
  on = 'navy',
  className,
  children,
}: {
  tone: BadgeTone
  on?: BadgeSurface
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[on][tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Tournament lifecycle status → label + tone. */
export const TOURNAMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'Upcoming', tone: 'gold' },
  active: { label: 'Active', tone: 'emerald' },
  completed: { label: 'Completed', tone: 'muted' },
}

/** Registration-status dot: open→green, draft→gold, else→gray. */
export function StatusDot({
  regStatus,
  className,
}: {
  regStatus?: string | null
  className?: string
}) {
  if (regStatus === 'open') {
    return (
      <span
        className={cn('size-1.5 flex-shrink-0 rounded-full bg-emerald-500', className)}
        title="Registration open"
      />
    )
  }
  if (regStatus === 'draft') {
    return (
      <span
        className={cn('size-1.5 flex-shrink-0 rounded-full bg-lca-gold', className)}
        title="Opening soon"
      />
    )
  }
  return (
    <span
      className={cn('size-1.5 flex-shrink-0 rounded-full bg-border', className)}
      title="Coming soon"
    />
  )
}