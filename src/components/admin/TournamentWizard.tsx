// src/components/admin/TournamentWizard.tsx
// The new-tournament wizard, shared by the admin panel and the club
// workspace. Extracted from AdminPage.tsx unchanged apart from: the club
// picker (admins only — a club rep's events always belong to their club),
// and sending time control / registration close / copied custom details,
// which the wizard collected but previously never saved.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Check, Copy, Pencil, Plus, Trophy, X,
  type LucideIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  adminCreateTournament,
  type ApiClubListItem,
  type ApiCustomDetail,
  type ApiSectionDraft,
  type ApiTournamentListItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'
import { SectionRulesEditor } from '@/components/tournaments/SectionRulesEditor'

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTION_PRESETS = [
  'Open','U2200','U2000','U1800','U1600','U1400','U1200','U1000',
  'K-12','K-8','K-5','Blitz','Quick',
]
const TC_PRESETS = ['G/60+5','G/90+30','G/120+30','G/30+5','G/15+2','G/5+2','G/3+2']
const ROUND_OPTIONS = [3,4,5,6,7]

export type WizardStep = 'template' | 'basics' | 'sections' | 'schedule' | 'review'

interface WizardState {
  templateType: 'existing' | 'scratch'
  existingTournamentId: string
  name: string
  startDate: string
  endDate: string
  location: string
  venue: string
  rounds: number
  timeControl: string
  customTimeControl: string
  isRated: boolean
  maxPlayers: string
  description: string
  sections: ApiSectionDraft[]
  registrationClosesAt: string
  /** Admin only; '' = no organizing club. Ignored server-side for club reps. */
  clubId: string
  customDetails: ApiCustomDetail[]
}

const defaultWizard = (): WizardState => ({
  templateType: 'scratch',
  existingTournamentId: '',
  name: '', startDate: '', endDate: '',
  location: '', venue: '',
  rounds: 5, timeControl: 'G/90+30', customTimeControl: '',
  isRated: true, maxPlayers: '', description: '',
  sections: [], registrationClosesAt: '',
  clubId: '', customDetails: [],
})

// ── Wizard step bar ───────────────────────────────────────────────────────────

const WIZARD_STEPS: { key: WizardStep; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'sections', label: 'Sections' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'review', label: 'Review' },
]

function StepBar({ current }: { current: WizardStep }) {
  const currentIdx = WIZARD_STEPS.findIndex((s) => s.key === current)
  return (
    <div className="flex items-center overflow-x-auto border-b border-border bg-muted/20 px-4">
      {WIZARD_STEPS.map((step, idx) => (
        <div key={step.key} className="flex flex-shrink-0 items-center">
          <div className={cn('flex items-center gap-1.5 border-b-2 py-2.5 pr-3 text-[11px] font-medium transition-colors',
            idx < currentIdx ? 'border-transparent text-muted-foreground'
            : idx === currentIdx ? 'border-lca-gold text-lca-navy'
            : 'border-transparent text-muted-foreground/50')}>
            <span className={cn('flex size-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold',
              idx < currentIdx ? 'border-lca-gold bg-lca-gold text-lca-navy'
              : idx === currentIdx ? 'border-lca-navy bg-lca-navy text-white'
              : 'border-border text-muted-foreground')}>
              {idx < currentIdx ? <Check className="size-2.5" /> : idx + 1}
            </span>
            {step.label}
          </div>
          {idx < WIZARD_STEPS.length - 1 && <ArrowRight className="mx-1 size-3 flex-shrink-0 text-border" />}
        </div>
      ))}
    </div>
  )
}

// ── Preview banner ────────────────────────────────────────────────────────────

