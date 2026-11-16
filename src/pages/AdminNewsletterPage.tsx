// src/pages/AdminNewsletterPage.tsx
//
// The LCA newsletter's own page, /admin/newsletter (WS16 part two, page
// step 4): the page K approved, board Newsletter-Page-4 (K's decision 51),
// on a computer. The route is registered only with the switch mailPage on
// (src/App.tsx), so with it off nobody reaches this page.
//
// Who is let in: whoever the server lets send the newsletter
// (requireListMailer): the LCA admins, the president, and whoever holds the
// Media manager seat, an officer among them (K's decision 52). The route
// lets in Admin's roles, and the media manager on the server's answer,
// which it hands down; an officer without the seat, whom Admin's roles let
// in, is sent to Admin here. Nobody here sees a "View only" badge. A media
// manager signed in without a second factor, whom the server would refuse,
// is told so in the newsletter tab's own words, with the way to set it up,
// and no call is made.
//
// The page: the head with the saved line (NewsletterHead), From and
// Subject, the tools and the letter (LetterEditor), the size controls, at
// the side what members will get with the count, and the bar at the foot
// (FootBar, page step 5): More options (MoreOptions), with the letter's
// inbox preview line, who gets it and where replies go, then the three
// numbered steps, drawn and not yet available. Saving is useIssue's. The
// chooser of templates, Help, the test and Send come with later steps.
//
// By the window's width, at the site's own breakpoints: from 1024 pixels up
// the computer's page, the letter with the email beside it; under 1024 the
// tablet's (board P19), the letter the whole width with the big tools, From
// and Subject stacked, and "See the email" at the head's right opening the
// email as a sheet; under 768 the phone's (board P20), the same with the
// phone's own tools and head, "See the email" in the bar at the foot beside
// "Pick a template", and More options at the page's end. Each is drawn by
// the stylesheet, so the page is right at every width and as a window turns,
// with nothing to wait for, but for what stands on one side of 768 pixels or
// the other, the bar's buttons, the head's "See the email" and More options'
// place, which the page draws by the browser's own media query
// (useTabletScreen), as the site's header does.
//
// Make bigger fills the window with the letter: the page itself, its head
// then the letter's top with "Show the email", is the dialog, so the saved
// line in the head is one element whatever the letter's size.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { defaultSubject } from '@domain/mail/letter'
import { useAuth } from '@/contexts/auth-context'
import { useMediaManagerAnswer } from '@/areas/admin/mediaManagerAnswer'
import { CountCard } from '@/areas/admin/newsletter/CountCard'
import { FootBar, type FocusCarry, type FocusHold } from '@/areas/admin/newsletter/FootBar'
import { FromSubjectRow } from '@/areas/admin/newsletter/FromSubjectRow'
import { LetterEditor } from '@/areas/admin/newsletter/LetterEditor'
import { MoreOptions, type ReachRead } from '@/areas/admin/newsletter/MoreOptions'
import { NewsletterHead, SavedLineNotice, type SavedLineProps } from '@/areas/admin/newsletter/NewsletterHead'
import { EmailSheet, SidePreview, type PreviewView } from '@/areas/admin/newsletter/SidePreview'
import { useIssue, type Issue, type LetterDraft } from '@/areas/admin/newsletter/useIssue'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTabletScreen } from '@/hooks/useWideScreen'
import { getNewsletter } from '@/lib/api'
import { cn } from '@/lib/utils'

/** The newsletter tab's own words for a media manager signed in without a second factor (src/pages/AdminEmailPage.tsx). */
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'

/** How long the side preview waits after the last change before it draws the letter again. */
const PREVIEW_PAUSE_MS = 400

/**
 * The page's ground under the head: the board's desk, a warm tint over the site's own ground, in every look. Each
 * control the keyboard reaches keeps room above it for the site's sticky header, which today's header does not ask the
 * page to keep, and below it for the bar at the window's foot, so a control reached by Tab is scrolled clear of both:
 * 96 pixels, the bar's 76 and 20 clear; on a phone 144, the bar's 71 and the new look's tab bar under it, 57, whose own
 * room the site gives up while the letter or a field has the focus. The bar's own controls keep their own (FootBar): none
 * below, and above, the room for the header counted once with the room the page itself keeps for the new look's header.
 */
