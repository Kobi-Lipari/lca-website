// @vitest-environment jsdom
//
// The Clubs directory on a phone (src/areas/clubs/components/ClubDirectory.tsx,
// WS09 step 35), drawn alone from made-up clubs with the window's width
// answered below 1024 pixels by a stand-in media query:
// - with a map, the field, Near me, the orders and Filters, then "Skip to the
//   list", then the map's pins in the list's order, then the sheet with the
//   caption, the cards and the three tiles; no "Skip to the map";
// - the sheet's two rests, moved by its one button, "Show the list" and
//   "Map", which keeps the focus; the sheet is no dialog and holds no focus;
// - a pin's press raising the sheet to its card, marking it and moving the
//   focus to it; the focus going to a pin at the full rest lowering it;
// - the sheet's places reading the dock's height, never under or over it,
//   and the controls over the low sheet kept clear of it by the keyboard;
// - with no map, the list alone with its one line, and no sheet;
// - the Filters panel as a named sheet of its own, the focus back on the
//   Filters button after Escape, Close or Done, with the same chips;
// - at every width, with a map or without, "Not here?" under the list: three
//   tiles, two links to step 30's form and one sentence, naming no one.
// Every club and name here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import * as words from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import { NARROW_QUERY } from '@/areas/clubs/narrowScreen'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number] | null, statement: string | null): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: statement ?? '', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement, description: statement ? null : 'A made-up club.', point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: id === 'c', scholastic_friendly: false,
  }
}

/** Three made-up clubs in three towns, each with a point, given out of order. */
const CLUBS = [
  row('c', 'Example C Club', 'Example Town', 'North Louisiana', [30, -91], 'Mondays at 7:00 PM.'),
  row('a', 'Example A Club', 'Example City', 'New Orleans Metro', [31, -92], null),
  row('b', 'Example B Club', 'Example Village', 'North Louisiana', [32, -93], 'Fridays at 6:00 PM.'),
]

/** Whether the window answers as a phone's. */
let narrow = true
const scrolled: string[] = []
// The browser's own, put back after each case.
const originalMatchMedia = window.matchMedia
const originalScroll = Element.prototype.scrollIntoView

beforeEach(() => {
  narrow = true
  scrolled.length = 0
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.querySelector('[data-card]')?.getAttribute('data-card') ?? this.id)
  }
  window.matchMedia = ((query: string) => ({ matches: query === NARROW_QUERY && narrow, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
  Element.prototype.scrollIntoView = originalScroll
  vi.unstubAllEnvs()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
})

function draw(clubs: ApiClubDirectoryItem[] = CLUBS) {
  return render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={clubs} /></MemoryRouter>)
}

