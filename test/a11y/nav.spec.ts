// test/a11y/nav.spec.ts
//
// The site's navigation and the frame it sits in (WS02), on both builds. The
// a11y-on build has the chrome on (newNav and newLook, chromeOn in
// src/lib/nav.ts); a11y-off is the site as visitors see it today. Each part
// of WS02 adds its own block here; WS02 step 3 begins it with the frame:
//
// - The skip link (AC13's first half), on a11y-on at 390 by 844 and 1280 by
//   800, on /, /tournaments and /about, light and dark: from a page that is
//   drawn and holds no focus, the first Tab reaches "Skip to content", drawn
//   whole inside the window above the header, its ring 3:1 or more against
//   its own ground, which is on both sides of the line; Enter moves the focus
//   to the main without changing the address, the main gives back the
//   tabindex it took for that once the focus leaves it, so a later click on
//   the page's text does not focus it, and from the link the next Tab
//   reaches the header's brand link. With a gold announcement and with
//   the impersonation banner it is still first, before their controls. On
//   a11y-off no page has it, and the main has no id and no tabindex.
// - The layout shift of a first visit (AC23), counted from the start of the
//   navigation until the page is settled, on /about and /membership, the
//   brief's two pages, and on /donate/success, a page shorter than the
//   window, at 390 by 844 and 1280 by 800, light and dark on a11y-on: each
//   run once as a first visit comes and once with the page's code held back
//   for 1.5 seconds, so the loading line is certainly on screen; on a11y-on
//   every total is under 0.1. On a11y-off the same figures are printed, and
//   the one held case of /membership at 1280 by 800 shows the measure sees
//   today's shift.
// - The browser bar's colour (AC20), on a11y-on: for System, Light and Dark
//   picked in the Appearance control, on a light and on a dark device, the
//   page's theme colour by the browser's rule; the same from the first paint
//   with the app's script stopped; a localStorage that throws leaves System;
//   a pick survives a reload. On a11y-off, whatever is stored, the page has
//   index.html's two metas and no other.
// - The rings (AC19's first half): under the new look the gold banners'
//   controls have a navy ring on the gold, light and dark, and on a11y-off
//   the marker changes nothing; the chrome's ring rules, tried on the
//   fixture page: gold on a navy ground, the look's own ring on a light
//   surface inside it, and the older gold kept on a light surface put inside
//   a bg-brand-navy band, which is why no chrome surface sits inside one.
// - The new desktop header, which the a11y-on build draws from 1024 pixels
//   up: at 1024, 1280 and 1440 by 800, signed out, one navy row 64 pixels
//   tall that keeps its height and its place when the page scrolls, led by
//   the brand link named for the home page with the rook mark hidden from
//   screen readers and on no plate, then the six sections with 12 pixels a
//   side, then Donate, Log in and Join LCA, nothing overlapping or wrapping
//   and nothing wider than the window; the section a page is in marked with
//   aria-current and a line that moves nothing, and in forced colours, which
//   draw no such line, underlined instead, as a section under the pointer
//   is, the underline moving nothing either; the About menu by mouse and
//   by keyboard, its current row's "You are here" in the light look and in
//   dark mode; the row giving way at 1024 pixels, Donate into the About
//   menu first and then the two-line name; the gold slot by the member's
//   status (signed out, active, ending in 20 days, expired); the My LCA
//   menu's rows for three people and Log out from it; the page Log in hands
//   to /login; Donate's dialog; and --header-h, with the scroll padding
//   that keeps a control reached by Tab clear of the header. Below 1024
//   pixels today's header stands in, at 390 and 768, and on a11y-off today's
//   header marks the page it is on, in the bar, the More menu and the
//   drawer.
// - The new desktop header at its edges, on a11y-on: the window narrowed
//   below 1024 pixels and widened again, the two headers swapping in place
//   with no new page load, one banner at a time, and --header-h written
//   only while the new header is drawn; axe, with the WCAG 2.0 to 2.2 A and
//   AA rules, finding nothing in the header with the About menu open, and
//   with the My LCA menu open for a person signed in, light and dark; and
//   Donate's dialog moving this very tab to the payment page, the checkout
//   answered in the browser with a made-up page of the site's own, with no
//   window and no new page opened and one checkout asked for; Esc pressed
//   while that checkout is asked for leaving this tab where it is when the
//   answer comes, the dialog opened again with its amount and its button
//   back, and Continue then moving the tab to the payment page; and the row
//   giving way exactly where its parts stop fitting inside its padding, by
//   the layout's own measure, half a pixel either side of each step,
//   signed out at 1024 pixels and as an expired member at 1280; a tab left
//   open across a deploy, whose donation dialog's file has gone, reloading
//   once on the first press of Donate and then opening the dialog; and on
//   a11y-off, the page's root with no --header-h and no scroll padding.
//
// Reads only; the announcement and the impersonation target are stubbed in
// the browser with made-up fixture data in the seed's style, and the people
// signed in are test/a11y/signedIn.ts's, whose calls are answered in the
// browser; the donation dialog is closed with nothing sent, but in the two
// cases that send it, whose checkouts are answered in the browser and never
// reach the server.
//
// The header, the footer and the Appearance control are read through
// test/a11y/chrome.ts. The checks here that hold for today's header alone
// (the first Tab on a11y-off going into it, the stand-in below 1024 pixels
// and today's header on a11y-off) say so through it, and so do the checks
// that hold for the new header alone.
import AxeBuilder from '@axe-core/playwright'
import type { Browser, Locator, Page, Route, TestInfo } from '@playwright/test'
import {
  CHROME_NAMES, NEW_NAMES, SITE, TODAYS_NAMES, appearanceControl, brandLink, ifNew, ifToday, onlyNew, onlyToday, rookMark, siteHeader, widthOf,
  type SiteSelectors,
} from './chrome'
import { sessionInPage, signInAs, waitForMemberAnswers } from './signedIn'
import { expect, openDrawn, prepareLocalPage, test } from './support'
import { navPersona } from '../unit/fixtures/navPersonas'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const APPEARANCE_KEY = 'lca-appearance'
const SKIP = 'Skip to content'
const LOADING = 'Loading…'

const NAVY = 'rgb(26, 39, 68)'
const GOLD = 'rgb(200, 169, 74)'
const WHITE = 'rgb(255, 255, 255)'
/** The browser bar's two colours, as index.html and src/lib/colorScheme.ts give them. */
const BAR = { light: '#1a2744', dark: '#0b1220' } as const

const SIZES = [
  [390, 844],
  [1280, 800],
] as const

function only(testInfo: TestInfo, project: string, why = `checks the ${project} build`) {
  test.skip(testInfo.project.name !== project, why)
}

/** [r, g, b] from a computed rgb() or rgba() colour, which must be opaque. */
function rgb(colour: string): [number, number, number] {
  const m = colour.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/)
  if (!m) throw new Error(`not an rgb() colour: ${colour}`)
  if (m[4] !== undefined && Number(m[4]) !== 1) throw new Error(`not opaque: ${colour}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** WCAG 2.x contrast ratio of two computed rgb() colours. */
function ratio(a: string, b: string): number {
  const lum = (c: [number, number, number]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** Gives the element keyboard focus, as a keyboard user would see it, then waits for any transition to finish. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab')
  await target.focus()
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await target.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
}

/** The focus ring of an element, and the ground it is measured on. */
function ringOf(target: Locator) {
  return target.evaluate((el) => {
    const s = getComputedStyle(el)
    return { style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset, colour: s.outlineColor }
  })
}

/** Where the keyboard is: the element's tag and its name. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return 'body'
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} ${name}`.trim()
  })

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

// ── The pages the frame is read on ─────────────────────────────────────────

/** What each page shows once it is drawn. */
const PAGES: Record<string, (page: Page) => Locator[]> = {
  '/': (page) => [page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })],
  '/tournaments': (page) => [page.locator('main').getByRole('button', { name: /Fixture Fall Open/ }).first()],
  '/about': (page) => [page.getByRole('heading', { level: 1, name: 'About LCA' }), page.getByText('Who we are').first()],
  '/membership': (page) => [page.getByRole('heading', { level: 1, name: 'LCA Membership' })],
  // Where a donor comes back to from the payment page: shorter than the window at both widths.
  '/donate/success': (page) => [page.getByRole('heading', { level: 1, name: 'Thank you for your donation!' })],
}

/** Opens a page, waits until it is drawn and its fonts are in, and leaves the focus nowhere. */
async function openQuiet(page: Page, route: string) {
  await openDrawn(page, route, PAGES[route](page))
  await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
  expect(await focused(page)).toBe('body')
}

/** One gold announcement with a link, as GET /api/announcement gives it. */
const GOLD_ANNOUNCEMENT = {
  id: 'fx-ann-gold',
  tone: 'gold',
  size: 'default',
  message: 'Registration for the Fixture Fall Open closes Friday, October 30 at 7:00 PM.',
  linkUrl: '/tournaments',
  linkLabel: 'Enter the Fixture Fall Open',
}

/** Answers the page's announcement call with the gold announcement. */
async function stubAnnouncement(page: Page) {
  await page.route('**/api/announcement', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ announcements: [GOLD_ANNOUNCEMENT] }) }),
  )
}

/** Plants the impersonation target the site keeps for a tab, so the impersonation banner is drawn. */
async function plantImpersonation(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('lca_impersonation_target', JSON.stringify({ id: 'fx-m-p5', fullName: 'Riley Fixture', email: 'riley.fixture@example.org' }))
  })
}

// ── The skip link (AC13, its first half) ───────────────────────────────────

/** The skip link as drawn now: its box against the window, its ring, its ground, and what is drawn at its middle. */
function skipLinkAsDrawn(page: Page) {
  return page.getByRole('link', { name: SKIP }).evaluate((el, site) => {
    const s = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    const atMiddle = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    const header = document.querySelector(site.header)
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      window: { width: window.innerWidth, height: window.innerHeight },
      position: s.position,
      clip: s.clipPath,
      zIndex: s.zIndex,
      headerZ: header ? getComputedStyle(header).zIndex : null,
      overHeader: !!header && box.y < header.getBoundingClientRect().bottom,
      onTop: !!atMiddle && (atMiddle === el || el.contains(atMiddle)),
      ring: { style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset, colour: s.outlineColor },
      ground: s.backgroundColor,
      words: (el.textContent ?? '').trim(),
      href: el.getAttribute('href'),
    }
  }, SITE)
}

