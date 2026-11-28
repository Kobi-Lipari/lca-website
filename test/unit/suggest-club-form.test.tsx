// @vitest-environment jsdom
//
// Suggest a club and Start a club (WS09's thirtieth step): the page at
// /clubs/suggest (src/pages/SuggestClubPage.tsx) and its one form with a
// switch (src/areas/clubs/components/SuggestClubForm.tsx). The switch is two
// filter chips told by aria-pressed, exactly one pressed; each side has an
// address of its own, and the heading and the document's title follow it;
// every field has a visible label in the frame's words; an empty send is
// refused in words beside each field with the focus on the first; a refusal
// from the server is said in words and keeps what was typed; once sent the
// form gives way to one sentence with the focus on it, true wherever it went;
// the page names no region, no seat and no person. The server is played by a
// stub of fetch and the spam check's script by a stand-in on the window.
// Every name and address is made up.
import { useEffect } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SuggestClubPage } from '@/pages/SuggestClubPage'
import { SWITCH_HELP } from '@/areas/clubs/suggestClub'
import { REGIONS } from '@domain/clubs/regions'
import {
  CLUB_REQUEST_FIELD_WORDS as WORDS, CLUB_REQUEST_LABELS as LABELS, CLUB_REQUEST_SENT, CLUB_REQUEST_TITLES,
} from '@domain/clubs/newClub'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const ROOT = resolve(__dirname, '../..')
const TEST_SITE_KEY = '1x00000000000000000000AA'
type Options = { callback: (token: string) => void }
let tokens = 0
let giveToken = true
function standIn() {
  return {
    render: vi.fn((_container: HTMLElement, options: Options) => {
      if (giveToken) options.callback(`example-token-${++tokens}`)
      return `widget-${tokens}`
    }),
    remove: vi.fn(),
  }
}

type Answer = { status: number; body: unknown }
let answers: Answer[] = []
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: { sent: true } }
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
})

beforeEach(() => {
  tokens = 0
  giveToken = true
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

/** Where the page's address stands after each draw. */
const seen = { where: '' }
function Where() {
  const location = useLocation()
  useEffect(() => { seen.where = `${location.pathname}${location.search}` })
  return null
}

async function draw(path = '/clubs/suggest') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clubs/suggest" element={<><SuggestClubPage /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
}

const chip = (label: string) => within(screen.getByRole('group', { name: 'I\'d like to' })).getByRole('button', { name: label })
const pressed = () => Object.values(CLUB_REQUEST_TITLES).filter((title) => chip(title).getAttribute('aria-pressed') === 'true')
const heading = () => screen.getByRole('heading', { level: 1 }).textContent
const send = () => screen.getByRole('button', { name: /^(Send to LCA|Sending)/ })

async function fill(kind: 'new_club' | 'start_club' = 'new_club') {
  fireEvent.change(screen.getByLabelText(LABELS.clubName), { target: { value: 'Example Knights Club' } })
  fireEvent.change(screen.getByLabelText(LABELS.place), { target: { value: '70791' } })
  fireEvent.change(screen.getByLabelText(LABELS.message[kind]), { target: { value: 'Tuesdays at 7:00 PM at the Example Library.' } })
  fireEvent.change(screen.getByLabelText(LABELS.name), { target: { value: 'Player One' } })
  fireEvent.change(screen.getByLabelText(LABELS.email), { target: { value: 'player.one@example.org' } })
  await act(async () => {})
}

describe('the switch', () => {
  it('opens Suggest a club at /clubs/suggest, with exactly one side pressed and told by aria-pressed, and the heading and title its own', async () => {
    await draw()
    expect(pressed()).toEqual(['Suggest a club'])
    expect(chip('Start a club').getAttribute('aria-pressed')).toBe('false')
    expect(heading()).toBe('Suggest a club')
    expect(document.title).toBe('Suggest a club | Louisiana Chess Association')
    expect(screen.getByLabelText(LABELS.message.new_club).tagName).toBe('TEXTAREA')
  })

  it('opens Start a club at /clubs/suggest?kind=start, its own address', async () => {
    await draw('/clubs/suggest?kind=start')
    expect(pressed()).toEqual(['Start a club'])
    expect(heading()).toBe('Start a club')
    expect(document.title).toBe('Start a club | Louisiana Chess Association')
    expect(screen.getByLabelText(LABELS.message.start_club)).toBeTruthy()
  })

  it('moves the address, the heading and the title with a press, keeps what was typed, and never lets a press unchoose', async () => {
    await draw()
    fireEvent.change(screen.getByLabelText(LABELS.clubName), { target: { value: 'Example Knights Club' } })
    fireEvent.click(chip('Start a club'))
    await act(async () => {})
    expect(seen.where).toBe('/clubs/suggest?kind=start')
    expect(heading()).toBe('Start a club')
    expect(document.title).toBe('Start a club | Louisiana Chess Association')
    expect((screen.getByLabelText(LABELS.clubName) as HTMLInputElement).value).toBe('Example Knights Club')
    fireEvent.click(chip('Start a club'))
    expect(pressed()).toEqual(['Start a club'])
    fireEvent.click(chip('Suggest a club'))
    await act(async () => {})
    expect(seen.where).toBe('/clubs/suggest')
    expect(pressed()).toEqual(['Suggest a club'])
  })

  it('holds its words behind one small question mark beside the switch, and nothing explains beside a control', async () => {
    await draw()
    const mark = screen.getByRole('button', { name: 'Help: Suggest a club or start one' })
    expect(mark.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(mark)
    for (const [, words] of SWITCH_HELP) expect(screen.getByText(words)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Help: / })).toHaveLength(1)
  })
})

