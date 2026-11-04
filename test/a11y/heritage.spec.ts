// test/a11y/heritage.spec.ts
//
// The heritage look on its six pages in the browser (WS01 step 31). With
// themeHeritage on (a11y-on, where newLook is on too) HeritageLayout draws
// /about, /governance/board, /governance/bylaws, /governance/minutes,
// /meeting and /champions inside a heritage scope; with it off (a11y-off)
// the six are drawn as they always were.
//
// - The home page's network log, on both builds: while / loads and settles
//   nothing asks for the heritage stylesheet or its four font files. So that
//   this means something, /about asks for the stylesheet and the display
//   face on a11y-on, and for neither on a11y-off.
// - The layout shift on /about and /governance/bylaws, at 390 by 844 and
//   1280 by 800 pixels, light and dark on a11y-on (light on a11y-off, the
//   pages as they are today, for comparison), counted from the start of the
//   navigation by an observer in place before the page's scripts run. On
//   a11y-on the heading enters the page in the display face, so the
//   stylesheet was in place before the look's content painted. The faces
//   are held back until the page and its documents are drawn, so the shift
//   of their swap is counted apart from the shift of the page's own arrival
//   (the page taking the place of the site's loading line, which every page
//   loaded on demand has). Both are printed; the swap stays under 0.1.
// - The stylesheet held back keeps the page's loading line up, for three
//   seconds at most: held longer, the page is drawn in the base type and
//   takes the look's type when the file arrives. One that fails once is
//   asked for afresh and the page still first paints in the look's type;
//   one that cannot be loaded at all lets the page draw in the base type
//   after one fresh try.
// - Controls look the same inside heritage and base (AC13): each Button,
//   the text field, every status tag and pill, the dots, the chips and the
//   date blocks, a focused Button and field with their ring and a Button
//   under the pointer, each copied alone onto the same plain box at the
//   same place in the base and the heritage fixture of the same run and
//   shot with room for the ring, compare byte for byte, light and dark. A
//   Button given a colour one step off is caught.
// - On each of the six pages (AC12): the page sits in the heritage scope, a
//   div inside the site's one main, with the header and the footer outside
//   it; nothing in the scope takes the base look's accent face, and the
//   display face is only on the hooked heading. With themeHeritage off no
//   scope, hook, rule or seal is drawn. The base scope inside the heritage
//   fixture draws the base look's controls.
// - The paper ground runs down to the footer on a short page.
// - axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing on
//   /about, /governance/minutes and /champions, light and dark, at 1280 and
//   390 pixels. Nothing goes in known-violations.json.
// - Moving inside the site, from the home page to each of the six and from
//   page to page, through the router with no input event first, with the
//   page's code, its faces and its data (documents, board and champions)
//   held back in turn: as the page arrives, nothing in the header or the
//   page moves, and on a11y-on the layout's loading box stands while the
//   code is held; where the page's loading state fills the window (About,
//   Annual meeting, Bylaws) nothing in view moves at all, under 0.1 at 390
//   by 844 and 1280 by 800 on both builds, while on the other three the
//   footer follows the page's short loading line, as it does on a11y-off.
//   The faces' swap stays under 0.1; it and the data's arrival are printed.
// - The ornaments and the cards as drawn on a11y-on, light and dark: each
//   thick-thin rule is a 6px box, 3px solid on top and 1px solid below, in
//   the look's ink, which keeps 3:1 on the look's ground in dark mode too;
//   the one seal is 64px, a navy disc with two gold rings and the white rook
//   in its middle, on the navy band, and is not drawn on a phone; every
//   hooked card and table frame, and the About page's logo frame, has 2px
//   corners; the heading's face is the value of --font-display itself.
// - The header and the footer draw on each of the six pages exactly as on
//   the home page, light and dark, and the footer's navy ground is painted
//   as it is there: the layout's ground, cast down as a shadow, never shows
//   over it.
// - The same-run check is not blind: a focused Button whose ring is one
//   step off, and a Button whose ground is one step off, differ from base in
//   light and in dark mode, while the same two drawn as they are match.
//
// Reads only; the one answer stubbed is the documents list on the short
// page, given as empty, and the moves inside the site hold the pages' data
// back until the page has arrived, then let the real answers through.
//
// The header and the footer are read through test/a11y/chrome.ts, the code
// that runs inside the page with its selectors, SITE. Everything read of
// them here holds for any header and footer, today's or the new ones.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, Route } from '@playwright/test'
import { SITE, siteFooter, type SiteSelectors } from './chrome'
import { DRAWN_TIMEOUT, expect, openDrawn, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** The look's stylesheet as the build names it, with or without the query of a fresh try. */
const HERITAGE_CSS = /\/assets\/heritage-[\w-]+\.css(?:\?.*)?$/
/** Its four font files: the display face's two and the text face's two. */
const HERITAGE_FONTS = /\/assets\/(?:libre-caslon-display|source-serif-4)-[\w-]+\.woff2?(?:\?.*)?$/
/** The display face's file, as a browser that reads woff2 asks for it. */
const CASLON = /\/assets\/libre-caslon-display-[\w-]+\.woff2(?:\?.*)?$/
/** How a computed family in the display face begins: --font-display, Caslon first. */
const DISPLAY_FAMILY = '"Libre Caslon Display"'
const LOADING = 'Loading…'
/** The longest the layout holds a page for its stylesheet, in milliseconds (HOLD_AT_MOST_MS in src/lib/scopeStylesheets.ts). */
const HOLD_MS = 3000

/** The six heritage pages: the route, its heading, and words its data or its copy draws. */
const PAGES = [
  { route: '/about', heading: 'About LCA', drawn: 'Who we are' },
  { route: '/governance/board', heading: 'Board & regional leadership', drawn: 'Fixture Secretary' },
  { route: '/governance/bylaws', heading: 'Bylaws & rules', drawn: 'Fixture bylaws' },
  { route: '/governance/minutes', heading: 'Meeting minutes', drawn: 'Fixture board meeting minutes' },
  { route: '/meeting', heading: 'Annual business meeting', drawn: 'Join the meeting' },
  { route: '/champions', heading: 'State champions', drawn: 'Avery Fixture' },
] as const
type HeritagePage = (typeof PAGES)[number]
const pageAt = (route: string): HeritagePage => PAGES.find((p) => p.route === route)!

test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

/** What a heritage page shows once it is drawn: its heading and the words of its data. */
function content(page: Page, p: HeritagePage): Locator[] {
  return [page.getByRole('heading', { level: 1, name: p.heading }), page.getByText(p.drawn).first()]
}

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** An address as the server sees it: path and query. */
const local = (url: string) => {
  const u = new URL(url)
  return `${u.pathname}${u.search}`
}

/** axe's findings, one line each, with the colours when the rule is contrast. */
function findings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

/** What the page keeps from the start of the navigation: every layout shift, and the heading as it first entered the page. */
interface Watched {
  __shifts: { value: number; at: number }[]
  __heading: { at: number; family: string; size: string; hook: string | null; sheet: boolean } | null
}

/**
 * Put in place before the page's scripts run (an init script, so it runs
 * again on every load): a buffered layout-shift observer, and a record of
 * the page's heading the moment it is added, before it can paint: its
 * computed family and size, its hook, and whether the look's stylesheet
 * was in the page then.
 */
function watch() {
  const w = window as unknown as Watched
  w.__shifts = []
  w.__heading = null
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) w.__shifts.push({ value: (entry as unknown as { value: number }).value, at: entry.startTime })
  }).observe({ type: 'layout-shift', buffered: true })
  new MutationObserver(() => {
    if (w.__heading) return
    const h1 = document.querySelector('main h1')
    if (!h1) return
    const s = getComputedStyle(h1)
    w.__heading = {
      at: performance.now(),
      family: s.fontFamily,
      size: s.fontSize,
      hook: h1.getAttribute('data-heritage'),
      sheet: [...document.styleSheets].some((sheet) => /\/assets\/heritage-/.test(sheet.href ?? '')),
    }
  }).observe(document, { childList: true, subtree: true })
}