test.describe('the skip link with the chrome on', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const route of ['/', '/tournaments', '/about']) {
    for (const [width, height] of SIZES) {
      test(`a11y-on, ${route} at ${width} by ${height}, light and dark: the first Tab reaches "${SKIP}", drawn above the header with its ring at 3:1 or more on its own ground; Enter moves the focus to the main and leaves the address; the next Tab from it reaches the brand link`, async ({ page, external }, testInfo) => {
        only(testInfo, ON, 'the skip link comes with the chrome, on a11y-on')
        await page.setViewportSize({ width, height })
        const seen: Record<string, unknown> = {}
        for (const scheme of ['light', 'dark'] as const) {
          await page.emulateMedia({ colorScheme: scheme })
          await openQuiet(page, route)
          const address = page.url()
          // The main is no stop of its own and holds no tabindex until the skip link is used.
          expect(await page.locator('main').getAttribute('tabindex'), scheme).toBeNull()

          // The first Tab, from a page that holds no focus.
          await page.keyboard.press('Tab')
          const skip = page.getByRole('link', { name: SKIP })
          await expect(skip, scheme).toBeFocused()
          expect(await skip.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
          const drawn = await skipLinkAsDrawn(page)
          seen[scheme] = { ...drawn, ringRatio: ratio(drawn.ring.colour, drawn.ground) }
          expect(drawn.words).toBe(SKIP)
          expect(drawn.href).toBe('#main-content')
          // Drawn whole, inside the window, on top of the header.
          expect(drawn.position, scheme).toBe('fixed')
          expect(drawn.clip, scheme).toBe('none')
          expect(drawn.box.width, scheme).toBeGreaterThan(40)
          expect(drawn.box.height, scheme).toBeGreaterThan(20)
          expect(drawn.box.x).toBeGreaterThanOrEqual(0)
          expect(drawn.box.y).toBeGreaterThanOrEqual(0)
          expect(drawn.box.x + drawn.box.width).toBeLessThanOrEqual(drawn.window.width)
          expect(drawn.box.y + drawn.box.height).toBeLessThanOrEqual(drawn.window.height)
          expect(drawn.overHeader, scheme).toBe(true)
          expect(drawn.onTop, `${scheme}: the link is what is drawn at its middle, over the header`).toBe(true)
          expect(Number(drawn.zIndex)).toBeGreaterThan(Number(drawn.headerZ))
          // The ring: inside its own edge, so its own ground lies on both sides of the line.
          expect(drawn.ring.style).toBe('solid')
          expect(drawn.ring.width).toBe('2px')
          expect(drawn.ring.offset).toBe('-4px')
          expect(drawn.ring.colour, scheme).toBe(scheme === 'light' ? NAVY : GOLD)
          expect(drawn.ground, scheme).toBe(scheme === 'light' ? WHITE : NAVY)
          expect(ratio(drawn.ring.colour, drawn.ground), scheme).toBeGreaterThanOrEqual(3)

          // Enter moves the focus to the main and changes nothing in the address.
          await page.keyboard.press('Enter')
          await expect(page.locator('main#main-content')).toBeFocused()
          expect(await page.locator('main').getAttribute('tabindex')).toBe('-1')
          expect(page.url(), scheme).toBe(address)
          // The main is a landmark, not a control: no ring around the page.
          expect((await ringOf(page.locator('main'))).style).toBe('none')
          // From the main, the next Tab is inside it, past the header.
          await page.keyboard.press('Tab')
          expect(await page.evaluate(() => !!document.activeElement && document.querySelector('main')!.contains(document.activeElement)), scheme).toBe(true)
          // The focus has left the main, so the main has given back its tabindex,
          // and a click on the page's heading does not put the focus on it.
          expect(await page.locator('main').getAttribute('tabindex'), scheme).toBeNull()
          await page.locator('main h1').first().click()
          expect(await page.evaluate(() => document.activeElement === document.querySelector('main')), scheme).toBe(false)

          // From the link itself, the next Tab reaches the header's brand link.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
          await openQuiet(page, route)
          await page.keyboard.press('Tab')
          await expect(skip).toBeFocused()
          await page.keyboard.press('Tab')
          await expect(brandLink(page), scheme).toBeFocused()
          // Once the focus has left it, the link is hidden again.
          expect(await skip.evaluate((el) => getComputedStyle(el).position)).toBe('absolute')
        }
        await testInfo.attach(`skip-link-${route.replace(/\//g, '') || 'home'}-${width}.json`, { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
        expect(external).toEqual([])
      })
    }
  }

  test('a11y-on: with a gold announcement and the impersonation banner, the skip link is still the first Tab, before their controls', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the skip link comes with the chrome, on a11y-on')
    const skip = page.getByRole('link', { name: SKIP })
    const more = page.getByRole('link', { name: GOLD_ANNOUNCEMENT.linkLabel })
    const dismiss = page.getByRole('button', { name: `Dismiss: ${GOLD_ANNOUNCEMENT.linkLabel}` })
    const exit = page.getByRole('button', { name: 'Exit' })
    const brand = brandLink(page)
    /** Presses Tab once for each control, which must take the focus in this order. */
    const tabsThrough = async (order: Locator[], where: string) => {
      for (const [i, control] of order.entries()) {
        await page.keyboard.press('Tab')
        await expect(control, `${where}: stop ${i + 1} is ${await focused(page)}`).toBeFocused()
      }
    }
    await stubAnnouncement(page)
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height })
      // The announcement alone: the link, then the banner's link and its dismiss button, then the header.
      await openQuiet(page, '/')
      await expect(page.getByText(GOLD_ANNOUNCEMENT.message, { exact: false })).toBeVisible()
      await tabsThrough([skip, more, dismiss, brand], `${width}, the announcement`)
    }
    // The impersonation banner comes first in the page, then the announcement, then the header.
    await plantImpersonation(page)
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height })
      await openQuiet(page, '/')
      await expect(page.getByText('Viewing as Riley Fixture', { exact: false })).toBeVisible()
      await tabsThrough([skip, exit, more, dismiss, brand], `${width}, both banners`)
    }
    expect(external).toEqual([])
  })

  test('a11y-off: no page has the skip link, and the main has no id and no tabindex, as today', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    for (const route of ['/', '/tournaments', '/about']) {
      await openQuiet(page, route)
      await expect(page.getByRole('link', { name: SKIP })).toHaveCount(0)
      await expect(page.locator('[data-skip-link], a[href="#main-content"]')).toHaveCount(0)
      const main = page.locator('main').first()
      expect(await main.getAttribute('id'), route).toBeNull()
      expect(await main.getAttribute('tabindex'), route).toBeNull()
      // The first Tab goes where it always went: into the header.
      await ifToday(testInfo, 'header', widthOf(page), 'the first Tab going into today\'s header, to its brand link', async () => {
        await page.keyboard.press('Tab')
        await expect(brandLink(page), route).toBeFocused()
      })
    }
    expect(external).toEqual([])
  })
})

// ── The layout shift of a first visit (AC23) ───────────────────────────────

/** What the page keeps from the start of the navigation: every layout shift, with what moved. */
interface Watched {
  __shifts: { value: number; at: number; input: boolean; moved: string[] }[]
}

/**
 * Put in place before the page's scripts run (an init script, so it runs
 * again on every load): a buffered layout-shift observer, which also sees
 * the shifts from before it was made, keeping with each shift what moved.
 * The chrome's selectors come in as its argument.
 */
function watchShifts(site: SiteSelectors) {
  const w = window as unknown as Watched
  w.__shifts = []
  const describe = (node: Node | null, before: DOMRectReadOnly, after: DOMRectReadOnly) => {
    const el = node instanceof Element ? node : node?.parentElement ?? null
    const area = !el ? 'gone' : el.closest(site.footer) ? 'footer' : el.closest(site.header) ? 'header' : el.closest('main') ? 'main' : el.tagName.toLowerCase()
    const words = (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
    return `${area}: ${el ? el.tagName.toLowerCase() : 'a node'} "${words}" from ${Math.round(before.y)} to ${Math.round(after.y)}`
  }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }
      w.__shifts.push({
        value: shift.value,
        at: entry.startTime,
        input: shift.hadRecentInput,
        moved: (shift.sources ?? []).map((s) => describe(s.node, s.previousRect, s.currentRect)),
      })
    }
  }).observe({ type: 'layout-shift', buffered: true })
}

/** The code of the three pages loaded on demand, and the heritage layout /about is drawn in on a11y-on. */
const PAGE_CODE = /\/assets\/(?:AboutPage|HeritageLayout|MembershipPage|DonationSuccessPage)-[\w-]+\.js(?:\?.*)?$/
const HOLD_MS = 1500

/** Holds the pages' code back until release is called, all of it together. */
async function holdCode(page: Page) {
  let open!: () => void
  const held = new Promise<void>((resolve) => {
    open = resolve
  })
  const asked: string[] = []
  const handler = async (route: Route) => {
    asked.push(new URL(route.request().url()).pathname)
    await held
    await route.fallback()
  }
  await page.route(PAGE_CODE, handler)
  return { asked, release: () => open() }
}

/**
 * Opens a page as a first visit, in a browser profile of its own with
 * nothing kept from an earlier visit, holding the page's code back for 1.5
 * seconds or not, and counts every shift from the start of the navigation
 * until the page is settled: its content drawn, the loading line gone, its
 * fonts in, and a moment of quiet.
 */
async function firstVisit(browser: Browser, testInfo: TestInfo, route: string, size: { width: number; height: number }, scheme: 'light' | 'dark', held: boolean) {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport: size, colorScheme: scheme, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    const external = await prepareLocalPage(page)
    await page.addInitScript(watchShifts, SITE)
    const code = held ? await holdCode(page) : null
    await page.goto(route, { waitUntil: 'commit' })
    let lineSeen = false
    if (code) {
      // The loading line is on screen while the code is held.
      await expect(page.locator('main').getByText(LOADING, { exact: true })).toBeVisible()
      lineSeen = true
      await page.waitForTimeout(HOLD_MS)
      code.release()
    }
    for (const locator of PAGES[route](page)) await expect(locator).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0, { timeout: 15_000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(500)
    await frames(page)
    const shifts = await page.evaluate(() => (window as unknown as Watched).__shifts)
    const counted = shifts.filter((s) => !s.input)
    const total = counted.reduce((sum, s) => sum + s.value, 0)
    return { total, shifts: counted, lineSeen, heldFiles: code?.asked ?? [], external }
  } finally {
    await context.close()
  }
}

