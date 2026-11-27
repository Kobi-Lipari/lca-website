// @vitest-environment jsdom
//
// Criterion 1 of WS09, the two parts test/unit/club-pages-no-dates.test.tsx
// does not reach (WS09 step 38): no clubs page shows a computed next
// meeting, a Tonight or Meets today state, a count of clubs meeting, a
// calendar, timetable or week grid.
//
// - The Clubs directory on a phone: the layout the directory chooses below
//   1,024 pixels, with the map over the list's sheet, its sheet at both
//   rests, and "Not here?" under the list. Each club's meeting is the
//   club's own words and nothing else on the page works out a meeting, a
//   Tonight, a date or a Checked month, with the clock set years away as
//   with it today. The window's width is answered by a stand-in media
//   query, as in test/unit/club-directory-phone.test.tsx, and the map is
//   the stand-in, so nothing asks a maps provider.
// - The club page the server writes before any script
//   (functions/utils/clubs/pageHtml.ts): its body, title, description and
//   JSON-LD block are the same with the clock set years away; how the club
//   meets is the club's own words; and outside Events, where each event's
//   dates are written with the weekday as the site writes every date, the
//   page holds no date, no Tonight, no Checked month and no weekly claim.
//
// Every club and name here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDirectoryItem } from '@/areas/clubs/api'
import * as words from '@/areas/clubs/directoryWords'
import { STAND_IN_FLAG } from '@/areas/clubs/directoryPins'
import { NARROW_QUERY } from '@/areas/clubs/narrowScreen'
import type { ClubPageResponse } from '@domain/contracts'
import { eventDates } from '../../domain/clubs/pageWords'
import { clubJsonLd, clubPageBody, pageDescription, pageTitle } from '../../functions/utils/clubs/pageHtml'

const { ClubDirectory } = await import('@/areas/clubs/components/ClubDirectory')

/** A date worked out and written with its weekday, a month and year, or a count of clubs meeting. */
const WEEKLY_CLAIM = /\b(?:tonight|meets today|meeting today|meeting tonight|next meeting|meets next|this week|next week)\b/i
const CLUBS_MEETING = /\b\d+ (?:clubs? )?(?:meet|meets|meeting)\b/i
const WORKED_OUT = /\bChecked\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, [A-Z][a-z]{2} \d{1,2}\b/
const GRIDS = /\b(?:calendar|timetable)\b|2031/i
const CLOCKS = ['2026-11-26T18:00:00Z', '2031-03-04T15:00:00Z']

describe('the Clubs directory on a phone draws no weekly claims', () => {
  const STATEMENTS = ['Every Tuesday at 7:00 PM, and tonight too', 'First and third Saturdays at the Example Library']
  const CLUBS: ApiClubDirectoryItem[] = [
    { id: 'c-one', name: 'Example Knights Club', statement: STATEMENTS[0], description: null, point: [30.45, -91.18] as [number, number] },
    { id: 'c-two', name: 'Example Chess Club', statement: STATEMENTS[1], description: null, point: [32.5, -92.1] as [number, number] },
    { id: 'c-three', name: 'Example Rooks Club', statement: null, description: 'A made-up club.', point: null },
  ].map((c) => ({
    id: c.id, name: c.name, statement: c.statement, description: c.description,
    city: 'Example City', meeting_schedule: c.statement ?? '', color: null, image_url: null, region: 'North Louisiana', latitude: null, longitude: null,
    slug: c.id, point: c.point ? { latitude: c.point[0], longitude: c.point[1] } : null, weekend_play: false, scholastic_friendly: false,
  }))

  // The browser's own, put back after each case.
  const originalMatchMedia = window.matchMedia
  const originalScroll = Element.prototype.scrollIntoView
  beforeEach(() => {
    Element.prototype.scrollIntoView = function () {}
    window.matchMedia = ((query: string) => ({ matches: query === NARROW_QUERY, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    vi.stubEnv('MODE', 'a11y')
    ;(window as unknown as Record<string, unknown>)[STAND_IN_FLAG] = true
  })
  afterEach(() => {
    cleanup()
    window.matchMedia = originalMatchMedia
    Element.prototype.scrollIntoView = originalScroll
    vi.unstubAllEnvs()
    vi.useRealTimers()
    delete (window as unknown as Record<string, unknown>)[STAND_IN_FLAG]
  })

  /** The page's words but the clubs' own. */
  function pageWords(): string {
    const texts: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      if (text.trim() && !STATEMENTS.includes(text)) texts.push(text)
    }
    return texts.join('\n')
  }

  function expectNoClaims(at: string) {
    const said = pageWords()
    expect(said, at).not.toMatch(WEEKLY_CLAIM)
    expect(said, at).not.toMatch(CLUBS_MEETING)
    expect(said, at).not.toMatch(WORKED_OUT)
    expect(said, at).not.toMatch(GRIDS)
    expect(document.querySelector('table, [role="grid"], [role="table"], time')).toBeNull()
  }

  it('shows each club\'s meeting in its own words, at both rests of the sheet and under the list, and works out no meeting, Tonight or date, with the clock set years away as with it today', async () => {
    for (const at of CLOCKS) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(at))
      render(<MemoryRouter initialEntries={['/clubs']}><ClubDirectory clubs={CLUBS} /></MemoryRouter>)
      // The phone layout: the map, and the list in its sheet, starting low.
      expect(await screen.findByRole('group', { name: words.MAP_NAME })).toBeTruthy()
      await act(async () => {})
      const sheet = screen.getByRole('region', { name: words.LIST_SHEET })
      expect(sheet.getAttribute('data-sheet'), at).toBe('low')
      for (const statement of STATEMENTS) expect(within(sheet).getByText(statement)).toBeTruthy()
      expect(within(sheet).getByText(words.NOT_HERE)).toBeTruthy()
      expect(within(sheet).getByRole('link', { name: words.SUGGEST_A_CLUB })).toBeTruthy()
      expectNoClaims(`${at}, the sheet low`)
      // And at its full rest.
      fireEvent.click(within(sheet).getByRole('button', { name: words.SHOW_LIST }))
      expect(sheet.getAttribute('data-sheet'), at).toBe('full')
      expect(within(sheet).getByRole('button', { name: words.SHOW_MAP })).toBeTruthy()
      expectNoClaims(`${at}, the sheet full`)
      cleanup()
      vi.useRealTimers()
    }
  })
})

