// test/integration/posts-links-fields.test.ts
//
// Two refusals of the News posts' create and edit, run in the Workers runtime
// the site runs on, through the real cleaner (sanitizePostHtml) and the real
// handlers.
//
//   1. A link written as a site path. isSafeLink took any address that starts
//      with a single "/" as a page on this site, and a browser read some of
//      them as another site's. The rule now holds a site path to the site: a
//      body link with a refused address keeps its words and loses its address,
//      as a javascript: link does; a button link with one is a 400 in words
//      that writes nothing.
//   2. A post's fields were trusted to be text. applyPostEdits now holds every
//      field to its kind: a wrong kind, and a body that is no object, is a 400
//      in words, never an unhandled error, a new post leaves no row and an
//      existing post is unchanged.
//
// parse5, which jsdom installs, reads an href the way a browser would, to show
// that a refused form would have gone to another site had it been kept. Every
// input is made up.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { parseFragment } from 'parse5'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember } from './factories'

import { sanitizePostHtml, POST_FIELD_REFUSAL } from '../../functions/utils/posts'
import { sanitizePostHtmlToday } from '../unit/fixtures/posts-cleaner-today'
import { onRequestPost as adminCreate } from '../../functions/api/admin/posts'
import { onRequestPatch as adminPatch } from '../../functions/api/admin/posts/[id]'

beforeEach(resetHarness)

const BUTTON = 'The button link must be a page on this site, starting with a single /, or start with http://, https:// or mailto:'
/** A post's page: where a body link is read from. */
const POST_PAGE = 'https://www.louisianachess.org/news/sample-post-one'
/** The site's own origin, which a page on this site resolves to. */
const SITE_ORIGIN = 'https://www.louisianachess.org'

type Node = { tagName?: string; attrs?: Array<{ name: string; value: string }>; childNodes?: Node[] }
type Post = { id: string; title: string; body_html: string; link_url: string | null; link_label: string | null; updated_at: string }

async function postCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM lca_posts').first<{ n: number }>()
  return row?.n ?? 0
}

async function create(admin: string, body: Record<string, unknown>): Promise<Post> {
  const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
  expect(res.status).toBe(201)
  return (await res.json<{ post: Post }>()).post
}

/** The origin a browser reads for the one href in a cleaned body, decoded from the attribute. */
function linkOrigin(html: string): string | null {
  const frag = parseFragment(html) as unknown as Node
  const hrefs: string[] = []
  const walk = (node: Node) => {
    if (node.tagName === 'a') {
      const href = node.attrs?.find((a) => a.name === 'href')?.value
      if (href !== undefined) hrefs.push(href)
    }
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(frag)
  if (hrefs.length !== 1) return null
  try {
    return new URL(hrefs[0], POST_PAGE).origin
  } catch {
    return null
  }
}

// A link written as a site path a browser reads as another site's, named by
// kind: a second slash, a slash then a backslash, an entity for either, and a
// tab or a line break between the slashes.
const OFF_SITE = [
  ['a second slash', '//evil.example'],
  ['a slash then a backslash', '/\\evil.example'],
  ['an entity for a slash', '/&#47;evil.example'],
  ['a named entity for a slash', '/&sol;evil.example'],
  ['an entity for a backslash', '/&#92;evil.example'],
  ['a tab between two slashes', '/&#9;/evil.example'],
  ['a line break between two slashes', '/\n/evil.example'],
] as const

describe('News posts: a link written as a site path (through the real cleaner)', () => {
  it.each(OFF_SITE)('a body link whose address is %s loses its address and keeps its words, as a javascript: link does', async (_kind, href) => {
    const input = `<p><a href="${href}">Sample link</a></p>`
    // Every form but the second slash the old rule missed: it kept the address,
    // and a browser would have opened the other site. (The second slash the old
    // rule already dropped.)
    const before = await sanitizePostHtmlToday(input)
    if (!href.startsWith('//')) {
      expect(before, href).toContain('href=')
      expect(linkOrigin(before), href).not.toBe(SITE_ORIGIN)
    }
    // The rule now drops the address; the words stay, the same shape a javascript: link takes.
    const cleaned = await sanitizePostHtml(input)
    expect(cleaned, href).toBe('<p><a>Sample link</a></p>')
    expect(cleaned, href).toBe(await sanitizePostHtml('<p><a href="javascript:alert(1)">Sample link</a></p>'))
  })

  it('an ordinary site path and an http address are kept, read on the site and off it as before', async () => {
    for (const [href, origin] of [
      ['/tournaments/sample-open', SITE_ORIGIN],
      ['/news/sample-post?x=1&y=2#part', SITE_ORIGIN],
      ['/a\\b', SITE_ORIGIN],
      ['https://example.org/events', 'https://example.org'],
    ] as const) {
      const input = `<p><a href="${href}">Sample link</a></p>`
      const cleaned = await sanitizePostHtml(input)
      expect(cleaned, href).toBe(await sanitizePostHtmlToday(input))
      expect(linkOrigin(cleaned!), href).toBe(origin)
    }
  })

  it('through the handler: a body link with a refused address saves the post with the words and no address', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post one', bodyHtml: '<p><a href="/\\evil.example">Sample link</a></p>' })
    expect(post.body_html).toBe('<p><a>Sample link</a></p>')
  })
})

