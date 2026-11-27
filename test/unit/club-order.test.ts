// test/unit/club-order.test.ts
//
// How the Clubs page orders and narrows its list (WS09 step 32,
// domain/clubs/order.ts), for made-up clubs:
// - A to Z by the name's code points, as SQLite's BINARY collation orders
//   GET /api/clubs (test/integration/clubs-directory.test.ts holds the two
//   alike against the database), capitals and accents included;
// - nearest first with "about N mi", the clubs with no point last, and the
//   "Farther than 75 miles" divider in its place, or none;
// - a place removes no club, and neither order ever does;
// - a typed name narrows the list to its matches, "1 club matches kni ·
//   Show all 25", its counts counted;
// - the filters narrow the list and the pins together, with their captions;
// - the Region filter's choices are REGIONS', each with its count.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UNDER_A_MILE, type MapPoint } from '../../domain/clubs/distance'
import {
  CLEAR_FILTERS, DIVIDER_MILES, DIVIDER_WORDS, NO_FILTERS, NO_FILTER_MATCH, SHOW_ALL, aToZ, byCodePoints, directoryView, filterCaption,
  matchingName, nameCaption, nearestFirst, passesFilters, pastDivider, regionChoices,
} from '../../domain/clubs/order'
import { REGIONS } from '../../domain/clubs/regions'

const ROOT = resolve(__dirname, '../..')

/** Miles along a meridian per degree of latitude, by the earth's radius distance.ts reads. */
const MILES_PER_DEGREE = (3958.8 * Math.PI) / 180

/** The point the list orders from in these cases. */
const FROM: MapPoint = { latitude: 30, longitude: -91 }

/** A point the given miles due north of FROM. */
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

/** Twenty-five made-up clubs, one of them Example Knights Club, spread over the regions and the ticks. */
function twentyFive(): Club[] {
  const out: Club[] = []
  for (let i = 1; i <= 24; i++) {
    out.push(club(`c${i}`, `Example Chess Club ${String(i).padStart(2, '0')}`, {
      point: i % 6 === 0 ? null : north(i * 7),
      region: REGIONS[i % REGIONS.length],
      weekend_play: i % 2 === 0,
      scholastic_friendly: i % 3 === 0,
    }))
  }
  out.push(club('k1', 'Example Knights Club', { point: north(3), region: REGIONS[0], weekend_play: true, scholastic_friendly: true }))
  return out
}

describe('A to Z', () => {
  it('orders by code points as the database\'s BINARY collation does: capitals, then small letters, then letters with marks', () => {
    const clubs = [
      club('a', 'example rooks club'), club('b', 'Éxample Club'), club('c', 'Example Chess Club'), club('d', 'Example chess club'),
      club('e', 'Example Chess Club'), club('f', 'Zed Example Club'), club('g', 'Example Chess Club 😀'), club('h', 'Example Chess Club Ｚ'),
    ]
    expect(aToZ(clubs).map((c) => c.id)).toEqual(['c', 'e', 'h', 'g', 'd', 'f', 'a', 'b'])
  })

  it('compares by code points, not by UTF-16 units, and never by the reader\'s language', () => {
    expect(byCodePoints('Ｚ', '😀')).toBe(-1)
    expect('Ｚ' < '😀').toBe(false)
    expect(byCodePoints('Z', 'a')).toBe(-1)
    expect(byCodePoints('a', 'É')).toBe(-1)
    expect(byCodePoints('Example', 'Example Club')).toBe(-1)
    expect(byCodePoints('Example', 'Example')).toBe(0)
    const source = readFileSync(join(ROOT, 'domain/clubs/order.ts'), 'utf8').replace(/^\s*\/\/.*$/gm, '')
    expect(source).not.toMatch(/localeCompare|Intl\.|Date\b|Math\.random/)
  })

  it('removes no club and leaves the clubs it was given as they were', () => {
    const clubs = twentyFive().reverse()
    const before = clubs.map((c) => c.id)
    const ordered = aToZ(clubs)
    expect(ordered).toHaveLength(clubs.length)
    expect(new Set(ordered.map((c) => c.id))).toEqual(new Set(before))
    expect(clubs.map((c) => c.id)).toEqual(before)
  })
})

