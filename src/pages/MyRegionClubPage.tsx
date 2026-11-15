// src/pages/MyRegionClubPage.tsx
//
// A club in My region (WS09 step 12), at /workspace/region/clubs/:id while
// clubKeepers is on, as the board Work-H-2 draws it where the brief lets it
// stand: the trail "My LCA › My region › {club}", the club's name, the
// header "{town} · {region} · Checked {month}", View public page and Still
// accurate, and three tabs, Listing, News and Events. There is no Tonight
// tab, and nothing here claims a week.
//
// The page is for a region's representative and for an LCA admin, a person
// whose own club this is not, so it is "the club's page" throughout, and
// the editor is given what Your club's page gives such a person. The
// header's stamp is in the words of My region's card (checkWords in
// domain/clubs/regionCards.ts), and after Still accurate the words the
// confirm answered. The club's answer names nobody who keeps the club (it
// gives the public contact's name and the officers, neither of them a
// keeper), so the header names no keeper.
//
// Listing is the one club editor, saving through the one PATCH, with its
// previews and its page checklist, first drawn only with Listing showing
// and then kept, hidden while another tab shows, so what was typed survives
// a change of tab; News is the admin club page's own form
// and list (ClubNewsPanel.tsx); Events lists what the club's answer gives
// this person, each linked only to a page they may open.
//
// The route lets in an LCA admin and a holder of an active regional seat
// whose regions hold the club (requireSeat and requireClubMatch in
// RoleProtectedRoute.tsx); the server decides. A club the server will not
// give this person, one that does not exist among them, or one outside
// their regions, draws "not found here" with a way back to My region, and
// says nothing more of whether it exists. A club's own rep whose seat covers
// only other regions passes the route for their own club and is shown "not
// found here" by the page, since no seat of theirs covers it. Nothing here
// shows an email address or the roster.
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { isViewOnlyAdmin } from '@/areas/admin/roles'
import {
  adminCreateClubNews, adminDeleteClubNews, adminGetClub, adminGetClubNews, ApiError, confirmClubStillAccurate,
  type ApiAdminClubTournament, type ApiClubNews,
} from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ClubNewsPanel, type ClubNewsForm } from '@/areas/clubs/components/ClubNewsPanel'
import { ClubEventsList, type EventLink } from '@/areas/clubs/components/ClubEventsList'
import { errorWords } from '@/areas/clubs/region'
import { checkWords } from '@domain/clubs/regionCards'
// The one club editor, fetched only when the Listing tab draws it.
const ClubEditor = lazy(() => import('@/areas/clubs/components/ClubEditor').then((m) => ({ default: m.ClubEditor })))

/**
 * Below lg the page runs under today's sticky header, which gives the page no
 * scroll padding, so each control the focus moves to keeps room above it, as
 * My region's and the editor's controls do.
 */
const CLEAR_OF_HEADER = 'max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24'

/** A link on the navy band: 44px tall, a white ring on focus. */
const BAND_LINK = 'inline-flex min-h-11 items-center gap-1.5 rounded-md text-white underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-white'

/** A link on the page: 44px tall, a visible ring on focus. */
const LINK = 'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

/**
 * The News tab's controls, today's admin page's own, each at least 44px tall
 * here, and the date's box ringed while it holds the focus, since the ring the
 * site's field draws on keyboard focus does not show on a date's box.
 */
const TALL_CONTROLS = '[&_button]:min-h-11 [&_input]:min-h-11 [&_input[type=date]:focus]:ring-3 [&_input[type=date]:focus]:ring-focus'

/** Room kept above a control the keyboard reaches below lg: the site's header and a gap, as on My region. */
const UNDER_HEADER = 96

/** Whether the focus came by the keyboard; a browser that cannot say reads as no. */
function byKeyboard(el: HTMLElement): boolean {
  try {
    return el.matches(':focus-visible')
  } catch {
    return false
  }
}

/**
 * Below lg, a control the keyboard reaches that stands partly under today's
 * sticky header is brought down clear of it. The browser scrolls only to a
 * control it cannot see at all, so a tall box, the news's excerpt among them,
 * could be reached with its top under the header. From lg up nothing is
 * done, as on every page of today's look.
 */
