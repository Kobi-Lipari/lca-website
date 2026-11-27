// @vitest-environment jsdom
//
// The edges of the Clubs directory on a phone (WS09 step 35), beside
// test/unit/club-directory-phone.test.tsx:
// - the window crossing the wide layout's width while the page is open: the
//   sheet comes and goes, the page's choices stay, nothing breaks;
// - a place known: the sheet's caption is the nearest-first one, the cards
//   keep their dividers, the pins follow the list's order, and the tiles stay
//   under the list;
// - a filter that leaves no club: the sheet says so with its one action, the
//   tiles stay, no pin is drawn, and nothing is left selected;
// - a club that goes from the answer while its card is raised: nothing is
//   left marked;
// - clubs with no point: no pin, the sheet and its button still there;
// - a visitor who asks for less motion: the pressed pin's card is scrolled to
//   at once, and with the usual motion, smoothly;
// - the sheet's own words: the plain-language rules, the one live region.
// Every club and name here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import * as words from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import { NARROW_QUERY } from '@/areas/clubs/narrowScreen'
import { CLEAR_FILTERS } from '@domain/clubs/order'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number] | null, statement: string | null, weekend = false): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement, description: statement ? null : 'A made-up club.', point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: weekend, scholastic_friendly: false,
  }
}

// Baton Rouge's own ZIP code is 70808; the clubs sit near it and far from it, one with no point at all.
const CLUBS = [
  row('near', 'Example Near Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.41, -91.15], 'Mondays at 7:00 PM.'),
  row('far', 'Example Far Club', 'Shreveport', 'North Louisiana', [32.52, -93.75], 'Fridays at 6:00 PM.', true),
  row('mid', 'Example Middle Club', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02], null),
  row('none', 'Example No Point Club', 'Example Town', 'North Louisiana', null, null),
]

/** Listeners the stand-in media query holds, so a test can move the window across the width. */
type Listener = () => void
let listeners: Set<Listener>
let narrow: boolean
let reduced: boolean
const scrollCalls: Array<ScrollIntoViewOptions | undefined> = []
// The browser's own, put back after each case.
const originalMatchMedia = window.matchMedia
const originalScroll = Element.prototype.scrollIntoView

