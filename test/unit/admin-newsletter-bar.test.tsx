// @vitest-environment jsdom
//
// The bar at the foot of the newsletter's own page and More options (WS16
// part two, page step 5, first part). This step's second and third parts add
// their own cases here.
//
// - The bar at a computer's width: More options, then the three numbered
//   steps, each drawn and not yet available, a button a screen reader says
//   is not available, which Tab reaches and no press, key or touch acts on;
//   the count read once, as Group email's newsletter tab reads it, in Send,
//   and "Send" alone while it is not known or could not be read.
// - The bar on a phone, as far as this runtime can tell: the page decides
//   which side of 768 pixels it is on by the browser's media query, given
//   here through a stand-in for matchMedia, which jsdom lacks, as the sheet's
//   test file gives it. The phone's two buttons, no "See the email" in the
//   head, More options at the page's end; the email's sheet opened from the
//   bar giving the focus back to the bar's button, and to whichever "See the
//   email" is on the page when the window crossed 768 pixels while it was
//   open; the focus carried as the window crosses, by a plain focus, which a
//   browser brings into view where the control then stands, and with the
//   letter made bigger, where nothing takes the bar's "See the email"'s
//   place, given to the letter's own "Show the email".
// - More options: closed when the page opens, naming its rows only while
//   they are drawn; open on a press with the focus in its field and back on
//   its button by Escape and a second press; in the bar, closed by a press
//   outside it and as the focus moves on out of it, into the email's frame
//   as well, and left open by a blur that leaves the focus on the page's
//   body or in its field, leaving nothing behind for its next opening; at a
//   phone's page end, opened in place, left open by a press outside it and
//   closed by Escape; closed when it is drawn in the bar already open with
//   the focus elsewhere; its field's caret, carried across 768 pixels, given
//   before the focus; who gets it and where replies go in words, with no
//   link; the inbox preview line saved with the letter, shown in the
//   preview's email, kept on a reload, refused in the server's words on the
//   saved line, taking typing and pastes as the Subject's field does, and
//   held to its 150 characters by a paste the page takes over.
// - The Subject's field that wraps its words, under 1024 pixels, brought into
//   view whole after a paste, as it is as it takes the focus.
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
const frame = () => act(async () => new Promise((resolve) => requestAnimationFrame(resolve)))
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
/** The bar's buttons are these, in this order, each found by the name a screen reader says. */
const expectBar = (names: string[]) => {
  const bar = theBar()
  expect(within(bar).getAllByRole('button')).toEqual(names.map((name) => within(bar).getByRole('button', { name })))
}
const moreButton = () => screen.getByRole('button', { name: 'More options' })
const moreRows = () => screen.queryByRole('group', { name: 'More options' })
const previewLine = () => screen.getByRole('textbox', { name: 'Inbox preview line' }) as HTMLInputElement
const countCalls = () => calls.filter((call) => call === `GET ${COUNT_URL}`).length
const paste = (field: Element, words: string) => fireEvent.paste(field, { clipboardData: { getData: (type: string) => (type === 'text/plain' ? words : '') } })
/**
 * Each control given the focus while `run` runs, with what it was asked, a plain focus being one a browser brings into
 * view, and, for a field, the caret it held as it was given the focus.
 */
function focusCalls(run: () => void): Array<{ to: HTMLElement; how: FocusOptions | undefined; caret?: Array<number | null> }> {
  const made: Array<{ to: HTMLElement; how: FocusOptions | undefined; caret?: Array<number | null> }> = []
  const had = HTMLElement.prototype.focus
  HTMLElement.prototype.focus = function spy(this: HTMLElement, how?: FocusOptions) {
    made.push({ to: this, how, ...(this instanceof HTMLInputElement ? { caret: [this.selectionStart, this.selectionEnd] } : {}) })
    had.call(this, how)
  }
  try {
    run()
  } finally {
    HTMLElement.prototype.focus = had
  }
  return made
}

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

