// @vitest-environment jsdom
//
// The chooser of templates and past newsletters on the newsletter's own page,
// the question before a letter that holds words is replaced, and the first
// step's wiggle (WS16 part two, page step 5, second part), beside the bar's
// own file, test/unit/admin-newsletter-bar.test.tsx, whose harness this
// file's is.
//
// - The first step ready, at a computer's width and a phone's: its name, and
//   that it opens a dialog and says whether it is open.
// - The chooser: its head, the blank letter first, LCA's three starters, the
//   last newsletters, each with its words and its "Use this" named for it,
//   nothing of the tournament templates and none of the board's two lines
//   under it; the focus into it as it opens, kept inside it, the control Tab
//   goes round to brought into view, in it and in the question, and the
//   focus given back to the first step drawn then by Escape, Close and a
//   press outside it; the page behind it inert and hidden from a screen
//   reader while it is open; More options closed as it opens; open across
//   768 pixels with the focus still inside it, in the form of the width it
//   is then at, placed from the first step drawn then.
// - The last newsletters: read each time it opens and never as the page
//   opens, said while they are read, when the read fails, with Try again, and
//   when there are none; each row's month, or a plain send's subject, its
//   state in words and its day with a weekday, in the site's own time, with
//   the time of day on every row but a sent one; two rows alike to the minute
//   told apart in the names of their "Use this".
// - Starting: the words on the page saved first and the start waiting for
//   that save, nothing started when it fails or is refused; with nothing to
//   save, the letter read first, and again once the question is answered,
//   and nothing asked or started when someone else has saved over it,
//   written it, replaced it or sent it since, the words on the page then sent
//   as a save the server refuses, saying who and when; the question only
//   when the letter holds words, by the one rule, each thing that counts as
//   words with its case, and that rule held to the server's; the request for
//   each kind of choice, with the page's month; the page after a start, its
//   saved line drawn empty and saying the start a moment later; each
//   refusal and failure in words; the "Use this" pressed kept in view as
//   words said in the chooser's head push the choices down; no second start
//   while one is on its way; the round trip that shows nothing is lost, a
//   letter's subject of its own among its words; the subject a letter set
//   aside brings back only for its own month; and what the other person
//   meets at their next save.
// - The wiggle: once, as the page opens on a letter that holds no words,
//   never after, never under the focus, stopped by words written, and the
//   ring in its place with reduced motion.
// The editor's library measures text through browser APIs jsdom lacks, and
// jsdom has no animations and no ResizeObserver; each is given a stand-in
// here, in this file only, the last in the one case that needs it.
// Every word, name and date here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject, STARTER_IDS } from '@domain/mail/letter'
import { holdsWords as serverHoldsWords, starterLetter } from '../../functions/utils/mail/issues'

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
const { holdsWords } = await import('@/areas/admin/newsletter/useIssue')

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

/** An answer the stand-in for fetch gives, or 'network' for a request that gets none. */
interface Answer { status: number; body: unknown }
type Given = Answer | 'network' | Promise<Answer | 'network'>
let answers: Record<string, Given[]> = {}
let calls: string[] = []
let puts: Array<Record<string, unknown>> = []
let starts: Array<Record<string, unknown>> = []
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
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})
/** A letter with no words: its month's own subject, no preview line and nothing in its body. */
const emptyLetter = (extra: Record<string, unknown> = {}) => letter({ bodyHtml: '', ...extra })
/** What a start answers with 201: the new open letter. */
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
/** One of the last newsletters as GET .../issues gives it; a letter set aside unless told otherwise. */
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

/** Each animation the page asked the browser for: on what, with which frames and how long, and whether it was stopped. */
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
  // jsdom has no animations; this stand-in records what the page asks for, as a browser would play it.
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
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
})

const settle = (ms = 40) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
async function thePage(container?: HTMLElement) {
  await act(async () => {
    render(
      <AuthContext.Provider value={ADMIN}>
        <MemoryRouter initialEntries={['/admin/newsletter']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
      container ? { container } : undefined,
    )
  })
  await screen.findByRole('heading', { level: 1, name: 'Newsletter' }, { timeout: 10_000 })
  await screen.findByRole('toolbar', { name: 'Writing tools' })
  await settle()
}
const focused = () => document.activeElement as HTMLElement
const key = (target: Element, name: string, more: Record<string, unknown> = {}) => fireEvent.keyDown(target, { key: name, ...more })
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const pickWide = () => within(theBar()).getByRole('button', { name: '1 Pick a template to start from' })
const pickPhone = () => within(theBar()).getByRole('button', { name: 'Pick a template' })
const chooser = () => screen.getByRole('dialog', { name: 'Pick a template to start from' })
const noChooser = () => screen.queryByRole('dialog', { name: 'Pick a template to start from' })
const question = () => screen.queryByRole('alertdialog', { name: 'Replace this letter?' })
const buttonFor = (name: string) => within(chooser()).getByRole('button', { name: `Use this: ${name}` })
const subject = () => screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement
const savedLine = () => document.querySelector('[data-slot="saved-line"]') as HTMLElement
const quietLine = () => within(savedLine()).getByRole('status').textContent
const issueReads = () => calls.filter((call) => call === `GET ${ISSUES_URL}`).length
/** A press with the main button, as a browser sends it: the dialog's library closes on the click that ends a press outside it. */
function press(target: Element) {
  fireEvent.pointerDown(target, { button: 0 })
  fireEvent.mouseDown(target, { button: 0 })
  fireEvent.pointerUp(target, { button: 0 })
  fireEvent.mouseUp(target, { button: 0 })
  fireEvent.click(target, { button: 0 })
}
const scrim = () => document.querySelector('[data-slot="chooser-scrim"]') as HTMLElement
/** The page drawn afresh for a case of a loop: the page before it is taken away, and the save it sends as it goes lands first. */
async function again() {
  cleanup()
  await settle()
  starts = []
  puts = []
  calls = []
}
/** Opens the chooser from the step given, and lets its first read go. */
async function openFrom(step: HTMLElement) {
  act(() => step.focus())
  fireEvent.click(step)
  await settle()
  return chooser()
}

/**
 * A stand-in for the browser's media queries at a window's width, as the bar's file gives it, and with reduced motion
 * asked for or not: each min-width query answered as a browser does, and the mover, which sets a new width and tells the
 * listeners.
 */
function windowAt(px: number, { reducedMotion = false } = {}) {
  let width = px
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query === '(prefers-reduced-motion: reduce)') return reducedMotion
      const line = /^\(min-width: (\d+)px\)$/.exec(query)
      return line !== null && width >= Number(line[1])
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next: number) => {
    width = next
    act(() => listeners.forEach((listener) => listener()))
  }
}

