// @vitest-environment jsdom
//
// Where the club page's Contact form says a refusal (src/areas/clubs/components/ContactRelayForm.tsx):
// the form's one status stands between the spam check and Send message, so on a phone, where the
// phone bar sits just under the button, the words are in sight wherever the button a person pressed
// is; a refusal fills it and asks once for it to be brought clear of the bars
// (bringClearOfBars in src/areas/clubs/clubPage.ts, the measure keepFocusClearOfBars makes), with the
// focus left on the button, which is kept clear first; the words under the spam check are brought
// into sight the same way and said by a status of their own; "Sent." asks nothing; and while
// either is empty it takes no room. The server
// is played by a stub of fetch and the provider's script by a stand-in on the window. Every name
// and address is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactRelayForm } from '@/areas/clubs/components/ContactRelayForm'
import * as clubPage from '@/areas/clubs/clubPage'
import { CANT_SEND_NOW } from '../../functions/utils/rateLimit'

vi.mock('@/areas/clubs/clubPage', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/areas/clubs/clubPage')>()
  return { ...real, bringClearOfBars: vi.fn(real.bringClearOfBars), keepFocusClearOfBars: vi.fn(real.keepFocusClearOfBars) }
})
const asked = vi.mocked(clubPage.bringClearOfBars)
const kept = vi.mocked(clubPage.keepFocusClearOfBars)
const TOO_MANY = 'Too many messages from here. Try again in an hour.'

type Options = { callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
let tokens = 0
let boxes: HTMLElement[] = []

type Answer = { status: number; body: string; type?: string }
let answers: Answer[] = []
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: '{"sent":true}' }
  return new Response(next.body, { status: next.status, headers: { 'Content-Type': next.type ?? 'application/json' } })
})

