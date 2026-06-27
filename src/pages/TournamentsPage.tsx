import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronDown, MapPin, Trophy, Users, Clock, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getTournaments,
  type ApiTournamentListItem,
  type TournamentStatus,
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

type SectionTab = 'upcoming' | 'active' | 'past'
type TypeFilter = 'all' | 'open' | 'scholastic'
type TimeFilter = 'any' | 'blitz' | 'rapid' | 'classical'
type RatingFilter = 'all' | 'rated' | 'unrated'

// ── Constants ────────────────────────────────────────────────────────────────

const LCA_GOLD = '#c8a94a'
const NAVY = '#1a2744'

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: 'All types',
  open: 'Open',
  scholastic: 'Scholastic',
}

const TIME_LABELS: Record<TimeFilter, string> = {
  any: 'Any time control',
  blitz: 'Blitz',
  rapid: 'Rapid',
  classical: 'Classical',
}

const RATING_LABELS: Record<RatingFilter, string> = {
  all: 'All',
  rated: 'Rated',
  unrated: 'Unrated',
}

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

// ── Dropdown component ───────────────────────────────────────────────────────

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
                opt.value === value
                  ? 'bg-[#c8a94a]/8 font-medium text-[#1a2744]'
                  : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'size-3 flex-shrink-0 rounded-full border',
                  opt.value === value
                    ? 'border-[#c8a94a] bg-[#c8a94a]'
                    : 'border-border bg-transparent',
                )}
              />
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

// ── Club column item ─────────────────────────────────────────────────────────

interface ClubEntry {
  id: string | null
  name: string
  color: string
  count: number
}

