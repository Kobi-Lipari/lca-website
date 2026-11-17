// @vitest-environment jsdom
//
// "Send a test to me" from the newsletter's own page (WS16 part two, page
// step 6, the test half), through the whole App, with the server answered
// by a stand-in for fetch, as the bar's own test file draws the page.
//
// - Step 2 is ready from 768 pixels up. A press saves the words on the page
//   first, by the path the chooser's start uses, and a save that cannot be
//   made sends nothing; then one request asks for a test of the letter and
//   version the page then holds. While it is on its way the step says so in
//   words and cannot be pressed again; the answer is said in the bar's status
//   line, in words: "Test sent to" and the address, or the refusal's own
//   words. The focus stays on the step, by a press, a key or a touch alike.
// - Step 3 stays drawn as it was and not available, and says why on a
//   press, a key or a touch, asking nothing of the server.
// - The status line: one polite region in the bar, on the page and empty
//   before anything is pressed. On a phone the bar draws no second step and
//   no status line.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject } from '@domain/mail/letter'
import { TEST_NO_WORDS, WAITS_FOR_SES } from '@domain/mail/newsletterWords'

const flags = vi.hoisted(() => ({ mailLists: true, mailPage: true }))
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
const TEST_URL = '/api/admin/mail/newsletter/test'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'
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
let puts: Array<Record<string, unknown>> = []
let tests: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Given[]) => {
  answers[`${method} ${url}`] = list
}
/** A deferred answer: the request waits until `give` is called. */
function later(): { answer: Promise<Answer | 'network'>; give: (value: Answer | 'network') => Promise<void> } {
  let resolve: (value: Answer | 'network') => void = () => {}
  const answer = new Promise<Answer | 'network'>((done) => {
    resolve = done
  })
  return {
    answer,
    give: async (value) => {
      await act(async () => {
        resolve(value)
      })
      await settle()
    },
  }
}
const letter = (extra: Record<string, unknown> = {}) => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: BODY, createdAt: '2026-11-16 15:00:00', updatedAt: '2026-11-16 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-16 20:15:00',
})
const NONE = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
const count = () => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null } },
})
const SENT = { status: 200, body: { sent: true, to: ADDRESS } }
const refusedWith = (reason: string, by = 'Player Two') => ({ status: 409, body: { error: 'Sample refusal words', reason, changedBy: by, changedAt: '2026-11-16 20:17:00' } })

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
  answers = {}
  calls = []
  puts = []
  tests = []
  flags.mailLists = true
  flags.mailPage = true
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'PUT') puts.push(JSON.parse(String(init?.body)))
    if (method === 'POST' && url === TEST_URL) tests.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (await (list && list.length > 1 ? list.shift() : list?.[0])) ?? { status: 404, body: { error: 'Not found' } }
    if (answer === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, count())
  on('PUT', ISSUE_URL, { status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
  on('POST', TEST_URL, SENT)
})
afterEach(() => {
  cleanup()
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
/** The page drawn afresh for a case of a loop, its requests counted from nothing. */
async function again() {
  cleanup()
  await settle()
  calls = []
  puts = []
  tests = []
}
const focused = () => document.activeElement as HTMLElement
const key = (target: Element, name: string) => fireEvent.keyDown(target, { key: name })
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const testStep = () => within(theBar()).getByRole('button', { name: '2 Send a test to me' })
const sendStep = () => within(theBar()).getByRole('button', { name: '3 Send to 155 people' })
const statusLine = () => within(theBar()).getByRole('status')
const subject = () => screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement
const savedLine = () => document.querySelector('[data-slot="saved-line"]') as HTMLElement
const urgentLine = () => within(savedLine()).getByRole('alert').textContent ?? ''

/** A press as each kind of person makes one: a browser turns a key and a touch on a button into its click. */
function pressBy(how: 'mouse' | 'key' | 'touch', target: HTMLElement) {
  if (how === 'mouse') {
    fireEvent.pointerDown(target, { button: 0 })
    fireEvent.mouseDown(target, { button: 0 })
    fireEvent.pointerUp(target, { button: 0 })
    fireEvent.mouseUp(target, { button: 0 })
  } else if (how === 'key') {
    act(() => target.focus())
    key(target, 'Enter')
  } else {
    fireEvent.pointerDown(target, { pointerType: 'touch' })
    fireEvent.pointerUp(target, { pointerType: 'touch' })
  }
  fireEvent.click(target)
}

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

describe('step 2, "Send a test to me", from 768 pixels up', () => {
  it('is ready: no longer marked unavailable, named by its number and its words, drawn as the board draws it, and reached by Tab', async () => {
    windowAt(1440)
    await thePage()
    const step = testStep()
    expect(step.hasAttribute('aria-disabled')).toBe(false)
    expect(step.hasAttribute('disabled')).toBe(false)
    expect(step.tabIndex).toBe(0)
    expect(step.getAttribute('type')).toBe('button')
    // It opens nothing, so it says it opens nothing.
    expect(step.hasAttribute('aria-haspopup')).toBe(false)
    // The board's white step with its navy edge, as the first step is drawn ready, not the quiet colours of a step not yet available.
    for (const look of ['border-ink', 'bg-background', 'text-ink']) expect(step.className, look).toContain(look)
    expect(step.className).not.toContain('text-muted-foreground')
    // Nothing is asked of the server until it is pressed.
    expect(tests).toEqual([])
  })

  it('saves the words typed since the last save first, by the chooser\'s own path, then tests the letter at the version that save gave, and says where it went', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample subject of my own' } })
    const step = testStep()
    act(() => step.focus())
    fireEvent.click(step)
    await settle()
    // The pause is cut short: the save goes at once, carrying the words typed, and the test goes only once it has answered.
    expect(puts).toHaveLength(1)
    expect(puts[0]).toMatchObject({ id: 'sample-letter-1', version: 3, subject: 'Sample subject of my own' })
    expect(tests).toEqual([{ issueId: 'sample-letter-1', version: 4 }])
    expect(calls.indexOf(`PUT ${ISSUE_URL}`)).toBeLessThan(calls.indexOf(`POST ${TEST_URL}`))
    expect(statusLine().textContent).toBe(`Test sent to ${ADDRESS}.`)
    expect(focused()).toBe(step)
    // The body names the letter and nothing else: no address, no words.
    expect(Object.keys(tests[0])).toEqual(['issueId', 'version'])
  })

  it('with nothing typed since the last save, reads the letter to learn the server still holds it at that version, then tests that version, saving nothing', async () => {
    windowAt(1440)
    await thePage()
    const reads = () => calls.filter((call) => call === `GET ${ISSUE_URL}`).length
    const before = reads()
    fireEvent.click(testStep())
    await settle()
    expect(reads()).toBe(before + 1)
    expect(puts).toEqual([])
    expect(tests).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(statusLine().textContent).toBe(`Test sent to ${ADDRESS}.`)
  })

  it('says so on the step while the test is on its way, cannot be pressed again then, keeps the focus on it, and is ready again once it has answered', async () => {
    windowAt(1440)
    const answer = later()
    on('POST', TEST_URL, answer.answer)
    await thePage()
    const step = testStep()
    act(() => step.focus())
    fireEvent.click(step)
    await settle()
    const busy = within(theBar()).getByRole('button', { name: '2 Sending a test' })
    expect(busy).toBe(step)
    expect(busy.getAttribute('aria-disabled')).toBe('true')
    expect(focused()).toBe(busy)
    // Heard on the status line, and not drawn there, since the step says it.
    expect(statusLine().textContent).toBe('Sending a test to your address.')
    expect(statusLine().querySelector('.sr-only')?.textContent).toBe('Sending a test to your address.')
    for (const how of ['mouse', 'key', 'touch'] as const) pressBy(how, busy)
    await settle()
    expect(tests).toHaveLength(1)
    await answer.give(SENT)
    expect(testStep()).toBe(step)
    expect(step.hasAttribute('aria-disabled')).toBe(false)
    expect(focused()).toBe(step)
    expect(statusLine().textContent).toBe(`Test sent to ${ADDRESS}.`)
  })

  it('sends once for each press, by a press, a key or a touch, the focus on the step each time', async () => {
    windowAt(1440)
    await thePage()
    const step = testStep()
    let sent = 0
    for (const how of ['mouse', 'key', 'touch'] as const) {
      act(() => step.focus())
      pressBy(how, step)
      await settle()
      sent += 1
      expect(tests, how).toHaveLength(sent)
      expect(focused(), how).toBe(step)
      expect(statusLine().textContent, how).toBe(`Test sent to ${ADDRESS}.`)
    }
    // A key on its own, with no click from the browser, sends nothing.
    key(step, 'Enter')
    await settle()
    expect(tests).toHaveLength(sent)
  })

  it('sends nothing when the save first cannot be made: the saved line says why, as for any save, and the status line that no test was sent', async () => {
    const cases = [
      ['refused in words', { status: 413, body: { error: 'This letter is too long for one email. Make it shorter, then save again.' } }, 'Your words could not be saved, so no test was sent.', 'This letter is too long for one email. Make it shorter, then save again.'],
      ['failed', { status: 500, body: { error: 'Something went wrong' } }, 'Your words could not be saved, so no test was sent. Try again in a moment.', 'Could not save'],
      ['met a 409', refusedWith('changed'), 'Your words could not be saved, so no test was sent.', 'Player Two changed this letter'],
    ] as const
    for (const [why, answer, words, notice] of cases) {
      await again()
      windowAt(1440)
      on('PUT', ISSUE_URL, answer)
      await thePage()
      fireEvent.change(subject(), { target: { value: 'Sample subject two' } })
      fireEvent.click(testStep())
      await settle()
      expect(puts, why).toHaveLength(1)
      expect(tests, why).toEqual([])
      expect(statusLine().textContent, why).toBe(words)
      expect(urgentLine(), why).toContain(notice)
    }
  })

  it('says the server\'s own words for a test it refuses, and that the test could not be sent for an answer with none', async () => {
    const cases: Array<[string, Given, string]> = [
      ['a letter with no words', { status: 400, body: { error: TEST_NO_WORDS } }, TEST_NO_WORDS],
      ['the mail service', { status: 502, body: { error: 'Failed to send test email: Resend 500: Sample words' } }, 'Failed to send test email: Resend 500: Sample words'],
      ['no link key', { status: 503, body: { error: 'Not sent: the mail link key is missing on this deployment.' } }, 'Not sent: the mail link key is missing on this deployment.'],
      ['an account with no usable address', { status: 403, body: { error: "A test goes to your own account's email address." } }, "A test goes to your own account's email address."],
      ['a page from the edge', { status: 502, body: '<html>Bad gateway</html>' }, 'The test could not be sent. Try again in a moment.'],
      ['no answer at all', 'network', 'The test could not be sent. Try again in a moment.'],
    ]
    for (const [why, answer, words] of cases) {
      await again()
      windowAt(1440)
      on('POST', TEST_URL, answer)
      await thePage()
      const step = testStep()
      act(() => step.focus())
      fireEvent.click(step)
      await settle()
      expect(tests, why).toHaveLength(1)
      expect(statusLine().textContent, why).toBe(words)
      // Nothing sent has a mark of its own beside its words, never colour alone.
      expect(statusLine().querySelector('svg[aria-hidden="true"]'), why).not.toBeNull()
      expect(focused(), why).toBe(step)
      // The step is ready for another press, and nothing was tried again by itself.
      expect(step.hasAttribute('aria-disabled'), why).toBe(false)
      await settle(200)
      expect(tests, why).toHaveLength(1)
    }
  })

  it('answers a 409 as a save\'s 409 is answered: the saving stops, the saved line says who and when with "Show their letter", and the status line that no test was sent', async () => {
    windowAt(1440)
    on('POST', TEST_URL, refusedWith('changed'))
    await thePage()
    fireEvent.click(testStep())
    await settle()
    expect(statusLine().textContent).toBe('No test was sent: someone else has changed, replaced or sent this letter. See who and when at the top of the page.')
    expect(urgentLine()).toContain('Player Two changed this letter')
    expect(within(savedLine()).getByRole('button', { name: 'Show their letter' })).toBeTruthy()
    // A second press finds the saving stopped and sends nothing more.
    fireEvent.click(testStep())
    await settle()
    expect(tests).toHaveLength(1)
    expect(statusLine().textContent).toBe('No test was sent: someone else has changed, replaced or sent this letter. See who and when at the top of the page.')
  })

  it('takes a 409 that meets the page\'s own save on its way for the page\'s own doing: nothing stops, and the status line asks for another test', async () => {
    windowAt(1440)
    const test = later()
    on('POST', TEST_URL, test.answer)
    const save = later()
    await thePage()
    fireEvent.click(testStep())
    await settle()
    expect(tests).toHaveLength(1)
    // Words typed while the test is on its way are saved after the pause, and that save is still on its way when the test answers.
    on('PUT', ISSUE_URL, save.answer)
    fireEvent.change(subject(), { target: { value: 'Sample subject three' } })
    await settle(2100)
    expect(puts).toHaveLength(1)
    await test.give(refusedWith('changed', 'Player One'))
    expect(statusLine().textContent).toBe('No test was sent, since your words changed as it went. Send a test again.')
    await save.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:21:00', bodyHtml: null } })
    expect(within(savedLine()).queryByRole('button', { name: 'Show their letter' })).toBeNull()
    expect(urgentLine()).toBe('')
  })

  it('sends nothing for a letter the server holds no row for yet, and says it has no words', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: NONE })
    await thePage()
    fireEvent.click(testStep())
    await settle()
    expect(puts).toEqual([])
    expect(tests).toEqual([])
    expect(statusLine().textContent).toBe(TEST_NO_WORDS)
  })
})

