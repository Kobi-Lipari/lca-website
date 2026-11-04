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
//
// WS02 step 3 gives the gold ground a marker of its own, data-ring-ground
// ="gold", so under the new look the ring there is navy in dark mode too:
// on the gold tone and on a tone the banner does not know, which it draws
// gold, and on the impersonation banner, whose Exit button sits inside it.
// It is not data-ground, so every data-ground above stays as it was.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'

const api = vi.hoisted(() => ({ getAnnouncements: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { AnnouncementBanner } = await import('@/components/AnnouncementBanner')
const { ImpersonationBanner } = await import('@/components/ImpersonationBanner')
const { AuthContext } = await import('@/contexts/auth-context')

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

describe('the gold ground\'s own marker (WS02 step 3)', () => {
  it.each([
    ['gold', 'Registration for the Fixture Open closes Friday, October 23 at 7:00 PM.', 'gold', null],
    ['an unknown tone', 'A tone the banner does not know.', 'gold', null],
    ['navy', 'The Fixture Quads are full.', null, null],
    ['urgent', 'The Fixture Open is cancelled for weather.', null, 'dark'],
    ['info', 'Pairings go up Saturday, October 24 at 9:00 AM.', null, 'dark'],
  ])('the %s tone carries data-ring-ground %j, and data-ground %j as before', async (_, message, ring, ground) => {
    render(<AnnouncementBanner />)
    const el = await bannerOf(message)
    expect(el.getAttribute('data-ring-ground')).toBe(ring)
    expect(el.getAttribute('data-ground')).toBe(ground)
  })

  it('holds the gold tones\' link and dismiss button inside the marked element, and keeps their classes', async () => {
    render(<AnnouncementBanner />)
    for (const [message, id] of [['closes Friday', 'fx-ann-gold'], ['does not know', 'fx-ann-unknown']] as const) {
      const el = await bannerOf(message)
      expect(el.getAttribute('data-ring-ground')).toBe('gold')
      expect(el.contains(screen.getByRole('link', { name: `More about ${id}` }))).toBe(true)
      expect(el.contains(screen.getByRole('button', { name: `Dismiss: More about ${id}` }))).toBe(true)
      expect(el.className).toContain('bg-lca-gold text-brand-navy')
    }
    // No element carries both markers.
    expect(document.querySelectorAll('[data-ring-ground][data-ground]')).toHaveLength(0)
  })

  it('marks the impersonation banner\'s gold root, with the Exit button inside it and its classes as they were', () => {
    const exit = vi.fn(async () => {})
    const auth = {
      user: null, session: null, member: null, role: 'lca_admin', seats: [], managedClubs: [], isBoardMember: false,
      assuranceLevel: 'aal2', mfaRequired: false, loading: false, directedTournamentIds: [], signOut: async () => {},
      impersonating: { id: 'fx-m-p5', fullName: 'Riley Fixture', email: 'riley.fixture@example.org' },
      exitImpersonation: exit,
    } as unknown as AuthContextValue
    const { container } = render(
      <AuthContext.Provider value={auth}>
        <ImpersonationBanner />
      </AuthContext.Provider>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute('data-ring-ground')).toBe('gold')
    expect(root.getAttribute('data-ground')).toBeNull()
    expect(root.className).toBe('flex items-center justify-center gap-3 bg-lca-gold px-4 py-2 text-sm font-medium text-brand-navy')
    expect(within(root).getByText('Viewing as Riley Fixture (riley.fixture@example.org)')).toBeTruthy()
    const button = within(root).getByRole('button', { name: 'Exit' })
    expect(button.className).toContain('hover:bg-brand-navy/10')
    fireEvent.click(button)
    expect(exit).toHaveBeenCalledTimes(1)
  })

  it('draws no impersonation banner, and so no marker, when no one is being viewed as', () => {
    const auth = { impersonating: null, exitImpersonation: async () => {} } as unknown as AuthContextValue
    const { container } = render(
      <AuthContext.Provider value={auth}>
        <ImpersonationBanner />
      </AuthContext.Provider>,
    )
    expect(container.innerHTML).toBe('')
  })
})
