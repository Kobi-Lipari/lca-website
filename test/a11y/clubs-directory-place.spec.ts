// test/a11y/clubs-directory-place.spec.ts
//
// The Clubs directory's field, Near me, the two orders and the filters (WS09
// step 34), on the clubs build alone (the a11y-clubs project; see
// test/a11y/global-setup.ts), beside test/a11y/clubs-directory.spec.ts. The
// list is answered with made-up clubs in real towns; the map is the stand-in
// the build draws when a page asks, which asks nothing of the map's
// provider. The device's location is the browser's own: refused by its own
// permission, or granted and given a made-up point by the browser's own
// setting, never a real one. Checked here:
// - a refused location says so in words, the focus moves to the field and
//   the list stays A to Z;
// - a granted location orders the list nearest first, with "about N mi" and
//   both dividers, puts only a ZIP code in the address, moves the map, and
//   no request, storage or console line carries the point;
// - the keyboard alone through the field, the orders and the filters, with
//   each change said once by the one live region;
// - a typed name, a place outside Louisiana and a town with no club, each in
//   words, and the filters narrowing the list and the pins together, kept in
//   the address across a reload;
// - nothing scrolls sideways at 320 with the panel open, and axe finds
//   nothing in any of these states.
import AxeBuilder from '@axe-core/playwright'
import type { BrowserContext, Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'

/** The page's words, as src/areas/clubs/directoryWords.ts writes them (test/unit/place-field.test.tsx reads them from there). */
const FIELD_LABEL = 'City, ZIP or club name'
const NOT_FOUND = 'We couldn\'t get your location. Type a city or ZIP.'
const OUTSIDE = 'That\'s outside Louisiana. Type a Louisiana city or ZIP.'
const NEAREST_WHY = 'Press Near me, or type a place'
const NO_DISTANCE = 'Distance not known'
/** The flag that asks the build for the stand-in map, as src/areas/clubs/directoryPins.ts names it. */
const STAND_IN_FLAG = 'lcaMapStandIn'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.use({ reducedMotion: 'reduce' })

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the directory is drawn on the clubs build alone')
}

function row(id: string, name: string, city: string, region: string, point: [number, number] | null, weekends = false, scholastic = false) {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: '#1f4e79', image_url: null, region, latitude: null, longitude: null,
    slug: id, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: weekends, scholastic_friendly: scholastic,
  }
}

/** Six made-up clubs in real towns: three within 75 miles of Baton Rouge, two past it, one with no point; no two so near that their pins touch at the state's view. */
const CLUBS = [
  row('example-pine-club', 'Example Pine Club', 'Shreveport', 'North Louisiana', [32.5, -93.75], true),
  row('example-river-club', 'Example River Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15], true, true),
  row('example-harbor-club', 'Example Harbor Club', 'Kenner', 'New Orleans Metro', null, false, true),
  row('example-knights-club', 'Example Knights Club', 'Hammond', 'Baton Rouge / East Central', [30.5, -90.46]),
  row('example-delta-club', 'Example Delta Club', 'Monroe', 'North Louisiana', [32.5, -92.1], true),
  row('example-bayou-club', 'Example Bayou Club', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
]
const A_TO_Z = ['Example Bayou Club', 'Example Delta Club', 'Example Harbor Club', 'Example Knights Club', 'Example Pine Club', 'Example River Club']
const NEAREST = ['Example River Club', 'Example Knights Club', 'Example Bayou Club', 'Example Delta Club', 'Example Pine Club', 'Example Harbor Club']

/** A made-up point a few streets from a ZIP code area's own point in Baton Rouge, whose ZIP code is 70806. */
const DEVICE = { latitude: 30.4517, longitude: -91.1288 }

async function answerList(page: Page) {
  await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs: CLUBS }) }))
}

async function askStandIn(page: Page) {
  await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
}

async function openDirectory(page: Page, route = '/clubs') {
  await answerList(page)
  await askStandIn(page)
  await openDrawn(page, route, [
    page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true }),
    page.getByRole('link', { name: /^Example River Club/ }),
  ])
  await page.evaluate(() => document.fonts.ready)
}

const list = (page: Page) => page.getByRole('list', { name: /^Clubs, / })
const names = (page: Page) => list(page).getByRole('listitem').locator('a > span > span').allTextContents()
const field = (page: Page) => page.getByRole('textbox', { name: FIELD_LABEL })
const status = (page: Page) => page.getByRole('status').filter({ has: page.locator('p') })
const map = (page: Page) => page.getByRole('group', { name: 'Map of the clubs' })
const search = (page: Page) => new URL(page.url()).search

