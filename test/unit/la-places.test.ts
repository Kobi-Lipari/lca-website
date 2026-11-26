// test/unit/la-places.test.ts
//
// The place file of Suggest a club and Start a club (WS09's thirtieth step),
// domain/clubs/laPlaces.ts as committed, with the parish table it was made
// from (domain/clubs/parishRegions.ts) and the server's lookup
// (functions/utils/clubs/places.ts):
// - each of Louisiana's 64 parishes once, each with one of the five regions;
// - every ZIP code area with exactly one of the five, Picayune's among them,
//   none twice, and every town's name once, in the form placeKey writes;
// - the lookup reads a ZIP code and a town's name, and answers "not found"
//   for anything else;
// - the script writes the same bytes twice from the same files (here, small
//   made-up files of the Census Bureau's shape, so no download is needed);
// - and no file under src/ or workers/ imports the place file, the parish
//   table or the lookup, so neither the site's scripts nor the daily-emails
//   worker carry them.
// Since WS09 step 32 the script writes the points file too,
// domain/clubs/laPoints.ts, from the same files: a point for exactly the
// places the place file holds, kept to three decimal places, the same four
// files named in its header. With LA_PLACES_DOWNLOADS naming a folder of the
// Census Bureau's files, the script is run on them and must write both
// committed files byte for byte; with it unset, as in every run of the
// suite, that one case checks the headers alone.
// The ZIP codes and town names are Louisiana's own, the data under test.
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { PARISH_REGIONS, PICAYUNE_COUNTY, PICAYUNE_ZIP } from '../../domain/clubs/parishRegions'
import { TOWNS_BY_REGION, ZIPS_BY_REGION } from '../../domain/clubs/laPlaces'
import { TOWN_POINTS, ZIP_POINTS } from '../../domain/clubs/laPoints'
import { placeKey, readTypedPlace } from '../../domain/clubs/placeNames'
import { regionOfPlace } from '../../functions/utils/clubs/places'
import { build, buildPoints } from '../../scripts/data/build-la-places'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const [NEW_ORLEANS, BATON_ROUGE, LAFAYETTE, LAKE_CHARLES, NORTH] = REGIONS

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : []
  })
}

const zips = ZIPS_BY_REGION.map((lines) => lines.flatMap((line) => line.split(' ')))
const towns = TOWNS_BY_REGION.map((lines) => lines.flatMap((line) => line.split('|')))

describe('the parish table', () => {
  it('gives each of Louisiana\'s 64 parishes once, each with one of the five regions', () => {
    expect(PARISH_REGIONS).toHaveLength(64)
    expect(new Set(PARISH_REGIONS.map((p) => p.fips)).size).toBe(64)
    expect(new Set(PARISH_REGIONS.map((p) => p.name)).size).toBe(64)
    for (const parish of PARISH_REGIONS) {
      expect(parish.fips, parish.name).toMatch(/^22\d{3}$/)
      expect(REGIONS, parish.name).toContain(parish.region)
    }
    // Every region has at least one parish, and the three towns migration 0072 places by name keep their regions.
    for (const region of REGIONS) expect(PARISH_REGIONS.some((p) => p.region === region), region).toBe(true)
    const byName = new Map(PARISH_REGIONS.map((p) => [p.name, p.region]))
    expect([byName.get('East Baton Rouge'), byName.get('Ascension'), byName.get('Terrebonne')]).toEqual([BATON_ROUGE, BATON_ROUGE, NEW_ORLEANS])
    expect(PICAYUNE_COUNTY).toEqual({ fips: '28109', name: 'Pearl River County, Mississippi', region: NEW_ORLEANS })
  })

  it('names the regions through REGIONS, never typing one a second time, and says each parish\'s rule', () => {
    const source = read('domain/clubs/parishRegions.ts')
    for (const region of REGIONS) expect(source.split('\n').filter((line) => line.includes(`'${region}'`)), region).toEqual([])
    for (const line of source.split('\n').filter((l) => l.includes('fips: \'22'))) expect(line, line).toMatch(/\/\/ [123]: /)
  })
})

