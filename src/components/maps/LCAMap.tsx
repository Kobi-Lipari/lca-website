// src/components/maps/LCAMap.tsx
/// <reference types="google.maps" />
// TypeScript 6 dropped the automatic inclusion of every @types package, so
// this reference is what makes @types/google.maps load at all — without it
// the dependency sits in package.json doing nothing and every handle below
// falls back to `any`.
//
// Two uses:
//   mode="all"    the Clubs page. The page owns which club is selected and
//                 hovered; the map follows it (pans, zooms, opens the club's
//                 card) and reports marker clicks back with onSelect.
//   mode="single" one club's page: a small fixed map with directions.
import { useEffect, useRef, useState } from 'react'
import { CLUB_MAP_PINS, type ClubMapPin } from '@/lib/clubMapData'
import { LCA } from '@/lib/brand'

declare global {
  interface Window {
    initLCAMap: () => void
    /** Present only once the Maps script has run; the guard below needs it. */
    google?: typeof google
  }
}

// Map styling takes the palette as raw hex; Google Maps has no idea what
// a Tailwind class is.
/** Gold is 2.28:1 on the white info window, so map links use a darker one.
 *  4.86:1 — the info window is Google's markup, outside the Tailwind theme. */
const GOLD_ON_LIGHT = '#8a6d1f'
const NAVY = LCA.navy
const GOLD = LCA.gold

/**
 * A quiet base map: the state outline, parishes' towns and water carry the
 * picture, and roads fade into the background. Highway shields and road
 * names are what made the old map read like a road atlas, so they're off;
 * the roads themselves stay faintly visible for finding your way once
 * zoomed in on a club.
 */
export const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f4f2ec' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b6272' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f2efe6' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#eeeadf' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#bfd4e6' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b8fae' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }, { visibility: 'simplified' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e4dfd2' }, { weight: 0.8 }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ebe7dc' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'simplified' }, { lightness: 20 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: NAVY }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: NAVY }, { weight: 1.6 }] },
  { featureType: 'administrative.province', elementType: 'labels.text.fill', stylers: [{ color: NAVY }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#8a90a0' }] },
]

export const LOUISIANA_CENTER = { lat: 31.0, lng: -91.8 }
/**
 * The area the whole-state view frames. Tuned by eye on the Clubs page:
 * the state's outline is -94.05 to -88.85 by 28.95 to 33.02, but centred on
 * that the view sat too far east, so this is shifted about 0.35 degrees west
 * and drawn about 5% tighter.
 */
export const LOUISIANA_BOUNDS = { south: 29.05, west: -94.28, north: 32.92, east: -89.33 }
/** How close to come in when a club is picked: town level, not street level. */
const FOCUS_ZOOM = 11

/** Brand pin: a teardrop with a dot in the club's color. */
function markerSvg(pinColor: string, dotColor: string, size: number): string {
  const h = Math.round(size * 1.33)
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 24 32">` +
      `<path d="M12 1C7.3 1 3.5 4.8 3.5 9.5c0 6.6 8.5 21.5 8.5 21.5s8.5-14.9 8.5-21.5C20.5 4.8 16.7 1 12 1z" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5"/>` +
      `<circle cx="12" cy="9.5" r="3.6" fill="${dotColor}" stroke="#ffffff" stroke-width="0.8"/>` +
      '</svg>'
    )
  )
}

/** A blue "you are here" dot. */
const USER_DOT =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
    '<circle cx="11" cy="11" r="10" fill="#2563eb" fill-opacity="0.18"/>' +
    '<circle cx="11" cy="11" r="5.5" fill="#2563eb" stroke="#ffffff" stroke-width="2"/>' +
    '</svg>',
  )

const safeColor = (c: string | null | undefined, fallback: string) =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

export function directionsUrl(pin: Pick<ClubMapPin, 'lat' | 'lng'>): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** A spot on the map, with the original club list's note when it came from there. */
export interface MapPoint {
  lat: number
  lng: number
  description?: string
}

/**
 * Where a club goes on the map: the location set on its admin page, or
 * failing that, its entry in the original club list (matched on name).
 * Undefined when it has neither yet.
 */
