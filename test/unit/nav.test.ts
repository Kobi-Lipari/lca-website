// test/unit/nav.test.ts
//
// The navigation model, src/lib/nav.ts, read without a browser. These are the
// model's halves of WS02's criteria on labels and lists, on the My LCA menu
// and on the governance rows' addresses; the steps that draw the header, the
// sheet, the tabs and the footer prove the same on what they draw.
//
// - One label per destination across every list the model gives: no two
//   entries share a label, every list names entries by id, and no two entries
//   open the same address but for the cases named below, each with its reason.
// - The header's and the sheet's sections are the same six in the same order;
//   the first two tabs are the Tournaments and Clubs entries themselves; every
//   footer and trust line link is an entry by id; the pages that hide the tab
//   bar; the section and the tab that are current for a path.
// - No entry is live while its switch is off, whichever others are on; the
//   chrome's one condition (newNav and newLook both on) and the four switches
//   that draw only inside it; the About rows' addresses with newAbout and
//   newNews in all four combinations; Donate before and after the Give page.
// - The My LCA rows for every person in test/unit/fixtures/navPersonas.ts,
//   with myLcaRail off and on and newMembership off and on, and the role rules
//   of today's header for the cases the list does not cover; and the rows each
//   person's myLcaMenuRows gives the browser tests as plain data, which are
//   the ones the a11y-on build's switches give before the children reach the
//   header.
// - Search's data: the pages, the words parents use and the region aliases.
// - The guard. newAbout, newNews, newMembership, newClubs and myLcaRail point
//   rows at pages that later parts build, or take rows away for a rail that a
//   later part builds. With one of them on, every address its rows open must
//   be a route of src/App.tsx (and /workspace/lookup for myLcaRail), or this
//   file fails and says to leave the switch off until its part ships. It reads
//   the switches' real values, so it fails only when one is turned on before
//   its pages exist. A throwaway preview branch runs no tests, so the guard
//   holds a pull request, not a preview.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES, FLAG_OVERRIDE_MODE, applyFlagOverrides, type FeatureName, type Features } from '@/lib/features'
import { MEMBER_ROLES, isViewOnlyAdmin, type MemberRole } from '@/areas/admin/roles'
import { REGIONS } from '@/lib/regions'
import {
  ABOUT_FOOTER_ROW,
  ABOUT_ROWS,
  FACEBOOK_URL,
  FOOTER_BRAND_ACTIONS,
  HIDE_TAB_BAR_ROUTES,
  LCA_EMAIL,
  NAV_IDS,
  REGION_ALIASES,
  SEARCH_SYNONYMS,
  SECTIONS,
  SECTION_NOTES,
  SWITCH_NEEDS,
  TRUST_LINE_LINKS,
  YOU_ARE_HERE,
  aboutMenu,
  adminRowFor,
  chromeOn,
  currentTab,
  eventStripLiveOn,
  eventStripOn,
  footerColumns,
  headerSections,
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
  routeMatches,
  searchOn,
  searchPages,
  sectionFor,
  sheetRowLabel,
  switchOn,
  type MyLcaPerson,
  type NavId,
} from '@/lib/nav'
import { PERSONA_KEYS, TODAYS_ACCOUNT_LINKS, navPersonas, type NavPersona, type PersonaKey } from './fixtures/navPersonas'
import { A11Y_VARIANTS } from '../a11y/global-setup'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const NAMES = Object.keys(FEATURES) as FeatureName[]
const ALL_OFF = Object.fromEntries(NAMES.map((n) => [n, false])) as Features
const ALL_ON = Object.fromEntries(NAMES.map((n) => [n, true])) as Features
const withOn = (...names: FeatureName[]): Features => ({ ...ALL_OFF, ...Object.fromEntries(names.map((n) => [n, true])) })
const withOff = (...names: FeatureName[]): Features => ({ ...ALL_ON, ...Object.fromEntries(names.map((n) => [n, false])) })
const CHROME: FeatureName[] = ['newNav', 'newLook']

