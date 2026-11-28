// @vitest-environment jsdom
//
// What K's look at the test site asked of the new club page (K's decision
// 12, checkpoint W), as the page draws it. Who keeps a club is not shown:
// for a visitor, a plain member, another club's rep, an LCA admin who keeps
// no club and another region's representative there is no band under the
// cover at all, with clubKeepers on or off, and the cover is followed by the
// section nav. A signed-in keeper with clubKeepers on still reads their own
// line with Edit, drawn where it was and in the same band; with clubKeepers
// off they read none. The told line reads "Last checked" and its month as
// the answer gives it, under the meeting words, and with no month there is
// no line. The editor's preview draws neither line. With every switch off
// the new page is not drawn and its answer is not asked. Each case sets the
// switches it reads through the mocked FEATURES. The page is drawn through
// the real client, with fetch stubbed. Every name, address and club here is
// made up.
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { CONTROLS_CLEAR_OF_BARS } from '@/areas/clubs/clubPage'
import { PagePreview } from '@/areas/clubs/components/PagePreview'
import type { ClubPageResponse } from '@domain/contracts'
import { CLUB_ID, CLUB_SLUG, STATEMENT, bareAnswer, clubRep, fullAnswer, plainMember, regionRep, visitor } from './helpers/clubPageAnswer'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ newClubs: true, newLook: true, clubKeepers: false, clubEmailHidden: true }))
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
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => <div data-testid="club-map" /> }))

const { ClubListingPage } = await import('@/pages/ClubListingPage')
const { default: App } = await import('@/App')

let answer: ClubPageResponse = fullAnswer()
const asked: string[] = []
beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, clubKeepers: false, clubEmailHidden: true })
  answer = fullAnswer()
  asked.length = 0
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    if (url === `/api/clubs/${CLUB_SLUG}/page`) return new Response(JSON.stringify(answer), { status: 200 })
    return new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** An LCA admin who keeps no club of their own. */
const admin = (): AuthContextValue => ({
  ...plainMember(),
  user: { id: 'm-four' } as never,
  role: 'lca_admin',
  member: { id: 'm-four', role: 'lca_admin', club_id: null, full_name: 'Player Four' } as never,
})
/** A representative whose seat covers another region's clubs. */
const otherRegionRep = (): AuthContextValue => ({ ...regionRep(), managedClubs: [{ id: 'c-another-club', name: 'Another Example Club', region: 'Example North' }] as never })

async function draw(auth: AuthContextValue = visitor()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}>
        <Routes><Route path="/clubs/:id" element={<ClubListingPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
  await act(async () => {})
  return document.querySelector<HTMLElement>('[data-slot="club-page"]')!
}

/** The wrapper over the breadcrumb, the cover and, for a keeper, the band under it. */
const top = (page: HTMLElement) => [...page.children].find((el) => el.className === CONTROLS_CLEAR_OF_BARS) as HTMLElement
/** The band's own box: the edge and ground it was drawn with. */
const BAND = 'div.border-b.border-hairline.bg-surface-2'

