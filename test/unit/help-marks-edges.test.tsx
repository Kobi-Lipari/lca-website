// @vitest-environment jsdom
//
// The edges of Help's small question marks (K's decision 16), beyond
// help-mark.test.tsx, help-marks-editor.test.tsx and help-marks-region.test.tsx:
// races between timers and presses, a mark that leaves the page while its
// bubble is open, Escape reaching no handler above it, a bubble holding
// nothing to stop at with Tab, the focus alone opening nothing across every
// mark of the editor, the editor's own words under K's plain-language rules
// in every variant, no warning from React in any variant, two editors
// never sharing an id, and the mark's file holding to what it was ruled to
// be. Every name, club and address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HelpMark } from '@/areas/clubs/components/HelpMark'

const flags = vi.hoisted(() => ({ clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false }))
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
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))

const { ClubEditor } = await import('@/areas/clubs/components/ClubEditor')
const { MyRegionPage } = await import('@/pages/MyRegionPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const CLUB = {
  id: 'example-knights-club', name: 'Example Knights Club', city: 'Example City', location: 'Example Library',
  description: 'Older words for the made-up club.', meeting_schedule: 'Mondays', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club for casual games.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }

interface Variant { own: boolean; emailHidden: boolean; pagesOn: boolean; showAdmin: boolean; viewOnly?: boolean }
const VARIANTS: Variant[] = []
for (const own of [true, false]) for (const emailHidden of [true, false]) for (const pagesOn of [true, false]) for (const showAdmin of [true, false]) {
  VARIANTS.push({ own, emailHidden, pagesOn, showAdmin })
}

