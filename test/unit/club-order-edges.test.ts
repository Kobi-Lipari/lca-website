// test/unit/club-order-edges.test.ts
//
// The edges of the list's order and its words (WS09 step 32,
// domain/clubs/order.ts), beside test/unit/club-order.test.ts:
// - the divider and the distances when the list is narrowed first, when no
//   club has a point, when clubs sit at one point or at the place itself;
// - the pins when a filter and the nearest order are chosen together;
// - the same clubs and choices always give the same list, and the clubs
//   given are never changed;
// - an empty list, a large one, and a typed name of only spaces or marks;
// - the words: plain wording with no long dash, no half
//   written as a decimal and no old name for US Chess.
import { describe, expect, it } from 'vitest'
import { UNDER_A_MILE, type MapPoint } from '../../domain/clubs/distance'
import {
  CLEAR_FILTERS, DIVIDER_WORDS, NO_FILTERS, NO_FILTER_MATCH, SHOW_ALL, aToZ, directoryView, filterCaption, matchingName, nameCaption,
  nearestFirst, regionChoices,
} from '../../domain/clubs/order'
import { REGIONS } from '../../domain/clubs/regions'

const MILES_PER_DEGREE = (3958.8 * Math.PI) / 180
const FROM: MapPoint = { latitude: 30, longitude: -91 }
const north = (miles: number): MapPoint => ({ latitude: FROM.latitude + miles / MILES_PER_DEGREE, longitude: FROM.longitude })

interface Club {
  id: string
  name: string
  point: MapPoint | null
  region: string | null
  weekend_play: boolean
  scholastic_friendly: boolean
}
const club = (id: string, name: string, more: Partial<Club> = {}): Club => ({ id, name, point: null, region: null, weekend_play: false, scholastic_friendly: false, ...more })

describe('the divider when the list is narrowed', () => {
  const clubs = [
    club('a', 'Example Alpha Club', { point: north(10), region: REGIONS[0] }),
    club('b', 'Example Beta Club', { point: north(60), region: REGIONS[1] }),
    club('c', 'Example Gamma Club', { point: north(90), region: REGIONS[1] }),
    club('d', 'Example Delta Club', { point: north(140), region: REGIONS[0] }),
    club('e', 'Example Epsilon Club', { region: REGIONS[1] }),
  ]

  it('is worked out from the clubs left, so a filter that leaves only near clubs draws none', () => {
    const all = directoryView(clubs, { from: FROM, name: '', filters: NO_FILTERS })
    expect(all.dividerBefore).toBe(2)
    const near = directoryView(clubs, { from: FROM, name: 'alpha', filters: NO_FILTERS })
    expect(near.rows.map((r) => r.club.id)).toEqual(['a'])
    expect(near.dividerBefore).toBeNull()
    const far = directoryView(clubs, { from: FROM, name: '', filters: { region: REGIONS[1], weekends: false, scholastic: false } })
    expect(far.rows.map((r) => r.club.id)).toEqual(['b', 'c', 'e'])
    expect(far.dividerBefore).toBe(1)
    expect(far.rows[far.dividerBefore!].club.id).toBe('c')
  })

  it('draws none for a list of clubs with no point, and keeps them A to Z with no distance', () => {
    const view = directoryView([club('z', 'Example Zed Club'), club('y', 'Example Why Club')], { from: FROM, name: '', filters: NO_FILTERS })
    expect(view.rows.map((r) => r.club.id)).toEqual(['y', 'z'])
    expect(view.rows.every((r) => r.distance === null && r.miles === null)).toBe(true)
    expect(view.dividerBefore).toBeNull()
    expect(view.pins).toEqual([])
  })

  it('is before the first club past 75 miles and never before the first row', () => {
    for (const set of [[10, 20], [90, 100], [10, 90], [74, 76], [50, 80, 200]]) {
      const list = set.map((miles, i) => club(`c${i}`, `Example Club ${i}`, { point: north(miles) }))
      const { rows, dividerBefore } = nearestFirst(list, FROM)
      expect(rows).toHaveLength(list.length)
      if (dividerBefore !== null) {
        expect(dividerBefore).toBeGreaterThan(0)
        expect(dividerBefore).toBeLessThan(rows.length)
        expect(Math.round(rows[dividerBefore].miles!)).toBeGreaterThan(75)
        expect(Math.round(rows[dividerBefore - 1].miles!)).toBeLessThanOrEqual(75)
      }
    }
  })
})

