// src/pages/ScholasticPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getTournaments, type ApiTournamentListItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

const GOLD = 'bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90'

const SCHOLASTIC_SECTIONS = ['K-12', 'K-8', 'K-5', 'Scholastic', 'Youth']

function isScholastic(t: ApiTournamentListItem): boolean {
  if (!t.sections) return false
  const names = (t.sections as any[]).map((s) =>
    typeof s === 'string' ? s : s?.name ?? '',
  )
  return names.some((n) =>
    SCHOLASTIC_SECTIONS.some((kw) => n.toLowerCase().includes(kw.toLowerCase())),
  )
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-[#c8a94a]/15 text-[#7a5c00] border border-[#c8a94a]/40' },
  active:   { label: 'Active',   className: 'bg-emerald-100 text-emerald-800 border border-emerald-300' },
  completed:{ label: 'Done',     className: 'bg-muted text-muted-foreground border border-border' },
}

export function ScholasticPage() {
  usePageTitle('Scholastic Chess')
  const [tournaments, setTournaments] = useState<ApiTournamentListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTournaments()
      .then((data) => setTournaments((data as ApiTournamentListItem[]).filter(isScholastic)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const upcoming = tournaments.filter((t) => t.status !== 'completed')
  const past = tournaments.filter((t) => t.status === 'completed')

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div
            className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]"
          >
            Scholastic Chess
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Chess in Louisiana schools
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/60">
            Tournaments, programs, and resources for K-12 players and educators across the state.
            New players always welcome — no experience required.
          </p>
        </div>
      </section>

      {/* ── Two-zone body ── */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-2">

          {/* ── Left: Tournaments ── */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Trophy className="size-5 text-[#c8a94a]" />
              <h2 className="text-xl font-bold text-[#1a2744]">Scholastic tournaments</h2>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading tournaments…</p>
            ) : upcoming.length === 0 ? (
              <div className="rounded-xl border border-dashed px-6 py-10 text-center">
                <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="font-medium text-[#1a2744]">No upcoming scholastic tournaments</p>
                <p className="mt-1 text-sm text-muted-foreground">Check back soon — events are added regularly.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map((t) => {
                  const sc = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming
                  return (
                    <div
                      key={t.id}
                      className="rounded-xl border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-[#1a2744]">{t.name}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
                            {t.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3.5 text-[#c8a94a]" />
                                {t.date}
                              </span>
                            )}
                            {t.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3.5 text-[#c8a94a]" />
                                {t.location}
                              </span>
                            )}
                          </div>
                          {t.sections && (t.sections as any[]).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(t.sections as any[]).map((s) => {
                                const name = typeof s === 'string' ? s : s?.name
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
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', sc.className)}>
                            {sc.label}
                          </span>
                          <Button asChild size="sm" className={cn('h-7 text-xs', GOLD)}>
                            <Link to={`/tournaments/${t.id}`}>
                              {t.status === 'upcoming' ? 'Register' : 'View'}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {past.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Past tournaments</h3>
                <div className="space-y-2">
                  {past.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.date}</p>
                      </div>
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                        <Link to={`/tournaments/${t.id}`}>Results</Link>
                      </Button>
                    </div>
                  ))}
                </div>
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
                <h3 className="font-semibold text-[#1a2744]">School outreach</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  LCA works with schools across Louisiana to introduce chess in the classroom.
                  Chess builds critical thinking, patience, and problem-solving skills that
                  benefit students across all subjects.
                </p>
              </div>

              <div
                className="rounded-xl border bg-card p-5 shadow-sm"
                style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
              >
                <h3 className="font-semibold text-[#1a2744]">Coach & educator resources</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  We provide lesson plans, a tournament guide for coaches, and links to USCF
                  scholastic resources to help educators bring chess programming to their schools.
                </p>
              </div>

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