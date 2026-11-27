// src/areas/clubs/components/ClubBar.tsx
//
// The new club page's club bar on a phone (WS09 step 22): a bar of kind
// action in the new chrome's dock (DockBar in
// src/components/layout/BottomDock.tsx), holding Directions to the club's
// first place with a point, which opens that point in the visitor's own
// maps app, and Message the club beside it (WS09 step 26), which takes the
// visitor to the page's Contact form with the focus on its heading. Every
// club can be written to, so every club has the bar: a club with no place
// that has a point has Message the club alone. The dock draws the bar only
// where it draws itself, below 768 pixels with the chrome on and outside the
// reflow fallback and the on-screen keyboard, and nowhere else. The dock
// keeps its own height as room at the page's foot, so a control the
// keyboard moves to is never under it. Directions stays in When and where
// in every case.
import { ExternalLink, Mail } from 'lucide-react'

import { DockBar } from '@/components/layout/BottomDock'
import { cn } from '@/lib/utils'
import { CONTROL, SECTION_IDS, focusContactForm } from '@/areas/clubs/clubPage'
import { directionsUrl, type PlacePoint } from '@/areas/clubs/clubMap'

export function ClubBar({ place }: { place: PlacePoint | null }) {
  return (
    <DockBar kind="action">
      <div data-slot="club-bar" className="flex gap-2 border-t border-hairline bg-surface px-4 py-2">
        {place && (
          <a
            href={directionsUrl(place)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Directions to ${place.name} (opens in a new tab)`}
            className={cn(CONTROL, 'min-w-0 flex-1 justify-center border border-field bg-surface text-ink hover:bg-surface-2')}
          >
            Directions
            <ExternalLink aria-hidden="true" className="size-4 shrink-0" />
          </a>
        )}
        <a
          href={`#${SECTION_IDS.contact}`}
          onClick={focusContactForm}
          className={cn(CONTROL, 'min-w-0 flex-1 justify-center bg-ink text-ground hover:opacity-90')}
        >
          <Mail aria-hidden="true" className="size-4 shrink-0" />
          Message the club
        </a>
      </div>
    </DockBar>
  )
}
