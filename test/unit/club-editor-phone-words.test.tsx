// @vitest-environment jsdom
//
// The last small round of checkpoint T's review. On a phone, below the width
// where the previews stand beside it, the editor's form runs the page's full
// length with no box of its own to scroll, so the box is neither a stop for
// Tab nor a named region there, and a field a save refuses is brought into
// view clear of the site's header; from that width up the box is as it was.
// On a phone Help opened above the window, or with its top under the site's
// header, comes into view by its top, and every control keeps clear of the
// header when the focus moves to it, a box of words only when Tab moves it.
// A box that scrolls at every width, as every other page's, draws as before.
// The words say "your" only to the club's own rep: a region's representative
// and an LCA admin read "the club's" in the previews, the checklist, the card
// that links to today's page, the email's label, the logo's description and
// Help, on Your club's page and on the admin club page's Details tab. Every
// name, address and club here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

vi.setConfig({ testTimeout: 15000 })

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

const { AdminClubPage } = await import('@/pages/AdminClubPage')
const { YourClubPage } = await import('@/pages/YourClubPage')
const { ScrollPanel } = await import('@/components/ScrollPanel')
const { HELP_SHOWN_KEY } = await import('@/areas/clubs/editor')

const ID = 'example-chess-club'
const SLUG = 'example-chess'
const LOGO = `/api/clubs/${ID}/logo?v=1`
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: LOGO, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: SLUG, about_text: 'A friendly made-up club that meets every week.', how_we_meet_text: 'Tuesdays at 7:00 PM in Room B',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: '2026-11-14 14:35:00', told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const REST = { officers: [], roster: [], tournaments: [], places: [] }
/** The width from which the previews stand beside the form: Tailwind's lg. */
const SIDE_BY_SIDE = '(min-width: 64rem)'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: string[] = []

/** The window's width as the browser's media queries read it, which a case can change while the page is drawn. */
const screenNow = { wide: true, changed: new Set<() => void>() }
function windowIs(width: 'phone' | 'computer') {
  screenNow.wide = width === 'computer'
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    get matches() { return media === SIDE_BY_SIDE ? screenNow.wide : false },
    addEventListener: (_: string, fn: () => void) => { if (media === SIDE_BY_SIDE) screenNow.changed.add(fn) },
    removeEventListener: (_: string, fn: () => void) => { screenNow.changed.delete(fn) },
  }))
}
function turnTo(width: 'phone' | 'computer') {
  screenNow.wide = width === 'computer'
  act(() => { for (const fn of [...screenNow.changed]) fn() })
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  window.localStorage.setItem(HELP_SHOWN_KEY, 'shown')
  screenNow.changed.clear()
  asked = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push(call)
    if (call === `GET /api/admin/clubs/${ID}` || call === `GET /api/admin/clubs/${SLUG}`) return json({ club: CLUB, ...REST })
    if (call === `GET /api/admin/clubs/${ID}/news`) return json({ news: [] })
    return json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView
})

