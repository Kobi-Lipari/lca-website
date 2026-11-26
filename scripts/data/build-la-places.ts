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
// is given a second name, domain/clubs/laPoints.ts (WS09 step 32), with the
// point of each ZIP code area and each town the place file holds, for the
// nearest ZIP code the Clubs page finds in the browser
// (domain/clubs/nearZip.ts): each ZIP code area's point from the gazetteer
// of ZIP code areas, each town's from the gazetteer of places, and
// Picayune's, which that gazetteer cannot hold, from its ZIP code area's.
// Each point is kept to three decimal places, about a hundred metres.
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
  const addTown = (name: string, region: number, point: Point) => {
    const key = placeKey(name)
    const set = townRegions.get(key) ?? new Set<number>()
    set.add(region)
    townRegions.set(key, set)
    if (!townPoints.has(key)) townPoints.set(key, point)
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
    addTown(name, zipRegion.get(best.zip)!, point)
  }
  const picayune = zipPoints.find((area) => area.zip === PICAYUNE_ZIP)
  if (!picayune) throw new Error('Picayune\'s ZIP code area has no point')
  addTown(PICAYUNE_TOWN, zipRegion.get(PICAYUNE_ZIP)!, picayune.point)

  const sources = [ZCTA_ZIP, ZCTA_POINTS, PLACES, ZCTA_COUNTIES].filter((name) => existsSync(join(folder, name))).map((name) => `//   ${described(join(folder, name))}`)
  return { zipRegion, zipPoints, townRegions, townPoints, sources }
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

/** The points file, domain/clubs/laPoints.ts: the point of every ZIP code area and every town the place file holds. */
export function buildPoints(folder: string): string {
  const { zipPoints, townRegions, townPoints, sources } = work(folder)
  const zips = zipPoints.map(({ zip, point }) => `${zip}:${pointText(point)}`)
  const towns = [...townRegions].filter(([, set]) => set.size === 1).map(([key]) => key).sort(byText)
  const townEntries = towns.map((key) => `${key}:${pointText(townPoints.get(key)!)}`)
  return [
    '// domain/clubs/laPoints.ts',
    '//',
    '// Made by scripts/data/build-la-places.ts and committed; not to be edited by',
    '// hand. The points of the places domain/clubs/laPlaces.ts holds, for the',
    '// nearest ZIP code the Clubs page finds in the browser (domain/clubs/nearZip.ts,',
    `// WS09 step 32): ${zips.length} ZIP code areas' points and ${townEntries.length} towns' points, and no region.`,
    '// A place typed or read from the device is looked up here, in the browser, and',
    '// never sent anywhere.',
    '//',
    '// Each entry is a ZIP code or a town\'s name (as placeKey writes it), then the',
    '// latitude north and the longitude west, each in thousandths of a degree',
    '// (about a hundred metres), joined by colons; the entries are joined by a bar.',
    '// A ZIP code area\'s point and a town\'s are the Census Bureau\'s point inside',
    '// it; Picayune\'s is its ZIP code area\'s.',
    '//',
    '// Made from these public files of the Census Bureau, from www2.census.gov:',
    ...sources,
    '',
    '/** Each ZIP code area\'s point, "70001:29983:90169", entries joined by a bar. */',
    'export const ZIP_POINTS: readonly string[] = [',
    quoted(wrap(zips, '|', 96)).replace(/^ {2}/gm, ''),
    ']',
    '',
    '/** Each town\'s point, "baton rouge:30440:91133", entries joined by a bar. */',
    'export const TOWN_POINTS: readonly string[] = [',
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
