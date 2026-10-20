// src/areas/events/components/GradeConfirm.tsx
//
// Grade sections and grade prizes don't ask for a grade. The entrant ticks
// a box ("I'm in 8th grade or below this school year"), which is all we
// need to know. One box for the section's range (required), and one
// optional box per grade prize that the section box doesn't already cover.
// The boxes, the ticks and the range they confirm are worked out in
// src/areas/events/gradeConfirm.ts, which src/areas/events/index.ts
// re-exports; this file draws the boxes.
import type { ApiTournamentSection } from '@/lib/api'
import { gradeRangeText } from '@/lib/sectionRules'
import { confirmedRange, gradeBoxes, type GradeTicks } from '@/areas/events/gradeConfirm'

export function GradeConfirm({ section, ticks, onChange, who, compact = false }: {
  section: ApiTournamentSection | undefined
  ticks: GradeTicks
  onChange: (next: GradeTicks) => void
  /** null = the signed-in member ("I'm"); otherwise the player's name. */
  who: string | null
  compact?: boolean
}) {
  const boxes = gradeBoxes(section)
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
              className="mt-0.5 size-4 flex-shrink-0 accent-ink"
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
