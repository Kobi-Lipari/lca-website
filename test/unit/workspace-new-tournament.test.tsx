// @vitest-environment jsdom
//
// New tournament on /workspace's Events list for a standing director (D20,
// Q11), behind standingDirectors. With the switch on, a tournament director
// asks GET /api/me/tournament-creation what they may create and reads the
// list signed in; when the answer says they may, the list gains New
// tournament, its empty note becomes TournamentList's own, the hero names
// the role "Standing director", and the list holds the events they direct
// and the ones they created, a draft made since they signed in among them.
// The wizard's draft sends no club, so the event is LCA-run. With the switch
// off the page is today's: no New tournament, today's badge, the list read
// signed out, and no request to the creation endpoint. A club rep's page is
// the same with the switch on and off. The real page runs through the real
// client, with fetch stubbed, so every request it makes is seen.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-ws' } } }) } },
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

const { WorkspacePage } = await import('@/pages/WorkspacePage')
const { FEATURES: REAL_FEATURES } = await vi.importActual<typeof import('@/lib/features')>('@/lib/features')

const CREATION = '/api/me/tournament-creation'

/** One row of the list as GET /api/tournaments answers it, with the fields the Events list draws. */
function event(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, date: '2026-12-05', location: 'Lafayette, LA', rounds: 4, status: 'upcoming', is_visible: 1, club_id: null, club_name: null, ...over }
}

const DIRECTED = event('t-directed', 'Acadiana Open', { created_by: 'm-admin' })
const CREATED = event('t-created', 'Lafayette Winter Quads', { is_visible: 0, created_by: 'm-sd' })
const OTHER = event('t-other', 'Shreveport Swiss')
const CLUB_EVENT = event('t-club', 'Kenner Club Quads', { club_id: 'club-k', club_name: 'Kenner Chess Club' })

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
  answers = {
    '/api/tournaments': { status: 200, body: { tournaments: [DIRECTED, CREATED, OTHER, CLUB_EVENT] } },
    [CREATION]: { status: 200, body: { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null } },
    '/api/admin/tournaments': { status: 201, body: { tournament: { id: 't-new' } } },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    seen.push({ url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined })
    const answer = answers[url.split('?')[0]] ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const requestsTo = (path: string) => seen.filter((s) => s.url.split('?')[0] === path)

async function openEvents(who: { role: string; id: string; club_id?: string | null; directed?: string[] }) {
  const member = { id: who.id, role: who.role, club_id: who.club_id ?? null, full_name: 'Gerald Landry' }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false,
    directedTournamentIds: who.directed ?? [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace?tab=events']}>
        <Routes>
          <Route path="/workspace" element={<WorkspacePage />} />
          <Route path="/admin/tournaments/:id" element={<p>Manage page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByText(/Tournaments · \d+ current/)
}

const STANDING = { role: 'tournament_director', id: 'm-sd', directed: ['t-directed'] }
const REP = { role: 'club_rep', id: 'm-rep', club_id: 'club-k' }

describe('New tournament on /workspace for a standing director', () => {
  it('ships behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it('with the switch on, shows New tournament and the "Standing director" badge when the creation answer says the director may create', async () => {
    await openEvents(STANDING)
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
    expect(screen.getByText('Standing director')).toBeTruthy()
    expect(screen.queryByText('Tournament Director')).toBeNull()
    expect(requestsTo(CREATION)).toHaveLength(1)
    expect(requestsTo(CREATION)[0].headers.Authorization).toBe('Bearer tok-ws')
  })

  it('with the switch on, reads the list signed in and shows the events the director directs and the ones they created, and no one else\'s', async () => {
    await openEvents(STANDING)
    const list = requestsTo('/api/tournaments')
    expect(list).toHaveLength(1)
    expect(list[0].headers.Authorization).toBe('Bearer tok-ws')
    // The draft they created since they signed in is not among the events read at sign-in, and is shown all the same.
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.getByText('Lafayette Winter Quads')).toBeTruthy()
    expect(screen.queryByText('Shreveport Swiss')).toBeNull()
    expect(screen.queryByText('Kenner Club Quads')).toBeNull()
    expect(screen.getByText('Tournaments · 2 current')).toBeTruthy()
  })

  it('with the switch on, creates an LCA-run draft from the wizard: the create sends no club', async () => {
    await openEvents(STANDING)
    fireEvent.click(screen.getByRole('button', { name: /New tournament/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Continue/ }))
    expect(screen.queryByLabelText(/Organizing club/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Lafayette Spring Quads' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-03-06' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Lafayette, LA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Manage page')
    const create = requestsTo('/api/admin/tournaments')
    expect(create).toHaveLength(1)
    expect(create[0].method).toBe('POST')
    const body = JSON.parse(create[0].body ?? '{}') as Record<string, unknown>
    expect(body.name).toBe('Lafayette Spring Quads')
    expect('clubId' in body).toBe(false)
  })

  it('with the switch on and an empty list, gives TournamentList\'s own note for someone who may create', async () => {
    answers['/api/tournaments'] = { status: 200, body: { tournaments: [] } }
    await openEvents(STANDING)
    await waitFor(() => expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy())
    expect(screen.getByText('Create your first tournament to get started.')).toBeTruthy()
    expect(screen.queryByText('Events you’re assigned to direct will appear here.')).toBeNull()
  })

  it('with the switch on, shows no New tournament when the answer says the director may not create, as with the constant unset', async () => {
    answers[CREATION] = { status: 200, body: { grant: 'none', canCreate: false, canChargeFees: true, clubId: null } }
    await openEvents(STANDING)
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(requestsTo(CREATION)).toHaveLength(1)
  })

  it('with the switch on, keeps the page usable and shows no New tournament when the creation answer fails', async () => {
    answers[CREATION] = { status: 500, body: { error: 'Server error' } }
    await openEvents(STANDING)
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.queryByText('Server error')).toBeNull()
  })

  it('with the switch off, is today\'s page: no New tournament, today\'s badge, the list read signed out, the directed events alone, and no request to the creation endpoint', async () => {
    flags.standingDirectors = false
    await openEvents(STANDING)
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.getByText('Tournament Director')).toBeTruthy()
    expect(screen.queryByText('Standing director')).toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
    const list = requestsTo('/api/tournaments')
    expect(list).toHaveLength(1)
    expect(list[0].headers).toEqual({})
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.queryByText('Lafayette Winter Quads')).toBeNull()
    expect(seen.map((s) => s.url)).toEqual(['/api/tournaments'])
  })

  it('with the switch off and an empty list, keeps today\'s note', async () => {
    flags.standingDirectors = false
    answers['/api/tournaments'] = { status: 200, body: { tournaments: [] } }
    await openEvents(STANDING)
    expect(screen.getByText('Events you’re assigned to direct will appear here.')).toBeTruthy()
  })
})

describe('a club rep\'s Events list, the same with the switch on and off', () => {
  it.each([true, false])('with the switch %s, shows New tournament for the club, today\'s badge, the club\'s events read signed out, and asks nothing of the creation endpoint', async (on) => {
    flags.standingDirectors = on
    await openEvents(REP)
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
    expect(screen.getByText('Club Representative')).toBeTruthy()
    expect(screen.queryByText('Standing director')).toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
    expect(screen.getByText('Kenner Club Quads')).toBeTruthy()
    expect(screen.queryByText('Lafayette Winter Quads')).toBeNull()
    expect(screen.getByText('Tournaments · 1 current')).toBeTruthy()
  })
})
