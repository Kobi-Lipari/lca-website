// @vitest-environment jsdom
//
// The Clubs directory after a crossing of the wide layout's width (checkpoint
// Y's review), beside test/unit/club-directory-crossing.test.tsx:
// - after a crossing, each way and then again, what the keyboard and a screen
//   reader meet, and in which order, is what a fresh draw at that width gives:
//   wide, the controls, Skip to the map, the list, the map; phone, the
//   controls, Skip to the list, the map, the sheet;
// - the cards are the list's, in the list's order, on both layouts, with no
//   card drawn twice;
// - the referrer policy the directory sets while it is drawn is one element,
//   however often the window crosses, and what was in the page's head before
//   it is left as it was when the directory goes;
// - as it goes, the directory's own element is set back to the policy that
//   was there (the browsers' own when the head named none) before it is
//   taken away, since taking it away alone does not give the page that
//   policy back.
// Every club and name here is made up; the places are real towns.
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import { NARROW_QUERY } from '@/areas/clubs/narrowScreen'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

function row(id: string, name: string, city: string, region: string, point: [number, number]): ApiClubDirectoryItem {
  return {
    id, name, city, meeting_schedule: 'Mondays at 7:00 PM.', color: null, image_url: null, region, latitude: null, longitude: null,
    slug: `${id}-slug`, statement: 'Mondays at 7:00 PM.', description: null, point: { latitude: point[0], longitude: point[1] },
    weekend_play: false, scholastic_friendly: false,
  }
}

const CLUBS = [
  row('c-shreve', 'Example Chess Club of Shreveport', 'Shreveport', 'North Louisiana', [32.52, -93.75]),
  row('c-laf', 'Example Chess Club of Lafayette', 'Lafayette', 'Lafayette / South Central', [30.22, -92.02]),
  row('c-br', 'Example Chess Club of Baton Rouge', 'Baton Rouge', 'Baton Rouge / East Central', [30.45, -91.15]),
]

type Listener = () => void
let listeners: Set<Listener>
let narrow: boolean
const originalMatchMedia = window.matchMedia
const originalScroll = Element.prototype.scrollIntoView

beforeEach(() => {
  narrow = true
  listeners = new Set()
  Element.prototype.scrollIntoView = () => {}
  window.matchMedia = ((query: string) => ({
    get matches() { return query === NARROW_QUERY ? narrow : false },
    media: query,
    addEventListener: (_t: string, fn: Listener) => { if (query === NARROW_QUERY) listeners.add(fn) },
    removeEventListener: (_t: string, fn: Listener) => { listeners.delete(fn) },
  })) as unknown as typeof window.matchMedia
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
  vi.stubEnv('MODE', 'a11y')
  ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
})
afterEach(() => {
  cleanup()
  window.matchMedia = originalMatchMedia
  Element.prototype.scrollIntoView = originalScroll
  vi.unstubAllEnvs()
  delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
  document.head.querySelectorAll('meta[name="referrer"]').forEach((meta) => meta.remove())
})

function cross(toNarrow: boolean) {
  narrow = toNarrow
  act(() => listeners.forEach((fn) => fn()))
}

async function draw(width: 'phone' | 'wide') {
  narrow = width === 'phone'
  const view = render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={CLUBS} /></MemoryRouter>)
  await screen.findByRole('group', { name: 'Map of the clubs' })
  return view
}

/** What the keyboard meets, in the order of the page: links and buttons, each by its card, its pin or its words. */
const order = (view: ReturnType<typeof render>) =>
  [...view.container.querySelectorAll<HTMLElement>('a, button')].map((el) => el.getAttribute('data-card') ?? el.getAttribute('data-pin') ?? el.textContent)

describe('what is met after a crossing', () => {
  it('is what a fresh draw at that width gives, each way and then again', async () => {
    const freshPhone = order(await draw('phone'))
    cleanup()
    const freshWide = order(await draw('wide'))
    cleanup()
    expect(freshPhone).not.toEqual(freshWide)

    const view = await draw('phone')
    expect(order(view)).toEqual(freshPhone)
    cross(false)
    expect(order(view)).toEqual(freshWide)
    cross(true)
    expect(order(view)).toEqual(freshPhone)
    cross(false)
    expect(order(view)).toEqual(freshWide)
  })

  it('draws each card once, in the list\'s order, on both layouts, after a crossing', async () => {
    const view = await draw('wide')
    const cards = () => [...document.querySelectorAll('[data-card]')].map((el) => el.getAttribute('data-card'))
    const first = cards()
    expect(first).toHaveLength(CLUBS.length)
    cross(true)
    expect(view.container.querySelector('[data-layout="phone"]')).not.toBeNull()
    expect(cards()).toEqual(first)
    cross(false)
    expect(cards()).toEqual(first)
  })
})

describe('the referrer policy while the directory is drawn', () => {
  it('is one element across crossings, and what was in the head before is left as it was when the directory goes', async () => {
    const before = Object.assign(document.createElement('meta'), { name: 'referrer', content: 'no-referrer' })
    document.head.appendChild(before)
    const metas = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="referrer"]')]
    const view = await draw('phone')
    expect(metas().map((m) => m.content)).toEqual(['no-referrer', 'strict-origin'])
    cross(false)
    cross(true)
    expect(metas().map((m) => m.content)).toEqual(['no-referrer', 'strict-origin'])
    view.unmount()
    expect(metas()).toEqual([before])
    expect(before.content).toBe('no-referrer')
  })

  it('sets its own element to the browsers\' own policy as it goes, when the head named none before', async () => {
    const view = await draw('wide')
    const own = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]')!
    expect(own.content).toBe('strict-origin')
    view.unmount()
    expect(own.isConnected).toBe(false)
    expect(own.content).toBe('strict-origin-when-cross-origin')
  })

  it('sets its own element to the earlier policy as it goes, when the head named one before', async () => {
    const before = Object.assign(document.createElement('meta'), { name: 'referrer', content: 'no-referrer' })
    document.head.appendChild(before)
    const view = await draw('wide')
    const own = [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="referrer"]')].find((meta) => meta !== before)!
    expect(own.content).toBe('strict-origin')
    view.unmount()
    expect(own.isConnected).toBe(false)
    expect(own.content).toBe('no-referrer')
  })
})
