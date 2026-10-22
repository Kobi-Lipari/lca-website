// test/a11y/scopes-edges.spec.ts
//
// The edges of WS01 acceptance criterion 1 (step 32) that the matrix in
// test/a11y/scopes.spec.ts leaves unread.
//
// The contrast checks axe could not finish. axe marks words over a picture
// or a gradient, a cell partly scrolled out of its box and words too short
// to judge as incomplete, and the matrix prints them without failing. Here
// each one is read on its pixels, on every page and look where the matrix
// meets them: /, the finished event's page and the open event's page in all
// five readings (the base look on a light and a dark device, the live look,
// and heritage on a light and a dark device, set on <main> as the matrix
// sets them), and the scholastic fixture page on a light and a dark device,
// each at 1280 and 390 pixels. axe runs its contrast rule and every node it
// could not finish is found again: its words are hidden (their colour, and
// that of everything inside them, made transparent with no shadow, through
// the style attribute, which outranks every rule of the site), its content
// box is shot where it shows (inside every box around it that clips and
// inside the window, a pixel in from each side so its own edge is not read),
// and the words' colour, laid over each pixel where it is translucent, is
// compared with that pixel. The lowest ratio must reach what axe asks: 4.5:1,
// or 3:1 for large words (24 pixels, or 18.66 and bold). On / the hero's
// picture is decoded first, so its words are read over the picture and not
// over the ground drawn before the picture arrives.
//
// What the sweep's fixes do for a visitor, on both builds, with today's site
// (a11y-off, every switch off) read beside each to be unchanged:
// - the State champions link on /tournaments: underlined at rest under the
//   new look, light and dark, and only on hover with every switch off; and
//   the rule that underlines it reaches no other link on the pages AC1 names;
// - "See pairings / results" on the finished event's page: white words that
//   axe reads at 4.5:1 or more at rest, on hover and under the keyboard,
//   light and dark; today's navy with every switch off;
// - the two events' pages on a phone: no sideways scroll at 390 and 320
//   pixels, the sections table scrolling in its own box, which the keyboard
//   reaches, sees ringed at 3:1 or more, and scrolls with the arrow keys;
// - the club cards on /clubs: Tab reaches each club's name and its two
//   links and never the card, the name's ring reads 3:1 or more on the card,
//   and Enter and Space pick the club; today's card is the button;
// - the clubs' initials: a colour a club picked keeps its colour in the
//   light look and takes the look's ink on a dark ground (dark mode, the
//   live look, heritage on a dark device), reading 3:1 or more on its tint,
//   while brand gold keeps its own colour;
// - the same for a club's colour as words on a club's page, a page AC1 does
//   not name: the seeded club's contact link keeps the club's navy blue on a
//   light device and takes the look's ink on a dark one, where the navy blue
//   read 2.01:1 on the card, and axe reads it at 4.5:1 or more in both;
//   today's colour with every switch off;
// - the option ring of the /tournaments hero's filter menu with every switch
//   off is today's, the browser's ring with no offset.
//
// Reads only.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'

const ON = 'a11y-on'
const OFF = 'a11y-off'
const WIDTHS = [1280, 390] as const
const GOLD = 'rgb(200, 169, 74)'
const NAVY = 'rgb(26, 39, 68)'
const WHITE = 'rgb(255, 255, 255)'

type Scheme = 'light' | 'dark'
type Theme = 'base' | 'live' | 'heritage'

/** One reading of a page, as the matrix reads it: the device's scheme and the look the content wears. */
interface Reading {
  name: string
  scheme: Scheme
  theme: Theme
}

const READINGS: readonly Reading[] = [
  { name: 'light', scheme: 'light', theme: 'base' },
  { name: 'dark', scheme: 'dark', theme: 'base' },
  { name: 'live', scheme: 'light', theme: 'live' },
  { name: 'heritage', scheme: 'light', theme: 'heritage' },
  { name: 'heritage on a dark device', scheme: 'dark', theme: 'heritage' },
]

interface Drawn {
  route: string
  /** What the page shows once it is drawn: its heading and words of its data. */
  drawn: (page: Page) => Locator[]
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name })
const words = (page: Page, text: string) => page.locator('main').getByText(text).first()

const HOME: Drawn = { route: '/', drawn: (page) => [heading(page, 'Play. Compete. Connect.'), words(page, 'Fixture Fall Open')] }
const TOURNAMENTS: Drawn = { route: '/tournaments', drawn: (page) => [heading(page, 'Tournaments'), page.locator('main').getByRole('button', { name: /Fixture Fall Open/ })] }
const DONE: Drawn = { route: '/tournaments/fx-t-done', drawn: (page) => [heading(page, 'Fixture Summer Championship'), page.locator('main').getByRole('link', { name: /See pairings/ })] }
const OPEN: Drawn = { route: '/tournaments/fx-t-open', drawn: (page) => [heading(page, 'Fixture Fall Open'), words(page, 'Under 1600')] }
const CLUBS: Drawn = { route: '/clubs', drawn: (page) => [heading(page, 'Find your chess community'), words(page, 'Fixture Capital Chess Club')] }

