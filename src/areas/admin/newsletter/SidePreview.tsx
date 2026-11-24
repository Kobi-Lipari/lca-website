// src/areas/admin/newsletter/SidePreview.tsx
//
// The side column on a computer (board Newsletter-Page-4, P9; K's decision
// 29): "What members will get", always there beside the letter, with Phone
// and Computer to set its width and Hide to put it away.
//
// The preview is the email itself: renderNewsletter, the function the
// server sends with (domain/mail/newsletterLayout.ts), given the letter on
// the page and a footer in the real words (LIST_FOOTER_WORDS and the follow
// line the footer's file holds) with sample links and no person's address.
// It is drawn in a frame with a sandbox of no allowances, its content given
// whole and never fetched, so nothing in it runs, reaches the page or leaves
// it. Two things are set on the frame's copy of the email before it goes
// in, and nothing else, so the email that is sent keeps every address:
// - the frame's own address as its base, so a jump link from "In this
//   issue" scrolls inside the frame, where it would otherwise load the
//   page's own address in it; a jump link keeps its address, which it
//   needs to scroll with no script, so one pressed with Ctrl, Cmd or Shift
//   held or with the middle button opens an empty tab or window, which
//   asks for nothing;
// - every link's tag written again from a short list, so nothing else
//   written on a link (a ping, a target) reaches the frame: its own style,
//   which keeps its look; tabindex -1, so the keyboard passes over the
//   frame rather than through the email's links; and for a jump link its
//   address, for any other link none, so it is words drawn as a link that
//   no press of any kind can follow, a press with Ctrl, Cmd or Shift held
//   or with the middle button among them, marked as a link that is not
//   available, so a screen reader still tells which words are links in the
//   email that is sent.
// It changes as the person types (the page hands it the letter after a
// short pause) without a flash: the new email is written into a second
// frame, which takes the first one's place once it has loaded. Each new
// email goes into a frame element of its own, drawn for it, so the email is
// that frame's first document and adds nothing to the browser's history,
// where a frame given a new document after it has loaded adds an entry, and
// Back would be spent on the frames before it left the page. When the
// letter goes back to the email the second frame already holds, loaded (after
// Undo, a word typed and taken away, or a month changed and changed back),
// that frame goes on show at once, since no new load will come to put it
// there. When the frame going off show holds the keyboard's focus, or the
// frame a newer email takes the place of held it as it went, the focus goes
// to the frame on show; it is taken from nowhere else.
//
// Hide puts the column away and gives the letter the room, and the control
// that brings it back, "Show the email", is where Hide was; each takes the
// focus from the other. Put away, the column keeps its frames, out of sight
// and out of a screen reader's reach, still following the letter, so "Show
// the email" never shows an empty frame while an email loads.
//
// The sheet (boards P19 and P20; K's decision 29): on a tablet and a phone,
// under 1024 pixels, where the column is not drawn, "See the email" opens
// "What members will get" as a sheet over the page, the head's on a tablet
// and the bar's at the foot on a phone, and "Show the email" does the same
// from the letter made bigger at any width. It is a dialog on the
// site's dialog primitive, as the site's menu sheet is: it takes the focus
// as it opens, keeps it inside, closes on Escape, on "Back to writing" and
// on a press outside it, hides the page behind it from a screen reader and
// keeps that page from scrolling or taking a press. While it is open the
// site's root, the page behind it, is inert, so no key can take the focus
// there: the keys pressed inside the email's frame are the frame's own,
// which the dialog cannot see, and Shift and Tab from the frame would
// otherwise move the focus to the page's last control and scroll the page
// to it. Shift and Tab from the frame, or from the sheet itself, goes round
// to "Back to writing", the sheet's last control. Its email is the side
// preview's own, in the same frames with the same copy and the same rules,
// drawn at the sheet's own width, with no Phone, Computer or Hide, as the
// board draws it; the sheet shows itself once its first email has loaded,
// so it never opens on an empty frame. Its foot holds "Back to writing"; on
// a phone with the page's own Send switched on, the page gives it a row of
// sends above that (FootBar.tsx SheetSendRow), and Send later is still to come.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { PREFERENCES_LABEL, LIST_FOOTER_WORDS } from '@domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { renderNewsletter } from '@domain/mail/newsletterLayout'
import { LcaMark } from '@/components/LcaMark'
import { cn } from '@/lib/utils'

