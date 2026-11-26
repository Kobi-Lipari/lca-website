// @vitest-environment jsdom
//
// The edges of the Clubs directory's filters (WS09 step 34), beside
// test/unit/club-filters.test.tsx: src/areas/clubs/components/ClubFilters.tsx
// inside src/areas/clubs/components/ClubDirectory.tsx, drawn from made-up clubs.
// - the regions offered are those of REGIONS that have a club, counted from
//   the clubs given and never from the narrowed list; no club with a region
//   gives no region to choose;
// - the filters together pass only a club that passes each, and the pins
//   follow the list in the order the list is in, with a place and without;
// - Clear takes the filters off and leaves a place; Done leaves the filters
//   on; a typed name is kept through a filter;
// - the address is read forgivingly and written in one order.
// Every club and name here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGIONS } from '@domain/clubs/regions'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import * as words from '@/areas/clubs/directoryWords'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, region: string | null, point: [number, number] | null, weekends = false, scholastic = false): ApiClubDirectoryItem {
  return {
    id, name, city: 'Baker', meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: weekends, scholastic_friendly: scholastic,
  }
}

const CLUBS: ApiClubDirectoryItem[] = [
  row('c-pine', 'Example Pine Club', 'North Louisiana', [32.5, -93.75], true, false),
  row('c-river', 'Example River Club', 'Baton Rouge / East Central', [30.45, -91.15], true, true),
  row('c-harbor', 'Example Harbor Club', 'New Orleans Metro', null, false, true),
  row('c-knights', 'Example Knights Club', 'Baton Rouge / East Central', [30.59, -91.17]),
  row('c-delta', 'Example Delta Club', 'North Louisiana', [32.5, -92.1], true, false),
  row('c-oak', 'Example Oak Club', 'Lafayette / South Central', null, true, true),
]

function Address() {
  const { search } = useLocation()
  return <span data-testid="address">{search}</span>
}

async function draw(at = '/clubs', clubs = CLUBS, withMap = false) {
  if (withMap) {
    vi.stubEnv('MODE', 'a11y')
    ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  }
  const view = render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={clubs} /><Address /></MemoryRouter>)
  const map = withMap ? await screen.findByRole('group', { name: 'Map of the clubs' }) : null
  return { view, map }
}

