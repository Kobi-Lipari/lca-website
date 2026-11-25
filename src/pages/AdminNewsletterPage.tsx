// src/pages/AdminNewsletterPage.tsx
//
// The LCA newsletter's own page, /admin/newsletter (WS16 part two, page
// step 4): the page K approved, board Newsletter-Page-4 (K's decision 51),
// on a computer. The route is registered only with the switch mailPage on
// (src/App.tsx), so with it off nobody reaches this page.
//
// Who is let in: whoever the server lets send the newsletter
// (requireListMailer): the LCA admins, the President seat's holder whatever
// their role (decision 79), and whoever holds the Media manager seat, an
// officer or LCA Observer among them (K's decision 52). The route lets in
// Admin's roles, the President seat's holder, and the media manager on the
// server's answer, which it hands down; an LCA Observer without either seat
// reads why here, and an officer without the seat is sent to Admin. Nobody here sees a "View only" badge. A media
// manager signed in without a second factor, whom the server would refuse,
// is told so in the newsletter tab's own words, with the way to set it up,
// and no call is made.
//
// The page: the head with the saved line (NewsletterHead), From and
// Subject, the tools and the letter (LetterEditor), the size controls, at
// the side what members will get with the count, and the bar at the foot
// (FootBar, page step 5): More options (MoreOptions), with the letter's
// inbox preview line, who gets it and where replies go, then the three
// numbered steps. The first opens the chooser of templates and past
// newsletters (TemplateChooser, page step 5's second part): "Use this" saves
// the words on the page first, or with nothing to save reads that the
// server's letter is still the page's, asks once before a letter that holds
// words is replaced, reads again once it is answered, and starts the new
// letter, which the server keeps the old one for; a letter someone else has
// changed since starts nothing, and the saved line says who changed it and
// when. The new letter is drawn afresh, More options closed, the focus on
// the first step, and a moment later the saved line says which choice it
// came from. A letter set aside, used again for its own month, brings back
// its own subject with its words. The first step wiggles once as the page
// opens on a letter that holds no words.
// Step 2, "Send a test to me" (page step 6), saves the words on the page
// first by the chooser's own path, then asks for a test of the stored letter
// to the person's own address, and the bar's status line says what came of
// it in words. Step 3, Send, is drawn and not yet available, and a press on
// it says why there. Saving, starting and the test are useIssue's. Help, in
// the head once the letter is on the page, opens a walkthrough of the page
// in six steps (HelpWalkthrough.tsx).
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

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { defaultSubject } from '@domain/mail/letter'
import { TEST_NO_WORDS, WAITS_FOR_SES } from '@domain/mail/newsletterWords'
import { LIST_MAILERS_ONLY } from '@domain/mail/senders'
import { useAuth } from '@/contexts/auth-context'
import { holdsPresidentSeat, presidentMayCall } from '@/areas/admin/roles'
import { useMediaManagerAnswer } from '@/areas/admin/mediaManagerAnswer'
import { CountCard } from '@/areas/admin/newsletter/CountCard'
import { FootBar, type BarSaid, type FocusCarry, type FocusHold } from '@/areas/admin/newsletter/FootBar'
import { FromSubjectRow } from '@/areas/admin/newsletter/FromSubjectRow'
import { LetterEditor } from '@/areas/admin/newsletter/LetterEditor'
import { MoreOptions, type ReachRead } from '@/areas/admin/newsletter/MoreOptions'
import { NewsletterHead, SavedLineNotice, type SavedLineProps } from '@/areas/admin/newsletter/NewsletterHead'
import { EmailSheet, SidePreview, type PreviewView } from '@/areas/admin/newsletter/SidePreview'
import { TemplateChooser, type ChooserBusy, type Choice } from '@/areas/admin/newsletter/TemplateChooser'
import { holdsWords, useIssue, type Issue, type LetterDraft, type SavedFirst, type StartOutcome, type TestOutcome } from '@/areas/admin/newsletter/useIssue'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTabletScreen, useWideScreen } from '@/hooks/useWideScreen'
import { HelpWalkthrough } from '@/areas/admin/newsletter/HelpWalkthrough'
import { getNewsletter } from '@/lib/api'
import { cn } from '@/lib/utils'

/** The newsletter tab's own words for a media manager signed in without a second factor (src/pages/AdminEmailPage.tsx). */
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'

