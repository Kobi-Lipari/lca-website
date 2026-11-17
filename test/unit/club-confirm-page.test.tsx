// @vitest-environment jsdom
//
// The two things of WS09 step 14 a person draws, through the site's own
// routes in src/App.tsx:
// - the page a Still accurate link in the monthly check opens,
//   /clubs/confirm/:token: with clubKeepers off the address draws what it
//   draws today and no call is made; with it on, the club's name and town,
//   how it meets in the listing's own words (or the email's sentence for
//   none) and one Still accurate button, then "Thanks. {Club} is marked as
//   checked for {month}." with the month in words, and each other state in
//   words: reading, expired, not readable, seat ended, club or account
//   gone, no key, each with its one link onward told by status, and a
//   failed request with Try again. Its calls go
//   through src/areas/clubs/api.ts with no sign-in and no referrer, and it
//   draws at once under the real sign-in context, for a visitor and for a
//   signed-in person whose profile is still loading;
// - "Send this month's check now" in My region, for an LCA admin alone: one
//   question that names how many people it goes to, then how many were
//   sent and how many were not, and a refusal in the server's words.
//
// The real pages run through the real client with fetch stubbed; the
// site's header, footer and banners are stood in for. Every club, person
// and token here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import type { WorkspaceRegionResponse } from '@domain/contracts'

// Each case may wait up to 5 seconds for a page's file to load, so each case has 15 seconds.
vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: false }))
const loaded = vi.hoisted(() => ({ page: false }))
/** What the stand-in sign-in client answers: no session, or one whose profile load never ends. */
const signIn = vi.hoisted(() => ({ session: null as null | { access_token: string; user: { id: string; email: string } } }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/pages/ClubConfirmPage', async (importOriginal) => {
  loaded.page = true
  return importOriginal()
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: signIn.session } }),
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        if (signIn.session) setTimeout(() => listener('SIGNED_IN', signIn.session), 0)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))

