// test/a11y/signedIn.ts
//
// A signed-in visitor for the browser tests. The test servers' sign-in
// address is a closed port (FAKE_SUPABASE_URL in test/a11y/global-setup.ts,
// SUPABASE_URL in .dev.vars.a11y), so nobody can sign in there, and no check
// on the server is loosened for a test. Instead, before the page loads, this
// plants a session in the page's own storage, under the key the installed
// sign-in library reads for that address, and answers in the browser the
// calls the site makes for a signed-in person:
//
// - POST /api/me, which the site sends first so that the member's row exists
// - GET /api/me and GET /api/board/my-seats: the member, their entries, the
//   events they direct, their children, their seats and the clubs a regional
//   seat covers
// - GET /api/me/event-mode and GET /api/live/now, answered 204 with no body
//   unless the person in test/unit/fixtures/navPersonas.ts gives a body; no
//   page calls either yet, and the second, which is public, is answered for
//   the visitor who is signed out as well
//
// Every other request goes on to the local server as before, carrying the
// planted token, which the server cannot check: it answers a public call as
// for a visitor who is signed out and refuses a call that needs a sign-in.
// A request to the fake sign-in address is recorded and refused, so a
// test can show that none was made: the library reads a session that ends a
// day later without asking the sign-in service anything. The session is
// planted only on the build's own address, only when the page holds none,
// and only once in a tab, so a test that logs out stays signed out on the
// pages it opens after.
//
// The token is shaped like a real one, three parts in base64url, because the
// library reads the session's assurance level from the token itself; it
// carries aal2 for the LCA admins, so the site does not send them to set up
// a second factor. It is not signed, and every server refuses it, as the role
// safety tests of test/a11y/seeded-data.spec.ts show.
//
// Usage:
//   const visit = await signInAs(page, navPersona('admin'), baseURL!)
//   await page.goto('/')
//   await waitForMemberAnswers(visit)
//   await page.goto('/clubs')
//   await waitForMemberAnswers(visit) // this page's own answers, not the first page's
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page, Request, Route } from '@playwright/test'
import { FAKE_SUPABASE_URL, ROOT } from './global-setup'
import { expect } from './support'
import type { NavPersona } from '../unit/fixtures/navPersonas'

/**
 * The key the sign-in library keeps its session under for an address: "sb-",
 * the first part of the address's host name, and "-auth-token", as the
 * installed library builds it.
 */
export function sessionKeyFor(address: string): string {
  return `sb-${new URL(address).hostname.split('.')[0]}-auth-token`
}

/** The key for the test builds' fake sign-in address. */
export const SESSION_KEY = sessionKeyFor(FAKE_SUPABASE_URL)

/** The installed sign-in library and its version, for the message a session it cannot read fails with. */
export const SIGN_IN_LIBRARY = `@supabase/supabase-js ${(JSON.parse(readFileSync(join(ROOT, 'node_modules/@supabase/supabase-js/package.json'), 'utf8')) as { version: string }).version}`

/** The mark in the tab's session storage that says the session was planted there once. */
export const PLANTED_MARK = 'lca-test-session-planted'

/** How far ahead the planted session ends: a day, far past the library's margin for a refresh. */
const SESSION_LENGTH_S = 24 * 60 * 60

/** One part of a token, in base64url. */
const part = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')

