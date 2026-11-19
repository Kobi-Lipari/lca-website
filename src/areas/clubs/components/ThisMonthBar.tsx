// src/areas/clubs/components/ThisMonthBar.tsx
//
// My region's This month bar (WS09 step 11), as the board Work-H draws it:
// "This month · Next monthly check due Mon, Dec 7, 2026 · 3 of 5 checked
// in the last 90 days · 2 not checked in 90 days", with Confirm all still
// accurate at its end while any club needs a check. The date and its weekday
// come from the server as words, and the counts are the server's, moved by
// the page as clubs are marked, so the bar makes no date. With regionEvents
// on (WS09 step 19) the events in LCA review join it, "1 event in review" or
// "2 events in review", from the server's count, sent only while
// REGION_EVENTS_ON is set, and only when there is one; the board's reports
// join it once a later step gives them their rows. Below the width where the bar sits on one line (lg, 1024px),
// the parts stand one under another with no dot, so no line starts with a
// separator; from that width up they read in one line, dots between. The
// dots are never read aloud.
//
// Confirm all asks one plain question first, in a dialog built from the
// site's own dialog parts (src/components/ui/dialog.tsx, which the scanner
// and Donate use): it names how many clubs it marks, and Cancel or Escape
// leaves everything as it was. The dialog's own buttons are 44px tall, so
// its content is drawn here rather than with the small corner close.
//
// The page gives the bar two small question marks (RegionHelp.tsx): one
// after the heading, for the monthly check and the 90 days, and one after
// Confirm all still accurate, drawn only while that button is. Each bubble
// lies across the bar, under the mark's line.
import type { ReactNode, Ref } from 'react'
import { useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { clubsWord } from '@/areas/clubs/region'
import { regionEventsOn } from '@/areas/clubs/switches'
import type { WorkspaceRegionResponse } from '@domain/contracts'

const CONTROL = 'min-h-11 px-4 whitespace-normal'

export function ThisMonthBar({ thisMonth, hasClubs, toConfirm, running, onConfirmAll, headingRef, help, confirmHelp }: {
  thisMonth: WorkspaceRegionResponse['thisMonth']
  /** The page has any club; with none the bar names the next check alone. */
  hasClubs: boolean
  /** How many clubs Confirm all would mark: each that needs a check, has no open item and is not already on its way. */
  toConfirm: number
  /** A run of Confirm all is on the way. */
  running: boolean
  onConfirmAll: () => void
  headingRef?: Ref<HTMLHeadingElement>
  /** The mark after the heading. */
  help?: ReactNode
  /** The mark after Confirm all still accurate, drawn only with it. */
  confirmHelp?: ReactNode
}) {
  const [asking, setAsking] = useState(false)
  const total = thisMonth.checked + thisMonth.notChecked
  const parts = [
    `Next monthly check due ${thisMonth.nextCheck.date}`,
    ...(hasClubs ? [`${thisMonth.checked} of ${total} checked in the last 90 days`, `${thisMonth.notChecked} not checked in 90 days`] : []),
    ...(regionEventsOn() && (thisMonth.inReview ?? 0) > 0 ? [thisMonth.inReview === 1 ? '1 event in review' : `${thisMonth.inReview} events in review`] : []),
  ]
  return (
    <section aria-labelledby="this-month-title" className="relative flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex min-w-0 flex-col gap-y-1 text-sm text-ink lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-1.5">
        <div className="flex items-baseline">
          <h2 id="this-month-title" ref={headingRef} tabIndex={-1} className="text-sm font-semibold outline-none">This month</h2>
          {help}
        </div>
        {parts.map((part) => (
          <p key={part} className="min-w-0 break-words"><span aria-hidden="true" className="hidden lg:inline">· </span>{part}</p>
        ))}
      </div>
      <Dialog open={asking && toConfirm > 0} onOpenChange={setAsking}>
        {/* The dialog's trigger, so Cancel and Escape put the focus back on it. It stays while a run is on its way, so the focus on it is not lost mid-run. */}
        {(toConfirm > 0 || running) && (
          <div className="flex items-center">
            <DialogTrigger asChild>
              <Button
                type="button"
                className={CONTROL}
                aria-disabled={running || undefined}
                onClick={(e) => { if (running) e.preventDefault() }}
              >
                Confirm all still accurate
              </Button>
            </DialogTrigger>
            {confirmHelp}
          </div>
        )}
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-background p-6 text-ink shadow-lg outline-none"
          >
            <DialogTitle className="break-words text-lg font-semibold leading-snug">Mark {clubsWord(toConfirm)} still accurate?</DialogTitle>
            <DialogDescription className="break-words text-sm text-ink">
              {toConfirm === 1 ? 'The club that needs a check gets this month\'s stamp.' : `Each of the ${toConfirm} clubs that need a check gets this month's stamp, one after another.`}
            </DialogDescription>
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className={CONTROL}>Cancel</Button>
              </DialogClose>
              <Button type="button" className={CONTROL} onClick={() => { setAsking(false); onConfirmAll() }}>
                Mark {clubsWord(toConfirm)}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </section>
  )
}
