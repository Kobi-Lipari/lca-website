// @vitest-environment jsdom
//
// Today's header, the one every visitor sees with every switch off, at its
// edges. test/unit/header-today.test.tsx holds it to the copy of itself
// kept in test/unit/fixtures/navbar-today.tsx; this file holds:
//
// - its Log in links, in the bar and in the drawer, hand /login no page, as
//   the copy's do, so a visitor who signs in from today's header lands on
//   the dashboard as before; with the chrome on, below 1024 pixels, where it
//   stands in for the new header, the same;
// - aria-current="page" follows the visitor from page to page in the one
//   header, moving off the link they left and onto the one they followed;
// - an address that only starts like a link's, as /tournamentsx or
//   /newsletter, marks nothing anywhere, and a query, a hash or a trailing
//   slash leave the current link as it is;
// - the More menu, opened by hovering as well as by a click, marks its rows
//   the same way, and its own button carries no aria-current.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newLook: false, newNav: false }))
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
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { Navbar } = await import('@/components/layout/Navbar')

function visitor(signedIn = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-today' } as User) : null,
    session: null,
    member: null,
    role: 'member',
    seats: [],
    managedClubs: [],
    isBoardMember: false,
    assuranceLevel: signedIn ? 'aal1' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: false,
    memberLoading: false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** Writes out where the page is and the page it was handed, as /login reads it. */
function Where() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash} from ${from ?? 'nothing'}`}</output>
}

function draw(path: string, auth = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Navbar />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const header = () => screen.getByRole('banner')
const where = () => screen.getByTestId('where').textContent
/** Every element of the header carrying aria-current, as "words value", with the More menu and the drawer open. */
function markedWithEverythingOpen(): string[] {
  fireEvent.click(within(header()).getByRole('button', { name: 'More' }))
  fireEvent.click(within(header()).getByRole('button', { name: 'Open menu' }))
  return [...header().querySelectorAll('[aria-current]')].map((el) => `${el.textContent} ${el.getAttribute('aria-current')}`)
}

beforeEach(() => {
  flags.newLook = false
  flags.newNav = false
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('today\'s Log in links (AC7: the new header\'s Log in alone hands /login a page)', () => {
  it.each([
    [{ newLook: false, newNav: false }],
    [{ newLook: true, newNav: false }],
    [{ newLook: false, newNav: true }],
    [{ newLook: true, newNav: true }],
  ])('hand /login no page, in the bar and in the drawer, with %j', (switches) => {
    Object.assign(flags, switches)
    // With the chrome on, the window is narrower than 1024 pixels, where today's header stands in.
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    draw('/tournaments?when=weekend#list')
    fireEvent.click(within(header()).getAllByRole('link', { name: 'Log in' })[0])
    expect(where(), 'the bar\'s').toBe('/login from nothing')
    cleanup()
    draw('/clubs?region=north#map')
    fireEvent.click(within(header()).getByRole('button', { name: 'Open menu' }))
    const logIns = within(header()).getAllByRole('link', { name: 'Log in' })
    expect(logIns).toHaveLength(2)
    fireEvent.click(logIns[1])
    expect(where(), 'the drawer\'s').toBe('/login from nothing')
  })

  it('keeps Join LCA a plain link to /membership in the bar and the drawer, handing it nothing', () => {
    draw('/news')
    fireEvent.click(within(header()).getByRole('button', { name: 'Open menu' }))
    const joins = within(header()).getAllByRole('link', { name: 'Join LCA' })
    expect(joins.map((a) => a.getAttribute('href'))).toEqual(['/membership', '/membership'])
    fireEvent.click(joins[0])
    expect(where()).toBe('/membership from nothing')
  })
})

describe('aria-current on today\'s header as the visitor moves', () => {
  it('moves off the link left and onto the one followed, in the one header', () => {
    draw('/')
    const bar = () => header().querySelector('nav')!
    const marked = () => [...bar().querySelectorAll('[aria-current="page"]')].map((el) => el.textContent)
    expect(marked()).toEqual([])
    fireEvent.click(within(bar()).getByRole('link', { name: 'Tournaments' }))
    expect(where()).toBe('/tournaments from nothing')
    expect(marked()).toEqual(['Tournaments'])
    fireEvent.click(within(bar()).getByRole('link', { name: 'Clubs' }))
    expect(marked()).toEqual(['Clubs'])
    // The brand link goes home, where nothing is marked, and carries no mark of its own.
    fireEvent.click(within(header()).getAllByRole('link').find((a) => a.getAttribute('href') === '/')!)
    expect(marked()).toEqual([])
    expect(header().querySelectorAll('[aria-current]')).toHaveLength(0)
  })

  it('marks the drawer\'s link of the page reached from the drawer, which closes it', () => {
    draw('/')
    fireEvent.click(within(header()).getByRole('button', { name: 'Open menu' }))
    const drawer = () => header().querySelectorAll('nav')[1]
    fireEvent.click(within(drawer()).getByRole('link', { name: 'Scholastic' }))
    expect(where()).toBe('/scholastic from nothing')
    expect(header().querySelectorAll('nav')).toHaveLength(1)
    fireEvent.click(within(header()).getByRole('button', { name: 'Open menu' }))
    expect([...drawer().querySelectorAll('[aria-current="page"]')].map((el) => el.textContent)).toEqual(['Scholastic'])
  })
})

describe('addresses at the edges of a link', () => {
  it.each(['/tournamentsx', '/newsletter', '/clubsuggest', '/supporters', '/governancex', '/aboutus', '/scannerx', '/championships', '/membership-card', '/workspaces'])(
    '%s only starts like a link\'s address, and marks nothing in the bar, the More menu or the drawer',
    (path) => {
      draw(path, visitor(true))
      expect(markedWithEverythingOpen()).toEqual([])
    },
  )

  it.each([
    ['/tournaments?when=weekend#list', 'Tournaments'],
    ['/news/', 'News'],
    ['/clubs#map', 'Clubs'],
    ['/governance/minutes?year=2025', 'Governance'],
    ['/about#history', 'Governance'],
    ['/support?topic=website', 'Support'],
  ])('%s: a query, a hash or a trailing slash leave %s the current link, in the bar or the More menu and in the drawer', (path, current) => {
    draw(path)
    expect(markedWithEverythingOpen()).toEqual([`${current} page`, `${current} page`])
  })
})

describe('the More menu', () => {
  it('opened by hovering, marks its row of the page a visitor is on, and its own button carries no aria-current', () => {
    draw('/champions')
    const wrapper = within(header()).getByRole('button', { name: 'More' }).parentElement!
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByRole('menuitem', { name: 'State champions' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('menuitem').filter((row) => row.hasAttribute('aria-current')).map((row) => row.textContent)).toEqual(['State champions'])
    expect(within(header()).getByRole('button', { name: 'More' }).hasAttribute('aria-current')).toBe(false)
  })
})
