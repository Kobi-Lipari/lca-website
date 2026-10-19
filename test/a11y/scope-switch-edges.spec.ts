// test/a11y/scope-switch-edges.spec.ts
//
// A change of look in the browser at its edges (WS01 step 22), on both builds.
//
// - A phone-width page and a dark device move nothing on a switch either, and
//   a second pass through the four looks still reports no layout shift
//   (WS01 acceptance criterion 8).
// - The new colours are there in the very frame the attribute changes, with
//   no wait for a stylesheet, so a switch never shows the base colours first.
//   With newLook off the same switch changes no colour at all.
// - The container keeps its own box through a switch: the same width, the
//   same height and the same position for the container and the page.
//
// Reads only.
import type { Page } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const THEMES = ['live', 'scholastic', 'heritage', ''] as const

const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** Installs a layout-shift observer; the total so far is read with total(). */
async function observeShifts(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __shifts: number[] }
    w.__shifts = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__shifts.push((entry as unknown as { value: number }).value)
    }).observe({ type: 'layout-shift' })
  })
  return async () => {
    await frames(page)
    await page.waitForTimeout(250)
    return page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts.reduce((sum, v) => sum + v, 0))
  }
}

/** Every box on the page that a switch could move: the container, its controls, the heading and the table. */
function boxes(page: Page) {
  return page.locator('[data-fixture="base"]').evaluate((container) => {
    const box = (el: Element) => {
      const r = el.getBoundingClientRect()
      return [r.x, r.y, r.width, r.height]
    }
    const pick = (selector: string) => [...container.querySelectorAll(selector)].map(box)
    return {
      container: box(container),
      page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      heading: pick('h1'),
      buttons: pick('[data-slot="button"]'),
      input: pick('#fixture-input'),
      badges: pick('[data-status]'),
      table: pick('table'),
      rows: pick('tr'),
    }
  })
}

async function openBase(page: Page) {
  await page.goto('/__fixtures/base')
  await expect(page.locator('[data-fixture="base"]').getByRole('button', { name: 'Register' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await frames(page)
}

const switchTo = (page: Page, theme: string) =>
  page.locator('[data-fixture="base"]').evaluate((el, t) => el.setAttribute('data-theme', t), theme)

test.describe('a change of look on a phone and on a dark device', () => {
  for (const [label, options] of [
    ['a phone-width page', { colorScheme: 'light', viewport: { width: 375, height: 700 } }],
    ['a dark device', { colorScheme: 'dark', viewport: { width: 1280, height: 800 } }],
    ['a dark phone', { colorScheme: 'dark', viewport: { width: 360, height: 640 } }],
  ] as const) {
    test.describe(label, () => {
      test.use({ ...options, reducedMotion: 'reduce' })

      test('two passes through the four looks move no box and report no layout shift', async ({ page }) => {
        await openBase(page)
        if (options.colorScheme === 'dark' && test.info().project.name === ON) {
          await expect(page.locator('html')).toHaveClass(/\bdark\b/)
        }
        const total = await observeShifts(page)
        const before = await boxes(page)
        expect(before.buttons.length).toBe(4)
        expect(before.badges.length).toBe(3)
        for (let pass = 0; pass < 2; pass++) {
          for (const theme of THEMES) {
            await switchTo(page, theme)
            await frames(page)
            await page.evaluate(() => document.fonts.ready)
            expect(await boxes(page), `${label}, pass ${pass + 1}, data-theme="${theme}"`).toEqual(before)
          }
        }
        expect(await total(), 'layout shift').toBe(0)
      })
    })
  }
})

test.describe('the colours of a switch', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

  test('are in the frame the attribute changes, and with newLook off nothing changes colour', async ({ page }, testInfo) => {
    await openBase(page)
    const read = (theme: string) =>
      page.locator('[data-fixture="base"]').evaluate((el, t) => {
        el.setAttribute('data-theme', t)
        // Read in the same task as the change: no frame, no stylesheet, no wait.
        const s = getComputedStyle(el)
        return { ground: s.getPropertyValue('--ground').trim(), bg: s.backgroundColor, goldInk: s.getPropertyValue('--gold-ink').trim() }
      }, theme)

    const base = await read('')
    const seen = { live: await read('live'), scholastic: await read('scholastic'), heritage: await read('heritage'), back: await read('') }
    if (testInfo.project.name === ON) {
      expect(seen.live).toEqual({ ground: '#070b14', bg: 'rgb(7, 11, 20)', goldInk: '#c8a94a' })
      expect(seen.scholastic).toEqual({ ground: '#fffaf1', bg: 'rgb(255, 250, 241)', goldInk: '#866a1e' })
      expect(seen.heritage).toEqual({ ground: '#f7f3e8', bg: 'rgb(247, 243, 232)', goldInk: '#705718' })
      expect(seen.back).toEqual(base)
      expect(base).toEqual({ ground: '#fff', bg: 'rgb(255, 255, 255)', goldInk: '#866a1e' })
    } else {
      for (const [name, value] of Object.entries(seen)) expect(value, name).toEqual(base)
    }
  })

  test('an unknown data-theme value draws the base look', async ({ page }) => {
    await openBase(page)
    const bg = () => page.locator('[data-fixture="base"]').evaluate((el) => getComputedStyle(el).backgroundColor)
    const base = await bg()
    for (const theme of ['Live', 'news', 'heritage ', 'dark']) {
      await switchTo(page, theme)
      expect(await bg(), theme).toBe(base)
    }
  })

  test('the switch leaves the page text, its focus order and its landmarks as they were', async ({ page }) => {
    await openBase(page)
    const snapshot = () =>
      page.evaluate(() => ({
        text: document.body.innerText,
        headings: [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent),
        focusable: [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].map((e) => e.id || e.textContent?.trim() || e.tagName),
      }))
    const before = await snapshot()
    for (const theme of THEMES) {
      await switchTo(page, theme)
      await frames(page)
      expect(await snapshot(), `data-theme="${theme}"`).toEqual(before)
    }
  })
})
