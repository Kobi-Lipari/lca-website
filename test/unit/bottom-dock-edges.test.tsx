// @vitest-environment jsdom
//
// The phone's dock and its tab bar at their edges (WS02 step 7), beside
// test/unit/bottom-dock.test.tsx, which holds them as they are drawn and
// used. What this file holds:
//
// - the dock's small store of bars, read on its own: each kind counted
//   apart, a bar taken off once however often its remover is called, a
//   listener told of every change and of nothing else, the same ref for a
//   place every time;
// - the dock's two places as the window changes: a page's bar drawn while
//   the window is a tablet's comes into its place as the window narrows and
//   goes as it widens; the action bar's place kept away while any event bar
//   is drawn, one drawn while there was no dock among them;
// - the keyboard's rule at its edges: a visual viewport a fraction of a
//   pixel past 150 pixels shorter, a field in an alert dialog, and the
//   other kinds of input;
// - the one open state of the sheet as the window changes with it open,
//   and where Esc then gives the focus: opened from the app bar's Menu
//   button in the reflow fallback and the window grown tall, from the
//   tablet header and the window narrowed, from the Menu tab and the window
//   widened or turned on its side; and closed as the window widens straight
//   into the desktop form, the focus then on the brand link;
// - the account tab as the sign-in answer arrives, the tab bar drawn
//   outside the dock's provider, each tab's icon, the app bar naming no
//   section where no tab bar is drawn, and the current tab's bar on the tab
//   bar's own surface.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { useState, type ReactNode } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
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

const { BottomDock, DockBar, DockProvider } = await import('@/components/layout/BottomDock')
const { BottomTabs } = await import('@/components/layout/BottomTabs')
const { Navbar } = await import('@/components/layout/Navbar')
const { KEYBOARD_ROOM, createDockBars, isTextField } = await import('@/components/layout/dockParts')
const { navTabs } = await import('@/lib/nav')

/** A visitor: signed out, or signed in, and with the sign-in answer still on its way where asked. */
function visitor(signedIn = false, loading = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-dock-edges' } as User) : null,
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
    loading,
    memberLoading: false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** Writes out where the page is. */
function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>
}

/** The page's bars as the page frame draws them with the chrome on: the header, the page, a footer and the dock, in one provider. */
function drawBars(path = '/clubs', extra: ReactNode = null, auth = visitor()) {
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

const dockEl = () => document.querySelector<HTMLElement>('[data-slot="bottom-dock"]')
/** The tab bar, read through its slot, since the open sheet hides it from the roles a screen reader reads. */
const tabBar = () => document.querySelector<HTMLElement>('[data-slot="tab-bar"]')
const tabs = () => [...(tabBar()?.querySelectorAll<HTMLElement>('a, button') ?? [])]
const nameOf = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
const menuTab = () => tabBar()?.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]') ?? null
/** The bar drawn, read through its tag, since the open sheet hides it from the roles a screen reader reads. */
const banner = () => document.querySelector<HTMLElement>('header')!
/** The bar's own bordered Menu button, while it is drawn. */
const barMenu = () => banner().querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')
const place = (slot: string) => dockEl()?.querySelector(`[data-slot="${slot}"]`) ?? null
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

/** Presses a control as a person does: the focus on it, then the press. */
function press(control: HTMLElement) {
  control.focus()
  fireEvent.click(control)
  return control
}

/** The sheet once it is open, with the focus on its close control. */
async function openedSheet() {
  const sheet = await screen.findByRole('dialog', { name: 'Menu' })
  await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
  return sheet
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.documentElement.style.removeProperty('--bottom-chrome-h')
  document.documentElement.style.removeProperty('--header-h')
})

// ── The dock's store of bars ───────────────────────────────────────────────

