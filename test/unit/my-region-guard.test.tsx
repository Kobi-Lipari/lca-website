// @vitest-environment jsdom
//
// The guard's new setting, requireSeat (WS09 step 11), read on its own with
// the routes around it: a visitor who is not signed in goes to the sign-in,
// a person whose session or member is still loading waits and is not sent
// away, a holder of a regional seat is let in whatever their role unless the
// account is a guest, the holder of an officer's seat is not, an LCA admin
// is, and a person who must set up a second factor goes there first. A route
// that does not set requireSeat reads no seat. Every name here is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'

afterEach(cleanup)

const REGIONAL = { id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }
const OFFICER = { id: 's2', slug: 'example-officer', role: 'Secretary', category: 'officer', started_at: '2026-01-01' }

interface Who { user?: boolean; role: string; account?: string; seats?: unknown[]; loading?: boolean; memberLoading?: boolean; mfaRequired?: boolean }
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}
function draw(who: Who, requireSeat = true) {
  const auth = {
    user: who.user === false ? null : { id: 'm-one' }, session: null, role: who.role,
    member: { id: 'm-one', role: who.account ?? who.role, club_id: null, full_name: 'Player One' },
    loading: who.loading ?? false, memberLoading: who.memberLoading ?? false, seats: who.seats ?? [], managedClubs: [], isBoardMember: false,
    assuranceLevel: 'aal1', mfaRequired: who.mfaRequired ?? false, directedTournamentIds: [], directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes>
          <Route path="/workspace/region" element={<RoleProtectedRoute requireSeat={requireSeat}><p>The page</p></RoleProtectedRoute>} />
          <Route path="*" element={<p>Somewhere else</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return () => screen.getByTestId('where').textContent
}

describe('RoleProtectedRoute requireSeat', () => {
  it('sends a visitor who is not signed in to the sign-in', () => {
    expect(draw({ user: false, role: 'member', seats: [REGIONAL] })()).toBe('/login')
  })

  it('waits while the session or the member is loading, and sends nobody away yet', () => {
    expect(draw({ role: 'member', loading: true })()).toBe('/workspace/region')
    expect(screen.getByText('Loading...')).toBeTruthy()
    cleanup()
    expect(draw({ role: 'member', memberLoading: true })()).toBe('/workspace/region')
    expect(screen.queryByText('The page')).toBeNull()
  })

  it('lets in a regional seat in any role, and an LCA admin with none', () => {
    for (const role of ['member', 'club_rep', 'tournament_director', 'lca_officer', 'lca_auditor', 'lca_observer']) {
      expect(draw({ role, seats: [REGIONAL] })(), role).toBe('/workspace/region')
      expect(screen.getByText('The page'), role).toBeTruthy()
      cleanup()
    }
    expect(draw({ role: 'lca_admin' })()).toBe('/workspace/region')
    expect(screen.getByText('The page')).toBeTruthy()
  })

  it('sends away a guest with a seat, an officer\'s seat alone, no seat at all, and a member whose seats did not load', () => {
    for (const who of [
      { role: 'member', account: 'guest', seats: [REGIONAL] }, { role: 'lca_officer', seats: [OFFICER] },
      { role: 'club_rep', seats: [] }, { role: 'member', seats: [] },
    ]) {
      expect(draw(who)(), JSON.stringify(who)).toBe('/dashboard')
      cleanup()
    }
  })

  it('sends a seat holder who must set up a second factor there before the page', () => {
    expect(draw({ role: 'member', seats: [REGIONAL], mfaRequired: true })()).toBe('/account/security')
  })

  it('reads no seat when a route does not ask for it', () => {
    expect(draw({ role: 'member', seats: [] }, false)()).toBe('/workspace/region')
    expect(screen.getByText('The page')).toBeTruthy()
  })
})