/** The directory with the stand-in map, as the accessibility test build draws it when a page asks. */
async function drawWithMap() {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = draw()
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const sheet = () => screen.getByRole('region', { name: words.LIST_SHEET })
const card = (id: string) => document.querySelector<HTMLElement>(`[data-card="${id}"]`)!

describe('the phone layout with a map', () => {
  it('meets the field, Near me, the orders and Filters, then Skip to the list, then the pins in the list\'s order, then the sheet', async () => {
    const { view } = await drawWithMap()
    const order = [...view.container.querySelectorAll<HTMLElement>('a, button')].map((el) => el.getAttribute('data-card') ?? el.getAttribute('data-pin') ?? el.textContent)
    expect(order).toEqual([
      '', words.NEAR_ME, words.A_TO_Z, words.NEAREST, 'Filters', words.SKIP_TO_LIST,
      'a', 'b', 'c', words.WHOLE_STATE,
      words.SHOW_LIST, 'a', 'b', 'c', words.SUGGEST_A_CLUB, words.START_ONE,
    ])
    expect(screen.queryByRole('link', { name: words.SKIP_TO_MAP })).toBeNull()
    // The caption, the one live region, and the cards are in the sheet; the map is not.
    expect(within(sheet()).getByRole('status').textContent).toBe(words.listCaption(3))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(within(sheet()).getByRole('list', { name: 'Clubs, A to Z' })).toBeTruthy()
    expect(within(sheet()).queryByRole('group', { name: 'Map of the clubs' })).toBeNull()
    expect(view.container.querySelectorAll('[tabindex]:not([tabindex="-1"])')).toHaveLength(0)
  })

  it('starts low; Show the list raises it and Map lowers it, the one button keeping the focus; the sheet is no dialog', async () => {
    await drawWithMap()
    expect(sheet().getAttribute('data-sheet')).toBe('low')
    expect(sheet().getAttribute('role')).toBeNull()
    expect(sheet().getAttribute('aria-modal')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    const button = within(sheet()).getByRole('button', { name: words.SHOW_LIST })
    act(() => button.focus())
    fireEvent.click(button)
    expect(sheet().getAttribute('data-sheet')).toBe('full')
    expect(within(sheet()).getByRole('button', { name: words.SHOW_MAP })).toBe(button)
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(sheet().getAttribute('data-sheet')).toBe('low')
    expect(button.textContent).toBe(words.SHOW_LIST)
    expect(document.activeElement).toBe(button)
  })

  it('raises the sheet to a pressed pin\'s card, marks it and moves the focus to it', async () => {
    const { map } = await drawWithMap()
    fireEvent.click(within(map).getByRole('button', { name: 'Example B Club, Example Village' }))
    expect(sheet().getAttribute('data-sheet')).toBe('full')
    expect(card('b').getAttribute('data-selected')).toBe('true')
    expect(document.activeElement).toBe(card('b'))
    expect(scrolled.at(-1)).toBe('b')
    // A second press of the same pin lets it go and moves nothing.
    act(() => within(sheet()).getByRole('button', { name: words.SHOW_MAP }).click())
    fireEvent.click(within(map).getByRole('button', { name: 'Example B Club, Example Village' }))
    expect(card('b').getAttribute('data-selected')).toBeNull()
    expect(sheet().getAttribute('data-sheet')).toBe('low')
  })

  it('goes back to its low rest when the focus moves at the full rest to something it covers, and stays up for its own cards and the controls', async () => {
    const { map } = await drawWithMap()
    fireEvent.click(within(sheet()).getByRole('button', { name: words.SHOW_LIST }))
    act(() => card('c').focus())
    // Real boxes, since checkpoint Y's review, so the case tells a control above the sheet from one it covers: the sheet's
    // top at 400, A to Z's foot at 300, above it, and then at 500, under it.
    const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect
    vi.spyOn(sheet(), 'getBoundingClientRect').mockReturnValue(box(400, 800))
    const aToZ = screen.getByRole('button', { name: words.A_TO_Z })
    const aToZBox = vi.spyOn(aToZ, 'getBoundingClientRect').mockReturnValue(box(256, 300))
    act(() => aToZ.focus())
    expect(sheet().getAttribute('data-sheet')).toBe('full')
    act(() => card('c').focus())
    aToZBox.mockReturnValue(box(456, 500))
    act(() => aToZ.focus())
    expect(sheet().getAttribute('data-sheet')).toBe('low')
    fireEvent.click(within(sheet()).getByRole('button', { name: words.SHOW_LIST }))
    expect(sheet().getAttribute('data-sheet')).toBe('full')
    act(() => within(map).getByRole('button', { name: 'Example A Club, Example City' }).focus())
    expect(sheet().getAttribute('data-sheet')).toBe('low')
  })

  it('scrolls a control that takes the focus under the low sheet up clear of it, and moves nothing for the sheet\'s own', async () => {
    await drawWithMap()
    const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 0, width: 0, height: bottom - top, x: 0, y: top, toJSON() {} }) as DOMRect
    vi.spyOn(sheet(), 'getBoundingClientRect').mockReturnValue(box(400, 600))
    const scrolledBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const skip = screen.getByRole('link', { name: words.SKIP_TO_LIST })
    vi.spyOn(skip, 'getBoundingClientRect').mockReturnValue(box(456, 500))
    act(() => skip.focus())
    expect(scrolledBy).toHaveBeenLastCalledWith({ top: 108, behavior: 'instant' })
    scrolledBy.mockClear()
    const aToZ = screen.getByRole('button', { name: words.A_TO_Z })
    vi.spyOn(aToZ, 'getBoundingClientRect').mockReturnValue(box(300, 344))
    act(() => aToZ.focus())
    expect(scrolledBy).not.toHaveBeenCalled()
    act(() => within(sheet()).getByRole('button', { name: words.SHOW_LIST }).focus())
    expect(scrolledBy).not.toHaveBeenCalled()
  })

  it('brings its list back to the top when the focus moving to something the full sheet covers lowers it', async () => {
    const { map } = await drawWithMap()
    fireEvent.click(within(sheet()).getByRole('button', { name: words.SHOW_LIST }))
    const scroller = sheet().querySelector<HTMLElement>('[class*="overflow-y-auto"]')!
    scroller.scrollTop = 120
    expect(scroller.scrollTop).toBe(120)
    act(() => within(map).getByRole('button', { name: 'Example A Club, Example City' }).focus())
    expect(sheet().getAttribute('data-sheet')).toBe('low')
    expect(scroller.scrollTop).toBe(0)
  })

  it('Skip to the list gives the focus to the sheet and leaves the address and the rest as they are', async () => {
    const { view } = await drawWithMap()
    const skip = screen.getByRole('link', { name: words.SKIP_TO_LIST })
    expect(skip.compareDocumentPosition(screen.getByRole('group', { name: 'Map of the clubs' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(skip)
    expect(document.activeElement).toBe(sheet())
    expect(sheet().getAttribute('data-sheet')).toBe('low')
    expect(view.container.querySelector('[data-slot="club-directory"]')?.getAttribute('data-address')).toBe('')
  })

  it('keeps both rests above the dock, by the height the dock writes, and keeps the controls over the sheet clear of it', async () => {
    const { view, map } = await drawWithMap()
    expect(sheet().style.position).toBe('sticky')
    expect(sheet().style.bottom).toBe('var(--bottom-chrome-h, 0px)')
    // A control the keyboard moves to over the low sheet is scrolled clear of it; the sheet's own controls are not.
    const clear = '[&_:is(a,button,input)]:scroll-mb-[min(var(--sheet-low,16rem),50dvh)]'
    expect(map.closest('#map')!.className).toContain(clear)
    expect(screen.getByRole('textbox', { name: words.FIELD_LABEL }).closest(`[class*="scroll-mb"]`)).not.toBeNull()
    expect(sheet().querySelector('[class*="scroll-mb"]')).toBeNull()
    fireEvent.click(within(sheet()).getByRole('button', { name: words.SHOW_LIST }))
    expect(sheet().style.position).toBe('fixed')
    expect(sheet().style.bottom).toBe('var(--bottom-chrome-h, 0px)')
    expect(sheet().style.top).toContain('--sheet-top')
    // The full sheet leaves its low height in the page, so the page does not jump.
    expect(view.container.querySelector('[data-sheet-room]')).not.toBeNull()
  })
})

describe('the phone layout with no map', () => {
  it('draws the list alone with its one line, and no sheet, no Skip to the list and no map', () => {
    draw()
    expect(screen.getByText(words.NO_MAP)).toBeTruthy()
    expect(screen.queryByRole('region', { name: words.LIST_SHEET })).toBeNull()
    expect(screen.queryByRole('link', { name: words.SKIP_TO_LIST })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Map of the clubs' })).toBeNull()
    expect(screen.getByRole('list', { name: 'Clubs, A to Z' })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: words.NOT_HERE })).toBeTruthy()
  })
})

describe('the Filters sheet on a phone', () => {
  const filtersButton = () => screen.getByRole('button', { name: /^Filters/ })

  it('is a dialog named Filters, with the same chips and counts, Clear and Done, and its own Close', async () => {
    await drawWithMap()
    const button = filtersButton()
    expect(button.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: words.FILTERS_TITLE })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(within(dialog).getAllByRole('group').map((g) => g.querySelector('legend')?.textContent)).toEqual([words.REGION, words.OWN_WORD])
    expect(within(dialog).getByRole('button', { name: 'New Orleans Metro 1' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'North Louisiana 2' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: `${words.WEEKENDS} 1` })).toBeTruthy()
    for (const name of [words.CLEAR, words.DONE, words.CLOSE]) expect(within(dialog).getByRole('button', { name })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'North Louisiana 2' }))
    // The page behind the open sheet is hidden from a screen reader, so the cards are read by their marks.
    expect([...document.querySelectorAll('#club-list [data-card]')].map((a) => a.getAttribute('data-card'))).toEqual(['b', 'c'])
    fireEvent.click(within(dialog).getByRole('button', { name: words.CLEAR }))
    expect(within(dialog).getByRole('button', { name: 'North Louisiana 2' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('gives the focus back to the Filters button after Escape, Close and Done', async () => {
    await drawWithMap()
    const button = filtersButton()
    for (const shut of ['Escape', words.CLOSE, words.DONE]) {
      act(() => button.focus())
      fireEvent.click(button)
      const dialog = screen.getByRole('dialog', { name: words.FILTERS_TITLE })
      await waitFor(() => expect(dialog.contains(document.activeElement), shut).toBe(true))
      if (shut === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape' })
      else fireEvent.click(within(dialog).getByRole('button', { name: shut }))
      expect(screen.queryByRole('dialog')).toBeNull()
      await waitFor(() => expect(document.activeElement, shut).toBe(button))
      expect(button.getAttribute('aria-expanded')).toBe('false')
    }
  })

  it('stays the panel under the button at wide widths', async () => {
    narrow = false
    await drawWithMap()
    expect(filtersButton().getAttribute('aria-haspopup')).toBeNull()
    fireEvent.click(filtersButton())
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('[data-slot="club-filters"]')?.hasAttribute('hidden')).toBe(false)
    expect(screen.queryByRole('region', { name: words.LIST_SHEET })).toBeNull()
    expect(screen.getByRole('link', { name: words.SKIP_TO_MAP })).toBeTruthy()
  })
})

describe('Not here?, at every width', () => {
  /** The three tiles under the list: each its question, then its one link or its one sentence. */
  function tiles() {
    const section = screen.getByRole('region', { name: words.NOT_HERE })
    return { section, items: within(section).getAllByRole('listitem') }
  }

  it('draws three tiles under the list, two leading to step 30\'s form and one sentence on Suggest an update, naming no one', async () => {
    for (const phone of [false, true]) {
      for (const withMap of [false, true]) {
        narrow = phone
        if (withMap) await drawWithMap()
        else draw()
        const { section, items } = tiles()
        expect(within(section).getByRole('heading', { level: 2 }).textContent).toBe(words.NOT_HERE)
        expect(items.map((li) => within(li).getByRole('heading', { level: 3 }).textContent)).toEqual([words.MISSING_CLUB, words.NO_CLUB_NEAR, words.OUT_OF_DATE])
        expect(within(items[0]).getByRole('link', { name: words.SUGGEST_A_CLUB }).getAttribute('href')).toBe('/clubs/suggest')
        expect(within(items[1]).getByRole('link', { name: words.START_ONE }).getAttribute('href')).toBe('/clubs/suggest?kind=start')
        expect(within(items[2]).queryByRole('link')).toBeNull()
        expect(within(items[2]).getByText(words.OUT_OF_DATE_HOW).tagName).toBe('P')
        expect(words.OUT_OF_DATE_HOW).toContain('Suggest an update')
        // Under the list, and after the map where one is drawn; in the sheet on a phone with a map.
        const list = screen.getByRole('list', { name: 'Clubs, A to Z' })
        expect(list.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        if (withMap) expect(screen.getByRole('group', { name: 'Map of the clubs' }).compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        expect(section.closest('#club-list') !== null).toBe(phone && withMap)
        expect(section.textContent).not.toMatch(/keeper|representative|\bseat\b|\brep\b|@|mailto|volunteer/i)
        cleanup()
        vi.unstubAllEnvs()
        vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
        delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
      }
    }
  })

  it('draws no tiles for an empty answer, which is one sentence', () => {
    draw([])
    expect(screen.queryByRole('region', { name: words.NOT_HERE })).toBeNull()
    expect(screen.getByText(words.NO_CLUBS)).toBeTruthy()
  })
})
