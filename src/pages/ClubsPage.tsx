// src/pages/ClubsPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronLeft, ChevronRight, MapPin, Search, X } from 'lucide-react'

import { getClubs, type ApiClubListItem } from '@/lib/api'
import { PageHero } from '@/components/PageHero'
import { clubColorTint } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCAMap } from '@/components/maps/LCAMap'

// ── Constants ─────────────────────────────────────────────────────────────────

const LCA_GOLD = '#c8a94a'

const REGIONS = [
  'North Louisiana',
  'Central Louisiana',
  'North of Lake Pontchartrain',
  'New Orleans Metro',
  'Southwest Louisiana',
  'South Central Louisiana',
  'Bayou Region',
]

function abbreviateRegion(region: string): string {
  return region.replace(/\bLouisiana\b/, 'LA')
}

const HERO_STATS = [
  { n: '25+', l: 'clubs statewide' },
  { n: '7', l: 'regions' },
  { n: '300+', l: 'members' },
  { n: '110+', l: 'years of history' },
]

// ── Club card image area ──────────────────────────────────────────────────────

function ClubCardImage({ club }: { club: ApiClubListItem }) {
  const color = club.color || LCA_GOLD

  if (club.image_url) {
    return (
      <div className="flex h-36 w-full flex-shrink-0 items-center justify-center border-b border-border bg-white">
        <div
          className="h-full w-full bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${club.image_url})` }}
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-36 w-full flex-shrink-0 items-center justify-center border-b border-border"
      style={{ backgroundColor: clubColorTint(color, 0.1) }}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-10 opacity-30"
        fill="none"
        stroke={color}
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
      </svg>
    </div>
  )
}

// ── Club card ─────────────────────────────────────────────────────────────────

function ClubCard({ club }: { club: ApiClubListItem }) {
  const color = club.color || LCA_GOLD

  return (
    <div
      className="flex w-[174px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="h-1 w-full flex-shrink-0" style={{ backgroundColor: color }} />
      <ClubCardImage club={club} />
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="size-2 flex-shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-foreground">
            {club.name}
          </p>
        </div>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3 flex-shrink-0 text-[#c8a94a]" />
            <span className="truncate">{club.city}, LA</span>
          </p>
          {club.meeting_schedule && (
            <p className="flex items-center gap-1.5">
              <Calendar className="size-3 flex-shrink-0 text-[#c8a94a]" />
              <span className="truncate">{club.meeting_schedule}</span>
            </p>
          )}
        </div>
        <div className="mt-auto pt-3">
          <Link
            to={`/clubs/${club.id}`}
            className="block w-full rounded-md bg-[#c8a94a] py-1.5 text-center text-[11px] font-semibold text-[#1a2744] transition-colors hover:bg-[#c8a94a]/90"
          >
            Visit club
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Carousel ──────────────────────────────────────────────────────────────────

function ClubCarousel({
  clubs,
  isFiltered,
}: {
  clubs: ApiClubListItem[]
  isFiltered: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const CARD_WIDTH = 186

  function scroll(dir: 'left' | 'right') {
    if (!trackRef.current) return
    trackRef.current.scrollBy({
      left: dir === 'left' ? -CARD_WIDTH * 2 : CARD_WIDTH * 2,
      behavior: 'smooth',
    })
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">
            {isFiltered ? `${clubs.length} clubs` : `All clubs · ${clubs.length}`}
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">Sorted A–Z</p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-[#1a2744]/40 hover:text-foreground"
            aria-label="Scroll left"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-[#1a2744]/40 hover:text-foreground"
            aria-label="Scroll right"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto pb-3"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {clubs.map((club) => (
          <ClubCard key={club.id} club={club} />
        ))}
        {/* Peek spacer */}
        <div className="w-4 flex-shrink-0" />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ClubsPage() {
  usePageTitle('Clubs')
  const [allClubs, setAllClubs] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getClubs()
      .then(setAllClubs)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load clubs'))
      .finally(() => setLoading(false))
  }, [])

  const query = search.trim().toLowerCase()
  const isSearching = query.length > 0
  const isFiltered = isSearching || activeRegion !== null

  const searched = isSearching
    ? allClubs.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          (c.city ?? '').toLowerCase().includes(query),
      )
    : allClubs
  const regionScoped = activeRegion
    ? searched.filter((c) => c.region === activeRegion)
    : searched
  const displayedClubs = [...regionScoped].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        size="compact"
        title="Find your chess community"
        subtitle="Clubs across Louisiana host weekly meetings, lessons, and local tournaments."
        asideAlign="end"
        aside={
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {HERO_STATS.map((s) => (
              <div
                key={s.l}
                className="rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-center"
              >
                <div className="text-base font-semibold text-[#c8a94a]">{s.n}</div>
                <div className="mt-0.5 text-[9px] text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
        }
      />

      {/* ── Filter bar: region pills + search ── */}
      <div className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex flex-1 items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
            >
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRegion(activeRegion === r ? null : r)}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    activeRegion === r
                      ? 'border-[#1a2744] bg-[#1a2744] text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-[#c8a94a]/60 hover:text-foreground',
                  )}
                >
                  {abbreviateRegion(r)}
                </button>
              ))}
            </div>
            <div className="relative flex-shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clubs…"
                className="h-8 w-40 rounded-full border border-border bg-background pl-8 pr-7 text-xs outline-none transition-colors focus:border-[#c8a94a] sm:w-56"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Carousel ── */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading clubs…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : displayedClubs.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center">
            <p className="font-medium text-[#1a2744]">
              {isSearching ? 'No clubs match your search' : 'No clubs in this region yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSearching
                ? 'Try a different club name or city.'
                : 'Check back soon — new clubs are added regularly.'}
            </p>
          </div>
        ) : (
          <ClubCarousel clubs={displayedClubs} isFiltered={isFiltered} />
        )}
      </section>

      {/* ── Map section — follows the region filter ── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-[#1a2744]">
              Club locations
              {isFiltered && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  · {activeRegion}
                </span>
              )}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Click any marker to see club details.
            </p>
          </div>
          <LCAMap mode="all" height={480} clubs={displayedClubs} />
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-border bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Did we miss a club?
              </h2>
              <p className="mt-2 text-sm text-white/60">
                If your club isn't listed, or the information is incorrect, let us know.
                LCA also supports new club formation across the state.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-shrink-0">
              <Link
                to="/contact"
                className="rounded-lg bg-[#c8a94a] px-5 py-2.5 text-center text-sm font-semibold text-[#1a2744] transition-colors hover:bg-[#c8a94a]/90"
              >
                Contact LCA
              </Link>
              <Link
                to="/membership"
                className="rounded-lg border border-white/25 bg-transparent px-5 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Join LCA
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}