// @vitest-environment jsdom
//
// The president's Directors button on Admin › Tournaments, row by row,
// against the server's own naming rule (D21; canAssignDirectors in
// domain/events/creation.ts, which POST /api/admin/tournaments/:id/directors
// asks). With standingDirectors on, the section draws the button on exactly
// the rows the rule lets the person name directors on: for the president,
// an LCA observer or an officer who holds the seat, the LCA-run events they
// created and no others, an event of theirs an LCA admin has since given to
// a club, an LCA admin's event, a club's event and an event with no creator
// among the others; for an observer who holds no seat, none; and for an LCA
// admin, every row, as today. The president's section lists today's listed
// events and the president's own drafts, never another person's draft,
// though the signed-in answer holds every draft on the site. New tournament
// shows where canCreate lets the person create an LCA-run event. The button
// the president gets opens the Directors window, which loads the event's
// directors and the members signed in and names a director with the
// president's sign-in. With the switch off, no row has the button for
// anyone in the view-only Admin. The real page runs through the real
// client, with fetch stubbed.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { canAssignDirectors, canCreate, type CreationPerson } from '../../domain/events/creation'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-pres' } } }) } },
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

const { AdminPage } = await import('@/pages/AdminPage')

const CREATION = '/api/me/tournament-creation'
const PRESIDENT = 'm-pres'

function event(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, date: '2026-12-05', location: 'Baton Rouge, LA', rounds: 5, status: 'upcoming', is_visible: 1, club_id: null, club_name: null, sections: [], time_control: null, custom_details: null, ...over }
}

/** A row as the list answers someone who does not manage the event: the same, with no creator key. */
function withoutCreator<Row extends Record<string, unknown>>(row: Row): Row {
  const copy: Record<string, unknown> = { ...row }
  delete copy.created_by
  return copy as Row
}

/** Every kind of row the president's list can hold, each with what the rule reads of it. */
const ROWS = [
  event('t-own-draft', 'Presidents Cup', { is_visible: 0, created_by: PRESIDENT }),
  event('t-own-live', 'Capital City Open', { created_by: PRESIDENT }),
  event('t-own-club', 'Kenner Winter Swiss', { created_by: PRESIDENT, club_id: 'club-k', club_name: 'Kenner Chess Club' }),
  event('t-admin', 'Louisiana Open', { created_by: 'm-admin' }),
  event('t-rep', 'Kenner Club Quads', {
    created_by: 'm-rep', club_id: 'club-k', club_name: 'Kenner Chess Club', rounds: 3, time_control: 'G/30+5',
    sections: [{ id: 'sec-quads', name: 'Quads', entryFee: 20 }],
  }),
  event('t-old', 'Crescent City Classic', { created_by: null }),
  event('t-other-draft', 'Bayou Scholastic', { is_visible: 0, created_by: 'm-admin' }),
]

const MEMBERS = [
  { id: 'm-remy', email: 'remy.guidry@example.invalid', full_name: 'Remy Guidry', uscf_id: null, membership_status: 'active', membership_expiry: '2027-06-30', role: 'member', club_id: null, club_name: null },
]

interface Seen { url: string; method: string; headers: Record<string, string>; body?: string }
let seen: Seen[] = []
let grant: Record<string, unknown> | null = null

