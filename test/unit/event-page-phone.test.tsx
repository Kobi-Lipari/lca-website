// @vitest-environment jsdom
//
// The public page of one event (/tournaments/:id) on a phone, and the six
// places it names US Chess (K's decision 13, choice 2 a). The page's grid now
// carries one class in both looks, 'grid grid-cols-1 gap-8 lg:grid-cols-3':
// its one column below 1024 pixels may be narrower than its widest item, so
// on a phone the sections table scrolls in its own box and not the whole page
// sideways, as it already did under the new look. Since the box now scrolls
// in both looks, it is the same named region in the tab order in both
// (tabIndex 0, role "region", aria-label "Sections"), so a keyboard can reach
// it and scroll it in every browser. The side card's Format row keeps a gap
// between its label and its longer value, and a value that wraps stays
// against the right edge. The six places a person reads the old initials now
// say US Chess, in the words the site's newer pages use: the label beside a
// member's number in the confirmation card, the sentence that refuses a
// registration with no number on the profile and the link under it, the chip
// in the hero, the number on each roster row and the Format line in the side
// card. Data keys and props keep their names.
//
// The file sets newLook itself, through a getter on the mocked FEATURES, so
// what the shipped switch holds changes none of its cases. The old initials
// are built from two pieces, so this file never holds them whole.
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ComponentType } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ApiMember, ApiTournamentDetail } from '@/lib/api'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
const api = vi.hoisted(() => ({
  getTournament: vi.fn(),
  getMyChildren: vi.fn(async () => []),
  getTournamentReminderStatus: vi.fn(async () => ({ opted_in: false })),
}))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))

const { TournamentDetailPage } = await import('@/pages/TournamentDetailPage')

const OLD = 'US' + 'CF'
const PAGE = join(process.cwd(), 'src/pages/TournamentDetailPage.tsx')
const source = () => readFileSync(PAGE, 'utf8')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollIntoView = () => {}
})
beforeEach(() => {
  // Thursday, October 1, 2026, noon Central: registration is open.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-01T17:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  flags.newLook = false
})

function event(rated: boolean): ApiTournamentDetail {
  return {
    id: 't1', name: 'Example Fall Open', location: 'Example City, LA', venue: 'Example Community Center', date: '2026-10-24', end_date: null,
    entry_fee: 30, early_deadline: null, early_discount: 0, late_after: null, late_fee: 0,
    sections: [{ id: 'sec-1', name: 'Open', entryFee: 30, ratingMax: null, ratingMin: null, gradeMin: null, gradeMax: null, rulesSet: true, cap: null, fees: { early: 30, regular: 30, late: 30 } }],
    rounds: 4, max_players: null, status: 'upcoming', description: 'A made-up event.', registration_deadline: null, club_id: null, created_by: null,
    created_at: '2026-08-01 12:00:00', registration_status: 'open', registration_opens_at: null, is_rated: rated ? 1 : 0, is_visible: 1, round_schedule: [],
    registration_closes_at: null, custom_details: [], time_control: null, registration_url: null, eligibility: null, organizer: null,
    pairing_system: 'uscf', accelerated: 0, keep_apart: 'family', report_settings: null, is_state_championship: 0, requires_lca_membership: 1,
    club_name: null, club_color: null, waitlist_count: 0,
  } as unknown as ApiTournamentDetail
}
const ROSTER = [
  { member_id: 'p1', section: 'Open', withdrawn_at: null, full_name: 'Player One', uscf_id: '12345678', uscf_rating: 1500 },
  { member_id: 'p2', section: 'Open', withdrawn_at: null, full_name: 'Player Two', uscf_id: null, uscf_rating: null },
]
const member = (uscfId: string | null): ApiMember => ({
  id: 'm1', email: 'player.three@example.org', full_name: 'Player Three', uscf_id: uscfId, uscf_rating: uscfId ? 1500 : null,
  uscf_rating_updated_at: null, membership_status: 'active', membership_expiry: null, role: 'member', club_id: null, created_at: '2026-01-01',
} as ApiMember)

async function draw(rated: boolean, who: ApiMember | null = null, Page: ComponentType = TournamentDetailPage) {
  api.getTournament.mockResolvedValue({ tournament: event(rated), roster: ROSTER, pairings: [], myRegistration: null })
  const value = { user: who ? { id: who.id } : null, member: who, session: null, role: 'member', loading: false } as unknown as AuthContextValue
  const view = render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/tournaments/t1']}>
        <Routes><Route path="/tournaments/:id" element={<Page />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { name: 'Sections' })
  const grid = view.container.querySelector('section.max-w-6xl.py-10 > .grid') as HTMLElement
  return { ...view, grid }
}

