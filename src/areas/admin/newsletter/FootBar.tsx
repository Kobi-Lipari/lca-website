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
// The numbered steps are drawn and not yet available: the chooser of
// templates comes with this step's second part, the test and Send with page
// step 6. Each is a button a screen reader says is not available
// (aria-disabled), which Tab still reaches and no press, key or touch acts
// on, drawn quiet with its words kept readable: the white steps in the site's
// own quiet colours, Send in its gold with the colour drawn out of it; and in
// forced colours in the system's colour for a control that cannot be used.
// Send counts the people the newsletter would go to, read once as the page
// opens; while that count is not known, or could not be read, it says
// "Send".

import { useId, useLayoutEffect, useRef, type RefObject } from 'react'
import { Bookmark, ChevronDown, ChevronUp, Eye, Mail, Send } from 'lucide-react'
import { useDock } from '@/components/layout/dockParts'
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

/**
 * The board's white step with its navy edge, drawn quiet: the site's own quiet words, which keep at least 4.7 to 1 on
 * the bar's ground in every look, and its edge at 60 per cent of them.
 */
const LINE_NOT_YET = 'border-muted-foreground/60 bg-background text-muted-foreground'

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
  carry: FocusCarry
}

export function FootBar({ phone, bigger, count, moreOptions, onSeeEmail, sheetOpen, carry }: FootBarProps) {
  const bar = useRef<HTMLElement>(null)
  useRoomForTheBar(bar, phone, bigger)
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
      {phone ? <PhoneBar onSeeEmail={onSeeEmail} sheetOpen={sheetOpen} carry={carry} /> : <WideBar count={count} moreOptions={moreOptions} carry={carry} />}
    </section>
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
function WideBar({ count, moreOptions, carry }: { count: number | null | 'failed'; moreOptions?: ReactNode; carry: FocusCarry }) {
  const id = useId()
  return (
    <div className="@container mx-auto flex min-h-[75px] max-w-[1198px] items-center justify-between gap-x-3 px-6 py-2">
      {moreOptions}
      <div className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-1`}>1</Mark>
        <button
          ref={carry.hold('pick')}
          type="button"
          aria-disabled="true"
          aria-labelledby={`${id}-1 ${id}-1-words`}
          className={cn(
            NOT_YET,
            LINE_NOT_YET,
            'inline-flex min-h-[52px] items-center gap-2.5 rounded-lg border-[1.5px] pl-[9px] pr-2.5 text-[17.5px] font-semibold leading-tight',
            '@max-[845px]:min-h-[50px] @max-[845px]:gap-2 @max-[845px]:px-3 @max-[845px]:text-base',
          )}
        >
          <Bookmark className="size-[21px] flex-none @max-[845px]:size-[19px]" aria-hidden="true" />
          <span id={`${id}-1-words`} className="text-left">
            Pick a template <span className="@max-[1104px]:block">to start from</span>
          </span>
          <ChevronUp className="size-[18px] flex-none @max-[845px]:size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-2`}>2</Mark>
        <button
          type="button"
          aria-disabled="true"
          aria-labelledby={`${id}-2 ${id}-2-words`}
          className={cn(NOT_YET, LINE_NOT_YET, 'inline-flex min-h-[46px] items-center gap-2 rounded-lg border px-[15px] text-[15px] font-semibold leading-tight')}
        >
          <Mail className="size-[15px] flex-none" aria-hidden="true" />
          <span id={`${id}-2-words`} className="text-left">
            Send a test <span className="@max-[1104px]:block">to me</span>
          </span>
        </button>
      </div>
      <div className="flex flex-initial items-center gap-2.5">
        <Mark id={`${id}-3`}>3</Mark>
        <button
          type="button"
          aria-disabled="true"
          aria-labelledby={`${id}-3 ${id}-3-words`}
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
 * The phone's bar (board P20): "Pick a template", drawn and not yet available, at its own width, and "See the email" in
 * the rest of the row. Each keeps the board's 50 pixels of height, and on the narrowest windows the words of "See the
 * email" run on to a second line rather than past the bar. The board's soft white edge above the bar is not drawn: it
 * would fade the words, and the edge of a control with the focus, just above the bar. "See the email" has a border of
 * no colour, as the site's own buttons have, so in forced colours it is framed as the one control that can be used,
 * with a pixel less room at each side, so its words stand where they did.
 */
function PhoneBar({ onSeeEmail, sheetOpen, carry }: { onSeeEmail: (opener: HTMLButtonElement) => void; sheetOpen: boolean; carry: FocusCarry }) {
  return (
    <div className="flex gap-2 px-3.5 py-2.5">
      <button
        ref={carry.hold('pick')}
        type="button"
        aria-disabled="true"
        className={cn(NOT_YET, LINE_NOT_YET, 'inline-flex min-h-[50px] flex-none items-center justify-center gap-[7px] rounded-lg border-[1.5px] px-3 text-base font-semibold leading-tight')}
      >
        <Bookmark className="size-[19px] flex-none" aria-hidden="true" />
        <span className="text-left">Pick a template</span>
      </button>
      <button
        ref={carry.hold('see')}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onClick={(event) => onSeeEmail(event.currentTarget)}
        className="inline-flex min-h-[50px] min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border border-transparent bg-brand-navy px-[11px] text-base font-semibold leading-tight text-white outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:ring-offset-2"
      >
        <Eye className="size-[18px] flex-none" aria-hidden="true" />
        <span className="text-balance text-left">See the email</span>
      </button>
    </div>
  )
}
