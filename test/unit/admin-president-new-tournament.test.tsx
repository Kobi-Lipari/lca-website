// @vitest-environment jsdom
//
// New tournament for the president on Admin › Tournaments, in the view-only
// Admin officers keep (D20, D21, Q11), behind standingDirectors. With the
// switch on, an observer or an officer asks GET /api/me/tournament-creation
// what they may create; when the grant is the president's, the list is read
// signed in, so it holds who created each event, and the section keeps
// today's list, the listed events, with the president's own drafts and no
// one else's, the same events the wizard offers as starting points. It
// gains New tournament, whose wizard has no club picker and sends no club,
// so the event is LCA-run, and a Directors button on the LCA-run events the
// president created and on no other. Everyone else's
// section is today's: an officer who is not the president, an LCA admin,
// and every reader with the switch off, who never asks the creation
// endpoint. The real page runs through the real client, with fetch stubbed.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-admin' } } }) } },
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
const PRESIDENT_ID = 'm-pres'

/** One row of the list as GET /api/tournaments answers it, with the fields the Tournaments section draws. */
function event(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, date: '2026-12-05', location: 'Baton Rouge, LA', rounds: 5, status: 'upcoming', is_visible: 1, club_id: null, club_name: null, ...over }
}

const OWN = event('t-own', 'Presidents Cup', { is_visible: 0, created_by: PRESIDENT_ID })
const ADMINS = event('t-admins', 'Louisiana Open', { created_by: 'm-admin' })
/** An event the president created that an LCA admin has since given to a club: the server lets the president name directors on LCA-run events alone. */
const MOVED = event('t-moved', 'Kenner Winter Swiss', { created_by: PRESIDENT_ID, club_id: 'club-k', club_name: 'Kenner Chess Club' })

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
    '/api/tournaments': { status: 200, body: { tournaments: [OWN, ADMINS, MOVED] } },
    '/api/clubs': { status: 200, body: { clubs: [{ id: 'club-k', name: 'Kenner Chess Club', color: null }] } },
    [CREATION]: { status: 200, body: { grant: 'president', canCreate: true, canChargeFees: true, clubId: null } },
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

