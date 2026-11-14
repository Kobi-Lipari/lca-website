// src/areas/admin/newsletter/FromSubjectRow.tsx
//
// From and Subject, an email's own labelled boxes on one row above the
// letter's tools (board Newsletter-Page-4, P2 and P4; K's decision 48), each
// shown whole, and stacked when the row has no room for both, and on a
// tablet and a phone, under 1024 pixels, as boards P19 and P20 draw them,
// with the phone's own sizes under 768.
//
// - From shows the one sender as a name, never an address, with no list to
//   open until there is a second sender (the plan's deviation for P3): the
//   newsletter's display name from domain/mail/addresses.ts beside the
//   newsletter's own name.
// - Subject is a field with its pencil mark. Clicked, it is outlined and
//   shows its count, "30 of 60 letters", under the field at its right, as
//   board P4 draws it, a guide to what an inbox shows that never stops the
//   typing; the server's limit is 200 characters, and a refusal, if it ever
//   comes, is shown in the server's words by the saved line. The count's
//   line under the row is kept at all times, so the field keeps its whole
//   width while the count shows, nothing moves when it appears, and it
//   never covers the tools below. Characters the server would refuse (tabs,
//   other control characters and the nine that force a line's direction)
//   are dropped as they are typed or pasted, so nobody is asked to find one.
//   Under 1024 pixels, on a tablet and a phone, the field wraps its words
//   and grows by a line as they run on, so a long subject shows whole there;
//   from 1024 pixels up, on a computer, it keeps them on one line, scrolling
//   inside it, as a field of one line does, so the row, the tools and the
//   letter never move as a subject runs on. Either way it is one line of
//   text to the server: Enter types nothing, and a line break pasted becomes
//   one space between the words either side, as a field of one line makes
//   it, with none where a space or either end of the words is beside it
//   already. Its words are 16 pixels at every width, as the site's own
//   fields' are, since a phone's browser zooms the page in when a field of
//   smaller words takes the focus.

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'
import { LIST_SENDERS, SENDER_NAME } from '@domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { cn } from '@/lib/utils'
import { SUBJECT_GUIDE, keepVisible } from './letterRules'

/** The newsletter's name beside its sender, as the board writes it: the words every subject starts with. */
const NEWSLETTER_NAME = 'LCA Newsletter'

/** The sender as the From box shows it: a name, never an address. */
const FROM_WORDS = `${LIST_SENDERS[NEWSLETTER_LIST_ID]?.name ?? SENDER_NAME} · ${NEWSLETTER_NAME}`

/**
 * One of the two boxes: its label on a quiet ground at the left, then what it holds. Under 1024 pixels the two labels
 * share one width, so From's and Subject's words start in one line, as the tablet's and the phone's boards draw them.
 */
const BOX = 'flex min-h-[46px] min-w-0 items-stretch overflow-hidden rounded-lg border border-muted-foreground bg-background text-ink'
const LABEL = 'flex flex-none items-center border-r border-border bg-muted px-2.5 text-[13.5px] font-semibold text-ink max-lg:min-w-[76px] max-md:min-w-[62px] max-md:px-2 max-md:text-[13px]'

/**
 * Whether the browser makes a field as tall as its words by itself, as it then does whatever spacing a person's own
 * style gives the words; elsewhere the page measures it.
 */
const SIZES_ITSELF = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('field-sizing', 'content')

/** Makes the Subject's field as tall as its words, a line at a time, where the browser does not. */
function fit(field: HTMLTextAreaElement | null) {
  if (!field || SIZES_ITSELF) return
  field.style.height = '0px'
  field.style.height = `${field.scrollHeight}px`
}

/** A run of line breaks, as a paste or a drop brings them: carriage returns and line feeds, together or alone. */
const LINE_BREAKS = /(?:\r\n?|\n)+/g

/**
 * Words with each run of line breaks made one space, so the words either side of it stay apart, and with none where a
 * space or either end of the words is beside it already. `whole` holds the characters beside each run when `text` is
 * only the words before the caret.
 */
function joinLines(text: string, whole = text): string {
  return text.replace(LINE_BREAKS, (run: string, at: number) => {
    const before = whole[at - 1]
    const after = whole[at + run.length]
    return before === undefined || after === undefined || before === ' ' || after === ' ' ? '' : ' '
  })
}

/**
 * Keeps the Subject's words on one line, as a field of one line keeps a paste, the caret kept where it was among them.
 * keepVisible then takes out whatever else the server would refuse.
 */
function onOneLine(field: HTMLTextAreaElement) {
  const raw = field.value
  if (!/[\r\n]/.test(raw)) return
  const value = joinLines(raw)
  const caret = Math.min(joinLines(raw.slice(0, field.selectionStart ?? raw.length), raw).length, value.length)
  field.value = value
  field.setSelectionRange(caret, caret)
}

