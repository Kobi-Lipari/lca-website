// @vitest-environment jsdom
//
// The readers of memberLoading under src/ in the first draw of a signed-in
// page, each through the site's own sign-in context
// (src/contexts/AuthContext.tsx), with the session found at the start as a
// reload finds it:
//
// - ManageClubPage, under the guard App.tsx draws it under: the loading line
//   until the member is in hand and then the page it always sent the person
//   to, with no stop at the dashboard on the way, with clubKeepers off as it
//   ships and with it on
// - the header's join slot (joinSlotOf): nothing offered while the member
//   is on its way, then Renew for an expired membership once it is in hand;
//   a visitor with no session is offered nothing, in every draw
// - useMediaManager, with mailLists on in this file alone: it asks nothing
//   while the member is on its way, asks once the member is in hand, and
//   with mailLists as it ships asks nothing at all
//
// Every person, club and token here is made up.
import { useLayoutEffect, type ReactNode } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ clubKeepers: false, mailLists: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})

const getMediaManager = vi.hoisted(() => vi.fn<() => Promise<{ mediaManager: boolean; secondFactor: boolean }>>())
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getMediaManager }))

interface StandInSession {
  access_token: string
  refresh_token: string
  user: { id: string; email: string; user_metadata: Record<string, unknown> }
  aal: 'aal1' | 'aal2'
}
type Listener = (event: string, session: StandInSession | null) => unknown

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
const { ManageClubPage } = await import('@/pages/ManageClubPage')
const { joinSlotOf } = await import('@/components/layout/headerParts')
const { useMediaManager } = await import('@/areas/admin/useMediaManager')
const { RoleProtectedRoute } = await import('@/components/auth/RoleProtectedRoute')
const { navPersona } = await import('./fixtures/navPersonas')
type NavPersona = ReturnType<typeof navPersona>

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
/** A bearer token in the sign-in service's shape, for a made-up person. */
const tokenFor = (sub: string) => `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, session_id: `session-${sub}`, aal: 'aal2', role: 'authenticated' })}.sample-signature`

/** What the reading components saw in each draw: loading, member, the join slot, the media manager's answer. */
interface Draw {
  user: boolean
  loading: boolean
  memberLoading: boolean
  member: boolean
  slot: string | null
  asking: boolean
}
const draws: Draw[] = []
const places: string[] = []
const isTheOldDraw = (d: Draw) => d.user && !d.loading && !d.memberLoading && !d.member

function Readers() {
  const auth = useAuth()
  const answer = useMediaManager(true)
  useLayoutEffect(() => {
    draws.push({ user: auth.user !== null, loading: auth.loading, memberLoading: auth.memberLoading, member: auth.member !== null, slot: joinSlotOf(auth), asking: answer.asking })
  })
  return null
}

function Where() {
  const location = useLocation()
  useLayoutEffect(() => {
    if (places[places.length - 1] !== location.pathname) places.push(location.pathname)
  })
  return null
}

/** The page as App.tsx draws it: under a guard that lets a club's rep in, and an LCA admin with clubKeepers on. */
function Guarded() {
  return (
    <RoleProtectedRoute roles={flags.clubKeepers ? ['club_rep', 'lca_admin'] : ['club_rep']}>
      <ManageClubPage />
    </RoleProtectedRoute>
  )
}

async function reload(person: NavPersona | null, address: string, element: ReactNode, holdAnswers = false) {
  draws.length = 0
  places.length = 0
  signIn.listeners.clear()
  signIn.session = person
    ? {
        access_token: tokenFor(person.user!.id),
        refresh_token: `refresh-${person.key}`,
        user: { id: person.user!.id, email: person.user!.email, user_metadata: { role: 'member' } },
        aal: person.aal ?? 'aal1',
      }
    : null
  let release = () => {}
  const gate = holdAnswers ? new Promise<void>((r) => (release = r)) : Promise.resolve()
  const answers = person?.answers
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const call = `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`
      await gate
      if (answers && call === 'POST /api/me') return json(answers.synced, 201)
      if (answers && call === 'GET /api/me') return json(answers.me)
      if (answers && call === 'GET /api/board/my-seats') return json(answers.mySeats)
      return json({ error: 'Unauthorized' }, 401)
    }),
  )
  render(
    <AuthProvider>
      <Readers />
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route path="/manage/club" element={element} />
          <Route path="*" element={<p>Somewhere else</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </AuthProvider>,
  )
  const session = signIn.session
  await act(async () => {
    for (const listener of [...signIn.listeners]) void listener('INITIAL_SESSION', session)
  })
  return { release: () => act(async () => release()) }
}

