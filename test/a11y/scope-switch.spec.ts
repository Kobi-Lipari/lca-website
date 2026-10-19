// test/a11y/scope-switch.spec.ts
//
// A change of look in the browser (WS01 step 22), on both builds.
//
// - Switching data-theme on the fixture container among live, scholastic,
//   heritage and base ("") moves nothing: the boxes of the Buttons, the text
//   field and the status badges stay exactly where they were, and a
//   layout-shift observer installed before the first switch reports 0
//   (WS01 acceptance criterion 8). The switch is made by the test, on the
//   container itself, after the page's fonts are ready. The observer is
//   shown to work by a deliberate shift at the end.
//   On a11y-on (newLook on) every switch changes the token colours: the
//   ground, the ink on the primary Button, the field border and the gold
//   ink. On a11y-off (newLook off) the scopes have no tokens of their own,
//   so the colours stay as they are today.
// - The live look's font file (live.css) is fetched only when a live scope
//   renders: not on the home page, nor on the base, heritage or scholastic
//   fixture. It declares the Barlow faces; nothing sets text in them yet, so
//   no font file is downloaded.
// - The scholastic fixture shows the grade band colour tiles, each with its
//   band's words; with newLook on each tile's text reaches 4.5:1 on its tile.
//
// Reads only.
import type { Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
/** The en dash in a grade band's name ("K" + RANGE + "5"), written as an escape so this file holds no dash. */
const RANGE = '\u2013'

/** [r, g, b] from a computed rgb() colour. */
function rgb(colour: string): [number, number, number] {
  const m = colour.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/)
  if (!m) throw new Error(`not an rgb() colour: ${colour}`)
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

/** The order the test switches the base fixture's container through. */
const SWITCHES = [
  { scope: 'live', theme: 'live' },
  { scope: 'scholastic', theme: 'scholastic' },
  { scope: 'heritage', theme: 'heritage' },
  { scope: 'base', theme: '' },
] as const

/** What each look's tokens resolve to with newLook on, light device (src/index.css). */
const EXPECTED_ON: Record<string, { ground: string; ink: string; field: string; goldInk: string; bg: string; button: string }> = {
  base: { ground: '#fff', ink: '#1a2744', field: '#7c8496', goldInk: '#866a1e', bg: 'rgb(255, 255, 255)', button: 'rgb(26, 39, 68)' },
  live: { ground: '#070b14', ink: '#f3f5f9', field: '#5f6d89', goldInk: '#c8a94a', bg: 'rgb(7, 11, 20)', button: 'rgb(243, 245, 249)' },
  scholastic: { ground: '#fffaf1', ink: '#1a2744', field: '#7c8496', goldInk: '#866a1e', bg: 'rgb(255, 250, 241)', button: 'rgb(26, 39, 68)' },
  heritage: { ground: '#f7f3e8', ink: '#1a2744', field: '#857d6b', goldInk: '#705718', bg: 'rgb(247, 243, 232)', button: 'rgb(26, 39, 68)' },
}

/** Waits for two frames, so a style change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/**
 * The boxes of the shared controls in the container (every Button, the text
 * field and each StatusBadge pill) and the colours that follow the tokens.
 */
function measure(page: Page) {
  return page.locator('[data-fixture="base"]').evaluate((container) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    }
    const buttons = [...container.querySelectorAll('[data-slot="button"]')]
    const input = container.querySelector('#fixture-input')!
    const badges = [...container.querySelectorAll('[data-status]')].map((s) => s.parentElement!)
    const s = getComputedStyle(container)
    const register = buttons.find((b) => b.textContent === 'Register')!
    return {
      theme: container.getAttribute('data-theme'),
      boxes: {
        buttons: buttons.map((b) => ({ text: b.textContent, ...box(b) })),
        input: box(input),
        badges: badges.map((b) => ({ text: b.textContent, ...box(b) })),
      },
      colours: {
        ground: s.getPropertyValue('--ground').trim(),
        ink: s.getPropertyValue('--ink').trim(),
        field: s.getPropertyValue('--field').trim(),
        goldInk: s.getPropertyValue('--gold-ink').trim(),
        bg: s.backgroundColor,
        color: s.color,
        button: getComputedStyle(register).backgroundColor,
        inputBorder: getComputedStyle(input).borderTopColor,
      },
    }
  })
}

