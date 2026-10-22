// src/areas/live/components/Crosstable.tsx
//
// A US Chess style crosstable for one section: players numbered in
// standings order, and for each round the result and the opponent's
// number, e.g. "W12" (won against player 12), "D3", "L7", with the color
// underneath. B = full-point bye, H = half-point bye, X / F = won / lost by
// forfeit, U = didn't play.
//
// Under the new look (newLook) each round is a ResultCell (the letter, a
// ring or a disc for the colour played and the opponent's number, with the
// game in words for a screen reader), the total is written with ½, figures
// are in the monospace face, the player's name is the row's header, and the
// number and the name stay in view while the rounds scroll sideways. With
// newLook off the table is today's, its header cells marked scope="col".
import type { ApiStanding, ApiTournamentPairing } from '@/lib/api'
import { ResultCell, ResultLegend, type ResultCode } from '@/components/ResultCell'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from '@/components/ui/table'
import { FEATURES } from '@/lib/features'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))

interface Cell { code: ResultCode; opp: number | null; color: 'w' | 'b' | null; pts: number | null }

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

interface CrosstableProps {
  standings: ApiStanding[]
  pairings: ApiTournamentPairing[]
  sectionName: string
  rounds: number
  showHeading?: boolean
}

export function Crosstable(props: CrosstableProps) {
  return FEATURES.newLook ? <NewCrosstable {...props} /> : <TodaysCrosstable {...props} />
}

/** The crosstable as it was before the new look, its header cells marked scope="col". */
function TodaysCrosstable({ standings, pairings, sectionName, rounds, showHeading = true }: CrosstableProps) {
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null
  const games = pairings.filter((p) => p.section === sectionName)
  const lastRound = Math.max(rounds, ...games.map((g) => g.round))
  const roundList = Array.from({ length: lastRound }, (_, i) => i + 1)
  const num = new Map(rows.map((r, i) => [r.member_id, i + 1]))

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-ink">{sectionName}</h3>}
      <div className="overflow-x-auto rounded-xl border print:overflow-visible">
        <table className="w-full min-w-[480px] text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink">#</th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-ink">Player</th>
              <th scope="col" className="px-2 py-2.5 text-right font-semibold text-ink">Rating</th>
              {roundList.map((r) => (
                <th key={r} scope="col" className="px-2 py-2.5 text-center font-semibold text-ink">Rd {r}</th>
              ))}
              <th scope="col" className="px-2 py-2.5 text-center font-semibold text-ink">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.member_id} className="border-b last:border-0">
                <td className="px-2 py-1.5 text-right text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium text-ink">
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
                        c.code === 'W' || c.code === 'X' || c.code === 'B' ? 'font-semibold text-ink' : 'text-muted-foreground',
                      )}>
                        {c.code}{c.opp ?? ''}
                      </span>
                      {c.color && <span className="block text-[10px] text-muted-foreground/70">{c.color}</span>}
                    </td>
                  )
                })}
                <td className="px-2 py-1.5 text-center font-semibold text-ink">{fmt(p.score)}</td>
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

/** The header row's tint, today's bg-muted/50, through --row-tint so the pinned cells take it too. */
const HEAD_TINT = '[--row-tint:color-mix(in_oklab,var(--muted)_50%,transparent)]'
/** A header cell, sized as today's. */
const HEAD = 'h-auto py-2.5 font-semibold text-ink'

/**
 * The crosstable under the new look, drawn through the table primitives:
 * the number and the name pinned, the name the row's header, each round a
 * ResultCell, the total with ½, the figures in the monospace face, and a key
 * that names the marks in words. Its box is a named region in the tab order,
 * so the keyboard can scroll the rounds on a phone.
 */
function NewCrosstable({ standings, pairings, sectionName, rounds, showHeading = true }: CrosstableProps) {
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null
  const games = pairings.filter((p) => p.section === sectionName)
  const lastRound = Math.max(rounds, ...games.map((g) => g.round))
  const roundList = Array.from({ length: lastRound }, (_, i) => i + 1)
  const num = new Map(rows.map((r, i) => [r.member_id, i + 1]))

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-ink">{sectionName}</h3>}
      <Table
        label={`${sectionName} crosstable`}
        stickyFirst={2}
        containerClassName="rounded-xl border bg-surface print:overflow-visible"
        className="min-w-[480px] text-left text-sm tabular-nums"
      >
        <TableHeader>
          <TableRow className={HEAD_TINT}>
            <TableHead className={cn(HEAD, 'px-2 text-right')}>#</TableHead>
            <TableHead className={cn(HEAD, 'px-3')}>Player</TableHead>
            <TableHead className={cn(HEAD, 'px-2 text-right')}>Rating</TableHead>
            {roundList.map((r) => (
              <TableHead key={r} className={cn(HEAD, 'px-2 text-center')}>Rd {r}</TableHead>
            ))}
            <TableHead className={cn(HEAD, 'px-2 text-center')}>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p, i) => (
            <TableRow key={p.member_id}>
              <TableCell className="px-2 py-1.5 text-right font-mono text-muted-foreground">{i + 1}</TableCell>
              <TableRowHeader className="px-3 py-1.5 font-medium text-ink">
                {p.full_name}
                {p.placeLabel && <> <span className="ml-0.5 text-xs font-normal text-muted-foreground">({p.placeLabel})</span></>}
              </TableRowHeader>
              <TableCell className="px-2 py-1.5 text-right font-mono text-muted-foreground">{p.rating ?? 'Unr.'}</TableCell>
              {roundList.map((r) => {
                const game = games.find((g) => g.round === r && (g.white_member_id === p.member_id || g.black_member_id === p.member_id))
                const c = cellFor(game, p.member_id, num)
                return (
                  <TableCell key={r} className="px-2 py-1 text-center">
                    <ResultCell code={c.code} opponent={c.opp} color={c.color === 'w' ? 'white' : c.color === 'b' ? 'black' : null} />
                  </TableCell>
                )
              })}
              <TableCell className="px-2 py-1.5 text-center font-mono font-semibold text-ink">{formatScore(p.score)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ResultLegend />
    </div>
  )
}
