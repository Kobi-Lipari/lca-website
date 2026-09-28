import assert from 'node:assert/strict';
import { rankCandidates, type CellReading } from '../src/lib/scanner/candidates';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${label}`);
    console.error('  ' + (e as Error).message);
  }
}

function topSan(legalMoves: readonly string[], cell: CellReading): string {
  const ranked = rankCandidates(legalMoves, cell);
  return ranked[0].san;
}

const STARTING_POSITION_MOVES = [
  'a3', 'a4', 'b3', 'b4', 'c3', 'c4', 'd3', 'd4', 'e3', 'e4',
  'f3', 'f4', 'g3', 'g4', 'h3', 'h4', 'Na3', 'Nc3', 'Nf3', 'Nh3',
];

// Nasty pairs
check('Hf3 -> Nf3', () => assert.equal(topSan(STARTING_POSITION_MOVES, { raw: 'Hf3' }), 'Nf3'));
check('0-0 -> O-O', () => assert.equal(topSan(['O-O', 'O-O-O', 'Kd2'], { raw: '0-0' }), 'O-O'));
check('ed5 -> exd5', () => assert.equal(topSan(['exd5', 'e4'], { raw: 'ed5' }), 'exd5'));
check('e89 -> e4 (rank-constraint demo)', () =>
  assert.equal(topSan(STARTING_POSITION_MOVES, { raw: 'e89' }), 'e4'));

// 30-case fixture
const cases: Array<{ label: string; legalMoves: readonly string[]; cell: CellReading; expected: string }> = [
  { label: 'exact e4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e4' }, expected: 'e4' },
  { label: 'e9 -> e4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e9' }, expected: 'e4' },
  { label: 'Hf3 -> Nf3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Hf3' }, expected: 'Nf3' },
  { label: 'exact Nf3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Nf3' }, expected: 'Nf3' },
  { label: 'exact Nh3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'Nh3' }, expected: 'Nh3' },
  { label: 'exact e3', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e3' }, expected: 'e3' },
  { label: 'g9 -> g4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'g9' }, expected: 'g4' },
  { label: 'Ra7 -> Ra1', legalMoves: ['Ra1', 'Ra8'], cell: { raw: 'Ra7' }, expected: 'Ra1' },
  { label: 'N:f3 -> Nxf3', legalMoves: ['Nxf3', 'Nd4'], cell: { raw: 'N:f3' }, expected: 'Nxf3' },
  { label: 'e:d5 -> exd5', legalMoves: ['exd5', 'exf5'], cell: { raw: 'e:d5' }, expected: 'exd5' },
  { label: '0-0 -> O-O', legalMoves: ['O-O', 'O-O-O', 'Kd2'], cell: { raw: '0-0' }, expected: 'O-O' },
  { label: 'ooo -> O-O-O', legalMoves: ['O-O', 'O-O-O', 'Kd2'], cell: { raw: 'ooo' }, expected: 'O-O-O' },
  { label: 'Qh5 -> Qh5+', legalMoves: ['Qh5+', 'Nf3'], cell: { raw: 'Qh5' }, expected: 'Qh5+' },
  { label: 'Rd8 -> Rd8#', legalMoves: ['Rd8#', 'Ra1'], cell: { raw: 'Rd8' }, expected: 'Rd8#' },
  { label: 'Nf3! -> Nf3+', legalMoves: ['Nf3+', 'Nh3'], cell: { raw: 'Nf3!' }, expected: 'Nf3+' },
  { label: 'e8Q -> e8=Q', legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'], cell: { raw: 'e8Q' }, expected: 'e8=Q' },
  { label: 'e8(Q) -> e8=Q', legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'], cell: { raw: 'e8(Q)' }, expected: 'e8=Q' },
  { label: 'e8/Q -> e8=Q', legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'], cell: { raw: 'e8/Q' }, expected: 'e8=Q' },
  { label: 'e8N -> e8=N', legalMoves: ['e8=Q', 'e8=R', 'e8=B', 'e8=N'], cell: { raw: 'e8N' }, expected: 'e8=N' },
  { label: 'exact Nbd2', legalMoves: ['Nbd2', 'Nfd2'], cell: { raw: 'Nbd2' }, expected: 'Nbd2' },
  { label: 'N6d2 -> Nbd2', legalMoves: ['Nbd2', 'Nfd2'], cell: { raw: 'N6d2' }, expected: 'Nbd2' },
  { label: 'exact Rae1', legalMoves: ['Rae1', 'Rhe1'], cell: { raw: 'Rae1' }, expected: 'Rae1' },
  { label: 'exact Rhe1', legalMoves: ['Rae1', 'Rhe1'], cell: { raw: 'Rhe1' }, expected: 'Rhe1' },
  { label: 'Kd2 -> Rd2', legalMoves: ['Rd2', 'Bd2'], cell: { raw: 'Kd2' }, expected: 'Rd2' },
  { label: 'e89 -> e4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'e89' }, expected: 'e4' },
  { label: 'Nf3 -> Nxf3 (missing x cheap)', legalMoves: ['Nxf3', 'Nh3'], cell: { raw: 'Nf3' }, expected: 'Nxf3' },
  { label: 'exact f4', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'f4' }, expected: 'f4' },
  { label: 'Ktf3 -> Nf3', legalMoves: ['Nf3', 'Nh3'], cell: { raw: 'Ktf3' }, expected: 'Nf3' },
  { label: 'alt list resolves illegible raw', legalMoves: STARTING_POSITION_MOVES, cell: { raw: 'zz', alts: ['e4'] }, expected: 'e4' },
  { label: 'alt list resolves colon noise', legalMoves: ['Nxf3', 'Nh3'], cell: { raw: '??', alts: ['N:f3'] }, expected: 'Nxf3' },
];

for (const c of cases) {
  check(c.label, () => assert.equal(topSan(c.legalMoves, c.cell), c.expected));
}

console.log(`\n${passed} passed, ${failed} failed (of ${passed + failed})`);
if (failed > 0) process.exit(1);
