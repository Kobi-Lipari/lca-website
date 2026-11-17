// domain/clubs/distance.ts
//
// Straight-line miles between two points on the map, and the words a club
// page prints for them: "about 12 mi". The brief asks for road miles on the
// Clubs page; K's choice 5 on the WS09 plan leaves road miles out, so every
// distance here is a straight line over the earth's surface, which reads
// shorter than the drive across a lake or a river. The words stay "about N
// mi" for that reason.
//
// Pure code: it imports nothing, so the server, the site and the tests read
// the one rule.

/** A point on the map, in degrees. */
export interface MapPoint {
  latitude: number
  longitude: number
}

/** The earth's mean radius in miles, as the Clubs page's own sort reads it (src/pages/ClubsPage.tsx). */
export const EARTH_RADIUS_MILES = 3958.8

const radians = (degrees: number) => (degrees * Math.PI) / 180

/**
 * Straight-line miles between two points, by the haversine formula. The
 * difference of longitude goes through a sine of its half, so two points on
 * either side of the 180th meridian (179.9 and -179.9) are a short way
 * apart, not most of the way round the earth.
 */
export function milesBetween(a: MapPoint, b: MapPoint): number {
  const dLat = radians(b.latitude - a.latitude)
  const dLng = radians(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_MILES * 2 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** The words for a distance under one mile, where "about 0 mi" would read as the same place. */
export const UNDER_A_MILE = 'less than 1 mi'

/** A distance in the words a club page prints: "about 12 mi", rounded to the nearest mile, or "less than 1 mi". */
export function milesInWords(miles: number): string {
  const rounded = Math.round(miles)
  return rounded < 1 ? UNDER_A_MILE : `about ${rounded} mi`
}

/** A point as a club's row may hold one: two numbers in range, or nothing. */
export function pointOf(latitude: unknown, longitude: unknown): MapPoint | null {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

/** A club the nearest list may name, with its point, or none. */
export interface NearbyCandidate<T> {
  id: string
  name: string
  point: MapPoint | null
  item: T
}

/**
 * The `count` candidates nearest `from`, nearest first, each with its
 * miles. The club itself (`selfId`) and a candidate with no point are left
 * out. Ties in miles go by name and then by id, so the order never depends
 * on how the rows were read.
 */
export function nearestOf<T>(
  from: MapPoint,
  selfId: string,
  candidates: ReadonlyArray<NearbyCandidate<T>>,
  count: number,
): Array<{ item: T; miles: number }> {
  return candidates
    .filter((c): c is NearbyCandidate<T> & { point: MapPoint } => c.id !== selfId && c.point !== null)
    .map((c) => ({ c, miles: milesBetween(from, c.point) }))
    .sort((x, y) => x.miles - y.miles || (x.c.name < y.c.name ? -1 : x.c.name > y.c.name ? 1 : 0) || (x.c.id < y.c.id ? -1 : x.c.id > y.c.id ? 1 : 0))
    .slice(0, Math.max(0, count))
    .map(({ c, miles }) => ({ item: c.item, miles }))
}
