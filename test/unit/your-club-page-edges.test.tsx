// @vitest-environment jsdom
//
// The edges of Your club's page and its ways in (WS09 step 9), beside
// test/unit/your-club-route.test.tsx: the last save in words at midnight and
// across both clock changes in America/Chicago, whatever the clock of the
// machine that draws it; a club with no save yet; each way the server can
// refuse or fail, said in words with a way back; a person the route lets in
// by the sign-in's own facts who the server then names another club's; a
// rep who also holds the region's seat; a club with no page address; an
// answer that arrives late for an address left behind; and every kind of
// person /manage/club and the Workspace send, with the switch on. The club
// editor is stood in for by a stub that saves on a press (its own cases are
// in test/unit/club-editor.test.tsx); everything else is the site's own
// routes and client, with fetch stubbed. Every name, address and club here
// is made up.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

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
// The editor is stood in for: it names the club it is given and saves on a press, with the stamp the next save would carry.
const SAVED_AT = vi.hoisted(() => ({ value: '2026-11-16 18:00:00' }))
// Each save takes the next page address queued here, as an LCA admin's save that changes Page address does; with none queued the address stays.
const RENAMES = vi.hoisted(() => ({ next: [] as string[] }))
vi.mock('@/areas/clubs/components/ClubEditor', async () => {
  const { createElement } = await import('react')
  return {
    ClubEditor: (props: { club: { id: string; name: string; slug: string | null }; onSaved: (club: unknown, places: unknown[]) => void; viewOnly: boolean }) =>
      createElement('div', { 'data-testid': 'editor' },
        createElement('p', null, `Editor for ${props.club.id}`),
        createElement('p', { 'data-testid': 'editor-address' }, props.club.slug ?? 'no address'),
        createElement('button', {
          type: 'button',
          onClick: () => props.onSaved({ ...props.club, slug: RENAMES.next.shift() ?? props.club.slug, told_updated_at: SAVED_AT.value }, []),
        }, 'Save and publish')),
  }
})

const { default: App } = await import('@/App')
const { adminGetClub } = await import('@/areas/clubs/api')

const ID = 'example-chess-club'
const SLUG = 'example-chess'
const OTHER = 'other-example-club'
const OTHER_SLUG = 'other-example'

function clubRow(id: string, slug: string | null, name: string, told: string | null = '2026-11-15 01:00:00') {
  return {
    id, name, city: 'Example City', location: 'Example Library', description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM',
    contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: null, longitude: null,
    slug, about_text: null, how_we_meet_text: null, cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0,
    contact_name_public: null, facebook_url: null, website_url: null, other_url: null, told_updated_at: told, told_by: told ? 'm-rep' : null,
    last_confirmed_at: told, confirmed_by: told ? 'm-rep' : null,
  }
}
const REST = { officers: [], roster: [], tournaments: [], places: [] }

type Person = { role: string; id: string; club_id: string | null; managed?: string[] }
const REP: Person = { role: 'club_rep', id: 'm-rep', club_id: ID }
const ADMIN: Person = { role: 'lca_admin', id: 'm-admin', club_id: null }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: string[] = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true })
  RENAMES.next = []
  window.localStorage.clear()
  asked = []
  answers = {}
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