const watched = (page: Page) => page.evaluate(() => {
  const w = window as unknown as Watched
  return { shifts: w.__shifts, heading: w.__heading }
})

const total = (shifts: { value: number }[]) => shifts.reduce((sum, s) => sum + s.value, 0)

// ── The home page's network log (AC11) ───────────────────────────────────────

test.describe('what the home page asks for', () => {
  test('/ asks for no heritage stylesheet and no heritage font file while it loads and settles', async ({ page, external }, testInfo) => {
    const asked: string[] = []
    page.on('request', (request) => asked.push(local(request.url())))
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })).toBeVisible()
    await expect(siteFooter(page)).toBeVisible()
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    // Whatever the page asks for while it sits a moment longer counts too.
    await page.waitForTimeout(1000)
    const heritage = asked.filter((u) => HERITAGE_CSS.test(u) || HERITAGE_FONTS.test(u))
    console.log(`/ on ${testInfo.project.name}: ${asked.length} requests, ${heritage.length} of them for the heritage look`)
    expect(asked.length).toBeGreaterThan(5)
    expect(heritage).toEqual([])
    expect(await page.evaluate(() => ({
      links: document.querySelectorAll('link[rel="stylesheet"][href*="/assets/heritage-"]').length,
      faces: [...document.fonts].filter((face) => /Caslon|Source Serif/.test(face.family)).length,
    }))).toEqual({ links: 0, faces: 0 })
    expect(external).toEqual([])
  })

  test('/about asks for the stylesheet and the display face on a11y-on, and for neither on a11y-off', async ({ page, external }, testInfo) => {
    const asked: string[] = []
    page.on('request', (request) => asked.push(local(request.url())))
    await openDrawn(page, '/about', content(page, pageAt('/about')))
    await page.evaluate(() => document.fonts.ready)
    const css = asked.filter((u) => HERITAGE_CSS.test(u))
    const fonts = asked.filter((u) => HERITAGE_FONTS.test(u))
    console.log(`/about on ${testInfo.project.name}: the stylesheet ${css.join(', ') || 'not asked for'}; font files ${fonts.join(', ') || 'none'}`)
    if (testInfo.project.name === ON) {
      expect(css.length).toBeGreaterThan(0)
      expect(fonts.some((u) => CASLON.test(u))).toBe(true)
    } else {
      expect(css).toEqual([])
      expect(fonts).toEqual([])
    }
    expect(external).toEqual([])
  })
})

// ── The layout shift (AC11) ──────────────────────────────────────────────────

/** Holds the heritage font files back until release is called; lists what was asked for. */
async function holdFonts(page: Page) {
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  const asked: string[] = []
  await page.route(HERITAGE_FONTS, async (route) => {
    asked.push(local(route.request().url()))
    await held
    await route.fallback()
  })
  return { asked, release }
}

/**
 * Opens a heritage page with its faces held back, so never waiting for the
 * network to go quiet, and waits until it is drawn: its heading, its data
 * and no list still loading. A page whose data did not come is loaded once
 * more, as openDrawn does; the observer starts again with it.
 */
async function openHeld(page: Page, p: HeritagePage) {
  for (let load = 1; load <= 2; load++) {
    await page.goto(p.route, { waitUntil: 'commit' })
    try {
      for (const locator of content(page, p)) await locator.waitFor({ state: 'visible', timeout: DRAWN_TIMEOUT })
      await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0, { timeout: DRAWN_TIMEOUT })
      return
    } catch (error) {
      if (load === 2) throw error
      console.log(`${p.route} was not drawn on its first load; loading it once more`)
    }
  }
}

test.describe('the layout shift on two heritage pages', () => {
  for (const route of ['/about', '/governance/bylaws']) {
    for (const [width, height] of [[390, 844], [1280, 800]] as const) {
      for (const scheme of ['light', 'dark'] as const) {
        test(`${route} at ${width} by ${height}, ${scheme}: counted from the start of the navigation, the faces' swap apart from the page's arrival; on a11y-on the heading enters in the display face and the swap stays under 0.1`, async ({ page, external }, testInfo) => {
          const on = testInfo.project.name === ON
          test.skip(!on && scheme === 'dark', 'a11y-off has no dark mode; its light run is the page as it is today, for comparison')
          await page.setViewportSize({ width, height })
          await page.emulateMedia({ colorScheme: scheme })
          await page.addInitScript(watch)
          const fonts = await holdFonts(page)
          await openHeld(page, pageAt(route))
          // The page's own arrival and its data's are counted up to here.
          await page.waitForTimeout(300)
          await frames(page)
          const drawnAt = await page.evaluate(() => performance.now())
          if (on) expect(await page.evaluate(() => document.fonts.check('36px "Libre Caslon Display"')), 'the display face is still held back').toBe(false)
          fonts.release()
          await page.evaluate(() => document.fonts.ready)
          if (on) await expect.poll(() => page.evaluate(() => document.fonts.check('36px "Libre Caslon Display"'))).toBe(true)
          await frames(page)
          await page.waitForTimeout(500)
          const seen = await watched(page)
          const georgia = await page.evaluate(() => {
            const context = document.createElement('canvas').getContext('2d')!
            const width = (font: string) => {
              context.font = font
              return context.measureText('The Louisiana Chess Association, 1915').width
            }
            return width('20px Georgia, monospace') !== width('20px monospace')
          })
          const arrival = total(seen.shifts.filter((s) => s.at <= drawnAt))
          const swap = total(seen.shifts.filter((s) => s.at > drawnAt))
          console.log(`layout shift on ${route} at ${width} by ${height}, ${scheme} (${testInfo.project.name}), ${georgia ? 'Georgia installed' : 'no Georgia on this computer'}: the page's arrival ${arrival.toFixed(4)}, the faces' swap ${swap.toFixed(4)} (from the start of the navigation ${(arrival + swap).toFixed(4)}); held font files ${fonts.asked.join(', ') || 'none'}`)
          await testInfo.attach('layout-shift.json', { body: JSON.stringify({ route, width, height, scheme, georgia, drawnAt, arrival, swap, seen, fonts: fonts.asked }, null, 2), contentType: 'application/json' })
          if (on) {
            // The stylesheet was in place when the heading entered the page, so it painted first in the display face, at its size.
            expect(seen.heading).toMatchObject({ hook: 'display', size: '36px', sheet: true })
            expect(seen.heading!.family.startsWith(DISPLAY_FAMILY), seen.heading!.family).toBe(true)
            expect(fonts.asked.some((u) => CASLON.test(u)), 'the display face was asked for and held').toBe(true)
          } else {
            expect(seen.heading).toMatchObject({ hook: null, sheet: false })
            expect(fonts.asked).toEqual([])
          }
          expect(swap).toBeLessThan(0.1)
          expect(external).toEqual([])
        })
      }
    }
  }
})

