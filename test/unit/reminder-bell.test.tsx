// @vitest-environment jsdom
//
// The reminder bell (WS01 step 25, a meaningful icon checked by hand). The
// brief asked for the bell to get an accessible name. It already has one
// that is right: the bell sits inside a button whose own words say what it
// does ("Notify me when it opens", or "Remove notification" with the crossed
// bell), and lucide-react hides an icon that has no label or title from
// screen readers, so the button's name is its words, said once. A label on
// the icon would make a screen reader say the words twice, so nothing was
// added. These render the button in RegistrationReminderButton (the gold
// bell, now in the gold-ink token) and the one on the tournament page, and
// hold that: the button's name is exactly its visible words, the icon is
// hidden and carries no name of its own, and the words do not depend on the
// icon's colour. Nothing here reads newLook, so the bell is the same with it
// on or off.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiMember, ApiTournamentDetail } from '@/lib/api'
import { read } from './helpers/cssTokens'

const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  getMyChildren: vi.fn(async () => []),
  getTournamentReminderStatus: vi.fn(),
  optInTournamentReminder: vi.fn(async () => ({ ok: true })),
  optOutTournamentReminder: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { RegistrationReminderButton } = await import('@/areas/registration/components/RegistrationReminderButton')
const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')

const member = (): ApiMember => ({
  id: 'fx-m-bell', email: 'fixture.player@example.com', full_name: 'Fixture Player', uscf_id: '00000001', uscf_rating: 1200, uscf_rating_updated_at: null,
  membership_status: 'active', membership_expiry: null, role: 'member', club_id: null, created_at: '2026-01-01',
})

function withAuth(who: ApiMember | null, ui: ReactNode) {
  const value = { user: who ? { id: who.id } : null, member: who, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  return <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
}

/** The one icon a button draws, and what a screen reader is told about it. */
function iconOf(button: HTMLElement) {
  const icons = button.querySelectorAll('svg')
  expect(icons).toHaveLength(1)
  const icon = icons[0]
  return {
    icon,
    hidden: icon.getAttribute('aria-hidden'),
    named: icon.hasAttribute('aria-label') || icon.hasAttribute('aria-labelledby') || icon.querySelector('title') !== null,
    classes: icon.getAttribute('class') ?? '',
  }
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockClear()
  api.getTournamentReminderStatus.mockReset()
})
afterEach(cleanup)

describe('the reminder bell in RegistrationReminderButton', () => {
  it('signed in and not asked yet: the button is named by its words alone, and the gold bell is hidden from screen readers', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: false })
    render(withAuth(member(), <RegistrationReminderButton tournamentId="fx-t-bell" />))
    const button = await screen.findByRole('button', { name: 'Notify me when it opens' })
    expect(button.textContent).toBe('Notify me when it opens')
    const bell = iconOf(button)
    expect(bell.hidden).toBe('true')
    expect(bell.named).toBe(false)
    expect(bell.classes).toContain('lucide-bell')
    // The bell is the one gold mark here, in the gold-ink token (brand gold with newLook off).
    expect(bell.classes).toContain('text-gold-ink')
    expect(bell.classes).not.toContain(['text-lca', '-gold'].join(''))
    expect(api.getTournamentReminderStatus).toHaveBeenCalledWith('fx-t-bell')
  })

  it('once asked: the crossed bell, hidden too, and the words "Remove notification" name the button', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: false })
    render(withAuth(member(), <RegistrationReminderButton tournamentId="fx-t-bell" />))
    const button = await screen.findByRole('button', { name: 'Notify me when it opens' })
    await act(async () => fireEvent.click(button))
    expect(api.optInTournamentReminder).toHaveBeenCalledWith('fx-t-bell')
    const remove = await screen.findByRole('button', { name: 'Remove notification' })
    expect(remove.textContent).toBe('Remove notification')
    const crossed = iconOf(remove)
    expect(crossed.hidden).toBe('true')
    expect(crossed.named).toBe(false)
    expect(crossed.classes).toContain('lucide-bell-off')
    // The crossed bell carries no gold, so nothing about it rests on a colour.
    expect(crossed.classes).not.toContain('gold')
  })

  it('a member who has asked already sees "Remove notification" first', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: true })
    render(withAuth(member(), <RegistrationReminderButton tournamentId="fx-t-bell" />))
    expect(await screen.findByRole('button', { name: 'Remove notification' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Notify me/ })).toBeNull()
  })

  it('signed out: no bell, and words that say how to get the reminder', () => {
    const { container } = render(withAuth(null, <RegistrationReminderButton tournamentId="fx-t-bell" />))
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toBe('Log in to get notified when registration opens.')
    expect(screen.getByRole('link', { name: 'Log in' }).getAttribute('href')).toBe('/login')
    expect(api.getTournamentReminderStatus).not.toHaveBeenCalled()
  })

  it('reads no feature switch: the bell and its words are the same with newLook on or off', () => {
    const source = read('src/areas/registration/components/RegistrationReminderButton.tsx')
    expect(source).not.toContain('FEATURES')
    expect(source).not.toContain('@/lib/features')
    // No label was added to either icon.
    expect(source).not.toMatch(/<Bell(Off)?\b[^>]*aria-label/)
  })
})

