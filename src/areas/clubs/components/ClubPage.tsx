// src/areas/clubs/components/ClubPage.tsx
//
// The new club page, /clubs/:slug (WS09 step 21), drawn in place of today's
// club page only while clubPagesOn() holds (newClubs and newLook together);
// src/App.tsx makes that choice, and with either switch off the address
// draws today's ClubDetailPage as it always has.
//
// The page asks one thing, getClubPage (GET /api/clubs/:address/page), and
// draws what it answers, top to bottom as Club-Final-Bare draws a club that
// has only the basics and Club-G a fuller one: the cover with the club's
// initials and its h1, the section nav, About and When and
// where, then (WS09 step 22) the club's events and its news, each only with
// a row to draw, the nearest clubs where the answer gives any, and the foot
// line with Copy link, with Contact and its form (WS09 step 26) after the
// club's news. Suggest an update (WS09 step 28) opens from two places only,
// the end of the "Last checked" line and beside Contact's heading, and the
// focus goes back to the one that opened it. On a phone with the new chrome the club bar in the dock holds
// Directions and Message the club. Photos comes with the step that builds
// it; until then the page draws no block for it and the nav does not list
// it, whatever the answer names. The told line and a nearest club's
// distance are the server's words, drawn as given; the cover
// takes its colour from the answer. The page has one status, under the
// cover's buttons, which says what Share or Copy link did. While it
// loads the page says so in a status; a club the server does not answer
// for draws today's "Club not found", and any other failure says so in
// words with Try again. The focus goes to the page's heading once there is
// one, as the site's other pages move it.
//
// The page goes by the club's slug: opened at the club's id or an old slug,
// the address is replaced by the slug, keeping any query and hash, without
// a new entry in the history and without asking again; a club whose slug is
// its id stays where it is.
//
// A keeper of the club who is signed in reads where they stand in a band
// under the cover, decided from what the session already holds (keeperFor in
// src/areas/clubs/clubPage.ts), and only while clubKeepers is on, since the
// pages Edit leads to exist only then. Who keeps a club is not shown to
// anyone else (K's decision 12): with no keeper there is no band.
//
// While the club has no named rep (the answer's rep_wanted, sent only while
// CLUB_PAGES_ON is set) and clubPagesOn() holds, one quiet line of its own
// before the foot line invites a member to Ask to be its named rep (WS09
// step 31, RepRequestLink.tsx); the sheet it opens gives the focus back to
// it. With either off, or once the club has a rep, the page draws nothing of
// it, and it never says who keeps the club.
import { useEffect, useEffectEvent, useRef, useState, type Ref } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'

import { ApiError, getClubPage } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { clubPagesOn, keepersOn } from '@/areas/clubs/switches'
import { placePoints } from '@/areas/clubs/clubMap'
import {
  CONTROL, CONTROLS_CLEAR_OF_BARS, SECTION_IDS, WORD_LINK, copyLink, drawnSections, keeperFor, pageAddress, pageLink, type Keeper, type Said,
} from '@/areas/clubs/clubPage'
import { AuthorLine } from '@/areas/clubs/components/AuthorLine'
import { ClubAbout } from '@/areas/clubs/components/ClubAbout'
import { ClubBar } from '@/areas/clubs/components/ClubBar'
import { ClubCover } from '@/areas/clubs/components/ClubCover'
import { ClubEvents } from '@/areas/clubs/components/ClubEvents'
import { ClubFootLine } from '@/areas/clubs/components/ClubFootLine'
import { ClubNews } from '@/areas/clubs/components/ClubNews'
import { ClubContact } from '@/areas/clubs/components/ContactRelayForm'
import { LCAMap } from '@/areas/clubs/components/LCAMap'
import { NearbyClubs } from '@/areas/clubs/components/NearbyClubs'
import { SectionNav } from '@/areas/clubs/components/SectionNav'
import { WhenAndWhere } from '@/areas/clubs/components/WhenAndWhere'
import { SuggestUpdateHost, SuggestUpdateLink } from '@/areas/clubs/components/SuggestUpdateLink'
import { RepRequestHost, RepRequestLink } from '@/areas/clubs/components/RepRequestLink'
import { SITE_NAME, clubPageTitle } from '@domain/clubs/pageMeta'
import type { ClubPageResponse } from '@domain/contracts'

