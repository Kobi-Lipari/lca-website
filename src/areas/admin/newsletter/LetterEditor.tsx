// src/areas/admin/newsletter/LetterEditor.tsx
//
// The letter's tools and the letter itself, one editing surface you click
// and type on (board Newsletter-Page-4, P5, P6 and P8; K's decision 38).
//
// The tools: Bold, Italic, Heading, List, Link and Undo, then the Add menu.
// Each is a real button with a name, at least 44px, that says when it is on
// by aria-pressed; the row is one stop for the keyboard, its tools reached
// by the arrow keys. Heading makes a main heading; on a main heading it
// offers a smaller one, but only when a main heading stands above it, since
// the server refuses a letter whose first heading is a smaller one, and a
// third press makes plain words again; each change is read out. Link takes
// its address in a small field on the page, never the browser's prompt, the
// words chosen staying marked meanwhile, and takes only an address the
// email's cleaner keeps, saying in words when it cannot. The Add menu reads "Add an event or line" and holds a line in this
// half: the event joins it in page step 5 and the photo, with the board's
// own name, in page step 12 (K's choice 5). Each thing that opens takes the
// focus, closes on Escape and gives the focus back.
//
// The letter: the navy band with the rook, "LCA Newsletter" and the month,
// edited in place from its "Click to edit" chip; "In this issue", made from
// the headings; then the parts, in the email's own look. The editor kit is
// held to what the cleaner keeps (p, br, strong, em, h2, h3, lists, a line
// and links), its links written with their address alone, so an ordinary
// save comes back unchanged; strike, underline, code, code blocks and quotes
// are not offered, and pasted ones become plain words. An empty part shows
// its prompt, the board's words in PART_PROMPTS for the first three parts,
// through the kit's placeholder piece, which marks each empty paragraph:
// the words are chosen by the part's place among the headings, read live
// from the letter, so they follow as headings are added or taken away. The
// letter's end shows "Click here to write the next part". The part being
// typed in shows an outline and the "Editing" chip, and a heading under the
// pointer its dashed outline and "Click to edit". No separate edit mode.
//
// Under the letter: "Pull to make taller", which the arrow keys move too,
// and a press with no drag makes one step taller, for a person who cannot
// drag; and Make bigger, which fills the window with the letter and shows
// Make smaller in its place.

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Focus, Placeholder, Selection as KeptSelection } from '@tiptap/extensions'
import { Bold, ChevronDown, Expand, Heading, Italic, Link2, List, Pencil, Plus, Shrink, Undo2 } from 'lucide-react'
import { letterParts, PART_PROMPTS } from '@domain/mail/letter'
import { LcaMark } from '@/components/LcaMark'
import { cn } from '@/lib/utils'
import { InThisIssue } from './InThisIssue'
import { keepableAddress, keepVisible, MONTH_LABEL_MAX } from './letterRules'

/**
 * A link that holds its address and nothing else, as the cleaner keeps it: a link pasted in with a target, a rel, a
 * class or a title comes into the letter with its address alone.
 */
const KeptLink = Link.extend({
  addAttributes() {
    return { href: { default: null, parseHTML: (element: HTMLElement) => element.getAttribute('href') } }
  },
})

/** A space that holds the band's line open while the month is empty, made from its code so the source shows it. */
const NO_BREAK_SPACE = String.fromCharCode(0xa0)

/** The prompt at the letter's end, and in a part past the first three. */
const NEXT_PART = 'Click here to write the next part'

/**
 * The band's "LCA Newsletter", in the email's own light gold on its navy band (the email layout's GOLD_ON_NAVY, 10.55
 * to 1): the band is navy in every look, as the email's is, so its words keep the email's colour.
 */
const BAND_GOLD = '#efd98a'

/** The prompts as the letter's style reads them, by a part's place among the headings, from the one list of words. */
const PROMPT_WORDS = {
  '--prompt-1': JSON.stringify(PART_PROMPTS[0]),
  '--prompt-2': JSON.stringify(PART_PROMPTS[1]),
  '--prompt-3': JSON.stringify(PART_PROMPTS[2]),
}