describe('News posts: a button link written as a site path (through the real handlers)', () => {
  it.each(OFF_SITE)('a POST with a button link that is %s is a 400 in words and leaves no row', async (_kind, url) => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post two', linkUrl: url } })
    expect(res.status, url).toBe(400)
    expect(await res.json(), url).toEqual({ error: BUTTON })
    expect(await postCount(), url).toBe(before)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM lca_posts WHERE title = ?').bind('Sample post two').first<{ n: number }>(), url).toEqual({ n: 0 })
  })

  it('a PATCH with a refused button link is a 400 in words and writes nothing', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post three', summary: 'Sample summary', linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { linkUrl: '/&#47;evil.example' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: BUTTON })
    const row = await env.DB.prepare('SELECT link_url, link_label, updated_at FROM lca_posts WHERE id = ?').bind(post.id).first<Post>()
    expect(row).toEqual({ link_url: '/tournaments/sample-open', link_label: 'Learn more', updated_at: post.updated_at })
  })

  it('an ordinary button link is accepted, a site path and an http address alike', async () => {
    const admin = await seedAdmin()
    for (const url of ['/tournaments/sample-open', '/news/sample-post?x=1&y=2', 'https://example.org/events', 'mailto:someone@example.org']) {
      const post = await create(admin, { title: `Sample post for ${url}`, linkUrl: url })
      expect(post.link_url, url).toBe(url)
    }
  })

  it('the javascript: button link today still refuses, with the same words', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post four', linkUrl: 'javascript:alert(1)' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: BUTTON })
  })
})

describe('News posts: a field of the wrong kind (through the real handlers)', () => {
  const WRONG: Array<[string, Record<string, unknown>]> = [
    ['title a number', { title: 5 }],
    ['title null', { title: null }],
    ['slug a number', { title: 'Sample post one', slug: 5 }],
    ['summary null', { title: 'Sample post one', summary: null }],
    ['bodyHtml null', { title: 'Sample post one', bodyHtml: null }],
    ['bodyHtml a list', { title: 'Sample post one', bodyHtml: ['<p>a</p>'] }],
    ['publishedAt a number', { title: 'Sample post one', publishedAt: 5 }],
    ['linkUrl a number', { title: 'Sample post one', linkUrl: 5 }],
    ['linkLabel a number', { title: 'Sample post one', linkLabel: 5 }],
    ['status a number', { title: 'Sample post one', status: 5 }],
    ['pinned a string', { title: 'Sample post one', pinned: 'false' }],
    ['pinned a number', { title: 'Sample post one', pinned: 1 }],
  ]

  it.each(WRONG)('a POST with %s is a 400 in words, never a 500, and leaves no row', async (_label, body) => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
    expect(res.status, _label).toBe(400)
    expect(await res.json(), _label).toEqual({ error: POST_FIELD_REFUSAL })
    expect(await postCount(), _label).toBe(before)
  })

  it.each(WRONG)('a PATCH with %s is a 400 in words, never a 500, and leaves the post unchanged', async (_label, body) => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post five', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body })
    expect(res.status, _label).toBe(400)
    expect(await res.json(), _label).toEqual({ error: POST_FIELD_REFUSAL })
    const row = await env.DB.prepare('SELECT title, summary, body_html, updated_at FROM lca_posts WHERE id = ?').bind(post.id).first<Post & { summary: string }>()
    expect(row, _label).toEqual({ title: 'Sample post five', summary: 'Sample summary', body_html: '<p>Sample body kept.</p>', updated_at: post.updated_at })
  })
})

