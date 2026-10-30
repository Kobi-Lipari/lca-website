// test/unit/nav-model-edges.test.ts
//
// The edges of the navigation model, src/lib/nav.ts, beside the cases of
// test/unit/nav.test.ts:
//
// - every destination brief 1.4's WS02 section lists is an entry, with its
//   one label and its address before and after the switch that moves it,
//   opens it or takes it away, and the six actions the brief names are
//   actions
// - every function that reads the switches reads them as the site runs them
//   when it is given none
// - each page lives under one section: no two sections own the same path,
//   and the rows a section holds open pages that section owns, but for the
//   one row the brief sends to the contact form
// - no live row opens a page src/App.tsx lacks: with the switches as the
//   site runs them, with every switch off, with every switch on but the five
//   early ones and siteSearch, and with the switches of the a11y-on test
//   build, where only the search page of WS02 steps 9 to 11 is still to come
// - with myLcaRail on, the word Workspace is in nothing the model gives
// - the sheet's About rows follow newAbout and newNews as the About menu does
// - every route of src/App.tsx hides the phone's tab bar exactly when the
//   brief says it does, whatever the value in its ":id"
//
// It reads no switch's value as a rule: the cases that use the switches as
// written hold whatever they are, so K turning a switch on fails nothing here
// unless the pages its rows open are missing.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES, applyFlagOverrides, type FeatureName, type Features } from '@/lib/features'
import { MEMBER_ROLES } from '@/areas/admin/roles'
import {
  ABOUT_ROWS,
  FOOTER_BRAND_ACTIONS,
  HIDE_TAB_BAR_ROUTES,
  NAV_IDS,
  SEARCH_SYNONYMS,
  SECTIONS,
  SECTION_ROUTES,
  SWITCH_NEEDS,
  TRUST_LINE_LINKS,
  YOU_ARE_HERE,
  aboutMenu,
  chromeOn,
  eventStripLiveOn,
  eventStripOn,
  footerColumns,
  headerUtilities,
  hidesTabBar,
  isLive,
  liveMarkerOn,
  myLcaRows,
  navEntry,
  navLabel,
  navSheet,
  navTabs,
  openedAddresses,
  pathIsUnder,
  searchOn,
  searchPages,
  sectionFor,
  sheetRowLabel,
  switchOn,
  type MyLcaPerson,
  type NavId,
  type SheetInput,
} from '@/lib/nav'
import { A11Y_VARIANTS } from '../a11y/global-setup'
import { navPersonas } from './fixtures/navPersonas'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const NAMES = Object.keys(FEATURES) as FeatureName[]
const ALL_OFF = Object.fromEntries(NAMES.map((n) => [n, false])) as Features
const ALL_ON = Object.fromEntries(NAMES.map((n) => [n, true])) as Features
const withOn = (...names: FeatureName[]): Features => ({ ...ALL_OFF, ...Object.fromEntries(names.map((n) => [n, true])) })
const withOff = (...names: FeatureName[]): Features => ({ ...ALL_ON, ...Object.fromEntries(names.map((n) => [n, false])) })
const CHROME: FeatureName[] = ['newNav', 'newLook']
/** The four switches that draw only inside the chrome. */
const GATED: FeatureName[] = ['siteSearch', 'eventStrip', 'eventStripLive', 'liveMarker']
const EARLY: FeatureName[] = ['newAbout', 'newNews', 'newMembership', 'newClubs', 'myLcaRail']

/** One switch turned on over every switch off, with the chrome it draws in when it needs one. */
const opened = (name: FeatureName): Features =>
  withOn(name, ...(GATED.includes(name) ? CHROME : []), ...(name === 'eventStripLive' ? (['eventStrip'] as const) : []))

/** Friday, October 23, 2026 at noon UTC. */
const PEOPLE = navPersonas(new Date(Date.UTC(2026, 9, 23, 12)))
const SIGNED_IN = PEOPLE.flatMap((p) => (p.holds ? [p.holds] : []))