/** What one ask brought: the answer, or why there is none. */
type Got =
  | { asked: string; attempt: number; answer: ClubPageResponse }
  | { asked: string; attempt: number; failed: 'not-found' | 'error' }

/** The status's words in each state the page has before it draws the club. */
const STATUS = {
  loading: 'Loading the club…',
  'not-found': 'No club goes by this address.',
  error: 'Check your connection, then try again.',
} as const

/** The page, asked for by the address it was opened at: the club's slug, an old slug or its id. */
export function ClubPage({ address }: { address: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, member, managedClubs } = useAuth()
  const [attempt, setAttempt] = useState(0)
  const [got, setGot] = useState<Got | null>(null)

  // The answer in hand serves this address when it was asked for it, or when
  // its club goes by it: the slug the page moved to, which is not asked again.
  const current = got && got.attempt === attempt
    && (got.asked === address || ('answer' in got && got.answer.club.slug === address))
    ? got
    : null
  const needed = current === null

  useEffect(() => {
    if (!needed) return
    let cancelled = false
    getClubPage(address)
      .then((answer) => { if (!cancelled) setGot({ asked: address, attempt, answer }) })
      .catch((err: unknown) => {
        if (!cancelled) setGot({ asked: address, attempt, failed: err instanceof ApiError && err.status === 404 ? 'not-found' : 'error' })
      })
    return () => { cancelled = true }
  }, [address, attempt, needed])

  const answer = current && 'answer' in current ? current.answer : null
  const failed = current && 'failed' in current ? current.failed : null

  // The address is the club's slug: an id or an old slug is replaced, with the query and the hash it had.
  const slug = answer?.club.slug ?? null
  useEffect(() => {
    if (slug && slug !== address) navigate(pageAddress(slug, location.search, location.hash), { replace: true })
  }, [slug, address, navigate, location.search, location.hash])

  const title = answer
    ? clubPageTitle(answer.club.name, answer.club.city)
    : failed === 'not-found' ? `Club not found · ${SITE_NAME}` : `Club · ${SITE_NAME}`
  useEffect(() => {
    const before = document.title
    document.title = title
    return () => { document.title = before }
  }, [title])

  // The focus goes to the heading once the page has one; a section named in
  // the hash is scrolled into view, with the focus on the heading still.
  const heading = useRef<HTMLHeadingElement>(null)
  const settled = answer ? `club:${answer.club.id}` : failed ? `${failed}:${attempt}` : null
  const focusHeading = useEffectEvent(() => {
    let id = ''
    try {
      id = decodeURIComponent(location.hash.slice(1))
    } catch {
      // A hash that is not a well-formed address part names no section.
    }
    const section = id ? document.getElementById(id) : null
    heading.current?.focus({ preventScroll: !!section })
    section?.scrollIntoView()
  })
  useEffect(() => {
    if (settled) focusHeading()
  }, [settled])

  if (answer) {
    // While the session's member is still loading there is no member, so no line; it appears once the member is there.
    const keeper = keepersOn() ? keeperFor(answer.club, { role, member, managedClubs }) : null
    // Drawn afresh for each club, so what the status said of one club is not said of the next.
    return <ClubPageView key={answer.club.id} answer={answer} keeper={keeper} headingRef={heading} />
  }

  // Before the club: one status from the first render, which says Loading and
  // then, in its place, why no club came, so a screen reader hears it.
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-6">
      {failed === 'not-found' && <Users aria-hidden="true" className="mx-auto mb-4 size-12 text-ink-muted" />}
      {failed && (
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-ink outline-none">
          {failed === 'not-found' ? 'Club not found' : 'This club\'s page did not load'}
        </h1>
      )}
      <p role="status" className={cn('mt-2', failed ? 'text-ink' : 'text-ink-muted')}>{STATUS[failed ?? 'loading']}</p>
      {failed && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {failed === 'error' && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cn(CONTROL, 'bg-ink text-ground hover:opacity-90')}>
              Try again
            </button>
          )}
          <Link to="/clubs" className={WORD_LINK}>
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to clubs
          </Link>
        </div>
      )}
    </div>
  )
}

