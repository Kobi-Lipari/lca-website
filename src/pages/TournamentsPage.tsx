// src/pages/TournamentsPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  MapPin, Trophy, Clock, Building2, ExternalLink, Globe, Search, Users, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/PageHero'
import { StatusDot } from '@/components/StatusBadge'
import { FilterDropdown } from '@/components/FilterDropdown'
import { RegistrationReminderButton } from '@/components/RegistrationReminderButton'
import { MiniCalendar } from '@/components/tournaments/MiniCalendar'
import { AgendaList } from '@/components/tournaments/AgendaList'
import { formatDate, isPastTournament, type UnifiedTournament } from '@/lib/clearinghouse'
import { isScholasticTournament } from '@/lib/scholastic'
import { clubColorTint } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCA } from '@/lib/brand'

// ── Types ─────────────────────────────────────────────────────────────────────

type StateFilter = 'LA' | 'MS' | 'AL' | 'TX' | 'FL' | 'out-of-state' | 'all'
type ViewMode = 'list' | 'calendar'
type TypeFilter = 'all' | 'open' | 'scholastic'
type TimeTab = 'upcoming' | 'past'

type RightSelection =
  | { kind: 'lca' }
  | { kind: 'club'; clubId: string }
  | { kind: 'other-la' }
  | { kind: 'out-of-state' }
  | null

// ── Constants ─────────────────────────────────────────────────────────────────

const LCA_GOLD = LCA.gold

const STATE_PILLS: { value: StateFilter; label: string }[] = [
  { value: 'LA', label: 'Louisiana' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'AL', label: 'Alabama' },
  { value: 'TX', label: 'Texas' },
  { value: 'FL', label: 'Florida' },
  { value: 'out-of-state', label: 'Out of State' },
  { value: 'all', label: 'All' },
]


// ── Helpers ───────────────────────────────────────────────────────────────────

function stateMatchesPill(state: string | null, pill: StateFilter): boolean {
  if (pill === 'all') return true
  if (pill === 'out-of-state') return state !== 'LA'
  return state === pill
}

// ── LCA Detail pane ───────────────────────────────────────────────────────────

function LCADetailPane({ t }: { t: UnifiedTournament }) {
  const color = t.club_color || LCA_GOLD
  const regOpen = t.registration_status === 'open'
  const isPast = t.status === 'completed'
  const sections = (t.sections ?? []) as Array<string | { name: string }>

  return (
    <div className="p-4">
      <h3 className="mb-3 text-[15px] font-semibold leading-snug">
        <Link to={`/tournaments/${t.id}`} className="text-lca-navy hover:underline transition-colors">
          {t.name}
        </Link>
      </h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-3.5 flex-shrink-0 text-lca-gold" />
          {formatDate(t.start_date)}
        </div>
        {t.city && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5 flex-shrink-0 text-lca-gold" />
            {t.city}
          </div>
        )}
        {t.time_control && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-3.5 flex-shrink-0 text-lca-gold" />
            {t.time_control}
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="size-3.5 flex-shrink-0 text-lca-gold" />
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
              <span key={name} className="rounded-full border border-lca-navy/20 bg-lca-navy/8 px-2 py-0.5 text-[11px] font-medium text-lca-navy">
                {name}
              </span>
            )
          })}
          {t.is_rated === 1 && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              USCF Rated
            </span>
          )}
        </div>
      )}
      {t.entry_fee != null && (
        <p className="mt-3 text-xs text-muted-foreground">${t.entry_fee} entry</p>
      )}
      {regOpen && !isPast && <p className="mt-0.5 text-xs font-medium text-emerald-600">Registration open</p>}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {regOpen && !isPast && (
          <Button asChild size="sm" className="h-7 bg-lca-gold text-xs font-semibold text-lca-navy hover:bg-lca-gold/90">
            <Link to={`/tournaments/${t.id}`}>Register</Link>
          </Button>
        )}
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <Link to={`/tournaments/${t.id}`}>
            {isPast ? 'View results' : 'Full details'}
          </Link>
        </Button>
        {!regOpen && !isPast && <RegistrationReminderButton tournamentId={t.id} />}
      </div>
    </div>
  )
}

