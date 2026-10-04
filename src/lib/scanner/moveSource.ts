/**
 * How the results page describes where a decoded move came from.
 *
 * Three cases, and the member has to be told which one they are looking at:
 *  - the move was read from a cell ("written ...");
 *  - the cell was left blank and the move is a guess ("blank on the sheet");
 *  - there is no cell at all: a move, or a whole move pair, was played and
 *    never written, and the decoder put a stand-in there so the rest of the
 *    game lines up ("not on the sheet"). Calling that one "blank" would send
 *    the member looking for an empty cell that does not exist.
 *
 * Kept out of ScannerPage.tsx so the wording can be tested without a DOM.
 */
import type { DecodedGame, DecodedMove } from './types';

export type MoveSource = 'written' | 'blank' | 'unwritten';

export function moveSource(move: Pick<DecodedMove, 'sourceRaw' | 'unwritten'>): MoveSource {
  if (move.sourceRaw !== null) return 'written';
  return move.unwritten ? 'unwritten' : 'blank';
}

/** The short line under a move in the list. */
export function sourceLabel(move: Pick<DecodedMove, 'sourceRaw' | 'unwritten'>): string {
  switch (moveSource(move)) {
    case 'written':
      return `written “${move.sourceRaw}”`;
    case 'blank':
      return 'blank on the sheet';
    case 'unwritten':
      return 'not on the sheet';
  }
}

/** The sentence at the top of the move picker. */
export function sourceSentence(move: Pick<DecodedMove, 'sourceRaw' | 'unwritten'>): string {
  switch (moveSource(move)) {
    case 'written':
      return `Written on the sheet as “${move.sourceRaw}”.`;
    case 'blank':
      return 'This move was blank on the sheet and worked out from the position.';
    case 'unwritten':
      return 'This move is not on the sheet. A move seems to have been played here without being written down, and this one is a guess.';
  }
}

const NEEDS_LOOK: ReadonlyArray<DecodedMove['status']> = ['flagged', 'guessed'];

/** Whether the member should check this move: low confidence, or a guess. */
export function needsLook(move: Pick<DecodedMove, 'status'>): boolean {
  return NEEDS_LOOK.includes(move.status);
}

/** Moves still waiting for a look, leaving out the plies the member settled. */
export function countNeedingLook(
  game: Pick<DecodedGame, 'moves'>,
  fixed: ReadonlySet<number>,
): number {
  return game.moves.filter((m) => needsLook(m) && !fixed.has(m.ply)).length;
}
