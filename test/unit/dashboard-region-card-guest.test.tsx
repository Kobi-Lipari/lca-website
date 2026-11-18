// @vitest-environment jsdom
//
// The Dashboard's "Clubs in your region" card for a guest account that holds
// a regional seat (WS09 switch-on, on main's tree). My region's guard and
// GET /api/workspace/region turn a guest away by design (WS09 step 11), so
// with clubKeepers on the card offers a guest no "Open My region": the link
// led straight back to the Dashboard. The heading and the clubs still draw,
// from what the page already knows, and a member who holds a seat is offered
// the link as before. With clubKeepers on and with it off, a guest is drawn
// each club as a plain row with its name and region, with no Manage → link,
// since the server refuses a guest the club's admin page; a member who holds
// the same seat is drawn the links, the list's markup as it was. The real
// Dashboard runs with fetch stubbed; every name and club here is made up.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ clubKeepers: true }))
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
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-guest-card' } } }) } },
}))

const { DashboardPage } = await import('@/pages/DashboardPage')

const PERSON = {
  id: 'm-guest-card', email: 'player.one@example.org', full_name: 'Player One', uscf_id: null, uscf_rating: null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: '2027-06-30', membership_type: null,
  guardian_id: null, uscf_expiration: null, club_id: null, created_at: '2025-01-04 18:00:00',
}
const SEAT = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const MANAGED = [
  { id: 'example-chess-club', name: 'Example Chess Club', region: 'Bayou Region' },
  { id: 'example-knights-club', name: 'Example Knights Club', region: null },
]
/** A member's card without "Open My region": its heading and a link to each club's admin page. */
const CARD_TEXT = ' Clubs in your regionExample Chess ClubBayou RegionManage →Example Knights ClubManage →'
const CLUB_LINKS = [['Example Chess ClubBayou RegionManage →', '/admin/clubs/example-chess-club'], ['Example Knights ClubManage →', '/admin/clubs/example-knights-club']]
/** A guest's card: its heading and each club's name and region, with nothing to press. */
const GUEST_TEXT = ' Clubs in your regionExample Chess ClubBayou RegionExample Knights Club'
/** A member's list of clubs, exactly as the Dashboard drew it for everyone before the guest's rows. */
const MEMBER_LIST = '<ul class="mt-4 grid gap-2 sm:grid-cols-2">'
  + '<li><a class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-ink/40 hover:bg-muted/40" href="/admin/clubs/example-chess-club" data-discover="true">'
  + '<span class="min-w-0"><span class="block truncate font-medium text-ink">Example Chess Club</span><span class="block text-xs text-muted-foreground">Bayou Region</span></span>'
  + '<span class="flex-shrink-0 text-xs font-medium text-ink">Manage →</span></a></li>'
  + '<li><a class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:border-ink/40 hover:bg-muted/40" href="/admin/clubs/example-knights-club" data-discover="true">'
  + '<span class="min-w-0"><span class="block truncate font-medium text-ink">Example Knights Club</span></span>'
  + '<span class="flex-shrink-0 text-xs font-medium text-ink">Manage →</span></a></li>'
  + '</ul>'
/** The guest's row: the link's own classes, less its hover and transition. */
const PLAIN_ROW = 'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm'

