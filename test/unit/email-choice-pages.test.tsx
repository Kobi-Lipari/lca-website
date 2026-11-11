// @vitest-environment jsdom
//
// The two pages a link in optional email opens (WS16 step 5), drawn in jsdom
// through their routes, with the site's real calls in
// src/areas/membership/api.ts and a stand-in for fetch that answers as the
// endpoints WS16 step 3 built answer. mailLists is flipped inside this one
// file through a getter on the mocked FEATURES, and a person is signed in
// throughout, to show that neither page sends a sign-in header.
//
// - The unsubscribe page makes one GET that asks for JSON on load, and no
//   POST; one POST on its one button; each result in its status region, which
//   is in the page before its words; the link on with the returned token;
//   the not-working words on a 404 with mailLists on, with the Contact page
//   linked; the network words with the button kept; no address anywhere and
//   the token in no title.
// - The preferences page shows each list with its on and off, saves a change
//   with one PATCH and says "Saved." in a status region that takes the focus,
//   shows every list unticked and off under Stop all, and says who the
//   newsletter goes to when the answer lists none.
// - With mailLists off and the requests answering 404, both pages draw
//   nothing in the main area and leave the title as it was, as an unknown path
//   does; answering 200, once a list email has gone, both pages work.
// - Edges: a page drawn twice, as a development build draws it, still makes
//   no POST on load; two presses at once send one POST; a request that got no
//   answer on load is not a link that does not open; a token is sent encoded
//   to the two endpoints alone and is in no console line and no title.
// Every token, address and list here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENT_MAIL_STILL_COMES } from '@domain/mail/footer'

const flags = vi.hoisted(() => ({ mailLists: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sample-session-token' } } }) } },
}))

const { EmailUnsubscribePage } = await import('@/pages/EmailUnsubscribePage')
const { EmailPreferencesPage } = await import('@/pages/EmailPreferencesPage')

const UNSUBSCRIBE_TOKEN = 'sample0contact0id0000000000000001.lca-newsletter.sampleSignature0000001'
const PREFERENCES_TOKEN = 'sample0contact0id0000000000000001.p.sampleSignature0000002'
const NOT_WORKING = "This link isn't working. Use the link in the latest LCA newsletter, or write to us through the Contact page."
const NO_ANSWER = "That didn't go through. Try again."
const TITLE_BEFORE = 'A title set before the page'

interface Call { url: string; method: string; headers: Record<string, string>; body: unknown }
/** What a stand-in endpoint answers: a status and a body, or a thrown failure, as a request that got no answer. */
type Answer = { status: number; body: unknown } | 'no answer'

let calls: Call[] = []
let answers: Record<string, Answer[]> = {}

/** Answers, in order, for one method and path. */
function on(method: string, url: string, ...replies: Answer[]) {
  answers[`${method} ${url}`] = replies
}

beforeEach(() => {
  flags.mailLists = true
  calls = []
  answers = {}
  document.title = TITLE_BEFORE
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body })
    const reply = answers[`${method} ${url}`]?.shift()
    if (!reply || reply === 'no answer') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** Both pages, through their routes, inside the page frame's main. */
function open(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <main data-testid="main">
        <Routes>
          <Route path="/email/unsubscribe/:token" element={<EmailUnsubscribePage />} />
          <Route path="/email/preferences/:token" element={<EmailPreferencesPage />} />
          <Route path="/contact" element={<h1>Contact page</h1>} />
        </Routes>
      </main>
    </MemoryRouter>,
  )
}

/** Lets the answers the page is waiting for arrive. */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

const UNSUBSCRIBE_URL = `/api/mail/unsubscribe/${UNSUBSCRIBE_TOKEN}`
const PREFERENCES_URL = `/api/mail/preferences/${PREFERENCES_TOKEN}`
const notFound: Answer = { status: 404, body: { error: "This link isn't working." } }
const choices = (over: { lists?: Array<{ id: string; name: string; on: boolean }>; optionalOff?: boolean } = {}) => ({
  status: 200,
  body: {
    address: 'p...@example.org',
    lists: over.lists ?? [{ id: 'lca-newsletter', name: 'LCA newsletter', on: true }, { id: 'club-example', name: 'Example Chess Club news', on: false }],
    optionalOff: over.optionalOff ?? false,
  },
})

