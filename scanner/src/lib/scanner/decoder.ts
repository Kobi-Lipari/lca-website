/**
 * The decoder. Spec: SCANNER_SPEC.md §5 (Week 1's centerpiece).
 *
 * Beam search over game states. State = (position as FEN, cell cursor,
 * accumulated moves, accumulated cost, structural bookkeeping). Advance
 * cell by cell (White then Black per row); at each cell generate candidate
 * interpretations, extend the beam, prune.
 *
 * This is the ONLY place chess knowledge is applied (§2.3's two-stage
 * contract). The vision model upstream transcribes verbatim and is never
 * allowed to correct.
 */

import type {
  DecodedGame,
  DecodedMove,
  DecodedMoveStatus,
  RawCell,
  RawScan,
} from './types';
import { rankCandidates, selectCandidates, type ScoredCandidate } from './candidates';
import { isResultToken } from './normalize';
import { createChessCache, type ChessCache } from './chessAdapter';

export interface DecodeOptions {
  /** §5.1: "Beam width: start at 12, make it a constant, tune in Week 2." */
  beamWidth: number;
  /** §5.3: keep candidates with cost <= threshold. */
  candidateThreshold: number;
  /** §5.4: flag below this confidence. Start 0.65. */
  confidenceFloor: number;
  /** Max candidate branches per cell (beam explosion guard). */
  branchesPerCell: number;
  /** §5.5 structural/alignment ops. Off = S3 happy path only. */
  structuralOps: boolean;
  /** How many alternatives to surface per move for the fix-up UI (§3.2). */
  maxAlternatives: number;
}

export const DEFAULT_DECODE_OPTIONS: DecodeOptions = {
  beamWidth: 12,
  candidateThreshold: 2.0,
  confidenceFloor: 0.65,
  branchesPerCell: 4,
  structuralOps: true,
  maxAlternatives: 5,
};

/** §5.5 op costs. */
const SKIP_CELL_COST = 1.5;
const INSERT_PLY_COST = 2.5;
/** §5.5: "require the next 3 cells to match with average cost < 1.0". */
const RESYNC_CELLS = 3;
const RESYNC_MAX_AVG_COST = 1.0;
/** §5.5: BLANK_PLY branches on the top-k legal moves by simple priors. */
const INSERT_PLY_TOP_K = 5;
/** A skipped move pair (§4.4) needs two inserted plies; that's the cap. */
const MAX_CONSECUTIVE_INSERTIONS = 2;
/** How many insertion hypotheses get the expensive lookahead evaluation. */
const LOOKAHEAD_CANDIDATES = 14;
/** Match cost above which a single inserted ply is worth trying. */
const INSERT_ONE_TRIGGER_COST = 1.0;
/** Match cost above which the (much pricier) two-ply insertion is tried. */
const INSERT_TWO_TRIGGER_COST = 1.8;

interface CellSlot {
  cell: RawCell | null;
  rowNumber: number;
  column: 'white' | 'black';
}

interface Beam {
  fen: string;
  slotIndex: number;
  moves: DecodedMove[];
  cost: number;
  /** cells still needed to prove re-synchronization after a structural op */
  resyncRemaining: number;
  resyncCosts: number[];
  /** square the previous move landed on, for the recapture prior */
  lastMoveTo: string | null;
  finishedResult: string | null;
  warnings: string[];
  /** rolling per-cell match costs, for the hopeless-beam check */
  recentCosts: number[];
  /** written cells skipped since the last move was placed */
  trailingSkips: number;
}

