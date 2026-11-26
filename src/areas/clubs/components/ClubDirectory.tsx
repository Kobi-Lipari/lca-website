// src/areas/clubs/components/ClubDirectory.tsx
//
// The Clubs directory (WS09 step 33): /clubs in the new layout, drawn only
// while the new club pages are on (clubPagesOn) and the list's answer has
// the directory's shape (src/pages/ClubsIndexPage.tsx chooses). A chunk of
// its own, which today's Clubs page never fetches.
//   - The title strip: "Chess clubs in Louisiana", and the count of clubs and
//     of the regions with a club among them, both counted from the answer.
//   - On first paint every club, A to Z, with no location read. The address
//     holds the page's choices as step 32 writes them (a ZIP code, the order
//     and the filters) and the page applies them (WS09 step 34): a link
//     someone shares opens the list as they saw it.
//   - The field and Near me (PlaceField), the two orders, A to Z and
//     Nearest, and the Filters panel (ClubFilters), WS09 step 34. A ZIP code
//     or a Louisiana town orders the list nearest first, with "about N mi",
//     the divider "Farther than 75 miles" and, after the last club with a
//     distance, "Distance not known" over the clubs with no point; a name
//     narrows the list; the filters narrow the list and the pins together.
//     No order removes a club. The address keeps only a ZIP code, never what
//     was typed and never the device's own point, and the page asks the
//     server nothing when a place is typed, found or cleared.
//   - One live region over the list, the caption, says each change once: an
//     order, a narrowing, a clearing, and the field's states in words. What
//     is typed is read when the typing pauses, or at once on Enter, so a new
//     count is said once, never on every key.
//   - The caption, then the cards, one link each (ClubCard).
//   - At wide widths the list is a drawer 460 pixels wide beside the map,
//     which is 780 pixels tall at most and stays in view as the list
//     scrolls; below that the page is one column, the list and then the map
//     under it. The list comes first in the reading and the tab order, with a
//     link before it that skips to the map.
//   - The map's pins (LCAMap's mode "directory"): a card's pointer or focus
//     lifts its pin; a pin's press selects it and brings its card into view,
//     at once where the visitor asks for less motion. A place moves the map
//     to it and its nearest clubs.
//   - With no map (no maps key), the list stands alone with one line saying so.
// Nothing here names who keeps a club, a region's representative or a seat,
// and no address of a club is shown (K's decision 12).
import { startTransition, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'

import { CLEAR_FILTERS, DIVIDER_WORDS, NO_FILTER_MATCH, SHOW_ALL, directoryView, nearestFirst, type DirectoryFilters } from '@domain/clubs/order'
import { readDirectoryAddress, writeDirectoryAddress, type DirectoryAddress } from '@domain/clubs/directoryAddress'
import { nearestTown, placeFor, zipPoint } from '@domain/clubs/nearZip'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { ClubCard } from '@/areas/clubs/components/ClubCard'
import { ClubFilters } from '@/areas/clubs/components/ClubFilters'
import { LCAMap } from '@/areas/clubs/components/LCAMap'
import { PlaceField, type DeviceAnswer } from '@/areas/clubs/components/PlaceField'
import { mapSource, pinsInOrder, type MapFocus } from '@/areas/clubs/directoryPins'
import {
  A_TO_Z, DIRECTORY_TITLE, FINDING, LIST_A_TO_Z, LIST_NEAREST, MAP_KEY, NEAREST, NEAREST_WHY, NO_CLUBS, NO_DISTANCE, NO_MAP, NO_SUPPORT, NOT_FOUND,
  ORDER_LABEL, OUTSIDE, SKIP_TO_MAP, START_A_CLUB, TOO_LONG, TYPING_PAUSE_MS, listCaption, nearestCaption, noClubIn, regionsWithClubs, stripLine, townWords,
} from '@/areas/clubs/directoryWords'
import { START_QUERY } from '@/areas/clubs/suggestClub'
import { cn } from '@/lib/utils'

const lessMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The form that starts a club, as step 30 addresses it. */
const START_A_CLUB_HREF = `/clubs/suggest?kind=${START_QUERY}`

/** How many of the nearest clubs the map frames beside a place. */
const FRAMED_CLUBS = 3

/** A state of the field, said in words over the list. */
type Note =
  | { kind: 'finding' | 'not_found' | 'no_support' | 'too_long' | 'outside' }
  | { kind: 'no_club'; town: string }

const NOTE_WORDS: Record<Exclude<Note['kind'], 'no_club'>, string> = {
  finding: FINDING,
  not_found: NOT_FOUND,
  no_support: NO_SUPPORT,
  too_long: TOO_LONG,
  outside: OUTSIDE,
}

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

const ORDER_BUTTON = 'inline-flex min-h-11 items-center gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-focus'
const LINK_BUTTON = 'inline rounded-sm font-semibold text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus'

/** One of the two orders: pressed is told by aria-pressed and a check mark; one that cannot be chosen yet says why, beside it. */
function OrderButton({ label, pressed, unavailable, why, onPress }: { label: string; pressed: boolean; unavailable?: boolean; why?: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={unavailable ? true : undefined}
      aria-describedby={unavailable ? why : undefined}
      onClick={() => {
        if (!unavailable) onPress()
      }}
      className={cn(
        ORDER_BUTTON,
        pressed ? 'border-ink bg-surface font-semibold text-ink' : 'border-hairline bg-surface text-ink hover:bg-muted',
        unavailable && 'cursor-not-allowed text-muted-foreground hover:bg-surface',
      )}
    >
      {pressed && <Check className="size-4" aria-hidden="true" />}
      {label}
    </button>
  )
}

/**
 * The address's choices as the page keeps them. A ZIP code the points file does not hold is no place, so it is let go
 * here, with its order: no later choice then writes it back into the address.
 */
function knownAddress(search: string): DirectoryAddress {
  const read = readDirectoryAddress(search)
  return read.near !== null && zipPoint(read.near) === null ? { ...read, near: null, sort: 'az' } : read
}

export function ClubDirectory({ clubs }: { clubs: ApiClubDirectoryItem[] }) {
  const { pathname, search, hash, key: arrival } = useLocation()
  const navigate = useNavigate()
  const address = knownAddress(search)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [liftedId, setLiftedId] = useState<string | null>(null)
  // What is in the field, and what was in it when the typing last paused: the name the list is narrowed by.
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [note, setNote] = useState<Note | null>(null)
  // Counts each place taken, so the map moves to a place taken again.
  const [takes, setTakes] = useState(0)
  const pause = useRef<number | undefined>(undefined)
  const field = useRef<HTMLInputElement>(null)
  const cards = useRef(new Map<string, HTMLLIElement>())
  const mapWrap = useRef<HTMLDivElement>(null)
  const whyId = useId()
  const orderId = useId()
  const source = mapSource()

  // The place the address holds: its ZIP code's point and the town nearest it, or none for a ZIP code the points file does not hold.
  const near = address.near
  const nearPoint = near ? zipPoint(near) : null
  const place = near && nearPoint ? { zip: near, point: nearPoint, town: townWords(nearestTown(nearPoint)) } : null
  const nearestOn = place !== null && address.sort === 'nearest'
  const filters: DirectoryFilters = { region: address.region, weekends: address.weekends, scholastic: address.scholastic }

  const view = directoryView(clubs, { from: nearestOn ? place.point : null, name, filters })
  const pins = pinsInOrder(view.pins)
  // After the last club with a distance, the clubs with no point, under their own divider, when some have a point and some do not.
  const firstUnknown = nearestOn ? view.rows.findIndex((row) => row.miles === null) : -1
  const unknownBefore = firstUnknown > 0 ? firstUnknown : null

  const focus: MapFocus | null = place
    ? {
        key: `${place.zip}:${takes}`,
        points: [
          { lat: place.point.latitude, lng: place.point.longitude },
          ...nearestFirst(view.pins, place.point).rows.slice(0, FRAMED_CLUBS).flatMap(({ club }) => (club.point ? [{ lat: club.point.latitude, lng: club.point.longitude }] : [])),
        ],
      }
    : null

  // The footer's Club map link (/clubs#map) brings the map into view, as on today's page.
  const mapAsked = source !== null && hash === '#map'
  useEffect(() => {
    if (mapAsked) mapWrap.current?.scrollIntoView({ block: 'start' })
  }, [mapAsked, arrival])

  useEffect(() => () => window.clearTimeout(pause.current), [])

  // The address as the page's last choice left it. An answer that comes later than the press it answers (the device's, or the
  // typing pause's) builds on this, not on the address of the render it was asked in, so a filter or a place chosen in the
  // meantime is kept.
  const latest = useRef(address)
  useEffect(() => {
    latest.current = knownAddress(search)
  }, [search])
  // True from the press of Near me until its answer, or until a place is typed or cleared, after which the answer is let go.
  const asking = useRef(false)

  function select(id: string | null) {
    setSelectedId(id)
    if (id) cards.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: lessMotion() ? 'auto' : 'smooth' })
  }

  /**
   * Writes the page's choices into its address, in place of the last, so
   * Back leaves the page rather than stepping through each choice. The
   * router moves the address in a transition, so the page's own changes that
   * go with it are made in the same one, and the live region changes once.
   */
  function go(change: Partial<DirectoryAddress>, alongside?: () => void) {
    const next = { ...latest.current, ...change }
    latest.current = next
    startTransition(() => {
      navigate({ pathname, search: writeDirectoryAddress(next) }, { replace: true })
      alongside?.()
    })
  }

  /** Lets a note go when the order or the filters change, except the one that says the device is being asked. */
  function dropNote() {
    setNote((now) => (now?.kind === 'finding' ? now : null))
  }

  /** Orders the list from a ZIP code: a typed place takes the field's text with it, and Near me leaves a typed name as it is. */
  function takePlace(zip: string, note: Note | null, typedPlace: boolean) {
    go({ near: zip, sort: 'nearest' }, () => {
      setTakes((n) => n + 1)
      if (typedPlace) setName('')
      setNote(note)
    })
  }

  /** Reads what was typed: a place orders the list from it, a place outside Louisiana says so, and anything else is a name. */
  function read(typed: string) {
    window.clearTimeout(pause.current)
    const answer = placeFor(typed)
    if (answer === null) {
      setName('')
      dropNote()
      return
    }
    if (answer.kind === 'zip' || answer.kind === 'town') {
      // A club is in the town when its own town reads as the same town of the points file.
      const hasClub = answer.kind === 'zip' || clubs.some((club) => {
        const at = club.city ? placeFor(club.city) : null
        return at?.kind === 'town' && at.town === answer.town
      })
      setText('')
      asking.current = false
      takePlace(answer.zip, hasClub ? null : { kind: 'no_club', town: townWords(answer.town) }, true)
      return
    }
    if (answer.kind === 'outside') {
      asking.current = false
      setName('')
      setNote({ kind: 'outside' })
      return
    }
    // A ZIP code of Louisiana's that the points file does not hold reads as a name, as any other text does: the count says what matched.
    setName(typed)
    dropNote()
  }

  // The pause reads the text with the page's choices as they are when it ends, not as they were at the key press.
  const reader = useRef(read)
  useEffect(() => {
    reader.current = read
  })
  function typed(value: string) {
    setText(value)
    window.clearTimeout(pause.current)
    pause.current = window.setTimeout(() => reader.current(value), TYPING_PAUSE_MS)
  }

  function device(answer: DeviceAnswer) {
    if (answer.kind === 'asking') {
      asking.current = true
      setNote({ kind: 'finding' })
      return
    }
    if (answer.kind === 'unsupported') {
      setNote({ kind: 'no_support' })
      return
    }
    // An answer to an ask that a typed or cleared place has overtaken is let go.
    if (!asking.current) return
    asking.current = false
    if (answer.kind === 'zip') takePlace(answer.zip, null, false)
    else if (answer.kind === 'outside') setNote({ kind: 'outside' })
    else if (answer.kind === 'slow') setNote({ kind: 'too_long' })
    else setNote({ kind: 'not_found' })
  }

  function clearPlace() {
    asking.current = false
    go({ near: null, sort: 'az' }, () => setNote(null))
    field.current?.focus()
  }

  function showAll() {
    window.clearTimeout(pause.current)
    setText('')
    setName('')
    field.current?.focus()
  }

  function setFilters(next: DirectoryFilters) {
    go(next, dropNote)
  }

  function clearFilters() {
    setFilters({ region: null, weekends: false, scholastic: false })
    field.current?.focus()
  }

  if (clubs.length === 0) {
    return (
      <div data-slot="club-directory">
        <TitleStrip line={NO_CLUBS} />
      </div>
    )
  }

  /** The caption over the list: the whole list's, or the narrowed list's, its action a button of its own. */
  function captionLine() {
    const caption = view.caption
    if (caption === null) return <p className="text-sm text-ink">{nearestOn ? nearestCaption(clubs.length) : listCaption(clubs.length)}</p>
    if (caption === NO_FILTER_MATCH) {
      return (
        <p className="text-sm text-ink">
          {NO_FILTER_MATCH.slice(0, NO_FILTER_MATCH.length - CLEAR_FILTERS.length - 2)}{' '}
          <button type="button" onClick={clearFilters} className={LINK_BUTTON}>{CLEAR_FILTERS}</button>.
        </p>
      )
    }
    const at = caption.lastIndexOf(' · ')
    const action = caption.slice(at + 3)
    return (
      <p className="text-sm text-ink">
        {caption.slice(0, at)}{' · '}
        <button type="button" onClick={action.startsWith(SHOW_ALL) ? showAll : clearFilters} className={LINK_BUTTON}>{action}</button>
      </p>
    )
  }

  const list = (
    <div className="min-w-0">
      <PlaceField
        text={text}
        onText={typed}
        onEnter={() => read(text)}
        place={place ? { town: place.town, zip: place.zip } : null}
        onClearPlace={clearPlace}
        onDevice={device}
        asking={note?.kind === 'finding'}
        fieldRef={field}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-labelledby={orderId} className="flex flex-wrap items-center gap-2">
          <span id={orderId} className="text-sm font-semibold text-ink">{ORDER_LABEL}</span>
          <OrderButton label={A_TO_Z} pressed={!nearestOn} onPress={() => go({ sort: 'az' }, dropNote)} />
          <OrderButton label={NEAREST} pressed={nearestOn} unavailable={place === null} why={whyId} onPress={() => go({ sort: 'nearest' }, dropNote)} />
          {place === null && <span id={whyId} className="text-sm text-muted-foreground">{NEAREST_WHY}</span>}
        </div>
        <ClubFilters clubs={clubs} filters={filters} onChange={setFilters} />
      </div>
      {source !== null && (
        <a href="#map" className="sr-only rounded-md text-sm font-semibold text-ink underline underline-offset-2 outline-none focus:not-sr-only focus:mt-2 focus:inline-flex focus:min-h-11 focus:items-center focus-visible:ring-3 focus-visible:ring-focus">
          {SKIP_TO_MAP}
        </a>
      )}
      <div role="status" className="mt-3 space-y-1">
        {note && (
          <p className="text-sm font-semibold text-ink" data-note={note.kind}>
            {note.kind === 'no_club' ? (
              <>
                {noClubIn(note.town)}{' '}
                <Link to={START_A_CLUB_HREF} className={LINK_BUTTON}>{START_A_CLUB}</Link>
              </>
            ) : NOTE_WORDS[note.kind]}
          </p>
        )}
        {captionLine()}
      </div>
      {source === null && <p className="mt-1 text-sm text-muted-foreground">{NO_MAP}</p>}
      <ul aria-label={nearestOn ? LIST_NEAREST : LIST_A_TO_Z} className="mt-3 space-y-2">
        {view.rows.map(({ club, distance }, index) => (
          <li
            key={club.id}
            className="scroll-mt-24"
            ref={(el) => {
              if (el) cards.current.set(club.id, el)
              else cards.current.delete(club.id)
            }}
          >
            {(index === view.dividerBefore || index === unknownBefore) && (
              <p data-divider="true" className="mb-2 flex items-center gap-2 pt-2 text-xs font-semibold text-muted-foreground">
                <span>{index === unknownBefore ? NO_DISTANCE : DIVIDER_WORDS}</span>
                <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
              </p>
            )}
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
                  <LCAMap mode="directory" height="100%" pins={pins} selectedId={selectedId} liftedId={liftedId} onSelect={select} focus={focus} />
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
