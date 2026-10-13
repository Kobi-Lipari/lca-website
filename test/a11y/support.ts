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
// Usage: import { test, expect } from './support'
import { test as base, expect, type Page } from '@playwright/test'

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
