/**
 * SANDBOX-ONLY runner. Prints the §5.8 metrics table across all profiles.
 * "Every Week-1 session ends with these numbers printed."
 */
import { CORPUS } from '../../src/lib/scanner/__fixtures__/games';
import { runProfile, formatMetricsTable, type ProfileMetrics } from '../../src/lib/scanner/metrics';
import type { ProfileName } from '../../src/lib/scanner/synthetic';

const profiles: ProfileName[] = ['clean', 'typical', 'timepressure'];
const rows: ProfileMetrics[] = [];

const started = Date.now();
for (const profile of profiles) {
  const { metrics, scores } = runProfile(CORPUS, profile);
  rows.push(metrics);

  const structural = scores.filter((s) => s.applied.length > 0);
  const structuralExact = structural.filter((s) => s.exactMatch).length;
  const skipped = scores.filter((s) => s.applied.some((a) => a.startsWith('skipped-pair')));
  const shifted = scores.filter((s) => s.applied.some((a) => a.startsWith('half-shift')));

  console.log(`\n=== ${profile} ===`);
  console.log(`  games with structural corruption: ${structural.length} (exact: ${structuralExact})`);
  if (skipped.length) {
    const recovered = skipped.filter((s) => s.correct / Math.max(1, s.truthPlies) > 0.9).length;
    console.log(`  skipped-move-pair games: ${skipped.length}, >90% recovered: ${recovered}`);
  }
  if (shifted.length) {
    const recovered = shifted.filter((s) => s.correct / Math.max(1, s.truthPlies) > 0.9).length;
    console.log(`  half-shift games: ${shifted.length}, >90% recovered: ${recovered}`);
  }
  const worst = [...scores].sort((a, b) => a.correct / Math.max(1, a.truthPlies) - b.correct / Math.max(1, b.truthPlies)).slice(0, 3);
  console.log(
    `  worst 3: ${worst.map((s) => `${s.id} ${(100 * s.correct / Math.max(1, s.truthPlies)).toFixed(0)}%${s.applied.length ? ` [${s.applied.join(',')}]` : ''}`).join(', ')}`,
  );
}

console.log(`\n${formatMetricsTable(rows)}`);
console.log(`\n(${CORPUS.length} games/profile, ${((Date.now() - started) / 1000).toFixed(1)}s total)`);