test.describe('a change of look on the fixture container', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('switching data-theme among the four looks moves no box, and with newLook on changes the token colours', async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/__fixtures/base')
    const container = page.locator('[data-fixture="base"]')
    await expect(container.getByRole('button', { name: 'Register' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await frames(page)

    // Installed after the page has settled and before the first switch, so
    // it sees only what the switches do.
    await page.evaluate(() => {
      const w = window as unknown as { __shifts: number[] }
      w.__shifts = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__shifts.push((entry as unknown as { value: number }).value)
      }).observe({ type: 'layout-shift' })
    })
    const shifts = () => page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts)

    const before = await measure(page)
    expect(before.theme).toBe('')
    expect(before.boxes.buttons.map((b) => b.text)).toEqual(['Register', 'See details', 'Add to calendar', 'Read the rules'])
    expect(before.boxes.badges.map((b) => b.text)).toEqual(['Registration open', 'Opens soon', 'Registration closed'])

    const seen: Record<string, Awaited<ReturnType<typeof measure>>> = {}
    for (const { scope, theme } of SWITCHES) {
      await container.evaluate((el, t) => el.setAttribute('data-theme', t), theme)
      await frames(page)
      await page.evaluate(() => document.fonts.ready)
      await frames(page)
      const now = await measure(page)
      expect(now.theme, scope).toBe(theme)
      expect(now.boxes, `the boxes in the ${scope} look`).toEqual(before.boxes)
      seen[scope] = now
    }
    // Layout-shift entries arrive after the frame they happen in.
    await frames(page)
    await page.waitForTimeout(250)
    const total = (await shifts()).reduce((sum, v) => sum + v, 0)
    expect(total, 'layout shift over the four switches').toBe(0)

    if (testInfo.project.name === ON) {
      for (const { scope } of SWITCHES) {
        const want = EXPECTED_ON[scope]
        const got = seen[scope].colours
        expect({ ground: got.ground, ink: got.ink, field: got.field, goldInk: got.goldInk, bg: got.bg, button: got.button }, scope).toEqual(want)
      }
      // Each look draws a ground of its own.
      expect(new Set(SWITCHES.map(({ scope }) => seen[scope].colours.bg)).size).toBe(4)
      expect(seen.live.colours.inputBorder).not.toBe(seen.base.colours.inputBorder)
    } else {
      // newLook off: the scopes have no tokens of their own, so nothing changes colour.
      for (const { scope } of SWITCHES) expect(seen[scope].colours, scope).toEqual(before.colours)
    }

    // The observer does see a shift when something moves.
    await container.evaluate((el) => {
      const spacer = document.createElement('div')
      spacer.style.height = '40px'
      el.prepend(spacer)
    })
    await frames(page)
    await expect.poll(async () => (await shifts()).reduce((sum, v) => sum + v, 0)).toBeGreaterThan(0)

    await testInfo.attach('scope-switch.json', {
      body: JSON.stringify({ before, seen, total }, null, 2),
      contentType: 'application/json',
    })
    expect(errors).toEqual([])
  })

  test('the fixture container stays a real box that draws its ground, with data-theme set through the look', async ({ page }) => {
    for (const name of ['base', 'heritage', 'scholastic', 'live']) {
      await page.goto(`/__fixtures/${name}`)
      const container = page.locator(`[data-fixture="${name}"]`)
      await expect(container).toBeVisible()
      expect(await container.evaluate((el) => getComputedStyle(el).display), name).toBe('block')
      expect(await container.getAttribute('data-theme'), name).toBe(name === 'base' ? '' : name)
    }
  })
})

test.describe('the live look\'s fonts', () => {
  test('live.css is fetched only when a live scope renders, and no font file comes with it', async ({ page }) => {
    const sheets: string[] = []
    const fontFiles: string[] = []
    page.on('request', (r) => {
      const path = new URL(r.url()).pathname
      if (/^\/assets\/live-[\w-]+\.css$/.test(path)) sheets.push(path)
      if (/barlow/i.test(path)) fontFiles.push(path)
    })
    const declared = () => page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === 'Barlow Condensed'))

    for (const route of ['/', '/__fixtures/base', '/__fixtures/heritage', '/__fixtures/scholastic']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      expect(sheets, route).toEqual([])
      expect(await declared(), route).toBe(false)
    }

    await page.goto('/__fixtures/live')
    await expect(page.locator('[data-fixture="live"]')).toBeVisible()
    await page.waitForLoadState('networkidle')
    expect(sheets).toHaveLength(1)
    await expect.poll(declared).toBe(true)
    await page.evaluate(() => document.fonts.ready)
    expect(fontFiles.filter((f) => !/\.css$/.test(f))).toEqual([])
  })
})

test.describe('the scholastic grade band tiles', () => {
  test.use({ colorScheme: 'light' })

  test('each band colour sits beside its band\'s words, and only on the scholastic fixture', async ({ page }, testInfo) => {
    await page.goto('/__fixtures/scholastic')
    const container = page.locator('[data-fixture="scholastic"]')
    await expect(container.getByRole('heading', { level: 2, name: 'Grade band colors' })).toBeVisible()
    const tiles = container.locator('[data-band]')
    await expect(tiles).toHaveText([`K${RANGE}3Coral`, `K${RANGE}5Mint`, `K${RANGE}8Sky`, `K${RANGE}12Grape`, 'Gold tileTiles'])

    if (testInfo.project.name === ON) {
      const measured = await tiles.evaluateAll((els) =>
        els.map((el) => {
          const s = getComputedStyle(el)
          return { band: el.getAttribute('data-band'), color: s.color, bg: s.backgroundColor }
        }),
      )
      expect(measured).toEqual([
        { band: `K${RANGE}3`, color: 'rgb(178, 62, 26)', bg: 'rgb(255, 228, 218)' },
        { band: `K${RANGE}5`, color: 'rgb(31, 122, 85)', bg: 'rgb(220, 245, 233)' },
        { band: `K${RANGE}8`, color: 'rgb(37, 99, 201)', bg: 'rgb(227, 238, 255)' },
        { band: `K${RANGE}12`, color: 'rgb(106, 63, 193)', bg: 'rgb(238, 230, 255)' },
        { band: 'gold', color: 'rgb(112, 87, 24)', bg: 'rgb(253, 241, 204)' },
      ])
      for (const tile of measured) expect(ratio(tile.color, tile.bg), tile.band!).toBeGreaterThanOrEqual(4.5)
    }

    for (const name of ['base', 'heritage', 'live']) {
      await page.goto(`/__fixtures/${name}`)
      await expect(page.getByRole('heading', { level: 1, name: `Fixture: ${name}` })).toBeVisible()
      await expect(page.locator('[data-band]'), name).toHaveCount(0)
    }
  })
})
