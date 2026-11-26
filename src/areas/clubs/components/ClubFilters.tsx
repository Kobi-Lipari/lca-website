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
//
// On a phone (WS09 step 35, `sheet`), the same choices are a sheet of their
// own along the window's foot, drawn as the site's dialog: named "Filters",
// the focus kept inside it, with a Close of its own, and Escape, Close and
// Done each closing it with the focus back on the Filters button. It sits
// over the page but never over the site's dock at the window's foot.
//
// When the window crosses the wide layout's width while the choices are open
// (a tablet turned, a window zoomed), they close: a panel half in the page and
// a sheet that holds the focus are not one thing to carry across. The Filters
// button stays the same button, and the focus goes to it when it was in the
// choices; when it was anywhere else (the wide panel stays open while the
// visitor types in the field), it stays where it was.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'

import { NO_FILTERS, regionChoices, type DirectoryFilters, type FilteredClub } from '@domain/clubs/order'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FilterChip } from '@/components/ui/filter-chip'
import { CLEAR, CLOSE, DONE, FILTERS_TITLE, OWN_WORD, REGION, SCHOLASTIC, WEEKENDS, filtersButton } from '@/areas/clubs/directoryWords'
import { cn } from '@/lib/utils'

/** How many filters are on: the region and each tick. */
function filtersOn(filters: DirectoryFilters): number {
  return (filters.region === null ? 0 : 1) + (filters.weekends ? 1 : 0) + (filters.scholastic ? 1 : 0)
}

const BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-sm font-semibold text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus'

/**
 * The Filters sheet's box: the full width along the window's foot, above the
 * dock (whose height the dock writes; unset where there is none), with its
 * top corners rounded, scrolling inside when it is taller than the room. It
 * rises straight up, with none of the centred dialog's sideways slide or zoom.
 */
const SHEET_BOX = cn(
  'inset-x-0 top-auto bottom-[var(--bottom-chrome-h,0px)] left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto overflow-x-hidden rounded-t-xl rounded-b-none border-hairline bg-surface p-0 text-ink',
  // Drawn below 1024 pixels alone, so the motion is set for those widths, as the media query puts it after the dialog's own.
  'max-lg:data-[state=open]:slide-in-from-left-0 max-lg:data-[state=open]:slide-in-from-top-0 max-lg:data-[state=open]:zoom-in-100 max-lg:data-[state=open]:slide-in-from-bottom',
  'max-lg:data-[state=closed]:slide-out-to-left-0 max-lg:data-[state=closed]:slide-out-to-top-0 max-lg:data-[state=closed]:zoom-out-100 max-lg:data-[state=closed]:slide-out-to-bottom',
)

export function ClubFilters({ clubs, filters, onChange, sheet = false }: {
  clubs: ReadonlyArray<FilteredClub>
  filters: DirectoryFilters
  onChange: (filters: DirectoryFilters) => void
  /** Draws the choices as a sheet of their own, as on a phone. */
  sheet?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  // A crossing of the width while open closes the choices, and the focus goes back to the Filters button once it is drawn
  // when it went with them; focus anywhere else on the page is left where it is.
  const [sheetBefore, setSheetBefore] = useState(sheet)
  const [closedByCrossing, setClosedByCrossing] = useState(0)
  if (sheetBefore !== sheet) {
    setSheetBefore(sheet)
    if (open) {
      setOpen(false)
      setClosedByCrossing((n) => n + 1)
    }
  }
  useEffect(() => {
    const active = document.activeElement
    if (closedByCrossing > 0 && (active === null || active === document.body)) button.current?.focus()
  }, [closedByCrossing])
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

  const choices = (
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
  )

  const trigger = (
    <button
      ref={button}
      type="button"
      aria-expanded={open}
      aria-controls={sheet ? undefined : id}
      aria-haspopup={sheet ? 'dialog' : undefined}
      onClick={() => setOpen((now) => !now)}
      className={cn(BUTTON, 'ml-auto')}
    >
      {filtersButton(filtersOn(filters))}
      <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', open && !sheet && 'rotate-180')} aria-hidden="true" />
    </button>
  )

  if (sheet) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={(next) => { if (!next) setOpen(false) }}>
          <DialogContent
            hideClose
            aria-describedby={undefined}
            data-slot="club-filters"
            className={SHEET_BOX}
            // The focus goes back to the Filters button, however the sheet was closed.
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              button.current?.focus()
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 pt-3 pb-2">
              <DialogTitle className="text-lg font-bold text-ink">{FILTERS_TITLE}</DialogTitle>
              <DialogClose className={cn(BUTTON, '-mr-1 shrink-0')}>{CLOSE}</DialogClose>
            </div>
            <div className="px-4 pt-3 pb-4">{choices}</div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <>
      {trigger}
      <div id={id} hidden={!open} onKeyDown={keyDown} data-slot="club-filters" className="w-full basis-full rounded-lg border border-hairline bg-card p-3">
        {open && choices}
      </div>
    </>
  )
}
