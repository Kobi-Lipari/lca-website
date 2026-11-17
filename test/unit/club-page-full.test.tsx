// @vitest-environment jsdom
//
// The new club page for a fuller club (WS09 step 21), as Club-G draws one,
// and everything around it: About's longer words with Cost, Who is welcome
// and Find us online beside them, and a single sentence set large; When and
// where with the statement as a quote, the told line as the server words
// it, up to two places each with its note and, where it has a point,
// Directions; the map given the places; the cover's two buttons and what
// Share says; the id in the address replaced by the slug; the states while
// the page loads, for a club the server does not answer for and for a
// failed call; and the keeper's line for the club's rep and the region's
// representative with clubKeepers on, and for nobody else. Each case sets
// the switches it reads through the mocked FEATURES. The page is drawn
// through the real client, with fetch stubbed. Every name, address and club
// here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigationType } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { directionsUrl, placePoints } from '@/areas/clubs/clubMap'
import { keeperFor, keeperWords, oneSentence } from '@/areas/clubs/clubPage'
import type { ClubPageResponse } from '@domain/contracts'
import {
  ABOUT_LONG, CLUB_ID, CLUB_SLUG, STATEMENT_LONG, bareAnswer, clubRep, fullAnswer, plainMember, regionRep, visitor,
} from './helpers/clubPageAnswer'

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
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
const maps = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }))
vi.mock('@/areas/clubs/components/LCAMap', () => ({
  LCAMap: (props: Record<string, unknown>) => {
    maps.props.push(props)
    return <div data-testid="club-map" />
  },
}))

