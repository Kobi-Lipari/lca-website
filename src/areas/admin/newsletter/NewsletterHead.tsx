// src/areas/admin/newsletter/NewsletterHead.tsx
//
// The head of the newsletter's own page (board Newsletter-Page-4, P1): the
// crumb "Admin / Newsletter", the title, the month with the letter's state
// in a word, and the saved line; at the right, Help and "Admin sections".
//
// The saved line says each state in words beside its mark (K's standing
// rule: status in words as well as colour): "Saving", "Saved automatically
// at 2:15 PM" (with the day and its weekday when the save was not today),
// "Could not save" with Try again, the server's own words for a letter it
// refuses, and who changed, sent or replaced the letter and when, with
// "Show their letter", which asks once before it replaces the person's
// words; for a letter that was sent, "Start the next letter", which asks
// in the same way. The quiet states are read out politely and a refusal at once, every
// sentence of it in the one region, what follows it and a read of their
// letter that failed among them, and neither takes the focus from where the
// person is.
//
// Help opens the page's walkthrough (HelpWalkthrough.tsx), a dialog, and is
// drawn only once the letter is on the page: not while the letter is read,
// nor when it could not be, nor to a person who has yet to set up a second
// factor, where it would point at nothing, nor with the letter made bigger.
//
// On a tablet and a phone, under 1024 pixels (boards P19 and P20), Help is
// its mark alone, 44 pixels square, white with an edge as the tablet's and
// the phone's boards draw it, its name kept for a screen reader; "Admin sections" gives way to the crumb's
// own Admin, and every link a finger can press is 44 pixels tall. On a
// tablet, from 768 to 1023 pixels, "See the email" stands at the head's
// right, where the tablet's board draws it; on a phone, under 768, it is in
// the bar at the foot, beside "Pick a template" (FootBar.tsx), and the head
// draws none. On a phone the month and the saved line each have a line of
// their own under the title, as board P20 draws them.
//
// While the letter fills the window, this same head is its top: the month
// with its state, the saved line and "Show the email", the rest put away. The
// saved line is one element in both, so its two regions stay in place as the
// letter is made bigger and smaller, and a refusal on it is never read out
// again by a change of size.

import { useState, type Ref } from 'react'
import { Link } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, CircleAlert, CircleHelp, Eye, Menu } from 'lucide-react'
import { zonedParts } from '@domain/format/date'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { QUIET_BUTTON } from './SidePreview'
import type { SaveLine } from './useIssue'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const

/**
 * When a stored time was, in words: "at 2:15 PM" for a time today in Central time, else "on Thursday, November 12,
 * 2026 at 2:15 PM", the day in full with its weekday. The names come from tables, as the site's own date words do.
 */
function whenWords(stored: string, now: number = Date.now()): string {
  const time = formatTime(stored, { stored: 'utc' })
  const day = zonedParts(stored, { stored: 'utc' })
  const today = zonedParts(now)
  if (!day || !today) return `at ${time}`
  if (day.year === today.year && day.month === today.month && day.day === today.day) return `at ${time}`
  const weekday = WEEKDAYS[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()]
  return `on ${weekday}, ${MONTHS[day.month - 1]} ${day.day}, ${day.year} at ${time}`
}

/** The saved line's words for a save the server answered. */
function savedWords(stored: string): string {
  const when = whenWords(stored)
  return when.startsWith('at ') ? `Saved automatically ${when}` : `Saved ${when}`
}

/** Who changed the letter and when, by the reason of the 409, in plain words. */
function conflictWords(line: Extract<SaveLine, { kind: 'conflict' }>): string {
  const who = line.by ?? 'Someone'
  const what = line.reason === 'sent' ? 'sent this letter' : line.reason === 'set_aside' ? 'started a new letter' : 'changed this letter'
  return `${who} ${what} ${whenWords(line.at)}`
}

/** What follows a 409's words: that nothing more is saved, and that the person's words stay. */
function afterConflict(line: Extract<SaveLine, { kind: 'conflict' }>): string {
  const kept = line.reason === 'sent' ? 'Nothing more is saved to it.' : 'Nothing more is saved over their letter.'
  return `${kept} Your words stay here for you to copy.`
}