/** The pages AC1 names, the tournament page on both seeded events, drawn as the matrix waits for them. */
const AC1_PAGES: readonly Drawn[] = [
  HOME,
  TOURNAMENTS,
  DONE,
  OPEN,
  CLUBS,
  { route: '/membership', drawn: (page) => [heading(page, 'LCA Membership'), page.locator('main [data-slot="button"][data-variant]').first()] },
  { route: '/scholastic', drawn: (page) => [heading(page, 'Chess in Louisiana schools'), words(page, 'Fixture Fall Open')] },
  { route: '/about', drawn: (page) => [heading(page, 'About LCA'), words(page, 'Who we are')] },
  { route: '/governance/minutes', drawn: (page) => [heading(page, 'Meeting minutes'), words(page, 'Fixture board meeting minutes')] },
  { route: '/champions', drawn: (page) => [heading(page, 'State champions'), words(page, 'Avery Fixture')] },
]

/** The scholastic token fixture page, which draws its own scholastic scope. */
const FIXTURE = '/__fixtures/scholastic'

function only(testInfo: TestInfo, project: string, why: string) {
  test.skip(testInfo.project.name !== project, why)
}

/** Waits for two frames, so a change has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** Waits until every animation and transition on the element has ended. */
const settled = (target: Locator) => target.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

/**
 * Puts the live or heritage look on <main>, painted as a box scope is (as the
 * matrix does for a page the heritage layout does not draw); the base look
 * needs nothing. Gives back what <main> then carries.
 */
async function wear(page: Page, theme: Theme): Promise<string | null> {
  const worn = await page.evaluate((t) => {
    const main = document.querySelector('main')
    if (!main) throw new Error('the page has no main')
    if (main.querySelector('[data-theme]')) throw new Error('the page draws a scope of its own')
    if (t === 'base') return main.getAttribute('data-theme')
    main.setAttribute('data-theme', t)
    main.classList.add('bg-background', 'text-foreground')
    return main.getAttribute('data-theme')
  }, theme)
  await frames(page)
  return worn
}

/** The device the page is on: the new look, and .dark on <html> only on a dark device. */
const device = (page: Page) =>
  page.evaluate(() => ({ look: document.documentElement.getAttribute('data-look'), dark: document.documentElement.classList.contains('dark') }))

/** Waits until the hero's picture on / is decoded, and gives back the file the browser took. */
async function heroPicture(page: Page): Promise<string> {
  const img = page.locator('main [data-ground="dark"] img').first()
  return img.evaluate(async (el: HTMLImageElement) => {
    await el.decode()
    if (!el.complete || el.naturalWidth === 0) throw new Error('the hero picture did not load')
    return el.currentSrc.split('/').pop() ?? el.currentSrc
  })
}

/** Colours as the browser paints them, [r, g, b, a] with each from 0 to 255. */
function paint(page: Page, colours: string[]): Promise<number[][]> {
  return page.evaluate((list) => list.map((colour) => {
    const swatch = new OffscreenCanvas(1, 1).getContext('2d')
    if (!swatch) throw new Error('no canvas')
    swatch.fillStyle = colour
    swatch.fillRect(0, 0, 1, 1)
    return [...swatch.getImageData(0, 0, 1, 1).data]
  }), colours)
}

