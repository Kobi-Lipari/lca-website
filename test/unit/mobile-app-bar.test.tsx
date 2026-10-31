// @vitest-environment jsdom
//
// The phone's app bar, src/components/layout/MobileAppBar.tsx (WS02 step 6),
// drawn under a router and a sign-in context, with the switches it reads set
// through a mocked FEATURES:
//
// - one <header>, the page's banner, on the brand navy read through its
//   variable and never a navy band class or data-ground, with
//   data-ring-ground="navy", 56 pixels high, sticky and no border;
// - the brand link to the home page named "Louisiana Chess Association,
//   home", the rook mark at 28 pixels hidden from screen readers, and the
//   two-line name beside it, with no image;
// - the bordered Menu button, named Menu and nothing more, telling a screen
//   reader it opens a dialog, and no nav, Search or section name yet;
// - --header-h on the page's root while the bar is drawn: 56 pixels,
//   following its height, and taken off when it goes;
// - the Menu sheet: its code fetched on the first press of Menu, over the
//   whole window, the button expanded and naming it while it is open, and
//   closed on Esc, by a row followed or by any change of page, the focus
//   back on Menu;
// - the sheet's Donate: the donation dialog the bar draws for it, with the
//   focus back on Menu once it closes, put there without scrolling the page,
//   or a link to /give with newMembership on.
//
// The sheet's own rows are test/unit/mobile-menu.test.tsx, and what the bar
// does when a file it fetches cannot be had, test/unit/on-demand.test.tsx.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
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
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { MobileAppBar } = await import('@/components/layout/MobileAppBar')

const ROOT = join(__dirname, '../..')
const HOME = 'Louisiana Chess Association, home'
const DIALOG = 'Support the Louisiana Chess Association'

function visitor(signedIn = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-app-bar' } as User) : null,
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

/** Writes out where the page is, and gives a way to change it from outside the bar. */
function Where() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>
      <button type="button" onClick={() => navigate('/clubs')}>
        Go to the clubs page
      </button>
    </>
  )
}

function draw(path = '/', auth = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <MobileAppBar />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const header = () => screen.getByRole('banner')
const bar = () => within(header())
const menuButton = () => bar().getByRole('button', { name: 'Menu' })
const where = () => screen.getByTestId('where').textContent

/** Presses Menu as a person does: the focus on it, then the press. */
function pressMenu() {
  const menu = menuButton()
  menu.focus()
  fireEvent.click(menu)
  return menu
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

describe('the app bar and its brand link', () => {
  it('is one header, the page\'s banner, on the brand navy through its variable, with the navy ring ground, 56 pixels high, sticky and no border', () => {
    const { container } = draw()
    const headers = container.querySelectorAll('header')
    expect(headers).toHaveLength(1)
    expect(header()).toBe(headers[0])
    expect(header().getAttribute('data-slot')).toBe('app-bar')
    expect(header().getAttribute('data-ring-ground')).toBe('navy')
    const classes = header().className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['sticky', 'top-0', 'z-50', 'h-14', 'bg-(--color-brand-navy)', 'text-white', 'print:hidden']))
    expect(classes.filter((c) => /^border/.test(c))).toEqual([])
    // No navy band class, no lca-navy and no data-ground on it or inside it, whose ring rules outrank the sheet's own.
    for (const el of [header(), ...header().querySelectorAll('*')]) {
      const own = (el.getAttribute('class') ?? '').split(/\s+/)
      expect(own.filter((c) => /(^|:)bg-(brand|lca)-navy\b|lca-navy/.test(c)), el.outerHTML.slice(0, 80)).toEqual([])
      expect(el.hasAttribute('data-ground')).toBe(false)
    }
    // One row, 56 pixels high.
    const row = header().querySelector('[data-slot="app-bar-row"]')!
    expect(row.parentElement).toBe(header())
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'h-14', 'items-center']))
  })

  it('leads with the brand link to the home page, named for it, the rook at 28 pixels hidden from screen readers and the two-line name beside it, with no image', () => {
    draw('/tournaments')
    const link = bar().getByRole('link', { name: HOME })
    expect(link.getAttribute('href')).toBe('/')
    expect(link.getAttribute('aria-label')).toBe(HOME)
    expect(header().querySelector('a')).toBe(link)
    const marks = header().querySelectorAll('[data-slot="lca-mark"]')
    expect(marks).toHaveLength(1)
    expect(link.firstElementChild).toBe(marks[0])
    expect(marks[0].getAttribute('aria-hidden')).toBe('true')
    expect(marks[0].getAttribute('class')!.split(/\s+/)).toContain('size-7')
    expect(header().querySelectorAll('img')).toHaveLength(0)
    expect(within(link).queryAllByRole('img')).toHaveLength(0)
    const name = link.querySelector('[data-slot="app-bar-name"]')!
    expect([...name.children].map((line) => line.textContent)).toEqual(['Louisiana Chess', 'Association'])
    const [first, second] = [...name.children].map((line) => line.className.split(/\s+/))
    expect(first).toEqual(expect.arrayContaining(['text-sm', 'font-bold']))
    expect(second).toEqual(expect.arrayContaining(['text-[11px]', 'font-medium', 'text-white/80']))
    // The rows' aria-current is the sheet's; the brand link carries none.
    expect(link.hasAttribute('aria-current')).toBe(false)
  })

  it('ends with the bordered Menu button, named Menu and nothing more, which says it opens a dialog and controls nothing until it has', () => {
    draw()
    const menu = menuButton()
    expect(menu.textContent).toBe('Menu')
    expect(menu.getAttribute('type')).toBe('button')
    expect(menu.getAttribute('aria-haspopup')).toBe('dialog')
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(menu.hasAttribute('aria-controls')).toBe(false)
    expect(menu.className.split(/\s+/)).toEqual(expect.arrayContaining(['ml-auto', 'min-h-11', 'border-[1.5px]', 'border-white/75', 'rounded-[9px]']))
    // The last control of the row, after the brand link: nothing else in the bar.
    const controls = [...header().querySelectorAll('a, button')]
    expect(controls).toEqual([bar().getByRole('link', { name: HOME }), menu])
  })

  it('draws no nav, no Search and no section name: the tab bar and the rest come with later steps', () => {
    draw('/tournaments')
    expect(bar().queryAllByRole('navigation')).toEqual([])
    expect(bar().queryByRole('button', { name: /search/i })).toBeNull()
    expect(header().textContent).toBe('Louisiana ChessAssociationMenu')
  })
})

