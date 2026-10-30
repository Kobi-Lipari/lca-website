// @vitest-environment jsdom
//
// Today's header, the one every visitor sees with every switch off, against
// a copy of itself: test/unit/fixtures/navbar-today.tsx is
// src/components/layout/Navbar.tsx as it stood at commit 7568680, word for
// word but for its first comment and its export's name. Both are drawn
// under the same router and sign-in, and their markup is compared byte for
// byte:
//
// - at fifteen addresses: the home page, each section's page, Scanner,
//   /about and a governance page, the More menu's pages and the account
//   links' pages;
// - signed out, and as three signed-in people: an LCA admin who holds a
//   seat, the director of an event and a regional representative, so every
//   account link of the More menu is drawn;
// - with newLook and newNav each off and on: with both on (the chrome) and
//   no matchMedia here, the header below 1024 pixels, which is today's;
// - closed, with the More menu opened by a click, and with the drawer
//   opened by the menu button as well.
//
// The live header's markup is the copy's, byte for byte, once every
// aria-current="page" is taken out of it; and aria-current="page" sits on
// exactly the links today's rule marks as the page a visitor is on (the
// path is the link's address or under it, and Governance's under /governance
// and /about too), in the bar, in the More menu and in the drawer, and on
// nothing else: not the brand link, Profile, Log in or Join LCA.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import type { ComponentType } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
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
const { NavbarToday } = await import('./fixtures/navbar-today')

/** The fifteen addresses the two headers are drawn at. */
const PATHS = [
  '/',
  '/tournaments',
  '/clubs',
  '/scholastic',
  '/news',
  '/scanner',
  '/about',
  '/governance/minutes',
  '/membership',
  '/champions',
  '/support',
  '/dashboard',
  '/admin',
  '/workspace',
  '/board/inbox',
] as const

/** A visitor as the header reads one from the sign-in context. */
function visitor(signedIn: { role: MemberRole; isBoardMember?: boolean; managedClubs?: number; directedEvents?: number } | null): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-header' } as User) : null,
    session: null,
    member: null,
    role: signedIn?.role ?? 'member',
    seats: [],
    managedClubs: Array.from({ length: signedIn?.managedClubs ?? 0 }, (_, i) => ({ id: `fx-club-${i}`, name: `Fixture Club ${i}`, region: 'North Louisiana' })),
    isBoardMember: signedIn?.isBoardMember ?? false,
    assuranceLevel: signedIn ? 'aal2' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: Array.from({ length: signedIn?.directedEvents ?? 0 }, (_, i) => `fx-t-${i}`),
    loading: false,
    memberLoading: false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** The four people, with the account links today's header gives each. */
const PEOPLE = [
  { title: 'a visitor who is signed out', auth: visitor(null), links: [] },
  { title: 'an LCA admin who holds a seat', auth: visitor({ role: 'lca_admin', isBoardMember: true }), links: ['Admin panel', 'Board inbox'] },
  { title: 'the director of an event', auth: visitor({ role: 'tournament_director', directedEvents: 1 }), links: ['Workspace'] },
  { title: 'a regional representative', auth: visitor({ role: 'member', isBoardMember: true, managedClubs: 1 }), links: ['Board inbox', 'My region’s clubs'] },
] as const

/** newLook and newNav, each off and on. */
const SWITCHES = [
  { newLook: false, newNav: false },
  { newLook: true, newNav: false },
  { newLook: false, newNav: true },
  { newLook: true, newNav: true },
] as const

/** What one drawing gives: the markup closed, with the More menu open, and with the drawer open as well, and what is marked current with both open. */
interface Drawn {
  states: string[]
  /** Every element that carries aria-current, as "label href value". */
  marked: string[]
  /** The links today's rule marks as the page a visitor is on, among the bar's, the More menu's and the drawer's, as "label href page". */
  current: string[]
}

/** Today's rule for the page a visitor is on: the link's address or under it, and Governance's under /governance and /about too. */
function isCurrent(path: string, href: string): boolean {
  const under = (address: string) => path === address || path.startsWith(`${address}/`)
  return under(href) || (href === '/governance/board' && (under('/governance') || under('/about')))
}

const named = (el: Element, value: string) => `${el.textContent} ${el.getAttribute('href')} ${value}`