/** WCAG 2.x contrast of a colour laid over an opaque ground, both as [r, g, b, a] from paint(). */
function contrast(over: number[], ground: number[]): number {
  const a = over[3] / 255
  const mixed = [0, 1, 2].map((i) => a * over[i] + (1 - a) * ground[i])
  const channel = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const luminance = (c: number[]) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2])
  const [l1, l2] = [luminance(mixed), luminance(ground)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

/** What words read against the pixels drawn behind them. */
interface GroundReading {
  target: string
  words: string
  /** What axe asks of these words: 4.5, or 3 for large words. */
  needs: number
  lowest: number
  colour: string
  against: string
  pixels: number
}

/**
 * Reads an element's words against the pixels behind them, as the header
 * says: the words hidden through the style attribute, the content box shot
 * where it shows, the lowest ratio of the words' colour over each pixel.
 */
async function readGround(page: Page, target: string): Promise<GroundReading> {
  const box = await page.evaluate((selector) => {
    const node = document.querySelector(selector)
    if (!(node instanceof HTMLElement)) return null
    node.scrollIntoView({ block: 'center', inline: 'center' })
    const s = getComputedStyle(node)
    const px = (v: string) => parseFloat(v) || 0
    const r = node.getBoundingClientRect()
    let left = r.left + px(s.borderLeftWidth) + px(s.paddingLeft)
    let top = r.top + px(s.borderTopWidth) + px(s.paddingTop)
    let right = r.right - px(s.borderRightWidth) - px(s.paddingRight)
    let bottom = r.bottom - px(s.borderBottomWidth) - px(s.paddingBottom)
    for (let up = node.parentElement; up; up = up.parentElement) {
      const us = getComputedStyle(up)
      if (us.overflowX === 'visible' && us.overflowY === 'visible') continue
      const ur = up.getBoundingClientRect()
      left = Math.max(left, ur.left + px(us.borderLeftWidth))
      right = Math.min(right, ur.right - px(us.borderRightWidth))
      top = Math.max(top, ur.top + px(us.borderTopWidth))
      bottom = Math.min(bottom, ur.bottom - px(us.borderBottomWidth))
    }
    left = Math.max(left, 0)
    top = Math.max(top, 0)
    right = Math.min(right, document.documentElement.clientWidth)
    bottom = Math.min(bottom, document.documentElement.clientHeight)
    // Every value is read before the words are hidden, since the computed style is live.
    const reading = {
      x: Math.ceil(left) + 1,
      y: Math.ceil(top) + 1,
      width: Math.floor(right) - Math.ceil(left) - 2,
      height: Math.floor(bottom) - Math.ceil(top) - 2,
      colour: s.color,
      size: px(s.fontSize),
      weight: Number(s.fontWeight) || 400,
      words: (node.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
    }
    const hidden = [node, ...node.querySelectorAll<HTMLElement | SVGElement>('*')]
    const before = hidden.map((el) => el.getAttribute('style'))
    for (const el of hidden) {
      el.style.setProperty('color', 'transparent', 'important')
      el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important')
      el.style.setProperty('text-shadow', 'none', 'important')
      el.style.setProperty('text-decoration-color', 'transparent', 'important')
    }
    ;(window as unknown as { groundReadRestore: () => void }).groundReadRestore = () => {
      hidden.forEach((el, i) => (before[i] === null ? el.removeAttribute('style') : el.setAttribute('style', before[i] as string)))
    }
    return { ...reading, hiddenColour: getComputedStyle(node).color }
  }, target)
  if (!box) throw new Error(`${target} is not on the page`)
  try {
    if (box.hiddenColour !== 'rgba(0, 0, 0, 0)') throw new Error(`the words of ${target} could not be hidden (${box.hiddenColour})`)
    if (box.width < 1 || box.height < 1) throw new Error(`${target} shows no box to read`)
    await frames(page)
    const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height }, animations: 'disabled', caret: 'hide', scale: 'css' })
    const read = await page.evaluate(async ({ png, colour }) => {
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      const swatch = new OffscreenCanvas(1, 1).getContext('2d')
      if (!context || !swatch) throw new Error('no canvas')
      context.drawImage(bitmap, 0, 0)
      const data = context.getImageData(0, 0, bitmap.width, bitmap.height).data
      swatch.fillStyle = colour
      swatch.fillRect(0, 0, 1, 1)
      const [fr, fg, fb, fa] = swatch.getImageData(0, 0, 1, 1).data
      const alpha = fa / 255
      const channel = (c: number) => {
        const v = c / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
      }
      const luminance = (r: number, g: number, b: number) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
      let lowest = Infinity
      let against = ''
      for (let i = 0; i < data.length; i += 4) {
        const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
        const lw = luminance(alpha * fr + (1 - alpha) * r, alpha * fg + (1 - alpha) * g, alpha * fb + (1 - alpha) * b)
        const lg = luminance(r, g, b)
        const ratio = (Math.max(lw, lg) + 0.05) / (Math.min(lw, lg) + 0.05)
        if (ratio < lowest) {
          lowest = ratio
          against = `rgb(${r}, ${g}, ${b})`
        }
      }
      return { lowest, against, colour: `rgba(${fr}, ${fg}, ${fb}, ${Math.round(alpha * 1000) / 1000})`, pixels: data.length / 4 }
    }, { png: shot.toString('base64'), colour: box.colour })
    // axe's measure of large words: 18 points, or 14 points and bold.
    const points = Math.ceil(box.size * 72) / 96
    const large = box.weight >= 700 ? points >= 14 : points >= 18
    return { target, words: box.words, needs: large ? 3 : 4.5, lowest: Math.floor(read.lowest * 100) / 100, colour: read.colour, against: read.against, pixels: read.pixels }
  } finally {
    await page.evaluate(() => (window as unknown as { groundReadRestore?: () => void }).groundReadRestore?.())
  }
}

/** The colour-contrast checks axe could not finish on the page as it stands, by selector. */
async function unfinished(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()
  return results.incomplete.filter((r) => r.id === 'color-contrast').flatMap((r) => r.nodes.map((n) => n.target.map(String).join(' ')))
}

test.use({ reducedMotion: 'reduce' })

