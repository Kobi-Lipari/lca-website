// src/pages/YourClubPage.tsx
//
// Your club's page (WS09 step 9), at /my/club/:slug while clubKeepers is on:
// the one club editor of WS09 steps 7 and 8, its previews beside it, for the
// person who keeps the club, under the title "Your club's page", with a link
// to the club's page as it is today and the last save in words, its date
// with its weekday and its time read in Central time.
//
// The address names the club by its page address, or by its id for a club
// with none. The route lets in only a person who keeps some club (keepsAClub
// in src/components/auth/RoleProtectedRoute.tsx), and the page asks for the
// club through adminGetClub, which the server answers by the id or the
// present page address under the same check as by the id. The browser's
// checks are a convenience and the server decides: a refusal is said in
// words, with a way back.
//
// A club's rep who holds no regional seat keeps one club alone, so the page
// asks for that club by its id and sends the rep away from any address that
// is not that club's, never asking for another club. Anyone else is answered
// for the address and then held to canManageClub with the club's own id, so
// an observer's reading view is never drawn here. Once the club is drawn
// the address becomes its page address, when it has one. The page draws the
// club and the editor alone: never the roster, an officer or an event, so a
// person admitted by the region alone meets nothing the server keeps back.
// While an answer is on the way nothing of any club is drawn.
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { canManageClub, toolsHomeFor, type MemberRole } from '@/areas/admin/roles'
import { adminGetClub, ApiError, type ApiClubListing } from '@/lib/api'
import { formatDate, formatTime } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
// The one club editor, fetched only when this page draws it.
const ClubEditor = lazy(() => import('@/areas/clubs/components/ClubEditor').then((m) => ({ default: m.ClubEditor })))

/** What the page is answered for the club. */
type ClubAnswer = Awaited<ReturnType<typeof adminGetClub>>

/** Why the page draws no club. */
type Refusal = 'not-yours' | 'not-found' | 'signed-out' | { text: string }

/**
 * An answer, with the value it was asked for, so an answer for another
 * address is never drawn. A save that moves the club's page address keeps
 * the address the page was at in `from`, so the saved club stays drawn while
 * the address moves to its new one, and the address it left is never asked
 * for again. Within the visit that address leads only to the saved club, at
 * its new address; the server, asked afresh, follows it to no club.
 */
type Got = { asked: string; data: ClubAnswer; from?: string } | { asked: string; refused: Refusal }

/** The form an id or a page address takes; anything else names no club and is not sent. */
const ADDRESS_FORM = /^[A-Za-z0-9_-]+$/

/** Whether the value is the club's id or its page address now. */
function names(club: ApiClubListing, value: string): boolean {
  return club.id === value || (!!club.slug && club.slug === value)
}

/** Why a request for the club failed, in the page's own terms. */
function refusalOf(err: unknown): Refusal {
  if (err instanceof ApiError && err.status === 403) return 'not-yours'
  if (err instanceof ApiError && err.status === 404) return 'not-found'
  if (err instanceof ApiError && err.status === 401) return 'signed-out'
  const text = err instanceof Error && err.message.trim() ? err.message.trim() : 'The server did not answer'
  return { text: /[.!?]$/.test(text) ? text : `${text}.` }
}

/** The words a refusal is said in. */
function refusalWords(refusal: Refusal): string {
  if (refusal === 'not-yours') return 'This club\'s page is not one you keep, so it cannot be changed here.'
  if (refusal === 'not-found') return 'No club has this address.'
  if (refusal === 'signed-out') return 'Your sign-in has ended. Sign in again, then come back to this page.'
  return `The club's page could not be opened: ${refusal.text}`
}

/** Where "back" goes for this person, and its words. */
function wayBack(role: MemberRole): { to: string; label: string } {
  if (role === 'lca_admin') return { to: '/admin/clubs', label: 'Back to all clubs' }
  const home = toolsHomeFor(role)
  if (home === '/workspace') return { to: home, label: 'Back to your workspace' }
  if (home.startsWith('/admin')) return { to: home, label: 'Back to the admin panel' }
  return { to: '/dashboard', label: 'Back to your profile' }
}

/** The club's last save in words: its date with its weekday and its time, in Central time, as every date and time the site shows. */
function lastSaveWords(club: ApiClubListing): string {
  if (!club.told_updated_at) return 'Not saved here yet.'
  const date = formatDate(club.told_updated_at, { stored: 'utc', year: true })
  const time = formatTime(club.told_updated_at, { stored: 'utc' })
  return `Last saved ${date} at ${time}.`
}

const LINK = 'inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-medium text-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

