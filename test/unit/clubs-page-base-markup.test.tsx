// @vitest-environment jsdom
//
// Today's Clubs page and the club map's three callers draw as they did
// before the directory (WS09 step 33) gave the map its own props. The
// expected markup in test/unit/fixtures/clubs-page-base-markup.json was
// taken from the base the step was built on, from these same renders:
// - today's ClubsPage, whole, with three made-up clubs and no maps key, as
//   /clubs draws with the switches as they ship;
// - the map as each caller passes it, with no maps key and with one (the
//   maps script is not there, so the map shows its loading note): the Clubs
//   page's map of every club, today's club page's map of one club, and the
//   new club page's map of its places.
// Any change to what these draw fails here. Every club and name is made up.
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubListItem } from '@/lib/api'
import base from './fixtures/clubs-page-base-markup.json'

const api = vi.hoisted(() => ({ getClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { ClubsPage } = await import('@/pages/ClubsPage')
const { LCAMap } = await import('@/areas/clubs/components/LCAMap')

/** Three made-up clubs: one with a pin and a meeting time, one with neither, one in a region. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM', color: '#1f4e79', image_url: null, region: 'North Louisiana', latitude: 32.5, longitude: -92.1 },
  { id: 'c2', name: 'Example Knights Club', city: 'Example Town', meeting_schedule: null as unknown as string, color: null, image_url: null, region: null, latitude: null, longitude: null },
  { id: 'c3', name: 'Example Rooks Club', city: 'Example Village', meeting_schedule: 'Saturdays, 10:00 AM', color: '#7a1f1f', image_url: null, region: 'Baton Rouge / East Central', latitude: 30.45, longitude: -91.18 },
]

/** The map as each of its three callers passes it. */
const CALLERS = {
  clubsPage: () => <LCAMap mode="all" height="100%" clubs={CLUBS} selectedId={null} hoveredId={null} onSelect={() => {}} userLocation={null} frame="state" />,
  clubDetailPage: () => <LCAMap mode="single" clubName="Example Chess Club" location={{ lat: 32.5, lng: -92.1 }} height={200} />,
  clubPage: () => <LCAMap mode="single" clubName="Example Chess Club" places={[{ name: 'Example Library', lat: 32.5, lng: -92.1 }]} directions={false} quietWithoutKey height={260} />,
} as const

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  document.head.querySelectorAll('script[data-lca-maps]').forEach((s) => s.remove())
})

/** Today's Clubs page, drawn with its clubs. */
async function todaysPage(): Promise<string> {
  const view = render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByText('Example Rooks Club')
  return view.container.innerHTML
}

/** One caller's map, with or without a maps key. */
async function callerMap(name: keyof typeof CALLERS, key: string): Promise<string> {
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', key)
  const Map = CALLERS[name]
  const view = render(<Map />)
  await act(async () => {})
  return view.container.innerHTML
}

describe('today\'s Clubs page and the map\'s callers, against their markup on the base', () => {
  it('draws today\'s Clubs page whole as it did, with no maps key', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    expect(await todaysPage()).toBe(base.todaysPage)
  })

  it('draws the Clubs page\'s map, today\'s club page\'s map and the new club page\'s map as they did, with no maps key and with one', async () => {
    for (const name of Object.keys(CALLERS) as Array<keyof typeof CALLERS>) {
      expect(await callerMap(name, ''), `${name} with no key`).toBe(base.maps[name].noKey)
      cleanup()
      expect(await callerMap(name, 'example-key'), `${name} with a key`).toBe(base.maps[name].withKey)
      cleanup()
    }
  })
})
