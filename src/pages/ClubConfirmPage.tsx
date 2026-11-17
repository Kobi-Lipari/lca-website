// src/pages/ClubConfirmPage.tsx
//
// The page a Still accurate link in the monthly check's email opens,
// /clubs/confirm/:token (WS09 step 14), routed only while clubKeepers is on.
// It needs no sign-in and sits under no guard, so it never reads the
// sign-in context and draws at once for a visitor and a signed-in person
// alike. Plain and short: the club's name and town and one Still accurate
// button, then "Thanks. {Club} is marked as checked for {month}." with the
// month in words, as the server gives it.
//
// On load it makes one request, the GET, which changes nothing, so a mail
// scanner that opens the link stamps nothing; the button sends the one POST.
// Every other state is said in words: reading the link, a link that has
// expired (with Log in), one that cannot be read, a seat that no longer
// covers the club, a club or an account that is gone, and a request that did
// not go through, with Try again. Its two calls live in
// src/areas/clubs/api.ts.
//
// The token rides in the address, so the page keeps it there alone: it is
// never in the title, the page asks browsers to send no referrer from it and
// search engines not to index it, and it links nowhere outside the site.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, confirmClubByLink, getClubLink } from '@/lib/api'

/** The statuses the server refuses a link with, each said in the server's own words. */
const REFUSALS = new Set([400, 403, 404, 410, 503])

/** What the page draws. */
type View =
  | { kind: 'reading' }
  | { kind: 'ready'; name: string; city: string }
  | { kind: 'done'; name: string; month: string }
  | { kind: 'refused'; text: string; expired: boolean }
  | { kind: 'failed'; text: string; name?: string; city?: string }

/** The heading for a state with no club to name. */
const HEADING = 'Monthly check'

/** The words for a load that did not go through, and for a press that did not. */
const LOAD_FAILED = 'The link could not be checked. Check your connection, then try again.'
const PRESS_FAILED = 'Not marked: the request did not go through. Nothing changed.'

/** A refusal in the server's words, or null for a failure to try again. */
function refusalOf(err: unknown): { text: string; expired: boolean } | null {
  if (err instanceof ApiError && REFUSALS.has(err.status)) return { text: err.message, expired: err.status === 410 }
  return null
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

/** A link on the page: 44px tall, a visible ring on focus. */
const LINK = 'inline-flex min-h-11 items-center rounded-md font-medium text-ink underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-focus'

export function ClubConfirmPage() {
  const { token = '' } = useParams<{ token: string }>()
  usePageTitle('Still accurate')
  useLinkHead()

  const [view, setView] = useState<View>({ kind: 'reading' })
  const [attempt, setAttempt] = useState(0)
  const [pressing, setPressing] = useState(false)
  const said = useRef<HTMLDivElement>(null)
  const moveFocus = useRef(false)

  useEffect(() => {
    let cancelled = false
    getClubLink(token)
      .then((club) => { if (!cancelled) setView({ kind: 'ready', name: club.name, city: club.city }) })
      .catch((err: unknown) => {
        if (cancelled) return
        const refused = refusalOf(err)
        setView(refused ? { kind: 'refused', ...refused } : { kind: 'failed', text: LOAD_FAILED })
      })
    return () => { cancelled = true }
  }, [token, attempt])

  // Once a press has settled and its button has gone, the focus goes to the words that say what happened.
  useEffect(() => {
    if (moveFocus.current && view.kind !== 'ready' && view.kind !== 'reading') {
      moveFocus.current = false
      said.current?.focus()
    }
  }, [view])

  async function stillAccurate(club: { name: string; city: string }) {
    setPressing(true)
    moveFocus.current = true
    try {
      const done = await confirmClubByLink(token)
      setView({ kind: 'done', name: done.name, month: done.month })
    } catch (err) {
      const refused = refusalOf(err)
      setView(refused ? { kind: 'refused', ...refused } : { kind: 'failed', text: PRESS_FAILED, name: club.name, city: club.city })
    } finally {
      setPressing(false)
    }
  }

  function tryAgain() {
    if (view.kind !== 'failed') return
    // A press that did not go through is sent again; a load that did not is read again.
    if (view.name !== undefined && view.city !== undefined) {
      void stillAccurate({ name: view.name, city: view.city })
      return
    }
    setView({ kind: 'reading' })
    setAttempt((n) => n + 1)
  }

  const club = view.kind === 'ready' ? view : view.kind === 'failed' && view.name !== undefined ? { name: view.name, city: view.city ?? '' } : null
  const heading = view.kind === 'done' ? view.name : club ? club.name : HEADING
  const words = view.kind === 'reading'
    ? 'Reading the link…'
    : pressing
      ? 'Marking…'
    : view.kind === 'done'
      ? `Thanks. ${view.name} is marked as checked for ${view.month}.`
      : view.kind === 'refused' || view.kind === 'failed' ? view.text : ''

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="break-words text-2xl font-bold text-ink">{heading}</h1>
      {club && club.city && <p className="mt-1 break-words text-ink">{club.city}</p>}
      {view.kind === 'ready' && (
        <Button type="button" className="mt-6 min-h-11 px-5" disabled={pressing} onClick={() => { void stillAccurate(view) }}>
          Still accurate
        </Button>
      )}
      {/* In the page from the first draw, so a screen reader hears each state as it comes. */}
      <div ref={said} tabIndex={-1} role="status" className={`mt-4 break-words outline-none ${view.kind === 'reading' ? 'text-muted-foreground' : 'text-ink'}`}>
        {words}
      </div>
      {view.kind === 'refused' && view.expired && (
        <p className="mt-4"><Link to="/login" className={LINK}>Log in</Link></p>
      )}
      {view.kind === 'failed' && (
        <Button type="button" variant="outline" className="mt-4 min-h-11 px-4" disabled={pressing} onClick={tryAgain}>
          Try again
        </Button>
      )}
    </div>
  )
}
