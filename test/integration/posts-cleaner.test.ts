// test/integration/posts-cleaner.test.ts
//
// The News posts' cleaner, sanitizePostHtml in functions/utils/posts.ts, run
// in the Workers runtime the site runs on, whose HTMLRewriter it reads posts
// with. Until this change two ways let live markup through it: a tag whose
// inside a browser reads as raw text (textarea, title, noscript, xmp,
// noembed, noframes, plaintext) handed that inside on when it was unwrapped,
// and unwrapping a tag joined the text on either side of it, which could
// spell a new tag. Each case shows the way on the stored copy of the cleaner
// as it was, test/unit/fixtures/posts-cleaner-today.ts, and holds it closed;
// then a post the rewriter cannot read, which it stops on with an error, the
// refusal through the real handlers, and every form the site's editor
// writes, byte for byte as the stored copy gives it. parse5, which
// jsdom installs, reads each result a second time as a browser would, as a
// fragment, inside a whole page and with scripting off. Every input is made
// up.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { parse, parseFragment } from 'parse5'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember } from './factories'

import { sanitizePostHtml } from '../../functions/utils/posts'
import { sanitizePostHtmlToday } from '../unit/fixtures/posts-cleaner-today'
import { onRequestPost as adminCreate } from '../../functions/api/admin/posts'
import { onRequestPatch as adminPatch } from '../../functions/api/admin/posts/[id]'

beforeEach(resetHarness)

const REFUSAL = 'This post holds markup that cannot be saved. Remove any pasted code and try again.'
const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr', 'code', 'pre'])
/** Where a post's links are read from: a post's own page. */
const POST_PAGE = 'https://www.louisianachess.org/news/sample-post-one'

type Node = {
  nodeName: string
  tagName?: string
  attrs?: Array<{ name: string; value: string }>
  childNodes?: Node[]
  content?: Node
}

/**
 * What parse5, reading as a browser does, finds in the HTML that the cleaner
 * never writes: another element, an attribute anywhere but on a link, a link
 * whose attributes are not the href, target and rel the cleaner writes or
 * whose address does not open as http, https or mailto, and a comment. It
 * reads the HTML as a fragment, as the post's page sets it, then inside a
 * whole page's box, then as a fragment again with scripting off.
 */
function liveMarkup(html: string): string[] {
  const found: string[] = []
  const walk = (node: Node, box?: Node) => {
    if (node.nodeName === '#comment') found.push('comment')
    const tag = node.tagName
    if (tag && node !== box && !(box && ['html', 'head', 'body'].includes(tag))) {
      const attrs = node.attrs ?? []
      if (!ALLOWED.has(tag)) found.push(tag)
      for (const attr of attrs) {
        if (tag !== 'a' || !['href', 'target', 'rel'].includes(attr.name)) found.push(`${tag} ${attr.name}`)
        else if (attr.name === 'href' && !opensSafely(attr.value)) found.push(`a href ${attr.value}`)
        else if (attr.name === 'target' && attr.value !== '_blank') found.push(`a target ${attr.value}`)
        else if (attr.name === 'rel' && attr.value !== 'noopener noreferrer') found.push(`a rel ${attr.value}`)
      }
      const names = attrs.map((attr) => attr.name).join(' ')
      if (tag === 'a' && !['', 'href', 'href target rel'].includes(names)) found.push(`a attributes ${names}`)
    }
    for (const child of node.childNodes ?? []) walk(child, box)
    if (node.content) walk(node.content, box)
  }
  walk(parseFragment(html) as unknown as Node)
  const page = parse(`<!DOCTYPE html><html><head></head><body><div>${html}</div></body></html>`) as unknown as Node
  const body = page.childNodes?.find((n) => n.tagName === 'html')?.childNodes?.find((n) => n.tagName === 'body')
  walk(page, body?.childNodes?.[0])
  walk(parseFragment(html, { scriptingEnabled: false }) as unknown as Node)
  return found
}

