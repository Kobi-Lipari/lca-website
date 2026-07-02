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
  // LCA-only fields
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

type StateFilter = 'LA' | 'MS' | 'AL' | 'TX' | 'FL' | 'all'
type ViewMode = 'list' | 'calendar'
type TypeFilter = 'all' | 'open' | 'scholastic' | 'external'

// ── Constants ─────────────────────────────────────────────────────────────────

const LCA_GOLD = '#c8a94a'
const NAVY = '#1a2744'

const STATE_COLORS: Record<string, string> = {
  LA: '#1a2744', MS: '#6b2d3e', AL: '#8b1a1a', TX: '#8b4513', FL: '#1a5276',
}

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isScholastic(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('scholastic') || n.includes('youth') || n.includes('junior') || n.includes('kids') || n.includes('school')
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

interface DropdownProps<T extends string> {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  dark?: boolean
}

function Dropdown<T extends string>({ label, value, options, onChange, dark }: DropdownProps<T>) {
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
          dark
            ? isActive
              ? 'border-[#c8a94a]/50 bg-[#c8a94a]/15 text-[#f0d07a]'
              : 'border-white/15 bg-white/6 text-white/50 hover:border-white/25 hover:text-white/70'
            : isActive
              ? 'border-[#c8a94a] bg-[#c8a94a]/10 text-[#1a2744]'
              : 'border-border bg-card text-muted-foreground hover:border-border-strong',
        )}
      >
        {isActive ? options.find(o => o.value === value)?.label ?? label : label}
        <ChevronDown className="size-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-lg border border-border bg-popover shadow-md">
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

// ── Tournament card ───────────────────────────────────────────────────────────

