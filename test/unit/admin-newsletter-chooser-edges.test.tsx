// @vitest-environment jsdom
//
// Edges of the chooser of templates and past newsletters, the question before
// a letter is replaced and the first step's cue (WS16 part two, page step 5,
// second part), beside test/unit/admin-newsletter-chooser.test.tsx, whose
// harness this file's is, trimmed to what these cases use.
// - The last newsletters: each "Use this" told from the others even when two
//   rows share a month, a state and a day; days and times across midnight and
//   across both of Central time's clock changes, whatever the machine's own
//   zone; a row with no letter or send behind it left out, a send with no
//   count said without one, rows that tie kept in the server's order; a very
//   long subject kept inside its row; the rows of an earlier opening never
//   shown while the next is read.
// - The plain-language rules over every word the chooser and its question
//   say: no dash, no old name for US Chess, no ".5", no 24-hour time, a
//   weekday on every date, none of the tournament templates and none of the
//   board's two explaining lines.
// - Nothing is lost or doubled: no save when nothing is unsaved, the save on
//   its way waited for and not sent twice, nothing closing the chooser while
//   the words are saved first, one start from a double press on "Use this"
//   or on "Replace it", and from two presses in one task, a start that
//   failed pressed again, the words of an earlier refusal gone when it opens
//   again, the saving stopped after a start's 409, a press outside the
//   question answering nothing, and a page left while a start is on its way;
//   with nothing to save, the read made first said in words while it is on
//   its way, nothing started when it gets no answer or when the page is left
//   meanwhile, nor the save sent to learn who changed the letter, whether the
//   read then finds the page's own letter or another person's newer one,
//   nothing more started on a second try after a start whose answer was lost
//   though it reached the server, and a save of the page's own that it never
//   heard back about, found by that read, taken and saved over before the
//   start; the save sent to learn who changed the letter said nowhere but by
//   its 409, and nothing started when it comes back with neither; a second
//   press once the saving has stopped, with nothing typed since, said as the
//   letter changed on the server; a start whose sign-in is refused said in
//   the chooser's words.
// - The waits: the read made first, and a save waited for, let go after
//   SAVE_FIRST_WAIT_MS on the test's own clock, each late answer doing only
//   what it always does. Once the save sent to learn who changed the letter
//   has been let go still on its way: a second press said as the read is,
//   never as words being saved, while nothing has been typed since, and as a
//   save of words once words have; words typed meanwhile said as saving and
//   sent at once when that save fails, the saved line back on the last save
//   if they were written back as they were saved; and nothing asked as the
//   page is left with nothing unsaved. The same while the letter is read
//   again after that save's 409: a second press said as the read is, and
//   nothing asked as the page is left.
// - The focus the question gives back: to the "Use this" whose press was
//   taken, not one pressed while the words were saved first.
// - The cue: with no open letter at all, never with reduced motion on a
//   letter that holds words, and no ring again after a start.
// Every word, name and date here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject } from '@domain/mail/letter'
import { starterLetter } from '../../functions/utils/mail/issues'

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
const { SAVE_FIRST_WAIT_MS } = await import('@/areas/admin/newsletter/useIssue')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const COUNT_URL = '/api/admin/mail/newsletter'
const ISSUES_URL = '/api/admin/mail/newsletter/issues'
const START_URL = '/api/admin/mail/newsletter/issue/start'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'
const MONTH = 'December 2026'

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

interface Answer { status: number; body: unknown }
type Given = Answer | 'network' | Promise<Answer | 'network'>
let answers: Record<string, Given[]> = {}
let calls: string[] = []
let puts: Array<Record<string, unknown>> = []
let starts: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Given[]) => {
  answers[`${method} ${url}`] = list
}
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
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})
const emptyLetter = (extra: Record<string, unknown> = {}) => letter({ bodyHtml: '', ...extra })
const NONE = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
const startedAs = (bodyHtml: string, extra: Record<string, unknown> = {}) => ({
  status: 201,
  body: {
    issue: { id: 'sample-letter-2', version: 1, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml, createdAt: '2026-11-16 20:30:00', updatedAt: '2026-11-16 20:30:00', ...extra },
    state: 'draft', lastSavedBy: 'Player One', lastSavedAt: '2026-11-16 20:30:00',
  },
})
const count = () => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null } },
})
const row = (extra: Record<string, unknown> = {}) => ({
  issueId: 'sample-letter-0', campaignId: null, monthLabel: 'Example: November 2026', subject: defaultSubject('November 2026'), state: 'set_aside',
  at: '2026-11-16 20:15:00', by: null, totalRecipients: null, ...extra,
})
const issues = (...list: unknown[]) => ({ status: 200, body: { issues: list } })
const refusedWith = (reason: string, by = 'Player Two') => ({ status: 409, body: { error: 'Sample refusal words', reason, changedBy: by, changedAt: '2026-11-16 20:17:00' } })