// ── The stylesheet on its way (AC11) ─────────────────────────────────────────

test.describe('the heritage stylesheet on its way', () => {
  test('a11y-on: held back, the page waits with its loading line, then its heading first paints in the display face', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
    await page.addInitScript(watch)
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(HERITAGE_CSS, async (route) => {
      await held
      await route.fallback()
    })
    const pageCode = page.waitForResponse((response) => /\/assets\/AboutPage-[\w-]+\.js$/.test(new URL(response.url()).pathname))
    await page.goto('/about', { waitUntil: 'commit' })
    await pageCode
    await page.waitForTimeout(500)
    // The page's code is here and its stylesheet is not, so nothing of the page is drawn yet.
    await expect(page.locator('[data-layout="heritage"] [role="status"]')).toBeVisible()
    await expect(page.locator('main h1')).toHaveCount(0)
    release()
    await expect(page.getByRole('heading', { level: 1, name: 'About LCA' })).toBeVisible()
    const { heading } = await watched(page)
    expect(heading).toMatchObject({ hook: 'display', sheet: true })
    expect(heading!.family.startsWith(DISPLAY_FAMILY), heading!.family).toBe(true)
    expect(external).toEqual([])
  })

  test('a11y-on: held back longer than the layout waits, the page is drawn in the base type after three seconds, and takes the look\'s type when the file arrives', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
    await page.addInitScript(watch)
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const asked: string[] = []
    await page.route(HERITAGE_CSS, async (route) => {
      asked.push(local(route.request().url()))
      await held
      await route.fallback()
    })
    await page.goto('/about', { waitUntil: 'commit' })
    await expect(page.locator('[data-layout="heritage"] [role="status"]')).toBeVisible()
    const heading = page.getByRole('heading', { level: 1, name: 'About LCA' })
    // Drawn while the file is still held back.
    await expect(heading).toBeVisible({ timeout: 4 * HOLD_MS })
    const { heading: first } = await watched(page)
    console.log(`/about on ${testInfo.project.name} with its stylesheet held back: the heading entered the page ${Math.round(first!.at)} ms after the navigation began, in ${first!.family}`)
    // Not before the layout's wait had run out, which began after the navigation did; with its hook, in the base type, and no stylesheet yet.
    expect(first!.at).toBeGreaterThanOrEqual(HOLD_MS)
    expect(first).toMatchObject({ hook: 'display', sheet: false })
    expect(first!.family.startsWith(DISPLAY_FAMILY), first!.family).toBe(false)
    await expect(page.getByRole('heading', { level: 2, name: 'Who we are' })).toBeVisible()
    // The file arrives, and the heading takes the display face.
    release()
    await expect.poll(() => heading.evaluate((h) => getComputedStyle(h).fontFamily)).toMatch(/^"Libre Caslon Display"/)
    expect(asked).toHaveLength(1)
    expect(external).toEqual([])
  })

  test('a11y-on: failing once, it is asked for afresh with a query of its own, and the page still first paints in the look\'s type', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
    await page.addInitScript(watch)
    const asked: { url: string; answer: string }[] = []
    await page.route(HERITAGE_CSS, async (route) => {
      const first = asked.length === 0
      asked.push({ url: local(route.request().url()), answer: first ? 'refused' : 'served' })
      if (first) await route.abort('failed')
      else await route.fallback()
    })
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1, name: 'About LCA' })).toBeVisible()
    await page.waitForTimeout(500)
    expect(asked.map((a) => a.answer)).toEqual(['refused', 'served'])
    expect(asked[1].url).toBe(`${asked[0].url}?retry=1`)
    const { heading } = await watched(page)
    expect(heading).toMatchObject({ hook: 'display', sheet: true })
    expect(heading!.family.startsWith(DISPLAY_FAMILY), heading!.family).toBe(true)
    // The fresh link took the place of the one that failed.
    const links = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .map((link) => new URL(link.href))
      .filter((url) => url.pathname.startsWith('/assets/heritage-'))
      .map((url) => `${url.pathname}${url.search}`))
    expect(links).toEqual([asked[1].url])
    expect(external).toEqual([])
  })

  test('a11y-on: when it cannot be loaded at all, the page is drawn in the base type after one fresh try, and it is not asked for a third time at once', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
    await page.addInitScript(watch)
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    const asked: string[] = []
    await page.route(HERITAGE_CSS, async (route) => {
      asked.push(local(route.request().url()))
      await route.abort('failed')
    })
    await page.goto('/about')
    await expect(page.getByRole('heading', { level: 1, name: 'About LCA' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Who we are' })).toBeVisible()
    await page.waitForTimeout(1000)
    expect(asked).toHaveLength(2)
    expect(asked[1]).toBe(`${asked[0]}?retry=1`)
    const { heading } = await watched(page)
    expect(heading).toMatchObject({ hook: 'display', sheet: false })
    expect(heading!.family.startsWith(DISPLAY_FAMILY), heading!.family).toBe(false)
    expect(await page.evaluate(() => document.querySelectorAll('link[rel="stylesheet"][href*="/assets/heritage-"]').length)).toBe(0)
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
})

// ── Controls inside heritage and base, same run (AC13) ───────────────────────

/** A control to copy onto the plain box: found in a fixture's container by its slot and words, its slot and place, or its id; shown as it is, focused, or under the pointer. */
interface Sample {
  name: string
  slot?: string
  text?: string
  index?: number
  id?: string
  status?: number
  state?: 'focus' | 'hover'
  plant?: string
}

const REGISTER = { slot: 'button', text: 'Register' }
const SEE_DETAILS = { slot: 'button', text: 'See details' }
const ADD_TO_CALENDAR = { slot: 'button', text: 'Add to calendar' }
const FIELD = { id: 'fixture-input' }

/** The controls compared, beside every status the fixture shows (read from the page). */
const CONTROLS: Sample[] = [
  { name: 'Button, default', ...REGISTER },
  { name: 'Button, outline', ...SEE_DETAILS },
  { name: 'Button, secondary', ...ADD_TO_CALENDAR },
  { name: 'Button, link', slot: 'button', text: 'Read the rules' },
  { name: 'Button, gold', slot: 'button', text: 'Join the waitlist' },
  { name: 'Text field', ...FIELD },
  { name: 'Filter chip, pressed', slot: 'filter-chip', index: 0 },
  { name: 'Filter chip, with a count', slot: 'filter-chip', index: 1 },
  { name: 'Filter chip, applied', slot: 'filter-chip', index: -1 },
  { name: 'Status dot, open', slot: 'status-dot', index: 0 },
  { name: 'Status dot, draft', slot: 'status-dot', index: 1 },
  { name: 'Status dot, closed', slot: 'status-dot', index: 2 },
  { name: 'Date block, a date', slot: 'date-block', index: 0 },
  { name: 'Date block, a time', slot: 'date-block', index: 1 },
  { name: 'Date block, with the year', slot: 'date-block', index: 2 },
  { name: 'Button, default, focused', ...REGISTER, state: 'focus' },
  { name: 'Button, outline, focused', ...SEE_DETAILS, state: 'focus' },
  { name: 'Text field, focused', ...FIELD, state: 'focus' },
  { name: 'Button, outline, under the pointer', ...SEE_DETAILS, state: 'hover' },
  { name: 'Button, secondary, under the pointer', ...ADD_TO_CALENDAR, state: 'hover' },
]

/** The plain box behind every copy, the same in both looks. */
const GROUND = { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 18, 32)' } as const
/** Where each copy sits, in whole pixels; its cell's padding leaves room for the focus ring, 2px outside the control. */
const AT = 16

interface Shot {
  png: Buffer
  box: string
  colours: { ground: string; words: string; line: string }
}

/** The statuses on a fixture, in order: the status tags by their slot, a pill by the element round its words. */
async function statusSamples(page: Page, fixture: string): Promise<Sample[]> {
  const names = await page.locator(`[data-fixture="${fixture}"]`).evaluate((container) =>
    [...container.querySelectorAll('[data-status]')].map((el) =>
      `${el.matches('[data-slot="status-badge"]') ? 'status tag' : 'pill'} "${(el.textContent ?? '').trim()}"`))
  return names.map((name, status) => ({ name, status }))
}

/**
 * Shoots each sample alone: a copy of the control, with no id, in a cell at
 * AT pixels on a fixed box of the plain ground laid over the fixture inside
 * its container, so the copy takes the container's look; focused or under
 * the pointer when the sample says so; and a clip of the cell, padding and
 * ring included. The box is made afresh for every sample, so the whole
 * window is painted again: a box used again repaints only around what
 * changed, and the edge of a rounded corner could keep a level of the
 * control shot before it.
 */
async function shoot(page: Page, fixture: string, samples: Sample[], ground: string): Promise<Map<string, Shot>> {
  const container = page.locator(`[data-fixture="${fixture}"]`)
  // A key pressed first, so a control focused from a script shows its ring as it does for a keyboard user.
  await page.keyboard.press('Tab')
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  const shots = new Map<string, Shot>()
  for (const sample of samples) {
    const placed = await container.evaluate((el, { s, at, ground }) => {
      document.getElementById('same-run-stage')?.remove()
      const stage = document.createElement('div')
      stage.id = 'same-run-stage'
      stage.style.cssText = `position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 2147483647; background: ${ground}`
      el.append(stage)
      let original: Element | undefined
      if (s.id) original = el.querySelector(`#${s.id}`) ?? undefined
      else if (s.status !== undefined) {
        const words = el.querySelectorAll('[data-status]')[s.status]
        original = words.matches('[data-slot="status-badge"]') ? words : words.parentElement ?? undefined
      } else {
        const all = [...el.querySelectorAll(`[data-slot="${s.slot}"]`)]
        original = s.text !== undefined ? all.find((c) => c.textContent === s.text) : all.at(s.index ?? 0)
      }
      if (!original) return null
      const copy = original.cloneNode(true) as HTMLElement
      for (const withId of [copy, ...copy.querySelectorAll('[id]')]) withId.removeAttribute('id')
      if (s.plant) copy.style.cssText += s.plant
      const cell = document.createElement('div')
      cell.id = 'same-run-cell'
      cell.style.cssText = `position: absolute; left: ${at}px; top: ${at}px; padding: 12px`
      cell.append(copy)
      stage.append(cell)
      const r = cell.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      const style = getComputedStyle(copy)
      return {
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        clear: hit !== null && cell.contains(hit),
        colours: { ground: style.backgroundColor, words: style.color, line: style.borderTopColor },
      }
    }, { s: sample, at: AT, ground })
    expect(placed, `${sample.name} is on the ${fixture} fixture`).not.toBeNull()
    expect([placed!.left, placed!.top, placed!.clear], `${sample.name}: the cell sits at its place, with nothing over it`).toEqual([AT, AT, true])
    const copy = page.locator('#same-run-cell > *')
    if (sample.state === 'focus') {
      await copy.focus()
      expect(await copy.evaluate((el) => el === document.activeElement && el.matches(':focus-visible')), `${sample.name} shows its ring`).toBe(true)
    }
    if (sample.state === 'hover') await copy.hover()
    const png = await page.screenshot({
      clip: { x: AT, y: AT, width: Math.ceil(placed!.width), height: Math.ceil(placed!.height) },
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    })
    shots.set(sample.name, { png, box: `${placed!.width} by ${placed!.height}`, colours: placed!.colours })
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await page.mouse.move(2, 2)
  }
  return shots
}

/** Opens a fixture and waits until its controls are drawn in their faces. */
async function openFixture(page: Page, fixture: string) {
  await page.goto(`/__fixtures/${fixture}`)
  const container = page.locator(`[data-fixture="${fixture}"]`)
  await expect(container.getByRole('heading', { level: 2, name: 'Every status' })).toBeVisible()
  await expect(container.getByRole('button', { name: 'Register' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/** The samples whose shots differ between the two looks, by name. */
function differing(base: Map<string, Shot>, heritage: Map<string, Shot>): string[] {
  return [...base.keys()].filter((name) => {
    const a = base.get(name)!
    const b = heritage.get(name)!
    return a.box !== b.box || !a.png.equals(b.png)
  })
}

test.describe('controls inside heritage and base, shot in the same run', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a11y-on, ${scheme}: every Button, the field, every status and the rest draw byte for byte the same in both looks, focused and under the pointer too`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the looks differ only under the new look, on a11y-on')
      await page.emulateMedia({ colorScheme: scheme })
      const shots: Record<string, Map<string, Shot>> = {}
      let statuses: Sample[] = []
      for (const fixture of ['base', 'heritage']) {
        await openFixture(page, fixture)
        const found = await statusSamples(page, fixture)
        if (fixture === 'base') statuses = found
        expect(found.map((s) => s.name), 'the same statuses on both fixtures').toEqual(statuses.map((s) => s.name))
        shots[fixture] = await shoot(page, fixture, [...CONTROLS, ...statuses], GROUND[scheme])
      }
      const names = [...shots.base.keys()]
      expect(new Set(names).size, 'every sample has a name of its own').toBe(names.length)
      expect(names.length).toBe(CONTROLS.length + 13)
      const different = differing(shots.base, shots.heritage)
      const report = [
        `${scheme}: ${names.length} controls shot in each look, ${names.length - different.length} the same byte for byte${different.length ? `, differing: ${different.join(', ')}` : ''}.`,
        ...different.map((name) => {
          const [a, b] = [shots.base.get(name)!, shots.heritage.get(name)!]
          return `  ${name}: base ground ${a.colours.ground}, words ${a.colours.words}; heritage ground ${b.colours.ground}, words ${b.colours.words}`
        }),
      ].join('\n')
      console.log(report)
      await testInfo.attach('same-run.json', {
        body: JSON.stringify(names.map((name) => ({ name, same: !different.includes(name), base: shots.base.get(name)!.colours, heritage: shots.heritage.get(name)!.colours, box: shots.base.get(name)!.box })), null, 2),
        contentType: 'application/json',
      })
      // The two shots of each control that differs, to look at.
      for (const name of different) {
        for (const look of ['base', 'heritage']) await testInfo.attach(`${name}, ${look}.png`, { body: shots[look].get(name)!.png, contentType: 'image/png' })
      }
      expect(different, report).toEqual([])

      if (scheme === 'light') {
        // The check catches a difference: a default Button given a ground one step off the navy, in the heritage look.
        const planted = await shoot(page, 'heritage', [{ name: 'planted', ...REGISTER, plant: 'background-color: rgb(27, 39, 68)' }], GROUND.light)
        const register = shots.base.get('Button, default')!
        expect(planted.get('planted')!.box).toBe(register.box)
        expect(planted.get('planted')!.png.equals(register.png), 'a Button one step off the navy differs').toBe(false)
      }
      expect(external).toEqual([])
    })
  }
})

// ── The six pages in the scope (AC12) ────────────────────────────────────────

/** How a heritage page is drawn: the scopes, the landmarks, the faces inside the heritage scope, and the hooks, rules and seals. */
function readPage(site: SiteSelectors) {
  const describe = (el: Element) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`
  const scope = document.querySelector('[data-layout="heritage"]')
  const own = scope ? [...scope.querySelectorAll('*')].filter((el) => el.closest('[data-theme]') === scope) : []
  const family = (el: Element) => getComputedStyle(el).fontFamily
  const display = own.filter((el) => family(el).startsWith('"Libre Caslon Display"'))
  const heading = document.querySelector('main h1')
  const main = document.querySelector('main')
  return {
    themes: [...document.querySelectorAll('[data-theme]')].map((el) => el.getAttribute('data-theme')),
    scopeTag: scope?.tagName ?? null,
    mains: document.querySelectorAll('main').length,
    inMain: scope !== null && main !== null && main.contains(scope),
    headerOutside: document.querySelector(site.header)?.closest('[data-theme]') === null,
    footerOutside: document.querySelector(site.footer)?.closest('[data-theme]') === null,
    headingInScope: scope !== null && heading?.closest('[data-theme]') === scope,
    headingHook: heading?.getAttribute('data-heritage') ?? null,
    headingFamily: heading ? family(heading) : '',
    accent: own.filter((el) => /Instrument Serif/i.test(family(el))).map(describe),
    displayElsewhere: display
      .filter((el) => !el.closest(':is(h1, h2)[data-heritage~="display"], [data-heritage~="figure"]') || el.closest('button, input, select, textarea, label, a, [role="button"], [role="link"]'))
      .map(describe),
    displayCount: display.length,
    hooks: [...document.querySelectorAll('[data-heritage]')].map((el) => el.getAttribute('data-heritage')),
    rules: document.querySelectorAll('[data-slot="thick-thin-rule"]').length,
    seals: document.querySelectorAll('[data-slot="seal"]').length,
    sealsShown: [...document.querySelectorAll('[data-slot="seal"]')].filter((el) => el.getBoundingClientRect().width > 0).length,
  }
}

test.describe('the six pages in the heritage scope', () => {
  for (const p of PAGES) {
    test(`${p.route}: in the heritage scope inside the site's one main on a11y-on, with no accent face and the display face on its heading alone; with themeHeritage off, as it always was`, async ({ page, external }, testInfo) => {
      await openDrawn(page, p.route, content(page, p))
      await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
      await page.evaluate(() => document.fonts.ready)
      const r = await page.evaluate(readPage, SITE)
      if (testInfo.project.name === OFF) {
        expect({ themes: r.themes, hooks: r.hooks, rules: r.rules, seals: r.seals }).toEqual({ themes: [], hooks: [], rules: 0, seals: 0 })
      } else {
        expect(r.themes).toEqual(['heritage'])
        expect([r.scopeTag, r.mains, r.inMain]).toEqual(['DIV', 1, true])
        expect([r.headerOutside, r.footerOutside], 'the header and the footer keep the base look').toEqual([true, true])
        expect([r.headingInScope, r.headingHook]).toEqual([true, 'display'])
        expect(r.headingFamily.startsWith(DISPLAY_FAMILY), r.headingFamily).toBe(true)
        expect(r.accent, 'the base look\'s accent face').toEqual([])
        expect(r.displayElsewhere, 'the display face on anything but a hooked heading or figure').toEqual([])
        expect(r.displayCount).toBeGreaterThan(0)
        expect(r.rules).toBeGreaterThan(0)
        expect([r.seals, r.sealsShown], 'one seal, shown from 640 pixels').toEqual([1, 1])
      }
      expect(external).toEqual([])
    })
  }

  test('a11y-on: the base scope inside the heritage fixture draws the base look\'s controls, and nothing warns of the nesting', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the looks differ only under the new look, on a11y-on')
    const warnings: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') warnings.push(message.text())
    })
    await openFixture(page, 'base')
    const base = await page.locator('[data-fixture="base"]').evaluate((container) => {
      const looks = (el: Element) => {
        const s = getComputedStyle(el)
        return { ground: s.backgroundColor, words: s.color, line: s.borderTopColor, family: s.fontFamily, size: s.fontSize, corner: s.borderTopLeftRadius }
      }
      const button = [...container.querySelectorAll('[data-slot="button"]')].find((b) => b.textContent === 'Register')!
      return { button: looks(button), field: looks(container.querySelector('#fixture-input')!) }
    })
    await openFixture(page, 'heritage')
    const nested = page.locator('#fixture-base-in-heritage')
    await expect(nested.getByRole('button', { name: 'Save draft' })).toBeVisible()
    const inner = await nested.evaluate((el) => {
      const looks = (e: Element) => {
        const s = getComputedStyle(e)
        return { ground: s.backgroundColor, words: s.color, line: s.borderTopColor, family: s.fontFamily, size: s.fontSize, corner: s.borderTopLeftRadius }
      }
      const button = [...el.querySelectorAll('[data-slot="button"]')].find((b) => b.textContent === 'Save draft')!
      const around = el.parentElement!.closest('[data-theme]')!
      return {
        theme: el.getAttribute('data-theme'),
        around: around.getAttribute('data-theme'),
        aroundGround: getComputedStyle(around).backgroundColor,
        card: getComputedStyle(el).backgroundColor,
        button: looks(button),
        field: looks(el.querySelector('input')!),
        heritageFaces: [...el.querySelectorAll('*')].filter((e) => /Caslon|Source Serif/.test(getComputedStyle(e).fontFamily)).length,
      }
    })
    expect([inner.theme, inner.around]).toEqual(['', 'heritage'])
    expect([inner.card, inner.aroundGround]).toEqual(['rgb(255, 255, 255)', 'rgb(247, 243, 232)'])
    expect(inner.button).toEqual(base.button)
    expect(inner.field).toEqual(base.field)
    expect(inner.heritageFaces).toBe(0)
    expect(warnings.filter((w) => /ThemeScope|nest/i.test(w))).toEqual([])
    expect(external).toEqual([])
  })
})

// ── The paper ground on a short page ─────────────────────────────────────────

/** The colours at points of a screenshot, decoded by the browser itself. */
async function coloursAt(page: Page, png: Buffer, points: (readonly [number, number])[]): Promise<string[]> {
  return page.evaluate(async ({ b64, points }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return points.map(([x, y]) => {
      const [r, g, b] = context.getImageData(Math.round(x), Math.round(y), 1, 1).data
      return `rgb(${r}, ${g}, ${b})`
    })
  }, { b64: png.toString('base64'), points })
}

test.describe('the paper ground on a short page', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a11y-on, ${scheme}: on /governance/minutes with no documents the ground runs down to the footer, at 1280 by 800, 390 by 844 and 1280 by 1600`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
      await page.emulateMedia({ colorScheme: scheme })
      await page.route('**/api/governance/documents*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ documents: [] }) }))
      for (const [width, height] of [[1280, 800], [390, 844], [1280, 1600]] as const) {
        await page.setViewportSize({ width, height })
        await page.goto('/governance/minutes')
        await expect(page.getByText('No documents yet.')).toHaveCount(2)
        await page.evaluate(() => document.fonts.ready)
        // The footer's top in the middle of the window, or as far down as the page goes.
        await page.evaluate((site) => window.scrollTo(0, document.querySelector(site.footer)!.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2), SITE)
        await frames(page)
        const at = await page.evaluate((site) => {
          const scope = document.querySelector('[data-layout="heritage"]')!
          return {
            ground: getComputedStyle(scope).backgroundColor,
            scopeBottom: scope.getBoundingClientRect().bottom,
            footerTop: document.querySelector(site.footer)!.getBoundingClientRect().top,
          }
        }, SITE)
        const rows = [at.footerTop - 2]
        // On a window taller than the page, the stretch between the scope and the footer too.
        if (at.footerTop - at.scopeBottom > 8) rows.push((at.scopeBottom + at.footerTop) / 2)
        const points = rows.flatMap((y) => [[2, y], [width / 2, y], [width - 3, y]] as const)
        const seen = await coloursAt(page, await page.screenshot(), points)
        console.log(`the ground above the footer on /governance/minutes at ${width} by ${height}, ${scheme}: ${at.ground}; gap below the scope ${Math.max(0, at.footerTop - at.scopeBottom).toFixed(0)} pixels; seen ${[...new Set(seen)].join(', ')}`)
        expect(seen, `${width} by ${height}, ${scheme}`).toEqual(points.map(() => at.ground))
      }
      expect(external).toEqual([])
    })
  }
})

// ── axe on three heritage pages ──────────────────────────────────────────────

test.describe('axe on three heritage pages', () => {
  for (const scheme of ['light', 'dark'] as const) {
    for (const route of ['/about', '/governance/minutes', '/champions']) {
      test(`a11y-on, ${scheme}: axe finds nothing on ${route} at 1280 and 390 pixels`, async ({ page, external }, testInfo) => {
        test.skip(testInfo.project.name !== ON, 'the heritage look is drawn on a11y-on')
        await page.emulateMedia({ colorScheme: scheme })
        const report: string[] = []
        const found: string[] = []
        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 800 })
          await openDrawn(page, route, content(page, pageAt(route)))
          await page.evaluate(() => document.fonts.ready)
          expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(scheme === 'dark')
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
          report.push(`axe on ${route} at ${width} pixels, ${scheme} (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results))
          found.push(...findings(results))
        }
        console.log(report.join('\n'))
        expect(found, report.join('\n')).toEqual([])
        expect(external).toEqual([])
      })
    }
  }
})

