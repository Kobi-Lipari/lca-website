// src/pages/MyRegionPage.tsx
//
// My region (WS09 step 11), at /workspace/region while clubKeepers is on, as
// the board Work-H draws it in today's look: the trail "My LCA › My region",
// the title with the region the seat keeps and the others it keeps beside
// it, the This month bar with Confirm all still accurate, and a card per
// club in the server's order, each with its stamp in words, Still accurate
// and Open. An LCA admin sees every club, under the banner "You're here as
// an LCA admin", and never reads "your region". An LCA admin also gets
// "Send this month's check now" (WS09 step 14), which asks one question
// naming how many people the monthly check goes to and then says how many
// were sent and how many were not.
//
// The page draws the server's words as they come and makes no date of its
// own: each card's lastCheckWords and the next check's date with its
// weekday. Still accurate on one card keeps the card where it is, so nothing
// moves under the person's pointer or focus (the next load brings the
// server's order), gives it the stamp the confirm answered, moves the bar's
// counts and says what happened in the one status line. Confirm all asks
// one plain question, then calls Still accurate for one club after another,
// skipping a card with an open item, and says how many were marked and
// which, by name, were not; those are left as they were. There is no call
// for all clubs at once.
//
// The route lets in a holder of an active regional seat, whatever their
// role, and an LCA admin (requireSeat in RoleProtectedRoute.tsx); the server
// decides, and its refusal is said in words with a way back. Every sentence
// that explains the page sits behind a small question mark beside the part
// it explains (RegionHelp.tsx, HelpMark.tsx): the This month bar's heading,
// Confirm all still accurate and the Clubs heading; no club's card carries
// one, nothing opens by itself and nothing is kept in the browser. Nothing
// here shows an email address: the answer carries none.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { ApiError, confirmClubStillAccurate, getWorkspaceRegion } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { RegionClubCard } from '@/areas/clubs/components/RegionClubCard'
import { RegionHelpMark } from '@/areas/clubs/components/RegionHelp'
import { ThisMonthBar } from '@/areas/clubs/components/ThisMonthBar'
import { MonthlyCheckButton } from '@/areas/clubs/components/MonthlyCheckButton'
import {
  clubsToConfirm, clubsWord, confirmAllWords, errorWords, namesInWords, withConfirmed,
} from '@/areas/clubs/region'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

/**
 * Below lg the page runs under today's sticky header, which gives the page no
 * scroll padding, so each control the focus moves to keeps room above it, as
 * the editor's controls do (CLEAR_OF_HEADER in ClubEditor.tsx). From lg up
 * nothing is added, as on every page of today's look; the new look's scroll
 * padding ends that.
 */
const CLEAR_OF_HEADER = 'max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24'

/** A link on the navy band: 44px tall, a white ring on focus. */
const BAND_LINK = 'inline-flex min-h-11 items-center rounded-md text-white underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-white'

/** A link on the page: 44px tall, a visible ring on focus. */
const LINK = 'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

/** Where the page stands with its answer. */
type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; answer: WorkspaceRegionResponse }
  | { kind: 'refused'; text: string }
  | { kind: 'failed'; text: string }

/** Why the answer did not come, in the page's own terms: the server's refusal in its words, or a failure to try again. */
function settleError(err: unknown): Load {
  if (err instanceof ApiError && err.status === 401) return { kind: 'refused', text: 'Your sign-in has ended. Sign in again, then come back to this page.' }
  if (err instanceof ApiError && err.status === 403) return { kind: 'refused', text: errorWords(err) }
  return { kind: 'failed', text: `My region could not be loaded: ${errorWords(err)}` }
}

