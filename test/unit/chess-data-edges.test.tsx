// @vitest-environment jsdom
//
// test/unit/chess-data-edges.test.tsx
//
// The edges of WS01 step 27's chess data that standings-format.test.tsx and
// result-cell.test.tsx leave out, with newLook flipped inside this one file
// through a getter, as news-pinned-flag.test.tsx flips it.
//
// - Results the made-up section there does not hold, read through the real
//   crosstable: a double forfeit (both players lost by forfeit), a forfeit
//   won by Black, a game with an empty result (no result yet), a win against
//   a player who is not in the section's standings (no number to give), and
//   a round with no game. Every round cell has a letter or its words, a mark
//   only where a colour was played, and a name a screen reader gives the
//   cell, and the key is drawn once under each table.
// - Scores and tiebreaks of ten and more, and zero: 10½, 20½ and 100½ with
//   newLook on, never 10.5, and today's 10.5 with it off.
// - Every column has its header and every row its row header, so each data
//   cell is named by both; the counts agree in both tables.
// - showHeading off draws today's markup without the heading with newLook
//   off, and a named box with no heading with it on; a section with no
//   players draws nothing either way.
// - ResultsEntry, on the manage page: with newLook on its header cells say
//   they head their columns and nothing else changes; with it off it is
//   today's table, no scope at all. Its half points are ½ both ways.
// - The print page's pairing sheet writes a score of ten and a half going
//   into a round as 10½ under the new look. With newLook off it keeps
//   today's formatter, which prints the same score as 1½ (a follow-up in
//   REDESIGN_STATUS.md, held here so the record says what the page does).
// - Plain language: the footnote says US Chess and no table says USCF.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiStanding, ApiTournamentGame, ApiTournamentPairing } from '@/lib/api'
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

const { Crosstable } = await import('@/areas/live/components/Crosstable')
const { StandingsTable } = await import('@/areas/live/components/StandingsTable')
const { ResultsEntry } = await import('@/areas/live/components/ResultsEntry')
const { TournamentPrintPage } = await import('@/pages/TournamentPrintPage')

afterEach(() => {
  cleanup()
  flags.newLook = false
})

/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** A score or tiebreak written with a point: 0.5, 10.5, 100.5. */
const POINT = /\d\.\d/

const tb = (modifiedMedian: number, solkoff: number, cumulative: number, oppCumulative: number) => ({ modifiedMedian, solkoff, cumulative, oppCumulative, blacks: 1 })
const standing = (member_id: string, full_name: string, score: number, place: number, placeLabel: string, tiebreaks: ApiStanding['tiebreaks'], rating: number | null = 1500): ApiStanding => ({
  member_id, full_name, section: 'Open', rating, score, wins: 0, draws: 0, losses: 0, place, placeLabel, tiebreaks,
})
const pairing = (id: string, round: number, board: number, white: string, black: string | null, result: string): ApiTournamentPairing => ({
  id, tournament_id: 'fx-t-edges', round, board, section: 'Open', white_member_id: white, black_member_id: black, result,
})

/**
 * A made-up section after three rounds of four, with the results the other
 * file's section does not hold. Kai's total and tiebreaks are ten and more
 * with a half; Lee has no point at all.
 */
const EDGE_STANDINGS: ApiStanding[] = [
  standing('fx-k', 'Kai Sample', 10.5, 1, '1', tb(20.5, 100.5, 0, 10.5), 2010),
  standing('fx-n', 'Noa Sample', 1.5, 2, '2', tb(0.5, 1, 1.5, 3)),
  standing('fx-m', 'Max Sample', 1, 3, '3', tb(1, 2, 1, 2)),
  standing('fx-l', 'Lee Sample', 0, 4, '4', tb(0, 0, 0, 0), null),
  // A player of another section, who must not show.
  { ...standing('fx-z', 'Zed Sample', 3, 1, '1', tb(1, 1, 1, 1)), section: 'U1600' },
]
const EDGE_PAIRINGS: ApiTournamentPairing[] = [
  pairing('e11', 1, 1, 'fx-k', 'fx-l', '0-0 F'),
  pairing('e12', 1, 2, 'fx-m', 'fx-n', '0-1 F'),
  pairing('e21', 2, 1, 'fx-l', 'fx-k', ''),
  // Against a player who withdrew and is in no standings row: no number to show.
  pairing('e22', 2, 2, 'fx-m', 'fx-gone', '1-0'),
  pairing('e31', 3, 1, 'fx-n', null, 'bye'),
  pairing('e32', 3, 2, 'fx-k', null, 'bye-half'),
  { ...pairing('e33', 3, 1, 'fx-z', null, 'bye'), section: 'U1600' },
]

