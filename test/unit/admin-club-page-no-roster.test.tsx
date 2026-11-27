// @vitest-environment jsdom
//
// The admin club page's Roster and officers tab with the club pages on and
// off (WS09 step 37). With clubPagesOn() true (newClubs and newLook together)
// a player is no longer tied to a club: the tab is not drawn for anyone, in
// either of its two forms, its panel is not drawn, an address that names it
// opens the first tab as any unknown tab does, and the page asks nothing of
// the roster or the officers. With it false the page is today's: the
// expected markup in test/unit/fixtures/admin-club-page-base-markup.json was
// taken from the base the step was built on, from these same renders, in
// both of the tab's forms (the full form for an LCA admin and the club's own
// rep, and the kept-back form for a person a regional seat alone admits).
// Only newClubs and newLook are set here; every other switch is as the tree
// has it. Every club and name is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiAdminClubOfficer, ApiAdminMember, ApiClubDetail } from '@/lib/api'
import base from './fixtures/admin-club-page-base-markup.json'

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
const api = vi.hoisted(() => ({
  adminGetClub: vi.fn(),
  adminGetClubNews: vi.fn(),
  adminGetClubRoster: vi.fn(),
  adminAddClubOfficer: vi.fn(),
  adminRemoveClubOfficer: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { AdminClubPage } = await import('@/pages/AdminClubPage')

const CLUB_ID = 'example-chess-club'
const CLUB: ApiClubDetail = {
  id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: null, description: null, meeting_schedule: null,
  contact_email: 'club@example.org', created_at: '2026-01-03 18:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region',
}
const OFFICERS = [
  { id: 'officer-1', member_id: 'm-one', role: 'President', full_name: 'Player One' },
  { id: 'officer-2', member_id: 'm-two', role: 'Treasurer', full_name: 'Player Two' },
] as unknown as ApiAdminClubOfficer[]
const OFFICERS_WITH_EMAIL = OFFICERS.map((o, i) => ({ ...o, email: `player.${i + 1}@example.org` })) as unknown as ApiAdminClubOfficer[]
const ROSTER: ApiAdminMember[] = [
  { id: 'm-one', full_name: 'Player One', email: 'player.1@example.org', uscf_id: null, membership_status: 'active', membership_expiry: null, uscf_rating: 1500 },
  { id: 'm-two', full_name: 'Player Two', email: 'player.2@example.org', uscf_id: '90000002', membership_status: 'active', membership_expiry: null, uscf_rating: null },
]

/** The three people the tab is drawn for, each with the answer the server gives them with CLUB_PAGES_ON unset. */
const PEOPLE = {
  lca_admin: { role: 'lca_admin', clubId: null, answer: { officers: OFFICERS_WITH_EMAIL, roster: ROSTER } },
  club_rep: { role: 'club_rep', clubId: CLUB_ID, answer: { officers: OFFICERS_WITH_EMAIL, roster: ROSTER } },
  region_alone: { role: 'member', clubId: null, answer: { officers: OFFICERS, roster: [], rosterKeptBack: true } },
} as const
type Person = keyof typeof PEOPLE

function authFor(role: string, clubId: string | null): AuthContextValue {
  const member = { id: 'm-viewer', email: 'viewer@example.org', full_name: 'Player Three', role, club_id: clubId }
  return {
    user: { id: member.id, email: member.email }, member, session: null, role, loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

/** Opens the page at the address given, with the answer given, and waits for its heading. */
async function openPage(person: Person, search: string, answer: Record<string, unknown>): Promise<string> {
  const { role, clubId } = PEOPLE[person]
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], ...answer })
  const view = render(
    <AuthContext.Provider value={authFor(role, clubId)}>
      <MemoryRouter initialEntries={[`/admin/clubs/${CLUB_ID}${search}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
  return view.container.innerHTML
}

/** The answer the server gives with CLUB_PAGES_ON set: neither list, and rosterKeptBack still said to a person the region alone admits. */
function answerWithPagesOn(person: Person): Record<string, unknown> {
  return person === 'region_alone' ? { rosterKeptBack: true } : {}
}

const fetched = vi.fn()

beforeEach(() => {
  flags.newClubs = false
  flags.newLook = false
  for (const fn of Object.values(api)) fn.mockReset()
  api.adminGetClubNews.mockResolvedValue([])
  fetched.mockReset()
  vi.stubGlobal('fetch', (...args: unknown[]) => {
    fetched(String(args[0]))
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('with the club pages off, the Roster and officers tab against its markup on the base', () => {
  for (const person of Object.keys(PEOPLE) as Person[]) {
    it(`draws the page at the tab as it did, for ${person.replace('_', ' ')}`, async () => {
      expect(await openPage(person, '?tab=roster', PEOPLE[person].answer)).toBe(base[person])
    })
  }

  it('still draws the tab and both of its forms, newClubs on alone or newLook on alone', async () => {
    for (const [newClubs, newLook] of [[true, false], [false, true]] as const) {
      flags.newClubs = newClubs
      flags.newLook = newLook
      await openPage('lca_admin', '?tab=roster', PEOPLE.lca_admin.answer)
      expect(screen.getByRole('button', { name: 'Roster & officers (2)' }), `${newClubs} ${newLook}`).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Add officer' })).toBeTruthy()
      cleanup()
      await openPage('region_alone', '?tab=roster', PEOPLE.region_alone.answer)
      expect(screen.getByRole('button', { name: 'Roster & officers' })).toBeTruthy()
      expect(screen.getByText('Club roster', { selector: 'h2' })).toBeTruthy()
      cleanup()
    }
  })
})

describe('with the club pages on, the page has no roster and no officers', () => {
  beforeEach(() => {
    flags.newClubs = true
    flags.newLook = true
  })

  for (const person of Object.keys(PEOPLE) as Person[]) {
    it(`draws no tab and no panel, and an address naming the tab opens the first, for ${person.replace('_', ' ')}`, async () => {
      for (const search of ['', '?tab=roster']) {
        await openPage(person, search, answerWithPagesOn(person))
        expect(screen.queryByRole('button', { name: /Roster & officers/ }), search).toBeNull()
        expect(screen.getByRole('button', { name: 'Club details' }).className, search).toContain('border-lca-gold')
        expect(screen.getByRole('button', { name: 'News' }).className, search).not.toContain('border-lca-gold')
        for (const heading of [/^Club roster/, 'Officers']) expect(screen.queryByRole('heading', { level: 2, name: heading }), search).toBeNull()
        expect(screen.queryByRole('button', { name: 'Add officer' }), search).toBeNull()
        expect(screen.queryByRole('button', { name: 'Remove' }), search).toBeNull()
        expect(document.querySelector('#officer-titles'), search).toBeNull()
        cleanup()
      }
    })
  }

  it('asks nothing of the roster or the officers, in either of the tab\'s forms', async () => {
    for (const person of Object.keys(PEOPLE) as Person[]) {
      await openPage(person, '?tab=roster', answerWithPagesOn(person))
      cleanup()
    }
    expect(api.adminGetClubRoster).not.toHaveBeenCalled()
    expect(api.adminAddClubOfficer).not.toHaveBeenCalled()
    expect(api.adminRemoveClubOfficer).not.toHaveBeenCalled()
    expect(fetched.mock.calls.map(([url]) => url).filter((url) => /\/(roster|officers)\b/.test(url))).toEqual([])
    // The club itself is still asked for, once for each opening.
    expect(api.adminGetClub).toHaveBeenCalledTimes(3)
  })

  it('keeps the other tabs as they are: News for everyone, Tournaments for an LCA admin and the club\'s own rep', async () => {
    for (const person of Object.keys(PEOPLE) as Person[]) {
      await openPage(person, '', answerWithPagesOn(person))
      const names = screen.getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => ['Club details', 'News', 'Tournaments'].includes(t))
      expect(names, person).toEqual(person === 'region_alone' ? ['Club details', 'News'] : ['Club details', 'News', 'Tournaments'])
      cleanup()
    }
  })
})
