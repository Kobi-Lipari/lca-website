// @vitest-environment jsdom
//
// The newsletter's page on a tablet and a phone (WS16 part two, page step 4,
// second half): what the other test files of the page do not hold.
//
// - The email's sheet on its own: a named, modal dialog; the page behind it
//   kept from a press, from scrolling and from a screen reader; the frame it
//   draws closed, with the side preview's own copy of the email, whatever
//   links the letter holds, each link's tag carrying nothing but its style,
//   tabindex -1 and a jump link's address; the foot holding "Back to
//   writing" alone, so the room above it is free for a later step's Send;
//   the sheet clear until its first email has loaded; the keyboard's focus
//   going with the frame that comes on show; Escape; a press on the dim
//   moving no focus.
// - The sheet on the page: it says a refusal that comes while it hides the
//   page, follows the letter as it stands, and gives the focus to the side
//   preview's own control when "See the email" is no longer drawn.
// - What a narrow window is given: the side column and "See the email" each
//   drawn only on their side of 1024 pixels, and every control of the page,
//   in each state it has, with a floor of 44 pixels in height at a tablet's
//   and at a phone's width. The runtime has no stylesheet, so the floor is
//   read from the classes each control carries, with the variants that apply
//   at each width; the browser run measures the drawn size.
// - The Subject each side of 1024 pixels, the window's width given through a
//   stand-in for matchMedia, which jsdom lacks: the first half's field of one
//   line from 1024 up and a field of one row that wraps its words under it,
//   which says it takes one line; a paste that holds a line break, a tab or
//   any other character the server refuses made one line with none of them
//   left, on both, the words the browser's own insert is handed read through
//   a stand-in for it, and the same words where there is none; after the
//   insert, on the field of one line alone, the scroll it had put back before
//   the caret is brought into view, with no blur and no focus, and its
//   selection set again where it stands; a press on the label or the pencil;
//   and the focus and the caret kept as the window crosses the line.
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
  window.localStorage.setItem('lca-newsletter-page-help', 'shown') // Help has been seen once, so it does not open by itself here.
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
  delete (document as { execCommand?: unknown }).execCommand
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

  it('moves no focus on a press of any button on the dim, so a right press there leaves the focus in the sheet', () => {
    render(<Stand />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const dim = document.querySelector('[data-slot="email-sheet-scrim"]') as HTMLElement
    // The browser's own step on a press, the focus moved to what was pressed, is held back for every button; the dialog
    // still closes on a main press and a tap, and stays open on a right press, as it hears those itself.
    for (const button of [2, 0]) expect(fireEvent.mouseDown(dim, { button }), `button ${button}`).toBe(false)
    expect(focused()).toBe(sheetOf())
  })

  it('shows where the focus is while the email\'s frame holds it: the frames\' box carries the focus ring round it', () => {
    render(<Stand />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const box = framesIn(sheetOf())[0].parentElement as HTMLElement
    for (const look of ['focus-within:ring-3', 'focus-within:ring-focus']) expect(box.className.split(/\s+/), look).toContain(look)
  })

  it('gives each link in the frame its style, tabindex -1 and a jump link\'s address alone, so a ping or a target written on one never reaches it', () => {
    // A letter made by hand whose links carry what no stored letter can: the frame's copy keeps none of it.
    const body = [
      '<h2>Sample heading one</h2>',
      '<p><a href="https://example.org/sample" ping="https://example.org/ping" target="_blank" id="sample-one">Sample one</a>',
      ' <a href="#sample-heading-two" ping="https://example.org/ping" target="_blank" name="sample-name">Sample jump</a></p>',
      '<h2>Sample heading two</h2><p>Sample words two</p>',
    ].join('')
    render(<Stand body={body} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open the sheet' }))
    const email = framesIn(sheetOf()).map((frame) => frame.getAttribute('srcdoc') ?? '').find((doc) => doc.includes('Sample jump')) ?? ''
    const tagOf = (words: string) => new RegExp(`<a [^>]*>${words}</a>`).exec(email)?.[0]
    expect(email).not.toMatch(/\bping=|\btarget=|sample-one|sample-name/)
    // A jump link keeps its address and nothing else written on it; any other link, none.
    expect(tagOf('Sample jump')).toBe('<a tabindex="-1" href="#sample-heading-two">Sample jump</a>')
    expect(tagOf('Sample one')).toBe('<a tabindex="-1" role="link" aria-disabled="true">Sample one</a>')
    // The layout's own links are as they were, their style kept; and the anchor a jump link lands on, which is no link,
    // is as the layout wrote it.
    expect(tagOf('Sample heading two')).toMatch(/^<a tabindex="-1" href="#sample-heading-two" style="[^"]+">Sample heading two<\/a>$/)
    expect(email).toContain('<a tabindex="-1" role="link" aria-disabled="true" style="color:#1a2744;text-decoration:underline;">Unsubscribe from the LCA newsletter</a>')
    expect(email).toContain('<a name="sample-heading-two"></a>')
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

  it('says a test\'s answer that comes while it is open in a polite region of its own, once, out of reach of nothing it hides', async () => {
    windowAt(820)
    let answerTest: (answer: Response) => void = () => {}
    const plain = vi.mocked(fetch).getMockImplementation()!
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/admin/mail/newsletter/test') return new Promise<Response>((resolve) => { answerTest = resolve })
      return plain(url, init)
    }))
    await thePage()
    fireEvent.click(within(screen.getByRole('region', { name: 'Pick, check and send' })).getByRole('button', { name: '2 Send a test to me' }))
    await settle()
    fireEvent.click(screen.getAllByRole('button', { name: 'See the email' })[0])
    const sheet = sheetOf()
    const region = within(sheet).getByRole('status')
    // Nothing is said as it opens: what the bar said before is not said again.
    expect(region.textContent).toBe('')
    await act(async () => {
      answerTest(new Response(JSON.stringify({ sent: true, to: 'admin@example.org' }), { status: 200 }))
    })
    await settle()
    expect(region.textContent).toBe('Test sent to admin@example.org.')
    expect(region.getAttribute('aria-live') ?? 'polite').toBe('polite')
    expect(region.closest('[inert], [aria-hidden="true"], [hidden]')).toBeNull()
    // Said once in the sheet: the bar's own line is behind the sheet, out of a screen reader's reach while it is open.
    expect(within(sheet).getAllByText('Test sent to admin@example.org.')).toHaveLength(1)
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
    // At a tablet's width, where "See the email" is the head's; on a phone it is the bar's at the foot (page step 5).
    windowAt(820)
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

  it('holds the room kept below a focused control: 144 pixels on a phone and 96 elsewhere, the Subject among the controls kept', async () => {
    await thePage()
    const desk = document.querySelector('[data-slot="newsletter-page"]')!
    expect(desk.className).toContain('scroll-mb-24')
    expect(desk.className).toContain('max-md:[&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mb-36')
    expect(desk.className).toContain('[&_:is(a,button,input,textarea,[tabindex],[contenteditable])]:scroll-mt-24')
  })
})

/**
 * A stand-in for the browser's media query at a window's width: it answers each min-width query as a browser does,
 * and gives the mover, which sets a new width and tells the listeners, as a window turned or dragged wider does.
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

describe('the Subject\'s field, each side of 1024 pixels', () => {
  const subjectField = () => screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement | HTMLTextAreaElement
  const countOf = (field: Element) => document.getElementById(field.getAttribute('aria-describedby') ?? '') as HTMLElement
  /** A paste of plain words from the clipboard; gives false when the page took it from the browser. */
  const paste = (field: Element, words: string) => fireEvent.paste(field, { clipboardData: { getData: (type: string) => (type === 'text/plain' ? words : '') } })

  it('is the first half\'s own field of one line from 1024 pixels up, and a field of one row that wraps its words under it', async () => {
    const move = windowAt(1440)
    await thePage()
    for (const width of [1440, 1024, 1023, 820, 390]) {
      move(width)
      const field = subjectField()
      if (width >= 1024) {
        // As the first half drew it: its attributes, its classes and its style as they were.
        expect(field.tagName, `${width}`).toBe('INPUT')
        expect(field.getAttribute('type'), `${width}`).toBe('text')
        expect(field.className, `${width}`).toBe('min-w-0 flex-1 bg-transparent px-2.5 text-base text-ink outline-none')
      } else {
        expect(field.tagName, `${width}`).toBe('TEXTAREA')
        expect(field.getAttribute('rows'), `${width}`).toBe('1')
        // It is never drawn on a computer, so none of its classes is for one.
        expect(field.className, `${width}`).not.toMatch(/(?:^|\s)lg:/)
      }
      expect([field.getAttribute('spellcheck'), field.getAttribute('autocomplete'), field.style.outline], `${width}`).toEqual(['true', 'off', 'none'])
      // The page holds the words, so they are the same either side of the line, and so is the count they are told by.
      expect(field.value, `${width}`).toBe('LCA Newsletter · December 2026')
      expect(countOf(field).textContent, `${width}`).toBe('30 of 60 letters')
    }
  })

  it('tells a screen reader that the field that wraps takes one line of words, though it shows them on several', async () => {
    const move = windowAt(820)
    await thePage()
    expect(subjectField().getAttribute('aria-multiline')).toBe('false')
    move(1440)
    expect(subjectField().hasAttribute('aria-multiline')).toBe(false)
  })

  // This runtime has no insert of the browser's own (document.execCommand), so a paste taken here is put in the way
  // the page falls back on, its words set by script with the caret after them; the browser run proves the insert
  // itself, and that Undo takes the paste back in one step.
  it('takes a paste that holds a line break or a tab and puts in its words on one line, on both forms; a paste with neither is the browser\'s', async () => {
    const move = windowAt(1440)
    await thePage()
    for (const width of [1440, 390]) {
      move(width)
      const field = subjectField()
      act(() => field.focus())
      // A row copied from a spreadsheet, its cells parted by tabs and ended by a line end, pasted over the whole subject.
      field.setSelectionRange(0, field.value.length)
      expect(paste(field, 'Sample Open\tSat, Jan 9, 2027\tSample City\r\n'), `${width}`).toBe(false)
      expect(subjectField().value, `${width}`).toBe('Sample Open Sat, Jan 9, 2027 Sample City')
      expect(subjectField().selectionStart, `${width}`).toBe(40)
      // Lines pasted inside the words: a space between words, none beside the space already after the caret.
      subjectField().setSelectionRange(11, 11)
      expect(paste(subjectField(), '\nSample\n'), `${width}`).toBe(false)
      expect(subjectField().value, `${width}`).toBe('Sample Open Sample Sat, Jan 9, 2027 Sample City')
      expect([subjectField().selectionStart, subjectField().selectionEnd], `${width}`).toEqual([18, 18])
      // Words with neither are left to the browser: its own paste goes ahead, and the page does nothing to the words.
      expect(paste(subjectField(), 'Sample words'), `${width}`).toBe(true)
      expect(subjectField().value, `${width}`).toBe('Sample Open Sample Sat, Jan 9, 2027 Sample City')
      fireEvent.change(subjectField(), { target: { value: 'LCA Newsletter · December 2026' } })
    }
  })

  /** Pastes holding other characters the server refuses, each over the whole subject, and the words each one makes. */
  const REFUSED_PASTES = [
    // A cell with a direction mark and its line end, as some mail and contact apps copy a name.
    ['Sample Winter Open results\u{202C}\r\n', 'Sample Winter Open results'],
    // A line separator, as some apps copy a line break inside a paragraph, and a line end.
    ['Sample Winter\u{2028}Open results\r\n', 'Sample Winter Open results'],
    // A row copied from a spreadsheet with a direction mark at each end of one cell: a space between cells, no mark.
    ['Sample Open\t\u{202A}Sat, Jan 9, 2027\u{202C}\tSample City\r\n', 'Sample Open Sat, Jan 9, 2027 Sample City'],
  ] as const
  /** Pastes that leave nothing to put in with nothing chosen: a direction mark alone, a line break beside a space. */
  const NOTHING_LEFT = [['\u{202C}', 30], ['\n', 15]] as const

  it('hands the browser\'s own insert the words of a paste holding any character the server refuses, with none left in them, on both forms', async () => {
    const move = windowAt(1440)
    await thePage()
    // The browser's own insert, which this runtime lacks, stood in by one that answers it has put the words in, as
    // Chromium's does, and keeps what it was handed.
    const insert = vi.fn<typeof document.execCommand>(() => true)
    document.execCommand = insert
    for (const width of [1440, 390]) {
      move(width)
      const field = subjectField()
      act(() => field.focus())
      for (const [pasted, words] of REFUSED_PASTES) {
        insert.mockClear()
        field.setSelectionRange(0, field.value.length)
        expect(paste(field, pasted), `${width} ${JSON.stringify(pasted)}`).toBe(false)
        expect(insert.mock.calls, `${width} ${JSON.stringify(pasted)}`).toEqual([['insertText', false, words]])
      }
      // Nothing left to put in, with nothing chosen: the browser's own paste is stopped, its insert is asked for nothing,
      // and the field is as it was.
      for (const [pasted, at] of NOTHING_LEFT) {
        insert.mockClear()
        field.setSelectionRange(at, at)
        expect(paste(field, pasted), `${width} ${JSON.stringify(pasted)}`).toBe(false)
        expect(insert, `${width} ${JSON.stringify(pasted)}`).not.toHaveBeenCalled()
        expect([field.value, field.selectionStart, field.selectionEnd], `${width} ${JSON.stringify(pasted)}`).toEqual(['LCA Newsletter · December 2026', at, at])
      }
      // Nothing left to put in, over chosen words: the insert of nothing takes them away, as the browser's own paste would
      // once the mark was dropped, in a step its Undo takes back.
      insert.mockClear()
      field.setSelectionRange(17, 25)
      expect(paste(field, '\u{202C}'), `${width}`).toBe(false)
      expect(insert.mock.calls, `${width}`).toEqual([['insertText', false, '']])
    }
  })

  it('gives the same words where the browser has no such insert, set by script with the caret after them, and changes nothing when nothing is left to put in', async () => {
    const move = windowAt(1440)
    await thePage()
    const SUBJECT = 'LCA Newsletter · December 2026'
    for (const width of [1440, 390]) {
      move(width)
      act(() => subjectField().focus())
      for (const [pasted, words] of REFUSED_PASTES) {
        subjectField().setSelectionRange(0, subjectField().value.length)
        expect(paste(subjectField(), pasted), `${width} ${JSON.stringify(pasted)}`).toBe(false)
        expect(subjectField().value, `${width} ${JSON.stringify(pasted)}`).toBe(words)
        expect([subjectField().selectionStart, subjectField().selectionEnd], `${width} ${JSON.stringify(pasted)}`).toEqual([words.length, words.length])
        fireEvent.change(subjectField(), { target: { value: SUBJECT } })
      }
      for (const [pasted, at] of NOTHING_LEFT) {
        subjectField().setSelectionRange(at, at)
        expect(paste(subjectField(), pasted), `${width} ${JSON.stringify(pasted)}`).toBe(false)
        expect([subjectField().value, subjectField().selectionStart, subjectField().selectionEnd], `${width} ${JSON.stringify(pasted)}`).toEqual([SUBJECT, at, at])
      }
      subjectField().setSelectionRange(17, 25)
      expect(paste(subjectField(), '\u{202C}'), `${width}`).toBe(false)
      expect([subjectField().value, subjectField().selectionStart, subjectField().selectionEnd], `${width}`).toEqual(['LCA Newsletter ·  2026', 17, 17])
      fireEvent.change(subjectField(), { target: { value: SUBJECT } })
    }
  })

  // The field of one line is scrolled to the caret after the browser's own insert, as the browser's own paste leaves
  // it, by measuring the words before the caret; this runtime draws nothing to measure, so what is held here is that
  // the scroll costs the field no blur and no focus and throws nothing without a layout. The browser run proves the scroll.
  it('sends the field of one line no blur and no focus as it puts in a paste it takes over, and throws nothing where nothing is laid out', async () => {
    windowAt(1440)
    await thePage()
    document.execCommand = vi.fn<typeof document.execCommand>(() => true)
    const field = subjectField()
    expect(field.tagName).toBe('INPUT')
    act(() => field.focus())
    const sent: string[] = []
    for (const type of ['blur', 'focus', 'focusout', 'focusin']) field.addEventListener(type, () => sent.push(type))
    const thrown: unknown[] = []
    const onError = (event: ErrorEvent) => thrown.push(event.error)
    window.addEventListener('error', onError)
    try {
      // The caret left inside the words, where it is measured, and at their end, where the field goes to its most.
      for (const [start, end] of [[5, 5], [0, 30]] as const) {
        field.setSelectionRange(start, end)
        expect(paste(field, 'Sample\nwords'), `${start}`).toBe(false)
      }
    } finally {
      window.removeEventListener('error', onError)
    }
    expect(thrown).toEqual([])
    expect(sent).toEqual([])
    expect(document.activeElement).toBe(field)
    expect(countOf(field).hidden).toBe(false)
  })

  // Chromium's insert may itself scroll the field of one line (over chosen words it does), so the scroll the field had
  // before it is put back, and the caret is then brought into view from there, as the browser's own paste leaves it.
  // The stand-in for the insert moves the scroll as Chromium's may, and the field's scroll keeps each value it is given.
  // This runtime lays nothing out, so a width is stood in to bring the caret into view; the browser run proves the scroll.
  it('puts back the scroll the field of one line had before the browser\'s own insert, then brings the caret into view, and throws nothing where nothing is laid out', async () => {
    const move = windowAt(1440)
    await thePage()
    const scroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft')!
    const thrown: unknown[] = []
    const onError = (event: ErrorEvent) => thrown.push(event.error)
    window.addEventListener('error', onError)
    try {
      for (const width of [1440, 390]) {
        move(width)
        const field = subjectField()
        act(() => field.focus())
        const given: number[] = []
        Object.defineProperty(field, 'scrollLeft', {
          configurable: true,
          get: () => scroll.get!.call(field),
          set: (value: number) => {
            given.push(value)
            scroll.set!.call(field, value)
          },
        })
        document.execCommand = vi.fn<typeof document.execCommand>(() => {
          field.scrollLeft = 94
          return true
        })
        field.scrollLeft = 162
        // Nothing laid out: the field of one line has its scroll put back and nothing more is done; the field that wraps,
        // which has no sideways scroll, is left as the insert left it.
        given.length = 0
        field.setSelectionRange(30, 30)
        expect(paste(field, '\nSample results'), `${width}`).toBe(false)
        expect(given, `${width}`).toEqual(width >= 1024 ? [94, 162] : [94])
        if (width < 1024) continue
        // Laid out, a width stood in: the scroll put back first, then the caret brought into view from there, which at
        // the words' end is the field's most.
        Object.defineProperty(field, 'clientWidth', { configurable: true, value: 300 })
        Object.defineProperty(field, 'scrollWidth', { configurable: true, value: 585 })
        given.length = 0
        field.setSelectionRange(30, 30)
        expect(paste(field, '\nSample results'), `${width}`).toBe(false)
        expect(given, `${width}`).toEqual([94, 162, 585])
      }
    } finally {
      window.removeEventListener('error', onError)
    }
    expect(thrown).toEqual([])
  })

  // In Chromium the browser's own insert is typing to its Undo, so letters typed straight after it would join the
  // paste's step; the field of one line sets its selection again where it stands once the insert is done, which ends
  // that step. The stand-in for the insert leaves the selection as it was, so what is set again is the selection as it
  // stands, here words chosen from their end. The browser run proves the steps.
  it('sets the selection of the field of one line again where it stands, once, after the browser\'s own insert, and leaves the field that wraps as the insert left it', async () => {
    const move = windowAt(1440)
    await thePage()
    const insert = vi.fn<typeof document.execCommand>(() => true)
    document.execCommand = insert
    for (const width of [1440, 390]) {
      move(width)
      const field = subjectField()
      act(() => field.focus())
      field.setSelectionRange(17, 25, 'backward')
      insert.mockClear()
      const select = vi.spyOn(field, 'setSelectionRange')
      try {
        expect(paste(field, 'Sample\nJanuary'), `${width}`).toBe(false)
        expect(insert.mock.calls, `${width}`).toEqual([['insertText', false, 'Sample January']])
        if (width >= 1024) {
          expect(select.mock.calls, `${width}`).toEqual([[17, 25, 'backward']])
          expect(select.mock.invocationCallOrder[0], `${width}`).toBeGreaterThan(insert.mock.invocationCallOrder[0])
        } else {
          expect(select, `${width}`).not.toHaveBeenCalled()
        }
      } finally {
        select.mockRestore()
      }
    }
  })

  it('leaves the caret after the last word on a press on the label or on the pencil, on both forms', async () => {
    const move = windowAt(1440)
    await thePage()
    const elsewhere = screen.getByRole('button', { name: 'Make bigger' })
    for (const width of [1440, 820]) {
      move(width)
      const field = subjectField()
      expect(field.tagName, `${width}`).toBe(width >= 1024 ? 'INPUT' : 'TEXTAREA')
      const box = field.parentElement as HTMLElement
      for (const part of [box.querySelector('label'), box.querySelector('span[aria-hidden="true"]')]) {
        act(() => elsewhere.focus())
        field.setSelectionRange(0, 0)
        expect(fireEvent.mouseDown(part as Element), `${width} ${part?.tagName}`).toBe(false)
        expect(document.activeElement, `${width} ${part?.tagName}`).toBe(field)
        expect([field.selectionStart, field.selectionEnd], `${width} ${part?.tagName}`).toEqual([30, 30])
      }
    }
  })

  it('keeps the focus and the caret, or the chosen words, as the window crosses 1024 pixels, and takes no focus when the field had none', async () => {
    const move = windowAt(820)
    await thePage()
    // Focused, the caret inside a word: the field drawn in its place takes the focus, the caret where it was.
    act(() => subjectField().focus())
    subjectField().setSelectionRange(5, 5)
    move(1440)
    expect(subjectField().tagName).toBe('INPUT')
    expect(document.activeElement).toBe(subjectField())
    expect([subjectField().selectionStart, subjectField().selectionEnd]).toEqual([5, 5])
    expect(countOf(subjectField()).hidden).toBe(false)
    // Focused, words chosen from their end, and back under the line: the same words chosen the same way.
    subjectField().setSelectionRange(4, 14, 'backward')
    move(1023)
    expect(subjectField().tagName).toBe('TEXTAREA')
    expect(document.activeElement).toBe(subjectField())
    expect([subjectField().selectionStart, subjectField().selectionEnd, subjectField().selectionDirection]).toEqual([4, 14, 'backward'])
    expect(countOf(subjectField()).hidden).toBe(false)
    // Not focused: nothing takes the focus as the window crosses, either way.
    const elsewhere = screen.getByRole('button', { name: 'Make bigger' })
    act(() => elsewhere.focus())
    expect(countOf(subjectField()).hidden).toBe(true)
    move(1024)
    expect(subjectField().tagName).toBe('INPUT')
    expect(document.activeElement).toBe(elsewhere)
    move(390)
    expect(subjectField().tagName).toBe('TEXTAREA')
    expect(document.activeElement).toBe(elsewhere)
    expect(countOf(subjectField()).hidden).toBe(true)
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
