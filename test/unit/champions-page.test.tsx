// @vitest-environment jsdom
//
// The Champions page's entries (src/pages/ChampionsPage.tsx) as K asked for
// them after the preview on Monday, November 16, 2026, drawn with made-up
// champions:
//
// - A champion's wins run across in one list under the name and its
//   summary, at every width, as K chose on Tuesday, November 17, 2026.
//   Each win keeps its year, its section, its Co-champion mark and its
//   note together, as one item that wraps as a piece.
// - A note that is a chess title is written in its short form before the
//   name, "FM Player Four", with its full words for a screen reader, which
//   hears "FIDE Master Player Four", and no longer beside the year it was
//   recorded with. A note that is not a title stays with its own year.
// - The reigning champion's card writes the title the same way, and a note
//   that is not a title goes on its own line under the name; a champion
//   with neither is drawn by name alone, as before.
// - Inside the heritage layout, under the new look, the entries are drawn
//   the same.
// - Nothing warns in the console.
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiChampion, ApiChampionshipEvent } from '@/lib/api'

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
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
/** The answer the page's one request gets, set by each test. */
const answer = vi.hoisted(() => ({ champions: [] as ApiChampion[], upcoming: [] as ApiChampionshipEvent[] }))
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>()
  return { ...real, getChampions: async () => ({ champions: answer.champions, upcoming: answer.upcoming }) }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { ChampionsPage } = await import('@/pages/ChampionsPage')
const { HeritageLayout } = await import('@/layouts/HeritageLayout')

const win = (year: number, champion: string, title = 'State Champion', extra: Partial<ApiChampion> = {}): ApiChampion => ({
  id: `fx-${year}-${title}-${champion}`, year, title, champion, notes: null, tournament_id: null, tournament_name: null, kind: 'state', photo_url: null, ...extra,
})

const NINE_YEARS = [1972, 1971, 1970, 1966, 1965, 1959, 1958, 1957, 1955]

/** A reigning champion whose newest win records a chess title, a champion with nine wins, and a scholastic list with a note and a shared win. */
const MANY: ApiChampion[] = [
  win(2026, 'Player Four', 'State Champion', { notes: 'FIDE Master' }),
  win(2024, 'Player Four'),
  win(2023, 'Player Four'),
  ...NINE_YEARS.map((year) => win(year, 'Player Nine')),
  win(2019, 'Player Five', 'K-12', { kind: 'scholastic' }),
  win(2013, 'Player Five', 'K-6', { kind: 'scholastic', notes: 'tiebreaks over Player Six' }),
  win(2014, 'Player Seven', 'K-8', { kind: 'scholastic' }),
  win(2014, 'Player Eight', 'K-8', { kind: 'scholastic' }),
]
/** A reigning champion whose note is not a title, and a champion with a title who no longer reigns. */
const NOTED: ApiChampion[] = [
  win(2026, 'Player Ten', 'State Champion', { notes: 'Won with 2½ of 3.' }),
  win(2025, 'Player Four', 'State Champion', { notes: 'FIDE Master' }),
]
/** A reigning champion with one win, no title and no note. */
const PLAIN: ApiChampion[] = [win(2026, 'Player One')]

let logged: ReturnType<typeof vi.spyOn>[] = []
beforeEach(() => {
  logged = [vi.spyOn(console, 'error').mockImplementation(() => {}), vi.spyOn(console, 'warn').mockImplementation(() => {})]
})
afterEach(() => {
  cleanup()
  flags.newLook = false
  const calls = logged.flatMap((spy) => spy.mock.calls)
  for (const spy of logged) spy.mockRestore()
  expect(calls).toEqual([])
})

/** Lets the page's request settle and React draw what it brings. */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)))

/** The page at /champions with the answer given, on its own as with themeHeritage off, or inside the heritage layout. */
async function draw(champions: ApiChampion[], inLayout = false) {
  answer.champions = champions
  const page = <ChampionsPage />
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/champions']}>
        {inLayout ? (
          <Routes>
            <Route element={<HeritageLayout />}>
              <Route path="/champions" element={page} />
            </Route>
          </Routes>
        ) : page}
      </MemoryRouter>,
    )
  })
  await screen.findAllByText('Winner of a year')
  await settle()
}

/** The words a sighted reader sees in an element: its text without the words written for a screen reader alone. */
function seen(el: Element): string {
  const copy = el.cloneNode(true) as Element
  for (const only of copy.querySelectorAll('.sr-only')) only.remove()
  return copy.textContent ?? ''
}

const entry = (anchor: string) => document.getElementById(anchor)!
/** An entry's wins: its one list and the list's items. */
function winsOf(anchor: string) {
  const lists = entry(anchor).querySelectorAll('ul')
  expect(lists, anchor).toHaveLength(1)
  return { list: lists[0], items: within(lists[0]).getAllByRole('listitem') }
}
/** What each part of a win says, in order. */
const parts = (item: Element) => [...item.children].map((c) => c.textContent)