/** How long the side preview waits after the last change before it draws the letter again. */
const PREVIEW_PAUSE_MS = 400

/**
 * How long after a start's letter is drawn its saved line waits before it says which choice it came from: a quarter of
 * a second, so the line's polite region, drawn afresh with the letter, is on the page empty first, as a screen reader
 * says only a change to a region already there.
 */
const STARTED_PAUSE_MS = 250

/**
 * The one key this page keeps in the browser: that its Help has opened by itself once. The page's own, not the Group
 * email tab's 'lca-newsletter-help'. Nothing about it is stored on the server.
 */
const HELP_SHOWN_KEY = 'lca-newsletter-page-help'

/** Whether Help has opened by itself in this browser before; a browser that refuses storage reads as yes, so Help starts closed. */
function helpShownBefore(): boolean {
  try {
    return window.localStorage.getItem(HELP_SHOWN_KEY) !== null
  } catch {
    return true
  }
}

/**
 * Writes the key, and says whether it held. A browser that reads its storage but refuses to write to it (full, or some
 * private windows) would otherwise open Help by itself on every visit; it counts as already shown, and opens Help from
 * its button alone.
 */
function rememberHelpShown(): boolean {
  try {
    window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
    return true
  } catch {
    return false
  }
}

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

/**
 * Why no letter was started when the words on the page could not be saved first, or were still being saved after the
 * wait, or the server's letter was found to be someone else's newer one, or could not be read; the saved line's own
 * notice says the rest. A press after an earlier refusal with nothing typed since says who and when are on the saved
 * line, since the chooser, opened again, shows no notice of what came before it opened.
 */
const NOT_SAVED_FIRST: Record<Exclude<SavedFirst, 'saved'>, string> = {
  failed: 'Your words could not be saved, so no letter was started. Try again in a moment.',
  refused: 'Your words could not be saved, so no letter was started.',
  conflict: 'Your words could not be saved, so no letter was started.',
  stopped: 'Your words here are not saved, so no letter was started. Copy anything you want to keep first.',
  'changed-before': 'No new letter was started: someone else has changed, replaced or sent this letter. Close this to see who and when.',
  waiting: 'Your words are still being saved, so no letter was started. Try again in a moment.',
  changed: 'No new letter was started.',
  unchecked: 'Could not start a new letter. Try again in a moment.',
}

/** Why a start that went to the server did not put a new letter on the page, in the chooser's own words. */
function startFailedWords(outcome: Exclude<StartOutcome, { kind: 'started' } | { kind: 'busy' }>): string {
  if (outcome.kind === 'refused') return 'No new letter was started.'
  if (outcome.kind === 'not-found') return 'That newsletter could not be found, so no letter was started.'
  return outcome.words !== '' ? outcome.words : 'Could not start a new letter. Try again in a moment.'
}

/** The test's words when someone else has changed, replaced or sent the letter: the saved line at the page's top says who and when. */
const TEST_CHANGED = 'No test was sent: someone else has changed, replaced or sent this letter. See who and when at the top of the page.'

/** The test's words for a test that could not be asked for, or got no answer the page can read. */
const TEST_FAILED = 'The test could not be sent. Try again in a moment.'

/**
 * Why no test was sent when the words on the page could not be saved first, by saveFirst's answer, in the chooser's
 * own words for the same answers; the saved line says the rest, as it does for any save.
 */
const TEST_NOT_SAVED: Record<Exclude<SavedFirst, 'saved'>, string> = {
  failed: 'Your words could not be saved, so no test was sent. Try again in a moment.',
  refused: 'Your words could not be saved, so no test was sent.',
  conflict: 'Your words could not be saved, so no test was sent.',
  stopped: 'Your words here are not saved, so no test was sent. Copy anything you want to keep first.',
  'changed-before': TEST_CHANGED,
  waiting: 'Your words are still being saved, so no test was sent. Try again in a moment.',
  changed: TEST_CHANGED,
  unchecked: TEST_FAILED,
}

