// @vitest-environment jsdom
//
// The signed-in visitor of test/a11y/signedIn.ts, drawn by the site's own
// sign-in context and today's header in a test page, for every person in
// test/unit/fixtures/navPersonas.ts:
//
// - the session the helper plants, under the key it plants it, is read by a
//   sign-in client made as src/lib/supabase.ts makes one, and the context
//   (src/contexts/AuthContext.tsx) asks the site for the member with the
//   three calls the helper answers: POST /api/me, GET /api/me and GET
//   /api/board/my-seats, and for nothing else; nothing goes to the fake
//   sign-in address
// - what the context works out from the person's answers is what the
//   person's list says it holds: the role, the board seat, the clubs a
//   regional seat covers and the events the person directs
// - the session carries the person's assurance level, so the context sends
//   no LCA admin to set up a second factor; planted at aal1, an admin is sent
//   there, so the case can fail
// - today's header shows Profile and Log out, and its More menu the account
//   links the list gives the person; signed out, Log in and Join LCA, and
//   no call at all
// - the race the helper waits out: until the member's answers arrive, the
//   header already shows Profile but no account link
// - for every role and every holding, today's header gives exactly the role
//   rows the navigation model keeps until the volunteer rail, with its Admin
//   panel standing for the model's Admin row
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_ROLES } from '@/areas/admin/roles'
import { AuthProvider, type AuthContextValue } from '@/contexts/AuthContext'
import { AuthContext, useAuth } from '@/contexts/auth-context'
import { Navbar } from '@/components/layout/Navbar'
import { FEATURES, type Features } from '@/lib/features'
import { adminRowFor, myLcaRows, type MyLcaPerson } from '@/lib/nav'
import { FAKE_SUPABASE_URL } from '../a11y/global-setup'
import { SESSION_KEY, plantedSession } from '../a11y/signedIn'
import { TODAYS_ACCOUNT_LINKS, navPersona, navPersonas, type NavPersona } from './fixtures/navPersonas'

// The browser tests' setup file finds the repository from its own file
// address, which this test page's address cannot stand in for; its two
// values are read from the file instead.
vi.mock('../a11y/global-setup', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const root = path.resolve(__dirname, '../..')
  const text = fs.readFileSync(path.join(root, 'test/a11y/global-setup.ts'), 'utf8')
  return { ROOT: root, FAKE_SUPABASE_URL: /export const FAKE_SUPABASE_URL = '([^']+)'/.exec(text)![1] }
})

// The site's one sign-in client, made afresh for each test after the session
// is planted, as a page load makes it.
const holder = vi.hoisted(() => ({ client: null as SupabaseClient | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy({}, { get: (_target, prop) => Reflect.get(holder.client as object, prop) }),
}))

const ROOT = resolve(__dirname, '../..')
/** The anonymous key the a11y builds are given, as test/a11y/global-setup.ts passes it. */
const ANON_KEY = 'fake-anon-key-for-a11y-tests'
const ALL_OFF = Object.fromEntries(Object.keys(FEATURES).map((n) => [n, false])) as Features
const SIGN_IN_ORIGIN = new URL(FAKE_SUPABASE_URL).origin

/** The context's values the probe shows. */
interface Shown {
  user: string | null
  member: string | null
  role: string
  isBoardMember: boolean
  managedClubs: number
  directedEvents: number
  assuranceLevel: string | null
  mfaRequired: boolean
  memberLoading: boolean
}

function Probe() {
  const auth = useAuth()
  const shown: Shown = {
    user: auth.user?.id ?? null,
    member: auth.member?.id ?? null,
    role: auth.role,
    isBoardMember: auth.isBoardMember,
    managedClubs: auth.managedClubs.length,
    directedEvents: auth.directedTournamentIds.length,
    assuranceLevel: auth.assuranceLevel,
    mfaRequired: auth.mfaRequired,
    memberLoading: auth.memberLoading,
  }
  return <output data-testid="auth">{JSON.stringify(shown)}</output>
}
const shown = (): Shown => JSON.parse(screen.getByTestId('auth').textContent ?? '{}') as Shown

