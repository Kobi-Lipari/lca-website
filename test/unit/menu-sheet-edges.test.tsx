// @vitest-environment jsdom
//
// The Menu sheet, src/components/layout/MobileMenu.tsx, at the edges
// test/unit/mobile-menu.test.tsx leaves, drawn open beside a page under a
// router and a sign-in context, with the switches it reads set through a
// mocked FEATURES:
//
// - the page behind: while the sheet is open the dialog primitive locks it
//   (its scroll held, presses outside the sheet stopped, everything outside
//   the sheet hidden from screen readers), and every way the sheet closes
//   gives the page back whole: Esc, the close control, a press on the scrim,
//   a row followed, the sheet's Donate and Log out;
// - the link marked as the page: one at most in the whole sheet, the first
//   of the rows that tie for the longest address the path sits under, and in
//   the About section the same row the About menu marks, with newAbout and
//   newNews off and on;
// - every row's address: the one src/lib/nav.ts gives its label, for every
//   person, with each mix of the switches the rows wait for;
// - the section open when the sheet opens again after the page changed
//   while it was closed: the new page's, never the one left open before;
// - while the sign-in context still reads the person or their member: no
//   Join slot that could be the wrong one, and Log in while the sign-in
//   itself is read;
// - the theme switch in the sheet sets the browser bar's colour as the
//   footer's control does.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { NavId } from '@/lib/nav'
import { PERSONA_KEYS, navPersona, type NavPersona } from './fixtures/navPersonas'