const address = () => screen.getByTestId('address').textContent
const status = () => screen.getByRole('status')
const names = () => {
  const list = screen.queryByRole('list', { name: /^Clubs, / })
  return list ? within(list).queryAllByRole('listitem').map((li) => li.querySelector('a > span > span')?.textContent) : []
}
const filtersButton = () => screen.getByRole('button', { name: /^Filters/ })
const open = () => fireEvent.click(filtersButton())
const panel = () => document.getElementById(filtersButton().getAttribute('aria-controls')!)!
const chips = (group: number) => within(within(panel()).getAllByRole('group')[group]).queryAllByRole('button').map((b) => b.textContent)
const chip = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label.replace(/[/]/g, '\\/')} \\d+$`) })
/** The clubs the map draws: each pin, and each circle's own count of the pins it holds, with the ids of the pins drawn singly. */
const drawn = (map: HTMLElement) => ({
  singles: [...map.querySelectorAll('[data-pin]')].map((p) => p.getAttribute('data-pin')!),
  total: map.querySelectorAll('[data-pin]').length + [...map.querySelectorAll('[data-circle]')].reduce((sum, c) => sum + Number(c.querySelector('text')?.textContent ?? 0), 0),
})

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

describe('the regions offered', () => {
  it('lists only regions of REGIONS that have a club, in REGIONS\' order, with counts that add up to the clubs that have a region', async () => {
    await draw()
    open()
    const got = chips(0)
    // Counted from the clubs: each region of REGIONS that has one, in REGIONS' order.
    expect(got).toEqual(REGIONS.map((region) => [region, CLUBS.filter((club) => club.region === region).length] as const).filter(([, count]) => count > 0).map(([region, count]) => `${region} ${count}`))
    expect(got).toHaveLength(4)
    expect(REGIONS).toHaveLength(5)
    const order = got.map((text) => REGIONS.findIndex((region) => text!.startsWith(region)))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(got.reduce((sum, text) => sum + Number(text!.match(/(\d+)$/)![1]), 0)).toBe(CLUBS.filter((club) => club.region !== null).length)
  })

  it('gives no region to choose when no club has one, and the ticks still count', async () => {
    await draw('/clubs', CLUBS.map((club) => ({ ...club, region: null })))
    open()
    expect(chips(0)).toEqual([])
    expect(chips(1)).toEqual(['Plays on weekends 4', 'Scholastic friendly 3'])
  })

  it('names a region no club of this list is in only when the address chose it, and never a sixth', async () => {
    await draw('/clubs?region=lake-charles')
    open()
    const got = chips(0)
    expect(got.some((text) => text!.startsWith(REGIONS.find((r) => r.startsWith('Lake'))!))).toBe(true)
    expect(got.length).toBeLessThanOrEqual(REGIONS.length)
  })

  it('counts each choice from every club, never from the list a filter or a name has narrowed', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await draw()
    open()
    const before = [chips(0), chips(1)]
    fireEvent.click(chip('North Louisiana'))
    fireEvent.click(chip(words.WEEKENDS))
    fireEvent.change(screen.getByRole('textbox', { name: words.FIELD_LABEL }), { target: { value: 'pine' } })
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
    expect([chips(0), chips(1)]).toEqual(before)
  })
})

describe('the filters together', () => {
  it('pass only a club that passes each: a region, weekends and scholastic, in any order', async () => {
    await draw()
    open()
    fireEvent.click(chip(words.SCHOLASTIC))
    expect(names()).toEqual(['Example Harbor Club', 'Example Oak Club', 'Example River Club'])
    fireEvent.click(chip(words.WEEKENDS))
    expect(names()).toEqual(['Example Oak Club', 'Example River Club'])
    fireEvent.click(chip('Baton Rouge / East Central'))
    expect(names()).toEqual(['Example River Club'])
    expect(status().textContent).toBe('1 club matches · Clear filters')
    expect(address()).toBe('?region=baton-rouge&weekends=1&scholastic=1')
    fireEvent.click(chip(words.SCHOLASTIC))
    expect(names()).toEqual(['Example River Club'])
    fireEvent.click(chip(words.WEEKENDS))
    expect(names()).toEqual(['Example Knights Club', 'Example River Club'])
  })

  it('narrow the pins to the list\'s own clubs that have a point, with a place and without, and never draw a club the filters leave out', async () => {
    const { map } = await draw('/clubs?weekends=1', CLUBS, true)
    // The club with no point is in the list and has no pin; the clubs that do not play on weekends are in neither.
    expect(names()).toEqual(['Example Delta Club', 'Example Oak Club', 'Example Pine Club', 'Example River Club'])
    await waitFor(() => expect(drawn(map!).total).toBe(3))
    expect(drawn(map!).singles.every((id) => ['c-delta', 'c-pine', 'c-river'].includes(id))).toBe(true)
    cleanup()
    const near = await draw('/clubs?weekends=1&near=70808', CLUBS, true)
    expect(names()).toEqual(['Example River Club', 'Example Delta Club', 'Example Pine Club', 'Example Oak Club'])
    await waitFor(() => expect(drawn(near.map!).total).toBe(3))
    expect(drawn(near.map!).singles.every((id) => ['c-delta', 'c-pine', 'c-river'].includes(id))).toBe(true)
    cleanup()
    const none = await draw('/clubs?weekends=1&scholastic=1&region=north-louisiana', CLUBS, true)
    expect(names()).toEqual([])
    await waitFor(() => expect(drawn(none.map!).total).toBe(0))
  })

  it('keep a typed name, so the count says how many of the filtered clubs match, and Show all brings back those the filters leave', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await draw('/clubs?weekends=1')
    fireEvent.change(screen.getByRole('textbox', { name: words.FIELD_LABEL }), { target: { value: 'river' } })
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
    expect(status().textContent).toBe('1 club matches river · Show all 4')
    open()
    fireEvent.click(chip(words.SCHOLASTIC))
    expect(status().textContent).toBe('1 club matches river · Show all 2')
    expect((screen.getByRole('textbox', { name: words.FIELD_LABEL }) as HTMLInputElement).value).toBe('river')
    fireEvent.click(within(status()).getByRole('button', { name: 'Show all 2' }))
    expect(names()).toEqual(['Example Oak Club', 'Example River Club'])
    expect(address()).toBe('?weekends=1&scholastic=1')
  })

  it('say none match, with a name too, in the filters\' words and not the name\'s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await draw('/clubs?region=lafayette&scholastic=1&weekends=1')
    expect(names()).toEqual(['Example Oak Club'])
    cleanup()
    await draw('/clubs?region=north-louisiana&scholastic=1')
    expect(status().textContent).toBe('No clubs match these filters. Clear filters.')
    fireEvent.change(screen.getByRole('textbox', { name: words.FIELD_LABEL }), { target: { value: 'pine' } })
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
    expect(status().textContent).toBe('No clubs match these filters. Clear filters.')
  })
})

describe('Clear and Done', () => {
  it('Clear takes every filter off and leaves a place and its order; Done leaves the filters on and the panel shut', async () => {
    await draw('/clubs?near=70808&region=north-louisiana&weekends=1')
    open()
    fireEvent.click(screen.getByRole('button', { name: words.DONE }))
    expect(filtersButton().getAttribute('aria-expanded')).toBe('false')
    expect(address()).toBe('?near=70808&region=north-louisiana&weekends=1')
    expect(filtersButton().textContent).toBe(words.filtersButton(2))
    open()
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR }))
    expect(address()).toBe('?near=70808')
    expect(filtersButton().getAttribute('aria-expanded')).toBe('true')
    expect(names()[0]).toBe('Example River Club')
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    // Clear again, with nothing on, changes nothing.
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR }))
    expect(address()).toBe('?near=70808')
  })

  it('keeps the panel open through a choice, and a second press of a tick lets it go', async () => {
    await draw()
    open()
    fireEvent.click(chip(words.WEEKENDS))
    expect(filtersButton().getAttribute('aria-expanded')).toBe('true')
    expect(chip(words.WEEKENDS).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip(words.WEEKENDS))
    expect(chip(words.WEEKENDS).getAttribute('aria-pressed')).toBe('false')
    expect(address()).toBe('')
    expect(filtersButton().textContent).toBe('Filters')
  })

  it('gives the focus to the field after Clear filters, from the caption', async () => {
    await draw('/clubs?weekends=1')
    fireEvent.click(within(status()).getByRole('button', { name: words.CLEAR_FILTERS }))
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: words.FIELD_LABEL }))
    expect(names()).toHaveLength(6)
  })
})

describe('the address', () => {
  it('reads a tick written the ways the address allows, lets go of the others, and writes one order whatever the order read', async () => {
    await draw('/clubs?scholastic=0&weekends=YES')
    expect(names()).toEqual(['Example Delta Club', 'Example Oak Club', 'Example Pine Club', 'Example River Club'])
    cleanup()
    await draw('/clubs?weekends=1&region=baton-rouge&near=70808&sort=az&weekends=0')
    open()
    fireEvent.click(chip(words.SCHOLASTIC))
    expect(address()).toBe('?near=70808&sort=az&region=baton-rouge&weekends=1&scholastic=1')
  })

  it('never writes a region\'s whole title, a count or a name into the address', async () => {
    await draw()
    open()
    for (const label of ['North Louisiana', 'Baton Rouge / East Central', 'Lafayette / South Central']) {
      fireEvent.click(chip(label))
      expect(address()).toMatch(/^\?region=[a-z-]+$/)
      expect(address()).not.toMatch(/%|\+|\d/)
    }
  })
})