describe('News posts: a body that is no object (through the real handlers)', () => {
  it.each([
    ['null', null],
    ['a list', []],
    ['text', 'abc'],
    ['a number', 5],
    ['true', true],
  ] as const)('a POST whose whole body is %s is a 400 in words, never a 500, and leaves no row', async (_label, body) => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
    expect(res.status, _label).toBe(400)
    expect(await res.json(), _label).toEqual({ error: POST_FIELD_REFUSAL })
    expect(await postCount(), _label).toBe(before)
  })

  it.each([
    ['a list', [], POST_FIELD_REFUSAL],
    ['text', 'abc', POST_FIELD_REFUSAL],
    ['a number', 5, POST_FIELD_REFUSAL],
    ['true', true, POST_FIELD_REFUSAL],
    ['null', null, 'Invalid JSON body'],
  ] as const)('a PATCH whose whole body is %s is a 400 in words, never a 500, and writes nothing', async (_label, body, error) => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post six', bodyHtml: '<p>Sample body kept.</p>' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body })
    expect(res.status, _label).toBe(400)
    expect(await res.json(), _label).toEqual({ error })
    const row = await env.DB.prepare('SELECT title, body_html, updated_at FROM lca_posts WHERE id = ?').bind(post.id).first<Post>()
    expect(row, _label).toEqual({ title: 'Sample post six', body_html: '<p>Sample body kept.</p>', updated_at: post.updated_at })
  })
})

describe('News posts: a field of null that clears, and role safety', () => {
  it('a linkUrl, linkLabel or publishedAt of null stays allowed and clears the field', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post seven', summary: 'Sample summary', status: 'published', linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more', publishedAt: '2026-11-13' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { linkUrl: null, linkLabel: null } })
    expect(res.status).toBe(200)
    const saved = (await res.json<{ post: Post }>()).post
    expect(saved.link_url).toBeNull()
    expect(saved.link_label).toBeNull()
  })

  it('role safety: no one but an LCA admin with a second factor reaches the field check, on a POST or a PATCH', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post eight', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await postCount()
    const callers: Array<[string | undefined, 'aal1' | 'aal2', number]> = [
      [undefined, 'aal2', 401],
      [await seedMember(), 'aal2', 403],
      [await seedMember({ role: 'club_rep' }), 'aal2', 403],
      [await seedMember({ role: 'lca_officer' }), 'aal2', 403],
      [admin, 'aal1', 403],
    ]
    for (const [as, aal, status] of callers) {
      const made = await invoke(adminCreate, { method: 'POST', as, aal, body: { title: 5 } })
      expect(made.status, `${as} ${aal}`).toBe(status)
      const edited = await invoke(adminPatch, { method: 'PATCH', as, aal, params: { id: post.id }, body: { title: 5 } })
      expect(edited.status, `${as} ${aal}`).toBe(status)
    }
    expect(await postCount()).toBe(before)
    expect((await env.DB.prepare('SELECT body_html FROM lca_posts WHERE id = ?').bind(post.id).first<Post>())?.body_html).toBe('<p>Sample body kept.</p>')
  })
})

// ── Every built address through the real cleaner and the real handlers ───────

