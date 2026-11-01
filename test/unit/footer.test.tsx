// @vitest-environment jsdom
//
// The new footer (WS02 step 8), src/components/layout/SiteFooter.tsx, drawn
// as the page frame draws it with the chrome on, under a router and a
// sign-in context, with the switches it reads set through a mocked FEATURES
// and the window's width given through a stand-in for matchMedia, which
// jsdom lacks:
//
// - the four columns, Play, Community, About LCA and Contact, each a nav
//   named by its heading, in the model's order, and every link and button
//   of the footer an entry of src/lib/nav.ts by id, its words and its
//   address the entry's, in four mixes of the switches: every switch off;
//   newAbout on; newNews on; and newTournaments, newNews and newClubs on.
//   Calendar, Results and Suggest a club are drawn only with their
//   switches; Board & regions, Bylaws & rules and Minutes open the About
//   page's tabs with newAbout, in the columns and the trust line alike; and
//   State champions moves with newNews. Donate is a link to /give with
//   newMembership on;
// - one label per destination: Board & regions, Bylaws & rules, Minutes,
//   State champions, Scholastic and Contact read the same in the footer as
//   in the new header and its About menu, and in the Menu sheet;
// - the brand block, never folded: the official logo from its two sized
//   copies with empty words, the name in words, the decided board's
//   sentence, and the join slot by the header's rule: Join LCA signed out,
//   Join LCA for a member with no membership, Renew once one has expired,
//   and nothing for an active member or while the member loads;
// - the trust line, a list named About this site: its facts, its two links
//   and "Site last updated" with the build's date read from the page's
//   build-date meta, put into the head here and taken out after: a made-up
//   instant gives its Louisiana day with its weekday and year, in a time
//   element whose dateTime is the instant, the evening before in Louisiana
//   for a small hour of the morning in UTC; a meta that holds no instant,
//   or none at all, gives no item; the dots between the items drawn from
//   768 pixels up, hidden from screen readers, and none below;
// - the fold: below 768 pixels, and where the width cannot be asked, each
//   heading holds a button with aria-expanded naming its list with
//   aria-controls, Contact open and the rest closed and hidden, each its
//   own switch, the chevron with no transition; from 768 up plain headings
//   over every list, in the gold the guard allows on navy;
// - the layout around the fold, chosen from the same widths: the phone's
//   wherever the columns fold, one part under another; the tablet's from
//   768 pixels, the brand block across two columns over the four; and the
//   desktop's from 1024, the five parts in one row; and no class in the
//   footer's file that asks the stylesheet for a width, since the
//   stylesheet's breakpoints are rem and move with the browser's font size,
//   which would part the layout from the fold;
// - the theme switch: today's control with a label id of its own, never
//   appearance-label, and a pick in it shown in another control drawn
//   beside it;
// - Donate in the brand block and in the Contact column: the same donation
//   dialog, its code fetched through one lazy import, opened from either,
//   the focus back on the one pressed when it closes;
// - the footer itself: one footer, data-slot site-footer, the navy ring
//   ground, the brand navy through its variable and no band class, the gold
//   line along its top and no padding class of its own, the room under it
//   being the dock's (src/index.css).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import lcaLogo from '@/assets/lca-logo.webp'
import lcaLogo112 from '@/assets/lca-logo-112.webp'
import lcaLogo56 from '@/assets/lca-logo-56.webp'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { NavId } from '@/lib/nav'

