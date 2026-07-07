import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, ChevronDown, ChevronLeft, ChevronRight,
  MapPin, Trophy, Clock, Building2, ExternalLink, Globe, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clubAccentStyle, clubColorTint } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UnifiedTournament {
  id: string
  name: string
  start_date: string
  end_date: string | null
  organizer: string | null
  city: string | null
  state: string | null
  venue: string | null
  rating_system: string | null
  eligibility: string | null
  contact: string | null
  link: string | null
  is_lca: number
  source: 'lca' | 'clearinghouse'
  registration_status?: string | null
  entry_fee?: number | null
  sections?: Array<string | { name: string }>
  rounds?: number | null
  status?: string | null
  is_rated?: number | null
  club_id?: string | null
  club_color?: string | null
  club_name?: string | null
  time_control?: string | null
}

type StateFilter = 'LA' | 'MS' | 'AL' | 'TX' | 'FL' | 'out-of-state' | 'all'
type ViewMode = 'list' | 'calendar'
type TypeFilter = 'all' | 'open' | 'scholastic'

// Right column selection
type RightSelection =
  | { kind: 'lca' }
  | { kind: 'club'; clubId: string }
  | { kind: 'other-la' }
  | { kind: 'out-of-state' }
  | null

// ── Constants ─────────────────────────────────────────────────────────────────

const LCA_GOLD = '#c8a94a'
const NAVY = '#1a2744'

const LA_STATES = ['LA']
const OUT_OF_STATE = ['MS', 'AL', 'TX', 'FL']

const STATE_PILLS: { value: StateFilter; label: string }[] = [
  { value: 'LA', label: 'Louisiana' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'AL', label: 'Alabama' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'out-of-state', label: 'Out of State' },
  { value: 'all', label: 'All' },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isScholastic(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('scholastic') || n.includes('youth') || n.includes('junior') || n.includes('kids') || n.includes('school')
}

function stateMatchesPill(state: string | null, pill: StateFilter): boolean {
  if (pill === 'all') return true
  if (pill === 'out-of-state') return state !== 'LA'
  return state === pill
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

interface DropdownProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

function Dropdown<T extends string>({ label, value, options, onChange }: DropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = value !== options[0].value

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors',
          isActive
            ? 'border-[#c8a94a]/50 bg-[#c8a94a]/15 text-[#f0d07a]'
            : 'border-white/15 bg-white/6 text-white/50 hover:border-white/25 hover:text-white/70',
        )}
      >
        {isActive ? options.find(o => o.value === value)?.label ?? label : label}
        <ChevronDown className="size-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/50',
                opt.value === value ? 'bg-[#c8a94a]/8 font-medium text-[#1a2744]' : 'text-muted-foreground',
              )}
            >
              <span className={cn('size-3 flex-shrink-0 rounded-full border', opt.value === value ? 'border-[#c8a94a] bg-[#c8a94a]' : 'border-border')} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ regStatus }: { regStatus?: string | null }) {
  if (regStatus === 'open')
    return <span className="size-1.5 flex-shrink-0 rounded-full bg-emerald-500" title="Registration open" />
  return <span className="size-1.5 flex-shrink-0 rounded-full bg-[#c8a94a]" title="Opening soon" />
}

// ── LCA Detail pane ───────────────────────────────────────────────────────────

