// @vitest-environment jsdom
//
// Ask to be its named rep (WS09's thirty-first step): the sheet
// (src/areas/clubs/components/RepRequestSheet.tsx) and its one way in on the
// club's page (RepRequestLink.tsx). The invitation is drawn only with
// clubPagesOn() and only while the page's answer says the club has no named
// rep; signed out the sheet says one sentence with "Log in to ask", which
// goes to the login page with the way back to this club's page, and "Not
// now"; signed in it asks "How are you connected to the club?" with the four
// answers as filter chips told by aria-pressed, none pressed at first and
// exactly one once a person presses, refuses a send with none in words
// beside the group, has the optional note with a visible label, says a
// refusal from the server once in its one status, sends once at a time, and
// once sent gives the focus to a sentence naming no person, region or seat.
// Escape and Close shut it and the focus goes back to the invitation;
// nothing is kept in the browser's storage. The server is played by a stub
// of fetch. Every name and address is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { RepRequestSheet } from '@/areas/clubs/components/RepRequestSheet'
import {
  REP_CONNECTIONS, REP_CONNECTION_QUESTION, REP_INVITE_LINK, REP_LOG_IN, REP_NOTE_LABEL, REP_NOT_NOW, REP_REQUEST_FIELD_WORDS, REP_REQUEST_HAS_REP, REP_REQUEST_SENT,
  REP_SEND, REP_SIGNED_OUT_LINE,
} from '@domain/clubs/repRequest'
import type { ClubPageResponse } from '@domain/contracts'
import { bareAnswer } from './helpers/clubPageAnswer'

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
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

type Answer = { status: number; body: unknown } | 'hold'
let answers: Answer[] = []
let release: (() => void) | null = null
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => {
  const next = answers.shift() ?? { status: 200, body: { sent: true } }
  if (next === 'hold') {
    await new Promise<void>((resolve) => { release = resolve })
    return new Response(JSON.stringify({ sent: true }), { status: 200 })
  }
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
})

