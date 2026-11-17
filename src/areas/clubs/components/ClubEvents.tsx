// src/areas/clubs/components/ClubEvents.tsx
//
// The new club page's Events (WS09 step 22): the club's listed events, in
// the answer's order, each with its date as a block, its full date with the
// weekday and year (both ends for an event of more than one day), its name,
// its state in words through StatusBadge beside the tag's mark, and the
// count as the events pages word it. Register is offered where the events
// list offers it and leads to the event's own page on this site, as the
// event's name does. The answer carries no time of day, so the page writes
// no clock time. The page draws this section only when the answer names it
// and carries an event (drawnSections in src/areas/clubs/clubPage.ts), so
// it is never an empty block. Partner events and a calendar file have no
// part here: nothing links a partner event to a club, and no event has a
// calendar file yet.
import { Link } from 'react-router-dom'

import { DateBlock } from '@/components/DateBlock'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { CLEAR_OF_BARS, CONTROL, WORD_LINK } from '@/areas/clubs/clubPage'
import { eventAddress, eventCount, eventDates, eventState, offersRegister } from '@/areas/clubs/clubPageRows'
import { SectionHeading } from '@/areas/clubs/components/ClubAbout'
import type { ClubPageEvent } from '@domain/contracts'

function EventRow({ event }: { event: ClubPageEvent }) {
  const state = eventState(event)
  const count = eventCount(event)
  const address = eventAddress(event.id)
  return (
    <li data-slot="club-event" className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-hairline py-4 last:border-b-0 @3xl:grid-cols-[4rem_minmax(0,1fr)_auto]">
      {/* The block is for the eye; the date in words beside it is what a screen reader hears. */}
      <div aria-hidden="true">
        <DateBlock value={event.date} />
      </div>
      <div className="min-w-0 space-y-1">
        <h3 className="break-words text-lg font-semibold text-ink">
          <Link to={address} className={WORD_LINK}>{event.name}</Link>
        </h3>
        <p className="break-words text-sm font-semibold text-ink">{eventDates(event)}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
          <StatusBadge status={state.status} on="light">{state.words}</StatusBadge>
          {/* A space between the two, which the row's gap sets out for the eye, so they are read as two. */}
          {count && <>{' '}<span>{count}</span></>}
        </p>
      </div>
      {offersRegister(event) && (
        <div className="col-start-2 @3xl:col-start-3 @3xl:self-center">
          <Link to={address} aria-label={`Register for ${event.name}`} className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90')}>
            Register
          </Link>
        </div>
      )}
    </li>
  )
}

export function ClubEvents({ id, events }: { id: string; events: readonly ClubPageEvent[] }) {
  return (
    <section id={id} className={cn(CLEAR_OF_BARS, 'py-8')}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading compact={false}>Events</SectionHeading>
        <ul className="mt-2">
          {events.map((event) => <EventRow key={event.id} event={event} />)}
        </ul>
      </div>
    </section>
  )
}
