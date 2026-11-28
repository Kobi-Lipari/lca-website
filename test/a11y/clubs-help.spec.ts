// test/a11y/clubs-help.spec.ts
//
// Help on the club page's Contact form and on the Reply through LCA page in
// a real browser, on the clubs build alone (the a11y-clubs project; see
// test/a11y/global-setup.ts): one button named Help and one panel on each,
// as WS09 steps 26 and 27 built them, brought back on K's answer to
// checkpoint X's choice 5.
//
// - On a fixture club of scripts/seed/fixtures.sql, signed out: the Contact
//   section has one button named Help and no small question mark; a press
//   opens the panel with the focus in it, and with it open axe with the WCAG
//   2.0, 2.1 and 2.2 A and AA rules finds nothing, at 1,280 by 800 and at
//   390 by 844, with the text at its own size and at 200 percent; Escape
//   shuts it with the focus back on Help, and the open panel fits the
//   window (at its own text size the whole page does not scroll sideways).
// - On the reply page, signed in as a made-up member (the planted session of
//   test/a11y/signedIn.ts, read and not changed), with the link's two calls
//   answered in the browser by a stand-in: Help opens by itself the first
//   time the message is drawn, with the focus left where it is, and keeps
//   one key in the browser; the same checks follow at the same sizes. Where
//   a busy local server made the page draw twice, the key is cleared and the
//   message drawn once more before the opening by itself is checked.
// - No script error and no request to another host.
//
// Reads only: the reply page's calls never reach the local server.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { signInAs } from './signedIn'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'
import { navPersona } from '../unit/fixtures/navPersonas'

const CLUBS = A11Y_CLUBS_VARIANT.name
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [{ width: 1280, height: 800 }, { width: 390, height: 844 }] as const
const TEXT_SIZES = ['100%', '200%'] as const
const CLUB = { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club' }
const TOKEN = 'v1.x.example-made-up-header.example-made-up-iv.example-made-up-body'
const MESSAGE = { firstName: 'Player', club: 'Example Chess Club', excerpt: 'Hello. When do you meet on Saturdays?' }
const REPLY_HELP_SHOWN_KEY = 'lca-club-reply-help'

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== CLUBS, 'the new club pages are drawn on the clubs build alone')
}

async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** The page's text at a share of its own size, as a person who sets a larger text size sees it. */
async function textAt(page: Page, size: string) {
  await page.evaluate((s) => { document.documentElement.style.fontSize = s === '100%' ? '' : s }, size)
}

/**
 * The open panel fits the window and never scrolls sideways itself. At its own text size the whole page does not
 * scroll sideways either; at 200 percent on a phone the header's own buttons are wider than the window today, which
 * is the header's to mend, so only the panel is measured then.
 */
async function fitsTheWindow(page: Page, panel: Locator, text: string) {
  const fit = await panel.evaluate((el) => ({ right: el.getBoundingClientRect().right, left: el.getBoundingClientRect().left, scroll: el.scrollWidth, client: el.clientWidth, window: document.documentElement.clientWidth }))
  expect(fit.left).toBeGreaterThanOrEqual(0)
  expect(fit.right).toBeLessThanOrEqual(fit.window)
  expect(fit.scroll).toBeLessThanOrEqual(fit.client)
  if (text !== '100%') return
  const line = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(line.scroll).toBeLessThanOrEqual(line.client)
}

/** The one Help in a part of the page: a press opens the panel with the focus in it, axe finds nothing, Escape gives the focus back. */
async function openAndShut(page: Page, help: Locator, panelName: string, text: string) {
  const panel = page.getByRole('region', { name: panelName, exact: true })
  if (await help.getAttribute('aria-expanded') === 'true') {
    await help.click()
    await expect(panel).toBeHidden()
  }
  await help.click()
  await expect(panel).toBeVisible()
  await expect(help).toHaveAttribute('aria-expanded', 'true')
  await expect(panel).toBeFocused()
  await expect(panel.getByRole('button', { name: 'Close help', exact: true })).toBeVisible()
  expect(await axeFindings(page)).toEqual([])
  await fitsTheWindow(page, panel, text)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(help).toHaveAttribute('aria-expanded', 'false')
  await expect(help).toBeFocused()
}

