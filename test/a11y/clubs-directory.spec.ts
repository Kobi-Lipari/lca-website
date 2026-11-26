// test/a11y/clubs-directory.spec.ts
//
// The Clubs directory (WS09 step 33) on the clubs build alone (the
// a11y-clubs project; see test/a11y/global-setup.ts), whose server answers
// GET /api/clubs in the directory's shape, as with CLUB_PAGES_ON set. Most
// cases answer the list with made-up clubs instead (some with a meeting
// statement, one with none, two in one town, one with no point), so no case
// reads the association's own clubs by name. The build has no maps key, so
// the map is never Google's: a case that presses the pins asks for the
// stand-in map (src/areas/clubs/directoryPins.ts, mapSource) before the page
// loads, which lays the same pin buttons over a sheet of the map's paper and
// asks nothing of the map's provider. Checked here:
// - the directory draws every club A to Z beside the map at 1440 and, at
//   390, with the map over the list's sheet (WS09 step 35), one h1, in the
//   light and dark looks, with nothing for axe at either rest of the sheet;
//   and nothing scrolls sideways at 320 and 390;
// - each card is one link; a card's pointer or focus lifts its pin; a pin's
//   press selects it and brings its card into view; no pin carries a number;
//   the pins come in the list's order; an opened circle's pins sit apart,
//   each taking its own press, with nothing for axe;
// - the selected ring against the map's paper, and the card's grey words
//   against the card, in both looks, measured in the page;
// - with no map asked for, the list stands alone with one line;
// - today's answer draws today's Clubs page whole, and the server's own
//   answer draws the directory with its count.
// The phone layout's own cases are in test/a11y/clubs-directory-keys.spec.ts.
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'

/** The page's words, as src/areas/clubs/directoryWords.ts writes them (test/unit/club-directory.test.tsx reads them from there). */
const MAP_KEY = 'Solid pin: meeting times listed · Hollow pin: not listed yet · Circle: clubs in one town'
const NO_MAP = 'The map is not shown here. Every club is in the list.'
const THIN_CARD = 'Schedule not listed · Know when they meet? Suggest an update'
const WHOLE_STATE = 'All of Louisiana'
/** The flag that asks the build for the stand-in map, as src/areas/clubs/directoryPins.ts names it. */
const STAND_IN_FLAG = 'lcaMapStandIn'
/** The phone layout's words (WS09 step 35). */
const LIST_SHEET = 'List of clubs'
const SHOW_LIST = 'Show the list'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.use({ reducedMotion: 'reduce' })

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the directory is drawn on the clubs build alone')
}

function row(id: string, name: string, city: string, region: string, point: [number, number] | null, statement: string | null, description: string | null = null) {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: '#1f4e79', image_url: null, region, latitude: null, longitude: null,
    slug: id, statement, description: statement ? null : description, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Six made-up clubs, out of order: two in one town, one with no statement, one with no point. */
const CLUBS = [
  row('example-rooks-club', 'Example Rooks Club', 'Example Village', 'North Louisiana', [32.5, -92.1], 'Saturdays at 10:00 AM at the Example Library.'),
  row('example-bishops-club', 'Example Bishops Club', 'Example City', 'Baton Rouge / East Central', [30.45, -91.18], 'Tuesdays at 7:00 PM in the Example Community Center, upstairs room.'),
  row('example-knights-club', 'Example Knights Club', 'Example City', 'Baton Rouge / East Central', [30.41, -91.1], null, 'A made-up club for players of every strength, from a first game to a rated player.'),
  row('example-pawns-club', 'Example Pawns Club', 'Example Town', 'New Orleans Metro', null, 'Thursdays at 6:30 PM.'),
  row('example-queens-club', 'Example Queens Club', 'Example Hamlet', 'Lafayette / South Central', [30.22, -92.02], 'Every other Sunday at 2:00 PM.'),
  row('example-kings-club', 'Example Kings Club', 'Example Port', 'Lake Charles / Southwestern', [30.23, -93.22], 'Mondays at 6:00 PM.'),
]
const A_TO_Z = ['Example Bishops Club', 'Example Kings Club', 'Example Knights Club', 'Example Pawns Club', 'Example Queens Club', 'Example Rooks Club']

/** Answers the list with the made-up clubs, or with the rows given. */
async function answerList(page: Page, rows: unknown[] = CLUBS) {
  await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs: rows }) }))
}

/** Asks the build for the stand-in map before the page loads. */
async function askStandIn(page: Page) {
  await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
}

async function openDirectory(page: Page) {
  await openDrawn(page, '/clubs', [
    page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true }),
    page.getByRole('link', { name: /^Example Bishops Club/ }),
  ])
  await page.evaluate(() => document.fonts.ready)
}

const cards = (page: Page) => page.getByRole('list', { name: 'Clubs, A to Z' }).getByRole('listitem')
const map = (page: Page) => page.getByRole('group', { name: 'Map of the clubs' })
/** The list's sheet on a phone (WS09 step 35). */
const sheet = (page: Page) => page.getByRole('region', { name: LIST_SHEET })

