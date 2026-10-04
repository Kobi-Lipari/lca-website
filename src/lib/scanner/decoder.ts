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
  DecodedGap,
  DecodedMove,
  DecodedMoveStatus,
  RawCell,
  RawScan,
} from './types';
import { rankCandidates, selectCandidates, type ScoredCandidate } from './candidates';
import { cleanToken, isResultToken, stripCheckMateDecoration } from './normalize';
import { createChessCache, type ChessCache } from './chessAdapter';
import {
  buildGapContext,
  findBlankFills,
  findBlankRevisions,
  findGapPlans,
  looksLikeMove,
  UNREADABLE_COST,
  type GapContext,
  type GapPlan,
} from './gaps';

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
  /**
   * Moves the member has settled, from the start of the game: forcedSans[i]
   * must be ply i+1. The search still aligns the sheet around them (a
   * forced move can match its cell, or be an inserted ply for a cell left
   * blank), it just may not choose anything else. Used by the fix-up UI:
   * correct one move and everything after it is decoded again.
   */
  forcedSans?: readonly string[];
}

export const DEFAULT_DECODE_OPTIONS: DecodeOptions = {
  beamWidth: 12,
  candidateThreshold: 2.0,
  confidenceFloor: 0.65,
  branchesPerCell: 4,
  structuralOps: true,
  maxAlternatives: 5,
};

/** The move the member has fixed for the next ply of this beam, if any. */
function forcedNext(beam: Beam, options: DecodeOptions): string | undefined {
  return options.forcedSans?.[beam.moves.length];
}

/** Whether a beam's moves agree with every forced move it has reached. */
function honoursForced(beam: Beam, options: DecodeOptions): boolean {
  const forced = options.forcedSans;
  if (!forced) return true;
  const upTo = Math.min(forced.length, beam.moves.length);
  for (let i = 0; i < upTo; i++) {
    if (beam.moves[i]!.san !== forced[i]) return false;
  }
  return true;
}

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

const COST_EPSILON = 1e-9;

/**
 * Unwritten moves found by gaps.ts (§4.4). Unlike the blind insertions
 * above, these are only offered after the following cells were replayed and
 * read exactly, so each is priced as one slip of the pen (§5.5 puts SHIFT
 * at ~3), not as two independent guesses. A skipped move pair is one slip.
 */
const GAP_SINGLE_COST = 2.5;
const GAP_PAIR_COST = 2.0;
/** Only beams this close to the best one are probed. */
const GAP_BEAM_SLACK = 0.5;
const GAP_PROBES_PER_CELL = 2;
/**
 * Cap on the search work per decode (move applications and legality
 * checks), so a sheet full of unreadable cells cannot make the page hang.
 */
const GAP_WORK_BUDGET = 4000;
/**
 * A gap costs its whole price at once, while the reading it competes with
 * pays for its mistakes a cell at a time, so on cost alone the gap would be
 * pruned before the evidence is in. This many gap hypotheses are carried
 * outside the beam width until the end, where total cost decides.
 */
const GAP_GUARDED_BEAMS = 2;

/** An expansion whose cost is known to be at least minCost, computed only if
 *  that could still survive the prune. See the main loop. */
interface DeferredExpansion {
  minCost: number;
  run: () => Beam[];
}

