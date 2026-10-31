// test/a11y/dock.spec.ts
//
// The phone's dock and the tab bar in it (WS02 step 7), in a browser. The
// a11y-on build, which has the chrome on (newNav and newLook), draws the
// dock fixed to the window's foot below 768 pixels; the a11y-off build
// never draws it. test/a11y/nav.spec.ts holds the tab bar in use (the Menu
// tab and its sheet, Donate two taps away, the page Log in hands on); this
// file holds the room the dock takes and where it hides:
//
// - The room, at 320, 360, 390, 768 and 1023 by 844, light and dark, with
//   the tab bar alone and with the action bar fixture, a bar 64 pixels tall
//   that this file plants in the dock's action place: on a long page and a
//   shorter one, each scrolled to its end, no fixed element's box overlaps a
//   line of the main's or the footer's words or one of their controls, and
//   the footer ends where the dock begins; Tab through the long page leaves
//   no control the focus lands on under the dock or the sticky bar; from
//   768 pixels up there is no dock, no tab bar and no place for a bar.
// - Where it hides: on the three pages that hide the tab bar, each also in
//   a second spelling the router takes (the page a member comes back to
//   from paying for a member signed in, since it sends a visitor who is
//   signed out to /login, where the dock is drawn); while /login's Email
//   field holds the focus, and while the visual viewport is more than 150
//   pixels shorter than the window, the dock coming back as each ends; and
//   in the reflow fallback, at 667 by 375, 568 by 320 and 299 by 640, where
//   the app bar scrolls with the page and its Menu button opens the sheet.
//   At 844 by 390, a phone on its side, the tablet header, measured as it
//   stands.
// - No layout shift as the dock draws, on a first visit and as it comes
//   back once a field lets the focus go: nothing in the dock moves, and the
//   home page's own lists, which arrive after it, move only its main.
// - The tab bar's words and its current tab's bar against its ground, and
//   each tab's ring, inside the tab and the window, light and dark.
// - The viewport tag of the built page on both builds, and on a11y-off no
//   dock at all.
// - Axe, with the WCAG 2.0 to 2.2 A and AA rules, on / and /tournaments at
//   390, light and dark, with the tab bar drawn and with the sheet open
//   above it.
//
// Reads only; the person signed in is test/a11y/signedIn.ts's, whose calls
// are answered in the browser. The header, the footer, the dock and the tab
// bar are read through test/a11y/chrome.ts, and every check of the dock
// holds for the new chrome alone, so each test says so through it.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { CHROME_NAMES, NEW_NAMES, SITE, dock, menuSheet, menuTab, onlyNew, siteHeader, tabBar, type SiteSelectors } from './chrome'
import { signInAs, waitForMemberAnswers } from './signedIn'
import { expect, openDrawn, test } from './support'
import { navPersona } from '../unit/fixtures/navPersonas'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const CLOSE_MENU = 'Close menu'
const LOADING = 'Loading…'

/** The widths the dock is drawn at, below 768 pixels, and two of the tablet header's, where it is not. */
const PHONES = [320, 360, 390] as const
const TABLETS = [768, 1023] as const
const HEIGHT = 844
/** The tab bar's height as drawn: its row of 56 pixels and the hairline above it, with no safe area in these windows. */
const TAB_BAR_H = 57
/** The action bar fixture's height. */
const ACTION_BAR_H = 64

/** The viewport tag each build serves: the chrome's, which lets the page reach under a phone's notch, and today's. */
const VIEWPORT: Readonly<Record<string, string>> = {
  [ON]: 'width=device-width, initial-scale=1.0, viewport-fit=cover',
  [OFF]: 'width=device-width, initial-scale=1.0',
}

/**
 * The pages that hide the tab bar (HIDE_TAB_BAR_ROUTES in src/lib/nav.ts),
 * each as written and in a second spelling the router takes. The page a
 * member comes back to from paying is for a person signed in, and sends a
 * visitor who is signed out to /login.
 */
const HIDING = [
  ['/tournaments/fx-t-done/print', '/Tournaments/fx-t-done/PRINT/'],
  ['/donate/success', '/DONATE/success/'],
] as const
const MEMBERSHIP_PAID = ['/membership/success', '/Membership/Success/'] as const

/** The WCAG 2.0 to 2.2 A and AA rules, as the brand and smoke specs run them. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

function only(testInfo: TestInfo, project: string, why = `checks the ${project} build`) {
  test.skip(testInfo.project.name !== project, why)
}

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/**
 * The tab bar's words as src/lib/nav.ts gives them, signed out, which
 * test/unit/bottom-dock.test.tsx holds to navTabs and navLabel. A helper,
 * read only by checks marked as the new chrome's, since Menu is a name only
 * the new chrome gives.
 */
const tabWords = () => ['Tournaments', CHROME_NAMES.clubs, CHROME_NAMES.logIn, NEW_NAMES.menu]

// ── The pages ──────────────────────────────────────────────────────────────

/** What each page read here shows once it is drawn. */
const PAGES: Record<string, (page: Page) => Locator> = {
  '/': (page) => page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' }),
  '/forgot-password': (page) => page.getByRole('heading', { level: 1, name: 'Forgot Password' }),
  '/login': (page) => page.getByLabel('Email'),
  '/tournaments': (page) => page.locator('main').getByRole('button', { name: /Fixture Fall Open/ }).first(),
  '/about': (page) => page.getByRole('heading', { level: 1, name: 'About LCA' }),
}

