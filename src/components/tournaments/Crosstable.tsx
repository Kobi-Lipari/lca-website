// src/components/tournaments/Crosstable.tsx
//
// A US Chess style crosstable for one section: players numbered in
// standings order, and for each round the result and the opponent's
// number, e.g. "W12" (won against player 12), "D3", "L7", with the color
// underneath. B = full-point bye, H = half-point bye, X / F = won / lost by
// forfeit, U = didn't play.
import type { ApiStanding, ApiTournamentPairing } from '@/lib/api'
import { cn } from '@/lib/utils'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))

interface Cell { code: string; opp: number | null; color: 'w' | 'b' | null; pts: number | null }

function cellFor(game: ApiTournamentPairing | undefined, me: string, num: Map<string, number>): Cell {
  if (!game) return { code: 'U', opp: null, color: null, pts: 0 }
  const white = game.white_member_id === me
  const oppId = white ? game.black_member_id : game.white_member_id
  const opp = oppId ? num.get(oppId) ?? null : null
  const color = oppId ? (white ? 'w' : 'b') : null
  const r = game.result
  if (r === 'bye') return { code: 'B', opp: null, color: null, pts: 1 }
  if (r === 'bye-half') return { code: 'H', opp: null, color: null, pts: 0.5 }
  if (!oppId) return { code: 'U', opp: null, color: null, pts: 0 }
  if (r === 'pending' || !r) return { code: '', opp, color, pts: null }
  if (r === '1/2-1/2') return { code: 'D', opp, color, pts: 0.5 }
  const whiteWon = r.startsWith('1-0')
  const blackWon = r.startsWith('0-1')
  const forfeit = r.endsWith('F')
  const iWon = (white && whiteWon) || (!white && blackWon)
  if (forfeit) return { code: iWon ? 'X' : 'F', opp, color, pts: iWon ? 1 : 0 }
  return { code: iWon ? 'W' : 'L', opp, color, pts: iWon ? 1 : 0 }
}

export function Crosstable({ standings, pairings, sectionName, rounds, showHeading = true }: {
  standings: ApiStanding[]
  pairings: ApiTournamentPairing[]
  sectionName: string
  rounds: number
  showHeading?: boolean
}) {
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null
  const games = pairings.filter((p) => p.section === sectionName)
  const lastRound = Math.max(rounds, ...games.map((g) => g.round))
  const roundList = Array.from({ length: lastRound }, (_, i) => i + 1)
  const num = new Map(rows.map((r, i) => [r.member_id, i + 1]))

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-lca-navy">{sectionName}</h3>}
      <div className="overflow-x-auto rounded-xl border print:overflow-visible">
        <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-2 py-2.5 text-right font-semibold text-lca-navy">#</th>
              <th className="px-3 py-2.5 font-semibold text-lca-navy">Player</th>
              <th className="px-2 py-2.5 text-right font-semibold text-lca-navy">Rating</th>
              {roundList.map((r) => (
                <th key={r} className="px-2 py-2.5 text-center font-semibold text-lca-navy">Rd {r}</th>
              ))}
              <th className="px-2 py-2.5 text-center font-semibold text-lca-navy">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.member_id} className="border-b last:border-0">
                <td className="px-2 py-1.5 text-right text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-lca-navy">
                  {p.full_name}
                  {p.placeLabel && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({p.placeLabel})</span>}
                </td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">{p.rating ?? 'Unr.'}</td>
                {roundList.map((r) => {
                  const game = games.find((g) => g.round === r && (g.white_member_id === p.member_id || g.black_member_id === p.member_id))
                  const c = cellFor(game, p.member_id, num)
                  return (
                    <td key={r} className="px-2 py-1 text-center leading-tight" title={c.color ? (c.color === 'w' ? 'White' : 'Black') : undefined}>
                      <span className={cn(
                        'font-mono text-xs',
                        c.code === 'W' || c.code === 'X' || c.code === 'B' ? 'font-semibold text-lca-navy' : 'text-muted-foreground',
                      )}>
                        {c.code}{c.opp ?? ''}
                      </span>
                      {c.color && <span className="block text-[10px] text-muted-foreground/70">{c.color}</span>}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-center font-semibold text-lca-navy">{fmt(p.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        W win · L loss · D draw, with the opponent's number · B full-point bye · H half-point bye · X / F win / loss by forfeit · U not played · w / b color
      </p>
    </div>
  )
}
