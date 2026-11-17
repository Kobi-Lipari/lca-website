// src/areas/admin/newsletter/FootBar.tsx
//
// The bar at the foot of the newsletter's own page (board Newsletter-Page-4,
// P11, P19 and P20; K's decisions 47, 48 and 50), WS16 part two, page step 5.
//
// From 768 pixels up, on a computer and a tablet: from the left, More
// options, a bordered button (MoreOptions.tsx), then the three numbered
// steps, 1 "Pick a template to start from", 2 "Send a test to me" and
// 3 "Send to 155 people", the gold one, with its small arrow; the four spread
// across the bar's width with even gaps, the bar held to the page's own
// width. Where the bar is too narrow for the board's words on one line, the
// steps' words run on to a second line; narrower still, as on a tablet held
// upright, More options is the board's own small form, its mark over
// "Options", and Send gives up its arrow, so the four still stand in one row
// from 768 pixels up. Each form follows the bar's own width, so it is right
// at every width and zoom.
//
// Under 768 pixels, on a phone (board P20): "Pick a template" and "See the
// email", which opens the email's sheet; More options sits at the page's end
// there (K's decision 52, item 3).
//
// The bar stays at the window's foot while the page scrolls, above the new
// look's tab bar on a phone and above a phone's own safe area, and at the
// page's end it stands after the letter, above the site's footer, so it never
// covers the footer's last line. While the letter fills the window it stays
// at that window's foot. Stuck there, its controls are in view, so they keep
// no room below them and take off the room the page keeps for a taller bar:
// a control of the bar taking the focus there moves nothing. Above them the
// room for the site's header is counted once, with the room the page itself
// keeps for the new look's header, so a control brought into view from above
// stands clear of the header, and More options' field, in its rows over the
// stuck bar, takes the focus without moving the page.
//
// The first step, "Pick a template to start from" ("Pick a template" on a
// phone), opens the chooser of templates and past newsletters
// (TemplateChooser.tsx, page step 5's second part), drawn ready as the board
// draws it: white with a navy edge, its chevron up from 768 pixels up. When
// the page opens on a letter that holds no words it wiggles once, for about a
// second, so nobody misses where to start (K's decision 47): a turn of 2
// degrees each way, the step's own transform, so nothing beside it moves;
// with reduced motion asked for it keeps still and shows a gold ring for a
// moment instead. Either ends by itself, stops as soon as something is
// written, and never plays under the focus or a press in the bar.
//
// The second step, "Send a test to me" (page step 6), is drawn ready, as the
// board draws it: white with a navy edge. A press, a key or a touch asks the
// page for a test of the letter to the person's own address; while it is on
// its way the step says so in words and is not available, so it cannot be
// pressed again, and the focus stays on it. What it came to is said in words
// in the bar's status line, under the steps from 768 pixels up, read out
// politely where the person is. The phone's bar draws no second step, as the
// board draws none there: a phone held on its side has the wider bar.
//
// Step 3, Send, is drawn and not yet available: the real Send comes with the
// move to Amazon SES. It is a button a screen reader says is not available
// (aria-disabled), which Tab still reaches, drawn quiet with its words kept
// readable, Send in its gold with the colour drawn out of it, and in forced
// colours in the system's colour for a control that cannot be used. A press,
// a key or a touch on it opens nothing and sends nothing: it says why in the
// bar's status line, in the newsletter tab's own words for its Send. Send
// counts the people the newsletter would go to, read once as the page opens;
// while that count is not known, or could not be read, it says "Send".

