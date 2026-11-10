// @vitest-environment jsdom
//
// Edges of G1 and G2 on the manage page (WS08 step 10) beyond the main cases
// in manage-page-fee-notice.test.tsx: who is never shown the panel, ties and
// lowered prices, a raise made across both tabs, a blank or negative box,
// midnight and the hour DST repeats in America/Chicago as a "Late fee starts"
// value, an event with no sections, replays of Keep it at $0 and of the ask,
// the server's refusal when the creation answer never arrived, a raise only
// the server can see, and where the focus goes after Keep it at $0 when no
// fee box is left.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { FEES_NEED_PAYOUT_ACCOUNT } from '@domain/events/creation'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-fees' } } }) } },
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (key === 'standingDirectors' ? flags.standingDirectors : Reflect.get(target, key)),
    }),
  }
})

const { TournamentManagePage } = await import('@/pages/TournamentManagePage')

const MANAGE = '/api/admin/tournaments/t1/manage'
const EVENT = '/api/admin/tournaments/t1'
const CREATION = '/api/me/tournament-creation'
const PAYOUT = '/api/me/payout-request'
const G1 = 'Entry fees need a payout account first'
const G2 = /^You can charge an entry fee\. Fees are paid into LCA's Stripe account\./
const ASK = 'Ask LCA to set up my payout account'
const ASKED = 'Asked. LCA has your request.'
const KEEP = 'Keep it at $0'
/** A class that draws red: the destructive tokens, or a red from Tailwind's palette. */
const RED = /^(?:text|bg|border|ring|fill)-(?:destructive|red-\d+)(?:\/\d+)?$/

/** What GET /api/me/tournament-creation answers, by who asks. */
const ONE_EVENT_GRANT = { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }
const STANDING_GRANT = { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }
/** The answer everyone gets while CREATION_ROLES_ON is unset, as a page loaded before the constant was set holds it. */
const UNSET_GRANT = { grant: 'none', canCreate: false, canChargeFees: true, clubId: null }

/** A section as the manage answer gives it: its entry fee and its worked-out prices, never an own early or late price. */
function section(id: string, name: string, fee: number) {
  return { id, name, entryFee: fee, cap: null, fees: { regular: fee, early: null, late: null } }
}

/** The tournament as the manage answer gives it to a manager, an event the president created and priced at $25. */
function tournament(over: Record<string, unknown> = {}) {
  return {
    id: 't1', name: 'Lafayette Winter Quads', location: 'Lafayette, LA', venue: null, date: '2026-12-05', end_date: null,
    entry_fee: 25, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    member_discount: 0, requires_lca_membership: 1,
    sections: [section('sec-open', 'Open', 25)], rounds: 3, max_players: null, status: 'upcoming', description: null, registration_deadline: null,
    club_id: null, created_by: 'm-pres', created_at: '2026-11-05 18:00:00', registration_status: 'open', registration_opens_at: null,
    is_rated: 1, is_visible: 1, round_schedule: [], registration_closes_at: null, custom_details: [], time_control: null,
    registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0, keep_apart: 'family',
    report_settings: null, is_state_championship: 0, review_notified_at: null, club_name: null, club_color: null, ...over,
  }
}

interface Seen {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}
let seen: Seen[] = []
let answers: Record<string, { status: number; body: unknown }> = {}

beforeEach(() => {
  flags.standingDirectors = true
  seen = []
  answers = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    seen.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: typeof init?.body === 'string' ? init.body : undefined })
    const answer = answers[`${method} ${url.split('?')[0]}`] ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const requestsTo = (method: string, path: string) => seen.filter((s) => s.method === method && s.url.split('?')[0] === path)

interface Person {
  role: string
  id: string
  directed: string[]
}
/** A one-event director: a plain member the president named on this event. */
const DIRECTOR: Person = { role: 'member', id: 'm-one', directed: ['t1'] }
const STANDING: Person = { role: 'tournament_director', id: 'm-sd', directed: ['t1'] }

/**
 * Opens the manage page on a tab for a person, with the manage answer, GET /api/me and, when given, the creation answer, and waits until
 * the page has read them.
 */
