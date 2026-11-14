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
// words. The quiet states are read out politely and a refusal at once, every
// sentence of it in the one region, what follows it and a read of their
// letter that failed among them, and neither takes the focus from where the
// person is.
//
// Help is drawn as the board draws it, and is not yet available: its
// walkthrough comes with WS16 part two, page step 5. So it is a button a
// keyboard does not stop on, marked as unavailable, and it says so to a
// screen reader.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Check, CircleAlert, CircleHelp, Menu } from 'lucide-react'
import { zonedParts } from '@domain/format/date'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
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

/** What follows a 409's words: that nothing more is saved, that the person's words stay, and a read that failed. */
function afterConflict(line: Extract<SaveLine, { kind: 'conflict' }>): string {
  const kept = line.reason === 'sent' ? 'Nothing more is saved to it.' : 'Nothing more is saved over their letter.'
  const words = `${kept} Your words stay here for you to copy.`
  return line.readFailed ? `${words} Their letter could not be read. Press "Show their letter" to try again.` : words
}

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
    case 'refused':
      return { quiet: '', urgent: line.words, after: '' }
    case 'conflict':
      return { quiet: '', urgent: `${conflictWords(line)}.`, after: afterConflict(line) }
    default:
      return { quiet: '', urgent: '', after: '' }
  }
}

/** A soft button of the head, 44px tall. */
const SOFT = 'inline-flex min-h-11 items-center gap-2 rounded-lg bg-ink/8 px-3.5 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus'

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
 * sentence of a refusal, so a sentence added to it, as when their letter could not be read, is read out too.
 */
export function SavedLine({ line, onTryAgain, onShowTheirs, className }: SavedLineProps) {
  const [asking, setAsking] = useState(false)
  const { quiet, urgent, after } = wordsOf(line)
  const conflict = line.kind === 'conflict' ? line : null
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
        </span>
      </span>
      {line.kind === 'failed' && (
        <button type="button" className={LINE_BUTTON} onClick={onTryAgain}>
          Try again
        </button>
      )}
      {conflict && conflict.reason !== 'sent' && (
        <DialogPrimitive.Root open={asking} onOpenChange={setAsking}>
          <DialogPrimitive.Trigger className={LINE_BUTTON}>Show their letter</DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-brand-navy/55" />
            <DialogPrimitive.Content
              className="fixed left-1/2 top-1/2 z-[80] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-background p-5 text-ink shadow-xl outline-none"
            >
              <DialogPrimitive.Title className="text-lg font-bold">Show their letter?</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-2 text-[15px] text-ink">
                Their letter takes the place of your words on this page. Copy anything of yours you want to keep first.
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
                  Show their letter
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
  /** The saved line, or nothing to draw it in the head (while the letter fills the window, its own top shows it). */
  saved?: SavedLineProps
}

/** The month with the letter's state in a word: "Draft" for an open letter, "Not saved yet" for a letter with no row yet. */
export function MonthState({ month, state }: { month: string; state: 'none' | 'draft' }) {
  const word = state === 'draft' ? 'Draft' : 'Not saved yet'
  return (
    <span className="text-[15px] text-muted-foreground">
      {month !== '' && <b className="font-semibold text-ink">{month}</b>}
      {month !== '' && ' · '}
      {word}
    </span>
  )
}

export function NewsletterHead({ month, state, saved }: NewsletterHeadProps) {
  return (
    <div className="border-b border-border bg-background">
      {/* Help and Admin sections keep the top right however long the saved line's words run beside the title. */}
      <div className="mx-auto grid max-w-[1198px] items-start gap-x-5 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/admin" className="rounded-sm font-medium text-ink underline decoration-ink/40 underline-offset-3 outline-none hover:decoration-ink focus-visible:ring-3 focus-visible:ring-focus">
                Admin
              </Link>
              <span aria-hidden="true">/</span>
              <span aria-current="page" className="font-semibold text-ink">Newsletter</span>
            </p>
          </nav>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-[18px] gap-y-1">
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.015em] text-ink">Newsletter</h1>
            {month !== undefined && state !== undefined && <MonthState month={month} state={state} />}
            {saved && <SavedLine {...saved} className="-ml-1" />}
          </div>
        </div>
        <div className="flex items-center gap-2.5 sm:mt-2.5">
          <button type="button" disabled className={cn(SOFT, 'disabled:opacity-60')}>
            <CircleHelp className="size-4" aria-hidden="true" />
            Help<span className="sr-only">, not yet available</span>
          </button>
          <Link to="/admin" className={SOFT}>
            <Menu className="size-4" aria-hidden="true" />
            Admin sections
          </Link>
        </div>
      </div>
    </div>
  )
}
