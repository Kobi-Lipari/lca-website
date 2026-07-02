import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, ChevronDown, ChevronLeft, ChevronRight,
  MapPin, Trophy, Users, Clock, Building2, ExternalLink, Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getTournaments,
  type ApiTournamentListItem,
} from '@/lib/api'
import { clubAccentStyle, clubColorTint } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

// ── Types ────────────────────────────────────────────────────────────────────

type ExtendedTournament = ApiTournamentListItem & {
  registration_status?: string
  is_rated?: number
  club_id?: string | null
  club_color?: string | null
  club_name?: string | null
  time_control?: string | null
}

interface ClearinghouseTournament {
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
}

type SectionTab = 'upcoming' | 'active' | 'past'
type TypeFilter = 'all' | 'open' | 'scholastic'
type TimeFilter = 'any' | 'blitz' | 'rapid' | 'classical'
type RatingFilter = 'all' | 'rated' | 'unrated'
type StateFilter = 'LA' | 'MS' | 'AL' | 'TX' | 'FL' | 'all'
type ClearinghouseView = 'list' | 'calendar'

// ── Constants ────────────────────────────────────────────────────────────────

const LCA_GOLD = '#c8a94a'
const NAVY = '#1a2744'

const STATES: { value: StateFilter; label: string }[] = [
  { value: 'LA', label: 'Louisiana' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'AL', label: 'Alabama' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'all', label: 'All states' },
]

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyTimeControl(tc: string | null | undefined): TimeFilter {
  if (!tc) return 'any'
  const m = tc.match(/G\/(\d+)/i)
  if (!m) return 'any'
  const mins = parseInt(m[1], 10)
  if (mins <= 15) return 'blitz'
  if (mins <= 59) return 'rapid'
  return 'classical'
}

function isScholastic(t: ExtendedTournament): boolean {
  const name = t.name.toLowerCase()
  return (
    name.includes('scholastic') ||
    name.includes('youth') ||
    name.includes('junior') ||
    name.includes('kids') ||
    name.includes('school')
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Dropdown ─────────────────────────────────────────────────────────────────

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
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors',
          isActive
            ? 'border-[#c8a94a]/50 bg-[#c8a94a]/15 text-[#f0d07a]'
            : 'border-white/15 bg-white/6 text-white/50 hover:border-white/25 hover:text-white/70',
        )}
      >
        {isActive ? options.find((o) => o.value === value)?.label ?? label : label}
        <ChevronDown className="size-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-muted/50',
                opt.value === value ? 'bg-[#c8a94a]/8 font-medium text-[#1a2744]' : 'text-muted-foreground',
              )}
            >
              <span className={cn(
                'size-3 flex-shrink-0 rounded-full border',
                opt.value === value ? 'border-[#c8a94a] bg-[#c8a94a]' : 'border-border bg-transparent',
              )} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Status dot ───────────────────────────────────────────────────────────────

function StatusDot({ regStatus }: { regStatus?: string }) {
  if (regStatus === 'open')
    return <span className="size-1.5 flex-shrink-0 rounded-full bg-emerald-500" title="Registration open" />
  return <span className="size-1.5 flex-shrink-0 rounded-full bg-[#c8a94a]" title="Opening soon" />
}

// ── Club column item ──────────────────────────────────────────────────────────

interface ClubEntry {
  id: string | null
  name: string
  color: string
  count: number
}

function ClubRow({ club, selected, onClick }: { club: ClubEntry; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
        selected && 'border-l-2 border-l-[#c8a94a] bg-[#c8a94a]/5 pl-[10px]',
      )}
    >
      <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full" style={clubAccentStyle(club.color)} />
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-foreground">{club.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {club.count} {club.count === 1 ? 'tournament' : 'tournaments'}
        </p>
      </div>
    </button>
  )
}

// ── Detail pane ───────────────────────────────────────────────────────────────

