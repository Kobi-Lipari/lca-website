/**
 * Metrics harness. Spec: SCANNER_SPEC.md §5.8.
 *
 * "Metric harness reports: per-move accuracy, flag precision/recall, game
 * exact-match, truncation rate - per profile. Every Week-1 session ends
 * with these numbers printed."
 *
 * The metric that matters most for user trust is FLAG RECALL (§5.4): of the
 * moves the decoder got wrong, what fraction did it flag for the user? A
 * decoder that is wrong but honest is usable; one that is wrong and
 * confident is not.
 */

import type { DecodedGame } from './types';
import { decodeScan, type DecodeOptions } from './decoder';
import { corrupt, type ProfileName } from './synthetic';

export interface GameScore {
  id: string;
  /** plies of the true game actually represented on the sheet */
  truthPlies: number;
  decodedPlies: number;
  /** decoded ply matched the true SAN */
  correct: number;
  /** decoded ply present but wrong */
  wrong: number;
  /** true ply the decoder never produced (truncation / stopping short) */
  missing: number;
  /** decoded plies beyond the end of the truth window */
  extra: number;
  flagged: number;
  flaggedAndWrong: number;
  exactMatch: boolean;
  truncated: boolean;
  /** 0-based ply of the first wrong move, or -1 if the game decoded clean */
  firstDivergence: number;
  /** whether that first wrong move was flagged for the user */
  firstDivergenceFlagged: boolean;
  applied: string[];
}

export interface ProfileMetrics {
  profile: ProfileName;
  games: number;
  perMoveAccuracy: number;
  flagRecall: number;
  flagPrecision: number;
  gameExactMatch: number;
  truncationRate: number;
  /**
   * Of the games that went wrong at all, how many flagged the FIRST wrong
   * move. This is the number that predicts whether the fix-up UI can save
   * the game, and it is the honest companion to raw flag recall - see the
   * comment on the field's computation below.
   */
  firstDivergenceFlagRecall: number;
  /** games that diverged at all */
  divergedGames: number;
  /** how much of the sheet the decoder produced at all */
  coverage: number;
  totalPlies: number;
  totalWrong: number;
  totalFlagged: number;
}

export function scoreGame(
  id: string,
  decoded: DecodedGame,
  truth: readonly string[],
  truthPlies: number,
  applied: string[],
): GameScore {
  const window = truth.slice(0, truthPlies);

  let correct = 0;
  let wrong = 0;
  let missing = 0;
  let flagged = 0;
  let flaggedAndWrong = 0;
  let firstDivergence = -1;
  let firstDivergenceFlagged = false;

  for (let i = 0; i < window.length; i++) {
    const move = decoded.moves[i];
    if (!move) {
      missing++;
      continue;
    }
    const isFlagged = move.status === 'flagged' || move.status === 'guessed';
    if (isFlagged) flagged++;

    if (move.san === window[i]) {
      correct++;
    } else {
      wrong++;
      if (isFlagged) flaggedAndWrong++;
      if (firstDivergence === -1) {
        firstDivergence = i;
        firstDivergenceFlagged = isFlagged;
      }
    }
  }

  // Plies the decoder produced past the end of the truth window are wrong
  // by construction (it invented moves the sheet does not contain).
  const extra = Math.max(0, decoded.moves.length - window.length);
  for (let i = window.length; i < decoded.moves.length; i++) {
    const move = decoded.moves[i]!;
    const isFlagged = move.status === 'flagged' || move.status === 'guessed';
    wrong++;
    if (isFlagged) {
      flagged++;
      flaggedAndWrong++;
    }
  }

  return {
    id,
    truthPlies: window.length,
    decodedPlies: decoded.moves.length,
    correct,
    wrong,
    missing,
    extra,
    flagged,
    flaggedAndWrong,
    exactMatch:
      decoded.moves.length === window.length &&
      correct === window.length,
    truncated: decoded.truncatedAtPly !== undefined,
    firstDivergence,
    firstDivergenceFlagged,
    applied,
  };
}

