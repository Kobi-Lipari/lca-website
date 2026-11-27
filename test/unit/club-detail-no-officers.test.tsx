// @vitest-environment jsdom
//
// Today's club page, the one reader in src/ of the officers in today's
// public club answer (WS09 step 37). With CLUB_PAGES_ON set the server
// answers an empty officers list; the page then draws no Officers block, no
// heading and no list, and the rest of the page as it does for a club with
// no officers today. With officers in the answer the block is drawn as
// today. The page draws the list it is given, so no switch is read here.
// Every club and name is made up.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDetail } from '@/lib/api'

const api = vi.hoisted(() => ({ getClub: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubDetailPage } = await import('@/pages/ClubDetailPage')

const CLUB: ApiClubDetail = {
  id: 'c1', name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: 'A made up club.',
  meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#1f4e79',
  image_url: null, region: 'Bayou Region', latitude: null, longitude: null,
}

async function openClub(officers: Array<{ id: string; role: string; full_name: string }>): Promise<string> {
  api.getClub.mockResolvedValue({ club: CLUB, officers, tournaments: [], news: [] })
  render(
    <MemoryRouter initialEntries={['/clubs/c1']}>
      <Routes><Route path="/clubs/:id" element={<ClubDetailPage />} /></Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
  return screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent ?? '').join(' | ')
}

beforeEach(() => api.getClub.mockReset())
afterEach(cleanup)

describe('today\'s club page with the officers list empty and filled', () => {
  it('draws no Officers block for an empty list, and the rest of the page\'s headings as with officers', async () => {
    const withOfficers = await openClub([{ id: 'officer-1', role: 'president', full_name: 'Player One' }])
    expect(withOfficers).toContain('Officers')
    expect(screen.getByText('Player One')).toBeTruthy()
    cleanup()
    const without = await openClub([])
    expect(without).not.toContain('Officers')
    expect(screen.queryByText('Player One')).toBeNull()
    expect(without).toBe(withOfficers.split(' | ').filter((h) => h !== 'Officers').join(' | '))
  })
})
