// functions/utils/search.ts
//
// GET /api/search (functions/api/search.ts, WS02 step 9): what the site's
// search reads, how a query is matched, how the answer is grouped and how it
// is kept at the edge. The handler file is the page alone; what it does is
// here, so the unit tests can reach each part.
//
// The answer is brief 1.4's SearchResponse (domain/contracts/search.ts): the
// query as normalised, and up to five groups, in the brief's order, of rows
// a public page already shows:
//
// - Tournaments: the listed LCA events whose last day is today or later in
//   Louisiana, by their first day, each with its registration's state in
//   words; then the partner events, the Gulf South clearinghouse's rows that
//   are not the LCA's own, Louisiana's first and then the rest with their
//   state, each going to its organizer's page, which the answer marks as
//   leaving the site, with no tag and no count;
// - Clubs, by name, with their city and region;
// - News: the posts published in the 24 months before today, newest first;
// - Results: the listed LCA events whose last day was in the three years
//   before today, the latest first, so no event is in two groups;
// - Champions: the honor roll's years and titles alone, never a name.
//
// Today is Louisiana's calendar day, worked out once a request from the
// clock and bound to the reads, never SQLite's own date('now'), which is
// UTC's day. Each of the six reads takes its rows in their window, with the
// columns the rows need and at most SEARCH_READ_LIMIT of them, and the six
// go to the database in one batch. The query is then matched in code against
// each row's words, normalised the same way (domain/format/searchText.ts),
// since SQLite's lower() and LIKE fold plain letters alone and know neither
// a letter's marks, nor "&" for "and", nor "St" for "Saint". A group keeps
// its first five matches and the answer its first twenty, in group order.
//
// The answer reads no Authorization header and no cookie, so it is the same
// for everyone, and the edge keeps it for a minute under a key holding its
// normalised query, an address on the request's own origin. Where the
// runtime has no cache, every request is answered from the database.
import type { SearchGroup, SearchItem, SearchResponse, SearchTag } from '../../domain/contracts/search'
import { formatDate } from '../../domain/format'
import { zonedParts } from '../../domain/format/date'
import { SEARCH_QUERY_MAX, SEARCH_QUERY_MIN, matchesSearch, normalizeSearchText } from '../../domain/format/searchText'
import type { Env } from '../types'
import { listedWhere } from './events/listing'
import { isRegion } from './regions'
import { errorResponse, jsonResponse } from './response'
import { LCA_TIME_ZONE, hasPassed } from './time'

/** The most rows any one read takes, so the search's load is bounded whatever the tables come to hold. */
export const SEARCH_READ_LIMIT = 500

/** The most rows a group holds. */
export const SEARCH_GROUP_MAX = 5

/** The most rows the answer holds in all. */
export const SEARCH_ANSWER_MAX = 20

/** How the answer is kept: by any cache, for 60 seconds. */
export const SEARCH_CACHE_CONTROL = 'public, max-age=60'

/** The words of the answer to a search too short or too long. */
export const SEARCH_REFUSED = `Search for ${SEARCH_QUERY_MIN} to ${SEARCH_QUERY_MAX} letters or numbers.`

/** The groups in the order the answer gives them, each with the words of its heading. */
export const SEARCH_GROUPS: ReadonlyArray<readonly [SearchGroup['type'], string]> = [
  ['tournaments', 'Tournaments'],
  ['clubs', 'Clubs'],
  ['news', 'News'],
  ['results', 'Results'],
  ['champions', 'Champions'],
]

/**
 * The tags a row can carry. An LCA event's registration reads as the
 * registration endpoint decides it, in the words of the site's status badge
 * (src/lib/badgeStatus.ts, which the server cannot import, so
 * test/unit/search.test.ts holds the two to the same words); a result is
 * final. A partner event carries none.
 */
export const SEARCH_TAGS = {
  open: { label: 'Registration open', tone: 'open' },
  soon: { label: 'Opens soon', tone: 'soon' },
  closed: { label: 'Registration closed', tone: 'closed' },
  final: { label: 'Final standings', tone: 'final' },
} as const satisfies Record<string, SearchTag>

