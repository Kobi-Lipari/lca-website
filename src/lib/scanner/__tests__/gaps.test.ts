import { describe, it, expect } from 'vitest';
import { decodeScan } from '../decoder';
import { parsePgnMoves, renderScan } from '../synthetic';
import { createChessCache } from '../chessAdapter';
import { buildGapContext, findGapPlans } from '../gaps';
import { CORPUS } from '../__fixtures__/games';

// The Opera Game, 33 plies. Plies 9 and 10 (9. Qxf3 dxe5) are the ones
// dropped below: the queen's recapture is what later moves depend on.
const { sans, result } = parsePgnMoves(CORPUS[0]!.pgn);
const without = (from: number, count: number) => [
  ...sans.slice(0, from),
  ...sans.slice(from + count),
];
const isGuess = (m: { status: string; sourceRaw: string | null }) =>
  m.status === 'guessed' && m.sourceRaw === null;

describe('decoder - a move pair that was never written (§4.4)', () => {
  const scan = renderScan(without(8, 2), result);
  const decoded = decodeScan(scan);

  it('puts every written move after the gap back on its own move number', () => {
    expect(decoded.moves).toHaveLength(sans.length);
    expect(decoded.moves.slice(10).map((m) => m.san)).toEqual(sans.slice(10));
    expect(decoded.truncatedAtPly).toBeUndefined();
  });

  it('marks both stand-in moves as guesses that were not on the sheet', () => {
    expect(decoded.gaps).toHaveLength(1);
    const gap = decoded.gaps![0]!;
    expect(gap.plies).toBe(2);
    const standIns = decoded.moves.slice(gap.ply - 1, gap.ply + 1);
    expect(standIns.every(isGuess)).toBe(true);
    // Everything else on the sheet was read as written.
    expect(decoded.moves.filter(isGuess)).toHaveLength(2);
  });

  it('never places the gap later than it really is, and says so in a note', () => {
    const gap = decoded.gaps![0]!;
    expect(gap.ply).toBeLessThanOrEqual(9);
    expect(gap.latestPly).toBeGreaterThanOrEqual(gap.ply);
    expect(gap.note).toMatch(/move pair seems to be missing|Two moves seem to be missing/);
    expect(decoded.warnings).toContain(gap.note);
    // Every move before the stand-ins is exactly what was written there.
    expect(decoded.moves.slice(0, gap.ply - 1).map((m) => m.san)).toEqual(
      sans.slice(0, gap.ply - 1),
    );
  });

  it('keeps a move the member fixes inside the gap and re-aligns around it', () => {
    const gap = decoded.gaps![0]!;
    const before = decoded.moves.slice(0, gap.ply - 1).map((m) => m.san);
    // The member picks the real first missing move (only possible when the
    // stand-ins sit where the gap really is, as they do on this sheet).
    expect(gap.ply).toBe(9);
    const fixed = decodeScan(scan, { forcedSans: [...before, sans[8]!] });
    expect(fixed.moves[8]!.san).toBe(sans[8]);
    expect(fixed.moves.slice(10).map((m) => m.san)).toEqual(sans.slice(10));
    expect(fixed.gaps).toHaveLength(1);

    const both = decodeScan(scan, { forcedSans: [...before, sans[8]!, sans[9]!] });
    expect(both.moves.map((m) => m.san)).toEqual(sans);
  });
});

