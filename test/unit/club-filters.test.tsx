// @vitest-environment jsdom
//
// The Clubs directory's filters (WS09 step 34):
// src/areas/clubs/components/ClubFilters.tsx inside
// src/areas/clubs/components/ClubDirectory.tsx, drawn from made-up clubs.
// - the panel under the Filters button, told by aria-expanded, with the
//   regions that have a club, each counted, never typed, and the two ticks
//   under "Only clubs that say so themselves", each a filter chip;
// - a filter narrows the list and the pins together, and lives in the
//   address; the caption counts, with Clear filters as a button, and none
//   matching reads its own words;
// - with a typed name too, the caption is the name's and the Filters button
//   says how many filters are on; the panel's Clear and Done;
// - the filters and a place together, and the address read on load;
// - the plain-language rules over the new files.
// Every club and name here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGIONS } from '@domain/clubs/regions'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import * as words from '@/areas/clubs/directoryWords'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string | null, point: [number, number] | null, weekends = false, scholastic = false): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: weekends, scholastic_friendly: scholastic,
  }
}

/** Six made-up clubs in three of the five regions, one in none of them; three play on weekends and two are scholastic friendly, by their own word. */
const CLUBS: ApiClubDirectoryItem[] = [
  row('c-pine', 'Example Pine Club', 'Shreveport', 'North Louisiana', [32.5, -93.75], true, false),
  row('c-river', 'Example River Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15], true, true),
  row('c-harbor', 'Example Harbor Club', 'Kenner', null, null, false, true),
  row('c-knights', 'Example Knights Club', 'Baker', 'Baton Rouge / East Central', [30.59, -91.17]),
  row('c-delta', 'Example Delta Club', 'Monroe', 'North Louisiana', [32.5, -92.1], true, false),
  row('c-oak', 'Example Oak Club', 'Lafayette', 'Lafayette / South Central', null),
]

function Address() {
  const { search } = useLocation()
  return <span data-testid="address">{search}</span>
}

function draw(at = '/clubs') {
  return render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={CLUBS} /><Address /></MemoryRouter>)
}

async function drawWithMap(at = '/clubs') {
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  const view = draw(at)
  const map = await screen.findByRole('group', { name: 'Map of the clubs' })
  return { view, map }
}

