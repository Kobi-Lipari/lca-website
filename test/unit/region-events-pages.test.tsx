// @vitest-environment jsdom
//
// The regional representatives' club events on the pages (WS09 step 19),
// with regionEvents and clubKeepers turned on through a getter on the mocked
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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'
import { REGION_HELP_SHOWN_KEY, SITE_UNREACHED } from '@/areas/clubs/region'
import { WAIT_HELP_SHOWN_KEY } from '@/areas/clubs/approval'
import { WAITING_FOR_APPROVAL } from '@domain/events/approval'
import { APPROVAL_NOTE_EMPTY, APPROVAL_NOTE_TOO_LONG } from '@domain/contracts/events'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

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
const { TournamentManagePage } = await import('@/pages/TournamentManagePage')
const { AdminClubPage } = await import('@/pages/AdminClubPage')
const { RegionClubCard } = await import('@/areas/clubs/components/RegionClubCard')
const { ThisMonthBar } = await import('@/areas/clubs/components/ThisMonthBar')

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
const where = () => screen.getByTestId('where').textContent
const callsTo = (call: string) => asked.filter((a) => a.call === call)

interface Person { id: string; role: string; club?: string | null; seats?: unknown[]; managed?: string[]; directed?: string[] }
const REPRESENTATIVE: Person = { id: 'm-rep', role: 'member', seats: [REGIONAL], managed: [ID] }
const OTHER_REGION: Person = { id: 'm-other', role: 'member', seats: [REGIONAL], managed: ['c-rooks'] }
const ADMIN: Person = { id: 'm-admin', role: 'lca_admin' }
const OWN_REP: Person = { id: 'm-own', role: 'club_rep', club: ID }
const NAMED_DIRECTOR: Person = { id: 'm-td', role: 'member', directed: ['t1'] }

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