/** The middle dot between the parts of a row's second line, as the site writes it. */
const DOT = ' · '

/** A calendar day as the database writes it. */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** The days a search reads by: today in Louisiana, and the first day of each window before it, all inclusive. */
export interface SearchWindows {
  today: string
  /** The earliest last day of a result: the same day three years before today. */
  resultsFrom: string
  /** The earliest day a post shown was published: the same day 24 months before today. */
  newsFrom: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Louisiana's calendar day at an instant, as the database writes days: "2026-11-01". */
export function centralToday(nowMs: number): string {
  const parts = zonedParts(nowMs, { timeZone: LCA_TIME_ZONE })
  if (!parts) throw new Error('centralToday cannot read the instant it was given')
  return `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}`
}

/** The same day of the month a number of months before a day, or that month's last day when it has no such day, as a leap day has none three years later. */
function monthsBefore(day: string, months: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const count = year * 12 + (month - 1) - months
  const y = Math.floor(count / 12)
  const m = count - y * 12 + 1
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(Math.min(date, last))}`
}

/** The windows for a day in Louisiana. */
export function searchWindows(today: string): SearchWindows {
  return { today, resultsFrom: monthsBefore(today, 36), newsFrom: monthsBefore(today, 24) }
}

/** An event's last day: its end date, or its first day when it has none. */
export function lastDayOf(date: string, endDate: string | null): string {
  return endDate || date
}

/**
 * Which group a listed LCA event belongs in by its last day: Tournaments when
 * it is today or later, Results when it is before today and on or after the
 * day three years before, and neither when it is older or not a day as the
 * database writes days, since such text compares wrongly. One day decides
 * both, so no event is in two groups. The event's status is not read.
 */
export function eventGroupOf(lastDay: string, windows: SearchWindows): 'tournaments' | 'results' | null {
  if (!ISO_DAY.test(lastDay) || zonedParts(lastDay) === null) return null
  if (lastDay >= windows.today) return 'tournaments'
  if (lastDay >= windows.resultsFrom) return 'results'
  return null
}

/** An LCA event's registration as the registration endpoint reads it: open until its close time has passed, then closed, and a draft opening soon. */
export function registrationTag(status: string, closesAt: string | null, nowMs: number): SearchTag {
  if (status === 'open') return hasPassed(closesAt, nowMs) ? { ...SEARCH_TAGS.closed } : { ...SEARCH_TAGS.open }
  if (status === 'draft') return { ...SEARCH_TAGS.soon }
  return { ...SEARCH_TAGS.closed }
}

// ── The reads ──────────────────────────────────────────────────────────────

interface UpcomingRow {
  id: string
  name: string
  date: string
  end_date: string | null
  location: string
  registration_status: string
  registration_closes_at: string | null
}
interface ResultRow {
  id: string
  name: string
  date: string
  end_date: string | null
  location: string
}
interface PartnerRow {
  id: string
  name: string
  start_date: string
  end_date: string | null
  city: string | null
  state: string | null
  link: string | null
}
interface ClubRow {
  id: string
  name: string
  city: string
  region: string | null
}
interface PostRow {
  slug: string
  title: string
  published_at: string | null
}
interface ChampionRow {
  year: number
  title: string
  kind: string
}

/** What the six reads returned, each in its group's order. */
export interface SearchRows {
  upcoming: UpcomingRow[]
  results: ResultRow[]
  partners: PartnerRow[]
  clubs: ClubRow[]
  posts: PostRow[]
  champions: ChampionRow[]
}

/** A tournaments row's last day in SQL: its end date, or its first day when it has none or an empty one. */
const LAST_DAY = "COALESCE(NULLIF(t.end_date, ''), t.date)"

/** The listed LCA events whose last day is today or later, by their first day. */
const UPCOMING_SQL = `
  SELECT t.id, t.name, t.date, t.end_date, t.location, t.registration_status, t.registration_closes_at
    FROM tournaments t
   WHERE ${listedWhere('t')} AND ${LAST_DAY} >= ?
   ORDER BY t.date ASC, t.name ASC
   LIMIT ?`

/** The listed LCA events whose last day was before today and on or after the day three years before, the latest first. */
const RESULTS_SQL = `
  SELECT t.id, t.name, t.date, t.end_date, t.location
    FROM tournaments t
   WHERE ${listedWhere('t')} AND ${LAST_DAY} < ? AND ${LAST_DAY} >= ?
   ORDER BY ${LAST_DAY} DESC, t.name ASC
   LIMIT ?`

/** The partner events whose last day is today or later, Louisiana's first, each part by its first day. Today's rule keeps the LCA's own out. */
const PARTNERS_SQL = `
  SELECT id, name, start_date, end_date, city, state, link
    FROM clearinghouse
   WHERE is_lca = 0 AND COALESCE(NULLIF(end_date, ''), start_date) >= ?
   ORDER BY CASE WHEN state = 'LA' THEN 0 ELSE 1 END, start_date ASC, name ASC
   LIMIT ?`

/** The clubs, by name, as the clubs page lists them. */
const CLUBS_SQL = `
  SELECT id, name, city, region
    FROM clubs
   ORDER BY name ASC
   LIMIT ?`

/** The published posts of the window, newest first. */
const POSTS_SQL = `
  SELECT slug, title, published_at
    FROM lca_posts
   WHERE status = 'published' AND published_at >= ?
   ORDER BY published_at DESC, title ASC
   LIMIT ?`

/** The honor roll by year, title and list alone, so co-champions give one row and no column that holds a name is read. */
const CHAMPIONS_SQL = `
  SELECT DISTINCT year, title, kind
    FROM state_champions
   WHERE kind IN ('state', 'scholastic')
   ORDER BY year DESC, CASE WHEN kind = 'state' THEN 0 ELSE 1 END, title ASC
   LIMIT ?`

/** The six reads, in one batch, every value bound. */
export async function readSearchRows(db: D1Database, windows: SearchWindows): Promise<SearchRows> {
  const [upcoming, results, partners, clubs, posts, champions] = await db.batch([
    db.prepare(UPCOMING_SQL).bind(windows.today, SEARCH_READ_LIMIT),
    db.prepare(RESULTS_SQL).bind(windows.today, windows.resultsFrom, SEARCH_READ_LIMIT),
    db.prepare(PARTNERS_SQL).bind(windows.today, SEARCH_READ_LIMIT),
    db.prepare(CLUBS_SQL).bind(SEARCH_READ_LIMIT),
    db.prepare(POSTS_SQL).bind(windows.newsFrom, SEARCH_READ_LIMIT),
    db.prepare(CHAMPIONS_SQL).bind(SEARCH_READ_LIMIT),
  ])
  return {
    upcoming: (upcoming?.results ?? []) as UpcomingRow[],
    results: (results?.results ?? []) as ResultRow[],
    partners: (partners?.results ?? []) as PartnerRow[],
    clubs: (clubs?.results ?? []) as ClubRow[],
    posts: (posts?.results ?? []) as PostRow[],
    champions: (champions?.results ?? []) as ChampionRow[],
  }
}

// ── The answer ─────────────────────────────────────────────────────────────

/** A row's second line from its parts, the empty ones left out, or nothing at all. */
function metaOf(parts: ReadonlyArray<string | null | undefined>): { meta?: string } {
  const kept = parts.filter((part): part is string => typeof part === 'string' && part.trim() !== '')
  return kept.length > 0 ? { meta: kept.join(DOT) } : {}
}

/** A day with its weekday and year, as every date the site shows: "Sun, Nov 1, 2026". */
const day = (value: string) => formatDate(value, { year: true })

/** A partner event's organizer's page: its link as stored when it is a web address, else none. */
function webAddress(link: string | null): string | null {
  const text = link?.trim() ?? ''
  if (text === '') return null
  try {
    const { protocol } = new URL(text)
    return protocol === 'https:' || protocol === 'http:' ? text : null
  } catch {
    return null
  }
}

function upcomingItem(row: UpcomingRow, nowMs: number): SearchItem {
  const last = lastDayOf(row.date, row.end_date)
  const days = last === row.date ? day(row.date) : `${day(row.date)} to ${day(last)}`
  return {
    id: `event:${row.id}`,
    title: row.name,
    ...metaOf([days, row.location]),
    href: `/tournaments/${encodeURIComponent(row.id)}`,
    tag: registrationTag(row.registration_status, row.registration_closes_at, nowMs),
  }
}

function resultItem(row: ResultRow): SearchItem {
  return {
    id: `event:${row.id}`,
    title: row.name,
    ...metaOf([day(lastDayOf(row.date, row.end_date)), row.location]),
    href: `/tournaments/${encodeURIComponent(row.id)}`,
    tag: { ...SEARCH_TAGS.final },
  }
}

/** A Louisiana partner event shows its city; any other its city and state, or the state alone. */
function partnerPlace(row: PartnerRow): string | null {
  if (row.state === 'LA') return row.city
  return [row.city, row.state].filter((part) => !!part && part.trim() !== '').join(', ') || null
}

function partnerItem(row: PartnerRow, href: string): SearchItem {
  return {
    id: `partner:${row.id}`,
    title: row.name,
    ...metaOf([day(row.start_date), partnerPlace(row)]),
    href,
    external: true,
  }
}

function clubItem(row: ClubRow): SearchItem {
  return {
    id: `club:${row.id}`,
    title: row.name,
    ...metaOf([row.city, isRegion(row.region) ? row.region : null]),
    href: `/clubs/${encodeURIComponent(row.id)}`,
  }
}

function postItem(row: PostRow): SearchItem {
  return {
    id: `news:${row.slug}`,
    title: row.title,
    ...metaOf([row.published_at ? day(row.published_at.slice(0, 10)) : null]),
    href: `/news/${encodeURIComponent(row.slug)}`,
  }
}

/** The honor roll's list a row belongs to, as the champions page's two sections name them. */
const listOf = (kind: string) => (kind === 'scholastic' ? 'scholastic' : 'state')

function championItem(row: ChampionRow): SearchItem {
  const list = listOf(row.kind)
  return {
    id: `champions:${list}:${row.year}:${normalizeSearchText(row.title).split(' ').join('-')}`,
    title: `${row.year} ${row.title}`,
    meta: list === 'state' ? 'State champions' : 'Scholastic champions',
    href: `/champions#${list}-champions`,
  }
}