/** Every word and every attribute a person can meet on the drawn page, the open card included. */
function everythingShown(): string {
  const attrs = [...document.body.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.value))
  return `${document.body.textContent ?? ''}\n${attrs.join('\n')}`
}

const LOOKS = [false, true] as const
const lookName = (on: boolean) => (on ? 'with newLook on' : 'with newLook off')

describe('the grid of the public event page', () => {
  for (const on of LOOKS) {
    it(`${lookName(on)} gives its one column below 1024 pixels leave to be narrower than the sections table`, async () => {
      flags.newLook = on
      const { grid } = await draw(true)
      expect(grid.className).toBe('grid grid-cols-1 gap-8 lg:grid-cols-3')
      const box = screen.getByRole('heading', { name: 'Sections' }).nextElementSibling as HTMLElement
      expect(box.className).toBe('mt-4 overflow-x-auto rounded-xl border')
      expect(box.querySelector('table')?.className).toBe('w-full min-w-[480px] text-left text-sm')
    })
  }

  it('is one class in the source, with no switch choosing it, and its comment speaks of both looks', () => {
    const lines = source().split('\n')
    const at = lines.findIndex((l) => l.includes('grid-cols-1 gap-8 lg:grid-cols-3'))
    expect(lines[at].trim()).toBe('<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">')
    expect(lines.filter((l) => l.includes('gap-8 lg:grid-cols-3'))).toHaveLength(1)
    expect(lines.slice(at - 3, at).join(' ').replace(/\s+/g, ' ').trim()).toBe(
      '{/* The one column below 1024 pixels may be narrower than its widest item, so on a phone the sections table scrolls in its own box and not the whole page sideways. */}',
    )
  })
})

describe('the sections box and the side card\'s Format row, the same in both looks', () => {
  for (const on of LOOKS) {
    it(`${lookName(on)}, the box the table scrolls in is a named region in the tab order`, async () => {
      flags.newLook = on
      await draw(true)
      const box = screen.getByRole('heading', { name: 'Sections' }).nextElementSibling as HTMLElement
      expect(['tabindex', 'role', 'aria-label'].map((attr) => box.getAttribute(attr))).toEqual(['0', 'region', 'Sections'])
      expect(box.tabIndex).toBe(0)
      expect(screen.getByRole('region', { name: 'Sections' })).toBe(box)
      expect(box.className).toBe('mt-4 overflow-x-auto rounded-xl border')
    })

    it(`${lookName(on)}, the Format row keeps a gap from its label and its value against the right edge, and the card's other rows are as they were`, async () => {
      flags.newLook = on
      await draw(true)
      const value = screen.getByText('4-round Swiss, US Chess-rated')
      expect(value.tagName).toBe('DD')
      expect(value.className).toBe('text-right font-medium')
      expect(value.parentElement?.className).toBe('flex justify-between gap-4')
      expect(value.previousElementSibling?.textContent).toBe('Format')
      const rows = [...(value.closest('dl')?.children ?? [])] as HTMLElement[]
      expect(rows.map((row) => row.querySelector('dt')?.textContent)).toEqual(['Registered', 'Format', 'Status'])
      for (const row of rows.filter((r) => r !== value.parentElement)) expect(row.className, row.textContent ?? '').toBe('flex justify-between')
    })
  }

  it('gives the box its three attributes in the source with no switch choosing them, and its comment speaks of both looks', () => {
    const lines = source().split('\n')
    const at = lines.findIndex((l) => l.includes('overflow-x-auto rounded-xl border" tabIndex'))
    expect(lines[at].trim()).toBe('<div className="mt-4 overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label="Sections">')
    expect(lines.slice(at - 2, at).join(' ').replace(/\s+/g, ' ').trim()).toBe(
      '{/* The box the table scrolls in is a named region in the tab order, so a keyboard can reach it and scroll it. */}',
    )
    expect(source()).not.toContain('FEATURES.newLook ? { tabIndex')
  })
})