function Where({ onNavigate }: { onNavigate?: (navigate: NavigateFunction) => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  onNavigate?.(navigate)
  return <output data-testid="where">{location.pathname}</output>
}
const where = () => screen.getByTestId('where').textContent
const adminGets = () => asked.filter((call) => call.startsWith('GET /api/admin/clubs/'))

function open(who: Person, path: string, onNavigate?: (navigate: NavigateFunction) => void) {
  const auth = {
    user: { id: who.id }, session: null, role: who.role,
    member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two', email: 'player.two@example.org' },
    loading: false, memberLoading: false, seats: [], managedClubs: (who.managed ?? []).map((id) => ({ id, name: 'Example Chess Club', region: 'Bayou Region' })),
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
const drawn = () => screen.findByTestId('editor', undefined, { timeout: 5000 })

describe('the last save in words, read in Central time', () => {
  // [stored UTC stamp, the words]: the evening and the midnight either side of a Saturday, the hour the spring change skips, the hour the autumn change repeats, noon and a new year.
  const CASES: Array<[string, string]> = [
    ['2026-11-15 05:59:59', 'Last saved Sat, Nov 14, 2026 at 11:59 PM.'],
    ['2026-11-15 06:00:00', 'Last saved Sun, Nov 15, 2026 at 12:00 AM.'],
    ['2026-03-08 07:59:00', 'Last saved Sun, Mar 8, 2026 at 1:59 AM.'],
    ['2026-03-08 08:00:00', 'Last saved Sun, Mar 8, 2026 at 3:00 AM.'],
    ['2026-11-01 06:30:00', 'Last saved Sun, Nov 1, 2026 at 1:30 AM.'],
    ['2026-11-01 07:30:00', 'Last saved Sun, Nov 1, 2026 at 1:30 AM.'],
    ['2026-11-01 08:00:00', 'Last saved Sun, Nov 1, 2026 at 2:00 AM.'],
    ['2026-11-14 18:00:00', 'Last saved Sat, Nov 14, 2026 at 12:00 PM.'],
    ['2027-01-01 05:59:00', 'Last saved Thu, Dec 31, 2026 at 11:59 PM.'],
    ['2026-07-04 00:05:00', 'Last saved Fri, Jul 3, 2026 at 7:05 PM.'],
  ]
  const originalZone = process.env.TZ

  afterEach(() => {
    if (originalZone === undefined) delete process.env.TZ
    else process.env.TZ = originalZone
  })

  async function saysEachIn(zone: string) {
    process.env.TZ = zone
    for (const [stamp, words] of CASES) {
      answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club', stamp), ...REST })
      open(REP, `/my/club/${SLUG}`)
      await drawn()
      expect(screen.getByText(words), `${stamp} in ${zone}`).toBeTruthy()
      cleanup()
    }
  }

  it('says each save with its weekday and its time as "7:00 PM", whatever the machine\'s own clock (UTC)', async () => {
    await saysEachIn('UTC')
  })
  it('says each save with its weekday and its time as "7:00 PM", whatever the machine\'s own clock (Pacific/Auckland)', async () => {
    await saysEachIn('Pacific/Auckland')
  })
  it('says each save with its weekday and its time as "7:00 PM", whatever the machine\'s own clock (America/Los_Angeles)', async () => {
    await saysEachIn('America/Los_Angeles')
  })

  it('says "Not saved here yet." for a club that has never been saved, and the words move to the new save when the editor saves', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club', null), ...REST })
    open(REP, `/my/club/${SLUG}`)
    await drawn()
    expect(screen.getByText('Not saved here yet.')).toBeTruthy()
    expect(screen.queryByText(/Last saved/)).toBeNull()
    // The stub's save stamps 6:00 PM UTC on Monday, November 16, 2026, which is noon in Central time.
    SAVED_AT.value = '2026-11-16 18:00:00'
    await act(async () => { screen.getByRole('button', { name: 'Save and publish' }).click() })
    expect(screen.getByText('Last saved Mon, Nov 16, 2026 at 12:00 PM.')).toBeTruthy()
    expect(screen.queryByText('Not saved here yet.')).toBeNull()
    // Saving asks the server for nothing more, and the address stays.
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
    expect(where()).toBe(`/my/club/${SLUG}`)
  })

  it('never writes a time as ".5", in lower case or with a dash, and names the day of the week on every date', async () => {
    for (const [stamp] of CASES) {
      answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club', stamp), ...REST })
      open(REP, `/my/club/${SLUG}`)
      await drawn()
      const line = screen.getByText(/^Last saved /).textContent ?? ''
      expect(line, stamp).toMatch(/^Last saved (Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}, \d{4} at \d{1,2}:\d{2} (AM|PM)\.$/)
      expect(line, stamp).not.toMatch(/[\u2013\u2014]|\.5\b/)
      expect(line, stamp).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
      cleanup()
    }
  })
})

describe('what a refusal or a failure says', () => {
  const asAdmin = (status: number | 'throws' | 'empty', body: unknown = { error: 'No.' }) => {
    answers[`GET /api/admin/clubs/${SLUG}`] = status === 'throws'
      ? () => { throw new TypeError('Failed to fetch') }
      : status === 'empty' ? () => json({}) : () => json(body, status)
    open(ADMIN, `/my/club/${SLUG}`)
  }

  it('a signed-out answer (401) says the sign-in has ended, with a way back, and draws no club and no editor', async () => {
    asAdmin(401)
    await screen.findByText('Your sign-in has ended. Sign in again, then come back to this page.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to all clubs' }).getAttribute('href')).toBe('/admin/clubs')
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('a 403 for an LCA admin, a 404 and an answer with no club each say so in words with a way back', async () => {
    for (const [status, words] of [
      [403, 'This club\'s page is not one you keep, so it cannot be changed here.'],
      [404, 'No club has this address.'],
      ['empty', 'No club has this address.'],
    ] as const) {
      asAdmin(status)
      await screen.findByText(words, undefined, { timeout: 5000 })
      expect(screen.getByRole('link', { name: 'Back to all clubs' }), words).toBeTruthy()
      expect(screen.queryByTestId('editor'), words).toBeNull()
      await waitFor(() => expect(document.activeElement, `${status} ${words}`).toBe(screen.getByRole('heading', { level: 1 })))
      cleanup()
    }
  })

  it('a server error and a lost connection say what happened, in a sentence, and never leave a broken or empty page', async () => {
    asAdmin(500, { error: 'The club could not be read' })
    await screen.findByText('The club\'s page could not be opened: The club could not be read.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to all clubs' })).toBeTruthy()
    cleanup()
    asAdmin('throws')
    await screen.findByText('The club\'s page could not be opened: Failed to fetch.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to all clubs' })).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
  })

  it('a rep\'s way back is their workspace, a region\'s representative\'s is their profile, and none draws another club\'s name', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ error: 'Forbidden' }, 403)
    open(REP, `/my/club/${SLUG}`)
    await screen.findByText('This club\'s page is not one you keep, so it cannot be changed here.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to your workspace' }).getAttribute('href')).toBe('/workspace')
    cleanup()
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => json({ error: 'Forbidden' }, 403)
    open({ role: 'member', id: 'm-region', club_id: null, managed: [ID] }, `/my/club/${OTHER_SLUG}`)
    await screen.findByText('This club\'s page is not one you keep, so it cannot be changed here.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to your profile' }).getAttribute('href')).toBe('/dashboard')
    expect(document.body.textContent).not.toContain('Other Example Club')
  })
})