test.describe('AC1: the contrast checks axe could not finish, read on their pixels', () => {
  for (const p of [HOME, DONE, OPEN]) {
    for (const reading of READINGS) {
      test(`${p.route}, ${reading.name}, at 1280 and 390 pixels`, async ({ page, external }, testInfo) => {
        only(testInfo, ON, 'the looks are drawn on the a11y-on build only')
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.emulateMedia({ colorScheme: reading.scheme })
        const lines: string[] = []
        const low: string[] = []
        const wrong: string[] = []
        const counts: number[] = []
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 })
          await openDrawn(page, p.route, p.drawn(page))
          await page.evaluate(() => document.fonts.ready)
          const picture = p === HOME ? await heroPicture(page) : ''
          const on = await device(page)
          if (on.look !== 'new' || on.dark !== (reading.scheme === 'dark')) wrong.push(`${width} pixels: the device reads ${JSON.stringify(on)}`)
          const worn = await wear(page, reading.theme)
          if (worn !== (reading.theme === 'base' ? null : reading.theme)) wrong.push(`${width} pixels: main wears ${worn}`)
          const targets = await unfinished(page)
          counts.push(targets.length)
          lines.push(`AC1 unfinished checks on ${p.route}, ${reading.name}, ${width} pixels (${ON}): ${targets.length} read on their pixels${picture ? `, over the hero picture ${picture}` : ''}.`)
          for (const target of targets) {
            const r = await readGround(page, target)
            lines.push(`  ${r.target} ("${r.words}"): lowest ${r.lowest}:1 (${r.colour} over ${r.against}, ${r.pixels} pixels), needs ${r.needs}:1`)
            if (!(r.lowest >= r.needs)) low.push(`${width} pixels: ${r.target} ("${r.words}") reads ${r.lowest}:1 over ${r.against}, needs ${r.needs}:1`)
          }
        }
        const text = lines.join('\n')
        console.log(text)
        await testInfo.attach(`unfinished${p.route.replace(/\//g, '-')}-${reading.name.replace(/ /g, '-')}.txt`, { body: text, contentType: 'text/plain' })
        expect(wrong, 'the look is not the one asked for').toEqual([])
        // The hero's words over its picture are the checks axe leaves on /, at both widths.
        if (p === HOME) for (const count of counts) expect(count, text).toBeGreaterThan(0)
        expect(low, text).toEqual([])
        expect(errors, 'script errors on the page').toEqual([])
        expect(external, 'requests to hosts other than the local server').toEqual([])
      })
    }
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`the scholastic fixture page on a ${scheme} device, at 1280 and 390 pixels`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the looks are drawn on the a11y-on build only')
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.emulateMedia({ colorScheme: scheme })
      const lines: string[] = []
      const low: string[] = []
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        const container = page.locator('[data-fixture="scholastic"]')
        await openDrawn(page, FIXTURE, [container.getByRole('heading', { level: 2, name: 'Every status' })])
        await page.evaluate(() => document.fonts.ready)
        expect(await container.getAttribute('data-theme')).toBe('scholastic')
        const targets = await unfinished(page)
        lines.push(`AC1 unfinished checks on the scholastic fixture page, ${scheme} device, ${width} pixels (${ON}): ${targets.length} read on their pixels.`)
        for (const target of targets) {
          const r = await readGround(page, target)
          lines.push(`  ${r.target} ("${r.words}"): lowest ${r.lowest}:1 (${r.colour} over ${r.against}, ${r.pixels} pixels), needs ${r.needs}:1`)
          if (!(r.lowest >= r.needs)) low.push(`${width} pixels: ${r.target} ("${r.words}") reads ${r.lowest}:1 over ${r.against}, needs ${r.needs}:1`)
        }
      }
      const text = lines.join('\n')
      console.log(text)
      await testInfo.attach(`unfinished-scholastic-fixture-${scheme}.txt`, { body: text, contentType: 'text/plain' })
      expect(low, text).toEqual([])
      expect(errors, 'script errors on the page').toEqual([])
      expect(external, 'requests to hosts other than the local server').toEqual([])
    })
  }
})

/** The State champions link in the /tournaments hero's subtitle. */
const championsLink = (page: Page) => page.locator('main').getByRole('link', { name: /State champions/ })

/** How a link is drawn: its line, its colour, and whether it is a paragraph's own. */
const lineOf = (link: Locator) =>
  link.evaluate((el) => ({ line: getComputedStyle(el).textDecorationLine, colour: getComputedStyle(el).color, inParagraph: el.parentElement?.tagName === 'P' }))

test.describe('the State champions link on /tournaments', () => {
  test('a11y-on: underlined at rest and on hover, light and dark, in brand gold', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the rule is the new look\'s, on a11y-on')
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, TOURNAMENTS.route, TOURNAMENTS.drawn(page))
      const link = championsLink(page)
      await page.mouse.move(0, 0)
      const rest = await lineOf(link)
      await link.hover()
      const hover = await lineOf(link)
      seen[scheme] = { rest, hover }
      expect(rest, scheme).toEqual({ line: 'underline', colour: GOLD, inParagraph: true })
      expect(hover, scheme).toEqual({ line: 'underline', colour: GOLD, inParagraph: true })
    }
    testInfo.annotations.push({ type: 'measured', description: JSON.stringify(seen) })
    expect(external).toEqual([])
  })

  test('a11y-off: underlined only on hover, as today, in brand gold', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s link, on a11y-off')
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, TOURNAMENTS.route, TOURNAMENTS.drawn(page))
      const link = championsLink(page)
      await page.mouse.move(0, 0)
      expect(await lineOf(link), scheme).toEqual({ line: 'none', colour: GOLD, inParagraph: true })
      await link.hover()
      expect(await lineOf(link), scheme).toEqual({ line: 'underline', colour: GOLD, inParagraph: true })
    }
    expect(external).toEqual([])
  })

  test('a11y-on: the rule that underlines it reaches no other link on the pages AC1 names', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the rule is the new look\'s, on a11y-on')
    const found: Record<string, Array<string | null>> = {}
    for (const p of AC1_PAGES) {
      await openDrawn(page, p.route, p.drawn(page))
      found[p.route] = await page.evaluate(() => [...document.querySelectorAll('p > a.text-lca-gold')].map((a) => a.getAttribute('href')))
    }
    const expected = Object.fromEntries(AC1_PAGES.map((p) => [p.route, p.route === '/tournaments' ? ['/champions'] : []]))
    expect(found).toEqual(expected)
    expect(external).toEqual([])
  })
})

/** The live "See pairings / results" link in the finished event's hero. */
const pairingsLink = (page: Page) => page.locator('main').getByRole('link', { name: /See pairings/ })

