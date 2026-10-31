// @vitest-environment jsdom
//
// The bars' own boundary, src/components/layout/OnDemand.tsx, at the edges
// test/unit/on-demand.test.tsx leaves: there both files the bars fetch on
// demand are gone; here the Menu sheet's file arrives and only the donation
// dialog's is gone, as a deploy that changed the dialog alone would leave a
// tab open across it. The bars are drawn inside the root error screen, as
// src/main.tsx draws the app:
//
// - the sheet's Donate, from the phone's app bar and from the tablet
//   header's drawer: the sheet closes as it hands Donate on, the donation
//   form's notice takes the dialog's place under the bar, no dialog is left
//   open, the page stands, and the focus is on the Menu button that opened
//   the sheet, since the Donate the person pressed went with the sheet,
//   and again when that Donate is pressed a second time, the failure then
//   known before the sheet has gone;
// - the sheet itself still opens after the donation form has failed, each
//   part's boundary its own, and the notice stays where it was;
// - the notice's one button, Dismiss, puts the notice away and gives the
//   focus to the control that asked for the part, never to the page's top;
// - a part asked for again after its notice was put away fails as before,
//   with the notice back once and the bar told each time.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
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
// The donation dialog's file, gone from the server; the sheet's is there.
vi.mock('@/components/DonateButton', () => Promise.reject(new TypeError('Failed to fetch dynamically imported module: /assets/DonateButton-gone.js')))

const { MobileAppBar } = await import('@/components/layout/MobileAppBar')
const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { ErrorBoundary } = await import('@/components/errors/ErrorBoundary')

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
        <MemoryRouter initialEntries={['/clubs']}>
          {bar}
          <main>
            <h1>Clubs</h1>
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

const banner = () => within(screen.getByRole('banner'))

/** The page is still the page: its header and its content, and never the root error screen. */
function pageStands() {
  expect(screen.getByRole('banner')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Clubs' })).toBeTruthy()
  expect(screen.queryByText('Something went wrong')).toBeNull()
}

/** Opens the sheet from the bar's Menu button and presses its Donate, as a person does. */
async function donateFromTheSheet() {
  const menu = press(banner().getByRole('button', { name: 'Menu' }))
  const sheet = await screen.findByRole('dialog', { name: 'Menu' })
  await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('button', { name: 'Close menu' })))
  press(within(sheet).getByRole('button', { name: 'Donate' }))
  return menu
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

describe.each([
  ['the phone\'s app bar', () => <MobileAppBar />],
  ['the tablet header', () => <SiteHeader form="tablet" />],
])('the sheet\'s Donate from %s, when only the donation form\'s file cannot be had', (_, bar) => {
  it('closes the sheet, shows the donation form\'s notice under the bar with no dialog left open, and the page stands', async () => {
    drawApp(bar())
    await donateFromTheSheet()
    const notice = await screen.findByRole('alert')
    expect(notice.textContent).toBe(`${DONATE_NOTICE}Dismiss`)
    expect(screen.getByRole('banner').contains(notice)).toBe(true)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(ownLines()).toHaveLength(1)
    pageStands()
  })

  it('puts the focus on the Menu button that opened the sheet, since the Donate pressed went with the sheet', async () => {
    drawApp(bar())
    const menu = await donateFromTheSheet()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement, 'the focus once the donation form has failed').toBe(menu))
    expect(menu.getAttribute('aria-expanded')).toBe('false')
  })

  it('still opens the sheet afterwards, each part\'s boundary its own, with the notice where it was', async () => {
    drawApp(bar())
    const menu = await donateFromTheSheet()
    await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    press(menu)
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    expect(within(sheet).getByRole('button', { name: 'Close menu' })).toBeTruthy()
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    // The notice is the donation form's alone, and only one.
    expect(screen.getAllByRole('alert', { hidden: true }).map((alert) => alert.querySelector('p')!.textContent)).toEqual([DONATE_NOTICE])
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menu))
    pageStands()
  })

  it('puts the focus on Menu again when the sheet\'s Donate is pressed a second time, the failure known by then, while the sheet is still closing', async () => {
    drawApp(bar())
    const menu = await donateFromTheSheet()
    const notice = await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    press(within(notice).getByRole('button', { name: 'Dismiss' }))
    expect(document.activeElement).toBe(menu)
    // Asked for again, the failed answer is known at once, before the sheet has gone.
    await donateFromTheSheet()
    expect((await screen.findByRole('alert')).textContent).toBe(`${DONATE_NOTICE}Dismiss`)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement, 'the focus once the donation form has failed again').toBe(menu))
    expect(ownLines()).toHaveLength(2)
    pageStands()
  })
})

describe('the notice\'s Dismiss', () => {
  it('in the desktop form, puts the notice away and gives the focus back to Donate, which asked for the form', async () => {
    drawApp(<SiteHeader />)
    const donate = press(banner().getByRole('button', { name: 'Donate' }))
    const notice = await screen.findByRole('alert')
    const dismiss = within(notice).getByRole('button', { name: 'Dismiss' })
    press(dismiss)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(dismiss.isConnected).toBe(false)
    expect(document.activeElement, 'the focus once the notice is put away').toBe(donate)
    pageStands()
  })

  it('from the app bar\'s sheet, puts the notice away and gives the focus back to Menu', async () => {
    drawApp(<MobileAppBar />)
    const menu = await donateFromTheSheet()
    const notice = await screen.findByRole('alert')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    press(within(notice).getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(document.activeElement, 'the focus once the notice is put away').toBe(menu)
  })
})

describe('a part asked for again after its notice was put away', () => {
  it('fails as before: the notice back once, the bar told each time, and no dialog', async () => {
    drawApp(<SiteHeader />)
    const donate = press(banner().getByRole('button', { name: 'Donate' }))
    for (let ask = 1; ask <= 3; ask++) {
      const notice = await screen.findByRole('alert')
      expect(screen.getAllByRole('alert'), `ask ${ask}`).toHaveLength(1)
      expect(notice.textContent).toBe(`${DONATE_NOTICE}Dismiss`)
      expect(screen.queryByRole('dialog'), `ask ${ask}`).toBeNull()
      expect(ownLines(), `ask ${ask}`).toHaveLength(ask)
      fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
      expect(screen.queryByRole('alert')).toBeNull()
      press(donate)
    }
    pageStands()
  })
})
