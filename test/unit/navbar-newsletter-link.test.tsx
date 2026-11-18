// @vitest-environment jsdom
//
// Today's header (src/components/layout/Navbar.tsx): the More menu's
// account links name "Newsletter", to /admin/newsletter, only with the
// switch mailPage on and only for those the newsletter's own page lets in:
// an LCA admin, the president and the media manager (on the server's
// answer). With mailPage off the menu is as it was for every person.
//
// Every person here is made up.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { MemberRole } from '@/areas/admin/roles'

const flags = vi.hoisted(() => ({ mailPage: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      newLook: false,
      newNav: false,
      mailLists: true,
      get mailPage() {
        return flags.mailPage
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
/** The server's answer to "is this person the media manager", as each case sets it. */
const manager = vi.hoisted(() => ({ yes: false }))
vi.mock('@/areas/admin/useMediaManager', () => ({
  useMediaManager: (needed: boolean) => ({ asking: false, mediaManager: needed && manager.yes, secondFactor: needed && manager.yes }),
}))

const { Navbar } = await import('@/components/layout/Navbar')

interface Person {
  title: string
  role: MemberRole
  boardSeat: boolean
  mediaManager: boolean
}

const PEOPLE: Person[] = [
  { title: 'an LCA admin', role: 'lca_admin', boardSeat: true, mediaManager: false },
  { title: 'the president', role: 'lca_observer', boardSeat: true, mediaManager: false },
  { title: 'the media manager', role: 'member', boardSeat: true, mediaManager: true },
  { title: 'an officer who holds the Media manager seat', role: 'lca_officer', boardSeat: true, mediaManager: true },
  { title: 'a member', role: 'member', boardSeat: false, mediaManager: false },
  { title: 'a board member who is not the media manager', role: 'member', boardSeat: true, mediaManager: false },
  { title: 'an officer without the seat', role: 'lca_officer', boardSeat: true, mediaManager: false },
]

function auth(person: Person): AuthContextValue {
  return {
    user: { id: 'fx-m-newsletter-link' } as User,
    session: null,
    member: null,
    role: person.role,
    seats: person.boardSeat ? [{ id: 'fx-seat' }] : [],
    managedClubs: [],
    isBoardMember: person.boardSeat,
    assuranceLevel: 'aal2',
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: false,
    memberLoading: false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** The More menu's rows, opened, as "label href". */
function moreMenuRows(person: Person): string[] {
  manager.yes = person.mediaManager
  render(
    <AuthContext.Provider value={auth(person)}>
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const header = screen.getByRole('banner')
  fireEvent.click(within(header).getByRole('button', { name: 'More' }))
  return within(header).getAllByRole('menuitem').map((a) => `${a.textContent} ${a.getAttribute('href')}`)
}

beforeEach(() => {
  flags.mailPage = false
  manager.yes = false
})

afterEach(() => {
  cleanup()
})

describe('with mailPage off', () => {
  it.each(PEOPLE.map((p) => [p.title, p] as const))('%s: the More menu names no Newsletter', (_title, person) => {
    const rows = moreMenuRows(person)
    expect(rows.some((r) => r.startsWith('Newsletter'))).toBe(false)
    expect(rows.some((r) => r.endsWith('/admin/newsletter'))).toBe(false)
  })
})

describe('with mailPage on', () => {
  it.each(PEOPLE.slice(0, 4).map((p) => [p.title, p] as const))('%s: the More menu has Newsletter, to /admin/newsletter', (_title, person) => {
    flags.mailPage = true
    const rows = moreMenuRows(person)
    expect(rows.filter((r) => r === 'Newsletter /admin/newsletter')).toHaveLength(1)
  })

  it('the media manager finds Newsletter just after Group email', () => {
    flags.mailPage = true
    const rows = moreMenuRows(PEOPLE[2])
    expect(rows.indexOf('Newsletter /admin/newsletter')).toBe(rows.indexOf('Group email /admin/email') + 1)
  })

  it.each(PEOPLE.slice(4).map((p) => [p.title, p] as const))('%s: no Newsletter, as the page does not let them in', (_title, person) => {
    flags.mailPage = true
    const rows = moreMenuRows(person)
    expect(rows.some((r) => r.startsWith('Newsletter'))).toBe(false)
  })
})