describe('the first step', () => {
  it('is ready at a computer\'s width and a phone\'s: named as before, it opens a dialog and says whether it is open', async () => {
    const move = windowAt(1440)
    await thePage()
    for (const [step, name] of [[pickWide, '1 Pick a template to start from'], [pickPhone, 'Pick a template']] as const) {
      if (name === 'Pick a template') move(390)
      const button = step()
      expect(button.hasAttribute('aria-disabled'), name).toBe(false)
      expect(button.getAttribute('aria-haspopup'), name).toBe('dialog')
      expect(button.getAttribute('aria-expanded'), name).toBe('false')
      await openFrom(button)
      // The page behind the chooser is hidden from a screen reader while it is open, so the step is read as it stands.
      expect(button.getAttribute('aria-expanded'), name).toBe('true')
      key(focused(), 'Escape')
      await settle()
      expect(step(), name).toBe(button)
      expect(button.getAttribute('aria-expanded'), name).toBe('false')
    }
    // Step 3 stays as the first part drew it, not yet available; step 2 is ready since page step 6, its test of the letter
    // held in test/unit/admin-newsletter-test.test.tsx.
    move(1440)
    expect(within(theBar()).getByRole('button', { name: '3 Send to 155 people' }).getAttribute('aria-disabled')).toBe('true')
    expect(within(theBar()).getByRole('button', { name: '2 Send a test to me' }).getAttribute('aria-disabled')).toBeNull()
  })
})

describe('the chooser', () => {
  it('holds its head, the blank letter first, LCA\'s three starters, then the last newsletters, each with its words and its own "Use this"', async () => {
    windowAt(1440)
    on('GET', ISSUES_URL, issues(row({ issueId: 'sample-letter-0', campaignId: 'campaign-sample-1', state: 'completed', totalRecipients: 155, at: '2026-11-16 20:15:00' })))
    await thePage()
    const dialog = await openFrom(pickWide())
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Pick a template to start from')
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeTruthy()
    const text = dialog.textContent ?? ''
    const order = ['Blank letter', 'Just the month\'s band and an empty page.', 'Pinned templates', 'Monthly newsletter', 'The usual six headings', 'Results and thanks', 'After a tournament weekend', 'Short notice', 'A few lines, no sections', 'Your last newsletters', 'Example: November 2026', 'Sent Mon, Nov 16, 2026 to 155 members']
    let at = -1
    for (const words of order) {
      expect(text.indexOf(words, at + 1), words).toBeGreaterThan(at)
      at = text.indexOf(words, at + 1)
    }
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Pinned templates', 'Your last newsletters'])
    // Each "Use this" says which choice it is, in the chooser's order, and nothing else in it is a button but Close.
    expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      'Close', 'Use this: Blank letter', 'Use this: Monthly newsletter', 'Use this: Results and thanks', 'Use this: Short notice',
      'Use this: Example: November 2026, sent Mon, Nov 16, 2026 to 155 members',
    ])
    for (const button of within(dialog).getAllByRole('button').slice(1)) expect(button.textContent).toBe('Use this')
    // The tournament templates are the tournament send-outs', and the board's two lines under the chooser are Help's.
    for (const words of ['tournament announcement', 'For a club', 'Pin it as a template', 'History', 'as it is now']) expect(text, words).not.toContain(words)
    // The small drawings, one for each choice, are hidden from a screen reader.
    expect(dialog.querySelectorAll('li > [aria-hidden="true"]')).toHaveLength(5)
  })

  it('takes the focus itself as it opens, keeps it inside, and gives it back to the first step by Escape, Close and a press outside it', async () => {
    windowAt(1440)
    await thePage()
    for (const close of ['Escape', 'Close', 'outside'] as const) {
      const dialog = await openFrom(pickWide())
      expect(focused(), close).toBe(dialog)
      const stops = within(dialog).getAllByRole('button')
      // Shift and Tab from the chooser itself goes round to its last control; Tab from the last to the first, and back.
      key(dialog, 'Tab', { shiftKey: true })
      expect(focused(), close).toBe(stops[stops.length - 1])
      key(focused(), 'Tab')
      expect(focused(), close).toBe(stops[0])
      key(focused(), 'Tab', { shiftKey: true })
      expect(focused(), close).toBe(stops[stops.length - 1])
      if (close === 'Escape') key(focused(), 'Escape')
      else if (close === 'Close') fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
      else press(scrim())
      await settle()
      expect(noChooser(), close).toBeNull()
      expect(focused(), close).toBe(pickWide())
    }
  })

  it('brings the control Tab goes round to into view, in the chooser and in the question, since the dialog\'s library gives that focus without the browser\'s scroll', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    const intoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: intoView })
    try {
      await thePage()
      const dialog = await openFrom(pickWide())
      const stops = within(dialog).getAllByRole('button')
      act(() => stops[stops.length - 1].focus())
      intoView.mockClear()
      key(focused(), 'Tab')
      expect(focused()).toBe(stops[0])
      expect(intoView.mock.instances).toEqual([stops[0]])
      expect(intoView).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
      intoView.mockClear()
      key(focused(), 'Tab', { shiftKey: true })
      expect(focused()).toBe(stops[stops.length - 1])
      expect(intoView.mock.instances).toEqual([stops[stops.length - 1]])
      // The question, asked of a letter that holds words: from Replace it round to Keep writing.
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      const asked = question()!
      const [keep, replace] = within(asked).getAllByRole('button')
      act(() => replace.focus())
      intoView.mockClear()
      key(focused(), 'Tab')
      expect(focused()).toBe(keep)
      expect(intoView.mock.instances).toEqual([keep])
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('keeps the page behind it out of reach while it is open: the site\'s root inert and hidden from a screen reader, let go before the focus comes back', async () => {
    windowAt(1440)
    const root = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'root' }))
    await thePage(root)
    const pick = pickWide()
    const inertAsFocused: boolean[] = []
    pick.addEventListener('focus', () => inertAsFocused.push(root.hasAttribute('inert')))
    const dialog = await openFrom(pick)
    expect(root.contains(dialog)).toBe(false)
    expect(root.hasAttribute('inert')).toBe(true)
    expect(root.getAttribute('aria-hidden')).toBe('true')
    key(focused(), 'Escape')
    await settle()
    expect(root.hasAttribute('inert')).toBe(false)
    expect(root.hasAttribute('aria-hidden')).toBe(false)
    expect(inertAsFocused.at(-1)).toBe(false)
    root.remove()
  })

  it('opens on a phone from "Pick a template" as a sheet from the window\'s foot, closing More options open at the page\'s end, and gives the focus back', async () => {
    windowAt(390)
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    expect(screen.getByRole('group', { name: 'More options' })).toBeTruthy()
    const dialog = await openFrom(pickPhone())
    expect(dialog.getAttribute('data-form')).toBe('sheet')
    expect(screen.queryByRole('group', { name: 'More options' })).toBeNull()
    key(focused(), 'Escape')
    await settle()
    expect(focused()).toBe(pickPhone())
  })

  it('opens upward from the first step from 768 pixels up, held under the header in rem, and becomes the sheet as the window crosses, the focused control brought into view inside it', async () => {
    const move = windowAt(1440)
    // jsdom draws nothing, so the first step is given a place, as a computer's window 768 pixels tall draws it.
    const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      return this.getAttribute('aria-haspopup') === 'dialog' && this.closest('[data-slot="foot-bar"]') ? new DOMRect(400, 700, 300, 52) : new DOMRect()
    })
    const intoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: intoView })
    try {
      await thePage()
      const dialog = await openFrom(pickWide())
      expect(dialog.getAttribute('data-form')).toBe('box')
      expect(document.querySelector('[data-slot="chooser-scrim"]')?.getAttribute('data-form')).toBe('box')
      // Its foot half a rem above the step, its left edge at the step's, its top held three quarters of a rem under the header.
      expect(dialog.style.bottom).toBe('76px')
      expect(dialog.style.left).toBe('400px')
      expect(dialog.style.maxHeight).toBe('calc(100dvh - 76px - var(--header-h, 4rem) - 0.75rem)')
      const monthly = buttonFor('Monthly newsletter')
      act(() => monthly.focus())
      move(390)
      expect(chooser()).toBe(dialog)
      expect(dialog.getAttribute('data-form')).toBe('sheet')
      expect(dialog.style.bottom).toBe('')
      expect(focused()).toBe(monthly)
      expect(intoView.mock.instances.at(-1)).toBe(monthly)
      expect(intoView).toHaveBeenLastCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      rects.mockRestore()
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('takes the box\'s form again from the first step drawn then as the window widens past 768 pixels while it is open', async () => {
    const move = windowAt(390)
    // jsdom draws nothing, so the first step is given a place, as a computer's window 768 pixels tall draws it.
    const rects = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
      return this.getAttribute('aria-haspopup') === 'dialog' && this.closest('[data-slot="foot-bar"]') ? new DOMRect(400, 700, 300, 52) : new DOMRect()
    })
    try {
      await thePage()
      const dialog = await openFrom(pickPhone())
      expect(dialog.getAttribute('data-form')).toBe('sheet')
      act(() => buttonFor('Short notice').focus())
      move(1440)
      expect(chooser()).toBe(dialog)
      expect(dialog.getAttribute('data-form')).toBe('box')
      expect(dialog.style.bottom).toBe('76px')
      expect(dialog.style.left).toBe('400px')
      expect(focused()).toBe(buttonFor('Short notice'))
    } finally {
      rects.mockRestore()
    }
  })

  it('stays open as the window crosses 768 pixels, the focus still inside it, and gives it back to the first step drawn then', async () => {
    const move = windowAt(1440)
    await thePage()
    const dialog = await openFrom(pickWide())
    act(() => buttonFor('Monthly newsletter').focus())
    move(390)
    expect(chooser()).toBe(dialog)
    expect(focused()).toBe(buttonFor('Monthly newsletter'))
    key(focused(), 'Escape')
    await settle()
    expect(focused()).toBe(pickPhone())
    await openFrom(pickPhone())
    move(820)
    expect(chooser().contains(focused())).toBe(true)
    key(focused(), 'Escape')
    await settle()
    expect(focused()).toBe(pickWide())
  })
})

