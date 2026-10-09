// @vitest-environment jsdom
//
// The tournament page and the family panel price an entry from the section
// objects a tournament answer carries, with no sections JSON passed to
// pricing: priceShownSection(section, tournament, now),
// which passes a section's own early or late price on to priceEntry as
// checkout does. These render both with an answer shaped like the server's
// (section ids, cap, fees triple) and read what a person sees: the amounts in
// the section list, the price lines, and the family total. There is no
// member price: the fixture keeps a member_discount in the answer to show it
// is never applied or advertised, and a member pays what anyone else pays.
//
// The clock is set with Date alone faked, so the pages read a fixed "now".
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { savedSectionSchema } from '../../domain/contracts'
import { tierFees } from '../../domain/events/sections'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiChild, ApiMember, ApiTournamentDetail } from '@/lib/api'

const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  getMyChildren: vi.fn(),
  createBatchRegistration: vi.fn(),
  createRegistration: vi.fn(),
  getTournamentReminderStatus: vi.fn(async () => ({ opted_in: false })),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')
const { FamilyRegistrationPanel } = await import('@/components/family/FamilyRegistrationPanel')

// Thursday, October 1, 2026, noon Central: before the early deadline below.
const BEFORE_EARLY = new Date('2026-10-01T17:00:00Z')
// Saturday, October 17, 2026, 1:00 PM Central: after the late date below.
const AFTER_LATE = new Date('2026-10-17T18:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(BEFORE_EARLY)
  api.getMyChildren.mockReset()
  api.getMyChildren.mockResolvedValue([])
  api.getTournament.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Section objects as the server answers them: an id, the regular price, the derived early and late prices. */
function answerSections(
  tournament: { entry_fee: number; early_deadline: string | null; early_discount: number; late_after: string | null; late_fee: number },
  list: Array<{ name: string; fee?: number; early?: number; late?: number }>,
): ApiTournamentDetail['sections'] {
  return list.map((s, i) => {
    const fees = tierFees({ feeRegular: s.fee ?? null, feeEarly: s.early ?? null, feeLate: s.late ?? null }, tournament)
    return savedSectionSchema.parse({
      id: `sec-${i + 1}`, name: s.name, entryFee: fees.regular, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null,
      rulesSet: true, cap: null, fees,
    })
  })
}

function tournamentAnswer(
  over: Partial<ApiTournamentDetail> = {},
  list: Array<{ name: string; fee?: number; early?: number; late?: number }> = [{ name: 'Open', fee: 50 }, { name: 'Reserve' }, { name: 'Free', fee: 0 }],
): ApiTournamentDetail {
  const base = {
    entry_fee: 30, early_deadline: '2026-10-10T23:59', early_discount: 10, late_after: '2026-10-16T12:00', late_fee: 15, member_discount: 5,
  }
  return {
    id: 't1', name: 'Fall Open', location: 'Kenner, LA', venue: null, date: '2026-10-24', end_date: null,
    ...base, sections: answerSections(base, list), rounds: 4, max_players: null, status: 'upcoming', description: null,
    registration_deadline: null, club_id: null, created_by: null, created_at: '2026-09-01 12:00:00',
    registration_status: 'open', registration_opens_at: null, is_rated: 0, is_visible: 1, round_schedule: [], registration_closes_at: null,
    custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf',
    accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1, club_name: null, club_color: null,
    waitlist_count: 0, ...over,
  } as unknown as ApiTournamentDetail
}

const member = (over: Partial<ApiMember> = {}): ApiMember => ({
  id: 'm1', email: 'pat@example.com', full_name: 'Pat Player', uscf_id: '12345678', uscf_rating: 1500, uscf_rating_updated_at: null,
  membership_status: 'active', membership_expiry: null, role: 'member', club_id: null, created_at: '2026-01-01', ...over,
})

function withAuth(who: ApiMember | null, ui: ReactNode) {
  const value = { user: who ? { id: who.id } : null, member: who, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  return <AuthContext.Provider value={value}>{ui}</AuthContext.Provider>
}

async function renderDetail(tournament: ApiTournamentDetail, who: ApiMember | null) {
  api.getTournament.mockResolvedValue({ tournament, roster: [], pairings: [], myRegistration: null })
  render(withAuth(who, (
    <MemoryRouter initialEntries={['/tournaments/t1']}>
      <Routes><Route path="/tournaments/:id" element={<TournamentDetailPage />} /></Routes>
    </MemoryRouter>
  )))
  return (await screen.findByLabelText('Section')) as HTMLSelectElement
}

const optionTexts = (select: HTMLElement) => within(select).queryAllByRole('option').map((o) => o.textContent)
/** The right-hand value of a line in the price box (the section table has an "Entry fee" heading too). */
const rowValue = (label: string) => {
  const span = screen.getAllByText(label).find((el) => el.tagName === 'SPAN')!
  return span.parentElement!.lastElementChild!.textContent
}
/** The Sections table: name, entry fee. */
const sectionTable = () =>
  screen.getByRole('heading', { name: 'Sections' }).parentElement!.querySelectorAll('tbody tr')
const tableRows = () => Array.from(sectionTable()).map((tr) => [tr.children[0].textContent, tr.children[2].textContent])

describe('the tournament page prices from the section objects in the answer', () => {
  it('a member before the early deadline: the amounts in the list and the price lines, with no member line', async () => {
    const select = await renderDetail(tournamentAnswer(), member())
    // Open: $50 less $10 early; the $5 member_discount in the row is not applied. Reserve has no price of its own: the $30 event fee. Free stays free.
    expect(optionTexts(select)).toEqual(['Open — $40', 'Reserve — $20', 'Free'])
    expect(rowValue('Entry fee')).toBe('$50')
    expect(rowValue('Early entry discount')).toBe('−$10')
    expect(screen.queryByText('LCA member discount')).toBeNull()
    expect(rowValue('You pay')).toBe('$40')
    // The Sections table shows each section's regular price from the same objects.
    expect(tableRows()).toEqual([['Open', '$50'], ['Reserve', '$30'], ['Free', 'Free']])
  })

  it('choosing another section reprices from that section, and the free one shows no price box', async () => {
    const select = await renderDetail(tournamentAnswer(), member())
    fireEvent.change(select, { target: { value: 'Reserve' } })
    expect(rowValue('Entry fee')).toBe('$30')
    expect(rowValue('You pay')).toBe('$20')
    fireEvent.change(select, { target: { value: 'Free' } })
    expect(screen.queryByText('You pay')).toBeNull()
    expect(screen.queryByText('Early entry discount')).toBeNull()
  })

  it('a signed-in non-member sees the same amounts as a member, and no line about members saving', async () => {
    const select = await renderDetail(tournamentAnswer(), member({ membership_status: 'expired' }))
    expect(optionTexts(select)).toEqual(['Open — $40', 'Reserve — $20', 'Free'])
    expect(screen.queryByText('LCA member discount')).toBeNull()
    expect(screen.queryByText(/members save/i)).toBeNull()
    expect(rowValue('You pay')).toBe('$40')
  })

  it('signed out, the amounts are the same and nothing advertises a member price', async () => {
    const select = await renderDetail(tournamentAnswer(), null)
    expect(optionTexts(select)).toEqual(['Open — $40', 'Reserve — $20', 'Free'])
    expect(document.body.textContent).not.toMatch(/members save|member discount|member price/i)
  })

  it('after the late date the late line shows and the early line is gone', async () => {
    vi.setSystemTime(AFTER_LATE)
    const select = await renderDetail(tournamentAnswer(), member({ membership_status: 'pending' }))
    expect(optionTexts(select)).toEqual(['Open — $65', 'Reserve — $45', 'Free'])
    expect(rowValue('Late entry fee')).toBe('+$15')
    expect(screen.queryByText('Early entry discount')).toBeNull()
    expect(rowValue('You pay')).toBe('$65')
  })

  it('an event with no early, late or member settings shows plain amounts and no price box', async () => {
    const plain = tournamentAnswer({ early_deadline: null, early_discount: 0, late_after: null, late_fee: 0, member_discount: 0 } as Partial<ApiTournamentDetail>)
    const select = await renderDetail(plain, member())
    // The fixture's sections were priced with the early and late settings; plain ones carry the regular price only.
    expect(optionTexts(select)[0]).toBe('Open — $50')
    expect(screen.queryByText('You pay')).toBeNull()
  })

  it('a section with its own early price shows that price, as checkout charges it', async () => {
    const own = tournamentAnswer({}, [{ name: 'Open', fee: 50, early: 32 }, { name: 'Reserve' }])
    const select = await renderDetail(own, member({ membership_status: 'pending' }))
    // Open's own early price is $32 (not $50 less the $10 discount); Reserve keeps the event's discount.
    expect(optionTexts(select)).toEqual(['Open — $32', 'Reserve — $20'])
    expect(rowValue('Early entry discount')).toBe('−$18')
    expect(rowValue('You pay')).toBe('$32')
  })

  it('a section with its own late price shows that price after the late date', async () => {
    vi.setSystemTime(AFTER_LATE)
    const own = tournamentAnswer({}, [{ name: 'Open', fee: 50, late: 58 }, { name: 'Reserve' }])
    const select = await renderDetail(own, member({ membership_status: 'pending' }))
    expect(optionTexts(select)).toEqual(['Open — $58', 'Reserve — $45'])
    expect(rowValue('Late entry fee')).toBe('+$8')
  })

  it('an event with no sections shows an empty list and does not fail', async () => {
    const select = await renderDetail(tournamentAnswer({}, []), member())
    expect(optionTexts(select)).toEqual([])
  })

  it('a fee with cents is shown with cents in the lines', async () => {
    const odd = tournamentAnswer({}, [{ name: 'Open', fee: 19.99 }])
    await renderDetail(odd, member())
    expect(rowValue('Entry fee')).toBe('$19.99')
    expect(rowValue('You pay')).toBe('$9.99')
  })
})

describe('the family panel prices each player from the section objects in the answer', () => {
  const child = (id: string, name: string, over: Partial<ApiChild> = {}): ApiChild => ({
    id, full_name: name, uscf_id: '9000000' + id.length, uscf_rating: 1000, membership_status: 'pending', membership_expiry: null,
    membership_type: null, created_at: '2026-01-01', ...over,
  })

  async function renderPanel(tournament: ApiTournamentDetail, children: ApiChild[]) {
    api.getMyChildren.mockResolvedValue(children)
    render(
      <MemoryRouter>
        <FamilyRegistrationPanel tournament={tournament} selfName="Pat Player" selfUscfId="12345678" selfRating={1500} selfRegistered={false} />
      </MemoryRouter>,
    )
    await screen.findByText('Register your family')
  }
  const tick = (name: string) => fireEvent.click(screen.getByRole('checkbox', { name }))

  it('the button totals each selected player at the section price, member or not', async () => {
    await renderPanel(tournamentAnswer(), [child('c1', 'Sam Player'), child('c2', 'Kit Player', { membership_status: 'active' })])
    expect((screen.getByRole('button', { name: 'Choose who is playing' }) as HTMLButtonElement).disabled).toBe(true)
    // Open is $50, less $10 early, for everyone: Pat 40, Sam (not a member) 40, Kit (a member) 40.
    tick('Pat Player (me)')
    tick('Sam Player')
    expect((screen.getByRole('button', { name: 'Register 2 · pay $80' }) as HTMLButtonElement).disabled).toBe(false)
    tick('Kit Player')
    expect((screen.getByRole('button', { name: 'Register 3 · pay $120' }) as HTMLButtonElement).disabled).toBe(false)
    expect(optionTexts(screen.getByLabelText('Section for Sam Player'))).toEqual(['Open — $40', 'Reserve — $20', 'Free'])
    expect(optionTexts(screen.getByLabelText('Section for Kit Player'))).toEqual(['Open — $40', 'Reserve — $20', 'Free'])
  })

  it('changing one player to the event-fee section and to the free one changes the total', async () => {
    await renderPanel(tournamentAnswer(), [child('c1', 'Sam Player')])
    tick('Pat Player (me)')
    tick('Sam Player')
    fireEvent.change(screen.getByLabelText('Section for Sam Player'), { target: { value: 'Reserve' } })
    expect(screen.getByRole('button', { name: 'Register 2 · pay $60' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Section for Pat Player (me)'), { target: { value: 'Free' } })
    expect(screen.getByRole('button', { name: 'Register 2 · pay $20' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Section for Sam Player'), { target: { value: 'Free' } })
    expect(screen.getByRole('button', { name: 'Register 2' })).toBeTruthy()
  })

  it('prices at the late fee after the late date', async () => {
    vi.setSystemTime(AFTER_LATE)
    await renderPanel(tournamentAnswer(), [child('c1', 'Sam Player')])
    tick('Pat Player (me)')
    tick('Sam Player')
    expect((screen.getByRole('button', { name: 'Register 2 · pay $130' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('prices a section with its own early price at that price', async () => {
    await renderPanel(tournamentAnswer({}, [{ name: 'Open', fee: 50, early: 32 }, { name: 'Reserve' }]), [child('c1', 'Sam Player')])
    // Pat and Sam each pay the own early price, $32.
    tick('Pat Player (me)')
    tick('Sam Player')
    expect(screen.getByRole('button', { name: 'Register 2 · pay $64' })).toBeTruthy()
  })

  it('sends the chosen section by name in the checkout request', async () => {
    api.createBatchRegistration.mockResolvedValue({ message: 'ok', paymentUrl: null })
    await renderPanel(tournamentAnswer(), [child('c1', 'Sam Player')])
    tick('Sam Player')
    fireEvent.change(screen.getByLabelText('Section for Sam Player'), { target: { value: 'Reserve' } })
    fireEvent.click(screen.getByRole('button', { name: /^Register 1/ }))
    await waitFor(() => expect(api.createBatchRegistration).toHaveBeenCalled())
    expect(api.createBatchRegistration).toHaveBeenCalledWith('t1', [{ memberId: 'c1', section: 'Reserve', byeRounds: [], gradeRange: null }])
  })

  it('renders nothing for a parent with no children', async () => {
    api.getMyChildren.mockResolvedValue([])
    const { container } = render(
      <MemoryRouter>
        <FamilyRegistrationPanel tournament={tournamentAnswer()} selfName="Pat Player" selfUscfId={null} selfRegistered={false} />
      </MemoryRouter>,
    )
    await waitFor(() => expect(api.getMyChildren).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