export type PreviewView = 'phone' | 'computer'

/** The letter as the preview draws it. */
export interface PreviewLetter {
  monthLabel: string
  subject: string
  preheader: string
  bodyHtml: string
}

/** Words made safe for the footer's HTML, as the server's footer makes them. */
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * The newsletter's footer as the server's footer builder writes it (emailListFooter in functions/utils/emailLayout.ts,
 * the reason, then the two links joined by a middle dot), in its real words, with sample links in place of a person's
 * own signed ones.
 */
const SAMPLE_FOOTER = (() => {
  const words = LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID]
  const link = (url: string, label: string) => `<a href="${url}" style="color:#1a2744;text-decoration:underline;">${escapeHtml(label)}</a>`
  return [
    `<p style="margin:0 0 6px;font-size:13px;color:#3a3f4b;">${escapeHtml(words.reason)}</p>`,
    `<p style="margin:0 0 10px;font-size:12px;color:#3a3f4b;">${link('https://example.org/email/unsubscribe/sample', words.unsubscribeLabel)} &nbsp;·&nbsp; ${link('https://example.org/email/preferences/sample', PREFERENCES_LABEL)}</p>`,
  ].join('\n              ')
})()

/**
 * The email as the frame takes it: the frame's own address as its base, so a jump link stays inside the frame, and each
 * link's tag written again with tabindex -1, its own style, which every link of the email carries and which keeps it
 * drawn as a link, and nothing else but, for a jump link, its address; any other link has none, so nothing can follow
 * it, and its role, a link that is not available, keeps it a link to a screen reader. A jump link lands on an anchor of
 * the letter's own (withAnchors in domain/mail/letter.ts), a name with no address, which is no link and is left as it is.
 */
function forTheFrame(email: string): string {
  return email
    .replace('<head>', '<head>\n<base href="about:srcdoc">')
    .replace(/<a\s([^>]*\bhref="([^"]*)"[^>]*)>/g, (_tag, attributes: string, href: string) => {
      const style = /(?:^|\s)style="([^"]*)"/.exec(attributes)?.[1]
      const look = style === undefined ? '' : ` style="${style}"`
      return href.startsWith('#') ? `<a tabindex="-1" href="${href}"${look}>` : `<a tabindex="-1" role="link" aria-disabled="true"${look}>`
    })
}

/** A space that holds the subject's line open while it is empty, made from its code so the source shows it. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0)

/** The two widths the preview is drawn at, and the scale that fits each in the column. */
const VIEWS: Record<PreviewView, { width: number; scale: number }> = {
  phone: { width: 390, scale: 240 / 390 },
  computer: { width: 640, scale: 310 / 640 },
}

/** The mail app's own top, above the email: the subject and who it is from, never an address. */
function MailTop({ subject }: { subject: string }) {
  return (
    <div className="border-b border-border bg-background px-[18px] py-3 font-sans text-ink">
      <p className="text-xl font-semibold leading-tight">{subject || NO_BREAK_SPACE}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-brand-navy text-white">
          <LcaMark title="" className="size-5" />
        </span>
        <span>
          <b className="block text-[14.5px] font-bold">Louisiana Chess Association</b>
          <span className="block text-[13px] text-muted-foreground">to you</span>
        </span>
      </div>
    </div>
  )
}

