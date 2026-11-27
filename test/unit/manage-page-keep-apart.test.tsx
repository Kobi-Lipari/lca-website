// @vitest-environment jsdom
//
// The setup page's "Try to keep apart" choice and the summary line beside it,
// with the club pages on and off (WS09 step 37). With clubPagesOn() true
// (newClubs and newLook together) a player is no longer tied to a club: the
// middle choice is not drawn, an event stored as family_club shows Family
// members chosen and its summary reads as a family event's does, and saving
// the event for another reason leaves family_club stored. With it false the
// three choices and the summary are today's. Only newClubs and newLook are
// set here; every other switch is as the tree has it. Every name is made up.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false }))
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
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})

const { TournamentManagePage } = await import('@/pages/TournamentManagePage')

const FAMILY = 'Family members (parents, children, siblings on one account)'
const FAMILY_CLUB = 'Family members and players from the same club'
const NOBODY = 'Nobody'

function manageAnswer(keepApart: string) {
  return {
    tournament: {
      id: 't1', name: 'Example Club Open', location: 'Example City, LA', venue: null, date: '2026-10-24', end_date: null,
      entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
      member_discount: 0, requires_lca_membership: 0,
      sections: [], rounds: 4, max_players: null, status: 'upcoming', description: null, registration_deadline: null,
      club_id: 'club-a', created_by: null, created_at: '2026-09-01 12:00:00', registration_status: 'open', registration_opens_at: null,
      is_rated: 1, is_visible: 1, round_schedule: [], registration_closes_at: null, custom_details: [], time_control: null,
      registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0, keep_apart: keepApart,
      report_settings: null, is_state_championship: 0, club_name: 'Example Chess Club', club_color: null, waitlist_count: 0,
    },
    roster: [], games: [], standings: [], prizes: [],
  }
}

beforeEach(() => {
  flags.newClubs = false
  flags.newLook = false
  api.adminGetTournamentManage.mockReset()
  api.adminUpdateTournament.mockReset()
  api.adminUpdateTournament.mockResolvedValue({})
})
afterEach(cleanup)

/** Opens the event's setup on its Details tab as an LCA admin, and waits for its Save button. */
async function openDetails(keepApart: string) {
  api.adminGetTournamentManage.mockResolvedValue(manageAnswer(keepApart))
  const member = { id: 'm1', role: 'lca_admin', club_id: null }
  const auth = { user: { id: 'm1' }, member, session: null, role: 'lca_admin', loading: false } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/admin/tournaments/t1?tab=details']}>
        <Routes><Route path="/admin/tournaments/:id" element={<TournamentManagePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return await screen.findByRole('button', { name: 'Save details' }) as HTMLButtonElement
}

/** The keep-apart choices as drawn, each with whether it is chosen. */
function choices(): Array<[string, boolean]> {
  return (Array.from(document.querySelectorAll('input[name="keep-apart"]')) as HTMLInputElement[])
    .map((input) => [input.closest('label')?.textContent ?? '', input.checked])
}

function summary(): string {
  return screen.getByText(/^Pairing rules:/).textContent ?? ''
}

/** Changes the event's name, so the details form has something to save that is not the choice. */
function renameAndSave(save: HTMLButtonElement) {
  fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Example Club Open II' } })
  fireEvent.click(save)
}

describe('with the club pages off, the choice and its summary are today\'s', () => {
  it('offers the three choices, with the stored one chosen, and the summary in its words', async () => {
    for (const [stored, words] of [['family', ' · keep families apart'], ['family_club', ' · keep families and clubmates apart'], ['none', '']] as const) {
      await openDetails(stored)
      expect(choices(), stored).toEqual([[FAMILY, stored === 'family'], [FAMILY_CLUB, stored === 'family_club'], [NOBODY, stored === 'none']])
      expect(summary(), stored).toBe(`Pairing rules: US Chess${words}`)
      cleanup()
    }
  })

  it('writes the choice when the director picks another, and leaves it out when another field is saved', async () => {
    let save = await openDetails('family_club')
    renameAndSave(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { name: 'Example Club Open II' }])
    cleanup()
    api.adminUpdateTournament.mockClear()
    save = await openDetails('family_club')
    fireEvent.click(screen.getByRole('radio', { name: FAMILY, hidden: true }))
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { keepApart: 'family' }])
  })
})

describe('with the club pages on, two choices and no club rule', () => {
  beforeEach(() => {
    flags.newClubs = true
    flags.newLook = true
  })

  it('offers Family members and Nobody, and shows an event stored as family_club as Family members', async () => {
    for (const [stored, chosen, words] of [['family', FAMILY, ' · keep families apart'], ['family_club', FAMILY, ' · keep families apart'], ['none', NOBODY, '']] as const) {
      await openDetails(stored)
      expect(choices(), stored).toEqual([[FAMILY, chosen === FAMILY], [NOBODY, chosen === NOBODY]])
      expect(screen.queryByText(FAMILY_CLUB), stored).toBeNull()
      expect(summary(), stored).toBe(`Pairing rules: US Chess${words}`)
      expect(summary(), stored).not.toContain('clubmates')
      cleanup()
    }
  })

  it('leaves family_club stored when the event is saved for another reason', async () => {
    const save = await openDetails('family_club')
    expect(save.disabled).toBe(true)
    renameAndSave(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { name: 'Example Club Open II' }])
  })

  it('leaves family_club stored when the director picks Nobody and then Family members again', async () => {
    const save = await openDetails('family_club')
    fireEvent.click(screen.getByRole('radio', { name: NOBODY, hidden: true }))
    expect(save.disabled).toBe(false)
    fireEvent.click(screen.getByRole('radio', { name: FAMILY, hidden: true }))
    expect(save.disabled).toBe(true)
    renameAndSave(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { name: 'Example Club Open II' }])
  })

  it('writes Nobody over family_club when the director picks it, and a family event as before', async () => {
    let save = await openDetails('family_club')
    fireEvent.click(screen.getByRole('radio', { name: NOBODY, hidden: true }))
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { keepApart: 'none' }])
    cleanup()
    api.adminUpdateTournament.mockClear()
    save = await openDetails('none')
    fireEvent.click(screen.getByRole('radio', { name: FAMILY, hidden: true }))
    fireEvent.click(save)
    await waitFor(() => expect(api.adminUpdateTournament).toHaveBeenCalledTimes(1))
    expect(api.adminUpdateTournament.mock.calls[0]).toEqual(['t1', { keepApart: 'family' }])
  })
})
