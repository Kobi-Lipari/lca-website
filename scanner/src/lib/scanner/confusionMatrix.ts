/**
 * Handwriting confusion matrix. Spec: SCANNER_SPEC.md §4.3.
 *
 * This is the single source of truth for "characters that look alike on a
 * handwritten scoresheet." It feeds two consumers:
 *  - normalizeToken (§5.2): generates positional-prior rewrite variants
 *  - the S2 candidate scorer (§5.3): substitution costs in the confusion-
 *    weighted edit distance
 *  - corrupt() in Week 1 S4 (§5.8) will also draw from this table to
 *    generate synthetic corruption, so keep it here rather than duplicating
 *    it near the decoder.
 *
 * Costs are illustrative, tuned by feel per the spec, and are Week 1's
 * starting point — §5.4/§5.8 call out that thresholds get calibrated
 * against real labeled data in Week 2. Don't be precious about the exact
 * numbers here; the shape (which pairs are cheap) matters more than the
 * decimals.
 */

export type SubstitutionContext = 'leading-piece' | 'trailing-digit' | 'any';

export interface Substitution {
  from: string;
  to: string;
  cost: number;
  /**
   * Where in the token this substitution is trusted to apply. `any` = safe
   * anywhere; `leading-piece` = only at the piece-letter position (start of
   * token, before file/rank chars); `trailing-digit` = only at the final
   * rank-digit position. Restricting context avoids nonsense rewrites like
   * turning a rank digit into a piece letter mid-token.
   */
  context: SubstitutionContext;
}

/**
 * Directional entries. Where §4.3 writes "a↔b" we list both directions
 * explicitly (costs can differ by direction later once we have real
 * confusion-log data from Week 2 §6.4 — for now they're symmetric).
 */
export const CONFUSION_SUBSTITUTIONS: readonly Substitution[] = [
  // 0 <-> O (castling digit/letter)
  { from: '0', to: 'O', cost: 0.1, context: 'any' },
  { from: 'O', to: '0', cost: 0.1, context: 'any' },

  // 1 <-> l <-> I
  { from: '1', to: 'l', cost: 0.1, context: 'any' },
  { from: 'l', to: '1', cost: 0.1, context: 'any' },
  { from: '1', to: 'I', cost: 0.1, context: 'any' },
  { from: 'I', to: '1', cost: 0.1, context: 'any' },

  // 1 <-> 7 (trailing rank digit)
  { from: '1', to: '7', cost: 0.3, context: 'trailing-digit' },
  { from: '7', to: '1', cost: 0.3, context: 'trailing-digit' },

  // 4 <-> 9 (trailing rank digit)
  { from: '4', to: '9', cost: 0.3, context: 'trailing-digit' },
  { from: '9', to: '4', cost: 0.3, context: 'trailing-digit' },

  // 6 <-> b
  { from: '6', to: 'b', cost: 0.3, context: 'any' },
  { from: 'b', to: '6', cost: 0.3, context: 'any' },

  // 8 <-> B
  { from: '8', to: 'B', cost: 0.2, context: 'any' },
  { from: 'B', to: '8', cost: 0.2, context: 'any' },

  // 5 <-> S. S is not in the legal SAN alphabet, so this only matters
  // going raw->normalized: an "S" reading maps to "5".
  { from: 'S', to: '5', cost: 0.3, context: 'trailing-digit' },

  // 2 <-> Z. Same story: Z isn't legal SAN, maps to 2.
  { from: 'Z', to: '2', cost: 0.3, context: 'trailing-digit' },

  // 9 <-> g <-> q. g/q aren't legal SAN outside the g-file / queen letter
  // positions, but as misreadings of a rank digit they map to 9.
  { from: 'g', to: '9', cost: 0.4, context: 'trailing-digit' },
  { from: 'q', to: '9', cost: 0.4, context: 'trailing-digit' },

  // a <-> o (o isn't legal SAN; maps to the a-file)
  { from: 'o', to: 'a', cost: 0.4, context: 'any' },

  // a <-> d (adjacent files, easy to mix up)
  { from: 'a', to: 'd', cost: 0.5, context: 'any' },
  { from: 'd', to: 'a', cost: 0.5, context: 'any' },

  // c <-> e
  { from: 'c', to: 'e', cost: 0.4, context: 'any' },
  { from: 'e', to: 'c', cost: 0.4, context: 'any' },

  // e <-> l (l isn't legal SAN; maps to e)
  { from: 'l', to: 'e', cost: 0.5, context: 'any' },

  // x <-> +
  { from: 'x', to: '+', cost: 0.3, context: 'any' },
  { from: '+', to: 'x', cost: 0.3, context: 'any' },

  // x <-> t (t isn't legal SAN; maps to x)
  { from: 't', to: 'x', cost: 0.4, context: 'any' },

  // N <-> H (H isn't legal SAN; maps to N). Almost always the piece letter.
  { from: 'H', to: 'N', cost: 0.1, context: 'leading-piece' },

  // K <-> R (rare, but happens - two very differently-meant pieces)
  { from: 'K', to: 'R', cost: 0.8, context: 'leading-piece' },
  { from: 'R', to: 'K', cost: 0.8, context: 'leading-piece' },

  // B <-> D (D isn't legal SAN; maps to B)
  { from: 'D', to: 'B', cost: 0.3, context: 'leading-piece' },

  // f <-> t (t isn't legal SAN; maps to f)
  { from: 't', to: 'f', cost: 0.4, context: 'any' },

  // h <-> b (both are real files - low-confidence, easy to over-fire)
  { from: 'h', to: 'b', cost: 0.5, context: 'any' },
  { from: 'b', to: 'h', cost: 0.5, context: 'any' },

  // n <-> h (lowercase n meant as knight, misread against h-file)
  { from: 'n', to: 'h', cost: 0.5, context: 'any' },
  { from: 'h', to: 'n', cost: 0.5, context: 'any' },
] as const;