describe('the Events tab of a club in My region, with regionEvents on', () => {
  it('Add a club event is drawn for a person the create admits for the club, and not for one it does not', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    expect(screen.getByRole('button', { name: 'Add a club event' })).toBeTruthy()
    cleanup()
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer({ ...REP_RIGHTS, add: 'no' }))
    await openEventsTab()
    expect(screen.queryByRole('button', { name: 'Add a club event' })).toBeNull()
  })

  it('Add a club event opens the steps with the club fixed: shown in words, with no picker, and the create sends that club alone', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await openStepsToBasics()
    const basics = screen.getByText('Organizing club').parentElement as HTMLElement
    expect(within(basics).getByText('Example Knights Club')).toBeTruthy()
    expect(document.getElementById('t-club')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
    answers['POST /api/admin/tournaments'] = () => json({ tournament: { id: 't-new', name: 'Example Club Quads' } }, 201)
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(callsTo('POST /api/admin/tournaments')).toHaveLength(1))
    expect((callsTo('POST /api/admin/tournaments')[0].body as { clubId: string }).clubId).toBe(ID)
  })

  it('after the create the person is on the event\'s manage page, the guard asking the server, which says they manage it', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    answers['POST /api/admin/tournaments'] = () => json({ tournament: { id: 't-new', name: 'Example Club Quads' } }, 201)
    answers['GET /api/admin/tournaments/t-new/directors'] = () => json({ directors: [] })
    answers['GET /api/admin/tournaments/t-new/manage'] = () => json(manageAnswer({ id: 't-new', name: 'Example Club Quads', ...WAIT.draft }, { maySubmit: true, mayDecide: false }))
    await openEventsTab()
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByRole('heading', { level: 1, name: 'Example Club Quads' }, { timeout: 5000 })
    expect(where()).toBe('/admin/tournaments/t-new')
    expect(callsTo('GET /api/admin/tournaments/t-new/directors')).toHaveLength(1)
  })

  it('the fee notice shows for a representative above $0 in G1\'s words, and its ask is drawn only where it can go through', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    expect(screen.queryByRole('note', { name: 'Entry fees need a payout account first' })).toBeNull()
    fireEvent.change(fees()[0], { target: { value: '25' } })
    const note = screen.getByRole('note', { name: 'Entry fees need a payout account first' })
    expect(note.textContent).toContain('LCA takes entry fees through its own Stripe account.')
    expect(note.textContent).toContain('Until then, your event can run at $0.')
    expect(within(note).getByRole('button', { name: 'Keep it at $0' })).toBeTruthy()
    // CREATION_ROLES_ON unset: the payout request would only be refused, so its button is not drawn.
    expect(within(note).queryByRole('button', { name: 'Ask LCA to set up my payout account' })).toBeNull()
    expect(callsTo('GET /api/me/tournament-creation')).toEqual([])
    cleanup()
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer({ ...REP_RIGHTS, askPayout: true }))
    await openEventsTab()
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '25' } })
    expect(screen.getByRole('button', { name: 'Ask LCA to set up my payout account' })).toBeTruthy()
  })

  it('Keep it at $0 sets the fee back to $0 and returns the focus to the fee\'s field', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '25' } })
    const keep = screen.getByRole('button', { name: 'Keep it at $0' })
    keep.focus()
    // A press from the keyboard is a click whose detail is 0.
    fireEvent.click(keep, { detail: 0 })
    expect(screen.queryByRole('note', { name: 'Entry fees need a payout account first' })).toBeNull()
    expect(fees()[0].value).toBe('0')
    expect(document.activeElement).toBe(fees()[0])
  })

  it('Keep it at $0 pressed with a mouse or a tap returns the focus to the fee\'s field too, never to the page', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    await openStepsToBasics()
    fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '25' } })
    const keep = screen.getByRole('button', { name: 'Keep it at $0' })
    keep.focus()
    // A mouse click or a tap is a click whose detail is 1.
    fireEvent.click(keep, { detail: 1 })
    expect(screen.queryByRole('note', { name: 'Entry fees need a payout account first' })).toBeNull()
    expect(fees()[0].value).toBe('0')
    expect(document.activeElement).toBe(fees()[0])
    expect(document.activeElement).not.toBe(document.body)
  })

  it('lists a representative\'s draft, the event in review and the approved one with the wait in words, each linked to its manage page', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS))
    await openEventsTab()
    const list = within(screen.getByRole('region', { name: 'Events' })).getByRole('list')
    const row = (name: string) => within(list).getByText(name).closest('li') as HTMLElement
    expect(row('Example Winter Quads').textContent).toContain('Draft, not public')
    expect(row('Example Winter Quads').textContent).toContain('Draft. Not sent for LCA review yet.')
    expect(row('Example Spring Swiss').textContent).toContain('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')
    expect(row('Example Summer Rapid').textContent).toContain('Approved by LCA on Mon, Nov 16, 2026.')
    expect(row('Example Knights Open').textContent).not.toContain('LCA approval')
    for (const name of ['Example Winter Quads', 'Example Spring Swiss', 'Example Summer Rapid', 'Example Knights Open']) {
      expect(within(row(name)).getByRole('link', { name: `Manage: ${name}` }).getAttribute('href'), name).toMatch(/^\/admin\/tournaments\//)
    }
    expect(screen.queryByText('Drafts stay with LCA admins and the club\'s own rep.')).toBeNull()
  })

  it('with the constant unset the answer is checkpoint S\'s and so is the list: listed events alone, no manage link and the drafts sentence', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(null, [LISTED]))
    await openEventsTab()
    expect(screen.queryByRole('button', { name: 'Add a club event' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Event page: Example Knights Open' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /^Manage:/ })).toBeNull()
    cleanup()
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(null, []))
    await openEventsTab()
    expect(screen.getByText('Drafts stay with LCA admins and the club\'s own rep.')).toBeTruthy()
  })
})