/** The sentence a read of their letter that failed adds to a refusal, in a part of its own. */
const READ_FAILED = 'Their letter could not be read. Press "Show their letter" to try again.'

/**
 * The quiet words of a line, read out politely, and the words of a refusal, read out at once: its first sentence, in
 * bold, and the sentences that follow it.
 */
function wordsOf(line: SaveLine): { quiet: string; urgent: string; after: string } {
  switch (line.kind) {
    case 'saving':
      return { quiet: 'Saving', urgent: '', after: '' }
    case 'saved':
      return { quiet: savedWords(line.at), urgent: '', after: '' }
    case 'failed':
      return { quiet: '', urgent: 'Could not save', after: '' }
    case 'signed-out':
      return { quiet: '', urgent: 'Your sign-in has ended, so this is not saved.', after: 'Copy your words, then sign in again.' }
    case 'refused':
      return { quiet: '', urgent: line.words, after: '' }
    case 'conflict':
      return { quiet: '', urgent: `${conflictWords(line)}.`, after: afterConflict(line) }
    case 'started':
      // A letter the chooser started (page step 5, second part), said once the page has drawn it.
      return { quiet: `Started from ${line.from}`, urgent: '', after: '' }
    default:
      return { quiet: '', urgent: '', after: '' }
  }
}

/** A soft button of the head, 44px tall. */
const SOFT = 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink/8 px-3.5 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

/**
 * Help: the soft button from 1024 pixels up; under 1024 the board's small Help button, 44 square, white with a 1px
 * edge, the mark alone. The soft tint is a layer of its own, drawn from 1024 up only (HELP_TINT), so no rule of the
 * tint's for browsers that cannot mix colours ever sits beside the white on one element and beats it.
 */
const HELP_BUTTON = 'relative isolate inline-flex min-h-11 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus max-lg:w-11 max-lg:justify-center max-lg:border max-lg:border-border max-lg:bg-background max-lg:px-0'
const HELP_TINT = 'pointer-events-none absolute inset-0 -z-10 rounded-lg bg-ink/8 max-lg:hidden'

/** A small words button beside the saved line, 44px tall. */
const LINE_BUTTON = 'inline-flex min-h-11 items-center rounded-md px-2 text-[15px] font-semibold text-ink underline underline-offset-3 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus'

export interface SavedLineProps {
  line: SaveLine
  onTryAgain: () => void
  /** Called once the person has said yes to showing the newer letter in place of their words. */
  onShowTheirs: () => void
  className?: string
}

/**
 * The saved line: its words, its mark beside them, and the step it offers after them. Two live regions stay in place,
 * one polite and one assertive, so each change is read out without the focus moving; the assertive one holds every
 * sentence of a refusal, so a sentence added to it, as when their letter could not be read, is read out too. That
 * sentence is a part of its own, put in afresh for each read that fails, so a failure that repeats changes the region
 * once and is said again, and a read on its way changes nothing.
 */
