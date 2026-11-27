// test/unit/la-places-edges.test.ts
//
// The edges of the place file of Suggest a club and Start a club (WS09's
// thirtieth step), beside la-places.test.ts, which holds the main cases:
// - the script, run on small made-up files of the Census Bureau's shape: a
//   town's name shared by two regions is left out and one shared inside a
//   region kept once; the parish with the largest share of an area (land and
//   water together, then land, then the lower code) gives its region; an area
//   most of which lies outside Louisiana is not Louisiana's; Picayune's is
//   kept for its own county alone; the output does not depend on the order
//   of the rows it reads, and names the files it was made from;
// - the parish table by the rules written for it: the towns migration
//   0072 places by name, north of Lake Pontchartrain, the Lake Charles side,
//   central Louisiana, north Louisiana, and the figures of each parish's rule;
// - the committed file against the table: known ZIP codes of known parishes,
//   the counts its header gives, the codes of Louisiana's own range;
// - how a typed place is read, case by case.
// The ZIP codes and town names of Louisiana are the data under test; the
// small files hold made-up places.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { PARISH_REGIONS } from '../../domain/clubs/parishRegions'
import { TOWNS_BY_REGION, ZIPS_BY_REGION } from '../../domain/clubs/laPlaces'
import { placeKey, readTypedPlace } from '../../domain/clubs/placeNames'
import { regionOfPlace } from '../../functions/utils/clubs/places'
import { build } from '../../scripts/data/build-la-places'

/** US Chess's old initials, built in two parts so this file does not spell them. */
const OLD_NAME = new RegExp(`\\b${'US' + 'CF'}\\b`)

const ROOT = resolve(__dirname, '../..')
const [NEW_ORLEANS, BATON_ROUGE, LAFAYETTE, LAKE_CHARLES, NORTH] = REGIONS

// ── The script on made-up files ──

const ZIP_HEAD = 'GEOID\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG'
const PLACE_HEAD = 'USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG'
const COUNTY_HEAD = 'OID_ZCTA5_20|GEOID_ZCTA5_20|NAMELSAD_ZCTA5_20|AREALAND_ZCTA5_20|AREAWATER_ZCTA5_20|MTFCC_ZCTA5_20|CLASSFP_ZCTA5_20|FUNCSTAT_ZCTA5_20|OID_COUNTY_20|GEOID_COUNTY_20|NAMELSAD_COUNTY_20|AREALAND_COUNTY_20|AREAWATER_COUNTY_20|MTFCC_COUNTY_20|CLASSFP_COUNTY_20|FUNCSTAT_COUNTY_20|AREALAND_PART|AREAWATER_PART'

interface Made {
  zips: Array<[zip: string, lat: number, lon: number]>
  places: Array<[name: string, lat: number, lon: number]>
  parts: Array<[zip: string, county: string, land: number, water: number]>
}

/** Writes a folder of the three files from what a case names, the rows in the order given. */
function folderOf(made: Made): string {
  const dir = mkdtempSync(join(tmpdir(), 'la-places-edges-'))
  writeFileSync(join(dir, '2024_Gaz_zcta_national.txt'), `${ZIP_HEAD}\n${made.zips.map(([z, lat, lon]) => `${z}\t1\t0\t0\t0\t${lat}\t${lon}`).join('\n')}\n`)
  writeFileSync(join(dir, '2024_gaz_place_22.txt'), `${PLACE_HEAD}\n${made.places.map(([n, lat, lon], i) => `LA\t${i + 1}\t${i + 1}\t${n}\t25\tA\t1\t0\t0\t0\t${lat}\t${lon}`).join('\n')}\n`)
  const part = ([zip, county, land, water]: Made['parts'][number]) => `1|${zip}|ZCTA5 ${zip}|0|0|G6350|B5|S|1|${county}|Example County|0|0|G4020|H1|A|${land}|${water}`
  writeFileSync(join(dir, 'tab20_zcta520_county20_natl.txt'), `\uFEFF${COUNTY_HEAD}\n${made.parts.map(part).join('\n')}\n`)
  return dir
}