// The attacker's pieces, as in test/unit/posts-safe-link.test.ts: slashes,
// backslashes, every whitespace and control character, the entities for each in
// decimal, hex and named form with and without the semicolon, the percent forms
// of a slash and a backslash, and the ordinary parts of a path.
const PIECES = [
  '/', '\\', '\t', '\n', '\r', ' ', '\u0000', '\u0001', '\u000b', '\u001f', '\u007f',
  '&#47;', '&#47', '&#x2f;', '&#x2F', '&sol;', '&sol',
  '&#92;', '&#92', '&#x5c;', '&#x5C', '&bsol;', '&bsol',
  '&#9;', '&#9', '&Tab;', '&#10;', '&#10', '&NewLine;', '&#13;', '&#13',
  '&amp;', '&amp', '&', '%2f', '%5c', '%2F', '%5C',
  '.', 'a', 'b', 'x', 'evil.example', '?q=1', '#frag',
]

/** Addresses that start with "/": each piece, each ordered pair, and a fixed third piece on each pair. */
function builtAddresses(): string[] {
  const out: string[] = []
  for (const p of PIECES) out.push('/' + p)
  PIECES.forEach((p, i) => {
    PIECES.forEach((q, j) => {
      out.push('/' + p + q)
      out.push('/' + p + q + PIECES[(i * 7 + j * 13) % PIECES.length])
    })
  })
  return out
}

/** The href text of the one link in a cleaned body, as the attribute was written (between its quotes), or null for a link with no address. */
function writtenHref(cleaned: string): string | null {
  const m = /<a href="([^"]*)"/.exec(cleaned)
  return m ? m[1] : null
}

const SAMPLE_LINK = (href: string) => `<p><a href="${href}">Sample link</a></p>`
const NO_ADDRESS = '<p><a>Sample link</a></p>'