export function SavedLine({ line, onTryAgain, onShowTheirs, className }: SavedLineProps) {
  const [asking, setAsking] = useState(false)
  const { quiet, urgent, after } = wordsOf(line)
  const conflict = line.kind === 'conflict' ? line : null
  const failures = conflict?.readFailures ?? 0
  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] text-muted-foreground', className)} data-slot="saved-line">
      {/* The mark stays beside the first line of the words when they run on; only one of the two regions holds words at a time. */}
      <span className="flex min-w-0 items-start">
        {line.kind === 'saved' && <Check className="mr-2 mt-[3px] size-4 flex-none text-ok-700" aria-hidden="true" />}
        {urgent !== '' && <CircleAlert className="mr-2 mt-[3px] size-4 flex-none text-destructive" aria-hidden="true" />}
        <span role="status" aria-atomic="true">{quiet}</span>
        <span role="alert" className={cn(urgent !== '' && 'text-ink')}>
          {urgent !== '' && <span className="font-semibold">{urgent}</span>}
          {after !== '' && ` ${after}`}
          {failures > 0 && <span key={failures}>{` ${READ_FAILED}`}</span>}
        </span>
      </span>
      {line.kind === 'failed' && (
        <button
          type="button"
          className={LINE_BUTTON}
          onClick={() => {
            onTryAgain()
            // The button goes as the save does, so the focus goes back to the letter, whose editor keeps its caret.
            document.querySelector<HTMLElement>('[role="textbox"][aria-label="The letter"]')?.focus()
          }}
        >
          Try again
        </button>
      )}
      {/*
        A letter that was sent cannot be shown in place of the person's words, so its step is the next letter, read as
        "Show their letter" reads the open one, and asked first in the same form, since the saving has stopped and their
        words may not be on the server.
      */}
      {conflict && (
        <DialogPrimitive.Root open={asking} onOpenChange={setAsking}>
          <DialogPrimitive.Trigger className={LINE_BUTTON}>{conflict.reason === 'sent' ? 'Start the next letter' : 'Show their letter'}</DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-brand-navy/55" />
            <DialogPrimitive.Content
              className="fixed left-1/2 top-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 text-ink shadow-xl outline-none"
            >
              <DialogPrimitive.Title className="text-lg font-bold">{conflict.reason === 'sent' ? 'Start the next letter?' : 'Show their letter?'}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-[15px] text-ink">
                {conflict.reason === 'sent'
                  ? 'The next letter takes the place of your words on this page. Copy anything of yours you want to keep first.'
                  : 'Their letter takes the place of your words on this page. Copy anything of yours you want to keep first.'}
              </DialogPrimitive.Description>
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <DialogPrimitive.Close className="inline-flex min-h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[15px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
                  Keep my words
                </DialogPrimitive.Close>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand-navy px-4 text-[15px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus"
                  onClick={() => {
                    setAsking(false)
                    onShowTheirs()
                  }}
                >
                  {conflict.reason === 'sent' ? 'Start the next letter' : 'Show their letter'}
                </button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}
    </div>
  )
}

export interface NewsletterHeadProps {
  /** The letter's month, as its band writes it, '' for none; nothing while no letter is on the page yet. */
  month?: string
  /** The letter's state: 'draft' for an open letter, 'none' while the letter on the page has not been saved yet. */
  state?: 'none' | 'draft'
  /** The saved line; nothing while no letter is on the page yet. */
  saved?: SavedLineProps
  /** Whether the letter fills the window, the head then being its top. */
  bigger?: boolean
  /**
   * Opens the email's sheet, from the control pressed: "See the email" on a tablet, from 768 to 1023 pixels, and "Show
   * the email" on the letter made bigger.
   */
  onSeeEmail?: (opener: HTMLButtonElement) => void
  /** Whether the email's sheet is open. */
  sheetOpen?: boolean
  /** Under 768 pixels, where "See the email" is the bar's at the foot and the head draws none. */
  phone?: boolean
  /**
   * The ref of the head's "See the email", and of "Show the email" on the letter made bigger, the same action: each takes
   * the focus back as the sheet closes, and the focus a "See the email" taken off the page carried.
   */
  seeRef?: Ref<HTMLButtonElement>
  /** Opens Help's walkthrough; Help is drawn only with it, once the letter is on the page. */
  onHelp?: () => void
  /** Whether Help's walkthrough is open. */
  helpOpen?: boolean
  /** The ref of Help, which takes the focus back as the walkthrough closes, however it was opened. */
  helpRef?: Ref<HTMLButtonElement>
}

/** The month with the letter's state in a word: "Draft" for an open letter, "Not saved yet" for a letter with no row yet. */
export function MonthState({ month, state, className }: { month: string; state: 'none' | 'draft'; className?: string }) {
  const word = state === 'draft' ? 'Draft' : 'Not saved yet'
  return (
    <span className={cn('text-[15px] text-muted-foreground', className)}>
      {month !== '' && <b className="font-semibold text-ink">{month}</b>}
      {month !== '' && ' · '}
      {word}
    </span>
  )
}

/**
 * The saved line's refusals, said again in a sheet that hides the page while it is open: the words of a refusal or a
 * failure that comes while the sheet is open, in an assertive region of the sheet's own, which is empty as it opens, so a
 * refusal the line said before it opened is not said again.
 */
