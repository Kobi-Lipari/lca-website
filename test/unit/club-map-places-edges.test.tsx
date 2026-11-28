// @vitest-environment jsdom
//
// The club map's edges (WS09 step 21), against a stand-in for the maps
// script that records what the map is asked to draw: one place and two,
// the same places drawn again, places beside a saved location, no places at
// all, the directions link by default, the setup hint, the visitor's dot as
// the visitor's place changes or goes, and a maps script that loads after
// the page has drawn. The three effects that read their props through an
// effect event keep today's drawing: the map is made once when the script
// has loaded, the pins are rebuilt only when the set of clubs or the frame
// changes, and the selected club's card opens when the selection changes.
// Every name and club here is made up.
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MarkerEntry { title?: string; position: unknown; removed: boolean }

const made = {
  maps: [] as Array<{ center: unknown; zoom: unknown }>,
  markers: [] as MarkerEntry[],
  fits: [] as unknown[][],
  infoOpens: 0,
  extended: [] as unknown[],
}

class FakeMap {
  constructor(_el: unknown, options: { center?: unknown; zoom?: unknown }) { made.maps.push({ center: options.center, zoom: options.zoom }) }
  fitBounds(...args: unknown[]) { made.fits.push(args.slice(1)) }
  panTo() {}
  setZoom() {}
  getZoom() { return 7 }
}
class FakeMarker {
  entry: MarkerEntry
  constructor(options: { title?: string; position: unknown }) {
    this.entry = { title: options.title, position: options.position, removed: false }
    made.markers.push(this.entry)
  }
  setMap(map: unknown) { if (map === null) this.entry.removed = true }
  addListener() {}
  setIcon() {}
  setZIndex() {}
  getPosition() { return this.entry.position }
}
class FakeBounds {
  extend(point: unknown) { made.extended.push(point) }
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

const LIBRARY = { name: 'Example Library', lat: 30.1, lng: -91.2 }
const CAFE = { name: 'Example Cafe', lat: 30.2, lng: -91.3 }
const titles = () => made.markers.map((m) => m.title)

beforeEach(() => {
  Object.assign(made, { maps: [], markers: [], fits: [], infoOpens: 0, extended: [] })
  window.google = { maps: fakeMaps } as never
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  delete window.google
  delete (window as { initLCAMap?: unknown }).initLCAMap
  document.querySelectorAll('script[data-lca-maps]').forEach((el) => el.remove())
})

describe('the new club page\'s places', () => {
  it('centre the map on a lone place, with one pin named by it, and no fitting of the view', () => {
    render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY]} directions={false} />)
    expect(made.maps).toHaveLength(1)
    expect(made.maps[0].center).toEqual({ lat: 30.1, lng: -91.2 })
    expect(titles()).toEqual(['Example Library'])
    expect(made.fits).toEqual([])
  })

  it('bring both places into view with room around them, and extend the view to each', () => {
    render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY, CAFE]} directions={false} />)
    expect(titles()).toEqual(['Example Library', 'Example Cafe'])
    expect(made.fits).toEqual([[48]])
    expect(made.extended).toEqual([{ lat: 30.1, lng: -91.2 }, { lat: 30.2, lng: -91.3 }])
  })

  it('draw once, however often the page draws again with a new array of the same places', () => {
    const view = render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY, CAFE]} directions={false} />)
    for (let i = 0; i < 3; i++) view.rerender(<LCAMap mode="single" clubName="Example Chess Club" places={[{ ...LIBRARY }, { ...CAFE }]} directions={false} />)
    expect(made.maps).toHaveLength(1)
    expect(titles()).toEqual(['Example Library', 'Example Cafe'])
    expect(made.fits).toHaveLength(1)
  })

  it('are drawn in place of a saved location, which is not read when places are given', () => {
    render(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 29.9, lng: -90.1 }} places={[LIBRARY]} directions={false} />)
    expect(made.maps[0].center).toEqual({ lat: 30.1, lng: -91.2 })
    expect(made.markers.map((m) => m.position)).toEqual([{ lat: 30.1, lng: -91.2 }])
  })

  it('leave today\'s drawing alone when there are none: the saved location, its one pin and its directions link', () => {
    render(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 29.9, lng: -90.1 }} places={[]} />)
    expect(made.maps[0].center).toEqual({ lat: 29.9, lng: -90.1 })
    expect(titles()).toEqual(['Example Chess Club'])
    expect(screen.getByRole('link', { name: 'Get directions ↗' }).getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=29.9,-90.1')
  })

  it('keep the directions link on the map unless the page asks for none, and then point it at the first place', () => {
    render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY, CAFE]} />)
    expect(screen.getByRole('link', { name: 'Get directions ↗' }).getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,-91.2')
  })

  it('say nothing without a maps key only when the page asks, and give the setup hint to every other page', () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const quiet = render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY]} directions={false} quietWithoutKey />)
    expect(quiet.container.innerHTML).toBe('')
    quiet.unmount()
    render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY]} directions={false} />)
    expect(screen.getByText('Add VITE_GOOGLE_MAPS_API_KEY to .env.local to enable the map.')).toBeTruthy()
  })
})