const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'member-sample-admin', session_id: 'session-sample-admin', aal: 'aal2', role: 'authenticated' })}.sample-signature`
const ADMIN = {
  user: { id: 'member-sample-admin', email: 'admin@example.org', user_metadata: { role: 'lca_admin' } },
  session: { access_token: TOKEN },
  member: { id: 'member-sample-admin', email: 'admin@example.org', full_name: 'Player One', role: 'lca_admin', club_id: null, membership_status: 'active' },
  role: 'lca_admin', seats: [], managedClubs: [], isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false,
  refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [], loading: false, memberLoading: false,
  signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
} as unknown as AuthContextValue

let animations: Array<{ on: HTMLElement; frames: Keyframe[]; options: KeyframeAnimationOptions; cancel: ReturnType<typeof vi.fn> }> = []

beforeEach(() => {
  window.localStorage.setItem('lca-newsletter-page-help', 'shown') // Help has been seen once, so it does not open by itself here.
  answers = {}
  calls = []
  puts = []
  starts = []
  animations = []
  flags.mailLists = true
  flags.mailPage = true
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'PUT') puts.push(JSON.parse(String(init?.body)))
    if (method === 'POST' && url === START_URL) starts.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (await (list && list.length > 1 ? list.shift() : list?.[0])) ?? { status: 404, body: { error: 'Not found' } }
    if (answer === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function animate(this: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const cancel = vi.fn()
      animations.push({ on: this, frames, options, cancel })
      return { cancel } as unknown as Animation
    },
  })
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, count())
  on('GET', ISSUES_URL, issues())
  on('PUT', ISSUE_URL, { status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
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
const key = (target: Element, name: string) => fireEvent.keyDown(target, { key: name })
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const pickWide = () => within(theBar()).getByRole('button', { name: '1 Pick a template to start from' })
const chooser = () => screen.getByRole('dialog', { name: 'Pick a template to start from' })
const noChooser = () => screen.queryByRole('dialog', { name: 'Pick a template to start from' })
const question = () => screen.queryByRole('alertdialog', { name: 'Replace this letter?' })
const buttonFor = (name: string) => within(chooser()).getByRole('button', { name: `Use this: ${name}` })
const subject = () => screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement
const savedLine = () => document.querySelector('[data-slot="saved-line"]') as HTMLElement
const scrim = () => document.querySelector('[data-slot="chooser-scrim"]') as HTMLElement
function press(target: Element) {
  fireEvent.pointerDown(target, { button: 0 })
  fireEvent.mouseDown(target, { button: 0 })
  fireEvent.pointerUp(target, { button: 0 })
  fireEvent.mouseUp(target, { button: 0 })
  fireEvent.click(target, { button: 0 })
}
async function again() {
  cleanup()
  await settle()
  starts = []
  puts = []
  calls = []
}
async function openFrom(step: HTMLElement) {
  act(() => step.focus())
  fireEvent.click(step)
  await settle()
  return chooser()
}
function windowAt(px: number, { reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query === '(prefers-reduced-motion: reduce)') return reducedMotion
      const line = /^\(min-width: (\d+)px\)$/.exec(query)
      return line !== null && px >= Number(line[1])
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
/** Every "Use this" in the chooser, by the name a screen reader gives it. */
const useLabels = () => within(chooser()).getAllByRole('button').map((b) => b.getAttribute('aria-label')).filter((label): label is string => !!label && label.startsWith('Use this: '))
/** The words the chooser's alerts say now, the empty ones left out. */
const alertsIn = () => within(chooser()).getAllByRole('alert').map((a) => a.textContent ?? '').filter((words) => words !== '').join(' | ')
/** The words the chooser's status regions say now. */
const statusesIn = () => within(chooser()).getAllByRole('status').map((s) => s.textContent)
/** The page's timers on the test's own clock, which also runs on with the real one, so the file's short waits still end. */
const testClock = () => vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] })
/** The test's clock moved on, each timer due run as it comes. */
const moveClock = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
/** A press after an earlier refusal with nothing typed since: the words stand alone in a chooser opened again. */
const CHANGED_BEFORE = 'No new letter was started: someone else has changed, replaced or sent this letter. Close this to see who and when.'

describe('your last newsletters, at their edges', () => {
  it('gives each "Use this" a name a screen reader can tell from the others, two letters of one month set aside on one day among them', async () => {
    windowAt(1440)
    on('GET', ISSUES_URL, issues(
      row({ issueId: 'sample-letter-9', monthLabel: MONTH, by: 'Player One', at: '2026-11-16 20:15:00' }),
      row({ issueId: 'sample-letter-8', monthLabel: MONTH, by: 'Player One', at: '2026-11-16 18:05:00' }),
    ))
    await thePage()
    await openFrom(pickWide())
    const labels = useLabels()
    expect(labels).toHaveLength(6)
    expect(new Set(labels).size, labels.join(' | ')).toBe(labels.length)
  })

  it('writes each day and time in Central time, across midnight and across both clock changes, whatever the machine\'s own zone is', async () => {
    windowAt(1440)
    // The spring change is Sunday, March 8, 2026 at 2:00 AM (8:00 AM UTC); the fall change is Sunday, November 1 at 2:00 AM (7:00 AM UTC).
    const stamps: Array<[string, string]> = [
      ['2026-03-08 05:59:59', 'Sat, Mar 7, 2026 at 11:59 PM'],
      ['2026-03-08 06:00:00', 'Sun, Mar 8, 2026 at 12:00 AM'],
      ['2026-03-09 04:59:59', 'Sun, Mar 8, 2026 at 11:59 PM'],
      ['2026-03-09 05:00:00', 'Mon, Mar 9, 2026 at 12:00 AM'],
      ['2026-11-01 04:59:59', 'Sat, Oct 31, 2026 at 11:59 PM'],
      ['2026-11-01 05:00:00', 'Sun, Nov 1, 2026 at 12:00 AM'],
      ['2026-11-02 05:59:59', 'Sun, Nov 1, 2026 at 11:59 PM'],
      ['2026-11-02 06:00:00', 'Mon, Nov 2, 2026 at 12:00 AM'],
      ['2026-12-31 05:59:59', 'Wed, Dec 30, 2026 at 11:59 PM'],
      ['2027-01-01 06:00:00', 'Fri, Jan 1, 2027 at 12:00 AM'],
    ]
    on('GET', ISSUES_URL, issues(...stamps.map(([at], n) => row({ issueId: `sample-letter-${n}`, monthLabel: `Example month ${n + 1}`, at }))))
    await thePage()
    const dialog = await openFrom(pickWide())
    const lines = within(dialog).getAllByRole('listitem').slice(4).map((item) => item.textContent?.replace(/Use this$/, ''))
    expect(lines).toEqual(stamps.map(([, day], n) => `Example month ${n + 1}Replaced by a newer letter on ${day}`))
  })

  it('draws no choice for a row with no letter or send behind it, says a send with no count without one, and keeps rows that tie in the server\'s order', async () => {
    windowAt(1440)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    on('GET', ISSUES_URL, issues(
      row({ issueId: null, campaignId: null, monthLabel: 'Example: nothing behind it' }),
      row({ issueId: null, campaignId: 'campaign-sample-1', monthLabel: '', subject: 'Sample send one', state: 'completed', totalRecipients: null }),
      row({ issueId: 'sample-letter-2', monthLabel: 'Example: tie one', at: '2026-11-16 20:15:00' }),
      row({ issueId: 'sample-letter-2', monthLabel: 'Example: tie one', at: '2026-11-16 20:15:00' }),
      row({ issueId: 'sample-letter-3', monthLabel: 'Example: tie two', at: '2026-11-16 20:15:00' }),
    ))
    await thePage()
    const dialog = await openFrom(pickWide())
    const lines = within(dialog).getAllByRole('listitem').slice(4).map((item) => item.textContent?.replace(/Use this$/, ''))
    expect(lines).toEqual([
      'Sample send oneSent Mon, Nov 16, 2026',
      'Example: tie oneReplaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM',
      'Example: tie oneReplaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM',
      'Example: tie twoReplaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM',
    ])
    expect(within(dialog).queryByText('Example: nothing behind it')).toBeNull()
    // The same letter twice, as a tie can make it, is no duplicate key.
    expect(errors.mock.calls.map((call) => String(call[0])).filter((text) => /same key|unique "key"/.test(text))).toEqual([])
  })

  it('keeps a very long subject inside its row, wrapping, with its "Use this" still there', async () => {
    windowAt(1440)
    const long = `Example ${'verylongunbrokenwords'.repeat(12)}`
    on('GET', ISSUES_URL, issues(row({ issueId: null, campaignId: 'campaign-sample-9', monthLabel: '', subject: long, state: 'completed', totalRecipients: 12 })))
    await thePage()
    const dialog = await openFrom(pickWide())
    const name = within(dialog).getByText(long)
    expect(name.className).toContain('[overflow-wrap:anywhere]')
    expect(name.parentElement?.className).toContain('min-w-0')
    expect(buttonFor(`${long}, sent Mon, Nov 16, 2026 to 12 members`).textContent).toBe('Use this')
  })

  it('shows none of an earlier opening\'s rows while the next opening is read', async () => {
    windowAt(1440)
    const slow = later()
    on('GET', ISSUES_URL, issues(row({ monthLabel: 'Example: earlier opening' })), slow.answer)
    await thePage()
    await openFrom(pickWide())
    expect(within(chooser()).getByText('Example: earlier opening')).toBeTruthy()
    key(focused(), 'Escape')
    await settle()
    await openFrom(pickWide())
    expect(within(chooser()).queryByText('Example: earlier opening')).toBeNull()
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Reading your last newsletters...')
    await slow.give(issues(row({ monthLabel: 'Example: later opening' })))
    expect(within(chooser()).getByText('Example: later opening')).toBeTruthy()
  })
})

describe('the plain-language rules over the chooser and its question', () => {
  /** The words a person could read in a part: its text and every name a screen reader gives its controls. */
  const wordsOf = (part: Element) =>
    [part.textContent ?? '', ...Array.from(part.querySelectorAll('[aria-label]'), (el) => el.getAttribute('aria-label') ?? '')].join('\n')

  it('holds no dash, no old name for US Chess, no ".5", no 24-hour time, a weekday on every date, and nothing of the tournament templates or the board\'s two lines', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    on('GET', ISSUES_URL, issues(
      row({ issueId: 'sample-letter-5', campaignId: 'campaign-sample-5', monthLabel: 'November 2026', state: 'completed', by: 'Player Two', totalRecipients: 155 }),
      row({ issueId: null, campaignId: 'campaign-sample-3', monthLabel: '', subject: 'Sample plain subject', state: 'sending', totalRecipients: 155 }),
      row({ issueId: null, campaignId: 'campaign-sample-2', monthLabel: '', subject: 'Sample failed subject', state: 'failed', totalRecipients: 20 }),
      row({ issueId: 'sample-letter-1', monthLabel: 'December 2026', state: 'set_aside', by: 'Player One' }),
    ))
    on('POST', START_URL, refusedWith('changed'))
    await thePage()
    const dialog = await openFrom(pickWide())
    fireEvent.click(buttonFor('Short notice'))
    await settle()
    const asked = question()!
    expect(asked).toBeTruthy()
    const said = [wordsOf(dialog), wordsOf(asked)].join('\n')
    fireEvent.click(within(asked).getByRole('button', { name: 'Replace it' }))
    await settle()
    const afterRefusal = wordsOf(chooser())
    expect(afterRefusal).toContain('No new letter was started.')

    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const oldName = new RegExp(`${'US'}${'CF'}`, 'i')
    for (const text of [said, afterRefusal]) {
      expect(text).not.toMatch(dashes)
      expect(text).not.toMatch(oldName)
      expect(text).not.toMatch(/\d\.5\b/)
      expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b(?!\s?[AP]M)/)
      // A refusal's time on an earlier day than the run's reads "on Monday, November 16, 2026 at 2:17 PM", its weekday in full.
      for (const day of text.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/g)) {
        expect(text.slice(Math.max(0, day.index - 11), day.index), day[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      // The tournament templates are the tournament send-outs'; the two lines under the board's chooser are Help's.
      expect(text).not.toMatch(/tournament announcement/i)
      expect(text).not.toContain('Pin it as a template')
      expect(text).not.toContain('keep your words in History')
      // No postal address anywhere.
      expect(text).not.toMatch(/\b(?:street|avenue|P\.?O\.? box)\b/i)
    }
    expect(said).toMatch(/\bMon, Nov 16, 2026\b/)
  })
})

describe('nothing is lost or doubled', () => {
  it('sends no save when every word is saved already, and waits for the save on its way instead of sending a second', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, startedAs(''))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle(80)
    expect(puts).toEqual([])
    expect(starts).toHaveLength(1)

    await again()
    // The letter as the server holds it once the save has answered, should it be read again.
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, subject: 'Sample subject one' }) })
    on('POST', START_URL, startedAs(''))
    await thePage()
    const slow = later()
    on('PUT', ISSUE_URL, slow.answer)
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    // The pause runs out and the save goes; it is on its way when the chooser opens and "Use this" is pressed.
    await settle(2100)
    expect(puts).toHaveLength(1)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle()
    expect(puts).toHaveLength(1)
    expect(starts).toEqual([])
    await slow.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
    expect(puts).toHaveLength(1)
    // A subject of its own is words, so the question comes, and nothing is started before it is answered.
    expect(question()).toBeTruthy()
    expect(starts).toEqual([])
  })

  it('takes Escape, Close and a press outside as nothing while the words are saved first, and a second press as nothing too', async () => {
    windowAt(1440)
    // The letter as the server holds it once the save has answered, should it be read again.
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, subject: 'Sample subject one' }) })
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    const slow = later()
    on('PUT', ISSUE_URL, slow.answer)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Saving your words first...')
    for (const name of ['Monthly newsletter', 'Short notice', 'Blank letter']) {
      expect(buttonFor(name).getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(buttonFor(name))
    }
    key(chooser(), 'Escape')
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Close' }))
    press(scrim())
    await settle()
    expect(chooser()).toBeTruthy()
    expect(puts).toHaveLength(1)
    await slow.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
    expect(starts).toEqual([])
    // The subject is words of its own, so the question is asked; the chooser stays under it.
    expect(question()).toBeTruthy()
    expect(document.querySelector('[data-slot="template-chooser"]')).toBeTruthy()
  })

  it('gives the focus back from the question to the "Use this" whose press was taken, not to one pressed while the words were saved first', async () => {
    windowAt(1440)
    // The letter as the server holds it once the save has answered, should it be read again.
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, subject: 'Sample subject one' }) })
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    const slow = later()
    on('PUT', ISSUE_URL, slow.answer)
    await openFrom(pickWide())
    const monthly = buttonFor('Monthly newsletter')
    act(() => monthly.focus())
    fireEvent.click(monthly)
    await settle()
    // Pressed while the words are saved first, so the chooser takes nothing from it.
    const short = buttonFor('Short notice')
    act(() => short.focus())
    fireEvent.click(short)
    await slow.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
    expect(question()).toBeTruthy()
    key(focused(), 'Escape')
    await settle()
    expect(question()).toBeNull()
    expect(focused()).toBe(buttonFor('Monthly newsletter'))
    expect(starts).toEqual([])
  })

  it('starts one letter from "Use this" pressed twice at once, and one from "Replace it" pressed twice', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    const slow = later()
    on('POST', START_URL, slow.answer)
    await thePage()
    await openFrom(pickWide())
    const pressed = buttonFor('Monthly newsletter')
    fireEvent.click(pressed)
    fireEvent.click(pressed)
    await settle()
    expect(starts).toHaveLength(1)
    // The second press neither clears the state in words nor says the start failed.
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Starting a new letter...')
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join('')).toBe('')
    await slow.give(startedAs(starterLetter('monthly')))
    expect(starts).toHaveLength(1)

    await again()
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    const slower = later()
    on('POST', START_URL, slower.answer)
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Short notice'))
    await settle()
    const replace = within(question()!).getByRole('button', { name: 'Replace it' })
    fireEvent.click(replace)
    fireEvent.click(replace)
    await settle()
    expect(starts).toHaveLength(1)
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join('')).toBe('')
    await slower.give(startedAs(starterLetter('short-notice')))
    expect(starts).toHaveLength(1)
  })

  it('takes a second press made in the same task as the first as nothing while that start is on its way: one start, the chooser still saying it is starting, Close still not available', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    const slow = later()
    on('POST', START_URL, slow.answer)
    await thePage()
    await openFrom(pickWide())
    const pressed = buttonFor('Monthly newsletter')
    // Two presses with no drawing between them, as a script can make them: each reaches the page as a first press.
    act(() => {
      pressed.click()
      pressed.click()
    })
    await settle(150)
    expect(starts).toHaveLength(1)
    expect(statusesIn()).toContain('Starting a new letter...')
    expect(alertsIn()).toBe('')
    const close = within(chooser()).getByRole('button', { name: 'Close' })
    expect(close.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(close)
    await settle()
    expect(chooser()).toBeTruthy()
    await slow.give(startedAs(starterLetter('monthly')))
    expect(noChooser()).toBeNull()
    expect(starts).toHaveLength(1)
  })

  it('lets a start that failed be pressed again, and says nothing of the failure when the chooser opens again', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, 'network', startedAs(starterLetter('monthly')))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Could not start a new letter. Try again in a moment.')
    expect(buttonFor('Monthly newsletter').getAttribute('aria-disabled')).toBeNull()
    // Closed and opened again, the earlier failure is not said.
    key(focused(), 'Escape')
    await settle()
    await openFrom(pickWide())
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join('')).toBe('')
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(80)
    expect(starts).toHaveLength(2)
    expect(noChooser()).toBeNull()
    expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML).toContain('Coming up')
  })

  it('says its own words, not the server\'s, for a start whose sign-in the server refuses, as a save so refused says "Could not save"', async () => {
    windowAt(1440)
    for (const [status, words] of [[401, 'Unauthorized'], [403, 'Forbidden']] as const) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      on('POST', START_URL, { status, body: { error: words } })
      await thePage()
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle(80)
      expect(starts, words).toHaveLength(1)
      expect(alertsIn(), words).toBe('Could not start a new letter. Try again in a moment.')
    }
  })

  it('stops saving after a start is refused with 409, as after a save\'s 409, so nothing is written over the other person\'s letter', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, refusedWith('changed'))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    key(focused(), 'Escape')
    await settle()
    fireEvent.change(subject(), { target: { value: 'Sample subject typed after the refusal' } })
    await settle(2100)
    expect(puts).toEqual([])
    expect(subject().value).toBe('Sample subject typed after the refusal')
    expect(savedLine().textContent).toContain('Player Two changed this letter')
    // And a second try says the words on the page are not saved, which is true of words typed after the refusal, and
    // starts nothing.
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(starts).toHaveLength(1)
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Your words here are not saved, so no letter was started.')
  })

  it('says at a second press, once the save sent to learn who changed the letter has stopped the saving, that the letter changed on the server, on its own in a chooser opened again, and sends nothing', async () => {
    windowAt(1440)
    // The page holds its saved letter at version 3, and Player Two has started a new letter over it since, setting it
    // aside with the page's words in it.
    const theirs = { issue: { id: 'sample-letter-2', version: 1, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '', createdAt: '2026-11-16 20:17:00', updatedAt: '2026-11-16 20:17:00' }, state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-16 20:17:00' }
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: theirs })
    on('PUT', ISSUE_URL, refusedWith('set_aside'))
    on('GET', ISSUES_URL, issues(row({ issueId: 'sample-letter-1', monthLabel: MONTH, subject: defaultSubject(MONTH), by: 'Player Two', at: '2026-11-16 20:17:00' })))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(200)
    expect(puts).toEqual([expect.objectContaining({ id: 'sample-letter-1', version: 3 })])
    expect(alertsIn()).toContain('No new letter was started.')
    expect(alertsIn()).toContain('Player Two started a new letter')
    key(focused(), 'Escape')
    await settle()
    await openFrom(pickWide())
    const before = calls.length
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(200)
    // Nothing was typed since: the server holds the page's words, so the chooser does not say they are not saved.
    expect(alertsIn()).toBe(CHANGED_BEFORE)
    expect(calls.slice(before)).toEqual([])
    expect(puts).toHaveLength(1)
    expect(starts).toEqual([])
  })

  it('says the same at a second press after a start refused with 409 and nothing typed since, and sends nothing', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    on('POST', START_URL, refusedWith('changed'))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    fireEvent.click(within(question()!).getByRole('button', { name: 'Replace it' }))
    await settle(200)
    expect(starts).toHaveLength(1)
    expect(alertsIn()).toContain('No new letter was started.')
    const before = calls.length
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(200)
    expect(alertsIn()).toContain(CHANGED_BEFORE)
    expect(alertsIn()).not.toContain('Your words here are not saved')
    expect(calls.slice(before)).toEqual([])
    expect(starts).toHaveLength(1)
  })

  it('answers nothing, and starts nothing, to a press outside the question', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    on('POST', START_URL, startedAs(''))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle()
    const asked = question()!
    press(document.querySelector('[data-slot="replace-scrim"]')!)
    press(scrim())
    await settle()
    expect(question()).toBe(asked)
    expect(document.querySelector('[data-slot="template-chooser"]')).toBeTruthy()
    expect(starts).toEqual([])
    expect(focused()).toBe(within(asked).getByRole('button', { name: 'Keep writing' }))
  })

  it('leaves nothing broken when the page is left while a start is on its way, however it then answers', async () => {
    windowAt(1440)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    const slow = later()
    on('POST', START_URL, slow.answer)
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(starts).toHaveLength(1)
    cleanup()
    await slow.give(startedAs(starterLetter('monthly')))
    await settle(100)
    expect(document.getElementById('root')?.hasAttribute('inert') ?? false).toBe(false)
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([])
    expect(starts).toHaveLength(1)
  })

  it('says it is checking while the letter is read first, takes no press meanwhile, and starts nothing when that read gets no answer', async () => {
    windowAt(1440)
    const read = later()
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, read.answer, { status: 200, body: emptyLetter() })
    on('POST', START_URL, startedAs(starterLetter('monthly')))
    await thePage()
    const line = savedLine().textContent
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Checking the letter...')
    for (const name of ['Monthly newsletter', 'Blank letter']) {
      expect(buttonFor(name).getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(buttonFor(name))
    }
    key(chooser(), 'Escape')
    await settle()
    expect(chooser()).toBeTruthy()
    await read.give('network')
    expect(starts).toEqual([])
    expect(puts).toEqual([])
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Could not start a new letter. Try again in a moment.')
    expect(savedLine().textContent).toBe(line)
    // Pressed again, the letter is read again, found as the page knows it, and started.
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(80)
    expect(starts).toEqual([{ from: 'monthly', monthLabel: MONTH }])
  })

  it('starts nothing, and lets the chooser go, when the save sent to learn who changed the letter comes back with neither a save nor a 409: failed, with no answer, or refused in the server\'s words', async () => {
    windowAt(1440)
    const forms: Array<[string, Answer | 'network']> = [
      ['answered 500', { status: 500, body: { error: 'Something went wrong' } }],
      ['with no answer', 'network'],
      ['answered 413', { status: 413, body: { error: 'Sample words of the server: this letter is too long.' } }],
    ]
    for (const [why, answer] of forms) {
      await again()
      // Nothing on the page is unsaved, and the read finds Player Two's newer letter. A request made a second time gets
      // an answer that never comes, so were nothing to end the loop at that save's answer, the case would fail on its
      // counts and on Close rather than run on.
      const never = new Promise<Answer>(() => {})
      const save = later()
      on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) }, never)
      on('PUT', ISSUE_URL, save.answer, never)
      await thePage()
      const line = savedLine().textContent
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      // That save is no save of the person's words: the chooser goes on checking the letter, and the saved line does
      // not say "Saving".
      expect(statusesIn(), why).toContain('Checking the letter...')
      expect(statusesIn(), why).not.toContain('Saving your words first...')
      expect(savedLine().textContent, why).toBe(line)
      await save.give(answer)
      expect(puts, why).toHaveLength(1)
      expect(calls.filter((call) => call === `GET ${ISSUE_URL}`), why).toHaveLength(2)
      expect(question(), why).toBeNull()
      expect(starts, why).toEqual([])
      expect(alertsIn(), why).toBe('Could not start a new letter. Try again in a moment.')
      expect(savedLine().textContent, why).toBe(line)
      fireEvent.click(within(chooser()).getByRole('button', { name: 'Close' }))
      await settle()
      expect(noChooser(), why).toBeNull()
      expect(savedLine().textContent, why).toBe(line)
    }
  })

  it('starts nothing more on a second try when a start that got no answer had reached the server, and offers the letter that start made', async () => {
    windowAt(1440)
    // The first start's answer is lost; on the server it reused the empty letter in place, at version 4, as the person's.
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, bodyHtml: starterLetter('monthly') }) })
    on('POST', START_URL, 'network')
    on('PUT', ISSUE_URL, refusedWith('changed', 'Player One'))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Could not start a new letter. Try again in a moment.')
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    // The read finds the letter that start made: nothing more is started, and the saved line names the person themselves.
    expect(starts).toHaveLength(1)
    expect(puts).toEqual([expect.objectContaining({ id: 'sample-letter-1', version: 3 })])
    const alerts = within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' | ')
    expect(alerts).toContain('No new letter was started.')
    expect(alerts).toContain('Player One changed this letter')
    key(focused(), 'Escape')
    await settle()
    expect(within(savedLine()).getByRole('button', { name: 'Show their letter' })).toBeTruthy()
  })

  it('starts nothing and sends nothing when the page is left while the letter is read first, and the read then finds the page\'s own letter or another person\'s newer one', async () => {
    windowAt(1440)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    // The page's own letter, and a letter Player Two has saved since, which on the page would send its words as a save.
    for (const [why, found] of [['the page\'s own letter', emptyLetter()], ['another person\'s newer letter', letter({ version: 4 })]] as const) {
      await again()
      const read = later()
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, read.answer)
      on('PUT', ISSUE_URL, refusedWith('changed'))
      on('POST', START_URL, startedAs(starterLetter('monthly')))
      await thePage()
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      cleanup()
      await read.give({ status: 200, body: found })
      await settle(100)
      expect(starts, why).toEqual([])
      expect(puts, why).toEqual([])
      expect(document.getElementById('root')?.hasAttribute('inert') ?? false, why).toBe(false)
    }
    expect(errors.mock.calls.map((call) => String(call[0]))).toEqual([])
  })

  it('takes a save of its own it never heard back about, found by that read, and saves the words on the page over it before the start', async () => {
    windowAt(1440)
    // Each read finds the letter as the server then holds it: the save that got no answer at version 4, then the save
    // made over it at version 5, should it be read again.
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, subject: 'Sample subject one' }) }, { status: 200, body: emptyLetter({ version: 5 }) })
    on('PUT', ISSUE_URL, 'network', { status: 200, body: { id: 'sample-letter-1', version: 5, savedAt: '2026-11-16 20:21:00', bodyHtml: null } })
    on('POST', START_URL, startedAs(''))
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    await settle(2100)
    expect(savedLine().textContent).toContain('Could not save')
    // Written back as it was: nothing is left to save as far as the page knows, though the save that got no answer may have landed.
    fireEvent.change(subject(), { target: { value: defaultSubject(MONTH) } })
    await settle()
    expect(savedLine().textContent).not.toContain('Could not save')
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle(80)
    // The read finds that save on the server at version 4: the page takes it as its own, as a save's 409 would have it
    // do, and saves the words on the page over it at that version before anything is started.
    expect(puts).toEqual([
      expect.objectContaining({ id: 'sample-letter-1', version: 3, subject: 'Sample subject one' }),
      expect.objectContaining({ id: 'sample-letter-1', version: 4, subject: defaultSubject(MONTH) }),
    ])
    expect(question()).toBeNull()
    expect(starts).toEqual([{ from: 'blank', monthLabel: MONTH }])
  })
})

describe('the waits before a start', () => {
  it('lets the person go when the letter read first has not answered within the wait, and its late answer, a letter someone else saved since, asks, sends and starts nothing', async () => {
    windowAt(1440)
    const read = later()
    on('GET', ISSUE_URL, { status: 200, body: letter() }, read.answer)
    on('PUT', ISSUE_URL, refusedWith('changed'))
    await thePage()
    const line = savedLine().textContent
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    await moveClock(SAVE_FIRST_WAIT_MS - 1000)
    // Still checking a second before the wait is over.
    expect(statusesIn()).toContain('Checking the letter...')
    expect(within(chooser()).getByRole('button', { name: 'Close' }).getAttribute('aria-disabled')).toBe('true')
    await moveClock(1000)
    await settle()
    expect(statusesIn()).not.toContain('Checking the letter...')
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    expect(within(chooser()).getByRole('button', { name: 'Close' }).getAttribute('aria-disabled')).toBeNull()
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    expect(focused()).toBe(pickWide())
    await read.give({ status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    await settle(100)
    expect(puts).toEqual([])
    expect(starts).toEqual([])
    expect(question()).toBeNull()
    expect(savedLine().textContent).toBe(line)
  })

  it('lets the person go when the save of their words it waits for has not answered within the wait, saying so, and that save, answering late, saves them and asks nothing', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    await thePage()
    testClock()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    const slow = later()
    on('PUT', ISSUE_URL, slow.answer)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(puts).toHaveLength(1)
    expect(statusesIn()).toContain('Saving your words first...')
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Your words are still being saved, so no letter was started. Try again in a moment.')
    expect(within(chooser()).getByRole('button', { name: 'Close' }).getAttribute('aria-disabled')).toBeNull()
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    // The save answers at last and does what any save's answer does: the words are saved, and nothing is asked or started.
    await slow.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
    expect(savedLine().textContent).toContain('2:20 PM')
    expect(question()).toBeNull()
    expect(starts).toEqual([])
    expect(puts).toHaveLength(1)
  })

  it('lets the person go as well when the save sent to learn who changed the letter has not answered within the wait, its late 409 then saying who and when on the saved line, as any save\'s does', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4 }) })
    const asked = later()
    on('PUT', ISSUE_URL, asked.answer)
    await thePage()
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(puts).toHaveLength(1)
    expect(statusesIn()).toContain('Checking the letter...')
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    await asked.give(refusedWith('changed'))
    expect(savedLine().textContent).toContain('Player Two changed this letter')
    expect(within(savedLine()).getByRole('button', { name: 'Show their letter' })).toBeTruthy()
    expect(question()).toBeNull()
    expect(starts).toEqual([])
    expect(puts).toHaveLength(1)
  })

  it('says it is checking the letter at a second press while the save sent to learn who changed it is still on its way, and after the wait that no letter could be started, never that words are being saved, sending no second save', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    const asked = later()
    on('PUT', ISSUE_URL, asked.answer)
    await thePage()
    const line = savedLine().textContent
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    // Told to try again in a moment, the person does, that save still on its way: nothing on the page is unsaved, so
    // the chooser says what it is doing as it did at the first press.
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(statusesIn()).toContain('Checking the letter...')
    expect(statusesIn()).not.toContain('Saving your words first...')
    await moveClock(SAVE_FIRST_WAIT_MS - 1000)
    expect(statusesIn()).toContain('Checking the letter...')
    await moveClock(1000)
    await settle()
    expect(statusesIn()).not.toContain('Checking the letter...')
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    expect(puts).toHaveLength(1)
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(2)
    expect(starts).toEqual([])
    expect(savedLine().textContent).toBe(line)
  })

  it('says "Saving" on the saved line for words typed once the chooser has let the person go while the save sent to learn who changed the letter is still on its way, sends them at once when that save fails, where the server\'s refusal says who changed it, and stays on "Saving" while that save has no answer', async () => {
    windowAt(1440)
    for (const fails of [true, false]) {
      const why = fails ? 'that save failing' : 'that save with no answer'
      await again()
      const asked = later()
      on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
      on('PUT', ISSUE_URL, asked.answer, refusedWith('changed'))
      await thePage()
      testClock()
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      await moveClock(SAVE_FIRST_WAIT_MS)
      await settle()
      key(focused(), 'Escape')
      await settle()
      expect(noChooser(), why).toBeNull()
      fireEvent.change(subject(), { target: { value: 'Sample subject typed after the wait' } })
      await moveClock(2100)
      await settle()
      // The words typed are held for a save that waits behind that one, as the saved line now says.
      expect(savedLine().textContent, why).toBe('Saving')
      expect(puts, why).toHaveLength(1)
      if (fails) {
        await asked.give('network')
        await settle(100)
        // Sent at once at the version the page knows, the words meet the server's refusal, which says who changed the letter.
        expect(puts, why).toHaveLength(2)
        expect(puts[1], why).toMatchObject({ id: 'sample-letter-1', version: 3, subject: 'Sample subject typed after the wait' })
        expect(savedLine().textContent, why).toContain('Player Two changed this letter')
        expect(within(savedLine()).getByRole('button', { name: 'Show their letter' }), why).toBeTruthy()
      } else {
        await moveClock(5 * 60000)
        await settle()
        expect(savedLine().textContent, why).toBe('Saving')
        expect(puts, why).toHaveLength(1)
      }
      expect(subject().value, why).toBe('Sample subject typed after the wait')
      expect(starts, why).toEqual([])
      vi.useRealTimers()
    }
  })

  it('asks nothing as the page is left, by a link of the site or by the browser, while the save sent to learn who changed the letter is still on its way and nothing on the page is unsaved', async () => {
    windowAt(1440)
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    on('PUT', ISSUE_URL, new Promise<Answer>(() => {}))
    await thePage()
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    expect(puts).toHaveLength(1)
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(false)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Admin' }))
    expect(ask).not.toHaveBeenCalled()
  })

  it('says it is saving the words first at a second press made once words are typed behind the save sent to learn who changed the letter, and after the wait that they are still being saved, sending no second save', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    const asked = later()
    on('PUT', ISSUE_URL, asked.answer)
    await thePage()
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    key(focused(), 'Escape')
    await settle()
    fireEvent.change(subject(), { target: { value: 'Sample subject typed after the wait' } })
    await moveClock(2100)
    await settle()
    expect(savedLine().textContent).toBe('Saving')
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    // The words typed wait unsaved behind that save, so the chooser says so, as for any save of the person's words.
    expect(statusesIn()).toContain('Saving your words first...')
    expect(statusesIn()).not.toContain('Checking the letter...')
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Your words are still being saved, so no letter was started. Try again in a moment.')
    expect(puts).toHaveLength(1)
    expect(starts).toEqual([])
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    expect(subject().value).toBe('Sample subject typed after the wait')
    expect(savedLine().textContent).toBe('Saving')
  })

  it('takes the saved line back to the last save when words typed behind the save sent to learn who changed the letter are written back as they were saved and that save fails, sending nothing more and asking nothing as the page is left', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    const asked = later()
    on('PUT', ISSUE_URL, asked.answer, refusedWith('changed'))
    await thePage()
    const line = savedLine().textContent
    const before = subject().value
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    key(focused(), 'Escape')
    await settle()
    fireEvent.change(subject(), { target: { value: 'Sample subject typed after the wait' } })
    await moveClock(2100)
    await settle()
    expect(savedLine().textContent).toBe('Saving')
    // Written back as they were saved, the words wait behind that save with nothing in them left to save.
    fireEvent.change(subject(), { target: { value: before } })
    await moveClock(2100)
    await settle()
    await asked.give('network')
    await settle(100)
    // Nothing is left to save once that save has answered: no save is sent, and the line says the last save again.
    expect(puts).toHaveLength(1)
    expect(savedLine().textContent).toBe(line)
    await moveClock(60000)
    await settle()
    expect(savedLine().textContent).toBe(line)
    expect(puts).toHaveLength(1)
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(false)
  })

  it('says it is checking the letter at a second press made while the letter is read again after the 409 of the save sent to learn who changed it, the page holding a save it never heard back about, and asks nothing as the page is left meanwhile', async () => {
    windowAt(1440)
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const readAgain = later()
    // The page's read; the read made first, which finds Player Two's newer letter; and the read made after that save's 409.
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) }, readAgain.answer)
    // A save of words typed gets no answer, so the page holds a save it never heard back about; then that save meets its 409.
    on('PUT', ISSUE_URL, 'network', refusedWith('changed'))
    await thePage()
    const before = subject().value
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    await settle(2100)
    expect(savedLine().textContent).toContain('Could not save')
    fireEvent.change(subject(), { target: { value: before } })
    await settle()
    testClock()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle(100)
    // That save met its 409, and the letter is read again to learn whether the newer letter is the page's own save.
    expect(puts).toHaveLength(2)
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(3)
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    // Pressed again while that read is on its way: nothing on the page is unsaved, so the chooser says it is checking.
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(statusesIn()).toContain('Checking the letter...')
    expect(statusesIn()).not.toContain('Saving your words first...')
    await moveClock(SAVE_FIRST_WAIT_MS)
    await settle()
    expect(alertsIn()).toBe('Could not start a new letter. Try again in a moment.')
    key(focused(), 'Escape')
    await settle()
    expect(noChooser()).toBeNull()
    const leaving = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leaving)
    expect(leaving.defaultPrevented).toBe(false)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'Admin' }))
    expect(ask).not.toHaveBeenCalled()
    expect(puts).toHaveLength(2)
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(3)
    expect(starts).toEqual([])
  })
})

describe('the first step\'s cue, at its edges', () => {
  const isWiggle = (a: (typeof animations)[number]) => a.frames.some((frame) => String(frame.transform).includes('rotate(-2deg)'))
  const cueStarted = () => waitFor(() => expect(animations).toHaveLength(1), { timeout: 5000 })

  it('plays as the page opens with no open letter at all, which holds no words', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: NONE })
    await thePage()
    await cueStarted()
    expect(isWiggle(animations[0])).toBe(true)
  })

  it('shows no ring with reduced motion on a letter that holds words, and none again after a start', async () => {
    windowAt(1440, { reducedMotion: true })
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    await thePage()
    await settle(200)
    expect(animations).toEqual([])

    await again()
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, startedAs(''))
    await thePage()
    await cueStarted()
    expect(animations[0].on.getAttribute('data-slot')).toBe('pick-ring')
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle(150)
    expect(focused()).toBe(pickWide())
    expect(animations).toHaveLength(1)
  })
})