const DESK_GROUND = 'min-h-[calc(100dvh-var(--header-h,64px))] bg-lca-gold/20 [&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mb-24 max-md:[&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mb-36 [&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mt-24'

/** The page before its letter is on it, with the room at its foot the bar takes once the letter is. */
const DESK = `${DESK_GROUND} pb-20`

/** The page with its letter: a column whose last part, the bar, stands at its foot however short the letter is. */
const DESK_WITH_BAR = `${DESK_GROUND} flex flex-col`

/** The page while the letter fills the window: the whole window, scrolling inside itself, its controls kept clear as on the page. */
const BIGGER = 'fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-background [&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mb-24 [&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mt-24'

/** Every control the keyboard stops on inside a part of the page, in the page's order. */
function tabStops(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]')].filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      !element.closest('[hidden]') &&
      (element.isContentEditable || element.tabIndex >= 0),
  )
}

/** Where the focus was in a control React took off the page, kept for the control of the same name drawn in its place. */
interface Carried {
  name: string
  start: number | null
  end: number | null
  direction: 'forward' | 'backward' | 'none' | null
}

/** The focus carry with its last step, which the page takes each time it has been drawn. */
interface Carrier extends FocusCarry {
  /**
   * Ends a carry no control of its name took as the page was drawn, so it never moves the focus later; when the focus
   * went with the control and nothing has taken it since, it goes to a control of the same name still on the page.
   */
  settle: () => void
}

/**
 * Gives a control the focus with the browser's own scroll, which brings it into view by the room the page keeps round
 * its controls, clear of the site's header and the bar, and a field's caret and chosen words where they were: set before
 * the focus, so the field shows its words where the caret stands as it takes the focus, since a browser does not scroll
 * to a caret set after it, and set once more after it only where the focus has moved them. A range of chosen words is
 * kept, but is not brought into the field's view.
 */
function takeFocus(element: HTMLElement, was: Carried) {
  const { start, end } = was
  const field = element instanceof HTMLInputElement && start !== null && end !== null
  if (field) element.setSelectionRange(start, end, was.direction ?? 'none')
  element.focus()
  if (field && (element.selectionStart !== start || element.selectionEnd !== end)) element.setSelectionRange(start, end, was.direction ?? 'none')
}

/**
 * Carries the keyboard's focus from a control React takes off the page to the one of the same name drawn in its place,
 * as the window crosses 768 pixels (FootBar's FocusCarry): a field's caret and chosen words go with it. The focus is read
 * as the control is taken off the page, before the page is drawn again, as the Subject's field reads its own. Unlike the
 * Subject's field, which stays where it was, the control drawn in its place may stand elsewhere, in the head or at the
 * page's end where the old one was in the bar, so it takes the focus with the browser's own scroll, which brings it into
 * view. A control drawn in the bar is out of view only where the page is at or near its end above a footer taller than
 * the window, as at a phone's page end, where the bar's top stood at minus 198 pixels at 390 by 844 as measured, and on
 * a short window; there the plain focus brings it into view, and elsewhere it moves the page only where the control
 * stands nearer the header than the room the bar keeps above its controls (FootBar). Each name's ref is the same
 * function each time.
 *
 * A carry lasts only as long as the drawing that took its control off the page, since what the page draws decides
 * every such control: once each control and each effect of that drawing has run, the letter's own among them, a carry
 * no control took is ended. So More options' field, which a press outside it takes off the page before the press moves
 * the focus, leaves nothing behind for the next time it opens. If the focus went with the control and nothing has taken
 * it since, it goes to the control of the same name still on the page, wherever it stands: with the letter made bigger
 * on a phone, the bar's "See the email" gives it to the letter's own "Show the email" as the window grows
 * past 768 pixels, so it stays inside the letter. Where two controls of a name are on the page, the one drawn last is
 * the one found.
 */
