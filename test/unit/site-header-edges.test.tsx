// @vitest-environment jsdom
//
// The new header, src/components/layout/SiteHeader.tsx, at its edges. The
// header's own cases are test/unit/site-header.test.tsx and its menus'
// test/unit/site-header-menus.test.tsx; this file holds what lies between
// and around them:
//
// - the row's classes in every state it is drawn in (signed out, active,
//   expired, no membership; each section's page; everything in the bar,
//   Donate in the About menu, the name hidden; newMembership off and on):
//   no gold words, no white fill or veil, no lca-navy class, no navy band
//   class, navy words only on the gold Button's own gold fill, no hex and
//   no data-ground; and in the two menus' panels, no hex but the About
//   menu's current row and its "You are here";
// - an address that only starts like a section's or a row's, as /aboutus
//   or /contacts, marks nothing; a query, a hash or a trailing slash change
//   nothing; Donate, as the About menu's last row, is never "You are here";
// - the Join slot by the member's status alone, whatever the end date says,
//   following the member as it arrives and the session as it ends;
// - Log in on /login with no page handed to it hands none on, never /login
//   itself, so signing in cannot come back to the sign-in page;
// - the one donation dialog, opened from the bar and from the About menu's
//   row, giving the focus back to what opened it when it closes;
// - the squeeze following the account's width as someone signs in and out;
// - the My LCA menu for every role and every mix of seat, region and events
//   directed, with myLcaRail and newMembership off and on: the rows, their
//   order and their addresses are src/lib/nav.ts's for what the sign-in
//   context holds, the children not known, and Log out the one button;
// - --header-h through Navbar: written while the new header is drawn, taken
//   off when the window narrows and today's header stands in, written again
//   when it widens, and never written by today's header.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEMBER_ROLES } from '@/areas/admin/roles'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

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
const { Navbar } = await import('@/components/layout/Navbar')
const { myLcaRows } = await import('@/lib/nav')

const HOME = 'Louisiana Chess Association, home'
const DIALOG = 'Support the Louisiana Chess Association'
const DAY = 86_400_000

/** A day as the API writes a membership's end: days from today, which may be past. */
const dayFrom = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10)

/** A visitor as the header reads one: signed out (null), or signed in with a member as the API gives one, or none yet. */
function visitor(member: { status: string; end?: string | null } | null | 'signed-out' = 'signed-out', more: Partial<AuthContextValue> = {}): AuthContextValue {
  const signedIn = member !== 'signed-out'
  return {
    user: signedIn ? ({ id: 'fx-m-edges' } as User) : null,
    session: null,
    member: signedIn && member ? ({ id: 'fx-m-edges', membership_status: member.status, membership_expiry: member.end ?? null } as unknown as ApiMember) : null,
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
    signOut: async () => {},
    ...more,
  } as unknown as AuthContextValue
}