export function YourClubPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { role, member, managedClubs } = useAuth()
  const navigate = useNavigate()
  const regionalClubIds = managedClubs.map((c) => c.id)
  // A rep with no regional seat is asked about their own club alone.
  const ownClub = role === 'club_rep' && regionalClubIds.length === 0 ? member?.club_id ?? null : null
  const readable = ADDRESS_FORM.test(slug)
  const [got, setGot] = useState<Got | null>(null)
  // The club already drawn keeps its answer when the address moves to its page address,
  // and through a save that gave it a new one.
  const goesBy = !!got && 'data' in got && (names(got.data.club, slug) || got.from === slug)
  const held = goesBy && got ? got.asked : null
  const ask = ownClub ?? held ?? slug
  const asking = ownClub !== null || readable
  // The answer in hand serves this address: it was asked for this value, and a club it holds still goes by the address
  // (a rep's own club is checked against the address below instead).
  const current = got && got.asked === ask && ('refused' in got || ownClub !== null || goesBy) ? got : null
  const needed = current === null

  useEffect(() => {
    if (!asking || !needed) return
    let cancelled = false
    adminGetClub(ask)
      .then((data) => {
        if (cancelled) return
        // An answer with no club, or with a club the value does not name, is not this address's answer.
        const answers = !!data && typeof data === 'object' && !!data.club && names(data.club, ask)
        setGot(answers ? { asked: ask, data } : { asked: ask, refused: 'not-found' })
      })
      .catch((err) => { if (!cancelled) setGot({ asked: ask, refused: refusalOf(err) }) })
    return () => { cancelled = true }
  }, [ask, asking, needed])

  const data = current && 'data' in current ? current.data : null
  const refused: Refusal | null = !asking ? 'not-found' : current && 'refused' in current ? current.refused : null
  // The rep is sent away from an address that is not their club's; anyone else is held to canManageClub with the club's own id.
  const sentAway = !!data && (
    (ownClub !== null && !goesBy)
    || !canManageClub(role, member?.club_id, data.club.id, regionalClubIds)
  )
  const club = data && !sentAway ? data.club : null
  const pageAddress = club ? club.slug || club.id : null

  usePageTitle(club ? `Your club's page: ${club.name}` : 'Your club\'s page')

  // Once the club is drawn the address is its page address, without asking again.
  useEffect(() => {
    if (pageAddress && slug !== pageAddress) navigate(`/my/club/${pageAddress}`, { replace: true })
  }, [pageAddress, slug, navigate])

  // The focus goes to the page's heading once the page has something to say.
  const heading = useRef<HTMLHeadingElement>(null)
  const settled = club ? `club:${club.id}` : refused ? 'refused' : null
  useEffect(() => {
    if (settled) heading.current?.focus()
  }, [settled])

  if (sentAway) return <Navigate to="/dashboard" replace />

  const back = wayBack(role)

  return (
    <div>
      <section className="border-b-[3px] border-lca-gold bg-brand-navy text-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none sm:text-4xl">Your club&apos;s page</h1>
          {club && (
            <>
              <p className="mt-2 text-base font-medium text-white">{club.name}</p>
              <p className="mt-1 text-sm text-white/70">{lastSaveWords(club)}</p>
            </>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {!club && !refused && <p className="text-muted-foreground" role="status">Loading…</p>}

        {refused && (
          <div className="space-y-3">
            <p className="text-sm text-ink">{refusalWords(refused)}</p>
            <Link to={back.to} className={LINK}>
              <ArrowLeft className="size-4" aria-hidden="true" /> {back.label}
            </Link>
          </div>
        )}

        {club && data && (
          <>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
              <Button asChild variant="outline" className="min-h-11">
                <Link to={`/clubs/${club.id}`}>
                  <ExternalLink className="mr-1.5 size-4" aria-hidden="true" /> See your page
                </Link>
              </Button>
              <Link to={back.to} className={LINK}>
                <ArrowLeft className="size-4" aria-hidden="true" /> {back.label}
              </Link>
            </div>
            <Suspense fallback={<p className="text-muted-foreground">Loading the editor…</p>}>
              <ClubEditor
                key={club.id}
                club={club}
                places={data.places ?? []}
                isAdmin={role === 'lca_admin'}
                showAdminFields={role === 'lca_admin'}
                viewOnly={false}
                onSaved={(saved, places) => {
                  setGot({ asked: ask, data: { ...data, club: saved, places }, from: slug })
                  const moved = saved.slug || saved.id
                  if (moved !== slug) navigate(`/my/club/${moved}`, { replace: true })
                }}
              />
            </Suspense>
          </>
        )}
      </section>
    </div>
  )
}