describe('the dock\'s store of the bars a page puts in it', () => {
  it('counts each kind on its own, and the remover a bar is given takes it off once, however often it is called', () => {
    const bars = createDockBars()
    expect([bars.count('action'), bars.count('event')]).toEqual([0, 0])
    const first = bars.add('event')
    const second = bars.add('event')
    const action = bars.add('action')
    expect([bars.count('action'), bars.count('event')]).toEqual([1, 2])
    first()
    first()
    first()
    expect([bars.count('action'), bars.count('event')]).toEqual([1, 1])
    second()
    action()
    action()
    expect([bars.count('action'), bars.count('event')]).toEqual([0, 0])
  })

  it('tells its listeners of every count and every place that changes, never of a place given the element it holds, and no longer tells one that has gone', () => {
    const bars = createDockBars()
    const told: string[] = []
    const stop = bars.subscribe(() => told.push(`${bars.count('action')} ${bars.count('event')} ${bars.place('action')?.id ?? '-'} ${bars.place('event')?.id ?? '-'}`))
    const remove = bars.add('action')
    const box = document.createElement('div')
    box.id = 'action-place'
    bars.placeRef('action')(box)
    bars.placeRef('action')(box)
    const lane = document.createElement('div')
    lane.id = 'event-place'
    bars.placeRef('event')(lane)
    bars.placeRef('event')(null)
    bars.placeRef('event')(null)
    remove()
    remove()
    expect(told).toEqual(['1 0 - -', '1 0 action-place -', '1 0 action-place event-place', '1 0 action-place -', '0 0 action-place -'])
    stop()
    bars.add('event')
    bars.placeRef('action')(null)
    expect(told).toHaveLength(5)
  })

  it('gives each kind of place the same ref every time, so a place is never taken off and put back as the dock draws again, and the place follows it', () => {
    const bars = createDockBars()
    expect(bars.placeRef('action')).toBe(bars.placeRef('action'))
    expect(bars.placeRef('event')).toBe(bars.placeRef('event'))
    expect(bars.placeRef('action')).not.toBe(bars.placeRef('event'))
    const box = document.createElement('div')
    bars.placeRef('event')(box)
    expect([bars.place('action'), bars.place('event')]).toEqual([null, box])
    bars.placeRef('event')(null)
    expect(bars.place('event')).toBeNull()
  })

  it('keeps each provider\'s bars apart from another\'s', () => {
    const one = createDockBars()
    const two = createDockBars()
    one.add('event')
    expect([one.count('event'), two.count('event')]).toEqual([1, 0])
  })
})

// ── The dock's places as the window changes ────────────────────────────────

describe('the dock\'s places as the window changes', () => {
  it('draws a page\'s action bar, put in the page while the window is a tablet\'s, into its place once the window narrows below 768 pixels, and takes it away as the window widens again', () => {
    const resize = stubWindow({ width: 900, height: 844 })
    drawBars('/clubs', <DockBar kind="action"><p>Register for the open</p></DockBar>)
    expect(dockEl()).toBeNull()
    expect(screen.queryByText('Register for the open')).toBeNull()
    resize({ width: 390, height: 844 })
    expect(screen.getByText('Register for the open').parentElement).toBe(place('dock-action'))
    resize({ width: 768, height: 844 })
    expect(dockEl()).toBeNull()
    expect(screen.queryByText('Register for the open')).toBeNull()
    resize({ width: 320, height: 844 })
    expect(screen.getByText('Register for the open').parentElement).toBe(place('dock-action'))
  })

  it('keeps the action bar\'s place away while any event bar is drawn, two of them among them, and gives it back once the last has gone', () => {
    function Bars() {
      const [events, setEvents] = useState(2)
      return (
        <>
          <button type="button" onClick={() => setEvents((n) => n - 1)}>
            One event bar fewer
          </button>
          <DockBar kind="action">
            <p>Register for the open</p>
          </DockBar>
          {events >= 1 && (
            <DockBar kind="event">
              <p>Round 3 starts at 7:00 PM</p>
            </DockBar>
          )}
          {events >= 2 && (
            <DockBar kind="event">
              <p>Round 4 starts at 9:00 PM</p>
            </DockBar>
          )}
        </>
      )
    }
    drawBars('/clubs', <Bars />)
    const slots = () => [...dockEl()!.children].map((el) => el.getAttribute('data-slot'))
    expect(slots()).toEqual(['dock-event', 'tab-bar'])
    expect(place('dock-event')!.textContent).toBe('Round 3 starts at 7:00 PMRound 4 starts at 9:00 PM')
    expect(screen.queryByText('Register for the open')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'One event bar fewer' }))
    expect(slots()).toEqual(['dock-event', 'tab-bar'])
    expect(place('dock-event')!.textContent).toBe('Round 3 starts at 7:00 PM')
    expect(screen.queryByText('Register for the open')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'One event bar fewer' }))
    expect(slots()).toEqual(['dock-action', 'dock-event', 'tab-bar'])
    expect(place('dock-action')!.textContent).toBe('Register for the open')
    expect(place('dock-event')!.childNodes).toHaveLength(0)
  })

  it('counts an event bar drawn while there is no dock, so as the dock comes the event bar has its place and the action bar\'s place is not drawn', () => {
    const resize = stubWindow({ width: 1023, height: 844 })
    drawBars(
      '/clubs',
      <>
        <DockBar kind="action">
          <p>Register for the open</p>
        </DockBar>
        <DockBar kind="event">
          <p>Round 3 starts at 7:00 PM</p>
        </DockBar>
      </>,
    )
    expect(dockEl()).toBeNull()
    resize({ width: 360, height: 844 })
    expect([...dockEl()!.children].map((el) => el.getAttribute('data-slot'))).toEqual(['dock-event', 'tab-bar'])
    expect(place('dock-event')!.textContent).toBe('Round 3 starts at 7:00 PM')
    expect(screen.queryByText('Register for the open')).toBeNull()
  })
})

