// @vitest-environment jsdom
//
// The first draw of a signed-in page, through the site's own sign-in context
// (src/contexts/AuthContext.tsx), with every draw it makes written down.
// From the moment a session with a user is known until the first load of
// that session's member has ended, well or badly, memberLoading reads true,
// so no draw has the session, loading false, memberLoading false and no
// member, which is the draw in which a guarded route used to read the
// default role and send a person to the dashboard on a reload:
//
// - with the site's real sign-in client over a session kept in the page's
//   storage, as a reload finds it
// - with a stand-in client that speaks when the case says: a session found
//   by the first read, the client's listener speaking before, after and
//   twice around that read, and a sign-in made after the page opened
// - a first load that fails (an answer of 500, a network error) ends with
//   memberLoading false and no member after one automatic call and no more;
//   one load failing while the other is still on its way keeps the wait
// - an answer of 401 signs the person out and ends with memberLoading false;
//   a sign-out ends with it false; a visitor with no session never reads it
//   true in any draw
// - with the member in hand, a refreshed token, the client speaking again
//   (a tab coming back, a second event, a new token set as "view as" sets
//   one) never turns it true, and a page under a guard stays the same page,
//   with what was typed in it
// - the loads at the start are today's: one by the listener for each event
//   it hears and the automatic one; the real library's listener hears two
//   events on a reload, so POST /api/me twice and GET /api/me three times
//
// Every person, address and token here is made up.
import { useLayoutEffect, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/contexts/auth-context'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'
import { FAKE_SUPABASE_URL } from '../a11y/global-setup'
import { SESSION_KEY, plantedSession } from '../a11y/signedIn'
import { navPersona, type NavPersona } from './fixtures/navPersonas'

// The browser tests' setup file finds the repository from its own file
// address, which this test page's address cannot stand in for; its two
// values are read from the file instead, as test/unit/signed-in-header.test.tsx does.
vi.mock('../a11y/global-setup', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const root = path.resolve(__dirname, '../..')
  const text = fs.readFileSync(path.join(root, 'test/a11y/global-setup.ts'), 'utf8')
  return { ROOT: root, FAKE_SUPABASE_URL: /export const FAKE_SUPABASE_URL = '([^']+)'/.exec(text)![1] }
})

/** The sign-in client the site's one client stands for in a case: the real library's or the stand-in below. */
const holder = vi.hoisted(() => ({ client: null as object | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: (_target, prop) => Reflect.get(holder.client as object, prop) }),
}))

const ANON_KEY = 'fake-anon-key-for-a11y-tests'
const SIGN_IN_ORIGIN = new URL(FAKE_SUPABASE_URL).origin

/** A session as the stand-in client holds one; the user record carries the plain member's role, as a sign-up writes it. */
interface StandInSession {
  access_token: string
  refresh_token: string
  user: { id: string; email: string; user_metadata: Record<string, unknown> }
  aal: 'aal1' | 'aal2'
}

type Listener = (event: string, session: StandInSession | null) => unknown

/**
 * A sign-in client that speaks only when a case says so: the provider's first
 * read of the session waits for `firstRead` when one is given, every later
 * read answers at once, and the listener hears an event only from speak().
 * signOut and setSession speak as the library does.
 */
function standIn(start: StandInSession | null, options: { firstRead?: Promise<void> } = {}) {
  const listeners = new Set<Listener>()
  const state = { session: start, reads: 0, signOuts: 0 }
  const speak = (event: string, session: StandInSession | null) => {
    state.session = session
    for (const listener of [...listeners]) void listener(event, session)
  }
  const client = {
    auth: {
      getSession: async () => {
        if (state.reads++ === 0 && options.firstRead) await options.firstRead
        return { data: { session: state.session }, error: null }
      },
      onAuthStateChange: (listener: Listener) => {
        listeners.add(listener)
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } }
      },
      signOut: async () => {
        state.signOuts += 1
        speak('SIGNED_OUT', null)
        return { error: null }
      },
      setSession: async (session: StandInSession) => {
        speak('SIGNED_IN', session)
        return { data: { session }, error: null }
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: state.session?.aal ?? null, nextLevel: state.session?.aal ?? null },
          error: null,
        }),
      },
    },
  }
  holder.client = client
  return { state, speak }
}

function sessionFor(person: NavPersona, token = `tok-${person.key}`): StandInSession {
  return {
    access_token: token,
    refresh_token: `refresh-${person.key}`,
    user: { id: person.user!.id, email: person.user!.email, user_metadata: { role: 'member' } },
    aal: person.aal ?? 'aal1',
  }
}

