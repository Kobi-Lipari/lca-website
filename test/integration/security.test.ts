// test/integration/security.test.ts
// Regression tests for the security review: each block is one finding, and
// each test failed before its fix.
import { describe, expect, it } from 'vitest'

import { isSafeLink, sanitizePostHtml } from '../../functions/utils/posts'

describe('post HTML sanitizer', () => {
  // The rewriter treats the content of these as text, so removing only the
  // wrapper used to hand the browser a live <img onerror>.
  const wrapped = [
    '<textarea><img src=x onerror=alert(1)></textarea>',
    '<title><img src=x onerror=alert(1)></title>',
    '<xmp><img src=x onerror=alert(1)></xmp>',
    '<noembed><img src=x onerror=alert(1)></noembed>',
    '<noframes><img src=x onerror=alert(1)></noframes>',
    '<noscript><img src=x onerror=alert(1)></noscript>',
    '<plaintext><img src=x onerror=alert(1)>',
    '<svg><![CDATA[><img src=x onerror=alert(1)>]]></svg>',
    '<math><![CDATA[><img src=x onerror=alert(1)>]]></math>',
    '<svg><![CDATA[><img src=x onerror=alert(1)>]]>',
    '<!--><img src=x onerror=alert(1)>-->',
  ]

  it.each(wrapped)('leaves no markup behind from %s', async (payload) => {
    const out = await sanitizePostHtml(`<p>before</p>${payload}`)
    expect(out).not.toMatch(/<img|onerror|<!\[CDATA\[|<!--/i)
    expect(out).toContain('<p>before</p>')
  })

  it('still keeps what the editor writes', async () => {
    const html = '<h2>Title</h2><p>Some <strong>bold</strong> and <em>italic</em> text.</p><ul><li>one</li></ul>'
    expect(await sanitizePostHtml(html)).toBe(html)
  })

  it('does not take a link that leaves the site for a site path', () => {
    expect(isSafeLink('/tournaments/x')).toBe(true)
    expect(isSafeLink('https://uschess.org')).toBe(true)
    expect(isSafeLink('/\\evil.example')).toBe(false)
    expect(isSafeLink('/\t/evil.example')).toBe(false)
    expect(isSafeLink('//evil.example')).toBe(false)
    expect(isSafeLink('javascript:alert(1)')).toBe(false)
  })
})
