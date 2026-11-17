// @vitest-environment jsdom
//
// A club's page in My region: the Listing tab's editor is never first drawn
// hidden (WS09 checkpoint U's review, E1). The editor's file is fetched only
// when Listing draws it, and the person may leave Listing before it has
// come. Its Help opens by itself the first time it is drawn, so an editor
// first drawn in the hidden wrapper would open Help unseen and spend the one
// opening. So until the editor has been drawn with Listing showing it is
// drawn only while Listing shows; from then it is kept, hidden while another
// tab shows.
//
// The editor here is a stand-in whose file the case lets load when it
// chooses; the page, its tabs and its calls are the real ones, with fetch
// stubbed. Every name, club and address here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const editor = vi.hoisted(() => {
  let arrive: () => void = () => {}
  const file = new Promise<void>((resolve) => { arrive = resolve })
  return { file, arrive: () => arrive(), drawn: 0 }
})

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))
vi.mock('@/areas/clubs/components/ClubEditor', async () => {
  await editor.file
  function ClubEditor() {
    useEffect(() => { editor.drawn += 1 }, [])
    return <label>One sentence about the club<textarea defaultValue="" /></label>
  }
  return { ClubEditor }
})

const { MyRegionClubPage } = await import('@/pages/MyRegionClubPage')

const ID = 'c-knights'
const CLUB_URL = `/api/admin/clubs/${ID}`
const CLUB = {
  id: ID, name: 'Example Knights Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: null, facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-02 15:00:00', told_by: 'm-five', last_confirmed_at: '2026-11-02 15:00:00', confirmed_by: 'm-five',
}
const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    if (call === `GET ${CLUB_URL}`) return json({ club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments: [], places: [] })
    if (call === `GET ${CLUB_URL}/news`) return json({ news: [] })
    return json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const AUTH = {
  user: { id: 'm-one' }, session: null, role: 'member',
  member: { id: 'm-one', role: 'member', club_id: null, full_name: 'Player One' },
  loading: false, memberLoading: false, seats: [REGIONAL],
  managedClubs: [{ id: ID, name: 'Example Knights Club', region: 'Bayou Region' }],
  isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
} as unknown as AuthContextValue

const header = () => screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement
const tab = (name: string) => within(header()).getByRole('button', { name })
const aboutBox = () => screen.queryByLabelText('One sentence about the club', { selector: 'textarea' }) as HTMLTextAreaElement | null
const LOADING = 'Loading the editor…'

it('is not drawn hidden when the person leaves Listing before the editor\'s file has come, and is kept once it has been drawn with Listing showing', async () => {
  render(
    <AuthContext.Provider value={AUTH}>
      <MemoryRouter initialEntries={[`/workspace/region/clubs/${ID}`]}>
        <Routes><Route path="/workspace/region/clubs/:id" element={<MyRegionClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Knights Club' }, { timeout: 5000 })
  await act(async () => {})
  // Listing is open and the editor's file is on its way.
  expect(tab('Listing').getAttribute('aria-current')).toBe('true')
  expect(screen.getByText(LOADING)).toBeTruthy()

  // The person goes to News before the file has come; then it comes.
  await act(async () => { fireEvent.click(tab('News')) })
  await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
  expect(screen.queryByText(LOADING)).toBeNull()
  await act(async () => { editor.arrive() })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)) })
  // Nothing of the editor is on the page, hidden or not, and it has not been drawn.
  expect(aboutBox()).toBeNull()
  expect(editor.drawn).toBe(0)

  // Back on Listing it is drawn for the first time, in the open.
  await act(async () => { fireEvent.click(tab('Listing')) })
  const about = await screen.findByRole('textbox', { name: 'One sentence about the club' }, { timeout: 5000 })
  await act(async () => {})
  expect(editor.drawn).toBe(1)
  expect(about.closest('[hidden]')).toBeNull()

  // From now it is kept across a change of tab: the same box, with what was typed, hidden while News shows.
  fireEvent.change(about, { target: { value: 'An example sentence.' } })
  await act(async () => { fireEvent.click(tab('News')) })
  expect(aboutBox()).toBe(about)
  expect((about.closest('[hidden]') as HTMLElement | null)?.hidden).toBe(true)
  expect(screen.queryByRole('textbox', { name: 'One sentence about the club' })).toBeNull()
  await act(async () => { fireEvent.click(tab('Listing')) })
  expect(aboutBox()).toBe(about)
  expect((about as HTMLTextAreaElement).value).toBe('An example sentence.')
  expect(about.closest('[hidden]')).toBeNull()
  expect(editor.drawn).toBe(1)
})
