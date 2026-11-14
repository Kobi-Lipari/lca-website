// @vitest-environment jsdom
//
// The newsletter's page on a tablet and a phone (WS16 part two, page step 4,
// second half): what the other test files of the page do not hold.
//
// - The email's sheet on its own: a named, modal dialog; the page behind it
//   kept from a press, from scrolling and from a screen reader; the frame it
//   draws closed, with the side preview's own copy of the email, whatever
//   links the letter holds; the foot holding "Back to writing" alone, so the
//   room above it is free for a later step's Send; the sheet clear until its
//   first email has loaded; the keyboard's focus going with the frame that
//   comes on show; Escape.
// - The sheet on the page: it says a refusal that comes while it hides the
//   page, follows the letter as it stands, and gives the focus to the side
//   preview's own control when "See the email" is no longer drawn.
// - What a narrow window is given: the side column and "See the email" each
//   drawn only on their side of 1024 pixels, the Subject's words kept on one
//   line only from 1024 pixels up, and every control of the page,
//   in each state it has, with a floor of 44 pixels in height at a tablet's
//   and at a phone's width. The runtime has no stylesheet, so the floor is
//   read from the classes each control carries, with the variants that apply
//   at each width; the browser run measures the drawn size.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
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
const { EmailSheet } = await import('@/areas/admin/newsletter/SidePreview')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
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
let answers: Record<string, Answer[]> = {}
const on = (method: string, url: string, ...list: Answer[]) => {
  answers[`${method} ${url}`] = list
}
const letter = (bodyHtml = BODY, version = 3) => ({
  issue: { id: 'sample-letter-1', version, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00' },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
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
  flags.mailLists = true
  flags.mailPage = true
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const list = answers[`${method} ${url}`]
    const answer = (list && list.length > 1 ? list.shift() : list?.[0]) ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', '/api/admin/mail/newsletter', { status: 200, body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 9, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 9, recent: [], waits: null } } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete (HTMLElement.prototype as { checkVisibility?: unknown }).checkVisibility
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
const editorOf = () => (document.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor
const focused = () => document.activeElement as HTMLElement
const key = (target: Element, name: string, more: Record<string, unknown> = {}) => fireEvent.keyDown(target, { key: name, ...more })
const sheetOf = () => screen.getByRole('dialog', { name: 'What members will get' })
const framesIn = (root: Element) => [...root.querySelectorAll<HTMLIFrameElement>('iframe')]
/** The browser has finished loading what each frame was given; jsdom loads no frame by itself. */
const loadAll = (root: Element) => {
  for (const frame of framesIn(root)) fireEvent.load(frame)
}

/** A letter holding every kind of link a hand-made letter could, each with an address the frame must never follow. */
const HOSTILE = [
  '<h2>Sample heading one</h2>',
  '<p><a href="https://example.org/a" target="_blank" rel="noopener">Sample one</a></p>',
  '<p><a href="javascript:alert(1)">Sample two</a> <a href="JaVaScRiPt:alert(2)">Sample three</a></p>',
  '<p><a href="data:text/html,sample">Sample four</a> <a href="//example.org/b">Sample five</a> <a href="mailto:player.one@example.org">Sample six</a></p>',
  '<p><a href="/a/path">Sample seven</a> <a href="#sample-heading-two">Sample eight</a></p>',
  '<h2>Sample heading two</h2><p>Sample words two</p>',
].join('')

/** An open sheet over a button that opens it and a control standing for the page behind it. */
function Stand({ body = BODY, subject = 'Sample subject one', returnTo }: { body?: string; subject?: string; returnTo?: () => Array<HTMLElement | null> }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <main data-testid="behind">
        <button type="button" onClick={() => setOpen(true)}>Open the sheet</button>
        <button type="button">Behind one</button>
      </main>
      <EmailSheet
        open={open}
        onOpenChange={setOpen}
        letter={{ monthLabel: 'December 2026', subject, preheader: '', bodyHtml: body }}
        returnFocus={returnTo ?? (() => [])}
      />
    </>
  )
}

describe('the email\'s sheet on its own', () => {
  it('is a named, modal dialog that takes the focus on itself and holds the page behind it from a screen reader, from a press and from scrolling', () => {
    render(<Stand />)
    const opener = screen.getByRole('button', { name: 'Open the sheet' })
    fireEvent.click(opener)
    const sheet = sheetOf()
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(focused()).toBe(sheet)
    // Its words: no em or en dash, and no old name of US Chess.
    expect(sheet.textContent).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]|${'US' + 'CF'}`))
    // The page behind: out of a screen reader's reach, out of a press's, and not to be scrolled.
    expect(screen.getByTestId('behind').closest('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Behind one' })).toBeNull()
    expect(document.body.style.pointerEvents).toBe('none')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true)
    // Closed, all of that is given back.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to writing' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.pointerEvents).not.toBe('none')
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    expect(screen.getByRole('button', { name: 'Behind one' })).toBeTruthy()
  })

  it('draws the email in closed frames whatever links the letter holds: no allowance, no address on any link but a jump link', () => {
    // The sheet is handed what the editor writes, which never carries a link's target.
    render(<Stand body={HOSTILE.replace(' target="_blank" rel="noopener"', '')} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const frames = framesIn(sheetOf())
    expect(frames).toHaveLength(2)
    for (const frame of frames) {
      expect(frame.getAttribute('sandbox')).toBe('')
      expect(frame.getAttribute('title')).toBe('The email as members will get it')
    }
    const email = frames.find((frame) => frame.getAttribute('srcdoc')?.includes('Sample words two'))!.getAttribute('srcdoc')!
    expect(email).toContain('<head>\n<base href="about:srcdoc">')
    expect(email).not.toMatch(/<script|javascript:|data:text|target=|player\.one@example\.org|\/\/example\.org\/b/i)
    const anchors = email.match(/<a\s(?!name=)[^>]*>/g) ?? []
    expect(anchors.length).toBeGreaterThan(8)
    for (const anchor of anchors) {
      expect(anchor, anchor).toContain('tabindex="-1"')
      const href = anchor.match(/\bhref="([^"]*)"/)?.[1]
      // A jump link keeps its address and scrolls inside the frame; every other link has none and says it is not available.
      if (href !== undefined) expect(href, anchor).toMatch(/^#/)
      else expect(anchor, anchor).toContain('role="link" aria-disabled="true"')
    }
    // The only address anywhere in the frame's own copy that does not start with a hash is the frame's base.
    expect([...email.matchAll(/\b(?:href|src|action|formaction|poster|srcset)="([^"]*)"/g)].map((m) => m[1]).filter((v) => !v.startsWith('#') && !v.endsWith('/email-rook.png'))).toEqual(['about:srcdoc'])
  })

  it('keeps its foot for later: "Back to writing" is the foot\'s only control, and no control of the sheet does nothing', () => {
    render(<Stand />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const sheet = sheetOf()
    const foot = sheet.querySelector('[data-slot="email-sheet-foot"]') as HTMLElement
    expect(within(foot).getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to writing'])
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to writing'])
    expect(within(sheet).queryByRole('button', { name: /Send|Schedule|test/i })).toBeNull()
    expect(within(foot).getByRole('button').className).toContain('min-h-[50px]')
  })

  it('stays clear until the email on show has loaded, then shows itself, and is clear again each time it opens', async () => {
    render(<Stand />)
    const inside = () => sheetOf().querySelector('[data-slot="email-sheet-inside"]') as HTMLElement
    for (const round of [1, 2]) {
      fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
      expect(inside().className, `round ${round}`).toContain('opacity-0')
      loadAll(sheetOf())
      expect(inside().className, `round ${round}`).not.toContain('opacity-0')
      fireEvent.click(within(sheetOf()).getByRole('button', { name: 'Back to writing' }))
    }
  })

  it('keeps Tab inside, and takes the keyboard\'s focus along with the frame that comes on show, never leaving it in one that is off show', () => {
    const view = render(<Stand />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const sheet = sheetOf()
    loadAll(sheet)
    const shownFrame = () => sheet.querySelector<HTMLIFrameElement>('iframe[data-shown]')!
    const first = shownFrame()
    act(() => first.focus())
    expect(focused()).toBe(first)
    // The letter changes while the sheet is open: its new email loads in the other frame, which takes the first one's place.
    view.rerender(<Stand body={`${BODY}<p>Zebrafish</p>`} />)
    const other = framesIn(sheet).find((frame) => frame !== first)!
    expect(other.getAttribute('srcdoc')).toContain('Zebrafish')
    fireEvent.load(other)
    expect(shownFrame()).toBe(other)
    expect(first.getAttribute('aria-hidden')).toBe('true')
    expect(focused()).toBe(other)
    expect(sheet.querySelectorAll('iframe[data-shown]')).toHaveLength(1)
  })

  it('closes on Escape, giving the focus to the first of the controls it names that is there, and no earlier one', async () => {
    const named = document.createElement('button')
    named.textContent = 'Named'
    document.body.append(named)
    try {
      render(<Stand returnTo={() => [null, named]} />)
      const opener = screen.getByRole('button', { name: 'Open the sheet' })
      for (const round of [1, 2]) {
        fireEvent.click(opener)
        key(sheetOf(), 'Escape')
        expect(screen.queryByRole('dialog'), `round ${round}`).toBeNull()
        // The focus is given in the turn after the sheet has gone.
        await settle()
        expect(focused(), `round ${round}`).toBe(named)
        act(() => opener.focus())
      }
    } finally {
      named.remove()
    }
  })
})

describe('the sheet on the page', () => {
  it('says in its own region a refusal that comes while it hides the page, and the saved line says it again when the page is back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T21:00:00Z'))
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    await thePage()
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    // The sheet is opened while the save waits for its pause; the refusal comes while the sheet is open.
    fireEvent.click(screen.getByRole('button', { name: 'See the email' }))
    const sheet = sheetOf()
    expect(within(sheet).getByRole('alert').textContent).toBe('')
    await settle(2300)
    const refusal = 'Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.'
    expect(within(sheet).getByRole('alert').textContent).toBe(refusal)
    // Said once while the page is hidden: the saved line behind the sheet is out of a screen reader's reach.
    expect(document.querySelector('[data-slot="saved-line"]')?.closest('[aria-hidden="true"]')).not.toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to writing' }))
    await settle()
    expect(within(document.querySelector('[data-slot="saved-line"]') as HTMLElement).getByRole('alert').textContent).toBe(refusal)
    expect(screen.getByRole('button', { name: 'Show their letter' })).toBeTruthy()
  })

  it('shows the letter as it stands: words typed just before it opened are in the email on show once the pause has passed', async () => {
    await thePage()
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Zebrafish</p>').run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'See the email' }))
    const sheet = sheetOf()
    await waitFor(() => expect(framesIn(sheet).some((frame) => frame.getAttribute('srcdoc')?.includes('Zebrafish'))).toBe(true))
    loadAll(sheet)
    await waitFor(() => expect(sheet.querySelector('iframe[data-shown]')?.getAttribute('srcdoc')).toContain('Zebrafish'))
  })

  it('opens with the email of a letter put away by Hide, the same copy as the side preview\'s frames, and gives the focus back to See the email', async () => {
    await thePage()
    const side = () => framesIn(document.querySelector('[data-slot="side-preview"]')!).find((f) => f.getAttribute('srcdoc')?.includes('Sample words two'))
    await waitFor(() => expect(side()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    const see = screen.getByRole('button', { name: 'See the email' })
    fireEvent.click(see)
    const sheet = sheetOf()
    const mine = framesIn(sheet).find((f) => f.getAttribute('srcdoc')?.includes('Sample words two'))!
    expect(mine.getAttribute('srcdoc')).toBe(side()!.getAttribute('srcdoc'))
    // The sheet's frames are its own: the side column's are not moved into it.
    expect(framesIn(document.querySelector('[data-slot="side-preview"]')!)).toHaveLength(2)
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to writing' }))
    await settle()
    expect(focused()).toBe(see)
  })

  it('gives the focus to the side preview\'s own control when the window has grown and "See the email" is no longer drawn', async () => {
    await thePage()
    const see = screen.getByRole('button', { name: 'See the email' })
    fireEvent.click(see)
    // The window grows past 1024 pixels while the sheet is open: the opener is not drawn, the side column is.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', { configurable: true, value(this: HTMLElement) { return this !== see } })
    fireEvent.click(within(sheetOf()).getByRole('button', { name: 'Back to writing' }))
    await settle()
    expect(focused()).not.toBe(see)
    expect(document.querySelector('[data-slot="side-preview"]')?.contains(focused())).toBe(true)
  })

  it('opens the same sheet from the letter made bigger at any width, and keeps the bigger letter behind it hidden and unpressable', async () => {
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    const bigger = screen.getByRole('dialog', { name: 'The letter, made bigger' })
    fireEvent.click(within(bigger).getByRole('button', { name: 'Show the email' }))
    const sheet = sheetOf()
    expect(bigger.closest('[aria-hidden="true"]')).not.toBeNull()
    expect(document.body.style.pointerEvents).toBe('none')
    expect(framesIn(sheet)).toHaveLength(2)
    expect(within(sheet).getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to writing'])
  })
})

describe('what a narrow window is given', () => {
  it('draws the side column only from 1024 pixels up and "See the email" only under it, and puts the sheet in the page only while it is open', async () => {
    await thePage()
    const side = document.querySelector('[data-slot="side-preview"]')!.parentElement!
    expect(side.className).toMatch(/(^|\s)max-lg:hidden(\s|$)/)
    const see = screen.getByRole('button', { name: 'See the email' })
    expect(see.className).toMatch(/(^|\s)lg:hidden(\s|$)/)
    expect(see.getAttribute('aria-haspopup')).toBe('dialog')
    expect(screen.queryByRole('dialog', { name: 'What members will get' })).toBeNull()
    expect(document.querySelector('[data-slot="email-sheet"]')).toBeNull()
  })

  it('stacks From and Subject under 1024 pixels and never lays them side by side there', async () => {
    await thePage()
    const row = screen.getByRole('group', { name: 'Who it is from and its subject' })
    expect(row.className).toContain('lg:@3xl:grid-cols-[max-content_minmax(0,1fr)]')
    expect(row.className).not.toMatch(/(^|\s)@3xl:grid-cols/)
    expect(row.className).not.toMatch(/(^|\s)(?:max-lg:|md:)?grid-cols-/)
  })

  it('keeps the Subject\'s words on one line from 1024 pixels up, as a field of one line does, and lets them wrap only under it', async () => {
    await thePage()
    const classes = (screen.getByRole('textbox', { name: 'Subject' }).getAttribute('class') ?? '').split(/\s+/)
    // From 1024 pixels up: one line, its words scrolling inside a clear border where the field's padding stands under it.
    expect(classes).toEqual(expect.arrayContaining(['lg:whitespace-pre', 'lg:border-x-[10px]', 'lg:border-transparent', 'lg:px-0']))
    // No other class keeps the words from wrapping, so under 1024 pixels a long subject shows whole.
    expect(classes.filter((name) => /(?:^|:)whitespace-/.test(name))).toEqual(['lg:whitespace-pre'])
    expect(classes.filter((name) => /(?:^|:)(?:border-x-|px-)/.test(name))).toEqual(['px-2.5', 'lg:border-x-[10px]', 'lg:px-0'])
  })

  it('holds the room kept below a focused control: 144 pixels on a phone and 96 elsewhere, the Subject among the controls kept', async () => {
    await thePage()
    const desk = document.querySelector('[data-slot="newsletter-page"]')!
    expect(desk.className).toContain('scroll-mb-24')
    expect(desk.className).toContain('max-md:[&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mb-36')
    expect(desk.className).toContain('[&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mt-24')
  })
})

/**
 * The height a control is given at a window's width, from its classes: the largest of its height, minimum height and
 * size classes whose variants all apply there. A class with a variant that is not about the window's width (hover,
 * focus, a container's) is not counted. 4 pixels to a step, or the pixels a bracket gives.
 */
function floorAt(element: Element, width: number): { height: number; width: number | null; hidden: boolean } {
  const applies = (variant: string) => {
    switch (variant) {
      case 'sm': return width >= 640
      case 'md': return width >= 768
      case 'lg': return width >= 1024
      case 'max-sm': return width < 640
      case 'max-md': return width < 768
      case 'max-lg': return width < 1024
      default: return false
    }
  }
  const px = (value: string) => (/^\[(\d+(?:\.\d+)?)px\]$/.test(value) ? Number(value.slice(1, -3)) : /^\d+(?:\.\d+)?$/.test(value) ? Number(value) * 4 : null)
  let height = 0
  let across: number | null = null
  let hidden = false
  for (const token of element.getAttribute('class')?.split(/\s+/).filter(Boolean) ?? []) {
    const parts = token.split(/:(?![^[]*\])/)
    const base = parts[parts.length - 1]
    if (!parts.slice(0, -1).every(applies)) continue
    if (base === 'hidden') hidden = true
    const tall = base.match(/^(?:min-h|h|size)-(.+)$/)
    const wide = base.match(/^(?:min-w|w|size)-(.+)$/)
    const h = tall ? px(tall[1]) : null
    const w = wide ? px(wide[1]) : null
    if (h !== null) height = Math.max(height, h)
    // A width of nothing is a flex item allowed to shrink, not a size.
    if (w !== null && w > 0) across = Math.max(across ?? 0, w)
  }
  return { height, width: across, hidden }
}

describe('every control a finger can press, at a tablet\'s and a phone\'s width', () => {
  const WIDTHS = [['tablet', 820], ['phone', 390]] as const
  const CONTROLS = 'button, a[href], input, textarea, select, [role="button"], [role="menuitem"]'

  /** Every pressable control in the page and its dialogs, but the letter's own text and the frames. */
  function pressables(): HTMLElement[] {
    const page = document.querySelector('[data-slot="newsletter-page"]')
    return [...document.querySelectorAll<HTMLElement>(CONTROLS)].filter((el) => !!page?.contains(el) && !el.closest('.ProseMirror') && !el.closest('[data-slot="side-preview"]'))
  }
  /** What stands in for a control's own box: the Subject's field and its label are one box of the row. */
  function boxOf(el: HTMLElement): HTMLElement {
    if (el.tagName === 'TEXTAREA' || el.tagName === 'LABEL') return el.parentElement as HTMLElement
    return el
  }
  function check(state: string) {
    const lacking: string[] = []
    const found = pressables()
    expect(found.length, state).toBeGreaterThan(5)
    for (const [name, width] of WIDTHS) {
      for (const el of found) {
        let drawnHere = true
        for (let up: Element | null = el; up; up = up.parentElement) if (floorAt(up, width).hidden) drawnHere = false
        if (!drawnHere) continue
        const box = floorAt(boxOf(el), width)
        const label = `${name}: ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}"`
        if (box.height < 44) lacking.push(`${label} is ${box.height} tall`)
        if (box.width !== null && box.width < 44) lacking.push(`${label} is ${box.width} wide`)
      }
    }
    expect(lacking, state).toEqual([])
  }

  it('gives each a floor of 44 pixels in height, and no fixed width under 44, in the page as it opens', async () => {
    await thePage()
    check('the page')
  })

  it('does the same with a refusal, the Add menu, the link\'s field, the month\'s box, and the letter made bigger', async () => {
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    await thePage()
    // The Add menu.
    fireEvent.click(screen.getByRole('button', { name: /Add an event or line/ }))
    expect(screen.getByRole('menu', { name: 'Add' })).toBeTruthy()
    check('the Add menu')
    key(focused(), 'Escape')
    // The link's field.
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    expect(screen.getByRole('textbox', { name: 'Link address' })).toBeTruthy()
    check('the link\'s field')
    key(focused(), 'Escape')
    // The month's box.
    fireEvent.click(screen.getByRole('button', { name: /Click to edit the month/ }))
    expect(screen.getByRole('textbox', { name: 'The month' })).toBeTruthy()
    check('the month\'s box')
    key(focused(), 'Escape')
    // A refusal, with Show their letter.
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    await settle(2300)
    expect(screen.getByRole('button', { name: 'Show their letter' })).toBeTruthy()
    check('a refusal')
    // The letter made bigger.
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    expect(screen.getByRole('dialog', { name: 'The letter, made bigger' })).toBeTruthy()
    check('the letter made bigger')
  })

  it('gives the sheet\'s own control the same, taller than the rest', async () => {
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'See the email' }))
    for (const [name, width] of WIDTHS) {
      const back = within(sheetOf()).getByRole('button', { name: 'Back to writing' })
      expect(floorAt(back, width).height, name).toBeGreaterThanOrEqual(50)
    }
  })
})

