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
//
// Reads only; the announcement and the impersonation target are stubbed in
// the browser with made-up fixture data in the seed's style.
import type { Browser, Locator, Page, Route, TestInfo } from '@playwright/test'
import { expect, openDrawn, prepareLocalPage, test } from './support'

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
  return page.getByRole('link', { name: SKIP }).evaluate((el) => {
    const s = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    const atMiddle = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    const header = document.querySelector('header')
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
  })
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
          await expect(page.locator('header a[href="/"]'), scheme).toBeFocused()
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
    const brand = page.locator('header a[href="/"]')
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
      await page.keyboard.press('Tab')
      await expect(page.locator('header a[href="/"]'), route).toBeFocused()
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
 */
function watchShifts() {
  const w = window as unknown as Watched
  w.__shifts = []
  const describe = (node: Node | null, before: DOMRectReadOnly, after: DOMRectReadOnly) => {
    const el = node instanceof Element ? node : node?.parentElement ?? null
    const area = !el ? 'gone' : el.closest('footer') ? 'footer' : el.closest('header') ? 'header' : el.closest('main') ? 'main' : el.tagName.toLowerCase()
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
    await page.addInitScript(watchShifts)
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
  const appearance = (page: Page) => page.getByRole('group', { name: 'Appearance' })

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