function useFocusCarry(): FocusCarry {
  const [carry] = useState<Carrier>(() => {
    let carried: Carried | null = null
    /** The controls of each name on the page, in the order they were drawn. */
    const drawn = new Map<string, HTMLElement[]>()
    const holds = new Map<string, FocusHold>()
    const find = (name: string): HTMLElement | null => {
      const all = drawn.get(name) ?? []
      for (let at = all.length - 1; at >= 0; at--) if (all[at].isConnected) return all[at]
      return null
    }
    return {
      hold(name) {
        const known = holds.get(name)
        if (known) return known
        const hold: FocusHold = (element) => {
          if (!element) return
          drawn.set(name, [...(drawn.get(name) ?? []).filter((other) => other !== element), element])
          if (carried?.name === name) {
            const was = carried
            carried = null
            takeFocus(element, was)
          }
          return () => {
            drawn.set(name, (drawn.get(name) ?? []).filter((other) => other !== element))
            if (element.ownerDocument.activeElement !== element) return
            const field = element instanceof HTMLInputElement ? element : null
            carried = { name, start: field?.selectionStart ?? null, end: field?.selectionEnd ?? null, direction: field?.selectionDirection ?? null }
          }
        }
        holds.set(name, hold)
        return hold
      },
      find,
      settle() {
        const was = carried
        if (!was) return
        carried = null
        const now = document.activeElement
        if (now && now !== document.body) return
        const other = find(was.name)
        if (other) takeFocus(other, was)
      },
    }
  })
  // The carry's last step, each time the page has been drawn: after every effect of the parts inside it, so the letter's
  // own giving of the focus to Make bigger as it is made smaller is left where it is.
  useEffect(() => carry.settle())
  return carry
}

export function AdminNewsletterPage() {
  usePageTitle('Admin · Newsletter')
  const { role } = useAuth()
  const answer = useMediaManagerAnswer()
  // The LCA admins and the president send as themselves; anyone else is let in on the server's answer alone.
  const asThemselves = role === 'lca_admin' || role === 'lca_observer'
  if (!asThemselves && answer.asking) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
        <p role="status" className="text-muted-foreground">Loading...</p>
      </div>
    )
  }
  if (!asThemselves && !answer.mediaManager) return <Navigate to="/admin" replace />
  return <NewsletterDesk mayCall={asThemselves || answer.secondFactor} />
}

