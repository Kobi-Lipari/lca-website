import { LCA } from '@/lib/brand'
// src/areas/clubs/clubColors.ts

// Returns a CSS rgba string at the given opacity from a hex color
export function clubColorTint(hex: string, opacity = 0.1): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(200,169,74,${opacity})`
  return `rgba(${r},${g},${b},${opacity})`
}

// Returns inline style object for club-tinted card backgrounds
export function clubCardStyle(color?: string | null): React.CSSProperties {
  const hex = color || LCA.gold
  return {
    backgroundColor: clubColorTint(hex, 0.08),
    borderColor: clubColorTint(hex, 0.3),
  }
}

// Returns inline style for accent dot/border
export function clubAccentStyle(color?: string | null): React.CSSProperties {
  return { backgroundColor: color || LCA.gold }
}

/**
 * The colour of words drawn in a club's colour: an officer's title, a news
 * date, a contact link, the initials standing in for a logo. Brand gold is
 * every club's colour until the club picks its own (the database's default),
 * and brand gold is 2.28:1 on white, so a club with brand gold or no colour
 * gets the gold-ink token instead: brand gold with newLook off, exactly as
 * before, and the new look's dark gold on its light grounds. A colour the
 * club chose is its own and is drawn as given.
 */
export function clubTextColor(color?: string | null): string {
  return !color || color.trim().toLowerCase() === LCA.gold ? 'var(--gold-ink)' : color
}