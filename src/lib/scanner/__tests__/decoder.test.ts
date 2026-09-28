import { describe, it, expect } from 'vitest';
import { decodeScan, computeConfidence, normalizeResult } from '../decoder';
import { corrupt, renderScan, parsePgnMoves } from '../synthetic';
import { buildPgn } from '../chessAdapter';
import { CORPUS } from '../__fixtures__/games';
import type { RawScan } from '../types';

const CLEAN_GAMES = CORPUS.slice(0, 10);

describe('decoder - S3 happy path: clean games decode to exact PGN match', () => {
  it.each(CLEAN_GAMES.map((g) => ({ id: g.id, game: g })))(
    'decodes $id exactly',
    ({ game }) => {
      const { scan, truth, truthPlies } = corrupt(game.pgn, 1, 'clean');
      const decoded = decodeScan(scan, { structuralOps: false });

      const expected = truth.slice(0, truthPlies);
      expect(decoded.moves.map((m) => m.san)).toEqual(expected);
      expect(decoded.notation).toBe('algebraic');
      expect(decoded.truncatedAtPly).toBeUndefined();

      const expectedPgn = buildPgn(expected, {}, game.result);
      const gotPgn = buildPgn(decoded.moves.map((m) => m.san), {}, decoded.result);
      expect(gotPgn).toBe(expectedPgn);
    },
  );

  it('flags nothing on a clean sheet', () => {
    for (const game of CLEAN_GAMES) {
      const { scan } = corrupt(game.pgn, 1, 'clean');
      const decoded = decodeScan(scan, { structuralOps: false });
      const flagged = decoded.moves.filter(
        (m) => m.status === 'flagged' || m.status === 'guessed',
      );
      expect(flagged).toHaveLength(0);
    }
  });

  it('populates fenBefore and alternatives for the fix-up UI (§3.2)', () => {
    const { scan } = corrupt(CORPUS[0]!.pgn, 1, 'clean');
    const decoded = decodeScan(scan, { structuralOps: false });
    const first = decoded.moves[0]!;
    expect(first.fenBefore).toContain('w KQkq');
    expect(first.ply).toBe(1);
    expect(first.alternatives.length).toBeGreaterThan(0);
    expect(first.sourceRaw).toBe('e4');
  });
});

describe('decoder - notation variants survive a round trip (§4.2)', () => {
  it('decodes a sheet written entirely in old-style notation', () => {
    const scan: RawScan = {
      header: { result: '1-0', legibility: 'clear' },
      rows: [
        { n: 1, white: { raw: 'e4', confidence: 'high' }, black: { raw: 'e5', confidence: 'high' } },
        { n: 2, white: { raw: 'Ktf3', confidence: 'high' }, black: { raw: 'Ktc6', confidence: 'high' } },
        { n: 3, white: { raw: 'Bb5', confidence: 'high' }, black: { raw: 'a6', confidence: 'high' } },
        { n: 4, white: { raw: 'B:c6', confidence: 'high' }, black: { raw: 'dc6', confidence: 'high' } },
        { n: 5, white: { raw: '0-0', confidence: 'high' }, black: null },
      ],
    };
    const decoded = decodeScan(scan);
    expect(decoded.moves.map((m) => m.san)).toEqual([
      'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O',
    ]);
  });
});

