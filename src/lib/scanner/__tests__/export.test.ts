import { describe, it, expect } from 'vitest';
import { gameToPgn, lichessAnalysisUrl, pgnHeaders } from '../export';
import { decodeScan } from '../decoder';
import { renderScan } from '../synthetic';

const SANS = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'];

function scholarsMate() {
  const scan = renderScan(SANS, '1-0');
  scan.header.whiteName = 'Paul';
  scan.header.blackName = 'Ana';
  return { scan, game: decodeScan(scan) };
}

describe('pgnHeaders', () => {
  it('passes names and events through', () => {
    const h = pgnHeaders({ legibility: 'clear', whiteName: 'Paul', event: 'Kenner Open', round: '3' });
    expect(h.White).toBe('Paul');
    expect(h.Event).toBe('Kenner Open');
    expect(h.Round).toBe('3');
  });

  it('drops dates and ratings PGN would not accept', () => {
    const h = pgnHeaders({
      legibility: 'clear',
      date: '9/14/26',
      whiteRating: '1650P',
      blackRating: 'unr',
    });
    expect(h.Date).toBeUndefined();
    expect(h.WhiteElo).toBeUndefined();
    expect(h.BlackElo).toBeUndefined();
  });

  it('keeps well-formed dates and ratings', () => {
    const h = pgnHeaders({ legibility: 'clear', date: '2026.09.14', whiteRating: '1650' });
    expect(h.Date).toBe('2026.09.14');
    expect(h.WhiteElo).toBe('1650');
  });
});

describe('gameToPgn', () => {
  it('writes the headers, the moves and the result', () => {
    const { scan, game } = scholarsMate();
    const pgn = gameToPgn(game, scan.header);
    expect(pgn).toContain('[White "Paul"]');
    expect(pgn).toContain('[Black "Ana"]');
    expect(pgn).toContain('[Result "1-0"]');
    expect(pgn).toContain('4. Qxf7# 1-0');
  });
});

describe('lichessAnalysisUrl', () => {
  it('lists the moves in the path, encoded', () => {
    const { game } = scholarsMate();
    expect(lichessAnalysisUrl(game)).toBe(
      'https://lichess.org/analysis/pgn/e4_e5_Qh5_Nc6_Bc4_Nf6_Qxf7%23',
    );
  });
});