export function decodeScan(
  scan: RawScan,
  optionsOverride: Partial<DecodeOptions> = {},
): DecodedGame {
  const options: DecodeOptions = { ...DEFAULT_DECODE_OPTIONS, ...optionsOverride };
  const cache = createChessCache();

  const slots = flattenSlots(scan);

  // §5.7: descriptive notation is detected and bailed on, never decoded.
  if (detectDescriptive(slots)) {
    return {
      moves: [],
      result: normalizeResult(scan.header.result) ?? '*',
      warnings: [
        'This scoresheet appears to use descriptive notation (e.g. P-K4). ' +
          'Only algebraic notation is supported.',
      ],
      notation: 'descriptive',
    };
  }

  // §5.6: stop at the last non-blank cell. Trailing blanks with a recorded
  // result are normal (§4.1: players may stop recording under 5 minutes),
  // not an error, so they must not drive the beam into guessing.
  const lastUsed = lastNonBlankIndex(slots);
  const activeSlots = lastUsed === -1 ? [] : slots.slice(0, lastUsed + 1);

  let beams: Beam[] = [
    {
      fen: cache.startingFen(),
      slotIndex: 0,
      moves: [],
      cost: 0,
      resyncRemaining: 0,
      resyncCosts: [],
      lastMoveTo: null,
      finishedResult: null,
      warnings: [],
      recentCosts: [],
      trailingSkips: 0,
    },
  ];

  let truncatedAtPly: number | undefined;
  const warnings: string[] = [];

  while (beams.some((b) => b.slotIndex < activeSlots.length && !b.finishedResult)) {
    const next: Beam[] = [];

    for (const beam of beams) {
      if (beam.slotIndex >= activeSlots.length || beam.finishedResult) {
        next.push(beam);
        continue;
      }
      next.push(...expandBeam(beam, activeSlots, cache, options));
    }

    if (next.length === 0) {
      // §5.5: "If the beam still dies: truncate." Keep the best prefix we
      // had rather than inventing the rest - truncation is a feature (§1.2).
      const best = pickBest(beams);
      truncatedAtPly = best ? best.moves.length : 0;
      warnings.push(
        `Could not decode past move ${plyToMoveLabel(truncatedAtPly + 1)}; ` +
          `the remaining moves were left out.`,
      );
      beams = best ? [best] : [];
      break;
    }

    beams = prune(next, options.beamWidth);
  }

  const winner = pickBest(beams);
  if (!winner) {
    return {
      moves: [],
      result: normalizeResult(scan.header.result) ?? '*',
      warnings: [...warnings, 'No legal interpretation of this scoresheet was found.'],
      notation: 'unknown',
    };
  }

  const result =
    normalizeResult(winner.finishedResult) ??
    normalizeResult(scan.header.result) ??
    '*';

  // A beam that skipped its way through the last written cells reaches the
  // end without dying, so the loop above never calls it truncation. But it
  // is: the sheet has writing after the last move we placed, and a shorter
  // game with no warning reads as complete. Report it the same way.
  if (truncatedAtPly === undefined && winner.trailingSkips > 0) {
    truncatedAtPly = winner.moves.length;
    warnings.push(
      `Could not decode past move ${plyToMoveLabel(truncatedAtPly + 1)}; ` +
        `the remaining moves were left out.`,
    );
  }

  const moves = winner.moves.map((m) => applyConfidenceFloor(m, options.confidenceFloor));

  return {
    moves,
    result,
    ...(truncatedAtPly !== undefined ? { truncatedAtPly } : {}),
    warnings: [...warnings, ...winner.warnings],
    notation: 'algebraic',
  };
}

/* ------------------------------------------------------------------ */
/* Beam expansion                                                      */
/* ------------------------------------------------------------------ */