/** True when an address, as a browser reads it on a post's page, opens as http, https or mailto. */
function opensSafely(href: string): boolean {
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href, POST_PAGE).protocol)
  } catch {
    return false
  }
}

/** Every element parse5 reads from the HTML as a fragment, in order, with its attributes as a browser reads them. */
function elements(html: string): { tag: string; attrs: Record<string, string> }[] {
  const out: { tag: string; attrs: Record<string, string> }[] = []
  const walk = (node: Node) => {
    if (node.tagName) out.push({ tag: node.tagName, attrs: Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value])) })
    for (const child of node.childNodes ?? []) walk(child)
  }
  walk(parseFragment(html) as unknown as Node)
  return out
}

async function postCount(): Promise<number> {
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM lca_posts').first<{ n: number }>()
  return row?.n ?? 0
}

type Post = { id: string; title: string; body_html: string; updated_at: string }

async function create(admin: string, body: Record<string, unknown>): Promise<Post> {
  const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
  expect(res.status).toBe(201)
  return (await res.json<{ post: Post }>()).post
}

const IMG = '<img src=x onerror=alert(1)>'
const HELD = `${IMG}<a href="https://example.org" onclick="y">Sample link</a>`
const RAW_TEXT = ['textarea', 'title', 'noscript', 'xmp', 'noembed', 'noframes'] as const

describe('News posts cleaner: tags whose inside is raw text (the first way)', () => {
  it.each(RAW_TEXT)('%s holding an image with an onerror and a link with an onclick: live before, removed with what it holds now', async (tag) => {
    const input = `<p>Sample post one</p><${tag}>${HELD}</${tag}><p>Sample post two</p>`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toEqual(expect.arrayContaining(['img', 'img src', 'img onerror', 'a onclick']))
    const cleaned = await sanitizePostHtml(input)
    expect(cleaned).toBe('<p>Sample post one</p><p>Sample post two</p>')
    expect(liveMarkup(cleaned!)).toEqual([])
  })

  it('plaintext, which swallows the rest of the post: live before, removed to the end now, keeping what came before it', async () => {
    const input = `<p>Sample post one</p><plaintext>${HELD}<p>Sample post two</p>`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toEqual(expect.arrayContaining(['img onerror', 'a onclick']))
    expect(await sanitizePostHtml(input)).toBe('<p>Sample post one</p>')
  })

  it.each([...RAW_TEXT, 'plaintext'])('%s in upper case and never closed: live before, removed to the end now', async (tag) => {
    const input = `<p>Sample post one</p><${tag.toUpperCase()}>${HELD}`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toEqual(expect.arrayContaining(['img onerror', 'a onclick']))
    expect(await sanitizePostHtml(input)).toBe('<p>Sample post one</p>')
  })

  it.each(['template', 'svg', 'math'])('%s goes with what it holds: tidying, since its inside came out inert before too', async (tag) => {
    const input = `<p>Sample post one</p><${tag}>${HELD}<p>Sample text</p></${tag}>`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toEqual([])
    expect(await sanitizePostHtml(input)).toBe('<p>Sample post one</p>')
  })
})

