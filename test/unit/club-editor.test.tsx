// @vitest-environment jsdom
//
// The one club editor (src/areas/clubs/components/ClubEditor.tsx), drawn on
// the admin club page's Details tab with clubKeepers on, which this file
// alone turns on, through a getter on the mocked FEATURES. The real page
// runs through the real client with fetch stubbed, so each call is read as
// it would leave the browser. Held here: the five basics come first, in the
// board's order and words, with one Save and publish; one press is one call,
// the listing and its places together, which says "Saved" with the page's
// address once it has saved, and says a failure in words, that nothing was
// saved, while keeping what was typed; after a save the form shows what the
// answer says was stored; while a save runs the boxes are read only and the
// status says so; an emptied About or meeting's words and a removed pin
// clear today's field too; a second press does nothing; an observer's form
// is shut but Help still opens and closes; each limit is the contract's and is said
// before anything is sent; no explaining sentence is drawn outside Help,
// which opens by itself once and remembers; the email's label and Help say
// "never shown" only while clubEmailHidden is on, and the contact name's
// label and Help promise the name and the note on a page only once the new
// club pages are on; nothing beyond the
// listing is asked; and every control is a labelled, ringed, 44px box in one
// column. jsdom draws no layout, so sizes are read from the classes through
// Tailwind's own compile (test/unit/helpers/tailwindPx.ts). Every name,
// address and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { CLUB_PLACE_LIMITS, CLUB_SLUG_FORM, CLUB_SLUG_MAX, CLUB_TEXT_LIMITS, CLUB_TODAY_LIMITS } from '@domain/contracts'
import { RESERVED_SLUGS } from '@domain/clubs/slug'
import { EDITOR_LIMITS, EMAIL_FORM, HELP_SHOWN_KEY, SLUG_FORM } from '@/areas/clubs/editor'
import { builder, setBy } from './helpers/tailwindPx'
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

/** A made-up club as the GET answers it with the server's constant set, its listing's words the same as today's page's. */
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
const REST = {
  officers: [{ id: 'o1', member_id: 'm2', role: 'President', full_name: 'Player One', email: 'player.one@example.org' }],
  roster: [],
  tournaments: [],
}

type Answer = (body: unknown) => Response | Promise<Response>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
interface Seen {
  call: string
  body: unknown
}
let seen: Seen[] = []
let routes: Record<string, Answer> = {}

/**
 * The answers of a server whose constant is set: the GET, and the one save
 * answering what it stored (test/unit/helpers/clubSaveServer.ts). With places
 * null the GET carries none, as an answer with the constant unset does.
 */
