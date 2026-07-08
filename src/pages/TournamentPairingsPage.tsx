// TournamentPairingsPage
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  getTournament,
  type ApiTournamentDetail,
  type ApiTournamentPairing,
  type ApiRosterPlayer,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { usePageTitle } from '@/hooks/usePageTitle'

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiStanding {
  member_id: string
  full_name: string
  section: string
  score: number
  wins: number
  draws: number
  losses: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPlayer(name?: string, rating?: number | null) {
  if (!name) return 'BYE'
  return rating != null ? `${name} (${rating})` : name
}

function deriveStandings(
  pairings: ApiTournamentPairing[],
  roster: ApiRosterPlayer[],
): ApiStanding[] {
  const map = new Map<string, ApiStanding>()

  for (const player of roster) {
    map.set(player.member_id, {
      member_id: player.member_id,
      full_name: player.full_name,
      section: player.section,
      score: 0,
      wins: 0,
      draws: 0,
      losses: 0,
    })
  }

  for (const game of pairings) {
    if (game.result === 'pending' || !game.result) continue

    const white = game.white_member_id ? map.get(game.white_member_id) : null
    const black = game.black_member_id ? map.get(game.black_member_id) : null

    if (game.result === '1-0' || game.result === '1–0') {
      if (white) { white.score += 1; white.wins += 1 }
      if (black) { black.losses += 1 }
    } else if (game.result === '0-1' || game.result === '0–1') {
      if (black) { black.score += 1; black.wins += 1 }
      if (white) { white.losses += 1 }
    } else if (game.result === '1/2-1/2' || game.result === '½–½' || game.result === '1/2') {
      if (white) { white.score += 0.5; white.draws += 1 }
      if (black) { black.score += 0.5; black.draws += 1 }
    } else if (game.result === 'bye' || game.result === 'BYE') {
      if (white) { white.score += 0.5 }
    }
  }

  return Array.from(map.values())
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
          open && 'border-b border-border bg-[#c8a94a]/5',
        )}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="size-4 text-[#c8a94a]" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="font-semibold text-[#1a2744]">Round {round}</span>
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
                <div className="border-b border-border bg-[#c8a94a]/5 px-4 py-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#c8a94a]">
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
                        <span className="mx-2 text-border">vs</span>
                        {game.black_member_id
                          ? formatPlayer(game.black_name, game.black_rating)
                          : 'BYE'}
                      </span>
                      <span className="w-10 flex-shrink-0 text-right font-medium text-[#1a2744]">
                        {game.result && game.result !== 'pending' ? game.result : '—'}
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
  const sorted = [...standings]
    .filter((s) => s.section === sectionName)
    .sort((a, b) => b.score - a.score || b.wins - a.wins)

  if (sorted.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-base font-semibold text-[#1a2744]">{sectionName}</h3>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 font-semibold text-[#1a2744]">#</th>
              <th className="px-4 py-3 font-semibold text-[#1a2744]">Player</th>
              <th className="px-4 py-3 text-center font-semibold text-[#1a2744]">Pts</th>
              <th className="px-4 py-3 text-center font-semibold text-[#1a2744]">W</th>
              <th className="px-4 py-3 text-center font-semibold text-[#1a2744]">D</th>
              <th className="px-4 py-3 text-center font-semibold text-[#1a2744]">L</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, idx) => (
              <tr
                key={player.member_id}
                className={cn(
                  'border-b last:border-0',
                  idx === 0 && 'bg-[#c8a94a]/5',
                )}
              >
                <td className={cn(
                  'px-4 py-3 font-medium',
                  idx === 0 ? 'text-[#c8a94a]' : 'text-muted-foreground',
                )}>
                  {idx + 1}
                </td>
                <td className="px-4 py-3 font-medium text-[#1a2744]">{player.full_name}</td>
                <td className="px-4 py-3 text-center font-semibold text-[#1a2744]">
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
  const [roster, setRoster] = useState<ApiRosterPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  usePageTitle(tournament ? `${tournament.name} — Pairings` : 'Pairings')

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return }
    getTournament(id)
      .then((data) => {
        setTournament(data.tournament)
        setPairings(data.pairings ?? [])
        setRoster(data.roster)
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
      <h1 className="mt-4 text-2xl font-bold text-[#1a2744]">Tournament not found</h1>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/tournaments"><ArrowLeft className="size-4" /> Back to tournaments</Link>
      </Button>
    </div>
  )

  const roundSchedule = (tournament as any).round_schedule ?? []
  const pairedRounds = [...new Set(pairings.map((p) => p.round))].sort((a, b) => a - b)
  const allRounds = Array.from({ length: tournament.rounds }, (_, i) => i + 1)
  const isCompleted = tournament.status === 'completed'
  const standings = isCompleted ? deriveStandings(pairings, roster) : []
  const sectionOrder = tournament.sections.map((s) => s.name)

  // Auto-open logic: open the latest paired round only
  const latestPairedRound = pairedRounds[pairedRounds.length - 1] ?? null

  if (pairings.length === 0) return (
    <div>
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-[#c8a94a] transition-colors"
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
        <p className="mt-4 text-lg font-medium text-[#1a2744]">No pairings published yet</p>
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
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744] text-white">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <Link
            to={`/tournaments/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-white/55 hover:text-[#c8a94a] transition-colors"
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

        {/* Final standings — only when tournament is completed */}
        {isCompleted && standings.length > 0 && (
          <div>
            <h2 className="mb-6 text-2xl font-bold text-[#1a2744]">Final standings</h2>
            {sectionOrder.map((sec) => (
              <StandingsTable key={sec} standings={standings} sectionName={sec} />
            ))}
          </div>
        )}

        {/* Pairings by round */}
        <div>
          <h2 className="mb-4 text-2xl font-bold text-[#1a2744]">
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
                        const sch = roundSchedule.find((r: any) => r.round === round)
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