/** The manage answer for an event of the club, with the wait's columns and, with REGION_EVENTS_ON set, its `approval`. */
function manageAnswer(over: Record<string, unknown> = {}, approval: { maySubmit: boolean; mayDecide: boolean } | null = null) {
  const tournament = {
    id: 't1', name: 'Example Winter Quads', location: 'Example City', venue: null, date: '2027-01-09', end_date: null,
    entry_fee: 0, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0, member_discount: 0, requires_lca_membership: 0,
    sections: [{ id: 'sec-open', name: 'Open', entryFee: 0, cap: null, fees: { regular: 0, early: null, late: null } }], rounds: 3, max_players: null,
    status: 'upcoming', description: null, registration_deadline: null, club_id: ID, created_by: 'm-rep', created_at: '2026-11-10 18:00:00',
    registration_status: 'draft', registration_opens_at: null, is_rated: 1, is_visible: 0, round_schedule: [], registration_closes_at: null,
    custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0,
    keep_apart: 'family', report_settings: null, is_state_championship: 0, review_notified_at: null, club_name: 'Example Knights Club', club_color: null,
    approved_by: null, ...WAIT.draft, ...over,
  }
  return { tournament, roster: [], games: [], standings: [], prizes: [], directors: [], ...(approval ? { approval } : {}) }
}

/** The manage page for this person, at a tab, once the event has come. */
async function openManage(who: Person, answer: unknown, tab = 'details') {
  answers['GET /api/admin/tournaments/t1/manage'] = () => json(answer)
  render(
    <AuthContext.Provider value={authFor(who)}>
      <MemoryRouter initialEntries={[`/admin/tournaments/t1?tab=${tab}`]}>
        <Routes><Route path="/admin/tournaments/:id" element={<TournamentManagePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1 })
  await act(async () => {})
}
const panel = () => screen.queryByRole('region', { name: 'LCA approval' })
const statusOf = (el: HTMLElement) => within(el).getAllByRole('status').at(-1) as HTMLElement

describe('the manage page route, with regionEvents on and off', () => {
  it('the guard lets a plain member with a seat into an event of their region once the server says they manage it', async () => {
    answers['GET /api/admin/tournaments/t1/directors'] = () => json({ directors: [] })
    answers['GET /api/admin/tournaments/t1/manage'] = () => json(manageAnswer({}, { maySubmit: true, mayDecide: false }))
    openSite(REPRESENTATIVE, '/admin/tournaments/t1')
    await screen.findByRole('heading', { level: 1, name: 'Example Winter Quads' }, { timeout: 5000 })
    expect(where()).toBe('/admin/tournaments/t1')
  })

  it('the guard turns away another region\'s representative, whom the server refuses', async () => {
    answers['GET /api/admin/tournaments/t1/directors'] = () => json({ error: 'Forbidden' }, 403)
    openSite(OTHER_REGION, '/admin/tournaments/t1')
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    expect(where()).toBe('/dashboard')
    expect(callsTo('GET /api/admin/tournaments/t1/manage')).toEqual([])
  })

  it('with regionEvents off the guard answers as on the base: the plain member is sent away and nothing is asked', async () => {
    flags.regionEvents = false
    answers['GET /api/admin/tournaments/t1/directors'] = () => json({ directors: [] })
    openSite(REPRESENTATIVE, '/admin/tournaments/t1')
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    expect(where()).toBe('/dashboard')
    expect(callsTo('GET /api/admin/tournaments/t1/directors')).toEqual([])
  })
})

