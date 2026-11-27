// test/unit/near-zip-edges.test.ts
//
// The edges of the nearest ZIP code, a typed place and the page's address
// (WS09 step 32; domain/clubs/nearZip.ts, domain/clubs/directoryAddress.ts),
// beside test/unit/near-zip.test.ts and test/unit/directory-address.test.ts:
// - the points file agrees with the place file the server holds: a point
//   for each of its ZIP codes and towns, every point inside Louisiana's box
//   (Picayune's, over the line, aside) and read to three decimal places;
// - the nearest ZIP code from the state's big cities is the one its first
//   three digits say, and a ZIP code's own point gives that ZIP code;
// - the ZIP code ranges at Louisiana's edges, and a typed place that is
//   written in an odd way;
// - the address never carries a point, a town or free text, whatever the
//   page was given, and reads what is shared with it however it is encoded.
import { describe, expect, it } from 'vitest'
import { readDirectoryAddress, regionKey, writeDirectoryAddress, type DirectoryAddress } from '../../domain/clubs/directoryAddress'
import { TOWNS_BY_REGION, ZIPS_BY_REGION } from '../../domain/clubs/laPlaces'
import { TOWN_ZIPS, ZIP_POINTS } from '../../domain/clubs/laPoints'
import { nearestZip, placeFor, zipPoint } from '../../domain/clubs/nearZip'
import { placeKey } from '../../domain/clubs/placeNames'
import { REGIONS } from '../../domain/clubs/regions'

const entriesOf = (lines: readonly string[]) => lines.flatMap((line) => line.split('|')).map((entry) => entry.split(':'))
const zipEntries = entriesOf(ZIP_POINTS)
const townEntries = entriesOf(TOWN_ZIPS)
const placeZips = ZIPS_BY_REGION.flat().flatMap((line) => line.split(' '))
const placeTowns = TOWNS_BY_REGION.flat().flatMap((line) => line.split('|'))

describe('the points file beside the place file', () => {
  it('holds a point for every ZIP code area and an area for every town the place file holds, and for nothing else', () => {
    expect(new Set(zipEntries.map(([zip]) => zip))).toEqual(new Set([...placeZips, '39466']))
    expect(new Set(townEntries.map(([town]) => town))).toEqual(new Set([...placeTowns.map(placeKey), 'picayune']))
    expect(zipEntries.length).toBe(new Set(zipEntries.map(([zip]) => zip)).size)
    expect(townEntries.length).toBe(new Set(townEntries.map(([town]) => town)).size)
  })

  it('holds every point inside Louisiana\'s own box at three decimal places, the one over the line aside', () => {
    // A town holds no point of its own since the checkpoint's review: the ZIP code area it stands for, which is one of the file's.
    const held = new Set(zipEntries.map(([zip]) => zip))
    for (const [town, zip] of townEntries) expect(held.has(zip), town).toBe(true)
    for (const [key, north, west] of zipEntries) {
      expect(north, key).toMatch(/^\d{5}$/)
      expect(west, key).toMatch(/^\d{5}$/)
      const latitude = Number(north) / 1000
      const longitude = -Number(west) / 1000
      expect(latitude >= 28.8 && latitude <= 33.1, `${key} ${latitude}`).toBe(true)
      expect(longitude >= -94.1 && longitude <= -88.7, `${key} ${longitude}`).toBe(true)
    }
  })

  it('answers each ZIP code of the place file as itself, and each town as a town with a ZIP code area near it', () => {
    for (const zip of placeZips) expect(placeFor(zip), zip).toEqual({ kind: 'zip', zip, point: zipPoint(zip) })
    for (const town of placeTowns) {
      const answer = placeFor(town)
      expect(answer?.kind, town).toBe('town')
      if (answer?.kind !== 'town') continue
      expect(answer.town, town).toBe(placeKey(town))
      expect(zipPoint(answer.zip), town).not.toBeNull()
    }
  })

  it('reads each town written with its state after it as the same town', () => {
    for (const town of placeTowns.slice(0, 40)) {
      expect(placeFor(`${town}, LA`), town).toEqual(placeFor(town))
      expect(placeFor(`${town.toUpperCase()}, Louisiana`), town).toEqual(placeFor(town))
    }
  })
})

describe('the nearest ZIP code from where people are', () => {
  it('is the one of the big city\'s own first three digits, from each city\'s centre', () => {
    const cities: Array<[string, number, number, RegExp]> = [
      ['New Orleans', 29.951, -90.072, /^701\d\d$/],
      ['Baton Rouge', 30.458, -91.14, /^708\d\d$/],
      ['Lafayette', 30.224, -92.02, /^705\d\d$/],
      ['Lake Charles', 30.227, -93.217, /^706\d\d$/],
      ['Shreveport', 32.525, -93.75, /^711\d\d$/],
      ['Monroe', 32.509, -92.119, /^712\d\d$/],
    ]
    for (const [name, latitude, longitude, prefix] of cities) {
      const nearest = nearestZip({ latitude, longitude })
      expect(nearest.zip, name).toMatch(prefix)
      expect(nearest.miles, name).toBeLessThan(10)
    }
  })

  it('gives the same answer for the same point every time, and a ZIP code\'s own point gives that ZIP code', () => {
    const point = { latitude: 30.51, longitude: -91.55 }
    expect(nearestZip(point)).toEqual(nearestZip(point))
    for (const zip of ['70808', '70112', '71101', '70501', '70601', '71201']) expect(nearestZip(zipPoint(zip)!).zip).toBe(zip)
  })

  it('moves to the next area when the point moves a little past the middle, and the miles are straight-line, never negative', () => {
    const a = zipPoint('70808')!
    const nearest = nearestZip({ latitude: a.latitude + 0.001, longitude: a.longitude })
    expect(nearest.miles).toBeGreaterThanOrEqual(0)
    expect(nearest.miles).toBeLessThan(1)
  })
})

