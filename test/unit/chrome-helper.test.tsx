// @vitest-environment jsdom
//
// test/a11y/chrome.ts, the one place the browser specs reach the site's
// header and footer, held without a browser:
//
// - its answer to which chrome each test build draws: today's header and
//   today's footer at every width on both builds, the builds being the two
//   test/a11y/global-setup.ts names; a build it does not hold is an error
//   that names it; and its pairs are read from the smallest width up, so a
//   part drawn new from a width on is today's below it, ifToday notes what
//   it did not read there, and the decision onlyToday skips by says so;
// - its selectors, its locators and its names find today's header and
//   footer as Navbar.tsx and Footer.tsx draw them, with newLook off and on:
//   the one banner and the one contentinfo, the brand link, the rook mark
//   and the logo under the new look alone, the Appearance control in the
//   footer under the new look alone, and each name of its two lists in the
//   header, signed out or signed in.
//
// Each WS02 step that draws a new part of the chrome on a test build
// changes DRAWN in test/a11y/chrome.ts and the first block here together.
// The locators are Playwright's, which need a page; here they are handed a
// stand-in for one, which finds in this document what each would find.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render, screen, within, type ByRoleOptions } from '@testing-library/react'
import type { Page, TestInfo } from '@playwright/test'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import {
  CHROME_NAMES, DRAWN, SITE, TODAYS_NAMES, appearanceControl, brandLink, chromeAt, footerImages, footerLogo, headerImages, ifToday,
  rookMark, siteFooter, siteHeader, todayAt, widthOf, type Chrome,
} from '../a11y/chrome'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { Navbar } = await import('@/components/layout/Navbar')
const { Footer } = await import('@/components/layout/Footer')

const ROOT = resolve(__dirname, '../..')
/**
 * The two test builds, by the names test/a11y/global-setup.ts gives them in
 * A11Y_VARIANTS, read from its text: that file finds the repository from its
 * own address, which this test page's address cannot stand in for.
 */
const SETUP = readFileSync(join(ROOT, 'test/a11y/global-setup.ts'), 'utf8')
const VARIANTS = SETUP.slice(SETUP.indexOf('export const A11Y_VARIANTS'), SETUP.indexOf('\n]\n', SETUP.indexOf('export const A11Y_VARIANTS')))
const BUILDS = [...VARIANTS.matchAll(/\{ name: '([\w-]+)'/g)].map((m) => m[1])
/** The widths the specs read the chrome at, and the edges of today's breakpoints. */
const WIDTHS = [320, 390, 639, 640, 767, 768, 1023, 1024, 1279, 1280, 1440]

/** A visitor who is not signed in, as the header sees one. */
const SIGNED_OUT = {
  user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
  assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
} as unknown as AuthContextValue
/** A member who is signed in and holds no role. */
const SIGNED_IN = { ...SIGNED_OUT, user: { id: 'fx-user' } } as unknown as AuthContextValue

/** Today's header, the site's main and today's footer, as the site draws them on the home page. */
function drawChrome(newLook: boolean, auth: AuthContextValue = SIGNED_OUT): HTMLElement {
  flags.newLook = newLook
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
        <main className="flex-1" />
        <Footer />
      </MemoryRouter>
    </AuthContext.Provider>,
  ).container
}

/** What a stand-in locator finds. */
interface Found {
  all: () => Element[]
  locator: (css: string) => Found
  getByRole: (role: string, options?: ByRoleOptions) => Found
}
/** A locator over this document: each one resolves to the elements it finds, as Playwright's would on the page. */
function found(find: () => Element[]): Found {
  return {
    all: find,
    locator: (css) => found(() => find().flatMap((el) => [...el.querySelectorAll(css)])),
    getByRole: (role, options) => found(() => find().flatMap((el) => within(el as HTMLElement).queryAllByRole(role, options))),
  }
}
/** A stand-in for a Playwright page over this document. */
const page = {
  getByRole: (role: string, options?: ByRoleOptions) => found(() => screen.queryAllByRole(role, options)),
  locator: (css: string) => found(() => [...document.querySelectorAll(css)]),
} as unknown as Page
/** What one of the helper's locators finds in this document. */
const all = (locator: unknown): Element[] => (locator as Found).all()