describe('the manage page shows the wait and the right buttons per person', () => {
  it('gives a draft\'s state in words with Submit for LCA review for the drafter, and Publish absent with its reason in words', async () => {
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }), 'registration')
    const wait = panel() as HTMLElement
    expect(within(wait).getByRole('heading', { name: 'LCA approval' })).toBeTruthy()
    expect(wait.textContent).toContain('Draft. Not sent for LCA review yet.')
    expect(within(wait).getByRole('button', { name: 'Submit for LCA review' })).toBeTruthy()
    expect(within(wait).queryByRole('button', { name: 'Approve and publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Visible to public' })).toBeNull()
    expect(screen.getByText(`Hidden (draft). ${WAITING_FOR_APPROVAL}`)).toBeTruthy()
  })

  it('gives in review with its day, and approved with its day, after which Publish is today\'s again', async () => {
    await openManage(REPRESENTATIVE, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: false }), 'registration')
    expect((panel() as HTMLElement).textContent).toContain('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')
    expect(within(panel() as HTMLElement).queryByRole('button', { name: /Submit for LCA review|Approve and publish|Ask for changes/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Visible to public' })).toBeNull()
    cleanup()
    await openManage(REPRESENTATIVE, manageAnswer({ ...WAIT.approved, is_visible: 1 }, { maySubmit: false, mayDecide: false }), 'registration')
    expect(within(panel() as HTMLElement).getByRole('heading', { name: 'LCA approval' })).toBeTruthy()
    expect((panel() as HTMLElement).textContent).toContain('Approved by LCA on Mon, Nov 16, 2026.')
    expect(screen.getByRole('button', { name: 'Visible to public' })).toBeTruthy()
  })

  it('gives an LCA admin Approve and publish and Ask for changes in review, and neither to a club rep or a named director', async () => {
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }))
    const wait = panel() as HTMLElement
    expect(within(wait).getByRole('button', { name: 'Approve and publish' })).toBeTruthy()
    expect(within(wait).getByRole('button', { name: 'Ask for changes' })).toBeTruthy()
    for (const who of [OWN_REP, NAMED_DIRECTOR]) {
      cleanup()
      await openManage(who, manageAnswer(WAIT.review, { maySubmit: false, mayDecide: false }))
      const theirs = panel() as HTMLElement
      expect(theirs.textContent, who.id).toContain('Sent for review on Sat, Nov 14, 2026.')
      expect(within(theirs).queryByRole('button', { name: /Approve and publish|Ask for changes|Submit for LCA review/ }), who.id).toBeNull()
    }
  })

  it('each move redraws the page from the answer, says what happened in the email\'s own sentence and keeps the focus', async () => {
    answers['POST /api/admin/tournaments/t1/approval'] = () => json({ ...WAIT.review, approved_by: null, email: 'Sent for LCA review. The LCA admins were emailed.' })
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    const submit = within(panel() as HTMLElement).getByRole('button', { name: 'Submit for LCA review' })
    submit.focus()
    fireEvent.click(submit)
    await waitFor(() => expect(statusOf(panel() as HTMLElement).textContent).toBe('Sent for LCA review. The LCA admins were emailed.'))
    expect(callsTo('POST /api/admin/tournaments/t1/approval').map((c) => c.body)).toEqual([{ action: 'submit' }])
    expect((panel() as HTMLElement).textContent).toContain('Sent for review on Sat, Nov 14, 2026.')
    expect(within(panel() as HTMLElement).queryByRole('button', { name: 'Submit for LCA review' })).toBeNull()
    expect(document.activeElement).toBe(statusOf(panel() as HTMLElement))
    cleanup()
    answers['POST /api/admin/tournaments/t1/approval'] = () => json({ ...WAIT.approved, approved_by: 'm-admin', email: 'Approved and listed. The person who drafted it was emailed.' })
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }), 'registration')
    fireEvent.click(within(panel() as HTMLElement).getByRole('button', { name: 'Approve and publish' }))
    await waitFor(() => expect(statusOf(panel() as HTMLElement).textContent).toBe('Approved and listed. The person who drafted it was emailed.'))
    expect((panel() as HTMLElement).textContent).toContain('Approved by LCA on Mon, Nov 16, 2026.')
    expect(document.activeElement).toBe(statusOf(panel() as HTMLElement))
    expect(screen.getByRole('button', { name: 'Visible to public' })).toBeTruthy()
  })

  it('a failed press changes nothing on the page and says so, in the server\'s words or, with no answer at all, in My region\'s', async () => {
    answers['POST /api/admin/tournaments/t1/approval'] = () => json({ error: 'This event is already approved.' }, 409)
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }))
    const approve = within(panel() as HTMLElement).getByRole('button', { name: 'Approve and publish' })
    approve.focus()
    fireEvent.click(approve)
    await waitFor(() => expect(statusOf(panel() as HTMLElement).textContent).toBe('Nothing changed: This event is already approved.'))
    expect((panel() as HTMLElement).textContent).toContain('Sent for review on Sat, Nov 14, 2026.')
    // A 409 moves the focus to the status line, since the read again may take the button away.
    await waitFor(() => expect(document.activeElement).toBe(statusOf(panel() as HTMLElement)))
    // The 409 reads the manage answer again, which here still says in review, so the panel stays as it was.
    await waitFor(() => expect(callsTo('GET /api/admin/tournaments/t1/manage')).toHaveLength(2))
    answers['POST /api/admin/tournaments/t1/approval'] = () => { throw new TypeError('Failed to fetch') }
    fireEvent.click(approve)
    await waitFor(() => expect(statusOf(panel() as HTMLElement).textContent).toBe(`Nothing changed: ${SITE_UNREACHED}`))
    expect(within(panel() as HTMLElement).getByRole('button', { name: 'Ask for changes' })).toBeTruthy()
    // Any other failure reads nothing again.
    expect(callsTo('GET /api/admin/tournaments/t1/manage')).toHaveLength(2)
  })

  it('the note\'s form refuses an empty note and one over 500 characters in words tied to the field, and Cancel returns the focus', async () => {
    const refusal = (words: string) => () => json({ error: 'Some fields are missing or not valid.', fields: { note: words } }, 400)
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }))
    const ask = within(panel() as HTMLElement).getByRole('button', { name: 'Ask for changes' })
    fireEvent.click(ask)
    const field = screen.getByLabelText('What needs to change (500 characters at most)') as HTMLTextAreaElement
    expect(document.activeElement).toBe(field)
    answers['POST /api/admin/tournaments/t1/approval'] = refusal(APPROVAL_NOTE_EMPTY)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe(APPROVAL_NOTE_EMPTY)
    expect(document.activeElement).toBe(field)
    answers['POST /api/admin/tournaments/t1/approval'] = refusal(APPROVAL_NOTE_TOO_LONG)
    fireEvent.change(field, { target: { value: 'x'.repeat(501) } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe(APPROVAL_NOTE_TOO_LONG))
    expect(callsTo('POST /api/admin/tournaments/t1/approval').map((c) => (c.body as { note: string }).note.length)).toEqual([0, 501])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('What needs to change (500 characters at most)')).toBeNull()
    expect(document.activeElement).toBe(ask)
    // After Send goes through, the form goes and the status line says the answer's sentence.
    fireEvent.click(ask)
    fireEvent.change(screen.getByLabelText('What needs to change (500 characters at most)'), { target: { value: 'Please give the round times.' } })
    answers['POST /api/admin/tournaments/t1/approval'] = () => json({ ...WAIT.draft, approved_by: null, email: 'Changes asked. The person who drafted it was emailed your note.' })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(statusOf(panel() as HTMLElement).textContent).toBe('Changes asked. The person who drafted it was emailed your note.'))
    expect((panel() as HTMLElement).textContent).toContain('Draft. Not sent for LCA review yet.')
    expect(document.activeElement).toBe(statusOf(panel() as HTMLElement))
  })

  it('gives an LCA admin on a draft Approve and publish and no Submit for LCA review, and the drafter Submit alone', async () => {
    await openManage(ADMIN, manageAnswer({}, { maySubmit: true, mayDecide: true }))
    expect(within(panel() as HTMLElement).getAllByRole('button').map((b) => b.textContent?.trim()).filter((t) => t !== 'Help')).toEqual(['Approve and publish'])
    cleanup()
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    expect(within(panel() as HTMLElement).getAllByRole('button').map((b) => b.textContent?.trim()).filter((t) => t !== 'Help')).toEqual(['Submit for LCA review'])
  })

  it('after a 409 reads the manage answer again and redraws the panel to what is true, keeping the status line\'s words', async () => {
    answers['POST /api/admin/tournaments/t1/approval'] = () => json({ error: 'This event is already approved.' }, 409)
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }))
    // The page is read again after the refusal: by then another LCA admin has approved it.
    answers['GET /api/admin/tournaments/t1/manage'] = () => json(manageAnswer({ ...WAIT.approved, is_visible: 1 }, { maySubmit: false, mayDecide: false }))
    fireEvent.click(within(panel() as HTMLElement).getByRole('button', { name: 'Approve and publish' }))
    await waitFor(() => expect((panel() as HTMLElement).textContent).toContain('Approved by LCA on Mon, Nov 16, 2026.'))
    expect(statusOf(panel() as HTMLElement).textContent).toBe('Nothing changed: This event is already approved.')
    expect(within(panel() as HTMLElement).queryByRole('button', { name: /Approve and publish|Ask for changes/ })).toBeNull()
    // The button pressed is gone, and the focus is on the status line, not the page's body.
    await waitFor(() => expect(document.activeElement).toBe(statusOf(panel() as HTMLElement)))
  })

  it('the back link takes a plain-member representative to My region, and everyone the tools pages let in where it took them', async () => {
    const back = () => screen.getByRole('link', { name: /^(All Tournaments|My region)$/ })
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    expect(back().textContent).toBe('My region')
    expect(back().getAttribute('href')).toBe('/workspace/region')
    const today: Array<[Person, string]> = [[ADMIN, '/admin/tournaments'], [OWN_REP, '/workspace?tab=events'], [NAMED_DIRECTOR, '/workspace?tab=events']]
    for (const [who, href] of today) {
      cleanup()
      await openManage(who, manageAnswer({}, { maySubmit: false, mayDecide: who === ADMIN }))
      expect(back().textContent, who.id).toBe('All Tournaments')
      expect(back().getAttribute('href'), who.id).toBe(href)
    }
    // With regionEvents off the representative's link is today's.
    cleanup()
    flags.regionEvents = false
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    expect(back().textContent).toBe('All Tournaments')
    expect(back().getAttribute('href')).toBe('/workspace?tab=events')
  })

  it('Help opens by itself once, on the first visit, and not again', async () => {
    window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    const help = within(panel() as HTMLElement).getByRole('button', { name: 'Help' })
    expect(help.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: 'Help' }).textContent).toContain('An LCA admin.')
    expect(window.localStorage.getItem(WAIT_HELP_SHOWN_KEY)).toBe('shown')
    cleanup()
    await openManage(REPRESENTATIVE, manageAnswer({}, { maySubmit: true, mayDecide: false }))
    expect(within(panel() as HTMLElement).getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
  })
})

