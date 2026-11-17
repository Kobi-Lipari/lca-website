// @vitest-environment jsdom
//
// My region (WS09 step 11), the edges beside my-region-page.test.tsx: a second
// press on a card that is already on its way, a failure followed by a press
// that works, Confirm all while a card is already being marked, a run where
// every club fails, a run cut off by leaving the page, a sign-in that has
// ended, an answer that never comes, the page's words for a seat holder and
// for an LCA admin with Help open, and the words the page draws with the
// clock at midnight and on a change of clocks in America/Chicago, where it
// still says only what the server said. The page is drawn alone through the
// real client with fetch stubbed, so each request is read as it leaves the
// browser. Every name, club and address here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import { confirmClubStillAccurate, getWorkspaceRegion } from '@/areas/clubs/api'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

vi.setConfig({ testTimeout: 15000 })

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')

function card(id: string, name: string, needsCheck: boolean, lastCheckWords: string, extra: Partial<RegionClub> = {}): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement: null,
    lastConfirmedAt: needsCheck ? null : '2026-11-02 15:00:00', lastCheckWords, needsCheck, events: 1, openItems: [], ...extra,
  }
}
const NEXT = { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }
function answerOf(clubs: RegionClub[]): WorkspaceRegionResponse {
  const notChecked = clubs.filter((c) => c.needsCheck).length
  return {
    clubs,
    thisMonth: { nextCheck: NEXT, checked: clubs.length - notChecked, notChecked },
    regions: [{ region: 'Bayou Region', keepers: [] }],
  }
}
const KNIGHTS = card('c-knights', 'Example Knights Club', true, 'Not checked since Aug 2026')
const ROOKS = card('c-rooks', 'Example Rooks Club', true, 'Not checked yet')
const CHESS = card('c-chess', 'Example Chess Club', false, 'Checked Nov 2026')
const ANSWER = answerOf([KNIGHTS, ROOKS, CHESS])
const confirmed = (id: string) => ({ id, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' })

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string; auth?: string }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(REGION_HELP_SHOWN_KEY, 'shown')
  asked = []
  answers = {
    'GET /api/workspace/region': () => json(ANSWER),
    'POST /api/admin/clubs/c-knights/confirm': () => json(confirmed('c-knights')),
    'POST /api/admin/clubs/c-rooks/confirm': () => json(confirmed('c-rooks')),
    'POST /api/admin/clubs/c-chess/confirm': () => json(confirmed('c-chess')),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const headers = (init?.headers ?? {}) as Record<string, string>
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined, auth: headers.Authorization })
    const answer = answers[call]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const posts = () => asked.filter((a) => a.call.startsWith('POST ')).map((a) => a.call)

function mount(role: 'member' | 'lca_admin' = 'member') {
  const auth = {
    user: { id: 'm-one' }, session: null, role, member: { id: 'm-one', role, club_id: null, full_name: 'Player One' },
    loading: false, memberLoading: false,
    seats: role === 'member' ? [{ id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }] : [],
    managedClubs: [], isBoardMember: role === 'member', assuranceLevel: 'aal1', mfaRequired: false, directedTournamentIds: [], directedTournaments: [],
  } as unknown as AuthContextValue
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={['/workspace/region']}><MyRegionPage /></MemoryRouter>
    </AuthContext.Provider>,
  )
}
async function page(role: 'member' | 'lca_admin' = 'member') {
  const view = mount(role)
  await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
  await act(async () => {})
  return view
}
const cardOf = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement
const stampOf = (name: string) => cardOf(name).querySelector('[data-slot="region-stamp"]')?.textContent
const still = (name: string) => screen.getByRole('button', { name: `Still accurate: ${name}` })
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')
const barText = () => (screen.getByRole('heading', { level: 2, name: 'This month' }).closest('section') as HTMLElement).textContent

/** A response held until the case lets it go, so a press can be read while it is on the way. */
function held() {
  let release: (r: Response) => void = () => {}
  const wait = new Promise<Response>((r) => { release = r })
  return { wait: () => wait, release: (r: Response) => release(r) }
}

