// test/a11y/clubs-directory-keys.spec.ts
//
// The Clubs directory (WS09 step 33) for a visitor with the keyboard alone, at
// 200 percent zoom, and with the choice of reduced motion, beside
// test/a11y/clubs-directory.spec.ts, on the clubs build alone (a11y-clubs).
// The list is answered with made-up clubs and the map is the stand-in the
// build draws when a page asks, which asks nothing of the map's provider.
// - Tab reaches the skip link, then every card in the list's order, then the
//   map's pins in the same order, then All of Louisiana; Enter on a pin
//   selects it and brings its card into view; Enter on a count circle opens it;
// - a window 640 wide, which is 1280 at 200 percent, draws the phone layout
//   (WS09 step 35), the map over the list's sheet, with nothing cut off at
//   either rest and no sideways scroll;
// - a pin's press asks for its card at once with less motion asked for, and
//   smoothly otherwise;
// - a selected pin differs from the others by its size and by aria-pressed,
//   and a hollow pin from a solid one by its shape's fill, not by colour alone;
// - on a phone (WS09 step 35): Tab meets the field, Near me, the orders and
//   Filters, then Skip to the list, then the pins in the list's order, then
//   the sheet's button and the cards; Skip to the list moves the focus to the
//   sheet; the Filters sheet is named, keeps the focus, and Escape and Done
//   give it back to the Filters button; the sheet low with its caption and
//   first card, "Show the list" and "Map" moving it, a pin's press raising
//   it to its card and giving it the focus, and the site's dock never
//   covered at either rest nor at the page's end; with no map, the list
//   alone and no sheet;
// - "Not here?" under the list at 390 and 1280, its two links leading to the
//   forms they name;
// - since checkpoint Y's review: Enter on a circle gives the focus to the
//   first of its pins; at 320 by 568, Skip to the list and each control
//   before it take the focus clear of the low sheet; and the pins of two
//   neighbouring towns stand apart at the whole state's view, so the middle
//   of each pin's box is that pin's own button.
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { SITE, dock, siteFooter } from './chrome'
import { A11Y_CLUBS_VARIANT } from './global-setup'

/** The flag that asks the build for the stand-in map, as src/areas/clubs/directoryPins.ts names it. */
const STAND_IN_FLAG = 'lcaMapStandIn'

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the directory is drawn on the clubs build alone')
}

function row(id: string, name: string, city: string, point: [number, number] | null, statement: string | null) {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: '#1f4e79', image_url: null, region: 'North Louisiana', latitude: null, longitude: null,
    slug: id, statement, description: statement ? null : 'A made-up club for every strength.', point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Six made-up clubs: two in one town, one with no statement, one with no point, and, so that the list is long, two more. */
const CLUBS = [
  row('example-rooks-club', 'Example Rooks Club', 'Example Village', [32.5, -92.1], 'Saturdays at 10:00 AM at the Example Library.'),
  row('example-bishops-club', 'Example Bishops Club', 'Example City', [30.45, -91.18], 'Tuesdays at 7:00 PM in the Example Community Center.'),
  row('example-knights-club', 'Example Knights Club', 'Example City', [30.41, -91.1], null),
  row('example-pawns-club', 'Example Pawns Club', 'Example Town', null, 'Thursdays at 6:30 PM.'),
  row('example-queens-club', 'Example Queens Club', 'Example Hamlet', [30.22, -92.02], 'Every other Sunday at 2:00 PM.'),
  row('example-kings-club', 'Example Kings Club', 'Example Port', [30.23, -93.22], 'Mondays at 6:00 PM.'),
]

/** Two made-up clubs in two real towns a mile or so apart, whose pins would touch at the whole state's view. */
const NEIGHBOURS = [
  row('example-pine-club', 'Example Pine Club', 'Shreveport', [32.525, -93.75], 'Mondays at 7:00 PM.'),
  row('example-oak-club', 'Example Oak Club', 'Bossier City', [32.516, -93.732], 'Thursdays at 7:00 PM.'),
]

/** Opens the directory with the made-up clubs, and with the stand-in map unless `withMap` is false. */
async function openDirectory(page: Page, withMap = true, clubs: ReadonlyArray<ReturnType<typeof row>> = CLUBS) {
  await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs }) }))
  if (withMap) await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
  await openDrawn(page, '/clubs', [
    page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true }),
    page.getByRole('link', { name: /^Example Bishops Club/ }),
  ])
  await page.evaluate(() => document.fonts.ready)
}

