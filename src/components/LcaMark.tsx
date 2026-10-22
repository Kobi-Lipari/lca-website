// src/components/LcaMark.tsx
//
// The rook-shaped Louisiana mark, the one-colour mark of decision D1: the
// header's brand mark at every width, and the mark for tight spaces such as
// the LCA status tag. The full-colour logo, for roomy places, is LcaLogo.
//
// It is the one path of public/favicon.svg, the site's icon, in the same
// 100 by 100 box, and it has no colour of its own: it is filled with the
// colour it inherits from the element around it (currentColor), the colour
// of its words, so it reads wherever they read. A caller colours that
// element, never the mark: a browser keeps a colour set on an SVG itself
// when a contrast theme (forced colours) replaces the page's colours, so a
// mark given white on the navy header would stay white on the theme's
// white ground and vanish, while an inherited colour changes with the
// words. The favicon's own two fills are not copied.
//
// Given a title, "Louisiana Chess Association" unless another is given, it
// is an image named by that title (role img and an SVG title). Given an
// empty or blank title it is decoration, hidden from screen readers, for a
// place whose words beside it already say the name: the header's brand link
// and the LCA tag.
//
// The path lives in this file only. Step 31's Seal draws this component
// inside its own SVG rather than copying the path.

import { cn } from '@/lib/utils'

/** The path of public/favicon.svg, as it is there (test/unit/lca-mark.test.tsx compares the two). */
const ROOK =
  'M5 7.1H16.6V23H28.3V7.1H39.9V23H51.6V7.1H63.2L65.4 25L56.5 40.7L54.2 54.1H90L94.5 74.3L90 78.7H99L92.3 89.9H87.8L83.3 96.6L74.4 94.4L67.7 98.9L49.8 83.2H43L40.8 87.7L9.5 83.2L16.2 49.6L5 31.7V7.1Z'

export interface LcaMarkProps {
  /**
   * The mark's name for a screen reader. An empty or blank title makes it
   * decoration, hidden from screen readers, where words beside it say the
   * name.
   */
  title?: string
  /**
   * Its size (36px, the boards' mark, when none is given), never its colour,
   * which it takes from the element around it.
   */
  className?: string
  /**
   * The data-slot it carries: lca-mark, or status-mark where it is a status
   * tag's mark (the LCA tag), so it is read with the other tags' marks.
   */
  slot?: 'lca-mark' | 'status-mark'
}

export function LcaMark({ title = 'Louisiana Chess Association', className, slot = 'lca-mark' }: LcaMarkProps) {
  const named = title.trim() !== ''
  return (
    <svg
      data-slot={slot}
      viewBox="0 0 100 100"
      fill="currentColor"
      role={named ? 'img' : undefined}
      aria-hidden={named ? undefined : true}
      className={cn('size-9 flex-none', className)}
    >
      {named && <title>{title}</title>}
      <path d={ROOK} />
    </svg>
  )
}
