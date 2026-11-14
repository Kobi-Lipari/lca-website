// @vitest-environment jsdom
//
// The edges of the one club editor (src/areas/clubs/components/ClubEditor.tsx)
// that club-editor.test.tsx and club-editor-off.test.tsx leave open, with
// clubKeepers on through a getter on the mocked FEATURES in this file alone.
// Held here: what the form sends parses against the contract's own request
// schemas, and what the mocked server answers parses against its response
// schemas, so the fixtures are honest; an observer's press sends nothing; a
// place left empty is not sent, a club's only place emptied clears today's
// location, a second place moved up is shown with the pin the save stored
// and kept by the next save, a removed pin goes as null, and a location today
// longer than a place name may be is kept as it is rather than blocking the
// save; a cleared email
// or region goes as null and an unchanged page address is not sent; a failure
// that is a dropped connection or an unreadable answer is still said in words
// with what was typed kept; a second press while the save is under way, by
// the button or by Enter, does nothing; a replay of a save sends the same
// body; "Saved" goes when the person types again and a failure goes at the
// next press; a pasted pin that holds no coordinates is refused in words tied to
// its box; storage that throws, whole or in part, never breaks Help; every
// sentence the form and its Help draw is plain (US Chess, "7:00 PM", no long or
// short dash); the editor's code is reached only as a chunk. Every name,
// address and club here is made up.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import {
  adminClubRowSchema, clubPlaceSchema, clubPlacesRequestSchema, clubPlacesResponseSchema, updateClubRequestSchema, updateClubResponseSchema,
} from '@domain/contracts'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'
import { clubSaveServer } from './helpers/clubSaveServer'

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

const { AdminClubPage } = await import('@/pages/AdminClubPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const ID = 'example-chess-club'
const CLUB_URL = `/api/admin/clubs/${ID}`

const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club for casual and rated games.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-chess', about_text: 'A friendly made-up club for casual and rated games.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE_1 = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }
const PLACE_2 = { id: 2, name: 'Example Hall', street: null, note: 'Saturdays only', latitude: null, longitude: null }
const REST = { officers: [], roster: [], tournaments: [] }

type Answer = (body: unknown) => Response | Promise<Response>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
interface Seen {
  call: string
  body: unknown
}
let seen: Seen[] = []
let routes: Record<string, Answer> = {}

