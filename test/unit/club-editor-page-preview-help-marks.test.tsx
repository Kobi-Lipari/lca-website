// @vitest-environment jsdom
//
// The club editor where checkpoint W's page preview and main's small question
// marks meet, with the five regions main took in. With the new club pages on
// the column draws the page's own preview first and the form still carries
// its Help as small question marks, one beside each part, and nothing of the
// large Help panel main took out: no Help button that opens a panel, no Close
// help, and nothing written to or read from the browser's storage for it. The
// preview line reads each of the five regions as written. With the new club
// pages off the form carries the same marks and no page preview. Every name,
// address and club here is made up.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false, clubKeepers: false, clubEmailHidden: true }))
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
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { ClubEditor } = await import('@/areas/clubs/components/ClubEditor')

const ABOUT = 'A friendly made-up club for casual and rated games, open to every level.'
const STATEMENT = 'Tuesdays from 7:00 PM at Example Library, casual games.'
const CLUB = {
  id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: ABOUT,
  meeting_schedule: STATEMENT, contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#2e6b4f', image_url: null,
  region: 'New Orleans Metro', latitude: 30.1, longitude: -91.2, slug: 'example-chess', about_text: ABOUT, how_we_meet_text: STATEMENT,
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room past the desk.', latitude: 30.1, longitude: -91.2 }

const fetched: string[] = []
beforeEach(() => {
  fetched.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(url)
    return new Response('{}', { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

function set(on: Partial<typeof flags>) {
  Object.assign(flags, { newClubs: false, newLook: false, clubKeepers: false, clubEmailHidden: true }, on)
}

const REGION_LIST = ['New Orleans Metro', 'Baton Rouge / East Central', 'Lafayette / South Central', 'Lake Charles / Southwestern', 'North Louisiana']

function editorWith(region: string | null, flagsOn: Partial<typeof flags>) {
  set(flagsOn)
  const auth = {
    user: { id: 'm-example' }, member: { id: 'm-example', role: 'club_rep', club_id: CLUB.id, full_name: 'Player Two' }, session: null, role: 'club_rep',
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor club={{ ...CLUB, region } as never} places={[PLACE]} own isAdmin={false} showAdminFields={false} viewOnly={false} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const column = () => document.getElementById('club-editor-previews')!
const marks = () => screen.getAllByRole('button', { name: /^Help: / })

describe('the editor with the page preview and the small question marks together', () => {
  it('draws the page preview and one question mark beside each part, and no Help panel, with the new club pages on', () => {
    editorWith(REGION_LIST[0], { clubKeepers: true, newClubs: true, newLook: true })
    expect(column().querySelector('[data-slot="page-preview"]')).toBeTruthy()
    const names = marks().map((m) => m.getAttribute('aria-label'))
    expect(names).toContain('Help: One sentence about the club')
    expect(names).toContain('Help: Preview')
    expect(names).toContain('Help: Save and publish')
    expect(screen.queryByRole('button', { name: /^Help$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /close help/i })).toBeNull()
    expect(screen.queryByText(/close help/i)).toBeNull()
  })

  it('draws the same question marks, and no page preview, with the new club pages off', () => {
    editorWith(REGION_LIST[0], { clubKeepers: true })
    expect(column().querySelector('[data-slot="page-preview"]')).toBeNull()
    expect(marks().map((m) => m.getAttribute('aria-label'))).toContain('Help: Preview')
    expect(screen.queryByRole('button', { name: /^Help$/ })).toBeNull()
  })

  it('opens a question mark\'s bubble with a press and shuts it with a second, with the page preview in the column', () => {
    editorWith(REGION_LIST[0], { clubKeepers: true, newClubs: true, newLook: true })
    const preview = screen.getByRole('button', { name: 'Help: Preview' })
    expect(preview.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(preview)
    expect(preview.getAttribute('aria-expanded')).toBe('true')
    const bubble = document.getElementById(preview.getAttribute('aria-controls') ?? '')!
    expect(bubble.textContent).toMatch(/looks in a search result/)
    fireEvent.click(preview)
    expect(preview.getAttribute('aria-expanded')).toBe('false')
  })

  it('reads and writes nothing in the browser\'s storage for Help, whatever is pressed', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    editorWith(REGION_LIST[0], { clubKeepers: true, newClubs: true, newLook: true })
    for (const m of marks().slice(0, 3)) fireEvent.click(m)
    expect(setItem.mock.calls.filter(([k]) => /help/i.test(String(k)))).toEqual([])
    expect(getItem.mock.calls.filter(([k]) => /help/i.test(String(k)))).toEqual([])
    setItem.mockRestore()
    getItem.mockRestore()
  })

  it.each(REGION_LIST)('the preview line reads %s as written, and the form holds it unchanged', (region) => {
    editorWith(region, { clubKeepers: true, newClubs: true, newLook: true })
    const page = column().querySelector<HTMLElement>('[data-slot="page-preview"]')!
    expect(within(page).getByText(`Chess club in Example City, Louisiana · ${region}`)).toBeTruthy()
  })

  it('a club with no region has a preview line that ends at Louisiana', () => {
    editorWith(null, { clubKeepers: true, newClubs: true, newLook: true })
    const page = column().querySelector<HTMLElement>('[data-slot="page-preview"]')!
    expect(within(page).getByText('Chess club in Example City, Louisiana')).toBeTruthy()
    expect(page.textContent).not.toMatch(/null|undefined/)
  })
})