/** A pair of the two frames' values with the one at `index` set to `value`. */
function withOne<T>(pair: readonly [T, T], index: 0 | 1, value: T): [T, T] {
  return index === 0 ? [value, pair[1]] : [pair[0], value]
}

/**
 * A frame element's ref: the element kept in `frame` while it is drawn, and, as React takes it off the page for a newer
 * email's, whether it held the keyboard's focus noted in `focusLeft`, read then, before the page is drawn again, since
 * the focus falls to the page's body as it goes.
 */
function holdFrame(frame: RefObject<HTMLIFrameElement | null>, focusLeft: RefObject<boolean>, element: HTMLIFrameElement | null) {
  frame.current = element
  if (!element) return
  return () => {
    frame.current = null
    if (element.ownerDocument.activeElement === element) focusLeft.current = true
  }
}

/**
 * Two frames, one on show: a new email is written into the other, a frame element drawn afresh for it, which takes its
 * place once it has loaded. An email the other frame already holds, loaded, goes on show at once. The keyboard's focus,
 * when it is in the frame going off show, or was in a frame element taken off the page for a newer email, goes to the
 * frame on show, and is taken from nowhere else. `onLoaded` hears each time the email as it stands has finished loading.
 */
function Frames({ email, onLoaded }: { email: string; onLoaded?: () => void }) {
  // What each frame was given, and what each has finished loading: '' while a frame loads what it was given last.
  const [docs, setDocs] = useState<[string, string]>([email, ''])
  const [loaded, setLoaded] = useState<[string, string]>(['', ''])
  // How many emails each frame has been given, in its key, so each new one is a new frame's first document.
  const [writes, setWrites] = useState<[number, number]>([0, 0])
  const [shown, setShown] = useState<0 | 1>(0)
  const firstFrame = useRef<HTMLIFrameElement>(null)
  const secondFrame = useRef<HTMLIFrameElement>(null)
  /** Whether a frame element held the keyboard's focus as it was taken off the page, for the frame on show to take. */
  const focusLeft = useRef(false)
  const holdFirst = useCallback((element: HTMLIFrameElement | null) => holdFrame(firstFrame, focusLeft, element), [])
  const holdSecond = useCallback((element: HTMLIFrameElement | null) => holdFrame(secondFrame, focusLeft, element), [])
  // A frame going off show would keep the focus, hidden from sight and from a screen reader, with the keys scrolling the
  // older email in it, and a frame taken off the page leaves it on the page's body; so the focus moves to the frame on
  // show, as the frame on show changes or a frame is given a newer email, before anything else can happen.
  useLayoutEffect(() => {
    const [on, off] = shown === 0 ? [firstFrame.current, secondFrame.current] : [secondFrame.current, firstFrame.current]
    const left = focusLeft.current
    focusLeft.current = false
    if (left || (off !== null && document.activeElement === off)) on?.focus()
  }, [shown, writes])
  const other = shown === 0 ? 1 : 0
  if (email !== docs[shown]) {
    if (email !== docs[other]) {
      setDocs(withOne(docs, other, email))
      setLoaded(withOne(loaded, other, ''))
      setWrites(withOne(writes, other, writes[other] + 1))
    } else if (loaded[other] === email) {
      setShown(other)
    }
  }
  return (
    // A ring round the box while the email's frame holds the focus, since the frame's own document shows none.
    <div className="relative h-full w-full bg-background focus-within:ring-3 focus-within:ring-focus">
      {([0, 1] as const).map((index) => (
        <iframe
          key={`${index}-${writes[index]}`}
          ref={index === 0 ? holdFirst : holdSecond}
          title="The email as members will get it"
          sandbox=""
          srcDoc={docs[index]}
          aria-hidden={index === shown ? undefined : true}
          data-shown={index === shown ? '' : undefined}
          onLoad={() => {
            setLoaded((now) => withOne(now, index, docs[index]))
            if (index !== shown && docs[index] === email) setShown(index)
            if (docs[index] === email) onLoaded?.()
          }}
          className={cn('absolute inset-0 h-full w-full border-0', index !== shown && 'invisible')}
        />
      ))}
    </div>
  )
}

