// src/areas/clubs/components/SuggestUpdateSheet.tsx
//
// Suggest an update (WS09 step 28): the sheet a visitor fills in on a club's
// page to say its listing is out of date. It is made from the site's own
// dialog (src/components/ui/dialog.tsx): below 768 pixels it rises from the
// bottom of the window as a sheet, and from 768 up it stands in the middle
// as a dialog. It is fetched the first time it is opened, from one of the
// page's two places (SuggestUpdateLink.tsx): the "Last checked" line and
// beside Contact.
//
// It is titled "Suggest an update to {Club}". "What changed?" offers six
// choices as filter chips, each telling its state by aria-pressed and by a
// check mark, with the choice said in words under them; none is pressed at
// first and exactly one is once a person presses one. Then a box for what
// changed, "Your email (optional)", the spam check, and the send button,
// worded by where the suggestion goes as the page's answer says it, naming
// nobody: "Send to the club's rep", "Send to the {region}
// representative" or "Send to LCA". The words that explain why an address
// is asked and what happens to a suggestion sit behind two small question
// marks (HelpMark.tsx, K's decision 16), beside the address's label and the
// send button; nothing opens by itself.
//
// While the sheet is open the focus stays inside it; Escape and the visible
// Close button shut it, and the focus goes back to the link that opened it
// (the page passes it back). Each part is checked by the rules the server
// holds (domain/clubs/suggestion.ts), an error said in words beside its part
// and the focus moved to the first part that needs a change. A refusal from
// the server is said once, in the sheet's one status, above the send button,
// so it is in sight wherever the button is; a refusal keeps everything typed,
// and the spam check is drawn afresh for a new token. While the suggestion
// is sent the button says so and a second press does nothing, and Close,
// Escape and a press outside do nothing either, so the person always reads
// how it ended. Once sent the form gives way to the sent words with the focus
// on them. A press of the send button after the spam check has failed, or
// with no site key, says to press Try again, never to wait for the check.
// Nothing typed is kept in the browser's storage.
import { useEffect, useRef, useState, type FormEvent } from 'react'

import { ApiError, sendClubSuggestion } from '@/lib/api'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FilterChip } from '@/components/ui/filter-chip'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CONTROL } from '@/areas/clubs/clubPage'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { SpamCheck } from '@/areas/clubs/components/SpamCheck'
import {
  SUGGESTION_CHOICES, SUGGESTION_NOT_SENT, SUGGESTION_SENT, suggestSendLabel, suggestTitle, suggestionFieldError, suggestionLabel,
  type SuggestionField, type SuggestionGoesTo, type SuggestionPart,
} from '@domain/clubs/suggestion'

/** The words when the spam check has handed back no token yet. */
const SPAM_CHECK_WAIT = 'Wait for the spam check to finish, then send.'
/** The words when the spam check has failed, or has no site key: waiting will not help. */
const SPAM_CHECK_DIDNT_LOAD = 'The spam check didn\'t load, so this can\'t be sent yet. Press Try again.'
/** The words when the server's spam check said no. */
const SPAM_CHECK_FAILED = 'The spam check didn\'t pass. Try it again, then send.'
/** The words when no answer came at all. */
const NO_CONNECTION = 'We couldn\'t send this. Check your connection, then try again.'
/** The words the server's spam check refuses with (CANT_SEND_NOW in functions/utils/rateLimit.ts). */
const SPAM_CHECK_REFUSAL = 'We can\'t send this right now.'

/** Why an address is asked, beside its label. */
export const EMAIL_HELP = 'Only if you would like an answer. Whoever keeps the listing can reply to you from the site, and your address is shown to nobody.'
/** What happens to a suggestion, beside the send button. */
export const SEND_HELP = 'Whoever keeps this club\'s listing reads it and changes the listing if it needs it. Nothing on the page changes until they do.'

/** A box of several lines, drawn as the one-line box is, with the same focus ring. */
const LINES =
  'flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:border-destructive md:text-sm'

