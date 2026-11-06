// @vitest-environment jsdom
//
// The new event in today's manage page for its creator (Q11), behind
// standingDirectors. With the switch on, an observer who directs the event,
// the president working through the director row the create wrote, finds
// the page's three tabs open to change and no View only note, while an
// observer who does not direct it stays view-only; and the creator of an
// unpublished draft with no entries sees the Danger zone in today's words,
// every entry counted as the server's delete counts them, so a draft whose
// only entry is waitlisted or withdrawn shows no zone. With the switch off
// the page is today's: the president view-only on every event, the Danger
// zone an LCA admin's alone. The real page runs through the real client,
// with fetch stubbed, so every request it makes is seen.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ standingDirectors: true }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-manage' } } }) } },
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
const VIEW_ONLY = /^View only: you can see everything about this event/
const ZONE_WORDS = 'Deleting this tournament permanently removes all registrations, pairings, results, and director assignments. This cannot be undone. Stripe payments are not refunded automatically.'

/** The tournament as the manage answer gives it to a manager: every column, created_by among them. */
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

/** One entry as the manage answer lists it: every registrations row, waitlisted and withdrawn ones too. */
function entry(over: Record<string, unknown> = {}) {
  return {
    registration_id: 'r1', member_id: 'm-player', section: 'Open', payment_status: 'paid', bye_rounds: [], withdrawn_at: null,
    checked_in_at: null, rating_at_entry: null, waitlisted_at: null, grade: null, uscf_expiration: null,
    full_name: 'Remy Guidry', uscf_id: null, uscf_rating: null, ...over,
  }
}

interface Seen {
  url: string
  method: string
  headers: Record<string, string>
}
let seen: Seen[] = []
let answers: Record<string, { status: number; body: unknown }> = {}