function isDeferred(part: Beam | DeferredExpansion): part is DeferredExpansion {
  return 'run' in part;
}

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
  /** how many cells just before the cursor were each read as one move */
  exactRun: number;
  /** descends from a gap hypothesis; see GAP_GUARDED_BEAMS */
  guarded: boolean;
  gaps: readonly DecodedGap[];
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
      exactRun: 0,
      guarded: false,
      gaps: [],
    },
  ];

  const gapContext = options.structuralOps
    ? buildGapContext(
        activeSlots.map((s) => s.cell),
        cache,
        options.forcedSans,
        GAP_WORK_BUDGET,
      )
    : null;

  let truncatedAtPly: number | undefined;
  const warnings: string[] = [];

  while (beams.some((b) => b.slotIndex < activeSlots.length && !b.finishedResult)) {
    // Each beam's cheap expansions, then its deferred ones, in the order
    // they were produced. Order matters: prune() breaks cost ties by
    // position, so keeping it is what makes the deferral below exact.
    const parts: Array<Beam | DeferredExpansion> = [];
    /** beams whose current cell has no clean legal reading */
    const unreadable: Beam[] = [];
    /** beams whose current cell is blank */
    const atBlank: Beam[] = [];
    let cheapestLive = Infinity;

    for (const beam of beams) {
      if (beam.slotIndex >= activeSlots.length || beam.finishedResult) {
        parts.push(beam);
        continue;
      }
      if (beam.cost < cheapestLive) cheapestLive = beam.cost;
      const deferred: DeferredExpansion[] = [];
      parts.push(
        ...expandBeam(beam, activeSlots, cache, options, deferred, unreadable, atBlank),
      );
      parts.push(...deferred);
    }

    // Inserted-ply hypotheses are by far the most expensive expansions (a
    // lookahead move generation per candidate), and most of them come from
    // beams already too far behind to survive this step's prune. Price the
    // cheap expansions first, then run an insertion only if its lower-bound
    // cost could still make the cut. Adding beams can only lower the cut,
    // never raise it, so anything skipped here costs strictly more than
    // whatever finally makes the cut and would have been pruned anyway. The
    // result is identical, computed with far less work.
    // Every expansion already respects forced moves by construction; this
    // is the backstop, applied before the cut so the cut is computed only
    // from beams that can actually survive.
    const cheap = parts.filter((p): p is Beam => !isDeferred(p) && honoursForced(p, options));
    const provisional = prune(cheap, options.beamWidth);
    const cut =
      provisional.length < options.beamWidth
        ? Infinity
        : provisional[options.beamWidth - 1]!.cost;

    const next: Beam[] = [];
    for (const part of parts) {
      if (!isDeferred(part)) {
        if (honoursForced(part, options)) next.push(part);
      }
      // The tolerance covers floating-point drift: minCost adds the insertion
      // cost in one step, the real beam adds it ply by ply, and exact ties
      // at the cut are common because costs are sums of the same constants.
      else if (part.minCost - COST_EPSILON <= cut) {
        next.push(...part.run().filter((b) => honoursForced(b, options)));
      }
    }

    // §4.4: where a cell has no clean reading, ask whether unwritten moves
    // at or before it would make the sheet read exactly (gaps.ts). What
    // comes back joins the beam as one more hypothesis, ahead of equal-cost
    // rivals so that a verified gap is preferred to a blind insertion that
    // happens to reach the same position.
    // Only when the best reading so far is itself stuck on this cell, and no
    // gap hypothesis already in the beam reads it: otherwise the search
    // would run on every beam that took a wrong turn earlier.
    if (
      gapContext &&
      unreadable.length > 0 &&
      unreadable[0]!.cost <= cheapestLive &&
      !beams.some((b) => b.guarded && isLive(b, activeSlots) && !unreadable.includes(b))
    ) {
      let probes = 0;
      for (const beam of unreadable) {
        if (probes >= GAP_PROBES_PER_CELL) break;
        if (gapContext.work.ops > gapContext.work.budget) break;
        if (beam.cost > cheapestLive + GAP_BEAM_SLACK) continue;
        if (!looksLikeMove(gapContext, beam.slotIndex)) continue;
        probes++;
        const found = probeForGap(beam, activeSlots, cache, options, gapContext).filter(
          (b) => honoursForced(b, options),
        );
        next.unshift(...found);
      }
    }

    // A blank cell is an unwritten move whose place is known. The ordinary
    // guess for it looks one cell ahead; when a cell further on is only
    // legal after one particular move, offer that move as well.
    if (gapContext) {
      let fills = 0;
      for (const beam of atBlank) {
        if (fills >= GAP_PROBES_PER_CELL) break;
        if (gapContext.work.ops > gapContext.work.budget) break;
        if (beam.cost > cheapestLive + GAP_BEAM_SLACK) continue;
        fills++;
        next.unshift(
          ...fillBlank(beam, activeSlots, cache, options, gapContext).filter((b) =>
            honoursForced(b, options),
          ),
        );
      }
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
    ...(winner.gaps.length > 0 ? { gaps: [...winner.gaps] } : {}),
  };
}

