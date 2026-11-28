// @vitest-environment jsdom
//
// Criterion 1 of WS09, My region's part (WS09 step 11): no page under
// /clubs, no club page and no My region page shows a computed next meeting,
// a Tonight or Meets today state, a count of clubs meeting, a calendar,
// timetable or week grid. My region shows each club's meeting in the club's
// own words, the stamp of its last check as the server words it and the next
// monthly check's date as the server words it, and works out no date of its
// own: with the clock set years away, the page still says what the server
// said. The page is drawn alone, through the real client with fetch stubbed.
// A club's page in My region (WS09 step 12) has its part below: no Tonight
// tab and no weekly claim on any of its three tabs, and no date of its own
// but the stamp of its last check, read against the time the page opened
// in My region's own words; every full date it shows is an event's or a
// news post's, as the server gave it, with its weekday through the site's
// own helper. The club pages' own parts join this file with WS09 step 21:
// the new club page shows how the club meets as the club's own words, in a
// quote, and the told line as the server words it, and works out nothing:
// no meeting date, no Tonight, no "Checked" month of its own, with the clock set years
// away as with it today; and the files that draw it hold no clock.
// Every name and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ClubPageResponse, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { MyRegionClubPage } = await import('@/pages/MyRegionClubPage')
const { ClubPageView } = await import('@/areas/clubs/components/ClubPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The files that draw My region. */
const FILES = [
  'src/pages/MyRegionPage.tsx', 'src/areas/clubs/components/ThisMonthBar.tsx', 'src/areas/clubs/components/RegionClubCard.tsx',
  'src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/region.ts',
]

function card(id: string, name: string, needsCheck: boolean, lastCheckWords: string, statement: string | null): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Bayou Region', color: null, logoUrl: null, statement,
    lastConfirmedAt: needsCheck ? null : '2026-11-02 15:00:00', lastCheckWords, needsCheck, events: 3, openItems: [],
  }
}
const ANSWER: WorkspaceRegionResponse = {
  clubs: [
    card('c-one', 'Example Knights Club', true, 'Not checked yet', 'Every Tuesday at 7:00 PM, and tonight too'),
    card('c-two', 'Example Chess Club', false, 'Checked Nov 2026', 'First and third Saturdays at the Example Library'),
  ],
  thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 1, notChecked: 1 },
  regions: [{ region: 'Bayou Region', keepers: [] }],
}

let answer: WorkspaceRegionResponse = ANSWER
beforeEach(() => {
  answer = ANSWER
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/workspace/region'
    ? new Response(JSON.stringify(answer), { status: 200 })
    : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }))))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

async function draw() {
  const auth = {
    user: { id: 'm-one' }, session: null, role: 'member', member: { id: 'm-one', role: 'member', club_id: null, full_name: 'Player One' },
    loading: false, memberLoading: false, seats: [{ id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }],
    managedClubs: [], isBoardMember: true, assuranceLevel: 'aal1', mfaRequired: false, directedTournamentIds: [], directedTournaments: [],
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace/region']}><MyRegionPage /></MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
  await act(async () => {})
  // The page's words alone: the club's own words, which may say anything, are read apart.
  const own = new Set(answer.clubs.map((c) => c.statement).filter(Boolean).map((s) => `"${s}"`))
  const texts: string[] = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    if (text.trim() && !own.has(text)) texts.push(text)
  }
  return texts.join('\n')
}

