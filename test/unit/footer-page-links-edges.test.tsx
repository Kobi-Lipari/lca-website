// @vitest-environment jsdom
//
// The two pages the new footer's links reach into, at their edges (WS02
// step 8), drawn under a router with the switches set through a mocked
// FEATURES, newLook on throughout so the chrome turns on and off with newNav
// alone and nothing else of the page moves with it:
//
// - the contact page, src/pages/ContactPage.tsx: a subject asked for beside
//   a board seat (?to=), both read; the first of two subjects; a name or a
//   value written another way; the same link pressed twice, which fills
//   nothing over the person's own words while the address stays the same;
//   the Back button, which fills the subject from the address it returns
//   to; and, byte for byte, the page with the chrome on at /contact the same
//   as with it off, and with it off the same whatever subject the address
//   asks for;
// - the clubs page, src/pages/ClubsPage.tsx: no scroll before the clubs are
//   drawn and one once they are; none when they cannot be had; none for a
//   hash that is not #map exactly; one for #map beside a club asked for; a
//   club picked after the scroll, which drops #map from the address and
//   brings only the page's own scroll on a phone and none on a wide screen;
//   a new arrival at #map after leaving it; the page's one id="map"; and,
//   byte for byte, the page with the chrome on the same as with it off but
//   for that id.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
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
/** What GET /api/clubs answers next, when a test holds it back or refuses it; the two clubs otherwise. */
const answers = vi.hoisted(() => ({ clubs: null as null | (() => Promise<unknown>) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getBoardSeats: async () => [
    { id: 's1', slug: 'president', role: 'President', category: 'officer', sort_order: 1, is_shared: 0, holder_name: 'Fixture Holder', holder_count: 1 },
  ],
  getClubs: () => (answers.clubs ? answers.clubs() : Promise.resolve(CLUBS)),
}))
// The map needs Google's script; its wrapper is what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ContactPage } = await import('@/pages/ContactPage')
const { ClubsPage } = await import('@/pages/ClubsPage')
const { navEntry, navLabel } = await import('@/lib/nav')

/** Each element scrollIntoView was called on, with what it was given. */
let scrolled: Array<{ el: Element; options: unknown }> = []

/** A stand-in for matchMedia that answers min-width queries for a window of this width. */
function stubWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const m = /^\(min-width: ([\d.]+)px\)$/.exec(query.trim())
    return { matches: m ? width >= Number(m[1]) : false, media: query, addEventListener() {}, removeEventListener() {} }
  })
}

/** A Back button, as the browser's own, for a page drawn under the router. */
function Back() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate(-1)}>
      Back
    </button>
  )
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true })
  answers.clubs = null
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element, options?: unknown) {
    scrolled.push({ el: this, options })
  }
  stubWidth(390)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

// ── The contact page ───────────────────────────────────────────────────────

/** The contact page at an address, with the footer's two links on the same page and a Back button. */
function drawContact(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
      <Link to={navEntry('membershipHelp').href!}>{navLabel('membershipHelp')}</Link>
      <Link to={navEntry('listClub').href!}>{navLabel('listClub')}</Link>
      <Link to="/contact">the contact page alone</Link>
      <Back />
    </MemoryRouter>,
  )
}
const subject = () => screen.getByLabelText('Subject') as HTMLInputElement
/** Waits for the board seats to arrive, which the page loads as it opens. */
const seatsIn = () => screen.findByRole('option', { name: /President/ })

