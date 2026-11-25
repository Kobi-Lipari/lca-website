// src/areas/clubs/components/ContactRelayForm.tsx
//
// The club page's Contact section and its form (WS09 step 26, D29: relayed,
// never shown, never stored). A visitor writes to the club without seeing
// any address: the form sends the message to POST /api/clubs/:address/contact
// (sendClubMessage), and the server relays it by email to the club's own
// address, else to its region's representative, else to LCA.
//
// Above the fields, one line says where the message goes, since that is what
// a person must know before sending: to the club's contact, to the region's
// representative (named by the region alone), or to LCA. It never names a
// volunteer and never shows an address: the page's answer carries only which
// of the three it is (contact.goes_to). How an answer comes back and why the
// address is private sit behind Help, never beside a control.
//
// Three fields with visible labels and the browser's own autocomplete for a
// name and an address, the spam check, and Send message. The spam check and
// the form's status are drawn once the visitor first moves into the form,
// so the provider's script is loaded when the form is used and never for
// every visit to a club's page, as step 25 built it to be. Each field is
// checked by the rules the server holds (domain/clubs/contactMessage.ts), and
// an error is said in words beside its field, tied to it for a screen reader,
// with the focus moved to the first field that needs a change. While the
// message is sent the button says so and a second press does nothing; once
// sent the form gives way to "Sent." with the focus on it, the fields are
// emptied, and only Write another message brings back an empty form, so the
// same message is never sent twice by accident. A refusal is said once, in
// the form's one status: the limit's words, the spam check's, or "We
// couldn't send this. Try again later." The status stands above Send
// message, so the words are in sight wherever the button a person pressed
// is, never below it under the phone bar; when a refusal fills it and any
// part of it is out of the window or under a bar, the page moves by the
// least that shows it, and the focus stays on the button; the words under the
// spam check, when a person sends before it has finished, are brought into
// sight the same way and said by a status of their own, so a screen reader
// hears them too. After any refusal the spam check is drawn afresh for a
// new token, since a token is good once. Nothing the visitor typed is kept in
// the browser's storage.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'

import { ApiError, sendClubMessage } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CLEAR_OF_BARS, CONTACT_HEADING_ID, CONTROL, bringClearOfBars, keepFocusClearOfBars } from '@/areas/clubs/clubPage'
import { SpamCheck } from '@/areas/clubs/components/SpamCheck'
import { CONTACT_HEADING } from '@domain/clubs/pageWords'
import {
  CONTACT_NOT_SENT, CONTACT_SENT, contactFieldError, contactGoesLine, type ContactField, type ContactGoesTo,
} from '@domain/clubs/contactMessage'

/** The words when the spam check has handed back no token yet. */
const SPAM_CHECK_WAIT = 'Wait for the spam check to finish, then send.'
/** The words when the server's spam check said no. */
const SPAM_CHECK_FAILED = 'The spam check didn\'t pass. Try it again, then send.'
/** The words when no answer came at all. */
const NO_CONNECTION = 'We couldn\'t send this. Check your connection, then try again.'

/** A box of one line: 44 pixels tall, its border in the error's colour beside the error's words. */
const LINE = 'min-h-11 aria-invalid:border-destructive'

/** A box of several lines, drawn as the one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive md:text-sm'

/** The room every field keeps above it for the sticky section nav and the header, as the page's own controls keep. */
const FIELDS_CLEAR_OF_BARS = '[&_:is(input,textarea)]:scroll-mt-[calc(3.5rem_+_var(--header-h,4.0625rem)_-_var(--header-h,0px))]'

type Values = Record<ContactField, string>
type Errors = Partial<Record<ContactField | 'token', string>>

const EMPTY: Values = { name: '', email: '', message: '' }
const FIELDS: readonly ContactField[] = ['name', 'email', 'message']

/**
 * The words the server's spam check refuses with (CANT_SEND_NOW in
 * functions/utils/rateLimit.ts, which the page cannot import). A 403 that
 * carries them is the spam check's no; test/unit/contact-relay-form-edges.test.tsx
 * sends a 403 with the server's own constant, so the two copies cannot part.
 */
const SPAM_CHECK_REFUSAL = 'We can\'t send this right now.'

/**
 * The server's own words in a refusal, or null when it gave none: an answer
 * with no JSON in it (an HTML page from the platform's edge) leaves only the
 * fetch helper's "Request failed (503)", which is not words for a visitor.
 */
function ownWords(err: ApiError): string | null {
  const text = err.message.trim()
  return text === '' || text === `Request failed (${err.status})` ? null : text
}

/** The words of a refusal, by the status the server answered with and the words it gave. */
function refusalWords(err: unknown): string {
  if (!(err instanceof ApiError)) return NO_CONNECTION
  const own = ownWords(err)
  // A 403 is the spam check's no only when it carries the spam check's words; the
  // endpoint's switched-off answer is a 403 too, and is told in its own words.
  if (err.status === 403) return own === SPAM_CHECK_REFUSAL ? SPAM_CHECK_FAILED : (own ?? CONTACT_NOT_SENT)
  if (err.status === 429 || err.status === 503 || err.status === 404) return own ?? CONTACT_NOT_SENT
  return CONTACT_NOT_SENT
}

