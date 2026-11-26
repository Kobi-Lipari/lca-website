// src/areas/clubs/components/DirectoryMap.tsx
/// <reference types="google.maps" />
//
// The Clubs directory's map (WS09 step 33), drawn through LCAMap's mode
// "directory" and fetched only when the directory draws it. Its pins are
// the page's own buttons laid over the map, in the list's order, never the
// provider's markers, so a keyboard reaches each and a screen reader hears
// the club's name and town:
//   - solid where the club states how it meets, hollow where it does not,
//     and no number on any pin;
//   - a count circle where clubs share a point or a town; pressing it opens
//     it one step (one zoom step on Google's map) and draws each of its pins,
//     those that would touch spread round the middle of their points;
//   - the pressed pin is selected: larger, with a ring in the light look's
//     gold ink, and aria-pressed; the pin of the card under the pointer or
//     the focus is lifted, a little larger and above the others;
//   - "All of Louisiana" goes back to the whole state, with nothing selected
//     and every circle closed.
// With a maps key the pins sit over Google's map. The accessibility test
// build has no key and draws the stand-in instead when a page asks for it
// (directoryPins.ts, mapSource): the same pins over a plain sheet of the
// map's paper, placed across the whole-state view, and no script of the
// provider's is ever asked for.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  LOUISIANA_CENTER,
  MAP_STYLES,
  fitLouisiana,
  loadMapsScript,
} from '@/areas/clubs/clubMap'
import {
  circleHolding,
  groupName,
  marksFor,
  mapSource,
  pinName,
  spreadPlaced,
  standInPlace,
  type DirectoryMapProps,
  type MapMark,
  type MapPin,
  type PinGroup,
  type PlacedPin,
  PIN_RING,
} from '@/areas/clubs/directoryPins'
import { MAP_NAME, WHOLE_STATE } from '@/areas/clubs/directoryWords'
import { LCA } from '@/lib/brand'
import { cn } from '@/lib/utils'

// The pins are drawn on the map's paper, which stays light in every look,
// so their colours are fixed values, written into the SVG as raw hex.
const NAVY = LCA.navy
const PAPER = '#f2efe6'
const WHITE = '#ffffff'

/** A pin's size in pixels, wide by tall, for each of its states. */
const SIZES = { normal: [26, 34], lifted: [32, 42], selected: [38, 50] } as const

type PinState = keyof typeof SIZES

/** Where a point goes on the layer over the map, in pixels from its top left corner, or null while it cannot be placed. */
type PlaceOf = (lat: number, lng: number) => { x: number; y: number } | null

/** One pin: a teardrop, filled or drawn as an outline, with the ring when selected. */
function PinShape({ listed, state }: { listed: boolean; state: PinState }) {
  const [w, h] = SIZES[state]
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox="-2 -2 28 36" focusable="false">
      {state === 'selected' && (
        <>
          <circle cx="12" cy="10" r="11.4" fill="none" stroke={WHITE} strokeWidth="4.2" />
          <circle data-ring="true" cx="12" cy="10" r="11.4" fill="none" stroke={PIN_RING} strokeWidth="2.6" />
        </>
      )}
      <path
        d="M12 1C7.3 1 3.5 4.8 3.5 9.5c0 6.6 8.5 21.5 8.5 21.5s8.5-14.9 8.5-21.5C20.5 4.8 16.7 1 12 1z"
        fill={listed ? NAVY : WHITE}
        stroke={listed ? WHITE : NAVY}
        strokeWidth={listed ? 1.5 : 2.4}
      />
      {listed && <circle cx="12" cy="9.5" r="3.2" fill={WHITE} />}
    </svg>
  )
}

const MARK_BUTTON = 'pointer-events-auto absolute block rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand-navy'