/** The page drawn from an answer. */
export function ClubPageView({
  answer, keeper, headingRef,
}: {
  answer: ClubPageResponse
  keeper: Keeper | null
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const sections = drawnSections(answer.sections, { events: answer.events.length, news: answer.news.length })
  const { club } = answer
  const pins = placePoints(answer.places)
  const link = pageLink(window.location.origin, club.slug)
  const [said, setSaid] = useState<Said>({ words: '', from: 'cover' })
  const copyFromFoot = async () => {
    setSaid({ words: '', from: 'foot' })
    const words = await copyLink(link)
    setSaid({ words, from: 'foot' })
  }
  // Suggest an update (WS09 step 28): the button that opened the sheet, while it is open, so the focus goes back to it.
  const [suggestFrom, setSuggestFrom] = useState<HTMLElement | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const closeSuggest = () => {
    returnTo.current = suggestFrom
    setSuggestFrom(null)
  }
  // Once the sheet has left the page, the focus goes back to the button that opened it.
  useEffect(() => {
    if (suggestFrom || !returnTo.current) return
    returnTo.current.focus()
    returnTo.current = null
  }, [suggestFrom])
  const suggestLink = <SuggestUpdateLink onOpen={setSuggestFrom} />
  // Ask to be its named rep (WS09 step 31): the invitation that opened the sheet, while it is open, so the focus goes back to it.
  const askRep = clubPagesOn() && answer.rep_wanted === true
  const [repFrom, setRepFrom] = useState<HTMLElement | null>(null)
  const repReturnTo = useRef<HTMLElement | null>(null)
  const closeRep = () => {
    repReturnTo.current = repFrom
    setRepFrom(null)
  }
  useEffect(() => {
    if (repFrom || !repReturnTo.current) return
    repReturnTo.current.focus()
    repReturnTo.current = null
  }, [repFrom])
  return (
    <div data-slot="club-page" className="@container bg-ground text-ink">
      <div className={CONTROLS_CLEAR_OF_BARS}>
        <nav aria-label="Breadcrumb" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ol className="flex flex-wrap items-center gap-x-2 text-sm text-ink">
            <li><Link to="/clubs" className={WORD_LINK}>Clubs</Link></li>
            <li aria-hidden="true">›</li>
            <li className="min-w-0 break-words"><span aria-current="page">{club.name}</span></li>
          </ol>
        </nav>
        <ClubCover club={club} statement={answer.statement.text} headingRef={headingRef} said={said.words} say={(words) => setSaid({ words, from: 'cover' })} />
        {keeper && (
          <div className="mt-6">
            <AuthorLine keeper={keeper} />
          </div>
        )}
      </div>
      <SectionNav sections={sections} />
      <div className={CONTROLS_CLEAR_OF_BARS}>
        {sections.includes('about') && <ClubAbout id={SECTION_IDS.about} name={club.name} about={answer.about} />}
        {sections.includes('when_and_where') && (
          <WhenAndWhere
            id={SECTION_IDS.when_and_where}
            name={club.name}
            statement={answer.statement.text}
            told={answer.statement.told}
            suggest={suggestLink}
            places={answer.places}
            map={pins.length > 0 ? (
              <LCAMap key={club.id} mode="single" clubName={club.name} places={pins} directions={false} quietWithoutKey height={260} />
            ) : null}
          />
        )}
        {sections.includes('events') && <ClubEvents id={SECTION_IDS.events} events={answer.events} />}
        {sections.includes('news') && <ClubNews id={SECTION_IDS.news} news={answer.news} />}
        {sections.includes('contact') && (
          <ClubContact id={SECTION_IDS.contact} address={club.slug} region={club.region} goesTo={answer.contact.goes_to} suggest={suggestLink} />
        )}
        {answer.nearest.length > 0 && <NearbyClubs city={club.city} nearest={answer.nearest} />}
        {askRep && <RepRequestLink onOpen={setRepFrom} />}
        <ClubFootLine name={club.name} city={club.city} address={link} said={said} onCopy={() => { void copyFromFoot() }} />
      </div>
      <ClubBar place={pins[0] ?? null} />
      {askRep && <RepRequestHost from={repFrom} onClose={closeRep} clubName={club.name} address={club.slug} />}
      <SuggestUpdateHost from={suggestFrom} onClose={closeSuggest} clubName={club.name} address={club.slug} goesTo={answer.suggestion.goes_to} region={club.region} />
    </div>
  )
}
