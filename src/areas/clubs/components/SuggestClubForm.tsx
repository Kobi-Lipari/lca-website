// src/areas/clubs/components/SuggestClubForm.tsx
//
// Suggest a club and Start a club (WS09 step 30): one form with a switch, as
// the frame Clubs-H-2 draws it, on the page at /clubs/suggest
// (src/pages/SuggestClubPage.tsx). The switch is two of the site's own filter
// chips in a group (src/components/ui/filter-chip.tsx), the control the
// Suggest an update sheet uses for its one choice of six: each tells its
// state by aria-pressed and by a check mark, never by colour alone, and
// exactly one is pressed. The page keeps which is chosen in its address, so
// a link can open either, and its heading and the document's title follow.
//
// The fields, in the frame's words: Club name, City or ZIP, where and when in
// the person's words, Your name and "Your email (stays private)", then the
// spam check as the sheet draws it and "Send to LCA". Every field has a
// visible label. Each is checked by the rules the server holds
// (domain/clubs/newClub.ts), an error said in words beside its field and the
// focus moved to the first that needs a change. A refusal from the server is
// said once, in the form's one status, above the send button; a refusal
// keeps everything typed, and the spam check is drawn afresh for a new token.
// While it is sent the button says so and a second press does nothing.
// Once sent the form gives way to one sentence, true wherever it went, with
// the focus on it; opened on the other side after that, by a link, the form
// is drawn again, empty, since the sentence is the sent side's alone. Nothing
// typed is kept in the browser's storage.
//
// The page names no region, no seat and no person (K's decision 12 of
// Tuesday, November 17, 2026): who keeps what is not for the public. No
// explaining sentence stands beside a control; the one mark, beside the
// switch, says what each side is for (K's decision 16).
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError, sendClubRequest } from '@/lib/api'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CONTROL } from '@/areas/clubs/clubPage'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { SpamCheck } from '@/areas/clubs/components/SpamCheck'
import { SWITCH_HELP } from '@/areas/clubs/suggestClub'
import {
  CLUB_REQUEST_KINDS, CLUB_REQUEST_LABELS, CLUB_REQUEST_NOT_SENT, CLUB_REQUEST_SEND, CLUB_REQUEST_SENT, CLUB_REQUEST_TITLES, clubRequestFieldError,
  type ClubRequestField, type ClubRequestKind,
} from '@domain/clubs/newClub'

/** The words when the spam check has handed back no token yet. */
const SPAM_CHECK_WAIT = 'Wait for the spam check to finish, then send.'
/** The words when the server's spam check said no. */
const SPAM_CHECK_FAILED = 'The spam check didn\'t pass. Try it again, then send.'
/** The words when no answer came at all. */
const NO_CONNECTION = 'We couldn\'t send this. Check your connection, then try again.'
/** The words the server's spam check refuses with (CANT_SEND_NOW in functions/utils/rateLimit.ts). */
const SPAM_CHECK_REFUSAL = 'We can\'t send this right now.'

/** A box of several lines, drawn as the one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive md:text-sm'

/** The fields in the order the form draws them, and the order the focus looks for the first that needs a change. */
const FIELDS: readonly ClubRequestField[] = ['clubName', 'place', 'message', 'name', 'email']

type Values = Record<ClubRequestField, string>
type Errors = Partial<Record<ClubRequestField | 'token', string>>

const EMPTY: Values = { clubName: '', place: '', message: '', name: '', email: '' }

/** The server's own words in a refusal, or null when it gave none. */
function ownWords(err: ApiError): string | null {
  const text = err.message.trim()
  return text === '' || text === `Request failed (${err.status})` ? null : text
}

/** The words of a refusal, by the status the server answered with and the words it gave. */
function refusalWords(err: unknown): string {
  if (!(err instanceof ApiError)) return NO_CONNECTION
  const own = ownWords(err)
  if (err.status === 403) return own === SPAM_CHECK_REFUSAL ? SPAM_CHECK_FAILED : (own ?? CLUB_REQUEST_NOT_SENT)
  if (err.status === 429 || err.status === 503) return own ?? CLUB_REQUEST_NOT_SENT
  return CLUB_REQUEST_NOT_SENT
}