export interface SidePreviewProps {
  letter: PreviewLetter
  view: PreviewView
  onView: (view: PreviewView) => void
  hidden: boolean
  onHidden: (hidden: boolean) => void
  /** The count card, under the preview. */
  children?: ReactNode
}

const SEGMENT = 'min-h-11 px-4 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-focus'
/** The quiet button of Hide and "Show the email", which the letter made bigger draws in its top as well (NewsletterHead.tsx). */
export const QUIET_BUTTON = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-muted-foreground bg-background px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

/** The email of a letter as the frames take it: renderNewsletter's, with the sample footer, in the frame's own copy. */
function useFrameEmail(letter: PreviewLetter): string {
  return useMemo(
    () =>
      forTheFrame(
        renderNewsletter({
          siteUrl: window.location.origin,
          month: letter.monthLabel.trim(),
          subject: letter.subject.trim(),
          preheader: letter.preheader.trim(),
          bodyHtml: letter.bodyHtml,
          footerHtml: SAMPLE_FOOTER,
        }),
      ),
    [letter.monthLabel, letter.subject, letter.preheader, letter.bodyHtml],
  )
}

export function SidePreview({ letter, view, onView, hidden, onHidden, children }: SidePreviewProps) {
  const hideRef = useRef<HTMLButtonElement>(null)
  const showRef = useRef<HTMLButtonElement>(null)
  const wasHidden = useRef(hidden)
  // Hide and Show the email stand in one place, so the focus goes from the one pressed to the one that takes its place.
  useEffect(() => {
    if (hidden !== wasHidden.current) (hidden ? showRef : hideRef).current?.focus()
    wasHidden.current = hidden
  }, [hidden])

  const email = useFrameEmail(letter)
  const { width, scale } = VIEWS[view]
  return (
    <>
      {hidden && (
        <div className="flex justify-end">
          <button ref={showRef} type="button" className={QUIET_BUTTON} onClick={() => onHidden(false)}>
            <Eye className="size-4" aria-hidden="true" />
            Show the email
          </button>
        </div>
      )}
      {/* Put away, the column keeps its frames, so the email they hold is loaded when it is shown again. */}
      <SideColumn hidden={hidden} hideRef={hideRef} view={view} onView={onView} onHide={() => onHidden(true)} subject={letter.subject.trim()} width={width} scale={scale} email={email}>
        {children}
      </SideColumn>
    </>
  )
}

interface SideColumnProps {
  hidden: boolean
  hideRef: RefObject<HTMLButtonElement | null>
  view: PreviewView
  onView: (view: PreviewView) => void
  onHide: () => void
  subject: string
  width: number
  scale: number
  email: string
  children?: ReactNode
}