function drawn(Header: ComponentType, auth: AuthContextValue, path: string): Drawn {
  const { container } = render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const states = [container.innerHTML]
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  states.push(container.innerHTML)
  fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  states.push(container.innerHTML)
  // The links of a section, a page or an account: every link of the bar's
  // nav, the More menu's rows among them, and the drawer's own links, which
  // are its nav's children; the drawer's Facebook, Profile, Log in and Join
  // LCA sit in a group of their own below them.
  const [bar, drawer] = [...container.querySelectorAll('nav')]
  const links = [...bar.querySelectorAll('a'), ...drawer.querySelectorAll(':scope > a')]
  const current = links.filter((a) => isCurrent(path, a.getAttribute('href') ?? '')).map((a) => named(a, 'page'))
  const marked = [...container.querySelectorAll('[aria-current]')].map((el) => named(el, el.getAttribute('aria-current') ?? ''))
  cleanup()
  return { states, marked, current }
}

/** A drawing's markup with every aria-current="page" taken out. */
const withoutCurrent = (markup: string) => markup.replace(/ aria-current="page"/g, '')

afterEach(() => {
  cleanup()
  flags.newLook = false
  flags.newNav = false
})

describe('today\'s header against the copy of itself kept in test/unit/fixtures/navbar-today.tsx', () => {
  it.each(PATHS)('at %s: the same markup, byte for byte, for every person and switch, closed and with both menus open, once aria-current is taken out; and aria-current="page" on exactly the current links', (path) => {
    for (const person of PEOPLE) {
      for (const switches of SWITCHES) {
        Object.assign(flags, switches)
        const where = `${person.title}, newLook ${switches.newLook}, newNav ${switches.newNav}`
        const live = drawn(Navbar, person.auth, path)
        const today = drawn(NavbarToday, person.auth, path)
        // The copy carries no aria-current at all.
        expect(today.marked, where).toEqual([])
        expect(live.states.map(withoutCurrent), where).toEqual(today.states)
        expect(live.marked, where).toEqual(live.current)
      }
    }
  })

  it('marks the links a visitor expects, in the bar, the More menu and the drawer, and nothing on the home page', () => {
    const marked = (path: string, person = PEOPLE[0]) => drawn(Navbar, person.auth, path).marked
    expect(marked('/')).toEqual([])
    expect(marked('/tournaments')).toEqual(['Tournaments /tournaments page', 'Tournaments /tournaments page'])
    expect(marked('/clubs/fx-club-north')).toEqual(['Clubs /clubs page', 'Clubs /clubs page'])
    expect(marked('/scanner')).toEqual(['Scanner /scanner page', 'Scanner /scanner page'])
    // Governance opens on the board's page and stands for /about and every governance page.
    expect(marked('/about')).toEqual(['Governance /governance/board page', 'Governance /governance/board page'])
    expect(marked('/governance/minutes')).toEqual(['Governance /governance/board page', 'Governance /governance/board page'])
    expect(marked('/champions')).toEqual(['State champions /champions page', 'State champions /champions page'])
    // On /dashboard, the regional representative's My region's clubs, never Profile.
    expect(marked('/dashboard', PEOPLE[3])).toEqual(['My region’s clubs /dashboard page', 'My region’s clubs /dashboard page'])
    expect(marked('/dashboard', PEOPLE[1])).toEqual([])
    expect(marked('/board/inbox', PEOPLE[1])).toEqual(['Board inbox /board/inbox page', 'Board inbox /board/inbox page'])
    // Log in and Join LCA are not sections, on their own pages either.
    expect(marked('/login')).toEqual([])
    expect(marked('/membership')).toEqual(['Membership /membership page', 'Membership /membership page'])
  })

  it('draws every account link of the More menu for the people it is drawn for', () => {
    for (const person of PEOPLE) {
      render(
        <AuthContext.Provider value={person.auth}>
          <MemoryRouter initialEntries={['/']}>
            <Navbar />
          </MemoryRouter>
        </AuthContext.Provider>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'More' }))
      const rows = screen.getAllByRole('menuitem').map((row) => row.textContent)
      expect(rows, person.title).toEqual(['Governance', 'Membership', 'State champions', 'Support', ...person.links])
      cleanup()
    }
  })
})
