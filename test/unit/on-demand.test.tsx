// @vitest-environment jsdom
//
// The bars' own boundary, src/components/layout/OnDemand.tsx (WS02 step 6),
// round what they fetch the first time a person asks for it: the Menu sheet
// and the donation dialog. Here both files fail to load, as a tab left open
// across a deploy finds them once the one reload the site allows a tab has
// been used, and the bars are drawn inside the root error screen
// (src/components/errors/ErrorBoundary.tsx), as src/main.tsx draws the app:
//
// - the boundary itself, with a loader handed in: nothing drawn while the
//   part arrives and the part once it has; for a part that cannot be had, a
//   notice in plain words with role="alert" on its own light surface, the
//   bar told once, the notice put away by its one button, and shown again
//   on the next ask, the failed answer kept;
// - the phone's app bar: Menu pressed, the sheet's file failing, the notice
//   under the bar, the sheet closed, the bar drawn, the focus still on Menu,
//   and no "Something went wrong";
// - the desktop header's Donate and the tablet header's Menu and Donate the
//   same way, each with its own notice.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { lazy, type ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
// The two files the bars fetch on demand, gone from the server.
vi.mock('@/components/layout/MobileMenu', () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/MobileMenu-gone.js')))
vi.mock('@/components/DonateButton', () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/DonateButton-gone.js')))

const { OnDemand } = await import('@/components/layout/OnDemand')
const { MobileAppBar } = await import('@/components/layout/MobileAppBar')
const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { ErrorBoundary } = await import('@/components/errors/ErrorBoundary')

const MENU_NOTICE = 'The menu could not be loaded. Reload the page to try again.'
const DONATE_NOTICE = 'The donation form could not be loaded. Reload the page to try again.'

const visitor = {
  user: null,
  session: null,
  member: null,
  role: 'member',
  seats: [],
  managedClubs: [],
  isBoardMember: false,
  assuranceLevel: null,
  mfaRequired: false,
  directedTournaments: [],
  directedTournamentIds: [],
  loading: false,
  memberLoading: false,
  signOut: async () => {},
} as unknown as AuthContextValue

/** A bar drawn as src/main.tsx draws the app: inside the root error screen, under a router and a sign-in context. */
function drawApp(bar: ReactElement) {
  return render(
    <ErrorBoundary>
      <AuthContext.Provider value={visitor}>
        <MemoryRouter initialEntries={['/tournaments']}>
          {bar}
          <main>
            <h1>Tournaments</h1>
          </main>
        </MemoryRouter>
      </AuthContext.Provider>
    </ErrorBoundary>,
  )
}

/** Presses a control as a person does: the focus on it, then the press. */
function press(control: HTMLElement) {
  control.focus()
  fireEvent.click(control)
  return control
}

/** The page is still the page: its header and its content, and never the root error screen. */
function pageStands() {
  expect(screen.getByRole('banner')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Tournaments' })).toBeTruthy()
  expect(screen.queryByText('Something went wrong')).toBeNull()
}

let logged: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, myLcaRail: false })
  logged = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** What the boundary wrote to the console for a part it could not load. */
const ownLines = () => logged.mock.calls.filter((call: unknown[]) => call[0] === 'A part of the header could not be loaded:')

describe('the boundary, with a loader handed in', () => {
  it('draws nothing while the part arrives, and the part once it has, with no notice', async () => {
    let arrive: (part: { default: () => ReactElement }) => void = () => {}
    const Part = lazy(() => new Promise<{ default: () => ReactElement }>((settle) => (arrive = settle)))
    const onFailed = vi.fn()
    const { container } = render(
      <OnDemand notice={MENU_NOTICE} onFailed={onFailed} tries={1}>
        <Part />
      </OnDemand>,
    )
    expect(container.innerHTML).toBe('')
    arrive({ default: () => <p>The part</p> })
    expect(await screen.findByText('The part')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onFailed).not.toHaveBeenCalled()
  })

  it('shows its notice for a part that cannot be had, tells the bar once, puts the notice away on Dismiss and shows it again on the next ask', async () => {
    const Gone = lazy(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/Gone.js')))
    const onFailed = vi.fn()
    const { rerender } = render(
      <OnDemand notice={MENU_NOTICE} onFailed={onFailed} tries={1}>
        <Gone />
      </OnDemand>,
    )
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(`${MENU_NOTICE}Dismiss`)
    expect(within(notice).getByText(MENU_NOTICE).tagName).toBe('P')
    expect(notice.getAttribute('data-slot')).toBe('on-demand-notice')
    expect(notice.getAttribute('data-ring-ground')).toBe('light')
    expect(notice.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-raised', 'text-ink', 'border-b', 'border-hairline']))
    // No address and no dash in the words: no slash, and neither of the two
    // long dashes, built from their character codes.
    const addressOrDash = new RegExp(`[/${String.fromCharCode(0x2013, 0x2014)}]`)
    expect(MENU_NOTICE).not.toMatch(addressOrDash)
    expect(DONATE_NOTICE).not.toMatch(addressOrDash)
    expect(onFailed).toHaveBeenCalledTimes(1)
    expect(ownLines()).toHaveLength(1)
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
    // Asked for again: the failed answer is kept, so the notice comes back rather than a second failure of a new kind.
    rerender(
      <OnDemand notice={MENU_NOTICE} onFailed={onFailed} tries={2}>
        <Gone />
      </OnDemand>,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(`${MENU_NOTICE}Dismiss`)
    expect(onFailed).toHaveBeenCalledTimes(2)
  })
})

describe('the phone\'s app bar, when the sheet\'s file cannot be had', () => {
  it('shows the menu\'s notice under the bar, keeps the sheet closed and the focus on Menu, and the page stands', async () => {
    drawApp(<MobileAppBar />)
    const menu = press(within(screen.getByRole('banner')).getByRole('button', { name: 'Menu' }))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(`${MENU_NOTICE}Dismiss`)
    expect(screen.getByRole('banner').contains(notice)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(menu.getAttribute('aria-expanded')).toBe('false'))
    expect(menu.hasAttribute('aria-controls')).toBe(false)
    expect(document.activeElement).toBe(menu)
    pageStands()
    expect(ownLines()).toHaveLength(1)
    // Put away, and shown again on the next press, the page standing throughout.
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
    press(menu)
    expect((await screen.findByRole('alert')).textContent).toBe(`${MENU_NOTICE}Dismiss`)
    await waitFor(() => expect(menu.getAttribute('aria-expanded')).toBe('false'))
    pageStands()
  })
})

describe('the new header, when what it fetches cannot be had', () => {
  it('in the desktop form, shows the donation form\'s notice for Donate, no dialog, the focus on Donate, and the page stands', async () => {
    drawApp(<SiteHeader />)
    const donate = press(within(screen.getByRole('banner')).getByRole('button', { name: 'Donate' }))
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(`${DONATE_NOTICE}Dismiss`)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(donate)
    pageStands()
  })

  it('in the tablet form, shows the menu\'s notice for Menu and the donation form\'s for Donate, each its own, and the page stands', async () => {
    drawApp(<SiteHeader form="tablet" />)
    const bar = within(screen.getByRole('banner'))
    const menu = press(bar.getByRole('button', { name: 'Menu' }))
    expect((await screen.findByRole('alert')).textContent).toBe(`${MENU_NOTICE}Dismiss`)
    await waitFor(() => expect(menu.getAttribute('aria-expanded')).toBe('false'))
    expect(document.activeElement).toBe(menu)
    const donate = press(bar.getByRole('button', { name: 'Donate' }))
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getAllByRole('alert').map((alert) => alert.querySelector('p')!.textContent)).toEqual([MENU_NOTICE, DONATE_NOTICE])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(donate)
    pageStands()
  })
})
