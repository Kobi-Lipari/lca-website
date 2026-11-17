// src/areas/clubs/components/ClubBar.tsx
//
// The new club page's club bar on a phone (WS09 step 22): a bar of kind
// action in the new chrome's dock (DockBar in
// src/components/layout/BottomDock.tsx), holding Directions to the club's
// first place with a point, which opens that point in the visitor's own
// maps app. Message the club joins it once the page's Contact section is
// built (WS09 step 26). The dock draws the bar only where it draws itself,
// below 768 pixels with the chrome on and outside the reflow fallback and
// the on-screen keyboard, and nowhere else; the page draws no bar at all for
// a club with no place that has a point, so the bar is never empty. The
// dock keeps its own height as room at the page's foot, so a control the
// keyboard moves to is never under it. Directions stays in When and where
// in every case.
import { ExternalLink } from 'lucide-react'

import { DockBar } from '@/components/layout/BottomDock'
import { cn } from '@/lib/utils'
import { CONTROL } from '@/areas/clubs/clubPage'
import { directionsUrl, type PlacePoint } from '@/areas/clubs/clubMap'

export function ClubBar({ place }: { place: PlacePoint | null }) {
  if (!place) return null
  return (
    <DockBar kind="action">
      <div data-slot="club-bar" className="border-t border-hairline bg-surface px-4 py-2">
        <a
          href={directionsUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${place.name} (opens in a new tab)`}
          className={cn(CONTROL, 'w-full justify-center bg-ink text-ground hover:opacity-90')}
        >
          Directions
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
        </a>
      </div>
    </DockBar>
  )
}
