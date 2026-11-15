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
//   are dropped as they are typed or dropped in, so nobody is asked to find
//   one. From 1024 pixels up, on a computer, the line the site's header
//   turns on (useWideScreen), it is the first half's own field of one line,
//   its words scrolling inside it, so the row, the tools and the letter
//   never move as a subject runs on. Under 1024 pixels, on a tablet and a
//   phone, it is a field that wraps its words and grows by a line as they
//   run on, so a long subject shows whole there, and as it takes the focus
//   its whole box is brought into view, clear of the room kept at the foot.
//   When the window crosses the line while the field has the focus, the
//   field drawn in its place takes it, the caret or the chosen words where
//   they were. Either way it is one line of text to the server: Enter types
//   nothing, and a line break of any kind or a tab pasted becomes one space
//   between the words either side, with none where a space or either end of
//   the words is beside it already, and any other character the server
//   would refuse is dropped from the paste, which the browser's own insert
//   then puts in, so its Undo takes the paste back in one step and the words
//   are not changed by script after it; on a computer the field then scrolls
//   to the caret from where it stood, and the letters typed next are a step
//   of their own for Undo, each as after the browser's own paste. Its words
//   are 16 pixels at every width, as the site's own fields' are, since a
//   phone's browser zooms the page in when a field of smaller words takes
//   the focus.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ClipboardEvent } from 'react'
import { Pencil } from 'lucide-react'
import { LIST_SENDERS, SENDER_NAME } from '@domain/mail/addresses'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { useWideScreen } from '@/hooks/useWideScreen'
import { cn } from '@/lib/utils'
import { SUBJECT_GUIDE, keepVisible, withoutHiddenCharacters } from './letterRules'

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

/** Makes the Subject's field that wraps its words as tall as they are, a line at a time, where the browser does not. */
function fit(field: HTMLInputElement | HTMLTextAreaElement | null) {
  if (!(field instanceof HTMLTextAreaElement) || SIZES_ITSELF) return
  field.style.height = '0px'
  field.style.height = `${field.scrollHeight}px`
}

/** A run of line breaks, as a drop brings them: carriage returns and line feeds, together or alone. */
const LINE_BREAKS = /(?:\r\n?|\n)+/g

/**
 * A run of tabs and line breaks of every kind, as a paste brings them: tabs, line feeds, vertical tabs, form feeds,
 * carriage returns, next lines, and the line and paragraph separators. A row copied from a spreadsheet holds tabs and
 * line ends, and some apps copy a line break inside a paragraph as the line separator. Each is written as an escape, so
 * the source shows it, the two separators by their code points, which a pattern reads only with its u flag.
 */
const BREAKS_AND_TABS = /[\t\n\v\f\r\u0085\u{2028}\u{2029}]+/gu

/** The words between those runs, from which every other character the server would refuse is dropped first. */
const BETWEEN_BREAKS = /[^\t\n\v\f\r\u0085\u{2028}\u{2029}]+/gu

/**
 * Words with each run of line breaks (or, for a paste, of tabs and line breaks of every kind) made one space, so the
 * words either side of it stay apart, and with none where a space or either end of the words is beside it already.
 * `whole` holds the characters beside each run when `text` is only the words before the caret.
 */
function joinLines(text: string, whole = text, runs = LINE_BREAKS): string {
  return text.replace(runs, (run: string, at: number) => {
    const before = whole[at - 1]
    const after = whole[at + run.length]
    return before === undefined || after === undefined || before === ' ' || after === ' ' ? '' : ' '
  })
}

/**
 * Keeps the Subject's words on one line, as a field of one line keeps them, the caret kept where it was among them: the
 * check on every change of the field that wraps, for words dropped onto it. keepVisible then takes out whatever else the
 * server would refuse.
 */
function onOneLine(field: HTMLTextAreaElement) {
  const raw = field.value
  if (!/[\r\n]/.test(raw)) return
  const value = joinLines(raw)
  const caret = Math.min(joinLines(raw.slice(0, field.selectionStart ?? raw.length), raw).length, value.length)
  field.value = value
  field.setSelectionRange(caret, caret)
}

/** The width of the caret as the browser draws it, which the view of the field of one line holds whole. */
const CARET_WIDTH = 1

