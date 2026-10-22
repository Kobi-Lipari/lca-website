// src/areas/events/gradeConfirm.ts
//
// What the grade confirmation shares that is not a component: the ticks an
// entrant gives, the boxes a section asks for, and the grade range the ticked
// boxes confirm. Grade sections and grade prizes never ask for a grade; the
// entrant ticks a box ("I'm in 8th grade or below this school year"). One box
// for the section's range (required), and one optional box per grade prize
// the section box doesn't already cover. GradeConfirm in
// components/GradeConfirm.tsx draws the boxes; this lives here because a
// component file exports only components (react-refresh/only-export-components).
import type { ApiTournamentSection } from '@/lib/api'
import {
  effectiveRules, formatGradeRange, intersectGradeRanges, needsGrade, type GradeRange,
} from '@/lib/sectionRules'

export interface GradeTicks {
  section: boolean
  /** Prize ranges ticked, as "min-max". */
  prizes: string[]
}

export const NO_TICKS: GradeTicks = { section: false, prizes: [] }

export interface GradeBox { key: string; range: GradeRange; required: boolean; prizeLabel?: string }

/** The boxes a section asks the entrant to tick, the section's own first. */
export function gradeBoxes(section: ApiTournamentSection | undefined): GradeBox[] {
  if (!section) return []
  const rules = effectiveRules(section)
  const boxes: GradeBox[] = []
  const sectionRange = needsGrade(rules) ? { min: rules.gradeMin ?? 0, max: rules.gradeMax ?? 12 } : null
  if (sectionRange) boxes.push({ key: 'section', range: sectionRange, required: true })
  const seen = new Set<string>()
  for (const c of section.prizes?.classes ?? []) {
    if (c.gradeMin == null && c.gradeMax == null) continue
    const range = { min: c.gradeMin ?? 0, max: c.gradeMax ?? 12 }
    // Already covered by confirming the section's range.
    if (sectionRange && sectionRange.min >= range.min && sectionRange.max <= range.max) continue
    const key = formatGradeRange(range)
    if (seen.has(key)) continue
    seen.add(key)
    boxes.push({ key, range, required: false, prizeLabel: c.label })
  }
  return boxes
}

/** True when this section asks any grade question at all. */
export const asksGrade = (section: ApiTournamentSection | undefined) => gradeBoxes(section).length > 0

/**
 * The range to send with the entry ("0-8"), or null if nothing was ticked.
 * 'conflict' when the ticked boxes can't all be true.
 */
export function confirmedRange(section: ApiTournamentSection | undefined, ticks: GradeTicks): string | null | 'conflict' {
  let range: GradeRange | null = null
  let any = false
  for (const b of gradeBoxes(section)) {
    const on = b.required ? ticks.section : ticks.prizes.includes(b.key)
    if (!on) continue
    any = true
    range = intersectGradeRanges(range, b.range)
    if (!range) return 'conflict'
  }
  return any && range ? formatGradeRange(range) : null
}
