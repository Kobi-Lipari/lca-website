// test/a11y/brand.spec.ts
//
// The rook mark and the official logo in the browser (WS01 step 28), on both
// builds: the header, the footer and /about, the places of decision D1 that
// exist today, and the LCA status tag on the fixture page.
//
// - a11y-on (newLook on), at 1280, 768 and 390 pixels, with a light and a
//   dark device: the header holds one rook mark ([data-slot="lca-mark"]) and
//   no image. Its one path is the favicon's, read from public/favicon.svg
//   here so the two cannot drift apart; it is 30 pixels wide, 28 on the
//   phone; its computed fill is white, the header's own colour, and reaches
//   3:1 or more on the header's computed navy (WCAG 1.4.11); it is hidden
//   from screen readers, so the brand link is named once, "Louisiana Chess
//   Association". /about, where the header is read, does not scroll
//   sideways at 390.
// - a11y-on: the footer's logo ([data-slot="lca-logo"]) is the official file
//   as it is: the bytes the page fetched for it are src/assets/lca-logo.webp
//   (16,468 bytes, the same hash), 400 by 399 as drawn, 56 pixels wide on the
//   page, with empty words beside the name, and with no filter, no opacity
//   and no blend on it or on anything around it. /about shows the same file
//   with its name in its frame ([data-slot="lca-logo-mat"]) on the surface,
//   before "Who we are", at 1280 and 390 pixels: the page is drawn in the
//   heritage look on this build, so the frame is its cream with its hairline
//   and 2px corners with a light device, and the dark surface with a dark one.
// - a11y-off (newLook off): the header's image is today's (the hashed webp,
//   its words, a 44 by 44 box) and no mark is drawn, so the link is named by
//   the image and the words; the footer's image is 56 by 56; /about draws no
//   logo and no frame.
// - Both builds: the LCA tag on the base fixture draws its rook before its
//   words, hidden from screen readers, filled with the tag's words colour;
//   and axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing in
//   the header, in the footer or on /about, at 1280 and 390 pixels. Nothing
//   goes in known-violations.json.
//
// /about asks the server for no data of its own, so each page is read once
// the header's brand link, the footer and the page's heading are drawn, not
// on network idle. Reads only.
//
// The header and the footer are read through test/a11y/chrome.ts. What holds
// for today's header or footer alone says so through it (the mark's size, its
// place beside today's words, the brand link's name, today's brand column in
// the footer and the logo's file, and every check of a11y-off), and runs
// wherever today's chrome is drawn.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, Response } from '@playwright/test'
import { SITE, brandLink, footerImages, footerLogo, headerImages, ifToday, onlyToday, rookMark, siteFooter } from './chrome'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const ROOT = join(import.meta.dirname, '../..')
const NAME = 'Louisiana Chess Association'
/** The favicon's one path, as the file has it. */
const ROOK = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8').match(/<path[^>]* d="([^"]+)"/)![1]
/** The official logo, as the repository holds it. */
const LOGO = readFileSync(join(ROOT, 'src/assets/lca-logo.webp'))
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
/** The address the build gives the logo: the file's name with its hash. */
const LOGO_PATH = /^\/assets\/lca-logo-[\w-]+\.webp$/
const WIDTHS = [1280, 768, 390] as const
const NAVY = 'rgb(26, 39, 68)'
const WHITE = 'rgb(255, 255, 255)'
/** The heritage look's surface and hairline (src/index.css), which /about is drawn in on a11y-on. */
const CREAM = 'rgb(255, 253, 248)'
const HERITAGE_HAIRLINE = 'rgb(216, 205, 180)'

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