// ── The keyboard's rule at its edges ───────────────────────────────────────

describe('the on-screen keyboard\'s rule at its edges', () => {
  it('reads a visual viewport a fraction of a pixel more than 150 pixels shorter than the window as the keyboard open, and one a fraction less as shut', () => {
    const layout = window.innerHeight
    const resize = stubVisualViewport(layout)
    drawBars('/clubs')
    resize(layout - KEYBOARD_ROOM + 0.5)
    expect(dockEl()).not.toBeNull()
    resize(layout - KEYBOARD_ROOM - 0.5)
    expect(dockEl()).toBeNull()
    expect(barMenu()).not.toBeNull()
    resize(layout - KEYBOARD_ROOM + 0.5)
    expect(dockEl()).not.toBeNull()
    expect(barMenu()).toBeNull()
  })

  it('never counts a field inside an alert dialog by the focus alone, however deep in it, and counts the page\'s own field once the focus is back on it', () => {
    vi.useFakeTimers()
    drawBars(
      '/clubs',
      <>
        <input aria-label="Find a club" />
        <div role="alertdialog" aria-label="Leave this page?">
          <div>
            <label>
              Your reason
              <textarea />
            </label>
          </div>
        </div>
      </>,
    )
    const focus = (el: HTMLElement) => {
      act(() => el.focus())
      act(() => {
        vi.runAllTimers()
      })
    }
    focus(screen.getByLabelText('Your reason'))
    expect(dockEl(), 'a field in an alert dialog').not.toBeNull()
    focus(screen.getByLabelText('Find a club'))
    expect(dockEl(), 'the page\'s own field').toBeNull()
    focus(screen.getByLabelText('Your reason'))
    expect(dockEl(), 'the alert dialog\'s field again').not.toBeNull()
  })

  it('tells the inputs no keyboard types into, and the fields closed to typing, from those it types into', () => {
    const make = (html: string) => {
      const box = document.createElement('div')
      box.innerHTML = html
      document.body.append(box)
      return box.firstElementChild
    }
    for (const html of ['<input type="color">', '<input type="button" value="Go">', '<input type="reset">', '<input type="image" alt="Go">', '<input type="hidden">', '<textarea disabled></textarea>', '<input type="search" readonly>', '<input type="email" disabled>', '<span>words</span>']) {
      expect(isTextField(make(html)), html).toBe(false)
    }
    for (const html of ['<input type="SEARCH">', '<input type="Email">', '<input type="datetime-local">', '<input type="month">', '<div contenteditable="plaintext-only"></div>', '<div contenteditable=""></div>']) {
      expect(isTextField(make(html)), html).toBe(true)
    }
    document.body.innerHTML = ''
  })
})

// ── One open state as the window changes ───────────────────────────────────