import { useEffect, useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { Bookmark, Check, ChevronDown, ChevronUp, CircleAlert, Eye, Mail, Send } from 'lucide-react'
import { isTextField, useDock } from '@/components/layout/dockParts'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** A control's ref that carries the keyboard's focus to the control of the same name drawn in its place. */
export type FocusHold = (element: HTMLElement | null) => void | (() => void)

/**
 * Carries the keyboard's focus from a control React takes off the page to the one of the same name drawn in its place,
 * as the window crosses 768 pixels: the phone's bar gives way to the computer's, the phone's "See the email" to the
 * head's, and More options at the page's end to the one in the bar; with none drawn in its place, to one of the same
 * name still on the page, as the letter made bigger's "Show the email" for the phone's "See the email" (the page's
 * useFocusCarry).
 */
export interface FocusCarry {
  /** The ref for the control of this name: the same function each time, so React never takes it off and puts it back. */
  hold: (name: string) => FocusHold
  /** The control of this name on the page now, the one drawn last where two are, if one is. */
  find: (name: string) => HTMLElement | null
}

/**
 * A step that is not available yet: the default pointer, and in forced colours the system's colour for a control that
 * cannot be used, so it is still told apart from one that can.
 */
const NOT_YET = 'cursor-default outline-none focus-visible:ring-3 focus-visible:ring-focus forced-colors:border-[GrayText] forced-colors:text-[GrayText]'

/** The first step, ready: the board's white step with its edge and words in the site's ink, navy in the light look. */
const PICK_READY = 'relative border-ink bg-background text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

/** The second step, ready (page step 6): the board's white step with its navy edge, as the first step is drawn. */
const TEST_READY = 'border-ink bg-background text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

/**
 * What the bar says in its status line (page step 6): a test on its way ('busy', heard and not drawn, since the step
 * itself says so), a test sent, nothing sent and why, or a note, as why Send waits.
 */
export interface BarSaid {
  tone: 'busy' | 'sent' | 'not-sent' | 'note'
  words: string
}

/**
 * The ring shown for a moment in place of the wiggle with reduced motion asked for: a gold band 3 pixels wide with a
 * gap of 4 pixels between it and the step's edge, as measured, where the site's focus ring is a 2 pixel line 2 pixels
 * off it in the new look and a 3 pixel shadow against it in today's; it is never drawn while the step has the focus,
 * and goes by itself. A cue only, hidden from a screen reader, so it is not drawn in forced colours, where it would
 * read as a frame.
 */
const PICK_RING =
  'pointer-events-none absolute -inset-[8px] rounded-[14px] border-[3px] border-lca-gold opacity-0 group-focus-visible:hidden forced-colors:hidden'

/**
 * The wiggle (K's decision 47; the board's figure "When the page opens on an empty letter" draws its turn, 2 degrees
 * each way): once, a second long, the step turning about its middle, each swing easing in and out, back to still.
 */
const WIGGLE: Keyframe[] = [
  { transform: 'rotate(0deg)', easing: 'ease-in-out' },
  { transform: 'rotate(-2deg)', offset: 0.15, easing: 'ease-in-out' },
  { transform: 'rotate(2deg)', offset: 0.35, easing: 'ease-in-out' },
  { transform: 'rotate(-2deg)', offset: 0.55, easing: 'ease-in-out' },
  { transform: 'rotate(1.5deg)', offset: 0.75, easing: 'ease-in-out' },
  { transform: 'rotate(0deg)' },
]
const WIGGLE_MS = 1000

/** The ring with reduced motion: drawn whole for a moment, with no movement and no fade, then gone. */
const RING: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }]
const RING_MS = 1500

/** The browser's own media query for reduced motion, the one the site's stylesheet reads. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * The first step's cue as the page opens on a letter that holds no words: the wiggle, or with reduced motion the ring.
 * Played once, on the frame after the letter is drawn, by the browser's own animation of the step, so nothing is set
 * on the page and nothing beside the step moves; never while the focus is in the bar; stopped by the focus or a press
 * coming into the bar, by words written (`cue` turning false) and as the page goes; never played again on this page,
 * whatever is opened, closed or changed. Nothing is stored, and nothing said to a screen reader.
 */
