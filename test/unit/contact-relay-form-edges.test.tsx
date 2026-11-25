// @vitest-environment jsdom
//
// The edges of the club page's Contact form (src/areas/clubs/components/ContactRelayForm.tsx),
// beside test/unit/contact-relay-form.test.tsx: the answers the server can give that the form
// does not expect (a club it cannot find, a refusal of a field, a fault), each leaving the form
// usable with what was typed kept and one status said; the club's own limit and the limiter's
// words reaching the visitor as the server wrote them; a message that is sent after a refusal
// leaving no refusal behind; the order the keyboard moves in; one send for one submit however
// many are made while it goes; the caps at the character; a form taken off the page while
// it sends; and the check that keeps a control clear of the bars, run once its page has gone. The server is played by a stub of fetch and the provider's script by a stand-in on
// the window. Every name and address is made up.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactRelayForm } from '@/areas/clubs/components/ContactRelayForm'
import { DOCK_SETTLES_MS, keepFocusClearOfBars } from '@/areas/clubs/clubPage'
import { CANT_SEND_NOW } from '../../functions/utils/rateLimit'
import { CONTACT_CLOSED } from '../../functions/api/clubs/[id]/contact'

type Options = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
let tokens = 0

type Answer = { status: number; body: unknown }
let answers: Answer[] = []
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: { sent: true } }
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
})