describe('News posts: a few thousand built addresses through the real cleaner', () => {
  const addresses = builtAddresses()

  it('builds a few thousand addresses', () => {
    expect(addresses.length).toBeGreaterThanOrEqual(3000)
  })

  it('every link it keeps stays on the site, as written and as a browser decodes it, and every link it drops keeps its words', async () => {
    let kept = 0
    let dropped = 0
    for (const address of addresses) {
      const cleaned = await sanitizePostHtml(SAMPLE_LINK(address))
      // A refused post (null) is a refusal in words at the handler; nothing else is allowed to differ from the shapes below.
      if (cleaned === null) continue
      expect(cleaned, JSON.stringify(address)).toContain('Sample link')
      const href = writtenHref(cleaned)
      if (href === null) {
        dropped++
        expect(cleaned, JSON.stringify(address)).toBe(NO_ADDRESS)
        continue
      }
      kept++
      // Read twice: the attribute text as written, and the address a browser reads from it after decoding entities.
      expect(new URL(href, POST_PAGE).origin, `as written: ${JSON.stringify(address)}`).toBe(SITE_ORIGIN)
      expect(linkOrigin(cleaned), `decoded: ${JSON.stringify(address)}`).toBe(SITE_ORIGIN)
      // Nothing is kept that the cleaner of 13a2c36 did not keep, and what is kept is written as it wrote it.
      expect(cleaned, JSON.stringify(address)).toBe(await sanitizePostHtmlToday(SAMPLE_LINK(address)))
    }
    expect(kept).toBeGreaterThan(300)
    expect(dropped).toBeGreaterThan(300)
  })

  it('an address the old cleaner dropped is still dropped, and one it kept that a browser reads as another site is dropped now', async () => {
    for (const address of addresses) {
      const today = await sanitizePostHtmlToday(SAMPLE_LINK(address))
      const now = await sanitizePostHtml(SAMPLE_LINK(address))
      if (today !== null && writtenHref(today) === null) expect(now, JSON.stringify(address)).toBe(today)
      if (today !== null && writtenHref(today) !== null && now !== null && writtenHref(now) === null) {
        // Dropped now though kept before: the old kept form must have been one a browser could read as another site's,
        // or one with a control character in it, or one with "&" second, which the rule refuses rather than guesses at.
        const href = writtenHref(today)!
        const decoded = linkOrigin(today)
        const offSite = decoded !== SITE_ORIGIN
        const hasControl = [...address].some((ch) => ch.charCodeAt(0) <= 0x1f || (ch.charCodeAt(0) >= 0x7f && ch.charCodeAt(0) <= 0x9f))
        const entityStart = address[1] === '&'
        expect(offSite || hasControl || entityStart, JSON.stringify([address, href])).toBe(true)
      }
    }
  })

  it('the attribute reaches the cleaner as written, entities not decoded', async () => {
    // Were the attribute decoded first, "&#47;docs" would read as "/docs" and be kept; it is refused, as written.
    expect(await sanitizePostHtml(SAMPLE_LINK('&#47;docs'))).toBe(NO_ADDRESS)
    expect(await sanitizePostHtml(SAMPLE_LINK('&#x2f;&#x2f;evil.example'))).toBe(NO_ADDRESS)
    // And an entity after a safe second character is kept as written, which a browser reads on the site.
    const kept = await sanitizePostHtml(SAMPLE_LINK('/a&#47;b'))
    expect(kept).toBe(SAMPLE_LINK('/a&#47;b'))
    expect(linkOrigin(kept!)).toBe(SITE_ORIGIN)
  })

  it('the read-back check of a written link holds the same rule: a refused address is never in a body the cleaner returns', async () => {
    for (const address of ['/\\evil.example', '/&#47;evil.example', '/\t/evil.example', '/&Tab;/evil.example', '//evil.example']) {
      for (const input of [
        SAMPLE_LINK(address),
        `<p>Sample <a href="${address}">one</a> and <a href="/tournaments/sample-open">two</a></p>`,
        `<ul><li><a href=" ${address} ">Sample link</a></li></ul>`,
        `<p><A HREF='${address}'>Sample link</A></p>`,
      ]) {
        const cleaned = await sanitizePostHtml(input)
        expect(cleaned, input).not.toBeNull()
        const hrefs = [...cleaned!.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
        for (const href of hrefs) expect(new URL(href, POST_PAGE).origin, input).toBe(SITE_ORIGIN)
      }
    }
  })
})

describe('News posts: built addresses through the real handlers', () => {
  // Every tenth address, so the run stays quick while each shape of the alphabet is met.
  const sample = builtAddresses().filter((_, i) => i % 10 === 0)
  const SLOW = 180_000

  it('a body link: what is saved is the cleaner\'s answer, the words kept and any kept address on the site', async () => {
    const admin = await seedAdmin()
    let n = 0
    let kept = 0
    let dropped = 0
    for (const address of sample) {
      const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: `Sample post nine ${n++}`, bodyHtml: SAMPLE_LINK(address) } })
      if (res.status === 400) {
        // The cleaner could not read it: refused in words, nothing written.
        expect((await res.json<{ error: string }>()).error, JSON.stringify(address)).toContain('cannot be saved')
        continue
      }
      expect(res.status, JSON.stringify(address)).toBe(201)
      const saved = (await res.json<{ post: Post }>()).post.body_html
      const cleaned = await sanitizePostHtml(SAMPLE_LINK(address))
      expect(saved, JSON.stringify(address)).toBe(cleaned!.replace(/<p>\s*<\/p>/g, '').trim() ? cleaned : '')
      const href = writtenHref(saved)
      if (href === null) { dropped++; expect(saved).toBe(NO_ADDRESS); continue }
      kept++
      expect(new URL(href, POST_PAGE).origin, JSON.stringify(address)).toBe(SITE_ORIGIN)
      expect(linkOrigin(saved), JSON.stringify(address)).toBe(SITE_ORIGIN)
    }
    expect(kept).toBeGreaterThan(30)
    expect(dropped).toBeGreaterThan(30)
  }, SLOW)

  it('a button link: a 201 only for an address that stays on the site, else a 400 in words and no row; the stored address is as written', async () => {
    const admin = await seedAdmin()
    let n = 0
    let accepted = 0
    let refused = 0
    for (const address of sample) {
      const before = await postCount()
      const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: `Sample post ten ${n++}`, linkUrl: address } })
      if (res.status === 201) {
        accepted++
        const link = (await res.json<{ post: Post }>()).post.link_url
        expect(link, JSON.stringify(address)).toBe(address.trim())
        expect(new URL(link!, SITE_ORIGIN).origin, JSON.stringify(address)).toBe(SITE_ORIGIN)
        expect(await postCount(), JSON.stringify(address)).toBe(before + 1)
      } else {
        refused++
        expect(res.status, JSON.stringify(address)).toBe(400)
        expect(await res.json(), JSON.stringify(address)).toEqual({ error: BUTTON })
        expect(await postCount(), JSON.stringify(address)).toBe(before)
      }
    }
    expect(accepted).toBeGreaterThan(30)
    expect(refused).toBeGreaterThan(30)
  }, SLOW)

  it('a button link written with spaces or a tab around a refused address is refused after the trim, not kept', async () => {
    const admin = await seedAdmin()
    for (const url of [' //evil.example', '\t/\\evil.example ', '\n/&#47;evil.example\n', '  /&sol;evil.example  ']) {
      const before = await postCount()
      const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post eleven', linkUrl: url } })
      expect(res.status, JSON.stringify(url)).toBe(400)
      expect(await res.json(), JSON.stringify(url)).toEqual({ error: BUTTON })
      expect(await postCount(), JSON.stringify(url)).toBe(before)
    }
  })

  it('a button link refused on an edit leaves the whole post as it was, including a body sent with it', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post twelve', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>', linkUrl: '/tournaments/sample-open' })
    const before = await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Sample post changed', bodyHtml: '<p>Changed</p>', linkUrl: '/\\evil.example' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: BUTTON })
    expect(await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()).toEqual(before)
  })
})

