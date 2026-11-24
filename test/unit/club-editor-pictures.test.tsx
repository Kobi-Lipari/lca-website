// @vitest-environment jsdom
//
// What the pictures of checkpoint T's pages, taken with the switches on,
// showed wrong, and the last of the review's small things, closed before the
// gate. Your club's page reads a stamp with no saver as no save, as
// migration 0067 leaves every club, calls the page the person's own only
// when the club is theirs, and its link to today's page carries no mark of a
// new tab. The editor keeps the parts of the rest of the listing apart, puts
// the third number on "Where", says under the swatch when no club color is
// chosen, says in the box beside today's words what a save does to them, and
// lets Tab into its box without pushing the page's heading under the site's
// header, moving no focus and no box of its own when a person opens a mark
// of Help. Help's sentences on the page's
// address say what today's site does while the new club pages are off. An
// address of another form is refused in the status that said Loading…. The
// link's refusal says what to do, true whatever the reason. And the admin club page
// asked for at a club's page address moves to the club's id's address
// before it draws, since every other call on it takes the id. Every name,
// address and club here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { WEB_ADDRESS_WORDS, isWebAddress as contractIsWebAddress } from '../../domain/contracts/clubs'

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

const { AdminClubPage } = await import('@/pages/AdminClubPage')
const { YourClubPage } = await import('@/pages/YourClubPage')
const { EditorHelpMark } = await import('@/areas/clubs/components/EditorHelp')
const { EditorHelpWords } = await import('@/areas/clubs/helpMarks')
const { LINK_WORDS, isWebAddress } = await import('@/areas/clubs/editor')

const ID = 'example-chess-club'
const SLUG = 'example-chess'
/** The seed's stamp: 2:35 PM UTC on Saturday, November 14, 2026, with no saver and no check, as migration 0067 leaves every club. */
const SEEDED = { told_updated_at: '2026-11-14 14:35:00', told_by: null as string | null, last_confirmed_at: null as string | null, confirmed_by: null as string | null }
/** A keeper's save: 1:00 AM UTC on Sunday, November 15, 2026, which is 7:00 PM the evening before in Central time. */
const SAVED = { told_updated_at: '2026-11-15 01:00:00', told_by: 'm-rep', last_confirmed_at: '2026-11-15 01:00:00', confirmed_by: 'm-rep' }
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79' as string | null, image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: SLUG, about_text: 'A friendly made-up club that meets every week.', how_we_meet_text: 'Tuesdays at 7:00 PM in Room B',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, ...SEEDED,
}
const REST = { officers: [], roster: [], tournaments: [], places: [] }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let routes: Record<string, (body: unknown) => Response | Promise<Response>> = {}
let asked: string[] = []

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  routes = {}
  asked = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push(call)
    const route = routes[call]
    return route ? route(typeof init?.body === 'string' ? JSON.parse(init.body) : undefined) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

