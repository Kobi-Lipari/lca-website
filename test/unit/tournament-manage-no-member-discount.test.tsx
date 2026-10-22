// @vitest-environment jsdom
//
// The tournament setup page has no member discount (decision D11): the
// Registration tab holds an early-entry discount and a late fee, each with
// its date, and nothing about members. Saving those settings sends only the
// fields that changed, and never memberDiscount, even when the tournament
// answer still carries a member_discount in its row.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const api = vi.hoisted(() => ({
  adminGetTournamentManage: vi.fn(),
  adminUpdateTournament: vi.fn(),
  getMe: vi.fn(async () => ({})),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { TournamentManagePage } = await import('@/pages/TournamentManagePage')

function manageAnswer(over: Record<string, unknown> = {}) {
  return {
    tournament: {
      id: 't1', name: 'Fall Open', location: 'Kenner, LA', venue: null, date: '2026-10-24', end_date: null,
      entry_fee: 30, early_deadline: '2026-10-10T23:59', early_discount: 10, late_after: '2026-10-16T12:00', late_fee: 15,
      member_discount: 5, requires_lca_membership: 1,
      sections: [], rounds: 4, max_players: null, status: 'upcoming', description: null, registration_deadline: null,
      club_id: null, created_by: null, created_at: '2026-09-01 12:00:00', registration_status: 'open', registration_opens_at: null,
      is_rated: 1, is_visible: 1, round_schedule: [], registration_closes_at: null, custom_details: [], time_control: null,
      registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0, keep_apart: 'family',
      report_settings: null, is_state_championship: 0, club_name: null, club_color: null, waitlist_count: 0, ...over,
    },
    roster: [], games: [], standings: [], prizes: [],
  }
}

beforeEach(() => {
  api.adminGetTournamentManage.mockReset()
  api.adminUpdateTournament.mockReset()
  api.adminUpdateTournament.mockResolvedValue({})
})
afterEach(cleanup)

async function openRegistrationTab() {
  api.adminGetTournamentManage.mockResolvedValue(manageAnswer())
  const auth = { user: { id: 'a1' }, member: { id: 'a1', role: 'lca_admin' }, session: null, role: 'lca_admin', loading: false } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/admin/tournaments/t1?tab=registration']}>
        <Routes><Route path="/admin/tournaments/:id" element={<TournamentManagePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return screen.findByRole('button', { name: 'Save registration settings' })
}

describe('the Registration tab of the tournament setup page', () => {
  it('shows the early-entry discount and the late fee, and no member discount', async () => {
    await openRegistrationTab()
    expect(screen.getByLabelText('Early-entry discount ($)')).toBeTruthy()
    expect(screen.getByLabelText('Late fee ($)')).toBeTruthy()
    expect(screen.getByText('Early-entry discount and late fee')).toBeTruthy()
    expect(screen.queryByLabelText(/member/i)).toBeNull()
    expect(document.body.textContent).not.toMatch(/member discount|member price|members save|discounts and late fee/i)
    // The $5 member_discount left in the tournament row is not drawn anywhere.
    for (const input of Array.from(document.querySelectorAll('input[type="number"]'))) {
      expect((input as HTMLInputElement).value).not.toBe('5')
    }
  })

  it('saves only what changed, and never sends memberDiscount', async () => {
    const save = await openRegistrationTab()
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Early-entry discount ($)'), { target: { value: '12' } })
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    const [id, body] = api.adminUpdateTournament.mock.calls[0]
    expect(id).toBe('t1')
    expect(body).toEqual({ earlyDiscount: 12 })
    expect(Object.keys(body)).not.toContain('memberDiscount')
    expect(Object.keys(body)).not.toContain('requiresLcaMembership')
  })

  it('a late fee change goes alone, again without memberDiscount', async () => {
    const save = await openRegistrationTab()
    fireEvent.change(screen.getByLabelText('Late fee ($)'), { target: { value: '20' } })
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0][1]).toEqual({ lateFee: 20 })
  })
})
