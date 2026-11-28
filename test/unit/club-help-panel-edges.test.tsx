// @vitest-environment jsdom
//
// The edges of Help on the club page's Contact form and on the Reply through
// LCA page, beside test/unit/club-help-panel.test.tsx: where Help is drawn
// and where it is not, what a key pressed outside the panel does, that Escape
// is taken by the panel and goes no further, that an open panel stays open
// while the page moves on (a failed send, Sent., a reply sent), that a panel
// shut is out of a screen reader's reach, that the first opening by itself is
// kept once a message is drawn and not before, and the plain-language rules
// over every sentence the two panels draw: no long dash, never the old
// initials for US Chess, no half written as a decimal, and nothing about how
// the page is built. Every club, person and token here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ContactRelayForm } from '@/areas/clubs/components/ContactRelayForm'
import { CONTACT_SENT } from '@domain/clubs/contactMessage'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'example-made-up-access-token', user: { id: 'm-example' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const { ClubReplyPage, REPLY_HELP_SHOWN_KEY } = await import('@/pages/ClubReplyPage')

const TOKEN = 'v1.x.example-made-up-header.example-made-up-iv.example-made-up-body'
const LINK = `/api/clubs/reply/${encodeURIComponent(TOKEN)}`
const MESSAGE = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'Hello. When do you meet on Saturdays?' }

