// test/a11y/home-edges.spec.ts
//
// The still hero picture at its edges in the browser (WS01 step 29).
// test/a11y/home.spec.ts holds the main run (a 390 pixel phone at three
// times density, the page clock, reduced motion, the images on /); this
// file adds what it leaves out.
//
// - a11y-on: the file the browser takes follows the hero's sizes in other
//   windows and at other densities. On a 390 pixel phone the picture is
//   drawn 696 pixels wide, wider than the screen, so the browser takes the
//   1024 pixel AVIF at one times density and the 1600 at twice; in a window
//   768 or 1024 pixels wide it takes the 1024, and at 1280 and 1920 the
//   1600. Each time the hero's is the one slide photo asked for, never
//   lazily, and never slide 1's JPEG, the img's own src.
// - a11y-on: the picture fills the hero as the slide's photo did. At 1280
//   and 390 pixels the hero is 420 pixels high with its bottom border, and
//   the picture's box is all of the hero inside that border (419 pixels
//   high), covered and centred, under the slide's darkening (grayscale 0.35,
//   brightness 0.55, contrast 1.05 and a scale of 1.04), with the navy tint
//   multiplied over it and the gradient over that, and the words on top:
//   what a pointer finds at the centre of the heading and of each link is
//   that heading and that link.
// - Both builds: when the two lists below the hero fail with the local
//   database's "database is locked", the hero is drawn in full and its
//   markup is the one drawn when the lists answer, the first Button on the
//   page is still the hero's "Find a tournament" (the one test/a11y/baseline.ts
//   samples on a11y-off), and the lists say they have nothing.
// - The 30 generated files: each decodes in the browser to its own slide in
//   the photo's colours. Drawn small beside the five photos, each file is
//   nearest its own photo, by far, so no file holds another slide; and
//   against its own photo no colour moves on average by more than 3 of 255
//   and the light and dark spread within 5 per cent, the AVIF and the WebP
//   alike, so neither format shifts the colours or the contrast (a range or
//   profile read wrongly would). Read once, on a11y-on, from the files on
//   disk.
//
// Each test waits for the hero (its heading, and on a11y-on its picture
// loaded), not for network idle alone. Reads only: the failing lists are
// answered in the browser and never reach the server.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, prepareLocalPage, test } from './support'

const ON = 'a11y-on'
const ROOT = join(import.meta.dirname, '../..')
const GENERATED = join(ROOT, 'src/assets/generated')
const LOCKED = 'database is locked: SQLITE_BUSY'

/** Opens / and waits for the hero's heading, and on a11y-on for its picture to load. */
async function openHome(page: Page, still: boolean) {
  await page.goto('/')
  const hero = page.locator('[data-ground="dark"]')
  await expect(hero.getByRole('heading', { level: 1, name: 'Play. Compete. Connect.' })).toBeVisible()
  if (still) {
    const img = hero.locator(':scope > picture > img')
    await expect(img).toHaveCount(1)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  }
  return hero
}

/** The windows and densities the hero's sizes is read in, and the width of the file each calls for. */
const CHOICES = [
  { width: 390, height: 844, density: 1, phone: true, file: 1024 },
  { width: 390, height: 844, density: 2, phone: true, file: 1600 },
  { width: 768, height: 1024, density: 1, phone: false, file: 1024 },
  { width: 1024, height: 768, density: 1, phone: false, file: 1024 },
  { width: 1280, height: 800, density: 1, phone: false, file: 1600 },
  { width: 1920, height: 1080, density: 1, phone: false, file: 1600 },
]

test('a11y-on: the browser takes the file the hero\'s sizes calls for in each window and at each density', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== ON, 'the still picture is drawn under the new look, on a11y-on')
  const measured: string[] = []
  for (const c of CHOICES) {
    const where = `${c.width} by ${c.height} pixels at ${c.density} times density`
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      viewport: { width: c.width, height: c.height },
      deviceScaleFactor: c.density,
      isMobile: c.phone,
      hasTouch: c.phone,
      colorScheme: 'light',
    })
    try {
      const page = await context.newPage()
      await prepareLocalPage(page)
      const slides: string[] = []
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname
        if (/LCA_Slide_/.test(path)) slides.push(path)
      })
      const hero = await openHome(page, true)
      const img = hero.locator(':scope > picture > img')
      const chosen = await img.evaluate((el: HTMLImageElement) => new URL(el.currentSrc).pathname)
      measured.push(`${where}: ${chosen}`)
      expect(chosen, where).toMatch(new RegExp(`^/assets/LCA_Slide_1-${c.file}-[\\w-]+\\.avif$`))
      expect(slides, where).toEqual([chosen])
      expect(await img.getAttribute('loading'), where).toBe('eager')
    } finally {
      await context.close()
    }
  }
  console.log(`The file the hero takes (a11y-on): ${measured.join('; ')}.`)
  testInfo.annotations.push({ type: 'measured', description: measured.join('; ') })
})

