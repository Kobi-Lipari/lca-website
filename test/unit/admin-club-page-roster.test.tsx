// @vitest-environment jsdom
//
// The admin club page's Roster and officers tab for each kind of person who
// reaches it (K's answer 2 (a) to checkpoint S's choices). An LCA admin and
// the club's own rep see the tab as before: its count, the officers with
// their emails and a Remove button each, the form to add one, and the
// roster with its count, or the words for a club with no members. A person
// a regional seat alone admits, for whom GET /api/admin/clubs/[id] answers
// rosterKeptBack with an empty roster and the officers without their
// emails, reads in words that the roster is kept for LCA admins and the
// club's own rep, and sees the officers by name and role alone: no count,
// no words that say the club has no members, no Remove button, no form and
// no email line. On a club with no visible event, that person's Tournaments
// tab says drafts stay with LCA admins and the club's own rep, where the
// others still read that drafts show up there.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiAdminClubOfficer, ApiAdminMember, ApiClubDetail } from '@/lib/api'

const api = vi.hoisted(() => ({
  adminGetClub: vi.fn(),
  adminGetClubNews: vi.fn(),
  adminAddClubOfficer: vi.fn(),
  adminRemoveClubOfficer: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map picker needs Google's script; the roster tab is what is read here.
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { AdminClubPage } = await import('@/pages/AdminClubPage')

const CLUB_ID = 'example-chess-club'
const CLUB: ApiClubDetail = {
  id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: null, description: null, meeting_schedule: null,
  contact_email: 'club@example.org', created_at: '2026-01-03 18:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region',
}
const ROSTER: ApiAdminMember[] = [
  { id: 'm-one', full_name: 'Player One', email: 'player.one@example.org', uscf_id: null, membership_status: 'active', membership_expiry: null, uscf_rating: 1500 },
  { id: 'm-two', full_name: 'Player Two', email: 'player.two@example.org', uscf_id: null, membership_status: 'expired', membership_expiry: null, uscf_rating: null },
]
const OFFICERS: ApiAdminClubOfficer[] = [
  { id: 'officer-1', member_id: 'm-one', role: 'President', full_name: 'Player One', email: 'player.one@example.org' },
]
/** The officers as the server answers a person admitted by the region alone: every key but the email. */
const OFFICERS_NO_EMAIL = OFFICERS.map(({ id, member_id, role, full_name }) => ({ id, member_id, role, full_name })) as unknown as ApiAdminClubOfficer[]

/** The four sentences today's page draws for an empty roster. */
const EMPTY_ROSTER_WORDS = [
  'Roster & officers (0)', 'Club roster · 0 members', 'No members assigned to this club yet.', 'Officers are chosen from the roster, which is empty right now.',
]
const KEPT_BACK = 'A club\'s roster is kept for LCA admins and the club\'s own rep.'

interface Who { role: string; clubId?: string | null }
const ADMIN: Who = { role: 'lca_admin' }
const OWN_REP: Who = { role: 'club_rep', clubId: CLUB_ID }
const SEAT_HOLDER: Who = { role: 'member', clubId: null }
const OTHER_CLUBS_REP: Who = { role: 'club_rep', clubId: 'another-example-club' }

function authFor(who: Who): AuthContextValue {
  const member = { id: 'm-viewer', email: 'viewer@example.org', full_name: 'Player Three', role: who.role, club_id: who.clubId ?? null }
  return {
    user: { id: member.id, email: member.email }, member, session: null, role: who.role, loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

async function openRoster(who: Who, answer: Record<string, unknown>, tab = 'roster') {
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], ...answer })
  render(
    <AuthContext.Provider value={authFor(who)}>
      <MemoryRouter initialEntries={[`/admin/clubs/${CLUB_ID}?tab=${tab}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
  return document.querySelector('section.mx-auto') as HTMLElement
}

beforeEach(() => {
  api.adminGetClub.mockReset()
  api.adminGetClubNews.mockReset()
  api.adminGetClubNews.mockResolvedValue([])
})
afterEach(() => {
  cleanup()
})

/** Today's tab, with the roster's line under it that differs between an LCA admin and the club's own rep. */
async function seesToday(who: Who, rosterLine: string) {
  const body = await openRoster(who, { officers: OFFICERS, roster: ROSTER })
  expect(screen.getByRole('button', { name: 'Roster & officers (2)' })).toBeTruthy()
  expect(within(body).getByRole('heading', { level: 2, name: 'Officers · 1' })).toBeTruthy()
  expect(body.textContent).toContain('Listed on your public club page with their name and email, so visitors know who to contact.')
  expect(within(body).getAllByText('player.one@example.org').length).toBe(2)
  expect(within(body).getByRole('button', { name: 'Remove' })).toBeTruthy()
  expect(within(body).getByRole('button', { name: 'Add officer' })).toBeTruthy()
  expect(within(body).getByLabelText('Member')).toBeTruthy()
  expect(within(body).getByLabelText('Title')).toBeTruthy()
  expect(within(body).getByRole('heading', { level: 2, name: 'Club roster · 2 members' })).toBeTruthy()
  expect(body.textContent).toContain(rosterLine)
  expect(body.textContent).toContain('player.two@example.org')
  expect(body.textContent).not.toContain(KEPT_BACK)
}

/** The tab for a person a regional seat alone admits. */
async function seesKeptBack(who: Who) {
  const body = await openRoster(who, { officers: OFFICERS_NO_EMAIL, roster: [], rosterKeptBack: true })
  expect(screen.getByRole('button', { name: 'Roster & officers' })).toBeTruthy()
  const page = document.body.textContent ?? ''
  for (const words of EMPTY_ROSTER_WORDS) expect(page, words).not.toContain(words)
  expect(page).not.toMatch(/Roster & officers \(\d+\)/)
  expect(body.textContent).toContain(KEPT_BACK)
  expect(body.textContent).toContain('To add or remove an officer, ask an LCA admin or the club\'s own rep.')

  const officers = within(body).getByRole('heading', { level: 2, name: 'Officers' })
  const roster = within(body).getByRole('heading', { level: 2, name: 'Club roster' })
  // The roster's words come first, then the officers.
  expect(roster.compareDocumentPosition(officers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  const items = within(body).getAllByRole('listitem')
  expect(items.map((li) => li.textContent)).toEqual(['Player One · President'])
  // One line per officer: no empty line where an email would be.
  expect(items[0].querySelectorAll('p')).toHaveLength(1)

  expect(body.textContent).not.toMatch(/email|@/i)
  expect(within(body).queryByRole('button')).toBeNull()
  expect(body.querySelector('form, input, select, textarea')).toBeNull()
  expect(body.textContent).not.toContain('Listed on your public club page with their name and email')
  expect(body.textContent).toContain('Listed on the club\'s public page by name and role.')
}

describe('the Roster and officers tab for an LCA admin and the club\'s own rep, as before', () => {
  it('an LCA admin sees the count, the officers with their emails and Remove, the form and the roster', async () => {
    await seesToday(ADMIN, 'Members are added to a club from Members in the admin panel.')
  })

  it('the club\'s own rep sees the count, the officers with their emails and Remove, the form and the roster', async () => {
    await seesToday(OWN_REP, 'To add someone to your roster, ask an LCA admin to assign them to your club.')
  })

  it('an LCA admin and the club\'s own rep of a club with no members still read today\'s four sentences for an empty roster', async () => {
    for (const who of [ADMIN, OWN_REP]) {
      const body = await openRoster(who, { officers: [], roster: [] })
      const page = document.body.textContent ?? ''
      for (const words of EMPTY_ROSTER_WORDS) expect(page, `${who.role}: ${words}`).toContain(words)
      expect(body.textContent).not.toContain(KEPT_BACK)
      cleanup()
    }
  })
})

describe('the Roster and officers tab for a person a regional seat alone admits', () => {
  it('a member who holds the region\'s seat reads that the roster is kept back, and sees the officers by name and role alone', async () => {
    await seesKeptBack(SEAT_HOLDER)
  })

  it('another club\'s rep who holds the seat reads the same, and the Tournaments tab stays theirs', async () => {
    await seesKeptBack(OTHER_CLUBS_REP)
    expect(screen.getByRole('button', { name: 'Tournaments' })).toBeTruthy()
  })

  it('says in words that no officer is listed when the club has none', async () => {
    const body = await openRoster(SEAT_HOLDER, { officers: [], roster: [], rosterKeptBack: true })
    expect(body.textContent).toContain(KEPT_BACK)
    expect(body.textContent).toContain('No officers are listed for this club.')
    expect(within(body).queryByRole('list')).toBeNull()
  })

  it('the Tournaments tab of a club with no visible event says drafts stay with the club\'s keepers, and an LCA admin and the club\'s own rep read today\'s words', async () => {
    const TODAY = 'Tournaments you create for Example Chess Club will show up here, including drafts.'
    const KEPT = 'Published tournaments of Example Chess Club show up here. Drafts stay with LCA admins and the club\'s own rep.'
    const body = await openRoster(OTHER_CLUBS_REP, { officers: OFFICERS_NO_EMAIL, roster: [], rosterKeptBack: true }, 'tournaments')
    expect(within(body).getByText('No tournaments yet')).toBeTruthy()
    expect(body.textContent).toContain(KEPT)
    expect(body.textContent).not.toContain('including drafts')
    cleanup()
    for (const who of [ADMIN, OWN_REP]) {
      const today = await openRoster(who, { officers: OFFICERS, roster: ROSTER }, 'tournaments')
      expect(today.textContent, who.role).toContain(TODAY)
      expect(today.textContent, who.role).not.toContain(KEPT)
      cleanup()
    }
  })
})
