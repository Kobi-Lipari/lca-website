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
//   or the drawer open: since WS02 step 7 the one sheet stays open across
//   768 pixels, drawn by the bar then drawn, and gives the page back once it
//   closes, and the drawer widened past 1024 closes; either way nothing then
//   holds the page's scroll or its presses, nothing of it is hidden from
//   screen readers, a press in it reaches it, and it scrolls under the wheel.
// - The keyboard alone, from the top of the page, at 390 and at 900 pixels:
//   the skip link, the brand link and each bar's own controls in their
//   order, and at 390, since WS02 step 7, the tab bar's four tabs last, after
//   the footer; Enter or Space on Menu opening the sheet on its close
//   control; a section's disclosure opened and closed with Enter; Esc
//   closing it with the focus back on Menu and the page where it was.
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
// - The phone's dock and its tab bar at their edges (WS02 step 7): a
//   phone's safe areas, given through the browser's own emulation of them,
//   kept clear by the app bar, the tab bar, the sheet, the skip link and,
//   on a phone on its side, the tablet header and its drawer, while today's
//   site on a11y-off moves by none of them; the one sheet open as a phone
//   turns and as the window crosses 768 pixels, and where the focus goes as
//   it closes; the reflow fallback's lines as the browser reads them; the
//   tab bar's words at the 360 pixel step and its hairline; a tap on the
//   Close tab; the viewport tag of the pages the server writes a preview
//   into; the dock back once a focused field leaves the page; Shift+Tab
//   back up the page clear of both bars; the sheet above a taller dock; and
//   Donate first in the sheet for a member whose membership has run out.
//
// Reads only; the person signed in is test/a11y/signedIn.ts's, whose calls
// are answered in the browser. The header, the sheet, the dock and the tab
// bar are read through test/a11y/chrome.ts, and every check here but two
// holds for the new chrome's bars alone, so each test says so through it;
// the two read what each build serves, or today's site on a11y-off.
import type { Locator, Page, TestInfo } from '@playwright/test'
import { CHROME_NAMES, NEW_NAMES, SITE, brandLink, dock, menuControl, menuSheet, menuTab, onlyNew, sheetAppearance, siteHeader, tabBar } from './chrome'
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

/** The control that opens the sheet: the tablet header's bordered Menu button, and below 768 pixels, since WS02 step 7, the tab bar's Menu tab. */
const menuButton = (page: Page) => menuControl(page)

