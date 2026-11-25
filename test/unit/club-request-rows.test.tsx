// @vitest-environment jsdom
//
// The keeper's rows of Suggest a club and Start a club in My region (WS09's
// thirtieth step, src/areas/clubs/components/ClubRequestRows.tsx):
// - with no such row, My region draws the base's markup to the byte, for an
//   LCA admin, a region's representative and a club's rep who holds a seat.
//   The expected strings in test/unit/fixtures/my-region-base-markup.json were
//   taken from the render of src/pages/MyRegionPage.tsx as it stood before
//   this step, with the generated ids of the help marks written as _r_N_;
// - with rows, each says which it is in words, the club's name, its age, the
//   place, the region or that none was found, the person's words and name,
//   with Email {first name} and Mark as handled, and for an LCA admin alone
//   Add the club;
// - Mark as handled asks one question in words first; Cancel leaves the row
//   and puts the focus back; Yes marks it, the row leaves, the status says so
//   in words and the focus goes to the next row, or to the list's heading;
// - a stranger's words are drawn as text, wrapped anywhere.
// Every club, person and address is made up; the places are Louisiana's own.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ClubRequestRow, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'
import { CLUB_REQUEST_ROWS_HELP, MARK_HANDLED_QUESTION } from '@/areas/clubs/clubRequestRows'
import base from './fixtures/my-region-base-markup.json'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const normal = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_r_N_')

// The answer the base's markup was taken from.
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

const rows: ClubRequestRow[] = [
  {
    id: 7, kind: 'new_club', clubName: 'Example Pawns Club', place: 'Sulphur', message: 'Mondays at 6:30 PM in the <b>Example</b> Hall.',
    name: 'Player Three', email: 'player.three+club@example.org', region: 'Lake Charles / Southwestern', ageDays: 2,
  },
  {
    id: 8, kind: 'start_club', clubName: 'Example Bishops Club', place: '70601', message: `Saturdays ${'x'.repeat(300)}`,
    name: 'Player Four', email: 'player.four@example.org', region: 'Lake Charles / Southwestern', ageDays: 0,
  },
]
const lost: ClubRequestRow = {
  id: 9, kind: 'new_club', clubName: 'Example Queens Club', place: 'Example Nowhere', message: 'Thursdays.', name: 'Player Five',
  email: 'player.five@example.org', region: null, ageDays: 1,
}

let answer: WorkspaceRegionResponse = baseAnswer
let markAnswers: Array<{ status: number; body: unknown }> = []
const fetchMock = vi.fn(async (url: string) => {
  if (url === '/api/workspace/region') return new Response(JSON.stringify(answer), { status: 200 })
  if (url.startsWith('/api/admin/club-reports/')) {
    const next = markAnswers.shift() ?? { status: 200, body: { id: Number(url.split('/').pop()), status: 'answered' } }
    return new Response(JSON.stringify(next.body), { status: next.status })
  }
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
})

