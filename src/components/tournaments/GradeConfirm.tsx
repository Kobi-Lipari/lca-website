// src/components/tournaments/GradeConfirm.tsx
//
// Grade sections and grade prizes don't ask for a grade. The entrant ticks
// a box ("I'm in 8th grade or below this school year"), which is all we
// need to know. One box for the section's range (required), and one
// optional box per grade prize that the section box doesn't already cover.
import type { ApiTournamentSection } from '@/lib/api'
import {
  effectiveRules, formatGradeRange, gradeRangeText, intersectGradeRanges, needsGrade, type GradeRange,
} from '@/lib/sectionRules'

export interface GradeTicks {
  section: boolean
  /** Prize ranges ticked, as "min-max". */
  prizes: string[]
}

export const NO_TICKS: GradeTicks = { section: false, prizes: [] }

interface Box { key: string; range: GradeRange; required: boolean; prizeLabel?: string }

function boxesFor(section: ApiTournamentSection | undefined): Box[] {
  if (!section) return []
  const rules = effectiveRules(section)
  const boxes: Box[] = []
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
export const asksGrade = (section: ApiTournamentSection | undefined) => boxesFor(section).length > 0

/**
 * The range to send with the entry ("0-8"), or null if nothing was ticked.
 * 'conflict' when the ticked boxes can't all be true.
 */
export function confirmedRange(section: ApiTournamentSection | undefined, ticks: GradeTicks): string | null | 'conflict' {
  let range: GradeRange | null = null
  let any = false
  for (const b of boxesFor(section)) {
    const on = b.required ? ticks.section : ticks.prizes.includes(b.key)
    if (!on) continue
    any = true
    range = intersectGradeRanges(range, b.range)
    if (!range) return 'conflict'
  }
  return any && range ? formatGradeRange(range) : null
}

export function GradeConfirm({ section, ticks, onChange, who, compact = false }: {
  section: ApiTournamentSection | undefined
  ticks: GradeTicks
  onChange: (next: GradeTicks) => void
  /** null = the signed-in member ("I'm"); otherwise the player's name. */
  who: string | null
  compact?: boolean
}) {
  const boxes = boxesFor(section)
  if (boxes.length === 0) return null
  const subject = who ? `${who} is` : "I'm"
  const conflict = confirmedRange(section, ticks) === 'conflict'
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {boxes.map((b) => {
        const checked = b.required ? ticks.section : ticks.prizes.includes(b.key)
        return (
          <label key={b.key} className="flex cursor-pointer items-start gap-2 text-sm leading-snug">
            <input
              type="checkbox"
              className="mt-0.5 size-4 flex-shrink-0 accent-[#1a2744]"
              checked={checked}
              onChange={(e) => onChange(b.required
                ? { ...ticks, section: e.target.checked }
                : { ...ticks, prizes: e.target.checked ? [...ticks.prizes, b.key] : ticks.prizes.filter((k) => k !== b.key) })}
            />
            <span>
              {subject} {gradeRangeText(b.range.min, b.range.max)} this school year
              {b.prizeLabel
                ? <span className="text-muted-foreground"> (optional, for the {b.prizeLabel} prize)</span>
                : <span className="text-muted-foreground"> (required for this section)</span>}
            </span>
          </label>
        )
      })}
      {conflict && <p className="text-xs text-destructive">Those can't all be true. Untick the ones that don't apply.</p>}
    </div>
  )
}