/** The pins and circles, as buttons in the list's order. */
function MapMarks({ marks, placeOf, selectedId, liftedId, onPin, onCircle }: {
  marks: MapMark[]
  placeOf: PlaceOf
  selectedId: string | null
  liftedId: string | null
  onPin: (pin: MapPin) => void
  onCircle: (group: PinGroup) => void
}) {
  const liftedCircle = circleHolding(marks, liftedId)
  // The pins of an opened circle that would touch where the map puts them are spread apart, so each can be pressed.
  const placed: PlacedPin[] = marks.flatMap((mark) => {
    if (mark.kind !== 'pin') return []
    const at = placeOf(mark.pin.lat, mark.pin.lng)
    return at ? [{ id: mark.pin.id, opened: mark.opened, ...at }] : []
  })
  const drawnAt = spreadPlaced(placed)
  return (
    <div data-slot="map-pins" className="pointer-events-none absolute inset-0">
      {marks.map((mark) => {
        if (mark.kind === 'group') {
          const at = placeOf(mark.group.lat, mark.group.lng)
          if (!at) return null
          const lifted = liftedCircle === mark.group.key
          const size = lifted ? 40 : 34
          const style: CSSProperties = { left: at.x, top: at.y, transform: 'translate(-50%, -50%)', zIndex: lifted ? 900 : 10 }
          return (
            <button
              key={mark.group.key}
              type="button"
              data-circle={mark.group.key}
              data-lifted={lifted ? 'true' : undefined}
              aria-label={groupName(mark.group)}
              onClick={() => onCircle(mark.group)}
              className={cn(MARK_BUTTON, 'leading-none')}
              style={style}
            >
              <svg aria-hidden="true" width={size} height={size} viewBox="0 0 34 34" focusable="false">
                <circle cx="17" cy="17" r="15.5" fill={WHITE} stroke={NAVY} strokeWidth="2.5" />
                <text x="17" y="17" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" fill={NAVY}>{mark.group.pins.length}</text>
              </svg>
            </button>
          )
        }
        const { pin } = mark
        const at = drawnAt.get(pin.id)
        if (!at) return null
        const state: PinState = pin.id === selectedId ? 'selected' : pin.id === liftedId ? 'lifted' : 'normal'
        const style: CSSProperties = {
          left: at.x,
          top: at.y,
          transform: 'translate(-50%, -100%)',
          zIndex: state === 'selected' ? 1000 : state === 'lifted' ? 900 : 10,
        }
        return (
          <button
            key={pin.id}
            type="button"
            data-pin={pin.id}
            data-listed={pin.listed ? 'true' : 'false'}
            data-lifted={state === 'lifted' ? 'true' : undefined}
            aria-label={pinName(pin)}
            aria-pressed={state === 'selected'}
            onClick={() => onPin(pin)}
            className={cn(MARK_BUTTON, 'rounded-md leading-none')}
            style={style}
          >
            <PinShape listed={pin.listed} state={state} />
          </button>
        )
      })}
    </div>
  )
}

const WHOLE_BUTTON = 'pointer-events-auto absolute left-2.5 top-2.5 z-[1100] inline-flex min-h-11 items-center rounded-md bg-surface px-3 text-sm font-semibold text-ink shadow-md ring-1 ring-black/5 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-brand-navy'

/** What the two maps share: the circles opened, and what a press does. */
function useMarks(props: DirectoryMapProps) {
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set())
  const marks = marksFor(props.pins, opened)
  return {
    marks,
    onPin: (pin: MapPin) => props.onSelect(pin.id === props.selectedId ? null : pin.id),
    open: (group: PinGroup) => setOpened((now) => new Set([...now, group.key])),
    closeAll: () => {
      setOpened(new Set())
      props.onSelect(null)
    },
  }
}