describe('the sheet draws what the letter holds, as an editor writes it', () => {
  it('gives the frame no address but a jump link\'s, whatever kinds of link were put in the letter', async () => {
    await thePage()
    await act(async () => {
      editorOf().commands.setContent(HOSTILE)
    })
    fireEvent.click(screen.getByRole('button', { name: 'See the email' }))
    const sheet = sheetOf()
    await waitFor(() => expect(framesIn(sheet).some((f) => f.getAttribute('srcdoc')?.includes('Sample three'))).toBe(true))
    for (const frame of framesIn(sheet)) {
      expect(frame.getAttribute('sandbox')).toBe('')
      const email = frame.getAttribute('srcdoc') ?? ''
      if (!email.includes('Sample three')) continue
      expect([...email.matchAll(/\b(?:href|src|action|formaction|poster|ping|srcset)="([^"]*)"/g)].map((m) => m[1]).filter((v) => !v.startsWith('#'))).toEqual(['about:srcdoc', 'http://localhost:3000/email-rook.png'].filter((v) => email.includes(v)))
      expect(email).not.toMatch(/<script|javascript:|data:text|target=|ping=|player\.one@example\.org/i)
      for (const anchor of email.match(/<a\s(?!name=)[^>]*>/g) ?? []) {
        const href = anchor.match(/\bhref="([^"]*)"/)?.[1]
        if (href !== undefined) expect(href, anchor).toMatch(/^#/)
        else expect(anchor, anchor).toContain('aria-disabled="true"')
      }
    }
  })
})

describe('the sheet\'s own region says when a letter was changed, in Louisiana\'s time', () => {
  const conflict = (at: string) => ({ kind: 'conflict', reason: 'changed', by: 'Player Two', at, readFailures: 0 }) as const
  const said = async (now: string, at: string) => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    const { SavedLineNotice } = await import('@/areas/admin/newsletter/NewsletterHead')
    const view = render(<SavedLineNotice line={{ kind: 'saving' }} />)
    view.rerender(<SavedLineNotice line={conflict(at)} />)
    const text = screen.getByRole('alert').textContent ?? ''
    cleanup()
    return text
  }

  it('names the day, with its weekday, for a refusal made the evening before in Louisiana, though it is the same day in UTC', async () => {
    // 3:05 AM on Friday, November 13 in UTC is 9:05 PM on Thursday, November 12 in Louisiana.
    expect(await said('2026-11-13T21:00:00Z', '2026-11-13 03:05:00')).toContain('Player Two changed this letter on Thursday, November 12, 2026 at 9:05 PM.')
    // Just after midnight in Louisiana, a refusal at 11:59 PM the evening before is not today's.
    expect(await said('2026-11-13T06:01:00Z', '2026-11-13 05:59:00')).toContain('on Thursday, November 12, 2026 at 11:59 PM.')
    expect(await said('2026-11-13T06:01:00Z', '2026-11-13 06:00:00')).toContain('changed this letter at 12:00 AM.')
  })

  it('reads the hour twice that clocks repeat, and the hour they skip, as a person in Louisiana would, never on a 24-hour clock', async () => {
    // Clocks went back at 2:00 AM on Sunday, November 1, 2026: 1:30 AM came twice.
    expect(await said('2026-11-03T20:00:00Z', '2026-11-01 06:30:00')).toContain('Sunday, November 1, 2026 at 1:30 AM.')
    expect(await said('2026-11-03T20:00:00Z', '2026-11-01 07:30:00')).toContain('Sunday, November 1, 2026 at 1:30 AM.')
    // Clocks went forward at 2:00 AM on Sunday, March 8, 2026: 8:30 AM UTC was 3:30 AM.
    expect(await said('2026-03-10T20:00:00Z', '2026-03-08 08:30:00')).toContain('on Sunday, March 8, 2026 at 3:30 AM.')
    expect(await said('2026-03-08T20:00:00Z', '2026-03-08 08:30:00')).toContain('changed this letter at 3:30 AM.')
    expect(await said('2026-11-13T21:00:00Z', '2026-11-13 20:17:00')).not.toMatch(/\b(1[3-9]|2[0-3]):\d\d\b/)
  })
})
