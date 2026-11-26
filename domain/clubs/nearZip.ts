// domain/clubs/nearZip.ts
//
// The place the Clubs page orders its list from (WS09 step 32), worked out
// in the browser and never sent anywhere: the nearest ZIP code area to the
// point the device gives once, on tap of Near me, and the point of a place a
// person types into "City, ZIP or club name". Only a ZIP code goes into the
// page's address (domain/clubs/directoryAddress.ts), never the device's own
// point and never what was typed.
//
// The points are domain/clubs/laPoints.ts's: each ZIP code area of
// Louisiana's, and Picayune's, and each Louisiana town the place file of
// Suggest a club holds. What was typed is read by readTypedPlace
// (domain/clubs/placeNames.ts), as the server reads a place typed into
// Suggest a club, so the browser and the server read a typed place one way.
// A typed place answers one of these:
//   - a ZIP code the points file holds: that area's point;
//   - a ZIP code of Louisiana's own range (700 to 714) that no area holds, a
//     post office box's or a mistyped one: "not found", with no point;
//   - any other ZIP code: outside Louisiana;
//   - a Louisiana town's name, with or without ", LA": the town's point, and
//     the ZIP code area nearest it, for the address; Picayune, Mississippi,
//     the one club over the line, is a town here too;
//   - a name with another state after it (", TX", "Mississippi"), or the
//     name of a state alone: outside Louisiana;
//   - anything else: a name, which the page matches against the clubs'
//     names.
//
// Pure code with no zod: the site's bundle can carry it once a page reads
// it, and nothing here reads a device, a clock or a random source.
import { milesBetween, type MapPoint } from './distance'
import { TOWN_POINTS, ZIP_POINTS } from './laPoints'
import { readTypedPlace } from './placeNames'

/** A ZIP code area, its point and the straight-line miles to it. */
export interface NearestZip {
  zip: string
  point: MapPoint
  miles: number
}

/** What a typed place is: a point the list orders from, a ZIP code not found, a place outside Louisiana, or a name. */
export type TypedPlaceAnswer =
  | { kind: 'zip'; zip: string; point: MapPoint }
  | { kind: 'town'; town: string; zip: string; point: MapPoint }
  | { kind: 'zip_not_found'; zip: string }
  | { kind: 'outside' }
  | { kind: 'name'; text: string }

/** The first three digits of Louisiana's own ZIP codes, from 700 to 714. */
const LOUISIANA_ZIP = /^7(0\d|1[0-4])\d\d$/

/** Mississippi, the one other state a place of the points file lies in. */
const MISSISSIPPI = ['ms', 'mississippi']

/** Picayune's name, as placeKey writes it. */
const PICAYUNE = 'picayune'

/** Every state's two letters but Louisiana's, and DC's, as placeKey writes them. */
const STATE_CODES = [
  'al', 'ak', 'az', 'ar', 'ca', 'co', 'ct', 'de', 'dc', 'fl', 'ga', 'hi', 'id', 'il', 'in', 'ia', 'ks', 'ky', 'me', 'md', 'ma', 'mi', 'mn',
  'ms', 'mo', 'mt', 'ne', 'nv', 'nh', 'nj', 'nm', 'ny', 'nc', 'nd', 'oh', 'ok', 'or', 'pa', 'ri', 'sc', 'sd', 'tn', 'tx', 'ut', 'vt', 'va',
  'wa', 'wv', 'wi', 'wy',
]

/** Every state's name but Louisiana's, as placeKey writes them. */
const STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'district of columbia', 'florida',
  'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'maine', 'maryland', 'massachusetts', 'michigan',
  'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york',
  'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota',
  'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
]

/** A state written after a name: two letters after a comma, or a state's name after a comma or a space. */
const OTHER_STATE = new RegExp(`^(.*?)(?:,\\s*(${STATE_CODES.join('|')})|(?:^|[\\s,]+)(${STATE_NAMES.join('|')}))$`)

let tables: { zips: Map<string, MapPoint>; towns: Map<string, MapPoint> } | null = null

/** Each entry of the points file, "key:north:west", as a point in degrees. */
function entries(lines: readonly string[]): Map<string, MapPoint> {
  const out = new Map<string, MapPoint>()
  for (const line of lines) {
    for (const entry of line.split('|')) {
      const [key, north, west] = entry.split(':')
      out.set(key, { latitude: Number(north) / 1000, longitude: -Number(west) / 1000 })
    }
  }
  return out
}

/** The points file read once and kept, since it never changes while a page runs. */
function pointTables() {
  tables ??= { zips: entries(ZIP_POINTS), towns: entries(TOWN_POINTS) }
  return tables
}

/** The point of a ZIP code area the points file holds, or null. */
export function zipPoint(zip: string): MapPoint | null {
  return pointTables().zips.get(zip) ?? null
}

/**
 * The ZIP code area whose point lies nearest a point, by straight-line miles
 * (domain/clubs/distance.ts), with those miles. Two areas the same distance
 * away go by the lower code, so the answer never depends on how the file
 * was read.
 */
export function nearestZip(point: MapPoint): NearestZip {
  let best: NearestZip | null = null
  for (const [zip, at] of pointTables().zips) {
    const miles = milesBetween(point, at)
    if (best === null || miles < best.miles || (miles === best.miles && zip < best.zip)) best = { zip, point: at, miles }
  }
  if (best === null) throw new Error('The points file holds no ZIP code area')
  return best
}

/** A town of the points file by its name as placeKey writes it, with the ZIP code area nearest it; null when there is none. */
function townAnswer(town: string): TypedPlaceAnswer | null {
  const point = pointTables().towns.get(town)
  return point ? { kind: 'town', town, zip: nearestZip(point).zip, point } : null
}

/** What a person typed into "City, ZIP or club name", read as the list above says; null when nothing was typed. */
export function placeFor(text: string): TypedPlaceAnswer | null {
  const place = readTypedPlace(text)
  if (place === null) return null
  if ('zip' in place) {
    const point = zipPoint(place.zip)
    if (point) return { kind: 'zip', zip: place.zip, point }
    return LOUISIANA_ZIP.test(place.zip) ? { kind: 'zip_not_found', zip: place.zip } : { kind: 'outside' }
  }
  const town = townAnswer(place.town)
  if (town) return town
  const state = OTHER_STATE.exec(place.town)
  if (state) {
    const before = state[1].replace(/[\s,]+$/, '')
    const named = state[2] ?? state[3]
    if (before === PICAYUNE && MISSISSIPPI.includes(named)) return townAnswer(PICAYUNE)
    return { kind: 'outside' }
  }
  return { kind: 'name', text: text.trim() }
}