/** One draw of the context, as the probe saw it committed. */
interface Draw {
  user: boolean
  loading: boolean
  memberLoading: boolean
  member: string | null
}

/** The draw a guarded route used to send a signed-in person away in. */
const isTheOldDraw = (d: Draw) => d.user && !d.loading && !d.memberLoading && d.member === null

const draws: Draw[] = []
function Probe() {
  const auth = useAuth()
  useLayoutEffect(() => {
    draws.push({ user: !!auth.user, loading: auth.loading, memberLoading: auth.memberLoading, member: auth.member?.id ?? null })
  })
  return (
    <>
      <button type="button" onClick={() => void auth.signOut()}>Sign out</button>
      <button type="button" onClick={() => void auth.refreshMember()}>Read again</button>
    </>
  )
}
const last = () => draws[draws.length - 1]

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** How the site's three calls for the member are answered in a case. */
type Answer = (call: string) => Response | Promise<Response>

interface Site {
  calls: string[]
  signInCalls: string[]
  /** Lets every held answer go. */
  release: () => void
}

/** Stubs fetch: the member's three calls are answered by `answer` (by default the person's own answers), held until release() when `hold` is set. */
function site(person: NavPersona | null, options: { hold?: boolean; answer?: Answer } = {}): Site {
  let release!: () => void
  const gate = options.hold ? new Promise<void>((r) => (release = r)) : Promise.resolve()
  if (!options.hold) release = () => {}
  const record: Site = { calls: [], signInCalls: [], release: () => release() }
  const answers = person?.answers
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      if (url.origin === SIGN_IN_ORIGIN) {
        record.signInCalls.push(`${method} ${url.href}`)
        throw new TypeError('the fake sign-in address refuses every connection')
      }
      const call = `${method} ${url.pathname}`
      record.calls.push(call)
      await gate
      if (options.answer) return options.answer(call)
      if (answers && call === 'POST /api/me') return json(answers.synced, 201)
      if (answers && call === 'GET /api/me') return json(answers.me)
      if (answers && call === 'GET /api/board/my-seats') return json(answers.mySeats)
      return json({ error: 'Unauthorized' }, 401)
    }),
  )
  return record
}

const count = (record: Site, call: string) => record.calls.filter((c) => c === call).length

function open(children: ReactNode = null) {
  draws.length = 0
  render(
    <AuthProvider>
      <Probe />
      {children}
    </AuthProvider>,
  )
}

/** Lets the page run for a while: promises settle and timers fire. */
async function run(ms = 30) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })
}

/** Waits until the page has made no new call for a while. */
async function settled(record: Site) {
  let seen = -1
  let quiet = 0
  while (quiet < 3) {
    await run(30)
    quiet = record.calls.length === seen ? quiet + 1 : 0
    seen = record.calls.length
  }
}

afterEach(async () => {
  cleanup()
  const client = holder.client as Partial<SupabaseClient> | null
  if (client && typeof client.auth?.dispose === 'function') await client.auth.dispose()
  holder.client = null
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('the site\'s real sign-in client, over a session kept in the page\'s storage', () => {
  function realClient(): SupabaseClient {
    const warn = console.warn
    console.warn = (...args: unknown[]) => {
      if (!String(args[0]).includes('Multiple GoTrueClient instances')) warn(...args)
    }
    try {
      return createClient(FAKE_SUPABASE_URL, ANON_KEY)
    } finally {
      console.warn = warn
    }
  }

  it('a reload: memberLoading reads true from the first draw that knows the session until the member arrives', async () => {
    const person = navPersona('admin')
    localStorage.setItem(SESSION_KEY, JSON.stringify(plantedSession(person)))
    const record = site(person, { hold: true })
    holder.client = realClient()
    open()

    await waitFor(() => expect(draws.some((d) => d.user)).toBe(true))
    await run(60)
    // The client has read the session and its listener has spoken; the answers are held.
    expect(draws.filter((d) => d.user).every((d) => d.memberLoading)).toBe(true)
    expect(draws.filter(isTheOldDraw)).toEqual([])

    record.release()
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: person.user!.id })
    expect(draws.filter(isTheOldDraw)).toEqual([])
    // Today's loads at the start, the same before this change and after it: the library's listener hears
    // SIGNED_IN as it takes up the kept session and INITIAL_SESSION as the listener is added, and loads the
    // member for each (POST, then GET), and the automatic load asks GET once more.
    expect(count(record, 'POST /api/me')).toBe(2)
    expect(count(record, 'GET /api/me')).toBe(3)
    expect(count(record, 'GET /api/board/my-seats')).toBe(3)
    expect(record.signInCalls).toEqual([])
  })

  it('a visitor with nothing kept: memberLoading is never true, and nothing is asked', async () => {
    const record = site(null)
    holder.client = realClient()
    open()
    await waitFor(() => expect(last().loading).toBe(false))
    await settled(record)
    expect(draws.some((d) => d.memberLoading)).toBe(false)
    expect(record.calls).toEqual([])
  })
})

