// @vitest-environment jsdom
//
// The page frame in src/App.tsx (WS02 step 3, the brief's AC13 and AC23),
// at its edges. test/unit/app-frame.test.tsx draws the frame round a page
// whose code is held back; this file draws it round pages as they arrive,
// each page's own content stood in for, since only the frame is read here:
//
// - with the chrome on, "Skip to content" is the first stop on every kind of
//   page: the homepage, which is not loaded on demand, pages that are, a
//   heritage page in its layout with themeHeritage on and off, a page a
//   signed-out visitor is sent away from, and an address with no page; it
//   points at the one element with the id main-content, the frame's own
//   main, and no other file of the site writes that id
// - once a page is there, the main holds the same markup with the chrome on
//   and off, so the frame adds nothing inside it, and with the chrome off
//   the frame is today's on every one of those pages
// - the switches are read as the page is drawn: the same App, drawn again
//   after they change, draws the skip link and the main's id or takes them
//   away
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { type ReactElement } from 'react'
import { MemoryRouter, Outlet } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ newNav: false, newLook: false, themeHeritage: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newNav() {
        return flags.newNav
      },
      get newLook() {
        return flags.newLook
      },
      get themeHeritage() {
        return flags.themeHeritage
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
const api = vi.hoisted(() => ({ getAnnouncements: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

// Each page stands in as its heading alone; the heritage layout as a box round its page.
vi.mock('@/pages/HomePage', () => ({ HomePage: () => <h1>The home page</h1> }))
vi.mock('@/pages/TournamentsPage', () => ({ TournamentsPage: () => <h1>The tournaments page</h1> }))
vi.mock('@/pages/AboutPage', () => ({ AboutPage: () => <h1>The about page</h1> }))
vi.mock('@/pages/MembershipPage', () => ({ MembershipPage: () => <h1>The membership page</h1> }))
vi.mock('@/pages/LoginPage', () => ({ LoginPage: () => <h1>The login page</h1> }))
vi.mock('@/layouts/HeritageLayout', () => ({
  HeritageLayout: () => (
    <div data-theme="heritage">
      <Outlet />
    </div>
  ),
}))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

const ROOT = resolve(__dirname, '../..')

/** A visitor who is not signed in. */
const visitor = {
  user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
  assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
  impersonating: null, exitImpersonation: async () => {},
} as unknown as AuthContextValue

const tree = (path: string): ReactElement => (
  <AuthContext.Provider value={visitor}>
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  </AuthContext.Provider>
)

/** The whole site at an address, once its page is there (or, at an address with no page, once the frame is drawn). */
async function site(path: string, heading: string | null) {
  let view!: ReturnType<typeof render>
  await act(async () => {
    view = render(tree(path))
  })
  if (heading) await screen.findByRole('heading', { level: 1, name: heading })
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return view
}

/** What Tab reaches, in the order of the page. */
const tabStops = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'))

/** The frame's own main: the main that is a child of the frame's root. */
const frameMain = (container: HTMLElement) => container.firstElementChild!.querySelector<HTMLElement>(':scope > main')!

const PAGES = [
  ['the homepage, which is not loaded on demand', '/', 'The home page', false],
  ['a page loaded on demand', '/tournaments', 'The tournaments page', false],
  ['a page loaded on demand that brief 1.4 measures', '/membership', 'The membership page', false],
  ['a heritage page, themeHeritage off', '/about', 'The about page', false],
  ['a heritage page in its layout, themeHeritage on', '/about', 'The about page', true],
  ['a page a signed-out visitor is sent away from, to the login page', '/dashboard', 'The login page', false],
  ['an address with no page', '/no-such-page', null, false],
] as const

beforeEach(() => {
  flags.newNav = false
  flags.newLook = false
  flags.themeHeritage = false
  sessionStorage.clear()
  api.getAnnouncements.mockReset()
  api.getAnnouncements.mockResolvedValue({ announcements: [] })
})
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-look')
})

describe('with the chrome on, on every kind of page', () => {
  it.each(PAGES)('%s: "Skip to content" is the first stop, and points at the frame\'s own main, the one element with that id', async (_, path, heading, heritage) => {
    flags.newNav = true
    flags.newLook = true
    flags.themeHeritage = heritage
    const { container } = await site(path, heading)
    const skips = screen.getAllByRole('link', { name: 'Skip to content' })
    expect(skips).toHaveLength(1)
    expect(tabStops(container)[0]).toBe(skips[0])
    expect(container.querySelectorAll('#main-content')).toHaveLength(1)
    const main = frameMain(container)
    expect(main.id).toBe('main-content')
    expect(skips[0].getAttribute('href')).toBe(`#${main.id}`)
    expect(main.hasAttribute('tabindex')).toBe(false)
    if (heading) expect(main.querySelector('h1')?.textContent).toBe(heading)
    if (heritage) expect(main.querySelector('[data-theme="heritage"] h1')?.textContent).toBe(heading)
    // No loading line is left once the page is there.
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('the frame adds nothing inside the main', () => {
  it.each(PAGES)('%s: the main holds the same markup with the chrome on and off, and with it off the frame is today\'s', async (_, path, heading, heritage) => {
    flags.themeHeritage = heritage
    const off = await site(path, heading)
    const offMain = frameMain(off.container)
    expect(offMain.outerHTML.startsWith('<main class="flex-1">')).toBe(true)
    expect(screen.queryByRole('link', { name: 'Skip to content' })).toBeNull()
    expect(off.container.querySelector('#main-content, [data-skip-link]')).toBeNull()
    const inside = offMain.innerHTML
    cleanup()
    flags.newNav = true
    flags.newLook = true
    const on = await site(path, heading)
    const onMain = frameMain(on.container)
    expect(onMain.outerHTML.startsWith('<main class="flex-1" id="main-content">')).toBe(true)
    expect(onMain.innerHTML).toBe(inside)
  })
})

describe('the switches, read as the page is drawn', () => {
  it('the same App, drawn again after they change, draws the skip link and the main\'s id, then takes them away', async () => {
    const view = await site('/tournaments', 'The tournaments page')
    const drawn = () => ({
      skip: screen.queryAllByRole('link', { name: 'Skip to content' }).length,
      id: frameMain(view.container).getAttribute('id'),
    })
    expect(drawn()).toEqual({ skip: 0, id: null })
    flags.newNav = true
    flags.newLook = true
    await act(async () => view.rerender(tree('/tournaments')))
    expect(drawn()).toEqual({ skip: 1, id: 'main-content' })
    flags.newLook = false
    await act(async () => view.rerender(tree('/tournaments')))
    expect(drawn()).toEqual({ skip: 0, id: null })
    expect(frameMain(view.container).outerHTML.startsWith('<main class="flex-1">')).toBe(true)
  })
})

describe('the skip link\'s target in the site\'s code', () => {
  /** Every file under src/, as paths from the project's root. */
  function walk(folder: string): string[] {
    return readdirSync(join(ROOT, folder), { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`],
    )
  }

  it('is written by src/App.tsx alone, and the one other main of the site, the admin panel\'s, has no id', () => {
    const files = walk('src').filter((f) => /\.(tsx?|css|html)$/.test(f))
    expect(files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('main-content')).sort()).toEqual(['src/App.tsx', 'src/index.css'])
    // Comments name "the <main> that src/App.tsx puts round every route"; only the code counts.
    const code = (f: string) => readFileSync(join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const mains = files.flatMap((f) => [...code(f).matchAll(/<main\b[^>]*>/g)].map((m) => `${f}: ${m[0]}`))
    expect(mains).toEqual(['src/App.tsx: <main className="flex-1" {...(chrome ? { id: MAIN_ID } : {})}>', 'src/pages/AdminPage.tsx: <main className="min-w-0">'])
  })
})
