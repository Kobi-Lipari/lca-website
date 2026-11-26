// test/a11y/clubs-matrix.spec.ts
//
// The rest of the matrix for the clubs pages (WS09 step 38), on the clubs
// build alone (the a11y-clubs project: the a11y-on build's switches and
// newClubs, served as with CLUB_PAGES_ON set; see test/a11y/global-setup.ts).
// Axe with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing on
// /clubs and on a club's page in every look of the suite's matrix, at 1,440
// and at 390 pixels wide, each width read before anything is asserted.
//
// The looks are those of test/a11y/scopes.spec.ts, set the same way: light
// and dark are the base look on a light and on a dark device (.dark on
// <html> is checked, never added by hand); live is data-theme="live" on
// <main>, with <main> given the ground and words of its look as a box scope
// paints them, on a light device; heritage is data-theme="heritage" on
// <main>, on a light and on a dark device. Neither page draws a scope of its
// own, which is checked, and the ground each look paints is checked before
// axe runs. A hand-set look never runs ThemeScope's own effect, so the
// matrix reads each look's colours, not its faces.
//
// What this adds to the specs the clubs build already runs: the directory
// in light and dark at 1,440 and 390 is read in
// test/a11y/clubs-directory.spec.ts, so it is read here in the live and the
// two heritage looks; a club's page is read in clubs-page.spec.ts in the
// light look at 1,280 and 390, so both fixture clubs are read here in all
// five looks at 1,440 and 390. Neither page scrolling sideways at 320 and
// 390 is held by clubs-reflow.spec.ts, and a card lifting its pin, a pin
// selecting its card and the selected ring's contrast by
// clubs-directory.spec.ts.
//
// Every finding fails the test, whatever its impact, as in the suite's
// other specs (the criterion asks for no serious or critical one), and each
// is printed with its rule, impact, selector, page, look and width. Nothing
// goes in known-violations.json. The page must also raise no script error
// and ask no host but the local server for anything. The directory's list
// is answered with made-up clubs and its map is the stand-in, as in
// clubs-directory.spec.ts; the club pages are the two fixture clubs of
// scripts/seed/fixtures.sql. Reads only.
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT } from './global-setup'

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const WIDTHS = [1440, 390] as const
/** The flag that asks the build for the stand-in map, as src/areas/clubs/directoryPins.ts names it. */
const STAND_IN_FLAG = 'lcaMapStandIn'

type Scheme = 'light' | 'dark'
type Theme = 'base' | 'live' | 'heritage'

interface Look {
  name: string
  scheme: Scheme
  theme: Theme
}

const LIGHT: Look = { name: 'light', scheme: 'light', theme: 'base' }
const DARK: Look = { name: 'dark', scheme: 'dark', theme: 'base' }
const LIVE: Look = { name: 'live', scheme: 'light', theme: 'live' }
const HERITAGE: Look = { name: 'heritage', scheme: 'light', theme: 'heritage' }
const HERITAGE_DARK: Look = { name: 'heritage on a dark device', scheme: 'dark', theme: 'heritage' }

/** The ground each look paints, as the browser computes it (the same as test/a11y/scopes.spec.ts). */
const GROUNDS: Record<Theme, Record<Scheme, string>> = {
  base: { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 18, 32)' },
  live: { light: 'rgb(7, 11, 20)', dark: 'rgb(7, 11, 20)' },
  heritage: { light: 'rgb(247, 243, 232)', dark: 'rgb(11, 18, 32)' },
}

function row(id: string, name: string, city: string, region: string, point: [number, number] | null, statement: string | null, description: string | null = null) {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: '#1f4e79', image_url: null, region, latitude: null, longitude: null,
    slug: id, statement, description: statement ? null : description, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Four made-up clubs: two in one town, one with no statement, one with no point. */
const CLUBS = [
  row('example-rooks-club', 'Example Rooks Club', 'Example Village', 'North Louisiana', [32.5, -92.1], 'Saturdays at 10:00 AM at the Example Library.'),
  row('example-bishops-club', 'Example Bishops Club', 'Example City', 'Baton Rouge / East Central', [30.45, -91.18], 'Tuesdays at 7:00 PM in the Example Community Center.'),
  row('example-knights-club', 'Example Knights Club', 'Example City', 'Baton Rouge / East Central', [30.41, -91.1], null, 'A made-up club for players of every strength.'),
  row('example-pawns-club', 'Example Pawns Club', 'Example Town', 'New Orleans Metro', null, 'Thursdays at 6:30 PM.'),
]

interface MatrixPage {
  route: string
  looks: readonly Look[]
  /** What the page shows once it is drawn: its heading and words of its data. */
  drawn: (page: Page) => Locator[]
  /** Anything the page needs before it loads. */
  prepare?: (page: Page) => Promise<void>
}

const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true })

