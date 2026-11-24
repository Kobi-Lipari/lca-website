// @vitest-environment jsdom
//
// Help on the newsletter's own page (WS16 part two, page step 5, third part),
// with src/App.tsx drawn whole at the address a person types, as the page's
// other files draw it. This file starts each case with nothing in the
// browser's storage, so Help may open by itself here.
//
// - The button: named "Help" at every width, a dialog's opener, drawn only
//   once the letter is on the page: not while the letter is read, nor when it
//   could not be, nor to a person without a second factor, nor with the
//   letter made bigger.
// - The six cards' titles, words and order at each width, and each form of
//   step 6: Send wired, Send quiet, and a phone with no test button, read
//   from the walkthrough drawn alone and walked with Next.
// - The card's buttons: Skip, Back from step 2, Next, Done on step 6; Skip,
//   Escape and a press on the dim close it.
// - Opening by itself once, as the letter is drawn, under the page's own key;
//   never while the letter is read or could not be; a browser that refuses
//   storage counts as shown.
// - A refusal or a sign-in that ends while it is open, said inside the card.
// - The first step's wiggle (and its ring with reduced motion): held while
//   Help is open or opening by itself, played once as it closes on a letter
//   that still holds no words, and stopped when Help opens over it.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every name, word and number
// here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { Editor } from '@tiptap/react'
import { MemoryRouter, useParams } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
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
vi.mock('@/pages/AdminPage', () => ({
  AdminPage: function AdminStandIn() {
    const { section } = useParams<{ section?: string }>()
    return <p>Admin stand-in {section ?? 'home'}</p>
  },
}))
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => 'Dashboard stand-in' }))
vi.mock('@/pages/WorkspacePage', () => ({ WorkspacePage: () => 'Workspace stand-in' }))
vi.mock('@/pages/AccountSecurityPage', () => ({ AccountSecurityPage: () => 'Account security stand-in' }))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')
const { HelpWalkthrough } = await import('@/areas/admin/newsletter/HelpWalkthrough')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const COUNT_URL = '/api/admin/mail/newsletter'
const ASK_URL = '/api/me/media-manager'
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p>'

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
let answers: Record<string, Answer | Promise<Answer>> = {}
const on = (method: string, url: string, answer: Answer | Promise<Answer>) => {
  answers[`${method} ${url}`] = answer
}

function letter(over: Record<string, unknown> = {}) {
  return {
    issue: { id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...over },
    state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
  }
}
const count = (willGet: number) => ({
  list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'Sample Sender <newsletter@example.org>', sendsThrough: 'resend',
  summary: { addresses: willGet + 4, turnedOff: 2, stoppedAll: 1, doNotSend: 1, willGet, recent: [], waits: null },
})

