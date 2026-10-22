// test/a11y/scopes.spec.ts
//
// WS01 acceptance criterion 1 (step 32): axe with the WCAG 2.0, 2.1 and 2.2
// A and AA rules finds nothing on the pages the criterion names, in every
// look, on the a11y-on build (newLook and themeHeritage on), at 1280 and 390
// pixels wide.
//
// The pages: /, /tournaments, the tournament page of two seeded events (the
// finished one, whose pairings are published, and the open one, whose
// registration card is drawn), /clubs, /membership, /scholastic, /about,
// /governance/minutes and /champions, each opened through openDrawn and read
// once its heading and its data are drawn; and the scholastic fixture page.
//
// The looks, each read on every page:
// - light: the base look on a light device. On /about, /governance/minutes
//   and /champions, which HeritageLayout draws in its heritage scope, the
//   scope's own div is set to the base look (data-theme="").
// - dark: the base look on a dark device, which puts .dark on <html>, as a
//   visitor's device does; the class is checked, never added by hand. The
//   three heritage pages are set to the base look the same way.
// - live: data-theme="live" on <main> (on the scope's div for the three
//   heritage pages), on a light device. The live look is dark on any device,
//   so one reading is enough. <main> is given the ground and the words of
//   its look, as ThemeScope paints a box, so the page's real content is read
//   on the live ground; the header and the footer stay in the base look.
// - heritage: data-theme="heritage" on <main> for the six pages the layout
//   does not draw, and the three heritage pages as the layout draws them;
//   read on a light and on a dark device, since heritage has a dark block.
// A hand-set attribute never runs ThemeScope's own effect, which asks for a
// look's stylesheet and its type, so the matrix reads each look's colours,
// not its faces; the ground each look paints is checked before axe runs.
// The scholastic fixture page draws its own scholastic scope and is read
// whole, its header and footer included, on a light and a dark device.
//
// Every finding of every rule the tags select fails the test, whatever its
// impact, as in every other spec of the suite (the criterion asks for no
// serious or critical one). Each finding is printed with its rule, impact,
// selector, page, look and width, and for colour contrast its two colours
// and their ratio. The contrast checks axe could not finish (words over a
// picture, for one) are printed with their selectors and the reason axe
// gives, and do not fail the test. Both widths of a page and look are read
// before anything is asserted, so a run prints every finding at once.
// Nothing goes in known-violations.json. The page must also raise no script
// error and ask no host but the local server for anything.
//
// The a11y-off build has none of these looks, so every test here skips
// there. Reads only.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { expect, openDrawn, test } from './support'

const ON = 'a11y-on'
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const WIDTHS = [1280, 390] as const

type Scheme = 'light' | 'dark'
type Theme = 'base' | 'live' | 'heritage'

/** One reading of a page: the device's scheme and the look the content wears. */
interface Look {
  name: string
  scheme: Scheme
  theme: Theme
}

const LOOKS: readonly Look[] = [
  { name: 'light', scheme: 'light', theme: 'base' },
  { name: 'dark', scheme: 'dark', theme: 'base' },
  { name: 'live', scheme: 'light', theme: 'live' },
  { name: 'heritage', scheme: 'light', theme: 'heritage' },
  { name: 'heritage on a dark device', scheme: 'dark', theme: 'heritage' },
]

/** The ground each look paints, as the browser computes it. */
const GROUNDS: Record<Theme, Record<Scheme, string>> = {
  base: { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 18, 32)' },
  live: { light: 'rgb(7, 11, 20)', dark: 'rgb(7, 11, 20)' },
  heritage: { light: 'rgb(247, 243, 232)', dark: 'rgb(11, 18, 32)' },
}

interface AcPage {
  route: string
  /** Drawn by HeritageLayout in a heritage scope on this build. */
  heritage: boolean
  /** What the page shows once it is drawn: its heading and words of its data. */
  drawn: (page: Page) => Locator[]
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name })
const words = (page: Page, text: string | RegExp) => page.locator('main').getByText(text).first()

