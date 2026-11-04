// @vitest-environment jsdom
//
// The page frame with the new footer and the dock before it, at its edges
// (WS02 step 8), src/App.tsx drawn whole with the chrome on, signed out,
// beside the two rules of src/index.css that find the footer past the dock:
//
// - the stylesheet: the room for the dock is the footer's own bottom
//   padding, read from --bottom-chrome-h by one rule, no rule gives that
//   room as a margin any more, and no rule finds the footer as the main's
//   next sibling alone;
// - the two rules' selectors, asked of the drawn page: the room reaches the
//   new footer with the dock between it and the main and with no dock at
//   all, at the phone's width, the tablet's and the desktop's, and reaches
//   nothing with the chrome off;
// - the page's order for the keyboard, from its controls in the order they
//   come: the skip link first, every control of the main before the tab
//   bar's, the tab bar's before the footer's, and no control taken out of
//   that order by a tabindex of its own;
// - the page's ids with the Menu sheet open over the footer: each once;
// - the sheet's scroll lock: while the sheet holds the page still its
//   stylesheet gives a right margin to the class the dock carries, which is
//   the class the lock's package names for the purpose, and the margin goes
//   with the sheet;
// - the Menu controls by their slots, in each form of the bars: the Menu
//   tab alone below 768 pixels, the app bar's Menu button alone where the
//   dock hides, the tablet header's from 768 and none from 1024, and the
//   way back to Menu finding each of them, and the brand link where there
//   is no Menu control.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { ROOT, indexCssRules } from './helpers/cssTokens'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), getAnnouncements: async () => ({ announcements: [] }) }))
// A page with a control or two of its own, so the main has its place in the page's order for the keyboard.
vi.mock('@/pages/SupportPage', () => ({
  SupportPage: () => (
    <>
      <h1>The support page</h1>
      <a href="/support?new=1">Open a ticket</a>
      <button type="button">Find a ticket</button>
    </>
  ),
}))

const { wayBack } = await import('@/components/layout/dockParts')

/** The rule that keeps the dock's room under the footer, as src/index.css writes it. */
const ROOM = ':root[data-look="new"] #main-content ~ footer'
/** The rule that keeps the footer from being drawn while the loading line shows. */
const WHILE_LOADING = ':root[data-look="new"] main:has(> [data-loading-line]) ~ footer'

function visitor(): AuthContextValue {
  return {
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
}

/** A stand-in for the browser's media queries, answering min-width, max-width and max-height for a window of this size. */
function stubWindow(size: { width: number; height: number }) {
  const one = (part: string) => {
    const m = /^\((min-width|max-width|max-height): ([\d.]+)px\)$/.exec(part.trim())
    if (!m) return false
    const px = Number(m[2])
    if (m[1] === 'min-width') return size.width >= px
    if (m[1] === 'max-width') return size.width <= px
    return size.height <= px
  }
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.split(',').some(one),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** The whole site at an address, once its page has arrived, under the new look as the page's head script marks it. */
async function site(path = '/support') {
  document.documentElement.setAttribute('data-look', 'new')
  const { default: App } = await import('@/App')
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByRole('heading', { level: 1, name: 'The support page' })
  return view!.container
}

const dock = () => document.querySelector<HTMLElement>('[data-slot="bottom-dock"]')
const footer = () => document.querySelector<HTMLElement>('footer')!
const asked = (selector: string) => [...document.querySelectorAll(selector)]

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute('data-look')
  document.documentElement.style.removeProperty('--bottom-chrome-h')
  document.documentElement.style.removeProperty('--header-h')
})

// ── The stylesheet ─────────────────────────────────────────────────────────

describe('the room under the footer in src/index.css', () => {
  const rules = indexCssRules()

  it('is the footer\'s own bottom padding, read from the dock\'s height by one rule, which finds the footer past the dock', () => {
    const reading = rules.filter((r) => [...r.decls.values()].some((v) => v.includes('--bottom-chrome-h')) && r.selectors.some((s) => /\bfooter\b/.test(s)))
    expect(reading.map((r) => [r.selector, Object.fromEntries(r.decls)])).toEqual([[ROOM, { 'padding-bottom': 'var(--bottom-chrome-h, 0px)' }]])
    expect(reading[0].within).toBe('')
  })

  it('gives the room as a margin nowhere, and finds the footer as the main\'s next sibling alone in no rule', () => {
    const margins = rules.filter((r) => [...r.decls.entries()].some(([prop, value]) => prop.startsWith('margin') && value.includes('--bottom-chrome-h')))
    expect(margins.map((r) => r.selector)).toEqual([])
    expect(rules.flatMap((r) => r.selectors).filter((s) => /\+\s*footer\b/.test(s))).toEqual([])
    // Both rules that find the footer past the main start from the new look's root, as every rule outside the legacy blocks does.
    const pastMain = rules.flatMap((r) => r.selectors).filter((s) => /~\s*footer\b/.test(s))
    expect(pastMain.sort()).toEqual([ROOM, WHILE_LOADING].sort())
  })

  it('leaves the footer\'s own file with no padding at its foot for the rule to fight, and names no id of the page', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/SiteFooter.tsx'), 'utf8')
    const footerTag = /<footer\b[^>]*className="([^"]*)"/.exec(source)
    expect(footerTag).not.toBeNull()
    expect(footerTag![1].split(/\s+/).filter((c) => /^(?:[a-z-]+:)*(?:p|pb|py)-/.test(c))).toEqual([])
    expect(source).not.toContain('main-content')
  })
})

