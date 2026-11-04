// @vitest-environment jsdom
//
// The two pages the new footer's links reach into (WS02 step 8), each
// reading its link only with the chrome on (newNav and newLook), drawn under
// a router with the switches set through a mocked FEATURES:
//
// - the contact page, src/pages/ContactPage.tsx: ?subject=club and
//   ?subject=membership, the addresses of the footer's List or update your
//   club and Membership help, fill the subject field with those entries'
//   own labels, read back from src/lib/nav.ts so the two cannot drift; any
//   other value, or none, leaves it empty, as today; a new address while
//   the page stays fills it again, and the person's own words stay until
//   the address changes; with the chrome off, in each of the three mixes
//   that leave it off, the field is empty whatever the address says. Since
//   WS02 step 9 a new address while the page stays also resets the board
//   seat from its own ?to=, empty when it names none, with the chrome on,
//   and leaves the seat as first read with it off;
// - the clubs page, src/pages/ClubsPage.tsx: its map's wrapper is given
//   id="map", and an address that ends in #map, the footer's Club map,
//   brings it into view once the clubs are drawn, at once and from its top,
//   and again for a new arrival there; with the chrome off it has no id and
//   the page never scrolls to it, as today.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubListItem } from '@/lib/api'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
      get newNav() {
        return flags.newNav
      },
    },
  }
})
/** Two made-up clubs, as GET /api/clubs answers. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', meeting_schedule: 'Tuesdays at 7:00 PM', color: '#1f4e79', image_url: null, region: 'South Central Louisiana', latitude: 30.45, longitude: -91.19 },
  { id: 'c2', name: 'Fixture North Chess Club', city: 'Monroe', meeting_schedule: 'Fridays at 6:30 PM', color: null, image_url: null, region: 'North Louisiana', latitude: 32.51, longitude: -92.12 },
]
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  // Two board seats, so the contact page's seat can be read in its Send to list.
  getBoardSeats: async () => [
    { id: 's1', slug: 'president', role: 'President', category: 'officer', sort_order: 1, is_shared: 0, holder_name: 'Fixture Holder', holder_count: 1 },
    { id: 's2', slug: 'treasurer', role: 'Treasurer', category: 'officer', sort_order: 2, is_shared: 0, holder_name: 'Fixture Keeper', holder_count: 1 },
  ],
  getClubs: async () => CLUBS,
}))
// The map needs Google's script; its wrapper is what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ContactPage } = await import('@/pages/ContactPage')
const { ClubsPage } = await import('@/pages/ClubsPage')
const { navEntry, navLabel } = await import('@/lib/nav')

/** The three mixes of newLook and newNav that leave the chrome off. */
const CHROME_OFF = [
  { newLook: false, newNav: false },
  { newLook: true, newNav: false },
  { newLook: false, newNav: true },
] as const
const mixName = (mix: { newLook: boolean; newNav: boolean }) => `newLook ${mix.newLook ? 'on' : 'off'} and newNav ${mix.newNav ? 'on' : 'off'}`

/** Each element scrollIntoView was called on, with what it was given. */
let scrolled: Array<{ el: Element; options: unknown }> = []

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true })
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
    scrolled.push({ el: this, options })
  }
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  // The seat's cases set the page's own address, which the page reads ?to= from as it first draws.
  window.history.replaceState(null, '', '/')
})

// ── The contact page ───────────────────────────────────────────────────────

/** The contact page at an address, with links to other addresses on the same page, as the footer is. */
function drawContact(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
      <Link to="/contact?subject=membership">to membership help</Link>
      <Link to="/contact?subject=club">to the club form</Link>
      <Link to="/contact">to the contact page alone</Link>
      <Link to="/contact?to=treasurer">to the treasurer</Link>
    </MemoryRouter>,
  )
}
const subject = () => screen.getByLabelText('Subject') as HTMLInputElement
/** The board seat the message goes to, as the Send to list shows it. */
const seat = () => (screen.getByLabelText('Send to') as HTMLSelectElement).value
/** The contact page at an address that names a seat, the page's own address set to it as a browser's would be, once the seats are in. */
async function drawAtSeat(path: string) {
  window.history.replaceState(null, '', path)
  drawContact(path)
  await screen.findByRole('option', { name: /Treasurer/ })
}

