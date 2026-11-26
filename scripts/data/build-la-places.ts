// scripts/data/build-la-places.ts
//
// Makes domain/clubs/laPlaces.ts, the place file of Suggest a club and Start
// a club (WS09 step 30): each of Louisiana's ZIP code areas, and Picayune's,
// with its region, and each Louisiana town's name with its region. It is run
// once, by hand, and its output is committed; the Census Bureau's files it
// reads are never committed.
//
// It reads three public files of the Census Bureau from the folder it is
// given, and makes no request of its own:
//   - 2024_Gaz_zcta_national.txt, the 2024 gazetteer of ZIP code areas (each
//     with a point inside it), unzipped from 2024_Gaz_zcta_national.zip;
//   - 2024_gaz_place_22.txt, the 2024 gazetteer of Louisiana's places (each
//     town and census place with a point inside it);
//   - tab20_zcta520_county20_natl.txt, the 2020 relationship file that says
//     how much of each ZIP code area's land lies in each county (parish).
// The zip file is hashed too when it lies in the folder, so the file's header
// names what was downloaded.
//
// What it works out:
//   - a ZIP code area is Louisiana's when the parish with the largest share
//     of its area (its land and water together) is one of Louisiana's, and
//     its region is that parish's
//     (domain/clubs/parishRegions.ts); Picayune's (39466) is added with its
//     county's region;
//   - a town's region is the region of the ZIP code area whose point lies
//     nearest the town's own point. The gazetteer of places names no parish,
//     and every town lies in or beside one of the state's ZIP code areas, so
//     the nearest area's region is the town's but for a town on a region's
//     very edge, which a representative can pass on;
//   - a town's name is stored as domain/clubs/placeNames.ts reads it (no
//     case, no full stops, St. for Saint), without the Census Bureau's last
//     word (city, town, village or CDP). Two places of one name in different
//     regions leave that name out, so it is not found.
// The place file holds no point. The same run writes a second file when it
// is given a second name, domain/clubs/laPoints.ts (WS09 step 32), for the
// nearest ZIP code the Clubs page finds in the browser
// (domain/clubs/nearZip.ts): each ZIP code area's point from the gazetteer
// of ZIP code areas, kept to three decimal places (about a hundred metres),
// with the town of the area, and for each town the place file holds the ZIP
// code area it stands for. These two come from a fourth public file, read
// for the points file alone:
//   - tab20_zcta520_place20_natl.txt, the 2020 relationship file that says
//     how much of each ZIP code area's land lies in each place (town).
// The places counted are the towns the points file names, each by the place
// whose point it kept before (the first of its name in the gazetteer of
// places). By that file:
//   - the town of a ZIP code area is the town that holds the largest share of
//     the area's land; an area that shares no land with such a town has none;
//   - the area a town stands for is, among the areas whose town it is, the one
//     with the least land of those at least half inside the town (the densest
//     part, where a city's centre is); where none is half inside, the one of
//     them whose point lies nearest the town's own point; where the town is no
//     area's town, the area that shares the most land with it; and for a town
//     the file does not hold, the area whose point lies nearest the town's;
//   - Picayune, whose place the gazetteer of Louisiana's places cannot hold,
//     stands for its own ZIP code area and is that area's town.
// Ties go by the lower ZIP code, and between towns by name.
//
// Usage, from the repository's root:
//   node --no-warnings --experimental-strip-types --import ./scanner/sandbox/register.mjs \
//     scripts/data/build-la-places.ts <folder of the downloads> <file to write> [<points file to write>]
// It writes the same bytes each time it is run on the same files.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PARISH_REGIONS, PICAYUNE_COUNTY, PICAYUNE_ZIP } from '../../domain/clubs/parishRegions.ts'
import { placeKey } from '../../domain/clubs/placeNames.ts'
import { REGIONS } from '../../domain/clubs/regions.ts'

const ZCTA_POINTS = '2024_Gaz_zcta_national.txt'
const ZCTA_ZIP = '2024_Gaz_zcta_national.zip'
const PLACES = '2024_gaz_place_22.txt'
const ZCTA_COUNTIES = 'tab20_zcta520_county20_natl.txt'
const ZCTA_PLACES = 'tab20_zcta520_place20_natl.txt'

