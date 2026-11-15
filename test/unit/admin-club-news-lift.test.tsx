// @vitest-environment jsdom
//
// The admin club page's News tab after its form and list moved into
// src/areas/clubs/components/ClubNewsPanel.tsx (WS09 step 12). The tab must
// draw exactly what it drew before the move, for an LCA admin, a club's own
// rep, a person a regional seat alone admits and an observer, with news and
// with none: test/unit/fixtures/admin-club-news-before.json holds the tab's
// markup as the page drew it at 173319c, before the move, read through this
// same harness, and each draw here must match it byte for byte. Posting and
// deleting call the same endpoints with the same bodies as before. Every
// name and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiClubDetail, ApiClubNews } from '@/lib/api'

const api = vi.hoisted(() => ({ adminGetClub: vi.fn(), adminGetClubNews: vi.fn(), adminCreateClubNews: vi.fn(), adminDeleteClubNews: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))
const { AdminClubPage } = await import('@/pages/AdminClubPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const BEFORE = JSON.parse(read('test/unit/fixtures/admin-club-news-before.json')) as Record<string, string>

const CLUB_ID = 'example-chess-club'
const CLUB: ApiClubDetail = {
  id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: null, description: null, meeting_schedule: null,
  contact_email: 'club@example.org', created_at: '2026-01-03 18:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region',
}
const NEWS = [
  { id: 'news-1', club_id: CLUB_ID, title: 'Example spring open', news_date: '2026-11-07', excerpt: 'Player One won the example open.', created_at: '2026-11-08 18:00:00' },
  { id: 'news-2', club_id: CLUB_ID, title: 'Example new boards', news_date: '2026-10-24', excerpt: 'The club has new example boards.', created_at: '2026-10-25 18:00:00' },
] as unknown as ApiClubNews[]

/** Each kind of person, the club the account names and what the club's answer adds for them. */
const PEOPLE = [
  ['lca_admin', null, {}],
  ['club_rep', CLUB_ID, {}],
  ['member', null, { roster: [], rosterKeptBack: true }],
  ['lca_observer', null, {}],
] as const

beforeEach(() => {
  for (const call of Object.values(api)) call.mockReset()
  api.adminGetClubNews.mockResolvedValue(NEWS)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function openNews(role: string, clubId: string | null, extra: Record<string, unknown> = {}) {
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], officers: [], roster: [], ...extra })
  const member = { id: 'm-viewer', email: 'viewer@example.org', full_name: 'Player Three', role, club_id: clubId }
  const auth = {
    user: { id: member.id, email: member.email }, member, session: null, role, loading: false, memberLoading: false,
    seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false, directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/clubs/${CLUB_ID}?tab=news`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
  await act(async () => {})
}
/** The page's body, below its navy band: the error line, the observer's note and the open tab. */
const body = () => document.querySelectorAll('section')[1].outerHTML

describe('the admin club page\'s News tab after the move', () => {
  it('draws the markup it drew before the move, for each kind of person, with news and with none', async () => {
    expect(Object.keys(BEFORE)).toHaveLength(8)
    for (const withNews of [true, false]) {
      for (const [role, clubId, extra] of PEOPLE) {
        api.adminGetClubNews.mockResolvedValue(withNews ? NEWS : [])
        await openNews(role, clubId, extra)
        const key = `${role}${withNews ? '' : ' with no news'}`
        expect(body(), key).toBe(BEFORE[key])
        cleanup()
      }
    }
  })

  it('posts and deletes through the same calls as before, and lists the news the server answers after a post', async () => {
    await openNews('lca_admin', null)
    api.adminCreateClubNews.mockResolvedValue(NEWS[0])
    api.adminGetClubNews.mockResolvedValue([NEWS[1]])
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example club night' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-21' } })
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'An example evening.' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post news' })) })
    expect(api.adminCreateClubNews).toHaveBeenCalledWith(CLUB_ID, { title: 'Example club night', newsDate: '2026-11-21', excerpt: 'An example evening.' })
    expect(screen.getByRole('heading', { level: 2, name: 'Posted news · 1' })).toBeTruthy()
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
    // Delete asks the browser's own question first, as before, and a No sends nothing.
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    api.adminDeleteClubNews.mockResolvedValue(undefined)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(api.adminDeleteClubNews).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete' })) })
    expect(ask).toHaveBeenLastCalledWith('Delete "Example new boards"? This cannot be undone.')
    expect(api.adminDeleteClubNews).toHaveBeenCalledWith(CLUB_ID, 'news-2')
    expect(screen.getByRole('heading', { level: 2, name: 'Posted news · 0' })).toBeTruthy()
  })

  it('says a failed post in the page\'s one error line, as before', async () => {
    await openNews('club_rep', CLUB_ID)
    api.adminCreateClubNews.mockRejectedValue(new Error('Title is required'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-21' } })
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'An example.' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post news' })) })
    expect(screen.getByText('Title is required')).toBeTruthy()
  })

  it('draws the tab through the one component, inside the observer\'s fieldset as before', () => {
    const page = read('src/pages/AdminClubPage.tsx')
    expect(page).toContain('import { ClubNewsPanel } from \'@/areas/clubs/components/ClubNewsPanel\'')
    expect(page).toMatch(/\{tab === 'news' && \(\n {10}<ViewOnlyFieldset>\n(?: {12}[^<\n][^\n]*\n| {14}[^\n]*\n)*? {12}<ClubNewsPanel\n/)
    expect(page).not.toContain('Post club news')
    expect(page).not.toContain('myRegion')
    expect(read('src/areas/clubs/components/ClubNewsPanel.tsx')).toContain('Post club news')
  })
})