/** Opens one of PAGES, waits until it is drawn and its fonts are in, with the page at its top and the focus nowhere. */
async function openPage(page: Page, route: string) {
  const drawn = PAGES[route]
  if (!drawn) throw new Error(`openPage: no content is listed for ${route}`)
  await openDrawn(page, route, [drawn(page)])
  await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
}

/** Scrolls the page to its end at once, and again if what the end brought into view made it longer. */
async function scrollToEnd(page: Page) {
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await page.waitForLoadState('networkidle')
    await frames(page)
  }
}

// ── The dock as drawn ──────────────────────────────────────────────────────

/** A box in the window's own pixels. */
interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

/** Whether two boxes overlap by more than half a pixel each way. */
const overlap = (a: Box, b: Box) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5

/** The dock as drawn now: its box and the tab bar's, the places for a page's bars, and what it writes on the page's root. */
const dockNow = (page: Page) =>
  page.evaluate((site) => {
    const box = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }
    }
    return {
      dock: box(document.querySelector(site.dock)),
      tabBar: box(document.querySelector(site.tabBar)),
      places: [...document.querySelectorAll('[data-slot="dock-action"], [data-slot="dock-event"]')].map((el) => el.getAttribute('data-slot')),
      written: document.documentElement.style.getPropertyValue('--bottom-chrome-h'),
      padding: getComputedStyle(document.documentElement).scrollPaddingBottom,
      window: { width: window.innerWidth, height: window.innerHeight },
    }
  }, SITE)

/**
 * Plants the action bar fixture in the dock's action place: a bar 64
 * pixels tall with a line of words, on the tab bar's own ground, put there
 * as a page's bar is; and plants it again each time the dock draws the
 * place anew. Gives back whether the page had a place for it.
 */
const plantActionBar = (page: Page) =>
  page.evaluate((height) => {
    const plant = () => {
      const place = document.querySelector('[data-slot="dock-action"]')
      if (!place) return false
      if (!place.querySelector('[data-fixture="action-bar"]')) {
        const bar = document.createElement('div')
        bar.setAttribute('data-fixture', 'action-bar')
        bar.style.cssText = `box-sizing: border-box; height: ${height}px; display: flex; align-items: center; padding: 0 16px; border-top: 1px solid var(--hairline); background: var(--surface); color: var(--ink)`
        bar.textContent = 'A made-up action bar the test plants'
        place.append(bar)
      }
      return true
    }
    new MutationObserver(() => void plant()).observe(document.body, { childList: true, subtree: true })
    return plant()
  }, ACTION_BAR_H)

/**
 * What the fixed elements drawn now cover of the main's and the footer's
 * words and controls inside the window: each fixed element that is not
 * inside another, by its slot, and each overlap of its box with a line of
 * words or a control's box. Words and controls drawn in a clipped box of a
 * pixel or less, which a screen reader alone reads, are not drawn and are
 * left out.
 */
const coverings = (page: Page) =>
  page.evaluate((site) => {
    interface Area { top: number; bottom: number; left: number; right: number }
    const area = (r: DOMRect): Area => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
    const over = (a: Area, b: Area) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5
    const inWindow = (a: Area) => a.bottom > 0 && a.top < window.innerHeight && a.right > 0 && a.left < window.innerWidth
    const notDrawn = (el: Element | null) => {
      for (let at = el; at && at !== document.body; at = at.parentElement) {
        const s = getComputedStyle(at)
        if (s.clipPath !== 'none' || s.clip !== 'auto' || s.opacity === '0') return true
        if (s.overflow !== 'visible') {
          const r = at.getBoundingClientRect()
          if (r.width <= 1 || r.height <= 1) return true
        }
      }
      return false
    }
    const fixed = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return s.position === 'fixed' && s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0
    })
    const outer = fixed.filter((el) => !fixed.some((other) => other !== el && other.contains(el)))
    const parts = [document.querySelector('main'), document.querySelector(site.footer)].filter((el): el is HTMLElement => el !== null)
    const targets: { what: string; area: Area }[] = []
    for (const part of parts) {
      const walker = document.createTreeWalker(part, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const words = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
        if (!words || notDrawn(node.parentElement)) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const r of range.getClientRects()) {
          const a = area(r)
          if (r.width >= 1 && r.height >= 1 && inWindow(a)) targets.push({ what: `the words "${words.slice(0, 40)}"`, area: a })
        }
      }
      for (const el of part.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])')) {
        const r = el.getBoundingClientRect()
        const a = area(r)
        if (r.width < 1 || r.height < 1 || !inWindow(a) || notDrawn(el)) continue
        targets.push({ what: `the ${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}"`, area: a })
      }
    }
    const footer = document.querySelector(site.footer)
    return {
      fixed: outer.map((el) => ({ slot: el.getAttribute('data-slot') ?? el.tagName.toLowerCase(), area: area(el.getBoundingClientRect()) })),
      targets: targets.length,
      covered: outer.flatMap((el) => {
        const a = area(el.getBoundingClientRect())
        const name = el.getAttribute('data-slot') ?? el.tagName.toLowerCase()
        return targets.filter((t) => over(a, t.area)).map((t) => `${name} over ${t.what}`)
      }),
      footerBottom: footer ? footer.getBoundingClientRect().bottom : null,
      scrolled: window.scrollY,
      end: document.documentElement.scrollHeight - window.innerHeight,
    }
  }, SITE)

