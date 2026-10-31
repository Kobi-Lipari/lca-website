// test/a11y/nav-bars-edges.spec.ts
//
// The tablet header, the phone's app bar and the Menu sheet of WS02 step 6
// at their edges, in a browser, on the a11y-on build, which draws them below
// 1024 pixels. test/a11y/nav.spec.ts holds each bar, the sheet and the
// drawer as they are drawn and used; this file holds what that leaves:
//
// - Log out in the sheet, for a person signed in, at 390 pixels: the person
//   is signed out, the sheet closes with the focus back on Menu, the home
//   page opens, the session is gone from the page and the sheet then offers
//   Log in and Join LCA; the one call to the sign-in service is the
//   library's own call to end the session.
// - The page given back whole when the window crosses a line with the sheet
//   or the drawer open: nothing holds its scroll or its presses, nothing of
//   it is hidden from screen readers, a press in it reaches it, and it
//   scrolls under the wheel.
// - The keyboard alone, from the top of the page, at 390 and at 900 pixels:
//   the skip link, the brand link and each bar's own controls in their
//   order; Enter or Space on Menu opening the sheet on its close control; a
//   section's disclosure opened and closed with Enter; Esc closing it with
//   the focus back on Menu and the page where it was.
// - A small phone, 320 by 568: everything in the sheet inside it, its three
//   buttons each on one line, and its list scrolling up and down alone.
// - The tablet header's My LCA menu at 768 and 1023 pixels, for an LCA
//   admin: inside the window, under its button, the person's rows with Log
//   out last, and Esc giving the focus back to its button.
// - The drawer in a window 900 by 600 with motion allowed: it slides in to
//   rest against the window's right edge and out again, leaving no drawer,
//   no scrim and no hold on the page; and with the page scrolled, the wheel
//   over the scrim moves nothing while the wheel over the drawer's list
//   scrolls the list alone.
//
// Reads only; the person signed in is test/a11y/signedIn.ts's, whose calls
// are answered in the browser. The header and the sheet are read through
// test/a11y/chrome.ts, and every check here holds for the new chrome's bars
// alone, so each test says so through it.
import type { Locator, Page, TestInfo } from '@playwright/test'
import { CHROME_NAMES, NEW_NAMES, brandLink, menuSheet, onlyNew, sheetAppearance, siteHeader } from './chrome'
import { sessionInPage, signInAs, waitForMemberAnswers } from './signedIn'
import { expect, openDrawn, test } from './support'
import { navPersona } from '../unit/fixtures/navPersonas'

const ON = 'a11y-on'
const SKIP = 'Skip to content'
const CLOSE_MENU = 'Close menu'
/** The sheet's list, the region that scrolls inside it. */
const SHEET_LIST = 'Sections and links'
/** The home page's heading, drawn once the page is there. */
const HOME_HEADING = 'Play. Compete. Connect.'

function only(testInfo: TestInfo, project: string, why = `checks the ${project} build`) {
  test.skip(testInfo.project.name !== project, why)
}

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** Opens the home page, waits until it is drawn and its fonts are in. */
async function openHome(page: Page) {
  await openDrawn(page, '/', [page.getByRole('heading', { level: 1, name: HOME_HEADING })])
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
}

/** The bar's bordered Menu button. */
const menuButton = (page: Page) => siteHeader(page).getByRole('button', { name: NEW_NAMES.menu, exact: true })

/** Opens the sheet by a press on the bar's Menu button, and waits until it is open with the focus on its close control. */
async function openSheet(page: Page): Promise<{ menu: Locator; sheet: Locator }> {
  const menu = siteHeader(page).getByRole('button', { name: NEW_NAMES.menu, exact: true })
  // A press at the button's place, as a finger or a mouse makes it, once the scrim of a sheet that has just closed has gone.
  await expect(page.locator('[data-slot="menu-sheet-scrim"]')).toHaveCount(0)
  const box = await menu.boundingBox()
  expect(box, 'the Menu button drawn').not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const sheet = menuSheet(page)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('button', { name: CLOSE_MENU })).toBeFocused()
  await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  return { menu, sheet }
}