describe('the place file', () => {
  it('holds one list of ZIP codes and one of towns for each of the five regions', () => {
    expect(ZIPS_BY_REGION).toHaveLength(REGIONS.length)
    expect(TOWNS_BY_REGION).toHaveLength(REGIONS.length)
  })

  it('gives every ZIP code area exactly one region, none twice, Picayune\'s among them, and each a Louisiana code but Picayune\'s', () => {
    const all = zips.flat()
    expect(new Set(all).size).toBe(all.length)
    expect(all.length).toBeGreaterThan(500)
    for (const zip of all) expect(zip).toMatch(/^\d{5}$/)
    for (const zip of all) if (zip !== PICAYUNE_ZIP) expect(zip, zip).toMatch(/^7[01]\d{3}$/)
    expect(zips[0]).toContain(PICAYUNE_ZIP)
    for (const list of zips) expect(list.length).toBeGreaterThan(0)
  })

  it('gives every town\'s name once, in the form placeKey writes it', () => {
    const all = towns.flat()
    expect(new Set(all).size).toBe(all.length)
    for (const town of all) expect(placeKey(town), town).toBe(town)
    expect(towns[0]).toContain('picayune')
  })

  it('names its sources with their sizes and sha256 in its header, holds no point, and writes no region\'s name', () => {
    const source = read('domain/clubs/laPlaces.ts')
    for (const file of ['2024_Gaz_zcta_national.zip', '2024_Gaz_zcta_national.txt', '2024_gaz_place_22.txt', 'tab20_zcta520_county20_natl.txt']) {
      expect(source).toMatch(new RegExp(`${file.replace(/\./g, '\\.')}: [\\d,]+ bytes, sha256 [0-9a-f]{64}`))
    }
    expect(source).not.toMatch(/-?\d{2}\.\d{4,}/)
    for (const region of REGIONS) expect(source).not.toContain(region)
    expect(source).not.toMatch(/^\s*import\s/m)
  })
})

describe('the server\'s lookup', () => {
  it.each([
    ['70791', BATON_ROUGE],
    ['70791-1234', BATON_ROUGE],
    ['Zachary', BATON_ROUGE],
    ['  zachary  ', BATON_ROUGE],
    ['Saint Gabriel', BATON_ROUGE],
    ['St. Gabriel, LA', BATON_ROUGE],
    ['70112', NEW_ORLEANS],
    ['New Orleans', NEW_ORLEANS],
    ['Houma', NEW_ORLEANS],
    ['Slidell', NEW_ORLEANS],
    ['39466', NEW_ORLEANS],
    ['Picayune', NEW_ORLEANS],
    ['70501', LAFAYETTE],
    ['Opelousas', LAFAYETTE],
    ['Morgan City', LAFAYETTE],
    ['70380', LAFAYETTE],
    ['Pineville', LAFAYETTE],
    ['70601', LAKE_CHARLES],
    ['Sulphur', LAKE_CHARLES],
    ['DeRidder', LAKE_CHARLES],
    ['71101', NORTH],
    ['Shreveport, Louisiana', NORTH],
    ['Ruston', NORTH],
    ['Monroe, LA 71201', NORTH],
  ])('%s is in %s', (typed, region) => {
    expect(regionOfPlace(typed)).toBe(region)
  })

  it.each(['90210', '39470', '00000', '7079', 'Example Nowhere', 'Atlantis', '', '   ', 'Louisiana'])('"%s" is not found, an answer and not an error', (typed) => {
    expect(regionOfPlace(typed)).toBeNull()
  })

  it('reads a ZIP code at the end of what was typed, and a town\'s name otherwise', () => {
    expect(readTypedPlace('Zachary, LA 70791')).toEqual({ zip: '70791' })
    expect(readTypedPlace('Lake Charles, Louisiana')).toEqual({ town: 'lake charles' })
    expect(readTypedPlace(' ')).toBeNull()
  })
})

describe('the script', () => {
  it('writes the same bytes twice from the same files, with a region for each made-up area', () => {
    const dir = mkdtempSync(join(tmpdir(), 'la-places-'))
    writeFileSync(join(dir, '2024_Gaz_zcta_national.txt'), 'GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n70001\t1\t0\t0\t0\t29.98\t-90.17\n71101\t1\t0\t0\t0\t32.50\t-93.75\n39466\t1\t0\t0\t0\t30.52\t-89.68\n')
    writeFileSync(join(dir, '2024_gaz_place_22.txt'), 'USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\nLA\t1\t1\tExample City city\t25\tA\t1\t0\t0\t0\t32.51\t-93.74\nLA\t2\t2\tSt. Example town\t43\tA\t1\t0\t0\t0\t29.99\t-90.16\n')
    const header = 'OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART'
    const part = (zip: string, county: string, land: number) => `1|${zip}|ZCTA5 ${zip}|0|0|G6350|B5|S|1|${county}|Example County|0|0|G4020|H1|A|${land}|0`
    writeFileSync(join(dir, 'tab20_zcta520_county20_natl.txt'), `\uFEFF${header}\n${[part('70001', '22051', 10), part('71101', '22017', 10), part('71101', '22015', 5), part('39466', '28109', 10), part('39470', '28109', 10)].join('\n')}\n`)
    const once = build(dir)
    expect(build(dir)).toBe(once)
    expect(once).toContain('\'39466 70001\'')
    expect(once).toContain('\'71101\'')
    expect(once).not.toContain('39470')
    expect(once).toContain('\'example city\'')
    expect(once).toContain('\'picayune|st example\'')
  })
})