function drawCrosstable(newLook: boolean, props: Partial<Parameters<typeof Crosstable>[0]> = {}) {
  flags.newLook = newLook
  return render(<Crosstable standings={EDGE_STANDINGS} pairings={EDGE_PAIRINGS} sectionName="Open" rounds={4} {...props} />).container
}
function drawStandings(newLook: boolean, props: Partial<Parameters<typeof StandingsTable>[0]> = {}) {
  flags.newLook = newLook
  return render(<StandingsTable standings={EDGE_STANDINGS} sectionName="Open" {...props} />).container
}
/** A cell's text as a sighted reader sees it: words kept for a screen reader left out. */
function seen(el: Element): string {
  const copy = el.cloneNode(true) as Element
  copy.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return (copy.textContent ?? '').trim()
}
const bodyRows = (container: HTMLElement) => [...container.querySelectorAll('tbody tr')]
const cellsOf = (row: Element) => [...row.querySelectorAll(':scope > th, :scope > td')]

describe('newLook on: the crosstable\'s rarer results, read through the real table', () => {
  /** Each row's round cells: what is seen, the mark drawn, and the words a screen reader hears. */
  function rounds(container: HTMLElement) {
    return bodyRows(container).map((row) => cellsOf(row).slice(3, -1).map((cell) => {
      const box = cell.querySelector('[data-slot="result-cell"]')!
      return { seen: seen(box), mark: box.querySelector('svg')?.getAttribute('data-color') ?? null, words: box.querySelector('.sr-only')!.textContent }
    }))
  }

  it('gives each player\'s games in order: forfeits each way, a game with no result yet, a win with no number, the byes and rounds not played', () => {
    const container = drawCrosstable(true)
    expect(bodyRows(container).map((r) => seen(cellsOf(r)[1]))).toEqual(['Kai Sample (1)', 'Noa Sample (2)', 'Max Sample (3)', 'Lee Sample (4)'])
    expect(rounds(container)).toEqual([
      [
        { seen: 'F4', mark: null, words: 'Lost by forfeit against 4' },
        { seen: '4', mark: 'black', words: 'No result yet, with Black against 4' },
        { seen: 'H', mark: null, words: 'Half-point bye' },
        { seen: 'U', mark: null, words: 'Did not play' },
      ],
      [
        { seen: 'X3', mark: null, words: 'Won by forfeit against 3' },
        { seen: 'U', mark: null, words: 'Did not play' },
        { seen: 'B', mark: null, words: 'Full-point bye' },
        { seen: 'U', mark: null, words: 'Did not play' },
      ],
      [
        { seen: 'F2', mark: null, words: 'Lost by forfeit against 2' },
        { seen: 'W', mark: 'white', words: 'Won with White' },
        { seen: 'U', mark: null, words: 'Did not play' },
        { seen: 'U', mark: null, words: 'Did not play' },
      ],
      [
        { seen: 'F1', mark: null, words: 'Lost by forfeit against 1' },
        { seen: '1', mark: 'white', words: 'No result yet, with White against 1' },
        { seen: 'U', mark: null, words: 'Did not play' },
        { seen: 'U', mark: null, words: 'Did not play' },
      ],
    ])
  })

  it('a double forfeit is a loss by forfeit for both players, never a win for either', () => {
    const container = drawCrosstable(true)
    const [kai, , , lee] = bodyRows(container)
    for (const row of [kai, lee]) {
      const box = cellsOf(row)[3].querySelector('[data-slot="result-cell"]')!
      expect(box.getAttribute('data-result')).toBe('F')
    }
    expect(container.querySelectorAll('[data-result="X"]')).toHaveLength(1)
  })

  it('names every round cell, as a screen reader gives the cell, in the game\'s words and nothing more', () => {
    const container = drawCrosstable(true)
    const table = container.querySelector('table')!
    const all = rounds(container).flat()
    for (const { words } of all) {
      expect(within(table).getAllByRole('cell', { name: words! }).length, words!).toBeGreaterThan(0)
    }
    // Every round cell has words, so none is a bare colour or shape.
    expect(all.every((c) => (c.words ?? '').length > 0)).toBe(true)
    // The letter, the mark and the number are hidden, so the cell is not read twice.
    for (const box of container.querySelectorAll('[data-slot="result-cell"]')) {
      for (const child of box.children) {
        if (!child.classList.contains('sr-only')) expect(child.getAttribute('aria-hidden'), child.outerHTML).toBe('true')
      }
    }
  })

  it('shows a letter in every cell that has a result, and a mark only for a game played with a colour', () => {
    const container = drawCrosstable(true)
    for (const box of container.querySelectorAll('[data-slot="result-cell"]')) {
      const code = box.getAttribute('data-result')!
      const shown = seen(box)
      if (code === 'pending') expect(shown, 'no result yet').toMatch(/^\d+$/)
      else expect(shown.startsWith(code), shown).toBe(true)
      const played = ['W', 'L', 'D', 'pending'].includes(code)
      expect(box.querySelectorAll('svg').length, `${code} ${shown}`).toBe(played ? 1 : 0)
    }
  })

  it('draws the key once under each table, naming both marks in words beside their shapes', () => {
    const container = drawCrosstable(true)
    expect(container.querySelectorAll('[data-slot="result-legend"]')).toHaveLength(1)
    const key = screen.getByRole('list', { name: 'Key to the crosstable' })
    for (const [words, color] of [['White', 'white'], ['Black', 'black']] as const) {
      const item = within(key).getByText(words, { exact: true }).closest('li')!
      expect(item.querySelector(`svg[data-color="${color}"]`), words).not.toBeNull()
    }
  })

  it('draws only the section asked for', () => {
    const container = drawCrosstable(true)
    expect(container.textContent).not.toContain('Zed Sample')
    expect(bodyRows(container)).toHaveLength(4)
  })
})

