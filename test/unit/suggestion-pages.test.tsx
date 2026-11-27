// @vitest-environment jsdom
//
// Where a keeper meets a visitor's suggestion beside the two pages of My
// region (WS09's twenty-eighth step): Your club's page, where the club's rep's email
// leads, and the admin club page; and the page the monthly check's emailed
// link opens, which says in words that a suggestion waits. Each page draws
// the club's banner, "Fix the listing", "Reply to visitor" only when an
// address was left, and "Not an issue", from the open suggestions the
// club's answer gives, and draws nothing of it when none is open, so the
// page is as it was. "Fix the listing" takes the keeper to the club's
// editor. A press of the emailed link's Still accurate while one waits is
// said in the server's words, with "Log in to My region" and no thanks. The
// editor and the map are stood in for; the server is played by a stub of
// fetch or of the client's own call. Every club, person and word is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { OpenSuggestion } from '@domain/contracts'
import { LINK_WAITS, RESOLVED_WORDS } from '@domain/clubs/suggestion'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: true, regionEvents: false }))
const api = vi.hoisted(() => ({ adminGetClub: vi.fn(), adminGetClubNews: vi.fn() }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/ClubEditor', async () => {
  const { createElement } = await import('react')
  return { ClubEditor: () => createElement('p', null, 'The club editor') }
})
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { YourClubPage } = await import('@/pages/YourClubPage')
const { AdminClubPage } = await import('@/pages/AdminClubPage')
const { ClubConfirmPage } = await import('@/pages/ClubConfirmPage')

