// @vitest-environment jsdom
//
// My region (WS09 step 11), through the site's own routes in src/App.tsx at
// /workspace/region. With clubKeepers off, which is how the step ships, the
// route sends every kind of person to the dashboard, the page's file is
// never fetched and no call reaches My region's answer. With it on, which
// this file turns on through a getter on the mocked FEATURES, a holder of an
// active regional seat gets in whatever their role and so does an LCA admin,
// while a guest, a plain member, a club's rep with no seat and the holder of
// an officer's seat are sent away; the page draws the server's cards in the
// server's order with their stamps in words, Still accurate on one card and
// Confirm all after one question, a failure among them, and each state no
// board draws. The real page runs through the real client with fetch
// stubbed, so each request is read as it would leave the browser; the site's
// header, footer, banners and the dashboard are stood in for. Every name,
// club and address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HELP_SHOWN_KEY } from '@/areas/clubs/editor'
import { REGION_HELP_SHOWN_KEY } from '@/areas/clubs/region'
import type { RegionClub, WorkspaceRegionResponse } from '@domain/contracts'
import { contrast } from './helpers/cssTokens'

// Each case may wait up to 5 seconds for the page's file to load, so each case has 15 seconds.
vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: false }))
/** Whether the page's file was ever fetched, read by the cases with the switch off, which run first. */
const loaded = vi.hoisted(() => ({ page: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/pages/MyRegionPage', async (importOriginal) => {
  loaded.page = true
  return importOriginal()
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/components/layout/Navbar', () => ({ Navbar: () => null }))
vi.mock('@/components/layout/Footer', () => ({ Footer: () => null }))
vi.mock('@/components/AnnouncementBanner', () => ({ AnnouncementBanner: () => null }))
vi.mock('@/components/ImpersonationBanner', () => ({ ImpersonationBanner: () => null }))
vi.mock('@/components/auth/PasswordRecoveryRedirect', () => ({ PasswordRecoveryRedirect: () => null }))
vi.mock('@/pages/DashboardPage', async () => {
  const { createElement } = await import('react')
  return { DashboardPage: () => createElement('p', null, 'The dashboard') }
})
vi.mock('@/pages/WorkspacePage', async () => {
  const { createElement } = await import('react')
  return { WorkspacePage: () => createElement('p', null, 'The workspace') }
})
vi.mock('@/pages/YourClubPage', async () => {
  const { createElement } = await import('react')
  const { useParams } = await import('react-router-dom')
  return { YourClubPage: () => createElement('p', null, `Your club's page for ${useParams().slug}`) }
})

const { default: App } = await import('@/App')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** A made-up card as the server answers it. */
function card(id: string, name: string, needsCheck: boolean, lastCheckWords: string, statement: string | null, extra: Partial<RegionClub> = {}): RegionClub {
  return {
    id, name, city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement,
    lastConfirmedAt: lastCheckWords === 'Not checked yet' ? null : '2026-08-03 15:00:00', lastCheckWords, needsCheck, events: 2, openItems: [], ...extra,
  }
}
/** The server's order, needs a check first and then A to Z, which is not the order of the names alone. */
const KNIGHTS = card('c-knights', 'Example Knights Club', true, 'Not checked since Aug 2026', null)
const ROOKS = card('c-rooks', 'Example Rooks Club', true, 'Not checked yet', 'Second Saturdays at the Example Library', { region: 'North of Lake Pontchartrain', color: '#C8A94A' })
const CHESS = card('c-chess', 'Example Chess Club', false, 'Checked Nov 2026', 'Tuesdays at 7:00 PM at the Example Community Center, upstairs in the room by the stairs, with boards and clocks for everyone who comes', { lastConfirmedAt: '2026-11-02 15:00:00', logoUrl: 'https://example.org/logo.png', color: null })
const NEXT = { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }
function answerOf(clubs: RegionClub[], regions = ['Bayou Region', 'North of Lake Pontchartrain']): WorkspaceRegionResponse {
  const notChecked = clubs.filter((c) => c.needsCheck).length
  return {
    clubs,
    thisMonth: { nextCheck: NEXT, checked: clubs.length - notChecked, notChecked },
    regions: regions.map((region) => ({ region, keepers: [{ name: 'Player Four', seat: 'Regional representative' }] })),
  }
}
const ANSWER = answerOf([KNIGHTS, ROOKS, CHESS])
const confirmed = (id: string) => ({ id, lastConfirmedAt: '2026-11-15 18:00:00', lastCheckWords: 'Checked Nov 2026' })

type Person = 'representative' | 'repWithSeat' | 'directorWithSeat' | 'observerWithSeat' | 'officerWithSeat' | 'auditorWithSeat' | 'seatNoClub'
  | 'guestWithSeat' | 'member' | 'repNoSeat' | 'officerSeat' | 'admin'
const REGIONAL = { id: 'seat-example', slug: 'example-region', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01', regions: ['Bayou Region'] }
const OFFICER = { id: 'seat-officer', slug: 'example-officer', role: 'Secretary', category: 'officer', started_at: '2026-01-01', regions: [] }
const PEOPLE: Record<Person, { role: string; account?: string; seats: unknown[]; managed: string[] }> = {
  representative: { role: 'member', seats: [REGIONAL], managed: ['c-knights'] },
  repWithSeat: { role: 'club_rep', seats: [REGIONAL], managed: ['c-knights'] },
  directorWithSeat: { role: 'tournament_director', seats: [REGIONAL], managed: ['c-knights'] },
  observerWithSeat: { role: 'lca_observer', seats: [REGIONAL], managed: ['c-knights'] },
  officerWithSeat: { role: 'lca_officer', seats: [REGIONAL], managed: ['c-knights'] },
  auditorWithSeat: { role: 'lca_auditor', seats: [REGIONAL], managed: ['c-knights'] },
  seatNoClub: { role: 'member', seats: [REGIONAL], managed: [] },
  guestWithSeat: { role: 'member', account: 'guest', seats: [REGIONAL], managed: ['c-knights'] },
  member: { role: 'member', seats: [], managed: [] },
  repNoSeat: { role: 'club_rep', seats: [], managed: [] },
  officerSeat: { role: 'lca_officer', seats: [OFFICER], managed: [] },
  admin: { role: 'lca_admin', seats: [], managed: [] },
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, () => Response | Promise<Response>> = {}

beforeEach(() => {
  window.localStorage.clear()
  // Help has opened by itself before, so the page's own parts are what is read; the Help cases clear it.
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
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined })
    const answer = answers[call]
    return answer ? answer() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}
const where = () => screen.getByTestId('where').textContent

/** The site at this address for this person, through its own routes. */
function open(person: Person, path = '/workspace/region') {
  const who = PEOPLE[person]
  const auth = {
    user: { id: `m-${person}` }, session: null, role: who.role,
    member: { id: `m-${person}`, role: who.account ?? who.role, club_id: who.role === 'club_rep' ? 'c-knights' : null, full_name: 'Player One', email: 'player.one@example.org' },
    loading: false, memberLoading: false, seats: who.seats, managedClubs: who.managed.map((id) => ({ id, name: 'Example Knights Club', region: 'Bayou Region' })),
    isBoardMember: who.seats.length > 0, assuranceLevel: 'aal2', mfaRequired: false, directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}
const regionGets = () => asked.filter((a) => a.call === 'GET /api/workspace/region')
const posts = () => asked.filter((a) => a.call.startsWith('POST '))
/** The page, once its file has loaded and its answer has come. */
async function page() {
  await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
  await act(async () => {})
}
const cardOf = (name: string) => screen.getByRole('heading', { level: 3, name }).closest('article') as HTMLElement
const cardNames = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
const stampOf = (name: string) => cardOf(name).querySelector('[data-slot="region-stamp"]')?.textContent
const bar = () => screen.getByRole('heading', { level: 2, name: 'This month' }).closest('section') as HTMLElement
const statusText = () => screen.getAllByRole('status').map((s) => s.textContent).join(' ')

describe('My region with clubKeepers off, as the step ships', () => {
  it('sends every kind of person to the dashboard, fetches no file of the page and calls no answer', async () => {
    flags.clubKeepers = false
    for (const person of Object.keys(PEOPLE) as Person[]) {
      open(person)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      cleanup()
    }
    expect(regionGets()).toEqual([])
    expect(loaded.page).toBe(false)
  })

  it('keeps the route behind the switch in App.tsx, with the page lazy as Your club\'s page is', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('const MyRegionPage = lazy(() => import(\'@/pages/MyRegionPage\').then(m => ({ default: m.MyRegionPage })))')
    expect(app).toContain('<Route path="/workspace/region" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat><MyRegionPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(app).toContain('<Route path="/workspace" element={<RoleProtectedRoute roles={WORKSPACE_ROLES} allowDirectors><WorkspacePage /></RoleProtectedRoute>} />')
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
  })
})

describe('My region with clubKeepers on: the way in', () => {
  beforeEach(() => { flags.clubKeepers = true })

  it('lets in a holder of an active regional seat whatever their role, a seat whose region holds no club among them', async () => {
    for (const person of ['representative', 'repWithSeat', 'directorWithSeat', 'observerWithSeat', 'officerWithSeat', 'auditorWithSeat', 'seatNoClub'] as Person[]) {
      open(person)
      await page()
      expect(where(), person).toBe('/workspace/region')
      cleanup()
    }
    expect(regionGets()).toHaveLength(7)
  })

  it('lets in an LCA admin without a seat', async () => {
    open('admin')
    await page()
    expect(where()).toBe('/workspace/region')
  })

  it('sends a guest who holds a seat, a plain member, a club\'s rep with no seat and an officer\'s seat holder to the dashboard, asking nothing', async () => {
    for (const person of ['guestWithSeat', 'member', 'repNoSeat', 'officerSeat'] as Person[]) {
      open(person)
      await screen.findByText('The dashboard', undefined, { timeout: 5000 })
      expect(where(), person).toBe('/dashboard')
      cleanup()
    }
    expect(regionGets()).toEqual([])
  })

  it('leaves every other route as before: the Workspace and Your club\'s page read no seat', async () => {
    // A member whose only grant is a regional seat is not let into the Workspace, as on the base.
    open('representative', '/workspace')
    await screen.findByText('The dashboard', undefined, { timeout: 5000 })
    cleanup()
    open('repNoSeat', '/workspace')
    await screen.findByText('The workspace', undefined, { timeout: 5000 })
    cleanup()
    open('representative', '/my/club/c-knights')
    await screen.findByText('Your club\'s page for c-knights', undefined, { timeout: 5000 })
    const guard = read('src/components/auth/RoleProtectedRoute.tsx')
    expect(guard.match(/requireSeat/g)).toHaveLength(3)
    expect(guard).toContain('if (requireSeat && !holdsRegionalSeat(role, member?.role, seats)) {')
  })
})

describe('My region with clubKeepers on: the page', () => {
  beforeEach(() => { flags.clubKeepers = true })

  it('a card per club in the server\'s order', async () => {
    open('representative')
    await page()
    expect(cardNames()).toEqual(['Example Knights Club', 'Example Rooks Club', 'Example Chess Club'])
    const list = screen.getAllByRole('list').find((l) => l.closest('section[aria-labelledby="region-clubs-title"]')) as HTMLElement
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    // The trail, the one h1 with the first region, the others the seat keeps, and the headings in order.
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(trail.textContent).toBe('My LCA›My region')
    expect(within(trail).getByRole('link', { name: 'My LCA' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['My region · Bayou Region'])
    expect(screen.getByText('Also keeping North of Lake Pontchartrain')).toBeTruthy()
    expect(document.title).toBe('My region | Louisiana Chess Association')
    const levels = [...document.querySelectorAll('h1, h2, h3, h4')].filter((h) => !h.closest('[hidden]')).map((h) => Number(h.tagName[1]))
    for (const [i, level] of levels.entries()) if (i > 0) expect(level - levels[i - 1], `heading ${i}`).toBeLessThanOrEqual(1)
    // The card: name, town and region, the statement in two lines or "Schedule not listed", the logo or the initials.
    const chess = cardOf('Example Chess Club')
    expect(chess.textContent).toContain('Example City · Bayou Region')
    expect(within(chess).getByText(/^"Tuesdays at 7:00 PM/).className.split(' ')).toContain('line-clamp-2')
    expect(chess.querySelector('img')?.getAttribute('src')).toBe('https://example.org/logo.png')
    expect(within(cardOf('Example Knights Club')).getByText('Schedule not listed')).toBeTruthy()
    expect(cardOf('Example Knights Club').textContent).toContain('EK')
    // A club with no colour of its own, none at all or the database's brand gold, shows navy, and its colour is never words.
    expect((cardOf('Example Rooks Club').firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(26, 39, 68)')
    expect((cardOf('Example Chess Club').firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(26, 39, 68)')
    expect((cardOf('Example Knights Club').firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(31, 78, 121)')
    // Who else keeps each region is in the answer, but the board draws no such line, so the page leaves it out.
    expect(document.body.textContent).not.toContain('Player Four')
    // The bar in the server's words.
    expect(bar().textContent).toBe('This month· Next monthly check lands Mon, Dec 7, 2026· 1 of 3 checked in the last 90 days· 2 not checked in 90 days'
      + 'Confirm all still accurate')
  })

  it('the stamp is a month in words', async () => {
    open('representative')
    await page()
    expect(stampOf('Example Knights Club')).toBe('Not checked since Aug 2026')
    expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
    expect(stampOf('Example Chess Club')).toBe('Checked Nov 2026')
    // The amber tint only beside the words of a club that needs a check.
    const due = cardOf('Example Knights Club').querySelector('[data-slot="region-stamp"]') as HTMLElement
    const done = cardOf('Example Chess Club').querySelector('[data-slot="region-stamp"]') as HTMLElement
    expect(due.className.split(' ')).toEqual(expect.arrayContaining(['bg-warn-50', 'text-warn-900']))
    expect(done.className).not.toMatch(/warn|gold/)
    // Every Still accurate and Open is named with its club and 44px tall.
    for (const name of ['Example Knights Club', 'Example Rooks Club', 'Example Chess Club']) {
      const still = screen.getByRole('button', { name: `Still accurate: ${name}` })
      expect(still.textContent).toBe('Still accurate')
      expect(still.className.split(' ')).toContain('min-h-11')
      const openLink = screen.getByRole('link', { name: `Open: ${name}` })
      expect(openLink.className.split(' ')).toContain('min-h-11')
    }
    expect(screen.getByRole('link', { name: 'Open: Example Chess Club' }).getAttribute('href')).toBe('/my/club/c-chess')
    expect(screen.getByRole('button', { name: 'Confirm all still accurate' }).className.split(' ')).toContain('min-h-11')
    expect(screen.getByRole('button', { name: 'Help' }).className.split(' ')).toContain('min-h-11')
    // Nothing on the page shows an email address.
    expect(document.body.textContent).not.toMatch(/@/)
  })

  it('the amber tint\'s words reach 4.5:1: warn-900 on warn-50, each read from src/index.css', () => {
    const css = read('src/index.css')
    const token = (name: string) => {
      const m = new RegExp(`${name}: oklch\\(([\\d.]+)% ([\\d.]+) ([\\d.]+)\\);`).exec(css)
      expect(m, name).not.toBeNull()
      return toHex(Number(m![1]) / 100, Number(m![2]), Number(m![3]))
    }
    const ground = token('--warn-50')
    const words = token('--warn-900')
    expect([ground, words]).toEqual(['#fffbeb', '#7b3306'])
    expect(contrast(words, ground)).toBeGreaterThan(8.7)
  })

  it('Still accurate stamps one card', async () => {
    open('representative')
    await page()
    const still = screen.getByRole('button', { name: 'Still accurate: Example Knights Club' })
    still.focus()
    await act(async () => { fireEvent.click(still) })
    await waitFor(() => expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026'))
    expect(posts()).toEqual([{ call: 'POST /api/admin/clubs/c-knights/confirm', body: '{}' }])
    // The card stays where it was, the focus stays on its button, and the bar's counts follow.
    expect(cardNames()).toEqual(['Example Knights Club', 'Example Rooks Club', 'Example Chess Club'])
    expect(document.activeElement).toBe(still)
    expect(still.isConnected).toBe(true)
    expect(bar().textContent).toContain('2 of 3 checked in the last 90 days')
    expect(bar().textContent).toContain('1 not checked in 90 days')
    expect(statusText()).toContain('Example Knights Club marked still accurate: Checked Nov 2026.')
    // Every other card is as it was.
    expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
    expect(regionGets()).toHaveLength(1)
  })

  it('says a failed Still accurate in words at the card and changes nothing', async () => {
    answers['POST /api/admin/clubs/c-knights/confirm'] = () => json({ error: 'Forbidden' }, 403)
    open('representative')
    await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate: Example Knights Club' })) })
    await within(cardOf('Example Knights Club')).findByText('Not marked: Forbidden. Nothing changed.')
    expect(stampOf('Example Knights Club')).toBe('Not checked since Aug 2026')
    expect(bar().textContent).toContain('1 of 3 checked in the last 90 days')
    expect(statusText()).toContain('Example Knights Club was not marked still accurate. Nothing changed.')
  })

  it('Confirm all asks once and skips a card with an open item', async () => {
    // A made-up answer of a later step: the Rooks' card has an open item, so Confirm all leaves it for its answer.
    const withItem = { ...ROOKS, openItems: [{ kind: 'report' }] as unknown as never[] }
    answers['GET /api/workspace/region'] = () => json(answerOf([KNIGHTS, withItem, card('c-pawns', 'Example Pawns Club', true, 'Not checked since Jul 2026', null), CHESS]))
    answers['POST /api/admin/clubs/c-pawns/confirm'] = () => json(confirmed('c-pawns'))
    open('representative')
    await page()
    // Cancel leaves everything as it was.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    let dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })) })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(posts()).toEqual([])
    // The focus goes back to Confirm all, which is the dialog's trigger.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm all still accurate' })))
    // One question, then one club after another, the club with an open item and the checked club left alone.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    for (const button of within(dialog).getAllByRole('button')) expect(button.className.split(' ')).toContain('min-h-11')
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(statusText()).toContain('2 clubs marked still accurate.'))
    expect(posts().map((p) => p.call)).toEqual(['POST /api/admin/clubs/c-knights/confirm', 'POST /api/admin/clubs/c-pawns/confirm'])
    expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026')
    expect(stampOf('Example Pawns Club')).toBe('Checked Nov 2026')
    expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cardNames()).toEqual(['Example Knights Club', 'Example Rooks Club', 'Example Pawns Club', 'Example Chess Club'])
    // Only the card with its open item still needs a check, and Confirm all has none left to mark.
    expect(screen.queryByRole('button', { name: 'Confirm all still accurate' })).toBeNull()
    expect(bar().textContent).toContain('3 of 4 checked in the last 90 days')
  })

  it('Confirm all names a club that could not be marked and leaves it as it was', async () => {
    answers['POST /api/admin/clubs/c-rooks/confirm'] = () => json({ error: 'Something went wrong' }, 500)
    open('representative')
    await page()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    const dialog = await screen.findByRole('dialog', { name: 'Mark 2 clubs still accurate?' })
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Mark 2 clubs' })) })
    await waitFor(() => expect(statusText()).toContain('1 of 2 clubs marked still accurate. Not marked: Example Rooks Club. It is as it was.'))
    expect(stampOf('Example Knights Club')).toBe('Checked Nov 2026')
    expect(stampOf('Example Rooks Club')).toBe('Not checked yet')
    expect(within(cardOf('Example Rooks Club')).getByText('Not marked: Something went wrong. Nothing changed.')).toBeTruthy()
    // The club left needs a check still, so Confirm all stays, for one club.
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm all still accurate' })) })
    expect(await screen.findByRole('dialog', { name: 'Mark 1 club still accurate?' })).toBeTruthy()
  })

  it('each undrawn state: loading, a failed load with Try again, no clubs, one club, an LCA admin, and the server\'s refusal', async () => {
    // Loading: the status says so and no card is drawn.
    let release: (r: Response) => void = () => {}
    answers['GET /api/workspace/region'] = () => new Promise<Response>((r) => { release = r })
    open('representative')
    await screen.findByText('Loading My region…', undefined, { timeout: 5000 })
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    await act(async () => { release(json(ANSWER)) })
    await page()
    cleanup()

    // A failed load, with Try again, which loads the page.
    answers['GET /api/workspace/region'] = () => json({ error: 'Something went wrong' }, 500)
    open('representative')
    await screen.findByText('My region could not be loaded: Something went wrong.', undefined, { timeout: 5000 })
    answers['GET /api/workspace/region'] = () => json(ANSWER)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await page()
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 }))
    cleanup()

    // No clubs: a seat whose region holds none.
    answers['GET /api/workspace/region'] = () => json(answerOf([], []))
    open('seatNoClub')
    await page()
    expect(screen.getByText('No clubs are in your region yet.')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['My region'])
    expect(bar().textContent).toBe('This month· Next monthly check lands Mon, Dec 7, 2026')
    cleanup()

    // One club.
    answers['GET /api/workspace/region'] = () => json(answerOf([CHESS], ['Bayou Region']))
    open('representative')
    await page()
    expect(cardNames()).toEqual(['Example Chess Club'])
    expect(screen.getByText('1 club')).toBeTruthy()
    expect(screen.queryByText(/^Also keeping/)).toBeNull()
    // No club needs a check, so the bar has no Confirm all.
    expect(screen.queryByRole('button', { name: 'Confirm all still accurate' })).toBeNull()
    cleanup()

    // An LCA admin: every club, the banner, and no "your region".
    answers['GET /api/workspace/region'] = () => json(ANSWER)
    open('admin')
    await page()
    expect(screen.getByText('You\'re here as an LCA admin')).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['My region'])
    expect(cardNames()).toHaveLength(3)
    expect(document.body.textContent).not.toMatch(/your region/i)
    cleanup()

    // The server's refusal, in its words, with a way back.
    answers['GET /api/workspace/region'] = () => json({ error: 'My region is for the holders of a regional representative\'s seat and the LCA admins.' }, 403)
    open('representative')
    await screen.findByText('My region is for the holders of a regional representative\'s seat and the LCA admins.', undefined, { timeout: 5000 })
    expect(screen.getByRole('link', { name: 'Back to My LCA' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull()
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['My region'])
  })

  it('opens Help by itself once on the first visit, under its own key, with every explaining sentence behind it', async () => {
    window.localStorage.clear()
    open('representative')
    await page()
    const panel = document.getElementById('my-region-help') as HTMLElement
    expect(panel.hidden).toBe(false)
    expect(document.activeElement).toBe(panel)
    expect(window.localStorage.getItem(REGION_HELP_SHOWN_KEY)).toBe('shown')
    expect(window.localStorage.getItem(HELP_SHOWN_KEY)).toBeNull()
    const button = screen.getByRole('button', { name: 'Help' })
    expect(button.getAttribute('aria-controls')).toBe('my-region-help')
    // Nothing runs the monthly check until a later step, so Help names the day it is due and no hour.
    expect(panel.textContent).toContain('The bar names the day the next monthly check is due.')
    expect(panel.textContent).not.toMatch(/\b\d{1,2}:\d{2} [AP]M\b/)
    // The sentences on the 90 days and on Confirm all sit in Help alone, never beside a control.
    for (const piece of ['in the last 90 days.', 'one club after another']) {
      const found = [...document.querySelectorAll('p, dd, span')].filter((el) => el.textContent?.includes(piece) && el.children.length === 0)
      expect(found.length, piece).toBeGreaterThan(0)
      for (const el of found) expect(panel.contains(el), piece).toBe(true)
    }
    await act(async () => { fireEvent.keyDown(panel, { key: 'Escape' }) })
    expect(panel.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
    cleanup()
    open('representative')
    await page()
    expect((document.getElementById('my-region-help') as HTMLElement).hidden).toBe(true)
  })

  it('keeps every control clear of today\'s header below lg, lets long words wrap and draws one column on a phone', async () => {
    open('representative')
    await page()
    const root = screen.getByRole('heading', { level: 1 }).closest('section')?.parentElement as HTMLElement
    expect(root.className).toBe('max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24')
    const list = screen.getAllByRole('list').find((l) => l.closest('section[aria-labelledby="region-clubs-title"]')) as HTMLElement
    expect(list.className.split(' ')).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'sm:grid-cols-2']))
    for (const name of cardNames()) {
      const heading = screen.getByRole('heading', { level: 3, name: name ?? '' })
      expect(heading.className.split(' ')).toContain('break-words')
      expect(heading.closest('li')?.className).toBe('min-w-0')
    }
    expect(bar().className.split(' ')).toEqual(expect.arrayContaining(['flex-wrap', 'min-w-0']))
  })
})

/** An oklch colour as sRGB hex, as a browser draws it. */
function toHex(L: number, C: number, h: number): string {
  const a = C * Math.cos((h * Math.PI) / 180)
  const b = C * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s]
  const gamma = (x: number) => { const v = Math.min(1, Math.max(0, x)); return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055 }
  return `#${lin.map((v) => Math.round(gamma(v) * 255).toString(16).padStart(2, '0')).join('')}`
}