test.describe('the layout shift of a first visit to a page loaded on demand', () => {
  // The brief's two pages, both taller than the window, and a page shorter than it, where the footer would rise into view as the page came.
  for (const route of ['/about', '/membership', '/donate/success']) {
    for (const [width, height] of SIZES) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${route} at ${width} by ${height}, ${scheme}: from the start of the navigation, as a first visit comes and with the page's code held back; under 0.1 with the chrome on`, async ({ browser, external }, testInfo) => {
          const on = testInfo.project.name === ON
          test.skip(!on && scheme === 'dark', 'a11y-off has no dark mode; its light run is the page as it is today, for comparison')
          const size = { width, height }
          const natural = await firstVisit(browser, testInfo, route, size, scheme, false)
          const held = await firstVisit(browser, testInfo, route, size, scheme, true)
          const moved = (visit: typeof natural) => [...new Set(visit.shifts.flatMap((s) => s.moved))]
          const figures = {
            route, width, height, scheme, build: testInfo.project.name,
            natural: natural.total, held: held.total, lineSeen: held.lineSeen, heldFiles: held.heldFiles,
            shifts: { natural: natural.shifts, held: held.shifts },
          }
          console.log(`layout shift on ${route} at ${width} by ${height}, ${scheme} (${testInfo.project.name}): as a first visit comes ${natural.total.toFixed(4)}${moved(natural).length ? ` (${moved(natural).join('; ')})` : ''}, with the page's code held back ${held.total.toFixed(4)}${moved(held).length ? ` (${moved(held).join('; ')})` : ''}`)
          await testInfo.attach(`layout-shift-${route.slice(1).replace(/\//g, '-')}-${width}-${scheme}.json`, { body: JSON.stringify(figures, null, 2), contentType: 'application/json' })
          expect(held.lineSeen, 'the loading line was on screen while the code was held').toBe(true)
          expect(held.heldFiles.length, 'the page\'s code was asked for and held').toBeGreaterThan(0)
          if (on) {
            expect(natural.total, `as a first visit comes: ${JSON.stringify(natural.shifts)}`).toBeLessThan(0.1)
            expect(held.total, `with the code held back: ${JSON.stringify(held.shifts)}`).toBeLessThan(0.1)
          } else if (route === '/membership' && width === 1280) {
            // Today's short loading line: the footer drops out of the window as the page comes, which the measure sees.
            expect(held.total, 'today\'s shift, which the measure must see').toBeGreaterThan(0.1)
          }
          expect([...natural.external, ...held.external, ...external]).toEqual([])
        })
      }
    }
  }
})

// ── The browser bar's colour (AC20) ────────────────────────────────────────

/** The page's theme colour as the browser works it out: the first theme-color meta whose media matches the device, or that has none. */
const barColour = (page: Page) =>
  page.evaluate(() => {
    for (const meta of document.querySelectorAll('meta')) {
      if ((meta.getAttribute('name') ?? '').toLowerCase() !== 'theme-color') continue
      const content = meta.getAttribute('content')?.trim()
      if (!content) continue
      const media = meta.getAttribute('media')?.trim()
      if (media && !window.matchMedia(media).matches) continue
      return content
    }
    return null
  })

/** Every theme-color meta in the page, in order. */
const barMetas = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({
      content: m.getAttribute('content'),
      media: m.getAttribute('media'),
      own: m.getAttribute('data-appearance'),
      first: m === document.head.firstElementChild,
    })),
  )

/** The two metas index.html gives, as the page holds them. */
const INDEX_METAS = [
  { content: BAR.light, media: '(prefers-color-scheme: light)', own: null, first: false },
  { content: BAR.dark, media: '(prefers-color-scheme: dark)', own: null, first: false },
]

/** What the page's colour should be: the pick's look, or the device's own on System. */
const expectedBar = (pick: 'System' | 'Light' | 'Dark', device: 'light' | 'dark') => (pick === 'Light' ? BAR.light : pick === 'Dark' ? BAR.dark : BAR[device])

test.describe('the browser bar\'s colour follows an Appearance pick', () => {
  test.use({ reducedMotion: 'reduce' })
  const appearance = appearanceControl

  test('a11y-on: for System, Light and Dark picked in the Appearance control, on a light and on a dark device, the page\'s colour is the pick\'s look, or the device\'s for System', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    const seen: Record<string, unknown> = {}
    for (const device of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: device })
      await page.goto('/')
      await expect(appearance(page)).toBeVisible()
      expect(await barColour(page), `${device} device, nothing picked`).toBe(BAR[device])
      for (const pick of ['Dark', 'Light', 'System', 'Light', 'Dark', 'System'] as const) {
        await appearance(page).getByRole('button', { name: pick }).click()
        await expect(appearance(page).getByRole('button', { name: pick })).toHaveAttribute('aria-pressed', 'true')
        const colour = await barColour(page)
        const metas = await barMetas(page)
        seen[`${device} device, ${pick}`] = { colour, metas }
        expect(colour, `${device} device, ${pick}`).toBe(expectedBar(pick, device))
        const own = metas.filter((m) => m.own !== null)
        expect(own, `${device} device, ${pick}`).toHaveLength(pick === 'System' ? 0 : 1)
        if (own.length) expect(own[0]).toEqual({ content: expectedBar(pick, device), media: null, own: pick.toLowerCase(), first: true })
        expect(metas.filter((m) => m.own === null)).toEqual(INDEX_METAS)
      }
    }
    await testInfo.attach('bar-colour-picks.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on: from the first paint, before the app\'s script runs, a stored Light or Dark gives the page that colour, and System the device\'s', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    // Without the app's script at all, so only the script in the head has run.
    await page.route(/\/assets\/index-[\w-]+\.js$/, (route) => route.abort())
    const seen: Record<string, unknown> = {}
    for (const device of ['light', 'dark'] as const) {
      for (const pick of ['System', 'Light', 'Dark'] as const) {
        const stored = pick === 'System' ? null : pick.toLowerCase()
        await page.emulateMedia({ colorScheme: device })
        // The choice is put in this address's storage first, as an earlier visit would have left it.
        await page.goto('/', { waitUntil: 'load' })
        await page.evaluate(([key, value]) => {
          if (value) window.localStorage.setItem(key, value)
          else window.localStorage.removeItem(key)
        }, [APPEARANCE_KEY, stored] as const)
        await page.goto('/', { waitUntil: 'load' })
        const app = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0)
        expect(app, 'the app\'s script did not run').toBe(0)
        const colour = await barColour(page)
        const metas = await barMetas(page)
        seen[`${pick} on a ${device} device`] = { colour, metas }
        expect(colour, `${pick} on a ${device} device, from the first paint`).toBe(expectedBar(pick, device))
        const own = metas.filter((m) => m.own !== null)
        expect(own, `${pick} on a ${device} device`).toHaveLength(pick === 'System' ? 0 : 1)
        if (own.length) expect(own[0]).toEqual({ content: expectedBar(pick, device), media: null, own: stored, first: true })
        expect(metas.filter((m) => m.own === null)).toEqual(INDEX_METAS)
      }
    }
    await testInfo.attach('bar-colour-first-paint.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on: a localStorage that throws leaves System, from the first paint and with the app running, and a pick still applies for the visit', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    for (const device of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: device })
      await page.goto('/')
      await expect(appearance(page)).toBeVisible()
      expect(await barColour(page), device).toBe(BAR[device])
      expect((await barMetas(page)).filter((m) => m.own !== null)).toEqual([])
      await appearance(page).getByRole('button', { name: device === 'light' ? 'Dark' : 'Light' }).click()
      expect(await barColour(page), `${device} device, a pick for the visit`).toBe(device === 'light' ? BAR.dark : BAR.light)
    }
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on: a pick survives a reload, from the first paint and once the app runs, with one meta of its own', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await appearance(page).getByRole('button', { name: 'Dark' }).click()
    expect(await barColour(page)).toBe(BAR.dark)
    await page.reload()
    await expect(appearance(page).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(await barColour(page)).toBe(BAR.dark)
    expect((await barMetas(page)).filter((m) => m.own !== null)).toEqual([{ content: BAR.dark, media: null, own: 'dark', first: true }])
    await page.emulateMedia({ colorScheme: 'dark' })
    await appearance(page).getByRole('button', { name: 'Light' }).click()
    await page.reload()
    expect(await barColour(page)).toBe(BAR.light)
    await appearance(page).getByRole('button', { name: 'System' }).click()
    expect(await barColour(page)).toBe(BAR.dark)
    expect((await barMetas(page)).filter((m) => m.own !== null)).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-off: whatever is stored, the page has index.html\'s two metas and no other, and follows the device', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    for (const stored of ['dark', 'light'] as const) {
      await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [APPEARANCE_KEY, stored] as const)
      for (const device of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: device })
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        expect(await barMetas(page), `${stored} stored, ${device} device`).toEqual(INDEX_METAS)
        expect(await barColour(page), `${stored} stored, ${device} device`).toBe(BAR[device])
      }
    }
    expect(external).toEqual([])
  })
})

// ── The rings (AC19, its first half) ───────────────────────────────────────

test.describe('the rings on the banners\' gold and on the chrome', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  /** The banners' three controls on the gold: the announcement's link and dismiss button, and the Exit button. */
  const goldControls = (page: Page) => [
    page.getByRole('link', { name: GOLD_ANNOUNCEMENT.linkLabel }),
    page.getByRole('button', { name: `Dismiss: ${GOLD_ANNOUNCEMENT.linkLabel}` }),
    page.getByRole('button', { name: 'Exit' }),
  ]

  test('a11y-on: the gold banners\' controls have a navy ring, at 3:1 or more on the gold, in the light look and in dark mode', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    await stubAnnouncement(page)
    await plantImpersonation(page)
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openQuiet(page, '/')
      for (const control of goldControls(page)) {
        await keyboardFocus(page, control)
        const ring = await ringOf(control)
        const ground = await control.evaluate((el) => getComputedStyle(el.closest('[data-ring-ground="gold"]')!).backgroundColor)
        const name = await control.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '')
        seen[`${scheme} ${name}`] = { ring, ground, ratio: ratio(ring.colour, ground) }
        expect(ground, name).toBe(GOLD)
        expect([ring.style, ring.width], name).toEqual(['solid', '2px'])
        expect(ring.colour, `${scheme} ${name}`).toBe(NAVY)
        expect(ratio(ring.colour, ground), `${scheme} ${name}`).toBeGreaterThanOrEqual(3)
      }
    }
    await testInfo.attach('banner-rings.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-off: the marker changes nothing; each control on the gold keeps the browser\'s own focus outline, the same with the marker taken away', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    await stubAnnouncement(page)
    await plantImpersonation(page)
    await openQuiet(page, '/')
    for (const control of goldControls(page)) {
      await keyboardFocus(page, control)
      const marked = await ringOf(control)
      // Take the marker off the gold ground around the control, focus it again the same way, and put the marker back.
      await control.evaluate((el) => {
        const ground = el.closest('[data-ring-ground="gold"]') as HTMLElement
        ground.removeAttribute('data-ring-ground')
        ground.setAttribute('data-ring-ground-was', 'gold')
      })
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
      await keyboardFocus(page, control)
      const unmarked = await ringOf(control)
      await control.evaluate((el) => {
        const ground = el.closest('[data-ring-ground-was]') as HTMLElement
        ground.setAttribute('data-ring-ground', 'gold')
        ground.removeAttribute('data-ring-ground-was')
      })
      expect(marked).toEqual(unmarked)
      expect(marked.colour).not.toBe(NAVY)
    }
    expect(external).toEqual([])
  })

  test('a11y-on: the chrome\'s rules on the fixture page: gold on a navy ground, the look\'s own ring on a light surface inside it, light and dark, at 3:1 or more', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/__fixtures/base')
      const container = page.locator('[data-fixture="base"]')
      await expect(container).toBeVisible()
      // The fixture container as a navy chrome ground, as a header or footer will mark itself.
      await container.evaluate((el) => {
        el.setAttribute('data-ring-ground', 'navy')
        ;(el as HTMLElement).style.backgroundColor = 'rgb(26, 39, 68)'
        const surface = document.createElement('div')
        surface.setAttribute('data-ring-ground', 'light')
        surface.className = 'bg-popover p-4'
        surface.id = 'fixture-light-surface'
        const row = document.createElement('button')
        row.type = 'button'
        row.textContent = 'A row of a light menu'
        surface.append(row)
        el.append(surface)
      })
      const register = container.getByRole('button', { name: 'Register' })
      await keyboardFocus(page, register)
      const onNavy = await ringOf(register)
      const navyGround = await container.evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(navyGround).toBe(NAVY)
      expect(onNavy.colour, `${scheme}: on the navy ground`).toBe(GOLD)
      expect(ratio(onNavy.colour, navyGround)).toBeGreaterThanOrEqual(3)

      const row = page.getByRole('button', { name: 'A row of a light menu' })
      await keyboardFocus(page, row)
      const onLight = await ringOf(row)
      const lightGround = await page.locator('#fixture-light-surface').evaluate((el) => getComputedStyle(el).backgroundColor)
      expect(lightGround, scheme).toBe(scheme === 'light' ? WHITE : NAVY)
      expect(onLight.colour, `${scheme}: on the light surface`).toBe(scheme === 'light' ? NAVY : GOLD)
      expect(ratio(onLight.colour, lightGround), scheme).toBeGreaterThanOrEqual(3)
      seen[scheme] = { onNavy, navyGround, onLight, lightGround }
    }
    await testInfo.attach('chrome-rings.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on: a light surface put inside a bg-brand-navy band keeps the band\'s gold ring, which is why no chrome surface sits inside one', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/__fixtures/base')
    const container = page.locator('[data-fixture="base"]')
    await expect(container).toBeVisible()
    await container.evaluate((el) => {
      const band = document.createElement('div')
      band.className = 'bg-brand-navy p-4'
      const surface = document.createElement('div')
      surface.setAttribute('data-ring-ground', 'light')
      surface.className = 'bg-raised p-4'
      surface.id = 'fixture-surface-in-band'
      const row = document.createElement('button')
      row.type = 'button'
      row.textContent = 'A row inside the band'
      surface.append(row)
      band.append(surface)
      el.append(band)
    })
    const row = page.getByRole('button', { name: 'A row inside the band' })
    await keyboardFocus(page, row)
    const ring = await ringOf(row)
    const ground = await page.locator('#fixture-surface-in-band').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(ground).toBe(WHITE)
    // The band's rule sets the ring's colour outright, and the light surface's --focus does not reach it.
    expect(ring.colour).toBe(GOLD)
    expect(ratio(ring.colour, ground)).toBeLessThan(3)
    expect(external).toEqual([])
  })
})