export function SuggestClubForm({ kind, onKind }: {
  kind: ClubRequestKind
  /** The switch was pressed: the page moves its address to the side chosen. */
  onKind: (kind: ClubRequestKind) => void
}) {
  const uid = 'suggest-club'
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [token, setToken] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<ClubRequestKind | null>(null)
  const [refusal, setRefusal] = useState('')
  // The sentence is the sent side's alone: opened on the other side, the form is drawn again, empty.
  if (sent && sent !== kind) setSent(null)
  const busy = useRef(false)
  const boxes = useRef<Partial<Record<ClubRequestField, HTMLInputElement | HTMLTextAreaElement | null>>>({})
  const sentLine = useRef<HTMLParagraphElement>(null)
  const focusNext = useRef<'sent' | null>(null)
  useEffect(() => {
    if (focusNext.current === 'sent') {
      focusNext.current = null
      sentLine.current?.focus()
    }
  })

  function change(field: ClubRequestField, value: string) {
    setValues((now) => ({ ...now, [field]: value }))
    if (errors[field]) setErrors((now) => ({ ...now, [field]: undefined }))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    const found: Errors = {}
    for (const field of FIELDS) {
      const error = clubRequestFieldError(field, values[field])
      if (error) found[field] = error
    }
    if (!token && Object.keys(found).length === 0) found.token = SPAM_CHECK_WAIT
    setErrors(found)
    setRefusal('')
    const first = FIELDS.find((field) => found[field])
    if (first) {
      boxes.current[first]?.focus()
      return
    }
    if (found.token || !token) return

    busy.current = true
    setSending(true)
    try {
      await sendClubRequest({
        kind,
        clubName: values.clubName.trim(),
        place: values.place.trim(),
        message: values.message.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
        token,
      })
      setValues(EMPTY)
      setToken(null)
      focusNext.current = 'sent'
      setSent(kind)
    } catch (err) {
      // What was typed stays; a token is good once, so the spam check is drawn afresh for the next try.
      setRefusal(refusalWords(err))
      setToken(null)
      setRefresh((n) => n + 1)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  const errorOf = (part: ClubRequestField | 'token') => `${uid}-${part}-error`
  const describedBy = (part: ClubRequestField | 'token') => (errors[part] ? errorOf(part) : undefined)

  if (sent) {
    return (
      <p ref={sentLine} tabIndex={-1} data-slot="suggest-club-sent" className="rounded-sm text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
        {CLUB_REQUEST_SENT[sent]}
      </p>
    )
  }

  /** One field of one line, with its label above it and its error under it. */
  const line = (field: Exclude<ClubRequestField, 'message'>, label: string, extra: { type?: string; autoComplete?: string; inputMode?: 'email' } = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${uid}-${field}`}>{label}</Label>
      <Input
        ref={(el) => { boxes.current[field] = el }}
        id={`${uid}-${field}`}
        name={field}
        type={extra.type ?? 'text'}
        inputMode={extra.inputMode}
        autoComplete={extra.autoComplete ?? 'off'}
        spellCheck={field === 'email' ? false : undefined}
        value={values[field]}
        readOnly={sending || undefined}
        aria-invalid={errors[field] ? true : undefined}
        aria-describedby={describedBy(field)}
        className="min-h-11 aria-invalid:border-destructive"
        onChange={(e) => change(field, e.target.value)}
      />
      {errors[field] && <FieldError id={errorOf(field)} words={errors[field]} />}
    </div>
  )

  return (
    <form noValidate onSubmit={(e) => { void submit(e) }} className="space-y-5">
      <div className="relative">
        <div role="group" aria-labelledby={`${uid}-switch-label`} className="space-y-2">
          <div className="flex items-baseline">
            <span id={`${uid}-switch-label`} className="text-sm font-medium text-ink">I&apos;d like to</span>
            <HelpMark name="Suggest a club or start one" entries={SWITCH_HELP} tight />
          </div>
          <div className="flex flex-wrap gap-2">
            {CLUB_REQUEST_KINDS.map((side) => (
              <FilterChip
                key={side}
                label={CLUB_REQUEST_TITLES[side]}
                pressed={kind === side}
                // A press always chooses: exactly one side is pressed.
                onPressedChange={() => { if (kind !== side) onKind(side) }}
                className="h-auto min-h-11 whitespace-normal"
              />
            ))}
          </div>
        </div>
      </div>

      {line('clubName', CLUB_REQUEST_LABELS.clubName)}
      {line('place', CLUB_REQUEST_LABELS.place)}

      <div className="space-y-1.5">
        <Label htmlFor={`${uid}-message`}>{CLUB_REQUEST_LABELS.message[kind]}</Label>
        <textarea
          ref={(el) => { boxes.current.message = el }}
          id={`${uid}-message`}
          name="message"
          autoComplete="off"
          value={values.message}
          readOnly={sending || undefined}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={describedBy('message')}
          className={LINES}
          onChange={(e) => change('message', e.target.value)}
        />
        {errors.message && <FieldError id={errorOf('message')} words={errors.message} />}
      </div>

      {line('name', CLUB_REQUEST_LABELS.name, { autoComplete: 'name' })}
      {line('email', CLUB_REQUEST_LABELS.email, { type: 'email', autoComplete: 'email', inputMode: 'email' })}

      <div>
        <SpamCheck onToken={(t) => { setToken(t); if (t) setErrors((now) => ({ ...now, token: undefined })) }} refresh={refresh} />
        <p id={errorOf('token')} role="status" className={cn('text-sm font-semibold text-destructive', errors.token && 'mt-1.5')}>
          {errors.token}
        </p>
      </div>

      <div>
        {/* Above the send button, so a refusal is in sight wherever the button is; empty, it takes no room. */}
        <p role="status" className={cn('break-words text-sm font-semibold text-ink', refusal && 'mb-2')}>{refusal}</p>
        <button
          type="submit"
          aria-disabled={sending || undefined}
          aria-describedby={describedBy('token')}
          className={cn(CONTROL, 'h-auto min-w-0 max-w-full bg-ink py-2 text-left whitespace-normal break-words text-ground hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-80')}
        >
          {sending ? 'Sending…' : CLUB_REQUEST_SEND}
        </button>
      </div>
    </form>
  )
}

/** An error beside its field, in words, which the field names as its description. */
function FieldError({ id, words }: { id: string; words: string }) {
  return <p id={id} className="mt-1.5 text-sm font-semibold text-destructive">{words}</p>
}
