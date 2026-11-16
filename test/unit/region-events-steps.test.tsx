// @vitest-environment jsdom
//
// The creation steps opened from a club's Events tab in My region (WS09
// step 19), by who is adding: the club fixed and shown in words, the review's
// line for an event that waits for LCA approval and for one that does not,
// and no way to list an event at once. With regionEvents and clubKeepers
// turned on through a getter on the mocked
// FEATURES, and off again for the cases that hold what ships. Every page
// draws only what the server's answers say: the club's answer's
// `eventRights` (who may add an event, run the club's events, approve, and
// whether a payout request can go), the manage answer's `approval` (who may
// submit, approve or ask for changes), and My region's counts of the events
// in LCA review. The real pages run through the real client with fetch
// stubbed, so every request is read as it would leave the browser; the
// Events tab and the manage page's route run through the site's own routes
// in src/App.tsx, the guard among them. Every club, person and event here is
// made up ("Example Knights Club", "Player One", example.org).
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import { WAIT_HELP_SHOWN_KEY } from '@/areas/clubs/approval'

// Each case may wait for a page's file to load, so each case has 20 seconds.
vi.setConfig({ testTimeout: 20000 })

const flags = vi.hoisted(() => ({ clubKeepers: true, regionEvents: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))
vi.mock('@/pages/DashboardPage', async () => {
  const { createElement } = await import('react')
  return { DashboardPage: () => createElement('p', null, 'The dashboard') }
})

const { default: App } = await import('@/App')

const ID = 'c-knights'
const CLUB_URL = `/api/admin/clubs/${ID}`
const CLUB = {
  id: ID, name: 'Example Knights Club', city: 'Example City', location: 'Example Library', description: null, meeting_schedule: null,
  contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region',
}
/** The approval wait's three columns, by state, the times stored in UTC. */
const WAIT = {
  none: { needs_lca_approval: 0, approval_requested_at: null, approved_at: null },
  draft: { needs_lca_approval: 1, approval_requested_at: null, approved_at: null },
  review: { needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: null },
  approved: { needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: '2026-11-16 15:00:00' },
}
const LISTED = { id: 't-open', name: 'Example Knights Open', date: '2026-12-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open' }
const DRAFT = { id: 't-draft', name: 'Example Winter Quads', date: '2027-01-09', end_date: null, status: 'upcoming', is_visible: 0, registration_status: 'draft', ...WAIT.draft }
const IN_REVIEW = { id: 't-review', name: 'Example Spring Swiss', date: '2027-03-06', end_date: null, status: 'upcoming', is_visible: 0, registration_status: 'draft', ...WAIT.review }
const APPROVED = { id: 't-approved', name: 'Example Summer Rapid', date: '2027-06-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open', ...WAIT.approved }

const REP_RIGHTS = { add: 'for_approval', manage: true, decide: false, askPayout: false }
const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
type Answer = (body: unknown) => Response | Promise<Response>
let asked: Array<{ call: string; body: unknown }> = []
let answers: Record<string, Answer> = {}

beforeEach(() => {
  flags.clubKeepers = true
  flags.regionEvents = true
  window.localStorage.clear()
  for (const key of [HELP_SHOWN_KEY, REGION_HELP_SHOWN_KEY, WAIT_HELP_SHOWN_KEY]) window.localStorage.setItem(key, 'shown')
  asked = []
  answers = {
    [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
    'GET /api/me': () => json({ member: { id: 'm-viewer', role: 'member', club_id: null, full_name: 'Player One' }, registrations: [], directedTournaments: [] }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url.split('?')[0]}`
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    asked.push({ call, body })
    const answer = answers[call]
    return answer ? answer(body) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Where() {
  const { pathname } = useLocation()
  return <output data-testid="where">{pathname}</output>
}
const callsTo = (call: string) => asked.filter((a) => a.call === call)

interface Person { id: string; role: string; club?: string | null; seats?: unknown[]; managed?: string[]; directed?: string[] }
const REPRESENTATIVE: Person = { id: 'm-rep', role: 'member', seats: [REGIONAL], managed: [ID] }

function authFor(who: Person): AuthContextValue {
  return {
    user: { id: who.id }, session: null, role: who.role,
    member: { id: who.id, role: who.role, club_id: who.club ?? null, full_name: 'Player One', email: 'player.one@example.org' },
    loading: false, memberLoading: false, seats: who.seats ?? [], managedClubs: (who.managed ?? []).map((id) => ({ id, name: 'Example Club', region: 'Bayou Region' })),
    isBoardMember: (who.seats ?? []).length > 0, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournamentIds: who.directed ?? [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

/** The site at this address for this person, through its own routes. */
function openSite(who: Person, path: string) {
  render(
    <AuthContext.Provider value={authFor(who)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** The club's answer as the server gives it with REGION_EVENTS_ON set, or, with rights null, as checkpoint S's answer gives it to a person the region alone admits. */
function clubAnswer(rights: Record<string, unknown> | null, tournaments: unknown[] = [LISTED, DRAFT, IN_REVIEW, APPROVED]) {
  return rights
    ? { club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments, places: [], eventRights: rights }
    : { club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments, places: [] }
}

/** The club's Events tab in My region for this person, once the club has come. */
async function openEventsTab(who: Person = REPRESENTATIVE) {
  openSite(who, `/workspace/region/clubs/${ID}?tab=events`)
  await screen.findByRole('heading', { level: 1, name: 'Example Knights Club' }, { timeout: 5000 })
  await screen.findByRole('heading', { level: 2, name: 'Events' })
}

/** Add a club event, then the creation steps' first two steps, the basics filled. */
async function openStepsToBasics() {
  fireEvent.click(screen.getByRole('button', { name: 'Add a club event' }))
  await screen.findByRole('heading', { level: 2, name: 'Add a club event for Example Knights Club' }, { timeout: 5000 })
  fireEvent.click(await screen.findByRole('button', { name: /Continue/ }))
  fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Example Club Quads' } })
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-02-06' } })
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Example City' } })
}
const fees = () => screen.getAllByRole('spinbutton') as HTMLInputElement[]


describe('the creation steps from the Events tab, by who is adding', () => {
  /** Through the steps to the review, the basics filled and one section added. */
  async function toReview() {
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    fireEvent.click(await screen.findByRole('button', { name: /Next: Schedule/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Review/ }))
  }

  it('says in the review that an event for approval waits for LCA, and sends nothing until the person creates it', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await toReview()
    expect(screen.getByText(/It waits for LCA approval/)).toBeTruthy()
    expect(screen.queryByText(/hidden from the public/)).toBeNull()
    expect(callsTo('POST /api/admin/tournaments')).toEqual([])
  })

  it('opens the same steps with the club fixed for a person the create admits without approval, with no notice for a fee and today\'s review words', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer({ add: 'yes', manage: true, decide: false, askPayout: false }))
    await openEventsTab()
    await openStepsToBasics()
    const basics = screen.getByText('Organizing club').parentElement as HTMLElement
    expect(within(basics).getByText('Example Knights Club')).toBeTruthy()
    expect(document.getElementById('t-club')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '25' } })
    expect(screen.queryByRole('note', { name: 'Entry fees need a payout account first' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /Next: Schedule/ }))
    fireEvent.click(await screen.findByRole('button', { name: /^Review/ }))
    expect(screen.getByText(/hidden from the public/)).toBeTruthy()
    expect(screen.queryByText(/It waits for LCA approval/)).toBeNull()
  })

  it('draws no choice of listing the event at once in the steps, for a representative or anyone, with the wait in words in the review instead', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await toReview()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: /visible|public|list/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /publish|list it|visible/i })).toBeNull()
  })

  it('keeps the club fixed when the person goes back and forward through the steps', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await toReview()
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    expect(within(screen.getByText('Organizing club').parentElement as HTMLElement).getByText('Example Knights Club')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
