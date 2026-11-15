// @vitest-environment jsdom
//
// A club in My region (WS09 step 12), through the site's own routes in
// src/App.tsx at /workspace/region/clubs/:id. With clubKeepers off, which is
// how the step ships, the route sends every kind of person to the dashboard,
// the page's file is never fetched and no call is made. With it on, which
// this file turns on through a getter on the mocked FEATURES, an LCA admin
// and a holder of an active regional seat whose regions hold the club get
// in; another region's representative, a club's own rep with no seat over
// it, a plain member and a guest are sent away. The page draws three tabs
// and no Tonight; its Listing tab is the one editor, saving through the one
// PATCH; its News tab posts and deletes as the admin club page does; its
// Events tab gives each event its weekday and its state in words. The real
// page runs through the real client with fetch stubbed, so each request is
// read as it would leave the browser; the site's header, footer, banners
// and the dashboard are stood in for. Every name, club and address here is
// made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import { clubSaveServer } from './helpers/clubSaveServer'

// Each case may wait up to 5 seconds for the page's file, or the editor's, to load, so each case has 20 seconds.
vi.setConfig({ testTimeout: 20000 })

const flags = vi.hoisted(() => ({ clubKeepers: false }))
/** Whether the page's file was ever fetched, read by the cases with the switch off, which run first. */
const loaded = vi.hoisted(() => ({ page: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/pages/MyRegionClubPage', async (importOriginal) => {
  loaded.page = true
  return importOriginal()
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))
vi.mock('@/pages/DashboardPage', async () => {
  const { createElement } = await import('react')
  return { DashboardPage: () => createElement('p', null, 'The dashboard') }
})

const { default: App } = await import('@/App')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const ID = 'c-knights'
const CLUB_URL = `/api/admin/clubs/${ID}`
/** A made-up club as the admin answer gives it with CLUB_KEEPERS_ON set, checked on Mon, Nov 2, 2026. */
const CLUB = {
  id: ID, name: 'Example Knights Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player Five', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-02 15:00:00' as string | null, told_by: 'm-five', last_confirmed_at: '2026-11-02 15:00:00' as string | null, confirmed_by: 'm-five',
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }
const OFFICERS = [{ id: 'o-1', member_id: 'm-five', role: 'President', full_name: 'Player Five' }]
const OPEN = { id: 't-open', name: 'Example Knights Open', date: '2026-12-05', end_date: '2026-12-06', status: 'upcoming', is_visible: 1, registration_status: 'open' }
const DONE = { id: 't-done', name: 'Example Autumn Swiss', date: '2026-10-24', end_date: null, status: 'completed', is_visible: 1, registration_status: 'closed' }
const DRAFT = { id: 't-draft', name: 'Example Winter Draft', date: '2027-01-09', end_date: null, status: 'upcoming', is_visible: 0, registration_status: 'draft' }
const NEWS = [{ id: 'n-1', club_id: ID, title: 'Example club night', news_date: '2026-11-07', excerpt: 'Player Five won the example blitz.', created_at: '2026-11-08 18:00:00' }]

type Person = 'representative' | 'repWithSeat' | 'observerWithSeat' | 'otherRegion' | 'ownRepNoSeat' | 'ownRepSeatElsewhere' | 'member' | 'guestWithSeat' | 'admin'
const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const PEOPLE: Record<Person, { role: string; account?: string; club?: string; seats: unknown[]; managed: string[] }> = {
  representative: { role: 'member', seats: [REGIONAL], managed: [ID] },
  repWithSeat: { role: 'club_rep', club: 'c-rooks', seats: [REGIONAL], managed: [ID] },
  observerWithSeat: { role: 'lca_observer', seats: [REGIONAL], managed: ['c-rooks'] },
  otherRegion: { role: 'member', seats: [REGIONAL], managed: ['c-rooks'] },
  ownRepNoSeat: { role: 'club_rep', club: ID, seats: [], managed: [] },
  ownRepSeatElsewhere: { role: 'club_rep', club: ID, seats: [REGIONAL], managed: ['c-rooks'] },
  member: { role: 'member', seats: [], managed: [] },
  guestWithSeat: { role: 'member', account: 'guest', seats: [REGIONAL], managed: [ID] },
  admin: { role: 'lca_admin', seats: [], managed: [] },
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
type Answer = (body: unknown) => Response | Promise<Response>
let asked: Array<{ call: string; body: unknown }> = []
let answers: Record<string, Answer> = {}
let news = NEWS

/** The club's answer as the server gives it to a person a regional seat alone admits: listed events, officers without email, no roster. */
function regionAnswer(club: Record<string, unknown> = CLUB) {
  return { club, officers: OFFICERS, roster: [], rosterKeptBack: true, tournaments: [OPEN, DONE], places: [PLACE] }
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
  window.localStorage.setItem(REGION_HELP_SHOWN_KEY, 'shown')
  asked = []
  news = NEWS
  const server = clubSaveServer(CLUB, [PLACE])
  answers = {
    [`GET ${CLUB_URL}`]: () => json(regionAnswer()),
    [`GET ${CLUB_URL}/news`]: () => json({ news }),
    [`PATCH ${CLUB_URL}`]: (body) => json(server.patch(body as Record<string, unknown>)),
    [`POST ${CLUB_URL}/confirm`]: () => json({ id: ID, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    asked.push({ call, body })
    const answer = answers[call]
    return answer ? answer(body) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{`${pathname}${search}`}</output>
}
const where = () => screen.getByTestId('where').textContent

/** The site at this address for this person, through its own routes. */
function open(person: Person, path = `/workspace/region/clubs/${ID}`) {
  const who = PEOPLE[person]
  const auth = {
    user: { id: `m-${person}` }, session: null, role: who.role,
    member: { id: `m-${person}`, role: who.account ?? who.role, club_id: who.club ?? null, full_name: 'Player One', email: 'player.one@example.org' },
    loading: false, memberLoading: false, seats: who.seats, managedClubs: who.managed.map((id) => ({ id, name: 'Example Club', region: 'Bayou Region' })),
    isBoardMember: who.seats.length > 0, assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
/** The page, once its file has loaded and the club has come. */
async function page() {
  await screen.findByRole('heading', { level: 1, name: 'Example Knights Club' }, { timeout: 5000 })
  await act(async () => {})
}
const tabNames = () => screen.getAllByRole('button').filter((b) => b.closest('section')?.classList.contains('bg-brand-navy') && !b.getAttribute('aria-label')).map((b) => b.textContent)
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')
const header = () => screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement

describe('a club in My region with clubKeepers off, as the step ships', () => {
  it('sends every kind of person to the dashboard, fetches no file of the page and calls no answer', async () => {
    flags.clubKeepers = false
    for (const person of Object.keys(PEOPLE) as Person[]) {
      open(person)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      cleanup()
    }
    expect(asked).toEqual([])
    expect(loaded.page).toBe(false)
  })

  it('keeps the route behind the switch in App.tsx, with the page lazy as My region is', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('const MyRegionClubPage = lazy(() => import(\'@/pages/MyRegionClubPage\').then(m => ({ default: m.MyRegionClubPage })))')
    expect(app).toContain('<Route path="/workspace/region/clubs/:id" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat requireClubMatch><MyRegionClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
  })
})

describe('a club in My region with clubKeepers on: who may open', () => {
  beforeEach(() => { flags.clubKeepers = true })

  it('lets in an LCA admin and a holder of an active regional seat whose regions hold the club, whatever their role', async () => {
    for (const person of ['admin', 'representative', 'repWithSeat'] as Person[]) {
      open(person)
      await page()
      expect(where(), person).toBe(`/workspace/region/clubs/${ID}`)
      cleanup()
    }
  })

  it('sends another region\'s representative, a club\'s own rep with no seat over it, a plain member and a guest to the dashboard, asking nothing', async () => {
    for (const person of ['otherRegion', 'ownRepNoSeat', 'member', 'guestWithSeat'] as Person[]) {
      open(person)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      cleanup()
    }
    expect(asked).toEqual([])
  })

  it('draws "not found here" with a way back to My region for a club the server will not give, and for one outside the person\'s regions', async () => {
    // An LCA admin at an id that names no club: the server answers 404.
    answers[`GET ${CLUB_URL}`] = () => json({ error: 'Club not found' }, 404)
    open('admin')
    await screen.findByText('This club is not found here.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to My region' }).getAttribute('href')).toBe('/workspace/region')
    expect(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'My region' }).getAttribute('href')).toBe('/workspace/region')
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['A club in My region'])
    expect(document.body.textContent).not.toContain('Club not found')
    cleanup()
    // A representative whose seat no longer holds the club: the server answers 403, in the same words here.
    answers[`GET ${CLUB_URL}`] = () => json({ error: 'Forbidden' }, 403)
    open('representative')
    await screen.findByText('This club is not found here.', undefined, { timeout: 5000 })
    expect(document.body.textContent).not.toContain('Forbidden')
    cleanup()
    // An observer who holds a seat over other clubs: the server gives an observer any club, the page draws none of it.
    answers[`GET ${CLUB_URL}`] = () => json(regionAnswer())
    open('observerWithSeat')
    await screen.findByText('This club is not found here.', undefined, { timeout: 5000 })
    expect(document.body.textContent).not.toContain('Example Knights Club')
    expect(asked.map((a) => a.call)).not.toContain(`GET ${CLUB_URL}/news`)
  })

  it('draws "not found here" for a club\'s own rep whose seat covers only other clubs, at their own club', async () => {
    open('ownRepSeatElsewhere')
    await screen.findByText('This club is not found here.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to My region' }).getAttribute('href')).toBe('/workspace/region')
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['A club in My region'])
    expect(document.body.textContent).not.toContain('Example Knights Club')
    expect(screen.queryByRole('button', { name: /Still accurate/ })).toBeNull()
    expect(asked.map((a) => a.call)).not.toContain(`GET ${CLUB_URL}/news`)
  })

  it('My region\'s Open leads here by the club\'s id', async () => {
    answers['GET /api/workspace/region'] = () => json({
      clubs: [{ id: ID, name: 'Example Knights Club', city: 'Example City', region: 'Bayou Region', color: null, logoUrl: null, statement: null, lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 2, openItems: [] }],
      thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 1 },
      regions: [{ region: 'Bayou Region', keepers: [] }],
    })
    open('representative', '/workspace/region')
    const openLink = await screen.findByRole('link', { name: 'Open: Example Knights Club' }, { timeout: 5000 })
    expect(openLink.getAttribute('href')).toBe(`/workspace/region/clubs/${ID}`)
    await act(async () => { fireEvent.click(openLink) })
    await page()
    expect(where()).toBe(`/workspace/region/clubs/${ID}`)
  })
})