/** The contrast of an element's colour (or an SVG part's stroke) against a ground, both as the page draws them. */
function contrastIn(page: Page, what: { selector: string; prop: 'color' | 'stroke'; ground: string | null }) {
  return page.evaluate(({ selector, prop, ground }) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    const rgb = (colour: string) => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = colour
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
      return { r, g, b, a }
    }
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const c = [r, g, b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const el = document.querySelector(selector)!
    const fore = rgb(getComputedStyle(el)[prop] as string)
    let back = { r: 255, g: 255, b: 255, a: 255 }
    if (ground) back = rgb(getComputedStyle(document.querySelector(ground)!).fill)
    else {
      for (let up: Element | null = el; up; up = up.parentElement) {
        const c = rgb(getComputedStyle(up).backgroundColor)
        if (c.a > 0) { back = c; break }
      }
    }
    const [x, y] = [lum(fore), lum(back)].sort((m, n) => n - m)
    return { ratio: Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100, fore: getComputedStyle(el)[prop] as string }
  }, what)
}

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

for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`/clubs at ${size.width} by ${size.height} in the ${scheme} look: every club A to Z, the map beside or under the list, one h1, and nothing for axe`, async ({ page, external }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize(size)
      await page.emulateMedia({ colorScheme: scheme })
      await answerList(page)
      await askStandIn(page)
      await openDirectory(page)
      expect(await page.locator('h1').allTextContents()).toEqual(['Chess clubs in Louisiana'])
      await expect(page.getByText('6 clubs · 5 regions · Find the nearest, or look around the whole state.', { exact: true })).toBeVisible()
      await expect(page.getByText('All 6 clubs, A to Z. Meeting times are as each club states them; confirm before a first visit.', { exact: true })).toBeVisible()
      expect(await cards(page).locator('a > span > span').allTextContents()).toEqual(A_TO_Z)
      await expect(map(page)).toBeVisible()
      await expect(page.getByText(MAP_KEY, { exact: true })).toBeVisible()
      const list = await page.getByRole('list', { name: 'Clubs, A to Z' }).boundingBox()
      const drawn = await map(page).boundingBox()
      if (size.width >= 1024) {
        expect(Math.round(list!.width)).toBe(460)
        expect(drawn!.x).toBeGreaterThan(list!.x + list!.width)
      } else {
        // On a phone the list is in the sheet, which rises from the window's foot over the map (WS09 step 35).
        expect((await sheet(page).boundingBox())!.y).toBeGreaterThan(drawn!.y)
      }
      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(scheme === 'dark')
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
      expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}) at ${n.target.join(' ')}`))).toEqual([])
      if (size.width < 1024) {
        // And with the sheet at its full rest.
        await sheet(page).getByRole('button', { name: SHOW_LIST }).click()
        await expect(sheet(page)).toHaveAttribute('data-sheet', 'full')
        const full = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
        expect(full.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}) at ${n.target.join(' ')}`))).toEqual([])
      }
      expect(external).toEqual([])
    })
  }
}

for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }] as const) {
  test(`/clubs at ${size.width} by ${size.height} does not scroll sideways`, async ({ page }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize(size)
    await answerList(page)
    await askStandIn(page)
    await openDirectory(page)
    const m = await sideways(page)
    expect(m.scroll, `scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
    expect(m.wide).toEqual([])
  })
}

test('each card is one link; a card\'s pointer and focus lift its pin; no pin carries a number; the pins come in the list\'s order', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await answerList(page)
  await askStandIn(page)
  await openDirectory(page)
  for (const card of await cards(page).all()) {
    expect(await card.locator('a').count()).toBe(1)
    expect(await card.locator('button, input, select, textarea, [role="button"]').count()).toBe(0)
  }
  const thin = cards(page).nth(2)
  await expect(thin).toContainText(THIN_CARD)
  expect(await thin.getByRole('link').getAttribute('href')).toBe('/clubs/example-knights-club')

  const marks = map(page).locator('[data-pin], [data-circle]')
  expect(await marks.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual([
    '2 clubs in Example City, show each', 'Example Kings Club, Example Port', 'Example Queens Club, Example Hamlet', 'Example Rooks Club, Example Village',
  ])
  for (const text of await map(page).locator('[data-pin]').allTextContents()) expect(text).toBe('')
  await map(page).getByRole('button', { name: '2 clubs in Example City, show each' }).click()
  expect(await map(page).locator('[data-pin]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual([
    'Example Bishops Club, Example City', 'Example Kings Club, Example Port', 'Example Knights Club, Example City', 'Example Queens Club, Example Hamlet', 'Example Rooks Club, Example Village',
  ])
  // Solid and hollow differ in their shape's fill, not only in colour beside the others.
  expect(await map(page).locator('[data-pin="example-knights-club"]').getAttribute('data-listed')).toBe('false')

  const pin = map(page).locator('[data-pin="example-rooks-club"] svg')
  const before = (await pin.boundingBox())!.height
  await cards(page).nth(5).getByRole('link').hover()
  await expect(map(page).locator('[data-pin="example-rooks-club"]')).toHaveAttribute('data-lifted', 'true')
  expect((await pin.boundingBox())!.height).toBeGreaterThan(before)
  await page.mouse.move(1270, 790)
  await expect(map(page).locator('[data-lifted]')).toHaveCount(0)
  await cards(page).nth(4).getByRole('link').focus()
  await expect(map(page).locator('[data-pin="example-queens-club"]')).toHaveAttribute('data-lifted', 'true')
})

test('an opened circle\'s pins sit apart, one never over another, and nothing for axe with the circle open', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await answerList(page)
  await askStandIn(page)
  await openDirectory(page)
  // Example City's two clubs are a few pixels apart on the stand-in, as a city's clubs are on Google's map after one zoom step.
  await map(page).getByRole('button', { name: '2 clubs in Example City, show each' }).click()
  const boxes = await map(page).locator('[data-pin]').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect()
    return { id: e.getAttribute('data-pin')!, left: r.left, top: r.top, right: r.right, bottom: r.bottom }
  }))
  expect(boxes.map((b) => b.id)).toContain('example-knights-club')
  const over: string[] = []
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) over.push(`${a.id} over ${b.id}`)
  }
  expect(over).toEqual([])
  // Each opened pin takes its own press.
  await map(page).getByRole('button', { name: 'Example Knights Club, Example City' }).click()
  await expect(cards(page).nth(2).getByRole('link')).toHaveAttribute('data-selected', 'true')
  await map(page).getByRole('button', { name: 'Example Bishops Club, Example City' }).click()
  await expect(cards(page).nth(0).getByRole('link')).toHaveAttribute('data-selected', 'true')
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  expect(results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact}) at ${n.target.join(' ')}`))).toEqual([])
})

