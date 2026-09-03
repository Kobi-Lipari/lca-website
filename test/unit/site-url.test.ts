// test/unit/site-url.test.ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SITE_URL, emailLogoUrl, resolveSiteUrl } from '../../functions/utils/site'

const requestFrom = (url: string) => new Request(url)

describe('resolveSiteUrl', () => {
  it('prefers configuration over the incoming request', () => {
    // The point of the whole helper. An admin signed in on a preview
    // deployment must not mail preview links to members.
    const url = resolveSiteUrl(
      { SITE_URL: 'https://louisianachess.org' },
      requestFrom('https://lca-website.pages.dev/api/support'),
    )
    expect(url).toBe('https://louisianachess.org')
  })

  it('falls back to the request origin when unconfigured', () => {
    // What keeps links usable on localhost with no vars set.
    expect(resolveSiteUrl({}, requestFrom('http://localhost:8788/api/support')))
      .toBe('http://localhost:8788')
  })

  it('falls back to the canonical site with neither', () => {
    // The cron Worker's situation: no request exists to derive anything from.
    expect(resolveSiteUrl({})).toBe(DEFAULT_SITE_URL)
  })

  it('ignores a blank configured value', () => {
    // An empty env var is Cloudflare's answer for "set but not filled in",
    // and silently produces "/support/123" links if treated as configured.
    expect(resolveSiteUrl({ SITE_URL: '   ' }, requestFrom('http://localhost:8788/x')))
      .toBe('http://localhost:8788')
  })

  it('strips trailing slashes so callers can append a path', () => {
    expect(resolveSiteUrl({ SITE_URL: 'https://louisianachess.org/' }))
      .toBe('https://louisianachess.org')
    expect(resolveSiteUrl({ SITE_URL: 'https://louisianachess.org///' }))
      .toBe('https://louisianachess.org')
  })

  it('builds an absolute logo URL for mail clients', () => {
    expect(emailLogoUrl({ SITE_URL: 'https://louisianachess.org' }))
      .toBe('https://louisianachess.org/lca-logo.jpg')
  })
})
