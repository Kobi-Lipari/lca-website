// @vitest-environment jsdom
//
// The edges of Send on the newsletter's own page, through the whole App, with
// the server answered by a stand-in for fetch, as
// test/unit/admin-newsletter-send.test.tsx draws the page:
// - switched off, the page asks the server for the open letter and the count
//   once as it opens, as it did before the page's Send, and for nothing more
//   on a press of Send or while it stays open, at a desk and on a phone;
// - opened again while a send is on its way, it shows how far the send has
//   gone and Stop sending, says nothing and offers no second Send;
// - a letter whose subject is spaces alone, a starter left untouched, and a
//   page with no stored letter each say why, open no question and post
//   nothing;
// - pressed while a save of new words is on its way, Send waits for it, says
//   why when it fails, and sends the version it made when it lands;
// - pressed while a test is on its way, Send does not wait for the test.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { STARTER_IDS, defaultSubject } from '@domain/mail/letter'
import { SEND_NO_SUBJECT, SEND_NO_WORDS } from '@domain/mail/newsletterWords'
import { starterLetter } from '../../functions/utils/mail/issues'
import { ALREADY_SENDING, LINK_KEY_MISSING, NOBODY_ON_THE_LIST, SEND_CHANGED, WAITS_FOR_SES, sendTooLong } from '../../functions/utils/mail/newsletterAnswers'
import { contracts } from '@domain/contracts/registry'
import { errorBodySchema } from '@domain/contracts/common'
import { newsletterIssueRefusedSchema } from '@domain/contracts/newsletter'
import { ApiError } from '@/lib/http'
import { sendNewsletterIssue } from '@/areas/admin/api'

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
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'
/** The newsletter's requests as the page opens, as they were before the page's Send: the letter and the count. */
const OPEN_CALLS = [`GET ${COUNT_URL}`, `GET ${ISSUE_URL}`]
const MONTH = 'December 2026'
const ADDRESS = 'admin@example.org'

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
const count = () => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'ses', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null } },
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

describe('switched off, every request the page makes', () => {
  it.each([1440, 390])('is the open letter and one count read as it opens at %i pixels, and nothing more on a press of Send or while it stays open', async (px) => {
    windowAt(px)
    await thePage()
    const opened = calls.filter((call) => call.includes('/api/admin/mail/'))
    expect(opened.filter((call) => call === `GET ${COUNT_URL}`)).toEqual([`GET ${COUNT_URL}`])
    expect(opened.filter((call) => !call.startsWith('GET '))).toEqual([])
    expect([...new Set(opened)].sort()).toEqual(OPEN_CALLS)
    const before = calls.length
    const send = within(theBar()).queryByRole('button', { name: '3 Send to 155 people' })
    if (send) {
      act(() => send.focus())
      fireEvent.click(send)
      fireEvent.keyDown(send, { key: 'Enter' })
    }
    await settle(3_500)
    expect(calls.slice(before)).toEqual([])
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  }, 15_000)
})

describe('switched on, the page opened again while a send is on its way', () => {
  // The page reads no sender from the count, so the sender opening it again
  // and another person opening it are drawn alike.
  it('shows how far it has gone and Stop sending, says nothing, and offers no second Send, to the sender and to anyone else alike', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    const row = { id: 'campaign-sample-0', subject: 'Sample subject', status: 'sending', sentCount: 40, totalRecipients: 155, createdAt: '2026-11-16 20:00:00', sentAt: null }
    const body = { ...count().body, summary: { ...count().body.summary, recent: [row] } }
    on('GET', COUNT_URL, { status: 200, body })
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    await thePage()
    const progress = theBar().querySelector('[data-slot="send-progress"]') as HTMLElement
    expect(progress.textContent).toBe('Sending, 40 of 155')
    expect(within(theBar()).getByRole('button', { name: 'Stop sending' })).not.toBeNull()
    expect(within(theBar()).queryByRole('button', { name: /^3 Send/ })).toBeNull()
    expect(statusLine().textContent).toBe('')
    expect(sends).toEqual([])
  })
})