afterEach(() => {
  cleanup()
  flags.newLook = false
})

describe('which chrome each test build draws', () => {
  it('reads the two builds test/a11y/global-setup.ts names, and holds exactly those', () => {
    expect(BUILDS).toEqual(['a11y-on', 'a11y-off'])
    expect(Object.keys(DRAWN)).toEqual(BUILDS)
  })

  it('is today\'s header and today\'s footer at every width on both builds', () => {
    expect(DRAWN).toEqual({
      'a11y-on': { header: [[0, 'today']], footer: [[0, 'today']] },
      'a11y-off': { header: [[0, 'today']], footer: [[0, 'today']] },
    })
    for (const build of BUILDS) {
      for (const part of ['header', 'footer'] as const) {
        for (const width of WIDTHS) expect(chromeAt(build, part, width), `${build}, the ${part} at ${width} pixels`).toBe('today')
        expect(todayAt(build, part, WIDTHS), `${build}, the ${part}`).toBe(true)
      }
    }
  })

  it('throws on a build it does not hold, naming it', () => {
    expect(() => chromeAt('a11y-maybe', 'header', 1280)).toThrow(/a11y-maybe/)
    expect(() => chromeAt('e2e-preview', 'footer', 390)).toThrow(/e2e-preview/)
    expect(() => todayAt('a11y-maybe', 'footer', [390])).toThrow(/a11y-maybe/)
  })

  it('runs what ifToday holds where today\'s chrome is drawn, and adds nothing to the report', async () => {
    for (const build of BUILDS) {
      const testInfo = { project: { name: build }, annotations: [] } as unknown as TestInfo
      let ran = 0
      await ifToday(testInfo, 'header', 1280, 'the header\'s names', () => {
        ran++
      })
      await ifToday(testInfo, 'footer', 390, 'the footer\'s logo', async () => {
        ran++
      })
      expect(ran, build).toBe(2)
      expect(testInfo.annotations, build).toEqual([])
    }
    // The build a spec names wins over its own project's.
    const own = { project: { name: 'a11y-on' }, annotations: [] } as unknown as TestInfo
    await expect(ifToday(own, 'header', 1280, 'the other build\'s header', () => {}, 'a11y-maybe')).rejects.toThrow(/a11y-maybe/)
  })

  it('reads a part\'s pairs from the smallest width up: drawn new from a width on, it is today\'s below it, and ifToday notes what it did not read', async () => {
    // The table as WS02 step 5 will make it on a11y-on, put in place for this case alone.
    const onBuild = DRAWN['a11y-on'] as { header: ReadonlyArray<readonly [number, Chrome]> }
    const kept = onBuild.header
    onBuild.header = [[0, 'today'], [1024, 'new']]
    try {
      expect(WIDTHS.map((width) => chromeAt('a11y-on', 'header', width))).toEqual(WIDTHS.map((width) => (width >= 1024 ? 'new' : 'today')))
      expect(chromeAt('a11y-on', 'footer', 1440)).toBe('today')
      expect(chromeAt('a11y-off', 'header', 1440)).toBe('today')
      expect(todayAt('a11y-on', 'header', [390, 768])).toBe(true)
      expect(todayAt('a11y-on', 'header', [390, 1280])).toBe(false)
      const testInfo = { project: { name: 'a11y-on' }, annotations: [] as { type: string; description?: string }[] } as unknown as TestInfo
      let ran = false
      await ifToday(testInfo, 'header', 1280, 'the brand link\'s name', () => {
        ran = true
      })
      expect(ran).toBe(false)
      expect(testInfo.annotations).toEqual([{ type: 'today only', description: 'the brand link\'s name: not read on a11y-on at 1280 pixels, where the new header is drawn' }])
      // Asked about the other build, whose page a spec may have open, it runs.
      await ifToday(testInfo, 'header', 1280, 'the other build\'s names', () => {
        ran = true
      }, 'a11y-off')
      expect(ran).toBe(true)
    } finally {
      onBuild.header = kept
    }
    expect(chromeAt('a11y-on', 'header', 1440)).toBe('today')
  })

  it('takes a page\'s width from the window a test set, or Desktop Chrome\'s 1280', () => {
    expect(widthOf({ viewportSize: () => ({ width: 390, height: 844 }) } as unknown as Page)).toBe(390)
    expect(widthOf({ viewportSize: () => null } as unknown as Page)).toBe(1280)
  })
})