beforeEach(() => {
  tokens = 0
  boxes = []
  answers = []
  fetchMock.mockClear()
  asked.mockClear()
  kept.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA')
  window.turnstile = {
    render: vi.fn((container: HTMLElement, options: Options) => {
      boxes.push(container)
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
})

const draw = () => render(<ContactRelayForm address="example-chess-club" region="Bayou Region" goesTo="club" />)
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
const sendButton = () => screen.getByRole('button', { name: /Send message|Sending/ })
/** The form's own status, by its fixed id (the spam check keeps a status of its own for its own words). */
const formStatus = () => document.getElementById('club-contact-status') as HTMLParagraphElement
/** The words under the spam check, by their fixed id. */
const waitLine = () => document.getElementById('club-contact-token-error') as HTMLParagraphElement
async function fill() {
  await act(async () => { field('Your name').focus() })
  fireEvent.change(field('Your name'), { target: { value: 'Player One' } })
  fireEvent.change(field('Your email'), { target: { value: 'player.one@example.org' } })
  fireEvent.change(field('Message'), { target: { value: 'Hello. When do you meet?' } })
}
/** A press of Send message as a keyboard user makes it: the focus is on the button. */
async function press() {
  await act(async () => { sendButton().focus() })
  await act(async () => { fireEvent.click(sendButton()) })
}
const before = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('the place of the form\'s status', () => {
  it('stands after the spam check and before Send message, one status with role="status", the button described as before', async () => {
    draw()
    await fill()
    const status = formStatus()
    expect(status.getAttribute('role')).toBe('status')
    expect(boxes).toHaveLength(1)
    expect(before(boxes[0], status)).toBe(true)
    expect(before(status, sendButton())).toBe(true)
    // Nothing the keyboard reaches lies between the words and the button.
    expect(status.nextElementSibling).toBe(sendButton())
    expect(sendButton().getAttribute('aria-describedby')).toBeNull()
    expect(document.querySelectorAll('#club-contact-status')).toHaveLength(1)
  })

  it('the words under the spam check stand between it and the status, Send message is described by them, and they are asked into sight once', async () => {
    window.turnstile = { render: vi.fn((container: HTMLElement) => { boxes.push(container); return 'widget-quiet' }), remove: vi.fn() }
    draw()
    await fill()
    await press()
    const words = screen.getByText('Wait for the spam check to finish, then send.')
    expect(before(boxes[0], words)).toBe(true)
    expect(before(words, formStatus())).toBe(true)
    expect(document.getElementById(sendButton().getAttribute('aria-describedby')!)).toBe(words)
    expect(fetchMock).not.toHaveBeenCalled()
    // They push the button down as a refusal does: they are brought into sight, and the empty status is not.
    expect(asked).toHaveBeenCalledTimes(1)
    expect(asked).toHaveBeenCalledWith(words)
    expect(document.activeElement).toBe(sendButton())
  })

  it('the words under the spam check are said by a status of their own, in the page, empty, from the moment the form is used', async () => {
    window.turnstile = { render: vi.fn((container: HTMLElement) => { boxes.push(container); return 'widget-quiet' }), remove: vi.fn() }
    draw()
    await fill()
    const line = waitLine()
    expect(line.getAttribute('role')).toBe('status')
    expect(line.textContent).toBe('')
    expect(sendButton().getAttribute('aria-describedby')).toBeNull()
    await press()
    // The same element, there before the press, so a screen reader hears the words when they come.
    expect(waitLine()).toBe(line)
    expect(line.textContent).toBe('Wait for the spam check to finish, then send.')
    expect(screen.getAllByRole('status').filter((s) => s.textContent).map((s) => s.textContent)).toEqual(['Wait for the spam check to finish, then send.'])
    expect(sendButton().getAttribute('aria-describedby')).toBe('club-contact-token-error')
  })

  it('empty, it holds no words and no room: no margin, no height of its own, and no spacing class on its wrapper (jsdom draws no boxes, so the classes are held)', async () => {
    draw()
    await fill()
    const roomless = /\b(m[tbyxse]?-|p[tbyxse]?-|min-h-|h-)\d/
    for (const line of [formStatus(), waitLine()]) {
      expect(line.textContent).toBe('')
      expect(line.className).not.toMatch(roomless)
      // A wrapper that spaces its children would give the empty line a margin, and push Send message down.
      expect(line.parentElement!.className).not.toMatch(/\bspace-y-/)
    }
    expect(formStatus().className).toBe('break-words text-sm font-semibold text-ink')
  })
})

describe('a refusal, brought into sight', () => {
  const refusals: Array<[string, Answer, string]> = [
    ['the sixth in an hour (429)', { status: 429, body: JSON.stringify({ error: 'Too many messages from here. Try again in an hour.' }) }, 'Too many messages from here. Try again in an hour.'],
    ['the spam check\'s no (403)', { status: 403, body: JSON.stringify({ error: CANT_SEND_NOW }) }, 'The spam check didn\'t pass. Try it again, then send.'],
    ['a 503 with no words of its own', { status: 503, body: '<html>Bad gateway</html>', type: 'text/html' }, 'We couldn\'t send this. Try again later.'],
  ]
  for (const [label, answer, words] of refusals) {
    it(`${label} fills the status with its words, in the form's ink, asks once for it to be brought clear of the bars, and leaves the focus on the button`, async () => {
      draw()
      await fill()
      answers = [answer]
      await press()
      const status = formStatus()
      expect(status.textContent).toBe(words)
      expect(status.className).toMatch(/\btext-ink\b/)
      expect(status.className).toMatch(/\bfont-semibold\b/)
      expect(status.className).not.toMatch(/destructive|text-red|text-gold/)
      expect(status.className).toMatch(/\bmb-2\b/)
      expect(asked).toHaveBeenCalledTimes(1)
      expect(asked).toHaveBeenCalledWith(status)
      expect(document.activeElement).toBe(sendButton())
      expect(sendButton().getAttribute('aria-describedby')).toBeNull()
    })
  }

  it('the same refusal again is emptied while the send runs, so it is heard again, and brought into sight again, once for each', async () => {
    draw()
    await fill()
    answers = [{ status: 429, body: JSON.stringify({ error: TOO_MANY }) }]
    await press()
    expect(formStatus().textContent).toBe(TOO_MANY)
    expect(asked).toHaveBeenCalledTimes(1)
    // The second send is held until the test lets its answer come.
    let answer!: () => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => {
      answer = () => resolve(new Response(JSON.stringify({ error: TOO_MANY }), { status: 429, headers: { 'Content-Type': 'application/json' } }))
    }))
    await press()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(formStatus().textContent).toBe('')
    await act(async () => { answer() })
    expect(formStatus().textContent).toBe(TOO_MANY)
    expect(asked).toHaveBeenCalledTimes(2)
  })

  it('keeps the focused button clear of the bars first, then brings the words into sight; a button without the focus is not measured', async () => {
    draw()
    await fill()
    answers = [{ status: 429, body: JSON.stringify({ error: TOO_MANY }) }]
    await act(async () => { sendButton().focus() })
    kept.mockClear()
    await act(async () => { fireEvent.click(sendButton()) })
    expect(kept).toHaveBeenCalledTimes(1)
    expect(kept).toHaveBeenCalledWith(sendButton())
    expect(asked).toHaveBeenCalledTimes(1)
    expect(asked).toHaveBeenCalledWith(formStatus())
    expect(kept.mock.invocationCallOrder[0]).toBeLessThan(asked.mock.invocationCallOrder[0])
    // A press that leaves the button without the focus, as a tap may in some browsers: the words alone are measured.
    answers = [{ status: 429, body: JSON.stringify({ error: TOO_MANY }) }]
    await act(async () => { sendButton().blur() })
    kept.mockClear()
    await act(async () => { fireEvent.click(sendButton()) })
    expect(kept).not.toHaveBeenCalled()
    expect(asked).toHaveBeenCalledTimes(2)
    expect(asked).toHaveBeenLastCalledWith(formStatus())
  })

  it('a send that goes, and Sent., ask nothing', async () => {
    draw()
    await fill()
    await press()
    expect(await screen.findByText('Sent.')).toBeTruthy()
    expect(asked).not.toHaveBeenCalled()
    // A send that goes after a refusal asks nothing more for it.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Write another message' })) })
    await fill()
    answers = [{ status: 429, body: JSON.stringify({ error: 'Too many messages from here. Try again in an hour.' }) }]
    await press()
    expect(asked).toHaveBeenCalledTimes(1)
    await press()
    expect(await screen.findByText('Sent.')).toBeTruthy()
    expect(asked).toHaveBeenCalledTimes(1)
  })
})

describe('bringing words clear of the bars', () => {
  const settle = () => vi.advanceTimersByTime(clubPage.DOCK_SETTLES_MS)
  const real = async () => (await vi.importActual<typeof import('@/areas/clubs/clubPage')>('@/areas/clubs/clubPage')).bringClearOfBars

  it('moves the page by the least that shows words under the phone bar, under the section nav, or out of the window, whatever has the focus', async () => {
    const bring = await real()
    vi.useFakeTimers()
    try {
      const scrollBy = vi.fn()
      vi.stubGlobal('scrollBy', scrollBy)
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(844)
      document.documentElement.style.setProperty('--bottom-chrome-h', '118px')
      const nav = document.createElement('nav')
      nav.setAttribute('data-slot', 'club-section-nav')
      vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 53, height: 53 } as DOMRect)
      const words = document.createElement('p')
      document.body.append(nav, words)
      const box = vi.spyOn(words, 'getBoundingClientRect')
      // The window is 844 tall and the bar's top is at 726: words whose foot is at 744 are under it.
      box.mockReturnValue({ top: 724, bottom: 744, height: 20 } as DOMRect)
      bring(words)
      expect(scrollBy).not.toHaveBeenCalled()
      settle()
      expect(scrollBy).toHaveBeenCalledWith({ top: 744 - 726 + 8 })
      // Below the window altogether.
      scrollBy.mockClear()
      box.mockReturnValue({ top: 900, bottom: 920, height: 20 } as DOMRect)
      bring(words)
      settle()
      expect(scrollBy).toHaveBeenCalledWith({ top: 920 - 726 + 8 })
      // Under the stuck section row at the top.
      scrollBy.mockClear()
      box.mockReturnValue({ top: 30, bottom: 50, height: 20 } as DOMRect)
      bring(words)
      settle()
      expect(scrollBy).toHaveBeenCalledWith({ top: 30 - 53 - 8 })
      // Wholly in sight: left where it is.
      scrollBy.mockClear()
      box.mockReturnValue({ top: 400, bottom: 420, height: 20 } as DOMRect)
      bring(words)
      settle()
      expect(scrollBy).not.toHaveBeenCalled()
      // Words taken off the page before the dock settles are left alone.
      box.mockReturnValue({ top: 724, bottom: 744, height: 20 } as DOMRect)
      bring(words)
      words.remove()
      settle()
      expect(scrollBy).not.toHaveBeenCalled()
      nav.remove()
      document.documentElement.style.removeProperty('--bottom-chrome-h')
    } finally {
      vi.useRealTimers()
    }
  })
})
