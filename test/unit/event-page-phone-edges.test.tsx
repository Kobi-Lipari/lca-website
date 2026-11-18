// @vitest-environment jsdom
//
// The edges of the public event page on a phone (K's decision 13, choice 2 a).
// A browser's layout is not drawn here, so the cause and the mend are held by
// what Tailwind writes for the page's classes and by the boxes between the
// grid and the sections table: nothing there may force a width, and the one
// box that scrolls is the table's own. The other cases are the states the six
// wordings meet: a signed-out visitor, a member who has a number, a member
// with none on an unrated event, an empty roster and a roster row with no
// number. The file sets newLook itself, through a getter on the mocked
// FEATURES, and builds the old initials from two pieces.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiMember, ApiTournamentDetail } from '@/lib/api'
import { builder } from './helpers/tailwindPx'

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
  getTournament: vi.fn(),
  getMyChildren: vi.fn(async () => []),
  getTournamentReminderStatus: vi.fn(async () => ({ opted_in: false })),
  registerForTournament: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')

const OLD = 'US' + 'CF'
const GRID = 'grid grid-cols-1 gap-8 lg:grid-cols-3'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  // Thursday, October 1, 2026, noon Central: registration is open.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T17:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  flags.newLook = false
  api.registerForTournament.mockReset()
})

function event(rated: boolean): ApiTournamentDetail {
  return {
    id: 't1', name: 'Example Fall Open', location: 'Example City, LA', venue: 'Example Community Center', date: '2026-10-24', end_date: null,
    entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    sections: [{ id: 'sec-1', name: 'Open', entryFee: 30, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: true, cap: null, fees: { early: 30, regular: 30, late: 30 } }],
    rounds: 5, max_players: null, status: 'upcoming', description: 'A made-up event.', registration_deadline: null, club_id: null, created_by: null,
    created_at: '2026-08-01 12:00:00', registration_status: 'open', registration_opens_at: null, is_rated: rated ? 1 : 0, is_visible: 1, round_schedule: [],
    registration_closes_at: null, custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null,
    pairing_system: 'uscf', accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1,
    club_name: null, club_color: null, waitlist_count: 0,
  } as unknown as ApiTournamentDetail
}
const member = (uscfId: string | null): ApiMember => ({
  id: 'm1', email: 'player.three@example.org', full_name: 'Player Three', uscf_id: uscfId, uscf_rating: uscfId ? 1500 : null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: null, role: 'member', club_id: null, created_at: '2026-01-01',
} as ApiMember)

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

async function draw(rated: boolean, who: ApiMember | null, roster: Array<Record<string, unknown>>) {
  api.getTournament.mockResolvedValue({ tournament: event(rated), roster, pairings: [], myRegistration: null })
  const value = { user: who ? { id: who.id } : null, member: who, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  const view = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments/t1']}>
        <Where />
        <Routes>
          <Route path="/tournaments/:id" element={<TournamentDetailPage />} />
          <Route path="/login" element={<p>Sign in page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { name: 'Sections' })
  return view
}

function everythingShown(): string {
  const attrs = [...document.body.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value))
  return `${document.body.textContent ?? ''}\n${attrs.join('\n')}`
}

const player = (id: string, name: string, uscf: string | null, withdrawn: string | null = null) => ({
  member_id: id, section: 'Open', withdrawn_at: withdrawn, full_name: name, uscf_id: uscf, uscf_rating: uscf ? 1500 : null,
})

