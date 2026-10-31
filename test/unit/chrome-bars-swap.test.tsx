// @vitest-environment jsdom
//
// Navbar with the chrome on (newNav and newLook) as the window crosses 768
// and 1024 pixels while something a bar opened is still open, the window's
// width given through a stand-in for matchMedia, which jsdom lacks. What the
// bars open is a modal dialog on the site's dialog primitive, the Menu sheet
// or the donation dialog, which holds the page behind it while it is open
// (its scroll, presses outside it, what screen readers hear), so the page
// must be given back whole however the dialog goes:
//
// - the phone's sheet open as the window widens past 768: the app bar goes
//   with it, the tablet header comes, and no dialog and no hold is left;
// - the tablet's drawer open as the window widens past 1024 or narrows
//   past 768: the drawer closes, the header kept across 1024 and the app bar
//   drawn below 768, and the page given back;
// - the donation dialog open from the tablet header as the window narrows
//   below 768, and from the sheet's Donate as it widens past 768: the same;
// - across 1024 the header is the same element, so the donation dialog and
//   an open My LCA menu stay open as its form changes, and the dialog still
//   hands the focus back to Donate when it closes;
// - the sheet's Donate handed on to the bar's donation dialog: once the
//   dialog closes the page is given back and the focus is on Menu.
//
// The bars are drawn here as Navbar draws them, without the dock's provider
// the page frame puts round them since WS02 step 7, so each bar holds its
// own sheet, the app bar keeps its Menu button, and a sheet still goes with
// the bar that drew it; the one sheet that stays open across 768 pixels is
// test/unit/bottom-dock.test.tsx's to show, and the browser's.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
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
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { Navbar } = await import('@/components/layout/Navbar')

const DIALOG = 'Support the Louisiana Chess Association'

function visitor(signedIn = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-swap' } as User) : null,
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

/** A stand-in for the browser's media query: it answers each min-width query from the window's width, and can say the width changed. */
function stubWidth(px: number) {
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

function drawNavbar(auth = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/clubs']}>
        <Navbar />
        <main>
          <h1>Clubs</h1>
          <a href="#list">The list of clubs</a>
        </main>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const banner = () => screen.getByRole('banner')
const bar = () => within(banner())
/** The bar drawn: the new header's form, or the app bar's slot. */
const drawn = () => banner().getAttribute('data-form') ?? banner().getAttribute('data-slot')

/** How the dialog primitive holds the page while a dialog is open: its scroll, presses outside the dialog, and what screen readers hear. */
function pageHold() {
  return {
    scrollHeld: document.body.hasAttribute('data-scroll-locked'),
    pressesStopped: document.body.style.pointerEvents === 'none',
    hiddenFromScreenReaders: document.querySelectorAll('[data-aria-hidden], [aria-hidden="true"]:not(svg, svg *)').length > 0,
  }
}
const HELD = { scrollHeld: true, pressesStopped: true, hiddenFromScreenReaders: true }
const FREE = { scrollHeld: false, pressesStopped: false, hiddenFromScreenReaders: false }

/** The page is the page again: the bar and the page's own link are heard, and nothing of a dialog is left. */
async function givenBack() {
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(pageHold()).toEqual(FREE))
  expect(screen.getAllByRole('banner')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'The list of clubs' })).toBeTruthy()
  expect(document.querySelector('[data-slot="menu-sheet"], [data-slot="menu-sheet-scrim"]')).toBeNull()
}

/** Presses a control as a person does: the focus on it, then the press. */
function press(control: HTMLElement) {
  control.focus()
  fireEvent.click(control)
  return control
}

/** Opens the sheet from the bar's Menu button and waits until its close control has the focus. */
async function openSheet() {
  const menu = press(bar().getByRole('button', { name: 'Menu' }))
  const sheet = await screen.findByRole('dialog', { name: 'Menu' })
  await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
  expect(pageHold()).toEqual(HELD)
  return { menu, sheet }
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--header-h')
})

