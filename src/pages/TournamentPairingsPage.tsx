// src/pages/TournamentPairingsPage.tsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getTournament,
  type ApiStanding,
  type ApiTournamentDetail,
  type ApiTournamentPairing,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPlayer(name?: string, rating?: number | null) {
  if (!name) return 'BYE'
  return rating != null ? `${name} (${rating})` : name
}

function formatResult(result: string): string {
  if (!result || result === 'pending') return '—'
  if (result === 'bye') return '1'
  if (result === 'bye-half') return '½'
  if (result === '1-0 F') return '1-0 (F)'
  if (result === '0-1 F') return '0-1 (F)'
  if (result === '0-0 F') return '0-0 (F)'
  return result
}

// ── Round accordion item ─────────────────────────────────────────────────────

function RoundAccordion({
  round,
  pairings,
  roundSchedule,
  defaultOpen,
}: {
  round: number
  pairings: ApiTournamentPairing[]
  roundSchedule: Array<{ round: number; date: string; time: string }>
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const schedule = roundSchedule.find((r) => r.round === round)
  const sections = [...new Set(pairings.map((p) => p.section))].sort()
  const hasResults = pairings.some((p) => p.result && p.result !== 'pending')

  return (
    <div className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30',
          open && 'border-b border-border bg-lca-gold/5',
        )}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-lca-gold" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-lca-navy">Round {round}</span>
          {schedule && (
            <span className="text-xs text-muted-foreground">
              · {schedule.date}{schedule.time ? ` · ${schedule.time}` : ''}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {hasResults ? 'Completed' : 'In progress'}
        </span>
      </button>

      {open && (
        <div>
          {sections.map((section) => {
            const games = pairings.filter((p) => p.section === section)
            return (
              <div key={section}>
                <div className="border-b border-border bg-lca-gold/5 px-4 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-lca-navy">
                    {section}
                  </span>
                </div>
                <ul className="divide-y">
                  {games.map((game) => (
                    <li
                      key={game.id}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="w-12 flex-shrink-0 text-xs text-muted-foreground">
                        Bd {game.board}
                      </span>
                      <span className="flex-1 text-muted-foreground">
                        {formatPlayer(game.white_name, game.white_rating)}
                        {game.black_member_id ? (
                          <>
                            <span className="mx-2 text-border">vs</span>
                            {formatPlayer(game.black_name, game.black_rating)}
                          </>
                        ) : (
                          <span className="ml-2 text-xs italic">
                            {game.result === 'bye-half'
                              ? '— requested bye (½ pt)'
                              : '— bye (1 pt)'}
                          </span>
                        )}
                      </span>
                      <span className="w-16 flex-shrink-0 text-right font-medium text-lca-navy">
                        {formatResult(game.result)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Standings table ───────────────────────────────────────────────────────────

function StandingsTable({
  standings,
  sectionName,
}: {
  standings: ApiStanding[]
  sectionName: string
}) {
  // Server order is authoritative (score desc, wins desc, name); filter only
  const sorted = standings.filter((s) => s.section === sectionName)

  if (sorted.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-base font-semibold text-lca-navy">{sectionName}</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 font-semibold text-lca-navy">#</th>
              <th className="px-4 py-3 font-semibold text-lca-navy">Player</th>
              <th className="px-4 py-3 text-center font-semibold text-lca-navy">Pts</th>
              <th className="px-4 py-3 text-center font-semibold text-lca-navy">W</th>
              <th className="px-4 py-3 text-center font-semibold text-lca-navy">D</th>
              <th className="px-4 py-3 text-center font-semibold text-lca-navy">L</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => (
              <tr
                key={player.member_id}
                className={cn(
                  'border-b last:border-0',
                  idx === 0 && 'bg-lca-gold/5',
                )}
              >
                <td className={cn(
                  'px-4 py-3 font-medium',
                  idx === 0 ? 'text-lca-navy' : 'text-muted-foreground',
                )}>
                  {idx + 1}
                </td>
                <td className="px-4 py-3 font-medium text-lca-navy">{player.full_name}</td>
                <td className="px-4 py-3 text-center font-semibold text-lca-navy">
                  {player.score % 1 === 0 ? player.score : player.score.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{player.wins}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{player.draws}</td>
                <td className="px-4 py-3 text-center text-muted-foreground">{player.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function TournamentPairingsPage() {
  const { id } = useParams<{ id: string }>()

  const [tournament, setTournament] = useState<ApiTournamentDetail | null>(null)
  const [pairings, setPairings] = useState<ApiTournamentPairing[]>([])
  const [standings, setStandings] = useState<ApiStanding[]>([])
  // The route param is known at first render, so a missing id is the state we
  // start in rather than something an effect corrects a render later.
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(!id)

  usePageTitle(tournament ? `${tournament.name} — Pairings` : 'Pairings')

  useEffect(() => {
    if (!id) return
    getTournament(id)
      .then((data) => {
        setTournament(data.tournament)
        setPairings(data.pairings ?? [])
        setStandings(data.standings ?? [])
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to load'
        if (msg.toLowerCase().includes('not found')) setNotFound(true)
        else setError(msg)
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-muted-foreground">Loading pairings…</p>
    </div>
  )

  if (error) return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-center">
      <p className="text-destructive">{error}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to={`/tournaments/${id}`}><ArrowLeft className="size-4" /> Back</Link>
      </Button>
    </div>
  )

  if (notFound || !tournament) return (
    <div className="mx-auto max-w-4xl px-6 py-12 text-center">
      <Trophy className="mx-auto size-12 text-muted-foreground" />
      <h1 className="mt-4 text-2xl font-bold text-lca-navy">Tournament not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back to tournaments</Link>
      </Button>
    </div>
  )

  const roundSchedule = tournament.round_schedule ?? []
  const pairedRounds = [...new Set(pairings.map((p) => p.round))].sort((a, b) => a - b)
  const allRounds = Array.from({ length: tournament.rounds }, (_, i) => i + 1)
  const isCompleted = tournament.status === 'completed'
  const sectionOrder = tournament.sections.map((s) => s.name)
  const hasScores = standings.some((s) => s.score > 0)

  // Auto-open logic: open the latest paired round only
  const latestPairedRound = pairedRounds[pairedRounds.length - 1] ?? null

  if (pairings.length === 0) return (
    <div>
      <section className="border-b-[3px] border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-lca-gold transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to {tournament.name}
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Pairings &amp; results
          </h1>
          <p className="mt-2 text-sm text-white/60">{tournament.name}</p>
        </div>
      </section>
      <div className="mx-auto max-w-4xl px-6 py-16 text-center">
        <Trophy className="mx-auto size-10 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium text-lca-navy">No pairings published yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Check back once the tournament director posts round pairings.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to={`/tournaments/${id}`}>Back to tournament details</Link>
        </Button>
      </div>
    </div>
  )

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-lca-gold bg-lca-navy text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-lca-gold transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to {tournament.name}
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Pairings &amp; results
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {tournament.name} · {pairedRounds.length} of {tournament.rounds} rounds posted
          </p>
        </div>
      </section>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">

        {/* Standings — live during the event, final after */}
        {hasScores && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-lca-navy">
              {isCompleted ? 'Final standings' : 'Current standings'}
            </h2>
            {sectionOrder.map((sec) => (
              <StandingsTable key={sec} standings={standings} sectionName={sec} />
            ))}
          </div>
        )}

        {/* Pairings by round */}
        <div>
          <h2 className="mb-4 text-2xl font-bold text-lca-navy">
            {isCompleted ? 'Pairings' : 'Round pairings'}
          </h2>
          <div className="space-y-3">
            {allRounds.map((round) => {
              const roundPairings = pairings.filter((p) => p.round === round)
              const isPaired = roundPairings.length > 0
              const isLatest = round === latestPairedRound

              if (!isPaired) {
                return (
                  <div
                    key={round}
                    className="flex items-center justify-between rounded-xl border border-dashed px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight className="size-4 text-border" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Round {round}
                      </span>
                      {(() => {
                        const sch = roundSchedule.find((r) => r.round === round)
                        return sch ? (
                          <span className="text-xs text-muted-foreground">
                            · {sch.date}{sch.time ? ` · ${sch.time}` : ''}
                          </span>
                        ) : null
                      })()}
                    </div>
                    <span className="text-xs italic text-muted-foreground">Not yet paired</span>
                  </div>
                )
              }

              return (
                <RoundAccordion
                  key={round}
                  round={round}
                  pairings={roundPairings}
                  roundSchedule={roundSchedule}
                  defaultOpen={isCompleted ? false : isLatest}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