const OFF = { newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, newTournaments: false, newClubs: false, myLcaRail: false }
const flags = vi.hoisted(() => ({ newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, newTournaments: false, newClubs: false, myLcaRail: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
/** How many times the donation dialog is drawn, to show it is the one the header uses. */
const dialogs = vi.hoisted(() => ({ drawn: 0 }))
vi.mock('@/components/DonateButton', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/DonateButton')>()
  return {
    ...real,
    DonateDialog: (props: Parameters<typeof real.DonateDialog>[0]) => {
      dialogs.drawn += 1
      return <real.DonateDialog {...props} />
    },
  }
})

const { SiteFooter } = await import('@/components/layout/SiteFooter')
const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { MobileMenu } = await import('@/components/layout/MobileMenu')
const { AppearanceControl } = await import('@/components/AppearanceControl')
const { lastUpdated } = await import('@/components/layout/footerParts')
const { FOOTER_BRAND_ACTIONS, TRUST_LINE_LINKS, footerColumns, navEntry, navLabel } = await import('@/lib/nav')

const ROOT = join(__dirname, '../..')
const DIALOG = 'Support the Louisiana Chess Association'
const SENTENCE = 'Tournaments, clubs and scholastic chess across the state, run by volunteers.'

/** A visitor as the footer reads one: signed out, or signed in with a member's status. */
function visitor(signed: { status?: ApiMember['membership_status']; memberLoading?: boolean } | null = null): AuthContextValue {
  return {
    user: signed ? ({ id: 'fx-m-footer' } as User) : null,
    session: null,
    member: signed?.status ? ({ id: 'fx-m-footer', membership_status: signed.status, membership_expiry: '2027-06-30' } as ApiMember) : null,
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

/** A stand-in for matchMedia at a width, which answers min-width queries as a browser does, or no matchMedia at all. */
function stubWidth(width: number | null) {
  if (width === null) {
    vi.stubGlobal('matchMedia', undefined)
    return
  }
  vi.stubGlobal('matchMedia', (query: string) => {
    const m = /^\(min-width: ([\d.]+)px\)$/.exec(query.trim())
    return { matches: m ? width >= Number(m[1]) : false, media: query, addEventListener: () => {}, removeEventListener: () => {} }
  })
}

function draw(auth: AuthContextValue = visitor(), path = '/') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <SiteFooter />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const footer = () => screen.getByRole('contentinfo')
/** The footer's columns: each nav, by its heading's words. */
const columns = () => within(footer()).getAllByRole('navigation', { hidden: true })
/** Every link and button of the footer, as its words and its address, hidden ones included: a closed column's links are in the page. */
function controls(): Array<{ words: string; href: string | null; tag: string }> {
  return [...footer().querySelectorAll('a, button')]
    .filter((el) => !el.closest('[role="group"]'))
    .map((el) => ({ words: el.textContent ?? '', href: el.getAttribute('href'), tag: el.tagName }))
}
/** What the model says one entry is drawn as: its words, and its address or none. */
const asEntry = (id: NavId) => {
  const entry = navEntry(id)
  return { words: entry.label, href: entry.href, tag: entry.href === null ? 'BUTTON' : 'A' }
}

/** The build's date as the plugin writes it into the page, put into the head and taken out after. */
function plantBuildDate(content: string) {
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'build-date')
  meta.setAttribute('content', content)
  document.head.append(meta)
  return meta
}

beforeEach(() => {
  Object.assign(flags, OFF)
  dialogs.drawn = 0
  stubWidth(1280)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  for (const meta of document.head.querySelectorAll('meta[name="build-date"]')) meta.remove()
  document.documentElement.className = ''
  window.localStorage.clear()
})

// ── The footer itself ──────────────────────────────────────────────────────

describe('the footer', () => {
  it('is one footer, the page\'s contentinfo, with its slot, the navy ring ground, the brand navy through its variable, the gold line along its top and no padding of its own', () => {
    const { container } = draw()
    expect(container.querySelectorAll('footer')).toHaveLength(1)
    expect(footer().getAttribute('data-slot')).toBe('site-footer')
    expect(footer().getAttribute('data-ring-ground')).toBe('navy')
    const classes = footer().className.split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['border-t-[3px]', 'border-lca-gold', 'bg-(--color-brand-navy)', 'text-white', 'print:hidden']))
    // The room under its last line is the dock's, the footer's own bottom padding in src/index.css, so no class pads it.
    expect(classes.filter((c) => /^(?:[a-z-]+:)?p[btlrxy]?-/.test(c))).toEqual([])
    // No navy band class and no data-ground on it or inside it, whose ring rule outranks a light surface's own.
    for (const el of [footer(), ...footer().querySelectorAll('*')]) {
      const own = (el.getAttribute('class') ?? '').split(/\s+/)
      expect(own.filter((c) => /(^|:)bg-(brand|lca)-navy\b|lca-navy/.test(c)), el.outerHTML.slice(0, 80)).toEqual([])
      expect(el.hasAttribute('data-ground')).toBe(false)
    }
  })
})

// ── The columns and their links ────────────────────────────────────────────

describe('the four columns and every link an entry by id', () => {
  /** The four mixes of the switches the footer's links read. */
  const MIXES = [
    ['every switch off', {}],
    ['newAbout on', { newAbout: true }],
    ['newNews on', { newNews: true }],
    ['newTournaments, newNews and newClubs on', { newTournaments: true, newNews: true, newClubs: true }],
  ] as const

  it.each(MIXES)('with %s: the model\'s four columns in its order, each a nav named by its heading, holding its live entries\' words and addresses and nothing else', (_mix, on) => {
    Object.assign(flags, on)
    draw()
    const model = footerColumns()
    expect(model.map((c) => c.title)).toEqual(['Play', 'Community', 'About LCA', 'Contact'])
    const navs = columns()
    expect(navs.map((nav) => nav.getAttribute('aria-labelledby') && document.getElementById(nav.getAttribute('aria-labelledby')!)!.textContent)).toEqual(model.map((c) => c.title))
    model.forEach((column, i) => {
      const drawn = [...navs[i].querySelectorAll('li > a, li > button')].map((el) => ({ words: el.textContent ?? '', href: el.getAttribute('href'), tag: el.tagName }))
      expect(drawn, column.title).toEqual(column.links.map(asEntry))
    })
  })

  it('with every switch off: the links today\'s routes open, and no Calendar, Results or Suggest a club', () => {
    draw()
    const byWords = new Map(controls().map((c) => [c.words, c.href]))
    expect(byWords.get('Tournaments')).toBe('/tournaments')
    expect(byWords.get('State champions')).toBe('/champions')
    expect(byWords.get('Club map')).toBe('/clubs#map')
    expect(byWords.get('List or update your club')).toBe('/contact?subject=club')
    expect(byWords.get('Board & regions')).toBe('/governance/board')
    expect(byWords.get('Bylaws & rules')).toBe('/governance/bylaws')
    expect(byWords.get('Minutes')).toBe('/governance/minutes')
    expect(byWords.get('LouisianaChess@gmail.com')).toBe('mailto:LouisianaChess@gmail.com')
    expect(byWords.get('Membership help')).toBe('/contact?subject=membership')
    expect(byWords.get('Website help')).toBe('/support')
    for (const later of ['Calendar', 'Results', 'Suggest a club']) expect(byWords.has(later), later).toBe(false)
  })

  it('with newAbout on: Board & regions, Bylaws & rules and Minutes open the About page\'s tabs, in the About LCA column and in the trust line alike', () => {
    flags.newAbout = true
    draw()
    const about = columns()[2]
    const trust = within(footer()).getByRole('list', { name: 'About this site' })
    for (const [words, href] of [['Board & regions', '/about/board'], ['Bylaws & rules', '/about/bylaws'], ['Minutes', '/about/minutes']] as const) {
      expect(within(about).getByRole('link', { name: words }).getAttribute('href'), words).toBe(href)
    }
    for (const [words, href] of [['Bylaws & rules', '/about/bylaws'], ['Minutes', '/about/minutes']] as const) {
      expect(within(trust).getByRole('link', { name: words }).getAttribute('href'), words).toBe(href)
    }
    expect(within(footer()).getByRole('link', { name: 'State champions' }).getAttribute('href')).toBe('/champions')
  })

  it('with newNews on: State champions opens /about/champions and Results joins Play; the governance links stay at today\'s addresses', () => {
    flags.newNews = true
    draw()
    const play = columns()[0]
    expect(within(play).getByRole('link', { name: 'State champions' }).getAttribute('href')).toBe('/about/champions')
    expect(within(play).getByRole('link', { name: 'Results' }).getAttribute('href')).toBe('/results')
    expect(within(play).queryByRole('link', { name: 'Calendar' })).toBeNull()
    expect(within(footer()).getAllByRole('link', { name: 'Minutes' }).map((a) => a.getAttribute('href'))).toEqual(['/governance/minutes', '/governance/minutes'])
  })

  it('with newTournaments, newNews and newClubs on: Calendar and Results join Play, and Suggest a club joins Community, each where the model puts it', () => {
    Object.assign(flags, { newTournaments: true, newNews: true, newClubs: true })
    draw()
    const [play, community] = columns()
    expect(within(play).getByRole('link', { name: 'Calendar' }).getAttribute('href')).toBe('/tournaments?view=calendar')
    expect(within(play).getByRole('link', { name: 'Results' }).getAttribute('href')).toBe('/results')
    expect(within(community).getByRole('link', { name: 'Suggest a club' }).getAttribute('href')).toBe('/clubs/suggest')
  })

  it('every link and button of the footer is an entry by id: the columns\', the brand block\'s and the trust line\'s, and nothing else', () => {
    draw()
    const expected = [
      ...FOOTER_BRAND_ACTIONS.map(asEntry),
      ...footerColumns().flatMap((column) => column.links.map(asEntry)),
      ...TRUST_LINE_LINKS.map(asEntry),
    ]
    // At 1280 pixels no heading holds a button, so every control of the footer but the theme switch's is one of these.
    expect(controls()).toEqual(expected)
  })

  it('draws LCA on Facebook in a new tab with noopener noreferrer, and the email address as a mail link in this tab, each the entry\'s words', () => {
    draw()
    const facebook = within(footer()).getByRole('link', { name: navLabel('facebook') })
    expect(facebook.getAttribute('href')).toBe(navEntry('facebook').href)
    expect(facebook.getAttribute('target')).toBe('_blank')
    expect(facebook.getAttribute('rel')).toBe('noopener noreferrer')
    const email = within(footer()).getByRole('link', { name: navLabel('email') })
    expect(email.getAttribute('href')).toBe('mailto:LouisianaChess@gmail.com')
    expect(email.hasAttribute('target')).toBe(false)
    // The Contact column opens with it.
    expect(columns()[3].querySelector('li a')).toBe(email)
  })

  it('names no label, address or column of its own in its source: every one comes from src/lib/nav.ts', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/SiteFooter.tsx'), 'utf8')
    for (const words of ['Board & regions', 'Bylaws & rules', 'State champions', 'Membership help', 'Website help', 'LouisianaChess@gmail.com', 'facebook.com', "'/contact", "'/clubs", "'/governance", "'/give", "'Play'", "'Community'", "'About LCA'", "'Contact'", "'Join LCA'", "'Donate'"]) {
      expect(source, words).not.toContain(words)
    }
  })
})