describe('the sheet or the drawer open as the window crosses a line', () => {
  it('the phone\'s sheet open as the window widens past 768: the app bar goes with it, the tablet header comes, and the page is given back', async () => {
    const resize = stubWidth(390)
    drawNavbar()
    expect(drawn()).toBe('app-bar')
    await openSheet()
    resize(900)
    expect(drawn()).toBe('tablet')
    await givenBack()
    // The tablet header's own Menu opens its drawer, and closes it, as ever.
    const { menu, sheet } = await openSheet()
    expect(sheet.getAttribute('data-shape')).toBe('drawer')
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await givenBack()
    await waitFor(() => expect(document.activeElement).toBe(menu))
  })

  it('the tablet\'s drawer open as the window widens past 1024: the drawer closes, the header is kept in its desktop form, and the page is given back', async () => {
    const resize = stubWidth(1023)
    drawNavbar()
    const kept = banner()
    await openSheet()
    resize(1024)
    expect(drawn()).toBe('desktop')
    expect(banner()).toBe(kept)
    await givenBack()
    expect(bar().queryByRole('button', { name: 'Menu' })).toBeNull()
  })

  it('the tablet\'s drawer open as the window narrows past 768: the tablet header goes with it, the app bar comes, and the page is given back', async () => {
    const resize = stubWidth(900)
    drawNavbar()
    await openSheet()
    resize(767)
    expect(drawn()).toBe('app-bar')
    await givenBack()
    // The app bar's own Menu opens the sheet over the whole window.
    const { sheet } = await openSheet()
    expect(sheet.getAttribute('data-shape')).toBe('full')
  })

  it('the drawer open at 1023, the window narrowed straight to a phone\'s and widened straight back: no dialog or hold left at any step', async () => {
    const resize = stubWidth(1023)
    drawNavbar()
    await openSheet()
    resize(320)
    expect(drawn()).toBe('app-bar')
    await givenBack()
    await openSheet()
    resize(1440)
    expect(drawn()).toBe('desktop')
    await givenBack()
  })
})

describe('the donation dialog open as the window crosses a line', () => {
  it('opened from the tablet header\'s Donate as the window narrows below 768: it goes with the header, and the page is given back', async () => {
    const resize = stubWidth(900)
    drawNavbar()
    press(bar().getByRole('button', { name: 'Donate' }))
    await screen.findByRole('dialog', { name: DIALOG })
    expect(pageHold()).toEqual(HELD)
    resize(390)
    expect(drawn()).toBe('app-bar')
    await givenBack()
  })

  it('opened from the sheet\'s Donate as the window widens past 768: it goes with the app bar, and the page is given back', async () => {
    const resize = stubWidth(390)
    drawNavbar()
    const { sheet } = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Donate' }))
    await screen.findByRole('dialog', { name: DIALOG })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull())
    expect(pageHold()).toEqual(HELD)
    resize(900)
    expect(drawn()).toBe('tablet')
    await givenBack()
  })

  it('opened at 1280 stays open as the window narrows past 1024, the header the same element, and gives the focus back to Donate when it closes', async () => {
    const resize = stubWidth(1280)
    drawNavbar()
    const kept = banner()
    const donate = press(bar().getByRole('button', { name: 'Donate' }))
    const dialog = await screen.findByRole('dialog', { name: DIALOG })
    resize(1023)
    // The page behind the dialog, its header among it, is hidden from screen readers while the dialog is open.
    const header = screen.getByRole('banner', { hidden: true })
    expect(header).toBe(kept)
    expect(header.getAttribute('data-form')).toBe('tablet')
    expect(screen.getByRole('dialog', { name: DIALOG })).toBe(dialog)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await givenBack()
    await waitFor(() => expect(document.activeElement).toBe(donate))
    expect(donate.isConnected).toBe(true)
  })
})

describe('an open My LCA menu as the window crosses 1024', () => {
  it('stays open, the header the same element and the menu\'s rows as they were', async () => {
    const resize = stubWidth(1280)
    drawNavbar(visitor(true))
    const kept = banner()
    const myLca = bar().getByRole('button', { name: 'My LCA' })
    fireEvent.click(myLca)
    expect(myLca.getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(myLca.getAttribute('aria-controls')!)!
    const rows = [...panel.querySelectorAll('a, button')].map((el) => el.textContent)
    resize(1023)
    expect(drawn()).toBe('tablet')
    expect(banner()).toBe(kept)
    expect(bar().getByRole('button', { name: 'My LCA' })).toBe(myLca)
    expect(myLca.getAttribute('aria-expanded')).toBe('true')
    expect([...document.getElementById(myLca.getAttribute('aria-controls')!)!.querySelectorAll('a, button')].map((el) => el.textContent)).toEqual(rows)
  })
})

describe('the sheet\'s Donate handed on to the bar\'s donation dialog', () => {
  it.each([
    [390, 'app-bar'],
    [900, 'tablet'],
  ] as const)('at %i pixels, from the %s: the page is given back once the dialog closes, and the focus is on Menu', async (width, form) => {
    stubWidth(width)
    drawNavbar()
    expect(drawn()).toBe(form)
    const { menu, sheet } = await openSheet()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Donate' }))
    const dialog = await screen.findByRole('dialog', { name: DIALOG })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull())
    expect(pageHold()).toEqual(HELD)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await givenBack()
    await waitFor(() => expect(document.activeElement).toBe(menu))
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })
})
