// @vitest-environment jsdom
//
// A position that comes after "took too long" (checkpoint Y's review), beside
// test/unit/place-field-edges.test.tsx: the page's ten seconds also time the
// person's own answer to the browser's question, so
// - a position that comes late is used as if it had come in time, once, with
//   the too-long words taken away, and keeps a filter chosen in between;
// - it is let go once the person has cleared the place, or pressed Near me
//   again, or typed a place and chosen it;
// - a late point outside Louisiana says so, with the focus on the field as
//   the outside-Louisiana words always do;
// - a late refusal, a late failure of any kind and a late timeout change
//   nothing the person reads and move no focus.
// Every club and name here is made up; the places are real towns.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import * as words from '@/areas/clubs/directoryWords'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number], weekend = false): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: { latitude: point[0], longitude: point[1] },
    weekend_play: weekend, scholastic_friendly: false,
  }
}

const CLUBS = [
  row('c-pine', 'Example Pine Club', 'Shreveport', 'North Louisiana', [32.5, -93.75]),
  row('c-river', 'Example River Club', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15], true),
  row('c-bayou', 'Example Bayou Club', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
]

const DEVICE = { latitude: 30.4517, longitude: -91.1288 }
const TEXAS = { latitude: 29.76, longitude: -95.37 }

function Probe() {
  return <span data-testid="probe" data-search={useLocation().search} />
}
function draw(at = '/clubs') {
  return render(<MemoryRouter initialEntries={[at]}><ClubDirectory clubs={CLUBS} /><Probe /></MemoryRouter>)
}
const address = () => screen.getByTestId('probe').getAttribute('data-search')
const field = () => screen.getByRole('textbox', { name: words.FIELD_LABEL }) as HTMLInputElement
const status = () => screen.getByRole('status')
const nearMe = () => screen.getByRole('button', { name: words.NEAR_ME })
const order = () => [...document.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card'))

type Asked = { ok: PositionCallback; fail?: PositionErrorCallback | null }
function standInLocation() {
  const asked: Asked[] = []
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition: (ok: PositionCallback, fail?: PositionErrorCallback | null) => { asked.push({ ok, fail }) }, watchPosition() {}, clearWatch() {} },
    configurable: true,
  })
  return asked
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

/** Presses Near me and lets the page's ten seconds run out, the focus on the button. */
function pressAndWait() {
  const button = nearMe()
  button.focus()
  fireEvent.click(button)
  act(() => { vi.advanceTimersByTime(words.DEVICE_WAIT_MS) })
  expect(status().textContent).toContain(words.TOO_LONG)
  return button
}

describe('a position that comes after the ten seconds', () => {
  it('orders the list nearest first, takes the too-long words away, and keeps the focus where it was', () => {
    const asked = standInLocation()
    draw()
    const button = pressAndWait()
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}$/)
    expect(order()[0]).toBe('c-river')
    expect(status().textContent).not.toContain(words.TOO_LONG)
    expect(status().textContent).not.toContain(words.FINDING)
    expect(document.activeElement).toBe(button)
  })

  it('is used once: the same callback answering again, after the place is cleared, changes nothing', () => {
    const asked = standInLocation()
    draw()
    pressAndWait()
    act(() => asked[0].ok(position(DEVICE)))
    const kept = address()
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(address()).toBe('')
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toBe('')
    expect(kept).toMatch(/near=/)
  })

  it('keeps a filter chosen between the ten seconds and the answer', () => {
    const asked = standInLocation()
    draw()
    pressAndWait()
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('button', { name: /^North Louisiana/ }))
    expect(address()).toContain('region=')
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toContain('near=')
    expect(address()).toContain('region=')
  })

  it('is let go once the place has been cleared since', () => {
    const asked = standInLocation()
    draw('/clubs?near=70808&sort=nearest')
    pressAndWait()
    fireEvent.click(screen.getByRole('button', { name: words.CLEAR_PLACE }))
    expect(address()).toBe('')
    act(() => asked[0].ok(position({ latitude: 32.5, longitude: -93.75 })))
    expect(address()).toBe('')
  })

  it('is let go once a town has been typed and chosen since', () => {
    const asked = standInLocation()
    draw()
    pressAndWait()
    fireEvent.change(field(), { target: { value: 'Lafayette' } })
    fireEvent.submit(field().closest('form')!)
    const chosen = address()
    expect(chosen).toMatch(/^\?near=\d{5}$/)
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toBe(chosen)
  })

  it('is let go once Near me has been pressed again, and the second ask is the one answered', () => {
    const asked = standInLocation()
    draw()
    const button = pressAndWait()
    fireEvent.click(button)
    expect(asked).toHaveLength(2)
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toBe('')
    expect(status().textContent).toContain(words.FINDING)
    act(() => asked[1].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}$/)
  })

  it('says it is outside Louisiana for a late point beyond the line, with the focus on the field', () => {
    const asked = standInLocation()
    draw()
    pressAndWait()
    act(() => asked[0].ok(position(TEXAS)))
    expect(status().textContent).toContain(words.OUTSIDE)
    expect(status().textContent).not.toContain(words.TOO_LONG)
    expect(address()).toBe('')
    expect(document.activeElement).toBe(field())
  })

  /** A late failure of the browser's, by its code: nothing said changes, no focus moves, and the ask is still open for a position. */
  function lateFailure(code: number) {
    const asked = standInLocation()
    draw()
    const button = pressAndWait()
    const said = status().textContent
    act(() => asked[0].fail?.(failure(code)))
    expect(status().textContent).toBe(said)
    expect(address()).toBe('')
    expect(document.activeElement).toBe(button)
    // The ask is still open for a position after a failure: the person may have another way to answer.
    act(() => asked[0].ok(position(DEVICE)))
    expect(address()).toMatch(/^\?near=\d{5}$/)
  }

  it('leaves everything as it was for a late refusal of the browser\'s', () => lateFailure(1))
  it('leaves everything as it was for a late failure to find the position', () => lateFailure(2))
  it('leaves everything as it was for a late timeout of the browser\'s own', () => lateFailure(3))
})
