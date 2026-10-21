// src/lib/brand.ts
//
// The LCA palette in one place, and the class strings built from it.
//
// These values are still literals rather than CSS variables because Tailwind
// resolves arbitrary values at build time — `bg-[var(--x)]` would work, but
// every existing class in the app spells the hex out, and mixing the two
// styles is worse than either. The point here is that the button treatment
// and the accent rules live in one file instead of seven.
//
// The new look (the newLook switch) works from the semantic tokens in
// src/index.css instead: text-ink, bg-ground, text-gold-ink (#866a1e, the
// gold for text on a light ground) and the rest, which change with dark mode
// and each look. New code uses those; these literals are today's look.

/** Brand colors. Contrast ratios below are against white unless stated. */
/** Typed as string, not as const: these are a palette, and a literal type
 *  here silently narrows any state initialised from one. */
export const LCA: Readonly<Record<'navy' | 'gold' | 'cream', string>> = {
  /** 14.81:1 — body copy, headings, and the navy grounds themselves. */
  navy: '#1a2744',
  /** 2.28:1 — an accent only. See GOLD_BUTTON for the one text pairing
   *  that passes; gold must never carry text on a light ground. */
  gold: '#c8a94a',
  /** Section and email grounds. */
  cream: '#f4f4f0',
}

/**
 * The primary action button: navy on gold at 6.51:1, which clears AA.
 * text-brand-navy is the navy that stays navy in every look and in dark mode,
 * as navy words on a gold fill must (the same #1a2744 text-lca-navy paints).
 *
 * This exact string was duplicated in six files. Changing the button used to
 * mean finding all six, and one of them drifting was inevitable.
 */
export const GOLD_BUTTON =
  'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90'

/**
 * Long admin lists and tables: a fixed-height box that scrolls on its own,
 * so the horizontal scrollbar and the rest of the page stay in reach.
 * Pair with a sticky header (`sticky top-0`) on tables.
 */
export const ADMIN_SCROLL = 'max-h-[70vh] overflow-auto overscroll-contain'
