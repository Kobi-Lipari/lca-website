// test/a11y/tokens.spec.ts
//
// The design tokens in the browser (WS01 step 21), on both builds.
//
// a11y-off (newLook off, the site as it is today):
// - <html> never gets data-look or .dark, even on a dark device with Dark
//   stored, and the page carries no head script for it
// - a focused Button draws today's ring exactly: the 3px half-strength grey
//   glow and border, no outline (measured on this build before the step)
// - Geist Mono is never fetched; font-mono keeps the device's stack
// - reduced motion leaves today's transitions as they are
//
// a11y-on (newLook on):
// - each look (base light and dark, live, scholastic, heritage, heritage in
//   dark mode) resolves to its tokens, and ink and muted text reach 4.5:1
// - a focused Button has the 2px --focus ring with a 2px gap, navy on light
//   grounds and gold on dark and live ones, at 3:1 or more on its ground
//   (WS01 acceptance criterion 3); the Appearance control in the navy footer
//   gets the gold ring, and so does a control inside data-ground="dark",
//   on the fixture page and (step 23) in the homepage hero and a club hero;
//   the menu the state filter opens in the /tournaments hero gives its
//   options the look's own ring back, in light and dark mode (step 23)
// - Appearance follows the device by default, can be set to Light or Dark,
//   keeps the choice across a reload, is applied before the app's script
//   runs (no flash), and a throwing localStorage leaves the page on the
//   device setting
// - figures in font-mono use Geist Mono; reduced motion stops transitions
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const APPEARANCE_KEY = 'lca-appearance'

/** Today's focused Button glow, measured on the a11y-off build before the token change. */
const TODAY_RING = 'oklab(0.708 0 0 / 0.5) 0px 0px 0px 3px'
const TODAY_RING_BORDER = 'oklch(0.708 0 0)'

const NAVY = 'rgb(26, 39, 68)'
const GOLD = 'rgb(200, 169, 74)'

function only(testInfo: TestInfo, project: string) {
  test.skip(testInfo.project.name !== project, `checks the ${project} build`)
}