describe('your last newsletters', () => {
  it('are read each time the chooser opens, never as the page opens, and said while they are read, the starters usable meanwhile', async () => {
    windowAt(1440)
    const slow = later()
    on('GET', ISSUES_URL, slow.answer, issues())
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, startedAs(starterLetter('monthly')))
    await thePage()
    expect(issueReads()).toBe(0)
    const dialog = await openFrom(pickWide())
    expect(issueReads()).toBe(1)
    expect(within(dialog).getAllByRole('status').map((s) => s.textContent)).toContain('Reading your last newsletters...')
    key(focused(), 'Escape')
    await settle()
    await openFrom(pickWide())
    expect(issueReads()).toBe(2)
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('None yet.')
    // While a read is on its way the starters work.
    key(focused(), 'Escape')
    await settle()
    const slower = later()
    on('GET', ISSUES_URL, slower.answer)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(starts).toEqual([{ from: 'monthly', monthLabel: MONTH }])
    await slow.give(issues())
    await slower.give(issues())
  })

  it('say so in words when they could not be read, with Try again, which reads them again with the focus on the group\'s head', async () => {
    windowAt(1440)
    on('GET', ISSUES_URL, { status: 500, body: { error: 'Something went wrong' } }, issues(row()))
    await thePage()
    const dialog = await openFrom(pickWide())
    const alerts = within(dialog).getAllByRole('alert').map((a) => a.textContent)
    expect(alerts).toContain('Your last newsletters could not be read.')
    // The blank letter and the starters are still there to use.
    expect(buttonFor('Blank letter')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(focused()).toBe(within(dialog).getByRole('heading', { name: 'Your last newsletters' }))
    await settle()
    expect(issueReads()).toBe(2)
    expect(buttonFor('Example: November 2026, replaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('give each row its month, or a plain send\'s subject, its state in words, who by where the answer has it, and its day with a weekday in the site\'s own time, with the time of day on every row but a sent one', async () => {
    windowAt(1440)
    on('GET', ISSUES_URL, issues(
      row({ issueId: 'sample-letter-5', campaignId: 'campaign-sample-5', monthLabel: 'November 2026', state: 'completed', by: 'Player Two', totalRecipients: 155 }),
      row({ issueId: 'sample-letter-4', campaignId: 'campaign-sample-4', monthLabel: 'October 2026', state: 'completed', totalRecipients: 1, at: '2026-10-05 15:00:00' }),
      row({ issueId: null, campaignId: 'campaign-sample-3', monthLabel: '', subject: 'Sample plain subject', state: 'sending', by: 'Player Three', totalRecipients: 155, at: '2026-11-17 03:30:00' }),
      row({ issueId: null, campaignId: 'campaign-sample-2', monthLabel: '', subject: 'Sample failed subject', state: 'failed', totalRecipients: 20, at: '2027-01-01 04:00:00' }),
      row({ issueId: 'sample-letter-1', monthLabel: 'December 2026', state: 'set_aside', by: 'Player One', at: '2026-11-16 19:00:00' }),
    ))
    await thePage()
    const dialog = await openFrom(pickWide())
    const lines = within(dialog).getAllByRole('listitem').slice(4).map((item) => item.textContent?.replace(/Use this$/, ''))
    expect(lines).toEqual([
      'November 2026Sent by Player Two on Mon, Nov 16, 2026 to 155 members',
      'October 2026Sent Mon, Oct 5, 2026 to 1 member',
      // 3:30 AM UTC on Tuesday is still Monday evening in Louisiana, as the site writes every date and time.
      'Sample plain subjectBeing sent by Player Three since Mon, Nov 16, 2026 at 9:30 PM',
      // And 4:00 AM UTC on New Year's Day is still New Year's Eve there.
      'Sample failed subjectNot sent: the send failed on Thu, Dec 31, 2026 at 10:00 PM',
      'December 2026Set aside by Player One on Mon, Nov 16, 2026 at 1:00 PM',
    ])
    expect(buttonFor('Sample plain subject, being sent by Player Three since Mon, Nov 16, 2026 at 9:30 PM')).toBeTruthy()
  })

  it('tell two rows that read alike to the minute apart by their place among them, in the name of each "Use this" alone, each its own choice', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('GET', ISSUES_URL, issues(
      row({ issueId: 'sample-letter-9', monthLabel: MONTH, subject: defaultSubject(MONTH), by: 'Player One', at: '2026-11-16 20:15:40' }),
      row({ issueId: 'sample-letter-8', monthLabel: MONTH, subject: defaultSubject(MONTH), by: 'Player One', at: '2026-11-16 20:15:05' }),
      row({ issueId: 'sample-letter-7', monthLabel: MONTH, subject: defaultSubject(MONTH), by: 'Player One', at: '2026-11-16 18:05:00' }),
    ))
    on('POST', START_URL, startedAs(''))
    await thePage()
    const dialog = await openFrom(pickWide())
    const named = within(dialog).getAllByRole('button', { name: /^Use this: December 2026/ }).map((button) => button.getAttribute('aria-label'))
    expect(named).toEqual([
      'Use this: December 2026, set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM, the 1st of 2 with this name',
      'Use this: December 2026, set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM, the 2nd of 2 with this name',
      'Use this: December 2026, set aside by Player One on Mon, Nov 16, 2026 at 12:05 PM',
    ])
    // What is drawn is each row's own words; the place is for a screen reader, the rows standing newest first.
    const lines = within(dialog).getAllByRole('listitem').slice(4).map((item) => item.textContent?.replace(/Use this$/, ''))
    expect(lines).toEqual([
      'December 2026Set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM',
      'December 2026Set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM',
      'December 2026Set aside by Player One on Mon, Nov 16, 2026 at 12:05 PM',
    ])
    fireEvent.click(buttonFor('December 2026, set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM, the 2nd of 2 with this name'))
    await settle(80)
    expect(starts).toEqual([{ from: { issueId: 'sample-letter-8' }, monthLabel: MONTH }])
  })

  it('scroll inside the chooser with twenty, the last one reached', async () => {
    windowAt(1440)
    on('GET', ISSUES_URL, issues(...Array.from({ length: 20 }, (_, n) => row({ issueId: `sample-letter-${n}`, monthLabel: `Example month ${n + 1}` }))))
    await thePage()
    const dialog = await openFrom(pickWide())
    const buttons = within(dialog).getAllByRole('button')
    expect(buttons).toHaveLength(25)
    act(() => buttons[24].focus())
    expect(focused().getAttribute('aria-label')).toBe('Use this: Example month 20, replaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM')
    // The choices are the chooser's own scroller, under its head, which holds Close.
    const choices = buttons[24].closest('.overflow-y-auto')
    expect(choices).toBeTruthy()
    expect(choices).not.toBe(dialog)
    expect(choices?.contains(buttons[0])).toBe(false)
  })
})

describe('the one rule for a letter that holds words', () => {
  const drafts = [
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '' },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '<p></p>' },
    { monthLabel: MONTH, subject: ` ${defaultSubject(MONTH)} `, preheader: '  ', bodyHtml: '<p>&nbsp;</p>' },
    { monthLabel: 'January 2027', subject: defaultSubject('January 2027'), preheader: '', bodyHtml: '' },
    { monthLabel: MONTH, subject: 'Sample subject of its own', preheader: '', bodyHtml: '' },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: 'Sample preview line', bodyHtml: '' },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '<p>Sample</p>' },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '<h2>Sample heading one</h2><p></p>' },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: '<p>&lt; 2</p>' },
    { monthLabel: 'January 2027', subject: defaultSubject(MONTH), preheader: '', bodyHtml: '' },
    ...STARTER_IDS.map((id) => ({ monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: starterLetter(id) })),
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: starterLetter('monthly').replaceAll('<p></p>', '<p><br></p>') },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: starterLetter('monthly').replace('<h2>Coming up</h2><p></p>', '<h2>Coming up</h2><p>Sample</p>') },
    { monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: starterLetter('monthly').replace('<h2>Results</h2>', '<h2>Sample heading one</h2>') },
  ]

  it('is the server\'s own: the page and the server read every one of these letters alike, as a save sends it', () => {
    const trimmedOf = (draft: (typeof drafts)[number]) => ({ ...draft, monthLabel: draft.monthLabel.trim(), subject: draft.subject.trim(), preheader: draft.preheader.trim() })
    for (const draft of drafts) expect(holdsWords(draft), JSON.stringify(draft)).toBe(serverHoldsWords(trimmedOf(draft)))
    expect(drafts.map((draft) => holdsWords(draft))).toEqual([false, false, false, false, true, true, true, true, true, true, false, false, false, false, false, true, true])
  })
})

