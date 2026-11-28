// @vitest-environment jsdom
//
// The new club page's Events (WS09 step 22), drawn from made-up answers:
// a weekday on every date, both ends of an event of more than one day; the
// state of each event in words through StatusBadge beside its mark; Register
// exactly where the events list offers it, to the event's own page on this
// site, and the count in the events pages' words; the answer's order and no
// clock time of the page's own; and no section, no heading and no nav link
// with no events. The page is drawn from its answer, with the switches it
// reads left as they ship, since none of its events' parts reads one. Every
// name, address and club here is made up.
import { cleanup, render, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { eventCount, eventState, offersRegister } from '@/areas/clubs/clubPageRows'
import { registrationSummary } from '@/areas/events/clearinghouse'
import type { UnifiedTournament } from '@/lib/api'
import type { ClubPageEvent, ClubPageResponse } from '@domain/contracts'
import { FULL_EVENT, OPEN_EVENT, PAST_EVENT, bareWith, restAnswer } from './helpers/clubPageRest'

vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

afterEach(cleanup)

function draw(answer: ClubPageResponse = restAnswer()) {
  const view = render(<MemoryRouter><ClubPageView answer={answer} keeper={null} /></MemoryRouter>)
  return view.container.querySelector<HTMLElement>('[data-slot="club-page"]')!
}

const rowsOf = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('#events [data-slot="club-event"]')]
const wordsOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

/** An event of the made-up club with some of its keys replaced. */
const event = (over: Partial<ClubPageEvent>): ClubPageEvent => ({ ...OPEN_EVENT, ...over })

