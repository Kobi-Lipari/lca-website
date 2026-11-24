// @vitest-environment jsdom
//
// The edges of a club's page in My region (WS09 step 12), beside the cases in
// my-region-club-page.test.tsx: the Events list's dates at the turns of the
// clock (the two nights Central time changes, the turn of a year, a leap day),
// an event with no last day or a last day equal to its first, events that
// tie on a date, an empty list, and every state in words; the header's month
// read at midnight in America/Chicago and at the 90th day; a tab the address
// misnames; a club reached by its page address; a signed-out answer and a
// failed one; stale answers when the page moves to another club; a double
// press of Still accurate; who each event leads to; and the plain-language
// rules over the files that draw the page. Every name, club and address here
// is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ClubEventsList, type EventLink } from '@/areas/clubs/components/ClubEventsList'
import type { ApiAdminClubTournament } from '@/lib/api'

vi.setConfig({ testTimeout: 20000 })

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { MyRegionClubPage } = await import('@/pages/MyRegionClubPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

type Event = ApiAdminClubTournament
function event(over: Partial<Event> & { id: string }): Event {
  return { name: `Example ${over.id}`, date: '2026-12-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open', ...over } as Event
}

const rows = (list: HTMLElement) => within(list).queryAllByRole('listitem')
function listOf(events: Event[], linkOf: (e: Event) => EventLink = () => null, draftsKeptBack = false) {
  render(
    <MemoryRouter>
      <ClubEventsList clubName="Example Knights Club" events={events} linkOf={linkOf} draftsKeptBack={draftsKeptBack} />
    </MemoryRouter>,
  )
  return screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the Events list at the turns of the clock', () => {
  const CASES: Array<[string, string, string]> = [
    ['the morning Central time falls back', '2026-11-01', 'Sun, Nov 1, 2026'],
    ['the morning Central time springs forward', '2026-03-08', 'Sun, Mar 8, 2026'],
    ['the next spring\'s change', '2027-03-14', 'Sun, Mar 14, 2027'],
    ['the last day of the year', '2026-12-31', 'Thu, Dec 31, 2026'],
    ['the first day of the next', '2027-01-01', 'Fri, Jan 1, 2027'],
    ['a leap day', '2028-02-29', 'Tue, Feb 29, 2028'],
  ]

  for (const zone of ['America/Chicago', 'UTC', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
    it(`gives each date its own weekday with the viewer's clock in ${zone}`, () => {
      const before = process.env.TZ
      process.env.TZ = zone
      try {
        const list = listOf(CASES.map(([, date], i) => event({ id: `d${i}`, date })))
        expect(rows(list).map((r) => r.querySelector('p:nth-of-type(2)')?.textContent)).toEqual(CASES.map(([, , words]) => words))
      } finally {
        if (before === undefined) delete process.env.TZ
        else process.env.TZ = before
      }
    })
  }

  it('shows the last day only for an event that runs past its first, across a change of the clock and a change of year', () => {
    const list = listOf([
      event({ id: 'none', date: '2026-11-01', end_date: null }),
      event({ id: 'same', date: '2026-11-01', end_date: '2026-11-01' }),
      event({ id: 'across-clock', date: '2026-10-31', end_date: '2026-11-01' }),
      event({ id: 'across-year', date: '2026-12-31', end_date: '2027-01-01' }),
    ])
    expect(rows(list).map((r) => r.querySelector('p:nth-of-type(2)')?.textContent)).toEqual([
      'Sun, Nov 1, 2026',
      'Sun, Nov 1, 2026',
      'Sat, Oct 31, 2026 to Sun, Nov 1, 2026',
      'Thu, Dec 31, 2026 to Fri, Jan 1, 2027',
    ])
    expect(list.textContent).not.toMatch(/null|undefined|Invalid/)
  })

  it('keeps events that tie on a date in the order the server gave, each in its own row', () => {
    const list = listOf([
      event({ id: 'b', name: 'Example Second Open', date: '2026-12-05' }),
      event({ id: 'a', name: 'Example First Open', date: '2026-12-05' }),
      event({ id: 'c', name: 'Example Third Open', date: '2026-12-05' }),
    ])
    expect(rows(list).map((r) => r.querySelector('p')?.textContent)).toEqual(['Example Second Open', 'Example First Open', 'Example Third Open'])
    expect(within(list).getAllByText('Sat, Dec 5, 2026')).toHaveLength(3)
  })
})

describe('the Events list with nothing, one, and every state', () => {
  it('says plainly that no events are listed, and says where drafts stay only when the server kept them back', () => {
    let list = listOf([], () => null, false)
    expect(rows(list)).toHaveLength(0)
    expect(within(list).getByText('No events are listed for Example Knights Club yet.')).toBeTruthy()
    expect(within(list).queryByText(/Drafts stay/)).toBeNull()
    expect(within(list).queryByText(/\d events?$/)).toBeNull()
    cleanup()
    list = listOf([], () => null, true)
    expect(within(list).getByText('Drafts stay with LCA admins and the club\'s own rep.')).toBeTruthy()
  })

  it('counts one event as "1 event" and more as "N events"', () => {
    let list = listOf([event({ id: 'one' })])
    expect(within(list).getByText('1 event')).toBeTruthy()
    cleanup()
    list = listOf([event({ id: 'one' }), event({ id: 'two' })])
    expect(within(list).getByText('2 events')).toBeTruthy()
  })

  it('puts each state in words beside the date, with registration when it was opened or closed, and Draft, not public for a hidden event', () => {
    const list = listOf([
      event({ id: 'up', status: 'upcoming', registration_status: 'open' }),
      event({ id: 'live', status: 'active', registration_status: 'closed' }),
      event({ id: 'done', status: 'completed', registration_status: null }),
      event({ id: 'odd', status: 'cancelled', registration_status: 'draft' }),
      event({ id: 'blank', status: '', registration_status: null }),
      event({ id: 'hidden', status: 'upcoming', registration_status: 'draft', is_visible: 0 }),
    ])
    const state = (i: number) => rows(list)[i].querySelector('p:nth-of-type(3) > span')?.textContent
    expect([0, 1, 2, 3, 4, 5].map(state)).toEqual([
      'Upcoming · Registration open',
      'Under way · Registration closed',
      'Finished',
      'Cancelled',
      'No state given',
      'Upcoming',
    ])
    expect(within(list).getAllByText('Draft, not public')).toHaveLength(1)
    expect(rows(list)[5].textContent).toContain('Draft, not public')
    // The words, never a colour, carry each state: no row names a colour class for its state.
    expect(list.innerHTML).not.toMatch(/text-(?:green|red|amber|yellow|lca-gold)/)
  })

  it('leads each row only where its link says: manage, the public page, or nowhere, and encodes the id', () => {
    const links: Record<string, EventLink> = { m: 'manage', p: 'public', n: null, 'a b/c': 'public' }
    const list = listOf(Object.keys(links).map((id) => event({ id })), (e) => links[e.id])
    const [m, p, n, odd] = rows(list)
    expect(within(m).getByRole('link', { name: 'Manage: Example m' }).getAttribute('href')).toBe('/admin/tournaments/m')
    expect(within(p).getByRole('link', { name: 'Event page: Example p' }).getAttribute('href')).toBe('/tournaments/p')
    expect(within(n).queryByRole('link')).toBeNull()
    expect(within(odd).getByRole('link').getAttribute('href')).toBe('/tournaments/a%20b%2Fc')
  })
})

// ---------------------------------------------------------------------------
// The page.

const ID = 'c-knights'
const CLUB = {
  id: ID, name: 'Example Knights Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: null, facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-02 15:00:00' as string | null, told_by: 'm-five', last_confirmed_at: '2026-11-02 15:00:00' as string | null, confirmed_by: 'm-five',
}
const OTHER = { ...CLUB, id: 'c-rooks', name: 'Example Rooks Club', slug: 'example-rooks', last_confirmed_at: null, told_by: null }
const OPEN = event({ id: 't-open', name: 'Example Knights Open', date: '2026-12-05', end_date: '2026-12-06' })
const DRAFT = event({ id: 't-draft', name: 'Example Winter Draft', date: '2027-01-09', is_visible: 0, registration_status: 'draft' })
const NEWS = [{ id: 'n-1', club_id: ID, title: 'Example club night', news_date: '2026-11-07', excerpt: 'An example evening.', created_at: '2026-11-08 18:00:00' }]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
type Answer = (body: unknown) => Response | Promise<Response>
let asked: string[] = []
let answers: Record<string, Answer> = {}

const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
interface Who { role?: string; account?: string; club?: string | null; managed?: string[]; directs?: string[]; seats?: unknown[] }

function answerFor(club: Record<string, unknown>, tournaments: Event[] = [OPEN]) {
  return { club, officers: [], roster: [], rosterKeptBack: true, tournaments, places: [] }
}

beforeEach(() => {
  window.localStorage.clear()
  asked = []
  answers = {
    [`GET /api/admin/clubs/${ID}`]: () => json(answerFor(CLUB)),
    [`GET /api/admin/clubs/${ID}/news`]: () => json({ news: NEWS }),
    [`POST /api/admin/clubs/${ID}/confirm`]: () => json({ id: ID, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push(call)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    const answer = answers[call]
    return answer ? answer(body) : json({ error: 'Not found' }, 404)
  }))
})

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{`${pathname}${search}`}</output>
}
function GoTo({ to }: { to: string }) {
  const navigate = useNavigate()
  const { search } = useLocation()
  // The same tab at the other club, as the browser's back and forward buttons or a typed address would do.
  return <button type="button" onClick={() => navigate(`${to}${search}`)}>Go to {to}</button>
}
const where = () => screen.getByTestId('where').textContent