describe('nearest first', () => {
  it('orders by straight-line miles with "about N mi", a club under a mile as less than 1 mi, and the clubs with no point last, A to Z', () => {
    const clubs = [
      club('far', 'Example Far Club', { point: north(40) }), club('none-b', 'Example Pinless B Club'), club('near', 'Example Near Club', { point: north(0.3) }),
      club('mid', 'Example Mid Club', { point: north(12) }), club('none-a', 'Example Pinless A Club'),
    ]
    const { rows, dividerBefore } = nearestFirst(clubs, FROM)
    expect(rows.map((r) => r.club.id)).toEqual(['near', 'mid', 'far', 'none-a', 'none-b'])
    expect(rows.map((r) => r.distance)).toEqual([UNDER_A_MILE, 'about 12 mi', 'about 40 mi', null, null])
    expect(rows.slice(3).map((r) => r.miles)).toEqual([null, null])
    expect(dividerBefore).toBeNull()
  })

  it('puts the one "Farther than 75 miles" divider before the first club past 75 miles', () => {
    expect(DIVIDER_MILES).toBe(75)
    expect(DIVIDER_WORDS).toBe('Farther than 75 miles')
    const clubs = [club('a', 'Example A Club', { point: north(10) }), club('b', 'Example B Club', { point: north(50) }), club('c', 'Example C Club', { point: north(80) }), club('d', 'Example D Club', { point: north(200) }), club('e', 'Example E Club')]
    const { rows, dividerBefore } = nearestFirst(clubs, FROM)
    expect(dividerBefore).toBe(2)
    expect(rows[dividerBefore!].distance).toBe('about 80 mi')
    expect(rows.map((r) => r.club.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('draws no divider when no club is farther, and none when every club with a point is', () => {
    expect(nearestFirst([club('a', 'Example A Club', { point: north(10) }), club('b', 'Example B Club', { point: north(74) }), club('n', 'Example Pinless Club')], FROM).dividerBefore).toBeNull()
    expect(nearestFirst([club('a', 'Example A Club', { point: north(90) }), club('b', 'Example B Club', { point: north(300) }), club('n', 'Example Pinless Club')], FROM).dividerBefore).toBeNull()
    expect(nearestFirst([], FROM)).toEqual({ rows: [], dividerBefore: null })
  })

  it('reads the divider as the words read: "about 75 mi" sits above it and "about 76 mi" under it', () => {
    expect(pastDivider(75.4)).toBe(false)
    expect(pastDivider(75.5)).toBe(true)
    const { rows, dividerBefore } = nearestFirst([club('a', 'Example A Club', { point: north(75.4) }), club('b', 'Example B Club', { point: north(75.6) })], FROM)
    expect(rows.map((r) => r.distance)).toEqual(['about 75 mi', 'about 76 mi'])
    expect(dividerBefore).toBe(1)
  })

  it('a place removes no club: every club is listed once, whatever the point', () => {
    const clubs = twentyFive()
    for (const from of [FROM, north(500), { latitude: 32.5, longitude: -93.75 }]) {
      const { rows } = nearestFirst(clubs, from)
      expect(rows).toHaveLength(clubs.length)
      expect(new Set(rows.map((r) => r.club.id))).toEqual(new Set(clubs.map((c) => c.id)))
    }
    const view = directoryView(clubs, { from: FROM, name: '', filters: NO_FILTERS })
    expect(view.rows).toHaveLength(clubs.length)
    expect(view.caption).toBeNull()
  })

  it('orders two clubs the same distance away A to Z, then by id', () => {
    const at = north(20)
    const { rows } = nearestFirst([club('z', 'Example Same Club', { point: at }), club('y', 'Example Same Club', { point: at }), club('x', 'Example Alpha Club', { point: at })], FROM)
    expect(rows.map((r) => r.club.id)).toEqual(['x', 'y', 'z'])
  })
})

describe('a typed name', () => {
  it('narrows the list to its matches with "1 club matches kni · Show all 25", the counts counted', () => {
    const clubs = twentyFive()
    expect(matchingName(clubs, 'kni').map((c) => c.id)).toEqual(['k1'])
    expect(nameCaption(1, 'kni', 25)).toBe('1 club matches kni · Show all 25')
    const view = directoryView(clubs, { from: null, name: 'kni', filters: NO_FILTERS })
    expect(view.rows.map((r) => r.club.id)).toEqual(['k1'])
    expect(view.caption).toBe('1 club matches kni · Show all 25')
    expect(view.caption).toBe(nameCaption(view.rows.length, 'kni', clubs.length))
  })

  it('writes the plural, and counts the total from the clubs given', () => {
    const clubs = twentyFive().slice(0, 12)
    const view = directoryView(clubs, { from: null, name: '  Example Chess  ', filters: NO_FILTERS })
    expect(view.rows).toHaveLength(12)
    expect(view.caption).toBe('12 clubs match Example Chess · Show all 12')
    expect(directoryView(clubs, { from: null, name: 'Example Rooks', filters: NO_FILTERS }).caption).toBe(`0 clubs match Example Rooks · ${SHOW_ALL} 12`)
  })

  it('matches as the site\'s search does: each word starts a word of the name, without regard to case or marks', () => {
    const clubs = [club('a', 'Example Café Club'), club('b', 'Example Knights Club'), club('c', 'Saint Example Club')]
    expect(matchingName(clubs, 'CAFE').map((c) => c.id)).toEqual(['a'])
    expect(matchingName(clubs, 'club kni').map((c) => c.id)).toEqual(['b'])
    expect(matchingName(clubs, 'St. Example').map((c) => c.id)).toEqual(['c'])
    expect(matchingName(clubs, 'nights')).toEqual([])
    expect(matchingName(clubs, '  ')).toHaveLength(3)
  })

  it('narrows the nearest order too, which still removes none of the matches', () => {
    const clubs = twentyFive()
    const view = directoryView(clubs, { from: FROM, name: 'Example Chess Club', filters: NO_FILTERS })
    expect(view.rows).toHaveLength(24)
    expect(view.caption).toBe('24 clubs match Example Chess Club · Show all 25')
  })
})

describe('the filters', () => {
  it('narrow the list and the pins together, with "N clubs match · Clear filters" counted', () => {
    const clubs = twentyFive()
    const filters = { region: REGIONS[0], weekends: false, scholastic: false }
    const view = directoryView(clubs, { from: null, name: '', filters })
    const expected = clubs.filter((c) => c.region === REGIONS[0])
    expect(view.rows.map((r) => r.club.id).sort()).toEqual(expected.map((c) => c.id).sort())
    expect(view.caption).toBe(`${expected.length} clubs match · ${CLEAR_FILTERS}`)
    // The pins are the list's own clubs with a point, in its order, and only those.
    expect(view.pins.map((c) => c.id)).toEqual(view.rows.filter((r) => r.club.point !== null).map((r) => r.club.id))
    for (const pin of view.pins) expect(pin.region).toBe(REGIONS[0])
  })

  it('writes "5 clubs match · Clear filters", "1 club matches · Clear filters" and the words for none', () => {
    expect(filterCaption(5)).toBe('5 clubs match · Clear filters')
    expect(filterCaption(1)).toBe('1 club matches · Clear filters')
    expect(filterCaption(0)).toBe('No clubs match these filters. Clear filters.')
    expect(NO_FILTER_MATCH).toBe('No clubs match these filters. Clear filters.')
  })

  it('narrows to the clubs that say so themselves, for both ticks together', () => {
    const clubs = twentyFive()
    const view = directoryView(clubs, { from: FROM, name: '', filters: { region: null, weekends: true, scholastic: true } })
    const expected = clubs.filter((c) => c.weekend_play && c.scholastic_friendly)
    expect(view.rows.map((r) => r.club.id).sort()).toEqual(expected.map((c) => c.id).sort())
    expect(view.caption).toBe(filterCaption(expected.length))
    for (const row of view.rows) expect(passesFilters(row.club, { region: null, weekends: true, scholastic: true })).toBe(true)
    expect(view.pins.every((pin) => view.rows.some((r) => r.club === pin))).toBe(true)
  })

  it('leaves no club and no pin when none passes, with "No clubs match these filters. Clear filters."', () => {
    const clubs = twentyFive().map((c) => ({ ...c, scholastic_friendly: false }))
    const view = directoryView(clubs, { from: FROM, name: 'kni', filters: { region: null, weekends: false, scholastic: true } })
    expect(view.rows).toEqual([])
    expect(view.pins).toEqual([])
    expect(view.caption).toBe('No clubs match these filters. Clear filters.')
  })

  it('counts "Show all" from the clubs the filters leave, when a name narrows them further', () => {
    const clubs = twentyFive()
    const filters = { region: REGIONS[0], weekends: false, scholastic: false }
    const left = clubs.filter((c) => c.region === REGIONS[0]).length
    expect(directoryView(clubs, { from: null, name: 'kni', filters }).caption).toBe(`1 club matches kni · Show all ${left}`)
  })

  it('offers each of REGIONS, in its order, with its count of clubs counted', () => {
    const clubs = twentyFive()
    const choices = regionChoices(clubs)
    expect(choices.map((c) => c.region)).toEqual([...REGIONS])
    for (const choice of choices) expect(choice.count).toBe(clubs.filter((c) => c.region === choice.region).length)
    expect(choices.reduce((sum, c) => sum + c.count, 0)).toBe(clubs.length)
  })
})
