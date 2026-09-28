import { describe, it, expect } from 'vitest';
import { emailGameLink, gameToPgn, lichessAnalysisUrl, pgnFilename, pgnHeaders } from '../export';
import { decodeScan } from '../decoder';
import { parsePgnMoves, renderScan } from '../synthetic';
import { CORPUS } from '../__fixtures__/games';

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

describe('pgnFilename', () => {
  const day = new Date(2026, 8, 14);

  it('uses the players\' surnames and the date', () => {
    expect(pgnFilename({ legibility: 'clear', whiteName: 'Kobi Lipari', blackName: 'Ana Smith' }, day)).toBe(
      'Lipari-vs-Smith-2026-09-14.pgn',
    );
  });

  it('strips accents and anything a file system might reject', () => {
    expect(pgnFilename({ legibility: 'clear', whiteName: 'José Núñez', blackName: "O'Brien/Jr" }, day)).toBe(
      'Nunez-vs-O-Brien-Jr-2026-09-14.pgn',
    );
  });

  it('falls back to a generic name when a player is missing', () => {
    expect(pgnFilename({ legibility: 'clear', whiteName: 'Paul' }, day)).toBe('scanned-game-2026-09-14.pgn');
  });
});

describe('emailGameLink', () => {
  it('fills in the subject, the lichess link and the PGN for a short game', () => {
    const { scan, game } = scholarsMate();
    const link = emailGameLink(game, scan.header);
    const params = new URLSearchParams(link.slice('mailto:?'.length));
    expect(params.get('subject')).toBe('Chess game: Paul vs Ana');
    expect(params.get('body')).toContain(lichessAnalysisUrl(game));
    expect(params.get('body')).toContain('4. Qxf7# 1-0');
  });

  it('leaves the PGN out when it would make the link too long, but keeps the lichess link', () => {
    const sans = parsePgnMoves(CORPUS.reduce((a, b) => (b.pgn.length > a.pgn.length ? b : a)).pgn).sans;
    const scan = renderScan(sans, '1-0');
    const game = decodeScan(scan);
    const link = emailGameLink(game, scan.header);
    const body = new URLSearchParams(link.slice('mailto:?'.length)).get('body') ?? '';
    expect(body).toContain(lichessAnalysisUrl(game));
    expect(body).toContain('Save PGN');
    expect(body).not.toContain('PGN:\n[');
  });
});
