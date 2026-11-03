// @vitest-environment jsdom
//
// The footer items the reviews of WS02 step 8 handed on, at the edges the
// tests of WS02 step 9 leave (src/components/layout/SiteFooter.tsx), drawn
// with the chrome on under a router and a sign-in context, the window's
// width moved through a stand-in for matchMedia that tells its listeners,
// as a browser does:
//
// - the focus kept as the window crosses 768 pixels, there and back: a
//   fold button's focus handed to its column's first link and back to the
//   button as the window narrows again; a link in a column opened below 768
//   kept where it is; a fold button pressed before the window widens; the
//   focus on the brand block's Donate, on a trust line link or outside the
//   footer left where it is; and nothing moved as the window crosses 1024;
// - the brand block's row at the last phone width and the first tablet
//   one, and where the width cannot be asked, by the join slot; and a
//   membership that ends while the page is open;
// - the trust line's dots as the window crosses 1024 and 768 while the
//   footer stays drawn: none and a gap below 1024, four from it, and one
//   fact a line below 768.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiMember } from '@/areas/membership/api'
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

const { SiteFooter } = await import('@/components/layout/SiteFooter')

/** A visitor as the footer reads one: signed out, or signed in with a member's status. */
function visitor(signed: { status?: ApiMember['membership_status']; memberLoading?: boolean } | null = null): AuthContextValue {
  return {
    user: signed ? ({ id: 'fx-m-carried' } as User) : null,
    session: null,
    member: signed?.status ? ({ id: 'fx-m-carried', membership_status: signed.status, membership_expiry: '2027-06-30' } as ApiMember) : null,
    role: 'member',
    seats: [],
    managedClubs: [],
    isBoardMember: false,
    assuranceLevel: signed ? 'aal1' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: false,
    memberLoading: signed?.memberLoading ?? false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** A window whose width the test moves, its media queries answered and their listeners told as a browser does; gives the mover. */
function liveWidth(start: number | null) {
  const now = { width: start }
  if (start === null) {
    vi.stubGlobal('matchMedia', undefined)
    return () => {
      throw new Error('a window whose width cannot be asked cannot be moved')
    }
  }
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      const m = /^\(min-width: ([\d.]+)px\)$/.exec(query.trim())
      return m ? (now.width ?? 0) >= Number(m[1]) : false
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return (width: number) => {
    now.width = width
    act(() => listeners.forEach((listener) => listener()))
  }
}

/** The footer with a button outside it, as a page has controls of its own. */
const tree = (auth: AuthContextValue) => (
  <AuthContext.Provider value={auth}>
    <MemoryRouter>
      <button type="button">A control of the page</button>
      <SiteFooter />
    </MemoryRouter>
  </AuthContext.Provider>
)
const draw = (auth: AuthContextValue = visitor()) => render(tree(auth))

const footer = () => screen.getByRole('contentinfo')
const columns = () => [...footer().querySelectorAll<HTMLElement>('[data-slot="footer-column"]')]
/** Each column's fold button, in order, or null where the headings are plain. */
const folds = () => columns().map((nav) => nav.querySelector<HTMLButtonElement>('h2 > button'))
/** A column's first link or button, as the footer draws it at any width. */
const firstOf = (column: number) => columns()[column].querySelector<HTMLElement>('ul a, ul button')!
const brand = () => footer().querySelector<HTMLElement>('[data-slot="footer-brand"]')!
/** The brand block's row of actions: the element after its sentence. */
const actionsRow = () => brand().querySelector('p')!.nextElementSibling as HTMLElement
const trust = () => footer().querySelector<HTMLElement>('[data-slot="trust-line"]')!

let moves: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true })
  moves = vi.spyOn(HTMLElement.prototype, 'focus')
})
afterEach(() => {
  moves.mockRestore()
  cleanup()
  vi.unstubAllGlobals()
})

// ── The focus across 768 pixels ────────────────────────────────────────────