describe('News posts cleaner: a tag made by a removal (the second way)', () => {
  it.each([
    ['an unknown tag', `<<x>${IMG.slice(1)}`, ''],
    ['a tag a browser knows but a post does not allow', `<<span></span>${IMG.slice(1)}`, ''],
    ['a removed script', `<<script>1</script>${IMG.slice(1)}`, ''],
    ['a removed style', `<<style>x</style>${IMG.slice(1)}`, ''],
    ['a removed embedder', `<<iframe></iframe>${IMG.slice(1)}`, ''],
    ['a tag whose inside is raw text', `<<textarea></textarea>${IMG.slice(1)}`, ''],
    ['an unknown end tag unwrapped with its start tag', `<x>Sample<</x>${IMG.slice(1)}`, 'Sample'],
  ])('%s: a "<" before it joined the next words into a live image; cleaned again, the image goes too', async (_form, input, after) => {
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toEqual(expect.arrayContaining(['img', 'img onerror']))
    expect(await sanitizePostHtml(input)).toBe(after)
  })

  it('a form nested two deep needs a second pass to make its image, and settles to nothing', async () => {
    const input = `<<<x>x>${IMG.slice(1)}`
    expect(await sanitizePostHtmlToday(input)).toBe(`<<x>${IMG.slice(1)}`)
    expect(liveMarkup(await sanitizePostHtmlToday(await sanitizePostHtmlToday(input)))).toContain('img onerror')
    expect(await sanitizePostHtml(input)).toBe('')
  })

  it('a form nested three deep settles in the fifth pass, three joins, the image and a pass that changes nothing', async () => {
    expect(await sanitizePostHtml(`<<<<x>x>x>${IMG.slice(1)}`)).toBe('')
  })

  it('a form nested four deep would need a sixth pass, so the post is refused', async () => {
    expect(await sanitizePostHtml(`<<<<<x>x>x>x>${IMG.slice(1)}`)).toBeNull()
  })

  it('repeated forms among ordinary paragraphs leave the paragraphs alone', async () => {
    const input = `<p>Sample post one</p><<x>${IMG.slice(1)}<p>Sample post two</p><<span></span>${IMG.slice(1)}`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toContain('img onerror')
    expect(await sanitizePostHtml(input)).toBe('<p>Sample post one</p><p>Sample post two</p>')
  })

  it.each([
    ['an end tag', '<<x>/img src=x onerror=alert(1)>', '</img src=x onerror=alert(1)>'],
    ['a comment', `<<x>!-- Sample --> ${IMG}<p>Sample post one</p>`, '<!-- Sample --> <p>Sample post one</p>'],
    ['a comment left open over the rest of the post', '<<x>!-- <p>Sample post one</p>', '<!-- <p>Sample post one</p>'],
  ])('a join that makes %s is refused', async (_made, input, before) => {
    expect(await sanitizePostHtmlToday(input)).toBe(before)
    expect(await sanitizePostHtml(input)).toBeNull()
  })
})

describe('News posts cleaner: a comment beside a "<"', () => {
  it('a "<" before a comment was kept as written and was inert, but with the comment taken out it is an image, so a comment is refused, not removed', async () => {
    const input = `<<!-- Sample comment -->${IMG.slice(1)}`
    const before = await sanitizePostHtmlToday(input)
    expect(before).toBe(input)
    expect([...new Set(liveMarkup(before))]).toEqual(['comment'])
    expect(liveMarkup(input.replace('<!-- Sample comment -->', ''))).toContain('img onerror')
    expect(await sanitizePostHtml(input)).toBeNull()
  })

  it('a comment before a "<" that a removal joins: live before, refused now', async () => {
    const input = `<!-- Sample comment --><<x>${IMG.slice(1)}`
    expect(liveMarkup(await sanitizePostHtmlToday(input))).toContain('img onerror')
    expect(await sanitizePostHtml(input)).toBeNull()
  })
})

