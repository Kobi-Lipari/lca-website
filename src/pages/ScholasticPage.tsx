// src/pages/ScholasticPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, ExternalLink, MapPin, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PageHero } from '@/components/PageHero'
import { StatusBadge, TOURNAMENT_STATUS } from '@/components/StatusBadge'
import { formatDate, type UnifiedTournament } from '@/lib/clearinghouse'
import { isScholasticTournament, sectionName } from '@/lib/scholastic'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

function ScholasticCard({ t }: { t: UnifiedTournament }) {
  const isLca = t.is_lca === 1
  const status = TOURNAMENT_STATUS[t.status ?? 'upcoming'] ?? TOURNAMENT_STATUS.upcoming
  const sections = t.sections ?? []

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-[#1a2744]">{t.name}</p>
            {!isLca && (
              <span className="flex-shrink-0 rounded border border-border px-1 py-px text-[10px] text-muted-foreground">
                External{t.state && t.state !== 'LA' ? ` · ${t.state}` : ''}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5 text-[#c8a94a]" />
              {formatDate(t.start_date)}
            </span>
            {(t.city || t.venue) && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-[#c8a94a]" />
                {t.city ?? t.venue}
              </span>
            )}
            {!isLca && t.organizer && (
              <span className="flex items-center gap-1">
                <Users className="size-3.5 text-[#c8a94a]" />
                {t.organizer}
              </span>
            )}
          </div>
          {sections.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sections.map((s) => {
                const name = sectionName(s)
                return (
                  <span
                    key={name}
                    className="rounded-full border border-[#1a2744]/20 bg-[#1a2744]/7 px-2 py-0.5 text-[10px] font-medium text-[#1a2744]"
                  >
                    {name}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-2">
          {isLca && (
            <StatusBadge tone={status.tone} on="light">{status.label}</StatusBadge>
          )}
          {isLca ? (
            <Button asChild size="sm" className={cn('h-7 text-xs', GOLD)}>
              <Link to={`/tournaments/${t.id}`}>
                {t.registration_status === 'open' ? 'Register' : 'View'}
              </Link>
            </Button>
          ) : t.link ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <a href={t.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 size-3" /> Details
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function ScholasticPage() {
  usePageTitle('Scholastic Chess')
  const [tournaments, setTournaments] = useState<UnifiedTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/clearinghouse?upcoming=true')
      .then((r) => r.json())
      .then((d: { tournaments: UnifiedTournament[] }) => {
        const scholastic = (d.tournaments ?? [])
          .filter((t) => isScholasticTournament(t.name, t.sections))
          // LCA events first, then soonest first within each group
          .sort(
            (a, b) =>
              b.is_lca - a.is_lca ||
              (a.start_date ?? '').localeCompare(b.start_date ?? ''),
          )
        setTournaments(scholastic)
      })
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        title="Chess in Louisiana schools"
        subtitle="Tournaments, programs, and resources for K-12 players and educators across the state."
      />

      {/* ── Two-zone body ── */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2">

          {/* ── Left: Tournaments ── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="size-5 text-[#c8a94a]" />
              <h2 className="text-xl font-bold text-[#1a2744]">Scholastic tournaments</h2>
            </div>
            <p className="-mt-2 mb-4 text-xs text-muted-foreground">
              LCA events listed first, then regional youth tournaments from the Gulf South clearinghouse.
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading tournaments…</p>
            ) : tournaments.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium text-[#1a2744]">No upcoming scholastic tournaments</p>
                <p className="mt-1 text-sm text-muted-foreground">Check back soon — events are added regularly.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tournaments.map((t) => (
                  <ScholasticCard key={`${t.source}-${t.id}`} t={t} />
                ))}
              </div>
            )}

            <div className="mt-5">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link to="/tournaments">View all tournaments</Link>
              </Button>
            </div>
          </div>

          {/* ── Right: Programs ── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Users className="size-5 text-[#c8a94a]" />
              <h2 className="text-xl font-bold text-[#1a2744]">Scholastic programs</h2>
            </div>

            <div className="space-y-4">

              <div
                className="rounded-xl border bg-card p-5 shadow-sm"
                style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
              >
                <h3 className="font-semibold text-[#1a2744]">K-12 rated play</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  LCA-sanctioned scholastic tournaments are USCF-rated and open to players
                  in grades K–12. Sections are organized by grade level to ensure fair,
                  age-appropriate competition.
                </p>
              </div>

              <div
                className="rounded-xl border bg-card p-5 shadow-sm"
                style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
              >
                <h3 className="font-semibold text-[#1a2744]">National Recognition</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  LCA promotes K-12 players to be able to qualify play in tournaments nationally. Be on the look out for our Tournament of Champions Qualifiers.
                </p>
              </div>

              {/*<div
                className="rounded-xl border bg-card p-5 shadow-sm"
                style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
              >
                <h3 className="font-semibold text-[#1a2744]">Coach & educator resources</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We provide lesson plans, a tournament guide for coaches, and links to USCF
                  scholastic resources to help educators bring chess programming to their schools.
                </p>
              </div>*/}

              <div className="rounded-xl border border-dashed bg-muted/10 p-5">
                <p className="text-sm text-muted-foreground italic">
                  More programs and resources coming soon. We're working with the LCA board
                  to expand scholastic chess across Louisiana.
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-xl border-[3px] border-[#c8a94a] bg-[#1a2744] p-5 text-white">
              <h3 className="font-semibold">Get involved</h3>
              <p className="mt-2 text-sm text-white/65 leading-relaxed">
                Interested in bringing chess to your school, starting a scholastic club,
                or sponsoring youth chess in Louisiana? We'd love to hear from you.
              </p>
              <Button asChild className={cn('mt-4', GOLD)}>
                <Link to="/contact">Contact LCA about scholastic chess</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}