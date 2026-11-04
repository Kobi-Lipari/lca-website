// test/a11y/brand-edges.spec.ts
//
// The rook mark and the official logo at their edges in the browser (WS01
// step 28), on both builds. test/a11y/brand.spec.ts holds the main run; this
// file adds what it leaves out.
//
// - The header's rook at the edges of its width rule: 28 pixels at 320, 639,
//   640 and 767, and 30 from 768 (the md breakpoint) at 768, 1023 and 1024,
//   square, in the middle of the 64 pixel bar and before the words, with the
//   header no wider than the window, at 320 too (WCAG 1.4.10 asks for 320).
//   With newLook off the image is 44 by 44 at each of those widths.
// - With forced colours on (a Windows contrast theme, light and dark), the
//   header's rook takes the colour the brand link's words are forced to, as
//   a mark filled with currentColor promises, and so stays at 3:1 or more on
//   the header's forced ground; the LCA tag's rook takes its words' forced
//   colour; and the official logo is drawn as it is, untouched by the theme.
// - The LCA tag grows by its rook and the gap after it and by nothing else:
//   its box is 8 + 11 + 6 + its words + 8 pixels wide and 24 high in every
//   look, light and, on a11y-on, dark; the rook does not move with no
//   reduced motion asked for; and at 1280, 768, 390 and 320 pixels the tag
//   sits on the partner tag's row, so the wider tag starts no row of its own
//   and moves no box below it. The fixture still holds 13 [data-status]
//   elements.
// - /about's frame paints the surface: the cream of the heritage look
//   (#fffdf8, with its hairline and 2px corners) as the heritage layout
//   draws the page, white with its 14px corners in the base look (the
//   layout's scope set to data-theme="" by the test), and the dark surface
//   in dark mode; nothing is laid over the logo, and nothing recolours it.
// - axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing in the
//   header, in the footer or on /about at 390 pixels with a dark device.
// - On the pages a phone opens most, the header and the footer fit a 390 and
//   a 320 pixel window on both builds.
// - The icon index.html links is served as public/favicon.svg, and its one
//   path is the header's rook.
//
// Each page is read once what its test reads is drawn (the header's brand
// link, the footer and the page's heading, or a fixture's statuses), never
// on network idle. Reads only.
//
// The header and the footer are read through test/a11y/chrome.ts. What holds
// for today's header or footer alone says so through it (the mark's sizes,
// today's 64 pixel bar and the words beside the mark, the logo's file in the
// footer, and today's images with newLook off), and runs wherever today's
// chrome is drawn.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { SITE, brandLink, footerImages, footerLogo, headerImages, ifToday, onlyToday, rookMark, siteFooter } from './chrome'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const ROOT = join(import.meta.dirname, '../..')
const FAVICON = readFileSync(join(ROOT, 'public/favicon.svg'))
/** The favicon's one path, as the file has it. */
const ROOK = FAVICON.toString('utf8').match(/<path[^>]* d="([^"]+)"/)![1]
const FIXTURES = ['base', 'heritage', 'scholastic', 'live'] as const

test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