// ── Moving inside the site (AC11) ────────────────────────────────────────────

/**
 * Moves the site to an address through its router, as the browser's back
 * and forward buttons do: no input event comes first, so every shift counts
 * as it counts for a visitor whose page arrives more than half a second
 * after the click.
 */
async function moveTo(page: Page, route: string) {
  await page.evaluate((to) => {
    window.history.pushState(null, '', to)
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
  }, route)
}

interface Moved {
  __moved: { value: number; at: number; input: boolean; moved: { area: string; what: string }[] }[]
}

/** Starts counting layout shifts from now on, each with its time, whether an input came just before it, and what moved and where it sits. */
async function countShifts(page: Page) {
  await page.evaluate((site) => {
    const w = window as unknown as Moved
    w.__moved = []
    const where = (node: Node | null, before: DOMRectReadOnly, after: DOMRectReadOnly) => {
      const el = node instanceof Element ? node : node?.parentElement ?? null
      const area = !el ? 'gone' : el.closest(site.footer) ? 'footer' : el.closest(site.header) ? 'header' : el.closest('[data-layout="heritage"]') ? 'heritage scope' : el.closest('main') ? 'main' : el.tagName.toLowerCase()
      const words = (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)
      const what = `${el ? el.tagName.toLowerCase() : 'a node'} "${words}" from ${Math.round(before.y)} to ${Math.round(after.y)}`
      return { area, what }
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[] }
        w.__moved.push({
          value: shift.value,
          at: entry.startTime,
          input: shift.hadRecentInput,
          moved: (shift.sources ?? []).map((source) => where(source.node, source.previousRect, source.currentRect)),
        })
      }
    }).observe({ type: 'layout-shift' })
  }, SITE)
}