function keepClearOfHeader(e: FocusEvent<HTMLDivElement>) {
  const el = e.target
  if (!(el instanceof HTMLElement) || typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 64rem)').matches) return
  if (byKeyboard(el) && el.getBoundingClientRect().top < UNDER_HEADER) el.scrollIntoView?.({ block: 'start' })
}

type ClubTab = 'listing' | 'news' | 'events'
const TABS: Array<{ id: ClubTab; label: string }> = [
  { id: 'listing', label: 'Listing' },
  { id: 'news', label: 'News' },
  { id: 'events', label: 'Events' },
]

/** What the page is answered for the club. */
type ClubAnswer = Awaited<ReturnType<typeof adminGetClub>>

/** Where the page stands with the club, for the address it was asked for. */
type Load =
  | { kind: 'ready'; data: ClubAnswer }
  | { kind: 'not-here' }
  | { kind: 'signed-out' }
  | { kind: 'failed'; text: string }

/** Why the club did not come, in the page's own terms: a refusal or a club that is not there reads alike. */
function settleError(err: unknown): Load {
  if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return { kind: 'not-here' }
  if (err instanceof ApiError && err.status === 401) return { kind: 'signed-out' }
  return { kind: 'failed', text: `The club could not be loaded: ${errorWords(err)}` }
}

const EMPTY_NEWS: ClubNewsForm = { title: '', newsDate: '', excerpt: '' }

/**
 * The page, drawn afresh for each club its address names: what one club's
 * page holds (a news post being typed, what Still accurate said, a confirm on
 * its way) never reaches another club's page when the address moves.
 */
export function MyRegionClubPage() {
  const { id = '' } = useParams<{ id: string }>()
  return <ClubInRegion key={id} id={id} />
}

/**
 * Drawn beside the editor, inside its Suspense, so its effect runs only once the editor's file
 * has loaded and the editor is on the page: from then the page keeps the editor.
 */
function EditorDrawn({ onDrawn }: { onDrawn: () => void }) {
  useEffect(() => { onDrawn() }, [onDrawn])
  return null
}

