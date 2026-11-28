// @vitest-environment jsdom
//
// The edges of the rest of the new club page (WS09 step 22): dates on the
// days the clocks change in Louisiana and across midnight in Central time,
// whatever zone the visitor's device is in; ties in dates and names, which
// keep the answer's order; more than three nearest clubs; an event whose
// address needs encoding; a count past its limit; markup in a name, which is
// text; a section the answer does not name; Copy link pressed again and again;
// the page opened at one club and then another, which leaves nothing of the
// first; and the page's blocks with every switch off, whatever clubKeepers
// holds. Each case sets the switches it reads through the mocked FEATURES.
// Every name, address and club here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import { ClubPage, ClubPageView } from '@/areas/clubs/components/ClubPage'
import { NearbyClubs } from '@/areas/clubs/components/NearbyClubs'
import { eventAddress, eventCount, eventState } from '@/areas/clubs/clubPageRows'
import type { ClubPageEvent, ClubPageResponse } from '@domain/contracts'
import { CLUB_ID, CLUB_SLUG, fullAnswer, visitor } from './helpers/clubPageAnswer'
import { NEAREST, OPEN_EVENT, restAnswer } from './helpers/clubPageRest'

vi.setConfig({ testTimeout: 20000 })

const flags = vi.hoisted(() => ({ newClubs: true, newLook: true, newNav: false, clubKeepers: false }))
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

beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, newNav: false, clubKeepers: false })
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const wordsOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()
const event = (over: Partial<ClubPageEvent>): ClubPageEvent => ({ ...OPEN_EVENT, ...over })

function draw(answer: ClubPageResponse) {
  const view = render(<MemoryRouter><ClubPageView answer={answer} keeper={null} /></MemoryRouter>)
  return view.container.querySelector<HTMLElement>('[data-slot="club-page"]')!
}
const eventLines = (page: HTMLElement) => [...page.querySelectorAll('#events [data-slot="club-event"]')].map((row) => row.querySelector('h3 + p')?.textContent)
const eventDays = (page: HTMLElement) => [...page.querySelectorAll('#events time')].map((t) => t.getAttribute('dateTime'))
const newsLines = (page: HTMLElement) => [...page.querySelectorAll('#news [data-slot="club-news"]')].map((row) => row.querySelector('h3 + p')?.textContent ?? null)

