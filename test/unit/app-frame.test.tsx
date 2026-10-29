// @vitest-environment jsdom
//
// The page frame in src/App.tsx (WS02 step 3), drawn whole, as a visitor
// gets it, with a page whose code is held back so the loading line is on
// screen.
//
// - With the chrome on (newNav and newLook, chromeOn in src/lib/nav.ts),
//   "Skip to content" is the first thing in the page a keyboard reaches,
//   before the banners and the header; it points at #main-content, the main
//   carries that id, and a click moves the focus to the main without
//   changing the address. The main holds tabindex -1 from that click until
//   the focus leaves it, and at no other time, so a click on the page's text
//   never takes the focus to it. The loading line keeps its status role,
//   its words and its spinner, and holds the height of the window under the
//   header; Tailwind writes that height with the minus spaced, as calc()
//   needs it to be, so a browser reads it. While it shows, the footer is not
//   drawn: the one rule of src/index.css that hides it reaches the frame's
//   footer through that line alone, and lets it go when the page arrives,
//   so the footer comes with the page and never moves as it does.
// - With every switch off, with newNav on alone and with newLook on alone,
//   nothing of that is drawn: no skip link, the main as it always was, and
//   the loading line exactly as today's markup.
// - When the held page arrives, the loading line goes and the page is there.
//
// The routes, the header and the footer are other tests' to read.
import { resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Loader2 } from 'lucide-react'
import { useEffect, type ReactElement } from 'react'
import { MemoryRouter, useLocation, type Location } from 'react-router-dom'
import { compile } from 'tailwindcss'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { indexCssRules } from './helpers/cssTokens'