describe('the bar at the foot, from 768 pixels up', () => {
  it('holds More options, then 1 Pick a template to start from, 2 Send a test to me and 3 Send to 155 people, after the letter', async () => {
    windowAt(1440)
    await thePage()
    expectBar(['More options', '1 Pick a template to start from', '2 Send a test to me', '3 Send to 155 people'])
    // The bar is the page's own last part, so Tab reaches it after the letter and the side, as the eye does.
    const page = document.querySelector('[data-slot="newsletter-page"]') as HTMLElement
    expect(page.lastElementChild).toBe(theBar())
    expect(screen.getByRole('button', { name: 'Make bigger' }).compareDocumentPosition(theBar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // More options is no numbered step: it is no fill and no number, and says whether it is open.
    expect(moreButton().getAttribute('aria-expanded')).toBe('false')
    expect(moreButton().hasAttribute('aria-disabled')).toBe(false)
    // "See the email" is not in the bar from 768 pixels up.
    expect(within(theBar()).queryByRole('button', { name: 'See the email' })).toBeNull()
  })

  it('draws the three numbered steps not yet available: each says so, Tab reaches it, and no press, key or touch acts on it', async () => {
    windowAt(1440)
    await thePage()
    const steps = ['1 Pick a template to start from', '2 Send a test to me', '3 Send to 155 people'].map((name) => within(theBar()).getByRole('button', { name }))
    const before = calls.length
    for (const step of steps) {
      expect(step.getAttribute('aria-disabled'), step.id).toBe('true')
      // Not the disabled attribute, which would keep Tab from it.
      expect(step.hasAttribute('disabled')).toBe(false)
      expect(step.tabIndex).toBe(0)
      expect(step.getAttribute('type')).toBe('button')
      // It opens nothing, so it says it opens nothing.
      expect(step.hasAttribute('aria-haspopup')).toBe(false)
      expect(step.hasAttribute('aria-expanded')).toBe(false)
      act(() => step.focus())
      expect(focused()).toBe(step)
      fireEvent.pointerDown(step, { pointerType: 'touch' })
      fireEvent.pointerUp(step, { pointerType: 'touch' })
      fireEvent.click(step)
      key(step, 'Enter')
      key(step, ' ')
      fireEvent.keyUp(step, { key: ' ' })
      await settle()
      expect(focused()).toBe(step)
    }
    // Nothing opened, nothing was asked of the server, and More options stayed shut.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(moreRows()).toBeNull()
    expect(calls.slice(before)).toEqual([])
  })

  it('reads the count once as the page opens, as Group email\'s newsletter tab does, in words for one person and for none', async () => {
    windowAt(1440)
    await thePage()
    expect(countCalls()).toBe(1)
    expect(within(theBar()).getByRole('button', { name: '3 Send to 155 people' })).toBeTruthy()
    // The count card at the side says the same number.
    expect(document.querySelector('[data-slot="count-card"]')?.textContent).toBe('155 people will get it')
    // Opening More options, closing it and making the letter bigger ask nothing more.
    fireEvent.click(moreButton())
    key(focused(), 'Escape')
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    await settle()
    expect(countCalls()).toBe(1)
    cleanup()
    on('GET', COUNT_URL, count({ willGet: 1, addresses: 1 }))
    await thePage()
    expect(within(theBar()).getByRole('button', { name: '3 Send to 1 person' })).toBeTruthy()
    cleanup()
    on('GET', COUNT_URL, count({ willGet: 0, addresses: 0 }))
    await thePage()
    expect(within(theBar()).getByRole('button', { name: '3 Send to 0 people' })).toBeTruthy()
  })

  it('says "3 Send" while the count is on its way and when it could not be read, and holds nothing up for it', async () => {
    windowAt(1440)
    let answer: (value: Answer) => void = () => {}
    on('GET', COUNT_URL, new Promise<Answer>((resolve) => {
      answer = resolve
    }))
    await thePage()
    // The letter is on the page and can be written while the count is on its way.
    expect(within(theBar()).getByRole('button', { name: '3 Send' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: 'The letter' })).toBeTruthy()
    await act(async () => {
      answer(count())
    })
    await settle()
    expect(within(theBar()).getByRole('button', { name: '3 Send to 155 people' })).toBeTruthy()
    for (const refused of [{ status: 500, body: { error: 'Something went wrong' } }, { status: 404, body: { error: 'Not found' } }]) {
      cleanup()
      on('GET', COUNT_URL, refused)
      await thePage()
      expect(within(theBar()).getByRole('button', { name: '3 Send' }), String(refused.status)).toBeTruthy()
      // No alert anywhere in the bar or More options for it.
      expect(within(theBar()).queryByRole('alert')).toBeNull()
      fireEvent.click(moreButton())
      expect(within(moreRows()!).getByText('Active LCA members')).toBeTruthy()
      expect(within(moreRows()!).queryByRole('alert')).toBeNull()
    }
  })
})

describe('the bar on a phone, under 768 pixels', () => {
  it('holds "Pick a template", not yet available, and "See the email"; the head draws no "See the email", and More options is at the page\'s end', async () => {
    windowAt(390)
    await thePage()
    expectBar(['Pick a template', 'See the email'])
    const pick = within(theBar()).getByRole('button', { name: 'Pick a template' })
    expect(pick.getAttribute('aria-disabled')).toBe('true')
    expect(pick.tabIndex).toBe(0)
    const see = within(theBar()).getByRole('button', { name: 'See the email' })
    expect(see.getAttribute('aria-haspopup')).toBe('dialog')
    expect(see.getAttribute('aria-expanded')).toBe('false')
    // The only "See the email" on the page is the bar's.
    expect(screen.getAllByRole('button', { name: 'See the email' })).toEqual([see])
    // More options stands at the page's end: after the letter's size row, before the bar, and not in it.
    const more = moreButton()
    expect(theBar().contains(more)).toBe(false)
    expect(more.closest('[data-slot="more-options"]')?.getAttribute('data-place')).toBe('end')
    expect(screen.getByRole('button', { name: 'Make bigger' }).compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(more.compareDocumentPosition(theBar()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(more.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps "See the email" in the head on a tablet, from 768 to 1023 pixels, and More options in the bar', async () => {
    windowAt(820)
    await thePage()
    const see = screen.getByRole('button', { name: 'See the email' })
    expect(theBar().contains(see)).toBe(false)
    expect(moreButton().closest('[data-slot="more-options"]')?.getAttribute('data-place')).toBe('bar')
    expect(theBar().contains(moreButton())).toBe(true)
  })

  it('opens the email\'s sheet from the bar\'s "See the email" and gives the focus back to it, by Escape and by Back to writing', async () => {
    windowAt(390)
    await thePage()
    const see = within(theBar()).getByRole('button', { name: 'See the email' })
    for (const close of ['Escape', 'Back to writing'] as const) {
      act(() => see.focus())
      fireEvent.click(see)
      const sheet = screen.getByRole('dialog', { name: 'What members will get' })
      expect(see.getAttribute('aria-expanded'), close).toBe('true')
      if (close === 'Escape') key(focused(), 'Escape')
      else fireEvent.click(within(sheet).getByRole('button', { name: 'Back to writing' }))
      await settle()
      expect(screen.queryByRole('dialog', { name: 'What members will get' }), close).toBeNull()
      expect(focused(), close).toBe(see)
    }
  })

  it('gives the focus back to whichever "See the email" is on the page when the window crossed 768 pixels while the sheet was open', async () => {
    const move = windowAt(390)
    await thePage()
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    move(820)
    fireEvent.click(within(screen.getByRole('dialog', { name: 'What members will get' })).getByRole('button', { name: 'Back to writing' }))
    await settle()
    const head = screen.getByRole('button', { name: 'See the email' })
    expect(theBar().contains(head)).toBe(false)
    expect(focused()).toBe(head)
    // And the other way: opened from the head's on a tablet, closed on a phone.
    fireEvent.click(head)
    move(390)
    key(focused(), 'Escape')
    await settle()
    expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'See the email' }))
  })

  it('carries the focus to the control drawn in its place as the window crosses 768 pixels', async () => {
    const move = windowAt(390)
    await thePage()
    act(() => within(theBar()).getByRole('button', { name: 'Pick a template' }).focus())
    move(820)
    expect(focused()).toBe(within(theBar()).getByRole('button', { name: '1 Pick a template to start from' }))
    move(390)
    expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'Pick a template' }))
    act(() => within(theBar()).getByRole('button', { name: 'See the email' }).focus())
    // The control drawn in its place may stand elsewhere on the page, as the head's does, so it takes a plain focus, which
    // the browser brings into view with the room the page keeps clear of its header and the bar.
    const calls = focusCalls(() => move(820))
    expect(focused()).toBe(screen.getByRole('button', { name: 'See the email' }))
    expect(calls).toEqual([{ to: focused(), how: undefined }])
    move(390)
    expect(focused()).toBe(within(theBar()).getByRole('button', { name: 'See the email' }))
    act(() => moreButton().focus())
    move(1440)
    expect(focused()).toBe(moreButton())
    expect(theBar().contains(moreButton())).toBe(true)
  })

  it('gives the focus to the letter\'s own "Show the email" when the window grows past 768 pixels while the letter is made bigger, from the bar\'s "See the email" and from the sheet it opened', async () => {
    const move = windowAt(390)
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    await settle(200)
    const bigger = screen.getByRole('dialog', { name: 'The letter, made bigger' })
    const show = within(bigger).getByRole('button', { name: 'Show the email' })
    // Nothing takes the place of the bar's "See the email" past 768 pixels, so the focus goes to the same action in the
    // letter, never out of it to the page's body.
    act(() => within(theBar()).getByRole('button', { name: 'See the email' }).focus())
    move(844)
    expect(focused()).toBe(show)
    expect(bigger.contains(focused())).toBe(true)
    // The sheet opened from the bar's "See the email" and closed past 768 pixels gives it back there too.
    move(390)
    fireEvent.click(within(theBar()).getByRole('button', { name: 'See the email' }))
    move(844)
    fireEvent.click(within(screen.getByRole('dialog', { name: 'What members will get' })).getByRole('button', { name: 'Back to writing' }))
    await settle()
    expect(focused()).toBe(show)
    // Back on a phone, Escape from it gives the focus to Make bigger, where the letter's own giving of it leaves it,
    // though the bar's "See the email" is on the page.
    move(390)
    expect(focused()).toBe(show)
    key(show, 'Escape')
    await settle()
    expect(screen.queryByRole('dialog', { name: 'The letter, made bigger' })).toBeNull()
    expect(focused()).toBe(screen.getByRole('button', { name: 'Make bigger' }))
  })
})