/** What a server with its constant set answers: the GET, and the one save answering what it stored (test/unit/helpers/clubSaveServer.ts). */
function serve(club: Record<string, unknown> = CLUB, places: Array<Record<string, unknown>> | null = [PLACE_1, PLACE_2]) {
  const server = clubSaveServer(club, places ?? [])
  routes = {
    [`GET ${CLUB_URL}`]: () => json({ club, ...REST, ...(places ? { places } : {}) }),
    [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
    [`PATCH ${CLUB_URL}`]: (body) => json(server.patch(body as Record<string, unknown>)),
  }
  return server
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  seen = []
  serve()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const body = init?.body ? JSON.parse(init.body as string) : undefined
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

const PEOPLE = {
  admin: { role: 'lca_admin', id: 'm-admin', club_id: null },
  observer: { role: 'lca_observer', id: 'm-observer', club_id: null },
  rep: { role: 'club_rep', id: 'm-rep', club_id: ID },
} as const
type Person = keyof typeof PEOPLE

async function openEditor(person: Person = 'rep'): Promise<HTMLFormElement> {
  const who = PEOPLE[person]
  const auth = {
    user: { id: who.id }, member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two' }, session: null, role: who.role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
        <Routes>
          <Route path="/admin/clubs/:id" element={<AdminClubPage />} />
          <Route path="/clubs/:id" element={<p>The club page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const save = await screen.findByRole('button', { name: 'Save and publish' })
  return save.closest('form') as HTMLFormElement
}

const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const press = () => fireEvent.click(screen.getByRole('button', { name: /^(Save and publish|Saving…)$/ }))
const calls = () => seen.map((s) => s.call).filter((c) => !c.startsWith('GET '))
const sentBodies = (call: string) => seen.filter((s) => s.call === call).map((s) => s.body as Record<string, unknown>)
/** The bodies of the one save, in the order sent. */
const saves = () => sentBodies(`PATCH ${CLUB_URL}`)
/** The places each save sent. */
const placesOf = (body: Record<string, unknown>) => body.places as Array<Record<string, unknown>>
const help = () => document.getElementById('club-editor-help') as HTMLElement
const status = () => screen.getByRole('status')
const alertBox = () => screen.getByRole('alert')

/** The two dashes, by their code points, and the association's old name for US Chess, written in two parts so this file holds neither. */
const DASH = /[\u2013\u2014]/
const OLD_NAME = new RegExp(['us', 'cf'].join(''), 'i')
/** Names of the tools a text might credit, written in parts so this file names none. */
const MADE_BY = new RegExp(`\\b(${[['Cl', 'aude'], ['Anthr', 'opic'], ['Chat', 'GPT'], ['Ope', 'nAI'], ['L', 'LM'], ['co', 'pilot'], ['chat', 'bot']].map((p) => p.join('')).join('|')})\\b`, 'i')
const PIN_LABEL = 'Pin: coordinates or a Google Maps link'
/** The contact name's label while the new club pages are off, as in every case here. */
const CONTACT = 'Contact name, shown once the new club pages open'

describe('the club editor: what it sends and what it is answered, against the contract', () => {
  it('sends bodies that parse as the contract\'s requests, and the fixtures parse as its answers', async () => {
    expect(() => adminClubRowSchema.parse(CLUB)).not.toThrow()
    for (const place of [PLACE_1, PLACE_2]) expect(() => clubPlaceSchema.parse(place)).not.toThrow()
    expect(() => updateClubResponseSchema.parse({ club: CLUB })).not.toThrow()
    expect(() => updateClubResponseSchema.parse({ club: CLUB, places: [PLACE_1, PLACE_2] })).not.toThrow()
    await openEditor('admin')
    type('One sentence about the club', 'A made-up club that meets to play.')
    type('Page address', 'example-city-chess')
    press()
    await within(status()).findByText(/^Saved/)
    const patch = saves()[0]
    expect(updateClubRequestSchema.safeParse(patch).success).toBe(true)
    // The places in the one body are the places' own contract, the same list the PUT takes.
    expect(clubPlacesRequestSchema.safeParse({ places: patch.places }).success).toBe(true)
    expect(clubPlacesResponseSchema.safeParse({ places: (patch.places as unknown[]).map((_, i) => ({ id: i, name: 'Example', street: null, note: null, latitude: null, longitude: null })) }).success).toBe(true)
    expect((patch.places as unknown[]).length).toBeLessThanOrEqual(2)
  })

  it('sends a body the contract refuses for no field the form can fill within its limits', async () => {
    await openEditor('admin')
    type('One sentence about the club', 'x'.repeat(2000))
    type('How the club meets, in words', 'x'.repeat(500))
    type('Place name', 'x'.repeat(120))
    type('Street address', 'x'.repeat(200))
    type('Note about the place', 'x'.repeat(300))
    type(CONTACT, 'x'.repeat(100))
    type('Club name', 'x'.repeat(120))
    type('Page address', 'a'.repeat(48))
    press()
    await within(status()).findByText(/^Saved/)
    expect(updateClubRequestSchema.safeParse(saves()[0]).success).toBe(true)
    expect(clubPlacesRequestSchema.safeParse({ places: saves()[0].places }).success).toBe(true)
  })
})

describe('the club editor: who may press Save and publish', () => {
  it('sends nothing when an observer presses Save and publish or submits the form', async () => {
    const form = await openEditor('observer')
    expect(form.querySelector('fieldset[disabled]')).not.toBeNull()
    for (const box of form.querySelectorAll<HTMLInputElement>('input, textarea, select')) expect(box.matches(':disabled'), box.id).toBe(true)
    press()
    fireEvent.submit(form)
    await new Promise((done) => setTimeout(done, 20))
    expect(calls()).toEqual([])
    expect(status().textContent).toBe('')
    expect(alertBox().textContent).toBe('')
  })

  it('sends the name, region and page address for an LCA admin only when each is there to send, and never an unchanged address', async () => {
    await openEditor('admin')
    press()
    await within(status()).findByText(/^Saved/)
    const first = sentBodies(`PATCH ${CLUB_URL}`)[0]
    expect(first).toMatchObject({ name: 'Example Chess Club', region: 'Bayou Region' })
    expect(first).not.toHaveProperty('slug')
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: '' } })
    press()
    await waitFor(() => expect(sentBodies(`PATCH ${CLUB_URL}`)).toHaveLength(2))
    expect(sentBodies(`PATCH ${CLUB_URL}`)[1].region).toBeNull()
  })

  it('sends an empty email as null, and a contact name cleared as an empty string', async () => {
    await openEditor('rep')
    type('Email for messages, never shown', '   ')
    type(CONTACT, '')
    press()
    await within(status()).findByText(/^Saved/)
    const { places: sent, ...rest } = saves()[0]
    expect(rest).toEqual({
      aboutText: CLUB.about_text, howWeMeetText: CLUB.how_we_meet_text, contactNamePublic: '', contactEmail: null,
    })
    expect(sent).toHaveLength(2)
  })
})

describe('the club editor: the places it sends', () => {
  it('drops a first place left wholly empty and keeps the second as it was', async () => {
    await openEditor()
    for (const label of ['Place name', 'Street address', 'Note about the place']) type(label, '')
    press()
    await within(status()).findByText(/^Saved/)
    expect(placesOf(saves()[0])).toEqual([{ name: 'Example Hall', street: null, note: 'Saturdays only', point: null }])
    expect(clubPlacesRequestSchema.safeParse({ places: saves()[0].places }).success).toBe(true)
  })

  it('sends no place at all when the club lists one and its words are emptied, and clears today\'s location', async () => {
    serve(CLUB, [PLACE_1])
    await openEditor()
    for (const label of ['Place name', 'Street address', 'Note about the place']) type(label, '')
    press()
    await within(status()).findByText(/^Saved/)
    expect(saves()[0]).toMatchObject({ location: null, places: [] })
    expect(updateClubRequestSchema.safeParse(saves()[0]).success).toBe(true)
    // The boxes stay empty after the save, as the next visit would draw them.
    for (const label of ['Place name', 'Street address', 'Note about the place']) expect(field(label).value).toBe('')
  })

  it('sends no location when a place is kept, or when today\'s location is already empty', async () => {
    await openEditor()
    for (const label of ['Place name', 'Street address', 'Note about the place']) type(label, '')
    press()
    await within(status()).findByText(/^Saved/)
    expect(saves()[0]).not.toHaveProperty('location')
    cleanup()
    seen = []
    serve({ ...CLUB, location: null, latitude: null, longitude: null }, [])
    await openEditor()
    type('One sentence about the club', 'A made-up club that meets to play.')
    press()
    await within(status()).findByText(/^Saved/)
    expect(saves()[0]).not.toHaveProperty('location')
    expect(saves()[0].places).toEqual([])
  })

  it('shows the second place once place 1 of two is emptied and saved, with the pin the save stored, and a second save keeps both, twice over', async () => {
    const server = serve()
    await openEditor()
    expect(screen.getByText('Pin at 30.10000, -91.20000')).toBeTruthy()
    for (const label of ['Place name', 'Street address', 'Note about the place']) type(label, '')
    press()
    await within(status()).findByText(/^Saved/)
    // Today's pin was Example Library's, which went; Example Hall has none, so the pin goes with the place it belonged to.
    expect(saves()[0]).toMatchObject({ places: [{ name: 'Example Hall', street: null, note: 'Saturdays only', point: null }], mapLocation: null })
    expect(saves()[0]).not.toHaveProperty('location')
    expect(server.state.club).toMatchObject({ location: 'Example Hall', latitude: null, longitude: null })
    // The form now shows what the server holds: the second place, moved up, and no pin.
    expect([field('Place name').value, field('Street address').value, field('Note about the place').value]).toEqual(['Example Hall', '', 'Saturdays only'])
    expect(screen.getByText('No pin set')).toBeTruthy()
    for (const round of [2, 3]) {
      type('One sentence about the club', `A made-up club that meets on Saturdays, save ${round}.`)
      press()
      await waitFor(() => expect(saves()).toHaveLength(round))
      await within(status()).findByText(/^Saved/)
      const body = saves()[round - 1]
      // Example Hall goes back exactly as stored: no pin borrowed from the place that went.
      expect(placesOf(body), `save ${round}`).toEqual([{ name: 'Example Hall', street: null, note: 'Saturdays only', point: null }])
      expect(body, `save ${round}`).not.toHaveProperty('location')
      expect(body, `save ${round}`).not.toHaveProperty('mapLocation')
      expect(server.state.places, `save ${round}`).toEqual([expect.objectContaining({ name: 'Example Hall', latitude: null, longitude: null })])
      expect(screen.getByText('No pin set'), `save ${round}`).toBeTruthy()
      expect(field('Place name').value, `save ${round}`).toBe('Example Hall')
    }
  })

  it('keeps a location today longer than a place name may be as it is, and saves the rest, until the person changes Where', async () => {
    const long = 'Example Public Library, Main Branch, 1234 Example Boulevard, Second Floor Meeting Room B, Example City, Louisiana 70000, by the side door'
    expect(long.length).toBeGreaterThan(120)
    serve({ ...CLUB, location: long }, [])
    await openEditor()
    expect(field('Place name').value).toBe(long)
    type('Email for messages, never shown', 'hello@example.org')
    press()
    await within(status()).findByText(/^Saved/)
    expect(field('Place name').getAttribute('aria-invalid')).toBeNull()
    // No place is sent and today's location is not touched, so the email saves and the long location stays.
    expect(saves()[0]).toMatchObject({ contactEmail: 'hello@example.org' })
    expect(saves()[0]).not.toHaveProperty('places')
    expect(saves()[0]).not.toHaveProperty('location')
    expect(updateClubRequestSchema.safeParse(saves()[0]).success).toBe(true)
    expect(field('Place name').value).toBe(long)
    // A second press keeps it too.
    press()
    await waitFor(() => expect(saves()).toHaveLength(2))
    await within(status()).findByText(/^Saved/)
    expect(saves()[1]).not.toHaveProperty('places')
    // Once the person changes Where, the place's own limit applies, in words, and a shorter name is sent as place 1.
    type('Note about the place', 'Room B')
    press()
    expect(await screen.findByText(`Too long: at most 120 characters, and this has ${long.length}.`)).toBeTruthy()
    expect(saves()).toHaveLength(2)
    type('Place name', 'Example Public Library')
    press()
    await waitFor(() => expect(saves()).toHaveLength(3))
    expect(placesOf(saves()[2])).toEqual([{ name: 'Example Public Library', street: null, note: 'Room B', point: { lat: 30.1, lng: -91.2 } }])
  })

  it('sends a removed pin as null, and the pin again once one is pasted', async () => {
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pin' }))
    expect(screen.getByText('No pin set')).toBeTruthy()
    press()
    await within(status()).findByText(/^Saved/)
    expect(placesOf(saves()[0])[0].point).toBeNull()
    type(PIN_LABEL, 'https://maps.example.org/@30.5,-91.25,15z')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    expect(screen.getByText('Pin at 30.50000, -91.25000')).toBeTruthy()
    press()
    await waitFor(() => expect(saves()).toHaveLength(2))
    expect(placesOf(saves()[1])[0].point).toEqual({ lat: 30.5, lng: -91.25 })
  })

  it('refuses a pasted pin with no coordinates in words tied to its box, and keeps the pin it had', async () => {
    await openEditor()
    type(PIN_LABEL, 'near the library')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    const box = field(PIN_LABEL)
    expect(box.getAttribute('aria-invalid')).toBe('true')
    const words = document.getElementById(box.getAttribute('aria-describedby')!)!
    expect(words.textContent).toMatch(/^Couldn.t find coordinates in that\./)
    expect(screen.getByText('Pin at 30.10000, -91.20000')).toBeTruthy()
    // A pin outside the world is refused too, since the save would refuse it.
    type(PIN_LABEL, '95, -91')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    expect(screen.getByText('Pin at 30.10000, -91.20000')).toBeTruthy()
  })

  it('says a pin that has no place name needs one, and sends nothing', async () => {
    serve(CLUB, [])
    serve({ ...CLUB, location: null, latitude: null, longitude: null }, [])
    await openEditor()
    for (const label of ['Place name', 'Street address', 'Note about the place']) expect(field(label).value).toBe('')
    type(PIN_LABEL, '30.4, -91.1')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    press()
    expect(await screen.findByText('A place needs a name.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Place name'))
    expect(calls()).toEqual([])
  })
})

describe('the club editor: failures, races and replays', () => {
  it('says a dropped connection in words, keeps what was typed and never says Saved', async () => {
    routes[`PATCH ${CLUB_URL}`] = () => { throw new TypeError('Failed to fetch') }
    await openEditor()
    type('One sentence about the club', 'Words that must survive a dropped connection.')
    press()
    await waitFor(() => expect(alertBox().textContent).toMatch(/^Nothing was saved: .+\. Everything you typed is still here\.$/))
    expect(field('One sentence about the club').value).toBe('Words that must survive a dropped connection.')
    expect(status().textContent).toBe('')
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
  })

  it('says an unreadable answer by its status, not by the page the edge sent', async () => {
    routes[`PATCH ${CLUB_URL}`] = () => new Response('<html>Bad gateway</html>', { status: 502 })
    await openEditor()
    press()
    await waitFor(() => expect(alertBox().textContent).toBe('Nothing was saved: Request failed (502). Everything you typed is still here.'))
    expect(alertBox().textContent).not.toContain('<')
    expect(status().textContent).toBe('')
  })

  it('says a refusal of a place by its own words, and that nothing was saved', async () => {
    routes[`PATCH ${CLUB_URL}`] = () => json({ error: 'A place needs a name' }, 400)
    await openEditor()
    press()
    await waitFor(() => expect(alertBox().textContent).toBe('Nothing was saved: A place needs a name. Everything you typed is still here.'))
    expect(status().textContent).toBe('')
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
  })

  it('does nothing on a press, an Enter or a submit while the save is under way', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`PATCH ${CLUB_URL}`] = () => new Promise<Response>((done) => { finish = done })
    const form = await openEditor()
    press()
    await waitFor(() => expect(calls()).toEqual([`PATCH ${CLUB_URL}`]))
    press()
    fireEvent.submit(form)
    fireEvent.keyDown(field(CONTACT), { key: 'Enter' })
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(status().textContent).toBe('Saving. The form is read only until the save is done.')
    await act(async () => finish(json({ club: CLUB, places: [PLACE_1, PLACE_2] })))
    await within(status()).findByText(/^Saved/)
    expect(screen.getByRole('button', { name: 'Save and publish' })).toBeTruthy()
    // Once it has finished a press saves again.
    serve()
    press()
    await waitFor(() => expect(calls()).toHaveLength(2))
  })

  it('lets a press through again after a failure under way ends', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`PATCH ${CLUB_URL}`] = () => new Promise<Response>((done) => { finish = done })
    const form = await openEditor()
    press()
    await waitFor(() => expect(calls()).toEqual([`PATCH ${CLUB_URL}`]))
    await act(async () => finish(json({ error: 'The server is busy' }, 503)))
    await waitFor(() => expect(alertBox().textContent).toMatch(/^Nothing was saved: The server is busy\./))
    serve()
    fireEvent.submit(form)
    await within(status()).findByText(/^Saved/)
    expect(alertBox().textContent).toBe('')
  })

  it('sends the same body when a save is replayed, as a second save of the same words', async () => {
    await openEditor()
    type('Place name', 'Example Center')
    press()
    await within(status()).findByText(/^Saved/)
    press()
    await waitFor(() => expect(calls()).toHaveLength(2))
    await within(status()).findByText(/^Saved/)
    expect(saves()[1]).toEqual(saves()[0])
  })

  it('takes "Saved" away when the person types again, and a failure away at the next press', async () => {
    await openEditor()
    press()
    await within(status()).findByText(/^Saved/)
    type(CONTACT, 'Player Four')
    expect(status().textContent).toBe('')
    type('Email for messages, never shown', 'club@example')
    press()
    expect(await screen.findByText('Enter the whole email address, such as name@example.org.')).toBeTruthy()
    expect(alertBox().textContent).toBe('Nothing was saved: one field needs a change.')
    expect(field('Email for messages, never shown').getAttribute('aria-invalid')).toBe('true')
    // Typing in the field takes its error from it.
    type('Email for messages, never shown', 'club@example.org')
    expect(field('Email for messages, never shown').getAttribute('aria-invalid')).toBeNull()
    press()
    await within(status()).findByText(/^Saved/)
    expect(alertBox().textContent).toBe('')
  })

  it('keeps one region for the announcements: a status and an alert, each drawn before any words are in it', async () => {
    const form = await openEditor()
    expect(within(form).getAllByRole('status')).toHaveLength(1)
    expect(within(form).getAllByRole('alert')).toHaveLength(1)
    expect(status().textContent).toBe('')
    expect(alertBox().textContent).toBe('')
  })
})