describe('News posts: an ordinary post and link save as they did on 13a2c36', () => {
  const ORDINARY: Array<[string, string]> = [
    ['a site path', '/tournaments/sample-open'],
    ['a site path with a query and a fragment', '/news/sample-post?x=1&y=2#part'],
    ['a site path with an escaped ampersand', '/news/sample-post?x=1&amp;y=2'],
    ['the home page', '/'],
    ['a query alone', '/?x=1'],
    ['a fragment alone', '/#top'],
    ['a backslash later in the path', '/a\\b'],
    ['a percent-encoded slash', '/a%2fb'],
    ['an https address', 'https://example.org/events?x=1&y=2'],
    ['an http address', 'http://example.org'],
    ['a mailto address', 'mailto:someone@example.org'],
    ['an https address in capitals', 'HTTPS://EXAMPLE.ORG/Events'],
  ]

  it.each(ORDINARY)('a body link that is %s is cleaned byte for byte as the stored copy of the cleaner cleans it', async (_label, href) => {
    const input = `<p>Sample <strong>text</strong> with <a href="${href}">a link</a>.</p><ul><li>One</li></ul>`
    const now = await sanitizePostHtml(input)
    expect(now).not.toBeNull()
    expect(now).toBe(await sanitizePostHtmlToday(input))
    expect(writtenHref(now!)).not.toBeNull()
  })

  it.each(ORDINARY)('a post whose body link and button link are %s saves as the stored copy cleans it, and the button link as written', async (_label, href) => {
    const admin = await seedAdmin()
    const input = `<h2>Sample heading</h2><p>Sample <em>words</em> with <a href="${href}">a link</a>.</p>`
    const post = await create(admin, { title: '  Sample post thirteen  ', summary: ' Sample summary ', bodyHtml: input, linkUrl: ` ${href} `, linkLabel: ' Read more ', status: 'published', publishedAt: '2026-11-13', pinned: true })
    expect(post.body_html).toBe(await sanitizePostHtmlToday(input))
    expect(post.link_url).toBe(href)
    expect(post.link_label).toBe('Read more')
    expect(post.title).toBe('Sample post thirteen')
    expect(await env.DB.prepare('SELECT summary, status, pinned, published_at FROM lca_posts WHERE id = ?').bind(post.id).first()).toEqual({ summary: 'Sample summary', status: 'published', pinned: 1, published_at: '2026-11-13' })
  })

  it('an edit of an ordinary post changes only what it names', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post fourteen', summary: 'Sample summary', bodyHtml: '<p>Sample body.</p>', linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { summary: 'Sample summary two', pinned: true } })
    expect(res.status).toBe(200)
    const saved = (await res.json<{ post: Post & { summary: string; pinned: number } }>()).post
    expect(saved.summary).toBe('Sample summary two')
    expect(saved.pinned).toBe(1)
    expect(saved.body_html).toBe('<p>Sample body.</p>')
    expect(saved.link_url).toBe('/tournaments/sample-open')
    expect(saved.link_label).toBe('Learn more')
  })

  it('a title alone still makes a draft, and an empty title is still the same words', async () => {
    const admin = await seedAdmin()
    const made = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post fifteen' } })
    expect(made.status).toBe(201)
    for (const body of [{ title: '' }, { title: '   ' }, {}, { summary: 'Sample summary' }]) {
      const before = await postCount()
      const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(await res.json(), JSON.stringify(body)).toEqual({ error: 'A title is required' })
      expect(await postCount(), JSON.stringify(body)).toBe(before)
    }
  })
})

