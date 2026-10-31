// @vitest-environment jsdom
//
// The phone's dock and its tab bar (WS02 step 7):
// src/components/layout/BottomDock.tsx, src/components/layout/BottomTabs.tsx
// and src/components/layout/dockParts.ts, drawn under a router and a
// sign-in context, with the switches they read set through a mocked
// FEATURES and the window given through stand-ins for matchMedia,
// visualViewport and ResizeObserver, which jsdom lacks:
//
// - the dock: one stack fixed to the window's foot, under the dialogs and
//   over the page, holding the action bar's place, the event bar's place
//   and the tab bar in that order, the places empty; --bottom-chrome-h on
//   the page's root, its height, written, followed and taken off;
// - the tab bar: one nav named Main, its four tabs in navTabs' order with
//   their words from src/lib/nav.ts, always shown, their icons hidden from
//   screen readers, the current tab bold with aria-current="page" and its
//   bar on each page, opening the sheet moving none, the account tab both
//   ways and the page Log in hands /login; the words the browser specs
//   write out held to the model here;
// - the Menu tab: a button that says it opens a dialog, reading Menu, and
//   Close with aria-expanded and aria-controls while the sheet is open, a
//   press on it then closing the sheet;
// - where the dock hides, drawing nothing: the three pages that hide the
//   tab bar in any letters' case and with a trailing slash, from 768
//   pixels up, in the reflow fallback, and while the on-screen keyboard
//   is open, by the visual viewport or by a field that takes typing;
// - the rank of the dock's two bars, the event bar outranking the page's
//   action bar, and no bar drawn where there is no dock;
// - the provider's two closes of the sheet, made to its own state as it
//   draws: a change of page, and the window reaching 1024 pixels;
// - where the focus goes back to, in the dock's order;
// - inside the page's bars (Navbar and the dock in one provider): the app
//   bar beside the tab bar, with no Menu button and the current section's
//   name on a page the Menu tab stands for; the Menu tab opening the sheet
//   the app bar draws, above the dock, Esc, the close control and a press
//   on Close each closing it with the focus back on the Menu tab; the
//   sheet's Donate, and a sheet or a donation form whose code fails, giving
//   the focus back there too; the app bar's Menu button back wherever the
//   dock hides, the bar not sticky and writing no --header-h in the reflow
//   fallback, and a Menu button that holds the focus kept until it lets it
//   go; the sheet kept open as the window crosses 768 pixels and closed at
//   1024 with the focus on the brand link;
// - the whole site (src/App.tsx): the dock after the footer inside the
//   provider with the chrome on, the footer still the main's next sibling,
//   and neither with either switch off.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getAnnouncements: async () => ({ announcements: [] }) }))
vi.mock('@/pages/SupportPage', () => ({ SupportPage: () => <h1>The support page</h1> }))
/** Whether the sheet's file, or the donation form's, cannot be had: each fails as a lazy import that rejected does, while it draws. */
const gone = vi.hoisted(() => ({ sheet: false, donation: false }))
vi.mock('@/components/layout/MobileMenu', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/layout/MobileMenu')>()
  return {
    ...real,
    MobileMenu: (props: Parameters<typeof real.MobileMenu>[0]) => {
      if (gone.sheet) throw new TypeError('Failed to fetch dynamically imported module: /assets/MobileMenu-gone.js')
      return <real.MobileMenu {...props} />
    },
  }
})
vi.mock('@/components/DonateButton', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/DonateButton')>()
  return {
    ...real,
    DonateDialog: (props: Parameters<typeof real.DonateDialog>[0]) => {
      if (gone.donation) throw new TypeError('Failed to fetch dynamically imported module: /assets/DonateButton-gone.js')
      return <real.DonateDialog {...props} />
    },
  }
})

const { BottomDock, DockBar, DockProvider } = await import('@/components/layout/BottomDock')
const { Navbar } = await import('@/components/layout/Navbar')
const { KEYBOARD_ROOM, isTextField, useDock, wayBack } = await import('@/components/layout/dockParts')
const { REFLOW_QUERY } = await import('@/hooks/useWideScreen')
const { HIDE_TAB_BAR_ROUTES, navLabel, navTabs } = await import('@/lib/nav')