describe('More options', () => {
  it('is closed when the page opens, and a press opens it with the focus in its first field', async () => {
    windowAt(1440)
    await thePage()
    const more = moreButton()
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(moreRows()).toBeNull()
    // It names the rows it opens only while they are drawn, so it never names an element that is not on the page.
    expect(more.hasAttribute('aria-controls')).toBe(false)
    fireEvent.click(more)
    const rows = moreRows()!
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(more.getAttribute('aria-controls')).toBe(rows.id)
    expect(rows.className, 'held under the header in rem, as the header and the bar grow with the text').toContain('max-h-[calc(100dvh-var(--header-h,4rem)-5.75rem)]')
    // Not a dialog: the page behind it stays as it was.
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(focused()).toBe(previewLine())
    expect(rows.contains(previewLine())).toBe(true)
    key(previewLine(), 'Escape')
    expect(moreRows()).toBeNull()
    expect(more.hasAttribute('aria-controls')).toBe(false)
  })

  it('closes on Escape and on a second press of its button, the focus back on the button each time, and Escape there leaves the letter made bigger', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    expect(key(previewLine(), 'Escape')).toBe(false)
    expect(moreRows()).toBeNull()
    expect(focused()).toBe(moreButton())
    expect(moreButton().getAttribute('aria-expanded')).toBe('false')
    // A second press closes it as well, the focus kept on its button.
    fireEvent.click(moreButton())
    expect(focused()).toBe(previewLine())
    fireEvent.click(moreButton())
    expect(moreRows()).toBeNull()
    expect(focused()).toBe(moreButton())
    // With the letter made bigger, the bar is at its foot, and Escape in More options closes More options alone.
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    const bigger = screen.getByRole('dialog', { name: 'The letter, made bigger' })
    expect(bigger.contains(theBar())).toBe(true)
    fireEvent.click(moreButton())
    key(previewLine(), 'Escape')
    expect(moreRows()).toBeNull()
    expect(screen.getByRole('dialog', { name: 'The letter, made bigger' })).toBe(bigger)
    expect(focused()).toBe(moreButton())
  })

  it('closes where the person went on a press outside it and as the focus moves on out of it, never moving the focus itself', async () => {
    windowAt(1440)
    await thePage()
    const test = within(theBar()).getByRole('button', { name: '2 Send a test to me' })
    // A press outside it.
    fireEvent.click(moreButton())
    fireEvent.pointerDown(document.querySelector('.ProseMirror') as HTMLElement)
    expect(moreRows()).toBeNull()
    expect(focused()).not.toBe(moreButton())
    // A press inside it leaves it open.
    fireEvent.click(moreButton())
    fireEvent.pointerDown(previewLine())
    fireEvent.pointerDown(moreRows()!)
    expect(moreRows()).not.toBeNull()
    // The focus moving on out of it, as Tab takes it to the next step: it closes, and the focus stays where it went.
    act(() => test.focus())
    expect(moreRows()).toBeNull()
    expect(focused()).toBe(test)
    // The focus moving between its button and its field leaves it open.
    fireEvent.click(moreButton())
    act(() => moreButton().focus())
    expect(moreRows()).not.toBeNull()
  })

  it('closes as the focus goes into the email\'s frame, which a browser\'s blur does not name, and stays open while the focus is left on the page\'s body or in its own field', async () => {
    windowAt(1440)
    await thePage()
    const frame = document.querySelector('[data-slot="side-preview"] iframe') as HTMLIFrameElement
    // A browser names no element as the focus goes into a frame, where this runtime names the frame, so the blur is sent
    // first, naming nothing, and then the frame takes the focus, as a browser has it.
    fireEvent.click(moreButton())
    act(() => {
      previewLine().blur()
      frame.focus()
    })
    await settle()
    expect(moreRows()).toBeNull()
    expect(focused()).toBe(frame)
    // A press on its own words leaves the focus on the page's body: it stays open.
    fireEvent.click(moreButton())
    act(() => previewLine().blur())
    await settle()
    expect(focused()).toBe(document.body)
    expect(moreRows()).not.toBeNull()
    // A window that loses the focus leaves it in its field: it stays open.
    act(() => previewLine().focus())
    fireEvent.focusOut(previewLine())
    await settle()
    expect(focused()).toBe(previewLine())
    expect(moreRows()).not.toBeNull()
  })

  it('leaves nothing behind when a press outside it closes it: at its next opening, at a phone\'s page end, its field takes one plain focus, as on a fresh page', async () => {
    const move = windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample news line' } })
    previewLine().setSelectionRange(3, 3)
    // A press on the letter takes More options off the page as the press starts, before the press moves the focus.
    const letterBox = document.querySelector('.ProseMirror') as HTMLElement
    fireEvent.pointerDown(letterBox)
    expect(moreRows()).toBeNull()
    act(() => letterBox.focus())
    move(390)
    const calls: Array<FocusOptions | undefined> = []
    const had = HTMLElement.prototype.focus
    HTMLElement.prototype.focus = function spy(this: HTMLElement, how?: FocusOptions) {
      calls.push(how)
      had.call(this, how)
    }
    try {
      fireEvent.click(moreButton())
    } finally {
      HTMLElement.prototype.focus = had
    }
    // One plain focus, which a browser brings into view, and the caret where a field's words end, not where it was.
    expect(calls).toEqual([undefined])
    expect(focused()).toBe(previewLine())
    expect([previewLine().selectionStart, previewLine().selectionEnd]).toEqual([16, 16])
  })

  it('closes as it is drawn in the bar already open while the focus is elsewhere, and stays open when the focus came with the window', async () => {
    const move = windowAt(390)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample news of the winter season' } })
    // Back to the letter: at the page's end More options covers nothing, so it stays open.
    const letterBox = document.querySelector('.ProseMirror') as HTMLElement
    act(() => letterBox.focus())
    expect(moreRows()).not.toBeNull()
    // The phone turned on its side: in the bar its rows would stand over the page's foot, so it closes, and the focus
    // stays in the letter.
    move(844)
    expect(theBar().contains(moreButton())).toBe(true)
    expect(moreRows()).toBeNull()
    expect(moreButton().getAttribute('aria-expanded')).toBe('false')
    expect(focused()).toBe(letterBox)
    // Its words are kept with the letter.
    fireEvent.click(moreButton())
    expect(previewLine().value).toBe('Sample news of the winter season')
    // With the focus on its own button at the page's end, the focus comes with the window, and it stays open.
    move(390)
    act(() => moreButton().focus())
    move(844)
    expect(moreRows()).not.toBeNull()
    expect(focused()).toBe(moreButton())
    expect(theBar().contains(moreButton())).toBe(true)
  })

  it('says who gets it in words, with how many are left out and why when the count says so, and where replies go, with no link', async () => {
    windowAt(1440)
    on('GET', COUNT_URL, count({ addresses: 160, turnedOff: 2, stoppedAll: 1, doNotSend: 2, willGet: 155 }))
    await thePage()
    fireEvent.click(moreButton())
    let rows = moreRows()!
    expect(within(rows).getByText('Active LCA members: 155')).toBeTruthy()
    expect(within(rows).getByText('Left out: 3 who turned the newsletter off and 2 that no longer receive mail.')).toBeTruthy()
    expect(within(rows).getByText('LouisianaChess@gmail.com')).toBeTruthy()
    expect(rows.querySelectorAll('a')).toHaveLength(0)
    expect([...rows.querySelectorAll('dt')].map((term) => term.textContent)).toEqual(['Who gets it', 'Where replies go'])
    for (const [summary, words] of [
      [{ addresses: 155 }, null],
      [{ addresses: 156, doNotSend: 1 }, 'Left out: 1 that no longer receives mail.'],
      [{ addresses: 1205, turnedOff: 1050, willGet: 155 }, 'Left out: 1,050 who turned the newsletter off.'],
    ] as const) {
      cleanup()
      on('GET', COUNT_URL, count(summary))
      await thePage()
      fireEvent.click(moreButton())
      rows = moreRows()!
      expect(within(rows).getByText('Active LCA members: 155')).toBeTruthy()
      if (words === null) expect(within(rows).queryByText(/Left out/)).toBeNull()
      else expect(within(rows).getByText(words)).toBeTruthy()
    }
  })

  it('saves the inbox preview line with the letter, as the Subject is saved, and the preview\'s email carries it', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    expect(previewLine().value).toBe('')
    expect(previewLine().maxLength).toBe(150)
    fireEvent.change(previewLine(), { target: { value: 'Sample news of the winter season' } })
    await settle(2300)
    expect(puts).toHaveLength(1)
    expect(puts[0]).toEqual({ id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: 'Sample news of the winter season', bodyHtml: expect.stringContaining('Sample words two') })
    // The side preview draws the email as renderNewsletter writes it, the preview line in it where an inbox reads it.
    const side = document.querySelector('[data-slot="side-preview"]') as HTMLElement
    expect([...side.querySelectorAll('iframe')].some((frame) => frame.getAttribute('srcdoc')?.includes('>Sample news of the winter season</div>'))).toBe(true)
    // Trimmed as the server trims it: spaces at its ends alone send nothing new.
    fireEvent.change(previewLine(), { target: { value: '  Sample news of the winter season  ' } })
    await settle(2300)
    expect(puts).toHaveLength(1)
  })

  it('shows the preview line the letter was saved with on a reload, and the server\'s words on the saved line when it refuses one', async () => {
    windowAt(1440)
    on('GET', ISSUE_URL, { status: 200, body: letter({ preheader: 'Sample line kept with the letter' }) })
    on('PUT', ISSUE_URL, { status: 400, body: { error: 'Keep the inbox preview line to 150 characters.' } })
    await thePage()
    fireEvent.click(moreButton())
    expect(previewLine().value).toBe('Sample line kept with the letter')
    fireEvent.change(previewLine(), { target: { value: 'Sample line kept with the letter, made longer' } })
    await settle(2300)
    expect(puts.at(-1)?.preheader).toBe('Sample line kept with the letter, made longer')
    const line = document.querySelector('[data-slot="saved-line"]') as HTMLElement
    expect(within(line).getByRole('alert').textContent).toBe('Keep the inbox preview line to 150 characters.')
  })

  it('keeps out a character the server would refuse as it is typed, and takes a paste\'s line breaks and tabs as the Subject\'s field does', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: `Sample${String.fromCharCode(7)} news${String.fromCharCode(0x202e)} line` } })
    expect(previewLine().value).toBe('Sample news line')
    // A row copied from a spreadsheet and lines from a letter, pasted over the whole line: one space for each run.
    previewLine().setSelectionRange(0, previewLine().value.length)
    expect(paste(previewLine(), 'Sample winter\tnews\r\nand more\n')).toBe(false)
    expect(previewLine().value).toBe('Sample winter news and more')
    // Words with neither are left to the browser's own paste.
    expect(paste(previewLine(), 'Sample words')).toBe(true)
    await settle(2300)
    expect(puts.at(-1)?.preheader).toBe('Sample winter news and more')
  })

  it('holds a paste the page takes over to the room its 150 characters leave, never cutting a character written as two, and leaves the Subject a long paste whole', async () => {
    windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    const smile = String.fromCodePoint(0x1f600)
    const words = `Go${smile}\tSample`
    const putIn = (kept: string, pasted: string) => {
      fireEvent.change(previewLine(), { target: { value: kept } })
      previewLine().setSelectionRange(kept.length, kept.length)
      expect(paste(previewLine(), pasted)).toBe(false)
      return previewLine().value
    }
    // Room for three: the smile is two halves, so it goes whole, and the line holds 149.
    expect(putIn('Sample '.repeat(21), words)).toBe(`${'Sample '.repeat(21)}Go`)
    // Room for four: the smile fits whole, and the line holds 150.
    expect(putIn(`${'Sample '.repeat(20)}Sample`, words)).toBe(`${'Sample '.repeat(20)}SampleGo${smile}`)
    expect(previewLine().value.length).toBe(150)
    // A full line takes nothing; chosen words make room for as much as they held.
    expect(putIn(`${'Sample '.repeat(21)}Too`, words)).toBe(`${'Sample '.repeat(21)}Too`)
    previewLine().setSelectionRange(0, 7)
    expect(paste(previewLine(), 'Winter\nnews of the season')).toBe(false)
    expect(previewLine().value).toBe(`Winter ${'Sample '.repeat(20)}Too`)
    await settle(2300)
    expect(puts.at(-1)?.preheader).toBe(`Winter ${'Sample '.repeat(20)}Too`)
    // The Subject has no limit of its own: a long paste with a tab stays whole, the tab one space.
    const subject = screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement
    const was = subject.value
    subject.setSelectionRange(was.length, was.length)
    const long = ` Sample\t${'Sample words for the subject '.repeat(8)}`
    expect(paste(subject, long)).toBe(false)
    expect(subject.value).toBe(`${was}${long.replace('\t', ' ')}`)
    expect(subject.value.length).toBeGreaterThan(200)
  })

  it('stands at the page\'s end on a phone and opens in place, the focus into its field, Escape giving it back, and a press outside leaving it open', async () => {
    windowAt(390)
    await thePage()
    const more = moreButton()
    expect(more.hasAttribute('aria-controls')).toBe(false)
    fireEvent.click(more)
    expect(more.getAttribute('aria-expanded')).toBe('true')
    expect(more.getAttribute('aria-controls')).toBe(moreRows()!.id)
    expect(focused()).toBe(previewLine())
    expect(theBar().contains(previewLine())).toBe(false)
    // It covers nothing, so a press elsewhere on the page leaves it open.
    fireEvent.pointerDown(document.querySelector('.ProseMirror') as HTMLElement)
    expect(moreRows()).not.toBeNull()
    key(previewLine(), 'Escape')
    expect(moreRows()).toBeNull()
    expect(more.hasAttribute('aria-controls')).toBe(false)
    expect(focused()).toBe(more)
  })

  it('stays open and keeps the focus and the caret in its field as the window crosses 768 pixels', async () => {
    const move = windowAt(1440)
    await thePage()
    fireEvent.click(moreButton())
    fireEvent.change(previewLine(), { target: { value: 'Sample news line' } })
    previewLine().setSelectionRange(2, 6)
    // From the bar to the page's end, where the field may stand below the window: the caret where it was, given before
    // a plain focus, so the browser brings the field into view with its caret shown.
    const calls = focusCalls(() => move(390))
    expect(moreButton().closest('[data-slot="more-options"]')?.getAttribute('data-place')).toBe('end')
    expect(focused()).toBe(previewLine())
    expect(calls).toEqual([{ to: previewLine(), how: undefined, caret: [2, 6] }])
    expect([previewLine().value, previewLine().selectionStart, previewLine().selectionEnd]).toEqual(['Sample news line', 2, 6])
    const back = focusCalls(() => move(1440))
    expect(theBar().contains(previewLine())).toBe(true)
    expect(focused()).toBe(previewLine())
    expect(back).toEqual([{ to: previewLine(), how: undefined, caret: [2, 6] }])
    expect([previewLine().selectionStart, previewLine().selectionEnd]).toEqual([2, 6])
  })
})

