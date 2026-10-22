// @vitest-environment jsdom
//
// The edges of what the axe sweep of WS01 acceptance criterion 1 changed
// (step 32), beside test/unit/sweep-fixes.test.tsx:
// - the rule in src/index.css that draws a menu option's ring inside its
//   edge reaches every option of both menus that scroll, the state filter's
//   (FilterDropdown) and the multi-select one (MultiSelectDropdown, which
//   only an admin screen draws, so no browser test opens it), and only under
//   the new look;
// - a club card under the new look: a club that stored brand gold in other
//   letters is brand gold, its initials in the gold ink with no dark
//   classes; a club with a logo picture draws no initials and its name is
//   still the one button; a link with ?club= opens the page with that club's
//   name pressed;
// - the tournament page of an event with no pairings draws the same disabled
//   button with the switch off and on, since only the live button changed.
// The switch is flipped inside this one file, through a getter on the mocked
// FEATURES, as in sweep-fixes.test.tsx.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiClubListItem, ApiTournamentDetail } from '@/lib/api'
import { parseRules, read } from './helpers/cssTokens'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
const api = vi.hoisted(() => ({
  getClubs: vi.fn(),
  getTournament: vi.fn(),
  getTournamentReminderStatus: vi.fn(async () => ({ opted_in: false })),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map needs Google's script; the cards are what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubsPage } = await import('@/pages/ClubsPage')
const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')
const { FilterDropdown } = await import('@/components/FilterDropdown')
const { MultiSelectDropdown } = await import('@/components/MultiSelectDropdown')

/** The classes that give a club's own colour way to the look's ink on a dark ground. */
const ON_DARK = ['dark:text-ink!', 'in-data-[theme=live]:text-ink!']

beforeAll(() => {
  // jsdom has neither; the clubs page asks both when a card is picked.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getTournament.mockReset()
})
afterEach(() => {
  cleanup()
  flags.newLook = false
  document.documentElement.removeAttribute('data-look')
})

describe('the menus the step 32 ring rule reaches', () => {
  /** The selector of the rule that draws an option's ring at -2px, without the state it waits for. */
  function ringRule(): string {
    const rules = parseRules(read('src/index.css')).filter((r) => r.decls.get('outline-offset') === '-2px')
    expect(rules.map((r) => r.selectors)).toEqual([[':root[data-look="new"] .bg-popover.overflow-y-auto > button:focus-visible']])
    return rules[0].selectors[0].replace(/:focus-visible$/, '')
  }

  it('reaches every option of the state filter\'s menu and of the multi-select menu, and nothing else in them, only under the new look', () => {
    const selector = ringRule()
    const { container } = render(
      <div>
        <FilterDropdown value="all" options={[{ value: 'all', label: 'Louisiana (3)' }, { value: 'ms', label: 'Mississippi (1)' }]} onChange={() => {}} on="navy" />
        <MultiSelectDropdown defaultLabel="All roles" options={[{ value: 'a', label: 'Admin' }, { value: 'b', label: 'Member' }]} selected={['a']} onChange={() => {}} />
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Louisiana \(3\)/ }))
    fireEvent.click(screen.getByRole('button', { name: /Admin/ }))
    const menus = [...container.querySelectorAll<HTMLElement>('.bg-popover')]
    expect(menus).toHaveLength(2)
    const options = menus.flatMap((m) => [...m.querySelectorAll('button')])
    // The state filter's two options, and the multi-select's two with its Clear.
    expect(options.map((o) => o.textContent)).toEqual(['Louisiana (3)', 'Mississippi (1)', 'Admin', 'Member', 'Clear'])
    const triggers = [...container.querySelectorAll('button')].filter((b) => !options.includes(b))
    expect(triggers).toHaveLength(2)
    expect(options.filter((o) => o.matches(selector))).toEqual([])
    document.documentElement.setAttribute('data-look', 'new')
    expect(options.filter((o) => !o.matches(selector)).map((o) => o.textContent)).toEqual([])
    expect(triggers.filter((t) => t.matches(selector))).toEqual([])
  })
})

/** Made-up clubs: one with a colour of its own, one that stored brand gold in capitals with a space, one with a logo picture. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', meeting_schedule: 'Tuesdays at 7:00 PM', color: '#1f4e79', image_url: null, region: 'South Central Louisiana', latitude: 30.45, longitude: -91.19 },
  { id: 'c2', name: 'Fixture North Chess Club', city: 'Monroe', meeting_schedule: 'Fridays at 6:30 PM', color: ' #C8A94A ', image_url: null, region: 'North Louisiana', latitude: 32.51, longitude: -92.12 },
  { id: 'c3', name: 'Fixture River Chess Club', city: 'Lafayette', meeting_schedule: 'Saturdays at 10:00 AM', color: '#2e7d32', image_url: '/fixture-river-logo.png', region: 'Southwest Louisiana', latitude: 30.22, longitude: -92.02 },
]

async function renderClubs(entry = '/clubs') {
  api.getClubs.mockResolvedValue(CLUBS)
  const view = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findAllByText('Fixture Capital Chess Club')
  return view
}

/** The initials standing in for a club's logo, by their letters. */
const initialsOf = (container: HTMLElement, letters: string) =>
  [...container.querySelectorAll<HTMLElement>('span[aria-hidden="true"]')].find((el) => el.textContent === letters)

describe('a club card under the new look, at its edges', () => {
  it('a club that stored brand gold in capitals with a space is brand gold: its initials take the gold ink and no dark classes', async () => {
    flags.newLook = true
    const { container } = await renderClubs()
    const gold = initialsOf(container, 'FN') as HTMLElement
    expect(gold.style.color).toBe('var(--gold-ink)')
    for (const name of ON_DARK) expect(gold.classList.contains(name), name).toBe(false)
    const own = initialsOf(container, 'FC') as HTMLElement
    for (const name of ON_DARK) expect(own.classList.contains(name), name).toBe(true)
  })

  it('a club with a logo picture draws no initials, and its name is still the one button of its card', async () => {
    flags.newLook = true
    const { container } = await renderClubs()
    expect(initialsOf(container, 'FR')).toBeUndefined()
    const name = screen.getByRole('button', { name: 'Show Fixture River Chess Club on the map' })
    expect(name.tagName).toBe('BUTTON')
    const card = name.closest('.group') as HTMLElement
    expect(card.querySelector('img')?.getAttribute('src')).toBe('/fixture-river-logo.png')
    expect(within(card).getAllByRole('button')).toEqual([name])
    expect(card.querySelectorAll('[role="button"]')).toHaveLength(0)
  })

  it('a link with ?club= opens the page with that club\'s name pressed, and every other name not pressed', async () => {
    flags.newLook = true
    await renderClubs('/clubs?club=c2')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Show Fixture North Chess Club on the map' }).getAttribute('aria-pressed')).toBe('true'))
    for (const other of ['Fixture Capital Chess Club', 'Fixture River Chess Club']) {
      expect(screen.getByRole('button', { name: `Show ${other} on the map` }).getAttribute('aria-pressed'), other).toBe('false')
    }
  })

  it('with the switch off the same link presses that club\'s card, as it always did', async () => {
    await renderClubs('/clubs?club=c2')
    const card = await screen.findByRole('button', { name: 'Show Fixture North Chess Club on the map' })
    await waitFor(() => expect(card.getAttribute('aria-pressed')).toBe('true'))
    expect(card.tagName).toBe('DIV')
  })
})

function tournament(): ApiTournamentDetail {
  return {
    id: 't2', name: 'Fixture Autumn Swiss', location: 'Lafayette, LA', venue: 'Fixture Library', date: '2026-11-14', end_date: null,
    entry_fee: 25, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    sections: [{ id: 'sec-1', name: 'Open', entryFee: 25, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: true, cap: null, fees: { early: 25, regular: 25, late: 25 } }],
    rounds: 4, max_players: null, status: 'upcoming', description: 'A made-up event.', registration_deadline: null, club_id: null, created_by: null,
    created_at: '2026-09-01 12:00:00', registration_status: 'closed', registration_opens_at: null, is_rated: 0, is_visible: 1, round_schedule: [],
    registration_closes_at: null, custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null,
    pairing_system: 'uscf', accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1,
    club_name: null, club_color: null, waitlist_count: 0,
  } as unknown as ApiTournamentDetail
}

async function renderEventWithNoPairings() {
  api.getTournament.mockResolvedValue({ tournament: tournament(), roster: [], pairings: [], myRegistration: null })
  const value = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments/t2']}>
        <Routes><Route path="/tournaments/:id" element={<TournamentDetailPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const button = await screen.findByRole('button', { name: /See pairings \/ results/ })
  return { button, link: screen.queryByRole('link', { name: /See pairings/ }) }
}

describe('the tournament page of an event with no pairings', () => {
  it('draws the same disabled button with the switch off and on, and no link to the pairings', async () => {
    const off = await renderEventWithNoPairings()
    const before = { className: off.button.className, disabled: (off.button as HTMLButtonElement).disabled }
    expect(off.link).toBeNull()
    cleanup()
    flags.newLook = true
    const on = await renderEventWithNoPairings()
    expect({ className: on.button.className, disabled: (on.button as HTMLButtonElement).disabled }).toEqual(before)
    expect(before.disabled).toBe(true)
    expect(before.className).toContain('border-white/15 bg-white/5 text-white/30 cursor-not-allowed')
    expect(on.link).toBeNull()
  })
})
