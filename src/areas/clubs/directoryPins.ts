// src/areas/clubs/directoryPins.ts
//
// The Clubs directory's map as plain data (WS09 step 33): which pins it
// draws, in which order, and what each is called, so the page, the map and
// the tests read one model.
//   - One pin for each club with a point, the point as GET /api/clubs gives
//     it (the club's first place, or its old pin while it has no place),
//     never a pin found by the club's name. A club with no point has none.
//   - A pin is solid where the club states how it meets and hollow where it
//     does not. No pin carries a number.
//   - Clubs that share a point or a town are drawn as one count circle until
//     it is opened; an opened circle draws each of its clubs, and those whose
//     pins would touch where the map puts them are spread round the middle of
//     their points, so each can be pressed.
//   - The marks come in the list's order, so the pins, which are buttons,
//     are met in the same order as the cards.
// No clock and no random source: the same clubs always give the same marks.
import { LOUISIANA_BOUNDS } from '@/areas/clubs/clubMap'

/** What the map reads of a club in the directory's answer. */
export interface PinClub {
  id: string
  name: string
  city: string | null
  statement: string | null
  point: { latitude: number; longitude: number } | null
}

/** One club's pin. */
export interface MapPin {
  id: string
  name: string
  town: string
  lat: number
  lng: number
  /** The club states how it meets: a solid pin. Otherwise a hollow one. */
  listed: boolean
}

/** Clubs that share a point or a town, drawn as one count circle until opened. */
export interface PinGroup {
  /** "group:" and the id of its first club in the list's order. */
  key: string
  lat: number
  lng: number
  /** The town all of its clubs share, or null when they share only a point. */
  town: string | null
  pins: MapPin[]
}

/** Where a pin of an opened circle sits beside the others it would touch: its place among them and how many there are. */
export interface Spread {
  index: number
  count: number
}

/** What the map draws: a pin, with the key of the opened circle it was drawn from (null for a pin on its own), or a closed count circle. */
export type MapMark =
  | { kind: 'pin'; pin: MapPin; opened: string | null }
  | { kind: 'group'; group: PinGroup }

/** The pins for the clubs given, in their order: one for each club with a point. */
export function pinsInOrder(clubs: readonly PinClub[]): MapPin[] {
  return clubs.flatMap((club) => (club.point
    ? [{ id: club.id, name: club.name, town: (club.city ?? '').trim(), lat: club.point.latitude, lng: club.point.longitude, listed: (club.statement ?? '').trim() !== '' }]
    : []))
}

/** What a screen reader hears for a pin: the club's name and its town. */
export function pinName(pin: Pick<MapPin, 'name' | 'town'>): string {
  return pin.town ? `${pin.name}, ${pin.town}` : pin.name
}

const pointKey = (pin: MapPin) => `${pin.lat.toFixed(5)},${pin.lng.toFixed(5)}`
const townKey = (pin: MapPin) => pin.town.toLowerCase().replace(/\s+/g, ' ')

/** The pins joined into groups: two pins go together when they share a point or a town, and so on through the group. Each group's pins keep the list's order, and the groups come in the order of their first pin. */
export function groupsOf(pins: readonly MapPin[]): PinGroup[] {
  const parent = pins.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])))
  const join = (a: number, b: number) => {
    const x = root(a)
    const y = root(b)
    if (x !== y) parent[Math.max(x, y)] = Math.min(x, y)
  }
  const seen = new Map<string, number>()
  pins.forEach((pin, i) => {
    for (const key of [`p:${pointKey(pin)}`, townKey(pin) ? `t:${townKey(pin)}` : '']) {
      if (!key) continue
      const first = seen.get(key)
      if (first === undefined) seen.set(key, i)
      else join(first, i)
    }
  })
  const byRoot = new Map<number, MapPin[]>()
  pins.forEach((pin, i) => {
    const r = root(i)
    byRoot.set(r, [...(byRoot.get(r) ?? []), pin])
  })
  return [...byRoot.values()].map((members) => {
    const towns = new Set(members.map(townKey))
    return {
      key: `group:${members[0].id}`,
      lat: members.reduce((sum, p) => sum + p.lat, 0) / members.length,
      lng: members.reduce((sum, p) => sum + p.lng, 0) / members.length,
      town: towns.size === 1 && members[0].town ? members[0].town : null,
      pins: members,
    }
  })
}