async function openManage(tab: string, over: Record<string, unknown> = {}, grant: unknown = ONE_EVENT_GRANT, who: Person = DIRECTOR) {
  answers[`GET ${MANAGE}`] = { status: 200, body: { tournament: tournament(over), roster: [], games: [], standings: [], prizes: [], directors: [] } }
  const member = { id: who.id, role: who.role, club_id: null, full_name: 'Remy Guidry' }
  answers['GET /api/me'] = { status: 200, body: { member, registrations: [], directedTournaments: [] } }
  if (grant) answers[`GET ${CREATION}`] = { status: 200, body: grant }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false,
    directedTournamentIds: who.directed, directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/tournaments/t1?tab=${tab}`]}>
        <Routes>
          <Route path="/admin/tournaments/:id" element={<TournamentManagePage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { name: /Lafayette Winter Quads/ })
  await waitFor(() => expect(requestsTo('GET', '/api/me')).toHaveLength(1))
  if (flags.standingDirectors) await waitFor(() => expect(requestsTo('GET', CREATION)).toHaveLength(1))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

/** The entry fee box of a section's row in the sections table. */
function feeOf(name: string): HTMLInputElement {
  const row = screen.getAllByRole('row').find((r) => r.querySelector('td')?.textContent === name)
  const input = row?.querySelectorAll('td')[2]?.querySelector('input')
  if (!input) throw new Error(`no fee box for ${name}`)
  return input as HTMLInputElement
}
const typeIn = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })
const panel = () => screen.queryByRole('note', { name: G1 })
const isDisabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled
/** Every class drawn on the page that would draw red. */
const redClasses = () => [...document.body.querySelectorAll('*')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/)).filter((c) => RED.test(c))


describe('who is never shown the panel', () => {
  it('shows an LCA admin, the president and a club rep (every grant that may charge) no panel for a raised price, and no G2', async () => {
    for (const grant of ['admin', 'president', 'club_rep'] as const) {
      await openManage('details', {}, { grant, canCreate: true, canChargeFees: true, clubId: null })
      typeIn(feeOf('Open'), '99')
      expect(panel(), grant).toBeNull()
      expect(screen.queryByText(G2), grant).toBeNull()
      expect(isDisabled('Save details'), grant).toBe(false)
      cleanup()
      seen = []
    }
  })
})

describe('ties, lowered prices and unusual boxes', () => {
  it('reads a blank box as $0 and a negative box as $0, never as a raise', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '')
    expect(panel()).toBeNull()
    typeIn(feeOf('Open'), '-5')
    expect(panel()).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
  })

  it('shows a one-cent raise, and no panel at the loaded price', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '25.01')
    expect(panel()).not.toBeNull()
    typeIn(feeOf('Open'), '25.00')
    expect(panel()).toBeNull()
  })

  it('shows no panel for a late fee kept at its stored size, or lowered, with its date', async () => {
    await openManage('registration', { late_fee: 10, late_after: '2026-11-28T09:00' })
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Late fee ($)'), '10')
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Late fee ($)'), '4')
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Late fee ($)'), '11')
    expect(panel()).not.toBeNull()
  })

  it('shows no panel when a cheaper price comes from a discount that appears', async () => {
    await openManage('registration', { early_discount: 5, early_deadline: null })
    typeIn(screen.getByLabelText('Early entry ends'), '2026-11-20T23:59')
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Early-entry discount ($)'), '8')
    expect(panel()).toBeNull()
  })

  it('reads a late fee on a $0 event as no raise, since a free event has no late price', async () => {
    await openManage('registration', { entry_fee: 0, sections: [section('sec-open', 'Open', 0)] })
    typeIn(screen.getByLabelText('Late fee ($)'), '5')
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    expect(panel()).toBeNull()
  })
})

describe('midnight and the repeated hour in America/Chicago', () => {
  it.each([
    ['midnight', '2026-12-01T00:00'],
    ['the 1:30 AM hour on Sunday, November 1, 2026, which clocks in Chicago repeat', '2026-11-01T01:30'],
    ['the last minute of the day', '2026-12-01T23:59'],
  ])('shows the panel for a late fee starting at %s, and Keep it at $0 clears the date', async (_name, when) => {
    await openManage('registration', { late_fee: 5 })
    typeIn(screen.getByLabelText('Late fee starts'), when)
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect((screen.getByLabelText('Late fee starts') as HTMLInputElement).value).toBe('')
    expect(panel()).toBeNull()
  })

  it('sends the date as typed, unshifted, when a person who may charge saves a late fee starting at midnight', async () => {
    answers[`PATCH ${EVENT}`] = { status: 200, body: { ok: true } }
    await openManage('registration', { late_fee: 5 }, STANDING_GRANT, STANDING)
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T00:00')
    expect(panel()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save registration settings' }))
    await waitFor(() => expect(requestsTo('PATCH', EVENT)).toHaveLength(1))
    expect(JSON.parse(requestsTo('PATCH', EVENT)[0].body ?? '{}').lateAfter).toBe('2026-12-01T00:00')
  })
})

describe('a raise across both tabs, and replays', () => {
  it('asks before leaving the tab with a raise typed, keeps the panel and the raise when the answer is no, and drops both when it is yes', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Registration' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(panel()).not.toBeNull()
    expect(feeOf('Open').value).toBe('30')
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Registration' }))
    expect(panel()).toBeNull()
    expect(isDisabled('Save registration settings')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(feeOf('Open').value).toBe('25')
    expect(panel()).toBeNull()
  })

  it('draws the panel again when a price is raised again after Keep it at $0, and Keep it at $0 twice in a row changes nothing', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(panel()).toBeNull()
    typeIn(feeOf('Open'), '31')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(feeOf('Open').value).toBe('25')
    expect(requestsTo('PATCH', EVENT)).toEqual([])
  })

  it('keeps reading as asked, without sending a second request, when the price is put back and raised again', async () => {
    answers[`POST ${PAYOUT}`] = { status: 201, body: { ticket: { id: 'tk-1', kind: 'payout_request', status: 'open' }, created: true } }
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    await screen.findByRole('button', { name: ASKED })
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    typeIn(feeOf('Open'), '35')
    expect(isDisabled(ASKED)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: ASKED }))
    expect(requestsTo('POST', PAYOUT)).toHaveLength(1)
  })

  it('sends the same event\'s id for the ask from the Registration tab', async () => {
    answers[`POST ${PAYOUT}`] = { status: 200, body: { ticket: { id: 'tk-1', kind: 'payout_request', status: 'open' }, created: false } }
    await openManage('registration', { late_fee: 5 })
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    await screen.findByRole('button', { name: ASKED })
    expect(JSON.parse(requestsTo('POST', PAYOUT)[0].body ?? '{}')).toEqual({ tournamentId: 't1' })
  })
})

describe('no sections, and a refusal with no creation answer', () => {
  it('draws no G2 for a standing director on an event with no sections, and no panel, and does not fail', async () => {
    // The director's own event, so the missing sections are the one reason for no note.
    await openManage('details', { sections: [], entry_fee: 0, created_by: 'm-sd', is_visible: 0 }, STANDING_GRANT, STANDING)
    expect(screen.queryByText(G2)).toBeNull()
    expect(panel()).toBeNull()
  })

  it('draws the server\'s refusal as the panel even when the creation answer never arrived, with no red', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', {}, null)
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(redClasses()).toEqual([])
  })

  it('lets a save with no raise go after a refusal and Keep it at $0, and sends no fee then', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', {}, UNSET_GRANT)
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    answers[`PATCH ${EVENT}`] = { status: 200, body: { ok: true } }
    fireEvent.change(screen.getByLabelText('Location (city)'), { target: { value: 'Baton Rouge, LA' } })
    expect(isDisabled('Save details')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(requestsTo('PATCH', EVENT)).toHaveLength(2))
    const sent = JSON.parse(requestsTo('PATCH', EVENT)[1].body ?? '{}')
    expect(sent.location).toBe('Baton Rouge, LA')
    expect(JSON.stringify(sent)).not.toMatch(/"entryFee":30/)
    expect(panel()).toBeNull()
  })
})

describe('a raise only the server can see, and the focus with no fee box left', () => {
  it('shows no panel for a late fee on an event whose only priced section is archived, until the server refuses the save, which it draws as the panel', async () => {
    // The manage answer gives the live sections alone, here one free section, while the server's comparison reads the archived
    // row's price as well, so the raise is the server's to find.
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('registration', { entry_fee: 0, sections: [section('sec-blitz', 'Blitz', 0)] })
    typeIn(screen.getByLabelText('Late fee ($)'), '5')
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    expect(panel()).toBeNull()
    expect(isDisabled('Save registration settings')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save registration settings' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(requestsTo('PATCH', EVENT)).toHaveLength(1)
    expect(screen.queryByText(FEES_NEED_PAYOUT_ACCOUNT)).toBeNull()
    expect(redClasses()).toEqual([])
    expect(isDisabled('Save registration settings')).toBe(true)
  })

  it('moves the focus, for Keep it at $0 from the keyboard on an event with no live section, to the Add button beside the custom section\'s name', async () => {
    // With no live section only a refused save draws the panel, and no fee box is there to take the focus.
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', { sections: [], entry_fee: 0 })
    fireEvent.change(screen.getByLabelText('Location (city)'), { target: { value: 'Baton Rouge, LA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(screen.queryAllByRole('table')).toEqual([])
    const keep = screen.getByRole('button', { name: KEEP })
    keep.focus()
    fireEvent.click(keep)
    expect(panel()).toBeNull()
    const add = screen.getAllByRole('button', { name: 'Add' })
    expect(add).toHaveLength(1)
    expect(document.activeElement).toBe(add[0])
    // A tap or a mouse press moves no focus, as on a fee box.
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    const again = screen.getByRole('button', { name: KEEP })
    again.focus()
    fireEvent.click(again, { detail: 1 })
    expect(panel()).toBeNull()
    expect(document.activeElement).not.toBe(add[0])
  })
})