function visitor(signedIn = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-dock' } as User) : null,
    session: null,
    member: null,
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

/** Writes out where the page is and whether the sheet is open, and gives a way to change the page from outside the dock. */
function Where() {
  const location = useLocation()
  const navigate = useNavigate()
  const dock = useDock()
  return (
    <>
      <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>
      <output data-testid="sheet">{dock?.sheet.open ? 'open' : 'shut'}</output>
      <button type="button" onClick={() => navigate('/clubs')}>
        Go to the clubs page
      </button>
    </>
  )
}

/** The dock in a provider of its own, as the page frame draws it with the chrome on, with what else a test puts beside it. */
function draw(path = '/', auth = visitor(), extra: ReactNode = null, state: unknown = null) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[{ pathname: path.split(/[?#]/)[0], search: /\?[^#]*/.exec(path)?.[0] ?? '', hash: /#.*/.exec(path)?.[0] ?? '', state }]}>
        <DockProvider>
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
          {extra}
          <BottomDock />
        </DockProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const dockEl = () => document.querySelector<HTMLElement>('[data-slot="bottom-dock"]')
/** The tab bar, read through its slot, since the open sheet hides it from the roles a screen reader reads. */
const tabBar = () => document.querySelector<HTMLElement>('[data-slot="tab-bar"]')!
const tabs = () => [...tabBar().querySelectorAll<HTMLElement>('a, button')]
const nameOf = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
const menuTab = () => tabBar().querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!
const sheetState = () => screen.getByTestId('sheet').textContent
const written = () => document.documentElement.style.getPropertyValue('--bottom-chrome-h')

/**
 * A stand-in for the browser's media query, answering the queries the
 * chrome asks from a window's width and height (min-width, max-width and
 * max-height, and a list of them, any one of which matches), and a way to
 * say the window changed.
 */
function stubWindow(size: { width: number; height: number }) {
  const now = { ...size }
  const listeners = new Set<() => void>()
  const one = (part: string) => {
    const m = /^\((min-width|max-width|max-height): ([\d.]+)px\)$/.exec(part.trim())
    if (!m) return false
    const px = Number(m[2])
    if (m[1] === 'min-width') return now.width >= px
    if (m[1] === 'max-width') return now.width <= px
    return now.height <= px
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.split(',').some(one)
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next: { width: number; height: number }) => {
    Object.assign(now, next)
    act(() => listeners.forEach((listener) => listener()))
  }
}

/** A stand-in for the visual viewport: an event target with a height, which a test changes and says it changed. */
function stubVisualViewport(height: number) {
  const view = new EventTarget() as EventTarget & { height: number }
  view.height = height
  vi.stubGlobal('visualViewport', view)
  return (next: number) => {
    view.height = next
    act(() => {
      view.dispatchEvent(new Event('resize'))
    })
  }
}

/** A stand-in for ResizeObserver, which jsdom lacks: it keeps what it watches, and a test says when sizes changed. */
function stubResizeObserver() {
  const made: Array<{ watched: Element[]; resized: () => void }> = []
  vi.stubGlobal('ResizeObserver', class {
    private readonly watcher: { watched: Element[]; resized: () => void }
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

/** jsdom lays nothing out, so the dock's height is given: what offsetHeight reads for it. */
function dockHeight(px: () => number) {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.getAttribute('data-slot') === 'bottom-dock' ? px() : 0
  })
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, myLcaRail: false })
  Object.assign(gone, { sheet: false, donation: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--bottom-chrome-h')
  document.documentElement.style.removeProperty('--header-h')
})

// ── The dock ───────────────────────────────────────────────────────────────

describe('the dock', () => {
  it('is one stack fixed to the window\'s foot, under the dialogs and the sticky bar and over the page, kept off a printed page, its sides inside the safe area', () => {
    draw('/clubs')
    const docks = document.querySelectorAll('[data-slot="bottom-dock"]')
    expect(docks).toHaveLength(1)
    const classes = dockEl()!.className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['fixed', 'inset-x-0', 'bottom-0', 'z-40', 'flex', 'flex-col', 'print:hidden', 'pl-[env(safe-area-inset-left)]', 'pr-[env(safe-area-inset-right)]']))
    // Under the dialogs, their scrims and the sticky bars, all z-50, and the skip link, z-[60].
    expect(classes.filter((c) => /^z-/.test(c))).toEqual(['z-40'])
  })

  it('holds, top to bottom, the page action bar\'s place, the event bar\'s place and the tab bar, the two places empty, so the tab bar alone is its height', () => {
    draw('/clubs')
    const parts = [...dockEl()!.children]
    expect(parts.map((el) => el.getAttribute('data-slot'))).toEqual(['dock-action', 'dock-event', 'tab-bar'])
    expect(parts[2]).toBe(tabBar())
    for (const place of parts.slice(0, 2)) {
      expect(place.childNodes).toHaveLength(0)
      expect(place.getAttribute('class')).toBeNull()
    }
  })

  it('writes its height to --bottom-chrome-h on the page\'s root while it is drawn, follows it, and takes it off when it goes', () => {
    let height = 56
    dockHeight(() => height)
    const watchers = stubResizeObserver()
    const { unmount } = draw('/clubs')
    expect(written()).toBe('56px')
    expect(watchers.some((w) => w.watched.includes(dockEl()!))).toBe(true)
    height = 120
    act(() => watchers.forEach((w) => w.resized()))
    expect(written()).toBe('120px')
    unmount()
    expect(written()).toBe('')
  })

  it('is written once where there is no ResizeObserver, as here in jsdom, and taken off when the dock hides', () => {
    dockHeight(() => 56)
    const resize = stubWindow({ width: 390, height: 844 })
    draw('/clubs')
    expect(written()).toBe('56px')
    resize({ width: 390, height: 400 })
    expect(dockEl()).toBeNull()
    expect(written()).toBe('')
  })
})

// ── The tab bar ────────────────────────────────────────────────────────────

describe('the tab bar', () => {
  it('is one nav named Main on the look\'s surface with its hairline above, holding four tabs in navTabs\' order, each word from src/lib/nav.ts and always shown, each icon hidden from screen readers', () => {
    draw('/support')
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toEqual([tabBar()])
    expect(tabBar().getAttribute('data-slot')).toBe('tab-bar')
    expect(tabBar().className.split(/\s+/)).toEqual(expect.arrayContaining(['border-t', 'border-hairline', 'bg-surface', 'text-ink', 'pb-[env(safe-area-inset-bottom)]']))
    const list = tabBar().querySelector('ul')!
    expect(list.className.split(/\s+/)).toEqual(expect.arrayContaining(['grid', 'h-14', 'grid-cols-4']))
    expect(list.children).toHaveLength(4)
    expect(tabs().map(nameOf)).toEqual(navTabs(false).map((tab) => navLabel(tab.entry)))
    expect(tabs().map(nameOf)).toEqual(['Tournaments', 'Clubs', 'Log in', 'Menu'])
    for (const tab of tabs()) {
      const icons = tab.querySelectorAll('svg')
      expect(icons, nameOf(tab)).toHaveLength(1)
      expect(icons[0].getAttribute('aria-hidden')).toBe('true')
      // The word is drawn, not held for a screen reader alone: no tab is named by a label of its own.
      expect(tab.hasAttribute('aria-label')).toBe(false)
      expect(tab.querySelector('.sr-only')).toBeNull()
      const classes = tab.className.split(/\s+/)
      expect(classes).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11', 'h-full', 'w-full', 'flex-col', 'text-xs', 'max-[360px]:text-[11px]']))
    }
    expect(tabs().map((tab) => tab.getAttribute('href'))).toEqual(['/tournaments', '/clubs', '/login', null])
  })

  it('reuses the Tournaments and Clubs entries, reads Log in or My LCA in the third place with the same icon, and gives the Menu tab its words while the sheet is open, the words the browser specs write out', () => {
    expect(navTabs(false).map((tab) => [tab.id, tab.entry, tab.icon])).toEqual([
      ['tournaments', 'tournaments', 'trophy'],
      ['clubs', 'clubs', 'users'],
      ['account', 'logIn', 'user'],
      ['menu', 'menu', 'menu'],
    ])
    expect(navTabs(true)[2]).toEqual({ id: 'account', entry: 'myLca', icon: 'user' })
    expect(navTabs(false)[3].whileOpen).toBe('Close')
    expect(['tournaments', 'clubs', 'logIn', 'myLca', 'menu'].map((id) => navLabel(id as Parameters<typeof navLabel>[0]))).toEqual(['Tournaments', 'Clubs', 'Log in', 'My LCA', 'Menu'])
  })

  it.each([
    ['/tournaments', 'Tournaments'],
    ['/tournaments/fx-open-2026', 'Tournaments'],
    ['/scanner', 'Tournaments'],
    ['/clubs', 'Clubs'],
    ['/clubs/fx-club-north', 'Clubs'],
    ['/login', 'Log in'],
    ['/scholastic', 'Menu'],
    ['/news', 'Menu'],
    ['/membership', 'Menu'],
    ['/about', 'Menu'],
    ['/governance/minutes', 'Menu'],
    ['/contact', 'Menu'],
    ['/', null],
    ['/support', null],
  ] as const)('at %s marks %s as the current tab: aria-current="page", its label bold and its bar across its top', (path, current) => {
    draw(path)
    const marked = tabs().filter((tab) => tab.hasAttribute('aria-current'))
    expect(marked.map(nameOf)).toEqual(current ? [current] : [])
    for (const tab of tabs()) {
      const here = nameOf(tab) === current
      expect(tab.getAttribute('aria-current'), nameOf(tab)).toBe(here ? 'page' : null)
      const classes = tab.className.split(/\s+/)
      expect(classes.includes('font-bold'), nameOf(tab)).toBe(here)
      expect(classes.includes('font-medium'), nameOf(tab)).toBe(!here)
      // The tabs that are not current take the muted ink in dark mode, the current one the full ink.
      expect(classes.includes('dark:text-ink-muted'), nameOf(tab)).toBe(!here)
      const marks = tab.querySelectorAll('[data-slot="tab-mark"]')
      expect(marks, nameOf(tab)).toHaveLength(here ? 1 : 0)
      if (here) {
        expect(marks[0].getAttribute('aria-hidden')).toBe('true')
        expect(marks[0].textContent).toBe('')
        expect(marks[0].className.split(/\s+/)).toEqual(expect.arrayContaining(['absolute', 'inset-x-[22%]', 'top-0', 'rounded-b-[3px]', 'border-t-[3px]']))
        expect(classes).toContain('relative')
      }
    }
  })

  it('marks My LCA as the current tab under /dashboard for someone signed in, a link to /dashboard that hands nothing on', () => {
    draw('/dashboard', visitor(true))
    expect(tabs().map(nameOf)).toEqual(['Tournaments', 'Clubs', 'My LCA', 'Menu'])
    const account = tabs()[2]
    expect(account.getAttribute('href')).toBe('/dashboard')
    expect(account.getAttribute('aria-current')).toBe('page')
    fireEvent.click(account)
    expect(screen.getByTestId('where').textContent).toBe('/dashboard')
  })

  it('leaves the current tab where it is while the sheet is open', () => {
    draw('/clubs')
    fireEvent.click(menuTab())
    expect(sheetState()).toBe('open')
    expect(tabs().filter((tab) => tab.hasAttribute('aria-current')).map(nameOf)).toEqual(['Clubs'])
  })
})

describe('Log in from the tab', () => {
  /** Follows the Log in tab, and reads what /login was handed. */
  function follow(path: string, state: unknown = null) {
    function Login() {
      return <output data-testid="handed">{JSON.stringify(useLocation().state ?? null)}</output>
    }
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[{ pathname: path.split(/[?#]/)[0], search: /\?[^#]*/.exec(path)?.[0] ?? '', hash: /#.*/.exec(path)?.[0] ?? '', state }]}>
          <DockProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<p>A page</p>} />
            </Routes>
            <BottomDock />
          </DockProvider>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    fireEvent.click(within(tabBar()).getByRole('link', { name: 'Log in' }))
    return JSON.parse(screen.getByTestId('handed').textContent ?? 'null') as unknown
  }

  it('hands /login the page the person is on as one string, its path, query and hash', () => {
    expect(follow('/tournaments', null)).toEqual({ from: '/tournaments' })
    cleanup()
    expect(follow('/tournaments?when=weekend#list')).toEqual({ from: '/tournaments?when=weekend#list' })
  })

  it.each(['/login', '/forgot-password', '/reset-password', '/Login', '/login/'])('on %s hands on the page that page was handed, or nothing, never the page itself', (path) => {
    expect(follow(path, { from: '/clubs?near=me#map' })).toEqual({ from: '/clubs?near=me#map' })
    cleanup()
    expect(follow(path, null)).toEqual({ from: undefined })
  })
})

// ── The Menu tab ───────────────────────────────────────────────────────────

describe('the Menu tab', () => {
  it('is a button that says it opens a dialog, reading Menu with the menu icon, and controls nothing while the sheet is shut', () => {
    draw('/clubs')
    const menu = menuTab()
    expect(menu.getAttribute('type')).toBe('button')
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(menu.hasAttribute('aria-controls')).toBe(false)
    expect(nameOf(menu)).toBe('Menu')
    expect(menu.querySelector('svg')!.getAttribute('class')).toContain('lucide-menu')
  })

  it('opens the sheet, then reads Close with the close icon, expanded and naming the sheet, and a press on Close closes it and opens nothing', () => {
    draw('/clubs')
    fireEvent.click(menuTab())
    expect(sheetState()).toBe('open')
    const menu = menuTab()
    expect(nameOf(menu)).toBe('Close')
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.getAttribute('aria-controls')).toMatch(/\S/)
    expect(menu.querySelector('svg')!.getAttribute('class')).toContain('lucide-x')
    fireEvent.click(menu)
    expect(sheetState()).toBe('shut')
    expect(nameOf(menuTab())).toBe('Menu')
    expect(menuTab().getAttribute('aria-expanded')).toBe('false')
    expect(menuTab().hasAttribute('aria-controls')).toBe(false)
  })

  it('is current on the pages of the sections the sheet holds, a button with aria-current="page"', () => {
    draw('/scholastic')
    expect(menuTab().getAttribute('aria-current')).toBe('page')
  })
})

// ── Where the dock hides ───────────────────────────────────────────────────

describe('where the dock hides, it draws nothing', () => {
  const hidden = () => {
    expect(dockEl()).toBeNull()
    expect(screen.queryAllByRole('navigation')).toEqual([])
    expect(written()).toBe('')
  }

  it('reads the three pages of today\'s site that hide the tab bar from the model', () => {
    expect([...HIDE_TAB_BAR_ROUTES]).toEqual(['/tournaments/:id/print', '/membership/success', '/donate/success'])
  })

  it.each([
    '/tournaments/fx-open-2026/print',
    '/Tournaments/fx-open-2026/Print/',
    '/membership/success',
    '/MEMBERSHIP/SUCCESS',
    '/donate/success',
    '/Donate/Success/',
  ])('on %s, as the router matches it, whatever its letters\' case and with or without a trailing slash', (path) => {
    dockHeight(() => 56)
    draw(path)
    hidden()
  })

  it.each(['/tournaments/fx-open-2026', '/tournaments/fx-open-2026/pairings', '/membership', '/donate'])('on %s, a page that keeps it, the dock is drawn', (path) => {
    draw(path)
    expect(dockEl()).not.toBeNull()
  })

  it('from 768 pixels up, where the tablet and desktop headers are drawn, and below it the dock is drawn', () => {
    const resize = stubWindow({ width: 767, height: 844 })
    draw('/clubs')
    expect(dockEl()).not.toBeNull()
    for (const width of [768, 1023, 1280]) {
      resize({ width, height: 844 })
      hidden()
    }
    resize({ width: 390, height: 844 })
    expect(dockEl()).not.toBeNull()
  })

  it('in the reflow fallback: under 480 pixels tall, or under 300 wide, by one media query', () => {
    expect(REFLOW_QUERY).toBe('(max-height: 479.98px), (max-width: 299.98px)')
    const resize = stubWindow({ width: 390, height: 480 })
    draw('/clubs')
    expect(dockEl()).not.toBeNull()
    for (const size of [{ width: 390, height: 479 }, { width: 667, height: 375 }, { width: 568, height: 320 }, { width: 299, height: 640 }]) {
      resize(size)
      hidden()
    }
    resize({ width: 300, height: 640 })
    expect(dockEl()).not.toBeNull()
  })

  it('while the visual viewport is more than KEYBOARD_ROOM, 150 pixels, shorter than the layout viewport, as an on-screen keyboard makes it, and back once it is not', () => {
    expect(KEYBOARD_ROOM).toBe(150)
    const layout = window.innerHeight
    const resize = stubVisualViewport(layout)
    draw('/clubs')
    expect(dockEl()).not.toBeNull()
    resize(layout - KEYBOARD_ROOM)
    expect(dockEl()).not.toBeNull()
    resize(layout - KEYBOARD_ROOM - 1)
    hidden()
    resize(layout - 300)
    hidden()
    resize(layout)
    expect(dockEl()).not.toBeNull()
  })

  it('while a field that takes typing holds the focus, outside a modal dialog, and back once the focus has gone to something else', async () => {
    vi.useFakeTimers()
    const fields = (
      <div>
        <input aria-label="text" />
        <input aria-label="email" type="email" />
        <input aria-label="search" type="search" />
        <input aria-label="number" type="number" />
        <input aria-label="date" type="date" />
        <textarea aria-label="notes" />
        <div aria-label="editable" role="textbox" contentEditable suppressContentEditableWarning tabIndex={0} />
        <input aria-label="tick" type="checkbox" />
        <input aria-label="fixed" readOnly />
        <select aria-label="pick">
          <option>One</option>
        </select>
        <button type="button">A button</button>
        <div role="dialog" aria-label="A dialog">
          <input aria-label="amount" type="number" />
        </div>
      </div>
    )
    draw('/clubs', visitor(), fields)
    const focus = (el: HTMLElement) => {
      act(() => {
        el.focus()
      })
      act(() => {
        vi.runAllTimers()
      })
    }
    for (const name of ['text', 'email', 'search', 'number', 'date', 'notes', 'editable']) {
      focus(screen.getByLabelText(name))
      expect(dockEl(), name).toBeNull()
    }
    for (const name of ['tick', 'fixed', 'pick']) {
      focus(screen.getByLabelText(name))
      expect(dockEl(), name).not.toBeNull()
    }
    // A field inside a modal dialog, as the donation form's amount is, does not hide the dock by the focus alone.
    focus(screen.getByLabelText('amount'))
    expect(dockEl(), 'a field in a dialog').not.toBeNull()
    focus(screen.getByLabelText('text'))
    expect(dockEl()).toBeNull()
    focus(screen.getByRole('button', { name: 'A button' }))
    expect(dockEl()).not.toBeNull()
    // The focus taken off a field to nowhere, as a tap outside it does, brings the dock back too.
    focus(screen.getByLabelText('email'))
    expect(dockEl()).toBeNull()
    act(() => {
      ;(document.activeElement as HTMLElement).blur()
    })
    act(() => {
      vi.runAllTimers()
    })
    expect(dockEl()).not.toBeNull()
  })

  it('tells a field that takes typing from one that does not', () => {
    const make = (html: string) => {
      const box = document.createElement('div')
      box.innerHTML = html
      document.body.append(box)
      return box.firstElementChild
    }
    for (const html of ['<input>', '<input type="text">', '<input type="password">', '<input type="tel">', '<input type="url">', '<input type="time">', '<input type="week">', '<input type="madeup">', '<textarea></textarea>', '<div contenteditable="true"></div>', '<p contenteditable></p>']) {
      expect(isTextField(make(html)), html).toBe(true)
    }
    for (const html of ['<input type="checkbox">', '<input type="radio">', '<input type="range">', '<input type="file">', '<input type="submit">', '<input readonly>', '<input disabled>', '<textarea readonly></textarea>', '<select></select>', '<button></button>', '<div contenteditable="false"></div>', '<a href="/">x</a>']) {
      expect(isTextField(make(html)), html).toBe(false)
    }
    expect(isTextField(null)).toBe(false)
    document.body.innerHTML = ''
  })
})

// ── The dock's two bars ────────────────────────────────────────────────────

describe('the dock\'s two places', () => {
  const place = (slot: string) => dockEl()!.querySelector(`[data-slot="${slot}"]`)

  it('draws a page\'s action bar in its place, at the top of the dock', () => {
    draw('/clubs', visitor(), <DockBar kind="action"><p>Register for the open</p></DockBar>)
    expect(place('dock-action')!.textContent).toBe('Register for the open')
    expect(dockEl()!.firstElementChild).toBe(place('dock-action'))
    expect(place('dock-event')!.childNodes).toHaveLength(0)
  })

  it('gives the event bar its place above the tab bar, and takes the action bar\'s place away while it is drawn: one contextual bar at a time, the event bar first', () => {
    function Bars() {
      const [event, setEvent] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setEvent(false)}>
            The event is over
          </button>
          <DockBar kind="action">
            <p>Register for the open</p>
          </DockBar>
          {event && (
            <DockBar kind="event">
              <p>Round 3 starts at 7:00 PM</p>
            </DockBar>
          )}
        </>
      )
    }
    draw('/clubs', visitor(), <Bars />)
    expect(place('dock-action')).toBeNull()
    expect(place('dock-event')!.textContent).toBe('Round 3 starts at 7:00 PM')
    expect(screen.queryByText('Register for the open')).toBeNull()
    expect([...dockEl()!.children].map((el) => el.getAttribute('data-slot'))).toEqual(['dock-event', 'tab-bar'])
    // The event bar gone, the action bar is back in its place, above the event bar's.
    fireEvent.click(screen.getByRole('button', { name: 'The event is over' }))
    expect(place('dock-event')!.childNodes).toHaveLength(0)
    expect(screen.getByText('Register for the open').parentElement).toBe(place('dock-action'))
    expect([...dockEl()!.children].map((el) => el.getAttribute('data-slot'))).toEqual(['dock-action', 'dock-event', 'tab-bar'])
  })

  it('draws a bar nowhere where there is no dock: outside a provider, and where the dock hides', () => {
    render(
      <MemoryRouter>
        <DockBar kind="action">
          <p>Register for the open</p>
        </DockBar>
      </MemoryRouter>,
    )
    expect(screen.queryByText('Register for the open')).toBeNull()
    cleanup()
    draw('/donate/success', visitor(), <DockBar kind="event"><p>Round 3 starts at 7:00 PM</p></DockBar>)
    expect(screen.queryByText('Round 3 starts at 7:00 PM')).toBeNull()
  })
})

// ── The provider's closes ──────────────────────────────────────────────────

describe('the provider closes the one sheet', () => {
  it('when the page changes while it is open, and leaves it shut when it was', () => {
    draw('/tournaments')
    fireEvent.click(menuTab())
    expect(sheetState()).toBe('open')
    fireEvent.click(screen.getByRole('button', { name: 'Go to the clubs page' }))
    expect(screen.getByTestId('where').textContent).toBe('/clubs')
    expect(sheetState()).toBe('shut')
  })

  it('as the window reaches 1024 pixels, where the desktop header has no Menu button, and keeps it open across 768', () => {
    const resize = stubWindow({ width: 390, height: 844 })
    draw('/clubs')
    fireEvent.click(menuTab())
    expect(sheetState()).toBe('open')
    resize({ width: 900, height: 844 })
    expect(sheetState()).toBe('open')
    resize({ width: 1023, height: 844 })
    expect(sheetState()).toBe('open')
    resize({ width: 1024, height: 844 })
    expect(sheetState()).toBe('shut')
  })
})

// ── The way back for the focus ─────────────────────────────────────────────

describe('where the focus goes back to', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  /** A page of the chrome's parts, as the bars draw them. */
  function page(html: string) {
    document.body.innerHTML = html
    return (selector: string) => document.querySelector<HTMLElement>(selector)!
  }

  it('is the control that opened the sheet while it is still in the page', () => {
    const at = page('<header data-slot="app-bar"><a data-slot="app-bar-brand" href="/">Home</a></header><nav data-slot="tab-bar"><button aria-haspopup="dialog">Menu</button></nav><button id="opener">Opener</button>')
    expect(wayBack(at('#opener'))).toBe(at('#opener'))
  })

  it('else the bordered Menu button of the bar drawn, the app bar\'s or the tablet header\'s, then the Menu tab, then the brand link of the bar drawn', () => {
    const gone = document.createElement('button')
    let at = page('<header data-slot="app-bar"><a data-slot="app-bar-brand" href="/">Home</a><button aria-haspopup="dialog">Menu</button></header><nav data-slot="tab-bar"><button aria-haspopup="dialog">Menu</button></nav>')
    expect(wayBack(gone)).toBe(at('[data-slot="app-bar"] button'))
    at = page('<header data-slot="site-header"><a data-slot="site-header-brand" href="/">Home</a><button aria-haspopup="dialog">Menu</button></header>')
    expect(wayBack(null)).toBe(at('[data-slot="site-header"] button'))
    at = page('<header data-slot="app-bar"><a data-slot="app-bar-brand" href="/">Home</a></header><nav data-slot="tab-bar"><a href="/clubs">Clubs</a><button aria-haspopup="dialog">Menu</button></nav>')
    expect(wayBack(gone)).toBe(at('[data-slot="tab-bar"] button'))
    at = page('<header data-slot="site-header"><a data-slot="site-header-brand" href="/">Home</a><button aria-haspopup="menu">About</button></header>')
    expect(wayBack(gone)).toBe(at('[data-slot="site-header-brand"]'))
    page('<main><button>Nothing of the chrome</button></main>')
    expect(wayBack(gone)).toBeNull()
  })
})

// ── Inside the page's bars ─────────────────────────────────────────────────

/** The page's bars as the page frame draws them with the chrome on: the header, a page, and the dock, in one provider. */
function drawBars(path = '/clubs', auth = visitor(), extra: ReactNode = null) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <DockProvider>
          <Navbar />
          <main>
            <Routes>
              <Route path="*" element={<Where />} />
            </Routes>
            {extra}
          </main>
          <footer>
            <a href="/contact">Contact</a>
          </footer>
          <BottomDock />
        </DockProvider>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** The bar drawn, read through its tag, since the open sheet hides it from the roles a screen reader reads. */
const banner = () => document.querySelector<HTMLElement>('header')!
/** The app bar's bordered Menu button, while it is drawn. */
const barMenu = () => banner().querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
/** Presses the Menu tab as a person does: the focus on it, then the press. */
function pressMenuTab() {
  const tab = menuTab()
  tab.focus()
  fireEvent.click(tab)
  return tab
}

describe('the app bar beside the tab bar', () => {
  it('draws its brand link alone, no Menu button, while the tab bar is drawn, and writes --header-h as before', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'app-bar' ? 56 : 0
    })
    drawBars('/clubs')
    expect(banner().getAttribute('data-slot')).toBe('app-bar')
    expect(barMenu()).toBeNull()
    expect([...banner().querySelectorAll('a, button')].map(nameOf)).toEqual(['Louisiana Chess Association, home'])
    expect(banner().className.split(/\s+/)).toEqual(expect.arrayContaining(['sticky', 'top-0', 'box-content', 'h-14', 'pt-[env(safe-area-inset-top)]']))
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('56px')
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toEqual([tabBar()])
  })

  it.each([
    ['/scholastic', 'Scholastic'],
    ['/news', 'News'],
    ['/news/fx-post', 'News'],
    ['/membership', 'Membership'],
    ['/donate', 'Membership'],
    ['/about', 'About'],
    ['/governance/board', 'About'],
    ['/contact', 'About'],
  ] as const)('at %s names the section the Menu tab stands for, %s, in the bar\'s white at the row\'s end', (path, words) => {
    drawBars(path)
    const named = banner().querySelectorAll('[data-slot="app-bar-section"]')
    expect(named).toHaveLength(1)
    expect(named[0].textContent).toBe(words)
    expect(named[0].className.split(/\s+/)).toEqual(expect.arrayContaining(['ml-auto', 'truncate', 'text-[15px]', 'font-semibold']))
    // White, as the bar's other words: no colour of its own.
    expect(named[0].className.split(/\s+/).filter((c) => /^text-(?!\[15px\])/.test(c))).toEqual([])
    expect(menuTab().getAttribute('aria-current')).toBe('page')
  })

  it.each(['/tournaments', '/clubs', '/', '/support', '/login', '/dashboard'])('at %s names no section, the Menu tab not standing for the page', (path) => {
    drawBars(path)
    expect(banner().querySelector('[data-slot="app-bar-section"]')).toBeNull()
  })

  it('draws its Menu button again wherever the dock hides: on a page that hides the tab bar, while the keyboard is open and in the reflow fallback, and names no section there', () => {
    drawBars('/donate/success')
    expect(dockEl()).toBeNull()
    expect(barMenu()).not.toBeNull()
    expect(nameOf(barMenu()!)).toBe('Menu')
    cleanup()
    const resize = stubVisualViewport(window.innerHeight)
    drawBars('/scholastic')
    expect(barMenu()).toBeNull()
    resize(window.innerHeight - 300)
    expect(dockEl()).toBeNull()
    expect(barMenu()).not.toBeNull()
    expect(banner().querySelector('[data-slot="app-bar-section"]')).toBeNull()
    resize(window.innerHeight)
    expect(barMenu()).toBeNull()
  })

  it('in the reflow fallback is not sticky and writes no --header-h, its Menu button opening the sheet, and back at the top once the window is tall again', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'app-bar' ? 56 : 0
    })
    const resize = stubWindow({ width: 667, height: 375 })
    drawBars('/clubs')
    expect(dockEl()).toBeNull()
    const classes = banner().className.split(/\s+/)
    expect(classes).toContain('static')
    expect(classes).not.toContain('sticky')
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('')
    const menu = barMenu()!
    menu.focus()
    fireEvent.click(menu)
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(sheet.getAttribute('data-shape')).toBe('full')
    expect(menu.getAttribute('aria-controls')).toBe(sheet.id)
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
    resize({ width: 390, height: 844 })
    expect(banner().className.split(/\s+/)).toContain('sticky')
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('56px')
    expect(dockEl()).not.toBeNull()
  })

  it('keeps a Menu button that holds the focus until the focus leaves it, so a press on it is never lost as the tab bar comes back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    drawBars('/clubs', visitor(), <input aria-label="Find a club" />)
    act(() => screen.getByLabelText('Find a club').focus())
    expect(dockEl()).toBeNull()
    const menu = barMenu()!
    expect(menu).not.toBeNull()
    // The focus on the Menu button closes the keyboard: the tab bar comes back, and the button stays while it holds the focus.
    act(() => menu.focus())
    act(() => {
      vi.runOnlyPendingTimers()
    })
    expect(dockEl()).not.toBeNull()
    expect(barMenu()).toBe(menu)
    fireEvent.click(menu)
    expect(sheetState()).toBe('open')
    vi.useRealTimers()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
    // Once the focus has left it, the tab bar alone gives the way to the sheet.
    expect(barMenu()).toBeNull()
  })
})