describe('the Subject under 1024 pixels with the bar at the foot', () => {
  it('brings its whole box into view after a paste, by the page\'s own insert and by the browser\'s, as it does as it takes the focus', async () => {
    windowAt(390)
    await thePage()
    const subject = screen.getByRole('textbox', { name: 'Subject' }) as HTMLTextAreaElement
    const brought: Array<{ what: Element; how: unknown }> = []
    const had = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function into(this: Element, how?: unknown) {
      brought.push({ what: this, how })
    }
    try {
      act(() => subject.focus())
      await frame()
      expect(brought).toEqual([{ what: subject, how: { block: 'nearest' } }])
      subject.setSelectionRange(subject.value.length, subject.value.length)
      // The page's own: words with a line break, which the page puts in on one line.
      expect(paste(subject, ' Sample Winter Open results and\nthe Sample Club Night')).toBe(false)
      await frame()
      expect(brought).toHaveLength(2)
      expect(brought[1]).toEqual({ what: subject, how: { block: 'nearest' } })
      // The browser's own: words with none, which the browser pastes itself.
      expect(paste(subject, ' and the Sample Spring Classic')).toBe(true)
      await frame()
      expect(brought).toHaveLength(3)
      expect(brought[2]).toEqual({ what: subject, how: { block: 'nearest' } })
      // Not when the focus has gone by the time the words are laid out.
      paste(subject, ' and more')
      act(() => subject.blur())
      await frame()
      expect(brought).toHaveLength(3)
    } finally {
      Element.prototype.scrollIntoView = had
    }
  })
})
