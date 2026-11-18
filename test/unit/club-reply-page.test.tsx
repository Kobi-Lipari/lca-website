// @vitest-environment jsdom
//
// The Reply through LCA page, /clubs/reply/:token (WS09, the twenty-seventh step), as a
// person draws it:
// - through the site's own routes in src/App.tsx, where it is drawn only
//   with clubPagesOn, and with it off the address draws what it draws today
//   and no call is made;
// - on its own, under a fixed sign-in context: signed out, Log in first,
//   with a Log in link that comes back to the same address; let in, the
//   visitor's first name, the club, the first lines, one labelled box and
//   Send reply; an empty send refused beside the box; Sending while the
//   reply goes, with a second press doing nothing; the sent words with the
//   focus on them; each refusal in words above the button; Help that opens
//   by itself once; nothing typed kept in the browser's storage; no
//   referrer and no index while drawn.
//
// The real page runs through the real client with fetch stubbed. Every
// club, person and token here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { REPLY_FIELD_WORDS, replySentWords } from '@domain/clubs/replyMessage'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'example-made-up-access-token', user: { id: 'm-example' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))

const { default: App } = await import('@/App')
const { ClubReplyPage, LOG_IN_FIRST, REPLY_HELP_SHOWN_KEY, SIGN_IN_ENDED } = await import('@/pages/ClubReplyPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const TOKEN = 'v1.x.example-made-up-header.example-made-up-iv.example-made-up-body'
const LINK = `/api/clubs/reply/${encodeURIComponent(TOKEN)}`
const MESSAGE = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'Hello. When do you meet on Saturdays?' }
const LINK_REFUSED = 'This link can\'t be used. Links work for 30 days, and only as the email gave them. Check that the whole link was copied.'
const NOT_YOURS = 'Only the region\'s representative and the LCA admins can answer messages sent to this club.'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string; init?: RequestInit }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  window.localStorage.setItem(REPLY_HELP_SHOWN_KEY, 'shown')
  flags.newClubs = false
  flags.newLook = false
  asked = []
  answers = {
    [`GET ${LINK}`]: () => json(MESSAGE),
    [`POST ${LINK}`]: () => json({ sent: true, firstName: 'Player' }),
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

/** A visitor, or a signed-in person, as the fixed context the page reads. */
function contextFor(signedIn: boolean, loading = false): AuthContextValue {
  return {
    user: signedIn ? { id: 'm-example' } : null, session: null, role: 'member',
    member: signedIn ? { id: 'm-example', role: 'member', club_id: null, full_name: 'Example Rep', email: 'rep@example.org' } : null,
    loading, memberLoading: false, seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal1', mfaRequired: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

/** Where the login page was sent, and with what it was asked to come back to. */
function LoginStandIn() {
  const location = useLocation()
  return <p data-testid="login">{`from ${(location.state as { from?: string } | null)?.from ?? 'nowhere'}`}</p>
}

function openPage(signedIn = true, loading = false) {
  return render(
    <AuthContext.Provider value={contextFor(signedIn, loading)}>
      <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
        <Routes>
          <Route path="/clubs/reply/:token" element={<ClubReplyPage />} />
          <Route path="/login" element={<LoginStandIn />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const ready = () => screen.findByRole('button', { name: 'Send reply' })
const box = () => screen.getByRole('textbox', { name: 'Your reply' })
const replyCalls = () => asked.filter((a) => a.call.includes('/api/clubs/reply/'))

describe('the route', () => {
  it('with clubPagesOn off the address draws what it draws today: no reply page and no call', async () => {
    render(
      <AuthContext.Provider value={contextFor(true)}>
        <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await act(async () => {})
    expect(screen.queryByRole('heading', { name: 'Reply through LCA' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(replyCalls()).toEqual([])
  })

  it('with clubPagesOn on the page is drawn through the site\'s routes', async () => {
    flags.newClubs = true
    flags.newLook = true
    render(
      <AuthContext.Provider value={contextFor(true)}>
        <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(await screen.findByRole('button', { name: 'Send reply' }, { timeout: 5000 })).toBeTruthy()
  })

  it('sits behind clubPagesOn in App.tsx, before /clubs/:id, with the page lazy', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('const ClubReplyPage = lazy(() => import(\'@/pages/ClubReplyPage\').then(m => ({ default: m.ClubReplyPage })))')
    const route = app.indexOf('{clubPagesOn() && <Route path="/clubs/reply/:token" element={<ClubReplyPage />} />}')
    expect(route).toBeGreaterThan(-1)
    expect(route).toBeLessThan(app.indexOf('<Route path="/clubs/:id" element={<ClubListingPage />} />'))
    expect(route).toBeLessThan(app.indexOf('<Route path="/clubs/:id" element={<ClubDetailPage />} />'))
  })
})

describe('signed out', () => {
  it('says Log in first and makes no call, and Log in comes back to the same address', async () => {
    openPage(false)
    expect(screen.getByText(LOG_IN_FIRST)).toBeTruthy()
    await act(async () => {})
    expect(replyCalls()).toEqual([])
    fireEvent.click(screen.getByRole('link', { name: 'Log in' }))
    expect(screen.getByTestId('login').textContent).toBe(`from /clubs/reply/${TOKEN}`)
  })

  it('while the sign-in is still read, says so and makes no call', async () => {
    openPage(false, true)
    expect(screen.getByRole('status').textContent).toBe('Reading the link…')
    await act(async () => {})
    expect(replyCalls()).toEqual([])
  })
})

describe('let in', () => {
  it('shows the first name, the club and the first lines, one labelled box and Send reply, read with the sign-in and no referrer', async () => {
    openPage()
    await ready()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Reply through LCA')
    expect(screen.getByText('Player wrote to Example Chess Club:')).toBeTruthy()
    expect(screen.getByText(MESSAGE.excerpt).tagName).toBe('BLOCKQUOTE')
    expect(box().tagName).toBe('TEXTAREA')
    expect(document.querySelectorAll('textarea, input')).toHaveLength(1)
    const [get] = replyCalls()
    expect(get.call).toBe(`GET ${LINK}`)
    expect((get.init?.headers as Record<string, string>).Authorization).toBe('Bearer example-made-up-access-token')
    expect(get.init?.referrerPolicy).toBe('no-referrer')
  })

  it('an empty send is refused beside the box, with the focus on it and nothing sent', async () => {
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    const words = screen.getByText(REPLY_FIELD_WORDS.missing)
    expect(box().getAttribute('aria-invalid')).toBe('true')
    expect(box().getAttribute('aria-describedby')).toBe(words.id)
    expect(document.activeElement).toBe(box())
    // Too long is said beside the box too.
    fireEvent.change(box(), { target: { value: 'M'.repeat(5001) } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(screen.getByText(REPLY_FIELD_WORDS.long)).toBeTruthy()
    expect(replyCalls().filter((a) => a.call.startsWith('POST'))).toEqual([])
  })

  it('says Sending while the reply goes, a second press sends nothing more, and the sent words take the focus', async () => {
    let release: () => void = () => {}
    answers[`POST ${LINK}`] = () => new Promise<Response>((done) => { release = () => done(json({ sent: true, firstName: 'Player' })) })
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'We meet on Saturdays at 10:00 AM.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    const sending = await screen.findByRole('button', { name: 'Sending…' })
    expect(sending.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(sending)
    await act(async () => { release() })
    const sent = await screen.findByText(replySentWords('Player'))
    expect(sent.textContent).toBe('Sent to Player. Their address was never shown to you.')
    expect(document.activeElement).toBe(sent)
    const posts = replyCalls().filter((a) => a.call.startsWith('POST'))
    expect(posts).toHaveLength(1)
    expect(JSON.parse(posts[0].body!)).toEqual({ message: 'We meet on Saturdays at 10:00 AM.' })
    expect(posts[0].init?.referrerPolicy).toBe('no-referrer')
  })

  it('a refusal at the press is said in the server\'s words above Send reply, and the focus stays on the button', async () => {
    for (const [status, words] of [[429, 'You have sent too many replies this hour. Try again in an hour.'], [400, LINK_REFUSED], [503, 'We couldn\'t send this. Try again later.']] as const) {
      answers[`POST ${LINK}`] = () => json({ error: words }, status)
      openPage()
      await ready()
      fireEvent.change(box(), { target: { value: 'Example answer.' } })
      const button = screen.getByRole('button', { name: 'Send reply' })
      button.focus()
      fireEvent.click(button)
      await waitFor(() => expect(document.getElementById('club-reply-status')?.textContent).toBe(words))
      const line = document.getElementById('club-reply-status')!
      expect(line.getAttribute('role')).toBe('status')
      // Above the button in the page's order, so the words are in sight wherever the button is.
      expect(line.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(document.activeElement).toBe(button)
      cleanup()
    }
  })

  it('a send that does not go through is said in words and the box keeps what was typed', async () => {
    answers[`POST ${LINK}`] = () => Promise.reject(new TypeError('Failed to fetch'))
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await waitFor(() => expect(document.getElementById('club-reply-status')?.textContent).toBe('We couldn\'t send this. Check your connection, then try again.'))
    expect((box() as HTMLTextAreaElement).value).toBe('Example answer.')
  })
})

describe('refused on load', () => {
  it('says each refusal in the server\'s words, with one way onward, and a sign-in that has ended with Log in', async () => {
    for (const [status, words, onward] of [
      [400, LINK_REFUSED, 'Go to the home page'],
      [403, NOT_YOURS, 'Go to the home page'],
      [404, 'This club is no longer listed on the site.', 'Go to the home page'],
      [503, 'Reply links can\'t be read on the site right now. Try again later.', 'Go to the home page'],
      [401, SIGN_IN_ENDED, 'Log in'],
    ] as const) {
      answers[`GET ${LINK}`] = () => json({ error: status === 401 ? 'Unauthorized' : words }, status)
      openPage()
      expect(await screen.findByText(words)).toBeTruthy()
      expect(screen.getByRole('link', { name: onward })).toBeTruthy()
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(document.body.textContent).not.toContain('Unauthorized')
      cleanup()
    }
  })

  it('a load that fails says so with Try again, which reads the link again', async () => {
    answers[`GET ${LINK}`] = () => Promise.reject(new TypeError('Failed to fetch'))
    openPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    answers[`GET ${LINK}`] = () => json(MESSAGE)
    await ready()
    expect(replyCalls().filter((a) => a.call.startsWith('GET'))).toHaveLength(2)
  })
})

describe('Help and what the browser keeps', () => {
  it('Help opens by itself the first time, once, with the focus left where it is, and Escape closes it', async () => {
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    openPage()
    await ready()
    const help = screen.getByRole('button', { name: 'Help' })
    await waitFor(() => expect(help.getAttribute('aria-expanded')).toBe('true'))
    const part = screen.getByRole('region', { name: 'Help with Reply through LCA' })
    expect(part.textContent).toContain('signed with your role')
    expect(part.textContent).toContain('To sign your own name, write it in your reply.')
    expect(part.textContent).toContain('LCA\'s own mailbox')
    expect(document.activeElement).not.toBe(part)
    fireEvent.keyDown(part, { key: 'Escape' })
    expect(help.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(help)
    cleanup()
    // The next time, it stays closed until asked.
    openPage()
    await ready()
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps nothing typed in the browser\'s storage, only that Help has opened', async () => {
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'An example answer, typed.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText(replySentWords('Player'))
    const kept = JSON.stringify({ ...window.localStorage }) + JSON.stringify({ ...window.sessionStorage })
    expect(kept).not.toMatch(/example answer|Player|Example Chess Club|v1\.x/i)
    expect(Object.keys(window.localStorage)).toEqual([REPLY_HELP_SHOWN_KEY])
  })

  it('asks for no referrer and no index while drawn, and keeps the token out of the title', async () => {
    const view = openPage()
    await ready()
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow')
    expect(document.title).not.toContain(TOKEN)
    for (const link of document.querySelectorAll('a')) expect(link.getAttribute('href') ?? '').not.toContain('v1.x')
    view.unmount()
    expect(document.head.querySelector('meta[name="referrer"]')).toBeNull()
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('calls through src/areas/clubs/api.ts only, and public/_headers serves the address with no referrer and no index', () => {
    const page = read('src/pages/ClubReplyPage.tsx')
    expect(page).not.toMatch(/\bfetch\(|XMLHttpRequest|sendBeacon|sessionStorage|indexedDB/)
    expect(page).toMatch(/getClubReply/)
    expect(page).toMatch(/sendClubReply/)
    expect(read('public/_headers')).toContain('/clubs/reply/*\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex\n')
  })
})