describe('decoder - termination (§5.6)', () => {
  it('stops at a result token written in a cell', () => {
    const scan: RawScan = {
      header: { legibility: 'clear' },
      rows: [
        { n: 1, white: { raw: 'e4', confidence: 'high' }, black: { raw: 'e5', confidence: 'high' } },
        { n: 2, white: { raw: 'Nf3', confidence: 'high' }, black: { raw: '1-0', confidence: 'high' } },
      ],
    };
    const decoded = decodeScan(scan);
    expect(decoded.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(decoded.result).toBe('1-0');
  });

  it('treats trailing blank cells with a header result as normal, not an error (§4.1)', () => {
    const scan: RawScan = {
      header: { result: '0-1', legibility: 'clear' },
      rows: [
        { n: 1, white: { raw: 'e4', confidence: 'high' }, black: { raw: 'e5', confidence: 'high' } },
        { n: 2, white: { raw: 'Nf3', confidence: 'high' }, black: null },
        { n: 3, white: null, black: null },
        { n: 4, white: null, black: null },
      ],
    };
    const decoded = decodeScan(scan);
    expect(decoded.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(decoded.result).toBe('0-1');
    expect(decoded.truncatedAtPly).toBeUndefined();
    expect(decoded.moves.every((m) => m.status === 'matched')).toBe(true);
  });
});

describe('decoder - descriptive notation detection (§5.7)', () => {
  it('bails with a friendly message rather than decoding descriptive', () => {
    const scan: RawScan = {
      header: { legibility: 'clear' },
      rows: [
        { n: 1, white: { raw: 'P-K4', confidence: 'high' }, black: { raw: 'P-K4', confidence: 'high' } },
        { n: 2, white: { raw: 'N-KB3', confidence: 'high' }, black: { raw: 'N-QB3', confidence: 'high' } },
        { n: 3, white: { raw: 'B-N5', confidence: 'high' }, black: { raw: 'PxP', confidence: 'high' } },
      ],
    };
    const decoded = decodeScan(scan);
    expect(decoded.notation).toBe('descriptive');
    expect(decoded.moves).toHaveLength(0);
    expect(decoded.warnings[0]).toMatch(/algebraic/i);
  });

  it('does not misfire on algebraic sheets containing castling', () => {
    const { scan } = corrupt(CORPUS[0]!.pgn, 1, 'clean');
    expect(decodeScan(scan).notation).toBe('algebraic');
  });
});

describe('decoder - structural ops (§5.5)', () => {
  it('fills a blank mid-game cell with a guessed move that is always flagged', () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 12);
    const scan = renderScan(sans, '1-0');
    // blank out White's 4th move
    scan.rows[3]!.white = null;

    const decoded = decodeScan(scan);
    const guessed = decoded.moves.filter((m) => m.status === 'guessed');
    expect(guessed.length).toBeGreaterThan(0);
    for (const move of guessed) {
      expect(move.sourceRaw).toBeNull();
      expect(move.confidence).toBeLessThan(0.65);
    }
  });

  it('keeps the ply count right when a move is missing from the sheet', () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 14);
    const withGap = [...sans.slice(0, 6), ...sans.slice(7)];
    const scan = renderScan(withGap, '1-0');
    const decoded = decodeScan(scan);
    // The decoder should not silently emit a shorter game as if it were
    // complete - either it inserts a ply or it flags/truncates.
    const suspicious = decoded.moves.filter(
      (m) => m.status === 'guessed' || m.status === 'flagged',
    );
    expect(
      suspicious.length > 0 || decoded.truncatedAtPly !== undefined,
    ).toBe(true);
  });
});

describe('decoder - truncation is a feature (§1.2, §5.5)', () => {
  it('truncates rather than inventing moves when the sheet becomes unreadable', () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 10);
    const scan = renderScan(sans, '1-0');
    // Replace the tail with pure noise that matches nothing legal.
    for (let i = 3; i < scan.rows.length; i++) {
      scan.rows[i]!.white = { raw: 'zzz9', confidence: 'low' };
      scan.rows[i]!.black = { raw: 'qqq7', confidence: 'low' };
    }
    const decoded = decodeScan(scan);
    // Either the decoder stops and says so, or whatever it put after the
    // readable part is visibly unsure. What it must not do is return a game
    // that looks complete and confident. (An empty tail with no truncation
    // is exactly that failure, and every() on an empty list is true, so the
    // two cases are checked separately.)
    const trailing = decoded.moves.slice(6);
    const allConfident = trailing.every(
      (m) => m.status === 'matched' && m.confidence > 0.8,
    );
    const honest =
      decoded.truncatedAtPly !== undefined || (trailing.length > 0 && !allConfident);
    expect(honest).toBe(true);
  });

  it('reports truncation when the last written cells are skipped as noise', () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 10);
    const scan = renderScan(sans, '1-0');
    for (let i = 3; i < scan.rows.length; i++) {
      scan.rows[i]!.white = { raw: 'zzz9', confidence: 'low' };
      scan.rows[i]!.black = { raw: 'qqq7', confidence: 'low' };
    }
    const decoded = decodeScan(scan);
    expect(decoded.truncatedAtPly).toBe(decoded.moves.length);
    expect(decoded.warnings.some((w) => /could not decode past/i.test(w))).toBe(true);
  });

  it('does not report truncation for a sheet that simply ends', () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 10);
    const decoded = decodeScan(renderScan(sans, '1-0'));
    expect(decoded.truncatedAtPly).toBeUndefined();
    expect(decoded.moves.map((m) => m.san)).toEqual(sans);
  });
});

