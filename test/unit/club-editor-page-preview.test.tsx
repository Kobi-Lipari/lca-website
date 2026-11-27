// @vitest-environment jsdom
//
// The club editor's preview column and the page itself (WS09 step 21). The
// page's preview, drawn with the new page's own parts from what the form
// holds, waits with the public pages: it is drawn only while clubPagesOn()
// holds (newClubs and newLook together), first in the column, beside the
// previews the column already has. With clubPagesOn() false the column is
// today's, node for node, whether clubKeepers is off or on. Each case sets
// the switches it reads through the mocked FEATURES. Every name, address
// and club here is made up.
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

describe('the editor\'s preview column with clubPagesOn() false', () => {
  it('is today\'s, node for node, with clubKeepers off and with it on, and with newClubs on while newLook is off', () => {
    const drawn: string[] = []
    for (const on of [{ clubKeepers: false }, { clubKeepers: true }, { clubKeepers: true, newClubs: true }, { clubKeepers: true, newLook: true }]) {
      set(on)
      editor()
      expect(column().querySelector('[data-slot="page-preview"]')).toBeNull()
      expect(within(column()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
        'How your page shows up in a search', 'When someone shares your page', 'Your card in LCA\'s club directory', 'Your page\'s checklist',
      ])
      drawn.push(column().outerHTML)
      cleanup()
    }
    expect(new Set(drawn).size).toBe(1)
  })
})

describe('the editor\'s preview column with clubPagesOn() true', () => {
  it('draws the page first, beside the previews the column already has, which are as they were', () => {
    set({ clubKeepers: true })
    editor()
    const before = column().outerHTML
    cleanup()

    set({ clubKeepers: true, newClubs: true, newLook: true })
    editor()
    const page = column().querySelector('[data-slot="page-preview"]')!
    expect(page).toBeTruthy()
    expect(within(column()).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Your club\'s page', 'How your page shows up in a search', 'When someone shares your page', 'Your card in LCA\'s club directory', 'Your page\'s checklist',
    ])
    // Take the page's preview away and the column is what it was.
    const copy = column().cloneNode(true) as HTMLElement
    copy.querySelector('[data-slot="page-preview"]')!.closest('section')!.remove()
    expect(copy.outerHTML).toBe(before)
  })

  it('draws the page from the form\'s values with the new page\'s parts, and follows the form as the person types', () => {
    set({ clubKeepers: true, newClubs: true, newLook: true })
    editor()
    const page = column().querySelector<HTMLElement>('[data-slot="page-preview"]')!
    const preview = within(page)
    expect(preview.getByText('Example Chess Club')).toBeTruthy()
    expect(preview.getByText('Chess club in Example City, Louisiana · Bayou Region')).toBeTruthy()
    expect(preview.getByText('EC')).toBeTruthy()
    expect(preview.getByText('About Example Chess Club')).toBeTruthy()
    expect(preview.getByText(ABOUT)).toBeTruthy()
    expect(preview.getByText('When and where Example Chess Club meets')).toBeTruthy()
    expect(page.querySelector('blockquote')?.textContent).toBe(STATEMENT)
    expect(preview.getByText('Example Library')).toBeTruthy()
    expect(preview.getByText('Room past the desk.')).toBeTruthy()
    // The cover takes the club's colour; the drawing has no heading, link or button of its own, and none of the server's lines.
    const filled = [...page.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.backgroundColor !== '')
    expect(filled.map((el) => el.style.backgroundColor)).toEqual(['rgb(46, 107, 79)'])
    expect(page.querySelectorAll('h1, h2, h3, h4, a, button')).toHaveLength(0)
    expect(page.textContent).not.toMatch(/Kept by|As told/)

    fireEvent.change(screen.getByLabelText('One sentence about the club'), { target: { value: 'A made-up club. It meets in Example City.' } })
    expect(within(page).getByText('A made-up club. It meets in Example City.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('One sentence about the club'), { target: { value: '   ' } })
    expect(within(page).queryByText(/^About /)).toBeNull()
    // Nothing was asked for the preview.
    expect(fetched).toEqual([])
  })
})
