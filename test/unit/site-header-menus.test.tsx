// @vitest-environment jsdom
//
// The new header's two menus (WS02 step 5): About ▾
// (src/components/layout/AboutMenu.tsx) and My LCA ▾
// (src/components/layout/MyLcaMenu.tsx), with the keys they share from
// src/components/layout/navMenu.ts, drawn in the header under a router and
// a sign-in context, with the switches they read set through a mocked
// FEATURES:
//
// - by mouse: closed, no panel is drawn and the button says so with
//   aria-expanded and no aria-controls; a click opens it, naming its panel,
//   a click outside, choosing a row and a change of page close it, and
//   nothing opens it on hover;
// - by keyboard: ArrowDown and ArrowUp on the button open it on its first
//   and its last row, the arrows move from row to row and wrap, Home and End
//   go to the ends, Esc closes it and gives the focus back to the button,
//   and the focus leaving it for the rest of the page closes it; Enter and
//   Space are a button's own click, which the browser test presses;
// - the About menu's seven rows and LCA on Facebook ↗, from src/lib/nav.ts,
//   with newAbout and newNews off and on, and "You are here" on the one
//   current row, the longest address the path is at or under;
// - the My LCA menu's rows for each person, as src/lib/nav.ts gives them
//   with the children not known, with myLcaRail off and on, and Log out,
//   which signs the person out and goes to the home page;
// - both panels on the look's raised ground with its ink, giving their
//   controls the look's own ring (data-ring-ground="light").
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { FACEBOOK_URL, YOU_ARE_HERE, myLcaRows, type MyLcaPerson } from '@/lib/nav'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { SiteHeader } = await import('@/components/layout/SiteHeader')

/** A visitor as the header reads one: signed out, or signed in holding what the person holds. */
function visitor(holds: MyLcaPerson | null, signOut: () => Promise<void> = async () => {}): AuthContextValue {
  return {
    user: holds ? ({ id: 'fx-m-menus' } as User) : null,
    session: null,
    member: holds ? ({ id: 'fx-m-menus', membership_status: 'active', membership_expiry: '2027-06-30' } as ApiMember) : null,
    role: holds?.role ?? 'member',
    seats: [],
    managedClubs: Array.from({ length: holds?.managedClubs ?? 0 }, (_, i) => ({ id: `fx-club-${i}`, name: `Fixture Club ${i}`, region: 'North Louisiana' })),
    isBoardMember: holds?.isBoardMember ?? false,
    assuranceLevel: holds ? 'aal2' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: Array.from({ length: holds?.directedEvents ?? 0 }, (_, i) => `fx-t-${i}`),
    loading: false,
    memberLoading: false,
    signOut,
  } as unknown as AuthContextValue
}

const holding = (role: MemberRole, more: Partial<MyLcaPerson> = {}): MyLcaPerson => ({ role, isBoardMember: false, managedClubs: 0, directedEvents: 0, hasChildren: false, ...more })

/** Writes out where the page is. */
function Where() {
  const location = useLocation()
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>
}