/** The page at this address for this person, on its own route. */
function open(path: string, who: Who = {}) {
  const role = who.role ?? 'member'
  const auth = {
    user: { id: 'm-one' }, session: null, role,
    member: { id: 'm-one', role: who.account ?? role, club_id: who.club ?? null, full_name: 'Player One' },
    loading: false, memberLoading: false, seats: who.seats ?? [REGIONAL],
    managedClubs: (who.managed ?? [ID, OTHER.id]).map((id) => ({ id, name: 'Example Club', region: 'Bayou Region' })),
    isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: who.directs ?? [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/workspace/region/clubs/:id" element={<MyRegionClubPage />} /></Routes>
        <GoTo to={`/workspace/region/clubs/${OTHER.id}`} />
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function ready(name = 'Example Knights Club') {
  await screen.findByRole('heading', { level: 1, name }, { timeout: 5000 })
  await act(async () => {})
}
const header = () => screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')
const eventsList = () => screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement

describe('the header\'s month at the edges of America/Chicago', () => {
  const NOW = new Date('2026-11-15T18:00:00Z')
  const CASES: Array<[string, string, string]> = [
    ['23:30 on Oct 31 in Central daylight time, which is Nov 1 in UTC', '2026-11-01 04:30:00', 'Checked Oct 2026'],
    ['00:30 on Nov 1 in Central daylight time', '2026-11-01 05:30:00', 'Checked Nov 2026'],
    ['the hour Central time repeats, first pass', '2026-11-01 06:30:00', 'Checked Nov 2026'],
    ['the hour Central time repeats, second pass', '2026-11-01 07:30:00', 'Checked Nov 2026'],
    ['23:59 on Nov 30 in Central standard time, which is Dec 1 in UTC', '2026-12-01 05:59:00', 'Checked Nov 2026'],
    ['00:00 on Dec 1 in Central standard time', '2026-12-01 06:00:00', 'Checked Dec 2026'],
  ]
  for (const [name, stamp, words] of CASES) {
    it(`reads ${name} as ${words.replace('Checked ', '')}`, async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(NOW)
      answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor({ ...CLUB, last_confirmed_at: stamp }))
      open(`/workspace/region/clubs/${ID}`)
      await ready()
      expect(within(header()).getByText(`Example City · Bayou Region · ${words}`)).toBeTruthy()
    })
  }

  it('counts a check as current on its 90th day and as not current one second later, in the same words as My region', async () => {
    const last = '2026-08-14 15:00:00'
    const ninetieth = Date.parse('2026-08-14T15:00:00Z') + 90 * 24 * 60 * 60 * 1000
    vi.useFakeTimers({ toFake: ['Date'] })
    answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor({ ...CLUB, last_confirmed_at: last }))
    vi.setSystemTime(ninetieth)
    open(`/workspace/region/clubs/${ID}`)
    await ready()
    expect(within(header()).getByText('Example City · Bayou Region · Checked Aug 2026')).toBeTruthy()
    cleanup()
    vi.setSystemTime(ninetieth + 1000)
    open(`/workspace/region/clubs/${ID}`)
    await ready()
    expect(within(header()).getByText('Example City · Bayou Region · Not checked since Aug 2026')).toBeTruthy()
  })

  it('reads an unreadable stamp as never checked, and says no month for a club with no town', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor({ ...CLUB, last_confirmed_at: 'not a date', city: '' }))
    open(`/workspace/region/clubs/${ID}`)
    await ready()
    expect(within(header()).getByText('Bayou Region · Not checked yet')).toBeTruthy()
    expect(header().textContent).not.toMatch(/Invalid|NaN|undefined|null/)
  })
})