// ── The new desktop header (WS02's header) ─────────────────────────────────

/** The widths the new header is drawn at with the chrome on: 1024 pixels and up. */
const DESKTOP = [1024, 1280, 1440] as const
/** The About menu's current row in the light look: "You are here" in #705718 on the row's #f3eedc. */
const HERE_WORDS = 'rgb(112, 87, 24)'
const HERE_ROW = 'rgb(243, 238, 220)'
/** The current section's line: two pixels of the gold for dark grounds, drawn inside its box. */
const SECTION_LINE = `${GOLD} 0px -2px 0px 0px inset`
/** A ground with nothing drawn on it. */
const CLEAR = 'rgba(0, 0, 0, 0)'
/** The shadows of a computed box-shadow that draw something: Tailwind writes its ring layers too, clear until a ring is asked for. */
const drawnShadows = (shadow: string) => (shadow === 'none' ? [] : shadow.split(/,(?![^(]*\))/).map((layer) => layer.trim()).filter((layer) => !layer.startsWith(CLEAR)))
/** The six sections in their order, as src/lib/nav.ts lists them; test/unit/site-header.test.tsx holds the header to that file. */
const SECTION_WORDS = ['Tournaments', 'Clubs', 'Scholastic', 'News', 'Membership', 'About'] as const
/**
 * The About menu's seven rows on the a11y-on build, with newAbout and
 * newNews off, as src/lib/nav.ts gives them: each row's title and the page
 * it opens. The browser tests cannot load that file;
 * test/unit/site-header-menus.test.tsx holds the menu to it.
 */
const ABOUT_ROWS = [
  ['About LCA', '/about'],
  ['Board & regions', '/governance/board'],
  ['Bylaws & rules', '/governance/bylaws'],
  ['Minutes', '/governance/minutes'],
  ['Annual meeting', '/meeting'],
  ['State champions', '/champions'],
  ['Contact', '/contact'],
] as const
/** The About menu's last row, below a line: the association's Facebook page, in a new tab. */
const FACEBOOK_ROW = ['LCA on Facebook ↗', 'https://www.facebook.com/LouisianaChessAssociation'] as const
/** Today's header's menu button below 1024 pixels, while its drawer is shut. */
const OPEN_MENU = 'Open menu'

/** Opens a page and waits until the header is drawn and the fonts are in, so every width in the row is final. */
async function openHeader(page: Page, route: string) {
  await page.goto(route)
  await expect(siteHeader(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
}

/** The new header's About button, which opens the About menu. */
const aboutButton = (page: Page) => siteHeader(page).getByRole('button', { name: NEW_NAMES.about })
/** The panel the About menu draws while it is open. */
const aboutPanel = (page: Page) => siteHeader(page).locator('[data-slot="about-menu"]')
/** The panel the My LCA menu draws while it is open. */
const myLcaPanel = (page: Page) => siteHeader(page).locator('[data-slot="my-lca-menu"]')

/** The rows of an open menu, in order: each row's title (without "You are here"), the page it opens, its mark and its kind. */
const rowsOf = (panel: Locator) =>
  panel.locator('li').evaluateAll((items) =>
    items.map((li) => {
      const control = li.querySelector('a, button')!
      const words = (control.querySelector('span') ?? control).textContent?.trim() ?? ''
      return { words, href: control.getAttribute('href'), current: control.getAttribute('aria-current'), kind: control.tagName.toLowerCase() }
    }),
  )

/**
 * The new header's row as drawn: the header's box and ground, the brand
 * link, the six sections and the utilities in the row's order, each with
 * its box, its words, its padding, its line, its mark of the current page
 * and whether any of its words wrapped onto a second line.
 */
function rowAsDrawn(page: Page) {
  return page.evaluate((site) => {
    const header = document.querySelector(site.header)!
    const wraps = (el: Element) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent?.trim()) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        if (range.getClientRects().length > 1) return true
      }
      return false
    }
    const part = (el: Element) => {
      const box = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      return {
        words: (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
        x: box.x, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height,
        padding: [s.paddingLeft, s.paddingRight],
        line: s.boxShadow,
        underline: s.textDecorationLine,
        current: el.getAttribute('aria-current'),
        wraps: wraps(el),
      }
    }
    const brand = header.querySelector(site.brandLink)!
    const mark = brand.querySelector(site.mark)
    const box = header.getBoundingClientRect()
    return {
      window: { width: window.innerWidth, scrollY: window.scrollY },
      page: { scrollWidth: document.documentElement.scrollWidth },
      header: { top: box.top, bottom: box.bottom, width: box.width, height: box.height, ground: getComputedStyle(header).backgroundColor, scrollWidth: header.scrollWidth, clientWidth: header.clientWidth },
      brand: { ...part(brand), name: brand.getAttribute('aria-label'), ground: getComputedStyle(brand).backgroundColor, markFirst: !!mark && brand.firstElementChild === mark, markHidden: mark?.getAttribute('aria-hidden') ?? null, markGround: mark ? getComputedStyle(mark).backgroundColor : null },
      sections: [...header.querySelectorAll('[data-slot="site-header-sections"] > a, [data-slot="site-header-sections"] > div > button')].map(part),
      utilities: [...header.querySelectorAll('[data-slot="site-header-donate"] > *, [data-slot="site-header-account"] > a, [data-slot="site-header-account"] > div > button')].map(part),
    }
  }, SITE)
}

/** How far the row has given way: whether Donate and the two-line name are drawn, and what stays in the bar. */
function squeezeAsDrawn(page: Page) {
  return page.evaluate((site) => {
    const header = document.querySelector(site.header)!
    const drawn = (el: Element | null) => !!el && !(el as HTMLElement).hidden && el.getBoundingClientRect().width > 0
    const inBar = (el: Element) => drawn(el) && el.getBoundingClientRect().right <= window.innerWidth && el.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom
    return {
      donate: drawn(header.querySelector('[data-slot="site-header-donate"]')),
      name: drawn(header.querySelector('[data-slot="site-header-name"]')),
      sections: [...header.querySelectorAll('[data-slot="site-header-sections"] > a, [data-slot="site-header-sections"] > div > button')].filter(inBar).length,
      account: [...header.querySelectorAll('[data-slot="site-header-account"] > a, [data-slot="site-header-account"] > div > button')].filter(inBar).map((el) => (el.textContent ?? '').trim()),
      height: header.getBoundingClientRect().height,
      window: { width: window.innerWidth, height: window.innerHeight },
      fits: header.scrollWidth <= header.clientWidth,
    }
  }, SITE)
}