beforeEach(() => {
  answer = baseAnswer
  markAnswers = []
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function draw(role: string): Promise<HTMLElement> {
  const auth = { role, member: { id: 'm-1', role }, managedClubs: [] } as unknown as AuthContextValue
  const { container } = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes>
          <Route path="/workspace/region" element={<MyRegionPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Clubs' })
  return container
}

const list = () => screen.getByRole('region', { name: 'New clubs to check' })
const row = (id: number) => document.getElementById(`club-request-${id}`)!

describe('My region with no row of the two kinds', () => {
  it.each(['lca_admin', 'member', 'club_rep'] as const)('draws the base\'s markup to the byte for %s, with the key absent', async (role) => {
    const container = await draw(role)
    expect(normal(container.innerHTML)).toBe(base[role])
    expect(screen.queryByRole('region', { name: 'New clubs to check' })).toBeNull()
  })

  it('draws the base\'s markup with the key empty as well', async () => {
    answer = { ...baseAnswer, clubRequests: [] }
    const container = await draw('member')
    expect(normal(container.innerHTML)).toBe(base.member)
  })
})

describe('the rows', () => {
  it('a region\'s representative sees each row in words, with Email {first name} and Mark as handled, and no Add the club', async () => {
    answer = { ...baseAnswer, clubRequests: rows }
    await draw('member')
    expect(within(list()).getByRole('heading', { level: 3, name: 'New club suggested: Example Pawns Club' })).toBeTruthy()
    expect(within(list()).getByRole('heading', { level: 3, name: 'Wants to start a club: Example Bishops Club' })).toBeTruthy()
    const first = within(row(7))
    expect(first.getByText('Sent 2 days ago')).toBeTruthy()
    expect(within(row(8)).getByText('Sent today')).toBeTruthy()
    expect(first.getByText('Sulphur')).toBeTruthy()
    expect(first.getByText('Lake Charles / Southwestern')).toBeTruthy()
    expect(first.getByText('Player Three')).toBeTruthy()
    const email = first.getByRole('link', { name: 'Email Player about Example Pawns Club' })
    expect(email.textContent).toBe('Email Player')
    expect(email.getAttribute('href')).toBe('mailto:player.three%2Bclub%40example.org')
    expect(first.getByRole('button', { name: 'Mark as handled: New club suggested: Example Pawns Club' })).toBeTruthy()
    expect(within(list()).queryByRole('link', { name: /^Add the club/ })).toBeNull()
    // A stranger's words are text, never markup, and wrap anywhere.
    const words = first.getByText('Mondays at 6:30 PM in the <b>Example</b> Hall.')
    expect(words.querySelector('b')).toBeNull()
    expect(words.className).toContain('[overflow-wrap:anywhere]')
    // The list's mark holds its words, and nothing explains beside a control.
    fireEvent.click(within(list()).getByRole('button', { name: 'Help: New clubs to check' }))
    for (const [, help] of CLUB_REQUEST_ROWS_HELP) expect(within(list()).getByText(help)).toBeTruthy()
  })

  it('an LCA admin sees every row, one whose place was not found among them, each with Add the club', async () => {
    answer = { ...baseAnswer, clubRequests: [...rows, lost] }
    await draw('lca_admin')
    expect(within(row(9)).getByText('None: the place was not found')).toBeTruthy()
    for (const [id, name] of [[7, 'Example Pawns Club'], [8, 'Example Bishops Club'], [9, 'Example Queens Club']] as const) {
      expect(within(row(id)).getByRole('link', { name: `Add the club: ${name}` }).getAttribute('href')).toBe('/admin/clubs')
    }
  })
})

describe('Mark as handled', () => {
  it('asks one question first; Cancel leaves the row and puts the focus back on its button', async () => {
    answer = { ...baseAnswer, clubRequests: rows }
    await draw('member')
    const button = within(row(7)).getByRole('button', { name: /^Mark as handled/ })
    fireEvent.click(button)
    const question = await screen.findByRole('dialog', { name: MARK_HANDLED_QUESTION })
    fireEvent.click(within(question).getByRole('button', { name: 'Cancel' }))
    await act(async () => {})
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/admin/club-reports/'))).toEqual([])
    expect(row(7)).toBeTruthy()
  })

  it('marks the row once asked: it leaves, the status says so in words, and the focus goes to the next row, then to the list\'s heading', async () => {
    answer = { ...baseAnswer, clubRequests: rows }
    await draw('member')
    fireEvent.click(within(row(7)).getByRole('button', { name: /^Mark as handled/ }))
    const question = await screen.findByRole('dialog', { name: MARK_HANDLED_QUESTION })
    await act(async () => { fireEvent.click(within(question).getByRole('button', { name: 'Mark as handled' })) })
    await act(async () => {})
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/admin/club-reports/')) as unknown as Array<[string, RequestInit]>
    expect(calls.map(([url, init]) => [url, init.method, init.body])).toEqual([['/api/admin/club-reports/7', 'POST', JSON.stringify({ action: 'handled' })]])
    expect(document.getElementById('club-request-7')).toBeNull()
    expect(within(list()).getByRole('status').textContent).toBe('Example Pawns Club: Marked as handled. Their name and email address were removed.')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 3, name: 'Wants to start a club: Example Bishops Club' }))

    // A row another keeper handled first is said in the server's words, and leaves too; the focus goes to the list's heading.
    markAnswers = [{ status: 409, body: { error: 'This request was already handled, so nothing changed.' } }]
    fireEvent.click(within(row(8)).getByRole('button', { name: /^Mark as handled/ }))
    const again = await screen.findByRole('dialog', { name: MARK_HANDLED_QUESTION })
    await act(async () => { fireEvent.click(within(again).getByRole('button', { name: 'Mark as handled' })) })
    await act(async () => {})
    expect(document.getElementById('club-request-8')).toBeNull()
    expect(within(list()).getByRole('status').textContent).toBe('This request was already handled, so nothing changed.')
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'New clubs to check' }))
  })

  it('keeps the row and says why in words when the press does not go through', async () => {
    answer = { ...baseAnswer, clubRequests: rows }
    markAnswers = [{ status: 403, body: { error: 'This request is not for a region your seat keeps.' } }]
    await draw('member')
    fireEvent.click(within(row(7)).getByRole('button', { name: /^Mark as handled/ }))
    const question = await screen.findByRole('dialog', { name: MARK_HANDLED_QUESTION })
    await act(async () => { fireEvent.click(within(question).getByRole('button', { name: 'Mark as handled' })) })
    await act(async () => {})
    expect(within(row(7)).getByText('Nothing changed: This request is not for a region your seat keeps.')).toBeTruthy()
  })
})