describe('My region draws no weekly claims', () => {
  it('shows no computed next meeting, no Tonight or Meets today, no count of clubs meeting, and no calendar, timetable or week grid', async () => {
    const words = await draw()
    expect(words).toContain('Not checked yet')
    expect(words).toContain('Still accurate')
    expect(words).not.toMatch(/\b(?:tonight|meets today|meeting today|meeting tonight|next meeting|meets next|this week|next week)\b/i)
    expect(words).not.toMatch(/\b\d+ (?:clubs? )?(?:meet|meets|meeting)\b/i)
    expect(words).not.toMatch(/\b(?:calendar|timetable)\b/i)
    expect(document.querySelector('table, [role="grid"], [role="table"], time')).toBeNull()
    // The club's meeting is its own words, quoted as it gave them.
    expect(screen.getByText('"First and third Saturdays at the Example Library"')).toBeTruthy()
  })

  it('names no day of its own: the one full date is the server\'s next check, and each month is the server\'s stamp', async () => {
    const words = await draw()
    const dates = [...words.matchAll(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, [A-Z][a-z]{2} \d{1,2}, \d{4}\b/g)].map((m) => m[0])
    expect(dates).toEqual(['Mon, Dec 7, 2026'])
    const months = [...words.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g)].map((m) => m[0])
    expect(months).toEqual(['Nov 2026'])
  })

  it('says what the server said with the clock set years away, so it works out nothing from the time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2031-03-04T15:00:00Z'))
    answer = {
      ...ANSWER,
      clubs: [card('c-one', 'Example Knights Club', true, 'Not checked since Jun 2026', null)],
      thisMonth: { ...ANSWER.thisMonth, nextCheck: { day: '2027-01-04', date: 'Mon, Jan 4, 2027', time: '8:00 AM' }, checked: 0, notChecked: 1 },
    }
    const words = await draw()
    expect(words).toContain('Next monthly check due Mon, Jan 4, 2027')
    expect(words).toContain('Not checked since Jun 2026')
    expect(words).not.toMatch(/2031|Mar 2031/)
  })

  it('makes no date in the files that draw it: no clock, no date helper, no weekday of its own', () => {
    for (const file of FILES) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/new Date\(|Date\.now\(|Intl\.DateTimeFormat|toLocale(?:Date|Time)?String|getDay\(|from '@\/lib\/format'|formatDate|formatTime|nextCheck\.day/)
      expect(code, file).not.toMatch(/\b(?:Tonight|Meets today|calendar|timetable)\b/i)
    }
  })
})

/** The files that draw a club's page in My region, beside the one editor, which has its own tests. */
const CLUB_FILES = ['src/pages/MyRegionClubPage.tsx', 'src/areas/clubs/components/ClubEventsList.tsx', 'src/areas/clubs/components/ClubNewsPanel.tsx']

const CLUB = {
  id: 'c-two', name: 'Example Chess Club', city: 'Example City', location: null, description: null, meeting_schedule: 'Every Tuesday at 7:00 PM, and tonight too',
  contact_email: null, created_at: '2026-01-01 12:00:00', color: null, image_url: null, region: 'Bayou Region', latitude: null, longitude: null,
  slug: 'example-chess', about_text: 'A made-up club.', how_we_meet_text: 'Every Tuesday at 7:00 PM, and tonight too', cost_text: null, welcome_text: null,
  weekend_play: 0, scholastic_friendly: 0, contact_name_public: null, facebook_url: null, website_url: null, other_url: null,
  told_updated_at: '2026-11-02 15:00:00', told_by: 'm-two', last_confirmed_at: '2026-11-02 15:00:00', confirmed_by: 'm-two',
}
const CLUB_ANSWER = {
  club: CLUB, officers: [], roster: [], rosterKeptBack: true, places: [],
  tournaments: [{ id: 't-one', name: 'Example Open', date: '2026-12-05', end_date: null, status: 'upcoming', is_visible: 1, registration_status: 'open' }],
}
const CLUB_NEWS = [{ id: 'n-one', club_id: 'c-two', title: 'Example club night', news_date: '2026-11-07', excerpt: 'An example evening.', created_at: '2026-11-08 18:00:00' }]