describe('step 3, Send, not yet available', () => {
  it('stays drawn as it was and marked unavailable, and says why on a press, a key or a touch, in the newsletter tab\'s own words, opening nothing and asking nothing of the server', async () => {
    windowAt(1440)
    await thePage()
    const send = sendStep()
    expect(send.getAttribute('aria-disabled')).toBe('true')
    expect(send.tabIndex).toBe(0)
    expect(send.hasAttribute('aria-haspopup')).toBe(false)
    // Its gold drawn quiet, as the bar's first part drew it.
    expect(send.querySelector('.grayscale-60')).not.toBeNull()
    for (const how of ['mouse', 'key', 'touch'] as const) {
      // A test first, so each press is seen to change the line back to Send's words.
      fireEvent.click(testStep())
      await settle()
      expect(statusLine().textContent, how).toBe(`Test sent to ${ADDRESS}.`)
      const before = calls.length
      act(() => send.focus())
      pressBy(how, send)
      await settle()
      expect(statusLine().textContent, how).toBe(WAITS_FOR_SES)
      expect(calls.slice(before), how).toEqual([])
      expect(focused(), how).toBe(send)
      expect(send.getAttribute('aria-disabled'), how).toBe('true')
    }
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    // The words are true under K's decision 73: the real Send waits for the move to Amazon SES, and a test can be sent now.
    expect(WAITS_FOR_SES).toBe('The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.')
  })
})

