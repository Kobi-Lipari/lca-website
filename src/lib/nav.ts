// src/lib/nav.ts
//
// The navigation model: one entry for every place the site's header, About
// menu, My LCA menu, phone sheet and tabs, footer, trust line and search
// link to, each with its one label, and the lists those parts are built
// from. A list names its entries by id, so a label can only come from its
// entry and no page is ever called two things (the decided board
// Nav-IA-Final, section F).
//
// Nothing here draws anything. The page frame reads the chrome's condition
// (src/App.tsx), and the new header and its About and My LCA menus read the
// sections, the rows and the utilities (src/components/layout); the sheet,
// the tabs and the footer that read the rest come later, behind newNav.
// Everything that depends on a switch takes the switches as its last
// argument, which defaults to FEATURES, so a test can try any combination.
// Icons are names, not components, so the model stays plain data; the part
// that draws a tab maps the name to its icon.
import { FEATURES, type FeatureName, type Features } from '@/lib/features'
import { WORKSPACE_ROLES, canAccessAdmin, isViewOnlyAdmin, type MemberRole } from '@/areas/admin/roles'
import type { Region } from '@/lib/regions'

// The chrome's one condition

/**
 * Everything newNav turns on shows only when newLook is on as well. The new
 * chrome is drawn in the new look's colours, dark mode and focus rings, which
 * exist only under newLook; without it the gold ink is brand gold, which would
 * be gold words on the light menus. With newNav on and newLook off the site
 * keeps today's header and footer.
 */
export function chromeOn(features: Features = FEATURES): boolean {
  return features.newNav && features.newLook
}

/** The Search button, its panel and /search: siteSearch, inside the chrome. */
export function searchOn(features: Features = FEATURES): boolean {
  return chromeOn(features) && features.siteSearch
}

/** The personal event strip, the phone's event bar and its banner: eventStrip, inside the chrome. */
export function eventStripOn(features: Features = FEATURES): boolean {
  return chromeOn(features) && features.eventStrip
}

/**
 * The strip's round states: eventStripLive, inside the chrome and only with
 * the strip itself on, since without the strip there is nothing to show a
 * round in.
 */
export function eventStripLiveOn(features: Features = FEATURES): boolean {
  return eventStripOn(features) && features.eventStripLive
}

/** The public Live tag on Tournaments: liveMarker, inside the chrome. */
export function liveMarkerOn(features: Features = FEATURES): boolean {
  return chromeOn(features) && features.liveMarker
}

/**
 * A switch as the model reads it: the four that draw inside the chrome count
 * only while their gate above is open; every other switch is read as written.
 */
export function switchOn(name: FeatureName, features: Features = FEATURES): boolean {
  switch (name) {
    case 'siteSearch':
      return searchOn(features)
    case 'eventStrip':
      return eventStripOn(features)
    case 'eventStripLive':
      return eventStripLiveOn(features)
    case 'liveMarker':
      return liveMarkerOn(features)
    default:
      return features[name]
  }
}

// Entries

/**
 * What kind of place an entry is:
 *
 * - page: a page anyone can open, which search can find
 * - account: a page for someone signed in (My LCA and the rows of its menu)
 * - menu: a section with no page of its own (About opens a menu)
 * - action: a button in the bar or the sheet (Log in, Join LCA, Renew,
 *   Donate, Search, Log out)
 * - control: something on the page itself (the Menu tab, the theme switch,
 *   hiding the event bar)
 * - facebook: LCA's Facebook page, which opens in a new tab
 * - email: LCA's email address, as a mail link
 */
export type NavKind = 'page' | 'account' | 'menu' | 'action' | 'control' | 'facebook' | 'email'

/** What an entry does when it has no address of its own. */
export type NavAction = 'donate-dialog' | 'sign-out' | 'open-sheet' | 'appearance' | 'hide-event-bar'

/** The name of a tab's icon; the part that draws the tab maps it to the icon. */
export type NavIcon = 'trophy' | 'users' | 'user' | 'menu'

