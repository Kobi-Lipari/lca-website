// @vitest-environment jsdom
//
// The Menu sheet, src/components/layout/MobileMenu.tsx (WS02 step 6), drawn
// open under a router and a sign-in context, with the switches it reads set
// through a mocked FEATURES:
//
// - its rows, in order, for each of the twelve people of
//   test/unit/fixtures/navPersonas.ts (what each holds and their member's
//   status), every label from src/lib/nav.ts: with the a11y-on build's
//   switches, with newTournaments, newNews and newClubs on (This weekend,
//   Results and Suggest a club drawn then, and only then), and with
//   myLcaRail on (the Admin row alone among the role rows), equal to
//   navSheet's for the same person each time; a signed-in person's last
//   account row is Log out, which signs them out and goes home;
// - the section the page is in, open each time the sheet opens, on its
//   tint with "You are here" beside it, hidden from screen readers, and
//   aria-current="page" on exactly the link of the page; no section current
//   on the home page or on /dashboard;
// - each disclosure's aria-expanded and aria-controls;
// - a dialog named Menu with no description and no warning about one;
//   "Close menu" first in it and focused when it opens; Esc, the close
//   control and the scrim each closing it, the bar told and the focus handed
//   to the button that opened it, both moves of the focus made without
//   scrolling the page; a row followed closing it;
// - the button row: Donate asking the bar for its donation dialog with
//   newMembership off, and a link to /give with it on; Log in handing /login
//   the page; Join LCA or Renew the gold Button;
// - LCA on Facebook in a new tab, with noopener noreferrer;
// - the theme switch: the footer's control drawn again with a label id of
//   its own, the footer's still appearance-label with both drawn, and a pick
//   in one shown in the other;
// - the rows inside the ScrollPanel region, the region's ring drawn inside
//   it (WS02 step 7), the two shapes' classes, and data-ring-ground="light".
//
// The focus trap and the scroll are the browser's to prove
// (test/a11y/nav.spec.ts); the bars that open the sheet are
// test/unit/mobile-app-bar.test.tsx and test/unit/tablet-header.test.tsx.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { useRef, useState } from 'react'
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { JoinSlot, NavSheet } from '@/lib/nav'
import { PERSONA_KEYS, navPersona, navPersonas, type NavPersona } from './fixtures/navPersonas'
import { parseRules, read } from './helpers/cssTokens'