/**
 * The sheet's box: below md it lies along the window's foot, the full width,
 * with its top corners rounded, and scrolls inside when it is taller than
 * 90% of the window; from md up it is the dialog's own centred box. The
 * dialog's own small close mark, under the 24-pixel target, is not drawn
 * (hideClose): the sheet has a Close button of its own.
 */
const BOX = cn(
  'max-h-[90dvh] gap-0 overflow-y-auto overflow-x-hidden border-hairline bg-surface p-0 text-ink',
  'max-md:inset-x-0 max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-xl',
  // On a phone it rises straight up from the foot, with none of the centred dialog's sideways slide or zoom.
  'max-md:data-[state=open]:slide-in-from-left-0 max-md:data-[state=open]:zoom-in-100 max-md:data-[state=open]:slide-in-from-bottom',
  'max-md:data-[state=closed]:slide-out-to-left-0 max-md:data-[state=closed]:zoom-out-100 max-md:data-[state=closed]:slide-out-to-bottom md:max-w-xl md:rounded-xl',
)

type Errors = Partial<Record<SuggestionPart | 'token', string>>

/** The server's own words in a refusal, or null when it gave none. */
function ownWords(err: ApiError): string | null {
  const text = err.message.trim()
  return text === '' || text === `Request failed (${err.status})` ? null : text
}

/** The words of a refusal, by the status the server answered with and the words it gave. */
function refusalWords(err: unknown): string {
  if (!(err instanceof ApiError)) return NO_CONNECTION
  const own = ownWords(err)
  if (err.status === 403) return own === SPAM_CHECK_REFUSAL ? SPAM_CHECK_FAILED : (own ?? SUGGESTION_NOT_SENT)
  if (err.status === 429 || err.status === 503 || err.status === 404) return own ?? SUGGESTION_NOT_SENT
  return SUGGESTION_NOT_SENT
}

