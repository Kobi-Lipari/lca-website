// @vitest-environment jsdom
//
// The edges of the page that chooses what /clubs draws (WS09 step 33), beside
// test/unit/clubs-index-page.test.tsx: an empty answer, an answer of mixed
// rows, a list that fails again on Try again, an answer that comes after the
// visitor has left, and the words shown while the list is on its way (never
// an endless spinner: the status is always words). Every club here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAILED, LOADING, NO_CLUBS, TRY_AGAIN } from '@/areas/clubs/directoryWords'

const api = vi.hoisted(() => ({ getClubs: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { ClubsIndexPage } = await import('@/pages/ClubsIndexPage')

const TODAY = { id: 'c1', name: 'Example Chess Club', city: 'Example City', meeting_schedule: 'Tuesdays, 7:00 PM', color: '#1f4e79', image_url: null, region: 'North Louisiana', latitude: 32.5, longitude: -92.1 }
const WIDE = { ...TODAY, id: 'c2', name: 'Example Rooks Club', slug: 'example-rooks-club', statement: 'Mondays at 6:30 PM.', description: null, point: null, weekend_play: false, scholastic_friendly: false }

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  api.getClubs.mockReset()
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

function draw() {
  return render(
    <MemoryRouter initialEntries={['/clubs']}>
      <Routes><Route path="/clubs" element={<ClubsIndexPage />} /></Routes>
    </MemoryRouter>,
  )
}

describe('what /clubs draws for an answer that is not the usual one', () => {
  it('draws the directory\'s one sentence for an empty answer, with the one heading', async () => {
    api.getClubs.mockResolvedValue([])
    draw()
    expect(await screen.findByText(NO_CLUBS)).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('draws today\'s Clubs page whole when even one row is today\'s, never a directory with a gap in it', async () => {
    api.getClubs.mockResolvedValue([WIDE, TODAY])
    draw()
    expect(await screen.findByRole('heading', { level: 1, name: 'Find your chess community' })).toBeTruthy()
    expect(screen.queryByText('Chess clubs in Louisiana')).toBeNull()
  })
})

describe('the words while the list is on its way', () => {
  it('says "Loading the clubs..." in words as a status, with no button, and then replaces it with the page', async () => {
    let answer: (rows: unknown[]) => void = () => {}
    api.getClubs.mockReturnValue(new Promise((done) => { answer = done }))
    draw()
    const status = screen.getByRole('status')
    expect(status.textContent).toBe(LOADING)
    expect(screen.queryByRole('button')).toBeNull()
    await act(async () => { answer([WIDE]) })
    expect(await screen.findByRole('heading', { level: 1, name: 'Chess clubs in Louisiana' })).toBeTruthy()
    expect(screen.queryByText(LOADING)).toBeNull()
  })

  it('names the failure in words with the one heading and Try again, and keeps asking in words when the list fails again', async () => {
    api.getClubs.mockRejectedValue(new Error('Example failure'))
    draw()
    expect(await screen.findByText(FAILED)).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: TRY_AGAIN }))
    expect(screen.getByRole('status').textContent).toBe(LOADING)
    expect(await screen.findByText(FAILED)).toBeTruthy()
    expect(api.getClubs).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Example failure')).toBeNull()
  })
})

describe('a visitor who leaves before the answer comes', () => {
  it('changes nothing and logs nothing when the answer comes, or fails, after the page is gone', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    let answer: (rows: unknown[]) => void = () => {}
    let fail: (e: Error) => void = () => {}
    api.getClubs.mockReturnValueOnce(new Promise((done) => { answer = done })).mockReturnValueOnce(new Promise((_, reject) => { fail = reject }))
    const first = draw()
    first.unmount()
    await act(async () => { answer([WIDE]) })
    const second = draw()
    second.unmount()
    await act(async () => { fail(new Error('Example failure')) })
    expect(document.body.textContent).toBe('')
    expect(errors).not.toHaveBeenCalled()
  })
})
