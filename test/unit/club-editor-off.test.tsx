// @vitest-environment jsdom
//
// The admin club page with clubKeepers off, as WS09 step 7 ships it: the
// Details tab is today's form, its fields in today's order with today's
// labels and values, for an LCA admin, an observer, the club's rep and the
// region's representative alike, whether or not the server's answer carries
// the listing's new columns and places; Save club sends today's body; the
// editor's own file is never fetched. With the switch on, in this file
// alone, the News, Roster and Tournaments tabs and the page's header draw
// exactly what they draw with it off, and the Details tab draws the editor
// in place of today's form. The switch is flipped through a getter on the
// mocked FEATURES, so both sides are drawn from the same code, and the real
// page runs through the real client, with fetch stubbed. Every name, address
// and club here is made up.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ clubKeepers: false, clubEmailHidden: false }))
const loads = vi.hoisted(() => ({ editor: 0 }))
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
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))
// Counts each time the editor's file is fetched, so a test can say it was not.
vi.mock('@/areas/clubs/components/ClubEditor', async (importOriginal) => {
  loads.editor += 1
  return importOriginal()
})

const { AdminClubPage } = await import('@/pages/AdminClubPage')

/** Today's 13 columns of a made-up club, as the GET answers them with the server's constant unset. */
const TODAYS_CLUB = {
  id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', location: 'Example Library, Room B',
  description: 'A made-up club for casual and rated games.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
}
/** The same club as the GET answers it with the constant set: the new columns, set apart from today's, and two places. */
const KEEPERS_CLUB = {
  ...TODAYS_CLUB, slug: 'example-chess-club', about_text: 'Other words about the club.', how_we_meet_text: 'Other words on meeting.',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 1, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACES = [
  { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 },
  { id: 2, name: 'Example Hall', street: null, note: null, latitude: null, longitude: null },
]
const REST = {
  officers: [{ id: 'o1', member_id: 'm2', role: 'President', full_name: 'Player One', email: 'player.one@example.org' }],
  roster: [{ id: 'm2', full_name: 'Player One', email: 'player.one@example.org', uscf_id: null, uscf_rating: 1500, membership_status: 'active' }],
  tournaments: [{ id: 't1', name: 'Example Club Swiss', date: '2026-12-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open' }],
}
const NEWS = [{ id: 'n1', title: 'Example news', news_date: '2026-11-07', excerpt: 'A made-up note.' }]

interface Seen {
  url: string
  method: string
  body?: string
}
let seen: Seen[] = []
let answer: Record<string, unknown> = { club: TODAYS_CLUB, ...REST }

beforeEach(() => {
  flags.clubKeepers = false
  flags.clubEmailHidden = false
  seen = []
  answer = { club: TODAYS_CLUB, ...REST }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    seen.push({ url, method, body: init?.body as string | undefined })
    if (url === '/api/admin/clubs/example-chess-club/news') return new Response(JSON.stringify({ news: NEWS }), { status: 200 })
    if (url === '/api/admin/clubs/example-chess-club' && method === 'GET') return new Response(JSON.stringify(answer), { status: 200 })
    if (url === '/api/admin/clubs/example-chess-club' && method === 'PATCH') return new Response(JSON.stringify({ club: TODAYS_CLUB }), { status: 200 })
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** The four kinds of person the page admits: the role each signs in with. */
const PEOPLE = {
  admin: { role: 'lca_admin', id: 'm-admin', club_id: null },
  observer: { role: 'lca_observer', id: 'm-observer', club_id: null },
  rep: { role: 'club_rep', id: 'm-rep', club_id: 'example-chess-club' },
  representative: { role: 'member', id: 'm-region', club_id: null },
} as const
type Person = keyof typeof PEOPLE

async function openPage(person: Person, tab?: 'news' | 'roster' | 'tournaments') {
  const who = PEOPLE[person]
  const member = { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two' }
  const auth = {
    user: { id: who.id }, member, session: null, role: who.role, loading: false, memberLoading: false, seats: [],
    managedClubs: person === 'representative' ? [{ id: 'example-chess-club', name: 'Example Chess Club' }] : [],
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  const view = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/clubs/example-chess-club${tab ? `?tab=${tab}` : ''}`]}>
        <Routes>
          <Route path="/admin/clubs/:id" element={<AdminClubPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' })
  return view.container
}

/** Each control of the Details tab in its order: what it is, its id, its label as a person reads it, its value, and whether it is shut. */
function controls(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('input, textarea, select, button, a')].map((el) => {
    const id = el.id ? `#${el.id}` : ''
    const label = el.id ? (root.querySelector(`label[for="${el.id}"]`)?.textContent ?? '') : (el.getAttribute('aria-label') ?? el.textContent ?? '').trim()
    const type = el instanceof HTMLInputElement ? el.type : ''
    const value = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el.value : (el.getAttribute('href') ?? '')
    // A link works inside a shut fieldset, as ViewOnlyFieldset says.
    const shut = el.tagName !== 'A' && ((el as HTMLInputElement).disabled || el.closest('fieldset[disabled]')) ? ' shut' : ''
    return `${el.tagName.toLowerCase()}${id} ${type} "${label}" = ${value}${shut}`.replace(/ {2,}/g, ' ')
  })
}

/** The Details tab's part of the page: everything after the page's header. */
const body = (container: HTMLElement) => container.querySelectorAll('section')[1] as HTMLElement

/** Today's Details tab, field by field, as the base's code draws it for a person who may change the name and region, or not. */
function todaysForm(admin: boolean, shut: boolean): string[] {
  const s = shut ? ' shut' : ''
  const named = admin && !shut ? '' : ' shut'
  return [
    `input#name text "Club name" = Example Chess Club${named}`,
    `input#city text "City" = Example City${s}`,
    `input#location text "Meeting location" = Example Library, Room B${s}`,
    `textarea#description "Description" = A made-up club for casual and rated games.${s}`,
    `input#schedule text "Meeting schedule" = Tuesdays at 7:00 PM${s}`,
    `input#email email "Contact email" = club@example.org${s}`,
    `select#region "Region" = Bayou Region${named}`,
    `input color "" = #1f4e79${s}`,
    `input text "" = #1f4e79${s}`,
    `input file "" = ${s}`,
    `button "Choose image" = ${s}`,
    `button "Save club" = ${s}`,
    `a "View public club page" = /clubs/example-chess-club`,
    `input text "Coordinates or Google Maps link" = ${shut ? ' shut' : ''}`,
    `button "Use this" = shut`,
    `button "Save map location" = shut`,
    `button "Remove saved location" = ${s}`,
  ].map((line) => line.replace(/ {2,}/g, ' '))
}

describe('the admin club page with clubKeepers off: the Details tab is today\'s form', () => {
  it('draws today\'s fields, in today\'s order, with today\'s labels and values, for an LCA admin', async () => {
    const page = await openPage('admin')
    expect(controls(body(page))).toEqual(todaysForm(true, false))
    expect([...body(page).querySelectorAll('h2')].map((h) => h.textContent)).toEqual(['Basic information', 'Club color', 'Club image', 'Map location'])
    expect(screen.getByText('Appears as a tint on tournament cards and the club carousel. LCA gold is the default.')).toBeTruthy()
  })

  it('draws the same form for the club\'s rep and the region\'s representative, the name and the region shut, and for an observer all shut', async () => {
    for (const person of ['rep', 'representative'] as const) {
      const page = await openPage(person)
      expect(controls(body(page)), person).toEqual(todaysForm(false, false))
      expect(screen.getByText('Contact an LCA admin to rename your club.'), person).toBeTruthy()
      cleanup()
    }
    const page = await openPage('observer')
    expect(controls(body(page))).toEqual(todaysForm(false, true))
    expect(screen.getByText('View only: you can see everything here, but changes are made by LCA admins.')).toBeTruthy()
  })

  it('draws the same form from an answer that carries the listing\'s new columns and places', async () => {
    const before = body(await openPage('admin')).innerHTML
    cleanup()
    answer = { club: KEEPERS_CLUB, ...REST, places: PLACES }
    const after = body(await openPage('admin'))
    expect(after.innerHTML).toBe(before)
    expect(after.textContent).not.toContain('Other words about the club.')
    expect(after.textContent).not.toContain('Example Hall')
  })

  it('sends today\'s body from Save club, as before, and asks nothing else', async () => {
    await openPage('rep')
    fireEvent.click(screen.getByRole('button', { name: 'Save club' }))
    await waitFor(() => expect(seen.filter((s) => s.method === 'PATCH')).toHaveLength(1))
    const patch = seen.find((s) => s.method === 'PATCH')!
    expect(JSON.parse(patch.body!)).toEqual({
      name: 'Example Chess Club', city: 'Example City', location: 'Example Library, Room B', description: 'A made-up club for casual and rated games.',
      meetingSchedule: 'Tuesdays at 7:00 PM', contactEmail: 'club@example.org', color: '#1f4e79', region: 'Bayou Region',
    })
    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      'GET /api/admin/clubs/example-chess-club', 'GET /api/admin/clubs/example-chess-club/news', 'PATCH /api/admin/clubs/example-chess-club',
    ])
  })

  it('never fetches the editor\'s file and draws none of its words', async () => {
    for (const person of Object.keys(PEOPLE) as Person[]) {
      await openPage(person)
      expect(screen.queryByRole('button', { name: 'Save and publish' }), person).toBeNull()
      expect(screen.queryByText('The basics'), person).toBeNull()
      cleanup()
    }
    expect(loads.editor).toBe(0)
  })
})

describe('the admin club page with clubKeepers on, in this test alone', () => {
  it('draws the News, Roster and Tournaments tabs exactly as with it off, for every kind of person', async () => {
    for (const person of Object.keys(PEOPLE) as Person[]) {
      // The Tournaments tab stays with LCA admins, observers and the club's rep, as today.
      const tabs = person === 'representative' ? (['news', 'roster'] as const) : (['news', 'roster', 'tournaments'] as const)
      for (const tab of tabs) {
        flags.clubKeepers = false
        flags.clubEmailHidden = false
        const off = (await openPage(person, tab)).innerHTML
        cleanup()
        flags.clubKeepers = true
        flags.clubEmailHidden = true
        const on = (await openPage(person, tab)).innerHTML
        cleanup()
        expect(on, `${person} ${tab}`).toBe(off)
      }
    }
  })

  it('draws the page\'s header as with it off, and the editor in place of today\'s form', async () => {
    const off = await openPage('admin')
    const header = off.querySelector('section[data-ground="dark"]')!.outerHTML
    cleanup()
    flags.clubKeepers = true
    flags.clubEmailHidden = true
    const on = await openPage('admin')
    expect(on.querySelector('section[data-ground="dark"]')!.outerHTML).toBe(header)
    expect(await screen.findByRole('button', { name: 'Save and publish' })).toBeTruthy()
    expect(on.querySelector('#city')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save club' })).toBeNull()
    expect(loads.editor).toBe(1)
  })
})
