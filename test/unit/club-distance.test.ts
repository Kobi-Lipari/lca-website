// test/unit/club-distance.test.ts
// Straight-line miles between two points and their words on a club page
// (domain/clubs/distance.ts, WS09 step 20): the same point, two known
// points, the two sides of the 180th meridian, the rounding into "about N
// mi" and the words under a mile, a point read from a row, and the nearest
// list's order with the club itself and a club with no point left out.
import { describe, expect, it } from 'vitest'
import { EARTH_RADIUS_MILES, UNDER_A_MILE, milesBetween, milesInWords, nearestOf, pointOf } from '../../domain/clubs/distance'

describe('milesBetween', () => {
  it('gives no miles between a point and itself', () => {
    expect(milesBetween({ latitude: 30.45, longitude: -91.19 }, { latitude: 30.45, longitude: -91.19 })).toBe(0)
  })

  it('gives one degree of the equator as the earth\'s radius times the degree in radians, and a quarter of a meridian likewise', () => {
    expect(milesBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 })).toBeCloseTo((EARTH_RADIUS_MILES * Math.PI) / 180, 6)
    expect(milesBetween({ latitude: 0, longitude: 0 }, { latitude: 90, longitude: 0 })).toBeCloseTo((EARTH_RADIUS_MILES * Math.PI) / 2, 6)
  })

  it('gives two points in Louisiana their straight-line miles, the same in either direction', () => {
    const batonRouge = { latitude: 30.4515, longitude: -91.1871 }
    const newOrleans = { latitude: 29.9511, longitude: -90.0715 }
    expect(milesBetween(batonRouge, newOrleans)).toBeCloseTo(75.06, 2)
    expect(milesBetween(newOrleans, batonRouge)).toBeCloseTo(milesBetween(batonRouge, newOrleans), 9)
  })

  it('reads two points on either side of the 180th meridian as a short way apart, not most of the way round', () => {
    const east = { latitude: 0, longitude: 179.9 }
    const west = { latitude: 0, longitude: -179.9 }
    expect(milesBetween(east, west)).toBeCloseTo(milesBetween({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.2 }), 6)
    expect(milesBetween(east, west)).toBeLessThan(14)
  })
})

describe('milesInWords', () => {
  it('rounds to the nearest mile with "about"', () => {
    expect(milesInWords(75.06)).toBe('about 75 mi')
    expect(milesInWords(12.5)).toBe('about 13 mi')
    expect(milesInWords(1.49)).toBe('about 1 mi')
    expect(milesInWords(1)).toBe('about 1 mi')
  })

  it('says "less than 1 mi" for a distance that rounds to nothing, the same point included', () => {
    expect(UNDER_A_MILE).toBe('less than 1 mi')
    expect(milesInWords(0.49)).toBe('less than 1 mi')
    expect(milesInWords(0)).toBe('less than 1 mi')
    expect(milesInWords(0.5)).toBe('about 1 mi')
  })
})

describe('pointOf', () => {
  it('takes two numbers in range and refuses anything else', () => {
    expect(pointOf(30.45, -91.19)).toEqual({ latitude: 30.45, longitude: -91.19 })
    expect(pointOf(null, -91.19)).toBeNull()
    expect(pointOf(30.45, undefined)).toBeNull()
    expect(pointOf('30.45', -91.19)).toBeNull()
    expect(pointOf(91, 0)).toBeNull()
    expect(pointOf(0, 181)).toBeNull()
    expect(pointOf(Number.NaN, 0)).toBeNull()
  })
})

describe('nearestOf', () => {
  const from = { latitude: 0, longitude: 0 }
  const at = (longitude: number) => ({ latitude: 0, longitude })
  const club = (id: string, name: string, point: { latitude: number; longitude: number } | null) => ({ id, name, point, item: id })

  it('names the nearest first, leaves out the club itself and a club with no point, and stops at the count', () => {
    const found = nearestOf(from, 'self', [
      club('far', 'Far Example Club', at(3)), club('self', 'Example Chess Club', at(0)), club('none', 'Unpinned Example Club', null),
      club('near', 'Near Example Club', at(1)), club('middle', 'Middle Example Club', at(2)), club('farthest', 'Farthest Example Club', at(4)),
    ], 3)
    expect(found.map((f) => f.item)).toEqual(['near', 'middle', 'far'])
    expect(found[0].miles).toBeCloseTo(milesBetween(from, at(1)), 9)
  })

  it('puts ties in a fixed order, by name and then by id, whatever order the rows came in', () => {
    const rows = [club('b-2', 'Bravo Example Club', at(1)), club('a-1', 'Alpha Example Club', at(1)), club('b-1', 'Bravo Example Club', at(1))]
    const expected = ['a-1', 'b-1', 'b-2']
    expect(nearestOf(from, 'self', rows, 3).map((f) => f.item)).toEqual(expected)
    expect(nearestOf(from, 'self', [...rows].reverse(), 3).map((f) => f.item)).toEqual(expected)
  })

  it('names none when no other club has a point, and none for a count of nothing', () => {
    expect(nearestOf(from, 'self', [club('self', 'Example Chess Club', at(0)), club('none', 'Unpinned Example Club', null)], 3)).toEqual([])
    expect(nearestOf(from, 'self', [club('near', 'Near Example Club', at(1))], 0)).toEqual([])
  })
})
