// src/components/maps/ClubLocationPicker.tsx
/// <reference types="google.maps" />
//
// Sets where a club's pin goes on the Clubs map. Click the map (or drag the
// pin) to place it, or paste coordinates or a Google Maps link. Saving goes
// through the normal club update, so admins, the club's rep and its regional
// representative can all do it.
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MAP_STYLES, findPinByName, fitLouisiana, loadMapsScript } from '@/components/maps/LCAMap'
import { LCA } from '@/lib/brand'
import { parseLocation, round6 } from '@/lib/mapLocation'

import type { LatLng } from '@/lib/mapLocation'

const PIN =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="45" viewBox="0 0 24 32">' +
    `<path d="M12 1C7.3 1 3.5 4.8 3.5 9.5c0 6.6 8.5 21.5 8.5 21.5s8.5-14.9 8.5-21.5C20.5 4.8 16.7 1 12 1z" fill="${LCA.gold}" stroke="#ffffff" stroke-width="1.5"/>` +
    `<circle cx="12" cy="9.5" r="3.6" fill="${LCA.navy}"/>` +
    '</svg>',
  )

export function ClubLocationPicker({
  clubName, latitude, longitude, disabled, onSave,
}: {
  clubName: string
  latitude: number | null | undefined
  longitude: number | null | undefined
  disabled?: boolean
  /** Saves the location (null removes it); resolves once saved. */
  onSave: (location: LatLng | null) => Promise<void>
}) {
  const saved: LatLng | null =
    typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null
  const fallback = findPinByName(clubName)
  const [draft, setDraft] = useState<LatLng | null>(saved ?? (fallback ? { lat: fallback.lat, lng: fallback.lng } : null))
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  useEffect(() => {
    if (apiKey) loadMapsScript(apiKey, () => setLoaded(true))
  }, [apiKey])

  // Create the map once.
  useEffect(() => {
    if (!loaded || !mapEl.current || mapRef.current) return
    const g = google.maps
    const map = new g.Map(mapEl.current, {
      center: draft ?? { lat: 31, lng: -91.8 },
      zoom: draft ? 13 : 7,
      styles: MAP_STYLES,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      isFractionalZoomEnabled: true,
      draggableCursor: 'crosshair',
    })
    if (!draft) fitLouisiana(map, 8)
    map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (disabledRef.current || !e.latLng) return
      setDraft({ lat: round6(e.latLng.lat()), lng: round6(e.latLng.lng()) })
    })
    mapRef.current = map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // Keep the pin where the draft is.
  useEffect(() => {
    if (!loaded || !mapRef.current) return
    const g = google.maps
    if (!draft) {
      markerRef.current?.setMap(null)
      markerRef.current = null
      return
    }
    if (!markerRef.current) {
      const marker = new g.Marker({
        optimized: false,
        map: mapRef.current,
        position: draft,
        draggable: !disabled,
        icon: { url: PIN, scaledSize: new g.Size(34, 45), anchor: new g.Point(17, 45) },
        title: 'Drag to adjust',
      })
      marker.addListener('dragend', () => {
        const p = marker.getPosition()
        if (p) setDraft({ lat: round6(p.lat()), lng: round6(p.lng()) })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setPosition(draft)
    }
    markerRef.current.setDraggable(!disabled)
  }, [loaded, draft, disabled])

  function applyPasted() {
    const parsed = parseLocation(paste)
    if (!parsed) {
      setPasteError('Couldn’t find coordinates in that. Paste something like 30.4515, -91.1871 or a Google Maps link.')
      return
    }
    setPasteError(null)
    setPaste('')
    setDraft(parsed)
    mapRef.current?.panTo(parsed)
    mapRef.current?.setZoom(15)
  }

  async function save(location: LatLng | null) {
    setBusy(true)
    setNote(null)
    try {
      await onSave(location)
      setNote({ ok: true, text: location ? 'Map location saved.' : 'Map location removed.' })
      if (!location) setDraft(fallback ? { lat: fallback.lat, lng: fallback.lng } : null)
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Could not save the location' })
    } finally {
      setBusy(false)
    }
  }

  const changed = !!draft && (!saved || draft.lat !== saved.lat || draft.lng !== saved.lng)

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="size-5 text-lca-gold" />
        <h2 className="text-base font-semibold text-lca-navy">Map location</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Where this club&rsquo;s pin goes on the Clubs map and its own page. Click the map where the club meets,
        or drag the pin to adjust.
        {!saved && fallback && ' It’s using the spot from the original club list until you save one.'}
        {!saved && !fallback && ' This club isn’t on the map yet.'}
      </p>

      {apiKey ? (
        <div className="relative h-72 overflow-hidden rounded-lg border bg-[#f2efe6]">
          <div ref={mapEl} className="h-full w-full" />
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading map…</div>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">The map isn&rsquo;t available here, but you can paste coordinates below.</p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          value={paste}
          disabled={disabled}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPasted() } }}
          placeholder="Or paste coordinates or a Google Maps link"
          aria-label="Coordinates or Google Maps link"
          className="text-sm"
        />
        <Button type="button" variant="outline" disabled={disabled || !paste.trim()} onClick={applyPasted}>Use this</Button>
      </div>
      {pasteError && <p className="mt-1.5 text-xs text-destructive">{pasteError}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90"
          disabled={disabled || busy || !changed}
          onClick={() => draft && save(draft)}
        >
          {busy ? 'Saving…' : 'Save map location'}
        </Button>
        {saved && (
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => save(null)}
            className="text-sm text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
          >
            Remove saved location
          </button>
        )}
        {draft && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
          </span>
        )}
      </div>
      {note && <p className={note.ok ? 'mt-2 text-sm text-emerald-700' : 'mt-2 text-sm text-destructive'}>{note.text}</p>}
    </div>
  )
}