/** Where the focus is now: its control, the part of the page it is in, its box, and the sticky bar's box and the dock's at that moment. */
interface Stop {
  again: boolean
  name: string
  part: 'skip' | 'bar' | 'dock' | 'page'
  box: Box
  bar: Box | null
  dock: Box | null
}

/** The focus as it stands, marking the control it is on so a walk knows when it comes round; null while it is on nothing. */
const stopNow = (page: Page): Promise<Stop | null> =>
  page.evaluate((site) => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body || el === document.documentElement) return null
    const area = (r: DOMRect) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
    const header = document.querySelector(site.header)
    const drawnDock = document.querySelector(site.dock)
    const again = el.hasAttribute('data-walked')
    el.setAttribute('data-walked', '')
    const part = drawnDock?.contains(el) ? 'dock' : el.hasAttribute('data-skip-link') ? 'skip' : header?.contains(el) ? 'bar' : 'page'
    return {
      again,
      name: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}`,
      part: part as Stop['part'],
      box: area(el.getBoundingClientRect()),
      bar: header ? area(header.getBoundingClientRect()) : null,
      dock: drawnDock ? area(drawnDock.getBoundingClientRect()) : null,
    }
  }, SITE)

/**
 * Tab from the top of the page, one press at a time, until the focus
 * reaches the dock, or leaves the page or comes round again where there is
 * none: each control the focus lands on, as stopNow reads it.
 */
async function tabWalk(page: Page): Promise<Stop[]> {
  const stops: Stop[] = []
  for (let n = 0; n < 300; n++) {
    await page.keyboard.press('Tab')
    const at = await stopNow(page)
    if (at === null) {
      if (stops.length > 0) break
      continue
    }
    if (at.again) break
    stops.push(at)
    if (at.part === 'dock') break
  }
  return stops
}

// ── The room ───────────────────────────────────────────────────────────────

test.describe('the dock\'s room on the page with the chrome on (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const width of [...PHONES, ...TABLETS]) {
    const drawn = width < 768
    test(`a11y-on at ${width} by ${HEIGHT}, light and dark, with the tab bar alone and with the action bar fixture: ${drawn ? 'on / and /forgot-password scrolled to their ends no fixed element covers a line of the main\'s or the footer\'s words or a control, and the footer ends at the dock\'s top; Tab through / leaves no control under the dock or the app bar' : 'no dock, no tab bar and no place for a bar; on / and /forgot-password scrolled to their ends nothing fixed covers the page, and Tab through / leaves no control under the tablet header'}`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the dock beside the app bar, or no dock beside the tablet header')
      test.setTimeout(180_000)
      await page.setViewportSize({ width, height: HEIGHT })
      const seen: Record<string, unknown> = {}
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        for (const route of ['/', '/forgot-password']) {
          await openPage(page, route)
          const before = await dockNow(page)
          if (drawn) {
            expect(before.dock, `${scheme} ${route}: the dock`).toEqual({ top: HEIGHT - TAB_BAR_H, bottom: HEIGHT, height: TAB_BAR_H, width })
            expect(before.tabBar, `${scheme} ${route}: the tab bar is the whole dock`).toEqual(before.dock)
            expect(before.places, 'the action bar\'s place and the event bar\'s, both empty').toEqual(['dock-action', 'dock-event'])
            expect([before.written, before.padding], `${scheme} ${route}: --bottom-chrome-h and the scroll padding`).toEqual([`${TAB_BAR_H}px`, `${TAB_BAR_H}px`])
          } else {
            expect([before.dock, before.tabBar, before.places, before.written, before.padding], `${scheme} ${route}: no dock`).toEqual([null, null, [], '', '0px'])
          }
          for (const fixture of [false, true]) {
            const what = `${scheme} ${route}${fixture ? ' with the action bar fixture' : ''}`
            if (fixture) {
              expect(await plantActionBar(page), `${what}: a place for the bar`).toBe(drawn)
              if (!drawn) continue
              const dockH = TAB_BAR_H + ACTION_BAR_H
              await expect.poll(() => dockNow(page).then((d) => d.written), `${what}: --bottom-chrome-h`).toBe(`${dockH}px`)
              const grown = await dockNow(page)
              expect(grown.dock, `${what}: the dock, the bar above the tab bar`).toEqual({ top: HEIGHT - dockH, bottom: HEIGHT, height: dockH, width })
              expect(grown.tabBar?.top, `${what}: the tab bar where it was`).toBe(HEIGHT - TAB_BAR_H)
              expect(grown.padding).toBe(`${dockH}px`)
            }
            await scrollToEnd(page)
            const covered = await coverings(page)
            seen[`${what}`] = { ...covered, dock: await dockNow(page) }
            expect(covered.scrolled, `${what}: at the page's end`).toBe(covered.end)
            expect(covered.targets, `${what}: words and controls in view`).toBeGreaterThan(5)
            expect(covered.fixed.map((f) => f.slot), `${what}: the fixed elements`).toEqual(drawn ? ['bottom-dock'] : [])
            expect(covered.covered, `${what}: nothing covered`).toEqual([])
            const dockTop = drawn ? HEIGHT - TAB_BAR_H - (fixture ? ACTION_BAR_H : 0) : HEIGHT
            expect(Math.abs((covered.footerBottom ?? 0) - dockTop), `${what}: the footer ends at ${dockTop}`).toBeLessThanOrEqual(0.5)
          }
          // The reading is not blind: with the room under the footer taken away, the dock covers the footer's last lines.
          if (drawn && scheme === 'light' && route === '/') {
            const style = await page.addStyleTag({ content: ':root[data-look="new"] #main-content + footer { margin-bottom: 0 !important; }' })
            await scrollToEnd(page)
            const without = await coverings(page)
            expect(without.covered.length, `${route} with no room under the footer: the dock over its last lines`).toBeGreaterThan(0)
            await style.evaluate((el) => (el as HTMLStyleElement).remove())
          }
        }
        // Tab through the long page, with the tab bar alone and with the fixture.
        for (const fixture of [false, true]) {
          const what = `${scheme} Tab through /${fixture ? ' with the action bar fixture' : ''}`
          await openPage(page, '/')
          if (fixture && drawn) {
            expect(await plantActionBar(page)).toBe(true)
            await expect.poll(() => dockNow(page).then((d) => d.written)).toBe(`${TAB_BAR_H + ACTION_BAR_H}px`)
          }
          const stops = await tabWalk(page)
          const inPage = stops.filter((s) => s.part === 'page')
          seen[what] = stops.map((s) => `${s.part}: ${s.name} ${Math.round(s.box.top)} to ${Math.round(s.box.bottom)}`)
          expect(inPage.length, `${what}: the page's controls`).toBeGreaterThan(20)
          expect(stops.at(-1)?.part, `${what}: the last stop`).toBe(drawn ? 'dock' : 'page')
          for (const stop of inPage) {
            expect(!!stop.bar && overlap(stop.box, stop.bar), `${what}: ${stop.name} under the bar`).toBe(false)
            expect(!!stop.dock && overlap(stop.box, stop.dock), `${what}: ${stop.name} under the dock`).toBe(false)
          }
        }
        // The walk is not blind: with no scroll padding at the page's foot, a control the focus moves to is left under the dock.
        if (drawn && scheme === 'light') {
          await openPage(page, '/')
          await page.addStyleTag({ content: ':root[data-look="new"] { scroll-padding-bottom: 0px !important; }' })
          const unpadded = (await tabWalk(page)).filter((s) => s.part === 'page' && !!s.dock && overlap(s.box, s.dock))
          expect(unpadded.length, 'with no scroll padding at the foot: controls left under the dock').toBeGreaterThan(0)
        }
      }
      await testInfo.attach(`dock-room-${width}.json`, { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
      expect(external).toEqual([])
    })
  }
})