async function openTournaments(who: { role: string; id: string }) {
  const member = { id: who.id, role: who.role, club_id: null, full_name: 'Avery Thibodeaux' }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false,
    directedTournamentIds: [], directedTournaments: [],
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

/** The card of the event with this name in the Tournaments list. */
const card = (name: string) => screen.getByText(name).closest('.rounded-xl') as HTMLElement
const directorsOn = (name: string) => within(card(name)).queryByRole('button', { name: /Directors/ })

const PRESIDENT = { role: 'lca_observer', id: PRESIDENT_ID }

describe('New tournament for the president on Admin › Tournaments', () => {
  it('with the switch on and the president\'s grant, shows New tournament, and Directors on the LCA-run event the president created and on no other', async () => {
    await openTournaments(PRESIDENT)
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
    expect(directorsOn('Presidents Cup')).not.toBeNull()
    expect(directorsOn('Louisiana Open')).toBeNull()
    expect(directorsOn('Kenner Winter Swiss')).toBeNull()
    // The view-only section keeps no club picker on the rows.
    expect(screen.queryByText('LCA (no club)')).toBeNull()
  })

  it('with the switch on, asks the creation endpoint first, then reads the president\'s list signed in', async () => {
    await openTournaments(PRESIDENT)
    expect(requestsTo(CREATION)).toHaveLength(1)
    expect(requestsTo(CREATION)[0].headers.Authorization).toBe('Bearer tok-admin')
    const list = requestsTo('/api/tournaments')
    expect(list).toHaveLength(1)
    expect(list[0].headers.Authorization).toBe('Bearer tok-admin')
    expect(seen.findIndex((s) => s.url === CREATION)).toBeLessThan(seen.findIndex((s) => s.url === '/api/tournaments'))
    // The president's own draft is listed, with its Draft tag.
    expect(within(card('Presidents Cup')).getByText('Draft')).toBeTruthy()
  })

  it('with the switch on, keeps today\'s listed events and the president\'s own drafts, and neither lists nor offers the wizard another person\'s draft', async () => {
    // The signed-in answer gives an observer every draft on the site, a club rep's and an LCA admin's among them.
    const repDraft = event('t-rep-draft', 'Kenner Club Quads', { is_visible: 0, created_by: 'm-rep', club_id: 'club-k', club_name: 'Kenner Chess Club' })
    const adminDraft = event('t-admin-draft', 'State Scholastic', { is_visible: 0, created_by: 'm-admin' })
    const ownSecond = event('t-own-second', 'Capital City Rapid', { is_visible: 0, created_by: PRESIDENT_ID })
    answers['/api/tournaments'] = { status: 200, body: { tournaments: [OWN, ADMINS, MOVED, repDraft, adminDraft, ownSecond] } }
    await openTournaments(PRESIDENT)
    for (const name of ['Presidents Cup', 'Capital City Rapid', 'Louisiana Open', 'Kenner Winter Swiss']) expect(screen.getByText(name), name).toBeTruthy()
    expect(screen.queryByText('Kenner Club Quads')).toBeNull()
    expect(screen.queryByText('State Scholastic')).toBeNull()
    expect(screen.getByText('Tournaments · 4 current')).toBeTruthy()
    expect(within(card('Capital City Rapid')).getByText('Draft')).toBeTruthy()
    expect(directorsOn('Capital City Rapid')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /New tournament/ }))
    fireEvent.click(await screen.findByRole('button', { name: /From an existing tournament/ }))
    const offered = [...(screen.getByDisplayValue('Select a tournament…') as HTMLSelectElement).options].map((o) => o.value).filter(Boolean)
    expect(offered).toEqual(['t-own', 't-admins', 't-moved', 't-own-second'])
  })

  it('with the switch on, creates an LCA-run draft from the wizard: no club picker, and the create sends no club', async () => {
    await openTournaments(PRESIDENT)
    fireEvent.click(screen.getByRole('button', { name: /New tournament/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Continue/ }))
    expect(screen.queryByLabelText(/Organizing club/)).toBeNull()
    fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Presidents Invitational' } })
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2027-02-13' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Baton Rouge, LA' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await screen.findByText('Manage page')
    const create = requestsTo('/api/admin/tournaments')
    expect(create).toHaveLength(1)
    expect(create[0].method).toBe('POST')
    const body = JSON.parse(create[0].body ?? '{}') as Record<string, unknown>
    expect(body.name).toBe('Presidents Invitational')
    expect('clubId' in body).toBe(false)
  })

  it.each([
    ['an officer who holds no seat', 'lca_officer', { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
    ['an observer who holds no seat', 'lca_observer', { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
  ] as const)('with the switch on, gives %s today\'s section: no New tournament, no Directors, the list read signed out', async (_label, role, grant) => {
    answers[CREATION] = { status: 200, body: grant }
    await openTournaments({ role, id: 'm-officer' })
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Directors/ })).toBeNull()
    expect(requestsTo(CREATION)).toHaveLength(1)
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
  })

  it('with the switch on, an officer who holds the President seat is the president as well', async () => {
    await openTournaments({ role: 'lca_officer', id: PRESIDENT_ID })
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
    expect(directorsOn('Presidents Cup')).not.toBeNull()
    expect(directorsOn('Louisiana Open')).toBeNull()
  })

  it('with the switch on, keeps today\'s section when the creation answer fails', async () => {
    answers[CREATION] = { status: 500, body: { error: 'Server error' } }
    await openTournaments(PRESIDENT)
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Directors/ })).toBeNull()
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
    expect(screen.queryByText('Server error')).toBeNull()
  })

  it('with the switch on, gives an LCA admin today\'s section and asks nothing of the creation endpoint', async () => {
    await openTournaments({ role: 'lca_admin', id: 'm-admin' })
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
    for (const name of ['Presidents Cup', 'Louisiana Open', 'Kenner Winter Swiss']) expect(directorsOn(name), name).not.toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
  })

  it('with the switch off, gives the president today\'s view-only section: neither New tournament nor Directors, and no request to the creation endpoint', async () => {
    flags.standingDirectors = false
    await openTournaments(PRESIDENT)
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Directors/ })).toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo('/api/tournaments').map((s) => s.headers)).toEqual([{}])
    expect(seen.map((s) => s.url).sort()).toEqual(['/api/clubs', '/api/tournaments'])
  })
})