describe('the one sheet, open as the window changes, and where Esc then gives the focus', () => {
  it('opened by the app bar\'s Menu button in the reflow fallback, stays open as the window grows tall, the Menu tab then reading Close and naming it; Esc gives the focus to the Menu tab, the button that opened the sheet having gone with the fallback', async () => {
    const resize = stubWindow({ width: 667, height: 375 })
    drawBars('/clubs')
    expect(dockEl()).toBeNull()
    press(barMenu()!)
    const sheet = await openedSheet()
    resize({ width: 375, height: 667 })
    expect(dockEl()).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBe(sheet)
    expect(barMenu(), 'the app bar beside the tab bar, its Menu button gone').toBeNull()
    const tab = menuTab()!
    expect([nameOf(tab), tab.getAttribute('aria-expanded'), tab.getAttribute('aria-controls')]).toEqual(['Close', 'true', sheet.id])
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menuTab()))
    expect([nameOf(menuTab()!), menuTab()!.getAttribute('aria-expanded')]).toEqual(['Menu', 'false'])
  })

  it('opened by the Menu tab, stays open as the window turns on its side into the reflow fallback, drawn over the whole window with the app bar\'s Menu button saying it is open; Esc gives the focus to that button, the Menu tab having gone with the dock', async () => {
    const resize = stubWindow({ width: 375, height: 667 })
    drawBars('/scholastic')
    press(menuTab()!)
    const sheet = await openedSheet()
    expect(written(), 'the dock\'s height written while it is drawn').not.toBe('')
    resize({ width: 667, height: 375 })
    expect(dockEl()).toBeNull()
    expect(written(), 'no dock, no room kept for it, so the sheet runs to the window\'s foot').toBe('')
    expect(screen.getByRole('dialog', { name: 'Menu' })).toBe(sheet)
    const button = barMenu()!
    expect([nameOf(button), button.getAttribute('aria-expanded'), button.getAttribute('aria-controls')]).toEqual(['Menu', 'true', sheet.id])
    expect(banner().querySelector('[data-slot="app-bar-section"]'), 'no section\'s name where no tab bar is drawn').toBeNull()
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(barMenu()))
  })

  it('opened by the tablet header\'s Menu button, stays open as the window narrows below 768 pixels, as the sheet above the dock; Esc gives the focus to the Menu tab', async () => {
    const resize = stubWindow({ width: 900, height: 844 })
    drawBars('/clubs')
    expect(banner().getAttribute('data-form')).toBe('tablet')
    press(barMenu()!)
    await openedSheet()
    expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('drawer')
    resize({ width: 390, height: 844 })
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('full'))
    const sheet = await openedSheet()
    expect(nameOf(menuTab()!)).toBe('Close')
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menuTab()))
  })

  it('opened by the Menu tab, stays open as the window widens past 768 pixels, as the tablet header\'s drawer; Esc gives the focus to the tablet header\'s Menu button', async () => {
    const resize = stubWindow({ width: 390, height: 844 })
    drawBars('/clubs')
    press(menuTab()!)
    await openedSheet()
    resize({ width: 900, height: 844 })
    expect(dockEl()).toBeNull()
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Menu' }).getAttribute('data-shape')).toBe('drawer'))
    const sheet = await openedSheet()
    const menu = barMenu()!
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })
})

describe('the one sheet as the window widens straight into the desktop form', () => {
  it.each([
    ['the Menu tab at 390 pixels', { width: 390, height: 844 }, { width: 1280, height: 844 }],
    ['the Menu tab at 744 by 1133, a small tablet held upright, turned on its side', { width: 744, height: 1133 }, { width: 1133, height: 744 }],
    ['the app bar\'s Menu button in the reflow fallback', { width: 667, height: 375 }, { width: 1180, height: 820 }],
  ] as const)('opened by %s, closes as the window reaches the desktop form, with the focus on the desktop header\'s brand link, never the page\'s body', async (_, from, to) => {
    const resize = stubWindow(from)
    drawBars('/clubs')
    const opener = menuTab() ?? barMenu()!
    press(opener)
    await openedSheet()
    resize(to)
    expect(banner().getAttribute('data-form')).toBe('desktop')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The way back ends on the brand link of the banner then drawn, as it does when the tablet header's drawer closes at 1024.
    await waitFor(() => expect(document.activeElement).toBe(banner().querySelector('[data-slot="site-header-brand"]')))
    expect(document.activeElement).not.toBe(document.body)
  })

  it('opened by the tablet header\'s Menu button, closes as the window reaches 1024 pixels with the focus on the brand link, the way the one sheet closes from the drawer', async () => {
    const resize = stubWindow({ width: 900, height: 844 })
    drawBars('/clubs')
    press(barMenu()!)
    await openedSheet()
    resize({ width: 1280, height: 844 })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(banner().querySelector('[data-slot="site-header-brand"]')))
  })
})

// ── The tab bar's parts ────────────────────────────────────────────────────

