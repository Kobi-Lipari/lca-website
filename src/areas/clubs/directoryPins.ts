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
//     it is opened; an opened circle draws each of its clubs, and it stays
//     open while any club it held is drawn.
//   - Marks whose boxes would touch where the map puts them, pins and circles
//     alike, are spread round the middle of their points, so no mark covers
//     another and each can be pressed (since checkpoint Y's review: before it,
//     only an opened circle's pins), and kept inside the map's frame and
//     from under All of Louisiana, laid in rows where a ring would not fit,
//     so each can be seen. A mark that touches none is drawn on its
//     point, and as the map zooms in and the points part, each mark goes back
//     to its own point.
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
 * unless one of its clubs is among the opened (the clubs of each circle the
 * visitor opened, by id), when each of its pins is drawn with the group's
 * key. A circle is known by its clubs, not its key, so it stays open while a
 * filter takes away the club that came first in it.
 */
export function marksFor(pins: readonly MapPin[], opened: ReadonlySet<string>): MapMark[] {
  const groupOf = new Map<string, PinGroup>()
  for (const group of groupsOf(pins)) for (const pin of group.pins) groupOf.set(pin.id, group)
  const marks: MapMark[] = []
  const drawn = new Set<string>()
  for (const pin of pins) {
    const group = groupOf.get(pin.id)!
    if (group.pins.length > 1 && !group.pins.some((member) => opened.has(member.id))) {
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

/** A count circle at rest, in pixels, wide by tall: its box is round its point. */
export const CIRCLE_BOX = { width: 34, height: 34 } as const

/** The room, in pixels, kept between the boxes of two marks drawn near each other. */
export const PIN_GAP = 2

/** The least distance, in pixels, a spread mark is drawn from the middle of its points. */
export const SPREAD_PX = 22

/**
 * How far from the middle the marks of a spread are drawn: far enough that two next to each other, on any slant, keep
 * PIN_GAP between their boxes; boxes the size of a pin's unless a larger box is given.
 */
export function spreadRadius(count: number, box: { width: number; height: number } = PIN_BOX): number {
  if (count < 2) return 0
  const slant = Math.hypot(box.width + PIN_GAP, box.height + PIN_GAP)
  return Math.max(SPREAD_PX, Math.ceil(slant / (2 * Math.sin(Math.PI / count))))
}

/** A spread pin's offset from the middle of its points, in pixels: round the middle, the first above it. */
export function spreadOffset(spread: Spread | null): { dx: number; dy: number } {
  if (!spread) return { dx: 0, dy: 0 }
  const radius = spreadRadius(spread.count)
  const angle = (2 * Math.PI * spread.index) / spread.count - Math.PI / 2
  return { dx: Math.round(radius * Math.cos(angle)), dy: Math.round(radius * Math.sin(angle)) }
}

/**
 * A mark's point where the map puts it, in pixels from the map's top left corner: a pin's (its box stands up from it)
 * or, with `circle`, a count circle's (its box is round it). `opened` is the opened circle a pin was drawn from, or null.
 */
export interface PlacedPin {
  id: string
  opened: string | null
  x: number
  y: number
  circle?: boolean
}

/** A mark's box: its middle and its size, in pixels, from its point. */
function boxOf(mark: { x: number; y: number; circle?: boolean }) {
  const size = mark.circle ? CIRCLE_BOX : PIN_BOX
  return { cx: mark.x, cy: mark.circle ? mark.y : mark.y - size.height / 2, ...size }
}

/** Whether two boxes would touch: closer than PIN_GAP on both axes. */
function touch(a: ReturnType<typeof boxOf>, b: ReturnType<typeof boxOf>): boolean {
  return Math.abs(a.cx - b.cx) < (a.width + b.width) / 2 + PIN_GAP && Math.abs(a.cy - b.cy) < (a.height + b.height) / 2 + PIN_GAP
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * The map's frame the marks are kept inside, in pixels from its top left
 * corner: its size, and the box of All of Louisiana in its top left corner
 * with PIN_GAP round it (its right and bottom edges), which no mark is drawn
 * under, or null before it has been measured.
 */
export interface MarkFrame {
  width: number
  height: number
  clear: { right: number; bottom: number } | null
}

/** How far to move a run from lo to hi so it lies between min and max: into it from whichever side it leaves, or to the middle when it is the longer. */
function shiftInto(lo: number, hi: number, min: number, max: number): number {
  if (hi - lo > max - min) return Math.round((min + max - lo - hi) / 2)
  if (lo < min) return Math.ceil(min - lo)
  if (hi > max) return Math.floor(max - hi)
  return 0
}

/**
 * Where each placed mark is drawn, in pixels. Marks whose boxes would touch,
 * pins and circles alike, are drawn round the middle of their boxes, at the
 * least distance that keeps PIN_GAP between neighbours, the first place
 * above the middle: each takes the place round the ring nearest its own, in
 * the order of their slant from the middle (by id where they share one
 * point), so the answer never depends on the order the marks came in. With
 * the map's frame given, a ring that would reach past its edge, or under All
 * of Louisiana, is moved in the least way that clears both; one too large for
 * the frame is laid instead in rows round the same middle, each mark in the
 * row and the place nearest its own; and a mark on its own that would reach
 * past the edge or under All of Louisiana is moved in the same way. The
 * marks are looked at again, and any mark a spread now touches joins it,
 * until no two marks touch. A mark that touches none, inside the frame, is
 * drawn on its point.
 */
export function spreadPlaced(placed: readonly PlacedPin[], frame: MarkFrame | null = null): Map<string, { x: number; y: number }> {
  // The marks in one order, by id, whatever order they came in.
  const marks = [...placed].sort(byId)
  const boxes = marks.map(boxOf)
  const sidesOf = (ids: number[], places: Map<number, { cx: number; cy: number }>) => {
    const sides = ids.map((i) => {
      const p = places.get(i)!
      return { left: p.cx - boxes[i].width / 2, right: p.cx + boxes[i].width / 2, top: p.cy - boxes[i].height / 2, bottom: p.cy + boxes[i].height / 2 }
    })
    return { sides, left: Math.min(...sides.map((s) => s.left)), right: Math.max(...sides.map((s) => s.right)), top: Math.min(...sides.map((s) => s.top)), bottom: Math.max(...sides.map((s) => s.bottom)) }
  }
  // The marks' boxes at these middles, moved as one into the frame where one is given, and then from under All of
  // Louisiana, down or across, whichever is the shorter move that stays in the frame (down where they tie).
  const intoFrame = (ids: number[], places: Map<number, { cx: number; cy: number }>) => {
    if (!frame) return places
    const all = sidesOf(ids, places)
    let dx = shiftInto(all.left, all.right, 0, frame.width)
    let dy = shiftInto(all.top, all.bottom, 0, frame.height)
    const clear = frame.clear
    if (clear) {
      const under = all.sides.some((s) => s.left + dx < clear.right && s.top + dy < clear.bottom)
      if (under) {
        const down = Math.ceil(clear.bottom - (all.top + dy))
        const across = Math.ceil(clear.right - (all.left + dx))
        const downFits = all.bottom + dy + down <= frame.height
        const acrossFits = all.right + dx + across <= frame.width
        if (downFits && (!acrossFits || down <= across)) dy += down
        else if (acrossFits) dx += across
        else dy += down
      }
    }
    return new Map([...places].map(([i, p]) => [i, { cx: p.cx + dx, cy: p.cy + dy }]))
  }
  // Whether the boxes at these middles lie wholly inside the frame and none under All of Louisiana.
  const inside = (ids: number[], places: Map<number, { cx: number; cy: number }>) => {
    if (!frame) return true
    return sidesOf(ids, places).sides.every((s) => s.left >= 0 && s.right <= frame.width && s.top >= 0 && s.bottom <= frame.height
      && !(frame.clear && s.left < frame.clear.right && s.top < frame.clear.bottom))
  }
  // Which spread each mark is in, by the index of the spread's first mark; each mark starts in its own.
  const spreadOf = marks.map((_, i) => i)
  const drawnAt = () => {
    const members = new Map<number, number[]>()
    spreadOf.forEach((s, i) => members.set(s, [...(members.get(s) ?? []), i]))
    const at = boxes.map((b) => ({ ...b }))
    for (const ids of members.values()) {
      if (ids.length < 2) {
        // A mark on its own: on its point, unless that would put it past the frame's edge or under All of Louisiana.
        const own = new Map([[ids[0], { cx: boxes[ids[0]].cx, cy: boxes[ids[0]].cy }]])
        if (!inside(ids, own)) at[ids[0]] = { ...boxes[ids[0]], ...intoFrame(ids, own).get(ids[0])! }
        continue
      }
      const n = ids.length
      const mx = ids.reduce((sum, i) => sum + boxes[i].cx, 0) / n
      const my = ids.reduce((sum, i) => sum + boxes[i].cy, 0) / n
      const width = Math.max(...ids.map((i) => boxes[i].width))
      const height = Math.max(...ids.map((i) => boxes[i].height))
      const radius = spreadRadius(n, { width, height })
      // The slant of each from the middle, from straight up and round as a clock goes; none for a mark at the middle.
      const slant = (i: number) => {
        const dx = boxes[i].cx - mx
        const dy = boxes[i].cy - my
        return Math.hypot(dx, dy) < 0.5 ? -1 : (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)
      }
      const round = [...ids].sort((a, b) => slant(a) - slant(b) || byId(marks[a], marks[b]))
      const place = (k: number) => {
        const angle = (2 * Math.PI * k) / n - Math.PI / 2
        return { cx: mx + Math.round(radius * Math.cos(angle)), cy: my + Math.round(radius * Math.sin(angle)) }
      }
      // The turn of the ring that keeps the marks nearest their own boxes; the least turn of those that tie.
      let best = 0
      let bestCost = Infinity
      for (let turn = 0; turn < n; turn++) {
        const cost = round.reduce((sum, i, k) => {
          const p = place((k + turn) % n)
          return sum + (p.cx - boxes[i].cx) ** 2 + (p.cy - boxes[i].cy) ** 2
        }, 0)
        if (cost < bestCost - 1e-9) {
          best = turn
          bestCost = cost
        }
      }
      let places = intoFrame(ids, new Map(round.map((i, k) => [i, place((k + best) % n)])))
      if (!inside(ids, places)) places = intoFrame(ids, rowsFor(ids, mx, my, width, height))
      for (const [i, p] of places) at[i] = { ...boxes[i], ...p }
    }
    return at
  }
  // A spread too large for the frame as a ring, laid in rows round its middle, in the shape that fits the frame below
  // All of Louisiana with the most room to spare (where none fits, the one that reaches least past it), the marks taken
  // by their own height into rows and by their own place across each row.
  const rowsFor = (ids: number[], mx: number, my: number, width: number, height: number) => {
    const n = ids.length
    const across = width + PIN_GAP
    const down = height + PIN_GAP
    const room = { width: frame!.width, height: frame!.height - (frame!.clear?.bottom ?? 0) }
    let cols = n
    let best = Infinity
    for (let c = 1; c <= n; c++) {
      const w = c * across - PIN_GAP
      const h = Math.ceil(n / c) * down - PIN_GAP
      const over = Math.max(0, w - room.width) + Math.max(0, h - room.height)
      const cost = over > 0 ? 1e6 + over : Math.max(w / room.width, h / room.height)
      if (cost < best - 1e-9) {
        best = cost
        cols = c
      }
    }
    const lines = Math.ceil(n / cols)
    const byHeight = [...ids].sort((a, b) => boxes[a].cy - boxes[b].cy || boxes[a].cx - boxes[b].cx || byId(marks[a], marks[b]))
    const places = new Map<number, { cx: number; cy: number }>()
    for (let r = 0; r < lines; r++) {
      const row = byHeight.slice(r * cols, (r + 1) * cols).sort((a, b) => boxes[a].cx - boxes[b].cx || byId(marks[a], marks[b]))
      const left = Math.round(mx - ((row.length - 1) * across) / 2)
      const top = Math.round(my - ((lines - 1) * down) / 2)
      row.forEach((i, k) => places.set(i, { cx: left + k * across, cy: top + r * down }))
    }
    return places
  }
  // Each pass joins two spreads, so there are fewer than as many passes as marks.
  for (;;) {
    const at = drawnAt()
    let pair: [number, number] | null = null
    for (let i = 0; i < marks.length && !pair; i++) {
      for (let j = i + 1; j < marks.length && !pair; j++) {
        if (spreadOf[i] !== spreadOf[j] && touch(at[i], at[j])) pair = [i, j]
      }
    }
    if (!pair) {
      // Back from each box's middle to the mark's own point.
      return new Map(marks.map((m, i) => [m.id, { x: at[i].cx, y: m.circle ? at[i].cy : at[i].cy + PIN_BOX.height / 2 }]))
    }
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
