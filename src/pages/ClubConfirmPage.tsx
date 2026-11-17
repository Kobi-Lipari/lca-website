// src/pages/ClubConfirmPage.tsx
//
// The page a Still accurate link in the monthly check's email opens,
// /clubs/confirm/:token (WS09 step 14), routed only while clubKeepers is on.
// It needs no sign-in and sits under no guard, so it never reads the
// sign-in context and draws at once for a visitor and a signed-in person
// alike. Plain and short: the club's name and town, how it meets in the
// listing's own words (or the email's own sentence when it has none), so the
// person sees what they vouch for, and one Still accurate button, then
// "Thanks. {Club} is marked as checked for {month}." with the month in
// words, as the server gives it.
//
// On load it makes one request, the GET, which changes nothing, so a mail
// scanner that opens the link stamps nothing; the button sends the one POST.
// Every other state is said in words: reading the link, a link that has
// expired, one that cannot be read, no signing key on the site, a seat that
// no longer covers the club, a club or an account that is gone, and a
// request that did not go through, with Try again. Each refusal ends on one
// link onward, told by the answer's status: where logging in lets the person
// do the same from My region (410, 400 and 503), "Log in to My region",
// which sends them on to /workspace/region once signed in; where it would
// not help (403 and 404), "Go to the home page". A link opened too often in
// an hour from one place (429, WS09 step 25) is said in the server's words
// too, with "Go to the home page". Its two calls live in
// src/areas/clubs/api.ts.
//
// The token rides in the address, so the page keeps it there alone: it is
// never in the title or in a link's address, the page asks browsers to send
// no referrer from it and search engines not to index it, and it links
// nowhere outside the site.
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ApiError, confirmClubByLink, getClubLink } from '@/lib/api'
import { NO_STATEMENT } from '@domain/clubs/monthlyCheck'

/** The statuses the server refuses a link with, each said in the server's own words. */
const REFUSALS = new Set([400, 403, 404, 410, 429, 503])

/** The refusals where logging in lets the person mark the club from My region: an expired link, one that cannot be read, no key. */
const LOG_IN_HELPS = new Set([400, 410, 503])

/** The club as the page shows it: its name, town and how it meets. */
type Club = { name: string; city: string; statement: string | null }

/** What the page draws. */
type View =
  | { kind: 'reading' }
  | ({ kind: 'ready' } & Club)
  | { kind: 'done'; name: string; month: string }
  | { kind: 'refused'; text: string; status: number }
  | { kind: 'failed'; text: string; club?: Club }

/** The heading for a state with no club to name. */
const HEADING = 'Monthly check'

/** The words for a load that did not go through, and for a press that did not. */
const LOAD_FAILED = 'The link could not be checked. Check your connection, then try again.'
const PRESS_FAILED = 'Not marked: the request did not go through. Nothing changed.'

/** A refusal in the server's words, or null for a failure to try again. */
function refusalOf(err: unknown): { text: string; status: number } | null {
  if (err instanceof ApiError && REFUSALS.has(err.status)) return { text: err.message, status: err.status }
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
      .then((club) => { if (!cancelled) setView({ kind: 'ready', name: club.name, city: club.city, statement: club.statement }) })
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

  async function stillAccurate(club: Club) {
    setPressing(true)
    moveFocus.current = true
    try {
      const done = await confirmClubByLink(token)
      setView({ kind: 'done', name: done.name, month: done.month })
    } catch (err) {
      const refused = refusalOf(err)
      // A press that did not go through keeps the club on the page: its name, town and how it meets.
      setView(refused ? { kind: 'refused', ...refused } : { kind: 'failed', text: PRESS_FAILED, club: { name: club.name, city: club.city, statement: club.statement } })
    } finally {
      setPressing(false)
    }
  }

  function tryAgain() {
    if (view.kind !== 'failed') return
    // A press that did not go through is sent again; a load that did not is read again.
    if (view.club) {
      void stillAccurate(view.club)
      return
    }
    setView({ kind: 'reading' })
    setAttempt((n) => n + 1)
  }

  const club: Club | null = view.kind === 'ready' ? view : view.kind === 'failed' && view.club ? view.club : null
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
      {club && <p className="mt-4 min-w-0 whitespace-normal break-words text-ink">{club.statement ?? NO_STATEMENT}</p>}
      {view.kind === 'ready' && (
        <Button type="button" className="mt-6 min-h-11 px-5" disabled={pressing} onClick={() => { void stillAccurate(view) }}>
          Still accurate
        </Button>
      )}
      {/* In the page from the first draw, so a screen reader hears each state as it comes. */}
      <div ref={said} tabIndex={-1} role="status" className={`mt-4 break-words outline-none ${view.kind === 'reading' ? 'text-muted-foreground' : 'text-ink'}`}>
        {words}
      </div>
      {/* One way onward from a refusal, told by its status. The login page sends the person on to My region; the token goes with neither. */}
      {view.kind === 'refused' && (
        <p className="mt-4">
          {LOG_IN_HELPS.has(view.status)
            ? <Link to="/login" state={{ from: '/workspace/region' }} className={LINK}>Log in to My region</Link>
            : <Link to="/" className={LINK}>Go to the home page</Link>}
        </p>
      )}
      {view.kind === 'failed' && (
        <Button type="button" variant="outline" className="mt-4 min-h-11 px-4" disabled={pressing} onClick={tryAgain}>
          Try again
        </Button>
      )}
    </div>
  )
}
