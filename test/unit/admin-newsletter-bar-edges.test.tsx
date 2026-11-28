// @vitest-environment jsdom
//
// Edges of the bar at the foot and More options (WS16 part two, page step 5,
// first part), beside test/unit/admin-newsletter-bar.test.tsx:
// - With the switch mailPage off the route is not registered: no bar, no
//   count asked for, nothing of the letter read.
// - The count: read once however the window moves or the sheet opens, a slow
//   answer reaching an open More options without taking the focus or the
//   words out of its field, thousands with a comma, and every way the left
//   out line can read.
// - The inbox preview line: its 150 characters held by a paste the page
//   takes over, cleared to nothing, kept in the sheet's email on a phone, and
//   sent as the page goes, with More options open.
// - The phone's "Pick a template": a press, a key and a touch open the chooser
//   once, which asks for the last newsletters and the saved templates, once
//   each, and nothing else; a press on it
//   or on "See the email" moves no focus while a field holds the caret, and
//   is left as it is when none does, as one on the computer's first step is.
// - The order of Tab through the page with the bar, at a computer's and a
//   phone's width, and More options' own words under the plain-language
//   rules (no dash, no old initials, no 24-hour time).
// - The room the bar keeps at its scroller's foot while it is taller than
//   its usual height.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject } from '@domain/mail/letter'

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
      mailPageSend: false,
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
const { FootBar } = await import('@/areas/admin/newsletter/FootBar')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const COUNT_URL = '/api/admin/mail/newsletter'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'

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
let answers: Record<string, Array<Answer | Promise<Answer>>> = {}
let calls: string[] = []
let puts: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Array<Answer | Promise<Answer>>) => {
  answers[`${method} ${url}`] = list
}
const letter = (extra: Record<string, unknown> = {}) => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})
/** The newsletter's count as GET /api/admin/mail/newsletter answers it, the made-up 155 unless given. */
const count = (summary: Partial<Record<'addresses' | 'turnedOff' | 'stoppedAll' | 'doNotSend' | 'willGet', number>> = {}) => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null, ...summary } },
})

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

