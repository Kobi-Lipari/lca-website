// src/pages/HomePage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, Calendar, ChevronLeft, ChevronRight, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import { getTournaments, getClubs, type ApiTournamentListItem, type ApiClubListItem } from '@/lib/api'
import { clubColorTint, clubAccentStyle } from '@/lib/clubColors'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

import slide1 from '@/assets/LCA_Slide_1.jpg'
import slide2 from '@/assets/LCA_Slide_2.jpg'
import slide3 from '@/assets/LCA_Slide_3.jpg'
import slide4 from '@/assets/LCA_Slide_4.jpg'
import slide5 from '@/assets/LCA_Slide_5.jpg'

const goldButtonClass = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'
const LCA_GOLD = '#c8a94a'

const heroSlides = [
  { label: 'Louisiana Chess Community', src: slide1 },
  { label: 'Club tournaments across the state', src: slide2 },
  { label: 'Scholastic chess in Louisiana', src: slide3 },
  { label: 'Players across the Pelican State', src: slide4 },
  { label: 'Chess for every generation', src: slide5 },
]

function HeroSlideshow() {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const total = heroSlides.length

  function go(n: number) { setCurrent((n + total) % total) }
  function restart() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % total), 5000)
  }
  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % total), 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])
  function handleNav(n: number) { go(n); restart() }

  return (
    <div className="relative overflow-hidden border-b border-border" style={{ height: 420 }}>
      <div className="flex h-full transition-transform duration-500 ease-in-out" style={{ transform: `translateX(-${current * 100}%)` }}>
        {heroSlides.map((slide, i) => (
          <div key={i} className="relative h-full min-w-full flex-shrink-0 overflow-hidden">
            {/* Background photo, desaturated + darkened so it reads as texture, not a spotlighted portrait */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${slide.src})`,
                filter: 'grayscale(35%) brightness(0.55) contrast(1.05)',
                transform: 'scale(1.04)', // hides any filter edge artifacts on pan
              }}
            />
            {/* Navy brand tint, ties the photo into the site palette instead of a raw photo look */}
            <div className="absolute inset-0 bg-[#1a2744]/55 mix-blend-multiply" />
            {/* Existing gradient for text legibility at the bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
            <div className="absolute right-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs text-white/70 backdrop-blur-sm">
              {slide.label}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-14 px-6 text-center text-white">
        <div className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/20 px-3 py-1 text-xs text-[#f0d07a] backdrop-blur-sm">
          Louisiana's chess community since 1935
        </div>
        <h1 className="mt-2 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Play. Compete. Connect.</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/80">
          Tournaments, scholastic programs, and clubs across the Pelican State.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className={goldButtonClass}>
            <Link to="/tournaments">Find a tournament</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white">
            <Link to="/membership">Join LCA</Link>
          </Button>
        </div>
        <div className="mt-5 flex gap-6">
          {[{ n: '340+', l: 'members' }, { n: '25+', l: 'clubs' }, { n: '80+', l: 'years of history' }].map((s) => (
            <div key={s.l} className="text-center">
              <div className="text-lg font-bold text-white">{s.n}</div>
              <div className="text-xs text-white/60">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
        <button type="button" onClick={() => handleNav(current - 1)} aria-label="Previous slide" className="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
          <ChevronLeft className="size-3.5 text-white" />
        </button>
        {heroSlides.map((_, i) => (
          <button key={i} type="button" onClick={() => handleNav(i)} aria-label={`Slide ${i + 1}`} className={cn('h-1.5 rounded-full transition-all duration-300', i === current ? 'w-5 bg-[#c8a94a]' : 'w-1.5 bg-white/40 hover:bg-white/60')} />
        ))}
        <button type="button" onClick={() => handleNav(current + 1)} aria-label="Next slide" className="flex h-6 w-6 items-center justify-center rounded bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors">
          <ChevronRight className="size-3.5 text-white" />
        </button>
      </div>
    </div>
  )
}

function StatusDot({ regStatus }: { regStatus?: string }) {
  if (regStatus === 'open') return <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" title="Registration open" />
  if (regStatus === 'draft') return <span className="h-2 w-2 shrink-0 rounded-full bg-[#c8a94a]" title="Opening soon" />
  return <span className="h-2 w-2 shrink-0 rounded-full bg-border" title="Coming soon" />
}

/**
 * Facebook Page embed with two fixes:
 * 1. Re-parses XFBML on mount — the FB SDK only parses on initial page load,
 *    so client-side navigation (React Router) otherwise renders an empty div.
 * 2. Detects failure (ad blockers, SDK not loaded) and swaps in a designed
 *    fallback card so this column never renders as dead white space.
 */
function FacebookPanel({ height }: { height: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    if (w.FB?.XFBML && containerRef.current) {
      try { w.FB.XFBML.parse(containerRef.current) } catch { /* noop */ }
    }
    const timer = setTimeout(() => {
      const hasIframe = containerRef.current?.querySelector('iframe')
      if (!hasIframe) setFailed(true)
    }, 2500)
    return () => clearTimeout(timer)
  }, [])

  if (failed) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ height }}>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877F2]/10">
          <FacebookIcon className="size-5 text-[#1877F2]" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-foreground">Louisiana Chess Association</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            News, results, and photos from events across the state.
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 text-xs">
          <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer">
            Follow on Facebook
          </a>
        </Button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="overflow-hidden" style={{ maxHeight: height }}>
      <div
        className="fb-page"
        data-href="https://www.facebook.com/LouisianaChessAssociation"
        data-tabs="timeline"
        data-width="500"
        data-height={String(height)}
        data-small-header="true"
        data-adapt-container-width="true"
        data-hide-cover="true"
        data-show-facepile="false"
      />
    </div>
  )
}

const COLUMN_HEIGHT = 280

export function HomePage() {
  usePageTitle('Home')
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [clubs, setClubs] = useState<ApiClubListItem[]>([])
  const [loadingTournaments, setLoadingTournaments] = useState(true)
  const [loadingClubs, setLoadingClubs] = useState(true)

  const nextTournament = tournaments.find(
    (t) => (t as any).registration_status === 'open' || t.status === 'upcoming',
  )

  useEffect(() => {
    getTournaments().then((data) => setTournaments(data.filter((t) => t.status !== 'completed'))).catch(() => setTournaments([])).finally(() => setLoadingTournaments(false))
    getClubs().then(setClubs).catch(() => setClubs([])).finally(() => setLoadingClubs(false))
  }, [])

  return (
    <div>
      <HeroSlideshow />

      {nextTournament && (
        <div className="flex items-center justify-between border-b border-[#c8a94a]/30 bg-[#c8a94a]/10 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="size-3.5 shrink-0 text-[#c8a94a]" />
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{nextTournament.name}</span>
              {' · '}{nextTournament.date}
              {' · '}{nextTournament.location}
            </span>
          </div>
          <Button asChild size="sm" className={cn('h-7 shrink-0 text-xs', goldButtonClass)}>
            <Link to={`/tournaments/${nextTournament.id}`}>
              {(nextTournament as any).registration_status === 'open' ? 'Register now' : 'View details'}
            </Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 border-b border-border sm:grid-cols-3">
        <div className="flex flex-col border-b border-border sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <Trophy className="size-3.5 text-[#c8a94a]" />
              <span className="text-[13px] font-semibold text-foreground">Tournaments</span>
            </div>
            <Link to="/tournaments" className="flex items-center gap-0.5 text-xs text-[#c8a94a] hover:underline">
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="relative">
            <div className="overflow-y-auto" style={{ maxHeight: COLUMN_HEIGHT }}>
              {loadingTournaments ? (
                <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
              ) : tournaments.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground">No upcoming tournaments.</div>
              ) : (
                tournaments.map((t) => {
                  const regStatus = (t as any).registration_status
                  const color = ((t as any).club_color as string | undefined) || LCA_GOLD
                  return (
                    <Link key={t.id} to={`/tournaments/${t.id}`} className="flex items-center justify-between border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30" style={{ backgroundColor: clubColorTint(color, 0.05) }}>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground">{t.date} · {t.location}</p>
                      </div>
                      <StatusDot regStatus={regStatus} />
                    </Link>
                  )
                })
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
          </div>
        </div>

        <div className="flex flex-col border-b border-border sm:border-b-0 sm:border-r">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <FacebookIcon className="size-3.5 text-[#1877F2]" />
              <span className="text-[13px] font-semibold text-foreground">Latest from Facebook</span>
            </div>
            <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-xs text-[#1877F2] hover:underline">
              Follow <ArrowRight className="size-3" />
            </a>
          </div>
          <FacebookPanel height={COLUMN_HEIGHT} />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex items-center gap-2">
              <Building2 className="size-3.5 text-[#c8a94a]" />
              <span className="text-[13px] font-semibold text-foreground">Clubs</span>
            </div>
            <Link to="/clubs" className="flex items-center gap-0.5 text-xs text-[#c8a94a] hover:underline">
              Find yours <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="relative">
            <div className="overflow-y-auto" style={{ maxHeight: COLUMN_HEIGHT }}>
              {loadingClubs ? (
                <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
              ) : clubs.length === 0 ? (
                <div className="px-4 py-6 text-xs text-muted-foreground">No clubs listed yet.</div>
              ) : (
                clubs.map((club) => {
                  const color = club.color || LCA_GOLD
                  return (
                    <Link key={club.id} to={`/clubs/${club.id}`} className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30" style={{ backgroundColor: clubColorTint(color, 0.05) }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={clubAccentStyle(color)} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{club.name}</p>
                        <p className="text-[11px] text-muted-foreground">{club.city}, LA{club.meeting_schedule ? ` · ${club.meeting_schedule}` : ''}</p>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
          </div>
        </div>
      </div>

      <div className="border-t-[3px] border-[#c8a94a] bg-[#1a2744] px-6 py-10 text-center text-white">
        <div className="mx-auto max-w-lg">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#c8a94a]">
            <Trophy className="size-6 text-[#1a2744]" />
          </div>
          <h2 className="text-2xl font-bold sm:text-3xl">Become an LCA member</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Support chess in Louisiana and unlock member benefits including discounted tournament entry, your official membership profile, and access to events across the state.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className={goldButtonClass}>
              <Link to="/membership">Join LCA</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link to="/about">Learn more</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}