test.describe('the still picture in its box', () => {
  test.use({ colorScheme: 'light' })

  test('a11y-on: it fills the hero, covered and centred, under the slide\'s darkening, tint and gradient, with the words on top', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== ON, 'the still picture is drawn under the new look, on a11y-on')
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 })
      const hero = await openHome(page, true)
      const m = await hero.evaluate((el) => {
        const [picture, veil, gradient, label, words] = [...el.children] as HTMLElement[]
        const img = picture.querySelector('img') as HTMLImageElement
        const shown = getComputedStyle(img)
        const box = (node: HTMLElement) => [node.offsetLeft, node.offsetTop, node.offsetWidth, node.offsetHeight]
        // What a pointer finds at an element's centre: the element itself, or something inside it.
        const onTop = (node: Element) => {
          const r = node.getBoundingClientRect()
          const found = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return !!found && (found === node || node.contains(found))
        }
        return {
          tags: [...el.children].map((c) => c.tagName.toLowerCase()),
          hero: [el.clientWidth, el.clientHeight, el.offsetHeight, document.documentElement.clientWidth],
          img: box(img),
          imgInHero: img.offsetParent === el,
          fit: shown.objectFit,
          position: shown.objectPosition,
          filter: shown.filter,
          transform: shown.transform,
          veil: { box: box(veil), blend: getComputedStyle(veil).mixBlendMode, background: getComputedStyle(veil).backgroundColor },
          gradient: { box: box(gradient), image: getComputedStyle(gradient).backgroundImage },
          label: label.textContent,
          words: box(words),
          heading: onTop(words.querySelector('h1')!),
          links: [...words.querySelectorAll('a')].map((a) => [a.textContent, onTop(a)]),
        }
      })
      // The hero is 420 pixels high with its bottom border; the layers fill what is inside it, as the slides did.
      const [w, h, outer, pageWidth] = m.hero
      expect(m.tags, String(width)).toEqual(['picture', 'div', 'div', 'div', 'div'])
      expect([w, outer, h], String(width)).toEqual([pageWidth, 420, 419])
      expect(m.imgInHero, String(width)).toBe(true)
      expect(m.img, String(width)).toEqual([0, 0, w, h])
      expect([m.fit, m.position], String(width)).toEqual(['cover', '50% 50%'])
      expect(m.filter, String(width)).toBe('grayscale(0.35) brightness(0.55) contrast(1.05)')
      expect(m.transform, String(width)).toBe('matrix(1.04, 0, 0, 1.04, 0, 0)')
      expect(m.veil.box, String(width)).toEqual([0, 0, w, h])
      expect(m.veil.blend, String(width)).toBe('multiply')
      expect(m.veil.background, String(width)).not.toMatch(/^rgba\(0, 0, 0, 0\)$|^transparent$/)
      expect(m.gradient.box, String(width)).toEqual([0, 0, w, h])
      expect(m.gradient.image, String(width)).toMatch(/^linear-gradient\(/)
      expect(m.label, String(width)).toBe('Louisiana Chess Community')
      expect(m.words, String(width)).toEqual([0, 0, w, h])
      expect(m.heading, String(width)).toBe(true)
      expect(m.links, String(width)).toEqual([['Find a tournament', true], ['Join LCA', true]])
      testInfo.annotations.push({ type: 'measured', description: `${width} pixels: the hero ${w} by ${h}; the veil's ground ${m.veil.background}; the gradient ${m.gradient.image}` })
    }
  })
})

test.describe('the hero when the lists below it fail', () => {
  test.use({ colorScheme: 'light' })

  test('both builds: with both lists answering "database is locked", the hero is drawn in full, as it is when they answer', async ({ page }, testInfo) => {
    const still = testInfo.project.name === ON
    // The slideshow with newLook off waits on the page clock, so both loads show its first slide.
    const start = new Date('2026-10-21T12:00:00-05:00')
    await page.clock.install({ time: start })
    await page.clock.pauseAt(new Date(start.getTime() + 1000))
    const answered = await (await openHome(page, still)).evaluate((el) => el.outerHTML)

    const lists: string[] = []
    for (const pattern of ['**/api/clearinghouse*', '**/api/clubs']) {
      await page.route(pattern, (route) => {
        lists.push(new URL(route.request().url()).pathname)
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: LOCKED }) })
      })
    }
    const hero = await openHome(page, still)
    await expect(page.getByText('No upcoming tournaments.')).toBeVisible()
    await expect(page.getByText('No clubs listed yet.')).toBeVisible()
    expect([...new Set(lists)].sort()).toEqual(['/api/clearinghouse', '/api/clubs'])
    expect(await hero.evaluate((el) => el.outerHTML)).toBe(answered)
    // The first Button on the page is the one test/a11y/baseline.ts samples on a11y-off: the hero's, in its colours.
    const first = page.locator('main [data-slot="button"]').first()
    await expect(first).toHaveText('Find a tournament')
    await expect(first).toHaveAttribute('data-variant', 'default')
    expect(await hero.locator('[data-slot="button"]').first().evaluate((el, f) => el === f, await first.elementHandle())).toBe(true)
  })
})