interface EntryDef {
  readonly label: string
  readonly kind: NavKind
  /** Where it goes today, if it goes anywhere. */
  readonly href?: string
  /** Where it goes instead once a switch is on. */
  readonly moves?: { readonly when: FeatureName; readonly href: string }
  /** The switch it waits for; an entry without one is live today. */
  readonly liveWith?: FeatureName
  /** The switch that retires it: the volunteer rail takes the role rows out of the menu. */
  readonly goneWith?: FeatureName
  /** What it does while it has no address. */
  readonly does?: NavAction
}

/** The association's Facebook page, as today's header and footer link it. */
export const FACEBOOK_URL = 'https://www.facebook.com/LouisianaChessAssociation'

/** The association's email address, as the contact page gives it. */
export const LCA_EMAIL = 'LouisianaChess@gmail.com'

const ENTRIES = {
  // The six sections. About is a menu with no page of its own.
  tournaments: { label: 'Tournaments', kind: 'page', href: '/tournaments' },
  clubs: { label: 'Clubs', kind: 'page', href: '/clubs' },
  scholastic: { label: 'Scholastic', kind: 'page', href: '/scholastic' },
  news: { label: 'News', kind: 'page', href: '/news' },
  membership: { label: 'Membership', kind: 'page', href: '/membership' },
  about: { label: 'About', kind: 'menu' },

  // Under Tournaments. This weekend and Calendar wait for the new Tournaments
  // page, and Results for the results index.
  scanner: { label: 'Scoresheet scanner', kind: 'page', href: '/scanner' },
  thisWeekend: { label: 'This weekend', kind: 'page', href: '/tournaments?when=weekend', liveWith: 'newTournaments' },
  calendar: { label: 'Calendar', kind: 'page', href: '/tournaments?view=calendar', liveWith: 'newTournaments' },
  results: { label: 'Results', kind: 'page', href: '/results', liveWith: 'newNews' },

  // Under Clubs. No address is set for Suggest a club yet; /clubs/suggest is
  // this model's choice until the new clubs pages give it one.
  clubMap: { label: 'Club map', kind: 'page', href: '/clubs#map' },
  listClub: { label: 'List or update your club', kind: 'page', href: '/contact?subject=club' },
  suggestClub: { label: 'Suggest a club', kind: 'page', href: '/clubs/suggest', liveWith: 'newClubs' },

  // The About menu's rows. Board & regions, Bylaws & rules and Minutes open
  // the About page's tabs once newAbout is on, and State champions its
  // champions tab once newNews is on; until then each opens today's page.
  aboutLca: { label: 'About LCA', kind: 'page', href: '/about' },
  boardRegions: { label: 'Board & regions', kind: 'page', href: '/governance/board', moves: { when: 'newAbout', href: '/about/board' } },
  bylawsRules: { label: 'Bylaws & rules', kind: 'page', href: '/governance/bylaws', moves: { when: 'newAbout', href: '/about/bylaws' } },
  minutes: { label: 'Minutes', kind: 'page', href: '/governance/minutes', moves: { when: 'newAbout', href: '/about/minutes' } },
  annualMeeting: { label: 'Annual meeting', kind: 'page', href: '/meeting' },
  stateChampions: { label: 'State champions', kind: 'page', href: '/champions', moves: { when: 'newNews', href: '/about/champions' } },
  contact: { label: 'Contact', kind: 'page', href: '/contact' },
  facebook: { label: 'LCA on Facebook ↗', kind: 'facebook', href: FACEBOOK_URL },

  // The footer's Contact column, beside Contact and Donate.
  email: { label: LCA_EMAIL, kind: 'email', href: `mailto:${LCA_EMAIL}` },
  membershipHelp: { label: 'Membership help', kind: 'page', href: '/contact?subject=membership' },
  websiteHelp: { label: 'Website help', kind: 'page', href: '/support' },

  // The bar's utilities and the account. Donate opens today's donation
  // dialog until the Give page exists behind newMembership, then /give.
  search: { label: 'Search', kind: 'action', href: '/search', liveWith: 'siteSearch' },
  donate: { label: 'Donate', kind: 'action', does: 'donate-dialog', moves: { when: 'newMembership', href: '/give' } },
  logIn: { label: 'Log in', kind: 'action', href: '/login' },
  joinLca: { label: 'Join LCA', kind: 'action', href: '/membership' },
  renew: { label: 'Renew', kind: 'action', href: '/membership' },

  // The My LCA menu. The card has no address yet; /dashboard/you is this
  // model's choice, the part of the new My LCA page that shows it. The three
  // role rows are today's More menu links, kept until the volunteer rail.
  myLca: { label: 'My LCA', kind: 'account', href: '/dashboard' },
  family: { label: 'Family', kind: 'account', href: '/dashboard' },
  membershipCard: { label: 'Membership card', kind: 'account', href: '/dashboard/you', liveWith: 'newMembership' },
  workspace: { label: 'Workspace', kind: 'account', href: '/workspace', goneWith: 'myLcaRail' },
  boardInbox: { label: 'Board inbox', kind: 'account', href: '/board/inbox', goneWith: 'myLcaRail' },
  myRegionClubs: { label: 'My region’s clubs', kind: 'account', href: '/dashboard', goneWith: 'myLcaRail' },
  admin: { label: 'Admin', kind: 'account', href: '/admin' },
  adminViewOnly: { label: 'Admin (view only)', kind: 'account', href: '/admin' },
  logOut: { label: 'Log out', kind: 'action', does: 'sign-out' },

  // Controls of the phone's tabs and sheet.
  menu: { label: 'Menu', kind: 'control', does: 'open-sheet' },
  appearance: { label: 'Appearance', kind: 'control', does: 'appearance' },
  hideEventBar: { label: 'Hide event bar until the next update', kind: 'control', does: 'hide-event-bar', liveWith: 'eventStrip' },
} as const satisfies Record<string, EntryDef>