function usePickCue(bar: RefObject<HTMLElement | null>, cue: boolean) {
  /** Set on the frame the cue is played or passed over on, so it is never played again. */
  const spent = useRef(false)
  useEffect(() => {
    const element = bar.current
    if (!cue || spent.current || !element) return
    let playing: Animation | undefined
    const stop = () => playing?.cancel()
    const frame = requestAnimationFrame(() => {
      spent.current = true
      if (element.contains(element.ownerDocument.activeElement)) return
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches
      const target = element.querySelector<HTMLElement>(reduced ? '[data-slot="pick-ring"]' : '[data-slot="pick-step"]')
      if (!target || typeof target.animate !== 'function') return
      playing = reduced ? target.animate(RING, { duration: RING_MS }) : target.animate(WIGGLE, { duration: WIGGLE_MS })
    })
    element.addEventListener('focusin', stop)
    element.addEventListener('pointerdown', stop)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('focusin', stop)
      element.removeEventListener('pointerdown', stop)
      stop()
    }
  }, [bar, cue])
}

/**
 * The board's gold Send, drawn quiet: the site's gold button, navy words on the brand gold, with the colour drawn out
 * of both by 60 per cent, which keeps their lightness and so the words' contrast, about 6.4 to 1.
 */
const GOLD_NOT_YET = 'bg-lca-gold text-brand-navy grayscale-60'

/** A step's number, 32 pixels round, as the board's revision 15 draws it. */
function Mark({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span id={id} aria-hidden="true" className="flex size-8 flex-none items-center justify-center rounded-full bg-brand-navy text-[17px] font-bold leading-none text-white">
      {children}
    </span>
  )
}

/** "Send to 155 people", or "Send" while the count is not known; the count's number and noun on a line of their own when the words run on. */
function SendWords({ count }: { count: number | null | 'failed' }) {
  if (typeof count !== 'number') return <>Send</>
  return (
    <>
      Send to{' '}
      <span className="@max-[1104px]:block">
        {count.toLocaleString('en-US')} {count === 1 ? 'person' : 'people'}
      </span>
    </>
  )
}

/** The bar's own height at the site's usual spacing, which the room a control keeps below it is set by: 96 and 144 pixels. */
const USUAL_HEIGHT = { phone: 71, wide: 76 }

/**
 * While the bar stands taller than its usual height, as a person's own text spacing or a phone's safe area can make it,
 * the page keeps the difference as well, as room at its scroller's foot, so a control or the caret brought into view is
 * never left under the bar: the window's, beside the room the new look keeps for its tab bar, or, while the letter fills
 * the window, the letter's own. The bar carries the same number of pixels (--bar-extra), and its own controls take that
 * much off the room kept below them (FootBar's class), since the room would cover them too, 8 pixels above the bar's
 * foot, and each focus of one would push the page while the bar and the control stay where they are. At the usual
 * height nothing is set.
 */
function useRoomForTheBar(bar: RefObject<HTMLElement | null>, phone: boolean, bigger: boolean) {
  useLayoutEffect(() => {
    const element = bar.current
    const scroller = bigger ? element?.parentElement : document.documentElement
    if (!element || !scroller || typeof ResizeObserver === 'undefined') return
    const usual = phone ? USUAL_HEIGHT.phone : USUAL_HEIGHT.wide
    const write = () => {
      const extra = Math.round(element.offsetHeight) - usual
      if (extra > 0) {
        scroller.style.setProperty('scroll-padding-bottom', bigger ? `${extra}px` : `calc(var(--bottom-chrome-h, 0px) + ${extra}px)`)
        element.style.setProperty('--bar-extra', `${extra}px`)
      } else {
        scroller.style.removeProperty('scroll-padding-bottom')
        element.style.removeProperty('--bar-extra')
      }
    }
    write()
    const watch = new ResizeObserver(write)
    watch.observe(element)
    return () => {
      watch.disconnect()
      scroller.style.removeProperty('scroll-padding-bottom')
      element.style.removeProperty('--bar-extra')
    }
  }, [bar, phone, bigger])
}

