// src/components/Seal.tsx
//
// The heritage look's seal, after the decided Looks board's seal on the
// Bylaws page: the rook mark on a navy disc inside one thin ring of brand
// gold. The board draws two rings with the seal's words between them; the
// words are left out, so it adds no copy, and of the rings only the outer
// one is kept, as K chose on the preview on Monday, November 16, 2026.
// Brand gold is the seal's line only, which the brief allows for rules and
// seals.
//
// The mark is LcaMark itself, drawn inside the seal's own SVG, so its path
// stays in src/components/LcaMark.tsx alone. LcaMark takes a size and no
// position, so the seal places it with its own geometry: the mark fills the
// seal's 100 by 100 box (its default width and height, and size-full where
// a browser gives a nested SVG a size from CSS), and a group around it
// scales it to 34 units and moves it to the middle. The group sets the
// colour the mark takes, white on the navy, and the mark has none of its
// own, as for every caller of LcaMark.
//
// It is decoration: hidden from screen readers, never focused, and still.

import { LcaMark } from '@/components/LcaMark'
import { cn } from '@/lib/utils'

export interface SealProps {
  /** Its size (64px when none is given). */
  className?: string
}

export function Seal({ className }: SealProps) {
  return (
    <svg
      data-slot="seal"
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cn('size-16 flex-none', className)}
    >
      <circle cx="50" cy="50" r="49" className="fill-brand-navy" />
      <circle cx="50" cy="50" r="45.5" fill="none" strokeWidth="1.25" className="stroke-lca-gold" />
      <g transform="translate(32.3 32) scale(0.34)" className="text-white">
        <LcaMark title="" className="size-full" />
      </g>
    </svg>
  )
}