describe('dates on the days the clocks change, and across midnight, in Central time', () => {
  it('gives the right weekday to an event on each day the clocks change, and to one that runs across it', () => {
    // 2026: the clocks go forward on Sunday, March 8, and back on Sunday, November 1.
    const page = draw(restAnswer({ events: [
      event({ id: 'e-spring', date: '2026-03-08', end_date: null }),
      event({ id: 'e-fall', date: '2026-11-01', end_date: null }),
      event({ id: 'e-across-spring', date: '2026-03-07', end_date: '2026-03-08' }),
      event({ id: 'e-across-fall', date: '2026-10-31', end_date: '2026-11-01' }),
      event({ id: 'e-new-year', date: '2026-12-31', end_date: '2027-01-01' }),
    ] }))
    expect(eventLines(page)).toEqual([
      'Sun, Mar 8, 2026',
      'Sun, Nov 1, 2026',
      'Sat, Mar 7, 2026 to Sun, Mar 8, 2026',
      'Sat, Oct 31, 2026 to Sun, Nov 1, 2026',
      'Thu, Dec 31, 2026 to Fri, Jan 1, 2027',
    ])
    expect(eventDays(page)).toEqual(['2026-03-08', '2026-11-01', '2026-03-07', '2026-10-31', '2026-12-31'])
  })

  it('reads a news row stored as an instant on its Louisiana day, either side of midnight and of each clock change', () => {
    const rows = [
      ['2026-11-02T05:30:00Z', 'Sun, Nov 1, 2026'], // 11:30 PM Central, after the clocks went back
      ['2026-11-02T06:00:00Z', 'Mon, Nov 2, 2026'], // midnight Central
      ['2026-11-01T06:30:00Z', 'Sun, Nov 1, 2026'], // 1:30 AM Central, the hour that happens twice
      ['2026-03-09T04:59:00Z', 'Sun, Mar 8, 2026'], // 11:59 PM Central, after the clocks went forward
      ['2026-03-09T05:00:00Z', 'Mon, Mar 9, 2026'], // midnight Central
      ['2026-03-08T07:59:00+00:00', 'Sun, Mar 8, 2026'], // 1:59 AM Central, a minute before the gap
      ['2026-11-14T02:00:00.000Z', 'Fri, Nov 13, 2026'], // 8:00 PM Central the evening before
      ['2026-11-14T01:30', 'Sat, Nov 14, 2026'], // Louisiana wall-clock time, read as written
    ] as const
    const page = draw(restAnswer({ news: rows.map(([news_date], i) => ({ id: `n-edge-${i}`, title: `Example row ${i}`, excerpt: 'Made up.', news_date })) }))
    expect(newsLines(page)).toEqual(rows.map(([, words]) => words))
  })

  it('says the same days whatever zone the visitor\'s device is in', () => {
    try {
      const seen: string[][] = []
      for (const zone of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Chicago', 'UTC']) {
        // The device's zone, set for this case alone and put back after it.
        vi.stubEnv('TZ', zone)
        const page = draw(restAnswer({
          events: [event({ date: '2026-11-01', end_date: '2026-11-02' })],
          news: [{ id: 'n-zone', title: 'Example row', excerpt: 'Made up.', news_date: '2026-11-02T05:30:00Z' }],
        }))
        seen.push([eventLines(page)[0]!, eventDays(page)[0]!, newsLines(page)[0]!])
        cleanup()
      }
      for (const lines of seen) expect(lines).toEqual(['Sun, Nov 1, 2026 to Mon, Nov 2, 2026', '2026-11-01', 'Sun, Nov 1, 2026'])
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('ties and repeats', () => {
  it('keeps the answer\'s order for events on one day, and for news rows with one date, and never merges two with one name', () => {
    const page = draw(restAnswer({
      events: [
        event({ id: 'e-b', name: 'Example Blitz', date: '2026-12-05' }),
        event({ id: 'e-a', name: 'Example Blitz', date: '2026-12-05' }),
        event({ id: 'e-c', name: 'Example Action', date: '2026-12-05' }),
      ],
      news: [
        { id: 'n-2', title: 'Example second', excerpt: 'Made up.', news_date: '2026-11-14' },
        { id: 'n-1', title: 'Example first', excerpt: 'Made up.', news_date: '2026-11-14' },
      ],
    }))
    const rows = [...page.querySelectorAll('#events [data-slot="club-event"]')]
    expect(rows.map((r) => r.querySelector('h3 a')?.getAttribute('href'))).toEqual(['/tournaments/e-b', '/tournaments/e-a', '/tournaments/e-c'])
    expect(rows.map((r) => r.querySelector('h3')?.textContent)).toEqual(['Example Blitz', 'Example Blitz', 'Example Action'])
    expect([...page.querySelectorAll('#news h3')].map((h) => h.textContent)).toEqual(['Example second', 'Example first'])
  })

  it('draws a count past the limit as it stands, full, and an event with a limit of none as having no limit', () => {
    expect(eventCount(event({ max_players: 40, registered_count: 41 }))).toBe('41 of 40 spots filled')
    expect(eventState(event({ max_players: 40, registered_count: 41 })).words).toBe('Event full')
    expect(eventState(event({ max_players: 40, registered_count: 39 })).words).toBe('Registration open')
    expect(eventState(event({ max_players: 0, registered_count: 3 })).words).toBe('Registration open')
    const page = draw(restAnswer({ events: [event({ max_players: 40, registered_count: 41 })] }))
    expect(wordsOf(page.querySelector('#events [data-slot="club-event"]')!)).toContain('Event full 41 of 40 spots filled')
  })
})

describe('what the answer carries beyond what the page draws', () => {
  it('draws no more than three nearest clubs, even from an answer that carried more', () => {
    const four = [...NEAREST, { name: 'Example Bishops Club', city: 'Example Hamlet', slug: 'example-bishops-club', statement: null, distance: 'about 40 mi' }]
    const view = render(<MemoryRouter><NearbyClubs city="Example City" nearest={four} /></MemoryRouter>)
    expect([...view.container.querySelectorAll('li a')].map((a) => a.getAttribute('href'))).toEqual([
      '/clubs/example-pawns-club', '/clubs/example-knights-club', '/clubs/example-rooks-club',
    ])
    expect(view.container.textContent).not.toContain('Example Bishops Club')
  })

  it('leads to an event\'s own page by an address that carries its id safely, and to no other page', () => {
    expect(eventAddress('e-example-quads')).toBe('/tournaments/e-example-quads')
    expect(eventAddress('e/odd id?x#y')).toBe('/tournaments/e%2Fodd%20id%3Fx%23y')
    const page = draw(restAnswer({ events: [event({ id: 'e/odd id?x#y' })] }))
    const links = [...page.querySelectorAll('#events a')].map((a) => a.getAttribute('href'))
    expect(links).toEqual(['/tournaments/e%2Fodd%20id%3Fx%23y', '/tournaments/e%2Fodd%20id%3Fx%23y'])
  })

  it('draws a name, a title and an excerpt as text, whatever they hold', () => {
    const odd = '<b onclick="alert(1)">Example</b> & "quoted" <script>x</script>'
    const page = draw(restAnswer({
      events: [event({ name: odd })],
      news: [{ id: 'n-odd', title: odd, excerpt: odd, news_date: '2026-11-14' }],
      nearest: [{ name: odd, city: odd, slug: 'example-odd', statement: odd, distance: 'about 1 mi' }],
    }))
    expect(page.querySelector('#events h3')!.textContent).toBe(odd)
    expect(page.querySelector('#news h3')!.textContent).toBe(odd)
    expect(page.querySelector('[data-slot="nearby-clubs"] li a')!.textContent).toBe(odd)
    expect(page.querySelector('#events b, #news b, [data-slot="nearby-clubs"] b, #events script, #news script, [data-slot="nearby-clubs"] script')).toBeNull()
  })

  it('draws News only when the answer names it, and no nav link for a section it does not name, with a row or not', () => {
    const page = draw(restAnswer({ sections: ['about', 'when_and_where', 'events', 'contact'] }))
    expect(page.querySelector('#news')).toBeNull()
    expect(within(page).queryByRole('heading', { name: 'Club news' })).toBeNull()
    expect([...page.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).toEqual(['About', 'When and where', 'Events'])
    cleanup()
    const named = draw(restAnswer({ sections: ['about', 'when_and_where', 'news', 'contact'], news: [] }))
    expect(named.querySelector('#news')).toBeNull()
    expect([...named.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).toEqual(['About', 'When and where'])
    // The nearest clubs are no section of the answer: they appear with a club to name, whichever sections it names.
    expect(named.querySelector('[data-slot="nearby-clubs"]')).not.toBeNull()
  })

  it('keeps the nearest clubs, the foot line and the nav steady when events and news are both empty', () => {
    const page = draw(restAnswer({ events: [], news: [] }))
    expect([...page.querySelectorAll('section')].map((s) => s.id)).toEqual(['about', 'when-and-where'])
    expect(page.querySelector('[data-slot="nearby-clubs"]')).not.toBeNull()
    expect(page.querySelector('[data-slot="club-foot"]')).not.toBeNull()
    expect(wordsOf(page)).not.toMatch(/No events|No news|Nothing yet|Register/i)
  })
})

describe('Copy link, again and again', () => {
  it('says the same each time, keeps one status, and copies the same address each time', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    draw(restAnswer())
    const address = `${window.location.origin}/clubs/${CLUB_SLUG}`
    const status = screen.getByRole('status')
    for (let n = 1; n <= 3; n++) {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(n))
      await waitFor(() => expect(status.textContent).toBe('Link copied.'))
    }
    expect(writeText.mock.calls.map((call) => (call as unknown as string[])[0])).toEqual([address, address, address])
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('says it could not copy after a refusal, and says it copied after the next success, with no stale words between', async () => {
    const writeText = vi.fn(async () => {})
    writeText.mockRejectedValueOnce(new Error('denied'))
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    draw(restAnswer())
    const status = screen.getByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(status.textContent).toMatch(/^The link could not be copied\./))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(status.textContent).toBe('Link copied.'))
    expect(wordsOf(document.querySelector('[data-slot="club-foot"]')!)).not.toContain('could not')
  })
})

describe('the page opened at one club and then at another', () => {
  it('leaves nothing of the first club: not its events, its news, its nearest clubs, its foot line or what Copy link said', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const first = restAnswer()
    const second = restAnswer({
      club: { id: 'c-example-two', slug: 'example-second-club', name: 'Example Second Club', city: 'Example Town', region: null },
      events: [event({ id: 'e-two', name: 'Example Second Open', date: '2026-12-19' })],
      news: [],
      nearest: [{ name: 'Example Pawns Club', city: 'Example City', slug: 'example-pawns-club', statement: null, distance: 'about 9 mi' }],
    })
    const answers: Record<string, ClubPageResponse> = { [CLUB_SLUG]: first, 'example-second-club': second }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const m = /^\/api\/clubs\/([^/]+)\/page$/.exec(url)
      return m && answers[m[1]]
        ? new Response(JSON.stringify(answers[m[1]]), { status: 200 })
        : new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
    }))
    const view = render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}><ClubPage address={CLUB_SLUG} /></MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Link copied.'))
    expect(document.querySelectorAll('#events [data-slot="club-event"]')).toHaveLength(3)

    view.rerender(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}><ClubPage address="example-second-club" /></MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 1, name: 'Example Second Club' })
    await act(async () => {})
    const page = document.querySelector<HTMLElement>('[data-slot="club-page"]')!
    expect([...page.querySelectorAll('#events h3')].map((h) => h.textContent)).toEqual(['Example Second Open'])
    expect(page.querySelector('#news')).toBeNull()
    expect([...page.querySelectorAll('[data-slot="nearby-clubs"] li a')].map((a) => a.textContent)).toEqual(['Example Pawns Club'])
    expect(wordsOf(page.querySelector('[data-slot="club-foot"] p')!)).toBe(
      `Example Second Club · Example Town, Louisiana · a club listed by the Louisiana Chess Association · ${window.location.origin}/clubs/example-second-club`,
    )
    expect(screen.getByRole('status').textContent).toBe('')
    expect(document.querySelector('[data-slot="club-foot-said"]')).toBeNull()
    expect(wordsOf(page)).not.toMatch(/Example Chess Club|Example Saturday Quads|Example results are in/)
  })
})