describe('confidence (§5.4)', () => {
  it('an exact reading with a clear margin is confident', () => {
    expect(computeConfidence(0, 1.0, 'high')).toBeGreaterThan(0.65);
  });

  it('an exact reading whose only rival is a cheap file confusion stays confident', () => {
    // "e4" vs the legal "c4": c<->e costs 0.4. This was the 15.9%
    // false-flag case on clean sheets before the exact-match bonus.
    expect(computeConfidence(0, 0.4, 'high')).toBeGreaterThan(0.65);
  });

  it('a fuzzy correction with a near rival is flagged', () => {
    expect(computeConfidence(0.8, 1.0, 'high')).toBeLessThan(0.65);
  });

  it('low vision confidence drags the score down', () => {
    expect(computeConfidence(0, 1.0, 'low')).toBeLessThan(
      computeConfidence(0, 1.0, 'high'),
    );
  });

  it('is clamped to 0..1', () => {
    expect(computeConfidence(0, 99, 'high')).toBeLessThanOrEqual(1);
    expect(computeConfidence(99, 0, 'low')).toBeGreaterThanOrEqual(0);
  });
});

describe('result normalization (§4.2)', () => {
  it.each([
    ['1-0', '1-0'],
    ['0-1', '0-1'],
    ['1/2-1/2', '1/2-1/2'],
    ['1/2', '1/2-1/2'],
    ['½-½', '1/2-1/2'],
    ['draw', '1/2-1/2'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeResult(input)).toBe(expected);
  });

  it('returns null for an unparseable result', () => {
    expect(normalizeResult('res.')).toBeNull();
  });
});

describe('decoder - forced moves (fix-up UI)', () => {
  const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 16);

  it('plays a forced move and keeps everything before it', () => {
    const scan = renderScan(sans, '1-0');
    const plain = decodeScan(scan);
    const legalAlternative = 'Nc3'; // instead of 2. Nf3
    const decoded = decodeScan(scan, { forcedSans: [...sans.slice(0, 2), legalAlternative] });
    expect(decoded.moves.slice(0, 2).map((m) => m.san)).toEqual(plain.moves.slice(0, 2).map((m) => m.san));
    expect(decoded.moves[2]!.san).toBe(legalAlternative);
  });

  it('fixing one misread move lets the rest of the game decode correctly', () => {
    const scan = renderScan(sans, '1-0');
    // The sheet says Nc3 where the game had Nf3: legal, so it reads as an
    // exact match, and the moves after it stop fitting.
    scan.rows[1]!.white = { raw: 'Nc3', confidence: 'high' };
    const misread = decodeScan(scan);
    expect(misread.moves[2]!.san).toBe('Nc3');

    const fixed = decodeScan(scan, { forcedSans: sans.slice(0, 3) });
    expect(fixed.moves.map((m) => m.san)).toEqual(sans);
  });

  it('changes nothing when the forced moves are the ones it would pick anyway', () => {
    const scan = renderScan(sans, '1-0');
    const plain = decodeScan(scan);
    const forced = decodeScan(scan, { forcedSans: sans.slice(0, 6) });
    expect(forced.moves.map((m) => m.san)).toEqual(plain.moves.map((m) => m.san));
  });
});