/** Every logo file the page fetches, kept to read its bytes. */
function logoResponses(page: Page): Response[] {
  const seen: Response[] = []
  page.on('response', (response) => {
    if (LOGO_PATH.test(new URL(response.url()).pathname)) seen.push(response)
  })
  return seen
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

/** An image once it has loaded: its size as drawn by the file and on the page, and what could recolour it, on it and on each element around it. */
async function logoAsDrawn(img: Locator) {
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  return img.evaluate((el: HTMLImageElement) => {
    const recolour: string[] = []
    for (let at: Element | null = el; at; at = at.parentElement) {
      const s = getComputedStyle(at)
      if (s.filter !== 'none' || s.opacity !== '1' || s.mixBlendMode !== 'normal') recolour.push(`<${at.tagName.toLowerCase()}> filter ${s.filter}, opacity ${s.opacity}, blend ${s.mixBlendMode}`)
    }
    const box = el.getBoundingClientRect()
    return {
      natural: [el.naturalWidth, el.naturalHeight],
      width: box.width,
      path: new URL(el.currentSrc || el.src).pathname,
      fit: getComputedStyle(el).objectFit,
      recolour,
    }
  })
}

/** The page scrolls sideways when its content is wider than the window. */
const scrollsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

test.describe('the header', () => {
  for (const width of WIDTHS) {
    test(`a11y-on at ${width} pixels: one rook mark and no image, the favicon's path, white on the navy at 3:1 or more with a light and a dark device, the link named once`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the rook mark is drawn under the new look, on a11y-on')
      const size = width >= 768 ? 30 : 28
      for (const scheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme: scheme })
        await openAbout(page, width)
        expect(await page.locator('html').evaluate((el) => el.classList.contains('dark')), scheme).toBe(scheme === 'dark')
        await expect(headerImages(page)).toHaveCount(0)
        const mark = rookMark(page)
        await expect(mark).toHaveCount(1)
        await expect(mark).toBeVisible()
        const drawn = await mark.evaluate((svg, site) => {
          const paths = [...svg.querySelectorAll('path')]
          const box = svg.getBoundingClientRect()
          // Today's markup: the brand link's words right after the mark, which is the link's own child.
          const words = svg.nextElementSibling?.getBoundingClientRect() ?? null
          return {
            d: paths.map((p) => p.getAttribute('d')),
            fill: getComputedStyle(paths[0]).fill,
            ground: getComputedStyle(svg.closest(site.header)!).backgroundColor,
            hidden: svg.getAttribute('aria-hidden'),
            box: [box.width, box.height],
            beforeWords: words !== null && box.right <= words.left,
            inLink: svg.parentElement?.getAttribute('href') ?? null,
          }
        }, SITE)
        expect(drawn.d, scheme).toEqual([ROOK])
        await ifToday(testInfo, 'header', width, `the rook mark ${size} pixels square`, () => {
          expect(drawn.box, scheme).toEqual([size, size])
        })
        expect(drawn.fill, scheme).toBe(WHITE)
        expect(drawn.ground, scheme).toBe(NAVY)
        expect(ratio(drawn.fill, drawn.ground), scheme).toBeGreaterThanOrEqual(3)
        expect(drawn.hidden, scheme).toBe('true')
        await ifToday(testInfo, 'header', width, 'the mark the brand link\'s own child, before its words', () => {
          expect(drawn.inLink, scheme).toBe('/')
          expect(drawn.beforeWords, scheme).toBe(true)
        })
        // Hidden from screen readers: the link is named once, by its words, and holds no image.
        const link = brandLink(page)
        await ifToday(testInfo, 'header', width, `the brand link named "${NAME}"`, async () => {
          await expect(link).toHaveAccessibleName(NAME)
        })
        await expect(link.getByRole('img')).toHaveCount(0)
        if (width === 390) expect(await scrollsSideways(page), scheme).toBe(false)
        console.log(`Header at ${width} pixels, ${scheme} device (${testInfo.project.name}): the rook mark ${size} pixels, fill ${drawn.fill} on ${drawn.ground}, ${ratio(drawn.fill, drawn.ground).toFixed(2)}:1, the link named "${NAME}".`)
      }
      expect(external).toEqual([])
    })
  }

  test('a11y-off at 1280, 768 and 390 pixels: today\'s image, 44 by 44, and no mark; the link named by the image and by its words', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s header is drawn with newLook off, on a11y-off')
    onlyToday(testInfo, 'header', WIDTHS, 'today\'s image in the brand link, 44 by 44, named with the words')
    for (const width of WIDTHS) {
      await openAbout(page, width)
      await expect(rookMark(page)).toHaveCount(0)
      const img = headerImages(page)
      await expect(img).toHaveCount(1)
      await expect(img).toHaveAttribute('alt', NAME)
      const drawn = await logoAsDrawn(img)
      expect(drawn.path, String(width)).toMatch(LOGO_PATH)
      expect(drawn.natural).toEqual([400, 399])
      expect(await img.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])).toEqual([44, 44])
      await expect(brandLink(page)).toHaveAccessibleName(`${NAME} ${NAME}`)
      if (width === 390) expect(await scrollsSideways(page)).toBe(false)
    }
  })
})