/**
 * The letter's look, in the email's own form, and its signs: an empty part as a dashed box with its prompt (a part's
 * only paragraph, between two headings or at the end, or the letter's last or only paragraph), the part being typed in
 * outlined with its "Editing" chip, and a heading under the pointer outlined with "Click to edit". The chips are drawn
 * with no words for a screen reader, which knows where the caret is.
 */
const LETTER_CLASSES = [
  'min-h-full px-5 pb-6 pt-[22px] font-serif text-[17px] leading-[1.62] text-ink outline-none sm:px-[52px]',
  '[&_p]:mb-2.5 [&_strong]:font-bold [&_a]:underline [&_a]:underline-offset-3',
  '[&_h2]:relative [&_h2]:mb-2.5 [&_h2]:mt-6 [&_h2]:font-sans [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2]:tracking-[-0.005em]',
  "[&_h2]:before:mb-3 [&_h2]:before:block [&_h2]:before:h-[3px] [&_h2]:before:w-8 [&_h2]:before:bg-gold-ink-badge [&_h2]:before:content-['']",
  '[&>h2:first-child]:mt-0 [&_h3]:relative [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-sans [&_h3]:text-[17px] [&_h3]:font-bold',
  '[&_ul]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_li>p]:mb-1',
  '[&_hr]:my-6 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_.kept-selection]:bg-lca-gold/30',
  // An empty part, the letter's end and an empty letter: a dashed box holding the prompt.
  '[&>p.is-empty:is(:last-child,h2+*:has(+h2))]:min-h-12 [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:rounded-lg [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:border-[1.5px]',
  '[&>p.is-empty:is(:last-child,h2+*:has(+h2))]:border-dashed [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:border-muted-foreground [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:px-4 [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:py-2.5',
  '[&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:pointer-events-none [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:float-left [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:h-0',
  '[&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:font-sans [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:text-[15.5px] [&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:text-muted-foreground',
  '[&>p.is-empty:is(:last-child,h2+*:has(+h2))]:before:content-[attr(data-placeholder)] [&>p.is-empty:only-child:first-child]:before:content-(--prompt-1)',
  '[&>h2:nth-of-type(1)+p.is-empty:is(:last-child,:has(+h2))]:before:content-(--prompt-1) [&>h2:nth-of-type(2)+p.is-empty:is(:last-child,:has(+h2))]:before:content-(--prompt-2)',
  '[&>h2:nth-of-type(3)+p.is-empty:is(:last-child,:has(+h2))]:before:content-(--prompt-3)',
  // The part being typed in: an outline and the "Editing" chip.
  '[&>.has-focus]:relative [&>.has-focus]:rounded-sm [&>.has-focus]:outline-[1.5px] [&>.has-focus]:outline-offset-[6px] [&>.has-focus]:outline-ink [&>.has-focus]:outline-solid',
  '[&>.has-focus]:after:absolute [&>.has-focus]:after:-top-[19px] [&>.has-focus]:after:right-1 [&>.has-focus]:after:rounded-md [&>.has-focus]:after:bg-foreground [&>.has-focus]:after:px-2',
  "[&>.has-focus]:after:font-sans [&>.has-focus]:after:text-xs [&>.has-focus]:after:font-semibold [&>.has-focus]:after:leading-6 [&>.has-focus]:after:text-background [&>.has-focus]:after:content-['Editing'_/_'']",
  // A heading under the pointer: its dashed outline and "Click to edit".
  '[&>h2:not(.has-focus):hover]:outline-1 [&>h2:not(.has-focus):hover]:outline-offset-[6px] [&>h2:not(.has-focus):hover]:outline-dashed [&>h2:not(.has-focus):hover]:outline-ink/50',
  '[&>h2:not(.has-focus):hover]:after:absolute [&>h2:not(.has-focus):hover]:after:bottom-0 [&>h2:not(.has-focus):hover]:after:right-0 [&>h2:not(.has-focus):hover]:after:rounded-full',
  '[&>h2:not(.has-focus):hover]:after:border [&>h2:not(.has-focus):hover]:after:border-border [&>h2:not(.has-focus):hover]:after:bg-background [&>h2:not(.has-focus):hover]:after:px-2.5',
  "[&>h2:not(.has-focus):hover]:after:text-xs [&>h2:not(.has-focus):hover]:after:font-semibold [&>h2:not(.has-focus):hover]:after:leading-7 [&>h2:not(.has-focus):hover]:after:content-['Click_to_edit'_/_'']",
].join(' ')

