import { LCA } from '@/lib/brand'
// src/lib/clubColors.ts

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