/** Writes out where the page is and the page it was handed, as /login reads it. */
function Where() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash} from ${from ?? 'nothing'}`}</output>
}

function Page({ path, auth }: { path: string | { pathname: string; state?: unknown }; auth: AuthContextValue }) {
  return (
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <SiteHeader />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
        <button type="button">Something after the header</button>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

const draw = (path: string | { pathname: string; state?: unknown } = '/', auth: AuthContextValue = visitor()) => render(<Page path={path} auth={auth} />)

const header = () => screen.getByRole('banner')
const bar = () => within(header())
const where = () => screen.getByTestId('where').textContent
/** The panel a menu's button names while it is open. */
const panelOf = (button: HTMLElement) => document.getElementById(button.getAttribute('aria-controls') ?? '')
/** The utilities' names in their order, Donate while it is in the bar, then Log in or My LCA, then the slot. */
function utilities(): string[] {
  const group = header().querySelector('[data-slot="site-header-donate"]')!.parentElement!
  return [...group.querySelectorAll('a, button')].filter((el) => !el.closest('[hidden]')).map((el) => el.textContent ?? '')
}

// ── Stand-ins for what jsdom does not lay out ─────────────────────────────

/** A stand-in for ResizeObserver: it keeps each callback, and a test says when sizes changed. */
function stubResizeObserver(): { resized: () => void } {
  const callbacks: (() => void)[] = []
  vi.stubGlobal('ResizeObserver', class {
    constructor(changed: () => void) {
      callbacks.push(changed)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  })
  return { resized: () => act(() => callbacks.forEach((changed) => changed())) }
}

/** The widths of the row's parts, as a laid out page gives them; a hidden part measures nothing. */
const WIDTHS = { 'lca-mark': 30, 'site-header-name': 124, 'site-header-sections': 530, 'site-header-donate': 64 } as Record<string, number>
/** The account's width signed out (Log in and Join LCA) and signed in with Renew (My LCA and Renew). */
const ACCOUNT = { signedOut: 150, withRenew: 190 }

/** Gives the row its room and each part its width; returns ways to change the room and the account's width. */
function stubWidths(room: number, account = ACCOUNT.signedOut) {
  const now = { room, account }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const slot = this.getAttribute('data-slot') ?? ''
    const width = this.closest('[hidden]') ? 0 : slot === 'site-header-account' ? now.account : (WIDTHS[slot] ?? 0)
    return { width, height: 0, top: 0, left: 0, right: width, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockImplementation(function (this: Element) {
    return this.getAttribute('data-slot') === 'site-header-row' ? now.room : 0
  })
  return now
}

/** Each level's natural width with those widths, signed out: jsdom gives no gaps or padding. */
const natural = (account: number) => [30 + 124 + 530 + 64 + account, 30 + 124 + 530 + account, 30 + 530 + account]

/** The level the row shows. */
function levelShown(): 0 | 1 | 2 {
  const donateHidden = header().querySelector('[data-slot="site-header-donate"]')!.hasAttribute('hidden')
  const nameHidden = header().querySelector('[data-slot="site-header-name"]')!.hasAttribute('hidden')
  return nameHidden ? 2 : donateHidden ? 1 : 0
}

/** A stand-in for the browser's media query: it answers the 1024-pixel query, and can say the answer changed. */
function stubWidth(wide: boolean) {
  let answer = wide
  const listeners = new Set<() => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === '(min-width: 1024px)' && answer
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }))
  return (next: boolean) => {
    answer = next
    act(() => listeners.forEach((listener) => listener()))
  }
}

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, myLcaRail: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--header-h')
})

// ── The row's classes (AC4) ────────────────────────────────────────────────

/** A class with its variants taken off, minding brackets: hover:bg-white/10 is bg-white/10. */
function utilityOf(name: string): string {
  let depth = 0
  let last = -1
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]
    if (ch === '[' || ch === '(') depth++
    else if (ch === ']' || ch === ')') depth--
    else if (ch === ':' && depth === 0) last = i
  }
  return name.slice(last + 1)
}

const classesOf = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
/** The gold Button's own element, whose gold fill its navy words sit on. */
const isGoldButton = (el: Element) => el.getAttribute('data-slot') === 'button' && el.getAttribute('data-variant') === 'gold'

/** What a class may not be on the navy row, by what it is. */
const ROW_RULES: [string, (utility: string, raw: string, el: Element) => boolean][] = [
  ['gold words', (u) => /^text-(?:lca-gold|gold(?:-[\w-]+)?)(?:\/\d+)?$/.test(u)],
  ['a white fill or veil', (u) => /^bg-white(?:\/|$)/.test(u)],
  ['an lca-navy class', (_, raw) => raw.includes('lca-navy')],
  ['the navy band class', (u) => /^bg-brand-navy(?:\/\d+)?$/.test(u)],
  ['navy words off the gold Button', (u, _, el) => /^text-brand-navy(?:\/\d+)?$/.test(u) && !isGoldButton(el)],
  ['a hex', (_, raw) => /#[0-9a-f]{3,8}\b/i.test(raw)],
]

/** Every rule an element of the row breaks, by its classes, its data-ground and its own colours. */
function rowFaults(root: Element, skip: (el: Element) => boolean = () => false): string[] {
  const faults: string[] = []
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (skip(el)) continue
    const where = `<${el.tagName.toLowerCase()}${el.getAttribute('data-slot') ? ` data-slot="${el.getAttribute('data-slot')}"` : ''}> ${(el.textContent ?? '').trim().slice(0, 24)}`
    for (const raw of classesOf(el)) {
      for (const [what, breaks] of ROW_RULES) if (breaks(utilityOf(raw), raw, el)) faults.push(`${where}: ${raw} is ${what}`)
    }
    if (el.hasAttribute('data-ground')) faults.push(`${where}: data-ground`)
    if (/(?:^|;)\s*(?:color|background)/i.test(el.getAttribute('style') ?? '')) faults.push(`${where}: a colour of its own in its style`)
  }
  return faults
}

/** The menus' panels, which are light surfaces of their own inside the row. */
const inPanel = (el: Element) => !!el.closest('[data-slot="about-menu"], [data-slot="my-lca-menu"]')

/** What a class may not be on a menu's light panel: the same, but a hex goes by the About menu's current row's own rule. */
const PANEL_RULES = ROW_RULES.filter(([what]) => what !== 'a hex' && what !== 'navy words off the gold Button')

function panelFaults(panel: Element): string[] {
  const faults: string[] = []
  for (const el of [panel, ...panel.querySelectorAll('*')]) {
    for (const raw of classesOf(el)) {
      for (const [what, breaks] of PANEL_RULES) if (breaks(utilityOf(raw), raw, el)) faults.push(`${(el.textContent ?? '').trim().slice(0, 24)}: ${raw} is ${what}`)
      if (/^text-brand-navy/.test(utilityOf(raw))) faults.push(`${(el.textContent ?? '').trim().slice(0, 24)}: ${raw} is navy words on a light panel`)
    }
    if (el.hasAttribute('data-ground')) faults.push(`${(el.textContent ?? '').trim().slice(0, 24)}: data-ground`)
  }
  return faults
}

/** The hex classes in a panel, each as "class on words". */
const hexesIn = (panel: Element) =>
  [panel, ...panel.querySelectorAll('*')].flatMap((el) => classesOf(el).filter((c) => /#[0-9a-f]{3,8}\b/i.test(c)).map((c) => `${c} on ${(el.textContent ?? '').trim()}`))

describe('the reading of the row\'s classes is not blind', () => {
  /** A made-up row holding one element with the given classes and attributes. */
  function planted(html: string): Element {
    const row = document.createElement('div')
    row.innerHTML = html
    return row
  }

  it.each([
    ['<a class="text-lca-gold">Tournaments</a>', 'gold words'],
    ['<a class="hover:text-lca-gold/90">Clubs</a>', 'gold words'],
    ['<a class="text-gold-ink">News</a>', 'gold words'],
    ['<a class="hover:bg-white/10">Clubs</a>', 'a white fill or veil'],
    ['<span class="dark:bg-white/[0.08]">Donate</span>', 'a white fill or veil'],
    ['<span class="bg-white">Donate</span>', 'a white fill or veil'],
    ['<div class="bg-lca-navy">x</div>', 'an lca-navy class'],
    ['<div class="text-lca-navy">x</div>', 'an lca-navy class'],
    ['<div class="bg-brand-navy">x</div>', 'the navy band class'],
    ['<div class="md:bg-brand-navy/90">x</div>', 'the navy band class'],
    ['<a class="text-brand-navy">Log in</a>', 'navy words off the gold Button'],
    ['<a class="bg-[#1a2744]">x</a>', 'a hex'],
    ['<a class="text-[#E6CF86]">x</a>', 'a hex'],
  ])('finds %s as %s', (html, what) => {
    const faults = rowFaults(planted(html))
    expect(faults).toHaveLength(1)
    expect(faults[0]).toContain(`is ${what}`)
  })

  it('finds a data-ground and a colour of an element\'s own, and lets the gold Button keep its navy words', () => {
    expect(rowFaults(planted('<div data-ground="dark">x</div>'))).toEqual([expect.stringContaining('data-ground')])
    expect(rowFaults(planted('<span style="color: #c8a94a">x</span>'))).toEqual([expect.stringContaining('a colour of its own')])
    expect(rowFaults(planted('<a data-slot="button" data-variant="gold" class="bg-lca-gold text-brand-navy hover:bg-lca-gold/90">Join LCA</a>'))).toEqual([])
    expect(rowFaults(planted('<a class="text-white shadow-[inset_0_-2px_0_var(--gold-on-dark)] [&_svg:not([class*=\'size-\'])]:size-4">x</a>'))).toEqual([])
  })

  it('finds navy words and a white veil on a menu\'s panel, and reads its hex classes', () => {
    expect(panelFaults(planted('<a class="text-brand-navy">x</a>'))).toEqual([expect.stringContaining('navy words on a light panel')])
    expect(panelFaults(planted('<a class="hover:bg-white/10">x</a>'))).toEqual([expect.stringContaining('a white fill or veil')])
    expect(hexesIn(planted('<a class="bg-[#f3eedc]">Minutes</a>'))).toEqual(['bg-[#f3eedc] on Minutes'])
  })
})

describe('the row\'s classes in every state it is drawn in (AC4)', () => {
  const PEOPLE = [
    ['signed out', visitor()],
    ['an active member', visitor({ status: 'active', end: dayFrom(200) })],
    ['an expired member', visitor({ status: 'expired', end: dayFrom(-20) })],
    ['a member with no membership', visitor({ status: 'none' })],
  ] as const
  const ROOMS = [
    ['everything in the bar', 10_000, 0],
    ['Donate in the About menu', natural(ACCOUNT.signedOut)[0] - 1, 1],
    ['the name hidden as well', 10, 2],
  ] as const

  it.each([false, true])('with newMembership %s: no gold words, white fill or veil, lca-navy, navy band, stray navy words, hex or data-ground on the row, for every person, page and level of the squeeze', (newMembership) => {
    flags.newMembership = newMembership
    for (const [person, auth] of PEOPLE) {
      for (const [roomName, room, level] of ROOMS) {
        for (const path of ['/', '/tournaments', '/membership', '/governance/minutes']) {
          const observer = stubResizeObserver()
          stubWidths(room)
          draw(path, auth)
          observer.resized()
          const at = `${person}, ${roomName}, at ${path}`
          expect(levelShown(), at).toBe(level)
          expect(rowFaults(header()), at).toEqual([])
          cleanup()
          vi.restoreAllMocks()
          vi.unstubAllGlobals()
        }
      }
    }
  })

  it('on each of the six sections\' pages, the current one\'s line is a shadow in the gold token, never gold words or a hex', () => {
    for (const path of ['/tournaments', '/clubs', '/scholastic', '/news', '/membership', '/about']) {
      draw(path)
      expect(rowFaults(header()), path).toEqual([])
      const current = header().querySelector('[aria-current="page"]')!
      expect(classesOf(current), path).toContain('shadow-[inset_0_-2px_0_var(--gold-on-dark)]')
      cleanup()
    }
  })

  it('keeps the gold Button\'s navy words on its own gold fill, and the Join slot the only gold Button in the row', () => {
    for (const auth of [visitor(), visitor({ status: 'expired', end: dayFrom(-1) }), visitor({ status: 'none' })]) {
      draw('/', auth)
      const golds = [...header().querySelectorAll('[data-variant="gold"]')]
      expect(golds).toHaveLength(1)
      expect(classesOf(golds[0])).toEqual(expect.arrayContaining(['bg-lca-gold', 'text-brand-navy']))
      expect(golds[0].closest('[data-slot="site-header-account"]')).not.toBeNull()
      cleanup()
    }
  })

  it('draws the menus\' panels with no hex but the current About row\'s tint and its "You are here", and nothing else the row may not carry', () => {
    // On an About page: the current row's two hex classes and nothing else.
    draw('/governance/minutes', visitor({ status: 'active', end: dayFrom(200) }))
    const about = bar().getByRole('button', { name: 'About' })
    fireEvent.click(about)
    const aboutPanel = panelOf(about)!
    expect(panelFaults(aboutPanel)).toEqual([])
    expect(hexesIn(aboutPanel)).toEqual(['bg-[#f3eedc] on MinutesYou are here', 'text-[#705718] on You are here'])
    fireEvent.click(about)
    const my = bar().getByRole('button', { name: 'My LCA' })
    fireEvent.click(my)
    const myPanel = panelOf(my)!
    expect(panelFaults(myPanel)).toEqual([])
    expect(hexesIn(myPanel)).toEqual([])
    // The row outside the panels keeps its rules with a panel open.
    expect(rowFaults(header(), inPanel)).toEqual([])
    cleanup()
    // Off the About pages no row is current, so the About menu holds no hex at all.
    for (const path of ['/', '/tournaments', '/support']) {
      draw(path)
      const button = bar().getByRole('button', { name: 'About' })
      fireEvent.click(button)
      expect(hexesIn(panelOf(button)!), path).toEqual([])
      expect(panelFaults(panelOf(button)!), path).toEqual([])
      cleanup()
    }
  })

  it('gives the current About row its dark ground and words as plain tokens, with no opacity form, so dark mode needs no colour mixing', () => {
    draw('/champions')
    fireEvent.click(bar().getByRole('button', { name: 'About' }))
    const row = bar().getByRole('link', { name: 'State champions' })
    const dark = [row, ...row.querySelectorAll('*')].flatMap((el) => classesOf(el).filter((c) => c.startsWith('dark:')))
    expect(dark.sort()).toEqual(['dark:bg-muted', 'dark:text-ink'])
  })
})

// ── Addresses at the edges (AC6) ───────────────────────────────────────────

/** What the header marks at a path: the current section, the About button's mark, and the About menu's current row. */
function marksAt(path: string): { section: string | null; aboutCurrent: boolean; row: string | null; here: number } {
  draw(path)
  const nav = screen.getByRole('navigation', { name: 'Main' })
  const sections = [...nav.querySelectorAll(':scope > a, :scope > div > button')].filter((el) => el.getAttribute('aria-current') === 'page')
  const about = bar().getByRole('button', { name: 'About' })
  fireEvent.click(about)
  const panel = panelOf(about)!
  const row = panel.querySelector('[aria-current="page"]')
  const out = {
    section: sections.length === 1 ? (sections[0].textContent ?? null) : sections.length === 0 ? null : 'several',
    aboutCurrent: about.getAttribute('aria-current') === 'page',
    row: row ? (row.querySelector('span')?.textContent ?? null) : null,
    here: panel.querySelectorAll('[aria-hidden="true"]:not(svg)').length,
  }
  cleanup()
  return out
}

describe('addresses at the edges of a section and of a row (AC6)', () => {
  it.each([
    '/aboutus', '/contacts', '/contact-us', '/meetings', '/champions2026', '/governance-old', '/tournamentsx', '/newsletter', '/clubsuggest', '/membership-card', '/scholastics',
  ])('%s only starts like a section\'s or a row\'s address, and marks nothing', (path) => {
    expect(marksAt(path)).toEqual({ section: null, aboutCurrent: false, row: null, here: 0 })
  })

  it.each([
    ['/governance/minutes?year=2025#march', 'About', 'Minutes'],
    ['/about/', 'About', 'About LCA'],
    ['/champions#records', 'About', 'State champions'],
    ['/contact?subject=club', 'About', 'Contact'],
    ['/tournaments?when=weekend#list', 'Tournaments', null],
    ['/clubs#map', 'Clubs', null],
  ] as const)('%s: a query, a hash or a trailing slash leave the section (%s) and the row (%s) as the page\'s own', (path, section, row) => {
    expect(marksAt(path)).toEqual({ section, aboutCurrent: section === 'About', row, here: row ? 1 : 0 })
  })

  it('with newAbout and newNews on, the old governance and champions addresses mark the About section and no row, since the rows have moved', () => {
    Object.assign(flags, { newAbout: true, newNews: true })
    for (const path of ['/governance/board', '/governance/minutes', '/champions']) {
      expect(marksAt(path), path).toEqual({ section: 'About', aboutCurrent: true, row: null, here: 0 })
    }
    expect(marksAt('/about/bylaws/2024')).toEqual({ section: 'About', aboutCurrent: true, row: 'Bylaws & rules', here: 1 })
  })

  it('never marks Donate, the About menu\'s last row once the bar is tight, as the page a visitor is on, even on /give with newMembership on', () => {
    for (const newMembership of [false, true]) {
      flags.newMembership = newMembership
      for (const path of ['/give', '/donate/success', '/about']) {
        const observer = stubResizeObserver()
        stubWidths(natural(ACCOUNT.signedOut)[0] - 1)
        draw(path)
        observer.resized()
        const about = bar().getByRole('button', { name: 'About' })
        fireEvent.click(about)
        const panel = panelOf(about)!
        const donate = within(panel).getByText('Donate').closest('a, button')!
        const at = `newMembership ${newMembership} at ${path}`
        expect(donate.hasAttribute('aria-current'), at).toBe(false)
        expect(donate.textContent, at).toBe('Donate')
        expect(donate.tagName, at).toBe(newMembership ? 'A' : 'BUTTON')
        if (newMembership) expect(donate.getAttribute('href'), at).toBe('/give')
        expect(panel.querySelectorAll('[aria-current="page"]').length, at).toBe(path === '/about' ? 1 : 0)
        cleanup()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
      }
    }
  })

  it('with newMembership on and the bar tight, the About menu\'s Donate row is a link to /give that opens no dialog', () => {
    flags.newMembership = true
    const observer = stubResizeObserver()
    stubWidths(natural(ACCOUNT.signedOut)[0] - 1)
    draw('/')
    observer.resized()
    const about = bar().getByRole('button', { name: 'About' })
    fireEvent.click(about)
    fireEvent.click(within(panelOf(about)!).getByRole('link', { name: 'Donate' }))
    expect(where()).toBe('/give from nothing')
    expect(about.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ── The Join slot (AC7) ────────────────────────────────────────────────────

describe('the Join slot, by the member\'s status alone (AC7)', () => {
  it.each([
    ['active, with an end date already past (the nightly run not yet come)', { status: 'active', end: dayFrom(-1) }, ['Donate', 'My LCA']],
    ['active, ending today', { status: 'active', end: dayFrom(0) }, ['Donate', 'My LCA']],
    ['active, with no end date', { status: 'active', end: null }, ['Donate', 'My LCA']],
    ['expired, with an end date still to come', { status: 'expired', end: dayFrom(30) }, ['Donate', 'My LCA', 'Renew']],
    ['expired, with no end date', { status: 'expired', end: null }, ['Donate', 'My LCA', 'Renew']],
    ['none, with an old end date', { status: 'none', end: dayFrom(-400) }, ['Donate', 'My LCA', 'Join LCA']],
    ['a status the API no longer sends (pending, retired by migration 0057)', { status: 'pending', end: null }, ['Donate', 'My LCA']],
  ] as const)('%s: %j', (_, member, expected) => {
    draw('/', visitor(member))
    expect(utilities()).toEqual([...expected])
  })

  it('fills the slot once the member arrives, and gives Log in and Join LCA back once the session ends', () => {
    const { rerender } = draw('/', visitor(null, { memberLoading: true }))
    expect(utilities()).toEqual(['Donate', 'My LCA'])
    rerender(<Page path="/" auth={visitor({ status: 'expired', end: dayFrom(-3) })} />)
    expect(utilities()).toEqual(['Donate', 'My LCA', 'Renew'])
    // A renewal the page has just taken: the member read again comes back active.
    rerender(<Page path="/" auth={visitor({ status: 'active', end: dayFrom(365) })} />)
    expect(utilities()).toEqual(['Donate', 'My LCA'])
    rerender(<Page path="/" auth={visitor()} />)
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
    expect(bar().getByRole('link', { name: 'Join LCA' }).getAttribute('href')).toBe('/membership')
  })

  it('shows Log in and Join LCA while the session itself loads, whatever member is left from before', () => {
    draw('/', visitor({ status: 'expired', end: dayFrom(-3) }, { loading: true }))
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
    expect(bar().queryByRole('button', { name: 'My LCA' })).toBeNull()
  })
})

// ── Log in's page (AC7) ────────────────────────────────────────────────────

describe('Log in and the page it hands /login (AC7)', () => {
  it('on /login with no page handed to it, hands none on, never /login itself, so signing in cannot come back to the sign-in page', () => {
    draw('/login')
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from nothing')
  })

  it.each([
    ['/', '/'],
    ['/news/fx-fall-open-report?tag=state%20news#comments', '/news/fx-fall-open-report?tag=state%20news#comments'],
    ['/clubs/fx-club-north#map', '/clubs/fx-club-north#map'],
    ['/a-page-the-site-does-not-have', '/a-page-the-site-does-not-have'],
  ])('from %s, hands /login %s, exactly as the address bar holds it', (path, from) => {
    draw(path)
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe(`/login from ${from}`)
  })

  it('hands the page the person is on now, not the one the header was first drawn on', () => {
    draw('/tournaments?when=weekend')
    fireEvent.click(bar().getByRole('link', { name: 'Clubs' }))
    expect(where()).toBe('/clubs from nothing')
    fireEvent.click(bar().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /clubs')
  })
})

// ── The donation dialog (AC9) ──────────────────────────────────────────────

describe('the one donation dialog (AC9)', () => {
  it('gives the focus back to Donate in the bar when it closes, though a press did not focus it, as some browsers leave a pressed button', async () => {
    draw('/')
    const donate = bar().getByRole('button', { name: 'Donate' })
    expect(document.activeElement).toBe(document.body)
    fireEvent.click(donate)
    const dialog = await screen.findByRole('dialog', { name: DIALOG })
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(donate)
  })

  it('opened from the About menu\'s Donate row, gives the focus back to About, the row being gone with the menu', async () => {
    const observer = stubResizeObserver()
    stubWidths(natural(ACCOUNT.signedOut)[0] - 1)
    draw('/')
    observer.resized()
    const about = bar().getByRole('button', { name: 'About' })
    fireEvent.click(about)
    fireEvent.click(within(panelOf(about)!).getByRole('button', { name: 'Donate' }))
    const dialog = await screen.findByRole('dialog', { name: DIALOG })
    expect(panelOf(about)).toBeNull()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(about)
  })

  it('is one dialog whichever Donate opens it: from the bar, then, once the bar is tight, from the About menu', async () => {
    const observer = stubResizeObserver()
    const widths = stubWidths(10_000)
    draw('/')
    observer.resized()
    fireEvent.click(bar().getByRole('button', { name: 'Donate' }))
    await screen.findByRole('dialog', { name: DIALOG })
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    widths.room = natural(ACCOUNT.signedOut)[0] - 1
    observer.resized()
    expect(levelShown()).toBe(1)
    const about = bar().getByRole('button', { name: 'About' })
    fireEvent.click(about)
    fireEvent.click(within(panelOf(about)!).getByRole('button', { name: 'Donate' }))
    await screen.findByRole('dialog', { name: DIALOG })
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(screen.getAllByText('Amount (USD)')).toHaveLength(1)
  })

  it('draws nothing of the dialog until Donate is first pressed', () => {
    draw('/')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Amount (USD)')).toBeNull()
    expect(document.querySelectorAll('[data-slot^="dialog"]')).toHaveLength(0)
  })
})

// ── The squeeze and the account (AC10) ─────────────────────────────────────

describe('the squeeze as someone signs in and out (AC10)', () => {
  it('reads the account\'s width as it changes: a room that holds Log in and Join LCA with Donate gives way when My LCA and Renew take their place, and comes back when they go', () => {
    const observer = stubResizeObserver()
    const [signedOut] = natural(ACCOUNT.signedOut)
    const widths = stubWidths(signedOut, ACCOUNT.signedOut)
    const { rerender } = draw('/', visitor())
    observer.resized()
    expect(levelShown()).toBe(0)
    // Signed in, with Renew: the account is wider, and Donate no longer fits.
    rerender(<Page path="/" auth={visitor({ status: 'expired', end: dayFrom(-5) })} />)
    widths.account = ACCOUNT.withRenew
    observer.resized()
    expect(levelShown()).toBe(1)
    expect(utilities()).toEqual(['My LCA', 'Renew'])
    // Signed out again: the room holds everything once more.
    rerender(<Page path="/" auth={visitor()} />)
    widths.account = ACCOUNT.signedOut
    observer.resized()
    expect(levelShown()).toBe(0)
    expect(utilities()).toEqual(['Donate', 'Log in', 'Join LCA'])
  })

  it.each([
    ['signed out', visitor(), ['Log in', 'Join LCA']],
    ['an expired member', visitor({ status: 'expired', end: dayFrom(-5) }), ['My LCA', 'Renew']],
    ['a member with no membership', visitor({ status: 'none' }), ['My LCA', 'Join LCA']],
    ['an active member', visitor({ status: 'active', end: dayFrom(90) }), ['My LCA']],
  ] as const)('keeps every section, Log in or My LCA and the Join slot in the bar at the last level: %s', (_, auth, account) => {
    const observer = stubResizeObserver()
    stubWidths(1)
    draw('/', auth)
    observer.resized()
    expect(levelShown()).toBe(2)
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect([...nav.querySelectorAll(':scope > a, :scope > div > button')].map((el) => el.textContent)).toEqual(['Tournaments', 'Clubs', 'Scholastic', 'News', 'Membership', 'About'])
    expect(utilities()).toEqual([...account])
    expect(bar().getByRole('link', { name: HOME }).getAttribute('href')).toBe('/')
  })
})

// ── The My LCA menu for everyone (AC8) ─────────────────────────────────────

describe('the My LCA menu for every role and holding (AC8)', () => {
  const HOLDINGS = MEMBER_ROLES.flatMap((role) =>
    [false, true].flatMap((isBoardMember) => [0, 2].flatMap((managedClubs) => [0, 1].map((directedEvents) => ({ role, isBoardMember, managedClubs, directedEvents })))),
  )

  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('with myLcaRail %s and newMembership %s, holds src/lib/nav.ts\'s rows, in order and with their addresses, for each of the people the sign-in context can describe', (myLcaRail, newMembership) => {
    Object.assign(flags, { myLcaRail, newMembership })
    expect(HOLDINGS).toHaveLength(MEMBER_ROLES.length * 8)
    for (const holds of HOLDINGS) {
      const auth = visitor(
        { status: 'active', end: dayFrom(120) },
        {
          role: holds.role,
          isBoardMember: holds.isBoardMember,
          managedClubs: Array.from({ length: holds.managedClubs }, (_, i) => ({ id: `fx-club-${i}`, name: `Fixture Club ${i}`, region: 'North Louisiana' })),
          directedTournamentIds: Array.from({ length: holds.directedEvents }, (_, i) => `fx-t-${i}`),
        } as Partial<AuthContextValue>,
      )
      draw('/', auth)
      const my = bar().getByRole('button', { name: 'My LCA' })
      fireEvent.click(my)
      const drawn = [...panelOf(my)!.querySelectorAll('a, button')].map((el) => [el.textContent, el.getAttribute('href'), el.tagName])
      const expected = myLcaRows({ ...holds, hasChildren: false }).map((row) => [row.label, row.href, row.href === null ? 'BUTTON' : 'A'])
      const who = JSON.stringify(holds)
      expect(drawn, who).toEqual(expected)
      expect(drawn.at(-1), who).toEqual(['Log out', null, 'BUTTON'])
      expect(drawn.filter(([label]) => label === 'Family'), `${who}: no Family row while the children are not known`).toEqual([])
      cleanup()
    }
  })
})

// ── --header-h through Navbar (AC3, AC11) ──────────────────────────────────

describe('--header-h through Navbar (AC3, AC11)', () => {
  /** jsdom lays nothing out, so the header's height is given: what offsetHeight reads for the new header. */
  function headerHeight(px: number) {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.getAttribute('data-slot') === 'site-header' ? px : 65
    })
  }
  const written = () => document.documentElement.style.getPropertyValue('--header-h')
  function drawNavbar(path = '/') {
    return render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[path]}>
          <Navbar />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }
  const banners = () => screen.getAllByRole('banner')

  it('is written while the new header is drawn, taken off as the window narrows and today\'s header stands in, and written again as it widens', () => {
    headerHeight(64)
    const cross = stubWidth(true)
    drawNavbar()
    expect(banners()).toHaveLength(1)
    expect(banners()[0].getAttribute('data-slot')).toBe('site-header')
    expect(written()).toBe('64px')
    cross(false)
    expect(banners()).toHaveLength(1)
    expect(banners()[0].getAttribute('data-slot')).toBeNull()
    expect(written()).toBe('')
    cross(true)
    expect(banners()[0].getAttribute('data-slot')).toBe('site-header')
    expect(written()).toBe('64px')
  })

  it.each([
    [{ newNav: false, newLook: false }],
    [{ newNav: true, newLook: false }],
    [{ newNav: false, newLook: true }],
  ])('is never written by today\'s header, with %j, at any width', (switches) => {
    Object.assign(flags, switches)
    headerHeight(64)
    for (const wide of [true, false]) {
      stubWidth(wide)
      drawNavbar()
      expect(written(), `wide ${wide}`).toBe('')
      cleanup()
    }
  })

  it('is taken off when the chrome is turned off and the page draws today\'s header again', () => {
    headerHeight(64)
    stubWidth(true)
    const { unmount } = drawNavbar()
    expect(written()).toBe('64px')
    unmount()
    expect(written()).toBe('')
    flags.newNav = false
    drawNavbar()
    expect(written()).toBe('')
  })

  it('leaves alone a --header-h the page did not get from the new header, with today\'s header drawn', () => {
    document.documentElement.style.setProperty('--header-h', '99px')
    stubWidth(false)
    drawNavbar()
    expect(written()).toBe('99px')
  })
})
