// @vitest-environment jsdom
//
// Suggest an update (WS09's twenty-eighth step): the sheet
// (src/areas/clubs/components/SuggestUpdateSheet.tsx) and its two ways in on
// the club's page (SuggestUpdateLink.tsx). It opens from the told line and
// beside Contact and from nowhere else; its title names the club; the six
// choices are filter chips told by aria-pressed, none pressed at first and
// exactly one once a person presses; the text box and "Your email
// (optional)" have visible labels; the explaining words sit behind two small
// question marks; the send button is worded by where the suggestion goes and
// names nobody; a refusal is said in words above the button and keeps what
// was typed; one send at a time; the sent words take the focus; Escape and
// Close shut it and the focus goes back to the link that opened it; nothing
// is kept in the browser's storage. The server is played by a stub of fetch
// and the spam check's script by a stand-in on the window. Every name and
// address is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { SuggestUpdateSheet } from '@/areas/clubs/components/SuggestUpdateSheet'
import { SUGGESTION_CHOICES, SUGGESTION_FIELD_WORDS, SUGGESTION_SENT, suggestSendLabel } from '@domain/clubs/suggestion'
import type { ClubPageResponse } from '@domain/contracts'
import { bareAnswer } from './helpers/clubPageAnswer'

vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const TEST_SITE_KEY = '1x00000000000000000000AA'
type Options = { callback: (token: string) => void }
let tokens = 0
function standIn() {
  return {
    render: vi.fn((_container: HTMLElement, options: Options) => {
      options.callback(`example-token-${++tokens}`)
      return `widget-${tokens}`
    }),
    remove: vi.fn(),
  }
}

type Answer = { status: number; body: unknown } | 'offline' | 'hold'
let answers: Answer[] = []
let release: (() => void) | null = null
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: { sent: true } }
  if (next === 'offline') throw new TypeError('Failed to fetch')
  if (next === 'hold') {
    await new Promise<void>((resolve) => { release = resolve })
    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  }
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
})

