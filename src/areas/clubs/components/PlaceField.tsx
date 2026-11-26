// src/areas/clubs/components/PlaceField.tsx
//
// The Clubs directory's one field and Near me (WS09 step 34).
//   - One field, "City, ZIP or club name", with its label in sight and a
//     small question mark beside it that says how the field is used and
//     what becomes of a place. The directory reads what was typed once the
//     typing pauses, or at once on Enter: a ZIP code or a Louisiana town
//     orders the list nearest first, and other text narrows it by name.
//   - Near me asks the browser where the device is once, on its press and
//     never before it, and turns the answer into the nearest ZIP code here,
//     in the browser (domain/clubs/nearZip.ts). Only that ZIP code is passed
//     on, to go into the page's address; the device's own point is a local
//     value of the answer's callback, kept in no state, no storage and no log
//     line, and sent in no request. A second press while the device is asked
//     does nothing more. A device that will not say, a browser that cannot
//     ask and a point outside Louisiana are each passed on as words, and the
//     focus comes back to the field, so no one waits on a spinner. Ten
//     seconds without an answer are passed on as words too, with the focus
//     left where it is, since the person may still be answering the
//     browser's own question; the ask stays open, and a position that comes
//     after them is passed on as if it had come in time (the directory lets
//     it go once a place has been typed, chosen or cleared since), while a
//     late refusal or failure passes on nothing.
//   - Once a place is known, the pill "Near you: {town} {ZIP}", or "Near you:
//     {ZIP}" for a ZIP code area with no town, with its button "Clear
//     location".
import { useEffect, useId, useRef, type RefObject } from 'react'
import { Navigation, X } from 'lucide-react'

import { nearestZip } from '@domain/clubs/nearZip'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { CLEAR_PLACE, DEVICE_WAIT_MS, FIELD_HELP, FIELD_LABEL, NEAR_ME, nearYou } from '@/areas/clubs/directoryWords'

/** A point the device gives that lies farther than this from every ZIP code area's point is outside Louisiana, in miles. */
export const FARTHEST_MILES = 25

/** What Near me found: the nearest ZIP code, or why there is none. The device's own point is never one of them. */
export type DeviceAnswer =
  | { kind: 'asking' }
  | { kind: 'zip'; zip: string }
  | { kind: 'outside' }
  | { kind: 'failed' }
  | { kind: 'unsupported' }
  | { kind: 'slow' }

const BUTTON = 'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-hairline bg-surface px-3 text-sm font-semibold text-ink outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus'

export function PlaceField({ text, onText, onEnter, place, onClearPlace, onDevice, asking, fieldRef }: {
  /** What is in the field. */
  text: string
  onText: (text: string) => void
  /** Enter was pressed in the field: read it now, without waiting for the pause. */
  onEnter: () => void
  /** The place the list is ordered from, as the pill words it (its town null for a ZIP code area with none), or null. */
  place: { town: string | null; zip: string } | null
  onClearPlace: () => void
  /** What Near me found. */
  onDevice: (answer: DeviceAnswer) => void
  /** True while the directory still waits on the device: once a typed or cleared place takes its place, the ask is let go. */
  asking: boolean
  fieldRef: RefObject<HTMLInputElement | null>
}) {
  const id = useId()
  // The ask that is on its way, by its number, so a late answer to an earlier ask is let go; and the timer that stops the wait.
  const asks = useRef(0)
  const waiting = useRef(false)
  // True once the ten seconds have run out on the ask that is on its way, which a position may still answer.
  const late = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    asks.current += 1
    window.clearTimeout(timer.current)
  }, [])

  // The directory has stopped waiting (a place was typed or cleared, or the answer came): an answer still on its way is let go, and Near me can be pressed again.
  useEffect(() => {
    if (asking || !waiting.current) return
    asks.current += 1
    waiting.current = false
    window.clearTimeout(timer.current)
  }, [asking])

  /** The answer to an ask, passed on once; `byClock` when it is the page's own ten seconds that ran out. */
  function finish(ask: number, answer: DeviceAnswer, byClock = false) {
    if (ask !== asks.current) return
    if (!waiting.current) {
      // After the ten seconds, a position is passed on as if it had come in time; a late refusal or failure, nothing.
      if (!late.current || (answer.kind !== 'zip' && answer.kind !== 'outside')) return
      late.current = false
      onDevice(answer)
      if (answer.kind === 'outside') fieldRef.current?.focus()
      return
    }
    waiting.current = false
    window.clearTimeout(timer.current)
    late.current = byClock
    onDevice(answer)
    // The page's own ten seconds leave the focus where it is: the person may still be answering the browser's question.
    if (answer.kind !== 'zip' && !byClock) fieldRef.current?.focus()
  }

  function nearMe() {
    if (waiting.current) return
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      onDevice({ kind: 'unsupported' })
      fieldRef.current?.focus()
      return
    }
    asks.current += 1
    const ask = asks.current
    waiting.current = true
    late.current = false
    onDevice({ kind: 'asking' })
    // The browser's own timeout starts only once the person has allowed the ask, so the page keeps a clock of its own as well.
    timer.current = window.setTimeout(() => finish(ask, { kind: 'slow' }, true), DEVICE_WAIT_MS)
    try {
      geolocation.getCurrentPosition(
        (position) => {
          const near = nearestZip({ latitude: position.coords.latitude, longitude: position.coords.longitude })
          finish(ask, near.miles > FARTHEST_MILES ? { kind: 'outside' } : { kind: 'zip', zip: near.zip })
        },
        // Code 3 is the browser's own timeout; 1, a refusal, and 2, no answer to be had, read as failed.
        (error) => finish(ask, error?.code === 3 ? { kind: 'slow' } : { kind: 'failed' }),
        { enableHighAccuracy: false, timeout: DEVICE_WAIT_MS, maximumAge: 0 },
      )
    } catch {
      finish(ask, { kind: 'failed' })
    }
  }

  return (
    <div className="relative">
      <div className="flex items-end">
        <label htmlFor={id} className="text-sm font-semibold text-ink">{FIELD_LABEL}</label>
        <HelpMark name={FIELD_LABEL} entries={[[FIELD_LABEL, FIELD_HELP]]} tight />
      </div>
      <form
        role="search"
        aria-label={FIELD_LABEL}
        className="mt-1 flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          onEnter()
        }}
      >
        <input
          ref={fieldRef}
          id={id}
          type="text"
          value={text}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          onChange={(event) => onText(event.target.value)}
          className="min-h-11 min-w-0 flex-1 basis-48 rounded-md border border-field bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-focus"
        />
        <button type="button" onClick={nearMe} className={BUTTON}>
          <Navigation className="size-4" aria-hidden="true" />
          {NEAR_ME}
        </button>
      </form>
      {place && (
        <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-hairline bg-surface py-0.5 pl-3 pr-1 text-sm text-ink">
          <span className="min-w-0 break-words">{nearYou(place.town, place.zip)}</span>
          <button
            type="button"
            aria-label={CLEAR_PLACE}
            onClick={onClearPlace}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </p>
      )}
    </div>
  )
}
