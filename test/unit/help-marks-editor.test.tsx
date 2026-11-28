// @vitest-environment jsdom
//
// The one club editor's Help as small question marks (K's decision 16): every
// sentence of the Help list K's note of Thursday, November 19, 2026 asked for
// (test/unit/fixtures/help-words.json, written from that list and not from
// the code) is behind the mark beside its own part, word for word, in every
// variant of the words: the club's own rep or anyone else, the hidden email
// on or off, the new club pages on or off, the admin fields drawn or not. No
// sentence of the editor's or My region's bubbles speaks of how the pages
// are made or of what may change behind them. Each field keeps the name its
// label gives it, an observer's marks open though the form is shut, nothing
// opens by itself, nothing is read from or written to the browser's store,
// and from lg up the box fills the form's column beside the strip. Every
// name, club and address here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

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
const WORDS = JSON.parse(read('test/unit/fixtures/help-words.json')) as { editor: Record<string, Array<[string, string]>> }

/** A made-up club whose listing's words differ from today's page's, so each notice of today's different words shows. */
const CLUB = {
  id: 'example-knights-club', name: 'Example Knights Club', city: 'Example City', location: 'Example Library',
  description: 'Older words for the made-up club.', meeting_schedule: 'Mondays', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-knights', about_text: 'A friendly made-up club for casual games.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }

interface Variant { own: boolean; emailHidden: boolean; pagesOn: boolean; showAdmin: boolean }
const VARIANTS: Variant[] = []
for (const own of [true, false]) for (const emailHidden of [true, false]) for (const pagesOn of [true, false]) for (const showAdmin of [true, false]) {
  VARIANTS.push({ own, emailHidden, pagesOn, showAdmin })
}
const keyOf = (v: Variant) => `own=${v.own} emailHidden=${v.emailHidden} pagesOn=${v.pagesOn} showAdmin=${v.showAdmin}`

