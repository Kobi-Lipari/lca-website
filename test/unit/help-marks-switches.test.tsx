// @vitest-environment jsdom
//
// What drawn bubbles follow, beside the list case that holds every sentence
// (help-marks-editor.test.tsx): each bubble is compared with the same
// bubble drawn under another choice, so a sentence that was to be one for
// every reader or every switch cannot have kept a second form, and the list's
// own few forms are the only ones. Also an observer's bubbles, the logo's and
// the color's words apart, My region's two readers, and the way a bubble's
// words are drawn (one paragraph of words, no list markup). Every name, club
// and address here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

const flags = vi.hoisted(() => ({ clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false }))
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
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { ClubEditor } = await import('@/areas/clubs/components/ClubEditor')
const { MyRegionPage } = await import('@/pages/MyRegionPage')

const CLUB = {
  id: 'example-knights-club', name: 'Example Knights Club', city: 'Example City', location: 'Example Library',
  description: 'Older words for the made-up club.', meeting_schedule: 'Mondays', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club for casual games.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }

interface Variant { own: boolean; emailHidden: boolean; pagesOn: boolean; showAdmin: boolean }
const BASE: Variant = { own: true, emailHidden: true, pagesOn: false, showAdmin: true }

function draw({ own, emailHidden, pagesOn, showAdmin }: Variant, viewOnly = false) {
  Object.assign(flags, { clubEmailHidden: emailHidden, newClubs: pagesOn, newLook: pagesOn })
  const role = viewOnly ? 'lca_observer' : showAdmin ? 'lca_admin' : 'club_rep'
  const auth = {
    user: { id: 'm1' }, member: { id: 'm1', role, club_id: own ? CLUB.id : null, full_name: 'Player One' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor club={CLUB as never} places={[PLACE] as never} own={own} isAdmin={showAdmin && !viewOnly} showAdminFields={showAdmin} viewOnly={viewOnly} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const marks = () => screen.getAllByRole('button', { name: /^Help: / })
const nameOf = (mark: HTMLElement) => (mark.getAttribute('aria-label') ?? '').replace(/^Help: /, '')
const bubbleOf = (mark: HTMLElement) => document.getElementById(mark.getAttribute('aria-controls') ?? '') as HTMLElement
/** Every mark in the form's order, as its name and its bubble's words. */
function drawn(variant: Variant, viewOnly = false): Array<[string, string]> {
  draw(variant, viewOnly)
  const out = marks().map((mark) => [nameOf(mark), bubbleOf(mark).textContent ?? ''] as [string, string])
  cleanup()
  return out
}
/** Where two drawings differ, by the mark's place in the form: its name, and its words. */
function differ(a: Array<[string, string]>, b: Array<[string, string]>) {
  expect(b.map(([name]) => name).length).toBe(a.map(([name]) => name).length)
  return a.flatMap(([name, words], i) => (name === b[i][0] && words === b[i][1] ? [] : [{ from: [name, words], to: b[i] }]))
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('what the editor\'s bubbles follow', () => {
  it('follows the hidden email for the email\'s words alone, and the new club pages for the color\'s words and the contact name\'s term alone', () => {
    for (const own of [true, false]) for (const showAdmin of [true, false]) {
      const base = { ...BASE, own, showAdmin }
      // The hidden email: one mark's words change, none other, and no name.
      const hiddenOn = drawn({ ...base, emailHidden: true })
      const hiddenOff = drawn({ ...base, emailHidden: false })
      const mail = differ(hiddenOn, hiddenOff)
      expect(mail.map((d) => d.from[0]), `own=${own} admin=${showAdmin}`).toEqual(['Email for messages'])
      expect(mail[0].to[0]).toBe('Email for messages')
      expect(mail[0].from[1]).toBe('LCA can reach the club at this address. Visitors never see it.')
      expect(mail[0].to[1]).toBe(`Messages for the club are sent to this address. Visitors can see it on ${own ? 'your' : 'the'} club's page.`)
      // The new club pages: the color's words, and the contact name's term over the same words.
      const pagesOff = drawn({ ...base, pagesOn: false })
      const pagesOn = drawn({ ...base, pagesOn: true })
      const pages = differ(pagesOff, pagesOn)
      expect(pages.map((d) => d.from[0]), `own=${own} admin=${showAdmin}`).toEqual(['Contact name', 'Club color'])
      expect(pages[0].to).toEqual(['Contact name shown on the page', 'The person a visitor should ask for.'])
      expect(pages[0].from[1]).toBe('The person a visitor should ask for.')
      expect(pages[1].from).toEqual(['Club color', 'The club\'s own color. A club with none shows LCA\'s gold.'])
      expect(pages[1].to).toEqual(['Club color', 'The club\'s own color. A club with none shows navy.'])
    }
  })

  it('follows the reader for the words that name the club, and the admin\'s fields for the name and address words and the one mark only they have', () => {
    const own = drawn({ ...BASE, own: true })
    const other = drawn({ ...BASE, own: false })
    // Every mark keeps its name and its place; the words that name "your club's" or "the club's" are the ones that differ.
    const named = differ(own, other).map((d) => d.from[0])
    const NOTICE = 'Today\'s page shows different words here'
    // The notice beside each of the three fields whose words differ reads the same sentence.
    expect(named).toEqual(['One sentence about the club', NOTICE, NOTICE, NOTICE, 'Name and address', 'Links', 'Save and publish'])
    for (const d of differ(own, other)) {
      expect(d.from[1], d.from[0]).toMatch(/your club's|Your club's/)
      expect(d.to[1], d.from[0]).toMatch(/the club's|The club's/)
      expect(d.to[1], d.from[0]).not.toMatch(/your club/i)
    }
    // The admin's fields: the one mark that only they have, and the pointer to an LCA admin that only the others have.
    const withAdmin = drawn({ ...BASE, showAdmin: true })
    const without = drawn({ ...BASE, showAdmin: false })
    expect(withAdmin.map(([name]) => name).filter((name) => !without.some(([n]) => n === name))).toEqual(['Club name, region and page address'])
    expect(without.map(([name]) => name).filter((name) => !withAdmin.some(([n]) => n === name))).toEqual([])
    const shared = withAdmin.filter(([name]) => name !== 'Club name, region and page address')
    const moved = differ(shared, without)
    expect(moved.map((d) => d.from[0])).toEqual(['Name and address'])
    expect(moved[0].to[1]).toBe(`${moved[0].from[1]} To change the name, the region or the web address, ask an LCA admin.`)
  })

  it('draws every bubble as words alone, one paragraph without list markup, and the same words each time a part is drawn', () => {
    draw(BASE)
    for (const mark of marks()) {
      const bubble = bubbleOf(mark)
      expect(bubble.querySelectorAll('ul, ol, li, dt, dd, table, a, button, img'), nameOf(mark)).toHaveLength(0)
      expect((bubble.textContent ?? '').trim(), nameOf(mark)).toBe(bubble.textContent)
      expect(bubble.textContent?.length, nameOf(mark)).toBeGreaterThan(0)
    }
    cleanup()
    expect(drawn(BASE)).toEqual(drawn(BASE))
  })

  it('opens an observer\'s bubbles to the same words an editor draws for the same choices', () => {
    for (const own of [true, false]) {
      const viewer = { ...BASE, own, showAdmin: true }
      expect(drawn(viewer, true), `own=${own}`).toEqual(drawn(viewer, false))
    }
  })

  it('keeps the logo\'s words and the color\'s words apart, each on its own mark, and the same when the logo is drawn without the admin\'s fields', () => {
    for (const showAdmin of [true, false]) {
      const off = drawn({ ...BASE, showAdmin, pagesOn: false })
      const on = drawn({ ...BASE, showAdmin, pagesOn: true })
      const find = (list: Array<[string, string]>, name: string) => list.filter(([n]) => n === name).map(([, words]) => words)
      expect(find(off, 'Logo'), `admin=${showAdmin}`).toEqual(['Choose a picture. It is fitted and saved right away, without pressing Save and publish.'])
      expect(find(on, 'Logo')).toEqual(find(off, 'Logo'))
      expect(find(off, 'Club color')).toEqual(['The club\'s own color. A club with none shows LCA\'s gold.'])
      expect(find(on, 'Club color')).toEqual(['The club\'s own color. A club with none shows navy.'])
    }
  })

  it('opens one bubble at a time and closes the open one on a second press, as before', () => {
    draw(BASE)
    const [first, second] = marks()
    fireEvent.click(first)
    expect(first.getAttribute('aria-expanded')).toBe('true')
    expect(bubbleOf(first).hidden).toBe(false)
    fireEvent.click(second)
    expect(first.getAttribute('aria-expanded')).toBe('false')
    expect(bubbleOf(first).hidden).toBe(true)
    expect(bubbleOf(second).hidden).toBe(false)
    fireEvent.click(second)
    expect(bubbleOf(second).hidden).toBe(true)
    expect(document.querySelectorAll('[data-slot="help-mark-bubble"]:not([hidden])')).toHaveLength(0)
  })
})

describe('what My region\'s bubbles follow', () => {
  const ANSWER = {
    clubs: [{
      id: 'c-knights', name: 'Example Knights Club', city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement: null,
      lastConfirmedAt: null, lastCheckWords: 'Not checked since Aug 2026', needsCheck: true, events: 1, openItems: [],
    }],
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 1 },
    regions: [{ region: 'Bayou Region', keepers: [] }],
  }
  async function region(role: 'member' | 'lca_admin'): Promise<Array<[string, string]>> {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/workspace/region'
      ? new Response(JSON.stringify(ANSWER), { status: 200 })
      : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }))))
    const auth = {
      user: { id: 'm-one' }, session: null, role, member: { id: 'm-one', role, club_id: null, full_name: 'Player One' }, loading: false, memberLoading: false,
      seats: role === 'member' ? [{ id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }] : [],
      managedClubs: [], isBoardMember: role === 'member', assuranceLevel: 'aal1', mfaRequired: false, directedTournamentIds: [], directedTournaments: [],
    } as unknown as AuthContextValue
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/workspace/region']}><MyRegionPage /></MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
    await act(async () => {})
    const out = marks().map((mark) => [nameOf(mark), (bubbleOf(mark).textContent ?? '').replace(/\s+/g, ' ')] as [string, string])
    cleanup()
    return out
  }

  it('differs between a representative and an LCA admin in the words of "What this page is" alone, which is in the Clubs mark, and keeps the three marks\' names', async () => {
    const rep = await region('member')
    const admin = await region('lca_admin')
    expect(rep.map(([name]) => name)).toEqual(['This month', 'Confirm all still accurate', 'Clubs'])
    expect(admin.map(([name]) => name)).toEqual(['This month', 'Confirm all still accurate', 'Clubs'])
    expect(rep[0]).toEqual(admin[0])
    expect(rep[1]).toEqual(admin[1])
    expect(rep[2][1]).toContain('A card for each club in your region, with when its listing was last checked.')
    expect(admin[2][1]).toContain('A card for each club, in every region, with when its listing was last checked.')
    expect(rep[2][1].replace('A card for each club in your region', 'A card for each club, in every region')).toBe(admin[2][1])
    // The marks' words are plain: the monthly check's day, and the 90 days.
    expect(rep[0][1]).toContain('The day the next monthly check is due.')
    expect(rep[0][1]).toContain('A club needs a check when nobody has pressed Still accurate or saved its listing in the last 90 days. Those clubs come first.')
    expect(rep[1][1]).toBe('Marks every club that needs a check as still accurate, after asking you once. A club that cannot be marked is named and left as it was.')
  })
})