/** What the bar's status line says of a test, in words, or null for a letter that has left the page. */
function testSaid(outcome: TestOutcome): BarSaid | null {
  switch (outcome.kind) {
    case 'sent':
      return { tone: 'sent', words: outcome.to !== '' ? `Test sent to ${outcome.to}.` : 'Test sent to your address.' }
    case 'not-saved':
      return { tone: 'not-sent', words: TEST_NOT_SAVED[outcome.first] }
    case 'empty':
      // The server holds no letter yet, so there is nothing to test: its own words for a letter with no words.
      return { tone: 'not-sent', words: TEST_NO_WORDS }
    case 'conflict':
      return { tone: 'not-sent', words: TEST_CHANGED }
    case 'moved':
      return { tone: 'not-sent', words: 'No test was sent, since your words changed as it went. Send a test again.' }
    case 'refused':
      return { tone: 'not-sent', words: outcome.words !== '' ? outcome.words : TEST_FAILED }
    default:
      return null
  }
}

/**
 * What the email's sheet says of a test while it hides the page, whose bar line is then out of a screen reader's reach:
 * only what the bar has come to say since the sheet opened, once, in a polite line of the sheet's own. A test on its
 * way is heard and not drawn, as on the bar.
 */
function SheetTestNotice({ said }: { said: BarSaid | null }) {
  const [asOpened] = useState(said)
  const now = said !== asOpened ? said : null
  return (
    <p role="status" aria-atomic="true" className={cn('text-[15px] leading-snug text-ink', now && now.tone !== 'busy' && 'mt-2')} data-slot="sheet-test-said">
      {now && <span className={now.tone === 'busy' ? 'sr-only' : undefined}>{now.words}</span>}
    </p>
  )
}

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
  const { role, seats, assuranceLevel } = useAuth()
  const answer = useMediaManagerAnswer()
  // The LCA admins and the President seat's holder send as themselves (decision 79); anyone else is let in on the
  // server's answer alone.
  const president = holdsPresidentSeat(seats)
  const asThemselves = role === 'lca_admin' || president
  if (!asThemselves && answer.asking) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
        <p role="status" className="text-muted-foreground">Loading...</p>
      </div>
    )
  }
  // An LCA Observer who sends no newsletter reads why, in the page's frame; anyone else is sent to Admin as before.
  if (!asThemselves && !answer.mediaManager && role === 'lca_observer') {
    return (
      <div className={DESK}>
        <NewsletterHead />
        <div className="mx-auto max-w-[1198px] px-4 py-6 sm:px-6">
          <p role="status" className="text-ink">{LIST_MAILERS_ONLY}</p>
        </div>
      </div>
    )
  }
  if (!asThemselves && !answer.mediaManager) return <Navigate to="/admin" replace />
  const mayCall = role === 'lca_admin' || (president ? presidentMayCall(assuranceLevel) : answer.secondFactor)
  return <NewsletterDesk mayCall={mayCall} />
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
  /** Takes the focus once, when the line is first drawn, and not again on a later draw. */
  const focusWhenDrawn = useCallback((node: HTMLElement | null) => node?.focus(), [])

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
              <Link to="/account/security" className="inline-flex min-h-11 items-center rounded-sm font-medium underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus">
                {SECOND_FACTOR_LINE}
              </Link>
            </p>
          ) : issue.status === 'loading' ? (
            // After Try again, the focus waits here while the letter is read, then goes into the letter (autoFocus below).
            <p role="status" tabIndex={-1} ref={replaced ? focusWhenDrawn : undefined} className="text-[15px] text-ink outline-none">
              Loading the letter...
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
              <p role="alert">
                The letter could not be read.{issue.loadError && ` ${issue.loadError}`}
              </p>
              <button
                type="button"
                onClick={() => {
                  setReplaced(true)
                  issue.reload()
                }}
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
      // A letter a start puts on the page gives the focus to the first step, so the letter's own caret is not taken there.
      onStarting={() => setReplaced(false)}
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
  /** A start is being sent from the chooser. */
  onStarting: () => void
}

