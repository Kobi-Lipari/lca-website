/**
 * Candidate generation per cell. Spec: SCANNER_SPEC.md §5.3, Week 1 S2.
 *
 * Deliberately takes `legalMoves: string[]` (SAN strings) as a plain input
 * rather than importing chess.js and calling `chess.moves({verbose:true})`
 * itself. This keeps the scoring logic here pure and unit-testable without
 * a live chess.js dependency wired in (this sandbox has no network access
 * to install it - see STATUS.md). When this gets wired into the real beam
 * search (Week 1 S3), a thin adapter converts
 * `chess.moves({verbose:true}).map(m => m.san)` into this function's input;
 * that adapter is a couple of lines and doesn't need its own tests beyond
 * the integration/beam-search suite.
 */

import { cleanToken, stripCheckMateDecoration } from './normalize';
import {
  DEFAULT_INDEL_COST,
  DEFAULT_SUBSTITUTION_COST,
  MISSING_OR_EXTRA_X_COST,
  contextsFor,
  lookupSubstitutionCost,
  type SubstitutionContext,
} from './confusionMatrix';

/** §5.3: keep candidates with cost <= threshold; tune in Week 2. */
export const DEFAULT_CANDIDATE_THRESHOLD = 2.0;

export interface ScoredCandidate {
  /** the legal move's SAN, exactly as chess.js/the fixture produced it */
  san: string;
  /** confusion-weighted edit distance cost against the best-matching reading */
  cost: number;
}

export interface CellReading {
  raw: string;
  alts?: string[];
}

/**
 * Score every legal move against a cell's readings and return them sorted
 * best (lowest cost) first. Does not apply the §5.3 threshold - callers
 * that want "keep <= threshold, plus always keep the single best" should
 * use `selectCandidates`.
 */
export function rankCandidates(
  legalMoves: readonly string[],
  cell: CellReading,
): ScoredCandidate[] {
  const readingVariants = collectReadingVariants(cell);

  const scored: ScoredCandidate[] = legalMoves.map((san) => {
    const canonical = stripCheckMateDecoration(san);
    let best = Infinity;
    for (const reading of readingVariants) {
      const cost = confusionWeightedEditDistance(reading, canonical);
      if (cost < best) best = cost;
    }
    return { san, cost: best };
  });

  scored.sort((a, b) => a.cost - b.cost);
  return scored;
}

/**
 * §5.3: "Keep candidates with cost <= threshold, plus always keep the
 * single best even if above threshold (marked low-confidence)." Returns
 * the kept candidates plus whether the best one was above threshold (so
 * the caller/UI can mark it low-confidence per §3.2's `flagged` status).
 */
export function selectCandidates(
  ranked: readonly ScoredCandidate[],
  threshold = DEFAULT_CANDIDATE_THRESHOLD,
): { candidates: ScoredCandidate[]; bestAboveThreshold: boolean } {
  if (ranked.length === 0) return { candidates: [], bestAboveThreshold: false };

  const within = ranked.filter((c) => c.cost <= threshold);
  if (within.length > 0) {
    return { candidates: within, bestAboveThreshold: false };
  }
  return { candidates: [ranked[0]!], bestAboveThreshold: true };
}

function collectReadingVariants(cell: CellReading): string[] {
  const readings = [cell.raw, ...(cell.alts ?? [])];
  const variants = new Set<string>();
  for (const reading of readings) {
    // Deterministic cleanup only (§5.2's cleanToken) - NOT the fuller
    // confusion-variant expansion. confusionWeightedEditDistance below
    // already applies the same §4.3 table as fractional substitution
    // costs; pre-expanding into discrete variant strings here would
    // double-apply that table and can produce false zero-cost ties
    // against unrelated legal moves (see the comment on cleanToken).
    const cleaned = cleanToken(reading);
    if (cleaned !== '') variants.add(cleaned);
  }
  return Array.from(variants);
}

/**
 * Confusion-weighted edit distance between a normalized reading and a
 * canonical (decoration-stripped) legal-move SAN. Standard DP edit
 * distance, but:
 *  - substitution cost comes from the §4.3 confusion table (position-aware:
 *    the first character is scored in 'leading-piece' context, the last in
 *    'trailing-digit' context, everything else 'any'), falling back to
 *    DEFAULT_SUBSTITUTION_COST when no table entry applies.
 *  - insertion/deletion of 'x' costs MISSING_OR_EXTRA_X_COST (§5.3: "missing
 *    /extra x cost ~0.2") since a written or omitted capture marker is the
 *    single most common and least meaningful mismatch.
 *  - insertion/deletion of anything else costs DEFAULT_INDEL_COST (~1).
 */
export function confusionWeightedEditDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // dp[i][j] = cost to turn a[0..i) into b[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    dp[i]![0] = dp[i - 1]![0]! + indelCost(a[i - 1]!);
  }
  for (let j = 1; j <= n; j++) {
    dp[0]![j] = dp[0]![j - 1]! + indelCost(b[j - 1]!);
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const ai = a[i - 1]!;
      const bj = b[j - 1]!;
      const contexts = contextsFor(ai, bj, i - 1, m);

      const sub = dp[i - 1]![j - 1]! + substitutionCost(ai, bj, contexts);
      const del = dp[i - 1]![j]! + indelCost(ai);
      const ins = dp[i]![j - 1]! + indelCost(bj);

      dp[i]![j] = Math.min(sub, del, ins);
    }
  }

  return dp[m]![n]!;
}

function indelCost(ch: string): number {
  return ch === 'x' ? MISSING_OR_EXTRA_X_COST : DEFAULT_INDEL_COST;
}

function substitutionCost(
  a: string,
  b: string,
  contexts: readonly SubstitutionContext[],
): number {
  if (a === b) return 0;
  const known = lookupSubstitutionCost(a, b, contexts);
  return known ?? DEFAULT_SUBSTITUTION_COST;
}
