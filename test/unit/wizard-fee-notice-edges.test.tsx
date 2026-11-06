// @vitest-environment jsdom
//
// Edges of the fee notes on the wizard's sections step (WS08 step 10) beyond
// wizard-fee-notice.test.tsx: every grant that may charge sees no panel
// however high a fee is typed, a blank or negative box or a fee of $0 is no
// raise, one cent is, a single section above $0 among several is, and the
// panel returns after Keep it at $0 when a fee is typed again.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

const CREATION = '/api/me/tournament-creation'
const G1 = 'Entry fees need a payout account first'
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


const ADMIN_GRANTS = ['admin', 'president', 'club_rep'] as const

describe('the wizard\'s panel at its edges', () => {
  it.each(ADMIN_GRANTS)('shows a %s grant no panel and no G2 for a high fee', async (grant) => {
    answers[`GET ${CREATION}`] = { status: 200, body: { grant, canCreate: true, canChargeFees: true, clubId: null } }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '500' } })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('reads a blank box, a negative box and $0 as no raise, and one cent as a raise', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    for (const typed of ['', '-5', '0']) {
      fireEvent.change(fees()[0], { target: { value: typed } })
      expect(screen.queryByRole('note', { name: G1 }), typed).toBeNull()
    }
    fireEvent.change(fees()[0], { target: { value: '0.01' } })
    expect(screen.getByRole('note', { name: G1 })).toBeTruthy()
  })

  it('shows the panel for one section above $0 among several, and again after Keep it at $0 when a fee is typed again', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.click(screen.getByRole('button', { name: 'U1600' }))
    fireEvent.change(fees()[1], { target: { value: '10' } })
    expect(screen.getAllByRole('note')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Keep it at $0' }))
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.change(fees()[0], { target: { value: '5' } })
    expect(screen.getByRole('note', { name: G1 })).toBeTruthy()
  })

  it('draws no red anywhere on the step while the panel shows', async () => {
    answers[`GET ${CREATION}`] = { status: 200, body: NO_FEES_GRANT }
    openWizard()
    await fillBasics()
    await openSections()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.change(fees()[0], { target: { value: '30' } })
    const note = screen.getByRole('note', { name: G1 })
    const classes = [note, ...note.querySelectorAll('*')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/))
    expect(classes.filter((c) => /^(?:text|bg|border|ring|fill)-(?:destructive|red-\d+)(?:\/\d+)?$/.test(c))).toEqual([])
  })
})