// ── The two rules, asked of the drawn page ─────────────────────────────────

describe('the two rules, asked of the drawn page', () => {
  it('at the phone\'s width the room reaches the new footer with the dock between it and the main, and the loading rule nothing once the page is there', async () => {
    await site()
    const main = document.querySelector('main')!
    expect(dock()).not.toBeNull()
    expect(main.nextElementSibling).toBe(dock())
    expect(asked(ROOM)).toEqual([footer()])
    expect(footer().getAttribute('data-slot')).toBe('site-footer')
    expect(asked(WHILE_LOADING)).toEqual([])
  })

  it.each([
    [{ width: 800, height: 1024 }, 'the tablet\'s'],
    [{ width: 1280, height: 800 }, 'the desktop\'s'],
    [{ width: 390, height: 400 }, 'a short window\'s, where the dock hides,'],
  ])('at %o, %s width, with no dock, the room reaches the new footer, the main\'s next sibling', async (size) => {
    stubWindow(size)
    await site()
    expect(dock()).toBeNull()
    expect(document.querySelector('main')!.nextElementSibling).toBe(footer())
    expect(asked(ROOM)).toEqual([footer()])
  })

  it.each([
    { newLook: false, newNav: false },
    { newLook: true, newNav: false },
    { newLook: false, newNav: true },
  ])('with newLook $newLook and newNav $newNav, the chrome off, neither rule reaches anything, today\'s footer among it', async (mix) => {
    Object.assign(flags, mix)
    await site()
    expect(document.querySelector('main')!.hasAttribute('id')).toBe(false)
    expect(footer().hasAttribute('data-slot')).toBe(false)
    expect(asked(ROOM)).toEqual([])
    expect(asked(WHILE_LOADING)).toEqual([])
  })
})

// ── The order for the keyboard ─────────────────────────────────────────────

/** The controls Tab stops at, in the order they come in the page: none hidden, none taken out of the order. */
function tabStops(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]')].filter(
    (el) => !el.closest('[hidden]') && !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1' && !el.closest('[inert]'),
  )
}

describe('the page\'s order for the keyboard', () => {
  it('at the phone\'s width: the skip link first, every control of the main before the tab bar\'s, the tab bar\'s before the footer\'s, and the footer\'s last', async () => {
    await site()
    const stops = tabStops()
    const part = (el: HTMLElement) =>
      el.hasAttribute('data-skip-link') ? 'skip' : dock()!.contains(el) ? 'dock' : footer().contains(el) ? 'footer' : el.closest('main') ? 'main' : 'bar'
    const parts = stops.map(part)
    expect(parts[0]).toBe('skip')
    const last = (p: string) => parts.lastIndexOf(p)
    const first = (p: string) => parts.indexOf(p)
    // The page's own two controls, between the bar's and the tab bar's.
    expect(parts.filter((p) => p === 'main')).toHaveLength(2)
    expect(first('main')).toBeGreaterThan(last('bar'))
    expect(first('dock')).toBeGreaterThan(last('main'))
    expect(first('dock')).toBeGreaterThan(last('bar'))
    expect(first('footer')).toBeGreaterThan(last('dock'))
    expect(last('footer')).toBe(parts.length - 1)
    // The tab bar's four, in a row.
    expect(parts.filter((p) => p === 'dock')).toHaveLength(4)
    expect(last('dock') - first('dock')).toBe(3)
  })

  it('takes no control out of the page\'s order with a tabindex above nothing, in the dock or in the footer', async () => {
    await site()
    for (const el of [...dock()!.querySelectorAll('[tabindex]'), ...footer().querySelectorAll('[tabindex]')]) {
      expect(Number(el.getAttribute('tabindex')), el.outerHTML.slice(0, 80)).toBeLessThanOrEqual(0)
    }
  })
})

// ── Ids with the sheet open ────────────────────────────────────────────────

