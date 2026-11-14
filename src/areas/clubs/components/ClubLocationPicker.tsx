// src/areas/clubs/components/ClubLocationPicker.tsx
/// <reference types="google.maps" />
//
// Sets where a club's pin goes on the Clubs map. Click the map (or drag the
// pin) to place it, or paste coordinates or a Google Maps link. Saving goes
// through the normal club update, so admins, the club's rep and its regional
// representative can all do it.
//
// The club editor (src/areas/clubs/components/EditorPlaces.tsx) draws the
// same map and pasted coordinates bare: no heading, no words and no save of
// its own, with each new point handed to the form, which saves it with the
// rest on Save and publish. A second place's picker names its place in its
// label, its buttons and its line, so each of the two reads apart. While
// the editor saves, the bare picker is marked shut (`waiting`) and not
// disabled, so its box and its buttons keep the focus: the box is read
// only, a press of a button or Enter in the box does nothing, and the map
// takes no click or drag (WS09 step 9).
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MAP_STYLES, findPinByName, fitLouisiana, loadMapsScript } from '@/areas/clubs/clubMap'
import { LCA } from '@/lib/brand'
import { parseLocation, round6 } from '@/areas/clubs/mapLocation'

import type { LatLng } from '@/areas/clubs/mapLocation'

const PIN =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="45" viewBox="0 0 24 32">' +
    `<path d="M12 1C7.3 1 3.5 4.8 3.5 9.5c0 6.6 8.5 21.5 8.5 21.5s8.5-14.9 8.5-21.5C20.5 4.8 16.7 1 12 1z" fill="${LCA.gold}" stroke="#ffffff" stroke-width="1.5"/>` +
    `<circle cx="12" cy="9.5" r="3.6" fill="${LCA.navy}"/>` +
    '</svg>',
  )

/** The editor's bare picker: the id of its coordinates box, and where each new point goes (null once the pin is removed). */
export interface BarePicker {
  inputId: string
  onChange: (point: LatLng | null) => void
  /** The place it sets, such as "place 2", named in its words; the first place's picker names none. */
  place?: string
}

/** A control of the bare picker, shut by its aria-disabled mark as by disabled. */
const SHUT = 'min-h-11 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

export function ClubLocationPicker({
  clubName, latitude, longitude, disabled, waiting, onSave, bare,
}: {
  clubName: string
  latitude: number | null | undefined
  longitude: number | null | undefined
  disabled?: boolean
  /** The editor's save is under way: the bare picker is marked shut, never disabled, and takes no new point. */
  waiting?: boolean
  /** Saves the location (null removes it); resolves once saved. Today's card alone calls it. */
  onSave?: (location: LatLng | null) => Promise<void>
  /** Draws the map and the coordinates box alone, for the club editor's form. */
  bare?: BarePicker
}) {
  const saved: LatLng | null =
    typeof latitude === 'number' && typeof longitude === 'number' ? { lat: latitude, lng: longitude } : null
  // The original club list's spot stands in on today's card alone: the
  // editor sends the point it shows, so it shows only one a person set.
  const fallback = bare ? null : findPinByName(clubName)
  const [draft, setDraft] = useState<LatLng | null>(saved ?? (fallback ? { lat: fallback.lat, lng: fallback.lng } : null))
  const [paste, setPaste] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [loaded, setLoaded] = useState(false)

  const mapEl = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  // The map's click listener reads this, so it sees the latest value without
  // the map being made again. Updated after each render, not during one.
  const shut = !!disabled || !!waiting
  const disabledRef = useRef(shut)
  useEffect(() => {
    disabledRef.current = shut
  }, [shut])

  // The editor hears of each new point after the render that draws it.
  const onChange = useRef(bare?.onChange)
  useEffect(() => {
    onChange.current = bare?.onChange
  })
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    onChange.current?.(draft)
  }, [draft])

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
        draggable: !shut,
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
    markerRef.current.setDraggable(!shut)
  }, [loaded, draft, shut])

  function applyPasted() {
    if (waiting) return
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
    if (!onSave) return
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

  const mapBox = apiKey ? (
    <div className="relative h-72 overflow-hidden rounded-lg border bg-[#f2efe6]">
      <div ref={mapEl} className="h-full w-full" />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-on-light">Loading map…</div>
      )}
    </div>
  ) : null

  if (bare) {
    const errorId = `${bare.inputId}-error`
    const of = bare.place ? ` for ${bare.place}` : ''
    return (
      <div className="space-y-3">
        {mapBox}
        <div className="space-y-1.5">
          <Label htmlFor={bare.inputId}>{`Pin${of}: coordinates or a Google Maps link`}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={bare.inputId}
              value={paste}
              disabled={disabled}
              readOnly={waiting}
              aria-disabled={waiting || undefined}
              onChange={(e) => { if (!waiting) setPaste(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPasted() } }}
              aria-invalid={pasteError ? true : undefined}
              aria-describedby={pasteError ? errorId : undefined}
              className={SHUT}
            />
            <Button
              type="button" variant="outline" className={SHUT} disabled={disabled || !paste.trim()} aria-disabled={waiting || undefined}
              onClick={applyPasted}
            >
              {`Use this${of}`}
            </Button>
          </div>
          {pasteError && <p id={errorId} className="text-sm text-destructive">{pasteError}</p>}
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="text-sm tabular-nums text-ink">
            {draft ? `Pin${of} at ${draft.lat.toFixed(5)}, ${draft.lng.toFixed(5)}` : `No pin set${of}`}
          </p>
          {draft && (
            <Button
              type="button" variant="outline" className={SHUT} disabled={disabled} aria-disabled={waiting || undefined}
              onClick={() => { if (!waiting) setDraft(null) }}
            >
              {`Remove pin${of}`}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="size-5 text-gold-ink" />
        <h2 className="text-base font-semibold text-ink">Map location</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Where this club&rsquo;s pin goes on the Clubs map and its own page. Click the map where the club meets,
        or drag the pin to adjust.
        {!saved && fallback && ' It’s using the spot from the original club list until you save one.'}
        {!saved && !fallback && ' This club isn’t on the map yet.'}
      </p>

      {mapBox ?? (
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
          className="bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90"
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
      {note && <p className={note.ok ? 'mt-2 text-sm text-ok-700' : 'mt-2 text-sm text-destructive'}>{note.text}</p>}
    </div>
  )
}