/** What the six pages ask the server for: the governance documents, the board, its seats and the champions. */
const PAGE_DATA = /\/api\/(?:governance\/|board\/|champions\b)/
/** The six pages' own code, each loaded on demand. */
const PAGE_CODE = /\/assets\/(?:AboutPage|BoardPage|BylawsPage|MinutesPage|AnnualMeetingPage|ChampionsPage)-[\w-]+\.js(?:\?.*)?$/

/** Holds what matches back until the release it gives is called. */
async function hold(page: Page, what: RegExp): Promise<() => Promise<void>> {
  let open!: () => void
  const held = new Promise<void>((resolve) => {
    open = resolve
  })
  const handler = async (route: Route) => {
    await held
    await route.fallback()
  }
  await page.route(what, handler)
  return async () => {
    open()
    await page.unroute(what, handler)
  }
}

/** The pages whose loading state already fills the window, so the page's arrival can be held still: the others draw a short line while their data is on its way. */
const FILLS_THE_WINDOW = ['/about', '/meeting', '/governance/bylaws']

test.describe('moving inside the site to a heritage page', () => {
  // From the home page into the layout, each of the six once, and from page to page inside it.
  const MOVES = [
    ...PAGES.map((p) => ['/', p.route] as const),
    ['/about', '/governance/bylaws'],
    ['/governance/minutes', '/champions'],
  ] as const
  for (const [from, to] of MOVES) {
    test(`${from} to ${to} at 390 by 844 and 1280 by 800, its code, faces and data held back: nothing in the header or the page moves as it arrives, and where the page's loading state fills the window nothing in view moves at all`, async ({ page, external }, testInfo) => {
      const on = testInfo.project.name === ON
      const report: string[] = []
      for (const [width, height] of [[390, 844], [1280, 800]] as const) {
        await page.setViewportSize({ width, height })
        const start = from === '/' ? [page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })] : content(page, pageAt(from))
        await openDrawn(page, from, start)
        await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
        await page.evaluate(() => document.fonts.ready)
        await frames(page)
        await countShifts(page)
        const releaseData = await hold(page, PAGE_DATA)
        const releaseFaces = await hold(page, HERITAGE_FONTS)
        const releaseCode = await hold(page, PAGE_CODE)
        const movedAt = await page.evaluate(() => performance.now())
        await moveTo(page, to)
        // Entering the layout on a11y-on, its loading box stands while the page's code is held; the page left stays on a11y-off.
        if (on && from === '/') await expect(page.locator('[data-layout="heritage"] [role="status"]')).toBeVisible()
        await page.waitForTimeout(400)
        await frames(page)
        await releaseCode()
        const target = pageAt(to)
        await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible({ timeout: DRAWN_TIMEOUT })
        // The page's own arrival is counted up to here; its faces and its data are still held.
        await page.waitForTimeout(300)
        await frames(page)
        const drawnAt = await page.evaluate(() => performance.now())
        await releaseFaces()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(300)
        await frames(page)
        const swappedAt = await page.evaluate(() => performance.now())
        await releaseData()
        await expect(page.getByText(target.drawn).first()).toBeVisible({ timeout: DRAWN_TIMEOUT })
        await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0, { timeout: DRAWN_TIMEOUT })
        await page.waitForTimeout(300)
        await frames(page)
        const shifts = await page.evaluate((t) => (window as unknown as Moved).__moved.filter((s) => s.at > t), movedAt)
        const arriving = shifts.filter((s) => s.at <= drawnAt)
        const arrival = total(arriving)
        const swap = total(shifts.filter((s) => s.at > drawnAt && s.at <= swappedAt))
        const data = total(shifts.filter((s) => s.at > swappedAt))
        const moved = arriving.flatMap((s) => s.moved)
        const areas = [...new Set(moved.map((m) => m.area))].sort()
        report.push(`moving from ${from} to ${to} at ${width} by ${height} (${testInfo.project.name}): the page's arrival ${arrival.toFixed(4)}${areas.length ? ` (${areas.join(', ')} moved)` : ''}, the faces' swap ${swap.toFixed(4)}, its data's arrival ${data.toFixed(4)}`)
        expect(shifts.filter((s) => s.input), 'a shift that came just after an input').toEqual([])
        // Neither the header nor anything of the page moves as it arrives; the footer follows the page's loading state.
        expect(moved.filter((m) => m.area !== 'footer' && m.area !== 'gone').map((m) => `${m.area}: ${m.what}`), `${width} by ${height}: what moved as the page arrived`).toEqual([])
        if (FILLS_THE_WINDOW.includes(to)) expect(arrival, `the page's arrival at ${width} by ${height}`).toBeLessThan(0.1)
        expect(swap, `the faces' swap at ${width} by ${height}`).toBeLessThan(0.1)
        if (on) expect(await page.locator('[data-layout="heritage"]').count()).toBe(1)
      }
      console.log(report.join('\n'))
      expect(external).toEqual([])
    })
  }
})

