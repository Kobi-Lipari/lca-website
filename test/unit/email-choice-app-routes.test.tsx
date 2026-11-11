// @vitest-environment jsdom
//
// src/App.tsx drawn whole at the two addresses a link in optional email opens
// (WS16 step 5), as test/unit/heritage-app-routes.test.tsx draws the site: the
// header, the site's main, the routes and the footer, as a visitor gets them,
// rather than routes a test writes itself. Every switch is off, as this step
// ships, but mailLists where a case turns it on, and the two pages' code is
// held back until the first case lets it come, as a slow network holds a
// page's chunk, so the main area can be read while that code is on its way.
//
// - With mailLists off and each link answering 404, as before any list email
//   has gone, the site's main holds what it holds at an unknown path, which is
//   nothing: while the page's code is on its way, since each route has a
//   Suspense of its own that draws nothing where App's would draw its loading
//   line, and after the page's one GET, with the title as it was.
// - With each link answering 200, once a list email has gone, each page draws
//   its heading in the site's main, with mailLists off and with it on: the two
//   routes are mounted whatever the switches say, so a link in mail already
//   sent keeps opening its page.
// Every token, address and list here is made up.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ mailLists: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))

/** The two pages' code, held back until a case lets it come. */
const gates = vi.hoisted(() => {
  const gate = () => {
    let open!: () => void
    const held = new Promise<void>((resolve) => {
      open = resolve
    })
    return { held, open: () => open() }
  }
  return { unsubscribe: gate(), preferences: gate() }
})
vi.mock('@/pages/EmailUnsubscribePage', async (importOriginal) => {
  await gates.unsubscribe.held
  return importOriginal<typeof import('@/pages/EmailUnsubscribePage')>()
})
vi.mock('@/pages/EmailPreferencesPage', async (importOriginal) => {
  await gates.preferences.held
  return importOriginal<typeof import('@/pages/EmailPreferencesPage')>()
})

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

const UNSUBSCRIBE_TOKEN = 'sample0contact0id0000000000000001.lca-newsletter.sampleSignature0000001'
const PREFERENCES_TOKEN = 'sample0contact0id0000000000000001.p.sampleSignature0000002'
const UNSUBSCRIBE_URL = `/api/mail/unsubscribe/${UNSUBSCRIBE_TOKEN}`
const PREFERENCES_URL = `/api/mail/preferences/${PREFERENCES_TOKEN}`
const TITLE_BEFORE = 'A title set before the page'

/** What a stand-in endpoint answers. */
interface Answer { status: number; body: unknown }
const NOT_FOUND: Answer = { status: 404, body: { error: "This link isn't working." } }
const LINK_WORKS: Answer = { status: 200, body: { list: 'LCA newsletter' } }
const CHOICES: Answer = { status: 200, body: { address: 'p...@example.org', lists: [{ id: 'lca-newsletter', name: 'LCA newsletter', on: true }], optionalOff: false } }

let calls: Array<{ url: string; method: string }> = []
let answers: Record<string, Answer> = {}
/** The answer for one method and path. */
function on(method: string, url: string, answer: Answer) {
  answers[`${method} ${url}`] = answer
}
/** The requests the two pages made, to the two endpoints a link opens. */
const mailCalls = () => calls.filter((c) => c.url.startsWith('/api/mail/'))

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  flags.mailLists = false
  calls = []
  answers = {}
  document.title = TITLE_BEFORE
  // An unknown path makes the router say so on the console; the cases read the page, not that line.
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    const answer = answers[`${method} ${url}`] ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  warn.mockRestore()
  vi.unstubAllGlobals()
})

/** A visitor who is not signed in, as a person who opens a link in an email often is. */
function visitor(): AuthContextValue {
  return {
    user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
    assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
    impersonating: null, exitImpersonation: async () => {},
  } as unknown as AuthContextValue
}

/** Lets the requests settle and React draw what they bring. */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 30)))

/** The whole site at an address, and its one main. */
async function site(path: string): Promise<HTMLElement> {
  let view: ReturnType<typeof render> | undefined
  const tree: ReactElement = (
    <AuthContext.Provider value={visitor()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  await act(async () => {
    view = render(tree)
  })
  await settle()
  const mains = view!.container.querySelectorAll('main')
  expect(mains).toHaveLength(1)
  return mains[0]
}

describe('the two pages a link in optional email opens, in the whole site', () => {
  it('draw what an unknown path draws, nothing in the site\'s main, with mailLists off while each link answers 404: no loading line while the page\'s code is on its way, and nothing after its one GET', async () => {
    const unknown = (await site('/sample/no-such-page')).innerHTML
    expect(unknown).toBe('')
    cleanup()

    for (const [path, url, gate] of [
      [`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`, UNSUBSCRIBE_URL, gates.unsubscribe],
      [`/email/preferences/${PREFERENCES_TOKEN}`, PREFERENCES_URL, gates.preferences],
    ] as const) {
      calls = []
      on('GET', url, NOT_FOUND)
      const main = await site(path)
      // The page's code is on its way: its route's own Suspense draws nothing, where App's would draw "Loading".
      expect(main.innerHTML, path).toBe(unknown)
      expect(screen.queryByText(/Loading/), path).toBeNull()
      expect(mailCalls(), path).toEqual([])
      await act(async () => {
        gate.open()
      })
      // A page's code is loaded on demand the first time it is drawn, which can take a while on a busy test run.
      await waitFor(() => expect(mailCalls(), path).toHaveLength(1), { timeout: 10_000 })
      await settle()
      expect(main.innerHTML, path).toBe(unknown)
      expect(mailCalls(), path).toEqual([{ url, method: 'GET' }])
      expect(document.title, path).toBe(TITLE_BEFORE)
      cleanup()
    }
  }, 30_000)

  it.each([
    ['off', false],
    ['on', true],
  ])('each draws its heading in the site\'s main once its link answers 200, a list email having gone, with mailLists %s', async (_, value) => {
    // Each case lets the pages' code come, so it reads the same run alone or after the first.
    gates.unsubscribe.open()
    gates.preferences.open()
    flags.mailLists = value
    on('GET', UNSUBSCRIBE_URL, LINK_WORKS)
    on('GET', PREFERENCES_URL, CHOICES)

    const unsubscribe = await site(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    const stop = await screen.findByRole('heading', { level: 1, name: 'Stop the LCA newsletter?' }, { timeout: 10_000 })
    expect(unsubscribe.contains(stop)).toBe(true)
    cleanup()

    const preferences = await site(`/email/preferences/${PREFERENCES_TOKEN}`)
    const choices = await screen.findByRole('heading', { level: 1, name: 'Your email choices' }, { timeout: 10_000 })
    expect(preferences.contains(choices)).toBe(true)
    expect(mailCalls().map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${UNSUBSCRIBE_URL}`, `GET ${PREFERENCES_URL}`])
  }, 30_000)
})
