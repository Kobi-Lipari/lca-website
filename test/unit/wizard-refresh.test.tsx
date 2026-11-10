// @vitest-environment jsdom
//
// The wizard reads the signed-in member again after a create and before it
// opens the manage page, only with standingDirectors on, so the manage page
// finds the director row the create wrote for a standing director or the
// president. With the switch off a create is followed by the navigation and
// by no request at all: no refresh, no GET /api/me. With it on, the refresh
// is awaited before the wizard navigates, and runs only after a create the
// server took. Through the site's own sign-in context and route guard, the
// refresh draws the one "Loading..." in place of the Workspace page; since
// the router moves to the manage page inside a transition, the refreshed
// member is drawn first, at the old address, so the Workspace page is drawn
// once more and reads its list and the creation answer again before the
// manage page lands, as Admin › Tournaments is for the president, reading
// the creation answer, the list and the clubs again; and when the manage
// page's code loads on demand, as the site loads it, the Workspace page
// stays on screen, its list drawn again, until the code has loaded. The
// guard then admits the standing director to the new event, which it reads
// from the refreshed member; with the switch off a club rep's create opens
// the manage page with no second read of the member and no second draw of
// the Workspace page. The real wizard and pages run through the real
// client, with fetch stubbed, so every request they make is seen, and the
// wizard's navigation is noted when it is called.
import { lazy, Suspense, useLayoutEffect, type ComponentType, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, useAuth } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
/** What happened, in order: the requests by method and path, the refresh, the navigation as it is called and the landing on the manage page. */
const trail = vi.hoisted(() => ({ log: [] as string[] }))
/** The session the sign-in client holds; the server mirrors the member's role into its metadata, which the guard reads until the member is read. */
const SESSION = vi.hoisted(() => ({ access_token: 'tok-wizard', user: { id: 'u-1', user_metadata: {} as Record<string, unknown> } }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: SESSION } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }) },
    },
  },
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})
vi.mock('react-router-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...real,
    // The router's own navigate, noted at the moment it is called.
    useNavigate: () => {
      const navigate = real.useNavigate()
      return (...args: Parameters<typeof navigate>) => {
        trail.log.push(`navigate ${String(args[0])}`)
        return navigate(...args)
      }
    },
  }
})

const { TournamentWizard } = await import('@/areas/admin/components/TournamentWizard')
const { AuthProvider } = await import('@/contexts/AuthContext')
const { RoleProtectedRoute } = await import('@/components/auth/RoleProtectedRoute')
const { WorkspacePage } = await import('@/pages/WorkspacePage')
const { AdminPage } = await import('@/pages/AdminPage')
const { WORKSPACE_ROLES, ADMIN_PANEL_ROLES } = await import('@/areas/admin/roles')
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

const CREATE = '/api/admin/tournaments'
const TO_NEW = 'navigate /admin/tournaments/t-new'

interface Seen {
  url: string
  method: string
  headers: Record<string, string>
}
let seen: Seen[] = []
type Answer = { status: number; body: unknown } | (() => Promise<{ status: number; body: unknown }>)
let answers: Record<string, Answer> = {}
const log = trail.log

beforeEach(() => {
  flags.standingDirectors = true
  SESSION.user.user_metadata = {}
  seen = []
  log.length = 0
  answers = { [`POST ${CREATE}`]: { status: 201, body: { tournament: { id: 't-new' } } } }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const key = `${method} ${url.split('?')[0]}`
    seen.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string> })
    log.push(key)
    const found = answers[key]
    const answer = typeof found === 'function' ? await found() : found ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const requestsTo = (method: string, path: string) => seen.filter((s) => s.method === method && s.url.split('?')[0] === path)

/** The manage page's place in these tests: it notes the landing as the page is drawn, before the text can be found. */
function Landed() {
  useLayoutEffect(() => { log.push('landed') }, [])
  return <p>Manage page</p>
}

/** Walks the wizard to a draft: Continue from the starting point, the three basics, then Save draft. */
async function saveDraft() {
  fireEvent.click(await screen.findByRole('button', { name: /Continue/ }))
  fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Lafayette Spring Quads' } })
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-03-06' } })
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Lafayette, LA' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
}

