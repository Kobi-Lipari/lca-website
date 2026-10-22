// @vitest-environment jsdom
//
// The announcement banner's dark-ground markers (src/components/AnnouncementBanner.tsx).
// Step 23 marks the urgent and info tones data-ground="dark", so under the
// new look the focus ring on their link and dismiss button turns gold (the
// rule in src/index.css). The gold tone stays unmarked (a light ground, with
// the navy ring), the navy tone needs no marker (its bg-brand-navy box is
// in the ring rule), and a tone the banner does not know falls back to gold.
// The link and the dismiss button sit inside the marked element, where the
// rule reaches them.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ getAnnouncements: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { AnnouncementBanner } = await import('@/components/AnnouncementBanner')

const banner = (id: string, tone: string, message: string) => ({
  id, tone, size: 'default', message, linkUrl: '/tournaments', linkLabel: `More about ${id}`,
})

const ANNOUNCEMENTS = [
  banner('fx-ann-gold', 'gold', 'Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.'),
  banner('fx-ann-navy', 'navy', 'The Fixture Quads are full.'),
  banner('fx-ann-urgent', 'urgent', 'The Fixture Open is cancelled for weather.'),
  banner('fx-ann-info', 'info', 'Pairings go up Saturday, October 24 at 9:00 AM.'),
  banner('fx-ann-unknown', 'teal', 'A tone the banner does not know.'),
]

beforeEach(() => {
  sessionStorage.clear()
  api.getAnnouncements.mockReset()
  api.getAnnouncements.mockResolvedValue({ announcements: ANNOUNCEMENTS })
})
afterEach(cleanup)

/** The banner element that holds a message. */
const bannerOf = async (message: string) => (await screen.findByText(message, { exact: false })).closest('div') as HTMLElement

describe('the announcement banner on a dark ground', () => {
  it.each([
    ['urgent', 'The Fixture Open is cancelled for weather.', 'dark'],
    ['info', 'Pairings go up Saturday, October 24 at 9:00 AM.', 'dark'],
    ['gold', 'Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.', null],
    ['navy', 'The Fixture Quads are full.', null],
    ['an unknown tone', 'A tone the banner does not know.', null],
  ])('the %s tone is marked %s', async (_, message, ground) => {
    render(<AnnouncementBanner />)
    const el = await bannerOf(message)
    expect(el.getAttribute('data-ground')).toBe(ground)
  })

  it('the dark tones keep white text on their own grounds, the gold and unknown tones navy text on gold', async () => {
    render(<AnnouncementBanner />)
    expect((await bannerOf('cancelled for weather')).className).toContain('bg-[#9b1c1c] text-white')
    expect((await bannerOf('Pairings go up')).className).toContain('bg-[#1e4d7b] text-white')
    expect((await bannerOf('Fixture Quads')).className).toContain('bg-brand-navy text-white')
    expect((await bannerOf('closes Friday')).className).toContain('bg-lca-gold text-brand-navy')
    expect((await bannerOf('does not know')).className).toContain('bg-lca-gold text-brand-navy')
  })

  it('holds its link and its dismiss button inside the marked element, where the ring rule reaches them', async () => {
    render(<AnnouncementBanner />)
    for (const message of ['cancelled for weather', 'Pairings go up']) {
      const el = await bannerOf(message)
      const id = message.startsWith('cancelled') ? 'fx-ann-urgent' : 'fx-ann-info'
      expect(el.contains(screen.getByRole('link', { name: `More about ${id}` }))).toBe(true)
      expect(el.contains(screen.getByRole('button', { name: `Dismiss: More about ${id}` }))).toBe(true)
    }
  })

  it('dismissing a marked banner removes it and leaves the others', async () => {
    render(<AnnouncementBanner />)
    await bannerOf('cancelled for weather')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: More about fx-ann-urgent' }))
    expect(screen.queryByText('cancelled for weather', { exact: false })).toBeNull()
    expect((await bannerOf('Pairings go up')).getAttribute('data-ground')).toBe('dark')
  })
})
