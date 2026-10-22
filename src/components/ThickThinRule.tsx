// src/components/ThickThinRule.tsx
//
// The heritage look's thick-thin rule (Looks-1 Heritage Club): a 3px line
// and a 1px line with a 2px gap between, drawn in CSS as the board draws it,
// a 6px box with its top and bottom borders. One rule opens a section, under
// its heading or heading band, with the thick line on top; the reverse, the
// thin line on top, closes one. On a light ground it is drawn in the look's
// ink, which is navy on the light grounds and turns light on the dark ones,
// so the rule keeps showing in dark mode; on a navy band it is brand gold,
// which is for rules, seals and words on navy only.
//
// It is decoration: hidden from screen readers, since the headings already
// mark where a section starts, and it never moves.

import { cn } from '@/lib/utils'

export interface ThickThinRuleProps {
  /** The ground it is drawn on: a light ground (the look's ink) or a navy band (brand gold). */
  on?: 'light' | 'navy'
  /** "open" puts the thick line on top, under a heading; "close" puts it below, at the end of a section. */
  edge?: 'open' | 'close'
  className?: string
}

export function ThickThinRule({ on = 'light', edge = 'open', className }: ThickThinRuleProps) {
  return (
    <div
      aria-hidden="true"
      data-slot="thick-thin-rule"
      className={cn(
        'h-1.5 w-full border-solid',
        edge === 'open' ? 'border-t-[3px] border-b' : 'border-t border-b-[3px]',
        on === 'navy' ? 'border-lca-gold' : 'border-ink',
        className,
      )}
    />
  )
}