/** The stand-in: the pins over a plain sheet of the map's paper, for the accessibility test build. */
function StandInMap(props: DirectoryMapProps) {
  const { marks, onPin, open, closeAll } = useMarks(props)
  const box = useRef<HTMLDivElement>(null)
  // The sheet's size in pixels, measured before it is painted and again when it changes, so a spread is worked out in pixels as on Google's map.
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize((now) => (now.width === el.clientWidth && now.height === el.clientHeight ? now : { width: el.clientWidth, height: el.clientHeight }))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(measure)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  const placeOf: PlaceOf = (lat, lng) => {
    // The points are laid inside the sheet, below the band that holds All of Louisiana, so no pin sits under it.
    const { x, y } = standInPlace(lat, lng)
    return { x: 16 + (x / 100) * (size.width - 32), y: 64 + (y / 100) * (size.height - 76) }
  }
  return (
    <div ref={box} role="group" aria-label={MAP_NAME} data-map="stand-in" className="relative isolate overflow-hidden rounded-xl border" style={{ height: props.height ?? 480 }}>
      <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100" focusable="false">
        <rect data-map-paper="true" width="100" height="100" fill={PAPER} />
      </svg>
      <MapMarks marks={marks} placeOf={placeOf} selectedId={props.selectedId} liftedId={props.liftedId} onPin={onPin} onCircle={open} />
      <button type="button" onClick={closeAll} className={WHOLE_BUTTON}>{WHOLE_STATE}</button>
    </div>
  )
}

/** Google's map, with the pins laid over it where the map puts their points. */
function GoogleMap(props: DirectoryMapProps) {
  const { marks, onPin, open, closeAll } = useMarks(props)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<google.maps.Map | null>(null)
  const layer = useRef<google.maps.OverlayView | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Each move of the map draws the pins again where it now puts them.
  const [, setMoves] = useState(0)

  useEffect(() => {
    loadMapsScript(apiKey, () => setLoaded(true))
  }, [apiKey])

  useEffect(() => {
    if (!loaded || !mapRef.current || mapObj.current) return
    const g = google.maps
    const map = new g.Map(mapRef.current, {
      center: LOUISIANA_CENTER,
      zoom: 7,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      clickableIcons: false,
      isFractionalZoomEnabled: true,
      gestureHandling: 'cooperative',
    })
    mapObj.current = map
    const moved = () => setMoves((n) => n + 1)
    class PinLayer extends g.OverlayView {
      onAdd() {}
      draw() { moved() }
      onRemove() {}
    }
    const overlay = new PinLayer()
    overlay.setMap(map)
    layer.current = overlay
    map.addListener('bounds_changed', moved)
    fitLouisiana(map)
  }, [loaded])

  // A point the map puts outside its frame (after a circle zooms in, say) has
  // no mark drawn, so the focus never lands on a pin nobody can see.
  const placeOf: PlaceOf = (lat, lng) => {
    const projection = layer.current?.getProjection()
    const frame = mapRef.current
    if (!projection || !frame) return null
    const at = projection.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng))
    if (!at) return null
    if (at.x < 0 || at.y < 0 || at.x > frame.clientWidth || at.y > frame.clientHeight) return null
    return { x: at.x, y: at.y }
  }

  function openCircle(group: PinGroup) {
    open(group)
    const map = mapObj.current
    if (!map) return
    map.panTo({ lat: group.lat, lng: group.lng })
    map.setZoom((map.getZoom() ?? 7) + 1)
  }

  function wholeState() {
    closeAll()
    if (mapObj.current) fitLouisiana(mapObj.current)
  }

  return (
    <div role="group" aria-label={MAP_NAME} data-map="maps" className="relative isolate overflow-clip rounded-xl border bg-muted" style={{ height: props.height ?? 480 }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {loaded && (
        <>
          <MapMarks marks={marks} placeOf={placeOf} selectedId={props.selectedId} liftedId={props.liftedId} onPin={onPin} onCircle={openCircle} />
          <button type="button" onClick={wholeState} className={WHOLE_BUTTON}>{WHOLE_STATE}</button>
        </>
      )}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
    </div>
  )
}

/** The directory's map: Google's with a maps key, the stand-in when the test build asks for it, and nothing otherwise. */
export default function DirectoryMap(props: DirectoryMapProps) {
  const source = mapSource()
  if (source === 'maps') return <GoogleMap {...props} />
  if (source === 'stand-in') return <StandInMap {...props} />
  return null
}