/**
 * The smallest and largest the letter's box is pulled to, how far one press of an arrow key moves it, and how far Page
 * Up, Page Down and a press on the grip move it.
 */
const SHEET_MIN = 320
const SHEET_MAX = 3000
const SHEET_STEP = 40
const SHEET_PAGE = SHEET_STEP * 4

/**
 * How far the pointer may stray, between going down on the grip and being let go, for the grip to take it as a press
 * rather than a pull: a finger that taps, or a hand that cannot drag, still moves a little.
 */
const PRESS_SLOP = 10

/**
 * The letter's box at first: what the window holds under the head, the row of fields with the Subject count's line, the
 * tools and the room kept for the bar at the foot.
 */
function firstSheetHeight(): number {
  const room = typeof window === 'undefined' ? 760 : window.innerHeight - 428
  return Math.min(SHEET_MAX, Math.max(SHEET_MIN, Math.round(room)))
}

/** What scrolls the grip: the nearest box round it that scrolls, as the letter made bigger does, or else the window. */
function scrollerOf(element: HTMLElement): HTMLElement | Window {
  for (let box = element.parentElement; box; box = box.parentElement) {
    if (/^(auto|scroll)$/.test(getComputedStyle(box).overflowY) && box.scrollHeight > box.clientHeight) return box
  }
  return window
}

/** Whether a main heading stands anywhere before a place in the letter. */
function mainHeadingBefore(editor: Editor, at: number): boolean {
  let found = false
  editor.state.doc.nodesBetween(0, at, (node) => {
    if (found) return false
    if (node.type.name === 'heading' && node.attrs.level === 2) found = true
    return !found
  })
  return found
}

/**
 * Heading, pressed: plain words become a main heading; a main heading becomes a smaller one when a main heading stands
 * above it, else plain words; a smaller heading becomes plain words. Returns what the line now is, in words.
 */
function nextHeading(editor: Editor): string {
  const { $from } = editor.state.selection
  const block = $from.parent
  const level = block.type.name === 'heading' ? Number(block.attrs.level) : 0
  if (level === 0) {
    editor.chain().setHeading({ level: 2 }).run()
    return 'Main heading'
  }
  if (level === 2 && $from.depth > 0 && mainHeadingBefore(editor, $from.before())) {
    editor.chain().setHeading({ level: 3 }).run()
    return 'Smaller heading'
  }
  editor.chain().setParagraph().run()
  return 'No heading'
}

/** Puts the caret at the start of a part: in the line under its heading, or at the heading's end when nothing follows. */
function goToPart(editor: Editor, index: number) {
  let seen = -1
  let at = -1
  editor.state.doc.forEach((node, offset) => {
    if (at >= 0 || node.type.name !== 'heading' || node.attrs.level !== 2 || node.textContent.trim() === '') return
    seen += 1
    if (seen === index) at = offset
  })
  if (at < 0) return
  const heading = editor.state.doc.nodeAt(at)
  if (!heading) return
  const after = at + heading.nodeSize
  const next = editor.state.doc.nodeAt(after)
  editor.chain().focus().setTextSelection(next && next.isTextblock ? after + 1 : after - 1).scrollIntoView().run()
}

/**
 * One tool of the row: its mark, its word, 44px tall. A tool that is on is filled with the words' own colour, its words
 * in the ground's, which holds well over 3 to 1 against the row in every look, beside aria-pressed.
 */
const TOOL = 'inline-flex h-11 flex-none items-center gap-1.5 rounded-lg px-2 text-[14.5px] font-semibold text-ink outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-focus aria-pressed:bg-foreground aria-pressed:text-background'

interface ToolProps {
  index: number
  active: number
  onActive: (index: number) => void
  pressed?: boolean
  disabled?: boolean
  onPress: () => void
  icon: ReactNode
  children: ReactNode
  /** Drawn with its own edge, as the Add menu's button is. */
  boxed?: boolean
  buttonRef?: (element: HTMLButtonElement | null) => void
  /** What it opens: a menu, or a part of the page (no kind), which it says is open or shut. */
  popup?: { expanded: boolean; controls: string; kind?: 'menu' }
}