/** Every <Route path="..."> of src/App.tsx, the heritage pages included, as written. */
const APP_ROUTES = new Set([...read('src/App.tsx').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))
/** The path of an address: no query and no fragment. */
const pathOf = (address: string) => address.split(/[?#]/)[0]

/** The paths the model opens with these switches that src/App.tsx has no route for. */
const missingRoutes = (features: Features) =>
  [...new Set(openedAddresses(features).filter((a) => a.startsWith('/')).map(pathOf))].filter((path) => !APP_ROUTES.has(path)).sort()

/** Every combination of roles and holdings a person can bring to the My LCA menu. */
const EVERYONE: MyLcaPerson[] = MEMBER_ROLES.flatMap((role) =>
  [false, true].flatMap((isBoardMember) =>
    [0, 1].flatMap((managedClubs) =>
      [0, 1].flatMap((directedEvents) => [false, true].map((hasChildren) => ({ role, isBoardMember, managedClubs, directedEvents, hasChildren }))),
    ),
  ),
)

describe('the destinations brief 1.4 lists', () => {
  interface Row {
    label: string
    /** Where it goes with every switch off; null for a button with no address. */
    off: string | null
    /** The switch that sends it somewhere else, and where it goes then. */
    moves?: [FeatureName, string]
    /** The switch it waits for. */
    opens?: FeatureName
    /** The switch that takes it away. */
    retires?: FeatureName
  }
  // In the order of the brief's lists: the sections, the rows under
  // Tournaments and Clubs, the About menu, the footer's Contact column, the
  // bar's utilities and the My LCA menu, then the phone's controls. The two
  // addresses the brief leaves open, Suggest a club's and the card's, are the
  // ones the record of WS02 step 2 names.
  const BRIEF: Row[] = [
    { label: 'Tournaments', off: '/tournaments' },
    { label: 'Clubs', off: '/clubs' },
    { label: 'Scholastic', off: '/scholastic' },
    { label: 'News', off: '/news' },
    { label: 'Membership', off: '/membership' },
    { label: 'About', off: null },
    { label: 'Scoresheet scanner', off: '/scanner' },
    { label: 'This weekend', off: '/tournaments?when=weekend', opens: 'newTournaments' },
    { label: 'Calendar', off: '/tournaments?view=calendar', opens: 'newTournaments' },
    { label: 'Results', off: '/results', opens: 'newNews' },
    { label: 'Club map', off: '/clubs#map' },
    { label: 'List or update your club', off: '/contact?subject=club' },
    { label: 'Suggest a club', off: '/clubs/suggest', opens: 'newClubs' },
    { label: 'About LCA', off: '/about' },
    { label: 'Board & regions', off: '/governance/board', moves: ['newAbout', '/about/board'] },
    { label: 'Bylaws & rules', off: '/governance/bylaws', moves: ['newAbout', '/about/bylaws'] },
    { label: 'Minutes', off: '/governance/minutes', moves: ['newAbout', '/about/minutes'] },
    { label: 'Annual meeting', off: '/meeting' },
    { label: 'State champions', off: '/champions', moves: ['newNews', '/about/champions'] },
    { label: 'Contact', off: '/contact' },
    { label: 'LCA on Facebook ↗', off: 'https://www.facebook.com/LouisianaChessAssociation' },
    { label: 'LouisianaChess@gmail.com', off: 'mailto:LouisianaChess@gmail.com' },
    { label: 'Membership help', off: '/contact?subject=membership' },
    { label: 'Website help', off: '/support' },
    { label: 'Search', off: '/search', opens: 'siteSearch' },
    { label: 'Donate', off: null, moves: ['newMembership', '/give'] },
    { label: 'Log in', off: '/login' },
    { label: 'Join LCA', off: '/membership' },
    { label: 'Renew', off: '/membership' },
    { label: 'My LCA', off: '/dashboard' },
    { label: 'Family', off: '/dashboard' },
    { label: 'Membership card', off: '/dashboard/you', opens: 'newMembership' },
    { label: 'Workspace', off: '/workspace', retires: 'myLcaRail' },
    { label: 'Board inbox', off: '/board/inbox', retires: 'myLcaRail' },
    { label: 'My region’s clubs', off: '/dashboard', retires: 'myLcaRail' },
    { label: 'Admin', off: '/admin' },
    { label: 'Admin (view only)', off: '/admin' },
    { label: 'Log out', off: null },
    { label: 'Menu', off: null },
    { label: 'Hide event bar until the next update', off: null, opens: 'eventStrip' },
  ]
  const byLabel = new Map(NAV_IDS.map((id) => [navLabel(id), id]))

  it.each(BRIEF.map((row) => [row.label, row] as const))('%s', (label, row) => {
    const id = byLabel.get(label)
    expect(id, `no entry reads "${label}"`).toBeDefined()
    const at = (features: Features) => navEntry(id!, features).href
    expect(at(ALL_OFF)).toBe(row.off)
    if (row.moves) {
      const [name, href] = row.moves
      expect(at(withOn(name))).toBe(href)
      // Only its own switch moves it: every other switch on leaves it where it is.
      expect(at(withOff(name))).toBe(row.off)
    } else {
      expect(at(ALL_ON)).toBe(row.off)
    }
    if (row.opens) {
      expect(isLive(id!, ALL_OFF)).toBe(false)
      expect(isLive(id!, withOff(row.opens))).toBe(false)
      expect(isLive(id!, opened(row.opens))).toBe(true)
    } else if (row.retires) {
      expect(isLive(id!, ALL_OFF)).toBe(true)
      expect(isLive(id!, withOn(row.retires))).toBe(false)
      expect(isLive(id!, withOff(row.retires))).toBe(true)
    } else {
      // A row of a page that exists today, which no switch takes away.
      expect(isLive(id!, ALL_OFF)).toBe(true)
      expect(isLive(id!, ALL_ON)).toBe(true)
    }
  })

  it('makes the six buttons the brief names actions, Donate and Log out among them with no address of their own', () => {
    const actions = NAV_IDS.filter((id) => navEntry(id).kind === 'action').map(navLabel)
    expect(actions).toEqual(expect.arrayContaining(['Log in', 'Join LCA', 'Renew', 'Donate', 'Search', 'Log out']))
    expect(navEntry('donate', ALL_OFF).does).toBe('donate-dialog')
    expect(navEntry('logOut', ALL_ON).does).toBe('sign-out')
    expect(navEntry('logOut', ALL_ON).href).toBeNull()
  })
})

describe('the switches the model reads when it is given none', () => {
  it('are the switches as the site runs them, for every function that reads them', () => {
    expect(chromeOn()).toBe(chromeOn(FEATURES))
    expect(searchOn()).toBe(searchOn(FEATURES))
    expect(eventStripOn()).toBe(eventStripOn(FEATURES))
    expect(eventStripLiveOn()).toBe(eventStripLiveOn(FEATURES))
    expect(liveMarkerOn()).toBe(liveMarkerOn(FEATURES))
    for (const name of NAMES) expect(switchOn(name), name).toBe(switchOn(name, FEATURES))
    for (const id of NAV_IDS) {
      expect(isLive(id), id).toBe(isLive(id, FEATURES))
      expect(navEntry(id), id).toEqual(navEntry(id, FEATURES))
    }
    expect(openedAddresses()).toEqual(openedAddresses(FEATURES))
    expect(footerColumns()).toEqual(footerColumns(FEATURES))
    expect(searchPages()).toEqual(searchPages(FEATURES))
    for (const person of SIGNED_IN) expect(myLcaRows(person)).toEqual(myLcaRows(person, FEATURES))
    const inputs: SheetInput[] = [
      { pathname: '/', signedIn: false },
      { pathname: '/governance/minutes', signedIn: true, person: SIGNED_IN.at(-1), eventMode: true, joinSlot: 'renew' },
    ]
    for (const input of inputs) expect(navSheet(input)).toEqual(navSheet(input, FEATURES))
  })
})

describe('each page under one section', () => {
  const owned = SECTIONS.flatMap((section) => SECTION_ROUTES[section].map((path) => [section, path] as const))

  it('gives no path to two sections, so the order of the sections never decides which one is current', () => {
    for (const [a, pathA] of owned) {
      expect(sectionFor(pathA), pathA).toBe(a)
      for (const [b, pathB] of owned) {
        if (a !== b) expect(pathIsUnder(pathA, pathB), `${pathA} (${a}) sits under ${pathB} (${b})`).toBe(false)
      }
    }
  })

  it('puts every row a section holds in the sheet, and every About menu row, on a page that section owns', () => {
    // The brief's one exception: List or update your club is the contact form
    // with the club subject, and the contact form is About's.
    const states = [ALL_OFF, ALL_ON, ...EARLY.map((n) => withOn(n)), withOn('newAbout', 'newNews'), withOn('newTournaments', 'newNews', 'newClubs')]
    for (const features of states) {
      const sheet = navSheet({ pathname: '/', signedIn: false }, features)
      for (const section of sheet.sections) {
        for (const row of section.rows) {
          const href = navEntry(row.entry, features).href!
          const owner = row.entry === 'listClub' ? 'about' : section.section
          expect(sectionFor(pathOf(href)), `${row.entry} at ${href}`).toBe(owner)
        }
      }
      for (const id of aboutMenu().rows) expect(sectionFor(pathOf(navEntry(id, features).href!)), id).toBe('about')
      // Donate's page, once it has one, is Membership's.
      const give = navEntry('donate', features).href
      if (give !== null) expect(sectionFor(give)).toBe('membership')
    }
    expect(sectionFor(pathOf(navEntry('listClub').href!))).toBe('about')
  })
})

describe('no row opens a page src/App.tsx lacks', () => {
  it('reads the routes, the heritage pages and the redirects included', () => {
    for (const route of ['/', '/clubs', '/contact', '/support', '/login', '/dashboard', '/meeting', '/governance', '/state-champions', '/governance/rules']) {
      expect(APP_ROUTES, route).toContain(route)
    }
  })

  it('with the switches as the site runs them, and the routes a switch that is on needs besides', () => {
    const needs = (Object.entries(SWITCH_NEEDS) as Array<[FeatureName, readonly string[]]>).flatMap(([name, paths]) => (switchOn(name) ? paths : []))
    const missing = [...missingRoutes(FEATURES), ...needs.filter((path) => !APP_ROUTES.has(path))]
    expect(missing, `a switch that is on opens ${missing.join(', ')}, which src/App.tsx has no route for: leave it off until its pages exist`).toEqual([])
  })

  it('with every switch off, and with every switch on but the five early ones and siteSearch', () => {
    expect(missingRoutes(ALL_OFF)).toEqual([])
    // So the guard's five switches and siteSearch, whose /search WS02 steps 9
    // to 11 add, are the only ones whose rows wait for pages; a row added for
    // another switch must come with its route or join the guard.
    expect(missingRoutes(withOff(...EARLY, 'siteSearch'))).toEqual([])
    // The case can fail: siteSearch alone, inside the chrome, opens /search.
    expect(missingRoutes(opened('siteSearch'))).toEqual(APP_ROUTES.has('/search') ? [] : ['/search'])
  })

  it('with the switches of the a11y-on test build, which open the chrome and its four gates', () => {
    const variant = (name: string) => A11Y_VARIANTS.find((v) => v.name === name)!
    const on = applyFlagOverrides(FEATURES, 'a11y', variant('a11y-on').flags)
    expect([chromeOn(on), searchOn(on), eventStripOn(on), eventStripLiveOn(on), liveMarkerOn(on)]).toEqual([true, true, true, true, true])
    // Only the search page is still to come; any other early page turned on in
    // that build before its route exists fails here.
    const early = missingRoutes(on).filter((path) => path !== '/search')
    expect(early, `the a11y-on build opens ${early.join(', ')}, which src/App.tsx has no route for: leave the switch out of that build until its pages exist`).toEqual([])
    const needs = (Object.entries(SWITCH_NEEDS) as Array<[FeatureName, readonly string[]]>).flatMap(([name, paths]) => (switchOn(name, on) ? paths : []))
    expect(needs.filter((path) => !APP_ROUTES.has(path))).toEqual([])
    // The a11y-off build reads the switches as written, so its chrome is the site's.
    const off = applyFlagOverrides(FEATURES, 'a11y', variant('a11y-off').flags)
    expect(off).toEqual(FEATURES)
    expect(chromeOn(off)).toBe(chromeOn(FEATURES))
  })
})

describe('the word Workspace once myLcaRail is on', () => {
  /** Everything the model gives a visitor to read, for one person (or nobody signed in) and one set of switches. */
  function wordsFor(features: Features, person: MyLcaPerson | null): string[] {
    const signedIn = person !== null
    const sheet = navSheet({ pathname: '/', signedIn, person, eventMode: true, joinSlot: signedIn ? 'renew' : undefined }, features)
    return [
      ...NAV_IDS.filter((id) => isLive(id, features)).map(navLabel),
      ...headerUtilities({ signedIn, joinSlot: 'renew' }).map(navLabel),
      ...aboutMenu(true).rows.map(navLabel),
      navLabel(aboutMenu().footer),
      ...navTabs(signedIn).flatMap((tab) => [navLabel(tab.entry), tab.whileOpen ?? '']),
      ...sheet.sections.flatMap((s) => [navLabel(s.section), s.note ?? '', ...s.rows.map(sheetRowLabel)]),
      ...[...sheet.utilities, ...sheet.roles, ...sheet.links, ...sheet.controls].map(navLabel),
      ...footerColumns(features).flatMap((c) => [c.title, ...c.links.map(navLabel)]),
      ...FOOTER_BRAND_ACTIONS.map(navLabel),
      ...TRUST_LINE_LINKS.map(navLabel),
      ...(person ? myLcaRows(person, features).map((r) => r.label) : []),
      ...searchPages(features).map(navLabel),
      ...Object.entries(SEARCH_SYNONYMS).flatMap(([word, id]) => [word, navLabel(id)]),
      YOU_ARE_HERE,
    ]
  }

  it('is in no row, title, label or search word the model gives, for anyone', () => {
    for (const features of [withOn('myLcaRail'), ALL_ON, withOn('myLcaRail', 'newMembership', ...CHROME, ...GATED)]) {
      for (const person of [null, ...EVERYONE, ...SIGNED_IN]) {
        for (const word of wordsFor(features, person)) expect(word, JSON.stringify(person)).not.toMatch(/workspace/i)
      }
    }
  })

  it('is still there for a club rep with the rail off, so the case above can fail', () => {
    const clubRep: MyLcaPerson = { role: 'club_rep', isBoardMember: false, managedClubs: 0, directedEvents: 0, hasChildren: false }
    expect(wordsFor(ALL_OFF, clubRep).filter((w) => /workspace/i.test(w)).length).toBeGreaterThan(0)
  })
})

describe('the sheet\'s About rows', () => {
  it('open where the About menu, the footer and the trust line open them, with newAbout and newNews each off and on', () => {
    for (const features of [ALL_OFF, withOn('newAbout'), withOn('newNews'), withOn('newAbout', 'newNews')]) {
      const menu = aboutMenu().rows.map((id) => navEntry(id, features).href)
      for (const pathname of ['/', '/governance/minutes', '/about/minutes']) {
        const about = navSheet({ pathname, signedIn: false }, features).sections.find((s) => s.section === 'about')!
        expect(about.rows.map((r) => navEntry(r.entry, features).href)).toEqual(menu)
        expect(about.rows.map(sheetRowLabel)).toEqual(labelsOf(ABOUT_ROWS))
        expect(about.current, pathname).toBe(pathname !== '/')
      }
      for (const id of [...footerColumns(features).flatMap((c) => c.links), ...TRUST_LINE_LINKS]) {
        if ((ABOUT_ROWS as readonly NavId[]).includes(id)) expect(menu, id).toContain(navEntry(id, features).href)
      }
    }
  })
})

function labelsOf(ids: readonly NavId[]): string[] {
  return ids.map(navLabel)
}

describe('the phone\'s tab bar on the routes of src/App.tsx', () => {
  it('hides on exactly the three routes the brief names, whatever the value in their ":id", and on no other route', () => {
    const hiding = new Set<string>(HIDE_TAB_BAR_ROUTES)
    expect(APP_ROUTES.size).toBeGreaterThan(30)
    for (const route of APP_ROUTES) {
      for (const value of ['fx-t-open', '42', 'fixture.fall.open']) {
        const path = route.replace(/:[a-zA-Z]+/g, value)
        expect(hidesTabBar(path), path).toBe(hiding.has(route))
        if (path !== '/') expect(hidesTabBar(`${path}/`), `${path}/`).toBe(hiding.has(route))
      }
    }
    for (const route of HIDE_TAB_BAR_ROUTES) expect(APP_ROUTES, route).toContain(route)
  })
})

describe('the files this pass of tests adds', () => {
  /** An en dash or an em dash, written by code so that this file holds neither. */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  /** US Chess's old initials, put together so that this file does not hold them. */
  const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`, 'i')
  /** The names of tools that must not be mentioned, split up so that this file does not mention them either. */
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'co-' + 'authored'].join('|')})\\b`, 'i')
  const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)

  it.each([
    'test/unit/nav-model-edges.test.ts',
    'test/unit/nav-personas-edges.test.ts',
    'test/unit/signed-in-session.test.ts',
    'test/unit/signed-in-header.test.tsx',
    'test/integration/nav-personas.test.ts',
    'test/a11y/signed-in-edges.spec.ts',
  ])('%s has no em dash, no en dash, no old initials for US Chess and no tool\'s name', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(BARE)
  })
})