describe('the ZIP code ranges at Louisiana\'s edges', () => {
  const holds = (zip: string) => zipPoint(zip) !== null
  it('reads 70000 to 71499 as Louisiana\'s own: a point where the area is held, not found where it is not', () => {
    let held = 0
    let missing = 0
    for (let n = 70000; n <= 71499; n += 7) {
      const zip = String(n)
      const answer = placeFor(zip)
      expect(answer?.kind, zip).toBe(holds(zip) ? 'zip' : 'zip_not_found')
      if (holds(zip)) held += 1
      else missing += 1
    }
    expect(held).toBeGreaterThan(20)
    expect(missing).toBeGreaterThan(20)
  })

  it('reads the ZIP codes just outside the range as outside Louisiana', () => {
    for (const zip of ['69999', '71500', '71599', '72000', '75001', '77001', '38999', '39000', '00501', '99950']) {
      expect(placeFor(zip), zip).toEqual({ kind: 'outside' })
    }
  })
})

describe('a typed place written oddly', () => {
  it('reads capitals, spacing and a trailing state the same as the plain town', () => {
    const plain = placeFor('Zachary')
    for (const typed of ['ZACHARY', 'zachary', '  Zachary  ', 'Zachary,LA', 'Zachary , la']) {
      expect(placeFor(typed), typed).toEqual(plain)
    }
  })

  it('reads a state\'s name or letters at the end as outside, and a Louisiana word inside a name as a name', () => {
    expect(placeFor('Dallas, TX 75201')).toEqual({ kind: 'outside' })
    expect(placeFor('Example Chess Club')).toEqual({ kind: 'name', text: 'Example Chess Club' })
    expect(placeFor('Louisiana Example Club')?.kind).toBe('name')
  })

  it('reads a long or odd text as a name and never throws', () => {
    for (const typed of ['x'.repeat(5000), '"; DROP TABLE clubs; --', '<b>70808</b>', 'ééé', '70808\n70112', '😀']) {
      expect(() => placeFor(typed), typed.slice(0, 20)).not.toThrow()
    }
  })
})

describe('the address, whatever the page is given', () => {
  const choices = (more: Partial<DirectoryAddress>): DirectoryAddress => ({ near: null, sort: 'az', region: null, weekends: false, scholastic: false, ...more })

  it('never writes a point, a town or free text for near: only five digits, or nothing', () => {
    for (const near of ['30.45,-91.15', 'Baton Rouge', '70808-1234', '7080', ' 70808', '70808 ', '٧٠٨٠٨', '7080a', '', 'LA']) {
      const written = writeDirectoryAddress(choices({ near, sort: 'nearest' }))
      expect(written, near).toBe('')
    }
    expect(writeDirectoryAddress(choices({ near: '70808', sort: 'nearest' }))).toBe('?near=70808')
  })

  it('reads a ZIP code only when it is exactly five ASCII digits, however the address is encoded', () => {
    expect(readDirectoryAddress('?near=70808').near).toBe('70808')
    expect(readDirectoryAddress('?near=%37%30%38%30%38').near).toBe('70808')
    for (const search of ['?near=%2070808', '?near=70808%20', '?near=70808%0A', '?near=%D9%A7%D9%A0%D9%A8%D9%A0%D9%A8', '?near[]=70808', '?NEAR=70808']) {
      expect(readDirectoryAddress(search).near, search).toBeNull()
    }
  })

  it('reads every region by its key and no other spelling, with one key for each', () => {
    for (const region of REGIONS) {
      expect(readDirectoryAddress(`?region=${regionKey(region)}`).region).toBe(region)
      expect(readDirectoryAddress(`?region=${regionKey(region).toUpperCase()}`).region).toBeNull()
      expect(readDirectoryAddress(`?region=${encodeURIComponent(region)}`).region).toBeNull()
      expect(writeDirectoryAddress(choices({ region }))).toBe(`?region=${regionKey(region)}`)
    }
    expect(REGIONS).toHaveLength(5)
  })

  it('writes only characters a link can carry, and nothing an address should never hold', () => {
    for (const region of REGIONS) {
      for (const near of [null, '70808']) {
        const written = writeDirectoryAddress({ near, sort: near ? 'nearest' : 'az', region, weekends: true, scholastic: true })
        expect(written).toMatch(/^\?[a-z0-9=&-]+$/)
        expect(written).not.toMatch(/[.,%+ ]/)
      }
    }
  })

  it('is as long as its choices and no longer, so a shared link is short', () => {
    const longest = writeDirectoryAddress({ near: '70808', sort: 'az', region: REGIONS[0], weekends: true, scholastic: true })
    expect(longest.length).toBeLessThan(80)
  })

  it('reads a leading question mark, a hash and repeated parts the one way', () => {
    const a = readDirectoryAddress('?weekends=1&near=70112')
    expect(readDirectoryAddress('weekends=1&near=70112')).toEqual(a)
    expect(readDirectoryAddress('?weekends=1&near=70112&weekends=0&near=70808')).toEqual(a)
  })
})

describe('the nearest ZIP code over the whole file', () => {
  it('finds a Louisiana area for a point anywhere in the country, in the order of the first area at the least distance', () => {
    for (const [latitude, longitude] of [[0, 0], [47.6, -122.3], [25.76, -80.19], [90, 0], [-90, 180], [30.45, 180]]) {
      const nearest = nearestZip({ latitude, longitude })
      expect(zipPoint(nearest.zip)).not.toBeNull()
      expect(Number.isFinite(nearest.miles)).toBe(true)
    }
  })
})
