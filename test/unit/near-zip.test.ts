// test/unit/near-zip.test.ts
//
// The nearest ZIP code and a typed place, found in the browser (WS09 step
// 32, domain/clubs/nearZip.ts), from the points file domain/clubs/laPoints.ts:
// - the nearest ZIP code area's centre to a point, ties going to the lower
//   code;
// - a typed ZIP code, a Louisiana town (with ", LA" or without), Picayune,
//   Mississippi, a Louisiana ZIP code no area holds, a place outside
//   Louisiana, and a name that is no place;
// - what was typed is read by readTypedPlace, as the server reads it;
// - and nothing here reaches the server: no file under src/ imports the
//   points file or this one yet, and this one imports neither the server's
//   place file nor anything that reads a device.
// The ZIP codes and town names are Louisiana's own, the data under test.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { milesBetween } from '../../domain/clubs/distance'
import { TOWN_ZIPS, ZIP_POINTS } from '../../domain/clubs/laPoints'
import { nearestZip, placeFor, zipPoint } from '../../domain/clubs/nearZip'
import { readTypedPlace } from '../../domain/clubs/placeNames'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules' || name === 'dist') return []
    return statSync(join(ROOT, path)).isDirectory() ? filesUnder(path) : /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : []
  })
}

const zips = ZIP_POINTS.flatMap((line) => line.split('|')).map((entry) => entry.split(':')[0])

describe('the nearest ZIP code', () => {
  it('finds each ZIP code area\'s own centre from its point, or the lower code of two at one point', () => {
    for (const zip of zips) {
      const point = zipPoint(zip)!
      const nearest = nearestZip(point)
      expect(nearest.miles, zip).toBe(0)
      expect(nearest.zip <= zip, zip).toBe(true)
      expect(nearest.point, zip).toEqual(point)
    }
  })

  it('finds the nearest centre from a point between areas, by straight-line miles', () => {
    const point = { latitude: 30.413, longitude: -91.18 }
    const nearest = nearestZip(point)
    expect(nearest.zip).toMatch(/^708\d\d$/)
    for (const zip of zips) expect(milesBetween(point, zipPoint(zip)!) >= nearest.miles, zip).toBe(true)
  })

  it('finds a Louisiana centre for a point outside the state, the nearest one over the line', () => {
    const nearest = nearestZip({ latitude: 29.76, longitude: -95.37 })
    expect(zipPoint(nearest.zip)).not.toBeNull()
    expect(nearest.miles).toBeGreaterThan(75)
  })
})

describe('a typed place', () => {
  it('reads a ZIP code the points file holds as its centre, with or without its last four digits or a town before it', () => {
    for (const typed of ['70808', '70808-1234', 'Baton Rouge, LA 70808']) {
      expect(placeFor(typed), typed).toEqual({ kind: 'zip', zip: '70808', point: zipPoint('70808') })
    }
  })

  it('reads a Louisiana town as the ZIP code area it stands for, with that area\'s point, for the address', () => {
    for (const typed of ['Zachary', '  zachary  ', 'Zachary, LA', 'Zachary, Louisiana']) {
      const answer = placeFor(typed)
      expect(answer?.kind, typed).toBe('town')
      if (answer?.kind !== 'town') continue
      expect(answer.town).toBe('zachary')
      expect(answer.point).toEqual(zipPoint(answer.zip))
      expect(answer.zip).toBe(nearestZip(answer.point).zip)
      expect(milesBetween(answer.point, zipPoint('70791')!)).toBeLessThan(5)
    }
    expect(placeFor('Saint Gabriel')).toEqual(placeFor('St. Gabriel, LA'))
    expect(placeFor('St. Gabriel, LA')?.kind).toBe('town')
  })

  it('reads Picayune, Mississippi, the one club over the line, as a town and its ZIP code area', () => {
    const picayune = { kind: 'town', town: 'picayune', zip: '39466', point: zipPoint('39466') }
    for (const typed of ['Picayune', 'picayune, MS', 'Picayune, Mississippi', 'Picayune Mississippi']) expect(placeFor(typed), typed).toEqual(picayune)
    expect(placeFor('39466')).toEqual({ kind: 'zip', zip: '39466', point: zipPoint('39466') })
  })

  it('reads a place outside Louisiana: another state\'s ZIP code, a town of another state, or a state alone', () => {
    for (const typed of ['90210', '39201', '75201-1234', 'Houston, TX', 'Jackson, Mississippi', 'Biloxi, MS', 'Texas', 'Little Rock Arkansas', 'Example Town, NY']) {
      expect(placeFor(typed), typed).toEqual({ kind: 'outside' })
    }
  })

  it('reads a ZIP code of Louisiana\'s own range that no area holds as not found, never as outside Louisiana', () => {
    expect(zipPoint('70000')).toBeNull()
    expect(placeFor('70000')).toEqual({ kind: 'zip_not_found', zip: '70000' })
    expect(placeFor('71499')?.kind).toBe(zipPoint('71499') ? 'zip' : 'zip_not_found')
  })

  it('reads anything else as a name, as typed and trimmed, and nothing typed as nothing', () => {
    expect(placeFor('  Example Knights  ')).toEqual({ kind: 'name', text: 'Example Knights' })
    expect(placeFor('kni')).toEqual({ kind: 'name', text: 'kni' })
    expect(placeFor('7080')).toEqual({ kind: 'name', text: '7080' })
    expect(placeFor('')).toBeNull()
    expect(placeFor('   ')).toBeNull()
  })

  it('reads what was typed by readTypedPlace, the server\'s own reading', () => {
    for (const typed of ['Monroe, LA 71201', 'Lake Charles, Louisiana', 'Zachary', '70808-1234']) {
      const place = readTypedPlace(typed)!
      const answer = placeFor(typed)!
      if ('zip' in place) expect(answer).toMatchObject({ zip: place.zip })
      else expect(answer).toMatchObject({ town: place.town })
    }
    expect(read('domain/clubs/nearZip.ts')).toMatch(/import \{ readTypedPlace \} from '\.\/placeNames'/)
  })
})

describe('the place stays on the device', () => {
  it('imports the points, the distances and the place names alone: never the server\'s place file, a device or a request', () => {
    const source = read('domain/clubs/nearZip.ts')
    const imports = [...source.matchAll(/^import .* from '([^']+)'$/gm)].map((m) => m[1]).sort()
    expect(imports).toEqual(['./distance', './laPoints', './placeNames'])
    expect(source.replace(/^\s*\/\/.*$/gm, '')).not.toMatch(/fetch\(|XMLHttpRequest|navigator|localStorage|Date\.now|Math\.random/)
    expect(TOWN_ZIPS.length).toBeGreaterThan(0)
  })

  it('no file under src/ imports the points file, and only the directory\'s field and page import the nearest ZIP code, both in its lazy chunks', () => {
    const banned = /from\s+['"][^'"]*(laPoints|nearZip)['"]|import\(\s*['"][^'"]*(laPoints|nearZip)['"]/
    // WS09 step 34: the field and the page that draws it, both fetched only with the directory.
    const readers = ['src/areas/clubs/components/PlaceField.tsx', 'src/areas/clubs/components/ClubDirectory.tsx']
    for (const file of filesUnder('src')) expect(banned.test(read(file).replace(/from\s+'@domain\/clubs\/nearZip'/g, readers.includes(file) ? '' : '$&')), file).toBe(false)
    for (const file of readers) expect(read(file), file).not.toMatch(/laPoints/)
  })
})