/** Opens the sheet by a press on the control that opens it, and waits until it is open with the focus on its close control. */
async function openSheet(page: Page): Promise<{ menu: Locator; sheet: Locator }> {
  const menu = menuControl(page)
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

/** Which part of the page holds the focus: the bar, the footer, the tab bar, or the page between (WS02 step 7). */
const focusedPart = (page: Page) =>
  page.evaluate((site) => {
    const el = document.activeElement
    if (!el || el === document.body) return 'body'
    return el.closest(site.tabBar) ? 'tab bar' : el.closest(site.footer) ? 'footer' : el.closest(site.header) ? 'bar' : 'page'
  }, SITE)

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

  test('a11y-on: the sheet open at 390 as the window widens to 900 and the drawer open at 1023 as it narrows to 767 stay open, drawn by the bar then drawn, and once closed give the page back whole; the drawer open at 1023 as the window widens to 1280 closes and gives it back whole: nothing holds its scroll or its presses, nothing of it is hidden from screen readers, a press reaches it and the wheel scrolls it', async ({ page, external }, testInfo) => {
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
      if (to < 1024) {
        // The one sheet stays open across 768 pixels (WS02 step 7), in the shape of the bar now drawn, until it is closed.
        await expect(menuSheet(page), `${from} to ${to}: the sheet still open`).toHaveCount(1)
        await expect(menuSheet(page)).toHaveAttribute('data-shape', to >= 768 ? 'drawer' : 'full')
        await expect(page.getByRole('dialog')).toHaveCount(1)
        expect((await pageState(page)).scrollHeld, `${from} to ${to}: the sheet still holds the page`).toBe(true)
        if (to < 768) await expect(menuTab(page)).toHaveText('Close')
        await page.keyboard.press('Escape')
      }
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
    test(`a11y-on at ${width} by 844, the keyboard alone from the top of the page: the skip link, the brand link and the ${tablet ? 'tablet header\'s controls in their order' : 'app bar\'s controls, then the page and the footer, and last the tab bar\'s four tabs'}; ${tablet ? 'Space' : 'Enter'} on Menu opens the sheet on its close control, a section's disclosure opens and closes on Enter, and Esc closes the sheet with the focus back on Menu and the page where it was`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the new chrome\'s bars come with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], `the ${tablet ? 'tablet header and its drawer' : 'app bar and its sheet'}`)
      await page.setViewportSize({ width, height: 844 })
      await openHome(page)
      expect(await focused(page)).toBe('body')
      const reached: string[] = []
      if (tablet) {
        const order = [`a ${SKIP}`, `a ${NEW_NAMES.home}`, 'a Tournaments', `a ${CHROME_NAMES.clubs}`, `button ${NEW_NAMES.donate}`, `a ${CHROME_NAMES.logIn}`, `button ${NEW_NAMES.menu}`]
        for (let i = 0; i < order.length; i++) {
          await page.keyboard.press('Tab')
          reached.push(await focused(page))
        }
        expect(reached).toEqual(order)
      } else {
        // Beside the tab bar the app bar's one control is its brand link, and the tab bar comes last, after the
        // footer (WS02 step 7): every stop from the top of the page to the Menu tab, each with the part it is in.
        const parts: string[] = []
        for (let i = 0; i < 400 && !(reached.at(-1) === `button ${NEW_NAMES.menu}` && parts.at(-1) === 'tab bar'); i++) {
          await page.keyboard.press('Tab')
          reached.push(await focused(page))
          parts.push(await focusedPart(page))
        }
        expect(reached.slice(0, 2)).toEqual([`a ${SKIP}`, `a ${NEW_NAMES.home}`])
        expect(parts[1]).toBe('bar')
        expect(parts.slice(2).includes('bar'), 'no other control of the app bar').toBe(false)
        expect(reached.slice(-4)).toEqual(['a Tournaments', `a ${CHROME_NAMES.clubs}`, `a ${CHROME_NAMES.logIn}`, `button ${NEW_NAMES.menu}`])
        expect(parts.slice(-4)).toEqual(['tab bar', 'tab bar', 'tab bar', 'tab bar'])
        expect(parts.at(-5), 'the stop before the tabs is the footer\'s').toBe('footer')
        expect(parts.slice(0, -4).includes('tab bar'), 'the tab bar reached only after the footer').toBe(false)
      }
      const menu = menuButton(page)
      await expect(menu).toBeFocused()
      // Reaching the Menu tab took the keyboard through the whole page, which scrolled it; the tab, fixed to the window, moves nothing.
      const where = await page.evaluate(() => window.scrollY)
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
      expect(await page.evaluate(() => window.scrollY), 'the page where it was').toBe(where)
      if (tablet) expect(where, 'the tablet header\'s Menu button reached at the top of the page').toBe(0)
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

// ── The phone's dock and the tab bar at their edges (WS02 step 7) ──────────

const OFF = 'a11y-off'
/** The Menu tab's words while the sheet is open, as src/lib/nav.ts gives them (whileOpen), which test/unit/bottom-dock.test.tsx holds to the model. */
const CLOSE_TAB = 'Close'
/** The donation dialog the sheet's Donate opens until the Give page exists. */
const DONATION = 'Support the Louisiana Chess Association'
/** The about page's heading, drawn once the page is there, on both builds. */
const ABOUT_HEADING = 'About LCA'

/** A phone's safe areas in CSS pixels: under its status bar, over its home indicator, and at its sides. */
interface Insets {
  top: number
  bottom: number
  left: number
  right: number
}

/**
 * Gives the page a phone's safe areas through the browser's own emulation of
 * them, the DevTools protocol's override of env(safe-area-inset-*), as a
 * phone with a notch and a home indicator reports them. Every side is given,
 * 0 where the phone has none, since a side left out reads as no value.
 */
async function safeAreas(page: Page, insets: Insets) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets })
}

/** Opens the about page, waits until it is drawn and its fonts are in. */
async function openAbout(page: Page) {
  await openDrawn(page, '/about', [page.getByRole('heading', { level: 1, name: ABOUT_HEADING })])
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
}

/** A press at the middle of a control's box, as a finger or a mouse makes it, never through a locator's click. */
async function pressAt(page: Page, control: Locator) {
  const box = await control.boundingBox()
  expect(box, 'the control drawn').not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
}

/** What the dock writes on the page's root, and the room the page keeps at its top and its foot. */
const roomNow = (page: Page) =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement)
    return {
      written: [document.documentElement.style.getPropertyValue('--header-h'), document.documentElement.style.getPropertyValue('--bottom-chrome-h')],
      padding: [root.scrollPaddingTop, root.scrollPaddingBottom],
    }
  })

/** The bar's own bordered Menu buttons drawn now, read in the page, since the open sheet hides the bar from assistive technology. */
const barMenus = (page: Page) =>
  page.evaluate((site) => [...(document.querySelector(site.header)?.querySelectorAll('button[aria-haspopup="dialog"]') ?? [])].map((b) => ({ expanded: b.getAttribute('aria-expanded'), controls: b.getAttribute('aria-controls') })), SITE)

/** Whether the focus is on the bar's own bordered Menu button. */
const onBarMenu = (page: Page) =>
  page.evaluate((site) => {
    const el = document.activeElement
    return !!el && el.matches('button[aria-haspopup="dialog"]') && !!el.closest(site.header)
  }, SITE)

/** The Menu sheet's box and its scrim's, as drawn now. */
const sheetBoxes = (page: Page) =>
  page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
    }
    return { sheet: box(document.querySelector('[data-slot="menu-sheet"]')), scrim: box(document.querySelector('[data-slot="menu-sheet-scrim"]')) }
  })

/** Sets the visual viewport's height as an on-screen keyboard would leave it, so many pixels shorter than the window, or whole again for null, and sends the resize the browser sends. */
const lowerViewport = (page: Page, by: number | null) =>
  page.evaluate((by) => {
    const view = window.visualViewport
    if (!view) throw new Error('this browser has no visual viewport')
    if (by === null) delete (view as unknown as { height?: number }).height
    else Object.defineProperty(view, 'height', { configurable: true, get: () => window.innerHeight - by })
    view.dispatchEvent(new Event('resize'))
  }, by)

/** The action bar fixture's height, as test/a11y/dock.spec.ts plants it. */
const ACTION_BAR_H = 64