function draw(path = '/', auth: AuthContextValue = visitor(null)) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <SiteHeader />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <button type="button">Something after the header</button>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const header = () => screen.getByRole('banner')
const button = (name: string) => within(header()).getByRole('button', { name })
/** The panel a button controls, while it is drawn. */
const panelOf = (trigger: HTMLElement) => document.getElementById(trigger.getAttribute('aria-controls') ?? '')
/** The rows the keyboard moves through, in their order. */
const rowsOf = (panel: HTMLElement) => [...panel.querySelectorAll<HTMLElement>('a[href], button')]
const names = (els: Element[]) => els.map((el) => el.textContent ?? '')
const where = () => screen.getByTestId('where').textContent

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('the About menu by mouse', () => {
  it('draws no panel while closed, and says so: aria-expanded false and no aria-controls', () => {
    draw()
    const about = button('About')
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(about.hasAttribute('aria-controls')).toBe(false)
    expect(about.hasAttribute('aria-haspopup')).toBe(false)
    expect(header().querySelector('[data-slot="about-menu"]')).toBeNull()
    expect(within(header()).queryByRole('link', { name: 'Minutes' })).toBeNull()
  })

  it('opens on a click, naming its panel, on the look\'s raised ground with its ink and the look\'s own ring', () => {
    draw()
    const about = button('About')
    fireEvent.click(about)
    expect(about.getAttribute('aria-expanded')).toBe('true')
    const panel = panelOf(about)!
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('data-slot')).toBe('about-menu')
    expect(panel.getAttribute('data-ring-ground')).toBe('light')
    expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-raised', 'text-ink', 'border-hairline']))
    expect(header().contains(panel)).toBe(true)
    // A second click closes it.
    fireEvent.click(about)
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(panelOf(about)).toBeNull()
  })

  it('never opens on hover', () => {
    draw()
    const about = button('About')
    fireEvent.mouseEnter(about)
    fireEvent.mouseOver(about)
    fireEvent.pointerEnter(about)
    expect(about.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on a press outside it, on a touch outside it, and not on a press inside it', () => {
    draw()
    const about = button('About')
    fireEvent.click(about)
    fireEvent.mouseDown(panelOf(about)!)
    expect(about.getAttribute('aria-expanded')).toBe('true')
    fireEvent.mouseDown(document.body)
    expect(about.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(about)
    fireEvent.touchStart(screen.getByRole('button', { name: 'Something after the header' }))
    expect(about.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when a row is chosen, and the page is the row\'s', () => {
    draw()
    const about = button('About')
    fireEvent.click(about)
    fireEvent.click(within(panelOf(about)!).getByRole('link', { name: 'Minutes' }))
    expect(where()).toBe('/governance/minutes')
    expect(about.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on a change of page that came from elsewhere', () => {
    draw()
    const about = button('About')
    fireEvent.click(about)
    // A click with no press first, so only the change of page can close it.
    fireEvent.click(within(header()).getByRole('link', { name: 'Tournaments' }))
    expect(where()).toBe('/tournaments')
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(panelOf(about)).toBeNull()
  })
})

describe('the About menu by keyboard', () => {
  it('opens on its first row with ArrowDown and its last with ArrowUp; the arrows move and wrap, Home and End go to the ends, Esc gives the focus back', () => {
    draw()
    const about = button('About')
    about.focus()
    fireEvent.keyDown(about, { key: 'ArrowDown' })
    expect(about.getAttribute('aria-expanded')).toBe('true')
    const rows = rowsOf(panelOf(about)!)
    expect(names(rows)).toEqual(['About LCA', 'Board & regions', 'Bylaws & rules', 'Minutes', 'Annual meeting', 'State champions', 'Contact', 'LCA on Facebook ↗'])
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[1])
    fireEvent.keyDown(rows[1], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(rows.at(-1))
    fireEvent.keyDown(rows.at(-1)!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'End' })
    expect(document.activeElement).toBe(rows.at(-1))
    fireEvent.keyDown(rows.at(-1)!, { key: 'Home' })
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'Escape' })
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(about)
    // ArrowUp on the closed button opens it on its last row.
    fireEvent.keyDown(about, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(rowsOf(panelOf(about)!).at(-1))
    // With it open, ArrowDown on the button goes to the first row.
    about.focus()
    fireEvent.keyDown(about, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(rowsOf(panelOf(about)!)[0])
  })

  it('is a button of its own, so Enter and Space give it its click: one shows the panel and the next hides it', () => {
    draw()
    const about = button('About')
    expect(about.tagName).toBe('BUTTON')
    expect(about.getAttribute('type')).toBe('button')
    // Its key handler leaves Enter and Space to the button.
    for (const key of ['Enter', ' ']) expect(fireEvent.keyDown(about, { key }), key).toBe(true)
    fireEvent.click(about)
    expect(about.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(about)
    expect(about.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes once the focus has gone to the rest of the page, as Tab past the last row sends it, and stays open while it moves inside', () => {
    draw()
    const about = button('About')
    about.focus()
    fireEvent.keyDown(about, { key: 'ArrowUp' })
    const rows = rowsOf(panelOf(about)!)
    fireEvent.focusOut(rows.at(-1)!, { relatedTarget: rows[0] })
    expect(about.getAttribute('aria-expanded')).toBe('true')
    // A focus that goes nowhere named (a press on the page) leaves it to the press outside.
    fireEvent.focusOut(rows.at(-1)!, { relatedTarget: null })
    expect(about.getAttribute('aria-expanded')).toBe('true')
    fireEvent.focusOut(rows.at(-1)!, { relatedTarget: within(header()).getByRole('button', { name: 'Donate' }) })
    expect(about.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes on Esc wherever the focus is', () => {
    draw()
    const about = button('About')
    fireEvent.click(about)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(about)
  })
})

describe('the About menu\'s rows', () => {
  const at = (path: string) => {
    draw(path)
    const about = button('About')
    fireEvent.click(about)
    const panel = panelOf(about)!
    const links = [...panel.querySelectorAll('a')]
    const out = {
      rows: links.map((a) => [a.querySelector('span')?.textContent ?? a.textContent, a.getAttribute('href')]),
      current: links.filter((a) => a.getAttribute('aria-current') === 'page').map((a) => a.querySelector('span')!.textContent),
      here: [...panel.querySelectorAll('a span + span')].map((s) => s.textContent?.trim()),
      footer: links.at(-1)!,
    }
    cleanup()
    return out
  }

  it.each([
    [false, false, ['/governance/board', '/governance/bylaws', '/governance/minutes', '/champions']],
    [true, false, ['/about/board', '/about/bylaws', '/about/minutes', '/champions']],
    [false, true, ['/governance/board', '/governance/bylaws', '/governance/minutes', '/about/champions']],
    [true, true, ['/about/board', '/about/bylaws', '/about/minutes', '/about/champions']],
  ] as const)('with newAbout %s and newNews %s: the seven rows from src/lib/nav.ts, four of them moving, and LCA on Facebook below in a new tab', (newAbout, newNews, moved) => {
    Object.assign(flags, { newAbout, newNews })
    const { rows, footer } = at('/')
    expect(rows).toEqual([
      ['About LCA', '/about'],
      ['Board & regions', moved[0]],
      ['Bylaws & rules', moved[1]],
      ['Minutes', moved[2]],
      ['Annual meeting', '/meeting'],
      ['State champions', moved[3]],
      ['Contact', '/contact'],
      ['LCA on Facebook ↗', FACEBOOK_URL],
    ])
    expect(footer.getAttribute('target')).toBe('_blank')
    expect(footer.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it.each([
    ['/about', 'About LCA'],
    ['/governance/board', 'Board & regions'],
    ['/governance/bylaws', 'Bylaws & rules'],
    ['/governance/minutes', 'Minutes'],
    ['/meeting', 'Annual meeting'],
    ['/champions', 'State champions'],
    ['/contact', 'Contact'],
  ] as const)('at %s, "You are here" on %s alone, with aria-current', (path, current) => {
    const { current: marked, here } = at(path)
    expect(marked).toEqual([current])
    expect(here).toEqual([YOU_ARE_HERE])
  })

  it('with newAbout and newNews on, one current row each under /about: the longest address the path is under, so About LCA only when no other row is', () => {
    Object.assign(flags, { newAbout: true, newNews: true })
    expect(at('/about/board').current).toEqual(['Board & regions'])
    expect(at('/about/champions').current).toEqual(['State champions'])
    expect(at('/about/minutes').current).toEqual(['Minutes'])
    expect(at('/about').current).toEqual(['About LCA'])
  })

  it('marks no row on a page outside the About section, and on /governance, which no row opens', () => {
    for (const path of ['/', '/tournaments', '/governance', '/support']) {
      const { current, here } = at(path)
      expect(current, path).toEqual([])
      expect(here, path).toEqual([])
    }
  })

  it('writes "You are here" at 13 pixels and weight 600 beside the current row\'s title, the words src/lib/nav.ts gives, which aria-current says for a screen reader', () => {
    draw('/governance/minutes')
    fireEvent.click(button('About'))
    // The row is named by its title alone: aria-current="page" says it is the page a visitor is on.
    const row = within(header()).getByRole('link', { name: 'Minutes' })
    expect(row.getAttribute('aria-current')).toBe('page')
    const [title, label] = [...row.querySelectorAll('span')]
    expect(title.textContent).toBe('Minutes')
    expect(label.textContent?.trim()).toBe(YOU_ARE_HERE)
    expect(label.getAttribute('aria-hidden')).toBe('true')
    expect(label.className.split(/\s+/)).toEqual(expect.arrayContaining(['text-[13px]', 'font-semibold']))
    expect(row.className.split(/\s+/)).toContain('font-semibold')
  })
})

describe('the My LCA menu', () => {
  const PEOPLE = [
    ['an active member', holding('member'), ['My LCA', 'Log out']],
    ['the director of an event', holding('tournament_director', { directedEvents: 1 }), ['My LCA', 'Workspace', 'Log out']],
    ['a regional representative', holding('member', { isBoardMember: true, managedClubs: 1 }), ['My LCA', 'Board inbox', 'My region’s clubs', 'Log out']],
    ['an LCA admin with a seat', holding('lca_admin', { isBoardMember: true }), ['My LCA', 'Board inbox', 'Admin', 'Log out']],
    ['an officer', holding('lca_officer', { isBoardMember: true }), ['My LCA', 'Board inbox', 'Admin (view only)', 'Log out']],
  ] as const

  /** The menu's rows for a person, opened by a click. */
  function rowsFor(holds: MyLcaPerson): HTMLElement[] {
    draw('/', visitor(holds))
    const my = button('My LCA')
    fireEvent.click(my)
    return rowsOf(panelOf(my)!)
  }

  it('is drawn for someone signed in only, in Log in\'s place', () => {
    draw()
    expect(within(header()).queryByRole('button', { name: 'My LCA' })).toBeNull()
    cleanup()
    draw('/', visitor(holding('member')))
    expect(within(header()).queryByRole('link', { name: 'Log in' })).toBeNull()
    expect(button('My LCA').getAttribute('aria-expanded')).toBe('false')
  })

  it.each(PEOPLE)('%s: its rows, as src/lib/nav.ts gives them with the children not known', (_, holds, expected) => {
    const rows = rowsFor(holds)
    expect(names(rows)).toEqual([...expected])
    expect(names(rows)).toEqual(myLcaRows({ ...holds, hasChildren: false }).map((r) => r.label))
    const href = (name: string) => rows.find((r) => r.textContent === name)?.getAttribute('href') ?? null
    expect(href('My LCA')).toBe('/dashboard')
    if (expected.includes('Workspace' as never)) expect(href('Workspace')).toBe('/workspace')
    if (expected.includes('Board inbox' as never)) expect(href('Board inbox')).toBe('/board/inbox')
    expect(rows.at(-1)!.tagName).toBe('BUTTON')
  })

  it('with myLcaRail on, gives no one a Workspace, Board inbox or My region’s clubs row', () => {
    flags.myLcaRail = true
    for (const [title, holds] of PEOPLE) {
      const rows = names(rowsFor(holds))
      expect(rows.filter((r) => /Workspace|Board inbox|My region/.test(r)), title).toEqual([])
      expect(rows[0], title).toBe('My LCA')
      expect(rows.at(-1), title).toBe('Log out')
      cleanup()
    }
  })

  it('has the About menu\'s keys and grounds', () => {
    draw('/', visitor(holding('lca_admin', { isBoardMember: true })))
    const my = button('My LCA')
    expect(my.hasAttribute('aria-controls')).toBe(false)
    my.focus()
    fireEvent.keyDown(my, { key: 'ArrowDown' })
    const panel = panelOf(my)!
    expect(panel.getAttribute('data-ring-ground')).toBe('light')
    expect(panel.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-raised', 'text-ink']))
    const rows = rowsOf(panel)
    expect(document.activeElement).toBe(rows[0])
    fireEvent.keyDown(rows[0], { key: 'ArrowUp' })
    expect(document.activeElement).toBe(rows.at(-1))
    fireEvent.keyDown(rows.at(-1)!, { key: 'Escape' })
    expect(my.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(my)
    fireEvent.click(my)
    fireEvent.mouseDown(document.body)
    expect(my.getAttribute('aria-expanded')).toBe('false')
  })

  it('logs the person out from its last row and goes to the home page', async () => {
    const signOut = vi.fn(async () => {})
    draw('/tournaments', visitor(holding('member'), signOut))
    const my = button('My LCA')
    fireEvent.click(my)
    fireEvent.click(within(panelOf(my)!).getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(where()).toBe('/'))
    expect(signOut).toHaveBeenCalledTimes(1)
    expect(my.getAttribute('aria-expanded')).toBe('false')
  })

  it('takes the place of Log in, and only one menu is open at a time', () => {
    draw('/', visitor(holding('member')))
    const about = button('About')
    const my = button('My LCA')
    fireEvent.click(about)
    fireEvent.mouseDown(my)
    fireEvent.click(my)
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(my.getAttribute('aria-expanded')).toBe('true')
  })
})