/** A tool: a mouse press leaves the caret in the letter, so a tool acts on the words chosen there. */
function Tool({ index, active, onActive, pressed, disabled, onPress, icon, children, boxed = false, buttonRef, popup }: ToolProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      data-tool=""
      tabIndex={index === active ? 0 : -1}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      aria-haspopup={popup?.kind}
      aria-expanded={popup?.expanded}
      aria-controls={popup?.expanded ? popup.controls : undefined}
      onFocus={() => onActive(index)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!disabled) onPress()
      }}
      className={cn(TOOL, disabled && 'cursor-default opacity-60', boxed && 'border border-ink/40 bg-background px-2.5')}
    >
      {icon}
      {children}
    </button>
  )
}

/** The small field that takes a link's address, on the page, under the tools. */
function LinkField({ editor, id, onClose }: { editor: Editor; id: string; onClose: (to: 'tool' | 'letter') => void }) {
  const existing = (editor.getAttributes('link').href as string | undefined) ?? ''
  const needsWords = !existing && editor.state.selection.empty
  const [address, setAddress] = useState(existing)
  const [words, setWords] = useState('')
  const [wrong, setWrong] = useState(false)
  const addressRef = useRef<HTMLInputElement>(null)
  const wrongId = useId()
  useEffect(() => {
    addressRef.current?.focus()
  }, [])

  function keep() {
    const href = keepableAddress(address)
    if (href === null) {
      setWrong(true)
      addressRef.current?.focus()
      return
    }
    const chain = editor.chain().focus()
    if (existing) chain.extendMarkRange('link').setLink({ href }).run()
    else if (needsWords) chain.insertContent({ type: 'text', text: words.trim() || href, marks: [{ type: 'link', attrs: { href } }] }).run()
    else chain.setLink({ href }).run()
    onClose('letter')
  }

  return (
    <div
      id={id}
      role="group"
      aria-label="Add a link"
      className="flex flex-wrap items-end gap-3 border-x border-b border-border bg-background px-3 py-3"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose('tool')
        }
      }}
    >
      <label className="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
        Link address
        <input
          ref={addressRef}
          type="text"
          inputMode="url"
          autoComplete="off"
          value={address}
          placeholder="https://"
          aria-invalid={wrong || undefined}
          aria-describedby={wrong ? wrongId : undefined}
          onChange={(event) => {
            setAddress(event.target.value)
            setWrong(false)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              keep()
            }
          }}
          className="h-11 rounded-lg border border-muted-foreground bg-background px-3 text-base font-normal text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
        />
      </label>
      {needsWords && (
        <label className="flex min-w-[min(100%,12rem)] flex-1 flex-col gap-1 text-sm font-semibold text-ink">
          Words to show
          <input
            type="text"
            autoComplete="off"
            value={words}
            onChange={(event) => setWords(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                keep()
              }
            }}
            className="h-11 rounded-lg border border-muted-foreground bg-background px-3 text-base font-normal text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={keep} className="inline-flex h-11 items-center rounded-lg bg-brand-navy px-4 text-[14.5px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-focus">
          {existing ? 'Change the link' : 'Add the link'}
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => {
              editor.chain().focus().extendMarkRange('link').unsetLink().run()
              onClose('letter')
            }}
            className="inline-flex h-11 items-center rounded-lg border border-muted-foreground bg-background px-4 text-[14.5px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
          >
            Remove the link
          </button>
        )}
        <button type="button" onClick={() => onClose('tool')} className="inline-flex h-11 items-center rounded-lg px-3 text-[14.5px] font-semibold text-ink underline underline-offset-3 outline-none focus-visible:ring-3 focus-visible:ring-focus">
          Cancel
        </button>
      </div>
      {wrong && (
        <p id={wrongId} role="alert" className="basis-full text-[15px] font-semibold text-destructive">
          The email cannot keep that address. Start it with https://, http:// or mailto: and leave out spaces and quote marks.
        </p>
      )}
    </div>
  )
}

/**
 * The Add menu's list: one line, "A line", in this half. It takes the focus when it opens; Escape closes it and gives
 * the focus back to its button, and a press anywhere else closes it where the person pressed.
 */
