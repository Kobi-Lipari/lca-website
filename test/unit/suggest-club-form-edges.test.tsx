// @vitest-environment jsdom
//
// The edges of the form of Suggest a club and Start a club (WS09's thirtieth
// step), beside suggest-club-form.test.tsx, which holds the main cases: an
// address that is not one of the two sides opens Suggest a club; a second
// press while a send is on its way sends nothing more; what is sent is
// trimmed; a send the server refuses for its body, or that never gets an
// answer, is said in words and keeps everything typed; an error beside a
// field goes when the field is changed; a send with only spaces is refused;
// the token is needed, and held once. The server is played by a stub of fetch
// and the spam check's script by a stand-in on the window. Every name and
// address is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SuggestClubPage } from '@/pages/SuggestClubPage'
import { CLUB_REQUEST_FIELD_WORDS as WORDS, CLUB_REQUEST_LABELS as LABELS, CLUB_REQUEST_LIMITS, CLUB_REQUEST_NOT_SENT, CLUB_REQUEST_SENT } from '@domain/clubs/newClub'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

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

let next: () => Promise<Response> = async () => Response.json({ sent: true })
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => next())

beforeEach(() => {
  tokens = 0
  giveToken = true
  next = async () => Response.json({ sent: true })
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA')
  window.turnstile = standIn()
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function draw(path = '/clubs/suggest') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clubs/suggest" element={<SuggestClubPage />} />
      </Routes>
    </MemoryRouter>,
  )
  await act(async () => {})
}

const chip = (label: string) => within(screen.getByRole('group', { name: 'I\'d like to' })).getByRole('button', { name: label })
const send = () => screen.getByRole('button', { name: /^(Send to LCA|Sending)/ })
const box = (label: string) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement

async function fill(values: Partial<Record<'clubName' | 'place' | 'message' | 'name' | 'email', string>> = {}) {
  const all = {
    clubName: 'Example Knights Club', place: '70791', message: 'Tuesdays at 7:00 PM at the Example Library.', name: 'Player One',
    email: 'player.one@example.org', ...values,
  }
  fireEvent.change(box(LABELS.clubName), { target: { value: all.clubName } })
  fireEvent.change(box(LABELS.place), { target: { value: all.place } })
  fireEvent.change(box(LABELS.message.new_club), { target: { value: all.message } })
  fireEvent.change(box(LABELS.name), { target: { value: all.name } })
  fireEvent.change(box(LABELS.email), { target: { value: all.email } })
  await act(async () => {})
}

describe('which side an address opens', () => {
  it.each(['/clubs/suggest?kind=bogus', '/clubs/suggest?kind=', '/clubs/suggest?kind=START', '/clubs/suggest?kind=new_club', '/clubs/suggest?other=start'])(
    '%s opens Suggest a club',
    async (path) => {
      await draw(path)
      expect(chip('Suggest a club').getAttribute('aria-pressed')).toBe('true')
      expect(chip('Start a club').getAttribute('aria-pressed')).toBe('false')
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Suggest a club')
    },
  )
})