beforeEach(() => {
  tokens = 0
  answers = []
  release = null
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

const drawSheet = (goesTo: 'club_rep' | 'region' | 'lca' = 'region', region: string | null = 'Lake Charles / Southwestern', onClose = vi.fn()) => {
  render(<SuggestUpdateSheet open onClose={onClose} clubName="Example Knights Club" address="example-knights-club" goesTo={goesTo} region={region} />)
  return onClose
}
const dialog = () => screen.getByRole('dialog', { name: 'Suggest an update to Example Knights Club' })
const chip = (label: string) => within(dialog()).getByRole('button', { name: label })
const sendButton = () => within(dialog()).getByRole('button', { name: /^Send to|Sending/ })
const pressed = () => SUGGESTION_CHOICES.filter((c) => chip(c.label).getAttribute('aria-pressed') === 'true').map((c) => c.label)

async function fill(words = 'The club meets at the Example Library now.', email = '') {
  fireEvent.click(chip('Venue or address'))
  fireEvent.change(within(dialog()).getByLabelText('Tell us what changed'), { target: { value: words } })
  if (email) fireEvent.change(within(dialog()).getByLabelText('Your email (optional)'), { target: { value: email } })
  await act(async () => {})
}

describe('the sheet', () => {
  it('is titled by the club, holds the six choices with none pressed, and labels each field it asks', async () => {
    drawSheet()
    expect(dialog()).toBeTruthy()
    expect(within(dialog()).getByRole('group', { name: 'What changed?' })).toBeTruthy()
    expect(pressed()).toEqual([])
    for (const choice of SUGGESTION_CHOICES) expect(chip(choice.label).getAttribute('aria-pressed')).toBe('false')
    expect(within(dialog()).getByText('Nothing chosen yet.')).toBeTruthy()
    expect(within(dialog()).getByLabelText('Tell us what changed').tagName).toBe('TEXTAREA')
    expect((within(dialog()).getByLabelText('Your email (optional)') as HTMLInputElement).type).toBe('email')
    // A visible Close of its own, 44 pixels tall; the dialog's own small mark is not drawn.
    const close = within(dialog()).getByRole('button', { name: 'Close' })
    expect(close.className).toContain('min-h-11')
    expect(within(dialog()).getAllByRole('button', { name: 'Close' })).toHaveLength(1)
  })

  it('presses exactly one choice at a time, tells it in words as well as by the chip, and never lets a press unchoose', async () => {
    drawSheet()
    fireEvent.click(chip('Contact'))
    expect(pressed()).toEqual(['Contact'])
    expect(within(dialog()).getByText('Chosen: Contact')).toBeTruthy()
    fireEvent.click(chip('The club has closed or moved'))
    expect(pressed()).toEqual(['The club has closed or moved'])
    fireEvent.click(chip('The club has closed or moved'))
    expect(pressed()).toEqual(['The club has closed or moved'])
  })

  it('words the send button by where it goes and names nobody, the longest region whole on its own lines', () => {
    for (const [goesTo, region, words] of [
      ['club_rep', 'North Louisiana', 'Send to the club\'s rep'],
      ['region', 'Lake Charles / Southwestern', 'Send to the Lake Charles / Southwestern representative'],
      ['lca', null, 'Send to LCA'],
    ] as const) {
      drawSheet(goesTo, region)
      expect(sendButton().textContent).toBe(words)
      expect(suggestSendLabel(goesTo, region)).toBe(words)
      // The button wraps rather than cutting its words at 320 pixels.
      expect(sendButton().className).toContain('whitespace-normal')
      cleanup()
    }
  })

  it('keeps its explaining words behind two small question marks, closed until pressed', async () => {
    drawSheet()
    const marks = within(dialog()).getAllByRole('button', { name: /^Help: / })
    expect(marks.map((m) => m.getAttribute('aria-label'))).toEqual(['Help: Your email (optional)', 'Help: What happens next'])
    for (const mark of marks) expect(mark.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(marks[0])
    expect(marks[0].getAttribute('aria-expanded')).toBe('true')
    const bubble = document.getElementById(marks[0].getAttribute('aria-controls')!)!
    expect(bubble.textContent).toContain('your address is shown to nobody')
    // One bubble at a time.
    fireEvent.click(marks[1])
    expect(marks[0].getAttribute('aria-expanded')).toBe('false')
    expect(marks[1].getAttribute('aria-expanded')).toBe('true')
  })

  it('refuses an empty send beside each part in words, with the focus on the first, and sends nothing', async () => {
    drawSheet()
    await act(async () => {})
    fireEvent.click(sendButton())
    await act(async () => {})
    expect(within(dialog()).getByText(SUGGESTION_FIELD_WORDS.fieldMissing)).toBeTruthy()
    expect(within(dialog()).getByText(SUGGESTION_FIELD_WORDS.messageMissing)).toBeTruthy()
    expect(document.activeElement).toBe(chip(SUGGESTION_CHOICES[0].label))
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(chip('Cost or who it\'s for'))
    fireEvent.change(within(dialog()).getByLabelText('Your email (optional)'), { target: { value: 'not an address' } })
    fireEvent.click(sendButton())
    await act(async () => {})
    expect(document.activeElement).toBe(within(dialog()).getByLabelText('Tell us what changed'))
  })

  it('sends the three parts and the token with no sign-in, once, saying so while it sends, then puts the focus on the sent words', async () => {
    answers = ['hold']
    drawSheet()
    await act(async () => {})
    await fill('Example words.', 'player.one@example.org')
    fireEvent.click(sendButton())
    fireEvent.click(sendButton())
    await act(async () => {})
    expect(sendButton().textContent).toBe('Sending…')
    expect(sendButton().getAttribute('aria-disabled')).toBe('true')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/clubs/example-knights-club/reports')
    expect(new Headers(init?.headers).get('Authorization')).toBeNull()
    expect(JSON.parse(String(init?.body))).toEqual({ field: 'venue', message: 'Example words.', email: 'player.one@example.org', token: 'example-token-1' })
    await act(async () => { release?.() })
    const sent = await within(dialog()).findByText(SUGGESTION_SENT)
    await waitFor(() => expect(document.activeElement).toBe(sent))
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('says a refusal in words above the send button, keeps what was typed, and draws the spam check afresh', async () => {
    for (const [answer, words] of [
      [{ status: 429, body: { error: 'Too many messages from here. Try again in an hour.' } }, 'Too many messages from here. Try again in an hour.'],
      [{ status: 403, body: { error: 'We can\'t send this right now.' } }, 'The spam check didn\'t pass. Try it again, then send.'],
      [{ status: 403, body: { error: 'Suggestions cannot be sent from the site yet.' } }, 'Suggestions cannot be sent from the site yet.'],
      ['offline', 'We couldn\'t send this. Check your connection, then try again.'],
    ] as const) {
      answers = [answer]
      drawSheet()
      await act(async () => {})
      await fill('Example words kept.', 'player.one@example.org')
      fireEvent.click(sendButton())
      const said = await within(dialog()).findByText(words)
      expect(said.getAttribute('role')).toBe('status')
      // Above the send button, in the page's order.
      expect(said.compareDocumentPosition(sendButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect((within(dialog()).getByLabelText('Tell us what changed') as HTMLTextAreaElement).value).toBe('Example words kept.')
      expect((within(dialog()).getByLabelText('Your email (optional)') as HTMLInputElement).value).toBe('player.one@example.org')
      expect(pressed()).toEqual(['Venue or address'])
      // The check is drawn afresh once its script's promise settles, a moment after the words show.
      await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalledTimes(2))
      cleanup()
      window.turnstile = standIn()
    }
    expect(localStorage.length).toBe(0)
  })

  it('shuts on Escape and on Close, telling the page so', async () => {
    const onClose = drawSheet()
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    cleanup()
    const again = drawSheet()
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(again).toHaveBeenCalledTimes(1)
  })

  it('stays open while a send is on its way: Close, Escape and a press outside do nothing, and Close works once it has ended', async () => {
    answers = ['hold']
    const onClose = drawSheet()
    await act(async () => {})
    await fill()
    fireEvent.click(sendButton())
    await act(async () => {})
    const close = within(dialog()).getByRole('button', { name: 'Close' })
    expect(close.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(close)
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { release?.() })
    await within(dialog()).findByText(SUGGESTION_SENT)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('after the spam check has failed, a press of the send button says to press Try again, never to wait', async () => {
    window.turnstile = { render: vi.fn((_container: HTMLElement, options: Options & { 'error-callback': () => void }) => { options['error-callback'](); return 'widget-failed' }), remove: vi.fn() }
    drawSheet()
    await act(async () => {})
    await fill()
    await within(dialog()).findByRole('button', { name: 'Try again' })
    await act(async () => { fireEvent.click(sendButton()) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(within(dialog()).getByText('The spam check didn\'t load, so this can\'t be sent yet. Press Try again.')).toBeTruthy()
    expect(within(dialog()).queryByText('Wait for the spam check to finish, then send.')).toBeNull()
  })
})

describe('where it opens', () => {
  const page = (answer: ClubPageResponse = bareAnswer()) =>
    render(<MemoryRouter><ClubPageView answer={answer} keeper={null} /></MemoryRouter>)
  const links = () => screen.getAllByRole('button', { name: 'Suggest an update' })

  it('opens from the told line and beside Contact, and from nowhere else on the page, never from a block', async () => {
    page()
    expect(links()).toHaveLength(2)
    const [told, contact] = links()
    expect(told.closest('section')?.id).toBe('when-and-where')
    expect(told.previousElementSibling?.textContent).toBe(bareAnswer().statement.told)
    expect(contact.closest('section')?.id).toBe('contact')
    expect(contact.parentElement?.querySelector('h2')?.textContent).toContain('Contact')
    for (const id of ['about']) expect(document.getElementById(id)?.querySelector('[data-slot="suggest-update-link"]')).toBeNull()
  })

  it('opens from beside Contact alone when the answer gives no told line', () => {
    page({ ...bareAnswer(), statement: { ...bareAnswer().statement, told: '' } })
    expect(links()).toHaveLength(1)
    expect(links()[0].closest('section')?.id).toBe('contact')
  })

  it('fetches the sheet on first open, and puts the focus back on the link that opened it', async () => {
    page()
    for (const at of [0, 1]) {
      const opener = links()[at]
      opener.focus()
      await act(async () => { fireEvent.click(opener) })
      const sheet = await screen.findByRole('dialog', { name: /^Suggest an update to / }, { timeout: 5000 })
      expect(sheet.contains(document.activeElement)).toBe(true)
      expect(within(sheet).getByRole('button', { name: 'Send to the club\'s rep' })).toBeTruthy()
      await act(async () => { fireEvent.keyDown(sheet, { key: 'Escape' }) })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(links()[at])
    }
  })
})
