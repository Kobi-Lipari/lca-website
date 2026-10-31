// @vitest-environment jsdom
//
// The new header's tablet form, src/components/layout/SiteHeader.tsx with
// form="tablet" (WS02 step 6), which Navbar draws from 768 to 1023 pixels,
// drawn under a router and a sign-in context with the switches it reads set
// through a mocked FEATURES:
//
// - the same <header> as the desktop form: the banner, data-slot and the
//   navy ring ground, with data-form="tablet", 64 pixels high;
// - the brand link to the home page, named for it, the rook hidden from
//   screen readers and the two-line name beside it;
// - the nav named Main with Tournaments and Clubs alone, the one the page is
//   in marked with aria-current and its line;
// - Donate first among the utilities, opening the donation dialog, or a
//   link to /give with newMembership on; Log in signed out and the My LCA
//   menu signed in; no Join LCA or Renew at this width, which the sheet
//   gives;
// - the bordered Menu button, which opens the Menu sheet as a drawer from
//   the right, the focus back on it after Esc, the drawer closed when the
//   page changes or the window widens into the desktop form;
// - when the row is tight, the two-line name hides and the link keeps its
//   name, and Donate never leaves the bar (the widths stubbed, as jsdom lays
//   nothing out);
// - --header-h, 64 pixels, on the page's root while it is drawn.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { HeaderForm } from '@/components/layout/SiteHeader'

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

const HOME = 'Louisiana Chess Association, home'
const DIALOG = 'Support the Louisiana Chess Association'
const LINE = 'shadow-[inset_0_-2px_0_var(--gold-on-dark)]'

/** A visitor as the header reads one: signed out, or signed in with a member's status. */
function visitor(status: ApiMember['membership_status'] | null = null, signedIn = status !== null): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-tablet' } as User) : null,
    session: null,
    member: status ? ({ id: 'fx-m-tablet', membership_status: status, membership_expiry: '2027-01-01' } as ApiMember) : null,
    role: 'member',
    seats: [],
    managedClubs: [],
    isBoardMember: false,
    assuranceLevel: signedIn ? 'aal1' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: false,
    memberLoading: false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** Writes out where the page is and the page it was handed, and gives a way to change it from outside the header. */
function Where() {
  const location = useLocation()
  const navigate = useNavigate()
  const from = (location.state as { from?: string } | null)?.from
  return (
    <>
      <output data-testid="where">{`${location.pathname}${location.search}${location.hash} from ${from ?? 'nothing'}`}</output>
      <button type="button" onClick={() => navigate('/news')}>
        Go to the news page
      </button>
    </>
  )
}

/** The header in a form a test can change, as Navbar changes it when the window crosses 1024 pixels. */
function Formed({ start }: { start: HeaderForm }) {
  const [form, setForm] = useState<HeaderForm>(start)
  return (
    <>
      <SiteHeader form={form} />
      <button type="button" onClick={() => setForm(form === 'tablet' ? 'desktop' : 'tablet')}>
        Change the form
      </button>
    </>
  )
}

