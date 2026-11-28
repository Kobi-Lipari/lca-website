// @vitest-environment jsdom
//
// The rest of the new club page (WS09 step 22), drawn through the real
// client with fetch stubbed: Events, News and the nearest clubs from the one
// answer the page already asks for, with no second ask; News with its full
// dates and its excerpts as text; the nearest clubs with the distance as the
// server gives it, each statement in quotation marks or "Schedule not
// listed", and no "null" in any address; the foot line and Copy link, which
// says what happened in the page's one status; the bare club, which gains
// the foot line and nothing else; what is left out, none of it drawn or
// greyed; a single sentence with a short word in it set large; and the
// editor's preview, which draws none of it. Each case sets the switches it
// reads through the mocked FEATURES. Every name, address and club here is
// made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { PagePreview } from '@/areas/clubs/components/PagePreview'
import type { ClubPageResponse } from '@domain/contracts'
import { CLUB_SLUG, bareAnswer, fullAnswer, visitor } from './helpers/clubPageAnswer'
import { NEAREST, NEWS, bareWith, restAnswer } from './helpers/clubPageRest'

vi.setConfig({ testTimeout: 15000 })

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
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => <div data-testid="club-map" /> }))

const { ClubListingPage } = await import('@/pages/ClubListingPage')

let answer: ClubPageResponse = restAnswer()
const asked: string[] = []
beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, newNav: false, clubKeepers: false })
  answer = restAnswer()
  asked.length = 0
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    return url === `/api/clubs/${CLUB_SLUG}/page`
      ? new Response(JSON.stringify(answer), { status: 200 })
      : new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function draw(path = `/clubs/${CLUB_SLUG}`) {
  render(
    <AuthContext.Provider value={visitor()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/clubs/:id" element={<ClubListingPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
  await act(async () => {})
  return document.querySelector<HTMLElement>('[data-slot="club-page"]')!
}

const wordsOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()
const ADDRESS = () => `${window.location.origin}/clubs/${CLUB_SLUG}`

describe('the rest of the page, from the one answer', () => {
  it('draws Events, then News, then the nearest clubs, then the foot line, and lists Events and News in the nav, with no second ask', async () => {
    const page = await draw()
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['About', '#about'], ['When and where', '#when-and-where'], ['Events', '#events'], ['News', '#news'],
    ])
    expect([...page.querySelectorAll('section')].map((s) => s.id)).toEqual(['about', 'when-and-where', 'events', 'news'])
    const order = ['#events', '#news', '[data-slot="nearby-clubs"]', '[data-slot="club-foot"]'].map((s) => page.querySelector(s)!)
    for (let i = 1; i < order.length; i++) expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'About Example Chess Club', 'When and where Example Chess Club meets', 'Events', 'Club news', 'Chess clubs near Example City',
    ])
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })
})

