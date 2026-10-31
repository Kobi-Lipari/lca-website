// test/a11y/chrome.ts
//
// The one place the browser specs reach the site's chrome: the header drawn
// above every page's main and the footer drawn below it. Every read of the
// header or the footer in test/a11y goes through what this file gives:
//
// - SITE, the CSS selectors that code running inside the page needs. Such
//   code cannot import anything, so a spec hands SITE to page.evaluate,
//   evaluateAll, addInitScript or axe's include as an argument.
// - Locators for a spec's own code: the header by its banner role and the
//   footer by its contentinfo role, the roles today's <header> and <footer>
//   have, the new header and the phone's app bar have, and the new footer
//   will have, and the parts inside them a spec reads, each found by its
//   role, its name or its data-slot. A footer that is not drawn has no role,
//   so code that reads it while it may be hidden reads SITE.footer instead.
//   The Menu sheet the new bars open is drawn outside the banner, and is
//   found on the page by its own locators.
// - The header's names in three lists: CHROME_NAMES, which today's header
//   and the new header from 1024 pixels up give, TODAYS_NAMES, which only
//   today's gives, and NEW_NAMES, which only the new chrome's bars and its
//   sheet give.
// - Which chrome each test build draws at a width (DRAWN and chromeAt), and
//   two ways for a spec to say that an assertion holds for today's chrome
//   only: onlyToday at the top of a test whose every assertion does, and
//   ifToday around the lines of a test that also checks what any chrome
//   holds. Neither removes or loosens a check: each runs it wherever today's
//   chrome is drawn. onlyNew and ifNew are their mirrors for an assertion
//   that holds for the new chrome only, each running it wherever the new
//   chrome is drawn.
//
// Since WS02 step 6 the a11y-on build draws the new chrome's header at every
// width (the desktop header from 1024 pixels, the tablet header from 768
// and the phone's app bar below), and today's footer until WS02 step 8; the
// a11y-off build keeps today's chrome at every width, since it turns no
// switch on. Each WS02 step that draws a new part changes DRAWN and
// test/unit/chrome-helper.test.tsx together: WS02 step 8 the footer on
// a11y-on at every width.
//
// No project collects this file (its name ends neither in .spec.ts nor in
// baseline.ts), and it imports only types from Playwright and from
// ./global-setup and `test` from ./support, so a unit test can import it.
import type { Locator, Page, TestInfo } from '@playwright/test'
import type { A11yVariant } from './global-setup'
import { test } from './support'

/** The CSS selectors code running inside the page reads the chrome with, handed to it as an argument. */
export const SITE = {
  /** The site's header. Two pages draw a header of their own inside the main; the site's comes first in the page. */
  header: 'header',
  /** The site's footer, the one footer a page draws. */
  footer: 'footer',
  /** The header's brand link, the link to the home page. */
  brandLink: 'a[href="/"]',
  /** The rook mark, LcaMark. */
  mark: '[data-slot="lca-mark"]',
  /** The official logo, LcaLogo. */
  logo: '[data-slot="lca-logo"]',
  /** A link to one of the site's own pages, as the footer holds them. */
  footerLinks: 'a[href^="/"]',
} as const

/** SITE's type, for the code a spec runs inside the page. */
export type SiteSelectors = typeof SITE

/** The site's header, by its banner role, the one landmark of that role on a page. */
export const siteHeader = (page: Page): Locator => page.getByRole('banner')
/** The site's footer, by its contentinfo role, while it is drawn. */
export const siteFooter = (page: Page): Locator => page.getByRole('contentinfo')
/** The header's brand link. */
export const brandLink = (page: Page): Locator => siteHeader(page).locator(SITE.brandLink)
/** The rook mark in the header. */
export const rookMark = (page: Page): Locator => siteHeader(page).locator(SITE.mark)
/** Every image the header draws. */
export const headerImages = (page: Page): Locator => siteHeader(page).locator('img')
/** The official logo in the footer. */
export const footerLogo = (page: Page): Locator => siteFooter(page).locator(SITE.logo)
/** Every image the footer draws. */
export const footerImages = (page: Page): Locator => siteFooter(page).locator('img')
/**
 * The Appearance control, the group named Appearance, found on the page as
 * the specs have always found it: the footer's while the Menu sheet is
 * closed, and the sheet's while it is open, since the sheet hides the rest
 * of the page from assistive technology. WS02 step 6, which drew the sheet
 * with a shortcut to the control (brief 1.4), so decided; sheetAppearance
 * reads the sheet's alone.
 */
export const appearanceControl = (page: Page): Locator => page.getByRole('group', { name: 'Appearance' })

/**
 * Names today's header and the new header from 1024 pixels up both give
 * (brief 1.4's WS02 section). The tablet header gives Log in and Clubs and
 * no Join LCA, which its Menu sheet gives; the phone's app bar gives none of
 * the three, only its brand link and Menu.
 */
export const CHROME_NAMES = {
  logIn: 'Log in',
  joinLca: 'Join LCA',
  clubs: 'Clubs',
} as const

/**
 * Names only today's header gives: its two account buttons and its More
 * menu, whose place the My LCA menu takes. The new header gives Log out too,
 * as the My LCA menu's last row, which a spec reads by NEW_NAMES.logOut.
 */
export const TODAYS_NAMES = {
  profile: 'Profile',
  logOut: 'Log out',
  more: 'More',
} as const

/**
 * Names only the new chrome's bars and its sheet give (brief 1.4's WS02
 * section): the brand link, named for the home page; the About and My LCA
 * menus' buttons; Donate; Renew, in the Join slot once a membership has
 * expired; Log out, the My LCA menu's last row and the sheet's, which
 * today's header gives as a button of its own (TODAYS_NAMES.logOut); and
 * Menu, the bordered button of the tablet header and the phone's app bar
 * and the name of the sheet it opens, which today's header does not give
 * (its drawer's toggle is named Open menu or Close menu).
 */
