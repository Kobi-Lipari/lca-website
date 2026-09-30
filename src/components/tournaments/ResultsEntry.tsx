// src/components/tournaments/ResultsEntry.tsx
//
// Entering results at the board: one round of one section at a time, with
// one-tap buttons for the common results and a menu for forfeits and byes.
// Each result saves on its own; the table never reloads under the director.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, Check, Printer } from 'lucide-react'

import type { ApiTournamentGame } from '@/lib/api'
import { cn } from '@/lib/utils'

const QUICK = [
  { value: '1-0', label: '1-0' },
  { value: '1/2-1/2', label: '½-½' },
  { value: '0-1', label: '0-1' },
]
const OTHER = [
  { value: 'pending', label: 'Clear result' },
  { value: '1-0 F', label: '1-0 forfeit' },
  { value: '0-1 F', label: '0-1 forfeit' },
  { value: '0-0 F', label: 'Double forfeit' },
]

export function ResultsEntry({ games, sections, onResult, onSwap, savedGameId, tournamentId }: {
  /** Shows print links for the selected round. */
  tournamentId?: string
  games: ApiTournamentGame[]
  sections: string[]
  onResult: (gameId: string, result: string) => void
  /** Swap White and Black on a board. */
  onSwap?: (game: ApiTournamentGame) => void
  savedGameId: string | null
}) {
  const withGames = sections.filter((s) => games.some((g) => g.section === s))
  const [section, setSection] = useState(withGames[0] ?? sections[0] ?? '')
  const rounds = useMemo(
    () => [...new Set(games.filter((g) => g.section === section).map((g) => g.round))].sort((a, b) => a - b),
    [games, section],
  )
  const [roundChoice, setRoundChoice] = useState<number | null>(null)
  const round = roundChoice !== null && rounds.includes(roundChoice) ? roundChoice : rounds[rounds.length - 1]

  const shown = games
    .filter((g) => g.section === section && g.round === round)
    .sort((a, b) => a.board - b.board)
  const missing = shown.filter((g) => g.result === 'pending').length

  if (games.length === 0) return <p className="mt-4 text-sm text-muted-foreground">No pairings yet.</p>

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {withGames.length > 1 && (
          <select aria-label="Section" className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
            value={section} onChange={(e) => { setSection(e.target.value); setRoundChoice(null) }}>
            {withGames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="flex flex-wrap gap-1" role="group" aria-label="Round">
          {rounds.map((r) => (
            <button key={r} type="button" onClick={() => setRoundChoice(r)}
              className={cn('rounded-md border px-2.5 py-1 text-sm font-medium',
                r === round ? 'border-lca-navy bg-lca-navy text-white' : 'text-muted-foreground hover:text-foreground')}>
              Rd {r}
            </button>
          ))}
        </div>
        {tournamentId && round !== undefined && (
          <span className="flex gap-3 text-sm">
            <Link to={`/tournaments/${tournamentId}/print?what=pairings&section=${encodeURIComponent(section)}&round=${round}`}
              className="inline-flex items-center gap-1 text-lca-navy hover:underline">
              <Printer className="size-3.5" /> Print pairings
            </Link>
            <Link to={`/tournaments/${tournamentId}/print?what=alpha&section=${encodeURIComponent(section)}&round=${round}`}
              className="text-lca-navy hover:underline">
              Alphabetical
            </Link>
          </span>
        )}
        <span className={cn('ml-auto text-sm', missing ? 'font-medium text-[#7a5c00]' : 'text-emerald-700')}>
          {missing ? `${missing} result${missing === 1 ? '' : 's'} missing` : 'All results in'}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="w-12 px-3 py-2">Bd</th>
              <th className="px-3 py-2">White</th>
              <th className="px-3 py-2">Black</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const bye = !g.black_member_id
              return (
                <tr key={g.id} className={cn('border-b last:border-0', g.result === 'pending' && 'bg-lca-gold/[0.06]')}>
                  <td className="px-3 py-2 font-medium tabular-nums">{g.board}</td>
                  <td className="px-3 py-2">{g.white_name ?? g.white_member_id}</td>
                  <td className="px-3 py-2">{bye ? <span className="text-muted-foreground">Bye</span> : g.black_name ?? g.black_member_id}</td>
                  <td className="px-3 py-2">
                    {bye ? (
                      <span className="text-muted-foreground">{g.result === 'bye-half' ? '½ point (requested)' : '1 point'}</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1">
                        {QUICK.map((q) => (
                          <button key={q.value} type="button" onClick={() => onResult(g.id, q.value)}
                            aria-pressed={g.result === q.value}
                            className={cn('min-w-[3rem] rounded-md border px-2 py-1 text-sm font-medium tabular-nums',
                              g.result === q.value ? 'border-lca-navy bg-lca-navy text-white' : 'hover:border-lca-navy/40')}>
                            {q.label}
                          </button>
                        ))}
                        <select aria-label={`More results for board ${g.board}`}
                          className={cn('rounded-md border bg-background px-1.5 py-1 text-xs',
                            g.result.endsWith('F') && 'border-lca-navy font-medium text-lca-navy')}
                          value={OTHER.some((o) => o.value === g.result) && g.result !== 'pending' ? g.result : ''}
                          onChange={(e) => e.target.value && onResult(g.id, e.target.value)}>
                          <option value="">More…</option>
                          {OTHER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {onSwap && (
                          <button type="button" onClick={() => onSwap(g)} title="Swap colors"
                            aria-label={`Swap colors on board ${g.board}`}
                            className="rounded-md p-1 text-muted-foreground hover:text-lca-navy">
                            <ArrowLeftRight className="size-3.5" />
                          </button>
                        )}
                        {savedGameId === g.id && <Check className="size-4 text-emerald-600" aria-label="Saved" />}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
