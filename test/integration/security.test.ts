// test/integration/security.test.ts
// Regression tests for the security review: each block is one finding, and
// each test failed before its fix.
import { beforeEach, describe, expect, it } from 'vitest'
import { invoke, resetHarness } from './harness'
import { seedMember } from './factories'

import { isSafeLink, sanitizePostHtml } from '../../functions/utils/posts'
import { onRequestGet as documentsGet, onRequestPost as documentsPost } from '../../functions/api/governance/documents'
import { onRequestPut as documentPut } from '../../functions/api/governance/documents/[id]'

beforeEach(resetHarness)

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

describe('governance documents', () => {
  // Officers and observers save these without a second factor, and the
  // public pages render the stored HTML as it is.
  const hostile = '<h1>Minutes</h1><p onclick="alert(1)">Called to order.</p>' +
    '<img src=x onerror="alert(document.domain)"><script>alert(1)</script>' +
    '<xmp><img src=x onerror=alert(2)></xmp><a href="javascript:alert(3)">agenda</a>'

  async function publicContent(id: string): Promise<string> {
    const list = await invoke(documentsGet, { path: '/api/governance/documents' })
    const { documents } = await list.json<{ documents: Array<{ id: string; content: string }> }>()
    return documents.find((d) => d.id === id)?.content ?? ''
  }

  it('strips script from what an officer saves', async () => {
    const officer = await seedMember({ role: 'lca_officer' })
    const res = await invoke(documentsPost, {
      method: 'POST', as: officer, aal: 'aal1',
      body: { category: 'minutes', title: 'March minutes', content: hostile },
    })
    expect(res.status).toBe(201)
    const { document } = await res.json<{ document: { id: string } }>()

    const content = await publicContent(document.id)
    expect(content).not.toMatch(/onerror|onclick|<script|<img|javascript:/i)
    expect(content).toContain('<h1>Minutes</h1><p>Called to order.</p>')
  })

  it('strips it on an edit as well', async () => {
    const officer = await seedMember({ role: 'lca_officer' })
    const created = await invoke(documentsPost, {
      method: 'POST', as: officer, aal: 'aal1',
      body: { category: 'minutes', title: 'April minutes', content: '<p>Draft</p>' },
    })
    const { document } = await created.json<{ document: { id: string } }>()

    const res = await invoke(documentPut, {
      method: 'PUT', as: officer, aal: 'aal1', params: { id: document.id },
      body: { category: 'minutes', title: 'April minutes', content: hostile },
    })
    expect(res.status).toBe(200)
    expect(await publicContent(document.id)).not.toMatch(/onerror|onclick|<script|<img|javascript:/i)
  })

  it('keeps what a converted Word document contains', async () => {
    const officer = await seedMember({ role: 'lca_officer' })
    const picture = 'data:image/png;base64,iVBORw0KGgo='
    const report = '<h1>Treasurer\'s report</h1><table><thead><tr><th colspan="2">Balance</th></tr></thead>' +
      `<tbody><tr><td>Checking</td><td>$1,200<sup>1</sup></td></tr></tbody></table><ol start="3"><li>Dues</li></ol><img src="${picture}" alt="Chart">`
    const res = await invoke(documentsPost, {
      method: 'POST', as: officer, aal: 'aal1',
      body: { category: 'treasurer', title: 'Q1 report', content: report },
    })
    const { document } = await res.json<{ document: { id: string } }>()
    expect(await publicContent(document.id)).toBe(report)
  })

  it('refuses a file link that is not a web address', async () => {
    const officer = await seedMember({ role: 'lca_officer' })
    const res = await invoke(documentsPost, {
      method: 'POST', as: officer, aal: 'aal1',
      body: { category: 'bylaws', title: 'Bylaws', file_url: 'javascript:alert(1)' },
    })
    expect(res.status).toBe(400)
  })
})