function expandBeam(
  beam: Beam,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
): Beam[] {
  const slot = slots[beam.slotIndex]!;
  const out: Beam[] = [];

  // A result token in a cell ends the game (§4.2, §5.6).
  if (slot.cell && isResultToken(slot.cell.raw)) {
    out.push({
      ...beam,
      slotIndex: slots.length,
      finishedResult: slot.cell.raw,
    });
    return out;
  }

  const legal = cache.legalSans(beam.fen);

  if (legal.length === 0) {
    // Checkmate/stalemate reached but cells continue - the sheet has more
    // written than the position allows. Stop here rather than guessing.
    return [{ ...beam, slotIndex: slots.length }];
  }

  if (slot.cell === null) {
    // Blank cell mid-game (§5.5 BLANK_PLY). The move was PLAYED but not
    // WRITTEN, so the only correct reading is to insert a ply.
    //
    // SKIP_CELL is deliberately NOT offered here. It used to be, and
    // because it is cheaper (1.5 vs 2.5) the decoder took it almost every
    // time - which drops a ply and shifts every later cell by one
    // half-move permanently. The damage is invisible in the cost function:
    // after the shift each cell still matches SOME legal move cheaply, so
    // the remainder of the game decodes as exact matches at ~0.95
    // confidence while being entirely wrong. Measured on the typical
    // profile, 85% of first divergences had a blank cell at or immediately
    // before them, and this is also why truncation never fired and flag
    // recall stalled around 50%: post-shift the decoder is not failing,
    // it is confidently decoding a different game.
    //
    // SKIP_CELL's actual job (§5.5) is a cell that CONTAINS writing which
    // isn't a move - noise, a duplicate, a stray mark. A blank cell is not
    // that. Trailing blanks are already handled by the §5.6 termination
    // scan before the search starts, so reaching here means written cells
    // follow and a ply genuinely belongs in this slot.
    if (options.structuralOps) {
      const nextWritten = nextWrittenCell(slots, beam.slotIndex + 1);
      out.push(
        ...insertGuessedPlies(beam, 1, cache, options, slot, true, nextWritten),
      );
    } else {
      out.push(skipCell(beam));
    }
    return out;
  }

  // --- MATCH: the normal path ---
  const ranked = rankCandidates(legal, slot.cell);
  const { candidates } = selectCandidates(ranked, options.candidateThreshold);
  const branches = candidates.slice(0, options.branchesPerCell);

  for (const candidate of branches) {
    out.push(
      extendWithMatch(beam, slot, candidate, ranked, cache, options, 0),
    );
  }

  if (options.structuralOps) {
    // --- SKIP_CELL: this cell is noise or a duplicate (§4.4, §5.5) ---
    out.push(skipCell(beam));

    // --- INSERT_PLY then match (§5.5) ---
    // Only fires when the plain match is poor, per §5.5's "only when the
    // beam would otherwise die". A cheap match means alignment is fine and
    // inserting would just corrupt it.
    const bestMatchCost = ranked[0]?.cost ?? Infinity;
    if (bestMatchCost > INSERT_ONE_TRIGGER_COST) {
      out.push(
        ...insertGuessedPlies(beam, 1, cache, options, slot, false, slot.cell),
      );
    }
    if (bestMatchCost > INSERT_TWO_TRIGGER_COST) {
      out.push(
        ...insertGuessedPlies(
          beam,
          MAX_CONSECUTIVE_INSERTIONS,
          cache,
          options,
          slot,
          false,
          slot.cell,
        ),
      );
    }
  }

  return out.filter((b): b is Beam => b !== null);
}