/** Friday, October 23, 2026 at noon UTC: the day the persona list is worked out for here. */
const TODAY = new Date(Date.UTC(2026, 9, 23, 12))
const PEOPLE = navPersonas(TODAY)
const SIGNED_IN = PEOPLE.filter((p): p is NavPersona & { holds: MyLcaPerson } => p.holds !== null)
const labels = (ids: readonly NavId[]) => ids.map(navLabel)

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`, 'i')

describe('entries: one label for each destination', () => {
  it('gives every entry a label of its own', () => {
    const all = NAV_IDS.map(navLabel)
    expect(new Set(all).size).toBe(all.length)
    for (const label of all) expect(label.trim(), label).toBe(label)
  })

  it('uses the one label the decided board sets for each destination, and none of the words it replaces', () => {
    const ONE_LABEL: Array<[NavId, string]> = [
      ['stateChampions', 'State champions'],
      ['contact', 'Contact'],
      ['scholastic', 'Scholastic'],
      ['clubs', 'Clubs'],
      ['facebook', 'LCA on Facebook ↗'],
      ['boardRegions', 'Board & regions'],
      ['websiteHelp', 'Website help'],
      ['bylawsRules', 'Bylaws & rules'],
      ['minutes', 'Minutes'],
    ]
    for (const [id, label] of ONE_LABEL) expect(navLabel(id), id).toBe(label)
    const all = NAV_IDS.map(navLabel)
    for (const replaced of ['Champions', 'Contact form', 'Contact us', 'Scholastic chess', 'Find a club', 'Chess clubs', 'Facebook ↗', 'Board members', 'Support', 'Scanner', 'Admin panel']) {
      expect(all, replaced).not.toContain(replaced)
    }
  })

  it('opens no address under two labels, but for the cases named here', () => {
    // Each set shares one address on purpose. The My LCA rows My LCA, Family
    // and My region's clubs all open the dashboard until the new My LCA page
    // gives Family and the region places of their own. Join LCA and Renew are
    // buttons beside the Membership page, as the board draws them. A person
    // holds one Admin row, whose words say which access it gives.
    const SHARED: Record<string, NavId[]> = {
      '/dashboard': ['myLca', 'family', 'myRegionClubs'],
      '/membership': ['membership', 'joinLca', 'renew'],
      '/admin': ['admin', 'adminViewOnly'],
    }
    const states: Features[] = [ALL_OFF, ALL_ON, ...(['newAbout', 'newNews', 'newMembership', 'newClubs', 'myLcaRail'] as const).map((n) => withOn(n))]
    for (const features of states) {
      const byAddress = new Map<string, NavId[]>()
      for (const id of NAV_IDS) {
        const entry = navEntry(id, features)
        if (entry.href !== null) byAddress.set(entry.href, [...(byAddress.get(entry.href) ?? []), id])
      }
      for (const [address, ids] of byAddress) {
        if (ids.length > 1) expect(SHARED[address], `${address} is opened by ${ids.join(', ')}`).toEqual(expect.arrayContaining(ids))
      }
    }
  })

  it('holds no dash and no old initials for US Chess in any word it gives', () => {
    const words = [
      ...NAV_IDS.map(navLabel),
      YOU_ARE_HERE,
      ...Object.values(SECTION_NOTES),
      ...footerColumns(ALL_ON).map((c) => c.title),
      ...navTabs(true).flatMap((t) => (t.whileOpen ? [t.whileOpen] : [])),
      ...navSheet({ pathname: '/', signedIn: false }, ALL_ON).sections.flatMap((s) => s.rows.map(sheetRowLabel)),
      ...Object.keys(SEARCH_SYNONYMS),
      ...Object.keys(REGION_ALIASES),
    ]
    for (const word of words) {
      expect(word, word).not.toMatch(DASHES)
      expect(word, word).not.toMatch(OLD_INITIALS)
    }
  })

  it('sends the Facebook entry out in a new tab, the email out by a mail link, and every other entry to a page of the site', () => {
    const facebook = navEntry('facebook')
    expect([facebook.href, facebook.leavesSite, facebook.newTab]).toEqual([FACEBOOK_URL, true, true])
    const email = navEntry('email')
    expect([email.href, email.leavesSite, email.newTab]).toEqual([`mailto:${LCA_EMAIL}`, true, false])
    for (const id of NAV_IDS.filter((i) => i !== 'facebook' && i !== 'email')) {
      for (const features of [ALL_OFF, ALL_ON]) {
        const entry = navEntry(id, features)
        expect(entry.leavesSite || entry.newTab, id).toBe(false)
        if (entry.href !== null) expect(entry.href.startsWith('/'), id).toBe(true)
      }
    }
    // The same Facebook page today's header and footer link, and the address the contact page gives.
    expect(read('src/components/layout/Navbar.tsx')).toContain(`href="${FACEBOOK_URL}"`)
    expect(read('src/components/layout/Footer.tsx')).toContain(`href="${FACEBOOK_URL}"`)
    expect(read('src/pages/ContactPage.tsx')).toContain(`'${LCA_EMAIL}'`)
  })

  it('names entries by id in every list it gives, so every label comes from its entry', () => {
    const lists: Array<[string, readonly string[]]> = [
      ['sections', SECTIONS],
      ['About rows', [...ABOUT_ROWS, ABOUT_FOOTER_ROW]],
      ['About menu, squeezed', aboutMenu(true).rows],
      ['trust line', TRUST_LINE_LINKS],
      ['footer brand block', FOOTER_BRAND_ACTIONS],
      ['footer', footerColumns(ALL_ON).flatMap((c) => c.links)],
      ['tabs', [...navTabs(false), ...navTabs(true)].map((t) => t.entry)],
      ['header utilities', [...headerUtilities({ signedIn: false }), ...headerUtilities({ signedIn: true, joinSlot: 'renew' })]],
      ['synonyms', Object.values(SEARCH_SYNONYMS)],
      ['search pages', searchPages(ALL_ON)],
    ]
    const sheet = navSheet({ pathname: '/tournaments', signedIn: true, person: SIGNED_IN.at(-1)!.holds, eventMode: true }, ALL_ON)
    lists.push(['sheet', [...sheet.sections.flatMap((s) => [s.section, ...s.rows.map((r) => r.entry)]), ...sheet.utilities, ...sheet.roles, ...sheet.links, ...sheet.controls]])
    for (const person of SIGNED_IN) lists.push([`My LCA rows of ${person.key}`, myLcaRows(person.holds, ALL_OFF).map((r) => r.id)])
    for (const [name, ids] of lists) {
      expect(ids.length, name).toBeGreaterThan(0)
      for (const id of ids) expect(NAV_IDS, `${name}: ${id}`).toContain(id)
    }
    for (const person of SIGNED_IN) {
      for (const row of myLcaRows(person.holds, ALL_ON)) expect(row.label).toBe(navLabel(row.id))
    }
  })
})

describe('sections, the header and the sheet', () => {
  it('gives the header and the sheet the same six sections, in the same order', () => {
    expect(headerSections()).toEqual(['tournaments', 'clubs', 'scholastic', 'news', 'membership', 'about'])
    expect(labels(headerSections())).toEqual(['Tournaments', 'Clubs', 'Scholastic', 'News', 'Membership', 'About'])
    for (const features of [ALL_OFF, ALL_ON]) {
      for (const pathname of ['/', '/tournaments', '/about', '/support']) {
        expect(navSheet({ pathname, signedIn: false }, features).sections.map((s) => s.section)).toEqual([...headerSections()])
      }
    }
    expect(navEntry('about').kind).toBe('menu')
    expect(navEntry('about').href).toBeNull()
  })

  it('gives each page to one section, with the rule today\'s header uses, and none to the pages outside the six', () => {
    const OWNED: Array<[string, string | null]> = [
      ['/tournaments', 'tournaments'], ['/tournaments/fx-t-open', 'tournaments'], ['/tournaments/fx-t-open/pairings', 'tournaments'],
      ['/scanner', 'tournaments'], ['/results', 'tournaments'],
      ['/clubs', 'clubs'], ['/clubs/fx-club-capital', 'clubs'],
      ['/scholastic', 'scholastic'],
      ['/news', 'news'], ['/news/a-post', 'news'],
      ['/membership', 'membership'], ['/membership/success', 'membership'], ['/donate/success', 'membership'], ['/give', 'membership'], ['/give/thanks', 'membership'],
      ['/about', 'about'], ['/about/board', 'about'], ['/governance/board', 'about'], ['/governance/bylaws', 'about'], ['/governance/minutes', 'about'],
      ['/governance/rules', 'about'], ['/champions', 'about'], ['/state-champions', 'about'], ['/meeting', 'about'], ['/contact', 'about'],
      ['/', null], ['/support', null], ['/search', null], ['/login', null], ['/register', null], ['/dashboard', null], ['/workspace', null],
      ['/admin', null], ['/board/inbox', null], ['/tournamentsx', null], ['/aboutus', null],
    ]
    for (const [pathname, section] of OWNED) expect(sectionFor(pathname), pathname).toBe(section)
  })

  it('opens the current section in the sheet with "You are here"', () => {
    expect(YOU_ARE_HERE).toBe('You are here')
    const at = (pathname: string) => navSheet({ pathname, signedIn: false }, ALL_OFF).sections.filter((s) => s.current).map((s) => s.section)
    expect(at('/governance/minutes')).toEqual(['about'])
    expect(at('/tournaments/fx-t-open')).toEqual(['tournaments'])
    expect(at('/donate/success')).toEqual(['membership'])
    expect(at('/')).toEqual([])
    expect(at('/support')).toEqual([])
  })

  it('fills the sheet in the board\'s order: sections, the bar\'s buttons, the role rows, the links, then the controls', () => {
    const out = navSheet({ pathname: '/', signedIn: false }, ALL_OFF)
    expect(labels(out.utilities)).toEqual(['Donate', 'Log in', 'Join LCA'])
    expect(out.roles).toEqual([])
    expect(labels(out.links)).toEqual(['LCA on Facebook ↗', 'Contact', 'Website help'])
    expect(labels(out.controls)).toEqual(['Appearance'])
    // Hide event bar only while event mode is on, and only while the strip can show.
    expect(labels(navSheet({ pathname: '/', signedIn: true, eventMode: true }, withOn(...CHROME, 'eventStrip')).controls)).toEqual(['Appearance', 'Hide event bar until the next update'])
    expect(labels(navSheet({ pathname: '/', signedIn: true, eventMode: false }, withOn(...CHROME, 'eventStrip')).controls)).toEqual(['Appearance'])
    expect(labels(navSheet({ pathname: '/', signedIn: true, eventMode: true }, withOn('eventStrip')).controls)).toEqual(['Appearance'])
    // Signed in: My LCA in Log in's place, and the join slot as the header is told.
    expect(labels(navSheet({ pathname: '/', signedIn: true }, ALL_OFF).utilities)).toEqual(['Donate', 'My LCA'])
    expect(labels(navSheet({ pathname: '/', signedIn: true, joinSlot: 'renew' }, ALL_OFF).utilities)).toEqual(['Donate', 'My LCA', 'Renew'])
    expect(labels(headerUtilities({ signedIn: false, joinSlot: 'renew' }))).toEqual(['Donate', 'Log in', 'Join LCA'])
  })

  it('holds All tournaments and Scoresheet scanner under Tournaments, and All clubs, Club map and List or update your club under Clubs, adding the later rows only while they are live', () => {
    const rows = (features: Features, section: string) =>
      navSheet({ pathname: '/', signedIn: false }, features).sections.find((s) => s.section === section)!.rows.map(sheetRowLabel)
    expect(rows(ALL_OFF, 'tournaments')).toEqual(['All tournaments', 'Scoresheet scanner'])
    expect(rows(withOn('newTournaments'), 'tournaments')).toEqual(['All tournaments', 'Scoresheet scanner', 'This weekend'])
    expect(rows(withOn('newNews'), 'tournaments')).toEqual(['All tournaments', 'Scoresheet scanner', 'Results'])
    expect(rows(ALL_OFF, 'clubs')).toEqual(['All clubs', 'Club map', 'List or update your club'])
    expect(rows(withOn('newClubs'), 'clubs')).toEqual(['All clubs', 'Club map', 'List or update your club', 'Suggest a club'])
    expect(rows(ALL_OFF, 'about')).toEqual(labels(ABOUT_ROWS))
    for (const section of ['scholastic', 'news', 'membership']) expect(rows(ALL_ON, section), section).toEqual([])
    // "All tournaments" and "All clubs" are built from the section's own entry, not stored as a second label.
    const sheet = navSheet({ pathname: '/', signedIn: false }, ALL_OFF)
    for (const section of sheet.sections) {
      for (const row of section.rows.filter((r) => r.all)) expect(row.entry).toBe(section.section)
    }
    expect(sheet.sections.find((s) => s.section === 'scholastic')!.note).toBe('Kids and school chess')
  })
})

describe('the phone\'s tabs', () => {
  it('makes the first two tabs the Tournaments and Clubs entries themselves, the first reading "Tournaments"', () => {
    for (const signedIn of [false, true]) {
      const tabs = navTabs(signedIn)
      expect(tabs.map((t) => t.id)).toEqual(['tournaments', 'clubs', 'account', 'menu'])
      expect(tabs.slice(0, 2).map((t) => t.entry)).toEqual(headerSections().slice(0, 2))
      expect(navLabel(tabs[0].entry)).toBe('Tournaments')
      expect(navEntry(tabs[0].entry).href).toBe('/tournaments')
      expect(navEntry(tabs[1].entry).href).toBe('/clubs')
      expect(tabs.map((t) => t.icon)).toEqual(['trophy', 'users', 'user', 'menu'])
    }
    expect(navTabs(false)[2].entry).toBe('logIn')
    expect(navTabs(true)[2].entry).toBe('myLca')
    expect(navTabs(false)[3]).toEqual({ id: 'menu', entry: 'menu', icon: 'menu', whileOpen: 'Close' })
  })

  it('marks the tab of the section a page is in, the third tab on Log in and My LCA, and Menu for the sections in the sheet', () => {
    const CURRENT: Array<[string, string | null]> = [
      ['/tournaments', 'tournaments'], ['/tournaments/fx-t-open', 'tournaments'], ['/scanner', 'tournaments'],
      ['/clubs', 'clubs'], ['/clubs/fx-club-north', 'clubs'],
      ['/login', 'account'], ['/dashboard', 'account'],
      ['/scholastic', 'menu'], ['/news', 'menu'], ['/membership', 'menu'], ['/about', 'menu'], ['/governance/board', 'menu'], ['/contact', 'menu'],
      ['/', null], ['/support', null], ['/search', null], ['/workspace', null], ['/admin', null],
    ]
    for (const [pathname, tab] of CURRENT) expect(currentTab(pathname), pathname).toBe(tab)
  })
})

describe('the footer and the trust line', () => {
  it('has four columns of entries by id, adding Calendar, Results and Suggest a club only while they are live', () => {
    const columns = (features: Features) => footerColumns(features).map((c) => [c.title, labels(c.links)])
    expect(columns(ALL_OFF)).toEqual([
      ['Play', ['Tournaments', 'Scholastic', 'State champions', 'Scoresheet scanner']],
      ['Community', ['Clubs', 'Club map', 'List or update your club', 'News', 'LCA on Facebook ↗']],
      ['About LCA', ['About LCA', 'Board & regions', 'Bylaws & rules', 'Minutes', 'Annual meeting']],
      ['Contact', [LCA_EMAIL, 'Contact', 'Membership help', 'Website help', 'Donate']],
    ])
    const play = (features: Features) => labels(footerColumns(features)[0].links)
    expect(play(withOn('newTournaments'))).toEqual(['Tournaments', 'Scholastic', 'State champions', 'Scoresheet scanner', 'Calendar'])
    expect(play(withOn('newNews'))).toEqual(['Tournaments', 'Scholastic', 'State champions', 'Scoresheet scanner', 'Results'])
    expect(labels(footerColumns(withOn('newClubs'))[1].links)).toEqual(['Clubs', 'Club map', 'List or update your club', 'Suggest a club', 'News', 'LCA on Facebook ↗'])
    expect(labels(FOOTER_BRAND_ACTIONS)).toEqual(['Join LCA', 'Donate'])
  })

  it('links Bylaws & rules and Minutes from the trust line by id, so they follow the About rows', () => {
    expect(labels(TRUST_LINE_LINKS)).toEqual(['Bylaws & rules', 'Minutes'])
    expect(TRUST_LINE_LINKS.map((id) => navEntry(id, ALL_OFF).href)).toEqual(['/governance/bylaws', '/governance/minutes'])
    expect(TRUST_LINE_LINKS.map((id) => navEntry(id, withOn('newAbout')).href)).toEqual(['/about/bylaws', '/about/minutes'])
  })
})

describe('pages that hide the tab bar', () => {
  it('names today\'s three, each a route of src/App.tsx', () => {
    expect([...HIDE_TAB_BAR_ROUTES]).toEqual(['/tournaments/:id/print', '/membership/success', '/donate/success'])
    const app = read('src/App.tsx')
    for (const route of HIDE_TAB_BAR_ROUTES) expect(app, route).toContain(`<Route path="${route}"`)
  })

  it('reads ":id" as one part of the path', () => {
    for (const pathname of ['/tournaments/fx-t-open/print', '/tournaments/42/print', '/membership/success', '/donate/success', '/membership/success/']) {
      expect(hidesTabBar(pathname), pathname).toBe(true)
    }
    for (const pathname of ['/tournaments/fx-t-open', '/tournaments/fx-t-open/pairings', '/tournaments/print', '/tournaments/a/b/print', '/tournaments//print', '/membership', '/donate', '/', '/print']) {
      expect(hidesTabBar(pathname), pathname).toBe(false)
    }
    expect(routeMatches('/clubs/:id', '/clubs/suggest')).toBe(true)
    expect(routeMatches('/clubs/:id', '/clubs')).toBe(false)
  })
})

describe('switches', () => {
  it('holds the chrome to newNav and newLook both on', () => {
    expect(chromeOn(ALL_OFF)).toBe(false)
    expect(chromeOn(withOn('newNav'))).toBe(false)
    expect(chromeOn(withOn('newLook'))).toBe(false)
    expect(chromeOn(withOn('newNav', 'newLook'))).toBe(true)
    expect(chromeOn(withOff('newNav'))).toBe(false)
    expect(chromeOn(withOff('newLook'))).toBe(false)
  })

  it('shows search, the strip, its round states and the Live tag only inside the chrome, whatever their own switches say', () => {
    const GATES: Array<[string, (f: Features) => boolean, FeatureName[]]> = [
      ['siteSearch', searchOn, ['siteSearch']],
      ['eventStrip', eventStripOn, ['eventStrip']],
      ['eventStripLive', eventStripLiveOn, ['eventStrip', 'eventStripLive']],
      ['liveMarker', liveMarkerOn, ['liveMarker']],
    ]
    for (const [name, gate, own] of GATES) {
      // The chrome off in each of its three ways, everything else on.
      for (const off of [['newNav'], ['newLook'], ['newNav', 'newLook']] as FeatureName[][]) expect(gate(withOff(...off)), `${name} without ${off.join(' and ')}`).toBe(false)
      expect(gate(withOn(...own)), `${name} with only its own switches`).toBe(false)
      expect(gate(withOn(...CHROME, ...own)), `${name} inside the chrome`).toBe(true)
      expect(gate(withOn(...CHROME)), `${name} inside the chrome with its own switch off`).toBe(false)
      expect(switchOn(name as FeatureName, withOn(...own))).toBe(false)
      expect(switchOn(name as FeatureName, withOn(...CHROME, ...own))).toBe(true)
    }
    // The round states need the strip as well: there is nothing to show a round in without it.
    expect(eventStripLiveOn(withOff('eventStrip'))).toBe(false)
    // Every other switch is read as written.
    for (const name of NAMES.filter((n) => !['siteSearch', 'eventStrip', 'eventStripLive', 'liveMarker'].includes(n))) {
      expect(switchOn(name, withOn(name)), name).toBe(true)
      expect(switchOn(name, withOff(name)), name).toBe(false)
    }
  })

  it('keeps every entry that waits for a switch off while that switch is off, whichever others are on', () => {
    const waiting = NAV_IDS.filter((id) => navEntry(id).liveWith !== null)
    expect(waiting.length).toBeGreaterThan(0)
    for (const id of waiting) {
      const name = navEntry(id).liveWith!
      expect(isLive(id, ALL_OFF), id).toBe(false)
      expect(isLive(id, withOff(name)), `${id} with every switch on but ${name}`).toBe(false)
      const needs: FeatureName[] = name === 'eventStripLive' ? [...CHROME, 'eventStrip'] : ['siteSearch', 'eventStrip', 'liveMarker'].includes(name) ? [...CHROME] : []
      expect(isLive(id, withOn(name, ...needs)), `${id} with ${name} on`).toBe(true)
    }
    const today = NAV_IDS.filter((id) => navEntry(id).liveWith === null)
    for (const id of today) expect(isLive(id, ALL_OFF), id).toBe(true)
    // The rows the volunteer rail retires are live until it is on.
    const retired = NAV_IDS.filter((id) => navEntry(id).goneWith !== null)
    expect(retired).toEqual(['workspace', 'boardInbox', 'myRegionClubs'])
    for (const id of retired) {
      expect(isLive(id, ALL_OFF), id).toBe(true)
      expect(isLive(id, withOn('myLcaRail')), id).toBe(false)
    }
    // Live with every switch as the site has it today: the entries of today's pages only.
    expect(waiting.filter((id) => isLive(id, FEATURES))).toEqual(waiting.filter((id) => switchOn(navEntry(id).liveWith!, FEATURES)))
  })

  it('says in the switch file that the four show only inside the chrome', () => {
    const lines = read('src/lib/features.ts').split('\n')
    const commentAbove = (key: string) => {
      const at = lines.findIndex((l) => new RegExp(`^  ${key}: (?:true|false),$`).test(l))
      const out: string[] = []
      for (let i = at - 1; i >= 0 && lines[i].trim() !== ''; i--) {
        out.unshift(lines[i].trim())
        if (lines[i].trim().startsWith('/**')) break
      }
      return out.join(' ').replace(/\/\*\*|\*\//g, '').replace(/\s\*\s/g, ' ').replace(/\s+/g, ' ').trim()
    }
    for (const name of ['siteSearch', 'eventStrip', 'liveMarker']) expect(commentAbove(name), name).toMatch(/ It shows only when newNav and newLook are on as well\.$/)
    expect(commentAbove('eventStripLive')).toMatch(/ It shows only when eventStrip, newNav and newLook are on as well\.$/)
  })
})

describe('the About menu and Donate', () => {
  it('opens the governance rows at today\'s addresses or the About tabs, with newAbout and newNews each off and on', () => {
    const ROWS: NavId[] = ['boardRegions', 'bylawsRules', 'minutes', 'stateChampions']
    const at = (features: Features) => ROWS.map((id) => navEntry(id, features).href)
    expect(at(ALL_OFF)).toEqual(['/governance/board', '/governance/bylaws', '/governance/minutes', '/champions'])
    expect(at(withOn('newAbout'))).toEqual(['/about/board', '/about/bylaws', '/about/minutes', '/champions'])
    expect(at(withOn('newNews'))).toEqual(['/governance/board', '/governance/bylaws', '/governance/minutes', '/about/champions'])
    expect(at(withOn('newAbout', 'newNews'))).toEqual(['/about/board', '/about/bylaws', '/about/minutes', '/about/champions'])
    // The other rows keep their one address, and the footer and the trust line follow by id.
    for (const features of [ALL_OFF, withOn('newAbout', 'newNews')]) {
      expect(['aboutLca', 'annualMeeting', 'contact'].map((id) => navEntry(id as NavId, features).href)).toEqual(['/about', '/meeting', '/contact'])
      const about = footerColumns(features)[2].links.map((id) => navEntry(id, features).href)
      expect(about).toEqual(['/about', ...at(features).slice(0, 3), '/meeting'])
      expect(footerColumns(features)[0].links.map((id) => navEntry(id, features).href)).toContain(at(features)[3])
    }
  })

  it('has seven rows and LCA on Facebook below them, with Donate the last row above it when the bar is squeezed', () => {
    expect(labels(aboutMenu().rows)).toEqual(['About LCA', 'Board & regions', 'Bylaws & rules', 'Minutes', 'Annual meeting', 'State champions', 'Contact'])
    expect(navLabel(aboutMenu().footer)).toBe('LCA on Facebook ↗')
    expect(aboutMenu(true).rows).toEqual([...ABOUT_ROWS, 'donate'])
  })

  it('opens today\'s donation dialog from Donate until newMembership is on, then /give, the same entry everywhere', () => {
    expect(navEntry('donate', ALL_OFF)).toMatchObject({ href: null, does: 'donate-dialog', live: true })
    expect(navEntry('donate', withOn('newMembership'))).toMatchObject({ href: '/give', does: null, live: true })
    read('src/components/DonateButton.tsx')
    expect(headerUtilities({ signedIn: false })[0]).toBe('donate')
    expect(navSheet({ pathname: '/', signedIn: false }, ALL_OFF).utilities[0]).toBe('donate')
    expect(footerColumns(ALL_OFF)[3].links.at(-1)).toBe('donate')
    expect(aboutMenu(true).rows.at(-1)).toBe('donate')
  })
})

describe('the My LCA menu', () => {
  /** The rows the brief lists for each person, with myLcaRail off, before the card. */
  const RAIL_OFF: Record<Exclude<PersonaKey, 'signed-out'>, string[]> = {
    'active-member': ['My LCA', 'Log out'],
    'renews-soon': ['My LCA', 'Log out'],
    'expired-member': ['My LCA', 'Log out'],
    parent: ['My LCA', 'Family', 'Log out'],
    director: ['My LCA', 'Workspace', 'Log out'],
    'club-rep': ['My LCA', 'Workspace', 'Log out'],
    'regional-rep': ['My LCA', 'Board inbox', 'My region’s clubs', 'Log out'],
    officer: ['My LCA', 'Board inbox', 'Admin (view only)', 'Log out'],
    president: ['My LCA', 'Board inbox', 'Admin (view only)', 'Log out'],
    admin: ['My LCA', 'Board inbox', 'Admin', 'Log out'],
    everything: ['My LCA', 'Family', 'Board inbox', 'Admin', 'Log out'],
  }
  /** And with myLcaRail on: no role row for anyone. */
  const RAIL_ON: Record<Exclude<PersonaKey, 'signed-out'>, string[]> = {
    'active-member': ['My LCA', 'Log out'],
    'renews-soon': ['My LCA', 'Log out'],
    'expired-member': ['My LCA', 'Log out'],
    parent: ['My LCA', 'Family', 'Log out'],
    director: ['My LCA', 'Log out'],
    'club-rep': ['My LCA', 'Log out'],
    'regional-rep': ['My LCA', 'Log out'],
    officer: ['My LCA', 'Admin (view only)', 'Log out'],
    president: ['My LCA', 'Admin (view only)', 'Log out'],
    admin: ['My LCA', 'Admin', 'Log out'],
    everything: ['My LCA', 'Family', 'Admin', 'Log out'],
  }
  /** Membership card sits after Family, or after My LCA for someone with no Family row. */
  const withCard = (rows: string[]) => {
    const at = rows.includes('Family') ? rows.indexOf('Family') + 1 : 1
    return [...rows.slice(0, at), 'Membership card', ...rows.slice(at)]
  }

  it.each(SIGNED_IN.map((p) => [p.key, p] as const))('%s: the rows in their order, with myLcaRail and newMembership each off and on', (key, person) => {
    const k = key as Exclude<PersonaKey, 'signed-out'>
    const rows = (features: Features) => myLcaRows(person.holds, features).map((r) => r.label)
    expect(rows(ALL_OFF)).toEqual(RAIL_OFF[k])
    expect(rows(withOn('myLcaRail'))).toEqual(RAIL_ON[k])
    expect(rows(withOn('newMembership'))).toEqual(withCard(RAIL_OFF[k]))
    expect(rows(withOn('myLcaRail', 'newMembership'))).toEqual(withCard(RAIL_ON[k]))
    for (const features of [ALL_OFF, ALL_ON]) {
      const list = myLcaRows(person.holds, features)
      expect(list[0].label).toBe('My LCA')
      expect(list.at(-1)).toEqual({ id: 'logOut', label: 'Log out', href: null, roleRow: false })
    }
  })

  it('gives the browser tests, in each person\'s myLcaMenuRows, the rows the new header gives them on the a11y-on build, before the children reach the header', () => {
    const variant = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')
    expect(variant, 'the a11y-on build in test/a11y/global-setup.ts').toBeDefined()
    // The switches as that build has them: the site's own, with the build's names turned on.
    const onBuild = applyFlagOverrides(FEATURES, FLAG_OVERRIDE_MODE, variant!.flags)
    expect([onBuild.myLcaRail, onBuild.newMembership], 'myLcaRail and newMembership on the a11y-on build').toEqual([false, false])
    for (const person of SIGNED_IN) {
      // The sign-in context holds no children yet, so the header draws no Family row (src/components/layout/MyLcaMenu.tsx).
      expect(person.myLcaMenuRows, person.key).toEqual(myLcaRows({ ...person.holds, hasChildren: false }, onBuild).map((r) => r.label))
    }
    expect(PEOPLE.find((p) => p.key === 'signed-out')!.myLcaMenuRows).toEqual([])
  })

  it('reads "Admin" for an LCA admin and "Admin (view only)" for the officers and the president', () => {
    for (const role of MEMBER_ROLES) {
      const row = adminRowFor(role)
      const expected = role === 'lca_admin' ? 'Admin' : role === 'lca_officer' || role === 'lca_observer' ? 'Admin (view only)' : null
      expect(row === null ? null : navLabel(row), role).toBe(expected)
    }
  })

  it('with myLcaRail on, gives no one a Workspace, Board inbox or My region’s clubs row, a club rep included, and says Workspace nowhere', () => {
    const everyone: MyLcaPerson[] = []
    for (const role of MEMBER_ROLES) {
      for (const isBoardMember of [false, true]) {
        for (const managedClubs of [0, 2]) {
          for (const directedEvents of [0, 1]) {
            for (const hasChildren of [false, true]) everyone.push({ role, isBoardMember, managedClubs, directedEvents, hasChildren })
          }
        }
      }
    }
    for (const features of [withOn('myLcaRail'), ALL_ON]) {
      for (const person of [...everyone, ...SIGNED_IN.map((p) => p.holds)]) {
        const rows = myLcaRows(person, features)
        expect(rows.filter((r) => r.roleRow), JSON.stringify(person)).toEqual([])
        for (const row of rows) {
          expect(row.label).not.toMatch(/Workspace|Board inbox|My region/)
        }
        const sheet = navSheet({ pathname: '/', signedIn: true, person }, features)
        expect([...sheet.roles, ...sheet.utilities].map(navLabel).join(' ')).not.toMatch(/Workspace/)
        expect(sheet.roles).toEqual(adminRowFor(person.role) ? [adminRowFor(person.role)] : [])
      }
      expect(searchPages(features).map(navLabel).join(' ')).not.toMatch(/Workspace/)
    }
  })

  it('with myLcaRail off, gives each person today\'s account links, the Admin row standing for Admin panel', () => {
    for (const person of SIGNED_IN) {
      const rows = myLcaRows(person.holds, ALL_OFF)
      const roleRows = rows.filter((r) => r.roleRow).map((r) => r.label)
      expect(roleRows, person.key).toEqual(person.todaysRoleLinks.filter((l) => l !== 'Admin panel'))
      const admin = rows.some((r) => r.id === 'admin' || r.id === 'adminViewOnly')
      expect(admin, person.key).toBe(person.todaysRoleLinks.includes('Admin panel'))
      // The sheet holds the same rows until the rail: today's role rows, then the Admin row.
      const sheet = navSheet({ pathname: '/', signedIn: true, person: person.holds }, ALL_OFF)
      expect(sheet.roles).toEqual(rows.filter((r) => r.roleRow || r.id === adminRowFor(person.holds.role)).map((r) => r.id))
    }
  })

  it('follows today\'s header for the cases the persona list does not cover', () => {
    const person = (role: MemberRole, more: Partial<MyLcaPerson> = {}): MyLcaPerson => ({ role, isBoardMember: false, managedClubs: 0, directedEvents: 0, hasChildren: false, ...more })
    const rows = (p: MyLcaPerson) => myLcaRows(p, ALL_OFF).map((r) => r.label)
    // A member who directs an event, a director who directs none, and an auditor get Workspace.
    expect(rows(person('member', { directedEvents: 1 }))).toEqual(['My LCA', 'Workspace', 'Log out'])
    expect(rows(person('tournament_director'))).toEqual(['My LCA', 'Workspace', 'Log out'])
    expect(rows(person('lca_auditor'))).toEqual(['My LCA', 'Workspace', 'Log out'])
    // An admin who directs an event, or an officer who does, gets the Admin row in Workspace's place, as today's header gives Admin panel.
    expect(rows(person('lca_admin', { isBoardMember: true, directedEvents: 1 }))).toEqual(['My LCA', 'Board inbox', 'Admin', 'Log out'])
    expect(rows(person('lca_officer', { isBoardMember: true, directedEvents: 1 }))).toEqual(['My LCA', 'Board inbox', 'Admin (view only)', 'Log out'])
    // My region's clubs for anyone but an LCA admin who manages a region's clubs.
    expect(rows(person('member', { managedClubs: 3 }))).toEqual(['My LCA', 'My region’s clubs', 'Log out'])
    expect(rows(person('lca_admin', { isBoardMember: true, managedClubs: 3 }))).toEqual(['My LCA', 'Board inbox', 'Admin', 'Log out'])
    // Today's header writes the same three conditions.
    const navbar = read('src/components/layout/Navbar.tsx')
    for (const piece of [
      'if (canAccessAdmin(role)) {',
      '} else if (WORKSPACE_ROLES.includes(role) || directedTournamentIds.length > 0) {',
      'if (isBoardMember) {',
      "if (role !== 'lca_admin' && managedClubs.length > 0) {",
    ]) expect(navbar, piece).toContain(piece)
  })
})

describe('the persona list', () => {
  it('holds the twelve people, in order, the first of them signed out', () => {
    expect(PEOPLE.map((p) => p.key)).toEqual([...PERSONA_KEYS])
    expect(PEOPLE).toHaveLength(12)
    const out = PEOPLE[0]
    expect([out.user, out.aal, out.answers, out.holds, out.todaysRoleLinks]).toEqual([null, null, null, null, []])
    expect(SIGNED_IN).toHaveLength(11)
  })

  it('makes every person up, with the seed\'s style of ids, names and addresses', () => {
    for (const person of SIGNED_IN) {
      const member = person.answers!.me.member
      expect(member.id, person.key).toMatch(/^fx-m-[a-z0-9-]+$/)
      expect(member.full_name, person.key).toMatch(/^[A-Z][a-z]+ Fixture$/)
      expect(member.email, person.key).toMatch(/^[a-z]+\.fixture@example\.org$/)
      expect(member.uscf_id, person.key).toBeNull()
      expect(person.user).toEqual({ id: member.id, email: member.email, fullName: member.full_name })
      expect(person.answers!.synced.member).toEqual(member)
      for (const childRow of person.answers!.me.children) expect(childRow.full_name).toMatch(/^[A-Z][a-z]+ Fixture$/)
    }
  })

  it('works its dates out from the day it is made for', () => {
    for (const today of [TODAY, new Date(Date.UTC(2027, 2, 1, 9))]) {
      const people = navPersonas(today)
      const day = (key: PersonaKey) => {
        const expiry = people.find((p) => p.key === key)!.answers!.me.member.membership_expiry!
        return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000)
      }
      expect(day('renews-soon')).toBe(20)
      expect(day('expired-member')).toBe(-20)
      expect(day('active-member')).toBeGreaterThan(30)
    }
    const soon = PEOPLE.find((p) => p.key === 'renews-soon')!.answers!.me.member
    expect(soon.membership_status).toBe('active')
    const lapsed = PEOPLE.find((p) => p.key === 'expired-member')!.answers!.me.member
    expect(lapsed.membership_status).toBe('expired')
  })

  it('holds for each person what its answers say, as the site works it out', () => {
    for (const person of SIGNED_IN) {
      const { me, mySeats } = person.answers!
      const role = me.member.role as MemberRole
      expect(person.holds.role, person.key).toBe(role)
      expect(person.holds.managedClubs, person.key).toBe(mySeats.managedClubs.length)
      expect(person.holds.directedEvents, person.key).toBe(me.directedTournaments.length)
      expect(person.holds.hasChildren, person.key).toBe(me.children.length > 0)
      // AuthContext's rule for the board inbox: a current seat, an LCA admin, or a view-only admin.
      expect(person.holds.isBoardMember, person.key).toBe(mySeats.seats.length > 0 || role === 'lca_admin' || isViewOnlyAdmin(role))
      expect(person.aal, person.key).toBe(role === 'lca_admin' ? 'aal2' : 'aal1')
      expect(person.answers!.eventMode, person.key).toBeNull()
      expect(person.answers!.liveNow, person.key).toBeNull()
      for (const link of person.todaysRoleLinks) expect(TODAYS_ACCOUNT_LINKS, person.key).toContain(link)
    }
    expect(read('src/contexts/AuthContext.tsx')).toContain("const isBoardMember = seats.length > 0 || role === 'lca_admin' || isViewOnlyAdmin(role)")
    // The parent and the person holding everything have two children each.
    for (const key of ['parent', 'everything'] as const) expect(PEOPLE.find((p) => p.key === key)!.answers!.me.children).toHaveLength(2)
  })

  it('names the account links today\'s header can show, as Navbar.tsx writes them', () => {
    const navbar = read('src/components/layout/Navbar.tsx')
    for (const link of TODAYS_ACCOUNT_LINKS) {
      const written = link.replace('’', '\\u2019')
      expect(navbar, link).toContain(`label: '${written}'`)
    }
  })

  it('imports nothing at run time, so the browser tests can load it too', () => {
    const source = read('test/unit/fixtures/navPersonas.ts')
    const imports = source.split('\n').filter((l) => /^import\b/.test(l))
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) expect(line, line).toMatch(/^import type \{[^}]+\} from '[^']+'$/)
    expect(source).not.toMatch(/from 'vitest'/)
  })
})

describe('search\'s data', () => {
  it('gives search every live page anyone can open, and none of the buttons or account pages', () => {
    const pages = searchPages(ALL_OFF)
    for (const id of ['tournaments', 'clubs', 'scholastic', 'news', 'membership', 'scanner', 'aboutLca', 'boardRegions', 'bylawsRules', 'minutes', 'annualMeeting', 'stateChampions', 'contact', 'websiteHelp'] as NavId[]) {
      expect(pages, id).toContain(id)
    }
    for (const id of ['about', 'logIn', 'joinLca', 'renew', 'donate', 'search', 'logOut', 'myLca', 'workspace', 'admin', 'menu', 'facebook', 'email', 'thisWeekend', 'results', 'suggestClub'] as NavId[]) {
      expect(pages, id).not.toContain(id)
    }
    expect(searchPages(withOn('newTournaments', 'newNews', 'newClubs'))).toEqual(expect.arrayContaining(['thisWeekend', 'calendar', 'results', 'suggestClub']))
  })

  it('points every word parents use at an entry, as the board groups them', () => {
    const SYNONYMS = SEARCH_SYNONYMS as Record<string, NavId>
    for (const [word, id] of Object.entries(SYNONYMS)) {
      expect(word, word).toMatch(/^[a-z]+(?: [a-z]+)*$/)
      expect(NAV_IDS, word).toContain(id)
    }
    const GROUPS: Array<[NavId, string[]]> = [
      ['scholastic', ['kids', 'youth', 'school', 'first tournament']],
      ['bylawsRules', ['bylaws', 'rules']],
      ['boardRegions', ['board', 'officers', 'regions']],
      ['membership', ['join', 'renew']],
      ['scanner', ['scoresheet', 'scanner']],
      ['minutes', ['minutes']],
      ['donate', ['donate']],
      ['websiteHelp', ['support', 'help']],
    ]
    for (const [id, words] of GROUPS) for (const word of words) expect(SYNONYMS[word], word).toBe(id)
    expect(Object.keys(SYNONYMS)).toHaveLength(GROUPS.flatMap(([, words]) => words).length)
    // No group for ratings and US Chess IDs: the help page it would point at does not exist yet.
    for (const word of ['rating', 'id']) expect(SYNONYMS[word], word).toBeUndefined()
  })

  it('names a region for every alias', () => {
    expect(REGION_ALIASES).toEqual({ nola: 'New Orleans Metro', northshore: 'North of Lake Pontchartrain', acadiana: 'South Central Louisiana' })
    for (const [alias, region] of Object.entries(REGION_ALIASES)) {
      expect(alias, alias).toMatch(/^[a-z]+$/)
      expect(REGIONS as readonly string[], alias).toContain(region)
    }
  })
})

describe('the guard on the five switches that point rows at later pages', () => {
  const EARLY = ['newAbout', 'newNews', 'newMembership', 'newClubs', 'myLcaRail'] as const
  type Early = (typeof EARLY)[number]

  /** Every <Route path="..."> of src/App.tsx, the heritage pages included, as written. */
  const APP_ROUTES = new Set([...read('src/App.tsx').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]))
  const pathOf = (address: string) => address.split(/[?#]/)[0]

  /**
   * The paths one switch, on alone, has the model open that it does not open
   * with every switch off, with the routes it needs besides (the rail's Member
   * lookup). A parameter route such as /clubs/:id does not count for a path
   * it would only read as an id, so the paths are compared as written.
   */
  function pathsFor(name: Early): string[] {
    const before = new Set(openedAddresses(ALL_OFF))
    const opened = openedAddresses(withOn(name)).filter((a) => !before.has(a) && a.startsWith('/'))
    return [...new Set([...opened.map(pathOf), ...(SWITCH_NEEDS[name] ?? [])])].sort()
  }
  const missingRoutes = (name: Early, routes: ReadonlySet<string>) => pathsFor(name).filter((path) => !routes.has(path))

  it('reads the routes of src/App.tsx', () => {
    for (const route of ['/', '/workspace', '/governance/board', '/champions', '/donate/success', '/tournaments/:id/print', '/clubs/:id']) expect(APP_ROUTES, route).toContain(route)
  })

  it('knows the paths each of the five opens, or needs, once it is on', () => {
    expect(Object.fromEntries(EARLY.map((name) => [name, pathsFor(name)]))).toEqual({
      newAbout: ['/about/board', '/about/bylaws', '/about/minutes'],
      newNews: ['/about/champions', '/results'],
      newMembership: ['/dashboard/you', '/give'],
      newClubs: ['/clubs/suggest'],
      myLcaRail: ['/workspace/lookup'],
    })
  })

  it.each(EARLY)('%s is off, or src/App.tsx has a route for every path its rows open', (name) => {
    const missing = FEATURES[name] ? missingRoutes(name, APP_ROUTES) : []
    expect(missing, `${name} is on, but src/App.tsx has no route for ${missing.join(', ')}. The five switches newAbout, newNews, newMembership, newClubs and myLcaRail stay off until their part ships: leave ${name} off until the pages it opens exist.`).toEqual([])
  })

  it.each(EARLY)('can fail: with %s on before its part ships, it names each path that has no route', (name) => {
    // Today's routes with every path of the five taken out stand for a tree in
    // which none of their parts has shipped, as is the case today; the case
    // stays true when a part ships and adds its routes.
    const all = new Set(EARLY.flatMap(pathsFor))
    const notShipped = new Set([...APP_ROUTES].filter((route) => !all.has(route)))
    expect(missingRoutes(name, notShipped)).toEqual(pathsFor(name))
    expect(missingRoutes(name, notShipped).length).toBeGreaterThan(0)
    // The route for a club's page is no route for Suggest a club.
    if (name === 'newClubs') expect(missingRoutes(name, new Set([...notShipped, '/clubs/:id']))).toEqual(['/clubs/suggest'])
  })
})

describe('src/lib/nav.ts itself', () => {
  it('is plain data and functions: no React, no router, no fetch, no contract, no colour', () => {
    const source = read('src/lib/nav.ts')
    const imports = source.split('\n').filter((l) => /^import\b/.test(l))
    expect(imports).toEqual([
      "import { FEATURES, type FeatureName, type Features } from '@/lib/features'",
      "import { WORKSPACE_ROLES, canAccessAdmin, isViewOnlyAdmin, type MemberRole } from '@/areas/admin/roles'",
      "import type { Region } from '@/lib/regions'",
    ])
    expect(source).not.toMatch(/\bfetch\(|react|zod|domain\/contracts|className|#[0-9a-fA-F]{6}\b/)
  })

  it.each(['src/lib/nav.ts', 'test/unit/nav.test.ts', 'test/unit/fixtures/navPersonas.ts'])('%s holds no em dash, no en dash and no old initials for US Chess', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(OLD_INITIALS)
  })
})
