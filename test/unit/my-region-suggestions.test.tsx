// @vitest-environment jsdom
//
// The keeper's side of Suggest an update (WS09's twenty-eighth step) in My region and on
// a club's pages: a card with an open suggestion says "1 suggestion · 9
// days" in words and its button reads "Answer it, then confirm", which takes
// the focus to the club's row in the to-do list under the cards; each row
// names its club, which part, the visitor's words as text and its age, with
// Reply only when an address was left, Apply this and Not an issue; after
// each the row leaves the list, the list's status says what was done and the
// focus goes to the next row or the list's heading; Confirm all skips a club
// with one open and says how many it skipped; and the club's banner gives
// Fix the listing, Reply to visitor and Not an issue. With none open, My
// region draws no row, no list and no new words. The server is played by a
// stub of fetch; every club, person and word is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { OpenSuggestion, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'
import { RESOLVED_WORDS } from '@domain/clubs/suggestion'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { ClubSuggestionsBanner } = await import('@/areas/clubs/components/SuggestionRows')

const suggestionOf = (id: number, over: Partial<OpenSuggestion> = {}): OpenSuggestion => ({
  kind: 'suggestion', id, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 9, ...over,
})
function card(id: string, name: string, needsCheck: boolean, openItems: OpenSuggestion[] = []): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Lake Charles / Southwestern', color: null, logoUrl: null, statement: 'Tuesdays at 7:00 PM',
    lastConfirmedAt: null, lastCheckWords: needsCheck ? 'Not checked yet' : 'Checked Nov 2026', needsCheck, events: 0, openItems,
  }
}
function answerOf(clubs: RegionClub[]): WorkspaceRegionResponse {
  const notChecked = clubs.filter((c) => c.needsCheck).length
  return {
    clubs,
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: clubs.length - notChecked, notChecked },
    regions: [{ region: 'Lake Charles / Southwestern', keepers: [] }],
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, () => Response> = {}
beforeEach(() => {
  asked = []
  answers = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined })
    return answers[call]?.() ?? json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const auth = { role: 'member', member: { id: 'm-rep', role: 'member' }, managedClubs: [] } as unknown as AuthContextValue
function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}
async function page(clubs: RegionClub[]) {
  answers['GET /api/workspace/region'] = () => json(answerOf(clubs))
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes>
          <Route path="/workspace/region" element={<MyRegionPage />} />
          <Route path="/workspace/region/clubs/:id" element={<p>The club in My region</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Clubs' })
}
const cardOf = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement
const todo = () => screen.getByRole('region', { name: 'Suggestions to answer' })
const listStatus = () => within(todo()).getAllByRole('status')[0]

describe('My region with a suggestion open', () => {
  it('the card says it in words with the oldest\'s age, and its button reads Answer it, then confirm, taking the focus to the row', async () => {
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(7, { ageDays: 2 }), suggestionOf(4, { ageDays: 9 })]), card('c-rooks', 'Example Rooks Club', false)])
    const knights = cardOf('Example Knights Club')
    expect(within(knights).getByText('2 suggestions · 9 days')).toBeTruthy()
    expect(within(knights).queryByRole('button', { name: 'Still accurate: Example Knights Club' })).toBeNull()
    const answer = within(knights).getByRole('button', { name: 'Answer it, then confirm: Example Knights Club' })
    expect(answer.textContent).toBe('Answer it, then confirm')
    fireEvent.click(answer)
    // The oldest first in the list, so the card's press lands on it.
    expect(document.activeElement?.textContent).toBe('Example Knights Club: Venue or address')
    expect(document.activeElement?.closest('li')?.id).toBe('suggestion-4')
    // The card with none is as it was.
    expect(within(cardOf('Example Rooks Club')).getByRole('button', { name: 'Still accurate: Example Rooks Club' })).toBeTruthy()
    expect(cardOf('Example Rooks Club').querySelector('[data-slot="region-open-items"]')).toBeNull()
  })

  it('the to-do list names the club, the part, the words as text and the age, and offers Reply only when an address was left', async () => {
    const words = '<b>Not markup</b> averyveryveryveryveryveryveryveryveryveryveryverylongwordwithnospaceatall'
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(4, { message: words }), suggestionOf(5, { hasAddress: false, field: 'closed', ageDays: 0 })])])
    const rows = within(todo()).getAllByRole('listitem')
    expect(rows.map((r) => within(r).getByRole('heading', { level: 3 }).textContent)).toEqual(['Example Knights Club: Venue or address', 'Example Knights Club: The club has closed or moved'])
    const quote = rows[0].querySelector('blockquote')!
    expect(quote.textContent).toBe(words)
    expect(quote.querySelector('b')).toBeNull()
    expect(quote.className).toContain('[overflow-wrap:anywhere]')
    expect(within(rows[0]).getByText('Suggested 9 days ago')).toBeTruthy()
    expect(within(rows[1]).getByText('Suggested today')).toBeTruthy()
    expect(within(rows[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Reply', 'Apply this', 'Not an issue'])
    expect(within(rows[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Apply this', 'Not an issue'])
    expect(within(rows[1]).getByText('No email address was left, so there is no one to reply to.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/@/)
  })

  it('Not an issue takes the row out, says so in words, and puts the focus on the next row; the card then offers Still accurate again', async () => {
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(4), suggestionOf(5, { ageDays: 1, field: 'cost' })])])
    answers['POST /api/admin/clubs/c-knights/reports/4'] = () => json({ id: 4, status: 'dismissed' })
    answers['POST /api/admin/clubs/c-knights/reports/5'] = () => json({ id: 5, status: 'dismissed' })
    await act(async () => { fireEvent.click(within(todo()).getByRole('button', { name: 'Not an issue: Example Knights Club: Venue or address' })) })
    await waitFor(() => expect(listStatus().textContent).toBe(`Example Knights Club: ${RESOLVED_WORDS.dismissed}`))
    expect(JSON.parse(asked.find((a) => a.call === 'POST /api/admin/clubs/c-knights/reports/4')!.body!)).toEqual({ action: 'dismiss' })
    expect(within(todo()).getAllByRole('listitem').map((li) => li.id)).toEqual(['suggestion-5'])
    expect(document.activeElement?.id).toBe('suggestion-5-title')
    expect(within(cardOf('Example Knights Club')).getByText('1 suggestion · 1 day')).toBeTruthy()
    await act(async () => { fireEvent.click(within(todo()).getAllByRole('button', { name: /^Not an issue/ })[0]) })
    // The last row gone: the list's heading takes the focus, the status stays, and the card's Still accurate is back.
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Suggestions to answer'))
    expect(within(todo()).queryAllByRole('listitem')).toEqual([])
    expect(within(cardOf('Example Knights Club')).getByRole('button', { name: 'Still accurate: Example Knights Club' })).toBeTruthy()
  })

  it('Reply opens a box for the keeper\'s words, refuses an empty one in words, and sends the words; Apply this opens the club\'s listing', async () => {
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(4), suggestionOf(5)])])
    answers['POST /api/admin/clubs/c-knights/reports/4'] = () => json({ id: 4, status: 'answered' })
    answers['POST /api/admin/clubs/c-knights/reports/5'] = () => json({ id: 5, status: 'applied' })
    // The box with its buttons is brought into sight as it opens, so Send reply is not left under a phone's bottom bar.
    const brought: Element[] = []
    const had = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { brought.push(this) }
    fireEvent.click(within(todo()).getAllByRole('button', { name: /^Reply/ })[0])
    const box = within(todo()).getByLabelText('Your reply')
    await waitFor(() => expect(document.activeElement).toBe(box))
    if (had) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', had)
    else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    expect(brought.some((el) => el.contains(box) && el.contains(within(todo()).getByRole('button', { name: 'Send reply' })))).toBe(true)
    await act(async () => { fireEvent.click(within(todo()).getByRole('button', { name: 'Send reply' })) })
    expect(within(todo()).getByText('Write your reply.')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'Thanks. We have changed it.' } })
    await act(async () => { fireEvent.click(within(todo()).getByRole('button', { name: 'Send reply' })) })
    await waitFor(() => expect(listStatus().textContent).toBe(`Example Knights Club: ${RESOLVED_WORDS.answered}`))
    expect(JSON.parse(asked.find((a) => a.call === 'POST /api/admin/clubs/c-knights/reports/4')!.body!)).toEqual({ action: 'answer', message: 'Thanks. We have changed it.' })
    await act(async () => { fireEvent.click(within(todo()).getByRole('button', { name: /^Apply this/ })) })
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/workspace/region/clubs/c-knights'))
  })

  it('a row another keeper handled first is said in the server\'s words and leaves the list; a failure keeps it, in words', async () => {
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(4), suggestionOf(5)])])
    answers['POST /api/admin/clubs/c-knights/reports/4'] = () => json({ error: 'This suggestion was already handled, so nothing changed.' }, 409)
    answers['POST /api/admin/clubs/c-knights/reports/5'] = () => json({ error: 'Forbidden' }, 403)
    await act(async () => { fireEvent.click(within(todo()).getAllByRole('button', { name: /^Not an issue/ })[0]) })
    await waitFor(() => expect(listStatus().textContent).toBe('This suggestion was already handled, so nothing changed.'))
    expect(within(todo()).getAllByRole('listitem').map((li) => li.id)).toEqual(['suggestion-5'])
    await act(async () => { fireEvent.click(within(todo()).getByRole('button', { name: /^Not an issue/ })) })
    await waitFor(() => expect(within(todo()).getByText(/^Nothing changed: /)).toBeTruthy())
    expect(within(todo()).getAllByRole('listitem')).toHaveLength(1)
  })

  it('Confirm all skips a club with one open and says how many it skipped', async () => {
    await page([card('c-knights', 'Example Knights Club', true, [suggestionOf(4)]), card('c-rooks', 'Example Rooks Club', true), card('c-pawns', 'Example Pawns Club', true)])
    for (const id of ['c-rooks', 'c-pawns']) answers[`POST /api/admin/clubs/${id}/confirm`] = () => json({ id, lastConfirmedAt: '2026-11-24 18:00:00', lastCheckWords: 'Checked Nov 2026' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(screen.getAllByRole('status').some((s) => s.textContent === '2 clubs marked still accurate. 1 club with a suggestion waiting was skipped: answer it, then confirm.')).toBe(true))
    expect(asked.map((a) => a.call)).not.toContain('POST /api/admin/clubs/c-knights/confirm')
  })
})