// ── External detail pane ──────────────────────────────────────────────────────

function ExternalDetailPane({ t }: { t: UnifiedTournament }) {
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">External</span>
        {t.state && t.state !== 'LA' && (
          <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{t.state}</span>
        )}
      </div>
      <h3 className="mb-3 text-[15px] font-semibold leading-snug text-lca-navy">{t.name}</h3>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-3.5 flex-shrink-0 text-lca-gold" />
          {formatDate(t.start_date)}
          {t.end_date && t.end_date !== t.start_date ? ` – ${formatDate(t.end_date)}` : ''}
        </div>
        {(t.venue || t.city) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="size-3.5 flex-shrink-0 text-lca-gold" />
            {t.venue ?? t.city}{t.state ? `, ${t.state}` : ''}
          </div>
        )}
        {t.organizer && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="size-3.5 flex-shrink-0 text-lca-gold" />
            {t.organizer}
          </div>
        )}
        {t.rating_system && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Trophy className="size-3.5 flex-shrink-0 text-lca-gold" />
            {t.rating_system}
            {t.eligibility && t.eligibility !== 'All ages' ? ` · ${t.eligibility}` : ''}
          </div>
        )}
        {t.contact && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Globe className="mt-0.5 size-3.5 flex-shrink-0 text-lca-gold" />
            <span className="break-all">{t.contact}</span>
          </div>
        )}
      </div>
      {t.link && (
        <div className="mt-3.5">
          <Button asChild size="sm" className="h-7 bg-lca-gold text-xs font-semibold text-lca-navy hover:bg-lca-gold/90">
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
  lcaClubs: Map<string, { name: string; color: string; count: number }>
  lcaDirectCount: number
  selection: RightSelection
  onSelect: (s: RightSelection) => void
  otherLaCount: number
  outOfStateCount: number
}

function RightColumn({ lcaClubs, lcaDirectCount, selection, onSelect, otherLaCount, outOfStateCount }: RightColumnProps) {
  function isSelected(s: RightSelection): boolean {
    if (!selection || !s) return false
    if (selection.kind !== s.kind) return false
    if (selection.kind === 'club' && s.kind === 'club') return selection.clubId === s.clubId
    return true
  }

  function toggle(s: RightSelection) {
    onSelect(isSelected(s) ? null : s)
  }

  const rowClass = (s: RightSelection) => cn(
    'flex w-full items-center gap-2.5 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30',
    isSelected(s) && 'border-l-2 border-l-lca-gold bg-lca-gold/5 pl-[10px]',
  )

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Building2 className="size-3.5 text-lca-gold" />
          <span className="text-xs font-semibold text-foreground">By organizer</span>
        </div>
        <span className="text-[11px] text-muted-foreground">click to filter</span>
      </div>

      <div className="max-h-[320px] flex-1 overflow-y-auto sm:max-h-none">
        {(lcaClubs.size > 0 || lcaDirectCount > 0) && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              LCA Clubs
            </div>
            {lcaDirectCount > 0 && (
              <button type="button" onClick={() => toggle({ kind: 'lca' })} className={rowClass({ kind: 'lca' })}>
                <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full" style={{ backgroundColor: LCA_GOLD }} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">LCA direct events</p>
                  <p className="text-[11px] text-muted-foreground">{lcaDirectCount} {lcaDirectCount === 1 ? 'tournament' : 'tournaments'}</p>
                </div>
              </button>
            )}
            {[...lcaClubs.entries()].map(([clubId, club]) => (
              <button key={clubId} type="button" onClick={() => toggle({ kind: 'club', clubId })} className={rowClass({ kind: 'club', clubId })}>
                <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full" style={{ backgroundColor: club.color }} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{club.name}</p>
                  <p className="text-[11px] text-muted-foreground">{club.count} {club.count === 1 ? 'tournament' : 'tournaments'}</p>
                </div>
              </button>
            ))}
          </>
        )}

        {otherLaCount > 0 && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Louisiana (External)
            </div>
            <button type="button" onClick={() => toggle({ kind: 'other-la' })} className={rowClass({ kind: 'other-la' })}>
              <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full bg-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">Other (Louisiana)</p>
                <p className="text-[11px] text-muted-foreground">{otherLaCount} tournaments</p>
              </div>
            </button>
          </>
        )}

        {outOfStateCount > 0 && (
          <>
            <div className="bg-muted/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Regional
            </div>
            <button type="button" onClick={() => toggle({ kind: 'out-of-state' })} className={rowClass({ kind: 'out-of-state' })}>
              <span className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full bg-slate-500" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-foreground">Out of State</p>
                <p className="text-[11px] text-muted-foreground">{outOfStateCount} tournaments</p>
              </div>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
// ── Main page ─────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  usePageTitle('Tournaments')

  const [tournaments, setTournaments] = useState<UnifiedTournament[]>([])
  const [pastTournaments, setPastTournaments] = useState<UnifiedTournament[]>([])
  const [pastLoaded, setPastLoaded] = useState(false)
  const [pastLoading, setPastLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [timeTab, setTimeTab] = useState<TimeTab>('upcoming')
  const [stateFilter, setStateFilter] = useState<StateFilter>('LA')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [rightSelection, setRightSelection] = useState<RightSelection>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Whether anything is narrowing the list right now. stateFilter counts:
  // 'LA' is its default, but a visitor can pill their way to a state with
  // nothing in it and needs the same way back.
  const hasActiveFilters =
    search.trim() !== '' || typeFilter !== 'all' || rightSelection !== null || stateFilter !== 'LA'

  function clearFilters() {
    setSearch('')
    setTypeFilter('all')
    setRightSelection(null)
    setStateFilter('LA')
    setSelectedId(null)
  }
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calSelectedDay, setCalSelectedDay] = useState<number | null>(null)

  const detailRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/clearinghouse?upcoming=true')
      .then(r => r.json())
      .then((d: { tournaments: UnifiedTournament[] }) => setTournaments(d.tournaments ?? []))
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // Lazy-load past tournaments the first time the Past tab is opened
  useEffect(() => {
    if (timeTab !== 'past' || pastLoaded || pastLoading) return
    setPastLoading(true)
    fetch('/api/clearinghouse?upcoming=false')
      .then(r => r.json())
      .then((d: { tournaments: UnifiedTournament[] }) => {
        const past = (d.tournaments ?? [])
          .filter(isPastTournament)
          .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
        setPastTournaments(past)
        setPastLoaded(true)
      })
      .catch(() => setPastTournaments([]))
      .finally(() => setPastLoading(false))
  }, [timeTab, pastLoaded, pastLoading])

  // ── Sync state pill ↔ right column ────────────────────────────────────────

  function handleStatePill(pill: StateFilter) {
    setStateFilter(pill)
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
      setStateFilter('LA')
    }
  }

  function handleRowClick(key: string) {
    setSelectedId(key)
    // On mobile, the detail pane stacks below the fold — bring it into view
    if (window.innerWidth < 640) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeSet = timeTab === 'past' ? pastTournaments : tournaments
  const activeLoading = timeTab === 'past' ? pastLoading : loading

  const stateFiltered = activeSet.filter(t => stateMatchesPill(t.state, stateFilter))

  const lcaClubs = new Map<string, { name: string; color: string; count: number }>()
  let lcaDirectCount = 0
  for (const t of stateFiltered) {
    if (t.is_lca !== 1) continue
    if (!t.club_id) { lcaDirectCount++; continue }
    if (!lcaClubs.has(t.club_id)) {
      lcaClubs.set(t.club_id, { name: t.club_name ?? 'Unknown club', color: t.club_color || LCA_GOLD, count: 0 })
    }
    lcaClubs.get(t.club_id)!.count++
  }

  const otherLaCount = stateFiltered.filter(t => t.is_lca === 0 && t.state === 'LA').length
  const outOfStateCount = stateFiltered.filter(t => t.state !== 'LA').length

  const query = search.trim().toLowerCase()
  const filtered = stateFiltered.filter(t => {
    if (query && !(
      t.name.toLowerCase().includes(query) ||
      (t.city ?? '').toLowerCase().includes(query)
    )) return false
    if (typeFilter === 'open' && isScholasticTournament(t.name, t.sections)) return false
    if (typeFilter === 'scholastic' && !isScholasticTournament(t.name, t.sections)) return false
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

  const selected = selectedId
    ? filtered.find(t => `${t.source}-${t.id}` === selectedId) ?? filtered[0] ?? null
    : filtered[0] ?? null

  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find(t => `${t.source}-${t.id}` === selectedId))) {
      setSelectedId(`${filtered[0].source}-${filtered[0].id}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateFilter, typeFilter, rightSelection, timeTab, search])

  const banner = tournaments.find(t => t.is_lca === 1 && t.state === 'LA')

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'open', label: 'Open' },
    { value: 'scholastic', label: 'Scholastic' },
  ]

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        size="compact"
        title="Tournaments"
        subtitle="LCA events and Gulf South regional tournaments — all in one place."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tournaments…"
                className="h-8 w-44 rounded-full border border-white/20 bg-white/10 pl-8 pr-7 text-xs text-white placeholder:text-white/40 outline-none transition-colors focus:border-lca-gold/70 sm:w-60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/80"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <FilterDropdown
              on="navy"
              value={stateFilter}
              onChange={handleStatePill}
              options={STATE_PILLS.map(s => ({
                value: s.value,
                label: `${s.label} (${
                  s.value === 'all'
                    ? activeSet.length
                    : s.value === 'out-of-state'
                      ? activeSet.filter(t => t.state !== 'LA').length
                      : activeSet.filter(t => t.state === s.value).length
                })`,
              }))}
            />
            <FilterDropdown
              on="navy"
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
            />
          </div>

          {/* View switcher — kept as one bold, full-word control rather than
              an icon-only pill, so it reads as "how you're viewing this"
              rather than blending in as a third filter dropdown. */}
          <div className="flex h-9 rounded-lg border border-lca-gold/70 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors',
                viewMode === 'list' ? 'bg-lca-gold text-lca-navy' : 'text-white/70 hover:text-white',
              )}
            >
              <Trophy className="size-3.5" /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors',
                viewMode === 'calendar' ? 'bg-lca-gold text-lca-navy' : 'text-white/70 hover:text-white',
              )}
            >
              <Calendar className="size-3.5" /> Calendar
            </button>
          </div>
        </div>
      </PageHero>

      {/* ── Banner ── */}
      {banner && timeTab === 'upcoming' && (
        <div className="flex items-center justify-between border-b border-lca-gold/30 bg-lca-gold/10 px-4 py-2 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <Calendar className="size-3.5 flex-shrink-0 text-lca-gold" />
            <span className="rounded-full border border-lca-gold/40 bg-lca-gold/18 px-1.5 py-px text-[10px] font-medium text-[#7a5c00]">LCA</span>
            <span className="truncate text-muted-foreground">
              <span className="font-medium text-foreground">{banner.name}</span>
              {' · '}{formatDate(banner.start_date)}
              {banner.city ? ` · ${banner.city}` : ''}
            </span>
          </div>
          <Button asChild size="sm" className="ml-3 h-7 flex-shrink-0 bg-lca-gold text-xs font-semibold text-lca-navy hover:bg-lca-gold/90">
            <Link to={`/tournaments/${banner.id}`}>
              {banner.registration_status === 'open' ? 'Register now' : 'View details'}
            </Link>
          </Button>
        </div>
      )}

      {/* ── Body ── */}
      {activeLoading ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading tournaments…</div>
      ) : error ? (
        <div className="px-6 py-12 text-center text-sm text-destructive">{error}</div>
      ) : viewMode === 'calendar' ? (
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[260px_1fr_300px]">
            <div className="space-y-4">
              <MiniCalendar
                year={calYear}
                month={calMonth}
                eventDays={new Set(
                  filtered
                    .filter(t => {
                      const d = new Date(t.start_date + 'T00:00:00')
                      return !isNaN(d.getTime()) && d.getFullYear() === calYear && d.getMonth() === calMonth
                    })
                    .map(t => new Date(t.start_date + 'T00:00:00').getDate()),
                )}
                selectedDay={calSelectedDay}
                onPrev={() => {
                  setCalSelectedDay(null)
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1)
                }}
                onNext={() => {
                  setCalSelectedDay(null)
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1)
                }}
                onSelectDay={(day) => setCalSelectedDay(prev => (prev === day ? null : day))}
              />
              <div className="flex items-center gap-3 px-1">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full bg-lca-gold" /> LCA hosted
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-2 rounded-full bg-slate-400" /> External
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card">
              <AgendaList
                tournaments={
                  calSelectedDay
                    ? filtered.filter(t => {
                        const d = new Date(t.start_date + 'T00:00:00')
                        return (
                          !isNaN(d.getTime()) &&
                          d.getFullYear() === calYear &&
                          d.getMonth() === calMonth &&
                          d.getDate() === calSelectedDay
                        )
                      })
                    : filtered
                }
                selectedKey={selectedId}
                onSelect={t => setSelectedId(`${t.source}-${t.id}`)}
              />
            </div>
            <div className="rounded-xl border border-border bg-card">
              {selected ? (
                selected.is_lca === 1
                  ? <LCADetailPane t={selected} />
                  : <ExternalDetailPane t={selected} />
              ) : (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">Select a tournament to see details.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="grid min-h-[420px] grid-cols-1 border-b border-border sm:grid-cols-[1fr_1.55fr_1fr]">

            {/* ── Left: list ── */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-1">
                  {(['upcoming', 'past'] as TimeTab[]).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => { setTimeTab(tab); setSelectedId(null) }}
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-semibold capitalize transition-colors',
                        timeTab === tab
                          ? 'bg-lca-navy text-white'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                  <span className="ml-1 text-xs text-muted-foreground">· {filtered.length}</span>
                </div>
                {rightSelection && (
                  <button
                    type="button"
                    onClick={() => handleRightSelection(null)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Clear filter ×
                  </button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[420px]">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                    <Search className="size-5 text-muted-foreground/40" aria-hidden="true" />
                    <p className="text-xs text-muted-foreground">
                      {timeTab === 'past' ? 'No past tournaments yet.' : 'No tournaments match the current filters.'}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 h-7 text-xs"
                        onClick={clearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                ) : (
                  filtered.map(t => {
                    const key = `${t.source}-${t.id}`
                    const isSel = key === selectedId || (!selectedId && t === filtered[0])
                    const color = t.is_lca === 1 ? (t.club_color || LCA_GOLD) : '#94a3b8'
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleRowClick(key)}
                        className={cn(
                          'flex w-full items-center justify-between border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30',
                          isSel && 'border-l-2 border-l-lca-gold pl-[10px]',
                        )}
                        style={{ backgroundColor: isSel ? clubColorTint(color, 0.05) : undefined }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[13px] font-medium text-foreground">{t.name}</p>
                            {t.is_lca === 0 && (
                              <span className="flex-shrink-0 rounded border border-border px-1 py-px text-[10px] text-muted-foreground">Ext</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
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
            <div ref={detailRef} className="scroll-mt-16 border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center border-b border-border bg-muted/20 px-3 py-2">
                <span className="text-xs font-semibold text-foreground">Selected tournament</span>
              </div>
              <div className="max-h-[340px] overflow-y-auto sm:max-h-[420px]">
                {selected ? (
                  selected.is_lca === 1
                    ? <LCADetailPane t={selected} />
                    : <ExternalDetailPane t={selected} />
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {filtered.length === 0
                      ? 'Nothing to show yet.'
                      : 'Select a tournament from the list.'}
                  </p>
                )}
              </div>
            </div>

            {/* ── Right: organizer ── */}
            <RightColumn
              lcaClubs={lcaClubs}
              lcaDirectCount={lcaDirectCount}
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