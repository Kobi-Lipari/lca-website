// src/components/tournaments/StandingsTable.tsx
//
// One section's standings: place (shared on a full tie), score, W-D-L and
// the US Chess tiebreaks that ordered it. Used on the director's Standings
// tab and the public pairings page, so both always agree.
import type { ApiStanding } from '@/lib/api'
import { cn } from '@/lib/utils'

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1))

const TIEBREAKS: Array<{ key: keyof ApiStanding['tiebreaks']; short: string; long: string }> = [
  { key: 'modifiedMedian', short: 'MM', long: 'Modified Median' },
  { key: 'solkoff', short: 'Solk', long: 'Solkoff' },
  { key: 'cumulative', short: 'Cum', long: 'Cumulative' },
  { key: 'oppCumulative', short: 'OppC', long: "Opponents' Cumulative" },
]

export function StandingsTable({ standings, sectionName, showHeading = true }: {
  standings: ApiStanding[]
  sectionName: string
  showHeading?: boolean
}) {
  // Server order is authoritative: score, then tiebreaks.
  const rows = standings.filter((s) => s.section === sectionName)
  if (rows.length === 0) return null

  return (
    <div className="mb-6 break-inside-avoid">
      {showHeading && <h3 className="mb-3 text-base font-semibold text-lca-navy">{sectionName}</h3>}
      <div className="overflow-x-auto rounded-xl border print:overflow-visible">
        <table className="w-full min-w-[560px] text-left text-sm tabular-nums">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2.5 font-semibold text-lca-navy">Place</th>
              <th className="px-3 py-2.5 font-semibold text-lca-navy">Player</th>
              <th className="px-3 py-2.5 text-right font-semibold text-lca-navy">Rating</th>
              <th className="px-3 py-2.5 text-center font-semibold text-lca-navy">Pts</th>
              <th className="px-3 py-2.5 text-center font-semibold text-lca-navy">W-D-L</th>
              {TIEBREAKS.map((t) => (
                <th key={t.key} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground" title={t.long}>
                  {t.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.member_id} className={cn('border-b last:border-0', p.place === 1 && 'bg-lca-gold/5')}>
                <td className={cn('px-3 py-2 font-medium', p.place === 1 ? 'text-lca-navy' : 'text-muted-foreground')}>
                  {p.placeLabel ?? p.place}
                </td>
                <td className="px-3 py-2 font-medium text-lca-navy">{p.full_name}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{p.rating ?? 'Unr.'}</td>
                <td className="px-3 py-2 text-center font-semibold text-lca-navy">{fmt(p.score)}</td>
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
