// @vitest-environment jsdom
//
// The whole site, src/App.tsx, drawn as a visitor gets it, with the window's
// width given through a stand-in for matchMedia, which jsdom lacks, so the
// new chrome's three bars are read inside the page frame they sit in. The
// unit tests that draw the whole site without a width
// (test/unit/app-frame.test.tsx and its edges) see the phone's app bar
// alone; here each width draws its own bar:
//
// - with the chrome on (newNav and newLook), at 1280, 1023, 900, 768, 767,
//   390 and 320 pixels: one header, the page's banner, after the skip link
//   and before the main, the desktop header from 1024, the tablet header
//   from 768 and the app bar below; what a keyboard reaches first is the
//   skip link, then the brand link, named for the home page, then the bar's
//   own controls in the order each bar has them;
// - --header-h on the page's root, the bar's own height, 64 or 56 pixels;
// - with every switch off, with newNav on alone and with newLook on alone,
//   today's header at every width, no skip link, no tablet form, no app bar
//   and no --header-h;
// - nothing of the Menu sheet in the page until Menu is pressed.
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newNav: false, newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newNav() {
        return flags.newNav
      },
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getAnnouncements: async () => ({ announcements: [] }) }))
vi.mock('@/pages/SupportPage', () => ({ SupportPage: () => <h1>The support page</h1> }))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

const HOME = 'Louisiana Chess Association, home'

const visitor = {
  user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
  assuranceLevel: null, mfaRequired: false, loading: false, memberLoading: false, directedTournamentIds: [], signOut: async () => {},
  impersonating: null, exitImpersonation: async () => {},
} as unknown as AuthContextValue

/** A stand-in for the browser's media query: it answers each min-width query from the window's width. */
function stubWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      const line = /^\(min-width: (\d+)px\)$/.exec(query)
      return line !== null && width >= Number(line[1])
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** jsdom lays nothing out, so each bar's height is given: what offsetHeight reads for it. */
function barHeights() {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    const slot = this.getAttribute('data-slot')
    return slot === 'site-header' ? 64 : slot === 'app-bar' ? 56 : 0
  })
}

/** The whole site at an address, once its page has arrived. */
async function site(path = '/support'): Promise<HTMLElement> {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={visitor}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByRole('heading', { level: 1, name: 'The support page' })
  return view!.container
}

/** What Tab reaches, in the order of the page: every link, button and field, and anything with a tabindex of 0 or more. */
const tabStops = (root: Element) =>
  [...root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && !el.closest('[hidden]'),
  )
/** A stop's name, as a screen reader would read it out. */
const nameOf = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
const follows = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  flags.newNav = false
  flags.newLook = false
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--header-h')
})

describe('with the chrome on, each width\'s bar inside the page frame', () => {
  /** Each width, the bar it draws, the bar's height, and its own controls after the brand link, signed out. */
  const WIDTHS = [
    [1280, 'desktop', '64px', ['Tournaments', 'Clubs', 'Scholastic', 'News', 'Membership', 'About', 'Donate', 'Log in', 'Join LCA']],
    [1023, 'tablet', '64px', ['Tournaments', 'Clubs', 'Donate', 'Log in', 'Menu']],
    [900, 'tablet', '64px', ['Tournaments', 'Clubs', 'Donate', 'Log in', 'Menu']],
    [768, 'tablet', '64px', ['Tournaments', 'Clubs', 'Donate', 'Log in', 'Menu']],
    [767, 'app bar', '56px', ['Menu']],
    [390, 'app bar', '56px', ['Menu']],
    [320, 'app bar', '56px', ['Menu']],
  ] as const

  beforeEach(() => {
    flags.newNav = true
    flags.newLook = true
  })

  it.each(WIDTHS)('at %i pixels, the %s: one header after the skip link and before the main, the skip link then the brand link first, then the bar\'s own controls, and --header-h %s', async (width, bar, height, controls) => {
    stubWidth(width)
    barHeights()
    const container = await site()
    const headers = container.querySelectorAll('header')
    expect(headers).toHaveLength(1)
    const [header] = headers
    expect(screen.getAllByRole('banner')).toEqual([header])
    expect(bar === 'app bar' ? header.getAttribute('data-slot') : header.getAttribute('data-form')).toBe(bar === 'app bar' ? 'app-bar' : bar)
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    const main = container.querySelector('main')!
    expect(follows(skip, header)).toBe(true)
    expect(follows(header, main)).toBe(true)
    // What a keyboard reaches: the skip link, the brand link, then the bar's own controls, then the page.
    const stops = tabStops(container)
    expect(stops[0]).toBe(skip)
    expect(stops[1]).toBe(within(header).getByRole('link', { name: HOME }))
    expect(stops.slice(2, 2 + controls.length).map(nameOf)).toEqual([...controls])
    expect(stops.slice(2, 2 + controls.length).every((el) => header.contains(el))).toBe(true)
    expect(header.contains(stops[2 + controls.length])).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--header-h')).toBe(height)
    // Nothing of the sheet until Menu is pressed.
    expect(document.querySelector('[data-slot="menu-sheet"], [data-slot="menu-sheet-scrim"]')).toBeNull()
  })
})

describe('with the chrome off, today\'s header at every width', () => {
  it.each([
    ['every switch off', false, false],
    ['newNav on alone', true, false],
    ['newLook on alone', false, true],
  ])('%s: today\'s header at 1280, 900 and 390 pixels, with no skip link, no tablet form, no app bar and no --header-h', async (_, newNav, newLook) => {
    flags.newNav = newNav
    flags.newLook = newLook
    for (const width of [1280, 900, 390]) {
      stubWidth(width)
      barHeights()
      const container = await site()
      const headers = container.querySelectorAll('header, nav')
      // Today's header is the one element before the main that holds the brand link, More and the menu button.
      expect(screen.getAllByRole('banner'), `${width}`).toHaveLength(1)
      const banner = screen.getByRole('banner')
      expect(banner.getAttribute('data-slot'), `${width}`).toBeNull()
      expect(banner.getAttribute('data-form'), `${width}`).toBeNull()
      expect(within(banner).getByRole('button', { name: 'More' }), `${width}`).toBeTruthy()
      expect(within(banner).getByRole('button', { name: 'Open menu' }), `${width}`).toBeTruthy()
      expect(headers.length, `${width}`).toBeGreaterThan(0)
      expect(container.querySelector('[data-slot="app-bar"], [data-slot="site-header"], [data-skip-link]'), `${width}`).toBeNull()
      expect(document.documentElement.style.getPropertyValue('--header-h'), `${width}`).toBe('')
      cleanup()
    }
  })
})
