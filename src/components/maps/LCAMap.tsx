import { useEffect, useRef, useState } from 'react'
import { CLUB_MAP_PINS, type ClubMapPin } from '@/lib/clubMapData'

declare global {
  interface Window {
    initLCAMap: () => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google: any
  }
}

const NAVY = '#1a2744'
const GOLD = '#c8a94a'

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
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#c8a94a', lightness: 40 }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#1a2744' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#1a2744' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f0ede4' }] },
]

function markerSvg(color: string, size = 24): string {
  const h = Math.round(size * 1.33)
  return (
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 24 32">` +
      `<path d="M12 0C7.03 0 3 4.03 3 9c0 7 9 23 9 23s9-16 9-23c0-4.97-4.03-9-9-9z" fill="${color}" stroke="#fff" stroke-width="1.5"/>` +
      `<circle cx="12" cy="9" r="3.5" fill="#fff"/>` +
      '</svg>'
    )
  )
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
  const [loaded, setLoaded] = useState(false)
  const height = props.height ?? (props.mode === 'all' ? 480 : 240)
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const singlePin = props.mode === 'single' ? findPinByName(props.clubName) : undefined

  useEffect(() => {
    if (!apiKey) return
    loadMapsScript(apiKey, () => setLoaded(true))
  }, [apiKey])

  useEffect(() => {
    if (!loaded || !mapRef.current) return

    const g = window.google.maps
    const dbClubs = props.mode === 'all' ? ((props as AllClubsProps).clubs ?? []) : []
    const pins: ClubMapPin[] =
      props.mode === 'single' ? (singlePin ? [singlePin] : []) : CLUB_MAP_PINS
    const center =
      props.mode === 'single' && singlePin
        ? { lat: singlePin.lat, lng: singlePin.lng }
        : { lat: 31.0, lng: -91.8 }

    const map = new g.Map(mapRef.current, {
      center,
      zoom: props.mode === 'single' ? 14 : 7,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: props.mode === 'all',
      zoomControl: true,
      gestureHandling: props.mode === 'all' ? 'cooperative' : 'none',
    })

    const infoWindow = props.mode === 'all' ? new g.InfoWindow() : null

    pins.forEach((pin) => {
      const marker = new g.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map,
        title: pin.name,
        icon: {
          url: markerSvg(NAVY, 24),
          scaledSize: new g.Size(24, 32),
          anchor: new g.Point(12, 32),
        },
      })

      if (props.mode === 'all' && infoWindow) {
        marker.addListener('click', () => {
          const dbClub = findDbClub(pin.name, dbClubs)
          const link = dbClub
            ? `<a href="/clubs/${dbClub.id}" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:${NAVY};text-decoration:underline;">View club page →</a>`
            : ''
          infoWindow.setContent(
            `<div style="font-family:system-ui;max-width:240px;padding:4px 2px">` +
            `<p style="font-weight:600;color:${NAVY};margin:0 0 6px">${pin.name}</p>` +
            `<p style="font-size:12px;color:#555;margin:0;line-height:1.5">${pin.description}</p>` +
            link +
            `</div>`,
          )
          infoWindow.open(map, marker)
        })
        marker.addListener('mouseover', () => {
          marker.setIcon({
            url: markerSvg(GOLD, 28),
            scaledSize: new g.Size(28, 37),
            anchor: new g.Point(14, 37),
          })
        })
        marker.addListener('mouseout', () => {
          marker.setIcon({
            url: markerSvg(NAVY, 24),
            scaledSize: new g.Size(24, 32),
            anchor: new g.Point(12, 32),
          })
        })
      }
    })
  }, [loaded, props.mode, singlePin, props.mode === 'all' ? (props as AllClubsProps).clubs : null])

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
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
    </div>
  )
}
