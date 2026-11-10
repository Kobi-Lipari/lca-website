// @vitest-environment jsdom
//
// The fee notes on the wizard's sections step, behind standingDirectors
// (WS08 step 10). With the switch on, the wizard asks once, as its sections
// step first opens and never as it opens, what the signed-in person may do
// with fees; a standing director then reads G2's note under the fee table.
// G1 is wired for WS09's regional representatives, the first creators who
// may not charge a fee: the wizard loads no prices, so any fee above $0
// shows the panel, Keep it at $0 sets every section's fee to $0, and the ask
// posts one payout request about no event yet; as the panel shows, a polite
// status line, visually hidden and there from the step's start, says its
// title, and after a failed ask the wizard's error line's words until the
// next press, the focus back on the ask. With the switch off the step is
// today's and nothing is asked. The
// real wizard runs through the real client, with fetch stubbed, so every
// request it makes is seen.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-wizard-fees' } } }) } },
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

const { TournamentWizard } = await import('@/areas/admin/components/TournamentWizard')
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

const CREATION = '/api/me/tournament-creation'
const PAYOUT = '/api/me/payout-request'
const G1 = 'Entry fees need a payout account first'
const G2 = /^You can charge an entry fee\. Fees are paid into LCA's Stripe account\./
const STANDING_GRANT = { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }
/** A grant that may create and may not charge, as WS09's regional representatives will hold. */
const NO_FEES_GRANT = { grant: 'none', canCreate: true, canChargeFees: false, clubId: null }

interface Seen {
  url: string
  method: string
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
    seen.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined })
    const answer = answers[`${method} ${url.split('?')[0]}`] ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const requestsTo = (method: string, path: string) => seen.filter((s) => s.method === method && s.url.split('?')[0] === path)

