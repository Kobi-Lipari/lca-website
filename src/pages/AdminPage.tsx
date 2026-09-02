import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Award, Building2, Check, Copy,
  LogIn, Mail, Megaphone, MessageSquare, Pencil, Plus, Search, Share2, Shield,
  ShieldAlert, Trash2, Trophy, Users, X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { AdminAnnouncementPanel } from '@/components/AdminAnnouncementPanel'
import { AuditLogPanel } from '@/components/admin/AuditLogPanel'
import { BoardSeatsPanel } from '@/components/admin/BoardSeatsPanel'
import { MemberSeatsCell } from '@/components/admin/MemberSeatsCell'
import {
  adminAssignBoardSeat,
  adminAssignTournamentDirector,
  adminCreateTournament,
  adminDeleteClub,
  adminDeleteMember,
  adminGetBoardSeats,
  adminGetClubRoster,
  adminGetMembers,
  adminGetTournamentDirectors,
  adminRemoveBoardSeatHolder,
  adminRemoveTournamentDirector,
  adminUpdateMemberClub,
  adminUpdateMemberMembership,
  adminUpdateMemberRole,
  getClubs,
  getTournaments,
  type ApiAdminBoardSeat,
  type ApiAdminMember,
  type ApiClubListItem,
  type ApiSeatHolder,
  type ApiTournamentDirector,
  type ApiTournamentListItem,
  type ApiTournamentSection,
} from '@/lib/api'
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

// ── Constants ─────────────────────────────────────────────────────────────────

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

const SECTION_PRESETS = [
  'Open','U2200','U2000','U1800','U1600','U1400','U1200','U1000',
  'K-12','K-8','K-5','Blitz','Quick',
]
const TC_PRESETS = ['G/60+5','G/90+30','G/120+30','G/30+5','G/15+2','G/5+2','G/3+2']
const ROUND_OPTIONS = [3,4,5,6,7]

type AdminTab = 'members' | 'tournaments' | 'clubs' | 'support' | 'email' | 'announcements' | 'boardseats' | 'audit'
type WizardStep = 'template' | 'basics' | 'sections' | 'schedule' | 'review'

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
  sections: ApiTournamentSection[]
  registrationClosesAt: string
}

const defaultWizard = (): WizardState => ({
  templateType: 'scratch',
  existingTournamentId: '',
  name: '', startDate: '', endDate: '',
  location: '', venue: '',
  rounds: 5, timeControl: 'G/90+30', customTimeControl: '',
  isRated: true, maxPlayers: '', description: '',
  sections: [], registrationClosesAt: '',
})

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="mx-4 w-full max-w-sm rounded-xl border bg-background p-6 shadow-lg">
        <p className="mb-6 text-sm font-medium">{message}</p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
          <Button className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

// ── Tournament directors modal (real — assigns/removes via the directors API) ─