describe('News posts cleaner: a post the rewriter cannot read', () => {
  it.each([
    ['a style after a select', '<p>Sample post one</p><select><style>x</style></select>'],
    ['a title after a select, in upper case', '<p>Sample post one</p><SELECT><TITLE>x</TITLE>'],
    ['a style after a frameset already closed', '<p>Sample post one</p><frameset></frameset><style>x</style>'],
    ['a script after a template inside a select', '<p>Sample post one</p><select><template><script>x</script>'],
  ])('%s: the rewriter stops on it with an error, which the old cleaner let out of the save; refused now', async (_form, input) => {
    await expect(sanitizePostHtmlToday(input)).rejects.toThrow()
    expect(await sanitizePostHtml(input)).toBeNull()
  })

  it.each([
    ['a select and a style, which a browser reads as a select', '<p>Sample post one</p><<x>select><<x>style>x</style>', '<p>Sample post one</p><select><style>x</style>', 'select'],
    ['a frameset and a style, which a browser reads as a style sheet', '<p>Sample post one</p><<x>frameset><<x>style>x</style>', '<p>Sample post one</p><frameset><style>x</style>', 'style'],
  ])('a join that makes %s: stored by the old cleaner\'s one pass, and stopped on in a second; refused now', async (_made, input, stored, live) => {
    expect(await sanitizePostHtmlToday(input)).toBe(stored)
    expect(liveMarkup(stored)).toContain(live)
    await expect(sanitizePostHtmlToday(stored)).rejects.toThrow()
    expect(await sanitizePostHtml(input)).toBeNull()
  })

  it('a select the rewriter can read, with no such tag after it, is unwrapped as before', async () => {
    const input = '<p>Sample post one</p><select><option>Sample choice</option></select><p>Sample post two</p>'
    expect(await sanitizePostHtmlToday(input)).toBe('<p>Sample post one</p>Sample choice<p>Sample post two</p>')
    expect(await sanitizePostHtml(input)).toBe('<p>Sample post one</p>Sample choice<p>Sample post two</p>')
  })
})

describe('News posts cleaner: what was let through as written, decided on purpose', () => {
  it.each([
    ['a comment', '<p>Sample post one</p><!-- Sample comment -->'],
    ['a doctype', '<!DOCTYPE html><p>Sample post one</p>'],
    ['a processing instruction (a bogus comment to a browser)', '<?sample note?><p>Sample post one</p>'],
    ['a CDATA section (a bogus comment outside svg and math)', '<![CDATA[ Sample ]]><p>Sample post one</p>'],
    ['an end tag the cleaner does not know', '<p>Sample post one</p></x>'],
    ['an empty end tag', '<p>Sample post one</p></>'],
    ['an end tag with a space after its slash (a bogus comment)', '<p>Sample post one</p></ x>'],
    ['an allowed tag written self-closed, where the editor writes <br>', '<p>Sample post one<br/>and more</p>'],
    ['an allowed tag written self-closed after a space', '<p>Sample post one<br />and more</p>'],
    ['an allowed tag with a space after its name', '<p >Sample post one</p>'],
    ['a bare "<" in the text, where the editor writes &lt;', '<p>Sample post 1 < 2</p>'],
  ])('%s: kept as written before, refused now', async (_kind, input) => {
    expect(await sanitizePostHtmlToday(input)).toBe(input)
    expect(await sanitizePostHtml(input)).toBeNull()
  })
})

