// src/components/tournaments/SectionRulesEditor.tsx
//
// Who may enter a section. Rules start out filled in from the section's
// name ("U1600", "K-5"); the director can change or clear any of them.
// These govern online entry only: a director can still place anyone in any
// section from the roster.
import { useState } from 'react'

import type { ApiTournamentSection } from '@/lib/api'
import { describeRules, effectiveRules, gradeLabel, rulesFromName } from '@/lib/sectionRules'
import { cn } from '@/lib/utils'

const GRADES = Array.from({ length: 13 }, (_, g) => g)
const numOrNull = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v)))

export function SectionRulesEditor({ section, onChange }: {
  section: ApiTournamentSection
  onChange: (next: ApiTournamentSection) => void
}) {
  const [open, setOpen] = useState(false)
  const rules = effectiveRules(section)
  const fromName = !section.rulesSet

  /** Any edit pins the rules, so renaming the section no longer changes them. */
  function set(patch: Partial<ApiTournamentSection>) {
    onChange({
      ...section,
      ratingMax: rules.ratingMax ?? null,
      ratingMin: rules.ratingMin ?? null,
      unratedOk: rules.unratedOk ?? true,
      gradeMin: rules.gradeMin ?? null,
      gradeMax: rules.gradeMax ?? null,
      ...patch,
      rulesSet: true,
    })
  }

  function resetToName() {
    const next = { ...section }
    delete next.ratingMax
    delete next.ratingMin
    delete next.unratedOk
    delete next.gradeMin
    delete next.gradeMax
    delete next.rulesSet
    onChange(next)
  }

  const inferred = describeRules({ unratedOk: true, ...rulesFromName(section.name) })
  const input = 'h-8 w-20 rounded-md border bg-background px-2 text-sm'
  const select = 'h-8 rounded-md border bg-background px-1.5 text-sm'

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-left text-muted-foreground hover:text-lca-navy"
        title="Change who can enter this section"
      >
        {describeRules(rules)}
        <span className="ml-1.5 text-lca-navy underline underline-offset-2">{open ? 'done' : 'edit'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex items-center gap-1.5">
              Rated under
              <input
                type="number" min={100} step={100} className={input} placeholder="any"
                value={rules.ratingMax != null ? rules.ratingMax + 1 : ''}
                onChange={(e) => { const n = numOrNull(e.target.value); set({ ratingMax: n == null ? null : n - 1 }) }}
              />
            </label>
            <label className="flex items-center gap-1.5">
              Rated at least
              <input
                type="number" min={100} step={100} className={input} placeholder="any"
                value={rules.ratingMin ?? ''}
                onChange={(e) => set({ ratingMin: numOrNull(e.target.value) })}
              />
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox" checked={rules.unratedOk !== false}
                onChange={(e) => set({ unratedOk: e.target.checked })}
              />
              Unrated players welcome
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            Grades
            <select
              className={select} value={rules.gradeMin ?? ''}
              onChange={(e) => set({ gradeMin: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">any</option>
              {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
            </select>
            to
            <select
              className={select} value={rules.gradeMax ?? ''}
              onChange={(e) => set({ gradeMax: e.target.value === '' ? null : Number(e.target.value) })}
            >
              <option value="">any</option>
              {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
            </select>
            <span className="text-muted-foreground">(entrants tick a box to confirm; we never ask the actual grade)</span>
          </div>
          <div className={cn('flex flex-wrap items-center gap-2 text-muted-foreground')}>
            {fromName ? (
              <span>Filled in from the section name.</span>
            ) : (
              <button type="button" onClick={resetToName} className="text-lca-navy underline underline-offset-2">
                Go back to the name's default ({inferred})
              </button>
            )}
            <span>You can still place anyone in this section from the roster.</span>
          </div>
        </div>
      )}
    </div>
  )
}
