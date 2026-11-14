// @vitest-environment jsdom
//
// Your club's page and the ways in (WS09 step 9), through the site's own
// routes in src/App.tsx: /my/club/:slug, /manage/club and the Workspace's
// club panel. With clubKeepers on, which this file alone turns on through a
// getter on the mocked FEATURES, a club's rep opens the one club editor at
// /my/club/{slug}, and /manage/club and the Workspace lead there; another
// club's rep and a member who keeps no club are sent away; a region's
// representative and an LCA admin reach a club the rule admits them to; a
// person the browser lets through but the server refuses reads why, with a
// way back; and the page draws nothing of a club while it waits and nothing
// the server keeps back from a person admitted by the region alone. With
// clubKeepers off /my/club/:slug sends everyone to the dashboard and
// /manage/club and the Workspace are today's. The real pages run through the
// real client with fetch stubbed, so each request is read as it would leave
// the browser; the dashboard, the admin club page, the admin panel and the
// site's header, footer and banners are stood in for, since none of them is
// what is held here. Every name, address and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'

// Each case may wait up to 5 seconds for a page's or the editor's file to load, so each case has 15 seconds.
vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: true, clubEmailHidden: true }))
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
// The parts of the site around the page, and the pages a way in leads to, each stood in for by its name.
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))
vi.mock('@/pages/DashboardPage', async () => {
  const { createElement } = await import('react')
  return { DashboardPage: () => createElement('p', null, 'The dashboard') }
})
vi.mock('@/pages/AdminClubPage', async () => {
  const { createElement } = await import('react')
  const { useParams } = await import('react-router-dom')
  return { AdminClubPage: () => createElement('p', null, `The admin club page for ${useParams().id}`) }
})
vi.mock('@/pages/AdminPage', async () => {
  const { createElement } = await import('react')
  const { useParams } = await import('react-router-dom')
  return { AdminPage: () => createElement('p', null, `The admin panel at ${useParams().section ?? 'its start'}`) }
})

const { default: App } = await import('@/App')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const ID = 'example-chess-club'
const SLUG = 'example-chess'
const OTHER = 'other-example-club'
const OTHER_SLUG = 'other-example'

/** A made-up club as the GET answers it with the server's constant set; its last save is 1:00 AM UTC on Sunday, November 15, 2026, 7:00 PM the evening before in Central time. */
function clubRow(id: string, slug: string, name: string) {
  return {
    id, name, city: 'Example City', location: 'Example Library', description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM',
    contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: null, longitude: null,
    slug, about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM', cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0,
    contact_name_public: 'Club Contact', facebook_url: null, website_url: null, other_url: null, told_updated_at: '2026-11-15 01:00:00', told_by: 'm-rep',
    last_confirmed_at: '2026-11-15 01:00:00', confirmed_by: 'm-rep',
  }
}
const CLUB = clubRow(ID, SLUG, 'Example Chess Club')
const OTHER_CLUB = clubRow(OTHER, OTHER_SLUG, 'Other Example Club')
/** The answer the club's rep and an LCA admin get: the roster, the officers with their email and a hidden draft. */
const FULL = {
  officers: [{ id: 'o1', member_id: 'm3', role: 'President', full_name: 'Player Three', email: 'player.three@example.org' }],
  roster: [{ id: 'm3', full_name: 'Player Three', email: 'player.three@example.org', uscf_id: '90000003', uscf_rating: 1400, membership_status: 'active' }],
  tournaments: [
    { id: 't1', name: 'Example Open', date: '2026-12-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open' },
    { id: 't2', name: 'Example Hidden Draft', date: '2026-12-12', end_date: null, status: 'upcoming', is_visible: 0, registration_status: null },
  ],
  places: [],
}
/** The answer a person admitted by the region alone gets: no roster, the officers without their email, the visible events only. */
const REGION_ALONE = {
  officers: [{ id: 'o1', member_id: 'm3', role: 'President', full_name: 'Player Three' }],
  roster: [],
  rosterKeptBack: true,
  tournaments: [FULL.tournaments[0]],
  places: [],
}