// ── One label per destination ──────────────────────────────────────────────

describe('one label per destination', () => {
  it('Board & regions, Bylaws & rules, Minutes, State champions, Scholastic and Contact read the same in the footer as in the new header, its About menu and the Menu sheet', async () => {
    const auth = visitor()
    const words = (root: Element) => [...root.querySelectorAll('a, button')].map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
    // A control's own words, then at most what follows them in a span of its own: the "You are here" a current row carries, or a section's note.
    const holds = (all: string[], label: string) => all.some((w) => w === label || (w.startsWith(label) && /^[ A-Z]/.test(w.slice(label.length))))
    const IDS = ['boardRegions', 'bylawsRules', 'minutes', 'stateChampions', 'scholastic', 'contact'] as const
    // The header, its About menu open, and the footer, on a page the About menu holds.
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/governance/minutes']}>
          <SiteHeader />
          <SiteFooter />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: navLabel('about') }))
    const inHeader = words(screen.getByRole('banner'))
    const inFooter = words(footer())
    cleanup()
    // The Menu sheet, open on the same page, whose About section is the page's and so open.
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/governance/minutes']}>
          <MobileMenu open onOpenChange={() => {}} shape="full" id="fx-footer-sheet" returnFocus={() => null} onDonate={() => {}} />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const inSheet = words(await screen.findByRole('dialog', { name: navLabel('menu') }))
    for (const id of IDS) {
      const label = navLabel(id)
      expect(inFooter, `footer: ${label}`).toContain(label)
      expect(holds(inHeader, label), `header: ${label}`).toBe(true)
      expect(holds(inSheet, label), `sheet: ${label}`).toBe(true)
    }
  })
})

