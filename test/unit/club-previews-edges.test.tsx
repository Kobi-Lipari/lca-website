// @vitest-environment jsdom
//
// The club editor's preview column, the edges the first file does not walk
// (WS09 step 8): each preview read in words as a screen reader reads it;
// words typed with markup drawn as words and never as markup; a link the
// keeper types, or a logo address from another site, loading nothing and
// drawing nothing in the column; the page's address in the search result
// following the slug, else the club's id; the checklist at nothing done and
// at everything done; a place with no pin; and the column staying in step
// with what is typed. Every name, address and club here is made up.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { CardPreview } from '@/areas/clubs/components/CardPreview'
import { PageChecklist } from '@/areas/clubs/components/PageChecklist'
import { SearchPreview } from '@/areas/clubs/components/SearchPreview'
import { pageChecklist } from '@/areas/clubs/previews'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { ClubEditor } = await import('@/areas/clubs/components/ClubEditor')

const CLUB = {
  id: 'example-chess-club', name: 'Example Chess Club', city: 'Example City', location: 'Example Library', description: null,
  meeting_schedule: null, contact_email: 'club@example.org', created_at: '2026-01-01 12:00:00', color: '#c8a94a', image_url: null,
  region: 'Bayou Region', latitude: 30.1, longitude: -91.2, slug: 'example-chess', about_text: 'Casual games for everyone.',
  how_we_meet_text: 'Tuesdays from 7:00 PM.', cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0,
  contact_name_public: 'Player One', facebook_url: null, website_url: null, other_url: null, told_updated_at: null, told_by: null,
  last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: null, latitude: 30.1, longitude: -91.2 }

