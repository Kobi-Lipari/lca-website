// functions/utils/linkPreview.ts
//
// Link previews for pages people share — mostly tournaments and clubs posted
// to Facebook. Crawlers (Facebook, iMessage, Slack, Discord) read the HTML
// head and never run the React app, so the per-page title/description/image
// has to be written into the index.html response on the way out.
//
// The page functions call context.next() to get the normal SPA shell, then
// pass it through here. Anything that goes wrong just returns the shell
// untouched, which still carries the site-wide defaults from index.html.
import { resolveSiteUrl, type SiteEnv } from './site'

export interface LinkPreview {
  title: string
  description: string
  /** Absolute URL, or a site-relative path that gets made absolute. */
  image?: string | null
  /** Square logos preview better as a small card than a stretched banner. */
  imageIsSquare?: boolean
  type?: 'website' | 'article'
}

const SITE_NAME = 'Louisiana Chess Association'

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export function withLinkPreview(
  shell: Response,
  preview: LinkPreview,
  env: SiteEnv,
  request: Request,
): Response {
  const contentType = shell.headers.get('Content-Type') ?? ''
  if (!shell.ok || !contentType.includes('text/html')) return shell

  const site = resolveSiteUrl(env, request)
  const pageUrl = `${site}${new URL(request.url).pathname}`
  const title = clip(preview.title, 90)
  const description = clip(preview.description, 200)
  const image = preview.image
    ? (preview.image.startsWith('http') ? preview.image : `${site}${preview.image}`)
    : `${site}/og-default.jpg`

  const replace: Record<string, string> = {
    'og:title': title,
    'og:description': description,
    'og:image': image,
    'og:type': preview.type ?? 'website',
    description,
  }
  const hasCustomImage = !!preview.image

  const tags = [
    `<meta property="og:url" content="${escapeAttr(pageUrl)}" />`,
    `<link rel="canonical" href="${escapeAttr(pageUrl)}" />`,
    `<meta name="twitter:title" content="${escapeAttr(title)}" />`,
    `<meta name="twitter:description" content="${escapeAttr(description)}" />`,
    `<meta name="twitter:image" content="${escapeAttr(image)}" />`,
  ].join('\n    ')

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(`${title} | ${SITE_NAME}`)
      },
    })
    .on('meta', {
      element(el) {
        const key = el.getAttribute('property') ?? el.getAttribute('name') ?? ''
        if (key in replace) el.setAttribute('content', replace[key])
        // A club logo is square; the default dimensions describe the
        // 1200x630 banner and would make Facebook crop it.
        if (hasCustomImage && (key === 'og:image:width' || key === 'og:image:height')) el.remove()
        if (hasCustomImage && preview.imageIsSquare && key === 'twitter:card') {
          el.setAttribute('content', 'summary')
        }
      },
    })
    .on('head', {
      element(el) {
        el.append(`    ${tags}\n  `, { html: true })
      },
    })
    .transform(shell)
}

export function formatPreviewDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}