describe('who the page lets through, by what the sign-in knows', () => {
  it('a rep who also holds the region\'s seat is asked about the address they open, and is let in to a club the seat covers', async () => {
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => json({ club: clubRow(OTHER, OTHER_SLUG, 'Other Example Club'), ...REST })
    open({ ...REP, managed: [OTHER] }, `/my/club/${OTHER_SLUG}`)
    await drawn()
    expect(screen.getByText('Editor for other-example-club')).toBeTruthy()
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${OTHER_SLUG}`])
    cleanup()
    // A seat that covers another club does not admit them to a club it does not cover: the page is sent to the dashboard once the club is read.
    asked = []
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => json({ club: clubRow(OTHER, OTHER_SLUG, 'Other Example Club'), ...REST })
    open({ ...REP, managed: ['third-example-club'] }, `/my/club/${OTHER_SLUG}`)
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    expect(screen.queryByTestId('editor')).toBeNull()
    expect(document.body.textContent).not.toContain('Other Example Club')
  })

  it('a rep who opens their own club by an address that is not its id or present page address is sent away, and an old address leads nowhere', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    open(REP, '/my/club/example-old-address')
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    expect(where()).toBe('/dashboard')
    // Only their own club was asked for, never the address they typed.
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
    expect(screen.queryByTestId('editor')).toBeNull()
  })

  it('a rep and a member with no club, and the roles that keep none, are sent to the dashboard with nothing asked', async () => {
    for (const who of [
      { role: 'club_rep', id: 'm-clubless-rep', club_id: null },
      { role: 'member', id: 'm-member', club_id: ID },
      { role: 'tournament_director', id: 'm-director', club_id: null },
      { role: 'lca_auditor', id: 'm-auditor', club_id: null },
      { role: 'lca_officer', id: 'm-officer', club_id: null },
      { role: 'guest', id: 'm-guest', club_id: ID },
    ]) {
      open(who, `/my/club/${SLUG}`)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), who.role).toBe('/dashboard')
      expect(adminGets(), who.role).toEqual([])
      cleanup()
    }
  })

  it('a club with no page address is opened by its id, which stays the address, in one request', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, null, 'Example Chess Club'), ...REST })
    open(REP, `/my/club/${ID}`)
    await drawn()
    expect(where()).toBe(`/my/club/${ID}`)
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
    // See your page and the way back are today's addresses.
    expect(screen.getByRole('link', { name: 'See your page' }).getAttribute('href')).toBe(`/clubs/${ID}`)
  })

  it('an address of a form no club has is never sent, and one that is sent goes as one part of the path', async () => {
    open(ADMIN, '/my/club/exa%20mple')
    await screen.findByText('No club has this address.', undefined, { timeout: 5000 })
    expect(adminGets()).toEqual([])
    cleanup()
    vi.mocked(fetch).mockClear()
    answers['GET /api/admin/clubs/a%2Fb%3Fc%20d'] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    await adminGetClub('a/b?c d')
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/admin/clubs/a%2Fb%3Fc%20d')
  })
})

describe('an answer that arrives late', () => {
  it('draws nothing of an address left behind: its answer, arriving after the next one, is not drawn', async () => {
    let finishFirst: (r: Response) => void = () => {}
    let navigate: NavigateFunction = () => {}
    answers[`GET /api/admin/clubs/${SLUG}`] = () => new Promise<Response>((done) => { finishFirst = done })
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => json({ club: clubRow(OTHER, OTHER_SLUG, 'Other Example Club'), ...REST })
    open(ADMIN, `/my/club/${SLUG}`, (n) => { navigate = n })
    await waitFor(() => expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`]))
    expect(screen.getByText('Loading…')).toBeTruthy()
    await act(async () => { await navigate(`/my/club/${OTHER_SLUG}`) })
    await drawn()
    expect(screen.getByText('Editor for other-example-club')).toBeTruthy()
    await act(async () => finishFirst(json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })))
    expect(screen.getByText('Editor for other-example-club')).toBeTruthy()
    expect(document.body.textContent).not.toContain('Editor for example-chess-club')
    expect(where()).toBe(`/my/club/${OTHER_SLUG}`)
  })
})