describe('what is sent', () => {
  it('trims every part, and sends the side that was pressed', async () => {
    await draw()
    fireEvent.click(chip('Start a club'))
    await act(async () => {})
    fireEvent.change(box(LABELS.clubName), { target: { value: '  Example Knights Club  ' } })
    fireEvent.change(box(LABELS.place), { target: { value: ' 70791 ' } })
    fireEvent.change(box(LABELS.message.start_club), { target: { value: '\n Fridays at 6:30 PM \n' } })
    fireEvent.change(box(LABELS.name), { target: { value: ' Player One ' } })
    fireEvent.change(box(LABELS.email), { target: { value: ' player.one@example.org ' } })
    await act(async () => {})
    fireEvent.click(send())
    await act(async () => {})
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      kind: 'start_club', clubName: 'Example Knights Club', place: '70791', message: 'Fridays at 6:30 PM', name: 'Player One', email: 'player.one@example.org', token: 'example-token-1',
    })
    expect(screen.getByText(CLUB_REQUEST_SENT.start_club)).toBeTruthy()
  })

  it('sends nothing more for a second press while the first is on its way, and says it is sending', async () => {
    let finish: (r: Response) => void = () => {}
    next = () => new Promise<Response>((resolve) => { finish = resolve })
    await draw()
    await fill()
    fireEvent.click(send())
    fireEvent.click(send())
    fireEvent.submit(send().closest('form')!)
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(send().textContent).toBe('Sending…')
    expect(send().getAttribute('aria-disabled')).toBe('true')
    // The boxes are read only while it is sent, so nothing typed now is lost or sent twice.
    expect(box(LABELS.clubName).readOnly).toBe(true)
    await act(async () => { finish(Response.json({ sent: true })) })
    expect(screen.getByText(CLUB_REQUEST_SENT.new_club)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('leaves the form\'s boxes empty and keeps nothing in the browser\'s storage once sent', async () => {
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
    expect(document.body.textContent).not.toContain('player.one@example.org')
  })

  it('draws the form again, empty, when the other side is opened by a link after sending, and not the sentence again on the way back', async () => {
    render(
      <MemoryRouter initialEntries={['/clubs/suggest']}>
        <Link to="/clubs/suggest?kind=start">Example link to the other side</Link>
        <Routes>
          <Route path="/clubs/suggest" element={<SuggestClubPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await act(async () => {})
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText(CLUB_REQUEST_SENT.new_club)).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Example link to the other side' }))
    await act(async () => {})
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Start a club')
    expect(screen.queryByText(CLUB_REQUEST_SENT.new_club)).toBeNull()
    expect(screen.queryByText(CLUB_REQUEST_SENT.start_club)).toBeNull()
    expect(chip('Start a club').getAttribute('aria-pressed')).toBe('true')
    for (const label of [LABELS.clubName, LABELS.place, LABELS.message.start_club, LABELS.name, LABELS.email]) expect(box(label).value).toBe('')
    fireEvent.click(chip('Suggest a club'))
    await act(async () => {})
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Suggest a club')
    expect(screen.queryByText(CLUB_REQUEST_SENT.new_club)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('what is refused, in words', () => {
  it('says a body the server refused in the form\'s own words, keeps everything typed, and sends again once asked', async () => {
    next = async () => Response.json({ error: 'The request was not valid.' }, { status: 400 })
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText(CLUB_REQUEST_NOT_SENT)).toBeTruthy()
    expect(box(LABELS.place).value).toBe('70791')
    expect(box(LABELS.email).value).toBe('player.one@example.org')
    next = async () => Response.json({ sent: true })
    fireEvent.click(send())
    await act(async () => {})
    expect(fetchMock).toHaveBeenCalledTimes(2)
    // A token is good once: the second send carries a new one.
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).token).toBe('example-token-2')
    expect(screen.getByText(CLUB_REQUEST_SENT.new_club)).toBeTruthy()
  })

  it('says it in words when no answer comes, and when the server gives none of its own', async () => {
    next = async () => { throw new TypeError('network down') }
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText('We couldn\'t send this. Check your connection, then try again.')).toBeTruthy()
    next = async () => new Response('', { status: 500 })
    fireEvent.click(send())
    await act(async () => {})
    expect(screen.getByText(CLUB_REQUEST_NOT_SENT)).toBeTruthy()
    expect(box(LABELS.clubName).value).toBe('Example Knights Club')
  })

  it('says the server\'s own words for a busy hour and for a missing signing key', async () => {
    for (const [status, words] of [[429, 'Too many clubs have been suggested this hour. Try again in an hour.'], [503, 'We can\'t send this right now.']] as const) {
      cleanup()
      next = async () => Response.json({ error: words }, { status })
      await draw()
      await fill()
      fireEvent.click(send())
      await act(async () => {})
      expect(screen.getByText(words)).toBeTruthy()
    }
  })

  it('refuses a box of only spaces, in the field\'s words, and sends nothing', async () => {
    await draw()
    await fill({ clubName: '   ', place: '\t', message: ' \n ', name: '  ', email: ' ' })
    fireEvent.click(send())
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
    for (const words of [WORDS.clubNameMissing, WORDS.placeMissing, WORDS.messageMissing, WORDS.nameMissing, WORDS.emailMissing]) expect(screen.getByText(words)).toBeTruthy()
  })

  it('refuses a name or a place too long, and an address that is not one, beside their boxes', async () => {
    await draw()
    await fill({ place: 'y'.repeat(CLUB_REQUEST_LIMITS.place + 1), name: 'x'.repeat(CLUB_REQUEST_LIMITS.name + 1), email: 'two@example.org, three@example.org' })
    fireEvent.click(send())
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(WORDS.placeLong)).toBeTruthy()
    expect(screen.getByText(WORDS.nameLong)).toBeTruthy()
    expect(screen.getByText(WORDS.emailForm)).toBeTruthy()
    expect(box(LABELS.place).getAttribute('aria-invalid')).toBe('true')
    expect(box(LABELS.place).getAttribute('aria-describedby')).toBeTruthy()
  })

  it('takes an error away once its box is changed, and the focus goes to the first box that needs a change', async () => {
    await draw()
    fireEvent.click(send())
    await act(async () => {})
    expect(document.activeElement).toBe(box(LABELS.clubName))
    expect(screen.getByText(WORDS.clubNameMissing)).toBeTruthy()
    fireEvent.change(box(LABELS.clubName), { target: { value: 'Example Knights Club' } })
    expect(screen.queryByText(WORDS.clubNameMissing)).toBeNull()
    expect(screen.getByText(WORDS.placeMissing)).toBeTruthy()
  })

  it('says to wait while the spam check has given no token, once everything else is right, and sends nothing', async () => {
    giveToken = false
    await draw()
    await fill()
    fireEvent.click(send())
    await act(async () => {})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('Wait for the spam check to finish, then send.')).toBeTruthy()
  })

  it('draws every label as visible text tied to its box, and the box for an address as an email box with no spelling check', async () => {
    await draw()
    for (const label of [LABELS.clubName, LABELS.place, LABELS.message.new_club, LABELS.name, LABELS.email]) {
      const field = box(label)
      const tied = document.querySelector(`label[for="${field.id}"]`)
      expect(tied?.textContent, label).toBe(label)
    }
    expect(box(LABELS.email).type).toBe('email')
    expect(box(LABELS.email).getAttribute('spellcheck')).toBe('false')
  })
})

describe('the spam check failed, and a send on its way (WS09 checkpoint X\'s review)', () => {
  it('after the spam check has failed, a press of Send to LCA says to press Try again, never to wait', async () => {
    window.turnstile = { render: vi.fn((_container: HTMLElement, options: Options & { 'error-callback': () => void }) => { options['error-callback'](); return 'widget-failed' }), remove: vi.fn() }
    await draw()
    await fill()
    await screen.findByRole('button', { name: 'Try again' })
    await act(async () => { fireEvent.click(send()) })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText('The spam check didn\'t load, so this can\'t be sent yet. Press Try again.')).toBeTruthy()
    expect(screen.queryByText('Wait for the spam check to finish, then send.')).toBeNull()
  })

  it('a press of the two-way switch while a send is on its way does nothing, says so, and the sent sentence is the sent side\'s', async () => {
    let release: (r: Response) => void = () => {}
    next = () => new Promise<Response>((resolve) => { release = resolve })
    await draw()
    await fill()
    await act(async () => { fireEvent.click(send()) })
    expect(screen.getByRole('group', { name: 'I\'d like to' }).getAttribute('aria-disabled')).toBe('true')
    await act(async () => { fireEvent.click(chip('Start a club')) })
    expect(chip('Suggest a club').getAttribute('aria-pressed')).toBe('true')
    await act(async () => { release(Response.json({ sent: true })) })
    // The sent sentence is Suggest a club's, the side that was sent; had the press moved the switch it would be gone.
    expect(await screen.findByText(CLUB_REQUEST_SENT.new_club)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { kind: string }).kind).toBe('new_club')
  })
})