describe('a champion\'s entry', () => {
  it('writes a chess title in its short form before the name, with its full words for a screen reader, and not beside the year it was recorded with', async () => {
    await draw(MANY)
    const heading = screen.getByRole('heading', { level: 3, name: 'FIDE Master Player Four' })
    expect(entry('state-player-four').contains(heading)).toBe(true)
    const short = heading.firstElementChild!
    expect(short.tagName).toBe('ABBR')
    expect(short.textContent).toBe('FM')
    expect(short.getAttribute('title')).toBe('FIDE Master')
    expect(short.getAttribute('aria-hidden')).toBe('true')
    expect(short.classList.contains('no-underline')).toBe(true)
    expect(heading.querySelector('.sr-only')!.textContent).toBe('FIDE Master')
    expect(seen(heading)).toBe('FM Player Four')
    // The year stands alone, and the title is written nowhere else in the entry.
    const { items } = winsOf('state-player-four')
    expect(items.map(parts)).toEqual([['2026'], ['2024'], ['2023']])
    expect(seen(entry('state-player-four'))).not.toContain('FIDE Master')
    // A champion with no title is drawn by name alone.
    expect(screen.getByRole('heading', { level: 3, name: 'Player Nine' }).children).toHaveLength(0)
  })

  it('keeps a note that is not a title with its own year, and marks a shared win Co-champion, each win one item that wraps as a piece', async () => {
    await draw(MANY)
    const five = winsOf('scholastic-player-five').items
    expect(five.map(parts)).toEqual([['2019', 'K-12'], ['2013', 'K-6', 'tiebreaks over Player Six']])
    const seven = winsOf('scholastic-player-seven').items
    expect(seven.map(parts)).toEqual([['2014', 'K-8', 'Co-champion']])
    expect(winsOf('scholastic-player-eight').items.map(parts)).toEqual([['2014', 'K-8', 'Co-champion']])
    for (const item of [...five, ...seven]) expect([...item.classList]).toEqual(['flex', 'max-w-full', 'flex-wrap', 'items-baseline', 'gap-x-2'])
  })

  it('runs the wins across in one list under the name and its summary, at every width: nine wins are nine items of one list', async () => {
    await draw(MANY)
    const { list, items } = winsOf('state-player-nine')
    expect(items.map((item) => item.textContent)).toEqual(NINE_YEARS.map(String))
    expect([...list.classList]).toEqual(['mt-2', 'flex', 'flex-wrap', 'gap-x-4', 'gap-y-1', 'text-sm', 'text-ink'])
    for (const item of items) expect([...item.classList]).toEqual(['flex', 'max-w-full', 'flex-wrap', 'items-baseline', 'gap-x-2'])
    // The text column: the name, its summary, then the wins under them.
    const column = list.parentElement!
    expect([...column.classList]).toEqual(['min-w-0', 'flex-1'])
    expect([...column.children].map((c) => [c.tagName, c.textContent])).toEqual([['H3', 'Player Nine'], ['P', 'Latest title in 1972, first in 1955, 9 titles in all'], ['UL', NINE_YEARS.join('')]])
    // No step at any width: no class in the entry starts with a breakpoint's name.
    expect(entry('state-player-nine').outerHTML).not.toMatch(/\b(?:sm|md|lg|xl|2xl):/)
  })
})

describe('the reigning champion\'s card', () => {
  const card = () => screen.getByRole('region', { name: 'Reigning champion' })
  const nameIn = (region: HTMLElement) => region.querySelector('p.text-3xl')!

  it('writes the title in its short form before the name, with its full words for a screen reader', async () => {
    await draw(MANY)
    const name = nameIn(card())
    expect(seen(name)).toBe('FM Player Four')
    expect(name.firstElementChild!.tagName).toBe('ABBR')
    expect(name.firstElementChild!.getAttribute('title')).toBe('FIDE Master')
    expect(name.querySelector('.sr-only')!.textContent).toBe('FIDE Master')
    expect(seen(card())).not.toContain('FIDE Master')
  })

  it('puts a note that is not a title on its own line under the name', async () => {
    await draw(NOTED)
    const name = nameIn(card())
    expect(name.textContent).toBe('Player Ten')
    const note = name.nextElementSibling!
    expect([note.tagName, note.textContent]).toEqual(['P', 'Won with 2½ of 3.'])
    expect([...note.classList]).toEqual(['mt-1', 'text-sm', 'text-muted-foreground'])
    // The champion with the title, no longer reigning, keeps it in the list.
    expect(screen.getByRole('heading', { level: 3, name: 'FIDE Master Player Four' })).toBeTruthy()
  })

  it('draws a champion with no title and no note by name alone', async () => {
    await draw(PLAIN)
    const name = nameIn(card())
    expect(name.textContent).toBe('Player One')
    expect(name.children).toHaveLength(0)
    expect(name.nextElementSibling).toBeNull()
  })
})

describe('inside the heritage layout, under the new look', () => {
  it('draws the entries the same, the short form and the row of wins with no hook of their own', async () => {
    flags.newLook = true
    await draw(MANY, true)
    const scope = document.querySelector<HTMLElement>('[data-layout="heritage"]')!
    expect(scope.getAttribute('data-theme')).toBe('heritage')
    const heading = within(scope).getByRole('heading', { level: 3, name: 'FIDE Master Player Four' })
    expect(seen(heading)).toBe('FM Player Four')
    const inside = ['state-player-four', 'state-player-nine', 'scholastic-player-five'].map((anchor) => entry(anchor).outerHTML)
    for (const html of inside) expect(html).not.toContain('data-heritage')
    cleanup()
    flags.newLook = false
    await draw(MANY)
    expect(['state-player-four', 'state-player-nine', 'scholastic-player-five'].map((anchor) => entry(anchor).outerHTML)).toEqual(inside)
  })
})