describe("decoder - one side's single move never written (§4.4 half-shift)", () => {
  const decoded = decodeScan(renderScan(without(8, 1), result));

  it('inserts one stand-in and reads the other column from there on', () => {
    expect(decoded.moves).toHaveLength(sans.length);
    expect(decoded.moves.slice(9).map((m) => m.san)).toEqual(sans.slice(9));
    expect(decoded.gaps).toHaveLength(1);
    expect(decoded.gaps![0]!.plies).toBe(1);
    expect(isGuess(decoded.moves[decoded.gaps![0]!.ply - 1]!)).toBe(true);
    expect(decoded.gaps![0]!.note).toMatch(/White's move 5 seems to be missing/);
  });
});

describe('decoder - sheets with nothing missing', () => {
  it('reports no gap on a clean sheet', () => {
    const decoded = decodeScan(renderScan(sans, result));
    expect(decoded.moves.map((m) => m.san)).toEqual(sans);
    expect(decoded.gaps).toBeUndefined();
    expect(decoded.warnings).toEqual([]);
  });

  it('does not call one misread cell a gap', () => {
    const scan = renderScan(sans, result);
    scan.rows[6]!.white = { raw: 'Qb8', confidence: 'high' }; // 7. Qb3 misread; not a legal move
    const decoded = decodeScan(scan);
    expect(decoded.gaps).toBeUndefined();
    expect(decoded.moves.map((m) => m.san)).toEqual(sans);
  });

  it('fills a blank cell with the move a later cell needs', () => {
    const scan = renderScan(sans, result);
    scan.rows[4]!.white = null; // 5. Qxf3: nothing else lets 7. Qb3 be played
    const decoded = decodeScan(scan);
    expect(decoded.moves.map((m) => m.san)).toEqual(sans);
    expect(decoded.moves[8]!.status).toBe('guessed');
    expect(decoded.gaps).toBeUndefined();
  });
});

describe('gap search', () => {
  it('finds nothing to insert where the cells read as legal moves', () => {
    const cache = createChessCache();
    const cells = sans.map((raw) => ({ raw, confidence: 'high' as const }));
    const ctx = buildGapContext(cells, cache, undefined, 10_000);
    // Probe a cell that is perfectly legal: no unwritten move makes the
    // sheet read better than it already does one ply on.
    let fen = cache.startingFen();
    const history: string[] = [];
    for (const san of sans.slice(0, 8)) {
      history.push(fen);
      fen = cache.applyMove(fen, san);
    }
    const plans = findGapPlans(ctx, { fen, slot: 8, ply: 8, history, historyCosts: history.map(() => 0) });
    expect(plans.filter((p) => p.inserted.length === 1)).toEqual([]);
  });

  it('stays within its work budget', () => {
    const cache = createChessCache();
    const written = without(8, 2);
    const cells = written.map((raw) => ({ raw, confidence: 'high' as const }));
    const ctx = buildGapContext(cells, cache, undefined, 50);
    let fen = cache.startingFen();
    const history: string[] = [];
    for (const san of written.slice(0, 8)) {
      history.push(fen);
      fen = cache.applyMove(fen, san);
    }
    findGapPlans(ctx, { fen, slot: 8, ply: 8, history, historyCosts: history.map(() => 0) });
    // The cap is checked between candidates, so it can be overshot by one
    // candidate's replay, never by a whole search.
    expect(ctx.work.ops).toBeLessThan(400);
  });
});

describe('chess adapter - helpers the gap search relies on', () => {
  const cache = createChessCache();
  const positions = [
    cache.startingFen(),
    'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 3 9',
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  ];

  it('lists one piece type with the same spelling as the full list', () => {
    for (const fen of positions) {
      const full = createChessCache().legalSans(fen);
      const letters = { p: /^[a-h]/, n: /^N/, b: /^B/, r: /^R/, q: /^Q/, k: /^[KO]/ } as const;
      for (const [piece, pattern] of Object.entries(letters)) {
        const only = createChessCache().legalSansOf(fen, piece as keyof typeof letters);
        expect([...only].sort()).toEqual(full.filter((s) => pattern.test(s)).sort());
      }
    }
  });

  it('passes the turn, and refuses to when the side to move is in check', () => {
    const passed = cache.passTurn(positions[1]!)!;
    expect(passed.split(' ')[1]).toBe('b');
    expect(passed.split(' ')[0]).toBe(positions[1]!.split(' ')[0]);
    const inCheck = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(cache.passTurn(inCheck)).toBeNull();
  });
});
