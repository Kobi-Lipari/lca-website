// @vitest-environment jsdom
//
// Help on the club page's Contact form and on the Reply through LCA page:
// one button named Help and one panel on each, as WS09 steps 26 and 27 built
// them, brought back on K's answer to checkpoint X's choice 5 with the words
// of WS09 checkpoint X's review. On each page: one button and no small
// question mark, in every state the page draws Help; the panel holds every
// sentence, word for word, in every variant of the words; a press moves the
// focus into the panel, and Escape, a second press and Close help each shut
// it with the focus back on Help; no control has explaining words beside it
// outside the panel. The reply page's Help opens by itself once, kept by one
// key in the browser; the Contact form's opens only when pressed and keeps
// nothing. The first files of the two pages, test/unit/contact-relay-form.test.tsx
// and test/unit/club-reply-page.test.tsx, hold the cases steps 26 and 27 wrote.
//
// The real form and the real page run through the real client with fetch
// stubbed; the spam check's script is a stand-in on the window and the
// sign-in a fixed context. Every club, person and token here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ContactRelayForm } from '@/areas/clubs/components/ContactRelayForm'
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

const { ClubReplyPage, REPLY_HELP_SHOWN_KEY } = await import('@/pages/ClubReplyPage')

const TEST_SITE_KEY = '1x00000000000000000000AA'
const TOKEN = 'v1.x.example-made-up-header.example-made-up-iv.example-made-up-body'
const LINK = `/api/clubs/reply/${encodeURIComponent(TOKEN)}`
const MESSAGE = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'Hello. When do you meet on Saturdays?' }

type Options = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
let answers: Record<string, () => Response | Promise<Response>> = {}
let tokens = 0

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
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', TEST_SITE_KEY)
  // The provider's script as a stand-in: each widget it draws hands back a fresh token at once.
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

/** The words drawn outside a panel, each text in its own place, the typed words of a box left out. */
function wordsOutside(root: HTMLElement, panel: string): string[] {
  const words: string[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim()
    if (text && !node.parentElement?.closest(`${panel}, textarea`)) words.push(text)
  }
  return words
}

/** One button with help in its name in sight, and with the shut panel counted, that button and Close help alone; no small question mark. */
function oneHelpButton(root: HTMLElement, region: string) {
  expect(screen.getAllByRole('button', { name: /help/i }).map((b) => b.textContent?.trim())).toEqual(['Help'])
  expect(screen.getAllByRole('button', { name: /help/i, hidden: true }).map((b) => b.textContent?.trim())).toEqual(['Help', 'Close help'])
  expect(screen.queryAllByRole('button', { name: /^Help: /, hidden: true })).toEqual([])
  expect(root.querySelectorAll('[data-slot="help-mark"], [data-slot="help-mark-bubble"]')).toHaveLength(0)
  expect(root.querySelectorAll(`[role="region"][aria-label="${region}"]`)).toHaveLength(1)
}