const { ClubListingPage } = await import('@/pages/ClubListingPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** What each address answers: a status and a body. */
let answers: Record<string, { status: number; body: unknown }> = {}
const asked: string[] = []
beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, clubKeepers: false, clubEmailHidden: true })
  maps.props = []
  asked.length = 0
  // jsdom draws no layout, so it has no scrollIntoView; the page calls it for a section named in the hash.
  Element.prototype.scrollIntoView = vi.fn()
  answers = {
    [`/api/clubs/${CLUB_SLUG}/page`]: { status: 200, body: fullAnswer() },
    [`/api/clubs/${CLUB_ID}/page`]: { status: 200, body: fullAnswer() },
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    const answer = answers[url] ?? { status: 404, body: { error: 'Club not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Where the page is, and how it got there. */
function Where() {
  const location = useLocation()
  const how = useNavigationType()
  return <span data-testid="where" data-how={how}>{`${location.pathname}${location.search}${location.hash}`}</span>
}

function open(path: string, auth: AuthContextValue = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/clubs/:id" element={<><ClubListingPage /><Where /></>} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

async function draw(path = `/clubs/${CLUB_SLUG}`, auth: AuthContextValue = visitor()) {
  open(path, auth)
  await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
  await act(async () => {})
}

describe('About for a fuller club', () => {
  it('sets longer words as paragraphs, with Cost, Who is welcome and Find us online beside them', async () => {
    await draw()
    const about = document.getElementById('about')!
    const [first, second] = ABOUT_LONG.split('\n\n')
    expect(within(about).getByText(first)).toBeTruthy()
    expect(within(about).getByText(second)).toBeTruthy()
    // The boxes stand in a column of their own beside the words.
    const grid = within(about).getByText(first).closest('.grid')!
    expect(grid.className).toContain('@3xl:grid-cols-[minmax(0,1fr)_24rem]')
    expect(within(about).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Cost', 'Who is welcome', 'Find us online'])
    expect(within(about).getByText('Free. Saturday rated games are $5 toward the room.')).toBeTruthy()
    // The two ticks, in words beside the club's own.
    expect(within(about).getByText('All ages and all levels. Bring a board if you have one.')).toBeTruthy()
    expect(within(about).getByText('The club plays on weekends')).toBeTruthy()
    expect(within(about).getByText('Scholastic friendly')).toBeTruthy()
    // The links open in a new tab and say so; one that is not a web address is not drawn.
    const links = within(about).getAllByRole('link')
    expect(links.map((a) => [a.getAttribute('aria-label'), a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])).toEqual([
      ['Facebook (opens in a new tab)', 'https://www.facebook.com/example-chess-club', '_blank', 'noopener noreferrer'],
      ['Website: example.org (opens in a new tab)', 'https://example.org/chess', '_blank', 'noopener noreferrer'],
    ])
    expect(about.innerHTML).not.toContain('javascript')
  })

  it('sets a single sentence large across the whole section, with the boxes under it', async () => {
    answers[`/api/clubs/${CLUB_SLUG}/page`] = {
      status: 200, body: { ...fullAnswer(), about: { ...fullAnswer().about, text: 'A friendly made-up club, open to every level.' } },
    }
    await draw()
    const about = document.getElementById('about')!
    const lead = within(about).getByText('A friendly made-up club, open to every level.')
    expect(lead.className).toContain('text-xl')
    expect(lead.className).toContain('@3xl:text-[21px]')
    // Nothing stands beside it: the boxes sit in a row under it.
    expect(lead.parentElement!.className).not.toContain('grid-cols')
    expect(lead.compareDocumentPosition(within(about).getByText('Cost')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Longer words are not set large.
    expect(oneSentence(ABOUT_LONG)).toBe(false)
    expect(oneSentence('Saturdays at 10:00 AM, at the library.')).toBe(true)
    expect(oneSentence('One sentence. Then another.')).toBe(false)
  })
})

describe('When and where', () => {
  it('quotes the statement, draws the told line as given, and a row per place with its note and Directions where it has a point', async () => {
    await draw()
    const where = document.getElementById('when-and-where')!
    expect(within(where).getByRole('heading', { level: 2 }).textContent).toBe('When and where Example Chess Club meets')
    expect(where.querySelector('figure blockquote')?.textContent).toBe(STATEMENT_LONG)
    expect(where.querySelector('figcaption')?.textContent).toBe('How the club meets')
    expect(within(where).getByText('As told by the club, updated October 2026')).toBeTruthy()
    const rows = within(within(where).getByRole('list', { name: 'The club\'s places' })).getAllByRole('listitem')
    expect(rows.map((row) => [...row.querySelectorAll('p')].map((p) => p.textContent))).toEqual([
      ['Example Library', '1 Example Street, Example City', 'Meeting room past the front desk.'],
      ['Example Cafe', 'Tables at the back.'],
    ])
    const directions = within(rows[0]).getByRole('link', { name: 'Directions to Example Library (opens in a new tab)' })
    expect(directions.getAttribute('href')).toBe(directionsUrl({ lat: 30.1, lng: -91.2 }))
    expect(directions.getAttribute('target')).toBe('_blank')
    // The place with no point has no Directions.
    expect(within(rows[1]).queryByRole('link')).toBeNull()
  })

  it('gives the map the places that have a point, as plain pins, with no directions link of its own', async () => {
    await draw()
    expect(screen.getByTestId('club-map')).toBeTruthy()
    const last = maps.props[maps.props.length - 1]
    expect(last).toMatchObject({ mode: 'single', clubName: 'Example Chess Club', directions: false, quietWithoutKey: true, places: [{ name: 'Example Library', lat: 30.1, lng: -91.2 }] })
    expect(placePoints(fullAnswer().places)).toEqual([{ name: 'Example Library', lat: 30.1, lng: -91.2 }])
  })

  it('draws no map where no place has a point', async () => {
    const body = fullAnswer()
    answers[`/api/clubs/${CLUB_SLUG}/page`] = { status: 200, body: { ...body, places: body.places.map((p) => ({ ...p, latitude: null, longitude: null })) } }
    await draw()
    expect(screen.queryByTestId('club-map')).toBeNull()
    expect(within(document.getElementById('when-and-where')!).queryByRole('link')).toBeNull()
  })
})

describe('the cover', () => {
  it('fills the cover with the answer\'s colour and offers Contact the club and Share, and no Follow', async () => {
    await draw()
    const filled = [...document.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.backgroundColor !== '')
    expect(filled.map((el) => el.style.backgroundColor)).toEqual(['rgb(46, 107, 79)'])
    expect(screen.getByRole('link', { name: 'Contact the club' }).getAttribute('href')).toBe('/contact')
    expect(screen.queryByRole('button', { name: /Follow/ })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['About Example Chess Club', 'When and where Example Chess Club meets', 'Events', 'Club news'])
  })

  it('shares through the visitor\'s own share sheet where the browser has one, and says what happened', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share })
    await draw()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(screen.getByText('Shared.')).toBeTruthy())
    expect(share).toHaveBeenCalledWith({ title: 'Example Chess Club', url: `${window.location.origin}/clubs/${CLUB_SLUG}` })
    expect(screen.getByText('Shared.').getAttribute('role')).toBe('status')
    // A sheet closed without sharing says so.
    share.mockRejectedValueOnce(Object.assign(new Error('closed'), { name: 'AbortError' }))
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(screen.getByText('Not shared.')).toBeTruthy())
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })

  it('copies the address where there is no share sheet, and says so, or says the address when it cannot copy', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } })
    await draw()
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(screen.getByText('Link copied.')).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/clubs/${CLUB_SLUG}`)
    writeText.mockRejectedValueOnce(new Error('denied'))
    fireEvent.click(screen.getByRole('button', { name: 'Share' }))
    await waitFor(() => expect(screen.getByText(`The link could not be copied. The page's address is ${window.location.origin}/clubs/${CLUB_SLUG}`)).toBeTruthy())
    // Nothing was sent anywhere but the page's one ask.
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })
})