function authFor(role: string, clubId: string | null): AuthContextValue {
  return {
    user: { id: 'm1' }, member: { id: 'm1', role, club_id: clubId, full_name: 'Player One' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

function editor({ own, emailHidden, pagesOn, showAdmin, viewOnly = false }: Variant) {
  Object.assign(flags, { clubEmailHidden: emailHidden, newClubs: pagesOn, newLook: pagesOn })
  const role = viewOnly ? 'lca_observer' : showAdmin ? 'lca_admin' : 'club_rep'
  return (
    <AuthContext.Provider value={authFor(role, own ? CLUB.id : null)}>
      <MemoryRouter>
        <ClubEditor club={CLUB as never} places={[PLACE] as never} own={own} isAdmin={showAdmin && !viewOnly} showAdminFields={showAdmin} viewOnly={viewOnly} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

const marks = () => screen.getAllByRole('button', { name: /^Help: / })
const bubbleOf = (mark: HTMLElement) => document.getElementById(mark.getAttribute('aria-controls') ?? '') as HTMLElement
const openBubbles = () => document.querySelectorAll('[data-slot="help-mark-bubble"]:not([hidden])')

const ONE = [['Example part', 'Words that say what the example part is for.']] as const

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('a mark\'s timers and presses racing', () => {
  function two() {
    render(
      <div>
        <div className="relative"><span>First part</span><HelpMark name="First part" entries={ONE} /></div>
        <div className="relative"><span>Second part</span><HelpMark name="Second part" entries={ONE} /></div>
      </div>,
    )
    const a = screen.getByRole('button', { name: 'Help: First part' })
    const b = screen.getByRole('button', { name: 'Help: Second part' })
    return { a, b, bubbleA: bubbleOf(a), bubbleB: bubbleOf(b) }
  }

  it('stays open when the mouse comes back onto the mark before the closing wait is over', () => {
    vi.useFakeTimers()
    const { a, bubbleA } = two()
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubbleA.hidden).toBe(false)
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(250) })
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubbleA.hidden).toBe(false)
    // Leaving again closes it once, after the wait.
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(350) })
    expect(bubbleA.hidden).toBe(true)
  })

  it('a press on another mark while a resting mouse\'s bubble waits to close leaves the pressed one open', () => {
    vi.useFakeTimers()
    const { a, b, bubbleA, bubbleB } = two()
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    fireEvent.click(b)
    expect(bubbleA.hidden).toBe(true)
    expect(bubbleB.hidden).toBe(false)
    // The first one's closing wait was cleared and never touches the second.
    act(() => { vi.advanceTimersByTime(5000) })
    expect(bubbleB.hidden).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a mouse that moves from one mark to another leaves exactly one bubble open, the second', () => {
    vi.useFakeTimers()
    const { a, b, bubbleA, bubbleB } = two()
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.pointerEnter(b, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubbleA.hidden).toBe(true)
    expect(bubbleB.hidden).toBe(false)
    act(() => { vi.advanceTimersByTime(5000) })
    expect(openBubbles()).toHaveLength(1)
    expect(bubbleB.hidden).toBe(false)
  })

  it('a press before the opening wait is over opens it as a press, which a leaving mouse does not close', () => {
    vi.useFakeTimers()
    const { a, bubbleA } = two()
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(50) })
    fireEvent.click(a)
    expect(bubbleA.hidden).toBe(false)
    fireEvent.pointerLeave(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(bubbleA.hidden).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a mouse that comes to rest on another mark leaves a bubble a press opened where it is, and opens nothing', () => {
    vi.useFakeTimers()
    const { a, b, bubbleA, bubbleB } = two()
    fireEvent.click(a)
    expect(bubbleA.hidden).toBe(false)
    // A scroll slides the second mark under a still mouse.
    fireEvent.pointerEnter(b, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubbleA.hidden).toBe(false)
    expect(bubbleB.hidden).toBe(true)
    expect(b.getAttribute('aria-expanded')).toBe('false')
    fireEvent.pointerLeave(b, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(5000) })
    expect(bubbleA.hidden).toBe(false)
    expect(openBubbles()).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    // A press on the second mark still takes the place of the first.
    fireEvent.click(b)
    expect(bubbleA.hidden).toBe(true)
    expect(bubbleB.hidden).toBe(false)
    // Once the pressed bubble is closed, a resting mouse opens again.
    fireEvent.click(b)
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubbleA.hidden).toBe(false)
  })

  it('a touch that lands outside and turns into a swipe keeps the bubble open; a tap outside closes it', () => {
    const { a, bubbleA } = two()
    const outside = screen.getByText('Second part')
    fireEvent.click(a)
    expect(bubbleA.hidden).toBe(false)
    // The finger lands to scroll; the browser cancels the touch once it sees the scroll, and no click follows.
    fireEvent.pointerDown(outside, { pointerType: 'touch' })
    expect(bubbleA.hidden).toBe(false)
    fireEvent.pointerCancel(outside, { pointerType: 'touch' })
    expect(bubbleA.hidden).toBe(false)
    // A tap: the touch lands and ends in a click.
    fireEvent.pointerDown(outside, { pointerType: 'touch' })
    expect(bubbleA.hidden).toBe(false)
    fireEvent.click(outside)
    expect(bubbleA.hidden).toBe(true)
    // A mouse's press outside still closes it as the button goes down.
    fireEvent.click(a)
    fireEvent.pointerDown(outside, { pointerType: 'mouse' })
    expect(bubbleA.hidden).toBe(true)
  })

  it('a tap on another mark opens that one and closes the first, once', () => {
    const { a, b, bubbleA, bubbleB } = two()
    fireEvent.click(a)
    fireEvent.pointerDown(b, { pointerType: 'touch' })
    expect(bubbleA.hidden).toBe(false)
    fireEvent.click(b)
    expect(bubbleA.hidden).toBe(true)
    expect(bubbleB.hidden).toBe(false)
    expect(openBubbles()).toHaveLength(1)
  })

  it('a bubble that closes by Escape can open again by a press and by a resting mouse', () => {
    vi.useFakeTimers()
    const { a, bubbleA } = two()
    fireEvent.click(a)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(bubbleA.hidden).toBe(true)
    fireEvent.click(a)
    expect(bubbleA.hidden).toBe(false)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    fireEvent.pointerEnter(a, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(bubbleA.hidden).toBe(false)
  })

  it('a mark that leaves the page with its bubble open frees the next mark, and Escape afterwards passes on', () => {
    const first = render(<div className="relative"><span>First part</span><HelpMark name="First part" entries={ONE} /></div>)
    fireEvent.click(screen.getByRole('button', { name: 'Help: First part' }))
    first.unmount()
    render(<div className="relative"><span>Second part</span><HelpMark name="Second part" entries={ONE} /></div>)
    const second = screen.getByRole('button', { name: 'Help: Second part' })
    fireEvent.click(second)
    expect(bubbleOf(second).hidden).toBe(false)
    fireEvent.click(second)
    expect(bubbleOf(second).hidden).toBe(true)
    // With nothing open, no listener of a gone mark swallows Escape.
    const heard = vi.fn()
    document.addEventListener('keydown', heard)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    document.removeEventListener('keydown', heard)
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('Escape with a bubble open reaches no handler above the mark, a key other than Escape does, and the page\'s own Escape works again after', () => {
    const above = vi.fn()
    render(
      <div onKeyDown={above} className="relative">
        <span>First part</span>
        <HelpMark name="First part" entries={ONE} />
        <input aria-label="Example box" />
      </div>,
    )
    const mark = screen.getByRole('button', { name: 'Help: First part' })
    const box = screen.getByLabelText('Example box')
    fireEvent.click(mark)
    act(() => { box.focus() })
    // The focus moving to a field closed it; press the mark again and keep the focus in the field's neighbour.
    fireEvent.click(mark)
    fireEvent.keyDown(box, { key: 'a' })
    expect(above).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(above).toHaveBeenCalledTimes(1)
    expect(bubbleOf(mark).hidden).toBe(true)
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(above).toHaveBeenCalledTimes(2)
  })

  it('two marks of the same name never share an id', () => {
    render(
      <div>
        <div className="relative"><span>Same part</span><HelpMark name="Same part" entries={ONE} /></div>
        <div className="relative"><span>Same part</span><HelpMark name="Same part" entries={ONE} /></div>
      </div>,
    )
    const [x, y] = screen.getAllByRole('button', { name: 'Help: Same part' })
    expect(x.getAttribute('aria-controls')).not.toBe(y.getAttribute('aria-controls'))
    fireEvent.click(x)
    expect(bubbleOf(x).hidden).toBe(false)
    expect(bubbleOf(y).hidden).toBe(true)
  })
})

describe('the editor\'s marks walked as a keyboard reader walks them', () => {
  it('stand in the tab order, none opens when the focus reaches it, and no bubble holds anything to stop at', () => {
    render(editor({ own: true, emailHidden: true, pagesOn: true, showAdmin: true }))
    const all = marks()
    expect(all.length).toBeGreaterThan(12)
    for (const mark of all) {
      expect(mark.getAttribute('tabindex'), mark.getAttribute('aria-label') ?? '').not.toBe('-1')
      act(() => { mark.focus() })
      expect(document.activeElement).toBe(mark)
      expect(openBubbles(), mark.getAttribute('aria-label') ?? '').toHaveLength(0)
    }
    for (const mark of all) {
      fireEvent.click(mark)
      const bubble = bubbleOf(mark)
      expect(bubble.hidden).toBe(false)
      expect(bubble.querySelectorAll('a, button, input, select, textarea, summary, [tabindex], [contenteditable]'), mark.getAttribute('aria-label') ?? '').toHaveLength(0)
      expect(bubble.querySelectorAll('[role="button"], [role="link"]')).toHaveLength(0)
    }
  })

  it('Escape with the focus in a field closes the bubble and leaves the field, its focus and its words as they were', () => {
    render(editor({ own: true, emailHidden: true, pagesOn: false, showAdmin: false }))
    const about = screen.getByLabelText('One sentence about the club') as HTMLTextAreaElement
    fireEvent.change(about, { target: { value: 'Words typed by Player One.' } })
    const mark = screen.getByRole('button', { name: 'Help: Email for messages' })
    fireEvent.click(mark)
    act(() => { about.focus() })
    // The focus moving to the field closed it; open it by a press, then press Escape from the field.
    expect(bubbleOf(mark).hidden).toBe(true)
    fireEvent.click(mark)
    fireEvent.keyDown(about, { key: 'Escape' })
    expect(bubbleOf(mark).hidden).toBe(true)
    expect(about.value).toBe('Words typed by Player One.')
    expect(document.activeElement).toBe(about)
  })

  it('a resting mouse opens a bubble beside an editor part after the wait, with that part\'s own words, and leaving closes it', () => {
    vi.useFakeTimers()
    render(editor({ own: true, emailHidden: true, pagesOn: false, showAdmin: false }))
    const mark = screen.getByRole('button', { name: 'Help: Email for messages' })
    fireEvent.pointerEnter(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(149) })
    expect(bubbleOf(mark).hidden).toBe(true)
    act(() => { vi.advanceTimersByTime(2) })
    expect(bubbleOf(mark).hidden).toBe(false)
    expect(bubbleOf(mark).textContent).toMatch(/\S/)
    fireEvent.pointerLeave(mark, { pointerType: 'mouse' })
    act(() => { vi.advanceTimersByTime(400) })
    expect(bubbleOf(mark).hidden).toBe(true)
    fireEvent.pointerEnter(mark, { pointerType: 'touch' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(bubbleOf(mark).hidden).toBe(true)
  })

  it('two editors on one page never share an id, so each mark opens its own bubble', () => {
    const { container } = render(<div>{editor({ own: true, emailHidden: true, pagesOn: false, showAdmin: false })}{editor({ own: true, emailHidden: true, pagesOn: false, showAdmin: false })}</div>)
    const ids = [...container.querySelectorAll('[data-slot="help-mark-bubble"]')].map((el) => el.id)
    expect(ids.length).toBeGreaterThan(20)
    expect(new Set(ids).size).toBe(ids.length)
    const [first, , , , , , , , , , , , , , , second] = marks()
    expect(first.getAttribute('aria-controls')).not.toBe(second.getAttribute('aria-controls'))
    fireEvent.click(first)
    expect(openBubbles()).toHaveLength(1)
    fireEvent.click(second)
    expect(openBubbles()).toHaveLength(1)
    expect(bubbleOf(second).hidden).toBe(false)
  })
})

describe('the words and the marks under K\'s plain-language rules, in every variant', () => {
  /** Dates carry their weekday: no month and day without one right before. */
  const BARE_DATE = /(?<!(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,? )\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}\b/
  function rules(text: string, where: string) {
    expect(text, `${where}: US Chess, never the old initials`).not.toMatch(new RegExp('US' + 'CF'))
    expect(text, `${where}: no long dash`).not.toMatch(/[\u2013\u2014]/)
    expect(text, `${where}: one half is written as a half sign`).not.toMatch(/\d\.5\b/)
    expect(text, `${where}: a time is written 7:00 PM`).not.toMatch(/(?<![:\d])\b\d{1,2}\s?(?:am|pm|AM|PM)\b|\b\d{1,2}:\d{2}\s?(?:am|pm|a\.m\.|p\.m\.|A\.M\.|P\.M\.)(?!\w)/)
    expect(text, `${where}: a date carries its weekday`).not.toMatch(BARE_DATE)
  }

  it('hold in every one of the editor\'s sixteen variants, for the marks\' names and each bubble', () => {
    for (const variant of VARIANTS) {
      const { unmount } = render(editor(variant))
      const where = JSON.stringify(variant)
      for (const mark of marks()) {
        rules(mark.getAttribute('aria-label') ?? '', where)
        rules(bubbleOf(mark).textContent ?? '', `${where} ${mark.getAttribute('aria-label')}`)
        expect(bubbleOf(mark).textContent?.trim().length, `${where} ${mark.getAttribute('aria-label')}`).toBeGreaterThan(10)
      }
      unmount()
    }
  })

  it('hold on My region for a representative and for an LCA admin', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/workspace/region'
      ? new Response(JSON.stringify({
        clubs: [{ id: 'c-knights', name: 'Example Knights Club', city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement: null, lastConfirmedAt: null, lastCheckWords: 'Not checked yet', needsCheck: true, events: 0, openItems: [] }],
        thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 1 },
        regions: [{ region: 'Bayou Region', keepers: [] }],
      }), { status: 200 })
      : new Response('{}', { status: 404 }))))
    try {
      for (const role of ['member', 'lca_admin'] as const) {
        const auth = {
          ...authFor(role, null),
          seats: role === 'member' ? [{ id: 's1', slug: 'example', role: 'Regional representative', category: 'regional_rep', started_at: '2026-01-01' }] : [],
          isBoardMember: role === 'member', assuranceLevel: 'aal1', mfaRequired: false,
        } as unknown as AuthContextValue
        const { unmount } = render(<AuthContext.Provider value={auth}><MemoryRouter initialEntries={['/workspace/region']}><MyRegionPage /></MemoryRouter></AuthContext.Provider>)
        await screen.findByRole('heading', { level: 2, name: 'Clubs' }, { timeout: 5000 })
        await act(async () => {})
        expect(marks()).toHaveLength(3)
        for (const mark of marks()) {
          rules(mark.getAttribute('aria-label') ?? '', role)
          rules(bubbleOf(mark).textContent ?? '', `${role} ${mark.getAttribute('aria-label')}`)
        }
        unmount()
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('React finds nothing to warn of in any mark', () => {
  it('draws and opens every mark of the editor, in every variant and for an observer, with no warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const variant of [...VARIANTS, { own: false, emailHidden: true, pagesOn: false, showAdmin: true, viewOnly: true }]) {
      const { unmount } = render(editor(variant))
      for (const mark of marks()) fireEvent.click(mark)
      unmount()
    }
    expect(error.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([])
    expect(warn.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([])
  })
})

describe('the mark\'s file holds to what it was ruled to be', () => {
  const file = read('src/areas/clubs/components/HelpMark.tsx')
  const code = file.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n')

  it('adds no dependency, no portal, no fixed place, no storage and no live region, and keeps the page\'s own order', () => {
    expect(code).not.toMatch(/createPortal|react-dom|radix|floating-ui|popper|framer/i)
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/)
    expect(code).not.toMatch(/\bfixed\b/)
    expect(code).not.toMatch(/aria-live|role="(?:tooltip|dialog|status|alert)"|aria-modal/)
    expect(code).not.toMatch(/\.focus\(/)
    expect(code).toMatch(/CircleHelp/)
    expect(code).toMatch(/type="button"/)
    expect(code).toMatch(/aria-expanded/)
    expect(code).toMatch(/aria-controls/)
    expect(code).toMatch(/useId\(\)/)
    expect(code).toMatch(/hidden=\{/)
    // The ring the site's other controls have.
    expect(code).toMatch(/focus-visible:ring-3 focus-visible:ring-focus/)
    // No colour of the gold, whose contrast on a light ground is too low.
    expect(code).not.toMatch(/gold|#c8a94a|text-accent/i)
    // Any motion added would have to stop under reduced motion.
    if (/transition|animate-|duration-/.test(code)) expect(code).toMatch(/motion-reduce|prefers-reduced-motion/)
  })

  it('the package\'s dependencies are the ones the site had, with no popover or tooltip added for this', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> }
    const names = Object.keys(pkg.dependencies ?? {})
    expect(names.filter((n) => /popover|tooltip|floating|popper|tippy|headless/i.test(n))).toEqual([])
  })

  it('no Help button or panel stands in My region or the club editor\'s files, and no key is read for them', () => {
    for (const path of [
      'src/pages/MyRegionPage.tsx', 'src/areas/clubs/components/ClubEditor.tsx', 'src/areas/clubs/components/EditorBasics.tsx',
      'src/areas/clubs/components/EditorPlaces.tsx', 'src/areas/clubs/components/ThisMonthBar.tsx',
      'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/RegionHelp.tsx',
    ]) {
      const text = read(path)
      expect(text, path).not.toMatch(/Close help/)
      expect(text, path).not.toMatch(/EditorHelpButton|RegionHelpButton|helpShownBefore|regionHelpShownBefore|rememberHelpShown|rememberRegionHelpShown|HELP_SHOWN_KEY|focusWithoutJump/)
      expect(text, path).not.toMatch(/localStorage|sessionStorage/)
    }
  })
})