/** Picayune's own name, which the gazetteer of Louisiana's places cannot hold. */
const PICAYUNE_TOWN = 'Picayune'

/** The last word the Census Bureau gives a place's name, which a person does not type. */
const PLACE_KIND = / (city|town|village|CDP)$/

interface Point {
  lat: number
  lon: number
}

function rows(path: string, separator: string): string[][] {
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '')
  return text.split(/\r?\n/).slice(1).filter((line) => line.trim() !== '').map((line) => line.split(separator).map((cell) => cell.trim()))
}

function described(path: string): string {
  const bytes = readFileSync(path)
  return `${basename(path)}: ${statSync(path).size.toLocaleString('en-US')} bytes, sha256 ${createHash('sha256').update(bytes).digest('hex')}`
}

/** Straight-line distance in miles. */
function miles(a: Point, b: Point): number {
  const r = 3958.8
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

function byText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Lines of at most `width` characters, the words joined by `joiner`. */
function wrap(words: string[], joiner: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line === '' ? word : `${line}${joiner}${word}`
    if (next.length > width && line !== '') {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line !== '') lines.push(line)
  return lines
}

/** What the three files give, worked out once for both of the files the script writes. */
interface Worked {
  /** Each kept ZIP code area's region, by its index in REGIONS. */
  zipRegion: Map<string, number>
  /** The points of the kept areas, by ZIP code. */
  zipPoints: Array<{ zip: string; point: Point }>
  /** Each town's name, as placeKey writes it, with the regions of the places of that name. */
  townRegions: Map<string, Set<number>>
  /** Each town's point: the first place of its name in the gazetteer, and Picayune's area's for Picayune. */
  townPoints: Map<string, Point>
  /** The place whose point each town keeps, by the Census Bureau's code of it; Picayune has none. */
  townPlaces: Map<string, string>
  /** The header's lines naming the files read, with their sizes and sha256. */
  sources: string[]
}

function work(folder: string): Worked {
  const regionOf = new Map<string, number>()
  for (const parish of [...PARISH_REGIONS, PICAYUNE_COUNTY]) regionOf.set(parish.fips, REGIONS.indexOf(parish.region))

  // The county with the largest share of each ZIP code area, its land and water together; then of its land alone, then
  // the lower county code.
  const largest = new Map<string, { county: string; land: number; water: number }>()
  for (const cells of rows(join(folder, ZCTA_COUNTIES), '|')) {
    const zip = cells[1]
    const county = cells[9]
    if (!/^\d{5}$/.test(zip ?? '') || !/^\d{5}$/.test(county ?? '')) continue
    const land = Number(cells[16]) || 0
    const water = Number(cells[17]) || 0
    const now = largest.get(zip)
    const area = land + water
    const nowArea = now ? now.land + now.water : -1
    if (!now || area > nowArea || (area === nowArea && (land > now.land || (land === now.land && county < now.county)))) {
      largest.set(zip, { county, land, water })
    }
  }
  const zipRegion = new Map<string, number>()
  for (const [zip, part] of largest) {
    const inLouisiana = part.county.startsWith('22')
    if (!inLouisiana && !(zip === PICAYUNE_ZIP && part.county === PICAYUNE_COUNTY.fips)) continue
    const region = regionOf.get(part.county)
    if (region === undefined) throw new Error(`No region for county ${part.county}`)
    zipRegion.set(zip, region)
  }
  if (!zipRegion.has(PICAYUNE_ZIP)) throw new Error('Picayune\'s ZIP code area was not found')

  // The points of the areas just kept, for the towns.
  const zipPoints: Array<{ zip: string; point: Point }> = []
  for (const cells of rows(join(folder, ZCTA_POINTS), '\t')) {
    if (zipRegion.has(cells[0])) zipPoints.push({ zip: cells[0], point: { lat: Number(cells[5]), lon: Number(cells[6]) } })
  }
  zipPoints.sort((a, b) => byText(a.zip, b.zip))

  const townRegions = new Map<string, Set<number>>()
  const townPoints = new Map<string, Point>()
  const townPlaces = new Map<string, string>()
  const addTown = (name: string, region: number, point: Point, place?: string) => {
    const key = placeKey(name)
    const set = townRegions.get(key) ?? new Set<number>()
    set.add(region)
    townRegions.set(key, set)
    if (!townPoints.has(key)) {
      townPoints.set(key, point)
      if (place) townPlaces.set(key, place)
    }
  }
  for (const cells of rows(join(folder, PLACES), '\t')) {
    const name = cells[3].replace(PLACE_KIND, '')
    const point = { lat: Number(cells[10]), lon: Number(cells[11]) }
    let best = zipPoints[0]
    let bestMiles = Infinity
    for (const area of zipPoints) {
      const d = miles(point, area.point)
      if (d < bestMiles) {
        best = area
        bestMiles = d
      }
    }
    addTown(name, zipRegion.get(best.zip)!, point, cells[1])
  }
  const picayune = zipPoints.find((area) => area.zip === PICAYUNE_ZIP)
  if (!picayune) throw new Error('Picayune\'s ZIP code area has no point')
  addTown(PICAYUNE_TOWN, zipRegion.get(PICAYUNE_ZIP)!, picayune.point)

  const sources = [ZCTA_ZIP, ZCTA_POINTS, PLACES, ZCTA_COUNTIES].filter((name) => existsSync(join(folder, name))).map((name) => `//   ${described(join(folder, name))}`)
  return { zipRegion, zipPoints, townRegions, townPoints, townPlaces, sources }
}

const quoted = (lines: string[]) => lines.map((line) => `    '${line.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}',`).join('\n')

/** The place file, domain/clubs/laPlaces.ts. */
export function build(folder: string): string {
  const { zipRegion, townRegions, sources } = work(folder)
  const shared = [...townRegions].filter(([, set]) => set.size > 1).map(([key]) => key).sort(byText)
  const zipsBy = REGIONS.map(() => [] as string[])
  for (const [zip, region] of zipRegion) zipsBy[region].push(zip)
  const townsBy = REGIONS.map(() => [] as string[])
  for (const [key, set] of townRegions) if (set.size === 1) townsBy[[...set][0]].push(key)
  for (const list of [...zipsBy, ...townsBy]) list.sort(byText)

  const zipCount = zipRegion.size
  const townCount = townsBy.reduce((sum, list) => sum + list.length, 0)
  return [
    '// domain/clubs/laPlaces.ts',
    '//',
    '// Made by scripts/data/build-la-places.ts and committed; not to be edited by',
    '// hand. The place file of Suggest a club and Start a club (WS09 step 30):',
    `// ${zipCount} ZIP code areas (Louisiana's and Picayune's) and ${townCount} town names, each`,
    '// under its region, by the index of the region in REGIONS',
    '// (domain/clubs/regions.ts). Read by the server alone',
    '// (functions/utils/clubs/places.ts); no file under src/ imports it.',
    '//',
    '// Made from these public files of the Census Bureau, from www2.census.gov:',
    ...sources,
    '// The ZIP code areas are of 2020, as both of the Census Bureau\'s 2024 files',
    '// draw them. A ZIP code no area holds (a post office box\'s, one of another',
    '// state, a mistyped one) and a town not listed here are not found.',
    shared.length > 0
      ? `// Left out, since two places of each name lie in different regions: ${shared.join(', ')}.`
      : '// No town\'s name is left out for lying in two regions.',
    '',
    '/** Each region\'s ZIP code areas, in the order of REGIONS: five-digit codes joined by spaces. */',
    'export const ZIPS_BY_REGION: ReadonlyArray<readonly string[]> = [',
    ...zipsBy.map((list, i) => `  // REGIONS[${i}]: ${list.length}\n  [\n${quoted(wrap(list, ' ', 96))}\n  ],`),
    ']',
    '',
    '/** Each region\'s town names, in the order of REGIONS, as placeKey writes them, joined by a bar. */',
    'export const TOWNS_BY_REGION: ReadonlyArray<readonly string[]> = [',
    ...townsBy.map((list, i) => `  // REGIONS[${i}]: ${list.length}\n  [\n${quoted(wrap(list, '|', 96))}\n  ],`),
    ']',
    '',
  ].join('\n')
}

/** A coordinate in thousandths of a degree, rounded: about a hundred metres. */
function thousandths(degrees: number): number {
  return Math.round(degrees * 1000)
}

/** A point as the points file writes it: the latitude north and the longitude west, each in thousandths of a degree. */
function pointText(point: Point): string {
  const north = thousandths(point.lat)
  const west = -thousandths(point.lon)
  if (!(north > 0 && west > 0)) throw new Error(`A point outside the north and west of the map: ${point.lat}, ${point.lon}`)
  return `${north}:${west}`
}

/** One row of the place relationship file: how much of a ZIP code area's land lies in a town, and the area's own land. */
interface Share {
  zip: string
  town: string
  part: number
  zipLand: number
}

/** The lower ZIP code first. */
const byZip = (a: Share, b: Share) => byText(a.zip, b.zip)

/**
 * The town of each ZIP code area and the area each town stands for, by the place relationship file, as the header of
 * this script says; `towns` are the towns the points file names, and `zipPoints` its areas.
 */
function townsAndZips(folder: string, zipPoints: Worked['zipPoints'], towns: string[], townPoints: Map<string, Point>, townPlaces: Map<string, string>) {
  const kept = new Set(zipPoints.map(({ zip }) => zip))
  const townOfPlace = new Map<string, string>()
  for (const town of towns) {
    const place = townPlaces.get(town)
    if (place) townOfPlace.set(place, town)
  }
  const shares: Share[] = []
  for (const cells of rows(join(folder, ZCTA_PLACES), '|')) {
    const zip = cells[1]
    const town = townOfPlace.get(cells[9] ?? '')
    const part = Number(cells[16]) || 0
    if (!/^\d{5}$/.test(zip ?? '') || !kept.has(zip) || town === undefined || part <= 0) continue
    shares.push({ zip, town, part, zipLand: Number(cells[3]) || 0 })
  }

  const zipTown = new Map<string, string>()
  const best = new Map<string, Share>()
  for (const share of shares) {
    const now = best.get(share.zip)
    if (!now || share.part > now.part || (share.part === now.part && byText(share.town, now.town) < 0)) best.set(share.zip, share)
  }
  for (const [zip, share] of best) zipTown.set(zip, share.town)
  zipTown.set(PICAYUNE_ZIP, placeKey(PICAYUNE_TOWN))

  const sharesOf = new Map<string, Share[]>()
  for (const share of shares) sharesOf.set(share.town, [...(sharesOf.get(share.town) ?? []), share])
  const mostShared = (list: Share[]) => [...list].sort((a, b) => b.part - a.part || byZip(a, b))[0]
  const pointOf = new Map(zipPoints.map(({ zip, point }) => [zip, point]))
  // The one whose point lies nearest the town's own point; two the same distance apart, the lower ZIP code.
  const nearestOwn = (list: Share[], point: Point) =>
    [...list].sort((a, b) => miles(point, pointOf.get(a.zip)!) - miles(point, pointOf.get(b.zip)!) || byZip(a, b))[0]
  const townZip = new Map<string, string>()
  let nearest = 0
  for (const town of towns) {
    if (town === placeKey(PICAYUNE_TOWN)) {
      townZip.set(town, PICAYUNE_ZIP)
      continue
    }
    const list = sharesOf.get(town) ?? []
    if (list.length === 0) {
      // A town the relationship file does not hold: the area whose point lies nearest the town's.
      const point = townPoints.get(town)!
      let pick = zipPoints[0]
      let pickMiles = Infinity
      for (const area of zipPoints) {
        const d = miles(point, area.point)
        if (d < pickMiles) {
          pick = area
          pickMiles = d
        }
      }
      townZip.set(town, pick.zip)
      nearest += 1
      continue
    }
    const own = list.filter((share) => zipTown.get(share.zip) === town)
    if (own.length === 0) {
      townZip.set(town, mostShared(list).zip)
      continue
    }
    const half = own.filter((share) => share.zipLand > 0 && share.part * 2 >= share.zipLand).sort((a, b) => a.zipLand - b.zipLand || byZip(a, b))
    townZip.set(town, half.length > 0 ? half[0].zip : nearestOwn(own, townPoints.get(town)!).zip)
  }
  return { zipTown, townZip, nearest }
}

/**
 * The points file, domain/clubs/laPoints.ts: the point of every ZIP code area the place file holds, with its town, and
 * for every town the place file holds the ZIP code area it stands for.
 */
export function buildPoints(folder: string): string {
  const { zipPoints, townRegions, townPoints, townPlaces, sources } = work(folder)
  if (!existsSync(join(folder, ZCTA_PLACES))) throw new Error(`${ZCTA_PLACES} is not in ${folder}`)
  const towns = [...townRegions].filter(([, set]) => set.size === 1).map(([key]) => key).sort(byText)
  const { zipTown, townZip, nearest } = townsAndZips(folder, zipPoints, towns, townPoints, townPlaces)
  const townIndex = new Map(towns.map((town, i) => [town, i]))
  const zips = zipPoints.map(({ zip, point }) => {
    const town = zipTown.get(zip)
    return town === undefined ? `${zip}:${pointText(point)}` : `${zip}:${pointText(point)}:${townIndex.get(town)}`
  })
  const townEntries = towns.map((town) => `${town}:${townZip.get(town)}`)
  const withTown = zipPoints.filter(({ zip }) => zipTown.has(zip)).length
  const someAreas = new Set(zipTown.values()).size
  return [
    '// domain/clubs/laPoints.ts',
    '//',
    '// Made by scripts/data/build-la-places.ts and committed; not to be edited by',
    '// hand. The points of the places domain/clubs/laPlaces.ts holds, for the',
    '// nearest ZIP code the Clubs page finds in the browser (domain/clubs/nearZip.ts,',
    `// WS09 step 32): ${zips.length} ZIP code areas' points, ${withTown} of them with a town and`,
    `// ${zips.length - withTown} with none, and the ZIP code area each of ${townEntries.length} towns stands for. Of the`,
    `// towns, ${someAreas} are some area's town, and ${nearest} the relationship file does not hold`,
    '// stands for the area whose point lies nearest its own. No region. A place',
    '// typed or read from the device is looked up here, in the browser.',
    '//',
    '// Each ZIP code area\'s entry is its code, then the latitude north and the',
    '// longitude west of the Census Bureau\'s point inside it, each in thousandths',
    '// of a degree (about a hundred metres), then, where it has a town, the',
    '// town\'s place in TOWN_ZIPS counted from 0, joined by colons. Each town\'s',
    '// entry is its name (as placeKey writes it) and the ZIP code area it stands',
    '// for, joined by a colon. The entries are joined by a bar. The town of an',
    '// area holds the largest share of its land; the area a town stands for is',
    '// the smallest of its own areas at least half inside it, else the nearest of',
    '// its own areas, else the area that shares the most land with it, as the',
    '// script says.',
    '//',
    '// Made from these public files of the Census Bureau, from www2.census.gov:',
    ...sources,
    `//   ${described(join(folder, ZCTA_PLACES))}`,
    '',
    '/** Each ZIP code area\'s point and town, "70112:29956:90077:322", entries joined by a bar. */',
    'export const ZIP_POINTS: readonly string[] = [',
    quoted(wrap(zips, '|', 96)).replace(/^ {2}/gm, ''),
    ']',
    '',
    '/** The ZIP code area each town stands for, "baton rouge:70825", in order of the names, entries joined by a bar. */',
    'export const TOWN_ZIPS: readonly string[] = [',
    quoted(wrap(townEntries, '|', 96)).replace(/^ {2}/gm, ''),
    ']',
    '',
  ].join('\n')
}

const isMain = process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))
if (isMain) {
  const [folder, out, pointsOut] = process.argv.slice(2)
  if (!folder || !out) {
    console.error('Usage: build-la-places.ts <folder of the downloads> <file to write> [<points file to write>]')
    process.exit(1)
  }
  writeFileSync(out, build(folder))
  console.log(`Wrote ${out}`)
  if (pointsOut) {
    writeFileSync(pointsOut, buildPoints(folder))
    console.log(`Wrote ${pointsOut}`)
  }
}
