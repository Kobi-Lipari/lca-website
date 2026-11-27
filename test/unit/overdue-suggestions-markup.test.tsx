// @vitest-environment jsdom
//
// What the 14 days leave as they were (WS09's twenty-ninth step, ruling two):
// while no suggestion has been passed on, the keeper's rows draw the markup
// the step before them drew, to the byte. The expected strings in
// test/unit/fixtures/suggestion-rows-base-markup.json were taken from the
// render of src/areas/clubs/components/SuggestionRows.tsx as it stood before
// this step, with the generated ids of the help marks written as _r_N_. And
// My region's to-do list is the same markup for an LCA admin with a row of 13
// days as for a member, since the admin's button is drawn only while a row has
// waited 14 days or more and has not been passed on. Every club, person and
// word is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { OpenSuggestion, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'
import base from './fixtures/suggestion-rows-base-markup.json'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { SuggestionRows, ClubSuggestionsBanner } = await import('@/areas/clubs/components/SuggestionRows')

const normal = (html: string) => html.replace(/_r_[0-9a-z]+_/g, '_r_N_')

const rows = [
  { kind: 'suggestion', id: 4, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 9, clubId: 'c-1', clubName: 'Example Knights Club' },
  { kind: 'suggestion', id: 5, field: 'cost', message: 'Free now.', hasAddress: false, ageDays: 0, clubId: 'c-1', clubName: 'Example Knights Club' },
] as const

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the rows of a suggestion not passed on', () => {
  it('the to-do list draws as it did before the 14 days, to the byte', () => {
    const { container } = render(
      <MemoryRouter>
        <SuggestionRows kind="todo" rows={[...rows]} onResolved={() => {}} onApplied={() => {}} />
      </MemoryRouter>,
    )
    expect(normal(container.innerHTML)).toBe(base.todo)
  })

  it('a club\'s banner draws as it did before the 14 days, to the byte', () => {
    const { container } = render(
      <MemoryRouter>
        <ClubSuggestionsBanner suggestions={rows.map((row) => ({ kind: row.kind, id: row.id, field: row.field, message: row.message, hasAddress: row.hasAddress, ageDays: row.ageDays }) as OpenSuggestion)} clubId="c-1" clubName="Example Knights Club" onApplied={() => {}} />
      </MemoryRouter>,
    )
    expect(normal(container.innerHTML)).toBe(base.banner)
  })

  it('a row with the new key empty or absent draws no line, and one passed on adds that line alone', () => {
    const plain = render(
      <MemoryRouter>
        <ClubSuggestionsBanner suggestions={[{ kind: 'suggestion', id: 4, field: 'venue', message: 'Moved.', hasAddress: true, ageDays: 20 }]} clubId="c-1" clubName="Example Knights Club" onApplied={() => {}} />
      </MemoryRouter>,
    )
    const before = normal(plain.container.innerHTML)
    plain.unmount()
    const passed = render(
      <MemoryRouter>
        <ClubSuggestionsBanner suggestions={[{ kind: 'suggestion', id: 4, field: 'venue', message: 'Moved.', hasAddress: true, ageDays: 20, passedOnAt: '2026-11-23 18:00:00' }]} clubId="c-1" clubName="Example Knights Club" onApplied={() => {}} />
      </MemoryRouter>,
    )
    const after = normal(passed.container.innerHTML)
    expect(after.replace('<p class="text-sm text-ink">Passed to the LCA admins on Mon, Nov 23, 2026</p>', '')).toBe(before)
    expect(after).not.toBe(before)
  })
})

describe('My region with a suggestion of 13 days', () => {
  const suggestion: OpenSuggestion = { kind: 'suggestion', id: 4, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 13 }
  const club: RegionClub = {
    id: 'c-knights', name: 'Example Knights Club', city: 'Example City', region: 'Lake Charles / Southwestern', color: null, logoUrl: null,
    statement: 'Tuesdays at 7:00 PM', lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 0, openItems: [suggestion],
  }
  const answer: WorkspaceRegionResponse = {
    clubs: [club],
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 1 },
    regions: [{ region: 'Lake Charles / Southwestern', keepers: [] }],
  }
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (
      url === '/api/workspace/region' ? new Response(JSON.stringify(answer), { status: 200 }) : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    )))
  })

  async function todoOf(role: string): Promise<string> {
    const auth = { role, member: { id: 'm-1', role }, managedClubs: [] } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/workspace/region']}>
          <Routes>
            <Route path="/workspace/region" element={<MyRegionPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 2, name: 'Clubs' })
    const html = normal(screen.getByRole('region', { name: 'Suggestions to answer' }).innerHTML)
    cleanup()
    return html
  }

  it('the to-do list is the same markup for an LCA admin as for a member, with no button', async () => {
    const admin = await todoOf('lca_admin')
    const member = await todoOf('member')
    expect(admin).toBe(member)
    expect(admin).not.toContain('Send overdue suggestions on')
    expect(admin).not.toContain('Passed to')
  })
})