export function SuggestUpdateSheet({
  open, onClose, clubName, address, goesTo, region,
}: {
  open: boolean
  /** Shuts the sheet; the page puts the focus back on the link that opened it. */
  onClose: () => void
  clubName: string
  /** The club's address part: its slug, or its id while it has none. */
  address: string
  goesTo: SuggestionGoesTo
  region: string | null
}) {
  const uid = 'club-suggest'
  const [field, setField] = useState<SuggestionField | null>(null)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [token, setToken] = useState<string | null>(null)
  // The spam check has failed, or has no site key, until the person presses its Try again.
  const [spamFailed, setSpamFailed] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [refusal, setRefusal] = useState('')
  const busy = useRef(false)
  const firstChip = useRef<HTMLDivElement>(null)
  const messageBox = useRef<HTMLTextAreaElement>(null)
  const emailBox = useRef<HTMLInputElement>(null)
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
    const found: Errors = {}
    const fieldError = suggestionFieldError('field', field ?? '')
    if (fieldError) found.field = fieldError
    const messageError = suggestionFieldError('message', message)
    if (messageError) found.message = messageError
    const emailError = suggestionFieldError('email', email)
    if (emailError) found.email = emailError
    if (!token && Object.keys(found).length === 0) found.token = spamFailed ? SPAM_CHECK_DIDNT_LOAD : SPAM_CHECK_WAIT
    setErrors(found)
    setRefusal('')
    if (found.field) {
      firstChip.current?.querySelector<HTMLButtonElement>('button')?.focus()
      return
    }
    if (found.message) {
      messageBox.current?.focus()
      return
    }
    if (found.email) {
      emailBox.current?.focus()
      return
    }
    if (found.token || !token || !field) return

    busy.current = true
    setSending(true)
    try {
      await sendClubSuggestion(address, { field, message: message.trim(), email: email.trim() || undefined, token })
      setField(null)
      setMessage('')
      setEmail('')
      setToken(null)
      focusNext.current = 'sent'
      setSent(true)
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

  const errorOf = (part: SuggestionPart | 'token') => `${uid}-${part}-error`
  const describedBy = (part: SuggestionPart | 'token') => (errors[part] ? errorOf(part) : undefined)

  return (
    // While a send is on its way, Close, Escape and a press outside do nothing, so the person reads how it ended.
    <Dialog open={open} onOpenChange={(next) => { if (!next && !sending) onClose() }}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className={BOX}
        // The page puts the focus back on the link that opened the sheet.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative flex items-start justify-between gap-3 border-b border-hairline px-4 pt-4 pb-3 sm:px-6">
          <DialogTitle className="min-w-0 break-words text-xl leading-snug font-bold text-ink">{suggestTitle(clubName)}</DialogTitle>
          <DialogClose aria-disabled={sending || undefined} className={cn(CONTROL, '-mr-2 shrink-0 border border-field bg-surface px-3 text-ink hover:bg-surface-2')}>
            Close
          </DialogClose>
        </div>

        <div className="px-4 py-4 sm:px-6">
          {sent ? (
            <p ref={sentLine} tabIndex={-1} data-slot="suggest-sent" className="rounded-sm text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
              {SUGGESTION_SENT}
            </p>
          ) : (
            <form noValidate onSubmit={(e) => { void submit(e) }} className="space-y-5">
              <fieldset aria-describedby={describedBy('field')}>
                <legend className="text-sm font-medium text-ink">What changed?</legend>
                <div ref={firstChip} className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTION_CHOICES.map((choice) => (
                    <FilterChip
                      key={choice.key}
                      label={choice.label}
                      pressed={field === choice.key}
                      // A press always chooses: exactly one is pressed once a person presses any.
                      onPressedChange={() => {
                        setField(choice.key)
                        if (errors.field) setErrors((now) => ({ ...now, field: undefined }))
                      }}
                      className="h-auto min-h-8 whitespace-normal"
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-ink-muted">{field ? `Chosen: ${suggestionLabel(field)}` : 'Nothing chosen yet.'}</p>
                {errors.field && <FieldError id={errorOf('field')} words={errors.field} />}
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor={`${uid}-message`}>Tell us what changed</Label>
                <textarea
                  ref={messageBox}
                  id={`${uid}-message`}
                  name="message"
                  autoComplete="off"
                  value={message}
                  readOnly={sending || undefined}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={describedBy('message')}
                  className={LINES}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    if (errors.message) setErrors((now) => ({ ...now, message: undefined }))
                  }}
                />
                {errors.message && <FieldError id={errorOf('message')} words={errors.message} />}
              </div>

              <div className="relative space-y-1.5">
                <div className="flex items-baseline">
                  <Label htmlFor={`${uid}-email`}>Your email (optional)</Label>
                  <HelpMark name="Your email (optional)" entries={[['Your email', EMAIL_HELP]]} tight />
                </div>
                <Input
                  ref={emailBox}
                  id={`${uid}-email`}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  spellCheck={false}
                  value={email}
                  readOnly={sending || undefined}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={describedBy('email')}
                  className="min-h-11 aria-invalid:border-destructive"
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors((now) => ({ ...now, email: undefined }))
                  }}
                />
                {errors.email && <FieldError id={errorOf('email')} words={errors.email} />}
              </div>

              <div>
                <SpamCheck onToken={(t) => { setToken(t); if (t) setErrors((now) => ({ ...now, token: undefined })) }} onFailed={setSpamFailed} refresh={refresh} />
                <p id={errorOf('token')} role="status" className={cn('text-sm font-semibold text-destructive', errors.token && 'mt-1.5')}>
                  {errors.token}
                </p>
              </div>

              <div className="relative">
                {/* Above the send button, so a refusal is in sight wherever the button is; empty, it takes no room. */}
                <p role="status" className={cn('break-words text-sm font-semibold text-ink', refusal && 'mb-2')}>{refusal}</p>
                <div className="flex flex-wrap items-center">
                  <button
                    type="submit"
                    aria-disabled={sending || undefined}
                    aria-describedby={describedBy('token')}
                    className={cn(CONTROL, 'h-auto min-w-0 max-w-full bg-ink py-2 text-left whitespace-normal break-words text-ground hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-80')}
                  >
                    {sending ? 'Sending…' : suggestSendLabel(goesTo, region)}
                  </button>
                  <HelpMark name="What happens next" entries={[['What happens next', SEND_HELP]]} />
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
