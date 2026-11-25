// @vitest-environment jsdom
//
// A reload of a guarded page, through the site's own sign-in context
// (src/contexts/AuthContext.tsx) and the real guards
// (src/components/auth/RoleProtectedRoute.tsx and ProtectedRoute.tsx), for
// each kind of guarded route src/App.tsx draws, with the guard's settings as
// App.tsx writes them (a case below reads them there) and clubKeepers on in
// this file alone; mailLists is as it ships. The session is found at the
// start, as a reload finds it, and its user record carries the plain
// member's role, as a sign-up writes it, so nothing but the member's own
// answers can let a person in. Every address the page is at is written down,
// draw by draw, with whether the loading line was showing:
//
// - a person the route admits ends on the route, with the loading line
//   between and no stop at the dashboard or anywhere else on the way
// - a person it does not admit ends where today's rule sends them, from the
//   route's own address and nowhere between
// - a visitor who is signed out goes to the sign-in page, as today
//
// Each page is stood in for by its name; the pages themselves are not what
// is held here. Every person, club and event here is made up.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { useLayoutEffect, type ReactNode } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ clubKeepers: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})

interface StandInSession {
  access_token: string
  refresh_token: string
  user: { id: string; email: string; user_metadata: Record<string, unknown> }
  aal: 'aal1' | 'aal2'
}
type Listener = (event: string, session: StandInSession | null) => unknown

/** A sign-in client whose listener hears an event only when a case speaks; the first read answers at once. */
const signIn = vi.hoisted(() => ({
  session: null as StandInSession | null,
  listeners: new Set<Listener>(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: signIn.session }, error: null }),
      onAuthStateChange: (listener: Listener) => {
        signIn.listeners.add(listener)
        return { data: { subscription: { unsubscribe: () => signIn.listeners.delete(listener) } } }
      },
      signOut: async () => {
        signIn.session = null
        for (const listener of [...signIn.listeners]) void listener('SIGNED_OUT', null)
        return { error: null }
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: signIn.session?.aal ?? null, nextLevel: signIn.session?.aal ?? null },
          error: null,
        }),
      },
    },
  },
}))

const { AuthProvider } = await import('@/contexts/AuthContext')
const { useAuth } = await import('@/contexts/auth-context')
const { RoleProtectedRoute } = await import('@/components/auth/RoleProtectedRoute')
const { ProtectedRoute } = await import('@/components/auth/ProtectedRoute')
const { ADMIN_PANEL_ROLES, WORKSPACE_ROLES } = await import('@/areas/admin/roles')
const { FEATURES } = await import('@/lib/features')
const { navPersona } = await import('./fixtures/navPersonas')
type NavPersona = ReturnType<typeof navPersona>

const ROOT = resolve(__dirname, '../..')

/** One kind of guarded route: its path in App.tsx, the guard as App.tsx opens it, and the same guard drawn here. */
interface GuardedRoute {
  path: string
  source: string
  guard: (page: ReactNode) => ReactNode
}