/** The session the library would have stored after this person signed in, ending a day after `now`. */
export function plantedSession(person: NavPersona, now = Date.now()) {
  if (!person.user || !person.aal) throw new Error(`${person.key} is signed out, so there is no session to plant`)
  const issued = Math.floor(now / 1000)
  const expires = issued + SESSION_LENGTH_S
  const at = new Date(issued * 1000).toISOString()
  const appMetadata = { provider: 'email', providers: ['email'] }
  // As a sign-up writes it; the member's role comes from GET /api/me.
  const userMetadata = { full_name: person.user.fullName, role: 'member' }
  const secondFactor = person.aal === 'aal2'
  const user = {
    id: person.user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: person.user.email,
    email_confirmed_at: at,
    phone: '',
    confirmed_at: at,
    last_sign_in_at: at,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    identities: [],
    factors: secondFactor
      ? [{ id: `fx-factor-${person.key}`, friendly_name: 'Fixture phone', factor_type: 'totp', status: 'verified', created_at: at, updated_at: at }]
      : [],
    created_at: at,
    updated_at: at,
    is_anonymous: false,
  }
  const claims = {
    aud: 'authenticated',
    exp: expires,
    iat: issued,
    iss: `${FAKE_SUPABASE_URL}/auth/v1`,
    sub: person.user.id,
    email: person.user.email,
    phone: '',
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    role: 'authenticated',
    aal: person.aal,
    amr: secondFactor ? [{ method: 'totp', timestamp: issued }, { method: 'password', timestamp: issued }] : [{ method: 'password', timestamp: issued }],
    session_id: `fx-session-${person.key}`,
    is_anonymous: false,
  }
  return {
    access_token: `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.${part('a test session, signed by nobody')}`,
    token_type: 'bearer',
    expires_in: SESSION_LENGTH_S,
    expires_at: expires,
    refresh_token: `fx-refresh-${person.key}`,
    user,
  }
}

/** What one test's page was given and asked for. */
export interface SignedInVisit {
  readonly person: NavPersona
  /** False for the person who is signed out: nothing was planted. */
  readonly planted: boolean
  /** Each call the helper answered, as "GET /api/me", in order, over every page the test opened. */
  readonly answered: string[]
  /**
   * The calls the helper answered for the page open now, as in `answered`. It
   * starts again, empty, each time a new page loads in the tab (page.goto,
   * page.reload, or a link or form that loads a page), and keeps its calls
   * when the site changes its address without loading a page, since the site
   * asks for nothing again then.
   */
  readonly answeredOnThisPage: string[]
  /** Each request the page made to the fake sign-in address, as "POST http://...". Every one was refused in the browser. */
  readonly signInCalls: string[]
  /** Each call to the site's API that was refused (401 or 403) or failed (500 or more), as "401 GET /api/...". */
  readonly apiErrors: string[]
  /** What a test says when the planted session was not read. */
  readonly notRead: string
}

/** The calls the helper answers, each with its status and body; a null body answers 204 with none. */
function answersFor(person: NavPersona): Map<string, [number, unknown]> {
  const answers = new Map<string, [number, unknown]>([['GET /api/live/now', [200, person.answers?.liveNow ?? null]]])
  if (person.answers) {
    answers.set('POST /api/me', [201, person.answers.synced])
    answers.set('GET /api/me', [200, person.answers.me])
    answers.set('GET /api/board/my-seats', [200, person.answers.mySeats])
    answers.set('GET /api/me/event-mode', [200, person.answers.eventMode])
  }
  return answers
}

/**
 * Plants the person's session before the page loads (nothing for the person
 * who is signed out), answers the person's calls in the browser and records
 * and refuses every request to the fake sign-in address. Call it before the
 * test's first page.goto. `baseURL` is the test build's own address.
 */