interface Visit {
  /** Each call to the site's API, as "GET /api/me", in order. */
  calls: string[]
  /** Each request to the fake sign-in address; every one is refused. */
  signInCalls: string[]
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Plants the person's session as the helper does, answers the site's calls
 * as the helper does (holding the member's two answers until `hold` settles,
 * when one is given), makes the sign-in client and draws the header.
 */
function visit(person: NavPersona, options: { aal?: 'aal1' | 'aal2'; hold?: Promise<void> } = {}): Visit {
  localStorage.clear()
  sessionStorage.clear()
  if (person.user) localStorage.setItem(SESSION_KEY, JSON.stringify(plantedSession(options.aal ? { ...person, aal: options.aal } : person)))
  const record: Visit = { calls: [], signInCalls: [] }
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
      if (options.hold && (url.pathname === '/api/me' || url.pathname === '/api/board/my-seats')) await options.hold
      const answers = person.answers
      if (answers && call === 'POST /api/me') return json(answers.synced, 201)
      if (answers && call === 'GET /api/me') return json(answers.me)
      if (answers && call === 'GET /api/board/my-seats') return json(answers.mySeats)
      // What the test servers answer anything else a planted token asks for.
      return json({ error: 'Unauthorized' }, 401)
    }),
  )
  holder.client = freshClient()
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
        <Probe />
      </MemoryRouter>
    </AuthProvider>,
  )
  return record
}

/**
 * A sign-in client as src/lib/supabase.ts makes one. One is made for each
 * test and the one before it is disposed first; the library still counts
 * them and warns of several at once, which says nothing here, so that one
 * warning is left out of the output.
 */