function draw({ own, emailHidden, pagesOn, showAdmin }: Variant, viewOnly = false) {
  Object.assign(flags, { clubEmailHidden: emailHidden, newClubs: pagesOn, newLook: pagesOn })
  const role = viewOnly ? 'lca_observer' : showAdmin ? 'lca_admin' : 'club_rep'
  const auth = {
    user: { id: 'm1' }, member: { id: 'm1', role, club_id: own ? CLUB.id : null, full_name: 'Player One' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <ClubEditor club={CLUB as never} places={[PLACE] as never} own={own} isAdmin={showAdmin && !viewOnly} showAdminFields={showAdmin} viewOnly={viewOnly} onSaved={() => {}} />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return screen.getByRole('button', { name: /^(Save and publish|Saving…)$/ }).closest('form') as HTMLFormElement
}

const marks = () => screen.getAllByRole('button', { name: /^Help: / })
const nameOf = (mark: HTMLElement) => (mark.getAttribute('aria-label') ?? '').replace(/^Help: /, '')
const bubbleOf = (mark: HTMLElement) => document.getElementById(mark.getAttribute('aria-controls') ?? '') as HTMLElement
/** What stands straight before a mark on its line: the label, the part's name, the heading or the button it follows. */
const before = (mark: HTMLElement) => mark.parentElement?.previousElementSibling as HTMLElement | null

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('the editor\'s Help, behind a mark beside each part', () => {
  it('holds every sentence of K\'s new list, word for word, in each of the sixteen variants of the words, and no other', () => {
    expect(Object.keys(WORDS.editor)).toEqual(VARIANTS.map(keyOf))
    for (const variant of VARIANTS) {
      draw(variant)
      const key = keyOf(variant)
      const list = WORDS.editor[key]
      const byName = new Map<string, HTMLElement[]>()
      for (const mark of marks()) byName.set(nameOf(mark), [...(byName.get(nameOf(mark)) ?? []), mark])
      const words = (name: string) => {
        const found = byName.get(name)
        expect(found, `${key} ${name}`).toBeDefined()
        const texts = new Set(found!.map((m) => bubbleOf(m).textContent))
        expect(texts.size, `${key} ${name}`).toBe(1)
        return [...texts][0]
      }
      const expected: string[] = []
      for (const [term, text] of list) {
        if (term === 'Logo and club color') {
          // Divided at a sentence's end: the logo's sentences beside the logo, the color's beside the color.
          expect(`${words('Logo')} ${words('Club color')}`, key).toBe(text)
          expected.push('Logo', 'Club color')
        } else {
          expect(words(term), `${key} ${term}`).toBe(text)
          expected.push(term)
        }
      }
      // Each mark holds one entry, so its bubble shows the words alone; no mark is drawn for a part the list says nothing of.
      expect([...byName.keys()].sort(), key).toEqual(expected.sort())
      expect(document.querySelectorAll('[data-slot="help-mark-bubble"] dt'), key).toHaveLength(0)
      cleanup()
    }
  })

  it('keeps K\'s rule in every sentence of every bubble, the editor\'s sixteen variants and My region\'s two: nothing of how the pages are made or of what may change, and none over 300 characters', async () => {
    // K's words: "never make references to how the pages are built or may change in the back end." The terms are not read: only the sentences.
    const REFUSED = ['today\'s', 'once the', 'new club pages', 'older form', 'will show', 'will be', 'not yet', 'switch', 'is drawn', 'is used once']
    /** Every sentence a bubble draws: its words alone, or the words of each of its entries. */
    const sentencesOf = (mark: HTMLElement) => {
      const bubble = bubbleOf(mark)
      const each = [...bubble.querySelectorAll('dd')]
      return each.length > 0 ? each.map((dd) => dd.textContent ?? '') : [bubble.textContent ?? '']
    }
    const drawn: Array<[string, string]> = []
    for (const variant of VARIANTS) {
      draw(variant)
      for (const mark of marks()) for (const text of sentencesOf(mark)) drawn.push([`${keyOf(variant)} ${nameOf(mark)}`, text])
      cleanup()
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url === '/api/workspace/region'
      ? new Response(JSON.stringify({
          clubs: [{
            id: 'c-knights', name: 'Example Knights Club', city: 'Example City', region: 'Bayou Region', color: '#1f4e79', logoUrl: null, statement: null,
            lastConfirmedAt: null, lastCheckWords: 'Not checked since Aug 2026', needsCheck: true, events: 1, openItems: [],
          }],
          thisMonth: { nextCheck: { day: '2026-12-07', date: 'Mon, Dec 7, 2026', time: '8:00 AM' }, checked: 0, notChecked: 1 },
          regions: [{ region: 'Bayou Region', keepers: [] }],
        }), { status: 200 })
      : new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }))))
    for (const role of ['member', 'lca_admin'] as const) {
      const auth = {
        user: { id: 'm-one' }, session: null, role, member: { id: 'm-one', role, club_id: null, full_name: 'Player One' }, loading: false, memberLoading: false,
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
      expect(marks(), role).toHaveLength(3)
      for (const mark of marks()) for (const text of sentencesOf(mark)) drawn.push([`My region ${role} ${nameOf(mark)}`, text])
      cleanup()
    }
    vi.unstubAllGlobals()
    // Sixteen variants of fourteen or fifteen marks each, and My region's seven entries twice.
    expect(drawn.length).toBeGreaterThan(16 * 14 + 14)
    for (const [where, text] of drawn) {
      expect(text.length, where).toBeGreaterThan(0)
      expect(text.length, where).toBeLessThanOrEqual(300)
      for (const words of REFUSED) expect(text.toLowerCase(), `${where}: ${words}`).not.toContain(words)
    }
  })

  it('stands each mark straight after the label, the part\'s name or the heading its words speak of, outside it', () => {
    draw({ own: true, emailHidden: true, pagesOn: false, showAdmin: true })
    const label = (id: string) => document.querySelector(`label[for="${id}"]`)
    const mark = (name: string) => screen.getByRole('button', { name: `Help: ${name}` })
    expect(before(mark('One sentence about the club'))).toBe(label('editor-aboutText'))
    expect(before(mark('How the club meets, in words'))).toBe(label('editor-howWeMeetText'))
    expect(before(mark('Where'))).toBe(document.getElementById('editor-where'))
    expect(before(mark('Contact name'))).toBe(label('editor-contactNamePublic'))
    expect(before(mark('Email for messages'))).toBe(label('editor-contactEmail'))
    expect(before(mark('Club name, region and page address'))).toBe(label('editor-name'))
    expect(before(mark('Logo'))).toBe(label('editor-logo'))
    expect(before(mark('Club color'))).toBe(label('editor-color'))
    // The three parts' marks stand in the legend after the part's name, which alone names the part.
    for (const [name, id] of [['Name and address', 'editor-part-address'], ['Cost and who is welcome', 'editor-part-cost'], ['Links', 'editor-part-links']]) {
      const each = mark(name)
      expect(before(each), name).toBe(document.getElementById(id))
      expect(each.closest('legend'), name).not.toBeNull()
      expect(screen.getByRole('group', { name }).getAttribute('aria-labelledby'), name).toBe(id)
    }
    // Each notice of today's different words, beside the words the field's description reads.
    const notices = screen.getAllByRole('button', { name: 'Help: Today\'s page shows different words here' })
    expect(notices.map((m) => before(m)?.id)).toEqual(['editor-aboutText-differs', 'editor-howWeMeetText-differs', 'editor-placeName-differs'])
    // Straight after Save and publish, and beside the Preview heading, outside it.
    expect(before(mark('Save and publish'))?.textContent).toBe('Save and publish')
    const preview = before(mark('Preview')) as HTMLElement
    expect(preview.tagName).toBe('H2')
    // The phone's Preview button is the heading's own; the mark is neither inside it nor inside the heading.
    expect(within(preview).getByRole('button', { name: 'Preview' })).toBeTruthy()
    expect(preview.contains(mark('Preview'))).toBe(false)
    // No mark is inside a label, and none on a part the list does not name.
    for (const each of marks()) expect(each.closest('label'), nameOf(each)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Help: Place 2' })).toBeNull()
  })

  it('leaves each field\'s name, each part\'s name and each heading as it was, and a press on a mark reaches no field', () => {
    const form = draw({ own: true, emailHidden: true, pagesOn: false, showAdmin: true })
    const names = [...form.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]), textarea, select')].map((el) => [...(el.labels ?? [])].map((l) => l.textContent).join(' '))
    expect(names).toEqual([
      'One sentence about the club', 'How the club meets, in words', 'Place name', 'Street address', 'Note about the place',
      'Pin: coordinates or a Google Maps link', 'Contact name, shown once the new club pages open', 'Email for messages, never shown',
      'Club name', 'City', 'Region', 'Page address', 'Cost', 'Who is welcome', 'The club plays on weekends', 'Scholastic friendly',
      'Facebook page', 'Website', 'Logo', 'Club color',
    ])
    for (const name of ['Where', 'Name and address', 'Cost and who is welcome', 'Links', 'Logo and club color']) expect(screen.getByRole('group', { name })).toBeTruthy()
    // jsdom draws no style, so the Preview heading's phone and wide forms both read "Preview" here, as before the marks.
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['The basics', 'PreviewPreview'])
    expect(screen.getByLabelText('Email for messages, never shown')).toBeTruthy()
    const email = screen.getByLabelText('Email for messages, never shown')
    fireEvent.click(screen.getByRole('button', { name: 'Help: Email for messages' }))
    expect(document.activeElement).not.toBe(email)
    // Every mark is a button of its own type, so none sends the form.
    for (const each of marks()) expect(each.getAttribute('type'), nameOf(each)).toBe('button')
  })

  it('opens an observer\'s marks, though the form is shut to them, and the fields stay shut', () => {
    const form = draw({ own: false, emailHidden: true, pagesOn: false, showAdmin: true }, true)
    for (const box of form.querySelectorAll<HTMLElement>('input, textarea, select')) expect(box.matches(':disabled'), box.id).toBe(true)
    expect(screen.getByRole('button', { name: 'Save and publish' }).matches(':disabled')).toBe(true)
    // Thirteen parts, with a notice of today's different words beside each of the three fields whose words differ.
    expect(marks().length).toBe(16)
    for (const each of marks()) {
      expect(each.matches(':disabled'), nameOf(each)).toBe(false)
      fireEvent.click(each)
      expect(bubbleOf(each).hidden, nameOf(each)).toBe(false)
      expect(each.getAttribute('aria-expanded'), nameOf(each)).toBe('true')
    }
    // Only one is open at a time: the last pressed.
    expect(document.querySelectorAll('[data-slot="help-mark-bubble"]:not([hidden])')).toHaveLength(1)
  })

  it('opens nothing by itself, moves no focus, and reads and writes nothing in the browser\'s store', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    draw({ own: true, emailHidden: true, pagesOn: false, showAdmin: false })
    for (const each of marks()) {
      expect(each.getAttribute('aria-expanded'), nameOf(each)).toBe('false')
      expect(bubbleOf(each).hidden, nameOf(each)).toBe(true)
    }
    expect(focus).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Help: Preview' }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Close help' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Club listing' })).queryByRole('heading', { name: 'Help' })).toBeNull()
  })
})