// ── The ornaments and the cards as drawn ─────────────────────────────────────

/** A colour's relative luminance, from the rgb() a browser computes. */
function luminanceOf(colour: string): number {
  const [r, g, b] = (colour.match(/\d+(?:\.\d+)?/g) ?? []).slice(0, 3).map(Number).map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrastOf = (a: string, b: string) => {
  const [x, y] = [luminanceOf(a), luminanceOf(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** The rules, the seal and the hooked boxes of a heritage page, as the browser draws them, with the look's ink. */
function readOrnaments() {
  const scope = document.querySelector('[data-layout="heritage"]')!
  const probe = document.createElement('span')
  probe.style.color = 'var(--ink)'
  scope.append(probe)
  const ink = getComputedStyle(probe).color
  probe.remove()
  const groundOf = (el: Element | null): string => {
    for (let at = el; at; at = at.parentElement) {
      const ground = getComputedStyle(at).backgroundColor
      if (ground !== 'rgba(0, 0, 0, 0)' && ground !== 'transparent') return ground
    }
    return getComputedStyle(document.body).backgroundColor
  }
  const rules = [...scope.querySelectorAll('[data-slot="thick-thin-rule"]')].map((el) => {
    const s = getComputedStyle(el)
    return {
      height: s.height,
      top: `${s.borderTopWidth} ${s.borderTopStyle}`,
      bottom: `${s.borderBottomWidth} ${s.borderBottomStyle}`,
      sides: `${s.borderLeftWidth} ${s.borderRightWidth}`,
      colours: [s.borderTopColor, s.borderBottomColor],
      ground: groundOf(el.parentElement),
      width: el.getBoundingClientRect().width,
      moving: `${s.animationName} ${s.transitionProperty === 'all' ? s.transitionDuration : '0s'}`,
    }
  })
  const seals = [...scope.querySelectorAll<SVGSVGElement>('svg[data-slot="seal"]')].map((svg) => {
    const box = svg.getBoundingClientRect()
    const circles = [...svg.querySelectorAll('circle')].map((c) => getComputedStyle(c))
    const mark = svg.querySelector('svg[data-slot="lca-mark"]')!
    const markBox = mark.getBoundingClientRect()
    return {
      display: getComputedStyle(svg).display,
      box: [Math.round(box.width), Math.round(box.height)],
      band: groundOf(svg.parentElement),
      disc: circles[0]?.fill,
      rings: circles.slice(1).map((c) => `${c.stroke} on ${c.fill}`),
      mark: getComputedStyle(mark.querySelector('path')!).fill,
      offCentre: box.width ? Math.max(Math.abs(markBox.x + markBox.width / 2 - (box.x + box.width / 2)), Math.abs(markBox.y + markBox.height / 2 - (box.y + box.height / 2))) : null,
      share: box.width ? markBox.width / box.width : null,
    }
  })
  const corners = [...scope.querySelectorAll('[data-heritage~="card"], [data-heritage~="table"], [data-slot="lca-logo-mat"]')].map((el) => {
    const s = getComputedStyle(el)
    return `${el.tagName.toLowerCase()} ${s.borderTopLeftRadius} ${s.borderTopRightRadius} ${s.borderBottomRightRadius} ${s.borderBottomLeftRadius}`
  })
  const heading = scope.querySelector('h1')
  const display = getComputedStyle(scope).getPropertyValue('--font-display')
  const family = (value: string) => value.replace(/'/g, '"').replace(/\s*,\s*/g, ', ').trim()
  return { ink, ground: groundOf(scope), rules, seals, corners, headingFamily: heading ? family(getComputedStyle(heading).fontFamily) : '', displayToken: family(display) }
}

const NAVY = 'rgb(26, 39, 68)'
const GOLD = 'rgb(200, 169, 74)'
const WHITE = 'rgb(255, 255, 255)'
const INK = { light: NAVY, dark: 'rgb(232, 236, 244)' } as const
const PAPER = { light: 'rgb(247, 243, 232)', dark: 'rgb(11, 18, 32)' } as const

test.describe('the ornaments and the cards as drawn', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a11y-on, ${scheme}: on each of the six pages every rule is the board's 6px box in the look's ink, the seal is navy, gold and white and holds the rook in its middle, and every hooked box has 2px corners`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the ornaments are drawn on a11y-on')
      await page.emulateMedia({ colorScheme: scheme })
      for (const p of PAGES) {
        await openDrawn(page, p.route, content(page, p))
        await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
        const drawn = await page.evaluate(readOrnaments)
        const where = `${p.route}, ${scheme}`
        expect(drawn.ink, where).toBe(INK[scheme])
        expect(drawn.ground, where).toBe(PAPER[scheme])
        expect(drawn.rules.length, where).toBeGreaterThan(0)
        for (const rule of drawn.rules) {
          expect({ height: rule.height, top: rule.top, bottom: rule.bottom, sides: rule.sides }, where).toEqual({ height: '6px', top: '3px solid', bottom: '1px solid', sides: '0px 0px' })
          expect(rule.colours, where).toEqual([INK[scheme], INK[scheme]])
          // On the look's own ground, where it shows in dark mode too.
          expect(rule.ground, where).toBe(PAPER[scheme])
          expect(contrastOf(rule.colours[0], rule.ground), where).toBeGreaterThanOrEqual(3)
          expect(rule.width, where).toBeGreaterThan(100)
          expect(rule.moving, where).toBe('none 0s')
        }
        expect(drawn.seals, where).toHaveLength(1)
        const [seal] = drawn.seals
        expect({ display: seal.display, box: seal.box, band: seal.band, disc: seal.disc, rings: seal.rings, mark: seal.mark }, where).toEqual({
          display: 'block',
          box: [64, 64],
          band: NAVY,
          disc: NAVY,
          rings: [`${GOLD} on none`, `${GOLD} on none`],
          mark: WHITE,
        })
        expect(seal.offCentre!, `${where}: the rook in the seal's middle`).toBeLessThanOrEqual(1.5)
        expect(seal.share!, `${where}: the rook a third of the seal`).toBeGreaterThan(0.28)
        expect(seal.share!, where).toBeLessThan(0.36)
        expect(drawn.corners.length, where).toBeGreaterThan(0)
        for (const corner of drawn.corners) expect(corner, where).toMatch(/^\w+ 2px 2px 2px 2px$/)
        // The heading's face is --font-display itself, Caslon first, not a family written anywhere else.
        expect(drawn.displayToken, where).toMatch(/^"Libre Caslon Display", /)
        expect(drawn.headingFamily, where).toBe(drawn.displayToken)
      }
      expect(external).toEqual([])
    })
  }

  test('a11y-on, 390 by 844: the seal is not drawn on a phone, and the rules are', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the ornaments are drawn on a11y-on')
    await page.setViewportSize({ width: 390, height: 844 })
    for (const p of PAGES) {
      await openDrawn(page, p.route, content(page, p))
      const drawn = await page.evaluate(readOrnaments)
      expect(drawn.seals.map((s) => [s.display, ...s.box]), p.route).toEqual([['none', 0, 0]])
      expect(drawn.rules.length, p.route).toBeGreaterThan(0)
      for (const rule of drawn.rules) expect([rule.height, rule.top, rule.bottom], p.route).toEqual(['6px', '3px solid', '1px solid'])
    }
    expect(external).toEqual([])
  })
})