type Person = 'rep' | 'representative' | 'admin'
function signedIn(person: Person): AuthContextValue {
  const who = {
    rep: { id: 'm-rep', role: 'club_rep', club_id: ID, managed: [] as string[] },
    representative: { id: 'm-region', role: 'member', club_id: null, managed: [ID] },
    admin: { id: 'm-admin', role: 'lca_admin', club_id: null, managed: [] as string[] },
  }[person]
  return {
    user: { id: who.id }, member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two' }, session: null, role: who.role,
    loading: false, memberLoading: false, seats: [], managedClubs: who.managed.map((id) => ({ id, name: 'Example Chess Club', region: 'Bayou Region' })),
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

/** Where the router is, and how it got there. */
function Where() {
  const location = useLocation()
  const how = useNavigationType()
  return <output data-testid="where">{`${how} ${location.pathname}${location.search}`}</output>
}

function openYourClub(person: Person, path = `/my/club/${SLUG}`) {
  render(
    <AuthContext.Provider value={signedIn(person)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/my/club/:slug" element={<YourClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
function openAdminClub(path = `/admin/clubs/${ID}`) {
  render(
    <AuthContext.Provider value={signedIn('admin')}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function editorDrawn() {
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  await act(async () => {})
  return save
}
/** The club's answer by its id and by its page address. */
function serveClub(club: Record<string, unknown>) {
  routes[`GET /api/admin/clubs/${ID}`] = () => json({ club, ...REST })
  routes[`GET /api/admin/clubs/${SLUG}`] = () => json({ club, ...REST })
  routes[`GET /api/admin/clubs/${ID}/news`] = () => json({ news: [] })
}
const hero = () => screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement

describe('Your club\'s page says a save only when a keeper made one', () => {
  it('reads the seed\'s stamp with no saver as no save, a keeper\'s save as one, and a save whose saver has since gone as one too', async () => {
    serveClub(CLUB)
    openYourClub('rep')
    await editorDrawn()
    expect(within(hero()).getByText('Not saved here yet.')).toBeTruthy()
    expect(within(hero()).queryByText(/Last saved/)).toBeNull()
    cleanup()

    serveClub({ ...CLUB, ...SAVED })
    openYourClub('rep')
    await editorDrawn()
    expect(within(hero()).getByText('Last saved Sat, Nov 14, 2026 at 7:00 PM.')).toBeTruthy()
    cleanup()

    // A member's delete clears told_by and keeps the check's date, so the save still reads as one.
    serveClub({ ...CLUB, ...SAVED, told_by: null, confirmed_by: null })
    openYourClub('rep')
    await editorDrawn()
    expect(within(hero()).getByText('Last saved Sat, Nov 14, 2026 at 7:00 PM.')).toBeTruthy()
  })

  it('moves from "Not saved here yet." to the save\'s own words once the editor\'s save answers with its saver', async () => {
    serveClub(CLUB)
    routes[`PATCH /api/admin/clubs/${ID}`] = (body) => {
      // The form read the seed's stamp, and sends it with the save.
      expect((body as Record<string, unknown>).toldUpdatedAt).toBe(SEEDED.told_updated_at)
      return json({ club: { ...CLUB, contact_name_public: 'Player Four', ...SAVED }, places: [] })
    }
    openYourClub('rep')
    const save = await editorDrawn()
    expect(within(hero()).getByText('Not saved here yet.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Contact name, shown once the new club pages open'), { target: { value: 'Player Four' } })
    await act(async () => { fireEvent.click(save) })
    await waitFor(() => expect(within(hero()).getByText('Last saved Sat, Nov 14, 2026 at 7:00 PM.')).toBeTruthy())
    expect(within(hero()).queryByText('Not saved here yet.')).toBeNull()
  })
})

describe('Your club\'s page is called the person\'s own only when the club is theirs', () => {
  it('says "Your club\'s page" and "See your page" to the club\'s rep, with the title in step and no mark of a new tab', async () => {
    serveClub(CLUB)
    openYourClub('rep')
    await editorDrawn()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Your club\'s page'])
    expect(document.title).toBe('Your club\'s page: Example Chess Club | Louisiana Chess Association')
    const link = screen.getByRole('link', { name: 'See your page' })
    expect(link.getAttribute('href')).toBe(`/clubs/${ID}`)
    expect(link.getAttribute('target')).toBeNull()
    expect(link.querySelector('svg')).toBeNull()
  })

  it('says "The club\'s page" and "See the club\'s page" to a representative let in by the region and to an LCA admin', async () => {
    for (const person of ['representative', 'admin'] as const) {
      serveClub(CLUB)
      openYourClub(person)
      await editorDrawn()
      expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent), person).toEqual(['The club\'s page'])
      expect(document.title, person).toBe('The club\'s page: Example Chess Club | Louisiana Chess Association')
      expect(screen.queryByRole('link', { name: 'See your page' }), person).toBeNull()
      const link = screen.getByRole('link', { name: 'See the club\'s page' })
      expect(link.getAttribute('href'), person).toBe(`/clubs/${ID}`)
      expect(link.querySelector('svg'), person).toBeNull()
      expect(document.body.textContent, person).not.toContain('Your club\'s page')
      cleanup()
    }
  })

  it('says an address of another form in the status that first said Loading…, and never sends it', async () => {
    openYourClub('admin', '/my/club/example.chess')
    // The first draw, before the refusal.
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('Loading…')
    const said = await screen.findByText('No club has this address.')
    expect(region.isConnected).toBe(true)
    expect(region.contains(said)).toBe(true)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })))
    expect(asked).toEqual([])
  })
})

/** The admin club page's editor, for an LCA admin. */
async function openEditor(club: Record<string, unknown> = CLUB) {
  serveClub(club)
  openAdminClub()
  await editorDrawn()
}
const part = (name: string) => screen.getByRole('group', { name })