describe('the Menu tab and the sheet the app bar draws', () => {
  it('opens the sheet over the window above the dock, the tab reading Close and naming it, the focus on Close menu; Esc closes it with the focus back on the Menu tab', async () => {
    drawBars('/clubs')
    const tab = pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(sheet.getAttribute('data-shape')).toBe('full')
    expect(sheet.className.split(/\s+/)).toEqual(expect.arrayContaining(['inset-x-0', 'top-0', 'bottom-[var(--bottom-chrome-h,0px)]']))
    expect(document.querySelector('[data-slot="menu-sheet-scrim"]')!.className.split(/\s+/)).toContain('bottom-[var(--bottom-chrome-h,0px)]')
    expect(nameOf(tab)).toBe('Close')
    expect(tab.getAttribute('aria-expanded')).toBe('true')
    expect(tab.getAttribute('aria-controls')).toBe(sheet.id)
    // The current tab stays the page's own.
    expect(tabs().filter((t) => t.hasAttribute('aria-current')).map(nameOf)).toEqual(['Clubs'])
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(tab))
    expect(nameOf(tab)).toBe('Menu')
    expect(tab.getAttribute('aria-expanded')).toBe('false')
    expect(tab.hasAttribute('aria-controls')).toBe(false)
  })

  it('closes on its close control and on a press on the Close tab, each time with the focus back on the Menu tab', async () => {
    drawBars('/clubs')
    let tab = pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close menu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(tab))
    tab = pressMenuTab()
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeTruthy()
    fireEvent.click(menuTab())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(tab))
    expect(sheetState()).toBe('shut')
  })

  it('closes as a row is followed, the row\'s page opening, the focus back on the Menu tab', async () => {
    drawBars('/')
    const tab = pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('link', { name: /^Scholastic/ }))
    expect(screen.getByTestId('where').textContent).toBe('/scholastic')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menuTab()))
    expect(menuTab()).toBe(tab)
  })

  it('hands the sheet\'s Donate to the donation dialog, which gives the focus back to the Menu tab as it closes, the page where it was', async () => {
    drawBars('/news')
    const tab = pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Donate' }))
    const donation = await screen.findByRole('dialog', { name: 'Support the Louisiana Chess Association' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull())
    const focus = vi.spyOn(tab, 'focus')
    fireEvent.keyDown(donation, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(tab))
    for (const [options] of focus.mock.calls) expect(options).toEqual({ preventScroll: true })
    expect(screen.getByTestId('where').textContent).toBe('/news')
  })

  it('when the sheet\'s code cannot be had, closes what was opening, says so under the bar and leaves the focus on the Menu tab, which asked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    gone.sheet = true
    drawBars('/clubs')
    const tab = pressMenuTab()
    expect((await screen.findByRole('alert')).textContent).toContain('The menu could not be loaded. Reload the page to try again.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(sheetState()).toBe('shut')
    expect(document.activeElement).toBe(tab)
    // Dismiss puts the notice away and gives the focus to the Menu tab.
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement).toBe(tab)
  })

  it('when the donation form\'s code cannot be had, gives the focus to the Menu tab that opened the sheet, the sheet\'s Donate having gone with it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    gone.donation = true
    drawBars('/clubs')
    const tab = pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Donate' }))
    expect((await screen.findByRole('alert')).textContent).toContain('The donation form could not be loaded. Reload the page to try again.')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(tab))
    expect(document.activeElement).not.toBe(document.body)
  })
})

