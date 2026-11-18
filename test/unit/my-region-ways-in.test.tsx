// @vitest-environment jsdom
//
// The way into My region (WS09 step 11): the Dashboard's "Clubs in your
// region" block gains "Open My region" with clubKeepers on, and with it off,
// which is how the step ships, the block is drawn for a seat holder exactly
// as on the base, but for the sentence K's decision 10 removed, and not at
// all for a member without a seat, and the Dashboard never calls My
// region's answer. The real Dashboard runs with fetch stubbed; every name
// and club here is made up.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ clubKeepers: false }))
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
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-ways-in' } } }) } },
}))

const { DashboardPage } = await import('@/pages/DashboardPage')

const MEMBER = {
  id: 'm-holder', email: 'player.one@example.org', full_name: 'Player One', uscf_id: null, uscf_rating: null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: '2027-06-30', membership_type: null,
  guardian_id: null, uscf_expiration: null, role: 'member', club_id: null, created_at: '2025-01-04 18:00:00',
}
const SEAT = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const MANAGED = [
  { id: 'example-chess-club', name: 'Example Chess Club', region: 'Bayou Region' },
  { id: 'example-knights-club', name: 'Example Knights Club', region: null },
]
/** The block as the base draws it for this seat holder, less the sentence K's decision 10 removed: its heading and a link to each club's admin page. */
const BASE_TEXT = ' Clubs in your regionExample Chess ClubBayou RegionManage →Example Knights ClubManage →'
const BASE_LINKS = [['Example Chess ClubBayou RegionManage →', '/admin/clubs/example-chess-club'], ['Example Knights ClubManage →', '/admin/clubs/example-knights-club']]

let asked: string[] = []
beforeEach(() => {
  asked = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    const path = url.split('?')[0]
    const body = path === '/api/me' ? { member: MEMBER, registrations: [], directedTournaments: [], children: [] }
      : path === '/api/support' ? { tickets: [] }
        : path === '/api/me/children' ? { children: [] }
          : path === '/api/tournaments' ? { tournaments: [] }
            : null
    return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function draw(withSeat: boolean) {
  const auth = {
    user: { id: MEMBER.id, email: MEMBER.email }, member: MEMBER, session: null, role: 'member', loading: false, memberLoading: false,
    seats: withSeat ? [SEAT] : [], managedClubs: withSeat ? MANAGED : [], isBoardMember: withSeat, assuranceLevel: 'aal1', mfaRequired: false,
    directedTournaments: [], directedTournamentIds: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes><Route path="/dashboard" element={<DashboardPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
/** The Dashboard once its own answer has come. */
const settled = () => screen.findByRole('heading', { level: 2, name: 'Profile' }, { timeout: 5000 })
const block = () => screen.queryByRole('heading', { level: 2, name: 'Clubs in your region' })?.parentElement ?? null
const linksOf = (el: HTMLElement) => within(el).getAllByRole('link').map((a) => [a.textContent?.replace(/\s+/g, ' ').trim(), a.getAttribute('href')])

describe('the Dashboard\'s way into My region', () => {
  it('with clubKeepers off, draws the block for a seat holder as the base does, with no Open My region', async () => {
    flags.clubKeepers = false
    draw(true)
    await settled()
    const card = block() as HTMLElement
    expect(card.textContent).toBe(BASE_TEXT)
    expect(linksOf(card)).toEqual(BASE_LINKS)
    expect(screen.queryByRole('link', { name: 'Open My region' })).toBeNull()
    expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
  })

  it('with clubKeepers off, draws no block for a member without a seat, as the base does', async () => {
    flags.clubKeepers = false
    draw(false)
    await settled()
    expect(block()).toBeNull()
    expect(screen.queryByRole('link', { name: 'Open My region' })).toBeNull()
    expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
  })

  it('with clubKeepers on, gives the block Open My region, 44px tall, and keeps the rest of it', async () => {
    flags.clubKeepers = true
    draw(true)
    await settled()
    const card = block() as HTMLElement
    const link = within(card).getByRole('link', { name: 'Open My region' })
    expect(link.getAttribute('href')).toBe('/workspace/region')
    expect(link.className.split(' ')).toContain('min-h-11')
    expect(linksOf(card)).toEqual([['Open My region', '/workspace/region'], ...BASE_LINKS])
    // No sentence with the switch on either: the link follows the heading.
    expect(card.textContent).toBe(BASE_TEXT.replace(' Clubs in your region', ' Clubs in your regionOpen My region'))
    // The Dashboard links to the page and asks nothing of it.
    expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
    flags.clubKeepers = false
  })
})
