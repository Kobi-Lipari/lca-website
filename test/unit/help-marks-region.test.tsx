// @vitest-environment jsdom
//
// My region's Help as small question marks (K's decision 16): three marks,
// after the This month bar's heading, straight after Confirm all still
// accurate while that button is drawn, and after the Clubs heading, and none
// on a club's card. Together they hold every sentence of the Help list as it
// stood before the marks (test/unit/fixtures/help-words-before.json, made
// from the base's RegionHelp.tsx), word for word, for a representative and
// for an LCA admin. Nothing opens by itself and nothing is kept in the
// browser. The page is drawn alone with fetch stubbed; every name, club and
// address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'

vi.setConfig({ testTimeout: 15000 })

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { MyRegionPage } = await import('@/pages/MyRegionPage')

const ROOT = resolve(__dirname, '../..')
const BEFORE = JSON.parse(readFileSync(join(ROOT, 'test/unit/fixtures/help-words-before.json'), 'utf8')) as { region: Record<string, Array<[string, string]>> }

function card(id: string, name: string, needsCheck: boolean, lastCheckWords: string): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement: null,
    lastConfirmedAt: needsCheck ? null : '2026-11-02 15:00:00', lastCheckWords, needsCheck, events: 1, openItems: [],
  }
}
const KNIGHTS = card('c-knights', 'Example Knights Club', true, 'Not checked since Aug 2026')
const CHESS = card('c-chess', 'Example Chess Club', false, 'Checked Nov 2026')
function answerOf(clubs: RegionClub[]): WorkspaceRegionResponse {
  const notChecked = clubs.filter((c) => c.needsCheck).length
  return {
    clubs,
    thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: clubs.length - notChecked, notChecked },
    regions: [{ region: 'Bayou Region', keepers: [] }],
  }
}
let answer = answerOf([KNIGHTS, CHESS])

beforeEach(() => {
  window.localStorage.clear()
  answer = answerOf([KNIGHTS, CHESS])
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/workspace/region'
    ? new Response(JSON.stringify(answer), { status: 200 })
    : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }))))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function page(role: 'member' | 'lca_admin') {
  const auth = {
    user: { id: 'm-one' }, session: null, role, member: { id: 'm-one', role, club_id: null, full_name: 'Player One' },
    loading: false, memberLoading: false,
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
}

const marks = () => screen.getAllByRole('button', { name: /^Help: / })
const bubbleOf = (mark: HTMLElement) => document.getElementById(mark.getAttribute('aria-controls') ?? '') as HTMLElement
/** A bubble's entries, as its terms and words. */
const entriesOf = (mark: HTMLElement) => [...bubbleOf(mark).querySelectorAll('dl > div')].map((row) => [row.querySelector('dt')?.textContent, row.querySelector('dd')?.textContent])

describe('My region\'s Help, behind three marks', () => {
  for (const [role, key] of [['member', 'isAdmin=false'], ['lca_admin', 'isAdmin=true']] as const) {
    it(`holds every sentence of the list as it stood, word for word, for ${role === 'member' ? 'a representative' : 'an LCA admin'}, and no other`, async () => {
      await page(role)
      const list = BEFORE.region[key]
      expect(list).toHaveLength(7)
      const [month, confirm, clubs] = marks()
      expect(marks().map((m) => m.getAttribute('aria-label'))).toEqual(['Help: This month', 'Help: Confirm all still accurate', 'Help: Clubs'])
      const byTerm = new Map(list)
      // The bar's heading: the monthly check and the 90 days, each named by its term.
      expect(entriesOf(month)).toEqual([['The monthly check', byTerm.get('The monthly check')], ['The 90 days', byTerm.get('The 90 days')]])
      // Confirm all's own, its words alone.
      expect(bubbleOf(confirm).textContent).toBe(byTerm.get('Confirm all still accurate'))
      expect(bubbleOf(confirm).querySelector('dt')).toBeNull()
      // The Clubs heading: what the page is, Still accurate, Open and who sees the stamps.
      expect(entriesOf(clubs)).toEqual(['What this page is', 'Still accurate', 'Open', 'Who sees the stamps'].map((term) => [term, byTerm.get(term)]))
      // Seven entries in all, each once.
      const terms = [month, clubs].flatMap((m) => entriesOf(m).map(([term]) => term)).concat('Confirm all still accurate')
      expect([...terms].sort()).toEqual(list.map(([term]) => term).sort())
      if (role === 'lca_admin') expect(document.body.textContent).not.toMatch(/your (?:region|seat)/i)
      else expect(bubbleOf(clubs).textContent).toContain('the clubs your seat keeps')
    })
  }

  it('stands each mark after its heading or button, outside it, and puts none on a club\'s card, the band, the admin\'s note or the monthly check\'s button', async () => {
    await page('lca_admin')
    const [month, confirm, clubs] = marks()
    const before = (mark: HTMLElement) => mark.parentElement?.previousElementSibling as HTMLElement
    expect(before(month)).toBe(screen.getByRole('heading', { level: 2, name: 'This month' }))
    expect(before(confirm)).toBe(screen.getByRole('button', { name: 'Confirm all still accurate' }))
    expect(before(clubs)).toBe(screen.getByRole('heading', { level: 2, name: 'Clubs' }))
    for (const name of ['Example Knights Club', 'Example Chess Club']) {
      const article = screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement
      expect(within(article).queryByRole('button', { name: /^Help/ }), name).toBeNull()
    }
    expect(marks()).toHaveLength(3)
    // The headings keep their names, and Help's old button and panel are gone.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(expect.arrayContaining(['This month', 'Clubs']))
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull()
    expect(document.getElementById('my-region-help')).toBeNull()
  })

  it('draws Confirm all\'s mark only while that button is drawn', async () => {
    answer = answerOf([CHESS])
    await page('member')
    expect(screen.queryByRole('button', { name: 'Confirm all still accurate' })).toBeNull()
    expect(marks().map((m) => m.getAttribute('aria-label'))).toEqual(['Help: This month', 'Help: Clubs'])
  })

  it('opens nothing by itself, moves no focus, keeps nothing in the browser, and opens one bubble at a time', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await page('member')
    for (const mark of marks()) {
      expect(mark.getAttribute('aria-expanded')).toBe('false')
      expect(bubbleOf(mark).hidden).toBe(true)
    }
    expect(document.activeElement).toBe(document.body)
    const [month, , clubs] = marks()
    await act(async () => { fireEvent.click(month) })
    await act(async () => { fireEvent.click(clubs) })
    expect(bubbleOf(month).hidden).toBe(true)
    expect(bubbleOf(clubs).hidden).toBe(false)
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    // The page's own status line stays the one live region.
    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(document.querySelectorAll('[data-slot="help-mark-bubble"][role], [data-slot="help-mark-bubble"][aria-live]')).toHaveLength(0)
  })
})
