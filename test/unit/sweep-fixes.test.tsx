// @vitest-environment jsdom
//
// What the axe sweep of WS01 acceptance criterion 1 changed on the clubs
// page, a club's page and the tournament page (step 32), drawn with newLook
// off and on. With the switch off each draws what it drew before. Under the
// new look:
// - a club card is no longer a button holding the club's two links, which a
//   control may not hold (axe's nested-interactive): the club's name is the
//   button that shows the club on the map, pressed while the club is picked,
//   and a click anywhere else on the card still picks it;
// - words in a colour a club picked take the look's ink on a dark ground
//   (dark mode, the live look), through clubTextOnDark beside clubTextColor
//   in src/areas/clubs/clubColors.ts: the initials on /clubs, where a dark
//   club colour reads below 3:1 on its own tint, and an officer's role, a
//   news date and the contact link on a club's page, where the fixture's
//   navy blue reads 2.01:1 on the dark card, while brand gold, the colour
//   every club starts with, keeps its colour;
// - the tournament page's "See pairings / results" has white words on the
//   navy hero, where navy words on its gold tint read 1.29:1; its one column
//   below 1024 pixels may be narrower than its widest item, so a phone
//   scrolls the sections table in its own box rather than the whole page;
//   and that box is a named region in the tab order, so a keyboard can
//   scroll it.
// With the switch off and on alike, since a pressed state changes nothing
// a visitor sees, the buttons on the pages AC1 names that showed which of a
// set is picked by their look alone now say it to a screen reader, each
// with its class string as it was: with aria-pressed, the bye rounds of the
// tournament page's registration card, of a player's own entry and of the
// family panel, and on /tournaments the Upcoming and Past tabs, the List and
// Calendar views, the calendar's days, the state filter's options and the
// organizer column's rows (drawn when clubTournaments is on); with
// aria-current, the row of /tournaments whose details are shown beside the
// list, in either view, and today's date in the calendar. The state filter's
// button says whether its menu is open, with aria-expanded.
// The switches are flipped inside this one file, through getters on the
// mocked FEATURES, so both sides are drawn from the same code.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { UnifiedTournament } from '@/areas/events/clearinghouse'
import type { ApiChild, ApiClubDetail, ApiClubListItem, ApiMyRegistration, ApiTournamentDetail, ApiTournamentPairing } from '@/lib/api'

