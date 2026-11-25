// src/areas/clubs/components/RepRequestSheet.tsx
//
// Ask to be its named rep (WS09 step 31): the sheet a member fills in on the
// page of a club with no named rep. It is made as the Suggest an update
// sheet is, from the site's own dialog (src/components/ui/dialog.tsx): below
// 768 pixels it rises from the bottom of the window, and from 768 up it
// stands in the middle. It is fetched the first time it is opened, from the
// page's one invitation (RepRequestLink.tsx).
//
// Titled "Ask to be {Club}'s named rep". Signed out, it says one sentence,
// with "Log in to ask", a link to the login page that comes back to this
// club's page, and "Not now", which shuts it. Signed in, "How are you
// connected to the club?" offers the four answers as filter chips, each
// telling its state by aria-pressed and a check mark, none pressed at first
// and exactly one once a person presses one; a send with none is refused in
// words beside the group. Then the optional note with its visible label, and
// "Send request" with one small question mark beside it (K's decision 16).
// A refusal from the server is said once, in the sheet's one status, above
// the button; a second press while sending does nothing. Once sent the form
// gives way to one sentence with the focus on it, naming no person, region
// or seat. While the sheet is open the focus stays inside it; Escape and
// Close shut it, and the page puts the focus back on the invitation. Nothing
// typed is kept in the browser's storage.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { ApiError, sendRepRequest } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FilterChip } from '@/components/ui/filter-chip'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CONTROL } from '@/areas/clubs/clubPage'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import {
  REP_CONNECTIONS, REP_CONNECTION_QUESTION, REP_LOG_IN, REP_NOTE_LABEL, REP_NOT_NOW, REP_REQUEST_HELP, REP_REQUEST_NOT_SENT, REP_REQUEST_SENT, REP_SEND,
  REP_SIGNED_OUT_LINE, repRequestFieldError, repRequestTitle, type RepConnection,
} from '@domain/clubs/repRequest'

/** The words when no answer came at all. */
const NO_CONNECTION = 'We couldn\'t send this. Check your connection, then try again.'

/** A box of several lines, drawn as the one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive md:text-sm'

/** The sheet's box, as the Suggest an update sheet's: along the window's foot below md, the dialog's own box from md up. */
const BOX = cn(
  'max-h-[90dvh] gap-0 overflow-y-auto overflow-x-hidden border-hairline bg-surface p-0 text-ink',
  'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-xl',
  'max-md:data-[state=open]:slide-in-from-left-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=open]:slide-in-from-bottom',
  'max-md:data-[state=closed]:slide-out-to-left-0 max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=closed]:slide-out-to-bottom md:max-w-xl md:rounded-xl',
)

/** The words of a refusal: the server's own when it gave any, else the sheet's. */
function refusalWords(err: unknown): string {
  if (!(err instanceof ApiError)) return NO_CONNECTION
  const own = err.message.trim()
  return own === '' || own === `Request failed (${err.status})` ? REP_REQUEST_NOT_SENT : own
}

