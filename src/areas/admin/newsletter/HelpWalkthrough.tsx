// src/areas/admin/newsletter/HelpWalkthrough.tsx
//
// Help's walkthrough on the newsletter's own page (board Newsletter-Page-4,
// "Help, step 3 of 6"): six cards, one at a time, each pointing at the part
// of the page it is about.
//
// Each card's title is the name its part has on the page, and its sentence
// is the board's sentence with that name taken off its front, as the board
// draws step 3 ("Subject", then "The line people see in their inbox. Click it
// to change it."). Where a part is drawn differently by the window's width,
// the card points at what is there: under 1024 pixels there is no side, so
// step 5 points at "See the email"; under 768 there is no test button, so
// step 6 does too.
//
// Help never says what the page cannot do today. While Send on the bar is
// drawn quiet, step 6 does not tell a person to send: it says sending to
// members from this page is not available yet. "Then send." comes back by
// the one condition in helpSteps once Send is wired.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'

/** The page's form by the window's width: the computer's from 1024 pixels up, the tablet's from 768, the phone's under. */
export type HelpWidth = 'desk' | 'tablet' | 'phone'

/** What a card points at, found on the page by the page itself. */
export type HelpTarget = 'pick' | 'from' | 'subject' | 'letter' | 'side' | 'see' | 'send'

export interface HelpStep {
  target: HelpTarget
  title: string
  /** The card's sentences, each its own line. */
  words: string[]
}

