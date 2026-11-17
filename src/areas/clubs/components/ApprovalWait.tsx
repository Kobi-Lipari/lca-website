// src/areas/clubs/components/ApprovalWait.tsx
//
// The LCA admins' wait for a regional representative's club event (WS09
// step 19), drawn by the event's manage page under the heading "LCA
// approval" and, in a row for each event in review, by the admin club page's
// Tournaments tab, where the row's own heading names the event and the panel
// draws no heading and no box of its own (inRow), and each button's name
// carries the event's. One line gives the wait's state in words (a draft not
// yet sent, sent for review with its day, or approved with its day), read
// through approvalState from the event's own columns, never by a colour.
// Beside it, only the moves the server says this person may make (the manage
// answer's `approval`, or for an LCA admin on the admin club page the same
// rule): Submit for LCA review from a draft, for a person who cannot decide,
// and for an LCA admin Approve and publish from a draft or in review and Ask
// for changes in review. The page works no permission out itself.
//
// Each move goes through POST /api/admin/tournaments/[id]/approval. After a
// move the caller redraws from the answer's four columns, and the polite
// status line says what happened in the answer's own email sentence, as it
// comes, and takes the focus, since the button pressed may be gone. A press
// that fails changes nothing, says so with the server's own words or, for a
// dropped connection, the words My region uses, and keeps the focus on the
// button. A 409 (already approved, not in review, changed a moment ago)
// keeps the status line's words, moves the focus to the status line, since
// the redraw may take away the button pressed, and asks the caller, through
// onStale, to read the event again, so the panel redraws to what is true.
// Ask for changes opens a small form: one labelled field for the
// note, its error in the server's words tied to the field, Send and Cancel;
// the focus moves into the field as it opens and back to Ask for changes on
// Cancel. With `help`, a Help button holds every sentence that explains the
// wait, opening by itself once on a person's first visit
// (src/areas/clubs/approval.ts keeps that). Every control is at least 44px
// tall, and no gold is used as text.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { CircleHelp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { moveTournamentApproval } from '@/lib/api'
import { errorWords } from '@/areas/clubs/region'
import { ApiError } from '@/lib/http'
import { rememberWaitHelpShown, waitHelpShownBefore, WAIT_HELP_ID } from '@/areas/clubs/approval'
import { approvalState } from '@domain/events/approval'
import { waitWords } from '@domain/events/approvalWords'
import type { TournamentApprovalRequest, TournamentApprovalResponse } from '@domain/contracts'

/** The event as the wait reads it. */
export interface WaitingEvent {
  id: string
  name: string
  needs_lca_approval: number
  approval_requested_at: string | null
  approved_at: string | null
}

/** A control of the panel: 44px tall, its words wrapping on a narrow screen. */
const CONTROL = 'min-h-11 px-4 whitespace-normal'

/** Help's buttons, as My region's Help draws its own. */
const OPENER =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

/** What each move says while it is on the way. */
const ON_THE_WAY: Record<TournamentApprovalRequest['action'], string> = {
  submit: 'Sending for LCA review…',
  approve: 'Approving and publishing…',
  ask_changes: 'Sending your note…',
}

/** Every sentence that explains the wait, behind Help. */
const HELP: Array<[string, string]> = [
  ['What LCA approval is', 'A club event a regional representative creates is not public until an LCA admin approves it. Until then only the people who run the event see it.'],
  ['Submit for LCA review', 'Sends the event to the LCA admins by email. You can keep changing it while it waits.'],
  ['Who approves', 'An LCA admin. They approve and publish it, which lists it on the site, or ask for changes with a note, which reaches the person who drafted it by email.'],
  ['Ask for changes', 'Sends the event back as a draft with your note. Once the changes are made it is submitted again.'],
  ['Entry fees', 'These events run at $0. Entry fees need a payout account first.'],
]

