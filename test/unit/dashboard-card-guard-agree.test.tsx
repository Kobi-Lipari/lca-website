// @vitest-environment jsdom
//
// The Dashboard's "Open My region" link and My region's guard hold one rule
// (WS09 switch-on, on main's tree): for each kind of account that holds a
// regional seat over a club, the real Dashboard offers the link exactly when
// the real guard, set to require a seat, lets that account into
// /workspace/region. The link therefore never leads straight back to the
// Dashboard, and no account that the guard lets in is left without it. A guest
// account's context role resolves to 'member', so only the account's own role
// tells them apart. In both states of clubKeepers every one of these accounts
// but a guest is drawn each club's Manage → link, and a guest none. An LCA
// admin is let in by the guard and is not drawn this card at all, so that
// account is held on its own. Every name and club here is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { resolveRole } from '@/areas/admin/roles'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'

const flags = vi.hoisted(() => ({ clubKeepers: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-card-guard' } } }) } },
}))

const { DashboardPage } = await import('@/pages/DashboardPage')

const PERSON = {
  id: 'm-card-guard', email: 'player.one@example.org', full_name: 'Player One', uscf_id: null, uscf_rating: null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: '2027-06-30', membership_type: null,
  guardian_id: null, uscf_expiration: null, club_id: null, created_at: '2025-01-04 18:00:00',
}
const SEAT = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const MANAGED = [{ id: 'example-chess-club', name: 'Example Chess Club', region: 'Bayou Region' }]

let accountRole = 'member'
beforeEach(() => {
  flags.clubKeepers = true
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    const body = path === '/api/me' ? { member: { ...PERSON, role: accountRole }, registrations: [], directedTournaments: [], children: [] }
      : path === '/api/support' ? { tickets: [] }
        : path === '/api/me/children' ? { children: [] }
          : path === '/api/tournaments' ? { tournaments: [] }
            : null
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function authFor(account: string): AuthContextValue {
  return {
    user: { id: PERSON.id, email: PERSON.email }, member: { ...PERSON, role: account }, session: null, role: resolveRole(account),
    loading: false, memberLoading: false, seats: [SEAT], managedClubs: MANAGED, isBoardMember: true, assuranceLevel: 'aal1',
    mfaRequired: false, directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

/** The links to a club's admin page the last Dashboard drew. */
let clubHrefs: string[] = []
/** Whether the real Dashboard offers the link, once its own answer has come. */
async function dashboardOffers(account: string): Promise<boolean> {
  accountRole = account
  render(
    <AuthContext.Provider value={authFor(account)}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes><Route path="/dashboard" element={<DashboardPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Profile' }, { timeout: 5000 })
  const offered = screen.queryAllByRole('link', { name: 'Open My region' }).length
  expect(offered === 0 || offered === 1).toBe(true)
  clubHrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '').filter((href) => href.startsWith('/admin/clubs/'))
  cleanup()
  return offered === 1
}

/** Whether the real guard lets the account into My region, as My region's route sets it. */
function guardAdmits(account: string): boolean {
  render(
    <AuthContext.Provider value={authFor(account)}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes>
          <Route path="/workspace/region" element={<RoleProtectedRoute requireSeat><p>The page</p></RoleProtectedRoute>} />
          <Route path="*" element={<p>Somewhere else</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const admitted = screen.queryByText('The page') !== null
  cleanup()
  return admitted
}

describe('the Dashboard\'s Open My region and My region\'s guard, for an account that holds a regional seat', () => {
  for (const account of ['guest', 'member', 'lca_auditor', 'lca_officer', 'lca_observer', 'club_rep', 'tournament_director']) {
    it(`agree for ${account === 'guest' ? 'a guest account' : `a ${account} account`}: the link is offered exactly when the guard lets the account in`, async () => {
      const admitted = guardAdmits(account)
      expect(await dashboardOffers(account)).toBe(admitted)
      expect(admitted).toBe(account !== 'guest')
      // Every account but a guest is drawn the club's Manage → link; a guest, whom the server refuses that page, is drawn none.
      expect(clubHrefs).toEqual(account === 'guest' ? [] : ['/admin/clubs/example-chess-club'])
    })
  }

  it('agree with clubKeepers off in the one way that matters: no Open My region is offered to anyone, so none leads to a refusal', async () => {
    flags.clubKeepers = false
    for (const account of ['guest', 'member']) {
      expect(await dashboardOffers(account), account).toBe(false)
      expect(clubHrefs, account).toEqual(account === 'guest' ? [] : ['/admin/clubs/example-chess-club'])
    }
  })

  it('lets an LCA admin in at the guard, and draws an LCA admin no region card, as the page has always done', async () => {
    expect(guardAdmits('lca_admin')).toBe(true)
    expect(await dashboardOffers('lca_admin')).toBe(false)
  })
})