/** The link's colour, and axe's contrast reading of it in the state it is in. */
async function pairingsReading(page: Page, link: Locator) {
  await settled(link)
  const colour = await link.evaluate((el) => getComputedStyle(el).color)
  const results = await new AxeBuilder({ page }).include('main a[href$="/pairings"]').withRules(['color-contrast']).analyze()
  const passed = results.passes.flatMap((r) => r.nodes.map((n) => (n.any[0]?.data as { contrastRatio?: number; bgColor?: string } | undefined) ?? {}))
  return {
    colour,
    found: results.violations.flatMap((r) => r.nodes.map((n) => JSON.stringify(n.any[0]?.data ?? {}))),
    unfinished: results.incomplete.length,
    ratios: passed.map((d) => d.contrastRatio ?? 0),
    grounds: passed.map((d) => d.bgColor ?? ''),
  }
}

test.describe('"See pairings / results" on the finished event\'s page', () => {
  test('a11y-on: white words that axe reads at 4.5:1 or more at rest, on hover and under the keyboard, light and dark', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, DONE.route, DONE.drawn(page))
      const link = pairingsLink(page)
      await page.mouse.move(0, 0)
      const rest = await pairingsReading(page, link)
      await link.hover()
      const hover = await pairingsReading(page, link)
      await page.mouse.move(0, 0)
      // The keyboard: from the event's name, Tab moves on until the link has the focus.
      await heading(page, 'Fixture Summer Championship').click()
      for (let i = 0; i < 8 && !(await link.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
      await expect(link, scheme).toBeFocused()
      expect(await link.evaluate((el) => el.matches(':focus-visible')), scheme).toBe(true)
      const focus = await pairingsReading(page, link)
      seen[scheme] = { rest, hover, focus }
      for (const [state, r] of Object.entries({ rest, hover, focus })) {
        expect(r.colour, `${scheme}, ${state}`).toBe(WHITE)
        expect(r.found, `${scheme}, ${state}`).toEqual([])
        expect(r.unfinished, `${scheme}, ${state}`).toBe(0)
        expect(r.ratios, `${scheme}, ${state}`).toHaveLength(1)
        expect(r.ratios[0], `${scheme}, ${state}`).toBeGreaterThanOrEqual(4.5)
      }
      // Hover lays more gold over the hero: the ground is not the one at rest.
      expect(hover.grounds[0], scheme).not.toBe(rest.grounds[0])
    }
    console.log(`"See pairings / results" (${ON}): ${JSON.stringify(seen)}`)
    testInfo.annotations.push({ type: 'measured', description: JSON.stringify(seen) })
    expect(external).toEqual([])
  })

  test('a11y-off: today\'s navy words, on a light and a dark device', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s button, on a11y-off')
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, DONE.route, DONE.drawn(page))
      const link = pairingsLink(page)
      await page.mouse.move(0, 0)
      const rest = await pairingsReading(page, link)
      seen[scheme] = rest
      expect(rest.colour, scheme).toBe(NAVY)
      expect(await link.getAttribute('class'), scheme).toMatch(/(?:^| )text-ink(?: |$)/)
    }
    // Recorded under Follow-ups as today's site: navy on the hero's gold tint.
    console.log(`"See pairings / results" (${OFF}): ${JSON.stringify(seen)}`)
    expect(external).toEqual([])
  })
})

/** The box the sections table scrolls in: the element after the Sections heading. */
const sectionsBox = (page: Page) => page.getByRole('heading', { level: 2, name: 'Sections' }).locator('xpath=following-sibling::*[1]')

/** How a page and its sections box fit the window. */
const fit = (page: Page) =>
  sectionsBox(page).evaluate((box) => ({
    page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    box: [box.scrollWidth, box.clientWidth],
    role: box.getAttribute('role'),
    label: box.getAttribute('aria-label'),
    tabIndex: box.tabIndex,
  }))

test.describe('the events\' pages on a phone', () => {
  test('a11y-on: neither page scrolls sideways at 390 or 320 pixels; the sections table scrolls in its own named box', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
    const seen: string[] = []
    for (const width of [390, 320]) {
      for (const p of [DONE, OPEN]) {
        await page.setViewportSize({ width, height: 900 })
        await openDrawn(page, p.route, p.drawn(page))
        const m = await fit(page)
        seen.push(`${p.route} at ${width} pixels: page ${m.page.join(' in ')}, box ${m.box.join(' in ')}`)
        expect(m.page[0], `${p.route} at ${width}`).toBeLessThanOrEqual(m.page[1])
        expect(m.box[0], `${p.route} at ${width}: the table is wider than its box`).toBeGreaterThan(m.box[1])
        expect({ role: m.role, label: m.label, tabIndex: m.tabIndex }, `${p.route} at ${width}`).toEqual({ role: 'region', label: 'Sections', tabIndex: 0 })
      }
    }
    console.log(`The events' pages on a phone (${ON}): ${seen.join('; ')}`)
    expect(external).toEqual([])
  })

  test('a11y-off: today\'s page is wider than a 390 pixel phone, and its sections box is no region', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s page, on a11y-off')
    await page.setViewportSize({ width: 390, height: 900 })
    const seen: string[] = []
    for (const p of [DONE, OPEN]) {
      await openDrawn(page, p.route, p.drawn(page))
      const m = await fit(page)
      seen.push(`${p.route}: page ${m.page.join(' in ')}`)
      // Recorded under Follow-ups: with newLook off the page still scrolls sideways on a phone.
      expect(m.page[0], p.route).toBeGreaterThan(m.page[1])
      expect({ role: m.role, label: m.label, tabIndex: m.tabIndex }, p.route).toEqual({ role: null, label: null, tabIndex: -1 })
    }
    console.log(`The events' pages at 390 pixels (${OFF}): ${seen.join('; ')}`)
    expect(external).toEqual([])
  })
})

