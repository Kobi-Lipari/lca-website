// test/unit/la-points-rules.test.ts
//
// The rules of the points file's towns (checkpoint Y's review), worked out by
// scripts/data/build-la-places.ts from the Census Bureau's ZIP code area to
// place relationship file, on a small made-up folder where each branch of each
// rule has its own area or town:
// - the town of a ZIP code area is the town that holds the largest share of
//   its land (a tie goes to the town named first), and an area that shares no
//   land with a town the file names has none;
// - the area a town stands for is, among the areas whose town it is, the one
//   with the least land of those at least half inside the town (a tie, the
//   lower ZIP code); where none is half inside, the one whose point lies
//   nearest the town's own point (a tie, the lower ZIP code); where the town
//   is no area's town, the area that shares the most land with it; and a town the file does not hold stands for the area whose
//   point lies nearest its own;
// - Picayune stands for its own area and is that area's town;
// - two places of one name keep the first, and the second one's land counts
//   for nothing;
// - the file is the same bytes twice, sorted, and holds no clock and no path.
// Every name, ZIP code and figure below is made up.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildPoints } from '../../scripts/data/build-la-places'

const COUNTY_HEADER = 'OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART'
const PLACE_HEADER = COUNTY_HEADER.replace(/COUNTY/g, 'PLACE')

/** ZIP code, its own land, the land it shares with the town (the point of each is in the gazetteer below). */
const AREAS: Array<[string, number, number, number]> = [
  ['70001', 30.5, -91.5, 100],
  ['70002', 30.6, -91.6, 50],
  ['70003', 30.7, -91.7, 400],
  ['70004', 30.1, -90.5, 300],
  ['70005', 30.8, -91.8, 30],
  ['70006', 30.9, -91.9, 1000],
  ['70007', 31.0, -92.0, 2000],
  ['70008', 31.1, -92.1, 10],
  ['70009', 31.2, -92.2, 10],
  ['70010', 31.3, -92.3, 20],
  ['70011', 31.4, -92.4, 60],
  ['70012', 31.5, -92.5, 10],
  ['70013', 31.6, -92.6, 10],
  ['70014', 33.0, -93.0, 100],
  ['70015', 31.5, -93.0, 100],
  ['70016', 32.0, -93.0, 100],
]

/** The made-up places: Census code, name as the gazetteer writes it, and its point. */
const PLACES: Array<[string, string, number, number]> = [
  ['P1', 'Alpha city', 30.5, -91.5],
  ['P2', 'Beta city', 30.55, -91.55],
  ['P3', 'Gamma city', 30.85, -91.85],
  ['P4', 'Delta city', 30.101, -90.501],
  ['P5', 'Epsilon city', 30.95, -91.95],
  ['P6', 'Alpha town', 31.3, -92.3],
  ['P7', 'Zeta CDP', 31.55, -92.55],
  ['P8', 'Eta village', 31.75, -93.0],
]

/** The relationship file's rows: ZIP code, the place's code, and the share of the area's land inside it. */
const SHARES: Array<[string, string, number]> = [
  ['70001', 'P1', 80], ['70001', 'P2', 20],
  ['70002', 'P1', 40],
  ['70003', 'P1', 10], ['70003', 'P2', 150],
  ['70004', 'P2', 100],
  ['70005', 'P3', 5], ['70005', 'P2', 4],
  ['70006', 'P1', 900], ['70006', 'P5', 5],
  ['70007', 'P1', 1500], ['70007', 'P5', 7],
  ['70008', 'P9', 10],
  ['70009', 'P3', 5], ['70009', 'P2', 5],
  ['70010', 'P6', 20],
  ['70011', 'P3', 20],
  ['70012', 'P7', 10],
  ['70013', 'P7', 10],
  ['70014', 'P8', 45], ['70015', 'P8', 30], ['70016', 'P8', 20],
  ['99999', 'P1', 100],
]

/** Every folder the cases make under the system's temporary folder, removed when they are done. */
const TEMP_FOLDERS: string[] = []
afterAll(() => {
  for (const dir of TEMP_FOLDERS.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function folder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'la-points-rules-'))
  TEMP_FOLDERS.push(dir)
  const zipRows = [...AREAS.map(([zip, lat, lon]) => `${zip}\t1\t0\t0\t0\t${lat}\t${lon}`), '39466\t1\t0\t0\t0\t30.52\t-89.68']
  writeFileSync(join(dir, '2024_Gaz_zcta_national.txt'), `GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n${zipRows.join('\n')}\n`)
  const placeRows = PLACES.map(([code, name, lat, lon]) => `LA\t${code}\t1\t${name}\t25\tA\t1\t0\t0\t0\t${lat}\t${lon}`)
  writeFileSync(join(dir, '2024_gaz_place_22.txt'), `USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n${placeRows.join('\n')}\n`)
  const county = (zip: string, fips: string) => `1|${zip}|ZCTA5 ${zip}|0|0|G6350|B5|S|1|${fips}|Example County|0|0|G4020|H1|A|10|0`
  writeFileSync(join(dir, 'tab20_zcta520_county20_natl.txt'), `${COUNTY_HEADER}\n${[...AREAS.map(([zip]) => county(zip, '22051')), county('39466', '28109')].join('\n')}\n`)
  const land = new Map(AREAS.map(([zip, , , area]) => [zip, area]))
  const share = ([zip, place, part]: [string, string, number]) =>
    `1|${zip}|ZCTA5 ${zip}|${land.get(zip) ?? 500}|0|G6350|B5|S|1|${place}|Example Place|30|0|G4110|C1|A|${part}|0`
  writeFileSync(join(dir, 'tab20_zcta520_place20_natl.txt'), `\uFEFF${PLACE_HEADER}\n${SHARES.map(share).join('\n')}\n`)
  return dir
}

