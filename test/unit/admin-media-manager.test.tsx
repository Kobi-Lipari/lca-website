// @vitest-environment jsdom
//
// The media manager on the site (WS16 step 6), with src/App.tsx drawn whole,
// as test/unit/email-choice-app-routes.test.tsx draws it: today's header with
// its account menu, the routes and the footer, at the address a person types
// or follows, with the signed-in person given to the site's auth context and
// every call answered by a stand-in for fetch that keeps a list of what was
// asked. mailLists is flipped inside this file through a getter on the mocked
// FEATURES, so both sides are drawn from the same code.
//
// - With mailLists on, the holder of the Media manager seat whose role Admin
//   does not let in is let into Admin, which holds Group email alone, and in
//   it the newsletter's tab alone: no Specific people, no Groups of members,
//   no way to add people or type addresses, no Send history column, no Amazon
//   SES box, the subtitle "Send the LCA newsletter.", Help and Who gets it as
//   WS16 step 5 drew them, and the newsletter's recent sends and its stop
//   under its tab; and no call but the newsletter's own and the one question
//   of who they are.
// - Any other Admin address they type goes to Group email, with nothing of
//   another section asked for on the way.
// - Without a second factor, one line linked to where it is set up, in place
//   of the send buttons, and no newsletter call.
// - While the question is on the way the route shows its loading line, with
//   no Admin drawn and nobody sent away; an answer of no then sends the person
//   where today's rule sends them.
// - The account menu's Group email link, for them alone.
// - The question is asked once a session, shared by the route and the menu,
//   and never for a person Admin lets in by role or for a member who holds no
//   seat while they browse.
// - With mailLists off, the route turns the same member away as today, the
//   menu has no new link, and no question is asked.
// - Admin's page is today's, drawn beside test/unit/fixtures/admin-page-today.tsx
//   (src/pages/AdminPage.tsx at 5e7a23c) at each address: for everyone Admin
//   lets in by role, a holder of the seat among them, with mailLists off and
//   on, and for a member's role who holds the seat, off and on, while the
//   route hands down no answer of yes.
// Every name, address, subject and seat title here is made up but the seat's
// own, "Media manager", whose link name the code keys on.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiNewsletter } from '@/lib/api'

const flags = vi.hoisted(() => ({ mailLists: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
    },
  }
})
/** The token the sign-in service would hand the site, read by the site's calls; each case sets its own. */
const session = vi.hoisted(() => ({ token: '' }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: session.token } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))
// The real editor needs a browser's layout; a text box stands in for it.
vi.mock('@/areas/governance/components/RichTextEditor', async () => {
  const { createElement } = await import('react')
  return {
    RichTextEditor: ({ content, onChange }: { content: string; onChange: (html: string) => void }) =>
      createElement('textarea', { 'aria-label': 'Message', value: content, onChange: (e: { target: { value: string } }) => onChange(e.target.value) }),
  }
})
// Where today's rule sends a member or a club rep, drawn as plain words, so a case reads where the person landed.
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => 'Dashboard stand-in' }))
vi.mock('@/pages/WorkspacePage', () => ({ WorkspacePage: () => 'Workspace stand-in' }))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')
const { AdminPage } = await import('@/pages/AdminPage')
const { AdminPageToday } = await import('./fixtures/admin-page-today')
const { MediaManagerAnswerContext } = await import('@/areas/admin/mediaManagerAnswer')

const MEDIA_MANAGER = 'media-manager'
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'
const NEWSLETTER_URL = '/api/admin/mail/newsletter'
const ASK_URL = '/api/me/media-manager'

type Send = ApiNewsletter['summary']['recent'][number]
const SENT: Send = { id: 'campaign-newsletter-1', subject: 'Sample newsletter one', totalRecipients: 9, sentCount: 9, failedCount: 0, skippedCount: 0, status: 'completed', createdAt: '2026-11-03 15:00:00', completedAt: '2026-11-03 15:05:00' }
const SENDING: Send = { ...SENT, id: 'campaign-newsletter-2', subject: 'Sample newsletter two', sentCount: 3, status: 'sending', completedAt: null }

/** The newsletter's answer, with a made-up From line. */
function newsletter(recent: Send[] = [SENT]): ApiNewsletter {
  return {
    list: { id: 'lca-newsletter', name: 'LCA newsletter' },
    from: 'Sample Sender <newsletter@example.org>',
    sendsThrough: 'resend',
    summary: { addresses: 12, turnedOff: 1, stoppedAll: 1, doNotSend: 1, willGet: 9, recent, waits: null },
  }
}

