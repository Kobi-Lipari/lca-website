// @vitest-environment jsdom
//
// Today's club page at the edges of clubEmailHidden (the Phase 0 trim, D29;
// assumed, Q14), beside test/unit/club-email-hidden.test.tsx:
// - off, with an answer that has no contact_email key at all, as the server
//   sends it once CLUB_EMAIL_HIDDEN is set: no Contact line, no mail link,
//   no mail icon in the header strip and no stray word, as for a club that
//   gave no address;
// - on: the address is in no part of the document, its head and title
//   included; the two links stay on the site, in the same tab; and only the
//   contact line changes, the rest of the header strip and of the Visit us
//   card reading as they do with the switch off.
// The switch is flipped inside this file through a getter on the mocked
// FEATURES, so both sides are drawn from the same code.
import { cleanup, render, screen } from '@testing-library/react'
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

const ADDRESS = 'pelican-club@example.org'
const LINK = 'Contact this club through LCA'

/** A made-up club that meets on Thursday evenings and gave an address. */
const CLUB: ApiClubDetail = {
  id: 'c7', name: 'Fixture Pelican Chess Club', city: 'Lafayette', location: 'Fixture Library, Room 2', description: 'A made-up club.',
  meeting_schedule: 'Thursdays at 7:00 PM', contact_email: ADDRESS, created_at: '2026-01-01 12:00:00', color: '#7a1f1f',
  image_url: null, region: 'Acadiana', latitude: null, longitude: null,
}

/** The club's row as the server answers it once CLUB_EMAIL_HIDDEN is set: no contact_email key. */
function rowWithoutAddress(): ApiClubDetail {
  const club: ApiClubDetail = { ...CLUB }
  delete club.contact_email
  return club
}

async function renderClubPage(club: ApiClubDetail) {
  api.getClub.mockResolvedValue({ club, officers: [{ role: 'president', full_name: 'Avery Fixture' }], tournaments: [], news: [] })
  render(
    <MemoryRouter initialEntries={['/clubs/c7']}>
      <Routes>
        <Route path="/clubs/:id" element={<ClubDetailPage />} />
        <Route path="/contact" element={<h1>Contact page</h1>} />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { level: 1, name: CLUB.name })
}

const strip = () => document.querySelector('section[data-ground="dark"]') as HTMLElement
const visitUs = () => screen.getByRole('heading', { level: 2, name: 'Visit us' }).closest('.rounded-xl') as HTMLElement

beforeEach(() => {
  api.getClub.mockReset()
})
afterEach(() => {
  cleanup()
  flags.clubEmailHidden = false
})

describe('today\'s club page with clubEmailHidden off and an answer with no contact_email key', () => {
  it('draws no Contact line, no mail link, no mail icon in the strip and no stray word, as for a club that gave no address', async () => {
    await renderClubPage(rowWithoutAddress())
    expect(screen.queryByText('Contact')).toBeNull()
    expect(screen.queryByText(LINK)).toBeNull()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
    expect(strip().querySelector('.lucide-mail')).toBeNull()
    expect(document.body.textContent).not.toMatch(/undefined|null/)
    // The rest of the strip and the card are drawn as for any club.
    expect(strip().textContent).toContain('Lafayette, LA')
    expect(visitUs().textContent).toContain('Thursdays at 7:00 PM')
  })
})

describe('today\'s club page with clubEmailHidden on', () => {
  it('holds the address in no part of the document, its head and title included, from an answer that still carries it', async () => {
    flags.clubEmailHidden = true
    await renderClubPage(CLUB)
    expect(document.documentElement.outerHTML).not.toContain(ADDRESS)
    expect(document.title).not.toContain(ADDRESS)
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
  })

  it('keeps both links on the site and in the same tab: the contact form\'s own address, no new window', async () => {
    flags.clubEmailHidden = true
    await renderClubPage(CLUB)
    const links = screen.getAllByRole('link', { name: LINK })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute('href')).toBe('/contact')
      expect(link.getAttribute('target')).toBeNull()
    }
  })

  it('changes the contact line alone: the rest of the strip and of the Visit us card read as they do with the switch off', async () => {
    const read = () => ({ strip: strip().textContent ?? '', card: visitUs().textContent ?? '' })
    await renderClubPage(CLUB)
    const off = read()
    cleanup()
    flags.clubEmailHidden = true
    await renderClubPage(CLUB)
    const on = read()
    expect(off.strip).toContain(ADDRESS)
    expect(on.strip).toContain(LINK)
    expect(on.strip.replace(LINK, '<contact>')).toBe(off.strip.replace(ADDRESS, '<contact>'))
    expect(on.card.replace(LINK, '<contact>')).toBe(off.card.replace(ADDRESS, '<contact>'))
  })
})
