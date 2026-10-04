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

/** Site paths ("/tournaments/x") or http(s)/mailto links only. */
export function isSafeLink(url: string): boolean {
  // Browsers drop tabs and newlines inside a URL and read "\" as "/", so
  // "/\evil.example" and "/<tab>/evil.example" both leave the site.
  const path = url.replace(/[\t\n\r]/g, '').replace(/\\/g, '/')
  if (path.startsWith('/') && !path.startsWith('//')) return true
  return /^(https?:\/\/|mailto:)/i.test(url)
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li',
  'a', 'blockquote', 'hr', 'code', 'pre',
])

/**
 * Removed together with everything inside them. The first row is active
 * content. The second is elements whose content the rewriter hands over as
 * raw text (and SVG/MathML, where CDATA is text): dropping only the tag
 * would leave "<img onerror=…>" behind as text here, which the browser then
 * parses as a real element.
 */
const DROPPED_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed',
  'textarea', 'title', 'xmp', 'noembed', 'noframes', 'noscript', 'plaintext', 'svg', 'math', 'template',
])

/**
 * What an uploaded Word document adds on top of the editor's formatting once
 * it has been converted: more heading levels, tables, footnote marks and
 * embedded pictures. Governance documents (bylaws, minutes, treasurer's
 * reports) keep these.
 */
const DOCUMENT_TAGS = new Set([
  ...ALLOWED_TAGS,
  'h1', 'h4', 'h5', 'h6', 'sup', 'sub', 'img',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
])

/** Pictures embedded by the converter, or files on this site. Never SVG. */
function isSafeImageSource(src: string): boolean {
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(src)) return true
  return src.startsWith('/') && isSafeLink(src)
}

/** The attributes worth keeping on an allowed tag; everything else goes. */
function keptAttributes(tag: string, get: (name: string) => string | null): Array<[string, string]> {
  const kept: Array<[string, string]> = []
  const number = (name: string) => {
    const value = get(name)?.trim()
    if (value && /^\d{1,4}$/.test(value)) kept.push([name, value])
  }
  if (tag === 'a') {
    const href = get('href')?.trim()
    if (href && isSafeLink(href)) {
      kept.push(['href', href])
      if (!href.startsWith('/')) kept.push(['target', '_blank'], ['rel', 'noopener noreferrer'])
    }
  } else if (tag === 'ol') {
    number('start')
  } else if (tag === 'td' || tag === 'th') {
    number('colspan')
    number('rowspan')
  } else if (tag === 'img') {
    kept.push(['src', get('src')?.trim() ?? ''], ['alt', get('alt') ?? ''])
  }
  return kept
}

async function sanitizeHtml(html: string, allowed: Set<string>): Promise<string> {
  const rewritten = new HTMLRewriter()
    .on('*', {
      element(el) {
        const tag = el.tagName.toLowerCase()
        if (DROPPED_WITH_CONTENT.has(tag)) {
          el.remove()
          return
        }
        if (!allowed.has(tag)) {
          el.removeAndKeepContent()
          return
        }
        if (tag === 'img' && !isSafeImageSource(el.getAttribute('src')?.trim() ?? '')) {
          el.remove()
          return
        }
        const kept = keptAttributes(tag, (name) => el.getAttribute(name))
        for (const [name] of [...el.attributes]) el.removeAttribute(name)
        for (const [name, value] of kept) el.setAttribute(name, value)
      },
      // The editor never writes comments, and "<!-->" style ones are one
      // more place where two parsers can disagree about what is markup.
      comments(comment) {
        comment.remove()
      },
    })
    .transform(new Response(`<div>${html}</div>`, { headers: { 'Content-Type': 'text/html' } }))
  const out = await rewritten.text()
  return out.replace(/^<div>/, '').replace(/<\/div>$/, '').trim()
}

/**
 * Keeps only the formatting the editor produces. Posts are written by
 * admins, but they are shown to everyone, so a pasted <script>, an onclick
 * or a javascript: link is stripped rather than trusted.
 */
export function sanitizePostHtml(html: string): Promise<string> {
  return sanitizeHtml(html, ALLOWED_TAGS)
}

/**
 * The same for governance documents, which officers and observers can save
 * without a second factor and every visitor then reads.
 */
export function sanitizeDocumentHtml(html: string): Promise<string> {
  return sanitizeHtml(html, DOCUMENT_TAGS)
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
    // The editor's empty state is "<p></p>".
    next.body_html = clean.replace(/<p>\s*<\/p>/g, '').trim() ? clean : ''
  }
  if (body.linkUrl !== undefined) {
    const url = body.linkUrl?.trim() || null
    if (url && !isSafeLink(url)) return 'The button link must start with /, http://, https:// or mailto:'
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
