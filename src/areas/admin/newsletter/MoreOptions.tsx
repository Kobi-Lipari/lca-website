// src/areas/admin/newsletter/MoreOptions.tsx
//
// More options on the newsletter's own page (board Newsletter-Page-4, P14;
// K's decisions 26, 27, 48, 50 and 52), WS16 part two, page step 5. No board
// draws it open, so it is built in plain words from decision 27's list. It is
// closed when the page opens, every time, and holds three rows and nothing
// else:
// - "Inbox preview line": the letter's preheader, the line an inbox shows
//   after the subject, saved with the letter as the Subject is, at most 150
//   characters. Its words are 16 pixels at every width, so a phone's browser
//   does not zoom the page in as it takes the focus. Characters the server
//   would refuse are kept out as they are typed, and a paste takes the
//   Subject's own rule, by the Subject's own function, so a line break or a
//   tab pasted becomes one space between the words either side.
// - "Who gets it": the active LCA members the newsletter goes to, the count
//   Group email's newsletter tab reads, and how many are left out and why,
//   in that tab's words, when the count says some are.
// - "Where replies go": the reply address, as words. It is set in
//   domain/mail/addresses.ts and not changed here, and no page manages it
//   yet, so it has no link (K's decision 37 asks for one; it comes with the
//   senders page, with clubs' sending in WS09).
//
// From 768 pixels up it stands at the left of the bar at the foot, a bordered
// button that opens its rows upward, over the page's foot, as the board draws
// the chooser opening. It is not a dialog: the page stays usable behind it.
// It takes the focus into its field as it opens; Escape in it, or a second
// press of its button, closes it and gives the focus back to the button; a
// press outside it, or the focus moving on out of it, into the email's frame
// as well as to a control, closes it where the person went, so it never
// stands over a control that has the focus, while a press on its own words,
// or a window that loses the focus, leaves it open. Drawn in the bar already
// open, as the window grows past 768 pixels while it is open at a phone's
// page end, it stays open only if the focus came into it with the window. On
// a short window its rows scroll inside it, under the site's header.
//
// Under 768 pixels, on a phone, it is a part of the page at its end, under
// the letter and its size row (K's decision 52, item 3), opened and closed in
// place by its own button. It takes the focus into its field as it opens, as
// in the bar, and Escape gives it back to the button; it covers nothing, so
// it stays open until its button or Escape closes it.

import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { DEFAULT_REPLY_TO } from '@domain/mail/addresses'
import { cn } from '@/lib/utils'
import type { FocusCarry } from './FootBar'
import { OneLineField } from './FromSubjectRow'
import { PREHEADER_MAX } from './letterRules'

/** The newsletter's count as GET /api/admin/mail/newsletter gives it: the addresses it goes to, and those left out. */
export interface Reach {
  willGet: number
  addresses: number
  turnedOff: number
  stoppedAll: number
  doNotSend: number
}

/** The count while it is read (null), once it is (the counts), or when it could not be ('failed'). */
export type ReachRead = Reach | null | 'failed'

const count = (n: number) => n.toLocaleString('en-US')

/** Who gets it, in words: "Active LCA members: 155", with no number while the count is not known. */
function whoGetsIt(reach: ReachRead): string {
  return reach !== null && reach !== 'failed' ? `Active LCA members: ${count(reach.willGet)}` : 'Active LCA members'
}

/**
 * How many are left out and why, in the newsletter tab's own words, or nothing when the count names none: those who
 * turned the newsletter off, or stopped all mail of its kind, and the addresses that no longer receive mail.
 */
function leftOutWords(reach: ReachRead): string {
  if (reach === null || reach === 'failed') return ''
  const off = reach.turnedOff + reach.stoppedAll
  const parts: string[] = []
  if (off > 0) parts.push(`${count(off)} who turned the newsletter off`)
  if (reach.doNotSend > 0) parts.push(`${count(reach.doNotSend)} that no longer ${reach.doNotSend === 1 ? 'receives' : 'receive'} mail`)
  return parts.length > 0 ? `Left out: ${parts.join(' and ')}.` : ''
}