function ClubRow({
  club,
  selected,
  onClick,
}: {
  club: ClubEntry
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
        selected && 'border-l-2 border-l-[#c8a94a] bg-[#c8a94a]/5 pl-[10px]',
      )}
    >
      <span
        className="mt-0.5 size-2 flex-shrink-0 self-start rounded-full"
        style={clubAccentStyle(club.color)}
      />
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
              <span
                key={name}
                className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/8 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]"
              >
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

      <p className="mt-2.5 text-[11px] text-muted-foreground">
        ${tournament.entry_fee} entry
      </p>

      {regOpen && (
        <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
          Registration open
        </p>
      )}

      <div className="mt-3 flex gap-2">
        {regOpen && (
          <Button
            asChild
            size="sm"
            className="h-7 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
          >
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

// ── Main page ────────────────────────────────────────────────────────────────

export function TournamentsPage() {
  usePageTitle('Tournaments')

  const [all, setAll] = useState<ExtendedTournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<SectionTab>('upcoming')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('any')
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>('all')
  const [selectedClubId, setSelectedClubId] = useState<string | null | 'lca'>('lca')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    getTournaments()
      .then((data) => {
        setAll(data as ExtendedTournament[])
        const first = (data as ExtendedTournament[]).find(
          (t) => t.status === 'upcoming' || t.status === 'active',
        )
        if (first) setSelectedId(first.id)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  // ── Derived: banner tournament ───────────────────────────────────────────
  const bannerTournament = (() => {
    const now = new Date()
    const month = now.getMonth()
    const year = now.getFullYear()

    const upcoming = all.filter((t) => t.status === 'upcoming' || t.status === 'active')

    const lcaSameMonth = upcoming.find((t) => {
      if (t.club_id !== null && t.club_id !== undefined) return false
      const d = new Date(t.date)
      return d.getMonth() === month && d.getFullYear() === year
    })
    if (lcaSameMonth) return lcaSameMonth

    const lcaNext = upcoming.find((t) => t.club_id === null || t.club_id === undefined)
    if (lcaNext) return lcaNext

    return upcoming[0] ?? null
  })()

  // ── Derived: tab-filtered list (before club/dropdown filters) ────────────
  const tabFiltered = all.filter((t) => {
    if (tab === 'upcoming') return t.status === 'upcoming'
    if (tab === 'active') return t.status === 'active'
    return t.status === 'completed'
  })

  // ── Derived: fully filtered list ─────────────────────────────────────────
  const filtered = tabFiltered.filter((t) => {
    if (typeFilter === 'scholastic' && !isScholastic(t)) return false
    if (typeFilter === 'open' && isScholastic(t)) return false
    if (timeFilter !== 'any' && classifyTimeControl(t.time_control) !== timeFilter) return false
    if (ratingFilter === 'rated' && t.is_rated !== 1) return false
    if (ratingFilter === 'unrated' && t.is_rated === 1) return false
    if (selectedClubId !== null) {
      if (selectedClubId === 'lca') {
        if (t.club_id !== null && t.club_id !== undefined) return false
      } else {
        if (t.club_id !== selectedClubId) return false
      }
    }
    return true
  })

  // ── Derived: club list for right column (from tab-filtered) ──────────────
  const clubMap = new Map<string, ClubEntry>()

  const lcaCount = tabFiltered.filter(
    (t) => t.club_id === null || t.club_id === undefined,
  ).length

  if (lcaCount > 0) {
    clubMap.set('lca', { id: null, name: 'LCA events', color: LCA_GOLD, count: lcaCount })
  }

  for (const t of tabFiltered) {
    if (!t.club_id) continue
    const key = t.club_id
    if (!clubMap.has(key)) {
      clubMap.set(key, {
        id: t.club_id,
        name: t.club_name ?? 'Unknown club',
        color: t.club_color || LCA_GOLD,
        count: 0,
      })
    }
    const entry = clubMap.get(key)!
    // count respects type/time/rating filters but not club filter
    const passesOtherFilters =
      (typeFilter === 'all' || (typeFilter === 'scholastic') === isScholastic(t)) &&
      (timeFilter === 'any' || classifyTimeControl(t.time_control) === timeFilter) &&
      (ratingFilter === 'all' ||
        (ratingFilter === 'rated' ? t.is_rated === 1 : t.is_rated !== 1))
    if (passesOtherFilters) entry.count++
  }

  // Re-compute LCA count with other filters applied
  const lcaCountFiltered = tabFiltered.filter((t) => {
    if (t.club_id !== null && t.club_id !== undefined) return false
    if (typeFilter !== 'all' && (typeFilter === 'scholastic') !== isScholastic(t)) return false
    if (timeFilter !== 'any' && classifyTimeControl(t.time_control) !== timeFilter) return false
    if (ratingFilter !== 'all' && (ratingFilter === 'rated' ? t.is_rated !== 1 : t.is_rated === 1)) return false
    return true
  }).length
  if (clubMap.has('lca')) clubMap.get('lca')!.count = lcaCountFiltered

  const clubs = Array.from(clubMap.values()).filter((c) => c.count > 0)

  // ── Derived: selected tournament for detail pane ─────────────────────────
  const selected = selectedId
    ? (filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null)
    : filtered[0] ?? null

  // Auto-select first when list changes
  useEffect(() => {
    if (filtered.length > 0 && (!selectedId || !filtered.find((t) => t.id === selectedId))) {
      setSelectedId(filtered[0].id)
    }
  }, [tab, typeFilter, timeFilter, ratingFilter, selectedClubId])

  // ── Banner override when user selects a tournament ───────────────────────
  const activeBanner = selected ?? bannerTournament

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'all', label: TYPE_LABELS.all },
    { value: 'open', label: TYPE_LABELS.open },
    { value: 'scholastic', label: TYPE_LABELS.scholastic },
  ]
  const timeOptions: { value: TimeFilter; label: string }[] = [
    { value: 'any', label: TIME_LABELS.any },
    { value: 'blitz', label: 'Blitz · G/5–G/15' },
    { value: 'rapid', label: 'Rapid · G/25–G/60' },
    { value: 'classical', label: 'Classical · G/60+' },
  ]
  const ratingOptions: { value: RatingFilter; label: string }[] = [
    { value: 'all', label: RATING_LABELS.all },
    { value: 'rated', label: RATING_LABELS.rated },
    { value: 'unrated', label: RATING_LABELS.unrated },
  ]

  const TAB_LABELS: Record<SectionTab, string> = {
    upcoming: 'Upcoming',
    active: 'Active',
    past: 'Past',
  }

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="px-6 pb-0 pt-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-1 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">
              Louisiana Chess Association
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tournaments
            </h1>
            <p className="mt-1.5 text-sm text-white/60">
              Browse and register for LCA events across Louisiana.
            </p>

            {/* ── Tab + filter row ── */}
            <div className="mt-4 flex items-center justify-between border-t border-white/10">
              <div className="flex">
                {(['upcoming', 'active', 'past'] as SectionTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTab(t)
                      setSelectedClubId(null)
                      setSelectedId(null)
                    }}
                    className={cn(
                      'border-b-2 px-4 py-2.5 text-[11px] font-medium transition-colors',
                      tab === t
                        ? 'border-[#c8a94a] text-[#c8a94a]'
                        : 'border-transparent text-white/40 hover:text-white/65',
                    )}
                  >
                    {TAB_LABELS[t]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 pb-1 pr-1">
                <Dropdown
                  label="Type"
                  value={typeFilter}
                  options={typeOptions}
                  onChange={setTypeFilter}
                />
                <Dropdown
                  label="Time control"
                  value={timeFilter}
                  options={timeOptions}
                  onChange={setTimeFilter}
                />
                <Dropdown
                  label="Rating"
                  value={ratingFilter}
                  options={ratingOptions}
                  onChange={setRatingFilter}
                />
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
              <span className="rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/18 px-1.5 py-px text-[10px] font-medium text-[#7a5c00]">
                LCA
              </span>
            )}
            <span className="truncate text-muted-foreground">
              <span className="font-medium text-foreground">{activeBanner.name}</span>
              {' · '}{activeBanner.date}
              {' · '}{activeBanner.location}
            </span>
          </div>
          <Button
            asChild
            size="sm"
            className="ml-3 h-7 flex-shrink-0 bg-[#c8a94a] text-xs font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
          >
            <Link to={`/tournaments/${activeBanner.id}`}>
              {(activeBanner as ExtendedTournament).registration_status === 'open'
                ? 'Register now'
                : 'View details'}
            </Link>
          </Button>
        </div>
      )}

      {/* ── Three-column body ── */}
      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          Loading tournaments…
        </div>
      ) : error ? (
        <div className="px-6 py-12 text-center text-sm text-destructive">{error}</div>
      ) : (
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 border-b border-border sm:grid-cols-[1fr_1.55fr_1fr]">

            {/* ── Left: tournament list ── */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Trophy className="size-3 text-[#c8a94a]" />
                  <span className="text-[10px] font-semibold text-foreground capitalize">
                    {TAB_LABELS[tab]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">· {filtered.length}</span>
                </div>
                {selectedClubId && (
                  <span className="text-[10px] text-muted-foreground">
                    {clubs.find((c) =>
                      selectedClubId === 'lca' ? c.id === null : c.id === selectedClubId,
                    )?.name ?? ''}
                  </span>
                )}
              </div>

              <div className="max-h-[300px] overflow-y-auto sm:max-h-[360px]">
                {filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No tournaments match the current filters.
                  </p>
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
                        style={{
                          backgroundColor: isSel
                            ? clubColorTint(color, 0.05)
                            : undefined,
                        }}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-foreground">
                            {t.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {t.date}
                            {t.time_control ? ` · ${t.time_control}` : ''}
                          </p>
                        </div>
                        {t.status === 'upcoming' && (
                          <StatusDot regStatus={t.registration_status} />
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── Middle: detail pane ── */}
            <div className="border-b border-border sm:border-b-0 sm:border-r">
              <div className="flex items-center border-b border-border bg-muted/20 px-3 py-1.5">
                <span className="text-[10px] font-semibold text-foreground">
                  Selected tournament
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto sm:max-h-[360px]">
                {selected ? (
                  <DetailPane tournament={selected} />
                ) : (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    Select a tournament from the list.
                  </p>
                )}
              </div>
            </div>

            {/* ── Right: by club ── */}
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
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No clubs for this selection.
                  </p>
                ) : (
                  clubs.map((club) => {
                    const key = club.id ?? 'lca'
                    const isSel = selectedClubId === key
                    return (
                      <ClubRow
                        key={key}
                        club={club}
                        selected={isSel}
                        onClick={() => setSelectedClubId(isSel ? null : key)}
                      />
                    )
                  })
                )}
              </div>

              <div className="border-t border-border px-3 py-1.5">
                <p className="text-[10px] italic text-muted-foreground">
                  Number of tournaments in selection
                </p>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}