const address = () => screen.getByTestId('address').textContent
const status = () => screen.getByRole('status')
const names = () => {
  const list = screen.queryByRole('list', { name: /^Clubs, / })
  return list ? within(list).queryAllByRole('listitem').map((li) => li.querySelector('a > span > span')?.textContent) : []
}
const filtersButton = () => screen.getByRole('button', { name: /^Filters/ })
const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label.replace(/[/]/g, '\\/')} \\d+$`) })
const open = () => fireEvent.click(filtersButton())

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
})

describe('the panel', () => {
  it('opens under the Filters button, told by aria-expanded, with each region that has a club and its count, and the two ticks with theirs', () => {
    draw()
    const button = filtersButton()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const panel = document.getElementById(button.getAttribute('aria-controls')!)!
    expect(panel.hidden).toBe(true)
    expect(panel.childElementCount).toBe(0)
    open()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    const [region, ticks] = within(panel).getAllByRole('group')
    expect(within(region).getByText(words.REGION).tagName).toBe('LEGEND')
    // Counted from the clubs: three of the five regions have a club, in the order of REGIONS; the club in none of them is in none.
    expect(within(region).getAllByRole('button').map((b) => b.textContent)).toEqual(['Baton Rouge / East Central 2', 'Lafayette / South Central 1', 'North Louisiana 2'])
    expect(REGIONS.filter((r) => ['Baton Rouge / East Central', 'Lafayette / South Central', 'North Louisiana'].includes(r))).toEqual(['Baton Rouge / East Central', 'Lafayette / South Central', 'North Louisiana'])
    expect(within(ticks).getByText(words.OWN_WORD).tagName).toBe('LEGEND')
    expect(within(ticks).getAllByRole('button').map((b) => b.textContent)).toEqual(['Plays on weekends 3', 'Scholastic friendly 2'])
    expect(within(panel).getByRole('button', { name: words.CLEAR })).toBeTruthy()
    expect(within(panel).getByRole('button', { name: words.DONE })).toBeTruthy()
    // The chips are toggles told by aria-pressed, never boxes to tick, and there is no Copy link.
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /copy/i })).toBeNull()
    for (const b of within(panel).getAllByRole('button').filter((el) => el.hasAttribute('aria-pressed'))) expect(b.getAttribute('aria-pressed')).toBe('false')
  })

  it('Done closes the panel and gives the focus back to the button, and Escape does too', () => {
    draw()
    open()
    fireEvent.click(screen.getByRole('button', { name: words.DONE }))
    expect(filtersButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(filtersButton())
    open()
    const weekends = chip(words.WEEKENDS)
    act(() => weekends.focus())
    fireEvent.keyDown(weekends, { key: 'Escape' })
    expect(filtersButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(filtersButton())
  })
})

describe('the filters on the list and the pins', () => {
  it('a region narrows the list and the pins together, lives in the address, and the caption counts with Clear filters as a button', async () => {
    const { map } = await drawWithMap()
    expect(map.querySelectorAll('[data-pin], [data-circle]').length).toBe(4)
    open()
    fireEvent.click(chip('North Louisiana'))
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
    expect([...map.querySelectorAll('[data-pin]')].map((p) => p.getAttribute('data-pin'))).toEqual(['c-delta', 'c-pine'])
    expect(address()).toBe('?region=north-louisiana')
    expect(status().textContent).toBe('2 clubs match · Clear filters')
    expect(chip('North Louisiana').getAttribute('aria-pressed')).toBe('true')
    expect(chip('North Louisiana').querySelector('svg')).not.toBeNull()
    expect(filtersButton().textContent).toBe(words.filtersButton(1))
    // One region at a time: another takes its place, and a second press lets it go.
    fireEvent.click(chip('Lafayette / South Central'))
    expect(address()).toBe('?region=lafayette')
    fireEvent.click(chip('Lafayette / South Central'))
    expect(address()).toBe('')
    fireEvent.click(chip('North Louisiana'))
    fireEvent.click(within(status()).getByRole('button', { name: words.CLEAR_FILTERS }))
    expect(names()).toHaveLength(6)
    expect(address()).toBe('')
    expect(map.querySelectorAll('[data-pin], [data-circle]').length).toBe(4)
  })

  it('the two ticks pass only the clubs that say so themselves, and none matching reads its own words with Clear filters', () => {
    draw()
    open()
    fireEvent.click(chip(words.WEEKENDS))
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club', 'Example River Club'])
    fireEvent.click(chip(words.SCHOLASTIC))
    expect(names()).toEqual(['Example River Club'])
    expect(address()).toBe('?weekends=1&scholastic=1')
    expect(filtersButton().textContent).toBe(words.filtersButton(2))
    fireEvent.click(chip('Lafayette / South Central'))
    expect(names()).toEqual([])
    expect(status().textContent).toBe('No clubs match these filters. Clear filters.')
    fireEvent.click(within(status()).getByRole('button', { name: words.CLEAR_FILTERS }))
    expect(names()).toHaveLength(6)
    expect(status().textContent).toBe(words.listCaption(6))
  })

  it('with a typed name too, the caption is the name\'s, the Filters button says how many are on, and the panel\'s Clear clears them', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    draw('/clubs?weekends=1&region=north-louisiana')
    fireEvent.change(screen.getByRole('textbox', { name: words.FIELD_LABEL }), { target: { value: 'pine' } })
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
    expect(names()).toEqual(['Example Pine Club'])
    // "Show all" brings back the clubs the filters leave, so its count is theirs.
    expect(status().textContent).toBe('1 club matches pine · Show all 2')
    expect(filtersButton().textContent).toBe('Filters · 2 on')
    open()
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR }))
    expect(filtersButton().textContent).toBe('Filters')
    expect(address()).toBe('')
    expect(status().textContent).toBe('1 club matches pine · Show all 6')
  })
})

describe('the filters and the address', () => {
  it('applies the filters the address holds on load, lets go a region no region has, and keeps a place and the filters in its one order', () => {
    draw('/clubs?scholastic=yes&region=nowhere')
    expect(names()).toEqual(['Example Harbor Club', 'Example River Club'])
    expect(filtersButton().textContent).toBe(words.filtersButton(1))
    cleanup()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    draw('/clubs?region=baton-rouge')
    fireEvent.change(screen.getByRole('textbox', { name: words.FIELD_LABEL }), { target: { value: '71101' } })
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
    // Nearest first from Shreveport among the filtered clubs; none is removed by the order.
    expect(names()).toEqual(['Example Knights Club', 'Example River Club'])
    expect(address()).toBe('?near=71101&region=baton-rouge')
    open()
    fireEvent.click(chip(words.WEEKENDS))
    expect(address()).toBe('?near=71101&region=baton-rouge&weekends=1')
    expect(names()).toEqual(['Example River Club'])
  })

  it('lets go a ZIP code in the address that is no place it knows, so a later choice never writes it back', () => {
    // 10001 is five digits and no ZIP code of the points file: the page shows no place, and the filter's address carries none.
    draw('/clubs?near=10001&sort=nearest')
    expect(screen.queryByRole('button', { name: words.CLEAR_PLACE })).toBeNull()
    open()
    fireEvent.click(chip(words.WEEKENDS))
    expect(address()).toBe('?weekends=1')
  })
})

describe('the plain-language rules over the new files', () => {
  const ROOT = resolve(__dirname, '../..')
  const FILES = [
    'src/areas/clubs/components/PlaceField.tsx', 'src/areas/clubs/components/ClubFilters.tsx', 'src/areas/clubs/components/ClubDirectory.tsx', 'src/areas/clubs/directoryWords.ts',
    'test/unit/place-field.test.tsx', 'test/unit/club-filters.test.tsx', 'test/a11y/clubs-directory-place.spec.ts',
  ]
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
  const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD_NAME = new RegExp(`USC${'F'}`)

  it('writes no long dash, never the old name of US Chess, and in the page\'s files no keeper, seat or representative and no fetch', () => {
    for (const path of FILES) {
      expect(read(path), path).not.toMatch(LONG_DASH)
      expect(read(path), path).not.toMatch(OLD_NAME)
    }
    for (const path of FILES.filter((p) => p.startsWith('src/'))) {
      const text = read(path).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(text, path).not.toMatch(/keeper|representative|\bseat\b|\bfetch\(|localStorage|sessionStorage|console\./i)
    }
  })

  it('says every state in words the page writes once, with ZIP as the entry writes it and nothing that names a club', () => {
    expect([words.NOT_FOUND, words.OUTSIDE, words.noClubIn('Natchitoches'), words.START_A_CLUB, words.NEAREST_WHY, words.NO_DISTANCE, words.CLEAR_PLACE, words.nearYou('Baton Rouge', '70808')]).toEqual([
      'We couldn\'t get your location. Type a city or ZIP.', 'That\'s outside Louisiana. Type a Louisiana city or ZIP.', 'No club in Natchitoches yet. The nearest are listed first.', 'Start a club?',
      'Press Near me, or type a place', 'Distance not known', 'Clear location', 'Near you: Baton Rouge 70808',
    ])
    expect(words.townWords('st francisville')).toBe('St. Francisville')
    expect(words.townWords('bayou l\'ourse')).toBe('Bayou L\'Ourse')
    expect(words.filtersButton(0)).toBe('Filters')
  })
})