const PAGES: readonly MatrixPage[] = [
  {
    route: '/clubs',
    looks: [LIVE, HERITAGE, HERITAGE_DARK],
    drawn: (page) => [heading(page, 'Chess clubs in Louisiana'), page.getByRole('link', { name: /^Example Bishops Club/ })],
    prepare: async (page) => {
      await page.route('**/api/clubs', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ clubs: CLUBS }) }))
      await page.addInitScript((flag) => { (window as unknown as Record<string, unknown>)[flag] = true }, STAND_IN_FLAG)
    },
  },
  ...[
    { slug: 'fixture-capital-chess-club', name: 'Fixture Capital Chess Club' },
    { slug: 'fixture-north-chess-club', name: 'Fixture North Chess Club' },
  ].map((club) => ({
    route: `/clubs/${club.slug}`,
    looks: [LIGHT, DARK, LIVE, HERITAGE, HERITAGE_DARK],
    drawn: (page: Page) => [heading(page, club.name), page.getByRole('heading', { level: 2, name: `About ${club.name}`, exact: true })],
  })),
]

type Results = Awaited<ReturnType<AxeBuilder['analyze']>>

interface Cell {
  route: string
  look: string
  width: number
  passed: number
  findings: string[]
}

/** Every finding, one line each: rule, impact, selector, and for contrast the two colours and their ratio. */
function findingsOf(results: Results): string[] {
  return results.violations.flatMap((v) => v.nodes.map((n) => {
    const data = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number }
    const colours = data.fgColor && data.bgColor ? `, ${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1` : ''
    return `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}${colours}`
  }))
}

/** Puts the look on <main>, painted as a box scope is, and gives back the ground it paints. */
function wear(page: Page, look: Look): Promise<{ ground: string; where: string }> {
  return page.evaluate((theme) => {
    const main = document.querySelector('main')
    if (!main) throw new Error('the page has no main')
    if (main.querySelector('[data-theme]') || main.hasAttribute('data-theme')) throw new Error('the page draws a scope of its own')
    if (theme === 'base') return { ground: getComputedStyle(document.body).backgroundColor, where: 'the page' }
    main.setAttribute('data-theme', theme)
    main.classList.add('bg-background', 'text-foreground')
    return { ground: getComputedStyle(main).backgroundColor, where: 'main' }
  }, look.theme)
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
    `${c.route}, ${c.look}, ${c.width} pixels (${A11Y_CLUBS_VARIANT.name}): ${c.passed} rules passed, ${c.findings.length} finding(s).`,
    ...c.findings.map((f) => `  finding: ${f}`),
  ].join('\n')).join('\n')
}

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== A11Y_CLUBS_VARIANT.name, 'the new clubs pages are drawn on the clubs build alone')
}

test.use({ reducedMotion: 'reduce' })

test.describe('the clubs pages in every look of the matrix', () => {
  for (const p of PAGES) {
    for (const look of p.looks) {
      test(`${p.route}, ${look.name}, at 1440 and 390 pixels`, async ({ page, external }, testInfo) => {
        onlyClubs(testInfo)
        const errors: string[] = []
        page.on('pageerror', (e) => errors.push(e.message))
        await page.emulateMedia({ colorScheme: look.scheme })
        if (p.prepare) await p.prepare(page)
        const cells: Cell[] = []
        const wrong: string[] = []
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 })
          await openDrawn(page, p.route, p.drawn(page))
          await page.evaluate(() => document.fonts.ready)
          await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
          const on = await device(page)
          if (on.look !== 'new' || on.dark !== (look.scheme === 'dark')) wrong.push(`${width} pixels: the device reads ${JSON.stringify(on)}`)
          const worn = await wear(page, look)
          await frames(page)
          if (worn.ground !== GROUNDS[look.theme][look.scheme]) wrong.push(`${width} pixels: ${worn.where} is ${worn.ground}, not the ${look.name} ground ${GROUNDS[look.theme][look.scheme]}`)
          const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
          cells.push({ route: p.route, look: look.name, width, passed: results.passes.length, findings: findingsOf(results) })
        }
        const text = report(cells)
        console.log(text)
        expect(wrong, 'the look is not the one asked for').toEqual([])
        expect(cells.flatMap((c) => c.findings.map((f) => `${c.width} pixels: ${f}`)), text).toEqual([])
        expect(errors, 'script errors on the page').toEqual([])
        expect(external, 'requests to hosts other than the local server').toEqual([])
      })
    }
  }
})
