// @vitest-environment jsdom
//
// The pages that map over the list of club regions show the five regional
// seats' titles with no edit of their own (K's decision 14 of Wednesday,
// November 18, 2026): the public Clubs page's region row, the Board seats
// panel's region buttons for a regional seat, each pressed for the one region
// the seat covers and none of the names that are gone.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubListItem } from '@/lib/api'

const api = vi.hoisted(() => ({
  getClubs: vi.fn(),
  adminGetBoardSeats: vi.fn(),
  adminGetMembers: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-regions-pages' } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubsPage } = await import('@/pages/ClubsPage')
const { BoardSeatsPanel } = await import('@/areas/admin/components/BoardSeatsPanel')

const FIVE = ['New Orleans Metro', 'Baton Rouge / East Central', 'Lafayette / South Central', 'Lake Charles / Southwestern', 'North Louisiana']
const GONE = ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']

const club = (id: string, name: string, region: string | null): ApiClubListItem =>
  ({ id, name, city: 'Example City', meeting_schedule: 'Tuesdays at 7:00 PM', color: '#1f4e79', image_url: null, region, latitude: null, longitude: null })
const CLUBS: ApiClubListItem[] = [
  club('c1', 'Example Metro Club', 'New Orleans Metro'),
  club('c2', 'Example Capital Club', 'Baton Rouge / East Central'),
  club('c3', 'Example Acadiana Club', 'Lafayette / South Central'),
  club('c4', 'Example Lake Club', 'Lake Charles / Southwestern'),
  club('c5', 'Example North Club', 'North Louisiana'),
  club('c6', 'Example Knights Club', null),
]

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
  api.adminGetMembers.mockReset()
  api.adminGetMembers.mockResolvedValue([])
  api.adminGetBoardSeats.mockReset()
})
afterEach(() => cleanup())

describe('the public Clubs page', () => {
  it('draws All regions and the five regions in order, and none that is gone', async () => {
    render(
      <MemoryRouter initialEntries={['/clubs']}>
        <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Example Metro Club')
    const row = screen.getByRole('group', { name: 'Region' })
    const labels = within(row).getAllByRole('button').map((b) => b.textContent)
    // The page writes Louisiana as LA in a pill, as it always has.
    expect(labels).toEqual(['All regions', ...FIVE.map((r) => r.replace('Louisiana', 'LA'))])
    for (const name of GONE) expect(within(row).queryByText(name)).toBeNull()
  })

  it('filters to the clubs of the region chosen, and back', async () => {
    render(
      <MemoryRouter initialEntries={['/clubs']}>
        <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
      </MemoryRouter>,
    )
    await screen.findByText('Example Metro Club')
    const row = screen.getByRole('group', { name: 'Region' })
    fireEvent.click(within(row).getByRole('button', { name: 'Baton Rouge / East Central' }))
    expect(within(row).getByRole('button', { name: 'Baton Rouge / East Central' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Example Capital Club')).toBeTruthy()
    for (const gone of ['Example Metro Club', 'Example Acadiana Club', 'Example Lake Club', 'Example North Club', 'Example Knights Club']) {
      expect(screen.queryByText(gone), gone).toBeNull()
    }
    fireEvent.click(within(row).getByRole('button', { name: 'Baton Rouge / East Central' }))
    expect(screen.getByText('Example Metro Club')).toBeTruthy()
  })
})

describe('the Board seats panel', () => {
  const seat = (id: string, role: string, regions: string[]) =>
    ({ id, slug: id, role, category: 'regional_rep', is_active: 1, is_shared: 0, sort_order: 20, fallback_name: '', ticket_count: 0, regions })

  it('draws the five regions as buttons on a regional seat, pressed for its one region, with the clubs counted', async () => {
    api.adminGetBoardSeats.mockResolvedValue({
      seats: [
        seat('s1', 'Baton Rouge / East Central', ['Baton Rouge / East Central']),
        seat('s2', 'Lake Charles / Southwestern Representative', []),
      ],
      holders: [],
      history: [],
      regionClubs: [
        { region: 'New Orleans Metro', clubs: 12 }, { region: 'Baton Rouge / East Central', clubs: 3 },
        { region: 'Lafayette / South Central', clubs: 5 }, { region: 'Lake Charles / Southwestern', clubs: 2 },
        { region: 'North Louisiana', clubs: 3 },
      ],
    })
    render(<BoardSeatsPanel />)
    const first = await screen.findByRole('group', { name: 'Regions covered by Baton Rouge / East Central' })
    // Each button names its region and the count of that region's clubs.
    expect(within(first).getAllByRole('button').map((b) => b.textContent))
      .toEqual(['New Orleans Metro · 12', 'Baton Rouge / East Central · 3', 'Lafayette / South Central · 5', 'Lake Charles / Southwestern · 2', 'North Louisiana · 3'])
    expect(within(first).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent))
      .toEqual(['Baton Rouge / East Central · 3'])
    expect(screen.getByText('Manages 3 clubs in Baton Rouge / East Central')).toBeTruthy()
    const second = screen.getByRole('group', { name: 'Regions covered by Lake Charles / Southwestern Representative' })
    expect(within(second).getAllByRole('button').map((b) => b.textContent?.split(' · ')[0])).toEqual(FIVE)
    expect(within(second).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(0)
    expect(screen.getByText(/^No region set/)).toBeTruthy()
    for (const name of GONE) expect(screen.queryByRole('button', { name })).toBeNull()
  })
})
