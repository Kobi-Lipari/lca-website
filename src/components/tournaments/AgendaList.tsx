import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import type { UnifiedTournament } from '@/lib/clearinghouse'
import { LCA } from '@/lib/brand'

const LCA_GOLD = LCA.gold

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

interface AgendaListProps {
  tournaments: UnifiedTournament[]
  selectedKey: string | null
  onSelect: (t: UnifiedTournament) => void
}

export function AgendaList({ tournaments, selectedKey, onSelect }: AgendaListProps) {
  if (tournaments.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-xs text-muted-foreground">
        No tournaments match the current filters.
      </p>
    )
  }

  const sorted = [...tournaments].sort((a, b) =>
    (a.start_date ?? '').localeCompare(b.start_date ?? ''),
  )

  let lastMonthKey = ''

  return (
    <div className="max-h-[420px] overflow-y-auto">
      {sorted.map(t => {
        const start = new Date(t.start_date + 'T00:00:00')
        const monthKey = isNaN(start.getTime()) ? '' : `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
        const showMonthHeader = monthKey !== lastMonthKey
        lastMonthKey = monthKey
        const key = `${t.source}-${t.id}`
        const isSelected = key === selectedKey
        const color = t.is_lca === 1 ? (t.club_color || LCA_GOLD) : '#94a3b8'
        const dayNum = isNaN(start.getTime()) ? '' : start.getDate()
        const dayName = isNaN(start.getTime()) ? '' : start.toLocaleDateString('en-US', { weekday: 'short' })

        return (
          <Fragment key={key}>
            {showMonthHeader && (
              <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                {monthKey}
              </div>
            )}
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                'flex w-full items-start gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30',
                isSelected && 'border-l-2 border-l-lca-gold bg-lca-gold/5 pl-[10px]',
              )}
            >
              <div className="w-9 flex-shrink-0 text-center">
                <div className="text-base font-semibold leading-none text-lca-navy">{dayNum}</div>
                <div className="mt-0.5 text-[9px] uppercase text-muted-foreground">{dayName}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <p className="truncate text-[13px] font-medium text-foreground">{t.name}</p>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {t.city ?? ''}
                  {t.entry_fee != null ? ` · $${t.entry_fee}` : ''}
                </p>
              </div>
              {t.is_lca === 1 && t.registration_status === 'open' && (
                <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                  Open
                </span>
              )}
              {t.is_lca === 0 && (
                <span className="flex-shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Ext
                </span>
              )}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
