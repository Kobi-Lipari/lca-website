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
// - a window 640 wide, which is 1280 at 200 percent, draws one column with the
//   list first and no sideways scroll;
// - a pin's press asks for its card at once with less motion asked for, and
//   smoothly otherwise;
// - a selected pin differs from the others by its size and by aria-pressed,
//   and a hollow pin from a solid one by its shape's fill, not by colour alone.
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
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

async function openDirectory(page: Page) {
  await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs: CLUBS }) }))
  await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
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

  test('a window 640 wide, which is 1280 at 200 percent, draws one column, the list first, with no sideways scroll', async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize({ width: 640, height: 400 })
    await openDirectory(page)
    const list = (await page.getByRole('list', { name: 'Clubs, A to Z' }).boundingBox())!
    const drawn = (await map(page).boundingBox())!
    expect(drawn.y).toBeGreaterThan(list.y + list.height - 1)
    expect(Math.round(list.width)).toBeGreaterThan(400)
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