describe('the club editor: Help where the browser refuses storage', () => {
  it('opens by itself, without breaking the page, where the browser stores nothing but takes the question', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage refused') })
    await openEditor()
    expect(help().hidden).toBe(false)
    fireEvent.keyDown(help(), { key: 'Escape' })
    expect(help().hidden).toBe(true)
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('draws the page and Help from its button where reaching localStorage at all throws', async () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')!
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new DOMException('denied', 'SecurityError') } })
    try {
      await openEditor()
      expect(help().hidden).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Help' }))
      expect(help().hidden).toBe(false)
      expect(document.activeElement).toBe(help())
      fireEvent.keyDown(help(), { key: 'Escape' })
      expect(help().hidden).toBe(true)
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Help' }))
    } finally {
      Object.defineProperty(window, 'localStorage', real)
    }
  })

  it('does not open by itself again once it has, even when it was shut at once, and Escape elsewhere does not shut it', async () => {
    await openEditor()
    expect(window.localStorage.getItem(HELP_SHOWN_KEY)).not.toBeNull()
    fireEvent.keyDown(field('Place name'), { key: 'Escape' })
    expect(help().hidden).toBe(false)
    fireEvent.click(within(help()).getByRole('button', { name: 'Close help' }))
    cleanup()
    await openEditor()
    expect(help().hidden).toBe(true)
  })
})