function WaitHelp({ open, onClose, ref }: { open: boolean; onClose: () => void; ref?: Ref<HTMLElement> }) {
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }
  return (
    <section
      ref={ref}
      id={WAIT_HELP_ID}
      hidden={!open}
      tabIndex={-1}
      aria-labelledby={`${WAIT_HELP_ID}-title`}
      onKeyDown={onKeyDown}
      className="space-y-3 rounded-lg border border-hairline bg-background p-4 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      <h3 id={`${WAIT_HELP_ID}-title`} className="text-base font-semibold">Help</h3>
      <dl className="space-y-3">
        {HELP.map(([term, text]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="break-words text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={OPENER} onClick={onClose}>Close help</button>
    </section>
  )
}

export function ApprovalWait({ event, maySubmit, mayDecide, onMoved, onStale, help = false, headingLevel = 2, inRow = false }: {
  event: WaitingEvent
  /** The server lets this person submit the event (the drafter in their region, or an LCA admin). */
  maySubmit: boolean
  /** The server lets this person approve it or ask for changes (an LCA admin). */
  mayDecide: boolean
  /** The move went through: the caller redraws the event from the answer's four columns. */
  onMoved: (answer: TournamentApprovalResponse) => void
  /** The server answered 409, so the event is not as the page drew it: the caller reads it again. */
  onStale?: () => void
  /** Draw the Help button and the part it opens: on the manage page. */
  help?: boolean
  /** The panel's heading level: 2 on the manage page. */
  headingLevel?: 2 | 3 | 4
  /** In a row whose own heading names the event: no heading and no box, and each button's name carries the event's. */
  inRow?: boolean
}) {
  const state = approvalState(event)
  const ids = useId()
  const noteId = `${ids}-note`
  const noteErrorId = `${ids}-note-error`
  const [busy, setBusy] = useState<TournamentApprovalRequest['action'] | null>(null)
  const [said, setSaid] = useState('')
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  const statusLine = useRef<HTMLParagraphElement>(null)
  const askButton = useRef<HTMLButtonElement>(null)
  const noteField = useRef<HTMLTextAreaElement>(null)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  // Where the focus goes once the press has been drawn: the status line after
  // a move, the note's field as the form opens, Ask for changes on Cancel.
  const focusNext = useRef<'status' | 'note' | 'ask' | null>(null)
  const [drawn, setDrawn] = useState(0)
  useEffect(() => {
    const to = focusNext.current
    focusNext.current = null
    if (to === 'status') statusLine.current?.focus()
    else if (to === 'note') noteField.current?.focus()
    else if (to === 'ask') askButton.current?.focus()
  }, [drawn])
  const moveFocus = (to: 'status' | 'note' | 'ask') => {
    focusNext.current = to
    setDrawn((n) => n + 1)
  }

  // Help opens by itself once, on the first visit; the focus moves into it only when its button opens it.
  const [helpOpen, setHelpOpen] = useState(() => help && !waitHelpShownBefore())
  const helpButton = useRef<HTMLButtonElement>(null)
  const helpPanel = useRef<HTMLElement>(null)
  const helpFocus = useRef<'panel' | 'button' | null>(null)
  useEffect(() => {
    if (helpOpen) rememberWaitHelpShown()
  }, [helpOpen])
  useEffect(() => {
    if (helpFocus.current === 'panel' && helpOpen) helpPanel.current?.focus()
    else if (helpFocus.current === 'button' && !helpOpen) helpButton.current?.focus()
    helpFocus.current = null
  }, [helpOpen])

  if (state === 'not_marked') return null

  async function move(body: TournamentApprovalRequest) {
    if (busy) return
    setBusy(body.action)
    setSaid(ON_THE_WAY[body.action])
    setNoteError(null)
    try {
      const answer = await moveTournamentApproval(event.id, body)
      if (!live.current) return
      if (body.action === 'ask_changes') {
        setAsking(false)
        setNote('')
      }
      onMoved(answer)
      setSaid(answer.email)
      moveFocus('status')
    } catch (err) {
      if (!live.current) return
      const fieldWords = (err as { noteError?: unknown } | null)?.noteError
      if (body.action === 'ask_changes' && typeof fieldWords === 'string') {
        setNoteError(fieldWords)
        setSaid(`Nothing was sent: ${fieldWords}`)
        moveFocus('note')
      } else {
        setSaid(`Nothing changed: ${errorWords(err)}`)
        // The event is not where the page drew it: the caller reads it again, and the words stay.
        // The redraw may take away the button pressed, so the focus goes to the status line first.
        if (err instanceof ApiError && err.status === 409) {
          moveFocus('status')
          onStale?.()
        }
      }
    } finally {
      if (live.current) setBusy(null)
    }
  }

  function sendNote(e: FormEvent) {
    e.preventDefault()
    void move({ action: 'ask_changes', note })
  }

  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'h4'
  // Submit is drawn only for a person who cannot decide: an LCA admin approves a draft as it stands.
  const showSubmit = state === 'draft' && maySubmit && !mayDecide
  const showApprove = mayDecide && (state === 'draft' || state === 'in_review')
  const showAsk = mayDecide && state === 'in_review'
  const pressed = (action: TournamentApprovalRequest['action']) => (busy === action ? true : undefined)
  /** A button's name in a row: its own words and the event's, as the Events list names its buttons. */
  const named = (words: string) => (inRow ? `${words}: ${event.name}` : undefined)

  // One line at every width: the heading at the left, Help at the right, their middles level, Help 44px tall.
  const heading = (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <Heading id={`${ids}-title`} className="min-w-0 break-words text-base font-semibold">LCA approval</Heading>
      {help && (
        <button
          ref={helpButton}
          type="button"
          className={`${OPENER} shrink-0`}
          aria-expanded={helpOpen}
          aria-controls={WAIT_HELP_ID}
          onClick={() => { helpFocus.current = helpOpen ? 'button' : 'panel'; setHelpOpen(!helpOpen) }}
        >
          <CircleHelp className="size-4" aria-hidden="true" /> Help
        </button>
      )}
    </div>
  )

  const content = (
    <>
      <p className="break-words">{waitWords(event)}</p>
      {help && <WaitHelp ref={helpPanel} open={helpOpen} onClose={() => { helpFocus.current = 'button'; setHelpOpen(false) }} />}

      {(showSubmit || showApprove || showAsk) && (
        <div className="flex flex-wrap gap-2">
          {showSubmit && (
            <Button type="button" className={CONTROL} aria-label={named('Submit for LCA review')} aria-disabled={!!busy || undefined} aria-busy={pressed('submit')} onClick={() => { void move({ action: 'submit' }) }}>
              Submit for LCA review
            </Button>
          )}
          {showApprove && (
            <Button type="button" className={CONTROL} aria-label={named('Approve and publish')} aria-disabled={!!busy || undefined} aria-busy={pressed('approve')} onClick={() => { void move({ action: 'approve' }) }}>
              Approve and publish
            </Button>
          )}
          {showAsk && (
            <Button
              ref={askButton}
              type="button"
              variant="outline"
              className={CONTROL}
              aria-label={named('Ask for changes')}
              aria-expanded={asking}
              aria-disabled={!!busy || undefined}
              onClick={() => {
                if (busy || asking) return
                setAsking(true)
                setNoteError(null)
                moveFocus('note')
              }}
            >
              Ask for changes
            </Button>
          )}
        </div>
      )}

      {showAsk && asking && (
        <form onSubmit={sendNote} noValidate className="space-y-2" aria-label={`Ask for changes: ${event.name}`}>
          <label htmlFor={noteId} className="block font-medium">What needs to change (500 characters at most)</label>
          <textarea
            ref={noteField}
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-required="true"
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? noteErrorId : undefined}
            rows={4}
            className="block min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
          />
          {noteError && <p id={noteErrorId} className="break-words font-medium text-destructive">{noteError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className={CONTROL} aria-disabled={!!busy || undefined}>Send</Button>
            <Button
              type="button"
              variant="outline"
              className={CONTROL}
              onClick={() => {
                setAsking(false)
                setNote('')
                setNoteError(null)
                moveFocus('ask')
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <p ref={statusLine} role="status" tabIndex={-1} className="min-w-0 break-words outline-none focus-visible:ring-3 focus-visible:ring-focus">{said}</p>
    </>
  )

  // In a row, the row's own heading names the event: no second heading and no inner box.
  if (inRow) return <div className="min-w-0 space-y-3 text-sm text-ink">{content}</div>

  return (
    <section aria-labelledby={`${ids}-title`} className="min-w-0 space-y-3 rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
      {heading}
      {content}
    </section>
  )
}