type Person = 'rep' | 'otherRep' | 'representative' | 'member' | 'observer' | 'admin'
const PEOPLE: Record<Person, { role: string; id: string; club_id: string | null; managed: string[] }> = {
  rep: { role: 'club_rep', id: 'm-rep', club_id: ID, managed: [] },
  otherRep: { role: 'club_rep', id: 'm-other-rep', club_id: OTHER, managed: [] },
  representative: { role: 'member', id: 'm-region', club_id: null, managed: [ID] },
  member: { role: 'member', id: 'm-member', club_id: ID, managed: [] },
  observer: { role: 'lca_observer', id: 'm-observer', club_id: null, managed: [] },
  admin: { role: 'lca_admin', id: 'm-admin', club_id: null, managed: [] },
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: string[] = []
let answers: Record<string, () => Response | Promise<Response>> = {}

/** The server's answers, by the rule the GET keeps: each club by its id or its page address, with what the person may see of it. */
function serve(person: Person) {
  const who = PEOPLE[person]
  const rest = person === 'representative' ? REGION_ALONE : FULL
  const own = (club: typeof CLUB) => (who.role === 'lca_admin' || who.role === 'lca_observer' || who.club_id === club.id || who.managed.includes(club.id))
  answers = {}
  for (const club of [CLUB, OTHER_CLUB]) {
    const answer = () => (own(club) ? json({ club, ...rest }) : json({ error: 'Forbidden' }, 403))
    answers[`GET /api/admin/clubs/${club.id}`] = answer
    answers[`GET /api/admin/clubs/${club.slug}`] = answer
  }
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true })
  window.localStorage.clear()
  // Help has opened by itself before, so the page's own focus is what is read.
  window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
  asked = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push(call)
    const answer = answers[call]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Where the router is, read from the page. */