describe('My region with no suggestion open', () => {
  it('draws no list, no open-items line, no new button and none of the new words', async () => {
    await page([card('c-knights', 'Example Knights Club', true), card('c-rooks', 'Example Rooks Club', false)])
    expect(screen.queryByRole('region', { name: 'Suggestions to answer' })).toBeNull()
    expect(document.querySelector('[data-slot="region-open-items"], [id^="suggestion-"]')).toBeNull()
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).not.toContain('Answer it, then confirm')
    expect(document.body.textContent).not.toMatch(/suggestion|Answer it, then|Not an issue|Apply this/i)
  })
})

describe('the club\'s banner', () => {
  it('gives Fix the listing, Reply to visitor and Not an issue, and Fix the listing hands the page its editor', async () => {
    const onApplied = vi.fn()
    answers['POST /api/admin/clubs/c-knights/reports/4'] = () => json({ id: 4, status: 'applied' })
    render(<ClubSuggestionsBanner suggestions={[suggestionOf(4), suggestionOf(5, { hasAddress: false })]} clubId="c-knights" clubName="Example Knights Club" onApplied={onApplied} />)
    const banner = screen.getByRole('region', { name: 'Suggestions from visitors' })
    const rows = within(banner).getAllByRole('listitem')
    expect(within(rows[0]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Reply to visitor', 'Fix the listing', 'Not an issue'])
    expect(within(rows[1]).getAllByRole('button').map((b) => b.textContent)).toEqual(['Fix the listing', 'Not an issue'])
    expect(within(banner).getByRole('button', { name: 'Help: Suggestions from visitors' }).getAttribute('aria-expanded')).toBe('false')
    await act(async () => { fireEvent.click(within(rows[0]).getByRole('button', { name: /^Fix the listing/ })) })
    await waitFor(() => expect(onApplied).toHaveBeenCalledTimes(1))
    expect(within(banner).getAllByRole('status')[0].textContent).toBe(RESOLVED_WORDS.applied)
    expect(within(banner).getAllByRole('listitem')).toHaveLength(1)
  })

  it('draws nothing at all with no suggestion', () => {
    const { container } = render(<ClubSuggestionsBanner suggestions={[]} clubId="c-knights" clubName="Example Knights Club" onApplied={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