/** Whether a row has words to show as its title. */
const named = (title: string) => title.trim() !== ''

/**
 * The answer to a normalised search from the rows the reads returned: each
 * row matched on its own words alone (an event by its name and place, a
 * result by those and its year, a partner event by its name, city and state,
 * a club by its name, city and region, a post by its title and a champions
 * row by its year and title), the groups in their order, each with its
 * first five matches, and twenty rows in all, a later group taking what the
 * earlier ones leave. A group with no match is left out.
 */
export function searchAnswer(rows: SearchRows, q: string, nowMs: number, windows: SearchWindows = searchWindows(centralToday(nowMs))): SearchResponse {
  const finds = (...words: ReadonlyArray<string | number | null | undefined>) =>
    matchesSearch(normalizeSearchText(words.filter((w) => w !== null && w !== undefined).join(' ')), q)
  const picked: Record<SearchGroup['type'], SearchItem[]> = { tournaments: [], clubs: [], news: [], results: [], champions: [] }
  const take = (type: SearchGroup['type'], item: () => SearchItem) => {
    if (picked[type].length < SEARCH_GROUP_MAX) picked[type].push(item())
  }

  for (const row of rows.upcoming) {
    if (!named(row.name) || eventGroupOf(lastDayOf(row.date, row.end_date), windows) !== 'tournaments') continue
    if (finds(row.name, row.location)) take('tournaments', () => upcomingItem(row, nowMs))
  }
  for (const row of rows.partners) {
    const last = lastDayOf(row.start_date, row.end_date)
    const href = webAddress(row.link)
    if (!named(row.name) || href === null || !ISO_DAY.test(last) || last < windows.today) continue
    if (finds(row.name, row.city, row.state)) take('tournaments', () => partnerItem(row, href))
  }
  for (const row of rows.clubs) {
    if (named(row.name) && finds(row.name, row.city, isRegion(row.region) ? row.region : null)) take('clubs', () => clubItem(row))
  }
  for (const row of rows.posts) {
    const published = row.published_at?.slice(0, 10) ?? ''
    if (!named(row.title) || !ISO_DAY.test(published) || published < windows.newsFrom) continue
    if (finds(row.title)) take('news', () => postItem(row))
  }
  for (const row of rows.results) {
    const last = lastDayOf(row.date, row.end_date)
    if (!named(row.name) || eventGroupOf(last, windows) !== 'results') continue
    if (finds(row.name, row.location, last.slice(0, 4))) take('results', () => resultItem(row))
  }
  const seen = new Set<string>()
  for (const row of rows.champions) {
    if (!named(row.title) || !finds(row.year, row.title)) continue
    const item = championItem(row)
    if (seen.has(item.id)) continue
    seen.add(item.id)
    take('champions', () => item)
  }

  const groups: SearchGroup[] = []
  let room = SEARCH_ANSWER_MAX
  for (const [type, label] of SEARCH_GROUPS) {
    const items = picked[type].slice(0, room)
    if (items.length === 0) continue
    groups.push({ type, label, items })
    room -= items.length
  }
  return { q, groups }
}