describe('scores and tiebreaks of ten and more, and zero', () => {
  it('newLook on: the crosstable\'s totals read 10½, 1½, 1, 0, never with a point', () => {
    const container = drawCrosstable(true)
    expect(bodyRows(container).map((r) => seen(cellsOf(r).at(-1)!))).toEqual(['10½', '1½', '1', '0'])
    expect(container.querySelector('table')!.textContent).not.toMatch(POINT)
  })

  it('newLook on: the standings read 10½ and the tiebreaks 20½, 100½, 0 and 10½, never with a point', () => {
    const container = drawStandings(true)
    const rows = bodyRows(container).map((r) => cellsOf(r).map(seen))
    expect(rows.map((r) => r[3])).toEqual(['10½', '1½', '1', '0'])
    expect(rows[0].slice(5)).toEqual(['20½', '100½', '0', '10½'])
    expect(rows[3].slice(5)).toEqual(['0', '0', '0', '0'])
    expect(container.textContent).not.toMatch(POINT)
  })

  it('newLook off: today\'s tables keep the point for the same scores, 10.5, 20.5 and 100.5', () => {
    const cross = drawCrosstable(false)
    expect(bodyRows(cross).map((r) => cellsOf(r).at(-1)!.textContent)).toEqual(['10.5', '1.5', '1', '0'])
    cleanup()
    const stand = drawStandings(false)
    expect(cellsOf(bodyRows(stand)[0]).slice(5).map((c) => c.textContent)).toEqual(['20.5', '100.5', '0', '10.5'])
  })
})

describe('newLook on: every data cell has a column header and a row header', () => {
  it.each([['crosstable', drawCrosstable], ['standings', drawStandings]] as const)('the %s', (_name, draw) => {
    const container = draw(true)
    const table = container.querySelector('table')!
    const heads = [...table.querySelectorAll('thead th')]
    expect(heads.every((th) => th.getAttribute('scope') === 'col')).toBe(true)
    expect(within(table).getAllByRole('columnheader')).toHaveLength(heads.length)
    const rows = bodyRows(container)
    expect(within(table).getAllByRole('rowheader')).toHaveLength(rows.length)
    for (const row of rows) {
      const cells = cellsOf(row)
      // As many cells as columns, so none sits under no header.
      expect(cells).toHaveLength(heads.length)
      // One header cell in the row, the second, the player's name; no column header in the body.
      expect(cells.map((c) => c.tagName)).toEqual(cells.map((_c, i) => (i === 1 ? 'TH' : 'TD')))
      expect(cells[1].getAttribute('scope')).toBe('row')
      expect(heads[1].textContent).toBe('Player')
    }
  })
})