test.describe('the footer', () => {
  test('a11y-on: the official file as it is, the bytes fetched being src/assets/lca-logo.webp, 400 by 399, 56 pixels wide, nothing recolouring it, its words empty beside the name', async ({ page, external }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'LcaLogo is drawn in the footer under the new look, on a11y-on')
    const fetched = logoResponses(page)
    await openAbout(page, 1280)
    const footer = siteFooter(page)
    const logo = footerLogo(page)
    await ifToday(testInfo, 'footer', 1280, 'today\'s brand column: one image, the logo, with empty words beside the name, named once', async () => {
      await expect(footerImages(page)).toHaveCount(1)
      await expect(logo).toHaveCount(1)
      await expect(logo).toHaveAttribute('alt', '')
      await expect(footer.getByRole('img')).toHaveCount(0)
      await expect(footer.getByText(NAME, { exact: true })).toHaveCount(1)
    })
    const drawn = await logoAsDrawn(logo)
    await ifToday(testInfo, 'footer', 1280, 'the logo\'s file, 400 by 399', () => {
      expect(drawn.natural).toEqual([400, 399])
    })
    expect(drawn.width).toBe(56)
    await ifToday(testInfo, 'footer', 1280, 'the logo\'s address, the official file\'s', () => {
      expect(drawn.path).toMatch(LOGO_PATH)
    })
    expect(drawn.fit).toBe('contain')
    expect(drawn.recolour).toEqual([])
    // The bytes the page fetched for it are the file in the repository.
    await ifToday(testInfo, 'footer', 1280, 'the bytes fetched being src/assets/lca-logo.webp', async () => {
      const response = fetched.find((r) => new URL(r.url()).pathname === drawn.path)!
      expect(response.headers()['content-type']).toBe('image/webp')
      const body = await response.body()
      expect(body.length).toBe(16468)
      expect(sha256(body)).toBe(sha256(LOGO))
      expect(body.equals(LOGO)).toBe(true)
    })
    expect(external).toEqual([])
  })

  test('a11y-off: today\'s image of the same file, 56 by 56', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s footer is drawn with newLook off, on a11y-off')
    onlyToday(testInfo, 'footer', [1280], 'today\'s image of the logo in the footer, 56 by 56')
    const fetched = logoResponses(page)
    await openAbout(page, 1280)
    const img = footerImages(page)
    await expect(img).toHaveCount(1)
    await expect(footerLogo(page)).toHaveCount(0)
    await expect(img).toHaveAttribute('alt', NAME)
    const drawn = await logoAsDrawn(img)
    expect(drawn.natural).toEqual([400, 399])
    expect(await img.evaluate((el) => [el.getBoundingClientRect().width, el.getBoundingClientRect().height])).toEqual([56, 56])
    const response = fetched.find((r) => new URL(r.url()).pathname === drawn.path)!
    expect((await response.body()).equals(LOGO)).toBe(true)
  })
})