/**
 * Brings the caret of the field of one line into its view after the browser's own insert, which in Chromium does not
 * scroll the field to the caret as the browser's own paste does. It starts from the scroll the field had before the
 * paste, which pasteOnOneLine puts back: at the words' end the field scrolls to its most; elsewhere just far enough that
 * the caret stands inside it, the words before the caret measured in the field's own font, letter spacing and word
 * spacing, and a caret already in view is left where it is, as the browser's own paste leaves it. Only the scroll
 * moves, so the focus, the selection and the Undo history are as the insert left them. Where nothing is laid out to
 * measure, or there is no canvas to measure with, nothing is done.
 */
function showCaret(field: HTMLInputElement) {
  const caret = field.selectionEnd
  if (caret === null || field.clientWidth === 0) return
  if (caret === field.value.length) {
    field.scrollLeft = field.scrollWidth
    return
  }
  const pen = document.createElement('canvas').getContext('2d')
  if (!pen) return
  const style = getComputedStyle(field)
  pen.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  pen.letterSpacing = style.letterSpacing
  pen.wordSpacing = style.wordSpacing
  const at = pen.measureText(field.value.slice(0, caret)).width
  const room = field.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  if (at + CARET_WIDTH > field.scrollLeft + room) field.scrollLeft = at + CARET_WIDTH - room
  else if (at < field.scrollLeft) field.scrollLeft = at
}

/**
 * A paste that holds a character the server would refuse, taken from the browser and put in on one line: every such
 * character but the tabs and line breaks dropped first, so none of them standing beside a run hides a space from it,
 * then each run of tabs and line breaks one space, the characters either side of the chosen words counting as beside
 * it. That leaves no such character in the words: each was in a run, made a space or nothing, or between runs, where it
 * was dropped, and the field's own words hold none, since keepVisible runs on every change. They are put in by the
 * browser's own insert, so its Undo takes the paste back in one step, Redo puts it in once, and keepVisible finds
 * nothing to change after it. On the field of one line, in this order: the scroll the field had before the insert is
 * put back, since over chosen words Chromium's insert scrolls the field a way of its own; the field is then scrolled to
 * the caret from there, as after the browser's own paste; and last the selection is set again where it stands, the
 * words laid out by then, which in Chromium ends the insert's step for Undo, so the letters typed next are a step of
 * their own, as after the browser's own paste, and do not join the paste's. A selection set by script does not scroll
 * the field in Chromium, so the caret stays in view. The field that wraps needs none of this: it has no sideways
 * scroll, and in Chromium the letters typed in it after such a paste do not join the paste's step.
 * When nothing is left to put in, the chosen words go, as they would with the browser's own paste once keepVisible had
 * run, by the same insert of no words, which its Undo takes back in one step; with nothing chosen, nothing happens.
 * Where the browser has no such insert, the words are set by script, the caret after them. A paste with no such
 * character is left wholly to the browser.
 */
function pasteOnOneLine(event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>, onSubjectChange: (subject: string) => void) {
  const pasted = event.clipboardData.getData('text/plain')
  if (withoutHiddenCharacters(pasted) === pasted) return
  event.preventDefault()
  const field = event.currentTarget
  const start = field.selectionStart ?? field.value.length
  const end = field.selectionEnd ?? field.value.length
  const before = field.value.slice(0, start)
  const after = field.value.slice(end)
  const kept = pasted.replace(BETWEEN_BREAKS, withoutHiddenCharacters)
  const words = joinLines(before + kept, before + kept + after, BREAKS_AND_TABS).slice(before.length)
  if (!words && start === end) return
  const scrolled = field.scrollLeft
  if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, words)) {
    if (field instanceof HTMLInputElement) {
      field.scrollLeft = scrolled
      showCaret(field)
      field.setSelectionRange(field.selectionStart, field.selectionEnd, field.selectionDirection ?? 'none')
    }
    return
  }
  field.value = before + words + after
  field.setSelectionRange(before.length + words.length, before.length + words.length)
  onSubjectChange(keepVisible(field))
}

/** Where the caret, or the chosen words, stood in the field, and which way they were chosen. */
interface Caret {
  start: number
  end: number
  direction: 'forward' | 'backward' | 'none'
}

export interface FromSubjectRowProps {
  subject: string
  onSubjectChange: (subject: string) => void
  /** Always stacked, and held to the letter's width, as on the letter that fills the window. */
  stacked?: boolean
}

