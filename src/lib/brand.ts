// src/lib/brand.ts
//
// The LCA palette in one place, and the class strings built from it.
//
// These values are still literals rather than CSS variables because Tailwind
// resolves arbitrary values at build time — `bg-[var(--x)]` would work, but
// every existing class in the app spells the hex out, and mixing the two
// styles is worse than either. The point here is that the button treatment
// and the accent rules live in one file instead of seven.

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
 *
 * This exact string was duplicated in six files. Changing the button used to
 * mean finding all six, and one of them drifting was inevitable.
 */
export const GOLD_BUTTON =
  'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90'