describe('the bar\'s status line', () => {
  it('is one polite region inside the bar, after the steps, on the page and empty before anything is pressed, and never takes the focus', async () => {
    windowAt(1440)
    await thePage()
    const line = statusLine()
    expect(within(theBar()).getAllByRole('status')).toEqual([line])
    expect(line.getAttribute('aria-atomic')).toBe('true')
    expect(line.textContent).toBe('')
    expect(line.hasAttribute('tabindex')).toBe(false)
    expect(sendStep().compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The same region carries each answer, so a screen reader hears each one where the person is.
    fireEvent.click(testStep())
    await settle()
    expect(statusLine()).toBe(line)
    expect(line.textContent).toBe(`Test sent to ${ADDRESS}.`)
    // A test sent has its tick beside its words.
    expect(line.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    fireEvent.click(sendStep())
    expect(statusLine()).toBe(line)
    expect(line.textContent).toBe(WAITS_FOR_SES)
    expect(line.querySelector('svg')).toBeNull()
    // The line adds no button: the bar's buttons are still its four, in their order.
    expect(within(theBar()).getAllByRole('button')).toEqual(
      ['More options', '1 Pick a template to start from', '2 Send a test to me', '3 Send to 155 people'].map((name) => within(theBar()).getByRole('button', { name })),
    )
  })

  it('is not drawn on a phone, whose bar has no second step, as the board draws it', async () => {
    windowAt(390)
    await thePage()
    expect(within(theBar()).getAllByRole('button').map((button) => button.textContent)).toEqual(['Pick a template', 'See the email'])
    expect(within(theBar()).queryByRole('status')).toBeNull()
    expect(within(theBar()).queryByRole('button', { name: /Send a test/ })).toBeNull()
  })
})
