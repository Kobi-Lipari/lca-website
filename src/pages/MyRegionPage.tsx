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
//
// A visitor's suggestion that no keeper has answered yet (WS09 step 28) is
// an open item of its club's card: the card says how many and the oldest's
// age, and its button reads "Answer it, then confirm", which takes the
// focus to the club's first row in the to-do list under the cards. Each row
// has Reply (only when the visitor left an address), Apply this and Not an
// issue (SuggestionRows.tsx); Apply this marks the row and opens the club's
// page in My region at its listing. Confirm all skips a club with one open
// and says how many it skipped. With none open the page is as before.
//
// An LCA admin also gets "Send overdue suggestions on" (WS09 step 29) under
// the to-do list's heading, only while a row there has waited 14 days or
// more with no answer and has not been passed on yet, by the rule of
// domain/clubs/regionCards.ts. It asks one question naming how many, then
// says how many were passed on and how many emails went; the page then reads
// its answer again, so each row passed on says when. With no row overdue the
// page is as before.
//
// The rows of Suggest a club and Start a club (WS09 step 30) come after the
// to-do list, under their own heading, "New clubs to check"
// (ClubRequestRows.tsx): for a holder of a seat the rows of the regions it
// covers, for an LCA admin every row, those whose place was not found among
// them. Each shows the person's name and address, with Email {first name}
// and Mark as handled, and for an LCA admin Add the club. With none the page
// is as before.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { ApiError, confirmClubStillAccurate, getWorkspaceRegion } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { RegionClubCard } from '@/areas/clubs/components/RegionClubCard'
import { RegionHelpMark } from '@/areas/clubs/components/RegionHelp'
import { ThisMonthBar } from '@/areas/clubs/components/ThisMonthBar'
import { MonthlyCheckButton } from '@/areas/clubs/components/MonthlyCheckButton'
import { OverdueSuggestionsButton } from '@/areas/clubs/components/OverdueSuggestionsButton'
import { SuggestionRows } from '@/areas/clubs/components/SuggestionRows'
import { ClubRequestRows } from '@/areas/clubs/components/ClubRequestRows'
import { RepRequestRows } from '@/areas/clubs/components/RepRequestRows'
import { useRowsShown, type SuggestionRow } from '@/areas/clubs/suggestionRows'
import {
  clubsToConfirm, clubsWord, confirmAllWords, errorWords, namesInWords, skippedWords, waitingForAnswer, withConfirmed, withoutSuggestion,
} from '@/areas/clubs/region'
import { isSuggestionOverdue } from '@domain/clubs/regionCards'
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
  const navigate = useNavigate()
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
    // A club with a suggestion open waits for its answer, and the run says how many it passed over.
    const skipped = waitingForAnswer(answer.clubs).length
    setSaid(skipped > 0 ? `${confirmAllWords(marked, failed)} ${skippedWords(skipped)}` : confirmAllWords(marked, failed))
    setRunsDone((n) => n + 1)
  }

  // The to-do list: every open suggestion, the oldest first, each with its club.
  const todo: SuggestionRow[] = (answer?.clubs ?? [])
    .flatMap((club) => club.openItems.map((item) => ({ ...item, clubId: club.id, clubName: club.name })))
    .sort((a, b) => b.ageDays - a.ageDays || a.id - b.id)
  const todoShown = useRowsShown(todo.length > 0)
  // The LCA admin's button for the rows no one has answered in 14 days: drawn from the first draw that has one, and on
  // after a press has sent them, so its status, and the focus on it, stay on the page.
  const overdue = isAdmin && todo.some((row) => isSuggestionOverdue({ status: 'open', passedOnAt: row.passedOnAt, ageDays: row.ageDays }))
  const overdueShown = useRowsShown(overdue)
  // The rows of Suggest a club and Start a club, oldest first as the server sends them: drawn from the first draw that
  // has one, and on after the last has gone, so the list's status and heading stay on the page.
  const requests = answer?.clubRequests ?? []
  const requestsShown = useRowsShown(requests.length > 0)
  // The requests of Ask to be its named rep (WS09 step 31), drawn the same way under a heading of their own.
  const repRequests = answer?.repRequests ?? []
  const repRequestsShown = useRowsShown(repRequests.length > 0)

  /**
   * After a press of Send on, or a rep request whose member has another role now: the answer again, quietly, so each
   * row says what is true now; a failure leaves the page as it is.
   */
  function readAgain() {
    getWorkspaceRegion()
      .then((fresh) => { if (live.current) setLoad((now) => (now.kind === 'ready' ? { kind: 'ready', answer: fresh } : now)) })
      .catch(() => {})
  }

  /** The card's "Answer it, then confirm": the focus goes to the club's first row in the to-do list. */
  function answerFirst(club: RegionClub) {
    const first = todo.find((row) => row.clubId === club.id)
    const target = first ? document.getElementById(`suggestion-${first.id}-title`) : null
    target?.scrollIntoView?.({ block: 'center' })
    target?.focus()
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
                    <RegionClubCard club={club} busy={busy.has(club.id)} error={errors[club.id] ?? null} onConfirm={(c) => { void stillAccurate(c) }} onAnswer={answerFirst} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {answer && todoShown && (
          <SuggestionRows
            kind="todo"
            rows={todo}
            headingId="region-suggestions-title"
            tools={overdueShown ? <OverdueSuggestionsButton onSent={readAgain} /> : undefined}
            onResolved={(row) => setAnswer((a) => withoutSuggestion(a, row.clubId, row.id))}
            onApplied={(row) => navigate(`/workspace/region/clubs/${encodeURIComponent(row.clubId)}`, { state: { suggestionApplied: true } })}
          />
        )}

        {answer && requestsShown && (
          <ClubRequestRows
            rows={requests}
            isAdmin={isAdmin}
            onHandled={(row) => setAnswer((a) => ({ ...a, clubRequests: (a.clubRequests ?? []).filter((r) => r.id !== row.id) }))}
          />
        )}

        {answer && repRequestsShown && (
          <RepRequestRows
            rows={repRequests}
            onDecided={(row) => setAnswer((a) => ({ ...a, repRequests: (a.repRequests ?? []).filter((r) => r.id !== row.id) }))}
            onStale={readAgain}
          />
        )}
      </section>
    </div>
  )
}