beforeEach(() => {
  window.localStorage.setItem('lca-newsletter-page-help', 'shown') // Help has been seen once, so it does not open by itself here.
  answers = {}
  calls = []
  puts = []
  flags.mailLists = true
  flags.mailPage = true
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'PUT') puts.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (await (list && list.length > 1 ? list.shift() : list?.[0])) ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, count())
  on('PUT', ISSUE_URL, { status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-13 20:20:00', bodyHtml: null } })
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
const focused = () => document.activeElement as HTMLElement
const key = (target: Element, name: string, more: Record<string, unknown> = {}) => fireEvent.keyDown(target, { key: name, ...more })
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const moreButton = () => screen.getByRole('button', { name: 'More options' })
const moreRows = () => screen.queryByRole('group', { name: 'More options' })
const previewLine = () => screen.getByRole('textbox', { name: 'Inbox preview line' }) as HTMLInputElement
const countCalls = () => calls.filter((call) => call === `GET ${COUNT_URL}`).length
const paste = (field: Element, words: string) => fireEvent.paste(field, { clipboardData: { getData: (type: string) => (type === 'text/plain' ? words : '') } })

/**
 * A stand-in for the browser's media query at a window's width, as test/unit/admin-newsletter-sheet.test.tsx gives it:
 * each min-width query answered as a browser does, and the mover, which sets a new width and tells the listeners.
 */
function windowAt(px: number) {
  let width = px
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
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


const tabbable = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [contenteditable="true"], [tabindex]')].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true' && !el.closest('.max-lg\\:hidden'),
  )
const nameOf = (el: HTMLElement) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
/** The dashes and US Chess's old initials are written by code, so that this file holds neither. */
const WORDS_NOT_ALLOWED = [new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`), new RegExp(`\\b${'US' + 'CF'}\\b`), /\b\d\.5\b/, /\b(?:[01]?\d|2[0-3]):[0-5]\d\b(?!\s?[AP]M)/, /\b\d{1,2}\s?(?:am|pm)\b/]

describe('with the switch off', () => {
  it('registers no route: no bar, and nothing of the letter or the count is asked for', async () => {
    flags.mailPage = false
    windowAt(1440)
    await act(async () => {
      render(
        <AuthContext.Provider value={ADMIN}>
          <MemoryRouter initialEntries={['/admin/newsletter']}>
            <App />
          </MemoryRouter>
        </AuthContext.Provider>,
      )
    })
    await settle(300)
    expect(screen.queryByRole('region', { name: 'Pick, check and send' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More options' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'The letter' })).toBeNull()
    expect(calls.filter((call) => call.includes('/api/admin/mail/newsletter'))).toEqual([])
  })
})

describe('the count', () => {
  it('is read once as the page opens, however the window crosses 768 pixels or the sheet and More options open and close', async () => {
    const move = windowAt(390)
    await thePage()
    expect(countCalls()).toBe(1)
    fireEvent.click(moreButton())
    fireEvent.click(moreButton())
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    key(focused(), 'Escape')
    move(820)
    fireEvent.click(moreButton())
    move(1440)
    move(390)
    await settle()
    expect(countCalls()).toBe(1)
  })

  it('reaches an open More options when it is slow, without moving the focus, the caret or the words out of its field', async () => {
    windowAt(1440)
    let answer: (value: Answer) => void = () => {}
    on('GET', COUNT_URL, new Promise<Answer>((resolve) => {
      answer = resolve
    }))
    await thePage()
    fireEvent.click(moreButton())
    expect(within(moreRows()!).getByText('Active LCA members')).toBeTruthy()
    fireEvent.change(previewLine(), { target: { value: 'Sample winter news' } })
    previewLine().setSelectionRange(3, 9)
    await act(async () => {
      answer(count({ addresses: 1160, turnedOff: 5, willGet: 1155 }))
    })
    expect(within(moreRows()!).getByText('Active LCA members: 1,155')).toBeTruthy()
    expect(within(moreRows()!).getByText('Left out: 5 who turned the newsletter off.')).toBeTruthy()
    expect(focused()).toBe(previewLine())
    expect([previewLine().value, previewLine().selectionStart, previewLine().selectionEnd]).toEqual(['Sample winter news', 3, 9])
    expect(within(theBar()).getByRole('button', { name: '3 Send to 1,155 people' })).toBeTruthy()
  })

  it('says every way the left out line can read, and no line when the answer names none or could not be read', async () => {
    windowAt(1440)
    for (const [summary, words] of [
      [{ addresses: 157, stoppedAll: 2 }, 'Left out: 2 who turned the newsletter off.'],
      [{ addresses: 156, turnedOff: 1 }, 'Left out: 1 who turned the newsletter off.'],
      [{ addresses: 158, turnedOff: 1, doNotSend: 2 }, 'Left out: 1 who turned the newsletter off and 2 that no longer receive mail.'],
      [{ addresses: 156, doNotSend: 1 }, 'Left out: 1 that no longer receives mail.'],
    ] as const) {
      cleanup()
      on('GET', COUNT_URL, count(summary))
      await thePage()
      fireEvent.click(moreButton())
      expect(within(moreRows()!).getByText(words), words).toBeTruthy()
      expect(within(moreRows()!).getAllByText(/Left out/)).toHaveLength(1)
    }
    cleanup()
    on('GET', COUNT_URL, { status: 500, body: { error: 'Something went wrong' } })
    await thePage()
    fireEvent.click(moreButton())
    expect(within(moreRows()!).queryByText(/Left out/)).toBeNull()
    expect(within(moreRows()!).queryByText(/Active LCA members: \d/)).toBeNull()
  })
})

describe('the inbox preview line', () => {
  it('holds a paste the page takes over to 150 characters where the browser has no insert of its own to apply the field\'s limit', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    const long = `${'Sample words for the line '.repeat(8)}\nand a second line`
    expect(long.length).toBeGreaterThan(150)
    expect(paste(previewLine(), long)).toBe(false)
    expect(previewLine().value.length).toBeLessThanOrEqual(150)
    await settle(2300)
    expect((puts.at(-1)?.preheader as string).length).toBeLessThanOrEqual(150)
  })

  it('is cleared to nothing and saves nothing in its place', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter({ preheader: 'Sample line kept with the letter' }) })
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: '' } })
    await settle(2300)
    expect(puts).toHaveLength(1)
    expect(puts[0].preheader).toBe('')
  })

  it('is in the email the phone\'s sheet shows', async () => {
    windowAt(390)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample line for the phone' } })
    await settle(300)
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    const sheet = screen.getByRole('dialog', { name: 'What members will get' })
    await settle(300)
    expect([...sheet.querySelectorAll('iframe')].some((frame) => frame.getAttribute('srcdoc')?.includes('>Sample line for the phone</div>'))).toBe(true)
    // More options stays open under the sheet, and is as it was when the sheet is closed.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to writing' }))
    await settle()
    expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'See the email' }))
    expect(moreRows()).not.toBeNull()
    expect(previewLine().value).toBe('Sample line for the phone')
  })

  it('is sent as the page goes, with More options open, and when the person leaves the page', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample line sent as the page goes' } })
    expect(puts).toHaveLength(0)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(puts).toHaveLength(1)
    expect(puts[0].preheader).toBe('Sample line sent as the page goes')
    cleanup()
    puts = []
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample line sent as the person leaves' } })
    cleanup()
    await settle()
    expect(puts.at(-1)?.preheader).toBe('Sample line sent as the person leaves')
  })
})

describe('the phone\'s "Pick a template"', () => {
  it('opens the chooser once on a press, a key and a touch, and asks for the last newsletters and the saved templates, once each, and nothing else', async () => {
    windowAt(390)
    await thePage()
    const pick = within(theBar()).getByRole('button', { name: 'Pick a template' })
    const before = calls.length
    act(() => pick.focus())
    fireEvent.pointerDown(pick, { pointerType: 'touch' })
    fireEvent.touchStart(pick)
    fireEvent.touchEnd(pick)
    fireEvent.pointerUp(pick, { pointerType: 'touch' })
    fireEvent.click(pick)
    key(pick, 'Enter')
    key(pick, ' ')
    fireEvent.keyUp(pick, { key: ' ' })
    await settle()
    const chooser = screen.getByRole('dialog', { name: 'Pick a template to start from' })
    expect(screen.getAllByRole('dialog')).toEqual([chooser])
    expect(chooser.contains(focused())).toBe(true)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(pick.getAttribute('aria-expanded')).toBe('true')
    expect(calls.slice(before)).toEqual(['GET /api/admin/mail/newsletter/issues', 'GET /api/admin/mail/newsletter/templates'])
  })

  it('moves no focus on a press of it or of "See the email" while a field holds the caret, so the tab bar cannot come back under the bar before the press ends, and leaves the press as it is when none does, and on the computer\'s first step', async () => {
    const move = windowAt(390)
    await thePage()
    // The browser's own step on a press, the focus moved to what was pressed, is held back on the phone's two buttons
    // while the caret is in the letter or a field: there it would bring back the tab bar, which lifts the bar under the
    // press.
    act(() => screen.getByRole('textbox', { name: 'Subject' }).focus())
    for (const name of ['Pick a template', 'See the email']) {
      expect(fireEvent.mouseDown(within(theBar()).getByRole('button', { name }), { button: 0 }), name).toBe(false)
    }
    // With no field holding the caret the tab bar is drawn already, and the press is the browser's own: what it opens
    // then takes the focus from the button pressed, so no focus ring is drawn round it after a press.
    act(() => focused().blur())
    for (const name of ['Pick a template', 'See the email']) {
      expect(fireEvent.mouseDown(within(theBar()).getByRole('button', { name }), { button: 0 }), name).toBe(true)
    }
    // From 768 pixels up there is no tab bar, and the step's press is the browser's own.
    move(1440)
    expect(fireEvent.mouseDown(within(theBar()).getByRole('button', { name: '1 Pick a template to start from' }), { button: 0 })).toBe(true)
  })
})

describe('Tab through the page with the bar', () => {
  it('ends at a computer\'s width with the letter\'s size row, then More options, then the three steps', async () => {
    windowAt(1440)
    await thePage()
    const names = tabbable(document.querySelector('[data-slot="newsletter-page"]') as HTMLElement).map(nameOf)
    expect(names.slice(-4)).toEqual(['More options', '1 Pick a template to start from', '2 Send a test to me', '3 Send to 155 people'].map((name) => (name === 'More options' ? name : expect.stringContaining(name.slice(2, 8)))))
    expect(names.indexOf('Make bigger')).toBeLessThan(names.length - 4)
  })

  it('ends at a phone\'s width with the size row, More options at the page\'s end, then the bar\'s two buttons, and opening More options puts its field right after its button', async () => {
    windowAt(390)
    await thePage()
    const page = document.querySelector('[data-slot="newsletter-page"]') as HTMLElement
    const last = () => tabbable(page).slice(-3).map(nameOf)
    expect(last()).toEqual(['More options', expect.stringContaining('Pick a template'), 'See the email'])
    fireEvent.click(moreButton())
    const stops = tabbable(page)
    const at = stops.indexOf(moreButton())
    expect(stops[at + 1]).toBe(previewLine())
    expect(stops.slice(-2).map(nameOf)).toEqual([expect.stringContaining('Pick a template'), 'See the email'])
  })
})

describe('the words of the bar and More options', () => {
  it('hold no dash, no old initials and no 24-hour time at a computer\'s, a tablet\'s and a phone\'s width, with More options open', async () => {
    for (const width of [1440, 820, 390]) {
      cleanup()
      windowAt(width)
      on('GET', COUNT_URL, count({ addresses: 1210, turnedOff: 50, doNotSend: 5, willGet: 1155 }))
      await thePage()
      fireEvent.click(moreButton())
      const words = [theBar().textContent ?? '', moreRows()?.textContent ?? '', ...[...document.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label') ?? '')].join(' | ')
      for (const rule of WORDS_NOT_ALLOWED) expect(words, `${width} ${rule}`).not.toMatch(rule)
      expect(moreRows()!.querySelectorAll('a, [href]')).toHaveLength(0)
    }
  })
})

describe('the room the bar keeps at the foot of its scroller', () => {
  let heights = new Map<Element, number>()
  const watchers: Array<() => void> = []
  const had = { observer: globalThis.ResizeObserver, height: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight') }
  beforeEach(() => {
    heights = new Map()
    watchers.length = 0
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly run: () => void) {}
      observe() {
        watchers.push(this.run)
      }
      disconnect() {
        const at = watchers.indexOf(this.run)
        if (at >= 0) watchers.splice(at, 1)
      }
      unobserve() {}
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get() { return heights.get(this) ?? 0 } })
  })
  afterEach(() => {
    if (had.height) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', had.height)
    else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    if (had.observer) globalThis.ResizeObserver = had.observer
    document.documentElement.style.removeProperty('scroll-padding-bottom')
  })
  const carry = { hold: () => () => undefined, find: () => null }
  const draw = (props: { phone: boolean; bigger: boolean }) =>
    render(
      <div data-slot="desk">
        <FootBar {...props} count={155} onSeeEmail={() => {}} sheetOpen={false} carry={carry} />
      </div>,
    )
  const growTo = (px: number) => {
    heights.set(document.querySelector('[data-slot="foot-bar"]') as Element, px)
    act(() => watchers.slice().forEach((run) => run()))
  }

  it('sets nothing at the usual height, and the difference, beside the tab bar\'s room, while the bar is taller, at a computer\'s width and a phone\'s', () => {
    for (const [phone, usual] of [[false, 76], [true, 71]] as const) {
      const view = draw({ phone, bigger: false })
      const root = document.documentElement.style
      const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
      heights.set(bar, usual)
      growTo(usual)
      expect(root.getPropertyValue('scroll-padding-bottom'), `${phone}`).toBe('')
      expect(bar.style.getPropertyValue('--bar-extra'), `${phone}`).toBe('')
      growTo(usual + 44)
      expect(root.getPropertyValue('scroll-padding-bottom'), `${phone}`).toBe('calc(var(--bottom-chrome-h, 0px) + 44px)')
      // The bar carries the same difference, which its own controls take off the room kept below them, so a focus of
      // one in the bar at the window's foot never pushes the page.
      expect(bar.style.getPropertyValue('--bar-extra'), `${phone}`).toBe('44px')
      expect(bar.className, `${phone}`).toContain('[&_:is(a,button,input,textarea,[tabindex])]:scroll-mb-[calc(var(--bar-extra,0px)*-1)]!')
      // Above them, the room for the site's header counted once with the root's own room for the new look's header, in
      // rem, so it grows with the person's own text size as the header does.
      expect(bar.className, `${phone}`).toContain('[&_:is(a,button,input,textarea,[tabindex])]:scroll-mt-[calc(3.25rem+var(--header-h,4rem)-var(--header-h,0px))]!')
      growTo(usual)
      expect(root.getPropertyValue('scroll-padding-bottom'), `${phone}`).toBe('')
      expect(bar.style.getPropertyValue('--bar-extra'), `${phone}`).toBe('')
      growTo(usual + 20)
      view.unmount()
      expect(root.getPropertyValue('scroll-padding-bottom'), `${phone}`).toBe('')
      expect(bar.style.getPropertyValue('--bar-extra'), `${phone}`).toBe('')
      expect(watchers).toHaveLength(0)
    }
  })

  it('sets it on the letter\'s own scroller while the letter fills the window, and takes it away as it goes', () => {
    const view = draw({ phone: false, bigger: true })
    const desk = document.querySelector('[data-slot="desk"]') as HTMLElement
    const bar = document.querySelector('[data-slot="foot-bar"]') as HTMLElement
    growTo(120)
    expect(desk.style.getPropertyValue('scroll-padding-bottom')).toBe('44px')
    expect(bar.style.getPropertyValue('--bar-extra')).toBe('44px')
    expect(document.documentElement.style.getPropertyValue('scroll-padding-bottom')).toBe('')
    view.unmount()
    expect(desk.style.getPropertyValue('scroll-padding-bottom')).toBe('')
    expect(bar.style.getPropertyValue('--bar-extra')).toBe('')
  })
})
