// @vitest-environment jsdom
//
// The sign-in listener in src/contexts/AuthContext.tsx loads the member again
// each time the sign-in client speaks (a tab coming back, a refreshed token).
// When that load fails for the same signed-in person who already has a member
// in hand, the member stays, so a guarded page is not taken away while the
// line is down or the server fails once:
//
// - an answer of 500 on the re-sync keeps the member and the guarded page
// - a network error on the re-sync does the same, and so does a 429
// - a plain no from the server (401, 403, 404) clears the member, as before
// - a different person whose load fails is cleared, as before
// - no member in hand yet: a failing load ends with no member, as before
// - a sign-out clears the member, as before
//
// Every person, address and token here is made up.
import { useLayoutEffect } from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/auth-context'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { navPersona, type NavPersona } from './fixtures/navPersonas'

const holder = vi.hoisted(() => ({ client: null as object | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: (_target, prop) => Reflect.get(holder.client as object, prop) }),
}))

interface StandInSession {
  access_token: string
  refresh_token: string
  user: { id: string; email: string; user_metadata: Record<string, unknown> }
  aal: 'aal1' | 'aal2'
}

type Listener = (event: string, session: StandInSession | null) => unknown

/** A sign-in client whose listener hears an event only from speak(). */
function standIn(start: StandInSession | null) {
  const listeners = new Set<Listener>()
  const state = { session: start }
  const speak = (event: string, session: StandInSession | null) => {
    state.session = session
    for (const listener of [...listeners]) void listener(event, session)
  }
  holder.client = {
    auth: {
      getSession: async () => ({ data: { session: state.session }, error: null }),
      onAuthStateChange: (listener: Listener) => {
        listeners.add(listener)
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
      },
      signOut: async () => {
        speak('SIGNED_OUT', null)
        return { error: null }
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: state.session?.aal ?? null, nextLevel: state.session?.aal ?? null },
          error: null,
        }),
      },
    },
  }
  return { speak }
}

function sessionFor(person: NavPersona, token = `tok-${person.key}`): StandInSession {
  return {
    access_token: token,
    refresh_token: `refresh-${person.key}`,
    user: { id: person.user!.id, email: person.user!.email, user_metadata: { role: 'member' } },
    aal: person.aal ?? 'aal1',
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** How the member's calls are answered right now: each person's own answers, or a failure. */
const mode = { fail: null as null | (() => Response | Promise<Response>) }

function site(people: NavPersona[]) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const call = `${method} ${url.pathname}`
      calls.push(call)
      if (mode.fail) return mode.fail()
      const auth = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('Authorization') ?? ''
      const person = people.find((p) => auth.endsWith(`tok-${p.key}`)) ?? people[0]
      const answers = person.answers!
      if (call === 'POST /api/me') return json(answers.synced, 201)
      if (call === 'GET /api/me') return json(answers.me)
      if (call === 'GET /api/board/my-seats') return json(answers.mySeats)
      return json({ error: 'Unauthorized' }, 401)
    }),
  )
  return calls
}

const seen = { member: null as string | null, user: false }
function Probe() {
  const auth = useAuth()
  useLayoutEffect(() => {
    seen.member = auth.member?.id ?? null
    seen.user = !!auth.user
  })
  return null
}

function open() {
  render(
    <AuthProvider>
      <Probe />
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleProtectedRoute roles={['lca_admin']}><p>The guarded page</p></RoleProtectedRoute>} />
          <Route path="*" element={<p>Somewhere else</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

async function run(ms = 60) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

afterEach(() => {
  cleanup()
  holder.client = null
  mode.fail = null
  seen.member = null
  seen.user = false
  vi.unstubAllGlobals()
})

const person = navPersona('admin')
const other = navPersona('president')

/** Opens the guarded page with the member in hand. */
async function openWithTheMember() {
  const calls = site([person, other])
  const client = standIn(sessionFor(person))
  open()
  await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
  await screen.findByText('The guarded page')
  await waitFor(() => expect(seen.member).toBe(person.user!.id))
  await run()
  return { calls, client }
}

describe('a failed re-sync for the same signed-in person keeps the member', () => {
  it.each([
    ['an answer of 500', () => json({ error: 'Something went wrong' }, 500)],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['an answer of 429', () => json({ error: 'Too many requests' }, 429)],
  ] as const)('%s: the member and the guarded page stay', async (_name, failure) => {
    const { calls, client } = await openWithTheMember()
    const before = calls.length
    mode.fail = failure
    await act(async () => client.speak('SIGNED_IN', sessionFor(person)))
    await run(120)
    expect(calls.slice(before)).toContain('POST /api/me')
    expect(seen.member).toBe(person.user!.id)
    expect(screen.getByText('The guarded page')).toBeTruthy()
    expect(screen.queryByText('Somewhere else')).toBeNull()
  })
})

describe('every other case behaves as before', () => {
  it.each([
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [404, 'Member not found'],
  ] as const)('an answer of %i on the re-sync clears the member', async (status, words) => {
    const { client } = await openWithTheMember()
    mode.fail = () => json({ error: words }, status)
    await act(async () => client.speak('SIGNED_IN', sessionFor(person)))
    await waitFor(() => expect(seen.member).toBeNull())
    expect(screen.queryByText('The guarded page')).toBeNull()
  })

  it('a different person whose load fails is cleared, and loads when it answers', async () => {
    const { client } = await openWithTheMember()
    mode.fail = () => json({ error: 'Something went wrong' }, 500)
    await act(async () => client.speak('SIGNED_IN', sessionFor(other)))
    await waitFor(() => expect(seen.member).toBeNull())
    mode.fail = null
    await act(async () => client.speak('TOKEN_REFRESHED', sessionFor(other)))
    await waitFor(() => expect(seen.member).toBe(other.user!.id))
  })

  it('no member in hand yet: a failing load ends with no member', async () => {
    site([person])
    mode.fail = () => json({ error: 'Something went wrong' }, 500)
    const client = standIn(sessionFor(person))
    open()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await run(120)
    await act(async () => client.speak('SIGNED_IN', sessionFor(person)))
    await run(120)
    expect(seen.user).toBe(true)
    expect(seen.member).toBeNull()
    expect(screen.queryByText('The guarded page')).toBeNull()
  })

  it('a sign-out clears the member', async () => {
    const { client } = await openWithTheMember()
    await act(async () => client.speak('SIGNED_OUT', null))
    await waitFor(() => expect(seen.member).toBeNull())
    expect(seen.user).toBe(false)
    expect(screen.queryByText('The guarded page')).toBeNull()
  })
})