describe('the editor as the pictures showed it', () => {
  it('sets no margin of its own on a part of the rest of the listing, so the parent\'s gap keeps each part\'s name off the box above it', async () => {
    await openEditor()
    const parts = ['Name and address', 'Cost and who is welcome', 'Links', 'Logo and club color'].map(part)
    const rest = parts[0].parentElement as HTMLElement
    expect(rest.className.split(/\s+/)).toContain('space-y-6')
    for (const fieldset of parts) {
      expect(fieldset.parentElement).toBe(rest)
      expect(fieldset.className.split(/\s+/).filter((c) => /^-?(?:m|my|mt|mb)-/.test(c)), fieldset.getAttribute('class') ?? '').toEqual([])
    }
  })

  it('puts the third number on "Where", the first thing in its item, and keeps the place\'s group named "Where"', async () => {
    await openEditor()
    const basics = screen.getByLabelText('One sentence about the club').closest('ol') as HTMLOListElement
    const third = basics.children[2] as HTMLElement
    // The item's first line is "Where" with its mark after it, outside the words that name the group.
    const line = third.firstElementChild?.firstElementChild as HTMLElement
    expect(line.textContent).toBe('Where')
    expect(line.tagName).toBe('P')
    const group = within(third).getByRole('group', { name: 'Where' })
    expect(group.getAttribute('aria-labelledby')).toBe(line.id)
    expect(group.querySelector(':scope > legend')).toBeNull()
  })

  it('says under the swatch that no club color is chosen yet while that is so, with the label on its own line', async () => {
    for (const color of [null, '#c8a94a']) {
      await openEditor({ ...CLUB, color })
      const swatch = screen.getByLabelText('Club color') as HTMLInputElement
      const none = screen.getByText('No club color chosen yet')
      expect(swatch.getAttribute('aria-describedby'), String(color)).toBe(none.id)
      expect(swatch.nextElementSibling, String(color)).toBe(none)
      // The label's line, with the color's mark after the label, is a block of its own above the swatch.
      const label = document.querySelector('label[for="editor-color"]') as HTMLElement
      expect(label.parentElement?.tagName, String(color)).toBe('DIV')
      expect(label.parentElement?.nextElementSibling, String(color)).toBe(swatch)
      // A color picked in the swatch is the club's own, so the line goes.
      fireEvent.change(swatch, { target: { value: '#2e7d32' } })
      expect(screen.queryByText('No club color chosen yet'), String(color)).toBeNull()
      expect(swatch.getAttribute('aria-describedby'), String(color)).toBeNull()
      cleanup()
    }
    await openEditor()
    expect(screen.queryByText('No club color chosen yet')).toBeNull()
  })

  it('says in the box beside today\'s words what saving does to them, and Help says it at length', async () => {
    await openEditor()
    const box = document.getElementById('editor-howWeMeetText-differs') as HTMLElement
    expect(within(box).getByText('Saving puts this listing\'s words on today\'s page.')).toBeTruthy()
    const marks = screen.getAllByRole('button', { name: 'Help: Today\'s page shows different words here' })
    expect(marks).toHaveLength(2)
    const words = document.getElementById(marks[1].getAttribute('aria-controls')!) as HTMLElement
    expect(box.parentElement?.contains(marks[1])).toBe(true)
    expect(words.textContent).toBe('Today\'s club page shows its own, shorter words where this listing holds the words written for the new club pages, or words changed in the older form since. Any save, even of one other field, puts this listing\'s words on today\'s page in place of today\'s, so read both before you save.')
  })

  it('moves no focus and opens no bubble on a first visit, and lets Tab into its box without the page\'s jump', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    await openEditor()
    expect(focus).not.toHaveBeenCalled()
    for (const bubble of document.querySelectorAll<HTMLElement>('[data-slot="help-mark-bubble"]')) expect(bubble.hidden).toBe(true)
    // The box Tab stops on first: a scroll margin of a whole window tells the browser it is in view while any of it is.
    expect(screen.getByRole('region', { name: 'Club listing' }).className.split(/\s+/)).toContain('scroll-mt-[100vh]')
  })

  it('leaves the editor\'s box where the keeper scrolled it when a mark is pressed, and moves no focus', async () => {
    await openEditor()
    const box = screen.getByRole('region', { name: 'Club listing' })
    // A keeper has scrolled the box down to the private email.
    box.scrollTop = 300
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const email = within(box).getByRole('button', { name: 'Help: Email for messages' })
    fireEvent.click(email)
    expect(document.getElementById(email.getAttribute('aria-controls')!)!.hidden).toBe(false)
    expect(box.scrollTop).toBe(300)
    expect(focus).not.toHaveBeenCalled()
  })
})