describe('the club page written before any script draws no weekly claims', () => {
  const STATEMENT = 'Every Tuesday at 7:00 PM, and tonight too'
  const EVENT = {
    id: 't-example-open', name: 'Example Club Open', date: '2026-10-24', end_date: null, status: 'upcoming',
    registration_status: 'open', max_players: null, registered_count: 4,
  } as ClubPageResponse['events'][number]
  const ANSWER: ClubPageResponse = {
    club: { id: 'c-two', slug: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', color: '#1a2744', logo: null },
    sections: ['about', 'when_and_where', 'events', 'contact'],
    about: { text: 'A made-up club.', cost: 'Free.', welcome: 'Everyone.', facebook: null, website: null, other: null, weekend_play: true, scholastic_friendly: true },
    statement: { text: STATEMENT, told: 'Last checked November 2026' },
    places: [{ name: 'Example Library', street: '100 Example St, Example City, LA', note: 'Come at 6:45 PM on a first visit.', latitude: null, longitude: null }],
    contact: { name: 'Player One' },
    suggestion: { goes_to: 'club_rep' },
    events: [EVENT], news: [], nearest: [],
  }

  afterEach(() => vi.useRealTimers())

  /** The written page at a time: its body, title, description and JSON-LD block. */
  function writtenAt(at: string) {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(at))
    const page = { body: clubPageBody(ANSWER), title: pageTitle(ANSWER), description: pageDescription(ANSWER), jsonLd: clubJsonLd(ANSWER, 'https://example.org') }
    vi.useRealTimers()
    return page
  }

  /** The text a reader meets, each element's words on a line of their own, with no tag and no style. */
  const textOf = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<br>/g, '\n').replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean)

  it('writes the same page with the clock set years away as with it today', () => {
    const [today, later] = CLOCKS.map(writtenAt)
    expect(later).toEqual(today)
  })

  it('writes how the club meets in its own words, and outside Events no meeting date, Tonight, Checked month or weekly claim; each event\'s dates are its own', () => {
    const { body, title, description } = writtenAt(CLOCKS[0])
    const lines = textOf(body)
    expect(lines).toContain(STATEMENT)
    const events = body.match(/<section id="[^"]*"><h2>Events<\/h2>[\s\S]*?<\/section>/)?.[0]
    expect(events, 'the Events section').toBeTruthy()
    expect(textOf(events!)).toEqual(['Events', EVENT.name, eventDates(EVENT)])
    expect(eventDates(EVENT)).toBe('Sat, Oct 24, 2026')
    const outside = [...textOf(body.replace(events!, '')).filter((line) => line !== STATEMENT && line !== ANSWER.places[0].note), title, description.replace(STATEMENT, '')].join('\n')
    expect(outside).not.toMatch(WEEKLY_CLAIM)
    expect(outside).not.toMatch(CLUBS_MEETING)
    expect(outside).not.toMatch(WORKED_OUT)
    expect(outside).not.toMatch(GRIDS)
    expect(outside).not.toMatch(/\b20\d\d\b/)
    expect(body).not.toMatch(/<(?:table|time)\b|role="(?:grid|table)"/)
  })
})
