// @vitest-environment jsdom
//
// test/unit/result-cell.test.tsx
//
// ResultCell, one game of a crosstable (WS01 step 27), and its key. A result
// is never shown by colour alone: each cell has its letter (a game with no
// result yet has none, and says so in words), the mark of the colour played
// as a shape (a ring for White, a filled disc for Black, drawn, since the
// monospace face has no ○ or ●), the opponent's number, and the whole game
// in words for a screen reader, while the letter, the mark and the number are
// hidden from it so nothing is read twice. The tints are the ok, bad and
// closed pairs, which contrast.test.ts holds in every look; a bye, a forfeit,
// a round not played and a game in progress sit in a dashed outline. The
// key names each letter and both marks in words.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ColorMark, ResultCell, ResultLegend, type ResultCellProps } from '@/components/ResultCell'

afterEach(cleanup)

/** A cell drawn in a table cell, as a crosstable draws it, so its name is the one a screen reader gives the cell. */
function drawn(props: ResultCellProps) {
  render(
    <table>
      <tbody>
        <tr>
          <td><ResultCell {...props} /></td>
        </tr>
      </tbody>
    </table>,
  )
  const cell = screen.getByRole('cell')
  const box = cell.querySelector<HTMLElement>('[data-slot="result-cell"]')!
  const shown = [...box.children].filter((el) => !el.classList.contains('sr-only'))
  return {
    cell,
    box,
    /** What a sighted reader sees, in order: the letter, the mark (as ring or disc) and the number. */
    seen: shown.map((el) => (el.tagName.toLowerCase() === 'svg' ? `(${el.getAttribute('data-color')})` : el.textContent)).join(' '),
    words: box.querySelector('.sr-only')?.textContent ?? '',
    shown,
  }
}

const CASES: Array<[string, ResultCellProps, string, string]> = [
  ['a win with White', { code: 'W', opponent: 17, color: 'white' }, 'W (white) 17', 'Won with White against 17'],
  ['a win with Black', { code: 'W', opponent: 7, color: 'black' }, 'W (black) 7', 'Won with Black against 7'],
  ['a loss with White', { code: 'L', opponent: 3, color: 'white' }, 'L (white) 3', 'Lost with White against 3'],
  ['a loss with Black', { code: 'L', opponent: 12, color: 'black' }, 'L (black) 12', 'Lost with Black against 12'],
  ['a draw with White', { code: 'D', opponent: 1, color: 'white' }, 'D (white) 1', 'Drew with White against 1'],
  ['a draw with Black', { code: 'D', opponent: 8, color: 'black' }, 'D (black) 8', 'Drew with Black against 8'],
  ['a win by forfeit', { code: 'X', opponent: 20, color: 'white' }, 'X 20', 'Won by forfeit against 20'],
  ['a loss by forfeit', { code: 'F', opponent: 7, color: 'black' }, 'F 7', 'Lost by forfeit against 7'],
  ['a full-point bye', { code: 'B' }, 'B', 'Full-point bye'],
  ['a half-point bye', { code: 'H' }, 'H', 'Half-point bye'],
  ['a round not played', { code: 'U' }, 'U', 'Did not play'],
  ['a game with no result yet, with White', { code: '', opponent: 6, color: 'white' }, '(white) 6', 'No result yet, with White against 6'],
  ['a game with no result yet, with Black', { code: '', opponent: 4, color: 'black' }, '(black) 4', 'No result yet, with Black against 4'],
]