describe('what the helper finds in today\'s chrome', () => {
  it.each([false, true])('with newLook %s: one header and one footer, by their selectors and by their roles', (newLook) => {
    const container = drawChrome(newLook)
    const headers = container.querySelectorAll(SITE.header)
    const footers = container.querySelectorAll(SITE.footer)
    expect(headers).toHaveLength(1)
    expect(footers).toHaveLength(1)
    expect(headers[0]).toBe(screen.getByRole('banner'))
    expect(footers[0]).toBe(screen.getByRole('contentinfo'))
    expect(all(siteHeader(page))).toEqual([headers[0]])
    expect(all(siteFooter(page))).toEqual([footers[0]])
    // The first four links of the footer, which the heritage pages' check reads, are there to read.
    expect(footers[0].querySelectorAll(SITE.footerLinks).length).toBeGreaterThan(4)
  })

  it.each([false, true])('with newLook %s: the brand link, the header\'s images and the rook mark', (newLook) => {
    const container = drawChrome(newLook)
    const header = container.querySelector(SITE.header)!
    const links = all(brandLink(page))
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/')
    expect(links).toEqual([...header.querySelectorAll(SITE.brandLink)])
    // Under the new look the brand link leads with the mark and the header draws no image; today it draws its one image.
    expect(all(rookMark(page))).toHaveLength(newLook ? 1 : 0)
    expect(all(headerImages(page))).toHaveLength(newLook ? 0 : 1)
    if (newLook) expect(links[0].firstElementChild).toBe(all(rookMark(page))[0])
    expect([...header.querySelectorAll(SITE.mark)]).toEqual(all(rookMark(page)))
  })

  it.each([false, true])('with newLook %s: the footer\'s logo, its images and the Appearance control', (newLook) => {
    const container = drawChrome(newLook)
    const footer = container.querySelector(SITE.footer)!
    expect(all(footerLogo(page))).toHaveLength(newLook ? 1 : 0)
    expect(all(footerImages(page))).toHaveLength(1)
    expect([...footer.querySelectorAll(SITE.logo)]).toEqual(all(footerLogo(page)))
    if (newLook) expect(all(footerLogo(page))[0]).toBe(all(footerImages(page))[0])
    // The control is found on the page, and is the footer's, under the new look alone.
    const groups = all(appearanceControl(page))
    expect(groups).toHaveLength(newLook ? 1 : 0)
    for (const group of groups) expect(footer.contains(group)).toBe(true)
  })

  it('finds each name of its two lists in today\'s header, signed out and signed in, each once, with the role a spec reads it by', () => {
    const ROLES: Record<string, 'link' | 'button'> = { 'Log in': 'link', 'Join LCA': 'link', Clubs: 'link', Profile: 'link', 'Log out': 'button', More: 'button' }
    expect([...Object.values(CHROME_NAMES), ...Object.values(TODAYS_NAMES)].sort()).toEqual(Object.keys(ROLES).sort())
    const seen = (name: string) => within(screen.getByRole('banner')).queryAllByRole(ROLES[name], { name })
    for (const newLook of [false, true]) {
      drawChrome(newLook, SIGNED_OUT)
      for (const name of [CHROME_NAMES.logIn, CHROME_NAMES.joinLca, CHROME_NAMES.clubs, TODAYS_NAMES.more]) expect(seen(name), `signed out: ${name}`).toHaveLength(1)
      for (const name of [TODAYS_NAMES.profile, TODAYS_NAMES.logOut]) expect(seen(name), `signed out: ${name}`).toHaveLength(0)
      cleanup()
      drawChrome(newLook, SIGNED_IN)
      for (const name of [TODAYS_NAMES.profile, TODAYS_NAMES.logOut, CHROME_NAMES.clubs, TODAYS_NAMES.more]) expect(seen(name), `signed in: ${name}`).toHaveLength(1)
      for (const name of [CHROME_NAMES.logIn, CHROME_NAMES.joinLca]) expect(seen(name), `signed in: ${name}`).toHaveLength(0)
      cleanup()
    }
  })
})