function draw(path = '/', auth: AuthContextValue = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Formed start="tablet" />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const header = () => screen.getByRole('banner')
const bar = () => within(header())
const where = () => screen.getByTestId('where').textContent
const menuButton = () => bar().getByRole('button', { name: 'Menu' })
/** The utilities' names in their order, as the row shows them. */
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

describe('the tablet form', () => {
  it('is the same header as the desktop form, the banner on the navy ring ground, in its tablet form, 64 pixels high', () => {
    const { container } = draw()
    expect(container.querySelectorAll('header')).toHaveLength(1)
    expect(header().getAttribute('data-slot')).toBe('site-header')
    expect(header().getAttribute('data-form')).toBe('tablet')
    expect(header().getAttribute('data-ring-ground')).toBe('navy')
    expect(header().className.split(/\s+/)).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-50', 'h-16', 'bg-(--color-brand-navy)', 'text-white']))
    expect(header().className.split(/\s+/).filter((c) => /^border/.test(c))).toEqual([])
  })

  it('leads with the brand link to the home page, named for it, the rook hidden and the two-line name beside it', () => {
    draw('/clubs')
    const link = bar().getByRole('link', { name: HOME })
    expect(link.getAttribute('href')).toBe('/')
    const mark = link.querySelector('[data-slot="lca-mark"]')!
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    const name = link.querySelector('[data-slot="site-header-name"]')!
    expect([...name.children].map((line) => line.textContent)).toEqual(['Louisiana Chess', 'Association'])
    expect(name.hasAttribute('hidden')).toBe(false)
  })

  it.each([
    ['/tournaments', 'Tournaments'],
    ['/scanner', 'Tournaments'],
    ['/clubs', 'Clubs'],
    ['/clubs/fx-club-north', 'Clubs'],
    ['/', null],
    ['/news', null],
    ['/about', null],
  ] as const)('at %s has Tournaments and Clubs alone in the nav named Main, %s marked with aria-current and its line', (path, current) => {
    draw(path)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Tournaments', '/tournaments'],
      ['Clubs', '/clubs'],
    ])
    expect(within(nav).queryAllByRole('button')).toEqual([])
    expect(links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.textContent)).toEqual(current ? [current] : [])
    for (const a of links) expect(a.className.split(/\s+/).includes(LINE), a.textContent ?? '').toBe(a.textContent === current)
    expect(header().querySelectorAll('[aria-current]')).toHaveLength(current ? 1 : 0)
  })

  it.each([
    ['signed out', visitor(), ['Donate', 'Log in', 'Menu']],
    ['an active member', visitor('active'), ['Donate', 'My LCA', 'Menu']],
    ['a member whose membership has expired', visitor('expired'), ['Donate', 'My LCA', 'Menu']],
    ['a member with no membership', visitor('none'), ['Donate', 'My LCA', 'Menu']],
  ] as const)('%s: Donate first, then Log in or the My LCA menu, then Menu, with no Join LCA or Renew at this width', (_, auth, expected) => {
    draw('/', auth)
    expect(utilities()).toEqual([...expected])
    expect(bar().queryByRole('link', { name: 'Join LCA' })).toBeNull()
    expect(bar().queryByRole('link', { name: 'Renew' })).toBeNull()
    if (expected[1] === 'My LCA') expect(bar().getByRole('button', { name: 'My LCA' }).getAttribute('aria-expanded')).toBe('false')
    else expect(bar().getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
  })

  it('opens the donation dialog from Donate, and closes it on Esc with the focus back on Donate', async () => {
    draw('/clubs')
    const donate = bar().getByRole('button', { name: 'Donate' })
    donate.focus()
    fireEvent.click(donate)
    const dialog = await screen.findByRole('dialog', { name: DIALOG })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(donate))
    expect(where()).toBe('/clubs from nothing')
  })

  it('with newMembership on, Donate is a link to /give', () => {
    flags.newMembership = true
    draw()
    expect(bar().queryByRole('button', { name: 'Donate' })).toBeNull()
    expect(bar().getByRole('link', { name: 'Donate' }).getAttribute('href')).toBe('/give')
  })

  it('hands /login the page it was drawn on from Log in', () => {
    draw('/tournaments?when=weekend#list')
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /tournaments?when=weekend#list')
  })
})