describe('the one sheet as the window crosses a line', () => {
  it('stays open as the window widens past 768 pixels, drawn as the tablet header\'s drawer with the focus on its close control, and back as the full sheet below 768; closes at 1024 with the focus on the brand link', async () => {
    const resize = stubWindow({ width: 390, height: 844 })
    drawBars('/clubs')
    pressMenuTab()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(sheet.getAttribute('data-shape')).toBe('full')
    resize({ width: 900, height: 844 })
    expect(banner().getAttribute('data-form')).toBe('tablet')
    expect(dockEl()).toBeNull()
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeTruthy()
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('drawer'))
    await waitFor(() => expect(document.activeElement).toBe(within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', { name: 'Close menu' })))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    const menu = within(banner()).getByRole('button', { name: 'Menu', hidden: true })
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.getAttribute('aria-controls')).toBe(screen.getByRole('dialog', { name: 'Menu' }).id)
    resize({ width: 390, height: 844 })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('full'))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(nameOf(menuTab())).toBe('Close')
    resize({ width: 1023, height: 844 })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('drawer'))
    resize({ width: 1024, height: 844 })
    expect(banner().getAttribute('data-form')).toBe('desktop')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sheetState()).toBe('shut')
    await waitFor(() => expect(document.activeElement).toBe(within(banner()).getByRole('link', { name: 'Louisiana Chess Association, home' })))
  })
})