async function settle(ms = 200) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

beforeEach(() => {
  flags.clubKeepers = false
  flags.mailLists = false
  getMediaManager.mockReset()
  getMediaManager.mockResolvedValue({ mediaManager: true, secondFactor: true })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  signIn.session = null
  signIn.listeners.clear()
})

describe('ManageClubPage, under its guard, in the first draw', () => {
  it.each([
    ['clubKeepers off, a club\'s rep', false, 'club-rep', '/admin/clubs/fx-club-capital'],
    ['clubKeepers off, a plain member, whom the guard sends on', false, 'active-member', '/dashboard'],
    ['clubKeepers on, a club\'s rep', true, 'club-rep', '/my/club/fx-club-capital'],
    ['clubKeepers on, an LCA admin', true, 'admin', '/admin/clubs'],
    ['clubKeepers on, a plain member, whom the guard sends on', true, 'active-member', '/dashboard'],
  ] as const)('%s: the loading line, then the page it always sent them to', async (_name, keepers, key, destination) => {
    flags.clubKeepers = keepers
    const { release } = await reload(navPersona(key), '/manage/club', <Guarded />, true)
    await settle()
    // Answers held: the member is on its way, and the page has sent nobody anywhere.
    expect(places).toEqual(['/manage/club'])
    expect(document.body.textContent).toContain('Loading...')
    await release()
    await settle()
    expect(places).toEqual(['/manage/club', destination])
  })

  it('a first load that fails ends on the dashboard, as a person with no member always did, after the loading line', async () => {
    flags.clubKeepers = true
    const person = navPersona('club-rep')
    places.length = 0
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Something went wrong' }, 500)))
    signIn.listeners.clear()
    signIn.session = {
      access_token: tokenFor(person.user!.id),
      refresh_token: 'refresh-x',
      user: { id: person.user!.id, email: person.user!.email, user_metadata: { role: 'member' } },
      aal: 'aal1',
    }
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/manage/club']}>
          <Routes>
            <Route path="/manage/club" element={<Guarded />} />
            <Route path="*" element={<p>Somewhere else</p>} />
          </Routes>
          <Where />
        </MemoryRouter>
      </AuthProvider>,
    )
    await settle(400)
    expect(places).toEqual(['/manage/club', '/dashboard'])
  })
})

describe('the header\'s join slot in the first draw', () => {
  it('offers nothing while the member is on its way, then Renew for an expired membership once it is in hand', async () => {
    const { release } = await reload(navPersona('expired-member'), '/somewhere', null, true)
    await settle()
    expect(draws.filter((d) => d.member)).toEqual([])
    expect(draws.every((d) => d.slot === null)).toBe(true)
    expect(draws.filter(isTheOldDraw)).toEqual([])
    await release()
    await settle()
    const end = draws[draws.length - 1]
    expect(end).toMatchObject({ memberLoading: false, member: true, slot: 'renew' })
  })

  it('a visitor with no session is offered nothing and is never told the member is loading', async () => {
    await reload(null, '/somewhere', null)
    await settle()
    expect(draws.length).toBeGreaterThan(0)
    expect(draws.every((d) => d.slot === null && !d.memberLoading && !d.member)).toBe(true)
  })
})

describe('useMediaManager in the first draw', () => {
  it('with mailLists on: asks nothing while the member is on its way, and asks once the member is in hand', async () => {
    flags.mailLists = true
    const { release } = await reload(navPersona('active-member'), '/somewhere', null, true)
    await settle()
    expect(draws.filter((d) => d.member)).toEqual([])
    expect(getMediaManager).not.toHaveBeenCalled()
    expect(draws.every((d) => !d.asking)).toBe(true)
    await release()
    await settle()
    expect(draws[draws.length - 1]).toMatchObject({ member: true, memberLoading: false })
    expect(getMediaManager).toHaveBeenCalledTimes(1)
  })

  it('with mailLists as it ships: asks nothing at all, before the member and after', async () => {
    const { release } = await reload(navPersona('active-member'), '/somewhere', null, true)
    await settle()
    await release()
    await settle()
    expect(draws[draws.length - 1]).toMatchObject({ member: true, memberLoading: false })
    expect(getMediaManager).not.toHaveBeenCalled()
  })

  it('with mailLists on and no session: asks nothing', async () => {
    flags.mailLists = true
    await reload(null, '/somewhere', null)
    await settle()
    expect(getMediaManager).not.toHaveBeenCalled()
  })
})