const ID = 'example-chess-club'
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: null, description: null, meeting_schedule: null, contact_email: 'club@example.org',
  created_at: '2026-01-03 18:00:00', color: '#1f4e79', image_url: null, region: 'Lake Charles / Southwestern', slug: 'example-chess',
  told_updated_at: '2026-11-15 01:00:00', told_by: 'm-rep', last_confirmed_at: '2026-11-15 01:00:00', confirmed_by: 'm-rep',
}
const suggestionOf = (id: number, over: Partial<OpenSuggestion> = {}): OpenSuggestion => ({
  kind: 'suggestion', id, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 3, ...over,
})

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}
beforeEach(() => {
  flags.clubKeepers = true
  asked = []
  answers = {}
  api.adminGetClub.mockReset()
  api.adminGetClubNews.mockReset()
  api.adminGetClubNews.mockResolvedValue([])
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined })
    return answers[call]?.() ?? json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function authFor(role: string, id = 'm-rep'): AuthContextValue {
  return {
    user: { id }, session: null, role,
    member: { id, role, club_id: role === 'club_rep' ? ID : null, full_name: 'Player Two', email: 'player.two@example.org' },
    loading: false, memberLoading: false, seats: [], managedClubs: [], isBoardMember: false, assuranceLevel: 'aal2', mfaRequired: false,
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

async function yourClub(openSuggestions?: OpenSuggestion[]) {
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], officers: [], roster: [], places: [], ...(openSuggestions ? { openSuggestions } : {}) })
  render(
    <AuthContext.Provider value={authFor('club_rep')}>
      <MemoryRouter initialEntries={[`/my/club/${CLUB.slug}`]}>
        <Routes><Route path="/my/club/:slug" element={<YourClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByText('The club editor', undefined, { timeout: 5000 })
}

async function adminClub(role: string, openSuggestions?: OpenSuggestion[]) {
  api.adminGetClub.mockResolvedValue({ club: CLUB, tournaments: [], officers: [], roster: [], places: [], ...(openSuggestions ? { openSuggestions } : {}) })
  render(
    <AuthContext.Provider value={authFor(role)}>
      <MemoryRouter initialEntries={[`/admin/clubs/${ID}?tab=roster`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
}

const banner = () => screen.getByRole('region', { name: 'Suggestions from visitors' })

describe('Your club\'s page', () => {
  it('draws the club\'s banner above the editor while a suggestion is open, with Reply only for an address left', async () => {
    await yourClub([suggestionOf(4), suggestionOf(5, { hasAddress: false, field: 'cost' })])
    const rows = within(banner()).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Reply to visitor', 'Fix the listing', 'Not an issue'])
    expect(within(rows[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Fix the listing', 'Not an issue'])
    expect(within(rows[0]).getByText('The club meets at the Example Library now.')).toBeTruthy()
    expect(within(rows[0]).getByText('Suggested 3 days ago')).toBeTruthy()
    expect(within(rows[1]).getByText('No email address was left, so there is no one to reply to.')).toBeTruthy()
    // Above the editor, in the page's order.
    expect(banner().compareDocumentPosition(screen.getByText('The club editor')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws no banner, no heading for it and none of its words with none open, or with the key missing', async () => {
    await yourClub([])
    expect(screen.queryByRole('region', { name: 'Suggestions from visitors' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/Fix the listing|Reply to visitor|Not an issue|suggestion/i)
    cleanup()
    await yourClub()
    expect(screen.queryByRole('region', { name: 'Suggestions from visitors' })).toBeNull()
  })

  it('Not an issue takes the row away and says what was done, in words', async () => {
    answers[`POST /api/admin/clubs/${ID}/reports/4`] = () => json({ id: 4, status: 'dismissed' })
    await yourClub([suggestionOf(4)])
    await act(async () => { fireEvent.click(within(banner()).getByRole('button', { name: /^Not an issue/ })) })
    await waitFor(() => expect(within(banner()).queryAllByRole('listitem')).toHaveLength(0))
    expect(within(banner()).getAllByRole('status')[0].textContent).toBe(RESOLVED_WORDS.dismissed)
    expect(asked.find((a) => a.call.includes('/reports/4'))?.body).toBe(JSON.stringify({ action: 'dismiss' }))
  })
})

describe('the admin club page', () => {
  it('shows the same rows to a keeper of the club, and Fix the listing takes the keeper from the roster to the editor', async () => {
    answers[`POST /api/admin/clubs/${ID}/reports/7`] = () => json({ id: 7, status: 'applied' })
    await adminClub('lca_admin', [suggestionOf(7, { field: 'meets' })])
    const row = within(banner()).getByRole('listitem')
    expect(within(row).getByRole('heading', { level: 3, name: 'Meeting day or time' })).toBeTruthy()
    expect(screen.queryByText('The club editor')).toBeNull()
    await act(async () => { fireEvent.click(within(row).getByRole('button', { name: /^Fix the listing/ })) })
    expect(await screen.findByText('The club editor', undefined, { timeout: 5000 })).toBeTruthy()
    expect(within(banner()).getAllByRole('status')[0].textContent).toBe(RESOLVED_WORDS.applied)
  })

  it('draws no banner with none open', async () => {
    await adminClub('lca_admin')
    expect(screen.queryByRole('region', { name: 'Suggestions from visitors' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/Fix the listing|Reply to visitor|Not an issue/)
  })

  it('says a row another keeper handled first in the server\'s words, and takes it away', async () => {
    answers[`POST /api/admin/clubs/${ID}/reports/7`] = () => json({ error: 'This suggestion was already handled, so nothing changed.' }, 409)
    await adminClub('lca_admin', [suggestionOf(7)])
    await act(async () => { fireEvent.click(within(banner()).getByRole('button', { name: /^Not an issue/ })) })
    await waitFor(() => expect(within(banner()).queryAllByRole('listitem')).toHaveLength(0))
    expect(within(banner()).getAllByRole('status')[0].textContent).toContain('already handled')
  })
})

describe('the emailed Still accurate link while a suggestion waits', () => {
  const TOKEN = 'v1.s.example-made-up-payload.example-made-up-mac'
  const LINK = `/api/clubs/confirm/${TOKEN}`

  it('says in the server\'s words that a suggestion waits, offers Log in to My region, and gives no thanks', async () => {
    answers[`GET ${LINK}`] = () => json({ name: 'Example Chess Club', city: 'Example City', statement: 'Saturdays from 10:00 AM to 1:00 PM at the Example Library.' })
    answers[`POST ${LINK}`] = () => json({ error: LINK_WAITS }, 409)
    render(
      <AuthContext.Provider value={{ ...authFor('member'), user: null, member: null } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[`/clubs/confirm/${TOKEN}`]}>
          <Routes><Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const press = await screen.findByRole('button', { name: 'Still accurate' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(press) })
    await waitFor(() => expect(document.body.textContent).toContain(LINK_WAITS))
    const login = screen.getByRole('link', { name: 'Log in to My region' })
    expect(login.getAttribute('href')).toBe('/login')
    expect(document.body.textContent).not.toMatch(/Thanks\./)
    expect(document.body.textContent).not.toContain(TOKEN)
  })
})