let seq = 0
function token(sub: string, aal: 'aal1' | 'aal2'): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, session_id: `session-sample-${sub}`, aal, role: 'authenticated' })}.sample-signature`
}
/** A signed-in person, each case's own: a role, the seats they hold, a second factor or none. */
function person(opts: { role?: MemberRole; seats?: string[]; aal?: 'aal1' | 'aal2' } = {}): AuthContextValue {
  const id = `member-sample-${++seq}`
  const role = opts.role ?? 'member'
  const access = token(id, opts.aal ?? 'aal2')
  const seats = (opts.seats ?? []).map((slug, i) => ({ id: `seat-sample-${seq}-${i}`, slug, role: slug === 'media-manager' ? 'Media manager' : 'Sample seat', category: 'officer' as const, started_at: '2026-11-02 15:00:00' }))
  return {
    user: { id, email: `${id}@example.org`, user_metadata: { role } },
    session: { access_token: access },
    member: { id, email: `${id}@example.org`, full_name: 'Player One', role, club_id: null, membership_status: 'active' },
    role, seats, managedClubs: [], isBoardMember: seats.length > 0,
    assuranceLevel: opts.aal ?? 'aal2', mfaRequired: false, refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [],
    loading: false, memberLoading: false, signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
  } as unknown as AuthContextValue
}

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 40)))

async function site(path: string, who: AuthContextValue, container?: HTMLElement) {
  await act(async () => {
    render(
      <AuthContext.Provider value={who}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
      container ? { container } : undefined,
    )
  })
  await settle()
}
/** The page once its code has come. */
const thePage = () => screen.findByRole('heading', { level: 1, name: 'Newsletter' }, { timeout: 10_000 })
/** The page once its letter is drawn. */
const theLetter = () => screen.findByRole('textbox', { name: 'The letter' }, { timeout: 10_000 })
const helpButton = () => screen.queryByRole('button', { name: 'Help' })

beforeEach(() => {
  flags.mailLists = true
  flags.mailPage = true
  answers = {}
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const answer = (await answers[`${method} ${url}`]) ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, { status: 200, body: count(155) })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Each card's title and lines, read from the walkthrough drawn alone and walked with Next, step 1 to step 6. */
function cards(width: 'desk' | 'tablet' | 'phone', sendReady: boolean) {
  render(<HelpWalkthrough width={width} sendReady={sendReady} onClose={() => {}} opener={() => null} />)
  const read = []
  for (let n = 1; n <= 6; n++) {
    const card = screen.getByRole('dialog', { name: `Help, step ${n} of 6` })
    const lines = [...card.querySelectorAll('h2 ~ p')].map((p) => p.textContent)
    read.push({ title: card.querySelector('h2')?.textContent, words: lines })
    if (n < 6) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  }
  cleanup()
  return read
}

describe('the six cards', () => {
  // K's words for the first card (Thu, Nov 19), the same at every width: no "we", and no word on where the control is,
  // since the card points at it. The third says how to use a letter's words again, and that a saved template is shared.
  const STEP1 = [
    'Start from a blank letter, a template or a past newsletter, then change the words.',
    'If the letter already has words, the page asks before replacing them and keeps them under Your last newsletters.',
    "To use a letter's words again, save it as a template. Everyone who writes the newsletter can start from it.",
  ]
  const MIDDLE = [
    { title: 'From', words: ['Who members see as the sender.'] },
    // Step 3 as the board draws it, word for word.
    { title: 'Subject', words: ['The line people see in their inbox. Click it to change it.'] },
    { title: 'The letter', words: ['Click anywhere on the letter and type. It saves by itself.', 'The "In this issue" list is made from your headings. It updates by itself.'] },
  ]

  it('on a computer: six in order, the side for step 5 and the bar\'s steps 2 and 3 for step 6, Send quiet', () => {
    expect(cards('desk', false)).toEqual([
      { title: 'Pick a template to start from', words: STEP1 },
      ...MIDDLE,
      { title: 'What members will get', words: ['The side shows what members will get. It changes as you type.'] },
      { title: 'Send a test to me', words: ['Send a test to yourself first.', 'Sending to members from this page is not available yet.'] },
    ])
  })

  it('on a tablet: "See the email" for step 5, the bar\'s steps for step 6', () => {
    const steps = cards('tablet', false)
    expect(steps.slice(0, 4)).toEqual([{ title: 'Pick a template to start from', words: STEP1 }, ...MIDDLE])
    expect(steps[4]).toEqual({ title: 'See the email', words: ['Shows what members will get. It changes as you type.'] })
    expect(steps[5].title).toBe('Send a test to me')
  })

  it('on a phone, with no test button: step 6 points at "See the email" and says only what is true there, Send wired or not', () => {
    for (const ready of [false, true]) {
      const steps = cards('phone', ready)
      expect(steps[4].title).toBe('See the email')
      expect(steps[5]).toEqual({ title: 'Send a test', words: ['Send yourself a test from a computer or a tablet.'] })
      // Steps 5 and 6 light the same button there, so each has its own title and Next is seen to move on.
      expect(new Set(steps.map((step) => step.title)).size).toBe(6)
    }
  })

  it('says "Then send." only once Send is wired, the board\'s sentence word for word', () => {
    for (const width of ['desk', 'tablet'] as const) {
      expect(cards(width, true)[5]).toEqual({ title: 'Send a test to me', words: ['Send a test to yourself first. Then send.'] })
      expect(cards(width, false)[5].words.join(' ')).not.toContain('Then send.')
    }
  })

  it('leaves the pin line out, and never names History, a place the page does not have', () => {
    const all = (['desk', 'tablet', 'phone'] as const).flatMap((w) => cards(w, false).flatMap((s) => s.words)).join(' ')
    expect(all).not.toMatch(/\b[Pp]in/)
    expect(all).not.toContain('History')
  })
})

describe('the card\'s buttons', () => {
  const walk = () => {
    const onClose = vi.fn()
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={onClose} opener={() => null} />)
    return onClose
  }
  const button = (name: string) => screen.queryByRole('button', { name })

  it('draws Skip and Next on step 1, no Back, and no separate Close', () => {
    walk()
    expect(button('Skip')).toBeTruthy()
    expect(button('Next')).toBeTruthy()
    expect(button('Back')).toBeNull()
    expect(button('Close')).toBeNull()
    expect(button('Skip')?.className.split(' ')).toContain('underline')
  })

  it('draws the board\'s buttons, each at least 44 pixels tall: Skip quiet, Back outlined, Next navy', () => {
    walk()
    fireEvent.click(button('Next') as HTMLButtonElement)
    const classes = (name: string) => (button(name) as HTMLButtonElement).className.split(' ')
    for (const name of ['Skip', 'Back', 'Next']) expect(classes(name)).toContain('min-h-11')
    expect(classes('Skip')).toEqual(expect.arrayContaining(['underline', 'text-muted-foreground']))
    expect(classes('Skip')).not.toContain('border')
    expect(classes('Back')).toEqual(expect.arrayContaining(['border', 'border-muted-foreground', 'bg-background']))
    expect(classes('Next')).toEqual(expect.arrayContaining(['bg-brand-navy', 'text-white']))
    const order = within(screen.getByRole('dialog')).getAllByRole('button').map((each) => each.textContent)
    expect(order).toEqual(['Skip', 'Back', 'Next'])
  })

  it('goes back a step with Back, and reads "Done" on step 6, which closes it', () => {
    const onClose = walk()
    fireEvent.click(button('Next') as HTMLButtonElement)
    fireEvent.click(button('Next') as HTMLButtonElement)
    expect(screen.getByRole('dialog', { name: 'Help, step 3 of 6' })).toBeTruthy()
    fireEvent.click(button('Back') as HTMLButtonElement)
    expect(screen.getByRole('dialog', { name: 'Help, step 2 of 6' })).toBeTruthy()
    for (let n = 2; n < 6; n++) fireEvent.click(button('Next') as HTMLButtonElement)
    expect(screen.getByRole('dialog', { name: 'Help, step 6 of 6' })).toBeTruthy()
    expect(button('Next')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(button('Done') as HTMLButtonElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Skip, on Escape and on a press on the dim, at any step', () => {
    const onClose = walk()
    fireEvent.click(button('Next') as HTMLButtonElement)
    fireEvent.click(button('Skip') as HTMLButtonElement)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Help, step 2 of 6' }), { key: 'Escape' })
    fireEvent.click(document.querySelector('[data-slot="help-dim"]') as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('closes on the page, by Skip, and Help says it is shut', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    fireEvent.click(button('Skip') as HTMLButtonElement)
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    expect(helpButton()?.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('the lit target', () => {
  const dim = () => document.querySelector('[data-slot="help-dim"]') as HTMLElement
  const ring = () => document.querySelector('[data-slot="help-ring"]') as HTMLElement | null
  const place = (element: Element, top: number, left: number, width: number, height: number) => {
    element.getBoundingClientRect = () => ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) })
  }
  // A window 900 tall, so the parts these cases place are all in view; the lit box is held to what the window shows.
  const tall = (height: number) => Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
  const jsdomHeight = window.innerHeight
  beforeEach(() => tall(900))
  afterEach(() => tall(jsdomHeight))

  it('lights nothing when nothing is there, and the card still reads', () => {
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
    expect(screen.getByRole('dialog', { name: 'Help, step 1 of 6' }).querySelector('h2')?.textContent).toBe('Pick a template to start from')
    expect(ring()).toBeNull()
    expect(dim().style.clipPath).toBe('')
    expect(dim().className.split(' ')).toContain('bg-brand-navy/55')
  })

  it('on the page: each step\'s part brought into view first, then cut out of the dim and ringed, 4 pixels of white and 4 of gold', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    const seen: string[] = []
    const into = vi.fn(function (this: HTMLElement) {
      seen.push(`into ${this.dataset.slot ?? this.tagName}`)
    })
    HTMLElement.prototype.scrollIntoView = into
    try {
      await site('/admin/newsletter', person({ role: 'lca_admin' }))
      await theLetter()
      const row = screen.getByRole('group', { name: 'Who it is from and its subject' })
      const bar = screen.getByRole('region', { name: 'Pick, check and send' })
      const parts = {
        pick: [...bar.querySelectorAll('[data-slot="pick-step"]')][0],
        from: row.firstElementChild as Element,
        subject: screen.getByText('Subject', { selector: 'label' }).parentElement as Element,
        letter: document.querySelector('[data-slot="letter-sheet"]') as Element,
      }
      place(parts.pick, 800, 24, 300, 50)
      place(parts.from, 120, 40, 260, 52)
      place(parts.subject, 120, 320, 600, 52)
      place(parts.letter, 200, 40, 880, 500)
      fireEvent.click(helpButton() as HTMLButtonElement)
      await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
      const lit = []
      for (let n = 1; n <= 4; n++) {
        const r = ring() as HTMLElement
        lit.push({ target: dim().dataset.lit, top: r.style.top, left: r.style.left, width: r.style.width, height: r.style.height })
        if (n < 4) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      }
      expect(lit).toEqual([
        { target: 'pick', top: '792px', left: '16px', width: '316px', height: '66px' },
        { target: 'from', top: '112px', left: '32px', width: '276px', height: '68px' },
        { target: 'subject', top: '112px', left: '312px', width: '616px', height: '68px' },
        { target: 'letter', top: '192px', left: '32px', width: '896px', height: '516px' },
      ])
      // The cut is the ring's box, so the ring stands in it and the dim is over the rest.
      expect(dim().style.clipPath).toBe('polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, 32px 192px, 32px 708px, 928px 708px, 928px 192px, 32px 192px)')
      expect(into).toHaveBeenCalledTimes(4)
      const r = ring() as HTMLElement
      expect(r.getAttribute('aria-hidden')).toBe('true')
      // In forced colours the target is still marked, in the system's highlight.
      expect(r.className.split(' ')).toEqual(expect.arrayContaining(['border-4', 'border-gold', 'pointer-events-none', 'forced-colors:border-[Highlight]']))
      expect((r.firstElementChild as HTMLElement).className.split(' ')).toEqual(expect.arrayContaining(['border-4', 'border-background']))
      // With no media query (jsdom has none) the page is drawn in its phone form: steps 5 and 6 both light "See the email".
      // The page is hidden from a screen reader while Help is open, so the buttons are found by their words.
      for (const see of [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'See the email')) place(see, 800, 600, 180, 50)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      const five = dim().dataset.lit
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect([five, dim().dataset.lit]).toEqual(['see', 'see'])
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })

  it('on a computer: step 5 lights the side, and step 6 the bar\'s steps 2 and 3 in one box', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    // A stand-in for the browser's media query at 1440 pixels, as the bar's and the sheet's test files give it.
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const line = /^\(min-width: (\d+)px\)$/.exec(query)
        return line !== null && 1440 >= Number(line[1])
      },
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const bar = screen.getByRole('region', { name: 'Pick, check and send' })
    place(document.querySelector('[data-slot="side-preview"]') as Element, 100, 1000, 400, 700)
    place(bar.querySelector('button[aria-labelledby$="-2-words"]')?.parentElement as Element, 820, 500, 200, 50)
    place(bar.querySelector('button[aria-labelledby$="-3-words"]')?.parentElement as Element, 820, 760, 120, 50)
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    for (let n = 1; n < 5; n++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const five = { target: dim().dataset.lit, top: ring()?.style.top, height: ring()?.style.height }
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const six = { target: dim().dataset.lit, left: ring()?.style.left, width: ring()?.style.width }
    expect([five, six]).toEqual([
      { target: 'side', top: '92px', height: '716px' },
      // From step 2's left (500) to step 3's right (880), and the ring's 8 pixels each side.
      { target: 'send', left: '492px', width: '396px' },
    ])
  })

  it('moves the ring with its target when the row it stands in settles after opening, with no resize or scroll', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    // A stand-in for the browser's ResizeObserver, which jsdom does not have: each one's callback kept, to be called.
    const told: (() => void)[] = []
    const watched: Element[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          told.push(callback)
        }
        observe(element: Element) {
          watched.push(element)
        }
        disconnect() {}
      },
    )
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const bar = screen.getByRole('region', { name: 'Pick, check and send' })
    const step = [...bar.querySelectorAll('[data-slot="pick-step"]')][0]
    place(step, 820, 144, 239, 50)
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    expect(ring()?.style.left).toBe('136px')
    // The step and its row are watched; as the row settles the step moves 13 pixels along it, and the ring goes with it,
    // as a real browser drew it on a tablet 820 pixels wide (its "1" mark at the step's left edge, 131).
    expect(watched).toContain(step)
    place(step, 820, 131, 239, 50)
    act(() => told.forEach((callback) => callback()))
    expect(ring()?.style.left).toBe('123px')
  })

  it('holds the lit cut and its ring between the header and the bar at the foot, so the bar is never lit as part of the letter', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    tall(768)
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const bar = screen.getByRole('region', { name: 'Pick, check and send' })
    // A 1024 by 768 window with the bar's top at 692, the letter running on under it, and the subject partly under the header.
    place(document.querySelector('[data-slot="foot-bar"]') as Element, 692, 0, 1024, 76)
    place([...bar.querySelectorAll('[data-slot="pick-step"]')][0], 704, 24, 300, 50)
    place(screen.getByText('Subject', { selector: 'label' }).parentElement as Element, 40, 320, 600, 52)
    place(document.querySelector('[data-slot="letter-sheet"]') as Element, 396, 40, 880, 504)
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    const seen = []
    for (let n = 1; n <= 4; n++) {
      const r = ring()
      seen.push({ target: dim().dataset.lit, top: r?.style.top, height: r?.style.height })
      if (n < 4) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    }
    expect(seen).toEqual([
      // The bar's own step is held to the window's foot, not the bar's top: 704 to 754, ringed 696 to 762.
      { target: 'pick', top: '696px', height: '66px' },
      // From is not placed, so nothing is lit for it.
      { target: undefined, top: undefined, height: undefined },
      // The header's foot is 64 (4rem): the subject's box is held to 72, its ring to 64 to 100.
      { target: 'subject', top: '64px', height: '36px' },
      // The letter is held to 8 above the bar: 396 to 684, ringed 388 to 692, ending at the bar's top.
      { target: 'letter', top: '388px', height: '304px' },
    ])
    expect(dim().style.clipPath).toContain('32px 388px, 32px 692px, 928px 692px')
    // A part wholly under the bar lights nothing, and the card still reads.
    place(document.querySelector('[data-slot="letter-sheet"]') as Element, 700, 40, 880, 60)
    fireEvent(window, new Event('resize'))
    expect(ring()).toBeNull()
    expect(dim().dataset.lit).toBeUndefined()
    expect(screen.getByRole('dialog', { name: 'Help, step 4 of 6' }).querySelector('h2')?.textContent).toBe('The letter')
  })
})

describe('where the card stands', () => {
  const rect = (top: number, left: number, width: number, height: number) => () =>
    ({ top, left, width, height, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) }) as DOMRect
  /** A bar at the foot with its first step, standing where it is told, and a card of the size it is told. */
  function stand(step: DOMRect, barTop: number, card: { width: number; height: number }) {
    const bar = document.createElement('div')
    bar.dataset.slot = 'foot-bar'
    bar.getBoundingClientRect = rect(barTop, 0, 1024, 90)
    const pick = document.createElement('div')
    pick.dataset.slot = 'pick-step'
    pick.getBoundingClientRect = () => step
    bar.append(pick)
    document.body.append(bar)
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(card.width)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(card.height)
    return () => {
      bar.remove()
      vi.restoreAllMocks()
    }
  }
  const theCard = () => document.querySelector('[data-slot="help-card"]') as HTMLElement
  const where = () => ({ side: theCard().dataset.side, top: theCard().style.top, left: theCard().style.left, maxHeight: theCard().style.maxHeight })

  it('stands above its target when there is no room under it, clear of the bar at the foot, in rem', () => {
    const done = stand(rect(600, 24, 300, 50)(), 700, { width: 352, height: 200 })
    try {
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      // The room: from three quarters of a rem under the header (4rem when the page has not set it) to as far over the bar.
      expect(where()).toEqual({ side: 'above', top: '380px', left: '24px', maxHeight: '612px' })
      expect(theCard().className.split(' ')).toEqual(expect.arrayContaining(['w-[min(22rem,calc(100vw-2rem))]', 'forced-colors:border-[CanvasText]']))
      // Its words scroll inside it, and the pointer at its edge, toward the target under it, is not cut off.
      expect(theCard().querySelector('[data-slot="help-inside"]')?.className.split(' ')).toContain('overflow-y-auto')
      // Its buttons stand in a row under the words that does not scroll, so on a short window they are always in view.
      const row = theCard().querySelector('[data-slot="help-buttons"]') as HTMLElement
      expect(row.parentElement).toBe(theCard())
      expect(row.className.split(' ')).toContain('flex-none')
      expect(theCard().querySelector('[data-slot="help-inside"]')?.contains(row)).toBe(false)
      expect([...row.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Skip', 'Next'])
      // Forced colours draw no ring, so the focus is an outline there.
      for (const b of row.querySelectorAll('button')) {
        expect(b.className.split(' ')).toEqual(
          expect.arrayContaining(['forced-colors:focus-visible:outline-solid', 'forced-colors:focus-visible:outline-2', 'forced-colors:focus-visible:outline-offset-2']),
        )
      }
      const pointer = theCard().querySelector('[data-slot="help-pointer"]') as HTMLElement
      expect(pointer.getAttribute('aria-hidden')).toBe('true')
      expect(pointer.parentElement).toBe(theCard())
      expect(pointer.className.split(' ')).toEqual(expect.arrayContaining(['group-data-[side=above]/help:-bottom-1.5', 'group-data-[side=middle]/help:hidden']))
    } finally {
      done()
    }
  })

  it('on a short window stands beside its target, held to the room left, and scrolls inside itself', () => {
    const done = stand(rect(100, 24, 300, 50)(), 300, { width: 352, height: 400 })
    try {
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      expect(where()).toEqual({ side: 'right', top: '76px', left: '344px', maxHeight: '212px' })
    } finally {
      done()
    }
  })

  it('on a 450 pixel tall window with no side to spare, stands in the larger room and never over its ring', () => {
    // 1440 by 900 at 200 per cent: a 720 by 450 window, the target as wide as the page, its ring 204 to 272.
    const size = { width: window.innerWidth, height: window.innerHeight }
    const set = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
    }
    set(720, 450)
    const done = stand(rect(212, 16, 688, 52)(), 379, { width: 352, height: 157 })
    try {
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      // Above it there are 116 pixels to the header's foot, under it 83 to the bar: the card stands above, held to 116.
      expect(where()).toEqual({ side: 'above', top: '76px', left: '16px', maxHeight: '116px' })
      const ring = document.querySelector('[data-slot="help-ring"]') as HTMLElement
      const cardFoot = Number.parseFloat(theCard().style.top) + Number.parseFloat(theCard().style.maxHeight)
      expect(cardFoot).toBeLessThanOrEqual(Number.parseFloat(ring.style.top))
      expect(ring.style.top).toBe('204px')
    } finally {
      done()
      set(size.width, size.height)
    }
  })

  it('on a 450 pixel tall window scrolls a part of the page to stand just over the bar or just under the header, whichever leaves the card more room, and the card stands whole', () => {
    // Step 2, From, at 720 by 450: its box 212 to 264, the bar's top at 379; no side holds a card 157 tall.
    const size = { width: window.innerWidth, height: window.innerHeight }
    const set = (width: number, height: number) => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
    }
    set(720, 450)
    const done = stand(rect(700, 24, 300, 50)(), 379, { width: 352, height: 157 })
    const row = document.createElement('div')
    row.setAttribute('role', 'group')
    row.setAttribute('aria-label', 'Who it is from and its subject')
    const from = document.createElement('div')
    const box = { current: rect(212, 16, 688, 52)() }
    from.getBoundingClientRect = () => box.current
    row.append(from)
    document.body.append(row)
    // The window's scroll, moving From by as much, except where the page is told it cannot scroll that way.
    const scrolled: number[] = []
    const can = { scroll: (by: number) => by !== 0 }
    vi.stubGlobal('scrollBy', (to: ScrollToOptions) => {
      const by = to.top ?? 0
      scrolled.push(by)
      if (can.scroll(by)) box.current = rect(box.current.top - by, 16, 688, 52)()
    })
    try {
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      // Step 1 is in the bar, which does not scroll: the page is left where it is.
      expect(scrolled).toEqual([])
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      // Over it 116 pixels, under it 83: the larger room is over it, so the page is scrolled back 107, From's box then
      // ending 8 above the bar (371), its ring at the bar's top.
      expect(scrolled).toEqual([-107])
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      // The card then stands over it whole, its 157 pixels in the 223 from the header's foot: 319 - 8 - 12 - 157 = 142.
      // Measured again, it is where it should be, and the page is not scrolled again.
      expect(where()).toEqual({ side: 'above', top: '142px', left: '16px', maxHeight: '291px' })
      expect(scrolled).toEqual([-107])
      // Higher on the page, 120 to 172, with a card 200 tall: the larger room is under it, so the page is scrolled on 48,
      // From's box then starting 8 under the header's foot (72), and the card stands under it whole, from 144.
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200)
      box.current = rect(120, 16, 688, 52)()
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(scrolled).toEqual([-107, 48])
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(where()).toEqual({ side: 'below', top: '144px', left: '16px', maxHeight: '291px' })
      expect(scrolled).toEqual([-107, 48])
      // At the page's top, where it cannot scroll back: From at 212 again, the larger room over it, but the page is then
      // scrolled on 140 instead, so From stands under the header and the card under it whole.
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(157)
      can.scroll = (by) => by > 0
      box.current = rect(212, 16, 688, 52)()
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(scrolled).toEqual([-107, 48, -107, 140])
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(where()).toEqual({ side: 'below', top: '144px', left: '16px', maxHeight: '291px' })
      expect(scrolled).toEqual([-107, 48, -107, 140])
      // A card too tall for either room, with the page free to scroll both ways: From stays under the header, and the
      // page is not scrolled back toward the bar, where the room over it would be the larger.
      vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300)
      can.scroll = (by) => by !== 0
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(scrolled).toEqual([-107, 48, -107, 140])
    } finally {
      row.remove()
      done()
      set(size.width, size.height)
    }
  })

  it('where its words still scroll, they are a named stop in the Tab order with their focus drawn, also in forced colours', () => {
    const done = stand(rect(100, 24, 300, 50)(), 300, { width: 352, height: 400 })
    try {
      const view = render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      const inside = () => theCard().querySelector('[data-slot="help-inside"]') as HTMLElement
      // jsdom lays nothing out, so here the words fit: no empty stop.
      expect(inside().hasAttribute('tabindex')).toBe(false)
      expect(screen.getByRole('group', { name: 'Pick a template to start from' })).toBe(inside())
      expect(inside().className.split(' ')).toEqual(
        expect.arrayContaining(['focus-visible:ring-3', 'focus-visible:ring-inset', 'forced-colors:focus-visible:outline-solid', 'forced-colors:focus-visible:-outline-offset-2']),
      )
      // Words taller than the room they are held to: a Tab stop, before the buttons.
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(120)
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      expect(inside().tabIndex).toBe(0)
      expect(screen.getByRole('group', { name: 'From' })).toBe(inside())
      expect(inside().compareDocumentPosition(screen.getByRole('button', { name: 'Skip' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // Scrolling the words, by the arrow keys or otherwise, does not place the card again: placing it lets its height
      // go for a moment, which in a browser puts the words back at their top, so the arrow keys could not move them.
      // Back on step 1, whose target is on the page here.
      fireEvent.click(screen.getByRole('button', { name: 'Back' }))
      expect(inside().tabIndex).toBe(0)
      const placed = theCard().style.top
      theCard().style.setProperty('top', '1px')
      act(() => {
        inside().dispatchEvent(new Event('scroll'))
      })
      expect(theCard().style.top).toBe('1px')
      // The page's own scroll still places it again.
      act(() => {
        window.dispatchEvent(new Event('scroll'))
      })
      expect(theCard().style.top).toBe(placed)
      view.unmount()
    } finally {
      done()
    }
  })

  it('where the room between the header and the bar cannot show a title line, stands over the header above a part in the bar, else over the bar', () => {
    // A phone held sideways with large text: the header's foot at 64, the bar's top at 170, so 82 pixels of room between
    // them, less than the buttons' row and a title line (104).
    const height = window.innerHeight
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 390 })
    const done = stand(rect(180, 24, 300, 50)(), 170, { width: 352, height: 120 })
    try {
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      // Step 1 is in the bar: the card stands above it, its top three quarters of a rem under the window's top, its
      // foot clear of the ring (172).
      expect(where()).toEqual({ side: 'above', top: '40px', left: '24px', maxHeight: '146px' })
      fireEvent.click(screen.getByRole('button', { name: 'Next' }))
      // Step 2's target is not on this page, so the card stands in the middle of the room from the header's foot down to
      // three quarters of a rem over the window's foot, over the dimmed bar.
      expect(where()).toEqual({ side: 'middle', top: '167px', left: '336px', maxHeight: '302px' })
    } finally {
      done()
      Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: height })
    }
  })

  it('is placed again as the window changes', () => {
    const step = { current: rect(100, 24, 300, 50)() }
    const done = stand(step.current, 700, { width: 352, height: 200 })
    try {
      const pick = document.querySelector('[data-slot="pick-step"]') as HTMLElement
      pick.getBoundingClientRect = () => step.current
      render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
      expect(where().side).toBe('below')
      step.current = rect(600, 24, 300, 50)()
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      expect(where()).toEqual({ side: 'above', top: '380px', left: '24px', maxHeight: '612px' })
    } finally {
      done()
    }
  })

  it('keeps its step and the focus inside as the window crosses 1024 and 768 pixels, the card then pointing at what is there', () => {
    const view = render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
    for (let n = 1; n < 5; n++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    const next = screen.getByRole('button', { name: 'Next' })
    next.focus()
    expect(screen.getByRole('dialog', { name: 'Help, step 5 of 6' }).querySelector('h2')?.textContent).toBe('What members will get')
    view.rerender(<HelpWalkthrough width="tablet" sendReady={false} onClose={() => {}} opener={() => null} />)
    expect(screen.getByRole('dialog', { name: 'Help, step 5 of 6' }).querySelector('h2')?.textContent).toBe('See the email')
    expect(document.activeElement).toBe(next)
    // Step 6 on a tablet points at the bar's test step; across 768 pixels, at "See the email", with the focus kept on Done.
    fireEvent.click(next)
    const done = screen.getByRole('button', { name: 'Done' })
    done.focus()
    expect(screen.getByRole('dialog', { name: 'Help, step 6 of 6' }).querySelector('h2')?.textContent).toBe('Send a test to me')
    view.rerender(<HelpWalkthrough width="phone" sendReady={false} onClose={() => {}} opener={() => null} />)
    expect(screen.getByRole('dialog', { name: 'Help, step 6 of 6' }).querySelector('h2')?.textContent).toBe('Send a test')
    expect(document.activeElement).toBe(done)
  })
})

describe('where the focus goes', () => {
  const focused = () => document.activeElement
  const button = (name: string) => screen.getByRole('button', { name })
  const said = () => (document.querySelector('[data-slot="help-card"] [aria-live="polite"]') as HTMLElement).textContent

  it('goes to the card itself on opening, and nothing is said in the live region until a step changes', () => {
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
    expect(focused()).toBe(screen.getByRole('dialog', { name: 'Help, step 1 of 6' }))
    expect(said()).toBe('')
  })

  it('stays on the button pressed on each step, moves to Next when Back goes, and says the new step\'s words once', () => {
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
    act(() => button('Next').focus())
    fireEvent.click(button('Next'))
    expect(focused()).toBe(button('Next'))
    expect(said()).toBe('Step 2 of 6. From. Who members see as the sender.')
    fireEvent.click(button('Next'))
    act(() => button('Back').focus())
    fireEvent.click(button('Back'))
    expect(focused()).toBe(button('Back'))
    expect(said()).toBe('Step 2 of 6. From. Who members see as the sender.')
    fireEvent.click(button('Back'))
    expect(screen.getByRole('dialog', { name: 'Help, step 1 of 6' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull()
    expect(focused()).toBe(button('Next'))
    expect(said()).toMatch(/^Step 1 of 6\. Pick a template to start from\. Start from a blank letter, a template or a past newsletter,/)
  })

  it('keeps the page out of reach while open, the site\'s root inert and hidden from a screen reader, let go before the focus comes back to Help', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    const root = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'root' }))
    try {
      await site('/admin/newsletter', person({ role: 'lca_admin' }), root)
      await theLetter()
      const help = helpButton() as HTMLButtonElement
      const inertAsFocused: boolean[] = []
      help.addEventListener('focus', () => inertAsFocused.push(root.hasAttribute('inert')))
      fireEvent.click(help)
      const card = await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
      expect(root.contains(card)).toBe(false)
      expect(root.hasAttribute('inert')).toBe(true)
      expect(root.getAttribute('aria-hidden')).toBe('true')
      expect(focused()).toBe(card)
      fireEvent.keyDown(card, { key: 'Escape' })
      await settle()
      expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
      expect(root.hasAttribute('inert')).toBe(false)
      expect(root.hasAttribute('aria-hidden')).toBe(false)
      expect(focused()).toBe(help)
      expect(inertAsFocused.at(-1)).toBe(false)
    } finally {
      cleanup()
      root.remove()
    }
  })

  it('comes back to Help on closing by Skip, by Done and by the dim', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const help = helpButton() as HTMLButtonElement
    const ways = [
      () => fireEvent.click(button('Skip')),
      () => {
        for (let n = 1; n < 6; n++) fireEvent.click(button('Next'))
        fireEvent.click(button('Done'))
      },
      () => fireEvent.click(document.querySelector('[data-slot="help-dim"]') as HTMLElement),
    ]
    for (const close of ways) {
      fireEvent.click(help)
      await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
      close()
      await settle()
      expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
      expect(focused()).toBe(help)
    }
  })
})

describe('the Help button', () => {
  it('is a button named Help, a dialog\'s opener, in the Tab order, drawn once the letter is on the page', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const help = helpButton() as HTMLButtonElement
    expect(help).toBeTruthy()
    expect(help.disabled).toBe(false)
    expect(help.tabIndex).toBe(0)
    expect(help.getAttribute('aria-haspopup')).toBe('dialog')
    expect(help.getAttribute('aria-expanded')).toBe('false')
    // Its name is "Help" at every width: under 1024 pixels the word is kept for a screen reader beside the mark alone.
    expect(help.textContent).toBe('Help')
    expect(help.querySelector('span:not([aria-hidden])')?.className.split(' ')).toContain('max-lg:sr-only')
    // At least 44 by 44 under 1024 pixels, white with an edge there; the soft tint a layer drawn from 1024 up only.
    expect(help.className.split(' ')).toEqual(expect.arrayContaining(['min-h-11', 'max-lg:w-11', 'max-lg:border', 'max-lg:bg-background']))
    expect(help.className).not.toContain('bg-ink/8')
    expect(help.querySelector('span[aria-hidden="true"]')?.className.split(' ')).toEqual(expect.arrayContaining(['bg-ink/8', 'max-lg:hidden']))
  })

  it('opens the walkthrough at step 1 when pressed, and says it is open', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    fireEvent.click(helpButton() as HTMLButtonElement)
    const card = await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    expect(card.querySelector('p')?.textContent).toBe('1 of 6')
    expect(card.querySelector('h2')?.textContent).toBe('Pick a template to start from')
    expect(card.textContent).toContain('Start from a blank letter, a template or a past newsletter, then change the words.')
    // The page behind the card is hidden from a screen reader while it is open, Help with it.
    expect(screen.getByRole('button', { name: 'Help', hidden: true }).getAttribute('aria-expanded')).toBe('true')
  })

  it('is not drawn while the letter is read', async () => {
    on('GET', ISSUE_URL, new Promise<Answer>(() => {}))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    expect(screen.getByText('Loading the letter...')).toBeTruthy()
    expect(helpButton()).toBeNull()
  })

  it('is not drawn when the letter could not be read', async () => {
    on('GET', ISSUE_URL, { status: 500, body: { error: 'Something went wrong' } })
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    expect(await screen.findByText(/The letter could not be read\./)).toBeTruthy()
    expect(helpButton()).toBeNull()
  })

  it('is not drawn to a person who has yet to set up a second factor', async () => {
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: false } })
    await site('/admin/newsletter', person({ seats: ['media-manager'], aal: 'aal1' }))
    await thePage()
    expect(await screen.findByRole('link', { name: SECOND_FACTOR_LINE })).toBeTruthy()
    expect(helpButton()).toBeNull()
  })

  it('is not drawn with the letter made bigger, and is back as it is made smaller', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    await settle()
    expect(helpButton()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Make smaller' }))
    await settle()
    expect(helpButton()).toBeTruthy()
  })
})

describe('opening by itself', () => {
  const KEY = 'lca-newsletter-page-help'

  it('opens by itself once the letter is drawn, writes the page\'s own key as it does, and then opens from its button alone', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    // It opens as the letter is drawn, so the letter is then behind it, out of a screen reader's reach.
    const card = await screen.findByRole('dialog', { name: 'Help, step 1 of 6' }, { timeout: 10_000 })
    expect(screen.getByRole('textbox', { name: 'The letter', hidden: true })).toBeTruthy()
    expect(window.localStorage.getItem(KEY)).toBe('shown')
    // The Group email tab's own key is left alone.
    expect(window.localStorage.getItem('lca-newsletter-help')).toBeNull()
    // However it was opened, the focus comes back to Help as it closes.
    expect(document.activeElement).toBe(card)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(document.activeElement).toBe(helpButton())
    cleanup()
    // The page again in the same browser: shut until Help is pressed.
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    await settle()
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    fireEvent.click(helpButton() as HTMLButtonElement)
    expect(await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })).toBeTruthy()
  }, 20_000)

  it('does not open, nor write its key, while the letter is read or when it could not be', async () => {
    on('GET', ISSUE_URL, new Promise<Answer>(() => {}))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    await settle()
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
    cleanup()
    on('GET', ISSUE_URL, { status: 500, body: { error: 'Sample failure' } })
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    await settle()
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  it('counts a browser that refuses storage as already shown, and still opens from its button', async () => {
    const refuse = () => {
      throw new DOMException('Sample refusal', 'SecurityError')
    }
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)
    try {
      await site('/admin/newsletter', person({ role: 'lca_admin' }))
      await theLetter()
      await settle()
      expect(read).toHaveBeenCalledWith(KEY)
      expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
      fireEvent.click(helpButton() as HTMLButtonElement)
      expect(await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })).toBeTruthy()
    } finally {
      read.mockRestore()
      write.mockRestore()
    }
  })
})

describe('what comes while it is open', () => {
  const editorOf = () => (document.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor
  const notice = () => screen.getByRole('dialog', { name: /^Help, step/ }).querySelector('[data-slot="help-notice"] [role="alert"]') as HTMLElement
  const waitForTheSave = () => act(async () => new Promise((resolve) => setTimeout(resolve, 2300)))

  async function openWithASaveWaiting() {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    // Help is opened while the save waits for its pause; its answer comes while the card hides the page.
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    expect(notice().textContent).toBe('')
  }

  it('says inside the card a sign-in that ends while it is open, and the saved line says it again when the page is back', async () => {
    on('PUT', ISSUE_URL, { status: 401, body: { error: 'Sample sign-in words' } })
    await openWithASaveWaiting()
    await waitForTheSave()
    const lost = 'Your sign-in has ended, so this is not saved. Copy your words, then sign in again.'
    expect(notice().textContent).toBe(lost)
    // Said once while the page is hidden: the saved line behind the card is out of a screen reader's reach.
    expect(document.querySelector('[data-slot="saved-line"]')?.closest('[aria-hidden="true"]')).not.toBeNull()
    // It stays said as the steps change.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(notice().textContent).toBe(lost)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await settle()
    expect(within(document.querySelector('[data-slot="saved-line"]') as HTMLElement).getByRole('alert').textContent).toBe(lost)
  })

  it('says inside the card a refusal that comes while it is open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T21:00:00Z'))
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    await openWithASaveWaiting()
    await waitForTheSave()
    expect(notice().textContent).toBe('Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.')
  })
})

describe('the wiggle while Help is open', () => {
  type Played = { on: HTMLElement; frames: Keyframe[]; cancel: ReturnType<typeof vi.fn> }
  let played: Played[] = []
  const emptyLetter = () => letter({ bodyHtml: '' })
  const editorOf = () => (document.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor
  const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
  /** Long enough for the frame the cue waits for, on a busy machine too. */
  const aFewFrames = () => act(async () => new Promise((resolve) => setTimeout(resolve, 200)))

  beforeEach(() => {
    played = []
    on('GET', ISSUE_URL, { status: 200, body: emptyLetter() })
    // jsdom has no animations; this stand-in records what the page asks for, as the chooser's test file does.
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function animate(this: HTMLElement, frames: Keyframe[]) {
        const cancel = vi.fn()
        played.push({ on: this, frames, cancel })
        return { cancel } as unknown as Animation
      },
    })
  })
  afterEach(() => {
    delete (HTMLElement.prototype as { animate?: unknown }).animate
  })

  it('is held while Help opens by itself on an empty letter, plays once as it closes, and not again after Help is opened and closed', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' }, { timeout: 10_000 })
    await aFewFrames()
    // Never behind the dim.
    expect(played).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(played).toHaveLength(1), { timeout: 5000 })
    expect(played[0].on.getAttribute('data-slot')).toBe('pick-step')
    expect(played[0].frames.some((frame) => String(frame.transform).includes('rotate(-2deg)'))).toBe(true)
    // The focus came back to Help, in the head, not in the bar.
    expect(document.activeElement).toBe(helpButton())
    expect(theBar().contains(document.activeElement)).toBe(false)
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    // Help opened over the wiggle stops it, so it never plays on under the dim.
    expect(played[0].cancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await aFewFrames()
    expect(played).toHaveLength(1)
  }, 20_000)

  it('does not play as Help closes when words were written while it was open', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' }, { timeout: 10_000 })
    await act(async () => {
      editorOf().chain().insertContent('<p>Mine</p>').run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await aFewFrames()
    expect(played).toEqual([])
  }, 20_000)

  it('stops the reduced-motion ring when Help is opened over it, so the two rings never meet', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    await waitFor(() => expect(played).toHaveLength(1), { timeout: 5000 })
    expect(played[0].on.getAttribute('data-slot')).toBe('pick-ring')
    expect(played[0].cancel).not.toHaveBeenCalled()
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    expect(played[0].cancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await aFewFrames()
    expect(played).toHaveLength(1)
  }, 20_000)
})

describe('the edges a person meets', () => {
  const button = (name: string) => screen.getByRole('button', { name })

  it('is worked by the keyboard alone: Tab and Shift+Tab go round the card\'s buttons and never leave it', () => {
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={() => {}} opener={() => null} />)
    // Step 1: Skip, then Next.
    act(() => button('Next').focus())
    fireEvent.keyDown(button('Next'), { key: 'Tab' })
    expect(document.activeElement).toBe(button('Skip'))
    fireEvent.keyDown(button('Skip'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(button('Next'))
    // Step 2: Skip, Back, Next, and round again.
    fireEvent.click(button('Next'))
    act(() => button('Next').focus())
    fireEvent.keyDown(button('Next'), { key: 'Tab' })
    expect(document.activeElement).toBe(button('Skip'))
    fireEvent.keyDown(button('Skip'), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(button('Next'))
    // A focus that would leave the card, by a key or a press, is brought back inside it.
    const outside = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'Outside' }))
    try {
      act(() => outside.focus())
      expect(screen.getByRole('dialog', { name: 'Help, step 2 of 6' }).contains(document.activeElement)).toBe(true)
    } finally {
      outside.remove()
    }
  })

  it('closes on Escape at each of the six steps, from the card itself or from the button that has the focus', () => {
    const onClose = vi.fn()
    render(<HelpWalkthrough width="desk" sendReady={false} onClose={onClose} opener={() => null} />)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Help, step 1 of 6' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    for (let n = 2; n <= 6; n++) {
      fireEvent.click(button('Next'))
      const onIt = screen.getByRole('button', { name: n === 6 ? 'Done' : 'Next' })
      act(() => onIt.focus())
      fireEvent.keyDown(onIt, { key: 'Escape' })
      expect(screen.getByRole('dialog', { name: `Help, step ${n} of 6` })).toBeTruthy()
      expect(onClose).toHaveBeenCalledTimes(n)
    }
  })

  it('draws one walkthrough, at step 1, when Help is pressed twice in a row', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const help = helpButton() as HTMLButtonElement
    fireEvent.click(help)
    fireEvent.click(help)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    await settle()
    expect(screen.getAllByRole('dialog', { name: /^Help, step/ })).toHaveLength(1)
    expect(document.querySelectorAll('[data-slot="help-dim"]')).toHaveLength(1)
    fireEvent.click(button('Skip'))
    await settle()
    expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
    expect(document.activeElement).toBe(help)
  })

  it('counts a browser that reads its storage but refuses to write to it as already shown, on every visit, and still opens from its button', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Sample quota', 'QuotaExceededError')
    })
    try {
      // Two visits: a key that cannot be written would otherwise open Help by itself over the letter each time.
      for (let visit = 1; visit <= 2; visit++) {
        await site('/admin/newsletter', person({ role: 'lca_admin' }))
        await theLetter()
        await settle()
        expect(write).toHaveBeenCalledWith('lca-newsletter-page-help', 'shown')
        expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
        cleanup()
      }
      await site('/admin/newsletter', person({ role: 'lca_admin' }))
      await theLetter()
      fireEvent.click(helpButton() as HTMLButtonElement)
      expect(await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })).toBeTruthy()
      fireEvent.click(button('Skip'))
      await settle()
      expect(screen.queryByRole('dialog', { name: /^Help, step/ })).toBeNull()
      expect(document.activeElement).toBe(helpButton())
      // Still the letter's page, not a failed one.
      expect(screen.getByRole('textbox', { name: 'The letter' })).toBeTruthy()
    } finally {
      write.mockRestore()
    }
  }, 20_000)

  it('lights the Subject on step 3 whatever the subject holds: empty, very long, or with characters a page could drop', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    for (const subject of ['', `Sample Winter Open ${'and more '.repeat(40)}`, 'Sample <b>bold</b> & "quoted" ½ ♞ news']) {
      on('GET', ISSUE_URL, { status: 200, body: letter({ subject }) })
      await site('/admin/newsletter', person({ role: 'lca_admin' }))
      await theLetter()
      // jsdom draws nothing; the Subject is given a box, as a browser would draw it.
      const subjectBox = screen.getByText('Subject', { selector: 'label' }).parentElement as HTMLElement
      subjectBox.getBoundingClientRect = () => ({ top: 120, left: 320, width: 600, height: 52, bottom: 172, right: 920, x: 320, y: 120, toJSON: () => ({}) })
      fireEvent.click(helpButton() as HTMLButtonElement)
      await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
      fireEvent.click(button('Next'))
      fireEvent.click(button('Next'))
      const card = screen.getByRole('dialog', { name: 'Help, step 3 of 6' })
      expect(card.querySelector('h2')?.textContent).toBe('Subject')
      expect((document.querySelector('[data-slot="help-dim"]') as HTMLElement).dataset.lit).toBe('subject')
      expect(document.querySelector('[data-slot="help-ring"]')).toBeTruthy()
      cleanup()
    }
  }, 30_000)

  it('on the page, where Send is drawn quiet, step 6 never tells a person to send, on a computer or a tablet', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    for (const px of [1440, 820]) {
      vi.stubGlobal('matchMedia', (query: string) => ({
        get matches() {
          const line = /^\(min-width: (\d+)px\)$/.exec(query)
          return line !== null && px >= Number(line[1])
        },
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      await site('/admin/newsletter', person({ role: 'lca_admin' }))
      await theLetter()
      fireEvent.click(helpButton() as HTMLButtonElement)
      await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
      for (let n = 1; n < 6; n++) fireEvent.click(button('Next'))
      const card = screen.getByRole('dialog', { name: 'Help, step 6 of 6' })
      expect(card.querySelector('h2')?.textContent).toBe('Send a test to me')
      const words = [...card.querySelectorAll('h2 ~ p')].map((p) => p.textContent)
      expect(words).toEqual(['Send a test to yourself first.', 'Sending to members from this page is not available yet.'])
      expect(card.textContent).not.toContain('Then send.')
      cleanup()
    }
  }, 30_000)

  it('on a tablet, from 768 to 1023 pixels, step 5 lights the head\'s "See the email", where the page draws it then', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const line = /^\(min-width: (\d+)px\)$/.exec(query)
        return line !== null && 820 >= Number(line[1])
      },
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    const bar = screen.getByRole('region', { name: 'Pick, check and send' })
    const see = screen.getByRole('button', { name: 'See the email' })
    // At this width the page draws "See the email" in its head, not in the bar.
    expect(bar.contains(see)).toBe(false)
    see.getBoundingClientRect = () => ({ top: 90, left: 600, width: 180, height: 44, bottom: 134, right: 780, x: 600, y: 90, toJSON: () => ({}) })
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    for (let n = 1; n < 5; n++) fireEvent.click(button('Next'))
    const card = screen.getByRole('dialog', { name: 'Help, step 5 of 6' })
    expect(card.querySelector('h2')?.textContent).toBe('See the email')
    const dim = document.querySelector('[data-slot="help-dim"]') as HTMLElement
    expect({ lit: dim.dataset.lit, ring: document.querySelector('[data-slot="help-ring"]') !== null }).toEqual({ lit: 'see', ring: true })
    expect((document.querySelector('[data-slot="help-ring"]') as HTMLElement).style.top).toBe('82px')
  })

  it('on a computer with the side put away by Hide, step 5 lights "Show the email" and never a box at the window\'s corner', async () => {
    window.localStorage.setItem('lca-newsletter-page-help', 'shown')
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const line = /^\(min-width: (\d+)px\)$/.exec(query)
        return line !== null && 1440 >= Number(line[1])
      },
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await theLetter()
    fireEvent.click(button('Hide'))
    const side = document.querySelector('[data-slot="side-preview"]') as HTMLElement
    expect(side.hidden).toBe(true)
    const show = button('Show the email')
    show.getBoundingClientRect = () => ({ top: 100, left: 1100, width: 200, height: 44, bottom: 144, right: 1300, x: 1100, y: 100, toJSON: () => ({}) })
    fireEvent.click(helpButton() as HTMLButtonElement)
    await screen.findByRole('dialog', { name: 'Help, step 1 of 6' })
    for (let n = 1; n < 5; n++) fireEvent.click(button('Next'))
    screen.getByRole('dialog', { name: 'Help, step 5 of 6' })
    const ring = document.querySelector('[data-slot="help-ring"]') as HTMLElement
    expect((document.querySelector('[data-slot="help-dim"]') as HTMLElement).dataset.lit).toBe('side')
    expect({ top: ring.style.top, left: ring.style.left, width: ring.style.width }).toEqual({ top: '92px', left: '1092px', width: '216px' })
    // With nothing drawn to light (the button given no box, as the hidden side has none), nothing is lit.
    show.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON: () => ({}) })
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(document.querySelector('[data-slot="help-ring"]')).toBeNull()
    expect((document.querySelector('[data-slot="help-dim"]') as HTMLElement).dataset.lit).toBeUndefined()
  })

  it('says every card in plain words: no dashes, "US Chess" never the old initials, "Click" at every width', () => {
    for (const width of ['desk', 'tablet', 'phone'] as const) {
      for (const ready of [false, true]) {
        const steps = cards(width, ready)
        const all = steps.flatMap((step) => [step.title ?? '', ...step.words]).join(' ')
        expect(all).not.toMatch(/[\u2013\u2014]/)
        expect(all).not.toMatch(/USCF/)
        expect(all).not.toMatch(/\b[Tt]ap\b/)
        expect(steps[2].words.join(' ')).toContain('Click it to change it.')
        expect(steps[3].words.join(' ')).toContain('Click anywhere on the letter')
        expect(steps).toHaveLength(6)
      }
    }
  })
})
