// test/a11y/clubs-reflow.spec.ts
//
// The new club page on a narrow phone, on the clubs build alone (the
// a11y-clubs project; see test/a11y/global-setup.ts), for a visitor who is
// signed out: at 320 by 568 and at 390 by 844, each fixture club's page at
// its short address does not scroll sideways, and nothing on it is wider
// than the window, measured as the suite's other reflow checks measure (the
// page's scroll width against its client width, and each box's right edge
// against the client width; a box set off the left edge on purpose, as the
// skip link is until it has the focus, scrolls nothing). A box inside a
// part that scrolls on its own (the section nav's row) or clips what
// overflows it (the cover, the map) is measured by that part instead. The
// cover's line names the club's region, the longest words on the page's
// first screen, and must wrap. The second fixture club's meeting words end
// with a made-up web address longer than the column at 320 pixels, with no
// place to break, so the measure meets a long unbroken run in the club's own
// words under its name and in When and where; it must break inside the
// column. With scripts off, the page the server wrote is measured the same
// way at both sizes.
//
// The Clubs directory at /clubs (WS09 step 35) is measured the same way at
// both sizes, with its list answered by made-up clubs in real towns and the
// stand-in map the build draws when a page asks: with the list's sheet at its
// low rest and at its full rest, with the Filters sheet open, and with a
// place known.
//
// Reads only.
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { cityLine } from '../../domain/clubs/pageWords'

const SIZES = [{ width: 320, height: 568 }, { width: 390, height: 844 }] as const

const FIXTURE_CLUBS = [
  { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', region: 'Baton Rouge / East Central' },
  { slug: 'fixture-north-chess-club', name: 'Fixture North Chess Club', city: 'Monroe', region: 'North Louisiana' },
] as const

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the new club pages are drawn on the clubs build alone')
}

/** The page's scroll width, the window's width, and every box past the window's right edge that no part holds. */
function measure(page: Page) {
  return page.evaluate(() => {
    const room = document.documentElement.clientWidth
    /** A part that scrolls on its own or clips what overflows it. */
    const holds = (el: Element) => ['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(el).overflowX)
    const wide: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const box = el.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) continue
      let holder: Element | null = null
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        if (holds(up)) {
          holder = up
          break
        }
      }
      if (holder) continue
      if (box.right > room + 0.5) {
        const name = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.getAttribute('data-slot') ? `[data-slot=${el.getAttribute('data-slot')}]` : ''}`
        wide.push(`${name} from ${Math.round(box.left)} to ${Math.round(box.right)}`)
      }
    }
    return { scroll: document.documentElement.scrollWidth, room, wide }
  })
}

for (const club of FIXTURE_CLUBS) {
  for (const size of SIZES) {
    test(`${club.slug} at ${size.width} by ${size.height} does not scroll sideways, and nothing on it is wider than the window`, async ({ page, external }, testInfo) => {
      onlyClubs(testInfo)
      await page.setViewportSize(size)
      const line = page.locator('main').getByText(cityLine(club.city, club.region), { exact: true })
      await openDrawn(page, `/clubs/${club.slug}`, [page.getByRole('heading', { level: 1, name: club.name, exact: true }), line])
      await page.evaluate(() => document.fonts.ready)

      const m = await measure(page)
      expect(m.scroll, `scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
      expect(m.wide).toEqual([])

      // The cover's line, region and all, sits inside the window: it wraps rather than run off.
      const box = await line.boundingBox()
      expect(box, 'the cover\'s line').not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(m.room + 0.5)
      expect(external).toEqual([])
    })
  }
}

test.describe('with scripts off', () => {
  test.use({ javaScriptEnabled: false })

  for (const club of FIXTURE_CLUBS) {
    for (const size of SIZES) {
      test(`${club.slug}: the page the server wrote, at ${size.width} by ${size.height}, does not scroll sideways, and nothing on it is wider than the window`, async ({ page, external }, testInfo) => {
        onlyClubs(testInfo)
        await page.setViewportSize(size)
        const answer = await page.goto(`/clubs/${club.slug}`)
        expect(answer?.status()).toBe(200)
        await expect(page.getByRole('heading', { level: 1, name: club.name, exact: true })).toBeVisible()
        await page.evaluate(() => document.fonts.ready)

        const m = await measure(page)
        expect(m.scroll, `scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
        expect(m.wide).toEqual([])
        expect(external).toEqual([])
      })
    }
  }
})

/** The flag that asks the build for the stand-in map, as src/areas/clubs/directoryPins.ts names it. */
const STAND_IN_FLAG = 'lcaMapStandIn'

/** Six made-up clubs in real towns, one with a long name and one with no point. */
const DIRECTORY_CLUBS = [
  ['example-river-club', 'Example River Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15]],
  ['example-long-name-club', 'Example Club With A Rather Long Made-Up Name For Narrow Windows', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]],
  ['example-pine-club', 'Example Pine Club', 'Shreveport', 'North Louisiana', [32.5, -93.75]],
  ['example-delta-club', 'Example Delta Club', 'Monroe', 'North Louisiana', [32.5, -92.1]],
  ['example-port-club', 'Example Port Club', 'Lake Charles', 'Lake Charles / Southwestern', [30.23, -93.22]],
  ['example-harbor-club', 'Example Harbor Club', 'Kenner', 'New Orleans Metro', null],
].map(([id, name, city, region, point]) => ({
  id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null, slug: id,
  statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: (point as number[])[0], longitude: (point as number[])[1] } : null,
  weekend_play: true, scholastic_friendly: false,
}))

for (const size of SIZES) {
  test(`/clubs at ${size.width} by ${size.height} does not scroll sideways with the sheet low or full, the Filters sheet open, or a place known`, async ({ page, external }, testInfo) => {
    onlyClubs(testInfo)
    await page.setViewportSize(size)
    await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs: DIRECTORY_CLUBS }) }))
    await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
    const sheet = page.getByRole('region', { name: 'List of clubs' })
    const wholly = async (state: string) => {
      const m = await measure(page)
      expect(m.scroll, `${state}: scroll width ${m.scroll} in a window ${m.room} wide`).toBeLessThanOrEqual(m.room)
      expect(m.wide, state).toEqual([])
    }
    for (const route of ['/clubs', '/clubs?near=70808']) {
      await openDrawn(page, route, [page.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana', exact: true }), page.getByRole('link', { name: /^Example River Club/ })])
      await page.evaluate(() => document.fonts.ready)
      if (route.includes('near')) await expect(page.getByText('Near you: Baton Rouge 70808', { exact: true })).toBeVisible()
      await expect(sheet).toHaveAttribute('data-sheet', 'low')
      await wholly(`${route}, the sheet low`)
      await sheet.getByRole('button', { name: 'Show the list' }).click()
      await expect(sheet).toHaveAttribute('data-sheet', 'full')
      await wholly(`${route}, the sheet full`)
      await sheet.getByRole('button', { name: 'Map', exact: true }).click()
      await page.getByRole('button', { name: /^Filters/ }).click()
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible()
      // Measured once the sheet has finished rising.
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
      await wholly(`${route}, the Filters sheet open`)
      const dialog = (await page.getByRole('dialog', { name: 'Filters' }).boundingBox())!
      expect(dialog.x).toBeGreaterThanOrEqual(0)
      expect(dialog.x + dialog.width).toBeLessThanOrEqual(size.width + 0.5)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'Filters' })).toHaveCount(0)
    }
    expect(external).toEqual([])
  })
}
