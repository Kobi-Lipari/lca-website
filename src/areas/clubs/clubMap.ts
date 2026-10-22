// src/areas/clubs/clubMap.ts
/// <reference types="google.maps" />
//
// What the club maps share that is not a component: the base map's style,
// the whole-state view, where a club goes on the map, the directions link and
// the loader for the Google Maps script. LCAMap and ClubLocationPicker draw
// the maps; these live in their own module because a component file exports
// only components (react-refresh/only-export-components).
import { CLUB_MAP_PINS, type ClubMapPin } from '@/areas/clubs/clubMapData'
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
const NAVY = LCA.navy

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

/**
 * Fits the whole-state view, keeping the town names readable.
 *
 * Google draws the base map from whole zoom levels and scales it for the
 * levels in between, rounding to the nearest one. Just under a half step
 * (7.49) it scales the zoom 7 map up and the names come out large; just
 * over (7.51) it scales the zoom 8 map down and they come out tiny, with
 * every small town crowding in. So a fit that lands in the lower part of
 * that second range is eased back to just under the half step: a few
 * percent looser, much more readable.
 */
export function fitLouisiana(map: google.maps.Map, padding = 12) {
  const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
    const z = map.getZoom()
    if (z == null) return
    const step = Math.floor(z)
    const frac = z - step
    if (frac >= 0.5 && frac < 0.75) map.setZoom(step + 0.49)
  })
  // If the view was already there, no 'idle' comes; don't leave the
  // listener waiting to re-zoom after the visitor's own next pan.
  window.setTimeout(() => listener.remove(), 2000)
  map.fitBounds(LOUISIANA_BOUNDS, padding)
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