const map = (page: Page) => page.getByRole('group', { name: 'Map of the clubs' })

/** What has the focus, as the page names it: a card's or pin's id, or the words of a link or button. */
const focused = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null
  return el ? (el.getAttribute('data-card') ?? el.getAttribute('data-pin') ?? el.getAttribute('data-circle') ?? el.textContent?.trim() ?? '') : ''
})

test.describe('the keyboard alone', () => {
  test.use({ reducedMotion: 'reduce' })

  test('Tab meets the skip link, the cards in order, the pins in order, then All of Louisiana; Enter selects a pin and opens a circle', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openDirectory(page)
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const met: string[] = []
    for (let i = 0; i < 40 && !met.includes('All of Louisiana'); i++) {
      await page.keyboard.press('Tab')
      met.push(await focused(page))
    }
    const start = met.indexOf('Skip to the map')
    expect(start).toBeGreaterThanOrEqual(0)
    const after = met.slice(start)
    expect(after).toEqual([
      'Skip to the map',
      'example-bishops-club', 'example-kings-club', 'example-knights-club', 'example-pawns-club', 'example-queens-club', 'example-rooks-club',
      'group:example-bishops-club', 'example-kings-club', 'example-queens-club', 'example-rooks-club',
      'All of Louisiana',
    ])

    // Enter on a pin selects it and brings its card into view.
    const rooks = map(page).getByRole('button', { name: 'Example Rooks Club, Example Village' })
    await rooks.focus()
    await page.keyboard.press('Enter')
    await expect(rooks).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-card="example-rooks-club"]')).toHaveAttribute('data-selected', 'true')
    await expect(page.locator('[data-card="example-rooks-club"]')).toBeInViewport()
    // Enter on the circle of two clubs in one town opens it into its pins.
    const circle = map(page).getByRole('button', { name: '2 clubs in Example City, show each' })
    await circle.focus()
    await page.keyboard.press('Enter')
    await expect(map(page).locator('[data-pin="example-knights-club"]')).toHaveCount(1)
    await expect(map(page).locator('[data-circle]')).toHaveCount(0)
    // The circle's own button is gone, and the focus is on the first of its pins in the list's order, not on the page.
    await expect(map(page).locator('[data-pin="example-bishops-club"]')).toBeFocused()
    // Escape from the map is not needed: All of Louisiana is a button like the rest.
    await map(page).getByRole('button', { name: 'All of Louisiana' }).focus()
    await page.keyboard.press('Enter')
    await expect(map(page).locator('[aria-pressed="true"]')).toHaveCount(0)
    await expect(map(page).locator('[data-pin="example-knights-club"]')).toHaveCount(0)
  })

  test('shows the focus: a card and a pin each get a visible ring or outline when focused', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openDirectory(page)
    for (const target of [page.locator('[data-card="example-bishops-club"]'), map(page).locator('[data-pin="example-rooks-club"]')]) {
      await target.focus()
      const ring = await target.evaluate((el) => {
        const style = getComputedStyle(el)
        return { shadow: style.boxShadow, outline: style.outlineStyle }
      })
      expect(ring.shadow !== 'none' || ring.outline !== 'none').toBe(true)
    }
  })
})

