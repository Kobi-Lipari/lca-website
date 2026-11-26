// @vitest-environment jsdom
//
// The edges of the Clubs directory's field, Near me and orders (WS09 step 34),
// beside test/unit/place-field.test.tsx and test/unit/club-filters.test.tsx:
// src/areas/clubs/components/ClubDirectory.tsx drawn from made-up clubs.
// - whatever is typed, the address holds a five-digit ZIP code or nothing,
//   and the page never takes the text for markup;
// - the orders at their edges: no club with a point, every club past 75
//   miles, clubs at one point, a club at the ZIP code's own point, one club,
//   no club at all, filters that leave none, and a list that changes under a
//   place;
// - Near me at its edges: each kind of refusal, a device that throws, an
//   answer that comes twice or after the page is gone, a point on either side
//   of the line the page draws round Louisiana, a typed name kept through a
//   press, a place typed while the device is still asked;
// - the place and the filters are written in place of the last address, so
//   Back leaves the page, and carry no state beside it;
// - the page's source asks the server nothing and keeps nothing.
// Every club and name here is made up; the places are real towns.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nearestZip, zipPoint } from '@domain/clubs/nearZip'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { FARTHEST_MILES } from '@/areas/clubs/components/PlaceField'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import * as words from '@/areas/clubs/directoryWords'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string | null, point: [number, number] | null): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: point ? { latitude: point[0], longitude: point[1] } : null,
    weekend_play: false, scholastic_friendly: false,
  }
}

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

const DEVICE = { latitude: 30.4517, longitude: -91.1288 }

function Probe() {
  const { search, state, hash } = useLocation()
  const type = useNavigationType()
  return <span data-testid="probe" data-search={search} data-state={JSON.stringify(state)} data-hash={hash} data-type={type} />
}

function draw(at = '/clubs', clubs = CLUBS) {
  return render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={clubs} /><Probe /></MemoryRouter>)
}
function redraw(view: ReturnType<typeof draw>, clubs: ApiClubDirectoryItem[]) {
  view.rerender(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={clubs} /><Probe /></MemoryRouter>)
}

const probe = () => screen.getByTestId('probe')
const address = () => probe().getAttribute('data-search')
const field = () => screen.getByRole('textbox', { name: words.FIELD_LABEL }) as HTMLInputElement
const status = () => screen.getByRole('status')
const list = () => screen.queryByRole('list', { name: /^Clubs, / })
const names = () => (list() ? within(list()!).queryAllByRole('listitem').map((li) => li.querySelector('a > span > span')?.textContent) : [])
const cards = () => (list() ? within(list()!).queryAllByRole('link').map((a) => a.querySelector('span')?.textContent) : [])
const hrefs = () => (list() ? within(list()!).queryAllByRole('link').map((a) => a.getAttribute('href')) : [])
const dividers = () => [...(list()?.querySelectorAll('[data-divider]') ?? [])].map((d) => d.textContent)

function type(text: string) {
  fireEvent.change(field(), { target: { value: text } })
  act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS) })
}
const enter = () => fireEvent.submit(field().closest('form')!)

type Asked = { ok: PositionCallback; fail?: PositionErrorCallback | null }
function standInLocation(impl?: () => void) {
  const asked: Asked[] = []
  const geolocation = {
    getCurrentPosition: vi.fn((ok: PositionCallback, fail?: PositionErrorCallback | null) => {
      if (impl) impl()
      else asked.push({ ok, fail })
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  }
  Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
  return { geolocation, asked }
}
const position = (point: { latitude: number; longitude: number }) => ({ coords: { ...point, accuracy: 20 }, timestamp: 0 }) as unknown as GeolocationPosition
const failure = (code: number) => ({ code, message: 'no', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }) as GeolocationPositionError

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
})