describe('ResultCell, for every result code', () => {
  it.each(CASES)('%s shows its letter, its mark and the number, and says the game in words', (_name, props, seen, words) => {
    const d = drawn(props)
    expect(d.seen).toBe(seen)
    expect(d.words).toBe(words)
    // The cell's name, as a screen reader gives it, is the words, and only the words.
    expect(screen.getByRole('cell', { name: words })).toBe(d.cell)
    expect(d.box.getAttribute('data-result')).toBe(props.code || 'pending')
  })

  it.each(CASES)('%s hides its letter, its mark and its number from a screen reader, so nothing is read twice', (_name, props) => {
    const d = drawn(props)
    expect(d.shown.length).toBeGreaterThan(0)
    for (const el of d.shown) expect(el.getAttribute('aria-hidden'), el.outerHTML).toBe('true')
    // No aria-label on a span with no role, which ARIA 1.2 does not allow.
    expect(d.box.querySelector('[aria-label]')).toBeNull()
    expect(d.box.hasAttribute('aria-label')).toBe(false)
  })

  it('never shows a result by colour alone: every cell with a result has its letter, and every cell its words', () => {
    for (const [name, props] of CASES) {
      const d = drawn(props)
      if (props.code !== '') expect(d.seen.startsWith(props.code), name).toBe(true)
      expect(d.words.length, name).toBeGreaterThan(5)
      cleanup()
    }
  })

  it('draws the marks as shapes, never as the ○ and ● the monospace face lacks', () => {
    const white = drawn({ code: 'W', opponent: 17, color: 'white' })
    const ring = white.box.querySelector('svg[data-slot="color-mark"] circle')!
    expect([ring.getAttribute('fill'), ring.getAttribute('stroke'), ring.getAttribute('stroke-width')]).toEqual(['none', 'currentColor', '1.5'])
    cleanup()
    const black = drawn({ code: 'L', opponent: 3, color: 'black' })
    const disc = black.box.querySelector('svg[data-slot="color-mark"] circle')!
    expect([disc.getAttribute('fill'), disc.getAttribute('stroke')]).toEqual(['currentColor', null])
    for (const d of [white, black]) expect(d.box.textContent).not.toMatch(/[○●]/)
    // The mark is 8px across, in the words' colour.
    expect(black.box.querySelector('svg')!.getAttribute('class')).toContain('size-2')
  })

  it('shows no mark for a forfeit, a bye or a round not played, since no colour was played, even when given one', () => {
    for (const code of ['X', 'F', 'B', 'H', 'U'] as const) {
      const d = drawn({ code, opponent: code === 'X' || code === 'F' ? 9 : null, color: 'black' })
      expect(d.box.querySelector('svg'), code).toBeNull()
      expect(d.words, code).not.toMatch(/White|Black/)
      cleanup()
    }
  })

  it('takes the board\'s shape: 24px high, a 6px radius, 58px wide at least, a 4px gap, 13px figures in the monospace face at weight 500', () => {
    const d = drawn({ code: 'W', opponent: 17, color: 'white' })
    const classes = d.box.className.split(/\s+/)
    for (const c of ['inline-flex', 'h-6', 'rounded-sm', 'min-w-[58px]', 'gap-1', 'font-mono', 'text-[13px]', 'font-medium', 'tabular-nums']) {
      expect(classes, c).toContain(c)
    }
  })

  it('tints a win, a loss and a draw with the ok, bad and closed pairs, and draws the others in a dashed outline on the surface', () => {
    const tone = (props: ResultCellProps) => {
      const d = drawn(props)
      const classes = d.box.className.split(/\s+/).filter((c) => /^(bg|text|border)(-|$)/.test(c) && !/^text-\[/.test(c))
      cleanup()
      return classes
    }
    expect(tone({ code: 'W', opponent: 1, color: 'white' })).toEqual(['bg-ok-50', 'text-ok-700'])
    expect(tone({ code: 'L', opponent: 1, color: 'white' })).toEqual(['bg-bad-50', 'text-bad-700'])
    expect(tone({ code: 'D', opponent: 1, color: 'white' })).toEqual(['bg-quiet-100', 'text-ink'])
    for (const code of ['X', 'F', 'B', 'H', 'U', ''] as const) {
      expect(tone({ code, opponent: code === 'B' || code === 'H' || code === 'U' ? null : 1 }), code || 'pending').toEqual(['border', 'border-dashed', 'border-field', 'bg-surface', 'text-muted-foreground'])
    }
  })

  it('gives up its box on paper, so a crosstable with many rounds wraps rather than runs off the page', () => {
    const d = drawn({ code: 'W', opponent: 17, color: 'white' })
    const classes = d.box.className.split(/\s+/)
    for (const c of ['print:h-auto', 'print:min-w-0', 'print:flex-wrap']) expect(classes, c).toContain(c)
  })

  it('takes a className', () => {
    render(<ResultCell code="B" className="ml-2" />)
    expect(document.querySelector('[data-slot="result-cell"]')!.className).toContain('ml-2')
  })
})

describe('ColorMark', () => {
  it('is hidden from a screen reader and draws a ring for White and a disc for Black', () => {
    const { container } = render(<><ColorMark color="white" /><ColorMark color="black" /></>)
    const [white, black] = [...container.querySelectorAll('svg')]
    for (const svg of [white, black]) expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(white.querySelector('circle')!.getAttribute('fill')).toBe('none')
    expect(black.querySelector('circle')!.getAttribute('fill')).toBe('currentColor')
  })
})

describe('ResultLegend', () => {
  it('names the two marks in words, beside the marks themselves', () => {
    render(<ResultLegend />)
    const key = screen.getByRole('list', { name: 'Key to the crosstable' })
    const items = [...key.querySelectorAll('li')]
    const white = items.find((li) => li.textContent?.trim() === 'White')!
    const black = items.find((li) => li.textContent?.trim() === 'Black')!
    expect(white.querySelector('svg[data-color="white"]')).not.toBeNull()
    expect(black.querySelector('svg[data-color="black"]')).not.toBeNull()
  })

  it('says what every letter means, and what a cell holds', () => {
    render(<ResultLegend />)
    const key = screen.getByRole('list', { name: 'Key to the crosstable' })
    expect([...key.querySelectorAll('li')].map((li) => li.textContent?.trim())).toEqual([
      'W won', 'L lost', 'D drew', 'White', 'Black', 'B full-point bye', 'H half-point bye', 'X won by forfeit', 'F lost by forfeit', 'U did not play',
    ])
    expect(document.body.textContent).toContain('Each game shows the result, the color played and the opponent\'s number.')
    // No typed circle, and no en or em dash (written by code, so this file holds neither dash).
    expect(document.body.textContent).not.toMatch(new RegExp(`[${String.fromCharCode(0x25cb, 0x25cf, 0x2013, 0x2014)}]`))
  })
})