describe('the reminder bell on the tournament page', () => {
  function tournament(over: Partial<ApiTournamentDetail> = {}): ApiTournamentDetail {
    return {
      id: 'fx-t-bell', name: 'Fixture Fall Open', location: 'Fixture Hall', venue: null, date: '2026-11-21', end_date: null,
      entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0, sections: [], rounds: 4, max_players: null,
      status: 'upcoming', description: null, registration_deadline: null, club_id: null, created_by: null, created_at: '2026-09-01 12:00:00',
      registration_status: 'draft', registration_opens_at: null, is_rated: 0, is_visible: 1, round_schedule: [], registration_closes_at: null,
      custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf',
      accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1, club_name: null, club_color: null,
      waitlist_count: 0, ...over,
    } as unknown as ApiTournamentDetail
  }

  function show(t: ApiTournamentDetail) {
    api.getTournament.mockResolvedValue({ tournament: t, roster: [], pairings: [], myRegistration: null })
    render(withAuth(member(), (
      <MemoryRouter initialEntries={['/tournaments/fx-t-bell']}>
        <Routes><Route path="/tournaments/:id" element={<TournamentDetailPage />} /></Routes>
      </MemoryRouter>
    )))
  }

  it('before registration opens: the button is named by its words, and the bell, which carries no gold, is hidden', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: false })
    show(tournament())
    const button = await screen.findByRole('button', { name: 'Notify me when it opens' })
    const bell = iconOf(button)
    expect(bell.hidden).toBe('true')
    expect(bell.named).toBe(false)
    expect(bell.classes).toContain('lucide-bell')
    expect(bell.classes).not.toContain('gold')
    // The words beside it say the state the colour would not.
    expect(within(button.parentElement!).getByText('Registration isn\'t open yet.')).toBeTruthy()
  })

  it('after asking: "Remove notification" names the button and the crossed bell is hidden', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: true })
    show(tournament())
    const button = await screen.findByRole('button', { name: 'Remove notification' })
    const crossed = iconOf(button)
    expect(crossed.hidden).toBe('true')
    expect(crossed.named).toBe(false)
    expect(crossed.classes).toContain('lucide-bell-off')
    await act(async () => fireEvent.click(button))
    expect(api.optOutTournamentReminder).toHaveBeenCalledWith('fx-t-bell')
    expect(await screen.findByRole('button', { name: 'Notify me when it opens' })).toBeTruthy()
  })

  it('once registration has closed there is no bell to ask with', async () => {
    api.getTournamentReminderStatus.mockResolvedValue({ opted_in: false })
    show(tournament({ registration_status: 'closed' } as Partial<ApiTournamentDetail>))
    expect(await screen.findByText('Registration is closed.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Notify me|Remove notification/ })).toBeNull()
  })
})