// ── Every field against every kind, through the real handlers ───────────────

describe('News posts: every field against every kind (through the real handlers)', () => {
  const KINDS: Array<[string, unknown]> = [
    ['null', null], ['a number', 5], ['zero', 0], ['true', true], ['false', false],
    ['a list', []], ['a list of text', ['Sample']], ['an object', {}], ['an object with a length', { length: 3 }],
  ]
  // The kinds each field may take among those above: text kinds are not in the list, so every one here is a wrong kind,
  // except the three that clear on null and pinned, which is true or false.
  const KEEPS: Record<string, string[]> = {
    title: [], slug: [], summary: [], bodyHtml: [], status: [],
    linkUrl: ['null'], linkLabel: ['null'], publishedAt: ['null'],
    pinned: ['true', 'false'],
  }
  const FIELDS = Object.keys(KEEPS)

  const cases: Array<[string, string, unknown]> = []
  for (const field of FIELDS) for (const [label, value] of KINDS) if (!KEEPS[field].includes(label)) cases.push([field, label, value])

  it.each(cases)('a POST with %s as %s is a 400 with the one message, never a 500, and leaves no row', async (field, label, value) => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post sixteen', [field]: value } })
    expect(res.status, `${field} as ${label}`).toBe(400)
    expect(await res.json(), `${field} as ${label}`).toEqual({ error: POST_FIELD_REFUSAL })
    expect(await postCount(), `${field} as ${label}`).toBe(before)
  })

  it.each(cases)('a PATCH with %s as %s is a 400 with the one message, never a 500, and leaves the whole row as it was', async (field, label, value) => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post seventeen', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>', linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more', pinned: true })
    const before = await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { [field]: value } })
    expect(res.status, `${field} as ${label}`).toBe(400)
    expect(await res.json(), `${field} as ${label}`).toEqual({ error: POST_FIELD_REFUSAL })
    expect(await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first(), `${field} as ${label}`).toEqual(before)
  })

  it('a wrong kind next to good fields refuses the whole request, so no good field is written either', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post eighteen', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Sample post changed', summary: 'Changed', bodyHtml: '<p>Changed</p>', pinned: 'yes' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: POST_FIELD_REFUSAL })
    expect(await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()).toEqual(before)
  })

  it('a list or an object does not pass a limit of length by counting its items', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post nineteen', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()
    for (const body of [
      { bodyHtml: ['<p>Sample</p>'] },
      { bodyHtml: { length: 1 } },
      { summary: ['Sample'] },
      { summary: { length: 1 } },
      { title: ['Sample'] },
      { title: { length: 1, trim: 'Sample' } },
      { bodyHtml: new Array(70_000).fill('x') },
    ]) {
      const edited = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body })
      expect(edited.status, JSON.stringify(body).slice(0, 60)).toBe(400)
      expect(await edited.json(), JSON.stringify(body).slice(0, 60)).toEqual({ error: POST_FIELD_REFUSAL })
    }
    expect(await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()).toEqual(before)
  })

  it('a null or a good value in the fields that allow it is not refused, on a POST and a PATCH', async () => {
    const admin = await seedAdmin()
    const made = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post twenty', linkUrl: null, linkLabel: null, publishedAt: null, pinned: false } })
    expect(made.status).toBe(201)
    const post = (await made.json<{ post: Post & { pinned: number; published_at: string | null } }>()).post
    expect(post.link_url).toBeNull()
    expect(post.link_label).toBeNull()
    expect(post.published_at).toBeNull()
    expect(post.pinned).toBe(0)
    for (const body of [{ pinned: true }, { pinned: false }, { linkUrl: null }, { linkLabel: null }, { publishedAt: null }, { linkUrl: '/tournaments/sample-open', linkLabel: 'Learn more', publishedAt: '2026-11-13', pinned: true }]) {
      const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body })
      expect(res.status, JSON.stringify(body)).toBe(200)
    }
    const cleared = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { linkUrl: null, linkLabel: null, publishedAt: null } })
    const saved = (await cleared.json<{ post: Post & { published_at: string | null } }>()).post
    expect(saved.link_url).toBeNull()
    expect(saved.link_label).toBeNull()
    expect(saved.published_at).toBeNull()
  })

  it('a field that is text but not a valid value keeps its own words, apart from the wrong-kind message', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post twenty-one', summary: 'Sample summary' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { status: 'archived' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid status' })
    const date = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { publishedAt: 'not a date' } })
    expect(date.status).toBe(400)
    expect(await date.json()).toEqual({ error: 'The date must be YYYY-MM-DD' })
    const long = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'x'.repeat(141) } })
    expect(long.status).toBe(400)
    expect(await long.json()).toEqual({ error: 'Titles are limited to 140 characters' })
  })

  it('a key the site does not send is left alone, whatever its kind, and writes nothing', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post twenty-two', id: 5, created_by: null, extra: [1, 2], body: 'x' } })
    expect(res.status).toBe(201)
    const post = (await res.json<{ post: Post & { created_by: string } }>()).post
    expect(post.id).toMatch(/^post-/)
    expect(post.created_by).toBe(admin)
  })

  it('an edit of a post that does not exist: a wrong kind is a 400, a good request a 404, never a 500', async () => {
    const admin = await seedAdmin()
    const wrong = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: 'post-missing' }, body: { title: 5 } })
    expect(wrong.status).toBe(400)
    expect(await wrong.json()).toEqual({ error: POST_FIELD_REFUSAL })
    const good = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: 'post-missing' }, body: { title: 'Sample post' } })
    expect(good.status).toBe(404)
  })
})