/**
 * What the map draws, in the list's order: each pin on its own, and each
 * group of two or more as one count circle where its first pin would be,
 * unless the group's key is among the opened, when each of its pins is
 * drawn with that key, so the map can spread the ones that would touch
 * (spreadPlaced).
 */
export function marksFor(pins: readonly MapPin[], opened: ReadonlySet<string>): MapMark[] {
  const groupOf = new Map<string, PinGroup>()
  for (const group of groupsOf(pins)) for (const pin of group.pins) groupOf.set(pin.id, group)
  const marks: MapMark[] = []
  const drawn = new Set<string>()
  for (const pin of pins) {
    const group = groupOf.get(pin.id)!
    if (group.pins.length > 1 && !opened.has(group.key)) {
      if (!drawn.has(group.key)) marks.push({ kind: 'group', group })
      drawn.add(group.key)
      continue
    }
    marks.push({ kind: 'pin', pin, opened: group.pins.length > 1 ? group.key : null })
  }
  return marks
}

/** A count circle's name: "2 clubs in Example City, show each", or "close together" when they share no town. */
export function groupName(group: PinGroup): string {
  return `${group.pins.length} clubs ${group.town ? `in ${group.town}` : 'close together'}, show each`
}

/** The key of the closed count circle that holds a club, or null when the club's pin is drawn on its own or it has none. */
export function circleHolding(marks: readonly MapMark[], id: string | null): string | null {
  if (id === null) return null
  for (const mark of marks) if (mark.kind === 'group' && mark.group.pins.some((p) => p.id === id)) return mark.group.key
  return null
}

/** A pin at rest, in pixels, wide by tall: its box stands up from its point. */
export const PIN_BOX = { width: 26, height: 34 } as const

/** The room, in pixels, kept between the boxes of two pins of an opened circle. */
export const PIN_GAP = 2

/** The least distance, in pixels, a spread pin is drawn from the middle of its points. */
export const SPREAD_PX = 22

/** How far from the middle the pins of a spread are drawn: far enough that two next to each other, on any slant, keep PIN_GAP between their boxes. */
export function spreadRadius(count: number): number {
  if (count < 2) return 0
  const slant = Math.hypot(PIN_BOX.width + PIN_GAP, PIN_BOX.height + PIN_GAP)
  return Math.max(SPREAD_PX, Math.ceil(slant / (2 * Math.sin(Math.PI / count))))
}

/** A spread pin's offset from the middle of its points, in pixels: round the middle, the first above it. */
export function spreadOffset(spread: Spread | null): { dx: number; dy: number } {
  if (!spread) return { dx: 0, dy: 0 }
  const radius = spreadRadius(spread.count)
  const angle = (2 * Math.PI * spread.index) / spread.count - Math.PI / 2
  return { dx: Math.round(radius * Math.cos(angle)), dy: Math.round(radius * Math.sin(angle)) }
}

/** A pin's point where the map puts it, in pixels from the map's top left corner, with the opened circle it was drawn from (null for a pin on its own). */
export interface PlacedPin {
  id: string
  opened: string | null
  x: number
  y: number
}

/** Whether two pins drawn at these points would touch: their boxes at rest closer than PIN_GAP. */
function touch(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < PIN_BOX.width + PIN_GAP && Math.abs(a.y - b.y) < PIN_BOX.height + PIN_GAP
}

/**
 * Where each placed pin is drawn, in pixels. Pins of one opened circle whose
 * boxes would touch are drawn round the middle of their points, in the list's
 * order and the first above, whether they share one point or sit a little
 * apart in one town; the spread is looked at again, and any pin of the circle
 * it now touches joins it, until no two pins of the circle touch. A pin that
 * touches none, and a pin on its own, is drawn on its point.
 */