test.describe('the sections table\'s box under the keyboard', () => {
  test('a11y-on: Tab after the heading reaches the box, its ring reads 3:1 or more on the page, and the arrow keys scroll it, light and dark', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
    await page.setViewportSize({ width: 390, height: 900 })
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, OPEN.route, OPEN.drawn(page))
      const box = page.getByRole('region', { name: 'Sections' })
      await page.getByRole('heading', { level: 2, name: 'Sections' }).click()
      await page.keyboard.press('Tab')
      await expect(box, scheme).toBeFocused()
      await settled(box)
      const ring = await box.evaluate((el) => {
        const s = getComputedStyle(el)
        return { visible: el.matches(':focus-visible'), style: s.outlineStyle, width: s.outlineWidth, colour: s.outlineColor, ground: getComputedStyle(document.body).backgroundColor, left: el.scrollLeft }
      })
      const [line, ground] = await paint(page, [ring.colour, ring.ground])
      const ratio = contrast(line, ground)
      seen[scheme] = { ...ring, ratio: Math.round(ratio * 100) / 100 }
      expect(ring.visible, scheme).toBe(true)
      expect([ring.style, ring.width], scheme).toEqual(['solid', '2px'])
      expect(ratio, scheme).toBeGreaterThanOrEqual(3)
      expect(ring.left, scheme).toBe(0)
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => box.evaluate((el) => el.scrollLeft), { message: `${scheme}: the arrow key scrolls the box` }).toBeGreaterThan(0)
    }
    testInfo.annotations.push({ type: 'measured', description: JSON.stringify(seen) })
    expect(external).toEqual([])
  })

  test('a11y-off: Tab after the heading passes the box by, as today', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s page, on a11y-off')
    await page.setViewportSize({ width: 390, height: 900 })
    await openDrawn(page, OPEN.route, OPEN.drawn(page))
    await page.getByRole('heading', { level: 2, name: 'Sections' }).click()
    await page.keyboard.press('Tab')
    const box = sectionsBox(page)
    expect(await box.evaluate((el) => el === document.activeElement)).toBe(false)
    expect(await box.evaluate((el) => el.contains(document.activeElement))).toBe(false)
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    expect(external).toEqual([])
  })
})

/** Where the focus is, in words: the element, its role and its name. */
const stop = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement
    const name = (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/[^\x20-\x7e]/g, '').trim()
    return `${el.tagName} ${el.getAttribute('role') ?? ''} ${name}`.replace(/ {2}/g, ' ')
  })

/** Gives the element keyboard focus, then waits for any transition to finish. */
async function keyboardFocus(page: Page, target: Locator) {
  await page.keyboard.press('Tab')
  await target.focus()
  expect(await target.evaluate((el) => el.matches(':focus-visible'))).toBe(true)
  await settled(target)
}

/** Opens /clubs with the two seeded clubs alone in the list, the search box focused. */
async function twoClubs(page: Page) {
  await openDrawn(page, CLUBS.route, CLUBS.drawn(page))
  const search = page.getByRole('searchbox', { name: 'Search clubs' })
  await search.fill('Fixture')
  await expect(page.locator('main').getByRole('button', { name: /^Show .* on the map$/ })).toHaveCount(2)
  await search.focus()
}

/** The Tab stops from the first club's control on, six of them. */
async function clubStops(page: Page): Promise<string[]> {
  const stops: string[] = []
  for (let i = 0; i < 16 && stops.length < 6; i++) {
    await page.keyboard.press('Tab')
    const at = await stop(page)
    if (stops.length > 0 || at.includes('Show Fixture Capital Chess Club on the map')) stops.push(at)
  }
  return stops
}