// ── Where the dock hides ───────────────────────────────────────────────────

/**
 * The app bar's own bordered Menu button, which it draws wherever the dock
 * draws no tab bar. A helper, read only by checks marked as the new
 * chrome's, since Menu is a name only the new chrome gives.
 */
const appBarMenu = (page: Page) => siteHeader(page).getByRole('button', { name: NEW_NAMES.menu, exact: true })

/** Sets the visual viewport's height as an on-screen keyboard would leave it, so many pixels shorter than the window, or whole again for null, and sends the resize the browser sends. */
const lowerViewport = (page: Page, by: number | null) =>
  page.evaluate((by) => {
    const view = window.visualViewport
    if (!view) throw new Error('this browser has no visual viewport')
    if (by === null) delete (view as unknown as { height?: number }).height
    else Object.defineProperty(view, 'height', { configurable: true, get: () => window.innerHeight - by })
    view.dispatchEvent(new Event('resize'))
  }, by)

test.describe('where the dock hides, with the chrome on (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844, signed out: no dock on the printed event and on the page a donor comes back to, each as written and in a second spelling the router takes, nothing written on the page\'s root and the app bar\'s Menu button in the Menu tab\'s place; the page a member comes back to from paying sends the visitor to /login, where the dock is drawn; and the dock back on the next page', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    await page.setViewportSize({ width: 390, height: HEIGHT })
    for (const spellings of HIDING) {
      for (const route of spellings) {
        await page.goto(route)
        await expect(siteHeader(page), route).toBeVisible()
        await expect(page.locator('main h1').first(), `${route}: the page drawn`).toBeVisible()
        await frames(page)
        await expect(dock(page), route).toHaveCount(0)
        await expect(tabBar(page), route).toHaveCount(0)
        expect((await dockNow(page)).written, `${route}: --bottom-chrome-h`).toBe('')
        await expect(appBarMenu(page), `${route}: the app bar's Menu button`).toBeVisible()
      }
    }
    await page.goto(MEMBERSHIP_PAID[0])
    await expect(page, 'a page for a person signed in').toHaveURL(/\/login$/)
    await expect(dock(page), '/login keeps the tab bar').toHaveCount(1)
    await openPage(page, '/')
    await expect(dock(page)).toHaveCount(1)
    await expect(appBarMenu(page)).toHaveCount(0)
    expect(external).toEqual([])
  })

  test('a11y-on at 390 by 844, signed in as a member: no dock on the page a member comes back to from paying, as written and in a second spelling the router takes, the app bar\'s Menu button in the Menu tab\'s place; the dock back on the next page', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    const visit = await signInAs(page, navPersona('active-member'), baseURL!)
    await page.setViewportSize({ width: 390, height: HEIGHT })
    for (const route of MEMBERSHIP_PAID) {
      await page.goto(route)
      await waitForMemberAnswers(visit)
      await expect(page, `${route}: the member stays on the page`).toHaveURL(new RegExp(`${route}$`))
      // The page asks the server about the payment, which refuses the test's unsigned session: either answer is the page drawn.
      await expect(page.locator('main').getByRole('button').or(page.locator('main h1')).first(), `${route}: the page drawn`).toBeVisible()
      await frames(page)
      await expect(dock(page), route).toHaveCount(0)
      await expect(tabBar(page), route).toHaveCount(0)
      expect((await dockNow(page)).written, `${route}: --bottom-chrome-h`).toBe('')
      await expect(appBarMenu(page), `${route}: the app bar's Menu button`).toBeVisible()
    }
    await page.goto('/clubs')
    await waitForMemberAnswers(visit)
    await expect(dock(page), '/clubs').toHaveCount(1)
    await expect(appBarMenu(page)).toHaveCount(0)
    expect(visit.signInCalls).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on at 390 by 844 on /login: no dock while the Email field or the password field holds the focus, the app bar\'s Menu button standing in for the Menu tab; the dock not drawn again as the focus passes from one field to the other, and drawn once more as the focus leaves them', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    await page.setViewportSize({ width: 390, height: HEIGHT })
    await openPage(page, '/login')
    await expect(dock(page)).toHaveCount(1)
    await expect(appBarMenu(page)).toHaveCount(0)
    // Each time the dock is drawn from here on.
    await page.evaluate((site) => {
      const w = window as unknown as { __docks: number }
      w.__docks = 0
      new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof Element && node.matches(site.dock)) w.__docks += 1
      }).observe(document.body, { childList: true, subtree: true })
    }, SITE)
    const email = page.getByLabel('Email')
    const password = page.getByLabel('Password', { exact: true })
    await email.focus()
    await expect(dock(page), 'the Email field').toHaveCount(0)
    expect((await dockNow(page)).written, 'nothing written while the dock hides').toBe('')
    await expect(appBarMenu(page)).toBeVisible()
    await password.focus()
    await frames(page)
    await expect(dock(page), 'the password field').toHaveCount(0)
    await password.blur()
    await expect(dock(page), 'the focus out of the fields').toHaveCount(1)
    await expect(appBarMenu(page)).toHaveCount(0)
    expect(await page.evaluate(() => (window as unknown as { __docks: number }).__docks), 'drawn once, as the focus left the fields, and not between them').toBe(1)
    expect(external).toEqual([])
  })

  test('a11y-on at 390 by 844 on /: no dock while the visual viewport is more than 150 pixels shorter than the window, as an on-screen keyboard leaves it, the app bar\'s Menu button in its place; 150 pixels shorter keeps it, and it comes back once the viewport is whole again', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    await page.setViewportSize({ width: 390, height: HEIGHT })
    await openPage(page, '/')
    await expect(dock(page)).toHaveCount(1)
    await lowerViewport(page, 150)
    await frames(page)
    await expect(dock(page), '150 pixels shorter').toHaveCount(1)
    await lowerViewport(page, 151)
    await expect(dock(page), '151 pixels shorter').toHaveCount(0)
    await expect(appBarMenu(page)).toBeVisible()
    await lowerViewport(page, 300)
    await frames(page)
    await expect(dock(page), '300 pixels shorter').toHaveCount(0)
    await lowerViewport(page, null)
    await expect(dock(page), 'the viewport whole again').toHaveCount(1)
    await expect(appBarMenu(page)).toHaveCount(0)
    expect(external).toEqual([])
  })

  for (const [width, height] of [[667, 375], [568, 320], [299, 640]] as const) {
    test(`a11y-on at ${width} by ${height}, the reflow fallback: no dock; the app bar drawn but not sticky, so it scrolls away with the page, writing no --header-h; its Menu button opens the sheet over the whole window, and Esc closes it with the focus back on the button`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the app bar in the reflow fallback')
      await page.setViewportSize({ width, height })
      await openPage(page, '/')
      await expect(dock(page)).toHaveCount(0)
      await expect(tabBar(page)).toHaveCount(0)
      const bar = siteHeader(page)
      const barNow = () => bar.evaluate((el) => ({ slot: el.getAttribute('data-slot'), position: getComputedStyle(el).position, top: el.getBoundingClientRect().top }))
      const atTop = await barNow()
      expect(atTop, 'the app bar, in the page\'s flow').toMatchObject({ slot: 'app-bar', position: 'static' })
      const root = await page.evaluate(() => {
        const s = getComputedStyle(document.documentElement)
        return {
          header: document.documentElement.style.getPropertyValue('--header-h'),
          bottom: document.documentElement.style.getPropertyValue('--bottom-chrome-h'),
          padding: [s.scrollPaddingTop, s.scrollPaddingBottom],
        }
      })
      expect(root, 'nothing written, nothing padded').toEqual({ header: '', bottom: '', padding: ['0px', '0px'] })
      await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }))
      await frames(page)
      expect((await barNow()).top, 'the app bar scrolled away with the page').toBe(atTop.top - 300)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await frames(page)
      const menu = appBarMenu(page)
      await expect(menu).toBeVisible()
      await menu.click()
      const sheet = menuSheet(page)
      await expect(sheet).toBeVisible()
      await expect(sheet).toHaveAttribute('data-shape', 'full')
      await expect(sheet.getByRole('button', { name: CLOSE_MENU })).toBeFocused()
      expect(await sheet.boundingBox(), 'the whole window, with no dock to stop above').toEqual({ x: 0, y: 0, width, height })
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(menu).toBeFocused()
      expect(external).toEqual([])
    })
  }

  test('a11y-on at 844 by 390, a phone on its side, the board\'s frame 12: the width rule draws the tablet header with its own bordered Menu button and no dock; measured as it stands, it stays at the top of the window as the page scrolls and takes 64 of the window\'s 390 pixels, and its Menu button opens the drawer', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [844], 'the tablet header on a phone on its side')
    await page.setViewportSize({ width: 844, height: 390 })
    await openPage(page, '/')
    await expect(dock(page)).toHaveCount(0)
    await expect(tabBar(page)).toHaveCount(0)
    const bar = siteHeader(page)
    const measure = () =>
      bar.evaluate((el) => {
        const r = el.getBoundingClientRect()
        return { slot: el.getAttribute('data-slot'), form: el.getAttribute('data-form'), position: getComputedStyle(el).position, top: r.top, height: r.height, share: Math.round((r.height / window.innerHeight) * 1000) / 10 }
      })
    const atTop = await measure()
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
    await frames(page)
    const scrolled = await measure()
    await testInfo.attach('tablet-header-844-by-390.json', { body: JSON.stringify({ atTop, scrolled }, null, 2), contentType: 'application/json' })
    expect(atTop).toEqual({ slot: 'site-header', form: 'tablet', position: 'sticky', top: 0, height: 64, share: 16.4 })
    expect(scrolled.top, 'still at the top with the page scrolled 600 pixels').toBe(0)
    const menu = bar.getByRole('button', { name: NEW_NAMES.menu, exact: true })
    await expect(menu).toBeVisible()
    await menu.click()
    const sheet = menuSheet(page)
    await expect(sheet).toHaveAttribute('data-shape', 'drawer')
    await expect(sheet.getByRole('button', { name: CLOSE_MENU })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(menu).toBeFocused()
    expect(external).toEqual([])
  })
})