test.describe('200 percent zoom', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a window 640 wide, which is 1280 at 200 percent, draws the map over the list\'s sheet, nothing cut off at either rest, with no sideways scroll', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 640, height: 400 })
    await openDirectory(page)
    const list = (await page.getByRole('list', { name: 'Clubs, A to Z' }).boundingBox())!
    const drawn = (await map(page).boundingBox())!
    // The phone layout (WS09 step 35): the list in the sheet, which rises from the window's foot over the map.
    const sheet = page.getByRole('region', { name: 'List of clubs' })
    const low = (await sheet.boundingBox())!
    expect(low.y + low.height).toBeCloseTo(400, 0)
    expect(drawn.y).toBeLessThan(low.y + low.height)
    expect(Math.round(list.width)).toBeGreaterThan(400)
    for (const rest of ['low', 'full'] as const) {
      if (rest === 'full') await sheet.getByRole('button', { name: 'Show the list' }).click()
      await expect(sheet).toHaveAttribute('data-sheet', rest)
      // The sheet lies inside the window, and what it holds scrolls inside it: the last card is reached and in sight when focused.
      const box = (await sheet.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(-0.5)
      expect(box.y + box.height).toBeLessThanOrEqual(400.5)
      await page.locator('[data-card="example-rooks-club"]').focus()
      await expect(page.locator('[data-card="example-rooks-club"]')).toBeInViewport({ ratio: 1 })
    }
    const room = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, room: document.documentElement.clientWidth }))
    expect(room.scroll).toBeLessThanOrEqual(room.room)
    // The narrowest window the page is held to is 320.
    await page.setViewportSize({ width: 320, height: 400 })
    const narrow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, room: document.documentElement.clientWidth }))
    expect(narrow.scroll).toBeLessThanOrEqual(narrow.room)
  })
})

test.describe('the choice of reduced motion', () => {
  /** Records how each call to scrollIntoView was asked to move. */
  async function recordScrolls(page: Page) {
    await page.addInitScript(() => {
      const asked: string[] = []
      ;(window as unknown as Record<string, unknown>).__scrolls = asked
      const real = Element.prototype.scrollIntoView
      Element.prototype.scrollIntoView = function (this: Element, options?: boolean | ScrollIntoViewOptions) {
        if (this.closest('li') && this.querySelector('[data-card]')) asked.push(typeof options === 'object' && options.behavior ? options.behavior : 'default')
        return real.call(this, options as ScrollIntoViewOptions)
      }
    })
  }
  const scrolls = (page: Page) => page.evaluate(() => (window as unknown as { __scrolls: string[] }).__scrolls)

  test.describe('asked for less', () => {
    test.use({ reducedMotion: 'reduce' })
    test('a pin\'s press brings its card into view at once, not smoothly', async ({ page }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize({ width: 1280, height: 500 })
      await recordScrolls(page)
      await openDirectory(page)
      await map(page).getByRole('button', { name: 'Example Rooks Club, Example Village' }).click()
      await expect.poll(() => scrolls(page)).toEqual(['auto'])
    })
  })

  test.describe('asked for nothing', () => {
    test.use({ reducedMotion: 'no-preference' })
    test('a pin\'s press brings its card into view smoothly', async ({ page }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize({ width: 1280, height: 500 })
      await recordScrolls(page)
      await openDirectory(page)
      await map(page).getByRole('button', { name: 'Example Rooks Club, Example Village' }).click()
      await expect.poll(() => scrolls(page)).toEqual(['smooth'])
    })
  })
})

test.describe('a pin\'s state without colour', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the selected pin is larger and pressed, and a hollow pin is drawn with another fill than a solid one, in both looks', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openDirectory(page)
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await map(page).getByRole('button', { name: '2 clubs in Example City, show each' }).click()
      const size = async (id: string) => (await map(page).locator(`[data-pin="${id}"] svg`).boundingBox())!
      const fill = (id: string) => map(page).locator(`[data-pin="${id}"] path`).evaluate((el) => getComputedStyle(el).fill)
      expect(await fill('example-bishops-club'), scheme).not.toBe(await fill('example-knights-club'))
      const before = await size('example-kings-club')
      await map(page).getByRole('button', { name: 'Example Kings Club, Example Port' }).click()
      const after = await size('example-kings-club')
      expect(after.height, scheme).toBeGreaterThan(before.height)
      expect(after.width, scheme).toBeGreaterThan(before.width)
      await expect(map(page).locator('[data-pin="example-kings-club"]')).toHaveAttribute('aria-pressed', 'true')
      await expect(map(page).locator('[data-pin="example-kings-club"] [data-ring]')).toHaveCount(1)
      await map(page).getByRole('button', { name: 'All of Louisiana' }).click()
    }
  })
})

