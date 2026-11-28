// @vitest-environment jsdom
//
// The small things checkpoint T's review of the whole left, closed after its
// fix round, beside test/unit/club-editor-review.test.tsx. Your club's page
// says a refusal in the one status that said Loading…, and says the editor
// is loading in words a screen reader hears. The editor spells "color" in
// every word a person reads, as today's form does. Help's line on the city
// says what today's page shows while the new club pages are off. The bare
// pin picker draws each refusal afresh, so a second in the same words is
// heard again, and for a person who asks for less motion its map moves to a
// pasted pin at once, in either look, as the Preview chevron stops turning;
// today's map card is as it was. And the editor's link rule refuses what the
// contract now refuses, the two copies giving the same answer. Every name,
// address and club here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { isWebAddress as contractIsWebAddress } from '../../domain/contracts/clubs'

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
// The maps script is never fetched: it is ready at once, and the map and the pin are stand-ins that note how the map moves.
vi.mock('@/areas/clubs/clubMap', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/areas/clubs/clubMap')>()
  return { ...real, loadMapsScript: (_key: string, ready: () => void) => ready() }
})
// The editor's file waits until a case lets it load, so Your club's page can be seen while it loads.
const editorFile = vi.hoisted(() => {
  let open = () => {}
  const ready = new Promise<void>((resolve) => { open = resolve })
  return { ready, open: () => open() }
})
vi.mock('@/areas/clubs/components/ClubEditor', async (importOriginal) => {
  await editorFile.ready
  return importOriginal()
})

const { ClubLocationPicker } = await import('@/areas/clubs/components/ClubLocationPicker')
const { EditorHelpMark } = await import('@/areas/clubs/components/EditorHelp')
const { EditorHelpWords } = await import('@/areas/clubs/helpMarks')
const { AdminClubPage } = await import('@/pages/AdminClubPage')
const { YourClubPage } = await import('@/pages/YourClubPage')
const { isWebAddress } = await import('@/areas/clubs/editor')

const ID = 'example-chess-club'
const SLUG = 'example-chess'
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: SLUG, about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const REST = { officers: [], roster: [], tournaments: [], places: [] }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let routes: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  routes = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const route = routes[`${init?.method ?? 'GET'} ${url}`]
    return route ? route() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function signedIn(role: string, clubId: string | null = null): AuthContextValue {
  return {
    user: { id: 'm-1' }, member: { id: 'm-1', role, club_id: clubId, full_name: 'Player Two' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

describe('Your club\'s page says what it is waiting for and why no club came, in words a screen reader hears', () => {
  it('says a refusal in the status that said Loading…, for each way the server refuses', async () => {
    const cases: Array<[number, string]> = [
      [404, 'No club has this address.'],
      [403, 'This club\'s page is not one you keep, so it cannot be changed here.'],
      [401, 'Your sign-in has ended. Sign in again, then come back to this page.'],
    ]
    for (const [status, words] of cases) {
      routes[`GET /api/admin/clubs/${SLUG}`] = () => json({ error: 'No' }, status)
      render(
        <AuthContext.Provider value={signedIn('lca_admin')}>
          <MemoryRouter initialEntries={[`/my/club/${SLUG}`]}>
            <Routes><Route path="/my/club/:slug" element={<YourClubPage />} /></Routes>
          </MemoryRouter>
        </AuthContext.Provider>,
      )
      // The first draw, before any answer.
      const region = screen.getByRole('status')
      expect(region.textContent, String(status)).toBe('Loading…')
      const said = await screen.findByText(words)
      expect(region.isConnected, String(status)).toBe(true)
      expect(region.contains(said), String(status)).toBe(true)
      expect(screen.getAllByRole('status'), String(status)).toEqual([region])
      expect(screen.getByRole('link', { name: 'Back to all clubs' })).toBeTruthy()
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'The club\'s page' })))
      cleanup()
    }
  })

  it('says the editor is loading in a status, and draws no other status beside it', async () => {
    routes[`GET /api/admin/clubs/${SLUG}`] = () => json({ club: CLUB, ...REST })
    render(
      <AuthContext.Provider value={signedIn('lca_admin')}>
        <MemoryRouter initialEntries={[`/my/club/${SLUG}`]}>
          <Routes><Route path="/my/club/:slug" element={<YourClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const loading = await screen.findByText('Loading the editor…')
    expect(screen.getAllByRole('status')).toEqual([loading])
    editorFile.open()
    expect(await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })).toBeTruthy()
  })
})

