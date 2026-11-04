// test/unit/signed-in-session.test.ts
//
// The session test/a11y/signedIn.ts plants for a signed-in visitor, read by
// the installed sign-in library itself, in node, without a browser:
//
// - the key it is planted under is the key the library builds for the test
//   builds' fake sign-in address, and for any other address the helper is
//   asked about
// - the library reads the planted session as it stands, with no request to
//   the sign-in service, and reads from it the assurance level the person
//   carries: aal2, with a verified second factor, for the two LCA admins, so
//   the site's rule for a code at sign-in (needsChallenge in src/lib/mfa.ts)
//   asks none of them for one, and aal1 for everyone else
// - the token's claims and the user record name the person, end a day after
//   the session is made, and leave the member's role to GET /api/me
// - stale data: a session that ends within the library's margin for a
//   refresh does reach the sign-in service, which is why the helper plants
//   one that ends a day ahead, and why a test can show that none was made
// - the visitor who is signed out has no session to plant
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { FAKE_SUPABASE_URL } from '../a11y/global-setup'
import { PLANTED_MARK, SESSION_KEY, SIGN_IN_LIBRARY, plantedSession, sessionKeyFor } from '../a11y/signedIn'
import { navPersona, navPersonas, type NavPersona } from './fixtures/navPersonas'

/** The anonymous key the a11y builds are given, as test/a11y/global-setup.ts passes it. */
const ANON_KEY = 'fake-anon-key-for-a11y-tests'

const PEOPLE = navPersonas()
const SIGNED_IN = PEOPLE.filter((p) => p.user !== null)

/** A sign-in client as src/lib/supabase.ts makes one, with its storage in memory and every request recorded. */
function libraryClient(stored: Record<string, string>, answer: (url: string) => Response = () => {
  throw new TypeError('the fake sign-in address refuses every connection')
}) {
  const calls: string[] = []
  const store = new Map(Object.entries(stored))
  const client = createClient(FAKE_SUPABASE_URL, ANON_KEY, {
    auth: {
      storage: {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, value),
        removeItem: (key) => void store.delete(key),
      },
    },
    global: {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input)
        calls.push(`${init?.method ?? 'GET'} ${url}`)
        return answer(url)
      }) as typeof fetch,
    },
  })
  return { client, calls, store }
}

/** The claims inside a token, read the way the library reads them. */
function claimsOf(token: string): Record<string, unknown> {
  const parts = token.split('.')
  expect(parts).toHaveLength(3)
  for (const part of parts) expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
  return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<string, unknown>
}

describe('the key the session is planted under', () => {
  it('is the key the installed library builds for the test builds\' fake sign-in address', () => {
    const client = createClient(FAKE_SUPABASE_URL, ANON_KEY) as unknown as { storageKey: string; auth: { storageKey: string } }
    expect(SESSION_KEY).toBe('sb-127-auth-token')
    expect(client.storageKey).toBe(SESSION_KEY)
    expect(client.auth.storageKey).toBe(SESSION_KEY)
  })

  it.each(['https://abcdefghijklmnop.supabase.co', 'http://localhost:54321', 'https://auth.example.org/', 'http://127.0.0.1:9/'])(
    'is the library\'s key for %s too',
    (address) => {
      const client = createClient(address, ANON_KEY) as unknown as { storageKey: string }
      expect(sessionKeyFor(address)).toBe(client.storageKey)
    },
  )

  it('names the installed library and its version for the message a session it cannot read fails with', () => {
    expect(SIGN_IN_LIBRARY).toMatch(/^@supabase\/supabase-js \d+\.\d+\.\d+$/)
    expect(PLANTED_MARK).not.toBe(SESSION_KEY)
  })
})

describe('the planted session, read by the library', () => {
  it.each(SIGNED_IN.map((p) => [p.key, p] as const))('%s: read as planted, with no request to the sign-in service', async (_key, person) => {
    const planted = plantedSession(person)
    const { client, calls } = libraryClient({ [SESSION_KEY]: JSON.stringify(planted) })
    const { data, error } = await client.auth.getSession()
    expect(error).toBeNull()
    expect(data.session?.access_token).toBe(planted.access_token)
    expect(data.session?.refresh_token).toBe(planted.refresh_token)
    expect(data.session?.user.id).toBe(person.user!.id)
    expect(data.session?.user.email).toBe(person.user!.email)
    expect(calls).toEqual([])
  })

  it.each(SIGNED_IN.map((p) => [p.key, p] as const))('%s: carries its assurance level, and is asked for no code', async (_key, person) => {
    const { client, calls } = libraryClient({ [SESSION_KEY]: JSON.stringify(plantedSession(person)) })
    const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
    expect(error).toBeNull()
    expect(data?.currentLevel).toBe(person.aal)
    // The admins have a verified second factor, so aal2 is also the level they can reach.
    expect(data?.nextLevel).toBe(person.aal)
    // src/lib/mfa.ts asks for a code when the next level is aal2 and the session is at aal1.
    expect(data?.nextLevel === 'aal2' && data?.currentLevel === 'aal1').toBe(false)
    expect(calls).toEqual([])
  })

  it('carries aal2 for the LCA admins and aal1 for everyone else', () => {
    for (const person of SIGNED_IN) {
      const role = person.answers!.me.member.role
      expect(person.aal, person.key).toBe(role === 'lca_admin' ? 'aal2' : 'aal1')
    }
    expect(SIGNED_IN.filter((p) => p.aal === 'aal2').map((p) => p.key)).toEqual(['admin', 'everything'])
  })
})