type Person = 'rep' | 'representative' | 'admin'
function signedIn(person: Person): AuthContextValue {
  const who = {
    rep: { id: 'm-rep', role: 'club_rep', club_id: ID, managed: [] as string[] },
    representative: { id: 'm-region', role: 'member', club_id: null, managed: [ID] },
    admin: { id: 'm-admin', role: 'lca_admin', club_id: null, managed: [] as string[] },
  }[person]
  return {
    user: { id: who.id }, member: { id: who.id, role: who.role, club_id: who.club_id, full_name: 'Player Two' }, session: null, role: who.role,
    loading: false, memberLoading: false, seats: [], managedClubs: who.managed.map((id) => ({ id, name: 'Example Chess Club', region: 'Bayou Region' })),
    directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
}

async function editorDrawn() {
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  await act(async () => {})
  return save
}
async function openYourClub(person: Person) {
  render(
    <AuthContext.Provider value={signedIn(person)}>
      <MemoryRouter initialEntries={[`/my/club/${SLUG}`]}>
        <Routes><Route path="/my/club/:slug" element={<YourClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return editorDrawn()
}
async function openAdminClub(person: Person) {
  render(
    <AuthContext.Provider value={signedIn(person)}>
      <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return editorDrawn()
}
const box = () => document.querySelector('[data-slot="scroll-panel"]') as HTMLElement
const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/)
const attributes = (el: Element) => [...el.attributes].map((a) => `${a.name}=${a.value}`)

describe('the editor on a phone runs the page\'s length, and from the width of the previews beside it is the box it was', () => {
  it('is no stop for Tab and no named region below that width, a box of its own that scrolls from it, and follows the window across it', async () => {
    windowIs('phone')
    await openYourClub('rep')
    expect(screen.queryByRole('region', { name: 'Club listing' })).toBeNull()
    for (const name of ['role', 'aria-label', 'tabindex']) expect(box().hasAttribute(name), name).toBe(false)
    // The classes lift the height bound and the scrolling below lg, and the header bar stays where it is drawn.
    for (const name of ['max-lg:max-h-none', 'max-lg:overflow-visible', 'max-lg:[&>[data-slot=scroll-panel-header]]:static']) expect(classes(box()), name).toContain(name)
    // From lg up the box keeps today's bound, scrolling and Tab's way past the page's heading.
    for (const name of ['max-h-[70vh]', 'overflow-auto', 'overscroll-contain', 'scroll-mt-[100vh]']) expect(classes(box()), name).toContain(name)
    // Save and publish follows the form, and the previews follow Save.
    const save = screen.getByRole('button', { name: 'Save and publish' })
    expect(box().compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(save.compareDocumentPosition(screen.getByRole('complementary', { name: 'Preview' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    turnTo('computer')
    const region = screen.getByRole('region', { name: 'Club listing' })
    expect(region).toBe(box())
    expect(region.tabIndex).toBe(0)
    turnTo('phone')
    expect(screen.queryByRole('region', { name: 'Club listing' })).toBeNull()
    expect(box().hasAttribute('tabindex')).toBe(false)
  })

  it('leaves a panel that scrolls at every width drawn as before, attribute for attribute, whatever the window', () => {
    for (const width of ['phone', 'computer'] as const) {
      windowIs(width)
      render(<ScrollPanel label="Setup steps" header={<p>Setup steps</p>} className="max-h-96"><ol /></ScrollPanel>)
      const panel = screen.getByRole('region', { name: 'Setup steps' })
      expect(attributes(panel), width).toEqual([
        'role=region', 'aria-label=Setup steps', 'tabindex=0', 'data-slot=scroll-panel',
        'class=overflow-auto overscroll-contain rounded-lg border border-hairline bg-surface outline-none focus-visible:ring-3 focus-visible:ring-focus max-h-96',
        'style=scroll-padding-top: 4px;',
      ])
      cleanup()
    }
  })

  it('brings a field a save refused into view clear of the site\'s header on a phone, and leaves it to the box\'s own scroll from the width of the previews', async () => {
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true })
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    let fieldTop = 20
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.id === 'editor-facebookUrl' ? fieldTop : 300
      return { top, bottom: top + 44, left: 0, right: 300, width: 300, height: 44, x: 0, y: top, toJSON: () => ({}) } as DOMRect
    })
    const refuse = async () => {
      fireEvent.change(screen.getByLabelText('Facebook page'), { target: { value: 'not a link' } })
      focus.mockClear()
      scrolled.mockClear()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save and publish' })) })
      const field = document.getElementById('editor-facebookUrl') as HTMLElement
      expect(document.activeElement).toBe(field)
      return { field, calls: focus.mock.contexts.map((el, i) => [el, focus.mock.calls[i][0]] as const).filter(([el]) => el === field) }
    }

    windowIs('phone')
    await openYourClub('rep')
    // Its top under the header: it comes to the window's middle, the browser's own scroll held back.
    let { field, calls } = await refuse()
    expect(calls).toEqual([[field, { preventScroll: true }]])
    expect(scrolled.mock.contexts).toEqual([field])
    expect(scrolled.mock.calls).toEqual([[{ block: 'center' }]])
    // Clear of the header and inside the window: it stays where it is.
    fieldTop = 300
    ;({ field, calls } = await refuse())
    expect(calls).toEqual([[field, { preventScroll: true }]])
    expect(scrolled).not.toHaveBeenCalled()
    // Below the window's foot: brought up to its middle.
    fieldTop = window.innerHeight - 10
    await refuse()
    expect(scrolled.mock.calls).toEqual([[{ block: 'center' }]])
    expect(asked.filter((c) => c.startsWith('PATCH'))).toEqual([])
    cleanup()

    windowIs('computer')
    fieldTop = 20
    await openYourClub('rep')
    ;({ field, calls } = await refuse())
    expect(calls).toEqual([[field, undefined]])
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('still moves the focus into Help without the page\'s jump on a phone, where Help sits in the page', async () => {
    window.localStorage.clear()
    windowIs('phone')
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    await openAdminClub('admin')
    const help = document.getElementById('club-editor-help') as HTMLElement
    expect(document.activeElement).toBe(help)
    expect(focus.mock.contexts.map((el, i) => [el, focus.mock.calls[i][0]] as const).filter(([el]) => el === help)).toEqual([[help, { preventScroll: true }]])
    expect(classes(help)).toContain('scroll-mt-24')
  })

  it('brings Help opened above the window or under the site\'s header on a phone into view by its top, where its heading is, by its nearest edge below the window, and from the width of the previews only from above the window', async () => {
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true })
    // Help on a phone is taller than the window, here 1,900 pixels against the window's 768.
    let helpTop = -1654
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = this.id === 'club-editor-help' ? helpTop : 300
      const height = this.id === 'club-editor-help' ? 1900 : 44
      return { top, bottom: top + height, left: 0, right: 300, width: 300, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect
    })
    windowIs('phone')
    await openYourClub('rep')
    const button = screen.getByRole('button', { name: 'Help' })
    const help = document.getElementById('club-editor-help') as HTMLElement
    const open = async () => {
      scrolled.mockClear()
      await act(async () => { fireEvent.click(button) })
      expect(document.activeElement).toBe(help)
    }
    // Pressed at the page's foot, as a screen reader can press it without scrolling the page: Help's top is far above the window.
    await open()
    expect(scrolled.mock.contexts).toEqual([help])
    expect(scrolled.mock.calls).toEqual([[{ block: 'start' }]])
    await act(async () => { fireEvent.click(button) })
    // Below the window's foot: its nearest edge, as before.
    helpTop = window.innerHeight + 10
    await open()
    expect(scrolled.mock.calls).toEqual([[{ block: 'nearest' }]])
    await act(async () => { fireEvent.click(button) })
    // Its top inside the window but under the header, so its heading would sit under it: by its top too.
    helpTop = 40
    await open()
    expect(scrolled.mock.contexts).toEqual([help])
    expect(scrolled.mock.calls).toEqual([[{ block: 'start' }]])
    await act(async () => { fireEvent.click(button) })
    // In view: it stays where it is.
    helpTop = 200
    await open()
    expect(scrolled).not.toHaveBeenCalled()
    cleanup()

    // From the width of the previews up, as before: a top inside the window stays, one above it comes in by its top.
    windowIs('computer')
    await openYourClub('rep')
    const wide = screen.getByRole('button', { name: 'Help' })
    const wideHelp = document.getElementById('club-editor-help') as HTMLElement
    for (const [at, calls] of [[40, []], [0, []], [-20, [[{ block: 'start' }]]]] as const) {
      helpTop = at
      scrolled.mockClear()
      await act(async () => { fireEvent.click(wide) })
      expect(document.activeElement, String(at)).toBe(wideHelp)
      expect(scrolled.mock.calls, String(at)).toEqual(calls)
      await act(async () => { fireEvent.click(wide) })
    }
  })

  it('keeps each control of the editor clear of the site\'s header below the width of the previews, and adds nothing from it up', async () => {
    windowIs('phone')
    await openYourClub('rep')
    const editor = (box().closest('form') as HTMLFormElement).parentElement as HTMLElement
    const room = 'max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24'
    expect(classes(editor)).toContain(room)
    // Every control the focus can move to on the page is inside it: the form, Save and publish, its status's link and the previews.
    expect(editor.contains(screen.getByRole('button', { name: 'Save and publish' }))).toBe(true)
    expect(editor.contains(screen.getByRole('button', { name: 'Preview' }))).toBe(true)
    for (const control of box().querySelectorAll('a, button, input, select, textarea')) expect(editor.contains(control)).toBe(true)
    // Below lg alone: no class of the editor's own sets a scroll margin from lg up, so the box keeps P3's.
    expect(classes(editor).filter((c) => c.includes('scroll-m') && !c.startsWith('max-lg:'))).toEqual([])
    expect(classes(box()).filter((c) => c.includes('scroll-m'))).toEqual(['scroll-mt-[100vh]'])
    // The two links above the editor on Your club's page keep the same room below lg.
    const links = screen.getByRole('link', { name: 'See your page' }).parentElement as HTMLElement
    expect(links.contains(screen.getByRole('link', { name: /^Back to your / }))).toBe(true)
    expect(classes(links).filter((c) => c.includes('scroll-m'))).toEqual(['max-lg:[&_a]:scroll-mt-24'])
  })

  it('brings a box of words Tab moves to below the site\'s header on a phone by its top, since the browser finds its caret instead, and leaves every other control and every width to the browser', async () => {
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true })
    let top = 20
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return { top, bottom: top + 96, left: 0, right: 300, width: 300, height: 96, x: 0, y: top, toJSON: () => ({}) } as DOMRect
    })
    windowIs('phone')
    await openYourClub('rep')
    const words = document.getElementById('editor-aboutText') as HTMLTextAreaElement
    const line = screen.getByLabelText('Contact name, shown once the new club pages open')
    // Tab pressed in one control, and the focus moving to the next, as the browser moves it.
    const tab = (from: HTMLElement, to: HTMLElement) => {
      scrolled.mockClear()
      fireEvent.keyDown(from, { key: 'Tab', shiftKey: true })
      act(() => { to.focus() })
      expect(document.activeElement).toBe(to)
    }
    // Its first line under the header: brought down by its top, which its scroll margin keeps clear.
    tab(line, words)
    expect(scrolled.mock.contexts).toEqual([words])
    expect(scrolled.mock.calls).toEqual([[{ block: 'start' }]])
    // A one-line box is left to the browser, which reads its scroll margin.
    tab(words, line)
    expect(scrolled).not.toHaveBeenCalled()
    // Clear of the header: it stays where it is.
    top = 300
    tab(line, words)
    expect(scrolled).not.toHaveBeenCalled()
    cleanup()

    // From the width of the previews up nothing is added, as before.
    windowIs('computer')
    top = 20
    await openYourClub('rep')
    tab(screen.getByLabelText('Contact name, shown once the new club pages open'), document.getElementById('editor-aboutText') as HTMLElement)
    expect(scrolled).not.toHaveBeenCalled()
  })

  it('leaves the page where it is on a phone when a box of words is tapped or clicked, when it gets the focus back with the window, and when the focus comes without Tab', async () => {
    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scrolled, configurable: true, writable: true })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return { top: 20, bottom: 116, left: 0, right: 300, width: 300, height: 96, x: 0, y: 20, toJSON: () => ({}) } as DOMRect
    })
    windowIs('phone')
    await openYourClub('rep')
    const words = document.getElementById('editor-aboutText') as HTMLTextAreaElement
    const line = screen.getByLabelText('Contact name, shown once the new club pages open')
    const next = document.getElementById('editor-howWeMeetText') as HTMLTextAreaElement

    // A Tab that took the focus out of the editor, then a tap on the box's lower part: the press forgets the Tab.
    act(() => { line.focus() })
    fireEvent.keyDown(line, { key: 'Tab' })
    fireEvent.pointerDown(words)
    act(() => { words.focus() })
    expect(document.activeElement).toBe(words)
    // The same with a click by mouse.
    act(() => { line.focus() })
    fireEvent.keyDown(line, { key: 'Tab' })
    fireEvent.pointerDown(next, { pointerType: 'mouse' })
    act(() => { next.focus() })
    expect(document.activeElement).toBe(next)
    // A focus with no Tab before it, as a script or the browser gives.
    act(() => { words.focus() })
    expect(scrolled).not.toHaveBeenCalled()

    // The window comes back while the box has the focus and the page is scrolled past it: the browser tells the box again.
    act(() => { words.blur() })
    act(() => { words.focus() })
    fireEvent.focusIn(words)
    fireEvent.focus(words)
    expect(scrolled).not.toHaveBeenCalled()
    // Tab pressed in the box, as a switch to another program can reach the page, and the focus told again to the same box.
    fireEvent.keyDown(words, { key: 'Tab', altKey: true })
    fireEvent.focusIn(words)
    expect(document.activeElement).toBe(words)
    expect(scrolled).not.toHaveBeenCalled()
    // A real Tab from there still brings the next box down by its top.
    fireEvent.keyDown(words, { key: 'Tab' })
    act(() => { next.focus() })
    expect(scrolled.mock.contexts).toEqual([next])
    expect(scrolled.mock.calls).toEqual([[{ block: 'start' }]])
  })
})