describe('whatever is typed', () => {
  const TEXTS = [
    '<img src=x onerror=alert(1)>', '<script>alert(1)</script>', 'x'.repeat(5000), '70808; drop table clubs', '70808 70809', '"quoted"', 'Baton Rouge\u0000',
    '\u{1F3B2} chess', '??near=70808', 'a&near=70808&sort=az', '%3Cb%3E', '#map', '../../admin', 'null', 'undefined', '__proto__',
  ]

  it('writes into the address a five-digit ZIP code or nothing, never the text, and draws the text only as text', () => {
    draw()
    for (const text of TEXTS) {
      type(text)
      expect(address(), text.slice(0, 20)).toMatch(/^(\?near=\d{5})?$/)
      expect(document.querySelector('img, script, b')).toBeNull()
      expect(probe().getAttribute('data-state')).toBe('null')
      expect(probe().getAttribute('data-hash')).toBe('')
      expect(names().length, text.slice(0, 20)).toBeLessThanOrEqual(6)
    }
  })

  it('treats a name made only of spaces or marks as no name: the whole list, its own caption, no note', () => {
    draw()
    for (const text of ['   ', '\t', '...', '---', '!!']) {
      type(text)
      expect(names(), JSON.stringify(text)).toEqual(A_TO_Z)
      expect(status().querySelector('[data-note]')).toBeNull()
      expect(status().textContent).toBe(words.listCaption(6))
      expect(address()).toBe('')
    }
  })

  it('reads a ZIP code or a town however it is padded, cased or followed by the state', () => {
    draw()
    for (const [text, zip] of [[' 70808 ', '70808'], ['70808-1234', '70808'], ['BATON ROUGE', '70806'], ['baton rouge, la', '70806'], ['Baton Rouge, Louisiana', '70806'], ['  lafayette ', '70503']] as const) {
      type(text)
      expect(address(), text).toBe(`?near=${zip}`)
      expect(names().length).toBe(6)
      expect(field().value).toBe('')
    }
  })

  it('keeps a typed name through the place: the order stays nearest first, the caption is the name\'s, and the address holds only the place', () => {
    draw('/clubs?near=70808')
    type('kni')
    expect(names()).toEqual(['Example Knights Club'])
    expect(cards()).toEqual(['Example Knights Club · Baker · about 13 mi'])
    expect(status().textContent).toBe('1 club matches kni · Show all 6')
    expect(address()).toBe('?near=70808')
    expect(list()!.getAttribute('aria-label')).toBe(words.LIST_NEAREST)
    expect(dividers()).toEqual([])
    // A place typed after the name takes the field's text with it, and the name goes.
    type('71101')
    expect(address()).toBe('?near=71101')
    expect(names().length).toBe(6)
    expect(names()[0]).toBe('Example Pine Club')
    expect(status().textContent).not.toMatch(/matches/)
  })

  it('reads the Enter key at once and the pause after it does not read it a second time', () => {
    draw()
    fireEvent.change(field(), { target: { value: '70808' } })
    enter()
    expect(address()).toBe('?near=70808')
    expect(field().value).toBe('')
    const before = document.body.innerHTML
    act(() => { vi.advanceTimersByTime(words.TYPING_PAUSE_MS * 3) })
    expect(document.body.innerHTML).toBe(before)
    // The same place taken twice is one address and the same list, six clubs and nothing doubled.
    type('70808')
    expect(address()).toBe('?near=70808')
    expect(names()).toEqual(FROM_70808)
    expect(dividers()).toEqual(['Farther than 75 miles', words.NO_DISTANCE])
  })

  it('writes the place and each filter in place of the last address, so Back leaves the page, and keeps no state beside it', () => {
    draw()
    expect(probe().getAttribute('data-type')).toBe('POP')
    type('70808')
    expect(probe().getAttribute('data-type')).toBe('REPLACE')
    fireEvent.click(screen.getByRole('button', { name: words.A_TO_Z }))
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Plays on weekends/ }))
    expect(probe().getAttribute('data-type')).toBe('REPLACE')
    expect(address()).toBe('?near=70808&sort=az&weekends=1')
    expect(probe().getAttribute('data-state')).toBe('null')
  })

  it('does not go on saying that the nearest are listed first once A to Z is pressed', () => {
    draw()
    type('Natchitoches')
    expect(status().textContent).toContain(words.noClubIn('Natchitoches'))
    fireEvent.click(screen.getByRole('button', { name: words.A_TO_Z }))
    expect(list()!.getAttribute('aria-label')).toBe(words.LIST_A_TO_Z)
    expect(status().textContent).not.toMatch(/nearest are listed first/)
  })

  it('lets a note go when a filter changes, so a later caption is not said with an old sentence before it', () => {
    draw()
    type('Natchitoches')
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Plays on weekends/ }))
    expect(status().textContent).not.toContain(words.noClubIn('Natchitoches'))
    type('Houston, TX')
    expect(status().textContent).toContain(words.OUTSIDE)
    fireEvent.click(screen.getByRole('button', { name: /^Scholastic friendly/ }))
    expect(status().textContent).not.toContain(words.OUTSIDE)
  })
})

