// @vitest-environment jsdom
//
// The new header, src/components/layout/SiteHeader.tsx (WS02 step 5),
// drawn under a router and a sign-in context, with the switches it reads
// set through a mocked FEATURES:
//
// - one <header>, the page's banner, on the brand navy read through its
//   variable and never a navy band class or data-ground, with
//   data-ring-ground="navy", 64 pixels high and no border; the brand link
//   to the home page named "Louisiana Chess Association, home", the rook
//   mark hidden from screen readers and the two-line name beside it;
// - the six sections from src/lib/nav.ts, in order, the one the page is in
//   with aria-current="page", its line and, for forced colours, which draw
//   no line, its underline, and those the only classes that change from
//   page to page;
// - the utilities in their order: Donate, Log in or My LCA, then Join LCA
//   or Renew by the member's status, the gold Button; Log in hands /login
//   the page it was drawn on, query and hash included;
// - Donate opening the one donation dialog, its code fetched the first
//   time and the dialog kept, closed, after that, or going to /give with
//   newMembership on;
// - the squeeze, from the row's natural width with the widths stubbed, as
//   jsdom lays nothing out: Donate into the About menu first, then the name
//   hidden, and the level the room's alone at each edge;
// - --header-h on the page's root while the header is drawn;
// - Navbar's choice: the new header with the chrome on and the window 1024
//   pixels wide or wider, today's header below that and with either switch
//   off, whatever the width, and a change of width swapping the two.
//
// The two menus are test/unit/site-header-menus.test.tsx.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { Navbar } = await import('@/components/layout/Navbar')

const ROOT = join(__dirname, '../..')
const HOME = 'Louisiana Chess Association, home'
const DIALOG = 'Support the Louisiana Chess Association'
const SECTIONS =['Tournaments', 'Clubs', 'Scholastic', 'News', 'Membership', 'About']
const LINE = 'shadow-[inset_0_-2px_0_var(--gold-on-dark)]'
/** The current section's mark in forced colours, which draw no shadow: an underline, two pixels thick. */
const FORCED_LINE = ['forced-colors:underline', 'forced-colors:decoration-2']
/** A section's mark under the pointer in forced colours, where the hover's shadow is not drawn either. */
const FORCED_HOVER = 'forced-colors:hover:underline'

interface Signed {
  role?: MemberRole
  status?: ApiMember['membership_status']
  /** Days from today to the membership's end. */
  endsIn?: number
  memberLoading?: boolean
}

/** A visitor as the header reads one: signed out, or signed in with a member's status. */
function visitor(signed: Signed | null = null, more: Partial<AuthContextValue> = {}): AuthContextValue {
  const end = new Date(Date.now() + (signed?.endsIn ?? 200) * 86_400_000).toISOString().slice(0, 10)
  return {
    user: signed ? ({ id: 'fx-m-header' } as User) : null,
    session: null,
    member: signed && signed.status ? ({ id: 'fx-m-header', membership_status: signed.status, membership_expiry: end } as ApiMember) : null,
    role: signed?.role ?? 'member',
    seats: [],
    managedClubs: [],
    isBoardMember: false,
    assuranceLevel: signed ? 'aal1' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: false,
    memberLoading: signed?.memberLoading ?? false,
    signOut: async () => {},
    ...more,
  } as unknown as AuthContextValue
}