/** The points file read back: each area's town, and each town's area, and the lines the header holds. */
function readBack(text: string) {
  const [zipPart, townPart] = text.split('export const TOWN_ZIPS')
  const entries = (part: string) => [...part.matchAll(/^ {2}'([^']*)',$/gm)].flatMap((m) => m[1].split('|')).map((entry) => entry.split(':'))
  const towns = entries(townPart)
  const areas = entries(zipPart.split('export const ZIP_POINTS')[1])
  return {
    towns,
    areaTowns: new Map(areas.map(([zip, , , index]) => [zip, index === undefined ? null : towns[Number(index)][0]])),
    townAreas: new Map(towns.map(([town, zip]) => [town, zip])),
    zips: areas.map(([zip]) => zip),
  }
}

describe('the rules of the points file\'s towns, on a made-up folder', () => {
  const dir = folder()
  const text = buildPoints(dir)
  const { areaTowns, townAreas, towns, zips } = readBack(text)

  it('gives each area the town that holds the largest share of its land, a tie to the town named first, and none to an area no named town shares land with', () => {
    expect(Object.fromEntries(areaTowns)).toEqual({
      '70001': 'alpha', '70002': 'alpha', '70003': 'beta', '70004': 'beta', '70005': 'gamma', '70006': 'alpha', '70007': 'alpha',
      '70008': null, '70009': 'beta', '70010': null, '70011': 'gamma', '70012': 'zeta', '70013': 'zeta',
      '70014': 'eta', '70015': 'eta', '70016': 'eta', '39466': 'picayune',
    })
    // 99999 is no area of the points file: its land counts for nothing.
    expect(areaTowns.has('99999')).toBe(false)
  })

  it('stands a town for the least land of its own areas at least half inside it, the lower ZIP code on a tie', () => {
    expect(townAreas.get('alpha')).toBe('70002')
    expect(townAreas.get('beta')).toBe('70009')
    expect(townAreas.get('zeta')).toBe('70012')
  })

  it('stands a town with no area half inside it for its own area whose point lies nearest the town\'s, not the one that shares the most land', () => {
    // Gamma shares 20 of 70011's land and 5 of 70005's, and 70005's point is the nearer.
    expect(townAreas.get('gamma')).toBe('70005')
  })

  it('stands such a town, of two own areas the same distance from its point, for the lower ZIP code, never the farther one that shares the most land', () => {
    // Eta's point lies a quarter of a degree from both 70015 and 70016; 70014 shares the most land and lies farthest.
    expect(townAreas.get('eta')).toBe('70015')
  })

  it('stands a town that is no area\'s town for the area that shares the most land with it', () => {
    expect(townAreas.get('epsilon')).toBe('70007')
    expect(areaTowns.get('70007')).toBe('alpha')
  })

  it('stands a town the relationship file does not hold for the area whose point lies nearest its own, and says how many there are', () => {
    expect(townAreas.get('delta')).toBe('70004')
    expect(text).toContain('1 the relationship file does not hold')
  })

  it('stands Picayune for its own area, which names it back', () => {
    expect(townAreas.get('picayune')).toBe('39466')
    expect(areaTowns.get('39466')).toBe('picayune')
  })

  it('keeps the first of two places of one name: the second place\'s land gives its area no town', () => {
    expect(towns.filter(([town]) => town === 'alpha')).toHaveLength(1)
    expect(areaTowns.get('70010')).toBeNull()
  })

  it('names each town\'s area once, in the order of the names, and each area with a town names it back unless the town stands for another of its areas', () => {
    expect(towns.map(([town]) => town)).toEqual(['alpha', 'beta', 'delta', 'epsilon', 'eta', 'gamma', 'picayune', 'zeta'])
    for (const [town, zip] of towns) expect(zips, town).toContain(zip)
  })

  it('counts its areas, those with a town and those with none, and the towns that are some area\'s town, in its header, with the rule of a town\'s area in words', () => {
    expect(text).toContain('17 ZIP code areas\' points, 15 of them with a town and')
    expect(text).toContain('2 with none, and the ZIP code area each of 8 towns stands for.')
    expect(text).toContain('towns, 6 are some area\'s town,')
    expect(text).toContain('the area a town stands for is\n// the smallest of its own areas at least half inside it, else the nearest of\n// its own areas, else the area that shares the most land with it')
  })

  it('writes the ZIP codes in order, the same bytes twice, and holds no clock and no path of the machine', () => {
    expect(zips).toEqual([...zips].sort())
    expect(buildPoints(dir)).toBe(text)
    expect(text).not.toContain(dir)
    expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b|Date\b|new Date|tmp/)
    expect(text).toContain('tab20_zcta520_place20_natl.txt:')
  })
})