describe('a stand-in sign-in client that speaks when the case says', () => {
  const person = navPersona('regional-rep')

  /** Opens the page with the session found by the first read, held until `readNow` is called, and the answers held. */
  function openWithSession(answer?: Answer) {
    let readNow!: () => void
    const firstRead = new Promise<void>((r) => (readNow = r))
    const record = site(person, { hold: true, answer })
    const client = standIn(sessionFor(person), { firstRead })
    open()
    return { record, client, readNow: () => act(async () => readNow()) }
  }

  async function endsWithTheMember(record: Site) {
    record.release()
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: person.user!.id })
    expect(draws.filter(isTheOldDraw)).toEqual([])
  }

  it('the first read finds the session and the listener speaks after it', async () => {
    const { record, client, readNow } = openWithSession()
    await readNow()
    await run()
    expect(last()).toMatchObject({ user: true, loading: false, memberLoading: true, member: null })
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await run()
    expect(draws.filter(isTheOldDraw)).toEqual([])
    await endsWithTheMember(record)
    expect(count(record, 'POST /api/me')).toBe(1)
    expect(count(record, 'GET /api/me')).toBe(2)
  })

  it('the listener speaks before the first read', async () => {
    const { record, client, readNow } = openWithSession()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await run()
    expect(last()).toMatchObject({ user: true, loading: false, memberLoading: true, member: null })
    await readNow()
    await run()
    expect(draws.filter(isTheOldDraw)).toEqual([])
    await endsWithTheMember(record)
    expect(count(record, 'POST /api/me')).toBe(1)
    expect(count(record, 'GET /api/me')).toBe(2)
  })

  it('the listener speaks twice, once before the first read and once after', async () => {
    const { record, client, readNow } = openWithSession()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await readNow()
    await act(async () => client.speak('SIGNED_IN', sessionFor(person)))
    await run()
    expect(draws.filter(isTheOldDraw)).toEqual([])
    expect(last().memberLoading).toBe(true)
    await endsWithTheMember(record)
    // Each event the listener hears loads the member, as today: two of its own and the automatic one.
    expect(count(record, 'POST /api/me')).toBe(2)
    expect(count(record, 'GET /api/me')).toBe(3)
  })

  it('a sign-in made after the page opened', async () => {
    const record = site(person, { hold: true })
    const client = standIn(null)
    open()
    await run()
    expect(last()).toMatchObject({ user: false, loading: false, memberLoading: false })
    await act(async () => client.speak('SIGNED_IN', sessionFor(person)))
    await run()
    expect(last()).toMatchObject({ user: true, memberLoading: true, member: null })
    await endsWithTheMember(record)
    expect(count(record, 'POST /api/me')).toBe(1)
    expect(count(record, 'GET /api/me')).toBe(2)
  })

  it.each([
    ['an answer of 500', () => json({ error: 'Something went wrong' }, 500)],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
  ] as const)('a first load that fails with %s ends with memberLoading false and no member, after one automatic call', async (_name, failure) => {
    const { record, client, readNow } = openWithSession(failure)
    await readNow()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await run()
    expect(draws.filter(isTheOldDraw)).toEqual([])
    record.release()
    await waitFor(() => expect(last().memberLoading).toBe(false))
    await settled(record)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: null })
    // The draw that ends the wait is the last kind of draw there is: nothing after it reads true again.
    const firstEnd = draws.findIndex(isTheOldDraw)
    expect(draws.slice(firstEnd).every(isTheOldDraw)).toBe(true)
    // The listener's POST failed before its GET; the automatic load asked GET /api/me once.
    expect(count(record, 'POST /api/me')).toBe(1)
    expect(count(record, 'GET /api/me')).toBe(1)
    await run(300)
    expect(count(record, 'GET /api/me')).toBe(1)
    expect(client.state.signOuts).toBe(0)
  })

  it('one load failing while the other is still on its way keeps the wait until that one ends', async () => {
    let letTheListenerIn!: () => void
    const listenerHeld = new Promise<void>((r) => (letTheListenerIn = r))
    const { record, client, readNow } = openWithSession(async (call) => {
      if (call === 'POST /api/me') {
        await listenerHeld
        return json(person.answers!.synced, 201)
      }
      // The automatic load's GET /api/me fails; the listener's, asked after its POST, is answered.
      if (call === 'GET /api/me' && count(record, 'POST /api/me') === 1 && count(record, 'GET /api/me') === 1) return json({ error: 'Something went wrong' }, 500)
      if (call === 'GET /api/me') return json(person.answers!.me)
      return json(person.answers!.mySeats)
    })
    await readNow()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    record.release()
    await run(60)
    expect(count(record, 'GET /api/me')).toBe(1)
    expect(last()).toMatchObject({ user: true, memberLoading: true, member: null })
    await act(async () => letTheListenerIn())
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    expect(last().memberLoading).toBe(false)
    expect(draws.filter(isTheOldDraw)).toEqual([])
  })

  it('an answer of 401 signs the person out and ends with memberLoading false', async () => {
    const { record, client, readNow } = openWithSession(() => json({ error: 'Unauthorized' }, 401))
    await readNow()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await run()
    expect(draws.filter(isTheOldDraw)).toEqual([])
    record.release()
    await waitFor(() => expect(last().user).toBe(false))
    await settled(record)
    expect(last()).toEqual({ user: false, loading: false, memberLoading: false, member: null })
    expect(client.state.signOuts).toBe(1)
    expect(count(record, 'GET /api/me')).toBe(1)
  })

  it('a sign-out ends with memberLoading false, in every draw after it', async () => {
    const record = site(person)
    const client = standIn(sessionFor(person))
    open()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    const before = draws.length
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(last().user).toBe(false))
    await settled(record)
    expect(draws.slice(before).some((d) => d.memberLoading)).toBe(false)
    expect(last()).toEqual({ user: false, loading: false, memberLoading: false, member: null })
    expect(draws.filter(isTheOldDraw)).toEqual([])
  })

  it('a visitor with no session never reads memberLoading true, in any draw, and nothing is asked', async () => {
    const record = site(null)
    const client = standIn(null)
    open()
    await act(async () => client.speak('INITIAL_SESSION', null))
    await settled(record)
    await act(async () => client.speak('TOKEN_REFRESHED', null))
    await settled(record)
    expect(draws.length).toBeGreaterThan(1)
    expect(draws.some((d) => d.memberLoading)).toBe(false)
    expect(record.calls).toEqual([])
  })

  it('today\'s own refreshMember still reads true while it reads the member again, as it always has', async () => {
    const record = site(person)
    const client = standIn(sessionFor(person))
    open()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    const before = draws.length
    fireEvent.click(screen.getByRole('button', { name: 'Read again' }))
    await settled(record)
    expect(draws.slice(before).some((d) => d.memberLoading && d.member !== null)).toBe(true)
    expect(last().memberLoading).toBe(false)
  })
})

