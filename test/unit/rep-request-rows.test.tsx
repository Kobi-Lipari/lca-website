// @vitest-environment jsdom
//
// The keeper's rows of Ask to be its named rep (WS09's thirty-first step,
// src/areas/clubs/components/RepRequestRows.tsx), in My region and on a club
// in My region:
// - with no request, My region draws the base's markup to the byte for an
//   LCA admin, a region's representative and a club's rep who holds a seat
//   (test/unit/fixtures/my-region-base-markup.json, step 30's), and a club in
//   My region draws the base's markup to the byte for an LCA admin and a
//   region's representative. The strings in
//   test/unit/fixtures/my-region-club-base-markup.json were taken from the
//   render of src/pages/MyRegionClubPage.tsx as it stood at 380ff75, before
//   this step, with its Events tab open and the generated ids of the help
//   marks written as _r_N_;
// - with requests, each row's heading says "Rep request · {Club} · {name} ·
//   {connection} · {weekday, date}", with the note, Email {first name},
//   Name as rep and Decline; where the keeper cannot name the member the
//   reason stands in words in place of Name as rep;
// - each button asks one question in words first; Cancel leaves the row and
//   puts the focus back; Yes decides it, the row leaves, the status says so
//   in words and the focus goes to the next row, or to the list's heading;
//   a refusal that is not "decided already" leaves the row with the
//   server's words.
// Every club, person and address is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { RegionClub, RepRequestRow, WorkspaceRegionResponse } from '@domain/contracts'
import { REP_DECIDE_FOR_KEEPERS, REP_ROLE_CHANGED, adminsDecideRow, adminsDecideWords, declineQuestion, declinedWords, namedWords } from '@domain/clubs/repRequest'
import base from './fixtures/my-region-base-markup.json'
import clubBase from './fixtures/my-region-club-base-markup.json'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { MyRegionClubPage } = await import('@/pages/MyRegionClubPage')
const normal = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_r_N_')

// The answer step 30's markup was taken from.
const clubs: RegionClub[] = [
  {
    id: 'c-knights', name: 'Example Knights Club', city: 'Example City', region: 'Lake Charles / Southwestern', color: null, logoUrl: null,
    statement: 'Tuesdays at 7:00 PM', lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 0,
    openItems: [{ kind: 'suggestion', id: 4, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 3 }],
  },
  {
    id: 'c-rooks', name: 'Example Rooks Club', city: 'Example Town', region: 'Lake Charles / Southwestern', color: null, logoUrl: null,
    statement: null, lastConfirmedAt: '2026-11-02 14:00:00', lastCheckWords: 'Checked Nov 2026', needsCheck: false, events: 2, openItems: [],
  },
]
const baseAnswer: WorkspaceRegionResponse = {
  clubs,
  thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 1, notChecked: 1 },
  regions: [{ region: 'Lake Charles / Southwestern', keepers: [{ name: 'Player Two', seat: 'Lake Charles / Southwestern Representative' }] }],
}

// The club's answer the second fixture was taken from.
const CLUB = {
  id: 'c-knights', name: 'Example Knights Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Lake Charles / Southwestern', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player Five', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-02 15:00:00', told_by: 'm-five', last_confirmed_at: '2026-11-02 15:00:00', confirmed_by: 'm-five',
}
const OPEN = { id: 't-open', name: 'Example Knights Open', date: '2026-12-05', end_date: '2026-12-06', status: 'upcoming', is_visible: 1, registration_status: 'open' }
const clubAnswer = { club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments: [OPEN], places: [] }

const QUESTION = 'Player One will be able to edit Example Knights Club\'s page, create its events and set their fees.'
const rows: RepRequestRow[] = [
  {
    id: 11, clubId: 'c-knights', clubName: 'Example Knights Club', memberName: 'Player One', memberEmail: 'player.one+club@example.org', connection: 'runs_it',
    note: 'I have run the <b>Tuesday</b> nights since spring.', sentOn: 'Tue, Nov 24', memberRole: 'member', nameQuestion: QUESTION, noName: null,
  },
  {
    id: 12, clubId: 'c-knights', clubName: 'Example Knights Club', memberName: 'Player Three', memberEmail: 'player.three@example.org', connection: 'keeps_page',
    note: '', sentOn: 'Wed, Nov 25', memberRole: 'tournament_director', nameQuestion: 'Player Three will be able to edit Example Knights Club\'s page, create its events and set their fees.',
    noName: 'An LCA admin decides this one: Player Three is a tournament director now, and a member holds one role.',
  },
]

