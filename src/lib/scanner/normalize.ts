/**
 * Token normalization. Spec: SCANNER_SPEC.md §5.2 (embodies §4.2 + §4.3).
 *
 * Pure, table-driven, heavily unit-tested. This is deliberately the
 * highest-iteration file in the decoder (per spec) - keep additions here
 * table-driven and documented with the §4.2/§4.3 bullet they cover.
 *
 * normalizeToken(raw) does NOT know about the board position or legal
 * moves - that's S2/candidates.ts. It only cleans up notation-style noise
 * (castling spelling, colon-for-x, promotion spelling, decoration,
 * "Kt" for knight, old-style pawn captures, draw-offer marks) and proposes
 * a small set of positional-prior character-substitution variants for the
 * candidate scorer to try. It never invents ranks/files it can't see.
 */

import {
  CONFUSION_SUBSTITUTIONS,
  type SubstitutionContext,
} from './confusionMatrix';

/** §4.2: result tokens that end a game / stop decoding. Not moves. */
const RESULT_TOKEN_PATTERN =
  /^(1-0|0-1|1\/2-1\/2|1\/2|½-½|draw|res\.?|resigns?)$/i;

export function isResultToken(raw: string): boolean {
  return RESULT_TOKEN_PATTERN.test(raw.trim());
}

/**
 * normalizeToken(raw) -> cleaned token plus positional-prior variants.
 *
 * Returned array always has the primary cleaned reading first, followed by
 * deduplicated alternate variants (most-likely first). Never empty; if raw
 * is empty/whitespace, returns [''].
 */
export function normalizeToken(raw: string): string[] {
  const cleaned = cleanToken(raw);
  if (cleaned === '') return [''];

  const variants = new Set<string>();
  variants.add(cleaned);

  for (const variant of generateConfusionVariants(cleaned)) {
    variants.add(variant);
  }

  return Array.from(variants);
}

/**
 * Strip trailing check/mate decoration only (§4.2: "+", "#", "++" are
 * zero-weight decoration). Exported separately from cleanToken because the
 * S2 candidate scorer (candidates.ts) needs to apply the exact same
 * stripping to legal-move SANs coming out of chess.js (which include "+"/
 * "#" when the move gives check/mate) before comparing them against a
 * normalized cell reading - without running the rest of cleanToken's
 * notation-rewriting on an already-canonical legal SAN.
 */