describe('a club in My region draws no weekly claims', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/admin/clubs/c-two') return new Response(JSON.stringify(CLUB_ANSWER), { status: 200 })
      if (url === '/api/admin/clubs/c-two/news') return new Response(JSON.stringify({ news: CLUB_NEWS }), { status: 200 })
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    }))
  })

  /** The page at one of its tabs, for a region's representative, and its words but the club's own. */
  async function drawClub(tab: string) {
    const auth = {
      user: { id: 'm-one' }, session: null, role: 'member', member: { id: 'm-one', role: 'member', club_id: null, full_name: 'Player One' },
      loading: false, memberLoading: false, seats: [{ id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }],
      managedClubs: [{ id: 'c-two', name: 'Example Chess Club', region: 'Bayou Region' }], isBoardMember: true, assuranceLevel: 'aal1', mfaRequired: false,
      directedTournamentIds: [], directedTournaments: [],
    } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[`/workspace/region/clubs/c-two${tab ? `?tab=${tab}` : ''}`]}>
          <Routes><Route path="/workspace/region/clubs/:id" element={<MyRegionClubPage />} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
    if (tab === '') await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    if (tab === 'news') await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    await act(async () => {})
    const own = new Set([CLUB.how_we_meet_text, CLUB.about_text])
    const texts: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      // The club's own words, which the editor's previews quote and may say anything, are read apart.
      if (text.trim() && ![...own].some((w) => text.includes(w))) texts.push(text)
    }
    return texts.join('\n')
  }

  it('has no Tonight tab and shows no computed next meeting, count of clubs meeting, calendar, timetable or week grid on any of its three tabs', async () => {
    for (const tab of ['', 'news', 'events']) {
      const words = await drawClub(tab)
      const tabs = [...document.querySelectorAll('section.bg-brand-navy button:not([aria-label])')].map((b) => b.textContent)
      expect(tabs, tab).toEqual(['Listing', 'News', 'Events'])
      expect(words, tab).not.toMatch(/\b(?:tonight|meets today|meeting today|meeting tonight|next meeting|meets next|this week|next week)\b/i)
      expect(words, tab).not.toMatch(/\b\d+ (?:clubs? )?(?:meet|meets|meeting)\b/i)
      expect(words, tab).not.toMatch(/\b(?:calendar|timetable)\b/i)
      expect(document.querySelector('table, [role="grid"], [role="table"]'), tab).toBeNull()
      cleanup()
    }
  })

  it('shows as full dates only the event\'s and the news post\'s, each with its weekday, and as a month only the stamp of its last check', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T18:00:00Z'))
    const fullDates = (words: string) => [...words.matchAll(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, [A-Z][a-z]{2} \d{1,2}, \d{4}\b/g)].map((m) => m[0])
    const months = (words: string) => [...words.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/g)].map((m) => m[0])
    let words = await drawClub('events')
    expect(fullDates(words)).toEqual(['Sat, Dec 5, 2026'])
    expect(months(words)).toEqual(['Nov 2026'])
    expect(words).toContain('Example City · Bayou Region · Checked Nov 2026')
    cleanup()
    words = await drawClub('news')
    expect(fullDates(words)).toEqual(['Sat, Nov 7, 2026'])
    cleanup()
    // Years later the stamp says how long ago the check was, and no other date moves or appears.
    vi.setSystemTime(new Date('2031-03-04T15:00:00Z'))
    words = await drawClub('events')
    expect(words).toContain('Example City · Bayou Region · Not checked since Nov 2026')
    expect(fullDates(words)).toEqual(['Sat, Dec 5, 2026'])
    expect(words).not.toMatch(/2031/)
  })

  it('reads the clock in one place, for the stamp in My region\'s words, and makes every full date through the site\'s own helper', () => {
    const code = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const page = code(CLUB_FILES[0])
    expect(page.match(/Date\.now\(\)/g)).toHaveLength(1)
    expect(page).toContain('checkWords(club.last_confirmed_at, openedAt)')
    expect(page).toContain('import { checkWords } from \'@domain/clubs/regionCards\'')
    for (const file of CLUB_FILES) {
      const text = code(file)
      expect(text, file).not.toMatch(/new Date\(|Intl\.DateTimeFormat|toLocale(?:Date|Time)?String|getDay\(|nextCheck/)
      expect(text, file).not.toMatch(/\b(?:Tonight|Meets today|calendar|timetable)\b/i)
    }
    for (const file of CLUB_FILES.slice(1)) expect(code(file), file).toContain('formatDate(')
  })
})

