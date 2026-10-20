// test/a11y/print-look.spec.ts
//
// A printed page takes the light look (WS01 step 24). The dark look, the
// live look and heritage in dark mode apply on screens only (@media screen in
// src/index.css), because paper is white and a browser prints no background
// unless asked: the dark look's light words would print light on white. Read
// on the print page of the seeded finished event, with a dark device:
//
// - a11y-on (newLook on): on the screen the page is dark, and the rating and
//   score beside each name on the pairing sheet (text-quiet-600) reach 4.5:1
//   on its ground; printed, the same page has the light look's tokens, a
//   white ground and those words in #5b6478, and the crosstable's ink and
//   muted words print navy and #5b6478, although .dark is still set;
// - a11y-off (newLook off): the rating and score are Tailwind's gray-600,
//   as before the step, on the screen and in print.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { ROOT } from './global-setup'
import { expect, test } from './support'

const SHEET = '/tournaments/fx-t-done/print?what=pairings&round=3'
const CROSSTABLE = '/tournaments/fx-t-done/print?what=crosstable'

/** Tailwind's own gray-600, which the rating and score were before step 24. */
const GRAY_600 = readFileSync(join(ROOT, 'node_modules/tailwindcss/theme.css'), 'utf8').match(/--color-gray-600:\s*([^;]+);/)![1].trim()

interface Seen {
  look: string | null
  dark: boolean
  ink: string
  /** The rating and score beside the first name on the sheet, and the ground under it. */
  words: string
  ground: string
  /** The same colours as Tailwind's gray-600, drawn by the browser. */
  gray600: string
}

/** Reads the colours of the pairing sheet. Runs in the browser. */
function readSheet(page: Page, gray600: string): Promise<Seen> {
  return page.evaluate((gray) => {
    const html = document.documentElement
    const words = document.querySelector('table tbody tr td:nth-child(2) span')
    if (!words) throw new Error('no rating beside a name on the sheet')
    // The ground: the first ancestor with an opaque background.
    let ground = 'rgba(0, 0, 0, 0)'
    for (let el: Element | null = words; el; el = el.parentElement) {
      const bg = getComputedStyle(el).backgroundColor
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        ground = bg
        break
      }
    }
    const probe = document.createElement('span')
    probe.style.color = gray
    document.body.append(probe)
    const gray600 = getComputedStyle(probe).color
    probe.remove()
    return {
      look: html.getAttribute('data-look'),
      dark: html.classList.contains('dark'),
      ink: getComputedStyle(html).getPropertyValue('--ink').trim(),
      words: getComputedStyle(words).color,
      ground,
      gray600,
    }
  }, gray600)
}

/** [r, g, b] from a computed rgb() colour. */
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

async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('table tbody tr').first()).toBeVisible()
}

test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

test('newLook on: the pairing sheet is dark on the screen, and printed it takes the light look', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'a11y-on', 'only the a11y-on build has the new look')
  await open(page, SHEET)
  const screen = await readSheet(page, GRAY_600)
  expect([screen.look, screen.dark]).toEqual(['new', true])
  expect(screen.ink).toBe('#e8ecf4')
  expect([screen.words, screen.ground]).toEqual(['rgb(154, 166, 191)', 'rgb(11, 18, 32)'])
  expect(ratio(screen.words, screen.ground)).toBeGreaterThanOrEqual(4.5)

  await page.emulateMedia({ media: 'print' })
  const printed = await readSheet(page, GRAY_600)
  // The device is still dark; only the screen-only rules stop applying.
  expect([printed.look, printed.dark]).toEqual(['new', true])
  expect(printed.ink).toBe('#1a2744')
  expect([printed.words, printed.ground]).toEqual(['rgb(91, 100, 120)', 'rgb(255, 255, 255)'])
  expect(ratio(printed.words, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5)
  console.log(`Pairing sheet on a11y-on, dark device: screen ${screen.words} on ${screen.ground}, printed ${printed.words} on ${printed.ground}`)
})

test('newLook on: the crosstable printed from a dark device puts navy and muted words on the white paper', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'a11y-on', 'only the a11y-on build has the new look')
  await open(page, CROSSTABLE)
  await page.emulateMedia({ media: 'print' })
  const colours = await page.evaluate(() => {
    const colourOf = (selector: string) => {
      const el = document.querySelector(selector)
      if (!el) throw new Error(`nothing matches ${selector}`)
      return getComputedStyle(el).color
    }
    return {
      dark: document.documentElement.classList.contains('dark'),
      heading: colourOf('table thead th'),
      name: colourOf('table tbody tr td.font-medium'),
      rating: colourOf('table tbody tr td:nth-child(3)'),
    }
  })
  expect(colours).toEqual({ dark: true, heading: 'rgb(26, 39, 68)', name: 'rgb(26, 39, 68)', rating: 'rgb(91, 100, 120)' })
  for (const words of [colours.heading, colours.name, colours.rating]) expect(ratio(words, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5)
})

test('newLook off: the rating and score are Tailwind\'s gray-600, as before, on the screen and in print', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'a11y-off', 'checks the build with no switches on')
  await open(page, SHEET)
  const screen = await readSheet(page, GRAY_600)
  expect([screen.look, screen.dark]).toEqual([null, false])
  expect(screen.words).toBe(screen.gray600)
  await page.emulateMedia({ media: 'print' })
  const printed = await readSheet(page, GRAY_600)
  expect(printed.words).toBe(printed.gray600)
  console.log(`Pairing sheet on a11y-off: ${screen.words} on the screen and in print (gray-600 ${GRAY_600})`)
})