// ── The header and the footer keep the base look ─────────────────────────────

/** How the header, its brand link and the footer are drawn. */
function readFrame(site: SiteSelectors) {
  const look = (el: Element | null) => {
    if (!el) return null
    const s = getComputedStyle(el)
    return { ground: s.backgroundColor, words: s.color, lines: `${s.borderTopColor} ${s.borderBottomColor}`, family: s.fontFamily, size: s.fontSize }
  }
  const header = document.querySelector(site.header)
  const footer = document.querySelector(site.footer)
  return {
    header: look(header),
    brand: look(header?.querySelector(site.brandLink) ?? null),
    footer: look(footer),
    footerLinks: [...(footer?.querySelectorAll(site.footerLinks) ?? [])].slice(0, 4).map((a) => look(a)),
  }
}

/** The footer's own ground, as painted: points just under its gold line and just above its foot, at both edges, with the footer scrolled into view. */
async function footerPaint(page: Page): Promise<string[]> {
  const at = await page.evaluate((site) => {
    const footer = document.querySelector(site.footer)!
    footer.scrollIntoView({ block: 'end' })
    const r = footer.getBoundingClientRect()
    return { top: r.top, bottom: Math.min(r.bottom, window.innerHeight), width: window.innerWidth }
  }, SITE)
  await frames(page)
  const points = [[2, at.top + 8], [at.width - 3, at.top + 8], [2, at.bottom - 4], [at.width - 3, at.bottom - 4]] as const
  return coloursAt(page, await page.screenshot(), [...points])
}