function AddMenuList({ id, anchor, onLine, onClose, onDismiss }: {
  id: string
  anchor: RefObject<HTMLButtonElement | null>
  onLine: () => void
  onClose: () => void
  onDismiss: () => void
}) {
  const first = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  }, [onDismiss])
  useEffect(() => {
    first.current?.focus()
    const outside = (event: Event) => {
      const target = event.target as Node | null
      if (box.current?.contains(target) || anchor.current?.contains(target)) return
      dismiss.current()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [anchor])
  return (
    <div
      ref={box}
      id={id}
      role="menu"
      aria-label="Add"
      className="absolute right-0 top-full z-20 mt-1 min-w-48 rounded-lg border border-border bg-background p-1 shadow-lg"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
        } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault()
          first.current?.focus()
        } else if (event.key === 'Tab') {
          onClose()
        }
      }}
    >
      <button
        ref={first}
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onLine}
        className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-[14.5px] font-semibold text-ink outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-focus"
      >
        A line
      </button>
    </div>
  )
}

export interface LetterEditorProps {
  /** The letter's words when the editor opens. */
  initialHtml: string
  /** The letter's month, as its band writes it. */
  month: string
  onMonthChange: (month: string) => void
  /** The letter's words each time they change, as the editor writes them. */
  onChange: (html: string) => void
  /** Whether the letter fills the window. */
  bigger: boolean
  onBiggerChange: (bigger: boolean) => void
  /** Puts the caret in the letter as it opens, after it has taken the place of the person's words. */
  autoFocus?: boolean
  /**
   * The letter's words as the editor first holds them, once it has read them: what the side preview draws until the
   * person changes something, so the email shown is always one the editor itself wrote. Not a change: nothing is saved.
   */
  onReady?: (html: string) => void
}

