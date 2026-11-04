// test/a11y/nav-edges.spec.ts
//
// The page frame, the browser bar's colour and the rings of WS02 step 3 at
// their edges, in a browser. test/a11y/nav.spec.ts holds the frame on three
// pages at two widths, the layout shift of a first visit, the bar's colour
// after a pick and the rings on the gold; this file holds what that leaves:
//
// - The skip link (AC13) is hidden until it has the focus, not merely moved
//   away: a 1 by 1 pixel box, clipped; a printed page never shows it, focused
//   or not; and Shift+Tab from the header's brand link goes back to it.
// - The loading line (AC23), while a page's code is held back: on a11y-on it
//   holds the height of the window under the header and the footer is not
//   drawn until the page is there, with or without a banner above the
//   header, at 390 by 844 and 1280 by 800, with today's row at its top; on
//   a11y-off today's short line leaves the footer inside the window, which
//   is the jump the chrome's line ends.
// - The rings on the gold as they are drawn (AC19, its first half), read from
//   the screen and not from the style sheet: the dismiss button is drawn at
//   70 per cent opacity, ring and all, and every control on the gold still
//   shows a ring of 3:1 or more against the gold, in the light look and in
//   dark mode; a tone the banner does not know is drawn gold and rings navy,
//   and the navy tone keeps the navy band's gold ring.
//
// Reads only; the announcements and the impersonation target are stubbed in
// the browser with made-up fixture data in the seed's style.
//
// The header and the footer are read through test/a11y/chrome.ts. The footer
// is read by its selector, not its role, while the loading line may hide
// it, and the one check here that holds for today's footer alone, on
// a11y-off while a page's code is held, says so through it.
import type { Locator, Page, Route, TestInfo } from '@playwright/test'
import { SITE, brandLink, ifToday } from './chrome'
import { expect, openDrawn, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const SKIP = 'Skip to content'
const LOADING = 'Loading…'

const NAVY = 'rgb(26, 39, 68)'
const GOLD = 'rgb(200, 169, 74)'

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

/** WCAG 2.x contrast ratio of two rgb() colours. */
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

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** Where the keyboard is: the element's tag and its name. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return 'body'
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return `${el.tagName.toLowerCase()} ${name}`.trim()
  })

/** Gives the element keyboard focus, as a keyboard user would see it, then waits for any transition to finish. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab')
  await target.focus()
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await target.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  await frames(page)
}

/** The colours at points of a screenshot, read in the page itself. */
function coloursAt(page: Page, png: Buffer, points: (readonly [number, number])[]): Promise<string[]> {
  return page.evaluate(async ({ b64, points }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    return points.map(([x, y]) => {
      const [r, g, b] = context.getImageData(x, y, 1, 1).data
      return `rgb(${r}, ${g}, ${b})`
    })
  }, { b64: png.toString('base64'), points })
}

/** What each page shows once it is drawn. */
const PAGES: Record<string, (page: Page) => Locator[]> = {
  '/': (page) => [page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })],
  '/about': (page) => [page.getByRole('heading', { level: 1, name: 'About LCA' })],
  '/membership': (page) => [page.getByRole('heading', { level: 1, name: 'LCA Membership' })],
}

/** Opens a page, waits until it is drawn and its fonts are in, and leaves the focus nowhere. */
async function openQuiet(page: Page, route: string) {
  await openDrawn(page, route, PAGES[route](page))
  await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0)
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
  expect(await focused(page)).toBe('body')
}

/** Announcements as GET /api/announcement gives them. */
const notice = (id: string, tone: string, message: string, linkLabel: string) => ({ id, tone, size: 'default', message, linkUrl: '/tournaments', linkLabel })
const GOLD_NOTICE = notice('fx-ann-gold', 'gold', 'Registration for the Fixture Fall Open closes Friday, October 30 at 7:00 PM.', 'Enter the Fixture Fall Open')
const UNKNOWN_NOTICE = notice('fx-ann-teal', 'teal', 'The Fixture Quads move to the north hall on Saturday, October 31.', 'See the Fixture Quads')
const NAVY_NOTICE = notice('fx-ann-navy', 'navy', 'The Fixture Blitz is full.', 'Join the Fixture Blitz waitlist')

