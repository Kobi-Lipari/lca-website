// functions/utils/posts.ts — shared helpers for LCA news posts.

export interface PostRow {
  id: string
  slug: string
  title: string
  summary: string
  body_html: string
  image_url: string | null
  link_url: string | null
  link_label: string | null
  status: 'draft' | 'published'
  pinned: number
  published_at: string | null
  created_at: string
  updated_at: string
}

/** Columns for list views — everything except the (possibly long) body. */
export const POST_LIST_COLUMNS =
  'id, slug, title, summary, image_url, link_url, link_label, status, pinned, published_at, created_at, updated_at'

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'post'
}

/** A slug nobody else is using: "state-champs", then "state-champs-2", … */
export async function uniqueSlug(db: D1Database, base: string, exceptId?: string): Promise<string> {
  const root = slugify(base)
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`
    const row = await db
      .prepare('SELECT id FROM lca_posts WHERE slug = ?')
      .bind(candidate)
      .first<{ id: string }>()
    if (!row || row.id === exceptId) return candidate
  }
  return `${root}-${Date.now().toString(36)}`
}

/**
 * A link's address the body cleaner and the button link both accept: a page
 * on this site, or an http(s) or mailto address. An address that starts with
 * "/" is a page on this site only when no browser could read it as another
 * site's, whether from an href attribute (where entities are decoded first)
 * or as a plain address: its second character is not "/", not a backslash and
 * not "&" (an entity can spell either of the first two), and it holds no tab,
 * line break or other control character, which a browser drops and which could
 * leave "//" or "/\" at the front. A backslash, "&", "%2f" or "%5c" later in
 * the address, a query and a fragment all stay on this site and are kept.
 */
export function isSafeLink(url: string): boolean {
  if (url.startsWith('/')) {
    for (let i = 0; i < url.length; i++) {
      const code = url.charCodeAt(i)
      // A control character (C0, DEL or C1): a browser drops a tab or line break,
      // which could leave "//" or "/\" at the front, so refuse any of them.
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
    }
    return url.length === 1 || (url[1] !== '/' && url[1] !== '\\' && url[1] !== '&')
  }
  return /^(https?:\/\/|mailto:)/i.test(url)
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li',
  'a', 'blockquote', 'hr', 'code', 'pre',
])

// Tags removed with everything inside them rather than unwrapped. script runs
// code, style restyles the page, and iframe, object and embed load other pages
// or files. A browser reads the inside of textarea, title, noscript, xmp,
// noembed, noframes and plaintext as raw text, and so does the rewriter, which
// hands it on untouched: unwrapping one of them turned an image with an
// onerror written inside it back into a live tag, and an opened plaintext did
// the same to the rest of the post. template, svg and math go with what they
// hold as well, since nothing a post needs lives in them.
const REMOVE_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed',
  'textarea', 'title', 'noscript', 'xmp', 'noembed', 'noframes', 'plaintext',
  'template', 'svg', 'math',
])

/** One cleaning pass: sanitizePostHtml as it ran until this change, but for the longer list of tags removed whole. */
async function cleanOnce(html: string): Promise<string> {
  const rewritten = new HTMLRewriter()
    .on('*', {
      element(el) {
        const tag = el.tagName.toLowerCase()
        if (REMOVE_TAGS.has(tag)) {
          el.remove()
          return
        }
        if (!ALLOWED_TAGS.has(tag)) {
          el.removeAndKeepContent()
          return
        }
        const href = tag === 'a' ? el.getAttribute('href') : null
        for (const [name] of [...el.attributes]) el.removeAttribute(name)
        if (tag === 'a' && href && isSafeLink(href.trim())) {
          el.setAttribute('href', href.trim())
          if (!href.trim().startsWith('/')) {
            el.setAttribute('target', '_blank')
            el.setAttribute('rel', 'noopener noreferrer')
          }
        }
      },
    })
    .transform(new Response(`<div>${html}</div>`, { headers: { 'Content-Type': 'text/html' } }))
  const out = await rewritten.text()
  return out.replace(/^<div>/, '').replace(/<\/div>$/, '').trim()
}

/** An allowed tag with nothing in it but its name, opening or closing, in either case. */
const BARE_TAG = new RegExp(`</?(?:${[...ALLOWED_TAGS].join('|')})>`, 'iy')
/** A link as cleanOnce writes it: the address alone for a site path, else with the new tab's target and rel. */
const WRITTEN_LINK = /<[aA] href="[^"]*"(?: target="_blank" rel="noopener noreferrer")?>/y

/**
 * True when every "<" in the post opens one of the two forms above. A browser
 * starts a tag, a comment or a doctype at a "<" followed by a letter, "/", "!"
 * or "?", and a reader that dropped a NUL or another control character first
 * would find one after it; the editor writes every "<" in its text as "&lt;",
 * so a "<" anywhere else is refused, whatever follows it, rather than guessed
 * at. A link's address may hold a "<" or a ">", since only a double quote ends
 * it, and cleanOnce writes a double quote in one as "&quot;".
 */
function onlyWrittenTags(html: string): boolean {
  for (let at = html.indexOf('<'); at >= 0; at = html.indexOf('<', at)) {
    BARE_TAG.lastIndex = at
    WRITTEN_LINK.lastIndex = at
    const tag = BARE_TAG.exec(html) ?? WRITTEN_LINK.exec(html)
    if (!tag) return false
    at += tag[0].length
  }
  return true
}

/** A link's attributes in the one order and form cleanOnce writes them, the href already trimmed. */
function isWrittenLink(attributes: string[][]): boolean {
  const [name, href] = attributes[0]
  if (name !== 'href' || href !== href.trim() || !isSafeLink(href)) return false
  if (href.startsWith('/')) return attributes.length === 1
  return attributes.length === 3
    && attributes[1][0] === 'target' && attributes[1][1] === '_blank'
    && attributes[2][0] === 'rel' && attributes[2][1] === 'noopener noreferrer'
}

/** The rewriter's own reading of the post: allowed elements only, attributes on a link alone and as written, no comment or doctype. */
async function rewriterAgrees(html: string): Promise<boolean> {
  let agrees = true
  await new HTMLRewriter()
    .on('*', {
      element(el) {
        const attributes = [...el.attributes]
        const tag = el.tagName.toLowerCase()
        if (!ALLOWED_TAGS.has(tag)) agrees = false
        else if (attributes.length > 0 && !(tag === 'a' && isWrittenLink(attributes))) agrees = false
      },
    })
    .onDocument({
      comments() { agrees = false },
      doctype() { agrees = false },
    })
    .transform(new Response(html, { headers: { 'Content-Type': 'text/html' } }))
    .text()
  return agrees
}

/** A post still changing after this many passes is refused. */
const MAX_PASSES = 5

/**
 * Keeps only the formatting the editor produces, or answers null for a post
 * that cannot be made safe to show. Posts are written by admins, but they are
 * shown to everyone, so a pasted <script>, an onclick or a javascript: link is
 * stripped rather than trusted. Unwrapping a tag joins the text on either side
 * of it, which can spell a new tag (a "<", an unknown tag, then "img ..."), so
 * the post is cleaned again until a pass changes nothing, five passes at most,
 * and the result is then read twice: by the rewriter, and "<" by "<" against
 * the forms the cleaner writes. A post that does not settle, or that either
 * reading finds anything else in, is refused rather than guessed at. So is a
 * post the rewriter cannot read: it stops with an error at a tag whose inside
 * is raw text in a place where it cannot tell whether a browser would read
 * that inside as text, such as after a select or a frameset, and a join can
 * make both tags for a later pass. What the editor writes takes its final
 * form in the first pass, the same bytes the cleaner gave before this change,
 * and the second pass changes nothing.
 */
export async function sanitizePostHtml(html: string): Promise<string | null> {
  try {
    let out = html
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const next = await cleanOnce(out)
      if (next === out) return onlyWrittenTags(out) && (await rewriterAgrees(out)) ? out : null
      out = next
    }
    return null
  } catch {
    // The rewriter stopped on the post. Refusing it here keeps the error out
    // of the save, where it would leave a new post's draft behind.
    return null
  }
}

/** YYYY-MM-DD, or null. */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  return m ? m[1] : null
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── Create / edit rules ────────────────────────────────────────────────────

export interface PostBody {
  title?: string
  slug?: string
  summary?: string
  bodyHtml?: string
  linkUrl?: string | null
  linkLabel?: string | null
  status?: 'draft' | 'published'
  pinned?: boolean
  publishedAt?: string | null
}

const MAX_TITLE = 140
const MAX_SUMMARY = 400
const MAX_BODY = 60_000

/** The one plain refusal when a create or edit request is not in the shape the site sends. */
export const POST_FIELD_REFUSAL =
  'This post could not be saved because part of it was not in the form the site expects. Reload the page and try again.'

/**
 * Holds every field of a create or edit request to its kind before any field
 * is read or any row is written: the whole body an object; title, slug,
 * summary and bodyHtml text; linkUrl, linkLabel and publishedAt text or null;
 * status text; pinned true or false. A field left out is fine. Anything else
 * returns the one refusal above, so a request made by hand cannot end in an
 * unhandled error, leave a half-made post behind, or pass a length limit on a
 * value that is not text (a list's length counts its items). Unknown keys are
 * left alone, as the request parser elsewhere leaves them.
 */
export function checkPostBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return POST_FIELD_REFUSAL
  const b = body as Record<string, unknown>
  const text = (v: unknown) => v === undefined || typeof v === 'string'
  const textOrNull = (v: unknown) => v === undefined || v === null || typeof v === 'string'
  if (!text(b.title) || !text(b.slug) || !text(b.summary) || !text(b.bodyHtml) || !text(b.status)) return POST_FIELD_REFUSAL
  if (!textOrNull(b.linkUrl) || !textOrNull(b.linkLabel) || !textOrNull(b.publishedAt)) return POST_FIELD_REFUSAL
  if (b.pinned !== undefined && typeof b.pinned !== 'boolean') return POST_FIELD_REFUSAL
  return null
}

/**
 * Applies a (partial) edit and returns the saved post, or an error message.
 * Shared with create so both follow the same rules.
 */
export async function applyPostEdits(
  db: D1Database,
  id: string,
  body: PostBody,
  memberId: string,
): Promise<PostRow | string> {
  const fieldError = checkPostBody(body)
  if (fieldError) return fieldError

  const existing = await db.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(id).first<PostRow>()
  if (!existing) return 'Post not found'

  const next = { ...existing }

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (!title) return 'A title is required'
    if (title.length > MAX_TITLE) return `Titles are limited to ${MAX_TITLE} characters`
    next.title = title
  }
  if (body.summary !== undefined) {
    const summary = body.summary.trim()
    if (summary.length > MAX_SUMMARY) return `The summary is limited to ${MAX_SUMMARY} characters`
    next.summary = summary
  }
  if (body.bodyHtml !== undefined) {
    if (body.bodyHtml.length > MAX_BODY) return 'The post is too long'
    const clean = await sanitizePostHtml(body.bodyHtml)
    if (clean === null) return 'This post holds markup that cannot be saved. Remove any pasted code and try again.'
    // The editor's empty state is "<p></p>".
    next.body_html = clean.replace(/<p>\s*<\/p>/g, '').trim() ? clean : ''
  }
  if (body.linkUrl !== undefined) {
    const url = body.linkUrl?.trim() || null
    if (url && !isSafeLink(url)) return 'The button link must be a page on this site, starting with a single /, or start with http://, https:// or mailto:'
    next.link_url = url
  }
  if (body.linkLabel !== undefined) {
    next.link_label = body.linkLabel?.trim().slice(0, 40) || null
  }
  if (next.link_url && !next.link_label) next.link_label = 'Learn more'
  if (body.pinned !== undefined) next.pinned = body.pinned ? 1 : 0
  if (body.publishedAt !== undefined) {
    const date = normalizeDate(body.publishedAt)
    if (body.publishedAt && !date) return 'The date must be YYYY-MM-DD'
    next.published_at = date
  }
  if (body.status !== undefined) {
    if (body.status !== 'draft' && body.status !== 'published') return 'Invalid status'
    next.status = body.status
  }
  // The slug can change freely while a draft; once published, links to it
  // may already be on Facebook, so it only changes when asked explicitly.
  if (body.slug !== undefined && body.slug.trim()) {
    next.slug = await uniqueSlug(db, body.slug, id)
  } else if (existing.status === 'draft' && body.title !== undefined) {
    next.slug = await uniqueSlug(db, next.title, id)
  }
  if (next.status === 'published') {
    if (!next.summary && !next.body_html) return 'Add a summary or some text before publishing'
    if (!next.published_at) next.published_at = todayIso()
  }

  await db.prepare(
    `UPDATE lca_posts SET
       slug = ?, title = ?, summary = ?, body_html = ?, link_url = ?, link_label = ?,
       status = ?, pinned = ?, published_at = ?, updated_by = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).bind(
    next.slug, next.title, next.summary, next.body_html, next.link_url, next.link_label,
    next.status, next.pinned, next.published_at, memberId, id,
  ).run()

  return (await db.prepare('SELECT * FROM lca_posts WHERE id = ?').bind(id).first<PostRow>())!
}