describe('the points file', () => {
  const entries = (lines: readonly string[]) => lines.flatMap((line) => line.split('|')).map((entry) => entry.split(':'))
  const sourceLines = (text: string) => text.split('\n').filter((line) => /^\/\/ {3}\S+: [\d,]+ bytes, sha256 [0-9a-f]{64}$/.test(line))

  it('holds a point for exactly the ZIP code areas and the towns the place file holds, each once, to three decimal places', () => {
    const zipEntries = entries(ZIP_POINTS)
    const townEntries = entries(TOWN_POINTS)
    expect(zipEntries.map(([zip]) => zip).sort()).toEqual(zips.flat().sort())
    expect(townEntries.map(([town]) => town).sort()).toEqual(towns.flat().sort())
    for (const [key, north, west] of [...zipEntries, ...townEntries]) {
      expect(north, key).toMatch(/^\d{5}$/)
      expect(west, key).toMatch(/^\d{5}$/)
      // Louisiana, and Picayune over the line: between 28 and 34 degrees north and 88 and 95 west.
      expect(Number(north) / 1000, key).toBeGreaterThan(28)
      expect(Number(north) / 1000, key).toBeLessThan(34)
      expect(Number(west) / 1000, key).toBeGreaterThan(88)
      expect(Number(west) / 1000, key).toBeLessThan(95)
    }
    // Picayune's town lies at its ZIP code area's point, as the gazetteer of places cannot hold it.
    const picayuneZip = zipEntries.find(([zip]) => zip === PICAYUNE_ZIP)!
    expect(townEntries.find(([town]) => town === 'picayune')!.slice(1)).toEqual(picayuneZip.slice(1))
  })

  it('names the same four files, sizes and sha256 as the place file, stays under 24,000 bytes and imports nothing', () => {
    const points = read('domain/clubs/laPoints.ts')
    expect(sourceLines(points)).toHaveLength(4)
    expect(sourceLines(points)).toEqual(sourceLines(read('domain/clubs/laPlaces.ts')))
    expect(Buffer.byteLength(points)).toBeLessThan(24000)
    expect(points).not.toMatch(/^\s*import\s/m)
    for (const region of REGIONS) expect(points).not.toContain(region)
  })

  it('is written by the script from the same files, the same bytes twice, the place file unchanged beside it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'la-points-'))
    writeFileSync(join(dir, '2024_Gaz_zcta_national.txt'), 'GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\n70001\t1\t0\t0\t0\t29.98049\t-90.17\n39466\t1\t0\t0\t0\t30.52\t-89.68\n')
    writeFileSync(join(dir, '2024_gaz_place_22.txt'), 'USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG\nLA\t1\t1\tExample City city\t25\tA\t1\t0\t0\t0\t29.9911\t-90.1604\n')
    const header = 'OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART'
    const part = (zip: string, county: string) => `1|${zip}|ZCTA5 ${zip}|0|0|G6350|B5|S|1|${county}|Example County|0|0|G4020|H1|A|10|0`
    writeFileSync(join(dir, 'tab20_zcta520_county20_natl.txt'), `${header}\n${[part('70001', '22051'), part('39466', '28109')].join('\n')}\n`)
    const places = build(dir)
    const once = buildPoints(dir)
    expect(buildPoints(dir)).toBe(once)
    expect(build(dir)).toBe(places)
    expect(once).toContain('\'39466:30520:89680|70001:29980:90170\'')
    expect(once).toContain('\'example city:29991:90160|picayune:30520:89680\'')
    expect(sourceLines(once)).toEqual(sourceLines(places))
  })

  it('writes both committed files byte for byte from the downloads, when LA_PLACES_DOWNLOADS names their folder', () => {
    const folder = process.env.LA_PLACES_DOWNLOADS
    if (folder) {
      expect(build(folder)).toBe(read('domain/clubs/laPlaces.ts'))
      expect(buildPoints(folder)).toBe(read('domain/clubs/laPoints.ts'))
    }
    expect(sourceLines(read('domain/clubs/laPoints.ts'))).toEqual(sourceLines(read('domain/clubs/laPlaces.ts')))
  })
})

describe('only the server reads it', () => {
  it('no file under src/ or workers/ imports the place file, the parish table, the place names or the lookup', () => {
    const banned = /from\s+['"][^'"]*(laPlaces|parishRegions|placeNames|utils\/clubs\/places)['"]|import\(\s*['"][^'"]*(laPlaces|parishRegions|placeNames|utils\/clubs\/places)['"]/
    for (const dir of ['src', 'workers']) for (const file of filesUnder(dir)) expect(banned.test(read(file)), file).toBe(false)
  })

  it('the server reads it through the lookup alone, which the public endpoint alone reads', () => {
    const readers = filesUnder('functions').filter((file) => /laPlaces/.test(read(file)))
    expect(readers).toEqual(['functions/utils/clubs/places.ts'])
    const lookups = filesUnder('functions').filter((file) => /utils\/clubs\/places'/.test(read(file)))
    expect(lookups).toEqual(['functions/api/clubs/reports.ts'])
  })
})
