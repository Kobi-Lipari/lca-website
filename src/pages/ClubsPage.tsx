// src/pages/ClubsPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'

import { getClubs, type ApiClubListItem } from '@/lib/api'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Club card image area ──────────────────────────────────────────────────────

function ClubCardImage({ club }: { club: ApiClubListItem }) {
  const color = club.color || LCA_GOLD

  if (club.image_url) {
    return (
      <div
        className="h-28 w-full flex-shrink-0 border-b border-border bg-cover bg-center"
        style={{ backgroundImage: `url(${club.image_url})` }}
      />
    )
  }

  return (
    <div
      className="flex h-28 w-full flex-shrink-0 items-center justify-center border-b border-border"
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
      className="flex w-[210px] flex-shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
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
  const CARD_WIDTH = 222 // 210px card + 12px gap

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
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {isFiltered ? 'Sorted A–Z' : 'Shuffled — refresh for a new order'}
          </p>
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
  const [shuffled, setShuffled] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)

  useEffect(() => {
    getClubs()
      .then((clubs) => {
        setAllClubs(clubs)
        setShuffled(shuffleArray(clubs))
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load clubs'))
      .finally(() => setLoading(false))
  }, [])

  const isFiltered = activeRegion !== null

  const displayedClubs = isFiltered
    ? allClubs
        .filter((c) => c.region === activeRegion)
        .sort((a, b) => a.name.localeCompare(b.name))
    : shuffled

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div
            className="mb-1 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]"
          >
            Louisiana Chess Association
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Find your chess community
              </h1>
              <p className="mt-2 max-w-md text-sm text-white/60">
                Clubs across Louisiana host weekly meetings, lessons, and local tournaments.
                New players always welcome — no experience required.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {[
                { n: '25+', l: 'clubs statewide' },
                { n: '7', l: 'regions' },
                { n: '300+', l: 'members' },
                { n: '110+', l: 'years of history' },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-center"
                >
                  <div className="text-base font-semibold text-[#c8a94a]">{s.n}</div>
                  <div className="mt-0.5 text-[9px] text-white/45">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Region filter bar ── */}
      <div className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-2 overflow-x-auto py-2.5" style={{ scrollbarWidth: 'none' }}>
            <span className="flex-shrink-0 text-[10px] font-medium text-muted-foreground">
              Region
            </span>
            <button
              type="button"
              onClick={() => setActiveRegion(null)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                !activeRegion
                  ? 'bg-[#1a2744] text-white'
                  : 'border border-border text-muted-foreground hover:border-[#1a2744]/40',
              )}
            >
              All regions
            </button>
            {REGIONS.map((region) => (
              <button
                key={region}
                type="button"
                onClick={() => setActiveRegion(region)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-medium transition-colors',
                  activeRegion === region
                    ? 'bg-[#1a2744] text-white'
                    : 'border border-border text-muted-foreground hover:border-[#1a2744]/40',
                )}
              >
                {region}
              </button>
            ))}
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
            <p className="font-medium text-[#1a2744]">No clubs in this region yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon — new clubs are added regularly.
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
