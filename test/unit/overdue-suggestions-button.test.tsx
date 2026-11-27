// @vitest-environment jsdom
//
// The 14 days on the keeper's pages (WS09's twenty-ninth step): My region's
// button
// "Send overdue suggestions on", for an LCA admin alone and only while a row
// of the to-do list has waited 14 days or more and has not been passed on;
// its one question in words, singular for one; what a press did, said in
// words in a status, with the focus back on the button; and the line a row
// passed on carries, "Passed to the LCA admins on Mon, Nov 23, 2026", on the
// to-do list and on a club's banner alike. A representative never sees the
// button, nor does an admin with no row overdue, and a row not passed on
// draws no line. The server is played by a stub of fetch; every club, person
// and word is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { OpenSuggestion, RegionClub, WorkspaceRegionResponse } from '@domain/contracts'
import { overdueQuestion, overdueSentWords } from '@/areas/clubs/overdueWords'
import { passedOnWords } from '@/areas/clubs/suggestionRows'

vi.setConfig({ testTimeout: 15000 })
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')
const { ClubSuggestionsBanner } = await import('@/areas/clubs/components/SuggestionRows')

const suggestionOf = (id: number, over: Partial<OpenSuggestion> = {}): OpenSuggestion => ({
  kind: 'suggestion', id, field: 'venue', message: 'The club meets at the Example Library now.', hasAddress: true, ageDays: 9, ...over,
})
function card(id: string, name: string, openItems: OpenSuggestion[] = []): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Lake Charles / Southwestern', color: null, logoUrl: null, statement: 'Tuesdays at 7:00 PM',
    lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 0, openItems,
  }
}
function answerOf(clubs: RegionClub[]): WorkspaceRegionResponse {
  return {
    clubs,
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: clubs.length },
    regions: [{ region: 'Lake Charles / Southwestern', keepers: [] }],
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, Array<() => Response>> = {}
beforeEach(() => {
  asked = []
  answers = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const body = typeof init?.body === 'string' ? init.body : undefined
    asked.push({ call, body })
    const queue = answers[`${call} ${body ?? ''}`.trim()] ?? answers[call]
    const next = queue && queue.length > 1 ? queue.shift()! : queue?.[0]
    return next?.() ?? json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const authOf = (role: string) => ({ role, member: { id: 'm-1', role }, managedClubs: [] }) as unknown as AuthContextValue
async function page(clubs: RegionClub[], role = 'lca_admin') {
  answers['GET /api/workspace/region'] = [() => json(answerOf(clubs))]
  render(
    <AuthContext.Provider value={authOf(role)}>
      <MemoryRouter initialEntries={['/workspace/region']}>
        <Routes>
          <Route path="/workspace/region" element={<MyRegionPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 2, name: 'Clubs' })
}
const todo = () => screen.getByRole('region', { name: 'Suggestions to answer' })
const button = () => screen.queryByRole('button', { name: 'Send overdue suggestions on' })
const ASK = 'POST /api/admin/clubs/monthly-check {"action":"run_report_clock","send":false}'
const SEND = 'POST /api/admin/clubs/monthly-check {"action":"run_report_clock","send":true}'

describe('the button', () => {
  it('is drawn for an LCA admin under the to-do list\'s heading while a row has waited 14 days, and asks one question first', async () => {
    await page([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 14 }), suggestionOf(5, { ageDays: 20 })])])
    const at = button()!
    expect(todo().contains(at)).toBe(true)
    // Under the heading, before the list's rows.
    const heading = within(todo()).getByRole('heading', { level: 2, name: 'Suggestions to answer' })
    expect(heading.compareDocumentPosition(at) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(at.compareDocumentPosition(within(todo()).getAllByRole('listitem')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    answers[ASK] = [() => json({ due: 2, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })]
    fireEvent.click(at)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toBe('2 suggestions have waited 14 days or more with no answer. Send them on now?')
    expect(asked.filter((a) => a.call.startsWith('POST'))).toEqual([{ call: 'POST /api/admin/clubs/monthly-check', body: '{"action":"run_report_clock","send":false}' }])
    // Cancel leaves everything as it was and puts the focus back on the button.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(button()))
    expect(asked.filter((a) => a.body?.includes('"send":true'))).toEqual([])
  })

  it('sends on, says what happened in words, keeps the focus on the button, and the rows read again show their line', async () => {
    await page([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 15 })])])
    answers[ASK] = [() => json({ due: 1, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })]
    answers[SEND] = [() => json({ due: 1, passedOn: 1, sent: 3, notSent: 0, notReached: 0 })]
    answers['GET /api/workspace/region'] = [() => json(answerOf([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 15, passedOnAt: '2026-11-23 18:00:00' })])]))]
    fireEvent.click(button()!)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading').textContent).toBe('1 suggestion has waited 14 days or more with no answer. Send it on now?')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Send on' })) })
    await waitFor(() => expect(within(todo()).getByText('1 suggestion passed on: 3 emails sent, 0 not sent.')).toBeTruthy())
    const status = within(todo()).getByText('1 suggestion passed on: 3 emails sent, 0 not sent.')
    expect(status.getAttribute('role')).toBe('status')
    await waitFor(() => expect(document.activeElement).toBe(button()))
    await waitFor(() => expect(within(todo()).getByText('Passed to the LCA admins on Mon, Nov 23, 2026')).toBeTruthy())
  })

  it('asks by the count alone, in both forms, naming no one it goes to', () => {
    expect(overdueQuestion(1)).toBe('1 suggestion has waited 14 days or more with no answer. Send it on now?')
    expect(overdueQuestion(3)).toBe('3 suggestions have waited 14 days or more with no answer. Send them on now?')
    for (const n of [1, 2, 9]) expect(overdueQuestion(n)).not.toMatch(/admins|representative/)
  })

  it('is not drawn for an admin when no row has waited 14 days, nor for a passed-on row, nor ever for a region\'s representative', async () => {
    await page([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 13 }), suggestionOf(5, { ageDays: 30, passedOnAt: '2026-11-20 15:00:00' })])])
    expect(button()).toBeNull()
    cleanup()
    await page([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 30 })])], 'member')
    expect(within(todo()).getAllByRole('listitem')).toHaveLength(1)
    expect(button()).toBeNull()
    expect(asked.filter((a) => a.call.startsWith('POST'))).toEqual([])
  })

  it('says a refusal in the server\'s words, and nothing waiting in plain words', async () => {
    await page([card('c-knights', 'Example Knights Club', [suggestionOf(4, { ageDays: 15 })])])
    answers[ASK] = [() => json({ due: 0, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })]
    fireEvent.click(button()!)
    await waitFor(() => expect(within(todo()).getByText('No suggestion is waiting to be sent on now.')).toBeTruthy())
    answers[ASK] = [() => json({ error: 'Two-factor authentication is required for admin access. Set it up in your account security settings.', mfaRequired: true }, 403)]
    fireEvent.click(button()!)
    await waitFor(() => expect(within(todo()).getByText('Could not ask how many suggestions are waiting: Two-factor authentication is required for admin access. Set it up in your account security settings.')).toBeTruthy())
  })
})

