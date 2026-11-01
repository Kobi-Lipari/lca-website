// test/a11y/footer-edges.spec.ts
//
// The page around the new footer at an edge only a real browser shows (WS02
// step 8), on the a11y-on build, which has the chrome on: the phone's dock
// under the Menu sheet's scroll lock on a screen with a classic scrollbar,
// as a desktop browser on Windows draws one, 15 to 17 pixels wide, which
// headless Chromium and phones never draw unless asked to. This file asks:
// its tests run in a browser started without the switch that hides the
// window's scrollbars.
//
// - On / at 390 by 844, with the scrollbar drawn: opening the Menu sheet
//   from the Menu tab takes the page's scrollbar away while the sheet holds
//   the page still, and the dock keeps its box and its four tabs theirs,
//   through the class the lock gives the scrollbar's width as a margin; the
//   sheet and its scrim reach over the strip the scrollbar leaves, down to
//   the dock's top, and beside the dock that strip shows the page's own
//   ground, nothing of the page's words or controls; closing the sheet
//   gives the scrollbar back with the dock as it was.
// - The check sees the difference it is for: with the class taken off the
//   dock in the page, the same opening grows the dock by the scrollbar's
//   width.
//
// The dock and its tab bar are read through test/a11y/chrome.ts, and the
// check holds for the new chrome alone, so the test says so through it.
import type { Page, TestInfo } from '@playwright/test'
import { SITE, dock, menuSheet, menuTab, onlyNew } from './chrome'
import { expect, openDrawn, test } from './support'

const ON = 'a11y-on'

function only(testInfo: TestInfo, project: string, why = `checks the ${project} build`) {
  test.skip(testInfo.project.name !== project, why)
}

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** A box in the window's own pixels. */
interface Box {
  left: number
  right: number
  top: number
  bottom: number
  width: number
}

/**
 * The page as laid out now: the window's width and the scrollbar's, whether
 * the lock holds the page, the dock's box and each tab's, the sheet's and
 * its scrim's boxes while it is open, and what is drawn at the window's
 * right edge just above its foot, where the dock is and the scrollbar was.
 */
const layout = (page: Page) =>
  page.evaluate((site) => {
    const box = (el: Element | null): Box | null => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }
    }
    const drawnDock = document.querySelector(site.dock)
    const width = window.innerWidth
    // While the sheet is open the page under it takes no pointer, so what is drawn at a point is asked with the page
    // taking pointers again for that moment alone.
    const was = document.body.style.pointerEvents
    document.body.style.pointerEvents = 'auto'
    const at = document.elementFromPoint(width - 2, window.innerHeight - 10)
    document.body.style.pointerEvents = was
    return {
      window: width,
      scrollbar: width - document.documentElement.clientWidth,
      locked: document.body.hasAttribute('data-scroll-locked'),
      bodyMargin: getComputedStyle(document.body).marginRight,
      dock: box(drawnDock),
      tabs: [...document.querySelectorAll(`${site.tabBar} a, ${site.tabBar} button`)].map(box),
      sheet: box(document.querySelector('[data-slot="menu-sheet"]')),
      scrim: box(document.querySelector('[data-slot="menu-sheet-scrim"]')),
      strip: at ? at.tagName.toLowerCase() : null,
      stripInDock: !!(at && drawnDock?.contains(at)),
    }
  }, SITE)

/** Opens the Menu sheet with a press at the Menu tab's place, as a finger makes it, and waits for it to settle. */
async function openSheet(page: Page) {
  const box = await menuTab(page).boundingBox()
  expect(box, 'the Menu tab drawn').not.toBeNull()
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
  const sheet = menuSheet(page)
  await expect(sheet).toBeVisible()
  await sheet.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
  await frames(page)
}

/** Closes the sheet with Esc and waits for the page to have its scrollbar back. */
async function closeSheet(page: Page) {
  await page.keyboard.press('Escape')
  await expect(menuSheet(page)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.body.hasAttribute('data-scroll-locked'))).toBe(false)
  await frames(page)
}