/** The id of one entry. */
export type NavId = keyof typeof ENTRIES

/** Every entry's id, in the order the model lists them. */
export const NAV_IDS = Object.keys(ENTRIES) as NavId[]

/** One entry as it stands with a given set of switches. */
export interface NavEntry {
  readonly id: NavId
  /** Its one label, the same wherever it appears. */
  readonly label: string
  readonly kind: NavKind
  /** Where it goes with these switches, or null when it does something instead. */
  readonly href: string | null
  /** What it does when it has no address. */
  readonly does: NavAction | null
  /** It leaves the site's pages: the Facebook page and the email address. */
  readonly leavesSite: boolean
  /** It opens in a new tab: the Facebook page only. */
  readonly newTab: boolean
  /** False while the switch it waits for is off, and once the switch that retires it is on. */
  readonly live: boolean
  /** The switch it waits for, if any. */
  readonly liveWith: FeatureName | null
  /** The switch that retires it, if any. */
  readonly goneWith: FeatureName | null
}

/** True when the entry is live with these switches. */
export function isLive(id: NavId, features: Features = FEATURES): boolean {
  const def: EntryDef = ENTRIES[id]
  if (def.liveWith && !switchOn(def.liveWith, features)) return false
  if (def.goneWith && switchOn(def.goneWith, features)) return false
  return true
}

/** The entry as it stands with these switches. */
export function navEntry(id: NavId, features: Features = FEATURES): NavEntry {
  const def: EntryDef = ENTRIES[id]
  const href = def.moves && switchOn(def.moves.when, features) ? def.moves.href : (def.href ?? null)
  return {
    id,
    label: def.label,
    kind: def.kind,
    href,
    does: href === null ? (def.does ?? null) : null,
    leavesSite: def.kind === 'facebook' || def.kind === 'email',
    newTab: def.kind === 'facebook',
    live: isLive(id, features),
    liveWith: def.liveWith ?? null,
    goneWith: def.goneWith ?? null,
  }
}