const PAGES: readonly AcPage[] = [
  { route: '/', heritage: false, drawn: (page) => [heading(page, 'Play. Compete. Connect.'), words(page, 'Fixture Fall Open')] },
  { route: '/tournaments', heritage: false, drawn: (page) => [heading(page, 'Tournaments'), page.locator('main').getByRole('button', { name: /Fixture Fall Open/ })] },
  { route: '/tournaments/fx-t-done', heritage: false, drawn: (page) => [heading(page, 'Fixture Summer Championship'), page.locator('main').getByRole('link', { name: /See pairings/ })] },
  { route: '/tournaments/fx-t-open', heritage: false, drawn: (page) => [heading(page, 'Fixture Fall Open'), words(page, 'Under 1600')] },
  { route: '/clubs', heritage: false, drawn: (page) => [heading(page, 'Find your chess community'), words(page, 'Fixture Capital Chess Club')] },
  { route: '/membership', heritage: false, drawn: (page) => [heading(page, 'LCA Membership'), page.locator('main [data-slot="button"][data-variant]').first()] },
  { route: '/scholastic', heritage: false, drawn: (page) => [heading(page, 'Chess in Louisiana schools'), words(page, 'Fixture Fall Open')] },
  { route: '/about', heritage: true, drawn: (page) => [heading(page, 'About LCA'), words(page, 'Who we are')] },
  { route: '/governance/minutes', heritage: true, drawn: (page) => [heading(page, 'Meeting minutes'), words(page, 'Fixture board meeting minutes')] },
  { route: '/champions', heritage: true, drawn: (page) => [heading(page, 'State champions'), words(page, 'Avery Fixture')] },
]

/** The scholastic token fixture page, which draws its own scholastic scope. */
const FIXTURE = { route: '/__fixtures/scholastic', selector: '[data-fixture="scholastic"]', ground: 'rgb(255, 250, 241)' } as const

type Results = Awaited<ReturnType<AxeBuilder['analyze']>>

interface Cell {
  route: string
  look: string
  width: number
  passed: number
  findings: string[]
  unfinished: string[]
}

/**
 * Every finding, one line each: rule, impact, selector, and for contrast the
 * two colours and their ratio (the words and their ground, or for a link in
 * a block of words the link's colour and the words' around it).
 */
function findingsOf(results: Results): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; nodeColor?: string; parentColor?: string; contrastRatio?: number }
    const colours = data.fgColor && data.bgColor ? `, ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1`
      : data.nodeColor && data.parentColor ? `, the link ${data.nodeColor} beside words in ${data.parentColor}, ${data.contrastRatio}:1`
        : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

/** The contrast checks axe could not finish, with the reason it gives (a picture or a gradient behind the words, for one). */
function unfinishedOf(results: Results): string[] {
  return results.incomplete.filter((r) => r.id === 'color-contrast').flatMap((r) => r.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { messageKey?: string }
    return `${n.target.map(String).join(' ')} (${data.messageKey ?? 'no reason given'})`
  }))
}

/**
 * Puts the look on the page's content and gives back the ground it paints:
 * on <main> for a page the layout does not draw, painted as a box scope is,
 * and on the heritage scope's own div for a heritage page.
 */
async function wear(page: Page, p: AcPage, look: Look): Promise<{ ground: string; theme: string | null; where: string }> {
  return page.evaluate(({ heritagePage, theme }) => {
    const main = document.querySelector('main')
    if (!main) throw new Error('the page has no main')
    if (heritagePage) {
      const scope = main.querySelector('[data-layout="heritage"]')
      if (!scope) throw new Error('the heritage page has no heritage scope')
      if (scope.getAttribute('data-theme') !== 'heritage') throw new Error('the heritage scope is not drawn in the heritage look')
      if (theme !== 'heritage') scope.setAttribute('data-theme', theme === 'base' ? '' : theme)
      return { ground: getComputedStyle(scope).backgroundColor, theme: scope.getAttribute('data-theme'), where: 'the heritage scope' }
    }
    if (main.querySelector('[data-theme]')) throw new Error('the page draws a scope of its own')
    if (theme === 'base') return { ground: getComputedStyle(document.body).backgroundColor, theme: null, where: 'the page' }
    main.setAttribute('data-theme', theme)
    main.classList.add('bg-background', 'text-foreground')
    return { ground: getComputedStyle(main).backgroundColor, theme: main.getAttribute('data-theme'), where: 'main' }
  }, { heritagePage: p.heritage, theme: look.theme })
}

/** Waits for two frames, so a change of look has been laid out and painted. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

/** The device the page is on: the new look, and .dark on <html> only on a dark device. */
const device = (page: Page) => page.evaluate(() => ({
  look: document.documentElement.getAttribute('data-look'),
  dark: document.documentElement.classList.contains('dark'),
}))