describe('the editor spells color as the site does', () => {
  it('says "color" in every label, Help line and checklist item a person reads, and never "colour"', async () => {
    editorFile.open()
    routes[`GET /api/admin/clubs/${ID}`] = () => json({ club: CLUB, ...REST })
    routes[`GET /api/admin/clubs/${ID}/news`] = () => json({ news: [] })
    render(
      <AuthContext.Provider value={signedIn('lca_admin')}>
        <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
          <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    await act(async () => {})
    expect((screen.getByLabelText('Club color') as HTMLInputElement).type).toBe('color')
    expect(screen.getByRole('group', { name: 'Logo and club color' })).toBeTruthy()
    // The color's own mark holds the color's sentence, beside the swatch's label.
    const mark = screen.getByRole('button', { name: 'Help: Club color' })
    fireEvent.click(mark)
    const help = document.getElementById(mark.getAttribute('aria-controls')!) as HTMLElement
    expect(help.hidden).toBe(false)
    expect(within(help).getByText('The club\'s own color. A club with none shows LCA\'s gold.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(within(document.getElementById('club-editor-previews') as HTMLElement).getByText('Club color')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/colour/i)
  })
})

describe('Help\'s line on the city, the same with the new club pages off or on', () => {
  const nameAndAddress = () => {
    const mark = screen.getByRole('button', { name: 'Help: Name and address' })
    return document.getElementById(mark.getAttribute('aria-controls')!)?.textContent ?? ''
  }
  const marks = (pagesOn: boolean) => (
    <EditorHelpWords value={{ own: true, emailHidden: true, pagesOn, showAdmin: false }}>
      <EditorHelpMark part="nameAndAddress" />
    </EditorHelpWords>
  )

  it('says the city shows under the name and helps people find a club near them, in the same words with the new pages off and on', () => {
    // Help no longer says what today's page shows against the new pages' line (K's note), so both states draw the one sentence.
    for (const pagesOn of [false, true]) {
      render(marks(pagesOn))
      const words = nameAndAddress()
      expect(words.startsWith('The city shows under your club\'s name and helps people find a club near them.'), String(pagesOn)).toBe(true)
      expect(words, String(pagesOn)).not.toContain('Baton Rouge')
      cleanup()
    }
  })
})

/** A stand-in for the maps library: the map notes each way it is moved. */
function standInMaps() {
  const moves: string[] = []
  class FakeMap {
    addListener() { return { remove: () => {} } }
    panTo() { moves.push('panTo') }
    setCenter() { moves.push('setCenter') }
    setZoom() {}
  }
  class FakeMarker {
    addListener() { return { remove: () => {} } }
    setPosition() {}
    setDraggable() {}
    setMap() {}
    getPosition() { return null }
  }
  class FakeSize {}
  class FakePoint {}
  vi.stubGlobal('google', { maps: { Map: FakeMap, Marker: FakeMarker, Size: FakeSize, Point: FakePoint, event: { addListenerOnce: () => ({ remove: () => {} }) } } })
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'example-key')
  return moves
}

/** Asks for less motion, or not, as a person's settings would. */
function motion(reduce: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: reduce && query === '(prefers-reduced-motion: reduce)', media: query, addEventListener: () => {}, removeEventListener: () => {} })))
}

async function pasteInto(box: HTMLElement, button: HTMLElement) {
  fireEvent.change(box, { target: { value: '30.4515, -91.1871' } })
  await act(async () => { fireEvent.click(button) })
}