/** The lists of the file the script wrote, read back as the committed file's are. */
function listsOf(source: string): { zips: string[][]; towns: string[][] } {
  const body = source
    .replace(/export const (\w+): ReadonlyArray<readonly string\[\]> =/g, 'const $1 =')
  const read = new Function(`${body}\nreturn [ZIPS_BY_REGION, TOWNS_BY_REGION]`)() as [string[][], string[][]]
  return {
    zips: read[0].map((lines) => lines.flatMap((line) => line.split(' '))),
    towns: read[1].map((lines) => lines.flatMap((line) => line.split('|'))),
  }
}

// Points: Jefferson (New Orleans Metro), Caddo (north Louisiana), Calcasieu (Lake Charles) and Lafayette, far apart.
const BASE: Made = {
  zips: [['70001', 29.98, -90.17], ['71101', 32.5, -93.75], ['70601', 30.22, -93.2], ['70501', 30.22, -92.02], ['39466', 30.52, -89.68]],
  places: [],
  parts: [['70001', '22051', 10, 0], ['71101', '22017', 10, 0], ['70601', '22019', 10, 0], ['70501', '22055', 10, 0], ['39466', '28109', 10, 0]],
}
const withOver = (over: Partial<Made>): Made => ({
  zips: [...BASE.zips, ...(over.zips ?? [])],
  places: [...BASE.places, ...(over.places ?? [])],
  parts: [...BASE.parts, ...(over.parts ?? [])],
})