describe('starting a letter', () => {
  it('asks once before a letter that holds words is replaced: the focus on Keep writing, Escape and Keep writing starting nothing and giving it back to the "Use this" pressed', async () => {
    windowAt(1440)
    on('POST', START_URL, startedAs(starterLetter('monthly')))
    await thePage()
    await openFrom(pickWide())
    for (const answer of ['Escape', 'Keep writing'] as const) {
      const pressed = buttonFor('Monthly newsletter')
      act(() => pressed.focus())
      fireEvent.click(pressed)
      await settle()
      const asked = question()!
      expect(asked, answer).toBeTruthy()
      expect(within(asked).getByText('Your words are kept under Your last newsletters.')).toBeTruthy()
      expect(focused(), answer).toBe(within(asked).getByRole('button', { name: 'Keep writing' }))
      if (answer === 'Escape') key(focused(), 'Escape')
      else fireEvent.click(focused())
      await settle()
      expect(question(), answer).toBeNull()
      expect(chooser(), answer).toBeTruthy()
      expect(focused(), answer).toBe(buttonFor('Monthly newsletter'))
      expect(starts, answer).toEqual([])
    }
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    fireEvent.click(within(question()!).getByRole('button', { name: 'Replace it' }))
    await settle()
    expect(starts).toEqual([{ from: 'monthly', monthLabel: MONTH }])
  })

  it('asks for each thing that counts as words, and starts at once from a letter with none, by the one rule', async () => {
    windowAt(1440)
    const cases: Array<[string, Record<string, unknown>, boolean]> = [
      ['nothing written', { bodyHtml: '' }, false],
      ['an untouched starter', { bodyHtml: starterLetter('monthly') }, false],
      ['a month changed alone', { bodyHtml: '', monthLabel: 'January 2027', subject: defaultSubject('January 2027') }, false],
      ['a subject of its own', { bodyHtml: '', subject: 'Sample subject of its own' }, true],
      ['an inbox preview line', { bodyHtml: '', preheader: 'Sample preview line' }, true],
      ['words in the letter', { bodyHtml: '<p>Sample words one</p>' }, true],
      ['a heading of its own, the president\'s note among them', { bodyHtml: '<h2>A note from the president</h2><p></p>' }, true],
    ]
    for (const [what, extra, asks] of cases) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: letter(extra) })
      on('POST', START_URL, startedAs(''))
      await thePage()
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Blank letter'))
      await settle()
      expect(!!question(), what).toBe(asks)
      expect(starts, what).toHaveLength(asks ? 0 : 1)
    }
  })

  it('saves the words on the page first and waits for that save, and starts nothing when it fails or is refused', async () => {
    windowAt(1440)
    // The letter as the server holds it once the save has answered, which the read made once the question is answered finds.
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, subject: 'Sample subject one' }) })
    on('POST', START_URL, startedAs(''))
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    const save = later()
    on('PUT', ISSUE_URL, save.answer)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Short notice'))
    await settle()
    // The pause is cut short: the save goes at once, and nothing is started while it is on its way.
    expect(puts).toHaveLength(1)
    expect(puts[0]).toMatchObject({ subject: 'Sample subject one' })
    expect(starts).toEqual([])
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Saving your words first...')
    await save.give({ status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
    // A subject of its own is words, so the question comes once the save has answered.
    expect(question()).toBeTruthy()
    fireEvent.click(within(question()!).getByRole('button', { name: 'Replace it' }))
    await settle()
    expect(calls.indexOf(`PUT ${ISSUE_URL}`)).toBeLessThan(calls.indexOf(`POST ${START_URL}`))
    expect(starts).toEqual([{ from: 'short-notice', monthLabel: MONTH }])
    expect(puts).toHaveLength(1)

    for (const [why, answer, words, notice] of [
      ['failed', { status: 500, body: { error: 'Something went wrong' } }, 'Your words could not be saved, so no letter was started. Try again in a moment.', 'Could not save'],
      ['refused', { status: 413, body: { error: 'This letter is too long for one email. Make it shorter, then save again.' } }, 'Your words could not be saved, so no letter was started.', 'This letter is too long for one email. Make it shorter, then save again.'],
      ['a 409', refusedWith('changed'), 'Your words could not be saved, so no letter was started.', 'Player Two changed this letter'],
    ] as const) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: letter() })
      on('PUT', ISSUE_URL, answer)
      await thePage()
      fireEvent.change(subject(), { target: { value: 'Sample subject two' } })
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      expect(puts, why).toHaveLength(1)
      expect(question(), why).toBeNull()
      expect(starts, why).toEqual([])
      // Said inside the chooser, which hides the saved line, and the chooser stays open.
      const alerts = within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' | ')
      expect(alerts, why).toContain(words)
      expect(alerts, why).toContain(notice)
    }
  })

  it('reads the letter first when nothing on the page is unsaved, and asks nothing and starts nothing when someone else has saved over it, written it, replaced it or sent it since', async () => {
    windowAt(1440)
    const none = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
    const cases: Array<[string, ReturnType<typeof letter>, unknown, Given, string, string]> = [
      // The page holds its saved words at version 3, and Player Two has since cleared the letter.
      ['saved over with nothing in it', letter(), emptyLetter({ version: 4 }), refusedWith('changed'), 'Player Two changed this letter', 'Nothing more is saved over their letter.'],
      // The page opened on an empty letter, and Player Two has written it since.
      ['written since the page opened on it empty', emptyLetter(), letter({ version: 4 }), refusedWith('changed'), 'Player Two changed this letter', 'Nothing more is saved over their letter.'],
      ['replaced by a letter someone else started', letter(), letter({ id: 'sample-letter-9', version: 1, bodyHtml: '' }), refusedWith('set_aside'), 'Player Two started a new letter', 'Nothing more is saved over their letter.'],
      ['sent, with no letter open since', letter(), none, refusedWith('sent'), 'Player Two sent this letter', 'Nothing more is saved to it.'],
    ]
    for (const [why, opened, read, refusal, notice, after] of cases) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: opened }, { status: 200, body: read })
      on('PUT', ISSUE_URL, refusal)
      on('POST', START_URL, startedAs(''))
      await thePage()
      const before = screen.getByRole('textbox', { name: 'The letter' }).innerHTML
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      expect(calls.filter((call) => call === `GET ${ISSUE_URL}`), why).toHaveLength(2)
      expect(question(), why).toBeNull()
      expect(starts, why).toEqual([])
      // The words on the page go as a save at the version the page knows, not the one just read, which the server
      // refuses, writing nothing.
      expect(puts, why).toEqual([{ id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: opened.issue.bodyHtml }])
      const alerts = within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' | ')
      expect(alerts, why).toContain('No new letter was started.')
      expect(alerts, why).toContain(notice)
      expect(alerts, why).toContain(`2:17 PM. ${after} Your words stay here for you to copy.`)
      key(focused(), 'Escape')
      await settle()
      expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML, why).toBe(before)
      expect(savedLine().textContent, why).toContain(notice)
      if (why !== 'sent, with no letter open since') expect(within(savedLine()).getByRole('button', { name: 'Show their letter' }), why).toBeTruthy()
    }
  })

  it('reads the letter again once Replace it is pressed, since the question can stand open a while, and starts nothing when someone else has changed it meanwhile', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 200, body: letter() }, { status: 200, body: letter({ version: 4, bodyHtml: '<p>Sample words of the other person</p>' }) })
    on('PUT', ISSUE_URL, refusedWith('changed'))
    on('POST', START_URL, startedAs(starterLetter('monthly')))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    // Read as the page knows it, so the question is asked of the words the server would keep.
    expect(question()).toBeTruthy()
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(2)
    expect(puts).toEqual([])
    fireEvent.click(within(question()!).getByRole('button', { name: 'Replace it' }))
    await settle()
    expect(calls.filter((call) => call === `GET ${ISSUE_URL}`)).toHaveLength(3)
    expect(starts).toEqual([])
    expect(puts).toEqual([expect.objectContaining({ id: 'sample-letter-1', version: 3, bodyHtml: BODY })])
    const alerts = within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' | ')
    expect(alerts).toContain('No new letter was started.')
    expect(alerts).toContain('Player Two changed this letter')
    expect(focused()).toBe(buttonFor('Monthly newsletter'))
  })

  it('sends, for each kind of choice, where its words come from and the month the page is on', async () => {
    windowAt(1440)
    const rows = [
      row({ issueId: 'sample-letter-7', campaignId: 'campaign-sample-7', monthLabel: 'November 2026', state: 'completed', totalRecipients: 155 }),
      row({ issueId: 'sample-letter-6', monthLabel: 'October 2026' }),
      row({ issueId: null, campaignId: 'campaign-sample-5', monthLabel: '', subject: 'Sample plain subject', state: 'completed', totalRecipients: 12 }),
    ]
    const expected: Array<[string, unknown]> = [
      ['Blank letter', 'blank'], ['Monthly newsletter', 'monthly'], ['Results and thanks', 'results-and-thanks'], ['Short notice', 'short-notice'],
      ['November 2026, sent Mon, Nov 16, 2026 to 155 members', { issueId: 'sample-letter-7' }],
      ['October 2026, replaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM', { issueId: 'sample-letter-6' }],
      ['Sample plain subject, sent Mon, Nov 16, 2026 to 12 members', { campaignId: 'campaign-sample-5' }],
    ]
    for (const [name, from] of expected) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      on('GET', ISSUES_URL, issues(...rows))
      on('POST', START_URL, startedAs(''))
      await thePage()
      await openFrom(pickWide())
      fireEvent.click(buttonFor(name))
      await settle()
      expect(starts, name).toEqual([{ from, monthLabel: MONTH }])
    }
    // The month is the one the page is on, as the person set it in the band; the read after its save finds the letter
    // as the server then holds it, at the version that save's answer gave.
    await again()
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() }, { status: 200, body: emptyLetter({ version: 4, monthLabel: 'January 2027', subject: defaultSubject('January 2027') }) })
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: /Click to edit the month/ }))
    const month = screen.getByRole('textbox', { name: 'The month' })
    fireEvent.change(month, { target: { value: 'January 2027' } })
    key(month, 'Enter')
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle()
    expect(starts).toEqual([{ from: 'blank', monthLabel: 'January 2027' }])
  })

  it('puts the new letter on the page, closes the chooser and More options, gives the focus to the first step and says once which choice it came from', async () => {
    for (const [width, step] of [[1440, pickWide], [390, pickPhone]] as const) {
      await again()
      windowAt(width)
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter({ preheader: '' }) })
      on('POST', START_URL, startedAs(starterLetter('results-and-thanks')))
      await thePage()
      if (width === 390) fireEvent.click(screen.getByRole('button', { name: 'More options' }))
      await openFrom(step())
      fireEvent.click(buttonFor('Results and thanks'))
      await settle(80)
      expect(noChooser(), String(width)).toBeNull()
      expect(screen.queryByRole('group', { name: 'More options' }), String(width)).toBeNull()
      expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML, String(width)).toContain('Results and thanks')
      expect(subject().value, String(width)).toBe(defaultSubject(MONTH))
      expect(focused(), String(width)).toBe(step())
      // The line says it a quarter of a second after the focus (the case after this one).
      await settle(300)
      expect(quietLine(), String(width)).toBe('Started from Results and thanks')
    }
    // A past letter names its month, and the blank letter is "a blank letter".
    for (const [name, words] of [['Example: November 2026, replaced by a newer letter on Mon, Nov 16, 2026 at 2:15 PM', 'Started from Example: November 2026'], ['Blank letter', 'Started from a blank letter']]) {
      await again()
      windowAt(1440)
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      on('GET', ISSUES_URL, issues(row()))
      on('POST', START_URL, startedAs('<p>Sample words of the past letter</p>'))
      await thePage()
      await openFrom(pickWide())
      fireEvent.click(buttonFor(name))
      // The start lands and the new letter is drawn; its line says the start a quarter of a second after.
      await settle(80)
      await settle(300)
      expect(quietLine(), name).toBe(words)
    }
  })

  it('draws the new letter\'s saved line empty, and says which choice it came from only after a quarter of a second, so a screen reader is told of it', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter({ preheader: '' }) })
    on('POST', START_URL, startedAs(starterLetter('results-and-thanks')))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Results and thanks'))
    await settle(80)
    // The new letter is drawn and the focus is on its first step, while its saved line's polite region, drawn afresh
    // with it, is still empty: a screen reader says a change to a region already there, not a region drawn with words.
    expect(focused()).toBe(pickWide())
    expect(quietLine()).toBe('')
    await settle(300)
    expect(quietLine()).toBe('Started from Results and thanks')
  })

  it('says why each refused or failed start started nothing, inside the chooser, and leaves the letter on the page as it was', async () => {
    windowAt(1440)
    // A refusal's time is said as the saved line says it, "at 2:17 PM" on its own day and with the day on any other, so
    // the words are held up to the time and from just after it.
    const cases: Array<[string, Given, string, string, string]> = [
      ['changed', refusedWith('changed'), 'No new letter was started.', 'Player Two changed this letter', '2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.'],
      ['sent', refusedWith('sent'), 'No new letter was started.', 'Player Two sent this letter', '2:17 PM. Nothing more is saved to it. Your words stay here for you to copy.'],
      ['set aside', refusedWith('set_aside'), 'No new letter was started.', 'Player Two started a new letter', '2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.'],
      ['not found', { status: 404, body: { error: 'Not found' } }, 'That newsletter could not be found, so no letter was started.', '', ''],
      ['the source refused', { status: 413, body: { error: 'That newsletter is too long for one email, so a letter cannot be started from it.' } }, 'That newsletter is too long for one email, so a letter cannot be started from it.', '', ''],
      ['no answer', 'network', 'Could not start a new letter. Try again in a moment.', '', ''],
    ]
    for (const [why, answer, words, notice, after] of cases) {
      await again()
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      on('POST', START_URL, answer)
      await thePage()
      const before = screen.getByRole('textbox', { name: 'The letter' }).innerHTML
      await openFrom(pickWide())
      fireEvent.click(buttonFor('Monthly newsletter'))
      await settle()
      const alerts = within(chooser()).getAllByRole('alert').map((a) => a.textContent).join(' | ')
      expect(alerts, why).toContain(words)
      if (notice) expect(alerts, why).toContain(notice)
      if (after) expect(alerts, why).toContain(after)
      key(focused(), 'Escape')
      await settle()
      expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML, why).toBe(before)
      // The saved line says a 409 as a save's 409 says it, with "Show their letter" where there is one to show.
      if (notice) expect(savedLine().textContent, why).toContain(notice)
      if (after) expect(savedLine().textContent, why).toContain(after)
      if (why === 'changed' || why === 'set aside') expect(within(savedLine()).getByRole('button', { name: 'Show their letter' }), why).toBeTruthy()
    }
  })

  it('keeps the "Use this" pressed in view as words said in its head push the choices down, and leaves the chooser itself as it is', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, refusedWith('changed'))
    // jsdom has no ResizeObserver: this stand-in records what each watcher watches and tells it of a change when asked.
    const watchers: Array<{ tell: () => void; parts: Element[] }> = []
    vi.stubGlobal('ResizeObserver', class {
      parts: Element[] = []
      constructor(callback: ResizeObserverCallback) {
        watchers.push({ tell: () => callback([], this as unknown as ResizeObserver), parts: this.parts })
      }
      observe(part: Element) {
        this.parts.push(part)
      }
      unobserve() {}
      disconnect() {}
    })
    const intoView = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, writable: true, value: intoView })
    try {
      await thePage()
      const dialog = await openFrom(pickWide())
      const watcher = watchers.find((w) => w.parts.includes(dialog))
      // The chooser, its head and its choices.
      expect(watcher?.parts).toHaveLength(3)
      expect(watcher?.parts[1].contains(within(dialog).getByRole('heading', { name: 'Pick a template to start from' }))).toBe(true)
      expect(watcher?.parts[2]).toBe(buttonFor('Short notice').closest('.overflow-y-auto'))
      // With the focus on the chooser itself, as it opens, nothing is moved.
      intoView.mockClear()
      act(() => watcher?.tell())
      expect(intoView).not.toHaveBeenCalled()
      const monthly = buttonFor('Monthly newsletter')
      act(() => monthly.focus())
      fireEvent.click(monthly)
      await settle()
      expect(within(dialog).getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('No new letter was started.')
      intoView.mockClear()
      act(() => watcher?.tell())
      expect(focused()).toBe(monthly)
      expect(intoView.mock.instances).toEqual([monthly])
      expect(intoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('takes no second press while a start is on its way, says it is starting, and does not close', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    const slow = later()
    on('POST', START_URL, slow.answer)
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    expect(within(chooser()).getAllByRole('status').map((s) => s.textContent)).toContain('Starting a new letter...')
    for (const name of ['Monthly newsletter', 'Short notice', 'Blank letter']) {
      expect(buttonFor(name).getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(buttonFor(name))
    }
    key(chooser(), 'Escape')
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Close' }))
    press(scrim())
    await settle()
    expect(chooser()).toBeTruthy()
    expect(starts).toHaveLength(1)
    await slow.give(startedAs(starterLetter('monthly')))
    expect(noChooser()).toBeNull()
    expect(starts).toHaveLength(1)
  })

  it('loses nothing: the old letter\'s words are under Your last newsletters the next time the chooser opens, and using it brings them back', async () => {
    windowAt(1440)
    const words = '<h2>Sample heading one</h2><p>Sample words to keep</p>'
    const own = 'Sample subject to keep'
    // The letter as each read finds it: as the page opens, before the question, once it is answered, and after the start.
    const kept = { status: 200, body: letter({ bodyHtml: words, subject: own }) }
    on('GET', ISSUE_URL, kept, kept, kept, { status: 200, body: startedAs(starterLetter('monthly'), { id: 'sample-letter-2' }).body })
    // The server's start gives each new letter its month's subject and copies a past letter's body alone.
    on('POST', START_URL, startedAs(starterLetter('monthly'), { id: 'sample-letter-2' }), startedAs(words, { id: 'sample-letter-2', version: 2 }))
    on('GET', ISSUES_URL, issues(), issues(row({ issueId: 'sample-letter-1', monthLabel: MONTH, subject: own, by: 'Player One' })))
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Monthly newsletter'))
    await settle()
    fireEvent.click(within(question()!).getByRole('button', { name: 'Replace it' }))
    await settle(80)
    expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML).not.toContain('Sample words to keep')
    const dialog = await openFrom(pickWide())
    expect(dialog.textContent).toContain('Set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM')
    // The Monthly newsletter nobody wrote in holds no words, so the old letter takes its place with no question.
    fireEvent.click(buttonFor(`${MONTH}, set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM`))
    await settle(80)
    expect(question()).toBeNull()
    expect(starts).toEqual([{ from: 'monthly', monthLabel: MONTH }, { from: { issueId: 'sample-letter-1' }, monthLabel: MONTH }])
    expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML).toContain('Sample words to keep')
    // Its subject of its own comes back with its words, as the person's own, and is saved after the pause.
    expect(subject().value).toBe(own)
    await settle(300)
    expect(quietLine()).toBe(`Started from ${MONTH}`)
    await settle(2100)
    expect(puts).toEqual([expect.objectContaining({ id: 'sample-letter-2', version: 2, monthLabel: MONTH, subject: own })])
  }, 15_000)

  it('brings back the subject of its own of a letter set aside used for its own month, and leaves the month\'s subject for any other row', async () => {
    const own = 'Sample subject of its own'
    const cases: Array<[string, Record<string, unknown>, boolean]> = [
      ['a letter set aside, used for its own month', { monthLabel: MONTH, subject: own, by: 'Player One' }, true],
      ['a letter set aside, used for another month', { monthLabel: 'November 2026', subject: own, by: 'Player One' }, false],
      ['a letter set aside with its month\'s own subject', { monthLabel: MONTH, subject: defaultSubject(MONTH), by: 'Player One' }, false],
      ['a letter sent with a subject of its own', { monthLabel: MONTH, subject: own, campaignId: 'campaign-sample-1', state: 'completed', totalRecipients: 155 }, false],
    ]
    for (const [what, past, back] of cases) {
      await again()
      windowAt(1440)
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      on('GET', ISSUES_URL, issues(row({ issueId: 'sample-letter-0', ...past })))
      on('POST', START_URL, startedAs(BODY))
      await thePage()
      const dialog = await openFrom(pickWide())
      const uses = within(dialog).getAllByRole('button', { name: /^Use this: / })
      fireEvent.click(uses[uses.length - 1])
      await settle(80)
      expect(starts, what).toEqual([{ from: { issueId: 'sample-letter-0' }, monthLabel: MONTH }])
      expect(screen.getByRole('textbox', { name: 'The letter' }).innerHTML, what).toContain('Sample words one')
      expect(subject().value, what).toBe(back ? own : defaultSubject(MONTH))
      // The saved line says the start first; a subject taken back is saved after the pause, as an edit is.
      await settle(300)
      expect(quietLine(), what).toBe(`Started from ${String(past.monthLabel)}`)
      expect(puts, what).toEqual([])
      await settle(2100)
      expect(puts, what).toEqual(back ? [expect.objectContaining({ id: 'sample-letter-2', version: 1, monthLabel: MONTH, subject: own, preheader: '' })] : [])
    }
  }, 30_000)

  it('shows the other person, at their next save, what page step 3 built for a letter set aside, with nothing of their words lost', async () => {
    windowAt(1440)
    on('PUT', ISSUE_URL, refusedWith('set_aside', 'Player One'))
    await thePage()
    fireEvent.change(subject(), { target: { value: 'Sample words of the other person' } })
    await settle(2100)
    expect(savedLine().textContent).toContain('Player One started a new letter')
    expect(savedLine().textContent).toContain('2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.')
    expect(subject().value).toBe('Sample words of the other person')
    expect(within(savedLine()).getByRole('button', { name: 'Show their letter' })).toBeTruthy()
  })
})