export function SavedLineNotice({ line }: { line: SaveLine }) {
  const [asOpened] = useState(line)
  const { urgent, after } = wordsOf(line)
  const said = line !== asOpened && urgent !== ''
  const failures = line.kind === 'conflict' ? line.readFailures : 0
  return (
    <p role="alert" className={cn('flex items-start text-[15px] text-ink', said && 'mt-2')} data-slot="sheet-notice">
      {said && <CircleAlert className="mr-2 mt-[3px] size-4 flex-none text-destructive" aria-hidden="true" />}
      {said && (
        <span>
          <span className="font-semibold">{urgent}</span>
          {after !== '' && ` ${after}`}
          {failures > 0 && ` ${READ_FAILED}`}
        </span>
      )}
    </p>
  )
}

/** A link of the head a finger can press on a tablet and a phone: 44 pixels tall and wide there, its line kept as it was. */
const CRUMB_LINK =
  'rounded-sm font-medium text-ink underline decoration-ink/40 underline-offset-3 outline-none hover:decoration-ink focus-visible:ring-3 focus-visible:ring-focus max-lg:-my-2.5 max-lg:inline-flex max-lg:min-h-11 max-lg:min-w-11 max-lg:items-center'

export function NewsletterHead({ month, state, saved, bigger = false, onSeeEmail, sheetOpen = false, phone = false, seeRef, onHelp, helpOpen = false, helpRef }: NewsletterHeadProps) {
  return (
    <div className={cn('border-b border-border bg-background', bigger && 'flex-none px-5 py-2')}>
      {/*
        Help and Admin sections keep the top right however long the saved line's words run beside the title. While the
        letter fills the window this is its top, held to the letter's width.
      */}
      <div
        className={
          bigger
            ? 'mx-auto flex min-h-[52px] w-full max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-1'
            : 'mx-auto grid max-w-[1198px] items-start gap-x-5 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6'
        }
      >
        <div className={cn('min-w-0', bigger && 'flex-1')}>
          {!bigger && (
            <nav aria-label="Breadcrumb">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link to="/admin" className={CRUMB_LINK}>
                  Admin
                </Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page" className="font-semibold text-ink">Newsletter</span>
              </p>
            </nav>
          )}
          <div className={bigger ? 'flex flex-wrap items-center gap-x-4 gap-y-1' : 'mt-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1'}>
            {!bigger && <h1 className="text-[30px] font-bold leading-tight tracking-[-0.015em] text-ink max-md:text-[26px]">Newsletter</h1>}
            {month !== undefined && state !== undefined && <MonthState month={month} state={state} className={bigger ? undefined : 'max-md:basis-full'} />}
            {saved && <SavedLine {...saved} className={bigger ? undefined : '-ml-1 max-md:ml-0 max-md:basis-full'} />}
          </div>
        </div>
        {bigger ? (
          onSeeEmail && (
            <button ref={seeRef} type="button" aria-haspopup="dialog" aria-expanded={sheetOpen} className={QUIET_BUTTON} onClick={(event) => onSeeEmail(event.currentTarget)}>
              <Eye className="size-4" aria-hidden="true" />
              Show the email
            </button>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 sm:mt-2.5">
            {onHelp && (
              <button
                ref={helpRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={helpOpen}
                onClick={onHelp}
                className={HELP_BUTTON}
              >
                <span aria-hidden="true" className={HELP_TINT} />
                <CircleHelp className="size-4" aria-hidden="true" />
                <span className="max-lg:sr-only">Help</span>
              </button>
            )}
            <Link to="/admin" className={cn(SOFT, 'max-lg:hidden')}>
              <Menu className="size-4" aria-hidden="true" />
              Admin sections
            </Link>
            {onSeeEmail && !phone && (
              <button
                ref={seeRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={(event) => onSeeEmail(event.currentTarget)}
                className="inline-flex min-h-[50px] items-center gap-2 rounded-lg bg-brand-navy px-5 text-base font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus lg:hidden"
              >
                <Eye className="size-[18px]" aria-hidden="true" />
                See the email
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