describe('the address, the answer and the tabs', () => {
  it('opens Listing for a tab the address misnames, and keeps the tab it names', async () => {
    open(`/workspace/region/clubs/${ID}?tab=tonight`)
    await ready()
    expect(within(header()).getByRole('button', { name: 'Listing' }).getAttribute('aria-current')).toBe('true')
    expect(await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })).toBeTruthy()
    cleanup()
    open(`/workspace/region/clubs/${ID}?tab=events`)
    await ready()
    expect(within(header()).getByRole('button', { name: 'Events' }).getAttribute('aria-current')).toBe('true')
    expect(within(header()).getByRole('button', { name: 'Listing' }).getAttribute('aria-current')).toBeNull()
  })

  it('moves a club reached by its page address to its id\'s address, keeping the tab, and asks the news by id', async () => {
    answers['GET /api/admin/clubs/example-knights'] = () => json(answerFor(CLUB))
    open('/workspace/region/clubs/example-knights?tab=news', { role: 'lca_admin', seats: [], managed: [] })
    await ready()
    await waitFor(() => expect(where()).toBe(`/workspace/region/clubs/${ID}?tab=news`))
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    expect(asked).toContain(`GET /api/admin/clubs/${ID}/news`)
    expect(asked).not.toContain('GET /api/admin/clubs/example-knights/news')
  })

  it('says a signed-out answer in words with a way back, and draws no club', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ error: 'Unauthorized' }, 401)
    open(`/workspace/region/clubs/${ID}`)
    await screen.findByText('Your sign-in has ended. Sign in again, then come back to this page.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to My region' }).getAttribute('href')).toBe('/workspace/region')
    expect(screen.queryByRole('button', { name: /Still accurate/ })).toBeNull()
    expect(document.body.textContent).not.toContain('Unauthorized')
  })

  it('says a failed answer in words and tries again on request, drawing the page when the retry answers', async () => {
    let calls = 0
    answers[`GET /api/admin/clubs/${ID}`] = () => (++calls === 1 ? json({ error: 'Something broke' }, 500) : json(answerFor(CLUB)))
    open(`/workspace/region/clubs/${ID}`)
    await screen.findByText(/^The club could not be loaded: /, undefined, { timeout: 5000 })
    expect(screen.queryByRole('heading', { level: 1, name: 'Example Knights Club' })).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await ready()
    expect(calls).toBe(2)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('says a failed load of the news in words, tries again on request, and says a refused delete without losing the post', async () => {
    let calls = 0
    answers[`GET /api/admin/clubs/${ID}/news`] = () => (++calls === 1 ? json({ error: 'Something broke' }, 500) : json({ news: NEWS }))
    open(`/workspace/region/clubs/${ID}?tab=news`)
    await ready()
    await screen.findByText(/^The club's news could not be loaded: /, undefined, { timeout: 5000 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' })
    answers[`DELETE /api/admin/clubs/${ID}/news/n-1`] = () => json({ error: 'Forbidden' }, 403)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete: Example club night' })) })
    await waitFor(() => expect(statusText()).toContain('"Example club night" was not deleted: Forbidden.'))
    expect(screen.getByRole('heading', { level: 2, name: 'Posted news · 1' })).toBeTruthy()
  })

  it('shows an empty news list and an empty events list in words, never a blank tab', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor(CLUB, []))
    answers[`GET /api/admin/clubs/${ID}/news`] = () => json({ news: [] })
    open(`/workspace/region/clubs/${ID}?tab=events`)
    await ready()
    expect(within(eventsList()).getByText('No events are listed for Example Knights Club yet.')).toBeTruthy()
    await act(async () => { fireEvent.click(within(header()).getByRole('button', { name: 'News' })) })
    await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
    expect(within(header().nextElementSibling as HTMLElement).queryAllByRole('listitem')).toHaveLength(0)
    expect(document.body.textContent).toContain('Posted news')
  })
})

