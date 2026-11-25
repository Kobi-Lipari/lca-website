// src/pages/ClubReplyPage.tsx
//
// The page a Reply through LCA link opens, /clubs/reply/:token (WS09 step
// 27), routed only with clubPagesOn. A representative's or an LCA admin's
// copy of a message a visitor sent from a club's page carries this link in
// place of the visitor's address; here the person answers, and neither side
// sees the other's address.
//
// Signed out, the page says Log in first, with a Log in link that brings the
// person back to this same address once signed in. Let in, it shows the
// visitor's first name, the club and the first lines of the message, one
// text box with a visible label and Send reply. While the reply is sent the
// button says so and a second press does nothing; once sent the page says
// "Sent to {first name}. Their address was never shown to you." with the
// focus moved to those words. A refusal is said in the server's words: a
// link that cannot be used, a person who is neither the region's
// representative nor an LCA admin, the limit, a reply that did not go. The
// status stands above Send reply, so the words are in sight wherever the
// button is, and is brought clear of any fixed bar as the Contact form's is.
//
// How the visitor's answer comes back, how long the link works, that neither
// address is shown and how to sign one's own name sit behind two small
// question marks (K's decision 16, applied to this page in WS09 checkpoint
// X's review), beside the heading and beside the reply's label. Each opens
// only when pressed; nothing opens by itself and nothing is kept in the
// browser.
//
// The token rides in the address, so the page keeps it there alone: it is
// never in the title or in a link's address, the page asks browsers to send
// no referrer from it and search engines not to index it. Its two calls live
// in src/areas/clubs/api.ts.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, getClubReply, sendClubReply } from '@/lib/api'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { CONTROL, WORD_LINK, bringClearOfBars, keepFocusClearOfBars } from '@/areas/clubs/clubPage'
import { HelpMark } from '@/areas/clubs/components/HelpMark'
import { replyHeadingHelp, replyLabelHelp, replyFieldError, replySentWords } from '@domain/clubs/replyMessage'
import type { ClubReplyResponse } from '@domain/contracts'

/** The page's heading in every state. */
export const REPLY_PAGE_HEADING = 'Reply through LCA'

/** The words for a signed-out person. */
export const LOG_IN_FIRST = 'Log in first to answer this message.'

/** The words for a load that did not go through, and for a send that did not. */
const LOAD_FAILED = 'The message could not be read. Check your connection, then try again.'
const SEND_FAILED = 'We couldn\'t send this. Check your connection, then try again.'

/** The statuses the server refuses with, each said in the server's own words. */
const REFUSALS = new Set([400, 401, 403, 404, 429, 503])

/** What the page draws. */
type View =
  | { kind: 'reading' }
  | ({ kind: 'ready' } & ClubReplyResponse)
  | { kind: 'sent'; firstName: string }
  | { kind: 'refused'; text: string; status: number }
  | { kind: 'failed'; text: string }

/** The words for a sign-in the server no longer takes: the tree's 401 carries no words for a person. */
export const SIGN_IN_ENDED = 'Your sign-in has ended. Log in again to answer this message.'

/** A refusal in the server's words, or null for a failure to try again. */
function refusalOf(err: unknown): { text: string; status: number } | null {
  if (!(err instanceof ApiError) || !REFUSALS.has(err.status)) return null
  return { text: err.status === 401 ? SIGN_IN_ENDED : err.message, status: err.status }
}

/**
 * Two lines in the page's head while it is drawn, each taken away when it goes: no referrer from this page, so a
 * click or a request never carries the address and its token on, and no index of it.
 */
function useLinkHead() {
  useEffect(() => {
    const added = [
      Object.assign(document.createElement('meta'), { name: 'referrer', content: 'no-referrer' }),
      Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex, nofollow' }),
    ]
    for (const meta of added) document.head.appendChild(meta)
    return () => { for (const meta of added) meta.remove() }
  }, [])
}

/** A box of several lines, with the look's focus ring and the error's border beside the error's words. */
const LINES =
  'flex min-h-40 w-full rounded-md border border-field bg-background px-3 py-2 text-base text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus aria-invalid:border-destructive'

const ids = { box: 'club-reply-message', error: 'club-reply-message-error', status: 'club-reply-status', heading: 'club-reply-heading' } as const