/** The one label of an entry. */
export function navLabel(id: NavId): string {
  return ENTRIES[id].label
}

/** Every address the model opens with these switches: the address of each live entry, once. */
export function openedAddresses(features: Features = FEATURES): string[] {
  const out = new Set<string>()
  for (const id of NAV_IDS) {
    const entry = navEntry(id, features)
    if (entry.live && entry.href !== null) out.add(entry.href)
  }
  return [...out]
}

/**
 * Routes a switch needs beyond the addresses its rows open. The volunteer
 * rail takes Workspace, Board inbox and My region's clubs out of the menu,
 * and its Member lookup at /workspace/lookup is where that work goes.
 */
export const SWITCH_NEEDS: Partial<Record<FeatureName, readonly string[]>> = {
  myLcaRail: ['/workspace/lookup'],
}

// Sections

/** The six sections, in the order the header and the sheet show them. */
export const SECTIONS = ['tournaments', 'clubs', 'scholastic', 'news', 'membership', 'about'] as const

/** The id of one section, which is also the id of its entry. */
export type SectionId = (typeof SECTIONS)[number]

/**
 * The addresses each section owns, for aria-current and the sheet's "You
 * are here". Each page lives under one section; /support, /search, /login,
 * /dashboard and the pages for volunteers belong to none.
 */
export const SECTION_ROUTES: { readonly [S in SectionId]: readonly string[] } = {
  tournaments: ['/tournaments', '/scanner', '/results'],
  clubs: ['/clubs'],
  scholastic: ['/scholastic'],
  news: ['/news'],
  membership: ['/membership', '/donate', '/give'],
  about: ['/about', '/governance', '/champions', '/state-champions', '/meeting', '/contact'],
}

/** A line under a section's name in the sheet. */
export const SECTION_NOTES: { readonly [S in SectionId]?: string } = {
  scholastic: 'Kids and school chess',
}

/** The words beside the current section in the sheet and the current row of the About menu. */
export const YOU_ARE_HERE = 'You are here'

/** True when the path is the address or under it, the rule today's header uses. */
export function pathIsUnder(pathname: string, address: string): boolean {
  return pathname === address || pathname.startsWith(`${address}/`)
}

/** The section that owns a path, or null for a page outside the six. */
export function sectionFor(pathname: string): SectionId | null {
  return SECTIONS.find((id) => SECTION_ROUTES[id].some((address) => pathIsUnder(pathname, address))) ?? null
}

/** The header's six sections, in order. */
export function headerSections(): readonly SectionId[] {
  return SECTIONS
}

// The header's utilities

/** The slot after Log in or My LCA: Join LCA, Renew, or nothing. */
export type JoinSlot = 'joinLca' | 'renew' | null

/** What the bar knows about the visitor. */
export interface NavAccount {
  readonly signedIn: boolean
  /**
   * For someone signed in, whether the slot holds Join LCA, Renew or nothing;
   * who gets which is the header's to decide. Someone signed out always gets
   * Join LCA.
   */
  readonly joinSlot?: JoinSlot
}

/** Donate, then Log in or My LCA, then the join slot: the bar's utilities in their order. */
export function headerUtilities(account: NavAccount): NavId[] {
  const slot: JoinSlot = account.signedIn ? (account.joinSlot ?? null) : 'joinLca'
  return ['donate', account.signedIn ? 'myLca' : 'logIn', ...(slot ? [slot] : [])]
}

// The About menu

/** The About menu's rows, in order. */
export const ABOUT_ROWS = ['aboutLca', 'boardRegions', 'bylawsRules', 'minutes', 'annualMeeting', 'stateChampions', 'contact'] as const satisfies readonly NavId[]

/** The About menu's footer row. */
export const ABOUT_FOOTER_ROW = 'facebook' satisfies NavId

