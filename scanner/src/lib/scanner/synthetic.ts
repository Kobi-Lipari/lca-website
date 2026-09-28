/**
 * Synthetic scan generation + seeded corruption. Spec: SCANNER_SPEC.md §5.8.
 *
 * "Build `corrupt(pgn, seed, profile)`: takes a real PGN, renders it into a
 * synthetic RawScan, then applies seeded corruption - character
 * substitutions drawn from §4.3, decoration add/strip, cell blanking,
 * struck cells, skipped move pairs, half-shifts - at configurable rates."
 *
 * Everything here is seeded and deterministic: the same (pgn, seed,
 * profile) always produces the same scan, so a metrics regression is a real
 * regression and not dice.
 */

import type { RawCell, RawScan } from './types';
import { CONFUSION_SUBSTITUTIONS } from './confusionMatrix';

export type ProfileName = 'clean' | 'typical' | 'timepressure';

export interface CorruptionProfile {
  /** chance a cell gets one confusion-table character substitution */
  charSubRate: number;
  /** chance a spurious check mark is added (§4.2: often wrongly added) */
  decorationAddRate: number;
  /** chance an existing check/mate mark is dropped (§4.2: often omitted) */
  decorationStripRate: number;
  /** chance the cell is written in an old-style notation variant (§4.2) */
  notationVariantRate: number;
  /** chance the cell is left blank */
  blankRate: number;
  /** chance the cell is marked struck (crossed out and rewritten) */
  struckRate: number;
  /** chance the vision confidence is downgraded */
  lowConfidenceRate: number;
  /** chance the cell carries an alts list */
  altRate: number;
  /** chance the whole game has a skipped move pair (§4.4) */
  skippedPairRate: number;
  /** chance the whole game has a half-shift (§4.4) */
  halfShiftRate: number;
  /** chance the player stopped recording near the end (§4.1) */
  tailCutoffRate: number;
  /** multiplier on per-cell corruption rates over the last 15 plies (§4.1) */
  tailDegradation: number;
}

export const PROFILES: Record<ProfileName, CorruptionProfile> = {
  clean: {
    charSubRate: 0,
    decorationAddRate: 0,
    decorationStripRate: 0,
    notationVariantRate: 0,
    blankRate: 0,
    struckRate: 0,
    lowConfidenceRate: 0,
    altRate: 0,
    skippedPairRate: 0,
    halfShiftRate: 0,
    tailCutoffRate: 0,
    tailDegradation: 1,
  },
  typical: {
    charSubRate: 0.06,
    decorationAddRate: 0.05,
    decorationStripRate: 0.35,
    notationVariantRate: 0.25,
    blankRate: 0.02,
    struckRate: 0.02,
    lowConfidenceRate: 0.12,
    altRate: 0.15,
    skippedPairRate: 0,
    halfShiftRate: 0,
    tailCutoffRate: 0.15,
    tailDegradation: 1.6,
  },
  timepressure: {
    charSubRate: 0.18,
    decorationAddRate: 0.08,
    decorationStripRate: 0.5,
    notationVariantRate: 0.3,
    blankRate: 0.08,
    struckRate: 0.05,
    lowConfidenceRate: 0.35,
    altRate: 0.3,
    skippedPairRate: 0.3,
    halfShiftRate: 0.2,
    tailCutoffRate: 0.5,
    tailDegradation: 2.5,
  },
};

export interface CorruptResult {
  scan: RawScan;
  /** the full ground-truth SAN list of the source game */
  truth: string[];
  /**
   * How many plies of `truth` are actually represented on the sheet. A
   * player who stops recording under 5 minutes (§4.1) produces a sheet
   * whose last cell is ply N < truth.length; scoring past N would punish
   * the decoder for something that is normal, not an error.
   */
  truthPlies: number;
  /** which structural corruptions were applied, for the metrics breakdown */
  applied: string[];
}

/** Deterministic PRNG (mulberry32) so a seed fully determines a scan. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Extract the SAN move list from a PGN. Hand-rolled rather than using
 * chess.js's loadPgn so the harness doesn't depend on library-specific PGN
 * quirks (and so it keeps working if the chess library is ever swapped for
 * the §2.1 chessops fallback).
 */