describe('the fields', () => {
  it('gives every field a visible label in the frame\'s words, and the email box is an email box', async () => {
    await draw()
    for (const label of [LABELS.clubName, LABELS.place, LABELS.message.new_club, LABELS.name, LABELS.email]) {
      const box = screen.getByLabelText(label)
      expect(document.querySelector(`label[for="${box.id}"]`)?.textContent).toBe(label)
    }
    expect((screen.getByLabelText('Your email (stays private)') as HTMLInputElement).type).toBe('email')
    expect(send().textContent).toBe('Send to LCA')
  })

  it('refuses an empty send in words beside each field, with the focus on the first, and sends nothing', async () => {
    await draw()
    fireEvent.click(send())
    await act(async () => {})
    for (const [label, words] of [
      [LABELS.clubName, WORDS.clubNameMissing], [LABELS.place, WORDS.placeMissing], [LABELS.message.new_club, WORDS.messageMissing],
      [LABELS.name, WORDS.nameMissing], [LABELS.email, WORDS.emailMissing],
    ] as const) {
      const box = screen.getByLabelText(label)
      expect(box.getAttribute('aria-invalid'), label).toBe('true')
      expect(document.getElementById(box.getAttribute('aria-describedby')!)?.textContent, label).toBe(words)
    }
    expect(document.activeElement).toBe(screen.getByLabelText(LABELS.clubName))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('says so in words and sends nothing while the spam check has given no token', async () => {
    giveToken = false
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText('Wait for the spam check to finish, then send.')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('sending', () => {
  it.each(['new_club', 'start_club'] as const)('%s: sends the five fields, the kind and the token, then one sentence true wherever it went, with the focus on it', async (kind) => {
    await draw(kind === 'start_club' ? '/clubs/suggest?kind=start' : '/clubs/suggest')
    await fill(kind)
    fireEvent.click(send())
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/clubs/reports')
    expect(JSON.parse(String(init?.body))).toEqual({
      kind, clubName: 'Example Knights Club', place: '70791', message: 'Tuesdays at 7:00 PM at the Example Library.', name: 'Player One',
      email: 'player.one@example.org', token: 'example-token-1',
    })
    const sentence = screen.getByText(CLUB_REQUEST_SENT[kind])
    expect(document.activeElement).toBe(sentence)
    expect(screen.queryByRole('button', { name: 'Send to LCA' })).toBeNull()
    // Who keeps what is not for the public: the page names no region, no seat and no person.
    const text = document.body.textContent ?? ''
    for (const region of REGIONS) expect(text).not.toContain(region)
    for (const word of ['representative', 'seat', 'Player One']) expect(text).not.toContain(word)
  })

  it('says the limit\'s refusal in words above the button and keeps everything typed', async () => {
    answers = [{ status: 429, body: { error: 'Too many messages from here. Try again in an hour.' } }]
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText('Too many messages from here. Try again in an hour.')).toBeTruthy()
    expect((screen.getByLabelText(LABELS.email) as HTMLInputElement).value).toBe('player.one@example.org')
    expect((screen.getByLabelText(LABELS.message.new_club) as HTMLTextAreaElement).value).toBe('Tuesdays at 7:00 PM at the Example Library.')
  })

  it('says a refused spam check in its own words, and draws the check afresh for a new token', async () => {
    answers = [{ status: 403, body: { error: 'We can\'t send this right now.' } }]
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText('The spam check didn\'t pass. Try it again, then send.')).toBeTruthy()
    // The check is drawn afresh once its script's promise settles, a moment after the words show.
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalledTimes(2))
  })
})

describe('the route', () => {
  it('is fetched the first time it is opened, behind newClubs, and adds only its route to the site\'s script', () => {
    const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')
    expect(app).toContain('const SuggestClubPage = lazy(() => import(\'@/pages/SuggestClubPage\').then(m => ({ default: m.SuggestClubPage })))')
    expect(app).toContain('{FEATURES.newClubs && <Route path="/clubs/suggest" element={<SuggestClubPage />} />}')
    expect(app).not.toMatch(/^import .*SuggestClub/m)
  })
})
