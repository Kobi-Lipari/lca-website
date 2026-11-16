import { describe, it, expect } from 'vitest';
import { decodeScan } from '../decoder';
import { parsePgnMoves, renderScan } from '../synthetic';
import { CORPUS } from '../__fixtures__/games';
import {
  countNeedingLook,
  moveSource,
  needsLook,
  sourceLabel,
  sourceSentence,
} from '../moveSource';

// The Opera Game with 9. Qxf3 dxe5 never written (the sheet gaps.test.ts uses).
const { sans, result } = parsePgnMoves(CORPUS[0]!.pgn);
const scan = renderScan([...sans.slice(0, 8), ...sans.slice(10)], result);
const decoded = decodeScan(scan);
const gap = decoded.gaps![0]!;
const standIns = decoded.moves.slice(gap.ply - 1, gap.ply - 1 + gap.plies);

describe('results page - moves that were played but never written', () => {
  it('says they are not on the sheet, never that they were blank', () => {
    expect(standIns).toHaveLength(2);
    for (const move of standIns) {
      expect(moveSource(move)).toBe('unwritten');
      expect(sourceLabel(move)).toBe('not on the sheet');
      expect(sourceSentence(move)).toMatch(/not on the sheet/);
      expect(sourceLabel(move) + sourceSentence(move)).not.toMatch(/blank/);
    }
  });

  it('counts them as needing a look until the member settles them', () => {
    expect(standIns.every(needsLook)).toBe(true);
    expect(countNeedingLook(decoded, new Set())).toBe(2);
    expect(countNeedingLook(decoded, new Set([gap.ply]))).toBe(1);
    expect(countNeedingLook(decoded, new Set([gap.ply, gap.ply + 1]))).toBe(0);
  });

  it('puts the gap sentence among the warnings the page prints', () => {
    expect(decoded.warnings).toContain(gap.note);
    expect(gap.note).toMatch(/guesses: pick the moves that were played/);
  });

  it('offers other moves in the picker and keeps the one the member picks', () => {
    const before = decoded.moves.slice(0, gap.ply - 1).map((m) => m.san);
    const picked = decodeScan(scan, { forcedSans: [...before, sans[8]!] });
    expect(picked.moves[gap.ply - 1]!.san).toBe(sans[8]);
    // Still a move with no cell: the member said what it was, the sheet did not.
    expect(moveSource(picked.moves[gap.ply - 1]!)).toBe('unwritten');
    expect(picked.moves.slice(10).map((m) => m.san)).toEqual(sans.slice(10));
  });

  it('leaves every written move described by what was written', () => {
    const written = decoded.moves.filter((m) => m.sourceRaw !== null);
    expect(written).toHaveLength(sans.length - 2);
    expect(written.every((m) => m.unwritten === undefined)).toBe(true);
    expect(sourceLabel(written[0]!)).toBe('written “e4”');
    expect(sourceSentence(written[0]!)).toBe('Written on the sheet as “e4”.');
  });
});

describe('results page - a cell that was left blank', () => {
  it('is still called blank on the sheet', () => {
    const blanked = renderScan(sans, result);
    blanked.rows[5]!.white = null; // 6. Bc4 left empty
    const game = decodeScan(blanked);
    const guess = game.moves[10]!;
    expect(guess.sourceRaw).toBeNull();
    expect(guess.status).toBe('guessed');
    expect(moveSource(guess)).toBe('blank');
    expect(sourceLabel(guess)).toBe('blank on the sheet');
    expect(sourceSentence(guess)).toMatch(/blank on the sheet/);
    expect(game.gaps).toBeUndefined();
  });
});