function report(cells: Cell[]): string {
  return cells.map((c) => [
    `AC1 ${c.route}, ${c.look}, ${c.width} pixels (${ON}): ${c.passed} rules passed, ${c.findings.length} finding(s), ${c.unfinished.length} contrast check(s) axe could not finish.`,
    ...c.findings.map((f) => `  finding: ${f}`),
    ...c.unfinished.map((u) => `  not finished: ${u}`),
  ].join('\n')).join('\n')
}

test.use({ reducedMotion: 'reduce' })

test.describe('AC1: the listed pages in every look', () => {
  for (const p of PAGES) {
    for (const look of LOOKS) {
      test(`${p.route}, ${look.name}, at 1280 and 390 pixels`, async ({ page, external }, testInfo) => {
        test.skip(testInfo.project.name !== ON, 'the looks are drawn on the a11y-on build only')
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.emulateMedia({ colorScheme: look.scheme })
        const cells: Cell[] = []
        const wrong: string[] = []
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 })
          await openDrawn(page, p.route, p.drawn(page))
          await page.evaluate(() => document.fonts.ready)
          const on = await device(page)
          if (on.look !== 'new' || on.dark !== (look.scheme === 'dark')) wrong.push(`${width} pixels: the device reads ${JSON.stringify(on)}`)
          const worn = await wear(page, p, look)
          await frames(page)
          if (worn.ground !== GROUNDS[look.theme][look.scheme]) wrong.push(`${width} pixels: ${worn.where} is ${worn.ground}, not the ${look.name} ground ${GROUNDS[look.theme][look.scheme]}`)
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
          cells.push({ route: p.route, look: look.name, width, passed: results.passes.length, findings: findingsOf(results), unfinished: unfinishedOf(results) })
        }
        const text = report(cells)
        console.log(text)
        await testInfo.attach(`ac1${p.route.replace(/\//g, '-')}-${look.name.replace(/ /g, '-')}.json`, { body: JSON.stringify(cells, null, 2), contentType: 'application/json' })
        expect(wrong, 'the look is not the one asked for').toEqual([])
        expect(cells.flatMap((c) => c.findings.map((f) => `${c.width} pixels: ${f}`)), text).toEqual([])
        expect(errors, 'script errors on the page').toEqual([])
        expect(external, 'requests to hosts other than the local server').toEqual([])
      })
    }
  }
})

test.describe('AC1: the scholastic token fixture page, whole', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`on a ${scheme} device, at 1280 and 390 pixels`, async ({ page, external }, testInfo) => {
      test.skip(testInfo.project.name !== ON, 'the looks are drawn on the a11y-on build only')
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.emulateMedia({ colorScheme: scheme })
      const cells: Cell[] = []
      const wrong: string[] = []
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 })
        const container = page.locator(FIXTURE.selector)
        await openDrawn(page, FIXTURE.route, [container.getByRole('heading', { level: 2, name: 'Every status' })])
        await page.evaluate(() => document.fonts.ready)
        const on = await device(page)
        if (on.look !== 'new' || on.dark !== (scheme === 'dark')) wrong.push(`${width} pixels: the device reads ${JSON.stringify(on)}`)
        const scope = await container.evaluate((el) => ({ theme: el.getAttribute('data-theme'), ground: getComputedStyle(el).backgroundColor }))
        if (scope.theme !== 'scholastic' || scope.ground !== FIXTURE.ground) wrong.push(`${width} pixels: the fixture reads ${JSON.stringify(scope)}`)
        const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
        cells.push({ route: FIXTURE.route, look: `scholastic, ${scheme} device`, width, passed: results.passes.length, findings: findingsOf(results), unfinished: unfinishedOf(results) })
      }
      const text = report(cells)
      console.log(text)
      await testInfo.attach(`ac1-scholastic-fixture-${scheme}.json`, { body: JSON.stringify(cells, null, 2), contentType: 'application/json' })
      expect(wrong, 'the look is not the one asked for').toEqual([])
      expect(cells.flatMap((c) => c.findings.map((f) => `${c.width} pixels: ${f}`)), text).toEqual([])
      expect(errors, 'script errors on the page').toEqual([])
      expect(external, 'requests to hosts other than the local server').toEqual([])
    })
  }
})
