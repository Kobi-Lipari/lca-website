/** SANDBOX-ONLY: run one profile and append its metrics to /tmp/metrics.json */
import { CORPUS } from '../src/lib/scanner/__fixtures__/games';
import { runProfile } from '../src/lib/scanner/metrics';
import type { ProfileName } from '../src/lib/scanner/synthetic';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const profile = process.argv[2] as ProfileName;
const started = Date.now();
const { metrics, scores } = runProfile(CORPUS, profile);
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

const store = existsSync('/tmp/metrics.json')
  ? JSON.parse(readFileSync('/tmp/metrics.json', 'utf8'))
  : {};
store[profile] = { metrics, scores, elapsed };
writeFileSync('/tmp/metrics.json', JSON.stringify(store));
console.log(`${profile}: done in ${elapsed}s`);
console.log(JSON.stringify(metrics, null, 2));
