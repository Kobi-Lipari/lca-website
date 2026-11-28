// test/a11y/clubs-suggest-club.spec.ts
//
// Suggest a club and Start a club (WS09's thirtieth step) in a real browser,
// for a visitor who is signed out, on the clubs build alone (the a11y-clubs
// project; see test/a11y/global-setup.ts), at /clubs/suggest and
// /clubs/suggest?kind=start:
//
// - axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing at 1,280
//   by 800 and at 390 by 844, with each side of the switch chosen, run as the
//   suite's other specs run it;
// - the switch's state is told by aria-pressed, exactly one side pressed,
//   and the page's heading and the document's title follow it, as does the
//   address;
// - every field has its visible label;
// - an empty send is refused in words beside each field, with the focus on
//   the first;
// - at 320 by 568 the page does not scroll sideways and its button is whole;
// - no script error and no request to another host.
//
// Nothing is sent. Any POST to the endpoint is answered in the browser with
// a made-up answer that its contract parses, and counted; the browser builds
// have no spam check key, so the form never gets a token to send with, and
// the count stays at none. Reads only: nothing here writes to the project's
// local database.
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { contracts } from '../../domain/contracts'

const CLUBS = A11Y_CLUBS_VARIANT.name
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [{ width: 1280, height: 800 }, { width: 390, height: 844 }] as const
const SIDES = [
  { path: '/clubs/suggest', title: 'Suggest a club', message: 'Where and when it meets, in your words' },
  { path: '/clubs/suggest?kind=start', title: 'Start a club', message: 'Where and when you\'d meet, in your words' },
] as const
const LABELS = ['Club name', 'City or ZIP', 'Your name', 'Your email (stays private)'] as const

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== CLUBS, 'the new club pages are drawn on the clubs build alone')
}

async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** Answers any POST to the endpoint with a made-up answer its contract parses, and counts them: nothing reaches the server. */
async function answerInBrowser(page: Page): Promise<string[]> {
  const sent: string[] = []
  const madeUp = contracts['clubs/reports'].POST.response.parse({ sent: true })
  await page.route('**/api/clubs/reports', (route) => {
    sent.push(route.request().method())
    return route.fulfill({ status: 200, json: madeUp })
  })
  return sent
}

const main = (page: Page) => page.locator('main')
const side = (page: Page, title: string) => main(page).getByRole('group', { name: 'I\'d like to' }).getByRole('button', { name: title, exact: true })

async function openSide(page: Page, path: string, title: string) {
  await openDrawn(page, path, [page.getByRole('heading', { level: 1, name: title, exact: true }), main(page).getByRole('button', { name: 'Send to LCA', exact: true })])
}

for (const size of SIZES) {
  test(`/clubs/suggest at ${size.width} by ${size.height}: each side of the switch has nothing for axe, its state told, its heading, title and address its own`, async ({ page, external }, testInfo) => {
    onlyClubs(testInfo)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const sent = await answerInBrowser(page)
    await page.setViewportSize(size)
    for (const [i, now] of SIDES.entries()) {
      const other = SIDES[1 - i]
      await openSide(page, now.path, now.title)
      await expect(page).toHaveTitle(`${now.title} | Louisiana Chess Association`)
      await expect(side(page, now.title)).toHaveAttribute('aria-pressed', 'true')
      await expect(side(page, other.title)).toHaveAttribute('aria-pressed', 'false')
      await expect(main(page).locator('[aria-pressed="true"]')).toHaveCount(1)
      for (const label of [...LABELS, now.message]) await expect(main(page).getByLabel(label, { exact: true })).toBeVisible()
      expect(await axeFindings(page)).toEqual([])
      // A press moves the heading, the title and the address to the other side.
      await side(page, other.title).click()
      await expect(page.getByRole('heading', { level: 1, name: other.title, exact: true })).toBeVisible()
      await expect(page).toHaveTitle(`${other.title} | Louisiana Chess Association`)
      await expect(side(page, other.title)).toHaveAttribute('aria-pressed', 'true')
      expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(other.path)
    }
    expect(sent).toEqual([])
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}

test('/clubs/suggest: an empty send is refused in words beside each field, with the focus on the first, and nothing is sent', async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const sent = await answerInBrowser(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openSide(page, SIDES[0].path, SIDES[0].title)
  await main(page).getByRole('button', { name: 'Send to LCA', exact: true }).click()
  for (const [label, words] of [
    ['Club name', 'Enter the club\'s name.'],
    ['City or ZIP', 'Enter a city or a ZIP code.'],
    [SIDES[0].message, 'Write where and when, in your words.'],
    ['Your name', 'Enter your name.'],
    ['Your email (stays private)', 'Enter your email address.'],
  ] as const) {
    const box = main(page).getByLabel(label, { exact: true })
    await expect(box).toHaveAttribute('aria-invalid', 'true')
    await expect(box).toHaveAccessibleDescription(words)
  }
  await expect(main(page).getByLabel('Club name', { exact: true })).toBeFocused()
  expect(await axeFindings(page)).toEqual([])
  expect(sent).toEqual([])
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('/clubs/suggest at 320 by 568: the page does not scroll sideways, and its button is whole', async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const sent = await answerInBrowser(page)
  await page.setViewportSize({ width: 320, height: 568 })
  for (const now of SIDES) {
    await openSide(page, now.path, now.title)
    const wide = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
    expect(wide.scroll).toBeLessThanOrEqual(wide.client)
    const send = main(page).getByRole('button', { name: 'Send to LCA', exact: true })
    await send.scrollIntoViewIfNeeded()
    expect(await send.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    const box = await send.boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(320)
    expect(box!.height).toBeGreaterThanOrEqual(24)
  }
  expect(sent).toEqual([])
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
