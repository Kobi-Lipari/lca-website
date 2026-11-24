// @vitest-environment jsdom
//
// The club editor's page preview names only the sections the page itself
// would draw (checkpoint W's review): a link counts toward About only when
// it is one the page draws (webLink), so words typed in a link's field
// without http:// or https:// name no About with nothing under it. With the
// new club pages on, as the preview is drawn only then; each case sets the
// switches it reads through the mocked FEATURES. Every name, address and
// club here is made up.
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
  region: 'Bayou Region', latitude: 30.1, longitude: -91.2, slug: 'example-chess', about_text: ABOUT, how_we_meet_text: STATEMENT,
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room past the desk.', latitude: 30.1, longitude: -91.2 }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

function set(on: Partial<typeof flags>) {
  Object.assign(flags, { newClubs: false, newLook: false, clubKeepers: false, clubEmailHidden: true }, on)
}

function editor() {
  const auth = {
    user: { id: 'm-example' }, member: { id: 'm-example', role: 'club_rep', club_id: CLUB.id, full_name: 'Player Two' }, session: null, role: 'club_rep',
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor club={CLUB as never} places={[PLACE]} own isAdmin={false} showAdminFields={false} viewOnly={false} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** The column's previews, as drawn. */
const column = () => document.getElementById('club-editor-previews')!

describe('the page preview\'s sections, from the links the page would draw', () => {
  it('draws no About heading when the only thing in About is a Facebook field with no scheme, and draws it once the field is a web address', () => {
    set({ clubKeepers: true, newClubs: true, newLook: true })
    editor()
    const page = column().querySelector<HTMLElement>('[data-slot="page-preview"]')!
    expect(within(page).getByText('About Example Chess Club')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('One sentence about the club'), { target: { value: '   ' } })
    expect(within(page).queryByText(/^About /)).toBeNull()

    const facebook = screen.getByLabelText(/^Facebook page/)
    fireEvent.change(facebook, { target: { value: 'facebook.com/examplechessclub' } })
    expect(within(page).queryByText(/^About /)).toBeNull()
    expect(page.textContent).not.toContain('Find us online')

    fireEvent.change(facebook, { target: { value: 'https://www.facebook.com/examplechessclub' } })
    expect(within(page).getByText('About Example Chess Club')).toBeTruthy()
    expect(within(page).getByText('Facebook')).toBeTruthy()
  })
})