function TournamentCard({ t, selected, onClick }: {
  t: UnifiedTournament
  selected: boolean
  onClick: () => void
}) {
  const color = t.is_lca ? (t.club_color || LCA_GOLD) : (STATE_COLORS[t.state ?? ''] ?? '#555')
  const regOpen = t.registration_status === 'open'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border text-left transition-all hover:shadow-md',
        selected ? 'border-[#c8a94a] shadow-sm' : 'border-border bg-card',
      )}
      style={{ backgroundColor: selected ? clubColorTint(color, 0.04) : undefined }}
    >
      <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: color }} />
      <div className="p-3.5">
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">{t.name}</p>
          <div className="flex flex-shrink-0 flex-col items-end gap-1">
            {t.state && (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: color }}>
                {t.state}
              </span>
            )}
            {t.is_lca ? (
              <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#7a5c00]">LCA</span>
            ) : (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">External</span>
            )}
          </div>
        </div>
        <div className="space-y-1 text-[10px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Calendar className="size-3 flex-shrink-0text-[#c8a94a]" />
            {formatDate(t.start_date)}
            {t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ''}
          </p>
          {(t.city || t.venue) && (
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3 flex-shrink-0 text-[#c8a94a]" />
              <span className="truncate">{t.venue ?? t.city}{t.state ? `, ${t.state}` : ''}</span>
            </p>
          )}
          {t.organizer && (
            <p className="flex items-center gap-1.5">
              <Users className="size-3 flex-shrink-0 text-[#c8a94a]" />
              <span className="truncate">{t.organizer}</span>
            </p>
          )}
          {(t.rating_system || t.time_control) && (
            <p className="flex items-center gap-1.5">
              <Trophy className="size-3 flex-shrink-0 text-[#c8a94a]" />
              {t.rating_system ?? t.time_control}
              {t.eligibility && t.eligibility !== 'All ages' ? ` · ${t.eligibility}` : ''}
            </p>
          )}
        </div>
        {t.is_lca && regOpen && (
          <p className="mt-2 text-[10px] font-medium text-emerald-600">Registration open</p>
        )}
        {t.entry_fee != null && (
          <p className="mt-1 text-[10px] text-muted-foreground">${t.entry_fee} entry</p>
        )}
      </div>
    </button>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function TournamentDetail({ t, onClose }: { t: UnifiedTournament; onClose: () => void }) {
  const color = t.is_lca ? (t.club_color || LCA_GOLD) : (STATE_COLORS[t.state ?? ''] ?? '#555')
  const regOpen = t.registration_status === 'open'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 w-full rounded-t-2xl" style={{ backgroundColor: color }} />
        <div className="p-5">
          <div className="mb-2 flex items-center gap-2">
            {t.state && (
              <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: color }}>{t.state}</span>
            )}
            {t.is_lca ? (
              <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#7a5c00]">LCA Hosted</span>
            ) : (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">External</span>
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
            {(t.rating_system || t.time_control) && (
              <div className="flex items-center gap-2.5">
                <Trophy className="size-4 flex-shrink-0 text-[#c8a94a]" />
                <p className="text-foreground">{t.rating_system ?? t.time_control}</p>
              </div>
            )}
            {t.sections && t.sections.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {t.sections.map(s => {
                  const name = typeof s === 'string' ? s : s.name
                  return (
                    <span key={name} className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/8 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]">
                      {name}
                    </span>
                  )
                })}
              </div>
            )}
            {t.entry_fee != null && (
              <p className="text-sm text-muted-foreground">${t.entry_fee} entry fee</p>
            )}
            {t.contact && (
              <div className="flex items-start gap-2.5">
                <Globe className="mt-0.5 size-4 flex-shrink-0 text-[#c8a94a]" />
                <p className="break-all text-xs text-muted-foreground">{t.contact}</p>
              </div>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            {t.is_lca ? (
              <>
                {regOpen && (
                  <Button asChild size="sm" className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                    <Link to={`/tournaments/${t.id}`} onClick={onClose}>Register</Link>
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link to={`/tournaments/${t.id}`} onClick={onClose}>
                    {t.status === 'completed' ? 'View results' : 'Full details'}
                  </Link>
                </Button>
              </>
            ) : t.link ? (
              <Button asChild size="sm" className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                <a href={t.link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Register / Details
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
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
    <div className="rounded-xl border border-border bg-card">
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
  const [selected, setSelected] = useState<UnifiedTournament | null>(null)

  useEffect(() => {
    fetch('/api/clearinghouse?upcoming=true')
      .then(r => r.json())
      .then((d: { tournaments: UnifiedTournament[] }) => {
        const ts = d.tournaments ?? []
        setTournaments(ts)
        // Auto-select first LCA Louisiana tournament
        const first = ts.find(t => t.is_lca === 1 && t.state === 'LA')
        if (first) setSelected(first)
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Filtered list
  const filtered = tournaments.filter(t => {
    if (stateFilter !== 'all' && t.state !== stateFilter) return false
    if (typeFilter === 'open' && isScholastic(t.name)) return false
    if (typeFilter === 'scholastic' && !isScholastic(t.name)) return false
    if (typeFilter === 'external' && t.is_lca === 1) return false
    return true
  })

  // Banner: next upcoming LCA Louisiana tournament
  const banner = tournaments.find(t => t.is_lca === 1 && t.state === 'LA')

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'open', label: 'Open' },
    { value: 'scholastic', label: 'Scholastic' },
    { value: 'external', label: 'External only' },
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
              LCA events and regional tournaments across the Gulf South — all in one place.
            </p>

            {/* Controls row */}
            <div className="mt-4 flex items-center justify-between border-t border-white/10 py-2">
              {/* State pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {STATES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStateFilter(s.value)}
                    className={cn(
                      'flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                      stateFilter === s.value
                        ? 'bg-[#c8a94a] text-[#1a2744]'
                        : 'border border-white/20 text-white/50 hover:text-white/70',
                    )}
                  >
                    {s.label}
                    <span className="ml-1 opacity-60">
                      {s.value === 'all' ? tournaments.length : tournaments.filter(t => t.state === s.value).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Right controls */}
              <div className="flex items-center gap-2 pl-2">
                <Dropdown label="Type" value={typeFilter} options={typeOptions} onChange={setTypeFilter} dark />
                {/* View toggle */}
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

      {/* ── Content ── */}
      <div className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Loading tournaments…</p>
        ) : error ? (
          <p className="py-12 text-center text-sm text-destructive">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <p className="font-medium text-[#1a2744]">No upcoming tournaments</p>
            <p className="mt-1 text-sm text-muted-foreground">Try a different state or filter.</p>
          </div>
        ) : viewMode === 'list' ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(t => (
              <TournamentCard
                key={`${t.source}-${t.id}`}
                t={t}
                selected={selected?.id === t.id && selected?.source === t.source}
                onClick={() => setSelected(t)}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <TournamentCalendar tournaments={filtered} onSelect={setSelected} />
            <div>
              {selected ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    {selected.is_lca ? (
                      <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/15 px-1.5 py-0.5 text-[9px] font-medium text-[#7a5c00]">LCA</span>
                    ) : (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">External</span>
                    )}
                    {selected.state && (
                      <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ backgroundColor: STATE_COLORS[selected.state] ?? '#555' }}>
                        {selected.state}
                      </span>
                    )}
                  </div>
                  <h4 className="font-semibold text-[#1a2744]">{selected.name}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(selected.start_date)}
                    {selected.city ? ` · ${selected.city}` : ''}
                  </p>
                  {selected.organizer && <p className="mt-0.5 text-xs text-muted-foreground">{selected.organizer}</p>}
                  <div className="mt-3 flex gap-2">
                    {selected.is_lca ? (
                      <Button asChild size="sm" className="bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                        <Link to={`/tournaments/${selected.id}`}>
                          {selected.registration_status === 'open' ? 'Register' : 'View details'}
                        </Link>
                      </Button>
                    ) : selected.link ? (
                      <Button asChild size="sm" className="bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                        <a href={selected.link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-1.5 size-3" /> Details
                        </a>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelected(null)}>Clear</Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <p className="text-xs text-muted-foreground">Click a date with a dot to see tournaments</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail modal (list view only) */}
      {selected && viewMode === 'list' && (
        <TournamentDetail t={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}