// ── The bar's height ───────────────────────────────────────────────────────

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

describe('--header-h', () => {
  /** jsdom lays nothing out, so the bar's height is given: what offsetHeight reads for it. */
  function barHeight(px: () => number) {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'app-bar' ? px() : 0
    })
  }

  it('is the bar\'s height on the page\'s root while it is drawn, 56 pixels, follows it, and goes with it', () => {
    let height = 56
    barHeight(() => height)
    const watchers = stubResizeObserver()
    const { unmount } = draw()
    const root = document.documentElement
    expect(root.style.getPropertyValue('--header-h')).toBe('56px')
    expect(watchers.some((w) => w.watched.includes(header()))).toBe(true)
    height = 60
    act(() => watchers.forEach((w) => w.resized()))
    expect(root.style.getPropertyValue('--header-h')).toBe('60px')
    unmount()
    expect(root.style.getPropertyValue('--header-h')).toBe('')
  })

  it('is written once where there is no ResizeObserver, as here in jsdom', () => {
    barHeight(() => 56)
    const { unmount } = draw()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('56px')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe('')
  })
})

// ── The Menu sheet ─────────────────────────────────────────────────────────

describe('the Menu sheet, from the app bar', () => {
  it('is fetched the first time Menu is pressed: the bar imports the sheet and the donation dialog through import() alone, so neither joins the script every page loads', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/MobileAppBar.tsx'), 'utf8')
    expect(source).not.toMatch(/^import\b[^;]*from '@\/components\/layout\/MobileMenu'/m)
    expect(source).not.toMatch(/^import\b[^;]*from '@\/components\/DonateButton'/m)
    expect(source.match(/\bimport\('@\/components\/layout\/MobileMenu'\)/g)).toHaveLength(1)
    expect(source.match(/\bimport\('@\/components\/DonateButton'\)/g)).toHaveLength(1)
  })

  it('draws nothing of the sheet until Menu is pressed', () => {
    draw()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[data-slot="menu-sheet"]')).toBeNull()
  })

  it('opens over the whole window on Menu, the button expanded and naming it, the focus on Close menu, and Esc closes it with the focus back on Menu', async () => {
    draw('/tournaments')
    const menu = pressMenu()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(sheet.getAttribute('data-shape')).toBe('full')
    // The window from its top to the dock's, which, drawn on its own as here, is unset: the whole window.
    expect(sheet.className.split(/\s+/)).toEqual(expect.arrayContaining(['inset-x-0', 'top-0', 'bottom-[var(--bottom-chrome-h,0px)]']))
    expect(document.documentElement.style.getPropertyValue('--bottom-chrome-h')).toBe('')
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(menu.getAttribute('aria-controls')).toBe(sheet.id)
    expect(sheet.id).not.toBe('')
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    expect(menu.hasAttribute('aria-controls')).toBe(false)
    await waitFor(() => expect(document.activeElement).toBe(menu))
  })

  it('opens again on the next press, drawn once, with its code fetched once', async () => {
    draw()
    pressMenu()
    await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close menu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    pressMenu()
    expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('closes when a row is followed, and the row\'s page opens', async () => {
    draw('/')
    const menu = pressMenu()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('link', { name: /^Scholastic/ }))
    expect(where()).toBe('/scholastic')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => expect(document.activeElement).toBe(menu))
  })

  it('closes when the page changes by any other way while it is open', async () => {
    draw('/tournaments')
    pressMenu()
    await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(screen.getByRole('button', { name: 'Go to the clubs page', hidden: true }))
    expect(where()).toBe('/clubs')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('stays closed after a change of page when it was closed', async () => {
    draw('/tournaments')
    pressMenu()
    await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Go to the clubs page' }))
    expect(where()).toBe('/clubs')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('the sheet\'s Donate, from the app bar', () => {
  it('closes the sheet and opens the donation dialog the bar draws for it, with newMembership off; Esc closes it with the focus back on Menu', async () => {
    draw('/news')
    const menu = pressMenu()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Donate' }))
    const donation = await screen.findByRole('dialog', { name: DIALOG })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Menu' })).toBeNull())
    expect(screen.getAllByRole('dialog')).toEqual([donation])
    const focus = vi.spyOn(menu, 'focus')
    fireEvent.keyDown(donation, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
    // Back on Menu without scrolling the page: the bar is fixed to the top of the window.
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    for (const [options] of focus.mock.calls) expect(options).toEqual({ preventScroll: true })
    expect(where()).toBe('/news')
  })

  it('with newMembership on, is a link to /give that closes the sheet, and no donation dialog is drawn', async () => {
    flags.newMembership = true
    draw('/news')
    pressMenu()
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(within(sheet).queryByRole('button', { name: 'Donate' })).toBeNull()
    const give = within(sheet).getByRole('link', { name: 'Donate' })
    expect(give.getAttribute('href')).toBe('/give')
    fireEvent.click(give)
    expect(where()).toBe('/give')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('dialog', { name: DIALOG })).toBeNull()
  })
})
