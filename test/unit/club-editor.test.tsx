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
// column. From WS09 step 8 the rest of the listing joins the same form and
// the same one call: About's count, the name and the city with the page's
// address, a second place with its note and its pin, the cost, who is
// welcome and its two ticks, the three links, and the logo and the colour
// as today's controls; each limit and the links' rule are said in words
// before anything is sent, and what only an LCA admin may change is words
// for anyone else. jsdom draws no layout, so sizes are read from the classes
// through Tailwind's own compile (test/unit/helpers/tailwindPx.ts). Every
// name, address and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import {
  CLUB_PLACE_LIMITS, CLUB_SLUG_FORM, CLUB_SLUG_MAX, CLUB_TEXT_LIMITS, CLUB_TODAY_LIMITS, WEB_ADDRESS_WORDS, isWebAddress as contractIsWebAddress,
  updateClubRequestSchema,
} from '@domain/contracts'
import { RESERVED_SLUGS } from '@domain/clubs/slug'
import { EDITOR_LIMITS, EMAIL_FORM, HELP_SHOWN_KEY, LINK_WORDS, SLUG_FORM, WEB_ADDRESS_FORM, isWebAddress } from '@/areas/clubs/editor'
import { builder, setBy } from './helpers/tailwindPx'
import { clubSaveServer } from './helpers/clubSaveServer'