export function spreadPlaced(placed: readonly PlacedPin[]): Map<string, { x: number; y: number }> {
  // Which spread each pin is in, by the index of the spread's first pin; each pin starts in its own.
  const spreadOf = placed.map((_, i) => i)
  const drawnAt = () => {
    const members = new Map<number, number[]>()
    spreadOf.forEach((s, i) => members.set(s, [...(members.get(s) ?? []), i]))
    const at = placed.map((p) => ({ x: p.x, y: p.y }))
    for (const ids of members.values()) {
      if (ids.length < 2) continue
      const mx = ids.reduce((sum, i) => sum + placed[i].x, 0) / ids.length
      const my = ids.reduce((sum, i) => sum + placed[i].y, 0) / ids.length
      ids.forEach((i, index) => {
        const { dx, dy } = spreadOffset({ index, count: ids.length })
        at[i] = { x: mx + dx, y: my + dy }
      })
    }
    return at
  }
  // Each pass joins two spreads, so there are fewer than as many passes as pins.
  for (;;) {
    const at = drawnAt()
    let pair: [number, number] | null = null
    for (let i = 0; i < placed.length && !pair; i++) {
      for (let j = i + 1; j < placed.length && !pair; j++) {
        const sameCircle = placed[i].opened !== null && placed[i].opened === placed[j].opened
        if (sameCircle && spreadOf[i] !== spreadOf[j] && touch(at[i], at[j])) pair = [i, j]
      }
    }
    if (!pair) return new Map(placed.map((p, i) => [p.id, at[i]]))
    const [keep, gone] = [Math.min(spreadOf[pair[0]], spreadOf[pair[1]]), Math.max(spreadOf[pair[0]], spreadOf[pair[1]])]
    spreadOf.forEach((s, i) => { if (s === gone) spreadOf[i] = keep })
  }
}

/** Where a point sits on the stand-in map, as percentages of its width and height across the whole-state view, kept in from the edges, and further from the top, since a pin stands up from its point. */
export function standInPlace(lat: number, lng: number): { x: number; y: number } {
  const { south, west, north, east } = LOUISIANA_BOUNDS
  const clamp = (n: number, low: number) => Math.min(96, Math.max(low, n))
  return { x: clamp(((lng - west) / (east - west)) * 100, 4), y: clamp(((north - lat) / (north - south)) * 100, 14) }
}

/** What the Clubs directory passes the map (LCAMap's mode "directory"), and only it. */
export interface DirectoryMapProps {
  mode: 'directory'
  /** The pins, in the list's order (pinsInOrder). */
  pins: MapPin[]
  /** The club whose pin was pressed, or null. */
  selectedId: string | null
  /** The club whose card has the pointer over it or the focus, whose pin is lifted, or null. */
  liftedId: string | null
  /** A pin was pressed (its club's id), or the map went back to the whole state (null). */
  onSelect: (id: string | null) => void
  height?: number | string
  /** Where the map looks once the page knows a place (WS09 step 34), or null for the whole state. */
  focus?: MapFocus | null
}

/**
 * A place the map moves to: the place's point first, then the points of the
 * clubs nearest it, which the map frames together, so the nearest clubs are
 * in sight. The key changes each time a place is taken, even the same one
 * again, so the map moves once for each.
 */
export interface MapFocus {
  key: string
  points: ReadonlyArray<{ lat: number; lng: number }>
}

/** The closest the map comes in on a place, so a place with one club near it is not drawn street by street. */
export const PLACE_ZOOM = 11

/** The box round a place and its nearest clubs, as the map frames it. */
export function focusBounds(points: MapFocus['points']): { south: number; west: number; north: number; east: number } {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return { south: Math.min(...lats), west: Math.min(...lngs), north: Math.max(...lats), east: Math.max(...lngs) }
}

/** What draws the directory's map: Google's map with a maps key, the stand-in in the accessibility test build when a page asks for it, or nothing. */
export type MapSource = 'maps' | 'stand-in' | null

/** The flag a browser test sets on the window before the page loads to ask the accessibility test build for the stand-in map. */
export const STAND_IN_FLAG = 'lcaMapStandIn'

/**
 * Where the directory's map comes from. With a maps key, Google's map. With
 * none, no map at all, and the list stands alone; but the accessibility test
 * build (vite build --mode a11y), which never has a key, draws the stand-in
 * when the page asks for it by STAND_IN_FLAG, so its browser tests can press
 * the pins without the provider's script. The mode is written out as a
 * literal, so every other build drops the stand-in's branch.
 */
export function mapSource(): MapSource {
  if (import.meta.env.VITE_GOOGLE_MAPS_API_KEY) return 'maps'
  if (import.meta.env.MODE === 'a11y' && typeof window !== 'undefined' && (window as unknown as Record<string, unknown>)[STAND_IN_FLAG] === true) return 'stand-in'
  return null
}

/**
 * The selected pin's ring: the light look's gold ink, kept in every look
 * because the map under it stays light in every look, as the other light
 * islands keep their words (4.46:1 on the map's paper, 3.36:1 on its water).
 * Brand gold is never drawn on the map: 1.98:1 on its paper.
 */
export const PIN_RING = '#866a1e'