describe('Help\'s sentences on the page\'s address follow the new club pages', () => {
  /** The words of the mark named for a part, drawn with the editor's four choices. */
  const sentence = (term: string) => {
    const mark = screen.getByRole('button', { name: `Help: ${term}` })
    return document.getElementById(mark.getAttribute('aria-controls')!)?.textContent ?? ''
  }
  const marks = (pagesOn: boolean) => (
    <EditorHelpWords value={{ own: true, emailHidden: true, pagesOn, showAdmin: true }}>
      <EditorHelpMark part="nameAndAddress" />
      <EditorHelpMark part="adminFields" />
    </EditorHelpWords>
  )

  it('says what today\'s site does while the new club pages are off, and what the new pages do once they are on', () => {
    render(marks(false))
    const off = `${sentence('Name and address')}\n${sentence('Club name, region and page address')}`
    for (const untrue of ['made from the club\'s name the first time the page is saved', 'the part after /clubs/', 'the old address keeps working']) expect(off, untrue).not.toContain(untrue)
    expect(sentence('Name and address')).toContain('Today\'s club page keeps the address shown under "Your page\'s address", which stays the same if the club is renamed, so links and search results keep working.')
    expect(sentence('Club name, region and page address')).toBe('Only LCA admins change these. The page address is used once the new club pages open; today\'s club page keeps its own address, which does not change.')
    cleanup()

    render(marks(true))
    expect(sentence('Name and address')).toContain('Your page\'s address is made from the club\'s name the first time the page is saved')
    expect(sentence('Club name, region and page address')).toContain('The page address is the part after /clubs/ in the club page\'s address; when it changes, the old address keeps working.')
  })
})

describe('the link\'s refusal says what to do, true whatever the reason', () => {
  it('leads with what to do in one short sentence, the contract\'s words and the editor\'s copy alike, for every link the rule refuses', () => {
    expect(LINK_WORDS).toBe(`${WEB_ADDRESS_WORDS}.`)
    expect(LINK_WORDS).toBe('Paste the whole web address copied from the browser\'s address bar, starting with https:// or http://.')
    // One sentence, with no list of rules in it.
    expect(LINK_WORDS.split(/[.!?](?:\s|$)/).filter(Boolean)).toHaveLength(1)
    expect(LINK_WORDS).not.toMatch(/\bno (?:spaces|name)\b|angle brackets|hidden characters/)
    const refused = [
      'example.org/club', 'www.example.org', 'https://example.org/our club', 'https://name@example.org/', 'https://name:secret@example.org/',
      'https://example.org/club"', 'https://example.org/`club`', 'https://example.org/<club>', `https://example.org/${String.fromCharCode(0x202e)}bulc`,
      'https://example.org\\club', 'https:///example.org', 'http://example.org:99999/', 'not a link',
    ]
    for (const link of refused) {
      expect(isWebAddress(link), link).toBe(false)
      expect(contractIsWebAddress(link), link).toBe(false)
    }
    // What a browser's address bar gives, which the words ask for, passes both.
    for (const link of ['https://example.org/club', 'http://example.org/', 'https://www.example.org/clubs/example-chess?day=tuesday#when', 'https://example.org/our%20club', 'https://example.org/@example-chess']) {
      expect(isWebAddress(link), link).toBe(true)
      expect(contractIsWebAddress(link), link).toBe(true)
    }
  })
})

describe('the admin club page at a club\'s page address', () => {
  it('moves to the club\'s id\'s address in place of the one asked for, with its tab, and asks every other call by the id', async () => {
    serveClub(CLUB)
    openAdminClub(`/admin/clubs/${SLUG}?tab=news`)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`REPLACE /admin/clubs/${ID}?tab=news`))
    await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' }, { timeout: 5000 })
    expect(screen.queryByText('Club not found')).toBeNull()
    // The club is asked for again by its id, and its news by its id.
    expect(asked.slice(asked.indexOf(`GET /api/admin/clubs/${ID}`))).toEqual([`GET /api/admin/clubs/${ID}`, `GET /api/admin/clubs/${ID}/news`])
    expect(asked.filter((call) => call === `GET /api/admin/clubs/${SLUG}` || call.startsWith(`GET /api/admin/clubs/${SLUG}/`))).toEqual([`GET /api/admin/clubs/${SLUG}`, `GET /api/admin/clubs/${SLUG}/news`])
  })

  it('stays where it is at the club\'s id, asking once for the club and once for its news', async () => {
    serveClub(CLUB)
    openAdminClub(`/admin/clubs/${ID}`)
    await screen.findByRole('heading', { level: 1, name: 'Manage Example Chess Club' }, { timeout: 5000 })
    expect(screen.getByTestId('where').textContent).toBe(`POP /admin/clubs/${ID}`)
    expect(asked.filter((call) => call.startsWith('GET /api/admin/clubs/'))).toEqual([`GET /api/admin/clubs/${ID}`, `GET /api/admin/clubs/${ID}/news`])
  })

  it('says the news\'s refusal as before when the club answers for its own id', async () => {
    serveClub(CLUB)
    routes[`GET /api/admin/clubs/${ID}/news`] = () => json({ error: 'Example refusal' }, 403)
    openAdminClub(`/admin/clubs/${ID}`)
    expect(await screen.findByText('Example refusal', undefined, { timeout: 5000 })).toBeTruthy()
  })
})