// Each case may wait up to 5 seconds for the editor's file to load before it
// reads the page, which is the whole of vitest's own budget for a case, so
// this file gives each case 15 seconds.
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
// jsdom draws no picture, so the logo's fitting hands on a small made-up image.
vi.mock('@/lib/resizeImage', () => ({ resizeImageToFit: async () => new Blob(['example'], { type: 'image/jpeg' }) }))

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
  return server
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  seen = []
  serve()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    // The logo goes as an image, every other call as words.
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
  // The editor's file loads on first use, which a busy machine can take more than a second over.
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  // The first draw's effects (Help opening by itself, and its focus) have run before any case reads the page.
  await act(async () => {})
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
    // From WS09 step 8 the second place sits under Where, and the rest of the listing follows the basics in the site's order.
    expect(labelled(form)).toEqual([
      'One sentence about the club', 'How the club meets, in words', 'Place name', 'Street address', 'Note about the place',
      'Pin: coordinates or a Google Maps link', 'Place 2 name', 'Place 2 street address', 'Note about place 2', 'Pin for place 2: coordinates or a Google Maps link',
      CONTACT, 'Email for messages, never shown',
      'Club name', 'City', 'Region', 'Page address', 'Cost', 'Who is welcome', 'The club plays on weekends', 'Scholastic friendly',
      'Facebook page', 'Website', 'Logo', 'Club colour',
    ])
    // The basics before anything else the form holds, and one save.
    expect(form.querySelector('ol')!.compareDocumentPosition(screen.getByRole('group', { name: 'Name and address' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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
    // The pins' boxes, from WS09 step 8 two pins, are read only and, from WS09 step 9, marked shut and not disabled. The two
    // ticks and the colour's swatch, which a read only mark does not hold, are marked shut and not disabled, as the logo's
    // box is, so each keeps the focus.
    const SHUT = 'input[id^="editor-point"]'
    const MARKED = 'input[type="checkbox"], input[type="color"], input[type="file"]'
    for (const box of form.querySelectorAll<HTMLInputElement>('input, textarea')) {
      if (!box.matches(MARKED)) expect(box.readOnly, box.id).toBe(true)
    }
    const shut = [...form.querySelectorAll<HTMLInputElement>(SHUT)]
    expect(shut.map((box) => box.id)).toEqual(['editor-point', 'editor-point-2'])
    for (const box of shut) {
      expect(box.disabled, box.id).toBe(false)
      expect(box.getAttribute('aria-disabled'), box.id).toBe('true')
    }
    const marked = [...form.querySelectorAll<HTMLInputElement>(MARKED)]
    expect(marked.map((box) => box.id)).toEqual(['editor-weekendPlay', 'editor-scholasticFriendly', 'editor-logo', 'editor-color'])
    for (const box of marked) {
      expect(box.getAttribute('aria-disabled'), box.id).toBe('true')
      expect(box.disabled, box.id).toBe(false)
      // A press on it changes nothing and opens no picker while the save runs.
      expect(fireEvent.click(box), box.id).toBe(false)
    }
    expect([tick('The club plays on weekends').checked, tick('Scholastic friendly').checked]).toEqual([false, false])
    // From WS09 step 9 the region's list and the buttons of Where are marked shut, not disabled, so each keeps the focus.
    const region = screen.getByLabelText('Region') as HTMLSelectElement
    expect([region.disabled, region.getAttribute('aria-disabled')]).toEqual([false, 'true'])
    expect(field('Pin: coordinates or a Google Maps link').matches(':disabled')).toBe(false)
    for (const name of ['Remove pin', 'Remove place 2']) {
      const button = screen.getByRole('button', { name })
      expect([button.matches(':disabled'), button.getAttribute('aria-disabled')], name).toEqual([false, 'true'])
    }
    // A change that still reaches a box while the save runs is not taken, so nothing is swapped for the answer unseen.
    type('One sentence about the club', 'Words typed during the save.')
    type('Place name', 'Example Annex')
    // A colour picked or typed while the save runs does not reach the form either.
    fireEvent.change(field('Club colour'), { target: { value: '#2e7d32' } })
    expect(field('One sentence about the club').value).toBe('Words sent with the press.')
    expect(field('Place name').value).toBe('Example Library')
    expect(field('Club colour').value).toBe('#1f4e79')
    await act(async () => finish(json(server.patch(sent))))
    await within(status()).findByText(/^Saved/)
    expect(field('One sentence about the club').value).toBe('Words sent with the press.')
    expect(field('One sentence about the club').readOnly).toBe(false)
    for (const id of ['editor-weekendPlay', 'editor-scholasticFriendly', 'editor-color', 'editor-logo']) {
      const box = document.getElementById(id) as HTMLInputElement
      expect(box.disabled, id).toBe(false)
      expect(box.hasAttribute('aria-disabled'), id).toBe(false)
    }
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
      // The rest of the listing, from WS09 step 8.
      city: CLUB_TODAY_LIMITS.city, place2Name: CLUB_PLACE_LIMITS.name, place2Street: CLUB_PLACE_LIMITS.street, place2Note: CLUB_PLACE_LIMITS.note,
      costText: CLUB_TEXT_LIMITS.costText, welcomeText: CLUB_TEXT_LIMITS.welcomeText, facebookUrl: CLUB_TEXT_LIMITS.facebookUrl,
      websiteUrl: CLUB_TEXT_LIMITS.websiteUrl, otherUrl: CLUB_TEXT_LIMITS.otherUrl,
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
    // From WS09 step 8: About's count, the second place, and the rest of the listing, where what only an LCA admin may change is words.
    expect(wordsOutsideHelp(form)).toEqual([
      'The basics', 'Help', 'One sentence about the club', '51 of 2,000 characters', 'How the club meets, in words', 'Where', 'Place name', 'Street address', 'Note about the place',
      'Pin: coordinates or a Google Maps link', 'Use this', 'Pin at 30.10000, -91.20000', 'Remove pin',
      'Place 2', 'Place 2 name', 'Place 2 street address', 'Note about place 2', 'Pin for place 2: coordinates or a Google Maps link', 'Use this for place 2',
      'No pin set for place 2', 'Remove place 2', CONTACT, 'Email for messages, never shown',
      'Name and address', 'Club name', 'Example Chess Club', 'Kept by LCA admins', 'City', 'Region', 'Bayou Region', 'Kept by LCA admins',
      'Your page\'s address', window.location.host, `/clubs/${ID}`, 'Kept by LCA admins',
      'Cost and who is welcome', 'Cost', 'Who is welcome', 'The club plays on weekends', 'Scholastic friendly',
      'Links', 'Facebook page', 'Website', 'Add another link', 'Logo and club colour', 'Logo', 'No logo yet', 'Club colour', 'Save and publish',
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
    // From WS09 step 8 the admin's three fields sit in Name and address, as boxes.
    const adminWords = wordsOutsideHelp(admin)
    const named = adminWords.indexOf('Name and address')
    expect(adminWords.slice(named, named + 5)).toEqual(['Name and address', 'Club name', 'City', 'Region', 'Your page\'s address'])
    expect(adminWords).toContain('Page address')
    expect(adminWords).not.toContain('Kept by LCA admins')
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
    expect(form.querySelectorAll('table, [role="grid"], [type="date"], [type="number"], [type="time"], [type="datetime-local"]')).toHaveLength(0)
    // From WS09 step 8 the only ticks are the brief's two, and the only file is the logo.
    expect([...form.querySelectorAll('[type="checkbox"]')].map((el) => el.id)).toEqual(['editor-weekendPlay', 'editor-scholasticFriendly'])
    expect([...form.querySelectorAll('[type="file"]')].map((el) => el.id)).toEqual(['editor-logo'])
    expect(form.textContent).not.toMatch(/\b(grade|birth|age|roster|member count|officer|schedule|weekday|calendar|income|need)\b/i)
    expect(labelled(form)).toHaveLength(24)
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
    const rows = [...form.querySelectorAll<HTMLElement>('[type="checkbox"]')].map((box) => box.closest('label')!)
    const rowCss = (await builder())([...new Set(rows.flatMap((el) => [...el.classList]))])
    for (const el of controls) {
      const name = `${el.tagName} ${el.id || el.textContent}`
      // A tick's target is its whole row, its label and its box, from WS09 step 8; the row is the 44px.
      const box = (el as HTMLInputElement).type === 'checkbox' ? el.closest('label')! : el
      const read = box === el ? css : rowCss
      const tall = [...box.classList].map((c) => setBy(read, c, 'min-height') ?? setBy(read, c, 'height')).filter((s) => s && s.media === null)
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

/** Every body the one save sent, in order. */
const patches = () => seen.filter((s) => s.call === `PATCH ${CLUB_URL}`).map((s) => s.body as Record<string, unknown>)
const tick = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const saved = () => within(status()).findByText(/^Saved/)
/** The words under a field, tied to it. */
const errorOf = (label: string) => document.getElementById(`${field(label).id}-error`)?.textContent

/** Addresses the save takes and refuses, for the links' rule: the same answer in the form as in the contract. */
const LINK_SAMPLES = [
  'https://example.org', 'http://example.org', 'HTTPS://EXAMPLE.ORG/Club', 'https://www.facebook.com/examplechessclub', 'https://example.org:8080/a?b=c#d',
  'https://player.one@example.org/', 'http://localhost', 'https://example.org/café',
  'www.example.org', 'example.org', 'http:example.org', 'https:/example.org', 'https:///example.org', 'https://', 'https:// example.org', 'https://exa mple.org',
  'https://example.org\\club', 'https://example.org\tclub', 'ftp://example.org', 'mailto:club@example.org', 'javascript:alert(1)', 'https://:80', '',
]

describe('the club editor: the rest of the listing, in the one call (WS09 step 8)', () => {
  it('saves About\'s longer form through the one call, with its count under the box and what the count means in Help', async () => {
    await openEditor('rep')
    const long = `${'A made-up club that meets to play long games, with a few boards of quick games in the corner. '.repeat(6)}Come once.`
    expect(long.length).toBeGreaterThan(500)
    type('One sentence about the club', long)
    expect(screen.getByText(`${long.length.toLocaleString('en-US')} of 2,000 characters`)).toBeTruthy()
    press()
    await saved()
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(patches()[0].aboutText).toBe(long)
    // Help names the meeting's box by its label, and says both fit only while it is short.
    expect(help().textContent).toContain(
      'A search result shows the start of About and then How the club meets, in words, about 155 characters in all. Keep that box short so both fit.',
    )
    expect(screen.getByLabelText('How the club meets, in words')).toBeTruthy()
    // The count's meaning sits in Help alone.
    expect(wordsOutsideHelp(screen.getByRole('button', { name: 'Save and publish' }).closest('form')!).join('\n')).not.toMatch(/search results|155/)
  })

  it('the two ticks save, with the cost and who is welcome, in the one call, each sent only when it changed', async () => {
    const server = serve()
    await openEditor('representative')
    expect([tick('The club plays on weekends').checked, tick('Scholastic friendly').checked]).toEqual([false, false])
    type('Cost', ' Free. Rated games are $5 toward the room. ')
    type('Who is welcome', 'All ages and all levels. Bring a board if you have one.')
    fireEvent.click(tick('The club plays on weekends'))
    fireEvent.click(tick('Scholastic friendly'))
    press()
    await saved()
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(patches()[0]).toMatchObject({
      costText: ' Free. Rated games are $5 toward the room. ', welcomeText: 'All ages and all levels. Bring a board if you have one.', weekendPlay: true, scholasticFriendly: true,
    })
    expect(updateClubRequestSchema.safeParse(patches()[0]).success).toBe(true)
    expect(server.state.club).toMatchObject({ cost_text: 'Free. Rated games are $5 toward the room.', weekend_play: 1, scholastic_friendly: 1 })
    // The form shows what was stored.
    expect(field('Cost').value).toBe('Free. Rated games are $5 toward the room.')
    expect([tick('The club plays on weekends').checked, tick('Scholastic friendly').checked]).toEqual([true, true])
    // A press that changes none of them sends none of them.
    press()
    await waitFor(() => expect(patches()).toHaveLength(2))
    await saved()
    for (const key of ['costText', 'welcomeText', 'weekendPlay', 'scholasticFriendly']) expect(patches()[1], key).not.toHaveProperty(key)
    // A tick taken off goes as false, alone.
    fireEvent.click(tick('Scholastic friendly'))
    press()
    await waitFor(() => expect(patches()).toHaveLength(3))
    await saved()
    expect(patches()[2].scholasticFriendly).toBe(false)
    expect(patches()[2]).not.toHaveProperty('weekendPlay')
    expect(server.state.club).toMatchObject({ weekend_play: 1, scholastic_friendly: 0 })
  })

  it('the links save: the three, trimmed, in the one call, the third drawn when asked for, and an emptied one clears', async () => {
    const server = serve()
    await openEditor('rep')
    type('Facebook page', ' https://www.facebook.com/examplechessclub ')
    type('Website', 'https://example.org')
    expect(screen.queryByLabelText('Another link')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add another link' }))
    expect(document.activeElement).toBe(field('Another link'))
    type('Another link', 'https://example.org/events')
    press()
    await saved()
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(patches()[0]).toMatchObject({
      facebookUrl: 'https://www.facebook.com/examplechessclub', websiteUrl: 'https://example.org', otherUrl: 'https://example.org/events',
    })
    expect(updateClubRequestSchema.safeParse(patches()[0]).success).toBe(true)
    expect(server.state.club).toMatchObject({ facebook_url: 'https://www.facebook.com/examplechessclub', other_url: 'https://example.org/events' })
    expect(field('Another link').value).toBe('https://example.org/events')
    type('Website', '   ')
    press()
    await waitFor(() => expect(patches()).toHaveLength(2))
    await saved()
    expect(patches()[1].websiteUrl).toBeNull()
    expect(patches()[1]).not.toHaveProperty('facebookUrl')
    expect(patches()[1]).not.toHaveProperty('otherUrl')
    expect(server.state.club).toMatchObject({ website_url: null, facebook_url: 'https://www.facebook.com/examplechessclub' })
  })

  it('refuses in words each link the save would refuse, under its field, before anything is sent', async () => {
    await openEditor('rep')
    fireEvent.click(screen.getByRole('button', { name: 'Add another link' }))
    for (const bad of LINK_SAMPLES.filter((text) => text.trim() !== '' && !contractIsWebAddress(text.trim()))) {
      for (const label of ['Facebook page', 'Website', 'Another link']) {
        type(label, bad)
        press()
        await waitFor(() => expect(errorOf(label), `${label}: ${bad}`).toBe(LINK_WORDS))
        expect(field(label).getAttribute('aria-invalid')).toBe('true')
        type(label, '')
      }
    }
    expect(calls()).toEqual([])
  })

  it('holds the links\' rule equal to the contract\'s, in its written form, its answers and its words', () => {
    expect(read('domain/contracts/clubs.ts')).toContain(`const WEB_ADDRESS_FORM = /${WEB_ADDRESS_FORM.source}/${WEB_ADDRESS_FORM.flags}`)
    for (const text of LINK_SAMPLES) expect(isWebAddress(text), JSON.stringify(text)).toBe(contractIsWebAddress(text))
    expect(LINK_WORDS).toBe(`${WEB_ADDRESS_WORDS}.`)
  })

  it('says each new field\'s limit in words under it before anything is sent, with the focus on the first, and saves within them', async () => {
    await openEditor('rep')
    const over: Array<[string, number]> = [
      ['Place 2 name', 120], ['Place 2 street address', 200], ['Note about place 2', 300], ['City', 120], ['Cost', 300], ['Who is welcome', 1000],
    ]
    for (const [label, max] of over) type(label, 'x'.repeat(max + 1))
    const link = `https://example.org/${'x'.repeat(481)}`
    expect(link.length).toBe(501)
    type('Facebook page', link)
    press()
    await within(alertBox()).findByText('Nothing was saved: 7 fields need a change.')
    expect(calls()).toEqual([])
    for (const [label, max] of [...over, ['Facebook page', 500] as [string, number]]) {
      expect(field(label).getAttribute('aria-invalid'), label).toBe('true')
      expect(errorOf(label), label).toBe(`Too long: at most ${max.toLocaleString('en-US')} characters, and this has ${(max + 1).toLocaleString('en-US')}.`)
    }
    expect(document.activeElement).toBe(field('Place 2 name'))
    for (const [label, max] of over) type(label, 'x'.repeat(max))
    type('Facebook page', link.slice(0, 500))
    press()
    await saved()
    expect(patches()[0]).toMatchObject({ city: 'x'.repeat(120), costText: 'x'.repeat(300), welcomeText: 'x'.repeat(1000), facebookUrl: link.slice(0, 500) })
    expect(updateClubRequestSchema.safeParse(patches()[0]).success).toBe(true)
  })

  it('saves the city for every keeper, and says an emptied city needs one before anything is sent', async () => {
    const server = serve()
    await openEditor('rep')
    expect(field('City').value).toBe('Example City')
    type('City', '   ')
    press()
    expect(await screen.findByText('The club needs a city.')).toBeTruthy()
    expect(calls()).toEqual([])
    type('City', ' Example Town ')
    press()
    await saved()
    expect(patches()[0].city).toBe(' Example Town ')
    expect(server.state.club.city).toBe('Example Town')
    expect(field('City').value).toBe('Example Town')
    // A city left as it was is not sent.
    press()
    await waitFor(() => expect(patches()).toHaveLength(2))
    expect(patches()[1]).not.toHaveProperty('city')
  })

  it('saves place 2 with its note and its point in the one call, folds it away with Remove place 2, and brings it back with Add another place', async () => {
    await openEditor('rep')
    type('Place 2 street address', '2 Example Road')
    type('Note about place 2', ' Tables at the back ')
    type('Pin for place 2: coordinates or a Google Maps link', '30.2, -91.3')
    fireEvent.click(screen.getByRole('button', { name: 'Use this for place 2' }))
    expect(screen.getByText('Pin for place 2 at 30.20000, -91.30000')).toBeTruthy()
    press()
    await saved()
    expect(calls()).toEqual([`PATCH ${CLUB_URL}`])
    expect(placesSent()).toEqual([
      { name: 'Example Library', street: '1 Example Street', note: 'Room B', point: { lat: 30.1, lng: -91.2 } },
      { name: 'Example Hall', street: '2 Example Road', note: 'Tables at the back', point: { lat: 30.2, lng: -91.3 } },
    ])
    // The form shows the second place as stored, its pin drawn afresh from the answer.
    expect(field('Note about place 2').value).toBe('Tables at the back')
    expect(screen.getByText('Pin for place 2 at 30.20000, -91.30000')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove place 2' }))
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add another place' }))
    press()
    await waitFor(() => expect(patches()).toHaveLength(2))
    await saved()
    expect((patches()[1].places as unknown[]).length).toBe(1)
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add another place' }))
    expect(document.activeElement).toBe(field('Place 2 name'))
    // An empty second place is not sent; one with a pin and no name needs a name.
    press()
    await waitFor(() => expect(patches()).toHaveLength(3))
    await saved()
    expect((patches()[2].places as unknown[]).length).toBe(1)
    // The form follows what was stored, so the empty place is folded away again.
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Add another place' }))
    type('Pin for place 2: coordinates or a Google Maps link', '30.2, -91.3')
    fireEvent.click(screen.getByRole('button', { name: 'Use this for place 2' }))
    press()
    expect(await screen.findByText('A place needs a name.')).toBeTruthy()
    expect(document.activeElement).toBe(field('Place 2 name'))
    expect(patches()).toHaveLength(3)
  })

  it('shows the name, the region and the page\'s address to the club\'s rep and the region\'s representative as words LCA admins keep, never as a box, and sends none of them', async () => {
    for (const person of ['rep', 'representative'] as const) {
      const form = await openEditor(person)
      const named = within(form).getByRole('group', { name: 'Name and address' })
      expect(within(named).queryByRole('combobox'), person).toBeNull()
      expect(within(named).queryByLabelText('Club name'), person).toBeNull()
      expect(within(named).queryByLabelText('Page address'), person).toBeNull()
      expect(within(named).getAllByText('Kept by LCA admins'), person).toHaveLength(3)
      expect(within(named).getByText('Example Chess Club')).toBeTruthy()
      expect(within(named).getByText('Bayou Region')).toBeTruthy()
      // The page's address is a link to the page that works today.
      expect(within(named).getByRole('link').getAttribute('href')).toBe(`/clubs/${ID}`)
      press()
      await saved()
      for (const key of ['name', 'region', 'slug']) expect(patches()[0], `${person} ${key}`).not.toHaveProperty(key)
      cleanup()
      seen = []
    }
  })

  it('saves the colour from today\'s swatch in the one call, and uploads a logo at once through today\'s endpoint, never as an address', async () => {
    routes[`POST ${CLUB_URL}/logo`] = () => json({ imageUrl: `/api/clubs/${ID}/logo?v=2` })
    await openEditor('rep')
    expect(field('Club colour').value).toBe('#1f4e79')
    fireEvent.change(field('Club colour'), { target: { value: '#2e7d32' } })
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await within(status()).findByText('Logo saved.')
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`])
    expect(screen.getByAltText('Your club\'s logo').getAttribute('src')).toBe(`/api/clubs/${ID}/logo?v=2`)
    press()
    await saved()
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`])
    expect(patches()[0].color).toBe('#2e7d32')
    expect(patches()[0]).not.toHaveProperty('imageUrl')
    // A file that is not an image is refused in words, and nothing is sent.
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'notes.txt', { type: 'text/plain' })] } })
    expect(await within(alertBox()).findByText('The logo was not saved: choose an image file.')).toBeTruthy()
    expect(calls()).toHaveLength(2)
  })

  it('waits to save while a logo uploads, so the save never writes the old logo back, and says so in words', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finish = done })
    await openEditor('rep')
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    expect(status().textContent).toBe('Uploading the logo. Save and publish waits until it is done.')
    expect(field('Logo').getAttribute('aria-disabled')).toBe('true')
    // A press now is a real press, held, so the button never calls itself unavailable while a logo uploads.
    const button = screen.getByRole('button', { name: 'Save and publish' })
    expect(button.hasAttribute('aria-disabled')).toBe(false)
    // A press while it uploads is held, said in words, and sends nothing yet.
    press()
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`])
    expect(status().textContent).toBe('Uploading the logo. Your changes save as soon as it is done.')
    expect(button.hasAttribute('aria-disabled')).toBe(false)
    // The boxes still take words while the press is held; only a save under way shuts them.
    expect(tick('Scholastic friendly').disabled).toBe(false)
    expect(field('Club colour').disabled).toBe(false)
    // Words typed after the press are part of the held save.
    fireEvent.change(field('Cost'), { target: { value: 'Free for everyone.' } })
    await act(async () => finish(json({ imageUrl: `/api/clubs/${ID}/logo?v=3` })))
    // The one press is enough: the save goes once the upload ends, and both outcomes are said.
    await saved()
    expect(within(status()).getByText('Logo saved.')).toBeTruthy()
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`])
    expect(patches()).toHaveLength(1)
    expect(patches()[0].costText).toBe('Free for everyone.')
    expect(patches()[0]).not.toHaveProperty('imageUrl')
  })

  it('keeps the focus on the logo\'s box while its upload runs, and opens no second picker until it ends', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finish = done })
    await openEditor('rep')
    const box = field('Logo')
    // A keyboard user reaches the box, opens the picker and chooses a file; the focus comes back to the box.
    box.focus()
    expect(document.activeElement).toBe(box)
    expect(fireEvent.click(box)).toBe(true)
    fireEvent.change(box, { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    // The box is marked shut in a way a screen reader reads, and is not disabled, so the focus stays where the person left it.
    expect(box.getAttribute('aria-disabled')).toBe('true')
    expect(box.disabled).toBe(false)
    expect(document.activeElement).toBe(box)
    // A press opens no second picker, and a file that still reaches the box is not taken.
    expect(fireEvent.click(box)).toBe(false)
    fireEvent.change(box, { target: { files: [new File(['example'], 'other.png', { type: 'image/png' })] } })
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`])
    await act(async () => finish(json({ imageUrl: `/api/clubs/${ID}/logo?v=5` })))
    await within(status()).findByText('Logo saved.')
    // Once it ends the box takes a press again, and the focus never left it.
    expect(document.activeElement).toBe(box)
    expect(box.hasAttribute('aria-disabled')).toBe(false)
    expect(fireEvent.click(box)).toBe(true)
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`])
  })

  it('saves a held press even when the logo is refused, and keeps the logo\'s words in view', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finish = done })
    await openEditor('rep')
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    fireEvent.change(field('Cost'), { target: { value: 'Free for everyone.' } })
    press()
    await act(async () => finish(json({ error: 'That file is too large.' }, 400)))
    await saved()
    expect(alertBox().textContent).toContain('The logo was not saved')
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`])
    expect(patches()[0].costText).toBe('Free for everyone.')
  })

  it('sends one call when a second press comes in the moment between the upload\'s end and the held save', async () => {
    let finish: (r: Response) => void = () => {}
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finish = done })
    await openEditor('rep')
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    // The first press is held for the upload.
    press()
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`])
    // The upload ends outside act, so the page does not draw again at once. Pressing again at every
    // turn of the microtask queue, the first press taken as a save rather than held falls after the
    // upload's end and before the draw that runs the held save.
    finish(json({ imageUrl: `/api/clubs/${ID}/logo?v=4` }))
    let presses = 0
    while (!screen.queryByRole('button', { name: 'Saving…' }) && presses < 500) {
      await Promise.resolve()
      press()
      presses += 1
    }
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy()
    await saved()
    await act(async () => {})
    // Both presses are the one save: one call, and one notice for the region's representatives.
    expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`])
    expect(patches()).toHaveLength(1)
    // The save made in that moment is the held one, so the logo's own words stay in view.
    expect(within(status()).getByText('Logo saved.')).toBeTruthy()
  })

  it('keeps the focus where it was when a press shuts the ticks and the swatch, since no press comes from them', async () => {
    let finish: (r: Response) => void = () => {}
    let sent: Record<string, unknown> = {}
    const server = clubSaveServer(CLUB, [PLACE_1, PLACE_2])
    routes[`PATCH ${CLUB_URL}`] = (body) => {
      sent = body as Record<string, unknown>
      return new Promise<Response>((done) => { finish = done })
    }
    await openEditor('rep')
    // Enter on a tick does not send the form, as Enter on the pin's box does not, so a tick is never the focus a press shuts.
    const weekends = tick('The club plays on weekends')
    weekends.focus()
    expect(fireEvent.keyDown(weekends, { key: 'Enter' })).toBe(false)
    expect(document.activeElement).toBe(weekends)
    expect(calls()).toEqual([])
    // A press from the button keeps the focus on the button, which stays a button while the save runs.
    const button = screen.getByRole('button', { name: 'Save and publish' })
    button.focus()
    press()
    await waitFor(() => expect(calls()).toEqual([`PATCH ${CLUB_URL}`]))
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.matches(':disabled')).toBe(false)
    expect(document.activeElement).toBe(button)
    // The ticks and the swatch are marked shut, not disabled.
    const marks = () => [weekends, tick('Scholastic friendly'), field('Club colour')].map((box) => [box.getAttribute('aria-disabled'), box.disabled])
    expect(marks()).toEqual([['true', false], ['true', false], ['true', false]])
    // A tick clicked while the save runs neither moves nor flickers.
    expect(fireEvent.click(tick('Scholastic friendly'))).toBe(false)
    expect(tick('Scholastic friendly').checked).toBe(false)
    await act(async () => finish(json(server.patch(sent))))
    await saved()
    expect(document.activeElement).toBe(button)
    expect(marks()).toEqual([[null, false], [null, false], [null, false]])
  })

  it('keeps the focus on a tick when a press held for the logo starts its save, and the tick takes no press until the save ends', async () => {
    let finishLogo: (r: Response) => void = () => {}
    let finishSave: (r: Response) => void = () => {}
    let sent: Record<string, unknown> = {}
    const server = clubSaveServer(CLUB, [PLACE_1, PLACE_2])
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finishLogo = done })
    routes[`PATCH ${CLUB_URL}`] = (body) => {
      sent = body as Record<string, unknown>
      return new Promise<Response>((done) => { finishSave = done })
    }
    await openEditor('rep')
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    // A press while the logo uploads is held; the person then moves on to a tick.
    press()
    const weekends = tick('The club plays on weekends')
    weekends.focus()
    expect(document.activeElement).toBe(weekends)
    // The upload ends and the held press's save starts, with the focus still on the tick.
    await act(async () => finishLogo(json({ imageUrl: `/api/clubs/${ID}/logo?v=6` })))
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`]))
    expect(status().textContent).toContain('Saving. The form is read only until the save is done.')
    expect(document.activeElement).toBe(weekends)
    expect(weekends.getAttribute('aria-disabled')).toBe('true')
    expect(weekends.disabled).toBe(false)
    // Space reaches a tick as a click, which is stopped while the save runs, so the tick does not change.
    fireEvent.keyDown(weekends, { key: ' ' })
    expect(fireEvent.click(weekends)).toBe(false)
    fireEvent.keyUp(weekends, { key: ' ' })
    expect(weekends.checked).toBe(false)
    expect(document.activeElement).toBe(weekends)
    await act(async () => finishSave(json(server.patch(sent))))
    await saved()
    expect(patches()).toHaveLength(1)
    expect(patches()[0]).not.toHaveProperty('weekendPlay')
    // Once the save ends the tick takes a press again, and the focus never left it.
    expect(document.activeElement).toBe(weekends)
    expect(weekends.hasAttribute('aria-disabled')).toBe(false)
    expect(fireEvent.click(weekends)).toBe(true)
    expect(weekends.checked).toBe(true)
    press()
    await waitFor(() => expect(patches()).toHaveLength(2))
    expect(patches()[1].weekendPlay).toBe(true)
    await act(async () => finishSave(json(server.patch(sent))))
    await saved()
    expect(tick('The club plays on weekends').checked).toBe(true)
  })

  it('keeps the focus on the region\'s list, the pin\'s box and buttons and the second place\'s button when a press held for the logo starts its save, and none of them takes a press until it ends', async () => {
    let finishLogo: (r: Response) => void = () => {}
    let finishSave: (r: Response) => void = () => {}
    let sent: Record<string, unknown> = {}
    const server = clubSaveServer(CLUB, [PLACE_1, PLACE_2])
    routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finishLogo = done })
    routes[`PATCH ${CLUB_URL}`] = (body) => {
      sent = body as Record<string, unknown>
      return new Promise<Response>((done) => { finishSave = done })
    }
    await openEditor('admin')
    const pinBox = field('Pin: coordinates or a Google Maps link')
    fireEvent.change(pinBox, { target: { value: '30.5, -91.5' } })
    fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
    // A press while the logo uploads is held; the person then moves on to the region's list.
    press()
    const region = screen.getByLabelText('Region') as HTMLSelectElement
    region.focus()
    await act(async () => finishLogo(json({ imageUrl: `/api/clubs/${ID}/logo?v=7` })))
    await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`]))
    expect(status().textContent).toContain('Saving. The form is read only until the save is done.')
    // The list keeps the focus; its press and its keys are cancelled, but Tab, and a choice that still arrives is not taken.
    expect(document.activeElement).toBe(region)
    expect([region.disabled, region.getAttribute('aria-disabled')]).toEqual([false, 'true'])
    expect(fireEvent.mouseDown(region)).toBe(false)
    expect(fireEvent.keyDown(region, { key: 'ArrowDown' })).toBe(false)
    expect(fireEvent.keyDown(region, { key: 'Tab' })).toBe(true)
    fireEvent.change(region, { target: { value: 'North Louisiana' } })
    expect(region.value).toBe('Bayou Region')
    expect(document.activeElement).toBe(region)
    // The pin's box keeps the focus and is read only; Enter in it, Use this and Remove pin each do nothing.
    const pinLine = () => screen.getByText(/^Pin at /).textContent
    expect(pinLine()).toBe('Pin at 30.10000, -91.20000')
    pinBox.focus()
    expect([pinBox.disabled, pinBox.readOnly, pinBox.getAttribute('aria-disabled')]).toEqual([false, true, 'true'])
    expect(fireEvent.keyDown(pinBox, { key: 'Enter' })).toBe(false)
    for (const name of ['Use this', 'Remove pin']) {
      const button = screen.getByRole('button', { name }) as HTMLButtonElement
      button.focus()
      expect([button.disabled, button.getAttribute('aria-disabled')], name).toEqual([false, 'true'])
      fireEvent.click(button)
      expect(document.activeElement, name).toBe(button)
    }
    expect(pinLine()).toBe('Pin at 30.10000, -91.20000')
    // Remove place 2 keeps the focus and the second place stays drawn.
    const removePlace = screen.getByRole('button', { name: 'Remove place 2' }) as HTMLButtonElement
    removePlace.focus()
    expect([removePlace.disabled, removePlace.getAttribute('aria-disabled')]).toEqual([false, 'true'])
    fireEvent.click(removePlace)
    expect(document.activeElement).toBe(removePlace)
    expect(field('Place 2 name').value).toBe('Example Hall')
    await act(async () => finishSave(json(server.patch(sent))))
    await saved()
    // The one save sent the region and the pin as they were when it was pressed.
    expect(patches()).toHaveLength(1)
    expect(patches()[0].region).toBe('Bayou Region')
    expect(placesSent()).toHaveLength(2)
    expect(placesSent()[0].point).toEqual({ lat: 30.1, lng: -91.2 })
    // Once the save ends the button takes a press again, and the focus never left it.
    expect(document.activeElement).toBe(removePlace)
    expect(removePlace.hasAttribute('aria-disabled')).toBe(false)
    expect((screen.getByLabelText('Region') as HTMLSelectElement).hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(removePlace)
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add another place' }))
  })
})
