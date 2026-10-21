// src/components/StatusBadge.tsx
//
// The shared status tag and registration dot. A status is always shown in
// words beside its colour, never by colour alone.
//
// StatusBadge, given a status (open, soon, full, waitlist, closed, live,
// partner or lca), draws the Looks-3 tile's tag in that status's pair of
// tokens, with the default words of src/lib/badgeStatus.ts when its children
// draw nothing. Given a tone, it draws the pill today's pages use, class for
// class: `tone` picks the colour family and `on` the surface, navy or light.
//
// StatusDot is the registration dot of the tournament list: open, draft,
// closed or a status it does not know. Under the new look it says its state
// in words beside the dot; with newLook off it is today's dot, named only by
// its title, which for a closed registration is still "Coming soon".

import type { ReactNode } from 'react'
import { STATUS_LABELS, type BadgeStatus } from '@/lib/badgeStatus'
import { drawsNothing } from '@/lib/drawsNothing'
import { FEATURES } from '@/lib/features'
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
    gold: 'bg-lca-gold/20 text-gold-ink-badge',
    emerald: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    blue: 'border border-blue-200 bg-blue-50 text-blue-800',
    muted: 'bg-muted text-muted-foreground',
  },
}

export type { BadgeStatus } from '@/lib/badgeStatus'

/**
 * The tile's tag (Looks-3 Minimal, .t-tag): 24px high, a 6px radius, 12px
 * words in weight 500 and a 6px gap before them. The same box in every look.
 */
const TAG_SHAPE = 'inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap'

/**
 * Each status's words on its own tint: the pair src/index.css sets in every
 * look, built to be read together (test/unit/contrast.test.ts holds each to
 * 4.5:1), so a status's words never stand on a page or a card alone. One
 * string per status, so the class readers of the tests follow each pair. The
 * closed tag adds the tile's inset hairline.
 */
const STATUS_CLASSES: Record<BadgeStatus, string> = {
  open: 'bg-status-open-tint text-status-open',
  soon: 'bg-status-soon-tint text-status-soon',
  full: 'bg-status-full-tint text-status-full',
  waitlist: 'bg-status-waitlist-tint text-status-waitlist',
  closed: 'bg-status-closed-tint text-status-closed inset-ring inset-ring-hairline',
  live: 'bg-status-live-tint text-status-live',
  partner: 'bg-status-partner-tint text-status-partner',
  lca: 'bg-status-lca-tint text-status-lca',
}

/** Words a pill can show: anything React draws, but not nothing. */
type BadgeWords = Exclude<ReactNode, null | undefined | boolean>

/** A pill in one of today's tones, on the navy hero (the default) or a light card. */
interface TonePillProps {
  tone: BadgeTone
  on?: BadgeSurface
  status?: never
  className?: string
  children: BadgeWords
}

/**
 * A status tag. It is drawn on the look's own ground, never on a navy band
 * (a status there takes a tone on the navy surface), and says so with
 * on="light", which the gold guard reads at every place a badge is drawn.
 */
interface StatusTagProps {
  status: BadgeStatus
  on: 'light'
  tone?: never
  className?: string
  /** The words; the status's default words when none are given or they draw nothing. */
  children?: ReactNode
}

export type StatusBadgeProps = TonePillProps | StatusTagProps

/** The tile's mark before a tag's words: an 8px shape in the words' colour. */
const MARK = { 'data-slot': 'status-mark', viewBox: '0 0 8 8', 'aria-hidden': true, className: 'size-2 flex-none' } as const

/**
 * The shape before a tag's words, so a status shows by shape as well as by
 * colour: a dot for open and live, a dashed ring for soon, a half-filled
 * ring for full and waitlist and a bar for closed (the tile's marks).
 * Decoration beside the words, so hidden from screen readers. The live dot
 * is static: no animation class, and its animation is none.
 */