describe('stale answers and repeated presses', () => {
  const rooks = () => {
    answers[`GET /api/admin/clubs/${OTHER.id}`] = () => json(answerFor(OTHER, [event({ id: 't-rook', name: 'Example Rooks Open' })]))
    answers[`GET /api/admin/clubs/${OTHER.id}/news`] = () => json({ news: [] })
  }
  const goToRooks = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: `Go to /workspace/region/clubs/${OTHER.id}` })) })

  it('shows nothing of the club the page was on after it moves to another: not its events or its Still accurate stamp', async () => {
    rooks()
    open(`/workspace/region/clubs/${ID}?tab=events`)
    await ready()
    await act(async () => { fireEvent.click(within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })) })
    await waitFor(() => expect(within(header()).getByText('Example City · Bayou Region · Checked Nov 2026')).toBeTruthy())
    expect(within(eventsList()).getByText('Example Knights Open')).toBeTruthy()
    await goToRooks()
    await ready('Example Rooks Club')
    expect(within(header()).getByText('Example City · Bayou Region · Not checked yet')).toBeTruthy()
    expect(within(eventsList()).getByText('Example Rooks Open')).toBeTruthy()
    expect(within(eventsList()).queryByText('Example Knights Open')).toBeNull()
    expect(within(header()).queryByText(/Example Knights/)).toBeNull()
  })

  it('does not carry what Still accurate said of one club to the page of another', async () => {
    rooks()
    open(`/workspace/region/clubs/${ID}?tab=events`)
    await ready()
    await act(async () => { fireEvent.click(within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })) })
    await waitFor(() => expect(statusText()).toContain('Example Knights Club marked still accurate'))
    await goToRooks()
    await ready('Example Rooks Club')
    expect(statusText()).not.toContain('Example Knights Club')
  })

  it('does not carry a news post typed for one club to the form of another, which would post it there', async () => {
    rooks()
    open(`/workspace/region/clubs/${ID}?tab=news`)
    await ready()
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example note for the Knights' } })
    await goToRooks()
    await ready('Example Rooks Club')
    await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
  })

  it('sends one confirm for a double press of Still accurate, and one for a press after it answers', async () => {
    let release: (r: Response) => void = () => {}
    answers[`POST /api/admin/clubs/${ID}/confirm`] = () => new Promise<Response>((done) => { release = done })
    open(`/workspace/region/clubs/${ID}`)
    await ready()
    const still = within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })
    await act(async () => { fireEvent.click(still) })
    await act(async () => { fireEvent.click(still) })
    expect(asked.filter((c) => c.startsWith('POST '))).toHaveLength(1)
    expect(still.getAttribute('aria-disabled')).toBe('true')
    await act(async () => { release(json({ id: ID, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' })) })
    await waitFor(() => expect(statusText()).toContain('Example Knights Club marked still accurate: Checked Nov 2026.'))
    expect(still.getAttribute('aria-disabled')).toBeNull()
    answers[`POST /api/admin/clubs/${ID}/confirm`] = () => json({ id: ID, lastConfirmedAt: '2026-11-15 18:05:00', lastCheckWords: 'Checked Nov 2026' })
    await act(async () => { fireEvent.click(still) })
    expect(asked.filter((c) => c.startsWith('POST '))).toHaveLength(2)
  })

  it('says a failed Still accurate in words and leaves the stamp as it was', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor({ ...CLUB, last_confirmed_at: null }))
    answers[`POST /api/admin/clubs/${ID}/confirm`] = () => json({ error: 'Something broke' }, 500)
    open(`/workspace/region/clubs/${ID}`)
    await ready()
    await act(async () => { fireEvent.click(within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })) })
    await waitFor(() => expect(statusText()).toContain('Example Knights Club was not marked still accurate: '))
    expect(statusText()).toContain('Nothing changed.')
    expect(within(header()).getByText('Example City · Bayou Region · Not checked yet')).toBeTruthy()
  })
})