function LCADetailPane({ t }: { t: UnifiedTournament }) {
  const color = t.club_color || LCA_GOLD
  const regOpen = t.registration_status === 'open'
  const sections = (t.sections ?? []) as Array<string | { name: string }>

  return (
    <div className="p-3.5">
      <h3 className="mb-2.5 text-[14px] font-semibold leading-snug">
        <Link to={`/tournaments/${t.id}`} className="text-[#1a2744] hover:text-[#c8a94a] hover:underline transition-colors">
          {t.name}
        </Link>
      </h3>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
          {formatDate(t.start_date)}
        </div>
        {t.city && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {t.city}
          </div>
        )}
        {t.time_control && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {t.time_control}
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Building2 className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
            {t.club_name ?? 'LCA event'}
          </span>
        </div>
      </div>
      {sections.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sections.map(s => {
            const name = typeof s === 'string' ? s : s.name
            return (
              <span key={name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/8 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">
                {name}
              </span>
            )
          })}
          {t.is_rated === 1 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              USCF Rated
            </span>
          )}
        </div>
      )}
      {t.entry_fee != null && (
        <p className="mt-2.5 text-[11px] text-muted-foreground">${t.entry_fee} entry</p>
      )}
      {regOpen && <p className="mt-0.5 text-[11px] font-medium text-emerald-600">Registration open</p>}
      <div className="mt-3 flex gap-2">
        {regOpen && (
          <Button asChild size="sm" className="h-7 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
            <Link to={`/tournaments/${t.id}`}>Register</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/tournaments/${t.id}`}>
            {t.status === 'completed' ? 'View results' : 'Full details'}
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── External detail pane ──────────────────────────────────────────────────────

function ExternalDetailPane({ t }: { t: UnifiedTournament }) {
  return (
    <div className="p-3.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">External</span>
        {t.state && t.state !== 'LA' && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">{t.state}</span>
        )}
      </div>
      <h3 className="mb-2.5 text-[14px] font-semibold leading-snug text-[#1a2744]">{t.name}</h3>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
          {formatDate(t.start_date)}
          {t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ''}
        </div>
        {(t.venue || t.city) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {t.venue ?? t.city}{t.state ? `, ${t.state}` : ''}
          </div>
        )}
        {t.organizer && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {t.organizer}
          </div>
        )}
        {t.rating_system && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Trophy className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {t.rating_system}
            {t.eligibility && t.eligibility !== 'All ages' ? ` · ${t.eligibility}` : ''}
          </div>
        )}
        {t.contact && (
          <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Globe className="mt-0.5 size-3.5 flex-shrink-0 text-[#c8a94a]" />
            <span className="break-all">{t.contact}</span>
          </div>
        )}
      </div>
      {t.link && (
        <div className="mt-3">
          <Button asChild size="sm" className="h-7 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
            <a href={t.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 size-3" />
              Register / Details
            </a>
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Right column ──────────────────────────────────────────────────────────────

interface RightColumnProps {
  tournaments: UnifiedTournament[]
  lcaClubs: Map<string, { name: string; color: string; count: number }>
  selection: RightSelection
  onSelect: (s: RightSelection) => void
  otherLaCount: number
  outOfStateCount: number
}

function RightColumn({ tournaments, lcaClubs, selection, onSelect, otherLaCount, outOfStateCount }: RightColumnProps) {
  function isSelected(s: RightSelection): boolean {
    if (!selection && !s) return false
    if (!selection || !s) return false
    if (selection.kind !== s.kind) return false
    if (selection.kind === 'club' && s.kind === 'club') return selection.clubId === s.clubId
    return true
  }

  function toggle(s: RightSelection) {
    onSelect(isSelected(s) ? null : s)
  }

  const rowClass = (s: RightSelection) => cn(
    'flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
    isSelected(s) && 'border-l-2 border-l-[#c8a94a] bg-[#c8a94a]/5 pl-[10px]',
  )

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <Building2 className="size-3 text-[#c8a94a]" />
          <span className="text-[10px] font-semibold text-foreground">By organizer</span>
        </div>
        <span className="text-[10px] text-muted-foreground">click to filter</span>
      </div>

      <div className="max-h-[320px] flex-1 overflow-y-auto sm:max-h-none">
        {/* LCA events */}
        {lcaClubs.size > 0 && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              LCA Clubs
            </div>
            <button type="button" onClick={() => toggle({ kind: 'lca' })} className={rowClass({ kind: 'lca' })}>
              <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full" style={{ backgroundColor: LCA_GOLD }} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-foreground">LCA direct events</p>
                <p className="text-[10px] text-muted-foreground">
                  {[...lcaClubs.values()].reduce((a, c) => a + c.count, 0)} tournaments
                </p>
              </div>
            </button>
            {[...lcaClubs.entries()].map(([clubId, club]) => (
              <button key={clubId} type="button" onClick={() => toggle({ kind: 'club', clubId })} className={rowClass({ kind: 'club', clubId })}>
                <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full" style={{ backgroundColor: club.color }} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-foreground">{club.name}</p>
                  <p className="text-[10px] text-muted-foreground">{club.count} {club.count === 1 ? 'tournament' : 'tournaments'}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {/* Other Louisiana */}
        {otherLaCount > 0 && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Louisiana (External)
            </div>
            <button type="button" onClick={() => toggle({ kind: 'other-la' })} className={rowClass({ kind: 'other-la' })}>
              <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full bg-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-foreground">Other (Louisiana)</p>
                <p className="text-[10px] text-muted-foreground">{otherLaCount} tournaments</p>
              </div>
            </button>
          </>
        )}

        {/* Out of state */}
        {outOfStateCount > 0 && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Regional
            </div>
            <button type="button" onClick={() => toggle({ kind: 'out-of-state' })} className={rowClass({ kind: 'out-of-state' })}>
              <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full bg-slate-500" />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-foreground">Out of State</p>
                <p className="text-[10px] text-muted-foreground">{outOfStateCount} tournaments</p>
              </div>
            </button>
          </>
        )}
      </div>

      <div className="border-t border-border px-3 py-1.5">
        <p className="text-[10px] italic text-muted-foreground">Tournaments in current selection</p>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

function TournamentCalendar({ tournaments, onSelect }: {
  tournaments: UnifiedTournament[]
  onSelect: (t: UnifiedTournament) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const dayMap = new Map<string, UnifiedTournament[]>()
  tournaments.forEach(t => {
    const start = new Date(t.start_date + 'T00:00:00')
    const end = t.end_date ? new Date(t.end_date + 'T00:00:00') : start
    const cur = new Date(start)
    while (cur <= end) {
      if (cur.getFullYear() === year && cur.getMonth() === month) {
        const key = cur.getDate().toString()
        if (!dayMap.has(key)) dayMap.set(key, [])
        dayMap.get(key)!.push(t)
      }
      cur.setDate(cur.getDate() + 1)
    }
  })

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button type="button" onClick={prev} className="rounded p-1 hover:bg-muted/50">
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
        <h3 className="text-sm font-semibold text-[#1a2744]">{MONTH_NAMES[month]} {year}</h3>
        <button type="button" onClick={next} className="rounded p-1 hover:bg-muted/50">
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-border">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} className="h-10 border-b border-r border-border/40 last:border-r-0" />
          const ts = dayMap.get(day.toString()) ?? []
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
          const hasLCA = ts.some(t => t.is_lca === 1)
          const hasExt = ts.some(t => t.is_lca === 0)
          return (
            <div
              key={day}
              className={cn('relative h-10 border-b border-r border-border/40 p-0.5 last:border-r-0', ts.length > 0 && 'cursor-pointer hover:bg-muted/30')}
              onClick={() => ts.length > 0 && onSelect(ts[0])}
            >
              <span className={cn('flex size-5 items-center justify-center rounded-full text-[11px]', isToday ? 'bg-[#1a2744] font-bold text-white' : 'text-foreground')}>
                {day}
              </span>
              {ts.length > 0 && (
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {hasLCA && <span className="size-1.5 rounded-full bg-[#c8a94a]" />}
                  {hasExt && <span className="size-1.5 rounded-full bg-slate-400" />}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2 rounded-full bg-[#c8a94a]" /> LCA hosted
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2 rounded-full bg-slate-400" /> External
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  usePageTitle('Tournaments')

  const [tournaments, setTournaments] = useState<UnifiedTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stateFilter, setStateFilter] = useState<StateFilter>('LA')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rightSelection, setRightSelection] = useState<RightSelection>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/clearinghouse?upcoming=true')
      .then(r => r.json())
      .then((d: { tournaments: UnifiedTournament[] }) => {
        setTournaments(d.tournaments ?? [])
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // ── Sync state pill ↔ right column ────────────────────────────────────────

  function handleStatePill(pill: StateFilter) {
    setStateFilter(pill)
    // Clear right selection unless it still makes sense
    if (pill === 'out-of-state') {
      setRightSelection({ kind: 'out-of-state' })
    } else if (pill !== 'LA' && pill !== 'all') {
      setRightSelection({ kind: 'out-of-state' })
    } else if (pill === 'LA') {
      if (rightSelection?.kind === 'out-of-state') setRightSelection(null)
    } else {
      setRightSelection(null)
    }
    setSelectedId(null)
  }

  function handleRightSelection(s: RightSelection) {
    setRightSelection(s)
    setSelectedId(null)
    if (!s) return
    if (s.kind === 'out-of-state') {
      setStateFilter('out-of-state')
    } else {
      // club, lca, other-la → ensure Louisiana is selected
      setStateFilter('LA')
    }
  }

  // ── Derived: state-filtered tournaments ───────────────────────────────────

  const stateFiltered = tournaments.filter(t => stateMatchesPill(t.state, stateFilter))

  // ── Derived: right column data ────────────────────────────────────────────

  const lcaClubs = new Map<string, { name: string; color: string; count: number }>()
  for (const t of stateFiltered) {
    if (t.is_lca !== 1) continue
    if (!t.club_id) continue // LCA direct events handled separately
    if (!lcaClubs.has(t.club_id)) {
      lcaClubs.set(t.club_id, { name: t.club_name ?? 'Unknown club', color: t.club_color || LCA_GOLD, count: 0 })
    }
    lcaClubs.get(t.club_id)!.count++
  }

  const otherLaCount = stateFiltered.filter(t => t.is_lca === 0 && t.state === 'LA').length
  const outOfStateCount = stateFiltered.filter(t => t.state !== 'LA').length

  // ── Derived: fully filtered list ──────────────────────────────────────────

  const filtered = stateFiltered.filter(t => {
    // Type filter
    if (typeFilter === 'open' && isScholastic(t.name)) return false
    if (typeFilter === 'scholastic' && !isScholastic(t.name)) return false

    // Right column selection
    if (rightSelection) {
      if (rightSelection.kind === 'lca') {
        if (t.is_lca !== 1 || t.club_id !== null) return false
      } else if (rightSelection.kind === 'club') {
        if (t.club_id !== rightSelection.clubId) return false
      } else if (rightSelection.kind === 'other-la') {
        if (t.is_lca !== 0 || t.state !== 'LA') return false
      } else if (rightSelection.kind === 'out-of-state') {
        if (t.state === 'LA') return false
      }
    }

    return true
  })

  // ── Derived: selected tournament ──────────────────────────────────────────

  const selected = selectedId
    ? filtered.find(t => `${t.source}-${t.id}` === selectedId) ?? filtered[0] ?? null
    : filtered[0] ?? null

  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find(t => `${t.source}-${t.id}` === selectedId))) {
      setSelectedId(`${filtered[0].source}-${filtered[0].id}`)
    }
  }, [stateFilter, typeFilter, rightSelection])

  // ── Banner ────────────────────────────────────────────────────────────────

  const banner = tournaments.find(t => t.is_lca === 1 && t.state === 'LA')

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'open', label: 'Open' },
    { value: 'scholastic', label: 'Scholastic' },
  ]

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="px-6 pb-0 pt-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-1 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">
              Louisiana Chess Association
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Tournaments</h1>
            <p className="mt-1.5 text-sm text-white/60">
              LCA events and Gulf South regional tournaments — all in one place.
            </p>

            {/* Controls row */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2">
              {/* State pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {STATE_PILLS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => handleStatePill(s.value)}
                    className={cn(
                      'flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                      stateFilter === s.value
                        ? 'bg-[#c8a94a] text-[#1a2744]'
                        : 'border border-white/20 text-white/50 hover:text-white/70',
                    )}
                  >
                    {s.label}
                    <span className="ml-1.5 opacity-60">
                      {s.value === 'all'
                        ? tournaments.length
                        : s.value === 'out-of-state'
                          ? tournaments.filter(t => t.state !== 'LA').length
                          : tournaments.filter(t => t.state === s.value).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2">
                <Dropdown label="Type" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
                <div className="flex rounded-lg border border-white/20 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                      viewMode === 'list' ? 'bg-[#c8a94a] text-[#1a2744]' : 'text-white/50 hover:text-white/70')}
                  >
                    <Trophy className="size-3" /> List
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('calendar')}
                    className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors',
                      viewMode === 'calendar' ? 'bg-[#c8a94a] text-[#1a2744]' : 'text-white/50 hover:text-white/70')}
                  >
                    <Calendar className="size-3" /> Calendar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Banner ── */}
      {banner && (
        <div className="flex items-center justify-between border-b border-[#c8a94a]/30 bg-[#c8a94a]/10 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Calendar className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/18 px-1.5 py-px text-[10px] font-medium text-[#7a5c00]">LCA</span>
            <span className="truncate text-muted-foreground">
              <span className="font-medium text-foreground">{banner.name}</span>
              {' · '}{formatDate(banner.start_date)}
              {banner.city ? ` · ${banner.city}` : ''}
            </span>
          </div>
          <Button asChild size="sm" className="ml-3 h-7 flex-shrink-0 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
            <Link to={`/tournaments/${banner.id}`}>
              {banner.registration_status === 'open' ? 'Register now' : 'View details'}
            </Link>
          </Button>
        </div>
      )}

      {/* ── Body ── */}
      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading tournaments…</div>
      ) : error ? (
        <div className="px-6 py-12 text-center text-sm text-destructive">{error}</div>
      ) : viewMode === 'calendar' ? (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <TournamentCalendar
            tournaments={filtered}
            onSelect={t => setSelectedId(`${t.source}-${t.id}`)}
          />
          {selected && (
            <div className="mt-4 rounded-xl border border-border bg-card">
              {selected.is_lca === 1
                ? <LCADetailPane t={selected} />
                : <ExternalDetailPane t={selected} />
              }
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 border-b border-border sm:grid-cols-[1fr_1.55fr_1fr]">

            {/* ── Left: list ── */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3 text-[#c8a94a]" />
                  <span className="text-[10px] font-semibold text-foreground">Upcoming</span>
                  <span className="text-[10px] text-muted-foreground">· {filtered.length}</span>
                </div>
                {rightSelection && (
                  <button
                    type="button"
                    onClick={() => handleRightSelection(null)}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear filter ×
                  </button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[420px]">
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No tournaments match the current filters.</p>
                ) : (
                  filtered.map(t => {
                    const key = `${t.source}-${t.id}`
                    const isSel = key === selectedId || (!selectedId && t === filtered[0])
                    const color = t.is_lca === 1 ? (t.club_color || LCA_GOLD) : '#94a3b8'
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedId(key)}
                        className={cn(
                          'flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
                          isSel && 'border-l-2 border-l-[#c8a94a] pl-[10px]',
                        )}
                        style={{ backgroundColor: isSel ? clubColorTint(color, 0.05) : undefined }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[11px] font-medium text-foreground">{t.name}</p>
                            {t.is_lca === 0 && (
                              <span className="flex-shrink-0 rounded border border-border px-1 py-px text-[9px] text-muted-foreground">Ext</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(t.start_date)}
                            {t.city ? ` · ${t.city}` : ''}
                          </p>
                        </div>
                        {t.is_lca === 1 && t.status === 'upcoming' && (
                          <StatusDot regStatus={t.registration_status} />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Middle: detail ── */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center border-b border-border bg-muted/20 px-3 py-1.5">
                <span className="text-[10px] font-semibold text-foreground">Selected tournament</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[420px]">
                {selected ? (
                  selected.is_lca === 1
                    ? <LCADetailPane t={selected} />
                    : <ExternalDetailPane t={selected} />
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Select a tournament from the list.</p>
                )}
              </div>
            </div>

            {/* ── Right: organizer ── */}
            <RightColumn
              tournaments={stateFiltered}
              lcaClubs={lcaClubs}
              selection={rightSelection}
              onSelect={handleRightSelection}
              otherLaCount={otherLaCount}
              outOfStateCount={outOfStateCount}
            />
          </div>
        </div>
      )}
    </div>
  )
}