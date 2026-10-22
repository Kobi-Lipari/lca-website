// @vitest-environment jsdom
//
// test/unit/standings-format.test.tsx
//
// The crosstable and the standings table with newLook off and on, in one file
// (WS01 step 27), the switch flipped through a getter as
// news-pinned-flag.test.tsx flips it, from the made-up section in
// fixtures/chess-tables-today.ts, whose scores and tiebreaks hold halves.
//
// - newLook off: each table draws exactly today's markup (the literal in the
//   fixture, rendered from the files before the step) once the scope="col"
//   on each header cell is set aside, and every header cell has it. So the
//   tables show 1.5 and 3.5, the w and b line and the em dash, as before.
// - newLook on: scores and tiebreaks are written with ½ (1½, 3½, 13½, ½),
//   never with a point; the figures are in the monospace face and the table
//   keeps its tabular figures; header cells are column headers and the
//   player's name is the row's header; the number or place and the name are
//   pinned; each round is a ResultCell and the w and b line is gone; the key
//   names the marks in words; a missing tiebreak is a plain hyphen with
//   words for a screen reader; and no em dash is left.
// - The pages: the public pairings list writes a drawn game ½-½ with newLook
//   on and 1/2-1/2, as today, with it off; the print page's pairing sheet
//   writes each score going into the round through formatScore with newLook
//   on, the same text as today's formatter for every score in the section.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHESS_PAIRINGS, CHESS_STANDINGS, TODAYS_CROSSTABLE, TODAYS_STANDINGS, markup } from './fixtures/chess-tables-today'

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
const api = vi.hoisted(() => ({ getTournament: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
const scores = vi.hoisted(() => ({ calls: [] as unknown[] }))
vi.mock('@/lib/format', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/format')>()
  return {
    ...real,
    formatScore: (score: Parameters<typeof real.formatScore>[0]) => {
      scores.calls.push(score)
      return real.formatScore(score)
    },
  }
})

const { Crosstable } = await import('@/areas/live/components/Crosstable')
const { StandingsTable } = await import('@/areas/live/components/StandingsTable')
const { TournamentPairingsPage } = await import('@/pages/TournamentPairingsPage')
const { TournamentPrintPage } = await import('@/pages/TournamentPrintPage')

/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

function drawCrosstable(newLook: boolean) {
  flags.newLook = newLook
  return render(<Crosstable standings={CHESS_STANDINGS} pairings={CHESS_PAIRINGS} sectionName="Open" rounds={4} />).container
}
function drawStandings(newLook: boolean) {
  flags.newLook = newLook
  return render(<StandingsTable standings={CHESS_STANDINGS} sectionName="Open" />).container
}
/** The text of a cell as a sighted reader sees it: hidden words for a screen reader left out. */
function seen(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return copy.textContent ?? ''
}
const bodyRows = (container: HTMLElement) => [...container.querySelectorAll('tbody tr')]
const cellsOf = (row: Element) => [...row.querySelectorAll(':scope > th, :scope > td')]

beforeEach(() => {
  scores.calls = []
})
afterEach(() => {
  cleanup()
  flags.newLook = false
})

describe('newLook off: today\'s tables, the scope="col" on each header cell the only difference', () => {
  it('the crosstable draws today\'s markup to the letter', () => {
    const html = drawCrosstable(false).innerHTML
    expect(html).toContain(' scope="col"')
    expect(html.replaceAll(' scope="col"', '')).toBe(markup(TODAYS_CROSSTABLE))
  })

  it('the standings table draws today\'s markup to the letter', () => {
    const html = drawStandings(false).innerHTML
    expect(html).toContain(' scope="col"')
    expect(html.replaceAll(' scope="col"', '')).toBe(markup(TODAYS_STANDINGS))
  })

  it('every header cell of both tables, and only they, carry scope="col"', () => {
    for (const draw of [drawCrosstable, drawStandings]) {
      const container = draw(false)
      const th = [...container.querySelectorAll('th')]
      expect(th.length).toBeGreaterThan(0)
      for (const cell of th) expect(cell.getAttribute('scope'), cell.textContent ?? '').toBe('col')
      expect(container.querySelectorAll('[scope]')).toHaveLength(th.length)
      expect(container.querySelector('tbody th')).toBeNull()
      cleanup()
    }
  })

  it('so the scores still have a point, the colour is the w and b line, and a missing tiebreak is an em dash', () => {
    const cross = drawCrosstable(false)
    expect(cross.textContent).toContain('1.5')
    expect(cross.querySelectorAll('span.text-\\[10px\\]').length).toBeGreaterThan(0)
    expect(cross.querySelector('[data-slot="result-cell"]')).toBeNull()
    cleanup()
    const stand = drawStandings(false)
    expect(stand.textContent).toContain('13.5')
    expect(stand.textContent).toMatch(DASHES)
    // Nothing reaches formatScore with newLook off.
    expect(scores.calls).toEqual([])
  })
})

describe('newLook on: the crosstable', () => {
  it('writes every total with ½ and never with a point, in the monospace face', () => {
    const container = drawCrosstable(true)
    const totals = bodyRows(container).map((r) => cellsOf(r).at(-1)!)
    expect(totals.map((c) => c.textContent)).toEqual(['2', '1½', '1½', '1', '½'])
    for (const c of totals) expect(c.className).toContain('font-mono')
    expect(container.textContent).not.toMatch(/\d?\.5\b/)
    expect(container.querySelector('table')!.className).toContain('tabular-nums')
  })

  it('heads each column with a column header and each row with the player\'s name', () => {
    const container = drawCrosstable(true)
    const head = [...container.querySelectorAll('thead th')]
    expect(head.map((th) => th.textContent)).toEqual(['#', 'Player', 'Rating', 'Rd 1', 'Rd 2', 'Rd 3', 'Rd 4', 'Total'])
    for (const th of head) expect(th.getAttribute('scope')).toBe('col')
    for (const row of bodyRows(container)) {
      const [number, name] = cellsOf(row)
      expect(number.tagName).toBe('TD')
      expect(name.tagName).toBe('TH')
      expect(name.getAttribute('scope')).toBe('row')
    }
    expect(screen.getByRole('rowheader', { name: 'Avery Sample (1)' })).toBeTruthy()
  })

  it('puts the number, the rating and the total in the monospace face', () => {
    const container = drawCrosstable(true)
    for (const row of bodyRows(container)) {
      const cells = cellsOf(row)
      for (const at of [0, 2, cells.length - 1]) expect(cells[at].className, `${cells[1].textContent} ${at}`).toContain('font-mono')
    }
  })

  it('draws each round through ResultCell, with the game in words, and no w and b line', () => {
    const container = drawCrosstable(true)
    const rounds = bodyRows(container).map((r) => cellsOf(r).slice(3, -1))
    expect(rounds.flat().every((c) => c.querySelector('[data-slot="result-cell"]'))).toBe(true)
    expect(rounds.map((row) => row.map((c) => c.querySelector('[data-slot="result-cell"]')!.getAttribute('data-result')))).toEqual([
      ['W', 'W', 'pending', 'U'],
      ['D', 'L', 'W', 'U'],
      ['B', 'H', 'pending', 'U'],
      ['L', 'X', 'L', 'U'],
      ['D', 'F', 'U', 'U'],
    ])
    expect(rounds[0].map((c) => c.querySelector('.sr-only')!.textContent)).toEqual([
      'Won with White against 4', 'Won with Black against 2', 'No result yet, with White against 3', 'Did not play',
    ])
    expect(rounds[3][1].querySelector('.sr-only')!.textContent).toBe('Won by forfeit against 5')
    expect(rounds[4][1].querySelector('.sr-only')!.textContent).toBe('Lost by forfeit against 4')
    expect(seen(rounds[1][0])).toBe('D5')
    expect(container.querySelector('span.text-\\[10px\\]')).toBeNull()
    expect(container.querySelector('td[title]')).toBeNull()
  })

  it('has a key that names the marks in words', () => {
    drawCrosstable(true)
    const key = screen.getByRole('list', { name: 'Key to the crosstable' })
    const items = [...key.querySelectorAll('li')].map((li) => li.textContent?.trim())
    expect(items).toContain('White')
    expect(items).toContain('Black')
    expect(items).toContain('X won by forfeit')
    expect(document.body.textContent).not.toContain('w / b color')
  })

  it('pins the number and the name, in a box that is a named region the keyboard reaches', () => {
    const container = drawCrosstable(true)
    const table = container.querySelector('table')!
    expect(table.className).toContain('[&_tr>:first-child]:sticky')
    expect(table.className).toContain('[&_tr>:nth-child(2)]:sticky')
    expect(table.className).toContain('[&_tr>:first-child]:bg-surface')
    const box = screen.getByRole('region', { name: 'Open crosstable' })
    expect(box.tabIndex).toBe(0)
    expect(box.className).toContain('print:overflow-visible')
    expect(box.className).toContain('bg-surface')
  })

  it('holds no em or en dash', () => {
    expect(drawCrosstable(true).textContent).not.toMatch(DASHES)
  })
})

describe('newLook on: the standings table', () => {
  it('writes scores and every tiebreak with ½, never with a point, in the monospace face', () => {
    const container = drawStandings(true)
    const rows = bodyRows(container).map((r) => cellsOf(r).map((c) => seen(c)))
    expect(rows.map((r) => r[3])).toEqual(['2', '1½', '1½', '1', '½'])
    expect(rows[0].slice(5)).toEqual(['3½', '13½', '3', '7½'])
    expect(rows[1].slice(5)).toEqual(['½', '4', '2', '6'])
    expect(rows[3].slice(5)).toEqual(['2', '3½', '1', '10½'])
    expect(container.textContent).not.toMatch(/\d?\.5\b/)
    for (const row of bodyRows(container)) {
      const cells = cellsOf(row)
      for (const at of [2, 3, 4, 5, 6, 7, 8]) expect(cells[at].className, `${cells[1].textContent} ${at}`).toContain('font-mono')
    }
    expect(container.querySelector('table')!.className).toContain('tabular-nums')
  })

  it('writes a missing tiebreak as a plain hyphen, with words for a screen reader, and no em dash', () => {
    const container = drawStandings(true)
    const last = cellsOf(bodyRows(container).at(-1)!).slice(5)
    expect(last.map((c) => seen(c))).toEqual(['-', '-', '-', '-'])
    for (const c of last) {
      expect(c.querySelector('[aria-hidden="true"]')!.textContent).toBe('-')
      expect(c.querySelector('.sr-only')!.textContent).toBe('none yet')
    }
    expect(container.textContent).not.toMatch(DASHES)
  })

  it('heads each column with a column header and each row with the player\'s name, the place first', () => {
    const container = drawStandings(true)
    expect([...container.querySelectorAll('thead th')].every((th) => th.getAttribute('scope') === 'col')).toBe(true)
    for (const row of bodyRows(container)) {
      const [place, name] = cellsOf(row)
      expect([place.tagName, name.tagName, name.getAttribute('scope')]).toEqual(['TD', 'TH', 'row'])
    }
    expect(bodyRows(container).map((r) => cellsOf(r)[0].textContent)).toEqual(['1', '2-3', '2-3', '4', '5'])
  })

  it('pins the place and the name, and tints first place\'s row through --row-tint, so its pinned cells take the tint too', () => {
    const container = drawStandings(true)
    const table = container.querySelector('table')!
    expect(table.className).toContain('[&_tr>:nth-child(2)]:left-(--table-pin)')
    const [first, second] = bodyRows(container)
    expect(first.className).toContain('[--row-tint:color-mix(in_oklab,var(--color-lca-gold)_5%,transparent)]')
    expect(second.className).not.toContain('--row-tint')
    expect(screen.getByRole('region', { name: 'Open standings' }).tabIndex).toBe(0)
  })

  it('keeps the footnote that spells out the tiebreaks', () => {
    drawStandings(true)
    expect(document.body.textContent).toContain('Ties broken by US Chess tiebreaks in order: Modified Median, Solkoff, Cumulative, Opponents\' Cumulative, then most games with Black.')
  })
})

// ── The pages ──────────────────────────────────────────────────────────────

const TOURNAMENT = {
  id: 'fx-t',
  name: 'Fixture Fall Swiss',
  rounds: 4,
  status: 'active',
  is_visible: 1,
  sections: [{ name: 'Open' }],
  round_schedule: [],
}
const NAMES: Record<string, [string, number | null]> = Object.fromEntries(CHESS_STANDINGS.map((s) => [s.member_id, [s.full_name, s.rating]]))
const PAIRINGS = CHESS_PAIRINGS.map((p) => ({
  ...p,
  white_name: NAMES[p.white_member_id!][0],
  white_rating: NAMES[p.white_member_id!][1],
  black_name: p.black_member_id ? NAMES[p.black_member_id][0] : undefined,
  black_rating: p.black_member_id ? NAMES[p.black_member_id][1] : undefined,
}))

function open(path: string, route: string, page: React.ReactNode, newLook: boolean) {
  flags.newLook = newLook
  api.getTournament.mockResolvedValue({ tournament: TOURNAMENT, roster: [], pairings: PAIRINGS, standings: CHESS_STANDINGS, prizes: [] })
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={page} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('the public pairings list', () => {
  it.each([[false, '1/2-1/2'], [true, '½-½']])('newLook %s: a drawn game reads %s, and the other results as today', async (newLook, draw) => {
    open('/tournaments/fx-t/pairings', '/tournaments/:id/pairings', <TournamentPairingsPage />, newLook)
    await screen.findByRole('heading', { name: 'Pairings & results' })
    fireEvent.click(screen.getByRole('button', { name: /^Round 1/ }))
    const results = [...document.querySelectorAll('li')].filter((li) => li.textContent?.includes('Bd ')).map((li) => li.lastElementChild!.textContent)
    // Round 1: a win, a draw and a full-point bye; round 3, open as the latest, a game with no result yet and a loss.
    expect(results).toContain(draw)
    expect(results).toContain('1-0')
    expect(results).toContain('1')
    expect(results.filter((r) => r === '1/2-1/2' || r === '½-½')).toEqual([draw])
  })
})

describe('the print page\'s pairing sheet', () => {
  /** The rating and the score going into the round beside each name on round 3's sheet. */
  async function sheet(newLook: boolean) {
    open('/tournaments/fx-t/print?what=pairings&round=3', '/tournaments/:id/print', <TournamentPrintPage />, newLook)
    await screen.findByRole('heading', { name: /Round 3 pairings/ })
    return [...document.querySelectorAll('tbody td span.text-quiet-600')].map((s) => s.textContent)
  }

  it('writes the same scores going into the round with newLook on as today, through formatScore', async () => {
    const off = await sheet(false)
    expect(scores.calls).toEqual([])
    cleanup()
    const on = await sheet(true)
    expect(on).toEqual(off)
    // Avery 2 against Emery 1½; Blair 1 against Drew ½.
    expect(on).toEqual(['(1905) 2', '(unr) 1½', '(1660) 1', '(1290) ½'])
    expect(scores.calls).toEqual([2, 1.5, 1, 0.5])
  })

  it('writes a drawn game ½-½ either way, as it already did', async () => {
    flags.newLook = true
    open('/tournaments/fx-t/print?what=pairings&round=1', '/tournaments/:id/print', <TournamentPrintPage />, true)
    await screen.findByRole('heading', { name: /Round 1 pairings/ })
    expect(document.body.textContent).toContain('½-½')
    expect(document.body.textContent).not.toContain('1/2-1/2')
  })
})