test.describe('the club cards on /clubs under the keyboard', () => {
  test('a11y-on: Tab reaches each club\'s name and its two links, never the card; the name\'s ring reads 3:1 or more on the card; Enter and Space pick the club, light and dark', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await twoClubs(page)
      expect(await clubStops(page), scheme).toEqual([
        'BUTTON Show Fixture Capital Chess Club on the map',
        'A Visit club',
        'A Directions',
        'BUTTON Show Fixture North Chess Club on the map',
        'A Visit club',
        'A Directions',
      ])
      // No control holds another, and no card is a control of its own.
      expect(await page.locator('main [role="button"] a, main button a').count(), scheme).toBe(0)
      const cards = await page.locator('main').getByRole('link', { name: 'Visit club' }).evaluateAll((links) =>
        links.map((a) => {
          const card = a.closest('.group') as HTMLElement
          return ['role', 'tabindex', 'aria-pressed', 'aria-label'].filter((attr) => card.hasAttribute(attr))
        }),
      )
      expect(cards, scheme).toEqual([[], []])
      const capital = page.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' })
      const north = page.getByRole('button', { name: 'Show Fixture North Chess Club on the map' })
      await keyboardFocus(page, capital)
      const ring = await capital.evaluate((el) => {
        const s = getComputedStyle(el)
        const card = el.closest('.group') as HTMLElement
        return { style: s.outlineStyle, width: s.outlineWidth, colour: s.outlineColor, ground: getComputedStyle(card).backgroundColor }
      })
      const [line, ground] = await paint(page, [ring.colour, ring.ground])
      seen[scheme] = { ...ring, ratio: Math.round(contrast(line, ground) * 100) / 100 }
      expect([ring.style, ring.width], scheme).toEqual(['solid', '2px'])
      expect(ground[3], `${scheme}: the card's ground is opaque`).toBe(255)
      expect(contrast(line, ground), scheme).toBeGreaterThanOrEqual(3)
      await page.keyboard.press('Enter')
      await expect(capital, scheme).toHaveAttribute('aria-pressed', 'true')
      await expect(page, scheme).toHaveURL(/[?&]club=fx-club-capital(?:&|$)/)
      await keyboardFocus(page, north)
      await page.keyboard.press(' ')
      await expect(north, scheme).toHaveAttribute('aria-pressed', 'true')
      await expect(capital, scheme).toHaveAttribute('aria-pressed', 'false')
      await expect(page, scheme).toHaveURL(/[?&]club=fx-club-north(?:&|$)/)
    }
    testInfo.annotations.push({ type: 'measured', description: JSON.stringify(seen) })
    expect(external).toEqual([])
  })

  test('a11y-off: Tab reaches each card, as today, and Enter and Space pick the club', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s cards, on a11y-off')
    await twoClubs(page)
    expect(await clubStops(page)).toEqual([
      'DIV button Show Fixture Capital Chess Club on the map',
      'A Visit club',
      'A Directions',
      'DIV button Show Fixture North Chess Club on the map',
      'A Visit club',
      'A Directions',
    ])
    const capital = page.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' })
    const north = page.getByRole('button', { name: 'Show Fixture North Chess Club on the map' })
    await keyboardFocus(page, capital)
    await page.keyboard.press('Enter')
    await expect(capital).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/[?&]club=fx-club-capital(?:&|$)/)
    await keyboardFocus(page, north)
    await page.keyboard.press(' ')
    await expect(north).toHaveAttribute('aria-pressed', 'true')
    await expect(capital).toHaveAttribute('aria-pressed', 'false')
    expect(external).toEqual([])
  })
})

/** The two seeded clubs picked colours of their own: their initials. */
const OWN = { FC: 'rgb(31, 78, 121)', FN: 'rgb(46, 125, 50)' } as const

/**
 * Marks the initials of the two seeded clubs and of the first club that kept
 * brand gold (its tint is brand gold's), and gives back each one's colour,
 * the colour of its card's name (the look's ink, text-ink) and the colour
 * var(--gold-ink) paints in its panel.
 */
const initials = (page: Page) =>
  page.evaluate(() => {
    const spans = [...document.querySelectorAll<HTMLElement>('main span[aria-hidden="true"].select-none')]
    const gold = spans.find((s) => (s.parentElement?.style.backgroundColor ?? '').replace(/\s/g, '') === 'rgba(200,169,74,0.16)')
    const picked: Record<string, HTMLElement | undefined> = {
      FC: spans.find((s) => s.textContent === 'FC'),
      FN: spans.find((s) => s.textContent === 'FN'),
      gold,
    }
    const out: Record<string, { colour: string; ink: string; goldInk: string; selector: string }> = {}
    for (const [key, span] of Object.entries(picked)) {
      if (!span) continue
      span.setAttribute('data-initials-read', key)
      const name = span.closest('.group')?.querySelector('.text-ink') as HTMLElement
      const probe = document.createElement('span')
      probe.style.color = 'var(--gold-ink)'
      span.parentElement?.append(probe)
      out[key] = { colour: getComputedStyle(span).color, ink: getComputedStyle(name).color, goldInk: getComputedStyle(probe).color, selector: `[data-initials-read="${key}"]` }
      probe.remove()
    }
    return out
  })

test.describe('the clubs\' initials', () => {
  for (const reading of READINGS) {
    test(`a11y-on, ${reading.name}: a colour a club picked keeps its colour on a light ground and takes the look's ink on a dark one, reading 3:1 or more on its tint; brand gold keeps its own`, async ({ page, external }, testInfo) => {
      only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
      await page.emulateMedia({ colorScheme: reading.scheme })
      await openDrawn(page, CLUBS.route, CLUBS.drawn(page))
      await page.evaluate(() => document.fonts.ready)
      await wear(page, reading.theme)
      const darkGround = reading.scheme === 'dark' || reading.theme === 'live'
      const found = await initials(page)
      expect(Object.keys(found).sort(), 'the two seeded clubs and a club that kept brand gold').toEqual(['FC', 'FN', 'gold'])
      const lines: string[] = []
      for (const key of ['FC', 'FN'] as const) {
        const own = found[key]
        if (darkGround) expect(own.colour, key).toBe(own.ink)
        else expect(own.colour, key).toBe(OWN[key])
      }
      expect(found.gold.colour, 'brand gold').toBe(found.gold.goldInk)
      if (darkGround) expect(found.gold.colour, 'brand gold').not.toBe(found.gold.ink)
      for (const [key, f] of Object.entries(found)) {
        const r = await readGround(page, f.selector)
        lines.push(`${key}: ${f.colour} reads ${r.lowest}:1 at the lowest over ${r.against}, needs ${r.needs}:1`)
        expect(r.needs, key).toBe(3)
        expect(r.lowest, `${key}: ${f.colour} over ${r.against}`).toBeGreaterThanOrEqual(r.needs)
      }
      console.log(`The clubs' initials, ${reading.name} (${ON}): ${lines.join('; ')}`)
      expect(external).toEqual([])
    })
  }

  test('a11y-off: every club\'s initials are in the club\'s own colour, as today, on a light and a dark device', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s cards, on a11y-off')
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, CLUBS.route, CLUBS.drawn(page))
      const found = await initials(page)
      expect(found.FC.colour, scheme).toBe(OWN.FC)
      expect(found.FN.colour, scheme).toBe(OWN.FN)
      expect(found.gold.colour, scheme).toBe(GOLD)
    }
    expect(external).toEqual([])
  })
})