/** Plants a bar 64 pixels tall in the dock's action place, as a page's bar is put there, and again each time the dock draws the place anew. */
const plantActionBar = (page: Page) =>
  page.evaluate((height) => {
    const plant = () => {
      const place = document.querySelector('[data-slot="dock-action"]')
      if (!place) return false
      if (!place.querySelector('[data-fixture="action-bar"]')) {
        const bar = document.createElement('div')
        bar.setAttribute('data-fixture', 'action-bar')
        bar.style.cssText = `box-sizing: border-box; height: ${height}px; display: flex; align-items: center; padding: 0 16px; border-top: 1px solid var(--hairline); background: var(--surface); color: var(--ink)`
        bar.textContent = 'A made-up action bar the test plants'
        place.append(bar)
      }
      return true
    }
    new MutationObserver(() => void plant()).observe(document.body, { childList: true, subtree: true })
    return plant()
  }, ACTION_BAR_H)

/** A box in the window's own pixels. */
interface Box {
  top: number
  bottom: number
  left: number
  right: number
}
/** Whether two boxes overlap by more than half a pixel each way. */
const overlap = (a: Box, b: Box) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5 && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5

/** Where the focus is: the part of the page it is in, its control, and the boxes of the control, the sticky bar and the dock at that moment. */
interface Stop {
  part: 'skip' | 'bar' | 'dock' | 'page'
  name: string
  box: Box
  bar: Box | null
  dock: Box | null
}
const stopNow = (page: Page): Promise<Stop | null> =>
  page.evaluate((site) => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body || el === document.documentElement) return null
    const area = (r: DOMRect) => ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
    const header = document.querySelector(site.header)
    const drawnDock = document.querySelector(site.dock)
    const part = drawnDock?.contains(el) ? 'dock' : el.hasAttribute('data-skip-link') ? 'skip' : header?.contains(el) ? 'bar' : 'page'
    return {
      part: part as Stop['part'],
      name: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)}`,
      box: area(el.getBoundingClientRect()),
      bar: header ? area(header.getBoundingClientRect()) : null,
      dock: drawnDock ? area(drawnDock.getBoundingClientRect()) : null,
    }
  }, SITE)

/** Shift+Tab from where the focus is, one press at a time, until it reaches the sticky bar or the skip link: each control the focus lands on. */
async function walkBack(page: Page): Promise<Stop[]> {
  const stops: Stop[] = []
  for (let n = 0; n < 300; n++) {
    await page.keyboard.press('Shift+Tab')
    const at = await stopNow(page)
    if (at === null) continue
    stops.push(at)
    if (at.part === 'bar' || at.part === 'skip') break
  }
  return stops
}

test.describe('the phone\'s dock and the tab bar at their edges (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844 with a phone\'s safe areas, 47 pixels under its status bar and 34 over its home indicator: the app bar\'s row below the status bar, the bar and --header-h 103 pixels; the tab bar\'s row whole above the home indicator, the dock and --bottom-chrome-h 91 pixels; the skip link inside the safe area; the sheet from the window\'s top to the dock\'s with its close control below the status bar; and the footer ending at the dock\'s top', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the app bar and the dock inside a phone\'s safe areas')
    await page.setViewportSize({ width: 390, height: 844 })
    await safeAreas(page, { top: 47, bottom: 34, left: 0, right: 0 })
    await openAbout(page)
    const drawn = await page.evaluate((site) => {
      const box = (el: Element | null | undefined) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, height: r.height }
      }
      const header = document.querySelector(site.header)
      const nav = document.querySelector(site.tabBar)
      return {
        bar: box(header),
        row: box(header?.querySelector('[data-slot="app-bar-row"]')),
        dock: box(document.querySelector(site.dock)),
        tabs: box(nav?.querySelector('ul')),
        each: [...(nav?.querySelectorAll('a, button') ?? [])].map((el) => box(el)),
      }
    }, SITE)
    expect(drawn.bar, 'the app bar, its 56 pixel row and the status bar\'s 47').toEqual({ top: 0, bottom: 103, height: 103 })
    expect(drawn.row, 'its row below the status bar').toEqual({ top: 47, bottom: 103, height: 56 })
    expect(drawn.dock, 'the dock, the tab bar\'s line, its row and the home indicator\'s 34').toEqual({ top: 753, bottom: 844, height: 91 })
    expect(drawn.tabs, 'the row of tabs, whole, under the hairline and above the home indicator').toEqual({ top: 754, bottom: 810, height: 56 })
    expect(drawn.each, 'each tab the row\'s height').toEqual(Array(4).fill({ top: 754, bottom: 810, height: 56 }))
    expect(await roomNow(page)).toEqual({ written: ['103px', '91px'], padding: ['103px', '91px'] })
    // The skip link, the first stop of Tab, inside the safe area at the window's top left.
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: SKIP })
    await expect(skip).toBeFocused()
    const skipBox = await skip.boundingBox()
    expect([skipBox?.x, skipBox?.y], 'the skip link 16 pixels in from the left and from the safe area\'s top').toEqual([16, 63])
    // The sheet from the Menu tab: from the window's top to the dock's, its words and controls below the status bar.
    await pressAt(page, menuTab(page))
    const sheet = menuSheet(page)
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('button', { name: CLOSE_MENU })).toBeFocused()
    expect(await sheetBoxes(page)).toEqual({ sheet: { top: 0, bottom: 753, left: 0, right: 390 }, scrim: { top: 0, bottom: 753, left: 0, right: 390 } })
    const close = await sheet.getByRole('button', { name: CLOSE_MENU }).boundingBox()
    expect(close!.y, 'the close control below the status bar').toBeGreaterThanOrEqual(47)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
    await expect(menuTab(page)).toBeFocused()
    // The page's end: the footer's last line clear of the dock and its home indicator.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
    await frames(page)
    const footerBottom = await page.evaluate((site) => document.querySelector(site.footer)!.getBoundingClientRect().bottom, SITE)
    expect(Math.abs(footerBottom - 753), `the footer ends at ${footerBottom}, the dock's top 753`).toBeLessThanOrEqual(0.5)
    expect(external).toEqual([])
  })

  for (const [width, height, side] of [[844, 390, 47], [812, 375, 44]] as const) {
    test(`a11y-on at ${width} by ${height}, a phone on its side with ${side} pixels of safe area at each side and 21 over its home indicator: no dock; the page and the tablet header inside the safe area, every control of the header's row inside it and the row whole, nothing to scroll sideways; and the drawer against the window's right edge with its close control clear of the notch`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the tablet header comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the tablet header on a phone on its side')
      await page.setViewportSize({ width, height })
      await safeAreas(page, { top: 0, bottom: 21, left: side, right: side })
      await openAbout(page)
      await expect(dock(page)).toHaveCount(0)
      await expect(tabBar(page)).toHaveCount(0)
      const drawn = await page.evaluate((site) => {
        const header = document.querySelector(site.header)!
        const row = header.querySelector('[data-slot="site-header-row"]')!
        const r = header.getBoundingClientRect()
        return {
          form: header.getAttribute('data-form'),
          box: [r.left, r.right],
          row: [row.scrollWidth, row.clientWidth],
          controls: [...header.querySelectorAll('a, button')]
            .filter((el) => el.getClientRects().length > 0)
            .map((el) => {
              const b = el.getBoundingClientRect()
              return { name: (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim(), left: b.left, right: b.right }
            }),
          body: [getComputedStyle(document.body).paddingLeft, getComputedStyle(document.body).paddingRight],
          sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      }, SITE)
      await testInfo.attach(`tablet-header-${width}-by-${height}-safe-areas.json`, { body: JSON.stringify(drawn, null, 2), contentType: 'application/json' })
      expect(drawn.form).toBe('tablet')
      expect(drawn.body, 'the page\'s sides inside the safe area').toEqual([`${side}px`, `${side}px`])
      expect(drawn.box, 'the header between the two notches').toEqual([side, width - side])
      expect(drawn.row[0], 'the row whole, nothing of it cut').toBeLessThanOrEqual(drawn.row[1])
      expect(drawn.controls.length).toBeGreaterThanOrEqual(6)
      for (const c of drawn.controls) {
        expect(c.left, `${c.name}: clear of the left notch`).toBeGreaterThanOrEqual(side - 0.5)
        expect(c.right, `${c.name}: clear of the right notch`).toBeLessThanOrEqual(width - side + 0.5)
      }
      expect(drawn.sideways, 'nothing to scroll sideways').toBeLessThanOrEqual(0)
      const { menu, sheet } = await openSheet(page)
      await expect(sheet).toHaveAttribute('data-shape', 'drawer')
      const boxes = await sheetBoxes(page)
      expect(boxes.sheet!.right, 'the drawer against the window\'s right edge').toBe(width)
      const close = await sheet.getByRole('button', { name: CLOSE_MENU }).boundingBox()
      expect(close!.x + close!.width, 'its close control clear of the right notch').toBeLessThanOrEqual(width - side + 0.5)
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(menu).toBeFocused()
      expect(external).toEqual([])
    })
  }

  test('a11y-off at 390 by 844 and 844 by 390: a phone\'s safe areas move nothing of today\'s site, which reads none of them; the header, the main, the footer and the page\'s length are where they are with none', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'the site as it is today, on a11y-off')
    const layout = () =>
      page.evaluate((site) => {
        const box = (el: Element | null) => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return [r.left, r.top, r.width, r.height]
        }
        return {
          header: box(document.querySelector(site.header)),
          main: box(document.querySelector('main')),
          footer: box(document.querySelector(site.footer)),
          heading: box(document.querySelector('main h1')),
          body: getComputedStyle(document.body).padding,
          page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
          dock: document.querySelector(site.dock) !== null,
        }
      }, SITE)
    for (const [width, height, insets] of [[390, 844, { top: 47, bottom: 34, left: 0, right: 0 }], [844, 390, { top: 0, bottom: 21, left: 47, right: 47 }]] as const) {
      await page.setViewportSize({ width, height })
      await openAbout(page)
      const plain = await layout()
      expect(plain.dock).toBe(false)
      await safeAreas(page, insets)
      await frames(page)
      expect(await layout(), `${width} by ${height}`).toEqual(plain)
      await safeAreas(page, { top: 0, bottom: 0, left: 0, right: 0 })
    }
    expect(external).toEqual([])
  })

  test('a11y-on, the window turned with the sheet open, as a phone turns: opened by the app bar\'s Menu button at 667 by 375, where the dock hides, the sheet stays open as the window turns to 375 by 667 and stops above the dock, the Menu tab reading Close and naming it, and Esc gives the focus to the Menu tab; opened by the Menu tab, it stays open as the window turns back, over the whole window, the app bar\'s Menu button saying it is open, and Esc gives the focus to that button', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [667, 375], 'the app bar, its sheet and the dock as a phone turns')
    await page.setViewportSize({ width: 667, height: 375 })
    await openHome(page)
    await expect(dock(page)).toHaveCount(0)
    const first = await openSheet(page)
    expect(await first.menu.evaluate((el, site) => !!el.closest(site.header), SITE), 'opened by the app bar\'s own Menu button').toBe(true)
    const id = await first.sheet.getAttribute('id')
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(dock(page)).toHaveCount(1)
    await expect(menuSheet(page)).toHaveCount(1)
    await expect(menuTab(page)).toHaveText(CLOSE_TAB)
    expect(await menuTab(page).evaluate((el) => [el.getAttribute('aria-expanded'), el.getAttribute('aria-controls')])).toEqual(['true', id])
    expect(await barMenus(page), 'the app bar beside the tab bar, its Menu button gone').toEqual([])
    const dockTop = await dock(page).evaluate((el) => el.getBoundingClientRect().top)
    await expect.poll(async () => (await sheetBoxes(page)).sheet?.bottom, 'the sheet down to the dock\'s top').toBe(dockTop)
    await page.keyboard.press('Escape')
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(menuTab(page), 'the focus on the Menu tab, the button that opened the sheet gone').toBeFocused()
    // And the other way: opened by the Menu tab, the window turned on its side.
    const second = await openSheet(page)
    await page.setViewportSize({ width: 667, height: 375 })
    await expect(dock(page)).toHaveCount(0)
    await expect(menuSheet(page)).toHaveCount(1)
    expect(await barMenus(page)).toEqual([{ expanded: 'true', controls: await second.sheet.getAttribute('id') }])
    await expect.poll(async () => (await sheetBoxes(page)).sheet, 'the sheet over the whole window, no dock to stop above').toEqual({ top: 0, bottom: 375, left: 0, right: 667 })
    await page.keyboard.press('Escape')
    await expect(menuSheet(page)).toHaveCount(0)
    await expect.poll(() => onBarMenu(page), 'the focus on the app bar\'s Menu button, the Menu tab gone with the dock').toBe(true)
    expect(external).toEqual([])
  })

  test('a11y-on, the window crossing 768 pixels with the sheet open: opened by the Menu tab at 390 it is the tablet header\'s drawer at 900, and Esc gives the focus to that header\'s Menu button; opened by that button it is the sheet above the tab bar at 390, and Esc gives the focus to the Menu tab, as a press on the Close tab does once the window has crossed and come back', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390, 900], 'the app bar, the tablet header and the dock')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHome(page)
    const close = menuSheet(page).getByRole('button', { name: CLOSE_MENU })
    await openSheet(page)
    await page.setViewportSize({ width: 900, height: 844 })
    await expect(menuSheet(page)).toHaveAttribute('data-shape', 'drawer')
    await expect(close).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(siteHeader(page).getByRole('button', { name: NEW_NAMES.menu, exact: true }), 'the focus on the tablet header\'s Menu button, the Menu tab gone with the dock').toBeFocused()
    await openSheet(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(menuSheet(page)).toHaveAttribute('data-shape', 'full')
    await expect(close).toBeFocused()
    await expect(menuTab(page)).toHaveText(CLOSE_TAB)
    await page.keyboard.press('Escape')
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(menuTab(page), 'the focus on the Menu tab, the tablet header\'s button gone').toBeFocused()
    // Opened, the window across 768 and back, then closed by a press on the Close tab.
    await openSheet(page)
    await page.setViewportSize({ width: 900, height: 844 })
    await expect(menuSheet(page)).toHaveAttribute('data-shape', 'drawer')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(menuSheet(page)).toHaveAttribute('data-shape', 'full')
    await expect(close).toBeFocused()
    await pressAt(page, menuTab(page))
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(menuTab(page)).toBeFocused()
    await expect(menuTab(page)).toHaveText(NEW_NAMES.menu)
    expect(external).toEqual([])
  })

  for (const [from, to, what] of [[[744, 1133], [1133, 744], 'a small tablet held upright, turned on its side'], [[390, 844], [1280, 844], 'a phone\'s window widened in one step']] as const) {
    test(`a11y-on, the sheet open from the Menu tab at ${from[0]} by ${from[1]}, ${what}, to ${to[0]} by ${to[1]}: the sheet closes as the window reaches the desktop form, which has no Menu button, and the focus goes to the desktop header's brand link, never the page's body, as it does when the drawer closes at 1024`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [from[0], to[0]], 'the app bar, the dock and the desktop header')
      await page.setViewportSize({ width: from[0], height: from[1] })
      await openHome(page)
      await expect(tabBar(page)).toHaveCount(1)
      await openSheet(page)
      await page.setViewportSize({ width: to[0], height: to[1] })
      await expect(siteHeader(page)).toHaveAttribute('data-form', 'desktop')
      await expect(menuSheet(page)).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(brandLink(page), 'the focus on the brand link of the banner now drawn').toBeFocused()
      expect(await focused(page)).not.toBe('body')
      expect(external).toEqual([])
    })
  }

  test('a11y-on, the reflow fallback\'s lines as the browser reads its media query: the dock at 390 by 480 and at 300 by 640, the app bar at the top with no Menu button of its own; none at 390 by 479 and at 299 by 640, the app bar in the page\'s flow with its Menu button', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390, 300, 299], 'the app bar and the dock in and out of the reflow fallback')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHome(page)
    const barNow = () =>
      page.evaluate((site) => {
        const header = document.querySelector(site.header)!
        return { slot: header.getAttribute('data-slot'), position: getComputedStyle(header).position, menus: header.querySelectorAll('button[aria-haspopup="dialog"]').length }
      }, SITE)
    for (const [width, height, drawn] of [[390, 480, true], [390, 479, false], [300, 640, true], [299, 640, false], [300, 480, true]] as const) {
      await page.setViewportSize({ width, height })
      await expect(dock(page), `${width} by ${height}`).toHaveCount(drawn ? 1 : 0)
      expect(await barNow(), `${width} by ${height}`).toEqual({ slot: 'app-bar', position: drawn ? 'sticky' : 'static', menus: drawn ? 0 : 1 })
      expect((await roomNow(page)).written[1], `${width} by ${height}: --bottom-chrome-h`).toBe(drawn ? '57px' : '')
    }
    expect(external).toEqual([])
  })

  test('a11y-on on /tournaments at 320, 359, 360 and 390 by 844, light and dark: the tab bar\'s words at 11 pixels under 360 and at 12 from it, the same words, each on one line inside its tab, the current one bold; every tab at least 44 by 44; and the line above the tab bar the look\'s hairline, 1 pixel, never the board\'s #d9d8d1', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [320, 359, 360, 390], 'the tab bar beside the app bar')
    const words = ['Tournaments', CHROME_NAMES.clubs, CHROME_NAMES.logIn, NEW_NAMES.menu]
    /** The look's hairline as the browser computes it, light and dark; the board's line, #d9d8d1, would be rgb(217, 216, 209). */
    const HAIRLINE = { light: 'rgb(229, 231, 237)', dark: 'rgba(255, 255, 255, 0.08)' } as const
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const width of [320, 359, 360, 390]) {
        await page.setViewportSize({ width, height: 844 })
        await openDrawn(page, '/tournaments', [page.locator('main').getByRole('button', { name: /Fixture Fall Open/ }).first()])
        await page.evaluate(() => document.fonts.ready)
        const drawn = await tabBar(page).evaluate((nav) => {
          const s = getComputedStyle(nav)
          return {
            line: [s.borderTopWidth, s.borderTopStyle, s.borderTopColor],
            tabs: [...nav.querySelectorAll('a, button')].map((tab) => {
              const label = tab.querySelector(':scope > span:not([data-slot])') as HTMLElement
              const range = document.createRange()
              range.selectNodeContents(label)
              const b = tab.getBoundingClientRect()
              return {
                words: (label.textContent ?? '').trim(),
                size: getComputedStyle(label).fontSize,
                weight: getComputedStyle(label).fontWeight,
                lines: new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size,
                inside: label.scrollWidth <= Math.ceil(label.getBoundingClientRect().width) && label.getBoundingClientRect().width <= b.width,
                box: [b.width, b.height],
                current: tab.getAttribute('aria-current'),
              }
            }),
          }
        })
        const what = `${scheme} ${width}`
        seen[what] = drawn
        expect(drawn.line, `${what}: the hairline above the tab bar`).toEqual(['1px', 'solid', HAIRLINE[scheme]])
        expect(drawn.tabs.map((t) => t.words), what).toEqual(words)
        for (const tab of drawn.tabs) {
          expect(tab.size, `${what}: ${tab.words}`).toBe(width < 360 ? '11px' : '12px')
          expect(tab.lines, `${what}: ${tab.words} on one line`).toBe(1)
          expect(tab.inside, `${what}: ${tab.words} inside its tab`).toBe(true)
          expect(Math.min(...tab.box), `${what}: ${tab.words} at least 44 by 44`).toBeGreaterThanOrEqual(44)
          expect(tab.weight, `${what}: ${tab.words}`).toBe(tab.current === 'page' ? '700' : '500')
        }
        expect(drawn.tabs.filter((t) => t.current === 'page').map((t) => t.words), what).toEqual(['Tournaments'])
      }
    }
    await testInfo.attach('tab-bar-words-at-the-360-step.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('each build serves the pages the server writes a preview into with the one viewport tag of its shell: viewport-fit=cover on a11y-on, where the chrome is on, and today\'s tag on a11y-off, for an event, a club, a news post and an address the site does not have', async ({ request, external }, testInfo) => {
    const want = ({ [ON]: 'width=device-width, initial-scale=1.0, viewport-fit=cover', [OFF]: 'width=device-width, initial-scale=1.0' } as Record<string, string>)[testInfo.project.name]
    expect(want, `a viewport tag listed for ${testInfo.project.name}`).toBeDefined()
    for (const route of ['/tournaments/fx-t-open', '/clubs/fx-club-capital', '/news/fx-post-recap', '/not-a-page-of-the-site']) {
      const response = await request.get(route)
      expect(response.status(), route).toBe(200)
      const html = await response.text()
      expect([...html.matchAll(/<meta name="viewport" content="([^"]*)"/g)].map((m) => m[1]), route).toEqual([want])
    }
    // The event's page is the one the server wrote its preview into.
    expect(await (await request.get('/tournaments/fx-t-open')).text()).toContain('content="Fixture Fall Open"')
    expect(external).toEqual([])
  })

  test('a11y-on at 390 by 844: the dock comes back, its height written again, once a field that held the focus is taken out of the page, and once the visual viewport is whole again after the keyboard\'s rule hid it', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHome(page)
    await expect(dock(page)).toHaveCount(1)
    expect((await roomNow(page)).written[1]).toBe('57px')
    // A field of the page's own, put in the page and taken out while it holds the focus, as a form that closes takes its field.
    await page.evaluate(() => {
      const field = document.createElement('input')
      field.setAttribute('aria-label', 'A field the test plants')
      document.querySelector('main')!.prepend(field)
    })
    const field = page.getByLabel('A field the test plants')
    await field.focus()
    await expect(dock(page), 'the field holds the focus').toHaveCount(0)
    expect((await roomNow(page)).written[1]).toBe('')
    await field.evaluate((el) => el.remove())
    await expect(dock(page), 'the field gone from the page').toHaveCount(1)
    expect((await roomNow(page)).written[1]).toBe('57px')
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
    // The keyboard's rule by the visual viewport: hidden, then back, its height written again.
    await lowerViewport(page, 200)
    await expect(dock(page), 'the visual viewport 200 pixels shorter').toHaveCount(0)
    expect((await roomNow(page)).written[1]).toBe('')
    await lowerViewport(page, null)
    await expect(dock(page), 'the visual viewport whole again').toHaveCount(1)
    expect(await roomNow(page)).toEqual({ written: ['56px', '57px'], padding: ['56px', '57px'] })
    expect(external).toEqual([])
  })

  for (const [width, height] of [[390, 844], [320, 568]] as const) {
    test(`a11y-on at ${width} by ${height}, Shift+Tab from the Menu tab back up to the top of the page, with the tab bar alone and with an action bar of 64 pixels planted in the dock: every control of the page the focus lands on is clear of the app bar and of the dock; with no room kept at the page's top, one is left under the app bar`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
      onlyNew(testInfo, 'header', [width], 'the app bar and the dock')
      test.setTimeout(120_000)
      await page.setViewportSize({ width, height })
      const seen: Record<string, string[]> = {}
      for (const fixture of [false, true]) {
        const what = `${width} by ${height}${fixture ? ' with the action bar' : ''}`
        await openHome(page)
        if (fixture) {
          expect(await plantActionBar(page)).toBe(true)
          await expect.poll(() => roomNow(page).then((r) => r.written[1])).toBe(`${57 + ACTION_BAR_H}px`)
        }
        await menuTab(page).focus()
        const stops = await walkBack(page)
        const inPage = stops.filter((s) => s.part === 'page')
        seen[what] = stops.map((s) => `${s.part}: ${s.name} ${Math.round(s.box.top)} to ${Math.round(s.box.bottom)}`)
        expect(stops.at(-1)?.part, `${what}: the walk ends in the app bar`).toBe('bar')
        expect(inPage.length, `${what}: the page's controls`).toBeGreaterThan(20)
        for (const stop of inPage) {
          expect(!!stop.bar && overlap(stop.box, stop.bar), `${what}: ${stop.name} under the app bar`).toBe(false)
          expect(!!stop.dock && overlap(stop.box, stop.dock), `${what}: ${stop.name} under the dock`).toBe(false)
          expect(stop.box.bottom > 0 && stop.box.top < height, `${what}: ${stop.name} in the window`).toBe(true)
        }
      }
      // The walk is not blind: with no room kept at the page's top, a control the focus moves up to is left under the app bar.
      await openHome(page)
      await page.addStyleTag({ content: ':root[data-look="new"] { scroll-padding-top: 0px !important; }' })
      await menuTab(page).focus()
      const unpadded = (await walkBack(page)).filter((s) => s.part === 'page' && !!s.bar && overlap(s.box, s.bar))
      expect(unpadded.length, 'with no room at the top: controls left under the app bar').toBeGreaterThan(0)
      await testInfo.attach(`shift-tab-${width}-by-${height}.json`, { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
      expect(external).toEqual([])
    })
  }

  test('a11y-on, the page scrolled 600 pixels in a window 800 tall: Tab onto each control of the sticky bar moves the page by 0 pixels, the desktop header\'s at 1280, the tablet header\'s at 900 and the app bar\'s at 390, and so does Tab from the footer onto each tab; with the room at the page\'s top kept while the focus is in the bar, the page moves', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the new chrome\'s bars come with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [1280, 900, 390], 'the desktop header, the tablet header and the app bar')
    test.setTimeout(120_000)
    const scrolled = () => page.evaluate(() => window.scrollY)
    /** Tab from the skip link through the bar's own controls, the page scrolled 600 pixels: where the page is at each control of the bar. */
    const throughTheBar = async () => {
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
      await frames(page)
      expect(await scrolled()).toBe(600)
      const seen: Array<{ name: string; scrolled: number }> = []
      for (let n = 0; n < 30; n++) {
        await page.keyboard.press('Tab')
        const at = await stopNow(page)
        if (at === null || at.part === 'skip') continue
        if (at.part !== 'bar') break
        seen.push({ name: at.name, scrolled: await scrolled() })
      }
      return seen
    }
    const record: Record<string, unknown> = {}
    for (const [width, controls] of [[1280, 6], [900, 6], [390, 1]] as const) {
      await page.setViewportSize({ width, height: 800 })
      await openHome(page)
      const seen = await throughTheBar()
      record[String(width)] = seen
      expect(seen.length, `${width}: the bar's controls reached`).toBeGreaterThanOrEqual(controls)
      for (const stop of seen) expect(stop.scrolled, `${width}: Tab onto ${stop.name}`).toBe(600)
      // The reading is not blind: with the room at the top kept while the focus is in the bar, Tab onto it moves the page.
      await openHome(page)
      const style = await page.addStyleTag({ content: ':root[data-look="new"] { scroll-padding-top: var(--header-h, 0px) !important; }' })
      const moved = await throughTheBar()
      record[`${width} with the room kept`] = moved
      expect(moved.some((stop) => stop.scrolled !== 600), `${width}: with the room kept, Tab onto the bar moves the page`).toBe(true)
      await style.evaluate((el) => (el as HTMLStyleElement).remove())
    }
    // Tab from the footer's last control onto each tab moves nothing: the tab bar is fixed to the window.
    await page.setViewportSize({ width: 390, height: 800 })
    await openHome(page)
    await page.evaluate((site) => {
      const all = [...document.querySelector(site.footer)!.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      all.at(-1)!.focus()
    }, SITE)
    await frames(page)
    const atFooter = await scrolled()
    const tabs: string[] = []
    for (let n = 0; n < 4; n++) {
      await page.keyboard.press('Tab')
      const at = await stopNow(page)
      expect(at?.part, `Tab ${n + 1} from the footer`).toBe('dock')
      tabs.push(at!.name)
      expect(await scrolled(), `Tab onto ${at!.name}`).toBe(atFooter)
    }
    expect(tabs).toEqual(['a Tournaments', `a ${CHROME_NAMES.clubs}`, `a ${CHROME_NAMES.logIn}`, `button ${NEW_NAMES.menu}`])
    await testInfo.attach('tab-onto-the-bars.json', { body: JSON.stringify(record, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })

  test('a11y-on at 390 by 844 with an action bar of 64 pixels planted in the dock: the sheet the Menu tab opens, and its scrim, stop at the taller dock\'s top, so the tab bar and the bar above it stay in view and undimmed', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the app bar\'s sheet above the dock')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHome(page)
    expect(await plantActionBar(page)).toBe(true)
    const dockH = 57 + ACTION_BAR_H
    await expect.poll(() => roomNow(page).then((r) => r.written[1])).toBe(`${dockH}px`)
    await openSheet(page)
    expect(await sheetBoxes(page)).toEqual({ sheet: { top: 0, bottom: 844 - dockH, left: 0, right: 390 }, scrim: { top: 0, bottom: 844 - dockH, left: 0, right: 390 } })
    // The planted bar and the tab bar lie wholly under the sheet's foot, in the window: nothing of the sheet or its scrim over them.
    // (The open sheet holds the page's presses, so a hit test would find the page's root there, not the bar.)
    const under = await page.evaluate((site) => {
      const box = (el: Element | null) => {
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom }
      }
      return { bar: box(document.querySelector('[data-fixture="action-bar"]')), tabBar: box(document.querySelector(site.tabBar)) }
    }, SITE)
    expect(under, 'the planted bar and the tab bar in view under the sheet').toEqual({ bar: { top: 844 - dockH, bottom: 844 - 57 }, tabBar: { top: 844 - 57, bottom: 844 } })
    await page.keyboard.press('Escape')
    await expect(menuSheet(page)).toHaveCount(0)
    await expect(menuTab(page)).toBeFocused()
    expect(external).toEqual([])
  })

  test('a11y-on at 390 and 320 by 844, signed in as a member whose membership has run out: the tab bar\'s third tab is My LCA, and Donate is still the first of the sheet\'s three buttons, before My LCA and Renew, two taps from the Menu tab; its dialog gives the focus back to the Menu tab as it closes', async ({ page, external, baseURL }, testInfo) => {
    only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390, 320], 'the tab bar and the app bar\'s sheet for someone signed in')
    const visit = await signInAs(page, navPersona('expired-member'), baseURL!)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/clubs')
      await expect(siteHeader(page)).toBeVisible()
      await waitForMemberAnswers(visit)
      await expect(tabBar(page).locator('a, button'), visit.notRead).toHaveText(['Tournaments', CHROME_NAMES.clubs, NEW_NAMES.myLca, NEW_NAMES.menu])
      const { sheet } = await openSheet(page)
      const buttons = sheet.locator('[data-slot="menu-sheet-buttons"] > *')
      await expect(buttons, `${width}`).toHaveText([NEW_NAMES.donate, NEW_NAMES.myLca, NEW_NAMES.renew])
      // The second tap: Donate.
      await pressAt(page, buttons.first())
      const dialog = page.getByRole('dialog', { name: DONATION })
      await expect(dialog).toBeVisible()
      await expect(menuSheet(page)).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(menuTab(page), `${width}: the focus back on the Menu tab`).toBeFocused()
    }
    expect(visit.signInCalls).toEqual([])
    expect(external).toEqual([])
  })
})