describe('the contact page with the chrome on', () => {
  it('fills the subject from the footer\'s two links, their addresses and their words read from their entries', () => {
    for (const id of ['listClub', 'membershipHelp'] as const) {
      const entry = navEntry(id)
      expect(entry.href!.startsWith('/contact?subject=')).toBe(true)
      drawContact(entry.href!)
      expect(subject().value, id).toBe(navLabel(id))
      cleanup()
    }
    expect([navEntry('listClub').href, navEntry('membershipHelp').href]).toEqual(['/contact?subject=club', '/contact?subject=membership'])
    expect([navLabel('listClub'), navLabel('membershipHelp')]).toEqual(['List or update your club', 'Membership help'])
  })

  it.each(['/contact', '/contact?subject=', '/contact?subject=other', '/contact?subject=Club', '/contact?subject=toString', '/contact?to=president'])('leaves the subject empty at %s, as today', (path) => {
    drawContact(path)
    expect(subject().value).toBe('')
  })

  it('fills it again from a new address while the page stays, keeps the person\'s own words through an address that names no subject, and replaces them when one names a subject', () => {
    drawContact('/contact')
    expect(subject().value).toBe('')
    fireEvent.click(screen.getByText('to membership help'))
    expect(subject().value).toBe('Membership help')
    fireEvent.change(subject(), { target: { value: 'A question about my renewal' } })
    fireEvent.click(screen.getByText('to the contact page alone'))
    expect(subject().value).toBe('A question about my renewal')
    fireEvent.click(screen.getByText('to the club form'))
    expect(subject().value).toBe('List or update your club')
  })

  it('resets the board seat from each new address while the page stays: empty for one that names no seat, the one named otherwise (WS02 step 9)', async () => {
    await drawAtSeat('/contact?to=president')
    expect(seat()).toBe('president')
    expect(screen.getByText('Your message will go to the President.')).toBeTruthy()
    fireEvent.click(screen.getByText('to the club form'))
    expect(seat()).toBe('')
    expect(subject().value).toBe('List or update your club')
    expect(screen.getByText('Reach the board, or ask a general question.')).toBeTruthy()
    fireEvent.click(screen.getByText('to the treasurer'))
    expect(seat()).toBe('treasurer')
    expect(screen.getByText('Your message will go to the Treasurer.')).toBeTruthy()
    // The subject the club form filled stays, since this address names none.
    expect(subject().value).toBe('List or update your club')
  })
})

describe('the contact page with the chrome off', () => {
  it.each(CHROME_OFF.map((mix) => [mixName(mix), mix] as const))('with %s, the seat stays as the page first read it through a new address (WS02 step 9)', async (_name, mix) => {
    Object.assign(flags, mix)
    await drawAtSeat('/contact?to=president')
    expect(seat()).toBe('president')
    fireEvent.click(screen.getByText('to the treasurer'))
    expect(seat()).toBe('president')
    expect(screen.getByText('Your message will go to the President.')).toBeTruthy()
  })

  it.each(CHROME_OFF.map((mix) => [mixName(mix), mix] as const))('with %s, the subject is empty whatever the address says, and a new address fills nothing', (_name, mix) => {
    Object.assign(flags, mix)
    for (const path of ['/contact?subject=club', '/contact?subject=membership', '/contact']) {
      drawContact(path)
      expect(subject().value, path).toBe('')
      fireEvent.click(screen.getByText('to membership help'))
      expect(subject().value, `${path}, then a link`).toBe('')
      cleanup()
    }
  })
})

// ── The clubs page ─────────────────────────────────────────────────────────

/**
 * The clubs page at an address, with a link to its map on the same page, as the footer is, once its clubs are drawn and
 * what the page does after they are drawn has had its turn: the clubs arrive outside any act, so the effect that scrolls
 * runs a moment after they show.
 */
async function drawClubs(path: string) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clubs" element={<ClubsPage />} />
      </Routes>
      <Link to={navEntry('clubMap').href!}>Club map</Link>
    </MemoryRouter>,
  )
  await screen.findAllByText('Fixture Capital Chess Club')
  await act(async () => {})
  return view
}
/** The map's wrapper: the element the page scrolls a phone to when a club is picked. */
const mapWrap = (container: HTMLElement) => container.querySelector('.scroll-mt-20') as HTMLElement

describe('the clubs page with the chrome on', () => {
  it('gives the map\'s wrapper id="map" and, at the footer\'s Club map address, brings it into view from its top, at once, once the clubs are drawn', async () => {
    expect(navEntry('clubMap').href).toBe('/clubs#map')
    const { container } = await drawClubs('/clubs#map')
    const wrap = mapWrap(container)
    expect(wrap.id).toBe('map')
    expect(document.getElementById('map')).toBe(wrap)
    await waitFor(() => expect(scrolled).toEqual([{ el: wrap, options: { block: 'start' } }]))
  })

  it('scrolls to nothing on /clubs with no hash, or with another hash, though the wrapper keeps its id', async () => {
    for (const path of ['/clubs', '/clubs#list', '/clubs?club=c1']) {
      const { container } = await drawClubs(path)
      expect(mapWrap(container).id, path).toBe('map')
      expect(scrolled, path).toEqual([])
      cleanup()
    }
  })

  it('brings the map into view again for a new arrival at #map, as a second press of the link', async () => {
    const { container } = await drawClubs('/clubs#map')
    await waitFor(() => expect(scrolled).toHaveLength(1))
    await act(async () => {
      fireEvent.click(screen.getByText('Club map'))
    })
    expect(scrolled).toHaveLength(2)
    expect(scrolled[1]).toEqual({ el: mapWrap(container), options: { block: 'start' } })
  })
})

describe('the clubs page with the chrome off', () => {
  it.each(CHROME_OFF.map((mix) => [mixName(mix), mix] as const))('with %s, the map\'s wrapper has no id and #map scrolls nothing, as today', async (_name, mix) => {
    Object.assign(flags, mix)
    const { container } = await drawClubs('/clubs#map')
    expect(mapWrap(container).hasAttribute('id')).toBe(false)
    expect(document.getElementById('map')).toBeNull()
    expect(scrolled).toEqual([])
    await act(async () => {
      fireEvent.click(screen.getByText('Club map'))
    })
    expect(scrolled).toEqual([])
  })
})
