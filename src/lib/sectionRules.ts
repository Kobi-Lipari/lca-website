// src/lib/sectionRules.ts
// (Mirror of functions/utils/sectionRules.ts; keep the two identical below this header.)
//
// Who may enter a section. Rules are premade from the section name
// ("U1600" = rated under 1600, "K-5" = kindergarten to grade 5), and a
// director can change or clear any of them. Directors can always place a
// player in any section by hand; these rules only govern online entry.

export interface SectionRules {
  /** Highest rating allowed (U1600 → 1599). null = no ceiling. */
  ratingMax?: number | null
  /** Lowest rating allowed. null = no floor. */
  ratingMin?: number | null
  /** May unrated players enter? Defaults to true. */
  unratedOk?: boolean
  /** Grades allowed, K = 0. null = any grade. */
  gradeMin?: number | null
  gradeMax?: number | null
}

export interface SectionWithRules extends SectionRules {
  name: string
  entryFee?: number
  prizeFund?: string
  /** Set once a director has edited the rules, so names no longer drive them. */
  rulesSet?: boolean
}

/** Rules implied by a section's name, e.g. "U1600", "Under 1400", "K-5", "K-12", "1800+". */
export function rulesFromName(name: string): SectionRules {
  const n = name.trim().toUpperCase()
  const under = /^(?:U|UNDER\s*)(\d{3,4})\b/.exec(n)
  if (under) return { ratingMax: Number(under[1]) - 1, unratedOk: true }
  const over = /^(\d{3,4})\s*\+$/.exec(n) ?? /^(?:OVER|ABOVE)\s*(\d{3,4})\b/.exec(n)
  if (over) return { ratingMin: Number(over[1]), unratedOk: false }
  const grades = /^(K|\d{1,2})\s*[-–]\s*(\d{1,2})\b/.exec(n)
  if (grades) {
    const min = grades[1] === 'K' ? 0 : Number(grades[1])
    const max = Number(grades[2])
    if (max <= 12 && min <= max) return { gradeMin: min, gradeMax: max }
  }
  const primary = /^(K|\d{1,2})\s*(?:ST|ND|RD|TH)?\s*GRADE\b/.exec(n)
  if (primary) {
    const g = primary[1] === 'K' ? 0 : Number(primary[1])
    return { gradeMin: g, gradeMax: g }
  }
  return {}
}

/** The rules in force for a section: the director's if set, else from the name. */
export function effectiveRules(section: SectionWithRules): SectionRules {
  if (section.rulesSet) {
    return {
      ratingMax: section.ratingMax ?? null,
      ratingMin: section.ratingMin ?? null,
      unratedOk: section.unratedOk ?? true,
      gradeMin: section.gradeMin ?? null,
      gradeMax: section.gradeMax ?? null,
    }
  }
  const inferred = rulesFromName(section.name)
  return { unratedOk: true, ...inferred }
}

export const gradeLabel = (g: number) => (g === 0 ? 'K' : String(g))

/**
 * We never ask a player's grade, only whether they're in a range ("8th
 * grade or below"). What we keep is the narrowest range they confirmed,
 * stored as "min-max" (K = 0), e.g. "0-8". That is all the rules and grade
 * prizes need to know.
 */
export interface GradeRange { min: number; max: number }

export function parseGradeRange(value: string | null | undefined): GradeRange | null {
  if (!value) return null
  const v = String(value).trim().toUpperCase()
  const one = (x: string) => (x === 'K' || x === 'KG' ? 0 : Number(x))
  const m = /^(K|KG|\d{1,2})\s*-\s*(K|KG|\d{1,2})$/.exec(v) ?? /^(K|KG|\d{1,2})$/.exec(v)
  if (!m) return null
  const min = one(m[1])
  const max = one(m[2] ?? m[1])
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max > 12 || min > max) return null
  return { min, max }
}

export const formatGradeRange = (r: GradeRange) => `${r.min}-${r.max}`

/** Both ranges confirmed at once: the overlap, or null if they can't both hold. */
export function intersectGradeRanges(a: GradeRange | null, b: GradeRange): GradeRange | null {
  if (!a) return b
  const min = Math.max(a.min, b.min)
  const max = Math.min(a.max, b.max)
  return min <= max ? { min, max } : null
}

const gradeName = (g: number) => {
  if (g === 0) return 'kindergarten'
  const s = ['th', 'st', 'nd', 'rd']
  const v = g % 100
  return `${g}${s[(v - 20) % 10] ?? s[v] ?? s[0]} grade`
}

/** "in 8th grade or below", "in kindergarten", "in 6th through 8th grade". */
export function gradeRangeText(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? 0
  const hi = max ?? 12
  if (lo === hi) return `in ${gradeName(lo)}`
  if (lo === 0 && hi === 12) return 'in kindergarten through 12th grade'
  if (lo === 0) return `in ${gradeName(hi)} or below`
  if (hi === 12) return `in ${gradeName(lo)} or above`
  return `in ${gradeName(lo).replace(' grade', '')} through ${gradeName(hi)}`
}

/** Plain-language summary, e.g. "Rated under 1600 (unrated welcome)". */
export function describeRules(rules: SectionRules): string {
  const parts: string[] = []
  if (rules.ratingMax != null && rules.ratingMin != null) parts.push(`Rated ${rules.ratingMin}–${rules.ratingMax}`)
  else if (rules.ratingMax != null) parts.push(`Rated under ${rules.ratingMax + 1}`)
  else if (rules.ratingMin != null) parts.push(`Rated ${rules.ratingMin}+`)
  if ((rules.ratingMax != null || rules.ratingMin != null)) {
    parts[parts.length - 1] += rules.unratedOk === false ? ' (no unrated)' : ' (unrated welcome)'
  } else if (rules.unratedOk === false) {
    parts.push('Rated players only')
  }
  if (rules.gradeMin != null || rules.gradeMax != null) {
    const text = gradeRangeText(rules.gradeMin, rules.gradeMax)
    parts.push(text.charAt(3).toUpperCase() + text.slice(4))
  }
  return parts.length ? parts.join(' · ') : 'Open to all'
}

export const needsGrade = (rules: SectionRules) => rules.gradeMin != null || rules.gradeMax != null

/** Why a player can't enter, or null if they can. */
export function eligibilityProblem(
  section: SectionWithRules,
  player: { rating: number | null | undefined; gradeRange?: GradeRange | null },
): string | null {
  const r = effectiveRules(section)
  const rating = player.rating && player.rating > 0 ? player.rating : null
  if (rating === null) {
    if (r.unratedOk === false) return `${section.name} is for rated players only.`
  } else {
    if (r.ratingMax != null && rating > r.ratingMax) {
      return `${section.name} is for players rated under ${r.ratingMax + 1}; the rating on file is ${rating}.`
    }
    if (r.ratingMin != null && rating < r.ratingMin) {
      return `${section.name} is for players rated ${r.ratingMin} and up; the rating on file is ${rating}.`
    }
  }
  if (needsGrade(r)) {
    const lo = r.gradeMin ?? 0
    const hi = r.gradeMax ?? 12
    const g = player.gradeRange
    if (!g || g.min < lo || g.max > hi) {
      return `${section.name} is for players ${gradeRangeText(lo, hi)}. Tick the box to confirm the player is.`
    }
  }
  return null
}