/** Every heading, label, description and sentence of the editor, its previews and Help, as a person and a screen reader meet them. */
function editorWords(): string {
  const form = screen.getByRole('button', { name: 'Save and publish' }).closest('form') as HTMLFormElement
  const column = screen.getByRole('complementary', { name: 'Preview' })
  const help = document.getElementById('club-editor-help') as HTMLElement
  const named = [...document.querySelectorAll('[alt], [aria-label]')].map((el) => el.getAttribute('alt') ?? el.getAttribute('aria-label'))
  return [form.textContent, column.textContent, help.textContent, ...named].join('\n')
}
/** "your" before the club, its page, its card or its logo, which only the club's own rep may read. */
const YOURS = /\byour (?:club|page|card|logo)/i

describe('the words say "your" only to the club\'s own rep', () => {
  const OTHERS = [
    'How the club\'s page shows up in a search', 'When someone shares the club\'s page', 'The club\'s card in LCA\'s club directory',
    'Checklist for the club\'s page', 'Address of the club\'s page', 'How the club meets, in its own words', 'The club\'s logo',
  ]
  const OWN = [
    'How your page shows up in a search', 'When someone shares your page', 'Your card in LCA\'s club directory', 'Your page\'s checklist',
    'Your page\'s address', 'How the club meets, in your words', 'Your club\'s logo',
  ]

  it('keeps "your" for the club\'s own rep, on Your club\'s page and on the admin club page', async () => {
    for (const open of [openYourClub, openAdminClub]) {
      await open('rep')
      const words = editorWords()
      for (const piece of OWN) expect(words, `${open.name} ${piece}`).toContain(piece)
      expect(words, open.name).toContain('It is shown as About on your club\'s page')
      cleanup()
    }
  })

  it('says "the club\'s" to a region\'s representative and an LCA admin on Your club\'s page, and on the admin club page\'s Details tab, with every switch the words follow', async () => {
    const seen: Array<[string, () => Promise<unknown>]> = [
      ['a representative let in by the region', () => openYourClub('representative')],
      ['an LCA admin on Your club\'s page', () => openYourClub('admin')],
      ['an LCA admin on the admin club page', () => openAdminClub('admin')],
    ]
    for (const settings of [{ clubEmailHidden: true, newClubs: false, newLook: false }, { clubEmailHidden: false, newClubs: true, newLook: true }]) {
      for (const [who, open] of seen) {
        Object.assign(flags, settings)
        await open()
        const words = editorWords()
        const at = `${who}, ${JSON.stringify(settings)}`
        expect(words, at).not.toMatch(YOURS)
        for (const piece of OTHERS) expect(words, `${at}: ${piece}`).toContain(piece)
        if (!settings.clubEmailHidden) expect(screen.getByLabelText('Email for messages, shown on the club\'s page today'), at).toBeTruthy()
        // Help names the card by the name the reader sees.
        if (!settings.newClubs) expect(words, at).toContain('keeps the address shown under "Address of the club\'s page"')
        else expect(words, at).toContain('The address of the club\'s page is made from the club\'s name')
        cleanup()
      }
    }
  })
})