/** One letter on the page, drawn afresh each time a letter takes the place of the one before. */
function NewsletterLetter({ issue, reach, view, onView, previewHidden, onPreviewHidden, autoFocus, onShowTheirs, onStarting }: NewsletterLetterProps) {
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
  // The chooser, the page's own as More options is, the question before a letter that holds words is replaced, what the
  // chooser is doing, and why a start did not happen; all closed and empty whenever a letter is drawn.
  const [chooserOpen, setChooserOpen] = useState(false)
  const [asking, setAsking] = useState<Choice | null>(null)
  const [busy, setBusy] = useState<ChooserBusy>(null)
  const [said, setSaid] = useState('')
  // "Send a test to me" while it is on its way, and what the bar's status line says; empty whenever a letter is drawn.
  const [testing, setTesting] = useState(false)
  const [barSaid, setBarSaid] = useState<BarSaid | null>(null)
  // The first step's cue plays once only, as the page opens on its first letter when that letter holds no words, from
  // the moment the letter is drawn until something is written. It is held while Help is open: Help opening by itself
  // turns on in the same update as `drawn`, so the cue first plays as Help closes, if the letter still holds no words
  // and the focus is not in the bar (FootBar's usePickCue), and Help opened over a cue that is playing stops it.
  const [opensEmpty] = useState(() => issue.letterKey === 1 && !holdsWords(issue.letter))
  const [drawn, setDrawn] = useState(false)
  // Help's walkthrough, and Help itself, which takes the focus back as it closes.
  const [helpOpen, setHelpOpen] = useState(false)
  const helpButton = useRef<HTMLButtonElement>(null)
  // Under 768 pixels the phone's bar, "See the email" in it, and More options at the page's end.
  const phone = !useTabletScreen()
  const wide = useWideScreen()
  const carry = useFocusCarry()
  const desk = useRef<HTMLDivElement>(null)
  const side = useRef<HTMLDivElement>(null)
  /** The control that opened the email's sheet, which takes the focus back as it closes. */
  const opener = useRef<HTMLButtonElement | null>(null)
  const previewPause = useRef<number | undefined>(undefined)
  /**
   * Whether this letter is still the one on the page: a save or a read made for a start that answers after it has gone
   * starts nothing, and saveFirst then sends no save to learn who changed the letter; a save of the words on the page
   * over one of the page's own saves the read finds still goes, as the page's leave save would.
   */
  const live = useRef(true)
  const words: LetterDraft = { monthLabel: month, subject, preheader, bodyHtml: body }

  useEffect(() => () => window.clearTimeout(previewPause.current), [])
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // A letter a start put on the page: the focus goes at once to the first step, which opened the chooser, drawn afresh
  // with the letter, by a plain focus, which brings it into view; the saved line says which choice it came from, once,
  // STARTED_PAUSE_MS later, by a timer set once and cleared as this letter leaves the page. The line's polite region is
  // drawn afresh with the letter, and this effect runs in the same task as that drawing, before the browser shows a
  // frame, so words put in it at once would come with the region itself, which a screen reader does not say.
  const { startedFrom, sayStarted } = issue
  useEffect(() => {
    if (startedFrom === null) return
    carry.find('pick')?.focus()
    const later = window.setTimeout(sayStarted, STARTED_PAUSE_MS)
    return () => window.clearTimeout(later)
  }, [startedFrom, sayStarted, carry])

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

  /** The first step opens the chooser; More options, at a phone's page end or in the bar, closes as it does. */
  function openChooser() {
    setMoreOpen(false)
    setSaid('')
    setChooserOpen(true)
  }

  /** Escape, Close or a press outside it: never while a letter is being started, which then puts its own letter here. */
  function closeChooser() {
    if (busy !== null) return
    setAsking(null)
    setChooserOpen(false)
  }

  /**
   * The words on the page saved first, or, with nothing to save, the server's letter read to learn that it is still the
   * one the page holds (saveFirst), the chooser saying which it is doing. False when either cannot be had, the chooser
   * then saying why, staying open, since it hides the saved line; and false once this letter has left the page, when
   * nothing is started and saveFirst sends no save to learn who changed the letter.
   */
  async function heldFirst(): Promise<boolean> {
    setBusy('checking')
    const first = await issue.saveFirst(() => setBusy('saving'), () => live.current)
    if (!live.current) return false
    setBusy(null)
    if (first === 'saved') return true
    setSaid(NOT_SAVED_FIRST[first])
    return false
  }

  /**
   * "Use this": nothing is started until the server holds every word on the page as the page knows it (heldFirst), so
   * nothing a person wrote is left only on the page and the question is asked of the letter the server would keep. Then
   * a letter that holds words is replaced only once the question has been answered.
   */
  async function use(choice: Choice) {
    if (busy !== null || asking !== null) return
    setSaid('')
    if (!(await heldFirst())) return
    if (holdsWords(words)) setAsking(choice)
    else await begin(choice)
  }

  /** The question's answer. The question may have stood open a while, so "Replace it" asks again that the server's letter is still the page's. */
  function answer(replace: boolean) {
    const choice = asking
    setAsking(null)
    if (replace && choice) void replaceWith(choice)
  }

  async function replaceWith(choice: Choice) {
    if (await heldFirst()) await begin(choice)
  }

  /**
   * The start itself, for the month the page is on, with the subject of its own a letter set aside takes back for its
   * month; on success this letter is replaced, so nothing more is done here, nor for a start asked for while one is on
   * its way, which sends nothing ('busy'): the one on its way says what it comes to.
   */
  async function begin(choice: Choice) {
    setBusy('starting')
    onStarting()
    const outcome = await issue.start(choice.from, month, choice.startedFrom, choice.subjectBack)
    if (outcome.kind === 'started' || outcome.kind === 'busy') return
    setBusy(null)
    setSaid(startFailedWords(outcome))
  }

  /**
   * "Send a test to me": one test at a time, the step saying so while it is on its way and the status line saying it
   * to a screen reader; then what it came to, in words. Nothing is said for a letter that has left the page meanwhile.
   */
  async function sendTest() {
    if (testing) return
    setTesting(true)
    setBarSaid({ tone: 'busy', words: 'Sending a test to your address.' })
    const outcome = await issue.sendTest(() => live.current)
    if (!live.current) return
    setTesting(false)
    setBarSaid(testSaid(outcome))
  }

  /** Send, drawn and not yet available, says why on a press, in the newsletter tab's own words for its Send. */
  function sendNotYet() {
    setBarSaid({ tone: 'note', words: WAITS_FOR_SES })
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
        onHelp={() => setHelpOpen(true)}
        helpOpen={helpOpen}
        helpRef={helpButton}
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
              onReady={(html) => {
                setPreview((now) => ({ ...now, bodyHtml: html }))
                setDrawn(true)
                // Help opens by itself once in this browser, as the letter is first drawn on a ready page; the key is
                // written as it opens, so from then on it opens from its button alone. Where the key cannot be written,
                // it does not open by itself at all.
                if (!helpShownBefore() && rememberHelpShown()) setHelpOpen(true)
              }}
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
        notice={
          <>
            <SavedLineNotice line={issue.line} />
            <SheetTestNotice said={barSaid} />
          </>
        }
        returnFocus={() => [opener.current, carry.find('see'), ...(side.current?.querySelectorAll<HTMLElement>('button') ?? [])]}
      />
      <FootBar
        phone={phone}
        bigger={bigger}
        count={count}
        moreOptions={!phone && moreOptions('bar')}
        onSeeEmail={openSheet}
        sheetOpen={sheetOpen}
        onPick={openChooser}
        chooserOpen={chooserOpen}
        cue={opensEmpty && drawn && !helpOpen && !holdsWords(words)}
        carry={carry}
        onTest={() => void sendTest()}
        testing={testing}
        onSendNotYet={sendNotYet}
        said={barSaid}
      />
      {/*
        The chooser, drawn in a layer of its own over the page. It comes after the bar here, so that as the window crosses
        768 pixels while it is open, the first step drawn in the bar's new form is on the page by the time the chooser
        places itself from it.
      */}
      <TemplateChooser
        open={chooserOpen}
        onClose={closeChooser}
        phone={phone}
        opener={() => carry.find('pick')}
        onUse={(choice) => void use(choice)}
        busy={busy}
        said={said}
        notice={<SavedLineNotice line={issue.line} />}
        asking={asking}
        onAnswer={answer}
        letterBody={words.bodyHtml}
        letterHasWords={holdsWords({ monthLabel: '', subject: '', preheader: '', bodyHtml: words.bodyHtml })}
      />
      {/* Help's walkthrough. Send on the bar is drawn quiet and sends nothing yet, so Help does not tell a person to send. */}
      {helpOpen && <HelpWalkthrough width={wide ? 'desk' : phone ? 'phone' : 'tablet'} sendReady={false} onClose={() => setHelpOpen(false)} opener={() => helpButton.current} notice={<SavedLineNotice line={issue.line} />} />}
    </div>
  )
}
