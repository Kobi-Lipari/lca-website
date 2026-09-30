// src/components/tournaments/PrizeWinners.tsx
//
// Prize winners for one section, as the server works them out (cash split
// by score among ties, one cash prize per player, items by tiebreaks).
import { Trophy } from 'lucide-react'

import type { ApiPrizeAward, ApiStanding } from '@/lib/api'

const money = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`

export function PrizeWinners({ prizes, standings, sectionName, note }: {
  prizes: ApiPrizeAward[]
  standings: ApiStanding[]
  sectionName: string
  note?: string
}) {
  const rows = prizes.filter((p) => p.section === sectionName && (p.cash > 0 || p.items.length > 0))
  if (rows.length === 0) return null
  const name = new Map(standings.map((s) => [s.member_id, s.full_name]))
  const total = rows.reduce((a, r) => a + r.cash, 0)
  return (
    <div className="mb-6 rounded-xl border border-lca-gold/40 bg-lca-gold/5 p-4 break-inside-avoid">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-lca-navy">
        <Trophy className="size-4 text-lca-gold" /> Prize winners · {sectionName}
      </p>
      <ul className="divide-y divide-lca-gold/20 text-sm">
        {rows.map((r) => (
          <li key={r.member_id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5">
            <span>
              <span className="font-medium text-lca-navy">{name.get(r.member_id) ?? 'Player'}</span>
              <span className="ml-2 text-xs text-muted-foreground">{r.prize}</span>
            </span>
            <span className="tabular-nums text-lca-navy">
              {r.cash > 0 && <span className="font-semibold">{money(r.cash)}</span>}
              {r.items.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{r.items.join(', ')}</span>}
            </span>
          </li>
        ))}
      </ul>
      {total > 0 && <p className="mt-2 text-xs text-muted-foreground">Cash paid out: {money(Math.round(total * 100) / 100)}</p>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
