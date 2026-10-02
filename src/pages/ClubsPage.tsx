// src/pages/ClubsPage.tsx
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, LocateFixed, MapPin, Search, X } from 'lucide-react'

import { getClubs, type ApiClubListItem } from '@/lib/api'
import { PageHero } from '@/components/PageHero'
import { clubColorTint } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCAMap, directionsUrl, findPinByName } from '@/components/maps/LCAMap'
import { LCA } from '@/lib/brand'
import { REGIONS } from '@/lib/regions'

// ── Constants ─────────────────────────────────────────────────────────────────

const LCA_GOLD = LCA.gold


function abbreviateRegion(region: string): string {
  return region.replace(/\bLouisiana\b/, 'LA')
}

const HERO_STATS = [
  { n: '25+', l: 'clubs statewide' },
  { n: '7', l: 'regions' },
  { n: '300+', l: 'members' },
  { n: '110+', l: 'years of history' },
]

// ── Club logo / initials tile ─────────────────────────────────────────────────

/**
 * Initials for a club with no image. "Chess", "Club" and friends are in
 * almost every name, so including them would make most cards read "CC" —
 * dropping them leaves the part that actually identifies the club: Baton
 * Rouge Chess Club becomes BR, Strategic Thoughts NOLA becomes ST.
 */
const FILLER = /^(chess|club|the|of|a|and|association|academy|society|center|centre)$/i

function clubInitials(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((w) => w && !FILLER.test(w))
  const source = words.length ? words : name.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (!source.length) return '?'
  // One significant word takes two letters of itself rather than one, so
  // Bluebonnet and Bunkie do not both come out as "B".
  const letters = source.length === 1 ? source[0].slice(0, 2) : source.slice(0, 2).map((w) => w[0]).join('')
  return letters.toUpperCase()
}

function ClubLogo({ club }: { club: ApiClubListItem }) {
  const color = club.color || LCA_GOLD
  if (club.image_url) {
    return (
      <div className="flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
        <img src={club.image_url} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
      </div>
    )
  }
  return (
    <div
      className="flex size-16 flex-shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: clubColorTint(color, 0.14) }}
    >
      <span aria-hidden="true" className="select-none text-lg font-bold tracking-tight" style={{ color }}>
        {clubInitials(club.name)}
      </span>
    </div>
  )
}

// ── Distance ──────────────────────────────────────────────────────────────────

type LatLng = { lat: number; lng: number }

/** Straight-line miles between two points. Good enough for "which is closer". */
function milesBetween(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(h))
}

// ── Club card (list beside the map) ───────────────────────────────────────────