describe('the same point', () => {
  it('writes "less than 1 mi" for clubs at the place itself, and orders them A to Z then by id', () => {
    const list = [club('2', 'Example Same Club', { point: FROM }), club('1', 'Example Same Club', { point: FROM }), club('0', 'Example Aardvark Club', { point: FROM })]
    const { rows } = nearestFirst(list, FROM)
    expect(rows.map((r) => r.club.id)).toEqual(['0', '1', '2'])
    expect(rows.map((r) => r.distance)).toEqual([UNDER_A_MILE, UNDER_A_MILE, UNDER_A_MILE])
    expect(rows.map((r) => r.miles)).toEqual([0, 0, 0])
  })

  it('orders from a point anywhere, even far outside Louisiana, and removes none', () => {
    const list = [club('a', 'Example A Club', { point: north(10) }), club('b', 'Example B Club', { point: north(500) }), club('n', 'Example N Club')]
    for (const from of [{ latitude: 0, longitude: 0 }, { latitude: 47.6, longitude: -122.3 }, { latitude: -33.9, longitude: 151.2 }]) {
      const { rows, dividerBefore } = nearestFirst(list, from)
      expect(rows.map((r) => r.club.id).sort()).toEqual(['a', 'b', 'n'])
      expect(rows.at(-1)!.club.id).toBe('n')
      expect(dividerBefore === null || dividerBefore > 0).toBe(true)
    }
  })
})

describe('the filters and the nearest order together', () => {
  it('narrow the pins with the list, which stay in the list\'s nearest order', () => {
    const list = [
      club('far', 'Example Far Club', { point: north(30), region: REGIONS[2], scholastic_friendly: true }),
      club('near', 'Example Near Club', { point: north(2), region: REGIONS[2], scholastic_friendly: true }),
      club('other', 'Example Other Club', { point: north(1), region: REGIONS[3], scholastic_friendly: true }),
      club('plain', 'Example Plain Club', { point: north(3), region: REGIONS[2] }),
      club('nopin', 'Example Pinless Club', { region: REGIONS[2], scholastic_friendly: true }),
    ]
    const view = directoryView(list, { from: FROM, name: '', filters: { region: REGIONS[2], weekends: false, scholastic: true } })
    expect(view.rows.map((r) => r.club.id)).toEqual(['near', 'far', 'nopin'])
    expect(view.pins.map((c) => c.id)).toEqual(['near', 'far'])
    expect(view.caption).toBe('3 clubs match · Clear filters')
  })

  it('give the one club\'s caption in the singular, and a name caption when a name narrows the filtered clubs', () => {
    const list = [club('a', 'Example Alpha Club', { weekend_play: true }), club('b', 'Example Beta Club'), club('c', 'Example Gamma Club', { weekend_play: true })]
    expect(directoryView(list, { from: null, name: '', filters: { ...NO_FILTERS, weekends: true } }).caption).toBe('2 clubs match · Clear filters')
    expect(directoryView(list.slice(0, 2), { from: null, name: '', filters: { ...NO_FILTERS, weekends: true } }).caption).toBe('1 club matches · Clear filters')
    expect(directoryView(list, { from: null, name: 'gamma', filters: { ...NO_FILTERS, weekends: true } }).caption).toBe('1 club matches gamma · Show all 2')
    expect(directoryView(list, { from: null, name: 'zzz', filters: { ...NO_FILTERS, weekends: true } }).caption).toBe('0 clubs match zzz · Show all 2')
  })

  it('gives no caption when nothing narrows the list, and none for a name of only spaces', () => {
    const list = [club('a', 'Example Alpha Club'), club('b', 'Example Beta Club')]
    expect(directoryView(list, { from: null, name: '', filters: NO_FILTERS }).caption).toBeNull()
    expect(directoryView(list, { from: null, name: '   ', filters: NO_FILTERS }).caption).toBeNull()
    expect(directoryView(list, { from: FROM, name: '\t', filters: NO_FILTERS }).rows).toHaveLength(2)
  })

  it('says "No clubs match these filters. Clear filters." only for filters, even with a name typed', () => {
    const list = [club('a', 'Example Alpha Club')]
    const filters = { ...NO_FILTERS, scholastic: true }
    expect(directoryView(list, { from: null, name: 'alpha', filters }).caption).toBe(NO_FILTER_MATCH)
    expect(directoryView(list, { from: null, name: '', filters }).caption).toBe(NO_FILTER_MATCH)
    expect(directoryView([], { from: null, name: '', filters: NO_FILTERS }).caption).toBeNull()
    expect(directoryView([], { from: null, name: '', filters }).caption).toBe(NO_FILTER_MATCH)
    expect(directoryView([], { from: null, name: 'kni', filters: NO_FILTERS }).caption).toBe('0 clubs match kni · Show all 0')
  })
})

