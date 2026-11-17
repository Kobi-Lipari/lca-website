// src/areas/clubs/components/ClubEventsList.tsx
//
// A club's events on its page in My region (WS09 step 12): the events the
// club's answer gives this person, GET /api/admin/clubs/[id]'s
// `tournaments`, as a list. Each shows its name, its full date with its
// weekday and year through the site's own date helper ("Sat, Dec 5, 2026"),
// and its state in words: Upcoming, Under way or Finished, whether
// registration is open or closed, and Draft, not public for an event still
// hidden. No state rests on a colour.
//
// Each event links only to a page this person may open, which the page that
// draws the list decides: the event's manage page for a person who may manage
// it, its public page for a listed event otherwise, and no link for a hidden
// draft the person may not manage. A person a regional seat alone admits is
// given the listed events alone by the server, so a draft never reaches them.
// Adding a club event comes with a later step.
import { Link } from 'react-router-dom'
import { EyeOff, Trophy } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ApiAdminClubTournament } from '@/lib/api'
import { formatDate } from '@/lib/format'

/** Where an event's row may lead this person: its manage page, its public page, or nowhere. */
export type EventLink = 'manage' | 'public' | null

/** An event's state in words. */
function stateWords(status: string): string {
  if (status === 'upcoming') return 'Upcoming'
  if (status === 'active') return 'Under way'
  if (status === 'completed') return 'Finished'
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'No state given'
}

/** Its registration in words, when the event has opened or closed it. */
function registrationWords(registration: string | null): string | null {
  if (registration === 'open') return 'Registration open'
  if (registration === 'closed') return 'Registration closed'
  return null
}

/** Its date with the weekday and year, and the last day too for an event of more than one day. */
function eventDateWords(event: Pick<ApiAdminClubTournament, 'date' | 'end_date'>): string {
  const first = formatDate(event.date, { year: true })
  if (!event.end_date || event.end_date === event.date) return first
  return `${first} to ${formatDate(event.end_date, { year: true })}`
}

/** A link on the list: 44px tall, with the site's focus ring. */
const ROW_LINK = 'min-h-11 px-4 whitespace-normal'

export function ClubEventsList({ clubName, events, linkOf, draftsKeptBack }: {
  clubName: string
  events: ApiAdminClubTournament[]
  /** Where each event may lead this person. */
  linkOf: (event: ApiAdminClubTournament) => EventLink
  /** The server gives this person the listed events alone. */
  draftsKeptBack: boolean
}) {
  return (
    <section aria-labelledby="club-events-title" className="space-y-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="club-events-title" className="text-lg font-semibold text-ink">Events</h2>
        {events.length > 0 && <p className="text-sm text-muted-foreground">{events.length === 1 ? '1 event' : `${events.length} events`}</p>}
      </div>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium text-ink">No events are listed for {clubName} yet.</p>
          {draftsKeptBack && <p className="mt-1 text-sm text-muted-foreground">Drafts stay with LCA admins and the club's own rep.</p>}
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => {
            const link = linkOf(event)
            const registration = registrationWords(event.registration_status)
            return (
              <li key={event.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium text-ink">{event.name}</p>
                  <p className="break-words text-sm text-ink">{eventDateWords(event)}</p>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                    <span>{registration ? `${stateWords(event.status)} · ${registration}` : stateWords(event.status)}</span>
                    {event.is_visible === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-xs text-ink">
                        <EyeOff className="size-3" aria-hidden="true" /> Draft, not public
                      </span>
                    )}
                  </p>
                </div>
                {link === 'manage' && (
                  <Button asChild variant="outline" className={ROW_LINK}>
                    <Link to={`/admin/tournaments/${encodeURIComponent(event.id)}`} aria-label={`Manage: ${event.name}`}>Manage</Link>
                  </Button>
                )}
                {link === 'public' && (
                  <Button asChild variant="outline" className={ROW_LINK}>
                    <Link to={`/tournaments/${encodeURIComponent(event.id)}`} aria-label={`Event page: ${event.name}`}>Event page</Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