function ClubCard({
  club, selected, onSelect, onHover, distance, cardRef,
}: {
  club: ApiClubListItem
  selected: boolean
  onSelect: () => void
  onHover: (on: boolean) => void
  distance: number | null
  cardRef: (el: HTMLDivElement | null) => void
}) {
  const color = club.color || LCA_GOLD
  const pin = findPinByName(club.name)

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Show ${club.name} on the map`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect() }
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        'group relative flex cursor-pointer gap-3.5 rounded-xl border bg-card p-3.5 text-left shadow-sm outline-none transition-all',
        'hover:border-lca-navy/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-lca-gold',
        selected && 'shadow-md ring-2',
      )}
      style={selected ? ({ borderColor: color, backgroundColor: clubColorTint(color, 0.06), '--tw-ring-color': clubColorTint(color, 0.45) } as CSSProperties) : undefined}
    >
      <span className="absolute inset-y-3 left-0 w-1 rounded-r-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <ClubLogo club={club} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-lca-navy">{club.name}</p>
          {distance != null && (
            <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {distance < 10 ? distance.toFixed(1) : Math.round(distance)} mi
            </span>
          )}
        </div>
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3 flex-shrink-0 text-lca-gold" />
            <span className="truncate">
              {club.city}, LA{club.region ? ` · ${club.region}` : ''}
            </span>
          </p>
          {club.meeting_schedule && (
            <p className="flex items-center gap-1.5">
              <Calendar className="size-3 flex-shrink-0 text-lca-gold" />
              <span className="truncate">{club.meeting_schedule}</span>
            </p>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Link
            to={`/clubs/${club.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-md bg-lca-gold px-3 py-1.5 text-xs font-semibold text-lca-navy transition-colors hover:bg-lca-gold/90"
          >
            Visit club
          </Link>
          {pin ? (
            <a
              href={directionsUrl(pin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-lca-navy transition-colors hover:border-lca-navy/40"
            >
              Directions ↗
            </a>
          ) : (
            <span className="text-[11px] italic text-muted-foreground">Not on the map yet</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const isWide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

export function ClubsPage() {
  usePageTitle('Clubs')
  const [allClubs, setAllClubs] = useState<ApiClubListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRegion, setActiveRegion] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [params, setParams] = useSearchParams()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<LatLng | null>(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const mapWrapRef = useRef<HTMLDivElement>(null)

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

  // Miles from the visitor, once they've shared where they are.
  const distances = new Map<string, number>()
  if (userLocation) {
    for (const c of regionScoped) {
      const pin = findPinByName(c.name)
      if (pin) distances.set(c.id, milesBetween(userLocation, pin))
    }
  }
  const displayedClubs = [...regionScoped].sort((a, b) => {
    if (userLocation) {
      const da = distances.get(a.id) ?? Infinity
      const db = distances.get(b.id) ?? Infinity
      if (da !== db) return da - db
    }
    return a.name.localeCompare(b.name)
  })

  // The selected club lives in the URL (?club=id), so a link can open the
  // page with a club already picked out.
  const requested = params.get('club')
  const selectedId = requested && displayedClubs.some((c) => c.id === requested) ? requested : null

  function select(id: string | null, from: 'list' | 'map') {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (id) next.set('club', id)
      else next.delete('club')
      return next
    }, { replace: true })
    if (!id) return
    if (from === 'list' && !isWide()) {
      // Phones: the map sits above the list, so bring it into view.
      mapWrapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    if (from === 'map' && isWide()) {
      cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  function findNearMe() {
    if (userLocation) { setUserLocation(null); return }
    if (!('geolocation' in navigator)) {
      setLocateError('Your browser can’t share its location.')
      return
    }
    setLocating(true)
    setLocateError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setLocateError('Couldn’t get your location. Check your browser’s location permission.')
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  const mappedCount = displayedClubs.filter((c) => findPinByName(c.name)).length

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
                <div className="text-base font-semibold text-lca-gold">{s.n}</div>
                <div className="mt-0.5 text-[9px] text-white/60">{s.l}</div>
              </div>
            ))}
          </div>
        }
      />

      {/* ── Filter bar: region pills + search ── */}
      <div className="border-b border-border bg-muted/20">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <div
              className="flex flex-1 items-center gap-1.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none' }}
              role="group"
              aria-label="Region"
            >
              <button
                type="button"
                onClick={() => setActiveRegion(null)}
                aria-pressed={activeRegion === null}
                className={cn(
                  'flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activeRegion === null
                    ? 'border-lca-navy bg-lca-navy text-white'
                    : 'border-border bg-card text-muted-foreground hover:border-lca-gold/60 hover:text-foreground',
                )}
              >
                All regions
              </button>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={activeRegion === r}
                  onClick={() => setActiveRegion(activeRegion === r ? null : r)}
                  className={cn(
                    'flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    activeRegion === r
                      ? 'border-lca-navy bg-lca-navy text-white'
                      : 'border-border bg-card text-muted-foreground hover:border-lca-gold/60 hover:text-foreground',
                  )}
                >
                  {abbreviateRegion(r)}
                </button>
              ))}
            </div>
            <div className="relative flex-shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by club or city…"
                aria-label="Search clubs"
                className="h-9 w-full rounded-full border border-border bg-background pl-8 pr-7 text-sm outline-none transition-colors focus:border-lca-gold sm:h-8 sm:w-56 sm:text-xs"
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

      {/* ── Clubs beside the map ── */}
      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading clubs…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-6">
            {/* Map: on top for phones, on the right and pinned in place on desktop. */}
            <div ref={mapWrapRef} className="scroll-mt-20 lg:order-2">
              <div className="lg:sticky lg:top-20">
                <div className="h-[320px] sm:h-[400px] lg:h-[calc(100vh-7rem)] lg:max-h-[720px] lg:min-h-[480px]">
                  <LCAMap
                    mode="all"
                    height="100%"
                    clubs={displayedClubs}
                    selectedId={selectedId}
                    hoveredId={hoveredId}
                    onSelect={(id) => select(id, 'map')}
                    userLocation={userLocation}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {mappedCount === displayedClubs.length
                    ? 'Pick a club in the list or a pin on the map.'
                    : `${mappedCount} of ${displayedClubs.length} clubs are on the map so far. Pick one to see it.`}
                </p>
              </div>
            </div>

            {/* List */}
            <div className="lg:order-1">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-lca-navy">
                    {displayedClubs.length} {displayedClubs.length === 1 ? 'club' : 'clubs'}
                    {activeRegion && <span className="font-normal text-muted-foreground"> in {activeRegion}</span>}
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    {userLocation ? 'Closest first' : 'Sorted A–Z'}
                    {isFiltered && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          className="underline underline-offset-2 hover:text-foreground"
                          onClick={() => { setSearch(''); setActiveRegion(null) }}
                        >
                          show all
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={findNearMe}
                  disabled={locating}
                  aria-pressed={!!userLocation}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                    userLocation
                      ? 'border-lca-navy bg-lca-navy text-white'
                      : 'border-border bg-card text-lca-navy hover:border-lca-navy/40',
                  )}
                >
                  <LocateFixed className="size-3.5" />
                  {locating ? 'Finding you…' : userLocation ? 'Near me ✓' : 'Clubs near me'}
                </button>
              </div>
              {locateError && <p className="mb-3 text-xs text-destructive">{locateError}</p>}

              {displayedClubs.length === 0 ? (
                <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                  <p className="font-medium text-lca-navy">
                    {isSearching ? 'No clubs match your search' : 'No clubs in this region yet'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isSearching
                      ? 'Try a different club name or city.'
                      : 'Check back soon — new clubs are added regularly.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 lg:max-h-[calc(100vh-11rem)] lg:overflow-y-auto lg:pb-2 lg:pl-1 lg:pr-2 lg:pt-1 [scrollbar-width:thin]">
                  {displayedClubs.map((club) => (
                    <ClubCard
                      key={club.id}
                      club={club}
                      selected={club.id === selectedId}
                      distance={distances.get(club.id) ?? null}
                      onSelect={() => select(club.id === selectedId ? null : club.id, 'list')}
                      onHover={(on) => setHoveredId(on ? club.id : null)}
                      cardRef={(el) => {
                        if (el) cardRefs.current.set(club.id, el)
                        else cardRefs.current.delete(club.id)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Footer CTA ── */}
      <section className="border-t border-border bg-lca-navy">
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
                className="rounded-lg bg-lca-gold px-5 py-2.5 text-center text-sm font-semibold text-lca-navy transition-colors hover:bg-lca-gold/90"
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