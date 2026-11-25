// @vitest-environment jsdom
//
// The Board seats panel and a seat that is not shown publicly: the seat
// carries the words "not shown publicly" beside its other chips, and its
// line of messages on file leaves out the contact address, since that
// address does not reach the seat. A listed seat beside it is drawn as
// before. A retired seat's row offers "Bring back", and after it the list
// is read again.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  adminGetBoardSeats: vi.fn(),
  adminGetMembers: vi.fn(),
  adminReactivateBoardSeat: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-unlisted-panel' } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The view-only case passes viewOnly itself; the role hook is not reached for an answer.
vi.mock('@/hooks/useViewOnly', () => ({ useViewOnly: () => false }))

const { BoardSeatsPanel } = await import('@/areas/admin/components/BoardSeatsPanel')
const { ViewOnlyFieldset } = await import('@/lib/viewOnly')

const seat = (id: string, role: string, over: Record<string, unknown> = {}) =>
  ({ id, slug: id, role, category: 'officer', is_active: 1, is_shared: 0, is_listed: 1, sort_order: 10, fallback_name: '', ticket_count: 2, regions: [], ...over })

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.adminGetMembers.mockReset()
  api.adminGetMembers.mockResolvedValue([])
  api.adminGetBoardSeats.mockReset()
  api.adminGetBoardSeats.mockResolvedValue({
    seats: [
      seat('sample-listed-seat', 'Sample listed seat'),
      seat('sample-unlisted-seat', 'Sample unlisted seat', { is_listed: 0 }),
    ],
    holders: [],
    history: [],
    regionClubs: [],
  })
})
afterEach(() => cleanup())

describe('the Board seats panel and a seat that is not shown publicly', () => {
  it('says "not shown publicly" on the unlisted seat alone', async () => {
    render(<BoardSeatsPanel />)
    await screen.findByText('2 messages on file · /contact?to=sample-listed-seat')
    const chips = screen.getAllByText('not shown publicly')
    expect(chips).toHaveLength(1)
    expect(chips[0].closest('p')?.textContent).toContain('Sample unlisted seat')
  })

  it('leaves the contact address out for the unlisted seat and keeps it for the listed one', async () => {
    render(<BoardSeatsPanel />)
    await screen.findByText('2 messages on file · /contact?to=sample-listed-seat')
    expect(screen.getByText('2 messages on file · /contact?to=sample-listed-seat')).toBeTruthy()
    expect(screen.queryByText(/contact\?to=sample-unlisted-seat/)).toBeNull()
    expect(screen.getAllByText('2 messages on file')).toHaveLength(1)
  })

  it('offers "Bring back" on a retired seat alone, and reads the list again after it', async () => {
    api.adminGetBoardSeats.mockResolvedValue({
      seats: [
        seat('sample-listed-seat', 'Sample listed seat'),
        seat('sample-retired-seat', 'Sample retired seat', { is_active: 0, is_listed: 0 }),
      ],
      holders: [],
      history: [],
      regionClubs: [],
    })
    api.adminReactivateBoardSeat.mockReset()
    api.adminReactivateBoardSeat.mockResolvedValue(undefined)
    render(<BoardSeatsPanel />)
    await screen.findByText('2 messages on file · /contact?to=sample-listed-seat')
    const buttons = screen.getAllByRole('button', { name: /^Bring back/ })
    expect(buttons).toHaveLength(1)
    expect(buttons[0].getAttribute('aria-label')).toBe('Bring back Sample retired seat')
    expect(buttons[0].textContent).toContain('Bring back')
    const readsBefore = api.adminGetBoardSeats.mock.calls.length
    fireEvent.click(buttons[0])
    await waitFor(() => expect(api.adminReactivateBoardSeat).toHaveBeenCalledWith('sample-retired-seat'))
    await waitFor(() => expect(api.adminGetBoardSeats.mock.calls.length).toBe(readsBefore + 1))
  })

  const withRetired = () => api.adminGetBoardSeats.mockResolvedValue({
    seats: [seat('sample-retired-seat', 'Sample retired seat', { is_active: 0 })],
    holders: [],
    history: [],
    regionClubs: [],
  })

  it('says so when bringing the seat back fails', async () => {
    withRetired()
    api.adminReactivateBoardSeat.mockReset()
    api.adminReactivateBoardSeat.mockRejectedValue(new Error('x'))
    render(<BoardSeatsPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bring back Sample retired seat' }))
    expect(await screen.findByText('Could not bring that seat back. Try again.')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('says the seat is back in use and moves the focus to its row heading', async () => {
    const retired = seat('sample-retired-seat', 'Sample retired seat', { is_active: 0 })
    api.adminGetBoardSeats.mockReset()
    api.adminGetBoardSeats
      .mockResolvedValueOnce({ seats: [retired], holders: [], history: [], regionClubs: [] })
      .mockResolvedValue({ seats: [{ ...retired, is_active: 1 }], holders: [], history: [], regionClubs: [] })
    api.adminReactivateBoardSeat.mockReset()
    api.adminReactivateBoardSeat.mockResolvedValue(undefined)
    render(<BoardSeatsPanel />)
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('')
    fireEvent.click(await screen.findByRole('button', { name: 'Bring back Sample retired seat' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Sample retired seat is back in use.'))
    await waitFor(() => expect(document.activeElement?.id).toBe('seat-title-sample-retired-seat'))
    expect(document.activeElement?.textContent).toContain('Sample retired seat')
    expect(screen.queryByRole('button', { name: /^Bring back/ })).toBeNull()
  })

  it('warns that bringing back a retired seat that is shown publicly shows it, and says nothing of the sort for one that is not', async () => {
    const words = 'Bringing it back shows it on the Board page and in the contact form.'
    api.adminGetBoardSeats.mockResolvedValue({
      seats: [
        seat('sample-listed-seat', 'Sample listed seat'),
        seat('sample-retired-seat', 'Sample retired seat', { is_active: 0 }),
        seat('sample-retired-unlisted-seat', 'Sample retired unlisted seat', { is_active: 0, is_listed: 0 }),
      ],
      holders: [],
      history: [],
      regionClubs: [],
    })
    render(<BoardSeatsPanel />)
    await screen.findByText('2 messages on file · /contact?to=sample-listed-seat')
    const lines = screen.getAllByText(words)
    expect(lines).toHaveLength(1)
    const button = screen.getByRole('button', { name: 'Bring back Sample retired seat' })
    const row = button.closest('.rounded-xl')
    expect(row?.contains(lines[0])).toBe(true)
    expect(lines[0].compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('leaves "Bring back" disabled for a view only account', async () => {
    withRetired()
    render(<ViewOnlyFieldset viewOnly><BoardSeatsPanel /></ViewOnlyFieldset>)
    const button = await screen.findByRole('button', { name: 'Bring back Sample retired seat' })
    expect(button.matches(':disabled')).toBe(true)
  })
})