describe('News posts: a whole body that is not an object, however it arrives (through the real handlers)', () => {
  it.each([
    ['text that is not JSON', 'not json'],
    ['an empty body', ''],
    ['JSON null', 'null'],
    ['a JSON list', '[1,2]'],
    ['a JSON list holding an object', '[{"title":"Sample post"}]'],
    ['JSON text', '"Sample post"'],
    ['a JSON number', '5'],
    ['JSON true', 'true'],
    ['an object cut short', '{"title":"Sample'],
  ])('a POST with %s is a 400 in words and leaves no row', async (_label, rawBody) => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, rawBody, headers: { 'Content-Type': 'application/json' } })
    expect(res.status, _label).toBe(400)
    const { error } = await res.json<{ error: string }>()
    expect(error, _label).toBe(POST_FIELD_REFUSAL)
    expect(await postCount(), _label).toBe(before)
  })

  it.each([
    ['text that is not JSON', 'not json', 'Invalid JSON body'],
    ['an empty body', '', 'Invalid JSON body'],
    ['JSON null', 'null', 'Invalid JSON body'],
    ['a JSON list', '[1,2]', POST_FIELD_REFUSAL],
    ['a JSON list holding an object', '[{"title":"Sample post"}]', POST_FIELD_REFUSAL],
    ['JSON text', '"Sample post"', POST_FIELD_REFUSAL],
    ['a JSON number', '5', POST_FIELD_REFUSAL],
    ['JSON true', 'true', POST_FIELD_REFUSAL],
  ])('a PATCH with %s is a 400 in words and leaves the whole row as it was', async (_label, rawBody, error) => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post twenty-three', summary: 'Sample summary', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first()
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, rawBody, headers: { 'Content-Type': 'application/json' } })
    expect(res.status, _label).toBe(400)
    expect(await res.json(), _label).toEqual({ error })
    expect(await env.DB.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(post.id).first(), _label).toEqual(before)
  })
})