/** The card's sentence from the board's: the target's name, and the "is" after it, taken off its front. */
function offFront(sentence: string, name: string): string {
  if (!sentence.startsWith(name)) return sentence
  const rest = sentence.slice(name.length).replace(/^,?\s+(is\s+)?/, '')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

/**
 * The six cards, in order, for the page's form at this width. `sendReady` is whether Send on the bar sends: the one
 * place "Then send." is said or left out.
 */
function helpSteps(width: HelpWidth, sendReady: boolean): HelpStep[] {
  const pick = 'Pick a template to start from'
  const side = width === 'desk' ? 'What members will get' : 'See the email'
  const step6: HelpStep =
    width === 'phone'
      ? // Its own title, so Next from step 5, which lights the same button, is seen to move on.
        { target: 'see', title: 'Send a test', words: ['Send yourself a test from a computer or a tablet.'] }
      : {
          target: 'send',
          title: 'Send a test to me',
          words: sendReady
            ? ['Send a test to yourself first. Then send.']
            : ['Send a test to yourself first.', 'Sending to members from this page is not available yet.'],
        }
  return [
    {
      target: 'pick',
      title: pick,
      words: [
        offFront('Pick a template to start from, in the bar at the foot: a blank letter, a template or a past newsletter. It saves time: pick one, then change the words.', pick),
        'If you have already written something, we ask before replacing it, and keep your words under Your last newsletters.',
      ],
    },
    { target: 'from', title: 'From', words: [offFront('From is who members see as the sender.', 'From')] },
    { target: 'subject', title: 'Subject', words: [offFront('Subject is the line people see in their inbox. Click it to change it.', 'Subject')] },
    {
      target: 'letter',
      title: 'The letter',
      words: ['Click anywhere on the letter and type. It saves by itself.', 'The "In this issue" list is made from your headings. It updates by itself.'],
    },
    {
      target: width === 'desk' ? 'side' : 'see',
      title: side,
      words: [width === 'desk' ? 'The side shows what members will get. It changes as you type.' : 'Shows what members will get. It changes as you type.'],
    },
    step6,
  ]
}

export interface HelpWalkthroughProps {
  /** The page's form by the window's width. */
  width: HelpWidth
  /** Whether Send on the bar sends (helpSteps). */
  sendReady: boolean
  /** Skip, Escape, a press on the dim and Done on the last step each close it. */
  onClose: () => void
  /** Help, which takes the focus back as it closes, however it was opened. */
  opener: () => HTMLElement | null
  /** The saved line's refusals that come while it hides the page (SavedLineNotice), said inside the card. */
  notice?: ReactNode
}

/** The element the site is drawn in (index.html, src/main.tsx): the page behind the walkthrough, whose portal stands outside it. */
const SITE_ROOT_ID = 'root'

/** The card's words, the board's: "N of 6" small and quiet, the title bold, the sentence under it. */
const STEP_COUNT = 'text-[12.5px] font-semibold leading-snug text-muted-foreground'
const TITLE = 'mt-[3px] text-lg font-bold leading-tight text-ink'
const LINE = 'mt-1 text-[14.5px] leading-[1.45] text-ink'

/**
 * The card's buttons, the board's, each at least 44 pixels tall: Skip quiet and underlined, Back outlined, Next navy.
 * They stand in a row at the card's foot that does not scroll, so on a short window the words scroll and the way on or
 * out is always in view. Forced colours draw no ring (a box shadow), so there the focus is an outline; it names its
 * style as well as its width, because outline-none has set the style to none.
 */
const BUTTON_ROW = 'flex flex-none flex-wrap items-center justify-end gap-2 px-4 pb-4 pt-3'
const FOCUS =
  'outline-none focus-visible:ring-3 focus-visible:ring-focus forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-offset-2'
const SKIP = `inline-flex min-h-11 items-center rounded-md px-2.5 text-[14.5px] font-semibold text-muted-foreground underline underline-offset-3 hover:no-underline ${FOCUS}`
const BACK = `inline-flex min-h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[14.5px] font-semibold text-ink ${FOCUS}`
const NEXT = `inline-flex min-h-11 items-center rounded-lg border border-transparent bg-brand-navy px-4 text-[14.5px] font-semibold text-white ${FOCUS} focus-visible:ring-offset-2`

/** Where a lit target stands in the window, in pixels. */
interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** The room between the target and its ring, the white's 4 pixels and the gold's 4. */
const RING = 8

/** The first one drawn: the bar and the page draw some parts in two forms, one of them hidden by the window's width. */
function drawn(elements: (Element | null | undefined)[]): HTMLElement | null {
  const there = elements.filter((element): element is HTMLElement => element instanceof HTMLElement)
  return there.find((element) => element.getClientRects().length > 0) ?? there[0] ?? null
}

/**
 * What a step points at, found through what the page already draws: the bar's own slots and its steps' names, the
 * From and Subject group by its name, the letter's sheet and the side by their slots. The side put away by Hide is
 * not lit: "Show the email", which brings it back, is. "See the email" is found wherever the page draws it, in the
 * bar on a phone and in the page's head on a tablet. Step 6 from 768 pixels up is the bar's steps 2 and 3 together.
 * Nothing found lights nothing, and the card still reads.
 */
function findTarget(target: HelpTarget): HTMLElement[] {
  const page = document.getElementById(SITE_ROOT_ID) ?? document.body
  const bar = page.querySelector('[data-slot="foot-bar"]')
  const row = page.querySelector('[role="group"][aria-label="Who it is from and its subject"]')
  const one = (element: HTMLElement | null) => (element ? [element] : [])
  const named = (name: string) => Array.from(page.querySelectorAll('button')).filter((button) => button.textContent?.trim() === name)
  switch (target) {
    case 'pick':
      return one(drawn(Array.from(bar?.querySelectorAll('[data-slot="pick-step"]') ?? [])))
    case 'from':
      return one(drawn([row?.firstElementChild]))
    case 'subject':
      return one(drawn([Array.from(row?.querySelectorAll('label') ?? []).find((label) => label.textContent?.trim() === 'Subject')?.parentElement]))
    case 'letter':
      return one(drawn([page.querySelector('[data-slot="letter-sheet"]')]))
    case 'side': {
      const side = page.querySelector('[data-slot="side-preview"]')
      return one(side && !side.closest('[hidden]') ? drawn([side]) : drawn(named('Show the email')))
    }
    case 'see':
      return one(drawn(named('See the email')))
    case 'send':
      return ['-2-words', '-3-words'].flatMap((end) => one(drawn([bar?.querySelector(`button[aria-labelledby$="${end}"]`)?.parentElement])))
  }
}

/** One box round them all, as the window shows them; none where nothing has a size, so a part not drawn lights nothing. */
function boxOf(elements: HTMLElement[]): Box | null {
  const rects = elements.map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 || rect.height > 0)
  if (rects.length === 0) return null
  const top = Math.min(...rects.map((rect) => rect.top))
  const left = Math.min(...rects.map((rect) => rect.left))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  const right = Math.max(...rects.map((rect) => rect.right))
  return { top, left, width: right - left, height: bottom - top }
}

