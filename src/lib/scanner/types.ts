/**
 * Data contracts for the scoresheet scanner pipeline.
 * Spec: SCANNER_SPEC.md §3.
 *
 * These types are the two-stage contract (§2.3): the vision model produces
 * RawScan (verbatim, no chess knowledge applied); the decoder consumes it
 * and produces DecodedGame (all chess legality applied here, and only here).
 * Never let a later stage blur this boundary.
 */

/** §3.1 RawScan — vision output, decoder input. */
export interface RawScan {
  header: {
    event?: string;
    date?: string;
    round?: string;
    board?: string;
    whiteName?: string;
    blackName?: string;
    whiteRating?: string;
    blackRating?: string;
    /** verbatim, e.g. "1-0", "½-½", "1/2-1/2", "0-1" */
    result?: string;
    timeControl?: string;
    legibility: 'clear' | 'partial' | 'unreadable';
  };
  rows: Array<{
    /** printed move number on the sheet */
    n: number;
    /** null = cell is blank */
    white: RawCell | null;
    black: RawCell | null;
  }>;
  /** anything odd: crossed-out moves, arrows, ink blots, "continued on back" */
  sheetNotes?: string[];
}

export interface RawCell {
  /** best-effort verbatim transcription, e.g. "Nf3", "R1e2", "0-0", "e8=Q" */
  raw: string;
  /** plausible alternative readings, e.g. raw "Nf3" alts ["Hf3","Kf3"] */
  alts?: string[];
  confidence: 'high' | 'medium' | 'low';
  /** move appears crossed out / rewritten */
  struck?: boolean;
}

/** §3.2 DecodedGame — decoder output, consumed by UI + PGN export. */
export interface DecodedGame {
  moves: DecodedMove[];
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  /** set if decoding gave up partway */
  truncatedAtPly?: number;
  /** e.g. "rows 24-26 could not be aligned; two interpretations shown" */
  warnings: string[];
  notation: 'algebraic' | 'descriptive' | 'unknown';
  /**
   * Places where moves were played but never written (§4.4: a skipped move
   * pair, or one side's single move). The decoder put stand-in moves there
   * (status `guessed`, sourceRaw null) so the rest of the game lines up;
   * only the member can say what was really played. Absent when the sheet
   * has no such gap.
   */
  gaps?: DecodedGap[];
}

export interface DecodedGap {
  /** 1-based ply of the first stand-in move */
  ply: number;
  /** how many consecutive plies are stand-ins: 1, or 2 for a move pair */
  plies: 1 | 2;
  /**
   * The sheet often reads the same with the gap a little later. This is the
   * latest ply the first missing move can be; equal to `ply` when the place
   * is certain. The stand-ins are put at the earliest place that fits, so
   * every move before them is exactly as written.
   */
  latestPly: number;
  /** one sentence for the page, e.g. "A move pair seems to be missing after move 14." */
  note: string;
}

export interface DecodedMove {
  /** 1-based half-move index */
  ply: number;
  /** chosen legal SAN */
  san: string;
  /** the RawCell.raw this came from (null = inserted hypothesis) */
  sourceRaw: string | null;
  /** 0..1 */
  confidence: number;
  status: DecodedMoveStatus;
  /** top candidates for the fix-up UI */
  alternatives: Array<{ san: string; score: number }>;
  /** position before this move (for board preview) */
  fenBefore: string;
}

/**
 * §3.2 status semantics:
 * - matched:    raw string was exactly a legal SAN (after normalization §5.2)
 * - corrected:  fuzzy-matched within threshold
 * - guessed:    filled an illegible/blank slot from context (always low
 *               confidence, always shown flagged)
 * - flagged:    below confidence floor, needs user attention
 * - user-fixed: the member corrected it in the review UI
 */
export type DecodedMoveStatus =
  | 'matched'
  | 'corrected'
  | 'guessed'
  | 'flagged'
  | 'user-fixed';