describe('the club\'s events', () => {
  it('a weekday on every date', () => {
    const page = draw()
    const rows = rowsOf(page)
    expect(rows.map((row) => row.querySelector('h3 + p')?.textContent)).toEqual([
      'Sat, Dec 12, 2026 to Sun, Dec 13, 2026', 'Sat, Dec 5, 2026', 'Sat, Oct 24, 2026',
    ])
    // Each row's date block names the same day for a machine, and is for the eye alone.
    expect(rows.map((row) => row.querySelector('time')?.getAttribute('dateTime'))).toEqual(['2026-12-12', '2026-12-05', '2026-10-24'])
    for (const row of rows) expect(row.querySelector('time')!.closest('[aria-hidden="true"]')).not.toBeNull()
    // Every month and day the section says carries its weekday.
    const words = wordsOf(page.querySelector('#events')!)
    for (const found of words.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b/g)) {
      expect(words.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    // An event of one day whose end date is its start says the one day.
    cleanup()
    const one = draw(restAnswer({ events: [event({ end_date: OPEN_EVENT.date })] }))
    expect(rowsOf(one)[0].querySelector('h3 + p')?.textContent).toBe('Sat, Dec 5, 2026')
  })

  it('status in words', () => {
    const page = draw()
    const badges = rowsOf(page).map((row) => row.querySelector<HTMLElement>('[data-slot="status-badge"]')!)
    expect(badges.map((b) => [b.getAttribute('data-status'), b.textContent])).toEqual([
      ['full', 'Event full'], ['open', 'Registration open'], ['closed', 'Finished'],
    ])
    // Each tag's mark is beside its words, and hidden from a screen reader: the words say the state.
    for (const badge of badges) {
      expect(badge.querySelector('[data-slot="status-mark"]')?.getAttribute('aria-hidden')).toBe('true')
      expect(badge.className).toMatch(/text-status-/)
    }
    // Every state the answer can carry has words of its own.
    expect([
      eventState(event({ registration_status: 'draft' })), eventState(event({ registration_status: 'closed' })),
      eventState(event({ status: 'active' })), eventState(event({ status: 'completed', registration_status: 'open' })),
      eventState(event({ max_players: null, registered_count: 300 })),
    ]).toEqual([
      { status: 'soon', words: 'Opens soon' }, { status: 'closed', words: 'Registration closed' },
      { status: 'live', words: 'Under way' }, { status: 'closed', words: 'Finished' }, { status: 'open', words: 'Registration open' },
    ])
  })

  it('Register and the count', () => {
    const page = draw()
    const rows = rowsOf(page)
    // Register where the registration is open and the event is not finished, the full one among them, as the events list offers it.
    expect(rows.map((row) => within(row).queryByRole('link', { name: /^Register/ })?.getAttribute('href') ?? null)).toEqual([
      `/tournaments/${FULL_EVENT.id}`, `/tournaments/${OPEN_EVENT.id}`, null,
    ])
    expect(within(rows[1]).getByRole('link', { name: `Register for ${OPEN_EVENT.name}` }).textContent).toBe('Register')
    // Each name leads to the event's own page, a finished event's to its results.
    expect(rows.map((row) => row.querySelector('h3 a')?.getAttribute('href'))).toEqual([FULL_EVENT, OPEN_EVENT, PAST_EVENT].map((e) => `/tournaments/${e.id}`))
    // The count in the events pages' words.
    expect(rows.map((row) => wordsOf(row.querySelector('[data-slot="status-badge"]')!.parentElement!))).toEqual([
      'Event full 40 of 40 spots filled', 'Registration open 6 of 16 spots filled', 'Finished 22 registered',
    ])
    // The same words as the events pages, for every shape of count, and the list's own rule for Register.
    for (const [max, n] of [[16, 6], [40, 40], [null, 22], [null, 0], [0, 3]] as const) {
      const row = event({ max_players: max, registered_count: n })
      expect(eventCount(row), `${max} ${n}`).toBe(registrationSummary({ source: 'lca', max_players: max, registered_count: n } as unknown as UnifiedTournament))
    }
    for (const status of ['upcoming', 'active', 'completed'] as const) {
      for (const registration of ['draft', 'open', 'closed'] as const) {
        expect(offersRegister({ status, registration_status: registration }), `${status} ${registration}`).toBe(registration === 'open' && status !== 'completed')
      }
    }
    // An event with no limit and no one in yet says no count at all.
    cleanup()
    const empty = draw(restAnswer({ events: [event({ max_players: null, registered_count: 0 })] }))
    expect(wordsOf(rowsOf(empty)[0])).not.toMatch(/registered|spots/)
  })

  it('no section with no events', () => {
    // The answer names Events with no event in it, or carries an event and names no Events: neither draws the section.
    for (const answer of [bareWith({ sections: ['about', 'when_and_where', 'events', 'contact'], events: [] }), restAnswer({ sections: ['about', 'when_and_where', 'contact'], news: [] })]) {
      const page = draw(answer)
      expect(page.querySelector('#events')).toBeNull()
      expect([...page.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).toEqual(['About', 'When and where'])
      expect(within(page).queryByRole('heading', { name: 'Events' })).toBeNull()
      expect(wordsOf(page)).not.toMatch(/No events|no events yet|Register/i)
      cleanup()
    }
  })

  it('keeps the answer\'s order, writes no clock time of its own, and draws no Add to calendar and no partner row', () => {
    const reversed = [PAST_EVENT, OPEN_EVENT, FULL_EVENT]
    const page = draw(restAnswer({ events: reversed }))
    expect(rowsOf(page).map((row) => row.querySelector('h3')?.textContent)).toEqual(reversed.map((e) => e.name))
    const words = wordsOf(page.querySelector('#events')!)
    expect(words).not.toMatch(/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:AM|PM|am|pm)\b/)
    expect(words).not.toMatch(/calendar|Partner|organizer|Registers on/i)
    expect(page.querySelector('#events a[href$=".ics"], #events [data-status="partner"]')).toBeNull()
  })

  it('gives Register and each name a target of 44 pixels with the look\'s focus ring, Register solid ink, and stays inside the room the page keeps for its bars', () => {
    const page = draw()
    const controls = [...page.querySelectorAll<HTMLElement>('#events a')]
    expect(controls).toHaveLength(5)
    for (const control of controls) {
      expect(control.className).toMatch(/\bmin-h-11\b/)
      expect(control.className).toMatch(/focus-visible:ring-3/)
      expect(control.className).toMatch(/focus-visible:ring-focus/)
    }
    for (const register of within(page.querySelector<HTMLElement>('#events')!).getAllByRole('link', { name: /^Register for / })) {
      expect(register.className).toMatch(/bg-ink\b.*text-ground|text-ground.*bg-ink\b/)
    }
    expect(page.querySelector('#events')!.className).toContain('scroll-mt-')
  })
})