/**
 * The room the page shows, in pixels, as the window draws it now: from the foot of the site's header (its --header-h,
 * as the chooser reads it) to the top of the dock at the foot, which holds the page's bar and, on a phone, the tab bar.
 */
function room(): { rem: number; top: number; floor: number } {
  const root = document.documentElement
  const rem = Number.parseFloat(getComputedStyle(root).fontSize) || 16
  const top = Number.parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 4 * rem
  const feet = ['[data-slot="bottom-dock"]', '[data-slot="foot-bar"]']
    .map((slot) => document.querySelector(slot)?.getBoundingClientRect())
    .filter((rect): rect is DOMRect => !!rect && rect.height > 0)
  return { rem, top, floor: Math.min(window.innerHeight, ...feet.map((rect) => rect.top)) }
}

/**
 * The lit box held to what the window shows of it, with room for its ring: below the header, and above the bar at the
 * foot, so the bar's buttons are never shown lit as if part of the letter. A part in the bar is held to the window's
 * foot instead. None where nothing of it is left in view.
 */
function heldInView(box: Box | null, inBar: boolean): Box | null {
  if (!box) return null
  const { top, floor } = room()
  const upper = Math.max(box.top, top + RING)
  const lower = Math.min(box.top + box.height, (inBar ? window.innerHeight : floor) - RING)
  return lower > upper ? { ...box, top: upper, height: lower - upper } : null
}

/** The dim with a cut where the target is: the whole window, then the ring's box, filled even-odd so the box is left clear. */
function cutOut(box: Box | null): string | undefined {
  if (!box) return undefined
  const t = box.top - RING
  const l = box.left - RING
  const b = box.top + box.height + RING
  const r = box.left + box.width + RING
  return `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}px ${t}px, ${l}px ${b}px, ${r}px ${b}px, ${r}px ${t}px, ${l}px ${t}px)`
}

/**
 * Where the card stands: under its target where there is room, else above it, else beside it, else in the larger of the
 * rooms above and below it, held to that room, else in the middle of the room left; always held three quarters of a rem clear of the site's header (its --header-h, as the chooser reads it)
 * and of the dock at the foot, which holds the page's bar and, on a phone, the tab bar; a rem inside the window's sides.
 * Its height is held to that room, and it scrolls inside itself where the window is shorter. Read again whenever the
 * lit box is measured again, so it moves with the window.
 */