// The browser is started without the switch that hides the window's scrollbars, the browser it would start otherwise:
// an option of the whole file, since it starts a browser of its own.
test.use({
  launchOptions: { ...(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}), ignoreDefaultArgs: ['--hide-scrollbars'] },
})

test.describe('the dock under the Menu sheet\'s scroll lock, with a classic scrollbar (WS02 step 8)', () => {
  test.use({ reducedMotion: 'reduce' })

  test('a11y-on at 390 by 844 on /: the sheet\'s lock takes the scrollbar away and the dock keeps its box and its tabs theirs, the sheet and its scrim reaching over the strip it leaves and the page\'s own ground beside the dock; closed, the scrollbar is back with the dock as it was; with the dock\'s class taken off, the dock grows by the scrollbar\'s width', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the dock comes with the chrome, on a11y-on')
    onlyNew(testInfo, 'header', [390], 'the dock beside the app bar')
    await page.setViewportSize({ width: 390, height: 844 })
    await openDrawn(page, '/', [page.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })])
    await page.evaluate(() => document.fonts.ready)
    await frames(page)
    await expect(dock(page)).toHaveCount(1)
    const seen: Record<string, unknown> = {}

    const before = await layout(page)
    seen.before = before
    // The window draws its scrollbar, and the dock spans the page beside it.
    expect(before.scrollbar, 'a classic scrollbar drawn').toBeGreaterThan(0)
    expect(before.locked).toBe(false)
    expect(before.dock!.left).toBe(0)
    expect(before.dock!.width).toBe(before.window - before.scrollbar)
    expect(before.tabs).toHaveLength(4)

    await openSheet(page)
    const open = await layout(page)
    seen.open = open
    // The lock takes the scrollbar away and gives the page, and the dock's class, its width as a margin.
    expect(open.locked).toBe(true)
    expect(open.scrollbar).toBe(0)
    expect(open.bodyMargin).toBe(`${before.scrollbar}px`)
    // The dock and its four tabs where they were.
    expect(open.dock).toEqual(before.dock)
    expect(open.tabs).toEqual(before.tabs)
    // The sheet and its scrim over the whole window above the dock, the strip the scrollbar left among it.
    for (const part of ['sheet', 'scrim'] as const) {
      expect(open[part], part).not.toBeNull()
      expect(open[part]!.left, part).toBe(0)
      expect(open[part]!.right, part).toBe(open.window)
      expect(Math.abs(open[part]!.bottom - open.dock!.top), part).toBeLessThanOrEqual(0.5)
    }
    // Beside the dock, the strip shows the page's own ground: nothing of its words or controls, and not the dock.
    expect(open.dock!.right).toBe(open.window - before.scrollbar)
    expect(open.stripInDock).toBe(false)
    expect(['html', 'body']).toContain(open.strip)

    await closeSheet(page)
    const closed = await layout(page)
    seen.closed = closed
    expect(closed.scrollbar).toBe(before.scrollbar)
    expect(closed.dock).toEqual(before.dock)
    expect(closed.tabs).toEqual(before.tabs)

    // Without its class, the same opening would grow the dock by the scrollbar's width, and its tabs would move.
    await dock(page).evaluate((el) => el.classList.remove('width-before-scroll-bar'))
    await openSheet(page)
    const bare = await layout(page)
    seen.withoutTheClass = bare
    expect(bare.locked).toBe(true)
    expect(bare.dock!.width).toBe(before.dock!.width + before.scrollbar)
    expect(bare.dock!.right).toBe(bare.window)
    expect(bare.tabs).not.toEqual(before.tabs)
    expect(bare.stripInDock).toBe(true)
    await closeSheet(page)

    await testInfo.attach('dock-under-the-scroll-lock.json', { body: JSON.stringify(seen, null, 2), contentType: 'application/json' })
    expect(external).toEqual([])
  })
})