const flags = vi.hoisted(() => ({ newNav: false, newLook: false }))
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
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
const api = vi.hoisted(() => ({ getAnnouncements: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

/** Pages whose code the test holds back: Contact never arrives here, Support and News arrive when the test lets them. */
const gates = vi.hoisted(() => {
  const gate = () => {
    let open!: () => void
    const held = new Promise<void>((resolve) => {
      open = resolve
    })
    return { held, open: () => open() }
  }
  return { contact: gate(), support: gate(), news: gate() }
})
vi.mock('@/pages/ContactPage', async () => {
  await gates.contact.held
  return { ContactPage: () => <h1>The contact page</h1> }
})
vi.mock('@/pages/SupportPage', async () => {
  await gates.support.held
  return { SupportPage: () => <h1>The support page</h1> }
})
vi.mock('@/pages/NewsPage', async () => {
  await gates.news.held
  return { NewsPage: () => <h1>The news page</h1> }
})

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

/** A visitor who is not signed in, or an admin viewing the site as a member. */
function visitor(impersonating = false): AuthContextValue {
  return {
    user: null, session: null, member: null, role: 'member', seats: [], managedClubs: [], isBoardMember: false,
    assuranceLevel: null, mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
    impersonating: impersonating ? { id: 'fx-m-p5', fullName: 'Riley Fixture', email: 'riley.fixture@example.org' } : null,
    exitImpersonation: async () => {},
  } as unknown as AuthContextValue
}

/** A gold announcement with a link, as the server gives one. */
const GOLD_ANNOUNCEMENT = {
  id: 'fx-ann-gold', tone: 'gold', size: 'default', message: 'Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.',
  linkUrl: '/tournaments', linkLabel: 'More about the Fixture Open',
}

let location: Location | null = null
/** Keeps the router's address where the test can read it, after each draw. */
function Where() {
  const here = useLocation()
  useEffect(() => {
    location = here
  }, [here])
  return null
}

/** The whole site at an address. */
async function site(path: string, impersonating = false): Promise<HTMLElement> {
  let view: ReturnType<typeof render> | undefined
  const tree: ReactElement = (
    <AuthContext.Provider value={visitor(impersonating)}>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  await act(async () => {
    view = render(tree)
  })
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return view!.container
}

/** What Tab reaches, in the order of the page: every link, button and field, and anything with a tabindex of 0 or more. */
const tabStops = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(
    (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled'),
  )

/** Today's loading line, written as src/App.tsx wrote it before WS02 step 3. */
function todaysLine(): string {
  const { container } = render(
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      <span className="text-sm">Loading…</span>
    </div>,
  )
  const html = container.innerHTML
  cleanup()
  return html
}

const TALL = 'min-h-[calc(100vh-var(--header-h,64px))]'

/** The rules of src/index.css that hide an element while the loading line shows. */
const hiding = indexCssRules().filter((r) => r.decls.get('display') === 'none' && r.selectors.some((s) => s.includes('[data-loading-line]')))
/** The one selector those rules use, which the page's own document is asked for here. */
const FOOTER_WHILE_LOADING = ':root[data-look="new"] main:has(> [data-loading-line]) + footer'
/** What that selector reaches in the page drawn now, under the new look, as the script in the page head marks <html>. */
function hiddenNow(): Element[] {
  document.documentElement.setAttribute('data-look', 'new')
  return [...document.querySelectorAll(FOOTER_WHILE_LOADING)]
}

beforeEach(() => {
  flags.newNav = false
  flags.newLook = false
  location = null
  sessionStorage.clear()
  api.getAnnouncements.mockReset()
  api.getAnnouncements.mockResolvedValue({ announcements: [] })
})
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('data-look')
})
afterAll(() => {
  for (const gate of Object.values(gates)) gate.open()
})

describe('with the chrome off: every switch off, newNav on alone, newLook on alone', () => {
  it.each([
    ['every switch off', false, false],
    ['newNav on and newLook off', true, false],
    ['newLook on and newNav off', false, true],
  ])('%s: no skip link, the main as it always was, and today\'s loading line, byte for byte', async (_, newNav, newLook) => {
    const today = todaysLine()
    flags.newNav = newNav
    flags.newLook = newLook
    const container = await site('/contact')
    expect(screen.queryByRole('link', { name: 'Skip to content' })).toBeNull()
    expect(container.querySelector('[data-skip-link]')).toBeNull()
    expect(container.querySelector('a[href="#main-content"]')).toBeNull()
    expect(container.querySelector('#main-content')).toBeNull()
    const main = container.querySelector('main')!
    expect(main.getAttribute('id')).toBeNull()
    expect(main.hasAttribute('tabindex')).toBe(false)
    expect(main.outerHTML.startsWith('<main class="flex-1">')).toBe(true)
    // The held page leaves the loading line on screen, as today's markup exactly.
    const line = screen.getByRole('status')
    expect(main.contains(line)).toBe(true)
    expect(line.outerHTML).toBe(today)
    expect(main.innerHTML).toBe(today)
    expect(container.innerHTML).not.toContain(TALL)
    // Nothing carries the loading line's marker, so the footer is drawn while the line shows, as today, whatever <html> says.
    expect(container.querySelector('[data-loading-line]')).toBeNull()
    expect(hiddenNow()).toEqual([])
  })
})

describe('with the chrome on: newNav and newLook', () => {
  beforeEach(() => {
    flags.newNav = true
    flags.newLook = true
  })

  it('"Skip to content" is the first thing a keyboard reaches, before the header, and points at the main', async () => {
    const container = await site('/contact')
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    expect(skip.textContent).toBe('Skip to content')
    expect(skip.getAttribute('href')).toBe('#main-content')
    expect(skip.hasAttribute('data-skip-link')).toBe(true)
    // The first child of the page's frame, and the first stop.
    expect(container.firstElementChild?.firstElementChild).toBe(skip)
    const stops = tabStops(container)
    expect(stops[0]).toBe(skip)
    const header = container.querySelector('header, nav')!
    expect(skip.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Hidden until it has the focus, then drawn above the header, and never printed.
    for (const cls of ['sr-only', 'focus:not-sr-only', 'focus:fixed', 'focus:z-[60]', 'bg-raised', 'text-ink', 'print:hidden']) expect(skip.className.split(' '), cls).toContain(cls)
    const main = container.querySelector('main')!
    expect(main.id).toBe('main-content')
    // No tabindex until the skip link is used, so the main is no stop and a click on its text cannot focus it.
    expect(main.hasAttribute('tabindex')).toBe(false)
    expect(stops).not.toContain(main)
  })

  it('a click moves the focus to the main and leaves the address as it was', async () => {
    await site('/contact')
    const before = { ...location! }
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    skip.focus()
    expect(document.activeElement).toBe(skip)
    // The click's own default is prevented, so the address gains no #main-content.
    expect(fireEvent.click(skip)).toBe(false)
    const main = document.getElementById('main-content')!
    expect(document.activeElement).toBe(main)
    expect(main.getAttribute('tabindex')).toBe('-1')
    expect(location?.pathname).toBe(before.pathname)
    expect(location?.hash).toBe('')
    expect(location?.key).toBe(before.key)
    expect(window.location.hash).toBe('')
  })

  it('the main gives its tabindex back when the focus leaves it, and takes it again from the next click', async () => {
    const container = await site('/contact')
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    const main = container.querySelector('main')!
    fireEvent.click(skip)
    expect(document.activeElement).toBe(main)
    act(() => skip.focus())
    expect(document.activeElement).toBe(skip)
    expect(main.hasAttribute('tabindex')).toBe(false)
    expect(tabStops(container)).not.toContain(main)
    // Used again, it works again, and gives the tabindex back again.
    fireEvent.click(skip)
    expect(document.activeElement).toBe(main)
    expect(main.getAttribute('tabindex')).toBe('-1')
    act(() => main.blur())
    expect(document.activeElement).toBe(document.body)
    expect(main.hasAttribute('tabindex')).toBe(false)
  })

  it('is first ahead of an announcement and of the impersonation banner, both drawn', async () => {
    api.getAnnouncements.mockResolvedValue({ announcements: [GOLD_ANNOUNCEMENT] })
    const container = await site('/contact', true)
    await screen.findByText('Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.', { exact: false })
    const stops = tabStops(container)
    const skip = screen.getByRole('link', { name: 'Skip to content' })
    const exit = screen.getByRole('button', { name: 'Exit' })
    const more = screen.getByRole('link', { name: 'More about the Fixture Open' })
    const dismiss = screen.getByRole('button', { name: 'Dismiss: More about the Fixture Open' })
    expect(stops.indexOf(skip)).toBe(0)
    for (const el of [exit, more, dismiss]) expect(stops.indexOf(el)).toBeGreaterThan(0)
    expect(stops.indexOf(exit)).toBeLessThan(stops.indexOf(more))
    // The two banners carry the gold ground's marker, so their ring is navy under the new look.
    expect(exit.closest('[data-ring-ground="gold"]')).not.toBeNull()
    expect(more.closest('[data-ring-ground="gold"]')).not.toBeNull()
  })

  it('the loading line keeps its status role, its words and its spinner, and holds the height of the window under the header', async () => {
    const container = await site('/contact')
    const line = screen.getByRole('status')
    expect(container.querySelector('main')!.contains(line)).toBe(true)
    expect(line.getAttribute('aria-live')).toBe('polite')
    expect(line.className.split(' ')).toContain(TALL)
    expect(within(line).getByText('Loading…')).toBeTruthy()
    expect(line.querySelector('svg.animate-spin[aria-hidden="true"]')).not.toBeNull()
    // Today's row sits at the top of the tall box, as today's line sits in main.
    const row = line.firstElementChild as HTMLElement
    expect(row.className).toBe('flex items-center justify-center gap-2')
    expect(line.className).toBe(`${TALL} py-24 text-muted-foreground`)
  })

  it('while the loading line shows, the footer is not drawn: one rule of src/index.css, outside every layer and media query, reaches the frame\'s footer through that line alone', async () => {
    // One rule, on screen and in print alike, outside every layer, so no utility on the footer outranks it.
    expect(hiding.map((r) => ({ selectors: r.selectors, within: r.within }))).toEqual([{ selectors: [FOOTER_WHILE_LOADING], within: '' }])
    expect(hiding[0].decls.get('display')).toBe('none')
    const container = await site('/contact')
    const line = screen.getByRole('status')
    const main = container.querySelector('main')!
    const footer = container.querySelector('footer')!
    // The line is the main's own child and the only element so marked, and the footer comes right after the main.
    expect(line.getAttribute('data-loading-line')).toBe('')
    expect(line.parentElement).toBe(main)
    expect(container.querySelectorAll('[data-loading-line]')).toHaveLength(1)
    expect(main.nextElementSibling).toBe(footer)
    expect(hiddenNow()).toEqual([footer])
  })
})

describe('when the held page arrives', () => {
  it.each([
    ['with the chrome on', true, '/support', gates.support, 'The support page'],
    ['with the chrome off', false, '/news', gates.news, 'The news page'],
  ])('%s, the loading line goes, the page is there and the footer is drawn', async (_, on, path, gate, heading) => {
    flags.newNav = on
    flags.newLook = on
    const container = await site(path)
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.getByText('Loading…')).toBeTruthy()
    // While the line shows, the footer is not drawn with the chrome on, and is drawn as today with it off.
    expect(hiddenNow()).toEqual(on ? [container.querySelector('footer')] : [])
    gate.open()
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy()
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    // The footer comes with the page.
    expect(container.querySelector('footer')).not.toBeNull()
    expect(hiddenNow()).toEqual([])
  })
})

describe('the loading line\'s height, as Tailwind writes it', () => {
  it('is the window\'s height less the header\'s, with spaces around the minus, without which calc() would read "100vh-var" as a number in a unit it does not know', async () => {
    const ROOT = resolve(__dirname, '../..')
    const compiler = await compile('@tailwind utilities;', { base: ROOT, loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }) })
    const css = compiler.build([TALL]).replace(/\s+/g, ' ')
    expect(css).toContain('.min-h-\\[calc\\(100vh-var\\(--header-h\\,64px\\)\\)\\] {')
    expect(css).toContain('min-height: calc(100vh - var(--header-h,64px));')
  })
})