describe('who keeps a club is not shown', () => {
  it('draws no band for a visitor, a plain member, another club\'s rep, an LCA admin who keeps no club and another region\'s representative, with clubKeepers on or off', async () => {
    for (const keepers of [true, false]) {
      flags.clubKeepers = keepers
      for (const auth of [visitor(), plainMember(), clubRep('c-another-club'), admin(), otherRegionRep()]) {
        const page = await draw(auth)
        const wrapper = top(page)
        // The breadcrumb and the cover, and nothing under them: no empty bar, no edge and no ground left behind.
        expect(wrapper.children, auth.role).toHaveLength(2)
        expect(wrapper.querySelector(BAND)).toBeNull()
        expect(wrapper.querySelector('.mt-6')).toBeNull()
        expect(wrapper.nextElementSibling?.querySelector('nav[aria-label="On this page"]') ?? wrapper.nextElementSibling).toBeTruthy()
        expect(page.textContent).not.toMatch(/Kept by|named a rep|LCA admins|This is your club's page|You can edit this page/)
        expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
        cleanup()
      }
    }
  })
})

describe('the keeper\'s own line', () => {
  it('tells the club\'s own rep this is their club\'s page, with Edit, in the band where it stood, with clubKeepers on', async () => {
    flags.clubKeepers = true
    const page = await draw(clubRep())
    const wrapper = top(page)
    expect(wrapper.children).toHaveLength(3)
    const band = wrapper.lastElementChild!
    expect(band.className).toBe('mt-6')
    expect(band.firstElementChild?.className).toBe('border-b border-hairline bg-surface-2')
    expect(band.firstElementChild?.firstElementChild?.className).toBe('mx-auto flex min-h-11 max-w-6xl flex-wrap items-center gap-x-3 gap-y-0 px-4 py-1 text-sm text-ink sm:px-6')
    expect((band.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('This is your club\'s page·Edit')
    expect(within(band as HTMLElement).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`/my/club/${CLUB_SLUG}`)
    expect(page.textContent).not.toMatch(/Kept by/)
  })

  it('tells the region\'s representative they can edit it as that region\'s representative, with Edit, with clubKeepers on', async () => {
    flags.clubKeepers = true
    const page = await draw(regionRep())
    const band = top(page).lastElementChild as HTMLElement
    expect(band.querySelector(BAND)).toBeTruthy()
    expect(within(band).getByText('You can edit this page as the Bayou Region representative')).toBeTruthy()
    expect(within(band).getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`/workspace/region/clubs/${CLUB_ID}`)
    expect(page.textContent).not.toMatch(/Kept by/)
  })

  it('draws no band for the rep or the representative with clubKeepers off', async () => {
    flags.clubKeepers = false
    for (const auth of [clubRep(), regionRep()]) {
      const page = await draw(auth)
      expect(top(page).children).toHaveLength(2)
      expect(top(page).querySelector(BAND)).toBeNull()
      expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
      cleanup()
    }
  })
})

describe('Last checked', () => {
  it('draws the month the answer gives straight under the meeting words', async () => {
    const page = await draw()
    const where = within(page).getByRole('heading', { level: 2, name: 'When and where Example Chess Club meets' }).closest('section')!
    const line = within(where).getByText('Last checked October 2026')
    expect(line.previousElementSibling?.tagName).toBe('FIGURE')
    expect(page.textContent).not.toMatch(/As told/)
  })

  it('draws no line, and nothing in its place, when the answer gives no month', async () => {
    answer = { ...bareAnswer(), statement: { text: STATEMENT, told: '' } }
    const page = await draw()
    const quote = page.querySelector('#when-and-where figure')!
    expect(quote.parentElement?.children).toHaveLength(1)
    expect(page.textContent).not.toMatch(/Last checked|As told|Invalid/)
  })

  it('the editor\'s preview draws neither line and no band', () => {
    const values = {
      name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', aboutText: 'A made-up club.', howWeMeetText: STATEMENT,
      placeName: 'Example Library', placeStreet: '', placeNote: '', place2Name: '', place2Street: '', place2Note: '', costText: '', welcomeText: '',
      facebookUrl: '', websiteUrl: '', otherUrl: '', weekendPlay: false, scholasticFriendly: false,
    }
    const view = render(
      <MemoryRouter>
        <PagePreview own clubId={CLUB_ID} address={CLUB_SLUG} values={values} colour={null} logo={null} point={null} point2={null} second={false} />
      </MemoryRouter>,
    )
    const preview = view.container.querySelector<HTMLElement>('[data-slot="page-preview"]')!
    expect(preview.querySelector('blockquote')?.textContent).toBe(STATEMENT)
    expect(preview.textContent).not.toMatch(/Last checked|Kept by|As told|This is your club's page/)
    expect(preview.querySelector(BAND)).toBeNull()
  })
})

describe('what ships with every switch off', () => {
  it('draws no new page and asks nothing of its answer, so neither line can show', async () => {
    Object.assign(flags, { newClubs: false, newLook: false, clubKeepers: false })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await act(async () => {
      render(
        <AuthContext.Provider value={visitor()}>
          <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}>
            <App />
          </MemoryRouter>
        </AuthContext.Provider>,
      )
    })
    // src/App.tsx draws today's club page, which asks today's answer; this stub gives none, so it says so in its own words.
    await waitFor(() => expect(asked).toContain(`/api/clubs/${CLUB_SLUG}`), { timeout: 10000 })
    await act(async () => {})
    expect(document.querySelector('[data-slot="club-page"]')).toBeNull()
    expect(asked.some((url) => url.endsWith('/page'))).toBe(false)
    expect(document.body.textContent).not.toMatch(/Last checked/)
  })
})