describe('the Menu button and the drawer', () => {
  it('is the bordered Menu button, named Menu, which says it opens a dialog', () => {
    draw()
    const menu = menuButton()
    expect(menu.textContent).toBe('Menu')
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog')
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(menu.hasAttribute('aria-controls')).toBe(false)
    expect(menu.className.split(/\s+/)).toEqual(expect.arrayContaining(['min-h-11', 'border-[1.5px]', 'border-white/75']))
  })

  it('opens the sheet as a drawer from the right, the focus on Close menu, and Esc closes it with the focus back on Menu', async () => {
    draw('/clubs')
    const menu = menuButton()
    menu.focus()
    fireEvent.click(menu)
    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    expect(drawer.getAttribute('data-shape')).toBe('drawer')
    expect(drawer.className.split(/\s+/)).toEqual(expect.arrayContaining(['inset-y-0', 'right-0', 'w-[400px]']))
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.getAttribute('aria-controls')).toBe(drawer.id)
    await waitFor(() => expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Close menu' })))
    // The drawer gives what the row leaves out: Join LCA, for someone signed out.
    expect(within(drawer).getByRole('link', { name: 'Join LCA' }).getAttribute('href')).toBe('/membership')
    fireEvent.keyDown(drawer, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes the drawer when the page changes while it is open', async () => {
    draw('/clubs')
    fireEvent.click(menuButton())
    await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(screen.getByRole('button', { name: 'Go to the news page', hidden: true }))
    expect(where()).toBe('/news from nothing')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('closes the drawer when the window widens into the desktop form, which has no Menu button, and keeps the header', async () => {
    draw('/clubs')
    const kept = header()
    fireEvent.click(menuButton())
    await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(screen.getByRole('button', { name: 'Change the form', hidden: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(header()).toBe(kept)
    expect(header().getAttribute('data-form')).toBe('desktop')
    expect(bar().queryByRole('button', { name: 'Menu' })).toBeNull()
    // Back in the tablet form, the drawer stays closed until Menu is pressed again.
    fireEvent.click(screen.getByRole('button', { name: 'Change the form' }))
    expect(header().getAttribute('data-form')).toBe('tablet')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens the donation dialog from the drawer\'s Donate, the focus back on Menu once it closes', async () => {
    draw('/clubs')
    const menu = menuButton()
    menu.focus()
    fireEvent.click(menu)
    const drawer = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Donate' }))
    const donation = await screen.findByRole('dialog', { name: DIALOG })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull())
    fireEvent.keyDown(donation, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
  })
})

// ── The squeeze and the height ─────────────────────────────────────────────

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

/** The widths of the tablet row's parts, in pixels, as a laid out page would give them; a hidden part measures nothing. */
const WIDTHS: Record<string, number> = {
  'lca-mark': 30,
  'site-header-name': 124,
  'site-header-sections': 200,
  'site-header-donate': 64,
  'site-header-account': 170,
}
/** The row's natural width with every part shown, and with the name hidden; Donate is counted in both. */
const NATURAL = [30 + 124 + 200 + 64 + 170, 30 + 200 + 64 + 170]

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

const nameHidden = () => header().querySelector('[data-slot="site-header-name"]')!.hasAttribute('hidden')
const donateHidden = () => header().querySelector('[data-slot="site-header-donate"]')!.hasAttribute('hidden')

describe('the tablet row when it is tight', () => {
  it('keeps everything with room for every part', () => {
    const watchers = stubResizeObserver()
    stubWidths(NATURAL[0])
    draw()
    act(() => watchers.forEach((w) => w.resized()))
    expect(nameHidden()).toBe(false)
    expect(donateHidden()).toBe(false)
  })

  it('hides the two-line name first, the link keeping its name, and Donate never leaves the bar, even with no room at all', () => {
    const watchers = stubResizeObserver()
    const room = stubWidths(NATURAL[0] - 1)
    draw()
    act(() => watchers.forEach((w) => w.resized()))
    expect(nameHidden()).toBe(true)
    expect(donateHidden()).toBe(false)
    expect(bar().getByRole('link', { name: HOME }).getAttribute('href')).toBe('/')
    expect(utilities()).toEqual(['Donate', 'Log in', 'Menu'])
    room(10)
    act(() => watchers.forEach((w) => w.resized()))
    expect(nameHidden()).toBe(true)
    expect(donateHidden()).toBe(false)
    expect(utilities()).toEqual(['Donate', 'Log in', 'Menu'])
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('link').map((a) => a.textContent)).toEqual(['Tournaments', 'Clubs'])
    // Room again, and the name comes back.
    room(NATURAL[0])
    act(() => watchers.forEach((w) => w.resized()))
    expect(nameHidden()).toBe(false)
  })
})

describe('--header-h', () => {
  it('is 64 pixels on the page\'s root while the tablet form is drawn, and goes with it', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'site-header' ? 64 : 0
    })
    const { unmount } = draw()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('64px')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('')
  })
})
