// @vitest-environment jsdom
//
// The newsletter's own page (WS16 part two, page step 4), with src/App.tsx
// drawn whole at the address a person types, the signed-in person given to
// the site's auth context, and every call answered by a stand-in for fetch
// that keeps a list of what was asked. mailLists and mailPage are flipped
// inside this file through getters on the mocked FEATURES.
//
// - The route only with mailPage on: with it off, /admin/newsletter is
//   Admin's own address for an unknown section, as on the base.
// - Who is let in and who is sent where: the LCA admins, the president, and
//   whoever holds the Media manager seat, an officer among them, are let in;
//   an officer without the seat is sent to Admin; anyone else where today's
//   rule sends them; an LCA admin without a second factor to set it up. A
//   media manager without a second factor is told so in the newsletter tab's
//   words, and no call is made. Nobody here sees a "View only" badge.
// - The head: the crumb, the title, the month with the letter's state in a
//   word, the saved line, Help not yet available, Admin sections.
// - From shows a name alone; "In this issue" follows the headings; the
//   count card with and without a count; the month takes the subject with
//   it while the subject is still the old month's own.
// - The characters the server refuses are dropped as they are typed or
//   pasted, the set walked as the contract's own cases walk it; the page's
//   three limits are the contract's.
// - Each of LCA's starters, opened in the page's editor and written back
//   out by it, is still untouched for holdsWords.
// - The preview is renderNewsletter's email with a footer in the real words,
//   in a frame with a sandbox of no allowances; the frame on show holds the
//   letter as it stands, a change taken back among them.
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every name, word and number
// here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation, useParams } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
import type { MemberRole } from '@/areas/admin/roles'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { PREHEADER_MAX as CONTRACT_PREHEADER_MAX, MONTH_LABEL_MAX as CONTRACT_MONTH_MAX, SUBJECT_MAX as CONTRACT_SUBJECT_MAX, newsletterIssueSaveRequestSchema } from '../../domain/contracts/newsletter'
import { holdsWords, starterLetter } from '../../functions/utils/mail/issues'
import { defaultSubject, STARTER_IDS } from '@domain/mail/letter'