let accountRole = 'guest'
let asked: string[] = []
beforeEach(() => {
  asked = []
  flags.clubKeepers = true
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    const path = url.split('?')[0]
    const body = path === '/api/me' ? { member: { ...PERSON, role: accountRole }, registrations: [], directedTournaments: [], children: [] }
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

/** A seat holder's Dashboard. A guest's context role resolves to 'member'; only the account's own role says guest. */
function draw(role: 'guest' | 'member') {
  accountRole = role
  const member = { ...PERSON, role }
  const auth = {
    user: { id: PERSON.id, email: PERSON.email }, member, session: null, role: 'member', loading: false, memberLoading: false,
    seats: [SEAT], managedClubs: MANAGED, isBoardMember: true, assuranceLevel: 'aal1', mfaRequired: false,
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
const card = () => screen.getByRole('heading', { level: 2, name: 'Clubs in your region' }).parentElement as HTMLElement
const linksOf = (el: HTMLElement) => within(el).getAllByRole('link').map((a) => [a.textContent?.replace(/\s+/g, ' ').trim(), a.getAttribute('href')])
const regionLinks = () => screen.queryAllByRole('link').filter((a) => (a.getAttribute('href') ?? '').startsWith('/workspace/region'))
const clubLinks = () => Array.from(document.querySelectorAll('a')).filter((a) => (a.getAttribute('href') ?? '').startsWith('/admin/clubs/'))

/** A guest's clubs: a plain row each, with its name and region, and nothing that looks pressable. */
async function expectGuestRows() {
  draw('guest')
  await settled()
  const el = card()
  const rows = Array.from(el.querySelectorAll('ul > li'))
  expect(rows.map((li) => li.textContent)).toEqual(['Example Chess ClubBayou Region', 'Example Knights Club'])
  for (const li of rows) {
    expect(li.className).toBe(PLAIN_ROW)
    expect(li.className).not.toMatch(/hover:|transition|cursor-pointer/)
    expect(li.querySelector('a, button, [role="link"], [role="button"], [tabindex]')).toBeNull()
  }
  expect(within(el).queryAllByRole('link')).toEqual([])
  expect(clubLinks()).toEqual([])
  expect(within(el).queryByText(/Manage/)).toBeNull()
  expect(el.textContent).not.toContain('Manage')
  expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
}

/** A member's clubs: each club's Manage → link, the list's markup as it was before the guest's rows. */
async function expectMemberLinks() {
  draw('member')
  await settled()
  const el = card()
  expect(el.querySelector('ul')?.outerHTML).toBe(MEMBER_LIST)
  expect(clubLinks().map((a) => [a.textContent, a.getAttribute('href')])).toEqual(CLUB_LINKS)
}

describe('the Dashboard\'s region card for a guest account that holds a regional seat', () => {
  it('with clubKeepers on, offers a guest no Open My region and no other link into My region', async () => {
    draw('guest')
    await settled()
    expect(screen.queryByRole('link', { name: 'Open My region' })).toBeNull()
    expect(regionLinks()).toEqual([])
  })

  it('with clubKeepers on, still draws the heading and the clubs for a guest, from what the page already knows', async () => {
    draw('guest')
    await settled()
    const el = card()
    expect(el.textContent).toBe(GUEST_TEXT)
    expect(within(el).queryAllByRole('link')).toEqual([])
    // No request more: the Dashboard asks nothing of My region's answer.
    expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
  })

  it('with clubKeepers on, offers a member who holds the same seat Open My region as before', async () => {
    draw('member')
    await settled()
    const el = card()
    const link = within(el).getByRole('link', { name: 'Open My region' })
    expect(link.getAttribute('href')).toBe('/workspace/region')
    expect(link.className.split(' ')).toContain('min-h-11')
    expect(linksOf(el)).toEqual([['Open My region', '/workspace/region'], ...CLUB_LINKS])
    expect(el.textContent).toBe(CARD_TEXT.replace(' Clubs in your region', ' Clubs in your regionOpen My region'))
    expect(asked.filter((u) => u.includes('/api/workspace/region'))).toEqual([])
  })

  it('with clubKeepers off, draws a guest\'s card as a member\'s less the Manage → links, with no Open My region', async () => {
    flags.clubKeepers = false
    draw('guest')
    await settled()
    const guestText = card().textContent
    expect(regionLinks()).toEqual([])
    cleanup()
    draw('member')
    await settled()
    expect(card().textContent).toBe(CARD_TEXT)
    expect(guestText).toBe(GUEST_TEXT)
    expect(CARD_TEXT.split('Manage →').join('')).toBe(GUEST_TEXT)
    expect(regionLinks()).toEqual([])
  })

  it('with clubKeepers on, draws a guest each club\'s name and region as a plain row, with no link to /admin/clubs/ and no Manage text', async () => {
    await expectGuestRows()
  })

  it('with clubKeepers off, draws a guest each club\'s name and region as a plain row, with no link to /admin/clubs/ and no Manage text', async () => {
    flags.clubKeepers = false
    await expectGuestRows()
  })

  it('with clubKeepers on, draws a member who holds the same seat each club\'s Manage → link, the list\'s markup as before', async () => {
    await expectMemberLinks()
  })

  it('with clubKeepers off, draws a member who holds the same seat each club\'s Manage → link, the list\'s markup as before', async () => {
    flags.clubKeepers = false
    await expectMemberLinks()
  })
})