// ── The brand block ────────────────────────────────────────────────────────

describe('the brand block', () => {
  it('draws the official logo from its sized copies with empty words, the name in words and the decided board\'s sentence, with no plate and no home link', () => {
    draw()
    const brand = footer().querySelector('[data-slot="footer-brand"]')!
    const logos = brand.querySelectorAll('[data-slot="lca-logo"]')
    expect(logos).toHaveLength(1)
    const img = logos[0] as HTMLImageElement
    expect(img.getAttribute('src')).toBe(lcaLogo)
    expect(img.getAttribute('srcset')).toBe(`${lcaLogo56} 1x, ${lcaLogo112} 2x`)
    expect([img.getAttribute('width'), img.getAttribute('height'), img.getAttribute('alt')]).toEqual(['56', '56', ''])
    // Nothing behind it: its parent is the row it sits in, with no ground of its own.
    expect(img.parentElement!.className).not.toMatch(/\bbg-/)
    expect(brand.textContent).toContain('Louisiana Chess Association')
    expect(brand.textContent).toContain(SENTENCE)
    expect(brand.querySelector('a[href="/"]')).toBeNull()
    // None of today's words or buttons.
    for (const words of ['Serving Louisiana players since 1915', 'Follow us on Facebook', 'Find a tournament', 'All rights reserved']) expect(footer().textContent, words).not.toContain(words)
  })

  it.each([
    ['a visitor signed out', visitor(), ['Join LCA', 'Donate']],
    ['a member with no membership', visitor({ status: 'none' }), ['Join LCA', 'Donate']],
    ['a member whose membership has expired', visitor({ status: 'expired' }), ['Renew', 'Donate']],
    ['an active member', visitor({ status: 'active' }), ['Donate']],
    ['a member still loading', visitor({ status: 'expired', memberLoading: true }), ['Donate']],
  ] as const)('for %s, the join slot follows the header\'s rule beside Donate', (_who, auth, expected) => {
    draw(auth)
    const brand = footer().querySelector('[data-slot="footer-brand"]')!
    expect([...brand.querySelectorAll('a, button')].map((el) => el.textContent)).toEqual(expected)
    const join = within(brand as HTMLElement).queryByRole('link', { name: /^(Join LCA|Renew)$/ })
    if (join) {
      expect(join.getAttribute('href')).toBe('/membership')
      expect(join.getAttribute('data-variant')).toBe('gold')
    }
  })
})

// ── The trust line and the build's date ────────────────────────────────────

describe('lastUpdated, the build\'s date read from the page', () => {
  it('gives the instant the meta holds and its Louisiana day with its weekday and year', () => {
    plantBuildDate('2026-10-31T14:42:00.000Z')
    expect(lastUpdated()).toEqual({ instant: '2026-10-31T14:42:00.000Z', text: 'Sat, Oct 31, 2026' })
  })

  it('gives the evening before in Louisiana for a small hour of the morning in UTC', () => {
    plantBuildDate('2026-10-31T03:00:00.000Z')
    expect(lastUpdated()).toEqual({ instant: '2026-10-31T03:00:00.000Z', text: 'Fri, Oct 30, 2026' })
  })

  it.each(['', '2026-10-31', '2026-10-31T14:42', '2026-10-31T14:42:00Z', '2026-10-31T14:42:00.000+00:00', 'Sat, Oct 31, 2026', '2026-13-45T25:61:00.000Z'])('gives nothing for a meta that holds %j, which is no instant in the plugin\'s form', (content) => {
    plantBuildDate(content)
    expect(lastUpdated()).toBeNull()
  })

  it('gives nothing for a page with no meta, as with the chrome off', () => {
    expect(document.querySelector('meta[name="build-date"]')).toBeNull()
    expect(lastUpdated()).toBeNull()
  })
})