let answer: WorkspaceRegionResponse = baseAnswer
let club: Record<string, unknown> = clubAnswer
let decideAnswers: Array<{ status: number; body: unknown }> = []
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url === '/api/workspace/region') return new Response(JSON.stringify(answer), { status: 200 })
  if (url === '/api/admin/clubs/c-knights') return new Response(JSON.stringify(club), { status: 200 })
  if (url === '/api/admin/clubs/c-knights/news') return new Response(JSON.stringify({ news: [] }), { status: 200 })
  if (url.startsWith('/api/admin/clubs/c-knights/rep-requests/')) {
    const id = Number(url.split('/').pop())
    const body = JSON.parse(String(_init?.body))
    const next = decideAnswers.shift() ?? { status: 200, body: { id, status: body.decision === 'approve' ? 'approved' : 'declined', told: true } }
    return new Response(JSON.stringify(next.body), { status: next.status })
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
})

beforeEach(() => {
  answer = baseAnswer
  club = clubAnswer
  decideAnswers = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function auth(role: string): AuthContextValue {
  return { role, member: { id: 'm-1', role }, managedClubs: [{ id: 'c-knights', name: 'Example Knights Club' }], directedTournamentIds: [] } as unknown as AuthContextValue
}

async function drawRegion(role: string): Promise<HTMLElement> {
  const value = { ...auth(role), managedClubs: [] } as unknown as AuthContextValue
  const { container } = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes><Route path="/workspace/region" element={<MyRegionPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Clubs' })
  return container
}

async function drawClub(role: string): Promise<HTMLElement> {
  const { container } = render(
    <AuthContext.Provider value={auth(role)}>
      <MemoryRouter initialEntries={['/workspace/region/clubs/c-knights?tab=events']}>
        <Routes><Route path="/workspace/region/clubs/:id" element={<MyRegionClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Knights Club' })
  await screen.findByText('Example Knights Open')
  return container
}

const list = () => screen.getByRole('region', { name: 'Rep requests' })
const row = (id: number) => document.getElementById(`rep-request-${id}`)!

describe('with no request, the pages are the base\'s', () => {
  it.each(['lca_admin', 'member', 'club_rep'] as const)('My region draws the base\'s markup to the byte for %s, with the key absent', async (role) => {
    const container = await drawRegion(role)
    expect(normal(container.innerHTML)).toBe(base[role])
    expect(screen.queryByRole('region', { name: 'Rep requests' })).toBeNull()
  })

  it.each(['lca_admin', 'member'] as const)('a club in My region draws the base\'s markup to the byte for %s, with the key absent', async (role) => {
    const container = await drawClub(role)
    expect(normal(container.innerHTML)).toBe(clubBase[role])
  })
})

describe('the rows', () => {
  it('each row says the request in words, with the note, Email {first name}, Name as rep and Decline, and the reason in place of Name as rep where the keeper cannot name', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    await drawRegion('member')
    expect(within(list()).getByRole('heading', { level: 3, name: 'Rep request · Example Knights Club · Player One · Runs it · Tue, Nov 24' })).toBeTruthy()
    expect(within(list()).getByRole('heading', { level: 3, name: 'Rep request · Example Knights Club · Player Three · Would keep the page · Wed, Nov 25' })).toBeTruthy()
    const first = within(row(11))
    expect(first.getByText('I have run the <b>Tuesday</b> nights since spring.')).toBeTruthy()
    expect(first.getByRole('link', { name: 'Email Player about Example Knights Club' }).getAttribute('href')).toBe('mailto:player.one%2Bclub%40example.org')
    expect(first.getByRole('button', { name: 'Name as rep: Player One for Example Knights Club' })).toBeTruthy()
    expect(first.getByRole('button', { name: 'Decline: Player One for Example Knights Club' })).toBeTruthy()
    const second = within(row(12))
    expect(second.queryByRole('button', { name: /^Name as rep/ })).toBeNull()
    expect(second.getByText(rows[1].noName!)).toBeTruthy()
    expect(second.getByRole('button', { name: /^Decline/ })).toBeTruthy()
  })

  it('Name as rep asks its question first; Cancel leaves the row with the focus back; Yes names, the row leaves, the status says so and the focus goes on', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    await drawRegion('lca_admin')
    const name = within(row(11)).getByRole('button', { name: /^Name as rep/ })
    await act(async () => { fireEvent.click(name) })
    const question = await screen.findByRole('dialog', { name: QUESTION })
    await act(async () => { fireEvent.click(within(question).getByRole('button', { name: 'Cancel' })) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(name))
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/rep-requests/'))).toHaveLength(0)
    await act(async () => { fireEvent.click(name) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(list()).getByRole('status').textContent).toBe(namedWords('Player One', 'Example Knights Club')))
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/rep-requests/'))!
    expect(call[0]).toBe('/api/admin/clubs/c-knights/rep-requests/11')
    expect(JSON.parse(String(call[1]?.body))).toEqual({ decision: 'approve', role: 'member' })
    expect(document.getElementById('rep-request-11')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('rep-request-12-title')))
  })

  it('Decline asks its question, then the last row leaves and the focus goes to the list\'s heading', async () => {
    answer = { ...baseAnswer, repRequests: [rows[1]] }
    await drawRegion('member')
    await act(async () => { fireEvent.click(within(row(12)).getByRole('button', { name: /^Decline/ })) })
    const question = await screen.findByRole('dialog', { name: declineQuestion('Player Three') })
    await act(async () => { fireEvent.click(within(question).getByRole('button', { name: 'Decline' })) })
    await waitFor(() => expect(within(list()).getByRole('status').textContent).toBe(declinedWords('Player Three')))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'Rep requests' })))
  })

  it('a refusal that is not "decided already" leaves the row with the server\'s words beside its buttons', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    decideAnswers = [{ status: 403, body: { error: REP_DECIDE_FOR_KEEPERS } }]
    await drawRegion('lca_admin')
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Name as rep/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(row(11)).getByText(`Nothing changed: ${REP_DECIDE_FOR_KEEPERS}`)).toBeTruthy())
  })

  it('a failed press is said in the list\'s one status too, and the button that keeps the focus is described by the row\'s line', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    decideAnswers = [{ status: 403, body: { error: REP_DECIDE_FOR_KEEPERS } }]
    await drawRegion('lca_admin')
    const decline = within(row(11)).getByRole('button', { name: /^Decline/ })
    await act(async () => { fireEvent.click(decline) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline' })) })
    const words = `Nothing changed: ${REP_DECIDE_FOR_KEEPERS}`
    await waitFor(() => expect(within(list()).getByRole('status').textContent).toBe(words))
    await waitFor(() => expect(document.activeElement).toBe(decline))
    const line = document.getElementById(decline.getAttribute('aria-describedby') ?? '')
    expect(line?.textContent).toBe(words)
  })

  it('when the email to the member did not go, the status says so for a naming and for a decline, and the decision stands', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    decideAnswers = [{ status: 200, body: { id: 11, status: 'approved', told: false } }, { status: 200, body: { id: 12, status: 'declined', told: false } }]
    await drawRegion('lca_admin')
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Name as rep/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(list()).getByRole('status').textContent).toBe('Player One is now Example Knights Club\'s rep. The email to them did not go, so tell them yourself.'))
    expect(document.getElementById('rep-request-11')).toBeNull()
    await act(async () => { fireEvent.click(within(row(12)).getByRole('button', { name: /^Decline/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline' })) })
    await waitFor(() => expect(within(list()).getByRole('status').textContent).toBe('Player Three\'s request was declined. The email to them did not go, so tell them yourself.'))
    expect(document.getElementById('rep-request-12')).toBeNull()
  })

  it('a refusal that says the role changed asks My region to read its answer once, keeps the words in the status, and draws the row afresh', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    decideAnswers = [{ status: 409, body: { error: REP_ROLE_CHANGED } }]
    await drawRegion('member')
    const reads = () => fetchMock.mock.calls.filter(([url]) => url === '/api/workspace/region').length
    expect(reads()).toBe(1)
    // The answer the page reads again: Player One is another club's rep now, so this representative cannot name them.
    const noName = adminsDecideRow('Player One', 'club_rep', 'Example Rooks Club')
    answer = { ...baseAnswer, repRequests: [{ ...rows[0], memberRole: 'club_rep', noName }, rows[1]] }
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Name as rep/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(row(11)).getByText(noName)).toBeTruthy())
    expect(reads()).toBe(2)
    expect(within(list()).getByRole('status').textContent).toBe(`Nothing changed: ${REP_ROLE_CHANGED}`)
    expect(within(row(11)).queryByRole('button', { name: /^Name as rep/ })).toBeNull()
    expect(within(row(11)).queryByText(`Nothing changed: ${REP_ROLE_CHANGED}`)).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('rep-request-11-title')))
    expect(reads()).toBe(2)
  })

  it('a refusal that says an LCA admin decides this one asks for the same read, so no button stays that can only be refused', async () => {
    answer = { ...baseAnswer, repRequests: rows }
    const refusal = adminsDecideWords('Player One', 'club_rep', 'Example Rooks Club')
    decideAnswers = [{ status: 409, body: { error: refusal } }]
    await drawRegion('member')
    const reads = () => fetchMock.mock.calls.filter(([url]) => url === '/api/workspace/region').length
    expect(reads()).toBe(1)
    const noName = adminsDecideRow('Player One', 'club_rep', 'Example Rooks Club')
    answer = { ...baseAnswer, repRequests: [{ ...rows[0], memberRole: 'club_rep', noName }, rows[1]] }
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Name as rep/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(row(11)).getByText(noName)).toBeTruthy())
    expect(reads()).toBe(2)
    expect(within(list()).getByRole('status').textContent).toBe(`Nothing changed: ${refusal}`)
    expect(within(row(11)).queryByRole('button', { name: /^Name as rep/ })).toBeNull()
  })

  it('on a club in My region the same refusal reads the club again, once', async () => {
    club = { ...clubAnswer, repRequests: [rows[0]] }
    decideAnswers = [{ status: 409, body: { error: REP_ROLE_CHANGED } }]
    await drawClub('member')
    const reads = () => fetchMock.mock.calls.filter(([url]) => url === '/api/admin/clubs/c-knights').length
    const before = reads()
    const noName = adminsDecideRow('Player One', 'club_rep', 'Example Rooks Club')
    // The fresh answer names the club otherwise: only its rep requests are taken, so the page keeps its own club.
    club = { ...clubAnswer, club: { ...clubAnswer.club, name: 'Example Knights Club, renamed' }, repRequests: [{ ...rows[0], memberRole: 'club_rep', noName }] }
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Name as rep/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Name as rep' })) })
    await waitFor(() => expect(within(row(11)).getByText(noName)).toBeTruthy())
    expect(reads()).toBe(before + 1)
    expect(within(list()).getByRole('status').textContent).toBe(`Nothing changed: ${REP_ROLE_CHANGED}`)
    expect(screen.getByRole('heading', { level: 1, name: 'Example Knights Club' })).toBeTruthy()
  })

  it('a club in My region draws that club\'s requests under their own heading, and the row leaves once decided', async () => {
    club = { ...clubAnswer, repRequests: [rows[0]] }
    await drawClub('member')
    expect(screen.getByRole('heading', { level: 2, name: 'Rep requests' }).id).toBe('club-rep-requests-title')
    await act(async () => { fireEvent.click(within(row(11)).getByRole('button', { name: /^Decline/ })) })
    await act(async () => { fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline' })) })
    await waitFor(() => expect(document.getElementById('rep-request-11')).toBeNull())
    expect(screen.getByRole('heading', { level: 2, name: 'Rep requests' })).toBeTruthy()
  })
})
