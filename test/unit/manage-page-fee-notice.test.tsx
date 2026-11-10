// @vitest-environment jsdom
//
// G1 and G2 on today's manage page, behind standingDirectors (WS08 step 10).
// With the switch on, the page asks once what the signed-in person may do
// with fees. Someone who may not charge a fee, a one-event director, sees
// G1's panel once a typed price is above the price the page loaded, at any
// tier, under the sections table on the Details tab and under the prices on
// the Registration tab, and both Save buttons are held while it shows; Keep
// it at $0 puts back every loaded price, both dates included, so an event
// the president priced goes back to its price; the ask posts one payout
// request about the event, however often it is pressed; and the server's
// refusal of a raised fee, if one comes all the same, is drawn as the panel
// and never in the red strip. As the panel shows, a polite status line,
// visually hidden and there from the start, says its title, so a screen
// reader hears it; after a failed ask it says the red strip's words until
// the next press, and the focus goes back on the ask. A standing director's
// fees carry G2's note and no panel,
// on an event they created only, and never beside the panel. With the
// switch off the page is today's: no creation call, no panel, no status
// line and the refusal in today's strip. The real page runs through the
// real client, with fetch stubbed, so every request it makes is seen.
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
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

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
/** The page's visually hidden status lines: the one a screen reader hears as G1 shows, and no other. */
const liveLines = () => screen.queryAllByRole('status').filter((el) => el.classList.contains('sr-only'))
/** Whether b comes after a in the page. */
const after = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('G1 on the Details tab', () => {
  it('ships behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it('with the switch on, asks once with the person\'s sign-in, and shows a one-event director no panel on an event the president priced at $25', async () => {
    await openManage('details')
    expect(requestsTo('GET', CREATION)).toHaveLength(1)
    expect(requestsTo('GET', CREATION)[0].headers.Authorization).toBe('Bearer tok-fees')
    expect(feeOf('Open').value).toBe('25')
    expect(panel()).toBeNull()
    expect(screen.queryByText(G2)).toBeNull()
  })

  it('shows the panel under the sections table once 30 is typed, holds Save details, and Keep it at $0 puts 25 back', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    const note = panel()
    expect(note).not.toBeNull()
    const table = screen.getByRole('table')
    expect(after(table, note!)).toBe(true)
    expect(after(note!, screen.getByText('Additional details'))).toBe(true)
    expect(isDisabled('Save details')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(feeOf('Open').value).toBe('25')
    expect(panel()).toBeNull()
    expect(requestsTo('PATCH', EVENT)).toEqual([])
  })

  it('on a $0 event shows the panel once 10 is typed, and Keep it at $0 puts it back at 0', async () => {
    await openManage('details', { entry_fee: 0, sections: [section('sec-open', 'Open', 0)] })
    expect(panel()).toBeNull()
    typeIn(feeOf('Open'), '10')
    expect(panel()).not.toBeNull()
    expect(isDisabled('Save details')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(feeOf('Open').value).toBe('0')
    expect(panel()).toBeNull()
  })

  it('shows no panel for a lower price, or the loaded price typed again, and leaves Save details free', async () => {
    await openManage('details')
    typeIn(feeOf('Open'), '20')
    expect(panel()).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
    typeIn(feeOf('Open'), '25')
    expect(panel()).toBeNull()
  })

  it('shows the panel for a new section at $15, and Keep it at $0 puts that section at $0 and keeps it', async () => {
    await openManage('details')
    fireEvent.click(screen.getByRole('button', { name: 'U1600' }))
    expect(feeOf('U1600').value).toBe('0')
    expect(panel()).toBeNull()
    typeIn(feeOf('U1600'), '15')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(feeOf('U1600').value).toBe('0')
    expect(feeOf('Open').value).toBe('25')
    expect(panel()).toBeNull()
  })

  it('reads a section removed and added again under its name at its loaded price, as the server\'s save matches it', async () => {
    await openManage('details')
    const row = screen.getAllByRole('row').find((r) => r.querySelector('td')?.textContent === 'Open')!
    fireEvent.click(row.querySelectorAll('td')[4].querySelector('button')!)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    typeIn(feeOf('Open'), '25')
    expect(panel()).toBeNull()
    typeIn(feeOf('Open'), '26')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(feeOf('Open').value).toBe('25')
  })
})

describe('G1 on the Registration tab', () => {
  it('shows no panel for a late fee with no date, which does not apply, then the panel under the prices once "Late fee starts" is set, holding Save registration settings', async () => {
    await openManage('registration')
    typeIn(screen.getByLabelText('Late fee ($)'), '5')
    expect(panel()).toBeNull()
    expect(screen.getByText('Set when the late fee starts, or it won\'t apply.')).toBeTruthy()
    const starts = screen.getByLabelText('Late fee starts')
    typeIn(starts, '2026-12-01T09:00')
    const note = panel()
    expect(note).not.toBeNull()
    expect(after(starts, note!)).toBe(true)
    expect(after(note!, screen.getByRole('button', { name: 'Save registration settings' }))).toBe(true)
    expect(isDisabled('Save registration settings')).toBe(true)
  })

  it('on an event storing a $5 late fee with no date, shows the panel once "Late fee starts" is set, and Keep it at $0 clears the date', async () => {
    await openManage('registration', { late_fee: 5 })
    expect((screen.getByLabelText('Late fee ($)') as HTMLInputElement).value).toBe('5')
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect((screen.getByLabelText('Late fee starts') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Late fee ($)') as HTMLInputElement).value).toBe('5')
    expect(panel()).toBeNull()
  })

  it('shows the panel for a discount lowered and for its deadline cleared, and Keep it at $0 puts both back', async () => {
    await openManage('registration', { early_discount: 5, early_deadline: '2026-11-20T23:59' })
    typeIn(screen.getByLabelText('Early-entry discount ($)'), '2')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect((screen.getByLabelText('Early-entry discount ($)') as HTMLInputElement).value).toBe('5')
    expect(panel()).toBeNull()
    typeIn(screen.getByLabelText('Early entry ends'), '')
    expect(panel()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect((screen.getByLabelText('Early entry ends') as HTMLInputElement).value).toBe('2026-11-20T23:59')
    expect(panel()).toBeNull()
    expect(isDisabled('Save registration settings')).toBe(true)
  })
})

describe('the focus after Keep it at $0', () => {
  /** Presses Keep it at $0 as a keyboard user does, the focus on the button, which goes with the panel. */
  function keepFromTheKeyboard() {
    const keep = screen.getByRole('button', { name: KEEP })
    keep.focus()
    expect(document.activeElement).toBe(keep)
    fireEvent.click(keep)
  }
  /** What a box reads when the focus reaches it, as a screen reader reads it then. */
  function readOnFocus(box: HTMLInputElement) {
    const read: string[] = []
    box.addEventListener('focus', () => read.push(box.value))
    return read
  }

  it('goes back to the fee box whose price it put back, once that price is drawn, so the next Tab goes on from the sections table', async () => {
    await openManage('details', { sections: [section('sec-open', 'Open', 25), section('sec-u1600', 'U1600', 15)] })
    typeIn(feeOf('U1600'), '20')
    const read = readOnFocus(feeOf('U1600'))
    keepFromTheKeyboard()
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(feeOf('U1600'))
    expect(read).toEqual(['15'])
    expect(feeOf('Open').value).toBe('25')
  })

  it('goes back to the late fee box, or to the early-entry discount box, on the Registration tab, once the prices are drawn', async () => {
    await openManage('registration', { late_fee: 5, early_discount: 5, early_deadline: '2026-11-20T23:59' })
    const late = screen.getByLabelText('Late fee ($)') as HTMLInputElement
    const early = screen.getByLabelText('Early-entry discount ($)') as HTMLInputElement
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    keepFromTheKeyboard()
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(late)
    expect((screen.getByLabelText('Late fee starts') as HTMLInputElement).value).toBe('')
    typeIn(early, '2')
    const read = readOnFocus(early)
    keepFromTheKeyboard()
    expect(panel()).toBeNull()
    expect(document.activeElement).toBe(early)
    expect(read).toEqual(['5'])
  })

  it('moves no focus for a tap or a mouse press, so no number keyboard opens on a tablet, and puts the prices back all the same', async () => {
    await openManage('details', { sections: [section('sec-open', 'Open', 25), section('sec-u1600', 'U1600', 15)] })
    typeIn(feeOf('U1600'), '20')
    const keep = screen.getByRole('button', { name: KEEP })
    keep.focus()
    // A tap or a mouse press is a click whose detail counts the press; a press from the keyboard is one whose detail is 0.
    fireEvent.click(keep, { detail: 1 })
    expect(panel()).toBeNull()
    expect(feeOf('U1600').value).toBe('15')
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })
})

describe('the ask for a payout account', () => {
  it('posts one payout request about the event through a double click, with the person\'s sign-in, and then reads as asked', async () => {
    answers[`POST ${PAYOUT}`] = { status: 201, body: { ticket: { id: 'tk-1', kind: 'payout_request', status: 'open' }, created: true } }
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    const ask = screen.getByRole('button', { name: ASK })
    fireEvent.click(ask)
    fireEvent.click(ask)
    await screen.findByRole('button', { name: ASKED })
    expect(requestsTo('POST', PAYOUT)).toHaveLength(1)
    expect(JSON.parse(requestsTo('POST', PAYOUT)[0].body ?? '{}')).toEqual({ tournamentId: 't1' })
    expect(requestsTo('POST', PAYOUT)[0].headers.Authorization).toBe('Bearer tok-fees')
    expect(isDisabled(ASKED)).toBe(true)
    expect(isDisabled('Save details')).toBe(true)
  })

  it('draws a failed ask as the page draws its other failed actions, and leaves the ask free to press again', async () => {
    answers[`POST ${PAYOUT}`] = { status: 403, body: { error: 'Not available yet.' } }
    await openManage('details')
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    // The red strip draws the words; the status line, visually hidden, holds them as well.
    await waitFor(() => expect(screen.getAllByText('Not available yet.').filter((el) => !el.classList.contains('sr-only'))).toHaveLength(1))
    const [strip] = screen.getAllByText('Not available yet.').filter((el) => !el.classList.contains('sr-only'))
    expect(strip.className.split(' ')).toContain('text-destructive')
    await waitFor(() => expect(isDisabled(ASK)).toBe(false))
    expect(requestsTo('POST', PAYOUT)).toHaveLength(1)
  })

  it('says a failed ask\'s words in the status line, the red strip\'s own, puts the focus back on the ask, and clears them at the next press', async () => {
    answers[`POST ${PAYOUT}`] = { status: 403, body: { error: 'Not available yet.' } }
    await openManage('details')
    const [line] = liveLines()
    typeIn(feeOf('Open'), '30')
    expect(line.textContent).toBe(G1)
    const ask = screen.getByRole('button', { name: ASK })
    ask.focus()
    fireEvent.click(ask)
    // A browser drops the focus to the page from the button the press disabled; jsdom keeps it there, so the case moves it away.
    const elsewhere = screen.getByLabelText('Tournament name')
    elsewhere.focus()
    expect(document.activeElement).toBe(elsewhere)
    await waitFor(() => expect(line.textContent).toBe('Not available yet.'))
    // No new words on the page: besides the hidden line, only the red strip draws them.
    const drawn = screen.getAllByText('Not available yet.').filter((el) => el !== line)
    expect(drawn.map((el) => el.className.split(' ').includes('text-destructive'))).toEqual([true])
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: ASK })))
    // The next press of the ask clears the words: the line says the panel's title again while the ask is sent.
    answers[`POST ${PAYOUT}`] = { status: 201, body: { ticket: { id: 'tk-1', kind: 'payout_request', status: 'open' }, created: true } }
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    expect(line.textContent).toBe(G1)
    await screen.findByRole('button', { name: ASKED })
    expect(line.textContent).toBe(G1)
    expect(requestsTo('POST', PAYOUT)).toHaveLength(2)
  })

  it('clears a failed ask\'s words with the panel, gone through Keep it at $0 or a price typed back, so a panel drawn again says its title', async () => {
    answers[`POST ${PAYOUT}`] = { status: 403, body: { error: 'Not available yet.' } }
    await openManage('details')
    const [line] = liveLines()
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    await waitFor(() => expect(line.textContent).toBe('Not available yet.'))
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(panel()).toBeNull()
    expect(line.textContent).toBe('')
    typeIn(feeOf('Open'), '30')
    expect(line.textContent).toBe(G1)
    fireEvent.click(screen.getByRole('button', { name: ASK }))
    await waitFor(() => expect(line.textContent).toBe('Not available yet.'))
    // The loaded price typed back takes the panel away with no press, and the words with it.
    typeIn(feeOf('Open'), '25')
    expect(panel()).toBeNull()
    expect(line.textContent).toBe('')
    typeIn(feeOf('Open'), '35')
    expect(line.textContent).toBe(G1)
  })
})

