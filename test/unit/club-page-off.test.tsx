// @vitest-environment jsdom
//
// What ships with every switch off (WS09 step 21), held in src/App.tsx
// drawn whole, as a visitor gets it: with newClubs off, whether clubKeepers
// is off or on, /clubs/:id draws today's club page from today's answer and
// /clubs/suggest is today's "Club not found", and nothing asks the new
// page's answer. With newClubs on but newLook off the same holds, since the
// new page is drawn only with both. With both on, /clubs/:id draws the new
// page from its one answer, and /clubs/suggest goes to today's contact page
// until its own form is built. Each case sets the switches it reads through
// the mocked FEATURES. Every name, address and club here is made up.
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { CLUB_ID, CLUB_SLUG, bareAnswer, visitor } from './helpers/clubPageAnswer'

vi.setConfig({ testTimeout: 20000 })

const flags = vi.hoisted(() => ({ newClubs: false, newLook: false, clubKeepers: false, clubEmailHidden: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

/** Today's answer of GET /api/clubs/:id, for a made-up club. */
const TODAYS = {
  club: {
    id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: 'A made-up club.',
    meeting_schedule: 'Tuesdays at 7:00 PM', created_at: '2026-01-01 12:00:00', color: '#c8a94a', image_url: null, region: 'Bayou Region',
  },
  officers: [], tournaments: [], news: [],
}

let asked: string[] = []
let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  asked = []
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    if (url === `/api/clubs/${CLUB_ID}`) return new Response(JSON.stringify(TODAYS), { status: 200 })
    if (url === `/api/clubs/${CLUB_SLUG}/page` || url === `/api/clubs/${CLUB_ID}/page`) return new Response(JSON.stringify(bareAnswer()), { status: 200 })
    return new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  warn.mockRestore()
  vi.unstubAllGlobals()
})

/** Sets the switches a case reads. */
function set(on: Partial<typeof flags>) {
  Object.assign(flags, { newClubs: false, newLook: false, clubKeepers: false, clubEmailHidden: false }, on)
}

async function site(path: string, auth: AuthContextValue = visitor()) {
  await act(async () => {
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
}

const pageAsks = () => asked.filter((url) => /^\/api\/clubs\/[^/]+\/page$/.test(url))

/** Today's club page at /clubs/:id, from today's answer, with nothing asked of the new page. */
async function todaysPage() {
  await site(`/clubs/${CLUB_ID}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 10000 })).toBeTruthy()
  // Today's page: its hero's line, its sidebar and its tournaments heading.
  expect(screen.getByText('Example City, LA')).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Visit us' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: 'Upcoming tournaments' })).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
  expect(asked).toContain(`/api/clubs/${CLUB_ID}`)
  expect(pageAsks()).toEqual([])
}

/** Today's "Club not found" at /clubs/suggest, with nothing asked of the new page. */
async function todaysNotFound() {
  await site('/clubs/suggest')
  expect(await screen.findByRole('heading', { level: 1, name: 'Club not found' }, { timeout: 10000 })).toBeTruthy()
  expect(asked).toContain('/api/clubs/suggest')
  expect(pageAsks()).toEqual([])
}

describe('with every switch off, whatever clubKeepers holds', () => {
  it('draws today\'s club page at /clubs/:id from today\'s answer, and asks nothing of the new page, with clubKeepers unset', async () => {
    set({ clubKeepers: false })
    await todaysPage()
  })

  it('draws today\'s club page at /clubs/:id from today\'s answer, and asks nothing of the new page, with clubKeepers set', async () => {
    set({ clubKeepers: true, clubEmailHidden: true })
    await todaysPage()
  })

  it('draws today\'s "Club not found" at /clubs/suggest, with clubKeepers unset', async () => {
    set({ clubKeepers: false })
    await todaysNotFound()
  })

  it('draws today\'s "Club not found" at /clubs/suggest, with clubKeepers set', async () => {
    set({ clubKeepers: true, clubEmailHidden: true })
    await todaysNotFound()
  })

  it('keeps today\'s page with newClubs on while newLook is off, since the new page is drawn only with both', async () => {
    set({ newClubs: true, clubEmailHidden: true })
    await site(`/clubs/${CLUB_ID}`)
    expect(await screen.findByRole('heading', { name: 'Visit us' }, { timeout: 10000 })).toBeTruthy()
    expect(pageAsks()).toEqual([])
  })

  it('keeps today\'s page with newLook on while newClubs is off', async () => {
    set({ newLook: true })
    await site(`/clubs/${CLUB_ID}`)
    expect(await screen.findByRole('heading', { name: 'Visit us' }, { timeout: 10000 })).toBeTruthy()
    expect(pageAsks()).toEqual([])
  })
})

describe('with newClubs and newLook on', () => {
  it('draws the new club page at /clubs/:id from its one answer, and never today\'s', async () => {
    set({ newClubs: true, newLook: true, clubEmailHidden: true })
    await site(`/clubs/${CLUB_SLUG}`)
    expect(await screen.findByRole('navigation', { name: 'On this page' }, { timeout: 10000 })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Example Chess Club' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Visit us' })).toBeNull()
    expect(pageAsks()).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
    expect(asked).not.toContain(`/api/clubs/${CLUB_SLUG}`)
  })

  it('sends /clubs/suggest to today\'s contact page, and asks no club for it', async () => {
    set({ newClubs: true, newLook: true, clubEmailHidden: true })
    await site('/clubs/suggest')
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: /contact/i })).toBeTruthy(), { timeout: 10000 })
    expect(screen.queryByText('Club not found')).toBeNull()
    expect(asked.filter((url) => url.startsWith('/api/clubs/'))).toEqual([])
  })
})