describe('the bare pin picker', () => {
  it('draws each refusal afresh, so a second in the same words is heard again', async () => {
    render(<ClubLocationPicker clubName="Example Chess Club" latitude={30.1} longitude={-91.2} bare={{ inputId: 'editor-point', onChange: vi.fn() }} />)
    const box = screen.getByLabelText('Pin: coordinates or a Google Maps link')
    const use = screen.getByRole('button', { name: 'Use this' })
    for (const [typed, words] of [
      ['', 'Paste coordinates or a Google Maps link in the box first.'],
      ['no numbers here', 'Couldn’t find coordinates in that. Paste something like 30.4515, -91.1871 or a Google Maps link.'],
    ] as const) {
      fireEvent.change(box, { target: { value: typed } })
      await act(async () => { fireEvent.click(use) })
      const first = screen.getByText(words)
      await act(async () => { fireEvent.click(use) })
      const second = screen.getByText(words)
      expect(second, typed).not.toBe(first)
      expect(first.isConnected, typed).toBe(false)
      expect(second.parentElement?.getAttribute('aria-live'), typed).toBe('assertive')
      expect(box.getAttribute('aria-describedby'), typed).toBe(second.id)
    }
  })

  it('moves the map to a pasted pin at once for a person who asks for less motion, in either look, and glides otherwise', async () => {
    for (const newLook of [false, true]) {
      flags.newLook = newLook
      for (const reduce of [true, false]) {
        const moves = standInMaps()
        motion(reduce)
        render(<ClubLocationPicker clubName="Example Chess Club" latitude={30.1} longitude={-91.2} bare={{ inputId: 'editor-point', onChange: vi.fn() }} />)
        await waitFor(() => expect(screen.queryByText('Loading map…')).toBeNull())
        await pasteInto(screen.getByLabelText('Pin: coordinates or a Google Maps link'), screen.getByRole('button', { name: 'Use this' }))
        expect(moves, `newLook ${newLook}, reduce ${reduce}`).toEqual([reduce ? 'setCenter' : 'panTo'])
        cleanup()
        vi.unstubAllGlobals()
        vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Not found' }, 404)))
      }
    }
  })

  it('leaves today\'s map card as it was: it glides to a pasted pin whatever the person asks', async () => {
    const moves = standInMaps()
    motion(true)
    render(<ClubLocationPicker clubName="Example Chess Club" latitude={30.1} longitude={-91.2} onSave={async () => {}} />)
    await waitFor(() => expect(screen.queryByText('Loading map…')).toBeNull())
    await pasteInto(screen.getByLabelText('Coordinates or Google Maps link'), screen.getByRole('button', { name: 'Use this' }))
    expect(moves).toEqual(['panTo'])
  })
})

describe('the Preview chevron', () => {
  it('stops turning for a person who asks for less motion', async () => {
    editorFile.open()
    routes[`GET /api/admin/clubs/${ID}`] = () => json({ club: CLUB, ...REST })
    routes[`GET /api/admin/clubs/${ID}/news`] = () => json({ news: [] })
    render(
      <AuthContext.Provider value={signedIn('lca_admin')}>
        <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
          <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const preview = await screen.findByRole('button', { name: 'Preview' }, { timeout: 5000 })
    const chevron = preview.querySelector('svg') as SVGElement
    expect(chevron.getAttribute('class')).toContain('transition-transform')
    expect(chevron.getAttribute('class')).toContain('motion-reduce:transition-none')
  })
})

describe('the editor\'s link rule, as the contract\'s', () => {
  it('refuses a name or a password before the host, a quote mark, an angle bracket, a backtick and an invisible format mark, as the contract does', () => {
    const refused = [
      'https://facebook.com@example.net/login', 'https://user:pass@example.org/', 'https://user@example.org/',
      'https://example.org/"><script>alert(1)</script>', 'https://example.org/<b>', 'https://example.org/a`b',
      `https://example.org/${String.fromCharCode(0x202e)}`, `https://example.org/a${String.fromCharCode(0x200b)}b`,
    ]
    for (const text of refused) {
      expect(isWebAddress(text), JSON.stringify(text)).toBe(false)
      expect(contractIsWebAddress(text), JSON.stringify(text)).toBe(false)
    }
    const taken = ['https://www.facebook.com/examplechessclub', 'https://example.org/club?night=tuesday#map', 'http://example.org/wiki/O\'Brien', 'https://example.org/caf%C3%A9']
    for (const text of taken) {
      expect(isWebAddress(text), text).toBe(true)
      expect(contractIsWebAddress(text), text).toBe(true)
    }
  })
})