/** Every piece of words in the page, in a state, as one string. */
const wordsOnPage = () => document.body.textContent ?? ''

/** Each way a time is written in some words, which must all be "7:00 PM". */
function badTimes(words: string): string[] {
  return (words.match(/\b\d{1,2}(?::\d{2})?\s*[ap]\.?m\b\.?/gi) ?? []).filter((t) => !/^\d{1,2}:\d{2} [AP]M$/.test(t))
}

describe('the club editor: plain words', () => {
  it('writes no long dash, no short dash, nothing but US Chess for the federation, and every time as "7:00 PM", in every state the form draws', async () => {
    for (const hidden of [true, false]) {
      for (const person of ['admin', 'rep', 'observer'] as const) {
        flags.clubEmailHidden = hidden
        await openEditor(person)
        press()
        await waitFor(() => expect(/^Saved/.test(status().textContent ?? '') || alertBox().textContent !== '' || person === 'observer').toBe(true))
        const words = wordsOnPage()
        const where = `${person} emailHidden ${hidden}`
        expect(words, where).not.toMatch(DASH)
        expect(words, where).not.toMatch(OLD_NAME)
        expect(badTimes(words), where).toEqual([])
        cleanup()
      }
    }
    // The states of failure and of a refusal before sending too.
    routes[`PATCH ${CLUB_URL}`] = () => json({ error: 'Contact email is not a valid address' }, 400)
    await openEditor('admin')
    type('Page address', 'Bad Address')
    press()
    expect(await screen.findByText('Use lower case letters and digits, joined by single hyphens.')).toBeTruthy()
    expect(wordsOnPage()).not.toMatch(DASH)
    expect(wordsOnPage()).not.toMatch(OLD_NAME)
    type('Page address', 'example-chess')
    press()
    await waitFor(() => expect(alertBox().textContent).toMatch(/^Nothing was saved/))
    expect(wordsOnPage()).not.toMatch(DASH)
    expect(wordsOnPage()).not.toMatch(OLD_NAME)
  })

  it('has Help give its one time as "7:00 PM", and draws no date outside a weekday', async () => {
    await openEditor('admin')
    expect(help().textContent).toContain('"First and third Tuesdays at 7:00 PM"')
    expect(badTimes(help().textContent ?? '')).toEqual([])
    // Nothing in the form or in Help writes a calendar date, so no date lacks its weekday.
    expect(wordsOnPage()).not.toMatch(/\b(January|February|March|April|June|July|August|September|October|November|December)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/)
  })

  it('keeps the editor\'s sources and tests free of the long and short dash, the editor\'s own words free of the old name for US Chess, and any reference to how they were made', () => {
    const files = [
      'src/areas/clubs/components/ClubEditor.tsx', 'src/areas/clubs/components/EditorBasics.tsx', 'src/areas/clubs/components/EditorPlaces.tsx',
      'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/editor.ts', 'test/unit/club-editor.test.tsx', 'test/unit/club-editor-off.test.tsx',
      'test/unit/redesign-status-ws09-step7.test.ts', 'test/unit/helpers/clubSaveServer.ts',
    ]
    for (const file of files) {
      const text = read(file)
      expect(text, file).not.toMatch(/[\u2013\u2014]/)
      // A test's made-up roster row may carry today's column name uscf_id, so the old name is held out of the editor's own words alone.
      if (file.startsWith('src/')) expect(text, file).not.toMatch(OLD_NAME)
      expect(text, file).not.toMatch(MADE_BY)
    }
  })
})