function PreviewBanner({ w }: { w: WizardState }) {
  if (!w.name && !w.startDate) return null
  return (
    <div className="mb-4 rounded-lg border border-lca-gold/30 bg-lca-gold/8 p-3">
      <p className="text-sm font-semibold text-lca-navy">{w.name || 'New tournament'}</p>
      {(w.startDate || w.location) && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          {w.startDate}{w.location ? ` · ${w.location}` : ''}
        </p>
      )}
      <p className="mt-0.5 text-xs text-muted-foreground">
        {w.rounds} rounds · {w.timeControl || w.customTimeControl || '—'} · {w.isRated ? 'USCF Rated' : 'Unrated'}
      </p>
      {w.sections.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {w.sections.map((s) => (
            <span key={s.name} className="rounded-full border border-lca-navy/20 bg-lca-navy/7 px-2 py-0.5 text-[10px] font-medium text-lca-navy">{s.name}</span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Preview sidebar ───────────────────────────────────────────────────────────

function PreviewSidebar({ w }: { w: WizardState }) {
  return (
    <div className="hidden lg:block lg:w-52 lg:flex-shrink-0">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
      <div className="overflow-hidden rounded-xl border">
        <div className="bg-lca-navy px-3 py-2.5">
          <p className="text-sm font-semibold text-white">{w.name || 'New tournament'}</p>
        </div>
        <div className="space-y-1.5 p-3 text-xs text-muted-foreground">
          <p>{w.startDate || 'Date not set'}</p>
          <p>{w.location || 'Location not set'}</p>
          <p>{w.rounds} rounds · {w.timeControl || '—'}</p>
          {w.sections.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {w.sections.map((s) => (
                <span key={s.name} className="rounded-full border border-lca-navy/20 bg-lca-navy/7 px-2 py-0.5 text-[10px] font-medium text-lca-navy">{s.name}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2 text-[10px] italic text-muted-foreground">Preview updates as you fill in details.</p>
    </div>
  )
}

// ── Wizard steps ──────────────────────────────────────────────────────────────

/** The list endpoint returns custom_details as the raw stored JSON string. */
function parseCustomDetails(raw: unknown): ApiCustomDetail[] {
  if (Array.isArray(raw)) return raw as ApiCustomDetail[]
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ApiCustomDetail[]) : []
  } catch {
    return []
  }
}

function StepTemplate({ w, set, tournaments, onNext }: {
  w: WizardState; set: (p: Partial<WizardState>) => void
  tournaments: ApiTournamentListItem[]; onNext: () => void
}) {
  function handleContinue() {
    if (w.templateType === 'existing' && w.existingTournamentId) {
      const src = tournaments.find((t) => t.id === w.existingTournamentId)
      if (src) {
        // The copies are new sections of a new event, so they leave the
        // source's section ids behind (the server ignores ids on create).
        const sections = src.sections.map((s) => {
          const copy: ApiSectionDraft = { ...s }
          delete copy.id
          return copy
        })
        set({
          sections,
          rounds: src.rounds,
          ...(src.time_control ? { timeControl: src.time_control, customTimeControl: '' } : {}),
          customDetails: parseCustomDetails(src.custom_details),
          // Copying a club's event keeps it with that club unless changed.
          ...(src.club_id ? { clubId: src.club_id } : {}),
        })
      }
    }
    onNext()
  }
  return (
    <div className="p-5">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Start from</p>
      <div className="space-y-3">
        {([
          { type: 'existing' as const, icon: Copy, title: 'From an existing tournament', desc: 'Copy sections, time control, and rounds from a past tournament.', note: 'Name, date, and round times are not copied.' },
          { type: 'scratch' as const, icon: Pencil, title: 'From scratch', desc: 'Step-by-step wizard. Start with a blank slate.', note: undefined },
        ] as { type: 'existing' | 'scratch'; icon: LucideIcon; title: string; desc: string; note?: string }[]).map(({ type, icon: Icon, title, desc, note }) => (
          <button key={type} type="button" onClick={() => set({ templateType: type })}
            className={cn('w-full rounded-xl border p-4 text-left transition-colors',
              w.templateType === type ? 'border-[2px] border-lca-gold bg-lca-gold/4' : 'border-border hover:border-border-strong')}>
            <div className="mb-1.5 flex items-center gap-3">
              <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-lca-navy/8">
                <Icon className="size-3.5 text-lca-navy" />
              </div>
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="pl-10 text-xs text-muted-foreground">{desc}</p>
            {note && <p className="pl-10 mt-1 text-xs italic text-lca-navy">{note}</p>}
            {type === 'existing' && w.templateType === 'existing' && (
              <div className="mt-3 pl-10">
                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={w.existingTournamentId} onChange={(e) => set({ existingTournamentId: e.target.value })}
                  onClick={(e) => e.stopPropagation()}>
                  <option value="">Select a tournament…</option>
                  {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.date})</option>)}
                </select>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Sections','Time control','Rounds','Custom details'].map((p) => (
                    <span key={p} className="rounded-full border border-lca-navy/20 bg-lca-navy/7 px-2 py-0.5 text-[10px] font-medium text-lca-navy">{p}</span>
                  ))}
                  {['Name','Date','Round times'].map((p) => (
                    <span key={p} className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground line-through">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end">
        <Button type="button" className={GOLD} disabled={w.templateType === 'existing' && !w.existingTournamentId} onClick={handleContinue}>
          Continue <ArrowRight className="ml-1.5 size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function StepBasics({ w, set, onBack, onNext, onDraft, clubs }: {
  w: WizardState; set: (p: Partial<WizardState>) => void
  onBack: () => void; onNext: () => void; onDraft: () => void
  /** Present only for admins, who choose the organizing club. */
  clubs?: ApiClubListItem[]
}) {
  const basicsComplete = !!(w.name && w.startDate && w.location)
  return (
    <div className="flex gap-6 p-5">
      <div className="flex-1 min-w-0 space-y-4">
        <PreviewBanner w={w} />
        <div>
          <Label htmlFor="t-name">Tournament name</Label>
          <Input id="t-name" placeholder="e.g. Louisiana Open Championship 2026" value={w.name} onChange={(e) => set({ name: e.target.value })} className="mt-1" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="t-start">Start date</Label><Input id="t-start" type="date" value={w.startDate} onChange={(e) => set({ startDate: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="t-end">End date <span className="text-xs font-normal text-muted-foreground">(if multi-day)</span></Label><Input id="t-end" type="date" value={w.endDate} onChange={(e) => set({ endDate: e.target.value })} className="mt-1" /></div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="t-loc">Location</Label><Input id="t-loc" placeholder="Baton Rouge, LA" value={w.location} onChange={(e) => set({ location: e.target.value })} className="mt-1" /></div>
          <div><Label htmlFor="t-venue">Venue <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label><Input id="t-venue" placeholder="Convention Center" value={w.venue} onChange={(e) => set({ venue: e.target.value })} className="mt-1" /></div>
        </div>
        {clubs && (
          <div>
            <Label htmlFor="t-club">Organizing club <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
            <select id="t-club" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={w.clubId} onChange={(e) => set({ clubId: e.target.value })}>
              <option value="">LCA (no club)</option>
              {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">The club's reps will be able to manage this event.</p>
          </div>
        )}
        <div>
          <Label>Rounds</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROUND_OPTIONS.map((n) => (
              <button key={n} type="button" onClick={() => set({ rounds: n })}
                className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  w.rounds === n ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground hover:border-lca-navy/40')}>
                {n}
              </button>
            ))}
            <Input type="number" min={1} max={20} placeholder="Other" className="h-8 w-20 text-sm"
              value={ROUND_OPTIONS.includes(w.rounds) ? '' : w.rounds}
              onChange={(e) => set({ rounds: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <Label>Time control</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TC_PRESETS.map((tc) => (
              <button key={tc} type="button" onClick={() => set({ timeControl: tc, customTimeControl: '' })}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  w.timeControl === tc ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground hover:border-lca-gold')}>
                {tc}
              </button>
            ))}
            <Input placeholder="Custom…" className="h-8 w-28 text-xs"
              value={!TC_PRESETS.includes(w.timeControl) ? w.timeControl : w.customTimeControl}
              onChange={(e) => set({ timeControl: e.target.value, customTimeControl: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Rating</Label>
            <div className="mt-1.5 flex gap-2">
              {[{ val: true, label: 'USCF Rated' }, { val: false, label: 'Unrated' }].map(({ val, label }) => (
                <button key={label} type="button" onClick={() => set({ isRated: val })}
                  className={cn('flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                    w.isRated === val ? 'border-lca-navy bg-lca-navy text-white' : 'border-border text-muted-foreground')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div><Label htmlFor="t-max">Max players <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label><Input id="t-max" type="number" min={1} placeholder="No limit" value={w.maxPlayers} onChange={(e) => set({ maxPlayers: e.target.value })} className="mt-1" /></div>
        </div>
        <div>
          <Label htmlFor="t-desc">Description <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <textarea id="t-desc" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[72px]"
            placeholder="Brief description shown on the public tournament page…"
            value={w.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 size-3.5" /> Back</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={!basicsComplete} onClick={onDraft}>Save draft</Button>
            <Button type="button" className={GOLD} disabled={!basicsComplete} onClick={onNext}>
              Next: Sections <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <PreviewSidebar w={w} />
    </div>
  )
}

function StepSections({ w, set, onBack, onNext, onDraft, copiedFrom }: {
  w: WizardState; set: (p: Partial<WizardState>) => void
  onBack: () => void; onNext: () => void; onDraft: () => void; copiedFrom?: string
}) {
  const [custom, setCustom] = useState('')
  const addPreset = (name: string) => {
    if (w.sections.some((s) => s.name === name)) return
    set({ sections: [...w.sections, { name, entryFee: 0 }] })
  }
  const removeSection = (name: string) => set({ sections: w.sections.filter((s) => s.name !== name) })
  const updateFee = (name: string, val: string) => set({ sections: w.sections.map((s) => s.name === name ? { ...s, entryFee: Number(val) } : s) })
  const updatePrize = (name: string, val: string) => set({ sections: w.sections.map((s) => s.name === name ? { ...s, prizeFund: val } : s) })
  const addCustom = () => {
    const n = custom.trim()
    if (!n || w.sections.some((s) => s.name === n)) return
    set({ sections: [...w.sections, { name: n, entryFee: 0 }] })
    setCustom('')
  }

  return (
    <div className="flex gap-6 p-5">
      <div className="flex-1 min-w-0">
        <PreviewBanner w={w} />
        {copiedFrom && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-lca-gold/30 bg-lca-gold/8 px-3 py-2 text-xs text-[#7a5c00]">
            <Copy className="size-3.5 flex-shrink-0 text-lca-gold" />
            Pre-filled from {copiedFrom} · edit freely — the original is unchanged.
          </div>
        )}
        <div className="mb-3">
          <Label>Add sections</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SECTION_PRESETS.map((name) => (
              <button key={name} type="button" onClick={() => addPreset(name)}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  w.sections.some((s) => s.name === name)
                    ? 'border-lca-navy bg-lca-navy text-white cursor-default'
                    : 'border-border text-muted-foreground hover:border-lca-gold')}>
                {name}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Custom section…" value={custom} onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} className="h-8 text-sm" />
            <Button type="button" variant="outline" size="sm" onClick={addCustom}><Plus className="mr-1 size-3.5" />Add</Button>
          </div>
        </div>
        {w.sections.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-xl border">
            <div className="grid bg-muted/30 border-b border-border" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.1fr) 32px' }}>
              {['Section','Entry fee','Prize fund',''].map((h) => (
                <div key={h} className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{h}</div>
              ))}
            </div>
            {w.sections.map((s) => (
              <div key={s.name} className="border-t border-border">
              <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.1fr) 32px' }}>
                <div className="flex items-center px-3 py-2 text-sm font-medium">{s.name}</div>
                <div className="flex items-center px-2 py-1.5">
                  <Input type="number" min={0} value={s.entryFee} onChange={(e) => updateFee(s.name, e.target.value)}
                    className="h-8 text-sm" style={{ paddingTop: '6px', paddingBottom: '2px' }} />
                </div>
                <div className="flex items-center px-2 py-1.5">
                  <Input placeholder="e.g. $500" value={s.prizeFund ?? ''} onChange={(e) => updatePrize(s.name, e.target.value)}
                    className="h-8 text-sm" style={{ paddingTop: '6px', paddingBottom: '2px' }} />
                </div>
                <div className="flex items-center justify-center">
                  <button type="button" onClick={() => removeSection(s.name)} className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>
                </div>
              </div>
              <div className="px-3 pb-2">
                <SectionRulesEditor section={s} onChange={(next) => set({ sections: w.sections.map((x) => (x.name === s.name ? next : x)) })} />
              </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Label htmlFor="reg-closes">Registration closes <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="reg-closes" type="datetime-local" value={w.registrationClosesAt} onChange={(e) => set({ registrationClosesAt: e.target.value })} className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">Registration will automatically close at this time.</p>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 size-3.5" /> Back</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDraft}>Save draft</Button>
            <Button type="button" className={GOLD} disabled={w.sections.length === 0} onClick={onNext}>
              Next: Schedule <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        </div>
      </div>
      <PreviewSidebar w={w} />
    </div>
  )
}

function StepSchedule({ w, onBack, onNext, onDraft }: {
  w: WizardState; onBack: () => void; onNext: () => void; onDraft: () => void
}) {
  return (
    <div className="flex gap-6 p-5">
      <div className="flex-1 min-w-0">
        <PreviewBanner w={w} />
        <div className="rounded-xl border bg-muted/20 p-6 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-lca-gold" />
          <h3 className="text-base font-semibold text-lca-navy">Round schedule</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Round-by-round dates and times are configured in the tournament management page after creation.
            The auto-fill tool lets you set round 1 and fill the rest automatically.
          </p>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 size-3.5" /> Back</Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onDraft}>Save draft</Button>
            <Button type="button" className={GOLD} onClick={onNext}>Review <ArrowRight className="ml-1.5 size-3.5" /></Button>
          </div>
        </div>
      </div>
      <PreviewSidebar w={w} />
    </div>
  )
}

function StepReview({ w, onBack, onCreate, creating, error }: {
  w: WizardState; onBack: () => void; onCreate: () => void; creating: boolean; error: string | null
}) {
  return (
    <div className="flex gap-6 p-5">
      <div className="flex-1 min-w-0">
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <h3 className="text-base font-semibold text-lca-navy">{w.name}</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-muted-foreground">Date</dt><dd className="font-medium">{w.startDate}{w.endDate ? ` – ${w.endDate}` : ''}</dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd className="font-medium">{w.location}</dd></div>
            {w.venue && <div><dt className="text-muted-foreground">Venue</dt><dd className="font-medium">{w.venue}</dd></div>}
            <div><dt className="text-muted-foreground">Rounds</dt><dd className="font-medium">{w.rounds}</dd></div>
            <div><dt className="text-muted-foreground">Time control</dt><dd className="font-medium">{w.timeControl || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Rating</dt><dd className="font-medium">{w.isRated ? 'USCF Rated' : 'Unrated'}</dd></div>
          </dl>
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Sections</p>
            <div className="flex flex-wrap gap-2">
              {w.sections.map((s) => (
                <span key={s.name} className="rounded-full border border-lca-navy/20 bg-lca-navy/7 px-3 py-1 text-xs font-medium text-lca-navy">
                  {s.name}{s.entryFee > 0 ? ` · $${s.entryFee}` : ''}
                </span>
              ))}
            </div>
          </div>
          {w.description && <div><p className="mb-1 text-sm text-muted-foreground">Description</p><p className="text-sm">{w.description}</p></div>}
        </div>
        <div className="mt-3 rounded-lg border border-lca-gold/30 bg-lca-gold/8 px-4 py-3 text-xs text-[#7a5c00]">
          Tournament will be created as a <strong>draft</strong> — hidden from the public until you make it visible in the management page.
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="mr-1.5 size-3.5" /> Back</Button>
          <Button type="button" className={GOLD} onClick={onCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create tournament'}
          </Button>
        </div>
      </div>
      <PreviewSidebar w={w} />
    </div>
  )
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

/**
 * Owns the wizard's state and the create call. On success it navigates to
 * the new tournament's management page.
 */
export function TournamentWizard({ templates, clubs, onCancel }: {
  /** Tournaments offered under "From an existing tournament". */
  templates: ApiTournamentListItem[]
  /** Pass for admins only — shows the organizing-club picker. */
  clubs?: ApiClubListItem[]
  onCancel: () => void
}) {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>('template')
  const [wizard, setWizard] = useState<WizardState>(defaultWizard())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function patchWizard(patch: Partial<WizardState>) {
    setWizard((prev) => ({ ...prev, ...patch }))
  }

  const copiedFromName = wizard.templateType === 'existing' && wizard.existingTournamentId
    ? templates.find((t) => t.id === wizard.existingTournamentId)?.name
    : undefined

  async function handleCreate() {
    setCreating(true)
    setCreateError(null)
    try {
      const result = await adminCreateTournament({
        name: wizard.name,
        location: wizard.location,
        date: wizard.startDate,
        endDate: wizard.endDate || null,
        venue: wizard.venue || null,
        entryFee: wizard.sections[0]?.entryFee ?? 0,
        sections: wizard.sections,
        rounds: wizard.rounds,
        maxPlayers: wizard.maxPlayers ? Number(wizard.maxPlayers) : null,
        description: wizard.description || null,
        isRated: wizard.isRated,
        status: 'upcoming' as const,
        timeControl: wizard.timeControl.trim() || null,
        registrationClosesAt: wizard.registrationClosesAt || null,
        customDetails: wizard.customDetails.length ? wizard.customDetails : undefined,
        ...(clubs ? { clubId: wizard.clubId || null } : {}),
      })
      navigate(`/admin/tournaments/${String(result.id)}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tournament')
      setCreating(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
        <p className="text-sm font-semibold text-lca-navy">
          {step === 'template' ? 'Choose a starting point' : WIZARD_STEPS.find((s) => s.key === step)?.label}
        </p>
        <button type="button" onClick={onCancel} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      {step !== 'template' && <StepBar current={step} />}
      {step === 'template' && <StepTemplate w={wizard} set={patchWizard} tournaments={templates} onNext={() => setStep('basics')} />}
      {step === 'basics' && <StepBasics w={wizard} set={patchWizard} clubs={clubs} onBack={() => setStep('template')} onNext={() => setStep('sections')} onDraft={handleCreate} />}
      {step === 'sections' && <StepSections w={wizard} set={patchWizard} onBack={() => setStep('basics')} onNext={() => setStep('schedule')} onDraft={handleCreate} copiedFrom={copiedFromName} />}
      {step === 'schedule' && <StepSchedule w={wizard} onBack={() => setStep('sections')} onNext={() => setStep('review')} onDraft={handleCreate} />}
      {step === 'review' && <StepReview w={wizard} onBack={() => setStep('schedule')} onCreate={handleCreate} creating={creating} error={createError} />}
      {createError && step !== 'review' && (
        <p className="border-t border-destructive/30 bg-destructive/10 px-5 py-2 text-sm text-destructive">{createError}</p>
      )}
    </div>
  )
}
