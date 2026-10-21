// test/a11y/home.spec.ts
//
// The homepage hero in the browser (WS01 step 29), on both builds, for
// acceptance criteria 4 (nothing moves on by itself; with reduced motion
// asked for, nothing animates) and 7 (the hero picture a phone downloads is
// 200 KB or less, and every image has a width and a height).
//
// - a11y-on (newLook on): at 390 by 844 pixels and three times density, the
//   page's largest element (LCP) is the hero's still picture, the img in its
//   <picture>; the browser takes the 1600 pixel AVIF of slide 1 and the
//   bytes it transfers for it are 200,000 or less, the file as the
//   repository holds it, and it never asks for slide 1's JPEG, the img's own
//   src for a browser that shows neither format. With the page clock
//   installed and stopped before the page loads, then run on by 60 seconds,
//   the hero's picture, its chosen file and its box are the same, and it has
//   no slide control. With reduced motion asked for,
//   document.getAnimations() is empty on / and on the fixture page after
//   focus and hover on their buttons, a scroll and a click on words that go
//   nowhere. Every img on / has a width and a height (the
//   hero's and the footer's logo). axe with the WCAG 2.0, 2.1 and 2.2 A and
//   AA rules finds nothing in the hero.
// - a11y-off (newLook off): today's slideshow, five slides and their
//   controls, moving on to the second slide after 5 seconds of the page
//   clock, reduced motion or not, since the reduced-motion rule is the new
//   look's alone. Its largest element and the bytes of its five photos, and
//   the img elements on / (the header's and the footer's logo, which carry
//   no width or height attributes today), are measured and reported, not
//   held to the new look's limits.
// - Both builds: / does not scroll sideways at 390 pixels.
//
// Each test waits for the hero's heading and, on a11y-on, for its picture
// to load, not for network idle alone; the page's two lists may answer late
// or draw their error line, which does not change the hero. Reads only.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page, Response } from '@playwright/test'
import { expect, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const ROOT = join(import.meta.dirname, '../..')
/** The file a 390 pixel phone at three times density takes for the hero, as the repository holds it. */
const PHONE_FILE = readFileSync(join(ROOT, 'src/assets/generated/LCA_Slide_1-1600.avif'))
/** The address the build gives it: the file's name with its hash. */
const PHONE_PATH = /^\/assets\/LCA_Slide_1-1600-[\w-]+\.avif$/
const LIMIT = 200_000
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

/** Every largest-element entry the page reports, kept from before the page draws. */
function watchLargest() {
  const seen: Array<{ tag: string; url: string; size: number; startTime: number; inHero: boolean }> = []
  ;(window as unknown as { __largest: typeof seen }).__largest = seen
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as Array<PerformanceEntry & { element: Element | null; url: string; size: number }>) {
      seen.push({ tag: e.element?.tagName.toLowerCase() ?? '', url: e.url, size: e.size, startTime: e.startTime, inHero: !!e.element?.closest('[data-ground="dark"]') })
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true })
}

/** Opens / and waits for the hero's heading. */
async function openHome(page: Page) {
  await page.goto('/')
  const hero = page.locator('[data-ground="dark"]')
  await expect(hero.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })).toBeVisible()
  return hero
}

/** Opens / under the new look and waits for the hero's picture to load as well. */
async function openStillHome(page: Page) {
  const hero = await openHome(page)
  const img = hero.locator(':scope > picture > img')
  await expect(img).toHaveCount(1)
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  return { hero, img }
}

/** The hero's picture as drawn: the file the browser chose and its box. */
function pictureState(page: Page) {
  return page.locator('[data-ground="dark"] > picture > img').evaluate((el: HTMLImageElement) => {
    const box = el.getBoundingClientRect()
    return { currentSrc: new URL(el.currentSrc).pathname, box: [box.x, box.y, box.width, box.height].map(Math.round) }
  })
}

