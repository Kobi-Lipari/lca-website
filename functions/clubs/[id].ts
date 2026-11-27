// functions/clubs/[id].ts
//
// Serves the normal app shell for /clubs/:id with the club's own link
// preview: name, city and meeting time, and its logo when one is uploaded.
//
// With CLUB_PAGES_ON set (functions/utils/clubs/pages.ts, read at each call)
// the address is the new club page's (WS09 step 23), and the address part is
// looked up in the fixed order the page's answer uses (clubNamedBy in
// functions/utils/clubs/pageAnswer.ts): a club's current slug, then an old
// slug, then its id. The page is served only at the club's own address, its
// slug, or its id while it has none; any other address that finds the club
// (an old slug, an id that is not its slug, a slug typed in capitals)
// answers 301 to /clubs/{slug} on this site, with the query it came with, so
// the target of every 301 is served and nothing loops. A browser keeps a 301
// for a day, no longer, since a keeper may move a slug and later take it back.
// The page is the shell with, in its head, the title, the description, the
// canonical link, the share card and one JSON-LD block, each of the club's
// words escaped for an attribute, and in its body, before any script, the
// club's page in plain HTML (functions/utils/clubs/pageHtml.ts), all from
// the one answer the app draws. A word the club pages keep for their own
// addresses, an unknown part, a part too long and any failure give the plain
// shell, as today. Nothing here reads a cookie, so every reader gets the
// same bytes.
import type { Env } from '../types'
import { clip, withLinkPreview } from '../utils/events/linkPreview'
import { resolveSiteUrl } from '../utils/site'
import { CLUB_PAGES_ON } from '../utils/clubs/pages'
import { addressAsGiven, asSlug, clubAddress, clubNamedBy, clubPageAnswer } from '../utils/clubs/pageAnswer'
import { clubJsonLd, clubPageBody, clubPagePath, escapeHtml, pageDescription, pageTitle } from '../utils/clubs/pageHtml'
import { isReservedSlug } from '../../domain/clubs/slug'

interface ClubPreviewRow {
  name: string
  city: string | null
  meeting_schedule: string | null
  location: string | null
  description: string | null
  image_url: string | null
}

/** Today's link preview, as it was before the new club page. */
async function todaysPreview(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
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

    return withLinkPreview(
      shell,
      {
        title: club.name,
        description,
        // Only logos uploaded through the site (served from our own
        // storage), never an arbitrary external URL.
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

/** How long a browser keeps a 301: a day, so a slug a keeper takes back is not held as a redirect for good. */
const REDIRECT_KEPT = 'max-age=86400'

/** The head tags whose value is a club's own words: written again here, escaped, since a rewritten attribute keeps "&", "<" and ">" as typed. */
const OWN_WORDS_TAGS = new Set(['og:title', 'og:description', 'description'])

/**
 * The page's title, its card's title and description and its JSON-LD block,
 * written into a head the link preview has already filled. The preview's own
 * og:title, og:description and description tags are taken out and written
 * once more with every word escaped for an attribute, so each tag stands once.
 */
function withPageHead(page: Response, head: { title: string; cardTitle: string; description: string; jsonLd: string }): Response {
  const contentType = page.headers.get('Content-Type') ?? ''
  if (!page.ok || !contentType.includes('text/html')) return page
  const tags = [
    `<meta property="og:title" content="${escapeHtml(head.cardTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(head.description)}" />`,
    `<meta name="description" content="${escapeHtml(head.description)}" />`,
    head.jsonLd,
  ].join('\n    ')
  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(head.title)
      },
    })
    .on('meta', {
      element(el) {
        const key = el.getAttribute('property') ?? el.getAttribute('name') ?? ''
        if (OWN_WORDS_TAGS.has(key)) el.remove()
      },
    })
    .on('head', {
      element(el) {
        el.append(`  ${tags}\n  `, { html: true })
      },
    })
    .transform(page)
}

/** The headers by which a reader asks whether its copy is still good, and those by which the shell answers it. */
const ASKED_VALIDATORS = ['If-None-Match', 'If-Modified-Since']
const SHELL_VALIDATORS = ['ETag', 'Last-Modified']

/**
 * The shell, asked without the reader's validators. The shell's ETag stands
 * for index.html, not for the club's words, so a reader holding it must not be
 * told by the asset server that a page whose words have since changed is
 * unchanged.
 */
function shellForPage(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const headers = new Headers(context.request.headers)
  for (const name of ASKED_VALIDATORS) headers.delete(name)
  return context.next(new Request(context.request, { headers }))
}

/** The written page with the shell's validators taken off, since they would name the shell and not the page. */
function withoutShellValidators(page: Response): Response {
  const out = new Response(page.body, page)
  for (const name of SHELL_VALIDATORS) out.headers.delete(name)
  return out
}

/** The new club page at its own address, a 301 to it from any other that finds the club, or the plain shell. */
async function clubPage(context: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  let shell: Response | null = null
  try {
    const raw = typeof context.params.id === 'string' ? context.params.id : ''
    const given = addressAsGiven(raw)
    if (isReservedSlug(asSlug(given))) return await context.next()
    const db = context.env.DB
    const club = await clubNamedBy(db, raw)
    if (!club) return await context.next()

    const address = clubAddress(club)
    if (given !== address) {
      // A relative address on this site: the slug is encoded, so no address part can send the browser elsewhere.
      const { search } = new URL(context.request.url)
      return new Response(null, {
        status: 301,
        headers: { Location: `${clubPagePath(address)}${search}`, 'Cache-Control': REDIRECT_KEPT },
      })
    }

    shell = await shellForPage(context)
    const answer = await clubPageAnswer(db, club)
    const site = resolveSiteUrl(context.env, context.request)
    // The canonical link and og:url are the slug's address, built as the preview builds every address.
    const pageRequest = new Request(new URL(clubPagePath(answer.club.slug), context.request.url))
    const description = pageDescription(answer)
    const page = withLinkPreview(
      shell,
      {
        title: answer.club.name,
        description,
        // The logo uploaded through the site, by today's rule; else the site's own card.
        image: answer.club.logo,
        imageIsSquare: true,
        root: clubPageBody(answer),
      },
      context.env,
      pageRequest,
    )
    return withoutShellValidators(
      withPageHead(page, {
        title: pageTitle(answer),
        // Cut as the preview cuts its own card.
        cardTitle: clip(answer.club.name, 90),
        description: clip(description, 200),
        jsonLd: clubJsonLd(answer, site),
      }),
    )
  } catch (err) {
    console.error('club page failed', err)
    return shell ?? (await context.next())
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return todaysPreview(context)
  return clubPage(context)
}
