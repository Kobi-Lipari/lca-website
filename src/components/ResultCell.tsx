// src/components/ResultCell.tsx
//
// One game in a crosstable, as the Live-C board draws it (the result cell,
// .rc): the result's letter, a small mark for the colour the player had and
// the opponent's number, such as "W ○ 17", on a tint of the result. A result
// never shows by colour alone: the letter says it, the mark's shape says the
// colour (a ring for White, a filled disc for Black), and a screen reader
// hears the whole game in words ("Won with White against 17") while the
// letter, the mark and the number are hidden from it.
//
// The marks are drawn, not typed: the monospace face's latin file has no ○
// or ● (U+25CB, U+25CF), and a character the face lacks would be drawn from
// whatever font the device has (test/unit/geist-mono-glyphs.test.ts).
//
// Wins, losses and draws take the ok, bad and closed tints with words that
// reach 4.5:1 on them in every look (test/unit/contrast.test.ts). In the live
// look those tints are the panel itself, as on the Looks-7 tile, so there the
// words' colour, the letter and the mark carry the result. A bye, a forfeit,
// a round not played and a game with no result yet sit on the surface in a
// dashed outline, as the board draws them. Under print a cell gives up its
// box and wraps, so a crosstable with many rounds stays on the paper.
import { cn } from '@/lib/utils'

/**
 * A crosstable's result codes: W won, L lost, D drew, X won by forfeit, F
 * lost by forfeit, B full-point bye, H half-point bye, U not played, and an
 * empty code for a game with no result yet.
 */
export type ResultCode = 'W' | 'L' | 'D' | 'X' | 'F' | 'B' | 'H' | 'U' | ''

/** The colour a player had in a game. */
export type PieceColor = 'white' | 'black'

export interface ResultCellProps {
  code: ResultCode
  /** The opponent's number in the table; none for a bye or a round not played. */
  opponent?: number | null
  /** The colour the player had; none for a bye, a forfeit or a round not played. */
  color?: PieceColor | null
  className?: string
}

/**
 * The board's cell: 24px high, a 6px radius, at least 58px wide, a 4px gap,
 * 13px figures in the monospace face at weight 500.
 */
const SHAPE = 'inline-flex h-6 min-w-[58px] items-center justify-center gap-1 rounded-sm px-1.5 font-mono text-[13px] leading-none font-medium whitespace-nowrap tabular-nums print:h-auto print:min-w-0 print:flex-wrap print:gap-0.5 print:px-0.5'

/** Each result's words on its own tint, or the dashed outline of a game that was not played. */
const TONES = {
  won: 'bg-ok-50 text-ok-700',
  lost: 'bg-bad-50 text-bad-700',
  drew: 'bg-quiet-100 text-ink',
  other: 'border border-dashed border-field bg-surface text-muted-foreground',
} as const

const TONE: Record<ResultCode, keyof typeof TONES> = {
  W: 'won',
  L: 'lost',
  D: 'drew',
  X: 'other',
  F: 'other',
  B: 'other',
  H: 'other',
  U: 'other',
  '': 'other',
}

const COLOR_WORDS: Record<PieceColor, string> = { white: 'White', black: 'Black' }

/**
 * The game in words, as a screen reader hears the cell: "Won with White
 * against 17", "Lost by forfeit against 7", "Half-point bye", "No result
 * yet, with Black against 4".
 */
function resultWords(code: ResultCode, opponent: number | null, color: PieceColor | null): string {
  const against = opponent === null ? '' : ` against ${opponent}`
  const played = `${color ? ` with ${COLOR_WORDS[color]}` : ''}${against}`
  switch (code) {
    case 'W':
      return `Won${played}`
    case 'L':
      return `Lost${played}`
    case 'D':
      return `Drew${played}`
    case 'X':
      return `Won by forfeit${against}`
    case 'F':
      return `Lost by forfeit${against}`
    case 'B':
      return 'Full-point bye'
    case 'H':
      return 'Half-point bye'
    case 'U':
      return 'Did not play'
    case '':
      return `No result yet${played ? `,${played}` : ''}`
  }
}

/**
 * The mark of the colour a player had, in the words' colour: a ring for
 * White and a filled disc for Black, 8px across as on the board. Decoration
 * beside the words a screen reader hears, so hidden from it.
 */
export function ColorMark({ color, className }: { color: PieceColor; className?: string }) {
  return (
    <svg data-slot="color-mark" data-color={color} viewBox="0 0 8 8" aria-hidden="true" className={cn('size-2 flex-none', className)}>
      {color === 'white'
        ? <circle cx="4" cy="4" r="3.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        : <circle cx="4" cy="4" r="4" fill="currentColor" />}
    </svg>
  )
}

/**
 * One game: its letter, the mark of the colour played and the opponent's
 * number. A forfeit, a bye and a round not played show no mark, since no
 * colour was played; a game with no result yet shows its colour and
 * opponent with no letter.
 */
export function ResultCell({ code, opponent = null, color = null, className }: ResultCellProps) {
  const mark = code === 'W' || code === 'L' || code === 'D' || code === '' ? color : null
  return (
    <span data-slot="result-cell" data-result={code || 'pending'} className={cn(SHAPE, TONES[TONE[code]], className)}>
      {code !== '' && <span aria-hidden="true">{code}</span>}
      {mark && <ColorMark color={mark} />}
      {opponent !== null && <span aria-hidden="true">{opponent}</span>}
      <span className="sr-only">{resultWords(code, opponent, mark)}</span>
    </span>
  )
}

/** The letters of the key, each with its words. */
const KEY: ReadonlyArray<readonly [Exclude<ResultCode, ''>, string]> = [
  ['W', 'won'],
  ['L', 'lost'],
  ['D', 'drew'],
  ['B', 'full-point bye'],
  ['H', 'half-point bye'],
  ['X', 'won by forfeit'],
  ['F', 'lost by forfeit'],
  ['U', 'did not play'],
]

/**
 * The key to a crosstable's cells: what a cell holds, each letter and the
 * two marks in words, so a reader never has to guess what a shape or a
 * letter means.
 */
export function ResultLegend({ className }: { className?: string }) {
  const item = 'inline-flex items-center gap-1.5'
  const letter = 'font-mono font-medium text-ink'
  return (
    <div data-slot="result-legend" className={cn('mt-1.5 text-xs text-muted-foreground', className)}>
      <p>Each game shows the result, the color played and the opponent&apos;s number.</p>
      <ul aria-label="Key to the crosstable" className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {KEY.slice(0, 3).map(([code, words]) => (
          <li key={code} className={item}><span className={letter}>{code}</span> {words}</li>
        ))}
        <li className={item}><ColorMark color="white" className="text-ink" /> White</li>
        <li className={item}><ColorMark color="black" className="text-ink" /> Black</li>
        {KEY.slice(3).map(([code, words]) => (
          <li key={code} className={item}><span className={letter}>{code}</span> {words}</li>
        ))}
      </ul>
    </div>
  )
}