test.describe('the hero on a phone: its largest element and the bytes it takes', () => {
  test.use({ ...PHONE, colorScheme: 'light' })

  test('a11y-on at 390 pixels and three times density: the LCP element is the hero picture, its 1600 pixel AVIF, 200,000 bytes or less', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the still picture is drawn under the new look, on a11y-on')
    await page.addInitScript(watchLargest)
    const pictures: Response[] = []
    page.on('response', (response) => {
      if (/\.(avif|webp|jpe?g|png)$/.test(new URL(response.url()).pathname)) pictures.push(response)
    })
    // Every slide photo the page asks for, answered or not.
    const asked: string[] = []
    page.on('request', (request) => {
      if (/LCA_Slide_/.test(new URL(request.url()).pathname)) asked.push(new URL(request.url()).pathname)
    })
    const { img } = await openStillHome(page)
    await expect.poll(() => page.evaluate(() => (window as unknown as { __largest: Array<{ inHero: boolean }> }).__largest.some((e) => e.inHero))).toBe(true)
    // The lists below the hero may still be drawing; once the page is quiet, the last entry is the largest element.
    await page.waitForLoadState('networkidle')
    const largest = await page.evaluate(() => {
      const all = (window as unknown as { __largest: Array<{ tag: string; url: string; size: number; startTime: number; inHero: boolean }> }).__largest
      const last = all[all.length - 1]
      const timing = performance.getEntriesByName(last.url)[0] as PerformanceResourceTiming | undefined
      return { ...last, path: last.url ? new URL(last.url).pathname : '', transferSize: timing?.transferSize ?? null, encodedBodySize: timing?.encodedBodySize ?? null }
    })
    const chosen = await pictureState(page)
    const fetched = pictures.filter((r) => PHONE_PATH.test(new URL(r.url()).pathname))
    expect(fetched).toHaveLength(1)
    const body = await fetched[0].body()
    const note = `LCP at 390 pixels, three times density (a11y-on): <${largest.tag}> in the hero at ${Math.round(largest.startTime)} ms, ${largest.path}, ${largest.transferSize} bytes transferred (${largest.encodedBodySize} of them the file), served as ${fetched[0].headers()['content-type']}; the img's box ${chosen.box[2]} by ${chosen.box[3]} pixels, the hero's 390 by 420 under the photo's scale of 1.04. Pictures fetched: ${pictures.map((r) => new URL(r.url()).pathname).join(', ')}.`
    console.log(note)
    testInfo.annotations.push({ type: 'measured', description: note })
    expect(largest.tag).toBe('img')
    expect(largest.inHero).toBe(true)
    expect(largest.path).toMatch(PHONE_PATH)
    expect(chosen.currentSrc).toBe(largest.path)
    expect(largest.transferSize).not.toBeNull()
    expect(largest.transferSize!).toBeLessThanOrEqual(LIMIT)
    expect(body.length).toBe(PHONE_FILE.length)
    expect(body.equals(PHONE_FILE)).toBe(true)
    expect(fetched[0].headers()['content-type']).toBe('image/avif')
    // Only the hero's one file of the slide photos: none of the five slides, no WebP and no other width.
    expect(pictures.filter((r) => /LCA_Slide_/.test(r.url())).map((r) => new URL(r.url()).pathname)).toEqual([new URL(fetched[0].url()).pathname])
    // The img's own src is slide 1's JPEG, for a browser that shows neither format; this one never asks for it.
    expect(await img.getAttribute('src')).toMatch(/^\/assets\/LCA_Slide_1-[\w-]+\.jpg$/)
    expect(asked).toEqual([new URL(fetched[0].url()).pathname])
    expect(await img.getAttribute('fetchpriority')).toBe('high')
    expect(await img.getAttribute('loading')).toBe('eager')
  })

  test('a11y-off at 390 pixels: today\'s largest element and the five photos the slideshow fetches, measured', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s slideshow is drawn with newLook off, on a11y-off')
    await page.addInitScript(watchLargest)
    const slides: Response[] = []
    page.on('response', (response) => {
      if (/\/assets\/LCA_Slide_\d-[\w-]+\.jpg$/.test(new URL(response.url()).pathname)) slides.push(response)
    })
    await openHome(page)
    await expect.poll(() => slides.length).toBe(5)
    await expect.poll(() => page.evaluate(() => (window as unknown as { __largest: unknown[] }).__largest.length)).toBeGreaterThan(0)
    await page.waitForLoadState('networkidle')
    const largest = await page.evaluate(() => {
      const all = (window as unknown as { __largest: Array<{ tag: string; url: string; inHero: boolean; startTime: number }> }).__largest
      return all[all.length - 1]
    })
    const sizes = await Promise.all(slides.map(async (r) => (await r.body()).length))
    const note = `LCP at 390 pixels, three times density (a11y-off): <${largest.tag}>${largest.inHero ? ' in the hero' : ''} at ${Math.round(largest.startTime)} ms, ${largest.url ? new URL(largest.url).pathname : 'words'}; the slideshow fetched its five photos, ${sizes.reduce((a, b) => a + b, 0).toLocaleString('en-US')} bytes (${sizes.map((s) => s.toLocaleString('en-US')).join(', ')}).`
    console.log(note)
    testInfo.annotations.push({ type: 'measured', description: note })
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(2_171_020)
  })

  for (const project of [ON, OFF]) {
    test(`${project}: / does not scroll sideways at 390 pixels`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== project, `measured on ${project}`)
      await openHome(page)
      const widths = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
      expect(widths[0], `scroll width ${widths[0]} in a window ${widths[1]} wide`).toBeLessThanOrEqual(widths[1])
    })
  }
})