export function LetterEditor({ initialHtml, month, onMonthChange, onChange, bigger, onBiggerChange, autoFocus = false, onReady }: LetterEditorProps) {
  const [html, setHtml] = useState(initialHtml)
  const [activeTool, setActiveTool] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [said, setSaid] = useState('')
  const [height, setHeight] = useState(firstSheetHeight)
  const [editingMonth, setEditingMonth] = useState(false)
  const [monthDraft, setMonthDraft] = useState(month)
  const linkTool = useRef<HTMLButtonElement | null>(null)
  const addTool = useRef<HTMLButtonElement | null>(null)
  const sizeButton = useRef<HTMLButtonElement>(null)
  const monthChip = useRef<HTMLButtonElement>(null)
  const monthInput = useRef<HTMLInputElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; height: number; far: number } | null>(null)
  /** The pointer just let go on the grip, kept for the click that follows it: a press, with its first height, or a pull. */
  const letGo = useRef<{ pressFrom: number | null } | null>(null)
  const wasBigger = useRef(bigger)
  const chipAgain = useRef(false)
  const monthOpen = useRef(false)
  const changed = useRef(onChange)
  const ready = useRef(onReady)
  const linkId = useId()
  const addId = useId()
  const sheetId = useId()

  useEffect(() => {
    changed.current = onChange
    ready.current = onReady
  }, [onChange, onReady])

  // The month's box, closed by Enter or Escape, gives the focus back to its chip once the chip is drawn again.
  useEffect(() => {
    if (!editingMonth && chipAgain.current) monthChip.current?.focus()
    chipAgain.current = false
  }, [editingMonth])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        strike: false,
        underline: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        link: false,
      }),
      KeptLink.configure({
        // A link is made with the Link tool alone, never as an address is typed, so the words typed after a link
        // stay plain words rather than joining it.
        autolink: false,
        openOnClick: false,
        HTMLAttributes: { target: null, rel: null, class: null },
        isAllowedUri: (url) => keepableAddress(url) !== null,
      }),
      Placeholder.configure({ placeholder: NEXT_PART, showOnlyCurrent: false, includeChildren: false }),
      Focus.configure({ className: 'has-focus', mode: 'shallowest' }),
      // The words chosen stay marked while the focus is in the link's field, so the person sees which words the link
      // will go on.
      KeptSelection.configure({ className: 'kept-selection' }),
    ],
    content: initialHtml,
    autofocus: autoFocus ? 'start' : false,
    editorProps: {
      attributes: {
        class: LETTER_CLASSES,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'The letter',
        // The new look's one focus ring would go round the whole letter, most of it out of view in its box, so the
        // letter's sign of the focus is the board's own: the part being typed in, outlined, with its "Editing" chip.
        // The look's ring rule sits outside the style layers, so only a style on the element itself turns it off here.
        style: [...Object.entries(PROMPT_WORDS).map(([name, words]) => `${name}: ${words}`), 'outline: none'].join('; '),
      },
    },
    onCreate: ({ editor: now }) => {
      ready.current?.(now.getHTML())
    },
    onUpdate: ({ editor: now }) => {
      const next = now.getHTML()
      setHtml(next)
      changed.current(next)
    },
  })

  const tools = useEditorState({
    editor,
    selector: ({ editor: now }) =>
      now
        ? {
            bold: now.isActive('bold'),
            italic: now.isActive('italic'),
            heading: now.isActive('heading'),
            list: now.isActive('bulletList') || now.isActive('orderedList'),
            canUndo: now.can().undo(),
          }
        : null,
  })

  const parts = useMemo(() => letterParts(html), [html])

  // Make bigger takes the focus to the letter; Make smaller, or Escape, gives it back to the button that made it bigger.
  useEffect(() => {
    if (bigger && !wasBigger.current) editor?.commands.focus()
    if (!bigger && wasBigger.current) sizeButton.current?.focus()
    wasBigger.current = bigger
  }, [bigger, editor])

  if (!editor || !tools) return null

  function onToolbarKey(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...(toolbar.current?.querySelectorAll<HTMLButtonElement>('[data-tool]') ?? [])]
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (at < 0) return
    const last = buttons.length - 1
    const next = event.key === 'ArrowRight' ? (at === last ? 0 : at + 1) : event.key === 'ArrowLeft' ? (at === 0 ? last : at - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : -1
    if (next < 0) return
    event.preventDefault()
    setActiveTool(next)
    buttons[next].focus()
  }

  function closeLink(to: 'tool' | 'letter') {
    setLinkOpen(false)
    if (to === 'tool') linkTool.current?.focus()
  }

  function closeAdd() {
    setAddOpen(false)
    addTool.current?.focus()
  }

  function startMonth() {
    monthOpen.current = true
    setMonthDraft(month)
    setEditingMonth(true)
  }

  /**
   * Closes the month's box once: by Enter, which keeps the new month; by Escape, which keeps the old one; or by the focus
   * leaving it, which keeps the new one. A browser that reports the focus leaving as the box is taken away, after Enter
   * or Escape, finds it closed already, so Escape's old month stands.
   */
  function endMonth(keepIt: boolean, refocus: boolean) {
    if (!monthOpen.current) return
    monthOpen.current = false
    chipAgain.current = refocus
    setEditingMonth(false)
    if (keepIt && monthDraft !== month) onMonthChange(monthDraft)
  }

  function resize(next: number) {
    setHeight(Math.min(SHEET_MAX, Math.max(SHEET_MIN, Math.round(next))))
  }

  function onPullKey(event: KeyboardEvent<HTMLDivElement>) {
    const by: Record<string, number> = { ArrowDown: SHEET_STEP, ArrowUp: -SHEET_STEP, PageDown: SHEET_PAGE, PageUp: -SHEET_PAGE }
    if (event.key in by) resize(height + by[event.key])
    else if (event.key === 'Home') resize(SHEET_MIN)
    else if (event.key === 'End') resize(SHEET_MAX)
    else return
    event.preventDefault()
  }

  function onPullDown(event: PointerEvent<HTMLDivElement>) {
    drag.current = { y: event.clientY, height, far: 0 }
    letGo.current = null
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function onPullMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current.far = Math.max(drag.current.far, Math.abs(event.clientY - drag.current.y))
    resize(drag.current.height + (event.clientY - drag.current.y))
  }

  /** A pointer let go: one that strayed less than PRESS_SLOP was a press, and the click the browser sends next makes it. */
  function onPullUp(event: PointerEvent<HTMLDivElement>) {
    const pointer = drag.current
    drag.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    const press = pointer !== null && pointer.far < PRESS_SLOP && event.type === 'pointerup' && event.button === 0
    letGo.current = { pressFrom: press ? pointer.height : null }
  }

  /**
   * A press on the grip, so a person who cannot drag can still choose a height (WCAG 2.2, 2.5.7): the browser's click
   * after a pointer that hardly moved, or a click with no pointer of its own, as a screen reader gives. It comes after
   * the browser's own mouse events for a touch, so the letter grows only once they have found the grip under the finger.
   * The letter grows by the step Page Down gives, from the height it had as the press began, and from the tallest goes
   * to the shortest, so presses alone walk the whole range a drag reaches, a letter shorter than at first among it; the
   * grip has the focus, so a screen reader says the new height in words, as it does after a key. The click after a pull
   * changes nothing. A click with no pointer of its own counts no press of a pointer (its detail is 0), so it is a press
   * from the height as it stands, whatever a pointer the browser ended with no click left behind. The page then scrolls
   * by what the letter grew or shrank, at once, never smoothly, so the grip stays under the pointer for the next press.
   */
  function onPullClick(event: MouseEvent<HTMLDivElement>) {
    const last = event.detail === 0 ? null : letGo.current
    letGo.current = null
    const from = last === null ? height : last.pressFrom
    if (from === null) return
    const grip = event.currentTarget
    grip.focus()
    const top = grip.getBoundingClientRect().top
    flushSync(() => resize(from >= SHEET_MAX ? SHEET_MIN : from + SHEET_PAGE))
    const moved = grip.getBoundingClientRect().top - top
    if (moved !== 0) scrollerOf(grip).scrollBy({ top: moved, behavior: 'instant' })
  }

  const icon = 'size-[18px] flex-none'
  return (
    <div className={cn('flex min-h-0 flex-col', bigger && 'mx-auto w-full max-w-[1200px] flex-1')}>
      <div className="relative">
        <div
          ref={toolbar}
          role="toolbar"
          aria-label="Writing tools"
          aria-controls={sheetId}
          onKeyDown={onToolbarKey}
          className="flex flex-wrap items-center gap-1.5 rounded-t-xl border border-border bg-background p-1.5 shadow-sm"
        >
          <Tool index={0} active={activeTool} onActive={setActiveTool} pressed={tools.bold} onPress={() => editor.chain().toggleBold().run()} icon={<Bold className={icon} aria-hidden="true" />}>
            Bold
          </Tool>
          <Tool index={1} active={activeTool} onActive={setActiveTool} pressed={tools.italic} onPress={() => editor.chain().toggleItalic().run()} icon={<Italic className={icon} aria-hidden="true" />}>
            Italic
          </Tool>
          <Tool index={2} active={activeTool} onActive={setActiveTool} pressed={tools.heading} onPress={() => setSaid(nextHeading(editor))} icon={<Heading className={icon} aria-hidden="true" />}>
            Heading
          </Tool>
          <Tool index={3} active={activeTool} onActive={setActiveTool} pressed={tools.list} onPress={() => editor.chain().toggleBulletList().run()} icon={<List className={icon} aria-hidden="true" />}>
            List
          </Tool>
          <Tool
            index={4}
            active={activeTool}
            onActive={setActiveTool}
            buttonRef={(element) => {
              linkTool.current = element
            }}
            popup={{ expanded: linkOpen, controls: linkId }}
            onPress={() => {
              setAddOpen(false)
              setLinkOpen((open) => !open)
            }}
            icon={<Link2 className={icon} aria-hidden="true" />}
          >
            Link
          </Tool>
          <Tool index={5} active={activeTool} onActive={setActiveTool} disabled={!tools.canUndo} onPress={() => editor.chain().undo().run()} icon={<Undo2 className={icon} aria-hidden="true" />}>
            Undo
          </Tool>
          <div className="relative ml-auto">
            <Tool
              index={6}
              active={activeTool}
              onActive={setActiveTool}
              buttonRef={(element) => {
                addTool.current = element
              }}
              popup={{ expanded: addOpen, controls: addId, kind: 'menu' }}
              onPress={() => {
                setLinkOpen(false)
                setAddOpen((open) => !open)
              }}
              boxed
              icon={<Plus className={icon} aria-hidden="true" />}
            >
              Add an event or line
              <ChevronDown className="size-4 flex-none" aria-hidden="true" />
            </Tool>
            {addOpen && (
              <AddMenuList
                id={addId}
                anchor={addTool}
                onClose={closeAdd}
                onDismiss={() => setAddOpen(false)}
                onLine={() => {
                  setAddOpen(false)
                  editor.chain().focus().setHorizontalRule().run()
                }}
              />
            )}
          </div>
          <span className="sr-only" role="status">{said}</span>
        </div>
        {linkOpen && <LinkField editor={editor} id={linkId} onClose={closeLink} />}
      </div>

      <div
        id={sheetId}
        data-slot="letter-sheet"
        className={cn('relative overflow-y-auto border-x border-border bg-surface shadow-md', bigger && 'flex-1')}
        style={bigger ? { minHeight: height } : { height }}
      >
        <div className="flex min-h-[100px] items-center gap-[18px] border-b-[3px] border-lca-gold bg-brand-navy px-5 py-4 font-sans text-white sm:px-[60px]">
          <LcaMark title="" className="size-[52px]" />
          <div className="min-w-0">
            <p className="text-[17px] font-bold uppercase leading-none tracking-[0.08em]" style={{ color: BAND_GOLD }}>LCA Newsletter</p>
            <div className="mt-[9px] flex flex-wrap items-center gap-x-3.5 gap-y-1">
              {editingMonth ? (
                <input
                  ref={monthInput}
                  type="text"
                  aria-label="The month"
                  autoFocus
                  maxLength={MONTH_LABEL_MAX}
                  value={monthDraft}
                  onChange={(event) => setMonthDraft(keepVisible(event.target))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      endMonth(true, true)
                    } else if (event.key === 'Escape') {
                      event.preventDefault()
                      event.stopPropagation()
                      endMonth(false, true)
                    }
                  }}
                  onBlur={() => endMonth(true, false)}
                  className="w-[min(100%,15ch)] rounded-md bg-transparent px-1.5 text-[36px] font-bold leading-tight tracking-[-0.015em] text-white outline-2 outline-white"
                />
              ) : (
                <span className="text-[36px] font-bold leading-none tracking-[-0.015em] text-white" onClick={startMonth}>
                  {month || NO_BREAK_SPACE}
                </span>
              )}
              {!editingMonth && (
                <button
                  ref={monthChip}
                  type="button"
                  onClick={startMonth}
                  aria-label={month ? `Click to edit the month, ${month}` : 'Click to edit the month'}
                  className="inline-flex min-h-11 items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-focus"
                >
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-white/60 px-2.5 text-[12.5px] font-semibold">
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Click to edit
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
        <InThisIssue parts={parts} onGo={(index) => goToPart(editor, index)} />
        <EditorContent editor={editor} />
      </div>

      {/* On a narrow window the grip's two bars give way, so "Pull to make taller" and Make bigger share the row. */}
      <div className="grid min-h-[52px] grid-cols-[1fr_auto_1fr] items-center rounded-b-xl border border-border bg-background pl-3 pr-1.5 shadow-sm">
        {/* A separator takes no name from its words, so it is named with them exactly, for a person who says what they see. */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="horizontal"
          aria-label="Pull to make taller"
          aria-controls={sheetId}
          aria-valuemin={SHEET_MIN}
          aria-valuemax={SHEET_MAX}
          aria-valuenow={height}
          aria-valuetext={`${height} pixels tall`}
          onKeyDown={onPullKey}
          onClick={onPullClick}
          onPointerDown={onPullDown}
          onPointerMove={onPullMove}
          onPointerUp={onPullUp}
          onPointerCancel={onPullUp}
          className="col-start-2 flex min-h-11 cursor-ns-resize touch-none select-none items-center gap-3 rounded-md px-2 text-sm font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
        >
          <i className="hidden h-[5px] w-14 rounded-full bg-muted-foreground sm:block" aria-hidden="true" />
          Pull to make taller
          <i className="hidden h-[5px] w-14 rounded-full bg-muted-foreground sm:block" aria-hidden="true" />
        </div>
        <button
          ref={sizeButton}
          type="button"
          onClick={() => onBiggerChange(!bigger)}
          className="col-start-3 inline-flex min-h-11 items-center gap-2 justify-self-end rounded-lg border border-ink/40 bg-background px-3 text-[14.5px] font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
        >
          {bigger ? <Shrink className={icon} aria-hidden="true" /> : <Expand className={icon} aria-hidden="true" />}
          {bigger ? 'Make smaller' : 'Make bigger'}
        </button>
      </div>
    </div>
  )
}