describe('the page\'s ids', () => {
  it('are each held once, with the Menu sheet open over the footer at the phone\'s width', async () => {
    await site()
    const tab = document.querySelector<HTMLElement>('[data-slot="menu-tab"]')!
    act(() => tab.focus())
    fireEvent.click(tab)
    await screen.findByRole('dialog', { name: 'Menu' })
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(ids.length).toBeGreaterThan(10)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    // Two theme switches are drawn, the footer's and the sheet's, each named by a label of its own.
    const groups = [...document.querySelectorAll('[role="group"]')].filter((g) => document.getElementById(g.getAttribute('aria-labelledby') ?? '')?.textContent === 'Appearance')
    expect(groups).toHaveLength(2)
    expect(new Set(groups.map((g) => g.getAttribute('aria-labelledby'))).size).toBe(2)
    expect(document.getElementById('appearance-label')).toBeNull()
  })
})

// ── The scroll lock and the dock ───────────────────────────────────────────

describe('the Menu sheet\'s scroll lock and the dock', () => {
  /** The class the lock's package names for an element that keeps its width while the page's scrollbar is taken away. */
  const fullWidth = async () => (await import('react-remove-scroll-bar/constants')).fullWidthClassName as string
  /** What the page's stylesheets say of that class. */
  const ruleFor = (name: string) =>
    [...document.head.querySelectorAll('style')].map((s) => s.textContent ?? '').map((text) => new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? null).filter((body) => body !== null)

  it('gives the dock\'s own class a right margin while the sheet holds the page still, and none once the sheet has closed', async () => {
    const name = await fullWidth()
    await site()
    expect(dock()!.className.split(/\s+/)).toContain(name)
    expect(ruleFor(name)).toEqual([])
    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false)
    const tab = document.querySelector<HTMLElement>('[data-slot="menu-tab"]')!
    act(() => tab.focus())
    fireEvent.click(tab)
    const sheet = await screen.findByRole('dialog', { name: 'Menu' })
    await waitFor(() => expect(document.body.hasAttribute('data-scroll-locked')).toBe(true))
    const [body] = ruleFor(name)
    expect(body).toMatch(/margin-right:\s*\d+(?:\.\d+)?px\s*!important/)
    // The dock is not inside another element of the class, whose margin the package takes away again.
    expect(dock()!.parentElement!.closest(`.${name}`)).toBeNull()
    fireEvent.keyDown(sheet, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.body.hasAttribute('data-scroll-locked')).toBe(false))
    expect(ruleFor(name)).toEqual([])
  })

  it('is the one copy of the lock\'s package the dialogs use, so the class the dock carries is the one their lock styles', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> }
    const copies = Object.keys(lock.packages).filter((key) => key.endsWith('node_modules/react-remove-scroll-bar'))
    expect(copies).toEqual(['node_modules/react-remove-scroll-bar'])
  })
})

// ── The Menu controls by their slots, in each form of the bars ─────────────

describe('the Menu controls by their slots, in each form of the bars', () => {
  const slot = (name: string) => [...document.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`)]

  it('below 768 pixels: the Menu tab alone, in the tab bar, and the way back finds it', async () => {
    await site()
    expect(slot('menu-button')).toEqual([])
    const tabs = slot('menu-tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].closest('[data-slot="tab-bar"]')).not.toBeNull()
    expect(tabs[0].getAttribute('data-tab')).toBe('menu')
    expect(wayBack(null)).toBe(tabs[0])
  })

  it('in a short window, where the dock hides: the app bar\'s Menu button alone, and the way back finds it', async () => {
    stubWindow({ width: 390, height: 400 })
    await site()
    expect(slot('menu-tab')).toEqual([])
    const buttons = slot('menu-button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].closest('[data-slot="app-bar"]')).not.toBeNull()
    expect(buttons[0].getAttribute('aria-haspopup')).toBe('dialog')
    expect(wayBack(null)).toBe(buttons[0])
  })

  it('from 768 pixels: the tablet header\'s Menu button alone, and the way back finds it', async () => {
    stubWindow({ width: 800, height: 1024 })
    await site()
    expect(slot('menu-tab')).toEqual([])
    const buttons = slot('menu-button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].closest('[data-slot="site-header"]')).not.toBeNull()
    expect(wayBack(null)).toBe(buttons[0])
  })

  it('from 1024 pixels: no Menu control at all, and the way back finds the header\'s brand link', async () => {
    stubWindow({ width: 1280, height: 800 })
    await site()
    expect(slot('menu-tab')).toEqual([])
    expect(slot('menu-button')).toEqual([])
    expect(wayBack(null)).toBe(document.querySelector('[data-slot="site-header-brand"]'))
  })
})