type Options = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let answers: Record<string, () => Response | Promise<Response>> = {}
let tokens = 0

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`${'US' + 'CF'}`, 'i')
/** Words that would say how a page is built or what may change behind it. */
const HOW_BUILT = /\b(database|server|backend|api|endpoint|cloudflare|turnstile|supabase|token|cookie|storage|cache|code|script|deploy|migration|switch|flag|beta|feature)\b/i

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  tokens = 0
  answers = {
    'POST /api/clubs/example-chess-club/contact': () => json({ sent: true }),
    [`GET ${LINK}`]: () => json(MESSAGE),
    [`POST ${LINK}`]: () => json({ sent: true, firstName: 'Player' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const answer = answers[`${init?.method ?? 'GET'} ${url}`]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA')
  window.turnstile = {
    render: vi.fn((_container: HTMLElement, options: Options) => { options.callback(`example-token-${++tokens}`); return `widget-${tokens}` }),
    remove: vi.fn(),
  }
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** The rules over a sentence a panel draws. */
function plain(words: string) {
  expect(words, words).not.toMatch(DASHES)
  expect(words, words).not.toMatch(OLD_INITIALS)
  expect(words, words).not.toMatch(/\d\.5\b|\.5 /)
  expect(words, words).not.toMatch(HOW_BUILT)
  expect(words.trim(), words).toBe(words)
  expect(words, words).toMatch(/[.?]$/)
}

describe('the Contact form\'s Help, at its edges', () => {
  const draw = (goesTo: 'club' | 'region' | 'lca' = 'club', region: string | null = 'Bayou Region') =>
    render(<ContactRelayForm address="example-chess-club" region={region} goesTo={goesTo} />)
  const helpButton = () => screen.getByRole('button', { name: 'Help' })
  const panel = () => document.getElementById('club-contact-help')!
  async function fillAndSend() {
    await act(async () => { screen.getByLabelText('Your name').focus() })
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Player One' } })
    fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'player.one@example.org' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello. When do you meet?' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
  }

  it('Escape pressed in a field leaves a shut panel shut and an open panel open: only a key in the panel closes it', async () => {
    draw()
    fireEvent.keyDown(screen.getByLabelText('Your name'), { key: 'Escape' })
    expect(panel().hidden).toBe(true)
    await act(async () => { fireEvent.click(helpButton()) })
    expect(panel().hidden).toBe(false)
    fireEvent.keyDown(screen.getByLabelText('Your name'), { key: 'Escape' })
    expect(panel().hidden).toBe(false)
    expect(helpButton().getAttribute('aria-expanded')).toBe('true')
  })

  it('Escape in the panel is taken by it and goes no further up the page', async () => {
    const above = vi.fn()
    render(<div onKeyDown={above}><ContactRelayForm address="example-chess-club" region="Bayou Region" goesTo="club" /></div>)
    await act(async () => { fireEvent.click(helpButton()) })
    fireEvent.keyDown(panel(), { key: 'Enter' })
    expect(above).toHaveBeenCalledTimes(1)
    above.mockClear()
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(above).not.toHaveBeenCalled()
    expect(panel().hidden).toBe(true)
  })

  it('a shut panel is out of a screen reader\'s reach and an open one is a region named Help with Contact', async () => {
    draw()
    expect(screen.queryByRole('region', { name: 'Help with Contact' })).toBeNull()
    expect(screen.getByText('Your message is sent by email.', { exact: false }).closest('[hidden]')).toBe(panel())
    await act(async () => { fireEvent.click(helpButton()) })
    expect(screen.getByRole('region', { name: 'Help with Contact' })).toBe(panel())
    expect(screen.getByText('Your message is sent by email.', { exact: false }).closest('[hidden]')).toBeNull()
  })

  it('an open panel stays open, with the same words, when a send does not go, when it goes and after Write another message', async () => {
    draw('lca', null)
    const words = () => [...panel().querySelectorAll('p')].map((p) => p.textContent)
    const before = words()
    await act(async () => { fireEvent.click(helpButton()) })
    answers['POST /api/clubs/example-chess-club/contact'] = () => json({ error: 'Example refusal.' }, 503)
    await fillAndSend()
    await screen.findByText('Example refusal.')
    expect(panel().hidden).toBe(false)
    answers['POST /api/clubs/example-chess-club/contact'] = () => json({ sent: true })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
    await screen.findByText(CONTACT_SENT)
    expect(panel().hidden).toBe(false)
    expect(words()).toEqual(before)
    expect(screen.getAllByRole('button', { name: /help/i }).map((b) => b.textContent?.trim())).toEqual(['Help', 'Close help'])
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Write another message' })) })
    expect(panel().hidden).toBe(false)
    expect(words()).toEqual(before)
    // Closed from the sent state or after, it still gives the focus back to Help.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Close help' })) })
    expect(document.activeElement).toBe(helpButton())
  })

  it('every sentence it draws, for every place the message goes, keeps the plain-language rules', () => {
    const seen = new Set<string>()
    for (const [goesTo, region] of [['club', 'Bayou Region'], ['region', 'Bayou Region'], ['region', null], ['region', ''], ['lca', null], ['lca', 'Bayou Region']] as const) {
      const view = draw(goesTo, region)
      const sentences = [...panel().querySelectorAll('p')].map((p) => p.textContent ?? '')
      expect(sentences).toHaveLength(2)
      for (const words of sentences) { plain(words); seen.add(words) }
      view.unmount()
    }
    // One sentence for the address, four for who answers (the club, a named region, an unnamed one, LCA): the words are said once each, not once per render.
    expect(seen.size).toBe(1 + 4)
  })
})

describe('the reply page\'s Help, at its edges', () => {
  function contextFor(signedIn: boolean): AuthContextValue {
    return {
      user: signedIn ? { id: 'm-example' } : null, session: null, role: 'member',
      member: signedIn ? { id: 'm-example', role: 'member', club_id: null, full_name: 'Example Rep', email: 'rep@example.org' } : null,
      loading: false, memberLoading: false, seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal1', mfaRequired: false,
      directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
    } as unknown as AuthContextValue
  }
  function openPage() {
    return render(
      <AuthContext.Provider value={contextFor(true)}>
        <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
          <Routes>
            <Route path="/clubs/reply/:token" element={<ClubReplyPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }
  const ready = () => screen.findByRole('button', { name: 'Send reply' })
  const helpButton = () => screen.getByRole('button', { name: 'Help' })
  const panel = () => document.getElementById('club-reply-help')!
  const helpControls = () => screen.queryAllByRole('button', { name: /help/i, hidden: true })

  beforeEach(() => { window.localStorage.setItem(REPLY_HELP_SHOWN_KEY, 'shown') })

  it('draws no Help while the link is read, when the server refuses it and when the message could not be read; it is drawn once a retry works', async () => {
    let reads = 0
    answers[`GET ${LINK}`] = () => { reads += 1; return reads === 1 ? Promise.reject(new TypeError('offline')) : json(MESSAGE) }
    openPage()
    await screen.findByRole('button', { name: 'Try again' })
    expect(helpControls()).toEqual([])
    expect(document.getElementById('club-reply-help')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await ready()
    expect(helpControls().map((b) => b.textContent?.trim())).toEqual(['Help', 'Close help'])
    cleanup()
    for (const status of [400, 403, 404, 429]) {
      answers[`GET ${LINK}`] = () => json({ error: `Example refusal ${status}.` }, status)
      openPage()
      await screen.findByText(`Example refusal ${status}.`)
      expect(helpControls()).toEqual([])
      cleanup()
    }
  })

  it('an open panel stays open when the reply goes, the focus moves to the sent words, and Close help then gives it to Help', async () => {
    openPage()
    await ready()
    await act(async () => { fireEvent.click(helpButton()) })
    await waitFor(() => expect(document.activeElement).toBe(panel()))
    const words = [...panel().querySelectorAll('p')].map((p) => p.textContent)
    fireEvent.change(screen.getByRole('textbox', { name: 'Your reply' }), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText('Sent to Player. Their address was never shown to you.')
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-slot="reply-sent"]')))
    expect(panel().hidden).toBe(false)
    expect([...panel().querySelectorAll('p')].map((p) => p.textContent)).toEqual(words)
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(panel().hidden).toBe(true)
    expect(document.activeElement).toBe(helpButton())
  })

  it('Escape pressed in the reply box leaves the panel as it is, and Escape in the panel goes no further up the page', async () => {
    const above = vi.fn()
    render(
      <AuthContext.Provider value={contextFor(true)}>
        <div onKeyDown={above}>
          <MemoryRouter initialEntries={[`/clubs/reply/${TOKEN}`]}>
            <Routes><Route path="/clubs/reply/:token" element={<ClubReplyPage />} /></Routes>
          </MemoryRouter>
        </div>
      </AuthContext.Provider>,
    )
    await ready()
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your reply' }), { key: 'Escape' })
    expect(panel().hidden).toBe(true)
    await act(async () => { fireEvent.click(helpButton()) })
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your reply' }), { key: 'Escape' })
    expect(panel().hidden).toBe(false)
    above.mockClear()
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(above).not.toHaveBeenCalled()
    expect(panel().hidden).toBe(true)
  })

  it('opening by itself is kept only once a message is drawn: a link that failed first keeps nothing, and the retry that works opens it and keeps the key', async () => {
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    let reads = 0
    answers[`GET ${LINK}`] = () => { reads += 1; return reads === 1 ? Promise.reject(new TypeError('offline')) : json(MESSAGE) }
    openPage()
    await screen.findByRole('button', { name: 'Try again' })
    expect(window.localStorage.getItem(REPLY_HELP_SHOWN_KEY)).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await ready()
    await waitFor(() => expect(helpButton().getAttribute('aria-expanded')).toBe('true'))
    expect(window.localStorage.getItem(REPLY_HELP_SHOWN_KEY)).toBe('shown')
  })

  it('closed once it has opened by itself, it stays closed through typing, a refused send and a send that does not go, and opens only when pressed', async () => {
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    openPage()
    await ready()
    await waitFor(() => expect(helpButton().getAttribute('aria-expanded')).toBe('true'))
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(document.activeElement).toBe(helpButton())
    const box = screen.getByRole('textbox', { name: 'Your reply' })
    fireEvent.change(box, { target: { value: 'Example answer.' } })
    answers[`POST ${LINK}`] = () => json({ error: 'Example refusal.' }, 429)
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText('Example refusal.')
    expect(panel().hidden).toBe(true)
    expect(helpButton().getAttribute('aria-expanded')).toBe('false')
    expect(Object.keys(window.localStorage)).toEqual([REPLY_HELP_SHOWN_KEY])
    await act(async () => { fireEvent.click(helpButton()) })
    expect(panel().hidden).toBe(false)
  })

  it('the first name is drawn in the panel as words, never as markup, and the sentences keep the plain-language rules for any name', async () => {
    for (const firstName of ['Player', 'Renée', '<b>Player</b>', 'Zoë-Ann']) {
      answers[`GET ${LINK}`] = () => json({ ...MESSAGE, firstName })
      openPage()
      await ready()
      expect(panel().querySelectorAll('b, i, a, script')).toHaveLength(0)
      const sentences = [...panel().querySelectorAll('p')].map((p) => p.textContent ?? '')
      expect(sentences).toHaveLength(4)
      expect(sentences[0]).toContain(`If ${firstName} answers your email`)
      expect(sentences[2]).toContain(`Your reply goes to ${firstName} by email`)
      for (const words of sentences) plain(words.replaceAll(firstName, 'Player'))
      cleanup()
    }
  })
})
