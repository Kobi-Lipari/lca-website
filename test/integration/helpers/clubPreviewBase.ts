// test/integration/helpers/clubPreviewBase.ts
//
// The base's code, as it stood at 0a25e33 before WS09 step 23, kept here so
// the tests can hold today's answers to it byte for byte: the link preview
// (functions/utils/events/linkPreview.ts) and the club route
// (functions/clubs/[id].ts). Only the comments and the names are changed;
// every line that writes a byte is the base's.
import type { Env } from '../../../functions/types'
import { resolveSiteUrl, type SiteEnv } from '../../../functions/utils/site'

export interface BaseLinkPreview {
  title: string
  description: string
  image?: string | null
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

/** withLinkPreview as the base wrote it. */
export function baseWithLinkPreview(shell: Response, preview: BaseLinkPreview, env: SiteEnv, request: Request): Response {
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

interface ClubPreviewRow {
  name: string
  city: string | null
  meeting_schedule: string | null
  location: string | null
  description: string | null
  image_url: string | null
}

/** The club route's GET as the base wrote it. */
export const baseClubRoute: PagesFunction<Env> = async (context) => {
  const shell = await context.next()
  try {
    const id = context.params.id as string
    const club = await context.env.DB.prepare(
      `SELECT name, city, meeting_schedule, location, description, image_url FROM clubs WHERE id = ?`,
    ).bind(id).first<ClubPreviewRow>()
    if (!club) return shell

    const meets = [club.meeting_schedule, club.location].filter(Boolean).join(' at ')
    const description = [
      club.city ? `Chess club in ${club.city}, Louisiana` : 'Chess club in Louisiana',
      meets ? `Meets ${meets}` : null,
      club.description,
    ].filter(Boolean).join(' · ')

    return baseWithLinkPreview(
      shell,
      {
        title: club.name,
        description,
        image: club.image_url?.startsWith('/api/clubs/') ? club.image_url : null,
        imageIsSquare: true,
      },
      context.env,
      context.request,
    )
  } catch (err) {
    console.error('club link preview failed', err)
    return shell
  }
}
