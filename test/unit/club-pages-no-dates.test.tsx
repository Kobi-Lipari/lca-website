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
// The club pages' own parts join this file with WS09 step 21. Every name and
// club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')

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
  window.localStorage.setItem(REGION_HELP_SHOWN_KEY, 'shown')
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
    expect(words).toContain('Next monthly check lands Mon, Jan 4, 2027')
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
