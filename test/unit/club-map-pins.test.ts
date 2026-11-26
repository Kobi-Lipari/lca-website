// test/unit/club-map-pins.test.ts
//
// The Clubs directory's map as plain data (src/areas/clubs/directoryPins.ts,
// WS09 step 33): one pin for each club with a point, as the list's answer
// gives it and never found by the club's name; solid where the club states
// how it meets and hollow where it does not; count circles where clubs share
// a point or a town, which open into their pins; the pins of an opened
// circle that would touch, spread until none does; the marks in the list's
// order; where the stand-in puts a point; which map draws; and the selected
// ring against the map's paper and water. Every club here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PIN_BOX, PIN_RING, STAND_IN_FLAG, circleHolding, groupName, groupsOf, mapSource, marksFor, pinName, pinsInOrder, spreadOffset, spreadPlaced, standInPlace,
  type MapMark, type PinClub, type PlacedPin,
} from '@/areas/clubs/directoryPins'
import { LOUISIANA_BOUNDS, MAP_STYLES } from '@/areas/clubs/clubMap'
import { LCA } from '@/lib/brand'

const club = (id: string, name: string, city: string, point: [number, number] | null, statement: string | null = 'Tuesdays at 7:00 PM.'): PinClub => ({
  id, name, city, statement, point: point ? { latitude: point[0], longitude: point[1] } : null,
})

/** Five made-up clubs in the list's order: two in one town at two points, two others on one point in two towns, and one with no point. */
const CLUBS: PinClub[] = [
  club('a', 'Example Bishops Club', 'Example City', [30.45, -91.18]),
  club('b', 'Example Chess Club', 'Example City', [30.41, -91.1], null),
  club('c', 'Example Knights Club', 'Example Town', [29.95, -90.07]),
  club('d', 'Example Pawns Club', 'Example Village', [29.95, -90.07], '   '),
  club('e', 'Example Rooks Club', 'Example Hamlet', null),
]

