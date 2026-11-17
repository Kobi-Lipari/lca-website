// src/areas/clubs/components/WhenAndWhere.tsx
//
// The new club page's When and where (WS09 step 21): how the club meets,
// quoted in the club's own words, with the told line under it as the server
// words it ("As told by the club, updated November 2026", or "As told to
// LCA, November 2026" while it is what an LCA admin entered); then a map of
// the club's places, up to two, and a row for each place with the club's
// note for first-timers and Directions, which opens the place's point in the
// visitor's own maps app. The page works out no meeting date and draws no
// Tonight and no month of a check: the statement is the club's words and
// the told line is the server's, each drawn as given, and a time the club
// wrote stays as the club wrote it. A place with no point has its row and no
// Directions. The map is the page's to pass (ClubPage.tsx), so the editor's
// preview column, which draws this section from the form (compact), draws
// no map, no told line it cannot know, and no links.
import type { ReactNode } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CLEAR_OF_BARS, WORD_LINK, hasWords } from '@/areas/clubs/clubPage'
import { directionsUrl } from '@/areas/clubs/clubMap'
import { SectionHeading } from '@/areas/clubs/components/ClubAbout'
import type { ClubPageResponse } from '@domain/contracts'

type Place = ClubPageResponse['places'][number]

function PlaceRow({ place, compact }: { place: Place; compact: boolean }) {
  const point = typeof place.latitude === 'number' && typeof place.longitude === 'number' ? { lat: place.latitude, lng: place.longitude } : null
  return (
    <li className="flex gap-3 border-b border-hairline py-3 last:border-b-0">
      <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink" />
      <div className="min-w-0 space-y-0.5 break-words text-sm text-ink">
        <p className="text-base font-semibold">{place.name}</p>
        {hasWords(place.street) && <p>{place.street}</p>}
        {hasWords(place.note) && <p className="whitespace-pre-line">{place.note}</p>}
        {point && !compact && (
          <a href={directionsUrl(point)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${place.name} (opens in a new tab)`} className={WORD_LINK}>
            Directions
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          </a>
        )}
      </div>
    </li>
  )
}

export function WhenAndWhere({
  name, statement, told, places, map, compact = false, id,
}: {
  name: string
  /** How the club meets, in its own words. */
  statement: string | null
  /** The told line as the server words it; none in the preview. */
  told: string | null
  places: readonly Place[]
  /** The map of the places, which the page passes; none in the preview. */
  map?: ReactNode
  compact?: boolean
  /** The section's id, for the section nav; none in the preview. */
  id?: string
}) {
  const meets = statement?.trim() ? statement.trim() : null
  const label = 'How the club meets'
  return (
    <section id={id} className={cn('border-y border-hairline bg-surface-2', compact ? 'px-3 py-3' : cn(CLEAR_OF_BARS, 'py-8'))}>
      <div className={cn('mx-auto max-w-6xl', !compact && 'px-4 sm:px-6')}>
        <SectionHeading compact={compact}>{`When and where ${name} meets`}</SectionHeading>
        <div className={cn('mt-4 grid gap-6', !compact && '@3xl:grid-cols-[minmax(0,1fr)_26rem] @3xl:gap-10')}>
          <div className="min-w-0">
            {meets && (
              <figure className="rounded-xl border border-hairline border-l-[5px] border-l-ink bg-surface px-5 py-4">
                <figcaption className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</figcaption>
                <blockquote className={cn('mt-2 whitespace-pre-line break-words text-ink', compact ? 'text-base' : 'text-lg leading-normal @3xl:text-[19px]')}>
                  {meets}
                </blockquote>
              </figure>
            )}
            {told && <p className={cn('text-sm text-ink-muted', meets && 'mt-3')}>{told}</p>}
          </div>
          {places.length > 0 && (
            <div className="min-w-0 space-y-2">
              {map}
              <ul aria-label={places.length > 1 ? 'The club\'s places' : 'The club\'s place'}>
                {places.map((place, i) => <PlaceRow key={`${i}:${place.name}`} place={place} compact={compact} />)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