/** Cost for an insertion/deletion of an 'x' specifically (§5.3: ~0.2). */
export const MISSING_OR_EXTRA_X_COST = 0.2;

/** Default cost for an insertion/deletion of any other character (§5.3: ~1). */
export const DEFAULT_INDEL_COST = 1;

/** Default substitution cost when no confusion-table entry applies. */
export const DEFAULT_SUBSTITUTION_COST = 1;

/**
 * Which contexts apply when comparing character `a` against `b`.
 *
 * Derived from what the characters ARE, not just where they sit. An early
 * version keyed context purely off index - position 0 was always
 * 'leading-piece', the last position always 'trailing-digit' - which is
 * wrong for bare pawn moves: in "g3" position 0 is a FILE, not a piece
 * letter, so the g<->9 rule (registered as a rank-digit confusion) never
 * fired and a transcribed "93" tied at cost 1.0 across all eight files,
 * picking a winner by array order. Measured on the typical profile that
 * was a top-3 cause of first divergence.
 *
 * A confusable character pair looks alike wherever it appears, so being
 * permissive here is correct: the per-pair costs still do the discriminating.
 */
export function contextsFor(
  a: string,
  b: string,
  index: number,
  length: number,
): SubstitutionContext[] {
  const contexts: SubstitutionContext[] = ['any'];

  const digitish = /[0-9]/.test(a) || /[0-9]/.test(b) || index === length - 1;
  if (digitish) contexts.push('trailing-digit');

  const pieceish =
    index === 0 || /[A-Z]/.test(a) || /[A-Z]/.test(b);
  if (pieceish) contexts.push('leading-piece');

  return contexts;
}

/**
 * Look up the substitution cost from `a` to `b` under any of the applicable
 * position contexts. Returns undefined if no table entry applies (caller
 * falls back to DEFAULT_SUBSTITUTION_COST).
 */
export function lookupSubstitutionCost(
  a: string,
  b: string,
  contexts: readonly SubstitutionContext[],
): number | undefined {
  if (a === b) return 0;
  let best: number | undefined;
  for (const sub of CONFUSION_SUBSTITUTIONS) {
    const matchesChars =
      (sub.from === a && sub.to === b) || (sub.from === b && sub.to === a);
    if (!matchesChars) continue;
    if (!contexts.includes(sub.context)) continue;
    if (best === undefined || sub.cost < best) best = sub.cost;
  }
  return best;
}
