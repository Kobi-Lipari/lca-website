// @vitest-environment jsdom
//
// What checkpoint T's review of the whole mended in the club editor, beside
// test/unit/club-editor.test.tsx. In the bare pin picker: Remove pin hands
// the focus to the pin's box once its button goes with the pin; Use this
// stays a live button, so a good paste that empties the box keeps the focus
// on it, and an empty box is refused in words; the pin's line and a refused
// paste stand in live regions drawn from the first render. In the editor: a
// save that folds the second place away moves a focus that was in it to Add
// another place; Help, while the new club pages are off, says that the
// cost, who is welcome, the two ticks, the links and the previews wait for
// those pages; and the save carries the club's last save as the form read
// it, so a form opened before someone else's save is refused in words with
// everything typed kept. Every name, address and club here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { clubSaveServer } from './helpers/clubSaveServer'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false }))
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

const { ClubLocationPicker } = await import('@/areas/clubs/components/ClubLocationPicker')
const { AdminClubPage } = await import('@/pages/AdminClubPage')

const ID = 'example-chess-club'
const CLUB_URL = `/api/admin/clubs/${ID}`
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-chess', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null as string | null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE_1 = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }
const PLACE_2 = { id: 2, name: 'Example Hall', street: null, note: 'Saturdays only', latitude: null, longitude: null }
const REST = { officers: [], roster: [], tournaments: [] }

type Answer = (body: unknown) => Response | Promise<Response>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let seen: Array<{ call: string; body: unknown }> = []
let routes: Record<string, Answer> = {}