/** What Help says, for the place the message goes. */
function helpWords(goesTo: ContactGoesTo, region: string | null): string[] {
  const who = goesTo === 'club'
    ? 'The club\'s contact'
    : goesTo === 'region'
      ? (region?.trim() ? `The ${region.trim()} representative` : 'The region\'s representative')
      : 'Someone at LCA'
  return [
    `${who} answers by email, to the address you give here.`,
    'The club\'s address is not shown on its page, so it gets no spam. Your message is sent by email and the site keeps no copy of it, your name or your address.',
  ]
}

/**
 * The Contact section: its heading, the line saying where the message goes, Help and the form. Beside the heading
 * the page puts Suggest an update (WS09 step 28), one of the sheet's two ways in (`suggest`).
 */
export function ClubContact({
  id, address, region, goesTo, suggest,
}: {
  /** The section's id, for the section nav. */
  id: string
  /** The club's address part: its slug, or its id while it has none. */
  address: string
  region: string | null
  goesTo: ContactGoesTo
  /** Suggest an update, beside the heading; the page passes it. */
  suggest?: ReactNode
}) {
  const heading = (
    <h2
      id={CONTACT_HEADING_ID}
      tabIndex={-1}
      className="flex items-center gap-2.5 break-words rounded-sm text-2xl font-bold tracking-tight text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      <span aria-hidden="true" className="h-6 w-1.5 shrink-0 rounded-full bg-ink" />
      {CONTACT_HEADING}
    </h2>
  )
  return (
    <section id={id} aria-labelledby={CONTACT_HEADING_ID} className={cn(CLEAR_OF_BARS, 'py-8')}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {suggest ? (
          <div className="flex max-w-2xl flex-wrap items-center justify-between gap-x-4">
            {heading}
            {suggest}
          </div>
        ) : heading}
        <ContactRelayForm address={address} region={region} goesTo={goesTo} />
      </div>
    </section>
  )
}