describe('News posts cleaner: control characters, case and entities', () => {
  it.each([
    ['a NUL', `<\u0000${IMG.slice(1)}`],
    ['another control character', `<\u0001${IMG.slice(1)}`],
  ])('a "<" with %s before the tag name: kept as written before, refused now, since a reader that dropped it would find an image', async (_what, input) => {
    expect(await sanitizePostHtmlToday(input)).toBe(input)
    // The same post with the character after the "<" dropped.
    expect(liveMarkup(input.slice(0, 1) + input.slice(2))).toContain('img onerror')
    expect(await sanitizePostHtml(input)).toBeNull()
  })

  it('a NUL inside a tag name makes one unknown tag, unwrapped as before', async () => {
    for (const [input, after] of [['<i\u0000mg src=x onerror=alert(1)>', ''], ['<scr\u0000ipt>alert(1)</scr\u0000ipt>', 'alert(1)']]) {
      expect(await sanitizePostHtml(input), input).toBe(after)
      expect(await sanitizePostHtmlToday(input), input).toBe(after)
    }
  })

  it('a NUL or a control character in the text, which the editor writes as it is, is kept byte for byte', async () => {
    const input = '<p>Sample\u0000 post\u000b one\u0001</p>'
    expect(await sanitizePostHtml(input)).toBe(await sanitizePostHtmlToday(input))
    expect(await sanitizePostHtml(input)).toBe(input)
  })

  it('upper and mixed case: an image and a script removed, an allowed tag kept as written, all as before', async () => {
    for (const [input, after] of [
      ['<IMG SRC=x ONERROR=alert(1)>', ''],
      ['<ScRiPt>alert(1)</sCrIpT><p>Sample</p>', '<p>Sample</p>'],
      ['<P>Sample</P><BR><A HREF="https://example.org" ONCLICK="y">Sample link</A>', '<P>Sample</P><BR><A href="https://example.org" target="_blank" rel="noopener noreferrer">Sample link</A>'],
    ]) {
      expect(await sanitizePostHtml(input), input).toBe(after)
      expect(await sanitizePostHtmlToday(input), input).toBe(after)
    }
  })

  it('an entity is text to a browser, and an address spelled with one still loses its href, as before', async () => {
    const text = '<p>&lt;img src=x onerror=alert(1)&gt; and &#60;b&#62;</p>'
    expect(await sanitizePostHtml(text)).toBe(text)
    expect(liveMarkup(text)).toEqual([])
    for (const href of ['java&#115;cript:alert(1)', '&#106;avascript:alert(1)', 'java\tscript:alert(1)', ' javascript:alert(1)']) {
      const input = `<a href="${href}">Sample link</a>`
      expect(await sanitizePostHtml(input), href).toBe('<a>Sample link</a>')
      expect(await sanitizePostHtmlToday(input), href).toBe('<a>Sample link</a>')
    }
  })
})

describe('News posts cleaner: links and the cleaner\'s own wrapper, decided on purpose', () => {
  it('a site path keeps its address with no new tab, as before', async () => {
    const input = '<p><a href="/tournaments/sample-open" target="_blank" onclick="y">Sample event</a></p>'
    expect(await sanitizePostHtml(input)).toBe('<p><a href="/tournaments/sample-open">Sample event</a></p>')
    expect(await sanitizePostHtml(input)).toBe(await sanitizePostHtmlToday(input))
  })

  it('an address in single quotes with a double quote inside comes out with the quote as &quot;, which a browser reads back as the same address', async () => {
    const input = `<a href='https://example.org/?q="sample"'>Sample link</a>`
    const cleaned = await sanitizePostHtml(input)
    expect(cleaned).toBe('<a href="https://example.org/?q=&quot;sample&quot;" target="_blank" rel="noopener noreferrer">Sample link</a>')
    expect(cleaned).toBe(await sanitizePostHtmlToday(input))
    expect(elements(cleaned!)).toEqual([{ tag: 'a', attrs: { href: 'https://example.org/?q="sample"', target: '_blank', rel: 'noopener noreferrer' } }])
  })

  it('an address holding a "<" or a ">", as the editor can write one, stays one link, as before', async () => {
    for (const href of ['https://example.org/a<b>c', 'https://example.org/a&lt;b&gt;c', 'https://example.org/>']) {
      const input = `<p><a target="_blank" rel="noopener noreferrer nofollow" href="${href}">Sample link</a></p>`
      const cleaned = await sanitizePostHtml(input)
      expect(cleaned, href).toBe(await sanitizePostHtmlToday(input))
      expect(elements(cleaned!).map((e) => e.tag), href).toEqual(['p', 'a'])
      expect(liveMarkup(cleaned!), href).toEqual([])
    }
  })

  it('a second href is dropped, the first kept, as before', async () => {
    const input = '<a href="https://example.org" href="javascript:alert(1)">Sample link</a>'
    expect(await sanitizePostHtml(input)).toBe('<a href="https://example.org" target="_blank" rel="noopener noreferrer">Sample link</a>')
  })

  it('a stray </div> that closes the cleaner\'s own wrapper early comes out as before', async () => {
    for (const input of ['<p>Sample post one</p></div><p>Sample post two</p>', '<p>Sample post one</p></div>']) {
      expect(await sanitizePostHtml(input), input).toBe(await sanitizePostHtmlToday(input))
    }
    // Two of them settle in a second pass, the stray one left at the end taken off.
    expect(await sanitizePostHtmlToday('<p>Sample post one</p></div></div>')).toBe('<p>Sample post one</p></div>')
    expect(await sanitizePostHtml('<p>Sample post one</p></div></div>')).toBe('<p>Sample post one</p>')
  })

  it('a tag left open at the end, which takes in the wrapper\'s </div>: an image goes as before, a link is refused', async () => {
    expect(await sanitizePostHtml(`<p>Sample</p>${IMG.slice(0, -1)}`)).toBe('<p>Sample</p>')
    expect(await sanitizePostHtmlToday('<p>Sample</p><a href="https://example.org/')).toBe('<p>Sample</p><a href="https://example.org/')
    expect(await sanitizePostHtml('<p>Sample</p><a href="https://example.org/')).toBeNull()
  })
})