function ShareModal({ tournament, onClose, isAdmin, clubId }: {
  tournament: ApiTournamentListItem
  onClose: () => void
  isAdmin: boolean
  clubId: string | null
}) {
  const [directors, setDirectors] = useState<ApiTournamentDirector[]>([])
  const [pool, setPool] = useState<ApiAdminMember[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dirs, members] = await Promise.all([
          adminGetTournamentDirectors(tournament.id),
          // Admins search all members; club reps search their club roster.
          isAdmin
            ? adminGetMembers()
            : clubId
              ? adminGetClubRoster(clubId)
              : Promise.resolve([] as ApiAdminMember[]),
        ])
        if (!cancelled) {
          setDirectors(dirs)
          setPool(members)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load directors')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tournament.id, isAdmin, clubId])

  const query = search.trim().toLowerCase()
  const directorIds = new Set(directors.map((d) => d.member_id))
  const matches = query.length >= 2
    ? pool
        .filter((m) => !directorIds.has(m.id))
        .filter((m) =>
          m.full_name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query),
        )
        .slice(0, 6)
    : []

  async function assign(memberId: string) {
    setBusyId(memberId)
    setError(null)
    try {
      const dirs = await adminAssignTournamentDirector(tournament.id, memberId)
      setDirectors(dirs)
      setSearch('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign director')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(memberId: string) {
    setBusyId(memberId)
    setError(null)
    try {
      const dirs = await adminRemoveTournamentDirector(tournament.id, memberId)
      setDirectors(dirs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove director')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-t-2xl border bg-background p-6 shadow-lg sm:rounded-xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border sm:hidden" />
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-base font-semibold text-[#1a2744]">Tournament directors</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          {tournament.name} — directors can manage the roster, pairings, and results.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">Loading…</p>
        ) : (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current directors
            </p>
            {directors.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">No directors assigned yet.</p>
            ) : (
              <div className="mb-4">
                {directors.map((d) => (
                  <div key={d.member_id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.email}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === d.member_id}
                      onClick={() => remove(d.member_id)}
                      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      {busyId === d.member_id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add a director
            </p>
            <Input
              placeholder="Search members by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {query.length >= 2 && (
              matches.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-lg border">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className={cn('h-7 text-xs', GOLD)}
                        disabled={busyId === m.id}
                        onClick={() => assign(m.id)}
                      >
                        {busyId === m.id ? 'Adding…' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No members match "{search.trim()}".</p>
              )
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Members you add are given the Tournament Director role automatically,
              and it's removed again when they no longer direct any tournaments.
            </p>
          </>
        )}

        <Button variant="outline" className="mt-5 w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

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
            : idx === currentIdx ? 'border-[#c8a94a] text-[#1a2744]'
            : 'border-transparent text-muted-foreground/50')}>
            <span className={cn('flex size-4 flex-shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold',
              idx < currentIdx ? 'border-[#c8a94a] bg-[#c8a94a] text-[#1a2744]'
              : idx === currentIdx ? 'border-[#1a2744] bg-[#1a2744] text-white'
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
    <div className="mb-4 rounded-lg border border-[#c8a94a]/30 bg-[#c8a94a]/8 p-3">
      <p className="text-sm font-semibold text-[#1a2744]">{w.name || 'New tournament'}</p>
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
            <span key={s.name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/7 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">{s.name}</span>
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
        <div className="bg-[#1a2744] px-3 py-2.5">
          <p className="text-sm font-semibold text-white">{w.name || 'New tournament'}</p>
        </div>
        <div className="space-y-1.5 p-3 text-xs text-muted-foreground">
          <p>{w.startDate || 'Date not set'}</p>
          <p>{w.location || 'Location not set'}</p>
          <p>{w.rounds} rounds · {w.timeControl || '—'}</p>
          {w.sections.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {w.sections.map((s) => (
                <span key={s.name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/7 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">{s.name}</span>
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

function StepTemplate({ w, set, tournaments, onNext }: {
  w: WizardState; set: (p: Partial<WizardState>) => void
  tournaments: ApiTournamentListItem[]; onNext: () => void
}) {
  function handleContinue() {
    if (w.templateType === 'existing' && w.existingTournamentId) {
      const src = tournaments.find((t) => t.id === w.existingTournamentId)
      if (src) {
        const sections = (src.sections as Array<string | { name: string; entryFee: number }>).map((s) =>
          typeof s === 'string' ? { name: s, entryFee: 0 } : s)
        set({ sections, rounds: src.rounds })
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
        ] as { type: 'existing' | 'scratch'; icon: any; title: string; desc: string; note?: string }[]).map(({ type, icon: Icon, title, desc, note }) => (
          <button key={type} type="button" onClick={() => set({ templateType: type })}
            className={cn('w-full rounded-xl border p-4 text-left transition-colors',
              w.templateType === type ? 'border-[2px] border-[#c8a94a] bg-[#c8a94a]/4' : 'border-border hover:border-border-strong')}>
            <div className="mb-1.5 flex items-center gap-3">
              <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1a2744]/8">
                <Icon className="size-3.5 text-[#1a2744]" />
              </div>
              <span className="text-sm font-semibold">{title}</span>
            </div>
            <p className="pl-10 text-xs text-muted-foreground">{desc}</p>
            {note && <p className="pl-10 mt-1 text-xs italic text-[#c8a94a]">{note}</p>}
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
                    <span key={p} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/7 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">{p}</span>
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

function StepBasics({ w, set, onBack, onNext, onDraft }: {
  w: WizardState; set: (p: Partial<WizardState>) => void
  onBack: () => void; onNext: () => void; onDraft: () => void
}) {
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
        <div>
          <Label>Rounds</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ROUND_OPTIONS.map((n) => (
              <button key={n} type="button" onClick={() => set({ rounds: n })}
                className={cn('rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  w.rounds === n ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground hover:border-[#1a2744]/40')}>
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
                  w.timeControl === tc ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground hover:border-[#c8a94a]')}>
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
                    w.isRated === val ? 'border-[#1a2744] bg-[#1a2744] text-white' : 'border-border text-muted-foreground')}>
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
            <Button type="button" variant="outline" onClick={onDraft}>Save draft</Button>
            <Button type="button" className={GOLD} disabled={!w.name || !w.startDate || !w.location} onClick={onNext}>
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
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#c8a94a]/30 bg-[#c8a94a]/8 px-3 py-2 text-xs text-[#7a5c00]">
            <Copy className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
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
                    ? 'border-[#1a2744] bg-[#1a2744] text-white cursor-default'
                    : 'border-border text-muted-foreground hover:border-[#c8a94a]')}>
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
              <div key={s.name} className="grid border-t border-border" style={{ gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr) minmax(0,1.1fr) 32px' }}>
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
          <Trophy className="mx-auto mb-3 size-8 text-[#c8a94a]" />
          <h3 className="text-base font-semibold text-[#1a2744]">Round schedule</h3>
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
          <h3 className="text-base font-semibold text-[#1a2744]">{w.name}</h3>
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
                <span key={s.name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/7 px-3 py-1 text-xs font-medium text-[#1a2744]">
                  {s.name}{s.entryFee > 0 ? ` · $${s.entryFee}` : ''}
                </span>
              ))}
            </div>
          </div>
          {w.description && <div><p className="mb-1 text-sm text-muted-foreground">Description</p><p className="text-sm">{w.description}</p></div>}
        </div>
        <div className="mt-3 rounded-lg border border-[#c8a94a]/30 bg-[#c8a94a]/8 px-4 py-3 text-xs text-[#7a5c00]">
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

// ── Tournaments tab content ───────────────────────────────────────────────────

function TournamentsTab({ tournaments, role, directedTournamentIds, isAdmin, clubId, onRefresh }: {
  tournaments: ApiTournamentListItem[]
  role: string
  directedTournamentIds: string[]
  isAdmin: boolean
  clubId: string | null
  onRefresh: () => void
}) {
  const navigate = useNavigate()
  const [shareTarget, setShareTarget] = useState<ApiTournamentListItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [step, setStep] = useState<WizardStep>('template')
  const [wizard, setWizard] = useState<WizardState>(defaultWizard())
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  function patchWizard(patch: Partial<WizardState>) {
    setWizard((prev) => ({ ...prev, ...patch }))
  }

  // Scope tournaments by role
  const visibleTournaments = role === 'lca_admin'
    ? tournaments
    : role === 'tournament_director'
    ? tournaments.filter((t) => directedTournamentIds.includes(t.id))
    : tournaments // club_rep sees their club's (already filtered by API)

  const copiedFromName = wizard.templateType === 'existing' && wizard.existingTournamentId
    ? tournaments.find((t) => t.id === wizard.existingTournamentId)?.name
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
      } as any)
      const newId = (result as any).id
      navigate(`/admin/tournaments/${newId}`)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create tournament')
      setCreating(false)
    }
  }

  const statusConfig: Record<string, { label: string; className: string }> = {
    upcoming: { label: 'Upcoming', className: 'bg-[#c8a94a]/15 text-[#7a5c00] border border-[#c8a94a]/40' },
    active:   { label: 'Active',   className: 'bg-emerald-100 text-emerald-800' },
    completed:{ label: 'Done',     className: 'bg-muted text-muted-foreground border border-border' },
  }

  return (
    <>
      {shareTarget && (
        <ShareModal
          tournament={shareTarget}
          onClose={() => setShareTarget(null)}
          isAdmin={isAdmin}
          clubId={clubId}
        />
      )}

      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {showCreate ? 'New tournament' : 'Your tournaments'}
        </h2>
        {!showCreate && (
          <Button type="button" className={GOLD} size="sm" onClick={() => { setWizard(defaultWizard()); setStep('template'); setCreateError(null); setShowCreate(true) }}>
            <Plus className="mr-1.5 size-3.5" /> New tournament
          </Button>
        )}
      </div>

      {showCreate ? (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
            <p className="text-sm font-semibold text-[#1a2744]">
              {step === 'template' ? 'Choose a starting point' : WIZARD_STEPS.find((s) => s.key === step)?.label}
            </p>
            <button type="button" onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
          </div>
          {step !== 'template' && <StepBar current={step} />}
          {step === 'template' && <StepTemplate w={wizard} set={patchWizard} tournaments={visibleTournaments} onNext={() => setStep('basics')} />}
          {step === 'basics' && <StepBasics w={wizard} set={patchWizard} onBack={() => setStep('template')} onNext={() => setStep('sections')} onDraft={handleCreate} />}
          {step === 'sections' && <StepSections w={wizard} set={patchWizard} onBack={() => setStep('basics')} onNext={() => setStep('schedule')} onDraft={handleCreate} copiedFrom={copiedFromName} />}
          {step === 'schedule' && <StepSchedule w={wizard} onBack={() => setStep('sections')} onNext={() => setStep('review')} onDraft={handleCreate} />}
          {step === 'review' && <StepReview w={wizard} onBack={() => setStep('schedule')} onCreate={handleCreate} creating={creating} error={createError} />}
        </div>
      ) : visibleTournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium text-[#1a2744]">No tournaments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first tournament to get started.</p>
          <Button type="button" className={cn('mt-4', GOLD)} size="sm" onClick={() => { setWizard(defaultWizard()); setStep('template'); setShowCreate(true) }}>
            <Plus className="mr-1.5 size-4" /> New tournament
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTournaments.map((t) => {
            const sc = statusConfig[t.status] ?? statusConfig.upcoming
            return (
              <div key={t.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                <div className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1a2744]">{t.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {t.date} · {t.location}{t.rounds ? ` · ${t.rounds} rounds` : ''}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', sc.className)}>{sc.label}</span>
                    {t.status === 'completed' ? (
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs"><Link to={`/tournaments/${t.id}`}>View</Link></Button>
                    ) : (
                      <Button asChild size="sm" className={cn('h-7 text-xs', GOLD)}>
                        <Link to={`/admin/tournaments/${t.id}`}>{t.status === 'upcoming' ? 'Edit' : 'Manage'}</Link>
                      </Button>
                    )}
                  </div>
                </div>
                {role !== 'tournament_director' && (
                  <div className="flex items-center gap-3 border-t border-dashed border-border/60 bg-muted/10 px-5 py-2">
                    <Users className="size-3.5 flex-shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Tournament directors</span>
                    <button type="button" onClick={() => setShareTarget(t)}
                      className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-border-strong hover:text-foreground transition-colors">
                      <Share2 className="size-3" /> Manage directors
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ── Members tab content (membership-focused, searchable + filterable; edit controls admin-only) ────

type MembershipFilter = 'active' | 'all'

function MembersTab({
  members, clubs, isAdmin, savingId, boardSeats, seatHolders,
  onRoleChange, onClubChange, onMembershipChange, onDelete, onImpersonate,
  onSeatAdd, onSeatRemove,
}: {
  members: ApiAdminMember[]
  clubs: ApiClubListItem[]
  isAdmin: boolean
  savingId: string | null
  boardSeats: ApiAdminBoardSeat[]
  seatHolders: ApiSeatHolder[]
  onRoleChange: (memberId: string, role: MemberRole) => void
  onClubChange: (memberId: string, clubId: string) => void
  onMembershipChange: (memberId: string, field: 'status' | 'expiry', value: string) => void
  onDelete: (m: ApiAdminMember) => void
  onImpersonate: (m: ApiAdminMember) => void
  onSeatAdd: (seatId: string, memberId: string) => void
  onSeatRemove: (seatId: string, memberId: string) => void
}) {
  const [filter, setFilter] = useState<MembershipFilter>('active')
  const [search, setSearch] = useState('')

  // Search matches name, email, or USCF ID (case-insensitive substring).
  // When a search is typed, it looks across ALL members regardless of the
  // active/all toggle — so "is this person in the system?" always gets a
  // truthful answer, with the status badge/select showing whether they're
  // active. With no search, the toggle behaves as before.
  const query = search.trim().toLowerCase()
  const matches = (m: ApiAdminMember) => {
    if (!query) return true
    const uscf = (m as unknown as { uscf_id?: string | null }).uscf_id ?? ''
    return (
      m.full_name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      uscf.toLowerCase().includes(query)
    )
  }
  const filtered = query
    ? members.filter(matches)
    : filter === 'active'
      ? members.filter((m) => m.membership_status === 'active')
      : members

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      expired: 'bg-destructive/10 text-destructive',
      pending: 'bg-[#c8a94a]/15 text-[#7a5c00]',
    }
    return map[status] ?? 'bg-muted text-muted-foreground'
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members{' '}
          {query
            ? `· ${filtered.length} match${filtered.length !== 1 ? 'es' : ''} of ${members.length}`
            : filter === 'active' ? `· ${filtered.length} active` : `· ${filtered.length} total`}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search name, email, USCF ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 pl-8 text-sm"
            />
          </div>
          <div className={cn('flex gap-1.5 rounded-lg border p-1', query && 'opacity-50')}>
            {(['active', 'all'] as MembershipFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                disabled={!!query}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                  filter === f ? 'bg-[#1a2744] text-white' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'active' ? 'Active only' : 'All members'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 font-semibold">Membership</th>
              <th className="px-3 py-2.5 font-semibold">Expires</th>
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Role</th>}
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Club</th>}
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Board seats</th>}
              {isAdmin && <th className="w-10 px-3 py-2.5" />}
              {isAdmin && <th className="w-10 px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 4} className="px-3 py-8 text-center text-muted-foreground">
                  {query
                    ? <>No members match "{search.trim()}".</>
                    : filter === 'active' ? 'No active members found.' : 'No members found.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium">{m.full_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.email}</td>
                  <td className="px-3 py-2.5">
                    {isAdmin ? (
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                        value={m.membership_status}
                        disabled={savingId === m.id}
                        onChange={(e) => onMembershipChange(m.id, 'status', e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="pending">Pending</option>
                      </select>
                    ) : (
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusBadge(m.membership_status))}>
                        {m.membership_status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isAdmin ? (
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={m.membership_expiry ?? ''}
                        disabled={savingId === m.id}
                        onChange={(e) => onMembershipChange(m.id, 'expiry', e.target.value)}
                      />
                    ) : (
                      <span className="text-muted-foreground">{m.membership_expiry ?? '—'}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={m.role}
                        disabled={savingId === m.id}
                        onChange={(e) => onRoleChange(m.id, e.target.value as MemberRole)}
                      >
                        {MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <select
                        className="max-w-[180px] rounded-md border bg-background px-2 py-1 text-sm"
                        value={m.club_id ?? ''}
                        disabled={savingId === m.id}
                        onChange={(e) => onClubChange(m.id, e.target.value)}
                      >
                        <option value="">No club</option>
                        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <MemberSeatsCell
                        member={m}
                        seats={boardSeats}
                        holders={seatHolders}
                        busy={savingId === m.id}
                        onAdd={onSeatAdd}
                        onRemove={onSeatRemove}
                      />
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => onImpersonate(m)}
                        disabled={m.role === 'lca_admin'}
                        className="text-muted-foreground transition-colors hover:text-[#1a2744] disabled:cursor-not-allowed disabled:opacity-30"
                        title={m.role === 'lca_admin' ? "Can't log in as another admin" : 'Log in as this member'}
                      >
                        <LogIn className="size-4" />
                      </button>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => onDelete(m)} className="text-muted-foreground transition-colors hover:text-destructive" title="Delete member">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminPage() {
  usePageTitle('Admin panel')
  const { role, member, directedTournaments, startImpersonation } = useAuth()
  const navigate = useNavigate()

  const [members, setMembers] = useState<ApiAdminMember[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [boardSeats, setBoardSeats] = useState<ApiAdminBoardSeat[]>([])
  const [seatHolders, setSeatHolders] = useState<ApiSeatHolder[]>([])
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null)

  const isAdmin = role === 'lca_admin'
  const isClubRep = role === 'club_rep'
  const isTD = role === 'tournament_director'
  const directedIds = directedTournaments?.map((t: any) => t.id) ?? []

  // Default tab based on role — members tab is view-only for TDs, fully editable for admins
  const defaultTab: AdminTab = (isAdmin || isTD) ? 'members' : 'tournaments'
  const [tab, setTab] = useState<AdminTab>(defaultTab)

  // Tabs visible per role
  const visibleTabs: { id: AdminTab; label: string; icon: typeof Users }[] = [
    ...(isAdmin || isTD ? [{ id: 'members' as AdminTab, label: 'Members', icon: Users }] : []),
    { id: 'tournaments' as AdminTab, label: 'Tournaments', icon: Trophy },
    ...(isAdmin || isClubRep ? [{ id: 'clubs' as AdminTab, label: 'Clubs', icon: Building2 }] : []),
    ...(isAdmin ? [{ id: 'email' as AdminTab, label: 'Group email', icon: Mail }] : []),
    ...(isAdmin ? [{ id: 'support' as AdminTab, label: 'Support tickets', icon: MessageSquare }] : []),
    ...(isAdmin ? [{ id: 'announcements' as AdminTab, label: 'Announcements', icon: Megaphone }] : []),
    ...(isAdmin ? [{ id: 'boardseats' as AdminTab, label: 'Board seats', icon: Award }] : []),
    ...(isAdmin ? [{ id: 'audit' as AdminTab, label: 'Admin activity', icon: ShieldAlert }] : []),
  ]

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const promises: Promise<any>[] = [getTournaments()]
      if (isAdmin || isClubRep) promises.push(getClubs())
      if (isAdmin || isTD) promises.push(adminGetMembers())
      const [tournamentList, clubList, memberList] = await Promise.all(promises)
      setTournaments(tournamentList ?? [])
      if (clubList) setClubs(clubList)
      if (memberList) setMembers(memberList)
      // Awaited separately rather than joined onto the positional array above:
      // that destructuring assumes a fixed order and already misaligns when a
      // role skips one of the earlier fetches.
      if (isAdmin) {
        const seatData = await adminGetBoardSeats()
        setBoardSeats(seatData.seats)
        setSeatHolders(seatData.holders)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  // Seat assignment is deliberately NOT a members.role change — a seat is a
  // time-bounded grant, so holding one never disturbs whether someone is a
  // club_rep, and losing one never touches their account.
  async function refreshSeats() {
    const seatData = await adminGetBoardSeats()
    setBoardSeats(seatData.seats)
    setSeatHolders(seatData.holders)
  }

  async function handleSeatAdd(seatId: string, memberId: string) {
    setSavingId(memberId)
    try {
      await adminAssignBoardSeat(seatId, memberId)
      await refreshSeats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign seat')
    } finally { setSavingId(null) }
  }

  async function handleSeatRemove(seatId: string, memberId: string) {
    setSavingId(memberId)
    try {
      await adminRemoveBoardSeatHolder(seatId, memberId)
      await refreshSeats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove seat')
    } finally { setSavingId(null) }
  }

  async function handleRoleChange(memberId: string, newRole: MemberRole) {
    setSavingId(memberId)
    try {
      await adminUpdateMemberRole(memberId, newRole)
      setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally { setSavingId(null) }
  }

  async function handleClubChange(memberId: string, clubId: string) {
    setSavingId(memberId)
    try {
      const updated = await adminUpdateMemberClub(memberId, clubId || null)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, club_id: updated.club_id, club_name: clubs.find((c) => c.id === updated.club_id)?.name } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update club')
    } finally { setSavingId(null) }
  }

  async function handleMembershipChange(memberId: string, field: 'status' | 'expiry', value: string) {
    setSavingId(memberId)
    try {
      const body = field === 'status'
        ? { membershipStatus: value }
        : { membershipExpiry: value || null }
      const updated = await adminUpdateMemberMembership(memberId, body)
      setMembers((prev) => prev.map((m) =>
        m.id === memberId ? { ...m, membership_status: updated.membership_status, membership_expiry: updated.membership_expiry } : m))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update membership')
    } finally { setSavingId(null) }
  }

  function confirmDelete(message: string, action: () => Promise<void>) {
    setConfirm({ message, onConfirm: async () => { setConfirm(null); try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'Delete failed') } } })
  }

  function handleDeleteMember(m: ApiAdminMember) {
    confirmDelete(`Delete member "${m.full_name}"? This will remove all their data. This cannot be undone.`,
      async () => { await adminDeleteMember(m.id); setMembers((prev) => prev.filter((x) => x.id !== m.id)) })
  }

  function handleDeleteClub(club: ApiClubListItem) {
    confirmDelete(`Delete club "${club.name}"? Members will be unassigned. This cannot be undone.`,
      async () => { await adminDeleteClub(club.id); setClubs((prev) => prev.filter((c) => c.id !== club.id)) })
  }

  async function handleImpersonate(m: ApiAdminMember) {
    setError(null)
    try {
      await startImpersonation(m.id)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start impersonation')
    }
  }

  return (
    <div>
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}

      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex items-center gap-3">
            <Shield className="size-7 text-[#c8a94a]" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin panel</h1>
              <p className="mt-1 text-sm text-white/60">
                {isAdmin ? 'Manage members, clubs, and tournaments across the LCA.' : 'Manage your tournaments and club.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap gap-2 border-b pb-4">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <Button key={id} type="button" variant={tab === id ? 'default' : 'outline'}
              className={cn(tab === id && GOLD)} onClick={() => setTab(id)}>
              <Icon className="mr-1.5 size-4" /> {label}
            </Button>
          ))}
        </div>

        {error && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <>
            {tab === 'members' && (isAdmin || isTD) && (
              <MembersTab
                members={members}
                clubs={clubs}
                isAdmin={isAdmin}
                savingId={savingId}
                boardSeats={boardSeats}
                seatHolders={seatHolders}
                onRoleChange={handleRoleChange}
                onClubChange={handleClubChange}
                onMembershipChange={handleMembershipChange}
                onDelete={handleDeleteMember}
                onImpersonate={handleImpersonate}
                onSeatAdd={handleSeatAdd}
                onSeatRemove={handleSeatRemove}
              />
            )}

            {tab === 'tournaments' && (
              <TournamentsTab
                tournaments={tournaments}
                role={role ?? 'member'}
                directedTournamentIds={directedIds}
                isAdmin={isAdmin}
                clubId={member?.club_id ?? null}
                onRefresh={loadAll}
              />
            )}

            {tab === 'clubs' && (isAdmin || isClubRep) && (
              <ul className="grid gap-4 sm:grid-cols-2">
                {(isClubRep ? clubs.filter((c) => c.id === member?.club_id) : clubs).map((club) => (
                  <li key={club.id} className="rounded-xl border bg-card p-5 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-[#1a2744]">{club.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {club.city}, LA{club.meeting_schedule ? ` · ${club.meeting_schedule}` : ''}
                        </p>
                      </div>
                      {isAdmin && (
                        <button type="button" onClick={() => handleDeleteClub(club)} className="p-1 text-muted-foreground transition-colors hover:text-destructive" title="Delete club">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <Button asChild className={cn('mt-4', GOLD)} size="sm">
                      <Link to={`/admin/clubs/${club.id}`}>Edit club</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'email' && isAdmin && (
              <div className="py-8 text-center">
                <Mail className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium text-[#1a2744]">Group email</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send an email to members — everyone, or a targeted group by role, club, or membership status.
                </p>
                <Button asChild className={cn('mt-4', GOLD)}>
                  <Link to="/admin/email">Open group email</Link>
                </Button>
              </div>
            )}

            {tab === 'support' && isAdmin && (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium text-[#1a2744]">Support tickets</p>
                <p className="mt-1 text-sm text-muted-foreground">View and respond to member support requests.</p>
                <Button asChild className={cn('mt-4', GOLD)}>
                  <Link to="/admin/support">Open support tickets</Link>
                </Button>
              </div>
            )}

            {tab === 'announcements' && isAdmin && (
              <AdminAnnouncementPanel />
            )}

            {tab === 'boardseats' && isAdmin && <BoardSeatsPanel />}

            {tab === 'audit' && isAdmin && <AuditLogPanel />}

          </>
        )}
      </section>
    </div>
  )
}