// @vitest-environment jsdom
//
// The edges of New tournament on /workspace (D20, Q11), behind
// standingDirectors. The Events list asks GET /api/me/tournament-creation
// for a tournament_director alone, with the switch on: a member who directs
// one event, a club rep with or without a club and an auditor ask nothing of
// it, and their list is read signed out, as today. A standing director keeps
// the "Standing director" badge whatever the answer says, since the label
// follows the switch and not the grant, and keeps today's note on an empty
// list when the answer says they may not create. A sign-in that has lapsed,
// a creation answer that fails and a list that fails each leave the page as
// today's: no New tournament, and the list's error in today's words. The
// list is asked beside the creation answer, not after it. An event the
// director created and published since they signed in shows, though the
// events they direct were read at sign-in. The real page runs through the
// real client, with fetch stubbed.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
const sign = vi.hoisted(() => ({ token: 'tok-edge' as string | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: sign.token ? { access_token: sign.token } : null } }) } },
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

const CREATION = '/api/me/tournament-creation'
const LIST = '/api/tournaments'
const TODAYS_NOTE = 'Events you’re assigned to direct will appear here.'

function event(id: string, name: string, over: Record<string, unknown> = {}) {
  return { id, name, date: '2026-12-05', location: 'Lafayette, LA', rounds: 4, status: 'upcoming', is_visible: 1, club_id: null, club_name: null, sections: [], ...over }
}

const DIRECTED = event('t-directed', 'Acadiana Open', { created_by: 'm-admin' })
const PUBLISHED_SINCE = event('t-published', 'Lafayette Winter Quads', { created_by: 'm-sd' })
const OTHER = event('t-other', 'Shreveport Swiss', { created_by: 'm-admin' })

interface Seen { url: string; method: string; headers: Record<string, string> }
let seen: Seen[] = []
let answers: Record<string, { status: number; body: unknown } | 'hold'> = {}
let release: (() => void) | null = null

beforeEach(() => {
  flags.standingDirectors = true
  sign.token = 'tok-edge'
  seen = []
  release = null
  answers = {
    [LIST]: { status: 200, body: { tournaments: [DIRECTED, PUBLISHED_SINCE, OTHER] } },
    [CREATION]: { status: 200, body: { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null } },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>
    seen.push({ url, method: init?.method ?? 'GET', headers })
    const path = url.split('?')[0]
    // The creation endpoint answers 401 to a request with no sign-in, as it does in both states.
    if (path === CREATION && !headers.Authorization) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    const answer = answers[path] ?? { status: 404, body: { error: 'Not found' } }
    if (answer === 'hold') {
      await new Promise<void>((resolve) => { release = resolve })
      return new Response(JSON.stringify({ grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }), { status: 200 })
    }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  release?.()
  cleanup()
  vi.unstubAllGlobals()
})

const requestsTo = (path: string) => seen.filter((s) => s.url.split('?')[0] === path)

function openWorkspace(who: { role: string; id: string; club_id?: string | null; directed?: string[] }, tab = 'events') {
  const member = { id: who.id, role: who.role, club_id: who.club_id ?? null, full_name: 'Gerald Landry' }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false,
    directedTournamentIds: who.directed ?? [], directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/workspace?tab=${tab}`]}>
        <Routes><Route path="/workspace" element={<WorkspacePage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const listShown = () => screen.findByText(/Tournaments · \d+ current/)

const STANDING = { role: 'tournament_director', id: 'm-sd', directed: ['t-directed'] }

describe('who asks the creation endpoint on /workspace, with the switch on', () => {
  it('a member who directs one event asks nothing of it, reads the list signed out and sees the event they direct alone, with no New tournament', async () => {
    openWorkspace({ role: 'member', id: 'm-one', directed: ['t-directed'] })
    await listShown()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo(LIST).map((s) => s.headers)).toEqual([{}])
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.queryByText('Lafayette Winter Quads')).toBeNull()
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.getByText('Event director', { selector: 'span' })).toBeTruthy()
  })

  it('a club rep with no club asks nothing of it and keeps today\'s note and page', async () => {
    openWorkspace({ role: 'club_rep', id: 'm-rep', club_id: null })
    await listShown()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo(LIST).map((s) => s.headers)).toEqual([{}])
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.getByText(/isn’t linked to a club yet/)).toBeTruthy()
  })

  it('an auditor, who has no Events list, asks neither the list nor the creation endpoint', async () => {
    openWorkspace({ role: 'lca_auditor', id: 'm-aud' }, 'events')
    await screen.findByRole('heading', { level: 1, name: 'Workspace' })
    expect(screen.queryByRole('tab', { name: /Events/ })).toBeNull()
    expect(requestsTo(CREATION)).toEqual([])
    expect(requestsTo(LIST)).toEqual([])
  })
})

describe('a standing director\'s Events list, with the switch on', () => {
  it('keeps the "Standing director" badge and today\'s note when the answer says they may not create', async () => {
    answers[CREATION] = { status: 200, body: { grant: 'none', canCreate: false, canChargeFees: true, clubId: null } }
    answers[LIST] = { status: 200, body: { tournaments: [] } }
    openWorkspace(STANDING)
    await listShown()
    expect(screen.getByText('Standing director', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText(TODAYS_NOTE)).toBeTruthy()
    expect(screen.queryByText('Create your first tournament to get started.')).toBeNull()
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
  })

  it('with a sign-in that has lapsed, asks with no sign-in, takes the 401 as no grant and shows the list as today, with no New tournament', async () => {
    sign.token = null
    openWorkspace(STANDING)
    await listShown()
    expect(requestsTo(CREATION).map((s) => s.headers.Authorization)).toEqual([undefined])
    expect(requestsTo(LIST).map((s) => s.headers.Authorization)).toEqual([undefined])
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.queryByText('Unauthorized')).toBeNull()
  })

  it('shows the list\'s own error in today\'s words when the list fails, and no New tournament', async () => {
    answers[LIST] = { status: 500, body: { error: 'The tournament list could not be read.' } }
    openWorkspace(STANDING)
    expect(await screen.findByText('The tournament list could not be read.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /New tournament/ })).toBeNull()
  })

  it('asks for the list beside the creation answer, before that answer arrives, and draws the list once both are in', async () => {
    answers[CREATION] = 'hold'
    openWorkspace(STANDING)
    await vi.waitFor(() => expect(requestsTo(CREATION)).toHaveLength(1))
    expect(requestsTo(LIST)).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
    release?.()
    await listShown()
    expect(screen.getByRole('button', { name: /New tournament/ })).toBeTruthy()
  })

  it('shows an event the director created and published since signing in, which is not among the events read then, and no one else\'s', async () => {
    openWorkspace(STANDING)
    await listShown()
    expect(screen.getByText('Lafayette Winter Quads')).toBeTruthy()
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(screen.queryByText('Shreveport Swiss')).toBeNull()
    expect(screen.getByText('Tournaments · 2 current')).toBeTruthy()
  })

  it('shows none of those events with the switch off, where the list is read signed out and an event counts only by the ones read at sign-in', async () => {
    flags.standingDirectors = false
    openWorkspace(STANDING)
    await listShown()
    expect(screen.queryByText('Lafayette Winter Quads')).toBeNull()
    expect(screen.getByText('Acadiana Open')).toBeTruthy()
    expect(seen.map((s) => s.url)).toEqual([LIST])
  })
})
