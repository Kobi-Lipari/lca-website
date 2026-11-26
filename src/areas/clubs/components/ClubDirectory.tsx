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
//     scrolls. The list comes first in the reading and the tab order, with a
//     link before it that skips to the map. Below that width, see the phone
//     layout further down.
//   - The map's pins (LCAMap's mode "directory"): a card's pointer or focus
//     lifts its pin; a pin's press selects it and brings its card into view,
//     at once where the visitor asks for less motion. A place moves the map
//     to it and its nearest clubs.
//   - With no map (no maps key), the list stands alone with one line saying so.
//   - On a phone (WS09 step 35), below the 1024 pixels at which the list is a
//     drawer beside the map, and only with a map to draw: the field, Near me,
//     the orders and Filters at the top, then a link that skips to the list,
//     then the map, filling the room under the site's header, and the list in
//     a sheet along the window's foot. The sheet has two rests, low (its
//     button, the caption and the first card) and full (the whole list), and
//     is moved between them by its one button, "Show the list" at the low
//     rest and "Map" at the full one, never by a drag. A pin's press raises
//     the sheet to its card, marks it and moves the focus to it. The sheet is
//     not a dialog and holds no focus: when the focus leaves it at the full
//     rest for something the sheet would cover, it goes back to its low rest.
//     It sits above the site's dock at the window's foot, whose height the
//     dock writes, and never under or over it. It moves without animation.
//     The Filters panel is a sheet of its own there (ClubFilters, `sheet`).
//     With no map, the list stands alone as at wide widths.
//   - Under the list at every width, "Not here?": three tiles, to Suggest a
//     club, to Start a club, and one sentence on how a club's own page takes
//     an update.
// Nothing here names who keeps a club, a region's representative or a seat,
// and no address of a club is shown (K's decision 12).
import { startTransition, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Map as MapIcon, PanelBottomOpen } from 'lucide-react'

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
  A_TO_Z, DIRECTORY_TITLE, FINDING, LIST_A_TO_Z, LIST_NEAREST, LIST_SHEET, MAP_KEY, MISSING_CLUB, NEAREST, NEAREST_WHY, NO_CLUB_NEAR, NO_CLUBS, NO_DISTANCE, NO_MAP,
  NO_SUPPORT, NOT_FOUND, NOT_HERE, ORDER_LABEL, OUT_OF_DATE, OUT_OF_DATE_HOW, OUTSIDE, SHOW_LIST, SHOW_MAP, SKIP_TO_LIST, SKIP_TO_MAP, START_A_CLUB, START_ONE,
  SUGGEST_A_CLUB, TOO_LONG, TYPING_PAUSE_MS, listCaption, nearestCaption, noClubIn, regionsWithClubs, stripLine, townWords,
} from '@/areas/clubs/directoryWords'
import { useNarrowScreen } from '@/areas/clubs/narrowScreen'
import { START_QUERY } from '@/areas/clubs/suggestClub'
import { cn } from '@/lib/utils'

const lessMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The form that suggests a club, as step 30 addresses it: the address with no kind. */
const SUGGEST_A_CLUB_HREF = '/clubs/suggest'

/** The form that starts a club, as step 30 addresses it. */
const START_A_CLUB_HREF = `${SUGGEST_A_CLUB_HREF}?kind=${START_QUERY}`

/** The sheet's two rests on a phone: low, its button, the caption and the first card; full, the whole list. */
type Rest = 'low' | 'full'

/** The low rest's height: as measured (16rem until it is), and never more than half the window. */
const LOW_HEIGHT = 'min(var(--sheet-low, 16rem), 50dvh)'

/** The room kept under the first card at the low rest, in pixels. */
const LOW_ROOM = 12

/** The least share of the room between the site's header and its dock that the full sheet holds. */
const FULL_SHARE = 0.6

/** The height of the site's sticky header, as the header writes it; none in the reflow fallback, where it scrolls away. */
const headerHeight = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 0