function extendWithMatch(
  beam: Beam,
  slot: CellSlot,
  candidate: ScoredCandidate,
  ranked: readonly ScoredCandidate[],
  cache: ChessCache,
  options: DecodeOptions,
  extraCost: number,
): Beam {
  const secondBest = ranked.find((c) => c.san !== candidate.san)?.cost;
  const confidence = computeConfidence(
    candidate.cost,
    secondBest,
    slot.cell?.confidence ?? 'medium',
  );

  const status: DecodedMoveStatus = candidate.cost === 0 ? 'matched' : 'corrected';

  const move: DecodedMove = {
    ply: beam.moves.length + 1,
    san: candidate.san,
    sourceRaw: slot.cell?.raw ?? null,
    confidence,
    status,
    alternatives: ranked
      .slice(0, options.maxAlternatives)
      .map((c) => ({ san: c.san, score: costToScore(c.cost) })),
    fenBefore: beam.fen,
  };

  const nextFen = cache.applyMove(beam.fen, candidate.san);

  // §5.5 re-synchronization check after a structural op.
  const resyncCosts =
    beam.resyncRemaining > 0 ? [...beam.resyncCosts, candidate.cost] : beam.resyncCosts;
  const resyncRemaining = Math.max(0, beam.resyncRemaining - 1);

  return {
    fen: nextFen,
    slotIndex: beam.slotIndex + 1,
    moves: [...beam.moves, move],
    trailingSkips: 0,
    cost: beam.cost + candidate.cost + extraCost,
    resyncRemaining,
    resyncCosts: resyncRemaining === 0 ? [] : resyncCosts,
    lastMoveTo: squareOf(candidate.san),
    finishedResult: null,
    warnings: beam.warnings,
    recentCosts: [...beam.recentCosts, candidate.cost].slice(-HOPELESS_WINDOW),
    // resync verdict applied by the pruner below
    ...(resyncRemaining === 0 && resyncCosts.length >= RESYNC_CELLS
      ? { resyncFailed: averageOf(resyncCosts) >= RESYNC_MAX_AVG_COST }
      : {}),
  } as Beam & { resyncFailed?: boolean };
}

function skipCell(beam: Beam): Beam {
  return {
    ...beam,
    slotIndex: beam.slotIndex + 1,
    trailingSkips: beam.trailingSkips + 1,
    cost: beam.cost + SKIP_CELL_COST,
    resyncRemaining: RESYNC_CELLS,
    resyncCosts: [],
    recentCosts: [...beam.recentCosts, SKIP_CELL_COST].slice(-HOPELESS_WINDOW),
  };
}

/**
 * §5.5 BLANK_PLY: consume a ply with an inserted hypothesis move, branching
 * only on the top-k legal moves ranked by simple priors (recaptures >
 * checks > captures > others). Marked `guessed`, always low confidence,
 * always surfaced flagged.
 *
 * `n` inserted plies covers the §4.4 structural errors: 1 = half-shift
 * (one player's move missing), 2 = skipped move pair.
 *
 * Note on SHIFT (§5.5's third op): in this flattened White/Black cell
 * stream, a half-shift IS a single inserted ply - once one ply is
 * inserted, every subsequent cell is read against the other side's turn
 * automatically, and it stays that way. Implementing a separate SHIFT op
 * would be a second spelling of the same state change, so it's folded in
 * here. Logged in STATUS.md.
 */