describe('what Tailwind writes for the page\'s grid, which is why the page no longer scrolls sideways', () => {
  it('lets the one column below 1024 pixels shrink with grid-cols-1, which the old class never set', async () => {
    const css = (await builder())(GRID.split(' '))
    // The column is minmax(0, 1fr): it may be narrower than its widest item.
    expect(css).toMatch(/\.grid-cols-1\s*\{[^}]*grid-template-columns:\s*repeat\(1,\s*minmax\(0,\s*1fr\)\)/)
    // The class the page wore with newLook off sets no template at all, so its one column was sized to its widest item.
    const before = (await builder())(['grid', 'gap-8', 'lg:grid-cols-3'])
    // (The compile keeps what it was asked for before, so only the rule for the bare grid class is read.)
    expect(before).toMatch(/\.grid\s*\{\s*display:\s*grid;\s*\}/)
  })

  it('goes to three columns only from 1024 pixels, so a computer sees the page as it was', async () => {
    const css = (await builder())(GRID.split(' '))
    expect(css).toMatch(/@media \(width >= 64rem\)\s*\{\s*\.lg\\:grid-cols-3\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/)
  })

  it('keeps the table wider than a phone, in a box that scrolls on its own', async () => {
    const css = (await builder())(['min-w-[480px]', 'overflow-x-auto'])
    expect(css).toMatch(/min-width:\s*480px/)
    expect(css).toMatch(/overflow-x:\s*auto/)
  })
})

describe('the boxes between the page\'s grid and its sections table', () => {
  for (const on of [false, true]) {
    it(`${on ? 'with newLook on' : 'with newLook off'} force no width, and only the table's own box scrolls`, async () => {
      flags.newLook = on
      const { container } = await draw(true, null, [])
      const grid = container.querySelector('section.max-w-6xl.py-10 > .grid') as HTMLElement
      expect(grid.className).toBe(GRID)
      const box = screen.getByRole('heading', { name: 'Sections' }).nextElementSibling as HTMLElement
      expect(box.className).toContain('overflow-x-auto')
      // Every ancestor from the heading's column up to the grid.
      const between: HTMLElement[] = []
      for (let at = box.parentElement; at && at !== grid; at = at.parentElement) between.push(at)
      expect(between.length).toBeGreaterThan(0)
      for (const el of between) {
        const tokens = el.className.split(/\s+/)
        for (const token of tokens) {
          expect(token, `${el.tagName} ${el.className}`).not.toMatch(/^(?:w-max|w-fit|min-w-|w-\[|whitespace-nowrap|shrink-0|flex-none|overflow-)/)
        }
      }
      // The grid's direct children are the main column and the side card, and neither is a flex row that could widen it.
      expect(grid.children).toHaveLength(2)
    })
  }
})

describe('the states the six wordings meet', () => {
  for (const on of [false, true]) {
    const look = on ? 'with newLook on' : 'with newLook off'

    it(`${look}, an empty roster prints no number, and the Format line still says US Chess-rated`, async () => {
      flags.newLook = on
      await draw(true, null, [])
      expect(screen.queryByText(/US Chess ID \d/)).toBeNull()
      expect(screen.getByText('5-round Swiss, US Chess-rated')).toBeTruthy()
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${look}, a roster row with no number prints no number line, and a withdrawn row is not listed with one`, async () => {
      flags.newLook = on
      await draw(true, null, [
        player('p1', 'Player One', '12345678'),
        player('p2', 'Player Two', null),
        player('p3', 'Player Three', '11112222', '2026-09-30 10:00:00'),
      ])
      expect(screen.getAllByText(/^US Chess ID \d+$/).map((el) => el.textContent)).toEqual(['US Chess ID 12345678'])
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${look}, a signed-out visitor who presses Register is sent to sign in and is not refused`, async () => {
      flags.newLook = on
      await draw(true, null, [])
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      expect((await screen.findByTestId('where')).textContent).toBe('/login')
      expect(screen.queryByText(/rated tournament/)).toBeNull()
    })

    it(`${look}, a member with no number is not refused on an unrated event, and no link to the profile is shown`, async () => {
      flags.newLook = on
      await draw(false, member(null), [])
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      await screen.findByRole('heading', { name: 'Confirm registration' })
      expect(screen.queryByText(/rated tournament/)).toBeNull()
      expect(screen.queryByRole('link', { name: /to your profile/ })).toBeNull()
      // No number on the profile, so the card has no number row.
      expect(screen.queryByText('US Chess ID')).toBeNull()
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${look}, a member with a number is not refused on a rated event, and the card shows the number`, async () => {
      flags.newLook = on
      await draw(true, member('87654321'), [])
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      await screen.findByRole('heading', { name: 'Confirm registration' })
      expect(screen.queryByText(/rated tournament/)).toBeNull()
      expect(screen.queryByRole('link', { name: /to your profile/ })).toBeNull()
      expect(screen.getByText('US Chess ID').nextElementSibling?.textContent).toBe('87654321')
    })

    it(`${look}, the refusal is kept in the page, no registration is sent, and the sentence names US Chess twice and the old initials never`, async () => {
      flags.newLook = on
      await draw(true, member(null), [])
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      const link = await screen.findByRole('link', { name: /to your profile/ })
      const sentence = link.parentElement?.firstChild?.textContent ?? ''
      expect(sentence.match(/US Chess/g)).toHaveLength(2)
      expect(sentence).not.toContain(OLD)
      expect(api.registerForTournament).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: 'Confirm registration' })).toBeNull()
    })
  }
})
