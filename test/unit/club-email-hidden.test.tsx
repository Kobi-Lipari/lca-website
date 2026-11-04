// @vitest-environment jsdom
//
// Today's club page with clubEmailHidden off and on (the Phase 0 trim, D29;
// assumed, Q14). Off, the page is as it was: the club's address in the
// header strip and as a mail link under Contact, both only when the club
// has one. On, both places offer "Contact this club through LCA", a link to
// the contact form, whether or not the answer carries an address, and the
// address is drawn nowhere, even from an answer that still carries it. The
// switch is flipped inside this one file, through a getter on the mocked
// FEATURES, so both sides are drawn from the same code.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClubDetail } from '@/lib/api'

const flags = vi.hoisted(() => ({ clubEmailHidden: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get clubEmailHidden() {
        return flags.clubEmailHidden
      },
    },
  }
})
const api = vi.hoisted(() => ({ getClub: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The map needs Google's script; the contact lines are what is read here.
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubDetailPage } = await import('@/pages/ClubDetailPage')

const ADDRESS = 'capital-club@example.org'
const LINK = 'Contact this club through LCA'

/** A made-up club with a meeting time, a place and an address. */
const CLUB: ApiClubDetail = {
  id: 'c1', name: 'Fixture Capital Chess Club', city: 'Baton Rouge', location: 'Fixture Community Center', description: 'A made-up club.',
  meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: ADDRESS, created_at: '2026-01-01 12:00:00', color: '#1f4e79',
  image_url: null, region: 'South Central Louisiana', latitude: null, longitude: null,
}

/** The club page for an answer whose club is `club`, with a stand-in contact page behind /contact. */
async function renderClubPage(club: Partial<ApiClubDetail> & { contact_email?: string | null }) {
  api.getClub.mockResolvedValue({
    club: { ...CLUB, ...club },
    officers: [{ role: 'president', full_name: 'Avery Fixture' }],
    tournaments: [],
    news: [],
  })
  render(
    <MemoryRouter initialEntries={['/clubs/c1']}>
      <Routes>
        <Route path="/clubs/:id" element={<ClubDetailPage />} />
        <Route path="/contact" element={<h1>Contact page</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Fixture Capital Chess Club' })
}

/** The answer as the server gives it once CLUB_EMAIL_HIDDEN is set: no contact_email key at all. */
function withoutAddress(): Partial<ApiClubDetail> {
  const club: Partial<ApiClubDetail> = { ...CLUB }
  delete club.contact_email
  return club
}

const hero = () => document.querySelector('section[data-ground="dark"]') as HTMLElement
const visitUs = () => screen.getByRole('heading', { level: 2, name: 'Visit us' }).closest('.rounded-xl') as HTMLElement

beforeEach(() => {
  api.getClub.mockReset()
})
afterEach(() => {
  cleanup()
  flags.clubEmailHidden = false
})

describe('today\'s club page with clubEmailHidden off', () => {
  it('draws the address in the header strip and as a mail link under Contact, as before', async () => {
    await renderClubPage({})
    expect(within(hero()).getByText(ADDRESS)).toBeTruthy()
    const mail = within(visitUs()).getByRole('link', { name: ADDRESS })
    expect(mail.getAttribute('href')).toBe(`mailto:${ADDRESS}`)
    expect(within(visitUs()).getByText('Contact')).toBeTruthy()
    expect(screen.queryByText(LINK)).toBeNull()
  })

  it('draws no contact line at all for a club without an address, as before', async () => {
    await renderClubPage({ contact_email: null })
    expect(within(visitUs()).queryByText('Contact')).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })
})

describe('today\'s club page with clubEmailHidden on', () => {
  it('offers the contact form in both places and draws the address nowhere, even when the answer still carries it', async () => {
    flags.clubEmailHidden = true
    await renderClubPage({})
    const links = screen.getAllByRole('link', { name: LINK })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link.getAttribute('href')).toBe('/contact')
    expect(within(hero()).getByRole('link', { name: LINK })).toBeTruthy()
    expect(within(visitUs()).getByRole('link', { name: LINK })).toBeTruthy()
    expect(within(visitUs()).getByText('Contact')).toBeTruthy()
    expect(document.body.textContent).not.toContain(ADDRESS)
    expect(document.body.innerHTML).not.toContain(ADDRESS)
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('offers the link for an answer with no contact_email key, as the server sends it once CLUB_EMAIL_HIDDEN is set', async () => {
    flags.clubEmailHidden = true
    await renderClubPage(withoutAddress())
    expect(screen.getAllByRole('link', { name: LINK })).toHaveLength(2)
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('offers the link for a club that never gave an address, since every club can be reached through LCA', async () => {
    flags.clubEmailHidden = true
    await renderClubPage({ contact_email: null })
    expect(screen.getAllByRole('link', { name: LINK })).toHaveLength(2)
  })

  it('takes the visitor to the contact form', async () => {
    flags.clubEmailHidden = true
    await renderClubPage({})
    fireEvent.click(within(visitUs()).getByRole('link', { name: LINK }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Contact page' })).toBeTruthy()
  })

  it('keeps the officers by role and name, with no email anywhere', async () => {
    flags.clubEmailHidden = true
    await renderClubPage({})
    expect(screen.getByText('Avery Fixture')).toBeTruthy()
    expect(screen.getByText('President')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/@example\.org/)
  })
})
