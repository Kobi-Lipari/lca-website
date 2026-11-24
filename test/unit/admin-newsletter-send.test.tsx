// @vitest-environment jsdom
//
// Send from the newsletter's own page (WS16 part two, page step 6, the send
// half), through the whole App, with the server answered by a stand-in for
// fetch, as test/unit/admin-newsletter-test.test.tsx draws the page.
//
// - Switched off (mailPageSend false), the page is exactly as it was: the
//   newsletter's count is read once as the page opens and never again, step 3
//   is the quiet Send with its small arrow, a press says "Sending to members
//   from this page is not available yet." and asks nothing of the server, the
//   phone's bar has no status line, and the email sheet's foot holds "Back to
//   writing" alone.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject } from '@domain/mail/letter'
import { ALREADY_SENDING, NOBODY_ON_THE_LIST, SEND_CHANGED, SEND_NO_SUBJECT, WAITS_FOR_SES } from '@domain/mail/newsletterWords'

const flags = vi.hoisted(() => ({ mailLists: true, mailPage: true, mailPageSend: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
      get mailPage() {
        return flags.mailPage
      },
      get mailPageSend() {
        return flags.mailPageSend
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const COUNT_URL = '/api/admin/mail/newsletter'
const SEND_URL = '/api/admin/mail/newsletter/issue/send'
const STOP_URL = '/api/admin/mail/newsletter/stop'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'
const MONTH = 'December 2026'
const ADDRESS = 'admin@example.org'
const NOT_YET = 'Sending to members from this page is not available yet.'

const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(() => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
})
afterAll(() => {
  Range.prototype.getClientRects = saved.rangeRects
  Range.prototype.getBoundingClientRect = saved.rangeBox
  document.elementFromPoint = saved.elementFromPoint
})

/** An answer the stand-in for fetch gives, or 'network' for a request that gets none. */
interface Answer { status: number; body: unknown }
type Given = Answer | 'network' | Promise<Answer | 'network'>
let answers: Record<string, Given[]> = {}
let calls: string[] = []
let sends: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Given[]) => {
  answers[`${method} ${url}`] = list
}
const letter = (extra: Record<string, unknown> = {}) => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: BODY, createdAt: '2026-11-16 15:00:00', updatedAt: '2026-11-16 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-16 20:15:00',
})
/** The time now as the server stores it, "2026-11-16 20:20:00" in UTC. */
const storedNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const count = (extra: Record<string, unknown> = {}) => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'ses', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null }, ...extra },
})