/**
 * Installs the page clock and stops it before the page loads, so no timer of
 * the page fires until the test runs the clock on.
 */
async function stopTheClock(page: Page) {
  const start = new Date('2026-10-21T12:00:00-05:00')
  await page.clock.install({ time: start })
  await page.clock.pauseAt(new Date(start.getTime() + 1000))
}

test.describe('the hero on the page clock', () => {
  test.use({ colorScheme: 'light' })

  test('a11y-on: after 60 seconds the hero is the same: its picture, its file, its box, and no slide control', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the still picture is drawn under the new look, on a11y-on')
    await stopTheClock(page)
    const { hero } = await openStillHome(page)
    const before = { picture: await pictureState(page), html: await hero.evaluate((el) => el.outerHTML) }
    await page.clock.runFor(60_000)
    const after = { picture: await pictureState(page), html: await hero.evaluate((el) => el.outerHTML) }
    expect(after).toEqual(before)
    expect(await hero.getByRole('button').count()).toBe(0)
    expect(await hero.locator('[style*="translateX"]').count()).toBe(0)
    expect(await hero.locator('source').evaluateAll((els) => els.map((s) => [s.getAttribute('type'), s.getAttribute('srcset')?.split(', ').length]))).toEqual([['image/avif', 3], ['image/webp', 3]])
  })

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    test.describe(`reduced motion ${reducedMotion === 'reduce' ? 'asked for' : 'not asked for'}`, () => {
      test.use({ reducedMotion })

      test(`a11y-off: today's slideshow moves on to the second slide after 5 seconds, reduced motion ${reducedMotion === 'reduce' ? 'asked for' : 'not asked for'}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== OFF, 'today\'s slideshow is drawn with newLook off, on a11y-off')
        await stopTheClock(page)
        const hero = await openHome(page)
        expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(reducedMotion === 'reduce')
        await expect(hero.getByRole('button', { name: /^Slide \d$/ })).toHaveCount(5)
        await expect(hero.getByRole('button', { name: 'Previous slide' })).toBeVisible()
        const track = hero.locator(':scope > div').first()
        // The browser writes the first slide's offset back as translateX(0%).
        await expect(track).toHaveAttribute('style', /^transform: translateX\(-?0%\);$/)
        await expect(hero.getByRole('button', { name: 'Slide 1' })).toHaveClass(/\bw-5\b/)
        await page.clock.runFor(5_000)
        await expect(track).toHaveAttribute('style', 'transform: translateX(-100%);')
        await expect(hero.getByRole('button', { name: 'Slide 2' })).toHaveClass(/\bw-5\b/)
      })
    })
  }
})

test.describe('reduced motion', () => {
  test.use({ colorScheme: 'light', reducedMotion: 'reduce' })

  /** Every animation the document holds, with what it animates, for the report. */
  const animations = (page: Page) =>
    page.evaluate(() => document.getAnimations().map((a) => {
      const target = (a.effect as KeyframeEffect | null)?.target
      return `${a.constructor.name} ${(a as CSSTransition).transitionProperty ?? (a as CSSAnimation).animationName ?? ''} on <${target?.tagName.toLowerCase() ?? '?'} class="${target?.getAttribute('class') ?? ''}">`
    }))

  test('a11y-on: nothing animates on / after focus and hover on the hero\'s buttons, a scroll and a click', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the reduced-motion rule is the new look\'s, on a11y-on')
    const { hero } = await openStillHome(page)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await page.evaluate(() => document.fonts.ready)
    const find = hero.getByRole('link', { name: 'Find a tournament' })
    const join = hero.getByRole('link', { name: 'Join LCA' })
    await find.hover()
    await join.hover()
    await page.keyboard.press('Tab')
    await join.focus()
    await find.focus()
    await page.mouse.wheel(0, 900)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.evaluate(() => window.scrollTo(0, 0))
    await hero.getByRole('heading', { level: 1 }).click()
    expect(page.url()).toMatch(/\/$/)
    expect(await animations(page)).toEqual([])
  })

  test('a11y-on: nothing animates on the fixture page after focus and hover on its buttons, a scroll and a click', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the reduced-motion rule is the new look\'s, on a11y-on')
    await page.goto('/__fixtures/base')
    const container = page.locator('[data-fixture="base"]')
    const heading = container.getByRole('heading', { level: 2, name: 'Every status' })
    await expect(heading).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const register = container.getByRole('button', { name: 'Register' })
    await register.hover()
    await container.getByRole('button', { name: 'Join the waitlist' }).hover()
    await page.keyboard.press('Tab')
    await register.focus()
    await page.mouse.wheel(0, 900)
    await page.evaluate(() => window.scrollTo(0, 0))
    await heading.click()
    expect(await animations(page)).toEqual([])
  })
})

test.describe('every image on / has a width and a height', () => {
  test.use({ colorScheme: 'light' })

  test('a11y-on: the hero\'s picture and the footer\'s logo, each with both', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the new look\'s images, on a11y-on')
    await openStillHome(page)
    await expect(page.locator('footer [data-slot="lca-logo"]')).toBeVisible()
    const images = await page.locator('img').evaluateAll((els) => els.map((el) => ({ where: el.closest('[data-ground="dark"]') ? 'hero' : el.closest('footer') ? 'footer' : el.closest('header') ? 'header' : 'page', width: el.getAttribute('width'), height: el.getAttribute('height') })))
    testInfo.annotations.push({ type: 'measured', description: `img elements on / (a11y-on): ${JSON.stringify(images)}` })
    expect(images).toEqual([
      { where: 'hero', width: '2048', height: '1237' },
      { where: 'footer', width: '56', height: '56' },
    ])
  })

  test('a11y-off: today\'s two, the header\'s and the footer\'s logo, sized by their classes with no width or height attributes, measured', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== OFF, 'today\'s images, on a11y-off')
    await openHome(page)
    await expect(page.locator('footer img')).toBeVisible()
    const images = await page.locator('img').evaluateAll((els) => els.map((el) => ({ where: el.closest('footer') ? 'footer' : el.closest('header') ? 'header' : 'page', width: el.getAttribute('width'), height: el.getAttribute('height'), className: el.getAttribute('class') })))
    const note = `img elements on / (a11y-off): ${JSON.stringify(images)}`
    console.log(note)
    testInfo.annotations.push({ type: 'measured', description: note })
    expect(images).toEqual([
      { where: 'header', width: null, height: null, className: 'h-11 w-11 rounded-lg object-contain' },
      { where: 'footer', width: null, height: null, className: 'h-14 w-14 rounded-xl object-contain' },
    ])
  })
})

test.describe('axe in the hero', () => {
  test.use({ colorScheme: 'light' })

  test('a11y-on: finds nothing in the still hero, at 1280 and 390 pixels', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the still hero, on a11y-on')
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 })
      await openStillHome(page)
      const results = await new AxeBuilder({ page }).include('[data-ground="dark"]').withTags(AXE_TAGS).analyze()
      const found = results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} at ${n.target.map(String).join(' ')}`))
      const note = `axe in the hero at ${width} pixels (a11y-on): ${results.passes.length} rules passed, ${found.length} finding(s).`
      console.log(note)
      testInfo.annotations.push({ type: 'measured', description: note })
      expect(found, String(width)).toEqual([])
    }
  })
})
