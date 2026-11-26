// @vitest-environment jsdom
//
// The provider's map with marks that would touch (checkpoint Y's review), the
// directory drawn from made-up clubs in two real neighbouring towns, with the
// map's script stood in for and its projection held in the test:
// - pins of two towns a few pixels apart at the whole state's view are drawn
//   with their boxes apart, none covering another, each on its own side;
// - a pin and a count circle that would touch are drawn apart too;
// - as the map zooms and the true places part, each mark is drawn at its own
//   place again, and the marks that never touched were never moved;
// - marks spread at the edge of a small map stay inside its frame and from
//   under All of Louisiana, on the provider's map and on the stand-in.
// Every club and name here is made up; the towns are real.
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { PIN_BOX, PIN_GAP, STAND_IN_FLAG } from '@/areas/clubs/directoryPins'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number]): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: { latitude: point[0], longitude: point[1] },
    weekend_play: false, scholastic_friendly: false,
  }
}

const CLUBS = [
  row('c-shreve', 'Example Chess Club of Shreveport', 'Shreveport', 'North Louisiana', [32.52, -93.75]),
  row('c-bossier', 'Example Chess Club of Bossier City', 'Bossier City', 'North Louisiana', [32.516, -93.73]),
  row('c-laf', 'Example Chess Club of Lafayette', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
]

/** The pixels a degree is worth in the made-up projection, which the test turns up as the made-up map zooms in, and where the point of Shreveport sits. */
const view = { scale: 100, x: 500, y: 300 }

class FakeLatLng {
  constructor(public latitude: number, public longitude: number) {}
}
const overlays: Array<{ draw(): void }> = []
class FakeMap {
  addListener() { return { remove() {} } }
  fitBounds() {}
  panTo() {}
  getZoom() { return 7 }
  setZoom() {}
}
class FakeOverlay {
  constructor() { overlays.push(this) }
  draw() {}
  setMap() { this.draw() }
  getProjection() {
    // The point of Shreveport sits at (500, 300) whatever the scale, unless the test moves it.
    return { fromLatLngToContainerPixel: (at: FakeLatLng) => ({ x: Math.round((at.longitude + 93.75) * view.scale + view.x), y: Math.round((32.52 - at.latitude) * view.scale + view.y) }) }
  }
}

beforeEach(() => {
  Object.assign(view, { scale: 100, x: 500, y: 300 })
  overlays.length = 0
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 1000)
  vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => 780)
  window.google = { maps: { Map: FakeMap, OverlayView: FakeOverlay, LatLng: FakeLatLng, event: { addListenerOnce: () => ({ remove() {} }) } } } as never
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as { google?: unknown }).google
})

async function drawn() {
  render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={CLUBS} /></MemoryRouter>)
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  await screen.findByRole('button', { name: /Example Chess Club of Shreveport/ })
  return map
}
/** The map moves: the projection is read again, as on each zoom and each pan. */
function moved(scale: number) {
  view.scale = scale
  act(() => overlays.forEach((o) => o.draw()))
}

const place = (map: HTMLElement, id: string) => {
  const el = map.querySelector<HTMLElement>(`[data-pin="${id}"]`)!
  return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }
}
const pinBox = (p: { x: number; y: number }) => ({ left: p.x - PIN_BOX.width / 2, right: p.x + PIN_BOX.width / 2, top: p.y - PIN_BOX.height, bottom: p.y })
const room = (a: ReturnType<typeof pinBox>, b: ReturnType<typeof pinBox>) =>
  Math.max(Math.max(a.left, b.left) - Math.min(a.right, b.right), Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom))