/**
 * The About menu: its seven rows, with Donate as the last row above the
 * footer row when the bar is too tight to hold it, and LCA on Facebook below.
 */
export function aboutMenu(squeezed = false): { rows: NavId[]; footer: NavId } {
  return { rows: [...ABOUT_ROWS, ...(squeezed ? (['donate'] as const) : [])], footer: ABOUT_FOOTER_ROW }
}

// The My LCA menu

/**
 * What the My LCA menu needs to know about the person, as plain data. The
 * site works these out from what it loads for the person: isBoardMember as
 * today's header has it (a current seat, an LCA admin, or a view-only admin),
 * the clubs a regional seat covers, the events the person directs, and
 * whether they look after children on a family account.
 */
export interface MyLcaPerson {
  readonly role: MemberRole
  readonly isBoardMember: boolean
  readonly managedClubs: number
  readonly directedEvents: number
  readonly hasChildren: boolean
}

/** One row of the My LCA menu. */
export interface MyLcaRow {
  readonly id: NavId
  readonly label: string
  /** Null for Log out, which signs the person out. */
  readonly href: string | null
  /** One of today's role rows (Workspace, Board inbox, My region's clubs), kept until the volunteer rail. */
  readonly roleRow: boolean
}

/** The Admin row a person holds: Admin for an LCA admin, view only for the officers and the president, or none. */
export function adminRowFor(role: MemberRole): 'admin' | 'adminViewOnly' | null {
  if (role === 'lca_admin') return 'admin'
  if (isViewOnlyAdmin(role)) return 'adminViewOnly'
  return null
}

/**
 * Today's role rows for a person, with the conditions today's header uses:
 * Workspace for someone who has no Admin and holds a workspace role or
 * directs an event; Board inbox for a board member; My region's clubs for
 * anyone but an LCA admin who manages a region's clubs.
 */
export function todaysRoleRows(person: MyLcaPerson): NavId[] {
  const rows: NavId[] = []
  if (!canAccessAdmin(person.role) && (WORKSPACE_ROLES.includes(person.role) || person.directedEvents > 0)) rows.push('workspace')
  if (person.isBoardMember) rows.push('boardInbox')
  if (person.role !== 'lca_admin' && person.managedClubs > 0) rows.push('myRegionClubs')
  return rows
}

/**
 * The rows of the My LCA menu, in order: My LCA; Family for a parent or
 * guardian; Membership card once the card exists; today's role rows until
 * the volunteer rail is on; the Admin row the person holds; Log out. The
 * to-do group and the event line join later.
 */
export function myLcaRows(person: MyLcaPerson, features: Features = FEATURES): MyLcaRow[] {
  const ids: NavId[] = ['myLca']
  if (person.hasChildren) ids.push('family')
  ids.push('membershipCard')
  ids.push(...todaysRoleRows(person))
  const admin = adminRowFor(person.role)
  if (admin) ids.push(admin)
  ids.push('logOut')
  const roleRows: readonly NavId[] = ['workspace', 'boardInbox', 'myRegionClubs']
  return ids
    .map((id) => navEntry(id, features))
    .filter((entry) => entry.live)
    .map((entry) => ({ id: entry.id, label: entry.label, href: entry.href, roleRow: roleRows.includes(entry.id) }))
}

// The phone's tabs

/** The id of one tab. */
export type TabId = 'tournaments' | 'clubs' | 'account' | 'menu'

/** One tab of the phone's tab bar. */
export interface NavTab {
  readonly id: TabId
  /** The entry the tab is: its label and its address come from the entry. */
  readonly entry: NavId
  readonly icon: NavIcon
  /** The Menu tab's words while the sheet is open. */
  readonly whileOpen?: string
}

/**
 * The four tabs: the Tournaments and Clubs entries themselves, Log in or My
 * LCA (the same icon in the same place either way), and Menu.
 */