/** Opens /about at a width and waits for what the tests read: the brand link, the footer and the page's heading. */
async function openAbout(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  await page.goto('/about')
  await expect(brandLink(page)).toBeVisible()
  await expect(siteFooter(page)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'About LCA' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/** Opens a fixture and waits for its statuses and its fonts, so every box is final. */
async function openFixture(page: Page, name: string): Promise<Locator> {
  await page.goto(`/__fixtures/${name}`)
  const container = page.locator(`[data-fixture="${name}"]`)
  await expect(container.getByRole('heading', { level: 2, name: 'Every status' })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  return container
}

/** [r, g, b] of a computed rgb() colour. */
function rgbOf(colour: string): [number, number, number] {
  const m = colour.match(/^rgba?\((\d+), (\d+), (\d+)/)
  if (!m) throw new Error(`not an rgb colour: ${colour}`)
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
  const [hi, lo] = [lum(rgbOf(a)), lum(rgbOf(b))].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Every finding axe makes, one line each, for the report. */
function findings(results: Awaited<ReturnType<AxeBuilder['analyze']>>): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.contrastRatio ? ` ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

/** What could change how an image is drawn, on it and on each element around it; empty when nothing does. */
function recolouring(img: Locator): Promise<string[]> {
  return img.evaluate((el) => {
    const found: string[] = []
    for (let at: Element | null = el; at; at = at.parentElement) {
      const s = getComputedStyle(at)
      if (s.filter !== 'none' || s.opacity !== '1' || s.mixBlendMode !== 'normal') found.push(`<${at.tagName.toLowerCase()}> filter ${s.filter}, opacity ${s.opacity}, blend ${s.mixBlendMode}`)
    }
    return found
  })
}

test.describe('the header\'s rook at the edges of its width rule', () => {
  const EDGES = [[320, 28], [639, 28], [640, 28], [767, 28], [768, 30], [1023, 30], [1024, 30]] as const

  test('a11y-on: 28 pixels below 768 and 30 from 768, square, in the middle of the bar, before the words, the header inside the window', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the rook mark is drawn under the new look, on a11y-on')
    for (const [width, size] of EDGES) {
      await openAbout(page, width)
      await expect(headerImages(page)).toHaveCount(0)
      const mark = rookMark(page)
      await expect(mark).toHaveCount(1)
      const m = await mark.evaluate((svg, site) => {
        const box = svg.getBoundingClientRect()
        // Today's markup: the header's first child is its bar, and the brand link's words come right after the mark.
        const bar = svg.closest(site.header)!.firstElementChild?.getBoundingClientRect() ?? null
        const words = svg.nextElementSibling?.getBoundingClientRect() ?? null
        return {
          box: [box.width, box.height],
          fromBarTop: bar ? box.top - bar.top : null,
          barHeight: bar ? bar.height : null,
          beforeWords: words !== null && box.right <= words.left,
          headerFits: svg.closest(site.header)!.scrollWidth <= document.documentElement.clientWidth,
          pageFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        }
      }, SITE)
      await ifToday(testInfo, 'header', width, `the rook mark ${size} pixels square, in the middle of today's 64 pixel bar and before the words`, () => {
        expect(m.box, `${width}`).toEqual([size, size])
        expect(m.barHeight, `${width}`).toBe(64)
        expect(m.fromBarTop, `${width}: in the middle of the bar`).toBe((64 - size) / 2)
        expect(m.beforeWords, `${width}`).toBe(true)
      })
      expect(m.headerFits, `${width}: the header fits the window`).toBe(true)
      expect(m.pageFits, `${width}: /about does not scroll sideways`).toBe(true)
    }
    expect(external).toEqual([])
  })

  test('a11y-off: today\'s image, 44 by 44 in the middle of the bar, at every one of those widths', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s header is drawn with newLook off, on a11y-off')
    onlyToday(testInfo, 'header', EDGES.map(([width]) => width), 'today\'s image, 44 by 44 in the middle of today\'s bar')
    for (const [width] of EDGES) {
      await openAbout(page, width)
      await expect(rookMark(page)).toHaveCount(0)
      const img = headerImages(page)
      await expect(img).toHaveCount(1)
      const m = await img.evaluate((el, site) => {
        const box = el.getBoundingClientRect()
        const bar = el.closest(site.header)!.firstElementChild!.getBoundingClientRect()
        return { box: [box.width, box.height], fromBarTop: box.top - bar.top, headerFits: el.closest(site.header)!.scrollWidth <= document.documentElement.clientWidth }
      }, SITE)
      expect(m, `${width}`).toEqual({ box: [44, 44], fromBarTop: 10, headerFits: true })
    }
  })
})

test.describe('forced colours (a Windows contrast theme)', () => {
  test('a11y-on: the header\'s rook takes the brand words\' forced colour and stays at 3:1 or more on the header\'s forced ground, with a light and a dark theme', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the rook mark is drawn under the new look, on a11y-on')
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
      await openAbout(page, 1280)
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true)
      const m = await rookMark(page).evaluate((svg, site) => {
        // Today's markup: the brand link's first line of words, right after the mark.
        const words = svg.nextElementSibling?.firstElementChild ?? null
        return {
          fill: getComputedStyle(svg.querySelector('path')!).fill,
          words: words ? getComputedStyle(words).color : null,
          ground: getComputedStyle(svg.closest(site.header)!).backgroundColor,
        }
      }, SITE)
      const seen = `${scheme} theme: the rook ${m.fill}, the words ${m.words}, on ${m.ground}`
      console.log(`Forced colours, ${seen}, ${ratio(m.fill, m.ground).toFixed(2)}:1.`)
      expect.soft(ratio(m.fill, m.ground), seen).toBeGreaterThanOrEqual(3)
      await ifToday(testInfo, 'header', 1280, 'the rook in the forced colour of the words beside it in today\'s brand link', () => {
        expect.soft(m.fill, seen).toBe(m.words)
      })
    }
  })

  test('the LCA tag\'s rook takes its words\' forced colour, with a light and a dark theme', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
      const container = await openFixture(page, 'base')
      const m = await container.locator('[data-slot="status-badge"][data-status="lca"]').evaluate((tag) => ({
        fill: getComputedStyle(tag.querySelector('[data-slot="status-mark"] path')!).fill,
        words: getComputedStyle(tag).color,
      }))
      expect(m.fill, scheme).toBe(m.words)
    }
  })

  test('the official logo is drawn as it is, the file untouched by the theme', async ({ page }, testInfo) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme })
      await openAbout(page, 1280)
      // On a11y-on the footer's logo and /about's framed one, which is not the chrome's; with newLook off, today's two images.
      const inFooter = footerLogo(page)
      const logos: Locator[] = []
      if (testInfo.project.name === ON) {
        logos.push(inFooter, page.locator('main [data-slot="lca-logo-mat"] [data-slot="lca-logo"]'))
      } else {
        await ifToday(testInfo, 'header', 1280, 'today\'s image in the header, with newLook off', () => {
          logos.push(headerImages(page))
        })
        await ifToday(testInfo, 'footer', 1280, 'today\'s image in the footer, with newLook off', () => {
          logos.push(footerImages(page))
        })
      }
      for (const logo of logos) {
        await expect(logo).toHaveCount(1)
        await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
        const file = async () => expect(await logo.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight])).toEqual([400, 399])
        if (logo === inFooter) await ifToday(testInfo, 'footer', 1280, 'the footer logo\'s file, 400 by 399', file)
        else await file()
        expect(await recolouring(logo), scheme).toEqual([])
      }
    }
  })
})