describe('the editor\'s box from lg up', () => {
  const classes = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

  it('fills the form\'s column, as tall as the strip beside it where the window has room, never taller than the window less 2rem nor under 70% of it, passes the wheel on at its ends, and changes nothing below lg', () => {
    const form = draw({ own: true, emailHidden: true, pagesOn: false, showAdmin: false })
    const box = form.querySelector('[data-slot="scroll-panel"]') as HTMLElement
    // The row stretches its columns, the form is a column, and the box takes the room left in it from nothing.
    const row = form.parentElement as HTMLElement
    expect(classes(row)).toEqual(expect.arrayContaining(['flex', 'flex-col', 'lg:flex-row', 'lg:items-stretch']))
    expect(classes(row)).not.toContain('lg:items-start')
    expect(classes(form)).toEqual(expect.arrayContaining(['lg:flex', 'lg:flex-1', 'lg:flex-col']))
    expect(classes(box)).toEqual(expect.arrayContaining(['lg:grow', 'lg:basis-0', 'lg:min-h-[70vh]', 'lg:max-h-[calc(100vh-2rem)]', 'overflow-auto', 'max-h-[70vh]']))
    // From lg up the box is bounded by the window, so its top and its foot fit in it together: no lg class lifts the bound.
    expect(classes(box)).not.toContain('lg:max-h-none')
    expect(classes(box).filter((name) => name.startsWith('lg:max-h-'))).toEqual(['lg:max-h-[calc(100vh-2rem)]'])
    // At its ends a wheel passes on to the page from lg up; the panel's own rule stays in the list for the widths below, where the box does not scroll.
    expect(classes(box)).toEqual(expect.arrayContaining(['overscroll-contain', 'lg:overscroll-auto']))
    // The strip keeps its own height, and so its sticky place, in the stretched row.
    const strip = screen.getByRole('complementary', { name: 'Preview' })
    expect(classes(strip)).toEqual(expect.arrayContaining(['lg:sticky', 'lg:top-4', 'lg:self-start']))
    // Below lg the box is the page's length, as before: every class this change adds is an lg one.
    for (const name of ['max-lg:max-h-none', 'max-lg:overflow-visible', 'max-lg:[&>[data-slot=scroll-panel-header]]:static']) expect(classes(box), name).toContain(name)
    const editor = read('src/areas/clubs/components/ClubEditor.tsx')
    expect(editor).toContain('const BOX = \'scroll-mt-[100vh] max-lg:max-h-none max-lg:overflow-visible max-lg:[&>[data-slot=scroll-panel-header]]:static lg:max-h-[calc(100vh-2rem)] lg:min-h-[70vh] lg:grow lg:basis-0 lg:overscroll-auto\'')
    expect(editor).not.toContain(' lg:max-h-none')
    // ScrollPanel takes the classes through its own className; the shared component is as it was.
    expect(read('src/components/ScrollPanel.tsx')).not.toMatch(/lg:grow|min-h-\[70vh\]|max-h-\[calc|overscroll-auto|help/i)
    // The header bar keeps its heading alone.
    const header = box.querySelector('[data-slot="scroll-panel-header"]') as HTMLElement
    expect(header.textContent).toBe('The basics')
    expect(header.querySelectorAll('button')).toHaveLength(0)
  })
})