describe('News', () => {
  it('draws each row in the answer\'s order with its title, its full date with the weekday, and its excerpt', async () => {
    const page = await draw()
    const rows = [...page.querySelectorAll<HTMLElement>('#news [data-slot="club-news"]')]
    expect(rows.map((row) => [...row.children].map((el) => el.textContent))).toEqual([
      ['Example results are in', 'Sat, Nov 14, 2026', NEWS[0].excerpt],
      ['Two more clocks needed', 'Tue, Nov 3, 2026', NEWS[1].excerpt],
    ])
    expect(rows.map((row) => row.querySelector('h3')?.tagName)).toEqual(['H3', 'H3'])
    // No line about the site's own news, no author the answer does not carry, and no link of its own.
    expect(wordsOf(page.querySelector('#news')!)).not.toMatch(/Also on|LCA News|club rep/)
    expect(page.querySelectorAll('#news a')).toHaveLength(0)
  })

  it('draws a row whose date cannot be read with no date at all, and an excerpt as text and never as markup', async () => {
    answer = restAnswer({ news: [
      { id: 'n-example-odd', title: 'Example odd date', excerpt: '<img src=x onerror=alert(1)> <b>bold</b>', news_date: 'sometime soon' },
      { id: 'n-example-none', title: 'Example no date', excerpt: 'Made up.', news_date: '' },
      { id: 'n-example-bad', title: 'Example day that is not one', excerpt: 'Made up.', news_date: '2026-02-30' },
    ] })
    const page = await draw()
    const rows = [...page.querySelectorAll<HTMLElement>('#news [data-slot="club-news"]')]
    expect(rows.map((row) => row.children.length)).toEqual([2, 2, 2])
    const words = wordsOf(page.querySelector('#news')!)
    expect(words).not.toMatch(/Invalid Date|NaN|sometime soon|2026-02-30|undefined|null/)
    expect(page.querySelector('#news img, #news b')).toBeNull()
    expect(rows[0].textContent).toContain('<img src=x onerror=alert(1)> <b>bold</b>')
  })

  it('is absent, with its heading and its nav link, with no row', async () => {
    answer = restAnswer({ news: [] })
    const page = await draw()
    expect(page.querySelector('#news')).toBeNull()
    expect(within(screen.getByRole('navigation', { name: 'On this page' })).queryByRole('link', { name: 'News' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Club news' })).toBeNull()
  })
})

describe('the nearest clubs', () => {
  it('names up to three, each a link to its page by its slug, with its city, the distance as given, and its statement quoted or "Schedule not listed"', async () => {
    const page = await draw()
    const block = page.querySelector<HTMLElement>('[data-slot="nearby-clubs"]')!
    expect(within(block).getByRole('heading', { level: 2 }).textContent).toBe('Chess clubs near Example City')
    const items = [...block.querySelectorAll('li')]
    expect(items.map((li) => [li.querySelector('a')!.textContent, li.querySelector('a')!.getAttribute('href'), li.querySelector('p')!.textContent])).toEqual([
      ['Example Pawns Club', '/clubs/example-pawns-club', 'Example City · less than 1 mi · “Sundays at 2:00 PM at Example Hall.”'],
      ['Example Knights Club', '/clubs/example-knights-club', 'Example Town · about 5 mi · Schedule not listed'],
      ['Example Rooks Club', '/clubs/example-rooks-club', 'Example Village · about 20 mi · “Fridays from 6:00 PM, open to anyone.”'],
    ])
    // The one link after them, to the Clubs page, which reads no region from its address yet.
    expect(within(block).getByRole('link', { name: 'Clubs near you' }).getAttribute('href')).toBe('/clubs')
    expect(within(block).queryByRole('link', { name: /^All .* clubs$/ })).toBeNull()
    // Not a section of the answer, so no link in the nav.
    expect(block.tagName).not.toBe('SECTION')
    expect([...page.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).not.toContain('Chess clubs near Example City')
  })

  it('draws the distance as the server words it, never worked out, and no "null" in any address for a club with no region or city', async () => {
    answer = restAnswer({
      club: { region: null, city: '' },
      nearest: [{ name: 'Example Bishops Club', city: '', slug: 'example-bishops-club', statement: '   ', distance: 'about 12 mi' }],
    })
    const page = await draw()
    const block = page.querySelector<HTMLElement>('[data-slot="nearby-clubs"]')!
    expect(within(block).getByRole('heading', { level: 2 }).textContent).toBe('Chess clubs nearby')
    expect(block.querySelector('li p')!.textContent).toBe('about 12 mi · Schedule not listed')
    for (const a of page.querySelectorAll('a')) expect(a.getAttribute('href') ?? '', a.textContent ?? '').not.toMatch(/null|undefined/)
    expect(wordsOf(page)).not.toMatch(/\bnull\b|\bundefined\b|· ·/)
  })

  it('is absent with no nearest club, with no heading and no empty list', async () => {
    answer = restAnswer({ nearest: [] })
    const page = await draw()
    expect(page.querySelector('[data-slot="nearby-clubs"]')).toBeNull()
    expect(screen.queryByRole('heading', { name: /Chess clubs near/ })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Clubs near you' })).toBeNull()
  })
})

describe('the foot line and Copy link', () => {
  it('says the club, its town, that the association lists it, and the page\'s own address with no query and no hash', async () => {
    const page = await draw(`/clubs/${CLUB_SLUG}?from=example#news`)
    const foot = page.querySelector<HTMLElement>('[data-slot="club-foot"]')!
    expect(wordsOf(foot.querySelector('p')!)).toBe(`Example Chess Club · Example City, Louisiana · a club listed by the Louisiana Chess Association · ${ADDRESS()}`)
    expect(foot.textContent).not.toMatch(/\?from|#news/)
    cleanup()
    answer = restAnswer({ club: { city: '  ' } })
    const noCity = await draw()
    expect(wordsOf(noCity.querySelector('[data-slot="club-foot"] p')!)).toBe(`Example Chess Club · Louisiana · a club listed by the Louisiana Chess Association · ${ADDRESS()}`)
  })

  it('copies the address and says so in the page\'s one status, and says the address when the browser refuses or has no clipboard', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    await draw()
    expect(screen.getAllByRole('status')).toHaveLength(1)
    const status = screen.getByRole('status')
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(status.textContent).toBe('Link copied.'))
    expect(writeText).toHaveBeenCalledWith(ADDRESS())
    // The same words beside the button for the eye, hidden from a screen reader, which hears the status once.
    const echo = document.querySelector('[data-slot="club-foot-said"]')!
    expect(echo.textContent).toBe('Link copied.')
    expect(echo.getAttribute('aria-hidden')).toBe('true')
    writeText.mockRejectedValueOnce(new Error('denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(status.textContent).toBe(`The link could not be copied. The page's address is ${ADDRESS()}`))
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    await waitFor(() => expect(status.textContent).toBe(`The link could not be copied. The page's address is ${ADDRESS()}`))
    expect(screen.getAllByRole('status')).toHaveLength(1)
    // Nothing was sent anywhere but the page's one ask.
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })

  it('keeps the cover\'s Share as it was, speaking in the same status, with no words of its own beside Copy link', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share })
    await draw()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Shared.'))
    expect(share).toHaveBeenCalledWith({ title: 'Example Chess Club', url: ADDRESS() })
    expect(document.querySelector('[data-slot="club-foot-said"]')).toBeNull()
  })

  it('gives Copy link a 44 pixel target with the look\'s focus ring and the field\'s edge', async () => {
    await draw()
    const copy = screen.getByRole('button', { name: 'Copy link' })
    expect(copy.className).toMatch(/\bmin-h-11\b/)
    expect(copy.className).toMatch(/focus-visible:ring-3/)
    expect(copy.className).toMatch(/\bborder\b.*\bborder-field\b/)
  })
})

describe('the bare club', () => {
  it('gains the foot line and nothing else: no Events, no News, no nearest clubs and no new control but Copy link', async () => {
    answer = bareAnswer()
    const page = await draw()
    expect([...page.querySelectorAll('section')].map((s) => s.id)).toEqual(['about', 'when-and-where'])
    expect(page.querySelector('[data-slot="nearby-clubs"], #events, #news')).toBeNull()
    expect(page.querySelector('[data-slot="club-foot"]')).not.toBeNull()
    const controls = [...page.querySelectorAll('a, button')].map((c) => c.getAttribute('aria-label') ?? c.textContent?.trim())
    expect(controls.at(-1)).toBe('Copy link')
    expect(controls).toHaveLength(7)
    expect(wordsOf(page)).not.toMatch(/No events|No news|not listed|Schedule/i)
  })
})

describe('what is left out', () => {
  it('draws no Follow this club, no Add to calendar, no partner row, no Photos, no Contact and no Suggest an update, absent and never greyed', async () => {
    answer = restAnswer({ sections: ['about', 'when_and_where', 'events', 'news', 'photos', 'contact'] })
    const page = await draw()
    const words = wordsOf(page)
    expect(words).not.toMatch(/Follow|calendar|Partner event|organizer's site|Photos|Suggest an update/i)
    expect(screen.queryByRole('heading', { name: /^Contact|^Photos/ })).toBeNull()
    expect(page.querySelector('#photos, #contact, [data-status="partner"], [aria-disabled="true"], [disabled]')).toBeNull()
    expect([...page.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).toEqual(['About', 'When and where', 'Events', 'News'])
  })
})

describe('one sentence with a short word in it', () => {
  it('is set large across About, as one sentence', () => {
    const text = 'We meet at St. Example\'s hall on Tuesdays.'
    const view = render(<MemoryRouter><ClubPageView answer={{ ...fullAnswer(), about: { ...fullAnswer().about, text } }} keeper={null} /></MemoryRouter>)
    const lead = within(view.container.querySelector<HTMLElement>('#about')!).getByText(text)
    expect(lead.className).toContain('text-xl')
  })
})

describe('the editor\'s preview', () => {
  it('draws no events, no news, no nearest clubs, no foot line and no club bar, and asks nothing', () => {
    const values = {
      name: 'Example Chess Club', city: 'Example City', region: 'Bayou Region', aboutText: 'A made-up club.', howWeMeetText: 'Tuesdays at 7:00 PM.',
      placeName: 'Example Library', placeStreet: '', placeNote: '', place2Name: '', place2Street: '', place2Note: '', costText: '', welcomeText: '',
      facebookUrl: '', websiteUrl: '', otherUrl: '', weekendPlay: false, scholasticFriendly: false,
    }
    const view = render(
      <MemoryRouter>
        <PagePreview own clubId="c-example-club" address={CLUB_SLUG} values={values} colour={null} logo={null} point={{ lat: 30.1, lng: -91.2 }} point2={null} second={false} />
      </MemoryRouter>,
    )
    const preview = view.container.querySelector<HTMLElement>('[data-slot="page-preview"]')!
    expect(preview.querySelector('#events, #news, [data-slot="nearby-clubs"], [data-slot="club-foot"], [data-slot="club-bar"], [data-slot="club-event"]')).toBeNull()
    expect(preview.querySelectorAll('a, button')).toHaveLength(0)
    expect(wordsOf(preview)).not.toMatch(/Copy link|Chess clubs near|Club news|Directions/)
    expect(asked).toEqual([])
    // The nearest clubs and the rows are the answer's alone: the preview has no answer to draw them from.
    expect(NEAREST).toHaveLength(3)
    expect(bareWith({}).events).toEqual([])
  })
})
