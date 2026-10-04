/**
 * Finding moves that were played but never written. Spec: SCANNER_SPEC.md
 * §4.4 (skipped move pair, half-shift) and §5.5.
 *
 * The beam search in decoder.ts reads the sheet one cell at a time, and its
 * per-cell repairs cannot recover from a gap: the cells after a missing
 * move pair usually keep reading as legal moves for a while (the sheet
 * first contradicts itself a median of two cells later, and as many as 31),
 * and when the contradiction comes, a one-character "correction" is always
 * cheaper there and then than inserting two unknown moves.
 *
 * So this module answers a different question, asked only at a cell that
 * has no clean legal reading: is there a point at or before this cell where
 * one or two unwritten moves make this cell AND the cells after it read
 * exactly as written? The unknown moves are found from what the later cells
 * need, not by trying every pair (about a thousand positions):
 *
 *  1. Read the sheet with the unknown move replaced by a pass. The cells
 *     that are legal that way did not depend on the unknown move. The first
 *     cell that is not legal is the one that needs it.
 *  2. Try each candidate move at that point in the passed line (one move
 *     generation each) and keep those that make the needy cell legal.
 *  3. Check the survivors properly: play them where the gap is and replay
 *     the following cells. Rank by how many cells then read exactly.
 *
 * If no later cell needs the unknown move, any quiet move that keeps the
 * following cells legal stands in for it. Either way the result is a guess
 * and is marked as one; the member picks the real moves on the page.
 *
 * Nothing here decides whether a gap is the right explanation. It returns
 * candidate plans with the evidence for each; the decoder prices them
 * against the ordinary reading and the cheaper one wins.
 */

import type { RawCell } from './types';
import type { ChessCache, PieceLetter } from './chessAdapter';
import { cleanToken, isResultToken, stripCheckMateDecoration } from './normalize';
import { rankCandidates } from './candidates';

/**
 * A cell whose best legal reading costs this much or more has no clean
 * reading. Every single-character confusion in the §4.3 table costs less,
 * so an ordinary misread stays readable; a cleanly written move that is
 * simply not legal (cost 1 and up) does not. The decoder starts a search at
 * such a cell, and a replay here stops at one.
 */
export const UNREADABLE_COST = 0.9;

/** How many cells after a candidate gap are replayed to check it. */
const VERIFY_CELLS = 30;
/** How far back from the cell that exposed it a missing pair may be placed. */
const PAIR_LOOKBACK_CELLS = 20;
/** A single missing ply shows at once; it is looked for this far back. */
const SINGLE_LOOKBACK_CELLS = 2;
/** Stand-in moves tried when no later cell says what the missing move was. */
const FILLER_TRIES = 10;
/** Partly determined pairs taken further (the rest are near-duplicates). */
const MAX_PARTIAL_PAIRS = 4;
/** Cells after the gap that must read exactly before a plan is offered. */
export const MIN_SUPPORT_CELLS = 3;

const SAN_SHAPE =
  /^(O-O(-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](x[a-h])?[1-8](=[QRBN])?)$/;

export interface GapContext {
  cache: ChessCache;
  cells: ReadonlyArray<RawCell | null>;
  /** cleaned readings of each cell; null for a blank cell or a result */
  readings: ReadonlyArray<readonly string[] | null>;
  /** true where the cell holds a result token (the game ends there) */
  ends: readonly boolean[];
  /** true where the cell is written with a check or mate mark */
  marked: readonly boolean[];
  forced?: readonly string[];
  /** move applications and legality checks spent so far, against a cap */
  work: { ops: number; budget: number };
  /**
   * Whether a replay may read a cell as an ordinary misread (see exactRun).
   * Off for the first pass: on a clean sheet the cell that looks like a
   * cheap misread is usually the very cell that needs the unwritten move.
   * On only when the exact pass finds nothing, which is what a noisy sheet
   * looks like.
   */
  tolerant: boolean;
}

export interface GapProbe {
  /** position before the cell that has no clean reading */
  fen: string;
  /** index of that cell */
  slot: number;
  /** 0-based ply that cell would be if nothing were missing */
  ply: number;
  /**
   * Positions before each of the cells just read, nearest last, for as far
   * back as each cell was read as one move (no skipped or blank cell, no
   * inserted move in between). A gap is only moved back across those.
   */
  history: readonly string[];
  /** what the decoder's reading of each of those cells cost (0 = exact) */
  historyCosts: readonly number[];
}