test.describe('the LCA tag grows by its rook and nothing else', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('8 + 11 + 6 + its words + 8 pixels wide and 24 high in every look, its rook still, on the partner tag\'s row at every width', async ({ page }, testInfo) => {
    const schemes = testInfo.project.name === ON ? (['light', 'dark'] as const) : (['light'] as const)
    for (const scheme of schemes) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const name of FIXTURES) {
        await page.setViewportSize({ width: 1280, height: 800 })
        const container = await openFixture(page, name)
        await expect(container.locator('[data-status]')).toHaveCount(13)
        expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(false)
        for (const width of [1280, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 800 })
          const m = await container.evaluate((el) => {
            const tag = el.querySelector('[data-slot="status-badge"][data-status="lca"]')!
            const partner = el.querySelector('[data-slot="status-badge"][data-status="partner"]')!
            const rook = tag.querySelector('[data-slot="status-mark"]')!
            const text = [...tag.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!
            const range = document.createRange()
            range.selectNodeContents(text)
            const box = tag.getBoundingClientRect()
            const r = rook.getBoundingClientRect()
            const w = range.getBoundingClientRect()
            const s = getComputedStyle(tag)
            return {
              height: box.height,
              left: parseFloat(s.paddingLeft),
              right: parseFloat(s.paddingRight),
              gap: parseFloat(s.columnGap),
              rook: [r.width, r.height, r.left - box.left],
              wordsAt: w.left - box.left,
              unexplained: box.width - (parseFloat(s.paddingLeft) + r.width + parseFloat(s.columnGap) + w.width + parseFloat(s.paddingRight)),
              partnersRow: box.top === partner.getBoundingClientRect().top,
              inRow: box.right <= tag.parentElement!.getBoundingClientRect().right,
              moving: rook.getAnimations().length,
              animation: getComputedStyle(rook).animationName,
            }
          })
          const at = `${name}, ${scheme}, ${width} pixels`
          expect(m.height, at).toBe(24)
          expect([m.left, m.right, m.gap], at).toEqual([8, 8, 6])
          expect(m.rook, at).toEqual([11, 11, 8])
          expect(m.wordsAt, at).toBe(25)
          expect(Math.abs(m.unexplained), `${at}: width beyond the padding, the rook, the gap and the words`).toBeLessThan(0.01)
          expect(m.partnersRow, `${at}: on the partner tag's row`).toBe(true)
          expect(m.inRow, at).toBe(true)
          expect([m.moving, m.animation], at).toEqual([0, 'none'])
        }
      }
    }
  })
})

