// @vitest-environment jsdom
//
// test/a11y/chrome.ts's selectors, SITE, as the code a spec runs inside the
// page reads them: by the page's first match, as document.querySelector
// finds it. src/App.tsx is drawn whole, as a visitor gets it, with what is
// drawn above the header there (the impersonation banner, an announcement
// and, with the chrome's switches on, the skip link), on the contact page
// and on the accessibility build's fixture page, which draws a header of
// its own inside the main. On each, with the switches off and on:
//
// - the first match of SITE.header is the site's header: the one header
//   outside the main, holding the brand link, after everything drawn above
//   it, which draws no header of its own; every other header is the page's,
//   inside the main
// - SITE.footer matches one footer, the site's, outside the main and after it
// - the header, the brand link and the footer each hold the role the
//   helper's locators find them by
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SITE } from '../a11y/chrome'

const flags = vi.hoisted(() => ({ newLook: false, newNav: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
      get newNav() {
        return flags.newNav
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
/** One made-up announcement, so the banner is drawn above the header. */
const NOTICE = 'A made-up notice: the fixture open moves to Saturday, November 7, 2026 at 7:00 PM.'
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>()
  const { heritageApi } = await import('./helpers/heritageAnswers')
  return {
    ...real,
    ...heritageApi,
    getAnnouncements: async () => ({ announcements: [{ id: 'fx-notice', message: NOTICE, linkUrl: null, linkLabel: null, tone: 'gold', size: 'default' }] }),
  }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

/** Who is viewing: an admin viewing the site as a made-up member, so the impersonation banner is drawn too. */
const VIEWING_AS = 'Viewing as Fixture Member'

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-29T12:00:00-05:00'))
})
afterAll(() => {
  vi.useRealTimers()
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.resetModules()
  flags.newLook = false
  flags.newNav = false
})

/**
 * The whole site at an address, drawn by an App loaded for the build's mode:
 * the accessibility build's ("a11y") has the fixture pages, every other
 * build drops them.
 */
async function site(path: string, mode: 'test' | 'a11y'): Promise<void> {
  if (mode === 'a11y') vi.stubEnv('MODE', 'a11y')
  vi.resetModules()
  const { default: App } = await import('@/App')
  const { AuthContext } = await import('@/contexts/auth-context')
  const { visitor } = await import('./helpers/heritagePages')
  const auth = { ...visitor(), impersonating: { id: 'fx-member', fullName: 'Fixture Member', email: 'fixture.member@example.org' }, exitImpersonation: async () => {} }
  const tree: ReactElement = (
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  await act(async () => {
    render(tree)
  })
}

/** Whether `a` comes before `b` in the page. */
const before = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

/** What the page's first matches of SITE's selectors find, and what is around them. */
function readChrome() {
  const main = document.querySelector('main')!
  const headers = [...document.querySelectorAll(SITE.header)]
  const footers = [...document.querySelectorAll(SITE.footer)]
  const first = document.querySelector(SITE.header)!
  return { main, headers, footers, first, footer: document.querySelector(SITE.footer)! }
}

const PAGES = [
  { name: 'the contact page', path: '/contact', mode: 'test' as const, heading: 'Contact us', pageHeaders: 0 },
  { name: 'the fixture page', path: '/__fixtures/base', mode: 'a11y' as const, heading: 'Fixture: base', pageHeaders: 1 },
]

describe.each([
  ['every switch off', false],
  ['the chrome\'s switches on', true],
])('the page\'s first header and its one footer, with %s', (_state, chrome) => {
  it.each(PAGES)('$name: SITE.header finds the site\'s header first, after what is drawn above it, and SITE.footer the site\'s footer alone', async ({ path, mode, heading, pageHeaders }) => {
    flags.newLook = chrome
    flags.newNav = chrome
    await site(path, mode)
    await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 10_000 })
    const notice = await screen.findByText(NOTICE)
    const viewing = screen.getByText(new RegExp(VIEWING_AS))
    const { main, headers, footers, first, footer } = readChrome()

    // The site's header: the first header in the page, outside the main, with the brand link, after the banners.
    expect(headers).toHaveLength(1 + pageHeaders)
    expect(first).toBe(headers[0])
    expect(main.contains(first)).toBe(false)
    expect(before(first, main)).toBe(true)
    expect(first.querySelector(SITE.brandLink)).not.toBeNull()
    for (const above of [notice, viewing]) {
      expect(before(above, first), above.textContent ?? '').toBe(true)
      expect(above.closest(SITE.header), above.textContent ?? '').toBeNull()
    }
    const skip = document.querySelector('[data-skip-link]')
    if (chrome) {
      expect(skip).not.toBeNull()
      expect(before(skip!, first)).toBe(true)
      expect(skip!.closest(SITE.header)).toBeNull()
    } else {
      expect(skip).toBeNull()
    }
    // Every other header is the page's own, inside the main.
    for (const own of headers.slice(1)) expect(main.contains(own)).toBe(true)

    // The site's footer: the one footer, outside the main and after it.
    expect(footers).toEqual([footer])
    expect(main.contains(footer)).toBe(false)
    expect(before(main, footer)).toBe(true)

    // The roles the helper's locators find them by.
    expect(screen.getAllByRole('banner')).toContain(first)
    expect(screen.getByRole('contentinfo')).toBe(footer)
    expect(first.querySelector(SITE.brandLink)!.getAttribute('href')).toBe('/')
  }, 30_000)
})
