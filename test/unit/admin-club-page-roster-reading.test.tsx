// @vitest-environment jsdom
//
// How a person a regional seat alone admits reads the admin club page's
// Roster and officers tab (K's answer 2 (a) to checkpoint S's choices),
// beyond admin-club-page-roster.test.tsx: the tab is met by its button as
// well as by the address, its words come in the order a screen reader should
// hear them with real headings and a real list, nothing on it rests on colour
// or on a picture alone, and its words keep K's plain-language rules. An LCA
// admin and the club's own rep meet no kept-back words after opening the same
// tab from the button.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiAdminClubOfficer, ApiAdminMember, ApiClubDetail } from '@/lib/api'

const api = vi.hoisted(() => ({
  adminGetClub: vi.fn(),
  adminGetClubNews: vi.fn(),
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
]
const KEPT_BACK = 'A club\'s roster is kept for LCA admins and the club\'s own rep.'

function authFor(role: string, clubId: string | null): AuthContextValue {
  const member = { id: 'm-viewer', email: 'viewer@example.org', full_name: 'Player Three', role, club_id: clubId }
  return {
    user: { id: member.id, email: member.email }, member, session: null, role, loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
}

/** Opens the page at its first tab, as a link to /admin/clubs/[id] does. */
async function openPage(role: string, clubId: string | null, answer: Record<string, unknown>) {
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], ...answer })
  render(
    <AuthContext.Provider value={authFor(role, clubId)}>
      <MemoryRouter initialEntries={[`/admin/clubs/${CLUB_ID}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
}
const keptBackAnswer = { officers: OFFICERS, roster: [], rosterKeptBack: true }

beforeEach(() => {
  api.adminGetClub.mockReset()
  api.adminGetClubNews.mockReset()
  api.adminGetClubNews.mockResolvedValue([])
})
afterEach(() => {
  cleanup()
})

describe('the Roster and officers tab, opened from its button by a person a regional seat alone admits', () => {
  it('shows the kept-back words, and none of the roster, after the button is pressed', async () => {
    await openPage('member', null, keptBackAnswer)
    expect(document.body.textContent).not.toContain(KEPT_BACK)
    fireEvent.click(screen.getByRole('button', { name: 'Roster & officers' }))
    expect(screen.getByText(KEPT_BACK, { exact: false })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Roster & officers \(/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add officer' })).toBeNull()
  })

  it('draws the same two sections again after going to another tab and back', async () => {
    await openPage('member', null, keptBackAnswer)
    const roster = () => fireEvent.click(screen.getByRole('button', { name: 'Roster & officers' }))
    roster()
    fireEvent.click(screen.getByRole('button', { name: 'News' }))
    expect(document.body.textContent).not.toContain(KEPT_BACK)
    roster()
    expect(screen.getAllByText('Officers', { selector: 'h2' })).toHaveLength(1)
    expect(screen.getAllByText('Club roster', { selector: 'h2' })).toHaveLength(1)
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Player One · President', 'Player Two · Treasurer'])
  })
})

describe('what a screen reader meets on the kept-back tab', () => {
  async function tab() {
    await openPage('member', null, keptBackAnswer)
    fireEvent.click(screen.getByRole('button', { name: 'Roster & officers' }))
    return document.querySelector('section.mx-auto') as HTMLElement
  }

  it('reads heading, the words on the roster, heading, the words on officers, then the list, in that order', async () => {
    const body = await tab()
    const parts = Array.from(body.querySelectorAll('h2, p, li')).filter((el) => !el.closest('li') || el.tagName === 'LI').map((el) => `${el.tagName.toLowerCase()}:${el.textContent}`)
    expect(parts).toEqual([
      'h2:Club roster',
      `p:${KEPT_BACK} To add or remove an officer, ask an LCA admin or the club's own rep.`,
      'h2:Officers',
      'p:Listed on the club\'s public page by name and role.',
      'li:Player One · President',
      'li:Player Two · Treasurer',
    ])
  })

  it('has real headings one level under the page heading, and the officers in a real list', async () => {
    const body = await tab()
    expect(within(body).queryAllByRole('heading').map((h) => h.tagName)).toEqual(['H2', 'H2'])
    const list = within(body).getByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('draws every picture on the tab as decoration beside words, and no state in colour alone', async () => {
    const body = await tab()
    const pictures = Array.from(body.querySelectorAll('svg'))
    expect(pictures.length).toBeGreaterThan(0)
    for (const svg of pictures) {
      expect(svg.getAttribute('aria-hidden'), svg.outerHTML).toBe('true')
      expect(svg.querySelector('title')).toBeNull()
    }
    // The kept-back words carry the meaning: nothing is an alert, a status or a coloured badge.
    expect(body.querySelector('[role="alert"], [role="status"], [aria-live]')).toBeNull()
    const classes = Array.from(body.querySelectorAll('*')).map((el) => el.getAttribute('class') ?? '').join(' ')
    expect(classes).not.toMatch(/\b(text|bg|border)-(red|green|amber|yellow|destructive|lca-gold)\b/)
  })

  it('keeps K\'s plain-language rules: no dash, no old initials, no half as a decimal, no email', async () => {
    const body = await tab()
    const text = body.textContent ?? ''
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`))
    // US Chess's old initials, put together so that this file does not hold them.
    expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    expect(text).not.toMatch(/\.5\b/)
    expect(text).not.toMatch(/@|email/i)
  })
})

describe('an LCA admin and the club\'s own rep, opening the tab from its button', () => {
  it('meet the roster, the form and the Remove button, and none of the kept-back words', async () => {
    for (const [role, clubId] of [['lca_admin', null], ['club_rep', CLUB_ID]] as const) {
      await openPage(role, clubId, { officers: OFFICERS_WITH_EMAIL, roster: ROSTER })
      fireEvent.click(screen.getByRole('button', { name: 'Roster & officers (1)' }))
      const body = document.querySelector('section.mx-auto') as HTMLElement
      expect(body.textContent, role).not.toContain(KEPT_BACK)
      expect(within(body).getAllByRole('button', { name: 'Remove' }), role).toHaveLength(2)
      expect(within(body).getByRole('button', { name: 'Add officer' }), role).toBeTruthy()
      expect(within(body).getByRole('heading', { level: 2, name: 'Club roster · 1 members' }), role).toBeTruthy()
      cleanup()
    }
  })
})