test.describe('/about\'s frame in the looks', () => {
  const GROUNDS = {
    light: { base: ['rgb(255, 255, 255)', 'rgb(229, 231, 237)'], heritage: ['rgb(255, 253, 248)', 'rgb(216, 205, 180)'] },
    dark: { base: ['rgb(17, 26, 44)', 'rgba(255, 255, 255, 0.08)'], heritage: ['rgb(17, 26, 44)', 'rgba(255, 255, 255, 0.08)'] },
  } as const
  /** The frame's corners: the base look's rounded-xl, and the heritage look's 2px. */
  const CORNERS = { base: '14px', heritage: '2px' } as const

  test('a11y-on: the surface (the heritage cream, white, the dark surface) with its hairline, nothing laid over the logo and nothing recolouring it', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the logo on /about is drawn under the new look, on a11y-on')
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      for (const look of ['heritage', 'base'] as const) {
        await openAbout(page, 1280)
        const mat = page.locator('main [data-slot="lca-logo-mat"]')
        await expect(mat).toHaveCount(1)
        // The heritage layout draws the page in its look; for the base reading its scope is set to the base look in place.
        expect(await mat.evaluate((el) => el.closest('[data-theme]')?.getAttribute('data-layout'))).toBe('heritage')
        if (look === 'base') await mat.evaluate((el) => el.closest('[data-layout="heritage"]')!.setAttribute('data-theme', ''))
        const logo = mat.locator('img')
        await expect.poll(() => logo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
        const m = await mat.evaluate((el) => {
          const img = el.querySelector('img')!
          const box = img.getBoundingClientRect()
          // Five points inside the logo, its middle and towards each corner, clear of the rounded corners.
          const points = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]]
          return {
            ground: getComputedStyle(el).backgroundColor,
            line: getComputedStyle(el).borderTopColor,
            corner: getComputedStyle(el).borderTopLeftRadius,
            natural: [img.naturalWidth, img.naturalHeight],
            onTop: points.map(([x, y]) => document.elementFromPoint(box.left + box.width * x, box.top + box.height * y) === img),
          }
        })
        const at = `${look} look, ${scheme} device`
        expect([m.ground, m.line], at).toEqual(GROUNDS[scheme][look])
        expect(m.corner, at).toBe(CORNERS[look])
        expect(m.natural, at).toEqual([400, 399])
        expect(m.onTop, `${at}: the logo is what is seen at each point`).toEqual([true, true, true, true, true])
        expect(await recolouring(logo), at).toEqual([])
      }
    }
  })
})

test.describe('axe at a phone\'s width with a dark device', () => {
  test.use({ colorScheme: 'dark' })

  test('a11y-on at 390 pixels: nothing in the header, nothing in the footer and nothing on /about', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
    await openAbout(page, 390)
    expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(true)
    const report: string[] = []
    const found: string[] = []
    for (const [what, scope] of [['the header', SITE.header], ['the footer', SITE.footer], ['/about', null]] as const) {
      let axe = new AxeBuilder({ page }).withTags(AXE_TAGS)
      if (scope) axe = axe.include(scope)
      const results = await axe.analyze()
      report.push(`axe on ${what} at 390 pixels, dark device (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results))
      found.push(...findings(results).map((f) => `${what}: ${f}`))
      const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
      for (const rule of ['image-alt', 'svg-img-alt', 'link-name', 'color-contrast']) expect(ran, `${what} ${rule}`).toContain(rule)
    }
    console.log(report.join('\n'))
    expect(found, report.join('\n')).toEqual([])
    expect(external).toEqual([])
  })
})

test.describe('the header and the footer fit a phone\'s window on every page', () => {
  const PAGES = ['/', '/tournaments', '/membership', '/about', '/champions', '/governance/board', '/governance/bylaws', '/governance/minutes', '/news', '/contact', '/clubs', '/scholastic']

  test('at 390 and 320 pixels, on both builds', async ({ page }) => {
    const wide: string[] = []
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 })
      for (const path of PAGES) {
        await page.goto(path)
        await expect(brandLink(page)).toBeVisible()
        await expect(siteFooter(page)).toBeVisible()
        // The page's own heading rather than main: main holds only the
        // loading line until the page's code arrives, and /about and the
        // governance pages then draw a second main inside it.
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await page.evaluate(() => document.fonts.ready)
        const m = await page.evaluate((site) => {
          const room = document.documentElement.clientWidth
          return ([['header', site.header], ['footer', site.footer]] as const).map(([part, selector]) => {
            const el = document.querySelector(selector)!
            return { part, fits: el.scrollWidth <= room && el.getBoundingClientRect().right <= room, width: el.scrollWidth }
          })
        }, SITE)
        for (const p of m) if (!p.fits) wide.push(`${path} at ${width} pixels: the ${p.part} is ${p.width} pixels wide`)
      }
    }
    expect(wide).toEqual([])
  })
})

test.describe('the site\'s icon', () => {
  test('is public/favicon.svg as served, and its one path is the header\'s rook', async ({ page }, testInfo) => {
    await openAbout(page, 1280)
    const href = await page.locator('link[rel="icon"]').getAttribute('href')
    expect(href).toBe('/favicon.svg')
    const response = await page.request.get(href!)
    expect(response.ok()).toBe(true)
    const body = await response.body()
    expect(body.equals(FAVICON)).toBe(true)
    expect([...body.toString('utf8').matchAll(/<path[^>]* d="([^"]+)"/g)].map((m) => m[1])).toEqual([ROOK])
    if (testInfo.project.name === ON) {
      expect(await rookMark(page).locator('path').getAttribute('d')).toBe(ROOK)
    }
  })
})
