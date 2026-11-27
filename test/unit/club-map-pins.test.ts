// test/unit/club-map-pins.test.ts
//
// The Clubs directory's map as plain data (src/areas/clubs/directoryPins.ts,
// WS09 step 33): one pin for each club with a point, as the list's answer
// gives it and never found by the club's name; solid where the club states
// how it meets and hollow where it does not; count circles where clubs share
// a point or a town, which open into their pins and stay open while any of
// their clubs is drawn; marks that would touch, pins and circles alike,
// spread until none does, inside the map's frame (since checkpoint Y's review); the marks in the list's
// order; where the stand-in puts a point; which map draws; and the selected
// ring against the map's paper and water. Every club here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CIRCLE_BOX, PIN_BOX, PIN_GAP, PIN_RING, STAND_IN_FLAG, circleHolding, groupName, groupsOf, mapSource, marksFor, pinName, pinsInOrder, spreadOffset, spreadPlaced, standInPlace,
  type MapMark, type MarkFrame, type PinClub, type PlacedPin,
} from '@/areas/clubs/directoryPins'
import { LOUISIANA_BOUNDS, MAP_STYLES } from '@/areas/clubs/clubMap'
import { CLUB_MAP_PINS } from '@/areas/clubs/clubMapData'
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

/** A mark's box at rest, from its point: a pin's stands up from it, a circle's is round it. */
const boxAt = (p: { x: number; y: number }, circle = false) => (circle
  ? { left: p.x - CIRCLE_BOX.width / 2, right: p.x + CIRCLE_BOX.width / 2, top: p.y - CIRCLE_BOX.height / 2, bottom: p.y + CIRCLE_BOX.height / 2 }
  : { left: p.x - PIN_BOX.width / 2, right: p.x + PIN_BOX.width / 2, top: p.y - PIN_BOX.height, bottom: p.y })
/** The room between two boxes: the larger of the gaps across and down, negative where they overlap on both. */
const room = (a: ReturnType<typeof boxAt>, b: ReturnType<typeof boxAt>) => Math.max(Math.max(a.left, b.left) - Math.min(a.right, b.right), Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom))

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
    expect(pinsInOrder([club('x', CLUB_MAP_PINS[0].name, 'Example City', null)])).toEqual([])
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
    // Since checkpoint Y's review a circle is opened by its clubs, not its key.
    expect(shape(marksFor(pins, new Set(['a', 'b'])))).toEqual(['pin:a from group:a', 'pin:b from group:a', 'circle:c+d'])
    expect(shape(marksFor(pins, new Set(['a', 'b', 'c', 'd'])))).toEqual(['pin:a from group:a', 'pin:b from group:a', 'pin:c from group:c', 'pin:d from group:c'])
    expect(shape(marksFor(pins, new Set(['group:a'])))).toEqual(['circle:a+b', 'circle:c+d'])
    const alone = [club('a', 'A Club', 'Example City', [30, -91]), club('b', 'B Club', 'Example Town', [31, -92])]
    expect(shape(marksFor(pinsInOrder(alone), new Set()))).toEqual(['pin:a', 'pin:b'])
  })

  it('say which closed circle holds a club, and none for a pin drawn on its own', () => {
    const pins = pinsInOrder(CLUBS)
    expect(circleHolding(marksFor(pins, new Set()), 'b')).toBe('group:a')
    expect(circleHolding(marksFor(pins, new Set(['a', 'b'])), 'b')).toBeNull()
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
    // Since checkpoint Y's review pins on their own, and pins of two different circles, spread too when they would touch;
    // far apart, they stay where the map puts them.
    for (const pair of [[placed('a', null, 300, 300), placed('b', null, 304, 300)], [placed('a', 'group:a', 300, 300), placed('b', 'group:b', 304, 300)]]) {
      const apart = spreadPlaced(pair)
      expect(overlap(apart.get('a')!, apart.get('b')!)).toBe(false)
    }
    expect([...spreadPlaced([placed('a', null, 100, 100), placed('b', null, 300, 300)]).values()]).toEqual([{ x: 100, y: 100 }, { x: 300, y: 300 }])
  })
})