/** What a stand-in answers: a body now, or one held until the case lets it go. */
interface Answer { status: number; body: unknown }
let calls: Array<{ url: string; method: string }> = []
let answers: Record<string, Answer | Promise<Answer>> = {}
const on = (method: string, url: string, answer: Answer | Promise<Answer>) => {
  answers[`${method} ${url}`] = answer
}
const urls = () => calls.map((c) => c.url.split('?')[0])
const asks = () => calls.filter((c) => c.url === ASK_URL)

/** An answer held back, as a slow network holds one, and the way to let it go. */
function held(answer: Answer): { answer: Promise<Answer>; release: () => Promise<void> } {
  let release!: () => void
  const answerLater = new Promise<Answer>((resolve) => {
    release = () => resolve(answer)
  })
  return { answer: answerLater, release: async () => act(async () => release()) }
}

let seq = 0
/** A bearer token in the sign-in service's shape for a person in a session of their own, with the assurance level given. */
function token(sub: string, sessionId: string, aal: 'aal1' | 'aal2'): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, session_id: sessionId, aal, role: 'authenticated' })}.sample-signature`
}

/** A signed-in person, each case's own, so no case reads another's answer: their role, their seats and their session. */
function person(opts: { role?: MemberRole; seats?: string[]; aal?: 'aal1' | 'aal2' } = {}): AuthContextValue {
  const id = `member-sample-${++seq}`
  const role = opts.role ?? 'member'
  const access = token(id, `session-sample-${seq}`, opts.aal ?? 'aal2')
  session.token = access
  const seats = (opts.seats ?? []).map((slug, i) => ({ id: `seat-sample-${seq}-${i}`, slug, role: slug === MEDIA_MANAGER ? 'Media manager' : 'Sample seat', category: 'officer' as const, started_at: '2026-11-02 15:00:00' }))
  return {
    user: { id, email: `${id}@example.org`, user_metadata: { role } },
    session: { access_token: access },
    member: { id, email: `${id}@example.org`, full_name: 'Player One', role, club_id: null, membership_status: 'active' },
    role, seats, managedClubs: [], isBoardMember: seats.length > 0 || role === 'lca_admin' || role === 'lca_observer' || role === 'lca_officer',
    assuranceLevel: opts.aal ?? 'aal2', mfaRequired: false, refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [],
    loading: false, memberLoading: false, signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
  } as unknown as AuthContextValue
}

/** Where the person is, written into the page by a probe beside the site, so a case reads every move the router made. */
function Where() {
  const location = useLocation()
  return <output data-testid="where">{location.pathname}</output>
}
const where = () => screen.getByTestId('where').textContent

/** Lets the calls settle and React draw what they bring. */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 30)))

/** The whole site at an address for a person, and the site's own main, outside the one Admin draws within it. */
async function site(path: string, who: AuthContextValue): Promise<HTMLElement> {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={who}>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await settle()
  const main = view!.container.querySelector('main')
  expect(main).not.toBeNull()
  return main!
}

/** Admin's Group email for the media manager, once its code has come. */
const groupEmail = () => screen.findByRole('heading', { level: 2, name: 'Group email' }, { timeout: 10_000 })

/** The account menu's links, opened as a person opens it. */
function accountMenu(): string[] {
  fireEvent.click(screen.getByRole('button', { name: 'More' }))
  return screen.getAllByRole('menuitem').map((link) => link.textContent ?? '')
}

beforeEach(() => {
  flags.mailLists = false
  calls = []
  answers = {}
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    const answer = await (answers[`${method} ${url}`] ?? { status: 404, body: { error: 'Not found' } })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', NEWSLETTER_URL, { status: 200, body: newsletter() })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the media manager, with mailLists on', () => {
  it('opens Admin with Group email alone, and in it the newsletter\'s tab alone, with nothing of Specific people, Groups of members or the history, and asks for nothing else', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
    const main = await site('/admin/email', person({ seats: [MEDIA_MANAGER] }))
    const heading = await groupEmail()
    expect(main.contains(heading)).toBe(true)
    expect(where()).toBe('/admin/email')

    // Admin's sections: one group, Communications, with Group email alone, in the sidebar and in the phone's choice.
    const sections = screen.getByRole('navigation', { name: 'Admin sections' })
    expect(within(sections).getAllByRole('link').map((l) => l.textContent?.trim())).toEqual(['Group email'])
    expect(within(sections).getByText('Communications')).toBeTruthy()
    const choice = screen.getByLabelText('Section') as HTMLSelectElement
    expect([...choice.options].map((o) => o.textContent)).toEqual(['Group email'])
    expect(screen.queryByText('Manage members, clubs, tournaments and communications across the LCA.')).toBeNull()

    // The page: the newsletter's tab alone, its subtitle, Help and Who gets it, and none of Specific people's parts.
    await screen.findByText('9 addresses will get it.')
    expect(screen.getByText('Send the LCA newsletter.')).toBeTruthy()
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['The LCA newsletter list'])
    expect(screen.queryByText('Specific people')).toBeNull()
    expect(screen.queryByText('Groups of members')).toBeNull()
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', { name: 'Who gets it' }).getAttribute('aria-expanded')).toBe('false')
    for (const words of ['Choose people', 'Review recipients', 'Confirm & send']) expect(screen.queryByRole('button', { name: words }), words).toBeNull()
    expect(screen.queryByPlaceholderText(/type \/ paste email addresses/)).toBeNull()
    expect(screen.queryByText(/Start from nobody/)).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Send history' })).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Send the test through Amazon SES' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Send test' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Send to the LCA newsletter list/ })).toBeTruthy()

    // The newsletter's recent sends sit under its tab, with their status in words.
    expect(screen.getByText('Sample newsletter one')).toBeTruthy()
    expect(screen.getByText('Completed')).toBeTruthy()

    // The one question and the newsletter's own answer, and nothing of today's history, members, clubs or any other section.
    expect([...new Set(urls())].sort()).toEqual([ASK_URL, NEWSLETTER_URL].sort())
    expect(asks()).toHaveLength(1)
  }, 30_000)

  it('draws the stop under the tab while a newsletter is sending, and reads the newsletter alone again on the page\'s one timer', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
    on('GET', NEWSLETTER_URL, { status: 200, body: newsletter([SENDING, SENT]) })
    await site('/admin/email', person({ seats: [MEDIA_MANAGER] }))
    await groupEmail()
    expect(await screen.findByRole('button', { name: 'Stop sending' })).toBeTruthy()
    expect(screen.getByText('Sample newsletter two')).toBeTruthy()
    calls = []
    await act(async () => new Promise((resolve) => setTimeout(resolve, 3100)))
    expect(urls()).toContain(NEWSLETTER_URL)
    expect(urls().filter((u) => u !== NEWSLETTER_URL)).toEqual([])
  }, 30_000)

  it('sends any other Admin address they type to Group email, asking nothing of another section on the way', async () => {
    flags.mailLists = true
    for (const path of ['/admin', '/admin/members', '/admin/audit', '/admin/support', '/admin/news', '/admin/announcements', '/admin/board-seats', '/admin/tournaments', '/admin/no-such-section']) {
      calls = []
      on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
      await site(path, person({ seats: [MEDIA_MANAGER] }))
      await groupEmail()
      expect(where(), path).toBe('/admin/email')
      expect([...new Set(urls())].sort(), path).toEqual([ASK_URL, NEWSLETTER_URL].sort())
      cleanup()
    }
  }, 60_000)

  it('without a second factor, draws one line linked to where it is set up, in place of the send buttons, and makes no newsletter call', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: false } })
    await site('/admin/email', person({ seats: [MEDIA_MANAGER], aal: 'aal1' }))
    await groupEmail()
    const line = screen.getByRole('link', { name: SECOND_FACTOR_LINE })
    expect(line.getAttribute('href')).toBe('/account/security')
    expect(line.className).toMatch(/focus-visible:ring-3/)
    expect(screen.queryByRole('button', { name: 'Send test' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Send to the LCA newsletter list/ })).toBeNull()
    expect(screen.queryByPlaceholderText('you@example.com')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeTruthy()
    // A click of their one tab asks nothing of the newsletter either.
    fireEvent.click(screen.getByRole('tab', { name: 'The LCA newsletter list' }))
    await settle()
    expect(urls()).toEqual([ASK_URL])
  }, 30_000)

  it('shows the route\'s loading line while the question is on the way, with no Admin drawn and nobody sent away, then lets the media manager in', async () => {
    flags.mailLists = true
    const later = held({ status: 200, body: { mediaManager: true, secondFactor: true } })
    on('GET', ASK_URL, later.answer)
    const main = await site('/admin/email', person({ seats: [MEDIA_MANAGER] }))
    expect(within(main).getByText('Loading...')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
    expect(where()).toBe('/admin/email')
    expect(urls()).toEqual([ASK_URL])
    await later.release()
    await groupEmail()
    expect(where()).toBe('/admin/email')
  }, 30_000)

  it('sends a member the server says is not the media manager where today\'s rule sends them, only once the answer has come', async () => {
    flags.mailLists = true
    const later = held({ status: 200, body: { mediaManager: false, secondFactor: true } })
    on('GET', ASK_URL, later.answer)
    const main = await site('/admin/email', person({ seats: [MEDIA_MANAGER] }))
    expect(within(main).getByText('Loading...')).toBeTruthy()
    expect(where()).toBe('/admin/email')
    await later.release()
    await waitFor(() => expect(where()).toBe('/dashboard'))
    expect(await screen.findByText('Dashboard stand-in')).toBeTruthy()
    expect(screen.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
  }, 30_000)

  it('puts Group email in the account menu for them, beside Board inbox, asking once for the route and the menu together', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
    await site('/admin/email', person({ seats: [MEDIA_MANAGER] }))
    await groupEmail()
    const links = accountMenu()
    expect(links.slice(links.indexOf('Board inbox'))).toEqual(['Board inbox', 'Group email'])
    expect(screen.getByRole('menuitem', { name: 'Group email' }).getAttribute('href')).toBe('/admin/email')
    expect(asks()).toHaveLength(1)
  }, 30_000)

  it('asks for a seat holder\'s menu once, and puts no link there when the answer is no', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: false, secondFactor: true } })
    await site('/sample/no-such-page', person({ seats: ['sample-seat'] }))
    expect(accountMenu()).not.toContain('Group email')
    expect(asks()).toHaveLength(1)
  }, 30_000)

  it('asks nothing for a member who holds no seat while they browse, nor for anyone Admin lets in by role, who keep today\'s Admin', async () => {
    flags.mailLists = true
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
    await site('/sample/no-such-page', person())
    expect(accountMenu()).not.toContain('Group email')
    expect(asks()).toEqual([])
    cleanup()

    for (const role of ['lca_admin', 'lca_observer', 'lca_officer'] as const) {
      calls = []
      await site('/admin/members', person({ role, seats: [MEDIA_MANAGER] }))
      await screen.findByRole('heading', { level: 2, name: 'Members' }, { timeout: 10_000 })
      expect(within(screen.getByRole('navigation', { name: 'Admin sections' })).getAllByRole('link').length, role).toBeGreaterThan(1)
      expect(accountMenu(), role).not.toContain('Group email')
      expect(asks(), role).toEqual([])
      cleanup()
    }
  }, 60_000)
})

describe('with mailLists off, the seat holder', () => {
  it('is turned away from the two Admin addresses as today, with no new link in the account menu and no question asked', async () => {
    for (const [path, role, landed] of [
      ['/admin/email', 'member', '/dashboard'], ['/admin', 'member', '/dashboard'], ['/admin/email', 'club_rep', '/workspace'],
    ] as const) {
      calls = []
      on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
      await site(path, person({ role, seats: [MEDIA_MANAGER] }))
      await waitFor(() => expect(where(), path).toBe(landed))
      expect(screen.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
      expect(accountMenu()).not.toContain('Group email')
      expect(urls(), path).not.toContain(ASK_URL)
      expect(urls(), path).not.toContain(NEWSLETTER_URL)
      cleanup()
    }
  }, 60_000)
})

/** Markup with React's generated ids, in each of the forms React has written them (:r1:, «r1», _r_1_), read in the order they appear, so two drawings compare whatever ids came before. */
function normalised(html: string): string {
  const seen = new Map<string, string>()
  return html.replace(/:r[0-9a-z]+:|«r[0-9a-z]+»|_r_[0-9a-z]+_/g, (id) => {
    if (!seen.has(id)) seen.set(id, `generated-${seen.size}`)
    return seen.get(id)!
  })
}

/** What one drawing of Admin's page gives: its markup once its calls have come, where it landed, the tab's title and the calls it made. */
interface Drawn { markup: string; where: string | null; title: string; calls: string[] }

/**
 * Admin's page alone at an address, under the two routes src/App.tsx gives it, for a person, with the answer the route
 * hands down when one is given; read once its markup stops changing.
 */
async function drawnAdmin(Page: ComponentType, path: string, who: AuthContextValue, answer?: { mediaManager: boolean; secondFactor: boolean }): Promise<Drawn> {
  window.localStorage.clear()
  document.title = ''
  calls = []
  const page = <Page />
  const routed = answer ? <MediaManagerAnswerContext.Provider value={{ asking: false, ...answer }}>{page}</MediaManagerAnswerContext.Provider> : page
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={who}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/admin" element={routed} />
            <Route path="/admin/:section" element={routed} />
          </Routes>
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  let markup = ''
  for (let round = 0; round < 20; round++) {
    await settle()
    const next = normalised(view!.container.innerHTML)
    if (next === markup) break
    markup = next
  }
  const drawn = { markup, where: where(), title: document.title, calls: calls.map((c) => `${c.method} ${c.url}`) }
  cleanup()
  return drawn
}

/** Admin's addresses, a section's, today's old name for one and one Admin does not have among them. */
const ADMIN_PATHS = ['/admin', '/admin/members', '/admin/email', '/admin/activity', '/admin/audit', '/admin/no-such-section']

describe('Admin\'s page, drawn beside a copy of it as it stood at 5e7a23c', () => {
  beforeEach(() => {
    on('GET', '/api/admin/members', { status: 200, body: { members: [{ id: 'member-list-1', email: 'player.two@example.org', full_name: 'Player Two', uscf_id: null, membership_status: 'active', membership_expiry: null, role: 'member', club_id: null, created_at: '2026-11-02 15:00:00' }] } })
    on('GET', '/api/clubs', { status: 200, body: { clubs: [{ id: 'club-sample', name: 'Example Chess Club', city: 'Sample City', meeting_schedule: 'Tuesdays', color: null, image_url: null, region: null }] } })
    on('GET', '/api/admin/board-seats', { status: 200, body: { seats: [], holders: [], history: [] } })
    on('GET', '/api/admin/campaigns', { status: 200, body: { campaigns: [{ id: 'campaign-sample', subject: 'Sample group message', total_recipients: 2, sent_count: 2, failed_count: 0, status: 'completed', created_at: '2026-11-02 15:00:00', completed_at: '2026-11-02 15:01:00' }] } })
  })

  it.each([false, true])('is today\'s for everyone Admin lets in by role, a holder of the seat among them, at each address, with mailLists %s', async (switchOn) => {
    flags.mailLists = switchOn
    for (const role of ['lca_admin', 'lca_observer', 'lca_officer'] as const) {
      const who = person({ role, seats: [MEDIA_MANAGER] })
      for (const path of ADMIN_PATHS) {
        const today = await drawnAdmin(AdminPageToday, path, who)
        const now = await drawnAdmin(AdminPage, path, who)
        expect(now, `${role} at ${path}`).toEqual(today)
      }
      // The drawings hold what each section shows, not an empty page: the members' list, and Group email for those it is
      // for, with today's history, or with mailLists on the newsletter's tab and its recent sends beside it.
      expect((await drawnAdmin(AdminPage, '/admin', who)).markup, role).toContain('Player Two')
      const email = await drawnAdmin(AdminPage, '/admin/email', who)
      if (role === 'lca_officer') expect(email.where).toBe('/admin')
      else expect(email.markup, role).toContain(switchOn ? 'Sample newsletter one' : 'Sample group message')
      if (role !== 'lca_officer') expect(email.markup.includes('The LCA newsletter list'), role).toBe(switchOn)
    }
  }, 120_000)

  it('is today\'s for a member\'s role who holds the seat, with mailLists off and on, while the route hands down no answer of yes', async () => {
    for (const switchOn of [false, true]) {
      flags.mailLists = switchOn
      for (const role of ['member', 'club_rep'] as const) {
        const who = person({ role, seats: [MEDIA_MANAGER] })
        for (const answer of [undefined, { mediaManager: false, secondFactor: true }]) {
          for (const path of ['/admin', '/admin/members', '/admin/email']) {
            const today = await drawnAdmin(AdminPageToday, path, who, answer)
            const now = await drawnAdmin(AdminPage, path, who, answer)
            expect(now, `${role} at ${path}, mailLists ${switchOn}, ${answer ? 'an answer of no' : 'no answer'}`).toEqual(today)
            expect(now.markup).not.toContain('Send the LCA newsletter.')
          }
        }
      }
    }
  }, 120_000)
})