// ── No layout shift as the dock draws ──────────────────────────────────────

/** A layout shift the page made: its score, whether it came just after a press, and where each thing that moved is. */
interface Shift {
  value: number
  input: boolean
  moved: string[]
}

/**
 * Installed before the page loads: a buffered layout shift observer, which
 * also sees the shifts from before it was made, keeping with each shift
 * where what moved is (the dock, the header, the main or the footer). The
 * chrome's selectors come in as its argument.
 */
function watchShifts(site: SiteSelectors) {
  const w = window as unknown as { __shifts: Shift[] }
  w.__shifts = []
  const where = (node: Node | null) => {
    const el = node instanceof Element ? node : node?.parentElement ?? null
    if (!el) return 'gone'
    return el.closest(site.dock) ? 'dock' : el.closest(site.footer) ? 'footer' : el.closest(site.header) ? 'header' : el.closest('main') ? 'main' : el.tagName.toLowerCase()
  }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const shift = entry as unknown as { value: number; hadRecentInput: boolean; sources?: { node: Node | null }[] }
      w.__shifts.push({ value: shift.value, input: shift.hadRecentInput, moved: (shift.sources ?? []).map((s) => where(s.node)) })
    }
  }).observe({ type: 'layout-shift', buffered: true })
}

/** The shifts the page has made since it loaded. */
const shiftsSoFar = (page: Page) => page.evaluate(() => (window as unknown as { __shifts: Shift[] }).__shifts)

