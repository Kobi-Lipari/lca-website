/**
 * SANDBOX-ONLY: decodes 60 fixed synthetic sheets and prints one hash of
 * every result. Run it before and after a change that should not alter
 * output (a speed-up, a refactor); the two hashes must match.
 */
import { CORPUS } from '../src/lib/scanner/__fixtures__/games';
import { corrupt } from '../src/lib/scanner/synthetic';
import { decodeScan } from '../src/lib/scanner/decoder';
import { createHash } from 'node:crypto';
const lines: string[] = [];
for (const profile of ['clean', 'typical', 'timepressure'] as const) {
  for (const [i, g] of CORPUS.slice(0, 20).entries()) {
    const { scan } = corrupt(g.pgn, 100 + i, profile);
    const d = decodeScan(scan);
    lines.push(JSON.stringify(d));
  }
}
console.log(createHash('sha256').update(lines.join('\n')).digest('hex'), lines.length);