export interface FootBarProps {
  /** Under 768 pixels: the phone's two buttons, More options being at the page's end. */
  phone: boolean
  /** While the letter fills the window, the bar stands at that window's foot. */
  bigger: boolean
  /** The people the newsletter would go to: null while it is read, 'failed' when it could not be. */
  count: number | null | 'failed'
  /** More options, at the bar's left from 768 pixels up. */
  moreOptions?: ReactNode
  /** Opens the email's sheet from the phone's "See the email". */
  onSeeEmail: (opener: HTMLButtonElement) => void
  sheetOpen: boolean
  /** Opens the chooser from the first step, at every width. */
  onPick: () => void
  chooserOpen: boolean
  /** While true, the first step's cue may play, once: the page opened on a letter that holds no words, and none is written yet. */
  cue: boolean
  carry: FocusCarry
  /** "Send a test to me", from 768 pixels up: pressed, and whether a test is on its way. */
  onTest: () => void
  testing: boolean
  /** Send, drawn and not yet available: pressed, it says why in the bar's status line. */
  onSendNotYet: () => void
  /** What the bar's status line says, or null while it says nothing. */
  said: BarSaid | null
}

export function FootBar({ phone, bigger, count, moreOptions, onSeeEmail, sheetOpen, onPick, chooserOpen, cue, carry, onTest, testing, onSendNotYet, said }: FootBarProps) {
  const bar = useRef<HTMLElement>(null)
  useRoomForTheBar(bar, phone, bigger)
  usePickCue(bar, cue)
  const dock = useDock()
  // The new look's tab bar holds a phone's safe area under it; with none drawn, the bar keeps that room itself.
  const ownSafeArea = bigger || !dock?.tabBar
  return (
    <section
      ref={bar}
      aria-label="Pick, check and send"
      data-slot="foot-bar"
      className={cn(
        'z-30 border-t border-border bg-background text-ink',
        // In the page, at the window's foot over the tab bar while the page scrolls, and after the letter at its end; in
        // the letter made bigger, at that window's foot.
        bigger ? 'sticky bottom-0' : 'sticky bottom-[var(--bottom-chrome-h,0px)] mt-auto',
        ownSafeArea && 'pb-[env(safe-area-inset-bottom)]',
        // A control of the bar keeps no room below it and takes off the room kept for a taller bar (--bar-extra): stuck at
        // the window's foot it is in view as it stands, so Tab, the carry and the sheet's return never scroll the page
        // there. Above it the room for the site's header is counted once: 3.25rem, 52 pixels at the usual text size,
        // under the new look's header, whose height the root's own room holds, and 7.25rem, 116 pixels, from the window's
        // top in today's look, whose header the root keeps no room for (with --header-h unset, 4rem is taken for it, as
        // More options' rows take it). In rem, since the header, the bar and More options' rows grow with the person's
        // own text size. So More options' field over the stuck bar takes the focus without moving the page, and its rows,
        // 43 pixels above the field at the usual size, stand clear of either header when the page brings the field into
        // view. Each is marked important, since the desk's own rule for every control outranks a plain class.
        '[&_:is(a,button,input,textarea,[tabindex])]:scroll-mb-[calc(var(--bar-extra,0px)*-1)]!',
        '[&_:is(a,button,input,textarea,[tabindex])]:scroll-mt-[calc(3.25rem+var(--header-h,4rem)-var(--header-h,0px))]!',
        phone ? 'shadow-[0_-6px_14px_rgba(16,24,43,0.07)]' : 'shadow-[0_-10px_28px_rgba(16,24,43,0.10)]',
      )}
    >
      {phone ? (
        <PhoneBar onSeeEmail={onSeeEmail} sheetOpen={sheetOpen} onPick={onPick} chooserOpen={chooserOpen} carry={carry} />
      ) : (
        <>
          <WideBar count={count} moreOptions={moreOptions} onPick={onPick} chooserOpen={chooserOpen} carry={carry} onTest={onTest} testing={testing} onSendNotYet={onSendNotYet} />
          <BarLine said={said} />
        </>
      )}
    </section>
  )
}

/**
 * The bar's status line (page step 6), under the steps: one polite region, on the page whenever the steps are, so each
 * change is read out where the person is, the focus left where it was. Empty, it takes no room; with words, the bar is a
 * line taller, and the page keeps that room too (useRoomForTheBar). A test sent has a tick beside its words and nothing
 * sent a mark of its own, each beside words that say it; a test on its way is heard and not drawn, since the step says
 * so itself. The words stay until the next press of either step.
 */