describe('the unsubscribe page', () => {
  it('makes one GET that asks for JSON on load and no POST, with no sign-in header, and draws the list\'s two lines and the one button, with no address', async () => {
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Stop the LCA newsletter?' })).toBeTruthy()
    expect(screen.getByText('This stops the LCA newsletter at this address.')).toBeTruthy()
    expect(screen.getByText(EVENT_MAIL_STILL_COMES)).toBeTruthy()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Unsubscribe'])
    await settle()
    expect(calls).toEqual([{ url: UNSUBSCRIBE_URL, method: 'GET', headers: { Accept: 'application/json' }, body: undefined }])
    expect(screen.getByTestId('main').textContent).not.toContain('@')
    expect(document.title).toBe('Unsubscribe | Louisiana Chess Association')
  })

  it('sends one POST on the press, says so in its status region, which was in the page before its words, and links on with the returned token', async () => {
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } })
    on('POST', UNSUBSCRIBE_URL, { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    const button = await screen.findByRole('button', { name: 'Unsubscribe' })
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    fireEvent.click(button)
    await waitFor(() => expect(status.textContent).toContain("Done. The LCA newsletter won't come to this address any more."))
    const link = screen.getByRole('link', { name: 'Change your email choices' })
    expect(link.getAttribute('href')).toBe(`/email/preferences/${PREFERENCES_TOKEN}`)
    expect(status.contains(link)).toBe(true)
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST'])
    expect(calls[1]).toEqual({ url: UNSUBSCRIBE_URL, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' })
    expect(screen.queryByRole('button', { name: 'Unsubscribe' })).toBeNull()
    expect(document.activeElement === status || status.contains(document.activeElement)).toBe(false)
    expect(document.title).not.toContain(UNSUBSCRIBE_TOKEN)
  })

  it('shows the not-working words on a 404 with mailLists on, with the Contact page linked', async () => {
    on('GET', UNSUBSCRIBE_URL, notFound)
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    const contact = await screen.findByRole('link', { name: 'Contact page' })
    expect(contact.getAttribute('href')).toBe('/contact')
    expect(contact.parentElement!.textContent).toBe(NOT_WORKING)
    expect(screen.queryByRole('button')).toBeNull()
    expect(calls).toHaveLength(1)
  })

  it('says the network words on a press that got no answer, keeps the button, and a second press sends one more POST', async () => {
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } })
    on('POST', UNSUBSCRIBE_URL, 'no answer', { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(NO_ANSWER))
    fireEvent.click(screen.getByRole('button', { name: 'Unsubscribe' }))
    await screen.findByRole('link', { name: 'Change your email choices' })
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'POST'])
  })

  it('draws nothing in the main area with mailLists off while the link answers 404, and leaves the title as it was', async () => {
    flags.mailLists = false
    on('GET', UNSUBSCRIBE_URL, notFound)
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    await settle()
    expect(calls).toHaveLength(1)
    expect(screen.getByTestId('main').innerHTML).toBe('')
    expect(document.title).toBe(TITLE_BEFORE)
  })

  it('works with mailLists off once the link answers 200, a list email having gone', async () => {
    flags.mailLists = false
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } })
    on('POST', UNSUBSCRIBE_URL, { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))
    expect(await screen.findByRole('link', { name: 'Change your email choices' })).toBeTruthy()
  })
})