export interface GapPlan {
  /** the cell the missing plies sit in front of */
  slot: number;
  /** the stand-in moves, in order (one or two) */
  inserted: string[];
  /** other moves that fit each stand-in equally well, for the picker */
  alternatives: string[][];
  /** the written cells from `slot` through the probed cell, as replayed */
  replay: string[];
  /** cells from the probed cell on that read exactly with the gap in place */
  support: number;
  /** whether the replay ran to the end of the writing (or a blank cell) */
  ranOut: boolean;
  /** the cell that exposed the gap; it cannot sit after this */
  latestSlot: number;
}

export function buildGapContext(
  cells: ReadonlyArray<RawCell | null>,
  cache: ChessCache,
  forced: readonly string[] | undefined,
  budget: number,
): GapContext {
  const ends = cells.map((cell) => cell !== null && isResultToken(cell.raw));
  const readings = cells.map((cell, i) => {
    if (cell === null || ends[i]) return null;
    const out: string[] = [];
    for (const reading of [cell.raw, ...(cell.alts ?? [])]) {
      const cleaned = cleanToken(reading);
      if (cleaned !== '' && !out.includes(cleaned)) out.push(cleaned);
    }
    return out.length > 0 ? out : null;
  });
  const marked = cells.map((cell) => cell !== null && /[+#]/.test(cell.raw));
  return {
    cache,
    cells,
    readings,
    ends,
    marked,
    forced,
    work: { ops: 0, budget },
    tolerant: false,
  };
}

/** Whether a cell is written the way a move is written at all. */
export function looksLikeMove(ctx: GapContext, slot: number): boolean {
  const readings = ctx.readings[slot];
  return !!readings && SAN_SHAPE.test(readings[0]!);
}

/**
 * Plans that explain the probed cell by one missing ply or a missing pair,
 * best supported first. Empty when nothing fits.
 */
export function findGapPlans(ctx: GapContext, probe: GapProbe): GapPlan[] {
  const search = (): GapPlan[] => {
    const plans: GapPlan[] = [];
    const single = findSingle(ctx, probe);
    if (single) plans.push(single);
    const pair = findPair(ctx, probe);
    if (pair) plans.push(pair);
    return plans;
  };
  ctx.tolerant = false;
  let plans = search();
  if (plans.length === 0) {
    ctx.tolerant = true;
    plans = search();
    ctx.tolerant = false;
  }
  return plans;
}

/**
 * What the decoder paid to read the last `d` cells before the probed one.
 * A gap placed that far back must not read those cells any worse.
 */
function paidFor(probe: GapProbe, d: number): number {
  let sum = 0;
  for (let i = probe.historyCosts.length - d; i < probe.historyCosts.length; i++) {
    sum += probe.historyCosts[i] ?? 0;
  }
  return sum + 1e-9;
}

function costOfFirst(run: Run, cells: number): number {
  let sum = 0;
  for (let i = 0; i < cells && i < run.costs.length; i++) sum += run.costs[i]!;
  return sum;
}

/**
 * Moves for a blank cell (§5.5 BLANK_PLY) that a later cell asks for: the
 * cell was left empty, a move was played, and some written move afterwards
 * is only legal if it was this one. Empty when no later cell cares which
 * move it was; the decoder's ordinary guess is as good as any then.
 */
export function findBlankFills(
  ctx: GapContext,
  fen: string,
  blankSlot: number,
  ply: number,
): Array<{ san: string; support: number }> {
  // Two blank cells in a row are a missing pair whose place is known: take
  // the first move of each pair that makes the cells after them read. The
  // second blank is filled the ordinary way on the next step.
  const twoBlanks =
    ctx.cells[blankSlot + 1] === null &&
    blankSlot + 2 < ctx.readings.length &&
    ctx.readings[blankSlot + 2] !== null;
  const search = (): Array<{ san: string; support: number }> => {
    if (twoBlanks) {
      const firsts = new Map<string, number>();
      for (const pair of resolvePair(ctx, fen, blankSlot + 2, ply, 1)) {
        if (pair.free[0] || firsts.has(pair.inserted[0])) continue;
        firsts.set(pair.inserted[0], pair.run.sans.length);
      }
      return [...firsts].map(([san, support]) => ({ san, support }));
    }
    return resolveUnknown(ctx, fen, [], blankSlot + 1, ply, true)
      .filter((u) => u.how !== 'filler')
      .map((u) => ({ san: u.san, support: u.run.sans.length }));
  };
  ctx.tolerant = false;
  let found = search();
  if (found.length === 0) {
    ctx.tolerant = true;
    found = search();
    ctx.tolerant = false;
  }
  return found;
}

/**
 * A blank cell was filled with a guess, the cells after it read, and now the
 * cell at `needySlot` does not. Before supposing more moves are missing, ask
 * whether a different move in the blank makes that cell legal: the guess
 * was only a guess. `paid` is what the cells in between cost as read so
 * far; a new fill must not read them worse.
 */
export function findBlankRevisions(
  ctx: GapContext,
  fen: string,
  blankSlot: number,
  ply: number,
  needySlot: number,
  paid: number,
): Array<{ san: string; replay: string[] }> {
  const span = needySlot - blankSlot;
  if (span < 1 || span > VERIFY_CELLS) return [];
  const search = () =>
    resolveUnknown(ctx, fen, [], blankSlot + 1, ply, true).filter(
      (u) =>
        u.run.sans.length >= span &&
        u.run.costs[span - 1] === 0 &&
        costOfFirst(u.run, span - 1) <= paid + 1e-9,
    );
  ctx.tolerant = false;
  let found = search();
  if (found.length === 0) {
    ctx.tolerant = true;
    found = search();
    ctx.tolerant = false;
  }
  return found.map((u) => ({ san: u.san, replay: u.run.sans.slice(0, span) }));
}

/* ------------------------------------------------------------------ */
/* One missing ply (§4.4 half-shift)                                   */
/* ------------------------------------------------------------------ */

function findSingle(ctx: GapContext, probe: GapProbe): GapPlan | null {
  let best: GapPlan | null = null;
  const back = Math.min(SINGLE_LOOKBACK_CELLS, probe.history.length);
  for (let d = 0; d <= back; d++) {
    const fen = d === 0 ? probe.fen : probe.history[probe.history.length - d]!;
    const slot = probe.slot - d;
    // Trying every move blind is only worth it at the probed cell itself;
    // further back the cells must already read cleanly for the other side.
    const found = resolveUnknown(ctx, fen, [], slot, probe.ply - d, d === 0, VERIFY_CELLS + d);
    const top = found[0];
    if (!top) continue;
    const support = top.run.sans.length - d;
    if (!enoughSupport(support, top.run.stop)) continue;
    if (costOfFirst(top.run, d) > paidFor(probe, d)) continue;
    // The earliest place that explains the sheet wins a tie: every move
    // before the guess is then exactly what was written.
    if (!best || support >= best.support) {
      best = {
        slot,
        inserted: [top.san],
        alternatives: [found.slice(1).map((u) => u.san)],
        replay: top.run.sans.slice(0, d + 1),
        support,
        ranOut: top.run.stop !== 'cap',
        latestSlot: probe.slot,
      };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* A missing move pair (§4.4)                                          */
/* ------------------------------------------------------------------ */

interface PairCandidate {
  inserted: [string, string];
  alternatives: [string[], string[]];
  /** true where the move is a stand-in that no cell asked for */
  free: [boolean, boolean];
  run: Run;
}

function findPair(ctx: GapContext, probe: GapProbe): GapPlan | null {
  // Anchor: the latest place the pair can go. Normally right in front of
  // the probed cell. When the two moves only work in the other order (a
  // capture and its recapture), it is one cell earlier, with the side that
  // moved there moving first.
  let anchorBack = 0;
  let top = resolvePair(ctx, probe.fen, probe.slot, probe.ply, 1)[0];
  if (!top && probe.history.length >= 1) {
    anchorBack = 1;
    top = resolvePair(
      ctx,
      probe.history[probe.history.length - 1]!,
      probe.slot - 1,
      probe.ply - 1,
      2,
    )[0];
  }
  if (!top) return null;
  const support = top.run.sans.length - anchorBack;
  if (!enoughSupport(support, top.run.stop)) return null;

  const anchor: GapPlan = {
    slot: probe.slot - anchorBack,
    inserted: [...top.inserted],
    alternatives: [top.alternatives[0], top.alternatives[1]],
    replay: top.run.sans.slice(0, anchorBack + 1),
    support,
    ranOut: top.run.stop !== 'cap',
    latestSlot: probe.slot - anchorBack,
  };

  // The sheet usually stays legal for a few cells past the real gap, so the
  // anchor is only the latest place the pair can go. Move the same two
  // moves back as far as the cells in between still read exactly. Placing
  // the guess early keeps every move before it exactly as written; placing
  // it late would leave real moves on the wrong move numbers with nothing
  // to flag them.
  const back = Math.min(PAIR_LOOKBACK_CELLS, probe.history.length);
  // Where the anchor line stands a few cells on. A relocated pair that
  // reaches the same position is the same game from there, so the anchor's
  // check of the later cells holds for it too.
  const checked = Math.min(anchor.support, MIN_SUPPORT_CELLS);
  const anchorFen =
    anchorBack === 0 ? probe.fen : probe.history[probe.history.length - anchorBack]!;
  const anchorStart = playFixed(ctx, anchorFen, top.inserted, probe.ply - anchorBack);
  const anchorEnd = anchorStart
    ? positionKey(
        exactRun(
          ctx,
          anchorStart.fen,
          anchor.slot,
          anchorBack + checked,
          probe.ply - anchorBack + 2,
          anchorBack,
        ).endFen,
      )
    : null;

  const earlier: Array<{ plan: GapPlan; d: number; startFen: string; sameGame: boolean }> = [];
  for (let d = anchorBack + 1; d <= back; d++) {
    if (ctx.work.ops > ctx.work.budget) break;
    const fen = probe.history[probe.history.length - d]!;
    const slot = probe.slot - d;
    const ply = probe.ply - d;
    const need = d + checked;
    const reads = (run: Run) =>
      (run.sans.length >= need || (run.sans.length >= d + 1 && run.stop !== 'mismatch')) &&
      costOfFirst(run, d) <= paidFor(probe, d);
    // An odd step back from the anchor starts with the other side's move.
    const sameOrder = (d - anchorBack) % 2 === 0;
    const order = sameOrder ? [0, 1] : [1, 0];
    const moves = order.map((i) => top.inserted[i]!);
    const free = order.map((i) => top.free[i]!);

    let start = playFixed(ctx, fen, moves, ply);
    let run = start ? exactRun(ctx, start.fen, slot, need, ply + 2, d) : null;
    if (!start || !run || !reads(run)) {
      // The stand-in for a move no cell asked for may not be playable this
      // early. Any other quiet move serves; look for one here.
      start = null;
      if (free[0] && !free[1]) {
        const found = resolveUnknown(ctx, fen, [moves[1]!], slot, ply, false, need)[0];
        if (found && reads(found.run)) {
          start = playFixed(ctx, fen, [found.san, found.fixed[0]!], ply);
        }
      } else if (!free[0] && free[1]) {
        const first = playFixed(ctx, fen, [moves[0]!], ply);
        const found = first
          ? resolveUnknown(ctx, first.fen, [], slot, ply + 1, false, need)[0]
          : undefined;
        if (first && found && reads(found.run)) {
          const second = playFixed(ctx, first.fen, [found.san], ply + 1);
          if (second) start = { fen: second.fen, sans: [first.sans[0]!, second.sans[0]!] };
        }
      }
      run = start ? exactRun(ctx, start.fen, slot, need, ply + 2, d) : null;
      if (!start || !run || !reads(run)) continue;
    }
    earlier.push({
      d,
      startFen: start.fen,
      sameGame: positionKey(run.endFen) === anchorEnd,
      plan: {
        slot,
        inserted: start.sans,
        alternatives: sameOrder
          ? anchor.alternatives
          : [anchor.alternatives[1]!, anchor.alternatives[0]!],
        replay: run.sans.slice(0, d + 1),
        support: anchor.support,
        ranOut: anchor.ranOut,
        latestSlot: anchor.latestSlot,
      },
    });
  }

  // Earliest first. A placement that reaches a different position from the
  // anchor's is only taken if the sheet then reads at least as far.
  for (let i = earlier.length - 1; i >= 0; i--) {
    const { plan, d, startFen, sameGame } = earlier[i]!;
    if (sameGame) return plan;
    if (ctx.work.ops > ctx.work.budget) break;
    const deep = exactRun(ctx, startFen, plan.slot, d + VERIFY_CELLS, probe.ply - d + 2, d);
    if (deep.sans.length - d >= anchor.support || deep.stop !== 'mismatch') return plan;
  }
  return anchor;
}

/**
 * Pairs of unwritten moves at `fen` that make the cells from `slot` read
 * exactly at least through the needy cell, `span` cells on (1 = the cell at
 * `slot` itself). Trying every pair would be about a thousand positions, so
 * the pair is split: find a first move that does the job with the reply
 * passed, or a reply that does it with the first move passed, then find the
 * other half from what the later cells need (resolveUnknown).
 */
function resolvePair(
  ctx: GapContext,
  fen: string,
  slot: number,
  ply: number,
  span: number,
): PairCandidate[] {
  const { cache } = ctx;
  const legal = cache.legalSans(fen);
  const forcedFirst = ctx.forced?.[ply];
  const forcedSecond = ctx.forced?.[ply + 1];
  const out: PairCandidate[] = [];

  /** 2: the cells read exactly; 1: the needy cell is right but for an 'x'. */
  const fit = (position: string): 0 | 1 | 2 => {
    const run = exactRun(ctx, position, slot, span, ply + 2, span - 1);
    if (run.sans.length === span) return 2;
    if (run.sans.length === span - 1 && nearMove(ctx, run.endFen, slot + span - 1)) return 1;
    return 0;
  };

  // (a) The first missing move alone makes the cell legal: its mover moved
  // the piece into place, or out of the way.
  const firstAlone: string[] = [];
  const firstNearly: string[] = [];
  for (const x of legal) {
    if (forcedFirst !== undefined && x !== forcedFirst) continue;
    if (ctx.work.ops > ctx.work.budget) break;
    const afterX = cache.applyMove(fen, x);
    ctx.work.ops++;
    const passed = cache.passTurn(afterX);
    if (passed === null) {
      // x gives check, so the reply is one of a few moves; try them all.
      for (const y of cache.legalSans(afterX)) {
        if (forcedSecond !== undefined && y !== forcedSecond) continue;
        const afterY = cache.applyMove(afterX, y);
        ctx.work.ops++;
        const run = exactRun(ctx, afterY, slot, VERIFY_CELLS, ply + 2, span - 1);
        if (run.sans.length >= span) {
          out.push({ inserted: [x, y], alternatives: [[], []], free: [false, false], run });
        }
      }
      continue;
    }
    const fits = fit(passed);
    if (fits === 2) firstAlone.push(x);
    else if (fits === 1) firstNearly.push(x);
  }
  for (const x of [...firstAlone, ...firstNearly].slice(0, MAX_PARTIAL_PAIRS)) {
    const afterX = cache.applyMove(fen, x);
    const replies = resolveUnknown(ctx, afterX, [], slot, ply + 1, true).filter(
      (u) => u.run.sans.length >= span && u.run.costs[span - 1] === 0,
    );
    const top = replies[0];
    if (!top) continue;
    out.push({
      inserted: [x, top.san],
      alternatives: [firstAlone.filter((s) => s !== x), replies.slice(1).map((u) => u.san)],
      free: [false, top.how === 'filler'],
      run: top.run,
    });
  }

  // (b) The second missing move alone makes the cell legal: the other side
  // put a piece where the written move takes it, or moved one away.
  const passed = cache.passTurn(fen);
  if (passed !== null) {
    const secondAlone: string[] = [];
    const secondNearly: string[] = [];
    for (const y of cache.legalSans(passed)) {
      const bare = stripCheckMateDecoration(y);
      if (forcedSecond !== undefined && stripCheckMateDecoration(forcedSecond) !== bare) continue;
      if (ctx.work.ops > ctx.work.budget) break;
      const afterY = cache.applyMove(passed, y);
      ctx.work.ops++;
      const fits = fit(afterY);
      if (fits === 2) secondAlone.push(bare);
      else if (fits === 1) secondNearly.push(bare);
    }
    for (const y of [...secondAlone, ...secondNearly].slice(0, MAX_PARTIAL_PAIRS)) {
      const firsts = resolveUnknown(ctx, fen, [y], slot, ply, true).filter(
        (u) => u.run.sans.length >= span && u.run.costs[span - 1] === 0,
      );
      const top = firsts[0];
      if (!top) continue;
      out.push({
        inserted: [top.san, top.fixed[0]!],
        alternatives: [firsts.slice(1).map((u) => u.san), secondAlone.filter((s) => s !== y)],
        free: [top.how === 'filler', false],
        run: top.run,
      });
    }
  }

  // (c) Neither move does it alone because the second depends on the
  // first: a piece moved to a square and was taken there. Only looked for
  // when (a) and (b) found nothing; it costs a move generation per move.
  if (out.length === 0) {
    for (const x of legal) {
      if (forcedFirst !== undefined && x !== forcedFirst) continue;
      if (ctx.work.ops > ctx.work.budget) break;
      const landing = squareOf(x);
      if (landing === null || x.includes('+') || x.includes('#')) continue;
      const afterX = cache.applyMove(fen, x);
      ctx.work.ops++;
      for (const y of cache.legalSans(afterX)) {
        if (!y.includes('x') || squareOf(y) !== landing) continue;
        if (forcedSecond !== undefined && y !== forcedSecond) continue;
        const afterY = cache.applyMove(afterX, y);
        ctx.work.ops++;
        const run = exactRun(ctx, afterY, slot, VERIFY_CELLS, ply + 2, span - 1);
        if (run.sans.length >= span) {
          out.push({ inserted: [x, y], alternatives: [[], []], free: [false, false], run });
        }
      }
    }
  }

  // Longest exact replay first; on a tie the pair found first stays first.
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => betterRun(a.c.run, b.c.run) || a.i - b.i)
    .map((e) => e.c);
}

/* ------------------------------------------------------------------ */
/* One unknown move, found from what the later cells need              */
/* ------------------------------------------------------------------ */

interface Resolved {
  /** the stand-in for the unknown move */
  san: string;
  /** the known moves played right after it, spelled as legal there */
  fixed: string[];
  /** the written cells replayed after those */
  run: Run;
  /** how it was found; a 'filler' is a stand-in no later cell asks for */
  how: 'blind' | 'needed' | 'filler';
}

/**
 * The side to move at `fen` made a move that is not on the sheet, then the
 * moves in `fixedAfter` were played, then the cells from `slot` on. Returns
 * the moves that fit, the one whose following cells read exactly for
 * longest first.
 */
function resolveUnknown(
  ctx: GapContext,
  fen: string,
  fixedAfter: readonly string[],
  slot: number,
  ply: number,
  allowBlind: boolean,
  cap = VERIFY_CELLS,
): Resolved[] {
  const { cache } = ctx;
  const legal = cache.legalSans(fen);
  if (legal.length === 0) return [];
  const forced = ctx.forced?.[ply];
  let pool: readonly string[] =
    forced !== undefined ? legal.filter((s) => s === forced) : legal;
  if (pool.length === 0) return [];
  const cellsPly = ply + 1 + fixedAfter.length;

  // 'blind': no hint which move it was, try them all (cheap only because
  // nearly all fail at the first cell). 'needed': shortlisted by the cell
  // that needs the move. 'filler': no cell needs it, any quiet move will do.
  let mode: 'blind' | 'needed' | 'filler' = 'blind';
  let fillerMustReach = 0;

  if (forced === undefined) {
    const passed = cache.passTurn(fen);
    const start = passed === null ? null : playFixed(ctx, passed, fixedAfter, ply + 1);
    if (start) {
      const passedRun = exactRun(ctx, start.fen, slot, cap, cellsPly);
      if (passedRun.stop !== 'mismatch') {
        mode = 'filler';
        fillerMustReach = passedRun.sans.length;
        pool = quietFirst(pool);
      } else if (passedRun.sans.length > 0 || fixedAfter.length > 0) {
        const needy = slot + passedRun.sans.length;
        const shortlist = movesThatEnable(ctx, fen, pool, passedRun.endFen, needy);
        if (shortlist.length > 0) {
          mode = 'needed';
          pool = shortlist;
        } else if (passedRun.sans.length > 2) {
          // Replaying every legal move this far is too dear for a long shot.
          return [];
        }
      }
    }
  }
  if (mode === 'blind' && !allowBlind && forced === undefined) return [];

  const out: Resolved[] = [];
  let tries = 0;
  for (const san of pool) {
    if (ctx.work.ops > ctx.work.budget) break;
    const afterMove = cache.applyMove(fen, san);
    ctx.work.ops++;
    const placed = playFixed(ctx, afterMove, fixedAfter, ply + 1);
    if (!placed) continue;
    const run = exactRun(ctx, placed.fen, slot, cap, cellsPly, mode === 'blind' ? 0 : -1);
    if (mode === 'filler') {
      if (run.sans.length >= fillerMustReach) {
        out.push({ san, fixed: placed.sans, run, how: mode });
        if (out.length >= 3) break;
      } else if (++tries >= FILLER_TRIES) {
        break;
      }
      continue;
    }
    if (run.sans.length > 0) out.push({ san, fixed: placed.sans, run, how: mode });
  }

  return out
    .map((u, i) => ({ u, i }))
    .sort((a, b) => betterRun(a.u.run, b.u.run) || a.i - b.i)
    .map((e) => e.u);
}

/**
 * Which of `pool` (moves of the side to move at `gapFen`) would make the
 * needy cell legal, judged by playing each one late: in the position just
 * before that cell in the line where the unknown move was a pass. One move
 * generation per candidate instead of a replay of every cell in between.
 * A shortlist only - the caller replays the survivors from the gap.
 */
function movesThatEnable(
  ctx: GapContext,
  gapFen: string,
  pool: readonly string[],
  beforeNeedy: string,
  needySlot: number,
): string[] {
  const { cache } = ctx;
  const mover = sideToMove(gapFen);
  const needyIsMovers = sideToMove(beforeNeedy) === mover;
  const base = needyIsMovers ? beforeNeedy : cache.passTurn(beforeNeedy);
  if (base === null) return [];

  const byBare = new Map(pool.map((s) => [stripCheckMateDecoration(s), s]));
  const out: string[] = [];
  for (const x of cache.legalSans(base)) {
    const original = byBare.get(stripCheckMateDecoration(x));
    if (original === undefined) continue;
    if (ctx.work.ops > ctx.work.budget) break;
    const after = cache.applyMove(base, x);
    ctx.work.ops++;
    const test = needyIsMovers ? cache.passTurn(after) : after;
    if (test === null) continue;
    if (exactMove(ctx, test, needySlot) !== null) out.push(original);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Replaying written cells                                             */
/* ------------------------------------------------------------------ */

interface Run {
  /** the cells that could be read, as legal SANs, in order */
  sans: string[];
  /** what each reading cost: 0 for an exact one */
  costs: number[];
  /** the sum of `costs` */
  cost: number;
  /**
   * Written check marks the replay bears out, less those it contradicts.
   * Marks are too unreliable to match on (§4.2), but between two stand-in
   * moves that fit equally they are the only evidence left: with the king
   * on the right square, "Qc1+" on the sheet really is a check.
   */
  marks: number;
  /** position before the cell that stopped the run */
  endFen: string;
  /** why it stopped: a cell with no clean reading, a blank, the end of the
   *  writing, or the cap */
  stop: 'mismatch' | 'blank' | 'end' | 'cap';
}

/**
 * Replay the written cells from `slot`. A cell reads if it is exactly a
 * legal move, or within an ordinary misread of one (below UNREADABLE_COST):
 * a noisy sheet must not hide a gap, nor a noisy cell pass for the one that
 * needs the unwritten move. The cell at index `strictAt` must be exact; that
 * is the cell a gap is being asked to explain.
 */
function exactRun(
  ctx: GapContext,
  fen: string,
  slot: number,
  cap: number,
  ply: number,
  strictAt = -1,
): Run {
  const sans: string[] = [];
  const costs: number[] = [];
  let cur = fen;
  let marks = 0;
  let cost = 0;
  const done = (stop: Run['stop']): Run => ({ sans, costs, cost, marks, endFen: cur, stop });
  for (let i = 0; i < cap; i++) {
    const s = slot + i;
    if (s >= ctx.readings.length || ctx.ends[s]) return done('end');
    if (ctx.readings[s] === null) return done('blank');
    let san = exactMove(ctx, cur, s);
    let paid = 0;
    if (san === null) {
      if (i === strictAt || !ctx.tolerant) return done('mismatch');
      // A full move list and a fuzzy ranking: several times an exact check.
      ctx.work.ops += 3;
      const best = rankCandidates(ctx.cache.legalSans(cur), ctx.cells[s]!)[0];
      if (!best || best.cost >= UNREADABLE_COST) return done('mismatch');
      san = best.san;
      paid = best.cost;
    }
    const forced = ctx.forced?.[ply + i];
    if (forced !== undefined && forced !== san) return done('mismatch');
    if (ctx.marked[s]) marks += /[+#]$/.test(san) ? 1 : -1;
    sans.push(san);
    costs.push(paid);
    cost += paid;
    cur = ctx.cache.applyMove(cur, san);
    ctx.work.ops++;
  }
  return done('cap');
}

/** The legal move this cell spells exactly, if there is one. */
function exactMove(ctx: GapContext, fen: string, slot: number): string | null {
  const readings = ctx.readings[slot];
  if (!readings) return null;
  ctx.work.ops++;
  for (const reading of readings) {
    for (const san of ctx.cache.legalSansOf(fen, pieceOf(reading))) {
      if (stripCheckMateDecoration(san) === reading) return san;
    }
  }
  return null;
}

/**
 * Whether the cell is a legal move here but for the capture mark: written
 * "Nf8" where only "Nxf8" is legal, or the other way round. One unwritten
 * move brought the piece; the other must have emptied or filled the square.
 */
function nearMove(ctx: GapContext, fen: string, slot: number): boolean {
  const readings = ctx.readings[slot];
  if (!readings) return false;
  ctx.work.ops++;
  for (const reading of readings) {
    const bare = reading.replace('x', '');
    for (const san of ctx.cache.legalSansOf(fen, pieceOf(reading))) {
      if (stripCheckMateDecoration(san).replace('x', '') === bare) return true;
    }
  }
  return false;
}

/** Play known moves (given without check marks) if each is legal in turn. */
function playFixed(
  ctx: GapContext,
  fen: string,
  bare: readonly string[],
  ply: number,
): { fen: string; sans: string[] } | null {
  let cur = fen;
  const sans: string[] = [];
  for (let i = 0; i < bare.length; i++) {
    const want = stripCheckMateDecoration(bare[i]!);
    const hit = ctx.cache
      .legalSansOf(cur, pieceOf(want))
      .find((s) => stripCheckMateDecoration(s) === want);
    if (hit === undefined) return null;
    const forced = ctx.forced?.[ply + i];
    if (forced !== undefined && forced !== hit) return null;
    sans.push(hit);
    cur = ctx.cache.applyMove(cur, hit);
    ctx.work.ops++;
  }
  return { fen: cur, sans };
}

/** Sort order: more cells read, then read more cheaply, then check marks. */
function betterRun(a: Run, b: Run): number {
  return b.sans.length - a.sans.length || a.cost - b.cost || b.marks - a.marks;
}

function enoughSupport(cells: number, stop: Run['stop']): boolean {
  if (cells >= MIN_SUPPORT_CELLS) return true;
  // Near the end of the writing there are fewer cells to check against;
  // the decoder's pricing decides whether so little is worth a gap.
  return cells >= 1 && (stop === 'end' || stop === 'blank');
}

/** Quiet moves first: a stand-in should disturb as little as possible. */
function quietFirst(sans: readonly string[]): string[] {
  const rank = (san: string) =>
    san.includes('+') || san.includes('#') ? 2 : san.includes('x') ? 1 : 0;
  return sans
    .map((san, i) => ({ san, i }))
    .sort((a, b) => rank(a.san) - rank(b.san) || a.i - b.i)
    .map((e) => e.san);
}

function pieceOf(reading: string): PieceLetter {
  switch (reading[0]) {
    case 'K':
    case 'O':
      return 'k';
    case 'Q':
      return 'q';
    case 'R':
      return 'r';
    case 'B':
      return 'b';
    case 'N':
      return 'n';
    default:
      return 'p';
  }
}

/** Square a SAN move lands on (the rook's for castling is not needed). */
function squareOf(san: string): string | null {
  const m = san.replace(/[+#]+$/, '').match(/([a-h][1-8])(?:=[QRBN])?$/);
  return m ? m[1]! : null;
}

/** Board, side to move, castling rights and en passant square. */
function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function sideToMove(fen: string): string {
  return fen.split(' ')[1]!;
}