/** The switches the sheet reads; each test starts from the a11y-on build's (test/a11y/global-setup.ts). */
const A11Y_ON = {
  newLook: true,
  themeHeritage: true,
  newNav: true,
  siteSearch: true,
  eventStrip: true,
  eventStripLive: true,
  liveMarker: true,
  newTournaments: false,
  newNews: false,
  newClubs: false,
  newAbout: false,
  newMembership: false,
  myLcaRail: false,
}
const flags = vi.hoisted(() => ({
  newLook: true,
  themeHeritage: true,
  newNav: true,
  siteSearch: true,
  eventStrip: true,
  eventStripLive: true,
  liveMarker: true,
  newTournaments: false,
  newNews: false,
  newClubs: false,
  newAbout: false,
  newMembership: false,
  myLcaRail: false,
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { MobileMenu } = await import('@/components/layout/MobileMenu')
const { AboutMenu } = await import('@/components/layout/AboutMenu')
const { FEATURES } = await import('@/lib/features')
const { FACEBOOK_URL, navEntry, navSheet, sheetRowLabel } = await import('@/lib/nav')
const { THEME_COLOR_ATTRIBUTE, THEME_COLOR_DARK, THEME_COLOR_LIGHT } = await import('@/lib/colorScheme')

/** The sign-in context for one of the twelve people, as the site's own context holds them. */
function authOf(person: NavPersona, more: Partial<AuthContextValue> = {}): AuthContextValue {
  const answers = person.answers
  return {
    user: person.user ? ({ id: person.user.id, email: person.user.email } as User) : null,
    session: null,
    member: answers?.me.member ?? null,
    role: person.holds?.role ?? 'member',
    seats: answers?.mySeats.seats ?? [],
    managedClubs: answers?.mySeats.managedClubs ?? [],
    isBoardMember: person.holds?.isBoardMember ?? false,
    assuranceLevel: person.aal,
    mfaRequired: false,
    directedTournaments: answers?.me.directedTournaments ?? [],
    directedTournamentIds: (answers?.me.directedTournaments ?? []).map((t) => t.id),
    loading: false,
    memberLoading: false,
    signOut: async () => {},
    ...more,
  } as unknown as AuthContextValue
}

/** Writes out where the page is. */
function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash}`}</output>
}

interface PageProps {
  shape: 'full' | 'drawer'
  onDonate: () => void
}

/** A page with the sheet a bar draws over it: the button that opens it, a way to change the page, and the sheet, open to start with. */
function Page({ shape, onDonate }: PageProps) {
  const [open, setOpen] = useState(true)
  const opener = useRef<HTMLButtonElement>(null)
  const navigate = useNavigate()
  return (
    <>
      <main>
        <button ref={opener} type="button" onClick={() => setOpen(true)}>
          Open the sheet
        </button>
        <button type="button" onClick={() => navigate('/clubs')}>
          Go to the clubs page
        </button>
      </main>
      <MobileMenu open={open} onOpenChange={setOpen} shape={shape} id="fx-menu-sheet" returnFocus={() => opener.current} onDonate={onDonate} />
    </>
  )
}

function draw(path = '/', auth: AuthContextValue = authOf(navPersona('signed-out')), shape: PageProps['shape'] = 'full') {
  const onDonate = vi.fn()
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Page shape={shape} onDonate={onDonate} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { onDonate }
}

const sheet = () => screen.getByRole('dialog', { name: 'Menu' })
const inSheet = () => within(sheet())
const where = () => screen.getByTestId('where').textContent
const opener = () => screen.getByRole('button', { name: 'Open the sheet', hidden: true })
/** The sections' list items, top to bottom. */
const sectionItems = () => [...sheet().querySelectorAll<HTMLElement>('[data-slot="menu-sheet-sections"] > li')]
/** A section's own row: its disclosure button, or its link. */
const headOf = (item: Element) => item.querySelector<HTMLElement>(':scope > button, :scope > a')!
/** A section's name, without its note. */
const nameOf = (item: Element) => headOf(item).querySelector('span > span')!.textContent
const sectionNamed = (name: string) => sectionItems().find((item) => nameOf(item) === name)!

/** Opens every section that is closed, so every row is drawn. */
function openEverySection() {
  for (const item of sectionItems()) {
    const head = headOf(item)
    if (head.getAttribute('aria-expanded') === 'false') fireEvent.click(head)
  }
}

/** How the dialog primitive holds the page behind the sheet: its scroll, presses outside the sheet, and what screen readers hear. */
function pageHold() {
  return {
    scrollHeld: document.body.hasAttribute('data-scroll-locked'),
    pressesStopped: document.body.style.pointerEvents === 'none',
    hiddenFromScreenReaders: document.querySelectorAll('[data-aria-hidden]').length > 0 || !!opener().closest('[aria-hidden="true"]'),
  }
}
const HELD = { scrollHeld: true, pressesStopped: true, hiddenFromScreenReaders: true }
const FREE = { scrollHeld: false, pressesStopped: false, hiddenFromScreenReaders: false }

beforeEach(() => {
  Object.assign(flags, A11Y_ON)
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.documentElement.classList.remove('dark')
  window.localStorage.clear()
})

// ── The page behind the sheet ──────────────────────────────────────────────

describe('the page behind the sheet', () => {
  it('is held while the sheet is open: its scroll, presses outside the sheet, and what screen readers hear', async () => {
    draw('/')
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    expect(pageHold()).toEqual(HELD)
    // The sheet itself is heard, and the page's controls are not reached by role.
    expect(sheet().closest('[aria-hidden="true"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open the sheet' })).toBeNull()
  })

  it.each([
    ['Esc', () => fireEvent.keyDown(sheet(), { key: 'Escape' })],
    ['the close control', () => fireEvent.click(inSheet().getByRole('button', { name: 'Close menu' }))],
    ['a section\'s own link followed', () => fireEvent.click(inSheet().getByRole('link', { name: /^Scholastic/ }))],
    ['a row followed', () => {
      fireEvent.click(headOf(sectionNamed('Clubs')))
      fireEvent.click(inSheet().getByRole('link', { name: 'Club map' }))
    }],
    ['a link out of the site followed', () => fireEvent.click(inSheet().getByRole('link', { name: 'LCA on Facebook ↗' }))],
    ['its Donate, handed on to the bar', () => fireEvent.click(inSheet().getByRole('button', { name: 'Donate' }))],
  ])('is given back whole once the sheet closes on %s', async (_, closeIt) => {
    draw('/news')
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    expect(pageHold()).toEqual(HELD)
    closeIt()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(pageHold()).toEqual(FREE))
    expect(screen.getByRole('button', { name: 'Open the sheet' })).toBeTruthy()
  })

  it('is given back whole once the drawer closes on a press on its scrim', async () => {
    draw('/news', undefined, 'drawer')
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    await new Promise((settled) => setTimeout(settled, 0))
    const scrim = document.querySelector('[data-slot="menu-sheet-scrim"]')!
    fireEvent.pointerDown(scrim)
    fireEvent.click(scrim)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(pageHold()).toEqual(FREE))
  })

  it('is given back whole once the person logs out from the sheet, and the home page opens', async () => {
    const signOut = vi.fn(async () => {})
    draw('/clubs', authOf(navPersona('active-member'), { signOut }))
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    fireEvent.click(inSheet().getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(signOut).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(pageHold()).toEqual(FREE))
  })

  it('is held again, and given back again, each time the sheet opens and closes', async () => {
    draw('/')
    for (let time = 1; time <= 3; time++) {
      await waitFor(() => expect(pageHold(), `open, time ${time}`).toEqual(HELD))
      fireEvent.keyDown(sheet(), { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(pageHold(), `closed, time ${time}`).toEqual(FREE))
      fireEvent.click(opener())
      await screen.findByRole('dialog', { name: 'Menu' })
    }
  })
})

// ── The link of the page ───────────────────────────────────────────────────

/** The links the sheet marks as the page, by their words. */
const markedInSheet = () => [...sheet().querySelectorAll('[aria-current]')].map((el) => `${(el.textContent ?? '').trim()} ${el.getAttribute('aria-current')}`)

/** The row the About menu marks as the page at a path, by its words, drawn on its own as the header draws it. */
function markedInAboutMenu(path: string): string[] {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AboutMenu current buttonClassName="" squeezed={false} onDonate={() => {}} />
    </MemoryRouter>,
  )
  fireEvent.click(within(view.container).getByRole('button', { name: 'About' }))
  const panel = view.container.querySelector('[data-slot="about-menu"]')!
  const marked = [...panel.querySelectorAll('[aria-current]')].map((el) => `${el.querySelector('span')!.textContent} ${el.getAttribute('aria-current')}`)
  view.unmount()
  return marked
}

describe('the link the sheet marks as the page', () => {
  const ABOUT_PATHS = [
    '/about',
    '/about/board',
    '/about/bylaws',
    '/about/minutes',
    '/about/champions',
    '/governance/board',
    '/governance/bylaws',
    '/governance/minutes',
    '/governance/minutes/2026-03',
    '/meeting',
    '/champions',
    '/contact',
  ]
  const MIXES = [
    ['newAbout and newNews off', {}],
    ['newAbout on', { newAbout: true }],
    ['newNews on', { newNews: true }],
    ['newAbout and newNews on', { newAbout: true, newNews: true }],
  ] as const

  it.each(MIXES)('in the About section is the row the About menu marks, at every About page, with %s', (mix, switches) => {
    Object.assign(flags, A11Y_ON, switches)
    for (const path of ABOUT_PATHS) {
      const menu = markedInAboutMenu(path)
      draw(path)
      expect(nameOf(sectionItems().find((item) => item.className.split(/\s+/).includes('bg-[#fbfaf6]'))!), `${path}, ${mix}`).toBe('About')
      expect(markedInSheet(), `${path}, ${mix}`).toEqual(menu)
      // One row at most: none where a switch has moved the page's row to an address of its own.
      expect(menu.length, `${path}, ${mix}`).toBeLessThanOrEqual(1)
      cleanup()
    }
  })

  it('in the About section marks a row at every About page while newAbout and newNews are off, as the site runs today', () => {
    for (const path of ABOUT_PATHS) {
      draw(path)
      expect(markedInSheet(), path).toHaveLength(1)
      cleanup()
    }
  })

  it.each([
    ['/clubs', {}, 'All clubs'],
    ['/clubs', { newClubs: true }, 'All clubs'],
    ['/clubs/fx-club-north', {}, 'All clubs'],
    ['/tournaments', { newTournaments: true }, 'All tournaments'],
    ['/tournaments/fx-open-2026', { newTournaments: true, newNews: true }, 'All tournaments'],
    ['/scanner', { newTournaments: true }, 'Scoresheet scanner'],
  ] as const)('at %s with %j is %s alone: the first of the rows that tie for the longest address the path sits under', (path, switches, expected) => {
    Object.assign(flags, A11Y_ON, switches)
    draw(path)
    openEverySection()
    expect(markedInSheet()).toEqual([`${expected} page`])
  })

  it('is one link at most in the whole sheet, every section open, on every page a section owns, with every mix of the switches its rows wait for', { timeout: 120_000 }, () => {
    const PATHS = ['/', '/tournaments', '/tournaments/fx-open-2026', '/scanner', '/clubs', '/clubs/fx-club-north', '/scholastic', '/news', '/news/fx-post', '/membership', '/membership/success', '/donate/success', ...ABOUT_PATHS, '/support', '/dashboard', '/login']
    const SWITCHES = ['newTournaments', 'newNews', 'newClubs', 'newAbout'] as const
    for (let mask = 0; mask < 1 << SWITCHES.length; mask++) {
      const on = Object.fromEntries(SWITCHES.map((name, i) => [name, (mask & (1 << i)) !== 0]))
      Object.assign(flags, A11Y_ON, on)
      for (const path of PATHS) {
        draw(path)
        openEverySection()
        const marked = [...sheet().querySelectorAll('[aria-current]')]
        expect(marked.length, `${path} with ${JSON.stringify(on)}`).toBeLessThanOrEqual(1)
        // What is marked is a link of the page's own section, never a button, the account rows or the links under them.
        for (const el of marked) {
          expect(el.tagName, path).toBe('A')
          expect(el.closest('[data-slot="menu-sheet-sections"] > li')!.className.split(/\s+/), path).toContain('bg-[#fbfaf6]')
        }
        cleanup()
      }
    }
  })
})

// ── Every row's address ────────────────────────────────────────────────────

/** Every link the sheet draws, every section open: its words and where it goes. */
function drawnLinks(): Array<[string, string | null]> {
  return [...sheet().querySelectorAll('a')].map((a) => [(a.textContent ?? '').trim(), a.getAttribute('href')])
}

/** The same, as src/lib/nav.ts gives them for the person on the page with the switches as they stand. */
function modelLinks(person: NavPersona, pathname: string): Array<[string, string | null]> {
  const signedIn = person.user !== null
  const status = person.answers?.me.member.membership_status
  const joinSlot = signedIn ? (status === 'expired' ? 'renew' : status === 'none' ? 'joinLca' : null) : undefined
  const model = navSheet({ pathname, signedIn, joinSlot, person: person.holds ? { ...person.holds, hasChildren: false } : null }, FEATURES)
  const entry = (id: NavId) => navEntry(id, FEATURES)
  const out: Array<[string, string | null]> = []
  for (const section of model.sections) {
    const own = entry(section.section)
    if (section.rows.length === 0) out.push([`${own.label}${section.note ?? ''}`, own.href])
    for (const row of section.rows) out.push([sheetRowLabel(row), entry(row.entry).href])
  }
  for (const id of model.utilities) if (entry(id).href !== null) out.push([entry(id).label, entry(id).href])
  for (const id of model.roles) out.push([entry(id).label, entry(id).href])
  for (const id of model.links) out.push([entry(id).label, entry(id).href])
  return out
}

describe('every row\'s address', () => {
  const MIXES = [
    ['the a11y-on build\'s switches', {}],
    ['newTournaments, newNews and newClubs on', { newTournaments: true, newNews: true, newClubs: true }],
    ['newAbout and newNews on', { newAbout: true, newNews: true }],
    ['newMembership on', { newMembership: true }],
    ['myLcaRail on', { myLcaRail: true }],
  ] as const

  it.each(PERSONA_KEYS)('%s: is the address src/lib/nav.ts gives the row\'s words, with each mix of switches', (key) => {
    const person = navPersona(key)
    for (const [mix, switches] of MIXES) {
      Object.assign(flags, A11Y_ON, switches)
      draw('/', authOf(person))
      openEverySection()
      expect(drawnLinks(), `${person.title}, ${mix}`).toEqual(modelLinks(person, '/'))
      cleanup()
    }
  })

  it('sends Log in to /login, My LCA to /dashboard, Join LCA and Renew to /membership, and the one link out of the site to the Facebook page', () => {
    draw('/')
    const links = new Map(drawnLinks())
    expect(links.get('Log in')).toBe('/login')
    expect(links.get('Join LCA')).toBe('/membership')
    expect(links.get('LCA on Facebook ↗')).toBe(FACEBOOK_URL)
    expect([...links.values()].filter((href) => !href!.startsWith('/'))).toEqual([FACEBOOK_URL])
    cleanup()
    draw('/', authOf(navPersona('expired-member')))
    const theirs = new Map(drawnLinks())
    expect(theirs.get('My LCA')).toBe('/dashboard')
    expect(theirs.get('Renew')).toBe('/membership')
    expect(theirs.has('Log in')).toBe(false)
  })
})

// ── The section open on opening ────────────────────────────────────────────

describe('the section open when the sheet opens', () => {
  it('is the new page\'s after the page changed while the sheet was closed, never the one left open before', async () => {
    draw('/tournaments')
    expect(headOf(sectionNamed('Tournaments')).getAttribute('aria-expanded')).toBe('true')
    // About opened by hand as well, then the sheet closed.
    fireEvent.click(headOf(sectionNamed('About')))
    fireEvent.keyDown(sheet(), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Go to the clubs page' }))
    expect(where()).toBe('/clubs')
    fireEvent.click(opener())
    await screen.findByRole('dialog', { name: 'Menu' })
    const open = sectionItems().filter((item) => headOf(item).getAttribute('aria-expanded') === 'true').map(nameOf)
    expect(open).toEqual(['Clubs'])
    expect(markedInSheet()).toEqual(['All clubs page'])
  })
})

// ── While the sign-in context is still read ────────────────────────────────

describe('while the sign-in context is still read', () => {
  /** The button row's words. */
  const buttons = () => [...sheet().querySelectorAll('[data-slot="menu-sheet-buttons"] > *')].map((el) => el.textContent)

  it.each(['expired-member', 'parent', 'active-member'] as const)('gives %s Donate and My LCA alone while the member is read, then the Join slot their status gives', (key) => {
    const person = navPersona(key)
    const status = person.answers!.me.member.membership_status
    draw('/', authOf(person, { memberLoading: true }))
    expect(buttons()).toEqual(['Donate', 'My LCA'])
    cleanup()
    draw('/', authOf(person))
    expect(buttons()).toEqual(['Donate', 'My LCA', ...(status === 'expired' ? ['Renew'] : status === 'none' ? ['Join LCA'] : [])])
  })

  it('gives Log in and Join LCA, and no account rows, while the sign-in itself is read', () => {
    draw('/', authOf(navPersona('admin'), { loading: true }))
    expect(buttons()).toEqual(['Donate', 'Log in', 'Join LCA'])
    expect(sheet().querySelector('[data-slot="menu-sheet-account"]')).toBeNull()
    expect(inSheet().queryByRole('button', { name: 'Log out' })).toBeNull()
  })
})

// ── The browser bar's colour ───────────────────────────────────────────────

describe('the theme switch in the sheet', () => {
  /** The browser bar's colour the choice sets: the one theme-color meta it owns, or none. */
  const barColour = () => document.head.querySelector(`meta[name="theme-color"][${THEME_COLOR_ATTRIBUTE}]`)?.getAttribute('content') ?? null

  it('sets the browser bar\'s colour as the footer\'s control does: the dark ground for Dark, the navy for Light, and the device\'s own for System', () => {
    draw('/')
    const group = inSheet().getByRole('group', { name: 'Appearance' })
    fireEvent.click(within(group).getByRole('button', { name: 'Dark' }))
    expect(barColour()).toBe(THEME_COLOR_DARK)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(within(group).getByRole('button', { name: 'Light' }))
    expect(barColour()).toBe(THEME_COLOR_LIGHT)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    // The choice is kept for the next page, as the footer's is, and System by keeping nothing.
    expect(window.localStorage.getItem('lca-appearance')).toBe('light')
    fireEvent.click(within(group).getByRole('button', { name: 'System' }))
    expect(barColour()).toBeNull()
    expect(window.localStorage.getItem('lca-appearance')).toBeNull()
  })
})