test.describe('the new desktop header with the chrome on', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 1024, 1280 and 1440 by 800, signed out: one navy row 64 pixels tall that keeps its height and its place when the page scrolls 600 pixels, led by the brand link named for the home page with its mark hidden and no plate, then the six sections with 12 pixels a side, then Donate, Log in and Join LCA, nothing overlapping or wrapping and nothing wider than the window', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', DESKTOP, 'the new header\'s row, from 1024 pixels up')
    const seen: Record<string, unknown> = {}
    for (const width of DESKTOP) {
      await page.setViewportSize({ width, height: 800 })
      await openQuiet(page, '/')
      await expect(siteHeader(page), `${width}: one header`).toHaveCount(1)
      await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
      await expect(rookMark(page)).toHaveCount(1)
      const drawn = await rowAsDrawn(page)
      // One navy row, 64 pixels tall, no wider than the window.
      expect(drawn.header.height, `${width}`).toBe(64)
      expect(drawn.header.ground, `${width}`).toBe(NAVY)
      expect(drawn.header.width, `${width}`).toBeLessThanOrEqual(width)
      expect(drawn.header.scrollWidth, `${width}: nothing in the header runs past it`).toBeLessThanOrEqual(drawn.header.clientWidth)
      expect(drawn.page.scrollWidth, `${width}: the page is no wider than the window`).toBeLessThanOrEqual(width)
      // The brand link: its name, and the rook mark first in it, hidden from screen readers, on no plate.
      expect(drawn.brand.name).toBe(NEW_NAMES.home)
      expect(drawn.brand.markFirst, `${width}: the mark leads the link`).toBe(true)
      expect(drawn.brand.markHidden).toBe('true')
      expect([drawn.brand.ground, drawn.brand.markGround], `${width}: no plate behind the mark`).toEqual([CLEAR, CLEAR])
      // The six sections in order, 12 pixels a side, then the utilities in theirs.
      expect(drawn.sections.map((s) => s.words), `${width}`).toEqual([...SECTION_WORDS])
      for (const s of drawn.sections) expect(s.padding, `${width}: ${s.words}`).toEqual(['12px', '12px'])
      expect(drawn.utilities.map((u) => u.words), `${width}`).toEqual([NEW_NAMES.donate, CHROME_NAMES.logIn, CHROME_NAMES.joinLca])
      // One row: every part inside the header, each after the one before it, and every word on one line.
      const parts = [drawn.brand, ...drawn.sections, ...drawn.utilities]
      for (const [i, p] of parts.entries()) {
        expect(p.top, `${width}: ${p.words} inside the header`).toBeGreaterThanOrEqual(drawn.header.top)
        expect(p.bottom, `${width}: ${p.words} inside the header`).toBeLessThanOrEqual(drawn.header.bottom)
        if (i > 0) expect(p.x, `${width}: ${p.words} after ${parts[i - 1].words}, not over it`).toBeGreaterThanOrEqual(parts[i - 1].right - 0.5)
      }
      for (const p of [...drawn.sections, ...drawn.utilities]) expect(p.wraps, `${width}: ${p.words} on one line`).toBe(false)
      // It keeps its height and its place at the top of the window when the page scrolls.
      await page.evaluate(() => window.scrollTo(0, 600))
      await frames(page)
      const scrolled = await rowAsDrawn(page)
      expect(scrolled.window.scrollY, `${width}: the page scrolled`).toBe(600)
      expect([scrolled.header.top, scrolled.header.height], `${width}: after the scroll`).toEqual([0, 64])
      expect(scrolled.sections.map((s) => Math.round(s.x)), `${width}: the sections where they were`).toEqual(drawn.sections.map((s) => Math.round(s.x)))
      seen[width] = { drawn, scrolled: scrolled.header }
    }
    await testInfo.attach('new-header-row.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on at 1280: the section a page is in carries aria-current="page" and the gold line at its foot, on /tournaments, /clubs, /scholastic, /news, /membership and /governance/minutes, and no section does on /; the line moves nothing in the row', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s sections')
    const pages: [string, string | null][] = [
      ['/', null],
      ['/tournaments', 'Tournaments'],
      ['/clubs', CHROME_NAMES.clubs],
      ['/scholastic', 'Scholastic'],
      ['/news', 'News'],
      ['/membership', 'Membership'],
      ['/governance/minutes', NEW_NAMES.about],
    ]
    let first: number[][] | null = null
    for (const [route, section] of pages) {
      await openHeader(page, route)
      const drawn = await rowAsDrawn(page)
      expect(drawn.sections.filter((s) => s.current === 'page').map((s) => s.words), route).toEqual(section === null ? [] : [section])
      for (const s of drawn.sections) expect(drawnShadows(s.line), `${route}: ${s.words}`).toEqual(s.current === 'page' ? [SECTION_LINE] : [])
      expect(drawn.header.height, route).toBe(64)
      // Every section where it stands on the home page, the current one too.
      const boxes = drawn.sections.map((s) => [Math.round(s.x), Math.round(s.width), Math.round(s.height)])
      if (first === null) first = boxes
      else expect(boxes, `${route}: the sections stand as they do on /`).toEqual(first)
    }
    expect(external).toEqual([])
  })

  test('a11y-on at 1280 in forced colours, which draw no shadow: the section a page is in is underlined in place of its gold line, on /tournaments and /governance/minutes, and none is on /; a section under the pointer is underlined too; the underline moves nothing in the row, and outside forced colours no section is underlined', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s sections')
    // Outside forced colours the gold line marks the current section, and nothing is underlined.
    await openHeader(page, '/tournaments')
    for (const s of (await rowAsDrawn(page)).sections) {
      expect(s.underline, `${s.words}, outside forced colours`).toBe('none')
      expect(drawnShadows(s.line), `${s.words}, outside forced colours`).toEqual(s.current === 'page' ? [SECTION_LINE] : [])
    }
    await page.emulateMedia({ forcedColors: 'active' })
    // The pointer kept off the row, so no section is under it until the case puts it there.
    await page.mouse.move(640, 700)
    const pages: [string, string | null][] = [
      ['/', null],
      ['/tournaments', 'Tournaments'],
      ['/governance/minutes', NEW_NAMES.about],
    ]
    let first: number[][] | null = null
    const tournaments: Record<string, Buffer> = {}
    for (const [route, section] of pages) {
      await openHeader(page, route)
      const drawn = await rowAsDrawn(page)
      expect(drawn.sections.filter((s) => s.current === 'page').map((s) => s.words), route).toEqual(section === null ? [] : [section])
      for (const s of drawn.sections) {
        // Forced colours drop the gold line, so the current section is underlined instead.
        expect(drawnShadows(s.line), `${route}: ${s.words}, no shadow in forced colours`).toEqual([])
        expect(s.underline, `${route}: ${s.words}`).toBe(s.current === 'page' ? 'underline' : 'none')
      }
      const boxes = drawn.sections.map((s) => [Math.round(s.x), Math.round(s.width), Math.round(s.height)])
      if (first === null) first = boxes
      else expect(boxes, `${route}: the sections stand as they do on /`).toEqual(first)
      tournaments[route] = await siteHeader(page).getByRole('link', { name: 'Tournaments', exact: true }).screenshot()
    }
    // The underline is drawn: with no shadow left to tell them apart, Tournaments on its own page is not drawn as on /, and on a page of another section it is.
    expect(tournaments['/tournaments'].equals(tournaments['/']), 'Tournaments, underlined on /tournaments').toBe(false)
    expect(tournaments['/governance/minutes'].equals(tournaments['/']), 'Tournaments, not current on /governance/minutes').toBe(true)
    // A section under the pointer is underlined as well, since the hover's line is a shadow too.
    await openHeader(page, '/')
    const clubs = siteHeader(page).getByRole('link', { name: CHROME_NAMES.clubs, exact: true })
    expect(await clubs.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none')
    await clubs.hover()
    await frames(page)
    expect(await clubs.evaluate((el) => getComputedStyle(el).textDecorationLine), 'Clubs under the pointer').toBe('underline')
    expect(drawnShadows(await clubs.evaluate((el) => getComputedStyle(el).boxShadow)), 'no shadow in forced colours').toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on at 1280 on /governance/minutes, light and dark: a click opens the About menu, with aria-expanded and aria-controls naming its panel; its seven rows and LCA on Facebook ↗ in order, Minutes marked "You are here", rgb(112, 87, 24) on rgb(243, 238, 220) at 13 pixels and weight 600 in the light look, and in the menu\'s ink in dark mode, on a white or a #1a2744 ground; a hover opens nothing; a click outside and a change of page close it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s About menu')
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openHeader(page, '/governance/minutes')
      const about = aboutButton(page)
      const panel = aboutPanel(page)
      await expect(about).toHaveAttribute('aria-current', 'page')
      await expect(about).toHaveAttribute('aria-expanded', 'false')
      expect(await about.getAttribute('aria-controls'), `${scheme}: no panel to name while it is shut`).toBeNull()
      expect(await about.getAttribute('aria-haspopup')).toBeNull()
      // A hover opens nothing.
      await about.hover()
      await page.waitForTimeout(300)
      await expect(about).toHaveAttribute('aria-expanded', 'false')
      await expect(panel).toHaveCount(0)
      // A click opens it, and the button names the panel it shows.
      await about.click()
      await expect(about).toHaveAttribute('aria-expanded', 'true')
      await expect(panel).toBeVisible()
      expect(await about.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'))
      const rows = await rowsOf(panel)
      expect(rows.map((r) => [r.words, r.href]), scheme).toEqual(ABOUT_ROWS.map(([words, href]) => [words, href]))
      expect(rows.filter((r) => r.current === 'page').map((r) => r.words), `${scheme}: the one current row`).toEqual(['Minutes'])
      const facebook = panel.getByRole('link', { name: FACEBOOK_ROW[0] })
      await expect(facebook).toHaveAttribute('href', FACEBOOK_ROW[1])
      await expect(facebook).toHaveAttribute('target', '_blank')
      // The current row's name is its title alone: "You are here" is for the eye, and aria-current says it to a screen reader.
      await expect(panel.getByRole('link', { name: 'Minutes', exact: true })).toHaveAttribute('aria-current', 'page')
      const here = await panel.locator('[aria-current="page"]').evaluate((row) => {
        const words = row.querySelector('[aria-hidden="true"]')!
        const s = getComputedStyle(words)
        const menu = row.closest('[data-slot="about-menu"]')!
        return {
          words: words.textContent?.trim(), colour: s.color, size: s.fontSize, weight: s.fontWeight,
          row: getComputedStyle(row).backgroundColor, ground: getComputedStyle(menu).backgroundColor, ink: getComputedStyle(menu).color,
        }
      })
      seen[scheme] = { rows, here }
      expect(here.words).toBe('You are here')
      expect([here.size, here.weight], scheme).toEqual(['13px', '600'])
      if (scheme === 'light') {
        expect([here.colour, here.row, here.ground]).toEqual([HERE_WORDS, HERE_ROW, WHITE])
      } else {
        // In dark mode the row takes the look's muted ground and the words the menu's ink, never the gold.
        expect(here.colour, 'the menu\'s ink').toBe(here.ink)
        expect(here.row).not.toBe(HERE_ROW)
        expect(here.ground).toBe(NAVY)
      }
      expect(ratio(here.colour, here.row), scheme).toBeGreaterThanOrEqual(4.5)
      // A click outside closes it.
      await page.mouse.click(8, 500)
      await expect(about).toHaveAttribute('aria-expanded', 'false')
      await expect(panel).toHaveCount(0)
      // A change of page closes it: opened on /clubs once that page has arrived, it is shut once Back returns to the minutes.
      const clubs = siteHeader(page).getByRole('link', { name: CHROME_NAMES.clubs, exact: true })
      await clubs.click()
      await expect(page).toHaveURL(/\/clubs$/)
      await expect(clubs, 'the header drawn for /clubs').toHaveAttribute('aria-current', 'page')
      await about.click()
      await expect(about).toHaveAttribute('aria-expanded', 'true')
      await page.goBack()
      await expect(page).toHaveURL(/\/governance\/minutes$/)
      await expect(about, 'the header drawn for the minutes again').toHaveAttribute('aria-current', 'page')
      await expect(about).toHaveAttribute('aria-expanded', 'false')
      await expect(panel).toHaveCount(0)
    }
    await testInfo.attach('about-menu.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on at 1280 on /governance/minutes: the About menu by keyboard, Enter and Space toggle it, ArrowDown opens it on its first row and ArrowUp on its last, the arrow keys move through its rows and wrap, Home and End reach the first and the last, Esc closes it and gives the focus back to About, and Tab past its last row closes it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s About menu')
    await openHeader(page, '/governance/minutes')
    const about = aboutButton(page)
    const panel = aboutPanel(page)
    const row = (name: string) => panel.getByRole('link', { name, exact: true })
    const [first, second, last] = [row(ABOUT_ROWS[0][0]), row(ABOUT_ROWS[1][0]), row(FACEBOOK_ROW[0])]
    await keyboardFocus(page, about)
    for (const key of ['Enter', 'Space'] as const) {
      await page.keyboard.press(key)
      await expect(about, `${key} opens it`).toHaveAttribute('aria-expanded', 'true')
      await expect(panel).toBeVisible()
      await expect(about, `${key} leaves the focus on About`).toBeFocused()
      await page.keyboard.press(key)
      await expect(about, `${key} shuts it`).toHaveAttribute('aria-expanded', 'false')
      await expect(panel).toHaveCount(0)
    }
    await page.keyboard.press('ArrowDown')
    await expect(first, 'ArrowDown opens it on its first row').toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(second).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(first).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(last, 'ArrowUp from the first row goes round to the last').toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(first, 'ArrowDown from the last row goes round to the first').toBeFocused()
    await page.keyboard.press('End')
    await expect(last).toBeFocused()
    await page.keyboard.press('Home')
    await expect(first).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(about).toHaveAttribute('aria-expanded', 'false')
    await expect(about, 'Esc gives the focus back to About').toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(last, 'ArrowUp opens it on its last row').toBeFocused()
    await page.keyboard.press('Tab')
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.donate }), 'Tab goes on in the page\'s order').toBeFocused()
    await expect(about).toHaveAttribute('aria-expanded', 'false')
    await expect(panel).toHaveCount(0)
    expect(external).toEqual([])
  })

  test('a11y-on at 1024 by 800, signed out: as the row gets tighter it gives way in its order, Donate first, to the About menu\'s last row above LCA on Facebook ↗, where it opens the donation dialog, then the two-line name, the brand link keeping its name; no section, Log in or Join LCA leaves the bar, and the window and the header\'s height stay as they were', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1024], 'the new header\'s squeeze')
    await page.setViewportSize({ width: 1024, height: 800 })
    await openQuiet(page, '/')
    const words = siteHeader(page).locator('[data-slot="site-header-name"]')
    const steps: { spacing: number; donate: boolean; name: boolean }[] = []
    let triedTheMenu = false
    let after = 0
    // The row made tighter a pixel of letter spacing at a time on its two-line name, the window and the header as they are.
    for (let spacing = 0; spacing <= 60 && after < 3; spacing++) {
      await words.evaluate((el, px) => {
        ;(el as HTMLElement).style.letterSpacing = `${px}px`
      }, spacing)
      await frames(page)
      await frames(page)
      const now = await squeezeAsDrawn(page)
      steps.push({ spacing, donate: now.donate, name: now.name })
      const at = `at ${spacing} pixels of letter spacing`
      expect(now.window, at).toEqual({ width: 1024, height: 800 })
      expect(now.height, at).toBe(64)
      expect(now.fits, `${at}: nothing runs past the header`).toBe(true)
      expect(now.sections, `${at}: all six sections in the bar`).toBe(6)
      expect(now.account, `${at}: Log in and Join LCA in the bar`).toEqual([CHROME_NAMES.logIn, CHROME_NAMES.joinLca])
      if (!now.donate && now.name && !triedTheMenu) {
        // Donate has left the bar: it is the About menu's last row, above the Facebook row, and opens the same dialog.
        triedTheMenu = true
        await aboutButton(page).click()
        const panel = aboutPanel(page)
        await expect(panel).toBeVisible()
        const rows = await rowsOf(panel)
        expect(rows.map((r) => r.words), at).toEqual([...ABOUT_ROWS.map(([title]) => title), NEW_NAMES.donate])
        expect(rows.at(-1)?.kind).toBe('button')
        await expect(panel.getByRole('link', { name: FACEBOOK_ROW[0] })).toBeVisible()
        await panel.getByRole('button', { name: NEW_NAMES.donate }).click()
        const dialog = page.getByRole('dialog', { name: 'Support the Louisiana Chess Association' })
        await expect(dialog).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(1)
        await page.keyboard.press('Escape')
        await expect(dialog).toHaveCount(0)
        await expect(aboutButton(page), 'the focus back on About, whose row opened it').toBeFocused()
      }
      if (!now.name) {
        // The name is hidden; the link keeps its name and its mark.
        await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
        await expect(rookMark(page)).toBeVisible()
        after++
      }
    }
    await testInfo.attach('squeeze-steps.json', { body: JSON.stringify(steps, null, 2), contentType: 'application/json' })
    // The order: everything in the bar, then Donate gone, then the name too, and never back while the row stays tight.
    const level = (s: { donate: boolean; name: boolean }) => (s.donate && s.name ? 0 : !s.donate && s.name ? 1 : !s.donate && !s.name ? 2 : -1)
    const levels = steps.map(level)
    expect(levels[0], 'everything in the bar at first').toBe(0)
    expect(levels, 'Donate never goes before the name, and nothing comes back').toEqual([...levels].sort((a, b) => a - b))
    expect(levels).not.toContain(-1)
    expect(new Set(levels)).toEqual(new Set([0, 1, 2]))
    expect(triedTheMenu).toBe(true)
    expect(external).toEqual([])
  })

  /** What the slot after Log in or My LCA holds, by the person's membership, in the words of each test's name. */
  const SLOT_WORDS = {
    'signed-out': 'Join LCA, the gold button, last in the row',
    'active-member': 'no Join LCA and no Renew',
    'renews-soon': 'no Join LCA and no Renew',
    'expired-member': 'nothing while the member loads, then Renew, the gold button, last in the row',
  } as const
  for (const key of ['signed-out', 'active-member', 'renews-soon', 'expired-member'] as const) {
    const person = navPersona(key)
    test(`a11y-on at 1280, ${person.title}: ${SLOT_WORDS[key]}`, async ({ page, external, baseURL }, testInfo) => {
      only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [1280], 'the new header\'s join slot')
      const own = new URL(baseURL!).origin
      const visit = await signInAs(page, person, baseURL!)
      const joinLca = siteHeader(page).getByRole('link', { name: CHROME_NAMES.joinLca })
      const renew = siteHeader(page).getByRole('link', { name: NEW_NAMES.renew })
      const slot = key === 'signed-out' ? joinLca : key === 'expired-member' ? renew : null
      const holding = key === 'expired-member'
      let release = () => {}
      if (holding) {
        // The member's answers held at first: nothing in the slot while the member loads.
        const held = new Promise<void>((resolve) => (release = resolve))
        await page.route(
          (url) => url.origin === own && (url.pathname === '/api/me' || url.pathname === '/api/board/my-seats'),
          async (route) => {
            await held
            await route.fallback()
          },
        )
      }
      await page.goto('/')
      if (person.user) {
        await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca }), visit.notRead).toBeVisible()
        if (holding) {
          await expect(joinLca, 'while the member loads').toHaveCount(0)
          await expect(renew, 'while the member loads').toHaveCount(0)
          release()
        }
        await waitForMemberAnswers(visit)
      }
      await expect(joinLca).toHaveCount(slot === joinLca ? 1 : 0)
      await expect(renew).toHaveCount(slot === renew ? 1 : 0)
      if (slot !== null) {
        await expect(slot).toHaveAttribute('href', '/membership')
        const drawn = await slot.evaluate((el) => {
          const s = getComputedStyle(el)
          const before = el.previousElementSibling
          return { fill: s.backgroundColor, words: s.color, last: el.nextElementSibling === null, after: before ? before.getBoundingClientRect().right <= el.getBoundingClientRect().left : false }
        })
        expect(drawn, key).toEqual({ fill: GOLD, words: NAVY, last: true, after: true })
      }
      expect(visit.apiErrors).toEqual([])
      expect(external).toEqual([])
    })
  }

  for (const key of ['active-member', 'director', 'admin'] as const) {
    const person = navPersona(key)
    test(`a11y-on at 1280, ${person.title}: the My LCA menu holds the person's rows with Log out last, opens and shuts by the keys About has, and Log out from it signs the person out and goes to the home page`, async ({ page, external, baseURL }, testInfo) => {
      only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [1280], 'the new header\'s My LCA menu')
      const visit = await signInAs(page, person, baseURL!)
      await page.goto('/tournaments')
      const myLca = siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })
      const panel = myLcaPanel(page)
      await expect(myLca, visit.notRead).toBeVisible()
      await waitForMemberAnswers(visit)
      await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toHaveCount(0)
      await expect(myLca).toHaveAttribute('aria-expanded', 'false')
      await myLca.click()
      await expect(panel).toBeVisible()
      expect(await myLca.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'))
      const rows = await rowsOf(panel)
      expect(rows.map((r) => r.words)).toEqual([...person.myLcaMenuRows])
      expect(rows.at(-1)).toEqual({ words: NEW_NAMES.logOut, href: null, current: null, kind: 'button' })
      for (const r of rows.slice(0, -1)) expect(r.kind, r.words).toBe('a')
      expect(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(WHITE)
      // Esc shuts it and gives the focus back; ArrowDown opens it on its first row, End reaches Log out.
      await page.keyboard.press('Escape')
      await expect(myLca).toHaveAttribute('aria-expanded', 'false')
      await expect(myLca).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(panel.getByRole('link').first()).toBeFocused()
      await page.keyboard.press('End')
      const logOut = panel.getByRole('button', { name: NEW_NAMES.logOut })
      await expect(logOut).toBeFocused()
      // Log out, from the keyboard.
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(new URL('/', baseURL).href)
      await expect(siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })).toBeVisible()
      await expect(myLca).toHaveCount(0)
      expect(await sessionInPage(page)).toBeNull()
      expect(visit.apiErrors).toEqual([])
      expect(external).toEqual([])
    })
  }

  test('a11y-on at 1280, signed out: Log in on /tournaments?when=weekend#list hands /login that whole address, path, query and hash, as the page to come back to, and /login keeps it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s Log in')
    const address = '/tournaments?when=weekend#list'
    await openHeader(page, address)
    const here = new URL(page.url())
    expect(`${here.pathname}${here.search}${here.hash}`).toBe(address)
    const logIn = siteHeader(page).getByRole('link', { name: CHROME_NAMES.logIn })
    await logIn.click()
    await expect(page).toHaveURL(/\/login$/)
    // The router keeps a location's state in the page's history entry, under usr.
    const handed = () => page.evaluate(() => (window.history.state as { usr?: unknown } | null)?.usr ?? null)
    expect(await handed()).toEqual({ from: address })
    // On /login itself, Log in keeps the page it was handed.
    await logIn.click()
    await expect(page).toHaveURL(/\/login$/)
    expect(await handed()).toEqual({ from: address })
    expect(external).toEqual([])
  })

  test('a11y-on at 1280: Donate in the bar opens today\'s donation dialog, drawn once, and Esc closes it with nothing sent and the focus back on Donate', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s Donate')
    const sent: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/donations')) sent.push(`${request.method()} ${request.url()}`)
    })
    await openQuiet(page, '/')
    const donate = siteHeader(page).getByRole('button', { name: NEW_NAMES.donate })
    await donate.click()
    const dialog = page.getByRole('dialog', { name: 'Support the Louisiana Chess Association' })
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(donate).toBeFocused()
    expect(sent, 'nothing sent').toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on: the new header writes --header-h, 64 pixels at 1280, which the page\'s scroll padding reads, so a link reached by Tab under the header is scrolled clear of it; at 390, where today\'s header stands in, nothing writes it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    const root = () =>
      page.evaluate(() => ({
        written: document.documentElement.style.getPropertyValue('--header-h'),
        padding: getComputedStyle(document.documentElement).scrollPaddingTop,
      }))
    await page.setViewportSize({ width: 1280, height: 800 })
    await openQuiet(page, '/')
    await ifNew(testInfo, 'header', 1280, 'the new header\'s height on the root, and a link under it reached by Tab', async () => {
      expect(await root()).toEqual({ written: '64px', padding: '64px' })
      // A link of the main well down the page, and the control before it in the page's order.
      const picked = await page.evaluate(() => {
        const stops = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
          .filter((el) => el.getClientRects().length > 0)
        // Down the page, and not so far down that the page cannot scroll it up under the header.
        const room = document.documentElement.scrollHeight - window.innerHeight
        const fits = (el: HTMLElement) => {
          const top = el.getBoundingClientRect().top + window.scrollY
          return el.matches('main a[href]') && top > 300 && top < room
        }
        const at = stops.findLastIndex(fits)
        if (at < 1) return null
        stops[at].setAttribute('data-tab-target', '')
        stops[at - 1].setAttribute('data-tab-before', '')
        return (stops[at].textContent ?? '').replace(/\s+/g, ' ').trim()
      })
      expect(picked, 'a link in the main, down the page').not.toBeNull()
      const target = page.locator('[data-tab-target]')
      /** Puts the link under the header, reaches it by Tab from the control before it, and says where it is then drawn. */
      const reach = async () => {
        await target.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 16))
        expect(await target.evaluate((el) => el.getBoundingClientRect().top), 'the link under the header').toBeLessThan(64)
        await page.locator('[data-tab-before]').evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }))
        await page.keyboard.press('Tab')
        await expect(target).toBeFocused()
        return target.evaluate((el, site) => ({ top: el.getBoundingClientRect().top, under: document.querySelector(site.header)!.getBoundingClientRect().bottom }), SITE)
      }
      // With the padding taken off for a moment, the link is left under the header: the measure sees what the padding does.
      await page.evaluate(() => document.documentElement.style.setProperty('scroll-padding-top', '0px'))
      const unpadded = await reach()
      expect(unpadded.top, 'with no scroll padding, the link is left under the header').toBeLessThan(unpadded.under)
      await page.evaluate(() => document.documentElement.style.removeProperty('scroll-padding-top'))
      expect(await root()).toEqual({ written: '64px', padding: '64px' })
      const padded = await reach()
      await testInfo.attach('scrolled-clear.json', { body: JSON.stringify({ picked, unpadded, padded }, null, 2), contentType: 'application/json' })
      // The page scrolls by whole pixels, so the link's top can sit half a pixel short of the header's foot.
      expect(padded.top, `"${picked}" is drawn below the header`).toBeGreaterThanOrEqual(padded.under - 1)
    })
    // Below 1024 pixels today's header stands in and writes nothing: the new header takes its height off as it goes.
    await page.setViewportSize({ width: 390, height: 844 })
    await frames(page)
    await ifToday(testInfo, 'header', 390, 'today\'s header at 390 pixels, which writes no --header-h', async () => {
      await expect(siteHeader(page)).toHaveCount(1)
      expect(await root(), 'after the window narrows').toEqual({ written: '', padding: '0px' })
      await openQuiet(page, '/')
      expect(await root(), 'a page opened at 390 pixels').toEqual({ written: '', padding: '0px' })
    })
    expect(external).toEqual([])
  })

  test('a11y-on below 1024 pixels: today\'s header stands in, at 390 with its menu button and the drawer that marks the page it is on, and at 768 with Tournaments and Clubs in the bar, the rook mark at both', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the chrome is on on a11y-on, where today\'s header stands in below 1024 pixels')
    onlyToday(testInfo, 'header', [390, 768], 'today\'s header, which stands in below 1024 pixels until the tablet header and the app bar are built')
    // Today's Clubs link, found by the page it opens: the bar's, or the drawer's once it is open.
    const clubs = siteHeader(page).locator('a[href="/clubs"]:visible')
    const marked = siteHeader(page).locator('[aria-current="page"]:visible')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHeader(page, '/clubs')
    await expect(siteHeader(page)).toHaveCount(1)
    await expect(rookMark(page)).toBeVisible()
    await siteHeader(page).getByRole('button', { name: OPEN_MENU }).click()
    await expect(clubs).toBeVisible()
    await expect(clubs).toHaveAttribute('aria-current', 'page')
    await expect(marked, '390: the one link marked, in the drawer').toHaveCount(1)
    await page.setViewportSize({ width: 768, height: 1024 })
    await openHeader(page, '/clubs')
    await expect(siteHeader(page)).toHaveCount(1)
    await expect(rookMark(page)).toBeVisible()
    await expect(siteHeader(page).getByRole('link', { name: 'Tournaments', exact: true })).toBeVisible()
    await expect(clubs).toBeVisible()
    await expect(clubs).toHaveAttribute('aria-current', 'page')
    await expect(marked, '768: the one link marked, in the bar').toHaveCount(1)
    expect(external).toEqual([])
  })

  test('a11y-off: today\'s header marks the page it is on with aria-current, in the bar and the More menu at 1280 and in the drawer at 390, and marks nothing on /', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    onlyToday(testInfo, 'header', [1280, 390], 'today\'s header, its More menu and its drawer')
    // Today's Clubs link, found by the page it opens: the bar's, or the drawer's once it is open.
    const clubs = siteHeader(page).locator('a[href="/clubs"]:visible')
    const marked = siteHeader(page).locator('[aria-current="page"]:visible')
    await page.setViewportSize({ width: 1280, height: 800 })
    await openHeader(page, '/')
    await expect(siteHeader(page).locator('[aria-current]')).toHaveCount(0)
    await openHeader(page, '/clubs')
    await expect(clubs).toHaveAttribute('aria-current', 'page')
    await expect(marked, '1280: the one link marked, in the bar').toHaveCount(1)
    await openHeader(page, '/support')
    await expect(siteHeader(page).locator('[aria-current]'), 'the More menu shut: nothing marked in the bar').toHaveCount(0)
    await siteHeader(page).getByRole('button', { name: TODAYS_NAMES.more }).hover()
    await expect(siteHeader(page).getByRole('menuitem', { name: 'Support' })).toHaveAttribute('aria-current', 'page')
    await expect(marked, '1280: the one row marked, in the More menu').toHaveCount(1)
    await page.setViewportSize({ width: 390, height: 844 })
    await openHeader(page, '/clubs')
    await siteHeader(page).getByRole('button', { name: OPEN_MENU }).click()
    await expect(clubs).toBeVisible()
    await expect(clubs).toHaveAttribute('aria-current', 'page')
    await expect(marked, '390: the one link marked, in the drawer').toHaveCount(1)
    expect(external).toEqual([])
  })
})