describe('the admin club page\'s Tournaments tab, with regionEvents on', () => {
  async function openClub(who: Person, answer: unknown) {
    answers[`GET ${CLUB_URL}`] = () => json(answer)
    render(
      <AuthContext.Provider value={authFor(who)}>
        <MemoryRouter initialEntries={[`/admin/clubs/${ID}?tab=tournaments`]}>
          <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 2, name: 'Club tournaments' })
    await act(async () => {})
  }

  const ADMIN_RIGHTS = { add: 'yes', manage: true, decide: true, askPayout: false }
  const SECOND_REVIEW = { id: 't-review-2', name: 'Example Autumn Blitz', date: '2027-04-03', end_date: null, status: 'upcoming', is_visible: 0, registration_status: 'draft', ...WAIT.review }

  it('gives an LCA admin a row for each event in review alone, headed by its name and date, each button once by its full name, and nobody else any', async () => {
    const admin = { ...clubAnswer(ADMIN_RIGHTS, [LISTED, DRAFT, IN_REVIEW, SECOND_REVIEW, APPROVED]), rosterKeptBack: undefined }
    await openClub(ADMIN, admin)
    const waiting = await screen.findByRole('region', { name: 'Events waiting for LCA approval' })
    const rows = within(waiting).getAllByRole('listitem')
    // The draft not yet sent is not listed; an LCA admin approves it from its manage page.
    expect(rows).toHaveLength(2)
    expect(within(waiting).queryByText('Example Winter Quads')).toBeNull()
    // The headings in order: the tab's, the section's, then one for each row naming the event and its date; no second heading in a row.
    expect(screen.getAllByRole('heading').map((h) => `${h.tagName} ${h.textContent}`).filter((h) => /^H[2-4] (Club tournaments|Events waiting|Example)/.test(h))).toEqual([
      'H2 Club tournaments',
      'H3 Events waiting for LCA approval',
      'H4 Example Spring Swiss, Sat, Mar 6, 2027',
      'H4 Example Autumn Blitz, Sat, Apr 3, 2027',
    ])
    for (const row of rows) expect(within(row).getAllByRole('heading')).toHaveLength(1)
    for (const name of ['Example Spring Swiss', 'Example Autumn Blitz']) {
      expect(screen.getAllByRole('button', { name: `Approve and publish: ${name}` }), name).toHaveLength(1)
      expect(screen.getAllByRole('button', { name: `Ask for changes: ${name}` }), name).toHaveLength(1)
    }
    // The words a person sees are unchanged, and each row gives the wait's state line.
    expect(within(rows[0]).getByRole('button', { name: 'Approve and publish: Example Spring Swiss' }).textContent?.trim()).toBe('Approve and publish')
    expect(rows[0].textContent).toContain('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')
    cleanup()
    await openClub(OWN_REP, clubAnswer({ add: 'yes', manage: true, decide: false, askPayout: false }))
    expect(screen.queryByRole('region', { name: 'Events waiting for LCA approval' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Approve and publish/ })).toBeNull()
  })

  it('draws nothing for an LCA admin when no event is in review, a draft not yet sent included', async () => {
    await openClub(ADMIN, { ...clubAnswer(ADMIN_RIGHTS, [LISTED, DRAFT, APPROVED]), rosterKeptBack: undefined })
    await waitFor(() => expect(callsTo(`GET ${CLUB_URL}`).length).toBeGreaterThanOrEqual(2))
    expect(screen.queryByRole('region', { name: 'Events waiting for LCA approval' })).toBeNull()
    expect(screen.queryByText(/LCA approval/)).toBeNull()
  })

  it('after a 409 reads the club again, keeps the row and its status line\'s words, and redraws the row to what is true', async () => {
    answers['POST /api/admin/tournaments/t-review/approval'] = () => json({ error: 'This event is already approved.' }, 409)
    await openClub(ADMIN, { ...clubAnswer(ADMIN_RIGHTS, [IN_REVIEW]), rosterKeptBack: undefined })
    const waiting = await screen.findByRole('region', { name: 'Events waiting for LCA approval' })
    const reads = callsTo(`GET ${CLUB_URL}`).length
    // By the time the club is read again another LCA admin has approved the event.
    answers[`GET ${CLUB_URL}`] = () => json({ ...clubAnswer(ADMIN_RIGHTS, [{ ...IN_REVIEW, ...WAIT.approved, is_visible: 1 }]), rosterKeptBack: undefined })
    fireEvent.click(within(waiting).getByRole('button', { name: 'Approve and publish: Example Spring Swiss' }))
    await waitFor(() => expect(within(waiting).getByRole('listitem').textContent).toContain('Approved by LCA on Mon, Nov 16, 2026.'))
    expect(callsTo(`GET ${CLUB_URL}`)).toHaveLength(reads + 1)
    expect(within(waiting).getByRole('status').textContent).toBe('Nothing changed: This event is already approved.')
    expect(within(waiting).queryByRole('button', { name: /Approve and publish|Ask for changes/ })).toBeNull()
    // The button pressed is gone, and the focus is on the row's status line, not the page's body.
    await waitFor(() => expect(document.activeElement).toBe(within(waiting).getByRole('status')))
  })

  it('leaves the drafts sentence out of the empty tab when the club\'s answer carries eventRights, and keeps it word for word without', async () => {
    // Another club's rep who holds the region's seat: the tab is theirs, and the club's roster is kept back from them.
    const seatHoldingRep: Person = { id: 'm-rooks', role: 'club_rep', club: 'c-rooks', seats: [REGIONAL], managed: [ID] }
    await openClub(seatHoldingRep, clubAnswer(REP_RIGHTS, []))
    // The words read the club's answer once more, with regionEvents on.
    await waitFor(() => expect(callsTo(`GET ${CLUB_URL}`)).toHaveLength(2))
    await act(async () => {})
    expect(screen.getByText('Published tournaments of Example Knights Club show up here.')).toBeTruthy()
    expect(screen.queryByText(/Drafts stay with LCA admins/)).toBeNull()
    cleanup()
    await openClub(seatHoldingRep, clubAnswer(null, []))
    expect(await screen.findByText('Published tournaments of Example Knights Club show up here. Drafts stay with LCA admins and the club\'s own rep.')).toBeTruthy()
    // With regionEvents off the words are today's at once, with no read more.
    cleanup()
    flags.regionEvents = false
    asked = []
    await openClub(seatHoldingRep, clubAnswer(REP_RIGHTS, []))
    expect(screen.getByText('Published tournaments of Example Knights Club show up here. Drafts stay with LCA admins and the club\'s own rep.')).toBeTruthy()
    expect(callsTo(`GET ${CLUB_URL}`)).toHaveLength(1)
  })
})