/** How the page stands: what holds its scroll and its presses, what of it is hidden from screen readers, and where it is scrolled to. */
const pageState = (page: Page) =>
  page.evaluate(() => {
    const body = getComputedStyle(document.body)
    return {
      scrollHeld: document.body.hasAttribute('data-scroll-locked'),
      overflow: body.overflow,
      presses: body.pointerEvents,
      hidden: document.querySelectorAll('[data-aria-hidden]').length,
    }
  })

/** Where the keyboard is: the element's tag and its name. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return 'body'
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return `${el.tagName.toLowerCase()} ${name}`
  })

test.describe('the tablet header, the app bar and the Menu sheet at their edges', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844, signed in as a member: Log out in the sheet signs the person out, closes the sheet with the focus on Menu and opens the home page; the session is gone, the sheet then offers Log in and Join LCA, and the one call to the sign-in service ends the session', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the Menu sheet comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the app bar\'s sheet for someone signed in')
    const visit = await signInAs(page, navPersona('active-member'), baseURL!)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/clubs')
    await expect(siteHeader(page)).toBeVisible()
    await waitForMemberAnswers(visit)
    const { menu, sheet } = await openSheet(page)
    await expect(sheet.getByRole('link', { name: NEW_NAMES.myLca, exact: true }), visit.notRead).toBeVisible()
    await sheet.getByRole('button', { name: NEW_NAMES.logOut }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(menu).toBeFocused()
    await expect.poll(() => sessionInPage(page), 'the session gone from the page').toBeNull()
    await expect(page.getByRole('heading', { level: 1, name: HOME_HEADING })).toBeVisible()
    // Signed out now: the sheet gives Log in and Join LCA, and no My LCA or Log out.
    const again = await openSheet(page)
    await expect(again.sheet.getByRole('link', { name: CHROME_NAMES.logIn, exact: true })).toBeVisible()
    await expect(again.sheet.getByRole('link', { name: CHROME_NAMES.joinLca, exact: true })).toBeVisible()
    await expect(again.sheet.getByRole('link', { name: NEW_NAMES.myLca, exact: true })).toHaveCount(0)
    await expect(again.sheet.getByRole('button', { name: NEW_NAMES.logOut })).toHaveCount(0)
    // The library asks the sign-in service to end the session, which the helper refuses; nothing else was asked of it.
    expect(visit.signInCalls.length).toBeGreaterThan(0)
    for (const call of visit.signInCalls) expect(call).toMatch(/^POST http:\/\/127\.0\.0\.1:9\/auth\/v1\/logout\b/)
    expect(visit.apiErrors).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on: the sheet open at 390 as the window widens to 900, and the drawer open at 1023 as it narrows to 767 or widens to 1280, give the page back whole: nothing holds its scroll or its presses, nothing of it is hidden from screen readers, a press reaches it and the wheel scrolls it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new chrome\'s bars come with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390, 900, 1023, 767, 1280], 'the app bar, the tablet header and the desktop header')
    const seen: Record<string, unknown> = {}
    for (const [from, to] of [[390, 900], [1023, 767], [1023, 1280]] as const) {
      await page.setViewportSize({ width: from, height: 800 })
      await openHome(page)
      const before = await pageState(page)
      expect(before.scrollHeld, `${from}: nothing holds the page before the sheet opens`).toBe(false)
      await openSheet(page)
      expect((await pageState(page)).scrollHeld, `${from}: the open sheet holds the page`).toBe(true)
      await page.setViewportSize({ width: to, height: 800 })
      await expect(menuSheet(page), `${from} to ${to}: no sheet left`).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator('[data-slot="menu-sheet-scrim"]')).toHaveCount(0)
      await expect.poll(() => pageState(page), `${from} to ${to}: the page as it was before the sheet opened`).toEqual(before)
      await expect(siteHeader(page)).toHaveCount(1)
      await expect(brandLink(page)).toHaveAccessibleName(NEW_NAMES.home)
      // A press in the page reaches it: the point at the middle of the page's heading is the heading's.
      const heading = page.getByRole('heading', { level: 1, name: HOME_HEADING })
      const reached = await heading.evaluate((el) => {
        const box = el.getBoundingClientRect()
        const at = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
        return !!at && el.contains(at)
      })
      expect(reached, `${from} to ${to}: a press on the heading reaches it`).toBe(true)
      // And the wheel scrolls the page.
      await page.mouse.move(to / 2, 600)
      await page.mouse.wheel(0, 500)
      await expect.poll(() => page.evaluate(() => window.scrollY), `${from} to ${to}: the wheel scrolls the page`).toBeGreaterThan(0)
      seen[`${from} to ${to}`] = { before, after: await pageState(page) }
    }
    await testInfo.attach('page-after-the-swap.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  for (const width of [390, 900] as const) {
    const tablet = width >= 768
    test(`a11y-on at ${width} by 844, the keyboard alone from the top of the page: the skip link, the brand link and the ${tablet ? 'tablet header\'s' : 'app bar\'s'} controls in their order; ${tablet ? 'Space' : 'Enter'} on Menu opens the sheet on its close control, a section's disclosure opens and closes on Enter, and Esc closes the sheet with the focus back on Menu and the page where it was`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the new chrome\'s bars come with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], `the ${tablet ? 'tablet header and its drawer' : 'app bar and its sheet'}`)
      await page.setViewportSize({ width, height: 844 })
      await openHome(page)
      expect(await focused(page)).toBe('body')
      const order = tablet
        ? [`a ${SKIP}`, `a ${NEW_NAMES.home}`, 'a Tournaments', `a ${CHROME_NAMES.clubs}`, `button ${NEW_NAMES.donate}`, `a ${CHROME_NAMES.logIn}`, `button ${NEW_NAMES.menu}`]
        : [`a ${SKIP}`, `a ${NEW_NAMES.home}`, `button ${NEW_NAMES.menu}`]
      const reached: string[] = []
      for (let i = 0; i < order.length; i++) {
        await page.keyboard.press('Tab')
        reached.push(await focused(page))
      }
      expect(reached).toEqual(order)
      const menu = menuButton(page)
      await expect(menu).toBeFocused()
      await page.keyboard.press(tablet ? 'Space' : 'Enter')
      const sheet = menuSheet(page)
      await expect(sheet).toBeVisible()
      await expect(sheet).toHaveAttribute('data-shape', tablet ? 'drawer' : 'full')
      await expect(sheet.getByRole('button', { name: CLOSE_MENU })).toBeFocused()
      // On through the list's region, which the keyboard can scroll, to the first section's disclosure.
      await page.keyboard.press('Tab')
      await expect(sheet.getByRole('region', { name: SHEET_LIST })).toBeFocused()
      await page.keyboard.press('Tab')
      const tournaments = sheet.getByRole('button', { name: 'Tournaments' })
      await expect(tournaments).toBeFocused()
      await expect(tournaments).toHaveAttribute('aria-expanded', 'false')
      await page.keyboard.press('Enter')
      await expect(tournaments).toHaveAttribute('aria-expanded', 'true')
      await expect(sheet.getByRole('link', { name: 'Scoresheet scanner' })).toBeVisible()
      await expect(tournaments).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(tournaments).toHaveAttribute('aria-expanded', 'false')
      await expect(sheet.getByRole('link', { name: 'Scoresheet scanner' })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(menu).toBeFocused()
      expect(await page.evaluate(() => window.scrollY), 'the page where it was').toBe(0)
      expect(external).toEqual([])
    })
  }

  test('a11y-on at 320 by 568, signed out: everything in the sheet sits inside it, every section open, its three buttons each on one line, the theme switch\'s three on screen, and its list scrolls up and down alone, never sideways', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the Menu sheet comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [320], 'the app bar\'s sheet on a small phone')
    await page.setViewportSize({ width: 320, height: 568 })
    await openHome(page)
    const { sheet } = await openSheet(page)
    for (const name of ['Tournaments', 'Clubs', NEW_NAMES.about]) {
      const head = sheet.getByRole('button', { name })
      if ((await head.getAttribute('aria-expanded')) === 'false') await head.click()
      await expect(head).toHaveAttribute('aria-expanded', 'true')
    }
    const fit = await sheet.evaluate((el, listName) => {
      const box = el.getBoundingClientRect()
      const words = (node: Element) => (node.getAttribute('aria-label') ?? node.textContent ?? '').replace(/\s+/g, ' ').trim()
      const lines = (node: Element) => {
        const range = document.createRange()
        range.selectNodeContents(node)
        return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size
      }
      const outside = [...el.querySelectorAll('a, button, li, [role="group"]')]
        .filter((node) => node.getClientRects().length > 0)
        .map((node) => ({ words: words(node), box: node.getBoundingClientRect() }))
        .filter(({ box: b }) => b.left < box.left - 0.5 || b.right > box.right + 0.5)
        .map(({ words: w, box: b }) => `${w}: ${Math.round(b.left)} to ${Math.round(b.right)}`)
      const buttons = [...el.querySelectorAll('[data-slot="menu-sheet-buttons"] > *')].map((node) => {
        const b = node.getBoundingClientRect()
        return { words: words(node), lines: lines(node), fits: node.scrollWidth <= Math.ceil(b.width) }
      })
      const list = [...el.querySelectorAll<HTMLElement>('[role="region"]')].find((node) => node.getAttribute('aria-label') === listName)!
      return {
        sheet: [box.x, box.width],
        outside,
        buttons,
        list: { sideways: list.scrollWidth - list.clientWidth, room: list.scrollHeight - list.clientHeight },
      }
    }, SHEET_LIST)
    expect(fit.sheet, 'the sheet, the window\'s own width').toEqual([0, 320])
    expect(fit.outside, 'nothing in the sheet reaches past its edges').toEqual([])
    expect(fit.buttons.map((b) => b.words)).toEqual([NEW_NAMES.donate, CHROME_NAMES.logIn, CHROME_NAMES.joinLca])
    for (const b of fit.buttons) {
      expect(b.lines, `${b.words} on one line`).toBe(1)
      expect(b.fits, `${b.words} inside its button`).toBe(true)
    }
    expect(fit.list.sideways, 'the list never scrolls sideways').toBeLessThanOrEqual(0)
    expect(fit.list.room, 'the list is longer than the sheet, so it scrolls').toBeGreaterThan(0)
    // The theme switch, last in the list, scrolled to, is on screen whole.
    const dark = sheetAppearance(page).getByRole('button', { name: 'Dark' })
    await dark.scrollIntoViewIfNeeded()
    const darkBox = await dark.boundingBox()
    expect(darkBox).not.toBeNull()
    expect(darkBox!.x).toBeGreaterThanOrEqual(0)
    expect(darkBox!.x + darkBox!.width).toBeLessThanOrEqual(320)
    expect(await page.evaluate(() => window.scrollY), 'the page behind has not moved').toBe(0)
    await testInfo.attach('sheet-at-320.json', { body: JSON.stringify(fit, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on at 768 and 1023 by 800, signed in as an LCA admin: the tablet header\'s My LCA menu opens inside the window, under its button, with the person\'s rows and Log out last, and Esc closes it with the focus back on My LCA', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the tablet header comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [768, 1023], 'the tablet header\'s My LCA menu')
    const person = navPersona('admin')
    const visit = await signInAs(page, person, baseURL!)
    const seen: Record<string, unknown> = {}
    for (const width of [768, 1023] as const) {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      await expect(siteHeader(page)).toHaveAttribute('data-form', 'tablet')
      await waitForMemberAnswers(visit)
      const button = siteHeader(page).getByRole('button', { name: NEW_NAMES.myLca })
      await expect(button, visit.notRead).toBeVisible()
      await button.click()
      await expect(button).toHaveAttribute('aria-expanded', 'true')
      const panel = siteHeader(page).locator('[data-slot="my-lca-menu"]')
      await expect(panel).toBeVisible()
      await expect(panel.getByRole('listitem')).toHaveText([...person.myLcaMenuRows])
      await expect(panel.getByRole('listitem').last()).toHaveText(NEW_NAMES.logOut)
      const boxes = await panel.evaluate((el) => {
        const own = el.getBoundingClientRect()
        // The menu's own button: the one in its wrapper that names the menu while it is open.
        const opener = el.parentElement?.querySelector(`button[aria-controls="${el.id}"]`)
        const under = opener ? opener.getBoundingClientRect() : null
        return { left: own.left, right: own.right, top: own.top, bottom: own.bottom, window: [window.innerWidth, window.innerHeight], under: under ? under.bottom : null }
      })
      expect(boxes.left, `${width}: the menu inside the window on the left`).toBeGreaterThanOrEqual(0)
      expect(boxes.right, `${width}: and on the right`).toBeLessThanOrEqual(width)
      expect(boxes.bottom, `${width}: and above its foot`).toBeLessThanOrEqual(boxes.window[1])
      expect(boxes.top, `${width}: under its button`).toBeGreaterThanOrEqual(boxes.under ?? 0)
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
      await expect(button).toBeFocused()
      await expect(button).toHaveAttribute('aria-expanded', 'false')
      seen[String(width)] = boxes
    }
    await testInfo.attach('tablet-my-lca-menu.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(visit.apiErrors).toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-on at 900 by 600, with the page scrolled: while the drawer is open, the wheel over the scrim moves nothing, and the wheel over the drawer\'s list scrolls the list alone', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the Menu sheet comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [900], 'the tablet header\'s drawer')
    await page.setViewportSize({ width: 900, height: 600 })
    await openHome(page)
    await page.evaluate(() => window.scrollTo(0, 300))
    await frames(page)
    const before = await page.evaluate(() => window.scrollY)
    expect(before).toBe(300)
    const { sheet } = await openSheet(page)
    await sheet.getByRole('button', { name: NEW_NAMES.about }).click()
    const list = sheet.getByRole('region', { name: SHEET_LIST })
    const scroll = () => list.evaluate((el) => ({ top: el.scrollTop, room: el.scrollHeight - el.clientHeight, page: window.scrollY }))
    expect((await scroll()).room, 'the list is longer than the drawer').toBeGreaterThan(50)
    // Over the scrim, beside the drawer: nothing moves.
    await page.mouse.move(200, 300)
    await page.mouse.wheel(0, 400)
    await frames(page)
    await frames(page)
    const still = await scroll()
    expect(still.top, 'the wheel over the scrim leaves the list where it is').toBe(0)
    expect(still.page, 'the wheel over the scrim leaves the page where it is').toBe(before)
    // Over the drawer's list: the list scrolls, and the page behind does not.
    const box = (await list.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(0, 300)
    await expect.poll(async () => (await scroll()).top, 'the wheel over the list scrolls it').toBeGreaterThan(0)
    expect((await scroll()).page, 'the page behind has not moved').toBe(before)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    expect(await page.evaluate(() => window.scrollY), 'the page where it was once the drawer has closed').toBe(before)
    expect(external).toEqual([])
  })
})

test.describe('the drawer with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('a11y-on at 900 by 600: the drawer slides in to rest against the window\'s right edge, its full height, the focus on its close control, and on Esc slides out, leaving no drawer, no scrim and no hold on the page, the focus back on Menu', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the Menu sheet comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [900], 'the tablet header\'s drawer')
    await page.setViewportSize({ width: 900, height: 600 })
    await openHome(page)
    const before = await pageState(page)
    for (let time = 1; time <= 2; time++) {
      const { menu, sheet } = await openSheet(page)
      const box = await sheet.evaluate((el) => {
        const b = el.getBoundingClientRect()
        return [b.x, b.y, b.width, b.height]
      })
      expect(box, `time ${time}: at rest against the right edge, the window's full height`).toEqual([500, 0, 400, 600])
      await page.keyboard.press('Escape')
      await expect(sheet, `time ${time}: the drawer gone once it has slid out`).toHaveCount(0, { timeout: 5_000 })
      await expect(page.locator('[data-slot="menu-sheet-scrim"]'), `time ${time}: the scrim gone`).toHaveCount(0, { timeout: 5_000 })
      await expect(menu).toBeFocused()
      await expect.poll(() => pageState(page), `time ${time}: the page as it was`).toEqual(before)
    }
    expect(external).toEqual([])
  })
})
