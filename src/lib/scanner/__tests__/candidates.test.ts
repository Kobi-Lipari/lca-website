import { describe, it, expect } from 'vitest';
import { rankCandidates, type CellReading } from '../candidates';

/** Top-ranked SAN for a cell against a legal-move list. */
function topSan(legalMoves: readonly string[], cell: CellReading): string {
  const ranked = rankCandidates(legalMoves, cell);
  return ranked[0]!.san;
}

/** All 20 legal SANs for White's first move from the starting position. */
const STARTING_POSITION_MOVES = [
  'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4',
  'f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'Na3', 'Nc3', 'Nf3', 'Nh3',
];

describe('candidates - spec nasty pairs (Week 1 S2 DoD)', () => {
  it('Hf3 -> Nf3 (leading H/N confusion)', () => {
    expect(topSan(STARTING_POSITION_MOVES, { raw: 'Hf3' })).toBe('Nf3');
  });

  it('0-0 -> O-O (castling digit/letter)', () => {
    const legalMoves = ['O-O', 'O-O-O', 'Kd2'];
    expect(topSan(legalMoves, { raw: '0-0' })).toBe('O-O');
  });

  it('ed5 -> exd5 (old-style pawn capture)', () => {
    const legalMoves = ['exd5', 'e4'];
    expect(topSan(legalMoves, { raw: 'ed5' })).toBe('exd5');
  });

  it('e89 -> e4: naive digit-substitution would try invalid "e84" (two-digit rank), ' +
    'demonstrating why candidates are scored against real legal moves rather than ' +
    'validated as freestanding tokens', () => {
    expect(topSan(STARTING_POSITION_MOVES, { raw: 'e89' })).toBe('e4');
  });
});

describe('candidates - 30-case fixture: correct candidate ranks #1', () => {
  const cases: Array<{
    label: string;
    legalMoves: readonly string[];
    cell: CellReading;
    expected: string;
  }> = [
    { label: 'exact match e4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e4' }, expected: 'e4' },
    { label: 'trailing 9->4: e9', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e9' }, expected: 'e4' },
    { label: 'leading H->N: Hf3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Hf3' }, expected: 'Nf3' },
    { label: 'exact match Nf3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Nf3' }, expected: 'Nf3' },
    { label: 'exact match Nh3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Nh3' }, expected: 'Nh3' },
    { label: 'exact match e3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e3' }, expected: 'e3' },
    { label: 'trailing 9->4: g9', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'g9' }, expected: 'g4' },
    {
      label: 'trailing 7->1: Ra7',
      legalMoves: ['Ra1', 'Ra8'],
      cell: { raw: 'Ra7' },
      expected: 'Ra1',
    },
    {
      label: 'colon as x: N:f3',
      legalMoves: ['Nxf3', 'Nd4'],
      cell: { raw: 'N:f3' },
      expected: 'Nxf3',
    },
    {
      label: 'old-style capture: ed5 -> exd5 (dup of nasty pair, different fixture)',
      legalMoves: ['exd5', 'exf5'],
      cell: { raw: 'e:d5' },
      expected: 'exd5',
    },
    {
      label: 'castling: 0-0 -> O-O',
      legalMoves: ['O-O', 'O-O-O', 'Kd2'],
      cell: { raw: '0-0' },
      expected: 'O-O',
    },
    {
      label: 'castling: ooo -> O-O-O',
      legalMoves: ['O-O', 'O-O-O', 'Kd2'],
      cell: { raw: 'ooo' },
      expected: 'O-O-O',
    },
    {
      label: 'check decoration stripped: Qh5 -> Qh5+',
      legalMoves: ['Qh5+', 'Nf3'],
      cell: { raw: 'Qh5' },
      expected: 'Qh5+',
    },
    {
      label: 'mate decoration stripped: Rd8 -> Rd8#',
      legalMoves: ['Rd8#', 'Ra1'],
      cell: { raw: 'Rd8' },
      expected: 'Rd8#',
    },
    {
      label: 'annotation + decoration both stripped: Nf3! -> Nf3+',
      legalMoves: ['Nf3+', 'Nh3'],
      cell: { raw: 'Nf3!' },
      expected: 'Nf3+',
    },
    {
      label: 'promotion bare Q: e8Q -> e8=Q',
      legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'],
      cell: { raw: 'e8Q' },
      expected: 'e8=Q',
    },
    {
      label: 'promotion parens: e8(Q) -> e8=Q',
      legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'],
      cell: { raw: 'e8(Q)' },
      expected: 'e8=Q',
    },
    {
      label: 'promotion slash: e8/Q -> e8=Q',
      legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'],
      cell: { raw: 'e8/Q' },
      expected: 'e8=Q',
    },
    {
      label: 'underpromotion distinguished: e8N -> e8=N (not e8=Q)',
      legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'],
      cell: { raw: 'e8N' },
      expected: 'e8=N',
    },
    {
      label: 'disambiguation exact: Nbd2',
      legalMoves: ['Nbd2', 'Nfd2'],
      cell: { raw: 'Nbd2' },
      expected: 'Nbd2',
    },
    {
      label: 'disambiguation fuzzy b<->6: N6d2 -> Nbd2',
      legalMoves: ['Nbd2', 'Nfd2'],
      cell: { raw: 'N6d2' },
      expected: 'Nbd2',
    },
    {
      label: 'disambiguation exact: Rae1 (not confused with Rhe1)',
      legalMoves: ['Rae1', 'Rhe1'],
      cell: { raw: 'Rae1' },
      expected: 'Rae1',
    },
    {
      label: 'disambiguation exact: Rhe1 (not confused with Rae1)',
      legalMoves: ['Rae1', 'Rhe1'],
      cell: { raw: 'Rhe1' },
      expected: 'Rhe1',
    },
    {
      label: 'rare K/R confusion: Kd2 -> Rd2 when K is illegal',
      legalMoves: ['Rd2', 'Bd2'],
      cell: { raw: 'Kd2' },
      expected: 'Rd2',
    },
    {
      label: 'rank-constraint nasty pair: e89 -> e4',
      legalMoves: STARTING_POSITION_MOVES,
      cell: { raw: 'e89' },
      expected: 'e4',
    },
    {
      label: 'missing x is cheap: Nf3 -> Nxf3 (capture was written without x)',
      legalMoves: ['Nxf3', 'Nh3'],
      cell: { raw: 'Nf3' },
      expected: 'Nxf3',
    },
    {
      label: 'exact match f4',
      legalMoves: STARTING_POSITION_MOVES,
      cell: { raw: 'f4' },
      expected: 'f4',
    },
    {
      label: '"Kt" old-style knight notation: Ktf3 -> Nf3',
      legalMoves: ['Nf3', 'Nh3'],
      cell: { raw: 'Ktf3' },
      expected: 'Nf3',
    },
    {
      label: 'alt reading resolves it: raw illegible, alt is exact',
      legalMoves: STARTING_POSITION_MOVES,
      cell: { raw: 'zz', alts: ['e4'] },
      expected: 'e4',
    },
    {
      label: 'struck-through-adjacent noise still resolves via alt list',
      legalMoves: ['Nxf3', 'Nh3'],
      cell: { raw: '??', alts: ['N:f3'] },
      expected: 'Nxf3',
    },
  ];

  it.each(cases)('$label', ({ legalMoves, cell, expected }) => {
    expect(topSan(legalMoves, cell)).toBe(expected);
  });
});