beforeEach(() => {
  tokens = 0
  answers = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA')
  window.turnstile = {
    render: vi.fn((_container: HTMLElement, options: Options) => {
      options.callback(`example-token-${++tokens}`)
      return `widget-${tokens}`
    }),
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

const draw = () => render(<ContactRelayForm address="example-chess-club" region="Bayou Region" goesTo="club" />)
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: /Send message|Sending/ })
async function fill(values: { name?: string; email?: string; message?: string } = {}) {
  await act(async () => { field('Your name').focus() })
  fireEvent.change(field('Your name'), { target: { value: values.name ?? 'Player One' } })
  fireEvent.change(field('Your email'), { target: { value: values.email ?? 'player.one@example.org' } })
  fireEvent.change(field('Message'), { target: { value: values.message ?? 'Hello. When do you meet?' } })
}
const submit = async () => { await act(async () => { fireEvent.click(sendButton()) }) }
const statuses = () => screen.queryAllByRole('status').map((s) => s.textContent).filter(Boolean)

describe('an answer the form does not expect', () => {
  const unexpected: Array<[string, Answer, string]> = [
    ['a club that cannot be found', { status: 404, body: { error: 'Club not found' } }, 'Club not found'],
    ['a field the server refuses', { status: 400, body: { error: 'Some fields are missing or not valid.', fields: { email: 'Enter one email address, like name@example.org.' } } }, 'We couldn\'t send this. Try again later.'],
    ['a fault', { status: 500, body: { error: 'Internal error' } }, 'We couldn\'t send this. Try again later.'],
  ]
  for (const [label, answer, words] of unexpected) {
    it(`${label} is said once, keeps what was typed, leaves the form usable, and a later send goes and leaves nothing of it`, async () => {
      draw()
      await fill()
      answers = [answer]
      await submit()
      expect(statuses()).toEqual([words])
      expect(field('Your name').value).toBe('Player One')
      expect(field('Message').value).toBe('Hello. When do you meet?')
      expect(field('Your name').readOnly).toBe(false)
      expect(sendButton().textContent).toBe('Send message')
      expect(sendButton().getAttribute('aria-disabled')).not.toBe('true')
      // The next press goes, with a fresh token, and "Sent." is the only status once it is sent.
      await submit()
      expect(await screen.findByText('Sent.')).toBeTruthy()
      expect(statuses().filter((s) => s !== 'Sent.')).toEqual([])
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const [first, second] = fetchMock.mock.calls.map(([, init]) => (JSON.parse(init!.body as string) as { token: string }).token)
      expect(first).not.toBe(second)
    })
  }
})

describe('an answer with no words of its own', () => {
  // A fault page from the platform's edge is not the site's JSON: the visitor is told the plain words, never the fetch helper's own "Request failed (503)".
  for (const status of [502, 503, 504, 404, 403, 429]) {
    it(`a ${status} with no error text in it is told as "We couldn't send this. Try again later."`, async () => {
      fetchMock.mockImplementationOnce(async () => new Response('<html>Bad gateway</html>', { status, headers: { 'Content-Type': 'text/html' } }))
      draw()
      await fill()
      await submit()
      expect(statuses()).toEqual(['We couldn\'t send this. Try again later.'])
      expect(field('Message').value).toBe('Hello. When do you meet?')
    })
  }
})

describe('the server\'s own words', () => {
  it('the club\'s limit and the place\'s limit reach the visitor as the server wrote them, and the limiter\'s refusal to count too', async () => {
    const words = [
      'This club has had too many messages this hour. Try again in an hour.',
      'Too many messages from here. Try again in an hour.',
    ]
    draw()
    await fill()
    for (const message of words) {
      answers = [{ status: 429, body: { error: message } }]
      await submit()
      expect(statuses()).toEqual([message])
    }
    answers = [{ status: 503, body: { error: 'We can\'t send this right now.' } }]
    await submit()
    expect(statuses()).toEqual(['We can\'t send this right now.'])
  })

  it('a 403 with the spam check\'s words is told as the spam check\'s failure, never in those words, which say nothing about why', async () => {
    draw()
    await fill()
    answers = [{ status: 403, body: { error: CANT_SEND_NOW } }]
    await submit()
    expect(statuses()).toEqual(['The spam check didn\'t pass. Try it again, then send.'])
  })

  it('the endpoint\'s switched-off 403 is told in its own words, never as a failed spam check, however often it is sent', async () => {
    draw()
    await fill()
    for (let i = 0; i < 2; i++) {
      answers = [{ status: 403, body: { error: CONTACT_CLOSED } }]
      await submit()
      expect(statuses()).toEqual([CONTACT_CLOSED])
    }
    expect(screen.queryByText(/spam check/i)).toBeNull()
    expect(field('Message').value).toBe('Hello. When do you meet?')
  })
})

describe('the keyboard', () => {
  it('moves from the line\'s question mark to the name, the address, the message and Send message, in that order, with no control hidden or out of reach', async () => {
    const { container } = draw()
    await fill()
    const tabbable = [...container.querySelectorAll<HTMLElement>('input, textarea, button, a[href], [tabindex]:not([tabindex="-1"])')]
      .filter((el) => !el.closest('[hidden]') && !(el as HTMLInputElement).disabled)
    const names = tabbable.map((el) => el.getAttribute('aria-label') ?? el.id ?? el.textContent)
    const at = (matcher: (el: HTMLElement) => boolean) => tabbable.findIndex(matcher)
    const order = [
      at((el) => el === screen.getByRole('button', { name: 'Help: Where your message goes' })),
      at((el) => el === field('Your name')),
      at((el) => el === field('Your email')),
      at((el) => el === field('Message')),
      at((el) => el === sendButton()),
    ]
    expect(order.every((i) => i >= 0), JSON.stringify(names)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    // No positive tabindex anywhere: the order is the page's own.
    expect(container.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([tabindex="0"])')).toHaveLength(0)
  })
})

describe('one send for one submit', () => {
  it('a submit of the form itself, however many, goes once while it sends', async () => {
    let release: (r: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve }))
    const { container } = draw()
    await fill()
    const form = container.querySelector('form')!
    await act(async () => { fireEvent.submit(form) })
    await act(async () => { fireEvent.submit(form) })
    await act(async () => { fireEvent.submit(form) })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => { release(new Response('{"sent":true}', { status: 200 })) })
    expect(await screen.findByText('Sent.')).toBeTruthy()
    // After Sent. a submit of the form that is gone sends nothing.
    expect(container.querySelector('form')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a form taken off the page while it sends raises no fault when the answer comes', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    let release: (r: Response) => void = () => {}
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { release = resolve }))
    const view = draw()
    await fill()
    await submit()
    view.unmount()
    await act(async () => { release(new Response('{"sent":true}', { status: 200 })) })
    expect(errors).not.toHaveBeenCalled()
  })

  it('the check that keeps a focused control clear of the bars leaves alone a page that has gone by the time it runs', () => {
    vi.useFakeTimers()
    try {
      const scrollBy = vi.fn()
      vi.stubGlobal('scrollBy', scrollBy)
      // A page with no window of its own, as a page is once it has been left or a test's page taken down.
      const gone = document.implementation.createHTMLDocument('Example page')
      const button = gone.createElement('button')
      gone.body.appendChild(button)
      expect(gone.defaultView).toBeNull()
      keepFocusClearOfBars(button)
      expect(() => vi.advanceTimersByTime(DOCK_SETTLES_MS)).not.toThrow()
      // A control of this page, focused, whose page's globals are taken away before the check runs, as a test's are.
      const here = document.createElement('button')
      document.body.appendChild(here)
      here.focus()
      keepFocusClearOfBars(here)
      vi.stubGlobal('document', undefined)
      try {
        expect(() => vi.advanceTimersByTime(DOCK_SETTLES_MS)).not.toThrow()
      } finally {
        vi.stubGlobal('document', here.ownerDocument)
      }
      here.remove()
      expect(scrollBy).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('the caps', () => {
  it('a name of 100 characters and a message of 5,000 go, one more of either is refused beside its field with nothing sent', async () => {
    draw()
    await fill({ name: 'P'.repeat(100), message: 'M'.repeat(5000) })
    await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await screen.findByText('Sent.')
    cleanup()

    draw()
    await fill({ name: 'P'.repeat(101), message: 'M'.repeat(5001) })
    await submit()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(document.getElementById(field('Your name').getAttribute('aria-describedby')!)!.textContent).toBe('Your name can be at most 100 characters.')
    expect(document.getElementById(field('Message').getAttribute('aria-describedby')!)!.textContent).toBe('Your message can be at most 5,000 characters.')
    await waitFor(() => expect(document.activeElement).toBe(field('Your name')))
  })

  it('markup typed into any field is sent as text and drawn nowhere as markup', async () => {
    const { container } = draw()
    await fill({ name: '<b>Player</b>', message: '<img src=x onerror=alert(1)>' })
    await submit()
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as { name: string; message: string }
    expect(body.name).toBe('<b>Player</b>')
    expect(body.message).toBe('<img src=x onerror=alert(1)>')
    await screen.findByText('Sent.')
    expect(container.querySelector('b, img')).toBeNull()
    expect(container.innerHTML).not.toContain('onerror')
  })
})