export function stripCheckMateDecoration(san: string): string {
  return san.replace(/[+#]+$/g, '');
}

/**
 * Deterministic, non-fuzzy cleanup: things we're confident about rewriting
 * outright rather than offering as a fuzzy alternative. Order matters -
 * decoration stripping happens first so later pattern matches see a clean
 * tail.
 *
 * Exported (in addition to being used inside normalizeToken) because the
 * S2 candidate scorer (candidates.ts) wants exactly this - the single
 * best-guess literal rewrite - WITHOUT the confusion-table variant
 * expansion below. Feeding pre-expanded confusion variants into the S2
 * edit-distance scorer as separate zero-cost strings double-counts the
 * confusion cost (the edit-distance function already applies it
 * character-by-character) and can create false zero-cost ties between two
 * different legal moves. cleanToken's deterministic output is the correct
 * input for that scorer; normalizeToken's fuller variant list is for
 * contexts that want discrete alternate readings rather than a fuzzy score.
 */
export function cleanToken(raw: string): string {
  let s = raw.trim();
  if (s === '') return '';

  // §4.2: en passant annotation "e.p." - strip it (case-insensitive,
  // with or without a preceding space).
  s = s.replace(/\s*e\.p\.?\s*$/i, '');

  // §4.2: annotations to strip entirely: !, ?, !?, ?!, etc.
  s = s.replace(/[!?]+$/g, '');

  // §4.2: check/mate marks are decoration - strip for matching purposes.
  // (Presence/absence is tracked by the caller as a tiebreaker only, per
  // §4.2/§5.2; normalizeToken's job is producing the matchable token.)
  s = s.replace(/[+#]+$/g, '');

  s = s.trim();
  if (s === '') return '';

  // §4.2: "0-0"/"oo"/"O-O" family -> canonical "O-O" / "O-O-O". Do this
  // before the colon/Kt rewrites below since castling has no piece letter
  // or capture to worry about.
  const castled = normalizeCastling(s);
  if (castled) return castled;

  // §4.2: "Kt" for knight (older players) -> "N".
  s = s.replace(/^Kt/i, 'N');

  // §4.2: ":" used instead of "x" for a capture.
  s = s.replace(/:/g, 'x');

  // §4.2: promotion spelled without "=" - "e8Q", "e8(Q)", "e8/Q" -> "e8=Q".
  // Also covers capture-promotions like "exd8Q" -> "exd8=Q".
  s = normalizePromotion(s);

  // §4.2: trailing standalone "=" is a draw-offer mark, not a promotion
  // (promotion is handled above and already has a piece letter after the
  // "="; if we still see a bare trailing "=" here it has nothing after it).
  s = s.replace(/=+$/g, '');

  // §4.2: old-style bare pawn capture with no explicit "x", e.g. "ed5"
  // meaning "the e-pawn captures on d5" -> "exd5". Only fires for the
  // exact two-file-letters-plus-rank shape; a bare "ed" (no rank visible)
  // is left alone since expanding it would mean guessing a rank we can't
  // see - that's the candidate scorer's job against real legal moves.
  const pawnCapture = s.match(/^([a-h])([a-h])([1-8])$/);
  if (pawnCapture) {
    s = `${pawnCapture[1]}x${pawnCapture[2]}${pawnCapture[3]}`;
  }

  return s;
}

function normalizeCastling(s: string): string | null {
  const noSpace = s.replace(/\s+/g, '');
  if (/^[0oO]-[0oO]-[0oO]$/.test(noSpace)) return 'O-O-O';
  if (/^[0oO]-[0oO]$/.test(noSpace)) return 'O-O';
  if (/^[oO]{3}$/.test(noSpace)) return 'O-O-O';
  if (/^[oO]{2}$/.test(noSpace)) return 'O-O';
  return null;
}

function normalizePromotion(s: string): string {
  // e8=Q already canonical - leave it.
  if (/^[a-h]x?[a-h]?[1-8]=[QRBN]$/.test(s)) return s;
  // e8(Q) -> e8=Q
  let m = s.match(/^([a-h]x?[a-h]?[1-8])\(([QRBN])\)$/);
  if (m) return `${m[1]}=${m[2]}`;
  // e8/Q -> e8=Q
  m = s.match(/^([a-h]x?[a-h]?[1-8])\/([QRBN])$/);
  if (m) return `${m[1]}=${m[2]}`;
  // e8Q / exd8Q -> e8=Q / exd8=Q (bare promotion square + piece letter,
  // only for the promotion ranks 1/8 so we don't misfire on disambiguated
  // pieces like "Nbd2" - that's excluded already since it starts with a
  // piece letter, not a file).
  m = s.match(/^([a-h]x?[a-h]?)([18])([QRBN])$/);
  if (m) return `${m[1]}${m[2]}=${m[3]}`;
  return s;
}

/**
 * Generate positional-prior variants from the §4.3 confusion table. This is
 * intentionally conservative rather than combinatorial: it applies
 * substitutions at the specific positions the spec calls out (leading
 * piece-letter slot, trailing rank-digit slot, and a couple of
 * anywhere-safe single-character swaps) rather than trying every
 * substitution at every position, which would explode the candidate set
 * and reintroduce the noise §4.3 is trying to remove.
 */
function generateConfusionVariants(cleaned: string): string[] {
  const variants = new Set<string>();

  applyAtContext(cleaned, 'leading-piece', variants);
  applyAtContext(cleaned, 'trailing-digit', variants);
  applyAtContext(cleaned, 'any', variants);

  variants.delete(cleaned);
  return Array.from(variants);
}

function applyAtContext(
  token: string,
  context: SubstitutionContext,
  out: Set<string>,
): void {
  if (token.length === 0) return;

  if (context === 'leading-piece') {
    const first = token[0];
    for (const sub of CONFUSION_SUBSTITUTIONS) {
      if (sub.context !== 'leading-piece') continue;
      if (sub.from !== first) continue;
      out.add(sub.to + token.slice(1));
    }
    return;
  }

  if (context === 'trailing-digit') {
    const last = token[token.length - 1];
    if (last === undefined || !/[0-9a-zA-Z]/.test(last)) return;
    for (const sub of CONFUSION_SUBSTITUTIONS) {
      if (sub.context !== 'trailing-digit') continue;
      if (sub.from !== last) continue;
      const candidate = token.slice(0, -1) + sub.to;
      // Rank-constraint check (§4.3): a trailing rank digit must land in
      // 1-8. Reject rewrites that would produce something else in that
      // slot after substitution unless it's a further valid single digit.
      if (/^[1-8]$/.test(sub.to) || /[a-h1-8]/.test(sub.to)) {
        out.add(candidate);
      }
    }
    return;
  }

  // context === 'any': apply anywhere-safe single-char substitutions, one
  // position at a time (not combinatorially across multiple positions).
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    for (const sub of CONFUSION_SUBSTITUTIONS) {
      if (sub.context !== 'any') continue;
      if (sub.from !== ch) continue;
      out.add(token.slice(0, i) + sub.to + token.slice(i + 1));
    }
  }
}