describe('the six places the page names US Chess', () => {
  for (const on of LOOKS) {
    it(`${lookName(on)}, a visitor reads the hero's chip, the Format line and the roster's number in the new words`, async () => {
      flags.newLook = on
      await draw(true)
      expect(screen.getByText('US Chess rated')).toBeTruthy()
      expect(screen.getByText('4-round Swiss, US Chess-rated')).toBeTruthy()
      expect(screen.getByText('US Chess ID 12345678')).toBeTruthy()
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${lookName(on)}, an unrated event keeps its own words and the roster's number says US Chess ID`, async () => {
      flags.newLook = on
      await draw(false)
      expect(screen.getByText('Unrated')).toBeTruthy()
      expect(screen.getByText('4-round Swiss, unrated')).toBeTruthy()
      expect(screen.getByText('US Chess ID 12345678')).toBeTruthy()
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${lookName(on)}, a member with no number on a rated event is refused in the new words, with the link under it`, async () => {
      flags.newLook = on
      await draw(true, member(null))
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      const link = await screen.findByRole('link', { name: /to your profile/ })
      expect(link.textContent).toBe('Add US Chess ID to your profile →')
      expect(link.getAttribute('href')).toBe('/dashboard')
      expect(link.parentElement?.firstChild?.textContent).toBe(
        'This is a US Chess-rated tournament. Add your US Chess ID to your profile before registering.',
      )
      expect(everythingShown()).not.toContain(OLD)
    })

    it(`${lookName(on)}, a member with a number reads US Chess ID beside it in the confirmation card`, async () => {
      flags.newLook = on
      await draw(true, member('87654321'))
      fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
      await screen.findByRole('heading', { name: 'Confirm registration' })
      const label = screen.getByText('US Chess ID')
      expect(label.nextElementSibling?.textContent).toBe('87654321')
      expect(everythingShown()).not.toContain(OLD)
    })
  }

  it('leaves the old initials in no text of the page\'s source, while data keys and props keep their names', () => {
    const text = source()
    expect(text).not.toContain(OLD)
    expect(text).toContain('player.uscf_id')
    expect(text).toContain('member.uscf_id')
    expect(text).toContain('authMember?.uscf_id')
  })
})

describe('nothing else of the page moved', () => {
  // The page as it stood at 01d05ed, by its sha256: putting back the grid's
  // line with its comment, the box's line with its comment, the Format row's
  // lines and the six wordings gives that file to the byte. The page as this
  // aside left it is pinned by its own sha256, so these cases hold only while
  // the page is byte for byte as this aside left it; a later change to the
  // page skips them rather than failing on another change's hash, and the
  // proof stays in REDESIGN_STATUS.md. The page at 01d05ed is drawn beside
  // this one from that rebuilt file, so the two are drawn with the same
  // components around them. The file is written for the run to a folder of
  // its own under node_modules/.cache, which git does not track, so that it
  // finds the repository's packages and its one React, and removed after.
  const BASE_SHA256 = '005e3268cbb8f2e7966af71d7428300f531d977900a805bb525275754cf4f379'
  const AS_LEFT_SHA256 = '962b8ad0684dc8f3c3256e9bfff024e162c095beb57a0509127d67853eb07080'
  const PUT_BACK: Array<[string, string]> = [
    [
      '        {/* The one column below 1024 pixels may be narrower than its widest\n'
      + '            item, so on a phone the sections table scrolls in its own box and\n'
      + '            not the whole page sideways. */}\n'
      + '        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">',
      '        {/* Under the new look the one column below 1024 pixels may be\n'
      + '            narrower than its widest item, so on a phone the sections table\n'
      + '            scrolls in its own box rather than the whole page sideways. */}\n'
      + '        <div className={FEATURES.newLook ? \'grid grid-cols-1 gap-8 lg:grid-cols-3\' : \'grid gap-8 lg:grid-cols-3\'}>',
    ],
    [
      '              {/* The box the table scrolls in is a named region in the tab\n'
      + '                  order, so a keyboard can reach it and scroll it. */}\n'
      + '              <div className="mt-4 overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label="Sections">',
      '              {/* Under the new look the box the table scrolls in is a named\n'
      + '                  region in the tab order, so a keyboard can scroll it. */}\n'
      + '              <div className="mt-4 overflow-x-auto rounded-xl border" {...(FEATURES.newLook ? { tabIndex: 0, role: \'region\', \'aria-label\': \'Sections\' } : {})}>',
    ],
    [
      '                  <div className="flex justify-between gap-4">\n'
      + '                    <dt className="text-muted-foreground">Format</dt>\n'
      + '                    <dd className="text-right font-medium">',
      '                  <div className="flex justify-between">\n'
      + '                    <dt className="text-muted-foreground">Format</dt>\n'
      + '                    <dd className="font-medium">',
    ],
    ['>US Chess ID</span>', `>${OLD} ID</span>`],
    [
      '\'This is a US Chess-rated tournament. Add your US Chess ID to your profile before registering.\'',
      `'This is a ${OLD}-rated tournament. Add your ${OLD} ID to your profile before registering.'`,
    ],
    ['\'US Chess rated\'', `'${OLD} Rated'`],
    ['US Chess ID {player.uscf_id}', `${OLD} {player.uscf_id}`],
    ['\', US Chess-rated\'', `', ${OLD}-rated'`],
    ['Add US Chess ID to your profile', `Add ${OLD} ID to your profile`],
  ]
  /** The page at 01d05ed, rebuilt from this one. */
  const putBack = (text: string) => PUT_BACK.reduce((t, [now, was]) => t.replace(now, was), text)

  /** What each of the six wordings draws, as the page at 01d05ed drew it and as this one does. */
  const WORDS_DRAWN: Array<[string, string]> = [
    [`>${OLD} ID</span>`, '>US Chess ID</span>'],
    [`This is a ${OLD}-rated tournament. Add your ${OLD} ID to your profile before registering.`, 'This is a US Chess-rated tournament. Add your US Chess ID to your profile before registering.'],
    [`>${OLD} Rated<`, '>US Chess rated<'],
    [`>${OLD} 12345678<`, '>US Chess ID 12345678<'],
    [`, ${OLD}-rated<`, ', US Chess-rated<'],
    [`Add ${OLD} ID to your profile`, 'Add US Chess ID to your profile'],
  ]
  /** The Format row's two classes, as drawn. */
  const ROW_DRAWN: [string, string] = [
    '<div class="flex justify-between"><dt class="text-muted-foreground">Format</dt><dd class="font-medium">',
    '<div class="flex justify-between gap-4"><dt class="text-muted-foreground">Format</dt><dd class="text-right font-medium">',
  ]
  /** With newLook off, the grid's class and the box's three attributes, as drawn. */
  const OFF_DRAWN: Array<[string, string]> = [
    ['<div class="grid gap-8 lg:grid-cols-3">', '<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">'],
    ['<div class="mt-4 overflow-x-auto rounded-xl border"><table', '<div class="mt-4 overflow-x-auto rounded-xl border" tabindex="0" role="region" aria-label="Sections"><table'],
  ]

  const asLeft = sha256(source()) === AS_LEFT_SHA256
  let folder = ''
  let BasePage: ComponentType | null = null
  beforeAll(async () => {
    if (!asLeft) return
    mkdirSync(join(process.cwd(), 'node_modules/.cache'), { recursive: true })
    folder = mkdtempSync(join(process.cwd(), 'node_modules/.cache/event-page-base-'))
    const file = join(folder, 'TournamentDetailPage.tsx')
    writeFileSync(file, putBack(source()))
    BasePage = ((await import(/* @vite-ignore */ file)) as { TournamentDetailPage: ComponentType }).TournamentDetailPage
  }, 30_000)
  afterAll(() => {
    if (folder) rmSync(folder, { recursive: true, force: true })
  })

  it.runIf(asLeft)('differs from the page at 01d05ed in the grid\'s line with its comment, the box\'s line with its comment, the Format row\'s lines and the six wordings alone', () => {
    const text = source()
    for (const [now] of PUT_BACK) expect(text.split(now), now).toHaveLength(2)
    expect(sha256(putBack(text))).toBe(BASE_SHA256)
  })

  /** The four states the six wordings are met in, each drawn and read whole. */
  const STATES: Array<{ name: string, open: (Page: ComponentType) => Promise<string> }> = [
    { name: 'a visitor on a rated event', open: async (Page) => (await draw(true, null, Page)).container.innerHTML },
    { name: 'a visitor on an unrated event', open: async (Page) => (await draw(false, null, Page)).container.innerHTML },
    {
      name: 'a member refused for want of a number',
      open: async (Page) => {
        const view = await draw(true, member(null), Page)
        fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
        await screen.findByRole('link', { name: /to your profile/ })
        return view.container.innerHTML
      },
    },
    {
      name: 'a member\'s confirmation card',
      open: async (Page) => {
        await draw(true, member('87654321'), Page)
        fireEvent.click(screen.getByRole('button', { name: 'Register now' }))
        await screen.findByRole('heading', { name: 'Confirm registration' })
        return document.body.innerHTML
      },
    },
  ]

  for (const on of LOOKS) {
    const what = on ? 'the six wordings and the Format row\'s two classes' : 'the six wordings, the Format row\'s two classes, the grid\'s class and the box\'s three attributes'
    it.runIf(asLeft)(`${lookName(on)}, the drawn page differs from the page at 01d05ed in ${what} alone, in four states`, async () => {
      flags.newLook = on
      const swaps = [...WORDS_DRAWN, ROW_DRAWN, ...(on ? [] : OFF_DRAWN)]
      const used = new Set<string>()
      for (const state of STATES) {
        const now = await state.open(TournamentDetailPage)
        cleanup()
        let was = await state.open(BasePage!)
        cleanup()
        expect(was, state.name).not.toBe(now)
        for (const [before, after] of swaps) {
          const count = was.split(before).length - 1
          expect(count, `${state.name}: ${after}`).toBeLessThanOrEqual(1)
          if (count) used.add(after)
          was = was.replace(before, after)
        }
        expect(was, state.name).toBe(now)
      }
      // Each difference is met in one state or more.
      expect([...used].sort()).toEqual(swaps.map(([, after]) => after).sort())
    }, 30_000)
  }
})