/** The wizard alone, in a sign-in context whose refreshMember the case gives. */
function openWizard(refreshMember: () => Promise<void>) {
  const member = { id: 'm-sd', role: 'tournament_director', club_id: null, full_name: 'Gerald Landry' }
  const auth = {
    user: { id: 'm-sd' }, member, session: null, role: 'tournament_director', loading: false, memberLoading: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember,
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route path="/workspace" element={<TournamentWizard templates={[]} onCancel={() => {}} />} />
          <Route path="/admin/tournaments/:id" element={<Landed />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('the wizard\'s refresh before it navigates', () => {
  it('ships behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it('with the switch off, follows a create with the navigation and no refresh, no GET /api/me and no other request', async () => {
    flags.standingDirectors = false
    const refreshMember = vi.fn(async () => {})
    openWizard(refreshMember)
    await saveDraft()
    await screen.findByText('Manage page')
    expect(refreshMember).not.toHaveBeenCalled()
    expect(requestsTo('GET', '/api/me')).toEqual([])
    expect(log).toEqual([`POST ${CREATE}`, TO_NEW, 'landed'])
  })

  it('with the switch on, awaits a refresh that resolves after a tick, and navigates once it has, sending no request of its own', async () => {
    const refreshMember = vi.fn(() => new Promise<void>((resolve) => setTimeout(() => { log.push('refreshed'); resolve() }, 0)))
    openWizard(refreshMember)
    await saveDraft()
    await screen.findByText('Manage page')
    expect(refreshMember).toHaveBeenCalledTimes(1)
    expect(log).toEqual([`POST ${CREATE}`, 'refreshed', TO_NEW, 'landed'])
  })

  it('with the switch on, makes no navigation until the refresh ends, however long it takes', async () => {
    let finish = () => {}
    const refreshMember = vi.fn(() => new Promise<void>((resolve) => {
      log.push('refresh started')
      finish = () => { log.push('refresh finished'); resolve() }
    }))
    openWizard(refreshMember)
    await saveDraft()
    await waitFor(() => expect(refreshMember).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByText('Manage page')).toBeNull()
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeTruthy()
    expect(log).toEqual([`POST ${CREATE}`, 'refresh started'])
    finish()
    await screen.findByText('Manage page')
    expect(log).toEqual([`POST ${CREATE}`, 'refresh started', 'refresh finished', TO_NEW, 'landed'])
  })

  it('with the switch on, asks for no refresh when the server refuses the create, and stays on the wizard with its words', async () => {
    answers[`POST ${CREATE}`] = { status: 403, body: { error: 'Forbidden' } }
    const refreshMember = vi.fn(async () => {})
    openWizard(refreshMember)
    await saveDraft()
    await screen.findByText('Forbidden')
    expect(refreshMember).not.toHaveBeenCalled()
    expect(screen.queryByText('Manage page')).toBeNull()
    expect(log).toEqual([`POST ${CREATE}`])
  })
})

/** The member as GET /api/me answers it, with the events they direct. */
function meAnswer(member: { id: string; role: string; club_id: string | null }, directed: string[]) {
  return {
    status: 200,
    body: {
      member: { ...member, email: 'director@example.invalid', full_name: 'Gerald Landry', uscf_id: null, uscf_rating: null, uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: null, created_at: '2026-01-05 12:00:00' },
      registrations: [],
      directedTournaments: directed.map((id) => ({ id, name: 'Lafayette Spring Quads', date: '2027-03-06', status: 'upcoming' })),
    },
  }
}

/** Notes each change of memberLoading as it is drawn, so a case can count the times the guard drew "Loading..." for the member. */
function LoadingProbe() {
  const { memberLoading } = useAuth()
  useLayoutEffect(() => { log.push(`memberLoading ${memberLoading}`) }, [memberLoading])
  return null
}

/** Notes each time the page that holds the wizard is drawn and each time it goes, so a case can see it drawn again after the create. */
function PageProbe({ name }: { name: string }) {
  useLayoutEffect(() => {
    log.push(`${name} mounted`)
    return () => { log.push(`${name} unmounted`) }
  }, [name])
  return null
}

/**
 * The site's sign-in context with the Workspace page and the manage page's route behind the real guard, inside a Suspense boundary, as
 * App.tsx draws them; a case may give what the manage page's route draws.
 */
function openSignedIn(member: { role: string; club_id: string | null }, manage: ReactNode = <Landed />) {
  SESSION.user.user_metadata = { role: member.role, club_id: member.club_id }
  render(
    <AuthProvider>
      <LoadingProbe />
      <MemoryRouter initialEntries={['/workspace?tab=events']}>
        <Suspense fallback={<p>Loading line</p>}>
          <Routes>
            <Route path="/workspace" element={<RoleProtectedRoute roles={WORKSPACE_ROLES} allowDirectors><PageProbe name="workspace" /><WorkspacePage /></RoleProtectedRoute>} />
            <Route
              path="/admin/tournaments/:id"
              element={<RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'lca_officer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess>{manage}</RoleProtectedRoute>}
            />
            <Route path="/dashboard" element={<p>Dashboard</p>} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </AuthProvider>,
  )
}

/** The same for the president, from Admin › Tournaments behind the guard App.tsx gives Admin. */
function openAdminSignedIn(member: { role: string; club_id: string | null }) {
  SESSION.user.user_metadata = { role: member.role, club_id: member.club_id }
  render(
    <AuthProvider>
      <LoadingProbe />
      <MemoryRouter initialEntries={['/admin/tournaments']}>
        <Suspense fallback={<p>Loading line</p>}>
          <Routes>
            <Route path="/admin/:section" element={<RoleProtectedRoute roles={ADMIN_PANEL_ROLES} fallbackToToolsHome><PageProbe name="admin" /><AdminPage /></RoleProtectedRoute>} />
            <Route
              path="/admin/tournaments/:id"
              element={<RoleProtectedRoute roles={['lca_admin', 'lca_observer', 'lca_officer', 'club_rep', 'tournament_director']} allowDirectors requireTournamentAccess><Landed /></RoleProtectedRoute>}
            />
            <Route path="/dashboard" element={<p>Dashboard</p>} />
          </Routes>
        </Suspense>
      </MemoryRouter>
    </AuthProvider>,
  )
}

/** The times memberLoading went true after the create was sent. */
const loadsAfterCreate = () => log.slice(log.indexOf(`POST ${CREATE}`)).filter((l) => l === 'memberLoading true').length

const STANDING = { id: 'm-sd', role: 'tournament_director', club_id: null }
const REP = { id: 'm-rep', role: 'club_rep', club_id: 'club-k' }
const STANDING_GRANT = { status: 200, body: { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null } }
const SEATS = { status: 200, body: { seats: [], managedClubs: [] } }
const EMPTY_LIST = { status: 200, body: { tournaments: [] } }
/** The Workspace page's reads of its lists for a standing director: the list signed in and the creation answer. */
const REREAD = ['GET /api/tournaments', 'GET /api/me/tournament-creation']
/** The head of the Workspace page's list of events. */
const LIST = /Tournaments · \d+ current/

/** GET /api/me read twice, at sign-in and after the create, the second held until the case lets it answer; with a standing director's other answers. */
function answerMeTwice(member: { id: string; role: string; club_id: string | null } = STANDING) {
  let reads = 0
  const held = { release: () => {} }
  answers['GET /api/me'] = () => {
    reads += 1
    // The second read, after the create, lists the new event, as the create wrote its first director row.
    if (reads === 1) return Promise.resolve(meAnswer(member, []))
    return new Promise((resolve) => { held.release = () => resolve(meAnswer(member, ['t-new'])) })
  }
  answers['GET /api/board/my-seats'] = SEATS
  answers['GET /api/tournaments'] = EMPTY_LIST
  answers['GET /api/me/tournament-creation'] = STANDING_GRANT
  return held
}

describe('the refresh through the site\'s own sign-in context and route guard', () => {
  it('with the switch on, opens the new event\'s manage page for a standing director, the guard finding the director row the refreshed member holds, after one "Loading..." and a second draw of the Workspace page, which reads its lists again', async () => {
    const held = answerMeTwice()
    openSignedIn(STANDING)
    fireEvent.click(await screen.findByRole('button', { name: /New tournament/ }))
    await saveDraft()
    // While the member is read again, the guard draws "Loading..." in place of the page, and the wizard has not moved.
    await screen.findByText('Loading...')
    expect(log).not.toContain(TO_NEW)
    held.release()
    await screen.findByText('Manage page')
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(requestsTo('GET', '/api/me')).toHaveLength(2)
    expect(requestsTo('GET', '/api/me')[1].headers.Authorization).toBe('Bearer tok-wizard')
    const after = log.slice(log.indexOf(`POST ${CREATE}`))
    // Everything after the create but the Workspace page's second read of its lists, in order. The probe notes a change when the page
    // is drawn with it, so the refresh's end shows after the navigate call it let through; and since the router moves inside a
    // transition, the refreshed member is drawn first, at the old address, so the Workspace page is drawn once more before the landing.
    expect(after.filter((l) => !REREAD.includes(l))).toEqual([
      `POST ${CREATE}`, 'GET /api/me', 'GET /api/board/my-seats', 'workspace unmounted', 'memberLoading true',
      TO_NEW, 'memberLoading false', 'workspace mounted', 'workspace unmounted', 'landed',
    ])
    // Drawn once more, the Workspace page reads its list and the creation answer again, once each, as it does when it is first drawn.
    expect(after.filter((l) => REREAD.includes(l)).sort()).toEqual([...REREAD].sort())
    for (const read of REREAD) expect(after.indexOf(read), read).toBeGreaterThan(after.indexOf('workspace mounted'))
    expect(requestsTo('GET', '/api/tournaments')).toHaveLength(2)
    expect(loadsAfterCreate()).toBe(1)
  })

  it('with the switch on and the manage page\'s code loaded on demand, as the site loads it, keeps the Workspace page, drawn again with its list, on screen until the code has loaded', async () => {
    const held = answerMeTwice()
    const code = { loaded: () => {} }
    const ManagePage = lazy(() => new Promise<{ default: ComponentType }>((resolve) => { code.loaded = () => resolve({ default: Landed }) }))
    openSignedIn(STANDING, <ManagePage />)
    fireEvent.click(await screen.findByRole('button', { name: /New tournament/ }))
    await saveDraft()
    await screen.findByText('Loading...')
    expect(screen.queryByText(LIST)).toBeNull()
    held.release()
    // The router waits for the code inside its transition and keeps the page it leaves on screen, here the Workspace page drawn again.
    await screen.findByText(LIST)
    expect(log).toContain(TO_NEW)
    expect(requestsTo('GET', '/api/tournaments')).toHaveLength(2)
    expect(screen.queryByText('Manage page')).toBeNull()
    expect(screen.queryByText('Loading line')).toBeNull()
    code.loaded()
    await screen.findByText('Manage page')
    expect(screen.queryByText(LIST)).toBeNull()
    const moved = log.slice(log.indexOf(TO_NEW))
    expect(moved.filter((l) => !REREAD.includes(l))).toEqual([TO_NEW, 'memberLoading false', 'workspace mounted', 'workspace unmounted', 'landed'])
    for (const read of REREAD) expect(moved.indexOf(read), read).toBeGreaterThan(moved.indexOf('workspace mounted'))
    expect(loadsAfterCreate()).toBe(1)
  })

  it('with the switch on, opens the president\'s new event from Admin › Tournaments after one "Loading..." and a second draw of Admin, which reads the creation answer, the list and the clubs again', async () => {
    const PRESIDENT = { id: 'm-pres', role: 'lca_observer', club_id: null }
    const held = answerMeTwice(PRESIDENT)
    answers['GET /api/me/tournament-creation'] = { status: 200, body: { grant: 'president', canCreate: true, canChargeFees: true, clubId: null } }
    answers['GET /api/clubs'] = { status: 200, body: { clubs: [] } }
    openAdminSignedIn(PRESIDENT)
    fireEvent.click(await screen.findByRole('button', { name: /New tournament/ }))
    await saveDraft()
    await screen.findByText('Loading...')
    expect(log).not.toContain(TO_NEW)
    held.release()
    await screen.findByText('Manage page')
    /** Admin › Tournaments' reads with the switch on: the creation answer, then the list and the clubs. */
    const ADMIN_READS = ['GET /api/me/tournament-creation', 'GET /api/tournaments', 'GET /api/clubs']
    const after = log.slice(log.indexOf(`POST ${CREATE}`))
    expect(after.filter((l) => !ADMIN_READS.includes(l))).toEqual([
      `POST ${CREATE}`, 'GET /api/me', 'GET /api/board/my-seats', 'admin unmounted', 'memberLoading true',
      TO_NEW, 'memberLoading false', 'admin mounted', 'admin unmounted', 'landed',
    ])
    expect(after.filter((l) => ADMIN_READS.includes(l)).sort()).toEqual([...ADMIN_READS].sort())
    for (const read of ADMIN_READS) expect(after.indexOf(read), read).toBeGreaterThan(after.indexOf('admin mounted'))
    expect(loadsAfterCreate()).toBe(1)
  })

  it('with the switch on, sends the standing director to /dashboard when the refreshed member directs nothing new, so the guard reads the refreshed list', async () => {
    answers['GET /api/me'] = meAnswer(STANDING, [])
    answers['GET /api/board/my-seats'] = SEATS
    answers['GET /api/tournaments'] = EMPTY_LIST
    answers['GET /api/me/tournament-creation'] = STANDING_GRANT
    openSignedIn(STANDING)
    fireEvent.click(await screen.findByRole('button', { name: /New tournament/ }))
    await saveDraft()
    await screen.findByText('Dashboard')
    expect(requestsTo('GET', '/api/me')).toHaveLength(2)
    expect(log).not.toContain('landed')
  })

  it('with the switch off, opens a club rep\'s new event with no second read of the member, no "Loading..." and no second draw of the Workspace page after the create', async () => {
    flags.standingDirectors = false
    answers['GET /api/me'] = meAnswer(REP, [])
    answers['GET /api/board/my-seats'] = SEATS
    answers['GET /api/tournaments'] = EMPTY_LIST
    openSignedIn(REP)
    fireEvent.click(await screen.findByRole('button', { name: /New tournament/ }))
    await saveDraft()
    await screen.findByText('Manage page')
    expect(requestsTo('GET', '/api/me')).toHaveLength(1)
    expect(requestsTo('GET', '/api/me/tournament-creation')).toEqual([])
    // The move takes the Workspace page away once, and nothing draws it again.
    expect(log.slice(log.indexOf(`POST ${CREATE}`))).toEqual([`POST ${CREATE}`, TO_NEW, 'workspace unmounted', 'landed'])
    expect(loadsAfterCreate()).toBe(0)
  })
})