function Where({ onNavigate }: { onNavigate?: (navigate: NavigateFunction) => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  onNavigate?.(navigate)
  return <output data-testid="where">{location.pathname}</output>
}
const where = () => screen.getByTestId('where').textContent

/** The site at this address for this person, through its own routes. */
function open(person: Person, path: string, onNavigate?: (navigate: NavigateFunction) => void) {
  const who = PEOPLE[person]
  serve(person)
  const auth = {
    user: { id: who.id }, session: null, role: who.role,
    member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two', email: 'player.two@example.org' },
    loading: false, memberLoading: false, seats: [], managedClubs: who.managed.map((id) => ({ id, name: 'Example Chess Club', region: 'Bayou Region' })),
    isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where onNavigate={onNavigate} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** The editor, once its file has loaded. */
async function editor() {
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  await act(async () => {})
  return save
}
/** The page's header: its heading, the club's name and the last save. */
const hero = () => screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement
const adminGets = () => asked.filter((call) => call.startsWith('GET /api/admin/clubs/'))

describe('Your club\'s page: the ways in, with clubKeepers on', () => {
  it('a rep reaches their own club', async () => {
    open('rep', `/my/club/${SLUG}`)
    await editor()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Your club\'s page'])
    expect(within(hero()).getByText('Example Chess Club')).toBeTruthy()
    expect(screen.getByText('Last saved Sat, Nov 14, 2026 at 7:00 PM.')).toBeTruthy()
    expect(document.title).toBe('Your club\'s page: Example Chess Club | Louisiana Chess Association')
    // "See your page" is today's club page, by the address that works today.
    expect(screen.getByRole('link', { name: 'See your page' }).getAttribute('href')).toBe(`/clubs/${ID}`)
    expect(screen.getByRole('link', { name: 'Back to your workspace' }).getAttribute('href')).toBe('/workspace')
    // The rep's own club is asked for by its id, and no other club is asked for.
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
    expect(where()).toBe(`/my/club/${SLUG}`)
  })

  it('a rep who follows their club\'s id lands on its page address, with no second request', async () => {
    open('rep', `/my/club/${ID}`)
    await editor()
    await waitFor(() => expect(where()).toBe(`/my/club/${SLUG}`))
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
    expect(within(hero()).getByText('Example Chess Club')).toBeTruthy()
  })

  it('another club\'s rep is sent away', async () => {
    open('otherRep', `/my/club/${SLUG}`)
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    expect(where()).toBe('/dashboard')
    // Only the rep's own club was asked for, so nothing of the other club ever reached the page.
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${OTHER}`])
    expect(screen.queryByText('Example Chess Club')).toBeNull()
  })

  it('a representative reaches a club in the region', async () => {
    open('representative', `/my/club/${SLUG}`)
    await editor()
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`])
    expect(where()).toBe(`/my/club/${SLUG}`)
    expect(within(hero()).getByText('Example Chess Club')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to your profile' }).getAttribute('href')).toBe('/dashboard')
  })

  it('shows a person admitted by the region alone the editor alone: no roster, no officer, no email of theirs and no event', async () => {
    open('representative', `/my/club/${SLUG}`)
    await editor()
    const text = document.body.textContent ?? ''
    for (const piece of ['Player Three', 'player.three@example.org', 'Example Open', 'Example Hidden Draft', 'Roster', 'roster', 'Officer', 'officer', 'draft']) {
      expect(text, piece).not.toContain(piece)
    }
  })

  it('tells a person the browser lets through but the server refuses why, with a way back, and draws nothing of the club', async () => {
    open('representative', `/my/club/${OTHER_SLUG}`)
    await screen.findByText('This club\'s page is not one you keep, so it cannot be changed here.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to your profile' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.queryByText('Other Example Club')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save and publish' })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Your club\'s page'])
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
  })

  it('says an address no club has in words, with a way back, and never sends an address of another form', async () => {
    open('admin', '/my/club/no-such-club')
    await screen.findByText('No club has this address.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to all clubs' }).getAttribute('href')).toBe('/admin/clubs')
    cleanup()
    asked = []
    open('admin', `/my/club/${encodeURIComponent('example/officers')}`)
    await screen.findByText('No club has this address.', undefined, { timeout: 5000 })
    expect(adminGets()).toEqual([])
  })

  it('sends a member who keeps no club, and an observer, to the dashboard without asking for the club', async () => {
    for (const person of ['member', 'observer'] as const) {
      open(person, `/my/club/${SLUG}`)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      expect(adminGets(), person).toEqual([])
      cleanup()
    }
  })

  it('lets an LCA admin reach any club, and /manage/club sends an admin to the Clubs list', async () => {
    open('admin', `/my/club/${OTHER_SLUG}`)
    await editor()
    expect(within(hero()).getByText('Other Example Club')).toBeTruthy()
    // An LCA admin keeps the club's name, region and page address as boxes.
    expect(screen.getByLabelText('Region')).toBeTruthy()
    cleanup()
    open('admin', '/manage/club')
    await screen.findByText('The admin panel at clubs', undefined, { timeout: 5000 })
    expect(where()).toBe('/admin/clubs')
  })

  it('/manage/club sends a rep to their club\'s page, by its page address', async () => {
    open('rep', '/manage/club')
    await editor()
    await waitFor(() => expect(where()).toBe(`/my/club/${SLUG}`))
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
  })

  it('the Workspace\'s club panel opens Your club\'s page by the club\'s page address', async () => {
    open('rep', '/workspace')
    const edit = await screen.findByRole('link', { name: 'Edit club' }, { timeout: 5000 })
    expect(edit.getAttribute('href')).toBe(`/my/club/${SLUG}`)
    expect(screen.getByRole('link', { name: 'Public page' }).getAttribute('href')).toBe(`/clubs/${ID}`)
  })

  it('draws nothing of the club drawn before while the next club\'s answer is on the way', async () => {
    let navigate: NavigateFunction = () => {}
    let finish: (r: Response) => void = () => {}
    open('admin', `/my/club/${SLUG}`, (n) => { navigate = n })
    await editor()
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => new Promise<Response>((done) => { finish = done })
    await act(async () => { await navigate(`/my/club/${OTHER_SLUG}`) })
    await waitFor(() => expect(adminGets()).toContain(`GET /api/admin/clubs/${OTHER_SLUG}`))
    expect(screen.queryByText('Example Chess Club')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save and publish' })).toBeNull()
    expect(screen.getByText('Loading…').getAttribute('role')).toBe('status')
    await act(async () => finish(json({ club: OTHER_CLUB, ...FULL })))
    await editor()
    expect(within(hero()).getByText('Other Example Club')).toBeTruthy()
    expect(document.title).toBe('Your club\'s page: Other Example Club | Louisiana Chess Association')
  })

  it('has one main heading, which takes the focus once the club is drawn, and its own controls at least 44px tall in one column on a phone', async () => {
    open('rep', `/my/club/${SLUG}`)
    await editor()
    const heading = screen.getByRole('heading', { level: 1 })
    expect(document.activeElement).toBe(heading)
    for (const name of ['See your page', 'Back to your workspace']) {
      expect(screen.getByRole('link', { name }).className, name).toContain('min-h-11')
    }
    const row = screen.getByRole('link', { name: 'Back to your workspace' }).parentElement as HTMLElement
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex-col', 'sm:flex-row']))
  })
})