describe('the server\'s refusal of a raised fee', () => {
  it('is drawn as the panel and never in the red strip, and holds the save until Keep it at $0', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    // A page loaded before the rule was set: the answer it holds says the person may charge.
    await openManage('details', {}, UNSET_GRANT)
    typeIn(feeOf('Open'), '30')
    expect(panel()).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(requestsTo('PATCH', EVENT)).toHaveLength(1)
    expect(screen.queryByText(FEES_NEED_PAYOUT_ACCOUNT)).toBeNull()
    expect(redClasses()).toEqual([])
    expect(isDisabled('Save details')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(panel()).toBeNull()
    expect(feeOf('Open').value).toBe('25')
  })

  it('is drawn as the panel when the Registration tab\'s save is refused, under the prices', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('registration', {}, UNSET_GRANT)
    typeIn(screen.getByLabelText('Late fee ($)'), '5')
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    fireEvent.click(screen.getByRole('button', { name: 'Save registration settings' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(after(screen.getByLabelText('Late fee starts'), panel()!)).toBe(true)
    expect(redClasses()).toEqual([])
  })

  it('leaves every other error in today\'s red strip, with no panel', async () => {
    answers[`PATCH ${EVENT}`] = { status: 500, body: { error: 'The save could not be stored.' } }
    await openManage('details', {}, UNSET_GRANT)
    typeIn(feeOf('Open'), '30')
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    const strip = await screen.findByText('The save could not be stored.')
    expect(strip.className.split(' ')).toContain('text-destructive')
    expect(panel()).toBeNull()
  })
})

describe('G2 for a standing director', () => {
  it('draws the note under the sections table, and no panel when a price is raised, leaving Save details free', async () => {
    await openManage('details', { created_by: 'm-sd', is_visible: 0 }, STANDING_GRANT, STANDING)
    const note = screen.getByRole('note')
    expect(note.textContent ?? '').toMatch(G2)
    expect(after(screen.getByRole('table'), note)).toBe(true)
    expect(screen.getAllByText(G2)).toHaveLength(1)
    typeIn(feeOf('Open'), '40')
    expect(panel()).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
  })

  it('draws no note on the Registration tab', async () => {
    await openManage('registration', { created_by: 'm-sd', is_visible: 0 }, STANDING_GRANT, STANDING)
    expect(screen.queryByText(G2)).toBeNull()
  })

  // G2 tells the director the fees are paid out to them after the event, which is so only on an event they created.
  it.each([
    ['the president', { created_by: 'm-pres' }],
    ['an LCA admin', { created_by: 'm-admin' }],
    ['a club rep', { created_by: 'm-rep', club_id: 'club-1', club_name: 'Acadiana Chess Club' }],
  ])('draws no note on an event %s created and named the standing director on, and no panel for a raise', async (_creator, over) => {
    await openManage('details', over, STANDING_GRANT, STANDING)
    expect(screen.queryByText(G2)).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
    typeIn(feeOf('Open'), '40')
    expect(panel()).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
  })

  it('gives way to the panel when a save is refused all the same, so the two never show together, and comes back after Keep it at $0', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', { created_by: 'm-sd', is_visible: 0 }, STANDING_GRANT, STANDING)
    expect(screen.getByText(G2)).toBeTruthy()
    typeIn(feeOf('Open'), '40')
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(panel()).not.toBeNull())
    expect(screen.queryByText(G2)).toBeNull()
    expect(screen.getAllByRole('note')).toEqual([panel()])
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(panel()).toBeNull()
    expect(screen.getByText(G2)).toBeTruthy()
    expect(feeOf('Open').value).toBe('25')
  })
})

