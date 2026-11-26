// @vitest-environment jsdom
//
// The Workspace's My club tab for a club's rep, with the club pages on and
// off (WS09 step 37). It reads the admin club answer, which carries no
// roster and no officers once the club pages are on, and links its two
// counts to the admin club page's Roster and officers tab, which is gone
// then too. With clubPagesOn() true (newClubs and newLook together) neither
// count is drawn and the tab still draws; with it false both are drawn as
// today, with the answer's numbers and their links. Only newClubs and
// newLook are set here. Every club and name is made up.
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
  roster: [
    { id: 'm-one', full_name: 'Player One', email: 'player.1@example.org', uscf_id: null, uscf_rating: null, membership_status: 'active' },
    { id: 'm-two', full_name: 'Player Two', email: 'player.2@example.org', uscf_id: null, uscf_rating: null, membership_status: 'active' },
  ],
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

beforeEach(() => {
  flags.newClubs = false
  flags.newLook = false
  api.adminGetClub.mockReset()
})
afterEach(cleanup)

describe('the Workspace\'s My club counts', () => {
  it('with the club pages off, draws the roster and officers counts with their links, as today', async () => {
    await openMyClub(TODAYS_ANSWER)
    const roster = screen.getByText('Members on roster').closest('a') as HTMLAnchorElement
    const officers = screen.getByText('Officers listed').closest('a') as HTMLAnchorElement
    expect([roster.textContent, roster.getAttribute('href')]).toEqual(['2Members on roster', `/admin/clubs/${CLUB_ID}?tab=roster`])
    expect([officers.textContent, officers.getAttribute('href')]).toEqual(['1Officers listed', `/admin/clubs/${CLUB_ID}?tab=roster`])
    expect(screen.getByText('Upcoming events')).toBeTruthy()
  })

  it('with the club pages on, draws neither count and no link to the roster tab, and keeps the rest of the tab', async () => {
    flags.newClubs = true
    flags.newLook = true
    await openMyClub(ANSWER_WITH_PAGES_ON)
    expect(screen.queryByText('Members on roster')).toBeNull()
    expect(screen.queryByText('Officers listed')).toBeNull()
    expect(document.querySelector('a[href*="tab=roster"]')).toBeNull()
    expect(screen.getByText('Upcoming events')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Public page/ })).toBeTruthy()
  })
})
