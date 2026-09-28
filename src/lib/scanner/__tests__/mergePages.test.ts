import { describe, it, expect } from 'vitest';
import { mergePages } from '../mergePages';
import { decodeScan } from '../decoder';
import { parsePgnMoves, renderScan } from '../synthetic';
import { CORPUS } from '../__fixtures__/games';
import type { RawScan } from '../types';

const cell = (raw: string) => ({ raw, confidence: 'high' as const });

/** A page holding rows first..last of the given scan, renumbered by `shift`. */
function page(scan: RawScan, first: number, last: number, shift = 0): RawScan {
  return {
    header: { ...scan.header },
    rows: scan.rows
      .filter((r) => r.n >= first && r.n <= last)
      .map((r) => ({ ...r, n: r.n + shift })),
  };
}

describe('mergePages', () => {
  const sans = parsePgnMoves(CORPUS[0]!.pgn).sans; // 33 plies, 17 rows
  const whole = renderScan(sans, '1-0');

  it('returns a single page unchanged', () => {
    expect(mergePages([whole])).toBe(whole);
  });

  it('joins a sheet and its back side numbered straight on', () => {
    const merged = mergePages([page(whole, 1, 10), page(whole, 11, 17)]);
    expect(merged.rows).toEqual(whole.rows);
  });

  it('renumbers a continuation sheet that starts again at 1', () => {
    const merged = mergePages([page(whole, 1, 10), page(whole, 11, 17, -10)]);
    expect(merged.rows).toEqual(whole.rows);
  });

  it('decodes a two-page game exactly as the one-page original', () => {
    const merged = mergePages([page(whole, 1, 10), page(whole, 11, 17, -10)]);
    expect(decodeScan(merged).moves.map((m) => m.san)).toEqual(sans);
  });

  it('keeps the earlier page where pages overlap, filling only its blanks', () => {
    const first: RawScan = {
      header: { legibility: 'clear' },
      rows: [
        { n: 9, white: cell('Bg5'), black: cell('b5') },
        { n: 10, white: cell('Nxb5'), black: null },
      ],
    };
    const second: RawScan = {
      header: { legibility: 'clear' },
      rows: [
        { n: 10, white: cell('Nb5'), black: cell('cxb5') },
        { n: 11, white: cell('Bxb5+'), black: cell('Nbd7') },
      ],
    };
    const merged = mergePages([first, second]);
    expect(merged.rows.find((r) => r.n === 10)).toEqual({ n: 10, white: cell('Nxb5'), black: cell('cxb5') });
    expect(merged.rows.map((r) => r.n)).toEqual([9, 10, 11]);
  });

  it('takes names from the first page, fills gaps from later ones, and reports the worst legibility', () => {
    const merged = mergePages([
      { header: { legibility: 'clear', whiteName: 'Lipari' }, rows: [{ n: 1, white: cell('e4'), black: cell('e5') }] },
      {
        header: { legibility: 'partial', whiteName: 'Someone else', blackName: 'Smith', result: '1-0' },
        rows: [{ n: 2, white: cell('Nf3'), black: null }],
      },
    ]);
    expect(merged.header).toEqual({ legibility: 'partial', whiteName: 'Lipari', blackName: 'Smith', result: '1-0' });
  });

  it('labels each page\'s notes', () => {
    const merged = mergePages([
      { header: { legibility: 'clear' }, rows: [], sheetNotes: ['ink blot'] },
      { header: { legibility: 'clear' }, rows: [], sheetNotes: ['continued'] },
    ]);
    expect(merged.sheetNotes).toEqual(['Page 1: ink blot', 'Page 2: continued']);
  });
});