beforeEach(() => {
  answers = []
  release = null
  flags.newClubs = false
  flags.newLook = false
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  window.localStorage.clear()
  window.sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const SIGNED_IN = { user: { id: 'm-1' }, role: 'member', member: { id: 'm-1', role: 'member' }, managedClubs: [] } as unknown as AuthContextValue
const SIGNED_OUT = { user: null, role: 'member', member: null, managedClubs: [] } as unknown as AuthContextValue

/** Where the login link took the page, and the way back it carried. */
function Login() {
  const location = useLocation()
  return <p>Login page, back to {(location.state as { from?: string } | null)?.from}</p>
}

function drawSheet(auth: AuthContextValue = SIGNED_IN, onClose = vi.fn()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/clubs/example-knights-club']}>
        <Routes>
          <Route path="/clubs/:slug" element={<RepRequestSheet open onClose={onClose} clubName="Example Knights Club" address="example-knights-club" />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return onClose
}
const dialog = () => screen.getByRole('dialog', { name: 'Ask to be Example Knights Club\'s named rep' })
const chip = (label: string) => within(dialog()).getByRole('button', { name: label })

describe('signed out', () => {
  it('says one sentence, with Log in to ask, which carries the way back to this club\'s page, and Not now, which shuts it', async () => {
    const onClose = drawSheet(SIGNED_OUT)
    expect(within(dialog()).getByText(REP_SIGNED_OUT_LINE)).toBeTruthy()
    expect(within(dialog()).queryByRole('group')).toBeNull()
    fireEvent.click(within(dialog()).getByRole('button', { name: REP_NOT_NOW }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(within(dialog()).getByRole('link', { name: REP_LOG_IN }))
    expect(await screen.findByText('Login page, back to /clubs/example-knights-club')).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('signed in', () => {
  it('asks the question with four chips, none pressed, and the optional note with a visible label', () => {
    drawSheet()
    const group = within(dialog()).getByRole('group', { name: REP_CONNECTION_QUESTION })
    const chips = within(group).getAllByRole('button')
    expect(chips.map((b) => b.textContent?.trim())).toEqual(REP_CONNECTIONS.map((c) => c.label))
    for (const b of chips) expect(b.getAttribute('aria-pressed')).toBe('false')
    expect(within(dialog()).getByLabelText(REP_NOTE_LABEL).tagName).toBe('TEXTAREA')
    expect(within(dialog()).getByRole('button', { name: REP_SEND })).toBeTruthy()
    expect(within(dialog()).getByRole('button', { name: /What happens next/ })).toBeTruthy()
  })

  it('refuses a send with no answer chosen in words beside the group, with the focus on the first chip, and sends nothing', async () => {
    drawSheet()
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: REP_SEND })) })
    expect(within(dialog()).getByText(REP_REQUEST_FIELD_WORDS.connectionMissing)).toBeTruthy()
    expect(document.activeElement).toBe(chip(REP_CONNECTIONS[0].label))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('presses exactly one chip, sends the connection and the note alone, signed in, and gives the focus to the sent sentence', async () => {
    drawSheet()
    fireEvent.click(chip('I help run it'))
    fireEvent.click(chip('Something else'))
    const pressed = within(dialog()).getAllByRole('button', { pressed: true })
    expect(pressed.map((b) => b.textContent?.trim())).toEqual(['Something else'])
    fireEvent.change(within(dialog()).getByLabelText(REP_NOTE_LABEL), { target: { value: '  I keep the club\'s calendar.  ' } })
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: REP_SEND })) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/clubs/example-knights-club/rep-requests')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ connection: 'other', note: 'I keep the club\'s calendar.' })
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-example')
    const sent = await within(dialog()).findByText(REP_REQUEST_SENT)
    await waitFor(() => expect(document.activeElement).toBe(sent))
    expect(within(dialog()).getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(REP_REQUEST_SENT).not.toMatch(/representative|region|seat|admins/)
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0)
  })

  it('says a refusal once in its one status, keeps what was chosen, and sends once at a time', async () => {
    drawSheet()
    answers = [{ status: 409, body: { error: REP_REQUEST_HAS_REP } }]
    fireEvent.click(chip('I run it'))
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: REP_SEND })) })
    await waitFor(() => expect(within(dialog()).getAllByRole('status').map((s) => s.textContent)).toContain(REP_REQUEST_HAS_REP))
    expect(within(dialog()).getAllByText(REP_REQUEST_HAS_REP)).toHaveLength(1)
    expect(chip('I run it').getAttribute('aria-pressed')).toBe('true')
    answers = ['hold']
    const button = within(dialog()).getByRole('button', { name: REP_SEND })
    await act(async () => { fireEvent.click(button) })
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: 'Sending…' })) })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await act(async () => { release?.() })
    expect(await within(dialog()).findByText(REP_REQUEST_SENT)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stays open while a send is on its way: Close, Escape and a press outside do nothing, and Close works once it has ended', async () => {
    answers = ['hold']
    const onClose = drawSheet()
    fireEvent.click(chip('I run it'))
    await act(async () => { fireEvent.click(within(dialog()).getByRole('button', { name: REP_SEND })) })
    const close = within(dialog()).getByRole('button', { name: 'Close' })
    expect(close.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(close)
    fireEvent.keyDown(dialog(), { key: 'Escape' })
    fireEvent.pointerDown(document.body)
    fireEvent.click(document.body)
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { release?.() })
    await within(dialog()).findByText(REP_REQUEST_SENT)
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('the invitation on the club\'s page', () => {
  const page = (answer: ClubPageResponse, auth: AuthContextValue = SIGNED_IN) =>
    render(<AuthContext.Provider value={auth}><MemoryRouter><ClubPageView answer={answer} keeper={null} /></MemoryRouter></AuthContext.Provider>)
  const invite = () => screen.queryByRole('button', { name: REP_INVITE_LINK })

  it('is drawn only with clubPagesOn() and only while the club has no named rep', () => {
    page({ ...bareAnswer(), rep_wanted: true })
    expect(invite()).toBeNull()
    cleanup()
    flags.newClubs = true
    flags.newLook = true
    page({ ...bareAnswer(), rep_wanted: false })
    expect(invite()).toBeNull()
    cleanup()
    page(bareAnswer())
    expect(invite()).toBeNull()
    cleanup()
    page({ ...bareAnswer(), rep_wanted: true })
    expect(invite()).toBeTruthy()
    expect(invite()!.closest('p')?.textContent).toBe('Is this your club? Ask to be its named rep')
    // Its own line, before the foot line, and in no section.
    expect(invite()!.closest('section')).toBeNull()
    expect(invite()!.closest('[data-slot="rep-request-invite"]')?.nextElementSibling?.getAttribute('data-slot')).toBe('club-foot')
  })

  it('fetches the sheet on first open, keeps the focus inside it, and gives the focus back to the invitation', async () => {
    flags.newClubs = true
    flags.newLook = true
    page({ ...bareAnswer(), rep_wanted: true }, SIGNED_OUT)
    const opener = invite()!
    opener.focus()
    await act(async () => { fireEvent.click(opener) })
    const sheet = await screen.findByRole('dialog', { name: /^Ask to be / }, { timeout: 5000 })
    expect(sheet.contains(document.activeElement)).toBe(true)
    await act(async () => { fireEvent.keyDown(sheet, { key: 'Escape' }) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(invite())
  })
})