/** The WCAG contrast ratio of two colours written as #rrggbb. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
const styleColour = (feature: string | undefined, element: string) =>
  MAP_STYLES.find((s) => s.featureType === feature && s.elementType === element)?.stylers?.find((st) => 'color' in st)?.color as string

const shape = (marks: MapMark[]) => marks.map((m) => (m.kind === 'pin' ? `pin:${m.pin.id}${m.opened ? ` from ${m.opened}` : ''}` : `circle:${m.group.pins.map((p) => p.id).join('+')}`))

/** Whether two pins at rest drawn at these points would overlap. */
const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < PIN_BOX.width && Math.abs(a.y - b.y) < PIN_BOX.height

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('the pins', () => {
  it('gives one pin for each club with a point, in the list\'s order, at the point the answer gives, and none to a club with no point', () => {
    const pins = pinsInOrder(CLUBS)
    expect(pins.map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(pins[0]).toMatchObject({ lat: 30.45, lng: -91.18, town: 'Example City' })
    // A club with no point gets none, even with a name like one of the original club list's.
    expect(pinsInOrder([club('x', 'Baton Rouge Chess Club', 'Example City', null)])).toEqual([])
  })

  it('is solid where the club states how it meets and hollow where it does not, white space counting as nothing', () => {
    expect(pinsInOrder(CLUBS).map((p) => [p.id, p.listed])).toEqual([['a', true], ['b', false], ['c', true], ['d', false]])
  })

  it('is named by the club\'s name and its town, and by its name alone with no town', () => {
    expect(pinName({ name: 'Example Chess Club', town: 'Example City' })).toBe('Example Chess Club, Example City')
    expect(pinName({ name: 'Example Chess Club', town: '' })).toBe('Example Chess Club')
  })
})

describe('the count circles', () => {
  it('join the clubs that share a town or a point, in the list\'s order, and name them', () => {
    const groups = groupsOf(pinsInOrder(CLUBS))
    expect(groups.map((g) => g.pins.map((p) => p.id))).toEqual([['a', 'b'], ['c', 'd']])
    expect(groups.map((g) => g.key)).toEqual(['group:a', 'group:c'])
    expect(groupName(groups[0])).toBe('2 clubs in Example City, show each')
    expect(groupName(groups[1])).toBe('2 clubs close together, show each')
    expect(groups[0].lat).toBeCloseTo(30.43)
  })

  it('join through a group: a town shared with one club and a point shared with another make one circle of three', () => {
    const three = [club('a', 'A Club', 'Example City', [30, -91]), club('b', 'B Club', 'Example City', [30.2, -91.2]), club('c', 'C Club', 'Example Town', [30.2, -91.2])]
    expect(groupsOf(pinsInOrder(three)).map((g) => g.pins.map((p) => p.id))).toEqual([['a', 'b', 'c']])
  })

  it('draw a closed circle where its first club would be, and each of its pins once opened, with the circle it came from', () => {
    const pins = pinsInOrder(CLUBS)
    expect(shape(marksFor(pins, new Set()))).toEqual(['circle:a+b', 'circle:c+d'])
    expect(shape(marksFor(pins, new Set(['group:a'])))).toEqual(['pin:a from group:a', 'pin:b from group:a', 'circle:c+d'])
    expect(shape(marksFor(pins, new Set(['group:a', 'group:c'])))).toEqual(['pin:a from group:a', 'pin:b from group:a', 'pin:c from group:c', 'pin:d from group:c'])
    const alone = [club('a', 'A Club', 'Example City', [30, -91]), club('b', 'B Club', 'Example Town', [31, -92])]
    expect(shape(marksFor(pinsInOrder(alone), new Set()))).toEqual(['pin:a', 'pin:b'])
  })

  it('say which closed circle holds a club, and none for a pin drawn on its own', () => {
    const pins = pinsInOrder(CLUBS)
    expect(circleHolding(marksFor(pins, new Set()), 'b')).toBe('group:a')
    expect(circleHolding(marksFor(pins, new Set(['group:a'])), 'b')).toBeNull()
    expect(circleHolding(marksFor(pins, new Set()), null)).toBeNull()
  })

  it('spread round the middle, the first above, each in its own place, and never two on one another however many there are', () => {
    expect(spreadOffset(null)).toEqual({ dx: 0, dy: 0 })
    const three = [0, 1, 2].map((index) => spreadOffset({ index, count: 3 }))
    expect(three[0].dx).toBe(0)
    expect(three[0].dy).toBeLessThanOrEqual(-22)
    expect(new Set(three.map((o) => `${o.dx},${o.dy}`)).size).toBe(3)
    for (let count = 2; count <= 12; count++) {
      const at = Array.from({ length: count }, (_, index) => spreadOffset({ index, count })).map(({ dx, dy }) => ({ x: dx, y: dy }))
      for (const [i, a] of at.entries()) for (const b of at.slice(i + 1)) expect(overlap(a, b), `${count} pins`).toBe(false)
    }
  })

  it('spread the pins of an opened circle that would touch, on one point or a little apart in one town, and leave the rest on their points', () => {
    const placed = (id: string, opened: string | null, x: number, y: number): PlacedPin => ({ id, opened, x, y })
    // Two clubs of one town about 8 pixels apart, as one zoom step leaves them, and a third of the town far off.
    const town = [placed('a', 'group:a', 382, 355), placed('b', 'group:a', 390, 359), placed('c', 'group:a', 600, 200)]
    const drawn = spreadPlaced(town)
    expect(overlap(drawn.get('a')!, drawn.get('b')!)).toBe(false)
    expect(drawn.get('a')!.y).toBeLessThan(drawn.get('b')!.y)
    expect(drawn.get('c')).toEqual({ x: 600, y: 200 })
    // Three on one point spread too, each in its own place.
    const one = spreadPlaced(['a', 'b', 'c'].map((id) => placed(id, 'group:a', 300, 300)))
    expect(new Set([...one.values()].map((p) => `${p.x},${p.y}`)).size).toBe(3)
    // A chain: the spread of two reaches a third pin of the circle, which joins it, and then none of the three touch.
    const chain = spreadPlaced([placed('a', 'group:a', 300, 300), placed('b', 'group:a', 304, 300), placed('c', 'group:a', 300, 336)])
    const points = [...chain.values()]
    for (const [i, p] of points.entries()) for (const q of points.slice(i + 1)) expect(overlap(p, q)).toBe(false)
    // Pins on their own, and pins of two different circles, stay where the map puts them.
    expect([...spreadPlaced([placed('a', null, 300, 300), placed('b', null, 304, 300)]).values()]).toEqual([{ x: 300, y: 300 }, { x: 304, y: 300 }])
    expect([...spreadPlaced([placed('a', 'group:a', 300, 300), placed('b', 'group:b', 304, 300)]).values()]).toEqual([{ x: 300, y: 300 }, { x: 304, y: 300 }])
  })
})

describe('the stand-in and the source of the map', () => {
  it('places a point across the whole-state view, west on the left and north at the top, kept in from the edges and further from the top', () => {
    const { south, west, north, east } = LOUISIANA_BOUNDS
    expect(standInPlace(north, west)).toEqual({ x: 4, y: 14 })
    expect(standInPlace(south, east)).toEqual({ x: 96, y: 96 })
    const mid = standInPlace((north + south) / 2, (west + east) / 2)
    expect(mid.x).toBeCloseTo(50)
    expect(mid.y).toBeCloseTo(50)
  })

  it('draws Google\'s map with a maps key, nothing without one, and the stand-in only in the accessibility test build when a page asks', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
    expect(mapSource()).toBe('maps')
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    vi.stubGlobal('window', {})
    expect(mapSource()).toBeNull()
    vi.stubGlobal('window', { [STAND_IN_FLAG]: true })
    expect(mapSource()).toBeNull()
    vi.stubEnv('MODE', 'a11y')
    expect(mapSource()).toBe('stand-in')
    vi.stubGlobal('window', {})
    expect(mapSource()).toBeNull()
  })
})

describe('the selected ring', () => {
  it('reaches 3 to 1 on the map\'s paper, its land and its water, where brand gold does not', () => {
    const grounds = [styleColour(undefined, 'geometry'), styleColour('landscape', 'geometry'), styleColour('landscape.natural', 'geometry'), styleColour('water', 'geometry')]
    expect(grounds).toEqual(['#f4f2ec', '#f2efe6', '#eeeadf', '#bfd4e6'])
    for (const ground of grounds) expect(contrast(PIN_RING, ground), ground).toBeGreaterThanOrEqual(3)
    expect(contrast(PIN_RING, '#f2efe6')).toBeCloseTo(4.46, 1)
    expect(contrast(LCA.gold, '#f2efe6')).toBeLessThan(3)
  })
})
