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

/** A name safe for any file system: letters, digits and hyphens only. */
function fileSafe(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
}

/** Surname if the name has several words: "Kobi Lipari" → "Lipari". */
function surname(name: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return fileSafe(words[words.length - 1] ?? '');
}

/**
 * "Lipari-vs-Smith-2026-09-14.pgn", falling back to "scanned-game-<date>"
 * when the sheet has no names. The date is the day it was scanned; the
 * sheet's own date is too often unreadable or in an odd format to trust in
 * a file name.
 */
export function pgnFilename(header: RawScan['header'], today: Date = new Date()): string {
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const white = surname(header.whiteName);
  const black = surname(header.blackName);
  const players = white && black ? `${white}-vs-${black}` : 'scanned-game';
  return `${players}-${date}.pgn`;
}

/**
 * Some email programs (older Outlook in particular) ignore or cut off a
 * mailto link much past 2,000 characters, so the PGN goes in the body only
 * when the whole link stays under this. The lichess link always fits.
 */
const MAILTO_LIMIT = 1900;

/**
 * A mailto: link that opens the member's own email program with the game
 * filled in. It can't attach a file (browsers don't allow it), so the body
 * carries the lichess link, and the PGN text when it fits.
 */
export function emailGameLink(game: DecodedGame, header: RawScan['header']): string {
  const white = header.whiteName ?? 'White';
  const black = header.blackName ?? 'Black';
  const subject = `Chess game: ${white} vs ${black}`;
  const link = lichessAnalysisUrl(game);
  const intro = `${white} vs ${black}, scanned from the scoresheet.\n\nReplay it on lichess:\n${link}`;
  const build = (body: string) =>
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const withPgn = build(`${intro}\n\nPGN:\n${gameToPgn(game, header)}\n`);
  if (withPgn.length <= MAILTO_LIMIT) return withPgn;
  return build(`${intro}\n\n(The full PGN is too long for an email link. Use Save PGN on the scanner page and attach the file.)\n`);
}