/** Answers the page's announcement call with these announcements. */
async function stubAnnouncements(page: Page, announcements: object[]) {
  await page.route('**/api/announcement', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ announcements }) }),
  )
}

/** Plants the impersonation target the site keeps for a tab, so the impersonation banner is drawn. */
async function plantImpersonation(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('lca_impersonation_target', JSON.stringify({ id: 'fx-m-p5', fullName: 'Riley Fixture', email: 'riley.fixture@example.org' }))
  })
}

// ── The skip link, hidden until it has the focus ──────────────────────────

test.describe('the skip link at its edges', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on: hidden until it has the focus, as a clipped 1 by 1 pixel box, never shown on a printed page, and Shift+Tab from the brand link goes back to it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the skip link comes with the chrome, on a11y-on')
    const skip = page.getByRole('link', { name: SKIP })
    // Read by its attribute, since a printed page takes it out of the accessibility tree, where the role would look for it.
    const box = () =>
      page.locator('a[data-skip-link]').evaluate((el) => {
        const s = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return { width: r.width, height: r.height, position: s.position, clip: s.clipPath, overflow: s.overflow, display: s.display }
      })
    for (const [width, height] of SIZES) {
      await page.setViewportSize({ width, height })
      await openQuiet(page, '/')
      // In the page and in the tab order, but drawn as nothing a sighted visitor sees.
      await expect(skip).toHaveCount(1)
      const hidden = await box()
      expect(hidden, `${width}, before the focus`).toMatchObject({ position: 'absolute', overflow: 'hidden', display: 'block' })
      expect(hidden.width).toBeLessThanOrEqual(1)
      expect(hidden.height).toBeLessThanOrEqual(1)
      expect(hidden.clip).not.toBe('none')
      // Focused, it is drawn whole; printed, it is drawn not at all, focused or not.
      await page.keyboard.press('Tab')
      await expect(skip).toBeFocused()
      const shown = await box()
      expect(shown.position).toBe('fixed')
      expect(shown.width).toBeGreaterThan(40)
      await page.emulateMedia({ media: 'print' })
      expect((await box()).display, `${width}, printed with the focus`).toBe('none')
      await page.emulateMedia({ media: 'screen' })
      await expect(skip).toBeVisible()
      // Forward to the header's brand link, and back again.
      await page.keyboard.press('Tab')
      await expect(brandLink(page)).toBeFocused()
      await page.keyboard.press('Shift+Tab')
      await expect(skip, `${width}: Shift+Tab from the brand link`).toBeFocused()
      expect((await box()).position).toBe('fixed')
      // Once the focus leaves it the other way, it is hidden again.
      await page.keyboard.press('Shift+Tab')
      expect(await focused(page)).not.toBe(`a ${SKIP}`)
      const again = await box()
      expect(again.width).toBeLessThanOrEqual(1)
      await page.emulateMedia({ media: 'print' })
      expect((await box()).display, `${width}, printed`).toBe('none')
      await page.emulateMedia({ media: 'screen' })
    }
    expect(external).toEqual([])
  })
})

// ── The loading line while a page's code is held ───────────────────────────

/** The code of the pages loaded on demand that are read here, and the heritage layout /about is drawn in on a11y-on. */
const PAGE_CODE = /\/assets\/(?:AboutPage|HeritageLayout|MembershipPage)-[\w-]+\.js(?:\?.*)?$/

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
  return {
    asked,
    release: async () => {
      open()
      await page.unroute(PAGE_CODE, handler)
    },
  }
}

/** The frame while the loading line is on screen: the line's box, its row's place in it, the header's, and the footer's, drawn or not. */
function frameWhileLoading(page: Page) {
  return page.evaluate(({ loading, site }) => {
    const main = document.querySelector('main')!
    const line = main.querySelector('[role="status"]') as HTMLElement
    const words = [...line.querySelectorAll('span')].find((s) => s.textContent === loading)!
    const header = document.querySelector(site.header)!
    const footer = document.querySelector(site.footer)!
    return {
      window: window.innerHeight,
      header: header.getBoundingClientRect().height,
      mainTop: main.getBoundingClientRect().top,
      line: { top: line.getBoundingClientRect().top, height: line.getBoundingClientRect().height },
      wordsTop: words.getBoundingClientRect().top,
      footer: { display: getComputedStyle(footer).display, top: footer.getBoundingClientRect().top, height: footer.getBoundingClientRect().height },
    }
  }, { loading: LOADING, site: SITE })
}