describe('with the member in hand, nothing this step adds turns memberLoading true', () => {
  const person = navPersona('admin')

  /** A page under the real guard, with a field that keeps what was typed and says how many times it was put on the page. */
  function TypedPage() {
    useLayoutEffect(() => {
      document.body.dataset.pageMounts = String(Number(document.body.dataset.pageMounts ?? '0') + 1)
    }, [])
    return (
      <label>
        Club name
        <input defaultValue="" />
      </label>
    )
  }

  it('a refreshed token, a tab coming back, a second event and a new session set as "view as" sets one leave the page as it is', async () => {
    delete document.body.dataset.pageMounts
    let hold = false
    let release = () => {}
    const record = site(person, {
      answer: async (call) => {
        if (hold) await new Promise<void>((r) => (release = r))
        if (call === 'POST /api/me') return json(person.answers!.synced, 201)
        if (call === 'GET /api/me') return json(person.answers!.me)
        return json(person.answers!.mySeats)
      },
    })
    const client = standIn(sessionFor(person))
    open(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<RoleProtectedRoute roles={['lca_admin']}><TypedPage /></RoleProtectedRoute>} />
          <Route path="*" element={<p>Somewhere else</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    const field = await screen.findByRole('textbox', { name: 'Club name' })
    await settled(record)
    fireEvent.change(field, { target: { value: 'Example Chess Club' } })
    const inHand = draws.length

    // The answers to each new event's load are held, so the draws in between are seen.
    hold = true
    await act(async () => client.speak('TOKEN_REFRESHED', sessionFor(person, 'tok-admin-refreshed')))
    await run(60)
    hold = false
    await act(async () => release())
    await settled(record)
    await act(async () => client.speak('SIGNED_IN', sessionFor(person, 'tok-admin-refreshed')))
    await settled(record)
    await act(async () => client.speak('SIGNED_IN', sessionFor(person, 'tok-admin-refreshed')))
    await settled(record)
    await act(async () => {
      await (holder.client as { auth: { setSession: (s: StandInSession) => Promise<unknown> } }).auth.setSession(sessionFor(person, 'tok-view-as'))
    })
    await settled(record)

    expect(draws.slice(inHand).some((d) => d.memberLoading)).toBe(false)
    expect(draws.slice(inHand).every((d) => d.member === person.user!.id)).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Club name' })).toBe(field)
    expect((field as HTMLInputElement).value).toBe('Example Chess Club')
    expect(document.body.dataset.pageMounts).toBe('1')
    expect(screen.queryByText('Loading...')).toBeNull()
  })
})

describe('edges of the wait: a client that never speaks, a token refreshed after a failure, another person on the same page', () => {
  const person = navPersona('regional-rep')
  const other = navPersona('admin')

  it('the first read finds the session and the listener never speaks: the automatic load alone ends the wait', async () => {
    const record = site(person, { hold: true })
    standIn(sessionFor(person))
    open()
    await run(60)
    expect(last()).toMatchObject({ user: true, loading: false, memberLoading: true, member: null })
    expect(draws.filter(isTheOldDraw)).toEqual([])
    record.release()
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: person.user!.id })
    expect(draws.filter(isTheOldDraw)).toEqual([])
    // The automatic load alone: no listener load, so no POST.
    expect(count(record, 'POST /api/me')).toBe(0)
    expect(count(record, 'GET /api/me')).toBe(1)
  })

  it('the first read finds the session, the listener never speaks and the automatic load fails: it ends in false after one call', async () => {
    const record = site(person, { hold: true, answer: () => json({ error: 'Something went wrong' }, 500) })
    const client = standIn(sessionFor(person))
    open()
    await run(60)
    expect(last().memberLoading).toBe(true)
    record.release()
    await waitFor(() => expect(last().memberLoading).toBe(false))
    await settled(record)
    await run(300)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: null })
    expect(count(record, 'GET /api/me')).toBe(1)
    expect(client.state.signOuts).toBe(0)
    expect(draws.slice(draws.findIndex(isTheOldDraw)).every(isTheOldDraw)).toBe(true)
  })

  it('a refreshed token after a failed first load: the wait for the new token ends too, with one more automatic call and no loop', async () => {
    const record = site(person, { answer: () => json({ error: 'Something went wrong' }, 500) })
    const client = standIn(sessionFor(person))
    open()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await settled(record)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: null })
    const asked = count(record, 'GET /api/me')
    expect(asked).toBe(1)
    await act(async () => client.speak('TOKEN_REFRESHED', sessionFor(person, 'tok-refreshed')))
    await settled(record)
    await run(300)
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: null })
    // The one automatic attempt is for each access token: the new token gets one, and then no more.
    expect(count(record, 'GET /api/me')).toBe(asked + 1)
    expect(client.state.signOuts).toBe(0)
  })

  it('one person signs out and another signs in on the same page: the second person has a wait of their own, with no stop in the old draw', async () => {
    const record = site(person)
    const client = standIn(sessionFor(person))
    open()
    await act(async () => client.speak('INITIAL_SESSION', sessionFor(person)))
    await waitFor(() => expect(last().member).toBe(person.user!.id))
    await settled(record)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(last().user).toBe(false))
    await settled(record)
    const before = draws.length
    // The second person's own answers.
    record.calls.length = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input), window.location.href)
        const call = `${(init?.method ?? 'GET').toUpperCase()} ${url.pathname}`
        await new Promise((r) => setTimeout(r, 40))
        if (call === 'POST /api/me') return json(other.answers!.synced, 201)
        if (call === 'GET /api/me') return json(other.answers!.me)
        return json(other.answers!.mySeats)
      }),
    )
    await act(async () => client.speak('SIGNED_IN', sessionFor(other)))
    await waitFor(() => expect(last().member).toBe(other.user!.id))
    await settled(record)
    expect(draws.slice(before).filter(isTheOldDraw)).toEqual([])
    expect(draws.slice(before).find((d) => d.user)).toMatchObject({ memberLoading: true, member: null })
    expect(last()).toEqual({ user: true, loading: false, memberLoading: false, member: other.user!.id })
  })
})