beforeEach(() => {
  flags.standingDirectors = true
  seen = []
  answers = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    seen.push({ url, method, headers: (init?.headers ?? {}) as Record<string, string> })
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
  /** The events the person directs, as the sign-in context read them. */
  directed?: string[]
}
const PRESIDENT: Person = { role: 'lca_observer', id: 'm-pres', directed: ['t1'] }
const OBSERVER: Person = { role: 'lca_observer', id: 'm-obs', directed: [] }
const STANDING: Person = { role: 'tournament_director', id: 'm-sd', directed: ['t1'] }
const ONE_EVENT: Person = { role: 'member', id: 'm-one', directed: ['t1'] }
const ADMIN: Person = { role: 'lca_admin', id: 'm-admin', directed: [] }

/** Opens the manage page on a tab for a person, the manage answer and GET /api/me answered, and waits until both are read. */
async function openManage(who: Person, tab: string, over: Record<string, unknown> = {}, roster: unknown[] = []) {
  answers[`GET ${MANAGE}`] = { status: 200, body: { tournament: tournament(over), roster, games: [], standings: [], prizes: [], directors: [] } }
  const member = { id: who.id, role: who.role, club_id: null, full_name: 'Avery Thibodeaux' }
  answers['GET /api/me'] = { status: 200, body: { member, registrations: [], directedTournaments: [] } }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false,
    directedTournamentIds: who.directed ?? [], directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/tournaments/t1?tab=${tab}`]}>
        <Routes>
          <Route path="/admin/tournaments/:id" element={<TournamentManagePage />} />
          <Route path="/admin/tournaments" element={<p>Tournaments list</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { name: /Lafayette Winter Quads/ })
  // The Danger zone also reads the role GET /api/me answers, so the cases wait until it is read.
  await waitFor(() => expect(requestsTo('GET', '/api/me')).toHaveLength(1))
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

/** The one control each tab's fieldset holds that the cases read. */
const CONTROL: Record<string, string> = {
  details: 'Tournament name',
  registration: 'Auto-close registration at',
  rounds: 'Number of rounds',
}
const isDisabled = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).matches(':disabled')

describe('the manage page for an observer who directs the event', () => {
  it('ships behind standingDirectors, which starts off', () => {
    expect(REAL_FEATURES.standingDirectors).toBe(false)
  })

  it.each(Object.keys(CONTROL))('with the switch on, opens the %s tab to change, with no View only note, for the president who directs the event', async (tab) => {
    await openManage(PRESIDENT, tab)
    expect(isDisabled(CONTROL[tab])).toBe(false)
    expect(screen.queryByText(VIEW_ONLY)).toBeNull()
  })

  it.each(Object.keys(CONTROL))('with the switch off, keeps the %s tab view-only with today\'s note, though the president directs the event', async (tab) => {
    flags.standingDirectors = false
    await openManage(PRESIDENT, tab)
    expect(isDisabled(CONTROL[tab])).toBe(true)
    expect(screen.getByText(VIEW_ONLY)).toBeTruthy()
  })

  it('with the switch on, keeps an observer view-only on an event they do not direct', async () => {
    await openManage(OBSERVER, 'details', { created_by: 'm-admin', is_visible: 1 })
    expect(isDisabled('Tournament name')).toBe(true)
    expect(screen.getByText(VIEW_ONLY)).toBeTruthy()
  })

  it('with the switch on, lets the president save the Details tab of the event they direct', async () => {
    answers[`PATCH ${EVENT}`] = { status: 200, body: { tournament: tournament({ name: 'Lafayette Spring Quads' }) } }
    await openManage(PRESIDENT, 'details')
    fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: 'Lafayette Spring Quads' } })
    const save = screen.getByRole('button', { name: 'Save details' }) as HTMLButtonElement
    expect(save.matches(':disabled')).toBe(false)
    fireEvent.click(save)
    await waitFor(() => expect(requestsTo('PATCH', EVENT)).toHaveLength(1))
    expect(requestsTo('PATCH', EVENT)[0].headers.Authorization).toBe('Bearer tok-manage')
  })
})

describe('the Danger zone for the creator of a draft', () => {
  it('with the switch on, shows the creator of a hidden draft with no entries the Danger zone in today\'s words', async () => {
    await openManage(PRESIDENT, 'details')
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy()
    expect(screen.getByText(ZONE_WORDS)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Delete tournament/ })).toBeTruthy()
  })

  it('with the switch on, shows it to a standing director who created the draft, and to no one for a published event', async () => {
    await openManage(STANDING, 'details', { created_by: 'm-sd' })
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy()
    cleanup()
    seen = []
    await openManage(STANDING, 'details', { created_by: 'm-sd', is_visible: 1 })
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it('with the switch off, shows the creator no Danger zone', async () => {
    flags.standingDirectors = false
    await openManage(PRESIDENT, 'details')
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it.each([
    ['waitlisted', { waitlisted_at: '2026-11-05 19:00:00' }],
    ['withdrawn', { withdrawn_at: '2026-11-05 19:00:00' }],
    ['removed from the waitlist', { waitlisted_at: '2026-11-05 19:00:00', withdrawn_at: '2026-11-05 19:30:00' }],
    ['entered', {}],
  ])('with the switch on, shows no Danger zone on a draft whose only entry is %s, as the server counts every entry', async (_label, over) => {
    await openManage(PRESIDENT, 'details', {}, [entry(over)])
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it.each([true, false])('with the switch %s, never shows it to a one-event director who did not create the event', async (on) => {
    flags.standingDirectors = on
    await openManage(ONE_EVENT, 'details', { created_by: 'm-pres' })
    expect(isDisabled('Tournament name')).toBe(false)
    expect(screen.queryByRole('heading', { name: 'Danger zone' })).toBeNull()
  })

  it.each([true, false])('with the switch %s, shows an LCA admin the Danger zone as today, on any event', async (on) => {
    flags.standingDirectors = on
    await openManage(ADMIN, 'details', { created_by: 'm-pres', is_visible: 1 }, [entry()])
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeTruthy()
  })

  it('with the switch on, sends the creator\'s delete with their sign-in once the name is typed and confirmed', async () => {
    answers[`DELETE ${EVENT}`] = { status: 200, body: { success: true } }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await openManage(PRESIDENT, 'details')
    const remove = screen.getByRole('button', { name: /Delete tournament/ }) as HTMLButtonElement
    expect(remove.matches(':disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText(/to confirm/), { target: { value: 'Lafayette Winter Quads' } })
    expect(remove.matches(':disabled')).toBe(false)
    fireEvent.click(remove)
    await screen.findByText('Tournaments list')
    expect(requestsTo('DELETE', EVENT)).toHaveLength(1)
    expect(requestsTo('DELETE', EVENT)[0].headers.Authorization).toBe('Bearer tok-manage')
  })
})

describe('the view-only helpers, given an answer of their own', () => {
  /** A sign-in context with the role alone, which is all the helpers' own hook reads. */
  const as = (role: string) => ({ user: { id: 'm-x' }, member: { id: 'm-x', role }, session: null, role, loading: false }) as unknown as AuthContextValue

  it.each([
    ['an observer, told it may change', 'lca_observer', false],
    ['an LCA admin, told it may not', 'lca_admin', true],
  ] as const)('take the answer passed over the role\'s for %s', async (_label, role, viewOnly) => {
    const { ViewOnlyFieldset, ViewOnlyNote } = await import('@/lib/viewOnly')
    render(
      <AuthContext.Provider value={as(role)}>
        <ViewOnlyNote viewOnly={viewOnly}>View only: a note of the page.</ViewOnlyNote>
        <ViewOnlyFieldset viewOnly={viewOnly}><button type="button">Save</button></ViewOnlyFieldset>
      </AuthContext.Provider>,
    )
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).matches(':disabled')).toBe(viewOnly)
    expect(screen.queryByText('View only: a note of the page.') !== null).toBe(viewOnly)
  })
})