function BarLine({ said }: { said?: BarSaid | null }) {
  return (
    <p role="status" aria-atomic="true" data-slot="bar-said" className="mx-auto max-w-[1198px] px-6 text-[15px] leading-snug text-ink">
      {said &&
        (said.tone === 'busy' ? (
          <span className="sr-only">{said.words}</span>
        ) : (
          <span className="ml-auto flex max-w-[44rem] items-start justify-end gap-2 pb-2.5 text-right">
            {said.tone === 'sent' && <Check className="mt-[3px] size-4 flex-none text-ok-700" aria-hidden="true" />}
            {said.tone === 'not-sent' && <CircleAlert className="mt-[3px] size-4 flex-none text-destructive" aria-hidden="true" />}
            <span>{said.words}</span>
          </span>
        ))}
    </p>
  )
}

/**
 * The bar from 768 pixels up. Its row is the container its four controls read their form from, each form taken where
 * the one before it would leave less than 20 pixels between two controls: the board's own from 1104 pixels of row up, a
 * window 1152 wide; the steps' words on two lines under it; More options' words on two lines under 886, a window of 934;
 * under 845, a window of 893, as on a tablet held upright, More options the board's small form, the first step's words
 * at the board's narrower size, and Send without its arrow. Where a person's own text spacing makes the words wider than
 * the forms allow for, the four narrow and run their words on to more lines, and the row stays one.
 */