// ── The new desktop header at its edges ────────────────────────────────────

/** Every finding axe makes, one line each, for the report. */
function axeFindings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** The WCAG 2.0 to 2.2 A and AA rules, as the brand and smoke specs run them. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Which header is drawn and what it writes on the page's root: the header's data-slot, --header-h and the scroll padding. */
function headerState(page: Page) {
  return page.evaluate((site) => {
    const header = document.querySelector(site.header)
    return {
      slot: header?.getAttribute('data-slot') ?? null,
      written: document.documentElement.style.getPropertyValue('--header-h'),
      padding: getComputedStyle(document.documentElement).scrollPaddingTop,
    }
  }, SITE)
}

/**
 * The row's level as drawn and its room by the layout's own measure: the
 * free space the utilities' auto margin takes up, how far the utilities run
 * past the row's padding, and the name's width while it is drawn.
 */
function rowRoom(page: Page) {
  return page.evaluate((site) => {
    const header = document.querySelector(site.header)!
    const row = header.querySelector('[data-slot="site-header-row"]') as HTMLElement
    const name = header.querySelector('[data-slot="site-header-name"]') as HTMLElement
    const donate = header.querySelector('[data-slot="site-header-donate"]') as HTMLElement
    const utilities = row.lastElementChild as HTMLElement
    const end = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)
    return {
      level: name.hidden ? 2 : donate.hidden ? 1 : 0,
      free: parseFloat(getComputedStyle(utilities).marginLeft),
      over: utilities.getBoundingClientRect().right - end,
      name: name.getBoundingClientRect().width,
    }
  }, SITE)
}

