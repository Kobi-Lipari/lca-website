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
// Subject, the tools and the letter (LetterEditor), the size controls, and
// at the side what members will get with the count. Saving is useIssue's.
// The bar at the foot, Help, the tablet's and the phone's own pieces, the
// test and Send come with later steps: the page keeps 80 pixels of room at
// its foot for the bar, which is 76 pixels tall on the board.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { defaultSubject } from '@domain/mail/letter'
import { useAuth } from '@/contexts/auth-context'
import { useMediaManagerAnswer } from '@/areas/admin/mediaManagerAnswer'
import { CountCard } from '@/areas/admin/newsletter/CountCard'
import { FromSubjectRow } from '@/areas/admin/newsletter/FromSubjectRow'
import { LetterEditor } from '@/areas/admin/newsletter/LetterEditor'
import { MonthState, NewsletterHead, SavedLine, type SavedLineProps } from '@/areas/admin/newsletter/NewsletterHead'
import { SidePreview, type PreviewView } from '@/areas/admin/newsletter/SidePreview'
import { useIssue, type Issue, type LetterDraft } from '@/areas/admin/newsletter/useIssue'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getNewsletter } from '@/lib/api'
import { cn } from '@/lib/utils'

/** The newsletter tab's own words for a media manager signed in without a second factor (src/pages/AdminEmailPage.tsx). */
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'

/** How long the side preview waits after the last change before it draws the letter again. */
const PREVIEW_PAUSE_MS = 400

/**
 * The page's ground under the head: the board's desk, a warm tint over the site's own ground, in every look. Each
 * control the keyboard reaches keeps room above it for the site's sticky header, which today's header does not ask the
 * page to keep, and below it for the bar page step 5 fixes at the window's foot, so a control reached by Tab is
 * scrolled clear of both.
 */
const DESK = 'min-h-[calc(100dvh-var(--header-h,64px))] bg-lca-gold/20 pb-20 [&_:is(a,button,input,[tabindex],[contenteditable])]:scroll-mb-24 [&_:is(a,button,input,[tabindex],[contenteditable])]:scroll-mt-24'

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
  const [count, setCount] = useState<number | null | 'failed'>(null)
  const [view, setView] = useState<PreviewView>('phone')
  const [previewHidden, setPreviewHidden] = useState(false)
  const [replaced, setReplaced] = useState(false)

  useEffect(() => {
    if (!mayCall) return
    let gone = false
    getNewsletter().then(
      (newsletter) => {
        if (!gone) setCount(newsletter.summary.willGet)
      },
      () => {
        if (!gone) setCount('failed')
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
      count={count}
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
  count: number | null | 'failed'
  view: PreviewView
  onView: (view: PreviewView) => void
  previewHidden: boolean
  onPreviewHidden: (hidden: boolean) => void
  autoFocus: boolean
  onShowTheirs: () => void
}

/** One letter on the page, drawn afresh each time a letter takes the place of the one before. */
function NewsletterLetter({ issue, count, view, onView, previewHidden, onPreviewHidden, autoFocus, onShowTheirs }: NewsletterLetterProps) {
  const [month, setMonth] = useState(issue.letter.monthLabel)
  const [subject, setSubject] = useState(issue.letter.subject)
  const [body, setBody] = useState(issue.letter.bodyHtml)
  // The side draws the letter as the editor holds it, never the words as they came, so it starts with the band alone.
  const [preview, setPreview] = useState<LetterDraft>({ ...issue.letter, bodyHtml: '' })
  const [bigger, setBigger] = useState(false)
  const column = useRef<HTMLElement>(null)
  const previewPause = useRef<number | undefined>(undefined)
  const preheader = issue.letter.preheader

  useEffect(() => () => window.clearTimeout(previewPause.current), [])

  /** The words on the page changed: the letter saves after its pause, and the side draws it again after a shorter one. */
  function changed(next: Partial<LetterDraft>) {
    const draft: LetterDraft = {
      monthLabel: next.monthLabel ?? month,
      subject: next.subject ?? subject,
      preheader,
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
   * something drawn over the letter, such as the "Show their letter?" question, reaches here through React's tree from
   * outside the column, and is that thing's own: Escape there closes the question alone. Whether the key was marked
   * handled is not asked, since the letter's editor marks every Escape as its own.
   */
  function onColumnKey(event: KeyboardEvent<HTMLElement>) {
    if (!bigger) return
    if (!column.current?.contains(event.target as Node)) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setBigger(false)
      return
    }
    if (event.key !== 'Tab') return
    const stops = tabStops(column.current)
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

  const saved: SavedLineProps = { line: issue.line, onTryAgain: issue.saveNow, onShowTheirs }
  return (
    <div className={DESK} data-slot="newsletter-page">
      <NewsletterHead month={month} state={issue.state} saved={bigger ? undefined : saved} />
      <div
        className={cn(
          'mx-auto max-w-[1198px] px-4 pt-2.5 sm:px-6 lg:grid lg:gap-x-8',
          previewHidden ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : 'lg:grid-cols-[minmax(0,806px)_312px] lg:justify-center',
        )}
      >
        <section
          ref={column}
          role={bigger ? 'dialog' : undefined}
          aria-modal={bigger || undefined}
          aria-label={bigger ? 'The letter, made bigger' : undefined}
          onKeyDown={onColumnKey}
          className={cn('@container min-w-0', bigger && 'fixed inset-0 z-[70] overflow-y-auto bg-background')}
        >
          <div className={cn('flex min-w-0 flex-col gap-2.5', bigger && 'min-h-full bg-lca-gold/20 px-4 pb-4 sm:px-5')}>
            {bigger && (
              <div className="-mx-4 border-b border-border bg-background px-5 py-2 sm:-mx-5">
                {/* Held to the letter's width, which stops at the board's 1200 pixels so its lines never run the window's width. */}
                <div className="mx-auto flex min-h-[52px] w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1">
                  <MonthState month={month} state={issue.state} />
                  <SavedLine {...saved} />
                </div>
              </div>
            )}
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
          </div>
        </section>
        <div className="mt-8 flex min-h-0 flex-col lg:mt-0">
          <SidePreview letter={preview} view={view} onView={onView} hidden={previewHidden} onHidden={onPreviewHidden}>
            <CountCard count={count} />
          </SidePreview>
        </div>
      </div>
    </div>
  )
}
