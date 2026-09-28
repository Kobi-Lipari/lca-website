/**
 * Joining the pages of one game into a single RawScan (SCANNER_SPEC §3.1).
 *
 * A long game runs onto the back of the sheet or onto a second sheet. Each
 * page is transcribed on its own; this puts them together, in the order the
 * member added them, before the decoder sees anything.
 *
 * Two rules:
 *
 * 1. Overlapping move numbers. Some players rewrite the last few moves at
 *    the top of the next page. When two pages both have a row n, the earlier
 *    page wins, and the later page only fills cells the earlier one left
 *    blank (the spec's rule: an earlier reading is never overwritten).
 *
 * 2. Continuation sheets that restart at 1. A second printed sheet usually
 *    starts its numbering at 1 again, but the moves on it are 61, 62, ...
 *    If a later page starts at or below a move the earlier pages already
 *    wrote, and starts at 1, it is renumbered to follow on from the last
 *    written move. Without this, page two's "1." would be laid over page
 *    one's "1." and most of it silently discarded by rule 1.
 */

import type { RawCell, RawScan } from './types';

type Row = RawScan['rows'][number];

function isWritten(cell: RawCell | null): boolean {
  return cell !== null && cell.raw.trim().length > 0;
}

/** The highest move number with anything written in it, or 0. */
function lastWrittenMove(rows: readonly Row[]): number {
  let last = 0;
  for (const row of rows) {
    if ((isWritten(row.white) || isWritten(row.black)) && row.n > last) last = row.n;
  }
  return last;
}

function firstWrittenMove(rows: readonly Row[]): number | null {
  let first: number | null = null;
  for (const row of rows) {
    if ((isWritten(row.white) || isWritten(row.black)) && (first === null || row.n < first)) first = row.n;
  }
  return first;
}

const LEGIBILITY_RANK: Record<RawScan['header']['legibility'], number> = {
  clear: 0,
  partial: 1,
  unreadable: 2,
};

export function mergePages(pages: readonly RawScan[]): RawScan {
  if (pages.length === 0) {
    return { header: { legibility: 'unreadable' }, rows: [] };
  }
  if (pages.length === 1) return pages[0]!;

  const byNumber = new Map<number, Row>();
  const header: RawScan['header'] = { ...pages[0]!.header };
  const notes: string[] = [];

  pages.forEach((page, index) => {
    // Header: the first page is the one with the names and event on it; a
    // later page only fills in what the first left out. Legibility is the
    // worst of the pages, since that is what the member should expect.
    if (index > 0) {
      for (const [key, value] of Object.entries(page.header) as Array<[keyof RawScan['header'], string]>) {
        if (key === 'legibility') continue;
        if (header[key] === undefined && value !== undefined) {
          (header as Record<string, string>)[key] = value;
        }
      }
      if (LEGIBILITY_RANK[page.header.legibility] > LEGIBILITY_RANK[header.legibility]) {
        header.legibility = page.header.legibility;
      }
    }

    const written = [...byNumber.values()];
    const soFar = lastWrittenMove(written);
    const first = firstWrittenMove(page.rows);
    const restartsNumbering = index > 0 && first === 1 && soFar > 0;
    const offset = restartsNumbering ? soFar : 0;

    for (const row of page.rows) {
      const n = row.n + offset;
      const existing = byNumber.get(n);
      if (!existing) {
        byNumber.set(n, { n, white: row.white, black: row.black });
        continue;
      }
      byNumber.set(n, {
        n,
        white: isWritten(existing.white) ? existing.white : row.white,
        black: isWritten(existing.black) ? existing.black : row.black,
      });
    }

    for (const note of page.sheetNotes ?? []) {
      notes.push(pages.length > 1 ? `Page ${index + 1}: ${note}` : note);
    }
  });

  const merged: RawScan = {
    header,
    rows: [...byNumber.values()].sort((a, b) => a.n - b.n),
  };
  if (notes.length > 0) merged.sheetNotes = notes;
  return merged;
}
