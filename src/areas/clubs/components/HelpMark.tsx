// src/areas/clubs/components/HelpMark.tsx
//
// A small question mark beside a part of a page, and the bubble of words it
// opens, which say what that part is for or how it is used (K's decision
// 16). My region and the one club editor draw one beside each part their
// Help speaks of, in place of the one large Help panel they had; the event
// approval panel could use it too.
//
// The mark is a plain disclosure. Its button is named "Help: " and the
// part's name, says whether it is open (aria-expanded), and its bubble
// follows it in the page's order, hidden from everyone while closed, so a
// screen reader's user presses the mark and reads on. The bubble is no
// dialog and no live region, takes no focus and holds nothing to stop at.
//
// A press (a click, a tap, Enter or Space) opens it and a second press
// closes it. A mouse that rests on the mark opens it after a short wait,
// and once that mouse has left both the mark and the bubble the bubble
// closes after a short wait; the mouse may cross from the mark onto the
// bubble. A touch never opens it by resting, and a bubble a press opened
// stays when the mouse leaves, and stays when the mouse comes to rest on
// another mark, which then opens nothing. Escape closes an open bubble,
// leaves the focus where it is and reaches nothing else; with no bubble
// open, Escape passes on untouched. A press anywhere else, or the focus
// moving to another control, closes it too (for a touch, once the touch ends
// in a tap, so a swipe to scroll keeps it open); a press on the bubble's own
// words keeps it open, even where the browser moves the focus to the box
// around it. The focus alone never opens it, so Tab through a form meets no
// bubble, and only one bubble on the page is open at a time. Nothing opens
// by itself and nothing is kept in the browser.
//
// The bubble is laid out in the page, under the mark's line, across the
// width of the nearest positioned part around it (the caller marks that part
// `relative`), never wider than 24rem, over what follows, so nothing moves
// when it opens. Inside a box that scrolls it is part of what the box
// scrolls. A press that opens a bubble whose foot is out of sight brings it
// into view by its nearest edge; a resting mouse never scrolls anything.
//
// Inside a shut fieldset, the observer's view-only form, a button is
// disabled whatever it is for, so there (HelpMarksShut, in
// src/areas/clubs/helpMarks.ts) the mark is a span
// with the role of a button, which a fieldset does not shut, and answers
// Enter and Space itself.
import { useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { HelpMarksShut } from '@/areas/clubs/helpMarks'

/** One entry of a part's Help: its term and its words. */
export type HelpEntry = readonly [term: string, words: string]

/** How long a resting mouse waits before the bubble opens, and before it closes once the mouse has left. */
const OPEN_AFTER = 150
const CLOSE_AFTER = 300

/**
 * The mark whose bubble is open, and how it was opened, so that opening
 * another closes it. A resting mouse never takes the place of a bubble a
 * press opened: it opens nothing while one is open, so a scroll that slides
 * another mark under a still mouse leaves the pressed bubble where it is.
 */
let openMark: { close: () => void; how: 'press' | 'pointer' | null } | null = null

/**
 * The mark: drawn 24 pixels across, its pressable area 44 pixels wide by a
 * layer that takes no room, reaching 10 pixels above the mark. Its margins
 * keep the mark's line no taller than the words beside it. Where a control
 * starts right under the line (`tight`, a mark on a label's line, above the
 * field's box), the mark stands on the line's foot and rises into the room
 * above it, and its area reaches no lower than the line; elsewhere it sits
 * on the line's middle and its area reaches 10 pixels below it, 44 in all.
 *
 * On a phone a label can end a few pixels short of its column's edge, where
 * a mark 8 pixels after it would drop onto a line of its own and make the
 * label's line twice as tall. So below sm a tight mark stands 4 pixels after
 * its label and takes 12 pixels less room on the line than it draws: at the
 * end of a full line it reaches up to 12 pixels past the column into the
 * box's own padding, never past the box. Its pressable area then starts at
 * the label's end, not over its words, and reaches further right, still 44
 * pixels wide.
 */
const MARK =
  'relative ml-2 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-muted outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-focus before:absolute before:-left-2 before:-right-3 before:-top-2.5'
const ROOMY = '-my-1 align-middle before:-bottom-2.5'
const TIGHT = '-mt-2 mb-0 align-bottom before:bottom-0 max-sm:ml-1 max-sm:-mr-3 max-sm:before:-left-1 max-sm:before:-right-4'

/** The bubble: a small card under the mark's line, as wide as its part allows up to 24rem. */
const BUBBLE =
  'absolute z-[5] mt-1 w-[min(24rem,100%)] whitespace-normal break-words rounded-md border border-hairline bg-card p-3 text-left text-sm font-normal normal-case leading-normal tracking-normal text-ink shadow-sm'

export function HelpMark({ name, entries, tight = false, align = 'start' }: {
  /** The part's own name, as its label, legend or heading says it. */
  name: string
  /** The words the bubble holds; a bubble of more than one entry names each entry's term. */
  entries: readonly HelpEntry[]
  /** A control starts right under the mark's line, so the pressable area reaches no lower than the mark. */
  tight?: boolean
  /** The bubble's side of its part: the start, or the end for a mark at the end of its row. */
  align?: 'start' | 'end'
}): ReactNode {
  const shut = useContext(HelpMarksShut)
  const id = useId()
  const [open, setOpen] = useState<'press' | 'pointer' | null>(null)
  const mark = useRef<HTMLElement | null>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const timers = useRef<{ open?: number; close?: number }>({})
  const bringIn = useRef(false)

  // This mark as the page knows it, the same object for its whole life.
  const [me] = useState(() => {
    const self = {
      how: null as 'press' | 'pointer' | null,
      clear() {
        window.clearTimeout(timers.current.open)
        window.clearTimeout(timers.current.close)
        timers.current = {}
      },
      /** Another mark's bubble is open and a press opened it. */
      pressedElsewhere() {
        return openMark !== null && openMark !== self && openMark.how === 'press'
      },
      show(how: 'press' | 'pointer') {
        self.clear()
        if (how === 'pointer' && self.pressedElsewhere()) return
        if (openMark && openMark !== self) openMark.close()
        openMark = self
        self.how = how
        setOpen(how)
      },
      close() {
        self.clear()
        self.how = null
        if (openMark === self) openMark = null
        setOpen(null)
      },
    }
    return self
  })

  // Every timer is cleared, and the page forgets this mark, once it leaves the page.
  useEffect(() => () => {
    me.clear()
    if (openMark === me) openMark = null
  }, [me])

  // While the bubble is open: Escape closes it and goes no further, and a press or a focus elsewhere closes it.
  //
  // A press on the mark or its words can move the focus to a part around
  // them that takes focus, such as the editor's scrolling box: a browser
  // focuses the nearest such part when a press lands on words, and some
  // browsers do so for a press on a button too. That focus comes of a press
  // inside, so it keeps the bubble open. It is remembered only until the
  // press ends in a click, is cancelled, or a key is pressed, so a Tab or a
  // Shift+Tab onto that part afterwards still closes the bubble.
  //
  // A touch outside closes the bubble on the click that ends it, not as the
  // finger lands: a finger that lands to swipe the page is not a press, and
  // the browser cancels it (pointercancel) once it sees a scroll, so a
  // person can swipe to read the rest of an open bubble.
  useEffect(() => {
    if (!open) return
    let pressedInside = false
    let touchedOutside = false
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (mark.current?.contains(target) || bubble.current?.contains(target))
    const around = (target: EventTarget | null) =>
      target instanceof Node && bubble.current !== null && target.contains(bubble.current)
    const onKey = (e: globalThis.KeyboardEvent) => {
      pressedInside = false
      touchedOutside = false
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      me.close()
    }
    const onPress = (e: Event) => {
      touchedOutside = false
      if (inside(e.target)) pressedInside = true
      else if ((e as globalThis.PointerEvent).pointerType === 'touch') touchedOutside = true
      else me.close()
    }
    const onPressEnd = () => {
      pressedInside = false
      if (touchedOutside) {
        touchedOutside = false
        me.close()
      }
    }
    const onCancel = () => {
      pressedInside = false
      touchedOutside = false
    }
    const onFocus = (e: Event) => {
      if (inside(e.target)) return
      if (pressedInside && around(e.target)) {
        pressedInside = false
        return
      }
      me.close()
    }
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onPress, true)
    document.addEventListener('click', onPressEnd, true)
    document.addEventListener('pointercancel', onCancel, true)
    document.addEventListener('focusin', onFocus, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onPress, true)
      document.removeEventListener('click', onPressEnd, true)
      document.removeEventListener('pointercancel', onCancel, true)
      document.removeEventListener('focusin', onFocus, true)
    }
  }, [open, me])

  // A bubble a press opened is brought into view by its nearest edge when its foot is out of sight.
  useEffect(() => {
    if (open !== 'press' || !bringIn.current) return
    bringIn.current = false
    bubble.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [open])

  function press() {
    if (open === 'press') {
      me.close()
      return
    }
    bringIn.current = true
    me.show('press')
  }

  function rest(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(timers.current.close)
    if (!open && !me.pressedElsewhere()) timers.current.open = window.setTimeout(() => me.show('pointer'), OPEN_AFTER)
  }

  function leave(e: PointerEvent) {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(timers.current.open)
    if (open === 'pointer') timers.current.close = window.setTimeout(() => me.close(), CLOSE_AFTER)
  }

  /** The span's own answer to Enter and Space, as a button gives; Space acts as it is let go, and never scrolls the page. */
  function keyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      press()
    } else if (e.key === ' ') {
      e.preventDefault()
    }
  }
  function keyUp(e: KeyboardEvent) {
    if (e.key === ' ') {
      e.preventDefault()
      press()
    }
  }

  const label = `Help: ${name}`
  const shared = {
    'aria-label': label,
    'aria-expanded': open !== null,
    'aria-controls': id,
    'data-slot': 'help-mark',
    className: cn(MARK, tight ? TIGHT : ROOMY),
    onPointerEnter: rest,
    onPointerLeave: leave,
  }
  const icon = <CircleHelp className="size-4" aria-hidden="true" />

  return (
    <span className="m-0 inline-block">
      {shut ? (
        <span ref={(el) => { mark.current = el }} role="button" tabIndex={0} {...shared} onClick={press} onKeyDown={keyDown} onKeyUp={keyUp}>{icon}</span>
      ) : (
        <button ref={(el) => { mark.current = el }} type="button" {...shared} onClick={press}>{icon}</button>
      )}
      <div
        ref={bubble}
        id={id}
        data-slot="help-mark-bubble"
        hidden={open === null}
        className={cn(BUBBLE, align === 'end' ? 'right-0' : 'left-0')}
        onPointerEnter={rest}
        onPointerLeave={leave}
      >
        {entries.length === 1 ? (
          <div>{entries[0][1]}</div>
        ) : (
          <dl className="space-y-2">
            {entries.map(([term, words]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd>{words}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </span>
  )
}