function insertGuessedPlies(
  beam: Beam,
  n: number,
  cache: ChessCache,
  options: DecodeOptions,
  slot: CellSlot,
  consumesCell: boolean,
  lookaheadCell: RawCell | null,
): Beam[] {
  let frontier: Beam[] = [beam];

  for (let i = 0; i < n; i++) {
    const grown: Beam[] = [];
    const isFinalInsertion = i === n - 1;
    for (const state of frontier) {
      const legal = cache.legalSans(state.fen);
      if (legal.length === 0) continue;
      // On the LAST inserted ply, rank hypotheses by how well they let the
      // next written cell be read, not by generic priors. A blank cell has
      // ~35 legal fillers and the §5.5 priors (recapture/check/capture)
      // pick the true move roughly at chance, which then poisons every
      // move downstream. What the *next* cell says is far more
      // constraining: only a handful of insertions leave a position in
      // which the next transcription is cheap to match. This is the same
      // lookahead idea §5.5 already relies on for re-synchronization,
      // applied one step earlier - to choosing the hypothesis rather than
      // only to validating it.
      const ranked =
        isFinalInsertion && lookaheadCell
          ? rankLegalByLookahead(state.fen, lookaheadCell, cache, state.lastMoveTo)
          : rankLegalByPriors(state.fen, state.lastMoveTo, cache);
      for (const san of ranked.slice(0, INSERT_PLY_TOP_K)) {
        const move: DecodedMove = {
          ply: state.moves.length + 1,
          san,
          sourceRaw: null,
          confidence: 0.15,
          status: 'guessed',
          alternatives: ranked
            .slice(0, options.maxAlternatives)
            .map((s, idx) => ({ san: s, score: 1 / (idx + 2) })),
          fenBefore: state.fen,
        };
        grown.push({
          ...state,
          fen: cache.applyMove(state.fen, san),
          moves: [...state.moves, move],
          trailingSkips: 0,
          cost: state.cost + INSERT_PLY_COST,
          lastMoveTo: squareOf(san),
          resyncRemaining: RESYNC_CELLS,
          resyncCosts: [],
          warnings: state.warnings,
        });
      }
    }
    // Keep the insertion frontier narrow or two insertions explode to 25.
    frontier = grown.slice(0, INSERT_PLY_TOP_K);
  }

  if (!consumesCell) {
    // Now match the actual cell against the post-insertion position.
    const matched: Beam[] = [];
    for (const state of frontier) {
      if (!slot.cell) continue;
      const legal = cache.legalSans(state.fen);
      if (legal.length === 0) continue;
      const ranked = rankCandidates(legal, slot.cell);
      const best = ranked[0];
      if (!best) continue;
      matched.push(extendWithMatch(state, slot, best, ranked, cache, options, 0));
    }
    return matched;
  }

  // Blank cell: the inserted ply IS this cell's move, so consume the cell.
  return frontier.map((state) => ({ ...state, slotIndex: state.slotIndex + 1 }));
}

/**
 * §5.5 priors for guessed moves: recaptures > checks > captures > others.
 * Deliberately simple - these are only used to pick which hypotheses to
 * branch on, and the re-synchronization test is what actually decides
 * whether a branch survives.
 */
/**
 * Rank candidate inserted plies by how cheaply the NEXT written cell can be
 * read in the position each one produces, with the §5.5 priors as the
 * tiebreak. See the call site for why this beats priors alone.
 */
function rankLegalByLookahead(
  fen: string,
  nextCell: RawCell,
  cache: ChessCache,
  lastMoveTo: string | null,
): string[] {
  const priorRank = new Map(
    rankLegalByPriors(fen, lastMoveTo, cache).map((san, i) => [san, i]),
  );

  // Only the most plausible insertions get the (expensive) lookahead
  // evaluation; each one costs a full move generation in the resulting
  // position. LOOKAHEAD_CANDIDATES is the measured knee - wider barely
  // changed accuracy and multiplied decode time.
  const shortlist = rankLegalByPriors(fen, lastMoveTo, cache).slice(
    0,
    LOOKAHEAD_CANDIDATES,
  );

  const scored = shortlist.map((san) => {
    const nextFen = cache.applyMove(fen, san);
    const nextLegal = cache.legalSans(nextFen);
    const best = nextLegal.length === 0
      ? Infinity
      : (rankCandidates(nextLegal, nextCell)[0]?.cost ?? Infinity);
    return { san, lookahead: best, prior: priorRank.get(san) ?? 999 };
  });

  scored.sort(
    (a, b) => a.lookahead - b.lookahead || a.prior - b.prior,
  );
  return scored.map((s) => s.san);
}

function rankLegalByPriors(
  fen: string,
  lastMoveTo: string | null,
  cache: ChessCache,
): string[] {
  const moves = cache.legalInfo(fen);
  const scored = moves.map((m) => {
    let priority = 0;
    if (m.captured && lastMoveTo && m.to === lastMoveTo) priority = 3; // recapture
    else if (m.san.includes('+') || m.san.includes('#')) priority = 2; // check
    else if (m.captured) priority = 1; // capture
    return { san: m.san, priority };
  });
  scored.sort((a, b) => b.priority - a.priority || a.san.localeCompare(b.san));
  return scored.map((s) => s.san);
}

