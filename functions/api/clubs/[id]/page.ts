// functions/api/clubs/[id]/page.ts
//
// GET /api/clubs/:id/page: the read behind the new club page (WS09 step 20).
// Today's club page keeps its own answer, GET /api/clubs/[id], which this
// file does not touch.
//
// Who may read, by the two constants of functions/utils/clubs/pages.ts, each
// read here at every call:
//   - both unset:              404 to everyone, before the sign-in is checked
//                              or anything is read: not one query is made
//   - CLUB_KEEPERS_ON alone:   the page to the people requireClubRep admits
//                              for the club (an LCA admin, the club's rep and
//                              the representative whose seat covers its
//                              region), and to everyone else the same 404 as
//                              for a club that does not exist: requireClubRep's
//                              401 and 403 are never passed on, so nothing
//                              tells a stranger that an unreleased page exists
//   - CLUB_PAGES_ON:           the page to everyone, signed in or not
// Every 404 is the one body, {"error":"Club not found"}, the words today's
// club answer gives for a club that does not exist.
//
// The address part is looked up in a fixed order: a current slug, then an
// old slug from club_slug_history, then a club's id. A slug and an old slug
// are matched as the slug rule writes them (domain/clubs/slug.ts), trimmed
// and in lower case; an id is matched as it came, then the same way. The
// answer names the club's current slug, or its id while it has none, so the
// page can put the right address in the bar.
//
// The answer is built from named columns, never a spread of a row, and
// carries no email address, officer, roster, member's id, count of members,
// keeper's id, told_by, confirmed_by, month of the last check or column of
// the approval wait. The author line and the told line come as words
// (functions/utils/clubs/authorLine.ts). The events are the club's listed
// events, through listedWhere, with the keys a visitor's event answers
// already carry; the news rows are today's club answer's, by its rule.
//
// Headers: while the page is not public (both constants unset, or
// CLUB_KEEPERS_ON alone) every answer, the 404s included, carries
// Cache-Control: no-store, so no cache keeps a keeper's page or a 404 for
// another viewer. With CLUB_PAGES_ON set the answer is the same for every
// reader and carries the headers today's public club answer carries, with
// no instruction to a cache.
import type { Env } from '../../../types'
import { handleOptions, jsonResponse } from '../../../utils/response'
import { isResponse, requireClubRep } from '../../../utils/auth'
import { CLUB_KEEPERS_ON, CLUB_PAGES_ON } from '../../../utils/clubs/pages'
import { clubAuthorLine, clubToldLine } from '../../../utils/clubs/authorLine'
import { nearestClubs } from '../../../utils/clubs/nearest'
import { listedWhere } from '../../../utils/events/listing'
import { clubPageSections, filled } from '../../../../domain/clubs/sections'
import type { ClubPageEvent, ClubPageResponse } from '../../../../domain/contracts/clubPage'

/** The words of every 404: the same as today's club answer gives for a club that does not exist. */
export const CLUB_PAGE_NOT_FOUND = 'Club not found'

/** What every answer carries while the page is not public. */
const NOT_PUBLIC_HEADERS = { 'Cache-Control': 'no-store' } as const

/** Navy, the colour a club with none of its own is drawn in (LCA.navy in src/lib/brand.ts). */
export const PAGE_NAVY = '#1a2744'

/** The database's default colour (migration 0009), brand gold: a club that still has it has not picked one. */
const DEFAULT_GOLD = '#c8a94a'

/** The longest address part looked up; anything longer names no club. */
const ADDRESS_MAX = 200

/** The club's columns this answer reads, by name. told_by is read for the told line and never answered. */
const PAGE_COLUMNS = `id, name, city, region, color, image_url, slug, about_text, how_we_meet_text, cost_text, welcome_text,
  weekend_play, scholastic_friendly, contact_name_public, facebook_url, website_url, other_url, told_updated_at, told_by`

interface PageClub {
  id: string
  name: string
  city: string
  region: string | null
  color: string | null
  image_url: string | null
  slug: string | null
  about_text: string | null
  how_we_meet_text: string | null
  cost_text: string | null
  welcome_text: string | null
  weekend_play: number
  scholastic_friendly: number
  contact_name_public: string | null
  facebook_url: string | null
  website_url: string | null
  other_url: string | null
  told_updated_at: string | null
  told_by: string | null
}

function notFound(headers: Record<string, string>): Response {
  return jsonResponse({ error: CLUB_PAGE_NOT_FOUND }, 404, headers)
}

/** The address part as the slug rule writes a slug: trimmed and in lower case. */
export function asSlug(value: string): string {
  return value.trim().toLowerCase()
}

