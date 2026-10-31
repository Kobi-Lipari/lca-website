// @vitest-environment jsdom
//
// Log in and the page a person comes back to (the brief's AC16, the
// desktop's part, and the notes for this workstream on LoginPage, which is
// not changed): src/pages/LoginPage.tsx reads the page it was handed as
// one string and goes there once the person is signed in. Here the real
// page is drawn behind the real headers, with the sign-in itself stood in
// for, and:
//
// - Log in in the new header, on a page with a query and a hash, brings
//   the person back to that page, its query and its hash included, once
//   the password is taken;
// - someone already signed in who reaches /login with that page handed to
//   it is sent straight there;
// - Log in in the new header on /login itself hands nothing on, so the
//   person goes to the dashboard rather than back to the sign-in page;
// - Log in in today's header hands nothing, as it always has, so the
//   person lands on the dashboard as before;
// - a password that is not taken leaves the person on /login, with the
//   page still to come back to;
// - since WS02 step 6, Log in in the tablet header and in the Menu sheet,
//   which the phone's app bar opens, brings the person back to the page
//   the same way;
// - and on the password pages, /forgot-password and /reset-password, Log
//   in in the new header's two forms and in the sheet hands on the page
//   that page was handed, or nothing, so the person comes back to where
//   they came from, or to the dashboard, never to a password form.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

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
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/mfa', () => ({
  needsChallenge: async () => false,
  listTotpFactors: async () => [],
  verifyTotpCode: async () => {},
}))

const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { MobileAppBar } = await import('@/components/layout/MobileAppBar')
const { Navbar } = await import('@/components/layout/Navbar')
const { LoginPage } = await import('@/pages/LoginPage')

/** The headers a test draws: the new header's two forms, the phone's app bar (Log in in its sheet), and today's. */
type Header = 'new' | 'tablet' | 'app bar' | 'today'

interface Signing {
  signIn: ReturnType<typeof vi.fn>
  syncMember: ReturnType<typeof vi.fn>
}

function visitor(signing: Signing, signedIn = false): AuthContextValue {
  return {
    user: signedIn ? ({ id: 'fx-m-login' } as User) : null,
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
    signIn: signing.signIn,
    syncMember: signing.syncMember,
    refreshAssurance: async () => {},
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** Writes out where the page is. */
function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>
}

const HEADERS = {
  new: <SiteHeader />,
  tablet: <SiteHeader form="tablet" />,
  'app bar': <MobileAppBar />,
  today: <Navbar />,
}

function draw(path: string | { pathname: string; state?: unknown }, header: Header, auth: AuthContextValue) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        {HEADERS[header]}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const where = () => screen.getByTestId('where').textContent
const banner = () => within(screen.getByRole('banner'))

/** Presses Log in where the header gives it: in the bar, or in the Menu sheet the app bar opens. */
async function pressLogIn(header: Exclude<Header, 'today'>) {
  if (header === 'app bar') {
    fireEvent.click(banner().getByRole('button', { name: 'Menu' }))
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    fireEvent.click(within(sheet).getByRole('link', { name: 'Log in' }))
  } else {
    fireEvent.click(banner().getByRole('link', { name: 'Log in' }))
  }
  expect(await screen.findByRole('heading', { level: 1, name: 'Log In' })).toBeTruthy()
}

/** Fills in the sign-in form and sends it. */
function signInWith(email = 'fixture.member@example.org', password = 'fixture-password') {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: 'Log In' }))
}

let signing: Signing

beforeEach(() => {
  flags.newLook = true
  flags.newNav = true
  signing = { signIn: vi.fn(async () => ({ error: null })), syncMember: vi.fn(async () => {}) }
})
afterEach(() => {
  cleanup()
})

describe('the page a person comes back to after Log in', () => {
  it('from the new header on /tournaments?when=weekend#list, is that page, its query and its hash, once the password is taken', async () => {
    draw('/tournaments?when=weekend#list', 'new', visitor(signing))
    fireEvent.click(banner().getByRole('link', { name: 'Log in' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Log In' })).toBeTruthy()
    signInWith()
    await waitFor(() => expect(where()).toBe('/tournaments?when=weekend#list'))
    expect(signing.signIn).toHaveBeenCalledWith('fixture.member@example.org', 'fixture-password')
    expect(signing.syncMember).toHaveBeenCalledTimes(1)
  })

  it('for someone already signed in who reaches /login with that page handed to it, is that page at once', () => {
    draw({ pathname: '/login', state: { from: '/clubs/fx-club-north?tab=events#schedule' } }, 'new', visitor(signing, true))
    expect(where()).toBe('/clubs/fx-club-north?tab=events#schedule')
    expect(signing.signIn).not.toHaveBeenCalled()
  })

  it('from the new header on /login itself, is the dashboard, never the sign-in page again', async () => {
    draw('/login', 'new', visitor(signing))
    fireEvent.click(banner().getByRole('link', { name: 'Log in' }))
    signInWith()
    await waitFor(() => expect(where()).toBe('/dashboard'))
  })

  it('from today\'s header, which hands /login nothing, is the dashboard, as it always was', async () => {
    flags.newLook = false
    flags.newNav = false
    draw('/tournaments?when=weekend#list', 'today', visitor(signing))
    fireEvent.click(banner().getAllByRole('link', { name: 'Log in' })[0])
    signInWith()
    await waitFor(() => expect(where()).toBe('/dashboard'))
  })

  it('is not reached while the password is not taken: the person stays on /login, told why, and the page to come back to is kept for the next try', async () => {
    signing.signIn.mockResolvedValueOnce({ error: 'Invalid login credentials' })
    draw('/news?tag=state#latest', 'new', visitor(signing))
    fireEvent.click(banner().getByRole('link', { name: 'Log in' }))
    signInWith('fixture.member@example.org', 'not-the-password')
    expect(await screen.findByText('Invalid login credentials')).toBeTruthy()
    expect(screen.queryByTestId('where')).toBeNull()
    signInWith()
    await waitFor(() => expect(where()).toBe('/news?tag=state#latest'))
    expect(signing.signIn).toHaveBeenCalledTimes(2)
  })
})

describe('the page a person comes back to, from the tablet header and the Menu sheet (WS02 step 6)', () => {
  it.each(['tablet', 'app bar'] as const)('from the %s on /tournaments?when=weekend#list, is that page, its query and its hash', async (header) => {
    draw('/tournaments?when=weekend#list', header, visitor(signing))
    await pressLogIn(header)
    signInWith()
    await waitFor(() => expect(where()).toBe('/tournaments?when=weekend#list'))
  })
})

describe('the page a person comes back to, from the password pages (WS02 step 6)', () => {
  const PAGES = ['/forgot-password', '/reset-password'] as const
  const BARS = ['new', 'tablet', 'app bar'] as const

  for (const page of PAGES) {
    it.each(BARS)(`on ${page} handed a page, from the %s, is that page, never ${page}`, async (header) => {
      draw({ pathname: page, state: { from: '/clubs?region=north#map' } }, header, visitor(signing))
      await pressLogIn(header)
      signInWith()
      await waitFor(() => expect(where()).toBe('/clubs?region=north#map'))
    })

    it.each(BARS)(`on ${page} handed nothing, from the %s, is the dashboard, never ${page}`, async (header) => {
      draw(page, header, visitor(signing))
      await pressLogIn(header)
      signInWith()
      await waitFor(() => expect(where()).toBe('/dashboard'))
    })
  }
})
