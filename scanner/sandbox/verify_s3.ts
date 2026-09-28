/**
 * SANDBOX-ONLY runner for the Week 1 S3 DoD:
 * "10 clean synthetic games decode to exact PGN match."
 */
import { CORPUS } from '../../src/lib/scanner/__fixtures__/games';
import { corrupt } from '../../src/lib/scanner/synthetic';
import { decodeScan } from '../../src/lib/scanner/decoder';
import { buildPgn } from '../../src/lib/scanner/chessAdapter';

const games = CORPUS.slice(0, 10);
let failures = 0;

for (const game of games) {
  const { scan, truth, truthPlies } = corrupt(game.pgn, 1, 'clean');
  const started = Date.now();
  const decoded = decodeScan(scan, { structuralOps: false });
  const elapsed = Date.now() - started;

  const expectedSans = truth.slice(0, truthPlies);
  const gotSans = decoded.moves.map((m) => m.san);

  const sansMatch =
    gotSans.length === expectedSans.length &&
    gotSans.every((s, i) => s === expectedSans[i]);

  const expectedPgn = buildPgn(expectedSans, {}, game.result);
  const gotPgn = buildPgn(gotSans, {}, decoded.result);
  const pgnMatch = expectedPgn === gotPgn;

  const lowConf = decoded.moves.filter(
    (m) => m.status === 'flagged' || m.status === 'guessed',
  ).length;

  if (!sansMatch || !pgnMatch) {
    failures++;
    console.log(`FAIL ${game.id}  (${elapsed}ms)`);
    const firstBad = gotSans.findIndex((s, i) => s !== expectedSans[i]);
    console.log(
      `  first divergence at ply ${firstBad + 1}: got "${gotSans[firstBad]}" want "${expectedSans[firstBad]}"`,
    );
    console.log(`  decoded ${gotSans.length} plies, expected ${expectedSans.length}`);
    console.log(`  result: got ${decoded.result} want ${game.result}`);
    if (decoded.warnings.length) console.log(`  warnings: ${decoded.warnings.join(' | ')}`);
  } else {
    console.log(
      `PASS ${game.id.padEnd(16)} ${String(expectedSans.length).padStart(3)} plies  ${String(elapsed).padStart(5)}ms  flagged:${lowConf}`,
    );
  }
}

console.log(
  failures === 0
    ? `\nS3 DoD MET: ${games.length}/${games.length} clean games decode to exact PGN match.`
    : `\nS3 DoD NOT met: ${failures}/${games.length} failed.`,
);
if (failures > 0) process.exit(1);