test('a pin\'s press selects it and brings its card into view; the selected ring reaches 3 to 1 against the map in both looks', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 500 })
  await answerList(page)
  await askStandIn(page)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await openDirectory(page)
    const rooks = map(page).getByRole('button', { name: 'Example Rooks Club, Example Village' })
    await expect(rooks).toHaveAttribute('aria-pressed', 'false')
    await rooks.click()
    await expect(rooks).toHaveAttribute('aria-pressed', 'true')
    const card = cards(page).nth(5).getByRole('link')
    await expect(card).toHaveAttribute('data-selected', 'true')
    await expect(card).toBeInViewport()
    const ring = await contrastIn(page, { selector: '[data-pin="example-rooks-club"] [data-ring]', prop: 'stroke', ground: '[data-map-paper]' })
    testInfo.annotations.push({ type: 'ring', description: `${scheme}: ${ring.fore} on the map's paper, ${ring.ratio} to 1` })
    expect(ring.ratio, scheme).toBeGreaterThanOrEqual(3)
    await map(page).getByRole('button', { name: WHOLE_STATE }).click()
    await expect(rooks).toHaveAttribute('aria-pressed', 'false')
  }
})

test('the card\'s grey words reach 4.5 to 1 on the card in both looks', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await answerList(page)
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    await openDirectory(page)
    const grey = await contrastIn(page, { selector: '[data-card="example-knights-club"] .text-muted-foreground', prop: 'color', ground: null })
    testInfo.annotations.push({ type: 'grey', description: `${scheme}: ${grey.fore} on the card, ${grey.ratio} to 1` })
    expect(grey.ratio, scheme).toBeGreaterThanOrEqual(4.5)
  }
})

test('with no map, the list stands alone with one line, and nothing is asked of the map\'s provider', async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  await page.setViewportSize({ width: 1280, height: 800 })
  await answerList(page)
  await openDirectory(page)
  await expect(page.getByText(NO_MAP, { exact: true })).toBeVisible()
  await expect(map(page)).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Skip to the map' })).toHaveCount(0)
  expect(await cards(page).count()).toBe(6)
  expect(await page.locator('script[src*="maps.googleapis"]').count()).toBe(0)
  expect(external).toEqual([])
})

test('today\'s answer draws today\'s Clubs page whole, never half a directory', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  await answerList(page, CLUBS.map((c) => ({ id: c.id, name: c.name, city: c.city, meeting_schedule: c.meeting_schedule, color: c.color, image_url: null, region: c.region, latitude: null, longitude: null })))
  await openDrawn(page, '/clubs', [page.getByRole('heading', { level: 1, name: 'Find your chess community', exact: true }), page.getByText('Example Rooks Club').first()])
  await expect(page.getByText('Chess clubs in Louisiana')).toHaveCount(0)
  await expect(page.locator('[data-slot="club-directory"]')).toHaveCount(0)
})

test('the server\'s own answer, in the directory\'s shape, draws the directory with its clubs counted', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  const answered = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/clubs')
  await page.goto('/clubs')
  const body = (await (await answered).json()) as { clubs: Array<{ slug?: string }> }
  expect(body.clubs.length).toBeGreaterThan(0)
  expect(body.clubs.every((c) => typeof c.slug === 'string')).toBe(true)
  await expect(page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true })).toBeVisible()
  await expect(page.getByText(`All ${body.clubs.length} clubs, A to Z.`, { exact: false })).toBeVisible()
  expect(await cards(page).count()).toBe(body.clubs.length)
})