/**
 * What each matched move cost, kept beside the move rather than on it so
 * the decoder's output is unchanged. A gap placed before a cell hands back
 * what the cells after it were charged: with the gap in place they are
 * replayed and read exactly.
 */
const MATCH_COST = new WeakMap<DecodedMove, number>();
/**
 * Guesses that stand in a blank cell (the place is known, the move is not),
 * with the index of that cell. The cursor alone does not give it back: a
 * cell skipped after the blank moves the cursor on without adding a move.
 */
const BLANK_FILL = new WeakMap<DecodedMove, number>();

function isLive(beam: Beam, slots: readonly CellSlot[]): boolean {
  return beam.slotIndex < slots.length && !beam.finishedResult;
}

/* ------------------------------------------------------------------ */
/* Beam expansion                                                      */
/* ------------------------------------------------------------------ */

function expandBeam(
  beam: Beam,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
  deferred: DeferredExpansion[],
  unreadable: Beam[],
  atBlank: Beam[],
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
      atBlank.push(beam);
      const nextWritten = nextWrittenCell(slots, beam.slotIndex + 1);
      deferred.push({
        minCost: beam.cost + INSERT_PLY_COST,
        run: () => insertGuessedPlies(beam, 1, cache, options, slot, true, nextWritten),
      });
    } else {
      out.push(skipCell(beam));
    }
    return out;
  }

  // --- MATCH: the normal path ---
  const ranked = rankCandidates(legal, slot.cell);
  const { candidates } = selectCandidates(ranked, options.candidateThreshold);
  const forced = forcedNext(beam, options);
  const branches = forced
    ? ranked.filter((c) => c.san === forced)
    : candidates.slice(0, options.branchesPerCell);

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
    const cell = slot.cell;
    // A forced move that does not fit its cell is the same symptom: the
    // member has said what was played, and the cell says something else.
    const readCost = forced ? (branches[0]?.cost ?? Infinity) : bestMatchCost;
    if (readCost >= UNREADABLE_COST || capturesNothing(cell, ranked[0])) {
      unreadable.push(beam);
    }
    if (bestMatchCost > INSERT_ONE_TRIGGER_COST) {
      deferred.push({
        minCost: beam.cost + INSERT_PLY_COST,
        run: () => insertGuessedPlies(beam, 1, cache, options, slot, false, cell),
      });
    }
    if (bestMatchCost > INSERT_TWO_TRIGGER_COST) {
      deferred.push({
        minCost: beam.cost + MAX_CONSECUTIVE_INSERTIONS * INSERT_PLY_COST,
        run: () =>
          insertGuessedPlies(
            beam,
            MAX_CONSECUTIVE_INSERTIONS,
            cache,
            options,
            slot,
            false,
            cell,
          ),
      });
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

  MATCH_COST.set(move, candidate.cost);
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
    exactRun: beam.exactRun + 1,
    guarded: beam.guarded,
    gaps: beam.gaps,
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

/**
 * The cell is written as a capture, and the only thing wrong with it is
 * that there is nothing on that square to take. Dropping an 'x' is a
 * habit (§4.2) and cheap; writing one for a capture that never happened is
 * not, and it is exactly what a move pair missing earlier looks like when
 * the missing reply put a piece there.
 */
function capturesNothing(cell: RawCell, best: ScoredCandidate | undefined): boolean {
  if (!best || best.cost === 0 || !cell.raw.includes('x')) return false;
  const written = cleanToken(cell.raw);
  return written.includes('x') && written.replace('x', '') === stripCheckMateDecoration(best.san);
}

function skipCell(beam: Beam): Beam {
  return {
    ...beam,
    slotIndex: beam.slotIndex + 1,
    trailingSkips: beam.trailingSkips + 1,
    exactRun: 0,
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
      const forced = forcedNext(state, options);
      const ranked = forced
        ? (legal.includes(forced) ? [forced] : [])
        : isFinalInsertion && lookaheadCell
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
        if (consumesCell) BLANK_FILL.set(move, state.slotIndex);
        grown.push({
          ...state,
          fen: cache.applyMove(state.fen, san),
          moves: [...state.moves, move],
          trailingSkips: 0,
          exactRun: 0,
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
      const forced = forcedNext(state, options);
      const best = forced ? ranked.find((c) => c.san === forced) : ranked[0];
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
  // Everything these priors need is in the SAN itself: 'x' marks a capture
  // (en passant included), '+'/'#' a check, and the destination is the last
  // square named. Reading it from the string avoids chess.js's verbose move
  // list, which costs ~16x the plain one.
  const scored = cache.legalSans(fen).map((san) => {
    const captures = san.includes('x');
    let priority = 0;
    if (captures && lastMoveTo && squareOf(san) === lastMoveTo) priority = 3; // recapture
    else if (san.includes('+') || san.includes('#')) priority = 2; // check
    else if (captures) priority = 1; // capture
    return { san, priority };
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

  // Deduplicate identical (position, cursor) states, keeping the cheapest
  // (the earlier one on a tie).
  const seen = new Map<string, { beam: Beam; index: number }>();
  pool.forEach((beam, index) => {
    const key = `${beam.fen}|${beam.slotIndex}|${beam.moves.length}`;
    const existing = seen.get(key);
    if (!existing || beam.cost < existing.beam.cost) seen.set(key, { beam, index });
  });

  // Equal costs are ordered by each survivor's own position in the pool.
  // (Previously a replaced entry inherited the Map slot of the beam it
  // replaced, so a beam that was about to be discarded could still decide
  // a tie between two others. That made the result depend on beams that
  // cannot survive, which the deferred-insertion cut in decodeScan relies
  // on NOT happening.)
  const ranked = Array.from(seen.values())
    .sort((a, b) => a.beam.cost - b.beam.cost || a.index - b.index)
    .map((entry) => entry.beam);
  const kept = ranked.slice(0, beamWidth);
  // Gap hypotheses that missed the cut ride along (see GAP_GUARDED_BEAMS).
  // With none in play this is exactly the plain top-beamWidth cut.
  let extras = 0;
  for (let i = beamWidth; i < ranked.length && extras < GAP_GUARDED_BEAMS; i++) {
    if (ranked[i]!.guarded) {
      kept.push(ranked[i]!);
      extras++;
    }
  }
  return kept;
}

/* ------------------------------------------------------------------ */
/* Unwritten moves (§4.4)                                              */
/* ------------------------------------------------------------------ */

/**
 * Turn the gap plans for this beam's current cell into beams that have
 * consumed that cell, like every other expansion in the same step.
 */
function probeForGap(
  beam: Beam,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
  context: GapContext,
): Beam[] {
  const back = beam.exactRun;
  const recent = beam.moves.slice(beam.moves.length - back);

  // If the cells read so far follow a guess in a blank cell, the likeliest
  // thing wrong is that guess. Try another move there first. A revision
  // that reads the cells in between no worse settles it; one that reads
  // them worse is offered beside the gap plans and pays for it.
  const revised = reviseBlank(beam, slots, cache, options, context);
  if (revised.some((r) => r.clean)) return revised.map((r) => r.beam);

  const plans = findGapPlans(context, {
    fen: beam.fen,
    slot: beam.slotIndex,
    ply: beam.moves.length,
    history: recent.map((m) => m.fenBefore),
    historyCosts: recent.map((m) => MATCH_COST.get(m) ?? 0),
  });
  const out: Beam[] = revised.map((r) => r.beam);
  for (const plan of plans) {
    const built = applyGapPlan(beam, plan, slots, cache, options);
    if (built) out.push(built);
  }
  return out;
}

function reviseBlank(
  beam: Beam,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
  context: GapContext,
): Array<{ beam: Beam; clean: boolean }> {
  const guessIndex = beam.moves.length - beam.exactRun - 1;
  const guess = beam.moves[guessIndex];
  const blankSlot = guess ? BLANK_FILL.get(guess) : undefined;
  if (!guess || blankSlot === undefined) return [];
  // Only when every cell since the blank was read as one move. If one was
  // skipped, the cells and the moves no longer pair off and there is no
  // line of play to replay with a different guess.
  if (blankSlot + 1 + beam.exactRun !== beam.slotIndex) return [];
  let paid = 0;
  for (let i = guessIndex + 1; i < beam.moves.length; i++) {
    paid += MATCH_COST.get(beam.moves[i]!) ?? 0;
  }
  const out: Array<{ beam: Beam; clean: boolean }> = [];
  for (const { san, replay, extra } of findBlankRevisions(
    context,
    guess.fenBefore,
    blankSlot,
    guessIndex,
    beam.slotIndex,
    paid,
  ).slice(0, 2)) {
    const move: DecodedMove = { ...guess, san };
    BLANK_FILL.set(move, blankSlot);
    let state: Beam = {
      ...beam,
      fen: cache.applyMove(guess.fenBefore, san),
      slotIndex: blankSlot + 1,
      moves: [...beam.moves.slice(0, guessIndex), move],
      lastMoveTo: squareOf(san),
      exactRun: 0,
      cost: beam.cost - paid,
      resyncRemaining: 0,
      resyncCosts: [],
    };
    let ok = true;
    for (let i = 0; i < replay.length; i++) {
      const slot = slots[blankSlot + 1 + i]!;
      if (!slot.cell) {
        ok = false;
        break;
      }
      const ranked = rankCandidates(cache.legalSans(state.fen), slot.cell);
      const read = ranked.find((c) => c.san === replay[i]);
      if (!read) {
        ok = false;
        break;
      }
      state = extendWithMatch(state, slot, read, ranked, cache, options, 0);
    }
    if (ok && state.slotIndex === beam.slotIndex + 1) {
      out.push({ beam: state, clean: extra <= COST_EPSILON });
    }
  }
  return out;
}

/** Beams that fill this beam's blank cell with a move a later cell needs. */
function fillBlank(
  beam: Beam,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
  context: GapContext,
): Beam[] {
  const found = findBlankFills(context, beam.fen, beam.slotIndex, beam.moves.length);
  if (found.length === 0) return [];
  // The later cells often cannot tell two fills apart: the sheet reads as
  // far with either. The order they were found in is the move generator's
  // and means nothing, so among equals the ordinary guess order decides
  // (how the next cell reads, then recapture, check, capture). When no
  // later cell prefers a move, this is the guess the decoder made before
  // it looked further ahead.
  let fills = found;
  const tied = found.some((f, i) => i > 0 && i <= 2 && f.tier === found[i - 1]!.tier);
  if (tied) {
    const nextWritten = nextWrittenCell(slots, beam.slotIndex + 1);
    const byPriors = rankLegalByPriors(beam.fen, beam.lastMoveTo, cache);
    const ordinary = nextWritten
      ? rankLegalByLookahead(beam.fen, nextWritten, cache, beam.lastMoveTo)
      : byPriors;
    const rank = new Map<string, number>();
    ordinary.forEach((san, i) => rank.set(san, i));
    byPriors.forEach((san, i) => {
      if (!rank.has(san)) rank.set(san, ordinary.length + i);
    });
    fills = found
      .map((f, i) => ({ f, i }))
      .sort(
        (a, b) =>
          a.f.tier - b.f.tier ||
          (rank.get(a.f.san) ?? Infinity) - (rank.get(b.f.san) ?? Infinity) ||
          a.i - b.i,
      )
      .map((e) => e.f);
  }
  return fills.slice(0, 2).map(({ san }) => {
    const move: DecodedMove = {
      ply: beam.moves.length + 1,
      san,
      sourceRaw: null,
      confidence: 0.15,
      status: 'guessed',
      alternatives: fills
        .slice(0, options.maxAlternatives)
        .map((f, idx) => ({ san: f.san, score: 1 / (idx + 2) })),
      fenBefore: beam.fen,
    };
    BLANK_FILL.set(move, beam.slotIndex);
    return {
      ...beam,
      fen: cache.applyMove(beam.fen, san),
      slotIndex: beam.slotIndex + 1,
      moves: [...beam.moves, move],
      trailingSkips: 0,
      exactRun: 0,
      cost: beam.cost + INSERT_PLY_COST,
      lastMoveTo: squareOf(san),
      resyncRemaining: RESYNC_CELLS,
      resyncCosts: [],
    };
  });
}

function applyGapPlan(
  beam: Beam,
  plan: GapPlan,
  slots: readonly CellSlot[],
  cache: ChessCache,
  options: DecodeOptions,
): Beam | null {
  // Step back to where the gap goes, handing back what the cells in between
  // were charged; they are read again below, exactly.
  const back = beam.slotIndex - plan.slot;
  const keep = beam.moves.length - back;
  let refund = 0;
  for (let i = keep; i < beam.moves.length; i++) {
    refund += MATCH_COST.get(beam.moves[i]!) ?? 0;
  }
  let state: Beam =
    back === 0
      ? beam
      : {
          ...beam,
          fen: beam.moves[keep]!.fenBefore,
          slotIndex: plan.slot,
          moves: beam.moves.slice(0, keep),
          lastMoveTo: keep > 0 ? squareOf(beam.moves[keep - 1]!.san) : null,
          exactRun: beam.exactRun - back,
        };

  const firstPly = state.moves.length + 1;
  plan.inserted.forEach((san, i) => {
    const others = plan.alternatives[i] ?? [];
    const move: DecodedMove = {
      ply: state.moves.length + 1,
      san,
      sourceRaw: null,
      confidence: 0.15,
      status: 'guessed',
      alternatives: [san, ...others]
        .slice(0, options.maxAlternatives)
        .map((s, idx) => ({ san: s, score: 1 / (idx + 2) })),
      fenBefore: state.fen,
    };
    state = {
      ...state,
      fen: cache.applyMove(state.fen, san),
      moves: [...state.moves, move],
      lastMoveTo: squareOf(san),
      trailingSkips: 0,
      exactRun: 0,
      resyncRemaining: 0,
      resyncCosts: [],
    };
  });

  // Re-read the cells from the gap through the current one. gaps.ts already
  // replayed them; this builds the same moves with their confidence and
  // alternatives the way every other match is built.
  for (let i = 0; i < plan.replay.length; i++) {
    const slot = slots[plan.slot + i]!;
    if (!slot.cell) return null;
    const ranked = rankCandidates(cache.legalSans(state.fen), slot.cell);
    const read = ranked.find((c) => c.san === plan.replay[i]);
    if (!read) return null;
    state = extendWithMatch(state, slot, read, ranked, cache, options, 0);
  }
  if (state.slotIndex !== beam.slotIndex + 1) return null;

  const plies = plan.inserted.length === 2 ? 2 : 1;
  const latestPly = firstPly + (plan.latestSlot - plan.slot);
  const gap: DecodedGap = {
    ply: firstPly,
    plies,
    latestPly,
    note: gapNote(firstPly, plies, latestPly),
  };
  return {
    ...state,
    cost: state.cost - refund + (plies === 2 ? GAP_PAIR_COST : GAP_SINGLE_COST),
    guarded: true,
    gaps: [...beam.gaps, gap],
    warnings: [...beam.warnings, gap.note],
  };
}

/** The sentence the page shows for a gap. Move numbers, not plies. */
function gapNote(firstPly: number, plies: 1 | 2, latestPly: number): string {
  const moveNumber = plyToMoveLabel(firstPly);
  const whiteFirst = firstPly % 2 === 1;
  let note: string;
  if (plies === 2 && whiteFirst) {
    note =
      moveNumber === 1
        ? 'A move pair seems to be missing at the start of the game.'
        : `A move pair seems to be missing after move ${moveNumber - 1}.`;
  } else if (plies === 2) {
    note =
      `Two moves seem to be missing: Black's move ${moveNumber} and ` +
      `White's move ${moveNumber + 1}.`;
  } else {
    note = `${whiteFirst ? 'White' : 'Black'}'s move ${moveNumber} seems to be missing.`;
  }
  if (latestPly > firstPly) {
    note += ` It may belong as late as move ${plyToMoveLabel(latestPly)}.`;
  }
  return (
    note +
    (plies === 2
      ? ' The two moves shown there are guesses: pick the moves that were played.'
      : ' The move shown there is a guess: pick the move that was played.')
  );
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