const ROUTES: GuardedRoute[] = [
  { path: '/dashboard', source: '<ProtectedRoute><DashboardPage />', guard: (p) => <ProtectedRoute>{p}</ProtectedRoute> },
  { path: '/board/inbox', source: '<ProtectedRoute><BoardInboxPage />', guard: (p) => <ProtectedRoute>{p}</ProtectedRoute> },
  {
    path: '/manage/club',
    source: "<RoleProtectedRoute roles={FEATURES.clubKeepers ? ['club_rep', 'lca_admin'] : ['club_rep']}>",
    guard: (p) => <RoleProtectedRoute roles={FEATURES.clubKeepers ? ['club_rep', 'lca_admin'] : ['club_rep']}>{p}</RoleProtectedRoute>,
  },
  { path: '/my/club/:slug', source: '<RoleProtectedRoute keepsAClub>', guard: (p) => <RoleProtectedRoute keepsAClub>{p}</RoleProtectedRoute> },
  {
    path: '/workspace',
    source: '<RoleProtectedRoute roles={WORKSPACE_ROLES} allowDirectors>',
    guard: (p) => <RoleProtectedRoute roles={WORKSPACE_ROLES} allowDirectors>{p}</RoleProtectedRoute>,
  },
  { path: '/workspace/region', source: '<RoleProtectedRoute requireSeat>', guard: (p) => <RoleProtectedRoute requireSeat>{p}</RoleProtectedRoute> },
  {
    path: '/workspace/region/clubs/:id',
    source: '<RoleProtectedRoute requireSeat requireClubMatch>',
    guard: (p) => <RoleProtectedRoute requireSeat requireClubMatch>{p}</RoleProtectedRoute>,
  },
  {
    path: '/admin',
    source: '<RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome allowMediaManager>',
    guard: (p) => <RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome allowMediaManager>{p}</RoleProtectedRoute>,
  },
  {
    path: '/admin/:section',
    source: '<RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome allowMediaManager>',
    guard: (p) => <RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome allowMediaManager>{p}</RoleProtectedRoute>,
  },
  { path: '/admin/clubs/:id', source: '<RoleProtectedRoute requireClubMatch>', guard: (p) => <RoleProtectedRoute requireClubMatch>{p}</RoleProtectedRoute> },
  {
    path: '/admin/tournaments/:id',
    source: "<RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'lca_officer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess>",
    guard: (p) => (
      <RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'lca_officer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess>
        {p}
      </RoleProtectedRoute>
    ),
  },
]

/** One committed draw: where the page was, whether the loading line showed, which page was drawn and whether the member was in hand. */
interface Step {
  at: string
  loading: boolean
  page: string | null
  member: boolean
}
const steps: Step[] = []

/** Draws again with every change of the sign-in context or of the address, and writes down what the page showed. */
function Trail() {
  const { member } = useAuth()
  const location = useLocation()
  useLayoutEffect(() => {
    const page = document.querySelector('[data-page]')?.getAttribute('data-page') ?? null
    steps.push({ at: location.pathname, loading: document.body.textContent?.includes('Loading...') ?? false, page, member: member !== null })
  })
  return <output data-testid="from">{(location.state as { from?: string } | null)?.from ?? ''}</output>
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A copy of a person whose account role is the plain member's: one admitted to an event by assignment alone. */
function withAccountRole(person: NavPersona, role: string): NavPersona {
  const answers = person.answers!
  return {
    ...person,
    answers: {
      ...answers,
      synced: { member: { ...answers.synced.member, role } },
      me: { ...answers.me, member: { ...answers.me.member, role } },
    },
  } as NavPersona
}

/** Reloads `address` as `person` (or signed out): the session is found at the start and the listener speaks as the library does. */
async function reload(address: string, person: NavPersona | null, aal?: 'aal1' | 'aal2') {
  steps.length = 0
  signIn.listeners.clear()
  signIn.session = person
    ? {
        access_token: `tok-${person.key}`,
        refresh_token: `refresh-${person.key}`,
        user: { id: person.user!.id, email: person.user!.email, user_metadata: { role: 'member' } },
        aal: aal ?? person.aal ?? 'aal1',
      }
    : null
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const call = `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`
      const answers = person?.answers
      if (answers && call === 'POST /api/me') return json(answers.synced, 201)
      if (answers && call === 'GET /api/me') return json(answers.me)
      if (answers && call === 'GET /api/board/my-seats') return json(answers.mySeats)
      return json({ error: 'Unauthorized' }, 401)
    }),
  )
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          {ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={route.guard(<p data-page={route.path}>The page at {route.path}</p>)} />
          ))}
          <Route path="/login" element={<p data-page="/login">Log in</p>} />
          <Route path="/account/security" element={<p data-page="/account/security">Account security</p>} />
        </Routes>
        <Trail />
      </MemoryRouter>
    </AuthProvider>,
  )
  const session = signIn.session
  await act(async () => {
    for (const listener of [...signIn.listeners]) void listener('INITIAL_SESSION', session)
  })
  await settle()
}