describe('the edges of the two pages', () => {
  it('makes no POST on load when the page is drawn twice, as a mail scanner that opens the link and a development build both cause GETs', async () => {
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } }, { status: 200, body: { list: 'LCA newsletter' } })
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`]}>
          <Routes><Route path="/email/unsubscribe/:token" element={<EmailUnsubscribePage />} /></Routes>
        </MemoryRouter>
      </StrictMode>,
    )
    await screen.findByRole('button', { name: 'Unsubscribe' })
    await settle()
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.method === 'GET')).toBe(true)
  })

  it('sends one POST for two presses made before the answer comes', async () => {
    on('GET', UNSUBSCRIBE_URL, { status: 200, body: { list: 'LCA newsletter' } })
    on('POST', UNSUBSCRIBE_URL, { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    const button = await screen.findByRole('button', { name: 'Unsubscribe' })
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByRole('link', { name: 'Change your email choices' })
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  })

  it('says the network words, not the not-working words, for a load that got no answer or a server error, with no POST and no button', async () => {
    on('GET', UNSUBSCRIBE_URL, 'no answer')
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    await waitFor(() => expect(screen.getByTestId('main').textContent).toBe(NO_ANSWER))
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()

    on('GET', UNSUBSCRIBE_URL, { status: 500, body: { error: 'Something broke.' } })
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    await waitFor(() => expect(screen.getByTestId('main').textContent).toBe(NO_ANSWER))
    expect(calls.every((c) => c.method === 'GET')).toBe(true)
  })

  it('draws nothing in the main area with mailLists off for a load that got no answer, on either page', async () => {
    flags.mailLists = false
    on('GET', UNSUBSCRIBE_URL, 'no answer')
    on('GET', PREFERENCES_URL, 'no answer')
    open(`/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`)
    await settle()
    expect(screen.getByTestId('main').innerHTML).toBe('')
    cleanup()
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await settle()
    expect(screen.getByTestId('main').innerHTML).toBe('')
    expect(document.title).toBe(TITLE_BEFORE)
  })

  it('sends a token that needs encoding encoded, to the two endpoints alone, and puts it in no console line, no title and no page text', async () => {
    const odd = 'sample/contact?id#1.lca-newsletter.sampleSignature%0003'
    const encoded = encodeURIComponent(odd)
    const out = ['log', 'info', 'warn', 'error', 'debug'].map((method) => vi.spyOn(console, method as 'log').mockImplementation(() => {}))
    on('GET', `/api/mail/unsubscribe/${encoded}`, { status: 200, body: { list: 'LCA newsletter' } })
    on('POST', `/api/mail/unsubscribe/${encoded}`, { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } })
    open(`/email/unsubscribe/${encoded}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Unsubscribe' }))
    await screen.findByRole('link', { name: 'Change your email choices' })
    expect(calls.map((c) => c.url)).toEqual([`/api/mail/unsubscribe/${encoded}`, `/api/mail/unsubscribe/${encoded}`])
    expect(document.title).not.toContain(odd)
    expect(document.body.textContent).not.toContain(odd)
    expect(JSON.stringify(out.map((spy) => spy.mock.calls))).not.toContain(odd)
    cleanup()

    const prefsUrl = `/api/mail/preferences/${encoded}`
    on('GET', prefsUrl, choices())
    open(`/email/preferences/${encoded}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    expect(calls.at(-1)?.url).toBe(prefsUrl)
    expect(calls.every((c) => c.url.startsWith('/api/mail/') && !('Authorization' in c.headers))).toBe(true)
    expect(document.title).not.toContain(odd)
    expect(document.body.textContent).not.toContain(odd)
    expect(JSON.stringify(out.map((spy) => spy.mock.calls))).not.toContain(odd)
  })

  it('says the not-working words in the preferences page\'s status region when a save finds the link gone, and keeps the boxes', async () => {
    on('GET', PREFERENCES_URL, choices())
    on('PATCH', PREFERENCES_URL, notFound)
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(NOT_WORKING))
    expect(screen.getByRole('checkbox', { name: 'LCA newsletter' })).toBeTruthy()
    expect(document.activeElement).not.toBe(screen.getByRole('status'))
  })
})

describe('the email preferences page', () => {
  const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement

  it('makes one GET on load and shows the masked address, each list with its on and off and its label, and the stop-all with what keeps coming', async () => {
    on('GET', PREFERENCES_URL, choices())
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Your email choices' })).toBeTruthy()
    expect(screen.getByText('For p...@example.org.')).toBeTruthy()
    expect(box('LCA newsletter').checked).toBe(true)
    const about = document.getElementById(box('LCA newsletter').getAttribute('aria-describedby') ?? '')
    expect(about?.textContent).toBe('News from the Louisiana Chess Association.')
    expect(box('Example Chess Club news').checked).toBe(false)
    expect(box('Stop all optional email from LCA').checked).toBe(false)
    expect(document.getElementById(box('Stop all optional email from LCA').getAttribute('aria-describedby') ?? '')?.textContent).toBe(EVENT_MAIL_STILL_COMES)
    expect(screen.getByRole('button', { name: 'Save my choices' })).toBeTruthy()
    expect(screen.queryByText('The LCA newsletter goes to current members.')).toBeNull()
    await settle()
    expect(calls).toEqual([{ url: PREFERENCES_URL, method: 'GET', headers: { Accept: 'application/json' }, body: undefined }])
    expect(document.title).toBe('Email choices | Louisiana Chess Association')
  })

  it('saves a change with one PATCH and says "Saved." in its status region, which takes the focus', async () => {
    on('GET', PREFERENCES_URL, choices())
    on('PATCH', PREFERENCES_URL, choices({ lists: [{ id: 'lca-newsletter', name: 'LCA newsletter', on: false }, { id: 'club-example', name: 'Example Chess Club news', on: false }] }))
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    fireEvent.click(box('LCA newsletter'))
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(status.textContent).toBe('Saved.'))
    expect(document.activeElement).toBe(status)
    expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH'])
    expect(calls[1]).toEqual({
      url: PREFERENCES_URL, method: 'PATCH', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: '{"lists":{"lca-newsletter":false,"club-example":false},"optionalOff":false}',
    })
    expect(box('LCA newsletter').checked).toBe(false)
  })

  it('shows every list unticked and off while Stop all is ticked, saves the stop-all alone, and gives each list its own choice back when it is unticked', async () => {
    on('GET', PREFERENCES_URL, choices())
    on('PATCH', PREFERENCES_URL, choices({ optionalOff: true }))
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    fireEvent.click(box('Stop all optional email from LCA'))
    for (const name of ['LCA newsletter', 'Example Chess Club news']) {
      expect(box(name).checked, name).toBe(false)
      expect(box(name).disabled, name).toBe(true)
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved.'))
    expect(calls[1].body).toBe('{"optionalOff":true}')
    expect(box('Stop all optional email from LCA').checked).toBe(true)
    fireEvent.click(box('Stop all optional email from LCA'))
    expect(box('LCA newsletter').checked).toBe(true)
    expect(box('LCA newsletter').disabled).toBe(false)
  })

  it('says the newsletter goes to current members when the answer lists no newsletter', async () => {
    on('GET', PREFERENCES_URL, choices({ lists: [] }))
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    expect(await screen.findByText('The LCA newsletter goes to current members.')).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: 'LCA newsletter' })).toBeNull()
    expect(box('Stop all optional email from LCA')).toBeTruthy()
  })

  it('shows the not-working words on a 404 with mailLists on, and a refusal in the server\'s words', async () => {
    on('GET', PREFERENCES_URL, notFound)
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    expect((await screen.findByRole('link', { name: 'Contact page' })).parentElement!.textContent).toBe(NOT_WORKING)
    cleanup()

    on('GET', PREFERENCES_URL, choices())
    on('PATCH', PREFERENCES_URL, { status: 400, body: { error: 'That list is not one of yours.' } }, 'no answer')
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('That list is not one of yours.'))
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(NO_ANSWER))
  })

  it('draws nothing in the main area with mailLists off while the link answers 404, and works once it answers 200', async () => {
    flags.mailLists = false
    on('GET', PREFERENCES_URL, notFound)
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await settle()
    expect(screen.getByTestId('main').innerHTML).toBe('')
    expect(document.title).toBe(TITLE_BEFORE)
    cleanup()

    on('GET', PREFERENCES_URL, choices())
    on('PATCH', PREFERENCES_URL, choices())
    open(`/email/preferences/${PREFERENCES_TOKEN}`)
    await screen.findByRole('heading', { level: 1, name: 'Your email choices' })
    fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved.'))
  })
})