async function noAxe(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}) at ${n.target.join(' ')}`))).toEqual([])
}

/** Records each text the live region takes, as a screen reader would say it. */
async function listen(page: Page) {
  await page.evaluate(() => {
    const region = [...document.querySelectorAll('[role="status"]')].find((el) => el.querySelector('p'))!
    const heard: string[] = []
    ;(window as unknown as Record<string, unknown>).__heard = heard
    new MutationObserver(() => { if (heard.at(-1) !== region.textContent) heard.push(region.textContent ?? '') }).observe(region, { subtree: true, childList: true, characterData: true })
  })
}
const heard = (page: Page) => page.evaluate(() => (window as unknown as { __heard: string[] }).__heard)

/** The page's scroll width against the window's, and every box past the window's right edge that no part holds. */
function sideways(page: Page) {
  return page.evaluate(() => {
    const room = document.documentElement.clientWidth
    const holds = (el: Element) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX)
    const wide: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      let held = false
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) if (holds(up)) { held = true; break }
      if (!held && box.right > room + 0.5) wide.push(`${el.tagName.toLowerCase()} to ${Math.round(box.right)}`)
    }
    return { scroll: document.documentElement.scrollWidth, room, wide }
  })
}

async function granted(context: BrowserContext, page: Page) {
  await context.grantPermissions(['geolocation'], { origin: new URL(page.url()).origin })
  await context.setGeolocation(DEVICE)
}

test('a location the browser refuses says so in words, moves the focus to the field, keeps the list A to Z, with nothing for axe', async ({ page, context, external }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await context.clearPermissions()
  await openDirectory(page)
  await page.getByRole('button', { name: 'Near me' }).click()
  await expect(status(page)).toContainText(NOT_FOUND)
  await expect(field(page)).toBeFocused()
  expect(await names(page)).toEqual(A_TO_Z)
  expect(search(page)).toBe('')
  await noAxe(page)
  expect(external).toEqual([])
})

test('a granted location, a made-up point, orders the list nearest first with both dividers and keeps only a ZIP code, and nothing carries the point', async ({ page, context, external }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  const asked: string[] = []
  const said: string[] = []
  page.on('request', (request) => asked.push(`${request.url()} ${request.postData() ?? ''}`))
  page.on('console', (message) => said.push(message.text()))
  await openDirectory(page)
  await granted(context, page)
  asked.length = 0
  await page.getByRole('button', { name: 'Near me' }).click()
  await expect(page.getByText('Near you: Baton Rouge 70806', { exact: true })).toBeVisible()
  expect(search(page)).toBe('?near=70806')
  expect(await names(page)).toEqual(NEAREST)
  await expect(list(page)).toHaveAttribute('aria-label', 'Clubs, nearest first')
  await expect(list(page).getByRole('listitem').first()).toContainText('Example River Club · Baton Rouge · about 1 mi')
  expect(await list(page).locator('[data-divider]').allTextContents()).toEqual(['Farther than 75 miles', NO_DISTANCE])
  await expect(map(page)).toHaveAttribute('data-view', 'place')
  await expect(page.getByRole('button', { name: 'Nearest' })).toHaveAttribute('aria-pressed', 'true')
  const digits = ['30.4517', '91.1288']
  const kept = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie, html: document.documentElement.outerHTML }))
  for (const d of digits) {
    expect(asked.filter((a) => a.includes(d)), d).toEqual([])
    expect(said.filter((s) => s.includes(d)), d).toEqual([])
    expect(kept.includes(d), d).toBe(false)
  }
  // The page asked the server for nothing when the place came.
  expect(asked.filter((a) => new URL(a.split(' ')[0]).pathname.startsWith('/api/'))).toEqual([])
  await noAxe(page)
  // Clear location goes back to A to Z and the whole state, and the focus to the field.
  await page.getByRole('button', { name: 'Clear location' }).click()
  await expect.poll(() => names(page)).toEqual(A_TO_Z)
  await expect(map(page)).toHaveAttribute('data-view', 'state')
  await expect(field(page)).toBeFocused()
  expect(search(page)).toBe('')
  expect(external).toEqual([])
})

test('the keyboard alone through the field, the orders and the filters, each change said once by the one live region', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openDirectory(page)
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  const met: string[] = []
  for (let i = 0; i < 30 && !met.includes('Skip to the map'); i++) {
    await page.keyboard.press('Tab')
    met.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement
      return el.getAttribute('aria-label') ?? (el.tagName === 'INPUT' ? 'field' : el.textContent?.trim() ?? '')
    }))
  }
  const from = met.indexOf(`Help: ${FIELD_LABEL}`)
  expect(met.slice(from)).toEqual([`Help: ${FIELD_LABEL}`, 'field', 'Near me', 'A to Z', 'Nearest', 'Filters', 'Skip to the map'])
  // Nearest says why it cannot be chosen yet, beside it and as its description.
  await expect(page.getByText(NEAREST_WHY, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Nearest' })).toHaveAccessibleDescription(NEAREST_WHY)

  await listen(page)
  await field(page).focus()
  await page.keyboard.type('kni', { delay: 80 })
  await expect(status(page)).toHaveText('1 club matches kni · Show all 6')
  await page.waitForTimeout(800)
  expect(await heard(page)).toEqual(['1 club matches kni · Show all 6'])
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Lafayette')
  await page.keyboard.press('Enter')
  await expect(page.getByText(/^Near you: Lafayette \d{5}$/)).toBeVisible()
  await expect(field(page)).toBeFocused()
  expect(await names(page)).toHaveLength(6)
  expect((await names(page))[0]).toBe('Example Bayou Club')

  // The order, by the keyboard: A to Z, then Nearest again.
  await page.getByRole('button', { name: 'A to Z' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'A to Z' })).toHaveAttribute('aria-pressed', 'true')
  expect(await names(page)).toEqual(A_TO_Z)
  await page.keyboard.press('Tab')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Nearest' })).toHaveAttribute('aria-pressed', 'true')

  // The filters, by the keyboard: open, a region, Done, and the focus back on the button.
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: /^Filters/ })).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'New Orleans Metro 1' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Baton Rouge / East Central 2' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Baton Rouge / East Central 2' })).toHaveAttribute('aria-pressed', 'true')
  expect(await names(page)).toEqual(['Example River Club', 'Example Knights Club'])
  await page.getByRole('button', { name: 'Done' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Filters · 1 on' })).toBeFocused()
  await expect(page.getByRole('button', { name: 'Filters · 1 on' })).toHaveAttribute('aria-expanded', 'false')
  // Each change was said once, and nothing between: the name, the place, each order and the filter.
  const nearestFirst = 'All 6 clubs, nearest first. Meeting times are as each club states them; confirm before a first visit.'
  expect(await heard(page)).toEqual([
    '1 club matches kni · Show all 6', nearestFirst, 'All 6 clubs, A to Z. Meeting times are as each club states them; confirm before a first visit.', nearestFirst, '2 clubs match · Clear filters',
  ])
})

test('a typed name, a place outside Louisiana and a town with no club each say so in words, with nothing for axe in any of them', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 390, height: 844 })
  await openDirectory(page)
  await field(page).fill('kni')
  await expect(status(page)).toHaveText('1 club matches kni · Show all 6')
  expect(await names(page)).toEqual(['Example Knights Club'])
  await noAxe(page)
  await field(page).fill('Houston, TX')
  await expect(status(page)).toContainText(OUTSIDE)
  expect(await names(page)).toEqual(A_TO_Z)
  expect(search(page)).toBe('')
  await noAxe(page)
  await field(page).fill('Natchitoches')
  await field(page).press('Enter')
  await expect(status(page)).toContainText('No club in Natchitoches yet. The nearest are listed first.')
  await expect(status(page).getByRole('link', { name: 'Start a club?' })).toHaveAttribute('href', '/clubs/suggest?kind=start')
  // Since checkpoint Y's review a typed town stands for its own densest ZIP code area, by the Census Bureau's relationship file.
  expect(search(page)).toBe('?near=71497')
  expect(await names(page)).toHaveLength(6)
  await noAxe(page)
})

test('the filters narrow the list and the pins together, live in the address and survive a reload, with nothing for axe while the panel is open', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await openDirectory(page)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByText('Only clubs that say so themselves', { exact: true })).toBeVisible()
  expect(await page.locator('[data-slot="club-filters"] fieldset').first().getByRole('button').allTextContents()).toEqual([
    'New Orleans Metro 1', 'Baton Rouge / East Central 2', 'Lafayette / South Central 1', 'North Louisiana 2',
  ])
  await noAxe(page)
  await page.getByRole('button', { name: 'North Louisiana 2' }).click()
  await page.getByRole('button', { name: 'Plays on weekends 3' }).click()
  await expect(status(page)).toHaveText('2 clubs match · Clear filters')
  expect(await names(page)).toEqual(['Example Delta Club', 'Example Pine Club'])
  expect(await map(page).locator('[data-pin]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pin')))).toEqual(['example-delta-club', 'example-pine-club'])
  expect(search(page)).toBe('?region=north-louisiana&weekends=1')
  await page.reload()
  await expect(list(page)).toBeVisible()
  expect(await names(page)).toEqual(['Example Delta Club', 'Example Pine Club'])
  await expect(page.getByRole('button', { name: 'Filters · 2 on' })).toBeVisible()
  await status(page).getByRole('button', { name: 'Clear filters' }).click()
  // The list is drawn again after the click, so its names are read once it has been.
  await expect.poll(() => names(page)).toEqual(A_TO_Z)
  expect(search(page)).toBe('')
})

test('/clubs at 320 by 568 with the filters open and a place known does not scroll sideways, with nothing for axe', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 320, height: 568 })
  await openDirectory(page, '/clubs?near=70808')
  await expect(page.getByText('Near you: Baton Rouge 70808', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByRole('button', { name: 'Lafayette / South Central 1' })).toBeVisible()
  const m = await sideways(page)
  expect(m.scroll, `scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
  expect(m.wide).toEqual([])
  await noAxe(page)
})
