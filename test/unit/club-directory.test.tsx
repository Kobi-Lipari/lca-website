// @vitest-environment jsdom
//
// The Clubs directory (src/areas/clubs/components/ClubDirectory.tsx, WS09
// step 33), drawn alone from a made-up answer in the directory's shape:
// - every club A to Z on first paint, with no place asked for and no
//   location read, whatever the address holds, which is read on load;
// - the title strip and the caption, their counts counted from the clubs;
// - each card one link to the club's page at its short address, with no
//   second link or button in it, and the thin card's words, plain;
// - nothing of who keeps a club, no seat and no address of a club;
// - with no maps key the list alone with one line, and nothing asked of the
//   map's provider; with the stand-in, the pins as buttons in the list's
//   order, a card's pointer and focus lifting its pin, a pin's press
//   selecting it and bringing its card into view (at once with less
//   motion), a count circle opening, and All of Louisiana going back;
// - an empty answer as one sentence.
// Every club and name here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { CONFIRM_FIRST, MAP_KEY, NO_CLUBS, NO_MAP, THIN_CARD, WHOLE_STATE } from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string | null, point: [number, number] | null, statement: string | null, description: string | null = null): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: '#1f4e79', image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement, description: statement ? null : description, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

/** Five made-up clubs, out of order: two in one town, one with no statement, one with no point, three regions among them and one region that is not one of the five. */
const CLUBS: ApiClubDirectoryItem[] = [
  row('c-rooks', 'Example Rooks Club', 'Example Village', 'North Louisiana', [32.5, -92.1], 'Saturdays at 10:00 AM at the Example Library.'),
  row('c-bishops', 'Example Bishops Club', 'Example City', 'Baton Rouge / East Central', [30.45, -91.18], 'Tuesdays at 7:00 PM.'),
  row('c-knights', 'Example Knights Club', 'Example City', 'Baton Rouge / East Central', [30.41, -91.1], null, 'A made-up club for players of every strength.'),
  row('c-pawns', 'Example Pawns Club', 'Example Town', 'New Orleans Metro', null, 'Thursdays at 6:30 PM.'),
  row('c-queens', 'example Queens Club', 'Example Hamlet', 'Bayou Region', [31.3, -92.4], 'Every other Sunday at 2:00 PM.'),
]
const A_TO_Z = ['Example Bishops Club', 'Example Knights Club', 'Example Pawns Club', 'Example Rooks Club', 'example Queens Club']

const scrolled: Array<{ id: string | null; behavior?: ScrollBehavior }> = []
let lessMotion = false

beforeEach(() => {
  scrolled.length = 0
  lessMotion = false
  Element.prototype.scrollIntoView = function (this: Element, options?: ScrollIntoViewOptions | boolean) {
    scrolled.push({ id: this.querySelector('[data-card]')?.getAttribute('data-card') ?? this.id ?? null, behavior: typeof options === 'object' ? options.behavior : undefined })
  }
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') && lessMotion, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
})

function draw(clubs: ApiClubDirectoryItem[] = CLUBS, at = '/clubs') {
  return render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={clubs} /></MemoryRouter>)
}

