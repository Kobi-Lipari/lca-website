// @vitest-environment jsdom
//
// The Workspace's My club tab for a club's rep: the row of count tiles
// (WS09 step 38). With the club pages on, the roster and officers tiles are
// not drawn, so the one tile left, Upcoming events, takes the row's whole
// width: the grid holds one column. With them off the row is today's to the
// last class: three columns from the small width up, holding all three
// tiles. Only newClubs and newLook are set here. Every club and name is
// made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
const api = vi.hoisted(() => ({ adminGetClub: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { WorkspacePage } = await import('@/pages/WorkspacePage')

const CLUB_ID = 'example-chess-club'
const CLUB = {
  id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: 'A made up club.',
  meeting_schedule: 'Tuesdays, 7:00 PM', contact_email: 'club@example.org', created_at: '2026-01-03 18:00:00', color: '#1f4e79',
  image_url: null, region: 'Bayou Region', latitude: null, longitude: null,
}
const EVENT = { id: 't1', name: 'Example Club Open', date: '2026-10-24', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open' }
const TODAYS_ANSWER = {
  club: CLUB,
  officers: [{ id: 'officer-1', member_id: 'm-one', role: 'President', full_name: 'Player One', email: 'player.1@example.org' }],
  roster: [{ id: 'm-one', full_name: 'Player One', email: 'player.1@example.org', uscf_id: null, uscf_rating: null, membership_status: 'active' }],
  tournaments: [EVENT],
}
/** The answer the server gives with CLUB_PAGES_ON set: neither list. */
const ANSWER_WITH_PAGES_ON = { club: CLUB, tournaments: [EVENT] }

function authForRep(): AuthContextValue {
  const member = { id: 'm-rep', email: 'rep@example.org', full_name: 'Club Rep One', role: 'club_rep', club_id: CLUB_ID }
  return {
    user: { id: member.id, email: member.email }, member, session: null, role: 'club_rep', loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

async function openMyClub(answer: Record<string, unknown>) {
  api.adminGetClub.mockResolvedValue(answer)
  render(
    <AuthContext.Provider value={authForRep()}>
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes><Route path="/workspace" element={<WorkspacePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Example Chess Club' })
}

/** The grid that holds the Upcoming events tile, and the tiles it holds. */
function tileRow() {
  const tile = screen.getByText('Upcoming events').closest('button') as HTMLButtonElement
  const grid = tile.parentElement as HTMLElement
  return { tile, grid, tiles: Array.from(grid.children) }
}

beforeEach(() => {
  flags.newClubs = false
  flags.newLook = false
  api.adminGetClub.mockReset()
})
afterEach(cleanup)

describe('the Workspace\'s My club tile row', () => {
  it('with the club pages off, keeps today\'s three column row holding all three tiles', async () => {
    await openMyClub(TODAYS_ANSWER)
    const { grid, tiles } = tileRow()
    expect(grid.className).toBe('grid gap-4 sm:grid-cols-3')
    expect(tiles.map((el) => el.textContent)).toEqual(['1Members on roster', '1Officers listed', '1Upcoming events'])
  })

  it('with the club pages on, gives the one tile left the row\'s whole width, with no empty columns beside it', async () => {
    flags.newClubs = true
    flags.newLook = true
    await openMyClub(ANSWER_WITH_PAGES_ON)
    const { tile, grid, tiles } = tileRow()
    expect(grid.className).toBe('grid gap-4')
    expect(grid.className).not.toMatch(/grid-cols/)
    expect(tiles).toEqual([tile])
    expect(tile.className).toMatch(/\bw-full\b/)
  })
})