// ── The edge's cache ───────────────────────────────────────────────────────

/** The two things the search asks of a cache: the Workers runtime's own, or a test's stand-in. */
export interface SearchCache {
  match(key: string): Promise<Response | undefined>
  put(key: string, response: Response): Promise<void>
}

/**
 * The address an answer is kept under: on the request's own origin, never
 * the visitor's own address, holding search:v1: and the normalised query, so
 * every search that normalises alike shares one entry, and a later change to
 * the answer's form starts afresh under another version.
 */
export function searchCacheKey(origin: string, q: string): string {
  return `${origin}/api/search?key=${encodeURIComponent(`search:v1:${q}`)}`
}

/** The edge's cache where the runtime has one, and none where it has not, as in a test's runtime that gives no caches. */
export function edgeCache(): SearchCache | null {
  if (typeof caches === 'undefined') return null
  return (caches as Partial<CacheStorage>).default ?? null
}

/** The kept answer for a key, or none when there is none or the cache cannot be read. */
async function keptAnswer(cache: SearchCache, key: string): Promise<Response | undefined> {
  try {
    return await cache.match(key)
  } catch {
    return undefined
  }
}

/** Keeps an answer; one that cannot be kept changes nothing. */
async function keepAnswer(cache: SearchCache, key: string, response: Response): Promise<void> {
  try {
    await cache.put(key, response)
  } catch {
    // The next request reads the database again.
  }
}

