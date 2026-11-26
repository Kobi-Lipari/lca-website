// src/areas/clubs/components/ClubCard.tsx
//
// One club in the Clubs directory's list (WS09 step 33): the whole card is
// one link to the club's page at its short address, and nothing else in it
// can be pressed. At most three lines: the club's name and town (and "about
// N mi" once the page knows a place, which step 34 passes), then how the club
// meets in its own words, held to two lines, or, for a club with none,
// "Schedule not listed · Know when they meet? Suggest an update" as plain
// words and the club's description in grey, as the list's answer gives it.
// The words "Suggest an update" are not a link: the form opens from the
// club's page. No colour of the club's, logo, initials, keeper or address.
// The pointer over the card or the focus on it lifts its pin on the map.
import { Link } from 'react-router-dom'

import { plainText } from '@domain/clubs/pageMeta'
import { THIN_CARD } from '@/areas/clubs/directoryWords'
import { cn } from '@/lib/utils'

/** What the card reads of a club in the directory's answer. */
export interface CardClub {
  id: string
  slug: string
  name: string
  city: string | null
  statement: string | null
  description: string | null
}

export function ClubCard({ club, distance, selected = false, onLift }: {
  club: CardClub
  /** "about 12 mi", once the page knows a place; drawn after the town. */
  distance?: string | null
  /** The club's pin is the one pressed on the map. */
  selected?: boolean
  /** The card has the pointer over it or the focus (its id), or has lost them (null). */
  onLift?: (id: string | null) => void
}) {
  const name = plainText(club.name)
  const town = plainText(club.city)
  const meets = plainText(club.statement)
  const said = plainText(club.description)
  const line = [town, distance ?? ''].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/clubs/${encodeURIComponent(club.slug)}`}
      data-card={club.id}
      data-selected={selected ? 'true' : undefined}
      onMouseEnter={() => onLift?.(club.id)}
      onMouseLeave={() => onLift?.(null)}
      onFocus={() => onLift?.(club.id)}
      onBlur={() => onLift?.(null)}
      className={cn(
        'group block space-y-1 rounded-lg border border-hairline bg-card p-3 text-sm text-ink outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-focus',
        selected && 'border-2 border-ink',
      )}
    >
      <span className="block break-words">
        <span className="font-semibold underline-offset-2 group-hover:underline">{name}</span>
        {line ? ` · ${line}` : ''}
      </span>
      {meets ? (
        <span className="line-clamp-2 block break-words">{meets}</span>
      ) : (
        <>
          <span className="block">{THIN_CARD}</span>
          {said && <span className="line-clamp-1 block break-words text-muted-foreground">{said}</span>}
        </>
      )}
    </Link>
  )
}
