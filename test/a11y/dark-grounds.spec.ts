// test/a11y/dark-grounds.spec.ts
//
// Dark mode read from the computed colours (WS01 step 23, the step's
// acceptance criterion 4), beside the axe run of dark-spot.spec.ts. Axe
// judges text it can place on a ground and leaves the rest "incomplete";
// this spec reads every visible element instead, on /, /tournaments and
// /membership on the a11y-on build (newLook on), with .dark set by a dark
// device and, on a light device, by Dark chosen in Appearance:
//
// - no text is painted in the brand navy (#1a2744) on a ground it fails
//   against (4.5:1, or 3:1 for large text), and no icon either (3:1): the
//   navy left on these pages is the navy on gold, at 6.51:1;
// - no element has an opaque white ground, apart from a mat behind an image;
// - the navy bands (bg-brand-navy) are still #1a2744 and text-ink is the
//   dark ink #e8ecf4, so what the page shows is the move to the tokens.
//
// Each ground is worked out by laying the element's background over its
// ancestors' until an opaque one, the page's own ground at the bottom. A
// ground under a picture or a gradient is unknown, and navy on an unknown
// ground fails, since it cannot be shown to pass. Every finding is printed
// and attached. On a11y-off nothing turns dark (tokens.spec.ts), so it skips.
//
// One more check runs on both builds: the navy "Create ticket" button on
// /support, a shadcn Button whose className gives the navy fill. Its label
// is the variant's text-primary-foreground, the ground's colour, which is
// dark in dark mode, so the page adds dark:text-white: white on a11y-on with
// a dark device, and on a11y-off (no .dark) the label token as before.
import type { Page } from '@playwright/test'
import { expect, test } from './support'

const ROUTES = ['/', '/tournaments', '/membership']
const APPEARANCE_KEY = 'lca-appearance'

interface Painted {
  what: string
  ratio: number | null
  needs: number
}

interface Scan {
  look: string | null
  dark: boolean
  navy: Painted[]
  white: string[]
  bands: string[]
  inks: string[]
  counts: { bands: number; inks: number; navy: number }
}

/** Reads the page's computed colours. Runs in the browser. */
function scan(page: Page): Promise<Scan> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
    type Rgba = [number, number, number, number]
    /** Any CSS colour as the sRGB pixel it paints, with its alpha 0 to 1. */
    const rgba = (colour: string): Rgba => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = colour
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (top: Rgba, under: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1) as Rgba
    const lum = (c: Rgba) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const ratio = (a: Rgba, b: Rgba) => {
      const x = lum(a)
      const y = lum(b)
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const isNavy = (c: Rgba) => c[3] > 0 && Math.abs(c[0] - 26) <= 2 && Math.abs(c[1] - 39) <= 2 && Math.abs(c[2] - 68) <= 2
    const pageGround = (() => {
      const html = rgba(getComputedStyle(document.documentElement).backgroundColor)
      return html[3] > 0 ? html : rgba(getComputedStyle(document.body).backgroundColor)
    })()
    /** The ground under an element, or null when a picture or gradient is part of it. */
    const ground = (el: Element): Rgba | null => {
      const layers: Rgba[] = []
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e)
        if (s.backgroundImage !== 'none') return null
        const c = rgba(s.backgroundColor)
        if (c[3] > 0) {
          layers.push(c)
          if (c[3] >= 1) break
        }
      }
      let g = layers.length > 0 && layers[layers.length - 1][3] >= 1 ? (layers.pop() as Rgba) : pageGround
      while (layers.length > 0) g = over(layers.pop() as Rgba, g)
      return g
    }
    const visible = (el: Element) => {
      const s = getComputedStyle(el)
      return el.getClientRects().length > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0
    }
    const label = (el: Element) => {
      const host = el instanceof SVGElement && el.ownerSVGElement ? el.ownerSVGElement : el
      const text = (host.closest('a,button,label,p,span,h1,h2,h3,h4,li,td,th,div') ?? host).textContent?.replace(/\s+/g, ' ').trim().slice(0, 40)
      return `<${el.tagName.toLowerCase()}> "${text ?? ''}" [${(host.getAttribute('class') ?? '').slice(0, 90)}]`
    }
    const ownText = (el: Element) => Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')

    const out = {
      look: document.documentElement.getAttribute('data-look'),
      dark: document.documentElement.classList.contains('dark'),
      navy: [] as Painted[],
      white: [] as string[],
      bands: [] as string[],
      inks: [] as string[],
      counts: { bands: 0, inks: 0, navy: 0 },
    }
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (!visible(el)) continue
      const s = getComputedStyle(el)
      const bg = rgba(s.backgroundColor)
      if (bg[0] === 255 && bg[1] === 255 && bg[2] === 255 && bg[3] >= 1) {
        const mat = !ownText(el) && el.querySelector('img, svg, [style*="background-image"]') !== null &&
          !Array.from(el.querySelectorAll('*')).some(ownText)
        if (!mat) out.white.push(label(el))
      }
      if (el.classList.contains('bg-brand-navy')) {
        out.counts.bands++
        if (s.backgroundColor !== 'rgb(26, 39, 68)') out.bands.push(`${label(el)} is ${s.backgroundColor}`)
      }
      if (el.classList.contains('text-ink')) {
        out.counts.inks++
        if (s.color !== 'rgb(232, 236, 244)') out.inks.push(`${label(el)} is ${s.color}`)
      }
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) {
        for (const prop of ['stroke', 'fill'] as const) {
          const value = s[prop]
          if (!value || value === 'none') continue
          const c = rgba(value)
          if (!isNavy(c)) continue
          out.counts.navy++
          const g = ground(el.ownerSVGElement ?? el)
          out.navy.push({ what: `icon ${prop} ${label(el)}`, ratio: g ? ratio(over(c, g), g) : null, needs: 3 })
        }
        continue
      }
      if (!ownText(el)) continue
      const fg = rgba(s.color)
      if (!isNavy(fg)) continue
      out.counts.navy++
      const size = parseFloat(s.fontSize)
      const large = size >= 24 || (size >= 18.66 && Number(s.fontWeight) >= 700)
      const g = ground(el)
      out.navy.push({ what: `text ${label(el)}`, ratio: g ? ratio(over(fg, g), g) : null, needs: large ? 3 : 4.5 })
    }
    return out
  })
}

