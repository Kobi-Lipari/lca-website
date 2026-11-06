// @vitest-environment jsdom
//
// The edges of the manage page for the creator (Q11), behind standingDirectors:
// the lift of view-only is for the one event a person directs and no other; a
// draft whose creator the answer does not name shows no Danger zone to anyone
// but an LCA admin; and the view-only helpers, given no answer of their own,
// read the role as before. The real page runs through the real client, with
// fetch stubbed.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-edges' } } }) } },
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
const { ViewOnlyFieldset, ViewOnlyNote } = await import('@/lib/viewOnly')

const VIEW_ONLY = /^View only: you can see everything about this event/

function tournament(over: Record<string, unknown> = {}) {
  return {
    id: 't1', name: 'Lafayette Winter Quads', location: 'Lafayette, LA', venue: null, date: '2026-12-05', end_date: null,
    entry_fee: 0, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    member_discount: 0, requires_lca_membership: 1,
    sections: [], rounds: 3, max_players: null, status: 'upcoming', description: null, registration_deadline: null,
    club_id: null, created_by: 'm-pres', created_at: '2026-11-05 18:00:00', registration_status: 'draft', registration_opens_at: null,
    is_rated: 1, is_visible: 0, round_schedule: [], registration_closes_at: null, custom_details: [], time_control: null,
    registration_url: null, eligibility: null, organizer: null, pairing_system: 'uscf', accelerated: 0, keep_apart: 'family',
    report_settings: null, is_state_championship: 0, review_notified_at: null, club_name: null, club_color: null, ...over,
  }
}

let meCalls = 0
beforeEach(() => {
  flags.standingDirectors = true
  meCalls = 0
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

interface Person { role: string; id: string; directed: string[]; signedIn?: boolean }

async function openManage(who: Person, over: Record<string, unknown> = {}) {
  const member = { id: who.id, role: who.role, club_id: null, full_name: 'Avery Thibodeaux' }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    if (path === '/api/admin/tournaments/t1/manage') {
      return new Response(JSON.stringify({ tournament: tournament(over), roster: [], games: [], standings: [], prizes: [], directors: [] }), { status: 200 })
    }
    if (path === '/api/me') {
      meCalls += 1
      return new Response(JSON.stringify({ member, registrations: [], directedTournaments: [] }), { status: 200 })
    }
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
  const auth = {
    user: who.signedIn === false ? null : { id: who.id }, member: who.signedIn === false ? null : member, session: null,
    role: who.role, loading: false, memberLoading: false, directedTournamentIds: who.directed, directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/admin/tournaments/t1?tab=details']}>
        <Routes>
          <Route path="/admin/tournaments/:id" element={<TournamentManagePage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { name: /Lafayette Winter Quads/ })
  await waitFor(() => expect(meCalls).toBe(1))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

const nameDisabled = () => (screen.getByLabelText('Tournament name') as HTMLInputElement).matches(':disabled')

describe('the lift of view-only is for the one event a person directs', () => {
  it('with the switch on, keeps an observer view-only on this event when they direct only another', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t2', 't10'] })
    expect(nameDisabled()).toBe(true)
    expect(screen.getByText(VIEW_ONLY)).toBeTruthy()
  })

  it('with the switch on, lifts it for an observer who directs this event among several', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t2', 't1'] })
    expect(nameDisabled()).toBe(false)
    expect(screen.queryByText(VIEW_ONLY)).toBeNull()
  })

  it('with the switch off, keeps an observer view-only on every event, directed or not', async () => {
    flags.standingDirectors = false
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t1'] })
    expect(nameDisabled()).toBe(true)
    expect(screen.getByText(VIEW_ONLY)).toBeTruthy()
  })

  it.each([true, false])('with the switch %s, leaves an LCA admin\'s tabs open to change', async (on) => {
    flags.standingDirectors = on
    await openManage({ role: 'lca_admin', id: 'm-admin', directed: [] })
    expect(nameDisabled()).toBe(false)
    expect(screen.queryByText(VIEW_ONLY)).toBeNull()
  })
})

describe('the Danger zone, where the answer does not make the viewer the creator', () => {
  it('with the switch on, shows an observer who directs a draft someone else created no Danger zone', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t1'] }, { created_by: 'm-sd' })
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it('with the switch on, shows no Danger zone when the answer names no creator', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t1'] }, { created_by: null })
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it('with the switch on, shows no Danger zone when no member is signed in, though the answer names no creator either', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t1'], signedIn: false }, { created_by: undefined })
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it('with the switch on, shows no Danger zone for the creator once the event is published (is_visible 1)', async () => {
    await openManage({ role: 'lca_observer', id: 'm-pres', directed: ['t1'] }, { is_visible: 1 })
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })
})

describe('the view-only helpers, given no answer of their own', () => {
  const as = (role: string) => ({ user: { id: 'm-x' }, member: { id: 'm-x', role }, session: null, role, loading: false }) as unknown as AuthContextValue

  it.each([
    ['lca_observer', true],
    ['lca_officer', true],
    ['lca_admin', false],
    ['club_rep', false],
  ] as const)('read the role as before for %s', (role, viewOnly) => {
    render(
      <AuthContext.Provider value={as(role)}>
        <ViewOnlyNote>View only: a note of the page.</ViewOnlyNote>
        <ViewOnlyFieldset><button type="button">Save</button></ViewOnlyFieldset>
      </AuthContext.Provider>,
    )
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).matches(':disabled')).toBe(viewOnly)
    expect(screen.queryByText('View only: a note of the page.') !== null).toBe(viewOnly)
  })

  it('read the role when the prop is passed as undefined', () => {
    render(
      <AuthContext.Provider value={as('lca_observer')}>
        <ViewOnlyNote viewOnly={undefined}>View only: a note of the page.</ViewOnlyNote>
        <ViewOnlyFieldset viewOnly={undefined}><button type="button">Save</button></ViewOnlyFieldset>
      </AuthContext.Provider>,
    )
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).matches(':disabled')).toBe(true)
    expect(screen.getByText('View only: a note of the page.')).toBeTruthy()
  })
})