describe('the orders at their edges', () => {
  it('with no club that has a point, orders nothing by distance: A to Z, no divider, no distance, the nearest caption', () => {
    const noPoints = CLUBS.map((club) => ({ ...club, point: null }))
    draw('/clubs?near=70808', noPoints)
    expect(names()).toEqual(A_TO_Z)
    expect(dividers()).toEqual([])
    expect(cards().join('\n')).not.toMatch(/ mi\b/)
    expect(status().textContent).toBe(words.nearestCaption(6))
  })

  it('with every club past 75 miles, draws no divider before the first, and says each distance', () => {
    const far = CLUBS.filter((club) => ['c-pine', 'c-delta'].includes(club.id))
    draw('/clubs?near=70808', far)
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
    expect(dividers()).toEqual([])
    expect(cards()).toEqual(['Example Delta Club · Monroe · about 156 mi', 'Example Pine Club · Shreveport · about 211 mi'])
  })

  it('with every club within 75 miles that has a point, draws only the divider before the clubs with none', () => {
    const near = CLUBS.filter((club) => ['c-river', 'c-knights', 'c-harbor'].includes(club.id))
    draw('/clubs?near=70808', near)
    expect(names()).toEqual(['Example River Club', 'Example Knights Club', 'Example Harbor Club'])
    expect(dividers()).toEqual([words.NO_DISTANCE])
  })

  it('puts clubs at one point in A to Z order, then by id, and never in the order they came', () => {
    const at: [number, number] = [30.5, -91.2]
    const clubs = [row('z-1', 'Example Twin Club', 'Baker', null, at), row('a-9', 'Example Twin Club', 'Baker', null, at), row('m-5', 'Example Ace Club', 'Baker', null, at)]
    draw('/clubs?near=70808', clubs)
    expect(hrefs().map((h) => h?.split('/').pop())).toEqual(['m-5-slug', 'a-9-slug', 'z-1-slug'])
    cleanup()
    draw('/clubs?near=70808', [...clubs].reverse())
    expect(hrefs().map((h) => h?.split('/').pop())).toEqual(['m-5-slug', 'a-9-slug', 'z-1-slug'])
  })

  it('says "less than 1 mi" for a club at the ZIP code\'s own point, never "about 0 mi", and no half or decimal in any distance', () => {
    const here = zipPoint('70808')!
    const clubs = [row('c-here', 'Example Here Club', 'Baton Rouge', null, [here.latitude, here.longitude]), ...CLUBS]
    draw('/clubs?near=70808', clubs)
    expect(cards()[0]).toBe('Example Here Club · Baton Rouge · less than 1 mi')
    expect(cards().join('\n')).not.toMatch(/about 0|\d\.\d|½/)
  })

  it('names one club in the singular and keeps it, and does not offer a divider to a list of one', () => {
    draw('/clubs?near=70808', [CLUBS[0]])
    expect(names()).toEqual(['Example Pine Club'])
    expect(dividers()).toEqual([])
    expect(status().textContent).toMatch(/^The 1 club, nearest first\./)
  })

  it('with no club at all, says so and offers no field, whatever the address holds', () => {
    draw('/clubs?near=70808&region=north-louisiana&weekends=1', [])
    expect(screen.getByText(words.NO_CLUBS)).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('with filters that leave no club beside a place, says so with Clear filters, draws no divider, keeps the place, and brings the clubs back nearest first', () => {
    draw('/clubs?near=70808&weekends=1')
    expect(names()).toEqual([])
    expect(status().textContent).toBe('No clubs match these filters. Clear filters.')
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    fireEvent.click(within(status()).getByRole('button', { name: words.CLEAR_FILTERS }))
    expect(names()).toEqual(FROM_70808)
    expect(address()).toBe('?near=70808')
    expect(status().textContent).toBe(words.nearestCaption(6))
  })

  it('follows a list that changes under it: a club that goes is gone from the list, the place and the order stay, and a region the address names that has no club left can be let go', () => {
    const view = draw('/clubs?near=70808&region=north-louisiana')
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
    redraw(view, CLUBS.filter((club) => club.region !== 'North Louisiana'))
    expect(names()).toEqual([])
    expect(status().textContent).toBe('No clubs match these filters. Clear filters.')
    expect(screen.getByText(words.nearYou('Baton Rouge', '70808'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    const chip = screen.getByRole('button', { name: 'North Louisiana 0' })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    expect(address()).toBe('?near=70808')
    expect(names().length).toBe(4)
  })
})

describe('Near me at its edges', () => {
  it('says a refusal, no answer to be had and the browser\'s own timeout each in their words, with the focus on the field and the list A to Z', () => {
    for (const [code, said] of [[1, words.NOT_FOUND], [2, words.NOT_FOUND], [3, words.TOO_LONG], [0, words.NOT_FOUND]] as const) {
      const { asked } = standInLocation()
      draw()
      fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
      expect(document.activeElement).not.toBe(field())
      act(() => asked[0].fail?.(failure(code)))
      expect(status().textContent, String(code)).toContain(said)
      expect(document.activeElement).toBe(field())
      expect(names()).toEqual(A_TO_Z)
      expect(address()).toBe('')
      cleanup()
    }
  })

  it('treats a device that throws, or gives no error function, as a failure said in words, and a press after it asks again', () => {
    let thrown = true
    const { geolocation, asked } = standInLocation(() => { if (thrown) throw new Error('blocked') })
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(status().textContent).toContain(words.NOT_FOUND)
    expect(document.activeElement).toBe(field())
    thrown = false
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2)
    expect(asked).toHaveLength(0)
    expect(status().textContent).toContain(words.FINDING)
  })

  it('takes the first answer and lets go of any later one, whether it is a point or an error', () => {
    const { asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => asked[0].ok(position(DEVICE)))
    const taken = address()
    expect(taken).toMatch(/^\?near=\d{5}$/)
    act(() => asked[0].ok(position({ latitude: 32.5, longitude: -93.75 })))
    act(() => asked[0].fail?.(failure(1)))
    act(() => { vi.advanceTimersByTime(words.DEVICE_WAIT_MS * 2) })
    expect(address()).toBe(taken)
    expect(status().textContent).not.toContain(words.NOT_FOUND)
    expect(status().textContent).not.toContain(words.TOO_LONG)
  })

  it('is let go of with the page: no state set, no timer left, nothing logged, when the answer comes after', () => {
    const { asked } = standInLocation()
    const logged = (['error', 'warn'] as const).map((name) => vi.spyOn(console, name))
    const base = vi.getTimerCount()
    const view = draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(vi.getTimerCount()).toBeGreaterThan(base)
    view.unmount()
    expect(vi.getTimerCount()).toBe(base)
    act(() => asked[0].ok(position(DEVICE)))
    act(() => asked[0].fail?.(failure(1)))
    for (const spy of logged) expect(spy).not.toHaveBeenCalled()
  })

  it('draws the line round Louisiana at the page\'s own distance: a point is inside by the miles to its nearest ZIP code area, and a point well out in the Gulf is outside', () => {
    expect(FARTHEST_MILES).toBe(25)
    const inside: boolean[] = []
    // A run of points south of Cameron, out into the Gulf, the first on land and the last far from any area.
    for (let latitude = 29.85; latitude >= 27.5; latitude -= 0.05) {
      const point = { latitude, longitude: -93.3 }
      const { asked } = standInLocation()
      draw()
      fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
      act(() => asked[0].ok(position(point)))
      const miles = nearestZip(point).miles
      const took = /^\?near=\d{5}$/.test(address() ?? '')
      expect(took, `${latitude} at ${miles.toFixed(1)} mi`).toBe(miles <= FARTHEST_MILES)
      if (!took) expect(status().textContent).toContain(words.OUTSIDE)
      inside.push(took)
      cleanup()
    }
    expect(inside[0]).toBe(true)
    expect(inside.at(-1)).toBe(false)
  })

  it('finds a ZIP code for the state\'s own big cities and says outside for places a long way over its lines', () => {
    const cases: Array<[string, { latitude: number; longitude: number }, RegExp | null]> = [
      ['Shreveport', { latitude: 32.5252, longitude: -93.7502 }, /^\?near=711\d\d$/],
      ['New Orleans', { latitude: 29.9511, longitude: -90.0715 }, /^\?near=70[01]\d\d$/],
      ['Lafayette', { latitude: 30.2241, longitude: -92.0198 }, /^\?near=705\d\d$/],
      ['Monroe', { latitude: 32.5093, longitude: -92.1193 }, /^\?near=712\d\d$/],
      ['Houston', { latitude: 29.7604, longitude: -95.3698 }, null],
      ['Jackson, Mississippi', { latitude: 32.2988, longitude: -90.1848 }, null],
      ['Little Rock', { latitude: 34.7465, longitude: -92.2896 }, null],
      ['Null Island', { latitude: 0, longitude: 0 }, null],
    ]
    for (const [place, point, expected] of cases) {
      const { asked } = standInLocation()
      draw()
      fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
      act(() => asked[0].ok(position(point)))
      if (expected) expect(address(), place).toMatch(expected)
      else {
        expect(address(), place).toBe('')
        expect(status().textContent, place).toContain(words.OUTSIDE)
      }
      cleanup()
    }
  })

  it('keeps a name typed before the press, and the filters, and puts the ZIP code beside them in the one order', () => {
    const { asked } = standInLocation()
    draw('/clubs?region=north-louisiana')
    type('pine')
    expect(names()).toEqual(['Example Pine Club'])
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}&region=north-louisiana$/)
    expect(field().value).toBe('pine')
    expect(names()).toEqual(['Example Pine Club'])
    expect(status().textContent).toBe('1 club matches pine · Show all 2')
  })

  it('never reads the device but once for one press, never keeps watch, and keeps no state beside the address', () => {
    const { geolocation, asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    act(() => asked[0].ok(position(DEVICE)))
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
    expect(probe().getAttribute('data-state')).toBe('null')
    expect(probe().getAttribute('data-type')).toBe('REPLACE')
    expect(window.history.state?.usr ?? null).toBeNull()
  })

  it('does not ask while a place is only typed or cleared, and the page being drawn with a place in its address asks nothing either', () => {
    const { geolocation } = standInLocation()
    draw('/clubs?near=70808')
    type('Lafayette')
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
  })

  it('ends consistent when a place is typed while the device is still asked: one five-digit ZIP code in the address, the pill the same ZIP code, the wait no longer said, every club listed', () => {
    const { asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(status().textContent).toContain(words.FINDING)
    type('71101')
    expect(address()).toBe('?near=71101')
    act(() => asked[0].ok(position(DEVICE)))
    const zip = /^\?near=(\d{5})$/.exec(address() ?? '')?.[1]
    expect(zip).toBeTruthy()
    expect(screen.getByText(new RegExp(`^Near you: .+ ${zip}$`))).toBeTruthy()
    expect(status().textContent).not.toContain(words.FINDING)
    expect(names().length).toBe(6)
  })

  it('keeps a filter chosen while the device is asked: the answer adds its ZIP code beside the filter and drops nothing', () => {
    const { asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /^North Louisiana/ }))
    expect(address()).toBe('?region=north-louisiana')
    expect(status().textContent).toContain(words.FINDING)
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}&region=north-louisiana$/)
    expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toMatch(/1/)
    expect(names()).toEqual(['Example Delta Club', 'Example Pine Club'])
  })

  it('lets the device\'s answer go once a place is typed while it is asked: the typed place stays, no wait or failure is said, and Near me asks again when pressed', () => {
    const { geolocation, asked } = standInLocation()
    draw()
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    fireEvent.change(field(), { target: { value: '71101' } })
    enter()
    expect(address()).toBe('?near=71101')
    act(() => asked[0].ok(position(DEVICE)))
    act(() => asked[0].fail?.(failure(1)))
    act(() => { vi.advanceTimersByTime(words.DEVICE_WAIT_MS * 2) })
    expect(address()).toBe('?near=71101')
    expect(screen.getByText(/^Near you: .+ 71101$/)).toBeTruthy()
    for (const said of [words.FINDING, words.NOT_FOUND, words.TOO_LONG]) expect(status().textContent).not.toContain(said)
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2)
    act(() => asked[1].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}$/)
    expect(address()).not.toBe('?near=71101')
  })

  it('lets the device\'s answer go once the place is cleared while it is asked, and keeps the wait said through a change of order or filter', () => {
    const { asked } = standInLocation()
    draw('/clubs?near=70808&sort=nearest')
    fireEvent.click(screen.getByRole('button', { name: words.NEAR_ME }))
    fireEvent.click(screen.getByRole('button', { name: words.A_TO_Z }))
    expect(status().textContent).toContain(words.FINDING)
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Plays on weekends/ }))
    expect(status().textContent).toContain(words.FINDING)
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(address()).toBe('?weekends=1')
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toBe('?weekends=1')
    expect(status().textContent).not.toContain(words.FINDING)
  })
})