export interface CorpusGame {
  id: string;
  pgn: string;
  sans: string[];
  result: string;
}

export function runProfile(
  corpus: readonly CorpusGame[],
  profile: ProfileName,
  options: Partial<DecodeOptions> = {},
  seedBase = 1000,
): { metrics: ProfileMetrics; scores: GameScore[] } {
  const scores: GameScore[] = [];

  corpus.forEach((game, index) => {
    const { scan, truth, truthPlies, applied } = corrupt(
      game.pgn,
      seedBase + index,
      profile,
    );
    const decoded = decodeScan(scan, options);
    scores.push(scoreGame(game.id, decoded, truth, truthPlies, applied));
  });

  return { metrics: aggregate(profile, scores), scores };
}

export function aggregate(
  profile: ProfileName,
  scores: readonly GameScore[],
): ProfileMetrics {
  const sum = (fn: (s: GameScore) => number) =>
    scores.reduce((acc, s) => acc + fn(s), 0);

  const totalPlies = sum((s) => s.truthPlies);
  const totalCorrect = sum((s) => s.correct);
  const totalWrong = sum((s) => s.wrong);
  const totalFlagged = sum((s) => s.flagged);
  const totalFlaggedWrong = sum((s) => s.flaggedAndWrong);
  const totalDecodedInWindow = sum((s) => s.truthPlies - s.missing);

  // Raw per-ply flag recall is structurally deflated: once the decoder
  // diverges at ply k, every later ply is scored wrong even though the
  // decoder is now self-consistently decoding a different (legal) game and
  // has no signal that anything is amiss. Those moves are unflaggable in
  // principle, so counting them drags recall down for a reason that says
  // nothing about the decoder's honesty.
  //
  // What actually determines whether the user recovers the game is whether
  // the FIRST wrong move was flagged: §2.2 keeps decoding client-side
  // precisely so that fixing one move re-decodes everything downstream
  // instantly. So a flagged first divergence means the whole game is
  // recoverable in one tap; an unflagged one means the user is handed a
  // clean-looking, wrong PGN. That is the metric to hold to §5.4's >=95%
  // bar, and it is reported alongside (not instead of) the raw number.
  const diverged = scores.filter((s) => s.firstDivergence !== -1);

  return {
    profile,
    games: scores.length,
    perMoveAccuracy: ratio(totalCorrect, totalPlies),
    flagRecall: ratio(totalFlaggedWrong, totalWrong),
    flagPrecision: ratio(totalFlaggedWrong, totalFlagged),
    gameExactMatch: ratio(scores.filter((s) => s.exactMatch).length, scores.length),
    firstDivergenceFlagRecall: ratio(
      diverged.filter((s) => s.firstDivergenceFlagged).length,
      diverged.length,
    ),
    divergedGames: diverged.length,
    truncationRate: ratio(scores.filter((s) => s.truncated).length, scores.length),
    coverage: ratio(totalDecodedInWindow, totalPlies),
    totalPlies,
    totalWrong,
    totalFlagged,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 1;
  return numerator / denominator;
}

/** §5.8's printed table. This is what every Week-1 session ends with. */
export function formatMetricsTable(rows: readonly ProfileMetrics[]): string {
  const headers = [
    'profile',
    'games',
    'per-move acc',
    'flag recall',
    '1st-div recall',
    'flag prec',
    'exact match',
    'truncation',
    'coverage',
  ];
  const body = rows.map((m) => [
    m.profile,
    String(m.games),
    pct(m.perMoveAccuracy),
    pct(m.flagRecall),
    pct(m.firstDivergenceFlagRecall),
    pct(m.flagPrecision),
    pct(m.gameExactMatch),
    pct(m.truncationRate),
    pct(m.coverage),
  ]);

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...body.map((r) => r[i]!.length)),
  );

  const line = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i]!)).join(' | ') + ' |';
  const divider = '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|';

  return [line(headers), divider, ...body.map(line)].join('\n');
}

function pct(value: number): string {
  return (value * 100).toFixed(1) + '%';
}