describe('a club in My region with clubKeepers on: the page', () => {
  beforeEach(() => { flags.clubKeepers = true })

  it('three tabs and no Tonight', async () => {
    open('representative')
    await page()
    expect(tabNames()).toEqual(['Listing', 'News', 'Events'])
    expect(document.body.textContent).not.toMatch(/\b(?:tonight|meets today|this week)\b/i)
    const tab = (name: string) => within(header()).getByRole('button', { name })
    expect(tab('Listing').getAttribute('aria-current')).toBe('true')
    for (const name of ['Listing', 'News', 'Events']) expect(tab(name).className.split(' ')).toContain('min-h-11')
    await act(async () => { fireEvent.click(tab('Events')) })
    expect(where()).toBe(`/workspace/region/clubs/${ID}?tab=events`)
    expect(tab('Events').getAttribute('aria-current')).toBe('true')
    expect(tab('Listing').getAttribute('aria-current')).toBeNull()
    await act(async () => { fireEvent.click(tab('News')) })
    expect(where()).toBe(`/workspace/region/clubs/${ID}?tab=news`)
    await act(async () => { fireEvent.click(tab('Listing')) })
    expect(where()).toBe(`/workspace/region/clubs/${ID}`)
  })

  it('the header: the trail, the town, region and stamp, View public page in a new tab, and no keeper or email', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T18:00:00Z'))
    open('representative')
    await page()
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(trail.textContent).toBe('My LCA›My region›Example Knights Club')
    expect(within(trail).getByRole('link', { name: 'My LCA' }).getAttribute('href')).toBe('/dashboard')
    expect(within(trail).getByRole('link', { name: 'My region' }).getAttribute('href')).toBe('/workspace/region')
    expect(within(header()).getByText('Example City · Bayou Region · Checked Nov 2026')).toBeTruthy()
    const view = within(header()).getByRole('link', { name: 'View public page (opens in a new tab)' })
    expect(view.getAttribute('href')).toBe(`/clubs/${ID}`)
    expect(view.getAttribute('target')).toBe('_blank')
    expect(view.getAttribute('rel')).toBe('noopener noreferrer')
    // The answer names the public contact and an officer, neither of them a keeper, so the header names nobody.
    expect(header().textContent).not.toMatch(/kept by|Player Five/)
    expect(document.body.textContent).not.toMatch(/@/)
    expect(document.title).toBe('Example Knights Club · My region | Louisiana Chess Association')
  })

  it('the header\'s words for a club not checked for 90 days and a club never checked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T18:00:00Z'))
    answers[`GET ${CLUB_URL}`] = () => json(regionAnswer({ ...CLUB, last_confirmed_at: '2026-08-14 15:00:00' }))
    open('representative')
    await page()
    expect(within(header()).getByText('Example City · Bayou Region · Not checked since Aug 2026')).toBeTruthy()
    cleanup()
    answers[`GET ${CLUB_URL}`] = () => json(regionAnswer({ ...CLUB, last_confirmed_at: null, told_by: null }))
    open('representative')
    await page()
    expect(within(header()).getByText('Example City · Bayou Region · Not checked yet')).toBeTruthy()
  })

  it('Still accurate calls the card\'s endpoint and says what happened in the one polite status line', async () => {
    answers[`GET ${CLUB_URL}`] = () => json(regionAnswer({ ...CLUB, last_confirmed_at: null }))
    open('representative')
    await page()
    expect(within(header()).getByText(/· Not checked yet$/)).toBeTruthy()
    const still = within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })
    expect(still.className.split(' ')).toContain('min-h-11')
    still.focus()
    await act(async () => { fireEvent.click(still) })
    await waitFor(() => expect(statusText()).toContain('Example Knights Club marked still accurate: Checked Nov 2026.'))
    expect(asked.filter((a) => a.call.startsWith('POST '))).toEqual([{ call: `POST ${CLUB_URL}/confirm`, body: {} }])
    expect(within(header()).getByText('Example City · Bayou Region · Checked Nov 2026')).toBeTruthy()
    expect(document.activeElement).toBe(still)
    expect(screen.getAllByRole('status')[0].getAttribute('aria-live')).toBeNull()
    // A refusal is said in words, and the stamp stays as it was.
    answers[`POST ${CLUB_URL}/confirm`] = () => json({ error: 'Forbidden' }, 403)
    await act(async () => { fireEvent.click(still) })
    await waitFor(() => expect(statusText()).toContain('Example Knights Club was not marked still accurate: Forbidden. Nothing changed.'))
    expect(within(header()).getByText('Example City · Bayou Region · Checked Nov 2026')).toBeTruthy()
  })

  it('the Listing tab saves through the one editor and shows the refusal of a stale save', async () => {
    open('representative')
    await page()
    const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    await act(async () => {})
    const form = save.closest('form') as HTMLFormElement
    // The editor's words for a person whose club this is not.
    expect(document.body.textContent).not.toMatch(/your club/i)
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: 'Free for everyone' } })
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => expect(asked.filter((a) => a.call === `PATCH ${CLUB_URL}`)).toHaveLength(1))
    const first = asked.find((a) => a.call === `PATCH ${CLUB_URL}`)?.body as Record<string, unknown>
    expect(first.toldUpdatedAt).toBe('2026-11-02 15:00:00')
    expect(first.costText).toBe('Free for everyone')
    // A representative sends no name, region or page address.
    expect(Object.keys(first)).not.toEqual(expect.arrayContaining(['name']))
    expect(first.region).toBeUndefined()
    // Someone saved since: the editor says so in words and keeps what was typed.
    answers[`PATCH ${CLUB_URL}`] = () => json({ error: 'This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version' }, 409)
    fireEvent.change(screen.getByLabelText('Cost'), { target: { value: 'Free for all' } })
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(
      'Nothing was saved: This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version. Everything you typed is still here.',
    ))
    expect((screen.getByLabelText('Cost') as HTMLInputElement).value).toBe('Free for all')
    expect(asked.filter((a) => a.call === `PATCH ${CLUB_URL}`)).toHaveLength(2)
    // One editor, the one PATCH, and nothing about saving written a second time on the page.
    expect(read('src/pages/MyRegionClubPage.tsx')).not.toMatch(/saveClubListing|adminUpdateClub|method: 'PATCH'/)
  })

  it('News posts as today', async () => {
    open('representative', `/workspace/region/clubs/${ID}?tab=news`)
    await page()
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    // Its date with its weekday, and Delete named with the news it deletes.
    expect(screen.getByText('Sat, Nov 7, 2026')).toBeTruthy()
    const remove = screen.getByRole('button', { name: 'Delete: Example club night' })
    expect(remove.closest('div[class*="min-h-11"]')).not.toBeNull()
    // Post: the same three values to the same endpoint, then the list the server answers.
    answers[`POST ${CLUB_URL}/news`] = () => json({ news: { id: 'n-2' } }, 201)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example open results' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-14' } })
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'An example weekend of chess.' } })
    news = [{ ...NEWS[0], id: 'n-2', title: 'Example open results', news_date: '2026-11-14', excerpt: 'An example weekend of chess.' }, ...NEWS]
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post news' })) })
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 2' })
    expect(asked.find((a) => a.call === `POST ${CLUB_URL}/news`)?.body).toEqual({ title: 'Example open results', newsDate: '2026-11-14', excerpt: 'An example weekend of chess.' })
    expect(statusText()).toContain('News posted.')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
    // Delete: the browser's own question first, as today, and a No sends nothing.
    answers[`DELETE ${CLUB_URL}/news/n-1`] = () => json({ success: true })
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete: Example club night' })) })
    expect(asked.map((a) => a.call)).not.toContain(`DELETE ${CLUB_URL}/news/n-1`)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Delete: Example club night' })) })
    expect(ask).toHaveBeenLastCalledWith('Delete "Example club night"? This cannot be undone.')
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' })
    expect(statusText()).toContain('"Example club night" deleted.')
    // A refused post is said in words, and the form keeps what was typed.
    answers[`POST ${CLUB_URL}/news`] = () => json({ error: 'Title is required' }, 400)
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Example' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-14' } })
    fireEvent.change(screen.getByLabelText('Excerpt'), { target: { value: 'An example.' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post news' })) })
    await waitFor(() => expect(statusText()).toContain('The news was not posted: Title is required.'))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Example')
    // A post that went through, whose list then cannot be read again, is never said as not
    // posted: the form gives way to Try again, so the same news is not posted twice.
    answers[`POST ${CLUB_URL}/news`] = () => json({ news: { id: 'n-3' } }, 201)
    answers[`GET ${CLUB_URL}/news`] = () => json({ error: 'The list is away' }, 500)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Post news' })) })
    await waitFor(() => expect(statusText()).toContain('The news was posted. The list could not be read again:'))
    expect(statusText()).not.toContain('was not posted')
    expect(screen.queryByRole('button', { name: 'Post news' })).toBeNull()
    answers[`GET ${CLUB_URL}/news`] = () => json({ news })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await screen.findByRole('button', { name: 'Post news' })
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('')
  })

  it('an event row shows its weekday', async () => {
    open('representative', `/workspace/region/clubs/${ID}?tab=events`)
    await page()
    const list = screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement
    const rows = within(list).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual([
      'Example Knights OpenSat, Dec 5, 2026 to Sun, Dec 6, 2026Upcoming · Registration openEvent page',
      'Example Autumn SwissSat, Oct 24, 2026Finished · Registration closedEvent page',
    ])
    // A representative a seat alone admits manages no event, so each listed event leads to its public page.
    expect(within(rows[0]).getByRole('link', { name: 'Event page: Example Knights Open' }).getAttribute('href')).toBe('/tournaments/t-open')
    expect(within(list).queryByRole('link', { name: /^Manage/ })).toBeNull()
    expect(document.body.textContent).not.toContain('Example Winter Draft')
  })

  it('an LCA admin sees the banner with Back to Admin, each event\'s manage page, and a draft in words', async () => {
    answers[`GET ${CLUB_URL}`] = () => json({ club: CLUB, officers: OFFICERS.map((o) => ({ ...o, email: 'player.five@example.org' })), roster: [], tournaments: [OPEN, DRAFT], places: [PLACE] })
    open('admin', `/workspace/region/clubs/${ID}?tab=events`)
    await page()
    expect(screen.getByText('You\'re here as an LCA admin')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Admin' }).getAttribute('href')).toBe('/admin')
    const list = screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement
    expect(within(list).getByRole('link', { name: 'Manage: Example Knights Open' }).getAttribute('href')).toBe('/admin/tournaments/t-open')
    expect(within(list).getByRole('link', { name: 'Manage: Example Winter Draft' }).getAttribute('href')).toBe('/admin/tournaments/t-draft')
    expect(within(list).getByText('Draft, not public')).toBeTruthy()
    expect(within(list).getByText('Sat, Jan 9, 2027')).toBeTruthy()
    // The officers' emails the answer carries for an LCA admin are drawn nowhere here.
    expect(document.body.textContent).not.toMatch(/@/)
  })

  it('a representative given a draft links it to no page, and a club\'s own rep with a seat manages its events', async () => {
    answers[`GET ${CLUB_URL}`] = () => json({ ...regionAnswer(), tournaments: [DRAFT] })
    open('representative', `/workspace/region/clubs/${ID}?tab=events`)
    await page()
    let list = screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement
    expect(within(list).queryByRole('link')).toBeNull()
    expect(within(list).getByText('Draft, not public')).toBeTruthy()
    cleanup()
    PEOPLE.repWithSeat.club = ID
    try {
      open('repWithSeat', `/workspace/region/clubs/${ID}?tab=events`)
      await page()
      list = screen.getByRole('heading', { level: 2, name: 'Events' }).closest('section') as HTMLElement
      expect(within(list).getByRole('link', { name: 'Manage: Example Winter Draft' })).toBeTruthy()
    } finally {
      PEOPLE.repWithSeat.club = 'c-rooks'
    }
  })

  it('brings a control the keyboard reaches partly under today\'s header clear of it below lg, and leaves it be from lg up', async () => {
    open('representative', `/workspace/region/clubs/${ID}?tab=news`)
    await page()
    const excerpt = await screen.findByLabelText('Excerpt', undefined, { timeout: 5000 })
    const scrolled = vi.fn()
    excerpt.scrollIntoView = scrolled
    vi.spyOn(excerpt, 'getBoundingClientRect').mockReturnValue({ top: -10, bottom: 80, left: 0, right: 300, width: 300, height: 90, x: 0, y: -10, toJSON: () => ({}) })
    const real = excerpt.matches.bind(excerpt)
    vi.spyOn(excerpt, 'matches').mockImplementation((selector: string) => (selector === ':focus-visible' ? true : real(selector)))
    const before = window.matchMedia
    try {
      for (const [wide, calls] of [[false, 1], [true, 1]] as const) {
        window.matchMedia = ((query: string) => ({ matches: wide && query === '(min-width: 64rem)', media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia
        fireEvent.focus(excerpt)
        expect(scrolled, wide ? 'from lg up' : 'below lg').toHaveBeenCalledTimes(calls)
      }
    } finally {
      window.matchMedia = before
    }
    expect(scrolled).toHaveBeenCalledWith({ block: 'start' })
  })

  it('keeps one h1, headings in order, every control named and clear of today\'s header, and nothing that scrolls sideways', async () => {
    open('representative', `/workspace/region/clubs/${ID}?tab=events`)
    await page()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const levels = [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => !h.closest('[hidden]')).map((h) => Number(h.tagName[1]))
    for (const [i, level] of levels.entries()) if (i > 0) expect(level - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1)
    const root = header().parentElement as HTMLElement
    expect(root.className).toBe('max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24')
    for (const control of [...document.querySelectorAll('main a, main button')]) {
      const name = control.getAttribute('aria-label') ?? control.textContent?.trim()
      expect(name, control.outerHTML).toBeTruthy()
      expect(control.className, name ?? '').toMatch(/min-h-11/)
    }
    expect(header().querySelector('h1')?.className.split(' ')).toContain('break-words')
  })
})
