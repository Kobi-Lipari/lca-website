// functions/utils/sectionRules.ts
// (Mirrored in src/lib/sectionRules.ts for the browser; keep the two identical.)
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

export function parseGrade(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const v = String(value).trim().toUpperCase()
  if (v === 'K' || v === 'KG' || v === '0') return 0
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n : null
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
    const lo = rules.gradeMin ?? 0
    const hi = rules.gradeMax ?? 12
    parts.push(lo === hi ? `Grade ${gradeLabel(lo)}` : `Grades ${gradeLabel(lo)}–${gradeLabel(hi)}`)
  }
  return parts.length ? parts.join(' · ') : 'Open to all'
}

export const needsGrade = (rules: SectionRules) => rules.gradeMin != null || rules.gradeMax != null

/** Why a player can't enter, or null if they can. */
export function eligibilityProblem(
  section: SectionWithRules,
  player: { rating: number | null | undefined; grade?: number | null },
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
    if (player.grade === null || player.grade === undefined) return `Choose the player's grade to enter ${section.name}.`
    const lo = r.gradeMin ?? 0
    const hi = r.gradeMax ?? 12
    if (player.grade < lo || player.grade > hi) {
      return `${section.name} is for ${lo === hi ? `grade ${gradeLabel(lo)}` : `grades ${gradeLabel(lo)}–${gradeLabel(hi)}`}.`
    }
  }
  return null
}
