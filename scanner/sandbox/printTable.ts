/** SANDBOX-ONLY: print the metrics table from /tmp/metrics.json */
import { formatMetricsTable } from '../src/lib/scanner/metrics';
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync('/tmp/metrics.json', 'utf8'));
const rows = ['clean', 'typical', 'timepressure'].filter((p) => s[p]).map((p) => s[p].metrics);
console.log(formatMetricsTable(rows));