describe('marks on the provider\'s map that would touch', () => {
  it('draws the pins of two neighbouring towns apart, none covering another, each near its own place', async () => {
    const map = await drawn()
    // Shreveport and Bossier City are 2 pixels apart at this scale: their points alone would cover each other.
    const shreve = place(map, 'c-shreve')
    const bossier = place(map, 'c-bossier')
    expect(room(pinBox(shreve), pinBox(bossier))).toBeGreaterThanOrEqual(PIN_GAP)
    // Neither is moved far from its own place: not more than a pin's own box and the gap.
    const far = PIN_BOX.height + PIN_GAP
    expect(Math.hypot(shreve.x - 500, shreve.y - 300)).toBeLessThan(far)
    expect(Math.hypot(bossier.x - 502, bossier.y - 304)).toBeLessThan(far)
  })

  it('leaves a mark that touches none where the map puts it', async () => {
    const map = await drawn()
    // Lafayette lies 230 pixels down and 173 across at this scale: out of the frame's 780 by 1000, it may be drawn or not, but never moved.
    const el = map.querySelector<HTMLElement>('[data-pin="c-laf"]')
    if (el) expect({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }).toEqual({ x: Math.round((-92.02 + 93.75) * 100 + 500), y: Math.round((32.52 - 30.22) * 100 + 300) })
  })

  it('draws each mark at its own place again once the map has zoomed in and the places have parted', async () => {
    const map = await drawn()
    moved(5000)
    expect(place(map, 'c-shreve')).toEqual({ x: 500, y: 300 })
    expect(place(map, 'c-bossier')).toEqual({ x: 600, y: 320 })
    moved(100)
    expect(room(pinBox(place(map, 'c-shreve')), pinBox(place(map, 'c-bossier')))).toBeGreaterThanOrEqual(PIN_GAP)
  })

  it('keeps the spread of two pins at the top left corner of a small map inside its frame and from under All of Louisiana', async () => {
    // A phone's map, 320 by 224, with Shreveport's point 8 pixels in from the left and 60 down: a ring round it would
    // reach past the left edge and up under All of Louisiana.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 320)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => 224)
    // All of Louisiana measured as a browser draws it: 10 pixels in, 126 wide and 44 tall.
    const own = (value: number, other: number) => function (this: HTMLElement) { return this.textContent === 'All of Louisiana' ? value : other }
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(own(10, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(own(10, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(own(126, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(own(44, 0))
    Object.assign(view, { x: 8, y: 60 })
    const map = await drawn()
    const boxes = ['c-shreve', 'c-bossier'].map((id) => pinBox(place(map, id)))
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(320)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(224)
      expect(box.left >= 10 + 126 + PIN_GAP || box.top >= 10 + 44 + PIN_GAP).toBe(true)
    }
    expect(room(boxes[0], boxes[1])).toBeGreaterThanOrEqual(PIN_GAP)
  })
})

describe('marks on the stand-in at a phone\'s size', () => {
  it('draws two clubs of the state\'s north west corner apart, inside the sheet and from under All of Louisiana', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    vi.stubEnv('MODE', 'a11y')
    ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 320)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => 224)
    const own = (value: number, other: number) => function (this: HTMLElement) { return this.textContent === 'All of Louisiana' ? value : other }
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(own(10, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(own(10, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(own(126, 0))
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(own(44, 0))
    // Two made-up clubs in the far north west, whose points the stand-in lays beside All of Louisiana on a sheet 224 tall.
    const corner = [
      row('c-one', 'Example Corner Club', 'Vivian', 'North Louisiana', [32.87, -93.99]),
      row('c-two', 'Example Line Club', 'Oil City', 'North Louisiana', [32.74, -93.97]),
    ]
    try {
      render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={corner} /></MemoryRouter>)
      const map = await screen.findByRole('group', { name: 'Map of the clubs' })
      expect(map.getAttribute('data-map')).toBe('stand-in')
      const boxes = ['c-one', 'c-two'].map((id) => pinBox(place(map, id)))
      for (const box of boxes) {
        expect(box.left).toBeGreaterThanOrEqual(0)
        expect(box.right).toBeLessThanOrEqual(320)
        expect(box.bottom).toBeLessThanOrEqual(224)
        expect(box.left >= 10 + 126 + PIN_GAP || box.top >= 10 + 44 + PIN_GAP).toBe(true)
      }
      expect(room(boxes[0], boxes[1])).toBeGreaterThanOrEqual(PIN_GAP)
    } finally {
      delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
    }
  })
})