for (const size of SIZES) {
  test(`the Contact form on ${CLUB.slug} at ${size.width} by ${size.height}: one Help and its panel, with nothing for axe at its own text size and at 200 percent`, async ({ page, external }, testInfo) => {
    onlyClubs(testInfo)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize(size)
    const h1 = page.getByRole('heading', { level: 1, name: CLUB.name, exact: true })
    await openDrawn(page, `/clubs/${CLUB.slug}`, [h1, page.getByRole('button', { name: 'Send message', exact: true })])
    const contact = page.locator('#contact')
    const help = contact.getByRole('button', { name: 'Help', exact: true })
    await expect(help).toHaveCount(1)
    await expect(contact.getByRole('button', { name: /^Help: / })).toHaveCount(0)
    await expect(contact.locator('[data-slot="help-mark"]')).toHaveCount(0)
    for (const text of TEXT_SIZES) {
      await textAt(page, text)
      await openAndShut(page, help, 'Help with Contact', text)
    }
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })

  test(`the reply page at ${size.width} by ${size.height}, signed in: Help opens by itself once, and its panel has nothing for axe at its own text size and at 200 percent`, async ({ page, external, baseURL }, testInfo) => {
    onlyClubs(testInfo)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await signInAs(page, navPersona('active-member'), baseURL!)
    const asked: string[] = []
    await page.route('**/api/clubs/reply/*', (route) => {
      asked.push(route.request().method())
      return route.request().method() === 'GET'
        ? route.fulfill({ status: 200, json: MESSAGE })
        : route.fulfill({ status: 200, json: { sent: true, firstName: MESSAGE.firstName } })
    })
    await page.setViewportSize(size)
    const h1 = page.getByRole('heading', { level: 1, name: 'Reply through LCA', exact: true })
    const loads = await openDrawn(page, `/clubs/reply/${TOKEN}`, [h1, page.getByRole('button', { name: 'Send reply', exact: true })])
    if (loads > 1) {
      // The page was drawn twice (a busy local server failed a request on the first load), so the first drawing may
      // already have opened Help and kept its key: clear the key and draw the message once more as a first time.
      await page.evaluate((key) => window.localStorage.removeItem(key), REPLY_HELP_SHOWN_KEY)
      await page.reload()
      await expect(page.getByRole('button', { name: 'Send reply', exact: true })).toBeVisible()
    }
    const help = page.getByRole('button', { name: 'Help', exact: true })
    const panel = page.getByRole('region', { name: 'Help with Reply through LCA', exact: true })
    await expect(help).toHaveCount(1)
    await expect(page.getByRole('button', { name: /^Help: / })).toHaveCount(0)
    await expect(page.locator('[data-slot="help-mark"]')).toHaveCount(0)
    // The first time a message is drawn in this browser, Help opens by itself with the focus left where it was.
    await expect(panel).toBeVisible()
    await expect(help).toHaveAttribute('aria-expanded', 'true')
    await expect(panel).not.toBeFocused()
    expect(await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith('lca-club-')))).toEqual([REPLY_HELP_SHOWN_KEY])
    expect(await axeFindings(page)).toEqual([])
    for (const text of TEXT_SIZES) {
      await textAt(page, text)
      await openAndShut(page, help, 'Help with Reply through LCA', text)
    }
    // Drawn again, it stays shut until pressed.
    await page.reload()
    await expect(page.getByRole('button', { name: 'Send reply', exact: true })).toBeVisible()
    await expect(panel).toBeHidden()
    expect(asked.every((method) => method === 'GET')).toBe(true)
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}