/** The seeded capital club's page, whose contact link is drawn in the club's own navy blue. */
const CLUB_PAGE: Drawn = {
  route: '/clubs/fx-club-capital',
  drawn: (page) => [heading(page, 'Fixture Capital Chess Club'), page.locator('main').getByRole('link', { name: 'capital-club@example.org' })],
}

/** The contact link's colour, the colour of the page's own ink beside it, and axe's contrast reading of the link. */
async function contactReading(page: Page) {
  const colours = await page.evaluate(() => {
    const link = document.querySelector('main a[href^="mailto:"]') as HTMLElement
    const ink = [...document.querySelectorAll<HTMLElement>('main h2')].find((h) => h.textContent === 'Upcoming tournaments') as HTMLElement
    return { link: getComputedStyle(link).color, ink: getComputedStyle(ink).color }
  })
  const results = await new AxeBuilder({ page }).include('main a[href^="mailto:"]').withRules(['color-contrast']).analyze()
  const passed = results.passes.flatMap((r) => r.nodes.map((n) => (n.any[0]?.data as { contrastRatio?: number } | undefined)?.contrastRatio ?? 0))
  return {
    ...colours,
    found: results.violations.flatMap((r) => r.nodes.map((n) => JSON.stringify(n.any[0]?.data ?? {}))),
    unfinished: results.incomplete.length,
    ratios: passed,
  }
}

test.describe('the contact link on a club\'s page, a club\'s colour as words beyond the pages AC1 names', () => {
  test('a11y-on: the club\'s own colour on a light device and the look\'s ink on a dark one, which axe reads at 4.5:1 or more in both', async ({ page, external }, testInfo) => {
    only(testInfo, ON, 'the fix is the new look\'s, on a11y-on')
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    const seen: Record<string, unknown> = {}
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, CLUB_PAGE.route, CLUB_PAGE.drawn(page))
      expect(await device(page), scheme).toEqual({ look: 'new', dark: scheme === 'dark' })
      const r = await contactReading(page)
      seen[scheme] = r
      if (scheme === 'light') expect(r.link, scheme).toBe(OWN.FC)
      else expect(r.link, scheme).toBe(r.ink)
      expect(r.found, scheme).toEqual([])
      expect(r.unfinished, scheme).toBe(0)
      expect(r.ratios, scheme).toHaveLength(1)
      expect(r.ratios[0], scheme).toBeGreaterThanOrEqual(4.5)
    }
    console.log(`The contact link on ${CLUB_PAGE.route} (${ON}): ${JSON.stringify(seen)}`)
    testInfo.annotations.push({ type: 'measured', description: JSON.stringify(seen) })
    expect(errors, 'script errors on the page').toEqual([])
    expect(external).toEqual([])
  })

  test('a11y-off: the club\'s own colour, as today, on a light and a dark device', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s page, on a11y-off')
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme })
      await openDrawn(page, CLUB_PAGE.route, CLUB_PAGE.drawn(page))
      const r = await contactReading(page)
      expect(r.link, scheme).toBe(OWN.FC)
      expect(await page.locator('main a[href^="mailto:"]').getAttribute('class'), scheme).toBe('hover:underline')
    }
    expect(external).toEqual([])
  })
})

test.describe('the filter menu in the /tournaments hero', () => {
  test('a11y-off: an option keeps today\'s ring, the browser\'s own with no offset', async ({ page, external }, testInfo) => {
    only(testInfo, OFF, 'today\'s menu, on a11y-off')
    await openDrawn(page, TOURNAMENTS.route, TOURNAMENTS.drawn(page))
    const hero = page.locator('main section.bg-brand-navy').first()
    const filter = hero.getByRole('button', { name: /^Louisiana \(\d+\)$/ })
    await keyboardFocus(page, filter)
    await page.keyboard.press('Enter')
    const option = hero.getByRole('button', { name: /^Mississippi \(\d+\)$/ })
    await expect(option).toBeVisible()
    await keyboardFocus(page, option)
    const ring = await option.evaluate((el) => {
      const s = getComputedStyle(el)
      return { style: s.outlineStyle, offset: s.outlineOffset }
    })
    expect(ring).toEqual({ style: 'auto', offset: '0px' })
    expect(external).toEqual([])
  })
})