export interface FromSubjectRowProps {
  subject: string
  onSubjectChange: (subject: string) => void
  /** Always stacked, and held to the letter's width, as on the letter that fills the window. */
  stacked?: boolean
}

export function FromSubjectRow({ subject, onSubjectChange, stacked = false }: FromSubjectRowProps) {
  const [counting, setCounting] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const subjectId = useId()
  const countId = useId()
  const letters = [...subject].length

  // The field is as tall as its words, measured as they change and as its width changes with the window.
  useLayoutEffect(() => fit(field.current), [subject])
  useEffect(() => {
    const element = field.current
    if (!element || typeof ResizeObserver === 'undefined') return
    let width = element.clientWidth
    const watch = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      fit(element)
    })
    watch.observe(element)
    return () => watch.disconnect()
  }, [])

  return (
    <div
      role="group"
      aria-label="Who it is from and its subject"
      // The bottom room is the count's line: the count is drawn in it, under the Subject, and the tools start below it.
      className={cn('grid gap-2 pb-[18px]', stacked ? 'mx-auto w-full max-w-[1200px]' : 'lg:@3xl:grid-cols-[max-content_minmax(0,1fr)]')}
    >
      <p className={cn(BOX, 'max-md:min-h-[52px]')}>
        <span className={LABEL}>From</span>
        {/* Shown whole: on a narrow window the name runs on to a second line rather than being cut. */}
        <span className="flex min-w-0 items-center px-2.5 py-2 text-base leading-snug max-md:py-1.5 max-md:pl-2.5 max-md:pr-1 max-md:text-[15px]">{FROM_WORDS}</span>
      </p>
      <div className="relative flex min-w-0 flex-col">
        {/* The box is the field's to press anywhere; its name is the label alone, so the count is said as its description. */}
        <div
          className={cn(BOX, 'flex-1 cursor-text focus-within:border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink')}
          onMouseDown={(event) => {
            // A press on the label or the pencil leaves the caret after the last word, as the board draws it.
            const input = field.current
            if (input && event.target !== input) {
              event.preventDefault()
              input.focus()
              input.setSelectionRange(input.value.length, input.value.length)
            }
          }}
        >
          <label htmlFor={subjectId} className={cn(LABEL, 'cursor-text')}>Subject</label>
          {/*
            Its words are 16 pixels at every width, where board P20 draws 15: a phone's browser zooms the page in when a
            field of smaller words takes the focus, and leaves it so. Its line is 24 pixels, so it is 44 pixels tall. On a
            phone the room round its words and the pencil is the board's, so the board's subject keeps to one line at 390.
            From 1024 pixels up its words keep to one line, and the room either side of them is a clear border, not the
            field's padding, so they scroll inside that room, as a field of one line scrolls its words inside its own:
            a browser scrolls a box's padding away with its words, and leaves the padding at their end out of the scroll.
          */}
          <textarea
            ref={field}
            id={subjectId}
            rows={1}
            value={subject}
            spellCheck
            autoComplete="off"
            aria-describedby={countId}
            onFocus={(event) => {
              setCounting(true)
              fit(event.currentTarget)
            }}
            onBlur={(event) => {
              setCounting(false)
              // A field of one line shows its words from their start again once the focus leaves it.
              event.currentTarget.scrollLeft = 0
            }}
            onKeyDown={(event) => {
              // One line of text: Enter types no line break, as in a field of one line.
              if (event.key === 'Enter') event.preventDefault()
            }}
            onChange={(event) => {
              onOneLine(event.target)
              onSubjectChange(keepVisible(event.target))
            }}
            className="field-sizing-content min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-2.5 text-base text-ink outline-none max-md:pr-0.5 max-md:leading-6 lg:whitespace-pre lg:border-x-[10px] lg:border-transparent lg:px-0"
            // The box around the field draws the focus, round the label and the pencil, so the new look's own ring,
            // drawn round the field itself, would be a second ring inside it; only a style on the field turns it off.
            style={{ outline: 'none' }}
          />
          <span className="flex flex-none items-center pl-1 pr-3 max-md:pl-1.5 max-md:pr-2.5" aria-hidden="true">
            <Pencil className="size-4" />
          </span>
        </div>
        {/*
          Under the field at its right, as board P4 draws it, so the field keeps its whole width while it shows. It is on
          the desk's tint, where the site's quiet grey is under 4.5 to 1 in today's look, so it takes the words' own colour.
        */}
        <span
          id={countId}
          hidden={!counting}
          className="pointer-events-none absolute right-0.5 top-full mt-1.5 whitespace-nowrap text-[13.5px] leading-4 text-ink"
        >
          {letters} of {SUBJECT_GUIDE} letters
        </span>
      </div>
    </div>
  )
}
