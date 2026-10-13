// test/a11y/baseline.ts
//
// The colours and fonts the site shows today, recorded from the a11y-off
// build (no switches on) so later steps can prove they did not change them.
// When the new design tokens arrive, the old token names must keep giving
// exactly these values while newLook is off; this file is the proof.
//
// On /, /tournaments and /membership it measures four things: the page body,
// and inside <main> the first visible Button (the shared button component,
// data-slot="button"), table header cell and element set in the monospace
// face (.font-mono). None of those three pages has a table header or a
// monospace element today, so the finished event's page in the seed data
// (/tournaments/fx-t-done, with its standings) is measured too. An element a
// page does not have is recorded as not found. For each it keeps the computed
// text, background and border colours and the font-family, plus each colour
// as the sRGB pixel it paints, which reads the same whichever way the browser
// writes the colour out (rgb(), oklch() and so on).
//
// test/a11y/baseline.json holds the recording and is committed. When that
// file is missing, or A11Y_BASELINE=record is set, this test writes it.
// Otherwise it compares: a font-family must match exactly, a colour may
// differ by at most 2 in any channel, and an element found then must still
// be found. The measurement of every run is attached to the report.
//
// Only the a11y-off project runs this file (see playwright.config.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from './support'

const BASELINE = join(import.meta.dirname, 'baseline.json')
const ROUTES = ['/', '/tournaments', '/membership', '/tournaments/fx-t-done'] as const
const TARGETS = {
  body: 'body',
  button: 'main [data-slot="button"]',
  tableHeader: 'main th',
  mono: 'main .font-mono',
} as const
const COLOUR_TOLERANCE = 2

type Rgba = [number, number, number, number]

interface Measured {
  found: boolean
  /** The first few words of the element, to show which one was measured. */
  text?: string
  /** The button's variant, when the element is a Button. */
  variant?: string | null
  color?: string
  backgroundColor?: string
  borderColor?: string
  fontFamily?: string
  pixels?: { color: Rgba; backgroundColor: Rgba; borderColor: Rgba }
}

type Recording = Record<string, Record<keyof typeof TARGETS, Measured>>

interface BaselineFile {
  comment: string
  build: string
  viewport: { width: number; height: number }
  colorScheme: 'light'
  routes: Recording
}

test.use({ colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

test('records or compares the colours and fonts of the site as it is today', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const routes: Recording = {} as Recording

  for (const route of ROUTES) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('main')).toBeVisible()
    routes[route] = await page.evaluate((targets) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
      const pixel = (colour: string): [number, number, number, number] => {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000'
        ctx.fillStyle = colour
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        return [d[0], d[1], d[2], d[3]]
      }
      const visible = (el: Element) => {
        const style = getComputedStyle(el)
        return el.getClientRects().length > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      }
      const out: Record<string, unknown> = {}
      for (const [key, selector] of Object.entries(targets)) {
        const el = Array.from(document.querySelectorAll(selector)).find(visible)
        if (!el) {
          out[key] = { found: false }
          continue
        }
        const s = getComputedStyle(el)
        out[key] = {
          found: true,
          text: key === 'body' ? undefined : (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
          variant: key === 'button' ? el.getAttribute('data-variant') : undefined,
          color: s.color,
          backgroundColor: s.backgroundColor,
          borderColor: s.borderTopColor,
          fontFamily: s.fontFamily,
          pixels: { color: pixel(s.color), backgroundColor: pixel(s.backgroundColor), borderColor: pixel(s.borderTopColor) },
        }
      }
      return out
    }, TARGETS) as Recording[string]
  }

  const viewport = page.viewportSize() ?? { width: 0, height: 0 }
  const measured: BaselineFile = {
    comment:
      'Computed colours and font-family on the a11y-off build (no switches on), written by test/a11y/baseline.ts. Later steps compare against it: with newLook off, these must not change. Rewrite it only on purpose, with A11Y_BASELINE=record npm run test:a11y.',
    build: testInfo.project.name,
    viewport,
    colorScheme: 'light',
    routes,
  }
  const text = `${JSON.stringify(measured, null, 2)}\n`
  await testInfo.attach('baseline-measured.json', { body: text, contentType: 'application/json' })

  if (!existsSync(BASELINE) || process.env.A11Y_BASELINE === 'record') {
    writeFileSync(BASELINE, text)
    console.log(`Recorded ${BASELINE}: ${ROUTES.length} pages, ${Object.keys(TARGETS).length} elements each.`)
    return
  }

  const saved = JSON.parse(readFileSync(BASELINE, 'utf8')) as BaselineFile
  const differences: string[] = []
  for (const route of ROUTES) {
    for (const key of Object.keys(TARGETS) as Array<keyof typeof TARGETS>) {
      const was = saved.routes[route]?.[key]
      const now = routes[route][key]
      const where = `${route} ${key}`
      if (!was) {
        differences.push(`${where}: not in baseline.json`)
        continue
      }
      if (was.found !== now.found) {
        differences.push(`${where}: ${was.found ? 'was found, now missing' : 'was missing, now found'}`)
        continue
      }
      if (!was.found || !was.pixels || !now.pixels) continue
      if (was.fontFamily !== now.fontFamily) differences.push(`${where} font-family: ${was.fontFamily} became ${now.fontFamily}`)
      for (const prop of ['color', 'backgroundColor', 'borderColor'] as const) {
        const a = was.pixels[prop]
        const b = now.pixels[prop]
        if (a.some((v, i) => Math.abs(v - b[i]) > COLOUR_TOLERANCE)) {
          differences.push(`${where} ${prop}: ${was[prop]} [${a.join(', ')}] became ${now[prop]} [${b.join(', ')}]`)
        }
      }
    }
  }
  console.log(differences.length === 0 ? 'Baseline matches: no colour or font changed.' : `Baseline differences:\n  ${differences.join('\n  ')}`)
  expect(differences, 'colours or fonts differ from test/a11y/baseline.json').toEqual([])
})