function placeCard(card: HTMLElement, box: Box | null) {
  const shown = room()
  const rem = shown.rem
  const gap = 0.75 * rem
  const top = shown.top + gap
  const floor = shown.floor - gap
  card.style.setProperty('max-height', `${Math.max(0, floor - top)}px`)
  const height = Math.min(card.offsetHeight, floor - top)
  const width = card.offsetWidth
  const inside = (left: number) => Math.max(rem, Math.min(left, window.innerWidth - width - rem))
  let side: 'below' | 'above' | 'right' | 'left' | 'middle' = 'middle'
  let at = { top: top + Math.max(0, (floor - top - height) / 2), left: inside((window.innerWidth - width) / 2) }
  if (box) {
    const under = box.top + box.height + RING + gap
    const over = box.top - RING - gap - height
    const right = box.left + box.width + RING + gap
    const left = box.left - RING - gap - width
    const level = Math.max(top, Math.min(box.top, floor - height))
    // Where no side holds it whole, the larger of the rooms above and below, held to that room's height so its words
    // scroll inside it, rather than the middle, which on a short window is where the lit field is. The middle is kept
    // only where neither room holds its buttons' row (5 rem), as with the letter, which is taller than the window.
    const roomOver = box.top - RING - gap - top
    const roomUnder = floor - under
    if (under + height <= floor) [side, at] = ['below', { top: under, left: inside(box.left) }]
    else if (over >= top) [side, at] = ['above', { top: over, left: inside(box.left) }]
    else if (right + width <= window.innerWidth - rem) [side, at] = ['right', { top: level, left: right }]
    else if (left >= rem) [side, at] = ['left', { top: level, left }]
    else if (Math.max(roomOver, roomUnder) >= 5 * rem) {
      const held = Math.max(roomOver, roomUnder)
      card.style.setProperty('max-height', `${held}px`)
      if (roomOver >= roomUnder) [side, at] = ['above', { top: box.top - RING - gap - Math.min(height, held), left: inside(box.left) }]
      else [side, at] = ['below', { top: under, left: inside(box.left) }]
    }
  }
  card.dataset.side = side
  card.style.setProperty('top', `${at.top}px`)
  card.style.setProperty('left', `${at.left}px`)
}

/**
 * The walkthrough, drawn by the page only while it is open, so each opening starts at step 1. Skip (quiet,
 * underlined), Back (outlined, from step 2) and Next (navy; "Done" on the last step) are the card's only buttons, as
 * the board draws them: there is no separate Close.
 */
