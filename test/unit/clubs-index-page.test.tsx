// @vitest-environment jsdom
//
// Which page /clubs draws (WS09 step 33). src/App.tsx routes /clubs to
// src/pages/ClubsIndexPage.tsx only while clubPagesOn() is true, and to
// today's ClubsPage otherwise; the choosing page asks for the list once,
// through getClubsFromOrigin() (getClubs() with only the site's origin as
// the referrer, since checkpoint Y's review), and draws the directory only when the answer has the
// directory's shape (the server's CLUB_PAGES_ON set), and today's ClubsPage,
// whole, when it is today's. A list that fails or is slow says so in words
// with a way to try again. The directory and the choosing page are reached
// only through lazy imports, so the page drawn with the switches as they
// ship never fetches them. Every club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAILED, LOADING, SLOW, SLOW_AFTER_MS, TRY_AGAIN } from '@/areas/clubs/directoryWords'
import { directoryRowsOf, isDirectoryRow } from '@/areas/clubs/directoryRows'

const api = vi.hoisted(() => ({ getClubsFromOrigin: vi.fn(), getClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { ClubsIndexPage } = await import('@/pages/ClubsIndexPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** One made-up club in today's shape, and the same club in the directory's. */
const TODAY = { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM', color: '#1f4e79', image_url: null, region: 'North Louisiana', latitude: 32.5, longitude: -92.1 }
const WIDE = { ...TODAY, slug: 'example-chess-club', statement: 'Tuesdays at 7:00 PM.', description: null, point: { latitude: 32.5, longitude: -92.1 }, weekend_play: true, scholastic_friendly: false }

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubsFromOrigin.mockReset()
  api.getClubs.mockReset()
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

function draw() {
  return render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsIndexPage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('the page /clubs draws while the new club pages are on', () => {
  it('draws the directory when the answer has the directory\'s shape, asking for the list once', async () => {
    api.getClubsFromOrigin.mockResolvedValue([WIDE])
    draw()
    expect(await screen.findByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
    expect(screen.queryByText('Find your chess community')).toBeNull()
    expect(api.getClubsFromOrigin).toHaveBeenCalledTimes(1)
  })

  it('draws today\'s Clubs page whole when the answer is today\'s, as with the client\'s switches on and the server\'s unset', async () => {
    api.getClubsFromOrigin.mockResolvedValue([TODAY])
    // Today's page asks for the list itself, through getClubs(), as it always has.
    api.getClubs.mockResolvedValue([TODAY])
    draw()
    expect(await screen.findByRole('heading', { level: 1, name: 'Find your chess community' })).toBeTruthy()
    await screen.findByText('Example Chess Club')
    expect(screen.queryByText('Chess clubs in Louisiana')).toBeNull()
    expect(document.querySelector('[data-slot="club-directory"]')).toBeNull()
  })

  it('says in words when the list fails, and asks again on Try again', async () => {
    api.getClubsFromOrigin.mockRejectedValueOnce(new Error('Example failure')).mockResolvedValue([WIDE])
    draw()
    expect(await screen.findByText(FAILED)).toBeTruthy()
    expect(screen.queryByText('Example failure')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: TRY_AGAIN }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
    expect(api.getClubsFromOrigin).toHaveBeenCalledTimes(2)
  })

  it('says in words when the list is slow, with the same way to ask again, and never only a spinner', async () => {
    vi.useFakeTimers()
    let answer: (rows: unknown[]) => void = () => {}
    api.getClubsFromOrigin.mockReturnValueOnce(new Promise((done) => { answer = done })).mockResolvedValue([WIDE])
    draw()
    expect(screen.getByRole('status').textContent).toBe(LOADING)
    await act(async () => { vi.advanceTimersByTime(SLOW_AFTER_MS - 1) })
    expect(screen.queryByText(SLOW)).toBeNull()
    await act(async () => { vi.advanceTimersByTime(1) })
    expect(screen.getByText(SLOW)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: TRY_AGAIN }))
    vi.useRealTimers()
    expect(await screen.findByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
    // The first, slow answer, once it comes, changes nothing.
    await act(async () => { answer([TODAY]) })
    expect(screen.getByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
  })
})

describe('telling the two answers apart', () => {
  it('takes a row as the directory\'s only with each of its keys of its kind, and an empty list as the directory\'s', () => {
    expect(isDirectoryRow(WIDE)).toBe(true)
    expect(isDirectoryRow({ ...WIDE, point: null, statement: null, description: 'A made-up club.' })).toBe(true)
    expect(isDirectoryRow(TODAY)).toBe(false)
    for (const key of ['slug', 'statement', 'description', 'point', 'weekend_play', 'scholastic_friendly'] as const) {
      const rest: Record<string, unknown> = { ...WIDE }
      delete rest[key]
      expect(isDirectoryRow(rest), key).toBe(false)
    }
    expect(isDirectoryRow({ ...WIDE, point: { latitude: '32.5', longitude: -92.1 } })).toBe(false)
    expect(isDirectoryRow({ ...WIDE, weekend_play: 1 })).toBe(false)
    expect(directoryRowsOf([WIDE, TODAY])).toBeNull()
    expect(directoryRowsOf([WIDE])).toEqual([WIDE])
    expect(directoryRowsOf([])).toEqual([])
  })
})

describe('the page drawn with either switch off', () => {
  it('is today\'s ClubsPage, routed by App, with the choosing page and the directory reached only through lazy imports', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('<Route path="/clubs" element={clubPagesOn() ? <ClubsIndexPage /> : <ClubsPage />} />')
    expect(app).toContain('const ClubsIndexPage = lazy(() => import(\'@/pages/ClubsIndexPage\').then(m => ({ default: m.ClubsIndexPage })))')
    expect(app).not.toMatch(/^import .*ClubsIndexPage/m)
    const page = read('src/pages/ClubsIndexPage.tsx')
    expect(page).toContain('lazy(() => import(\'@/areas/clubs/components/ClubDirectory\')')
    expect(page).not.toMatch(/^import .*components\/ClubDirectory/m)
    expect(read('src/areas/clubs/components/LCAMap.tsx')).toContain('const DirectoryMap = lazy(() => import(\'@/areas/clubs/components/DirectoryMap\'))')
    // Today's Clubs page names none of the directory's files.
    expect(read('src/pages/ClubsPage.tsx')).not.toMatch(/ClubsIndexPage|ClubDirectory|DirectoryMap|directoryPins|directoryWords|directoryRows|ClubCard'/)
  })
})
