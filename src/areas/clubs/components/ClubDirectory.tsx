// src/areas/clubs/components/ClubDirectory.tsx
//
// The Clubs directory (WS09 step 33): /clubs in the new layout, drawn only
// while the new club pages are on (clubPagesOn) and the list's answer has
// the directory's shape (src/pages/ClubsIndexPage.tsx chooses). A chunk of
// its own, which today's Clubs page never fetches.
//   - The title strip: "Chess clubs in Louisiana", and the count of clubs and
//     of the regions with a club among them, both counted from the answer.
//   - On first paint every club, A to Z, with no place asked for and no
//     location read. The address's parts are read on load, as step 32 writes
//     them, for the field and filters step 34 adds; this step draws neither,
//     and so applies neither, and the list is every club whatever they say.
//   - The caption over the list, then the cards, one link each (ClubCard).
//   - At wide widths the list is a drawer 460 pixels wide beside the map,
//     which is 780 pixels tall at most and stays in view as the list
//     scrolls; below that the page is one column, the list and then the map
//     under it. The list comes first in the reading and the tab order, with a
//     link before it that skips to the map.
//   - The map's pins (LCAMap's mode "directory"): a card's pointer or focus
//     lifts its pin; a pin's press selects it and brings its card into view,
//     at once where the visitor asks for less motion.
//   - With no map (no maps key), the list stands alone with one line saying so.
// Nothing here names who keeps a club, a region's representative or a seat,
// and no address of a club is shown (K's decision 12).
import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { NO_FILTERS, directoryView } from '@domain/clubs/order'
import { readDirectoryAddress, writeDirectoryAddress } from '@domain/clubs/directoryAddress'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { ClubCard } from '@/areas/clubs/components/ClubCard'
import { LCAMap } from '@/areas/clubs/components/LCAMap'
import { mapSource, pinsInOrder } from '@/areas/clubs/directoryPins'
import {
  DIRECTORY_TITLE, MAP_KEY, NO_CLUBS, NO_MAP, SKIP_TO_MAP, listCaption, regionsWithClubs, stripLine,
} from '@/areas/clubs/directoryWords'

const lessMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The title strip: the page's one heading and the line under it. */
function TitleStrip({ line }: { line: string }) {
  return (
    <section className="border-b border-hairline bg-surface">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">{DIRECTORY_TITLE}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{line}</p>
      </div>
    </section>
  )
}

export function ClubDirectory({ clubs }: { clubs: ApiClubDirectoryItem[] }) {
  const { search, hash, key: arrival } = useLocation()
  // Read once, on load. Written back canonical on the section, so the address as read can be seen.
  const [address] = useState(() => readDirectoryAddress(search))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liftedId, setLiftedId] = useState<string | null>(null)
  const cards = useRef(new Map<string, HTMLLIElement>())
  const mapWrap = useRef<HTMLDivElement>(null)
  const source = mapSource()

  const view = directoryView(clubs, { from: null, name: '', filters: NO_FILTERS })
  const pins = pinsInOrder(view.pins)

  // The footer's Club map link (/clubs#map) brings the map into view, as on today's page.
  const mapAsked = source !== null && hash === '#map'
  useEffect(() => {
    if (mapAsked) mapWrap.current?.scrollIntoView({ block: 'start' })
  }, [mapAsked, arrival])

  function select(id: string | null) {
    setSelectedId(id)
    if (id) cards.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: lessMotion() ? 'auto' : 'smooth' })
  }

  if (clubs.length === 0) {
    return (
      <div data-slot="club-directory">
        <TitleStrip line={NO_CLUBS} />
      </div>
    )
  }

  const list = (
    <div className="min-w-0">
      {source !== null && (
        <a href="#map" className="sr-only rounded-md text-sm font-semibold text-ink underline underline-offset-2 outline-none focus:not-sr-only focus:mb-2 focus:inline-flex focus:min-h-11 focus:items-center focus-visible:ring-3 focus-visible:ring-focus">
          {SKIP_TO_MAP}
        </a>
      )}
      <p className="text-sm text-ink">{listCaption(clubs.length)}</p>
      {source === null && <p className="mt-1 text-sm text-muted-foreground">{NO_MAP}</p>}
      <ul aria-label="Clubs, A to Z" className="mt-3 space-y-2">
        {view.rows.map(({ club, distance }) => (
          <li
            key={club.id}
            className="scroll-mt-24"
            ref={(el) => {
              if (el) cards.current.set(club.id, el)
              else cards.current.delete(club.id)
            }}
          >
            <ClubCard club={club} distance={distance} selected={club.id === selectedId} onLift={setLiftedId} />
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div data-slot="club-directory" data-address={writeDirectoryAddress(address)}>
      <TitleStrip line={stripLine(clubs.length, regionsWithClubs(clubs))} />
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
        {source === null ? list : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[460px_minmax(0,1fr)]">
            {list}
            <div id="map" ref={mapWrap} tabIndex={-1} className="min-w-0 scroll-mt-20 outline-none">
              <div className="lg:sticky lg:top-20">
                <div className="h-[420px] lg:h-[min(780px,calc(100vh-7rem))]">
                  <LCAMap mode="directory" height="100%" pins={pins} selectedId={selectedId} liftedId={liftedId} onSelect={select} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{MAP_KEY}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