export function parsePgnMoves(pgn: string): { sans: string[]; result: string } {
  const body = pgn
    .replace(/\[[^\]]*\]/g, ' ') // header tags
    .replace(/\{[^}]*\}/g, ' ') // comments
    .replace(/;[^\n]*/g, ' ') // rest-of-line comments
    .replace(/\$\d+/g, ' ') // NAGs
    .replace(/\([^)]*\)/g, ' '); // variations

  const tokens = body.split(/\s+/).filter((t) => t !== '');
  const sans: string[] = [];
  let result = '*';

  for (const token of tokens) {
    if (/^\d+\.+$/.test(token)) continue; // "12." / "12..."
    const stripped = token.replace(/^\d+\.+/, '');
    if (stripped === '') continue;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(stripped)) {
      result = stripped;
      continue;
    }
    sans.push(stripped);
  }

  return { sans, result };
}

/** Render a clean, uncorrupted scan - the baseline before corruption. */
export function renderScan(sans: readonly string[], result: string): RawScan {
  const rows: RawScan['rows'] = [];
  for (let i = 0; i < sans.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: cell(sans[i]!),
      black: sans[i + 1] !== undefined ? cell(sans[i + 1]!) : null,
    });
  }
  return {
    header: { result, legibility: 'clear' },
    rows,
  };
}

function cell(raw: string): RawCell {
  return { raw, confidence: 'high' };
}

interface PlyCell {
  /** 1-based index into the ground-truth move list */
  ply: number;
  san: string;
}

export function corrupt(
  pgn: string,
  seed: number,
  profileName: ProfileName,
): CorruptResult {
  const profile = PROFILES[profileName];
  const rand = makeRng(seed);
  const { sans, result } = parsePgnMoves(pgn);

  let plyCells: PlyCell[] = sans.map((san, i) => ({ ply: i + 1, san }));
  const applied: string[] = [];

  // --- structural corruption (§4.4), applied to the cell sequence ---

  // Skipped move pair: the player forgets to write a whole move, so every
  // subsequent row shifts up by one full move.
  if (rand() < profile.skippedPairRate && plyCells.length > 20) {
    const at = 6 + Math.floor(rand() * (plyCells.length - 16));
    const start = at % 2 === 0 ? at : at + 1; // drop a White+Black pair
    plyCells = [...plyCells.slice(0, start), ...plyCells.slice(start + 2)];
    applied.push(`skipped-pair@${start + 1}`);
  }

  // Half-shift: one player's single move missing, so the White column
  // contains Black's moves thereafter.
  if (rand() < profile.halfShiftRate && plyCells.length > 20) {
    const at = 6 + Math.floor(rand() * (plyCells.length - 12));
    plyCells = [...plyCells.slice(0, at), ...plyCells.slice(at + 1)];
    applied.push(`half-shift@${at + 1}`);
  }

  // Player stopped recording near the end (§4.1) - normal, not an error.
  if (rand() < profile.tailCutoffRate && plyCells.length > 24) {
    const keep = plyCells.length - (2 + Math.floor(rand() * 12));
    plyCells = plyCells.slice(0, keep);
    applied.push(`tail-cutoff@${keep}`);
  }

  const truthPlies =
    plyCells.length === 0 ? 0 : Math.max(...plyCells.map((c) => c.ply));

  // --- per-cell corruption ---
  const totalCells = plyCells.length;
  const cells: Array<RawCell | null> = plyCells.map((pc, index) => {
    const inTail = index >= totalCells - 15;
    const boost = inTail ? profile.tailDegradation : 1;
    return corruptCell(pc.san, rand, profile, boost);
  });

  // --- lay cells back out into White/Black rows ---
  const rows: RawScan['rows'] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push({
      n: i / 2 + 1,
      white: cells[i] ?? null,
      black: i + 1 < cells.length ? (cells[i + 1] ?? null) : null,
    });
  }

  const sheetNotes: string[] = [];
  if (applied.some((a) => a.startsWith('tail-cutoff'))) {
    sheetNotes.push('score appears to stop before the end of the game');
  }

  return {
    scan: {
      header: {
        result,
        legibility: profileName === 'timepressure' ? 'partial' : 'clear',
      },
      rows,
      ...(sheetNotes.length > 0 ? { sheetNotes } : {}),
    },
    truth: sans,
    truthPlies,
    applied,
  };
}