describe('the same clubs and choices', () => {
  it('always give the same list, and leave the clubs given as they were', () => {
    const list = [club('b', 'Example Beta Club', { point: north(5) }), club('a', 'Example Alpha Club', { point: north(5) }), club('c', 'Example Gamma Club')]
    const frozen = JSON.stringify(list)
    const choices = { from: FROM, name: 'example', filters: NO_FILTERS }
    const first = directoryView(list, choices)
    expect(directoryView(list, choices)).toEqual(first)
    expect(directoryView([...list].reverse(), choices)).toEqual(first)
    expect(JSON.stringify(list)).toBe(frozen)
    Object.freeze(list)
    list.forEach(Object.freeze)
    expect(() => directoryView(list, choices)).not.toThrow()
    expect(() => aToZ(list)).not.toThrow()
  })

  it('order a large list without losing a club, and put every club with no point after the last club with one', () => {
    const list = Array.from({ length: 600 }, (_, i) => club(`id${i}`, `Example Club ${(i * 7919) % 600}`, { point: i % 5 === 0 ? null : north((i * 13) % 400) }))
    const { rows } = nearestFirst(list, FROM)
    expect(rows).toHaveLength(600)
    expect(new Set(rows.map((r) => r.club.id)).size).toBe(600)
    const firstUnplaced = rows.findIndex((r) => r.club.point === null)
    expect(rows.slice(firstUnplaced).every((r) => r.club.point === null)).toBe(true)
    expect(aToZ(list)).toHaveLength(600)
  })
})

describe('matching a typed name', () => {
  const clubs = [club('a', 'Example Knights Club'), club('b', 'Example Rooks & Pawns'), club('c', 'Example Café')]
  it('reads marks, case and the word that starts a name the way the search does, and a name of only marks as no text', () => {
    expect(matchingName(clubs, 'rooks &').map((c) => c.id)).toEqual(['b'])
    expect(matchingName(clubs, 'CAFÉ').map((c) => c.id)).toEqual(['c'])
    expect(matchingName(clubs, '!!!')).toHaveLength(3)
    expect(matchingName(clubs, 'exa kni').map((c) => c.id)).toEqual(['a'])
  })

  it('keeps the typed text in the caption as it was typed, trimmed, and writes the counts it is given', () => {
    expect(nameCaption(0, '  Kni  ', 7)).toBe('0 clubs match Kni · Show all 7')
    expect(nameCaption(2, 'ex', 25)).toBe('2 clubs match ex · Show all 25')
    expect(nameCaption(1, 'ex', 1)).toBe('1 club matches ex · Show all 1')
  })
})

describe('the region choices', () => {
  it('count only the clubs given, and offer all five regions even when none has a club', () => {
    expect(regionChoices([])).toEqual(REGIONS.map((region) => ({ region, count: 0 })))
    expect(regionChoices([{ region: null }, { region: 'Example Region' }])).toEqual(REGIONS.map((region) => ({ region, count: 0 })))
    expect(regionChoices([{ region: REGIONS[4] }, { region: REGIONS[4] }]).map((c) => c.count)).toEqual([0, 0, 0, 0, 2])
    expect(regionChoices([]).map((c) => c.region)).toHaveLength(5)
  })
})

describe('the words', () => {
  const words = [DIVIDER_WORDS, SHOW_ALL, CLEAR_FILTERS, NO_FILTER_MATCH, UNDER_A_MILE, nameCaption(1, 'kni', 25), filterCaption(5), filterCaption(1), filterCaption(0)]
  it('hold no long dash, no half as a decimal and no old name for US Chess', () => {
    for (const text of words) {
      expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      expect(text).not.toMatch(/\.5\b/)
      expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    }
  })

  it('are the brief\'s, word for word', () => {
    expect(DIVIDER_WORDS).toBe('Farther than 75 miles')
    expect(nameCaption(1, 'kni', 25)).toBe('1 club matches kni · Show all 25')
    expect(filterCaption(5)).toBe('5 clubs match · Clear filters')
    expect(filterCaption(0)).toBe('No clubs match these filters. Clear filters.')
  })
})