export function ContactRelayForm({ address, region, goesTo }: { address: string; region: string | null; goesTo: ContactGoesTo }) {
  // One form on a page, so its ids are fixed: the same markup for every club and every draw.
  const uid = 'club-contact'
  const idOf = (part: ContactField | 'line' | 'help' | 'status') => `${uid}-${part}`
  const [values, setValues] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Errors>({})
  const [token, setToken] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [refusal, setRefusal] = useState('')
  // How many times a press of Send message has been answered with why it did not send (a refusal, or the wait
  // for the spam check): each answer, the same words again among them, is brought into sight.
  const [answered, setAnswered] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)
  // The visitor has moved into the form: only then are the spam check and the form's status drawn.
  const [engaged, setEngaged] = useState(false)
  // A second press while the first send runs does nothing, before React has drawn the button's new words.
  const busy = useRef(false)
  const sentLine = useRef<HTMLParagraphElement>(null)
  const statusLine = useRef<HTMLParagraphElement>(null)
  const tokenLine = useRef<HTMLParagraphElement>(null)
  const sendButton = useRef<HTMLButtonElement>(null)
  const helpButton = useRef<HTMLButtonElement>(null)
  const helpPart = useRef<HTMLDivElement>(null)
  const fieldRefs = useRef<Partial<Record<ContactField, HTMLInputElement | HTMLTextAreaElement | null>>>({})
  // Where the focus goes once the next draw is on the page: Sent., the first field, or Help's part.
  const focusNext = useRef<'sent' | 'name' | 'help' | null>(null)
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    if (target === 'sent') sentLine.current?.focus()
    else if (target === 'name') fieldRefs.current.name?.focus()
    else helpPart.current?.focus()
  })
  // The words of why a press did not send, the status's or those under the spam check, push Send message down
  // by their height: the button, when it has the focus, is kept clear of the bars first, then the words are
  // brought into sight, so both are seen and the focus stays where it is.
  useEffect(() => {
    const words = [statusLine.current, tokenLine.current].find((line) => line?.textContent)
    if (answered === 0 || !words) return
    const button = sendButton.current
    if (button && button.ownerDocument.activeElement === button) keepFocusClearOfBars(button)
    bringClearOfBars(words)
  }, [answered])

  const change = (field: ContactField, value: string) => {
    setValues((v) => ({ ...v, [field]: value }))
    // An error goes once the field is changed; it is checked again at the next send.
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current) return
    setEngaged(true)
    const found: Errors = {}
    for (const field of FIELDS) {
      const error = contactFieldError(field, values[field])
      if (error) found[field] = error
    }
    if (!token && Object.keys(found).length === 0) found.token = SPAM_CHECK_WAIT
    setErrors(found)
    setRefusal('')
    const first = FIELDS.find((field) => found[field])
    if (first) {
      fieldRefs.current[first]?.focus()
      return
    }
    if (found.token || !token) {
      setAnswered((n) => n + 1)
      return
    }

    busy.current = true
    setSending(true)
    try {
      await sendClubMessage(address, { name: values.name.trim(), email: values.email.trim(), message: values.message.trim(), token })
      setValues(EMPTY)
      setToken(null)
      // Drawn in the next render: the focus moves to it once it is on the page.
      focusNext.current = 'sent'
      setSent(true)
    } catch (err) {
      setRefusal(refusalWords(err))
      setAnswered((n) => n + 1)
      // A token is good once: the spam check is drawn afresh for the next try.
      setToken(null)
      setRefresh((n) => n + 1)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  function writeAnother() {
    setSent(false)
    setRefusal('')
    setErrors({})
    setRefresh((n) => n + 1)
    focusNext.current = 'name'
  }

  function closeHelp() {
    setHelpOpen(false)
    helpButton.current?.focus()
  }

  function toggleHelp() {
    if (helpOpen) {
      closeHelp()
      return
    }
    focusNext.current = 'help'
    setHelpOpen(true)
  }

  function helpKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    closeHelp()
  }

  const errorOf = (field: ContactField | 'token') => `${uid}-${field}-error`
  const describedBy = (field: ContactField | 'token') => (errors[field] ? errorOf(field) : undefined)

  return (
    <div className="mt-3 max-w-2xl space-y-4" onFocus={(e) => keepFocusClearOfBars(e.target)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p id={idOf('line')} className="min-w-0 flex-1 break-words text-base text-ink">{contactGoesLine(goesTo, region)}</p>
        <button
          ref={helpButton}
          type="button"
          aria-expanded={helpOpen}
          aria-controls={idOf('help')}
          onClick={toggleHelp}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus"
        >
          <CircleHelp aria-hidden="true" className="size-4" /> Help
        </button>
      </div>
      <div
        ref={helpPart}
        id={idOf('help')}
        hidden={!helpOpen}
        tabIndex={-1}
        role="region"
        aria-label="Help with Contact"
        onKeyDown={helpKey}
        className="space-y-2 rounded-lg border border-hairline bg-surface p-4 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
      >
        {helpWords(goesTo, region).map((words) => <p key={words}>{words}</p>)}
        <button type="button" onClick={closeHelp} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus">
          Close help
        </button>
      </div>

      {sent ? (
        <div className="space-y-3">
          <p ref={sentLine} tabIndex={-1} data-slot="contact-sent" className="rounded-sm text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
            {CONTACT_SENT}
          </p>
          <button type="button" onClick={writeAnother} className={cn(CONTROL, 'border border-field bg-surface text-ink hover:bg-surface-2')}>
            Write another message
          </button>
        </div>
      ) : (
        <form noValidate onSubmit={(e) => { void submit(e) }} onFocus={() => setEngaged(true)} aria-describedby={idOf('line')} className={cn(FIELDS_CLEAR_OF_BARS, 'space-y-4')}>
          <div className="space-y-1.5">
            <Label htmlFor={idOf('name')}>Your name</Label>
            <Input
              ref={(el) => { fieldRefs.current.name = el }}
              id={idOf('name')}
              name="name"
              autoComplete="name"
              value={values.name}
              readOnly={sending || undefined}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={describedBy('name')}
              className={LINE}
              onChange={(e) => change('name', e.target.value)}
            />
            {errors.name && <FieldError id={errorOf('name')} words={errors.name} />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={idOf('email')}>Your email</Label>
            <Input
              ref={(el) => { fieldRefs.current.email = el }}
              id={idOf('email')}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={values.email}
              readOnly={sending || undefined}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={describedBy('email')}
              className={LINE}
              onChange={(e) => change('email', e.target.value)}
            />
            {errors.email && <FieldError id={errorOf('email')} words={errors.email} />}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={idOf('message')}>Message</Label>
            <textarea
              ref={(el) => { fieldRefs.current.message = el }}
              id={idOf('message')}
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
          {engaged && (
            <div>
              <SpamCheck onToken={(t) => { setToken(t); if (t) setErrors((e) => ({ ...e, token: undefined })) }} refresh={refresh} />
              {/* A status of its own, in the page with the spam check: the words come with no field to take the focus, so a
                  screen reader hears them when a press brings them, as a sighted person sees them. Empty, it takes no room. */}
              <p ref={tokenLine} id={errorOf('token')} role="status" className={cn('text-sm font-semibold text-destructive', errors.token && 'mt-1.5')}>
                {errors.token}
              </p>
            </div>
          )}
          <div>
            {/* In the page from the moment the form is used, before any send, so a screen reader hears a refusal once, when it comes.
                Above Send message, so the words are in sight wherever the button is; empty, it takes no room. */}
            {engaged && (
              <p ref={statusLine} id={idOf('status')} role="status" className={cn('break-words text-sm font-semibold text-ink', refusal && 'mb-2')}>
                {refusal}
              </p>
            )}
            <button
              ref={sendButton}
              type="submit"
              aria-disabled={sending || undefined}
              aria-describedby={describedBy('token')}
              className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-80')}
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/** An error beside its field, in words, which the field names as its description. */
function FieldError({ id, words }: { id: string; words: string }) {
  return <p id={id} className="text-sm font-semibold text-destructive">{words}</p>
}