describe('the trust line', () => {
  const trust = () => within(footer()).getByRole('list', { name: 'About this site' })
  /** Each item's words, the dots left out. */
  const items = () => [...trust().children].map((li) => [...li.childNodes].filter((n) => !(n instanceof HTMLElement && n.getAttribute('aria-hidden') === 'true')).map((n) => n.textContent).join(''))

  it('is a list named About this site: its two facts, Bylaws & rules and Minutes as links, and Site last updated with the build\'s date in a time element', () => {
    plantBuildDate('2026-10-31T14:42:00.000Z')
    draw()
    expect(trust().tagName).toBe('UL')
    expect(items()).toEqual(['US Chess state affiliate', "Louisiana's chess community since 1915", 'Bylaws & rules', 'Minutes', 'Site last updated Sat, Oct 31, 2026'])
    const time = trust().querySelector('time')!
    expect(time.getAttribute('datetime')).toBe('2026-10-31T14:42:00.000Z')
    expect(time.textContent).toBe('Sat, Oct 31, 2026')
    expect(within(trust()).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Bylaws & rules', '/governance/bylaws'],
      ['Minutes', '/governance/minutes'],
    ])
  })

  it('shows the instant\'s Louisiana day: a small hour of the morning in UTC is the evening before', () => {
    plantBuildDate('2026-10-31T03:00:00.000Z')
    draw()
    expect(trust().querySelector('time')!.textContent).toBe('Fri, Oct 30, 2026')
    expect(trust().querySelector('time')!.getAttribute('datetime')).toBe('2026-10-31T03:00:00.000Z')
  })

  it.each([
    ['no meta at all', null],
    ['a meta with no content', ''],
    ['a date with no time and no zone', '2026-10-31'],
    ['words that are no date', 'Sat, Oct 31, 2026'],
    ['an instant in another form', '2026-10-31T14:42:00Z'],
    ['an instant that is no day', '2026-13-45T25:61:00.000Z'],
  ] as const)('leaves the date out for %s, never showing an empty or a wrong one', (_case, content) => {
    if (content !== null) plantBuildDate(content)
    draw()
    expect(items()).toEqual(['US Chess state affiliate', "Louisiana's chess community since 1915", 'Bylaws & rules', 'Minutes'])
    expect(trust().querySelector('time')).toBeNull()
    expect(footer().textContent).not.toContain('Site last updated')
  })

  it('puts a middle dot between its items from 768 pixels up, hidden from screen readers, and none below, where each item is a line of its own', () => {
    plantBuildDate('2026-10-31T14:42:00.000Z')
    for (const width of [1280, 768]) {
      stubWidth(width)
      draw()
      const dots = [...trust().querySelectorAll('[aria-hidden="true"]')]
      expect(dots, `${width}`).toHaveLength(4)
      for (const dot of dots) {
        expect(dot.textContent).toBe('·')
        expect(dot.parentElement!.tagName).toBe('LI')
      }
      // Nothing but items is a child of the list.
      expect([...trust().children].every((child) => child.tagName === 'LI')).toBe(true)
      cleanup()
    }
    for (const width of [390, null]) {
      stubWidth(width)
      draw()
      expect(trust().querySelectorAll('[aria-hidden="true"]'), `${width}`).toHaveLength(0)
      expect(trust().textContent).not.toContain('·')
      cleanup()
    }
  })
})

// ── The fold ───────────────────────────────────────────────────────────────