describe('a save that changes the page address', () => {
  it('an LCA admin who opened the club by its id and renames it keeps the editor, moves to the new address and asks nothing more', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    open(ADMIN, `/my/club/${ID}`)
    await drawn()
    await waitFor(() => expect(where()).toBe(`/my/club/${SLUG}`))
    RENAMES.next = ['example-chess-two']
    await act(async () => { screen.getByRole('button', { name: 'Save and publish' }).click() })
    await waitFor(() => expect(where()).toBe('/my/club/example-chess-two'))
    expect(screen.getByTestId('editor')).toBeTruthy()
    expect(screen.getByTestId('editor-address').textContent).toBe('example-chess-two')
    expect(screen.queryByText('No club has this address.')).toBeNull()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${ID}`])
  })

  it('an LCA admin who opened the club by its page address and renames it twice in one visit keeps the editor through both, with one request', async () => {
    answers[`GET /api/admin/clubs/${SLUG}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    open(ADMIN, `/my/club/${SLUG}`)
    await drawn()
    for (const next of ['example-chess-two', 'example-chess-three']) {
      RENAMES.next = [next]
      await act(async () => { screen.getByRole('button', { name: 'Save and publish' }).click() })
      await waitFor(() => expect(where(), next).toBe(`/my/club/${next}`))
      expect(screen.getByTestId('editor'), next).toBeTruthy()
      expect(screen.getByTestId('editor-address').textContent, next).toBe(next)
      expect(screen.queryByText('No club has this address.'), next).toBeNull()
    }
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`])
    // A save that keeps the address moves nothing and asks nothing.
    await act(async () => { screen.getByRole('button', { name: 'Save and publish' }).click() })
    expect(where()).toBe('/my/club/example-chess-three')
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`])
  })

  it('the address the club has left leads, within the visit, only to the saved club at its new address, and another club\'s address is asked of the server', async () => {
    let navigate: NavigateFunction = () => {}
    answers[`GET /api/admin/clubs/${SLUG}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    answers[`GET /api/admin/clubs/${OTHER_SLUG}`] = () => json({ club: clubRow(OTHER, OTHER_SLUG, 'Other Example Club'), ...REST })
    open(ADMIN, `/my/club/${SLUG}`, (n) => { navigate = n })
    await drawn()
    RENAMES.next = ['example-chess-two']
    await act(async () => { screen.getByRole('button', { name: 'Save and publish' }).click() })
    await waitFor(() => expect(where()).toBe('/my/club/example-chess-two'))
    // The stand in server now answers the old address as the real one does: not found.
    delete answers[`GET /api/admin/clubs/${SLUG}`]
    await act(async () => { await navigate(`/my/club/${SLUG}`) })
    await waitFor(() => expect(where()).toBe('/my/club/example-chess-two'))
    expect(screen.getByText('Editor for example-chess-club')).toBeTruthy()
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`])
    // Another club's address is asked afresh, and once its answer has come the club left behind is no longer drawn.
    await act(async () => { await navigate(`/my/club/${OTHER_SLUG}`) })
    await drawn()
    await waitFor(() => expect(screen.getByText('Editor for other-example-club')).toBeTruthy())
    expect(screen.queryByText('Editor for example-chess-club')).toBeNull()
    expect(adminGets()).toEqual([`GET /api/admin/clubs/${SLUG}`, `GET /api/admin/clubs/${OTHER_SLUG}`])
    // Once another club is drawn, the first club's old address is asked of the server, which follows it to no club.
    await act(async () => { await navigate(`/my/club/${SLUG}`) })
    await screen.findByText('No club has this address.', undefined, { timeout: 5000 })
    expect(screen.queryByTestId('editor')).toBeNull()
  })
})

