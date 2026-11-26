// functions/utils/clubs/nearest.ts
//
// The three clubs nearest a club, for the foot of its page ("Chess clubs
// near {town}" in the brief): straight-line miles between the two clubs'
// first places (domain/clubs/distance.ts), in the words "about N mi".
//
// A club's point is its first place's, in the editor's order (sort, then
// id), the place the directory's pin is mirrored from; a club with no place
// at all is read at today's pin, clubs.latitude and clubs.longitude, so a
// club no keeper has saved yet is not left out. A club with no point is left
// out, and so is the club itself. Every club the public list,
// GET /api/clubs, shows may be named, and that list shows every club.
//
// Each club named carries its name, its town, the address part of its page
// and its meeting statement, and nothing more.

import { milesInWords, nearestOf, pointOf, type MapPoint } from '../../../domain/clubs/distance'

/** How many clubs the foot of a page names. */
export const NEAREST_COUNT = 3

/** A club near this one, as the page's answer carries it. */
export interface NearbyClub {
  name: string
  city: string
  /** The address part of the club's page: its slug, or its id while it has none. */
  slug: string
  /** How the club meets, in its own words; null when it has none. */
  statement: string | null
  /** "about 12 mi", or "less than 1 mi". */
  distance: string
}

interface PointRow extends FirstPlaceColumns {
  id: string
  name: string
  city: string
  slug: string | null
  how_we_meet_text: string | null
}

/**
 * The join that reads each club's first place beside it, as p, in the
 * editor's order; the club is c. The directory's list (functions/utils/clubs/directory.ts,
 * WS09 step 32) reads its points through it too, so a club's card and its
 * page put the club at one point.
 */
export const FIRST_PLACE_JOIN = `LEFT JOIN club_places p
           ON p.id = (SELECT q.id FROM club_places q WHERE q.club_id = c.id ORDER BY q.sort, q.id LIMIT 1)`

/** The columns of a row read through FIRST_PLACE_JOIN that firstPlacePoint reads. */
export interface FirstPlaceColumns {
  place_id: number | null
  place_latitude: number | null
  place_longitude: number | null
  latitude: number | null
  longitude: number | null
}

/** A club's point by the rule above: its first place's, or today's pin while it has no place at all; null when that has none. */
export function firstPlacePoint(row: FirstPlaceColumns): MapPoint | null {
  return row.place_id === null ? pointOf(row.latitude, row.longitude) : pointOf(row.place_latitude, row.place_longitude)
}

/** Each club's point by the rule above, read once for every club. */
async function clubPoints(db: D1Database): Promise<Array<{ row: PointRow; point: MapPoint | null }>> {
  const { results } = await db
    .prepare(
      `SELECT c.id, c.name, c.city, c.slug, c.how_we_meet_text,
              p.id AS place_id, p.latitude AS place_latitude, p.longitude AS place_longitude,
              c.latitude, c.longitude
         FROM clubs c
         ${FIRST_PLACE_JOIN}`,
    )
    .all<PointRow>()
  return (results ?? []).map((row) => ({ row, point: firstPlacePoint(row) }))
}

/** The clubs nearest the club, nearest first; none when the club itself has no point. */
export async function nearestClubs(db: D1Database, clubId: string): Promise<NearbyClub[]> {
  const points = await clubPoints(db)
  const self = points.find(({ row }) => row.id === clubId)
  if (!self?.point) return []
  const candidates = points.map(({ row, point }) => ({ id: row.id, name: row.name, point, item: row }))
  return nearestOf(self.point, clubId, candidates, NEAREST_COUNT).map(({ item, miles }) => ({
    name: item.name,
    city: item.city,
    slug: item.slug ?? item.id,
    statement: item.how_we_meet_text?.trim() ? item.how_we_meet_text : null,
    distance: milesInWords(miles),
  }))
}