export function MyRegionPage() {
  const { role } = useAuth()
  const isAdmin = role === 'lca_admin'
  usePageTitle('My region')

  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
  const [said, setSaid] = useState('')
  const [running, setRunning] = useState(false)
  const [runsDone, setRunsDone] = useState(0)
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  useEffect(() => {
    let cancelled = false
    getWorkspaceRegion()
      .then((answer) => { if (!cancelled) setLoad({ kind: 'ready', answer }) })
      .catch((err) => { if (!cancelled) setLoad(settleError(err)) })
    return () => { cancelled = true }
  }, [attempt])

  const answer = load.kind === 'ready' ? load.answer : null
  const setAnswer = useCallback((change: (a: WorkspaceRegionResponse) => WorkspaceRegionResponse) => {
    setLoad((now) => (now.kind === 'ready' ? { kind: 'ready', answer: change(now.answer) } : now))
  }, [])

  // The focus goes to the page's heading once a second try has settled, since Try again is gone by then.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (attempt > 0 && load.kind !== 'loading') heading.current?.focus()
  }, [attempt, load.kind])

  // Once a run of Confirm all is done and its button has gone, the focus that was on it goes to the bar's heading.
  const barHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (runsDone === 0) return
    const at = document.activeElement
    if (!at || at === document.body) barHeading.current?.focus()
  }, [runsDone])

  function markBusy(id: string, on: boolean) {
    setBusy((now) => {
      const next = new Set(now)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  function setError(id: string, text: string | null) {
    setErrors((now) => {
      const next = { ...now }
      if (text) next[id] = text
      else delete next[id]
      return next
    })
  }

  // The clubs whose Still accurate is on its way, and those marked since the page loaded. Both are
  // read and written at once, without waiting for a draw, so a club is never sent twice: a press on
  // a card the run is marking does nothing, and the run passes over a card pressed by hand.
  const onItsWay = useRef<Set<string>>(new Set())
  const markedHere = useRef<Set<string>>(new Set())

  /** Still accurate for one club: the stamp's words when it was marked, 'failed', or 'on its way' when a request for it has not come back yet. */
  async function confirmOne(club: RegionClub): Promise<string | 'failed' | 'on its way'> {
    if (onItsWay.current.has(club.id)) return 'on its way'
    onItsWay.current.add(club.id)
    markBusy(club.id, true)
    setError(club.id, null)
    try {
      const confirmed = await confirmClubStillAccurate(club.id)
      markedHere.current.add(club.id)
      if (live.current) setAnswer((a) => withConfirmed(a, { ...confirmed, id: club.id }))
      return confirmed.lastCheckWords
    } catch (err) {
      if (live.current) setError(club.id, `Not marked: ${errorWords(err)} Nothing changed.`)
      return 'failed'
    } finally {
      onItsWay.current.delete(club.id)
      if (live.current) markBusy(club.id, false)
    }
  }

  async function stillAccurate(club: RegionClub) {
    // Cleared as the press starts, so the words that follow are a fresh change to the status
    // line, and a second press in the same month is announced again.
    if (!onItsWay.current.has(club.id)) setSaid('')
    const stamp = await confirmOne(club)
    if (!live.current || stamp === 'on its way') return
    setSaid(stamp !== 'failed' ? `${club.name} marked still accurate: ${stamp}.` : `${club.name} was not marked still accurate. Nothing changed.`)
  }

  /** The clubs Confirm all would mark now: each that needs a check, has no open item and is not already on its way. */
  function waitingClubs(clubs: readonly RegionClub[]): RegionClub[] {
    return clubsToConfirm(clubs).filter((club) => !onItsWay.current.has(club.id) && !markedHere.current.has(club.id))
  }

  async function confirmAll() {
    if (!answer || running) return
    const list = waitingClubs(answer.clubs)
    if (list.length === 0) return
    setRunning(true)
    setSaid(`Marking ${clubsWord(list.length)}…`)
    let marked = 0
    const failed: string[] = []
    for (const club of list) {
      if (!live.current) return
      // A card pressed by hand since the run began is on its way, or already marked, by its own press.
      if (onItsWay.current.has(club.id) || markedHere.current.has(club.id)) continue
      const stamp = await confirmOne(club)
      if (stamp === 'failed') failed.push(club.name)
      else if (stamp !== 'on its way') marked++
    }
    if (!live.current) return
    setRunning(false)
    setSaid(confirmAllWords(marked, failed))
    setRunsDone((n) => n + 1)
  }

  const regions = answer?.regions.map((r) => r.region) ?? []
  const title = !isAdmin && regions.length > 0 ? `My region · ${regions[0]}` : 'My region'
  const alsoKeeping = !isAdmin && regions.length > 1 ? `Also keeping ${namesInWords(regions.slice(1))}` : null
  // The busy marks are read too, so the count follows each card as its request leaves and comes back.
  const toConfirm = answer ? clubsToConfirm(answer.clubs).filter((club) => !busy.has(club.id)).length : 0

  /** The one status line: what the page is doing, why it has nothing, or what a press did. */
  const status = load.kind === 'loading' ? 'Loading My region…' : load.kind === 'ready' ? said : load.text

  return (
    <div className={CLEAR_OF_HEADER}>
      <section className="border-b-[3px] border-lca-gold bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 text-sm">
              <li><Link to="/dashboard" className={BAND_LINK}>My LCA</Link></li>
              <li aria-hidden="true">›</li>
              <li><span aria-current="page">My region</span></li>
            </ol>
          </nav>
          <h1 ref={heading} tabIndex={-1} className="mt-1 break-words text-3xl font-bold tracking-tight outline-none sm:text-4xl">{title}</h1>
          {alsoKeeping && <p className="mt-2 break-words text-base text-white">{alsoKeeping}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {answer && isAdmin && (
          <div className="rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
            <p className="font-semibold">You're here as an LCA admin</p>
            <p>You see every club, in every region.</p>
          </div>
        )}

        {/* The LCA admin's button for the monthly check (WS09 step 14): one question, then how many were sent and how many were not. */}
        {answer && isAdmin && <MonthlyCheckButton />}

        {answer && (
          <ThisMonthBar
            thisMonth={answer.thisMonth}
            hasClubs={answer.clubs.length > 0}
            toConfirm={toConfirm}
            running={running}
            onConfirmAll={() => { void confirmAll() }}
            headingRef={barHeading}
            help={<RegionHelpMark part="month" isAdmin={isAdmin} />}
            confirmHelp={<RegionHelpMark part="confirmAll" isAdmin={isAdmin} align="end" />}
          />
        )}

        {/* One status from the first draw: Loading, then why nothing came, then what each press did. */}
        <p role="status" className={`min-w-0 break-words text-sm ${load.kind === 'loading' ? 'text-muted-foreground' : 'text-ink'}`}>{status}</p>

        {load.kind === 'failed' && (
          <Button type="button" variant="outline" className="min-h-11 px-4" onClick={() => { setLoad({ kind: 'loading' }); setAttempt((n) => n + 1) }}>
            Try again
          </Button>
        )}
        {load.kind === 'refused' && (
          <Link to="/dashboard" className={LINK}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to My LCA
          </Link>
        )}

        {answer && (
          <section aria-labelledby="region-clubs-title" className="space-y-3">
            {/* The Clubs mark stands after the heading, outside it, and its bubble lies across the row under it. */}
            <div className="relative flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline">
                <h2 id="region-clubs-title" className="text-lg font-semibold text-ink">Clubs</h2>
                <RegionHelpMark part="clubs" isAdmin={isAdmin} />
              </div>
              {answer.clubs.length > 0 && <p className="text-sm text-muted-foreground">{clubsWord(answer.clubs.length)}</p>}
            </div>
            {answer.clubs.length === 0 ? (
              <p className="text-sm text-ink">{isAdmin ? 'No clubs are listed yet.' : 'No clubs are in your region yet.'}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {answer.clubs.map((club) => (
                  <li key={club.id} className="min-w-0">
                    <RegionClubCard club={club} busy={busy.has(club.id)} error={errors[club.id] ?? null} onConfirm={(c) => { void stillAccurate(c) }} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </section>
    </div>
  )
}