/** The column itself: its heading, Phone and Computer, Hide, the email in its frames, and the count under it. */
function SideColumn({ hidden, hideRef, view, onView, onHide, subject, width, scale, email, children }: SideColumnProps) {
  return (
    <aside hidden={hidden} aria-labelledby="newsletter-preview-heading" className="flex min-h-0 flex-1 flex-col" data-slot="side-preview">
      <h2 id="newsletter-preview-heading" className="text-[17px] font-bold leading-tight text-ink">What members will get</h2>
      <div className="mb-3 mt-2.5 flex items-center justify-between gap-2.5">
        <div role="group" aria-label="Show the email on" className="inline-flex overflow-hidden rounded-[10px] border border-muted-foreground bg-background">
          {(['phone', 'computer'] as const).map((each) => (
            <button
              key={each}
              type="button"
              aria-pressed={view === each}
              onClick={() => onView(each)}
              className={cn(SEGMENT, view === each ? 'bg-brand-navy text-white' : 'text-ink')}
            >
              {each === 'phone' ? 'Phone' : 'Computer'}
            </button>
          ))}
        </div>
        <button ref={hideRef} type="button" className={QUIET_BUTTON} onClick={onHide}>
          <EyeOff className="size-4" aria-hidden="true" />
          Hide
        </button>
      </div>
      <div
        className={cn(
          'relative mx-auto min-h-[280px] flex-1 overflow-hidden bg-background',
          view === 'phone' ? 'w-[258px] rounded-[36px] border-[9px] border-brand-navy shadow-xl' : 'w-full rounded-lg border border-border shadow-md',
        )}
        data-view={view}
      >
        <div className="absolute left-0 top-0 flex origin-top-left flex-col" style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})` }}>
          <MailTop subject={subject} />
          <div className="relative min-h-0 flex-1">
            <Frames email={email} />
          </div>
        </div>
      </div>
      {children}
    </aside>
  )
}

/** Whether a control is drawn, where the browser can tell; a page with no layout to ask takes it as drawn. */
function drawn(element: HTMLElement): boolean {
  return element.isConnected && (typeof element.checkVisibility !== 'function' || element.checkVisibility())
}

export interface EmailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  letter: PreviewLetter
  /** What the sheet says about the letter's saving while it hides the page: the saved line's notice. */
  notice?: ReactNode
  /**
   * The controls the focus goes back to as the sheet closes, in turn: the one that opened it, and, when that one is no
   * longer drawn, as when the window has crossed 768 pixels while the sheet was open, "See the email" where it then
   * stands, in the bar at the foot on a phone or in the head on a tablet, or, past 1024 pixels, the side preview's own.
   */
  returnFocus: () => Array<HTMLElement | null | undefined>
  /** The row of sends above "Back to writing", given only on a phone with the page's own Send switched on. */
  sends?: ReactNode
}

/** The sheet's foot: "Back to writing", with the row of sends above it when the page gives one. */
const SHEET_FOOT = 'flex flex-none flex-col gap-2 border-t border-border bg-background px-3.5 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] shadow-[0_-6px_14px_rgba(16,24,43,0.07)]'

/** The element the site is drawn in (index.html, src/main.tsx): the page behind the sheet, whose portal stands outside it. */
const SITE_ROOT_ID = 'root'

/** The mark the dialog primitive gives the two guards it keeps at the document's start and end. */
const FOCUS_GUARD = 'data-radix-focus-guard'

/** Whether a key is Shift and Tab alone, the key that moves the focus back a stop. */
function isShiftTab(event: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.key === 'Tab' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
}

/**
 * "What members will get" as a sheet (boards P19 and P20): the side preview's email at the sheet's own width, with
 * "Back to writing" at its foot. It opens with the focus on itself, so a screen reader says its name, and Tab goes to
 * the email's frame and to "Back to writing" and round again; Shift and Tab goes round the other way, from the frame or
 * from the sheet itself to "Back to writing", and never reaches the page behind.
 */
export function EmailSheet({ open, onOpenChange, letter, notice, returnFocus, sends }: EmailSheetProps) {
  const sheet = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  // While the sheet is open, the site's root is inert: none of the page's controls can take the focus, whatever key is
  // pressed in the email's frame, so the page is never scrolled to one. It is let go as the sheet closes, in the same
  // moment, so the control the focus is given back to can take it. A root made inert by something else is left as it is.
  useLayoutEffect(() => {
    if (!open) return
    const root = document.getElementById(SITE_ROOT_ID)
    if (!root || root.hasAttribute('inert')) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [open])
  // Shift and Tab in the email's frame leaves the frame for the stop before it, which, with the page inert, is the
  // dialog's guard at the document's start; the focus is sent on round to "Back to writing" instead. The page hears one
  // of two things: the focus landing on the guard, when the browser's own Tab had taken it into the frame, or the focus
  // leaving the frame for the guard, when the dialog had put it in the frame, going round from "Back to writing", and
  // the dialog's trap would hold it in the frame.
  useEffect(() => {
    if (!open) return
    const isStartGuard = (target: EventTarget | null) => target instanceof Element && target === document.querySelector(`[${FOCUS_GUARD}]`)
    const onFocusIn = (event: FocusEvent) => {
      if (isStartGuard(event.target)) back.current?.focus()
    }
    const onFocusOut = (event: FocusEvent) => {
      if (isStartGuard(event.relatedTarget)) back.current?.focus()
    }
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('focusout', onFocusOut, true)
    return () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('focusout', onFocusOut, true)
    }
  }, [open])
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[80] bg-brand-navy/55"
          data-slot="email-sheet-scrim"
          // No press on the dim moves the focus: the dialog closes on a main press and a tap there and stays open on a
          // right press, which would otherwise take the focus from the sheet to the page's body.
          onMouseDown={(event) => event.preventDefault()}
        />
        <DialogPrimitive.Content
          ref={sheet}
          aria-modal="true"
          aria-describedby={undefined}
          data-slot="email-sheet"
          onOpenAutoFocus={(event) => {
            // The sheet itself takes the focus, never the email's frame, whose document a screen reader would land in.
            event.preventDefault()
            sheet.current?.focus({ preventScroll: true })
          }}
          onKeyDown={(event) => {
            // Shift and Tab from the sheet itself, as it opens, goes round to its last control, as from its first.
            if (isShiftTab(event) && event.target === event.currentTarget) {
              event.preventDefault()
              back.current?.focus()
            }
          }}
          onCloseAutoFocus={(event) => {
            const to = returnFocus().find((element): element is HTMLElement => !!element && drawn(element))
            if (!to) return
            event.preventDefault()
            to.focus()
          }}
          className="fixed inset-x-0 bottom-0 top-[min(100px,12dvh)] z-[80] mx-auto flex max-w-[860px] flex-col overflow-hidden rounded-t-[18px] bg-background text-ink shadow-[0_-10px_30px_rgba(16,24,43,0.25)] outline-none"
        >
          <SheetInside letter={letter} notice={notice} backRef={back} sends={sends} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** How long the sheet waits for its first email before it shows itself whatever the frame has done. */
const SHEET_WAIT_MS = 1000

/**
 * What the sheet holds, drawn afresh each time it opens: it stays clear until the frame on show has loaded the email, so
 * the person never meets an empty frame, and the focus, already on the sheet, is not moved by it.
 */
function SheetInside({ letter, notice, backRef, sends }: { letter: PreviewLetter; notice?: ReactNode; backRef: RefObject<HTMLButtonElement | null>; sends?: ReactNode }) {
  const email = useFrameEmail(letter)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const wait = window.setTimeout(() => setReady(true), SHEET_WAIT_MS)
    return () => window.clearTimeout(wait)
  }, [])
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', !ready && 'opacity-0')} data-slot="email-sheet-inside">
      <div className="flex flex-none justify-center pb-0.5 pt-2" aria-hidden="true">
        <i className="block h-[5px] w-10 rounded-full bg-muted-foreground/40" />
      </div>
      <div className="flex-none border-b border-border px-[18px] pb-3 pt-1.5">
        <DialogPrimitive.Title className="text-[19px] font-bold leading-tight text-ink">What members will get</DialogPrimitive.Title>
        {notice}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <MailTop subject={letter.subject.trim()} />
        <div className="relative min-h-0 flex-1">
          <Frames email={email} onLoaded={() => setReady(true)} />
        </div>
      </div>
      <div className={SHEET_FOOT} data-slot="email-sheet-foot">
        {sends}
        <DialogPrimitive.Close ref={backRef} className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-base font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus focus-visible:ring-offset-2">
          <ChevronLeft className="size-[18px]" aria-hidden="true" />
          Back to writing
        </DialogPrimitive.Close>
      </div>
    </div>
  )
}