function StatusMark({ status }: { status: Exclude<BadgeStatus, 'partner' | 'lca'> }) {
  switch (status) {
    case 'open':
      return <svg {...MARK}><circle cx="4" cy="4" r="3.5" fill="currentColor" /></svg>
    case 'live':
      return <svg {...MARK} style={{ animation: 'none' }}><circle cx="4" cy="4" r="3" fill="currentColor" /></svg>
    case 'soon':
      return <svg {...MARK}><circle cx="4" cy="4" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.4" /></svg>
    case 'full':
    case 'waitlist':
      return (
        <svg {...MARK}>
          <circle cx="4" cy="4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M4 .8a3.2 3.2 0 0 1 0 6.4z" fill="currentColor" />
        </svg>
      )
    case 'closed':
      return <svg {...MARK}><rect x="1" y="3.2" width="6" height="1.6" fill="currentColor" /></svg>
  }
}

/** The partner tag's mark after its words: the event registers on the organizer's site. */
function PartnerMark() {
  return (
    <svg data-slot="status-mark" viewBox="0 0 24 24" aria-hidden="true" className="size-[11px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function StatusBadge({ tone, status, on = 'navy', className, children }: StatusBadgeProps) {
  if (status !== undefined) {
    return (
      <span data-slot="status-badge" data-status={status} className={cn(TAG_SHAPE, STATUS_CLASSES[status], className)}>
        {status !== 'partner' && status !== 'lca' && <StatusMark status={status} />}
        {drawsNothing(children) ? STATUS_LABELS[status] : children}
        {status === 'partner' && <PartnerMark />}
      </span>
    )
  }
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

/**
 * StatusDot's states under the new look: the dot's token colour and its
 * words. tournaments.registration_status is draft, open or closed
 * (migrations/0005), and a closed registration says so, as the event page
 * does; open and closed take the status tags' own words. A status the dot
 * does not know is coming soon, as it always was.
 */
const DOT_STATES = {
  open: { colour: 'bg-ok-500', words: STATUS_LABELS.open },
  draft: { colour: 'bg-lca-gold', words: 'Opening soon' },
  closed: { colour: 'bg-border', words: STATUS_LABELS.closed },
  other: { colour: 'bg-border', words: 'Coming soon' },
} as const

/** The state of DOT_STATES a registration status takes. */
function dotState(regStatus: string | null | undefined): keyof typeof DOT_STATES {
  return regStatus === 'open' || regStatus === 'draft' || regStatus === 'closed' ? regStatus : 'other'
}

/**
 * Registration-status dot. Under the new look its words show beside it
 * (`label`, or its state's words), because a title alone is read by few and
 * seen by nobody on a touch screen; the dot is then decoration, hidden from
 * screen readers. With newLook off it is the dot alone with its title, as it
 * always was: open green, draft gold, and anything else, closed included,
 * grey and "Coming soon". A blank label says nothing, so in either state the
 * dot keeps its state's words.
 */
export function StatusDot({
  regStatus,
  label,
  className,
}: {
  regStatus?: string | null
  /** The words for the dot; its state's words when none are given or they are blank. */
  label?: string
  className?: string
}) {
  const own = drawsNothing(label) ? undefined : label
  if (FEATURES.newLook) {
    const state = DOT_STATES[dotState(regStatus)]
    return (
      <span data-slot="status-dot" className={cn('inline-flex flex-shrink-0 items-center gap-1.5 text-[11px] font-medium whitespace-nowrap text-muted-foreground', className)}>
        <span aria-hidden="true" className={cn('size-1.5 flex-shrink-0 rounded-full', state.colour)} />
        {own ?? state.words}
      </span>
    )
  }
  if (regStatus === 'open') {
    return (
      <span
        className={cn('size-1.5 flex-shrink-0 rounded-full bg-emerald-500', className)}
        title={own ?? 'Registration open'}
      />
    )
  }
  if (regStatus === 'draft') {
    return (
      <span
        className={cn('size-1.5 flex-shrink-0 rounded-full bg-lca-gold', className)}
        title={own ?? 'Opening soon'}
      />
    )
  }
  return (
    <span
      className={cn('size-1.5 flex-shrink-0 rounded-full bg-border', className)}
      title={own ?? 'Coming soon'}
    />
  )
}