describe('marks that would touch, pins and circles alike', () => {
  const lone = (id: string, x: number, y: number): PlacedPin => ({ id, opened: null, x, y })
  const circle = (id: string, x: number, y: number): PlacedPin => ({ id, opened: null, x, y, circle: true })

  it('moves two lone pins 4 pixels apart until PIN_GAP stands between their boxes', () => {
    const drawn = spreadPlaced([lone('a', 300, 300), lone('b', 304, 300)])
    expect(room(boxAt(drawn.get('a')!), boxAt(drawn.get('b')!))).toBeGreaterThanOrEqual(PIN_GAP)
    // Each stays on its own side: the one to the west is drawn to the west.
    expect(drawn.get('a')!.x).toBeLessThanOrEqual(drawn.get('b')!.x)
  })

  it('moves a lone pin beside a circle apart from it, the circle\'s box round its point', () => {
    const drawn = spreadPlaced([lone('a', 300, 300), circle('c', 306, 290)])
    expect(room(boxAt(drawn.get('a')!), boxAt(drawn.get('c')!, true))).toBeGreaterThanOrEqual(PIN_GAP)
  })

  it('moves three in a row apart, so no two of them touch', () => {
    const drawn = spreadPlaced([lone('a', 300, 300), lone('b', 310, 300), lone('c', 320, 300)])
    const boxes = ['a', 'b', 'c'].map((id) => boxAt(drawn.get(id)!))
    for (const [i, a] of boxes.entries()) for (const b of boxes.slice(i + 1)) expect(room(a, b)).toBeGreaterThanOrEqual(PIN_GAP)
  })

  it('leaves two far apart where they were, and a mark that touches none on its point beside a spread', () => {
    expect([...spreadPlaced([lone('a', 100, 100), circle('c', 300, 300)]).entries()]).toEqual([['a', { x: 100, y: 100 }], ['c', { x: 300, y: 300 }]])
    const drawn = spreadPlaced([lone('a', 300, 300), lone('b', 304, 300), lone('far', 600, 100)])
    expect(drawn.get('far')).toEqual({ x: 600, y: 100 })
  })

  it('gives the same answer for the marks in either order', () => {
    const marks = [lone('a', 300, 300), circle('c', 306, 290), lone('b', 310, 304), lone('far', 600, 100)]
    const one = spreadPlaced(marks)
    const other = spreadPlaced([...marks].reverse())
    for (const id of ['a', 'b', 'c', 'far']) expect(other.get(id), id).toEqual(one.get(id))
  })

  it('draws each mark at its own point again once the points part, as when the map zooms in', () => {
    const close = spreadPlaced([lone('a', 300, 300), lone('b', 304, 300)])
    expect(close.get('a')).not.toEqual({ x: 300, y: 300 })
    const zoomed = spreadPlaced([lone('a', 300, 300), lone('b', 340, 300)])
    expect([...zoomed.values()]).toEqual([{ x: 300, y: 300 }, { x: 340, y: 300 }])
  })
})