test.describe('on a phone (WS09 step 35)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('Tab meets the field, Near me, the orders, Filters, Skip to the list, the pins in the list\'s order, then the sheet\'s button and the cards; Skip to the list moves the focus to the sheet', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 390, height: 844 })
    await openDirectory(page)
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    const met: string[] = []
    // The rooks club comes twice: its pin, then its card, the last in the list.
    for (let i = 0; i < 40 && met.filter((m) => m === 'example-rooks-club').length < 2; i++) {
      await page.keyboard.press('Tab')
      met.push(await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return ''
        if (el.tagName === 'INPUT') return 'field'
        return el.getAttribute('data-card') ?? el.getAttribute('data-pin') ?? el.getAttribute('data-circle') ?? el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
      }))
    }
    const from = met.indexOf('field')
    expect(from).toBeGreaterThanOrEqual(0)
    expect(met.slice(from)).toEqual([
      'field', 'Near me', 'A to Z', 'Nearest', 'Filters', 'Skip to the list',
      'group:example-bishops-club', 'example-kings-club', 'example-queens-club', 'example-rooks-club', 'All of Louisiana',
      'Show the list',
      'example-bishops-club', 'example-kings-club', 'example-knights-club', 'example-pawns-club', 'example-queens-club', 'example-rooks-club',
    ])
    // Tabbing through the sheet at its low rest moved neither the sheet nor the page's map out of place.
    await expect(page.getByRole('region', { name: 'List of clubs' })).toHaveAttribute('data-sheet', 'low')
    await expect(page.locator('[data-card="example-rooks-club"]')).toBeInViewport()
    // Skip to the list sits before the map, and moves the focus to the sheet without raising it or marking the address.
    const skip = page.getByRole('link', { name: 'Skip to the list' })
    await skip.focus()
    await expect(skip).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('region', { name: 'List of clubs' })).toBeFocused()
    await expect(page.getByRole('region', { name: 'List of clubs' })).toHaveAttribute('data-sheet', 'low')
    expect(new URL(page.url()).hash).toBe('')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Show the list' })).toBeFocused()
  })

  test('at 320 by 568, Tab from the field to Skip to the list keeps each control and the link clear of the low sheet', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 320, height: 568 })
    await openDirectory(page)
    await page.getByRole('textbox', { name: 'City, ZIP or club name' }).focus()
    const sheet = page.getByRole('region', { name: 'List of clubs' })
    await expect(sheet).toHaveAttribute('data-sheet', 'low')
    for (const name of ['Near me', 'A to Z', 'Nearest', 'Filters', 'Skip to the list']) {
      await page.keyboard.press('Tab')
      const clear = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const low = document.querySelector('[data-sheet="low"]')!.getBoundingClientRect()
        return { name: el.textContent?.trim() ?? '', bottom: el.getBoundingClientRect().bottom, top: low.top }
      })
      expect(clear.name, name).toBe(name)
      expect(clear.bottom, name).toBeLessThanOrEqual(clear.top)
    }
    await expect(sheet).toHaveAttribute('data-sheet', 'low')
  })

  test('the Filters sheet is named, keeps the focus inside it, and Escape and Done give it back to the Filters button', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 390, height: 844 })
    await openDirectory(page)
    const button = page.getByRole('button', { name: /^Filters/ })
    for (const shut of ['Escape', 'Done'] as const) {
      await button.focus()
      await page.keyboard.press('Enter')
      const dialog = page.getByRole('dialog', { name: 'Filters' })
      await expect(dialog).toBeVisible()
      await expect(dialog.getByRole('button', { name: 'North Louisiana 6' })).toBeVisible()
      // The focus stays inside: Tab past its last control comes back to its first.
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab')
        expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true)
      }
      // The sheet sits over the page but not over the dock.
      const box = (await dialog.boundingBox())!
      const foot = (await dock(page).boundingBox())!
      expect(box.y + box.height).toBeLessThanOrEqual(foot.y + 0.5)
      if (shut === 'Escape') await page.keyboard.press('Escape')
      else {
        await dialog.getByRole('button', { name: 'Done' }).focus()
        await page.keyboard.press('Enter')
      }
      await expect(dialog).toHaveCount(0)
      await expect(button).toBeFocused()
      await expect(button).toHaveAttribute('aria-expanded', 'false')
    }
  })
})

