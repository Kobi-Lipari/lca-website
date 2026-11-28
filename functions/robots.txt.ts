// functions/robots.txt.ts
//
// GET /robots.txt, the file a search engine's crawler reads before any page,
// by the robots exclusion protocol (RFC 9309).
//
// With CLUB_PAGES_ON unset (functions/utils/clubs/pages.ts, read at each
// call) the request is passed on with context.next(), so the address answers
// what the site answers there today, and nothing is read. The sitemap it
// names answers only with the constant set, so a file that named it sooner
// would point a crawler at the site's shell; that is why this is a handler
// behind the constant and not a file under public/, which would be served
// with every switch off.
//
// With it set the answer is three lines, each ended by a line feed, and
// nothing else:
//
//   User-agent: *
//   Allow: /
//   Sitemap: the sitemap's full address
//
// It forbids nothing: a line that forbids an address is no guard, and it
// names that address to everyone who reads the file; a page that must stay
// out of search engines says so itself. The sitemap's address is built by
// pageAddress, the code the sitemap and the club page's canonical link use,
// so its host is the site's setting, SITE_URL, and the request's own address
// stands only where no setting exists. Nothing here reads a cookie, a header
// or a sign-in, so every reader gets the same bytes, and nothing reads the
// database, so the file has no failure of its own.
import type { Env } from './types'
import { pageAddress } from './utils/events/linkPreview'
import { CLUB_PAGES_ON } from './utils/clubs/pages'

/** The path functions/sitemap.xml.ts answers at. */
const SITEMAP_PATH = '/sitemap.xml'

/** One hour, for every reader alike, as the sitemap is kept. */
const KEPT_AN_HOUR = 'public, max-age=3600'

/** The file: every crawler, every address allowed, and the sitemap named. */
function robotsText(sitemap: string): string {
  return ['User-agent: *', 'Allow: /', `Sitemap: ${sitemap}`].map((line) => `${line}\n`).join('')
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return context.next()
  const sitemap = pageAddress(context.env, new Request(new URL(SITEMAP_PATH, context.request.url)))
  return new Response(robotsText(sitemap), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': KEPT_AN_HOUR },
  })
}