describe('News posts cleaner: the refusal through the real handlers', () => {
  const hostile = `<p>Sample post one</p><<x>!-- Sample --> ${IMG}`

  it('a POST answers 400 with the refusal in words and leaves no post behind', async () => {
    const admin = await seedAdmin()
    const before = await postCount()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post one', bodyHtml: hostile } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: REFUSAL })
    expect(await postCount()).toBe(before)
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM lca_posts WHERE title = ?').bind('Sample post one').first<{ n: number }>()).toEqual({ n: 0 })
  })

  it('a PATCH answers 400 with the refusal in words and writes nothing, the title sent with it included', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post two', bodyHtml: '<p>Sample body kept.</p>' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Sample new title', bodyHtml: hostile } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: REFUSAL })
    const row = await env.DB.prepare('SELECT title, body_html, updated_at FROM lca_posts WHERE id = ?').bind(post.id).first<Post>()
    expect(row).toEqual({ title: 'Sample post two', body_html: '<p>Sample body kept.</p>', updated_at: post.updated_at })
  })

  it('a post the rewriter cannot read: a POST and a PATCH answer 400 with the refusal in words, no draft is left and nothing is written', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post seven', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await postCount()
    for (const unread of ['<p>Sample post one</p><select><style>x</style></select>', '<p>Sample post one</p><<x>select><<x>style>x</style>']) {
      const made = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Sample post eight', bodyHtml: unread } })
      expect(made.status, unread).toBe(400)
      expect(await made.json(), unread).toEqual({ error: REFUSAL })
      expect(await postCount(), unread).toBe(before)
      expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM lca_posts WHERE title = ?').bind('Sample post eight').first<{ n: number }>(), unread).toEqual({ n: 0 })
      const edited = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Sample new title', bodyHtml: unread } })
      expect(edited.status, unread).toBe(400)
      expect(await edited.json(), unread).toEqual({ error: REFUSAL })
      const row = await env.DB.prepare('SELECT title, body_html, updated_at FROM lca_posts WHERE id = ?').bind(post.id).first<Post>()
      expect(row, unread).toEqual({ title: 'Sample post seven', body_html: '<p>Sample body kept.</p>', updated_at: post.updated_at })
    }
  })

  it('a POST whose markup settles to nothing saves the post with an empty body, not a refusal', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post three', bodyHtml: `<textarea>${HELD}</textarea><<x>${IMG.slice(1)}` })
    expect(post.body_html).toBe('')
  })

  it('role safety: no one but an LCA admin with a second factor reaches the cleaner, on a POST or a PATCH', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Sample post four', bodyHtml: '<p>Sample body kept.</p>' })
    const before = await postCount()
    const callers: Array<[string | undefined, 'aal1' | 'aal2', number]> = [
      [undefined, 'aal2', 401],
      [await seedMember(), 'aal2', 403],
      [await seedMember({ role: 'club_rep' }), 'aal2', 403],
      [await seedMember({ role: 'lca_officer' }), 'aal2', 403],
      [await seedMember({ role: 'lca_observer' }), 'aal2', 403],
      [admin, 'aal1', 403],
    ]
    for (const [as, aal, status] of callers) {
      const made = await invoke(adminCreate, { method: 'POST', as, aal, body: { title: 'Sample post five', bodyHtml: hostile } })
      expect(made.status, `${as} ${aal}`).toBe(status)
      const edited = await invoke(adminPatch, { method: 'PATCH', as, aal, params: { id: post.id }, body: { bodyHtml: hostile } })
      expect(edited.status, `${as} ${aal}`).toBe(status)
    }
    expect(await postCount()).toBe(before)
    expect((await env.DB.prepare('SELECT body_html FROM lca_posts WHERE id = ?').bind(post.id).first<Post>())?.body_html).toBe('<p>Sample body kept.</p>')
  })
})