const { default: App } = await import('@/App')
const { AuthProvider } = await import('@/contexts/AuthContext')
const { useAuth } = await import('@/contexts/auth-context')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const TOKEN = 'v1.s.example-made-up-payload.example-made-up-mac'
const LINK = `/api/clubs/confirm/${TOKEN}`
const STATEMENT = 'Saturdays from 10:00 AM to 1:00 PM at the Example Library.'
const CLUB = { name: 'Example Chess Club', city: 'Example City', statement: STATEMENT }
/** The email's own sentence for a club whose listing does not say how it meets. */
const NONE = 'How the club meets is not listed yet.'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string; init?: RequestInit }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(REGION_HELP_SHOWN_KEY, 'shown')
  signIn.session = null
  asked = []
  answers = {
    [`GET ${LINK}`]: () => json(CLUB),
    [`POST ${LINK}`]: () => json({ ...CLUB, month: 'November 2026' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined, init })
    const answer = answers[call]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** A visitor, or a signed-in person, as the fixed context the site's routes read. */
function contextFor(role: string | null): AuthContextValue {
  return {
    user: role ? { id: 'm-example' } : null, session: null, role: role ?? 'member',
    member: role ? { id: 'm-example', role, club_id: null, full_name: 'Player One', email: 'player.one@example.org' } : null,
    loading: false, memberLoading: false, seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

function open(path = `/clubs/confirm/${TOKEN}`, role: string | null = null) {
  render(
    <AuthContext.Provider value={contextFor(role)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const ready = () => screen.findByRole('button', { name: 'Still accurate' }, { timeout: 5000 })
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')
const linkCalls = () => asked.filter((a) => a.call.includes('/api/clubs/confirm/'))

describe('the confirm page with clubKeepers off, as the step ships', () => {
  it('draws what the address draws today: no page file, no call and nothing in the main area', async () => {
    flags.clubKeepers = false
    open()
    await act(async () => {})
    expect(document.querySelector('main')?.textContent).toBe('')
    expect(linkCalls()).toEqual([])
    expect(loaded.page).toBe(false)
  })

  it('keeps the route behind the switch in App.tsx, before /clubs/:id, with the page lazy', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('const ClubConfirmPage = lazy(() => import(\'@/pages/ClubConfirmPage\').then(m => ({ default: m.ClubConfirmPage })))')
    const route = app.indexOf('{FEATURES.clubKeepers && <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />}')
    expect(route).toBeGreaterThan(-1)
    expect(route).toBeLessThan(app.indexOf('<Route path="/clubs/:id" element={<ClubDetailPage />} />'))
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
  })
})

describe('the confirm page with clubKeepers on', () => {
  beforeEach(() => { flags.clubKeepers = true })

  it('reads the link, then draws the club\'s name, town and meeting words and one Still accurate button, with no sentence beside it', async () => {
    open()
    expect(await screen.findByText('Reading the link…', undefined, { timeout: 5000 })).toBeTruthy()
    await ready()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Example Chess Club')
    expect(screen.getByText('Example City')).toBeTruthy()
    const main = document.querySelector('main')!
    expect(main.querySelectorAll('button')).toHaveLength(1)
    expect(main.querySelectorAll('a')).toHaveLength(0)
    // Changed at checkpoint V: the meeting words come between the town and the button.
    expect(main.textContent).toBe(`Example Chess ClubExample City${STATEMENT}Still accurate`)
    // The one control in the focus order.
    expect([...main.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')].map((el) => el.textContent)).toEqual(['Still accurate'])
    expect(linkCalls().map((c) => c.call)).toEqual([`GET ${LINK}`])
  })

  it('Still accurate sends one POST and says Thanks with the month in words, and the focus moves to the words', async () => {
    open()
    await ready()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await waitFor(() => expect(statusText()).toContain('Thanks. Example Chess Club is marked as checked for November 2026.'))
    expect(screen.queryByRole('button', { name: 'Still accurate' })).toBeNull()
    expect(document.activeElement?.textContent).toBe('Thanks. Example Chess Club is marked as checked for November 2026.')
    expect(linkCalls().map((c) => c.call)).toEqual([`GET ${LINK}`, `POST ${LINK}`])
    expect(linkCalls()[1].body).toBe('{}')
  })

  // Changed at checkpoint V: every refusal now ends on one link onward, told by its status, where only an expired
  // link offered Log in before.
  it('says each refusal in the server\'s words, and offers one link onward, told by its status', async () => {
    const refusals: Array<[number, string, string, string]> = [
      [410, 'This link has expired. Log in to mark the club from My region.', 'Log in to My region', '/login'],
      [400, 'This link can\'t be read. Check that the whole link was copied from the email.', 'Log in to My region', '/login'],
      [403, 'Your seat no longer covers this club.', 'Go to the home page', '/'],
      [404, 'This club is no longer listed on the site.', 'Go to the home page', '/'],
      [404, 'The account this link was sent to is no longer on the site.', 'Go to the home page', '/'],
      [503, 'Links from the monthly check can\'t be read on the site right now. Try again later.', 'Log in to My region', '/login'],
    ]
    for (const [status, words, label, href] of refusals) {
      answers[`GET ${LINK}`] = () => json({ error: words }, status)
      open()
      await screen.findByText(words, undefined, { timeout: 5000 })
      expect(screen.getByRole('heading', { level: 1 }).textContent, words).toBe('Monthly check')
      expect(screen.queryByRole('button', { name: 'Still accurate' }), words).toBeNull()
      const main = document.querySelector('main')!
      const links = [...main.querySelectorAll('a')]
      expect(links.map((a) => [a.textContent, a.getAttribute('href')]), words).toEqual([[label, href]])
      expect(screen.queryByRole('link', { name: 'Log in' }), words).toBeNull()
      cleanup()
    }
  })

  it('a refusal at the press, a seat ended since the email, is said in its words', async () => {
    answers[`POST ${LINK}`] = () => json({ error: 'Your seat no longer covers this club.' }, 403)
    open()
    await ready()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await screen.findByText('Your seat no longer covers this club.')
    expect(screen.queryByRole('button', { name: 'Still accurate' })).toBeNull()
  })

  it('a load that fails says so with Try again, which reads the link again', async () => {
    answers[`GET ${LINK}`] = () => Promise.reject(new TypeError('Failed to fetch'))
    open()
    await screen.findByText('The link could not be checked. Check your connection, then try again.', undefined, { timeout: 5000 })
    answers[`GET ${LINK}`] = () => json(CLUB)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await ready()
    expect(linkCalls().map((c) => c.call)).toEqual([`GET ${LINK}`, `GET ${LINK}`])
  })

  it('a press that fails says so with Try again, which sends it again, and nothing changed meanwhile', async () => {
    answers[`POST ${LINK}`] = () => json({ error: 'Something went wrong' }, 500)
    open()
    await ready()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await screen.findByText('Not marked: the request did not go through. Nothing changed.')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Example Chess Club')
    answers[`POST ${LINK}`] = () => json({ ...CLUB, month: 'November 2026' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await waitFor(() => expect(statusText()).toContain('Thanks. Example Chess Club is marked as checked for November 2026.'))
    expect(linkCalls().filter((c) => c.call.startsWith('POST '))).toHaveLength(2)
  })

  it('sends no sign-in and no referrer, keeps the token out of the title, and asks for no index and no referrer while drawn', async () => {
    open(`/clubs/confirm/${TOKEN}`, 'lca_admin')
    await ready()
    expect(document.title).toBe('Still accurate | Louisiana Chess Association')
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    for (const call of linkCalls()) {
      expect(new Headers(call.init?.headers).has('Authorization'), call.call).toBe(false)
      expect(call.init?.referrerPolicy, call.call).toBe('no-referrer')
    }
    cleanup()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('calls through src/areas/clubs/api.ts only, and links nowhere outside the site', () => {
    const page = read('src/pages/ClubConfirmPage.tsx')
    expect(page).not.toMatch(/\bfetch\(/)
    expect(page).not.toMatch(/https?:\/\//)
    // Changed at checkpoint V: the email's sentence for a club with no meeting words is read from its one home.
    expect(page).not.toMatch(/from '@domain\/(?!contracts'|clubs\/monthlyCheck')/)
    expect(page).not.toMatch(/useAuth|AuthContext/)
    const api = read('src/areas/clubs/api.ts')
    for (const name of ['getClubLink', 'confirmClubByLink', 'countMonthlyCheck', 'sendMonthlyCheck']) expect(api).toContain(`export async function ${name}(`)
  })
})

describe('the confirm page after checkpoint U\'s pictures (WS09 checkpoint V)', () => {
  beforeEach(() => { flags.clubKeepers = true })

  /** The page's own parts in the order they are drawn, each as its words. */
  const drawn = () => [...document.querySelector('main > div')!.children].map((el) => el.textContent)

  it('draws the meeting words under the town and before the button, in reading order: heading, town, words, button, status', async () => {
    open()
    await ready()
    expect(drawn()).toEqual(['Example Chess Club', 'Example City', STATEMENT, 'Still accurate', ''])
    const main = document.querySelector('main')!
    expect([...main.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')].map((el) => el.textContent)).toEqual(['Still accurate'])
    // The words are drawn as they are, with no label and no sentence beside them.
    expect(screen.getByText(STATEMENT).tagName).toBe('P')
    expect(main.textContent).not.toMatch(/How the club meets:|Meets:/)
  })

  it('draws the email\'s own sentence when the listing has no meeting words', async () => {
    answers[`GET ${LINK}`] = () => json({ ...CLUB, statement: null })
    open()
    await ready()
    expect(drawn()).toEqual(['Example Chess Club', 'Example City', NONE, 'Still accurate', ''])
  })

  it('the sentence has one home, read by the page and by the email alike', () => {
    expect(read('src/pages/ClubConfirmPage.tsx')).toContain('import { NO_STATEMENT } from \'@domain/clubs/monthlyCheck\'')
    expect(read('functions/utils/clubs/emails.ts')).toContain('import { NO_STATEMENT } from \'../../../domain/clubs/monthlyCheck\'')
    expect(read('domain/clubs/monthlyCheck.ts')).toContain(`export const NO_STATEMENT = '${NONE}'`)
    for (const file of ['src/pages/ClubConfirmPage.tsx', 'functions/utils/clubs/emails.ts']) expect(read(file), file).not.toContain(NONE)
  })

  it('a long statement wraps rather than pushing the button sideways', async () => {
    answers[`GET ${LINK}`] = () => json({ ...CLUB, statement: `Saturdays at the Example Library ${'Examplewordwithnobreak'.repeat(12)}` })
    open()
    await ready()
    const words = document.querySelector('main > div')!.children[2]
    expect(words.className).toContain('break-words')
    expect(words.className).toContain('min-w-0')
  })

  it('a press that did not go through keeps the name, the town and the words on the page', async () => {
    answers[`POST ${LINK}`] = () => json({ error: 'Something went wrong' }, 500)
    open()
    await ready()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await screen.findByText('Not marked: the request did not go through. Nothing changed.')
    expect(drawn()).toEqual(['Example Chess Club', 'Example City', STATEMENT, 'Not marked: the request did not go through. Nothing changed.', 'Try again'])
    expect(document.querySelector('main')!.querySelectorAll('a')).toHaveLength(0)
  })

  it('the done state and the ready state carry no link', async () => {
    open()
    await ready()
    expect(document.querySelector('main')!.querySelectorAll('a')).toHaveLength(0)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await waitFor(() => expect(statusText()).toContain('Thanks. Example Chess Club is marked as checked for November 2026.'))
    expect(document.querySelector('main')!.querySelectorAll('a')).toHaveLength(0)
  })

  it('a refusal at the press is told by its status too: an expired link at the press offers Log in to My region', async () => {
    answers[`POST ${LINK}`] = () => json({ error: 'This link has expired. Log in to mark the club from My region.' }, 410)
    open()
    await ready()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
    await screen.findByText('This link has expired. Log in to mark the club from My region.')
    expect(screen.getByRole('link', { name: 'Log in to My region' }).getAttribute('href')).toBe('/login')
  })

  it('tells the states apart by status, never by the server\'s words', async () => {
    answers[`GET ${LINK}`] = () => json({ error: 'Some other words of the example server.' }, 410)
    open()
    await screen.findByText('Some other words of the example server.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Log in to My region' })).toBeTruthy()
    cleanup()
    answers[`GET ${LINK}`] = () => json({ error: 'This link has expired. Log in to mark the club from My region.' }, 404)
    open()
    await screen.findByText('This link has expired. Log in to mark the club from My region.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Go to the home page' }).getAttribute('href')).toBe('/')
  })

  it('each link onward is drawn with the page\'s own link look, and no link\'s address holds the token', async () => {
    for (const status of [410, 403]) {
      answers[`GET ${LINK}`] = () => json({ error: 'Example refusal.' }, status)
      open()
      await screen.findByText('Example refusal.', undefined, { timeout: 5000 })
      const link = document.querySelector('main a')!
      for (const piece of ['min-h-11', 'focus-visible:ring-3', 'focus-visible:ring-focus', 'underline']) expect(link.className, piece).toContain(piece)
      expect(link.getAttribute('href')).not.toContain(TOKEN)
      expect(link.getAttribute('href')).not.toMatch(/example-made-up/)
      expect(document.title).not.toContain(TOKEN)
      cleanup()
    }
  })

  it('Log in to My region sends a signed-in person on to My region once the login page sees them, with no token carried', async () => {
    answers[`GET ${LINK}`] = () => json({ error: 'This link has expired. Log in to mark the club from My region.' }, 410)
    answers['GET /api/workspace/region'] = () => json({ clubs: [], thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 0 }, regions: [] })
    open(`/clubs/confirm/${TOKEN}`, 'lca_admin')
    const link = await screen.findByRole('link', { name: 'Log in to My region' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(link) })
    await screen.findByRole('button', { name: 'Send this month\'s check now' }, { timeout: 5000 })
    expect(asked.filter((a) => a.call === 'GET /api/workspace/region').length).toBeGreaterThan(0)
    for (const call of asked) if (!call.call.includes('/api/clubs/confirm/')) expect(call.call, call.call).not.toContain(TOKEN)
  })
})

describe('the confirm page under the real sign-in context', () => {
  beforeEach(() => { flags.clubKeepers = true })

  /** Writes down what the context reads in each draw, beside the page. */
  function Probe({ seen }: { seen: Array<{ loading: boolean; memberLoading: boolean }> }) {
    const { loading, memberLoading } = useAuth()
    seen.push({ loading, memberLoading })
    return null
  }

  async function openReal(seen: Array<{ loading: boolean; memberLoading: boolean }>) {
    // Imported here, after the case with the switch off has found the page's file never fetched.
    const { ClubConfirmPage } = await import('@/pages/ClubConfirmPage')
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={[`/clubs/confirm/${TOKEN}`]}>
          <Probe seen={seen} />
          <Routes>
            <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )
  }

  it('draws at once for a visitor and for a signed-in person whose profile is still loading', async () => {
    // A visitor.
    const visitor: Array<{ loading: boolean; memberLoading: boolean }> = []
    await openReal(visitor)
    expect(screen.getByText('Reading the link…')).toBeTruthy()
    await ready()
    cleanup()
    // A signed-in person whose first profile load never ends.
    signIn.session = { access_token: 'tok-example', user: { id: 'm-example', email: 'player.one@example.org' } }
    answers['POST /api/me'] = () => new Promise<Response>(() => {})
    answers['GET /api/me'] = () => new Promise<Response>(() => {})
    const person: Array<{ loading: boolean; memberLoading: boolean }> = []
    await openReal(person)
    expect(screen.getByText('Reading the link…')).toBeTruthy()
    await ready()
    await waitFor(() => expect(person.at(-1)?.memberLoading).toBe(true))
    // The page is drawn, with its button, while the profile is still loading.
    expect(screen.getByRole('button', { name: 'Still accurate' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Example Chess Club')
  })
})

describe('Send this month\'s check now, in My region', () => {
  beforeEach(() => { flags.clubKeepers = true })

  const REGION: WorkspaceRegionResponse = {
    clubs: [],
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 0 },
    regions: [],
  }
  const COUNT = { month: 'November 2026', people: 4, sent: 0, notSent: 0, notReached: 0 }

  function openRegion(role: string, seats: unknown[] = []) {
    const auth = { ...contextFor(role), seats, isBoardMember: seats.length > 0 } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/workspace/region']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }
  const checkCalls = () => asked.filter((a) => a.call === 'POST /api/admin/clubs/monthly-check')

  it('is drawn for an LCA admin, and not for a holder of a regional seat', async () => {
    answers['GET /api/workspace/region'] = () => json(REGION)
    openRegion('lca_admin')
    expect(await screen.findByRole('button', { name: 'Send this month\'s check now' }, { timeout: 5000 })).toBeTruthy()
    cleanup()
    openRegion('member', [{ id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }])
    await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
    expect(screen.queryByRole('button', { name: 'Send this month\'s check now' })).toBeNull()
    expect(checkCalls()).toEqual([])
  })

  it('asks one question that names how many people, sends on Send, and says how many were sent and how many not', async () => {
    answers['GET /api/workspace/region'] = () => json(REGION)
    answers['POST /api/admin/clubs/monthly-check'] = () => json(COUNT)
    openRegion('lca_admin')
    const button = await screen.findByRole('button', { name: 'Send this month\'s check now' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(button) })
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain('Send this month\'s check to 4 people now?')
    expect(checkCalls().map((c) => c.body)).toEqual(['{"send":false}'])
    answers['POST /api/admin/clubs/monthly-check'] = () => json({ ...COUNT, sent: 3, notSent: 1 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send to 4 people' })) })
    await waitFor(() => expect(statusText()).toContain('This month\'s check was sent to 3 people; 1 not sent.'))
    expect(checkCalls().map((c) => c.body)).toEqual(['{"send":false}', '{"send":true}'])
  })

  it('Cancel sends nothing and puts the focus back on the button', async () => {
    answers['GET /api/workspace/region'] = () => json(REGION)
    answers['POST /api/admin/clubs/monthly-check'] = () => json(COUNT)
    openRegion('lca_admin')
    const button = await screen.findByRole('button', { name: 'Send this month\'s check now' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(button) })
    await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send this month\'s check now' })))
    expect(checkCalls()).toHaveLength(1)
  })

  it('says a refusal plainly in the server\'s words, a missing second factor among them, and names those not reached', async () => {
    answers['GET /api/workspace/region'] = () => json(REGION)
    answers['POST /api/admin/clubs/monthly-check'] = () => json({ error: 'Two-factor authentication is required for admin access. Set it up in your account security settings.', mfaRequired: true }, 403)
    openRegion('lca_admin')
    const button = await screen.findByRole('button', { name: 'Send this month\'s check now' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(button) })
    await waitFor(() => expect(statusText()).toContain('Two-factor authentication is required for admin access. Set it up in your account security settings.'))
    expect(screen.queryByRole('dialog')).toBeNull()
    answers['POST /api/admin/clubs/monthly-check'] = () => json({ ...COUNT, people: 47 })
    await act(async () => { fireEvent.click(button) })
    await screen.findByRole('dialog')
    answers['POST /api/admin/clubs/monthly-check'] = () => json({ ...COUNT, people: 47, sent: 45, notReached: 2 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send to 47 people' })) })
    await waitFor(() => expect(statusText()).toContain('This month\'s check was sent to 45 people; 0 not sent. 2 people not reached by this press.'))
  })
})