/** What answerSearch reads of a request's context. */
export type SearchContext = Pick<EventContext<Env, string, unknown>, 'request' | 'env' | 'waitUntil'>

/**
 * GET /api/search: the query read and bounded once normalised (a 400 in
 * plain words, never kept, when it is too short or too long), then the
 * answer from the cache, or from the database and kept for a minute.
 */
export async function answerSearch(context: SearchContext, cache: SearchCache | null): Promise<Response> {
  const url = new URL(context.request.url)
  const q = normalizeSearchText(url.searchParams.get('q') ?? '')
  const size = Array.from(q).length
  if (size < SEARCH_QUERY_MIN || size > SEARCH_QUERY_MAX) return errorResponse(SEARCH_REFUSED, 400)
  const key = searchCacheKey(url.origin, q)
  const kept = cache ? await keptAnswer(cache, key) : undefined
  if (kept) return kept
  const nowMs = Date.now()
  const windows = searchWindows(centralToday(nowMs))
  const rows = await readSearchRows(context.env.DB, windows)
  const response = jsonResponse(searchAnswer(rows, q, nowMs, windows), 200, { 'Cache-Control': SEARCH_CACHE_CONTROL })
  if (cache) context.waitUntil(keepAnswer(cache, key, response.clone()))
  return response
}