const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'member-sample-admin', session_id: 'session-sample-admin', aal: 'aal2', role: 'authenticated' })}.sample-signature`
const ADMIN = {
  user: { id: 'member-sample-admin', email: ADDRESS, user_metadata: { role: 'lca_admin' } },
  session: { access_token: TOKEN },
  member: { id: 'member-sample-admin', email: ADDRESS, full_name: 'Player One', role: 'lca_admin', club_id: null, membership_status: 'active' },
  role: 'lca_admin', seats: [], managedClubs: [], isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false,
  refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [], loading: false, memberLoading: false,
  signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
} as unknown as AuthContextValue

beforeEach(() => {
  window.localStorage.setItem('lca-newsletter-page-help', 'shown') // Help has been seen once, so it does not open by itself here.
  answers = {}
  calls = []
  sends = []
  flags.mailLists = true
  flags.mailPage = true
  flags.mailPageSend = false
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'POST' && url === SEND_URL) sends.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (await (list && list.length > 1 ? list.shift() : list?.[0])) ?? { status: 404, body: { error: 'Not found' } }
    if (answer === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, count())
  on('PUT', ISSUE_URL, { status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
  on('POST', SEND_URL, { status: 201, body: { campaignId: 'campaign-sample-1', totalRecipients: 155 } })
  on('POST', STOP_URL, { status: 200, body: { stopped: true } })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = (ms = 40) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
async function thePage() {
  await act(async () => {
    render(
      <AuthContext.Provider value={ADMIN}>
        <MemoryRouter initialEntries={['/admin/newsletter']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByRole('heading', { level: 1, name: 'Newsletter' }, { timeout: 10_000 })
  await screen.findByRole('toolbar', { name: 'Writing tools' })
  await settle()
}
const focused = () => document.activeElement as HTMLElement
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const sendStep = () => within(theBar()).getByRole('button', { name: '3 Send to 155 people' })
const statusLine = () => within(theBar()).getByRole('status')
const countReads = () => calls.filter((call) => call === `GET ${COUNT_URL}`).length

/** A stand-in for the browser's media query at a window's width, as the bar's test file gives it. */
function windowAt(px: number) {
  const width = px
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      const line = /^\(min-width: (\d+)px\)$/.exec(query)
      return line !== null && width >= Number(line[1])
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('switched off, the page is as it was', () => {
  it('reads the count once as the page opens and never again, even with a send on its way', async () => {
    windowAt(1440)
    on('GET', COUNT_URL, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [{ id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }], waits: null } }))
    await thePage()
    expect(countReads()).toBe(1)
    await settle(3_500)
    expect(countReads()).toBe(1)
    expect(document.querySelector('[data-slot="send-progress"]')).toBeNull()
    expect(within(theBar()).queryByRole('button', { name: /Stop sending/ })).toBeNull()
  }, 15_000)

  it('keeps step 3 the quiet Send with its arrow, which says why on a press and asks nothing of the server', async () => {
    windowAt(1440)
    await thePage()
    const send = sendStep()
    expect(send.getAttribute('aria-disabled')).toBe('true')
    expect(send.hasAttribute('aria-haspopup')).toBe(false)
    expect(send.querySelector('.grayscale-60')).not.toBeNull()
    expect(send.querySelector('.lucide-chevron-down')).not.toBeNull()
    const before = calls.length
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe(NOT_YET)
    expect(calls.slice(before)).toEqual([])
    expect(sends).toEqual([])
    expect(focused()).toBe(send)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('keeps the phone bar its two buttons with no status line, and the sheet foot "Back to writing" alone', async () => {
    windowAt(390)
    await thePage()
    expect(within(theBar()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Pick a template', 'See the email'])
    expect(within(theBar()).queryByRole('status')).toBeNull()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const foot = document.querySelector('[data-slot="email-sheet-foot"]') as HTMLElement
    expect(within(foot).getAllByRole('button').map((button) => button.textContent)).toEqual(['Back to writing'])
    expect(sends).toEqual([])
  })
})

describe('switched on, while the newsletter goes through Resend', () => {
  it('keeps Send quiet with no arrow, says why it waits on a press, and asks nothing of the server', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, count({ sendsThrough: 'resend' }))
    await thePage()
    const send = sendStep()
    expect(send.getAttribute('aria-disabled')).toBe('true')
    expect(send.hasAttribute('aria-haspopup')).toBe(false)
    expect(send.querySelector('.grayscale-60')).not.toBeNull()
    expect(send.querySelector('.lucide-chevron-down')).toBeNull()
    const before = calls.length
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe(WAITS_FOR_SES)
    expect(calls.slice(before)).toEqual([])
    expect(sends).toEqual([])
    expect(focused()).toBe(send)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('switched on, with the newsletter going through Amazon', () => {
  it('draws step 3 the ready gold Send, with no arrow, that opens a question', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    await thePage()
    const send = sendStep()
    expect(send.hasAttribute('aria-disabled')).toBe(false)
    expect(send.getAttribute('aria-haspopup')).toBe('dialog')
    expect(send.getAttribute('aria-expanded')).toBe('false')
    expect(send.querySelector('.grayscale-60')).toBeNull()
    expect(send.querySelector('.lucide-chevron-down')).toBeNull()
    expect(send.className).toContain('bg-lca-gold')
    expect(send.className).toContain('text-brand-navy')
    expect(send.className).toContain('min-h-[46px]')
    expect(send.className).toContain('border-transparent')
  })

  it('while a send is on its way, draws how far it has gone beside mark 3 and a Stop sending described by it', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [{ id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }], waits: null } }))
    await thePage()
    const progress = theBar().querySelector('[data-slot="send-progress"]') as HTMLElement
    expect(progress).not.toBeNull()
    expect(progress.textContent).toBe('Sending, 40 of 155')
    expect(progress.hasAttribute('role')).toBe(false)
    expect(progress.closest('[role="status"], [aria-live]')).toBeNull()
    const stop = within(theBar()).getByRole('button', { name: 'Stop sending' })
    expect(stop.getAttribute('aria-describedby')).toBe(progress.id)
    expect(stop.hasAttribute('aria-disabled')).toBe(false)
    expect(stop.className).toContain('min-h-[46px]')
    expect(within(theBar()).queryByRole('button', { name: /^3 Send/ })).toBeNull()
    expect(`${progress.className} ${stop.className}`).not.toMatch(/animate|transition/)
  })

  it('draws the gold Send as "Send" while the count could not be read', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, { status: 503, body: { error: 'Not now' } })
    await thePage()
    const send = within(theBar()).getByRole('button', { name: '3 Send' })
    expect(send.hasAttribute('aria-disabled')).toBe(false)
    expect(send.getAttribute('aria-haspopup')).toBe('dialog')
    expect(send.querySelector('.grayscale-60')).toBeNull()
    expect(send.querySelector('.lucide-chevron-down')).toBeNull()
  })
})

describe('switched on, a press of Send before its question', () => {
  const sendingRow = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }
  const summary = (extra: Record<string, unknown> = {}) => ({ addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null, ...extra })

  it('says it checks the letter, holds Send with its words while it does, and says so when the count cannot be read again', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    let answer: (value: Answer) => void = () => {}
    on('GET', COUNT_URL, count(), new Promise<Answer>((resolve) => { answer = resolve }))
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe('Checking the letter...')
    expect(send.getAttribute('aria-disabled')).toBe('true')
    expect(sendStep()).toBe(send)
    expect(focused()).toBe(send)
    fireEvent.click(send)
    fireEvent.click(send)
    await settle()
    expect(countReads()).toBe(2)
    await act(async () => answer({ status: 503, body: { error: 'Not now' } }))
    await settle()
    expect(statusLine().textContent).toBe('The number of people who will get it could not be read, so nothing was sent. Try again in a moment.')
    expect(send.hasAttribute('aria-disabled')).toBe(false)
    expect(focused()).toBe(send)
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says why and asks nothing more when the letter has no subject', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter({ subject: '' }) })
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe(SEND_NO_SUBJECT)
    expect(countReads()).toBe(1)
    expect(focused()).toBe(send)
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it.each([
    ['the newsletter now goes through Resend', count({ sendsThrough: 'resend' }), WAITS_FOR_SES],
    ['nobody is on the list', count({ summary: summary({ addresses: 0, willGet: 0 }) }), NOBODY_ON_THE_LIST],
  ])('says why and opens no question when, read again, %s', async (_name, fresh, words) => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, count(), fresh)
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe(words)
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says a send is already on its way and draws it, when the read again finds one', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, count(), count({ summary: summary({ recent: [sendingRow] }) }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    expect(statusLine().textContent).toBe(ALREADY_SENDING)
    expect(theBar().querySelector('[data-slot="send-progress"]')?.textContent).toBe('Sending, 40 of 155')
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('asks with the fresh count, which the bar takes too, and Escape puts the focus back on Send with nothing sent', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, count(), count({ summary: summary({ addresses: 154, willGet: 154 }) }))
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 154 people?' })
    await waitFor(() => expect(focused()).toBe(within(question).getByRole('button', { name: 'Not now' })))
    // The page under the question is inert, so the bar is read past it.
    const bar = screen.getByRole('region', { name: 'Pick, check and send', hidden: true })
    const fresh = within(bar).getByRole('button', { name: '3 Send to 154 people', hidden: true })
    expect(fresh.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(focused(), { key: 'Escape' })
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(focused()).toBe(within(theBar()).getByRole('button', { name: '3 Send to 154 people' })))
    expect(sends).toEqual([])
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
  })

  it('stops saying it checks the letter once the question is asked, and says nothing after Not now', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    const bar = screen.getByRole('region', { name: 'Pick, check and send', hidden: true })
    expect(within(bar).getByRole('status', { hidden: true }).textContent).toBe('')
    fireEvent.click(within(question).getByRole('button', { name: 'Not now' }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(statusLine().textContent).toBe('')
    expect(sends).toEqual([])
  })
})

describe('switched on, Send answered in its question and refused', () => {
  async function askAndSend() {
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    const yes = within(question).getByRole('button', { name: 'Send' })
    fireEvent.click(yes)
    fireEvent.click(yes)
    fireEvent.keyDown(yes, { key: 'Enter', repeat: true })
    await settle()
  }

  it.each([
    ['someone else moved the letter', { status: 409, body: { error: SEND_CHANGED, reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' } }, SEND_CHANGED],
    ['the server gives its own words', { status: 503, body: { error: 'Sample refusal words.' } }, 'Sample refusal words.'],
    ['no answer comes and nothing is sending', 'network' as const, 'The newsletter could not be sent. Try again in a moment.'],
  ])('posts the letter it names once, and when %s, says so with the focus back on Send', async (_name, refusal, words) => {
    flags.mailPageSend = true
    windowAt(1440)
    on('POST', SEND_URL, refusal)
    await askAndSend()
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(statusLine().textContent).toBe(words)
    await waitFor(() => expect(focused()).toBe(sendStep()))
    expect(sendStep().hasAttribute('aria-disabled')).toBe(false)
  })

  it('reads "Sending..." on the question, with neither answer available, while the send is on its way', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    let answer: (value: Answer) => void = () => {}
    on('POST', SEND_URL, new Promise<Answer>((resolve) => { answer = resolve }))
    await askAndSend()
    const question = screen.getByRole('alertdialog', { name: 'Send to 155 people?' })
    const yes = within(question).getByRole('button', { name: 'Sending...' })
    expect(yes.getAttribute('aria-disabled')).toBe('true')
    expect(within(question).getByRole('button', { name: 'Not now' }).getAttribute('aria-disabled')).toBe('true')
    fireEvent.keyDown(focused(), { key: 'Escape' })
    await settle()
    expect(screen.getByRole('alertdialog')).toBe(question)
    expect(sends).toHaveLength(1)
    await act(async () => answer({ status: 503, body: { error: 'Sample refusal words.' } }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('says the words changed as it went, and nothing more, when the page\'s own save moved the letter while it was on its way', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    let answerSend: (value: Answer) => void = () => {}
    let answerSave: (value: Answer) => void = () => {}
    on('POST', SEND_URL, new Promise<Answer>((resolve) => { answerSend = resolve }))
    await askAndSend()
    on('PUT', ISSUE_URL, new Promise<Answer>((resolve) => { answerSave = resolve }))
    const field = screen.getByRole('textbox', { name: 'Subject', hidden: true })
    fireEvent.change(field, { target: { value: 'Sample subject changed' } })
    await settle(2_200)
    expect(calls.filter((call) => call === `PUT ${ISSUE_URL}`)).toHaveLength(1)
    await act(async () => answerSend({ status: 409, body: { error: SEND_CHANGED, reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' } }))
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(statusLine().textContent).toBe('Nothing was sent, since your words changed as it went. Press Send again.')
    expect(document.body.textContent).not.toContain('Player Two changed')
    expect(sends).toHaveLength(1)
    await act(async () => answerSave({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } }))
    await settle()
  }, 15_000)

  it('follows the send as one that answered when no answer comes, yet the send went and the letter moved on', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-0', subject: defaultSubject(MONTH), status: 'sending', sentCount: 0, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    on('POST', SEND_URL, 'network')
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    // The server holds no open letter now: the one on the page was sent.
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await settle(120)
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(within(theBar()).getByRole('button', { name: 'Stop sending' })).toBeTruthy()
    expect(theBar().querySelector('[data-slot="send-progress"]')?.textContent).toBe('Sending, 0 of 155')
    await waitFor(() => expect(statusLine().textContent).toBe(`“${defaultSubject(MONTH)}” is sending to 155 people. It goes on if you close this page.`))
  })

  it('says how it ended when no answer comes, yet the letter moved on and its send has already ended by the read', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    // Made at the press: a send is taken as this one only when its row is no older than the press.
    const sentRow = { id: 'campaign-sample-0', subject: defaultSubject(MONTH), status: 'sent', sentCount: 155, totalRecipients: 155, createdAt: storedNow(), sentAt: storedNow() }
    on('POST', SEND_URL, 'network')
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sentRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await settle(120)
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(statusLine().textContent).toBe('Sent to 155 people.'))
    expect(document.body.textContent).not.toContain('could not be sent')
  })

  it.each([
    ['no send at all is listed', []],
    ['only an older send of the same subject is listed', [{ id: 'campaign-sample-old', subject: defaultSubject(MONTH), status: 'completed', sentCount: 155, totalRecipients: 155, createdAt: '2026-10-16 20:20:00', completedAt: '2026-10-16 20:21:00' }]],
  ])('claims no send when no answer comes and another person has started a fresh letter, while %s', async (_name, recent) => {
    flags.mailPageSend = true
    windowAt(1440)
    on('POST', SEND_URL, 'network')
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent, waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    // Someone else pressed Pick a template: the open letter is now a fresh one, and the one on the page was set aside.
    on('GET', ISSUE_URL, { status: 200, body: letter({ id: 'sample-letter-2', version: 1 }) })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    // The count is read again after the letter is: the page says what it says only once that read has come.
    await waitFor(() => expect(calls.filter((call) => call === `GET ${COUNT_URL}`).length).toBeGreaterThanOrEqual(3))
    await settle(400)
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(statusLine().textContent).not.toContain('Sent to')
    expect(statusLine().textContent).not.toContain('is sending')
    expect(within(theBar()).queryByRole('button', { name: 'Stop sending' })).toBeNull()
  })

  it('claims nothing about the letter when no answer comes and neither read again answers', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('POST', SEND_URL, 'network')
    on('GET', COUNT_URL, count(), count(), 'network')
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, 'network')
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await settle(120)
    expect(sends).toHaveLength(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(statusLine().textContent).not.toContain('could not be sent')
    expect(statusLine().textContent).not.toContain('Nothing was sent')
  })
})

describe('switched on, Stop sending', () => {
  const sendingRow = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }
  const going = () => count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } })

  it('asks first, with Keep sending taking the focus, and Escape keeps sending with the focus back on Stop sending', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, going())
    await thePage()
    const stop = within(theBar()).getByRole('button', { name: 'Stop sending' })
    act(() => stop.focus())
    fireEvent.click(stop)
    const question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    expect(question.textContent).toContain('Addresses not yet reached won\'t get it.')
    await waitFor(() => expect(focused()).toBe(within(question).getByRole('button', { name: 'Keep sending' })))
    expect(within(question).getByRole('button', { name: 'Stop sending' })).toBeTruthy()
    fireEvent.keyDown(focused(), { key: 'Escape' })
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await waitFor(() => expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'Stop sending' })))
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
  })

  const stoppedRow = { ...sendingRow, status: 'completed', sentAt: '2026-11-16 20:05:00' }
  const stopped = () => count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [stoppedRow], waits: null } })
  async function stopAnswered(stop: Given) {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, going(), stopped())
    on('POST', STOP_URL, stop)
    await thePage()
    const press = within(theBar()).getByRole('button', { name: 'Stop sending' })
    act(() => press.focus())
    fireEvent.click(press)
    const question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Stop sending' }))
  }

  it('stops when asked, says how many were sent, and puts the focus on the Send drawn in its place', async () => {
    await stopAnswered({ status: 200, body: { stopped: true } })
    await waitFor(() => expect(statusLine().textContent).toBe('Stopped. 40 of 155 were sent.'))
    await waitFor(() => expect(focused()).toBe(sendStep()))
    expect(calls.filter((call) => call === `POST ${STOP_URL}`)).toHaveLength(1)
    expect(within(theBar()).queryByRole('button', { name: 'Stop sending' })).toBeNull()
    await settle(200)
    expect(statusLine().textContent).toBe('Stopped. 40 of 155 were sent.')
  })

  it('says nothing is sending when the send had ended by then, and the read that follows says how it ended', async () => {
    await stopAnswered({ status: 409, body: { error: 'No newsletter is sending.' } })
    await waitFor(() => expect(statusLine().textContent).toBe('Sent to 40 of 155 people.'))
    await waitFor(() => expect(focused()).toBe(sendStep()))
    expect(calls.filter((call) => call === `POST ${STOP_URL}`)).toHaveLength(1)
  })

  it('holds Stop sending while the stop is on its way, so a second press asks nothing and stops nothing', async () => {
    let answer: (given: Answer) => void = () => {}
    await stopAnswered(new Promise<Answer>((resolve) => { answer = resolve }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    const held = within(theBar()).getByRole('button', { name: 'Stop sending' })
    expect(held.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(held)
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(calls.filter((call) => call === `POST ${STOP_URL}`)).toHaveLength(1)
    await act(async () => answer({ status: 200, body: { stopped: true } }))
    await waitFor(() => expect(statusLine().textContent).toBe('Stopped. 40 of 155 were sent.'))
  })
})

describe('switched on, the phone bar', () => {
  const sendingRow = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }

  it('has its status line above its two buttons, and nothing more while nothing is sending', async () => {
    flags.mailPageSend = true
    windowAt(390)
    await thePage()
    const line = statusLine()
    const buttons = within(theBar()).getAllByRole('button')
    expect(buttons.map((button) => button.textContent)).toEqual(['Pick a template', 'See the email'])
    expect(line.compareDocumentPosition(buttons[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line.textContent).toBe('')
    expect(theBar().querySelector('[data-slot="send-progress"]')).toBeNull()
  })

  it('while a send is on its way, has a row above the two buttons with how far it has gone and a Stop sending that asks first', async () => {
    flags.mailPageSend = true
    windowAt(390)
    on('GET', COUNT_URL, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    const progress = theBar().querySelector('[data-slot="send-progress"]') as HTMLElement
    expect(progress.textContent).toBe('Sending, 40 of 155')
    expect(progress.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull()
    const stop = within(theBar()).getByRole('button', { name: 'Stop sending' })
    expect(stop.getAttribute('aria-describedby')).toBe(progress.id)
    expect(stop.className).toContain('min-h-[50px]')
    expect(stop.className).toContain('@max-[18rem]:basis-full')
    const pick = within(theBar()).getByRole('button', { name: 'Pick a template' })
    expect(stop.compareDocumentPosition(pick) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(statusLine().compareDocumentPosition(progress) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(stop)
    expect(await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })).toBeTruthy()
  })

  it('once stopped, says how many were sent and gives the focus to See the email, as nothing is drawn in Stop\'s place', async () => {
    flags.mailPageSend = true
    windowAt(390)
    const stoppedRow = { ...sendingRow, status: 'completed', sentAt: '2026-11-16 20:05:00' }
    on('GET', COUNT_URL,
      count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }),
      count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [stoppedRow], waits: null } }))
    await thePage()
    const stop = within(theBar()).getByRole('button', { name: 'Stop sending' })
    act(() => stop.focus())
    fireEvent.click(stop)
    const question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Stop sending' }))
    await waitFor(() => expect(statusLine().textContent).toBe('Stopped. 40 of 155 were sent.'))
    await waitFor(() => expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'See the email' })))
  })
})

describe('switched on, the email sheet\'s foot', () => {
  const footButtons = () => within(document.querySelector('[data-slot="email-sheet-foot"]') as HTMLElement).getAllByRole('button')

  it('on a phone, has a row above Back to writing with Send a test to me and Send to 155 people, each 50 pixels high', async () => {
    flags.mailPageSend = true
    windowAt(390)
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const buttons = footButtons()
    expect(buttons.map((button) => button.textContent)).toEqual(['Send a test to me', 'Send to 155 people', 'Back to writing'])
    for (const button of buttons.slice(0, 2)) expect(button.className).toContain('min-h-[50px]')
    expect(buttons[1].querySelector('.lucide-chevron-down')).toBeNull()
    expect(buttons[1].className).toContain('bg-lca-gold')
  })

  it('on a phone, stacks the row under 18rem, and its Send asks over the sheet and gives the focus back to itself on Not now', async () => {
    flags.mailPageSend = true
    windowAt(390)
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const row = document.querySelector('[data-slot="sheet-send-row"]') as HTMLElement
    expect((row.lastElementChild as HTMLElement).className).toContain('max-[18rem]:flex-col')
    const sheetSend = footButtons()[1]
    expect(sheetSend.getAttribute('aria-haspopup')).toBe('dialog')
    act(() => sheetSend.focus())
    fireEvent.click(sheetSend)
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    expect(question.closest('[data-slot="send-scrim"]')?.className ?? '').toContain('z-[90]')
    fireEvent.click(within(question).getByRole('button', { name: 'Not now' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(focused()).toBe(footButtons()[1]))
    expect(sends).toEqual([])
  })

  it('on a phone, shows Stop sending with how far the send has gone, and Stop asks first', async () => {
    flags.mailPageSend = true
    windowAt(390)
    const sendingRow = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }
    on('GET', COUNT_URL, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const foot = document.querySelector('[data-slot="email-sheet-foot"]') as HTMLElement
    const progress = foot.querySelector('[data-slot="send-progress"]') as HTMLElement
    expect(progress.textContent).toBe('Sending, 40 of 155')
    expect(progress.closest('[role="status"], [role="alert"], [aria-live]')).toBeNull()
    const stop = within(foot).getByRole('button', { name: 'Stop sending' })
    expect(stop.getAttribute('aria-describedby')).toBe(progress.id)
    expect(stop.className).toContain('min-h-[50px]')
    fireEvent.click(stop)
    expect(await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })).toBeTruthy()
  })

  it('on a phone, gives the focus back to the sheet\'s Stop sending on Keep sending, and to the sheet\'s Send once stopped', async () => {
    flags.mailPageSend = true
    windowAt(390)
    const sendingRow = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }
    const stoppedRow = { ...sendingRow, status: 'completed', sentAt: '2026-11-16 20:05:00' }
    on('GET', COUNT_URL,
      count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }),
      count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [stoppedRow], waits: null } }))
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const stop = footButtons()[1]
    act(() => stop.focus())
    fireEvent.click(stop)
    let question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Keep sending' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(focused()).toBe(footButtons()[1]))
    fireEvent.click(footButtons()[1])
    question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Stop sending' }))
    await waitFor(() => expect(footButtons()[1].textContent).toBe('Send to 155 people'))
    await waitFor(() => expect(focused()).toBe(footButtons()[1]))
  })

  it('on a phone, reads Sending a test, not available to a second press, while its test is on its way', async () => {
    flags.mailPageSend = true
    windowAt(390)
    let answerTest: (answer: Answer) => void = () => {}
    on('POST', '/api/admin/mail/newsletter/test', new Promise<Answer>((resolve) => {
      answerTest = resolve
    }))
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    fireEvent.click(footButtons()[0])
    await waitFor(() => expect(footButtons()[0].textContent).toBe('Sending a test'))
    expect(footButtons()[0].getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(footButtons()[0])
    await settle()
    expect(calls.filter((call) => call === 'POST /api/admin/mail/newsletter/test')).toHaveLength(1)
    answerTest({ status: 200, body: { sent: true, to: ADDRESS } })
    await waitFor(() => expect(footButtons()[0].textContent).toBe('Send a test to me'))
  })

  it('on a tablet, keeps Back to writing alone', async () => {
    flags.mailPageSend = true
    windowAt(820)
    await thePage()
    fireEvent.click(screen.getAllByRole('button', { name: 'See the email' })[0])
    await settle()
    expect(footButtons().map((button) => button.textContent)).toEqual(['Back to writing'])
  })
})

describe('switched on, Send answered in its question and sent', () => {
  it('draws the letter afresh, puts the focus on Stop sending at once and says who it goes to once, a moment later', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-1', subject: defaultSubject(MONTH), status: 'sending', sentCount: 0, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    // The server holds no open letter once its letter is sent.
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    const start = `“${defaultSubject(MONTH)}” is sending to 155 people. It goes on if you close this page.`
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'Stop sending' })))
    await waitFor(() => expect(statusLine().textContent).toBe(start))
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(screen.getByRole('textbox', { name: /Subject/ }).getAttribute('value') ?? '').not.toBe(defaultSubject(MONTH))
    await settle(400)
    expect(statusLine().textContent).toBe(start)
  })

  it('holds Send, not available, from the send\'s answer until the count is read again, so a second press asks nothing', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-1', subject: defaultSubject(MONTH), status: 'sending', sentCount: 0, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    let answer: (value: Answer) => void = () => {}
    on('GET', COUNT_URL, count(), count(), new Promise<Answer>((resolve) => { answer = resolve }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await settle()
    const reads = countReads()
    expect(sendStep().getAttribute('aria-disabled')).toBe('true')
    expect(sendStep().getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(sendStep())
    fireEvent.keyDown(sendStep(), { key: 'Enter' })
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(countReads()).toBe(reads)
    expect(statusLine().textContent).not.toContain('no words')
    act(() => answer(count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } })))
    await waitFor(() => expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'Stop sending' })))
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
  })

  it('keeps Send held when the count cannot be read just after the send\'s answer, and shows Stop sending once a later read answers', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-1', subject: defaultSubject(MONTH), status: 'sending', sentCount: 0, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    on('GET', COUNT_URL, count(), count(), { status: 503, body: { error: 'Not now' } }, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await settle(400)
    // The read after the answer failed: Send stays held, and no Send for the fresh letter is offered in its place.
    expect(sendStep().getAttribute('aria-disabled')).toBe('true')
    expect(within(theBar()).queryByRole('button', { name: 'Stop sending' })).toBeNull()
    await waitFor(() => expect(within(theBar()).getByRole('button', { name: 'Stop sending' })).toBeTruthy(), { timeout: 5_000 })
    expect(theBar().querySelector('[data-slot="send-progress"]')?.textContent).toBe('Sending, 0 of 155')
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
  }, 15_000)

  it.each([
    ['the read just after the send\'s answer', [] as Given[]],
    ['the first read that answers after one that failed', [{ status: 503, body: { error: 'Not now' } }] as Given[]],
  ])('says how a short send ended when it has ended by %s', async (_name, before) => {
    flags.mailPageSend = true
    windowAt(1440)
    // A short list goes in one go: the first read that answers already shows the send ended, made since the press.
    const sentRow = { id: 'campaign-sample-1', subject: defaultSubject(MONTH), status: 'completed', sentCount: 155, totalRecipients: 155, createdAt: storedNow(), completedAt: storedNow() }
    on('GET', COUNT_URL, count(), count(), ...before, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sentRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(statusLine().textContent).toBe('Sent to 155 people.'), { timeout: 5_000 })
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(within(theBar()).queryByRole('button', { name: 'Stop sending' })).toBeNull()
  }, 15_000)

  it('says no end line for an older send of the same subject when the send\'s answer is followed by a read that shows only that one', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const olderRow = { id: 'campaign-sample-old', subject: defaultSubject(MONTH), status: 'completed', sentCount: 155, totalRecipients: 155, createdAt: '2026-10-16 20:20:00', completedAt: '2026-10-16 20:21:00' }
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [olderRow], waits: null } }))
    await thePage()
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    const start = `“${defaultSubject(MONTH)}” is sending to 155 people. It goes on if you close this page.`
    await waitFor(() => expect(statusLine().textContent).toBe(start))
    await settle(400)
    expect(statusLine().textContent).toBe(start)
  })

  it('closes More options once the letter is sent', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-1', subject: defaultSubject(MONTH), status: 'sending', sentCount: 0, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    on('GET', COUNT_URL, count(), count(), count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    const more = () => within(theBar()).getByRole('button', { name: 'More options' })
    fireEvent.click(more())
    await waitFor(() => expect(more().getAttribute('aria-expanded')).toBe('true'))
    fireEvent.click(sendStep())
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(within(theBar()).getByRole('button', { name: 'Stop sending' })).toBeTruthy())
    expect(more().getAttribute('aria-expanded')).toBe('false')
    expect(sends).toHaveLength(1)
  })

  it('says nothing to a second person who opens the page while the send is on its way, and shows how far it has gone', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const sendingRow = { id: 'campaign-sample-1', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:20:00', sentAt: null }
    on('GET', COUNT_URL, count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [sendingRow], waits: null } }))
    await thePage()
    expect(theBar().querySelector('[data-slot="send-progress"]')?.textContent).toBe('Sending, 40 of 155')
    expect(statusLine().textContent).toBe('')
    await settle(400)
    expect(statusLine().textContent).toBe('')
    expect(sends).toEqual([])
  })
})

describe('Help\'s step 6 on the page', () => {
  it.each([
    ['switched off', false, 'ses', 1440, ['Send a test to yourself first.', NOT_YET]],
    ['switched off, on a phone', false, 'ses', 390, ['Send yourself a test from a computer or a tablet.']],
    ['switched on, through Resend', true, 'resend', 1440, ['Send a test to yourself first.', NOT_YET]],
    // The sheet holds no test and no Send while the newsletter goes through Resend, so the phone's own card is said.
    ['switched on, through Resend, on a phone', true, 'resend', 390, ['Send yourself a test from a computer or a tablet.']],
    ['switched on, through Amazon', true, 'ses', 1440, ['Send a test to yourself first. Then send.']],
    ['switched on, through Amazon, on a tablet', true, 'ses', 820, ['Send a test to yourself first. Then send.']],
    ['switched on, through Amazon, on a phone', true, 'ses', 390, ['Send a test to yourself first. Then send.']],
  ] as const)('%s, says what a press on Send does there', async (_name, switchedOn, through, width, words) => {
    flags.mailPageSend = switchedOn
    windowAt(width)
    on('GET', COUNT_URL, count({ sendsThrough: through }))
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    for (let n = 1; n < 6; n++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const card = screen.getByRole('dialog', { name: 'Help, step 6 of 6' })
    expect([...card.querySelectorAll('h2 ~ p')].map((p) => p.textContent)).toEqual(words)
  }, 15_000)

  it('switched on, while the count is still being read, says what the bar offers: send', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, new Promise<Answer>(() => {}))
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    for (let n = 1; n < 6; n++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const card = screen.getByRole('dialog', { name: 'Help, step 6 of 6' })
    expect([...card.querySelectorAll('h2 ~ p')].map((p) => p.textContent)).toEqual(['Send a test to yourself first. Then send.'])
  }, 15_000)
})

describe('a save after the letter was sent, switched on or off', () => {
  it.each([false, true])('offers "Start the next letter" on the saved line, asks first, and then reads the next letter (switched on: %s)', async (switchedOn) => {
    flags.mailPageSend = switchedOn
    windowAt(1440)
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'sent', changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' } })
    await thePage()
    fireEvent.change(screen.getByRole('textbox', { name: /Subject/ }), { target: { value: 'Sample subject changed' } })
    await settle(2_200)
    const line = () => document.querySelector<HTMLElement>('[data-slot="saved-line"]')!
    await waitFor(() => expect(line().textContent).toContain('Player Two sent this letter'))
    expect(line().textContent).toContain('Nothing more is saved to it.')
    expect(within(line()).queryByRole('button', { name: 'Show their letter' })).toBeNull()
    // The server holds no open letter once its letter is sent.
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    fireEvent.click(within(line()).getByRole('button', { name: 'Start the next letter' }))
    const ask = screen.getByRole('dialog', { name: 'Start the next letter?' })
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(1)
    fireEvent.click(within(ask).getByRole('button', { name: 'Start the next letter' }))
    await settle()
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(2)
    await waitFor(() => expect(line().textContent).not.toContain('sent this letter'))
    expect(screen.getByText(/Not saved yet/)).toBeTruthy()
    expect(sends).toEqual([])
  }, 15_000)
})

describe('switched on, what a send in progress says and draws', () => {
  const row = (status: string, sentCount: number) => ({ id: 'campaign-sample-0', subject: 'Sample subject', status, sentCount, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: status === 'sending' ? null : '2026-11-16 20:05:00' })
  const withRow = (status: string, sentCount: number) => count({ summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [row(status, sentCount)], waits: null } })
  const moving = (root: Element) => [root, ...root.querySelectorAll('*')].filter((node) => /animate|transition/.test(node.getAttribute('class') ?? ''))

  it('changes how far it has gone as it reads again, says nothing in the status line until it ends, then says the end once with its mark beside the words', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, withRow('sending', 40), withRow('sending', 90), withRow('completed', 155))
    await thePage()
    const progress = () => theBar().querySelector<HTMLElement>('[data-slot="send-progress"]')
    expect(progress()?.textContent).toBe('Sending, 40 of 155')
    expect(statusLine().textContent).toBe('')
    await waitFor(() => expect(progress()?.textContent).toBe('Sending, 90 of 155'), { timeout: 4_000 })
    expect(statusLine().textContent).toBe('')
    await waitFor(() => expect(statusLine().textContent).toBe('Sent to 155 people.'), { timeout: 4_000 })
    expect(progress()).toBeNull()
    const mark = statusLine().querySelector('svg') as SVGElement
    expect(mark).not.toBeNull()
    expect(mark.parentElement?.textContent).toBe('Sent to 155 people.')
    const reads = countReads()
    await settle(3_500)
    expect(countReads()).toBe(reads)
    expect(statusLine().textContent).toBe('Sent to 155 people.')
  }, 20_000)

  it('draws nothing that moves on the phone bar\'s row or in the sheet\'s row while sending', async () => {
    flags.mailPageSend = true
    windowAt(390)
    on('GET', COUNT_URL, withRow('sending', 40))
    await thePage()
    const barProgress = theBar().querySelector('[data-slot="send-progress"]') as HTMLElement
    expect(moving(barProgress.parentElement as HTMLElement)).toEqual([])
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    await settle()
    const foot = document.querySelector('[data-slot="email-sheet-foot"]') as HTMLElement
    const sheetRow = foot.querySelector('[data-slot="sheet-send-row"]') as HTMLElement
    expect(within(sheetRow).getByRole('button', { name: 'Stop sending' })).toBeTruthy()
    expect(moving(sheetRow)).toEqual([])
  })

  it('asks before stopping in an alertdialog with its title and description, each answer at least 44 pixels high', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', COUNT_URL, withRow('sending', 40))
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'Stop sending' }))
    const question = await screen.findByRole('alertdialog', { name: 'Stop the newsletter?' })
    expect(question.getAttribute('aria-modal')).toBe('true')
    const describedBy = question.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(describedBy)?.textContent).toBe('Addresses not yet reached won\'t get it.')
    for (const button of within(question).getAllByRole('button')) expect(button.className).toContain('min-h-11')
  })
})
