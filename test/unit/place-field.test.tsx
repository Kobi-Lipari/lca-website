// @vitest-environment jsdom
//
// The Clubs directory's field, Near me and the two orders (WS09 step 34):
// src/areas/clubs/components/PlaceField.tsx inside
// src/areas/clubs/components/ClubDirectory.tsx, drawn from made-up clubs.
// - a ZIP code or a Louisiana town orders the list nearest first, with
//   "about N mi", the divider "Farther than 75 miles" and "Distance not
//   known" over the clubs with no point, and removes no club; the pill and
//   Clear location; a town is kept in the address only as its ZIP code;
// - a name narrows the list with the counted caption, said once the typing
//   pauses, never on each key; a place outside Louisiana, and a town with no
//   club, each in words;
// - Near me asks the device once, on the press, and keeps only a ZIP code:
//   the device's point reaches no request, no storage, no log line, no
//   state of the page and not its address; a refusal, a browser that cannot
//   ask, a device slower than ten seconds and a point outside Louisiana are
//   each said in words, with the focus back on the field;
// - the page makes no request of its own when a place is typed, chosen or
//   cleared, and no server code reads the near part of the address;
// - the map moves to a place and its nearest clubs, and back to the state.
// Every club and name here is made up; the places are real towns.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nearestZip } from '@domain/clubs/nearZip'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { PLACE_ZOOM, STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import * as words from '@/areas/clubs/directoryWords'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number] | null): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Six made-up clubs in real towns: three within 75 miles of Baton Rouge, two past it, one with no point. */
const CLUBS: ApiClubDirectoryItem[] = [
  row('c-pine', 'Example Pine Club', 'Shreveport', 'North Louisiana', [32.5, -93.75]),
  row('c-river', 'Example River Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15]),
  row('c-harbor', 'Example Harbor Club', 'Kenner', 'New Orleans Metro', null),
  row('c-knights', 'Example Knights Club', 'Baker', 'Baton Rouge / East Central', [30.59, -91.17]),
  row('c-delta', 'Example Delta Club', 'Monroe', 'North Louisiana', [32.5, -92.1]),
  row('c-bayou', 'Example Bayou Club', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
]
const A_TO_Z = ['Example Bayou Club', 'Example Delta Club', 'Example Harbor Club', 'Example Knights Club', 'Example Pine Club', 'Example River Club']
const FROM_70808 = ['Example River Club', 'Example Knights Club', 'Example Bayou Club', 'Example Delta Club', 'Example Pine Club', 'Example Harbor Club']

/** A made-up point a few streets from a ZIP code area's own point in Baton Rouge, and one in Texas. */
const DEVICE = { latitude: 30.4517, longitude: -91.1288 }
const TEXAS = { latitude: 29.7604, longitude: -95.3698 }

/** The page's address, drawn beside it so a case can read it. */
function Address() {
  const { search } = useLocation()
  return <span data-testid="address">{search}</span>
}

function draw(at = '/clubs', clubs = CLUBS) {
  return render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={clubs} /><Address /></MemoryRouter>)
}

const address = () => screen.getByTestId('address').textContent
const field = () => screen.getByRole('textbox', { name: words.FIELD_LABEL }) as HTMLInputElement
const status = () => screen.getByRole('status')
const list = () => screen.getByRole('list', { name: /^Clubs, / })
const names = () => within(list()).getAllByRole('listitem').map((li) => li.querySelector('a > span > span')?.textContent)
const dividers = () => [...list().querySelectorAll('[data-divider]')].map((d) => ({ words: d.textContent, before: d.closest('li')?.querySelector('a > span > span')?.textContent }))

/** Types into the field and lets the pause pass, as a person who stops typing. */
function type(text: string) {
  fireEvent.change(field(), { target: { value: text } })
  act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
}

/** A stand-in for the browser's location, kept so the real one is put back. */
type Asked = { ok: PositionCallback; fail?: PositionErrorCallback | null; options?: PositionOptions }
function standInLocation() {
  const asked: Asked[] = []
  const geolocation = {
    getCurrentPosition: vi.fn((ok: PositionCallback, fail?: PositionErrorCallback | null, options?: PositionOptions) => { asked.push({ ok, fail, options }) }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  }
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
  return { geolocation, asked }
}
const position = (point: { latitude: number; longitude: number }) => ({ coords: { ...point, accuracy: 20 }, timestamp: 0 }) as unknown as GeolocationPosition

/** Every number held in the page's components' state and refs, read from React's own tree, so a case can show the device's point is in none. */
function numbersInState(container: HTMLElement): number[] {
  const rootKey = Object.keys(container).find((k) => k.startsWith('__reactContainer$'))!
  const found: number[] = []
  const seen = new Set<unknown>()
  const collect = (value: unknown, depth: number) => {
    if (typeof value === 'number') found.push(value)
    if (depth > 6 || value === null || typeof value !== 'object' || seen.has(value) || value instanceof Node) return
    seen.add(value)
    for (const v of Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)) collect(v, depth + 1)
  }
  const visit = (fiber: { memoizedState: unknown; child: unknown; sibling: unknown } | null) => {
    for (let at = fiber; at; at = at.sibling as typeof fiber) {
      // A component's hooks are a chain, each with the value it keeps.
      for (let hook = at.memoizedState as { memoizedState?: unknown; next?: unknown } | null; hook && typeof hook === 'object'; hook = hook.next as typeof hook) {
        collect(hook.memoizedState, 0)
        if (!('next' in hook)) break
      }
      visit(at.child as typeof fiber)
    }
  }
  visit((container as unknown as Record<string, { child: never }>)[rootKey].child)
  return found
}

const realGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
  if (realGeolocation) Object.defineProperty(navigator, 'geolocation', realGeolocation)
  else delete (navigator as unknown as Record<string, unknown>).geolocation
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('a place typed', () => {
  it('a ZIP code orders the list nearest first, with about N mi, both dividers and every club, and keeps only the ZIP code in the address', () => {
    draw()
    expect(names()).toEqual(A_TO_Z)
    type('70808')
    expect(names()).toEqual(FROM_70808)
    expect(list().getAttribute('aria-label')).toBe(words.LIST_NEAREST)
    const cards = within(list()).getAllByRole('link')
    expect(cards.map((a) => a.querySelector('span')?.textContent)).toEqual([
      'Example River Club · Baton Rouge · about 3 mi', 'Example Knights Club · Baker · about 13 mi', 'Example Bayou Club · Lafayette · about 54 mi',
      'Example Delta Club · Monroe · about 156 mi', 'Example Pine Club · Shreveport · about 211 mi', 'Example Harbor Club · Kenner',
    ])
    // One divider where the distances pass 75 miles, and one where they end.
    expect(dividers()).toEqual([{ words: 'Farther than 75 miles', before: 'Example Delta Club' }, { words: words.NO_DISTANCE, before: 'Example Harbor Club' }])
    expect(address()).toBe('?near=70808')
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    expect(field().value).toBe('')
    expect(status().textContent).toBe(words.nearestCaption(6))
    expect(screen.getByRole('button', { name: words.NEAREST }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps a Louisiana town in the address only as its nearest ZIP code, and says when the town has no club, with Start a club?', () => {
    draw()
    fireEvent.change(field(), { target: { value: 'Natchitoches, LA' } })
    fireEvent.submit(field().closest('form')!)
    expect(address()).toBe('?near=71457')
    expect(address()).not.toMatch(/natchitoches|%20|\+/i)
    expect(names()).toHaveLength(6)
    expect(status().textContent).toContain(words.noClubIn('Natchitoches'))
    const start = within(status()).getByRole('link', { name: words.START_A_CLUB })
    expect(start.getAttribute('href')).toBe('/clubs/suggest?kind=start')
    // A town with a club of its own says nothing of the kind.
    type('baton rouge')
    expect(address()).toBe('?near=70806')
    expect(status().querySelector('[data-note]')).toBeNull()
    expect(screen.getByText(words.nearYou('Baton Rouge', '70806'))).toBeTruthy()
  })

  it('narrows by a name once the typing pauses, saying the count once and never on each key, and Show all brings back every club', () => {
    draw()
    // What the live region holds after each key and each wait: a change is what a screen reader says.
    const heard = [status().textContent]
    const listen = () => { if (heard.at(-1) !== status().textContent) heard.push(status().textContent) }
    for (const text of ['k', 'kn', 'kni']) {
      fireEvent.change(field(), { target: { value: text } })
      listen()
      act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS - 100) })
      listen()
    }
    expect(names()).toEqual(A_TO_Z)
    act(() => { vi.advanceTimersByTime(100) })
    listen()
    expect(names()).toEqual(['Example Knights Club'])
    expect(heard).toEqual([words.listCaption(6), '1 club matches kni · Show all 6'])
    expect(address()).toBe('')
    fireEvent.click(within(status()).getByRole('button', { name: 'Show all 6' }))
    expect(names()).toEqual(A_TO_Z)
    expect(field().value).toBe('')
    expect(document.activeElement).toBe(field())
  })

  it('reads a ZIP code of Louisiana\'s that no area holds as a name, never as an error, and leaves the address alone', () => {
    draw()
    type('70899')
    expect(status().textContent).toBe('0 clubs match 70899 · Show all 6')
    expect(address()).toBe('')
  })

  it('says a place outside Louisiana is outside, without naming any club, and leaves the list as it was', () => {
    draw()
    type('Houston, TX')
    expect(status().textContent).toContain(words.OUTSIDE)
    expect(words.OUTSIDE).toBe('That\'s outside Louisiana. Type a Louisiana city or ZIP.')
    expect(status().textContent).not.toMatch(/Picayune|club over/i)
    expect(names()).toEqual(A_TO_Z)
    expect(address()).toBe('')
  })
})