const CARD: RegionClub = {
  id: ID, name: 'Example Knights Club', city: 'Example City', region: 'Bayou Region', color: null, logoUrl: null, statement: null,
  lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 3, openItems: [],
}
const MONTH: WorkspaceRegionResponse['thisMonth'] = { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 1, notChecked: 1 }
const bar = (thisMonth: WorkspaceRegionResponse['thisMonth']) => render(<ThisMonthBar thisMonth={thisMonth} hasClubs toConfirm={0} running={false} onConfirmAll={() => {}} />)
const card = (club: RegionClub) => render(<MemoryRouter><RegionClubCard club={club} busy={false} error={null} onConfirm={() => {}} /></MemoryRouter>)
const parts = () => [...document.querySelectorAll('section[aria-labelledby="this-month-title"] p')].map((p) => p.textContent?.replace(/^· /, ''))

describe('My region\'s card and This month bar, with regionEvents on', () => {
  it('the card and the bar count an event in review, two, and none when none', () => {
    card({ ...CARD, inReview: 1 })
    expect(screen.getByText('Event in LCA review')).toBeTruthy()
    cleanup()
    card({ ...CARD, inReview: 2 })
    expect(screen.getByText('2 events in LCA review')).toBeTruthy()
    cleanup()
    card({ ...CARD, inReview: 0 })
    expect(screen.queryByText(/in LCA review/)).toBeNull()
    cleanup()
    bar({ ...MONTH, inReview: 1 })
    expect(parts()).toContain('1 event in review')
    cleanup()
    bar({ ...MONTH, inReview: 2 })
    expect(parts()).toContain('2 events in review')
    // On a phone each part is its own line, and its separator is drawn only from lg up, so no line starts with one.
    const last = [...document.querySelectorAll('section[aria-labelledby="this-month-title"] p')].at(-1) as HTMLElement
    expect(last.querySelector('span[aria-hidden="true"]')?.getAttribute('class')).toBe('hidden lg:inline')
    cleanup()
    bar({ ...MONTH, inReview: 0 })
    expect(parts().some((p) => p?.includes('in review'))).toBe(false)
  })
})

