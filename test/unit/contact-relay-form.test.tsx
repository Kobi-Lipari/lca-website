// @vitest-environment jsdom
//
// The club page's Contact form (src/areas/clubs/components/ContactRelayForm.tsx,
// the contact relay of WS09): the one line saying where the message goes, in three plain
// forms that never name a volunteer; Help, which holds the rest; three fields
// with visible labels and the browser's autocomplete; errors in words beside
// the field, tied to it for a screen reader; one send at a time, its button
// saying so; "Sent." with the focus on it and the fields emptied; the words
// of each refusal, said once, and the spam check drawn afresh after one; the
// spam check drawn only once the form is used; nothing kept in the browser's
// storage; and on the page, Contact the club and Message the club taking the
// focus to the form's heading. The server is played by a stub of fetch, and
// the provider's script by a stand-in on the window; the site key is the
// provider's published test site key. Every name and address is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactRelayForm, ClubContact } from '@/areas/clubs/components/ContactRelayForm'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { bareAnswer } from './helpers/clubPageAnswer'
import { DOCK_SETTLES_MS, keepFocusClearOfBars } from '@/areas/clubs/clubPage'

const TEST_SITE_KEY = '1x00000000000000000000AA'
type Options = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
let rendered: Options[] = []
let tokens = 0

/** The provider's script as a stand-in: each widget it draws hands back a fresh token at once. */
function standIn() {
  return {
    render: vi.fn((_container: HTMLElement, options: Options) => {
      rendered.push(options)
      options.callback(`example-token-${++tokens}`)
      return `widget-${rendered.length}`
    }),
    remove: vi.fn(),
  }
}

type Answer = { status: number; body: unknown } | 'offline'
let answers: Answer[] = []
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: { sent: true } }
  if (next === 'offline') throw new TypeError('Failed to fetch')
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
})

beforeEach(() => {
  rendered = []
  tokens = 0
  answers = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', TEST_SITE_KEY)
  window.turnstile = standIn()
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const draw = (goesTo: 'club' | 'region' | 'lca' = 'club', region: string | null = 'Bayou Region') =>
  render(<ContactRelayForm address="example-chess-club" region={region} goesTo={goesTo} />)
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: /Send message|Sending/ })

/** Moves into the form, as a visitor does, so the spam check is drawn and hands back its token. */
async function fill(values: { name?: string; email?: string; message?: string } = {}) {
  await act(async () => { field('Your name').focus() })
  fireEvent.change(field('Your name'), { target: { value: values.name ?? 'Player One' } })
  fireEvent.change(field('Your email'), { target: { value: values.email ?? 'player.one@example.org' } })
  fireEvent.change(field('Message'), { target: { value: values.message ?? 'Hello. When do you meet?' } })
}
const submit = async () => { await act(async () => { fireEvent.click(sendButton()) }) }

describe('where the message goes, said before it is sent', () => {
  it('says it in one of three plain lines, never naming a volunteer or showing an address, and keeps the rest behind Help', async () => {
    const lines: Array<['club' | 'region' | 'lca', string | null, string]> = [
      ['club', 'Bayou Region', 'Your message goes to the club\'s contact by email. Their address stays private.'],
      ['region', 'Bayou Region', 'No club address on file, so your message goes to the Bayou Region representative by email.'],
      ['region', null, 'No club address on file, so your message goes to the region\'s representative by email.'],
      ['lca', 'Bayou Region', 'No club address on file, so your message goes to the Louisiana Chess Association by email.'],
    ]
    for (const [goesTo, region, line] of lines) {
      const view = draw(goesTo, region)
      expect(screen.getByText(line)).toBeTruthy()
      // Help is shut until asked, and holds how answers come back and why the address is private.
      const help = screen.getByRole('button', { name: 'Help' })
      expect(help.getAttribute('aria-expanded')).toBe('false')
      const part = document.getElementById(help.getAttribute('aria-controls')!)!
      expect(part.hidden).toBe(true)
      await act(async () => { fireEvent.click(help) })
      await waitFor(() => expect(document.activeElement).toBe(part))
      expect(part.hidden).toBe(false)
      expect(part.textContent).toMatch(/answers by email, to the address you give here/)
      expect(part.textContent).toMatch(/keeps no copy of it, your name or your address/)
      fireEvent.keyDown(part, { key: 'Escape' })
      expect(part.hidden).toBe(true)
      expect(document.activeElement).toBe(help)
      expect(view.container.textContent).not.toMatch(/@|Contact P\.|Rita|Example Rep|Example Admin/)
      view.unmount()
    }
  })
})