describe('the visitor\'s dot on the Clubs page', () => {
  const clubs = [
    { id: 'c-one', name: 'Example Chess Club', latitude: 30.1, longitude: -91.2 },
    { id: 'c-two', name: 'Example Knights Club', latitude: 30.4, longitude: -91.1 },
  ]
  const dots = () => made.markers.filter((m) => m.title === 'You are here')

  it('moves with the visitor, takes the old dot away, and goes when the visitor\'s place does', () => {
    const view = render(<LCAMap mode="all" clubs={clubs} frame="clubs" userLocation={{ lat: 30.2, lng: -91.0 }} />)
    expect(dots().map((d) => [d.position, d.removed])).toEqual([[{ lat: 30.2, lng: -91.0 }, false]])
    // The pins are framed with room of 48 and the visitor with the nearest clubs with room of 64.
    const framedForVisitor = () => made.fits.filter(([room]) => room === 64).length
    expect(framedForVisitor()).toBe(1)
    // The same place in a new object changes nothing; the dot and the view stay.
    view.rerender(<LCAMap mode="all" clubs={clubs} frame="clubs" userLocation={{ lat: 30.2, lng: -91.0 }} />)
    expect(dots()).toHaveLength(1)
    expect(framedForVisitor()).toBe(1)
    // A new place takes the old dot away and draws another.
    view.rerender(<LCAMap mode="all" clubs={clubs} frame="clubs" userLocation={{ lat: 30.3, lng: -91.1 }} />)
    expect(dots().map((d) => [d.position, d.removed])).toEqual([[{ lat: 30.2, lng: -91.0 }, true], [{ lat: 30.3, lng: -91.1 }, false]])
    expect(framedForVisitor()).toBe(2)
    // No place takes the dot away and draws none.
    view.rerender(<LCAMap mode="all" clubs={clubs} frame="clubs" />)
    expect(dots().map((d) => d.removed)).toEqual([true, true])
    expect(made.maps).toHaveLength(1)
  })
})

describe('the Clubs page\'s pins and card', () => {
  const clubs = (names: string[]) => names.map((name, i) => ({ id: `c-${i}`, name, latitude: 30 + i / 10, longitude: -91 }))

  it('are rebuilt when the frame changes, with the old pins taken away, and not when only the selection does', () => {
    const base = clubs(['Example Chess Club', 'Example Knights Club'])
    const view = render(<LCAMap mode="all" clubs={base} frame="clubs" />)
    expect(made.markers).toHaveLength(2)
    view.rerender(<LCAMap mode="all" clubs={base} frame="clubs" selectedId="c-1" />)
    expect(made.markers).toHaveLength(2)
    view.rerender(<LCAMap mode="all" clubs={base} frame="state" selectedId="c-1" />)
    expect(made.markers).toHaveLength(4)
    expect(made.markers.slice(0, 2).every((m) => m.removed)).toBe(true)
    expect(made.maps).toHaveLength(1)
  })

  it('open the selected club\'s card once for each change of selection, and when the set of clubs changes under it', () => {
    const base = clubs(['Example Chess Club', 'Example Knights Club'])
    const view = render(<LCAMap mode="all" clubs={base} frame="clubs" />)
    expect(made.infoOpens).toBe(0)
    view.rerender(<LCAMap mode="all" clubs={base} frame="clubs" selectedId="c-0" />)
    expect(made.infoOpens).toBe(1)
    view.rerender(<LCAMap mode="all" clubs={base} frame="clubs" selectedId="c-0" />)
    expect(made.infoOpens).toBe(1)
    view.rerender(<LCAMap mode="all" clubs={base} frame="clubs" selectedId="c-1" />)
    expect(made.infoOpens).toBe(2)
  })
})

describe('a maps script that loads after the page has drawn', () => {
  it('makes the map once, from the places the page holds when it loads, and draws nothing before it', () => {
    delete window.google
    const view = render(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY]} directions={false} />)
    expect(document.querySelector('script[data-lca-maps]')).not.toBeNull()
    expect(made.maps).toEqual([])
    expect(made.markers).toEqual([])
    // The page draws again with other places before the script is ready; the map reads the places of the draw that loaded it.
    view.rerender(<LCAMap mode="single" clubName="Example Chess Club" places={[CAFE]} directions={false} />)
    expect(made.maps).toEqual([])
    window.google = { maps: fakeMaps } as never
    act(() => { (window as unknown as { initLCAMap: () => void }).initLCAMap() })
    expect(made.maps).toHaveLength(1)
    expect(titles()).toEqual(['Example Cafe'])
    view.rerender(<LCAMap mode="single" clubName="Example Chess Club" places={[LIBRARY]} directions={false} />)
    expect(made.maps).toHaveLength(1)
    expect(titles()).toEqual(['Example Cafe'])
  })

  it('draws today\'s club page\'s one pin once the script is ready, as it always has', () => {
    delete window.google
    render(<LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 30.1, lng: -91.2 }} />)
    expect(made.maps).toEqual([])
    window.google = { maps: fakeMaps } as never
    act(() => { (window as unknown as { initLCAMap: () => void }).initLCAMap() })
    expect(made.maps).toHaveLength(1)
    expect(made.markers.map((m) => [m.title, m.position])).toEqual([['Example Chess Club', { lat: 30.1, lng: -91.2 }]])
  })
})