test.describe('no layout shift as the dock draws (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 320 and 390 by 844: the layout shift API reads 0 by the settled frame of a first visit to /forgot-password and to /about, the dock drawn with the page; on /, whose lists arrive after the page, nothing in the dock, the header or the footer moves, only the main; and 0 from the moment /login\'s Email field lets the focus go until the dock is back and settled', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [320, 390], 'the dock beside the app bar')
    await page.addInitScript(watchShifts, SITE)
    const seen: Record<string, Shift[]> = {}
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: HEIGHT })
      for (const route of ['/forgot-password', '/about', '/']) {
        await openPage(page, route)
        await expect(dock(page)).toHaveCount(1)
        const shifts = await shiftsSoFar(page)
        seen[`${width} ${route}`] = shifts
        expect(shifts.filter((s) => s.moved.some((m) => m !== 'main')), `${width} ${route}: nothing but the main moves`).toEqual([])
        // The home page's lists arrive after it and move its main, on today's site as well (the record has the figures).
        if (route !== '/') expect(shifts.reduce((sum, s) => sum + s.value, 0), `${width} ${route}: the page's shift by its settled frame`).toBe(0)
      }
      await openPage(page, '/login')
      const email = page.getByLabel('Email')
      await email.focus()
      await expect(dock(page)).toHaveCount(0)
      await frames(page)
      const before = (await shiftsSoFar(page)).length
      await email.blur()
      await expect(dock(page)).toHaveCount(1)
      await frames(page)
      const after = (await shiftsSoFar(page)).slice(before)
      seen[`${width} /login, the dock back`] = after
      expect(after, `${width}: no shift as the dock comes back`).toEqual([])
    }
    await testInfo.attach('dock-layout-shift.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })
})