/** The address part as it came, decoded when it was sent encoded. */
function decoded(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** The club an address part names, by the fixed order: a current slug, an old slug, an id. */
async function clubNamedBy(db: D1Database, raw: string): Promise<PageClub | null> {
  const given = decoded(raw).trim()
  const slug = asSlug(given)
  if (slug === '' || given.length > ADDRESS_MAX) return null
  const bySlug = await db.prepare(`SELECT ${PAGE_COLUMNS} FROM clubs WHERE slug = ?`).bind(slug).first<PageClub>()
  if (bySlug) return bySlug
  const byOldSlug = await db
    .prepare(`SELECT ${PAGE_COLUMNS} FROM clubs WHERE id = (SELECT club_id FROM club_slug_history WHERE old_slug = ?)`)
    .bind(slug)
    .first<PageClub>()
  if (byOldSlug) return byOldSlug
  const byId = await db.prepare(`SELECT ${PAGE_COLUMNS} FROM clubs WHERE id = ?`).bind(given).first<PageClub>()
  if (byId || given === slug) return byId ?? null
  return (await db.prepare(`SELECT ${PAGE_COLUMNS} FROM clubs WHERE id = ?`).bind(slug).first<PageClub>()) ?? null
}

/** Stored text, or null when it has nothing in it. */
const text = (value: string | null): string | null => (filled(value) ? value : null)

/** The colour the page is drawn in: the club's own, or navy when it has none or still has the default gold. */
function pageColour(color: string | null): string {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return PAGE_NAVY
  const lower = color.toLowerCase()
  return lower === DEFAULT_GOLD ? PAGE_NAVY : lower
}

/** The club's logo as the page may draw it: the path the logo upload stores on this site, or null. */
function pageLogo(imageUrl: string | null): string | null {
  return imageUrl && imageUrl.startsWith('/api/clubs/') ? imageUrl : null
}

/** The page's answer for a club found and admitted. */
async function clubPage(db: D1Database, club: PageClub): Promise<ClubPageResponse> {
  const { results: places } = await db
    .prepare('SELECT name, street, note, latitude, longitude FROM club_places WHERE club_id = ? ORDER BY sort, id LIMIT 2')
    .bind(club.id)
    .all<{ name: string; street: string | null; note: string | null; latitude: number | null; longitude: number | null }>()

  const { results: events } = await db
    .prepare(
      `SELECT t.id, t.name, t.date, t.end_date, t.status, t.registration_status, t.max_players,
              (SELECT COUNT(*) FROM registrations r
                WHERE r.tournament_id = t.id AND r.withdrawn_at IS NULL AND r.waitlisted_at IS NULL) AS registered_count
         FROM tournaments t
        WHERE t.club_id = ? AND ${listedWhere('t')}
        ORDER BY t.date DESC, t.id`,
    )
    .bind(club.id)
    .all<ClubPageEvent>()

  // Today's club answer's rule for its news, as GET /api/clubs/[id] reads it.
  const { results: news } = await db
    .prepare('SELECT id, title, excerpt, news_date FROM club_news WHERE club_id = ? ORDER BY news_date DESC LIMIT 10')
    .bind(club.id)
    .all<{ id: string; title: string; excerpt: string; news_date: string }>()

  const author = await clubAuthorLine(db, club)
  const told = await clubToldLine(db, club)
  const nearest = await nearestClubs(db, club.id)

  const about = {
    text: text(club.about_text),
    cost: text(club.cost_text),
    welcome: text(club.welcome_text),
    facebook: text(club.facebook_url),
    website: text(club.website_url),
    other: text(club.other_url),
    weekend_play: club.weekend_play === 1,
    scholastic_friendly: club.scholastic_friendly === 1,
  }
  const statement = text(club.how_we_meet_text)
  const placeRows = (places ?? []).map((p) => ({ name: p.name, street: text(p.street), note: text(p.note), latitude: p.latitude, longitude: p.longitude }))
  const eventRows = (events ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    date: e.date,
    end_date: e.end_date,
    status: e.status,
    registration_status: e.registration_status,
    max_players: e.max_players,
    registered_count: e.registered_count,
  }))
  const newsRows = (news ?? []).map((n) => ({ id: n.id, title: n.title, excerpt: n.excerpt, news_date: n.news_date }))

  return {
    club: {
      id: club.id,
      slug: club.slug ?? club.id,
      name: club.name,
      city: club.city,
      region: text(club.region),
      color: pageColour(club.color),
      logo: pageLogo(club.image_url),
    },
    sections: clubPageSections({
      aboutText: about.text,
      costText: about.cost,
      welcomeText: about.welcome,
      links: [about.facebook, about.website, about.other],
      weekendPlay: about.weekend_play,
      scholasticFriendly: about.scholastic_friendly,
      statement,
      places: placeRows.length,
      events: eventRows.length,
      news: newsRows.length,
      photos: 0,
    }),
    author,
    about,
    statement: { text: statement, told },
    places: placeRows,
    contact: { name: text(club.contact_name_public) },
    events: eventRows,
    news: newsRows,
    nearest,
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => handleOptions()

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const pagesOn = CLUB_PAGES_ON
  const keepersOn = CLUB_KEEPERS_ON
  const headers: Record<string, string> = pagesOn ? {} : { ...NOT_PUBLIC_HEADERS }
  // Both unset: nothing is read, not even the sign-in.
  if (!pagesOn && !keepersOn) return notFound(headers)

  const raw = typeof context.params.id === 'string' ? context.params.id : ''
  const db = context.env.DB
  const club = await clubNamedBy(db, raw)
  if (!club) return notFound(headers)

  if (!pagesOn) {
    // The keepers' preview: requireClubRep's own rule, its refusals all answered as the one 404.
    const authed = await requireClubRep(context.request, context.env, club.id)
    if (isResponse(authed)) return notFound(headers)
  }

  return jsonResponse(await clubPage(db, club), 200, headers)
}