export async function signInAs(page: Page, person: NavPersona, baseURL: string): Promise<SignedInVisit> {
  const origin = new URL(baseURL).origin
  const signIn = new URL(FAKE_SUPABASE_URL).origin
  const visit: SignedInVisit = {
    person,
    planted: person.user !== null,
    answered: [],
    answeredOnThisPage: [],
    signInCalls: [],
    apiErrors: [],
    notRead: `the session planted under ${SESSION_KEY} was not read: check how ${SIGN_IN_LIBRARY} keeps a session in the browser`,
  }

  // A new page in the tab is a request for a document in the main frame,
  // then that document taking the frame's place; from then on, the answers
  // of the page before no longer count. A change of address the site makes
  // itself sends no such request, so the page keeps its answers. A frame
  // inside the page is not the main frame, and the frame of a request for a
  // frame not made yet cannot be read, so neither counts.
  let loading = false
  const loadsAPage = (request: Request) => {
    try {
      return request.isNavigationRequest() && request.frame() === page.mainFrame()
    } catch {
      return false
    }
  }
  page.on('request', (request) => {
    if (loadsAPage(request)) loading = true
  })
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame() || !loading) return
    loading = false
    visit.answeredOnThisPage.length = 0
  })

  if (person.user) {
    await page.addInitScript(
      ({ own, key, mark, value }) => {
        if (location.origin !== own) return
        try {
          if (sessionStorage.getItem(mark) !== null || localStorage.getItem(key) !== null) return
          localStorage.setItem(key, value)
          sessionStorage.setItem(mark, 'yes')
        } catch {
          // A page whose storage cannot be written stays signed out, which the test's first check names.
        }
      },
      { own: origin, key: SESSION_KEY, mark: PLANTED_MARK, value: JSON.stringify(plantedSession(person)) },
    )
  }

  // Playwright tries the routes added last first, so these come before the
  // catch-all of test/a11y/support.ts, which counts this address as local
  // because it reads the host name only.
  await page.route(
    (url) => url.origin === signIn,
    (route) => {
      visit.signInCalls.push(`${route.request().method()} ${route.request().url()}`)
      return route.abort('blockedbyclient')
    },
  )

  const answers = answersFor(person)
  const paths = new Set([...answers.keys()].map((call) => call.slice(call.indexOf(' ') + 1)))
  await page.route(
    (url) => url.origin === origin && paths.has(url.pathname),
    (route: Route) => {
      const request = route.request()
      const call = `${request.method()} ${new URL(request.url()).pathname}`
      const answer = answers.get(call)
      // A call the helper does not answer, such as a PATCH of /api/me, goes on to the server.
      if (!answer) return route.fallback()
      visit.answered.push(call)
      visit.answeredOnThisPage.push(call)
      const [status, body] = answer
      if (body === null) return route.fulfill({ status: 204 })
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    },
  )

  page.on('response', (response) => {
    const url = new URL(response.url())
    const status = response.status()
    if (url.origin === origin && url.pathname.startsWith('/api/') && (status === 401 || status === 403 || status >= 500)) {
      visit.apiErrors.push(`${status} ${response.request().method()} ${url.pathname}`)
    }
  })
  return visit
}

/**
 * Waits until the page open now has had its answers to GET /api/me and GET
 * /api/board/my-seats, which the account links need. The header shows Profile
 * as soon as the planted session is read, before those answers arrive, so a
 * test that reads the links waits for this rather than for Profile.
 *
 * One call covers one page. Each new page asks for the member again, and
 * until its answers arrive it shows no account link, whatever the page
 * before it showed; so after page.goto, page.reload or a link that loads a
 * new page, a test calls this again, and it waits for that page's own
 * answers, never counting the answers of the page before. A change of
 * address the site makes without loading a page keeps the answers it had.
 */
export async function waitForMemberAnswers(visit: SignedInVisit, timeout = 15_000): Promise<void> {
  const needed = ['GET /api/me', 'GET /api/board/my-seats']
  await expect
    .poll(() => needed.filter((call) => !visit.answeredOnThisPage.includes(call)), {
      message: `GET /api/me and GET /api/board/my-seats were not both answered within ${timeout / 1000} s, for the page open now`,
      timeout,
    })
    .toEqual([])
}

/** The session the page holds under the library's key, parsed, or null when it holds none. */
export async function sessionInPage(page: Page): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  const stored = await page.evaluate((key) => localStorage.getItem(key), SESSION_KEY)
  return stored === null ? null : (JSON.parse(stored) as { access_token: string; refresh_token: string; expires_at: number })
}
