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
// - every other link's address taken off, its look kept by its own style,
//   so it is words drawn as a link that no press of any kind can follow, a
//   press with Ctrl, Cmd or Shift held or with the middle button among
//   them, and marked as a link that is not available, so a screen reader
//   still tells which words are links in the email that is sent; and on
//   every link tabindex -1, so the keyboard passes over the frame rather
//   than through the email's links.
// It changes as the person types (the page hands it the letter after a
// short pause) without a flash: the new email is written into a second
// frame, which takes the first one's place once it has loaded. When the
// letter goes back to the email the second frame already holds, loaded (after
// Undo, a word typed and taken away, or a month changed and changed back),
// that frame goes on show at once, since no new load will come to put it
// there. When the frame going off show holds the keyboard's focus, the
// focus goes to the frame coming on show.
//
// Hide puts the column away and gives the letter the room, and the control
// that brings it back, "Show the email", is where Hide was; each takes the
// focus from the other. The phone's own sheet, "See the email", is the
// second half of page step 4's.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
 * The email as the frame takes it: the frame's own address as its base, so a jump link stays inside the frame, and on
 * each link tabindex -1 and, but for a jump link, its address taken off, so nothing can follow it; its style, which
 * every link of the email carries, keeps it drawn as a link, and its role, a link that is not available, keeps it a
 * link to a screen reader.
 */
function forTheFrame(email: string): string {
  return email
    .replace('<head>', '<head>\n<base href="about:srcdoc">')
    .replace(/<a\s([^>]*\bhref="([^"]*)"[^>]*)>/g, (_tag, attributes: string, href: string) =>
      href.startsWith('#')
        ? `<a tabindex="-1" ${attributes}>`
        : `<a tabindex="-1" role="link" aria-disabled="true" ${attributes.replace(/\s*\bhref="[^"]*"/, '').trim()}>`,
    )
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

/** A pair of the two frames' documents with the one at `index` set to `value`. */
function withOne(pair: readonly [string, string], index: 0 | 1, value: string): [string, string] {
  return index === 0 ? [value, pair[1]] : [pair[0], value]
}

/**
 * Two frames, one on show: a new email is written into the other, which takes its place once it has loaded. An email
 * the other frame already holds, loaded, goes on show at once. The keyboard's focus, when it is in the frame going off
 * show, goes with the frame coming on show.
 */
function Frames({ email }: { email: string }) {
  // What each frame was given, and what each has finished loading: '' while a frame loads what it was given last.
  const [docs, setDocs] = useState<[string, string]>([email, ''])
  const [loaded, setLoaded] = useState<[string, string]>(['', ''])
  const [shown, setShown] = useState<0 | 1>(0)
  const firstFrame = useRef<HTMLIFrameElement>(null)
  const secondFrame = useRef<HTMLIFrameElement>(null)
  // A frame going off show would keep the focus, hidden from sight and from a screen reader, with the keys scrolling the
  // older email in it; so the focus moves to the frame on show before anything else can happen.
  useLayoutEffect(() => {
    const [on, off] = shown === 0 ? [firstFrame.current, secondFrame.current] : [secondFrame.current, firstFrame.current]
    if (off !== null && document.activeElement === off) on?.focus()
  }, [shown])
  const other = shown === 0 ? 1 : 0
  if (email !== docs[shown]) {
    if (email !== docs[other]) {
      setDocs(withOne(docs, other, email))
      setLoaded(withOne(loaded, other, ''))
    } else if (loaded[other] === email) {
      setShown(other)
    }
  }
  return (
    <div className="relative h-full w-full bg-background">
      {([0, 1] as const).map((index) => (
        <iframe
          key={index}
          ref={index === 0 ? firstFrame : secondFrame}
          title="The email as members will get it"
          sandbox=""
          srcDoc={docs[index]}
          aria-hidden={index === shown ? undefined : true}
          data-shown={index === shown ? '' : undefined}
          onLoad={() => {
            setLoaded((now) => withOne(now, index, docs[index]))
            if (index !== shown && docs[index] === email) setShown(index)
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
const QUIET_BUTTON = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-muted-foreground bg-background px-3 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

export function SidePreview({ letter, view, onView, hidden, onHidden, children }: SidePreviewProps) {
  const hideRef = useRef<HTMLButtonElement>(null)
  const showRef = useRef<HTMLButtonElement>(null)
  const wasHidden = useRef(hidden)
  // Hide and Show the email stand in one place, so the focus goes from the one pressed to the one that takes its place.
  useEffect(() => {
    if (hidden !== wasHidden.current) (hidden ? showRef : hideRef).current?.focus()
    wasHidden.current = hidden
  }, [hidden])

  const email = useMemo(
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

  if (hidden) {
    return (
      <div className="flex justify-end">
        <button ref={showRef} type="button" className={QUIET_BUTTON} onClick={() => onHidden(false)}>
          <Eye className="size-4" aria-hidden="true" />
          Show the email
        </button>
      </div>
    )
  }

  const { width, scale } = VIEWS[view]
  return (
    <aside aria-labelledby="newsletter-preview-heading" className="flex min-h-0 flex-1 flex-col" data-slot="side-preview">
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
        <button ref={hideRef} type="button" className={QUIET_BUTTON} onClick={() => onHidden(true)}>
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
          <MailTop subject={letter.subject.trim()} />
          <div className="relative min-h-0 flex-1">
            <Frames email={email} />
          </div>
        </div>
      </div>
      {children}
    </aside>
  )
}