/** [r, g, b] from a computed rgb() or rgba() colour. */
function rgb(colour: string): [number, number, number] {
  const m = colour.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/)
  if (!m) throw new Error(`not an rgb() colour: ${colour}`)
  if (m[4] !== undefined && Number(m[4]) !== 1) throw new Error(`not opaque: ${colour}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** WCAG 2.x contrast ratio of two computed rgb() colours. */
function ratio(a: string, b: string): number {
  const lum = (c: [number, number, number]) => {
    const [r, g, bl] = c.map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const la = lum(rgb(a))
  const lb = lum(rgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Gives the element keyboard focus, then waits for any transition to finish. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab')
  await target.focus()
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await target.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
}

/** The focus styles of an element. */
function ringOf(target: Locator) {
  return target.evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      boxShadow: s.boxShadow,
      borderColor: s.borderTopColor,
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
      outlineOffset: s.outlineOffset,
      outlineColor: s.outlineColor,
    }
  })
}

test.describe('newLook off: today\'s look is untouched', () => {
  test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('a dark device with Dark stored still gets no data-look, no .dark and no head script', async ({ page, request }, testInfo) => {
    only(testInfo, OFF)
    await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), APPEARANCE_KEY)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const html = await page.evaluate(() => ({
      look: document.documentElement.getAttribute('data-look'),
      className: document.documentElement.className,
      body: getComputedStyle(document.body).backgroundColor,
    }))
    expect(html).toEqual({ look: null, className: '', body: 'oklch(1 0 0)' })
    const served = await (await request.get('/')).text()
    expect(served).not.toContain(APPEARANCE_KEY)
    expect(served.match(/<script\b/g)).toHaveLength(1)
    await expect(page.getByRole('group', { name: 'Appearance' })).toHaveCount(0)
  })

  test('a focused Button draws today\'s ring on the fixture and the three pages', async ({ page }, testInfo) => {
    only(testInfo, OFF)
    const measured: Record<string, unknown> = {}
    for (const route of ['/__fixtures/base', '/', '/tournaments', '/membership']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const button = page.locator('main [data-slot="button"]:visible').first()
      expect(await button.getAttribute('data-variant'), route).not.toBe('destructive')
      await keyboardFocus(page, button)
      const ring = await ringOf(button)
      measured[route] = ring
      expect(ring.boxShadow, route).toContain(TODAY_RING)
      expect(ring.borderColor, route).toBe(TODAY_RING_BORDER)
      expect(ring.outlineStyle, route).toBe('none')
    }
    await testInfo.attach('focus-ring-today.json', { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
  })

  test('Geist Mono is never fetched, and figures keep the device\'s monospace stack', async ({ page }, testInfo) => {
    only(testInfo, OFF)
    const fonts: string[] = []
    page.on('request', (r) => {
      if (/geist-mono/i.test(r.url())) fonts.push(r.url())
    })
    await page.goto('/tournaments/fx-t-done')
    await page.waitForLoadState('networkidle')
    const mono = page.locator('main .font-mono').first()
    await expect(mono).toBeVisible()
    expect(await mono.evaluate((el) => getComputedStyle(el).fontFamily)).toBe(
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    )
    await page.evaluate(() => document.fonts.ready)
    expect(fonts).toEqual([])
  })

  test('reduced motion leaves today\'s transitions alone', async ({ page }, testInfo) => {
    only(testInfo, OFF)
    await page.goto('/__fixtures/base')
    const button = page.locator('[data-fixture] [data-slot="button"]').first()
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.15s')
  })
})

/** The looks to check: fixture name, device setting, and the colours expected. */
const LOOKS = [
  { name: 'base', scheme: 'light', ground: '#fff', ink: '#1a2744', muted: '#5b6478', focus: NAVY },
  { name: 'base', scheme: 'dark', ground: '#0b1220', ink: '#e8ecf4', muted: '#9aa6bf', focus: GOLD },
  { name: 'live', scheme: 'light', ground: '#070b14', ink: '#f3f5f9', muted: '#8e9ab2', focus: GOLD },
  { name: 'scholastic', scheme: 'light', ground: '#fffaf1', ink: '#1a2744', muted: '#4f5b75', focus: NAVY },
  { name: 'heritage', scheme: 'light', ground: '#f7f3e8', ink: '#1a2744', muted: '#5e5a52', focus: NAVY },
  { name: 'heritage', scheme: 'dark', ground: '#0b1220', ink: '#e8ecf4', muted: '#9aa6bf', focus: GOLD },
] as const

test.describe('newLook on: the looks', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  for (const look of LOOKS) {
    test(`${look.name} (${look.scheme} device): tokens, text contrast and the focus ring`, async ({ page }, testInfo) => {
      only(testInfo, ON)
      await page.emulateMedia({ colorScheme: look.scheme })
      await page.goto(`/__fixtures/${look.name}`)
      const container = page.locator(`[data-fixture="${look.name}"]`)
      await expect(container).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-look'))).toBe('new')

      const tokens = await container.evaluate((el) => {
        const s = getComputedStyle(el)
        return { ground: s.getPropertyValue('--ground').trim(), ink: s.getPropertyValue('--ink').trim(), muted: s.getPropertyValue('--ink-muted').trim(), bg: s.backgroundColor, color: s.color }
      })
      expect({ ground: tokens.ground, ink: tokens.ink, muted: tokens.muted }).toEqual({ ground: look.ground, ink: look.ink, muted: look.muted })

      const muted = await container.locator('header p').evaluate((el) => getComputedStyle(el).color)
      const inkRatio = ratio(tokens.color, tokens.bg)
      const mutedRatio = ratio(muted, tokens.bg)
      expect(inkRatio).toBeGreaterThanOrEqual(4.5)
      expect(mutedRatio).toBeGreaterThanOrEqual(4.5)

      const button = container.getByRole('button', { name: 'Register' })
      await keyboardFocus(page, button)
      const ring = await ringOf(button)
      expect(ring.outlineStyle).toBe('solid')
      expect(ring.outlineWidth).toBe('2px')
      expect(ring.outlineOffset).toBe('2px')
      expect(ring.outlineColor).toBe(look.focus)
      // The shadcn glow is off while the ring shows, so there is one ring, not two.
      const layers = ring.boxShadow === 'none' ? [] : ring.boxShadow.split(/,(?![^(]*\))/).map((l) => l.trim())
      expect(layers.every((l) => l.startsWith('rgba(0, 0, 0, 0)')), ring.boxShadow).toBe(true)
      const focusRatio = ratio(ring.outlineColor, tokens.bg)
      expect(focusRatio).toBeGreaterThanOrEqual(3)

      await testInfo.attach(`look-${look.name}-${look.scheme}.json`, {
        body: JSON.stringify({ tokens, muted, ring, inkRatio, mutedRatio, focusRatio }, null, 2),
        contentType: 'application/json',
      })
    })
  }

  test('figures in font-mono use Geist Mono, and the body keeps Geist', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.goto('/__fixtures/base')
    const cell = page.locator('main td.font-mono').first()
    expect(await cell.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"Geist Mono Variable", ui-monospace, .*monospace$/)
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.fonts.check('16px "Geist Mono Variable"', '3½'))).toBe(true)
    expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toBe('"Geist Variable", sans-serif')
  })

  test('reduced motion stops transitions; without it they run', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.goto('/__fixtures/base')
    const button = page.locator('[data-fixture] [data-slot="button"]').first()
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    expect(await button.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.15s')
  })
})

test.describe('newLook on: Appearance', () => {
  test.use({ reducedMotion: 'reduce' })

  const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains('dark'))
  const appearance = (page: Page) => page.getByRole('group', { name: 'Appearance' })

  test('follows the device by default, live as it changes', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    expect(await isDark(page)).toBe(true)
    await expect(appearance(page).getByRole('button', { name: 'System' })).toHaveAttribute('aria-pressed', 'true')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => isDark(page)).toBe(false)
  })

  test('can be set to Dark or Light, keeps the choice across a reload, and System hands back to the device', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    await appearance(page).getByRole('button', { name: 'Dark' }).click()
    expect(await isDark(page)).toBe(true)
    await expect(appearance(page).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')
    expect(await page.evaluate((k) => window.localStorage.getItem(k), APPEARANCE_KEY)).toBe('dark')
    await page.reload()
    expect(await isDark(page)).toBe(true)
    await expect(appearance(page).getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true')

    await page.emulateMedia({ colorScheme: 'dark' })
    await appearance(page).getByRole('button', { name: 'Light' }).click()
    expect(await isDark(page)).toBe(false)
    await page.reload()
    expect(await isDark(page)).toBe(false)

    await appearance(page).getByRole('button', { name: 'System' }).click()
    expect(await isDark(page)).toBe(true)
    expect(await page.evaluate((k) => window.localStorage.getItem(k), APPEARANCE_KEY)).toBeNull()
  })

  test('is applied before the app\'s script runs, so the page never flashes light', async ({ page, request }, testInfo) => {
    only(testInfo, ON)
    const served = await (await request.get('/')).text()
    const head = served.slice(served.indexOf('<head>') + '<head>'.length).trimStart()
    expect(head.startsWith('<script>')).toBe(true)
    expect(head.indexOf(APPEARANCE_KEY)).toBeLessThan(head.indexOf('type="module"'))

    // Without the app's script at all, the page is still drawn dark.
    await page.route(/\/assets\/index-[\w-]+\.js$/, (route) => route.abort())
    await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), APPEARANCE_KEY)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/', { waitUntil: 'load' })
    const state = await page.evaluate(() => ({
      look: document.documentElement.getAttribute('data-look'),
      dark: document.documentElement.classList.contains('dark'),
      body: getComputedStyle(document.body).backgroundColor,
      app: document.getElementById('root')?.childElementCount ?? 0,
    }))
    expect(state).toEqual({ look: 'new', dark: true, body: 'rgb(11, 18, 32)', app: 0 })
  })

  test('a localStorage that throws leaves the page on the device setting, and a choice still applies for the visit', async ({ page }, testInfo) => {
    only(testInfo, ON)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError')
        },
      })
    })
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/')
    await expect(appearance(page)).toBeVisible()
    expect(await isDark(page)).toBe(true)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.reload()
    await expect(appearance(page)).toBeVisible()
    expect(await isDark(page)).toBe(false)
    await appearance(page).getByRole('button', { name: 'Dark' }).click()
    expect(await isDark(page)).toBe(true)
    expect(errors).toEqual([])
  })

  test('the control in the navy footer gets the gold ring, at 3:1 or more on navy', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')
    const system = appearance(page).getByRole('button', { name: 'System' })
    await system.scrollIntoViewIfNeeded()
    await keyboardFocus(page, system)
    const ring = await ringOf(system)
    const footer = await page.locator('footer').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(ring.outlineColor).toBe(GOLD)
    expect(ring.outlineWidth).toBe('2px')
    expect(footer).toBe(NAVY)
    expect(ratio(ring.outlineColor, footer)).toBeGreaterThanOrEqual(3)
  })

  test('a dark ground marked data-ground="dark" gets the gold ring, at 3:1 or more on that ground', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/__fixtures/base')
    const container = page.locator('[data-fixture="base"]')
    const button = container.getByRole('button', { name: 'Register' })
    await keyboardFocus(page, button)
    expect((await ringOf(button)).outlineColor).toBe(NAVY)

    // A photo with a dark tint, like the homepage hero, is not a bg-lca-navy
    // box; the marker is what turns its ring gold.
    await container.evaluate((el) => {
      el.setAttribute('data-ground', 'dark')
      el.style.backgroundColor = 'rgb(11, 18, 32)'
    })
    await keyboardFocus(page, button)
    const ring = await ringOf(button)
    const ground = await container.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(ring.outlineColor).toBe(GOLD)
    expect(ring.outlineWidth).toBe('2px')
    expect(ratio(ring.outlineColor, ground)).toBeGreaterThanOrEqual(3)
  })

  test('the homepage hero and a club page hero, marked data-ground="dark" in step 23, give their links the gold ring', async ({ page }, testInfo) => {
    only(testInfo, ON)
    await page.emulateMedia({ colorScheme: 'light' })
    for (const [route, name] of [['/', 'Join LCA'], ['/clubs/fx-club-north', 'All clubs']] as const) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const ground = page.locator('[data-ground="dark"]')
      await expect(ground, route).toHaveCount(1)
      const link = ground.getByRole('link', { name })
      await keyboardFocus(page, link)
      const ring = await ringOf(link)
      expect(ring.outlineColor, route).toBe(GOLD)
      expect(ring.outlineWidth, route).toBe('2px')
    }
    // The club hero's navy is an inline style, so its ground can be read: gold on it is 6.51:1.
    const hero = await page.locator('[data-ground="dark"]').evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(hero).toBe(NAVY)
    expect(ratio(GOLD, hero)).toBeGreaterThanOrEqual(3)
  })

  test('the menu the state filter opens in the /tournaments hero gives its options the look\'s own ring, light and dark', async ({ page }, testInfo) => {
    only(testInfo, ON)
    const measured: Record<string, unknown> = {}
    // The menu is --popover: white in the light look, navy in dark mode.
    for (const [scheme, own, ground] of [['light', NAVY, 'rgb(255, 255, 255)'], ['dark', GOLD, NAVY]] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto('/tournaments')
      await page.waitForLoadState('networkidle')
      const hero = page.locator('main section.bg-brand-navy').first()
      const filter = hero.getByRole('button', { name: /^Louisiana \(\d+\)$/ })
      await keyboardFocus(page, filter)
      // The filter itself sits on the navy hero and keeps the gold ring.
      expect((await ringOf(filter)).outlineColor, scheme).toBe(GOLD)
      await page.keyboard.press('Enter')
      // The menu is drawn inside the hero, so the band's gold rule reaches it; the menu's own rule wins.
      const option = hero.getByRole('button', { name: /^Mississippi \(\d+\)$/ })
      await expect(option, scheme).toBeVisible()
      await keyboardFocus(page, option)
      const ring = await ringOf(option)
      const menu = await option.evaluate((el) => getComputedStyle(el.parentElement!).backgroundColor)
      measured[scheme] = { ring, menu, ratio: ratio(ring.outlineColor, menu) }
      expect(menu, scheme).toBe(ground)
      expect(ring.outlineColor, scheme).toBe(own)
      expect(ring.outlineWidth, scheme).toBe('2px')
      expect(ratio(ring.outlineColor, menu), scheme).toBeGreaterThanOrEqual(3)
    }
    await testInfo.attach('filter-menu-ring.json', { body: JSON.stringify(measured, null, 2), contentType: 'application/json' })
  })
})