function ClubInRegion({ id }: { id: string }) {
  const { role, member, managedClubs, directedTournamentIds } = useAuth()
  const isAdmin = role === 'lca_admin'
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: ClubTab = tabParam === 'news' || tabParam === 'events' ? tabParam : 'listing'
  const setTab = (next: ClubTab) => setParams(next === 'listing' ? {} : { tab: next }, { replace: true })
  // Once the editor has been drawn with Listing showing it stays drawn, hidden while another tab
  // shows, so a change of tab never throws away what was typed. Until then it is drawn only while
  // Listing shows, so it is never first drawn hidden, where its Help would open by itself unseen:
  // not before Listing is first opened, and not when the person left Listing before its file came.
  const [editorDrawn, setEditorDrawn] = useState(false)
  const keepEditor = useCallback(() => setEditorDrawn(true), [])

  // The time the page opened, which the header's stamp is read against, as My region's answer is.
  const [openedAt] = useState(() => Date.now())
  const [load, setLoad] = useState<Load | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    adminGetClub(id)
      .then((data) => { if (!cancelled) setLoad(data && data.club ? { kind: 'ready', data } : { kind: 'not-here' }) })
      .catch((err) => { if (!cancelled) setLoad(settleError(err)) })
    return () => { cancelled = true }
  }, [id, attempt])

  // The focus goes to the page's heading once a second try has settled, since Try again is gone by
  // then, as on My region: for the club here, and for the club's news below, where it waits on
  // News still being open and the focus being lost.
  const heading = useRef<HTMLHeadingElement>(null)
  const loadKind = load?.kind ?? null
  useEffect(() => {
    if (attempt > 0 && loadKind !== null) heading.current?.focus()
  }, [attempt, loadKind])

  const data = load?.kind === 'ready' ? load.data : null
  // The server gives a club to more people than this page is for (an observer outside the
  // region, a club's own rep whose seat covers other regions): beside an LCA admin, the page
  // draws only a club one of the person's regional seats covers, and any other reads as not here.
  const regionalClubIds = managedClubs.map((c) => c.id)
  const keeps = !!data && (isAdmin || regionalClubIds.includes(data.club.id))
  const club = keeps && data ? data.club : null
  const notHere = load?.kind === 'not-here' || (!!data && !keeps)

  // A club found by its page address moves to its id's address, which every call here takes.
  const { search } = useLocation()
  useEffect(() => {
    if (club && club.id !== id) navigate({ pathname: `/workspace/region/clubs/${encodeURIComponent(club.id)}`, search }, { replace: true })
  }, [club, id, navigate, search])

  usePageTitle(club ? `${club.name} · My region` : 'My region')

  // A change to the club in hand, made only while it is still the club the change was asked for.
  const setClubData = (forClub: string, change: (d: ClubAnswer) => ClubAnswer) => {
    setLoad((now) => (now && now.kind === 'ready' && now.data.club.id === forClub ? { kind: 'ready', data: change(now.data) } : now))
  }

  // Still accurate: the confirm's own words, until a save gives the club a new stamp.
  const [confirmed, setConfirmed] = useState<{ id: string; words: string } | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [said, setSaid] = useState('')
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => { live.current = false }
  }, [])

  async function stillAccurate() {
    if (!club || confirming) return
    const { id: clubId, name } = club
    setConfirming(true)
    // Cleared as the press starts, so the words that follow are a fresh change to the status
    // line, and a second press in the same month is announced again.
    setSaid('')
    try {
      const answer = await confirmClubStillAccurate(clubId)
      if (!live.current) return
      setConfirmed({ id: clubId, words: answer.lastCheckWords })
      setClubData(clubId, (d) => ({ ...d, club: { ...d.club, last_confirmed_at: answer.lastConfirmedAt } }))
      setSaid(`${name} marked still accurate: ${answer.lastCheckWords}.`)
    } catch (err) {
      if (live.current) setSaid(`${name} was not marked still accurate: ${errorWords(err)} Nothing changed.`)
    } finally {
      if (live.current) setConfirming(false)
    }
  }

  // News: the admin club page's own form and list, loaded once the club is in hand, by its id.
  const clubId = club?.id ?? null
  const [news, setNews] = useState<{ club: string; list: ApiClubNews[] } | { club: string; failed: string } | null>(null)
  const [newsAttempt, setNewsAttempt] = useState(0)
  const [newsForm, setNewsForm] = useState<ClubNewsForm>(EMPTY_NEWS)
  const [newsSaving, setNewsSaving] = useState(false)
  const [newsDeletingId, setNewsDeletingId] = useState<string | null>(null)
  const [newsSaid, setNewsSaid] = useState('')
  useEffect(() => {
    if (!clubId) return
    let cancelled = false
    adminGetClubNews(clubId)
      .then((list) => { if (!cancelled) setNews({ club: clubId, list }) })
      .catch((err) => { if (!cancelled) setNews({ club: clubId, failed: `The club's news could not be loaded: ${errorWords(err)}` }) })
    return () => { cancelled = true }
  }, [clubId, newsAttempt])
  const newsNow = news && news.club === clubId ? news : null
  const newsKind = newsNow ? ('failed' in newsNow ? 'failed' : 'list') : null
  // The tabs stay usable while a news retry is on its way, so the heading takes the focus only
  // when the retry settles with News still open and the focus lost (Try again gone, nothing else
  // focused). A person who has moved to another tab or control keeps their place. Each settle is
  // weighed once, so a later change of tab never moves the focus by itself.
  const newsSettleSeen = useRef('')
  useEffect(() => {
    if (newsAttempt === 0 || newsKind === null) return
    const settle = `${newsAttempt}:${newsKind}`
    if (newsSettleSeen.current === settle) return
    newsSettleSeen.current = settle
    const lost = document.activeElement === null || document.activeElement === document.body
    if (tab === 'news' && lost) heading.current?.focus()
  }, [newsAttempt, newsKind, tab])

  async function handlePostNews(e: FormEvent) {
    e.preventDefault()
    if (!clubId) return
    setNewsSaving(true)
    setNewsSaid('')
    try {
      await adminCreateClubNews(clubId, newsForm)
    } catch (err) {
      if (live.current) {
        setNewsSaid(`The news was not posted: ${errorWords(err)}`)
        setNewsSaving(false)
      }
      return
    }
    // The post went through. From here a failure is the list's own, and is never said as the
    // post's: the form gives way to Try again, so the same news is not posted a second time.
    setNewsForm(EMPTY_NEWS)
    try {
      const list = await adminGetClubNews(clubId)
      if (live.current) {
        setNews({ club: clubId, list })
        setNewsSaid('News posted.')
      }
    } catch (err) {
      if (live.current) setNews({ club: clubId, failed: `The news was posted. The list could not be read again: ${errorWords(err)}` })
    } finally {
      if (live.current) setNewsSaving(false)
    }
  }

  async function handleDeleteNews(item: ApiClubNews) {
    if (!clubId) return
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return
    setNewsDeletingId(item.id)
    setNewsSaid('')
    try {
      await adminDeleteClubNews(clubId, item.id)
      if (live.current) {
        setNews((now) => (now && 'list' in now ? { club: now.club, list: now.list.filter((n) => n.id !== item.id) } : now))
        setNewsSaid(`"${item.title}" deleted.`)
      }
    } catch (err) {
      if (live.current) setNewsSaid(`"${item.title}" was not deleted: ${errorWords(err)}`)
    } finally {
      if (live.current) setNewsDeletingId(null)
    }
  }

  // An event leads to its manage page only for a person the server lets manage it: an LCA
  // admin, an observer, the club's own rep or the event's director. Anyone else, a region's
  // representative among them, is led to a listed event's public page, and to no page for a draft.
  const ownRep = role === 'club_rep' && !!member?.club_id && !!club && member.club_id === club.id
  function linkOf(event: ApiAdminClubTournament): EventLink {
    const directs = member?.role !== 'guest' && directedTournamentIds.includes(event.id)
    if (isAdmin || isViewOnlyAdmin(role) || ownRep || directs) return 'manage'
    return event.is_visible === 1 ? 'public' : null
  }

  const stamp = club ? (confirmed?.id === club.id ? confirmed.words : checkWords(club.last_confirmed_at, openedAt)) : ''
  const where = club ? [club.city, club.region, stamp].filter(Boolean).join(' · ') : ''
  const status = load === null
    ? 'Loading the club…'
    : notHere ? 'This club is not found here.'
      : load.kind === 'signed-out' ? 'Your sign-in has ended. Sign in again, then come back to this page.'
        : load.kind === 'failed' ? load.text : said

  return (
    <div className={CLEAR_OF_HEADER} onFocus={keepClearOfHeader}>
      <section className="border-b-[3px] border-lca-gold bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-2 text-sm">
              <li><Link to="/dashboard" className={BAND_LINK}>My LCA</Link></li>
              <li aria-hidden="true">›</li>
              <li><Link to="/workspace/region" className={BAND_LINK}>My region</Link></li>
              {club && (
                <>
                  <li aria-hidden="true">›</li>
                  <li className="min-w-0 break-words"><span aria-current="page">{club.name}</span></li>
                </>
              )}
            </ol>
          </nav>
          <h1 ref={heading} tabIndex={-1} className="mt-1 break-words text-3xl font-bold tracking-tight outline-none sm:text-4xl">{club ? club.name : 'A club in My region'}</h1>
          {club && <p className="mt-2 break-words text-base text-white">{where}</p>}
          {club && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button
                type="button"
                className="min-h-11 bg-lca-gold px-4 font-semibold whitespace-normal text-brand-navy hover:bg-lca-gold/90 focus-visible:ring-white"
                aria-label={`Still accurate: ${club.name}`}
                aria-disabled={confirming || undefined}
                onClick={() => { void stillAccurate() }}
              >
                Still accurate
              </Button>
              <Link to={`/clubs/${encodeURIComponent(club.id)}`} target="_blank" rel="noopener noreferrer" className={BAND_LINK} aria-label="View public page (opens in a new tab)">
                View public page
                <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
          {/* The tabs, as the admin club page draws its own: a button for each, the open one kept in the address. */}
          <div className={club ? 'mt-5 flex gap-1 overflow-x-auto border-t border-white/10 pt-1' : 'pb-6 sm:pb-8'}>
            {club && TABS.map(({ id: tid, label }) => (
              <button
                key={tid}
                type="button"
                onClick={() => setTab(tid)}
                aria-current={tab === tid ? 'true' : undefined}
                className={`flex min-h-11 flex-shrink-0 items-center border-b-2 px-3 text-sm text-white outline-none transition-colors focus-visible:ring-3 focus-visible:ring-white ${
                  tab === tid ? 'border-lca-gold font-semibold' : 'border-transparent hover:border-white/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        {club && isAdmin && (
          <div className="rounded-lg border border-hairline bg-card p-4 text-sm text-ink">
            <p className="font-semibold">You're here as an LCA admin</p>
            <Link to="/admin" className={LINK}>
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to Admin
            </Link>
          </div>
        )}

        {/* One status from the first draw: Loading, then why no club came, then what Still accurate did. */}
        <p role="status" className={`min-w-0 break-words text-sm ${load === null ? 'text-muted-foreground' : 'text-ink'}`}>{status}</p>

        {load?.kind === 'failed' && (
          <Button type="button" variant="outline" className="min-h-11 px-4" onClick={() => { setLoad(null); setAttempt((n) => n + 1) }}>
            Try again
          </Button>
        )}
        {(notHere || load?.kind === 'signed-out') && (
          <Link to="/workspace/region" className={LINK}>
            <ArrowLeft className="size-4" aria-hidden="true" /> Back to My region
          </Link>
        )}

        {/* Hidden, not taken away, while another tab shows: out of the tab order and of what a screen reader reads, with what was typed kept. */}
        {club && data && (tab === 'listing' || editorDrawn) && (
          <div hidden={tab !== 'listing'}>
            <Suspense fallback={<p className="text-muted-foreground" role="status">Loading the editor…</p>}>
              <ClubEditor
                key={club.id}
                club={club}
                places={data.places ?? []}
                own={ownRep}
                isAdmin={isAdmin}
                showAdminFields={isAdmin}
                viewOnly={false}
                onSaved={(saved, places) => {
                  setClubData(club.id, (d) => ({ ...d, club: saved, places }))
                  // A save is a check too, so the header reads the saved club's own stamp.
                  setConfirmed(null)
                }}
              />
              <EditorDrawn onDrawn={keepEditor} />
            </Suspense>
          </div>
        )}

        {club && tab === 'news' && (
          <div className="space-y-4">
            <p role="status" className="min-w-0 break-words text-sm text-ink">{newsNow && 'failed' in newsNow ? newsNow.failed : newsNow ? newsSaid : 'Loading the club\'s news…'}</p>
            {newsNow && 'failed' in newsNow && (
              <Button type="button" variant="outline" className="min-h-11 px-4" onClick={() => { setNews(null); setNewsAttempt((n) => n + 1) }}>
                Try again
              </Button>
            )}
            {newsNow && 'list' in newsNow && (
              <div className={TALL_CONTROLS}>
                <ClubNewsPanel
                  news={newsNow.list}
                  newsForm={newsForm}
                  setNewsForm={setNewsForm}
                  newsSaving={newsSaving}
                  newsDeletingId={newsDeletingId}
                  handleDeleteNews={(item) => { void handleDeleteNews(item) }}
                  handlePostNews={(e) => { void handlePostNews(e) }}
                  myRegion
                />
              </div>
            )}
          </div>
        )}

        {club && data && tab === 'events' && (
          <ClubEventsList clubName={club.name} events={data.tournaments ?? []} linkOf={linkOf} draftsKeptBack={!!data.rosterKeptBack} />
        )}
      </section>
    </div>
  )
}