describe('the line a screen reader hears as the panel shows', () => {
  it('is one polite status line, visually hidden and first in its container, there before the panel shows, empty until a raise is typed, then G1\'s title, and empty again after Keep it at $0', async () => {
    await openManage('details')
    expect(liveLines()).toHaveLength(1)
    const [line] = liveLines()
    expect(line.getAttribute('role')).toBe('status')
    expect(line.getAttribute('aria-live')).toBe('polite')
    // First among its container's children, so the spacing between the others is as it was.
    expect(line.parentElement?.firstElementChild).toBe(line)
    expect(line.textContent).toBe('')
    typeIn(feeOf('Open'), '30')
    expect(panel()).not.toBeNull()
    // The same line, there before the panel, so a screen reader reads the change in it.
    expect(liveLines()).toEqual([line])
    expect(line.textContent).toBe(G1)
    expect(panel()!.contains(line)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: KEEP }))
    expect(panel()).toBeNull()
    expect(line.textContent).toBe('')
  })

  it('says G1\'s title for a raise on the Registration tab, the panel under the prices', async () => {
    await openManage('registration', { late_fee: 5 })
    const [line] = liveLines()
    expect(line.textContent).toBe('')
    typeIn(screen.getByLabelText('Late fee starts'), '2026-12-01T09:00')
    expect(panel()).not.toBeNull()
    expect(liveLines()).toEqual([line])
    expect(line.textContent).toBe(G1)
  })

  it('says G1\'s title when the server refuses a save, and the red strip stays empty', async () => {
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', {}, UNSET_GRANT)
    const [line] = liveLines()
    typeIn(feeOf('Open'), '30')
    expect(line.textContent).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() => expect(line.textContent).toBe(G1))
    expect(panel()).not.toBeNull()
    expect(redClasses()).toEqual([])
  })
})

