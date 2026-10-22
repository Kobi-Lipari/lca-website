// src/areas/live/components/StandingsTable.tsx
//
// One section's standings: place (shared on a full tie), score, W-D-L and
// the US Chess tiebreaks that ordered it. Used on the director's Standings
// tab and the public pairings page, so both always agree.
//
// Under the new look (newLook) scores and tiebreaks are written with ½,
// figures are in the monospace face, the player's name is the row's header,
// and the place and the name stay in view while the other columns scroll
// sideways. With newLook off the table is today's, its header cells marked
// scope="col".
import type { ApiStanding } from '@/lib/api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableRowHeader } from '@/components/ui/table'
import { FEATURES } from '@/lib/features'
import { formatScore } from '@/lib/format'
import { cn } from '@/lib/utils'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))

const TIEBREAKS: Array<{ key: keyof ApiStanding['tiebreaks']; short: string; long: string }> = [
  { key: 'modifiedMedian', short: 'MM', long: 'Modified Median' },
  { key: 'solkoff', short: 'Solk', long: 'Solkoff' },
  { key: 'cumulative', short: 'Cum', long: 'Cumulative' },
  { key: 'oppCumulative', short: 'OppC', long: "Opponents' Cumulative" },
]

interface StandingsTableProps {
  standings: ApiStanding[]
  sectionName: string
  showHeading?: boolean
}

export function StandingsTable(props: StandingsTableProps) {
  return FEATURES.newLook ? <NewStandingsTable {...props} /> : <TodaysStandingsTable {...props} />
}

/** The standings as they were before the new look, their header cells marked scope="col". */
function TodaysStandingsTable({ standings, sectionName, showHeading = true }: StandingsTableProps) {
  // Server order is authoritative: score, then tiebreaks.
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-ink">{sectionName}</h3>}
      <div className="overflow-x-auto rounded-xl border print:overflow-visible">
        <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="px-3 py-2.5 font-semibold text-ink">Place</th>
              <th scope="col" className="px-3 py-2.5 font-semibold text-ink">Player</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold text-ink">Rating</th>
              <th scope="col" className="px-3 py-2.5 text-center font-semibold text-ink">Pts</th>
              <th scope="col" className="px-3 py-2.5 text-center font-semibold text-ink">W-D-L</th>
              {TIEBREAKS.map((t) => (
                <th key={t.key} scope="col" className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title={t.long}>
                  {t.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.member_id} className={cn('border-b last:border-0', p.place === 1 && 'bg-lca-gold/5')}>
                <td className={cn('px-3 py-2 font-medium', p.place === 1 ? 'text-ink' : 'text-muted-foreground')}>
                  {p.placeLabel ?? p.place}
                </td>
                <td className="px-3 py-2 font-medium text-ink">{p.full_name}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{p.rating ?? 'Unr.'}</td>
                <td className="px-3 py-2 text-center font-semibold text-ink">{fmt(p.score)}</td>
                <td className="px-3 py-2 text-center text-muted-foreground">{p.wins}-{p.draws}-{p.losses}</td>
                {TIEBREAKS.map((t) => (
                  <td key={t.key} className="px-2 py-2 text-center text-xs text-muted-foreground">
                    {p.tiebreaks ? fmt(p.tiebreaks[t.key]) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Ties broken by US Chess tiebreaks in order: {TIEBREAKS.map((t) => t.long).join(', ')}, then most games with Black.
      </p>
    </div>
  )
}

/** The header row's tint, today's bg-muted/50, through --row-tint so the pinned cells take it too. */
const HEAD_TINT = '[--row-tint:color-mix(in_oklab,var(--muted)_50%,transparent)]'
/** First place's tint, today's bg-lca-gold/5, the same way. */
const FIRST_TINT = '[--row-tint:color-mix(in_oklab,var(--color-lca-gold)_5%,transparent)]'
/** A header cell, sized as today's. */
const HEAD = 'h-auto py-2.5 font-semibold text-ink'

/**
 * The standings under the new look, drawn through the table primitives: the
 * place and the name pinned, the name the row's header, scores and
 * tiebreaks with ½ in the monospace face. A missing tiebreak is a plain
 * hyphen, which a screen reader hears as "none yet". The box is a named
 * region in the tab order, so the keyboard can scroll the columns on a phone.
 */
function NewStandingsTable({ standings, sectionName, showHeading = true }: StandingsTableProps) {
  // Server order is authoritative: score, then tiebreaks.
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-ink">{sectionName}</h3>}
      <Table
        label={`${sectionName} standings`}
        stickyFirst={2}
        containerClassName="rounded-xl border bg-surface print:overflow-visible"
        className="min-w-[560px] text-left text-sm tabular-nums"
      >
        <TableHeader>
          <TableRow className={HEAD_TINT}>
            <TableHead className={cn(HEAD, 'px-3')}>Place</TableHead>
            <TableHead className={cn(HEAD, 'px-3')}>Player</TableHead>
            <TableHead className={cn(HEAD, 'px-3 text-right')}>Rating</TableHead>
            <TableHead className={cn(HEAD, 'px-3 text-center')}>Pts</TableHead>
            <TableHead className={cn(HEAD, 'px-3 text-center')}>W-D-L</TableHead>
            {TIEBREAKS.map((t) => (
              <TableHead key={t.key} className={cn(HEAD, 'px-2 text-center text-xs text-muted-foreground')} title={t.long}>
                {t.short}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.member_id} className={cn(p.place === 1 && FIRST_TINT)}>
              <TableCell className={cn('px-3 py-2 font-medium', p.place === 1 ? 'text-ink' : 'text-muted-foreground')}>
                {p.placeLabel ?? p.place}
              </TableCell>
              <TableRowHeader className="px-3 py-2 font-medium text-ink">{p.full_name}</TableRowHeader>
              <TableCell className="px-3 py-2 text-right font-mono text-muted-foreground">{p.rating ?? 'Unr.'}</TableCell>
              <TableCell className="px-3 py-2 text-center font-mono font-semibold text-ink">{formatScore(p.score)}</TableCell>
              <TableCell className="px-3 py-2 text-center font-mono text-muted-foreground">{p.wins}-{p.draws}-{p.losses}</TableCell>
              {TIEBREAKS.map((t) => (
                <TableCell key={t.key} className="px-2 py-2 text-center font-mono text-xs text-muted-foreground">
                  {p.tiebreaks ? formatScore(p.tiebreaks[t.key]) : <><span aria-hidden="true">-</span><span className="sr-only">none yet</span></>}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Ties broken by US Chess tiebreaks in order: {TIEBREAKS.map((t) => t.long).join(', ')}, then most games with Black.
      </p>
    </div>
  )
}