/** Lets every answer arrive and the page settle. */
async function settle() {
  let seen = -1
  let quiet = 0
  while (quiet < 3) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    quiet = steps.length === seen ? quiet + 1 : 0
    seen = steps.length
  }
}

/** The addresses the page was at, in order, each once. */
const visited = () => steps.map((s) => s.at).filter((at, i, all) => i === 0 || all[i - 1] !== at)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  signIn.session = null
  signIn.listeners.clear()
})

describe('the routes drawn here are the ones App.tsx draws', () => {
  it('opens each path with the same guard and settings', () => {
    const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf8').split('\n')
    for (const route of ROUTES) {
      const line = app.find((l) => l.includes(`path="${route.path}"`))
      expect(line, route.path).toBeDefined()
      expect(line, route.path).toContain(route.source)
    }
  })

  it('reads mailLists as it ships, and clubKeepers on in this file alone', async () => {
    const real = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')
    expect(FEATURES.mailLists).toBe(real.FEATURES.mailLists)
    expect(FEATURES.mailLists).toBe(true)
    expect(FEATURES.clubKeepers).toBe(true)
  })
})

const clubRep = () => navPersona('club-rep')
const regionalRep = () => navPersona('regional-rep')
const admin = () => navPersona('admin')
const member = () => navPersona('active-member')
const assignedDirector = () => withAccountRole(navPersona('director'), 'member')

/** A plain member whose one seat is the President seat (slug 'president'), which the mail guards read whatever the role. */
function holdingThePresidentSeat(person: NavPersona): NavPersona {
  const answers = person.answers!
  const seat = { ...answers.mySeats.seats[0], id: 'fx-seat-the-president', slug: 'president', role: 'President', category: 'officer' as const, regions: [] }
  return { ...person, answers: { ...answers, mySeats: { ...answers.mySeats, seats: [seat] } } } as NavPersona
}
const memberPresident = () => holdingThePresidentSeat(navPersona('regional-rep'))

/** [what the route is, the address reloaded, the person it admits] */
const ADMITTED: Array<[string, string, () => NavPersona, string]> = [
  ['the plain sign-in guard', '/dashboard', member, '/dashboard'],
  ['the plain sign-in guard, for a seat holder', '/board/inbox', regionalRep, '/board/inbox'],
  ['a roles list alone', '/manage/club', clubRep, '/manage/club'],
  ['keepsAClub, for a club\'s rep', '/my/club/fx-club-capital', clubRep, '/my/club/:slug'],
  ['keepsAClub, for a regional seat', '/my/club/fx-club-north', regionalRep, '/my/club/:slug'],
  ['allowDirectors, for a member who directs by assignment alone', '/workspace', assignedDirector, '/workspace'],
  ['requireSeat, for a regional seat on a plain member\'s account', '/workspace/region', regionalRep, '/workspace/region'],
  ['requireSeat, for an LCA admin', '/workspace/region', admin, '/workspace/region'],
  ['requireSeat with requireClubMatch, a club in the seat\'s region', '/workspace/region/clubs/fx-club-north', regionalRep, '/workspace/region/clubs/:id'],
  ['allowMediaManager with mailLists as it ships, for an LCA admin', '/admin', admin, '/admin'],
  ['allowMediaManager with mailLists as it ships, a deeper address', '/admin/members', admin, '/admin/:section'],
  ['allowMediaManager, for a plain member who holds the President seat', '/admin', memberPresident, '/admin'],
  ['allowMediaManager, for a plain member who holds the President seat, at Group email', '/admin/email', memberPresident, '/admin/:section'],
  ['requireClubMatch, for the club\'s own rep', '/admin/clubs/fx-club-capital', clubRep, '/admin/clubs/:id'],
  ['requireClubMatch, for an LCA admin', '/admin/clubs/fx-club-north', admin, '/admin/clubs/:id'],
  ['requireTournamentAccess, for the event\'s director by assignment alone', '/admin/tournaments/fx-t-open', assignedDirector, '/admin/tournaments/:id'],
]