const flags = vi.hoisted(() => ({ newLook: false, clubTournaments: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
      get clubTournaments() {
        return flags.clubTournaments
      },
    },
  }
})
const api = vi.hoisted(() => ({
  getClubs: vi.fn(),
  getClub: vi.fn(),
  getTournament: vi.fn(),
  getMyChildren: vi.fn(),
  getTournamentReminderStatus: vi.fn(async () => ({ opted_in: false })),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map needs Google's script; the cards are what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubsPage } = await import('@/pages/ClubsPage')
const { ClubDetailPage } = await import('@/pages/ClubDetailPage')
const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')
const { TournamentsPage } = await import('@/pages/TournamentsPage')
const { FamilyRegistrationPanel } = await import('@/areas/households/components/FamilyRegistrationPanel')
const { clubTextOnDark } = await import('@/areas/clubs/clubColors')

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Two made-up clubs: one with a colour of its own, one that kept brand gold. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', meeting_schedule: 'Tuesdays at 7:00 PM', color: '#1f4e79', image_url: null, region: 'South Central Louisiana', latitude: 30.45, longitude: -91.19 },
  { id: 'c2', name: 'Fixture North Chess Club', city: 'Monroe', meeting_schedule: 'Fridays at 6:30 PM', color: '#c8a94a', image_url: null, region: 'North Louisiana', latitude: 32.51, longitude: -92.12 },
]
/** The classes that give a club's own colour way to the look's ink on a dark ground. */
const ON_DARK = ['dark:text-ink!', 'in-data-[theme=live]:text-ink!']

beforeAll(() => {
  // jsdom has neither; the page asks both when a card is picked.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
  api.getClub.mockReset()
  api.getTournament.mockReset()
  api.getMyChildren.mockReset()
  api.getMyChildren.mockResolvedValue([])
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  flags.newLook = false
  flags.clubTournaments = false
})

async function renderClubs() {
  const view = render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findAllByText('Fixture Capital Chess Club')
  return view
}

/** The initials standing in for a club's logo, by the club's name. */
const initialsOf = (container: HTMLElement, initials: string) =>
  [...container.querySelectorAll('span[aria-hidden="true"]')].find((el) => el.textContent === initials) as HTMLElement

describe('a club card on /clubs', () => {
  it('with newLook off is the button it always was, holding the club\'s links, and its initials are in the club\'s colour as given', async () => {
    const { container } = await renderClubs()
    const card = screen.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' })
    expect(card.tagName).toBe('DIV')
    expect(card.getAttribute('tabindex')).toBe('0')
    expect(card.getAttribute('aria-pressed')).toBe('false')
    expect(within(card).getByRole('link', { name: 'Visit club' })).toBeTruthy()
    expect(within(card).getByText('Fixture Capital Chess Club').tagName).toBe('P')
    const own = initialsOf(container, 'FC')
    expect(own.className).toBe('select-none text-2xl font-bold tracking-tight')
    expect(own.style.color).toBe('rgb(31, 78, 121)')
  })

  it('under the new look holds no link inside a button: the club\'s name is the button, pressed while the club is picked', async () => {
    flags.newLook = true
    const { container } = await renderClubs()
    expect(container.querySelectorAll('[role="button"] a, button a')).toHaveLength(0)
    const name = screen.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' })
    expect(name.tagName).toBe('BUTTON')
    expect(name.getAttribute('type')).toBe('button')
    expect(name.textContent).toBe('Fixture Capital Chess Club')
    expect(name.getAttribute('aria-pressed')).toBe('false')
    // The card around it is not a control of its own any more.
    const card = name.closest('.group') as HTMLElement
    for (const attr of ['role', 'tabindex', 'aria-pressed', 'aria-label']) expect(card.hasAttribute(attr), attr).toBe(false)
    expect(within(card).getByRole('link', { name: 'Visit club' })).toBeTruthy()
    // The name picks the club, by a click or by the keyboard's click.
    fireEvent.click(name)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' }).getAttribute('aria-pressed')).toBe('true'))
    // A click on the card's own words still picks the other club, as before.
    fireEvent.click(screen.getByText('Fridays at 6:30 PM'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show Fixture North Chess Club on the map' }).getAttribute('aria-pressed')).toBe('true'))
    expect(screen.getByRole('button', { name: 'Show Fixture Capital Chess Club on the map' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('under the new look gives a colour the club picked way to the look\'s ink on a dark ground, and leaves brand gold as it is', async () => {
    flags.newLook = true
    const { container } = await renderClubs()
    const own = initialsOf(container, 'FC')
    for (const name of ON_DARK) expect(own.classList.contains(name), name).toBe(true)
    expect(own.style.color).toBe('rgb(31, 78, 121)')
    const gold = initialsOf(container, 'FN')
    for (const name of ON_DARK) expect(gold.classList.contains(name), name).toBe(false)
    expect(gold.style.color).toBe('var(--gold-ink)')
  })
})

function tournament(): ApiTournamentDetail {
  return {
    id: 't1', name: 'Fixture Summer Championship', location: 'Baton Rouge, LA', venue: 'Fixture Community Center', date: '2026-09-22', end_date: null,
    entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    sections: [{ id: 'sec-1', name: 'Open', entryFee: 30, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: true, cap: null, fees: { early: 30, regular: 30, late: 30 } }],
    rounds: 3, max_players: null, status: 'completed', description: 'A made-up event.', registration_deadline: null, club_id: null, created_by: null,
    created_at: '2026-08-01 12:00:00', registration_status: 'closed', registration_opens_at: null, is_rated: 0, is_visible: 1, round_schedule: [],
    registration_closes_at: null, custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null,
    pairing_system: 'uscf', accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1,
    club_name: null, club_color: null, waitlist_count: 0,
  } as unknown as ApiTournamentDetail
}
const PAIRING = { id: 'g1', tournament_id: 't1', round: 1, board: 1, section: 'Open', white_member_id: 'm1', black_member_id: 'm2', result: '1-0' } as ApiTournamentPairing

async function renderTournament() {
  api.getTournament.mockResolvedValue({ tournament: tournament(), roster: [], pairings: [PAIRING], myRegistration: null })
  const value = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  const view = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments/t1']}>
        <Routes><Route path="/tournaments/:id" element={<TournamentDetailPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const link = await screen.findByRole('link', { name: /See pairings \/ results/ })
  const box = screen.getByRole('heading', { name: 'Sections' }).nextElementSibling as HTMLElement
  const grid = view.container.querySelector('section.max-w-6xl.py-10 > .grid') as HTMLElement
  return { link, box, grid }
}

describe('the tournament page of an event with published pairings', () => {
  it('with newLook off draws what it drew: navy words on the hero\'s button, a grid with no column template below 1024 pixels, and a plain table box', async () => {
    const { link, box, grid } = await renderTournament()
    expect(link.className).toContain('border-lca-gold/50 bg-lca-gold/15 text-ink hover:bg-lca-gold/25')
    expect(link.className).not.toContain('text-white')
    expect(grid.className).toBe('grid gap-8 lg:grid-cols-3')
    expect(box.className).toBe('mt-4 overflow-x-auto rounded-xl border')
    for (const attr of ['role', 'tabindex', 'aria-label']) expect(box.hasAttribute(attr), attr).toBe(false)
  })

  it('under the new look gives the button white words, lets the column shrink, and makes the table\'s box a named region in the tab order', async () => {
    flags.newLook = true
    const { link, box, grid } = await renderTournament()
    expect(link.className).toContain('text-white')
    expect(link.className).toContain('hover:text-white')
    expect(link.className).not.toMatch(/(?:^| )text-ink(?: |$)/)
    expect(grid.className).toBe('grid grid-cols-1 gap-8 lg:grid-cols-3')
    expect(box.getAttribute('role')).toBe('region')
    expect(box.getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('region', { name: 'Sections' })).toBe(box)
    expect(within(box).getByRole('table')).toBeTruthy()
  })
})

describe('the words in a club\'s colour, through clubTextOnDark beside clubTextColor', () => {
  it('with newLook off gives no classes, whatever the colour', () => {
    for (const color of ['#1f4e79', '#c8a94a', null, undefined, '']) expect(clubTextOnDark(color), String(color)).toBeUndefined()
  })

  it('under the new look gives the two classes for a colour a club picked, and none for brand gold, in any letters, or no colour', () => {
    flags.newLook = true
    for (const color of ['#1f4e79', '#2E7D32', ' #ffeb3b ']) expect(clubTextOnDark(color), color).toBe(ON_DARK.join(' '))
    for (const color of ['#c8a94a', ' #C8A94A ', null, undefined, '']) expect(clubTextOnDark(color), String(color)).toBeUndefined()
  })

  it('goes with every place a club\'s colour is words: the initials on /clubs, three on a club\'s page and the admin\'s preview', () => {
    const files = ['src/pages/ClubsPage.tsx', 'src/pages/ClubDetailPage.tsx', 'src/pages/AdminClubPage.tsx']
    const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length
    const uses = files.map((file) => {
      const text = read(file)
      return [file, count(text, /style=\{\{ color: clubTextColor\(club\.color\) \}\}|style=\{\{ color: textColor \}\}|color: clubTextColor\(color\),/g), count(text, /clubTextOnDark\((?:club\.color|color)\)/g)]
    })
    expect(uses).toEqual([
      ['src/pages/ClubsPage.tsx', 1, 1],
      ['src/pages/ClubDetailPage.tsx', 3, 3],
      ['src/pages/AdminClubPage.tsx', 1, 1],
    ])
  })
})

const CLUB: ApiClubDetail = {
  id: 'c1', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', location: 'Fixture Community Center', description: 'A made-up club.',
  meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'capital-club@example.org', created_at: '2026-01-01 12:00:00', color: '#1f4e79',
  image_url: null, region: 'South Central Louisiana', latitude: null, longitude: null,
}

/** A club's page with an officer, a news item and a contact link, all three drawn in the club's colour. */
async function renderClubPage(color: string) {
  api.getClub.mockResolvedValue({
    club: { ...CLUB, color },
    officers: [{ role: 'president', full_name: 'Avery Fixture', email: 'avery.fixture@example.org' }],
    tournaments: [],
    news: [{ id: 'n1', title: 'Fixture club news', news_date: 'Sat, Oct 24, 2026', excerpt: 'A made-up note.' }],
  })
  render(
    <MemoryRouter initialEntries={['/clubs/c1']}>
      <Routes><Route path="/clubs/:id" element={<ClubDetailPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Fixture Capital Chess Club' })
  return {
    role: screen.getByText('President'),
    date: screen.getByText('Sat, Oct 24, 2026'),
    contact: screen.getByRole('link', { name: 'capital-club@example.org' }),
  }
}

describe('a club\'s page, where an officer\'s role, a news date and the contact link are in the club\'s colour', () => {
  it('with newLook off draws each as it did: its classes as before and the club\'s colour', async () => {
    const words = await renderClubPage('#1f4e79')
    expect(words.role.className).toBe('text-sm')
    expect(words.date.className).toBe('text-xs font-medium')
    expect(words.contact.className).toBe('hover:underline')
    for (const el of Object.values(words)) expect(el.style.color).toBe('rgb(31, 78, 121)')
  })

  it('under the new look gives a colour the club picked way to the look\'s ink on a dark ground, keeping its own colour on a light one', async () => {
    flags.newLook = true
    const words = await renderClubPage('#1f4e79')
    for (const [name, el] of Object.entries(words)) {
      for (const cls of ON_DARK) expect(el.classList.contains(cls), `${name}: ${cls}`).toBe(true)
      expect(el.style.color, name).toBe('rgb(31, 78, 121)')
    }
    expect(words.role.className).toBe(`text-sm ${ON_DARK.join(' ')}`)
  })

  it('under the new look leaves a club that kept brand gold in the gold ink, with no dark classes', async () => {
    flags.newLook = true
    const words = await renderClubPage('#c8a94a')
    for (const [name, el] of Object.entries(words)) {
      for (const cls of ON_DARK) expect(el.classList.contains(cls), `${name}: ${cls}`).toBe(false)
      expect(el.style.color, name).toBe('var(--gold-ink)')
    }
  })
})

/** An event open for entries, four rounds, so three byes may be picked. */
function openTournament(): ApiTournamentDetail {
  return { ...tournament(), id: 't3', name: 'Fixture Fall Open', date: '2026-11-21', status: 'upcoming', registration_status: 'open', rounds: 4 } as ApiTournamentDetail
}

const ENTRY: ApiMyRegistration = {
  id: 'r1', tournament_id: 't3', member_id: 'm1', section: 'Open', payment_status: 'paid', bye_rounds: [2], registered_at: '2026-10-01 12:00:00',
  withdrawn_at: null, waitlisted_at: null,
}

async function renderOpenEvent(myRegistration: ApiMyRegistration | null) {
  api.getTournament.mockResolvedValue({ tournament: openTournament(), roster: [], pairings: [], myRegistration })
  const value = { user: myRegistration ? { id: 'm1' } : null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments/t3']}>
        <Routes><Route path="/tournaments/:id" element={<TournamentDetailPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Fixture Fall Open' })
}

/** Each toggle's words and pressed state, in order. */
const pressedOf = (buttons: HTMLElement[]) => buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])

describe('the bye rounds on the tournament page say which are picked, with the switch off and on', () => {
  for (const on of [false, true]) {
    it(`the registration card's toggles${on ? ' under the new look' : ''}: pressed when picked, their look as before`, async () => {
      flags.newLook = on
      await renderOpenEvent(null)
      const toggles = () => screen.getAllByRole('button', { name: /^Rd \d$/ })
      expect(pressedOf(toggles())).toEqual([['Rd 1', 'false'], ['Rd 2', 'false'], ['Rd 3', 'false'], ['Rd 4', 'false']])
      fireEvent.click(screen.getByRole('button', { name: 'Rd 2' }))
      await waitFor(() => expect(screen.getByRole('button', { name: 'Rd 2', pressed: true })).toBeTruthy())
      expect(pressedOf(toggles())).toEqual([['Rd 1', 'false'], ['Rd 2', 'true'], ['Rd 3', 'false'], ['Rd 4', 'false']])
      // The fill is what it was: the pressed state is for a screen reader, and changes nothing seen.
      expect(screen.getByRole('button', { name: 'Rd 2' }).className).toBe('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors border-brand-navy bg-brand-navy text-white')
      expect(screen.getByRole('button', { name: 'Rd 1' }).className).toBe('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors border-border text-muted-foreground hover:border-ink/40')
    })

    it(`a player's own entry${on ? ' under the new look' : ''}: the round they asked off is pressed, and a click presses another`, async () => {
      flags.newLook = on
      await renderOpenEvent(ENTRY)
      const editors = screen.getAllByRole('button', { name: 'Update bye rounds' }).map((b) => b.parentElement as HTMLElement)
      expect(editors.length).toBeGreaterThan(0)
      for (const editor of editors) {
        const toggles = within(editor).getAllByRole('button', { name: /^Round \d$/ })
        expect(pressedOf(toggles)).toEqual([['Round 1', 'false'], ['Round 2', 'true'], ['Round 3', 'false'], ['Round 4', 'false']])
        expect(toggles[1].className).toBe('rounded-full border px-3 py-1 text-xs font-medium transition-colors border-brand-navy bg-brand-navy text-white')
      }
      const editor = editors[0]
      fireEvent.click(within(editor).getByRole('button', { name: 'Round 3' }))
      await waitFor(() => expect(within(editor).getByRole('button', { name: 'Round 3' }).getAttribute('aria-pressed')).toBe('true'))
      expect(within(editor).getByRole('button', { name: 'Round 2' }).getAttribute('aria-pressed')).toBe('true')
    })
  }

  it('the family panel\'s toggles: pressed when picked, with the switch off and on', async () => {
    const child: ApiChild = {
      id: 'k1', full_name: 'Robin Fixture', uscf_id: null, uscf_rating: null, membership_status: 'active', membership_expiry: null,
      membership_type: 'family', created_at: '2026-01-01', registration: null,
    }
    for (const on of [false, true]) {
      flags.newLook = on
      api.getMyChildren.mockResolvedValue([child])
      render(<MemoryRouter><FamilyRegistrationPanel tournament={openTournament()} selfName="Dana Fixture" selfUscfId={null} selfRegistered /></MemoryRouter>)
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Robin Fixture' }))
      const row = screen.getByText('Byes:').parentElement as HTMLElement
      expect(pressedOf(within(row).getAllByRole('button')), String(on)).toEqual([['1', 'false'], ['2', 'false'], ['3', 'false'], ['4', 'false']])
      fireEvent.click(within(row).getByRole('button', { name: '3' }))
      await waitFor(() => expect(within(row).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe('true'))
      expect(within(row).getByRole('button', { name: '3' }).className).toBe('rounded-full border px-2 py-0.5 text-[11px] font-medium border-brand-navy bg-brand-navy text-white')
      cleanup()
    }
  })
})

describe('the Upcoming and Past tabs on /tournaments say which list is shown, with the switch off and on', () => {
  for (const on of [false, true]) {
    it(on ? 'under the new look' : 'with newLook off', async () => {
      flags.newLook = on
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tournaments: [] }), { headers: { 'Content-Type': 'application/json' } })))
      const value = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue
      render(
        <AuthContext.Provider value={value}>
          <MemoryRouter initialEntries={['/tournaments']}><TournamentsPage /></MemoryRouter>
        </AuthContext.Provider>,
      )
      const tab = (name: string) => screen.getByRole('button', { name })
      await waitFor(() => expect(tab('upcoming').getAttribute('aria-pressed')).toBe('true'))
      expect(tab('past').getAttribute('aria-pressed')).toBe('false')
      expect(tab('upcoming').className).toBe('rounded-md px-2 py-0.5 text-xs font-semibold capitalize transition-colors bg-brand-navy text-white')
      fireEvent.click(tab('past'))
      await waitFor(() => expect(tab('past').getAttribute('aria-pressed')).toBe('true'))
      expect(tab('upcoming').getAttribute('aria-pressed')).toBe('false')
    })
  }
})

/** A start date in this month, where the calendar on /tournaments opens. */
function thisMonth(day: number): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Made-up events in Louisiana this month: one LCA runs, one a club runs, one a partner runs. */
function monthOfEvents(): UnifiedTournament[] {
  const none = { end_date: null, organizer: null, venue: null, rating_system: null, eligibility: null, contact: null, link: null }
  return [
    { ...none, id: 'e1', name: 'Fixture Bayou Open', start_date: thisMonth(4), city: 'Baton Rouge', state: 'LA', is_lca: 1, source: 'lca', registration_status: 'closed', status: 'upcoming', club_id: null },
    { ...none, id: 'e2', name: 'Fixture Capital Quads', start_date: thisMonth(12), city: 'Baton Rouge', state: 'LA', is_lca: 1, source: 'lca', registration_status: 'closed', status: 'upcoming', club_id: 'c1', club_name: 'Fixture Capital Chess Club', club_color: '#1f4e79' },
    { ...none, id: 'e3', name: 'Fixture Delta Swiss', start_date: thisMonth(20), city: 'Monroe', state: 'LA', is_lca: 0, source: 'clearinghouse', link: 'https://example.org/fixture-delta-swiss' },
  ]
}

async function renderTournaments() {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ tournaments: monthOfEvents() }), { headers: { 'Content-Type': 'application/json' } })))
  const value = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  const view = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments']}><TournamentsPage /></MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('button', { name: /^Fixture Bayou Open/ })
  return view
}

/** The classes of a view button and of a row in the list, as they were before the step. */
const VIEW = 'flex items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors'
const ROW = 'flex w-full items-center justify-between border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30'

describe('the other buttons on /tournaments that show which is picked say it, with the switch off and on, their look as before', () => {
  for (const on of [false, true]) {
    const label = on ? 'under the new look' : 'with newLook off'

    it(`the List and Calendar views, ${label}`, async () => {
      flags.newLook = on
      await renderTournaments()
      const view = (name: string) => screen.getByRole('button', { name })
      expect([view('List').getAttribute('aria-pressed'), view('Calendar').getAttribute('aria-pressed')]).toEqual(['true', 'false'])
      expect(view('List').className).toBe(`${VIEW} bg-lca-gold text-brand-navy`)
      expect(view('Calendar').className).toBe(`${VIEW} text-white/70 hover:text-white`)
      fireEvent.click(view('Calendar'))
      await waitFor(() => expect(view('Calendar').getAttribute('aria-pressed')).toBe('true'))
      expect(view('List').getAttribute('aria-pressed')).toBe('false')
      expect(view('Calendar').className).toBe(`${VIEW} bg-lca-gold text-brand-navy`)
    })

    it(`the list's rows: the one whose details are shown beside the list is the current one, ${label}`, async () => {
      flags.newLook = on
      await renderTournaments()
      const rows = () => ['Fixture Bayou Open', 'Fixture Capital Quads', 'Fixture Delta Swiss'].map((name) => screen.getByRole('button', { name: new RegExp(`^${name}`) }))
      expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual(['true', null, null])
      expect(rows()[0].className).toBe(`${ROW} border-l-2 border-l-lca-gold pl-[10px]`)
      expect(rows()[1].className).toBe(ROW)
      fireEvent.click(rows()[1])
      await waitFor(() => expect(rows()[1].getAttribute('aria-current')).toBe('true'))
      expect(rows().map((r) => r.getAttribute('aria-current'))).toEqual([null, 'true', null])
      expect(rows()[1].className).toBe(`${ROW} border-l-2 border-l-lca-gold pl-[10px]`)
      // The details beside the list are the current row's.
      expect(screen.getByRole('link', { name: 'Fixture Capital Quads' })).toBeTruthy()
    })

    it(`the calendar's days, today's date and the agenda's rows, ${label}`, async () => {
      flags.newLook = on
      await renderTournaments()
      fireEvent.click(screen.getByRole('button', { name: 'Calendar' }))
      const now = new Date()
      const heading = await screen.findByRole('heading', { name: `${now.toLocaleDateString('en-US', { month: 'long' })} ${now.getFullYear()}` })
      const calendar = heading.closest('.rounded-xl') as HTMLElement
      const day = (n: number) => within(calendar).getByRole('button', { name: String(n) })
      expect([4, 12, 20].map((n) => day(n).getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false'])
      // Today, whatever its date, is marked for a screen reader as its ring marks it on screen.
      const today = within(calendar).getAllByRole('button').filter((b) => b.getAttribute('aria-current') === 'date')
      expect(today.map((b) => b.textContent)).toEqual([String(now.getDate())])
      fireEvent.click(day(12))
      await waitFor(() => expect(day(12).getAttribute('aria-pressed')).toBe('true'))
      expect([4, 20].map((n) => day(n).getAttribute('aria-pressed'))).toEqual(['false', 'false'])
      expect(day(12).className).toBe('mx-auto flex size-6 items-center justify-center rounded-full text-[10px] transition-colors bg-brand-navy font-semibold text-white')
      // A second click lets the day go, as before.
      fireEvent.click(day(12))
      await waitFor(() => expect(day(12).getAttribute('aria-pressed')).toBe('false'))
      // The agenda beside the calendar: no row is current until one is picked.
      const agenda = () => screen.getAllByRole('button', { name: /Fixture (Bayou Open|Capital Quads|Delta Swiss)/ })
      expect(agenda().map((r) => r.getAttribute('aria-current'))).toEqual([null, null, null])
      fireEvent.click(agenda()[2])
      await waitFor(() => expect(agenda()[2].getAttribute('aria-current')).toBe('true'))
      expect(agenda().map((r) => r.getAttribute('aria-current'))).toEqual([null, null, 'true'])
      expect(agenda()[2].className).toBe('flex w-full items-start gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-muted/30 border-l-2 border-l-lca-gold bg-lca-gold/5 pl-[10px]')
    })

    it(`the state filter: its button says whether its menu is open, and the state it is set to is pressed, ${label}`, async () => {
      flags.newLook = on
      const { container } = await renderTournaments()
      const trigger = screen.getByRole('button', { name: 'Louisiana (3)' })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      const options = () => [...(container.querySelector('.bg-popover') as HTMLElement).querySelectorAll('button')]
      expect(options().map((o) => [o.textContent, o.getAttribute('aria-pressed')])).toEqual([
        ['Louisiana (3)', 'true'], ['Mississippi (0)', 'false'], ['Alabama (0)', 'false'], ['Texas (0)', 'false'],
        ['Florida (0)', 'false'], ['Out of State (0)', 'false'], ['All (3)', 'false'],
      ])
      expect(options()[0].className).toBe('flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 bg-lca-gold/8 font-medium text-ink')
      expect(options()[1].className).toBe('flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 text-muted-foreground')
      fireEvent.click(options()[6])
      await waitFor(() => expect(screen.getByRole('button', { name: 'All (3)' }).getAttribute('aria-expanded')).toBe('false'))
      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }))
      expect(options().filter((o) => o.getAttribute('aria-pressed') === 'true').map((o) => o.textContent)).toEqual(['All (3)'])
    })

    it(`the organizer column, drawn when clubTournaments is on: its rows are toggles, ${label}`, async () => {
      flags.newLook = on
      flags.clubTournaments = true
      await renderTournaments()
      const lca = () => screen.getByRole('button', { name: /^LCA direct events/ })
      const club = () => screen.getByRole('button', { name: /^Fixture Capital Chess Club/ })
      const other = () => screen.getByRole('button', { name: /^Other \(Louisiana\)/ })
      expect([lca(), club(), other()].map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false'])
      fireEvent.click(club())
      await waitFor(() => expect(club().getAttribute('aria-pressed')).toBe('true'))
      expect([lca(), other()].map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'false'])
      expect(club().className).toBe('flex w-full items-center gap-2.5 border-b border-border px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/30 border-l-2 border-l-lca-gold bg-lca-gold/5 pl-[10px]')
      // A second click lets the club go, as before.
      fireEvent.click(club())
      await waitFor(() => expect(club().getAttribute('aria-pressed')).toBe('false'))
    })
  }
})