beforeEach(() => {
  flags.standingDirectors = true
  seen = []
  grant = null
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    seen.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body as string | undefined })
    const path = url.split('?')[0]
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
    if (path === CREATION) return grant ? reply(200, grant) : reply(500, { error: 'Server error' })
    // As GET /api/tournaments answers: signed out, the listed events alone and no creator on any row.
    if (path === '/api/tournaments') {
      const signedIn = !!(init?.headers as Record<string, string> | undefined)?.Authorization
      return reply(200, { tournaments: signedIn ? ROWS : ROWS.filter((r) => r.is_visible === 1).map(withoutCreator) })
    }
    if (path === '/api/clubs') return reply(200, { clubs: [{ id: 'club-k', name: 'Kenner Chess Club', color: null }] })
    if (path === '/api/admin/members') return reply(200, { members: MEMBERS })
    if (path === '/api/admin/tournaments' && method === 'POST') return reply(201, { tournament: { id: 't-new' } })
    const directors = /^\/api\/admin\/tournaments\/([^/]+)\/directors$/.exec(path)
    if (directors) {
      const row = { tournament_id: directors[1], member_id: 'm-remy', assigned_at: '2026-11-05 19:00:00', full_name: 'Remy Guidry', email: 'remy.guidry@example.invalid' }
      return method === 'POST' ? reply(201, { directors: [row] }) : reply(200, { directors: [] })
    }
    return reply(404, { error: 'Not found' })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openTournaments(role: string, id: string) {
  const member = { id, role, club_id: null, full_name: 'Avery Thibodeaux' }
  const auth = {
    user: { id }, member, session: null, role, loading: false, memberLoading: false, directedTournamentIds: [], directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/admin/tournaments']}>
        <Routes>
          <Route path="/admin/:section" element={<AdminPage />} />
          <Route path="/admin/tournaments/:id" element={<p>Manage page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByText(/Tournaments · \d+ current/)
}

const card = (name: string) => screen.getByText(name).closest('.rounded-xl') as HTMLElement
const hasDirectors = (name: string) => within(card(name)).queryByRole('button', { name: /Directors/ }) !== null
const requestsTo = (path: string) => seen.filter((s) => s.url.split('?')[0] === path)
/** The list's answer to the one request the section made for it, asked again of the stub with the same headers. */
async function fetchedList(): Promise<Response> {
  const asked = requestsTo('/api/tournaments')
  expect(asked).toHaveLength(1)
  return (globalThis.fetch as (url: string, init?: RequestInit) => Promise<Response>)('/api/tournaments', { headers: asked[0].headers })
}

/** Each reader of the section, the grant the server answers them, and the person the rule reads. */
const READERS: ReadonlyArray<readonly [string, string, string, Record<string, unknown> | null, CreationPerson]> = [
  ['the president, an LCA observer who holds the seat', 'lca_observer', PRESIDENT,
    { grant: 'president', canCreate: true, canChargeFees: true, clubId: null }, { grant: 'president', memberId: PRESIDENT, repClubId: null }],
  ['an officer who holds the seat', 'lca_officer', PRESIDENT,
    { grant: 'president', canCreate: true, canChargeFees: true, clubId: null }, { grant: 'president', memberId: PRESIDENT, repClubId: null }],
  ['an observer who holds no seat', 'lca_observer', 'm-obs',
    { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }, { grant: 'none', memberId: 'm-obs', repClubId: null }],
  ['an LCA admin', 'lca_admin', 'm-admin', null, { grant: 'admin', memberId: 'm-admin', repClubId: null }],
]

describe('the Directors button with the switch on, row by row, as the server\'s naming rule answers', () => {
  it.each(READERS)('for %s', async (_who, role, id, answer, person) => {
    grant = answer
    await openTournaments(role, id)
    // Each row as the list answered this reader, and only the rows it drew: the president's section keeps the
    // listed events and the president's own drafts, and every other reader's section draws the whole answer.
    const answered = (JSON.parse(await (await fetchedList()).text()) as { tournaments: Array<Record<string, unknown>> }).tournaments
    expect(answered.length).toBeGreaterThan(0)
    const drawn = person.grant === 'president' ? answered.filter((row) => row.is_visible === 1 || row.created_by === id) : answered
    for (const row of answered.filter((r) => !drawn.includes(r))) expect(screen.queryByText(row.name as string), `${String(row.name)} is not listed`).toBeNull()
    for (const row of drawn) {
      const allowed = canAssignDirectors(person, { clubId: (row.club_id ?? null) as string | null, createdBy: (row.created_by ?? null) as string | null }, true)
      expect(hasDirectors(row.name as string), `${String(row.name)}: the rule answers ${allowed}`).toBe(allowed)
    }
    expect(screen.queryByRole('button', { name: /New tournament/ }) !== null).toBe(canCreate(person, null, true))
  })

  it('gives the president the button on the two LCA-run events they created and on none of the four others listed, and lists no other person\'s draft', async () => {
    grant = READERS[0][3]
    await openTournaments('lca_observer', PRESIDENT)
    const listed = ROWS.filter((row) => screen.queryByText(row.name) !== null)
    expect(listed.map((row) => row.id)).toEqual(['t-own-draft', 't-own-live', 't-own-club', 't-admin', 't-rep', 't-old'])
    expect(listed.filter((row) => hasDirectors(row.name)).map((row) => row.id)).toEqual(['t-own-draft', 't-own-live'])
  })

  it('reads a row with no creator key as no one\'s, as the list answers a reader who manages nothing', async () => {
    grant = READERS[0][3]
    ROWS.push(withoutCreator(event('t-bare', 'Pelican Rapid', { created_by: PRESIDENT })) as (typeof ROWS)[number])
    try {
      await openTournaments('lca_observer', PRESIDENT)
      expect(hasDirectors('Pelican Rapid')).toBe(false)
    } finally {
      ROWS.pop()
    }
  })
})

describe('the Directors window the president opens', () => {
  it('loads the event\'s directors and the members with the president\'s sign-in, and names a director on the event with it', async () => {
    grant = READERS[0][3]
    await openTournaments('lca_observer', PRESIDENT)
    fireEvent.click(within(card('Presidents Cup')).getByRole('button', { name: /Directors/ }))
    expect(await screen.findByRole('heading', { name: 'Tournament directors' })).toBeTruthy()
    await screen.findByText('No directors assigned yet.')
    const load = requestsTo('/api/admin/tournaments/t-own-draft/directors')
    expect(load.map((s) => [s.method, s.headers.Authorization])).toEqual([['GET', 'Bearer tok-pres']])
    expect(requestsTo('/api/admin/members').map((s) => s.headers.Authorization)).toEqual(['Bearer tok-pres'])

    fireEvent.change(screen.getByPlaceholderText(/Search members/), { target: { value: 'Remy' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Add' }))
    await screen.findByText('remy.guidry@example.invalid')
    const named = requestsTo('/api/admin/tournaments/t-own-draft/directors').filter((s) => s.method === 'POST')
    expect(named).toHaveLength(1)
    expect(named[0].headers.Authorization).toBe('Bearer tok-pres')
    expect(JSON.parse(named[0].body ?? '{}')).toEqual({ memberId: 'm-remy' })
  })
})

describe('the president\'s wizard', () => {
  it('sends no club when the president starts from a club\'s event, so the event is LCA-run, and copies the event\'s sections and rounds', async () => {
    grant = READERS[0][3]
    await openTournaments('lca_observer', PRESIDENT)
    fireEvent.click(screen.getByRole('button', { name: /New tournament/ }))
    fireEvent.click(await screen.findByRole('button', { name: /From an existing tournament/ }))
    fireEvent.change(screen.getByDisplayValue('Select a tournament…'), { target: { value: 't-rep' } })
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    expect(screen.queryByLabelText(/Organizing club/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Capital Quads' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-01-16' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Baton Rouge, LA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Manage page')
    const create = seen.filter((s) => s.url === '/api/admin/tournaments' && s.method === 'POST')
    expect(create).toHaveLength(1)
    expect(create[0].headers.Authorization).toBe('Bearer tok-pres')
    const body = JSON.parse(create[0].body ?? '{}') as Record<string, unknown>
    expect('clubId' in body).toBe(false)
    expect(body).toMatchObject({ name: 'Capital Quads', date: '2027-01-16', rounds: 3, timeControl: 'G/30+5', entryFee: 20, sections: [{ name: 'Quads', entryFee: 20 }] })
    expect((body.sections as Array<Record<string, unknown>>)[0]).not.toHaveProperty('id')
  })

  it('offers every event the president\'s section lists as a starting point, the president\'s own draft among them and no other person\'s draft', async () => {
    grant = READERS[0][3]
    await openTournaments('lca_observer', PRESIDENT)
    fireEvent.click(screen.getByRole('button', { name: /New tournament/ }))
    fireEvent.click(await screen.findByRole('button', { name: /From an existing tournament/ }))
    const offered = [...(screen.getByDisplayValue('Select a tournament…') as HTMLSelectElement).options].map((o) => o.value).filter(Boolean)
    expect(offered).toEqual(ROWS.filter((r) => r.is_visible === 1 || r.created_by === PRESIDENT).map((r) => r.id))
    expect(offered).toContain('t-own-draft')
    expect(offered).not.toContain('t-other-draft')
  })
})

describe('with the switch off', () => {
  it.each(READERS.slice(0, 3))('gives %s no Directors button and no New tournament, and asks nothing of the creation endpoint', async (_who, role, id, answer) => {
    flags.standingDirectors = false
    grant = answer
    await openTournaments(role, id)
    // Read signed out, as today: the listed events alone, none with a button.
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
    for (const row of ROWS.filter((r) => r.is_visible === 1)) expect(hasDirectors(row.name), row.name).toBe(false)
    expect(screen.queryByText('Presidents Cup')).toBeNull()
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
  })
})
