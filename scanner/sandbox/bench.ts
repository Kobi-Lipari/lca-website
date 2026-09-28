/**
 * SANDBOX-ONLY: decode time per game, by noise profile.
 *
 * Run against the real chess.js, not the shim: the shim's move generator is
 * several times faster, so shim timings say nothing about the browser.
 */
import { CORPUS } from '../src/lib/scanner/__fixtures__/games';
import { corrupt } from '../src/lib/scanner/synthetic';
import { decodeScan } from '../src/lib/scanner/decoder';
for (const profile of ['clean', 'typical', 'timepressure'] as const) {
  const times: number[] = [];
  for (const g of CORPUS.slice(0, 8)) {
    const { scan } = corrupt(g.pgn, 7, profile);
    const t = performance.now(); decodeScan(scan); times.push(performance.now() - t);
  }
  times.sort((a, b) => a - b);
  console.log(profile.padEnd(13), 'median', times[4].toFixed(0), "ms  max", times[7].toFixed(0), 'ms');
}