export function navTabs(signedIn: boolean): NavTab[] {
  return [
    { id: 'tournaments', entry: 'tournaments', icon: 'trophy' },
    { id: 'clubs', entry: 'clubs', icon: 'users' },
    { id: 'account', entry: signedIn ? 'myLca' : 'logIn', icon: 'user' },
    { id: 'menu', entry: 'menu', icon: 'menu', whileOpen: 'Close' },
  ]
}

/**
 * The tab that is current on a path: Tournaments and Clubs for their
 * sections, the third tab on /login and /dashboard, and Menu on the pages of
 * the other four sections, which live in the sheet.
 */
export function currentTab(pathname: string): TabId | null {
  const section = sectionFor(pathname)
  if (section === 'tournaments' || section === 'clubs') return section
  if (section) return 'menu'
  if (pathIsUnder(pathname, '/login') || pathIsUnder(pathname, '/dashboard')) return 'account'
  return null
}

// The phone's sheet

/** A row inside a section of the sheet. */
export interface SheetRow {
  readonly entry: NavId
  /** The section's own page, labelled from the section's label ("All tournaments"). */
  readonly all: boolean
}

/** One section of the sheet. */
export interface SheetSection {
  readonly section: SectionId
  /** The section the page is in: it opens with "You are here". */
  readonly current: boolean
  readonly note: string | null
  readonly rows: readonly SheetRow[]
}

/** The sheet, top to bottom. */
export interface NavSheet {
  readonly sections: readonly SheetSection[]
  /** Donate, Log in or My LCA, and the join slot, in the bar's order. */
  readonly utilities: readonly NavId[]
  /** Today's role rows until the volunteer rail is on, then the Admin row the person holds. */
  readonly roles: readonly NavId[]
  /** LCA on Facebook, Contact and Website help. */
  readonly links: readonly NavId[]
  /** The theme switch, and Hide event bar while event mode is on. */
  readonly controls: readonly NavId[]
}

/** What the sheet needs to know. */
export interface SheetInput extends NavAccount {
  readonly pathname: string
  /** The person signed in, for the role rows; null when signed out. */
  readonly person?: MyLcaPerson | null
  /** True while the person's event strip is showing. */
  readonly eventMode?: boolean
}

const live = (ids: readonly NavId[], features: Features) => ids.filter((id) => isLive(id, features))

/** The rows each section holds in the sheet, before the live check. */
const SHEET_ROWS: { readonly [S in SectionId]: readonly SheetRow[] } = {
  tournaments: [
    { entry: 'tournaments', all: true },
    { entry: 'scanner', all: false },
    { entry: 'thisWeekend', all: false },
    { entry: 'results', all: false },
  ],
  clubs: [
    { entry: 'clubs', all: true },
    { entry: 'clubMap', all: false },
    { entry: 'listClub', all: false },
    { entry: 'suggestClub', all: false },
  ],
  scholastic: [],
  news: [],
  membership: [],
  about: ABOUT_ROWS.map((entry) => ({ entry, all: false })),
}

/** The words of a sheet row: the entry's label, or "All" and the section's label for the section's own page. */
export function sheetRowLabel(row: SheetRow): string {
  const label = navLabel(row.entry)
  return row.all ? `All ${label.toLowerCase()}` : label
}

/**
 * The Menu sheet: the six sections with the current one open; Donate, Log in
 * or My LCA, and the join slot, in the bar's order; the role rows; LCA on
 * Facebook, Contact and Website help; the theme switch; and Hide event bar
 * while event mode is on.
 */
export function navSheet(input: SheetInput, features: Features = FEATURES): NavSheet {
  const current = sectionFor(input.pathname)
  const person = input.signedIn ? (input.person ?? null) : null
  const admin = person ? adminRowFor(person.role) : null
  const roles = person ? myLcaRows(person, features).filter((row) => row.roleRow || row.id === admin).map((row) => row.id) : []
  return {
    sections: SECTIONS.map((section) => ({
      section,
      current: section === current,
      note: SECTION_NOTES[section] ?? null,
      rows: SHEET_ROWS[section].filter((row) => isLive(row.entry, features)),
    })),
    utilities: live(headerUtilities(input), features),
    roles,
    links: live(['facebook', 'contact', 'websiteHelp'], features),
    controls: live(['appearance', ...(input.eventMode ? (['hideEventBar'] as const) : [])], features),
  }
}