/** The page once the person is let in: the letter's state, the count, and how the side is shown, kept as letters come and go. */
function NewsletterDesk({ mayCall }: { mayCall: boolean }) {
  const issue = useIssue(mayCall)
  // The count, read once as the page opens, from the call Group email's newsletter tab makes: the addresses the
  // newsletter goes to, for the count card and Send, and those left out, for More options.
  const [reach, setReach] = useState<ReachRead>(null)
  const [view, setView] = useState<PreviewView>('phone')
  const [previewHidden, setPreviewHidden] = useState(false)
  const [replaced, setReplaced] = useState(false)

  useEffect(() => {
    if (!mayCall) return
    let gone = false
    getNewsletter().then(
      ({ summary }) => {
        if (!gone) setReach({ willGet: summary.willGet, addresses: summary.addresses, turnedOff: summary.turnedOff, stoppedAll: summary.stoppedAll, doNotSend: summary.doNotSend })
      },
      () => {
        if (!gone) setReach('failed')
      },
    )
    return () => {
      gone = true
    }
  }, [mayCall])

  if (!mayCall || issue.status !== 'ready') {
    return (
      <div className={DESK} data-slot="newsletter-page">
        <NewsletterHead />
        <div className="mx-auto max-w-[1198px] px-4 py-6 sm:px-6">
          {!mayCall ? (
            <p className="text-[15px] text-ink">
              <Link to="/account/security" className="rounded-sm font-medium underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus">
                {SECOND_FACTOR_LINE}
              </Link>
            </p>
          ) : issue.status === 'loading' ? (
            <p role="status" className="text-[15px] text-ink">Loading the letter...</p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
              <p role="alert">
                The letter could not be read.{issue.loadError && ` ${issue.loadError}`}
              </p>
              <button
                type="button"
                onClick={issue.reload}
                className="inline-flex min-h-11 items-center rounded-md px-2 font-semibold underline underline-offset-3 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <NewsletterLetter
      key={issue.letterKey}
      issue={issue}
      reach={reach}
      view={view}
      onView={setView}
      previewHidden={previewHidden}
      onPreviewHidden={setPreviewHidden}
      autoFocus={replaced}
      onShowTheirs={() => {
        setReplaced(true)
        void issue.showTheirs()
      }}
    />
  )
}

interface NewsletterLetterProps {
  issue: Issue
  reach: ReachRead
  view: PreviewView
  onView: (view: PreviewView) => void
  previewHidden: boolean
  onPreviewHidden: (hidden: boolean) => void
  autoFocus: boolean
  onShowTheirs: () => void
}

/** One letter on the page, drawn afresh each time a letter takes the place of the one before. */
function NewsletterLetter({ issue, reach, view, onView, previewHidden, onPreviewHidden, autoFocus, onShowTheirs }: NewsletterLetterProps) {
  const [month, setMonth] = useState(issue.letter.monthLabel)
  const [subject, setSubject] = useState(issue.letter.subject)
  const [preheader, setPreheader] = useState(issue.letter.preheader)
  const [body, setBody] = useState(issue.letter.bodyHtml)
  // The side draws the letter as the editor holds it, never the words as they came, so it starts with the band alone.
  const [preview, setPreview] = useState<LetterDraft>({ ...issue.letter, bodyHtml: '' })
  const [bigger, setBigger] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  // More options is closed whenever the page opens on a letter.
  const [moreOpen, setMoreOpen] = useState(false)
  // Under 768 pixels the phone's bar, "See the email" in it, and More options at the page's end.
  const phone = !useTabletScreen()
  const carry = useFocusCarry()
  const desk = useRef<HTMLDivElement>(null)
  const side = useRef<HTMLDivElement>(null)
  /** The control that opened the email's sheet, which takes the focus back as it closes. */
  const opener = useRef<HTMLButtonElement | null>(null)
  const previewPause = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(previewPause.current), [])

  /** The words on the page changed: the letter saves after its pause, and the side draws it again after a shorter one. */
  function changed(next: Partial<LetterDraft>) {
    const draft: LetterDraft = {
      monthLabel: next.monthLabel ?? month,
      subject: next.subject ?? subject,
      preheader: next.preheader ?? preheader,
      bodyHtml: next.bodyHtml ?? body,
    }
    issue.edit(draft)
    window.clearTimeout(previewPause.current)
    previewPause.current = window.setTimeout(() => setPreview(draft), PREVIEW_PAUSE_MS)
  }

  /** A new month takes the subject with it while the subject is still the old month's own; a subject a person wrote is kept. */
  function onMonthChange(next: string) {
    const following = subject.trim() === defaultSubject(month)
    const nextSubject = following ? defaultSubject(next) : subject
    setMonth(next)
    if (following) setSubject(nextSubject)
    changed({ monthLabel: next, subject: nextSubject })
  }

  /**
   * While the letter fills the window, the keyboard stays inside it, and Escape gives the page back. A key pressed in
   * something drawn over the letter, such as the "Show their letter?" question or the email's sheet, reaches here
   * through React's tree from outside the page, and is that thing's own: Escape there closes it alone. Whether the key
   * was marked handled is not asked, since the letter's editor marks every Escape as its own.
   */
  function onDeskKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!bigger) return
    if (!desk.current?.contains(event.target as Node)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setBigger(false)
      return
    }
    if (event.key !== 'Tab') return
    const stops = tabStops(desk.current)
    if (stops.length === 0) return
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  /** Opens the email's sheet from the control pressed, which takes the focus back as it closes. */
  function openSheet(from: HTMLButtonElement) {
    opener.current = from
    setSheetOpen(true)
  }

  function onPreheaderChange(next: string) {
    setPreheader(next)
    changed({ preheader: next })
  }

  const moreOptions = (place: 'bar' | 'end') => (
    <MoreOptions
      place={place}
      open={moreOpen}
      onOpenChange={setMoreOpen}
      preheader={preheader}
      onPreheaderChange={onPreheaderChange}
      reach={reach}
      carry={carry}
    />
  )
  const count = reach === null || reach === 'failed' ? reach : reach.willGet

  const saved: SavedLineProps = { line: issue.line, onTryAgain: issue.saveNow, onShowTheirs }
  return (
    <div
      ref={desk}
      role={bigger ? 'dialog' : undefined}
      aria-modal={bigger || undefined}
      aria-label={bigger ? 'The letter, made bigger' : undefined}
      onKeyDown={onDeskKey}
      className={bigger ? BIGGER : DESK_WITH_BAR}
      data-slot="newsletter-page"
    >
      <NewsletterHead
        month={month}
        state={issue.state}
        saved={saved}
        bigger={bigger}
        onSeeEmail={openSheet}
        sheetOpen={sheetOpen}
        phone={phone}
        seeRef={carry.hold('see')}
      />
      <div
        className={cn(
          // The letter made bigger has the bar at its foot, as the board draws it, with 10 pixels of its tint above the
          // bar: from 768 pixels up its size row stands there, and on a phone More options, which stays at the
          // letter's end, stands between the size row and the bar. Under 1024 pixels the letter is taller than the
          // window, so the page keeps 10 pixels of the desk between the letter, or More options on a phone, and the bar.
          bigger
            ? 'flex min-w-0 flex-1 flex-col bg-lca-gold/20 px-4 pb-2.5 pt-2.5 sm:px-5'
            : 'mx-auto w-full max-w-[1198px] px-4 pt-2.5 sm:px-6 max-lg:pb-2.5 lg:grid lg:gap-x-8',
          !bigger && (previewHidden ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : 'lg:grid-cols-[minmax(0,806px)_312px] lg:justify-center'),
        )}
      >
        <section className={cn('@container min-w-0', bigger && 'flex flex-1 flex-col')}>
          <div className={cn('flex min-w-0 flex-col gap-2.5', bigger && 'flex-1')}>
            <FromSubjectRow
              subject={subject}
              stacked={bigger}
              onSubjectChange={(next) => {
                setSubject(next)
                changed({ subject: next })
              }}
            />
            <LetterEditor
              initialHtml={issue.letter.bodyHtml}
              month={month}
              onMonthChange={onMonthChange}
              onChange={(html) => {
                setBody(html)
                changed({ bodyHtml: html })
              }}
              bigger={bigger}
              onBiggerChange={setBigger}
              autoFocus={autoFocus}
              onReady={(html) => setPreview((now) => ({ ...now, bodyHtml: html }))}
            />
            {/* On a phone More options is a part of the page at its end, under the letter and its size row. */}
            {phone && moreOptions('end')}
          </div>
        </section>
        {/* The email at the side, from 1024 pixels up; under it, the email is the sheet's, and while the letter fills the window, put away. */}
        <div ref={side} hidden={bigger} className="mt-8 flex min-h-0 flex-col max-lg:hidden lg:mt-0">
          <SidePreview letter={preview} view={view} onView={onView} hidden={previewHidden} onHidden={onPreviewHidden}>
            <CountCard count={count} />
          </SidePreview>
        </div>
      </div>
      {/*
        The focus goes back to the control that opened the sheet; when the window has crossed 768 pixels while it was open,
        to "See the email" where it is then drawn, the bar's on a phone and the head's on a tablet; past 1024, to the side
        preview's own.
      */}
      <EmailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        letter={preview}
        notice={<SavedLineNotice line={issue.line} />}
        returnFocus={() => [opener.current, carry.find('see'), ...(side.current?.querySelectorAll<HTMLElement>('button') ?? [])]}
      />
      <FootBar
        phone={phone}
        bigger={bigger}
        count={count}
        moreOptions={!phone && moreOptions('bar')}
        onSeeEmail={openSheet}
        sheetOpen={sheetOpen}
        carry={carry}
      />
    </div>
  )
}
