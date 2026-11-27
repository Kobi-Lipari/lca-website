// test/a11y/clubs-suggest.spec.ts
//
// Suggest an update (WS09's twenty-eighth step) in a real browser, for a visitor who is
// signed out, on the clubs build alone (the a11y-clubs project; see
// test/a11y/global-setup.ts), on a fixture club of scripts/seed/fixtures.sql:
//
// - the sheet opens from its two places, the "Last checked" line and beside
//   Contact's heading, and from nowhere else on the page;
// - with it open, axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds
//   nothing at 1,280 by 800 and at 390 by 844, run as the suite's other
//   specs run it;
// - the focus is inside it, Tab does not leave it, Escape and Close shut it,
//   and the focus is back on the link that opened it;
// - the six choices are told by aria-pressed, and exactly one is pressed
//   after a press;
// - at 320 by 568 the open sheet does not scroll sideways, and its send
//   button, worded with the longest region's name, is whole;
// - no script error and no request to another host.
//
// Nothing is sent: no case presses the send button, and any request to the
// suggestion's endpoint fails the case. For the 320 case the page's own
// answer is read from the local server and given back with the club's
// region set to the longest of the five and the suggestion's place set to
// the region's representative, so the button carries the longest words it
// can. Reads only: nothing here writes to the project's local database.
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { REGIONS } from '../../domain/clubs/regions'

const CLUBS = A11Y_CLUBS_VARIANT.name
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [{ width: 1280, height: 800 }, { width: 390, height: 844 }] as const
const CLUB = { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club' }
const TITLE = `Suggest an update to ${CLUB.name}`
const CHOICES = ['Meeting day or time', 'Venue or address', 'Cost or who it\'s for', 'Contact', 'The club has closed or moved', 'Something else']
const LONGEST = [...REGIONS].sort((a, b) => b.length - a.length)[0]

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== CLUBS, 'the new club pages are drawn on the clubs build alone')
}

async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** Refuses any request to the suggestion's endpoint, and counts them: nothing is ever sent from here. */
async function sendNothing(page: Page): Promise<string[]> {
  const sent: string[] = []
  await page.route('**/api/clubs/*/reports', (route) => {
    sent.push(route.request().method())
    return route.abort('blockedbyclient')
  })
  return sent
}

async function openPage(page: Page) {
  const h1 = page.getByRole('heading', { level: 1, name: CLUB.name, exact: true })
  await openDrawn(page, `/clubs/${CLUB.slug}`, [h1, page.getByRole('heading', { level: 2, name: 'Contact', exact: true })])
}

const openers = (page: Page) => page.locator('main').getByRole('button', { name: 'Suggest an update', exact: true })
const sheet = (page: Page) => page.getByRole('dialog', { name: TITLE })
const focusedInside = (page: Page) => sheet(page).evaluate((el) => el.contains(document.activeElement))

for (const size of SIZES) {
  test(`${CLUB.slug} at ${size.width} by ${size.height}: Suggest an update opens from its two places only, with nothing for axe, and keeps and gives back the focus`, async ({ page, external }, testInfo) => {
    onlyClubs(testInfo)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const sent = await sendNothing(page)
    await page.setViewportSize(size)
    await openPage(page)

    // Two ways in, one under the told line in When and where and one beside Contact's heading, and no other.
    await expect(openers(page)).toHaveCount(2)
    await expect(page.getByRole('button', { name: /Suggest an update/ })).toHaveCount(2)
    const told = openers(page).nth(0)
    const contact = openers(page).nth(1)
    expect(await told.evaluate((el) => el.closest('section')?.id)).toBe('when-and-where')
    expect(await contact.evaluate((el) => el.closest('section')?.id)).toBe('contact')
    for (const id of ['about']) await expect(page.locator(`#${id} [data-slot="suggest-update-link"]`)).toHaveCount(0)

    for (const [opener, shut] of [[told, 'Escape'], [contact, 'Close']] as const) {
      await opener.click()
      await expect(sheet(page)).toBeVisible()
      await expect.poll(() => focusedInside(page)).toBe(true)
      // The six choices, none pressed at first, and exactly one after a press.
      const chips = sheet(page).getByRole('button', { name: new RegExp(`^(${CHOICES.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`) })
      await expect(chips).toHaveCount(6)
      for (let i = 0; i < 6; i++) await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'false')
      await sheet(page).getByRole('button', { name: 'Contact', exact: true }).click()
      await expect(sheet(page).locator('[aria-pressed="true"]')).toHaveCount(1)
      await expect(sheet(page).getByRole('button', { name: 'Contact', exact: true })).toHaveAttribute('aria-pressed', 'true')
      if (shut === 'Escape') expect(await axeFindings(page)).toEqual([])
      // Tab and Shift+Tab never leave it.
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        expect(await focusedInside(page)).toBe(true)
      }
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Shift+Tab')
        expect(await focusedInside(page)).toBe(true)
      }
      if (shut === 'Escape') await page.keyboard.press('Escape')
      else await sheet(page).getByRole('button', { name: 'Close', exact: true }).click()
      await expect(sheet(page)).toHaveCount(0)
      await expect(opener).toBeFocused()
    }

    expect(sent).toEqual([])
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}

test(`${CLUB.slug} at 320 by 568: the open sheet does not scroll sideways, and its send button with the longest region's name is whole`, async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const sent = await sendNothing(page)
  await page.route(`**/api/clubs/${CLUB.slug}/page`, async (route) => {
    const answer = await route.fetch()
    const body = await answer.json() as { club: { region: string | null }; suggestion: { goes_to: string } }
    body.club.region = LONGEST
    body.suggestion.goes_to = 'region'
    await route.fulfill({ response: answer, json: body })
  })
  await page.setViewportSize({ width: 320, height: 568 })
  await openPage(page)
  await openers(page).nth(1).click()
  await expect(sheet(page)).toBeVisible()
  const send = sheet(page).getByRole('button', { name: `Send to the ${LONGEST} representative`, exact: true })
  await expect(send).toBeVisible()
  const wide = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(wide.scroll).toBeLessThanOrEqual(wide.client)
  // Once it has risen into place: the sheet lies along the window's foot, the window's width and no wider.
  await expect.poll(async () => {
    const at = await sheet(page).boundingBox()
    return at ? [Math.round(at.x), Math.round(at.y + at.height)] : null
  }).toEqual([0, 568])
  const box = await sheet(page).boundingBox()
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  expect(await sheet(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  // The button is whole: its words are not cut, and it lies inside the sheet and the window.
  expect(await send.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  await send.scrollIntoViewIfNeeded()
  const button = await send.boundingBox()
  expect(button!.x).toBeGreaterThanOrEqual(0)
  expect(button!.x + button!.width).toBeLessThanOrEqual(320)
  expect(button!.height).toBeGreaterThanOrEqual(24)
  expect(sent).toEqual([])
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