describe('the ways in, with clubKeepers on, for every kind of person', () => {
  it('/manage/club sends a member who keeps no club, an observer and a rep with no club to the dashboard, with nothing asked', async () => {
    for (const who of [
      { role: 'member', id: 'm-member', club_id: ID },
      { role: 'lca_observer', id: 'm-observer', club_id: null },
      { role: 'club_rep', id: 'm-clubless-rep', club_id: null },
    ]) {
      open(who, '/manage/club')
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), who.role).toBe('/dashboard')
      expect(adminGets(), who.role).toEqual([])
      cleanup()
    }
  })

  it('/manage/club leads a rep by the club\'s id, and the page then shows its page address', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    open(REP, '/manage/club')
    await drawn()
    await waitFor(() => expect(where()).toBe(`/my/club/${SLUG}`))
  })

  it('the Workspace\'s club panel leads to the club\'s id when it has no page address, by Edit club and by Add it alike', async () => {
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, null, 'Example Chess Club'), ...REST })
    open(REP, '/workspace')
    const edit = await screen.findByRole('link', { name: 'Edit club' }, { timeout: 5000 })
    expect(edit.getAttribute('href')).toBe(`/my/club/${ID}`)
    expect(screen.getByRole('link', { name: 'Add it' }).getAttribute('href')).toBe(`/my/club/${ID}`)
    expect(screen.getByRole('link', { name: 'Public page' }).getAttribute('href')).toBe(`/clubs/${ID}`)
  })

  it('the Workspace\'s club panel, with clubKeepers off, keeps both links on the admin club page', async () => {
    flags.clubKeepers = false
    answers[`GET /api/admin/clubs/${ID}`] = () => json({ club: clubRow(ID, SLUG, 'Example Chess Club'), ...REST })
    open(REP, '/workspace')
    const edit = await screen.findByRole('link', { name: 'Edit club' }, { timeout: 5000 })
    expect(edit.getAttribute('href')).toBe(`/admin/clubs/${ID}`)
    expect(within(edit.closest('div.rounded-xl') as HTMLElement).getByRole('link', { name: 'Add it' }).getAttribute('href')).toBe(`/admin/clubs/${ID}`)
  })

  it('with clubKeepers off /manage/club still sends an observer and a rep with no club where it did: the dashboard', async () => {
    flags.clubKeepers = false
    for (const who of [
      { role: 'lca_observer', id: 'm-observer', club_id: null },
      { role: 'club_rep', id: 'm-clubless-rep', club_id: null },
    ]) {
      open(who, '/manage/club')
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(adminGets(), who.role).toEqual([])
      cleanup()
    }
  })
})