describe('the contact page with the chrome on, at its edges', () => {
  it('reads a subject asked for beside a board seat: the subject from the footer\'s link, the seat from ?to= as today', async () => {
    window.history.replaceState(null, '', '/contact?subject=club&to=president')
    drawContact('/contact?subject=club&to=president')
    await seatsIn()
    expect(subject().value).toBe('List or update your club')
    expect((screen.getByLabelText('Send to') as HTMLSelectElement).value).toBe('president')
    expect(screen.getByText('Your message will go to the President.')).toBeTruthy()
  })

  it.each([
    ['the first of two subjects', '/contact?subject=membership&subject=club', 'Membership help'],
    ['a subject written with an escaped letter', '/contact?subject=%63lub', 'List or update your club'],
    ['a subject with a hash after it', '/contact?subject=club#form', 'List or update your club'],
    ['a subject beside another query', '/contact?ref=footer&subject=membership', 'Membership help'],
    ['the name of the query in capitals', '/contact?Subject=club', ''],
    ['the value in capitals', '/contact?subject=MEMBERSHIP', ''],
    ['the value with a space after it', '/contact?subject=club%20', ''],
    ['the label itself as the value', '/contact?subject=Membership%20help', ''],
  ] as const)('%s: %s fills the subject with %j', async (_case, path, words) => {
    drawContact(path)
    await seatsIn()
    expect(subject().value).toBe(words)
  })

  it('fills nothing over the person\'s own words when the same link is pressed again, the address the same, and fills it again from another link', async () => {
    drawContact('/contact')
    await seatsIn()
    fireEvent.click(screen.getByRole('link', { name: 'Membership help' }))
    expect(subject().value).toBe('Membership help')
    fireEvent.click(screen.getByRole('link', { name: 'Membership help' }))
    expect(subject().value).toBe('Membership help')
    fireEvent.change(subject(), { target: { value: 'My renewal from last spring' } })
    fireEvent.click(screen.getByRole('link', { name: 'Membership help' }))
    expect(subject().value).toBe('My renewal from last spring')
    fireEvent.click(screen.getByRole('link', { name: 'List or update your club' }))
    expect(subject().value).toBe('List or update your club')
  })

  it('fills the subject from the address the Back button returns to', async () => {
    drawContact('/contact?subject=club')
    await seatsIn()
    expect(subject().value).toBe('List or update your club')
    fireEvent.click(screen.getByRole('link', { name: 'Membership help' }))
    expect(subject().value).toBe('Membership help')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(subject().value).toBe('List or update your club')
  })
})

describe('the contact page, byte for byte', () => {
  /** The page's markup at an address once its seats have arrived. */
  async function contactMarkup(path: string): Promise<string> {
    const { container } = drawContact(path)
    await seatsIn()
    const html = container.innerHTML
    cleanup()
    return html
  }

  it('is the same at /contact with the chrome on as with it off: the chrome adds nothing to a page whose address asks for no subject', async () => {
    flags.newNav = false
    const off = await contactMarkup('/contact')
    flags.newNav = true
    const on = await contactMarkup('/contact')
    expect(on).toBe(off)
  })

  it.each(['/contact?subject=club', '/contact?subject=membership', '/contact?subject=club&ref=footer#form'])('with the chrome off is the same at %s as at /contact, whatever the address asks for', async (path) => {
    flags.newNav = false
    const plain = await contactMarkup('/contact')
    expect(await contactMarkup(path)).toBe(plain)
  })
})

// ── The clubs page ─────────────────────────────────────────────────────────

/** The clubs page at an address, with a link to its map and one to the page alone on the same page. */
function drawClubs(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/clubs" element={<ClubsPage />} />
      </Routes>
      <Link to={navEntry('clubMap').href!}>{navLabel('clubMap')}</Link>
      <Link to="/clubs">the clubs page alone</Link>
    </MemoryRouter>,
  )
}
/** Waits for the clubs to be drawn, and for what the page does once they are, its scroll among it, to be done. */
async function clubsDrawn() {
  await screen.findAllByText('Fixture Capital Chess Club')
  await act(async () => {})
}
/** The map's wrapper: the element the page scrolls a phone to when a club is picked. */
const mapWrap = (container: HTMLElement) => container.querySelector<HTMLElement>('.scroll-mt-20')
/** The instant scrolls to the map's wrapper the address asked for, apart from the page's own smooth ones. */
const hashScrolls = () => scrolled.filter((s) => JSON.stringify(s.options) === JSON.stringify({ block: 'start' }))

