// @vitest-environment jsdom
//
// test/a11y/chrome.ts, the one place the browser specs reach the site's
// header and footer, held without a browser:
//
// - its answer to which chrome each test build draws: since WS02 step 6,
//   the new chrome's header at every width on a11y-on (the desktop header
//   from 1024 pixels, the tablet header from 768 and the phone's app bar
//   below) and today's footer, and today's chrome at every width on
//   a11y-off, the builds being the two test/a11y/global-setup.ts names; a
//   build it does not hold is an error that names it; its pairs are read
//   from the smallest width up, so ifToday notes what it did not read where
//   the new header is drawn, at every width on a11y-on, and ifNew where
//   today's is, and the decisions onlyToday and onlyNew skip by say so; and
//   a later table, WS02 step 8's new footer at every width, put in place for
//   one case;
// - its selectors, its locators and its names find today's header and
//   footer as Navbar.tsx and Footer.tsx draw them, with newLook off and on:
//   the one banner and the one contentinfo, the brand link, the rook mark
//   and the logo under the new look alone, the Appearance control in the
//   footer under the new look alone, and each name of its first two lists in
//   the header, signed out or signed in; and the names of its third list in
//   the new chrome's bars, SiteHeader.tsx in its desktop and tablet forms
//   and the phone's app bar, MobileAppBar.tsx, which its selectors and
//   locators find as they find today's, and the open Menu sheet and its
//   theme switch, which menuSheet and sheetAppearance find by name exactly;
//   and since WS02 step 7 the phone's dock, its tab bar and its Menu tab,
//   which dock, tabBar and menuTab find by their slots, open sheet or not,
//   and menuControl, the Menu tab while the tab bar is drawn and the bar's
//   Menu button otherwise.
//
// Each WS02 step that draws a new part of the chrome on a test build
// changes DRAWN in test/a11y/chrome.ts and the first block here together.
// The locators are Playwright's, which need a page; here they are handed a
// stand-in for one, which finds in this document what each would find.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, fireEvent, render, screen, within, type ByRoleOptions } from '@testing-library/react'
import type { Page, TestInfo } from '@playwright/test'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import {
  CHROME_NAMES, DRAWN, NEW_NAMES, SITE, TODAYS_NAMES, appearanceControl, brandLink, chromeAt, dock, footerImages, footerLogo, headerImages, ifNew, ifToday,
  menuControl, menuSheet, menuTab, newAt, rookMark, sheetAppearance, siteFooter, siteHeader, tabBar, todayAt, widthOf, type Chrome,
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
const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { MobileAppBar } = await import('@/components/layout/MobileAppBar')
const { BottomDock, DockProvider } = await import('@/components/layout/BottomDock')

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
  last: () => Found
}
/** A locator over this document: each one resolves to the elements it finds, as Playwright's would on the page. */
function found(find: () => Element[]): Found {
  return {
    all: find,
    locator: (css) => found(() => find().flatMap((el) => [...el.querySelectorAll(css)])),
    getByRole: (role, options) => found(() => find().flatMap((el) => within(el as HTMLElement).queryAllByRole(role, options))),
    last: () => found(() => find().slice(-1)),
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

  it('is the new chrome\'s header at every width on a11y-on, and today\'s chrome everywhere else, since WS02 step 6', () => {
    expect(DRAWN).toEqual({
      'a11y-on': { header: [[0, 'new']], footer: [[0, 'today']] },
      'a11y-off': { header: [[0, 'today']], footer: [[0, 'today']] },
    })
    for (const build of BUILDS) {
      for (const part of ['header', 'footer'] as const) {
        const isNew = build === 'a11y-on' && part === 'header'
        for (const width of WIDTHS) expect(chromeAt(build, part, width), `${build}, the ${part} at ${width} pixels`).toBe(isNew ? 'new' : 'today')
        expect(todayAt(build, part, WIDTHS), `${build}, the ${part}`).toBe(!isNew)
        expect(newAt(build, part, WIDTHS), `${build}, the ${part} at every width`).toBe(isNew)
      }
    }
    // The desktop header from 1024 pixels, the tablet header from 768 and the app bar below: all of them the new chrome's.
    expect(chromeAt('a11y-on', 'header', 0)).toBe('new')
    expect(chromeAt('a11y-on', 'header', 767)).toBe('new')
    expect(chromeAt('a11y-on', 'header', 1023)).toBe('new')
    expect(chromeAt('a11y-on', 'header', 1024)).toBe('new')
    expect(todayAt('a11y-on', 'header', [390])).toBe(false)
    expect(todayAt('a11y-on', 'footer', [390, 1023, 1280])).toBe(true)
    expect(newAt('a11y-on', 'footer', [1280])).toBe(false)
    expect(newAt('a11y-off', 'header', [1280])).toBe(false)
  })

  it('throws on a build it does not hold, naming it', () => {
    expect(() => chromeAt('a11y-maybe', 'header', 1280)).toThrow(/a11y-maybe/)
    expect(() => chromeAt('e2e-preview', 'footer', 390)).toThrow(/e2e-preview/)
    expect(() => todayAt('a11y-maybe', 'footer', [390])).toThrow(/a11y-maybe/)
  })

  it('runs what ifToday holds where today\'s chrome is drawn, and adds nothing to the report; where the new header is drawn it notes what it did not read', async () => {
    const info = (build: string) => ({ project: { name: build }, annotations: [] as { type: string; description?: string }[] }) as unknown as TestInfo
    // Today's header: a11y-off at every width; today's footer on both builds.
    for (const [build, width] of [['a11y-off', 1280], ['a11y-off', 390]] as const) {
      const testInfo = info(build)
      let ran = 0
      await ifToday(testInfo, 'header', width, 'the header\'s names', () => {
        ran++
      })
      await ifToday(testInfo, 'footer', 1280, 'the footer\'s logo', async () => {
        ran++
      })
      expect(ran, `${build} at ${width}`).toBe(2)
      expect(testInfo.annotations, `${build} at ${width}`).toEqual([])
    }
    // The new chrome's header, on a11y-on at every width since WS02 step 6: nothing runs, and the report says what was not read.
    for (const width of [390, 1023, 1280]) {
      const noted = info('a11y-on')
      let read = false
      await ifToday(noted, 'header', width, 'the brand link\'s name', () => {
        read = true
      })
      expect(read, `a11y-on at ${width}`).toBe(false)
      expect(noted.annotations, `a11y-on at ${width}`).toEqual([{ type: 'today only', description: `the brand link's name: not read on a11y-on at ${width} pixels, where the new header is drawn` }])
    }
    // Today's footer is still read there.
    const testInfo = info('a11y-on')
    let ran = false
    await ifToday(testInfo, 'footer', 390, 'the footer\'s logo', () => {
      ran = true
    })
    expect(ran).toBe(true)
    expect(testInfo.annotations).toEqual([])
    ran = false
    // Asked about the other build, whose page a spec may have open, it runs.
    await ifToday(testInfo, 'header', 1280, 'the other build\'s names', () => {
      ran = true
    }, 'a11y-off')
    expect(ran).toBe(true)
    // The build a spec names wins over its own project's.
    const own = info('a11y-on')
    await expect(ifToday(own, 'header', 1280, 'the other build\'s header', () => {}, 'a11y-maybe')).rejects.toThrow(/a11y-maybe/)
  })

  it('runs what ifNew holds where the new chrome is drawn, and adds nothing to the report; where today\'s is drawn it notes what it did not read', async () => {
    const info = (build: string) => ({ project: { name: build }, annotations: [] as { type: string; description?: string }[] }) as unknown as TestInfo
    // The new chrome's header, on a11y-on at every width since WS02 step 6: the app bar, the tablet header and the desktop header.
    for (const width of [320, 390, 767, 768, 1023, 1024, 1280, 1440]) {
      const testInfo = info('a11y-on')
      let ran = 0
      await ifNew(testInfo, 'header', width, 'My LCA once the session is read', async () => {
        ran++
      })
      expect(ran, `a11y-on at ${width}`).toBe(1)
      expect(testInfo.annotations, `a11y-on at ${width}`).toEqual([])
    }
    for (const [build, part, width] of [['a11y-off', 'header', 390], ['a11y-off', 'header', 1280], ['a11y-on', 'footer', 390], ['a11y-on', 'footer', 1280]] as const) {
      const testInfo = info(build)
      let ran = false
      await ifNew(testInfo, part, width, 'the new chrome\'s names', () => {
        ran = true
      })
      expect(ran, `${build}, the ${part} at ${width}`).toBe(false)
      expect(testInfo.annotations, `${build}, the ${part} at ${width}`).toEqual([{ type: 'new only', description: `the new chrome's names: not read on ${build} at ${width} pixels, where today's ${part} is drawn` }])
    }
    // Asked about the other build: on a11y-off's page, a11y-on's header at 1280 is the new one.
    const off = info('a11y-off')
    let ran = false
    await ifNew(off, 'header', 1280, 'the other build\'s My LCA', () => {
      ran = true
    }, 'a11y-on')
    expect(ran).toBe(true)
    expect(off.annotations).toEqual([])
    await expect(ifNew(off, 'header', 1280, 'nowhere', () => {}, 'a11y-maybe')).rejects.toThrow(/a11y-maybe/)
  })

  it('reads a part\'s pairs from the smallest width up: with a later table in place, WS02 step 8\'s new footer at every width, today\'s footer is drawn nowhere on a11y-on', async () => {
    // The table as WS02 step 8 will make it on a11y-on, put in place for this case alone.
    const onBuild = DRAWN['a11y-on'] as { footer: ReadonlyArray<readonly [number, Chrome]> }
    const kept = onBuild.footer
    onBuild.footer = [[0, 'new']]
    try {
      expect(WIDTHS.map((width) => chromeAt('a11y-on', 'footer', width))).toEqual(WIDTHS.map(() => 'new'))
      expect(chromeAt('a11y-on', 'header', 1440)).toBe('new')
      expect(chromeAt('a11y-off', 'footer', 1440)).toBe('today')
      expect(todayAt('a11y-on', 'footer', [390, 768])).toBe(false)
      expect(newAt('a11y-on', 'footer', [320, 390, 768, 1024])).toBe(true)
      const testInfo = { project: { name: 'a11y-on' }, annotations: [] as { type: string; description?: string }[] } as unknown as TestInfo
      let ran = false
      await ifToday(testInfo, 'footer', 390, 'the footer\'s logo', () => {
        ran = true
      })
      expect(ran).toBe(false)
      expect(testInfo.annotations).toEqual([{ type: 'today only', description: 'the footer\'s logo: not read on a11y-on at 390 pixels, where the new footer is drawn' }])
    } finally {
      onBuild.footer = kept
    }
    // The real table is back: the new chrome's header at every width, today's footer.
    expect(chromeAt('a11y-on', 'header', 390)).toBe('new')
    expect(chromeAt('a11y-on', 'header', 1440)).toBe('new')
    expect(chromeAt('a11y-on', 'footer', 390)).toBe('today')
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

/** A member whose membership has expired, as the new header sees one once the member has loaded. */
const EXPIRED = { ...SIGNED_IN, memberLoading: false, member: { membership_status: 'expired' } } as unknown as AuthContextValue

/** The new header, as Navbar draws it from 1024 pixels up with the chrome on, on the home page. */
function drawNewHeader(auth: AuthContextValue): HTMLElement {
  flags.newLook = true
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        <SiteHeader />
        <main className="flex-1" />
      </MemoryRouter>
    </AuthContext.Provider>,
  ).container
}

/**
 * The new chrome's bar below 1024 pixels, as Navbar draws it with the chrome
 * on, on the home page: the tablet header from 768 pixels, or the phone's app
 * bar below; with today's footer under the page, as a11y-on draws it.
 */
function drawBar(bar: 'tablet' | 'app bar', auth: AuthContextValue): HTMLElement {
  flags.newLook = true
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/']}>
        {bar === 'tablet' ? <SiteHeader form="tablet" /> : <MobileAppBar />}
        <main className="flex-1" />
        <Footer />
      </MemoryRouter>
    </AuthContext.Provider>,
  ).container
}

/** The role a spec reads each name of the third list by. */
const ROLES: Record<string, 'link' | 'button'> = {
  'Louisiana Chess Association, home': 'link', About: 'button', 'My LCA': 'button', Donate: 'button', Renew: 'link', 'Log out': 'button', Menu: 'button',
}
const banner = () => within(screen.getByRole('banner'))
/** A name of the third list in the banner, by the role a spec reads it by. */
const seen = (name: string) => banner().queryAllByRole(ROLES[name], { name })
/** A name in the banner as a link, as the specs read CHROME_NAMES' Log in, Join LCA and Clubs. */
const anyHeader = (name: string) => banner().queryAllByRole('link', { name })

describe('what the helper finds in the new header', () => {
  it('finds the one banner, the brand link named for the home page with the rook mark first in it, and no image', () => {
    const container = drawNewHeader(SIGNED_OUT)
    const headers = container.querySelectorAll(SITE.header)
    expect(headers).toHaveLength(1)
    expect(headers[0]).toBe(screen.getByRole('banner'))
    expect(all(siteHeader(page))).toEqual([headers[0]])
    const links = all(brandLink(page))
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/')
    expect(within(headers[0] as HTMLElement).getByRole('link', { name: NEW_NAMES.home })).toBe(links[0])
    expect(all(rookMark(page))).toHaveLength(1)
    expect(links[0].firstElementChild).toBe(all(rookMark(page))[0])
    expect(all(headerImages(page))).toHaveLength(0)
  })

  it('finds each name of its third list in the new header, with the role a spec reads it by, signed out and with a membership that has expired, Log out once the My LCA menu is open', () => {
    expect(Object.values(NEW_NAMES).sort()).toEqual(Object.keys(ROLES).sort())

    drawNewHeader(SIGNED_OUT)
    for (const name of [NEW_NAMES.home, NEW_NAMES.about, NEW_NAMES.donate]) expect(seen(name), `signed out: ${name}`).toHaveLength(1)
    // The desktop form has no Menu button: its row holds every section.
    for (const name of [NEW_NAMES.myLca, NEW_NAMES.renew, NEW_NAMES.logOut, NEW_NAMES.menu]) expect(seen(name), `signed out: ${name}`).toHaveLength(0)
    // The names any header gives: Log in and Join LCA signed out, and Clubs among the sections.
    for (const name of [CHROME_NAMES.logIn, CHROME_NAMES.joinLca, CHROME_NAMES.clubs]) expect(anyHeader(name), `signed out: ${name}`).toHaveLength(1)
    // Today's names are not the new header's.
    for (const name of [TODAYS_NAMES.profile, TODAYS_NAMES.more]) expect(banner().queryAllByRole(name === TODAYS_NAMES.more ? 'button' : 'link', { name }), name).toHaveLength(0)
    cleanup()

    drawNewHeader(EXPIRED)
    for (const name of [NEW_NAMES.home, NEW_NAMES.about, NEW_NAMES.donate, NEW_NAMES.myLca, NEW_NAMES.renew]) expect(seen(name), `expired: ${name}`).toHaveLength(1)
    for (const name of [CHROME_NAMES.logIn, CHROME_NAMES.joinLca]) expect(anyHeader(name), `expired: ${name}`).toHaveLength(0)
    expect(seen(NEW_NAMES.logOut), 'with the My LCA menu shut').toHaveLength(0)
    fireEvent.click(seen(NEW_NAMES.myLca)[0])
    expect(seen(NEW_NAMES.logOut), 'the My LCA menu\'s last row').toHaveLength(1)
  })

  it('finds Menu once in the tablet header, and of the names today\'s header gives too, Log in and Clubs once each and no Join LCA, signed out', () => {
    const container = drawBar('tablet', SIGNED_OUT)
    expect(all(siteHeader(page))).toEqual([container.querySelector(SITE.header)])
    expect(seen(NEW_NAMES.menu)).toHaveLength(1)
    for (const name of [NEW_NAMES.home, NEW_NAMES.donate]) expect(seen(name), name).toHaveLength(1)
    for (const name of [NEW_NAMES.about, NEW_NAMES.myLca, NEW_NAMES.renew, NEW_NAMES.logOut]) expect(seen(name), name).toHaveLength(0)
    expect(anyHeader(CHROME_NAMES.logIn)).toHaveLength(1)
    expect(anyHeader(CHROME_NAMES.clubs)).toHaveLength(1)
    expect(anyHeader(CHROME_NAMES.joinLca)).toHaveLength(0)
    expect(all(brandLink(page))).toHaveLength(1)
    expect(all(rookMark(page))).toHaveLength(1)
    expect(all(headerImages(page))).toHaveLength(0)
  })

  it('finds Menu once in the phone\'s app bar, with the brand link and none of the names today\'s header gives, signed out', () => {
    const container = drawBar('app bar', SIGNED_OUT)
    expect(all(siteHeader(page))).toEqual([container.querySelector(SITE.header)])
    expect(seen(NEW_NAMES.menu)).toHaveLength(1)
    expect(seen(NEW_NAMES.home)).toHaveLength(1)
    for (const name of [NEW_NAMES.about, NEW_NAMES.myLca, NEW_NAMES.donate, NEW_NAMES.renew, NEW_NAMES.logOut]) expect(seen(name), name).toHaveLength(0)
    for (const name of Object.values(CHROME_NAMES)) expect(banner().queryAllByRole('link', { name }), name).toHaveLength(0)
    const links = all(brandLink(page))
    expect(links).toHaveLength(1)
    expect(links[0].firstElementChild).toBe(all(rookMark(page))[0])
    expect(all(headerImages(page))).toHaveLength(0)
  })

  it('finds the open Menu sheet by menuSheet and its theme switch by sheetAppearance, each once and by its name exactly, and appearanceControl the sheet\'s while it is open', async () => {
    drawBar('app bar', SIGNED_OUT)
    expect(all(menuSheet(page))).toEqual([])
    expect(all(appearanceControl(page))).toHaveLength(1)
    const footers = all(appearanceControl(page))
    fireEvent.click(seen(NEW_NAMES.menu)[0])
    const sheet = await screen.findByRole('dialog', { name: NEW_NAMES.menu })
    expect(all(menuSheet(page))).toEqual([sheet])
    // Drawn outside the banner.
    expect(screen.getByRole('banner', { hidden: true }).contains(sheet)).toBe(false)
    const switches = all(sheetAppearance(page))
    expect(switches).toHaveLength(1)
    expect(sheet.contains(switches[0])).toBe(true)
    // The page behind the sheet is hidden from assistive technology, so the group named Appearance on the page is the sheet's.
    expect(all(appearanceControl(page))).toEqual(switches)
    expect(footers[0].isConnected).toBe(true)
    // Each is built by its name exactly, so the sheet's close control, Close menu, is never taken for it.
    const source = readFileSync(join(ROOT, 'test/a11y/chrome.ts'), 'utf8')
    expect(source).toContain("export const menuSheet = (page: Page): Locator => page.getByRole('dialog', { name: NEW_NAMES.menu, exact: true })")
    expect(source).toContain("export const sheetAppearance = (page: Page): Locator => menuSheet(page).getByRole('group', { name: 'Appearance', exact: true })")
  })
})

describe('what the helper finds of the phone\'s dock (WS02 step 7)', () => {
  /** The phone's bars as the page frame draws them with the chrome on: the app bar, the page and the dock, in one provider. */
  function drawDock(path = '/clubs') {
    flags.newLook = true
    return render(
      <AuthContext.Provider value={SIGNED_OUT}>
        <MemoryRouter initialEntries={[path]}>
          <DockProvider>
            <MobileAppBar />
            <main className="flex-1" />
            <Footer />
            <BottomDock />
          </DockProvider>
        </MemoryRouter>
      </AuthContext.Provider>,
    ).container
  }

  it('finds the one dock and its tab bar by their slots, the tab bar the nav named Main, after the footer', () => {
    const container = drawDock()
    expect(all(dock(page))).toEqual([...container.querySelectorAll(SITE.dock)])
    expect(all(dock(page))).toHaveLength(1)
    expect(all(tabBar(page))).toEqual([screen.getByRole('navigation', { name: 'Main' })])
    expect(all(dock(page))[0].contains(all(tabBar(page))[0])).toBe(true)
    const footer = container.querySelector(SITE.footer)!
    expect(footer.compareDocumentPosition(all(dock(page))[0]) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  })

  it('finds the Menu tab by menuTab, Menu while the sheet is shut and Close while it is open, when the open sheet hides it from a role locator', async () => {
    drawDock()
    const [tab] = all(menuTab(page))
    expect(all(menuTab(page))).toHaveLength(1)
    expect(tab.textContent).toBe(NEW_NAMES.menu)
    fireEvent.click(tab)
    await screen.findByRole('dialog', { name: NEW_NAMES.menu })
    expect(all(menuTab(page))).toEqual([tab])
    expect(tab.textContent).toBe('Close')
    // A role locator finds no tab bar while the sheet is open: what is behind it is hidden from assistive technology.
    expect(screen.queryAllByRole('navigation', { name: 'Main' })).toEqual([])
  })

  it('finds by menuControl the Menu tab while the tab bar is drawn, and the bar\'s Menu button where the dock hides', () => {
    drawDock('/clubs')
    expect(all(menuControl(page))).toEqual(all(menuTab(page)))
    expect(banner().queryAllByRole('button', { name: NEW_NAMES.menu })).toEqual([])
    cleanup()
    drawDock('/donate/success')
    expect(all(dock(page))).toEqual([])
    expect(all(menuTab(page))).toEqual([])
    expect(all(menuControl(page))).toEqual(banner().getAllByRole('button', { name: NEW_NAMES.menu }))
    cleanup()
    drawBar('tablet', SIGNED_OUT)
    expect(all(menuControl(page))).toEqual(banner().getAllByRole('button', { name: NEW_NAMES.menu }))
  })

  it('builds each of the four from the slots and the dialog button, never from a name', () => {
    const source = readFileSync(join(ROOT, 'test/a11y/chrome.ts'), 'utf8')
    expect(source).toContain("export const dock = (page: Page): Locator => page.locator(SITE.dock)")
    expect(source).toContain("export const tabBar = (page: Page): Locator => page.locator(SITE.tabBar)")
    expect(source).toContain("export const menuTab = (page: Page): Locator => tabBar(page).locator('button[aria-haspopup=\"dialog\"]')")
    expect(source).toContain('page.locator(`${SITE.tabBar} button[aria-haspopup="dialog"], [data-slot="site-header"] button[aria-haspopup="dialog"], [data-slot="app-bar"] button[aria-haspopup="dialog"]`).last()')
    expect([SITE.dock, SITE.tabBar]).toEqual(['[data-slot="bottom-dock"]', '[data-slot="tab-bar"]'])
  })
})