export function RepRequestSheet({ open, onClose, clubName, address }: {
  open: boolean
  /** Shuts the sheet; the page puts the focus back on the invitation. */
  onClose: () => void
  clubName: string
  /** The club's address part: its slug, or its id while it has none. */
  address: string
}) {
  const { user } = useAuth()
  const uid = 'rep-request'
  const [connection, setConnection] = useState<RepConnection | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<{ connection?: string; note?: string }>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [refusal, setRefusal] = useState('')
  const busy = useRef(false)
  const firstChip = useRef<HTMLDivElement>(null)
  const noteBox = useRef<HTMLTextAreaElement>(null)
  const sentLine = useRef<HTMLParagraphElement>(null)
  const focusNext = useRef<'sent' | null>(null)
  useEffect(() => {
    if (focusNext.current === 'sent') {
      focusNext.current = null
      sentLine.current?.focus()
    }
  })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    const found: { connection?: string; note?: string } = {}
    const connectionError = repRequestFieldError('connection', connection ?? '')
    if (connectionError) found.connection = connectionError
    const noteError = repRequestFieldError('note', note)
    if (noteError) found.note = noteError
    setErrors(found)
    setRefusal('')
    if (found.connection) {
      firstChip.current?.querySelector<HTMLButtonElement>('button')?.focus()
      return
    }
    if (found.note) {
      noteBox.current?.focus()
      return
    }
    if (!connection) return

    busy.current = true
    setSending(true)
    try {
      await sendRepRequest(address, { connection, note: note.trim() })
      setConnection(null)
      setNote('')
      focusNext.current = 'sent'
      setSent(true)
    } catch (err) {
      // What was chosen and typed stays, for another try.
      setRefusal(refusalWords(err))
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  const describedBy = (part: 'connection' | 'note') => (errors[part] ? `${uid}-${part}-error` : undefined)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className={BOX}
        // The page puts the focus back on the invitation.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative flex items-start justify-between gap-3 border-b border-hairline px-4 pt-4 pb-3 sm:px-6">
          <DialogTitle className="min-w-0 break-words text-xl leading-snug font-bold text-ink">{repRequestTitle(clubName)}</DialogTitle>
          <DialogClose className={cn(CONTROL, '-mr-2 shrink-0 border border-field bg-surface px-3 text-ink hover:bg-surface-2')}>
            Close
          </DialogClose>
        </div>

        <div className="px-4 py-4 sm:px-6">
          {!user ? (
            <div data-slot="rep-request-signed-out" className="space-y-4">
              <p className="break-words text-base text-ink">{REP_SIGNED_OUT_LINE}</p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/login" state={{ from: `/clubs/${address}` }} className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90')}>
                  {REP_LOG_IN}
                </Link>
                <DialogClose className={cn(CONTROL, 'border border-field bg-surface text-ink hover:bg-surface-2')}>{REP_NOT_NOW}</DialogClose>
              </div>
            </div>
          ) : sent ? (
            <p ref={sentLine} tabIndex={-1} data-slot="rep-request-sent" className="rounded-sm text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
              {REP_REQUEST_SENT}
            </p>
          ) : (
            <form noValidate onSubmit={(e) => { void submit(e) }} className="space-y-5">
              <fieldset aria-describedby={describedBy('connection')}>
                <legend className="text-sm font-medium text-ink">{REP_CONNECTION_QUESTION}</legend>
                <div ref={firstChip} className="mt-2 flex flex-wrap gap-2">
                  {REP_CONNECTIONS.map((choice) => (
                    <FilterChip
                      key={choice.key}
                      label={choice.label}
                      pressed={connection === choice.key}
                      // A press always chooses: exactly one is pressed once a person presses any.
                      onPressedChange={() => {
                        setConnection(choice.key)
                        if (errors.connection) setErrors((now) => ({ ...now, connection: undefined }))
                      }}
                      className="h-auto min-h-8 whitespace-normal"
                    />
                  ))}
                </div>
                {errors.connection && <FieldError id={`${uid}-connection-error`} words={errors.connection} />}
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-note`}>{REP_NOTE_LABEL}</Label>
                <textarea
                  ref={noteBox}
                  id={`${uid}-note`}
                  name="note"
                  autoComplete="off"
                  value={note}
                  readOnly={sending || undefined}
                  aria-invalid={errors.note ? true : undefined}
                  aria-describedby={describedBy('note')}
                  className={LINES}
                  onChange={(e) => {
                    setNote(e.target.value)
                    if (errors.note) setErrors((now) => ({ ...now, note: undefined }))
                  }}
                />
                {errors.note && <FieldError id={`${uid}-note-error`} words={errors.note} />}
              </div>

              <div className="relative">
                {/* Above the send button, so a refusal is in sight wherever the button is; empty, it takes no room. */}
                <p role="status" className={cn('break-words text-sm font-semibold text-ink', refusal && 'mb-2')}>{refusal}</p>
                <div className="flex flex-wrap items-center">
                  <button
                    type="submit"
                    aria-disabled={sending || undefined}
                    className={cn(CONTROL, 'h-auto min-w-0 max-w-full bg-ink py-2 text-left whitespace-normal break-words text-ground hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-80')}
                  >
                    {sending ? 'Sending…' : REP_SEND}
                  </button>
                  <HelpMark name="What happens next" entries={[['What happens next', REP_REQUEST_HELP]]} />
                </div>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** An error beside its part, in words, which the part names as its description. */
function FieldError({ id, words }: { id: string; words: string }) {
  return <p id={id} className="mt-1.5 text-sm font-semibold text-destructive">{words}</p>
}
