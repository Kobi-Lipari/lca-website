// @vitest-environment jsdom
//
// The fixes WS09 checkpoint U's review asked of My region and of a club's
// page in My region, each page drawn alone through the real client with
// fetch stubbed:
// - the Listing tab's editor is kept once Listing has been opened, hidden
//   while another tab shows, so a change of tab never throws away what was
//   typed, and while hidden none of its controls is exposed or reachable by
//   the keyboard, and nothing in it takes the focus;
// - an empty news list on a club's page in My region reads "Nothing posted
//   yet." alone, the explaining sentence being the admin club page's;
// - after Try again, for the club and for its news, the focus goes to the
//   page's heading once the load settles, as My region does, and for the
//   news only while News is still open and the focus has been lost;
// - the status line after Still accurate goes empty as a press starts, on
//   both pages, so a second press in the same month is announced again;
// - the LCA admin's button for the monthly check says "Not sent" only for a
//   refusal below 500, and says a send may not have finished otherwise.
// Every name, club and address here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { SEND_UNSURE, SITE_UNREACHED } from '@/areas/clubs/region'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

// Each case may wait up to 5 seconds for the editor's file to load, so each case has 20 seconds.
vi.setConfig({ testTimeout: 20000 })

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))
vi.mock('@/areas/clubs/components/ClubLocationPicker', () => ({ ClubLocationPicker: () => null }))

const { MyRegionClubPage } = await import('@/pages/MyRegionClubPage')
const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { MonthlyCheckButton } = await import('@/areas/clubs/components/MonthlyCheckButton')

const ID = 'c-knights'
const CLUB_URL = `/api/admin/clubs/${ID}`
const CLUB = {
  id: ID, name: 'Example Knights Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: null, facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-02 15:00:00', told_by: 'm-five', last_confirmed_at: '2026-11-02 15:00:00', confirmed_by: 'm-five',
}
const NEWS = [{ id: 'n-1', club_id: ID, title: 'Example club night', news_date: '2026-11-07', excerpt: 'An example evening.', created_at: '2026-11-08 18:00:00' }]
const CONFIRMED = { id: ID, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' }
const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const ABOUT = 'One sentence about the club'

function card(id: string, name: string): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Bayou Region', color: null, logoUrl: null, statement: null,
    lastConfirmedAt: '2026-11-02 15:00:00', lastCheckWords: 'Checked Nov 2026', needsCheck: false, events: 1, openItems: [],
  }
}
const REGION: WorkspaceRegionResponse = {
  clubs: [card(ID, 'Example Knights Club')],
  thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 1, notChecked: 0 },
  regions: [{ region: 'Bayou Region', keepers: [] }],
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
type Answer = (body: unknown) => Response | Promise<Response>
let asked: string[] = []
let answers: Record<string, Answer> = {}