/** Writes out where the page is and the state it was handed, as /login reads it. */
function Where() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash} from ${from ?? 'nothing'}`}</output>
}

function draw(path = '/', auth: AuthContextValue = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <SiteHeader />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const header = () => screen.getByRole('banner')
const bar = () => within(header())
const sections = () => within(screen.getByRole('navigation', { name: 'Main' }))
const where = () => screen.getByTestId('where').textContent
/** The utilities' names in their order: Donate, Log in or My LCA, the join slot. */
function utilities(): string[] {
  const group = header().querySelector('[data-slot="site-header-donate"]')!.parentElement!
  return [...group.querySelectorAll('a, button')].filter((el) => !el.closest('[hidden]')).map((el) => el.textContent ?? '')
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--header-h')
})

describe('the header and its brand link', () => {
  it('is one header, the page\'s banner, on the brand navy through its variable, with the navy ring ground, 64 pixels high and no border', () => {
    const { container } = draw()
    const headers = container.querySelectorAll('header')
    expect(headers).toHaveLength(1)
    expect(header()).toBe(headers[0])
    const classes = header().className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-50', 'h-16', 'bg-(--color-brand-navy)', 'text-white', 'print:hidden']))
    expect(classes.filter((c) => /^border/.test(c))).toEqual([])
    expect(header().getAttribute('data-ring-ground')).toBe('navy')
    // No navy band class, no lca-navy and no data-ground on it or inside it, whose ring rules outrank the menus' own.
    for (const el of [header(), ...header().querySelectorAll('*')]) {
      const own = (el.getAttribute('class') ?? '').split(/\s+/)
      expect(own.filter((c) => /(^|:)bg-(brand|lca)-navy\b|lca-navy/.test(c)), el.outerHTML.slice(0, 80)).toEqual([])
      expect(el.hasAttribute('data-ground')).toBe(false)
    }
    // One row, 64 pixels high, never a second one.
    const row = header().querySelector('[data-slot="site-header-row"]')!
    expect(row.parentElement).toBe(header())
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'h-16', 'items-center']))
  })

  it('leads with the brand link to the home page, named for it, the rook hidden from screen readers and the two-line name beside it, with no image', () => {
    draw('/tournaments')
    const link = bar().getByRole('link', { name: HOME })
    expect(link.getAttribute('href')).toBe('/')
    expect(link.getAttribute('aria-label')).toBe(HOME)
    expect(header().querySelector('a')).toBe(link)
    const marks = header().querySelectorAll('[data-slot="lca-mark"]')
    expect(marks).toHaveLength(1)
    expect(link.firstElementChild).toBe(marks[0])
    expect(marks[0].getAttribute('aria-hidden')).toBe('true')
    expect(marks[0].getAttribute('class')).toContain('size-[30px]')
    expect(header().querySelectorAll('img')).toHaveLength(0)
    expect(within(link).queryAllByRole('img')).toHaveLength(0)
    const name = link.querySelector('[data-slot="site-header-name"]')!
    expect([...name.children].map((line) => line.textContent)).toEqual(['Louisiana Chess', 'Association'])
    expect(name.textContent).toBe('Louisiana Chess Association')
    expect(name.hasAttribute('hidden')).toBe(false)
    // In the row's white, the second line too: no colour class of its own.
    for (const line of name.querySelectorAll('span')) expect(line.className).not.toMatch(/\btext-(?:lca-gold|gold|white|\[#)/)
  })
})

describe('the sections', () => {
  it('are the six from src/lib/nav.ts, in order, in the nav named Main, with 12 pixels a side, 15 pixels at weight 500 and 44 high', () => {
    draw()
    const items = [...screen.getByRole('navigation', { name: 'Main' }).querySelectorAll(':scope > a, :scope > div > button')]
    expect(items.map((el) => el.textContent)).toEqual(SECTIONS)
    expect(items.map((el) => el.getAttribute('href'))).toEqual(['/tournaments', '/clubs', '/scholastic', '/news', '/membership', null])
    for (const el of items) expect(el.className.split(/\s+/), el.textContent ?? '').toEqual(expect.arrayContaining(['px-3', 'text-[15px]', 'font-medium', 'min-h-11']))
  })

  it.each([
    ['/tournaments', 'Tournaments'],
    ['/scanner', 'Tournaments'],
    ['/tournaments/fx-t-open', 'Tournaments'],
    ['/clubs', 'Clubs'],
    ['/scholastic', 'Scholastic'],
    ['/news', 'News'],
    ['/membership', 'Membership'],
    ['/donate/success', 'Membership'],
    ['/about', 'About'],
    ['/governance/minutes', 'About'],
    ['/champions', 'About'],
    ['/meeting', 'About'],
    ['/contact', 'About'],
    ['/', null],
    ['/support', null],
    ['/login', null],
    ['/dashboard', null],
  ] as const)('at %s marks %s, with aria-current, its line and its underline in forced colours, and nothing else', (path, current) => {
    draw(path)
    const items = [...screen.getByRole('navigation', { name: 'Main' }).querySelectorAll(':scope > a, :scope > div > button')]
    const marked = items.filter((el) => el.getAttribute('aria-current') === 'page').map((el) => el.textContent)
    expect(marked).toEqual(current ? [current] : [])
    expect(header().querySelectorAll('[aria-current]')).toHaveLength(current ? 1 : 0)
    for (const el of items) {
      const classes = el.className.split(/\s+/)
      const isCurrent = el.textContent === current
      expect(classes.includes(LINE), el.textContent ?? '').toBe(isCurrent)
      // Forced colours draw no shadow, so the current section is underlined there, and any other one under the pointer.
      for (const forced of FORCED_LINE) expect(classes.includes(forced), `${el.textContent}: ${forced}`).toBe(isCurrent)
      expect(classes.includes(FORCED_HOVER), `${el.textContent}: ${FORCED_HOVER}`).toBe(!isCurrent)
      expect(classes, el.textContent ?? '').toContain('forced-colors:underline-offset-8')
    }
  })

  it('changes no class but the line from page to page, so nothing in the row moves when the page changes', () => {
    /** The line, its underline in forced colours and the hover's marks: what may differ between the current section and the others. */
    const isLine = (c: string) => c === LINE || FORCED_LINE.includes(c) || c.startsWith('hover:') || c.startsWith('forced-colors:hover:')
    const classesAt = (path: string) => {
      draw(path)
      const items = [...screen.getByRole('navigation', { name: 'Main' }).querySelectorAll(':scope > a, :scope > div > button')]
      const out = items.map((el) => el.className.split(/\s+/).filter((c) => !isLine(c)).join(' '))
      cleanup()
      return out
    }
    const home = classesAt('/')
    for (const path of ['/tournaments', '/clubs', '/scholastic', '/news', '/membership', '/about']) expect(classesAt(path), path).toEqual(home)
  })
})

describe('the utilities', () => {
  it('signed out: Donate, Log in and Join LCA, in that order, Join LCA the gold Button to /membership', () => {
    draw()
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
    const join = bar().getByRole('link', { name: 'Join LCA' })
    expect(join.getAttribute('href')).toBe('/membership')
    expect(join.getAttribute('data-variant')).toBe('gold')
    expect(bar().getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
  })

  it('while the session loads: Log in and Join LCA, as today\'s header shows them', () => {
    draw('/', visitor({ status: 'active' }, { loading: true }))
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
  })

  it.each([
    ['an active member', { status: 'active', endsIn: 300 }, ['Donate', 'My LCA']],
    ['an active member 20 days from the end', { status: 'active', endsIn: 20 }, ['Donate', 'My LCA']],
    ['a member whose membership has expired', { status: 'expired', endsIn: -20 }, ['Donate', 'My LCA', 'Renew']],
    ['a member with no membership', { status: 'none' }, ['Donate', 'My LCA', 'Join LCA']],
    ['a member still loading', { status: 'expired', memberLoading: true }, ['Donate', 'My LCA']],
    ['a member who could not be read', {}, ['Donate', 'My LCA']],
  ] as const)('%s: %j', (_, signed, expected) => {
    draw('/', visitor(signed))
    expect(utilities()).toEqual([...expected])
    expect(bar().queryByRole('link', { name: 'Log in' })).toBeNull()
    const slot = expected[2]
    if (slot) {
      const link = bar().getByRole('link', { name: slot })
      expect(link.getAttribute('href')).toBe('/membership')
      expect(link.getAttribute('data-variant')).toBe('gold')
    }
  })

  it('Log in hands /login the page it was drawn on, its query and its hash included', () => {
    draw('/tournaments?when=weekend#list')
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /tournaments?when=weekend#list')
  })

  it('on /login, Log in keeps the page /login was handed', () => {
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: '/clubs?region=north' } }]}>
          <SiteHeader />
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /clubs?region=north')
  })
})

describe('Donate', () => {
  it('opens the donation dialog, drawn once, until newMembership is on, and opens it again after Esc closes it', async () => {
    draw()
    const donate = bar().getByRole('button', { name: 'Donate' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(donate)
    expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(donate)
    expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('fetches the dialog\'s code only when it first opens: the header imports src/components/DonateButton.tsx through import() alone, so the dialog stays out of the script every page loads', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/SiteHeader.tsx'), 'utf8')
    expect(source).not.toMatch(/^import\b[^;]*from '@\/components\/DonateButton'/m)
    expect(source.match(/\bimport\('@\/components\/DonateButton'\)/g)).toHaveLength(1)
    expect(source).toContain('lazy(')
  })

  it('with newMembership on, is a link to /give and no dialog is drawn', () => {
    flags.newMembership = true
    draw()
    expect(bar().queryByRole('button', { name: 'Donate' })).toBeNull()
    expect(bar().getByRole('link', { name: 'Donate' }).getAttribute('href')).toBe('/give')
    fireEvent.click(bar().getByRole('link', { name: 'Donate' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(where()).toBe('/give from nothing')
  })
})

// ── The squeeze ────────────────────────────────────────────────────────────

/** A stand-in for ResizeObserver, which jsdom lacks: it keeps what it watches, and a test says when sizes changed. */
interface Watcher {
  watched: Element[]
  resized: () => void
}

function stubResizeObserver(): Watcher[] {
  const made: Watcher[] = []
  vi.stubGlobal('ResizeObserver', class {
    private readonly watcher: Watcher
    constructor(changed: () => void) {
      this.watcher = { watched: [], resized: changed }
      made.push(this.watcher)
    }
    observe(target: Element) {
      this.watcher.watched.push(target)
    }
    unobserve() {}
    disconnect() {}
  })
  return made
}

/** The widths of the row's parts, in pixels, as a laid out page would give them; a hidden part measures nothing. */
const WIDTHS: Record<string, number> = {
  'lca-mark': 30,
  'site-header-name': 124,
  'site-header-sections': 530,
  'site-header-donate': 64,
  'site-header-account': 150,
}
/** Each level's natural width with those parts and no padding or gap, which jsdom gives none of. */
const NATURAL = [30 + 124 + 530 + 64 + 150, 30 + 124 + 530 + 150, 30 + 530 + 150]

/** Gives the row its room and each part its width; returns a way to change the room. */
function stubWidths(room: number) {
  let now = room
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const width = this.closest('[hidden]') ? 0 : WIDTHS[this.getAttribute('data-slot') ?? ''] ?? 0
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.getAttribute('data-slot') === 'site-header-row' ? now : 0
  })
  return (next: number) => {
    now = next
  }
}

/** The level the row shows: whether Donate is in the bar, and whether the name is shown. */
function levelShown(): 0 | 1 | 2 {
  const donateHidden = header().querySelector('[data-slot="site-header-donate"]')!.hasAttribute('hidden')
  const nameHidden = header().querySelector('[data-slot="site-header-name"]')!.hasAttribute('hidden')
  if (nameHidden) {
    expect(donateHidden).toBe(true)
    return 2
  }
  return donateHidden ? 1 : 0
}

/** The About menu's rows, opened and closed again by a click. */
function aboutRows(): string[] {
  const about = bar().getByRole('button', { name: 'About' })
  fireEvent.click(about)
  const panel = document.getElementById(about.getAttribute('aria-controls') ?? '')!
  const rows = [...panel.querySelectorAll('a, button')].map((el) => el.textContent ?? '')
  fireEvent.click(about)
  return rows
}

describe('the squeeze, from the row\'s natural width', () => {
  it('keeps everything in the bar with room for every part', () => {
    const watchers = stubResizeObserver()
    stubWidths(1000)
    draw()
    act(() => watchers.forEach((w) => w.resized()))
    expect(levelShown()).toBe(0)
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
    expect(aboutRows().at(-2)).toBe('Contact')
  })

  it('moves Donate into the About menu first, as its last row above LCA on Facebook, then hides the name, and the link keeps its name', () => {
    const watchers = stubResizeObserver()
    const room = stubWidths(NATURAL[0] - 1)
    draw()
    act(() => watchers.forEach((w) => w.resized()))
    expect(levelShown()).toBe(1)
    expect(bar().queryByRole('button', { name: 'Donate' })).toBeNull()
    expect(aboutRows().slice(-3)).toEqual(['Contact', 'Donate', 'LCA on Facebook ↗'])
    room(NATURAL[1] - 1)
    act(() => watchers.forEach((w) => w.resized()))
    expect(levelShown()).toBe(2)
    expect(bar().getByRole('link', { name: HOME }).getAttribute('href')).toBe('/')
    expect(aboutRows().slice(-3)).toEqual(['Contact', 'Donate', 'LCA on Facebook ↗'])
    // No section, Log in or Join LCA ever leaves the bar, at the last level even with no room at all.
    room(10)
    act(() => watchers.forEach((w) => w.resized()))
    expect(levelShown()).toBe(2)
    expect(sections().getAllByRole('link').map((a) => a.textContent)).toEqual(SECTIONS.slice(0, 5))
    expect(sections().getByRole('button', { name: 'About' })).toBeTruthy()
    expect(utilities()).toEqual(['Log in', 'Join LCA'])
  })

  it('opens the one donation dialog from the About menu\'s Donate row, and the menu closing leaves it open', async () => {
    const watchers = stubResizeObserver()
    stubWidths(NATURAL[0] - 1)
    draw()
    act(() => watchers.forEach((w) => w.resized()))
    const about = bar().getByRole('button', { name: 'About' })
    fireEvent.click(about)
    fireEvent.click(within(document.getElementById(about.getAttribute('aria-controls')!)!).getByRole('button', { name: 'Donate' }))
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it.each([
    ['the first edge', NATURAL[0], 0, 1],
    ['the second edge', NATURAL[1], 1, 2],
  ] as const)('at %s, the room a pixel either way and back gives the level of the room alone, never one that depends on the level before', (_, edge, fits, tight) => {
    const watchers = stubResizeObserver()
    const room = stubWidths(edge)
    draw()
    const at = (width: number) => {
      room(width)
      act(() => watchers.forEach((w) => w.resized()))
      return levelShown()
    }
    expect(at(edge)).toBe(fits)
    expect(at(edge - 1)).toBe(tight)
    expect(at(edge)).toBe(fits)
    expect(at(edge + 1)).toBe(fits)
    expect(at(edge - 1)).toBe(tight)
    expect(at(edge - 1)).toBe(tight)
    expect(at(edge + 1)).toBe(fits)
  })

  it('watches the row and every part whose width can change, and measures nothing before the observer\'s first word', () => {
    const watchers = stubResizeObserver()
    stubWidths(10)
    draw()
    // The row starts with everything in it; the first callback, which comes as the observer starts watching, decides.
    expect(levelShown()).toBe(0)
    const slots = watchers.flatMap((w) => w.watched.map((el) => el.getAttribute('data-slot')))
    expect(slots).toEqual(expect.arrayContaining(['site-header-row', 'site-header-name', 'site-header-sections', 'site-header-donate', 'site-header-account']))
    act(() => watchers.forEach((w) => w.resized()))
    expect(levelShown()).toBe(2)
  })
})

// ── The header's height ────────────────────────────────────────────────────

describe('--header-h', () => {
  /** jsdom lays nothing out, so the header's height is given: what offsetHeight reads for it. */
  function headerHeight(px: () => number) {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'site-header' ? px() : 0
    })
  }

  it('is the header\'s height on the page\'s root while it is drawn, follows it, and goes with it', () => {
    let height = 64
    headerHeight(() => height)
    const watchers = stubResizeObserver()
    const { unmount } = draw()
    const root = document.documentElement
    expect(root.style.getPropertyValue('--header-h')).toBe('64px')
    expect(watchers.some((w) => w.watched.includes(header()))).toBe(true)
    height = 80
    act(() => watchers.forEach((w) => w.resized()))
    expect(root.style.getPropertyValue('--header-h')).toBe('80px')
    unmount()
    expect(root.style.getPropertyValue('--header-h')).toBe('')
  })

  it('is written once where there is no ResizeObserver, as here in jsdom', () => {
    headerHeight(() => 64)
    const { unmount } = draw()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('64px')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('')
  })
})

// ── Navbar's choice ────────────────────────────────────────────────────────

describe('Navbar\'s choice of header', () => {
  /** A stand-in for the browser's media query, which jsdom lacks: it answers the 1024-pixel query, and can say the answer changed. */
  function stubWidth(wide: boolean) {
    let answer = wide
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === '(min-width: 1024px)' && answer
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }))
    return (next: boolean) => {
      answer = next
      act(() => listeners.forEach((listener) => listener()))
    }
  }

  function drawNavbar(path = '/tournaments') {
    return render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[path]}>
          <Navbar />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }

  /** Which header is drawn, by what only each has. */
  const drawn = () => {
    const banner = screen.getByRole('banner')
    if (banner.getAttribute('data-slot') === 'site-header') return 'new'
    expect(within(banner).getByRole('button', { name: 'More' })).toBeTruthy()
    return 'today'
  }

  it('draws the new header with the chrome on and a window 1024 pixels wide or wider', () => {
    stubWidth(true)
    drawNavbar()
    expect(drawn()).toBe('new')
    expect(screen.getAllByRole('banner')).toHaveLength(1)
  })

  it('draws today\'s header below 1024 pixels with the chrome on, its drawer and aria-current with it', () => {
    stubWidth(false)
    drawNavbar('/tournaments')
    expect(drawn()).toBe('today')
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const marked = [...screen.getByRole('banner').querySelectorAll('[aria-current="page"]')].map((el) => el.textContent)
    expect(marked).toEqual(['Tournaments', 'Tournaments'])
  })

  it.each([
    [{ newNav: false, newLook: false }],
    [{ newNav: true, newLook: false }],
    [{ newNav: false, newLook: true }],
  ])('draws today\'s header with %j, at any width', (switches) => {
    Object.assign(flags, switches)
    for (const wide of [true, false]) {
      stubWidth(wide)
      drawNavbar()
      expect(drawn(), `wide ${wide}`).toBe('today')
      cleanup()
    }
  })

  it('swaps the two when the window crosses 1024 pixels, one header at a time', () => {
    const cross = stubWidth(false)
    drawNavbar()
    expect(drawn()).toBe('today')
    cross(true)
    expect(drawn()).toBe('new')
    expect(screen.getAllByRole('banner')).toHaveLength(1)
    cross(false)
    expect(drawn()).toBe('today')
  })

  it('draws today\'s header where there is no matchMedia, as in the unit tests that draw the whole app', () => {
    vi.stubGlobal('matchMedia', undefined)
    drawNavbar()
    expect(drawn()).toBe('today')
  })
})
