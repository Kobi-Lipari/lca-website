// @vitest-environment jsdom
//
// The club map's props that only the new club page passes (WS09 step 21),
// and today's drawing with none passed, against a stand-in for the maps
// script that records what the map is asked to draw. Today's club page's
// map is made once, with one pin at the club's spot and its directions
// link, however often the page draws again; the Clubs page's pins are
// rebuilt only when the set of clubs or the frame changes, never for a new
// array of the same clubs, and the visitor's dot is drawn for their place.
// The new page's places are drawn as plain pins named by their places, with
// both in view and no directions link on the map; with no maps key the new
// page's map draws nothing, where today's pages draw the setup hint. Every
// name and club here is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** What the stand-in maps script was asked to make. */
const made = { maps: 0, markers: [] as Array<{ title?: string; position: unknown; setMapNull: boolean }>, fits: 0, infoOpens: 0 }

class FakeMap {
  constructor() { made.maps += 1 }
  fitBounds() { made.fits += 1 }
  panTo() {}
  setZoom() {}
  getZoom() { return 7 }
}
class FakeMarker {
  entry: { title?: string; position: unknown; setMapNull: boolean }
  constructor(options: { title?: string; position: unknown }) {
    this.entry = { title: options.title, position: options.position, setMapNull: false }
    made.markers.push(this.entry)
  }
  setMap(map: unknown) { if (map === null) this.entry.setMapNull = true }
  addListener() {}
  setIcon() {}
  setZIndex() {}
  getPosition() { return this.entry.position }
}
class FakeBounds {
  extend() {}
  getCenter() { return { lat: 0, lng: 0 } }
}
class FakeInfo {
  addListener() {}
  close() {}
  setContent() {}
  open() { made.infoOpens += 1 }
}
const fakeMaps = {
  Map: FakeMap, Marker: FakeMarker, LatLngBounds: FakeBounds, InfoWindow: FakeInfo,
  Size: class { constructor(public w: number, public h: number) {} }, Point: class { constructor(public x: number, public y: number) {} },
  event: { addListenerOnce: () => ({ remove: () => {} }) },
}

const { LCAMap } = await import('@/areas/clubs/components/LCAMap')

beforeEach(() => {
  Object.assign(made, { maps: 0, markers: [], fits: 0, infoOpens: 0 })
  vi.stubGlobal('google', { maps: fakeMaps })
  window.google = { maps: fakeMaps } as never
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  delete window.google
})

describe('today\'s pages, which pass none of the new props', () => {
  it('makes one map for a club\'s page, with one pin at its spot and its directions link, however often the page draws', () => {
    const view = render(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 30.1, lng: -91.2 }} height={200} />)
    view.rerender(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 30.1, lng: -91.2 }} height={200} />)
    view.rerender(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 30.1, lng: -91.2 }} height={200} />)
    expect(made.maps).toBe(1)
    expect(made.markers.map((m) => [m.title, m.position])).toEqual([['Example Chess Club', { lat: 30.1, lng: -91.2 }]])
    expect(screen.getByRole('link', { name: 'Get directions ↗' }).getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,-91.2')
  })

  it('rebuilds the Clubs page\'s pins only when the set of clubs changes, not for a new array of the same clubs', () => {
    const clubs = () => [
      { id: 'c-one', name: 'Example Chess Club', latitude: 30.1, longitude: -91.2 },
      { id: 'c-two', name: 'Example Knights Club', latitude: 30.4, longitude: -91.1 },
    ]
    const view = render(<LCAMap mode="all" clubs={clubs()} frame="clubs" />)
    expect(made.maps).toBe(1)
    expect(made.markers).toHaveLength(2)
    view.rerender(<LCAMap mode="all" clubs={clubs()} frame="clubs" />)
    expect(made.markers).toHaveLength(2)
    view.rerender(<LCAMap mode="all" clubs={clubs().slice(0, 1)} frame="clubs" />)
    expect(made.markers).toHaveLength(3)
    expect(made.markers.slice(0, 2).every((m) => m.setMapNull)).toBe(true)
    // A club selected opens its card once; the visitor's place draws their dot.
    view.rerender(<LCAMap mode="all" clubs={clubs().slice(0, 1)} frame="clubs" selectedId="c-one" />)
    expect(made.infoOpens).toBe(1)
    view.rerender(<LCAMap mode="all" clubs={clubs().slice(0, 1)} frame="clubs" selectedId="c-one" userLocation={{ lat: 30.2, lng: -91.0 }} />)
    view.rerender(<LCAMap mode="all" clubs={clubs().slice(0, 1)} frame="clubs" selectedId="c-one" userLocation={{ lat: 30.2, lng: -91.0 }} />)
    expect(made.markers.filter((m) => m.title === 'You are here').map((m) => m.position)).toEqual([{ lat: 30.2, lng: -91.0 }])
    expect(made.maps).toBe(1)
  })

  it('draws the setup hint where there is no maps key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    render(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 30.1, lng: -91.2 }} />)
    expect(screen.getByText('Add VITE_GOOGLE_MAPS_API_KEY to .env.local to enable the map.')).toBeTruthy()
  })
})

describe('the new club page\'s props', () => {
  it('draws each place as a plain pin named by its place, both in view, and no directions link on the map', () => {
    const places = [{ name: 'Example Library', lat: 30.1, lng: -91.2 }, { name: 'Example Cafe', lat: 30.2, lng: -91.3 }]
    render(<LCAMap mode="single" clubName="Example Chess Club" places={places} directions={false} quietWithoutKey height={260} />)
    expect(made.maps).toBe(1)
    expect(made.markers.map((m) => [m.title, m.position])).toEqual([['Example Library', { lat: 30.1, lng: -91.2 }], ['Example Cafe', { lat: 30.2, lng: -91.3 }]])
    expect(made.fits).toBe(1)
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('draws nothing in the map\'s place where there is no maps key', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const view = render(<LCAMap mode="single" clubName="Example Chess Club" places={[{ name: 'Example Library', lat: 30.1, lng: -91.2 }]} directions={false} quietWithoutKey />)
    expect(view.container.innerHTML).toBe('')
  })
})
