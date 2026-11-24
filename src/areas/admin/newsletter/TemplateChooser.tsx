// src/areas/admin/newsletter/TemplateChooser.tsx
//
// The chooser of templates and past newsletters on the newsletter's own page
// (board Newsletter-Page-4, P12, its figure "After pressing Pick a template
// to start from"; K's decisions 26, 27, 40 and 47), WS16 part two, page step
// 5, second part, and the question before a letter that holds words is
// replaced.
//
// The chooser, a dialog named by its head, "Pick a template to start from",
// with a Close button:
// - "Blank letter", first, with the board's line under its name;
// - "Pinned templates": LCA's three starters, in the order of STARTER_IDS
//   (domain/mail/letter.ts), each with the board's line, then the templates
//   writers saved, newest first, shared by everyone who may open the page and
//   read each time the chooser opens, each with "Saved <day> by <first name>";
//   a read that fails says so, with Try again; under them "Save this letter as
//   a template", which opens a name field in place (each past newsletter has
//   its own "Save as a template" too, its field under its row; one at a time);
//   after a save the focus goes to the new template's "Use this", and Cancel
//   gives it back to the button that opened the field; each saved template
//   has Rename, which opens the same field under its row holding its name, and
//   sends the new name by the version read (a change by someone else meanwhile
//   is said with who and when, and the list is read again), and Remove, which
//   asks "Remove this template?" first (Keep it holds the focus), then takes it
//   out of the list by the version read, the focus going to the next saved
//   template, or to the group's head when it was the last;
// - "Your last newsletters": the letters sent or set aside and the
//   newsletters sent from the plain tab, at most 20, newest first, read from
//   GET /api/admin/mail/newsletter/issues each time the chooser opens and
//   never as the page opens; each with its month, or a plain send's subject,
//   its state in words and its day with a weekday, in the site's own time, as
//   the site writes every date, and for a letter set aside, a send on its way
//   and one that failed the time of day as well, so two of one month and one
//   day are told apart. While they are read, the group says so, and the blank
//   letter and the starters can be used meanwhile; a read that fails says so,
//   with Try again; with none, the group says so. The letter open now is
//   never among them: it is the one the page holds. A letter set aside with a
//   subject of its own gives that subject back to the new letter started from
//   it for the same month (useIssue's start), since the server's start copies
//   a past letter's body alone.
// Each choice has "Use this", named for its choice ("Use this: Monthly
// newsletter"), a past row's with its line, and with its place among them
// where two rows still read alike, and the board's small drawing of it,
// hidden from a screen reader. The board's two lines under the chooser
// explain a control, so they are Help's (K's decision 40); the board's two
// tournament templates are the tournament send-outs'.
//
// From 768 pixels up, where it fits, it opens upward from the first step,
// over the page's foot, as More options does: its foot just above the step,
// its height held under the site's header in rem, so it follows a person's
// own text size, scrolling inside itself. Under 768 pixels, and on a window
// too short for it there, it is a sheet from the window's foot, as the
// email's sheet is, its top held under the header the same way. As the
// window crosses 768 pixels while it is open it stays open in the other form,
// the focus where it was inside it. It takes the focus itself as it opens, as
// the email's sheet does, so a screen reader says its name, and Tab goes from
// Close through each "Use this" and round; Escape, Close and a press outside
// it close it and give the focus back to the first step, whichever of the
// two is then drawn. While it is open the site's root is inert, as the
// email's sheet makes it, and hidden from a screen reader, so the page behind
// it cannot be reached by Tab, a press or a screen reader. While the letter
// is checked or the words on the page saved first, and while a letter is
// being started, it says so in words, takes no second press, and does not
// close; a start that did not happen is said inside it, since it hides the
// page and its saved line.
//
// The question, "Replace this letter?", is an alert dialog over the chooser:
// it takes the focus on "Keep writing"; Escape keeps writing too, and the
// focus goes back to the "Use this" that was pressed; nothing is started until
// the person chooses "Replace it". The board draws no such question, so its
// words are the page half's plan's.

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { STARTERS, STARTER_IDS, TEMPLATE_NAME_MAX, defaultSubject, templateNameAsStored, type StarterId } from '@domain/mail/letter'
import { getLastNewsletters, getNewsletterTemplates, removeNewsletterTemplate, renameNewsletterTemplate, saveNewsletterTemplate, type ApiLastNewsletter, type ApiNewsletterTemplate } from '@/lib/api'
import { ApiError } from '@/lib/http'
import { formatDate, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { StartFrom, SubjectBack } from './useIssue'

/** A choice the chooser offers: where the new letter's words come from, its name, and what the saved line says it came from. */
export interface Choice {
  from: StartFrom
  /** The name a screen reader hears on its "Use this", before its place among rows that read alike. */
  name: string
  /** The saved line's words once the letter is started: "Started from Monthly newsletter". */
  startedFrom: string
  /** A letter set aside with a subject of its own: that subject and its month, which the new letter takes back for that month. */
  subjectBack?: SubjectBack
}

/** What the chooser is doing for the page: checking the letter the server holds, saving the words on the page first, or starting the letter. */
export type ChooserBusy = 'checking' | 'saving' | 'starting' | null

export interface TemplateChooserProps {
  open: boolean
  /** Closes it; the page keeps it open while a letter is being started. */
  onClose: () => void
  /** Under 768 pixels: the sheet from the window's foot. */
  phone: boolean
  /** The first step, which the chooser opens upward from and gives the focus back to: the one drawn now. */
  opener: () => HTMLElement | null
  /** A "Use this" pressed: the page saves the words on the page, asks when they would be replaced, and starts. */
  onUse: (choice: Choice) => void
  busy: ChooserBusy
  /** The page's own words for a start that did not happen, '' for none. */
  said: string
  /** The saved line's refusals that come while the chooser hides the page (SavedLineNotice). */
  notice?: ReactNode
  /** The choice the question before a letter that holds words is replaced asks about, or null while it is not asked. */
  asking: Choice | null
  /** The question's answer: true to replace the letter, false to keep writing. */
  onAnswer: (replace: boolean) => void
  /** The letter's body on the page now, which "Save this letter as a template" sends as it is; the server cleans it. */
  letterBody: string
  /** Whether the letter on the page holds any words: one with none cannot be saved as a template. */
  letterHasWords: boolean
}

/** What a rename or remove says when the template was removed by someone else after the list was read. */
const TEMPLATE_GONE = 'Someone removed this template after you opened the list, so nothing was changed.'

/** The server answers 404 for a template no longer in the list (the page itself is open, or the chooser would not be). */
function removedMeanwhile(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

/** The element the site is drawn in (index.html, src/main.tsx), as the email's sheet names it: the page behind the chooser. */
const SITE_ROOT_ID = 'root'

/** The lines under the starters' names, word for word as the board draws them: a part of each choice's own name. */
const STARTER_LINES: Record<StarterId, string> = {
  blank: 'Just the month\'s band and an empty page.',
  monthly: 'The usual six headings',
  'results-and-thanks': 'After a tournament weekend',
  'short-notice': 'A few lines, no sections',
}

/** The board's small drawing of each choice (.cx-mini), piece by piece: the band, a heading, a line, a short last line. */
type Piece = 'band' | 'heading' | 'line' | 'short' | 'first'
const DRAWINGS: Record<StarterId | 'past', readonly Piece[]> = {
  blank: ['band'],
  monthly: ['band', 'heading', 'line', 'heading', 'line', 'heading', 'short'],
  'results-and-thanks': ['band', 'heading', 'line', 'line', 'line', 'short'],
  'short-notice': ['first', 'line', 'short'],
  past: ['band', 'heading', 'line', 'heading', 'line', 'short'],
}
const PIECE: Record<Piece, string> = {
  band: '-mx-[5px] mb-[5px] block h-[11px] bg-brand-navy',
  heading: 'mb-[3px] mt-1 block h-[3px] w-3/5 rounded-[1px] bg-gold-ink',
  line: 'mb-[3px] block h-[2px] rounded-[1px] bg-muted-foreground/40',
  short: 'mb-[3px] block h-[2px] w-[70%] rounded-[1px] bg-muted-foreground/40',
  first: 'mb-[3px] mt-2 block h-[2px] rounded-[1px] bg-muted-foreground/40',
}

/**
 * The board's own marks for the chooser, drawn as its markup draws them, hidden from a screen reader: the pin over
 * "Pinned templates", the clock over "Your last newsletters" and Close's cross. Drawn here rather than taken from the
 * site's icon set, whose pin the site's build keeps in a chunk the news pages share, so nothing outside the page's own
 * chunk moves for them.
 */
const MARKS = {
  pin: <path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
} as const

function Mark({ name, className }: { name: keyof typeof MARKS; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={cn('flex-none', className)}>
      {MARKS[name]}
    </svg>
  )
}

function Drawing({ pieces }: { pieces: readonly Piece[] }) {
  return (
    <span aria-hidden="true" className="block h-[54px] w-[42px] flex-none overflow-hidden rounded border border-border bg-background px-[5px]">
      {/* Through cn(), as the site's colour rules ask of a lookup whose entries set rival colours. */}
      {pieces.map((piece, at) => (
        <span key={at} className={cn(PIECE[piece])} />
      ))}
    </span>
  )
}

/** "Use this", the board's: 44 pixels tall, where the board's is 42, so a finger can press it. */
const USE_BUTTON =
  'inline-flex min-h-11 flex-none items-center whitespace-nowrap rounded-lg border border-ink bg-background px-[11px] text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus aria-disabled:cursor-default'

/** A group's head, the board's .cx-gh, 14 pixels below the choices before it as the board's chooser column draws it. */
const GROUP_HEAD = 'mb-2 mt-3.5 flex items-center gap-[7px] text-[12.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground'

/** A group's choices, 6 pixels apart as the board's chooser column draws them. */
const CHOICES = 'grid gap-1.5'

const count = (n: number) => n.toLocaleString('en-US')

/** A past newsletter's name: its month, or a send from the plain tab, which has none, by its subject. */
function pastName(row: ApiLastNewsletter): string {
  return row.monthLabel !== '' ? row.monthLabel : row.subject
}

/**
 * A past newsletter's state in words with its day, by the site's own date words, a weekday on each, in the site's own
 * time: "Sent Mon, Nov 16, 2026 to 155 members", the board's words, with who sent it where the answer names them. A
 * letter set aside, a send on its way and one that failed say the time of day as well, "Set aside by Player One on Mon,
 * Nov 16, 2026 at 2:15 PM", since one person can set aside two letters of one month on one day.
 */
function pastLine(row: ApiLastNewsletter): string {
  const day = formatDate(row.at, { stored: 'utc', year: true })
  const when = `${day} at ${formatTime(row.at, { stored: 'utc' })}`
  const by = row.by
  switch (row.state) {
    case 'completed': {
      const to = row.totalRecipients === null ? '' : ` to ${count(row.totalRecipients)} ${row.totalRecipients === 1 ? 'member' : 'members'}`
      return by ? `Sent by ${by} on ${day}${to}` : `Sent ${day}${to}`
    }
    case 'sending':
      return by ? `Being sent by ${by} since ${when}` : `Being sent since ${when}`
    case 'failed':
      return by ? `Not sent: the send by ${by} failed on ${when}` : `Not sent: the send failed on ${when}`
    case 'set_aside':
      return by ? `Set aside by ${by} on ${when}` : `Replaced by a newer letter on ${when}`
  }
}

/**
 * A past newsletter as a choice: a letter by its id, a send from the plain tab by its send's. A letter set aside keeps
 * its own subject on the server, which the server's start does not copy, so a subject other than its month's own goes
 * with the choice, for the new letter to take back when it is started for that month.
 */
function pastChoice(row: ApiLastNewsletter): Choice | null {
  const from = row.issueId !== null ? { issueId: row.issueId } : row.campaignId !== null ? { campaignId: row.campaignId } : null
  if (!from) return null
  const name = pastName(row)
  const line = pastLine(row)
  const choice: Choice = { from, name: `${name}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`, startedFrom: name }
  if (row.state === 'set_aside' && row.issueId !== null && row.subject.trim() !== '' && row.subject.trim() !== defaultSubject(row.monthLabel)) {
    choice.subjectBack = { monthLabel: row.monthLabel, subject: row.subject.trim() }
  }
  return choice
}

/** A place as it is said: "1st", "2nd", "3rd", "4th", "11th", "22nd". */
function nth(n: number): string {
  const tens = n % 100
  const end = tens >= 11 && tens <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${end}`
}

/**
 * The name of each past row's "Use this": its choice's, and where two rows still read alike, as two letters set aside by
 * one person in one minute, its place among those alike, newest first as the server lists them, "Use this: December
 * 2026, set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM, the 2nd of 2 with this name", so a screen reader can
 * tell each from the others. A row with no choice has no name.
 */
function pastLabels(choices: ReadonlyArray<Choice | null>): string[] {
  const alike = new Map<string, number>()
  for (const it of choices) if (it) alike.set(it.name, (alike.get(it.name) ?? 0) + 1)
  const seen = new Map<string, number>()
  return choices.map((it) => {
    if (!it) return ''
    const of = alike.get(it.name) ?? 1
    if (of === 1) return `Use this: ${it.name}`
    const at = (seen.get(it.name) ?? 0) + 1
    seen.set(it.name, at)
    return `Use this: ${it.name}, the ${nth(at)} of ${of} with this name`
  })
}

/** A saved template's line: the day it was saved, a weekday on it, in the site's own time, and who saved it where the answer names them. */
function savedLine(template: ApiNewsletterTemplate): string {
  const day = formatDate(template.savedAt, { stored: 'utc', year: true })
  return template.by ? `Saved ${day} by ${template.by}` : `Saved ${day}`
}

/** A saved template as a choice, named with its line, as a past newsletter's is, since its name may match a starter's. */
function savedChoice(template: ApiNewsletterTemplate): Choice {
  const line = savedLine(template)
  return { from: { templateId: template.id }, name: `${template.name}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`, startedFrom: template.name }
}

/** A starter as a choice; the saved line calls the blank letter "a blank letter". */
function starterChoice(id: StarterId): Choice {
  const name = STARTERS[id].name
  return { from: id, name, startedFrom: id === 'blank' ? 'a blank letter' : name }
}

/** Whether a key is Shift and Tab alone, the key that moves the focus back a stop. */
function isShiftTab(event: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.key === 'Tab' && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
}

export function TemplateChooser({ open, onClose, phone, opener, onUse, busy, said, notice, asking, onAnswer, letterBody, letterHasWords }: TemplateChooserProps) {
  const box = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  // While it is open the site's root is inert, as the email's sheet makes it, so nothing behind it can take the focus or
  // a press; let go as it closes, in the same moment, so the first step can take the focus back. A root made inert by
  // something else is left as it is.
  useLayoutEffect(() => {
    if (!open) return
    const root = document.getElementById(SITE_ROOT_ID)
    if (!root || root.hasAttribute('inert')) return
    root.setAttribute('inert', '')
    return () => root.removeAttribute('inert')
  }, [open])
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          ref={scrim}
          data-slot="chooser-scrim"
          className="fixed inset-0 z-[80] data-[form=sheet]:bg-brand-navy/55"
          // No press outside it moves the focus: it closes on a main press there and gives the focus to the first step.
          onMouseDown={(event) => event.preventDefault()}
        />
        <DialogPrimitive.Content
          ref={box}
          aria-modal="true"
          aria-describedby={undefined}
          data-slot="template-chooser"
          onOpenAutoFocus={(event) => {
            // The chooser itself takes the focus, as the email's sheet does, so a screen reader says its name first.
            event.preventDefault()
            box.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const to = opener()
            if (to?.isConnected) to.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (busy !== null) event.preventDefault()
          }}
          onPointerDownOutside={(event) => {
            if (busy !== null) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (busy !== null) event.preventDefault()
          }}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            // Shift and Tab from the chooser itself, as it opens, goes round to its last control, as from its first.
            if (!isShiftTab(event) || event.target !== event.currentTarget) return
            const stops = event.currentTarget.querySelectorAll<HTMLElement>('button')
            const last = stops[stops.length - 1]
            if (!last) return
            event.preventDefault()
            last.focus()
          }}
          onFocus={(event) => {
            // Tab going round from its last control to its first, or back, gives the focus without the browser's scroll,
            // so where the chooser scrolls as a whole the control is brought into view here, nearest. The question, drawn
            // in a layer of its own, brings its own controls into view.
            const target = event.target
            if (target !== event.currentTarget && event.currentTarget.contains(target)) target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
          }}
          className={cn(
            // Its list scrolls inside it; where its head and the least of its list are taller than the window leaves it
            // room for, as on a short window at a large text size with a refusal said, it scrolls as a whole instead, so
            // nothing in it is ever cut off.
            'group/chooser fixed z-[80] flex flex-col overflow-y-auto overscroll-contain bg-background text-ink outline-none',
            // From 768 pixels up, where it fits: a box over the page's foot, opened upward from the first step.
            'data-[form=box]:w-[min(29.25rem,calc(100vw-2rem))] data-[form=box]:rounded-[14px] data-[form=box]:border data-[form=box]:border-border data-[form=box]:shadow-[0_18px_40px_rgba(16,24,43,0.14)]',
            // Under 768 pixels, and where the box would not fit: a sheet from the window's foot, as the email's sheet is.
            'data-[form=sheet]:inset-x-0 data-[form=sheet]:bottom-0 data-[form=sheet]:mx-auto data-[form=sheet]:max-h-[calc(100dvh-var(--header-h,4rem)-0.75rem)] data-[form=sheet]:max-w-[36rem] data-[form=sheet]:rounded-t-[18px] data-[form=sheet]:shadow-[0_-10px_30px_rgba(16,24,43,0.25)]',
          )}
        >
          <ChooserInside
            box={box}
            scrim={scrim}
            phone={phone}
            opener={opener}
            onClose={onClose}
            onUse={onUse}
            busy={busy}
            said={said}
            notice={notice}
            asking={asking}
            onAnswer={onAnswer}
            letterBody={letterBody}
            letterHasWords={letterHasWords}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The least room above the first step the box takes, in rem; with less, the chooser is the sheet from the foot. */
const BOX_LEAST_REM = 20

/**
 * Where the chooser stands: from 768 pixels up, its foot half a rem above the first step and its left edge at the
 * step's, kept a rem inside the window, its height held three quarters of a rem under the site's header, when that
 * leaves it BOX_LEAST_REM; else the sheet from the window's foot. Read from the step as it is drawn, as the chooser
 * opens, as the window changes, and as it crosses 768 pixels. A control inside it that holds the focus as its form
 * changes is brought into view inside it, where a second focus would do nothing.
 */
function place(box: HTMLElement, scrim: HTMLElement | null, step: HTMLElement | null, phone: boolean) {
  const root = document.documentElement
  const rem = Number.parseFloat(getComputedStyle(root).fontSize) || 16
  const header = Number.parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 4 * rem
  const rect = step?.getBoundingClientRect()
  const foot = rect ? rect.top - 0.5 * rem : 0
  const fits = !phone && !!rect && rect.height > 0 && foot - header - 0.75 * rem >= BOX_LEAST_REM * rem
  const form = fits ? 'box' : 'sheet'
  const was = box.dataset.form
  box.dataset.form = form
  if (scrim) scrim.dataset.form = form
  if (!fits || !rect) {
    for (const side of ['left', 'bottom', 'max-height']) box.style.removeProperty(side)
  } else {
    const bottom = window.innerHeight - foot
    box.style.setProperty('bottom', `${bottom}px`)
    box.style.setProperty('max-height', `calc(100dvh - ${bottom}px - var(--header-h, 4rem) - 0.75rem)`)
    const left = Math.min(rect.left, window.innerWidth - box.offsetWidth - rem)
    box.style.setProperty('left', `${Math.max(rem, left)}px`)
  }
  const active = box.ownerDocument.activeElement
  if (was !== undefined && was !== form && active instanceof HTMLElement && active !== box && box.contains(active)) {
    active.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }
}

/** What "Your last newsletters" holds: being read, the rows, or a read that failed. */
type Rows = { state: 'reading' } | { state: 'failed' } | { state: 'ready'; issues: ApiLastNewsletter[] }

/** The saved templates under the starters: being read, the templates, or a read that failed. */
type Saved = { state: 'reading' } | { state: 'failed' } | { state: 'ready'; templates: ApiNewsletterTemplate[] }

interface ChooserInsideProps extends Omit<TemplateChooserProps, 'open'> {
  box: RefObject<HTMLDivElement | null>
  scrim: RefObject<HTMLDivElement | null>
}

/** The chooser's head and choices, drawn afresh each time it opens, so its last newsletters are read each time. */
function ChooserInside({ box, scrim, phone, opener, onClose, onUse, busy, said, notice, asking, onAnswer, letterBody, letterHasWords }: ChooserInsideProps) {
  const [rows, setRows] = useState<Rows>({ state: 'reading' })
  const [attempt, setAttempt] = useState(0)
  const [saved, setSaved] = useState<Saved>({ state: 'reading' })
  const [savedAttempt, setSavedAttempt] = useState(0)
  /**
   * A save as a template: its name field shown, for the letter on the page, for one past newsletter by its place among
   * them, or for a new name of one saved template by its id, the name typed, the refusal said, and a save on its way.
   * One name field is shown at a time.
   */
  const [naming, setNaming] = useState<null | 'letter' | number | { rename: string }>(null)
  const [name, setName] = useState('')
  const [nameWords, setNameWords] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  /** The saved template "Remove this template?" asks about, and what a remove that did not happen says under the group. */
  const [removing, setRemoving] = useState<ApiNewsletterTemplate | null>(null)
  const [savedWords, setSavedWords] = useState('')
  const [removingNow, setRemovingNow] = useState(false)
  /** The Remove pressed, which the question gives the focus back to unless the template went. */
  const removeBack = useRef<HTMLButtonElement | null>(null)
  /** The template just saved or renamed, or the one after a template removed, whose "Use this" takes the focus once the list is read again. */
  const justSaved = useRef<string | null>(null)
  const saveOpener = useRef<HTMLButtonElement>(null)
  /** Where Cancel gives the focus back: "Save this letter as a template", or a row's "Save as a template" or "Rename" by its name. */
  const backToOpener = useRef<null | 'letter' | string>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const ids = useId()
  /**
   * The "Use this" whose press was last taken, which the question gives the focus back to; one pressed while the chooser
   * is busy or the question is open takes nothing, so it is not this.
   */
  const pressed = useRef<HTMLButtonElement | null>(null)
  const pastHead = useRef<HTMLHeadingElement>(null)
  const pinnedHead = useRef<HTMLHeadingElement>(null)
  /** The chooser's first part, whose parent is the chooser itself: its ref is set before this part's layout effect runs. */
  const first = useRef<HTMLDivElement>(null)
  /** The chooser's head, whose words grow as it says what it is doing or why a start did not happen. */
  const head = useRef<HTMLDivElement>(null)
  /** The choices, which scroll inside the chooser. */
  const list = useRef<HTMLDivElement>(null)

  // A control that holds the focus is kept in view as the chooser's parts change size: words said in its head push the
  // choices down, and a shorter window shortens them, so the "Use this" pressed could otherwise stand out of view while
  // it keeps the focus. Brought into view as a control of the bar is, nearest, which moves nothing when it is in view.
  useEffect(() => {
    const element = box.current ?? first.current?.parentElement
    if (!element || typeof ResizeObserver === 'undefined') return
    const keep = () => {
      const active = element.ownerDocument.activeElement
      if (active instanceof HTMLElement && active !== element && element.contains(active)) active.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
    const watch = new ResizeObserver(keep)
    for (const part of [element, head.current, list.current]) if (part) watch.observe(part)
    return () => watch.disconnect()
  }, [box])

  useLayoutEffect(() => {
    const element = box.current ?? first.current?.parentElement
    if (!element) return
    const again = () => place(element, scrim.current ?? document.querySelector<HTMLElement>('[data-slot="chooser-scrim"]'), opener(), phone)
    again()
    window.addEventListener('resize', again)
    return () => window.removeEventListener('resize', again)
  }, [box, scrim, opener, phone])

  useEffect(() => {
    let gone = false
    getLastNewsletters().then(
      ({ issues }) => {
        if (!gone) setRows({ state: 'ready', issues })
      },
      () => {
        if (!gone) setRows({ state: 'failed' })
      },
    )
    return () => {
      gone = true
    }
  }, [attempt])

  // The saved templates are shared by everyone who may open the page, so they are read each time the chooser opens too.
  useEffect(() => {
    let gone = false
    getNewsletterTemplates().then(
      ({ templates }) => {
        if (!gone) setSaved({ state: 'ready', templates })
      },
      () => {
        if (!gone) setSaved({ state: 'failed' })
      },
    )
    return () => {
      gone = true
    }
  }, [savedAttempt])

  // Once the list is read again after a save, the new template's "Use this" takes the focus.
  useEffect(() => {
    const id = justSaved.current
    if (id === null || saved.state !== 'ready') return
    justSaved.current = null
    // No such template (the last one removed has no next): the focus goes to the group's head.
    const template = saved.templates.find((t) => t.id === id)
    const label = template ? `Use this: ${savedChoice(template).name}` : null
    const button = label === null ? undefined : Array.from(list.current?.querySelectorAll('button') ?? []).find((b) => b.getAttribute('aria-label') === label)
    ;(button ?? pinnedHead.current)?.focus()
  }, [saved])

  // The name field takes the focus as it is shown; Cancel gives it back to the button that opened it.
  useEffect(() => {
    if (naming !== null) nameField.current?.focus()
    else if (backToOpener.current !== null) {
      const back = backToOpener.current
      backToOpener.current = null
      if (back === 'letter') saveOpener.current?.focus()
      else Array.from(list.current?.querySelectorAll('button') ?? []).find((b) => b.getAttribute('aria-label') === back)?.focus()
    }
  }, [naming])

  function stopNaming() {
    setNaming(null)
    setName('')
    setNameWords('')
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault()
    if (savingTemplate) return
    const trimmedName = name.trim()
    if (trimmedName === '') {
      setNameWords('Write a name for the template.')
      nameField.current?.focus()
      return
    }
    // Counted in characters, as the server counts them: the field has no maxLength, which counts an emoji as two, and
    // the name is cleaned first by the function the server's own rule uses.
    if (Array.from(templateNameAsStored(trimmedName)).length > TEMPLATE_NAME_MAX) {
      setNameWords(`Keep the template's name to ${TEMPLATE_NAME_MAX} characters.`)
      nameField.current?.focus()
      return
    }
    if (naming !== null && typeof naming === 'object') {
      await renameTemplate(naming.rename, trimmedName)
      return
    }
    // A past newsletter is sent by its letter's id, or a send from the plain tab by its send's, as its "Use this" is.
    const row = typeof naming === 'number' && rows.state === 'ready' ? rows.issues[naming] : undefined
    const from = row ? (row.issueId !== null ? { issueId: row.issueId } : row.campaignId !== null ? { campaignId: row.campaignId } : null) : null
    if (naming !== 'letter' && from === null) return
    setSavingTemplate(true)
    try {
      const template = await saveNewsletterTemplate(from !== null ? { name: trimmedName, from } : { name: trimmedName, bodyHtml: letterBody })
      justSaved.current = template.id
      stopNaming()
      // The field goes as the list is read again, so the focus waits on the group's head until the new template is drawn.
      pinnedHead.current?.focus()
      setSavedAttempt((at) => at + 1)
    } catch (error) {
      setNameWords(error instanceof ApiError && error.message !== '' ? error.message : 'The template could not be saved. Try again.')
      nameField.current?.focus()
      // Someone else may have saved the name meanwhile, or this save may have reached the server before its answer was
      // lost, so the list is read again and shows what is really saved. The name field stands outside it and stays.
      setSavedAttempt((at) => at + 1)
    } finally {
      setSavingTemplate(false)
    }
  }

  /**
   * A new name for a saved template, by the version read. A change by someone else meanwhile is said with who and when,
   * and the list is read again, so the next try is made on the template as it now stands.
   */
  async function renameTemplate(id: string, newName: string) {
    const template = saved.state === 'ready' ? saved.templates.find((t) => t.id === id) : undefined
    if (!template) return
    setSavingTemplate(true)
    try {
      const answer = await renameNewsletterTemplate({ id, version: template.version, name: newName })
      if ('changed' in answer) {
        const { error, changedBy, changedAt } = answer.changed
        const when = `${formatDate(changedAt, { stored: 'utc', year: true })} at ${formatTime(changedAt, { stored: 'utc' })}`
        setNameWords(`${error} ${changedBy ? `${changedBy} changed it` : 'It was changed'} ${when}.`)
        nameField.current?.focus()
        setSavedAttempt((at) => at + 1)
        return
      }
      justSaved.current = answer.saved.id
      stopNaming()
      pinnedHead.current?.focus()
      setSavedAttempt((at) => at + 1)
    } catch (error) {
      if (removedMeanwhile(error)) {
        // Its row and this field go as the list is read again, so the words are said under the group and the focus waits on its head.
        backToOpener.current = null
        stopNaming()
        setSavedWords(TEMPLATE_GONE)
        justSaved.current = ''
        pinnedHead.current?.focus()
        setSavedAttempt((at) => at + 1)
        return
      }
      setNameWords(error instanceof ApiError && error.message !== '' ? error.message : 'The template could not be renamed. Try again.')
      nameField.current?.focus()
    } finally {
      setSavingTemplate(false)
    }
  }

  /** The answer to "Remove this template?": Keep it closes it; Remove it takes it out of the list by the version read. */
  async function answerRemove(remove: boolean) {
    const template = removing
    if (removingNow) return
    if (!remove || !template) {
      setRemoving(null)
      return
    }
    setRemovingNow(true)
    try {
      const answer = await removeNewsletterTemplate({ id: template.id, version: template.version })
      if ('changed' in answer) {
        const { error, changedBy, changedAt } = answer.changed
        const when = `${formatDate(changedAt, { stored: 'utc', year: true })} at ${formatTime(changedAt, { stored: 'utc' })}`
        setSavedWords(`${error} ${changedBy ? `${changedBy} changed it` : 'It was changed'} ${when}.`)
      } else {
        // Its row goes, so the focus goes to the next saved template, or to the group's head when it was the last.
        const list = saved.state === 'ready' ? saved.templates : []
        justSaved.current = list[list.findIndex((t) => t.id === template.id) + 1]?.id ?? ''
        removeBack.current = null
        pinnedHead.current?.focus()
        // Said once in the group's alert line, since the focus alone does not tell a screen reader it went.
        setSavedWords(`${template.name} is removed.`)
      }
    } catch (error) {
      if (removedMeanwhile(error)) {
        // Its row goes as the list is read again, so the focus goes to the group's head.
        justSaved.current = ''
        removeBack.current = null
        pinnedHead.current?.focus()
      }
      setSavedWords(
        removedMeanwhile(error) ? TEMPLATE_GONE : error instanceof ApiError && error.message !== '' ? error.message : 'The template could not be removed. Try again.',
      )
    }
    setRemovingNow(false)
    setRemoving(null)
    setSavedAttempt((at) => at + 1)
  }

  function use(choice: Choice, button: HTMLButtonElement) {
    if (busy !== null || asking !== null) return
    pressed.current = button
    onUse(choice)
  }

  const working =
    busy === 'checking' ? 'Checking the letter...' : busy === 'saving' ? 'Saving your words first...' : busy === 'starting' ? 'Starting a new letter...' : ''
  const choice = (id: StarterId) => {
    const it = starterChoice(id)
    return (
      <Card
        key={id}
        pieces={DRAWINGS[id]}
        name={it.name}
        line={STARTER_LINES[id]}
        label={`Use this: ${it.name}`}
        busy={busy !== null}
        onUse={(button) => use(it, button)}
      />
    )
  }
  const reading = rows.state === 'reading' ? 'Reading your last newsletters...' : rows.state === 'ready' && rows.issues.length === 0 ? 'None yet.' : ''
  const past = rows.state === 'ready' ? rows.issues.map(pastChoice) : []
  const pastNames = pastLabels(past)
  /** A past row's "Save as a template", named by the row as its "Use this" is. */
  const saveLabel = (at: number) => `Save as a template: ${(pastNames[at] ?? '').replace(/^Use this: /, '')}`
  /** The saved template whose new name the field holds, if it is open for one. */
  const renaming = naming !== null && typeof naming === 'object' && saved.state === 'ready' ? saved.templates.find((t) => t.id === naming.rename) : undefined
  const renameLabel = (template: ApiNewsletterTemplate) => `Rename: ${template.name}`
  // The one name field, under "Save this letter as a template", under the past row it was opened from, or under the saved template it renames.
  const nameForm = (
    <form noValidate onSubmit={(event) => void saveTemplate(event)} className="mt-2 grid gap-1.5">
      <label htmlFor={`${ids}-name`} className="text-[15px] font-semibold text-ink">
        Template name
      </label>
      <input
        ref={nameField}
        id={`${ids}-name`}
        type="text"
        value={name}
        autoComplete="off"
        aria-invalid={nameWords !== '' || undefined}
        aria-describedby={nameWords !== '' ? `${ids}-name-words` : undefined}
        onChange={(event) => {
          setName(event.target.value)
        }}
        className="min-h-11 w-full rounded-lg border border-ink bg-background px-3 text-[15px] text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus aria-invalid:border-2"
      />
      <p id={`${ids}-name-words`} role="alert" className="text-[15px] font-semibold text-ink">
        {nameWords}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" aria-disabled={savingTemplate || undefined} className={USE_BUTTON}>
          {renaming ? 'Save name' : 'Save template'}
        </button>
        <button
          type="button"
          onClick={() => {
            // The field and its buttons go, so the focus goes back to the button that opened them, drawn again.
            backToOpener.current = naming === 'letter' ? 'letter' : typeof naming === 'number' ? saveLabel(naming) : renaming ? renameLabel(renaming) : null
            stopNaming()
          }}
          className="inline-flex min-h-11 items-center rounded-md px-2 text-[15px] font-semibold text-ink underline underline-offset-3 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus"
        >
          Cancel
        </button>
      </div>
    </form>
  )

  return (
    <>
      {/* The sheet's grip, as the email's sheet draws it; a box has none. */}
      <div ref={first} className="hidden flex-none justify-center pb-0.5 pt-2 group-data-[form=sheet]/chooser:flex" aria-hidden="true">
        <span className="block h-[5px] w-10 rounded-full bg-muted-foreground/40" />
      </div>
      <div ref={head} className="flex-none border-b border-border pb-3 pl-[18px] pr-4 pt-4 group-data-[form=sheet]/chooser:pt-1.5">
        <div className="flex items-start justify-between gap-3">
          <DialogPrimitive.Title className="pt-1.5 text-lg font-bold leading-[1.3] tracking-[-0.005em] text-ink">Pick a template to start from</DialogPrimitive.Title>
          <button
            type="button"
            aria-label="Close"
            aria-disabled={busy !== null || undefined}
            onClick={() => {
              if (busy === null) onClose()
            }}
            className="-mr-1 -mt-1 inline-flex size-11 flex-none items-center justify-center rounded-lg border border-border bg-background text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus aria-disabled:cursor-default"
          >
            <Mark name="close" className="size-5" />
          </button>
        </div>
        <p role="status" className={cn('text-[15px] text-ink', working !== '' && 'mt-1.5')}>
          {working}
        </p>
        <p role="alert" className={cn('text-[15px] font-semibold text-ink', said !== '' && 'mt-1.5')}>
          {said}
        </p>
        {notice}
      </div>
      {/* At least 6rem tall, room for one choice, so the one that holds the focus can always be shown. */}
      <div
        ref={list}
        className="min-h-24 flex-1 overflow-y-auto overscroll-contain px-[18px] pb-4 pt-3 [&_button]:scroll-my-3 group-data-[form=sheet]/chooser:pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <ul className={cn(CHOICES, 'mt-1')} aria-label="Blank letter">
          {choice('blank')}
        </ul>
        <h3 ref={pinnedHead} tabIndex={-1} className={cn(GROUP_HEAD, 'outline-none')}>
          <Mark name="pin" className="size-4 text-ink" />
          Pinned templates
        </h3>
        <ul className={CHOICES}>
          {STARTER_IDS.filter((id) => id !== 'blank').map((id) => choice(id))}
          {saved.state === 'ready' &&
            saved.templates.map((template) => {
              const it = savedChoice(template)
              return (
                <Card
                  key={template.id}
                  pieces={DRAWINGS.past}
                  name={template.name}
                  line={savedLine(template)}
                  label={`Use this: ${it.name}`}
                  busy={busy !== null}
                  onUse={(button) => use(it, button)}
                  more={
                    // One group, so the two wrap under the name together rather than Remove alone.
                    <span className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        aria-label={renameLabel(template)}
                        aria-disabled={busy !== null || undefined}
                        onClick={() => {
                          if (busy === null) {
                            setName(template.name)
                            setNameWords('')
                            setSavedWords('')
                            setNaming({ rename: template.id })
                          }
                        }}
                        className={USE_BUTTON}
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove: ${template.name}`}
                        aria-disabled={busy !== null || undefined}
                        onClick={(event) => {
                          if (busy === null) {
                            removeBack.current = event.currentTarget
                            setSavedWords('')
                            setRemoving(template)
                          }
                        }}
                        className={USE_BUTTON}
                      >
                        Remove
                      </button>
                    </span>
                  }
                  below={renaming?.id === template.id ? nameForm : null}
                />
              )
            })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" className="text-[15px] text-ink">
            {saved.state === 'failed' ? 'Saved templates could not be read.' : savedWords}
          </p>
          {saved.state === 'failed' && (
            <button
              type="button"
              onClick={() => {
                // The button goes as the templates are read again, so the focus goes to the group's head, as the last newsletters' does.
                setSaved({ state: 'reading' })
                setSavedAttempt((at) => at + 1)
                pinnedHead.current?.focus()
              }}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-[15px] font-semibold text-ink underline underline-offset-3 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus"
            >
              Try again
            </button>
          )}
        </div>
        {naming === 'letter' ? (
          nameForm
        ) : naming === null ? (
          <div className="mt-2">
            <button
              ref={saveOpener}
              type="button"
              aria-disabled={!letterHasWords || busy !== null || undefined}
              aria-describedby={letterHasWords ? undefined : `${ids}-empty`}
              onClick={() => {
                if (letterHasWords && busy === null) {
                  setSavedWords('')
                  setNaming('letter')
                }
              }}
              className={USE_BUTTON}
            >
              Save this letter as a template
            </button>
            {!letterHasWords && (
              <p id={`${ids}-empty`} className="mt-1 text-[13px] leading-[1.35] text-muted-foreground">
                This letter has no words yet, so it cannot be saved as a template.
              </p>
            )}
          </div>
        ) : null}
        <h3 ref={pastHead} tabIndex={-1} className={cn(GROUP_HEAD, 'outline-none')}>
          <Mark name="clock" className="size-4 text-ink" />
          Your last newsletters
        </h3>
        {/* Both regions stay drawn, empty while they have nothing to say, so each change in them is heard. */}
        <p role="status" className="text-[15px] text-ink">
          {reading}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="alert" className="text-[15px] text-ink">
            {rows.state === 'failed' ? 'Your last newsletters could not be read.' : ''}
          </p>
          {rows.state === 'failed' && (
            <button
              type="button"
              onClick={() => {
                // The button goes as the group is read again, so the focus goes to the group's head, where its words are.
                setRows({ state: 'reading' })
                setAttempt((at) => at + 1)
                pastHead.current?.focus()
              }}
              className="inline-flex min-h-11 items-center rounded-md px-2 text-[15px] font-semibold text-ink underline underline-offset-3 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus"
            >
              Try again
            </button>
          )}
        </div>
        {rows.state === 'ready' && rows.issues.length > 0 && (
          <ul className={CHOICES}>
            {rows.issues.map((row, at) => {
              const it = past[at]
              if (!it) return null
              return (
                <Card
                  key={`${row.issueId ?? ''}-${row.campaignId ?? ''}-${at}`}
                  pieces={DRAWINGS.past}
                  name={pastName(row)}
                  line={pastLine(row)}
                  label={pastNames[at]}
                  busy={busy !== null}
                  onUse={(button) => use(it, button)}
                  more={
                    <button
                      type="button"
                      aria-label={saveLabel(at)}
                      aria-disabled={busy !== null || undefined}
                      onClick={() => {
                        if (busy === null) {
                          setName('')
                          setNameWords('')
                          setSavedWords('')
                          setNaming(at)
                        }
                      }}
                      className={USE_BUTTON}
                    >
                      Save as a template
                    </button>
                  }
                  below={naming === at ? nameForm : null}
                />
              )
            })}
          </ul>
        )}
      </div>
      <ReplaceQuestion asking={asking} onAnswer={onAnswer} returnTo={() => pressed.current} />
      <RemoveQuestion asking={removing} going={removingNow} onAnswer={(remove) => void answerRemove(remove)} returnTo={() => removeBack.current} />
    </>
  )
}

/**
 * "Remove this template?", asked before a saved template leaves the list for everyone, in the form of "Replace this
 * letter?": the focus on "Keep it" as it opens, Escape keeping it, the focus back to the Remove pressed as it closes
 * unless the template went.
 */
function RemoveQuestion({ asking, going, onAnswer, returnTo }: { asking: ApiNewsletterTemplate | null; going: boolean; onAnswer: (remove: boolean) => void; returnTo: () => HTMLElement | null }) {
  const keep = useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Root
      open={asking !== null}
      onOpenChange={(next) => {
        if (!next) onAnswer(false)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="remove-scrim"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-brand-navy/55 px-4 pb-3 pt-[calc(var(--header-h,4rem)+0.75rem)]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) event.preventDefault()
          }}
        >
          <DialogPrimitive.Content
            role="alertdialog"
            aria-modal="true"
            data-slot="remove-question"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              keep.current?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const to = returnTo()
              if (to?.isConnected) to.focus()
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onFocus={(event) => {
              if (event.target !== event.currentTarget) event.target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }}
            className="my-auto w-[min(28rem,100%)] rounded-xl border border-border bg-background p-5 text-ink shadow-xl outline-none"
          >
            <DialogPrimitive.Title className="text-lg font-bold">Remove this template?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-[15px] text-ink [overflow-wrap:anywhere]">
              {asking ? `${asking.name} leaves the list for everyone. ` : ''}Letters already started from it keep their words.
            </DialogPrimitive.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={keep}
                type="button"
                onClick={() => onAnswer(false)}
                className="inline-flex min-h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[15px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                Keep it
              </button>
              <button
                type="button"
                aria-disabled={going || undefined}
                onClick={() => onAnswer(true)}
                className="inline-flex min-h-11 items-center rounded-lg border border-transparent bg-brand-navy px-4 text-[15px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                Remove it
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/**
 * One choice: its drawing, its name with the line under it, and "Use this", with any further button of its own after it
 * (a past newsletter's "Save as a template") and the name field opened from it under the whole row.
 */
function Card({ pieces, name, line, label, busy, onUse, more, below }: { pieces: readonly Piece[]; name: string; line: string; label: string; busy: boolean; onUse: (button: HTMLButtonElement) => void; more?: ReactNode; below?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-background px-2 py-1.5">
      <Drawing pieces={pieces} />
      {/* The name holds a floor, so the buttons go below it on a narrow row rather than squeeze it to a letter wide. */}
      <span className="min-w-[min(100%,10rem)] flex-1">
        <span className="block text-[15px] font-semibold leading-[1.3] text-ink [overflow-wrap:anywhere]">{name}</span>
        <span className="block text-[13px] leading-[1.35] text-muted-foreground [overflow-wrap:anywhere]">{line}</span>
      </span>
      <button type="button" aria-label={label} aria-disabled={busy || undefined} onClick={(event) => onUse(event.currentTarget)} className={USE_BUTTON}>
        Use this
      </button>
      {more}
      {below ? <div className="basis-full">{below}</div> : null}
    </li>
  )
}

/**
 * "Replace this letter?", asked once before a letter that holds words is replaced: an alert dialog over the chooser,
 * the focus on "Keep writing" as it opens, Escape keeping writing, the focus back to the "Use this" pressed as it
 * closes. A press outside it does nothing: only an answer closes it. It stands under the site's header, held there in
 * rem, scrolling in its dim where the window is too short for it.
 */
function ReplaceQuestion({ asking, onAnswer, returnTo }: { asking: Choice | null; onAnswer: (replace: boolean) => void; returnTo: () => HTMLElement | null }) {
  const keep = useRef<HTMLButtonElement>(null)
  return (
    <DialogPrimitive.Root
      open={asking !== null}
      onOpenChange={(next) => {
        if (!next) onAnswer(false)
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="replace-scrim"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-brand-navy/55 px-4 pb-3 pt-[calc(var(--header-h,4rem)+0.75rem)]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) event.preventDefault()
          }}
        >
          <DialogPrimitive.Content
            role="alertdialog"
            aria-modal="true"
            data-slot="replace-question"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              keep.current?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const to = returnTo()
              if (to?.isConnected) to.focus()
            }}
            onPointerDownOutside={(event) => event.preventDefault()}
            onInteractOutside={(event) => event.preventDefault()}
            onFocus={(event) => {
              // As in the chooser: Tab going round gives the focus without the browser's scroll, where the dim scrolls.
              if (event.target !== event.currentTarget) event.target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
            }}
            className="my-auto w-[min(28rem,100%)] rounded-xl border border-border bg-background p-5 text-ink shadow-xl outline-none"
          >
            <DialogPrimitive.Title className="text-lg font-bold">Replace this letter?</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-2 text-[15px] text-ink">Your words are kept under Your last newsletters.</DialogPrimitive.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={keep}
                type="button"
                onClick={() => onAnswer(false)}
                className="inline-flex min-h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[15px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                Keep writing
              </button>
              <button
                type="button"
                onClick={() => onAnswer(true)}
                // A border of no colour, as the site's own buttons have, so forced colours frames it as it frames Keep writing.
                className="inline-flex min-h-11 items-center rounded-lg border border-transparent bg-brand-navy px-4 text-[15px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus"
              >
                Replace it
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