/** The stand-in map, as the accessibility test build draws it when a page asks. */
async function drawWithStandIn() {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = draw()
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const cards = () => within(screen.getByRole('list', { name: 'Clubs, A to Z' })).getAllByRole('listitem')

describe('the directory on first paint', () => {
  it('lists all clubs A to Z on first paint, with no place asked for and no location read', () => {
    const geolocation = { getCurrentPosition: vi.fn(), watchPosition: vi.fn() }
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
    draw()
    expect(cards().map((li) => li.querySelector('a > span > span')?.textContent)).toEqual(A_TO_Z)
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
    // The field is there and empty, and no filter is on (WS09 step 34); its chips are buttons, never boxes to tick.
    expect((screen.getByRole('textbox', { name: 'City, ZIP or club name' }) as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('reads the address on load and applies it, the filters narrowing the list, and writes it back canonical', () => {
    const { container } = draw(CLUBS, '/clubs?region=north-louisiana&near=70808&sort=az&junk=1')
    expect(container.querySelector('[data-slot="club-directory"]')?.getAttribute('data-address')).toBe('?near=70808&sort=az&region=north-louisiana')
    expect(cards().map((li) => li.querySelector('a > span > span')?.textContent)).toEqual(['Example Rooks Club'])
  })

  it('the caption counts: the strip and the caption count the clubs and the regions with a club, from the answer', () => {
    draw()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Chess clubs in Louisiana'])
    expect(screen.getByText('5 clubs · 3 regions · Find the nearest, or look around the whole state.')).toBeTruthy()
    expect(screen.getByText(`All 5 clubs, A to Z. ${CONFIRM_FIRST}`)).toBeTruthy()
    cleanup()
    draw(CLUBS.slice(0, 1))
    expect(screen.getByText('1 club · 1 region · Find the nearest, or look around the whole state.')).toBeTruthy()
    expect(screen.getByText(`The 1 club, A to Z. ${CONFIRM_FIRST}`)).toBeTruthy()
  })

  it('shows one sentence for an empty answer', () => {
    draw([])
    expect(screen.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
    expect(screen.getByText(NO_CLUBS)).toBeTruthy()
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('the cards', () => {
  it('a card is one link with no second link or button, to the club\'s page at its short address', () => {
    draw()
    for (const li of cards()) {
      const links = li.querySelectorAll('a')
      expect(links).toHaveLength(1)
      expect(li.querySelectorAll('button, input, select, textarea, [role="button"], [tabindex]')).toHaveLength(0)
      expect(links[0].getAttribute('href')).toBe(`/clubs/${links[0].getAttribute('data-card')}-slug`)
      expect(li.querySelectorAll('img, svg')).toHaveLength(0)
      expect(links[0].getAttribute('style')).toBeNull()
    }
  })

  it('the thin card\'s words: plain words and the club\'s description in grey, and the statement for a club with one', () => {
    draw()
    const thin = cards()[1]
    expect(thin.textContent).toBe(`Example Knights Club · Example City${THIN_CARD}A made-up club for players of every strength.`)
    expect(within(thin).getByText(THIN_CARD).tagName).toBe('SPAN')
    expect(within(thin).getByText('A made-up club for players of every strength.').className).toContain('text-muted-foreground')
    const full = cards()[0]
    expect(full.textContent).toBe('Example Bishops Club · Example CityTuesdays at 7:00 PM.')
    expect(within(full).getByText('Tuesdays at 7:00 PM.').className).toContain('line-clamp-2')
  })

  it('names no keeper, seat or representative, shows no address of a club and no member figure', () => {
    const { container } = draw()
    const words = container.textContent ?? ''
    expect(words).not.toMatch(/keeper|representative|\bseat\b|\brep\b|@|mailto|300\+|members/i)
    expect(container.querySelectorAll('a[href^="mailto:"]')).toHaveLength(0)
  })
})

describe('the map', () => {
  it('with no maps key, the list stands alone with one line, and nothing is asked of the map\'s provider', () => {
    draw()
    expect(screen.getByText(NO_MAP)).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Map of the clubs' })).toBeNull()
    expect(screen.queryByText(MAP_KEY)).toBeNull()
    expect(screen.queryByRole('link', { name: 'Skip to the map' })).toBeNull()
    expect(document.querySelector('script[data-lca-maps]')).toBeNull()
  })

  it('draws the pins as buttons in the list\'s order, each named by its club and town, with no number, and a count circle for the town of two', async () => {
    const { map } = await drawWithStandIn()
    const marks = within(map).getAllByRole('button').filter((b) => b.textContent !== WHOLE_STATE)
    expect(marks.map((b) => b.getAttribute('aria-label'))).toEqual(['2 clubs in Example City, show each', 'Example Rooks Club, Example Village', 'example Queens Club, Example Hamlet'])
    for (const pin of map.querySelectorAll('[data-pin]')) {
      expect(pin.textContent).toBe('')
      expect(pin.getAttribute('aria-pressed')).toBe('false')
    }
    // The club with no point has no pin, and its card says nothing of it.
    expect(map.querySelector('[data-pin="c-pawns"]')).toBeNull()
    expect(cards()[2].textContent).toBe('Example Pawns Club · Example TownThursdays at 6:30 PM.')
    expect(screen.getByText(MAP_KEY)).toBeTruthy()
    expect(document.querySelector('script[data-lca-maps]')).toBeNull()
    // The map is its own stack, so a pin above the others never paints over the page's header, dock or dialogs.
    expect(map.className).toContain('isolate')
  })

  it('opens a count circle into its pins, the hollow one drawn as an outline, and goes back with All of Louisiana', async () => {
    const { map } = await drawWithStandIn()
    fireEvent.click(within(map).getByRole('button', { name: '2 clubs in Example City, show each' }))
    expect([...map.querySelectorAll('[data-pin]')].map((b) => b.getAttribute('aria-label'))).toEqual([
      'Example Bishops Club, Example City', 'Example Knights Club, Example City', 'Example Rooks Club, Example Village', 'example Queens Club, Example Hamlet',
    ])
    const solid = map.querySelector('[data-pin="c-bishops"] path')!
    const hollow = map.querySelector('[data-pin="c-knights"] path')!
    expect([map.querySelector('[data-pin="c-bishops"]')!.getAttribute('data-listed'), map.querySelector('[data-pin="c-knights"]')!.getAttribute('data-listed')]).toEqual(['true', 'false'])
    expect(solid.getAttribute('fill')).not.toBe(hollow.getAttribute('fill'))
    expect(Number(hollow.getAttribute('stroke-width'))).toBeGreaterThan(Number(solid.getAttribute('stroke-width')))
    fireEvent.click(within(map).getByRole('button', { name: 'Example Knights Club, Example City' }))
    fireEvent.click(within(map).getByRole('button', { name: WHOLE_STATE }))
    expect(map.querySelector('[data-pin="c-knights"]')).toBeNull()
    expect(map.querySelector('[aria-pressed="true"]')).toBeNull()
  })

  it('lifts a card\'s pin while the pointer is over the card or the focus is on it', async () => {
    const { map } = await drawWithStandIn()
    const rooks = cards()[3].querySelector('a')!
    fireEvent.mouseEnter(rooks)
    expect(map.querySelector('[data-pin="c-rooks"]')!.getAttribute('data-lifted')).toBe('true')
    expect(map.querySelector('[data-pin="c-rooks"] svg')!.getAttribute('height')).toBe('42')
    fireEvent.mouseLeave(rooks)
    expect(map.querySelector('[data-pin="c-rooks"]')!.getAttribute('data-lifted')).toBeNull()
    act(() => rooks.focus())
    expect(map.querySelector('[data-pin="c-rooks"]')!.getAttribute('data-lifted')).toBe('true')
    act(() => rooks.blur())
    expect(map.querySelector('[data-lifted]')).toBeNull()
    // A card whose pin is in a closed circle lifts the circle.
    act(() => cards()[1].querySelector('a')!.focus())
    expect(map.querySelector('[data-circle]')!.getAttribute('data-lifted')).toBe('true')
  })

  it('selects a pin on its press, larger with its ring and pressed, and brings its card into view, at once with less motion', async () => {
    const { map } = await drawWithStandIn()
    const pin = within(map).getByRole('button', { name: 'Example Rooks Club, Example Village' })
    fireEvent.click(pin)
    expect(pin.getAttribute('aria-pressed')).toBe('true')
    expect(pin.querySelector('svg')!.getAttribute('height')).toBe('50')
    expect(pin.querySelector('[data-ring]')!.getAttribute('stroke')).toBe('#866a1e')
    expect(cards()[3].querySelector('a')!.getAttribute('data-selected')).toBe('true')
    expect(scrolled.at(-1)).toEqual({ id: 'c-rooks', behavior: 'smooth' })
    // A second press lets it go.
    fireEvent.click(pin)
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    lessMotion = true
    fireEvent.click(within(map).getByRole('button', { name: 'example Queens Club, Example Hamlet' }))
    expect(scrolled.at(-1)).toEqual({ id: 'c-queens', behavior: 'auto' })
  })

  it('puts the list before the map in the reading order, with a link before the list that skips to the map', async () => {
    const { map } = await drawWithStandIn()
    const skip = screen.getByRole('link', { name: 'Skip to the map' })
    expect(skip.getAttribute('href')).toBe('#map')
    const list = screen.getByRole('list', { name: 'Clubs, A to Z' })
    expect(skip.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(list.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(map.closest('#map')).not.toBeNull()
  })
})

describe('the map with a maps key', () => {
  /** What the stand-in for Google's script was asked. */
  const asked = { maps: 0, zooms: [] as number[], pans: 0, fits: 0 }
  class FakeLatLng {
    constructor(public latitude: number, public longitude: number) {}
  }
  class FakeMap {
    zoom = 7
    constructor() { asked.maps += 1 }
    addListener() { return { remove() {} } }
    fitBounds() { asked.fits += 1 }
    panTo() { asked.pans += 1 }
    getZoom() { return this.zoom }
    setZoom(z: number) { this.zoom = z; asked.zooms.push(z) }
  }
  class FakeOverlay {
    draw() {}
    setMap() { this.draw() }
    getProjection() {
      return { fromLatLngToContainerPixel: (at: FakeLatLng) => ({ x: Math.round((at.longitude + 95) * 100), y: Math.round((34 - at.latitude) * 100) }) }
    }
  }

  /** The map's frame in pixels, which jsdom does not lay out. */
  const frame = { width: 1000, height: 780 }

  beforeEach(() => {
    Object.assign(asked, { maps: 0, zooms: [], pans: 0, fits: 0 })
    Object.assign(frame, { width: 1000, height: 780 })
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(() => frame.width)
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(() => frame.height)
    window.google = { maps: { Map: FakeMap, OverlayView: FakeOverlay, LatLng: FakeLatLng, event: { addListenerOnce: () => ({ remove() {} }) } } } as never
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
  })
  afterEach(() => {
    delete (window as { google?: unknown }).google
  })

  it('makes one map of the whole state, lays the pins over it where the map puts their points, and opens a circle one zoom step', async () => {
    draw()
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    expect(map.getAttribute('data-map')).toBe('maps')
    expect(asked.maps).toBe(1)
    expect(asked.fits).toBe(1)
    const rooks = await within(map).findByRole('button', { name: 'Example Rooks Club, Example Village' })
    expect(rooks.style.left).toBe('290px')
    expect(rooks.style.top).toBe('150px')
    fireEvent.click(within(map).getByRole('button', { name: '2 clubs in Example City, show each' }))
    expect(asked.zooms).toEqual([8])
    expect(asked.pans).toBe(1)
    // The town's two clubs, 8 pixels apart where the made-up projection puts them, are spread so neither covers the other.
    const [bishops, knights] = ['Example Bishops Club, Example City', 'Example Knights Club, Example City'].map((name) => within(map).getByRole('button', { name }))
    const gap = (a: HTMLElement, b: HTMLElement, side: 'left' | 'top') => Math.abs(parseFloat(a.style[side]) - parseFloat(b.style[side]))
    expect(gap(bishops, knights, 'left') >= 26 || gap(bishops, knights, 'top') >= 34).toBe(true)
    expect(rooks.style.left).toBe('290px')
    fireEvent.click(within(map).getByRole('button', { name: WHOLE_STATE }))
    expect(asked.fits).toBe(2)
    expect(document.querySelector('script[data-lca-maps]')).toBeNull()
  })

  it('draws no mark whose point the map puts outside its frame, so the focus never lands on a pin nobody can see', async () => {
    // The made-up projection puts the town of two at about 385 by 357 pixels, past the edge of a 300 pixel frame.
    Object.assign(frame, { width: 300, height: 300 })
    draw()
    const map = await screen.findByRole('group', { name: 'Map of the clubs' })
    await within(map).findByRole('button', { name: 'Example Rooks Club, Example Village' })
    expect(within(map).getByRole('button', { name: 'example Queens Club, Example Hamlet' })).toBeTruthy()
    expect(within(map).queryByRole('button', { name: '2 clubs in Example City, show each' })).toBeNull()
    expect(map.querySelectorAll('[data-pin], [data-circle]')).toHaveLength(2)
    expect(map.className).toContain('isolate')
    expect(map.className).toContain('overflow-clip')
  })
})

describe('the browser spec\'s copy of the words', () => {
  it('writes the words and the stand-in\'s flag as the page does', async () => {
    const spec = readFileSync(join(resolve(__dirname, '../..'), 'test/a11y/clubs-directory.spec.ts'), 'utf8')
    for (const [name, words] of Object.entries({ MAP_KEY, NO_MAP, THIN_CARD, WHOLE_STATE, STAND_IN_FLAG })) {
      expect(spec, name).toContain(`const ${name} = '${words}'`)
    }
  })
})