function corruptCell(
  san: string,
  rand: () => number,
  profile: CorruptionProfile,
  boost: number,
): RawCell | null {
  if (rand() < profile.blankRate * boost) return null;

  let raw = san;

  // §4.2 notation variants a real player would write.
  if (rand() < profile.notationVariantRate) {
    raw = toNotationVariant(raw, rand);
  }

  // Check/mate decoration is routinely omitted, occasionally invented.
  if (/[+#]$/.test(raw) && rand() < profile.decorationStripRate) {
    raw = raw.replace(/[+#]+$/, '');
  } else if (!/[+#]$/.test(raw) && rand() < profile.decorationAddRate) {
    raw = raw + '+';
  }

  // §4.3 character confusion.
  if (rand() < profile.charSubRate * boost) {
    raw = substituteOneChar(raw, rand);
  }

  const confidence: RawCell['confidence'] =
    rand() < profile.lowConfidenceRate * boost
      ? rand() < 0.5
        ? 'low'
        : 'medium'
      : 'high';

  const out: RawCell = { raw, confidence };

  if (rand() < profile.altRate) {
    const alt = substituteOneChar(raw, rand);
    if (alt !== raw) out.alts = [alt];
  }

  if (rand() < profile.struckRate) {
    out.struck = true;
  }

  return out;
}

/** Rewrite a canonical SAN the way an old-school player might (§4.2). */
function toNotationVariant(san: string, rand: () => number): string {
  const variants: string[] = [];

  if (san.startsWith('O-O-O')) variants.push(san.replace('O-O-O', '0-0-0'));
  else if (san.startsWith('O-O')) variants.push(san.replace('O-O', '0-0'));

  // pawn capture exd5 -> ed5 (old habit) or e:d5
  const pawnCapture = san.match(/^([a-h])x([a-h][1-8])(.*)$/);
  if (pawnCapture) {
    variants.push(`${pawnCapture[1]}${pawnCapture[2]}${pawnCapture[3]}`);
    variants.push(`${pawnCapture[1]}:${pawnCapture[2]}${pawnCapture[3]}`);
  }

  // piece capture Nxf3 -> N:f3, or drop the x entirely
  const pieceCapture = san.match(/^([KQRBN][a-h1-8]?)x([a-h][1-8])(.*)$/);
  if (pieceCapture) {
    variants.push(`${pieceCapture[1]}:${pieceCapture[2]}${pieceCapture[3]}`);
    variants.push(`${pieceCapture[1]}${pieceCapture[2]}${pieceCapture[3]}`);
  }

  // promotion e8=Q -> e8Q / e8(Q) / e8/Q
  const promo = san.match(/^(.*[a-h][1-8])=([QRBN])(.*)$/);
  if (promo) {
    variants.push(`${promo[1]}${promo[2]}${promo[3]}`);
    variants.push(`${promo[1]}(${promo[2]})${promo[3]}`);
    variants.push(`${promo[1]}/${promo[2]}${promo[3]}`);
  }

  // knight as Kt
  if (san.startsWith('N')) variants.push('Kt' + san.slice(1));

  if (variants.length === 0) return san;
  return variants[Math.floor(rand() * variants.length)]!;
}

/**
 * Apply one character substitution drawn from the §4.3 confusion table -
 * the same table the decoder scores against, used in reverse. This is the
 * point of keeping that table in one file.
 */
function substituteOneChar(token: string, rand: () => number): string {
  const positions: Array<{ index: number; replacement: string }> = [];

  for (let i = 0; i < token.length; i++) {
    const ch = token[i]!;
    for (const sub of CONFUSION_SUBSTITUTIONS) {
      if (sub.to === ch) positions.push({ index: i, replacement: sub.from });
      if (sub.from === ch) positions.push({ index: i, replacement: sub.to });
    }
  }

  if (positions.length === 0) return token;
  const pick = positions[Math.floor(rand() * positions.length)]!;
  return token.slice(0, pick.index) + pick.replacement + token.slice(pick.index + 1);
}