// The footer

/** One column of the footer. */
export interface FooterColumn {
  readonly title: string
  readonly links: readonly NavId[]
}

const FOOTER_COLUMNS: readonly FooterColumn[] = [
  { title: 'Play', links: ['tournaments', 'scholastic', 'stateChampions', 'scanner', 'calendar', 'results'] },
  { title: 'Community', links: ['clubs', 'clubMap', 'listClub', 'suggestClub', 'news', 'facebook'] },
  { title: 'About LCA', links: ['aboutLca', 'boardRegions', 'bylawsRules', 'minutes', 'annualMeeting'] },
  { title: 'Contact', links: ['email', 'contact', 'membershipHelp', 'websiteHelp', 'donate'] },
]

/** The footer's four columns, each link an entry by id, with the links that are not live yet left out. */
export function footerColumns(features: Features = FEATURES): FooterColumn[] {
  return FOOTER_COLUMNS.map((column) => ({ title: column.title, links: live(column.links, features) }))
}

/** The buttons beside the footer's logo. */
export const FOOTER_BRAND_ACTIONS = ['joinLca', 'donate'] as const satisfies readonly NavId[]

/** The two links of the footer's trust line. */
export const TRUST_LINE_LINKS = ['bylawsRules', 'minutes'] as const satisfies readonly NavId[]

// Pages without the tab bar

/**
 * The pages that hide the phone's tab bar, as today's site has them.
 * Registration, checkout, the hall TV and scanner capture join with the
 * parts that build them.
 */
export const HIDE_TAB_BAR_ROUTES = ['/tournaments/:id/print', '/membership/success', '/donate/success'] as const

/** True when a route pattern matches a path, each ":name" standing for one part of the path. */
export function routeMatches(pattern: string, pathname: string): boolean {
  const trim = (path: string) => (path.length > 1 ? path.replace(/\/+$/, '') : path)
  const want = trim(pattern).split('/')
  const got = trim(pathname).split('/')
  return want.length === got.length && want.every((part, i) => (part.startsWith(':') ? got[i] !== '' : part === got[i]))
}

/** True when a path hides the phone's tab bar. */
export function hidesTabBar(pathname: string): boolean {
  return HIDE_TAB_BAR_ROUTES.some((pattern) => routeMatches(pattern, pathname))
}

// Search

/** The pages search matches on the device: every live entry that is a page anyone can open. */
export function searchPages(features: Features = FEATURES): NavId[] {
  return NAV_IDS.filter((id) => ENTRIES[id].kind === 'page' && isLive(id, features))
}

/**
 * Words parents use, each pointing at the entry it means. Lower case; the
 * search matches them as whole words. The first tournament page is part of
 * the Scholastic page, so its words point there.
 */
export const SEARCH_SYNONYMS = {
  kids: 'scholastic',
  youth: 'scholastic',
  school: 'scholastic',
  'first tournament': 'scholastic',
  bylaws: 'bylawsRules',
  rules: 'bylawsRules',
  minutes: 'minutes',
  board: 'boardRegions',
  officers: 'boardRegions',
  regions: 'boardRegions',
  join: 'membership',
  renew: 'membership',
  donate: 'donate',
  scoresheet: 'scanner',
  scanner: 'scanner',
  support: 'websiteHelp',
  help: 'websiteHelp',
} as const satisfies Record<string, NavId>

/** Other names for the club regions, each pointing at its region. Lower case. */
export const REGION_ALIASES = {
  nola: 'New Orleans Metro',
  northshore: 'North of Lake Pontchartrain',
  acadiana: 'South Central Louisiana',
} as const satisfies Record<string, Region>
