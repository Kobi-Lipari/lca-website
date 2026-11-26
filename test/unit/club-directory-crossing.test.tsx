// @vitest-environment jsdom
//
// The Clubs directory as one tree (checkpoint Y's review), beside
// test/unit/club-directory-phone-edges.test.tsx: when the window crosses
// the wide layout's width, whichever way and however often, the field, Near
// me, the orders, Filters and the map keep their place and their elements.
// - the field's element, the Filters button's and the map's frame are the
//   same elements after a crossing each way, and the focus in the field is
//   kept;
// - a device that has not answered, a crossing, then its answer: the list
//   orders nearest first and no "Finding" note is left;
// - an open Filters closes at a crossing, with the focus on the Filters
//   button when it was in the choices, and left in the field when it was
//   there with the wide panel open;
// - with the provider's map stood in for, one map is made across two
//   crossings, and an opened circle stays open;
// - the list with no map crosses without losing the focus in the field;
// - the sheet starts at its low rest after a crossing.
// Every club and name here is made up; the places are real towns.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import * as words from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import { NARROW_QUERY } from '@/areas/clubs/narrowScreen'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number] | null): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Four made-up clubs: two in one town, near Baton Rouge, and two far from it. */
const CLUBS = [
  row('far', 'Example Far Club', 'Shreveport', 'North Louisiana', [32.52, -93.75]),
  row('mid', 'Example Middle Club', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
  row('near', 'Example Near Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15]),
  row('next', 'Example Next Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.41, -91.1]),
]

type Listener = () => void
let listeners: Set<Listener>
let narrow: boolean
const originalMatchMedia = window.matchMedia
const originalScroll = Element.prototype.scrollIntoView
const realGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')

beforeEach(() => {
  narrow = true
  listeners = new Set()
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({
    get matches() { return query === NARROW_QUERY ? narrow : false },
    media: query,
    addEventListener: (_t: string, fn: Listener) => { if (query === NARROW_QUERY) listeners.add(fn) },
    removeEventListener: (_t: string, fn: Listener) => { listeners.delete(fn) },
  })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
  Element.prototype.scrollIntoView = originalScroll
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
  if (realGeolocation) Object.defineProperty(navigator, 'geolocation', realGeolocation)
})

/** Moves the window across the wide layout's width. */
function cross(toNarrow: boolean) {
  narrow = toNarrow
  act(() => listeners.forEach((fn) => fn()))
}

function draw(url = '/clubs') {
  return render(<MemoryRouter initialEntries={[url]}><ClubDirectory clubs={CLUBS} /></MemoryRouter>)
}

async function drawWithStandIn(url = '/clubs') {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = draw(url)
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const field = () => screen.getByRole('textbox', { name: words.FIELD_LABEL })
const filters = () => screen.getByRole('button', { name: /^Filters/ })
const layout = (view: ReturnType<typeof render>) => (view.container.querySelector('[data-layout="phone"]') ? 'phone' : 'wide')
const cardIds = () => [...document.querySelectorAll('[data-card]')].map((a) => a.getAttribute('data-card'))

describe('a crossing of the width', () => {
  it('keeps the field, the Filters button and the map\'s frame as the same elements, each way', async () => {
    const { view, map } = await drawWithStandIn()
    const [theField, theButton, theFrame] = [field(), filters(), map]
    expect(layout(view)).toBe('phone')
    cross(false)
    expect(layout(view)).toBe('wide')
    expect(field()).toBe(theField)
    expect(filters()).toBe(theButton)
    expect(screen.getByRole('group', { name: 'Map of the clubs' })).toBe(theFrame)
    cross(true)
    expect(layout(view)).toBe('phone')
    expect(field()).toBe(theField)
    expect(filters()).toBe(theButton)
    expect(screen.getByRole('group', { name: 'Map of the clubs' })).toBe(theFrame)
  })

  it('keeps the focus in the field, and on Near me and an order, whichever way it crosses', async () => {
    await drawWithStandIn()
    act(() => field().focus())
    cross(false)
    expect(document.activeElement).toBe(field())
    cross(true)
    expect(document.activeElement).toBe(field())
    const aToZ = screen.getByRole('button', { name: words.A_TO_Z })
    act(() => aToZ.focus())
    cross(false)
    expect(document.activeElement).toBe(aToZ)
    const nearMe = screen.getByRole('button', { name: words.NEAR_ME })
    act(() => nearMe.focus())
    cross(true)
    expect(document.activeElement).toBe(nearMe)
  })

  it('answers a device that had not answered before the crossing: nearest first, and no Finding note left', async () => {
    const asked: PositionCallback[] = []
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition: (ok: PositionCallback) => { asked.push(ok) }, watchPosition() {}, clearWatch() {} },
      configurable: true,
    })
    const { view } = await drawWithStandIn()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(screen.getByRole('status').textContent).toContain(words.FINDING)
    cross(false)
    cross(true)
    act(() => asked[0]({ coords: { latitude: 30.4517, longitude: -91.1288, accuracy: 20 }, timestamp: 0 } as unknown as GeolocationPosition))
    expect(view.container.querySelector('[data-slot="club-directory"]')?.getAttribute('data-address')).toMatch(/^\?near=\d{5}$/)
    expect(cardIds().slice(0, 2)).toEqual(['near', 'next'])
    expect(view.container.querySelector('[data-note="finding"]')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toContain(words.FINDING)
  })

  it('closes an open Filters at a crossing, with the focus on the Filters button, each way', async () => {
    await drawWithStandIn()
    cross(false)
    fireEvent.click(filters())
    expect(filters().getAttribute('aria-expanded')).toBe('true')
    cross(true)
    expect(filters().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog', { name: words.FILTERS_TITLE })).toBeNull()
    expect(document.activeElement).toBe(filters())
    fireEvent.click(filters())
    expect(screen.getByRole('dialog', { name: words.FILTERS_TITLE })).toBeTruthy()
    cross(false)
    expect(filters().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog', { name: words.FILTERS_TITLE })).toBeNull()
    expect(document.activeElement).toBe(filters())
  })

  it('leaves the focus in the field when the wide Filters panel is open and the window crosses, and gives it to the button from inside the panel', async () => {
    await drawWithStandIn()
    cross(false)
    fireEvent.click(filters())
    fireEvent.click(screen.getByRole('button', { name: /North Louisiana/ }))
    expect(filters().getAttribute('aria-expanded')).toBe('true')
    // The panel stays open while the visitor types in the field.
    act(() => field().focus())
    fireEvent.change(field(), { target: { value: 'Exam' } })
    cross(true)
    expect(filters().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(field())
    // With the focus on a choice in the panel, the crossing gives it to the Filters button.
    cross(false)
    fireEvent.click(filters())
    const chip = screen.getByRole('button', { name: /North Louisiana/ })
    act(() => chip.focus())
    cross(true)
    expect(document.activeElement).toBe(filters())
  })

  it('starts the sheet at its low rest after a crossing', async () => {
    await drawWithStandIn()
    const sheet = () => screen.getByRole('region', { name: words.LIST_SHEET })
    fireEvent.click(within(sheet()).getByRole('button', { name: words.SHOW_LIST }))
    expect(sheet().getAttribute('data-sheet')).toBe('full')
    cross(false)
    cross(true)
    expect(sheet().getAttribute('data-sheet')).toBe('low')
  })

  it('crosses the list with no map without losing the focus in the field', () => {
    draw()
    act(() => field().focus())
    const theField = field()
    cross(false)
    expect(field()).toBe(theField)
    expect(document.activeElement).toBe(theField)
    cross(true)
    expect(document.activeElement).toBe(theField)
    expect(screen.getByText(words.NO_MAP)).toBeTruthy()
  })
})

describe('a crossing with the provider\'s map', () => {
  const made = { maps: 0 }
  class FakeLatLng {
    constructor(public latitude: number, public longitude: number) {}
  }
  class FakeMap {
    zoom = 7
    constructor() { made.maps += 1 }
    addListener() { return { remove() {} } }
    fitBounds() {}
    panTo() {}
    getZoom() { return this.zoom }
    setZoom(z: number) { this.zoom = z }
  }
  class FakeOverlay {
    draw() {}
    setMap() { this.draw() }
    getProjection() {
      return { fromLatLngToContainerPixel: (at: FakeLatLng) => ({ x: Math.round((at.longitude + 95) * 100), y: Math.round((34 - at.latitude) * 100) }) }
    }
  }

  beforeEach(() => {
    made.maps = 0
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 1000)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => 780)
    window.google = { maps: { Map: FakeMap, OverlayView: FakeOverlay, LatLng: FakeLatLng, event: { addListenerOnce: () => ({ remove() {} }) } } } as never
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
  })
  afterEach(() => {
    delete (window as { google?: unknown }).google
  })

  it('makes one map across two crossings, and an opened circle stays open', async () => {
    const view = draw()
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    expect(map.getAttribute('data-map')).toBe('maps')
    fireEvent.click(await within(map).findByRole('button', { name: '2 clubs in Baton Rouge, show each' }))
    expect(within(map).getByRole('button', { name: 'Example Near Club, Baton Rouge' })).toBeTruthy()
    expect(layout(view)).toBe('phone')
    cross(false)
    cross(true)
    expect(made.maps).toBe(1)
    expect(screen.getByRole('group', { name: 'Map of the clubs' })).toBe(map)
    expect(within(map).getByRole('button', { name: 'Example Near Club, Baton Rouge' })).toBeTruthy()
    expect(within(map).queryByRole('button', { name: '2 clubs in Baton Rouge, show each' })).toBeNull()
  })
})