test.describe('the new desktop header at its edges', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on: the window narrowed below 1024 pixels and widened again swaps the two headers in place, with no new page load and one banner at a time, and --header-h is written only while the new header is drawn', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280, 1024], 'the new header at 1280 pixels and drawn again at 1024')
    await page.setViewportSize({ width: 1280, height: 800 })
    await openQuiet(page, '/')
    // A mark on the page itself, which a new page load would lose.
    await page.evaluate(() => ((window as unknown as { fxSamePage: boolean }).fxSamePage = true))
    await expect(siteHeader(page)).toHaveCount(1)
    expect(await headerState(page)).toEqual({ slot: 'site-header', written: '64px', padding: '64px' })
    await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
    // A pixel under 1024: the new header goes, and takes its height with it.
    await page.setViewportSize({ width: 1023, height: 800 })
    await expect(siteHeader(page)).toHaveCount(1)
    await ifToday(testInfo, 'header', 1023, 'today\'s header standing in at 1023 pixels, which writes no --header-h', async () => {
      await expect(siteHeader(page)).not.toHaveAttribute('data-slot', 'site-header')
      await expect(siteHeader(page).getByRole('button', { name: OPEN_MENU })).toBeVisible()
      expect(await headerState(page)).toEqual({ slot: null, written: '', padding: '0px' })
    })
    // At 1024 the new header is back, drawn in the same page.
    await page.setViewportSize({ width: 1024, height: 800 })
    await expect(siteHeader(page)).toHaveAttribute('data-slot', 'site-header')
    await expect(siteHeader(page)).toHaveCount(1)
    await expect.poll(() => headerState(page)).toEqual({ slot: 'site-header', written: '64px', padding: '64px' })
    await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
    await expect(rookMark(page)).toHaveCount(1)
    expect(await page.evaluate(() => (window as unknown as { fxSamePage?: boolean }).fxSamePage), 'the same page, never loaded again').toBe(true)
    expect(external).toEqual([])
  })

  test('a11y-on at 1280 on /governance/minutes, signed out, light and dark: axe finds nothing in the header with the About menu open', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s About menu')
    const report: string[] = []
    const found: string[] = []
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openHeader(page, '/governance/minutes')
      const about = siteHeader(page).getByRole('button', { name: NEW_NAMES.about })
      await about.click()
      await expect(about).toHaveAttribute('aria-expanded', 'true')
      await expect(siteHeader(page).locator('[data-slot="about-menu"]')).toBeVisible()
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).include(SITE.header).analyze()
      report.push(`axe on the header with the About menu open (${scheme}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`)
      found.push(...axeFindings(results).map((f) => `${scheme}: ${f}`))
      // The rules a menu of links and its colours must pass were run, not left out.
      const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
      for (const rule of ['color-contrast', 'link-name', 'button-name', 'aria-valid-attr-value', 'aria-allowed-attr', 'target-size']) expect(ran, `${scheme}: ${rule}`).toContain(rule)
    }
    console.log(report.join('\n'))
    expect(found, report.join('\n')).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on at 1280, signed in as an LCA admin, light and dark: axe finds nothing in the header with the My LCA menu open', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s My LCA menu')
    const visit = await signInAs(page, navPersona('admin'), baseURL!)
    const report: string[] = []
    const found: string[] = []
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/tournaments')
      const myLca = siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })
      await expect(myLca, visit.notRead).toBeVisible()
      await waitForMemberAnswers(visit)
      await page.evaluate(() => document.fonts.ready)
      await myLca.click()
      await expect(myLca).toHaveAttribute('aria-expanded', 'true')
      await expect(siteHeader(page).locator('[data-slot="my-lca-menu"]')).toBeVisible()
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).include(SITE.header).analyze()
      report.push(`axe on the header with the My LCA menu open (${scheme}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`)
      found.push(...axeFindings(results).map((f) => `${scheme}: ${f}`))
      const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
      for (const rule of ['color-contrast', 'link-name', 'button-name']) expect(ran, `${scheme}: ${rule}`).toContain(rule)
    }
    console.log(report.join('\n'))
    expect(found, report.join('\n')).toEqual([])
    expect(visit.apiErrors).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on at 1280, signed out: Donate\'s dialog, given an amount, asks for one checkout and moves this very tab to the payment page, opening no window and no new page', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s Donate')
    const own = new URL(baseURL!).origin
    // The checkout answered in the browser, with a made-up payment page of the site's own address, so nothing is written and nothing outside is asked.
    const paymentUrl = `${own}/fx-payment-page?session=fx-donation`
    const asked: string[] = []
    await page.route(
      (url) => url.origin === own && url.pathname === '/api/donations/checkout',
      (route) => {
        asked.push(`${route.request().method()} ${route.request().postData() ?? ''}`)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paymentId: 'fx-pay-browser', paymentUrl }) })
      },
    )
    await page.route(
      (url) => url.origin === own && url.pathname === '/fx-payment-page',
      (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Payment</title><h1>A made-up payment page</h1></html>' }),
    )
    // Every window.open the page makes is counted, on whatever page it is.
    let opened = 0
    await page.exposeFunction('fxWindowOpened', () => {
      opened++
    })
    await page.addInitScript(() => {
      const open = window.open.bind(window)
      window.open = (...args: Parameters<typeof window.open>) => {
        void (window as unknown as { fxWindowOpened: () => Promise<void> }).fxWindowOpened()
        return open(...args)
      }
    })
    const popups: string[] = []
    page.on('popup', (popup) => popups.push(popup.url()))
    await page.setViewportSize({ width: 1280, height: 800 })
    await openQuiet(page, '/')
    await siteHeader(page).getByRole('button', { name: NEW_NAMES.donate }).click()
    const dialog = page.getByRole('dialog', { name: 'Support the Louisiana Chess Association' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Amount (USD)').fill('25')
    await dialog.getByRole('button', { name: 'Continue to payment' }).click()
    await page.waitForURL(paymentUrl)
    await expect(page.getByRole('heading', { level: 1, name: 'A made-up payment page' })).toBeVisible()
    expect(page.url()).toBe(paymentUrl)
    expect(asked).toEqual(['POST {"amount":25}'])
    expect(opened, 'window.open').toBe(0)
    expect(popups, 'new pages').toEqual([])
    expect(page.context().pages()).toHaveLength(1)
    expect(external).toEqual([])
  })

  test('a11y-on at 1280, signed out: Esc pressed while Donate\'s checkout is asked for closes the dialog, and when the answer comes this tab stays where it is; opened again, the dialog has its amount and its button back, and Continue then moves the tab to the payment page', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s Donate')
    const own = new URL(baseURL!).origin
    // The checkouts answered in the browser, with a made-up payment page of the site's own address, so nothing is written and nothing outside is asked.
    const paymentUrl = `${own}/fx-payment-page?session=fx-donation-again`
    const asked: string[] = []
    const shown: string[] = []
    // The first checkout is held until the donor has closed the dialog; the next is answered at once.
    let answerFirst!: () => void
    const firstHeld = new Promise<void>((resolve) => {
      answerFirst = resolve
    })
    await page.route(
      (url) => url.origin === own && url.pathname === '/api/donations/checkout',
      async (route) => {
        asked.push(`${route.request().method()} ${route.request().postData() ?? ''}`)
        if (asked.length === 1) await firstHeld
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ paymentId: `fx-pay-held-${asked.length}`, paymentUrl }) })
      },
    )
    await page.route(
      (url) => url.origin === own && url.pathname === '/fx-payment-page',
      (route) => {
        shown.push(route.request().url())
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="en"><title>Payment</title><h1>A made-up payment page</h1></html>' })
      },
    )
    await page.setViewportSize({ width: 1280, height: 800 })
    await openQuiet(page, '/')
    const home = page.url()
    const donate = siteHeader(page).getByRole('button', { name: NEW_NAMES.donate })
    await donate.click()
    const dialog = page.getByRole('dialog', { name: 'Support the Louisiana Chess Association' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Amount (USD)').fill('25')
    await dialog.getByRole('button', { name: 'Continue to payment' }).click()
    await expect(dialog.getByRole('button', { name: 'Starting checkout…' })).toBeDisabled()
    // The donor changes their mind while the checkout is asked for.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(donate).toBeFocused()
    const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/donations/checkout')
    answerFirst()
    await answered
    // Opened again, the button comes back once the answer has been taken in, and the tab never left.
    await donate.click()
    await expect(dialog.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()
    await expect(dialog.getByLabel('Amount (USD)')).toHaveValue('25')
    expect(page.url(), 'this tab stayed where it was').toBe(home)
    expect(shown, 'the payment page, never asked for').toEqual([])
    // A new press asks again, and this time the tab goes to the payment page.
    await dialog.getByRole('button', { name: 'Continue to payment' }).click()
    await page.waitForURL(paymentUrl)
    await expect(page.getByRole('heading', { level: 1, name: 'A made-up payment page' })).toBeVisible()
    expect(asked).toEqual(['POST {"amount":25}', 'POST {"amount":25}'])
    expect(shown).toEqual([paymentUrl])
    expect(page.context().pages()).toHaveLength(1)
    expect(external).toEqual([])
  })

  for (const [key, width] of [['signed-out', 1024], ['expired-member', 1280]] as const) {
    const person = navPersona(key)
    test(`a11y-on at ${width} by 800, ${person.title}: the row gives way exactly where its parts stop fitting inside its padding, by the layout's own measure, half a pixel either side of each step`, async ({ page, external, baseURL }, testInfo) => {
      only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the new header\'s squeeze')
      await page.setViewportSize({ width, height: 800 })
      const visit = person.user ? await signInAs(page, person, baseURL!) : null
      await page.goto('/')
      await expect(siteHeader(page)).toBeVisible()
      if (visit) {
        await expect(siteHeader(page).getByRole('link', { name: NEW_NAMES.renew }), visit.notRead).toBeVisible()
        await waitForMemberAnswers(visit)
      }
      await page.evaluate(() => document.fonts.ready)
      await frames(page)
      const name = siteHeader(page).locator('[data-slot="site-header-name"]')
      /** Gives the two-line name a width of its own, the window and everything else as they are, and waits for the row to answer. */
      const widen = async (px: number) => {
        await name.evaluate((el, w) => {
          ;(el as HTMLElement).style.width = `${w}px`
        }, px)
        await frames(page)
        await frames(page)
      }
      const seen: Record<string, unknown>[] = []
      const start = await rowRoom(page)
      expect(start.level, 'everything in the bar at first').toBe(0)
      // Half a pixel short of the edge, then half a pixel past it: first Donate's step, then the name's.
      for (const [step, level] of [[0, 1], [1, 2]] as const) {
        const at = await rowRoom(page)
        expect(at.level).toBe(step)
        const edge = at.name + at.free
        await widen(edge - 0.5)
        const short = await rowRoom(page)
        seen.push({ step, edge, short })
        expect(short.level, `${step}: with half a pixel to spare`).toBe(step)
        expect(short.free, `${step}: the half pixel the layout leaves`).toBeCloseTo(0.5, 1)
        await widen(edge + 0.5)
        const over = await rowRoom(page)
        seen.push({ step, edge, over })
        expect(over.level, `${step}: half a pixel over`).toBe(level)
        expect(over.over, `${step}: nothing past the row's padding once it has given way`).toBeLessThanOrEqual(0.02)
      }
      await testInfo.attach('squeeze-edges.json', { body: JSON.stringify({ start, seen }, null, 2), contentType: 'application/json' })
      // Every section and the account stay in the bar, the header's height as it was.
      await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
      expect(await page.evaluate((site) => document.querySelector(site.header)!.getBoundingClientRect().height, SITE)).toBe(64)
      if (visit) expect(visit.apiErrors).toEqual([])
      expect(external).toEqual([])
    })
  }

  test('a11y-on at 1280: a tab left open across a deploy, whose donation dialog\'s file has gone, reloads once on the first press of Donate, and then opens the dialog', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280], 'the new header\'s Donate')
    // The first ask for the dialog's file meets the gone file of an older build; every later ask is answered as the build answers it.
    let asked = 0
    await page.route(
      (url) => /\/assets\/DonateButton-[\w-]+\.js$/.test(url.pathname),
      (route) => (++asked === 1 ? route.fulfill({ status: 404, contentType: 'text/plain', body: 'Not found' }) : route.fallback()),
    )
    await page.setViewportSize({ width: 1280, height: 800 })
    await openQuiet(page, '/')
    expect(await page.evaluate(() => window.sessionStorage.getItem('lca-stale-reload'))).toBeNull()
    const reloaded = page.waitForEvent('load')
    await siteHeader(page).getByRole('button', { name: NEW_NAMES.donate }).click()
    await reloaded
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.donate })).toBeVisible()
    expect(await page.evaluate(() => window.sessionStorage.getItem('lca-stale-reload')), 'the one reload this tab gets').not.toBeNull()
    await siteHeader(page).getByRole('button', { name: NEW_NAMES.donate }).click()
    const dialog = page.getByRole('dialog', { name: 'Support the Louisiana Chess Association' })
    await expect(dialog).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    expect(asked).toBe(2)
    expect(external).toEqual([])
  })

  test('a11y-off at 1280 and 390: the page\'s root has no --header-h and no scroll padding, as today', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    onlyToday(testInfo, 'header', [1280, 390], 'today\'s header, which writes no --header-h')
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height })
      await openQuiet(page, '/')
      expect(await headerState(page), `${width}`).toEqual({ slot: null, written: '', padding: 'auto' })
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-look')), `${width}: the new look is off`).toBeNull()
    }
    expect(external).toEqual([])
  })
})