/** A press of Help moves the focus into the panel; Escape, a second press and Close help each shut it with the focus back on Help. */
async function focusAndEscape(panelId: string) {
  const help = screen.getByRole('button', { name: 'Help' })
  const part = document.getElementById(panelId)!
  expect(help.getAttribute('aria-controls')).toBe(panelId)
  expect(help.getAttribute('aria-expanded')).toBe('false')
  expect(part.hidden).toBe(true)
  const open = async () => {
    await act(async () => { fireEvent.click(help) })
    await waitFor(() => expect(document.activeElement).toBe(part))
    expect(part.hidden).toBe(false)
    expect(help.getAttribute('aria-expanded')).toBe('true')
  }
  const shut = () => {
    expect(part.hidden).toBe(true)
    expect(help.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(help)
  }
  await open()
  fireEvent.keyDown(part, { key: 'Escape' })
  shut()
  await open()
  await act(async () => { fireEvent.click(help) })
  shut()
  await open()
  await act(async () => { fireEvent.click(within(part).getByRole('button', { name: 'Close help' })) })
  shut()
  // Another key in the panel leaves it open.
  await open()
  fireEvent.keyDown(part, { key: 'Enter' })
  expect(part.hidden).toBe(false)
}

describe('the Contact form\'s Help', () => {
  const draw = (goesTo: 'club' | 'region' | 'lca' = 'club', region: string | null = 'Bayou Region') =>
    render(<ContactRelayForm address="example-chess-club" region={region} goesTo={goesTo} />)
  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
  const panel = () => document.getElementById('club-contact-help')!
  async function fill() {
    await act(async () => { field('Your name').focus() })
    fireEvent.change(field('Your name'), { target: { value: 'Player One' } })
    fireEvent.change(field('Your email'), { target: { value: 'player.one@example.org' } })
    fireEvent.change(field('Message'), { target: { value: 'Hello. When do you meet?' } })
  }

  it('is one button named Help and no small question mark, before the form is used, while it is used and once sent', async () => {
    const { container } = draw()
    oneHelpButton(container, 'Help with Contact')
    await fill()
    oneHelpButton(container, 'Help with Contact')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send message' })) })
    await screen.findByText('Sent.')
    oneHelpButton(container, 'Help with Contact')
  })

  it('holds every sentence, word for word, for each place the message goes: the line\'s words, then the email\'s', () => {
    const variants: Array<['club' | 'region' | 'lca', string | null, string]> = [
      ['club', 'Bayou Region', 'The club\'s contact'],
      ['region', 'Bayou Region', 'The Bayou Region representative'],
      ['region', '  Bayou Region  ', 'The Bayou Region representative'],
      ['region', null, 'The region\'s representative'],
      ['region', '   ', 'The region\'s representative'],
      ['lca', 'Bayou Region', 'Someone at LCA'],
    ]
    for (const [goesTo, region, who] of variants) {
      const view = draw(goesTo, region)
      expect([...panel().querySelectorAll('p')].map((p) => p.textContent)).toEqual([
        'The club\'s address is not shown on its page. Your message is sent by email.',
        `${who} answers by email, to the address you give here.`,
      ])
      view.unmount()
    }
  })

  it('stands straight under the line, above the fields, with the help icon beside its word', () => {
    draw()
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help.getAttribute('type')).toBe('button')
    expect(help.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(help.className).toMatch(/\bmin-h-11\b/)
    expect(panel().previousElementSibling?.contains(help)).toBe(true)
    expect(panel().previousElementSibling?.contains(document.getElementById('club-contact-line'))).toBe(true)
    expect(panel().compareDocumentPosition(field('Your name')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel().getAttribute('tabindex')).toBe('-1')
  })

  it('takes the focus into the panel when pressed; Escape, a second press and Close help each give it back to Help', async () => {
    draw()
    await focusAndEscape('club-contact-help')
  })

  it('opens only when pressed and keeps nothing in the browser for it', async () => {
    const kept = vi.spyOn(Storage.prototype, 'setItem')
    draw()
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Help' })) })
    expect(kept).not.toHaveBeenCalled()
  })

  it('leaves no control with explaining words beside it: every sentence of Help is in the panel and nowhere else', async () => {
    const { container } = draw('region', 'Bayou Region')
    expect(wordsOutside(container, '#club-contact-help')).toEqual([
      'No club address on file, so your message goes to the Bayou Region representative by email.', 'Help', 'Your name', 'Your email', 'Message', 'Send message',
    ])
    await fill()
    const outside = wordsOutside(container, '#club-contact-help').join('\n')
    for (const words of ['is not shown on its page', 'answers by email', 'Your message is sent by email.']) expect(outside, words).not.toContain(words)
    expect(container.querySelectorAll('[placeholder], [title]')).toHaveLength(0)
  })
})

describe('the reply page\'s Help', () => {
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
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }
  const ready = () => screen.findByRole('button', { name: 'Send reply' })
  const box = () => screen.getByRole('textbox', { name: 'Your reply' })
  const panel = () => document.getElementById('club-reply-help')!
  /** Every sentence of Help, word for word, in the order a person reads the page, for the visitor's first name. */
  const helpFor = (firstName: string) => [
    `If ${firstName} answers your email, it comes to LCA's own mailbox. They can also write to the club again from its page.`,
    'A link from the email works for 30 days. If it will not open, check that the whole link was copied from the email.',
    `Your reply goes to ${firstName} by email from LCA's own address. Their address is never shown to you, and yours is never shown to them.`,
    'The reply is signed with your role, such as the region\'s representative, and not with your name. To sign your own name, write it in your reply.',
  ]
  const send = async (firstName: string) => {
    fireEvent.change(box(), { target: { value: 'Example answer.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }))
    await screen.findByText(replySentWords(firstName))
  }

  beforeEach(() => { window.localStorage.setItem(REPLY_HELP_SHOWN_KEY, 'shown') })

  it('is one button named Help and no small question mark, with the message and once the reply has gone', async () => {
    openPage()
    await ready()
    oneHelpButton(document.body, 'Help with Reply through LCA')
    await send('Player')
    oneHelpButton(document.body, 'Help with Reply through LCA')
  })

  it('holds every sentence, word for word, with the visitor\'s first name, with the message and once sent', async () => {
    for (const firstName of ['Player', 'Renée']) {
      answers[`GET ${LINK}`] = () => json({ ...MESSAGE, firstName })
      answers[`POST ${LINK}`] = () => json({ sent: true, firstName })
      openPage()
      await ready()
      expect([...panel().querySelectorAll('p')].map((p) => p.textContent)).toEqual(helpFor(firstName))
      await send(firstName)
      expect([...panel().querySelectorAll('p')].map((p) => p.textContent)).toEqual(helpFor(firstName))
      cleanup()
    }
  })

  it('stands straight under the heading, above the message, with the help icon beside its word, and only once a message is drawn', async () => {
    openPage(false)
    await screen.findByRole('heading', { name: 'Reply through LCA' })
    expect(screen.queryByRole('button', { name: /help/i, hidden: true })).toBeNull()
    cleanup()
    openPage()
    await ready()
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help.getAttribute('type')).toBe('button')
    expect(help.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(help.className).toMatch(/\bmin-h-11\b/)
    expect(panel().previousElementSibling?.contains(help)).toBe(true)
    expect(panel().previousElementSibling?.contains(screen.getByRole('heading', { name: 'Reply through LCA' }))).toBe(true)
    expect(panel().compareDocumentPosition(box()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(panel().getAttribute('tabindex')).toBe('-1')
  })

  it('takes the focus into the panel when pressed; Escape, a second press and Close help each give it back to Help', async () => {
    openPage()
    await ready()
    await focusAndEscape('club-reply-help')
  })

  it('opens by itself the first time a message is drawn, with the focus left where it is, and keeps lca-club-reply-help as shown, and only then', async () => {
    expect(REPLY_HELP_SHOWN_KEY).toBe('lca-club-reply-help')
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    // Signed out, and with a link refused, no message is drawn: Help neither opens nor is remembered.
    openPage(false)
    await screen.findByRole('link', { name: 'Log in' })
    expect(window.localStorage.getItem(REPLY_HELP_SHOWN_KEY)).toBeNull()
    cleanup()
    answers[`GET ${LINK}`] = () => json({ error: 'Example words for a refusal.' }, 404)
    openPage()
    await screen.findByText('Example words for a refusal.')
    expect(window.localStorage.getItem(REPLY_HELP_SHOWN_KEY)).toBeNull()
    cleanup()
    answers[`GET ${LINK}`] = () => json(MESSAGE)
    openPage()
    await ready()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('true'))
    expect(panel().hidden).toBe(false)
    expect(document.activeElement).not.toBe(panel())
    expect(window.localStorage.getItem(REPLY_HELP_SHOWN_KEY)).toBe('shown')
    expect(Object.keys(window.localStorage)).toEqual([REPLY_HELP_SHOWN_KEY])
    expect(Object.keys(window.sessionStorage)).toEqual([])
    cleanup()
    // Once shown, it stays shut until pressed.
    openPage()
    await ready()
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
    expect(panel().hidden).toBe(true)
  })

  it('opens by itself where storage can be read but not written, and keeps nothing', async () => {
    window.localStorage.removeItem(REPLY_HELP_SHOWN_KEY)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage is full') })
    openPage()
    await ready()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('true'))
    expect(Object.keys(window.localStorage)).toEqual([])
  })

  it('leaves no control with explaining words beside it: every sentence of Help is in the panel and nowhere else', async () => {
    openPage()
    await ready()
    expect(wordsOutside(document.body, '#club-reply-help')).toEqual([
      'Reply through LCA', 'Help', 'Player wrote to Example Chess Club:', 'Hello. When do you meet on Saturdays?', 'Your reply', 'Send reply',
    ])
    for (const words of helpFor('Player')) expect(wordsOutside(document.body, '#club-reply-help').join('\n')).not.toContain(words)
    expect(document.querySelectorAll('[placeholder], [title]')).toHaveLength(0)
  })
})