export function FromSubjectRow({ subject, onSubjectChange, stacked = false }: FromSubjectRowProps) {
  const [counting, setCounting] = useState(false)
  // From 1024 pixels up the field of one line, under it the field that wraps: the line the site's header turns on.
  const wide = useWideScreen()
  const field = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  /** The caret of a field that had the focus as the window crossed 1024 pixels, for the field drawn in its place. */
  const carried = useRef<Caret | null>(null)
  const subjectId = useId()
  const countId = useId()
  const letters = [...subject].length

  // The field that wraps is as tall as its words, measured as they change and as its width changes with the window.
  useLayoutEffect(() => fit(field.current), [subject, wide])
  useEffect(() => {
    const element = field.current
    if (!(element instanceof HTMLTextAreaElement) || typeof ResizeObserver === 'undefined') return
    let width = element.clientWidth
    const watch = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      fit(element)
    })
    watch.observe(element)
    return () => watch.disconnect()
  }, [wide])

  /**
   * The field as it is drawn and as it is taken off the page. As the window crosses 1024 pixels the other form takes
   * its place: if this one had the focus, the new one takes it, the caret or the chosen words where they were, read as
   * this one is taken off the page, before the page is drawn again, and never from a blur, which a browser may or may
   * not send for a field taken off the page. The browser's Undo does not cross over: each form keeps its own.
   */
  const holdField = useCallback((element: HTMLInputElement | HTMLTextAreaElement | null) => {
    field.current = element
    if (!element) return
    const caret = carried.current
    carried.current = null
    if (caret) {
      element.focus({ preventScroll: true })
      element.setSelectionRange(caret.start, caret.end, caret.direction)
    }
    return () => {
      field.current = null
      if (element.ownerDocument.activeElement !== element) return
      carried.current = { start: element.selectionStart ?? 0, end: element.selectionEnd ?? 0, direction: element.selectionDirection ?? 'none' }
    }
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
          {wide ? (
            // From 1024 pixels up, the first half's own field of one line, as it was.
            <input
              ref={holdField}
              id={subjectId}
              type="text"
              value={subject}
              spellCheck
              autoComplete="off"
              aria-describedby={countId}
              onFocus={() => setCounting(true)}
              onBlur={() => setCounting(false)}
              onPaste={(event) => pasteOnOneLine(event, onSubjectChange)}
              onChange={(event) => onSubjectChange(keepVisible(event.target))}
              className="min-w-0 flex-1 bg-transparent px-2.5 text-base text-ink outline-none"
              // The box around the field draws the focus, round the label and the pencil, so the new look's own ring,
              // drawn round the field itself, would be a second ring inside it; only a style on the field turns it off.
              style={{ outline: 'none' }}
            />
          ) : (
            // Under 1024 pixels, a field of one row that wraps its words. They are 16 pixels at every width, where board
            // P20 draws 15: a phone's browser zooms the page in when a field of smaller words takes the focus, and
            // leaves it so. Its line is 24 pixels, so it is 44 pixels tall. On a phone the room round its words and the
            // pencil is the board's, so the board's subject keeps to one line at 390. It takes one line of words, though
            // it shows them on several, and says so to a screen reader.
            <textarea
              ref={holdField}
              id={subjectId}
              rows={1}
              value={subject}
              spellCheck
              autoComplete="off"
              aria-multiline="false"
              aria-describedby={countId}
              onFocus={(event) => {
                setCounting(true)
                fit(event.currentTarget)
                // The browser brings only the caret's line into view as a field takes the focus, so a subject of several
                // lines could end in the room kept at the foot: its whole box comes into view, with its scroll margins.
                const element = event.currentTarget
                requestAnimationFrame(() => {
                  if (element.ownerDocument.activeElement === element) element.scrollIntoView?.({ block: 'nearest' })
                })
              }}
              onBlur={() => setCounting(false)}
              onKeyDown={(event) => {
                // One line of text: Enter types no line break, as in a field of one line.
                if (event.key === 'Enter') event.preventDefault()
              }}
              onPaste={(event) => pasteOnOneLine(event, onSubjectChange)}
              onChange={(event) => {
                onOneLine(event.target)
                onSubjectChange(keepVisible(event.target))
              }}
              className="field-sizing-content min-w-0 flex-1 resize-none overflow-hidden bg-transparent px-2.5 py-2.5 text-base text-ink outline-none max-md:pr-0.5 max-md:leading-6"
              // The box draws the focus, as for the field of one line, so only a style on the field turns off its own ring.
              style={{ outline: 'none' }}
            />
          )}
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