describe('marks spread inside the map\'s frame', () => {
  const lone = (id: string, x: number, y: number): PlacedPin => ({ id, opened: null, x, y })
  const circle = (id: string, x: number, y: number): PlacedPin => ({ id, opened: null, x, y, circle: true })
  /** All of Louisiana's room in the top left corner, as the maps measure it: 10 pixels in, 126 wide and 44 tall, and PIN_GAP round it. */
  const clear = { right: 10 + 126 + PIN_GAP, bottom: 10 + 44 + PIN_GAP }
  /** Every mark's box drawn wholly inside the frame, none under All of Louisiana, and no two touching. */
  function holds(placed: PlacedPin[], frame: MarkFrame, label: string) {
    const drawn = spreadPlaced(placed, frame)
    const boxes = placed.map((m) => boxAt(drawn.get(m.id)!, m.circle))
    for (const [i, box] of boxes.entries()) {
      expect(box.left, `${label} ${placed[i].id} left`).toBeGreaterThanOrEqual(0)
      expect(box.right, `${label} ${placed[i].id} right`).toBeLessThanOrEqual(frame.width)
      expect(box.top, `${label} ${placed[i].id} top`).toBeGreaterThanOrEqual(0)
      expect(box.bottom, `${label} ${placed[i].id} bottom`).toBeLessThanOrEqual(frame.height)
      expect(box.left >= clear.right || box.top >= clear.bottom, `${label} ${placed[i].id} under All of Louisiana`).toBe(true)
    }
    for (const [i, a] of boxes.entries()) for (const [j, b] of boxes.slice(i + 1).entries()) expect(room(a, b), `${label} ${placed[i].id} and ${placed[i + 1 + j].id}`).toBeGreaterThanOrEqual(PIN_GAP)
    return drawn
  }

  it('moves the ring of marks near one edge of a small frame in, past no edge and from under All of Louisiana', () => {
    const frame = { width: 320, height: 224, clear }
    // Six pins and a circle crowded into the top left corner, and the same at the bottom right.
    holds([...['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => lone(id, 6 + i * 3, 60 + i)), circle('g', 12, 70)], frame, 'top left')
    holds([...['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => lone(id, 314 - i * 3, 222 - i)), circle('g', 300, 210)], frame, 'bottom right')
  })

  it('lays a spread too large for a ring in the frame in rows instead, all of it inside', () => {
    // Twenty pins on one point: as a ring they would need a frame more than 300 pixels tall.
    holds(Array.from({ length: 20 }, (_, i) => lone(`p${String(i).padStart(2, '0')}`, 160, 150)), { width: 320, height: 224, clear }, 'twenty')
  })

  it('keeps the original club list\'s points inside the stand-in\'s frame at a phone\'s sizes and a laptop\'s, none touching', () => {
    for (const [width, height] of [[390, 420], [358, 300], [320, 224], [780, 780]]) {
      // Laid as the stand-in lays them, across the whole-state view: at the shortest, a northern pin reaches up beside All of Louisiana.
      const placed = CLUB_MAP_PINS.map((pin, i) => {
        const at = standInPlace(pin.lat, pin.lng)
        return lone(`p${String(i).padStart(2, '0')}`, 16 + (at.x / 100) * (width - 32), 64 + (at.y / 100) * (height - 76))
      })
      holds(placed, { width, height, clear }, `${width} by ${height}`)
    }
  })

  it('moves a mark on its own from under All of Louisiana the shorter way, leaves one that touches none on its point, and gives the same answer in either order', () => {
    expect(spreadPlaced([lone('a', 100, 60)], { width: 320, height: 224, clear }).get('a')).toEqual({ x: 100, y: 90 })
    expect(spreadPlaced([lone('a', 130, 40)], { width: 320, height: 224, clear }).get('a')).toEqual({ x: 151, y: 40 })
    const frame = { width: 320, height: 224, clear }
    const marks = [lone('a', 8, 62), lone('b', 12, 64), circle('c', 20, 70), lone('far', 250, 200)]
    const one = spreadPlaced(marks, frame)
    expect(one.get('far')).toEqual({ x: 250, y: 200 })
    const other = spreadPlaced([...marks].reverse(), frame)
    for (const id of ['a', 'b', 'c', 'far']) expect(other.get(id), id).toEqual(one.get(id))
  })
})

describe('a circle that a filter changes', () => {
  it('stays open while any of its clubs is drawn: a circle of three opened, then drawn again without its first club, is still the two pins', () => {
    const three = pinsInOrder([club('a', 'A Club', 'Example City', [30, -91]), club('b', 'B Club', 'Example City', [30.01, -91]), club('c', 'C Club', 'Example City', [30.02, -91])])
    const [group] = groupsOf(three)
    const opened = new Set(group.pins.map((p) => p.id))
    expect(shape(marksFor(three, opened))).toEqual(['pin:a from group:a', 'pin:b from group:a', 'pin:c from group:a'])
    expect(shape(marksFor(three.slice(1), opened))).toEqual(['pin:b from group:b', 'pin:c from group:b'])
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