function freshClient(): SupabaseClient {
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

/** Waits until the page has made no new call for a while, so nothing from this test reaches the next. */
async function settled(record: Visit) {
  let last = -1
  let quiet = 0
  while (quiet < 3) {
    await new Promise((r) => setTimeout(r, 40))
    quiet = record.calls.length + record.signInCalls.length === last ? quiet + 1 : 0
    last = record.calls.length + record.signInCalls.length
  }
}

/** The account links in today's More menu, opened as a click opens it. */
function accountLinks(): string[] {
  const more = screen.getByRole('button', { name: 'More' })
  if (more.getAttribute('aria-expanded') !== 'true') fireEvent.click(more)
  const names = new Set<string>(TODAYS_ACCOUNT_LINKS)
  return within(screen.getByRole('menu'))
    .getAllByRole('menuitem')
    .map((item) => item.textContent ?? '')
    .filter((name) => names.has(name))
}

afterEach(async () => {
  cleanup()
  await holder.client?.auth.dispose()
  holder.client = null
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
})

describe('the planted session, read by the site\'s sign-in context and drawn by today\'s header', () => {
  const people = navPersonas()

  it.each(people.filter((p) => p.user !== null).map((p) => [p.title, p] as const))('%s', async (_title, person) => {
    const record = visit(person)
    await waitFor(() => expect(shown().member).toBe(person.user!.id))
    await waitFor(() => expect(shown().assuranceLevel).toBe(person.aal))
    await waitFor(() => expect(shown().memberLoading).toBe(false))
    await settled(record)

    const holds = person.holds!
    expect(shown()).toMatchObject({
      user: person.user!.id,
      role: holds.role,
      isBoardMember: holds.isBoardMember,
      managedClubs: holds.managedClubs,
      directedEvents: holds.directedEvents,
      mfaRequired: false,
    })
    expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Join LCA' })).toBeNull()
    expect(accountLinks()).toEqual([...person.todaysRoleLinks])

    const ANSWERED = ['POST /api/me', 'GET /api/me', 'GET /api/board/my-seats']
    for (const call of ANSWERED) expect(record.calls, call).toContain(call)
    expect(record.calls.filter((call) => !ANSWERED.includes(call))).toEqual([])
    expect(record.signInCalls).toEqual([])
  })

  it('a visitor who is signed out: Log in and Join LCA, no account link, no call, and nothing planted', async () => {
    const record = visit(navPersona('signed-out'))
    await screen.findByRole('link', { name: 'Log in' })
    await settled(record)
    expect(screen.getByRole('link', { name: 'Join LCA' }).getAttribute('href')).toBe('/membership')
    expect(screen.queryByRole('link', { name: 'Profile' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull()
    expect(accountLinks()).toEqual([])
    expect(shown()).toMatchObject({ user: null, member: null, assuranceLevel: null, mfaRequired: false })
    expect(record.calls).toEqual([])
    expect(record.signInCalls).toEqual([])
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
  })

  it('an LCA admin planted at aal1 is sent to set up a second factor, which is why the admins carry aal2', async () => {
    const record = visit(navPersona('admin'), { aal: 'aal1' })
    await waitFor(() => expect(shown().member).toBe('fx-m-admin'))
    await waitFor(() => expect(shown().assuranceLevel).toBe('aal1'))
    await settled(record)
    expect(shown().mfaRequired).toBe(true)
    expect(record.signInCalls).toEqual([])
  })

  it('shows Profile before the member\'s answers arrive, with no account link until they do', async () => {
    let release!: () => void
    const hold = new Promise<void>((r) => (release = r))
    const record = visit(navPersona('admin'), { hold })
    await screen.findByRole('link', { name: 'Profile' })
    // Signed in, but neither the member nor the seats have arrived: the role is
    // still the plain member's the session's user record gives.
    expect(shown()).toMatchObject({ user: 'fx-m-admin', member: null, role: 'member', isBoardMember: false })
    expect(accountLinks()).toEqual([])
    release()
    await waitFor(() => expect(accountLinks()).toEqual(['Admin panel', 'Board inbox']))
    await settled(record)
    expect(record.signInCalls).toEqual([])
  })
})

describe('today\'s header against the navigation model', () => {
  /** A signed-in visitor as the header reads one from the context. */
  function signedInAs(person: MyLcaPerson): AuthContextValue {
    return {
      user: { id: 'fx-m-model' } as User,
      session: null,
      member: null,
      role: person.role,
      seats: [],
      managedClubs: Array.from({ length: person.managedClubs }, (_, i) => ({ id: `fx-club-${i}`, name: `Fixture Club ${i}`, region: 'North Louisiana' })),
      isBoardMember: person.isBoardMember,
      assuranceLevel: 'aal1',
      mfaRequired: false,
      directedTournamentIds: Array.from({ length: person.directedEvents }, (_, i) => `fx-t-${i}`),
      loading: false,
      memberLoading: false,
      signOut: async () => {},
    } as unknown as AuthContextValue
  }

  const EVERYONE: MyLcaPerson[] = MEMBER_ROLES.flatMap((role) =>
    [false, true].flatMap((isBoardMember) =>
      [0, 1].flatMap((managedClubs) => [0, 1].map((directedEvents) => ({ role, isBoardMember, managedClubs, directedEvents, hasChildren: false }))),
    ),
  )

  it('gives every role and holding the model\'s role rows, with Admin panel first where the model has an Admin row', () => {
    expect(EVERYONE).toHaveLength(MEMBER_ROLES.length * 8)
    for (const person of EVERYONE) {
      render(
        <AuthContext.Provider value={signedInAs(person)}>
          <MemoryRouter initialEntries={['/']}>
            <Navbar />
          </MemoryRouter>
        </AuthContext.Provider>,
      )
      const rows = myLcaRows(person, ALL_OFF)
      const expected = [...(adminRowFor(person.role) ? ['Admin panel'] : []), ...rows.filter((r) => r.roleRow).map((r) => r.label)]
      expect(accountLinks(), JSON.stringify(person)).toEqual(expected)
      cleanup()
    }
  })

  it('reads the same file the browser tests read, with the session key it plants', () => {
    const helper = readFileSync(join(ROOT, 'test/a11y/signedIn.ts'), 'utf8')
    expect(helper).toContain('export const SESSION_KEY = sessionKeyFor(FAKE_SUPABASE_URL)')
    // src/lib/supabase.ts makes its client from the address and the key alone,
    // as this test does, so the library's own storage and key apply.
    expect(readFileSync(join(ROOT, 'src/lib/supabase.ts'), 'utf8')).toMatch(/createClient\(\s*supabaseUrl \?\? '[^']+',\s*supabaseAnonKey \?\? '[^']+',?\s*\)/)
  })
})