describe('what the page\'s source asks and keeps', () => {
  const ROOT = resolve(__dirname, '../..')
  const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const PAGE = ['src/areas/clubs/components/PlaceField.tsx', 'src/areas/clubs/components/ClubFilters.tsx', 'src/areas/clubs/components/ClubDirectory.tsx', 'src/areas/clubs/directoryWords.ts', 'domain/clubs/nearZip.ts']

  it('has no way to send anything: no request module, no beacon, no socket, no image to load, no cookie, no stored value, no history entry of its own', () => {
    for (const path of PAGE) {
      const text = read(path)
      expect(text, path).not.toMatch(/@\/lib\/http/)
      expect(text, path).not.toMatch(/\bfetch\b|sendBeacon|XMLHttpRequest|WebSocket|EventSource|new Image\b|document\.cookie|localStorage|sessionStorage|indexedDB|\bconsole\b|history\.(pushState|replaceState)|watchPosition/)
    }
  })

  it('imports from the clubs api only types, so the directory\'s files make no call of their own', () => {
    for (const path of PAGE) {
      const lines = read(path).split('\n').filter((line) => /from '@\/areas\/clubs\/api'/.test(line))
      for (const line of lines) expect(line, path).toMatch(/^import type /)
    }
  })

  it('has no string "near" and no near= anywhere in functions/, so no server code reads or logs the place', () => {
    const files = (dir: string): string[] => readdirSync(join(ROOT, dir)).flatMap((name) => {
      const path = `${dir}/${name}`
      return statSync(join(ROOT, path)).isDirectory() ? files(path) : /\.(ts|js|mjs)$/.test(name) ? [path] : []
    })
    for (const file of files('functions')) {
      const text = readFileSync(join(ROOT, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(text, file).not.toMatch(/['"`]near['"`]|\bnear=|[?&]near\b/)
    }
  })
})