function serve(club: typeof CLUB, places: Array<Record<string, unknown>>) {
  const server = clubSaveServer(club, places)
  routes = {
    [`GET ${CLUB_URL}`]: () => json({ club, ...REST, places }),
    [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
    [`PATCH ${CLUB_URL}`]: (body) => json(server.patch(body as Record<string, unknown>)),
  }
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  seen = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    seen.push({ call, body })
    const route = routes[call]
    return route ? route(body) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openEditor(): Promise<HTMLFormElement> {
  const auth = {
    user: { id: 'm-1' }, member: { id: 'm-1', role: 'lca_admin', club_id: null, full_name: 'Player Two' }, session: null, role: 'lca_admin',
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  await act(async () => {})
  return save.closest('form') as HTMLFormElement
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const patches = () => seen.filter((s) => s.call === `PATCH ${CLUB_URL}`).map((s) => s.body as Record<string, unknown>)
/** Every bubble's words of Help's marks, in the page's order, as one piece to read. */
const help = () => {
  const all = document.createElement('div')
  for (const bubble of document.querySelectorAll('[data-slot="help-mark-bubble"]')) all.append(bubble.cloneNode(true))
  return all
}
const status = () => screen.getByRole('status')
const alertBox = () => screen.getByRole('alert')

/** The bare picker as the editor draws it, with a saved pin, for the first place or for place 2. */
function drawPicker(place?: string) {
  const onChange = vi.fn()
  render(
    <ClubLocationPicker
      clubName="Example Chess Club" latitude={30.1} longitude={-91.2}
      bare={{ inputId: place ? 'editor-point-2' : 'editor-point', onChange, ...(place ? { place } : {}) }}
    />,
  )
  return onChange
}

describe('the bare pin picker keeps the focus and says what changed', () => {
  it('Remove pin hands the focus to the pin\'s box once its button goes with the pin, for place 1 and for place 2', async () => {
    for (const place of [undefined, 'place 2']) {
      const of = place ? ` for ${place}` : ''
      const onChange = drawPicker(place)
      const remove = screen.getByRole('button', { name: `Remove pin${of}` })
      remove.focus()
      await act(async () => { fireEvent.click(remove) })
      expect(screen.queryByRole('button', { name: `Remove pin${of}` }), of).toBeNull()
      expect(document.activeElement, of).toBe(field(`Pin${of}: coordinates or a Google Maps link`))
      expect(screen.getByText(`No pin set${of}`)).toBeTruthy()
      expect(onChange).toHaveBeenLastCalledWith(null)
      cleanup()
    }
  })

  it('Use this stays a live button: a good paste keeps the focus on it, and an empty box is refused in words', async () => {
    const onChange = drawPicker()
    const box = field('Pin: coordinates or a Google Maps link')
    const use = screen.getByRole('button', { name: 'Use this' }) as HTMLButtonElement
    expect(use.disabled).toBe(false)
    use.focus()
    await act(async () => { fireEvent.click(use) })
    expect(screen.getByText('Paste coordinates or a Google Maps link in the box first.')).toBeTruthy()
    expect(box.getAttribute('aria-invalid')).toBe('true')
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.change(box, { target: { value: '30.4515, -91.1871' } })
    use.focus()
    await act(async () => { fireEvent.click(use) })
    expect(box.value).toBe('')
    expect(use.disabled).toBe(false)
    expect(document.activeElement).toBe(use)
    expect(screen.getByText('Pin at 30.45150, -91.18710')).toBeTruthy()
    expect(onChange).toHaveBeenLastCalledWith({ lat: 30.4515, lng: -91.1871 })
    expect(screen.queryByText(/in the box first/)).toBeNull()
  })

  it('draws the pin\'s line and the refusal\'s place as live regions from the first render, so the point set, the pin removed and a refusal are heard', async () => {
    drawPicker()
    const line = screen.getByText('Pin at 30.10000, -91.20000')
    expect(line.getAttribute('aria-live')).toBe('polite')
    const box = field('Pin: coordinates or a Google Maps link')
    const refusal = box.closest('div.space-y-1\\.5')!.querySelector('[aria-live="assertive"]') as HTMLElement
    expect(refusal).not.toBeNull()
    expect(refusal.textContent).toBe('')
    fireEvent.change(box, { target: { value: 'not a place' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Use this' })) })
    expect(refusal.textContent).toMatch(/^Couldn.t find coordinates in that\./)
    expect(box.getAttribute('aria-describedby')).toBe(refusal.querySelector('p')!.id)
    fireEvent.change(box, { target: { value: '30.5, -91.5' } })
    await act(async () => { fireEvent.keyDown(box, { key: 'Enter' }) })
    expect(screen.getByText('Pin at 30.50000, -91.50000')).toBe(line)
    expect(refusal.textContent).toBe('')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Remove pin' })) })
    expect(line.textContent).toBe('No pin set')
    // The editor's own status and alert stay the only ones with those roles.
    expect(screen.queryAllByRole('status')).toHaveLength(0)
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })
})

describe('the club editor after a save that folds the second place away', () => {
  it('moves a focus held in place 2 to Add another place when the save stores one place, whether place 2 was emptied or moved up', async () => {
    for (const how of ['emptied', 'moved up'] as const) {
      serve(CLUB, [PLACE_1, PLACE_2])
      const form = await openEditor()
      if (how === 'emptied') {
        fireEvent.change(field('Place 2 name'), { target: { value: '' } })
        fireEvent.change(field('Note about place 2'), { target: { value: '' } })
        field('Place 2 name').focus()
      } else {
        for (const label of ['Place name', 'Street address', 'Note about the place']) fireEvent.change(field(label), { target: { value: '' } })
        fireEvent.click(screen.getByRole('button', { name: 'Remove pin' }))
        field('Note about place 2').focus()
      }
      // Enter in a box sends the form.
      await act(async () => { fireEvent.submit(form) })
      await within(status()).findByText(/^Saved/)
      expect((patches()[0].places as unknown[]).length, how).toBe(1)
      expect(screen.queryByLabelText('Place 2 name'), how).toBeNull()
      await waitFor(() => expect(document.activeElement, how).toBe(screen.getByRole('button', { name: 'Add another place' })))
      cleanup()
      seen = []
    }
  })

  it('leaves the focus where it was when the save keeps both places, or when it was not in place 2', async () => {
    serve(CLUB, [PLACE_1, PLACE_2])
    const form = await openEditor()
    fireEvent.change(field('Place 2 name'), { target: { value: 'Example Hall East' } })
    field('Place 2 name').focus()
    await act(async () => { fireEvent.submit(form) })
    await within(status()).findByText(/^Saved/)
    expect(document.activeElement).toBe(field('Place 2 name'))
    cleanup()
    seen = []
    serve(CLUB, [PLACE_1, PLACE_2])
    const again = await openEditor()
    fireEvent.change(field('Place 2 name'), { target: { value: '' } })
    fireEvent.change(field('Note about place 2'), { target: { value: '' } })
    field('One sentence about the club').focus()
    await act(async () => { fireEvent.submit(again) })
    await within(status()).findByText(/^Saved/)
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
    expect(document.activeElement).toBe(field('One sentence about the club'))
  })
})

describe('Help while the new club pages are off', () => {
  it('says the cost, who is welcome, the two ticks, the links, Save and publish and the previews in the same words with the new club pages off and on, and says none of them wait for those pages', async () => {
    // Help no longer says which fields wait for the new club pages (K's note); the page's own tests hold what today's page draws.
    const SAME = [
      'Cost: what a club night costs, such as "Free" or "$5 toward the room". Who is welcome: who the club is for, and what a first-timer should bring or ask for. Tick a box only when it is true of the club.',
      'Paste the whole web address, starting with https://, such as the club\'s Facebook page. Leave a box empty if the club has no such page.',
      'Your changes show on the club\'s page right away. If you are not the club\'s regional representative, the representative gets an email saying what changed. Search results can take a few days to catch up.',
      'How the club looks in a search result, when its link is shared, and on its card in the club directory. It changes as you type.',
    ]
    serve(CLUB, [PLACE_1])
    await openEditor()
    const off = help().textContent ?? ''
    for (const words of SAME) expect(off, words).toContain(words)
    expect(off).not.toMatch(/once the new club pages open|once they open|show none of these/)
    cleanup()
    flags.newClubs = true
    flags.newLook = true
    serve(CLUB, [PLACE_1])
    await openEditor()
    const on = help().textContent ?? ''
    for (const words of SAME) expect(on, words).toContain(words)
    expect(on).not.toMatch(/once the new club pages open|once they open|show none of these/)
  })
})

describe('the club editor\'s save carries the last save it read', () => {
  it('sends the club\'s last save as the form read it, then the one its own save answered, and says a refusal for a save made since in words, keeping what was typed', async () => {
    const READ = '2026-11-14 18:00:00'
    const SAVED = '2026-11-14 19:30:00'
    const club = { ...CLUB, told_updated_at: READ }
    let refuse = false
    routes = {
      [`GET ${CLUB_URL}`]: () => json({ club, ...REST, places: [PLACE_1] }),
      [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
      [`PATCH ${CLUB_URL}`]: () => (refuse
        ? json({ error: 'This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version' }, 409)
        : json({ club: { ...club, told_updated_at: SAVED }, places: [PLACE_1] })),
    }
    const form = await openEditor()
    await act(async () => { fireEvent.submit(form) })
    await within(status()).findByText(/^Saved/)
    expect(patches()[0].toldUpdatedAt).toBe(READ)
    refuse = true
    fireEvent.change(field('Cost'), { target: { value: 'Free' } })
    await act(async () => { fireEvent.submit(form) })
    await waitFor(() => expect(alertBox().textContent).toBe(
      'Nothing was saved: This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version. Everything you typed is still here.',
    ))
    expect(patches()[1].toldUpdatedAt).toBe(SAVED)
    expect(field('Cost').value).toBe('Free')
    expect(status().textContent).not.toMatch(/Saved/)
  })
})
