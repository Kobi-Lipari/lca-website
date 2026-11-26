// functions/utils/clubs/directory.ts
//
// GET /api/clubs while CLUB_PAGES_ON is set (WS09 step 32): the list the new
// directory reads. The same clubs today's list gives, every club, A to Z by
// name, each with today's nine keys unchanged and in their order, and then
// the directory's: the address part of the club's page, how the club meets
// in its own words, the club's description for a club with no statement,
// the club's point and the two ticks of Who is welcome. They are built by
// the club page's own rules, so a club's card and its page never say two
// different things: the address part by clubAddress, the statement as the
// page's answer gives it, the description by clubDescription in
// domain/clubs/description.ts, and the point by the rule the foot of a club
// page reads its nearest clubs by (./nearest.ts).
//
// It carries no keeper, no seat, no person's name and no address of any
// kind: who keeps a club is not public (K's decision 12). It reads no part
// of the request but its origin, the site's own: no query parameter, no
// header and no cookie, so the answer is the same for every reader, and
// nothing a visitor types or the device's position is read here. The ZIP
// code the directory keeps in its own address (near=) does reach this site
// whenever that address is loaded (a reload, a shared link), but this list
// reads none of it, and the directory asks for it with the site's origin
// alone as the referrer. It writes no log line.
//
// The answer is kept in the edge's cache for five minutes, under one key,
// the list's plain address on the site's origin, so a caller cannot fill the
// cache with keys of its own making. Only the edge keeps it: the reader's
// browser is told to ask again each time, so no copy is older than the
// edge's five minutes. Every reader of this list waits on those five
// minutes while the constant is set: a save in the club editor, a club made
// or removed, can take up to five minutes to show in the directory, on the
// home page, on the admin page (its Clubs tab, the clubs of its Members tab
// and the club picker of its tournament form) and in the email page's
// choice of clubs.
import { clubAddress } from './pageAnswer'
import { FIRST_PLACE_JOIN, firstPlacePoint, type FirstPlaceColumns } from './nearest'
import { filled } from '../../../domain/clubs/sections'
import { clubDescription } from '../../../domain/clubs/description'
import type { ClubDirectoryItem, ClubDirectoryResponse } from '../../../domain/contracts/clubs'
import { jsonResponse } from '../response'

/** How the edge's copy of the directory's list is kept: five minutes, read by the edge's cache. */
export const DIRECTORY_CACHE_CONTROL = 'public, max-age=300'

/** What the reader's browser is told: keep no copy without asking again, so only the edge keeps the list. */
export const DIRECTORY_READER_CACHE_CONTROL = 'no-cache'

/** The same answer with the reader's cache line in place of the edge's. */
function forTheReader(response: Response): Response {
  const reply = new Response(response.body, response)
  reply.headers.set('Cache-Control', DIRECTORY_READER_CACHE_CONTROL)
  return reply
}

/** The two things the list asks of a cache: the Workers runtime's own, or a test's stand-in. */
export interface DirectoryCache {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

/** The edge's cache where the runtime has one, and none where it has not. */
export function directoryCache(): DirectoryCache | null {
  if (typeof caches === 'undefined') return null
  return (caches as Partial<CacheStorage>).default ?? null
}

/** The one key the list is kept under: its plain address on the site's own origin, with no query. */
export function directoryCacheKey(origin: string): string {
  return `${origin}/api/clubs`
}

/** A club as the list reads it: today's nine columns, then the ones the directory's keys are built from. */
interface DirectoryRow extends FirstPlaceColumns {
  id: string
  name: string
  city: string
  meeting_schedule: string | null
  color: string | null
  image_url: string | null
  region: string | null
  slug: string | null
  how_we_meet_text: string | null
  about_text: string | null
  weekend_play: number
  scholastic_friendly: number
}

/** The one query: every club, A to Z by name, then by id, with its first place beside it. */
export const DIRECTORY_QUERY = `SELECT c.id, c.name, c.city, c.meeting_schedule, c.color, c.image_url, c.region, c.latitude, c.longitude,
              c.slug, c.how_we_meet_text, c.about_text, c.weekend_play, c.scholastic_friendly,
              p.id AS place_id, p.latitude AS place_latitude, p.longitude AS place_longitude
         FROM clubs c
         ${FIRST_PLACE_JOIN}
        ORDER BY c.name ASC, c.id ASC`

/** One club of the list, built from named columns, never a spread of a row. */
export function directoryItem(row: DirectoryRow): ClubDirectoryItem {
  const statement = filled(row.how_we_meet_text) ? row.how_we_meet_text : null
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    meeting_schedule: row.meeting_schedule,
    color: row.color,
    image_url: row.image_url,
    region: row.region,
    latitude: row.latitude,
    longitude: row.longitude,
    slug: clubAddress(row),
    statement,
    description: statement === null ? clubDescription(filled(row.about_text) ? row.about_text : null, null, row.city, row.region) : null,
    point: firstPlacePoint(row),
    weekend_play: row.weekend_play === 1,
    scholastic_friendly: row.scholastic_friendly === 1,
  }
}

/** The list's answer, read from the database in one query. */
export async function readDirectory(db: D1Database): Promise<ClubDirectoryResponse> {
  const { results } = await db.prepare(DIRECTORY_QUERY).all<DirectoryRow>()
  return { clubs: (results ?? []).map(directoryItem) }
}

/** The kept answer, or none when there is none or the cache cannot be read. */
async function keptAnswer(cache: DirectoryCache, key: string): Promise<Response | undefined> {
  try {
    return await cache.match(key)
  } catch {
    return undefined
  }
}

/** Keeps the answer; one that cannot be kept changes nothing. */
async function keepAnswer(cache: DirectoryCache, key: string, response: Response): Promise<void> {
  try {
    await cache.put(key, response)
  } catch {
    // The next request reads the database again.
  }
}

/** What answerDirectory reads of a request's context: the request's origin, the database and waitUntil. */
export type DirectoryContext = Pick<EventContext<{ DB: D1Database }, string, unknown>, 'request' | 'env' | 'waitUntil'>

/**
 * GET /api/clubs while CLUB_PAGES_ON is set: the kept answer, or the database's, kept for five minutes at
 * the edge. The copy the edge keeps carries the five minutes; the reader is always sent no-cache.
 */
export async function answerDirectory(context: DirectoryContext, cache: DirectoryCache | null): Promise<Response> {
  const key = directoryCacheKey(new URL(context.request.url).origin)
  const kept = cache ? await keptAnswer(cache, key) : undefined
  if (kept) return forTheReader(kept)
  const response = jsonResponse(await readDirectory(context.env.DB), 200, { 'Cache-Control': DIRECTORY_CACHE_CONTROL })
  if (cache) context.waitUntil(keepAnswer(cache, key, response.clone()))
  return forTheReader(response)
}