describe('the club editor: in light and in dark', () => {
  /** A palette colour by name, which no token's change for dark would reach. */
  const RAW = /(^|:)(bg|text|border|ring|fill|stroke|divide|outline|decoration|placeholder|from|to|via)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(-\d+)?(\/\d+)?$/

  it('draws no palette colour by name in the form, Help or the editor\'s sources, so every colour follows the page\'s tokens into dark', async () => {
    const form = await openEditor('admin')
    for (const el of [form, ...form.querySelectorAll<HTMLElement>('*')]) {
      const classes = typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : []
      expect(classes.filter((c) => RAW.test(c)), el.tagName).toEqual([])
    }
    for (const file of ['ClubEditor', 'EditorBasics', 'EditorPlaces', 'EditorHelp']) {
      const text = read(`src/areas/clubs/components/${file}.tsx`)
      for (const token of text.match(/['"` ]([a-z:-]+-\w+(?:-\d+)?(?:\/\d+)?)(?=['"` ])/g) ?? []) expect(RAW.test(token.trim().replace(/^['"` ]/, '')), `${file} ${token}`).toBe(false)
    }
  })

  it('names, for every colour the editor takes from a token, a token the page\'s stylesheet defines, for light and for dark', () => {
    const css = read('src/index.css')
    const defined = new Set([...css.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]))
    const used = new Set<string>()
    for (const file of ['ClubEditor', 'EditorBasics', 'EditorPlaces', 'EditorHelp']) {
      for (const m of read(`src/areas/clubs/components/${file}.tsx`).matchAll(/(?:bg|text|border|ring|marker)-(ink|hairline|focus|destructive|muted-foreground|card|input|ring|background|brand-navy|lca-gold|muted-on-light)\b/g)) used.add(m[1])
    }
    expect([...used].sort()).toEqual([...used].sort().filter((t) => defined.has(t)))
    expect(used.has('lca-gold')).toBe(true)
    // The one gold in the editor is the button's ground, with navy words on it, and never a gold word.
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('bg-lca-gold font-semibold text-brand-navy')
    // The dark rules the page already has redefine the tokens the editor leans on.
    expect(css).toMatch(/\.dark \{[\s\S]*--destructive:/)
    expect(css).toMatch(/\.dark \{[\s\S]*--muted-foreground:/)
  })
})

/** Every source file under a folder, as paths from the repository's root. */
function sources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    const path = join(dir, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...sources(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

describe('the club editor: reached only as a chunk', () => {
  it('is imported by no file of the site except as a file fetched when the Details tab draws it', () => {
    const names = ['ClubEditor', 'EditorBasics', 'EditorPlaces', 'EditorHelp', 'editor']
    const holders: string[] = []
    for (const file of sources('src')) {
      const text = read(file)
      for (const name of names) {
        const staticImport = new RegExp(`^\\s*(import|export)\\b[^\\n]*from '@/areas/clubs/(components/)?${name}'`, 'm')
        if (staticImport.test(text)) holders.push(`${relative('src', file)} ${name}`)
      }
    }
    // The editor's own files read one another, and the chunk reads the plain code, which is small; no page or shared file does.
    expect(holders.filter((h) => !/^areas\/clubs\/components\/(ClubEditor|EditorBasics|EditorPlaces|EditorHelp)\.tsx /.test(h))).toEqual([])
    const page = read('src/pages/AdminClubPage.tsx')
    expect(page).toContain("lazy(() => import('@/areas/clubs/components/ClubEditor')")
    expect(page).not.toMatch(/import \{[^}]*\bClubEditor\b[^}]*\} from/)
    expect(page).toMatch(/<Suspense/)
  })

  it('draws the editor\'s chunk by a switch read at each draw, so a page with clubKeepers off never asks for it', () => {
    const page = read('src/pages/AdminClubPage.tsx')
    expect(page).toContain("{tab === 'details' && !keepersOn() && (")
    expect(page).toContain("{tab === 'details' && keepersOn() && (")
  })
})