// The editor's own forms, as tiptap 3.28.0 writes them (StarterKit and the
// link extension, as RichTextEditor builds the editor): its links carry
// target, rel and href in that order, its text writes "&", "<", ">" and a
// no-break space as entities, a block it ends on is followed by an empty
// paragraph, h1 and h4 to h6 and an ordered list's start come from its
// shortcuts, and a code block's language from its own.
const link = (href: string, text: string) => `<a target="_blank" rel="noopener noreferrer nofollow" href="${href}">${text}</a>`
const EDITOR_POSTS = [
  '<p></p>',
  '<p>Sample post one</p>',
  '<p><strong>Sample</strong> <em>post</em> <u>with</u> <s>every</s> <code>mark()</code></p>',
  '<h2>Sample heading</h2><p></p>',
  '<h3>Sample heading</h3><p>Sample text</p>',
  '<h1>Sample heading</h1><p></p>',
  '<h4>Sample</h4><h5>heading</h5><h6>levels</h6>',
  '<ul><li><p>Sample one</p></li><li><p>Sample two</p></li></ul><p></p>',
  '<ol><li><p>Sample first</p></li><li><p>Sample second</p></li></ol><p></p>',
  '<ol start="3"><li><p>Sample third</p></li></ol>',
  '<ul><li><p>Sample</p><ul><li><p>nested</p></li></ul></li></ul>',
  '<blockquote><p>Sample quote</p></blockquote><p></p>',
  '<blockquote><ul><li><p>Sample quoted point</p></li></ul></blockquote>',
  '<pre><code>if (a &lt; b) return\n  done()</code></pre><p></p>',
  '<pre><code class="language-js">sample &amp;&amp; done</code></pre>',
  '<hr><p>Sample after a rule</p>',
  '<p>Line one<br>line two</p>',
  `<p>See ${link('https://example.org/events?a=1&amp;b=2', 'Sample link')} for more.</p>`,
  `<p>Our ${link('/tournaments/sample-open', 'Sample event')} page.</p>`,
  `<p>${link('mailto:someone@example.org', 'Write to us')}</p>`,
  `<p>${link('tel:+15555550100', 'Call us')}</p>`,
  `<p>${link('https://example.org/a?b=1&amp;c=&quot;d&quot;<e>', 'Sample link')}</p>`,
  `<p>${link('https://example.org', '<strong>Sample</strong> link')}</p>`,
  '<p>Text with &amp; &lt; &gt; " \' &nbsp; and \u{2014} \u{e9} \u{1F600}</p>',
  '<p>Sample\u000b text\u0001 with\u0000 control characters</p>',
  '<p>Sample one</p><p></p><p>Sample two</p>',
  `<h2>Sample tournament</h2><p>Intro with ${link('https://example.org', 'a link')}.</p><ul><li><p>point <strong>one</strong></p></li></ul><blockquote><p>quote</p></blockquote><pre><code>x &lt; y</code></pre><hr><p>end<br>here</p>`,
]