test.describe('the header and the footer on a heritage page', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: each of the six pages draws the header and the footer exactly as the home page does, and nothing of the page is painted over the footer`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON && scheme === 'dark', 'a11y-off has no dark mode')
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, '/', [page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })])
      await page.evaluate(() => document.fonts.ready)
      const home = await page.evaluate(readFrame, SITE)
      expect(home.header).not.toBeNull()
      expect(home.footer).not.toBeNull()
      expect(home.footerLinks.length).toBeGreaterThan(0)
      const homePaint = await footerPaint(page)
      expect(homePaint).toEqual(homePaint.map(() => NAVY))
      for (const p of PAGES) {
        await openDrawn(page, p.route, content(page, p))
        await page.evaluate(() => document.fonts.ready)
        expect(await page.evaluate(readFrame, SITE), `${p.route}, ${scheme} (${testInfo.project.name})`).toEqual(home)
        // The layout casts its ground down under the footer; the footer, drawn after it, covers it.
        expect(await footerPaint(page), `${p.route}, ${scheme}: the footer's ground as painted`).toEqual(homePaint)
      }
      expect(external).toEqual([])
    })
  }
})

// ── The same-run check catches a ring and a dark ground (AC13) ───────────────

test.describe('the same-run check is not blind to the ring or to dark mode', () => {
  test('a11y-on, light and dark: a focused Button whose ring is one step off, and a Button whose ground is one step off, both differ from base', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the looks differ only under the new look, on a11y-on')
    // One step off the ring (--focus) and off the default Button's ground (--primary, the look's ink) in each mode.
    const OFF = {
      light: { ring: 'outline-color: rgb(27, 39, 68)', ground: 'background-color: rgb(27, 39, 68)' },
      dark: { ring: 'outline-color: rgb(201, 169, 74)', ground: 'background-color: rgb(233, 236, 244)' },
    } as const
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      const samples: Sample[] = [
        { name: 'focused', ...REGISTER, state: 'focus' },
        { name: 'filled', ...REGISTER },
      ]
      await openFixture(page, 'base')
      const base = await shoot(page, 'base', samples, GROUND[scheme])
      await openFixture(page, 'heritage')
      const same = await shoot(page, 'heritage', samples, GROUND[scheme])
      const planted = await shoot(page, 'heritage', [
        // The ring is drawn outside the Button's box: a shot clipped to the box would miss this one.
        { ...samples[0], plant: OFF[scheme].ring },
        { ...samples[1], plant: OFF[scheme].ground },
      ], GROUND[scheme])
      for (const name of ['focused', 'filled']) {
        expect(same.get(name)!.png.equals(base.get(name)!.png), `${scheme}: ${name}, as drawn, is the same in both looks`).toBe(true)
        expect(planted.get(name)!.box, `${scheme}: ${name}`).toBe(base.get(name)!.box)
        expect(planted.get(name)!.png.equals(base.get(name)!.png), `${scheme}: ${name}, one step off, differs`).toBe(false)
      }
    }
    expect(external).toEqual([])
  })
})