/** The switches the sheet reads; each test starts from the a11y-on build's (test/a11y/global-setup.ts). */
const A11Y_ON = {
  newLook: true,
  themeHeritage: true,
  newNav: true,
  siteSearch: true,
  eventStrip: true,
  eventStripLive: true,
  liveMarker: true,
  newTournaments: false,
  newNews: false,
  newClubs: false,
  newAbout: false,
  newMembership: false,
  myLcaRail: false,
}
const flags = vi.hoisted(() => ({
  newLook: true,
  themeHeritage: true,
  newNav: true,
  siteSearch: true,
  eventStrip: true,
  eventStripLive: true,
  liveMarker: true,
  newTournaments: false,
  newNews: false,
  newClubs: false,
  newAbout: false,
  newMembership: false,
  myLcaRail: false,
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { MobileMenu } = await import('@/components/layout/MobileMenu')
const { Footer } = await import('@/components/layout/Footer')
const { FEATURES } = await import('@/lib/features')
const { FACEBOOK_URL, navLabel, navSheet, sheetRowLabel } = await import('@/lib/nav')

/** The sign-in context for one of the twelve people, as the site's own context holds them. */
function authOf(person: NavPersona, more: Partial<AuthContextValue> = {}): AuthContextValue {
  const answers = person.answers
  return {
    user: person.user ? ({ id: person.user.id, email: person.user.email } as User) : null,
    session: null,
    member: answers?.me.member ?? null,
    role: person.holds?.role ?? 'member',
    seats: answers?.mySeats.seats ?? [],
    managedClubs: answers?.mySeats.managedClubs ?? [],
    isBoardMember: person.holds?.isBoardMember ?? false,
    assuranceLevel: person.aal,
    mfaRequired: false,
    directedTournaments: answers?.me.directedTournaments ?? [],
    directedTournamentIds: (answers?.me.directedTournaments ?? []).map((t) => t.id),
    loading: false,
    memberLoading: false,
    signOut: async () => {},
    ...more,
  } as unknown as AuthContextValue
}

/** The Join slot a person's member status gives: Renew once expired, Join LCA with no membership, nothing otherwise. */
function slotOf(person: NavPersona): JoinSlot {
  const status = person.answers?.me.member.membership_status
  return status === 'expired' ? 'renew' : status === 'none' ? 'joinLca' : null
}

/** navSheet's sheet for a person on a page, with the switches as they stand. */
function modelFor(person: NavPersona, pathname: string): NavSheet {
  const signedIn = person.user !== null
  return navSheet(
    { pathname, signedIn, joinSlot: signedIn ? slotOf(person) : undefined, person: person.holds ? { ...person.holds, hasChildren: false } : null },
    FEATURES,
  )
}

/** The sheet's rows as navSheet gives them, every section open: each label from src/lib/nav.ts. */
function modelRows(sheet: NavSheet): string[] {
  return [
    ...sheet.sections.flatMap((section) => [navLabel(section.section), ...section.rows.map(sheetRowLabel)]),
    ...sheet.utilities.map(navLabel),
    ...sheet.roles.map(navLabel),
    ...sheet.logOut.map(navLabel),
    ...sheet.links.map(navLabel),
    ...sheet.controls.map(navLabel),
  ]
}

/** Writes out where the page is and the page it was handed, as /login reads it. */
function Where() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  return <output data-testid="where">{`${location.pathname}${location.search}${location.hash} from ${from ?? 'nothing'}`}</output>
}

interface HarnessProps {
  shape: 'full' | 'drawer'
  onOpenChange: (open: boolean) => void
  onDonate: () => void
  withFooter: boolean
}

/** A bar's part: the button that opens the sheet, and the sheet, open to start with. */
function Harness({ shape, onOpenChange, onDonate, withFooter }: HarnessProps) {
  const [open, setOpen] = useState(true)
  const opener = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={opener} type="button" onClick={() => setOpen(true)}>
        Open the sheet
      </button>
      <MobileMenu
        open={open}
        onOpenChange={(next) => {
          onOpenChange(next)
          setOpen(next)
        }}
        shape={shape}
        id="fx-menu-sheet"
        returnFocus={() => opener.current}
        onDonate={onDonate}
      />
      {withFooter && <Footer />}
    </>
  )
}

interface Drawn {
  onOpenChange: ReturnType<typeof vi.fn<(open: boolean) => void>>
  onDonate: ReturnType<typeof vi.fn<() => void>>
}

function draw(path: InitialEntry = '/', auth: AuthContextValue = authOf(navPersona('signed-out')), options: Partial<Pick<HarnessProps, 'shape' | 'withFooter'>> = {}): Drawn {
  const onOpenChange = vi.fn<(open: boolean) => void>()
  const onDonate = vi.fn<() => void>()
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Harness shape={options.shape ?? 'full'} onOpenChange={onOpenChange} onDonate={onDonate} withFooter={options.withFooter ?? false} />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return { onOpenChange, onDonate }
}

const sheet = () => screen.getByRole('dialog', { name: 'Menu' })
const inSheet = () => within(sheet())
const where = () => screen.getByTestId('where').textContent
const opener = () => screen.getByRole('button', { name: 'Open the sheet', hidden: true })
/** The sections' list items, top to bottom. */
const sectionItems = () => [...sheet().querySelectorAll<HTMLElement>('[data-slot="menu-sheet-sections"] > li')]
/** A section's own row: its disclosure button, or its link. */
const headOf = (item: Element) => item.querySelector<HTMLElement>(':scope > button, :scope > a')!
/** A section's name, without its note. */
const nameOf = (item: Element) => headOf(item).querySelector('span > span')!.textContent

/** Opens every section that is closed, so every row is drawn. */
function openEverySection() {
  for (const item of sectionItems()) {
    const head = headOf(item)
    if (head.getAttribute('aria-expanded') === 'false') fireEvent.click(head)
  }
}

/** The sheet's rows as drawn, top to bottom: each section and its rows, the buttons, the account group, the links and the theme switch. */
function drawnRows(): string[] {
  const out: string[] = []
  for (const item of sectionItems()) {
    out.push(nameOf(item) ?? '')
    for (const link of item.querySelectorAll(':scope > ul a')) out.push(link.textContent ?? '')
  }
  const text = (selector: string) => [...sheet().querySelectorAll(selector)].map((el) => el.textContent ?? '')
  out.push(...text('[data-slot="menu-sheet-buttons"] > a, [data-slot="menu-sheet-buttons"] > button'))
  out.push(...text('[data-slot="menu-sheet-account"] a, [data-slot="menu-sheet-account"] button'))
  out.push(...text('[data-slot="menu-sheet-links"] a'))
  if (inSheet().queryByRole('group', { name: 'Appearance' })) out.push('Appearance')
  return out
}

const html = document.documentElement

beforeEach(() => {
  Object.assign(flags, A11Y_ON)
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  html.classList.remove('dark')
  window.localStorage.clear()
})

// ── The rows ───────────────────────────────────────────────────────────────

describe('the rows, for each of the twelve people', () => {
  const MIXES = [
    ['the a11y-on build\'s switches', {}],
    ['newTournaments, newNews and newClubs on', { newTournaments: true, newNews: true, newClubs: true }],
    ['myLcaRail on', { myLcaRail: true }],
  ] as const

  it.each(PERSONA_KEYS)('%s: the rows navSheet gives, in its order, with each mix of switches', (key) => {
    const person = navPersona(key)
    for (const [mix, switches] of MIXES) {
      Object.assign(flags, A11Y_ON, switches)
      draw('/', authOf(person))
      openEverySection()
      const drawn = drawnRows()
      const model = modelFor(person, '/')
      expect(drawn, `${person.title}, ${mix}`).toEqual(modelRows(model))
      // This weekend, Results and Suggest a club wait for their switches.
      const waiting = ['This weekend', 'Results', 'Suggest a club']
      expect(drawn.filter((row) => waiting.includes(row)), `${person.title}, ${mix}`).toEqual(mix === 'newTournaments, newNews and newClubs on' ? waiting : [])
      cleanup()
    }
  })

  it('gives a signed-out visitor Donate, Log in and Join LCA, and no account rows', () => {
    draw('/')
    expect(drawnRows().slice(-7)).toEqual(['Donate', 'Log in', 'Join LCA', 'LCA on Facebook ↗', 'Contact', 'Website help', 'Appearance'])
    expect(sheet().querySelector('[data-slot="menu-sheet-account"]')).toBeNull()
    expect(inSheet().queryByRole('button', { name: 'Log out' })).toBeNull()
  })

  it.each([
    ['active-member', ['Donate', 'My LCA'], []],
    ['renews-soon', ['Donate', 'My LCA'], []],
    ['expired-member', ['Donate', 'My LCA', 'Renew'], []],
    ['director', ['Donate', 'My LCA'], ['Workspace']],
    ['regional-rep', ['Donate', 'My LCA'], ['Board inbox', 'My region’s clubs']],
    ['officer', ['Donate', 'My LCA'], ['Board inbox', 'Admin (view only)']],
    ['admin', ['Donate', 'My LCA'], ['Board inbox', 'Admin']],
  ] as const)('gives %s the buttons %j and the account rows %j, then Log out', (key, buttons, roles) => {
    draw('/', authOf(navPersona(key)))
    const text = (selector: string) => [...sheet().querySelectorAll(selector)].map((el) => el.textContent)
    expect(text('[data-slot="menu-sheet-buttons"] > *')).toEqual([...buttons])
    expect(text('[data-slot="menu-sheet-account"] li > *')).toEqual([...roles, 'Log out'])
  })

  it('with myLcaRail on, keeps the Admin row alone among the role rows, before Log out', () => {
    flags.myLcaRail = true
    const rows = (key: (typeof PERSONA_KEYS)[number]) => {
      draw('/', authOf(navPersona(key)))
      const out = [...sheet().querySelectorAll('[data-slot="menu-sheet-account"] li > *')].map((el) => el.textContent)
      cleanup()
      return out
    }
    expect(rows('admin')).toEqual(['Admin', 'Log out'])
    expect(rows('officer')).toEqual(['Admin (view only)', 'Log out'])
    expect(rows('regional-rep')).toEqual(['Log out'])
    expect(rows('director')).toEqual(['Log out'])
  })

  it('draws Join LCA and Renew as the gold Button, Donate as the secondary and Log in and My LCA as the outline', () => {
    const variants = (key: (typeof PERSONA_KEYS)[number]) => {
      draw('/', authOf(navPersona(key)))
      const out = [...sheet().querySelectorAll('[data-slot="menu-sheet-buttons"] > *')].map((el) => `${el.textContent} ${el.getAttribute('data-variant')}`)
      cleanup()
      return out
    }
    expect(variants('signed-out')).toEqual(['Donate secondary', 'Log in outline', 'Join LCA gold'])
    expect(variants('expired-member')).toEqual(['Donate secondary', 'My LCA outline', 'Renew gold'])
    draw('/', authOf(navPersona('expired-member')))
    expect(inSheet().getByRole('link', { name: 'Renew' }).getAttribute('href')).toBe('/membership')
    expect(inSheet().getByRole('link', { name: 'My LCA' }).getAttribute('href')).toBe('/dashboard')
  })

  it('names every person of the list, and each person in the list once', () => {
    expect(navPersonas().map((p) => p.key)).toEqual([...PERSONA_KEYS])
  })
})

describe('Log out', () => {
  it('signs the person out as the My LCA menu does, closes the sheet and goes to the home page', async () => {
    const signOut = vi.fn(async () => {})
    const { onOpenChange } = draw('/clubs', authOf(navPersona('director'), { signOut }))
    const logOut = inSheet().getByRole('button', { name: 'Log out' })
    // The account group's last row.
    expect(logOut.closest('li')!.nextElementSibling).toBeNull()
    fireEvent.click(logOut)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(where()).toBe('/ from nothing'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

// ── The current section ────────────────────────────────────────────────────

describe('the section the page is in', () => {
  it.each([
    ['/tournaments', 'Tournaments', 'All tournaments'],
    ['/scanner', 'Tournaments', 'Scoresheet scanner'],
    ['/clubs', 'Clubs', 'All clubs'],
    ['/scholastic', 'Scholastic', 'ScholasticKids and school chess'],
    ['/news', 'News', 'News'],
    ['/membership', 'Membership', 'Membership'],
    ['/about', 'About', 'About LCA'],
    ['/governance/minutes', 'About', 'Minutes'],
    ['/champions', 'About', 'State champions'],
    ['/contact', 'About', 'Contact'],
    ['/', null, null],
    ['/dashboard', null, null],
  ] as const)('at %s is %s, open, on its tint with "You are here", and aria-current is on %s alone', (path, current, page) => {
    draw(path)
    const items = sectionItems()
    const tinted = items.filter((item) => item.className.split(/\s+/).includes('bg-[#fbfaf6]'))
    expect(tinted.map(nameOf)).toEqual(current ? [current] : [])
    const here = [...sheet().querySelectorAll('span')].filter((span) => span.textContent === 'You are here')
    expect(here).toHaveLength(current ? 1 : 0)
    if (current) {
      const [item] = tinted
      expect(item.className.split(/\s+/)).toEqual(expect.arrayContaining(['bg-[#fbfaf6]', 'dark:bg-muted']))
      // Beside the section's name, hidden from screen readers: the name alone is heard.
      expect(here[0].parentElement).toBe(item)
      expect(here[0].getAttribute('aria-hidden')).toBe('true')
      expect(here[0].className.split(/\s+/)).toEqual(expect.arrayContaining(['text-[13px]', 'font-semibold', 'text-[#866a1e]', 'dark:text-ink']))
      const head = headOf(item)
      if (head.tagName === 'BUTTON') {
        expect(head.getAttribute('aria-expanded')).toBe('true')
        expect(document.getElementById(head.getAttribute('aria-controls')!)).toBe(item.querySelector(':scope > ul'))
      }
    }
    // Every other section is closed.
    for (const item of items.filter((i) => nameOf(i) !== current)) {
      const head = headOf(item)
      if (head.tagName === 'BUTTON') expect(head.getAttribute('aria-expanded'), nameOf(item) ?? '').toBe('false')
      expect(item.className.split(/\s+/)).not.toContain('bg-[#fbfaf6]')
    }
    const marked = [...sheet().querySelectorAll('[aria-current]')]
    expect(marked.map((el) => `${el.textContent} ${el.getAttribute('aria-current')}`)).toEqual(page ? [`${page} page`] : [])
  })

  it.each([
    ['/donate/success', {}, 'Membership', 'A'],
    ['/donate', {}, 'Membership', 'A'],
    ['/governance/board', { newAbout: true }, 'About', 'BUTTON'],
    ['/governance/minutes/2026-03', { newAbout: true }, 'About', 'BUTTON'],
    ['/champions', { newNews: true }, 'About', 'BUTTON'],
  ] as const)('at %s with %j, a page %s owns that none of its links is, gives the section\'s own control aria-current="true" and marks nothing else (WS02 step 7)', (path, switches, current, tag) => {
    Object.assign(flags, switches)
    draw(path)
    const item = sectionItems().find((i) => nameOf(i) === current)!
    expect(item.className.split(/\s+/)).toContain('bg-[#fbfaf6]')
    const marked = [...sheet().querySelectorAll('[aria-current]')]
    expect(marked).toEqual([headOf(item)])
    expect([marked[0].tagName, marked[0].getAttribute('aria-current')]).toEqual([tag, 'true'])
    // Its name is as before: the cue is the state, not more words.
    expect(nameOf(item)).toBe(current)
  })

  it.each([
    ['/membership', 'Membership', 'Membership page'],
    ['/governance/board', 'About', 'Board & regions page'],
    ['/about', 'About', 'About LCA page'],
  ] as const)('at %s, a page a link of %s is, marks that link alone with aria-current="page", and the section\'s own control with none (WS02 step 7)', (path, current, mark) => {
    draw(path)
    const item = sectionItems().find((i) => nameOf(i) === current)!
    const marked = [...sheet().querySelectorAll('[aria-current]')]
    expect(marked.map((el) => `${(el.textContent ?? '').trim()} ${el.getAttribute('aria-current')}`)).toEqual([mark])
    if (headOf(item).tagName === 'BUTTON') expect(headOf(item).hasAttribute('aria-current')).toBe(false)
  })

  it('opens each time on the section the page is in, whatever was left open the time before', async () => {
    const { onOpenChange } = draw('/tournaments')
    const head = (name: string) => headOf(sectionItems().find((item) => nameOf(item) === name)!)
    fireEvent.click(head('Tournaments'))
    fireEvent.click(head('Clubs'))
    expect(head('Tournaments').getAttribute('aria-expanded')).toBe('false')
    expect(head('Clubs').getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(inSheet().getByRole('button', { name: 'Close menu' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    fireEvent.click(opener())
    await screen.findByRole('dialog', { name: 'Menu' })
    expect(head('Tournaments').getAttribute('aria-expanded')).toBe('true')
    expect(head('Clubs').getAttribute('aria-expanded')).toBe('false')
  })
})

describe('the disclosures', () => {
  it('show and hide their rows: aria-expanded says which, and aria-controls names the list while it is shown', () => {
    draw('/')
    const disclosures = sectionItems().filter((item) => headOf(item).tagName === 'BUTTON')
    expect(disclosures.map(nameOf)).toEqual(['Tournaments', 'Clubs', 'About'])
    for (const item of disclosures) {
      const head = headOf(item)
      expect(head.getAttribute('aria-expanded')).toBe('false')
      expect(head.hasAttribute('aria-controls')).toBe(false)
      expect(item.querySelector(':scope > ul')).toBeNull()
      fireEvent.click(head)
      expect(head.getAttribute('aria-expanded')).toBe('true')
      const list = document.getElementById(head.getAttribute('aria-controls')!)
      expect(list).toBe(item.querySelector(':scope > ul'))
      expect(list!.querySelectorAll('a').length).toBeGreaterThan(0)
      fireEvent.click(head)
      expect(head.getAttribute('aria-expanded')).toBe('false')
      expect(head.hasAttribute('aria-controls')).toBe(false)
      expect(item.querySelector(':scope > ul')).toBeNull()
    }
    // The other three are links to their pages.
    const links = sectionItems().filter((item) => headOf(item).tagName === 'A')
    expect(links.map((item) => [nameOf(item), headOf(item).getAttribute('href')])).toEqual([
      ['Scholastic', '/scholastic'],
      ['News', '/news'],
      ['Membership', '/membership'],
    ])
  })

  it('gives each list an id of its own', () => {
    draw('/')
    openEverySection()
    const ids = sectionItems()
      .map((item) => item.querySelector(':scope > ul')?.id)
      .filter((id): id is string => !!id)
    expect(ids).toHaveLength(3)
    expect(new Set(ids).size).toBe(3)
  })
})

// ── The dialog ─────────────────────────────────────────────────────────────

describe('the dialog', () => {
  it('is a modal dialog named Menu, with no description and no warning about one', () => {
    const warned = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errored = vi.spyOn(console, 'error').mockImplementation(() => {})
    draw('/')
    // Modal: the page behind it is hidden from screen readers while it is open.
    expect(opener().closest('[aria-hidden="true"]')).not.toBeNull()
    expect(sheet().closest('[aria-hidden="true"]')).toBeNull()
    expect(sheet().hasAttribute('aria-describedby')).toBe(false)
    const said = [...warned.mock.calls, ...errored.mock.calls].map((call) => call.map(String).join(' '))
    expect(said.filter((line) => /Description|DialogTitle|aria-describedby/.test(line))).toEqual([])
    // The title is the word Menu, as the button that opens it says.
    expect(sheet().getAttribute('aria-labelledby')).toBeTruthy()
    expect(document.getElementById(sheet().getAttribute('aria-labelledby')!)!.textContent).toBe('Menu')
  })

  it('has "Close menu" first, which shows the word Close, and puts the focus on it as it opens', async () => {
    draw('/clubs')
    const close = inSheet().getByRole('button', { name: 'Close menu' })
    expect(close.textContent).toBe('Close')
    const controls = [...sheet().querySelectorAll('a[href], button, [tabindex="0"]')]
    expect(controls[0]).toBe(close)
    await waitFor(() => expect(document.activeElement).toBe(close))
  })

  it('moves the focus onto its close control as it opens, and back to the opener as it closes, each time without scrolling the page', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    /** The options of every move of the focus onto an element. */
    const onto = (el: Element) => focus.mock.contexts.flatMap((self, i) => (self === el ? [focus.mock.calls[i][0]] : []))
    draw('/news')
    const close = inSheet().getByRole('button', { name: 'Close menu' })
    await waitFor(() => expect(document.activeElement).toBe(close))
    expect(onto(close).length).toBeGreaterThan(0)
    for (const options of onto(close)) expect(options).toEqual({ preventScroll: true })
    fireEvent.keyDown(sheet(), { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(opener()))
    expect(onto(opener()).length).toBeGreaterThan(0)
    for (const options of onto(opener())) expect(options).toEqual({ preventScroll: true })
  })

  it.each([
    ['Esc', () => fireEvent.keyDown(sheet(), { key: 'Escape' })],
    ['the close control', () => fireEvent.click(inSheet().getByRole('button', { name: 'Close menu' }))],
  ])('closes on %s, tells the bar and hands the focus to the button that opened it', async (_, closeIt) => {
    const { onOpenChange } = draw('/news')
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    closeIt()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(document.activeElement).toBe(opener()))
  })

  it('closes on a press on the scrim, tells the bar and hands the focus to the button that opened it', async () => {
    const { onOpenChange } = draw('/news', undefined, { shape: 'drawer' })
    const scrim = document.querySelector('[data-slot="menu-sheet-scrim"]')!
    expect(scrim).not.toBeNull()
    expect(scrim.contains(sheet())).toBe(false)
    // The primitive listens for a press outside once the sheet has opened,
    // and closes on the click that ends a press on the scrim.
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    await new Promise((settled) => setTimeout(settled, 0))
    fireEvent.pointerDown(scrim)
    fireEvent.click(scrim)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(document.activeElement).toBe(opener()))
  })

  it('closes when a row is followed, and the row\'s page opens', async () => {
    const { onOpenChange } = draw('/')
    fireEvent.click(headOf(sectionItems()[0]))
    fireEvent.click(inSheet().getByRole('link', { name: 'Scoresheet scanner' }))
    expect(where()).toBe('/scanner from nothing')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('holds every row inside the ScrollPanel region, and the close control and the title above it', () => {
    draw('/', authOf(navPersona('admin')))
    openEverySection()
    const region = inSheet().getByRole('region', { name: 'Sections and links' })
    expect(region.getAttribute('data-slot')).toBe('scroll-panel')
    expect(region.getAttribute('tabindex')).toBe('0')
    const controls = [...sheet().querySelectorAll('a, button')]
    const outside = controls.filter((el) => !region.contains(el))
    expect(outside).toEqual([inSheet().getByRole('button', { name: 'Close menu' })])
    expect(controls.length).toBeGreaterThan(20)
  })

  it('draws its list region\'s ring inside the region under the new look, by the one rule that sets an offset of -3px, which reaches the region in the sheet (WS02 step 7)', () => {
    // The region fills the sheet from edge to edge, so a ring drawn outside it would be cut by the sheet.
    const rules = parseRules(read('src/index.css')).filter((r) => r.decls.get('outline-offset') === '-3px')
    expect(rules.map((r) => r.selectors)).toEqual([[':root[data-look="new"] [data-slot="menu-sheet"] [data-slot="scroll-panel"]:focus-visible']])
    draw('/')
    const region = inSheet().getByRole('region', { name: 'Sections and links' })
    // A line 2 pixels wide set 3 pixels inside the box lies wholly inside it.
    expect(region.matches('[data-slot="menu-sheet"] [data-slot="scroll-panel"]')).toBe(true)
  })

  it.each([
    ['full', ['inset-x-0', 'top-0', 'bottom-[var(--bottom-chrome-h,0px)]', 'pt-[env(safe-area-inset-top)]', 'pr-[env(safe-area-inset-right)]', 'pl-[env(safe-area-inset-left)]'], ['inset-0', 'w-[400px]', 'right-0', 'border-l']],
    ['drawer', ['inset-y-0', 'right-0', 'w-[400px]', 'max-w-full', 'border-l', 'border-hairline', 'pr-[env(safe-area-inset-right)]'], ['inset-0', 'bottom-[var(--bottom-chrome-h,0px)]']],
  ] as const)('takes the %s shape\'s classes, as a light surface with the look\'s own ring', (shape, has, hasNot) => {
    draw('/', undefined, { shape })
    const classes = sheet().className.split(/\s+/)
    expect(sheet().getAttribute('data-shape')).toBe(shape)
    expect(classes).toEqual(expect.arrayContaining(['fixed', 'z-50', 'flex', 'flex-col', 'bg-raised', 'text-ink', ...has]))
    for (const c of hasNot) expect(classes, c).not.toContain(c)
    expect(sheet().getAttribute('data-ring-ground')).toBe('light')
    expect(sheet().getAttribute('data-slot')).toBe('menu-sheet')
    expect(sheet().id).toBe('fx-menu-sheet')
  })
})

// ── The buttons and the links ──────────────────────────────────────────────

describe('Donate', () => {
  it('with newMembership off, closes the sheet and asks the bar for its donation dialog, leaving the focus where that dialog puts it', async () => {
    const { onOpenChange, onDonate } = draw('/news')
    // The bar's dialog, drawn once the sheet has closed, takes the focus, as
    // the donation dialog moves it to its first control when it opens.
    const dialogsFirst = document.body.appendChild(document.createElement('button'))
    dialogsFirst.textContent = 'The donation form'
    onDonate.mockImplementation(() => void setTimeout(() => dialogsFirst.focus(), 0))
    const donate = inSheet().getByRole('button', { name: 'Donate' })
    expect(donate.getAttribute('data-variant')).toBe('secondary')
    fireEvent.click(donate)
    expect(onDonate).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await new Promise((settled) => setTimeout(settled, 10))
    expect(document.activeElement).toBe(dialogsFirst)
    expect(where()).toBe('/news from nothing')
    dialogsFirst.remove()
  })

  it('with newMembership off, gives the focus back to the button that opened the sheet while no dialog holds it, as before the dialog\'s code arrives or when it cannot be had', async () => {
    const { onDonate } = draw('/news')
    await waitFor(() => expect(document.activeElement).toBe(inSheet().getByRole('button', { name: 'Close menu' })))
    const donate = inSheet().getByRole('button', { name: 'Donate' })
    donate.focus()
    fireEvent.click(donate)
    expect(onDonate).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The Donate pressed went with the sheet; the focus is not left on the page's body.
    await waitFor(() => expect(document.activeElement).toBe(opener()))
  })

  it('with newMembership on, is a link to /give that closes the sheet and asks for no dialog', async () => {
    flags.newMembership = true
    const { onOpenChange, onDonate } = draw('/news')
    expect(inSheet().queryByRole('button', { name: 'Donate' })).toBeNull()
    const give = inSheet().getByRole('link', { name: 'Donate' })
    expect(give.getAttribute('href')).toBe('/give')
    fireEvent.click(give)
    expect(where()).toBe('/give from nothing')
    expect(onDonate).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('Log in', () => {
  it('hands /login the page the sheet was opened on, its query and its hash included', () => {
    draw('/tournaments?when=weekend#list')
    fireEvent.click(inSheet().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /tournaments?when=weekend#list')
  })

  it.each(['/login', '/forgot-password', '/reset-password'])('on %s hands on the page that page was handed, or nothing, never the page itself', (pathname) => {
    draw({ pathname, state: { from: '/clubs?region=north' } })
    fireEvent.click(inSheet().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from /clubs?region=north')
    cleanup()
    draw(pathname)
    fireEvent.click(inSheet().getByRole('link', { name: 'Log in' }))
    expect(where()).toBe('/login from nothing')
  })
})

describe('the links', () => {
  it('opens LCA on Facebook in a new tab, with noopener noreferrer, and Contact and Website help on the site', () => {
    draw('/')
    const facebook = inSheet().getByRole('link', { name: 'LCA on Facebook ↗' })
    expect(facebook.getAttribute('href')).toBe(FACEBOOK_URL)
    expect(facebook.getAttribute('target')).toBe('_blank')
    expect(facebook.getAttribute('rel')).toBe('noopener noreferrer')
    const links = within(sheet().querySelector<HTMLElement>('[data-slot="menu-sheet-links"]')!)
    expect(links.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('/contact')
    expect(links.getByRole('link', { name: 'Website help' }).getAttribute('href')).toBe('/support')
    expect(links.getByRole('link', { name: 'Contact' }).hasAttribute('target')).toBe(false)
  })
})

// ── The theme switch ───────────────────────────────────────────────────────

describe('the theme switch in the sheet', () => {
  it('is the footer\'s control drawn again with a label id of its own, the footer\'s still appearance-label, no id twice on the page, and a pick in one shown in the other', () => {
    draw('/', undefined, { withFooter: true })
    // While the sheet is open, the page behind it is hidden from screen readers: one group named Appearance is found.
    const own = inSheet().getByRole('group', { name: 'Appearance' })
    expect(screen.getAllByRole('group', { name: 'Appearance' })).toEqual([own])
    const both = screen.getAllByRole('group', { name: 'Appearance', hidden: true })
    expect(both).toHaveLength(2)
    const footers = both.filter((group) => group !== own)
    expect(footers).toHaveLength(1)
    const [footer] = footers
    expect(footer.getAttribute('aria-labelledby')).toBe('appearance-label')
    const ownLabel = own.getAttribute('aria-labelledby')!
    expect(ownLabel).not.toBe('appearance-label')
    expect(document.getElementById(ownLabel)!.textContent).toBe('Appearance')
    expect(sheet().contains(document.getElementById(ownLabel))).toBe(true)
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id)
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([])
    // On the sheet's light ground: no white words or lines of the footer's navy.
    for (const el of [document.getElementById(ownLabel)!, ...within(own).getAllByRole('button')]) {
      expect(el.className, el.textContent ?? '').not.toMatch(/white/)
    }
    // A pick in the sheet shows in the footer, and back.
    fireEvent.click(within(own).getByRole('button', { name: 'Dark' }))
    expect(within(footer).getByRole('button', { name: 'Dark', hidden: true }).getAttribute('aria-pressed')).toBe('true')
    expect(html.classList.contains('dark')).toBe(true)
    fireEvent.click(within(footer).getByRole('button', { name: 'System', hidden: true }))
    expect(within(own).getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(own).getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false')
  })
})