describe('My region: a card already on its way', () => {
  it('ignores a second press on a card that is being marked, marks it busy for a reader, and sends one request', async () => {
    const gate = held()
    answers['POST /api/admin/clubs/c-knights/confirm'] = gate.wait
    await page()
    const button = still('Example Knights Club')
    button.focus()
    await act(async () => { fireEvent.click(button) })
    await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('true'))
    await act(async () => { fireEvent.click(button); fireEvent.click(button) })
    expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm'])
    expect(document.activeElement).toBe(button)
    await act(async () => { gate.release(json(confirmed('c-knights'))) })
    await waitFor(() => expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026'))
    expect(button.getAttribute('aria-disabled')).toBeNull()
    // A replay of the same press is a second stamp of the same card: the counts do not move twice.
    await act(async () => { fireEvent.click(button) })
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(barText()).toContain('2 of 3 checked in the last 90 days')
    expect(barText()).toContain('1 not checked in 90 days')
  })

  it('says a failure at the card, then clears it when the next press works', async () => {
    answers['POST /api/admin/clubs/c-knights/confirm'] = () => json({ error: 'Something went wrong' }, 500)
    await page()
    await act(async () => { fireEvent.click(still('Example Knights Club')) })
    await within(cardOf('Example Knights Club')).findByText('Not marked: Something went wrong. Nothing changed.')
    answers['POST /api/admin/clubs/c-knights/confirm'] = () => json(confirmed('c-knights'))
    await act(async () => { fireEvent.click(still('Example Knights Club')) })
    await waitFor(() => expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026'))
    expect(within(cardOf('Example Knights Club')).queryByText(/Not marked/)).toBeNull()
    expect(statusText()).toContain('Example Knights Club marked still accurate: Checked Nov 2026.')
  })

  it('does not mark a card twice when Confirm all runs while that card is already on its way', async () => {
    const gate = held()
    answers['POST /api/admin/clubs/c-knights/confirm'] = gate.wait
    await page()
    await act(async () => { fireEvent.click(still('Example Knights Club')) })
    await waitFor(() => expect(still('Example Knights Club').getAttribute('aria-disabled')).toBe('true'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /^Mark \d clubs?$/ })) })
    await act(async () => { gate.release(json(confirmed('c-knights'))) })
    await waitFor(() => expect(stampOf('Example Rooks Club')).toBe('Checked Nov 2026'))
    expect(posts().filter((p) => p.includes('/c-knights/'))).toHaveLength(1)
  })

  it('passes over a card pressed by hand while Confirm all is on its way, so that card is sent once', async () => {
    const gate = held()
    answers['POST /api/admin/clubs/c-knights/confirm'] = gate.wait
    await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm']))
    await act(async () => { fireEvent.click(still('Example Rooks Club')) })
    await waitFor(() => expect(stampOf('Example Rooks Club')).toBe('Checked Nov 2026'))
    await act(async () => { gate.release(json(confirmed('c-knights'))) })
    await waitFor(() => expect(statusText()).toContain('1 club marked still accurate.'))
    expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm', 'POST /api/admin/clubs/c-rooks/confirm'])
    expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026')
  })
})

describe('My region: Confirm all', () => {
  it('says so while it runs, refuses a second run, and ends with the count', async () => {
    const gate = held()
    answers['POST /api/admin/clubs/c-knights/confirm'] = gate.wait
    await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(statusText()).toContain('Marking 2 clubs'))
    const all = screen.getByRole('button', { name: 'Confirm all still accurate' })
    expect(all.getAttribute('aria-disabled')).toBe('true')
    await act(async () => { fireEvent.click(all) })
    expect(screen.queryByRole('dialog')).toBeNull()
    // One club after another: the second waits for the first.
    expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm'])
    await act(async () => { gate.release(json(confirmed('c-knights'))) })
    await waitFor(() => expect(statusText()).toContain('2 clubs marked still accurate.'))
    expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm', 'POST /api/admin/clubs/c-rooks/confirm'])
  })

  it('names every club when none could be marked and leaves each as it was', async () => {
    answers['POST /api/admin/clubs/c-knights/confirm'] = () => json({ error: 'Forbidden' }, 403)
    answers['POST /api/admin/clubs/c-rooks/confirm'] = () => json({ error: 'Something went wrong' }, 500)
    await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(statusText()).toContain('None of the 2 clubs could be marked still accurate. Not marked: Example Knights Club and Example Rooks Club. They are as they were.'))
    expect(stampOf('Example Knights Club')).toBe('Not checked since Aug 2026')
    expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
    expect(barText()).toContain('1 of 3 checked in the last 90 days')
    expect(screen.getByRole('button', { name: 'Confirm all still accurate' })).toBeTruthy()
  })

  it('stops asking the server once the person has left the page', async () => {
    const gate = held()
    answers['POST /api/admin/clubs/c-knights/confirm'] = gate.wait
    const view = await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(posts()).toHaveLength(1))
    view.unmount()
    await act(async () => { gate.release(json(confirmed('c-knights'))) })
    await act(async () => {})
    expect(posts()).toEqual(['POST /api/admin/clubs/c-knights/confirm'])
  })
})