/** Whether the footer is drawn now, read by its selector, since a footer that is not drawn has no role to find it by. */
const footerDrawn = (page: Page) => page.locator(SITE.footer).evaluate((el) => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0)

test.describe('the loading line while a page\'s code is held back', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const route of ['/about', '/membership']) {
    test(`${route}, at 390 by 844 and 1280 by 800, with and without a banner above the header: on a11y-on the line holds the window under the header and the footer is not drawn until the page is there; on a11y-off today's line leaves the footer in the window`, async ({ page, external }, testInfo) => {
      const on = testInfo.project.name === ON
      const seen: Record<string, unknown> = {}
      for (const banner of [false, true]) {
        // The stub added last is tried first, so this one answers from here on.
        await stubAnnouncements(page, banner ? [GOLD_NOTICE] : [])
        for (const [width, height] of SIZES) {
          await page.setViewportSize({ width, height })
          const code = await holdCode(page)
          await page.goto(route, { waitUntil: 'commit' })
          await expect(page.locator('main').getByText(LOADING, { exact: true })).toBeVisible()
          if (banner) await expect(page.getByText(GOLD_NOTICE.message, { exact: false })).toBeVisible()
          await page.evaluate(() => document.fonts.ready)
          await frames(page)
          const at = await frameWhileLoading(page)
          seen[`${width} by ${height}${banner ? ', with a banner' : ''}`] = at
          expect(code.asked.length, 'the page\'s code was asked for and held').toBeGreaterThan(0)
          // The row of today's line, its spinner and its word, sits at the line's top, under its padding.
          expect(at.wordsTop - at.line.top).toBeLessThan(140)
          expect(at.line.top).toBe(at.mainTop)
          if (on) {
            expect(at.line.height, `${width}: the line holds the window less the header`).toBeGreaterThanOrEqual(at.window - 64)
            // Not drawn at all, so it cannot move when the page arrives, whatever the page's height.
            expect(at.footer, `${width}${banner ? ', with a banner' : ''}: the footer is not drawn while the line shows`).toEqual({ display: 'none', top: 0, height: 0 })
          } else {
            expect(at.line.height, `${width}: today's line`).toBeLessThan(300)
            await ifToday(testInfo, 'footer', width, 'today\'s footer drawn inside the window while the code is held', () => {
              expect(at.footer.display).toBe('block')
              expect(at.footer.top, `${width}: today's footer is inside the window while the code is held`).toBeLessThan(at.window)
            })
          }
          await code.release()
          for (const locator of PAGES[route](page)) await expect(locator).toBeVisible({ timeout: 15_000 })
          await expect(page.locator('main').getByText(LOADING, { exact: true })).toHaveCount(0, { timeout: 15_000 })
          // The footer comes with the page, on both builds.
          expect(await footerDrawn(page), `${width}${banner ? ', with a banner' : ''}: the footer once the page is there`).toBe(true)
        }
      }
      await testInfo.attach(`loading-line-${route.slice(1)}.json`, { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
      expect(external).toEqual([])
    })
  }
})

// ── The rings on the gold, as drawn ────────────────────────────────────────

/**
 * The ring of a focused control as it is drawn: the colour on the screen
 * halfway along its top, 3 pixels out from its edge, the middle of the 2
 * pixel line drawn 2 pixels out, and the ground 6 pixels out, beyond the
 * line. Along the top, unlike beside a link, no word of the text around it
 * is in the way. The control's own opacity, if any, is in what the screen
 * shows.
 */
async function drawnRing(page: Page, control: Locator) {
  const box = (await control.boundingBox())!
  const x = Math.floor(box.x + box.width / 2)
  const [ring, beyond] = await coloursAt(page, await page.screenshot(), [
    [x, Math.floor(box.y - 3)],
    [x, Math.floor(box.y - 6)],
  ])
  return { ring, beyond }
}