export const NEW_NAMES = {
  home: 'Louisiana Chess Association, home',
  about: 'About',
  myLca: 'My LCA',
  donate: 'Donate',
  renew: 'Renew',
  logOut: 'Log out',
  menu: 'Menu',
} as const

/**
 * The Menu sheet while it is open: the dialog named Menu, which the tablet
 * header's and the app bar's Menu button opens. It is drawn at the end of
 * the page's body, outside the banner, so it is found on the page, by its
 * name exactly.
 */
export const menuSheet = (page: Page): Locator => page.getByRole('dialog', { name: NEW_NAMES.menu, exact: true })
/** The theme switch inside the open Menu sheet: the group named Appearance there. */
export const sheetAppearance = (page: Page): Locator => menuSheet(page).getByRole('group', { name: 'Appearance', exact: true })

/** A test build, by its project name (A11Y_VARIANTS in ./global-setup). */
export type Build = A11yVariant['name']
/** The two parts of the chrome. */
export type Part = 'header' | 'footer'
/** Today's chrome, or the one WS02 draws with the chrome on. */
export type Chrome = 'today' | 'new'

/**
 * Which chrome each test build draws, for each part, as pairs of the width
 * it starts at and the chrome, read from the smallest width up. It is not
 * worked out from the switches: a11y-on has had newNav and newLook on since
 * WS02 step 2, drew the new header from 1024 pixels in WS02 step 5, and
 * draws the new chrome's header at every width since WS02 step 6 (the
 * desktop header from 1024 pixels, the tablet header from 768 and the app
 * bar below), with today's footer until WS02 step 8, so only what each step
 * builds can answer it.
 */
export const DRAWN: Readonly<Record<Build, Readonly<Record<Part, ReadonlyArray<readonly [number, Chrome]>>>>> = {
  'a11y-on': { header: [[0, 'new']], footer: [[0, 'today']] },
  'a11y-off': { header: [[0, 'today']], footer: [[0, 'today']] },
}

/** The chrome a build draws for a part at a window's width. A build the table does not hold is an error that names it. */
export function chromeAt(build: string, part: Part, width: number): Chrome {
  const parts = (DRAWN as Readonly<Record<string, (typeof DRAWN)[Build] | undefined>>)[build]
  if (!parts) throw new Error(`chromeAt: there is no test build named "${build}"; the builds are ${Object.keys(DRAWN).join(' and ')}`)
  let drawn: Chrome | null = null
  for (const [from, chrome] of parts[part]) if (width >= from) drawn = chrome
  if (drawn === null) throw new Error(`chromeAt: no ${part} is listed for ${build} at ${width} pixels`)
  return drawn
}

/** Whether a build draws today's chrome for a part at every one of these widths. */
export function todayAt(build: string, part: Part, widths: readonly number[]): boolean {
  return widths.every((width) => chromeAt(build, part, width) === 'today')
}

/** Whether a build draws the new chrome for a part at every one of these widths. */
export function newAt(build: string, part: Part, widths: readonly number[]): boolean {
  return widths.every((width) => chromeAt(build, part, width) === 'new')
}

/** The width of a page's window: the one a test set, or Desktop Chrome's 1280 (playwright.config.ts) where it set none. */
export const widthOf = (page: Page): number => page.viewportSize()?.width ?? 1280

/**
 * At the top of a test whose every assertion holds for today's chrome only:
 * skips the test, saying why, unless the build asked about (the test's own,
 * unless it names another) draws today's chrome for that part at every
 * width the test reads.
 */
export function onlyToday(testInfo: TestInfo, part: Part, widths: readonly number[], why: string, build: string = testInfo.project.name): void {
  test.skip(!todayAt(build, part, widths), `today's ${part} only: ${why}`)
}

/**
 * Around the lines of a test that hold for today's chrome only, in a test
 * that also checks what any chrome holds: runs them where the build asked
 * about (the test's own, unless it names another) draws today's chrome for
 * that part at that width, and otherwise notes in the report, as an
 * annotation of type "today only", what was not read.
 */
export async function ifToday(testInfo: TestInfo, part: Part, width: number, what: string, run: () => Promise<void> | void, build: string = testInfo.project.name): Promise<void> {
  if (chromeAt(build, part, width) === 'today') {
    await run()
    return
  }
  testInfo.annotations.push({ type: 'today only', description: `${what}: not read on ${build} at ${width} pixels, where the new ${part} is drawn` })
}

/**
 * At the top of a test whose every assertion holds for the new chrome only:
 * skips the test, saying why, unless the build asked about (the test's own,
 * unless it names another) draws the new chrome for that part at every
 * width the test reads.
 */
export function onlyNew(testInfo: TestInfo, part: Part, widths: readonly number[], why: string, build: string = testInfo.project.name): void {
  test.skip(!newAt(build, part, widths), `the new ${part} only: ${why}`)
}

/**
 * Around the lines of a test that hold for the new chrome only, in a test
 * that also checks what any chrome holds: runs them where the build asked
 * about (the test's own, unless it names another) draws the new chrome for
 * that part at that width, and otherwise notes in the report, as an
 * annotation of type "new only", what was not read.
 */
export async function ifNew(testInfo: TestInfo, part: Part, width: number, what: string, run: () => Promise<void> | void, build: string = testInfo.project.name): Promise<void> {
  if (chromeAt(build, part, width) === 'new') {
    await run()
    return
  }
  testInfo.annotations.push({ type: 'new only', description: `${what}: not read on ${build} at ${width} pixels, where today's ${part} is drawn` })
}
