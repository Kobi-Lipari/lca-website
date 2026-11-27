// functions/utils/clubs/places.ts
//
// The region of the place a person types into Suggest a club or Start a club
// (WS09 step 30), from the place file (domain/clubs/laPlaces.ts): a ZIP code
// of Louisiana's, or Picayune's, gives its area's region, and a Louisiana
// town's name gives its town's. A ZIP code the file does not hold (a post
// office box's, one of another state, a mistyped one), a town it does not
// know, a name two places in different regions share and anything else
// answer null, "not found", which is an answer and not an error: such a row
// goes to the LCA admins.
//
// The server alone reads the place file, so the site's scripts never carry
// it and no page says where a suggestion goes. The tables are built from it
// the first time they are asked for, and kept, since the file never changes
// while the site runs.
import { TOWNS_BY_REGION, ZIPS_BY_REGION } from '../../../domain/clubs/laPlaces'
import { readTypedPlace } from '../../../domain/clubs/placeNames'
import { REGIONS, type Region } from '../../../domain/clubs/regions'

let tables: { zips: Map<string, Region>; towns: Map<string, Region> } | null = null

function placeTables() {
  if (tables) return tables
  const zips = new Map<string, Region>()
  const towns = new Map<string, Region>()
  REGIONS.forEach((region, i) => {
    for (const line of ZIPS_BY_REGION[i] ?? []) for (const zip of line.split(' ')) zips.set(zip, region)
    for (const line of TOWNS_BY_REGION[i] ?? []) for (const town of line.split('|')) towns.set(town, region)
  })
  tables = { zips, towns }
  return tables
}

/** The region of a typed city or ZIP code, or null when the place is not found. */
export function regionOfPlace(typed: string): Region | null {
  const place = readTypedPlace(typed)
  if (!place) return null
  const { zips, towns } = placeTables()
  return 'zip' in place ? zips.get(place.zip) ?? null : towns.get(place.town) ?? null
}