describe('the token and the user record', () => {
  const NOW = Date.UTC(2026, 9, 23, 19, 0, 0)

  it.each(SIGNED_IN.map((p) => [p.key, p] as const))('%s: names the person and ends a day after it is made', (_key, person) => {
    const planted = plantedSession(person, NOW)
    const claims = claimsOf(planted.access_token)
    expect(claims.sub).toBe(person.user!.id)
    expect(claims.email).toBe(person.user!.email)
    expect(claims.aal).toBe(person.aal)
    expect(claims.role).toBe('authenticated')
    expect(claims.iat).toBe(NOW / 1000)
    expect(claims.exp).toBe(planted.expires_at)
    expect(planted.expires_at - NOW / 1000).toBe(24 * 60 * 60)
    expect(planted.expires_in).toBe(24 * 60 * 60)
    // A second factor shows in the token's methods and the user's factors only for aal2.
    const methods = (claims.amr as Array<{ method: string }>).map((m) => m.method)
    const factors = planted.user.factors.filter((f) => f.status === 'verified' && f.factor_type === 'totp')
    expect(methods.includes('totp'), person.key).toBe(person.aal === 'aal2')
    expect(factors.length > 0, person.key).toBe(person.aal === 'aal2')
    // The member's role comes from GET /api/me, never from the token or the user record.
    expect((claims.user_metadata as { role: string }).role).toBe('member')
    expect(planted.user.user_metadata.role).toBe('member')
    expect(planted.user.id).toBe(person.user!.id)
    expect(planted.user.user_metadata.full_name).toBe(person.user!.fullName)
    // Made by nobody: the last part of the token is no signature.
    expect(Buffer.from(planted.access_token.split('.')[2], 'base64url').toString('utf8')).toBe('a test session, signed by nobody')
  })

  it('ends far past the library\'s margin for a refresh, which is 90 seconds', () => {
    const planted = plantedSession(navPersona('admin'), NOW)
    expect(planted.expires_at * 1000 - NOW).toBeGreaterThan(90_000 * 100)
  })

  it('cannot be planted for the visitor who is signed out', () => {
    expect(() => plantedSession(navPersona('signed-out'))).toThrow(/signed-out is signed out/)
  })
})

describe('stale data: a session at the end of its life', () => {
  /** The service's answer to a refresh it will not do. */
  const refused = () =>
    new Response(JSON.stringify({ code: 'refresh_token_not_found', error: 'invalid_grant', error_description: 'Invalid Refresh Token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })

  it('makes the library ask the sign-in service for a new one, which the planted session never does', async () => {
    const person: NavPersona = navPersona('active-member')
    // Made a day ago less one minute, so it ends in a minute, inside the library's margin.
    const stale = plantedSession(person, Date.now() - 24 * 60 * 60 * 1000 + 60_000)
    const old = libraryClient({ [SESSION_KEY]: JSON.stringify(stale) }, refused)
    await old.client.auth.getSession()
    expect(old.calls.length).toBeGreaterThan(0)
    for (const call of old.calls) expect(call).toBe(`POST ${FAKE_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`)

    const fresh = libraryClient({ [SESSION_KEY]: JSON.stringify(plantedSession(person)) }, refused)
    await fresh.client.auth.getSession()
    await fresh.client.auth.mfa.getAuthenticatorAssuranceLevel()
    expect(fresh.calls).toEqual([])
  })

  it('is not read at all when it lacks a part the library needs', async () => {
    const planted = plantedSession(navPersona('admin'))
    for (const part of ['access_token', 'refresh_token', 'expires_at']) {
      const rest = Object.fromEntries(Object.entries(planted).filter(([key]) => key !== part))
      const { client, store } = libraryClient({ [SESSION_KEY]: JSON.stringify(rest) })
      const { data } = await client.auth.getSession()
      expect(data.session, part).toBeNull()
      // The library throws away what it cannot read.
      expect(store.has(SESSION_KEY), part).toBe(false)
    }
  })
})