describe('the fields', () => {
  it('have visible labels and the browser\'s own autocomplete for a name and an address', () => {
    draw()
    expect(field('Your name').getAttribute('autocomplete')).toBe('name')
    expect(field('Your email').getAttribute('autocomplete')).toBe('email')
    expect(field('Your email').getAttribute('type')).toBe('email')
    expect(field('Message').tagName).toBe('TEXTAREA')
    for (const label of ['Your name', 'Your email', 'Message']) expect(screen.getByText(label).tagName).toBe('LABEL')
    expect(sendButton().textContent).toBe('Send message')
    for (const control of [sendButton(), screen.getByRole('button', { name: 'Help' })]) {
      expect(control.className).toMatch(/\bmin-h-11\b/)
      expect(control.className).toMatch(/focus-visible:ring-3 focus-visible:ring-focus/)
    }
  })

  it('an empty send says what is missing beside each field, tied to it, with the focus on the first, and sends nothing', async () => {
    draw()
    await submit()
    const words: Array<[string, string]> = [['Your name', 'Enter your name.'], ['Your email', 'Enter your email address.'], ['Message', 'Write your message.']]
    for (const [label, error] of words) {
      const box = field(label)
      expect(box.getAttribute('aria-invalid')).toBe('true')
      expect(document.getElementById(box.getAttribute('aria-describedby')!)!.textContent).toBe(error)
    }
    expect(document.activeElement).toBe(field('Your name'))
    expect(fetchMock).not.toHaveBeenCalled()
    // An error goes once its field is changed.
    fireEvent.change(field('Your name'), { target: { value: 'Player One' } })
    expect(field('Your name').getAttribute('aria-invalid')).toBeNull()
  })

  it('refuses in the server\'s own words a name past its length and an address that is not one plain address', async () => {
    // A box of one line takes no line break at all; the server refuses one sent all the same (club-contact-relay.test.ts).
    draw()
    await fill({ name: 'P'.repeat(101), email: 'Player One <player.one@example.org>' })
    await submit()
    expect(document.getElementById(field('Your name').getAttribute('aria-describedby')!)!.textContent).toBe('Your name can be at most 100 characters.')
    expect(document.getElementById(field('Your email').getAttribute('aria-describedby')!)!.textContent).toBe('Enter one email address, like name@example.org.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sending', () => {
  it('draws the spam check only once the form is used, then sends the three fields and the token, signed out, to the club\'s address', async () => {
    draw()
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(rendered).toHaveLength(0)
    await fill()
    expect(rendered).toHaveLength(1)
    await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/clubs/example-chess-club/contact')
    expect(init!.method).toBe('POST')
    expect(init!.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(JSON.parse(init!.body as string)).toEqual({ name: 'Player One', email: 'player.one@example.org', message: 'Hello. When do you meet?', token: 'example-token-1' })
  })

  it('says it is sending, and a second press while it sends sends nothing more', async () => {
    let release: (r: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve }))
    draw()
    await fill()
    await submit()
    expect(sendButton().textContent).toBe('Sending…')
    expect(sendButton().getAttribute('aria-disabled')).toBe('true')
    expect(field('Your name').readOnly).toBe(true)
    await submit()
    await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { release(new Response('{"sent":true}', { status: 200 })) })
    expect(await screen.findByText('Sent.')).toBeTruthy()
  })

  it('says Sent. with the focus on it, empties the fields, and only Write another message brings the form back', async () => {
    draw()
    await fill()
    await submit()
    const sent = await screen.findByText('Sent.')
    await waitFor(() => expect(document.activeElement).toBe(sent))
    // The form is gone: nothing can send the same message again by accident.
    expect(screen.queryByRole('button', { name: 'Send message' })).toBeNull()
    expect(screen.queryByLabelText('Message')).toBeNull()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Write another message' })) })
    for (const label of ['Your name', 'Your email', 'Message']) expect(field(label).value).toBe('')
    await waitFor(() => expect(document.activeElement).toBe(field('Your name')))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('says each refusal once, in its words, keeps what was typed, and asks the spam check afresh after it', async () => {
    const refusals: Array<[Answer, string]> = [
      [{ status: 429, body: { error: 'Too many messages from here. Try again in an hour.' } }, 'Too many messages from here. Try again in an hour.'],
      [{ status: 403, body: { error: 'We can\'t send this right now.' } }, 'The spam check didn\'t pass. Try it again, then send.'],
      [{ status: 503, body: { error: 'We couldn\'t send this. Try again later.' } }, 'We couldn\'t send this. Try again later.'],
      ['offline', 'We couldn\'t send this. Check your connection, then try again.'],
    ]
    draw()
    await fill()
    for (const [answer, words] of refusals) {
      answers = [answer]
      const widgets = rendered.length
      await submit()
      const statuses = screen.getAllByRole('status').filter((s) => s.textContent)
      expect(statuses.map((s) => s.textContent)).toEqual([words])
      expect(field('Message').value).toBe('Hello. When do you meet?')
      // A token is good once: the widget is drawn afresh and hands back a new one.
      expect(rendered.length).toBe(widgets + 1)
    }
    const sentTokens = fetchMock.mock.calls.map(([, init]) => (JSON.parse(init!.body as string) as { token: string }).token)
    expect(new Set(sentTokens).size).toBe(sentTokens.length)
  })

  it('waits for the spam check: no token yet, no send, and the words say so', async () => {
    window.turnstile = { render: vi.fn(() => 'widget-quiet'), remove: vi.fn() }
    draw()
    await fill()
    await submit()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Wait for the spam check to finish, then send.')).toBeTruthy()
    expect(document.getElementById(sendButton().getAttribute('aria-describedby')!)!.textContent).toBe('Wait for the spam check to finish, then send.')
  })

  it('keeps nothing the visitor typed in the browser\'s storage', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')
    draw()
    await fill()
    await submit()
    await screen.findByText('Sent.')
    expect(local).not.toHaveBeenCalled()
    expect(JSON.stringify({ ...window.localStorage })).not.toContain('Player One')
    expect(JSON.stringify({ ...window.sessionStorage })).not.toContain('Player One')
  })
})

describe('on the page', () => {
  it('Contact sits in the section nav, and Contact the club takes the focus to the form\'s heading', async () => {
    render(<MemoryRouter><ClubPageView answer={bareAnswer()} keeper={null} /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    expect(within(nav).getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('#contact')
    const heading = screen.getByRole('heading', { level: 2, name: 'Contact' })
    expect(heading.closest('section')!.id).toBe('contact')
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Contact the club' })) })
    // It moves once the link's own jump to #contact is done.
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(heading.className).toMatch(/focus-visible:ring-3 focus-visible:ring-focus/)
  })

  it('keeps a focused control clear of the dock once the dock has settled, and leaves one already clear where it is', () => {
    vi.useFakeTimers()
    try {
      const scrollBy = vi.fn()
      vi.stubGlobal('scrollBy', scrollBy)
      document.documentElement.style.setProperty('--bottom-chrome-h', '118px')
      const button = document.createElement('button')
      document.body.appendChild(button)
      button.focus()
      // A window 844 pixels tall: the dock's top is at 726, and the button's foot at 744 is under it.
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844)
      const box = vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ top: 700, bottom: 744, height: 44 } as DOMRect)
      keepFocusClearOfBars(button)
      expect(scrollBy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(DOCK_SETTLES_MS)
      expect(scrollBy).toHaveBeenCalledWith({ top: 744 - 726 + 8 })
      scrollBy.mockClear()
      box.mockReturnValue({ top: 400, bottom: 444, height: 44 } as DOMRect)
      keepFocusClearOfBars(button)
      vi.advanceTimersByTime(DOCK_SETTLES_MS)
      expect(scrollBy).not.toHaveBeenCalled()
      button.remove()
      document.documentElement.style.removeProperty('--bottom-chrome-h')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ClubContact draws the heading, the line and the form, and nothing of the club\'s contact name', () => {
    const view = render(<ClubContact id="contact" address="example-chess-club" region="Bayou Region" goesTo="club" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Contact' })).toBeTruthy()
    expect(view.container.textContent).not.toContain('Player One')
    expect(view.container.querySelector('section')!.getAttribute('aria-labelledby')).toBe('club-contact-heading')
  })
})
