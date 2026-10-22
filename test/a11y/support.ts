// test/a11y/support.ts
//
// The `test` every accessibility spec imports instead of Playwright's own.
// Its page:
//
// - answers /api/facebook-posts with two made-up posts, so the homepage's
//   Facebook feed renders the same way on every run without a page token
//   (the endpoint itself only says "not configured" in these builds)
// - replaces Math.random with a seeded generator, so a page that shuffles
//   (the homepage's club list) shows the same order on every run
// - refuses every request to a host other than the local server and lists
//   it in `external`, so a test can show the page reached nothing outside
//   (links are not followed, so the Facebook and other outside links in the
//   page are not requests and are not affected)
//
// It also gives openDrawn, which opens a page that draws itself from a data
// request and waits until what a test reads is there, loading the page once
// more when it is not; a test that samples a page's colours must never
// sample its empty state.
//
// Usage: import { test, expect } from './support'
import { test as base, expect, type Locator, type Page, type Request, type Response } from '@playwright/test'

export { expect }

/** What /api/facebook-posts answers in these tests. */
export const STUB_FACEBOOK_POSTS = {
  posts: [
    {
      id: 'fx-fb-1',
      message: 'A made-up post for tests: club night moves to Thursday this week, 7:00 PM.',
      createdAt: '2026-10-01T18:00:00Z',
      permalinkUrl: 'https://example.org/fixture-post-1',
      imageUrl: null,
      linkTitle: null,
      linkUrl: null,
    },
    {
      id: 'fx-fb-2',
      message: 'A made-up post for tests: results from the Fixture Summer Championship are up.',
      createdAt: '2026-09-20T15:30:00Z',
      permalinkUrl: 'https://example.org/fixture-post-2',
      imageUrl: null,
      linkTitle: null,
      linkUrl: null,
    },
  ],
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** The same sequence of "random" numbers on every run (mulberry32, fixed seed). */
function seedRandom() {
  let seed = 20261013
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Seeds Math.random, stubs the Facebook feed and refuses outside requests;
 * returns the list the refused addresses are added to.
 */
export async function prepareLocalPage(page: Page): Promise<string[]> {
  const external: string[] = []
  await page.addInitScript(seedRandom)
  // Playwright tries the most recently added route first, so the catch-all
  // goes in before the Facebook stub.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (LOCAL_HOSTS.has(url.hostname)) return route.fallback()
    external.push(url.href)
    return route.abort('blockedbyclient')
  })
  await page.route('**/api/facebook-posts*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_FACEBOOK_POSTS) }),
  )
  return external
}

export const test = base.extend<{ external: string[] }>({
  // Automatic, so every test's page is stubbed whether or not it asks for
  // the list.
  external: [
    async ({ page }, use) => {
      await use(await prepareLocalPage(page))
    },
    { auto: true },
  ],
})

/** How long openDrawn waits, on each load, for all of a page's content together. */
export const DRAWN_TIMEOUT = 15_000

/**
 * Opens a page that draws itself from a data request, and waits until it is
 * drawn: every locator in `content` visible, and no request to the local
 * /api/ answered with a server error (500 or more) or failed outright. When
 * a request failed, or the content is not there within DRAWN_TIMEOUT of the
 * page going quiet, the page drew its empty or error state (as it did when a
 * busy local database answered SQLITE_BUSY); it is then opened once more,
 * and this time everything must be there, or the test fails here with the
 * reason, rather than reading the wrong state later. Gives back how many
 * loads it took (1 or 2).
 */
export async function openDrawn(page: Page, route: string, content: readonly Locator[]): Promise<number> {
  const failed: string[] = []
  // Only the requests this load makes count, not one the page before it left
  // running (which the navigation cancels).
  let ours = new WeakSet<Request>()
  const local = (url: string) => {
    const u = new URL(url)
    return LOCAL_HOSTS.has(u.hostname) && u.pathname.startsWith('/api/') ? `${u.pathname}${u.search}` : null
  }
  const onRequest = (request: Request) => {
    if (local(request.url())) ours.add(request)
  }
  const onResponse = (response: Response) => {
    if (ours.has(response.request()) && response.status() >= 500) failed.push(`${response.status()} ${local(response.url())}`)
  }
  const onFailed = (request: Request) => {
    const error = request.failure()?.errorText ?? 'failed'
    if (ours.has(request) && error !== 'net::ERR_ABORTED') failed.push(`${error} ${local(request.url())}`)
  }
  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfailed', onFailed)
  try {
    for (let load = 1; load <= 2; load++) {
      failed.length = 0
      ours = new WeakSet<Request>()
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const last = load === 2
      let drawn = content
      const missing: string[] = []
      const deadline = Date.now() + DRAWN_TIMEOUT
      // A data request that already failed will not draw the content: load the page again at once.
      if (!last && failed.length > 0) drawn = []
      for (const locator of drawn) {
        try {
          await locator.first().waitFor({ state: 'visible', timeout: Math.max(1, deadline - Date.now()) })
        } catch {
          missing.push(String(locator))
        }
      }
      if (missing.length === 0 && failed.length === 0) return load
      const why = [...missing.map((m) => `${m} not drawn`), ...failed.map((f) => `data request ${f}`)].join('; ')
      if (last) throw new Error(`${route} was not drawn after loading it twice: ${why}`)
      console.log(`${route} was not drawn on its first load (${why}); loading it once more`)
    }
    return 2
  } finally {
    page.off('request', onRequest)
    page.off('response', onResponse)
    page.off('requestfailed', onFailed)
  }
}