describe('the two orders and the pill', () => {
  it('Nearest cannot be chosen until a place is known, and says why beside it; the pressed order is told by aria-pressed and a check mark', () => {
    draw()
    const nearest = screen.getByRole('button', { name: words.NEAREST })
    const aToZ = screen.getByRole('button', { name: words.A_TO_Z })
    expect(nearest.getAttribute('aria-disabled')).toBe('true')
    const why = document.getElementById(nearest.getAttribute('aria-describedby')!)!
    expect(why.textContent).toBe(words.NEAREST_WHY)
    fireEvent.click(nearest)
    expect(names()).toEqual(A_TO_Z)
    expect([aToZ.getAttribute('aria-pressed'), nearest.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
    expect(aToZ.querySelector('svg')).not.toBeNull()
    expect(nearest.querySelector('svg')).toBeNull()
    type('70808')
    expect(nearest.getAttribute('aria-disabled')).toBeNull()
    expect(screen.queryByText(words.NEAREST_WHY)).toBeNull()
    fireEvent.click(aToZ)
    expect(names()).toEqual(A_TO_Z)
    expect(address()).toBe('?near=70808&sort=az')
    expect(list().getAttribute('aria-label')).toBe(words.LIST_A_TO_Z)
    expect(dividers()).toEqual([])
    expect(status().textContent).toBe(words.listCaption(6))
    fireEvent.click(nearest)
    expect(names()).toEqual(FROM_70808)
    expect(address()).toBe('?near=70808')
    expect([aToZ.querySelector('svg'), nearest.querySelector('svg')].map(Boolean)).toEqual([false, true])
  })

  it('Clear location goes back to A to Z, the whole list and the whole state, and gives the focus to the field', async () => {
    vi.useRealTimers()
    vi.stubEnv('MODE', 'a11y')
    ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
    draw('/clubs?near=70808&region=north-louisiana')
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    expect(map.getAttribute('data-view')).toBe('place')
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
    fireEvent.click(within(map).getByRole('button', { name: words.WHOLE_STATE }))
    expect(map.getAttribute('data-view')).toBe('state')
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(address()).toBe('?region=north-louisiana')
    expect(map.getAttribute('data-view')).toBe('state')
    expect(screen.queryByText(/^Near you:/)).toBeNull()
    expect(document.activeElement).toBe(field())
    // A place taken again moves the map again.
    fireEvent.change(field(), { target: { value: '70808' } })
    fireEvent.submit(field().closest('form')!)
    expect(map.getAttribute('data-view')).toBe('place')
  })

  it('reads the place from the address on load: nearest first with the pill, A to Z beside sort=az, and no place for a ZIP code no area holds', () => {
    draw('/clubs?near=70808')
    expect(names()).toEqual(FROM_70808)
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    cleanup()
    draw('/clubs?near=70808&sort=az')
    expect(names()).toEqual(A_TO_Z)
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    cleanup()
    draw('/clubs?near=99999')
    expect(names()).toEqual(A_TO_Z)
    expect(screen.queryByText(/^Near you:/)).toBeNull()
    expect(screen.getByRole('button', { name: words.NEAREST }).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('Near me', () => {
  it('asks the device once, on the press and never before, and keeps only the ZIP code: no request, storage, log line, state or address holds the point', () => {
    const { geolocation, asked } = standInLocation()
    const fetches = vi.spyOn(globalThis, 'fetch')
    const opens = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const stored = vi.spyOn(Storage.prototype, 'setItem')
    const logged = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name))
    const { container } = draw()
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
    const button = screen.getByRole('button', { name: words.NEAR_ME })
    fireEvent.click(button)
    fireEvent.click(button)
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(asked[0].options).toEqual({ enableHighAccuracy: false, timeout: words.DEVICE_WAIT_MS, maximumAge: 0 })
    expect(status().textContent).toContain(words.FINDING)
    act(() => asked[0].ok(position(DEVICE)))
    const zip = nearestZip(DEVICE).zip
    expect(address()).toBe(`?near=${zip}`)
    expect(names()[0]).toBe('Example River Club')
    expect(screen.getByText(words.nearYou('Baton Rouge', zip))).toBeTruthy()
    expect(status().textContent).toBe(words.nearestCaption(6))
    // The device's own point is nowhere: not in the page, its address, a request, the storage, the console or any state the page keeps.
    const digits = [String(DEVICE.latitude), String(DEVICE.longitude), String(-DEVICE.longitude)]
    for (const d of digits) {
      expect(document.documentElement.outerHTML, d).not.toContain(d)
      expect(address(), d).not.toContain(d)
    }
    expect(numbersInState(container).filter((n) => n === DEVICE.latitude || n === DEVICE.longitude)).toEqual([])
    expect(fetches).not.toHaveBeenCalled()
    expect(opens).not.toHaveBeenCalled()
    expect(stored).not.toHaveBeenCalled()
    for (const spy of logged) expect(spy).not.toHaveBeenCalled()
    // A press once the answer is in asks again, once.
    fireEvent.click(button)
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2)
  })

  it('a refused location says so in words, moves the focus to the field, and keeps the list A to Z', () => {
    const { asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => asked[0].fail?.({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError))
    expect(words.NOT_FOUND).toBe('We couldn\'t get your location. Type a city or ZIP.')
    expect(status().textContent).toContain(words.NOT_FOUND)
    expect(document.activeElement).toBe(field())
    expect(names()).toEqual(A_TO_Z)
    expect(address()).toBe('')
  })

  it('says in words when the browser cannot ask, when the device takes more than ten seconds, and when it is outside Louisiana, and lets a late answer go', () => {
    Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true })
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(status().textContent).toContain(words.NO_SUPPORT)
    expect(document.activeElement).toBe(field())
    cleanup()

    const { asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => { vi.advanceTimersByTime(words.DEVICE_WAIT_MS - 1) })
    expect(status().textContent).toContain(words.FINDING)
    act(() => { vi.advanceTimersByTime(1) })
    expect(status().textContent).toContain(words.TOO_LONG)
    expect(document.activeElement).toBe(field())
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toBe('')
    expect(names()).toEqual(A_TO_Z)

    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => asked[1].ok(position(TEXAS)))
    expect(status().textContent).toContain(words.OUTSIDE)
    expect(address()).toBe('')
    expect(document.activeElement).toBe(field())
  })
})

describe('what the page sends and keeps', () => {
  it('makes no request of its own when a place is typed, chosen or cleared, and writes nothing to storage or the console', () => {
    const fetches = vi.spyOn(globalThis, 'fetch')
    const opens = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const stored = vi.spyOn(Storage.prototype, 'setItem')
    const logged = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name))
    draw()
    type('70808')
    type('Lafayette')
    type('kni')
    type('Houston, TX')
    fireEvent.click(screen.getByRole('button', { name: words.A_TO_Z }))
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(fetches).not.toHaveBeenCalled()
    expect(opens).not.toHaveBeenCalled()
    expect(stored).not.toHaveBeenCalled()
    for (const spy of logged) expect(spy).not.toHaveBeenCalled()
    expect(address()).toBe('')
  })

  it('the field\'s small question mark is closed until pressed and says only that the exact position stays on the device and only a ZIP is kept in the address', () => {
    vi.useRealTimers()
    draw()
    const mark = screen.getByRole('button', { name: `Help: ${words.FIELD_LABEL}` })
    expect(mark.getAttribute('aria-expanded')).toBe('false')
    const bubble = document.getElementById(mark.getAttribute('aria-controls')!)!
    expect(bubble.hidden).toBe(true)
    fireEvent.click(mark)
    expect(bubble.hidden).toBe(false)
    expect(bubble.textContent).toBe(words.FIELD_HELP)
    expect(words.FIELD_HELP).toContain('your device\'s exact position never leaves it')
    expect(words.FIELD_HELP).toContain('only that ZIP is kept in the page\'s address')
    expect(words.FIELD_HELP).not.toMatch(/server|\blog|map|google|provider|store/i)
    // The label is in sight, not only a name for a screen reader.
    expect(screen.getByText(words.FIELD_LABEL, { selector: 'label' })).toBeTruthy()
  })

  it('no server code reads the near part of the address', () => {
    const ROOT = resolve(__dirname, '../..')
    const files = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = `${dir}/${name}`
      return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|js)$/.test(name) ? [path] : []
    })
    const readers = /(?:get|has|getAll)\(\s*['"]near['"]\s*\)|\.near\b|\[['"]near['"]\]/
    for (const file of files('functions')) expect(readFileSync(join(ROOT, file), 'utf8').replace(/\/\/.*$/gm, ''), file).not.toMatch(readers)
  })
})

