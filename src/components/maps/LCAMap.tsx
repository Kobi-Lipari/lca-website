// src/components/maps/LCAMap.tsx
import { useEffect, useRef, useState } from 'react'
import { CLUB_MAP_PINS, type ClubMapPin } from '@/lib/clubMapData'
import { LCA } from '@/lib/brand'

declare global {
  interface Window {
    initLCAMap: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
  }
}

// Map styling takes the palette as raw hex; Google Maps has no idea what
// a Tailwind class is.
/** Gold is 2.28:1 on the white info window, so map links use a darker one.
 *  4.86:1 — the info window is Google's markup, outside the Tailwind theme. */
const GOLD_ON_LIGHT = '#8a6d1f'
const NAVY = LCA.navy
const GOLD = LCA.gold

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAP_STYLES: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#f5f5f0' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#333333' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d8e8' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6b93b0' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#e8e8e0' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ddd8c4' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: LCA.gold, lightness: 40 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: LCA.navy }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: LCA.navy }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0ede4' }] },
]

/** Brand pin: navy teardrop, gold inner dot (inverted on hover). */
function markerSvg(pinColor: string, dotColor: string, size = 24): string {
  const h = Math.round(size * 1.33)
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 24 32">` +
      `<path d="M12 1C7.3 1 3.5 4.8 3.5 9.5c0 6.6 8.5 21.5 8.5 21.5s8.5-14.9 8.5-21.5C20.5 4.8 16.7 1 12 1z" fill="${pinColor}" stroke="#ffffff" stroke-width="1.5"/>` +
      `<circle cx="12" cy="9.5" r="3.5" fill="${dotColor}"/>` +
      '</svg>'
    )
  )
}


function directionsUrl(pin: ClubMapPin): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`
}

function findPinByName(name: string): ClubMapPin | undefined {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const t = n(name)
  return (
    CLUB_MAP_PINS.find((p) => n(p.name) === t) ??
    CLUB_MAP_PINS.find((p) => n(p.name).includes(t) || t.includes(n(p.name)))
  )
}

function loadMapsScript(apiKey: string, onLoad: () => void) {
  if (window.google?.maps) { onLoad(); return }
  if (document.querySelector('script[data-lca-maps]')) {
    const prev = window.initLCAMap
    window.initLCAMap = () => { prev?.(); onLoad() }
    return
  }
  window.initLCAMap = onLoad
  const script = document.createElement('script')
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initLCAMap`
  script.async = true
  script.defer = true
  script.dataset.lcaMaps = '1'
  document.head.appendChild(script)
}

export interface DbClub {
  id: string
  name: string
  city?: string
}

interface AllClubsProps {
  mode: 'all'
  height?: number
  clubs?: DbClub[]
}

interface SingleClubProps {
  mode: 'single'
  clubName: string
  height?: number
}

type Props = AllClubsProps | SingleClubProps

function findDbClub(pinName: string, clubs: DbClub[]): DbClub | undefined {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const t = n(pinName)
  return (
    clubs.find((c) => n(c.name) === t) ??
    clubs.find((c) => n(c.name).includes(t) || t.includes(n(c.name)))
  )
}

export function LCAMap(props: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObj = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  const [loaded, setLoaded] = useState(false)

  const height = props.height ?? (props.mode === 'all' ? 480 : 240)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const singlePin = props.mode === 'single' ? findPinByName(props.clubName) : undefined
  const clubs = props.mode === 'all' ? (props.clubs ?? null) : null
  // Stable key: markers only rebuild when the actual set of clubs changes,
  // not when the parent re-renders with a new array identity (which used to
  // tear down and rebuild the whole map on every keystroke/filter change).
  const clubsKey = clubs ? clubs.map((c) => c.id).join(',') : 'all'

  useEffect(() => {
    if (!apiKey) return
    loadMapsScript(apiKey, () => setLoaded(true))
  }, [apiKey])

  // Create the map ONCE per mount.
  useEffect(() => {
    if (!loaded || !mapRef.current || mapObj.current) return
    const g = window.google.maps
    const center =
      props.mode === 'single' && singlePin
        ? { lat: singlePin.lat, lng: singlePin.lng }
        : { lat: 31.0, lng: -91.8 }

    mapObj.current = new g.Map(mapRef.current, {
      center,
      zoom: props.mode === 'single' ? 14 : 7,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: props.mode === 'all',
      zoomControl: true,
      gestureHandling: props.mode === 'all' ? 'cooperative' : 'none',
    })
    if (props.mode === 'all') {
      infoRef.current = new g.InfoWindow()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // Sync markers whenever the club set changes.
  useEffect(() => {
    if (!loaded || !mapObj.current) return
    const g = window.google.maps
    const map = mapObj.current
    const infoWindow = infoRef.current

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    infoWindow?.close()

    const dbClubs = clubs ?? []
    let pins: ClubMapPin[]
    if (props.mode === 'single') {
      pins = singlePin ? [singlePin] : []
    } else if (clubs) {
      // Pins follow the filtered/searched club list from the page.
      pins = CLUB_MAP_PINS.filter((pin) => findDbClub(pin.name, dbClubs))
    } else {
      pins = CLUB_MAP_PINS
    }

    pins.forEach((pin) => {
      const marker = new g.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        title: pin.name,
        icon: {
          url: markerSvg(NAVY, GOLD, 24),
          scaledSize: new g.Size(24, 32),
          anchor: new g.Point(12, 32),
        },
      })
      markersRef.current.push(marker)

      if (props.mode === 'all' && infoWindow) {
        marker.addListener('click', () => {
          const dbClub = findDbClub(pin.name, dbClubs)
          const clubLink = dbClub
            ? `<a href="/clubs/${dbClub.id}" style="font-size:12px;font-weight:600;color:${NAVY};text-decoration:underline;">View club page →</a>`
            : ''
          const dirLink =
            `<a href="${directionsUrl(pin)}" target="_blank" rel="noopener noreferrer" ` +
            `style="font-size:12px;font-weight:600;color:${GOLD_ON_LIGHT};text-decoration:underline;">Directions ↗</a>`
          infoWindow.setContent(
            `<div style="font-family:system-ui;max-width:240px;padding:4px 2px">` +
            `<p style="font-weight:600;color:${NAVY};margin:0 0 6px">${pin.name}</p>` +
            `<p style="font-size:12px;color:#555;margin:0;line-height:1.5">${pin.description}</p>` +
            `<div style="display:flex;gap:12px;margin-top:8px">${clubLink}${dirLink}</div>` +
            `</div>`,
          )
          infoWindow.open(map, marker)
        })
        marker.addListener('mouseover', () => {
          marker.setIcon({
            url: markerSvg(GOLD, NAVY, 28),
            scaledSize: new g.Size(28, 37),
            anchor: new g.Point(14, 37),
          })
        })
        marker.addListener('mouseout', () => {
          marker.setIcon({
            url: markerSvg(NAVY, GOLD, 24),
            scaledSize: new g.Size(24, 32),
            anchor: new g.Point(12, 32),
          })
        })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, clubsKey, singlePin])

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
    <div className="relative overflow-hidden rounded-xl border" style={{ height }}>
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
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
    </div>
  )
}