test.describe('the rings on the gold, as they are drawn', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('a11y-on: every control on the gold, the dismiss button at its 70 per cent included, shows a ring of 3:1 or more against the gold on the screen, in the light look and in dark mode', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    await stubAnnouncements(page, [GOLD_NOTICE])
    await plantImpersonation(page)
    const controls = [
      page.getByRole('button', { name: 'Exit' }),
      page.getByRole('link', { name: GOLD_NOTICE.linkLabel }),
      page.getByRole('button', { name: `Dismiss: ${GOLD_NOTICE.linkLabel}` }),
    ]
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openQuiet(page, '/')
      for (const control of controls) {
        await keyboardFocus(page, control)
        const name = await control.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent?.trim() ?? '')
        const ground = await control.evaluate((el) => getComputedStyle(el.closest('[data-ring-ground="gold"]')!).backgroundColor)
        const opacity = await control.evaluate((el) => Number(getComputedStyle(el).opacity))
        const drawn = await drawnRing(page, control)
        seen[`${scheme} ${name}`] = { ...drawn, ground, opacity, ratio: ratio(drawn.ring, ground) }
        expect(ground).toBe(GOLD)
        expect(drawn.beyond, `${scheme} ${name}: the gold beyond the ring`).toBe(GOLD)
        expect(ratio(drawn.ring, ground), `${scheme} ${name}: the ring as drawn, ${drawn.ring}`).toBeGreaterThanOrEqual(3)
        if (name.startsWith('Dismiss')) {
          // Drawn at the button's own opacity: lighter than the navy, still well clear of the gold.
          expect(opacity).toBe(0.7)
          expect(drawn.ring).not.toBe(NAVY)
        } else {
          expect(drawn.ring, `${scheme} ${name}`).toBe(NAVY)
        }
      }
    }
    console.log(`the rings on the gold as drawn: ${JSON.stringify(seen)}`)
    await testInfo.attach('gold-rings-drawn.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on: a tone the banner does not know is drawn gold and rings navy, and the navy tone keeps the navy band\'s gold ring, in the light look and in dark mode', async ({ page, external }, testInfo) => {
    only(testInfo, ON)
    await stubAnnouncements(page, [UNKNOWN_NOTICE, NAVY_NOTICE])
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openQuiet(page, '/')
      for (const [item, ringColour, groundColour, marker] of [
        [UNKNOWN_NOTICE, NAVY, GOLD, 'gold'],
        [NAVY_NOTICE, GOLD, NAVY, null],
      ] as const) {
        for (const control of [page.getByRole('link', { name: item.linkLabel }), page.getByRole('button', { name: `Dismiss: ${item.linkLabel}` })]) {
          await keyboardFocus(page, control)
          const read = await control.evaluate((el) => {
            const box = el.closest('div:has(> span)') as HTMLElement
            return { outline: getComputedStyle(el).outlineColor, ground: getComputedStyle(box).backgroundColor, marker: box.getAttribute('data-ring-ground') }
          })
          seen[`${scheme} ${item.tone} ${await control.evaluate((el) => el.tagName.toLowerCase())}`] = read
          expect(read.marker, `${scheme} ${item.tone}`).toBe(marker)
          expect(read.ground, `${scheme} ${item.tone}`).toBe(groundColour)
          expect(read.outline, `${scheme} ${item.tone}`).toBe(ringColour)
          expect(ratio(read.outline, read.ground)).toBeGreaterThanOrEqual(3)
        }
      }
    }
    await testInfo.attach('tone-rings.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-off: the unknown tone is drawn gold and the marker changes nothing, the controls keeping the browser\'s own outline', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s site, on a11y-off')
    await stubAnnouncements(page, [UNKNOWN_NOTICE])
    await openQuiet(page, '/')
    const link = page.getByRole('link', { name: UNKNOWN_NOTICE.linkLabel })
    const box = page.locator('[data-ring-ground="gold"]')
    await expect(box).toHaveCount(1)
    expect(await box.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(GOLD)
    await keyboardFocus(page, link)
    const marked = await link.evaluate((el) => getComputedStyle(el).outlineColor)
    await box.evaluate((el) => el.removeAttribute('data-ring-ground'))
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await keyboardFocus(page, link)
    expect(await link.evaluate((el) => getComputedStyle(el).outlineColor)).toBe(marked)
    expect(marked).not.toBe(NAVY)
    expect(external).toEqual([])
  })
})