/** The slide photos and their 30 files, served to the page from disk under one made-up path. */
const PHOTOS = [1, 2, 3, 4, 5].map((n) => `LCA_Slide_${n}.jpg`)
const FILES = readdirSync(GENERATED).sort()
const TYPES: Record<string, string> = { jpg: 'image/jpeg', avif: 'image/avif', webp: 'image/webp' }
/**
 * How near a file must be to its own photo, both drawn small: the mean
 * difference over every pixel and colour (out of 255; resizing alone moves
 * it by up to about 6, while two different slides differ by over 50), the
 * mean shift of each colour, and the spread of light and dark as a ratio.
 */
const NEAR = 10
const SHIFT = 3
const SPREAD = [0.95, 1.05]

test('a11y-on: each of the 30 generated files decodes to its own slide, in the photo\'s colours', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== ON, 'the files are the same for both builds; read once, on a11y-on')
  expect(FILES).toHaveLength(30)
  await page.route('**/__step29-files/**', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    if (name === 'index.html') return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Files</title>' })
    const path = name.endsWith('.jpg') ? join(ROOT, 'src/assets', name) : join(GENERATED, name)
    return route.fulfill({ status: 200, contentType: TYPES[name.split('.').pop() ?? ''], body: readFileSync(path) })
  })
  await page.goto('/__step29-files/index.html')
  const results = await page.evaluate(async ({ photos, files }) => {
    // Every picture is drawn at the same small size, so each is compared pixel by pixel with each photo.
    const [W, H] = [48, 32]
    async function pixels(name: string) {
      const blob = await (await fetch(`/__step29-files/${name}`)).blob()
      const bitmap = await createImageBitmap(blob, { resizeWidth: W, resizeHeight: H, resizeQuality: 'high' })
      const canvas = new OffscreenCanvas(W, H)
      const context = canvas.getContext('2d')!
      context.drawImage(bitmap, 0, 0)
      bitmap.close()
      return context.getImageData(0, 0, W, H).data
    }
    const round = (n: number) => Math.round(n * 1000) / 1000
    const distance = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
      let sum = 0
      for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
      return sum / ((a.length / 4) * 3)
    }
    const shift = (a: Uint8ClampedArray, b: Uint8ClampedArray) => [0, 1, 2].map((k) => {
      let sum = 0
      for (let i = k; i < a.length; i += 4) sum += a[i] - b[i]
      return sum / (a.length / 4)
    })
    const spread = (a: Uint8ClampedArray) => {
      const light: number[] = []
      for (let i = 0; i < a.length; i += 4) light.push(0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2])
      const mean = light.reduce((x, y) => x + y, 0) / light.length
      return Math.sqrt(light.reduce((x, y) => x + (y - mean) ** 2, 0) / light.length)
    }
    const reference = await Promise.all(photos.map(pixels))
    const out: Array<{ file: string; distances: number[]; shift: number[]; spread: number }> = []
    for (const file of files) {
      const own = Number(file.match(/^LCA_Slide_(\d)-/)![1]) - 1
      const drawn = await pixels(file)
      out.push({
        file,
        distances: reference.map((r) => round(distance(drawn, r))),
        shift: shift(drawn, reference[own]).map(round),
        spread: round(spread(drawn) / spread(reference[own])),
      })
    }
    return out
  }, { photos: PHOTOS, files: FILES })

  const report = results.map((r) => `${r.file}: from slides 1 to 5 ${r.distances.join('/')}, shift ${r.shift.join('/')}, spread ${r.spread}`)
  testInfo.annotations.push({ type: 'measured', description: `each file drawn at 48 by 32 beside the photos, out of 255: ${report.join('; ')}` })
  for (const { file, distances, shift, spread } of results) {
    const own = Number(file.match(/^LCA_Slide_(\d)-/)![1]) - 1
    const nearest = distances.indexOf(Math.min(...distances))
    expect(nearest, `${file} is nearest slide ${nearest + 1}: ${distances.join(', ')}`).toBe(own)
    expect(distances[own], file).toBeLessThanOrEqual(NEAR)
    for (const s of shift) expect(Math.abs(s), `${file} shifts its colours by ${shift.join(', ')}`).toBeLessThanOrEqual(SHIFT)
    expect(spread, `${file} spreads light and dark ${spread} times as much as its photo`).toBeGreaterThanOrEqual(SPREAD[0])
    expect(spread, `${file} spreads light and dark ${spread} times as much as its photo`).toBeLessThanOrEqual(SPREAD[1])
  }
})