describe('My region: a load that does not come', () => {
  it('says a sign-in that has ended in words with a way back, and offers no Try again', async () => {
    answers['GET /api/workspace/region'] = () => json({ error: 'Unauthorized' }, 401)
    mount()
    await screen.findByText('Your sign-in has ended. Sign in again, then come back to this page.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to My LCA' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Confirm all still accurate' })).toBeNull()
  })

  it('says a server that cannot be reached in words with Try again, and Try again asks once more', async () => {
    let tries = 0
    answers['GET /api/workspace/region'] = () => {
      tries++
      if (tries === 1) throw new TypeError('Failed to fetch')
      return json(ANSWER)
    }
    mount()
    await screen.findByText(/^My region could not be loaded: /, undefined, { timeout: 5000 })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
    expect(tries).toBe(2)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })
})

describe('My region: the same words for the person signed in', () => {
  it('names the seat for a seat holder and every region for an LCA admin, in Help, never "your region" for the admin', async () => {
    window.localStorage.clear()
    await page('member')
    expect(document.getElementById('my-region-help')?.textContent).toContain('the clubs your seat keeps')
    cleanup()
    window.localStorage.clear()
    await page('lca_admin')
    const help = document.getElementById('my-region-help')?.textContent ?? ''
    expect(help).toContain('every region\'s clubs')
    expect(document.body.textContent).not.toMatch(/your (?:region|seat)/i)
  })

  it('keeps the plain-language rules in every word on the page: US Chess, no .5, no long dash, no hour the monthly check does not yet keep', async () => {
    window.localStorage.clear()
    for (const role of ['member', 'lca_admin'] as const) {
      await page(role)
      const text = document.body.textContent ?? ''
      expect(text).not.toMatch(new RegExp(['US', 'CF'].join('')))
      expect(text).not.toMatch(/\d\.5\b/)
      expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
      expect(text).not.toMatch(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm|a\.m\.|p\.m\.)\b/)
      expect(text).not.toContain('8:00 AM')
      expect(text).not.toMatch(/@/)
      cleanup()
      window.localStorage.clear()
    }
  })

  it('draws the server\'s words unchanged with the clock at midnight and on the change of clocks in America/Chicago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Midnight at the start of Monday, December 7, 2026 in Chicago, and the hour the clocks went back on Sunday, November 1, 2026.
    for (const at of ['2026-12-07T06:00:00Z', '2026-11-01T06:30:00Z']) {
      vi.setSystemTime(new Date(at))
      await page()
      expect(barText()).toContain('Next monthly check lands Mon, Dec 7, 2026')
      expect(stampOf('Example Chess Club')).toBe('Checked Nov 2026')
      expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
      cleanup()
    }
  })
})

describe('My region: the calls in src/areas/clubs/api.ts', () => {
  it('sends the sign-in with the answer\'s request and a body of {} with each confirm, the club\'s id written safely into the address', async () => {
    answers['GET /api/workspace/region'] = () => json(ANSWER)
    answers['POST /api/admin/clubs/c%2Fodd%20id/confirm'] = () => json(confirmed('c/odd id'))
    expect(await getWorkspaceRegion()).toEqual(ANSWER)
    expect(await confirmClubStillAccurate('c/odd id')).toEqual(confirmed('c/odd id'))
    expect(asked).toEqual([
      { call: 'GET /api/workspace/region', body: undefined, auth: 'Bearer tok-example' },
      { call: 'POST /api/admin/clubs/c%2Fodd%20id/confirm', body: '{}', auth: 'Bearer tok-example' },
    ])
  })

  it('raises the server\'s words on a refusal, so the page can say them', async () => {
    answers['GET /api/workspace/region'] = () => json({ error: 'My region is for the holders of a regional representative\'s seat and the LCA admins.' }, 403)
    await expect(getWorkspaceRegion()).rejects.toMatchObject({ status: 403, message: 'My region is for the holders of a regional representative\'s seat and the LCA admins.' })
  })
})