describe('showHeading and an empty section', () => {
  /** Today's markup with its heading taken out, as the print page draws the tables. */
  const headless = (literal: string) => markup(literal).replace(/<h3[^>]*>[^<]*<\/h3>/, '')

  it('newLook off: without the heading, the crosstable is today\'s markup but for the heading and scope="col"', () => {
    flags.newLook = false
    const { container } = render(<Crosstable standings={CHESS_STANDINGS} pairings={CHESS_PAIRINGS} sectionName="Open" rounds={4} showHeading={false} />)
    expect(container.querySelector('h3')).toBeNull()
    expect(container.innerHTML.replaceAll(' scope="col"', '')).toBe(headless(TODAYS_CROSSTABLE))
  })

  it('newLook off: without the heading, the standings are today\'s markup but for the heading and scope="col"', () => {
    flags.newLook = false
    const { container } = render(<StandingsTable standings={CHESS_STANDINGS} sectionName="Open" showHeading={false} />)
    expect(container.querySelector('h3')).toBeNull()
    expect(container.innerHTML.replaceAll(' scope="col"', '')).toBe(headless(TODAYS_STANDINGS))
  })

  it('newLook on: without the heading, each box keeps its name, so the page still says what it holds', () => {
    drawCrosstable(true, { showHeading: false })
    expect(document.querySelector('h3')).toBeNull()
    expect(screen.getByRole('region', { name: 'Open crosstable' }).tabIndex).toBe(0)
    cleanup()
    drawStandings(true, { showHeading: false })
    expect(document.querySelector('h3')).toBeNull()
    expect(screen.getByRole('region', { name: 'Open standings' }).tabIndex).toBe(0)
  })

  it.each([false, true])('newLook %s: a section with no players draws nothing at all', (newLook) => {
    expect(drawCrosstable(newLook, { sectionName: 'Reserve' }).innerHTML).toBe('')
    cleanup()
    expect(drawStandings(newLook, { sectionName: 'Reserve' }).innerHTML).toBe('')
    cleanup()
    expect(drawCrosstable(newLook, { pairings: [] }).querySelectorAll('tbody tr')).toHaveLength(4)
  })
})

describe('plain language in both tables', () => {
  it.each([false, true])('newLook %s: the footnote says US Chess, no table says USCF, and no dash stands in for a missing figure on the new look', (newLook) => {
    const stand = drawStandings(newLook)
    expect(stand.textContent).toContain('Ties broken by US Chess tiebreaks')
    expect(stand.textContent).not.toMatch(/USCF/i)
    cleanup()
    const cross = drawCrosstable(newLook)
    expect(cross.textContent).not.toMatch(/USCF/i)
    if (newLook) expect(cross.textContent).not.toMatch(DASHES)
  })
})

// ── ResultsEntry, on the manage page ───────────────────────────────────────

const game = (id: string, board: number, section: string, white: string, black: string | null, result: string): ApiTournamentGame => ({
  id, tournament_id: 'fx-t-edges', round: 2, board, section, white_member_id: white, black_member_id: black, result,
  white_name: `${white} name`, black_name: black ? `${black} name` : undefined,
})
/** Round 2 of two sections: a draw, a half-point bye asked for, a game in play, a full-point bye and a forfeit. */
const GAMES: ApiTournamentGame[] = [
  game('r1', 1, 'Open', 'fx-a', 'fx-b', '1/2-1/2'),
  game('r2', 2, 'Open', 'fx-c', null, 'bye-half'),
  game('r3', 3, 'Open', 'fx-d', 'fx-e', 'pending'),
  game('r4', 1, 'U1600', 'fx-f', null, 'bye'),
  game('r5', 2, 'U1600', 'fx-g', 'fx-h', '1-0 F'),
]

function drawEntry(newLook: boolean) {
  flags.newLook = newLook
  return render(
    <MemoryRouter>
      <ResultsEntry games={GAMES} sections={['Open', 'U1600']} onResult={() => {}} onSwap={() => {}} savedGameId="r1" tournamentId="fx-t-edges" />
    </MemoryRouter>,
  ).container
}

