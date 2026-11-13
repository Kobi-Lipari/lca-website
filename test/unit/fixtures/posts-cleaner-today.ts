// test/unit/fixtures/posts-cleaner-today.ts
//
// Today's News posts cleaner, lines 47 to 90 of functions/utils/posts.ts as
// they stood at commit af4a21c, the merge of pull request 127: isSafeLink,
// the allowed tags and sanitizePostHtml, kept word for word but for this
// comment and the cleaner's name, sanitizePostHtmlToday. It runs on the
// Workers runtime's HTMLRewriter, so only the integration suite can run it:
// test/integration/posts-cleaner.test.ts reads every post the site's editor
// writes through it and through the live cleaner and holds the two to the
// same bytes, and shows each way markup got through it.

/** Site paths ("/tournaments/x") or http(s)/mailto links only. */
export function isSafeLink(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  return /^(https?:\/\/|mailto:)/i.test(url)
}

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li',
  'a', 'blockquote', 'hr', 'code', 'pre',
])

/**
 * Keeps only the formatting the editor produces. Posts are written by
 * admins, but they are shown to everyone, so a pasted <script>, an onclick
 * or a javascript: link is stripped rather than trusted.
 */
export async function sanitizePostHtmlToday(html: string): Promise<string> {
  const rewritten = new HTMLRewriter()
    .on('*', {
      element(el) {
        const tag = el.tagName.toLowerCase()
        if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') {
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