function serve(club: Record<string, unknown> = CLUB, places: Array<Record<string, unknown>> | null = [PLACE_1, PLACE_2]) {
  const server = clubSaveServer(club, places ?? [])
  routes = {
    [`GET ${CLUB_URL}`]: () => json({ club, ...REST, ...(places ? { places } : {}) }),
    [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
    [`PATCH ${CLUB_URL}`]: (body) => json(server.patch(body as Record<string, unknown>)),
  }
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
  representative: { role: 'member', id: 'm-region', club_id: null },
} as const
type Person = keyof typeof PEOPLE

/** The admin club page for this person, its Details tab drawn, and the editor's form once its file has loaded. */
async function openEditor(person: Person = 'rep'): Promise<HTMLFormElement> {
  const who = PEOPLE[person]
  const auth = {
    user: { id: who.id }, member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two' }, session: null, role: who.role,
    loading: false, memberLoading: false, seats: [], managedClubs: person === 'representative' ? [{ id: ID, name: 'Example Chess Club' }] : [],
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
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

/** The contact name's label while the new club pages are off, as they are in every case but the one that turns them on. */
const CONTACT = 'Contact name, shown once the new club pages open'
const field = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
const type = (label: string | RegExp, value: string) => fireEvent.change(field(label), { target: { value } })
const press = () => fireEvent.click(screen.getByRole('button', { name: /^(Save and publish|Saving…)$/ }))
const calls = () => seen.map((s) => s.call).filter((c) => !c.startsWith('GET '))
const bodyOf = (call: string) => seen.find((s) => s.call === call)?.body as Record<string, unknown>
/** The places the one save sent. */
const placesSent = () => bodyOf(`PATCH ${CLUB_URL}`).places as Array<Record<string, unknown>>
const help = () => document.getElementById('club-editor-help') as HTMLElement
const helpButton = () => screen.getByRole('button', { name: 'Help' })
const status = () => screen.getByRole('status')
const alertBox = () => screen.getByRole('alert')
/** Each box of the form and the words of its label, in the form's order. */
const labelled = (form: HTMLElement) => [...form.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]), textarea, select')].map((el) => [...(el.labels ?? [])].map((l) => l.textContent).join(' '))

/** Every piece of words the form draws outside Help, in order, as a person reads them. */
function wordsOutsideHelp(form: HTMLElement): string[] {
  const walker = document.createTreeWalker(form, NodeFilter.SHOW_TEXT)
  const words: string[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? ''
    // A box's own text is what was typed, and a select's options are its values, so neither is counted.
    if (text && !node.parentElement?.closest('[data-slot="editor-help"], textarea, select')) words.push(text)
  }
  return words
}

/** The explaining sentences of the boards, as Help gives them: none may appear outside it. */
const EXPLAINING = [
  /shown as About/, /never turns them into dates/, /nothing is looked up/, /come from LCA's club list/, /visitors see/, /never shown on your club's page/,
  /emailed what changed/, /Search results/, /old address keeps working/, /older form/, /characters ·/, /Drag the pin/, /geocoded/, /These stay off the public page/,
]

describe('the club editor: the five basics', () => {
  it('the five basics come first', async () => {
    const form = await openEditor('admin')
    const basics = form.querySelector('ol') as HTMLOListElement
    expect([...basics.children].map((li) => li.tagName)).toEqual(['LI', 'LI', 'LI', 'LI', 'LI'])
    expect(within(basics.children[2] as HTMLElement).getByRole('group', { name: 'Where' })).toBeTruthy()
    expect(labelled(form)).toEqual([
      'One sentence about the club', 'How the club meets, in words', 'Place name', 'Street address', 'Note about the place',
      'Pin: coordinates or a Google Maps link', CONTACT, 'Email for messages, never shown',
      'Club name', 'Region', 'Page address',
    ])
    // The basics before anything else the form holds, and one save.
    expect(form.querySelector('ol')!.compareDocumentPosition(screen.getByRole('group', { name: 'Kept by LCA admins' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(form).getAllByRole('button', { name: /save/i }).map((b) => b.textContent)).toEqual(['Save and publish'])
    expect(form.querySelectorAll('button[type="submit"]')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Club listing' })).toBeTruthy()
  })

  it('starts from the listing\'s own words, else the words today\'s page shows', async () => {
    await openEditor()
    expect(field('One sentence about the club').value).toBe(CLUB.about_text)
    expect(field('How the club meets, in words').value).toBe('Tuesdays at 7:00 PM')
    expect([field('Place name').value, field('Street address').value, field('Note about the place').value]).toEqual(['Example Library', '1 Example Street', 'Room B'])
    expect(field(CONTACT).value).toBe('Player One')
    expect(field('Email for messages, never shown').value).toBe('club@example.org')
    expect(screen.getByText('Pin at 30.10000, -91.20000')).toBeTruthy()
    cleanup()
    // An answer with the server's constant unset carries no new column and no place: the form starts from today's fields.
    serve({ ...CLUB, slug: undefined, about_text: undefined, how_we_meet_text: undefined, contact_name_public: undefined }, null)
    await openEditor()
    expect(field('One sentence about the club').value).toBe(CLUB.description)
    expect(field('Place name').value).toBe('Example Library, 1 Example Street')
    expect(field(CONTACT).value).toBe('')
  })

  it('draws the admin\'s three fields for an LCA admin and an observer alone, and shuts the whole form for an observer', async () => {
    for (const person of ['rep', 'representative'] as const) {
      const form = await openEditor(person)
      expect(within(form).queryByLabelText('Club name'), person).toBeNull()
      expect(within(form).queryByLabelText('Page address'), person).toBeNull()
      cleanup()
    }
    const form = await openEditor('observer')
    expect(within(form).getByLabelText('Page address')).toBeTruthy()
    // Every box and Save sit in a shut fieldset; Help's button stays open to them.
    for (const box of form.querySelectorAll<HTMLElement>('input, textarea, select')) expect(box.matches(':disabled'), box.id).toBe(true)
    expect(screen.getByRole('button', { name: 'Save and publish' }).matches(':disabled')).toBe(true)
    expect(helpButton().matches(':disabled')).toBe(false)
    expect(screen.getByText('View only: you can see everything here, but changes are made by LCA admins.')).toBeTruthy()
  })
})

describe('the club editor: Save and publish', () => {
  it('Save sends the new fields and the places in one call', async () => {
    await openEditor('rep')
    type('One sentence about the club', 'A made-up club that meets to play.')
    type('How the club meets, in words', 'First and third Tuesdays at 7:00 PM')
    type('Place name', 'Example Center')
    type('Street address', '')
    type('Note about the place', 'Upstairs')
    type('Pin: coordinates or a Google Maps link', '30.45, -91.18')
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
    type(CONTACT, 'Player Three')
    type('Email for messages, never shown', '  hello@example.org ')
    press()
    await within(status()).findByText(/^Saved · live at/)
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    // The second place the club lists goes back as it is, since the save replaces every place.
    expect(bodyOf(`PATCH ${CLUB_URL}`)).toEqual({
      aboutText: 'A made-up club that meets to play.', howWeMeetText: 'First and third Tuesdays at 7:00 PM', contactNamePublic: 'Player Three', contactEmail: 'hello@example.org',
      places: [
        { name: 'Example Center', street: null, note: 'Upstairs', point: { lat: 30.45, lng: -91.18 } },
        { name: 'Example Hall', street: null, note: 'Saturdays only', point: null },
      ],
    })
    expect(within(status()).getByRole('link').getAttribute('href')).toBe(`/clubs/${ID}`)
    expect(status().textContent).toBe(`Saved · live at ${window.location.host}/clubs/${ID}`)
    expect(alertBox().textContent).toBe('')
  })

  it('sends an LCA admin\'s name, region and new page address, and none of them for anyone else', async () => {
    await openEditor('admin')
    type('Club name', 'Example City Chess Club')
    fireEvent.change(screen.getByLabelText('Region'), { target: { value: 'Central Louisiana' } })
    type('Page address', 'example-city-chess')
    press()
    await within(status()).findByText(/^Saved/)
    expect(bodyOf(`PATCH ${CLUB_URL}`)).toMatchObject({ name: 'Example City Chess Club', region: 'Central Louisiana', slug: 'example-city-chess' })
    cleanup()
    seen = []
    await openEditor('representative')
    press()
    await within(status()).findByText(/^Saved/)
    expect(Object.keys(bodyOf(`PATCH ${CLUB_URL}`)).sort()).toEqual(['aboutText', 'contactEmail', 'contactNamePublic', 'howWeMeetText', 'places'])
  })

  it('gives the page\'s address by its slug only once the new club pages are on', async () => {
    flags.newClubs = true
    flags.newLook = true
    await openEditor()
    press()
    await within(status()).findByText(/^Saved/)
    expect(within(status()).getByRole('link').getAttribute('href')).toBe('/clubs/example-chess')
  })

  it('says a failure of the listing\'s save beside the form, keeps what was typed, never says Saved and makes no second call', async () => {
    routes[`PATCH ${CLUB_URL}`] = () => json({ error: 'Contact email is not a valid address' }, 400)
    await openEditor()
    type('One sentence about the club', 'Words that must survive a failure.')
    press()
    await within(alertBox()).findByText('Nothing was saved: Contact email is not a valid address. Everything you typed is still here.')
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(field('One sentence about the club').value).toBe('Words that must survive a failure.')
    expect(status().textContent).toBe('')
    expect(screen.queryByText(/^Saved/)).toBeNull()
  })

  it('says a failure of a press that changes the place as nothing saved, keeps what was typed, and the next press sends it all again in one call', async () => {
    routes[`PATCH ${CLUB_URL}`] = () => json({ error: 'A place needs a name' }, 400)
    await openEditor()
    type('One sentence about the club', 'Words that must survive a failure.')
    type('Place name', 'Example Annex')
    press()
    await within(alertBox()).findByText('Nothing was saved: A place needs a name. Everything you typed is still here.')
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(field('Place name').value).toBe('Example Annex')
    expect(field('One sentence about the club').value).toBe('Words that must survive a failure.')
    expect(status().textContent).toBe('')
    expect(alertBox().textContent).not.toMatch(/live/)
    // A press after the failure sends the listing and the place again, together.
    serve()
    press()
    await within(status()).findByText(/^Saved/)
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`, `PATCH ${CLUB_URL}`])
    expect(seen.filter((x) => x.call === `PATCH ${CLUB_URL}`).map((x) => x.body)).toEqual([bodyOf(`PATCH ${CLUB_URL}`), bodyOf(`PATCH ${CLUB_URL}`)])
    expect(placesSent()[0]).toMatchObject({ name: 'Example Annex' })
  })

  it('does nothing on a second press while a save is under way', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`PATCH ${CLUB_URL}`] = () => new Promise<Response>((done) => { finish = done })
    const form = await openEditor()
    press()
    await waitFor(() => expect(calls()).toEqual([`PATCH ${CLUB_URL}`]))
    const button = screen.getByRole('button', { name: 'Saving…' })
    expect(button.getAttribute('aria-disabled')).toBe('true')
    press()
    fireEvent.submit(form)
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    await act(async () => finish(json({ club: CLUB, places: [PLACE_1, PLACE_2] })))
    await within(status()).findByText(/^Saved/)
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
  })

  it('keeps every box read only while a save runs, says so in words, and loses nothing typed', async () => {
    let finish: (r: Response) => void = () => {}
    let sent: Record<string, unknown> = {}
    const server = clubSaveServer(CLUB, [PLACE_1, PLACE_2])
    routes[`PATCH ${CLUB_URL}`] = (body) => {
      sent = body as Record<string, unknown>
      return new Promise<Response>((done) => { finish = done })
    }
    const form = await openEditor('admin')
    type('One sentence about the club', 'Words sent with the press.')
    press()
    await waitFor(() => expect(calls()).toEqual([`PATCH ${CLUB_URL}`]))
    expect(status().textContent).toBe('Saving. The form is read only until the save is done.')
    for (const box of form.querySelectorAll<HTMLInputElement>('input:not([id="editor-point"]), textarea')) expect(box.readOnly, box.id).toBe(true)
    expect((screen.getByLabelText('Region') as HTMLSelectElement).disabled).toBe(true)
    expect(field('Pin: coordinates or a Google Maps link').matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Remove pin' }).matches(':disabled')).toBe(true)
    // A change that still reaches a box while the save runs is not taken, so nothing is swapped for the answer unseen.
    type('One sentence about the club', 'Words typed during the save.')
    type('Place name', 'Example Annex')
    expect(field('One sentence about the club').value).toBe('Words sent with the press.')
    expect(field('Place name').value).toBe('Example Library')
    await act(async () => finish(json(server.patch(sent))))
    await within(status()).findByText(/^Saved/)
    expect(field('One sentence about the club').value).toBe('Words sent with the press.')
    expect(field('One sentence about the club').readOnly).toBe(false)
    // Once it has saved the boxes take words again.
    type('One sentence about the club', 'Words after the save.')
    expect(field('One sentence about the club').value).toBe('Words after the save.')
  })

  it('shows what the answer says was stored once it has saved, the place and its pin included', async () => {
    await openEditor()
    type('One sentence about the club', '   A made-up club with spaces around its words.   ')
    type('Place name', '  Example Center ')
    type('Street address', ' 2 Example Road ')
    type('Note about the place', '   ')
    type(CONTACT, ' Player Three ')
    press()
    await within(status()).findByText(/^Saved/)
    // The save stores each text trimmed, and the form shows it as stored, not as typed.
    expect(field('One sentence about the club').value).toBe('A made-up club with spaces around its words.')
    expect([field('Place name').value, field('Street address').value, field('Note about the place').value]).toEqual(['Example Center', '2 Example Road', ''])
    expect(field(CONTACT).value).toBe('Player Three')
    expect(screen.getByText('Pin at 30.10000, -91.20000')).toBeTruthy()
    // The page's line about differing words is gone, since today's page now holds the same place.
    expect(document.getElementById('editor-placeName-differs')).toBeNull()
  })

  it('clears today\'s description and meeting schedule when About or the meeting\'s words are emptied, and sends neither otherwise', async () => {
    await openEditor()
    type('One sentence about the club', '  ')
    type('How the club meets, in words', '')
    press()
    await within(status()).findByText(/^Saved/)
    const { places: sent, ...rest } = bodyOf(`PATCH ${CLUB_URL}`)
    expect(rest).toEqual({
      aboutText: '  ', howWeMeetText: '', description: null, meetingSchedule: null, contactNamePublic: 'Player One', contactEmail: 'club@example.org',
    })
    expect(sent).toHaveLength(2)
    cleanup()
    seen = []
    // With words in both, today's fields take them by the save's own copy, and the body names neither.
    await openEditor()
    press()
    await within(status()).findByText(/^Saved/)
    expect(bodyOf(`PATCH ${CLUB_URL}`)).not.toHaveProperty('description')
    expect(bodyOf(`PATCH ${CLUB_URL}`)).not.toHaveProperty('meetingSchedule')
  })

  it('clears today\'s pin with the save when the pin is removed, and starts with no pin once both are cleared', async () => {
    const cleared = { ...CLUB, latitude: null, longitude: null }
    await openEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pin' }))
    press()
    await within(status()).findByText(/^Saved/)
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(bodyOf(`PATCH ${CLUB_URL}`)).toMatchObject({ mapLocation: null })
    expect(placesSent()[0]).toMatchObject({ name: 'Example Library', point: null })
    expect(screen.getByText('No pin set')).toBeTruthy()
    // The next visit, from what the save leaves, shows no pin.
    cleanup()
    serve(cleared, [{ ...PLACE_1, latitude: null, longitude: null }, PLACE_2])
    seen = []
    await openEditor()
    expect(screen.getByText('No pin set')).toBeTruthy()
    // A pin left as it was sends no map location.
    press()
    await within(status()).findByText(/^Saved/)
    expect(bodyOf(`PATCH ${CLUB_URL}`)).not.toHaveProperty('mapLocation')
  })

  it('shows one line with both texts where today\'s page shows different words, and none where they agree', async () => {
    serve({ ...CLUB, about_text: 'The listing\'s own words.', description: 'Words saved in the older form.' }, [{ ...PLACE_1, street: null }, PLACE_2])
    const form = await openEditor()
    const lines = within(form).getAllByText('Today\'s page shows different words here').filter((el) => !el.closest('[data-slot="editor-help"]'))
    expect(lines).toHaveLength(2)
    const about = document.getElementById('editor-aboutText-differs') as HTMLElement
    expect(about.textContent).toBe('Today\'s page shows different words hereToday\'s pageWords saved in the older form.This listingThe listing\'s own words.')
    expect(field('One sentence about the club').getAttribute('aria-describedby')).toBe('editor-aboutText-differs')
    const place = document.getElementById('editor-placeName-differs') as HTMLElement
    expect(within(place).getByText('Example Library, 1 Example Street')).toBeTruthy()
    expect(within(place).getByText('Example Library')).toBeTruthy()
    expect(document.getElementById('editor-howWeMeetText-differs')).toBeNull()
  })
})

describe('the club editor: the save\'s own rules, said before anything is sent', () => {
  it('holds each limit equal to the contract\'s, and the email\'s and the address\'s forms equal to the save\'s', () => {
    expect(EDITOR_LIMITS).toEqual({
      aboutText: CLUB_TEXT_LIMITS.aboutText, howWeMeetText: CLUB_TEXT_LIMITS.howWeMeetText, contactNamePublic: CLUB_TEXT_LIMITS.contactNamePublic,
      contactEmail: CLUB_TODAY_LIMITS.contactEmail, name: CLUB_TODAY_LIMITS.name, placeName: CLUB_PLACE_LIMITS.name, placeStreet: CLUB_PLACE_LIMITS.street,
      placeNote: CLUB_PLACE_LIMITS.note, slug: CLUB_SLUG_MAX,
    })
    expect(SLUG_FORM.source).toBe(CLUB_SLUG_FORM.source)
    expect(read('functions/api/admin/clubs/[id].ts')).toContain(`if (body.contactEmail && !/${EMAIL_FORM.source}/.test(body.contactEmail)) {`)
  })

  it('says each field\'s limit in words under it, with the focus on the first, and sends nothing until each is within it', async () => {
    await openEditor('admin')
    const over: Array<[string, number]> = [
      ['One sentence about the club', 2000], ['How the club meets, in words', 500], ['Place name', 120], ['Street address', 200], ['Note about the place', 300],
      [CONTACT, 100], ['Club name', 120],
    ]
    for (const [label, max] of over) type(label, 'x'.repeat(max + 1))
    press()
    await within(alertBox()).findByText('Nothing was saved: 7 fields need a change.')
    expect(calls()).toEqual([])
    for (const [label, max] of over) {
      const box = field(label)
      const words = `Too long: at most ${max.toLocaleString('en-US')} characters, and this has ${(max + 1).toLocaleString('en-US')}.`
      expect(box.getAttribute('aria-invalid'), label).toBe('true')
      expect(document.getElementById(box.getAttribute('aria-describedby')!.split(' ').pop()!)?.textContent, label).toBe(words)
    }
    expect(document.activeElement).toBe(field('One sentence about the club'))
    for (const [label, max] of over) type(label, 'x'.repeat(max))
    press()
    await within(status()).findByText(/^Saved/)
    expect((bodyOf(`PATCH ${CLUB_URL}`).aboutText as string).length).toBe(2000)
  })

  it('refuses the email and the page address the save would refuse, in words, and a place with no name', async () => {
    await openEditor('admin')
    type('Email for messages, never shown', 'club@example')
    type('Page address', 'Example Club')
    type('Place name', '')
    press()
    expect(await screen.findByText('Enter the whole email address, such as name@example.org.')).toBeTruthy()
    expect(screen.getByText('Use lower case letters and digits, joined by single hyphens.')).toBeTruthy()
    expect(screen.getByText('A place needs a name.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Place name'))
    for (const slug of RESERVED_SLUGS) {
      type('Page address', slug)
      press()
      expect(await screen.findByText('That address is kept for the club pages\' own use.'), slug).toBeTruthy()
    }
    type('Page address', 'x'.repeat(49))
    press()
    expect(await screen.findByText('Too long: at most 48 characters, and this has 49.')).toBeTruthy()
    type('Page address', '')
    press()
    expect(await screen.findByText('The page needs an address.')).toBeTruthy()
    expect(calls()).toEqual([])
  })
})

describe('the club editor: Help', () => {
  it('Help opens once by itself', async () => {
    await openEditor()
    expect(help().hidden).toBe(false)
    expect(helpButton().getAttribute('aria-expanded')).toBe('true')
    expect(helpButton().getAttribute('aria-controls')).toBe('club-editor-help')
    expect(document.activeElement).toBe(help())
    expect(window.localStorage.getItem(HELP_SHOWN_KEY)).toBe('shown')
    // Escape shuts it and the focus goes back to its button.
    fireEvent.keyDown(help(), { key: 'Escape' })
    expect(help().hidden).toBe(true)
    expect(document.activeElement).toBe(helpButton())
    cleanup()
    // The next visit on this device starts with Help shut; the button opens it and Close help shuts it.
    await openEditor()
    expect(help().hidden).toBe(true)
    fireEvent.click(helpButton())
    expect(help().hidden).toBe(false)
    expect(document.activeElement).toBe(help())
    fireEvent.click(within(help()).getByRole('button', { name: 'Close help' }))
    expect(help().hidden).toBe(true)
    expect(document.activeElement).toBe(helpButton())
  })

  it('works where the browser refuses storage: Help starts shut and opens from its button', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage refused') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage refused') })
    await openEditor()
    expect(help().hidden).toBe(true)
    fireEvent.click(helpButton())
    expect(help().hidden).toBe(false)
  })

  it('opens and shuts Help for an observer after its first showing, though the form is shut to them', async () => {
    await openEditor('observer')
    expect(help().hidden).toBe(false)
    fireEvent.click(within(help()).getByRole('button', { name: 'Close help' }))
    expect(help().hidden).toBe(true)
    expect(document.activeElement).toBe(helpButton())
    cleanup()
    // The next visit starts with Help shut, and its button opens it.
    await openEditor('observer')
    expect(help().hidden).toBe(true)
    expect(helpButton().matches(':disabled')).toBe(false)
    fireEvent.click(helpButton())
    expect(help().hidden).toBe(false)
    expect(document.activeElement).toBe(help())
    const close = within(help()).getByRole('button', { name: 'Close help' })
    expect(close.matches(':disabled')).toBe(false)
    fireEvent.click(close)
    expect(help().hidden).toBe(true)
    expect(document.activeElement).toBe(helpButton())
  })

  it('no explaining sentence outside Help', async () => {
    const form = await openEditor('rep')
    expect(wordsOutsideHelp(form)).toEqual([
      'The basics', 'Help', 'One sentence about the club', 'How the club meets, in words', 'Where', 'Place name', 'Street address', 'Note about the place',
      'Pin: coordinates or a Google Maps link', 'Use this', 'Pin at 30.10000, -91.20000', 'Remove pin', CONTACT,
      'Email for messages, never shown', 'Save and publish',
    ])
    for (const words of EXPLAINING) expect(wordsOutsideHelp(form).join('\n'), String(words)).not.toMatch(words)
    // Nothing explains in a placeholder or a title either.
    expect(form.querySelectorAll('[placeholder], [title]')).toHaveLength(0)
    // Help holds the boards' sentences.
    for (const words of [/shown as About/, /never turns them into dates/, /nothing is looked up/, /emailed what changed/, /never shown on your club's page/]) {
      expect(help().textContent, String(words)).toMatch(words)
    }
    // One press sends one email, so Help no longer warns of two.
    expect(help().textContent).not.toMatch(/two such emails|two emails/)
    cleanup()
    const admin = await openEditor('admin')
    expect(wordsOutsideHelp(admin).slice(-5)).toEqual(['Kept by LCA admins', 'Club name', 'Region', 'Page address', 'Save and publish'])
    for (const words of EXPLAINING) expect(wordsOutsideHelp(admin).join('\n'), String(words)).not.toMatch(words)
    expect(help().textContent).toMatch(/old address keeps working/)
  })

  it('the email\'s label and Help say never shown only while clubEmailHidden is on', async () => {
    await openEditor()
    expect(screen.getByLabelText('Email for messages, never shown')).toBeTruthy()
    expect(help().textContent).toContain('It is never shown on your club\'s page or to visitors.')
    cleanup()
    flags.clubEmailHidden = false
    const form = await openEditor()
    expect(screen.getByLabelText('Email for messages, shown on your club\'s page today')).toBeTruthy()
    expect(form.textContent).not.toMatch(/never shown/i)
    expect(help().textContent).toContain('Today\'s club page shows this address to visitors.')
    // The order the switches go on in keeps clubKeepers off until clubEmailHidden is on.
    expect(read('src/areas/clubs/switches.ts')).toContain('if (features.clubKeepers && !features.clubEmailHidden) {')
  })

  it('the contact name\'s label and Help promise a page shows the contact name and the note only once the new club pages are on', async () => {
    const form = await openEditor()
    expect(screen.getByLabelText(CONTACT)).toBeTruthy()
    expect(screen.queryByLabelText('Contact name shown on the page')).toBeNull()
    const off = help().textContent ?? ''
    expect(off).toContain('Today\'s club page does not show it.')
    expect(off).toContain('the note shows once the new club pages open.')
    expect(off).toContain('the contact name and the place\'s note show once the new club pages open.')
    expect(off).not.toContain('Your changes go live on your club\'s page at once.')
    expect(off).not.toMatch(/visitors see beside Contact/)
    expect(form.textContent).not.toMatch(/visitors see/)
    cleanup()
    flags.newClubs = true
    flags.newLook = true
    await openEditor()
    expect(screen.getByLabelText('Contact name shown on the page')).toBeTruthy()
    const on = help().textContent ?? ''
    expect(on).toContain('The name visitors see beside Contact on your club\'s page.')
    expect(on).toContain('Your changes go live on your club\'s page at once.')
    expect(on).not.toMatch(/once the new club pages open|does not show it/)
  })
})

describe('the club editor: what it asks and how it is drawn', () => {
  it('it collects no grade, birthdate, roster or schedule table', async () => {
    const form = await openEditor('admin')
    expect(form.querySelectorAll('table, [role="grid"], [type="date"], [type="number"], [type="time"], [type="datetime-local"], [type="checkbox"], [type="file"]')).toHaveLength(0)
    expect(form.textContent).not.toMatch(/\b(grade|birth|age|roster|member count|officer|schedule|weekday|calendar|income|need)\b/i)
    expect(labelled(form)).toHaveLength(11)
    press()
    await within(status()).findByText(/^Saved/)
    const sent = [...Object.keys(bodyOf(`PATCH ${CLUB_URL}`)), ...Object.keys(placesSent()[0])]
    expect(sent.sort()).toEqual(['aboutText', 'contactEmail', 'contactNamePublic', 'howWeMeetText', 'name', 'note', 'places', 'point', 'region', 'street', 'name'].sort())
  })

  it('makes every control at least 44px tall at every width, with a visible ring on focus and a label tied to each box', async () => {
    const form = await openEditor('admin')
    const controls = [...form.querySelectorAll<HTMLElement>('input, textarea, select, button, a')]
    expect(controls.length).toBeGreaterThan(12)
    const css = (await builder())([...new Set(controls.flatMap((el) => [...el.classList]))])
    for (const el of controls) {
      const name = `${el.tagName} ${el.id || el.textContent}`
      const tall = [...el.classList].map((c) => setBy(css, c, 'min-height') ?? setBy(css, c, 'height')).filter((s) => s && s.media === null)
      expect(Math.max(0, ...tall.map((s) => s!.px)), name).toBeGreaterThanOrEqual(44)
      expect(el.className, name).toMatch(/focus-visible:ring/)
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) expect((el as HTMLInputElement).labels?.length, name).toBe(1)
    }
    press()
    const link = await within(status()).findByRole('link')
    const linkCss = (await builder())([...link.classList])
    expect(setBy(linkCss, 'min-h-11', 'min-height')).toEqual({ px: 44, media: null })
    expect(link.className).toContain('min-h-11')
  })

  it('draws one column in the same order at every width, and only token colours, no gold word', async () => {
    const form = await openEditor('admin')
    const all = [form, ...form.querySelectorAll<HTMLElement>('*')]
    for (const el of all) {
      const classes = typeof el.className === 'string' ? el.className.split(/\s+/) : []
      expect(classes.filter((c) => /grid-cols-|(^|:)order-|reverse/.test(c)), el.tagName).toEqual([])
      const boxes = el.querySelectorAll('input, textarea, select, button').length
      if (classes.includes('flex') && boxes >= 2) expect(classes, el.outerHTML.slice(0, 80)).toContain('flex-col')
    }
    for (const file of ['ClubEditor', 'EditorBasics', 'EditorPlaces', 'EditorHelp']) {
      const text = read(`src/areas/clubs/components/${file}.tsx`)
      expect(text, file).not.toMatch(/text-lca-gold|text-gold|#c8a94a|\[#|style=\{/)
    }
  })

  it('makes no call of its own and imports only types from domain/contracts', () => {
    for (const file of ['ClubEditor', 'EditorBasics', 'EditorPlaces', 'EditorHelp']) {
      const text = read(`src/areas/clubs/components/${file}.tsx`)
      expect(text, file).not.toMatch(/\bfetch\(/)
      for (const line of text.split('\n').filter((l) => /from '@domain\/contracts/.test(l))) expect(line, file).toMatch(/^import type /)
    }
    expect(read('src/areas/clubs/editor.ts')).not.toMatch(/@domain\/contracts|\bfetch\(/)
    const api = read('src/areas/clubs/api.ts')
    expect(api).toContain('import type { AdminClubResponse, ClubPlace, UpdateClubRequest } from \'@domain/contracts\'')
    // One call for one press: the client no longer reaches the places' own endpoint.
    expect(api).not.toContain('/places`')
    const added = JSON.parse(read('test/unit/fixtures/api-added-since-split.json')) as { paths: string[]; exports: Record<string, string> }
    expect(added.paths).not.toContain('/api/admin/clubs/*/places')
    expect(added.exports).not.toHaveProperty('saveClubPlaces')
    for (const name of ['saveClubListing', 'ApiClubListing', 'ApiClubPlace']) expect(added.exports[name], name).toBe('clubs')
  })
})