export function ClubReplyPage() {
  const { token = '' } = useParams<{ token: string }>()
  const location = useLocation()
  const { user, loading } = useAuth()
  usePageTitle(REPLY_PAGE_HEADING)
  useLinkHead()

  const [view, setView] = useState<View>({ kind: 'reading' })
  const [attempt, setAttempt] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [refusal, setRefusal] = useState('')
  const [sending, setSending] = useState(false)
  const [answered, setAnswered] = useState(0)
  const busy = useRef(false)
  const sentLine = useRef<HTMLParagraphElement>(null)
  const statusLine = useRef<HTMLParagraphElement>(null)
  const sendButton = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const focusNext = useRef<'sent' | null>(null)

  const signedIn = !loading && !!user
  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    getClubReply(token)
      .then((found) => {
        if (cancelled) return
        setView({ kind: 'ready', ...found })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const refused = refusalOf(err)
        setView(refused ? { kind: 'refused', ...refused } : { kind: 'failed', text: LOAD_FAILED })
      })
    return () => { cancelled = true }
  }, [token, attempt, signedIn])

  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    sentLine.current?.focus()
  })

  // A refusal above Send reply pushes the button down: the button, when it has the focus, is kept clear of the bars
  // first, then the words are brought into sight, so both are seen and the focus stays where it is.
  useEffect(() => {
    const words = statusLine.current
    if (answered === 0 || !words?.textContent) return
    const button = sendButton.current
    if (button && button.ownerDocument.activeElement === button) keepFocusClearOfBars(button)
    bringClearOfBars(words)
  }, [answered])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy.current || view.kind !== 'ready') return
    const found = replyFieldError(text)
    setError(found ?? '')
    setRefusal('')
    if (found) {
      box.current?.focus()
      return
    }
    busy.current = true
    setSending(true)
    try {
      const done = await sendClubReply(token, { message: text.trim() })
      setText('')
      focusNext.current = 'sent'
      setView({ kind: 'sent', firstName: done.firstName })
    } catch (err) {
      const refused = refusalOf(err)
      setRefusal(refused ? refused.text : SEND_FAILED)
      setAnswered((n) => n + 1)
    } finally {
      busy.current = false
      setSending(false)
    }
  }

  const firstName = view.kind === 'ready' || view.kind === 'sent' ? view.firstName : ''
  const showHelp = view.kind === 'ready' || view.kind === 'sent'

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="relative flex items-baseline">
        <h1 id={ids.heading} className="min-w-0 break-words text-2xl font-bold text-ink">{REPLY_PAGE_HEADING}</h1>
        {showHelp && <HelpMark name={REPLY_PAGE_HEADING} entries={replyHeadingHelp(firstName)} />}
      </div>

      {loading ? (
        <p role="status" className="mt-4 text-muted-foreground">Reading the link…</p>
      ) : !user ? (
        <div className="mt-4 space-y-3">
          <p className="break-words text-ink">{LOG_IN_FIRST}</p>
          {/* The login page brings the person back to this same address once signed in. */}
          <Link to="/login" state={{ from: location.pathname }} className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90')}>
            Log in
          </Link>
        </div>
      ) : view.kind === 'reading' ? (
        <p role="status" className="mt-4 text-muted-foreground">Reading the link…</p>
      ) : view.kind === 'ready' ? (
        <div className="mt-4 space-y-4">
          <p className="break-words text-ink">{`${view.firstName} wrote to ${view.club}:`}</p>
          <blockquote className="whitespace-pre-line break-words border-l-4 border-hairline pl-4 text-ink">{view.excerpt}</blockquote>
          <form noValidate onSubmit={(e) => { void submit(e) }} className="space-y-4" onFocus={(e) => keepFocusClearOfBars(e.target)}>
            <div className="relative space-y-1.5">
              <div className="flex items-baseline">
                <Label htmlFor={ids.box}>Your reply</Label>
                <HelpMark name="Your reply" entries={replyLabelHelp(view.firstName)} tight />
              </div>
              <textarea
                ref={box}
                id={ids.box}
                name="message"
                autoComplete="off"
                value={text}
                readOnly={sending || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ids.error : undefined}
                className={LINES}
                onChange={(e) => { setText(e.target.value); if (error) setError('') }}
              />
              {error && <p id={ids.error} className="text-sm font-semibold text-destructive">{error}</p>}
            </div>
            <div>
              {/* In the page from the first draw, so a screen reader hears a refusal once, when it comes. Above Send
                  reply, so the words are in sight wherever the button is; empty, it takes no room. */}
              <p ref={statusLine} id={ids.status} role="status" className={cn('break-words text-sm font-semibold text-ink', refusal && 'mb-2')}>
                {refusal}
              </p>
              <button
                ref={sendButton}
                type="submit"
                aria-disabled={sending || undefined}
                className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90 aria-disabled:cursor-wait aria-disabled:opacity-80')}
              >
                {sending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </form>
        </div>
      ) : view.kind === 'sent' ? (
        <div className="mt-4 space-y-3">
          <p ref={sentLine} tabIndex={-1} data-slot="reply-sent" className="rounded-sm text-lg font-semibold text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus">
            {replySentWords(view.firstName)}
          </p>
          <Link to="/" className={WORD_LINK}>Go to the home page</Link>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p role="status" className="break-words text-ink">{view.text}</p>
          {view.kind === 'refused' && view.status === 401 ? (
            <Link to="/login" state={{ from: location.pathname }} className={WORD_LINK}>Log in</Link>
          ) : view.kind === 'failed' ? (
            <button type="button" onClick={() => { setView({ kind: 'reading' }); setAttempt((n) => n + 1) }} className={cn(CONTROL, 'border border-field bg-surface text-ink hover:bg-surface-2')}>
              Try again
            </button>
          ) : (
            <Link to="/" className={WORD_LINK}>Go to the home page</Link>
          )}
        </div>
      )}
    </div>
  )
}