describe('who each event leads to', () => {
  async function events(who: Who, tournaments: Event[], tab = 'events') {
    answers[`GET /api/admin/clubs/${ID}`] = () => json(answerFor(CLUB, tournaments))
    open(`/workspace/region/clubs/${ID}?tab=${tab}`, who)
    await ready()
    return eventsList()
  }

  it('leads the director of one event to that event\'s manage page and every other event to its public page or nowhere', async () => {
    const list = await events({ role: 'member', managed: [ID], directs: ['t-open'] }, [OPEN, DRAFT])
    expect(within(list).getByRole('link', { name: 'Manage: Example Knights Open' })).toBeTruthy()
    expect(within(list).queryByRole('link', { name: /Example Winter Draft/ })).toBeNull()
  })

  it('leads a guest account that a seat or a director assignment names to a public page at most', async () => {
    const list = await events({ role: 'member', account: 'guest', managed: [ID], directs: ['t-open'] }, [OPEN])
    expect(within(list).queryByRole('link', { name: /^Manage/ })).toBeNull()
    expect(within(list).getByRole('link', { name: 'Event page: Example Knights Open' }).getAttribute('href')).toBe('/tournaments/t-open')
  })

  it('leads an observer who holds the region\'s seat to each event\'s manage page, which the observer may view', async () => {
    const list = await events({ role: 'lca_observer', managed: [ID] }, [OPEN, DRAFT])
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/admin/tournaments/t-open', '/admin/tournaments/t-draft'])
  })

  it('leads a club\'s rep over another club, who holds this region\'s seat, to public pages only, and a club\'s own rep with a seat to manage pages', async () => {
    let list = await events({ role: 'club_rep', club: 'c-other', managed: [ID] }, [OPEN, DRAFT])
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/tournaments/t-open'])
    cleanup()
    list = await events({ role: 'club_rep', club: ID, managed: [ID] }, [OPEN, DRAFT])
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/admin/tournaments/t-open', '/admin/tournaments/t-draft'])
  })
})

