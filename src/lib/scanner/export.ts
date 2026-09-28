/**
 * Getting a decoded game out of the scanner: as a PGN to copy, and as a
 * lichess analysis-board link.
 *
 * Header values come from the handwriting, verbatim, so only the ones that
 * are safe to pass through are used. A date or rating in a format PGN does
 * not allow is left out rather than risk a PGN that other tools reject.
 */

import { buildPgn } from './chessAdapter';
import type { DecodedGame, RawScan } from './types';

const PGN_DATE = /^\d{4}\.(\d{2}|\?\?)\.(\d{2}|\?\?)$/;
const RATING = /^\d{3,4}$/;

/** The PGN tag pairs a scan's header can fill. */
export function pgnHeaders(header: RawScan['header']): Record<string, string | undefined> {
  return {
    Event: header.event,
    Round: header.round,
    Board: header.board,
    White: header.whiteName,
    Black: header.blackName,
    Date: header.date && PGN_DATE.test(header.date) ? header.date : undefined,
    WhiteElo: header.whiteRating && RATING.test(header.whiteRating) ? header.whiteRating : undefined,
    BlackElo: header.blackRating && RATING.test(header.blackRating) ? header.blackRating : undefined,
    TimeControl: header.timeControl,
  };
}

export function gameToPgn(game: DecodedGame, header: RawScan['header']): string {
  return buildPgn(
    game.moves.map((m) => m.san),
    pgnHeaders(header),
    game.result,
  );
}

/**
 * lichess opens a game on its analysis board from the moves in the path,
 * separated by underscores. No account or API call needed, and the member
 * can correct any move there before saving or sharing it.
 */
export function lichessAnalysisUrl(game: DecodedGame): string {
  const path = game.moves.map((m) => encodeURIComponent(m.san)).join('_');
  return `https://lichess.org/analysis/pgn/${path}`;
}