function prune(beams: Beam[], beamWidth: number): Beam[] {
  // Drop branches that took a structural op and then failed to re-sync
  // (§5.5: "require the next 3 cells to match with average cost < 1.0,
  // else prune that branch"). This is a HARD prune with no fallback: an
  // earlier version kept the failed branches whenever every branch failed,
  // which meant the re-sync test could never actually kill anything and
  // the decoder never truncated - it just emitted confidently wrong moves
  // forever. Per §1.2 and §5.5, truncating is the designed answer, so if
  // everything fails re-sync the beam is allowed to die.
  const pool = beams.filter(
    (b) =>
      !(b as Beam & { resyncFailed?: boolean }).resyncFailed &&
      !isHopeless(b),
  );

  // Deduplicate identical (position, cursor) states, keeping the cheapest.
  const seen = new Map<string, Beam>();
  for (const beam of pool) {
    const key = `${beam.fen}|${beam.slotIndex}|${beam.moves.length}`;
    const existing = seen.get(key);
    if (!existing || beam.cost < existing.cost) seen.set(key, beam);
  }

  return Array.from(seen.values())
    .sort((a, b) => a.cost - b.cost)
    .slice(0, beamWidth);
}

/**
 * A beam that has been paying near-threshold cost for several cells in a
 * row is not decoding the sheet any more - it is fitting noise. Letting it
 * die is what turns "confidently wrong output" into "honest truncation"
 * (§1.2: flagging honestly beats guessing confidently; §5.5: truncation is
 * a feature, not a failure).
 */
const HOPELESS_WINDOW = 6;
const HOPELESS_AVG_COST = 1.6;

function isHopeless(beam: Beam): boolean {
  const recent = beam.recentCosts;
  if (recent.length < HOPELESS_WINDOW) return false;
  const window = recent.slice(-HOPELESS_WINDOW);
  return averageOf(window) > HOPELESS_AVG_COST;
}

function pickBest(beams: readonly Beam[]): Beam | null {
  if (beams.length === 0) return null;
  return [...beams].sort((a, b) => a.cost - b.cost)[0]!;
}

/* ------------------------------------------------------------------ */
/* Confidence (§5.4)                                                   */
/* ------------------------------------------------------------------ */

/** Tunable in Week 2 against labeled data - see §5.4. */
export const CONFIDENCE_PARAMS = {
  marginCenter: 0.6,
  marginSharpness: 2.5,
  absoluteCostScale: 1.5,
  visionFactor: { high: 1.0, medium: 0.88, low: 0.7 } as const,
  /** margin used when there is only one candidate at all */
  soleCandidateMargin: 2.0,
  /**
   * Added to the margin when the transcription was an EXACT legal SAN
   * (cost 0, i.e. §3.2's `matched`).
   *
   * Why this exists: without it, margin alone decided confidence, and the
   * §4.3 file-letter confusions (c<->e 0.4, a<->d 0.5, b<->h 0.5) put a
   * legal decoy within half a unit of almost every pawn move - so a
   * perfectly clear "e4" scored margin 0.4 against the legal "c4" and got
   * flagged. Measured on the clean profile that was a 15.9% false-flag
   * rate on sheets with nothing wrong with them, which would train users
   * to ignore flags entirely - the exact failure §5.4's flag-recall goal
   * is trying to buy trust against.
   *
   * The fix is principled rather than a fudge: §3.2 already distinguishes
   * `matched` from `corrected` precisely because an exact reading is
   * stronger evidence than a fuzzy one. The absolute-cost term is a
   * multiplier capped at 1, so it can only ever penalize; exactness had no
   * way to *raise* confidence. This gives it one.
   */
  exactMatchMarginBonus: 0.8,
};