describe('with the switch off, or no answer', () => {
  it('with the switch off, asks nothing, draws neither notice nor the status line, leaves the saves free and draws the refusal in today\'s red strip', async () => {
    flags.standingDirectors = false
    answers[`PATCH ${EVENT}`] = { status: 403, body: { error: FEES_NEED_PAYOUT_ACCOUNT } }
    await openManage('details', {}, ONE_EVENT_GRANT)
    expect(requestsTo('GET', CREATION)).toEqual([])
    expect(liveLines()).toEqual([])
    typeIn(feeOf('Open'), '30')
    expect(panel()).toBeNull()
    expect(screen.queryByText(G2)).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    const strip = await screen.findByText(FEES_NEED_PAYOUT_ACCOUNT)
    expect(strip.className.split(' ')).toContain('text-destructive')
    expect(panel()).toBeNull()
    expect(liveLines()).toEqual([])
  })

  it('with the switch off, asks nothing for a standing director either, and draws no note and no status line', async () => {
    flags.standingDirectors = false
    await openManage('details', { created_by: 'm-sd', is_visible: 0 }, STANDING_GRANT, STANDING)
    expect(requestsTo('GET', CREATION)).toEqual([])
    expect(screen.queryByRole('note')).toBeNull()
    expect(liveLines()).toEqual([])
  })

  it('with the switch on and the creation answer failing, draws neither notice and leaves the saves as today', async () => {
    await openManage('details', {}, null)
    expect(requestsTo('GET', CREATION)).toHaveLength(1)
    typeIn(feeOf('Open'), '30')
    expect(screen.queryByRole('note')).toBeNull()
    expect(isDisabled('Save details')).toBe(false)
  })
})