describe("the page's send call against the server's contract for it", () => {
  const contract = contracts['admin/mail/newsletter/issue/send'].POST
  const refusedBody = (reason: 'changed' | 'sent' | 'set_aside') => newsletterIssueRefusedSchema.parse({ error: SEND_CHANGED, reason, changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' })

  it('sends a body the contract takes, the id and version alone, and reads a 201 the contract makes as the send made', async () => {
    const made = contract.response.parse({ campaignId: 'campaign-sample-1', totalRecipients: 155, status: 'sending' })
    on('POST', SEND_URL, { status: 201, body: made })
    const outcome = await sendNewsletterIssue({ issueId: 'sample-letter-1', version: 3 })
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(contract.request.parse(sends[0])).toEqual({ issueId: 'sample-letter-1', version: 3 })
    expect(outcome).toEqual({ sent: made })
  })

  it.each(['changed', 'sent', 'set_aside'] as const)('reads a 409 for a letter %s since as a refusal with who and when, not an error', async (reason) => {
    on('POST', SEND_URL, { status: 409, body: refusedBody(reason) })
    expect(await sendNewsletterIssue({ issueId: 'sample-letter-1', version: 3 })).toEqual({ refused: refusedBody(reason) })
  })

  it.each([
    ['409 while the site sends through Resend', 409, WAITS_FOR_SES],
    ['409 while another send is on its way', 409, ALREADY_SENDING],
    ['400 for a letter with no subject', 400, SEND_NO_SUBJECT],
    ['400 for a list with nobody on it', 400, NOBODY_ON_THE_LIST],
    ['413 for a letter too long', 413, sendTooLong(12)],
    ['404 switched off or not the newsletter', 404, 'Not found'],
    ['503 with no link key', 503, LINK_KEY_MISSING],
  ])('throws the %s with its status and the server\'s own words', async (_name, status, words) => {
    on('POST', SEND_URL, { status, body: errorBodySchema.parse({ error: words }) })
    const thrown = await sendNewsletterIssue({ issueId: 'sample-letter-1', version: 3 }).catch((error: unknown) => error)
    expect(thrown).toBeInstanceOf(ApiError)
    expect((thrown as ApiError).status).toBe(status)
    expect((thrown as ApiError).message).toBe(words)
  })
})

describe('switched on, Send pressed while the save of new words is on its way', () => {
  const subjectBox = () => screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement
  const puts = () => calls.filter((call) => call === `PUT ${ISSUE_URL}`).length

  it.each([
    ['failed', { status: 500, body: { error: 'Something went wrong' } }, 'Your words could not be saved, so nothing was sent. Try again in a moment.'],
    ['refused in words', { status: 413, body: { error: 'This letter is too long for one email. Make it shorter, then save again.' } }, 'Your words could not be saved, so nothing was sent.'],
    ['met a 409', { status: 409, body: { error: 'Sample refusal words', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' } }, 'Your words could not be saved, so nothing was sent.'],
  ])('waits for that save, and when it %s says nothing was sent, opens no question and posts nothing', async (_why, answer, words) => {
    flags.mailPageSend = true
    windowAt(1440)
    let give: (value: Answer) => void = () => {}
    on('PUT', ISSUE_URL, new Promise<Answer>((resolve) => { give = resolve }))
    await thePage()
    fireEvent.change(subjectBox(), { target: { value: 'Sample subject two' } })
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(puts()).toBe(1)
    expect(statusLine().textContent).toBe('Saving your words first...')
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await act(async () => give(answer))
    await settle()
    expect(statusLine().textContent).toBe(words)
    expect(focused()).toBe(send)
    expect(sends).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('once that save lands, asks with the count and sends the version that save made', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    let give: (value: Answer) => void = () => {}
    on('PUT', ISSUE_URL, new Promise<Answer>((resolve) => { give = resolve }))
    await thePage()
    fireEvent.change(subjectBox(), { target: { value: 'Sample subject two' } })
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await settle()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await act(async () => give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } }))
    const question = await screen.findByRole('alertdialog', { name: 'Send to 155 people?' })
    fireEvent.click(within(question).getByRole('button', { name: 'Send' }))
    await settle()
    expect(puts()).toBe(1)
    expect(sends).toHaveLength(1)
    expect(sends[0]).toMatchObject({ issueId: 'sample-letter-1', version: 4 })
  })
})

describe('switched on, Send while a test is on its way', () => {
  it('does not wait for the test: it asks its question while the test has no answer yet', async () => {
    flags.mailPageSend = true
    windowAt(1440)
    on('POST', '/api/admin/mail/newsletter/test', new Promise<Answer>(() => {}))
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: '2 Send a test to me' }))
    await settle()
    expect(calls.filter((call) => call === 'POST /api/admin/mail/newsletter/test')).toHaveLength(1)
    act(() => sendStep().focus())
    fireEvent.click(sendStep())
    await waitFor(() => expect(screen.getByRole('alertdialog', { name: 'Send to 155 people?' })).not.toBeNull())
    expect(sends).toEqual([])
  })
})

describe('switched on, a letter Send refuses before its question', () => {
  it.each([
    ['a subject of spaces alone', { status: 200, body: letter({ subject: '   ' }) }, SEND_NO_SUBJECT],
    ["one of LCA's starters left untouched", { status: 200, body: letter({ bodyHtml: starterLetter(STARTER_IDS[0]) }) }, SEND_NO_WORDS],
    ['no letter stored yet', { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } }, SEND_NO_WORDS],
  ])('says why for %s, keeps the focus on Send and posts nothing', async (_name, stored, words) => {
    flags.mailPageSend = true
    windowAt(1440)
    on('GET', ISSUE_URL, stored)
    await thePage()
    const send = sendStep()
    act(() => send.focus())
    fireEvent.click(send)
    await settle()
    expect(statusLine().textContent).toBe(words)
    expect(focused()).toBe(send)
    expect(sends).toEqual([])
    expect(calls.filter((call) => call === `POST ${SEND_URL}`)).toEqual([])
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})