describe('Your club\'s page: with clubKeepers off', () => {
  it('off: the route sends to the dashboard and /manage/club is today\'s', async () => {
    flags.clubKeepers = false
    for (const person of ['rep', 'representative', 'admin'] as const) {
      open(person, `/my/club/${SLUG}`)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      expect(adminGets(), person).toEqual([])
      cleanup()
    }
    // Today's /manage/club: a rep is sent to the admin club page, an LCA admin and a member to the dashboard.
    open('rep', '/manage/club')
    await screen.findByText(`The admin club page for ${ID}`, undefined, { timeout: 5000 })
    expect(where()).toBe(`/admin/clubs/${ID}`)
    cleanup()
    for (const person of ['admin', 'member'] as const) {
      open(person, '/manage/club')
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      cleanup()
    }
    // Today's Workspace: Edit club opens the admin club page.
    open('rep', '/workspace')
    const edit = await screen.findByRole('link', { name: 'Edit club' }, { timeout: 5000 })
    expect(edit.getAttribute('href')).toBe(`/admin/clubs/${ID}`)
  })
})

describe('Your club\'s page: its source', () => {
  it('makes no call of its own, draws the editor only as a file fetched when it is drawn, and uses only the site\'s tokens, no gold word', () => {
    const page = read('src/pages/YourClubPage.tsx')
    expect(page).not.toMatch(/\bfetch\(/)
    expect(page).toContain('import { adminGetClub, ApiError, type ApiClubListing } from \'@/lib/api\'')
    expect(page).toContain('lazy(() => import(\'@/areas/clubs/components/ClubEditor\')')
    expect(page).not.toMatch(/import \{[^}]*\bClubEditor\b[^}]*\} from/)
    expect(page).not.toMatch(/#[0-9a-fA-F]{3,6}\b|text-lca-gold|text-gold\b|\btext-(?:red|blue|green|gray|slate|amber|yellow)-\d/)
    // The page reads nothing of the answer's members or events.
    expect(page).not.toMatch(/\.(?:officers|roster|rosterKeptBack|tournaments)\b/)
    // With the switch off the route is a plain move to the dashboard, and /manage/club keeps today's guard.
    const app = read('src/App.tsx')
    expect(app).toContain('<Route path="/my/club/:slug" element={FEATURES.clubKeepers ? <RoleProtectedRoute keepsAClub><YourClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(app).toContain('roles={FEATURES.clubKeepers ? [\'club_rep\', \'lca_admin\'] : [\'club_rep\']}')
  })
})