describe('the plain-language rules over the files that draw the page', () => {
  const FILES = [
    'src/pages/MyRegionClubPage.tsx',
    'src/areas/clubs/components/ClubEventsList.tsx',
    'src/areas/clubs/components/ClubNewsPanel.tsx',
    'test/unit/my-region-club-page.test.tsx',
    'test/unit/my-region-club-page-edges.test.tsx',
    'test/unit/admin-club-news-lift.test.tsx',
  ]

  it('writes no em dash or en dash anywhere, in code, comments or test names, except the one old comment the News tab\'s move kept in AdminClubPage', () => {
    const longDash = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    for (const file of FILES.slice(0, 5)) expect(read(file), file).not.toMatch(longDash)
    expect(read('test/unit/fixtures/admin-club-news-before.json')).not.toMatch(longDash)
  })

  it('names US Chess and never the old initials, and keeps out words that do not belong in the files of a club\'s page', () => {
    const banned = new RegExp(`\\b(?:${['cla' + 'ude', 'anthro' + 'pic', 'open' + 'ai', 'chat' + 'gpt', 'co' + 'pilot', 'assis' + 'tant', 'language ' + 'model'].join('|')})\\b`, 'i')
    for (const file of FILES) {
      const text = read(file)
      expect(text, file).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
      expect(text, file).not.toMatch(banned)
    }
  })

  it('writes no time as "7:00pm" or "19:00" and no fraction as ".5" in what the page says', () => {
    for (const file of FILES.slice(0, 3)) {
      const text = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(text, file).not.toMatch(/\b\d{1,2}:\d{2}\s?(?:am|pm|a\.m\.|p\.m\.)\b/i)
      expect(text, file).not.toMatch(/\b\d{1,2}:\d{2} (?:am|pm)\b/)
      expect(text, file).not.toMatch(/(?<![-\w.])\d+\.5(?![-\w])/)
    }
  })

  it('speaks of the club\'s page and never of "your" club or page on the page and its list', () => {
    for (const file of FILES.slice(0, 2)) {
      const words = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(words, file).not.toMatch(/\byour (?:club|page|listing)\b/i)
    }
  })

  it('sets gold as a fill or a rule on the page and never as the colour of its words', () => {
    for (const file of FILES.slice(0, 3)) expect(read(file), file).not.toMatch(/\btext-(?:lca-gold|gold|yellow)(?![-\w])/)
  })
})