describe('the script, on made-up files', () => {
  it('leaves out a town\'s name two regions share, keeps one shared inside a region once, and says which it left out', () => {
    const out = build(folderOf(withOver({
      places: [
        ['Example Springs town', 29.99, -90.16], // New Orleans Metro
        ['Example Springs city', 32.51, -93.74], // North Louisiana
        ['Twin City city', 30.21, -93.21],
        ['Twin City town', 30.23, -93.19], // the same name, the same region
        ['Solo Place CDP', 30.21, -92.03],
      ],
    })))
    const { towns } = listsOf(out)
    expect(towns.flat()).not.toContain('example springs')
    expect(towns[REGIONS.indexOf(LAKE_CHARLES)].filter((t) => t === 'twin city')).toHaveLength(1)
    expect(towns[REGIONS.indexOf(LAFAYETTE)]).toContain('solo place')
    expect(out).toContain('// Left out, since two places of each name lie in different regions: example springs.')
  })

  it('takes the last word the Census Bureau gives a place off its name, and the full stops and the Saint off a typed one', () => {
    const { towns } = listsOf(build(folderOf(withOver({
      places: [['Saint Example city', 30.21, -93.2], ['Example Village village', 30.21, -93.21], ['Example Town CDP', 30.2, -93.2], ['Townsend town', 30.2, -93.19]],
    }))))
    const lc = towns[REGIONS.indexOf(LAKE_CHARLES)]
    expect(lc).toEqual(expect.arrayContaining(['st example', 'example village', 'example town', 'townsend']))
  })

  it('gives a town the region of the ZIP code area whose point lies nearest', () => {
    const { towns } = listsOf(build(folderOf(withOver({
      places: [['Near North city', 32.4, -93.6], ['Near Orleans city', 29.9, -90.2], ['Near Lafayette city', 30.3, -92.1]],
    }))))
    expect(towns[REGIONS.indexOf(NORTH)]).toContain('near north')
    expect(towns[REGIONS.indexOf(NEW_ORLEANS)]).toContain('near orleans')
    expect(towns[REGIONS.indexOf(LAFAYETTE)]).toContain('near lafayette')
  })

  it('gives an area that spans two parishes the one with the largest share of its land and water together, then of its land, then the lower code', () => {
    const { zips } = listsOf(build(folderOf(withOver({
      zips: [['70010', 30, -91], ['70011', 30, -91.1], ['70012', 30, -91.2], ['70013', 30, -91.3]],
      parts: [
        // Land alone says Lafayette (10 over 6), land and water say Calcasieu (11 over 10).
        ['70010', '22019', 6, 5], ['70010', '22055', 10, 0],
        // The same total of 10: the larger land is Lafayette's.
        ['70011', '22019', 5, 5], ['70011', '22055', 10, 0],
        // The same land and water: the lower code, Calcasieu (22019).
        ['70012', '22055', 5, 0], ['70012', '22019', 5, 0],
        // A parish of the largest share not first in the file.
        ['70013', '22017', 1, 0], ['70013', '22051', 9, 0], ['70013', '22071', 2, 0],
      ],
    }))))
    const where = (zip: string) => REGIONS[zips.findIndex((list) => list.includes(zip))]
    expect([where('70010'), where('70011'), where('70012'), where('70013')]).toEqual([LAKE_CHARLES, LAFAYETTE, LAKE_CHARLES, NEW_ORLEANS])
  })

  it('does not take an area most of which lies outside Louisiana, or Mississippi\'s but for Picayune\'s own', () => {
    const { zips } = listsOf(build(folderOf(withOver({
      zips: [['71102', 32.4, -93.8], ['39470', 30.8, -89.5], ['75001', 33, -96.8]],
      parts: [['71102', '22017', 3, 0], ['71102', '48203', 9, 0], ['39470', '28109', 10, 0], ['75001', '48113', 10, 0]],
    }))))
    const all = zips.flat()
    expect(all).toContain('39466')
    for (const zip of ['71102', '39470', '75001']) expect(all, zip).not.toContain(zip)
  })

  it('stops, saying so, when Picayune\'s area is not among the files', () => {
    const made = withOver({})
    made.zips = made.zips.filter(([z]) => z !== '39466')
    made.parts = made.parts.filter(([z]) => z !== '39466')
    expect(() => build(folderOf(made))).toThrow(/Picayune/)
  })

  it('stops, saying so, when a county of Louisiana has no region', () => {
    expect(() => build(folderOf(withOver({ zips: [['70099', 30, -91]], parts: [['70099', '22999', 10, 0]] })))).toThrow(/22999/)
  })

  it('writes the same bytes whatever the order of the rows it reads, with Picayune among the towns', () => {
    const made = withOver({
      zips: [['70010', 30, -91], ['70011', 30.5, -91.1]],
      places: [['Example Springs town', 29.99, -90.16], ['Example Springs city', 32.51, -93.74], ['Twin City city', 30.21, -93.21], ['Solo Place CDP', 30.21, -92.03]],
      parts: [['70010', '22019', 6, 5], ['70010', '22055', 10, 0], ['70011', '22033', 4, 0]],
    })
    const reversed: Made = { zips: [...made.zips].reverse(), places: [...made.places].reverse(), parts: [...made.parts].reverse() }
    const once = build(folderOf(made))
    // The header names each file by its hash, and a file with its rows in another order is another file: the lists are the same.
    const lists = (text: string) => JSON.stringify(listsOf(text))
    expect(lists(build(folderOf(reversed)))).toBe(lists(once))
    expect(build(folderOf(made))).toBe(once)
    expect(listsOf(once).towns[REGIONS.indexOf(NEW_ORLEANS)]).toContain('picayune')
  })

  it('names the files it was made from with their sizes and sha256, and holds no point', () => {
    const out = build(folderOf(withOver({})))
    for (const name of ['2024_Gaz_zcta_national.txt', '2024_gaz_place_22.txt', 'tab20_zcta520_county20_natl.txt']) expect(out).toMatch(new RegExp(`${name}: [\\d,]+ bytes, sha256 [0-9a-f]{64}`))
    expect(out).not.toMatch(/-?\d+\.\d{3,}/)
  })
})

// ── The parish table by its rules ──

