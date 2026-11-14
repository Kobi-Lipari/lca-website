// @vitest-environment jsdom
//
// The words K's answers to checkpoint S's choices changed outside the admin
// club page. A person admitted to a club by a regional seat alone adds and
// removes no officer (answer 2 (a)), so the dashboard's card of the clubs in
// their region and Board seats' sentence on what a seat's holder manages no
// longer name officers. And on the public Clubs page a club card's line of
// city and region wraps onto a second line instead of being cut short
// (answer 6 (a)), while the card's other lines are as before.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiClubListItem } from '@/lib/api'

const api = vi.hoisted(() => ({
  getClubs: vi.fn(),
  adminGetBoardSeats: vi.fn(),
  adminGetMembers: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-region-words' } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map needs Google's script; the cards are what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { DashboardPage } = await import('@/pages/DashboardPage')
const { BoardSeatsPanel } = await import('@/areas/admin/components/BoardSeatsPanel')
const { ClubsPage } = await import('@/pages/ClubsPage')

const MEMBER = {
  id: 'm-holder', email: 'player.one@example.org', full_name: 'Player One', uscf_id: null, uscf_rating: null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: '2027-06-30', membership_type: null,
  guardian_id: null, uscf_expiration: null, role: 'member', club_id: null, created_at: '2025-01-04 18:00:00',
}
const MANAGED = [{ id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region' }]
/** A made up club whose region is the longest the code holds, and one with no region. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays at 7:00 PM', color: '#1f4e79', image_url: null, region: 'North of Lake Pontchartrain', latitude: 30.4, longitude: -90.1 },
  { id: 'c2', name: 'Example Knights Club', city: 'Example Town', meeting_schedule: 'Fridays at 6:30 PM', color: '#c8a94a', image_url: null, region: null, latitude: null, longitude: null },
]

function authFor(): AuthContextValue {
  return {
    user: { id: MEMBER.id, email: MEMBER.email }, member: MEMBER, session: null, role: 'member', loading: false, memberLoading: false,
    seats: [], managedClubs: MANAGED, isBoardMember: true, assuranceLevel: 'aal1', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

beforeAll(() => {
  // jsdom has neither; the clubs page asks both.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
  api.adminGetBoardSeats.mockReset()
  api.adminGetBoardSeats.mockResolvedValue({ seats: [], holders: [], history: [], regionClubs: [] })
  api.adminGetMembers.mockReset()
  api.adminGetMembers.mockResolvedValue([])
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    const body = path === '/api/me' ? { member: MEMBER, registrations: [], directedTournaments: [], children: [] }
      : path === '/api/support' ? { tickets: [] }
        : path === '/api/me/children' ? { children: [] }
          : path === '/api/tournaments' ? { tournaments: [] }
            : null
    return body
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the two sentences on what a regional seat\'s holder manages', () => {
  it('the dashboard\'s card of the clubs in the region names pages and news, and no officers', async () => {
    render(
      <AuthContext.Provider value={authFor()}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes><Route path="/dashboard" element={<DashboardPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const heading = await screen.findByRole('heading', { level: 2, name: 'Clubs in your region' })
    const card = heading.parentElement as HTMLElement
    expect(card.textContent).toContain('As regional representative you can update these clubs\' pages and news.')
    expect(card.textContent).not.toMatch(/officer/i)
    expect(screen.getByRole('link', { name: /Example Chess Club/ }).getAttribute('href')).toBe('/admin/clubs/example-chess-club')
  })

  it('Board seats says a holder manages the club page, news and logo, and no officers', async () => {
    render(<BoardSeatsPanel />)
    await screen.findByRole('heading', { level: 2, name: 'Board seats' })
    const sentence = screen.getByText(/^Regional representative seats also pick the regions they cover\./)
    expect(sentence.textContent?.replace(/\s+/g, ' ')).toBe(
      'Regional representative seats also pick the regions they cover. Whoever holds the seat can manage every club in those regions: the club page, news and logo.',
    )
  })
})

describe('a club card on the public Clubs page', () => {
  it('lets the city and a long region wrap whole onto a second line, and keeps the card\'s other lines as they were', async () => {
    render(
      <MemoryRouter initialEntries={['/clubs']}>
        <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
      </MemoryRouter>,
    )
    const place = await screen.findByText('Example City, LA · North of Lake Pontchartrain')
    expect(place.tagName).toBe('SPAN')
    expect(place.className.split(' ')).not.toContain('truncate')
    expect(place.className.split(' ')).toEqual(expect.arrayContaining(['min-w-0', 'break-words']))
    const line = place.parentElement as HTMLElement
    expect(line.className).toBe('flex items-start gap-1.5')
    // The pin sits on the first line, as it did when the line could not wrap.
    expect(line.querySelector('svg')?.getAttribute('class')).toContain('mt-0.5 size-3 flex-shrink-0 text-gold-ink')

    // A club with no region has the city alone on that line.
    expect(screen.getByText('Example Town, LA').className.split(' ')).toContain('break-words')
    // The meeting line still keeps to one line, and the links are as before.
    const meeting = screen.getByText('Tuesdays at 7:00 PM')
    expect(meeting.className).toBe('truncate')
    expect(meeting.parentElement?.className).toBe('flex items-center gap-1.5')
    expect(screen.getAllByRole('link', { name: 'Visit club' })).toHaveLength(2)
  })
})