test.describe('the tab bar under a finger (WS02 step 7)', () => {
  test.use({ reducedMotion: 'reduce', hasTouch: true })

  test('a11y-on at 390 by 844 with a touch screen: a tap on the Menu tab opens the sheet, a tap on the Close tab beside it closes it and opens nothing, the focus back on the Menu tab, which reads Menu again, the page where it was; and a tap opens it again', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the tab bar comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the tab bar beside the app bar')
    await page.setViewportSize({ width: 390, height: 844 })
    await openHome(page)
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
    await frames(page)
    const tap = async (control: Locator) => {
      const box = await control.boundingBox()
      expect(box, 'the control drawn').not.toBeNull()
      await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2)
    }
    const where = () => page.evaluate(() => [location.pathname, window.scrollY])
    const before = await where()
    for (let time = 1; time <= 2; time++) {
      await tap(menuTab(page))
      const sheet = menuSheet(page)
      await expect(sheet, `time ${time}`).toBeVisible()
      await expect(menuTab(page)).toHaveText(CLOSE_TAB)
      await expect(menuTab(page)).toHaveAttribute('aria-expanded', 'true')
      await tap(menuTab(page))
      await expect(sheet, `time ${time}: the tap on Close closes the sheet`).toHaveCount(0)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(menuTab(page), `time ${time}`).toBeFocused()
      await expect(menuTab(page)).toHaveText(NEW_NAMES.menu)
      await expect(menuTab(page)).toHaveAttribute('aria-expanded', 'false')
      expect(await where(), `time ${time}: the page where it was`).toEqual(before)
    }
    expect(external).toEqual([])
  })
})
