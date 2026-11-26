// src/areas/clubs/components/ClubFilters.tsx
//
// The Clubs directory's filters (WS09 step 34): a panel under the Filters
// button, which says whether it is open (aria-expanded) and how many filters
// are on ("Filters · 2 on"), so a visitor knows a filter is on even while a
// typed name has the caption.
//   - Region: each of REGIONS (five, by K's decision 14) that has a club,
//     with its count, counted from the clubs given, never typed. One region
//     at a time; a second press lets it go.
//   - Under "Only clubs that say so themselves", the two ticks "Plays on
//     weekends" and "Scholastic friendly", each with its count, which pass
//     only a club that says so on its own page.
//   - "Clear", which takes every filter off, and "Done", which closes the
//     panel and gives the focus back to the button. Escape closes it too.
// Each choice is one of the site's own filter chips, whose state is told by
// aria-pressed and a check mark, never by colour alone. The page keeps the
// filters in its address; this panel only offers them.
import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'

import { NO_FILTERS, regionChoices, type DirectoryFilters, type FilteredClub } from '@domain/clubs/order'
import { FilterChip } from '@/components/ui/filter-chip'
import { CLEAR, DONE, OWN_WORD, REGION, SCHOLASTIC, WEEKENDS, filtersButton } from '@/areas/clubs/directoryWords'
import { cn } from '@/lib/utils'

/** How many filters are on: the region and each tick. */
function filtersOn(filters: DirectoryFilters): number {
  return (filters.region === null ? 0 : 1) + (filters.weekends ? 1 : 0) + (filters.scholastic ? 1 : 0)
}

const BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-sm font-semibold text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus'

export function ClubFilters({ clubs, filters, onChange }: {
  clubs: ReadonlyArray<FilteredClub>
  filters: DirectoryFilters
  onChange: (filters: DirectoryFilters) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  // The regions that have a club, and a region chosen by the address that has none, so its chip can be let go.
  const regions = regionChoices(clubs).filter((choice) => choice.count > 0 || choice.region === filters.region)
  const weekends = clubs.filter((club) => club.weekend_play).length
  const scholastic = clubs.filter((club) => club.scholastic_friendly).length

  function close() {
    setOpen(false)
    button.current?.focus()
  }
  function keyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((now) => !now)}
        className={cn(BUTTON, 'ml-auto')}
      >
        {filtersButton(filtersOn(filters))}
        <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} onKeyDown={keyDown} data-slot="club-filters" className="w-full basis-full rounded-lg border border-hairline bg-card p-3">
        {open && (
          <>
            <fieldset>
              <legend className="text-sm font-semibold text-ink">{REGION}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {regions.map(({ region, count }) => (
                  <FilterChip
                    key={region}
                    label={region}
                    count={count}
                    pressed={filters.region === region}
                    onPressedChange={(on) => onChange({ ...filters, region: on ? region : null })}
                    className="max-w-full"
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold text-ink">{OWN_WORD}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <FilterChip label={WEEKENDS} count={weekends} pressed={filters.weekends} onPressedChange={(on) => onChange({ ...filters, weekends: on })} />
                <FilterChip label={SCHOLASTIC} count={scholastic} pressed={filters.scholastic} onPressedChange={(on) => onChange({ ...filters, scholastic: on })} />
              </div>
            </fieldset>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => onChange(NO_FILTERS)} className={BUTTON}>{CLEAR}</button>
              <button type="button" onClick={close} className={BUTTON}>{DONE}</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}