function DetailPane({ tournament }: { tournament: ExtendedTournament }) {
  const color = tournament.club_color || LCA_GOLD
  const regOpen = tournament.registration_status === 'open'
  const sections = tournament.sections as Array<string | { name: string }>

  return (
    <div className="p-3.5">
      <h3 className="mb-2.5 text-[14px] font-semibold leading-snug">
        <Link
          to={`/tournaments/${tournament.id}`}
          className="text-[#1a2744] hover:text-[#c8a94a] hover:underline transition-colors"
        >
          {tournament.name}
        </Link>
      </h3>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Calendar className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
          {tournament.date}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <MapPin className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
          {tournament.location}
        </div>
        {tournament.time_control && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {tournament.time_control}
            <span className="rounded border border-border bg-muted/50 px-1 py-px font-mono text-[10px] text-muted-foreground capitalize">
              {classifyTimeControl(tournament.time_control)}
            </span>
          </div>
        )}
        {(tournament.club_name || !tournament.club_id) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Building2 className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={clubAccentStyle(color)} />
              {tournament.club_name ?? 'LCA event'}
            </span>
          </div>
        )}
      </div>
      {sections.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sections.map((s) => {
            const name = typeof s === 'string' ? s : s.name
            return (
              <span key={name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/8 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">
                {name}
              </span>
            )
          })}
          {tournament.is_rated === 1 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
              USCF Rated
            </span>
          )}
        </div>
      )}
      <p className="mt-2.5 text-[11px] text-muted-foreground">${tournament.entry_fee} entry</p>
      {regOpen && <p className="mt-0.5 text-[11px] font-medium text-emerald-600">Registration open</p>}
      <div className="mt-3 flex gap-2">
        {regOpen && (
          <Button asChild size="sm" className="h-7 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
            <Link to={`/tournaments/${tournament.id}`}>Register</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/tournaments/${tournament.id}`}>
            {tournament.status === 'completed' ? 'View results' : 'Full details'}
          </Link>
        </Button>
      </div>
    </div>
  )
}

// ── Clearinghouse card ────────────────────────────────────────────────────────

function ClearinghouseCard({ t, onClick, selected }: {
  t: ClearinghouseTournament
  onClick: () => void
  selected: boolean
}) {
  const stateColor: Record<string, string> = {
    LA: '#1a2744', MS: '#6b2d3e', AL: '#8b1a1a', TX: '#8b4513', FL: '#1a5276',
  }
  const color = stateColor[t.state ?? ''] ?? '#555'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border text-left transition-all hover:shadow-md',
        selected ? 'border-[#c8a94a] bg-[#c8a94a]/5 shadow-sm' : 'border-border bg-card',
      )}
    >
      <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />
      <div className="p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold leading-snug text-foreground line-clamp-2">{t.name}</p>
          {t.state && (
            <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: color }}>
              {t.state}
            </span>
          )}
        </div>
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3 flex-shrink-0 text-[#c8a94a]" />
            {formatDate(t.start_date)}
            {t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ''}
          </p>
          {t.city && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3 flex-shrink-0 text-[#c8a94a]" />
              {t.city}{t.state ? `, ${t.state}` : ''}
            </p>
          )}
          {t.organizer && (
            <p className="flex items-center gap-1.5">
              <Users className="size-3 flex-shrink-0 text-[#c8a94a]" />
              <span className="truncate">{t.organizer}</span>
            </p>
          )}
          {t.rating_system && (
            <p className="flex items-center gap-1.5">
              <Trophy className="size-3 flex-shrink-0 text-[#c8a94a]" />
              {t.rating_system}
              {t.eligibility && t.eligibility !== 'All ages' ? ` · ${t.eligibility}` : ''}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Clearinghouse detail modal ────────────────────────────────────────────────

function ClearinghouseDetail({ t, onClose }: { t: ClearinghouseTournament; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 w-full rounded-t-2xl" style={{ backgroundColor: NAVY }} />
        <div className="p-5">
          <div className="mb-1 flex items-center gap-2">
            {t.state && (
              <span className="rounded bg-[#1a2744] px-1.5 py-0.5 text-[9px] font-bold text-white">{t.state}</span>
            )}
            {t.eligibility && (
              <span className="rounded border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">{t.eligibility}</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-[#1a2744]">{t.name}</h3>

          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 size-4 flex-shrink-0 text-[#c8a94a]" />
              <div>
                <p className="font-medium text-foreground">{formatDate(t.start_date)}</p>
                {t.end_date && t.end_date !== t.start_date && (
                  <p className="text-xs text-muted-foreground">through {formatDate(t.end_date)}</p>
                )}
              </div>
            </div>
            {(t.venue || t.city) && (
              <div className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 flex-shrink-0 text-[#c8a94a]" />
                <div>
                  {t.venue && <p className="font-medium text-foreground">{t.venue}</p>}
                  {t.city && <p className="text-xs text-muted-foreground">{t.city}{t.state ? `, ${t.state}` : ''}</p>}
                </div>
              </div>
            )}
            {t.organizer && (
              <div className="flex items-center gap-2.5">
                <Users className="size-4 flex-shrink-0 text-[#c8a94a]" />
                <p className="text-foreground">{t.organizer}</p>
              </div>
            )}
            {t.rating_system && (
              <div className="flex items-center gap-2.5">
                <Trophy className="size-4 flex-shrink-0 text-[#c8a94a]" />
                <p className="text-foreground">{t.rating_system} rated</p>
              </div>
            )}
            {t.contact && (
              <div className="flex items-start gap-2.5">
                <Globe className="mt-0.5 size-4 flex-shrink-0 text-[#c8a94a]" />
                <p className="break-all text-xs text-muted-foreground">{t.contact}</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            {t.link && (
              <Button asChild size="sm" className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                <a href={t.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Register / Details
                </a>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ tournaments, onSelect }: {
  tournaments: ClearinghouseTournament[]
  onSelect: (t: ClearinghouseTournament) => void
}) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // Build a map of date string -> tournaments
  const dayMap = new Map<string, ClearinghouseTournament[]>()
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
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <button type="button" onClick={prevMonth} className="rounded p-1 hover:bg-muted/50">
          <ChevronLeft className="size-4 text-muted-foreground" />
        </button>
        <h3 className="text-sm font-semibold text-[#1a2744]">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button type="button" onClick={nextMonth} className="rounded p-1 hover:bg-muted/50">
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="py-1.5 text-center text-[10px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="h-10 border-b border-r border-border/40 last:border-r-0" />
          const ts = dayMap.get(day.toString()) ?? []
          const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year
          const hasLA = ts.some(t => t.state === 'LA')
          const hasOther = ts.some(t => t.state !== 'LA')

          return (
            <div
              key={day}
              className={cn(
                'relative h-10 border-b border-r border-border/40 p-0.5 last:border-r-0',
                ts.length > 0 && 'cursor-pointer hover:bg-muted/30',
              )}
              onClick={() => ts.length > 0 && onSelect(ts[0])}
            >
              <span className={cn(
                'flex size-5 items-center justify-center rounded-full text-[11px]',
                isToday ? 'bg-[#1a2744] font-bold text-white' : 'text-foreground',
              )}>
                {day}
              </span>
              {ts.length > 0 && (
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {hasLA && <span className="size-1.5 rounded-full bg-[#c8a94a]" />}
                  {hasOther && <span className="size-1.5 rounded-full bg-slate-400" />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-border px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2 rounded-full bg-[#c8a94a]" /> Louisiana
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-2 rounded-full bg-slate-400" /> Other states
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  usePageTitle('Tournaments')

  // LCA tournaments state
  const [all, setAll] = useState<ExtendedTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<SectionTab>('upcoming')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [selectedClubId, setSelectedClubId] = useState<string | null | 'lca'>('lca')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Clearinghouse state
  const [clearinghouse, setClearinghouse] = useState<ClearinghouseTournament[]>([])
  const [chLoading, setChLoading] = useState(true)
  const [stateFilter, setStateFilter] = useState<StateFilter>('LA')
  const [chView, setChView] = useState<ClearinghouseView>('list')
  const [selectedCH, setSelectedCH] = useState<ClearinghouseTournament | null>(null)

  useEffect(() => {
    getTournaments()
      .then((data) => {
        setAll(data as ExtendedTournament[])
        const first = (data as ExtendedTournament[]).find(t => t.status === 'upcoming' || t.status === 'active')
        if (first) setSelectedId(first.id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setChLoading(true)
    fetch('/api/clearinghouse?upcoming=true')
      .then(r => r.json())
      .then((d: { tournaments: ClearinghouseTournament[] }) => setClearinghouse(d.tournaments ?? []))
      .catch(() => setClearinghouse([]))
      .finally(() => setChLoading(false))
  }, [])

  // Filtered clearinghouse
  const filteredCH = clearinghouse.filter(t =>
    stateFilter === 'all' || t.state === stateFilter
  )

  // LCA derived state (same logic as before)
  const bannerTournament = (() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()
    const upcoming = all.filter(t => t.status === 'upcoming' || t.status === 'active')
    const lcaSameMonth = upcoming.find(t => {
      if (t.club_id !== null && t.club_id !== undefined) return false
      const d = new Date(t.date)
      return d.getMonth() === month && d.getFullYear() === year
    })
    if (lcaSameMonth) return lcaSameMonth
    return upcoming.find(t => t.club_id === null || t.club_id === undefined) ?? upcoming[0] ?? null
  })()

  const tabFiltered = all.filter(t => {
    if (tab === 'upcoming') return t.status === 'upcoming'
    if (tab === 'active') return t.status === 'active'
    return t.status === 'completed'
  })

  const filtered = tabFiltered.filter(t => {
    if (typeFilter === 'scholastic' && !isScholastic(t)) return false
    if (typeFilter === 'open' && isScholastic(t)) return false
    if (timeFilter !== 'any' && classifyTimeControl(t.time_control) !== timeFilter) return false
    if (ratingFilter === 'rated' && t.is_rated !== 1) return false
    if (ratingFilter === 'unrated' && t.is_rated === 1) return false
    if (selectedClubId !== null) {
      if (selectedClubId === 'lca') { if (t.club_id !== null && t.club_id !== undefined) return false }
      else { if (t.club_id !== selectedClubId) return false }
    }
    return true
  })

  const clubMap = new Map<string, ClubEntry>()
  const lcaCount = tabFiltered.filter(t => t.club_id === null || t.club_id === undefined).length
  if (lcaCount > 0) clubMap.set('lca', { id: null, name: 'LCA events', color: LCA_GOLD, count: lcaCount })
  for (const t of tabFiltered) {
    if (!t.club_id) continue
    if (!clubMap.has(t.club_id)) {
      clubMap.set(t.club_id, { id: t.club_id, name: t.club_name ?? 'Unknown club', color: t.club_color || LCA_GOLD, count: 0 })
    }
    const entry = clubMap.get(t.club_id)!
    const passes = (typeFilter === 'all' || (typeFilter === 'scholastic') === isScholastic(t)) &&
      (timeFilter === 'any' || classifyTimeControl(t.time_control) === timeFilter) &&
      (ratingFilter === 'all' || (ratingFilter === 'rated' ? t.is_rated === 1 : t.is_rated !== 1))
    if (passes) entry.count++
  }
  const lcaCountFiltered = tabFiltered.filter(t => {
    if (t.club_id !== null && t.club_id !== undefined) return false
    if (typeFilter !== 'all' && (typeFilter === 'scholastic') !== isScholastic(t)) return false
    if (timeFilter !== 'any' && classifyTimeControl(t.time_control) !== timeFilter) return false
    if (ratingFilter !== 'all' && (ratingFilter === 'rated' ? t.is_rated !== 1 : t.is_rated === 1)) return false
    return true
  }).length
  if (clubMap.has('lca')) clubMap.get('lca')!.count = lcaCountFiltered
  const clubs = Array.from(clubMap.values()).filter(c => c.count > 0)

  const selected = selectedId
    ? (filtered.find(t => t.id === selectedId) ?? filtered[0] ?? null)
    : filtered[0] ?? null

  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find(t => t.id === selectedId))) {
      setSelectedId(filtered[0].id)
    }
  }, [tab, typeFilter, timeFilter, ratingFilter, selectedClubId])

  const activeBanner = selected ?? bannerTournament

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'open', label: 'Open' },
    { value: 'scholastic', label: 'Scholastic' },
  ]
  const timeOptions: { value: TimeFilter; label: string }[] = [
    { value: 'any', label: 'Any time control' },
    { value: 'blitz', label: 'Blitz · G/5–G/15' },
    { value: 'rapid', label: 'Rapid · G/25–G/60' },
    { value: 'classical', label: 'Classical · G/60+' },
  ]
  const ratingOptions: { value: RatingFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'rated', label: 'Rated' },
    { value: 'unrated', label: 'Unrated' },
  ]
  const TAB_LABELS: Record<SectionTab, string> = { upcoming: 'Upcoming', active: 'Active', past: 'Past' }

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
            <p className="mt-1.5 text-sm text-white/60">Browse and register for LCA events across Louisiana.</p>
            <div className="mt-4 flex items-center justify-between border-t border-white/10">
              <div className="flex">
                {(['upcoming', 'active', 'past'] as SectionTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTab(t); setSelectedClubId(null); setSelectedId(null) }}
                    className={cn(
                      'border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors',
                      tab === t ? 'border-[#c8a94a] text-[#c8a94a]' : 'border-transparent text-white/40 hover:text-white/65',
                    )}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 pb-1 pr-1">
                <Dropdown label="Type" value={typeFilter} options={typeOptions} onChange={setTypeFilter} />
                <Dropdown label="Time control" value={timeFilter} options={timeOptions} onChange={setTimeFilter} />
                <Dropdown label="Rating" value={ratingFilter} options={ratingOptions} onChange={setRatingFilter} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Event banner ── */}
      {activeBanner && (
        <div className="flex items-center justify-between border-b border-[#c8a94a]/30 bg-[#c8a94a]/10 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Calendar className="size-3.5 flex-shrink-0 text-[#c8a94a]" />
            {!activeBanner.club_id && (
              <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/18 px-1.5 py-px text-[10px] font-medium text-[#7a5c00]">LCA</span>
            )}
            <span className="truncate text-muted-foreground">
              <span className="font-medium text-foreground">{activeBanner.name}</span>
              {' · '}{activeBanner.date}{' · '}{activeBanner.location}
            </span>
          </div>
          <Button asChild size="sm" className="ml-3 h-7 flex-shrink-0 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
            <Link to={`/tournaments/${activeBanner.id}`}>
              {(activeBanner as ExtendedTournament).registration_status === 'open' ? 'Register now' : 'View details'}
            </Link>
          </Button>
        </div>
      )}

      {/* ── Three-column LCA body ── */}
      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading tournaments…</div>
      ) : error ? (
        <div className="px-6 py-12 text-center text-sm text-destructive">{error}</div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 border-b border-border sm:grid-cols-[1fr_1.55fr_1fr]">
            {/* Left: list */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3 text-[#c8a94a]" />
                  <span className="text-[10px] font-semibold text-foreground capitalize">{TAB_LABELS[tab]}</span>
                  <span className="text-[10px] text-muted-foreground">· {filtered.length}</span>
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[360px]">
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No tournaments match the current filters.</p>
                ) : (
                  filtered.map((t) => {
                    const color = t.club_color || LCA_GOLD
                    const isSel = t.id === selected?.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          'flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
                          isSel && 'border-l-2 border-l-[#c8a94a] pl-[10px]',
                        )}
                        style={{ backgroundColor: isSel ? clubColorTint(color, 0.05) : undefined }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-foreground">{t.name}</p>
                          <p className="text-[10px] text-muted-foreground">{t.date}{t.time_control ? ` · ${t.time_control}` : ''}</p>
                        </div>
                        {t.status === 'upcoming' && <StatusDot regStatus={t.registration_status} />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
            {/* Middle: detail */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center border-b border-border bg-muted/20 px-3 py-1.5">
                <span className="text-[10px] font-semibold text-foreground">Selected tournament</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[360px]">
                {selected ? <DetailPane tournament={selected} /> : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">Select a tournament from the list.</p>
                )}
              </div>
            </div>
            {/* Right: by club */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Building2 className="size-3 text-[#c8a94a]" />
                  <span className="text-[10px] font-semibold text-foreground">By club</span>
                </div>
                <span className="text-[10px] text-muted-foreground">click to filter</span>
              </div>
              <div className="max-h-[320px] flex-1 overflow-y-auto sm:max-h-none">
                {clubs.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">No clubs for this selection.</p>
                ) : (
                  clubs.map((club) => {
                    const key = club.id ?? 'lca'
                    return (
                      <ClubRow
                        key={key}
                        club={club}
                        selected={selectedClubId === key}
                        onClick={() => setSelectedClubId(selectedClubId === key ? null : key)}
                      />
                    )
                  })
                )}
              </div>
              <div className="border-t border-border px-3 py-1.5">
                <p className="text-[10px] italic text-muted-foreground">Number of tournaments in selection</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Gulf South Clearinghouse ── */}
      <section className="border-t-4 border-[#c8a94a]/30 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-8">
          {/* Section header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 inline-block rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#7a5c00]">
                Gulf South Clearinghouse
              </div>
              <h2 className="text-xl font-bold text-[#1a2744]">Regional tournaments</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upcoming chess events across the Gulf South region. Registration and details handled by each organizer.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-border bg-card p-0.5">
                <button
                  type="button"
                  onClick={() => setChView('list')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                    chView === 'list' ? 'bg-[#1a2744] text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Trophy className="size-3" /> List
                </button>
                <button
                  type="button"
                  onClick={() => setChView('calendar')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors',
                    chView === 'calendar' ? 'bg-[#1a2744] text-white' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Calendar className="size-3" /> Calendar
                </button>
              </div>
            </div>
          </div>

          {/* State filter pills */}
          <div className="mb-4 flex flex-wrap gap-2">
            {STATES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStateFilter(s.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-medium transition-colors',
                  stateFilter === s.value
                    ? 'bg-[#1a2744] text-white'
                    : 'border border-border text-muted-foreground hover:border-border-strong',
                )}
              >
                {s.label}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {s.value === 'all'
                    ? clearinghouse.length
                    : clearinghouse.filter(t => t.state === s.value).length}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          {chLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading regional tournaments…</p>
          ) : filteredCH.length === 0 ? (
            <div className="rounded-xl border border-dashed px-6 py-10 text-center">
              <p className="font-medium text-[#1a2744]">No upcoming tournaments in this region</p>
              <p className="mt-1 text-sm text-muted-foreground">Check back soon or select a different state.</p>
            </div>
          ) : chView === 'list' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCH.map(t => (
                <ClearinghouseCard
                  key={t.id}
                  t={t}
                  selected={selectedCH?.id === t.id}
                  onClick={() => setSelectedCH(t)}
                />
              ))}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <MiniCalendar tournaments={filteredCH} onSelect={setSelectedCH} />
              <div>
                {selectedCH ? (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-1 text-[10px] font-medium text-muted-foreground">Selected event</p>
                    <h4 className="font-semibold text-[#1a2744]">{selectedCH.name}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(selectedCH.start_date)}
                      {selectedCH.city ? ` · ${selectedCH.city}, ${selectedCH.state}` : ''}
                    </p>
                    {selectedCH.organizer && (
                      <p className="mt-1 text-xs text-muted-foreground">{selectedCH.organizer}</p>
                    )}
                    <div className="mt-3 flex gap-2">
                      {selectedCH.link && (
                        <Button asChild size="sm" className="bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                          <a href={selectedCH.link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 size-3" />
                            Details
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedCH(null)}>
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">Click a date with a dot to see tournaments</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Detail modal */}
      {selectedCH && chView === 'list' && (
        <ClearinghouseDetail t={selectedCH} onClose={() => setSelectedCH(null)} />
      )}
    </div>
  )
}