const fetched: string[] = []
beforeEach(() => {
  fetched.length = 0
  window.localStorage.setItem('lca-club-editor-help', 'shown')
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    fetched.push(String(url))
    return new Response('{}', { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

/** The words a part of the page gives a screen reader, in order, a picture by its label. */
function wordsOf(el: Element): string {
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node instanceof HTMLElement && node.getAttribute('aria-hidden') === 'true') return
    if (node instanceof HTMLElement && node.getAttribute('role') === 'img') { parts.push(node.getAttribute('aria-label') ?? ''); return }
    if (node instanceof HTMLImageElement) { parts.push(node.alt); return }
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '')
    node.childNodes.forEach(walk)
  }
  walk(el)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function editor(club: Record<string, unknown> = CLUB, places: unknown[] = [PLACE], viewOnly = false) {
  const auth = {
    user: { id: 'm-example' }, member: { id: 'm-example', role: 'club_rep', club_id: CLUB.id, full_name: 'Player Two' }, session: null, role: 'club_rep',
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor club={club as never} places={places as never} isAdmin={false} showAdminFields={false} viewOnly={viewOnly} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const column = () => screen.getByRole('complementary', { name: 'Preview' })
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('each preview read in words', () => {
  it('reads the search result as a site, a title and a description', () => {
    render(<SearchPreview name="Example Chess Club" city="Example City" about="Casual games for everyone" statement="Tuesdays from 7:00 PM." address="example-chess" />)
    expect(wordsOf(screen.getByRole('region', { name: 'How your page shows up in a search' }))).toBe(
      'How your page shows up in a search Site Louisiana Chess Association · louisianachess.org › clubs › example-chess '
      + 'Title Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association '
      + 'Description Casual games for everyone. Tuesdays from 7:00 PM.',
    )
  })

  it('reads the directory card as its three lines, and no more', () => {
    render(<CardPreview name="Example Chess Club" city="Example City" statement="" about="Casual games for everyone." />)
    const card = screen.getByRole('group', { name: 'Directory card' })
    expect(wordsOf(card)).toBe('Example Chess Club · Example City Schedule not listed · Know when they meet? Suggest an update Casual games for everyone.')
    expect(card.children).toHaveLength(3)
  })

  it('says every item "Not yet" in words when nothing is done, with the count, and "Done" in words when all are', () => {
    render(<PageChecklist items={pageChecklist({ statement: '', pinned: false, email: '  ', logo: null, colour: null })} />)
    expect(screen.getByText('0 of 5 done')).toBeTruthy()
    expect(screen.getAllByRole('listitem').map((li) => wordsOf(li))).toEqual([
      'How the club meets, in your words : Not yet', 'A place pinned on the map : Not yet', 'Email for messages : Not yet', 'Logo : Not yet', 'Club colour : Not yet',
    ])
    cleanup()
    render(<PageChecklist items={pageChecklist({ statement: 'x', pinned: true, email: 'club@example.org', logo: '/api/clubs/c/logo?v=1', colour: '#2e7d32' })} />)
    expect(screen.getByText('5 of 5 done')).toBeTruthy()
    for (const li of screen.getAllByRole('listitem')) expect(wordsOf(li)).toMatch(/: Done$/)
  })
})

describe('words typed with markup are drawn as words', () => {
  it('draws a name with a tag in it as text in the card and the search result, and makes no element from it', () => {
    const hostile = '<img src="https://example.org/x.png" onerror="alert(1)">Example <b>Club</b>'
    const { container } = render(
      <>
        <CardPreview name={hostile} city="Example City" statement="<a href='https://example.org'>Tuesdays</a>" about="" />
        <SearchPreview name={hostile} city="Example City" about="<script>alert(1)</script>Casual" statement="" address="example-chess" />
      </>,
    )
    expect(container.querySelectorAll('img, script, a, b, [onerror]')).toHaveLength(0)
    // Taken out of the words, since the page's own title and description are plain text.
    expect(wordsOf(screen.getByRole('group', { name: 'Directory card' }))).toContain('Example Club · Example City')
    expect(wordsOf(screen.getByRole('group', { name: 'Directory card' }))).toContain('Tuesdays')
    expect(container.textContent).not.toContain('<')
    expect(fetched).toEqual([])
  })
})

describe('the column makes no request and loads nothing from a typed link', () => {
  it('draws no picture, link or frame from a website, a Facebook page or another link, and calls nothing, as they are typed', () => {
    editor({ ...CLUB, facebook_url: 'https://example.org/page', website_url: 'https://example.org/logo.png' })
    type('Website', 'https://example.org/logo.png')
    type('Facebook page', 'https://example.org/cover.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Add another link' }))
    type('Another link', 'https://example.org/banner.svg')
    expect(column().querySelectorAll('img, iframe, object, embed, video, audio, source, link, a, script')).toHaveLength(0)
    expect(column().textContent).not.toContain('example.org/')
    expect(fetched).toEqual([])
  })

  it('draws a logo address from another site as the initials, and the club\'s own stored logo as its picture, still without a request', () => {
    editor({ ...CLUB, image_url: 'https://example.org/logo.png' })
    expect(column().querySelector('img')).toBeNull()
    expect(within(column()).getByRole('img', { name: 'The initials EC in white on navy' })).toBeTruthy()
    cleanup()
    editor({ ...CLUB, image_url: '/api/clubs/example-chess-club/logo?v=3' })
    const own = column().querySelector('img')!
    expect(own.getAttribute('src')).toBe('/api/clubs/example-chess-club/logo?v=3')
    expect(own.getAttribute('alt')).toBe('The club\'s logo')
    expect(column().querySelectorAll('img')).toHaveLength(1)
    expect(within(column()).getByText('Logo', { exact: false }).closest('li')?.textContent).toMatch(/Done/)
    expect(fetched).toEqual([])
  })
})

describe('the column follows what is typed and what is stored', () => {
  it('shows the page\'s address by the slug, else the club\'s id', () => {
    editor()
    expect(within(column()).getByText(/louisianachess\.org › clubs › example-chess$/)).toBeTruthy()
    cleanup()
    editor({ ...CLUB, slug: null })
    expect(within(column()).getByText(/louisianachess\.org › clubs › example-chess-club$/)).toBeTruthy()
  })

  it('moves the description and the card together as About and the meeting\'s words are typed, and cuts the description, not the card\'s words', () => {
    editor()
    const long = 'Casual games for everyone and every level, with a few boards set aside for newcomers and a teacher on hand most weeks to explain the rules.'
    const meets = 'Tuesdays from 7:00 PM at Example Library, and some Saturdays.'
    type('One sentence about the club', long)
    type('How the club meets, in words', meets)
    const result = within(column()).getByRole('region', { name: 'How your page shows up in a search' })
    const description = result.querySelectorAll('dd')[2].textContent ?? ''
    expect(description.length).toBeLessThanOrEqual(155)
    // About is cut and the meeting's words kept whole, in the search result and the share card alike.
    expect(description).toBe(`Casual games for everyone and every level, with a few boards set aside for newcomers and a… ${meets}`)
    const share = within(column()).getByRole('region', { name: 'When someone shares your page' })
    expect(share.querySelectorAll('dd')[2].textContent).toBe(description)
    expect(within(column()).getByRole('group', { name: 'Directory card' }).textContent).toContain('Tuesdays from 7:00 PM at Example Library, and some Saturdays.')
    // Emptying both leaves no description and the card's own "not listed" line.
    type('One sentence about the club', '')
    type('How the club meets, in words', '')
    // The search result and the share card both say so.
    expect(within(column()).getAllByText('No description yet.')).toHaveLength(2)
    expect(within(column()).getByText('Schedule not listed · Know when they meet? Suggest an update')).toBeTruthy()
    expect(within(column()).getByText('2 of 5 done')).toBeTruthy()
  })

  it('counts the pin as not set when no place has one, and as set again at once for a place that does', () => {
    editor({ ...CLUB, latitude: null, longitude: null }, [{ ...PLACE, latitude: null, longitude: null }])
    const pinned = () => within(column()).getByText('A place pinned on the map').closest('li')!.textContent
    expect(pinned()).toMatch(/Not yet/)
    cleanup()
    editor()
    expect(pinned()).toMatch(/Done/)
  })

  it('stays drawn, with the same words, when the form is read only', () => {
    editor(CLUB, [PLACE], true)
    expect(within(column()).getByRole('region', { name: 'Your page\'s checklist' })).toBeTruthy()
    expect(within(column()).getByRole('group', { name: 'Directory card' }).textContent).toContain('Example Chess Club · Example City')
    expect(fetched).toEqual([])
  })
})