describe('the fold below 768 pixels', () => {
  /** Each column's heading button, in order. */
  const folds = () => columns().map((nav) => nav.querySelector('h2 > button') as HTMLButtonElement | null)

  it.each([
    ['at 390 pixels', 390],
    ['at 767 pixels', 767],
    ['where the window\'s width cannot be asked', null],
  ] as const)('%s: each heading is an h2 holding a button, its list named by aria-controls, Contact open and the rest closed and hidden', (_where, width) => {
    stubWidth(width)
    draw()
    const buttons = folds()
    expect(buttons.every((b) => b !== null)).toBe(true)
    expect(buttons.map((b) => b!.textContent)).toEqual(['Play', 'Community', 'About LCA', 'Contact'])
    expect(buttons.map((b) => b!.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true'])
    for (const button of buttons) {
      expect(button!.parentElement!.tagName).toBe('H2')
      expect(button!.getAttribute('type')).toBe('button')
      const list = document.getElementById(button!.getAttribute('aria-controls')!)!
      expect(list.tagName).toBe('UL')
      expect(list.hidden).toBe(button!.getAttribute('aria-expanded') === 'false')
      // The closed list stays in the page, so the button always names a list.
      expect(list.querySelectorAll('li').length).toBeGreaterThan(0)
    }
    // A closed column's links are out of reach of the keyboard and of screen readers.
    expect(within(columns()[0]).queryByRole('link', { name: 'Tournaments' })).toBeNull()
    expect(within(columns()[3]).getByRole('link', { name: 'Contact' })).toBeTruthy()
  })

  it('opens and closes each column on its own: opening Play leaves Contact open, and closing Contact leaves Play open', () => {
    stubWidth(390)
    draw()
    const [play, , , contact] = folds()
    fireEvent.click(play!)
    expect(folds().map((b) => b!.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'true'])
    expect(within(columns()[0]).getByRole('link', { name: 'Tournaments' })).toBeTruthy()
    fireEvent.click(contact!)
    expect(folds().map((b) => b!.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false'])
    expect(document.getElementById(contact!.getAttribute('aria-controls')!)!.hidden).toBe(true)
    fireEvent.click(play!)
    expect(folds().map((b) => b!.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'false'])
  })

  it('turns the chevron with no transition and slides nothing, at any motion setting: no transition or animation class anywhere in the four columns', () => {
    stubWidth(390)
    draw()
    const [play] = folds()
    const chevron = play!.querySelector('svg')!
    expect(chevron.getAttribute('aria-hidden')).toBe('true')
    expect(chevron.getAttribute('class')).not.toMatch(/rotate-180/)
    fireEvent.click(play!)
    expect(chevron.getAttribute('class')).toMatch(/rotate-180/)
    for (const nav of columns()) {
      for (const el of [nav, ...nav.querySelectorAll('*')]) {
        expect(el.getAttribute('class') ?? '', el.tagName).not.toMatch(/\b(?:transition|animate|duration-|slide-)/)
      }
    }
  })

  it.each([768, 1023, 1280])('at %s pixels: plain headings in the gold the guard allows on navy, over every list shown, and no button in a heading', (width) => {
    stubWidth(width)
    draw()
    expect(folds()).toEqual([null, null, null, null])
    for (const nav of columns()) {
      const heading = document.getElementById(nav.getAttribute('aria-labelledby')!)!
      expect(heading.tagName).toBe('H2')
      expect(heading.className.split(/\s+/)).toEqual(expect.arrayContaining(['uppercase', 'text-lca-gold']))
      expect(nav.querySelector('ul')!.hidden).toBe(false)
    }
    expect(within(columns()[0]).getByRole('link', { name: 'Tournaments' })).toBeTruthy()
  })

  it('keeps each column\'s state as the window crosses 768 pixels: a column opened below 768 is open again below it once the window narrows', () => {
    const now = { width: 390 }
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        const m = /^\(min-width: ([\d.]+)px\)$/.exec(query.trim())
        return m ? now.width >= Number(m[1]) : false
      },
      media: query,
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }))
    draw()
    fireEvent.click(folds()[1]!)
    expect(folds().map((b) => b!.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false', 'true'])
    now.width = 900
    act(() => listeners.forEach((listener) => listener()))
    expect(folds()).toEqual([null, null, null, null])
    now.width = 390
    act(() => listeners.forEach((listener) => listener()))
    expect(folds().map((b) => b!.getAttribute('aria-expanded'))).toEqual(['false', 'true', 'false', 'true'])
  })

  it('never folds the brand block or the base line', () => {
    stubWidth(390)
    draw()
    const brand = footer().querySelector('[data-slot="footer-brand"]')!
    const base = footer().querySelector('[data-slot="footer-base"]')!
    for (const part of [brand, base]) {
      expect(part.closest('[hidden]')).toBeNull()
      expect(part.querySelector('[hidden], [aria-expanded]')).toBeNull()
    }
    expect(within(base as HTMLElement).getByRole('group', { name: 'Appearance' })).toBeTruthy()
  })
})

// ── The layout around the fold ─────────────────────────────────────────────

describe('the layout around the fold', () => {
  /** The classes an element carries, in their order. */
  const own = (el: Element | null | undefined) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
  /** The parts whose classes the layout chooses, as drawn, with the fold buttons and the dots between the trust line's items. */
  function layout() {
    const brand = footer().querySelector('[data-slot="footer-brand"]')!
    const parts = brand.parentElement!
    return {
      folds: footer().querySelectorAll('h2 > button').length,
      inner: own(parts.parentElement),
      parts: own(parts),
      brand: own(brand),
      sentence: own(brand.querySelector('p')),
      buttons: own(brand.querySelector('p')!.nextElementSibling),
      donate: own(within(brand as HTMLElement).getByRole('button', { name: 'Donate' })),
      columns: columns().map((nav) => own(nav)),
      lists: columns().map((nav) => own(nav.querySelector('ul'))),
      link: own(columns()[3].querySelector('li > a')),
      base: own(footer().querySelector('[data-slot="footer-base"]')),
      trust: own(footer().querySelector('[data-slot="trust-line"]')),
      dots: footer().querySelectorAll('[data-slot="trust-line"] [aria-hidden="true"]').length,
    }
  }
  /** The desktop's one row: the brand block a little wider than the three columns after it, and Contact as wide as its words. */
  const FIVE_PARTS = 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
  /**
   * A Tailwind variant that asks the stylesheet for a width: sm to 2xl and
   * their max- forms, written in rem, a width of its own in brackets, or a
   * container's width.
   */
  const WIDTH_VARIANT = /(?:^|:)(?:(?:max-)?(?:sm|md|lg|xl|2xl)|(?:min|max)-\[[^\]]*\]|@[^:]*):/

  it.each([
    ['at 390 pixels', 390],
    ['at 767 pixels', 767],
    ['where the window\'s width cannot be asked', null],
  ] as const)('%s, where the columns fold: the phone\'s layout, each part under the one before, the links 44 pixels high and the trust line one fact a line with no dot', (_where, width) => {
    stubWidth(width)
    plantBuildDate('2026-10-31T14:42:00.000Z')
    draw()
    const drawn = layout()
    expect(drawn.folds).toBe(4)
    expect(drawn.inner).toEqual(['mx-auto', 'max-w-6xl'])
    expect(drawn.parts).toEqual([])
    expect(drawn.brand).toEqual(['px-4', 'pt-6', 'pb-5'])
    expect(drawn.sentence).not.toContain('max-w-[270px]')
    expect(drawn.buttons).toEqual(['grid', 'grid-cols-2', 'gap-2.5'])
    expect(drawn.donate).toEqual(expect.arrayContaining(['h-12', 'text-[15px]']))
    for (const nav of drawn.columns) expect(nav).toEqual(['border-t', 'border-white/15'])
    for (const list of drawn.lists) expect(list).toEqual(['px-4', 'pb-2.5'])
    expect(drawn.link).toEqual(expect.arrayContaining(['min-h-11', 'text-[15px]']))
    expect(drawn.base).toEqual(['border-t', 'border-white/15', 'pt-4', 'px-4', 'pb-[22px]'])
    // Its size kept before its line height, so the line height outlives the joining of the two.
    expect(drawn.trust).toEqual(['text-sm', 'leading-[1.45]', 'text-white/80'])
    expect(drawn.dots).toBe(0)
  })

  it.each([768, 1023])('at %s pixels, where the headings are plain: the tablet\'s layout, the brand block across two columns over the four, and the trust line a row with its dots', (width) => {
    stubWidth(width)
    plantBuildDate('2026-10-31T14:42:00.000Z')
    draw()
    const drawn = layout()
    expect(drawn.folds).toBe(0)
    expect(drawn.inner).toEqual(['mx-auto', 'max-w-6xl', 'px-6', 'pt-[42px]'])
    expect(drawn.parts).toEqual(['grid', 'gap-x-8', 'gap-y-9', 'grid-cols-2'])
    expect(drawn.brand).toEqual(['col-span-2'])
    expect(drawn.sentence).toContain('max-w-[270px]')
    expect(drawn.buttons).toEqual(['flex', 'flex-wrap', 'gap-2.5'])
    expect(drawn.donate).toEqual(expect.arrayContaining(['h-10', 'text-sm']))
    for (const nav of drawn.columns) expect(nav).toEqual([])
    for (const list of drawn.lists) expect(list).toEqual([])
    expect(drawn.link).toEqual(expect.arrayContaining(['min-h-[34px]', 'text-[14.5px]']))
    expect(drawn.base).toEqual(['border-t', 'border-white/15', 'pt-4', 'mt-[34px]', 'flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-x-6', 'gap-y-3', 'pb-5'])
    expect(drawn.trust).toEqual(['flex', 'flex-wrap', 'items-center', 'text-[13.5px]', 'leading-[1.45]', 'text-white/80'])
    expect(drawn.dots).toBe(4)
  })

  it.each([1024, 1280])('at %s pixels: the desktop\'s layout, the brand block and the four columns in one row of five over the base line', (width) => {
    stubWidth(width)
    plantBuildDate('2026-10-31T14:42:00.000Z')
    draw()
    const drawn = layout()
    expect(drawn.folds).toBe(0)
    expect(drawn.inner).toEqual(['mx-auto', 'max-w-6xl', 'px-8', 'pt-[42px]'])
    expect(drawn.parts).toEqual(['grid', 'gap-x-8', 'gap-y-9', FIVE_PARTS])
    expect(drawn.brand).toEqual([])
    expect(drawn.buttons).toEqual(['flex', 'flex-wrap', 'gap-2.5'])
    for (const list of drawn.lists) expect(list).toEqual([])
    expect(drawn.link).toEqual(expect.arrayContaining(['min-h-[34px]', 'text-[14.5px]']))
    expect(drawn.trust).toEqual(['flex', 'flex-wrap', 'items-center', 'text-[13.5px]', 'leading-[1.45]', 'text-white/80'])
    expect(drawn.dots).toBe(4)
  })

  it('takes every layout from the widths it asks and none from the stylesheet: no class in its file carries a width variant, whose rem the browser\'s font size moves, so the layout and the fold change together at 768 and 1024 pixels whatever the font', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/SiteFooter.tsx'), 'utf8')
    const file = ts.createSourceFile('SiteFooter.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const strings: string[] = []
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.push(node.text)
      else if (ts.isTemplateExpression(node)) strings.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text))
      ts.forEachChild(node, visit)
    }
    visit(file)
    const classes = strings.flatMap((s) => s.split(/\s+/)).filter(Boolean)
    // The layout's own classes are among those read, so the reading is not blind.
    expect(classes).toEqual(expect.arrayContaining(['grid-cols-2', 'col-span-2', 'pt-[42px]', FIVE_PARTS, 'print:hidden']))
    expect(classes.filter((c) => WIDTH_VARIANT.test(c))).toEqual([])
    // A width variant is found wherever it is written, and the footer's other variants are not taken for one.
    for (const planted of ['md:grid', 'lg:px-8', 'max-md:max-w-none', 'sm:flex', '2xl:px-8', 'min-[768px]:flex', 'max-[767px]:block', '@md:flex', 'hover:md:underline']) expect(WIDTH_VARIANT.test(planted), planted).toBe(true)
    for (const kept of ['print:hidden', 'hover:underline', 'focus-visible:underline', 'hover:border-white', 'grid-cols-2', 'max-w-6xl', 'min-h-11', 'text-[14.5px]', '[overflow-wrap:anywhere]']) expect(WIDTH_VARIANT.test(kept), kept).toBe(false)
  })
})