describe('the map with a maps key', () => {
  const asked = { fits: [] as unknown[], zooms: [] as number[] }
  class FakeLatLng {
    constructor(public latitude: number, public longitude: number) {}
  }
  let idle: (() => void) | null = null
  // A fit that leaves the view where it already is: Google sends no 'idle'.
  let still = false
  const waiting: { fn: () => void; removed: boolean }[] = []
  class FakeMap {
    zoom = 7
    addListener() { return { remove() {} } }
    fitBounds(bounds: unknown) {
      asked.fits.push(bounds)
      if (still) return
      // A place framed close in comes past the zoom the page allows.
      this.zoom = 14
      idle?.()
      idle = null
    }
    panTo() {}
    getZoom() { return this.zoom }
    setZoom(z: number) { this.zoom = z; asked.zooms.push(z) }
  }
  class FakeOverlay {
    draw() {}
    setMap() { this.draw() }
    getProjection() { return { fromLatLngToContainerPixel: () => ({ x: 10, y: 10 }) } }
  }

  beforeEach(() => {
    vi.useRealTimers()
    Object.assign(asked, { fits: [], zooms: [] })
    still = false
    waiting.length = 0
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => 1000)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => 780)
    const addListenerOnce = (_m: unknown, _e: string, fn: () => void) => {
      const handle = { fn, removed: false }
      waiting.push(handle)
      idle = () => { if (!handle.removed) fn() }
      return { remove() { handle.removed = true } }
    }
    window.google = { maps: { Map: FakeMap, OverlayView: FakeOverlay, LatLng: FakeLatLng, event: { addListenerOnce } } } as never
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
  })
  afterEach(() => {
    delete (window as { google?: unknown }).google
  })

  it('moves to a place and its nearest clubs, no closer than the page allows, and back to the whole state when the place is cleared', async () => {
    draw()
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    expect(map.getAttribute('data-view')).toBe('state')
    expect(asked.fits).toHaveLength(1)
    fireEvent.change(field(), { target: { value: '70808' } })
    fireEvent.submit(field().closest('form')!)
    expect(map.getAttribute('data-view')).toBe('place')
    // The ZIP code's point and the three nearest clubs: Example River, Knights and Bayou.
    expect(asked.fits[1]).toEqual({ south: 30.22, west: -92.02, north: 30.59, east: -91.139 })
    expect(asked.zooms).toEqual([PLACE_ZOOM])
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(map.getAttribute('data-view')).toBe('state')
    expect(asked.fits).toHaveLength(3)
    expect(asked.fits[2]).toEqual(asked.fits[0])
    expect(document.querySelector('script[data-lca-maps]')).toBeNull()
  })

  it('takes away the zoom cap after two seconds when the view did not move, so a later zoom by the visitor stands', async () => {
    // Hold only the two second clean ups; every other timer runs as it would.
    const realSetTimeout = window.setTimeout.bind(window)
    const later: (() => void)[] = []
    const timers = vi.spyOn(window, 'setTimeout').mockImplementation(((fn: () => void, ms?: number, ...rest: unknown[]) => {
      if (ms === 2000) { later.push(fn); return 0 }
      return realSetTimeout(fn, ms, ...rest)
    }) as typeof window.setTimeout)
    try {
      draw()
      const map = await screen.findByRole('group', { name: 'Map of the clubs' })
      still = true
      fireEvent.change(field(), { target: { value: '70808' } })
      fireEvent.submit(field().closest('form')!)
      expect(map.getAttribute('data-view')).toBe('place')
      const capped = waiting[waiting.length - 1]
      expect(capped.removed).toBe(false)
      for (const fn of later) fn()
      expect(capped.removed).toBe(true)
      // The visitor zooms in past the cap; the leftover 'idle' no longer pulls it back.
      idle?.()
      expect(asked.zooms).toEqual([])
    } finally {
      timers.mockRestore()
    }
  })
})