/**
 * §5.4: "softmax-style margin between best and second-best candidate cost,
 * scaled by the cell's vision confidence" - plus an absolute-cost penalty,
 * because a large margin between two *bad* readings should not read as
 * confident. §5.4's stated goal is flag recall over flag precision.
 */
export function computeConfidence(
  bestCost: number,
  secondBestCost: number | undefined,
  visionConfidence: 'high' | 'medium' | 'low',
): number {
  const rawMargin =
    secondBestCost === undefined
      ? CONFIDENCE_PARAMS.soleCandidateMargin
      : secondBestCost - bestCost;

  const margin =
    bestCost === 0
      ? rawMargin + CONFIDENCE_PARAMS.exactMatchMarginBonus
      : rawMargin;

  const marginTerm =
    1 /
    (1 +
      Math.exp(
        -CONFIDENCE_PARAMS.marginSharpness *
          (margin - CONFIDENCE_PARAMS.marginCenter),
      ));

  const absoluteTerm = Math.exp(-bestCost / CONFIDENCE_PARAMS.absoluteCostScale);
  const vision = CONFIDENCE_PARAMS.visionFactor[visionConfidence];

  return clamp01(marginTerm * absoluteTerm * vision);
}

function applyConfidenceFloor(move: DecodedMove, floor: number): DecodedMove {
  if (move.status === 'guessed') return move; // already always shown flagged
  if (move.confidence < floor) return { ...move, status: 'flagged' };
  return move;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function flattenSlots(scan: RawScan): CellSlot[] {
  const slots: CellSlot[] = [];
  const rows = [...scan.rows].sort((a, b) => a.n - b.n);
  for (const row of rows) {
    slots.push({ cell: row.white, rowNumber: row.n, column: 'white' });
    slots.push({ cell: row.black, rowNumber: row.n, column: 'black' });
  }
  return slots;
}

/** The next cell that actually has writing in it, for insertion lookahead. */
function nextWrittenCell(
  slots: readonly CellSlot[],
  from: number,
): RawCell | null {
  for (let i = from; i < slots.length; i++) {
    const cell = slots[i]!.cell;
    if (cell && !isResultToken(cell.raw)) return cell;
  }
  return null;
}

function lastNonBlankIndex(slots: readonly CellSlot[]): number {
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i]!.cell !== null) return i;
  }
  return -1;
}

/**
 * §5.7: if >25% of non-blank cells match descriptive patterns (P-K4,
 * N-KB3, PxP, B-N5), the sheet is descriptive notation. Bail with a
 * friendly message; do not attempt to decode it in v1.
 */
const DESCRIPTIVE_PATTERN = /^(K|Q|R|B|N|P|Kt)[-x](K|Q|R|B|N|P|Kt)?[KQ]?[RBN]?[1-8]?$/;

export function detectDescriptive(slots: readonly CellSlot[]): boolean {
  const nonBlank = slots.filter((s) => s.cell !== null);
  if (nonBlank.length === 0) return false;
  const hits = nonBlank.filter((s) =>
    DESCRIPTIVE_PATTERN.test(s.cell!.raw.trim()),
  ).length;
  return hits / nonBlank.length > 0.25;
}

export function normalizeResult(
  raw: string | null | undefined,
): DecodedGame['result'] | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s === '1-0') return '1-0';
  if (s === '0-1') return '0-1';
  if (
    s === '1/2-1/2' ||
    s === '1/2' ||
    s === '½-½' ||
    s === '½' ||
    s === 'draw'
  ) {
    return '1/2-1/2';
  }
  return null;
}

/** Square a SAN move lands on, for the recapture prior. */
function squareOf(san: string): string | null {
  const m = san.replace(/[+#]$/, '').match(/([a-h][1-8])(?:=[QRBN])?$/);
  return m ? m[1]! : null;
}

function costToScore(cost: number): number {
  return Math.exp(-cost);
}

function averageOf(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function plyToMoveLabel(ply: number): number {
  return Math.ceil(ply / 2);
}
