// test/a11y/clubs-page.spec.ts
//
// The new club page (WS09 step 21 to 24) in a real browser, for a visitor
// who is signed out, on the clubs build alone (the a11y-clubs project: the
// a11y-on build's switches and newClubs, served by the server that answers
// as with CLUB_PAGES_ON set; see test/a11y/global-setup.ts). The two fixture
// clubs of scripts/seed/fixtures.sql are read at their short addresses, at
// 1,280 by 800 and at 390 by 844:
//
// - the page draws in the new look with one h1, the club's name, and axe
//   with the WCAG 2.0, 2.1 and 2.2 A and AA rules finds nothing, run as the
//   suite's other specs run it; every finding fails the test, and nothing
//   goes in known-violations.json
// - the page raises no script error and asks no host but the local server
//   for anything, as the suite's own fixtures count them
// - each part the fixture fills is there under its heading: About, how the
//   club meets as the words written (never a date worked out from them), the
//   place or places, the cost, who is welcome with its tick, the Facebook
//   link where the fixture has one, and "Last checked" with its month
// - no address of the club is anywhere: the page's words (main) hold no
//   "@" and no link of the page is a mailto, nothing the browser drew holds
//   the club's contact address, and neither the HTML the server wrote nor
//   the body of any answer the page read from /api/ holds it
//
// Then: a short address that names no club draws the page's own not-found
// state with no script error; with scripts off, the page the server wrote
// reads as a page (one h1 with the club's name, its plain line, a title, a
// canonical link to the short address, no address of the club); the club's
// id as the address answers 301 to the short address and the browser lands
// there; and the switches the page itself loaded have the a11y-on build's
// seven and newClubs on, which says this server serves the clubs build.
//
// Reads only: nothing here writes to the project's local database.
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import type { Page, Response, TestInfo } from '@playwright/test'
import { expect, openDrawn, test } from './support'
import { A11Y_CLUBS_VARIANT, ROOT } from './global-setup'
import { cityLine } from '../../domain/clubs/pageWords'
import { clubPageTitle } from '../../domain/clubs/pageMeta'

const CLUBS = A11Y_CLUBS_VARIANT.name
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const SIZES = [{ width: 1280, height: 800 }, { width: 390, height: 844 }] as const

/** The switches the a11y-on build turns on, and the one the clubs build adds. */
const SWITCHES_ON = ['newLook', 'themeHeritage', 'newNav', 'siteSearch', 'eventStrip', 'eventStripLive', 'liveMarker', 'newClubs']

/** A fixture club as scripts/seed/fixtures.sql writes it, and what its page must show. */
interface FixtureClub {
  id: string
  slug: string
  name: string
  city: string
  region: string
  /** The club's contact address, which no visitor may reach. */
  contact: string
  about: string
  meets: string
  places: ReadonlyArray<{ name: string; street: string; note: string }>
  cost: string
  welcome: string
  tick: string
  facebook: string | null
}

const FIXTURE_CLUBS: readonly FixtureClub[] = [
  {
    id: 'fx-club-capital',
    slug: 'fixture-capital-chess-club',
    name: 'Fixture Capital Chess Club',
    city: 'Baton Rouge',
    region: 'Baton Rouge / East Central',
    contact: 'capital-club@example.org',
    about: 'A made-up club for tests. Casual and rated games for every level, and a volunteer on hand every night to teach anyone new to the game.',
    meets: 'Tuesdays at 7:00 PM, and the first Saturday of the month at 10:00 AM.',
    places: [
      { name: 'Fixture Community Center', street: '100 Example St, Baton Rouge, LA', note: 'Use the side door by the parking lot.' },
      { name: 'Fixture Branch Library', street: '300 Example Blvd, Baton Rouge, LA', note: 'The first Saturday of the month only.' },
    ],
    cost: 'Free for a first visit, then $5 a night.',
    welcome: 'Players of every age and level.',
    tick: 'The club plays on weekends',
    facebook: 'https://example.org/fixture-capital-chess-club-on-facebook',
  },
  {
    id: 'fx-club-north',
    slug: 'fixture-north-chess-club',
    name: 'Fixture North Chess Club',
    city: 'Monroe',
    region: 'North Louisiana',
    contact: 'north-club@example.org',
    about: 'A made-up club for tests, with blitz on Fridays and lessons for new players on Saturdays.',
    meets: 'Fridays at 6:30 PM. Lessons for new players on Saturdays at 10:00 AM.',
    places: [{ name: 'Fixture Library', street: '200 Example Ave, Monroe, LA', note: 'In the study room on the second floor.' }],
    cost: 'Free.',
    welcome: 'Everyone, from a first game to a rated player.',
    tick: 'Scholastic friendly',
    facebook: null,
  },
]