describe('ResultsEntry', () => {
  it('newLook off: today\'s tables, no header cell with a scope', () => {
    const container = drawEntry(false)
    const th = [...container.querySelectorAll('th')]
    expect(th.map((c) => c.textContent)).toEqual(['Bd', 'White', 'Black', 'Result', 'Bd', 'White', 'Black', 'Result'])
    expect(container.querySelectorAll('[scope]')).toHaveLength(0)
  })

  it('newLook on: each header cell heads its column, and nothing else in the tables changes', () => {
    const on = drawEntry(true).innerHTML
    cleanup()
    const off = drawEntry(false).innerHTML
    expect(on.match(/ scope="col"/g)).toHaveLength(8)
    expect(on.replaceAll(' scope="col"', '')).toBe(off)
    cleanup()
    drawEntry(true)
    expect(screen.getAllByRole('columnheader').map((c) => c.getAttribute('scope'))).toEqual(Array(8).fill('col'))
  })

  it.each([false, true])('newLook %s: half points read ½, never 0.5 or 1/2, and the draw is the one button pressed', (newLook) => {
    const container = drawEntry(newLook)
    const text = container.textContent ?? ''
    expect(text).toContain('½ point (requested)')
    expect(text).toContain('1 point')
    expect(text).not.toMatch(/0\.5|\.5\b|1\/2/)
    const draw = screen.getAllByRole('button', { name: '½-½' })
    // One per board with two players: the drawn game, the game in play and the forfeit.
    expect(draw.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false'])
    // The forfeit shows in the menu by its words.
    expect(screen.getByRole('combobox', { name: 'More results for board 2' })).toHaveProperty('value', '1-0 F')
  })
})

// ── The print page's pairing sheet ─────────────────────────────────────────

describe('the print page\'s pairing sheet, going into the last round of twelve', () => {
  const TOURNAMENT = { id: 'fx-t-long', name: 'Fixture Long Swiss', rounds: 12, status: 'active', is_visible: 1, sections: [{ name: 'Open' }], round_schedule: [] }
  // Ten wins and a draw for Kai before round 12; the rest of the field is one opponent.
  const LONG: ApiTournamentPairing[] = [
    ...Array.from({ length: 10 }, (_, i) => ({ ...pairing(`l${i + 1}`, i + 1, 1, 'fx-k', 'fx-l', '1-0'), white_name: 'Kai Sample', black_name: 'Lee Sample', white_rating: 2010, black_rating: null })),
    { ...pairing('l11', 11, 1, 'fx-l', 'fx-k', '1/2-1/2'), white_name: 'Lee Sample', black_name: 'Kai Sample', white_rating: null, black_rating: 2010 },
    { ...pairing('l12', 12, 1, 'fx-k', 'fx-l', 'pending'), white_name: 'Kai Sample', black_name: 'Lee Sample', white_rating: 2010, black_rating: null },
  ]

  /** The rating and score beside each name on the round 12 sheet. */
  async function scoresOnTheSheet() {
    api.getTournament.mockResolvedValue({ tournament: TOURNAMENT, roster: [], pairings: LONG, standings: [], prizes: [] })
    render(
      <MemoryRouter initialEntries={['/tournaments/fx-t-long/print?what=pairings&round=12']}>
        <Routes>
          <Route path="/tournaments/:id/print" element={<TournamentPrintPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByRole('heading', { name: /Round 12 pairings/ })
    return [...document.querySelectorAll('tbody td span.text-quiet-600')].map((s) => s.textContent)
  }

  it('newLook on: a score of ten and a half reads 10½, not 1½ and not 10.5', async () => {
    flags.newLook = true
    expect(await scoresOnTheSheet()).toEqual(['(2010) 10½', '(unr) ½'])
  })

  it('newLook off: today\'s formatter is kept, and it prints ten and a half as 1½', async () => {
    // A known fault of today's formatter, left for K to decide (REDESIGN_STATUS.md, Follow-ups):
    // its last replace takes the 0 of 10 along with the 0 of a lone half.
    expect(await scoresOnTheSheet()).toEqual(['(2010) 1½', '(unr) ½'])
  })
})
