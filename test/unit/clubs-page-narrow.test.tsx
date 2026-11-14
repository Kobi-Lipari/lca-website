// @vitest-environment jsdom
//
// The public Clubs page on a narrow phone, as K's decision 4, answer 1 (a),
// of Saturday, November 14, 2026 asked. Below 1,024 pixels the grid that
// holds the map and the list has one column that may be narrower than its
// widest card, so a long meeting time no longer makes the page wider than a
// phone 320 pixels wide; at 1,024 and wider the two columns are as before.
// And on a club card the meeting time wraps onto a second line, whole,
// instead of being cut short, in the way the line of city and region
// already wraps, its calendar mark beside the first line. The card's other
// lines, its links and the words a screen reader meets are as before.
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubListItem } from '@/lib/api'

const api = vi.hoisted(() => ({ getClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map needs Google's script; the grid and the cards are what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubsPage } = await import('@/pages/ClubsPage')

const LONG_MEETING = '1st, 3rd & 5th Tuesdays 5:30 PM'
/** Two made up clubs: one with a long meeting time and a pin, one with no meeting time and no pin. */
const CLUBS: ApiClubListItem[] = [
  { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: LONG_MEETING, color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 29.7, longitude: -91.2 },
  { id: 'c2', name: 'Example Knights Club', city: 'Example Town', meeting_schedule: null, color: '#c8a94a', image_url: null, region: null, latitude: null, longitude: null },
]

const PAGE_SOURCE = readFileSync(join(resolve(__dirname, '../..'), 'src/pages/ClubsPage.tsx'), 'utf8')

beforeAll(() => {
  // jsdom has neither; the clubs page asks both.
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
})
afterEach(() => cleanup())

/** The words of an element as a screen reader meets them, in order: what is marked aria-hidden is left out. */
function spoken(el: Element): string {
  if (el.getAttribute('aria-hidden') === 'true') return ''
  return [...el.childNodes].map((n) => (n.nodeType === Node.TEXT_NODE ? n.textContent ?? '' : n instanceof Element ? spoken(n) : '')).join('')
}

async function drawPage() {
  const view = render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByText(LONG_MEETING)
  return view.container
}

describe('the public Clubs page on a narrow phone', () => {
  it('gives the grid of the map and the list one column below 1,024 pixels, and the two columns as before at 1,024 and wider', async () => {
    const container = await drawPage()
    const list = screen.getByRole('heading', { level: 2, name: '2 clubs' }).closest('.lg\\:order-1') as HTMLElement
    const grid = list.parentElement as HTMLElement
    expect(grid.className.split(' ')).toEqual(['grid', 'grid-cols-1', 'gap-5', 'lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]', 'lg:gap-6'])
    // The map comes first in the markup, as before, and the list after it.
    expect([...grid.children].map((c) => c.className)).toEqual(['scroll-mt-20 lg:order-2', 'lg:order-1'])
    expect(container.querySelectorAll('.grid-cols-1')).toHaveLength(1)
    // The one column is written once, beside its wide template, and the file holds no other grid of that kind.
    expect(PAGE_SOURCE.split('grid-cols-1')).toHaveLength(2)
    expect(PAGE_SOURCE).toContain('<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-6">')
  })

  it('lets a long meeting time wrap whole onto a second line, its calendar mark beside the first, with nothing cut short', async () => {
    const container = await drawPage()
    const meeting = screen.getByText(LONG_MEETING)
    expect(meeting.tagName).toBe('SPAN')
    expect(meeting.textContent).toBe(LONG_MEETING)
    expect(meeting.className.split(' ')).toEqual(['min-w-0', 'break-words'])
    const line = meeting.parentElement as HTMLElement
    expect(line.tagName).toBe('P')
    expect(line.className).toBe('flex items-start gap-1.5')
    // The mark sits level with the first line, as the pin of the line of city and region does.
    expect(line.querySelector('svg')?.getAttribute('class')).toContain('mt-0.5 size-3 flex-shrink-0 text-gold-ink')
    expect(line.querySelector('svg')?.getAttribute('class')).toContain('lucide-calendar')
    // No line of the page is cut short with three dots.
    expect(container.querySelectorAll('.truncate, .text-ellipsis, [class*="line-clamp"]')).toHaveLength(0)
    expect(PAGE_SOURCE).not.toMatch(/\btruncate\b/)
    // The meeting line is built as the line of city and region is.
    const place = screen.getByText('Example City, LA · Bayou Region')
    expect(place.className).toBe(meeting.className)
    expect(place.parentElement?.className).toBe(line.className)
  })

  it('keeps every other line, each link and the words a screen reader meets as they were', async () => {
    await drawPage()
    const cards = screen.getAllByRole('button', { name: /^Show .+ on the map$/ })
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['Show Example Chess Club on the map', 'Show Example Knights Club on the map'])
    // Words in the order they come: the name, the city and region, the meeting time and the links.
    expect(spoken(cards[0])).toBe(`Example Chess ClubExample City, LA · Bayou Region${LONG_MEETING}Visit clubDirections ↗`)
    // A club with no meeting time has no meeting line, and one with no pin says so after its link.
    expect(spoken(cards[1])).toBe('Example Knights ClubExample Town, LAVisit clubNot on the map yet')
    expect(cards[1].querySelector('.lucide-calendar')).toBeNull()
    expect(screen.getByText('Example Chess Club').className).toBe('text-sm font-semibold leading-snug text-ink')
    expect(screen.getAllByRole('link', { name: 'Visit club' }).map((a) => a.getAttribute('href'))).toEqual(['/clubs/c1', '/clubs/c2'])
    expect(screen.getByRole('link', { name: 'Directions ↗' }).getAttribute('target')).toBe('_blank')
    // The count and the sort line above the list are as before.
    expect(screen.getByRole('heading', { level: 2, name: '2 clubs' })).toBeTruthy()
    expect(screen.getByText(/^Sorted A.Z$/)).toBeTruthy()
  })
})