export interface MoreOptionsProps {
  /** In the bar at the foot, from 768 pixels up, or at the page's end, on a phone. */
  place: 'bar' | 'end'
  open: boolean
  onOpenChange: (open: boolean) => void
  preheader: string
  onPreheaderChange: (preheader: string) => void
  reach: ReachRead
  /** Carries the focus to the More options drawn in this one's place as the window crosses 768 pixels. */
  carry: FocusCarry
}

/**
 * More options' button: the board's bordered button, second to the numbered steps, with no number and no fill. Its
 * edge is the site's own quiet edge, which follows the look, at least 4 to 1 on the bar's ground and on the desk's warm
 * tint at a phone's page end, where the board's grey would be 2.9 to 1.
 */
const BUTTON =
  'inline-flex min-h-[46px] items-center gap-[7px] rounded-lg border-[1.5px] border-muted-foreground bg-background pl-[11px] pr-3 text-[15.5px] font-semibold leading-tight text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

export function MoreOptions({ place, open, onOpenChange, preheader, onPreheaderChange, reach, carry }: MoreOptionsProps) {
  const box = useRef<HTMLDivElement>(null)
  const panelId = useId()
  /** Set by a press of the button that opens it, so the focus goes into its field once the field is drawn. */
  const intoField = useRef(false)
  const closing = useRef(onOpenChange)
  useEffect(() => {
    closing.current = onOpenChange
  }, [onOpenChange])
  /** The look, once the focus has landed, after a blur in the bar that named no element (its onBlur below). */
  const landing = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!open) return
    return () => window.clearTimeout(landing.current)
  }, [open])

  /**
   * Drawn in the bar already open, as when the window grows past 768 pixels while it is open at a phone's page end and
   * the person has gone back to the letter: there its rows would stand over the page's foot, where the focus is, so it
   * closes unless the focus came into it with the window. Read once each control drawn with it has its ref, so a field or
   * a button the focus is carried to keeps it open; before the page is shown, so its rows are never seen over the focus.
   */
  const drawnOpen = useRef(open)
  useLayoutEffect(() => {
    const element = box.current
    if (place !== 'bar' || !drawnOpen.current || !element) return
    if (!element.contains(element.ownerDocument.activeElement)) closing.current(false)
  }, [place])

  useEffect(() => {
    if (!open || !intoField.current) return
    intoField.current = false
    carry.find('more-field')?.focus()
  }, [open, carry])

  // In the bar, a press anywhere outside it closes it where the person pressed, as the page's Add menu does.
  useEffect(() => {
    if (!open || place !== 'bar') return
    const outside = (event: Event) => {
      if (box.current?.contains(event.target as Node | null)) return
      closing.current(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, place])

  /**
   * A press of the button: opening takes the focus into the field once it is drawn; closing gives it to the button, where
   * a press that does not move the focus, as Safari's and a screen reader's do, would leave it in the field going away.
   */
  function toggle() {
    intoField.current = !open
    onOpenChange(!open)
    if (open) carry.find('more-button')?.focus()
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    // Escape is More options' own: it closes it alone, never the letter made bigger behind it.
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    event.stopPropagation()
    onOpenChange(false)
    carry.find('more-button')?.focus()
  }

  const rows = open && (
    <div
      id={panelId}
      role="group"
      aria-label="More options"
      className={cn(
        'rounded-xl border border-border bg-background p-4 text-ink',
        place === 'bar'
          ? 'absolute bottom-full left-0 z-10 mb-2 max-h-[calc(100dvh-var(--header-h,4rem)-5.75rem)] w-[min(28rem,calc(100vw-3rem))] overflow-y-auto overscroll-contain shadow-xl'
          : 'mt-2.5 shadow-sm',
      )}
    >
      <Rows preheader={preheader} onPreheaderChange={onPreheaderChange} reach={reach} carry={carry} />
    </div>
  )

  if (place === 'end') {
    return (
      <div ref={box} data-slot="more-options" data-place="end" onKeyDown={onKey}>
        <button
          ref={carry.hold('more-button')}
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={toggle}
          className={cn(BUTTON, 'w-full')}
        >
          <Settings2 className="size-[18px] flex-none" aria-hidden="true" />
          <span className="flex-1 text-left">More options</span>
          <ChevronDown className={cn('size-4 flex-none', open && 'rotate-180')} aria-hidden="true" />
        </button>
        {rows}
      </div>
    )
  }

  return (
    <div
      ref={box}
      data-slot="more-options"
      data-place="bar"
      className="relative flex-initial"
      onKeyDown={onKey}
      onBlur={(event) => {
        if (!open) return
        // The focus moving on out of it, to a control of the page, closes it, so it never stands over the focus.
        const element = event.currentTarget
        const to = event.relatedTarget
        if (to instanceof Node) {
          if (!element.contains(to)) onOpenChange(false)
          return
        }
        // A blur that names no element: the focus going into the email's frame, a press on its own words or, in a
        // browser whose press gives a button no focus, on its button, which both leave the focus on the page's body,
        // or a window that loses the focus, which leaves it in its field. Looked at once the focus has landed, so only
        // the frame, or another control, closes it.
        window.clearTimeout(landing.current)
        landing.current = window.setTimeout(() => {
          const now = document.activeElement
          if (element.isConnected && now && now !== document.body && !element.contains(now)) closing.current(false)
        })
      }}
    >
      <button
        ref={carry.hold('more-button')}
        type="button"
        aria-label="More options"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={cn(BUTTON, '@max-[845px]:flex-col @max-[845px]:justify-center @max-[845px]:gap-[3px] @max-[845px]:px-[9px] @max-[845px]:text-[13.5px]')}
      >
        <Settings2 className="size-[18px] flex-none" aria-hidden="true" />
        {/* Its words on two lines where the bar is narrow, and the board's small form, its mark over "Options", narrower still. */}
        <span className="text-left @max-[845px]:hidden">
          More <span className="@max-[886px]:block">options</span>
        </span>
        <span className="hidden @max-[845px]:inline">Options</span>
        <ChevronUp className={cn('size-4 flex-none @max-[845px]:hidden', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {rows}
    </div>
  )
}

/** The three rows: the inbox preview line, who gets it, and where replies go. */
function Rows({ preheader, onPreheaderChange, reach, carry }: Pick<MoreOptionsProps, 'preheader' | 'onPreheaderChange' | 'reach' | 'carry'>) {
  const fieldId = useId()
  const left = leftOutWords(reach)
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-semibold text-ink">
          Inbox preview line
        </label>
        <OneLineField
          ref={carry.hold('more-field')}
          id={fieldId}
          value={preheader}
          onValueChange={onPreheaderChange}
          maxLength={PREHEADER_MAX}
          spellCheck
          autoComplete="off"
          className="h-11 w-full min-w-0 rounded-lg border border-muted-foreground bg-background px-3 text-base text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
        />
      </div>
      <dl className="grid gap-4">
        <div className="grid gap-1">
          <dt className="text-sm font-semibold text-ink">Who gets it</dt>
          <dd className="text-[15px] text-ink">{whoGetsIt(reach)}</dd>
          {left !== '' && <dd className="text-[15px] text-ink">{left}</dd>}
        </div>
        <div className="grid gap-1">
          <dt className="text-sm font-semibold text-ink">Where replies go</dt>
          <dd className="text-[15px] text-ink [overflow-wrap:anywhere]">{DEFAULT_REPLY_TO}</dd>
        </div>
      </dl>
    </div>
  )
}
