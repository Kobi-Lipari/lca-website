// @vitest-environment jsdom
//
// The Reply through LCA page, /clubs/reply/:token (WS09, the twenty-seventh step), at the edges its
// first test file does not reach: a visitor's own markup drawn as words and
// nothing else, a sign-in that ends at the press, a second press by the keyboard
// while the first is still going, what the browser's storage holds once the
// reply has gone, the page with nothing to show of the message, and the plain
// words of every state. The real page runs through the real client with
// fetch stubbed; the sign-in is a fixed context. Every name and token is made up.
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { replySentWords } from '@domain/clubs/replyMessage'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'example-made-up-access-token', user: { id: 'm-example' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const { ClubReplyPage, SIGN_IN_ENDED } = await import('@/pages/ClubReplyPage')

const TOKEN = 'v1.x.example-made-up-header.example-made-up-iv.example-made-up-body'
const LINK = `/api/clubs/reply/${encodeURIComponent(TOKEN)}`
const MESSAGE = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'Hello. When do you meet on Saturdays?' }
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  asked = []
  answers = {
    [`GET ${LINK}`]: () => json(MESSAGE),
    [`POST ${LINK}`]: () => json({ sent: true, firstName: 'Player' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined })
    const answer = answers[call]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function contextFor(signedIn: boolean): AuthContextValue {
  return {
    user: signedIn ? { id: 'm-example' } : null, session: null, role: 'member',
    member: signedIn ? { id: 'm-example', role: 'member', club_id: null, full_name: 'Example Rep', email: 'rep@example.org' } : null,
    loading: false, memberLoading: false, seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal1', mfaRequired: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

function openPage(signedIn = true) {
  return render(
    <AuthContext.Provider value={contextFor(signedIn)}>
      <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
        <Routes>
          <Route path="/clubs/reply/:token" element={<ClubReplyPage />} />
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const ready = () => screen.findByRole('button', { name: 'Send reply' })
const box = () => screen.getByRole('textbox', { name: 'Your reply' })
const posts = () => asked.filter((a) => a.call.startsWith('POST'))

describe('a visitor\'s own words on the page', () => {
  it('markup in the first name, the club and the first lines is drawn as words, and adds no element', async () => {
    answers[`GET ${LINK}`] = () => json({ firstName: '<b>Player</b>', club: 'Example <i>Chess</i> Club', excerpt: '<img src=x onerror=alert(1)> <script>alert(1)</script> & more' })
    const { container } = openPage()
    await ready()
    expect(container.querySelector('script, img, b, i')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)> <script>alert(1)</script> & more')
    expect(container.textContent).toContain('<b>Player</b>')
    expect(container.textContent).toContain('Example <i>Chess</i> Club')
  })

  it('a message with nothing to show still draws the box and the button, and a reply may still be sent', async () => {
    answers[`GET ${LINK}`] = () => json({ firstName: 'Player', club: 'Example Chess Club', excerpt: '' })
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(await screen.findByText(replySentWords('Player'))).toBeTruthy()
  })
})

describe('at the press', () => {
  it('a sign-in that has ended says so in words above the button, and the typed words are still in the box', async () => {
    answers[`POST ${LINK}`] = () => json({ error: 'Unauthorized' }, 401)
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await waitFor(() => expect(document.getElementById('club-reply-status')?.textContent).toContain(SIGN_IN_ENDED))
    expect(document.body.textContent).not.toContain('Unauthorized')
    expect((box() as HTMLTextAreaElement).value).toBe('Example answer.')
  })

  it('pressing Enter in the form twice while the first goes sends once', async () => {
    let release: () => void = () => {}
    answers[`POST ${LINK}`] = () => new Promise<Response>((done) => { release = () => done(json({ sent: true, firstName: 'Player' })) })
    const { container } = openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(posts()).toHaveLength(1))
    fireEvent.submit(form)
    await act(async () => { release() })
    await screen.findByText(replySentWords('Player'))
    expect(posts()).toHaveLength(1)
  })

  it('the sent words use the first name the server gave back, and no reply box is left to send a second one by mistake', async () => {
    answers[`POST ${LINK}`] = () => json({ sent: true, firstName: 'Renée' })
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    const sent = await screen.findByText('Sent to Renée. Their address was never shown to you.')
    expect(sent).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Send reply' })).toBeNull()
  })
})

describe('what the browser keeps', () => {
  it('after a reply has gone, no storage holds the words typed, the visitor\'s name, the club or the token', async () => {
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'An example answer with distinctive words 0027.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText(replySentWords('Player'))
    const kept = [window.localStorage, window.sessionStorage].flatMap((store) => Object.keys(store).map((key) => `${key}=${store.getItem(key)}`)).join('\n')
    for (const secret of ['distinctive words', 'Player', 'Example Chess Club', 'Saturdays', TOKEN, 'example-made-up-iv']) expect(kept).not.toContain(secret)
    expect(Object.keys(window.localStorage)).toEqual([])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    expect(document.cookie).toBe('')
  })

  it('a browser that refuses storage still draws the page and sends the reply', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage is blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage is blocked') })
    openPage()
    await ready()
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    expect(await screen.findByText(replySentWords('Player'))).toBeTruthy()
  })
})

describe('plain words in every state', () => {
  it('the page in each state has no long dash and never the abbreviation for US Chess', async () => {
    const seen: string[] = []
    openPage(false)
    await screen.findByText(/Log in first/)
    seen.push(document.body.textContent ?? '')
    cleanup()
    openPage()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    seen.push(document.body.textContent ?? '')
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText(replySentWords('Player'))
    seen.push(document.body.textContent ?? '')
    for (const status of [400, 403, 404, 503]) {
      cleanup()
      answers[`GET ${LINK}`] = () => json({ error: 'Example words for a refusal.' }, status)
      openPage()
      await screen.findByText('Example words for a refusal.')
      seen.push(document.body.textContent ?? '')
    }
    for (const text of seen) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    }
    expect(seen.join(' ')).toContain('Their address was never shown to you.')
  })
})