const flags = vi.hoisted(() => ({ mailLists: true, mailPage: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
      get mailPage() {
        return flags.mailPage
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))
// Where the routes send a person, drawn as plain words, so a case reads where the person landed.
vi.mock('@/pages/AdminPage', () => ({
  AdminPage: function AdminStandIn() {
    const { section } = useParams<{ section?: string }>()
    return <p>Admin stand-in {section ?? 'home'}</p>
  },
}))
vi.mock('@/pages/DashboardPage', () => ({ DashboardPage: () => 'Dashboard stand-in' }))
vi.mock('@/pages/WorkspacePage', () => ({ WorkspacePage: () => 'Workspace stand-in' }))
vi.mock('@/pages/AccountSecurityPage', () => ({ AccountSecurityPage: () => 'Account security stand-in' }))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')
const { LetterEditor } = await import('@/areas/admin/newsletter/LetterEditor')
const { CountCard } = await import('@/areas/admin/newsletter/CountCard')
const { MONTH_LABEL_MAX, PREHEADER_MAX, SUBJECT_MAX, isHiddenCharacter, withoutHiddenCharacters } = await import('@/areas/admin/newsletter/letterRules')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const COUNT_URL = '/api/admin/mail/newsletter'
const ASK_URL = '/api/me/media-manager'
const SECOND_FACTOR_LINE = 'Set up two-factor sign-in to send group email.'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'

const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(() => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
})
afterAll(() => {
  Range.prototype.getClientRects = saved.rangeRects
  Range.prototype.getBoundingClientRect = saved.rangeBox
  document.elementFromPoint = saved.elementFromPoint
})

interface Answer { status: number; body: unknown }
let calls: Array<{ url: string; method: string; body: unknown }> = []
let answers: Record<string, Answer> = {}
const on = (method: string, url: string, answer: Answer) => {
  answers[`${method} ${url}`] = answer
}
const newsletterCalls = () => calls.filter((c) => c.url.startsWith('/api/admin/mail/'))

function letter(over: Record<string, unknown> = {}) {
  return {
    issue: { id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...over },
    state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
  }
}
const count = (willGet: number) => ({
  list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'Sample Sender <newsletter@example.org>', sendsThrough: 'resend',
  summary: { addresses: willGet + 4, turnedOff: 2, stoppedAll: 1, doNotSend: 1, willGet, recent: [], waits: null },
})

let seq = 0
function token(sub: string, aal: 'aal1' | 'aal2'): string {
  const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub, session_id: `session-sample-${sub}`, aal, role: 'authenticated' })}.sample-signature`
}
/** A signed-in person, each case's own: a role, the seats they hold, a second factor or none. */
function person(opts: { role?: MemberRole; seats?: string[]; aal?: 'aal1' | 'aal2'; mfaRequired?: boolean } = {}): AuthContextValue {
  const id = `member-sample-${++seq}`
  const role = opts.role ?? 'member'
  const access = token(id, opts.aal ?? 'aal2')
  const seats = (opts.seats ?? []).map((slug, i) => ({ id: `seat-sample-${seq}-${i}`, slug, role: slug === 'media-manager' ? 'Media manager' : 'Sample seat', category: 'officer' as const, started_at: '2026-11-02 15:00:00' }))
  return {
    user: { id, email: `${id}@example.org`, user_metadata: { role } },
    session: { access_token: access },
    member: { id, email: `${id}@example.org`, full_name: 'Player One', role, club_id: null, membership_status: 'active' },
    role, seats, managedClubs: [], isBoardMember: seats.length > 0,
    assuranceLevel: opts.aal ?? 'aal2', mfaRequired: opts.mfaRequired ?? false, refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [],
    loading: false, memberLoading: false, signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
  } as unknown as AuthContextValue
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>
}
const where = () => screen.getByTestId('where').textContent
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 40)))

async function site(path: string, who: AuthContextValue) {
  await act(async () => {
    render(
      <AuthContext.Provider value={who}>
        <MemoryRouter initialEntries={[path]}>
          <App />
          <Where />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await settle()
}
/** The page once its code and its letter have come. */
const thePage = () => screen.findByRole('heading', { level: 1, name: 'Newsletter' }, { timeout: 10_000 })
const editorOf = () => (document.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor

beforeEach(() => {
  flags.mailLists = true
  flags.mailPage = true
  calls = []
  answers = {}
  window.localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null })
    const answer = answers[`${method} ${url}`] ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, { status: 200, body: count(155) })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('the route, only with mailPage on', () => {
  it('is Admin\'s own address for an unknown section with mailPage off, and asks for no letter', async () => {
    flags.mailPage = false
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    expect(await screen.findByText('Admin stand-in newsletter')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 1, name: 'Newsletter' })).toBeNull()
    expect(newsletterCalls()).toEqual([])
  })

  it('is the newsletter\'s page with mailPage on, reading the letter and the count', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    expect(where()).toBe('/admin/newsletter')
    expect(newsletterCalls().map((c) => `${c.method} ${c.url}`).sort()).toEqual([`GET ${COUNT_URL}`, `GET ${ISSUE_URL}`])
    expect(document.title).toBe('Admin · Newsletter | Louisiana Chess Association')
  })
})

describe('who is let in, and who is sent where', () => {
  it('lets in an LCA admin with a second factor and the president, who needs none, with no "View only" badge', async () => {
    for (const who of [person({ role: 'lca_admin' }), person({ role: 'lca_observer', aal: 'aal1' })]) {
      calls = []
      await site('/admin/newsletter', who)
      await thePage()
      expect(await screen.findByText('155 people will get it')).toBeTruthy()
      expect(newsletterCalls()).toHaveLength(2)
      expect(screen.queryByText(/View only/)).toBeNull()
      cleanup()
    }
  })

  it('lets in the media manager, a member who holds the seat, and an officer who holds it once the answer says so', async () => {
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: true } })
    for (const who of [person({ seats: ['media-manager'] }), person({ role: 'lca_officer', seats: ['media-manager'] })]) {
      calls = []
      await site('/admin/newsletter', who)
      await thePage()
      expect(where()).toBe('/admin/newsletter')
      expect(screen.queryByText(/View only/)).toBeNull()
      await screen.findByText('155 people will get it')
      cleanup()
    }
  })

  it('sends an officer without the seat to Admin, at once when they hold no seat and once the answer says no when they hold one, asking for no letter', async () => {
    await site('/admin/newsletter', person({ role: 'lca_officer' }))
    expect(await screen.findByText('Admin stand-in home')).toBeTruthy()
    expect(where()).toBe('/admin')
    cleanup()
    on('GET', ASK_URL, { status: 200, body: { mediaManager: false, secondFactor: true } })
    await site('/admin/newsletter', person({ role: 'lca_officer', seats: ['sample-seat'] }))
    expect(await screen.findByText('Admin stand-in home')).toBeTruthy()
    expect(newsletterCalls()).toEqual([])
  })

  it('sends anyone else where today\'s rule sends them, and an LCA admin without a second factor to set it up', async () => {
    await site('/admin/newsletter', person())
    expect(await screen.findByText('Dashboard stand-in')).toBeTruthy()
    cleanup()
    await site('/admin/newsletter', person({ role: 'club_rep' }))
    expect(await screen.findByText('Workspace stand-in')).toBeTruthy()
    cleanup()
    await site('/admin/newsletter', person({ role: 'lca_admin', aal: 'aal1', mfaRequired: true }))
    expect(await screen.findByText('Account security stand-in')).toBeTruthy()
    expect(newsletterCalls()).toEqual([])
  })

  it('tells a media manager without a second factor so in the newsletter tab\'s words, with the way to set it up, and makes no call', async () => {
    on('GET', ASK_URL, { status: 200, body: { mediaManager: true, secondFactor: false } })
    await site('/admin/newsletter', person({ seats: ['media-manager'], aal: 'aal1' }))
    await thePage()
    const line = await screen.findByRole('link', { name: SECOND_FACTOR_LINE })
    expect(line.getAttribute('href')).toBe('/account/security')
    expect(newsletterCalls()).toEqual([])
    expect(document.querySelector('[data-slot="letter-sheet"]')).toBeNull()
  })
})

describe('the head, From and the count', () => {
  it('draws the crumb, the title, the month with its state in a word, the saved line, Help not yet available and Admin sections', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T21:00:00Z'))
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(crumb).getByRole('link', { name: 'Admin' }).getAttribute('href')).toBe('/admin')
    expect(within(crumb).getByText('Newsletter').getAttribute('aria-current')).toBe('page')
    expect(screen.getByText('December 2026', { selector: 'b' }).parentElement?.textContent).toBe(`December 2026 ${String.fromCharCode(0xb7)} Draft`)
    expect(document.querySelector('[data-slot="saved-line"]')?.textContent).toBe('Saved automatically at 2:15 PM')
    const help = screen.getByRole('button', { name: 'Help, not yet available' }) as HTMLButtonElement
    expect(help.disabled).toBe(true)
    expect(screen.getByRole('link', { name: 'Admin sections' }).getAttribute('href')).toBe('/admin')
  })

  it('opens a blank letter for the month now, in Central time, with its subject, when there is no letter yet, and saves nothing', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    // Five in the morning of December 1 in UTC is still November 30 in Louisiana.
    vi.setSystemTime(new Date('2026-12-01T05:00:00Z'))
    on('GET', ISSUE_URL, { status: 200, body: { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null } })
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    expect(screen.getByText('November 2026', { selector: 'b' }).parentElement?.textContent).toBe('November 2026 · Not saved yet')
    expect((screen.getByRole('textbox', { name: /Subject/ }) as HTMLInputElement).value).toBe('LCA Newsletter · November 2026')
    expect(calls.filter((c) => c.method === 'PUT')).toEqual([])
  })

  it('shows the sender as a name, never an address, with no list to open', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const from = screen.getByText('From').parentElement!
    expect(from.textContent).toBe('FromLouisiana Chess Association · LCA Newsletter')
    expect(from.textContent).not.toMatch(/[@<]/)
    expect(within(from).queryByRole('button')).toBeNull()
  })

  it('reads the count from the newsletter\'s own answer, and says so in words, with no number, when it cannot be read', () => {
    render(<CountCard count={155} />)
    expect(screen.getByText('155 people will get it')).toBeTruthy()
    cleanup()
    render(<CountCard count={1} />)
    expect(screen.getByText('1 person will get it')).toBeTruthy()
    cleanup()
    render(<CountCard count={1250} />)
    expect(screen.getByText('1,250 people will get it')).toBeTruthy()
    cleanup()
    render(<CountCard count="failed" />)
    const card = document.querySelector('[data-slot="count-card"]')!
    expect(card.textContent).toBe('The number of people who will get it could not be read.')
    expect(card.textContent).not.toMatch(/\d/)
  })

  it('says the count could not be read on the page when its call fails', async () => {
    on('GET', COUNT_URL, { status: 500, body: { error: 'Something went wrong' } })
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    expect(await screen.findByText('The number of people who will get it could not be read.')).toBeTruthy()
  })
})

describe('the letter on the page', () => {
  it('makes "In this issue" from the headings as they are typed, and leaves it out under two parts', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const list = () => screen.queryByRole('navigation', { name: 'In this issue' })
    expect(within(list()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sample heading one', 'Sample heading two'])
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<h2>Sample heading three</h2>').run()
    })
    expect(within(list()!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Sample heading one', 'Sample heading two', 'Sample heading three'])
    await act(async () => {
      editorOf().commands.setContent('<h2>Sample heading one</h2><p>Sample</p>', { emitUpdate: true })
    })
    expect(list()).toBeNull()
  })

  it('moves the caret to a part from its line in "In this issue"', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    fireEvent.click(within(screen.getByRole('navigation', { name: 'In this issue' })).getByRole('button', { name: 'Sample heading two' }))
    const { $from } = editorOf().state.selection
    expect($from.parent.textContent).toBe('Sample words two')
  })

  it('moves the subject with a new month while the subject is still the old month\'s own, and keeps a subject a person wrote', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const subject = screen.getByRole('textbox', { name: /Subject/ }) as HTMLInputElement
    const month = async (words: string) => {
      fireEvent.click(screen.getByRole('button', { name: /Click to edit the month/ }))
      const box = screen.getByRole('textbox', { name: 'The month' })
      fireEvent.change(box, { target: { value: words } })
      fireEvent.keyDown(box, { key: 'Enter' })
      await settle()
    }
    await month('January 2027')
    expect(subject.value).toBe('LCA Newsletter · January 2027')
    fireEvent.change(subject, { target: { value: 'Sample subject of my own' } })
    await month('February 2027')
    expect(subject.value).toBe('Sample subject of my own')
    expect(screen.getByText('February 2027', { selector: 'span' })).toBeTruthy()
  })

  it('takes a link pasted in with its address alone, and leaves an address the email cannot keep as plain words', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    await act(async () => {
      editorOf().commands.setContent('<p><a href="https://example.org/a" target="_blank" rel="noopener" class="c" title="t">Sample one</a> <a href="javascript:alert(1)">Sample two</a> <a href="/a/path">Sample three</a></p>')
    })
    expect(editorOf().getHTML()).toBe('<p><a href="https://example.org/a">Sample one</a> Sample two Sample three</p>')
  })
})

describe('the characters the server refuses', () => {
  const CONTRACT = [...Array.from({ length: 0x20 }, (_, i) => i), 0x7f, ...Array.from({ length: 0x20 }, (_, i) => 0x80 + i), 0x2028, 0x2029, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069]
  const KEPT = [0x200d, 0x200c, 0xfe0f, 0x200e, 0x200f, 0x061c, 0x200b, 0x00ad, 0xfeff]

  it('drops each character the contract\'s own cases walk, and keeps the joiners, the marks, the zero width space and the soft hyphen', () => {
    for (const code of CONTRACT) {
      expect(isHiddenCharacter(code), code.toString(16)).toBe(true)
      expect(withoutHiddenCharacters(`Sample${String.fromCharCode(code)}words`), code.toString(16)).toBe('Samplewords')
    }
    for (const code of KEPT) expect(withoutHiddenCharacters(`Sample${String.fromCharCode(code)}words`), code.toString(16)).toBe(`Sample${String.fromCharCode(code)}words`)
  })

  it('drops exactly what the contract refuses, for every character from U+0000 to U+FFFF', () => {
    const subject = newsletterIssueSaveRequestSchema.shape.subject
    const differ: number[] = []
    for (let code = 0; code <= 0xffff; code += 1) {
      const refused = !subject.safeParse(`a${String.fromCharCode(code)}b`).success
      if (refused !== isHiddenCharacter(code)) differ.push(code)
    }
    expect(differ).toEqual([])
  })

  it('holds the page\'s three limits to the contract\'s', () => {
    expect([MONTH_LABEL_MAX, SUBJECT_MAX, PREHEADER_MAX]).toEqual([CONTRACT_MONTH_MAX, CONTRACT_SUBJECT_MAX, CONTRACT_PREHEADER_MAX])
  })

  it('drops them from the Subject and the month as they are typed or pasted, and keeps the caret among what stays', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const subject = screen.getByRole('textbox', { name: /Subject/ }) as HTMLInputElement
    subject.focus()
    fireEvent.change(subject, { target: { value: `Sample\tsub${String.fromCharCode(0x202e)}ject${String.fromCharCode(0x200d)} one`, selectionStart: 12 } })
    expect(subject.value).toBe(`Samplesubject${String.fromCharCode(0x200d)} one`)
    fireEvent.click(screen.getByRole('button', { name: /Click to edit the month/ }))
    const month = screen.getByRole('textbox', { name: 'The month' }) as HTMLInputElement
    expect(month.maxLength).toBe(MONTH_LABEL_MAX)
    fireEvent.change(month, { target: { value: `March\n2027${String.fromCharCode(0x2066)}` } })
    expect(month.value).toBe('March2027')
  })
})

describe('LCA\'s starters, written back by the page\'s editor', () => {
  it('leaves each starter, and an empty letter, untouched for holdsWords', async () => {
    for (const id of [...STARTER_IDS, 'empty']) {
      const sent = id === 'empty' ? '' : starterLetter(id as (typeof STARTER_IDS)[number])
      let written = ''
      await act(async () => {
        render(
          <LetterEditor initialHtml={sent} month="December 2026" onMonthChange={() => {}} onChange={() => {}} bigger={false} onBiggerChange={() => {}} onReady={(html) => {
            written = html
          }} />,
        )
      })
      await waitFor(() => expect(written).not.toBe(''))
      expect(written, id).toBe(sent === '' ? '<p></p>' : sent)
      expect(holdsWords({ monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml: written }), id).toBe(false)
      cleanup()
    }
  })
})

describe('the side preview', () => {
  it('draws renderNewsletter\'s email of the letter with a footer in the real words and sample links, in a frame that runs nothing', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    // The newest email is written into the frame not on show, which takes the other's place once the browser has
    // loaded it; jsdom loads no frame, so the newest is read where it was written.
    const frame = await waitFor(() => {
      const newest = [...document.querySelectorAll('iframe')].find((f) => f.getAttribute('srcdoc')?.includes('Sample words two'))
      expect(newest).toBeTruthy()
      return newest as HTMLIFrameElement
    })
    const email = frame.getAttribute('srcdoc')!
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('title')).toBe('The email as members will get it')
    expect(email.startsWith('<!DOCTYPE html>')).toBe(true)
    expect(email).toContain('<head>\n<base href="about:srcdoc">')
    expect(email).toContain('LCA Newsletter<br></span> December 2026</h1>')
    expect(email).toContain("You&#39;re getting the LCA newsletter because this address is on an LCA member&#39;s account.")
    // Every link but a jump link keeps its look and loses its address, so it is words drawn as a link that nothing can
    // follow, and still says it is a link, one not available, so a screen reader tells which words are links in the email
    // that is sent; a jump link keeps its own and scrolls inside the frame.
    expect(email).toContain('<a tabindex="-1" role="link" aria-disabled="true" style="color:#1a2744;text-decoration:underline;">Unsubscribe from the LCA newsletter</a>')
    expect(email).toContain('<a tabindex="-1" role="link" aria-disabled="true" style="color:#1a2744;text-decoration:underline;">LCA on Facebook</a>')
    expect(email).toContain('<a tabindex="-1" href="#sample-heading-two"')
    expect([...email.matchAll(/\bhref="([^"]*)"/g)].map((m) => m[1]).filter((href) => !href.startsWith('#'))).toEqual(['about:srcdoc'])
    expect(email).not.toMatch(/<script|@example\.org|newsletter@|target=/)
    for (const link of email.match(/<a\s(?!name=)[^>]*>/g) ?? []) {
      expect(link, link).toContain('tabindex="-1"')
      expect(link.includes(' href="'), link).toBe(!link.includes(' role="link" aria-disabled="true" '))
    }
  })

  it('puts on show the email of the letter as it stands, when a change taken back returns to the email the other frame holds', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('[data-slot="side-preview"] iframe')]
    const onShow = () => document.querySelector('[data-slot="side-preview"] iframe[data-shown]')?.getAttribute('srcdoc') ?? ''
    const written = (words: string) => frames().some((frame) => frame.getAttribute('srcdoc')?.includes(words))
    /** The browser has finished loading what each frame was given; jsdom loads no frame by itself. */
    const loaded = () => {
      for (const frame of frames()) fireEvent.load(frame)
    }
    // A: the letter as read, on show once its frame has loaded.
    await waitFor(() => expect(written('Sample words two')).toBe(true))
    loaded()
    expect(onShow()).toContain('Sample words two')
    const a = onShow()
    const letterA = editorOf().getHTML()
    // B: a word typed, drawn after the side's pause into the frame not on show, which takes its place once loaded.
    await act(async () => {
      editorOf().chain().focus('end').insertContent(' Zebrafish').run()
    })
    await waitFor(() => expect(written('Zebrafish')).toBe(true))
    expect(onShow()).toBe(a)
    loaded()
    expect(onShow()).toContain('Zebrafish')
    // A again: Undo takes the word away. The frame not on show already holds A, loaded, so it goes on show with no
    // load to come, and nothing new is written into either frame.
    await act(async () => {
      editorOf().commands.undo()
    })
    expect(editorOf().getHTML()).toBe(letterA)
    await waitFor(() => expect(onShow()).toBe(a))
    expect(frames().map((frame) => frame.getAttribute('srcdoc')?.includes('Zebrafish'))).toContain(true)
    expect(document.querySelectorAll('[data-slot="side-preview"] iframe[data-shown]')).toHaveLength(1)
    expect(document.querySelector('[data-slot="side-preview"] iframe:not([data-shown])')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('moves the keyboard\'s focus to the frame on show when the frame that held it goes away, and leaves it alone elsewhere', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const frames = () => [...document.querySelectorAll<HTMLIFrameElement>('[data-slot="side-preview"] iframe')]
    const onShow = () => document.querySelector<HTMLIFrameElement>('[data-slot="side-preview"] iframe[data-shown]')
    const written = (words: string) => frames().some((frame) => frame.getAttribute('srcdoc')?.includes(words))
    /** The browser has finished loading what each frame was given; jsdom loads no frame by itself. */
    const loaded = () => {
      for (const frame of frames()) fireEvent.load(frame)
    }
    /** Words put at the letter's end as typing puts them, without moving the focus to the letter; gives where they went. */
    const typed = async (words: string) => {
      const at = editorOf().state.doc.content.size - 1
      await act(async () => {
        editorOf().chain().insertContentAt(at, words).run()
      })
      return at
    }
    await waitFor(() => expect(written('Sample words two')).toBe(true))
    loaded()
    // The focus elsewhere, on Hide: a swap leaves it there.
    const hide = screen.getByRole('button', { name: 'Hide' })
    act(() => hide.focus())
    await typed(' Zebrafish')
    await waitFor(() => expect(written('Zebrafish')).toBe(true))
    const first = onShow()
    loaded()
    expect(onShow()).not.toBe(first)
    expect(document.activeElement).toBe(hide)
    // The focus in the email on show, as a click in it or Tab gives: a new email goes on show in the other frame once it
    // has loaded, and the focus goes with it rather than staying in the frame now hidden, which holds the older email.
    const holder = onShow()!
    act(() => holder.focus())
    expect(document.activeElement).toBe(holder)
    const at = await typed(' Quokka')
    await waitFor(() => expect(written('Quokka')).toBe(true))
    expect(document.activeElement).toBe(holder)
    loaded()
    const next = onShow()!
    expect(next).not.toBe(holder)
    expect(next.getAttribute('srcdoc')).toContain('Quokka')
    expect(holder.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(next)
    // The word taken away again puts the other frame on show at once, with no load to come; the focus goes with it too.
    await act(async () => {
      editorOf().chain().deleteRange({ from: at, to: at + ' Quokka'.length }).run()
    })
    await waitFor(() => expect(onShow()).toBe(holder))
    expect(holder.getAttribute('srcdoc')).not.toContain('Quokka')
    expect(next.getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(holder)
  })

  it('sets its width by Phone and Computer, and Hide puts it away with Show the email where Hide was', async () => {
    await site('/admin/newsletter', person({ role: 'lca_admin' }))
    await thePage()
    const phone = screen.getByRole('button', { name: 'Phone' })
    const computer = screen.getByRole('button', { name: 'Computer' })
    expect([phone.getAttribute('aria-pressed'), computer.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
    fireEvent.click(computer)
    expect([phone.getAttribute('aria-pressed'), computer.getAttribute('aria-pressed')]).toEqual(['false', 'true'])
    expect(document.querySelector('[data-view]')?.getAttribute('data-view')).toBe('computer')
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(document.querySelector('[data-slot="side-preview"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show the email' }))
    expect(document.querySelector('[data-slot="side-preview"]')).not.toBeNull()
  })
})