describe('the clubs page with the chrome on, at its edges', () => {
  it('scrolls to nothing while the clubs are still on their way, and to the map once they are drawn', async () => {
    let arrive: (clubs: ApiClubListItem[]) => void = () => {}
    answers.clubs = () => new Promise((done) => {
      arrive = done as (clubs: ApiClubListItem[]) => void
    })
    const { container } = drawClubs('/clubs#map')
    expect(screen.getByText('Loading clubs…')).toBeTruthy()
    expect(mapWrap(container)).toBeNull()
    expect(scrolled).toEqual([])
    await act(async () => {
      arrive(CLUBS)
    })
    await clubsDrawn()
    expect(scrolled).toEqual([{ el: mapWrap(container), options: { block: 'start' } }])
  })

  it('scrolls to nothing, and draws no map and no id, when the clubs cannot be had', async () => {
    answers.clubs = () => Promise.reject(new Error('The clubs could not be loaded.'))
    const { container } = drawClubs('/clubs#map')
    await screen.findByText('The clubs could not be loaded.')
    await act(async () => {})
    expect(mapWrap(container)).toBeNull()
    expect(document.getElementById('map')).toBeNull()
    expect(scrolled).toEqual([])
  })

  it.each(['/clubs#Map', '/clubs#MAP', '/clubs#map2', '/clubs#list', '/clubs#'])('scrolls to nothing at %s, whose hash is not #map exactly', async (path) => {
    const { container } = drawClubs(path)
    await clubsDrawn()
    expect(mapWrap(container)!.id).toBe('map')
    expect(scrolled).toEqual([])
  })

  it('scrolls to the map once for #map beside a club asked for, and keeps the club picked', async () => {
    const { container } = drawClubs('/clubs?club=c1#map')
    await clubsDrawn()
    expect(scrolled).toEqual([{ el: mapWrap(container), options: { block: 'start' } }])
    expect(screen.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('on a phone, a club picked after the scroll drops #map from the address and brings only the page\'s own scroll, never the hash\'s again', async () => {
    const { container } = drawClubs('/clubs#map')
    await clubsDrawn()
    expect(hashScrolls()).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Fixture North Chess Club on the map' }))
    })
    expect(hashScrolls()).toHaveLength(1)
    expect(scrolled).toEqual([
      { el: mapWrap(container), options: { block: 'start' } },
      { el: mapWrap(container), options: { behavior: 'smooth', block: 'start' } },
    ])
  })

  it('on a wide screen, a club picked from the list after the scroll brings no scroll at all', async () => {
    stubWidth(1280)
    drawClubs('/clubs#map')
    await clubsDrawn()
    expect(scrolled).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show Fixture North Chess Club on the map' }))
    })
    expect(scrolled).toHaveLength(1)
  })

  it('scrolls to nothing on leaving #map for the page alone, and again on a new arrival at #map', async () => {
    const { container } = drawClubs('/clubs#map')
    await clubsDrawn()
    expect(scrolled).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'the clubs page alone' }))
    })
    expect(scrolled).toHaveLength(1)
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Club map' }))
    })
    expect(scrolled).toEqual([
      { el: mapWrap(container), options: { block: 'start' } },
      { el: mapWrap(container), options: { block: 'start' } },
    ])
  })

  it('holds one element with id="map", the map\'s wrapper', async () => {
    const { container } = drawClubs('/clubs')
    await clubsDrawn()
    expect(document.querySelectorAll('#map')).toHaveLength(1)
    expect(document.getElementById('map')).toBe(mapWrap(container))
  })
})

describe('the clubs page, byte for byte', () => {
  /** The page's markup at an address once its clubs have been drawn. */
  async function clubsMarkup(path: string): Promise<string> {
    const { container } = drawClubs(path)
    await clubsDrawn()
    const html = container.innerHTML
    cleanup()
    return html
  }

  it.each(['/clubs', '/clubs#map', '/clubs?club=c1'])('at %s is the same with the chrome on as with it off, but for the map\'s id', async (path) => {
    flags.newNav = false
    const off = await clubsMarkup(path)
    flags.newNav = true
    const on = await clubsMarkup(path)
    expect(on).not.toBe(off)
    expect(on.split(' id="map"')).toHaveLength(2)
    expect(on.replace(' id="map"', '')).toBe(off)
  })

  it('with the chrome off is the same at /clubs#map as at /clubs, and scrolls to nothing at either', async () => {
    flags.newNav = false
    const plain = await clubsMarkup('/clubs')
    expect(await clubsMarkup('/clubs#map')).toBe(plain)
    expect(scrolled).toEqual([])
  })
})