/** The files that draw the new club page (WS09 step 21). */
const PAGE_FILES = [
  'src/areas/clubs/components/ClubPage.tsx', 'src/areas/clubs/components/ClubCover.tsx', 'src/areas/clubs/components/AuthorLine.tsx',
  'src/areas/clubs/components/SectionNav.tsx', 'src/areas/clubs/components/ClubAbout.tsx', 'src/areas/clubs/components/WhenAndWhere.tsx',
  'src/areas/clubs/components/PagePreview.tsx', 'src/areas/clubs/clubPage.ts', 'src/pages/ClubListingPage.tsx',
]
const PAGE_STATEMENT = 'Every Tuesday at 7:00 PM, and tonight too'
const PAGE_TOLD = 'Last checked November 2026'
const PAGE_ANSWER: ClubPageResponse = {
  club: { id: 'c-two', slug: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', color: '#1a2744', logo: null },
  sections: ['about', 'when_and_where', 'contact'],
  about: { text: 'A made-up club.', cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: true, scholastic_friendly: false },
  statement: { text: PAGE_STATEMENT, told: PAGE_TOLD },
  places: [{ name: 'Example Library', street: null, note: 'Come at 6:45 PM on a first visit.', latitude: null, longitude: null }],
  contact: { name: 'Player One' },
  suggestion: { goes_to: 'club_rep' },
  events: [], news: [], nearest: [],
}

describe('the new club page draws no weekly claims', () => {
  /** The page drawn from its answer, and its words but the club's own and the server's told line. */
  function drawPage() {
    render(<MemoryRouter><ClubPageView answer={PAGE_ANSWER} keeper={null} /></MemoryRouter>)
    const own = new Set([PAGE_STATEMENT, PAGE_ANSWER.about.text, PAGE_ANSWER.places[0].note, PAGE_TOLD])
    const texts: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      if (text.trim() && !own.has(text)) texts.push(text)
    }
    return texts.join('\n')
  }

  it('shows the statement as the club\'s words in a quote and the told line as given, and no meeting date, Tonight or "Checked" month of its own', () => {
    for (const at of ['2026-11-17T18:00:00Z', '2031-03-04T15:00:00Z']) {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(at))
      const words = drawPage()
      expect(document.querySelector('blockquote')?.textContent, at).toBe(PAGE_STATEMENT)
      expect(screen.getByText(PAGE_TOLD)).toBeTruthy()
      // The club's own words stay as it wrote them, on the cover and in the quote, and its note too.
      expect(screen.getAllByText(PAGE_STATEMENT)).toHaveLength(2)
      expect(screen.getByText('Come at 6:45 PM on a first visit.')).toBeTruthy()
      expect(words, at).not.toMatch(/\b(?:tonight|meets today|meeting today|meeting tonight|next meeting|meets next|this week|next week)\b/i)
      expect(words, at).not.toMatch(/\bChecked\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/)
      expect(words, at).not.toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, [A-Z][a-z]{2} \d{1,2}\b/)
      expect(words, at).not.toMatch(/\b(?:calendar|timetable)\b|2031/i)
      expect(document.querySelector('table, [role="grid"], [role="table"], time')).toBeNull()
      cleanup()
      vi.useRealTimers()
    }
  })

  it('makes no date in the files that draw it: no clock, no date helper, no weekday or Checked month of its own', () => {
    for (const file of PAGE_FILES) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/new Date\(|Date\.now\(|Intl\.DateTimeFormat|toLocale(?:Date|Time)?String|getDay\(|from '@\/lib\/format'|formatDate|formatTime/)
      expect(code, file).not.toMatch(/\b(?:Tonight|Meets today|calendar|timetable)\b|Checked /i)
    }
  })
})
