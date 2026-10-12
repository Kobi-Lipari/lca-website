// src/components/tournaments/PrizesEditor.tsx
//
// The director's prize list for one section: place prizes plus any class
// prizes (rated under X, unrated, a grade range). Cash is split among ties
// automatically; items like trophies go by tiebreaks.
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import type { ApiPrizeClass, ApiPrizeSlot, ApiSectionDraft, ApiSectionPrizes } from '@/lib/api'
import { gradeLabel } from '@/lib/sectionRules'

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}
const numOrNull = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const GRADES = Array.from({ length: 13 }, (_, g) => g)

type ClassKind = 'rating' | 'unrated' | 'grade'
const kindOf = (c: ApiPrizeClass): ClassKind =>
  c.unratedOnly ? 'unrated' : c.gradeMin != null || c.gradeMax != null ? 'grade' : 'rating'

function total(p: ApiSectionPrizes | undefined) {
  const sum = (slots: ApiPrizeSlot[] = []) => slots.reduce((a, s) => a + Math.max(0, s.amount ?? 0), 0)
  return p ? sum(p.place) + (p.classes ?? []).reduce((a, c) => a + sum(c.prizes), 0) : 0
}

function SlotsEditor({ slots, onChange, namer }: {
  slots: ApiPrizeSlot[]
  onChange: (next: ApiPrizeSlot[]) => void
  namer: (i: number) => string
}) {
  const input = 'h-8 rounded-md border bg-background px-2 text-sm'
  return (
    <div className="space-y-1.5">
      {slots.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-10 text-xs text-muted-foreground">{namer(i)}</span>
          <span className="text-xs">$</span>
          <input
            type="number" min={0} className={`${input} w-20`} placeholder="0" aria-label={`${namer(i)} cash`}
            value={s.amount ?? ''}
            onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, amount: numOrNull(e.target.value) ?? undefined } : x)))}
          />
          <input
            className={`${input} w-32`} placeholder="Trophy, medal…" aria-label={`${namer(i)} item`}
            value={s.label ?? ''}
            onChange={(e) => onChange(slots.map((x, j) => (j === i ? { ...x, label: e.target.value || undefined } : x)))}
          />
          <button type="button" aria-label="Remove prize" onClick={() => onChange(slots.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...slots, {}])}
        className="inline-flex items-center gap-1 text-xs text-lca-navy underline-offset-2 hover:underline">
        <Plus className="size-3" /> Add prize
      </button>
    </div>
  )
}

export function PrizesEditor({ section, onChange }: {
  section: ApiSectionDraft
  onChange: (next: ApiSectionDraft) => void
}) {
  const [open, setOpen] = useState(false)
  const prizes = section.prizes ?? {}
  const place = prizes.place ?? []
  const classes = prizes.classes ?? []
  const count = place.length + classes.reduce((a, c) => a + c.prizes.length, 0)
  const cash = total(section.prizes)

  const set = (next: ApiSectionPrizes) => {
    const empty = !(next.place?.length) && !(next.classes?.length)
    const copy = { ...section }
    if (empty) delete copy.prizes
    else copy.prizes = next
    onChange(copy)
  }
  const setClass = (i: number, c: ApiPrizeClass) => set({ ...prizes, classes: classes.map((x, j) => (j === i ? c : x)) })
  const addClass = (kind: ClassKind) => {
    const base: ApiPrizeClass = kind === 'unrated'
      ? { label: 'Top unrated', unratedOnly: true, prizes: [{}] }
      : kind === 'grade'
      ? { label: 'Top K-3', gradeMin: 0, gradeMax: 3, prizes: [{}] }
      : { label: 'Top U1400', ratingMax: 1399, prizes: [{}] }
    set({ ...prizes, classes: [...classes, base] })
  }
  const select = 'h-8 rounded-md border bg-background px-1.5 text-sm'
  const input = 'h-8 rounded-md border bg-background px-2 text-sm'

  return (
    <div className="text-xs">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-left text-muted-foreground hover:text-lca-navy">
        {count === 0 ? 'No prizes set' : `${count} prize${count === 1 ? '' : 's'}${cash > 0 ? ` · $${cash} cash` : ''}`}
        <span className="ml-1.5 text-lca-navy underline underline-offset-2">{open ? 'done' : 'edit'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-4 rounded-md border bg-muted/30 p-3">
          <div>
            <p className="mb-1.5 font-semibold text-lca-navy">Place prizes</p>
            <SlotsEditor slots={place} onChange={(next) => set({ ...prizes, place: next })} namer={(i) => ordinal(i + 1)} />
          </div>

          {classes.map((c, i) => {
            const kind = kindOf(c)
            return (
              <div key={i} className="space-y-2 border-t pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input className={`${input} w-40 font-medium`} aria-label="Class prize name" value={c.label}
                    onChange={(e) => setClass(i, { ...c, label: e.target.value })} />
                  {kind === 'rating' && (
                    <>
                      <span>rated under</span>
                      <input type="number" min={100} step={100} className={`${input} w-20`} aria-label="Rated under"
                        value={c.ratingMax != null ? c.ratingMax + 1 : ''}
                        onChange={(e) => { const n = numOrNull(e.target.value); setClass(i, { ...c, ratingMax: n == null ? null : n - 1 }) }} />
                      <label className="flex items-center gap-1">
                        <input type="checkbox" checked={!!c.unratedOk} onChange={(e) => setClass(i, { ...c, unratedOk: e.target.checked })} />
                        unrated may win it
                      </label>
                    </>
                  )}
                  {kind === 'unrated' && <span className="text-muted-foreground">unrated players only</span>}
                  {kind === 'grade' && (
                    <>
                      <span>grades</span>
                      <select className={select} aria-label="From grade" value={c.gradeMin ?? ''}
                        onChange={(e) => setClass(i, { ...c, gradeMin: e.target.value === '' ? null : Number(e.target.value) })}>
                        {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                      </select>
                      <span>to</span>
                      <select className={select} aria-label="To grade" value={c.gradeMax ?? ''}
                        onChange={(e) => setClass(i, { ...c, gradeMax: e.target.value === '' ? null : Number(e.target.value) })}>
                        {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                      </select>
                    </>
                  )}
                  <button type="button" aria-label="Remove class prize" className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => set({ ...prizes, classes: classes.filter((_, j) => j !== i) })}>
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <SlotsEditor slots={c.prizes} onChange={(next) => setClass(i, { ...c, prizes: next })} namer={(n) => ordinal(n + 1)} />
              </div>
            )
          })}

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-muted-foreground">Add a class prize:</span>
            <button type="button" className="rounded-full border px-2.5 py-0.5 hover:border-lca-navy/40" onClick={() => addClass('rating')}>Rating class</button>
            <button type="button" className="rounded-full border px-2.5 py-0.5 hover:border-lca-navy/40" onClick={() => addClass('unrated')}>Top unrated</button>
            <button type="button" className="rounded-full border px-2.5 py-0.5 hover:border-lca-navy/40" onClick={() => addClass('grade')}>Grade</button>
          </div>
          <p className="text-muted-foreground">
            Cash is split evenly among players tied on score, and each player gets only their largest cash prize
            (US Chess rules). Items like trophies can't be split, so they go by tiebreaks. Class prizes use the
            rating at entry. For grade prizes, entrants tick a box on the entry form to confirm they qualify.
          </p>
        </div>
      )}
    </div>
  )
}