describe('a reload of a guarded page, for a person the route admits', () => {
  it.each(ADMITTED)('%s: %s', async (_kind, address, person, page) => {
    await reload(address, person())
    expect(steps[steps.length - 1]).toEqual({ at: address, loading: false, page, member: true })
    expect(visited()).toEqual([address])
    expect(steps.some((s) => s.loading)).toBe(true)
    // The page is drawn only once the loading line has gone, and never before it.
    const firstPage = steps.findIndex((s) => s.page !== null)
    expect(steps.slice(firstPage).every((s) => s.page === page && !s.loading)).toBe(true)
  })
})

/** [what the route is, the address reloaded, the person it does not admit, where today's rule sends them] */
const REFUSED: Array<[string, string, () => NavPersona, string]> = [
  ['a roles list alone', '/manage/club', member, '/dashboard'],
  ['keepsAClub', '/my/club/fx-club-capital', member, '/dashboard'],
  ['allowDirectors', '/workspace', member, '/dashboard'],
  ['requireSeat', '/workspace/region', clubRep, '/dashboard'],
  ['requireSeat with requireClubMatch, a club outside the seat\'s region', '/workspace/region/clubs/fx-club-capital', regionalRep, '/dashboard'],
  ['allowMediaManager, for a club\'s rep, sent to their own tools', '/admin', clubRep, '/workspace'],
  ['allowMediaManager, for a plain member', '/admin/members', member, '/dashboard'],
  ['allowMediaManager, for a plain member who holds a seat other than the President seat', '/admin/email', regionalRep, '/dashboard'],
  ['requireClubMatch, another club\'s rep', '/admin/clubs/fx-club-north', clubRep, '/dashboard'],
  ['requireTournamentAccess, a plain member', '/admin/tournaments/fx-t-open', member, '/dashboard'],
]

describe('a reload of a guarded page, for a person the route does not admit', () => {
  it.each(REFUSED)('%s: %s', async (_kind, address, person, destination) => {
    await reload(address, person())
    expect(visited()).toEqual([address, destination])
    // Sent on only once the member is in hand: at the route's own address no page was drawn, and every draw
    // there showed the loading line but the one, with the member in hand, that sent the person on.
    const here = steps.filter((s) => s.at === address)
    expect(here.every((s) => s.page === null)).toBe(true)
    expect(here.filter((s) => !s.loading).every((s) => s.member)).toBe(true)
    expect(here.some((s) => s.loading)).toBe(true)
    expect(steps.some((s) => s.page === '/dashboard' && destination !== '/dashboard')).toBe(false)
  })

  it('an LCA admin whose session has no second factor is sent to set one up, as today, with no stop at the dashboard', async () => {
    await reload('/admin', admin(), 'aal1')
    await waitFor(() => expect(visited()).toEqual(['/admin', '/account/security']))
  })
})

/** Guarded addresses a visitor who is signed out may type or keep as a bookmark. */
const SIGNED_OUT_AT: string[] = [
  '/admin',
  '/workspace/region',
  '/my/club/fx-club-capital',
  '/dashboard',
  '/board/inbox',
]

describe('a visitor who is signed out, at a guarded address', () => {
  it.each(SIGNED_OUT_AT)('%s: the sign-in page, which is told where they were going', async (address) => {
    await reload(address, null)
    expect(visited()).toEqual([address, '/login'])
    expect(screen.getByTestId('from').textContent).toBe(address)
    expect(steps.filter((s) => s.at === '/login').every((s) => !s.loading)).toBe(true)
  })
})
