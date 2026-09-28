import { describe, it, expect } from 'vitest';
import { decodeInBackground } from '../decodeInBackground';
import { decodeScan } from '../decoder';
import { parsePgnMoves, renderScan } from '../synthetic';
import { CORPUS } from '../__fixtures__/games';

// The test runner has no Web Workers, so this exercises the main-thread
// fallback. The worker path runs the same decodeScan; the browser check for
// it is the scanner page itself.
describe('decodeInBackground', () => {
  it('returns exactly what decodeScan returns', async () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 20);
    const scan = renderScan(sans, '1-0');
    const game = await decodeInBackground(scan);
    expect(game).toEqual(decodeScan(scan));
    expect(game.moves.map((m) => m.san)).toEqual(sans);
  });

  it('passes forced moves through to the decoder', async () => {
    const sans = parsePgnMoves(CORPUS[0]!.pgn).sans.slice(0, 12);
    const scan = renderScan(sans, '1-0');
    const forced = [...sans.slice(0, 2), 'Nc3'];
    const game = await decodeInBackground(scan, forced);
    expect(game).toEqual(decodeScan(scan, { forcedSans: forced }));
    expect(game.moves[2]!.san).toBe('Nc3');
  });
});