describe('with regionEvents off, as this step ships', () => {
  beforeEach(() => { flags.regionEvents = false })

  it('with regionEvents off none of it shows, whatever the answers carry', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(clubAnswer(REP_RIGHTS, [LISTED]))
    await openEventsTab()
    expect(screen.queryByRole('button', { name: 'Add a club event' })).toBeNull()
    expect(screen.queryByRole('link', { name: /^Manage:/ })).toBeNull()
    expect(screen.queryByText(/LCA approval/)).toBeNull()
    cleanup()
    await openManage(ADMIN, manageAnswer(WAIT.review, { maySubmit: true, mayDecide: true }), 'registration')
    expect(panel()).toBeNull()
    expect(screen.queryByText(/LCA approval|LCA review/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Visible to public' })).toBeTruthy()
    cleanup()
    answers[`GET ${CLUB_URL}`] = () => json({ ...clubAnswer({ add: 'yes', manage: true, decide: true, askPayout: false }), rosterKeptBack: undefined })
    render(
      <AuthContext.Provider value={authFor(ADMIN)}>
        <MemoryRouter initialEntries={[`/admin/clubs/${ID}?tab=tournaments`]}>
          <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 2, name: 'Club tournaments' })
    await act(async () => {})
    expect(screen.queryByText(/LCA approval/)).toBeNull()
    cleanup()
    card({ ...CARD, inReview: 2 })
    expect(screen.queryByText(/in LCA review/)).toBeNull()
    cleanup()
    bar({ ...MONTH, inReview: 2 })
    expect(parts().some((p) => p?.includes('in review'))).toBe(false)
  })
})