// ── The tab bar's colours and rings ────────────────────────────────────────

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

const NAVY = 'rgb(26, 39, 68)'
const GOLD = 'rgb(200, 169, 74)'
/** gold-ink in the light look, #866a1e. */
const GOLD_INK = 'rgb(134, 106, 30)'

/** The tab bar as drawn: its ground, and each tab's words, their colour, weight and size, whether it is current, and its bar where it is. */
const tabsAsDrawn = (page: Page) =>
  tabBar(page).evaluate((nav) => ({
    ground: getComputedStyle(nav).backgroundColor,
    tabs: [...nav.querySelectorAll('a, button')].map((tab) => {
      const words = tab.querySelector(':scope > span:not([data-slot])')
      const mark = tab.querySelector('[data-slot="tab-mark"]')
      const s = words ? getComputedStyle(words) : null
      return {
        words: (words?.textContent ?? '').trim(),
        current: tab.getAttribute('aria-current'),
        colour: s?.color ?? '',
        weight: s?.fontWeight ?? '',
        size: s?.fontSize ?? '',
        mark: mark ? { colour: getComputedStyle(mark).borderTopColor, width: getComputedStyle(mark).borderTopWidth } : null,
      }
    }),
  }))

/** Gives a control keyboard focus, as a keyboard user would see it. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab')
  await target.focus()
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
}

test.describe('the tab bar\'s colours and rings with the chrome on (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844, light and dark: the tab bar\'s words at 4.5:1 or more on its ground, at 12 pixels, the current tab\'s bold and the others at weight 500; the current tab\'s bar 3 pixels, in gold-ink #866a1e on white and in brand gold in dark mode, at 3:1 or more; Tournaments current on /tournaments and Menu on /about, where the Close tab beside the open sheet keeps those colours', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the tab bar beside the app bar')
    await page.setViewportSize({ width: 390, height: HEIGHT })
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const [route, current] of [['/tournaments', 'Tournaments'], ['/about', NEW_NAMES.menu]] as const) {
        await openPage(page, route)
        const drawn = await tabsAsDrawn(page)
        const ratios = drawn.tabs.map((t) => ({ words: t.words, words_ratio: ratio(t.colour, drawn.ground), mark_ratio: t.mark ? ratio(t.mark.colour, drawn.ground) : null }))
        seen[`${scheme} ${route}`] = { ...drawn, ratios }
        const what = `${scheme} ${route}`
        expect(drawn.tabs.map((t) => t.words), what).toEqual(tabWords())
        if (scheme === 'light') expect(drawn.ground, `${what}: the tab bar's ground`).toBe('rgb(255, 255, 255)')
        const here = drawn.tabs.filter((t) => t.current === 'page')
        expect(here.map((t) => t.words), `${what}: the one current tab`).toEqual([current])
        for (const tab of drawn.tabs) {
          expect(tab.size, `${what}: ${tab.words}`).toBe('12px')
          expect(tab.weight, `${what}: ${tab.words}`).toBe(tab.current === 'page' ? '700' : '500')
          expect(ratio(tab.colour, drawn.ground), `${what}: ${tab.words} in ${tab.colour} on ${drawn.ground}`).toBeGreaterThanOrEqual(4.5)
          if (tab.current !== 'page') expect(tab.mark, `${what}: ${tab.words} has no bar`).toBeNull()
        }
        const mark = here[0].mark
        expect(mark, `${what}: the current tab's bar`).not.toBeNull()
        expect(mark!, what).toEqual({ colour: scheme === 'light' ? GOLD_INK : GOLD, width: '3px' })
        expect(ratio(mark!.colour, drawn.ground), `${what}: the bar on the tab bar's ground`).toBeGreaterThanOrEqual(3)
      }
      // With the sheet open above it, the tab bar is drawn as it was, the Menu tab reading Close in the same colours.
      const box = await menuTab(page).boundingBox()
      expect(box, 'the Menu tab drawn').not.toBeNull()
      await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
      await expect(menuSheet(page)).toBeVisible()
      const open = await tabsAsDrawn(page)
      seen[`${scheme} /about, the sheet open`] = open
      expect(open.tabs.map((t) => t.words), `${scheme}: the sheet open`).toEqual([...tabWords().slice(0, 3), 'Close'])
      for (const tab of open.tabs) expect(ratio(tab.colour, open.ground), `${scheme}, the sheet open: ${tab.words} in ${tab.colour} on ${open.ground}`).toBeGreaterThanOrEqual(4.5)
      await page.keyboard.press('Escape')
      await expect(menuSheet(page)).toHaveCount(0)
    }
    await testInfo.attach('tab-bar-colours.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  for (const width of [320, 390] as const) {
    test(`a11y-on at ${width} by 844, light and dark: each tab's ring, a 2 pixel line in the look's ring colour drawn 4 pixels inside the tab, whole inside its tab and the window, at 3:1 or more on the tab bar's ground`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the tab bar beside the app bar')
      await page.setViewportSize({ width, height: HEIGHT })
      const seen: Record<string, unknown> = {}
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        await openPage(page, '/')
        const tabs = tabBar(page).locator('a, button')
        await expect(tabs).toHaveCount(4)
        for (let i = 0; i < 4; i++) {
          const tab = tabs.nth(i)
          await keyboardFocus(page, tab)
          const r = await tab.evaluate((el, site) => {
            const s = getComputedStyle(el)
            const b = el.getBoundingClientRect()
            return {
              words: (el.textContent ?? '').trim(),
              ring: { style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset, colour: s.outlineColor },
              box: { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
              window: { width: window.innerWidth, height: window.innerHeight },
              ground: getComputedStyle(el.closest(site.tabBar)!).backgroundColor,
            }
          }, SITE)
          const what = `${scheme} ${width}: ${r.words}`
          seen[what] = { ...r, ratio: ratio(r.ring.colour, r.ground) }
          expect([r.ring.style, r.ring.width, r.ring.offset], what).toEqual(['solid', '2px', '-4px'])
          expect(r.ring.colour, what).toBe(scheme === 'light' ? NAVY : GOLD)
          // The ring's outer edge: 4 pixels inside the tab, less its 2 pixel width.
          const inset = -(parseFloat(r.ring.offset) + parseFloat(r.ring.width))
          const ring = { top: r.box.top + inset, bottom: r.box.bottom - inset, left: r.box.left + inset, right: r.box.right - inset }
          expect(inset, `${what}: inside the tab`).toBeGreaterThan(0)
          expect(ring.left >= 0 && ring.top >= 0 && ring.right <= r.window.width && ring.bottom <= r.window.height, `${what}: the ring inside the window, ${JSON.stringify(ring)}`).toBe(true)
          expect(ratio(r.ring.colour, r.ground), `${what}: the ring on ${r.ground}`).toBeGreaterThanOrEqual(3)
        }
      }
      await testInfo.attach(`tab-rings-${width}.json`, { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
      expect(external).toEqual([])
    })
  }
})

// ── Each build ─────────────────────────────────────────────────────────────

test.describe('the viewport tag and the dock on each build (WS02 step 7)', () => {
  test('each build\'s page holds one viewport tag, as served and as drawn: viewport-fit=cover on a11y-on, where the chrome is on, and today\'s tag on a11y-off', async ({ page, request, external }, testInfo) => {
    const want = VIEWPORT[testInfo.project.name]
    expect(want, `a viewport tag listed for ${testInfo.project.name}`).toBeDefined()
    for (const route of ['/', '/tournaments']) {
      const served = await (await request.get(route)).text()
      expect([...served.matchAll(/<meta name="viewport" content="([^"]*)"/g)].map((m) => m[1]), `${route} as served`).toEqual([want])
    }
    await page.goto('/')
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1)
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', want)
    expect(external).toEqual([])
  })

  test('a11y-off at 320 and 390 by 844: no dock, no tab bar and no --bottom-chrome-h, the page as it is today', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'the site as it is today, on a11y-off')
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: HEIGHT })
      await openPage(page, '/')
      await expect(dock(page)).toHaveCount(0)
      await expect(tabBar(page)).toHaveCount(0)
      expect((await dockNow(page)).written, `${width}: nothing written`).toBe('')
    }
    expect(external).toEqual([])
  })
})

// ── Axe ────────────────────────────────────────────────────────────────────

test.describe('axe on the pages with the tab bar (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844, light and dark: axe, with the WCAG 2.0 to 2.2 A and AA rules, finds nothing on / and /tournaments with the tab bar drawn, nor in the sheet open above it, nor in the tab bar beside the open sheet', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the tab bar beside the app bar')
    test.setTimeout(120_000)
    await page.setViewportSize({ width: 390, height: HEIGHT })
    const report: string[] = []
    const found: string[] = []
    const run = async (what: string, include?: string) => {
      const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS)
      const results = await (include ? builder.include(include) : builder).analyze()
      report.push(`axe on ${what}: ${results.passes.length} rules passed, ${results.violations.length} with findings.`)
      found.push(...results.violations.flatMap((v) => v.nodes.map((n) => `${what}: ${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`)))
      const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
      for (const rule of ['color-contrast', 'button-name']) expect(ran, `${what}: ${rule}`).toContain(rule)
    }
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const route of ['/', '/tournaments']) {
        await openPage(page, route)
        await expect(dock(page)).toHaveCount(1)
        await run(`${route}, ${scheme}, with the tab bar drawn`)
        // A press at the Menu tab's place, as a finger makes it.
        const box = await menuTab(page).boundingBox()
        expect(box, 'the Menu tab drawn').not.toBeNull()
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
        const sheet = menuSheet(page)
        await expect(sheet).toBeVisible()
        await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
        await run(`${route}, ${scheme}, the sheet open`, '[data-slot="menu-sheet"]')
        await run(`${route}, ${scheme}, the tab bar beside the open sheet`, SITE.dock)
        await page.keyboard.press('Escape')
        await expect(sheet).toHaveCount(0)
      }
    }
    console.log(report.join('\n'))
    await testInfo.attach('axe-tab-bar.json', { body: JSON.stringify({ report, found }, null, 2), contentType: 'application/json' })
    expect(found, report.join('\n')).toEqual([])
    expect(external).toEqual([])
  })
})
