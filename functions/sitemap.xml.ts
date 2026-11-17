// functions/sitemap.xml.ts
//
// GET /sitemap.xml, the list of this site's pages a search engine reads.
//
// With CLUB_PAGES_ON unset (functions/utils/clubs/pages.ts, read at each
// call) the request is passed on with context.next(), so the address answers
// what the site answers there today, and nothing is read. With it set the
// answer is an XML document by the sitemap protocol
// (https://www.sitemaps.org/protocol.html) that lists two kinds of page and
// nothing else:
//
// - every club page a visitor is served, once, at the club's own address,
//   its slug or its id while it has none, with the club's told_updated_at as
//   its last change where the stored value reads as a date; and
// - every listed event's page, /tournaments/{id}, the events read through
//   listedWhere (functions/utils/events/listing.ts), so a hidden draft is
//   never in it.
//
// Each address is built by the code that builds the page's canonical link:
// clubAddress and clubPagePath for a club, as functions/clubs/[id].ts calls
// them, and pageAddress, the link preview's own, for the host and the path.
// The host is the site's setting, SITE_URL, as on the canonical link; the
// request's own address stands only where no setting exists, as on a
// computer with no configuration. Nothing here reads a cookie, a header or
// a sign-in, so every reader gets the same bytes. A failure answers 503 in
// plain words, kept by no one, never half a list.
import type { Env } from './types'
import { pageAddress } from './utils/events/linkPreview'
import { listedWhere } from './utils/events/listing'
import { CLUB_PAGES_ON } from './utils/clubs/pages'
import { ADDRESS_MAX, asSlug, clubAddress, clubNamedBy } from './utils/clubs/pageAnswer'
import { clubPagePath } from './utils/clubs/pageHtml'
import { isReservedSlug } from '../domain/clubs/slug'

/** The protocol's namespace for a list of pages. */
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'

/** One hour, for every reader alike. */
const KEPT_AN_HOUR = 'public, max-age=3600'

/** What a reader is told when the list cannot be read: no detail of the failure. */
const SITEMAP_UNAVAILABLE = 'The sitemap cannot be read just now. Please try again in a few minutes.'

interface ClubRow {
  id: string
  slug: string | null
  told_updated_at: string | null
}

interface Entry {
  loc: string
  lastmod: string | null
}

/** A value written into the document: every character XML gives a meaning escaped. */
function xmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** A stored date and time: SQLite's "YYYY-MM-DD HH:MM:SS", or the same with a "T", seconds' fractions or a zone; a date alone too. */
const STORED_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/

/**
 * A club's told_updated_at as the protocol writes a last change (the W3C
 * form, "2026-11-02T15:00:00Z", or a date alone), or null when the club has
 * none or the stored value does not read as a real date. A time with no zone
 * is read as UTC, the zone SQLite's datetime('now') writes in.
 */
function lastChange(value: string | null): string | null {
  if (!value) return null
  const found = STORED_TIME.exec(value.trim())
  if (!found) return null
  const [, year, month, day, hour, minute, second, zone] = found
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null
  if (hour === undefined) return `${year}-${month}-${day}`
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second ?? '0') > 59) return null
  const at = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second ?? '00'}${zone ?? 'Z'}`)
  if (Number.isNaN(at)) return null
  return new Date(at).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** The full address of a path on this site, by the canonical link's own code. */
function siteAddress(env: Env, request: Request, path: string): string {
  return pageAddress(env, new Request(new URL(path, request.url)))
}

/**
 * True when the club's page is served at its own address. A slug in the form
 * the slug rule writes it (trimmed, in lower case, within ADDRESS_MAX and no
 * reserved word) is the club's own by the unique index on clubs.slug, and the
 * page's finder tries a current slug first, so it needs no lookup. Any other
 * address, an id above all, is looked up by clubNamedBy, as the route looks
 * up the part it is asked, and is listed only when it finds this club.
 */
async function servedAtOwnAddress(db: D1Database, club: ClubRow): Promise<boolean> {
  const address = clubAddress(club)
  if (isReservedSlug(asSlug(address))) return false
  if (club.slug !== null && club.slug === asSlug(club.slug) && club.slug !== '' && club.slug.length <= ADDRESS_MAX) return true
  const found = await clubNamedBy(db, encodeURIComponent(address))
  return found !== null && found.id === club.id
}

/** Every club page a visitor is served, once each, in the order of their addresses. */
async function clubEntries(env: Env, request: Request): Promise<Entry[]> {
  const db = env.DB
  const { results } = await db
    .prepare('SELECT id, slug, told_updated_at FROM clubs ORDER BY COALESCE(slug, id), id')
    .all<ClubRow>()
  const seen = new Set<string>()
  const entries: Entry[] = []
  for (const club of results ?? []) {
    const path = clubPagePath(clubAddress(club))
    // A path the address bar would rewrite (an id of "." or "..") names another page, so it is left out.
    if (new URL(path, request.url).pathname !== path) continue
    if (!(await servedAtOwnAddress(db, club))) continue
    const loc = siteAddress(env, request, path)
    if (seen.has(loc)) continue
    seen.add(loc)
    entries.push({ loc, lastmod: lastChange(club.told_updated_at) })
  }
  return entries
}

/** Every listed event's page, newest first. An event has no column for its last change, so it carries none. */
async function eventEntries(env: Env, request: Request): Promise<Entry[]> {
  const { results } = await env.DB
    .prepare(`SELECT t.id FROM tournaments t WHERE ${listedWhere('t')} ORDER BY t.date DESC, t.id`)
    .all<{ id: string }>()
  const seen = new Set<string>()
  const entries: Entry[] = []
  for (const event of results ?? []) {
    const path = `/tournaments/${encodeURIComponent(event.id)}`
    // As for a club: an id of "." or ".." would name another page, so it is left out.
    if (new URL(path, request.url).pathname !== path) continue
    const loc = siteAddress(env, request, path)
    if (seen.has(loc)) continue
    seen.add(loc)
    entries.push({ loc, lastmod: null })
  }
  return entries
}

/** The document: the urlset with its namespace, and a url with its loc and, where it has one, its lastmod. */
function sitemapXml(entries: readonly Entry[]): string {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${xmlText(entry.lastmod)}</lastmod>` : ''
    return `  <url>\n    <loc>${xmlText(entry.loc)}</loc>${lastmod}\n  </url>\n`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="${SITEMAP_NAMESPACE}">\n${urls.join('')}</urlset>\n`
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  if (!CLUB_PAGES_ON) return context.next()
  try {
    const clubs = await clubEntries(context.env, context.request)
    const events = await eventEntries(context.env, context.request)
    return new Response(sitemapXml([...clubs, ...events]), {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': KEPT_AN_HOUR },
    })
  } catch (err) {
    console.error('sitemap failed', err)
    return new Response(SITEMAP_UNAVAILABLE, {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}