export function HelpWalkthrough({ width, sendReady, onClose, opener, notice }: HelpWalkthroughProps) {
  const [at, setAt] = useState(0)
  const card = useRef<HTMLDivElement>(null)
  const next = useRef<HTMLButtonElement>(null)
  const steps = helpSteps(width, sendReady)
  const step = steps[at]
  const last = at === steps.length - 1
  const where = `${at + 1} of ${steps.length}`
  // While it is open the site's root is inert, as the chooser and the email's sheet make it; let go as it closes, in the
  // same moment, so Help can take the focus back. A root made inert by something else is left as it is.
  useLayoutEffect(() => {
    const root = document.getElementById(SITE_ROOT_ID)
    if (!root || root.hasAttribute('inert')) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [])
  // On a new step the focus stays on the button pressed; where that button is gone (Back, on going back to step 1), it
  // moves to Next. The step's words are said once, politely; nothing is said as it opens, when the card's name is.
  const [said, setSaid] = useState('')
  const go = (to: number) => {
    setAt(to)
    setSaid(`Step ${to + 1} of ${steps.length}. ${steps[to].title}. ${steps[to].words.join(' ')}`)
  }
  // The step's target is brought into view first, then lit: a cut in the dim, with the ring round it. It is measured
  // again as the window changes or scrolls, so the cut stays on it, and held between the header and the bar.
  const [lit, setLit] = useState<Box | null>(null)
  useLayoutEffect(() => {
    const targets = findTarget(step.target)
    targets[0]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    const inBar = targets.some((target) => target.closest('[data-slot="foot-bar"], [data-slot="bottom-dock"]'))
    const measure = () => setLit(heldInView(boxOf(targets), inBar))
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    // A target can move with no resize or scroll, as when the bar's row settles after Help opens by itself and its first
    // step shifts along the row: measured again when the target, or anything in the row it stands in, changes size.
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    for (const target of targets) {
      watch?.observe(target)
      for (const near of target.parentElement?.children ?? []) watch?.observe(near)
    }
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      watch?.disconnect()
    }
  }, [step.target])
  // The card is placed from the lit box each time it is measured, and on each new step, whose words change its height.
  useLayoutEffect(() => {
    if (card.current) placeCard(card.current, lit)
  }, [lit, at])
  useLayoutEffect(() => {
    if (at > 0 || !said) return
    if (!card.current?.contains(document.activeElement)) next.current?.focus()
  }, [at, said])
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="help-dim"
          data-lit={lit ? step.target : undefined}
          className="fixed inset-0 z-[80] bg-brand-navy/55"
          style={{ clipPath: cutOut(lit) }}
          // A press on the dim closes it, and moves no focus on the way.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClose}
        />
        {lit && (
          // The ring: 4 pixels of white next to the target, then 4 of gold, standing in the cut.
          <div
            aria-hidden="true"
            data-slot="help-ring"
            // In forced colours the gold and the ground give way to the system's highlight, so the target is still marked.
            className="pointer-events-none fixed z-[80] rounded-[14px] border-4 border-gold forced-colors:border-[Highlight]"
            style={{ top: lit.top - RING, left: lit.left - RING, width: lit.width + 2 * RING, height: lit.height + 2 * RING }}
          >
            <div className="absolute inset-0 rounded-[10px] border-4 border-background" />
          </div>
        )}
        <DialogPrimitive.Content
          ref={card}
          aria-modal="true"
          aria-label={`Help, step ${where}`}
          aria-describedby={undefined}
          data-slot="help-card"
          // In rem, so it grows with a person's text size; framed in forced colours, where its shadow is not drawn.
          // Its words and buttons scroll inside it, so the pointer at its edge is not cut off.
          className="group/help fixed z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col rounded-[14px] border border-border bg-background text-ink shadow-xl outline-none forced-colors:border-[CanvasText]"
          onOpenAutoFocus={(event) => {
            // The card itself takes the focus, so a screen reader says its name first.
            event.preventDefault()
            card.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const to = opener()
            if (to?.isConnected) to.focus()
          }}
          // The dim is the only thing outside the card, and its own press closes it.
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          {/* The dialog's name, for a screen reader; the card shows "N of 6" and the step's title. */}
          <DialogPrimitive.Title asChild>
            <span className="sr-only">{`Help, step ${where}`}</span>
          </DialogPrimitive.Title>
          {/* The board's pointer, toward the target on the side the card stands; none where it stands in the middle. */}
          <span
            aria-hidden="true"
            data-slot="help-pointer"
            className="absolute size-3 rotate-45 border-border bg-background group-data-[side=middle]/help:hidden group-data-[side=below]/help:-top-1.5 group-data-[side=below]/help:left-6 group-data-[side=below]/help:border-l group-data-[side=below]/help:border-t group-data-[side=above]/help:-bottom-1.5 group-data-[side=above]/help:left-6 group-data-[side=above]/help:border-b group-data-[side=above]/help:border-r group-data-[side=right]/help:-left-1.5 group-data-[side=right]/help:top-6 group-data-[side=right]/help:border-b group-data-[side=right]/help:border-l group-data-[side=left]/help:-right-1.5 group-data-[side=left]/help:top-6 group-data-[side=left]/help:border-r group-data-[side=left]/help:border-t forced-colors:border-[CanvasText]"
          />
          <div data-slot="help-inside" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
            <p className={STEP_COUNT}>{where}</p>
            <h2 className={TITLE}>{step.title}</h2>
            {step.words.map((line) => (
              <p key={line} className={LINE}>
                {line}
              </p>
            ))}
            {/* A refusal, or a sign-in that ends, while the page is hidden behind the card: said here, as the chooser says it. */}
            <div data-slot="help-notice">{notice}</div>
            <div aria-live="polite" className="sr-only">
              {said}
            </div>
          </div>
          <div data-slot="help-buttons" className={BUTTON_ROW}>
            <button type="button" className={SKIP} onClick={onClose}>
              Skip
            </button>
            {at > 0 && (
              <button type="button" className={BACK} onClick={() => go(at - 1)}>
                Back
              </button>
            )}
            <button ref={next} type="button" className={NEXT} onClick={() => (last ? onClose() : go(at + 1))}>
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
