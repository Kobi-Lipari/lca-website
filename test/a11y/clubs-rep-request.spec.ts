// test/a11y/clubs-rep-request.spec.ts
//
// Ask to be its named rep (WS09's thirty-first step) in a real browser, on
// the clubs build alone (the a11y-clubs project; see
// test/a11y/global-setup.ts), on a fixture club of scripts/seed/fixtures.sql
// that has no named rep, so the page's answer invites a member to ask:
//
// - the invitation is one line of its own before the foot line, and the
//   page holds it once;
// - signed out, the sheet says one sentence with "Log in to ask" and "Not
//   now"; with it open, axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules
//   finds nothing at 1,280 by 800 and at 390 by 844; the focus is inside it,
//   Tab does not leave it, Escape and Not now shut it, and the focus is back
//   on the invitation;
// - signed in as a made-up member (the planted session of
//   test/a11y/signedIn.ts, read and not changed), the four answers are told
//   by aria-pressed, a send with none is refused in words, and once a send is
//   answered the sent sentence takes the focus;
// - at 320 by 568 the open sheet does not scroll sideways;
// - no script error and no request to another host.
//
// The one send is answered in the browser by a stand-in, so nothing reaches
// the local server's database: reads only.
import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { signInAs } from './signedIn'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { navPersona } from '../unit/fixtures/navPersonas'

const CLUBS = A11Y_CLUBS_VARIANT.name
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [{ width: 1280, height: 800 }, { width: 390, height: 844 }] as const
const CLUB = { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club' }
const TITLE = `Ask to be ${CLUB.name}'s named rep`
const ANSWERS = ['I run it', 'I help run it', 'I\'d keep the page for the club', 'Something else']
const SENT = 'Request sent. LCA has it, and you\'ll get an email with the answer. The page doesn\'t change until then.'

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== CLUBS, 'the new club pages are drawn on the clubs build alone')
}

async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** Answers any send in the browser, and counts them: nothing reaches the local server. */
async function standIn(page: Page): Promise<string[]> {
  const sent: string[] = []
  await page.route('**/api/clubs/*/rep-requests', (route) => {
    sent.push(route.request().postData() ?? '')
    return route.fulfill({ status: 200, json: { sent: true } })
  })
  return sent
}

async function openPage(page: Page) {
  const h1 = page.getByRole('heading', { level: 1, name: CLUB.name, exact: true })
  await openDrawn(page, `/clubs/${CLUB.slug}`, [h1, page.getByRole('button', { name: 'Ask to be its named rep', exact: true })])
}

const invite = (page: Page) => page.locator('main').getByRole('button', { name: 'Ask to be its named rep', exact: true })
const sheet = (page: Page) => page.getByRole('dialog', { name: TITLE })
const focusedInside = (page: Page) => sheet(page).evaluate((el) => el.contains(document.activeElement))

for (const size of SIZES) {
  test(`${CLUB.slug} at ${size.width} by ${size.height}: the invitation, and the sheet signed out with its two buttons, with nothing for axe, keeping and giving back the focus`, async ({ page, external }, testInfo) => {
    onlyClubs(testInfo)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const sent = await standIn(page)
    await page.setViewportSize(size)
    await openPage(page)

    await expect(invite(page)).toHaveCount(1)
    expect(await invite(page).evaluate((el) => el.closest('[data-slot="rep-request-invite"]')?.nextElementSibling?.getAttribute('data-slot'))).toBe('club-foot')
    expect(await invite(page).evaluate((el) => el.closest('section'))).toBeNull()

    for (const shut of ['Escape', 'Not now'] as const) {
      await invite(page).click()
      await expect(sheet(page)).toBeVisible()
      await expect.poll(() => focusedInside(page)).toBe(true)
      await expect(sheet(page).getByRole('link', { name: 'Log in to ask', exact: true })).toHaveAttribute('href', '/login')
      await expect(sheet(page).getByRole('button', { name: 'Not now', exact: true })).toBeVisible()
      if (shut === 'Escape') expect(await axeFindings(page)).toEqual([])
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        expect(await focusedInside(page)).toBe(true)
      }
      if (shut === 'Escape') await page.keyboard.press('Escape')
      else await sheet(page).getByRole('button', { name: 'Not now', exact: true }).click()
      await expect(sheet(page)).toHaveCount(0)
      await expect(invite(page)).toBeFocused()
    }

    expect(sent).toEqual([])
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}

test(`${CLUB.slug} at 390 by 844, signed in as a member: the four answers by aria-pressed, a send with none refused in words, and the sent sentence with the focus`, async ({ page, external, baseURL }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await signInAs(page, navPersona('active-member'), baseURL!)
  const sent = await standIn(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await openPage(page)
  await invite(page).click()
  await expect(sheet(page)).toBeVisible()
  const group = sheet(page).getByRole('group', { name: 'How are you connected to the club?' })
  await expect(group).toBeVisible()
  const chips = group.getByRole('button')
  await expect(chips).toHaveText(ANSWERS)
  for (let i = 0; i < 4; i++) await expect(chips.nth(i)).toHaveAttribute('aria-pressed', 'false')
  await expect(sheet(page).getByLabel('Anything LCA should know? (optional)')).toBeVisible()
  await sheet(page).getByRole('button', { name: 'Send request', exact: true }).click()
  await expect(sheet(page).getByText('Choose how you are connected to the club.')).toBeVisible()
  expect(sent).toEqual([])
  await chips.nth(1).click()
  await chips.nth(0).click()
  await expect(sheet(page).locator('[aria-pressed="true"]')).toHaveCount(1)
  await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true')
  expect(await axeFindings(page)).toEqual([])
  await sheet(page).getByRole('button', { name: 'Send request', exact: true }).click()
  const done = sheet(page).getByText(SENT, { exact: true })
  await expect(done).toBeFocused()
  expect(sent.map((body) => JSON.parse(body))).toEqual([{ connection: 'runs_it', note: '' }])
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test(`${CLUB.slug} at 320 by 568: the open sheet does not scroll sideways`, async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await standIn(page)
  await page.setViewportSize({ width: 320, height: 568 })
  await openPage(page)
  const line = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(line.scroll).toBeLessThanOrEqual(line.client)
  await invite(page).click()
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page).getByRole('link', { name: 'Log in to ask', exact: true })).toBeVisible()
  const wide = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(wide.scroll).toBeLessThanOrEqual(wide.client)
  await expect.poll(async () => {
    const at = await sheet(page).boundingBox()
    return at ? [Math.round(at.x), Math.round(at.y + at.height)] : null
  }).toEqual([0, 568])
  expect(await sheet(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  expect(errors).toEqual([])
  expect(external).toEqual([])
})
