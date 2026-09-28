/**
 * SANDBOX-ONLY. Validates the chess.js shim's move generator against
 * standard published perft node counts. If these match, the shim's legality
 * is trustworthy enough that decoder metrics measured on top of it mean
 * something. If they don't match, every number in STATUS.md is suspect.
 */
import { Chess } from 'chess.js';

function perft(chess: any, depth: number): number {
  if (depth === 0) return 1;
  const moves = chess.moves({ verbose: true });
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const m of moves) {
    chess.move({ from: m.from, to: m.to, promotion: m.promotion });
    nodes += perft(chess, depth - 1);
    chess.undo();
  }
  return nodes;
}

interface Case {
  name: string;
  fen: string;
  expected: number[]; // index = depth-1
}

// Standard perft suite (Chess Programming Wiki values).
const cases: Case[] = [
  {
    name: 'startpos',
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    expected: [20, 400, 8902, 197281],
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    expected: [48, 2039, 97862],
  },
  {
    name: 'position 3 (ep/pins)',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    expected: [14, 191, 2812, 43238],
  },
  {
    name: 'position 4 (promotions)',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    expected: [6, 264, 9467],
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    expected: [44, 1486, 62379],
  },
];

let failed = 0;
for (const c of cases) {
  for (let depth = 1; depth <= c.expected.length; depth++) {
    const chess = new Chess(c.fen);
    const got = perft(chess, depth);
    const want = c.expected[depth - 1]!;
    const ok = got === want;
    if (!ok) failed++;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${c.name.padEnd(24)} depth ${depth}  got ${got}  want ${want}`,
    );
  }
}

console.log(failed === 0 ? '\nAll perft counts match.' : `\n${failed} perft mismatches.`);
if (failed > 0) process.exit(1);