describe('the account tab as the sign-in answer arrives', () => {
  it('reads Log in while the answer is on its way, My LCA, a link to /dashboard that hands nothing on, once it says the person is signed in, and Log in again once they are signed out', () => {
    const tree = (auth: AuthContextValue) => (
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clubs']}>
          <DockProvider>
            <Routes>
              <Route path="*" element={<Where />} />
            </Routes>
            <BottomDock />
          </DockProvider>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    const view = render(tree(visitor(true, true)))
    expect(tabs().map(nameOf)).toEqual(['Tournaments', 'Clubs', 'Log in', 'Menu'])
    view.rerender(tree(visitor(true)))
    expect(tabs().map(nameOf)).toEqual(['Tournaments', 'Clubs', 'My LCA', 'Menu'])
    const account = tabs()[2]
    expect(account.getAttribute('href')).toBe('/dashboard')
    // The same icon in the same place either way.
    expect(account.querySelector('svg')!.getAttribute('class')).toContain('lucide-user')
    view.rerender(tree(visitor(false)))
    expect(tabs().map(nameOf)).toEqual(['Tournaments', 'Clubs', 'Log in', 'Menu'])
    expect(tabs()[2].getAttribute('href')).toBe('/login')
  })
})

describe('the tab bar\'s icons', () => {
  it('draws for each tab the lucide icon its name in src/lib/nav.ts stands for, one each, hidden from screen readers, signed out and signed in', () => {
    const icons = { trophy: 'lucide-trophy', users: 'lucide-users', user: 'lucide-user', menu: 'lucide-menu' } as const
    for (const signedIn of [false, true]) {
      render(
        <AuthContext.Provider value={visitor(signedIn)}>
          <MemoryRouter initialEntries={['/']}>
            <DockProvider>
              <BottomDock />
            </DockProvider>
          </MemoryRouter>
        </AuthContext.Provider>,
      )
      const drawn = tabs()
      expect(drawn).toHaveLength(4)
      navTabs(signedIn).forEach((tab, i) => {
        const svgs = drawn[i].querySelectorAll('svg')
        expect(svgs, tab.id).toHaveLength(1)
        expect(svgs[0].getAttribute('class')!.split(/\s+/), tab.id).toContain(icons[tab.icon])
        expect(svgs[0].getAttribute('aria-hidden'), tab.id).toBe('true')
      })
      cleanup()
    }
  })
})

describe('the tab bar outside the dock\'s provider', () => {
  it('draws its Menu tab as a button that opens nothing, says it is shut and names nothing, and its three links still go to their pages', () => {
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="*" element={<Where />} />
          </Routes>
          <BottomTabs />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const menu = menuTab()!
    expect(menu.disabled).toBe(true)
    expect([menu.getAttribute('aria-expanded'), menu.hasAttribute('aria-controls'), nameOf(menu)]).toEqual(['false', false, 'Menu'])
    fireEvent.click(menu)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(nameOf(menu)).toBe('Menu')
    fireEvent.click(within(tabBar()!).getByRole('link', { name: 'Clubs' }))
    expect(screen.getByTestId('where').textContent).toBe('/clubs')
  })
})

describe('the app bar where no tab bar is drawn', () => {
  it.each(['/membership/success', '/donate/success', '/Donate/Success/'])('on %s, a page of a section the Menu tab stands for that hides the tab bar, names no section and draws its Menu button', (path) => {
    drawBars(path)
    expect(dockEl()).toBeNull()
    expect(banner().querySelector('[data-slot="app-bar-section"]')).toBeNull()
    expect(nameOf(barMenu()!)).toBe('Menu')
  })

  it('in the reflow fallback names no section, though the Menu tab would stand for the page, and names it again once the window is tall', () => {
    const resize = stubWindow({ width: 299, height: 640 })
    drawBars('/news')
    expect(dockEl()).toBeNull()
    expect(banner().querySelector('[data-slot="app-bar-section"]')).toBeNull()
    expect(barMenu()).not.toBeNull()
    resize({ width: 300, height: 640 })
    expect(dockEl()).not.toBeNull()
    expect(banner().querySelector('[data-slot="app-bar-section"]')!.textContent).toBe('News')
    expect(barMenu()).toBeNull()
  })
})

describe('the current tab\'s bar and its ground', () => {
  it('lies on the tab bar\'s own surface, with the look\'s hairline above: no element between the bar and the tab bar has a ground of its own, and the bar has no colour but its line', () => {
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={['/tournaments']}>
          <DockProvider>
            <BottomDock />
          </DockProvider>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const nav = tabBar()!
    const marks = nav.querySelectorAll<HTMLElement>('[data-slot="tab-mark"]')
    expect(marks).toHaveLength(1)
    const mark = marks[0]
    const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
    expect(classes(nav)).toEqual(expect.arrayContaining(['bg-surface', 'border-t', 'border-hairline']))
    for (let el = mark.parentElement; el && el !== nav; el = el.parentElement) {
      expect(classes(el).filter((c) => /(^|:)bg-/.test(c)), el.tagName).toEqual([])
    }
    // Its colours: the light look's gold-ink line and the gold-ink token in dark mode, and no ground and no words.
    expect(classes(mark).filter((c) => /#[0-9a-f]{3,8}\b|gold|ink|surface|hairline|navy|white|black/i.test(c)).sort()).toEqual(['border-t-[#866a1e]', 'dark:border-t-gold-ink'])
    expect(classes(mark).filter((c) => /(^|:)(bg|text|fill|stroke)-/.test(c))).toEqual([])
    expect(mark.textContent).toBe('')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
  })
})