const INLINE = [
  'Sample post one', 'Sample &amp; &lt;text&gt; with &nbsp; and \u{e9}', '<strong>Sample</strong>', '<em>Sample</em>', '<u>Sample</u>', '<s>Sample</s>',
  '<code>sample()</code>', '<strong><em>Sample</em></strong>', 'Line one<br>line two', link('https://example.org/x?y=1&amp;z=2', 'Sample link'),
  link('/tournaments/sample-open', 'Sample event'), link('mailto:someone@example.org', 'Write'), link('tel:+15555550100', 'Call'),
  link('http://example.org', '<strong>Sample</strong> link'),
]
const BLOCKS: Array<(x: string) => string> = [
  (x) => `<p>${x}</p>`, (x) => `<h2>${x}</h2>`, (x) => `<h3>${x}</h3>`, (x) => `<h1>${x}</h1>`, (x) => `<h5>${x}</h5>`,
  (x) => `<ul><li><p>${x}</p></li></ul>`, (x) => `<ol><li><p>${x}</p></li><li><p>${x}</p></li></ol>`, (x) => `<ol start="2"><li><p>${x}</p></li></ol>`,
  (x) => `<ul><li><p>${x}</p><ul><li><p>${x}</p></li></ul></li></ul>`, (x) => `<blockquote><p>${x}</p></blockquote>`,
  (x) => `<blockquote><ol><li><p>${x}</p></li></ol></blockquote>`, () => '<pre><code>a &lt; b &amp;&amp; c\n  d</code></pre>',
  () => '<pre><code class="language-ts">const a = 1</code></pre>', () => '<hr>',
]

/** A few hundred posts built from the forms above: each inline form in each block, then a second block, and an empty paragraph after every other one. */
function builtPosts(): string[] {
  const posts: string[] = []
  INLINE.forEach((a, i) => {
    BLOCKS.forEach((first, j) => {
      const second = BLOCKS[(i * 5 + j * 3) % BLOCKS.length]
      const b = INLINE[(i + j + 1) % INLINE.length]
      posts.push(first(a) + ((i + j) % 2 ? '<p></p>' : ''))
      posts.push(first(a) + second(b))
    })
  })
  return posts
}

describe('News posts cleaner: an ordinary post is unchanged', () => {
  it('every form the editor writes comes out byte for byte as the stored copy gives it, and saved again is left as it is', async () => {
    for (const html of EDITOR_POSTS) {
      const before = await sanitizePostHtmlToday(html)
      expect(await sanitizePostHtml(html), html).toBe(before)
      expect(await sanitizePostHtml(before), html).toBe(before)
    }
  })

  it('a few hundred posts built from the editor\'s forms come out byte for byte, and saved again are left as they are', async () => {
    const posts = builtPosts()
    expect(posts.length).toBeGreaterThanOrEqual(300)
    for (const html of posts) {
      const before = await sanitizePostHtmlToday(html)
      expect(await sanitizePostHtml(html), html).toBe(before)
      expect(await sanitizePostHtml(before), html).toBe(before)
    }
  })

  it('parse5 reads every one of them, as a fragment and in a page, as allowed tags and the cleaner\'s link attributes alone', async () => {
    for (const html of [...EDITOR_POSTS, ...builtPosts()]) {
      expect(liveMarkup((await sanitizePostHtml(html))!), html).toEqual([])
    }
  })

  it('through the handlers: a post saved, then saved again with its stored body, keeps the body today gives', async () => {
    const admin = await seedAdmin()
    const html = EDITOR_POSTS[EDITOR_POSTS.length - 1]
    const post = await create(admin, { title: 'Sample post six', bodyHtml: html })
    expect(post.body_html).toBe(await sanitizePostHtmlToday(html))
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Sample post six, edited', bodyHtml: post.body_html } })
    expect(res.status).toBe(200)
    const saved = (await res.json<{ post: Post }>()).post
    expect(saved.title).toBe('Sample post six, edited')
    expect(saved.body_html).toBe(post.body_html)
  })
})
