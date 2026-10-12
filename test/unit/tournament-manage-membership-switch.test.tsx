// @vitest-environment jsdom
//
// The "LCA membership required" switch on the setup page's Registration tab.
// It sits behind membershipRequirementSwitch (off), appears only on a
// club-run event, and only for an LCA admin or the organizing club's rep:
// an assigned director, a rep of another club and an LCA-run event get
// nothing. Saving sends requiresLcaMembership only when the switch changed.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ membershipRequirementSwitch: true }))
const api = vi.hoisted(() => ({
  adminGetTournamentManage: vi.fn(),
  adminUpdateTournament: vi.fn(),
  getMe: vi.fn(async () => ({})),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'membershipRequirementSwitch' ? flags.membershipRequirementSwitch : Reflect.get(target, key)),
    }),
  }
})

const { TournamentManagePage } = await import('@/pages/TournamentManagePage')
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

const SWITCH = 'Players need a current LCA membership to enter'

function manageAnswer(over: Record<string, unknown> = {}) {
  return {
    tournament: {
      id: 't1', name: 'Club Open', location: 'Kenner, LA', venue: null, date: '2026-10-24', end_date: null,
      entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
      member_discount: 0, requires_lca_membership: 0,
      sections: [], rounds: 4, max_players: null, status: 'upcoming', description: null, registration_deadline: null,
      club_id: 'club-a', created_by: null, created_at: '2026-09-01 12:00:00', registration_status: 'open', registration_opens_at: null,
      is_rated: 1, is_visible: 1, round_schedule: [], registration_closes_at: null, custom_details: [], time_control: null,
      registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0, keep_apart: 'family',
      report_settings: null, is_state_championship: 0, club_name: 'Club A', club_color: null, waitlist_count: 0, ...over,
    },
    roster: [], games: [], standings: [], prizes: [],
  }
}

beforeEach(() => {
  flags.membershipRequirementSwitch = true
  api.adminGetTournamentManage.mockReset()
  api.adminUpdateTournament.mockReset()
  api.adminUpdateTournament.mockResolvedValue({})
})
afterEach(cleanup)

async function openRegistrationTab(
  who: { role: string; club_id?: string | null },
  over: Record<string, unknown> = {},
) {
  api.adminGetTournamentManage.mockResolvedValue(manageAnswer(over))
  const member = { id: 'm1', role: who.role, club_id: who.club_id ?? null }
  const auth = { user: { id: 'm1' }, member, session: null, role: who.role, loading: false } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/admin/tournaments/t1?tab=registration']}>
        <Routes><Route path="/admin/tournaments/:id" element={<TournamentManagePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return screen.findByRole('button', { name: 'Save registration settings' })
}

describe('the LCA membership switch on the setup page', () => {
  it('ships behind membershipRequirementSwitch, which starts off', () => {
    expect(REAL_FEATURES.membershipRequirementSwitch).toBe(false)
  })

  it('is not drawn while the switch is off, even for an admin on a club-run event', async () => {
    flags.membershipRequirementSwitch = false
    await openRegistrationTab({ role: 'lca_admin' })
    expect(screen.queryByLabelText(SWITCH, { exact: false })).toBeNull()
  })

  it('shows an admin the current setting in words on a club-run event', async () => {
    await openRegistrationTab({ role: 'lca_admin' })
    const box = screen.getByRole('checkbox', { name: new RegExp(SWITCH) }) as HTMLInputElement
    expect(box.checked).toBe(false)
    expect(screen.getByText(/Not required: anyone may enter/)).toBeTruthy()
  })

  it('lets the organizing club rep turn it on, and sends only that field', async () => {
    const save = await openRegistrationTab({ role: 'club_rep', club_id: 'club-a' })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(SWITCH) }))
    expect(screen.getByText(/Required: every player must hold an LCA membership/)).toBeTruthy()
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { requiresLcaMembership: true }])
  })

  it('leaves requiresLcaMembership out when only another setting changed', async () => {
    const save = await openRegistrationTab({ role: 'lca_admin' })
    fireEvent.change(screen.getByLabelText('Late fee ($)'), { target: { value: '5' } })
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0][1]).toEqual({ lateFee: 5 })
  })

  it.each([
    ['a rep of another club', { role: 'club_rep', club_id: 'club-b' }],
    ['an assigned director with a member account', { role: 'member' }],
  ])('is not drawn for %s', async (_label, who) => {
    await openRegistrationTab(who)
    expect(screen.queryByRole('checkbox', { name: new RegExp(SWITCH) })).toBeNull()
  })

  it('is not drawn on an LCA-run event, which always requires a membership', async () => {
    await openRegistrationTab({ role: 'lca_admin' }, { club_id: null, club_name: null, requires_lca_membership: 1 })
    expect(screen.queryByRole('checkbox', { name: new RegExp(SWITCH) })).toBeNull()
  })
})