describe('the wiggle', () => {
  const isWiggle = (a: (typeof animations)[number]) => a.frames.some((frame) => String(frame.transform).includes('rotate(-2deg)'))
  /** The cue comes on the frame after the editor says the letter is drawn, which a busy machine can bring late. */
  const cueStarted = () => waitFor(() => expect(animations).toHaveLength(1), { timeout: 5000 })

  it('plays once as the page opens on a letter that holds no words: the first step and its mark turning 2 degrees each way for a second', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    await thePage()
    await cueStarted()
    const [wiggle] = animations
    expect(isWiggle(wiggle)).toBe(true)
    expect(wiggle.on.getAttribute('data-slot')).toBe('pick-step')
    expect(wiggle.on.contains(pickWide())).toBe(true)
    expect(wiggle.on.textContent).toBe('1Pick a template to start from')
    expect(wiggle.options.duration).toBe(1000)
    expect(wiggle.frames.map((frame) => frame.transform)).toEqual(['rotate(0deg)', 'rotate(-2deg)', 'rotate(2deg)', 'rotate(-2deg)', 'rotate(1.5deg)', 'rotate(0deg)'])
    // Nothing is said to a screen reader for it, and nothing beside the step is asked to move. Since page step 6 the bar
    // holds one polite region, its status line, which stays empty until a step is pressed.
    expect([...theBar().querySelectorAll('[role="status"], [role="alert"]')].map((region) => [region.getAttribute('data-slot'), region.textContent])).toEqual([['bar-said', '']])
  })

  it('plays on a phone on "Pick a template", and never on a letter that holds words', async () => {
    windowAt(390)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    await thePage()
    await cueStarted()
    expect(animations.map((a) => a.on)).toEqual([pickPhone()])
    await again()
    animations = []
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter() })
    await thePage()
    await settle(200)
    expect(animations).toEqual([])
    await again()
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter({ preheader: 'Sample preview line' }) })
    await thePage()
    await settle(200)
    expect(animations).toEqual([])
  })

  it('never plays again while the page stays open: not as things open and close, as the window crosses, as the letter changes size, as words go again, or after a start', async () => {
    const move = windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    on('POST', START_URL, startedAs(''))
    await thePage()
    await cueStarted()
    fireEvent.click(screen.getByRole('button', { name: 'More options' }))
    key(focused(), 'Escape')
    await openFrom(pickWide())
    key(focused(), 'Escape')
    await settle()
    move(390)
    move(1440)
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    await settle(200)
    fireEvent.click(screen.getByRole('button', { name: 'Make smaller' }))
    await settle(200)
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    fireEvent.change(subject(), { target: { value: defaultSubject(MONTH) } })
    await settle(2100)
    await openFrom(pickWide())
    fireEvent.click(buttonFor('Blank letter'))
    await settle(80)
    expect(focused()).toBe(pickWide())
    await settle(100)
    expect(animations).toHaveLength(1)
  })

  it('stops as soon as something is written, and as the focus or a press comes into the bar', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    await thePage()
    await cueStarted()
    expect(animations[0].cancel).not.toHaveBeenCalled()
    fireEvent.change(subject(), { target: { value: 'Sample subject one' } })
    expect(animations[0].cancel).toHaveBeenCalled()
    for (const way of ['focus', 'press'] as const) {
      await again()
      animations = []
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      await thePage()
      await cueStarted()
      if (way === 'focus') act(() => screen.getByRole('button', { name: 'More options' }).focus())
      else fireEvent.pointerDown(pickWide())
      expect(animations[0].cancel, way).toHaveBeenCalled()
    }
  })

  it('does not start while the focus is in the bar', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    // Every frame held until the focus is in the bar, as a person's Tab or press can come before the cue's frame does.
    const held: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => held.push(callback))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    await thePage()
    act(() => pickWide().focus())
    await settle(100)
    expect(held.length).toBeGreaterThan(0)
    act(() => held.splice(0).forEach((callback) => callback(performance.now())))
    await settle(100)
    expect(focused()).toBe(pickWide())
    expect(animations).toEqual([])
  })

  it('keeps still with reduced motion asked for and shows the gold ring for a moment instead, hidden from a screen reader', async () => {
    for (const width of [1440, 390]) {
      await again()
      animations = []
      windowAt(width, { reducedMotion: true })
      on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
      await thePage()
      await cueStarted()
      const [ring] = animations
      expect(isWiggle(ring), String(width)).toBe(false)
      expect(ring.on.getAttribute('data-slot'), String(width)).toBe('pick-ring')
      expect(ring.on.getAttribute('aria-hidden'), String(width)).toBe('true')
      expect(ring.on.closest('button'), String(width)).toBe(width === 390 ? pickPhone() : pickWide())
      expect(ring.frames, String(width)).toEqual([{ opacity: 1 }, { opacity: 1 }])
      expect(ring.options.duration, String(width)).toBe(1500)
      // Drawn in the site's own gold, never while the step has the focus, and not at all in forced colours.
      expect(ring.on.className, String(width)).toMatch(/\bborder-lca-gold\b/)
      expect(ring.on.className, String(width)).toMatch(/\bgroup-focus-visible:hidden\b/)
      expect(ring.on.className, String(width)).toMatch(/\bforced-colors:hidden\b/)
    }
  })
})