describe('the address', () => {
  it('replaces an id with the slug, keeping the query and the hash, with no new history entry and no second ask', async () => {
    await draw(`/clubs/${CLUB_ID}?from=example#when-and-where`)
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/clubs/${CLUB_SLUG}?from=example#when-and-where`))
    expect(screen.getByTestId('where').getAttribute('data-how')).toBe('REPLACE')
    expect(asked).toEqual([`/api/clubs/${CLUB_ID}/page`])
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Example Chess Club')
  })

  it('stays where it is when the club\'s slug is its id', async () => {
    answers[`/api/clubs/${CLUB_ID}/page`] = { status: 200, body: { ...fullAnswer(), club: { ...fullAnswer().club, slug: CLUB_ID } } }
    await draw(`/clubs/${CLUB_ID}`)
    await act(async () => new Promise((r) => setTimeout(r, 30)))
    expect(screen.getByTestId('where').textContent).toBe(`/clubs/${CLUB_ID}`)
    expect(screen.getByTestId('where').getAttribute('data-how')).toBe('POP')
    expect(asked).toEqual([`/api/clubs/${CLUB_ID}/page`])
  })
})

describe('the states before the club', () => {
  it('says Loading in a status while it waits', async () => {
    let release!: () => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      release = () => resolve(new Response(JSON.stringify(fullAnswer()), { status: 200 }))
    })))
    open(`/clubs/${CLUB_SLUG}`)
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Loading the club…')
    expect(screen.queryByRole('heading')).toBeNull()
    await act(async () => release())
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })).toBeTruthy()
  })

  it('draws "Club not found" for a club the server does not answer for, with the focus on it and a way back', async () => {
    open('/clubs/no-such-club')
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Club not found' })
    await waitFor(() => expect(document.activeElement).toBe(h1))
    expect(screen.getByRole('status').textContent).toBe('No club goes by this address.')
    expect(screen.getByRole('link', { name: 'Back to clubs' }).getAttribute('href')).toBe('/clubs')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('says a failed call in words with Try again, which asks again and draws the page', async () => {
    answers[`/api/clubs/${CLUB_SLUG}/page`] = { status: 500, body: { error: 'Something went wrong' } }
    open(`/clubs/${CLUB_SLUG}`)
    const h1 = await screen.findByRole('heading', { level: 1, name: 'This club\'s page did not load' })
    await waitFor(() => expect(document.activeElement).toBe(h1))
    expect(screen.getByRole('status').textContent).toBe('Check your connection, then try again.')
    answers[`/api/clubs/${CLUB_SLUG}/page`] = { status: 200, body: fullAnswer() }
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })).toBeTruthy()
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`, `/api/clubs/${CLUB_SLUG}/page`])
  })

  it('focuses the club\'s h1 once the page has drawn', async () => {
    await draw()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })))
  })
})

describe('the keeper\'s line', () => {
  it('tells the club\'s own rep this is their club\'s page, with Edit to Your club\'s page, with clubKeepers on', async () => {
    flags.clubKeepers = true
    await draw(`/clubs/${CLUB_SLUG}`, clubRep())
    expect(screen.getByText('This is your club\'s page')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`/my/club/${CLUB_SLUG}`)
  })

  it('tells the region\'s representative they can edit it as that region\'s representative, with Edit to the club\'s page in My region', async () => {
    flags.clubKeepers = true
    await draw(`/clubs/${CLUB_SLUG}`, regionRep())
    expect(screen.getByText('You can edit this page as the Bayou Region representative')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`/workspace/region/clubs/${CLUB_ID}`)
  })

  it('draws no keeper\'s line for a visitor, a plain member or another club\'s rep', async () => {
    flags.clubKeepers = true
    for (const auth of [visitor(), plainMember(), clubRep('c-another-club')]) {
      await draw(`/clubs/${CLUB_SLUG}`, auth)
      expect(screen.queryByText(/This is your club's page|You can edit this page/)).toBeNull()
      expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
      cleanup()
    }
  })

  it('draws no keeper\'s line with clubKeepers off, for the rep and the representative alike', async () => {
    flags.clubKeepers = false
    for (const auth of [clubRep(), regionRep()]) {
      await draw(`/clubs/${CLUB_SLUG}`, auth)
      expect(screen.queryByText(/This is your club's page|You can edit this page/)).toBeNull()
      expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull()
      cleanup()
    }
  })

  it('draws no line while the session\'s member is still loading, and draws it once the member is there', async () => {
    flags.clubKeepers = true
    const loading = { ...clubRep(), member: null, memberLoading: true } as AuthContextValue
    const view = open(`/clubs/${CLUB_SLUG}`, loading)
    await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
    expect(screen.queryByText('This is your club\'s page')).toBeNull()
    view.rerender(
      <AuthContext.Provider value={clubRep()}>
        <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}>
          <Routes><Route path="/clubs/:id" element={<><ClubListingPage /><Where /></>} /></Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    expect(await screen.findByText('This is your club\'s page')).toBeTruthy()
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })

  it('decides both lines from the session alone, the rep first when a person is both', () => {
    const club = fullAnswer().club
    const both = { role: 'club_rep', member: { club_id: CLUB_ID }, managedClubs: [{ id: CLUB_ID, region: 'Bayou Region' }] }
    expect(keeperFor(club, both)).toEqual({ kind: 'rep', edit: `/my/club/${CLUB_SLUG}` })
    expect(keeperFor(club, { role: 'lca_admin', member: { club_id: null }, managedClubs: [] })).toBeNull()
    expect(keeperFor(club, { role: 'member', member: null, managedClubs: [{ id: CLUB_ID, region: null }] })).toBeNull()
    expect(keeperFor({ ...club, region: null }, { role: 'member', member: { club_id: null }, managedClubs: [{ id: CLUB_ID, region: null }] }))
      .toEqual({ kind: 'region', region: null, edit: `/workspace/region/clubs/${CLUB_ID}` })
    // With neither region known the line names the seat in words, never "null".
    expect(keeperWords({ kind: 'region', region: null, edit: '' })).toBe('You can edit this page as the region\'s representative')
  })
})

describe('the new page\'s files', () => {
  const FILES = [
    'src/areas/clubs/components/ClubPage.tsx', 'src/areas/clubs/components/ClubCover.tsx', 'src/areas/clubs/components/AuthorLine.tsx',
    'src/areas/clubs/components/SectionNav.tsx', 'src/areas/clubs/components/ClubAbout.tsx', 'src/areas/clubs/components/WhenAndWhere.tsx',
    'src/areas/clubs/components/PagePreview.tsx', 'src/areas/clubs/clubPage.ts', 'src/pages/ClubListingPage.tsx',
  ]

  it('never make a club\'s colour words: none imports clubTextColor, clubTextOnDark or the colour helpers\' module', () => {
    for (const file of FILES) {
      const code = read(file)
      // Every import, a long one over several lines included, as written.
      const imports = code.match(/^import[\s\S]*?from '[^']+'/gm) ?? []
      expect(imports.length, file).toBeGreaterThan(0)
      expect(imports.join('\n'), file).not.toMatch(/clubTextColor|clubTextOnDark|clubColors/)
      expect(code, file).not.toMatch(/clubTextColor|clubTextOnDark/)
    }
  })

  it('fetch nothing themselves and import only types from domain/contracts', () => {
    for (const file of FILES) {
      const code = read(file)
      expect(code, file).not.toMatch(/\bfetch\(/)
      for (const line of code.split('\n').filter((l) => /from '@domain\/contracts'/.test(l))) expect(line, file).toMatch(/^import type /)
    }
  })

  it('the bare answer and the fuller one both name Contact, which the page does not draw yet', () => {
    expect(bareAnswer().sections).toContain('contact')
    expect(fullAnswer().sections).toContain('contact')
    expect((fullAnswer() satisfies ClubPageResponse).sections).not.toContain('photos')
  })
})