describe('the focus as the window crosses 768 pixels, there and back', () => {
  it('hands a fold button\'s focus to its column\'s first link as the window widens, and back to the button as it narrows again, the column still closed', () => {
    const resize = liveWidth(390)
    draw()
    act(() => folds()[0]!.focus())
    const ours = moves.mock.calls.length
    resize(1280)
    expect(document.activeElement).toBe(firstOf(0))
    expect(document.activeElement!.textContent).toBe('Tournaments')
    resize(390)
    const [play] = folds()
    expect(document.activeElement).toBe(play)
    expect(play!.getAttribute('aria-expanded')).toBe('false')
    resize(1280)
    expect(document.activeElement).toBe(firstOf(0))
    // Each move the footer made, three in all, left the page where it was.
    expect(moves.mock.calls.slice(ours)).toEqual([[{ preventScroll: true }], [{ preventScroll: true }], [{ preventScroll: true }]])
  })

  it('leaves a link where it is when its column was opened below 768 pixels and is open again when the window narrows', () => {
    const resize = liveWidth(390)
    draw()
    fireEvent.click(folds()[0]!)
    resize(1280)
    const link = within(columns()[0]).getByRole('link', { name: 'Tournaments' })
    act(() => link.focus())
    const before = moves.mock.calls.length
    resize(390)
    expect(folds()[0]!.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(link)
    expect(moves.mock.calls.length).toBe(before)
  })

  it('keeps the note of a fold button pressed before the window widens, and hands its focus to the first link of the column it opened', () => {
    const resize = liveWidth(390)
    draw()
    const community = folds()[1]!
    act(() => community.focus())
    fireEvent.click(community)
    expect(folds()[1]!.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(community)
    resize(800)
    expect(document.activeElement).toBe(firstOf(1))
  })

  it('hands the focus of Contact\'s fold button, whose column starts open, to Contact\'s first link', () => {
    const resize = liveWidth(390)
    draw()
    const contact = folds()[3]!
    expect(contact.getAttribute('aria-expanded')).toBe('true')
    act(() => contact.focus())
    resize(1024)
    expect(document.activeElement).toBe(firstOf(3))
  })

  it('leaves the focus on the brand block\'s Donate and on a trust line link, neither of which folds, as the window narrows', () => {
    const resize = liveWidth(1280)
    draw()
    const donate = within(brand()).getByRole('button', { name: 'Donate' })
    act(() => donate.focus())
    resize(390)
    expect(document.activeElement).toBe(donate)
    resize(1280)
    const link = trust().querySelector<HTMLElement>('a')!
    act(() => link.focus())
    const before = moves.mock.calls.length
    resize(390)
    expect(document.activeElement).toBe(link)
    expect(moves.mock.calls.length).toBe(before)
  })

  it('moves nothing as the window widens after the focus left a fold button for a control outside the footer', () => {
    const resize = liveWidth(390)
    draw()
    act(() => folds()[0]!.focus())
    const outside = screen.getByRole('button', { name: 'A control of the page' })
    act(() => outside.focus())
    const before = moves.mock.calls.length
    resize(1280)
    expect(document.activeElement).toBe(outside)
    expect(moves.mock.calls.length).toBe(before)
  })

  it('moves nothing as the window crosses 1024 pixels alone, with a link of a column focused', () => {
    const resize = liveWidth(800)
    draw()
    const link = firstOf(0)
    act(() => link.focus())
    const before = moves.mock.calls.length
    resize(1280)
    resize(1023)
    resize(1024)
    expect(document.activeElement).toBe(link)
    expect(moves.mock.calls.length).toBe(before)
  })
})

// ── The brand block's row ──────────────────────────────────────────────────

describe('the brand block\'s row at the edges of the phone\'s layout', () => {
  it.each([
    ['a visitor signed out at 767 pixels', 767, null, ['grid', 'grid-cols-2', 'gap-2.5'], ['Join LCA', 'Donate']],
    ['an active member at 767 pixels', 767, { status: 'active' as const }, ['grid', 'grid-cols-1', 'gap-2.5'], ['Donate']],
    ['a visitor signed out where the width cannot be asked', null, null, ['grid', 'grid-cols-2', 'gap-2.5'], ['Join LCA', 'Donate']],
    ['an active member where the width cannot be asked', null, { status: 'active' as const }, ['grid', 'grid-cols-1', 'gap-2.5'], ['Donate']],
    ['a visitor signed out at 768 pixels, in a row that wraps', 768, null, ['flex', 'flex-wrap', 'gap-2.5'], ['Join LCA', 'Donate']],
    ['an active member at 768 pixels, in a row that wraps', 768, { status: 'active' as const }, ['flex', 'flex-wrap', 'gap-2.5'], ['Donate']],
  ])('for %s', (_who, width, signed, classes, words) => {
    liveWidth(width)
    draw(visitor(signed))
    expect(actionsRow().className.split(/\s+/)).toEqual(classes)
    expect([...actionsRow().children].map((el) => el.textContent)).toEqual(words)
  })

  it('takes two columns once a membership ends while the page is open, Renew first and Donate beside it', () => {
    liveWidth(390)
    const { rerender } = render(tree(visitor({ status: 'active' })))
    expect(actionsRow().className.split(/\s+/)).toEqual(['grid', 'grid-cols-1', 'gap-2.5'])
    rerender(tree(visitor({ status: 'expired' })))
    expect(actionsRow().className.split(/\s+/)).toEqual(['grid', 'grid-cols-2', 'gap-2.5'])
    expect([...actionsRow().children].map((el) => el.textContent)).toEqual(['Renew', 'Donate'])
  })
})

// ── The trust line's dots ──────────────────────────────────────────────────

describe('the trust line as the window crosses 1024 and 768 pixels while the footer stays drawn', () => {
  const dots = () => trust().querySelectorAll('[aria-hidden="true"]').length
  const classes = () => trust().className.split(/\s+/)

  it('draws no dot and a gap from 768 to 1023 pixels, four dots and no gap from 1024, and one fact a line with no dot below 768', () => {
    const resize = liveWidth(800)
    draw()
    // Its facts and links: four, and a fifth where the page holds the build's date, which this page does not.
    const items = trust().children.length
    expect(items).toBe(4)
    expect([dots(), classes().includes('gap-x-6'), classes().includes('flex')]).toEqual([0, true, true])
    resize(1024)
    expect([dots(), classes().includes('gap-x-6'), classes().includes('flex')]).toEqual([items - 1, false, true])
    resize(1023)
    expect([dots(), classes().includes('gap-x-6')]).toEqual([0, true])
    resize(767)
    expect([dots(), classes().includes('gap-x-6'), classes().includes('flex')]).toEqual([0, false, false])
    resize(1280)
    expect(dots()).toBe(items - 1)
    // The dots are never read: each is hidden from screen readers, and the facts' words have none.
    for (const dot of trust().querySelectorAll('[aria-hidden="true"]')) expect(dot.textContent!.trim()).toBe('·')
  })
})