// ── The theme switch ───────────────────────────────────────────────────────

describe('the theme switch', () => {
  it('is today\'s control, the group named Appearance with System, Light and Dark, on a label id of its own, never appearance-label', () => {
    draw()
    const group = within(footer()).getByRole('group', { name: 'Appearance' })
    const label = group.getAttribute('aria-labelledby')!
    expect(label).not.toBe('appearance-label')
    expect(document.getElementById(label)!.textContent).toBe('Appearance')
    expect(document.getElementById('appearance-label')).toBeNull()
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['System', 'Light', 'Dark'])
  })

  it('shares its pick with another control on the page, both ways, since both write through the one module that keeps it', () => {
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter>
          <SiteFooter />
          <AppearanceControl labelId="fx-other-appearance" on="light" />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const [inFooter, other] = screen.getAllByRole('group', { name: 'Appearance' })
    expect(footer().contains(inFooter)).toBe(true)
    fireEvent.click(within(inFooter).getByRole('button', { name: 'Dark' }))
    expect(within(other).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(other).getByRole('button', { name: 'System' }))
    expect(within(inFooter).getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(inFooter).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false')
  })
})

// ── Donate ─────────────────────────────────────────────────────────────────

describe('Donate', () => {
  it('in the brand block and in the Contact column, opens the one donation dialog, and the focus goes back to the Donate pressed when it closes', async () => {
    stubWidth(1280)
    draw()
    const [inBrand, inContact] = within(footer()).getAllByRole('button', { name: 'Donate' })
    expect(footer().querySelector('[data-slot="footer-brand"]')!.contains(inBrand)).toBe(true)
    expect(columns()[3].contains(inContact)).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    for (const pressed of [inBrand, inContact, inBrand]) {
      pressed.focus()
      fireEvent.click(pressed)
      expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await waitFor(() => expect(document.activeElement).toBe(pressed))
    }
    expect(dialogs.drawn).toBeGreaterThan(0)
  })

  it('fetches the dialog\'s code only when it is first asked for: the footer imports src/components/DonateButton.tsx through one import() alone, as the header does', () => {
    const source = readFileSync(join(ROOT, 'src/components/layout/SiteFooter.tsx'), 'utf8')
    expect(source).not.toMatch(/^import\b[^;]*from '@\/components\/DonateButton'/m)
    expect(source.match(/\bimport\('@\/components\/DonateButton'\)/g)).toHaveLength(1)
    expect(source).toContain('lazy(')
    // Drawn closed, the footer asks for nothing.
    draw()
    expect(dialogs.drawn).toBe(0)
  })

  it('with newMembership on, both are links to /give and no dialog is drawn', () => {
    flags.newMembership = true
    draw()
    expect(within(footer()).queryByRole('button', { name: 'Donate' })).toBeNull()
    expect(within(footer()).getAllByRole('link', { name: 'Donate' }).map((a) => a.getAttribute('href'))).toEqual(['/give', '/give'])
    fireEvent.click(within(footer()).getAllByRole('link', { name: 'Donate' })[0])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(dialogs.drawn).toBe(0)
  })
})