beforeEach(() => {
  narrow = true
  reduced = false
  listeners = new Set()
  scrollCalls.length = 0
  Element.prototype.scrollIntoView = function (_arg?: boolean | ScrollIntoViewOptions) {
    scrollCalls.push(_arg as ScrollIntoViewOptions | undefined)
  }
  window.matchMedia = ((query: string) => ({
    get matches() { return query === NARROW_QUERY ? narrow : query === '(prefers-reduced-motion: reduce)' ? reduced : false },
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
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
})

async function drawWithMap(url = '/clubs', clubs: ApiClubDirectoryItem[] = CLUBS) {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = render(<MemoryRouter initialEntries={[url]}><ClubDirectory clubs={clubs} /></MemoryRouter>)
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const sheet = () => screen.getByRole('region', { name: words.LIST_SHEET })
const cardIds = () => [...document.querySelectorAll('#club-list [data-card]')].map((a) => a.getAttribute('data-card'))
/** The map's pins, by name: not the stand-in's own button for the whole state. */
const pins = (map: HTMLElement) => [...map.querySelectorAll<HTMLElement>('[data-pin]')]
const pinNames = (map: HTMLElement) => pins(map).map((b) => b.getAttribute('aria-label') ?? b.textContent)

describe('the window crossing the wide layout\'s width', () => {
  it('draws the sheet below the width and takes it away above it, the same clubs and the same one live region each time', async () => {
    const { view } = await drawWithMap()
    expect(view.container.querySelector('[data-layout="phone"]')).not.toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    narrow = false
    act(() => listeners.forEach((fn) => fn()))
    expect(view.container.querySelector('[data-layout="phone"]')).toBeNull()
    expect(screen.queryByRole('region', { name: words.LIST_SHEET })).toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getByRole('link', { name: words.SKIP_TO_MAP })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /Example .* Club/ })).toHaveLength(4)
    narrow = true
    act(() => listeners.forEach((fn) => fn()))
    expect(view.container.querySelector('[data-layout="phone"]')).not.toBeNull()
    expect(screen.queryByRole('link', { name: words.SKIP_TO_MAP })).toBeNull()
    expect(cardIds()).toEqual(['far', 'mid', 'near', 'none'])
  })

  it('keeps a filter and a typed name across the change, and no tile is lost', async () => {
    const { view } = await drawWithMap('/clubs?region=north-louisiana')
    expect(cardIds()).toEqual(['far', 'none'])
    narrow = false
    act(() => listeners.forEach((fn) => fn()))
    expect(view.container.querySelector('[data-slot="club-directory"]')?.getAttribute('data-address')).toBe('?region=north-louisiana')
    expect([...document.querySelectorAll('[data-card]')].map((a) => a.getAttribute('data-card'))).toEqual(['far', 'none'])
    expect(screen.getByRole('region', { name: words.NOT_HERE })).toBeTruthy()
  })
})

describe('a place known, on a phone', () => {
  it('words the sheet\'s caption nearest first, lists the clubs by distance with the one without a point after them, and keeps the tiles last', async () => {
    const { map } = await drawWithMap('/clubs?near=70808&sort=nearest')
    expect(within(sheet()).getByRole('status').textContent).toBe(words.nearestCaption(4))
    expect(within(sheet()).getByRole('list', { name: words.LIST_NEAREST })).toBeTruthy()
    expect(cardIds()).toEqual(['near', 'mid', 'far', 'none'])
    // The divider before the clubs with no point sits in the sheet, once.
    expect([...sheet().querySelectorAll('[data-divider]')].map((p) => p.textContent)).toContain(words.NO_DISTANCE)
    // The pins follow the list's order, with no pin for the club with no point.
    expect(pinNames(map)).toEqual(['Example Near Club, Baton Rouge', 'Example Middle Club, Lafayette', 'Example Far Club, Shreveport'])
    const tiles = within(sheet()).getByRole('region', { name: words.NOT_HERE })
    expect(sheet().querySelector('[data-cards]')!.compareDocumentPosition(tiles) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('button', { name: words.NEAREST }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('a filter that leaves no club', () => {
  it('keeps the sheet with its one sentence and one action, the tiles and the button, and draws no pin', async () => {
    const { map } = await drawWithMap('/clubs?region=baton-rouge&weekends=1')
    expect(cardIds()).toEqual([])
    expect(within(sheet()).getByRole('status').textContent).toMatch(/Clear/)
    expect(within(sheet()).getByRole('button', { name: CLEAR_FILTERS })).toBeTruthy()
    expect(within(sheet()).getByRole('button', { name: words.SHOW_LIST })).toBeTruthy()
    expect(within(sheet()).getByRole('region', { name: words.NOT_HERE })).toBeTruthy()
    expect(pins(map)).toHaveLength(0)
    fireEvent.click(within(sheet()).getByRole('button', { name: CLEAR_FILTERS }))
    expect(cardIds()).toHaveLength(4)
  })

  it('leaves nothing marked when the filter takes away the club whose pin was pressed', async () => {
    const { map } = await drawWithMap()
    fireEvent.click(within(map).getByRole('button', { name: 'Example Far Club, Shreveport' }))
    expect(document.querySelector('#club-list [data-card="far"]')?.getAttribute('data-selected')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const dialog = screen.getByRole('dialog', { name: words.FILTERS_TITLE })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Baton Rouge/ }))
    expect(cardIds()).toEqual(['near'])
    expect(document.querySelectorAll('[data-selected]')).toHaveLength(0)
  })
})

describe('clubs with no point', () => {
  it('draws no pin and keeps the sheet, its button and Skip to the list', async () => {
    const { map } = await drawWithMap('/clubs', [row('p', 'Example Plain Club', 'Example Town', 'Lafayette / South Central', null, 'Mondays at 7:00 PM.')])
    expect(pins(map)).toHaveLength(0)
    expect(within(sheet()).getByRole('button', { name: words.SHOW_LIST })).toBeTruthy()
    expect(screen.getByRole('link', { name: words.SKIP_TO_LIST })).toBeTruthy()
    expect(within(sheet()).getByRole('status').textContent).toBe(words.listCaption(1))
  })
})

describe('a pressed pin and the visitor\'s motion', () => {
  it('scrolls the card into sight at once for a visitor who asks for less motion, and smoothly otherwise', async () => {
    for (const asks of [true, false]) {
      reduced = asks
      scrollCalls.length = 0
      const { map } = await drawWithMap()
      fireEvent.click(within(map).getByRole('button', { name: 'Example Near Club, Baton Rouge' }))
      expect(document.activeElement).toBe(document.querySelector('#club-list [data-card="near"]'))
      expect(scrollCalls.at(-1)).toMatchObject({ block: 'start', behavior: asks ? 'auto' : 'smooth' })
      cleanup()
      vi.unstubAllEnvs()
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
      delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
    }
  })
})

describe('the sheet\'s words', () => {
  const NEW_WORDS = [
    words.SKIP_TO_LIST, words.LIST_SHEET, words.SHOW_LIST, words.SHOW_MAP, words.FILTERS_TITLE, words.CLOSE, words.NOT_HERE,
    words.MISSING_CLUB, words.SUGGEST_A_CLUB, words.NO_CLUB_NEAR, words.START_ONE, words.OUT_OF_DATE, words.OUT_OF_DATE_HOW,
  ]
  const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD = new RegExp(`\\b${'US' + 'CF'}\\b`)

  it('hold no long dash, no old initials for US Chess, no one who keeps a listing and no half written as .5', () => {
    for (const w of NEW_WORDS) {
      expect(w, w).not.toMatch(DASH)
      expect(w, w).not.toMatch(OLD)
      expect(w, w).not.toMatch(/keeper|kept by|representative|\bseat\b|\.5\b/i)
    }
  })

  it('give the sheet\'s two buttons names that say what they do, and the questions end in a question mark', () => {
    expect(words.SHOW_LIST).toBe('Show the list')
    expect(words.SHOW_MAP).toBe('Map')
    for (const q of [words.NOT_HERE, words.MISSING_CLUB, words.NO_CLUB_NEAR, words.OUT_OF_DATE]) expect(q.endsWith('?')).toBe(true)
    expect(words.OUT_OF_DATE_HOW.endsWith('.')).toBe(true)
  })
})