describe('the parish table, by the rules', () => {
  const region = (name: string) => PARISH_REGIONS.find((p) => p.name === name)?.region
  const of = (names: string[]) => names.map(region)

  it('places the parishes of the towns migration 0072 places by name with their towns', () => {
    expect(of(['East Baton Rouge', 'Ascension'])).toEqual([BATON_ROUGE, BATON_ROUGE])
    expect(region('Terrebonne')).toBe(NEW_ORLEANS)
  })

  it('places the parishes north of Lake Pontchartrain in New Orleans Metro', () => {
    expect(of(['St. Tammany', 'Tangipahoa', 'Washington'])).toEqual([NEW_ORLEANS, NEW_ORLEANS, NEW_ORLEANS])
  })

  it('places the Lake Charles side in Lake Charles / Southwestern', () => {
    expect(of(['Calcasieu', 'Cameron', 'Beauregard', 'Allen', 'Jefferson Davis', 'Vernon'])).toEqual(Array(6).fill(LAKE_CHARLES))
  })

  it('places central Louisiana in Lafayette / South Central, and keeps north Louisiana', () => {
    expect(of(['Rapides', 'Avoyelles', 'Grant'])).toEqual(Array(3).fill(LAFAYETTE))
    expect(of(['Caddo', 'Bossier', 'Ouachita', 'Lincoln', 'Webster', 'Union'])).toEqual(Array(6).fill(NORTH))
  })

  it('places the five parishes K\'s decision 14 names with the seats they are named for', () => {
    expect(of(['Lafayette', 'St. Landry', 'St. Mary'])).toEqual([LAFAYETTE, LAFAYETTE, LAFAYETTE])
    expect(of(['Orleans', 'Jefferson', 'St. Bernard', 'Plaquemines'])).toEqual(Array(4).fill(NEW_ORLEANS))
  })

  it('writes each parish\'s rule as a number from 1 to 3, with the miles where it is the nearest seat\'s', () => {
    const source = readFileSync(join(ROOT, 'domain/clubs/parishRegions.ts'), 'utf8')
    for (const line of source.split('\n').filter((l) => l.includes('fips: \'22'))) {
      const rule = /\/\/ ([123]): (.+)$/.exec(line)
      expect(rule, line).not.toBeNull()
      if (rule![1] === '3') expect(rule![2], line).toMatch(/\d+ mi/)
    }
  })

  it('names no region with a typed name, a long dash or an old name for US Chess', () => {
    const source = readFileSync(join(ROOT, 'domain/clubs/parishRegions.ts'), 'utf8')
    expect(source).not.toMatch(/[\u2013\u2014]/)
    expect(source).not.toMatch(OLD_NAME)
  })
})

// ── The committed file against the table ──

describe('the committed place file', () => {
  const zips = ZIPS_BY_REGION.map((lines) => lines.flatMap((line) => line.split(' ')))
  const towns = TOWNS_BY_REGION.map((lines) => lines.flatMap((line) => line.split('|')))
  const file = readFileSync(join(ROOT, 'domain/clubs/laPlaces.ts'), 'utf8')

  it('says in its header how many ZIP code areas and town names it holds, and holds that many', () => {
    const said = /\/\/ (\d+) ZIP code areas .* and (\d+) town names/s.exec(file)
    expect(said).not.toBeNull()
    expect(Number(said![1])).toBe(zips.flat().length)
    expect(Number(said![2])).toBe(towns.flat().length)
  })

  it('counts each region\'s list in the comment above it', () => {
    REGIONS.forEach((_, i) => {
      const counts = [...file.matchAll(new RegExp(`// REGIONS\\[${i}\\]: (\\d+)`, 'g'))].map((m) => Number(m[1]))
      expect(counts).toEqual([zips[i].length, towns[i].length])
    })
  })

  it('names four files of the Census Bureau with a sha256 each, from one host', () => {
    expect(file.match(/sha256 [0-9a-f]{64}/g)).toHaveLength(4)
    expect(file).toContain('www2.census.gov')
  })

  it('holds five-digit codes in Louisiana\'s own range, Picayune\'s excepted, and nothing but towns\' names in the towns', () => {
    for (const zip of zips.flat()) expect(zip === '39466' || /^7(0[0-9]|1[0-4])\d{2}$/.test(zip), zip).toBe(true)
    for (const town of towns.flat()) {
      expect(town, town).toBe(placeKey(town))
      expect(town, town).not.toMatch(/\d/)
    }
  })

  it.each([
    ['71301', 'Alexandria, Rapides', LAFAYETTE],
    ['71360', 'Pineville, Rapides', LAFAYETTE],
    ['70663', 'Sulphur, Calcasieu', LAKE_CHARLES],
    ['70634', 'DeRidder, Beauregard', LAKE_CHARLES],
    ['70769', 'Prairieville, Ascension', BATON_ROUGE],
    ['70737', 'Gonzales, Ascension', BATON_ROUGE],
    ['70817', 'Baton Rouge', BATON_ROUGE],
    ['70360', 'Houma, Terrebonne', NEW_ORLEANS],
    ['70401', 'Hammond, Tangipahoa', NEW_ORLEANS],
    ['70471', 'Mandeville, St. Tammany', NEW_ORLEANS],
    ['70458', 'Slidell, St. Tammany', NEW_ORLEANS],
    ['71111', 'Bossier City', NORTH],
    ['71270', 'Ruston, Lincoln', NORTH],
    ['71201', 'Monroe, Ouachita', NORTH],
    ['70560', 'New Iberia, Iberia', LAFAYETTE],
    ['70570', 'Opelousas, St. Landry', LAFAYETTE],
  ])('%s (%s) is in %s', (zip, _where, expected) => {
    expect(regionOfPlace(zip)).toBe(expected)
  })

  it.each([
    ['Alexandria', LAFAYETTE],
    ['Pineville', LAFAYETTE],
    ['Lafayette', LAFAYETTE],
    ['Lake Charles', LAKE_CHARLES],
    ['Bossier City', NORTH],
    ['Hammond', NEW_ORLEANS],
    ['Mandeville', NEW_ORLEANS],
    ['Gonzales', BATON_ROUGE],
    ['Denham Springs', BATON_ROUGE],
    ['Natchitoches', NORTH],
  ])('the town %s is in %s', (town, expected) => {
    expect(regionOfPlace(town)).toBe(expected)
  })

  it('answers the same for a ZIP code and for the town of that ZIP code, among the towns of one ZIP code each', () => {
    expect(regionOfPlace('70791')).toBe(regionOfPlace('Zachary'))
    expect(regionOfPlace('70380')).toBe(regionOfPlace('Morgan City'))
    expect(regionOfPlace('70663')).toBe(regionOfPlace('Sulphur'))
  })
})