beforeEach(() => {
  window.localStorage.clear()
  asked = []
  answers = {
    [`GET ${CLUB_URL}`]: () => json({ club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments: [], places: [] }),
    [`GET ${CLUB_URL}/news`]: () => json({ news: NEWS }),
    [`POST ${CLUB_URL}/confirm`]: () => json(CONFIRMED),
    'GET /api/workspace/region': () => json(REGION),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push(call)
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    const answer = answers[call]
    return answer ? answer(body) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function authFor(role = 'member'): AuthContextValue {
  return {
    user: { id: 'm-one' }, session: null, role,
    member: { id: 'm-one', role, club_id: null, full_name: 'Player One' },
    loading: false, memberLoading: false, seats: role === 'lca_admin' ? [] : [REGIONAL],
    managedClubs: [{ id: ID, name: 'Example Knights Club', region: 'Bayou Region' }],
    isBoardMember: role !== 'lca_admin', assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

/** A club's page in My region at this address, on its own route. */
function openClub(path = `/workspace/region/clubs/${ID}`) {
  render(
    <AuthContext.Provider value={authFor()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route path="/workspace/region/clubs/:id" element={<MyRegionClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function clubReady() {
  await screen.findByRole('heading', { level: 1, name: 'Example Knights Club' }, { timeout: 5000 })
  await act(async () => {})
}
const header = () => screen.getByRole('heading', { level: 1 }).closest('section') as HTMLElement
const tab = (name: string) => within(header()).getByRole('button', { name })
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')
/** The box the editor's About is typed in, found whether or not it is hidden. */
const aboutBox = () => screen.getByLabelText(ABOUT, { selector: 'textarea' }) as HTMLTextAreaElement
/** The wrapper the Listing tab's editor is drawn in. */
const editorWrapper = () => aboutBox().closest('[hidden], section > div') as HTMLElement

/** Whether an element, or one it sits in, is hidden from the page. */
function inHidden(el: Element): boolean {
  for (let at: Element | null = el; at; at = at.parentElement) {
    if ((at as HTMLElement).hidden || window.getComputedStyle(at).display === 'none') return true
  }
  return false
}
/** What the keyboard can reach: every control that takes the focus and sits in nothing hidden. */
function tabStops(): Element[] {
  return [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter((el) => el.getAttribute('tabindex') !== '-1' && !(el as HTMLButtonElement).disabled && !inHidden(el))
}

/** A promise the case lets go of when it chooses, for an answer on its way. */
function held() {
  let release: (r: Response) => void = () => {}
  const promise = new Promise<Response>((resolve) => { release = resolve })
  return { promise, release: (r: Response) => release(r) }
}

describe('a club\'s page in My region: the Listing tab across a change of tab', () => {
  it('keeps what was typed in About when the person goes to News and comes back', async () => {
    openClub()
    await clubReady()
    await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    fireEvent.change(aboutBox(), { target: { value: 'An example club that meets on Tuesdays.' } })
    await act(async () => { fireEvent.click(tab('News')) })
    await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
    await act(async () => { fireEvent.click(tab('Events')) })
    await act(async () => { fireEvent.click(tab('Listing')) })
    expect(screen.getByRole('textbox', { name: ABOUT })).toBe(aboutBox())
    expect(aboutBox().value).toBe('An example club that meets on Tuesdays.')
    // Nothing was sent on the way.
    expect(asked.filter((a) => a.startsWith('PATCH '))).toEqual([])
  })

  it('draws no editor before Listing is first opened, and once opened hides it from the keyboard and from what is read out while another tab shows', async () => {
    openClub(`/workspace/region/clubs/${ID}?tab=news`)
    await clubReady()
    await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
    expect(screen.queryByLabelText(ABOUT)).toBeNull()
    expect(screen.queryByText('Loading the editor…')).toBeNull()
    await act(async () => { fireEvent.click(tab('Listing')) })
    const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    expect(tabStops()).toContain(save)
    await act(async () => { fireEvent.click(tab('News')) })
    // The editor is still drawn, inside a wrapper marked hidden, so none of its controls is exposed or a stop for the keyboard.
    expect(aboutBox().isConnected).toBe(true)
    expect(editorWrapper().hidden).toBe(true)
    expect(window.getComputedStyle(editorWrapper()).display).toBe('none')
    expect(screen.queryByRole('button', { name: 'Save and publish' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: ABOUT })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Help/ })).toBeNull()
    const stops = tabStops()
    expect(stops).not.toContain(save)
    expect(stops).not.toContain(aboutBox())
    expect(stops.some((el) => editorWrapper().contains(el))).toBe(false)
    // The open tab is still the one marked current, and News's own form is reachable.
    expect(tab('News').getAttribute('aria-current')).toBe('true')
    expect(tab('Listing').getAttribute('aria-current')).toBeNull()
    expect(stops).toContain(screen.getByRole('button', { name: 'Post news' }))
  })

  it('opens none of the editor\'s Help by itself, keeps nothing in the browser, and takes no focus from the tabs when the person leaves Listing and comes back', async () => {
    window.localStorage.clear()
    openClub()
    await clubReady()
    await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    await act(async () => {})
    for (const mark of screen.getAllByRole('button', { name: /^Help: / })) expect(mark.getAttribute('aria-expanded')).toBe('false')
    expect(window.localStorage.length).toBe(0)
    const news = tab('News')
    news.focus()
    await act(async () => { fireEvent.click(news) })
    await act(async () => {})
    expect(document.activeElement).toBe(news)
    const listing = tab('Listing')
    listing.focus()
    await act(async () => { fireEvent.click(listing) })
    await act(async () => {})
    expect(document.activeElement).toBe(listing)
  })

  it('keeps what was typed after a refused save, across a change of tab', async () => {
    answers[`PATCH ${CLUB_URL}`] = () => json({ error: 'This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version' }, 409)
    openClub()
    await clubReady()
    const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    fireEvent.change(aboutBox(), { target: { value: 'An example club, rewritten.' } })
    await act(async () => { fireEvent.submit(save.closest('form') as HTMLFormElement) })
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Everything you typed is still here.'))
    await act(async () => { fireEvent.click(tab('News')) })
    await act(async () => { fireEvent.click(tab('Listing')) })
    expect(aboutBox().value).toBe('An example club, rewritten.')
    expect(screen.getByRole('alert').textContent).toContain('Nothing was saved:')
    expect(asked.filter((a) => a === `PATCH ${CLUB_URL}`)).toHaveLength(1)
  })
})

describe('a club\'s page in My region: News with nothing posted', () => {
  it('reads "Nothing posted yet." alone, with no sentence explaining the form beside it', async () => {
    answers[`GET ${CLUB_URL}/news`] = () => json({ news: [] })
    openClub(`/workspace/region/clubs/${ID}?tab=news`)
    await clubReady()
    await screen.findByRole('button', { name: 'Post news' }, { timeout: 5000 })
    const empty = screen.getByText('Nothing posted yet.')
    expect(empty.tagName).toBe('P')
    expect(empty.textContent).toBe('Nothing posted yet.')
    expect(document.body.textContent).not.toContain('appears on the club\'s public page')
  })
})

describe('a club\'s page in My region: the focus after Try again', () => {
  it('goes to the page\'s heading once the club comes on a second try', async () => {
    let calls = 0
    answers[`GET ${CLUB_URL}`] = () => (++calls === 1
      ? Promise.reject(new TypeError('Failed to fetch'))
      : json({ club: CLUB, officers: [], roster: [], rosterKeptBack: true, tournaments: [], places: [] }))
    openClub(`/workspace/region/clubs/${ID}?tab=events`)
    await screen.findByText(`The club could not be loaded: ${SITE_UNREACHED}`, undefined, { timeout: 5000 })
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(h1.className.split(' ')).toContain('outline-none')
    expect(document.activeElement).not.toBe(h1)
    const again = screen.getByRole('button', { name: 'Try again' })
    again.focus()
    await act(async () => { fireEvent.click(again) })
    await clubReady()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Example Knights Club' })))
    expect(calls).toBe(2)
  })

  it('goes to the page\'s heading once the news comes on a second try', async () => {
    let calls = 0
    answers[`GET ${CLUB_URL}/news`] = () => (++calls === 1 ? json({ error: 'Something broke' }, 500) : json({ news: NEWS }))
    openClub(`/workspace/region/clubs/${ID}?tab=news`)
    await clubReady()
    await screen.findByText(/^The club's news could not be loaded: /, undefined, { timeout: 5000 })
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { level: 1 }))
    const again = screen.getByRole('button', { name: 'Try again' })
    again.focus()
    await act(async () => { fireEvent.click(again) })
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Example Knights Club' })))
    expect(calls).toBe(2)
  })

  it('stays where the person is when the news comes on a second try after they moved to Listing and into About', async () => {
    const second = held()
    let calls = 0
    answers[`GET ${CLUB_URL}/news`] = () => (++calls === 1 ? json({ error: 'Something broke' }, 500) : second.promise)
    openClub(`/workspace/region/clubs/${ID}?tab=news`)
    await clubReady()
    await screen.findByText(/^The club's news could not be loaded: /, undefined, { timeout: 5000 })
    const again = screen.getByRole('button', { name: 'Try again' })
    again.focus()
    await act(async () => { fireEvent.click(again) })
    expect(statusText()).toContain('Loading the club\'s news…')
    await act(async () => { fireEvent.click(tab('Listing')) })
    await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
    aboutBox().focus()
    expect(document.activeElement).toBe(aboutBox())
    await act(async () => { second.release(json({ news: NEWS })) })
    await act(async () => {})
    expect(calls).toBe(2)
    expect(document.activeElement).toBe(aboutBox())
    // Back on News the list is there, and the change of tab moved the focus nowhere by itself.
    const news = tab('News')
    news.focus()
    await act(async () => { fireEvent.click(news) })
    await screen.findByRole('heading', { level: 2, name: 'Posted news · 1' }, { timeout: 5000 })
    expect(document.activeElement).toBe(news)
  })
})

describe('the status line after Still accurate', () => {
  it('on a club\'s page in My region: goes empty while a second press is on its way, then reads the words again', async () => {
    openClub(`/workspace/region/clubs/${ID}?tab=events`)
    await clubReady()
    const still = within(header()).getByRole('button', { name: 'Still accurate: Example Knights Club' })
    const words = 'Example Knights Club marked still accurate: Checked Nov 2026.'
    await act(async () => { fireEvent.click(still) })
    await waitFor(() => expect(statusText()).toContain(words))
    const second = held()
    answers[`POST ${CLUB_URL}/confirm`] = () => second.promise
    await act(async () => { fireEvent.click(still) })
    expect(statusText()).not.toContain(words)
    expect(screen.getAllByRole('status')[0].textContent).toBe('')
    await act(async () => { second.release(json(CONFIRMED)) })
    await waitFor(() => expect(statusText()).toContain(words))
  })

  it('on My region: goes empty while a second press is on its way, then reads the words again', async () => {
    render(
      <AuthContext.Provider value={authFor()}>
        <MemoryRouter initialEntries={['/workspace/region']}><MyRegionPage /></MemoryRouter>
      </AuthContext.Provider>,
    )
    await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
    await act(async () => {})
    const status = () => screen.getAllByRole('status').find((s) => s.tagName === 'P' && s.closest('section.mx-auto')) as HTMLElement
    const still = screen.getByRole('button', { name: 'Still accurate: Example Knights Club' })
    const words = 'Example Knights Club marked still accurate: Checked Nov 2026.'
    await act(async () => { fireEvent.click(still) })
    await waitFor(() => expect(status().textContent).toBe(words))
    const second = held()
    answers[`POST ${CLUB_URL}/confirm`] = () => second.promise
    await act(async () => { fireEvent.click(still) })
    expect(status().textContent).toBe('')
    await act(async () => { second.release(json(CONFIRMED)) })
    await waitFor(() => expect(status().textContent).toBe(words))
  })
})

describe('the LCA admin\'s button for the monthly check, when a call fails', () => {
  const CHECK = 'POST /api/admin/clubs/monthly-check'
  const COUNT = { month: 'November 2026', people: 4, sent: 0, notSent: 0, notReached: 0 }
  const lineOf = () => screen.getByRole('status')

  async function pressAndSend() {
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send this month\'s check now' })) })
    await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send to 4 people' })) })
  }

  it('says "Not sent" in the server\'s words for a refusal below 500, and that the send may not have finished for anything else', async () => {
    render(<MonthlyCheckButton />)
    const sends: Array<[Answer, string]> = [
      [() => json({ error: 'Forbidden' }, 403), 'Not sent: Forbidden.'],
      [() => Promise.reject(new TypeError('Failed to fetch')), SEND_UNSURE],
      [() => json({ error: 'Something broke' }, 500), SEND_UNSURE],
      [() => new Response('<html>A page from the edge</html>', { status: 200 }), SEND_UNSURE],
    ]
    for (const [answer, words] of sends) {
      let calls = 0
      answers[CHECK] = (body) => (++calls === 1 ? json(COUNT) : answer(body))
      await pressAndSend()
      await waitFor(() => expect(lineOf().textContent, words).toBe(words))
      expect(calls).toBe(2)
    }
    expect(SEND_UNSURE).not.toMatch(/^Not sent/)
  })

  it('says plainly that it could not ask how many people, and claims nothing about sending, when the first call fails', async () => {
    answers[CHECK] = () => Promise.reject(new TypeError('Failed to fetch'))
    render(<MonthlyCheckButton />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Send this month\'s check now' })) })
    await waitFor(() => expect(lineOf().textContent).toBe(`Could not ask how many people the check goes to: ${SITE_UNREACHED}`))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(asked.filter((a) => a === CHECK)).toHaveLength(1)
  })
})