export function clubLocation(club: { name: string; latitude?: number | null; longitude?: number | null }): MapPoint | undefined {
  if (typeof club.latitude === 'number' && typeof club.longitude === 'number') {
    return { lat: club.latitude, lng: club.longitude, description: findPinByName(club.name)?.description }
  }
  return findPinByName(club.name)
}

/** The original club list's entry for a club, matched on its name. */
export function findPinByName(name: string): ClubMapPin | undefined {
  const t = normalize(name)
  if (!t) return undefined
  return (
    CLUB_MAP_PINS.find((p) => normalize(p.name) === t) ??
    CLUB_MAP_PINS.find((p) => normalize(p.name).includes(t) || t.includes(normalize(p.name)))
  )
}

export function loadMapsScript(apiKey: string, onLoad: () => void) {
  if (window.google?.maps) { onLoad(); return }
  if (document.querySelector('script[data-lca-maps]')) {
    const prev = window.initLCAMap
    window.initLCAMap = () => { prev?.(); onLoad() }
    return
  }
  window.initLCAMap = onLoad
  const script = document.createElement('script')
  script.src =
    `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initLCAMap&loading=async`
  script.async = true
  script.defer = true
  script.dataset.lcaMaps = '1'
  document.head.appendChild(script)
}

/** What the Clubs page tells the map about each club it's showing. */
export interface MapClub {
  id: string
  name: string
  city?: string | null
  color?: string | null
  meeting_schedule?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface AllClubsProps {
  mode: 'all'
  height?: number | string
  clubs: MapClub[]
  selectedId?: string | null
  hoveredId?: string | null
  onSelect?: (id: string | null) => void
  /** The visitor's position, once they've asked for clubs near them. */
  userLocation?: { lat: number; lng: number } | null
  /**
   * 'state' frames all of Louisiana (the unfiltered view); 'clubs' fits the
   * shown clubs, so a region filter zooms in on that region.
   */
  frame?: 'state' | 'clubs'
}

interface SingleClubProps {
  mode: 'single'
  clubName: string
  /** The club's saved map location; falls back to the original club list. */
  location?: { lat: number; lng: number } | null
  height?: number
}

type Props = AllClubsProps | SingleClubProps

type PinState = 'normal' | 'hover' | 'selected'

function pinIcon(club: MapClub, state: PinState): google.maps.Icon {
  const g = google.maps
  const size = state === 'selected' ? 36 : state === 'hover' ? 30 : 24
  const h = Math.round(size * 1.33)
  const dot = safeColor(club.color, GOLD)
  return {
    url: state === 'selected' ? markerSvg(GOLD, NAVY, size) : markerSvg(NAVY, dot, size),
    scaledSize: new g.Size(size, h),
    anchor: new g.Point(size / 2, h),
  }
}

function infoContent(club: MapClub, pin: MapPoint): string {
  const meta = [club.city ? `${escapeHtml(club.city)}, LA` : '', club.meeting_schedule ? escapeHtml(club.meeting_schedule) : '']
    .filter(Boolean)
    .join(' · ')
  return (
    `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:250px;padding:2px 2px 0">` +
    `<p style="font-weight:700;font-size:14px;color:${NAVY};margin:0 0 4px">${escapeHtml(club.name)}</p>` +
    (meta ? `<p style="font-size:12px;color:#555;margin:0 0 6px;line-height:1.45">${meta}</p>` : '') +
    (pin.description ? `<p style="font-size:12px;color:#555;margin:0;line-height:1.5">${escapeHtml(pin.description)}</p>` : '') +
    `<div style="display:flex;gap:14px;margin-top:10px">` +
    `<a href="/clubs/${encodeURIComponent(club.id)}" style="font-size:12px;font-weight:600;color:${NAVY};text-decoration:underline;">View club page →</a>` +
    `<a href="${directionsUrl(pin)}" target="_blank" rel="noopener noreferrer" style="font-size:12px;font-weight:600;color:${GOLD_ON_LIGHT};text-decoration:underline;">Directions ↗</a>` +
    `</div></div>`
  )
}

export function LCAMap(props: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  /** Club id → its marker, for the clubs currently shown. */
  const markersRef = useRef(new Map<string, { marker: google.maps.Marker; club: MapClub; pin: MapPoint }>())
  const singleMarkerRef = useRef<google.maps.Marker | null>(null)
  const userMarkerRef = useRef<google.maps.Marker | null>(null)
  const [loaded, setLoaded] = useState(false)

  const isAll = props.mode === 'all'
  const height = props.height ?? (isAll ? 480 : 240)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const singlePin: MapPoint | undefined = props.mode === 'single'
    ? (props.location ?? findPinByName(props.clubName))
    : undefined
  const frame = isAll ? (props.frame ?? 'clubs') : 'clubs'
  const clubs = isAll ? props.clubs : []
  const selectedId = isAll ? (props.selectedId ?? null) : null
  const hoveredId = isAll ? (props.hoveredId ?? null) : null
  const userLocation = isAll ? (props.userLocation ?? null) : null

  // The latest onSelect without making every effect depend on it.
  const onSelectRef = useRef<((id: string | null) => void) | undefined>(undefined)
  onSelectRef.current = isAll ? props.onSelect : undefined

  // Stable key: markers only rebuild when the set of clubs changes, not when
  // the parent re-renders with a new array identity.
  const clubsKey = clubs.map((c) => `${c.id}:${c.color ?? ''}:${c.latitude ?? ''}:${c.longitude ?? ''}`).join(',')

  useEffect(() => {
    if (!apiKey) return
    loadMapsScript(apiKey, () => setLoaded(true))
  }, [apiKey])

  // Create the map ONCE per mount.
  useEffect(() => {
    if (!loaded || !mapRef.current || mapObj.current) return
    const g = google.maps
    mapObj.current = new g.Map(mapRef.current, {
      center: !isAll && singlePin ? { lat: singlePin.lat, lng: singlePin.lng } : LOUISIANA_CENTER,
      zoom: isAll ? 7 : 14,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: isAll,
      zoomControl: true,
      clickableIcons: false,
      // Whole zoom steps leave a lot of empty map around the state; this
      // lets fitBounds land in between.
      isFractionalZoomEnabled: true,
      gestureHandling: isAll ? 'cooperative' : 'none',
    })
    if (isAll) {
      const info = new g.InfoWindow({ maxWidth: 270 })
      info.addListener('closeclick', () => onSelectRef.current?.(null))
      infoRef.current = info
    } else if (singlePin) {
      singleMarkerRef.current = new g.Marker({
        position: { lat: singlePin.lat, lng: singlePin.lng },
        map: mapObj.current,
        title: props.mode === 'single' ? props.clubName : undefined,
        icon: {
          url: markerSvg(NAVY, GOLD, 30),
          scaledSize: new g.Size(30, 40),
          anchor: new g.Point(15, 40),
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // Rebuild markers when the shown clubs change, and frame them all.
  useEffect(() => {
    if (!isAll || !loaded || !mapObj.current) return
    const g = google.maps
    const map = mapObj.current

    markersRef.current.forEach(({ marker }) => marker.setMap(null))
    markersRef.current.clear()
    infoRef.current?.close()

    const bounds = new g.LatLngBounds()
    for (const club of clubs) {
      const pin = clubLocation(club)
      if (!pin) continue
      const marker = new g.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        title: club.name,
        icon: pinIcon(club, 'normal'),
        optimized: true,
      })
      marker.addListener('click', () => onSelectRef.current?.(club.id))
      markersRef.current.set(club.id, { marker, club, pin })
      bounds.extend(marker.getPosition()!)
    }

    // Frame what's shown: the whole state, or a region filter's clubs.
    const count = markersRef.current.size
    if (frame === 'state') {
      map.fitBounds(LOUISIANA_BOUNDS, 12)
    } else if (count === 1) {
      map.panTo(bounds.getCenter())
      map.setZoom(FOCUS_ZOOM)
    } else if (count > 1) {
      map.fitBounds(bounds, 48)
    } else {
      map.panTo(LOUISIANA_CENTER)
      map.setZoom(7)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, clubsKey, frame])

  // Selection and hover: restyle pins, and bring the selected club into view.
  useEffect(() => {
    if (!isAll || !loaded || !mapObj.current) return
    markersRef.current.forEach(({ marker, club }, id) => {
      const state: PinState = id === selectedId ? 'selected' : id === hoveredId ? 'hover' : 'normal'
      marker.setIcon(pinIcon(club, state))
      marker.setZIndex(state === 'selected' ? 1000 : state === 'hover' ? 900 : undefined)
    })
  }, [loaded, selectedId, hoveredId, clubsKey, isAll])

  useEffect(() => {
    if (!isAll || !loaded || !mapObj.current) return
    const map = mapObj.current
    const info = infoRef.current
    const entry = selectedId ? markersRef.current.get(selectedId) : undefined
    if (!entry) {
      info?.close()
      return
    }
    map.panTo(entry.marker.getPosition()!)
    if ((map.getZoom() ?? 7) < FOCUS_ZOOM) map.setZoom(FOCUS_ZOOM)
    if (info) {
      info.setContent(infoContent(entry.club, entry.pin))
      info.open({ map, anchor: entry.marker, shouldFocus: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, selectedId, clubsKey])

  // "You are here", once the visitor asks for clubs near them.
  useEffect(() => {
    if (!isAll || !loaded || !mapObj.current) return
    const g = google.maps
    userMarkerRef.current?.setMap(null)
    userMarkerRef.current = null
    if (!userLocation) return
    userMarkerRef.current = new g.Marker({
      position: userLocation,
      map: mapObj.current,
      title: 'You are here',
      icon: { url: USER_DOT, scaledSize: new g.Size(22, 22), anchor: new g.Point(11, 11) },
      zIndex: 1100,
      clickable: false,
    })
    // Frame the visitor and the three closest clubs.
    const nearest = [...markersRef.current.values()]
      .map((e) => ({ e, d: (e.pin.lat - userLocation.lat) ** 2 + (e.pin.lng - userLocation.lng) ** 2 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
    const bounds = new g.LatLngBounds(userLocation, userLocation)
    nearest.forEach(({ e }) => bounds.extend(e.marker.getPosition()!))
    mapObj.current.fitBounds(bounds, 64)
  }, [loaded, userLocation?.lat, userLocation?.lng, isAll])

  /** Back to every shown club, nothing selected. */
  function showAll() {
    onSelectRef.current?.(null)
    const map = mapObj.current
    if (!map) return
    if (frame === 'state') { map.fitBounds(LOUISIANA_BOUNDS, 12); return }
    if (markersRef.current.size === 0) return
    const bounds = new google.maps.LatLngBounds()
    markersRef.current.forEach(({ marker }) => bounds.extend(marker.getPosition()!))
    if (markersRef.current.size === 1) {
      map.panTo(bounds.getCenter())
      map.setZoom(FOCUS_ZOOM)
    } else {
      map.fitBounds(bounds, 48)
    }
  }

  if (!apiKey) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30 text-sm text-muted-foreground"
        style={{ height }}
      >
        Add VITE_GOOGLE_MAPS_API_KEY to .env.local to enable the map.
      </div>
    )
  }

  if (props.mode === 'single' && !singlePin) return null

  return (
    <div className="relative overflow-hidden rounded-xl border bg-[#f2efe6]" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {props.mode === 'single' && singlePin && (
        <a
          href={directionsUrl(singlePin)}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2.5 right-2.5 z-10 rounded-md bg-lca-navy px-2.5 py-1.5 text-xs font-semibold text-white shadow-md transition-colors hover:bg-lca-navy/90"
        >
          Get directions ↗
        </a>
      )}
      {isAll && loaded && selectedId && (
        <button
          type="button"
          onClick={showAll}
          className="absolute left-2.5 top-2.5 z-10 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-lca-navy shadow-md ring-1 ring-black/5 transition-colors hover:bg-muted"
        >
          ← Show all clubs
        </button>
      )}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
    </div>
  )
}