/** The wizard as the Workspace page draws it for a standing director. */
function openWizard() {
  const member = { id: 'm-sd', role: 'tournament_director', club_id: null, full_name: 'Gerald Landry' }
  const auth = {
    user: { id: 'm-sd' }, member, session: null, role: 'tournament_director', loading: false, memberLoading: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace']}>
        <Routes>
          <Route path="/workspace" element={<TournamentWizard templates={[]} onCancel={() => {}} />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** From the starting point through the three basics. */
async function fillBasics() {
  fireEvent.click(await screen.findByRole('button', { name: /Continue/ }))
  fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Lafayette Spring Quads' } })
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-03-06' } })
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Lafayette, LA' } })
}

/** On to the sections step, then the answer's arrival. */
async function openSections() {
  fireEvent.click(screen.getByRole('button', { name: /Next: Sections/ }))
  await screen.findByText('Add sections')
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

const fees = () => screen.getAllByRole('spinbutton') as HTMLInputElement[]
const after = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
/** The step's visually hidden status lines: the one a screen reader hears as G1 shows, and no other. */
const liveLines = () => screen.queryAllByRole('status').filter((el) => el.classList.contains('sr-only'))

describe('the fee notes on the wizard\'s sections step', () => {
  it('ship behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it('with the switch on, give a standing director G2\'s note under the fee table, and no panel for a fee above $0', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: STANDING_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    // No section yet, so no fee table and no note.
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const note = await screen.findByRole('note')
    expect(note.textContent ?? '').toMatch(G2)
    expect(after(screen.getByText('Entry fee'), note)).toBe(true)
    expect(after(note, screen.getByLabelText(/Registration closes/))).toBe(true)
    fireEvent.change(fees()[0], { target: { value: '30' } })
    expect(screen.queryByRole('note', { name: G1 })).toBeNull()
    expect(screen.getAllByRole('note')).toHaveLength(1)
  })

  it('with the switch off, draw nothing on the step and ask nothing', async () => {
    flags.standingDirectors = false
    answers[`GET ${CREATION}`] = { status: 200, body: STANDING_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '30' } })
    expect(screen.queryByRole('note')).toBeNull()
    expect(liveLines()).toEqual([])
    expect(requestsTo('GET', CREATION)).toEqual([])
    expect(seen).toEqual([])
  })

  it('keep one polite status line on the step, visually hidden and first in its column, empty for a standing director whatever the fee', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: STANDING_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    expect(liveLines()).toHaveLength(1)
    const [line] = liveLines()
    expect(line.getAttribute('aria-live')).toBe('polite')
    expect(line.parentElement?.firstElementChild).toBe(line)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '30' } })
    expect(liveLines()).toEqual([line])
    expect(line.textContent).toBe('')
  })

  it('say G1\'s title in that line once someone who may not charge types a fee above $0, and nothing again after Keep it at $0', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    const [line] = liveLines()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(line.textContent).toBe('')
    fireEvent.change(fees()[0], { target: { value: '30' } })
    expect(screen.getByRole('note', { name: G1 })).toBeTruthy()
    // The same line, there before the panel, so a screen reader reads the change in it.
    expect(liveLines()).toEqual([line])
    expect(line.textContent).toBe(G1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep it at $0' }))
    expect(line.textContent).toBe('')
  })

  it('ask once, as the sections step first opens, and never as the wizard or its basics open', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: STANDING_GRANT }
    openWizard()
    await fillBasics()
    expect(seen).toEqual([])
    await openSections()
    await waitFor(() => expect(requestsTo('GET', CREATION)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /Back/ }))
    await openSections()
    expect(requestsTo('GET', CREATION)).toHaveLength(1)
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([`GET ${CREATION}`])
  })

  it('give someone who may not charge G1\'s panel for any fee above $0, Keep it at $0 putting every section at $0', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'U1600' }))
    expect(screen.queryByRole('note', { name: G1 })).toBeNull()
    fireEvent.change(fees()[0], { target: { value: '30' } })
    fireEvent.change(fees()[1], { target: { value: '20' } })
    expect(screen.getByRole('note', { name: G1 })).toBeTruthy()
    expect(screen.queryByText(G2)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keep it at $0' }))
    expect(fees().map((f) => f.value)).toEqual(['0', '0'])
    expect(screen.queryByRole('note', { name: G1 })).toBeNull()
  })

  it('put the focus back in the first fee box Keep it at $0 set to $0, once the panel and the button pressed in it have gone', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'U1600' }))
    fireEvent.change(fees()[1], { target: { value: '20' } })
    const read: string[] = []
    fees()[1].addEventListener('focus', () => read.push(fees()[1].value))
    // A keyboard user tabs into the panel and presses the button.
    const keep = screen.getByRole('button', { name: 'Keep it at $0' })
    keep.focus()
    fireEvent.click(keep)
    expect(screen.queryByRole('note', { name: G1 })).toBeNull()
    expect(document.activeElement).toBe(fees()[1])
    expect(read).toEqual(['0'])
  })

  it('moves no focus for a tap or a mouse press on Keep it at $0, and sets every fee to $0 all the same', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '20' } })
    const keep = screen.getByRole('button', { name: 'Keep it at $0' })
    keep.focus()
    // A tap or a mouse press is a click whose detail counts the press; a press from the keyboard is one whose detail is 0.
    fireEvent.click(keep, { detail: 1 })
    expect(screen.queryByRole('note', { name: G1 })).toBeNull()
    expect(fees()[0].value).toBe('0')
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  it('send G1\'s ask as one payout request about no event yet, however often it is pressed, then read as asked', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    answers[`POST ${PAYOUT}`] = { status: 201, body: { ticket: { id: 'tk-2', kind: 'payout_request', status: 'open' }, created: true } }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '15' } })
    const ask = screen.getByRole('button', { name: 'Ask LCA to set up my payout account' })
    fireEvent.click(ask)
    fireEvent.click(ask)
    await screen.findByRole('button', { name: 'Asked. LCA has your request.' })
    expect(requestsTo('POST', PAYOUT)).toHaveLength(1)
    expect(JSON.parse(requestsTo('POST', PAYOUT)[0].body ?? '')).toEqual({})
  })

  it('say a failed ask\'s words in the status line, the wizard\'s error line\'s own, put the focus back on the ask, and clear them at the next press', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    answers[`POST ${PAYOUT}`] = { status: 403, body: { error: 'Not available yet.' } }
    openWizard()
    await fillBasics()
    await openSections()
    const [line] = liveLines()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '15' } })
    expect(line.textContent).toBe(G1)
    const ask = screen.getByRole('button', { name: 'Ask LCA to set up my payout account' })
    ask.focus()
    fireEvent.click(ask)
    // A browser drops the focus to the page from the button the press disabled; jsdom keeps it there, so the case moves it away.
    const elsewhere = screen.getByRole('button', { name: 'Add' })
    elsewhere.focus()
    expect(document.activeElement).toBe(elsewhere)
    await waitFor(() => expect(line.textContent).toBe('Not available yet.'))
    // No new words on the step: besides the hidden line, only the wizard's error line draws them.
    const drawn = screen.getAllByText('Not available yet.').filter((el) => el !== line)
    expect(drawn.map((el) => el.className.split(' ').includes('text-destructive'))).toEqual([true])
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ask LCA to set up my payout account' })))
    // The next press of the ask clears the words, and Keep it at $0, which takes the panel away, leaves the line empty.
    fireEvent.click(screen.getByRole('button', { name: 'Ask LCA to set up my payout account' }))
    expect(line.textContent).toBe(G1)
    await waitFor(() => expect(line.textContent).toBe('Not available yet.'))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it at $0' }))
    expect(line.textContent).toBe('')
    fireEvent.change(fees()[0], { target: { value: '15' } })
    expect(line.textContent).toBe(G1)
  })

  it('draw neither note when the answer fails', async () => {
    openWizard()
    await fillBasics()
    await openSections()
    await waitFor(() => expect(requestsTo('GET', CREATION)).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '30' } })
    expect(screen.queryByRole('note')).toBeNull()
  })
})