test.describe('/about', () => {
  for (const width of [1280, 390] as const) {
    test(`a11y-on at ${width} pixels: the official logo with its name in its frame on the surface, before "Who we are", the same file, and no sideways scroll`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the logo on /about is drawn under the new look, on a11y-on')
      const fetched = logoResponses(page)
      await openAbout(page, width)
      const mat = page.locator('main [data-slot="lca-logo-mat"]')
      await expect(mat).toHaveCount(1)
      await expect(mat).toBeVisible()
      const logo = mat.getByRole('img', { name: NAME })
      await expect(logo).toBeVisible()
      await expect(mat.locator('img')).toHaveCount(1)
      await expect(logo).toHaveAttribute('data-slot', 'lca-logo')
      const drawn = await logoAsDrawn(logo)
      expect(drawn.natural).toEqual([400, 399])
      expect(drawn.width).toBe(160)
      expect(drawn.recolour).toEqual([])
      const response = fetched.find((r) => new URL(r.url()).pathname === drawn.path)!
      expect((await response.body()).equals(LOGO)).toBe(true)
      // The frame: the surface of the heritage look the page is drawn in, cream, with a hairline of its own and 2px corners, inside the window.
      const frame = await mat.evaluate((el) => {
        const s = getComputedStyle(el)
        const box = el.getBoundingClientRect()
        const heading = [...document.querySelectorAll('main h2')].find((h) => h.textContent === 'Who we are')!
        return {
          look: el.closest('[data-theme]')?.getAttribute('data-theme'),
          ground: s.backgroundColor,
          line: s.borderTopWidth,
          lineColour: s.borderTopColor,
          corner: s.borderTopLeftRadius,
          left: box.left,
          right: box.right,
          aboveHeading: box.bottom <= heading.getBoundingClientRect().top,
          window: document.documentElement.clientWidth,
        }
      })
      expect(frame.look).toBe('heritage')
      expect(frame.ground).toBe(CREAM)
      expect(frame.line).toBe('1px')
      expect(frame.lineColour).toBe(HERITAGE_HAIRLINE)
      expect(frame.corner).toBe('2px')
      expect(frame.left).toBeGreaterThanOrEqual(0)
      expect(frame.right).toBeLessThanOrEqual(frame.window)
      expect(frame.aboveHeading).toBe(true)
      expect(await scrollsSideways(page)).toBe(false)
      expect(external).toEqual([])
    })
  }

  test('a11y-on with a dark device: the frame is the dark surface, the logo the file as it is, and axe finds nothing', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'only the a11y-on build has dark mode')
    await page.emulateMedia({ colorScheme: 'dark' })
    await openAbout(page, 1280)
    expect(await page.locator('html').evaluate((el) => el.classList.contains('dark'))).toBe(true)
    const mat = page.locator('main [data-slot="lca-logo-mat"]')
    expect(await mat.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(17, 26, 44)')
    const drawn = await logoAsDrawn(mat.locator('img'))
    expect(drawn.natural).toEqual([400, 399])
    expect(drawn.recolour).toEqual([])
    const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
    const report = [`axe on /about at 1280 pixels, dark device (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results)].join('\n')
    console.log(report)
    expect(findings(results), report).toEqual([])
  })

  test('a11y-off at 1280 and 390 pixels: no logo and no frame, and no sideways scroll', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s /about is drawn with newLook off, on a11y-off')
    for (const width of [1280, 390]) {
      await openAbout(page, width)
      await expect(page.locator('[data-slot="lca-logo-mat"], [data-slot="lca-logo"]')).toHaveCount(0)
      await expect(page.locator('main img')).toHaveCount(0)
      expect(await scrollsSideways(page), String(width)).toBe(false)
    }
  })
})

test.describe('the LCA tag', () => {
  test('on the base fixture it draws its rook before its words, hidden from screen readers, filled with the words\' colour', async ({ page }, testInfo) => {
    await page.goto('/__fixtures/base')
    const container = page.locator('[data-fixture="base"]')
    await expect(container.getByRole('heading', { level: 2, name: 'Every status' })).toBeVisible()
    const tag = container.locator('[data-slot="status-badge"][data-status="lca"]')
    await expect(tag).toHaveCount(1)
    // A screen reader hears the words alone.
    await expect(tag).toMatchAriaSnapshot('- text: LCA event')
    const drawn = await tag.evaluate((el) => {
      const svg = el.firstElementChild!
      const paths = [...svg.querySelectorAll('path')]
      const words = document.createRange()
      words.selectNodeContents([...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!)
      const box = svg.getBoundingClientRect()
      return {
        slot: svg.getAttribute('data-slot'),
        hidden: svg.getAttribute('aria-hidden'),
        d: paths.map((p) => p.getAttribute('d')),
        fill: getComputedStyle(paths[0]).fill,
        words: getComputedStyle(el).color,
        box: [box.width, box.height],
        beforeWords: box.right <= words.getBoundingClientRect().left,
      }
    })
    expect(drawn).toEqual({ slot: 'status-mark', hidden: 'true', d: [ROOK], fill: drawn.words, words: drawn.words, box: [11, 11], beforeWords: true })
    console.log(`The LCA tag's rook (${testInfo.project.name}): 11 pixels, filled ${drawn.fill}, the tag's words ${drawn.words}.`)
  })
})

test.describe('axe on the header, the footer and /about', () => {
  for (const width of [1280, 390] as const) {
    test(`at ${width} pixels: nothing in the header, nothing in the footer and nothing on the page`, async ({ page, external }, testInfo) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await openAbout(page, width)
      const report: string[] = []
      const found: string[] = []
      for (const [what, scope] of [['the header', SITE.header], ['the footer', SITE.footer], ['/about', null]] as const) {
        let axe = new AxeBuilder({ page }).withTags(AXE_TAGS)
        if (scope) axe = axe.include(scope)
        const results = await axe.analyze()
        report.push(`axe on ${what} at ${width} pixels (${testInfo.project.name}): ${results.passes.length} rules passed, ${results.violations.length} with findings.`, ...findings(results))
        found.push(...findings(results).map((f) => `${what}: ${f}`))
        // The rules a mark and a logo must pass were run, not left out.
        const ran = new Set([...results.passes, ...results.incomplete, ...results.inapplicable].map((r) => r.id))
        for (const rule of ['image-alt', 'svg-img-alt', 'link-name', 'color-contrast']) expect(ran, `${what} ${rule}`).toContain(rule)
      }
      console.log(report.join('\n'))
      await testInfo.attach(`axe-brand-${width}.json`, { body: JSON.stringify({ report, found }, null, 2), contentType: 'application/json' })
      expect(found, report.join('\n')).toEqual([])
      expect(errors).toEqual([])
      expect(external).toEqual([])
    })
  }
})