/** The list's sheet on a phone (WS09 step 35). */
const sheet = (page: Page) => page.getByRole('region', { name: 'List of clubs' })
const cards = (page: Page) => page.getByRole('list', { name: 'Clubs, A to Z' }).getByRole('listitem')

/** The site's dock and the sheet, each as the window draws it, and whether the window shows the dock at its middle. */
function dockAndSheet(page: Page) {
  return page.evaluate((dockSelector) => {
    const box = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom }
    }
    const foot = document.querySelector(dockSelector)
    const d = foot?.getBoundingClientRect()
    const atFoot = d ? document.elementFromPoint(d.left + d.width / 2, d.top + Math.min(20, d.height / 2)) : null
    return { dock: box(foot), sheet: box(document.querySelector('#club-list')), dockOnTop: !!(foot && atFoot && foot.contains(atFoot)) }
  }, SITE.dock)
}

test.describe('the phone\'s sheet (WS09 step 35)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('at 390: the map with the sheet low, its caption and first card; Show the list and Map move it; the dock is never covered', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 390, height: 844 })
    await openDirectory(page)
    await expect(map(page)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Skip to the map' })).toHaveCount(0)
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'low')
    // The sheet is not a dialog: it holds no focus and hides nothing of the page.
    expect(await sheet(page).evaluate((el) => [el.getAttribute('role'), el.getAttribute('aria-modal'), el.closest('[role="dialog"]') === null])).toEqual([null, null, true])
    // At its low rest the caption and the first card are in sight, above the dock.
    const caption = sheet(page).getByRole('status')
    await expect(caption).toHaveText('All 6 clubs, A to Z. Meeting times are as each club states them; confirm before a first visit.')
    await expect(caption).toBeInViewport()
    const seen = await dockAndSheet(page)
    expect(seen.dock, 'the dock is drawn at 390').not.toBeNull()
    const first = (await cards(page).first().getByRole('link').boundingBox())!
    expect(first.y + first.height).toBeLessThanOrEqual(seen.dock!.top + 0.5)
    expect(seen.sheet!.bottom).toBeLessThanOrEqual(seen.dock!.top + 0.5)
    expect(seen.dockOnTop).toBe(true)
    // Show the list raises it; Map, the same button, lowers it; the focus stays on it.
    await sheet(page).getByRole('button', { name: 'Show the list' }).focus()
    await page.keyboard.press('Enter')
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
    await expect(sheet(page).getByRole('button', { name: 'Map', exact: true })).toBeFocused()
    const full = await dockAndSheet(page)
    expect(full.sheet!.bottom).toBeLessThanOrEqual(full.dock!.top + 0.5)
    expect(full.dockOnTop).toBe(true)
    // The orders and Filters stay in sight above the full sheet.
    for (const name of ['A to Z', 'Nearest']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: /^Filters/ })).toBeInViewport()
    // Every card is reached at the full rest, and scrolls into sight in the sheet when it takes the focus.
    await page.locator('[data-card="example-rooks-club"]').focus()
    await expect(page.locator('[data-card="example-rooks-club"]')).toBeInViewport({ ratio: 1 })
    await page.keyboard.press('Shift+Tab')
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
    // Scrolled down to the tiles, then lowered: the low rest opens on the caption and the first card again.
    await sheet(page).getByRole('link', { name: 'Start a club', exact: true }).scrollIntoViewIfNeeded()
    const list = sheet(page).locator('.overflow-y-auto')
    expect(await list.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    await sheet(page).getByRole('button', { name: 'Map', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'low')
    await expect(sheet(page).getByRole('button', { name: 'Show the list' })).toBeFocused()
    expect(await list.evaluate((el) => el.scrollTop)).toBe(0)
    await expect(caption).toBeInViewport()
    await expect(cards(page).first().getByRole('link')).toBeInViewport()
    // At the page's end the sheet comes to rest under the map, over neither the footer nor the dock.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const end = await dockAndSheet(page)
    expect(end.sheet!.bottom).toBeLessThanOrEqual(end.dock!.top + 0.5)
    expect(end.dockOnTop).toBe(true)
    await expect(siteFooter(page)).toBeInViewport()
  })

  test('at 390: a pin\'s press raises the sheet to its card, marks it and gives it the focus; the focus back on the map lowers it', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 390, height: 844 })
    await openDirectory(page)
    // The pins come in the list's order.
    expect(await map(page).locator('[data-pin], [data-circle]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual([
      '2 clubs in Example City, show each', 'Example Kings Club, Example Port', 'Example Queens Club, Example Hamlet', 'Example Rooks Club, Example Village',
    ])
    const rooks = map(page).getByRole('button', { name: 'Example Rooks Club, Example Village' })
    await rooks.focus()
    await page.keyboard.press('Enter')
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
    await expect(rooks).toHaveAttribute('aria-pressed', 'true')
    const card = page.locator('[data-card="example-rooks-club"]')
    await expect(card).toHaveAttribute('data-selected', 'true')
    await expect(card).toBeFocused()
    await expect(card).toBeInViewport()
    // The focus going back to the map lowers the sheet, so the pin it reaches is in sight.
    await rooks.focus()
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'low')
    await expect(rooks).toBeInViewport()
    // A pointer's press does the same.
    await map(page).getByRole('button', { name: 'Example Kings Club, Example Port' }).click()
    await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
    await expect(page.locator('[data-card="example-kings-club"]')).toBeFocused()
  })

  test('at 390 with no map, the list stands alone with its one line and no sheet', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 390, height: 844 })
    await openDirectory(page, false)
    await expect(page.getByText('The map is not shown here. Every club is in the list.', { exact: true })).toBeVisible()
    await expect(sheet(page)).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Skip to the list' })).toHaveCount(0)
    expect(await cards(page).count()).toBe(6)
  })
})