// ── The whole site ─────────────────────────────────────────────────────────

describe('the page frame, src/App.tsx', () => {
  async function site(path = '/support') {
    const { default: App } = await import('@/App')
    let view: ReturnType<typeof render> | undefined
    await act(async () => {
      view = render(
        <AuthContext.Provider value={visitor()}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AuthContext.Provider>,
      )
    })
    await screen.findByRole('heading', { level: 1, name: 'The support page' })
    return view!.container
  }

  it('with the chrome on draws the dock after the footer, the last thing in the frame, the footer still the main\'s next sibling', async () => {
    const container = await site()
    const main = container.querySelector('main')!
    const footer = container.querySelector('footer')!
    expect(main.nextElementSibling).toBe(footer)
    expect(footer.nextElementSibling).toBe(dockEl())
    expect(dockEl()!.nextElementSibling).toBeNull()
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toEqual([tabBar()])
    // The skip link first, then the bar, the main, the footer and the dock, in the page's order.
    const order = [container.querySelector('[data-skip-link]')!, banner(), main, footer, dockEl()!]
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it.each([
    ['every switch off', false, false],
    ['newNav on alone', true, false],
    ['newLook on alone', false, true],
  ])('with %s draws no dock, no tab bar and no --bottom-chrome-h', async (_, newNav, newLook) => {
    Object.assign(flags, { newNav, newLook })
    const container = await site()
    expect(dockEl()).toBeNull()
    expect(container.querySelector('[data-slot="tab-bar"]')).toBeNull()
    expect(written()).toBe('')
    expect(container.querySelector('main')!.nextElementSibling).toBe(container.querySelector('footer'))
    expect(container.querySelector('footer')!.nextElementSibling).toBeNull()
  })
})