// ── How a typed place is read ──

describe('how a typed place is read', () => {
  it.each([
    ['70791', { zip: '70791' }],
    ['70791-1234', { zip: '70791' }],
    ['  70791  ', { zip: '70791' }],
    ['LA 70791', { zip: '70791' }],
    ['Zachary, LA 70791', { zip: '70791' }],
    ['Zachary,LA,70791', { zip: '70791' }],
    ['Zachary LA 70791-0001', { zip: '70791' }],
    ['70791 Zachary', { town: '70791 zachary' }],
    ['707911', { town: '707911' }],
    ['7079', { town: '7079' }],
    ['70791-12', { town: '70791-12' }],
    ['7079a', { town: '7079a' }],
    ['Zachary', { town: 'zachary' }],
    ['ZACHARY, LA', { town: 'zachary' }],
    ['Zachary,  Louisiana ', { town: 'zachary' }],
    ['Zachary la', { town: 'zachary' }],
    ['St. Francisville', { town: 'st francisville' }],
    ['St.Francisville', { town: 'st francisville' }],
    ['Saint  Francisville', { town: 'st francisville' }],
    ['SAINT Francisville, LA', { town: 'st francisville' }],
    ['Saintsbury', { town: 'saintsbury' }],
    ['Jean   Lafitte', { town: 'jean lafitte' }],
    ['Pointe a la Hache', { town: 'pointe a la hache' }],
    ['O’Neil', { town: 'o\'neil' }],
  ])('%j is read as %j', (typed, expected) => {
    expect(readTypedPlace(typed)).toEqual(expected)
  })

  it.each(['', ' ', '\t\n', ', LA', ' , Louisiana'])('%j holds no place', (typed) => {
    expect(readTypedPlace(typed)).toBeNull()
    expect(regionOfPlace(typed)).toBeNull()
  })

  it('finds nothing in punctuation alone', () => {
    expect(regionOfPlace(',')).toBeNull()
    expect(regionOfPlace('.')).toBeNull()
  })

  it('finds the same town written four ways', () => {
    for (const typed of ['St. Francisville', 'saint francisville', 'ST FRANCISVILLE, LA', ' Saint  Francisville , Louisiana']) {
      expect(regionOfPlace(typed), typed).toBe(BATON_ROUGE)
    }
  })

  it('never throws for a long or odd input, and finds nothing in it', () => {
    for (const typed of ['x'.repeat(5000), '\u0000', '70791'.repeat(400), '😀', '%s', '__proto__', 'constructor', 'toString']) {
      expect(() => regionOfPlace(typed), typed.slice(0, 10)).not.toThrow()
      expect(regionOfPlace(typed), typed.slice(0, 10)).toBeNull()
    }
  })
})
