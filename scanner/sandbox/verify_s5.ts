/**
 * SANDBOX-ONLY runner for the Week 1 S5 DoD:
 * "skipped-move-pair games recover".
 *
 * Isolates the structural corruptions from all the other noise so the
 * measurement is about alignment recovery specifically, not general
 * legibility. Each game is corrupted with ONLY a skipped move pair (or
 * only a half-shift) on an otherwise clean sheet.
 */
import { CORPUS } from '../src/lib/scanner/__fixtures__/games';
import { parsePgnMoves, renderScan } from '../src/lib/scanner/synthetic';
import { decodeScan } from '../src/lib/scanner/decoder';

function measure(label: string, drop: number) {
  let recovered = 0, flaggedFirstDiv = 0, considered = 0;
  const details: string[] = [];

  CORPUS.forEach((game, i) => {
    const { sans, result } = parsePgnMoves(game.pgn);
    if (sans.length < 30) return;
    considered++;
    // deterministic drop point, varied across the corpus
    let at = 8 + ((i * 7) % (sans.length - 20));
    if (drop === 2 && at % 2 === 1) at++;
    const kept = [...sans.slice(0, at), ...sans.slice(at + drop)];

    const scan = renderScan(kept, result);
    const decoded = decodeScan(scan);
    const got = decoded.moves.map((m) => m.san);

    // "Recovered" = the moves AFTER the gap are back on the true game.
    // The dropped moves themselves are unknowable from the sheet, so
    // requiring them to be right would be measuring clairvoyance.
    const tail = sans.slice(at + drop);
    const gotTail = got.slice(got.length - tail.length);
    const tailCorrect = tail.length > 0 && gotTail.every((s, j) => s === tail[j]);
    if (tailCorrect) recovered++;

    const firstDiv = sans.findIndex((s, j) => got[j] !== s);
    if (firstDiv !== -1) {
      const m = decoded.moves[firstDiv];
      if (m && (m.status === 'flagged' || m.status === 'guessed')) flaggedFirstDiv++;
    } else {
      flaggedFirstDiv++;
    }
    if (details.length < 5) {
      details.push(`  ${game.id} drop@ply${at + 1}: tail ${tailCorrect ? 'RECOVERED' : 'lost'}`);
    }
  });

  console.log(`\n${label} (${considered} games)`);
  console.log(details.join('\n'));
  console.log(`  post-gap alignment recovered: ${recovered}/${considered} = ${(100 * recovered / considered).toFixed(1)}%`);
  console.log(`  first divergence flagged:     ${flaggedFirstDiv}/${considered} = ${(100 * flaggedFirstDiv / considered).toFixed(1)}%`);
}

measure('SKIPPED MOVE PAIR (2 plies missing, §4.4)', 2);
measure('HALF-SHIFT (1 ply missing, §4.4)', 1);
