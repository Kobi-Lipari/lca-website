// src/areas/clubs/components/NearbyClubs.tsx
//
// The new club page's nearest clubs (WS09 step 22): "Chess clubs near
// {city}" with up to the three the answer gives, each a link to its own
// page by its slug, with its city, the distance as the server words it
// ("about 12 mi", "less than 1 mi"), never worked out or mended here, and
// how it meets in its own words, in quotation marks, or "Schedule not
// listed". Then "Clubs near you", to the Clubs page, whose Clubs near me
// finds them from where the visitor is. The Clubs page reads no region from
// its address yet, so there is no "All {region} clubs" link until it does.
// This block is not one of the answer's sections and has no link in the
// section nav; the page draws it only when the answer carries a nearest club.
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { WORD_LINK } from '@/areas/clubs/clubPage'
import { nearbyHeading, nearbyLine } from '@/areas/clubs/clubPageRows'
import { SectionHeading } from '@/areas/clubs/components/ClubAbout'
import type { ClubPageResponse } from '@domain/contracts'

export function NearbyClubs({ city, nearest }: { city: string; nearest: ClubPageResponse['nearest'] }) {
  return (
    <div data-slot="nearby-clubs" className="py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading compact={false}>{nearbyHeading(city)}</SectionHeading>
        <ul className="mt-2">
          {nearest.slice(0, 3).map((club) => (
            <li key={club.slug} className="border-b border-hairline py-2 last:border-b-0">
              {/* A club's name may be one long run; it breaks anywhere inside the link, so the page never widens. */}
              <Link to={`/clubs/${encodeURIComponent(club.slug)}`} className={cn(WORD_LINK, '[overflow-wrap:anywhere] text-base')}>{club.name}</Link>
              <p className="break-words text-sm text-ink">{nearbyLine(club)}</p>
            </li>
          ))}
        </ul>
        <p className="mt-2">
          <Link to="/clubs" className={cn(WORD_LINK, 'text-sm')}>Clubs near you</Link>
        </p>
      </div>
    </div>
  )
}
