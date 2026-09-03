import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

interface MiniCalendarProps {
  year: number
  month: number // 0-indexed
  eventDays: Set<number>
  selectedDay: number | null
  onPrev: () => void
  onNext: () => void
  onSelectDay: (day: number) => void
}

export function MiniCalendar({
  year, month, eventDays, selectedDay, onPrev, onNext, onSelectDay,
}: MiniCalendarProps) {
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="rounded p-1 hover:bg-muted/50"
        >
          <ChevronLeft className="size-3.5 text-muted-foreground" />
        </button>
        <h3 className="text-xs font-semibold text-lca-navy">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="rounded p-1 hover:bg-muted/50"
        >
          <ChevronRight className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const hasEvent = eventDays.has(day)
          const isToday = isCurrentMonth && today.getDate() === day
          const isSelected = selectedDay === day
          return (
            <button
              key={day}
              type="button"
              disabled={!hasEvent}
              onClick={() => onSelectDay(day)}
              className={cn(
                'mx-auto flex size-6 items-center justify-center rounded-full text-[10px] transition-colors',
                !hasEvent && 'cursor-default text-muted-foreground/50',
                hasEvent && !isSelected && 'font-medium text-lca-navy bg-lca-gold/25 hover:bg-lca-gold/40',
                isSelected && 'bg-lca-navy font-semibold text-white',
                isToday && !isSelected && 'ring-1 ring-lca-gold',
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
    </div>
  )
}
