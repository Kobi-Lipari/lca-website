// src/components/DateBlock.tsx
//
// A date as a block, for the rows of a list and the heroes (the date tile of
// the decided boards: Tourn-List-Final, Home-Final): the weekday, the day and
// the month stacked in a box, inside a <time> whose dateTime is the calendar
// day, so a machine reads the same date a person does.
//
// The words are formatDate's ("Sat, Oct 24"), which puts the weekday on every
// date. A screen reader hears them once, in that order; the stacked parts are
// for the eye and hidden from it. formatDate reads a bare date or a Louisiana
// wall-clock time as written and turns an instant into Central time first,
// and dateTime comes from the same reading (zonedParts), so the two always
// name the same day, and a valid date string ("2026-10-24") whatever the
// input was. A value that cannot be read shows as given, outside a <time>; no
// value shows nothing.
import { zonedParts, type DateInput, type StoredAs } from '@domain/format/date'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DateBlockProps {
  /** The date: a stored date or time string, epoch milliseconds or a Date. */
  value: DateInput | null | undefined
  /** Add the year ("Sat, Oct 24, 2026"), shown under the month. */
  year?: boolean
  /** 'utc' for a column SQLite fills with datetime('now'); see domain/format/date.ts. */
  stored?: StoredAs
  className?: string
}

/** formatDate's words in their parts: weekday, month, day and the year when asked for. */
const PARTS = /^([A-Z][a-z]{2}), ([A-Z][a-z]{2}) (\d{1,2})(?:, (\d+))?$/

/** The Central calendar day of a value as YYYY-MM-DD, or null when it cannot be read. */
function calendarDay(value: DateInput, stored: StoredAs | undefined): string | null {
  const p = zonedParts(value, { stored })
  if (!p) return null
  const two = (n: number) => String(n).padStart(2, '0')
  return `${String(p.year).padStart(4, '0')}-${two(p.month)}-${two(p.day)}`
}

export function DateBlock({ value, year = false, stored, className }: DateBlockProps) {
  if (value === null || value === undefined || value === '') return null
  const words = formatDate(value, { year, stored })
  const day = calendarDay(value, stored)
  if (!day) return <span className={className}>{words}</span>
  const parts = PARTS.exec(words)
  if (!parts) return <time dateTime={day} className={className}>{words}</time>

  const small = 'text-xs font-semibold tracking-wider text-ink-muted uppercase'
  return (
    <time
      dateTime={day}
      data-slot="date-block"
      className={cn(
        'inline-flex min-h-16 w-16 flex-none flex-col items-center justify-center gap-1 rounded-lg border border-hairline bg-surface px-0.5 py-2 text-center leading-none text-ink',
        className,
      )}
    >
      <span className="sr-only">{words}</span>
      <span aria-hidden="true" className={small}>{parts[1]}</span>
      <span aria-hidden="true" className="text-xl font-bold tabular-nums">{parts[3]}</span>
      <span aria-hidden="true" className={small}>{parts[2]}</span>
      {parts[4] && <span aria-hidden="true" className="text-xs text-ink-muted tabular-nums">{parts[4]}</span>}
    </time>
  )
}