/**
 * Over the low sheet, a control the keyboard moves to (in the controls, a
 * pin, All of Louisiana) is scrolled clear of the sheet as well as of the
 * dock: the page keeps the dock's height as room at its foot (src/index.css),
 * and each such control the low sheet's height as a margin of its own. The
 * sheet's own controls keep none, so moving into the sheet never scrolls the
 * page.
 */
const CLEAR_OF_SHEET = '[&_:is(a,button,input)]:scroll-mb-[min(var(--sheet-low,16rem),50dvh)]'

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
const SHEET_BUTTON = 'inline-flex min-h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-sm font-semibold text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus'
const TILE = 'min-w-0 rounded-lg border border-hairline bg-card p-4'
const TILE_LINK = cn(LINK_BUTTON, 'mt-1 inline-flex min-h-11 items-center text-sm')

/** "Not here?": three plain tiles under the list, each one link or one sentence, naming no one and showing no address. */
function NotHere() {
  const id = useId()
  return (
    <section aria-labelledby={id} data-slot="not-here" className="mt-8">
      <h2 id={id} className="text-lg font-semibold text-ink">{NOT_HERE}</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li className={TILE}>
          <h3 className="text-sm font-semibold text-ink">{MISSING_CLUB}</h3>
          <Link to={SUGGEST_A_CLUB_HREF} className={TILE_LINK}>{SUGGEST_A_CLUB}</Link>
        </li>
        <li className={TILE}>
          <h3 className="text-sm font-semibold text-ink">{NO_CLUB_NEAR}</h3>
          <Link to={START_A_CLUB_HREF} className={TILE_LINK}>{START_ONE}</Link>
        </li>
        <li className={TILE}>
          <h3 className="text-sm font-semibold text-ink">{OUT_OF_DATE}</h3>
          <p className="mt-1 text-sm text-ink">{OUT_OF_DATE_HOW}</p>
        </li>
      </ul>
    </section>
  )
}

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
  // The phone layout (WS09 step 35): below the wide layout's width, with a map to draw.
  const narrow = useNarrowScreen()
  const phone = narrow && source !== null && clubs.length > 0
  const [rest, setRest] = useState<Rest>('low')
  const phoneWrap = useRef<HTMLDivElement>(null)
  const band = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLElement>(null)
  const sheetRow = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  // The club whose pin was pressed, whose card takes the focus once the sheet is up.
  const raiseTo = useRef<string | null>(null)
  const measure = useRef<() => void>(() => {})

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
    if (!id) return
    // On a phone a pin's press raises the sheet to its card, and the card takes the focus once it is drawn there.
    if (phone) {
      raiseTo.current = id
      raise()
      return
    }
    cards.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: lessMotion() ? 'auto' : 'smooth' })
  }

  /**
   * Raises the sheet to its full rest. The title strip scrolls away first, as far as the page goes, so the full sheet
   * has the room under the field, the orders and Filters; the focus stays where it is.
   */
  function raise() {
    const at = band.current?.getBoundingClientRect().top
    const header = headerHeight()
    if (at !== undefined && at > header) window.scrollBy({ top: at - header, behavior: 'instant' })
    setRest('full')
  }

  /** Lowers the sheet to its low rest, the list back at its top, so the low rest shows the caption and the first card. */
  function lower() {
    if (scroller.current) scroller.current.scrollTop = 0
    setRest('low')
  }

  // The sheet's measures on a phone, written on the elements, not through React, so a scroll draws nothing again: the low
  // rest's height (the sheet's button, the caption and the first card), and the full rest's top: under the field, the
  // orders and Filters, or under the site's header once they have scrolled away, and never so low that the full sheet
  // holds less than FULL_SHARE of the room between the header and the dock, nor less than the low one.
  useEffect(() => {
    if (!phone) return
    const root = document.documentElement
    let frame = 0
    const write = () => {
      frame = 0
      const wrap = phoneWrap.current
      const row = sheetRow.current
      const inner = scroller.current
      if (!wrap || !row || !inner) return
      const list = inner.querySelector<HTMLElement>('[data-cards]')
      const first = list?.firstElementChild as HTMLElement | null | undefined
      const end = first ? first.offsetTop + first.offsetHeight : (list?.offsetTop ?? inner.scrollHeight)
      const low = Math.ceil(row.offsetHeight + end + LOW_ROOM)
      wrap.style.setProperty('--sheet-low', `${low}px`)
      const header = headerHeight()
      const foot = window.innerHeight - (parseFloat(getComputedStyle(root).getPropertyValue('--bottom-chrome-h')) || 0)
      const lowest = foot - Math.max(Math.min(low, window.innerHeight / 2), (foot - header) * FULL_SHARE)
      const under = band.current ? band.current.getBoundingClientRect().bottom : 0
      wrap.style.setProperty('--sheet-top', `${Math.round(Math.max(header, Math.min(under, lowest)))}px`)
    }
    const soon = () => {
      if (!frame) frame = window.requestAnimationFrame(write)
    }
    measure.current = write
    write()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(soon)
    for (const el of [scroller.current?.firstElementChild, band.current]) if (el) watch?.observe(el)
    window.addEventListener('resize', soon)
    window.addEventListener('scroll', soon, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      watch?.disconnect()
      window.removeEventListener('resize', soon)
      window.removeEventListener('scroll', soon)
      measure.current = () => {}
    }
  }, [phone])

  // After each drawing: the measures again, and a pressed pin's card, once the sheet is up, scrolled to and given the focus.
  useEffect(() => {
    measure.current()
    const id = raiseTo.current
    if (id === null || !phone || rest !== 'full') return
    raiseTo.current = null
    const li = cards.current.get(id)
    li?.querySelector('a')?.focus({ preventScroll: true })
    li?.scrollIntoView({ block: 'start', behavior: lessMotion() ? 'auto' : 'smooth' })
  })

  // The full sheet covers the map: when the focus moves to something it covers (a pin, a control it reaches over, the page
  // under it), it goes back to its low rest. A control in sight above it, or in a dialog, leaves it where it is.
  useEffect(() => {
    if (!phone || rest !== 'full') return
    const away = (event: FocusEvent) => {
      const at = event.target
      if (!(at instanceof Element)) return
      if (sheet.current?.contains(at) || at.closest('[role="dialog"]')) return
      const top = sheet.current?.getBoundingClientRect().top ?? 0
      if (band.current?.contains(at) && at.getBoundingClientRect().bottom <= top) return
      // As the sheet's own button lowers it: the list back at its top, the caption and the first card in sight.
      if (scroller.current) scroller.current.scrollTop = 0
      setRest('low')
    }
    document.addEventListener('focusin', away)
    return () => document.removeEventListener('focusin', away)
  }, [phone, rest])

  /** "Skip to the list": the focus goes to the sheet, at whichever rest it is, and the address keeps no mark of it. */
  function skipToList(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    sheet.current?.focus()
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

  // The field, Near me, the two orders and Filters: over the list at wide widths, and at the top of the phone layout.
  const controls = (
    <>
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
        <ClubFilters clubs={clubs} filters={filters} onChange={setFilters} sheet={narrow} />
      </div>
    </>
  )

  // The live caption, the one line where there is no map, and the cards: under the controls, or in the phone's sheet.
  const listBody = (
    <>
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
      <ul aria-label={nearestOn ? LIST_NEAREST : LIST_A_TO_Z} data-cards="true" className="mt-3 space-y-2">
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
    </>
  )

  const list = (
    <div className="min-w-0">
      {controls}
      {source !== null && (
        <a href="#map" className="sr-only rounded-md text-sm font-semibold text-ink underline underline-offset-2 outline-none focus:not-sr-only focus:mt-2 focus:inline-flex focus:min-h-11 focus:items-center focus-visible:ring-3 focus-visible:ring-focus">
          {SKIP_TO_MAP}
        </a>
      )}
      {listBody}
    </div>
  )

  const theMap = <LCAMap mode="directory" height="100%" pins={pins} selectedId={selectedId} liftedId={liftedId} onSelect={select} focus={focus} />

  /**
   * The sheet on a phone. At the low rest it keeps to the window's foot while
   * the map is in view and comes to rest under the map at the page's end, so
   * it never covers the footer; at the full rest it is fixed from under the
   * controls down to the dock. Neither rest reaches under the dock. The
   * browser never holds the page's scroll by the sheet, which would move the
   * page when the sheet changes rest.
   */
  const sheetPlace: CSSProperties = rest === 'low'
    ? { position: 'sticky', bottom: 'var(--bottom-chrome-h, 0px)', height: LOW_HEIGHT, overflowAnchor: 'none' }
    : { position: 'fixed', left: 0, right: 0, top: 'var(--sheet-top, var(--header-h, 0px))', bottom: 'var(--bottom-chrome-h, 0px)', margin: 0, overflowAnchor: 'none' }

  return (
    <div data-slot="club-directory" data-address={writeDirectoryAddress(address)}>
      <TitleStrip line={stripLine(clubs.length, regionsWithClubs(clubs))} />
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6">
        {phone ? (
          <div ref={phoneWrap} data-layout="phone">
            <div ref={band} className={cn('min-w-0', CLEAR_OF_SHEET)}>{controls}</div>
            <a
              href="#club-list"
              onClick={skipToList}
              className="sr-only rounded-md text-sm font-semibold text-ink underline underline-offset-2 outline-none focus:not-sr-only focus:mt-2 focus:inline-flex focus:min-h-11 focus:items-center focus-visible:ring-3 focus-visible:ring-focus"
            >
              {SKIP_TO_LIST}
            </a>
            <div
              id="map"
              ref={mapWrap}
              tabIndex={-1}
              className={cn('-mx-4 mt-3 min-w-0 scroll-mt-20 outline-none sm:-mx-6', CLEAR_OF_SHEET)}
              style={{ height: `calc(100dvh - var(--header-h, 0px) - var(--bottom-chrome-h, 0px) - ${LOW_HEIGHT})`, minHeight: '14rem' }}
            >
              {theMap}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{MAP_KEY}</p>
            {rest === 'full' && <div aria-hidden="true" data-sheet-room="true" style={{ height: LOW_HEIGHT }} />}
            <section
              id="club-list"
              ref={sheet}
              tabIndex={-1}
              aria-label={LIST_SHEET}
              data-sheet={rest}
              className="z-30 -mx-4 mt-3 flex flex-col rounded-t-xl border border-b-0 border-hairline bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.12)] outline-none sm:-mx-6"
              style={sheetPlace}
            >
              <div ref={sheetRow} className="flex shrink-0 justify-end px-4 pt-2 sm:px-6">
                <button type="button" data-sheet-button="true" onClick={() => (rest === 'low' ? raise() : lower())} className={SHEET_BUTTON}>
                  {rest === 'low' ? <PanelBottomOpen className="size-4" aria-hidden="true" /> : <MapIcon className="size-4" aria-hidden="true" />}
                  {rest === 'low' ? SHOW_LIST : SHOW_MAP}
                </button>
              </div>
              <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6">
                <div>
                  {listBody}
                  <NotHere />
                </div>
              </div>
            </section>
          </div>
        ) : source === null ? (
          <>
            {list}
            <NotHere />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[460px_minmax(0,1fr)]">
              {list}
              <div id="map" ref={mapWrap} tabIndex={-1} className="min-w-0 scroll-mt-20 outline-none">
                <div className="lg:sticky lg:top-20">
                  <div className="h-[420px] lg:h-[min(780px,calc(100vh-7rem))]">
                    {theMap}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{MAP_KEY}</p>
                </div>
              </div>
            </div>
            <NotHere />
          </>
        )}
      </div>
    </div>
  )
}