describe('the words', () => {
  it('count in words and say what waits for another press', () => {
    expect(overdueQuestion(3)).toBe('3 suggestions have waited 14 days or more with no answer. Send them on now?')
    expect(overdueSentWords({ due: 3, passedOn: 2, sent: 7, notSent: 1, notReached: 1 })).toBe('2 suggestions passed on: 7 emails sent, 1 not sent. 1 more suggestion waits: press again to send it on.')
    expect(overdueSentWords({ due: 1, passedOn: 0, sent: 0, notSent: 2, notReached: 0 })).toBe('None could be passed on: 0 emails sent, 2 not sent. It is still waiting, so you can try again later.')
    expect(overdueSentWords({ due: 0, passedOn: 0, sent: 0, notSent: 0, notReached: 0 })).toBe('No suggestion is waiting to be sent on now.')
    // Some passed on and another's emails all refused: the one left is named as still waiting.
    expect(overdueSentWords({ due: 2, passedOn: 1, sent: 2, notSent: 2, notReached: 0 })).toBe('1 suggestion passed on: 2 emails sent, 2 not sent. 1 more could not be passed on and is still waiting, so you can try again later.')
    expect(overdueSentWords({ due: 5, passedOn: 1, sent: 1, notSent: 4, notReached: 2 })).toBe('1 suggestion passed on: 1 email sent, 4 not sent. 2 more could not be passed on and are still waiting, so you can try again later. 2 more suggestions wait: press again to send them on.')
    // The only one tried was answered by a keeper first, and one more did not fit: only the one that waits is named.
    expect(overdueSentWords({ due: 1, passedOn: 0, sent: 0, notSent: 0, notReached: 1 })).toBe('1 more suggestion waits: press again to send it on.')
    for (const words of [overdueQuestion(1), overdueQuestion(2), passedOnWords('2026-11-23 18:00:00')]) expect(words).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })

  it('give the passed-on day in Central time with its weekday, across a change of the clock', () => {
    expect(passedOnWords('2026-11-23 18:00:00')).toBe('Passed to the LCA admins on Mon, Nov 23, 2026')
    // 3:30 AM UTC on Monday is 9:30 PM on Sunday in Central time.
    expect(passedOnWords('2026-11-02 03:30:00')).toBe('Passed to the LCA admins on Sun, Nov 1, 2026')
    expect(passedOnWords('2026-03-09 04:30:00')).toBe('Passed to the LCA admins on Sun, Mar 8, 2026')
  })
})

describe('the line on a club\'s banner', () => {
  it('a passed-on row says so under its age; one not passed on draws no line', () => {
    render(
      <MemoryRouter>
        <ClubSuggestionsBanner suggestions={[suggestionOf(4, { ageDays: 16, passedOnAt: '2026-11-23 18:00:00' }), suggestionOf(5, { ageDays: 3 })]} clubId="c-knights" clubName="Example Knights Club" onApplied={() => {}} />
      </MemoryRouter>,
    )
    const [passed, fresh] = screen.getAllByRole('listitem')
    expect(within(passed).getByText('Suggested 16 days ago').nextElementSibling?.textContent).toBe('Passed to the LCA admins on Mon, Nov 23, 2026')
    expect(within(fresh).queryByText(/Passed to/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Send overdue suggestions on' })).toBeNull()
  })
})