/** The month the fixtures' listings were last checked, as the told line words it. */
const TOLD = 'Last checked October 2026'

/** A date worked out and written with its weekday, as the site writes one ("Sat, Oct 24"). */
const WORKED_OUT_DATE = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/

function onlyClubs(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== CLUBS, 'the new club pages are drawn on the clubs build alone')
}

/** Every finding, one line each: rule, impact and selector. */
async function axeFindings(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  return results.violations.flatMap((v) => v.nodes.map((n) => `${v.id} (${v.impact ?? 'no impact given'}) at ${n.target.map(String).join(' ')}`))
}

/** The bodies of the answers the page reads from the local /api/, gathered as they come. */
function apiBodies(page: Page): { urls: string[]; settled: () => Promise<string[]> } {
  const urls: string[] = []
  const bodies: Promise<string>[] = []
  page.on('response', (response: Response) => {
    const url = new URL(response.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/api/')) return
    urls.push(`${response.status()} ${url.pathname}`)
    bodies.push(response.text().catch(() => ''))
  })
  return { urls, settled: () => Promise.all(bodies) }
}

/** The page's own section that a level 2 heading opens. */
const sectionOf = (page: Page, heading: string) =>
  page.locator('main section').filter({ has: page.getByRole('heading', { level: 2, name: heading, exact: true }) })

for (const club of FIXTURE_CLUBS) {
  for (const size of SIZES) {
    test(`${club.slug} at ${size.width} by ${size.height}: the new club page draws, with nothing for axe and no address of the club`, async ({ page, request, external }, testInfo) => {
      onlyClubs(testInfo)
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      const read = apiBodies(page)
      await page.setViewportSize(size)
      const h1 = page.getByRole('heading', { level: 1, name: club.name, exact: true })
      await openDrawn(page, `/clubs/${club.slug}`, [h1, page.getByRole('heading', { level: 2, name: `About ${club.name}`, exact: true })])

      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(h1).toBeVisible()
      await expect(page.locator('main').getByText(cityLine(club.city, club.region), { exact: true })).toBeVisible()
      await expect(page).toHaveTitle(clubPageTitle(club.name, club.city))
      expect(new URL(page.url()).pathname).toBe(`/clubs/${club.slug}`)

      // About, with the cost, who is welcome and its tick, and the club's links.
      const about = sectionOf(page, `About ${club.name}`)
      await expect(about.getByText(club.about, { exact: true })).toBeVisible()
      await expect(about.getByRole('heading', { level: 3, name: 'Cost', exact: true })).toBeVisible()
      await expect(about.getByText(club.cost, { exact: true })).toBeVisible()
      await expect(about.getByRole('heading', { level: 3, name: 'Who is welcome', exact: true })).toBeVisible()
      await expect(about.getByText(club.welcome, { exact: true })).toBeVisible()
      await expect(about.getByText(club.tick, { exact: true })).toBeVisible()
      const facebook = page.locator('main').getByRole('link', { name: 'Facebook (opens in a new tab)', exact: true })
      if (club.facebook) {
        await expect(facebook).toHaveCount(1)
        await expect(facebook).toHaveAttribute('href', club.facebook)
      } else {
        await expect(facebook).toHaveCount(0)
      }

      // How the club meets, as the club wrote it; the told line; the places.
      const where = sectionOf(page, `When and where ${club.name} meets`)
      await expect(where.getByText('How the club meets', { exact: true })).toBeVisible()
      await expect(where.locator('blockquote')).toHaveText(club.meets)
      await expect(where.getByText(TOLD, { exact: true })).toBeVisible()
      const whereWords = await where.innerText()
      expect(whereWords, 'no date is worked out from the club\'s words').not.toMatch(WORKED_OUT_DATE)
      expect(whereWords).not.toMatch(/\bTonight\b/i)
      const places = where.getByRole('list', { name: club.places.length > 1 ? 'The club\'s places' : 'The club\'s place', exact: true })
      await expect(places.getByRole('listitem')).toHaveCount(club.places.length)
      for (const place of club.places) {
        for (const words of [place.name, place.street, place.note]) await expect(places.getByText(words, { exact: true })).toBeVisible()
      }

      // No address of the club anywhere a visitor can reach. The club page's
      // own words hold no address at all; the site's footer, outside main,
      // gives the association's own, and never the club's.
      expect(await page.locator('main').innerText()).not.toContain('@')
      await expect(page.locator('main a[href^="mailto:" i]')).toHaveCount(0)
      expect(await page.locator('body').innerText()).not.toContain(club.contact)
      expect(await page.content()).not.toContain(club.contact)
      const written = await request.get(`/clubs/${club.slug}`)
      expect(written.status()).toBe(200)
      expect(await written.text()).not.toContain(club.contact)
      const bodies = await read.settled()
      expect(read.urls, 'the page read its own answer').toContain(`200 /api/clubs/${club.slug}/page`)
      for (const [i, body] of bodies.entries()) expect(body, read.urls[i]).not.toContain(club.contact)

      expect(await axeFindings(page)).toEqual([])
      expect(errors).toEqual([])
      expect(external).toEqual([])
    })
  }
}

test('a short address that names no club draws the page\'s own not-found state', async ({ page, external }, testInfo) => {
  onlyClubs(testInfo)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/clubs/no-such-fixture-club')
  await expect(page.getByRole('heading', { level: 1, name: 'Club not found', exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'No club goes by this address.' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test.describe('with scripts off', () => {
  test.use({ javaScriptEnabled: false })

  for (const club of FIXTURE_CLUBS) {
    test(`${club.slug}: the page the server wrote reads as a page`, async ({ page, external }, testInfo) => {
      onlyClubs(testInfo)
      const answer = await page.goto(`/clubs/${club.slug}`)
      expect(answer?.status()).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(page.getByRole('heading', { level: 1, name: club.name, exact: true })).toBeVisible()
      await expect(page.getByText(cityLine(club.city, club.region), { exact: true })).toBeVisible()
      await expect(page).toHaveTitle(clubPageTitle(club.name, club.city))
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      expect(canonical, 'a canonical link').toBeTruthy()
      expect(new URL(canonical!).pathname).toBe(`/clubs/${club.slug}`)
      expect(await page.content()).not.toContain(club.contact)
      expect(await page.locator('body').innerText()).not.toContain('@')
      await expect(page.locator('a[href^="mailto:" i]')).toHaveCount(0)
      expect(external).toEqual([])
    })
  }
})

for (const club of FIXTURE_CLUBS) {
  test(`${club.id}: the club's id as the address answers 301 to the short address, and the browser lands there`, async ({ page, request, external }, testInfo) => {
    onlyClubs(testInfo)
    const moved = await request.get(`/clubs/${club.id}`, { maxRedirects: 0 })
    expect(moved.status()).toBe(301)
    expect(moved.headers().location).toBe(`/clubs/${club.slug}`)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`/clubs/${club.id}`)
    await expect(page.getByRole('heading', { level: 1, name: club.name, exact: true })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(`/clubs/${club.slug}`)
    expect(errors).toEqual([])
    expect(external).toEqual([])
  })
}

test('the server serves the clubs build: the page loaded the a11y-on build\'s seven switches and newClubs, on', async ({ page }, testInfo) => {
  onlyClubs(testInfo)
  expect(A11Y_CLUBS_VARIANT.flags.split(',')).toEqual(SWITCHES_ON)
  const assets = join(ROOT, A11Y_CLUBS_VARIANT.dist, 'assets')
  expect(existsSync(assets), `${A11Y_CLUBS_VARIANT.dist} was not built; run npm run test:a11y`).toBe(true)
  const featuresFile = readdirSync(assets).filter((f) => /^features-.*\.js$/.test(f))
  expect(featuresFile).toHaveLength(1)
  await page.goto(`/clubs/${FIXTURE_CLUBS[0].slug}`)
  await page.waitForLoadState('networkidle')
  // The same module the page loaded: its default export is not named, so find the object of switches.
  const switches = await page.evaluate(async (url) => {
    const mod = await new Function('u', 'return import(u)')(url)
    const found = Object.values(mod as Record<string, unknown>).find((v) => v && typeof v === 'object' && 'newLook' in (v as object))
    return found as Record<string, boolean> | undefined
  }, `/assets/${featuresFile[0]}`)
  expect(switches, 'the feature switches object').toBeDefined()
  for (const name of SWITCHES_ON) expect(switches![name], name).toBe(true)
})