test.use({ colorScheme: 'dark', reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } })

async function check(page: Page, route: string, how: string, attach: (name: string, body: string) => Promise<void>) {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await expect(page.locator('main')).toBeVisible()
  const found = await scan(page)
  expect({ look: found.look, dark: found.dark }, route).toEqual({ look: 'new', dark: true })

  const failing = found.navy.filter((p) => p.ratio === null || p.ratio < p.needs)
  const report = [
    `Dark mode on ${route} (${how}): ${found.counts.navy} navy text or icon part(s), ${failing.length} below their ratio; ${found.white.length} white ground(s); ${found.counts.bands} navy band(s), ${found.counts.inks} text-ink element(s).`,
    ...found.navy.map((p) => `  navy ${p.ratio === null ? 'on an unknown ground' : `${p.ratio.toFixed(2)}:1`} (needs ${p.needs}:1) ${p.what}`),
    ...found.white.map((w) => `  white ground ${w}`),
    ...found.bands.map((b) => `  navy band changed: ${b}`),
    ...found.inks.map((i) => `  text-ink not the dark ink: ${i}`),
  ].join('\n')
  console.log(report)
  await attach(`dark-grounds${route === '/' ? '-home' : route.replace(/\//g, '-')}-${how.replace(/\W+/g, '-')}.txt`, report)

  expect(failing, report).toEqual([])
  expect(found.white, report).toEqual([])
  expect(found.bands, report).toEqual([])
  expect(found.inks, report).toEqual([])
  // The page has navy bands and ink text for the checks above to see.
  expect(found.counts.bands, report).toBeGreaterThan(0)
  expect(found.counts.inks, report).toBeGreaterThan(0)
}

for (const route of ROUTES) {
  test(`${route} on a dark device: no navy on a dark ground, no white ground, bands stay navy, ink turns light`, async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== 'a11y-on', 'only the a11y-on build has dark mode')
    const scriptErrors: string[] = []
    page.on('pageerror', (err) => scriptErrors.push(err.message))
    await check(page, route, 'dark device', (name, body) => testInfo.attach(name, { body, contentType: 'text/plain' }))
    expect(scriptErrors, 'script errors on the page').toEqual([])
    expect(external, 'requests to hosts other than the local server').toEqual([])
  })
}

test.describe('Dark chosen in Appearance on a light device', () => {
  test.use({ colorScheme: 'light' })

  test('/ with Dark stored: the same checks hold', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'a11y-on', 'only the a11y-on build has dark mode')
    await page.addInitScript((key) => window.localStorage.setItem(key, 'dark'), APPEARANCE_KEY)
    await check(page, '/', 'Dark chosen', (name, body) => testInfo.attach(name, { body, contentType: 'text/plain' }))
  })
})

test('/support on a dark device: the navy Create ticket button keeps a light label', async ({ page, external }, testInfo) => {
  await page.goto('/support')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'New ticket' }).click()
  const button = page.getByRole('button', { name: 'Create ticket' })
  await expect(button).toBeVisible()
  const seen = await button.evaluate((el) => {
    const s = getComputedStyle(el)
    // The label token as a computed colour, read the way the button's own colour is.
    const probe = document.createElement('span')
    probe.style.color = 'var(--primary-foreground)'
    el.appendChild(probe)
    const token = getComputedStyle(probe).color
    probe.remove()
    return { color: s.color, background: s.backgroundColor, token, dark: document.documentElement.classList.contains('dark') }
  })
  console.log(`/support Create ticket on ${testInfo.project.name}: ${seen.color} on ${seen.background}, .dark ${seen.dark}`)
  expect(seen.background).toBe('rgb(26, 39, 68)')
  if (testInfo.project.name === 'a11y-on') {
    expect(seen.dark).toBe(true)
    expect(seen.color).toBe('rgb(255, 255, 255)')
  } else {
    // newLook off: no .dark, so dark:text-white never applies and the label is the variant's, as before.
    expect(seen.dark).toBe(false)
    expect(seen.color).toBe(seen.token)
  }
  expect(external, 'requests to hosts other than the local server').toEqual([])
})