function WideBar({
  count, moreOptions, onPick, chooserOpen, carry, onTest, testing, onSendNotYet,
}: {
  count: number | null | 'failed'; moreOptions?: ReactNode; onPick: () => void; chooserOpen: boolean; carry: FocusCarry; onTest: () => void; testing: boolean; onSendNotYet: () => void
}) {
  const id = useId()
  return (
    <div className="@container mx-auto flex min-h-[75px] max-w-[1198px] items-center justify-between gap-x-3 px-6 py-2">
      {moreOptions}
      {/* The first step, its mark with it, as the board's figure of the wiggle draws the two turning together. */}
      <div data-slot="pick-step" className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-1`}>1</Mark>
        <button
          ref={carry.hold('pick')}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={chooserOpen}
          aria-labelledby={`${id}-1 ${id}-1-words`}
          onClick={onPick}
          className={cn(
            PICK_READY,
            'group inline-flex min-h-[52px] items-center gap-2.5 rounded-lg border-[1.5px] pl-[9px] pr-2.5 text-[17.5px] font-semibold leading-tight',
            '@max-[845px]:min-h-[50px] @max-[845px]:gap-2 @max-[845px]:px-3 @max-[845px]:text-base',
          )}
        >
          <Bookmark className="size-[21px] flex-none @max-[845px]:size-[19px]" aria-hidden="true" />
          <span id={`${id}-1-words`} className="text-left">
            Pick a template <span className="@max-[1104px]:block">to start from</span>
          </span>
          <ChevronUp className={cn('size-[18px] flex-none @max-[845px]:size-4', chooserOpen && 'rotate-180')} aria-hidden="true" />
          <span data-slot="pick-ring" aria-hidden="true" className={PICK_RING} />
        </button>
      </div>
      <div className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-2`}>2</Mark>
        {/* While a test is on its way the step says so and is not available, keeping the focus where it is. */}
        <button
          type="button"
          aria-disabled={testing || undefined}
          aria-labelledby={`${id}-2 ${id}-2-words`}
          onClick={() => {
            if (!testing) onTest()
          }}
          className={cn(TEST_READY, 'inline-flex min-h-[46px] items-center gap-2 rounded-lg border px-[15px] text-[15px] font-semibold leading-tight', testing && 'cursor-default')}
        >
          <Mail className="size-[15px] flex-none" aria-hidden="true" />
          <span id={`${id}-2-words`} className="text-left">
            {testing ? (
              <>
                Sending <span className="@max-[1104px]:block">a test</span>
              </>
            ) : (
              <>
                Send a test <span className="@max-[1104px]:block">to me</span>
              </>
            )}
          </span>
        </button>
      </div>
      <div className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-3`}>3</Mark>
        <button
          type="button"
          aria-disabled="true"
          aria-labelledby={`${id}-3 ${id}-3-words`}
          onClick={onSendNotYet}
          className={cn(NOT_YET, 'inline-flex rounded-lg')}
        >
          {/* The gold and its words drawn quiet inside the button, so the focus ring keeps its own colour. */}
          <span
            className={cn(
              GOLD_NOT_YET,
              'inline-flex min-h-[46px] items-stretch rounded-lg border border-transparent text-base font-semibold leading-tight forced-colors:border-[GrayText] forced-colors:text-[GrayText]',
            )}
          >
            <span className="flex items-center gap-2 px-3.5">
              <Send className="size-[18px] flex-none" aria-hidden="true" />
              <span id={`${id}-3-words`} className="text-left">
                <SendWords count={count} />
              </span>
            </span>
            {/* The board's small arrow, for the other ways to send, which come with sending later: drawn, part of Send. */}
            <span className="flex w-[42px] flex-none items-center justify-center border-l border-brand-navy/30 forced-colors:border-[GrayText] @max-[845px]:hidden" aria-hidden="true">
              <ChevronDown className="size-[15px]" />
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}

/**
 * The phone's bar (board P20): "Pick a template", which opens the chooser, at its own width, with no chevron, as the
 * board draws it, and "See the email" in the rest of the row. Each keeps the board's 50 pixels of height, and on the
 * narrowest windows the words of "See the email" run on to a second line rather than past the bar. The board's soft
 * white edge above the bar is not drawn: it would fade the words, and the edge of a control with the focus, just above
 * the bar. "See the email" has a border of no colour, as the site's own buttons have, so in forced colours it is framed
 * as its neighbour is, with a pixel less room at each side, so its words stand where they did. A press on either moves
 * no focus while the caret is in the letter or a field, as on the letter's tools: there a focus moved as the press
 * begins would bring the new look's tab bar back under the bar, which lifts the bar before the press ends, so the press
 * would miss; the chooser and the sheet each take the focus as they open. With no field holding the caret the tab bar
 * is drawn already and the press is the browser's own, so what it opens takes the focus from the button pressed, with
 * no focus ring round it, as after any press. Not from 768 pixels up, where there is no tab bar.
 */
function PhoneBar({ onSeeEmail, sheetOpen, onPick, chooserOpen, carry }: { onSeeEmail: (opener: HTMLButtonElement) => void; sheetOpen: boolean; onPick: () => void; chooserOpen: boolean; carry: FocusCarry }) {
  return (
    <div className="flex gap-2 px-3.5 py-2.5">
      <button
        ref={carry.hold('pick')}
        type="button"
        data-slot="pick-step"
        aria-haspopup="dialog"
        aria-expanded={chooserOpen}
        onMouseDown={(event) => {
          if (isTextField(document.activeElement)) event.preventDefault()
        }}
        onClick={onPick}
        className={cn(PICK_READY, 'group inline-flex min-h-[50px] flex-none items-center justify-center gap-[7px] rounded-lg border-[1.5px] px-3 text-base font-semibold leading-tight')}
      >
        <Bookmark className="size-[19px] flex-none" aria-hidden="true" />
        <span className="text-left">Pick a template</span>
        <span data-slot="pick-ring" aria-hidden="true" className={PICK_RING} />
      </button>
      <button
        ref={carry.hold('see')}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onMouseDown={(event) => {
          if (isTextField(document.activeElement)) event.preventDefault()
        }}
        onClick={(event) => onSeeEmail(event.currentTarget)}
        className="inline-flex min-h-[50px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent bg-brand-navy px-[11px] text-base font-semibold leading-tight text-white outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <Eye className="size-[18px] flex-none" aria-hidden="true" />
        <span className="text-balance text-left">See the email</span>
      </button>
    </div>
  )
}