for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }] as const) {
  test(`Not here? at ${size.width}: three tiles under the list, two leading to the forms they name and one sentence, naming no one`, async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize(size)
    await openDirectory(page)
    const tiles = page.getByRole('region', { name: 'Not here?' })
    expect(await tiles.getByRole('heading', { level: 3 }).allTextContents()).toEqual(['Missing a club?', 'No club near you?', 'Something out of date?'])
    await expect(tiles.getByText('Open the club\'s own page and press Suggest an update.', { exact: true })).toBeVisible()
    expect(await tiles.getByRole('link').count()).toBe(2)
    expect(await tiles.textContent()).not.toMatch(/keeper|representative|\bseat\b|\brep\b|@|volunteer/i)
    for (const [name, address] of [['Suggest a club', '/clubs/suggest'], ['Start a club', '/clubs/suggest?kind=start']] as const) {
      if (size.width < 1024) {
        await sheet(page).getByRole('button', { name: 'Show the list' }).click()
        await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
      }
      const link = tiles.getByRole('link', { name, exact: true })
      await expect(link).toHaveAttribute('href', address)
      await link.focus()
      await expect(link).toBeInViewport()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible()
      const at = new URL(page.url())
      expect(`${at.pathname}${at.search}`).toBe(address)
      await page.goBack()
      await expect(page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true })).toBeVisible()
    }
  })
}

test.describe('two neighbouring towns at the whole state\'s view', () => {
  for (const size of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    test(`at ${size.width}: their pins stand apart, the middle of each pin's box its own button`, async ({ page }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize(size)
      await openDirectory(page, true, [...CLUBS, ...NEIGHBOURS])
      await expect(map(page)).toHaveAttribute('data-view', 'state')
      for (const id of ['example-pine-club', 'example-oak-club']) {
        const own = await page.evaluate((pin) => {
          const button = document.querySelector<HTMLElement>(`[data-pin="${pin}"]`)!
          const box = button.getBoundingClientRect()
          const at = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          return at?.closest('[data-pin]')?.getAttribute('data-pin') ?? null
        }, id)
        expect(own, id).toBe(id)
      }
    })
  }
})
