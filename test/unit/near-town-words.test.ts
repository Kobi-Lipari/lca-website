// test/unit/near-town-words.test.ts
//
// The town beside a ZIP code, and the words around a place (WS09 step 34):
// - nearestTown (domain/clubs/nearZip.ts) names the town of the points file
//   nearest a point, for the pill "Near you: {town} {ZIP}";
// - townWords (src/areas/clubs/directoryWords.ts) writes that town's name
//   for the page, and the page's own typing of it finds the same town again;
// - focusBounds (src/areas/clubs/directoryPins.ts) is the box the map frames
//   round a place and its nearest clubs;
// - the small word-makers read plainly: one club and many, no filter and
//   some, and no long dash.
// Every point here is read from the points file; no club is named.
import { describe, expect, it } from 'vitest'
import { milesBetween } from '../../domain/clubs/distance'
import { TOWN_POINTS, ZIP_POINTS } from '../../domain/clubs/laPoints'
import { nearestTown, nearestZip, placeFor, zipPoint } from '../../domain/clubs/nearZip'
import { focusBounds, PLACE_ZOOM } from '../../src/areas/clubs/directoryPins'
import * as words from '../../src/areas/clubs/directoryWords'

const entriesOf = (lines: readonly string[]) => lines.flatMap((line) => line.split('|')).map((entry) => entry.split(':'))
const zips = entriesOf(ZIP_POINTS).map(([zip]) => zip)
const towns = entriesOf(TOWN_POINTS).map(([town, north, west]) => ({ town, point: { latitude: Number(north) / 1000, longitude: -Number(west) / 1000 } }))

describe('nearestTown', () => {
  it('gives, for every ZIP code area, a town of the points file that no other town is nearer to', () => {
    const keys = new Set(towns.map((t) => t.town))
    for (const zip of zips) {
      const at = zipPoint(zip)!
      const town = nearestTown(at)
      expect(keys.has(town), zip).toBe(true)
      const mine = milesBetween(at, towns.find((t) => t.town === town)!.point)
      for (const other of towns) expect(milesBetween(at, other.point), `${zip} ${other.town}`).toBeGreaterThanOrEqual(mine)
    }
  })

  it('gives a town its own name at its own point, and the same answer however many times it is asked', () => {
    for (const { town, point } of towns) {
      const found = nearestTown(point)
      // Two towns the file holds at one point are told apart by name, the lower first.
      const sameSpot = towns.filter((t) => t.point.latitude === point.latitude && t.point.longitude === point.longitude).map((t) => t.town).sort()
      expect(found, town).toBe(sameSpot[0])
      expect(nearestTown(point)).toBe(found)
    }
  })

  it('answers for a point far outside Louisiana too, never with no town and never an error', () => {
    expect(towns.some((t) => t.town === nearestTown({ latitude: 29.7604, longitude: -95.3698 }))).toBe(true)
    expect(towns.some((t) => t.town === nearestTown({ latitude: 0, longitude: 0 }))).toBe(true)
    expect(towns.some((t) => t.town === nearestTown({ latitude: -90, longitude: 180 }))).toBe(true)
  })

  it('names Baton Rouge for the ZIP code of its own centre, and the ZIP code Near me finds is one the points file holds', () => {
    expect(nearestTown(zipPoint('70808')!)).toBe('baton rouge')
    const found = nearestZip({ latitude: 30.4517, longitude: -91.1288 })
    expect(zips).toContain(found.zip)
  })
})

describe('townWords', () => {
  it('writes every town of the points file with a capital on each word and no stray space, and typing it back finds the same town', () => {
    for (const { town } of towns) {
      const written = words.townWords(town)
      expect(written, town).toMatch(/^\p{Lu}[\p{L}.'-]*(?: \p{Lu}[\p{L}.'-]*)*$/u)
      expect(written, town).not.toMatch(/\s{2}|^\s|\s$/)
      const read = placeFor(written)
      expect(read?.kind, written).toBe('town')
      expect(read && 'town' in read ? read.town : null, written).toBe(town)
    }
  })

  it('writes the saints with a full stop, and a hyphen or an apostrophe keeps its capital after it', () => {
    expect(words.townWords('st francisville')).toBe('St. Francisville')
    expect(words.townWords('st martinville')).toBe('St. Martinville')
    expect(words.townWords('bayou l\'ourse')).toBe('Bayou L\'Ourse')
    expect(words.townWords('baton rouge')).toBe('Baton Rouge')
    expect(words.townWords('  lake   charles ')).toBe('Lake Charles')
    expect(words.townWords('')).toBe('')
  })
})

describe('focusBounds', () => {
  it('is the box round every point given, whatever their order, and one point is a box of no size', () => {
    const a = { lat: 30.45, lng: -91.14 }
    const b = { lat: 32.5, lng: -93.75 }
    const c = { lat: 30.22, lng: -92.02 }
    expect(focusBounds([a, b, c])).toEqual({ south: 30.22, west: -93.75, north: 32.5, east: -91.14 })
    expect(focusBounds([c, a, b])).toEqual(focusBounds([a, b, c]))
    expect(focusBounds([a])).toEqual({ south: 30.45, west: -91.14, north: 30.45, east: -91.14 })
  })

  it('stays inside the state box for any place and club points of the points file', () => {
    const points = towns.map((t) => ({ lat: t.point.latitude, lng: t.point.longitude }))
    const box = focusBounds(points)
    expect(box.south).toBeLessThan(box.north)
    expect(box.west).toBeLessThan(box.east)
    expect(box.south).toBeGreaterThan(28)
    expect(box.north).toBeLessThan(34)
    expect(PLACE_ZOOM).toBe(11)
  })
})

describe('the small word-makers', () => {
  it('says one club and many clubs plainly in the nearest caption', () => {
    expect(words.nearestCaption(1)).toBe(`The 1 club, nearest first. ${words.nearestCaption(2).split('. ')[1]}`)
    expect(words.nearestCaption(1)).toMatch(/^The 1 club, nearest first\./)
    expect(words.nearestCaption(25)).toMatch(/^All 25 clubs, nearest first\./)
    expect(words.nearestCaption(2)).not.toMatch(/^The /)
  })

  it('counts the filters in the Filters button: none, one, many', () => {
    expect([0, 1, 2, 3].map(words.filtersButton)).toEqual(['Filters', 'Filters · 1 on', 'Filters · 2 on', 'Filters · 3 on'])
  })

  it('writes the pill and the no-club line from the town and ZIP it is given, and nothing else', () => {
    expect(words.nearYou('Lafayette', '70501')).toBe('Near you: Lafayette 70501')
    expect(words.noClubIn('Lafayette')).toBe('No club in Lafayette yet. The nearest are listed first.')
  })

  it('writes no long dash, no old name of US Chess and no decimal half in any of its words', () => {
    const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    const OLD_NAME = new RegExp(`USC${'F'}`)
    const text = Object.values(words).filter((v): v is string => typeof v === 'string').join('\n')
    expect(text).not.toMatch(LONG_DASH)
    expect(text).not.toMatch(OLD_NAME)
    expect(text).not.toMatch(/\d\.5\b/)
  })
})