describe('with every switch off, whatever clubKeepers holds', () => {
  /** Today's answer of GET /api/clubs/:id, for a made-up club, with a tournament and a news row of its own. */
  const TODAYS = {
    club: {
      id: CLUB_ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: 'A made-up club.',
      meeting_schedule: 'Tuesdays at 7:00 PM', created_at: '2026-01-01 12:00:00', color: '#c8a94a', image_url: null, region: 'Bayou Region',
    },
    officers: [], tournaments: [], news: [],
  }

  it.each([['off', false], ['on', true]] as const)('draws today\'s club page with none of the new blocks, and asks nothing of the new page, with clubKeepers %s', async (_said, keepers) => {
    Object.assign(flags, { newClubs: false, newLook: false, clubKeepers: keepers })
    const asked: string[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      asked.push(url)
      if (url === `/api/clubs/${CLUB_ID}`) return new Response(JSON.stringify(TODAYS), { status: 200 })
      if (/^\/api\/clubs\/[^/]+\/page$/.test(url)) return new Response(JSON.stringify(restAnswer()), { status: 200 })
      return new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
    }))
    await act(async () => {
      render(
        <AuthContext.Provider value={visitor()}>
          <MemoryRouter initialEntries={[`/clubs/${CLUB_ID}`]}><App /></MemoryRouter>
        </AuthContext.Provider>,
      )
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 10000 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Upcoming tournaments' })).toBeTruthy()
    expect(document.querySelector('[data-slot="club-page"], [data-slot="club-foot"], [data-slot="club-bar"], [data-slot="nearby-clubs"], [data-slot="club-event"], [data-slot="club-news"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'On this page' })).toBeNull()
    expect(screen.queryByRole('heading', { name: /Chess clubs near/ })).toBeNull()
    expect(asked.filter((url) => /\/page$/.test(url))).toEqual([])
  })

  it('draws no new block either with newClubs on and newLook off', async () => {
    Object.assign(flags, { newClubs: true, newLook: false, clubKeepers: false })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const asked: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      asked.push(url)
      if (url === `/api/clubs/${CLUB_ID}`) return new Response(JSON.stringify(TODAYS), { status: 200 })
      return new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
    }))
    await act(async () => {
      render(
        <AuthContext.Provider value={visitor()}>
          <MemoryRouter initialEntries={[`/clubs/${CLUB_ID}`]}><App /></MemoryRouter>
        </AuthContext.Provider>,
      )
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 10000 })).toBeTruthy()
    expect(document.querySelector('[data-slot="club-page"], [data-slot="club-foot"]')).toBeNull()
    expect(asked.filter((url) => /\/page$/.test(url))).toEqual([])
  })
})

describe('the answer in hand', () => {
  it('is the fuller club of step 21 plus its one event, drawn with the new blocks and nothing from a second ask', () => {
    const page = draw(fullAnswer())
    expect(page.querySelectorAll('#events [data-slot="club-event"]')).toHaveLength(1)
    expect(page.querySelectorAll('#news [data-slot="club-news"]')).toHaveLength(1)
    expect(page.querySelector('[data-slot="nearby-clubs"]')).toBeNull()
    expect(page.querySelector('[data-slot="club-foot"]')).not.toBeNull()
  })
})
