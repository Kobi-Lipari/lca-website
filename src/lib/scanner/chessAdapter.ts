/**
 * The ONLY module in the scanner that imports chess.js.
 *
 * Rationale (this is a seam the spec didn't ask for, so it's justified here
 * and logged in STATUS.md): spec §2.1 flags the chess.js 0.x/1.x API split
 * as a landmine models repeatedly trip over, and §10.1 lists it as failure
 * mode #1. Funnelling every chess.js call through one small file means
 * there is exactly one place to check against the installed version's
 * types, and a version rename (e.g. `header()` -> `setHeader()`, which
 * differs across 1.x releases) is a one-line fix rather than a hunt.
 *
 * 1.x usage per spec §2.1:
 *  - `import { Chess } from 'chess.js'`
 *  - legal moves via `chess.moves({ verbose: true })` -> objects with .san
 *  - `chess.move()` THROWS on an illegal move (0.x returned null), so we
 *    prefer membership checks against the legal-move list over try/catch
 *    control flow
 *  - PGN via `chess.pgn()`, headers via `chess.header('White', ...)`
 */

import { Chess } from 'chess.js';

/**
 * Per-decode memo of legal moves and move results. The beam search revisits
 * the same positions across many beams, and chess.js is nearly all of
 * decode time, so both are cached.
 *
 * Measured against the real chess.js 1.x: moves() costs ~0.3ms per
 * position, moves({ verbose: true }) ~4ms, because every verbose move
 * carries the FEN before and after it. The decoder only needs SAN strings
 * to match against, and the few move properties it ranks by (capture,
 * check, destination) are readable from the SAN. So positions are listed
 * with the plain call, and the position after a move is worked out only for
 * moves a beam actually plays. That took a typical game from several
 * seconds to well under one.
 *
 * Deliberately created per decode call rather than as a module singleton: a
 * long-lived browser session would otherwise grow this map without bound
 * (the decoder runs client-side per §2.2).
 */
export interface ChessCache {
  legalSans(fen: string): string[];
  applyMove(fen: string, san: string): string;
  startingFen(): string;
}

export function createChessCache(): ChessCache {
  const legalCache = new Map<string, string[]>();
  const applyCache = new Map<string, string>();

  return {
    legalSans(fen: string): string[] {
      const hit = legalCache.get(fen);
      if (hit) return hit;
      const sans = new Chess(fen).moves() as string[];
      legalCache.set(fen, sans);
      return sans;
    },

    applyMove(fen: string, san: string): string {
      const key = `${fen}|${san}`;
      const hit = applyCache.get(key);
      if (hit) return hit;
      const chess = new Chess(fen);
      // Callers only ever pass a SAN taken from legalSans() above, so this
      // cannot throw in practice - but chess.js 1.x DOES throw rather than
      // return null, so a bug upstream would surface loudly here rather
      // than silently producing a null move.
      chess.move(san);
      const next = chess.fen();
      applyCache.set(key, next);
      return next;
    },

    startingFen(): string {
      return new Chess().fen();
    },
  };
}

/**
 * Every legal move in a position, for the fix-up picker. Ordered the way a
 * player scans for a move: king, queen, rooks, bishops, knights, castling,
 * then pawns, alphabetically within each.
 */
export function legalMovesAt(fen: string): string[] {
  const order = (san: string): number => {
    const i = 'KQRBNO'.indexOf(san[0]!);
    return i === -1 ? 6 : i;
  };
  return (new Chess(fen).moves() as string[]).sort(
    (a, b) => order(a) - order(b) || a.localeCompare(b),
  );
}

/**
 * Build a PGN from a decoded move list plus header fields.
 *
 * §8 requires the PGN carry a `Result` tag AND a movetext result token or
 * the lichess import may reject it / show `*`, so both are set here.
 */
export function buildPgn(
  sans: readonly string[],
  headers: Record<string, string | undefined>,
  result: string,
): string {
  const chess = new Chess();
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined && value !== '') {
      setPgnHeader(chess, key, value);
    }
  }
  setPgnHeader(chess, 'Result', result);
  for (const san of sans) {
    chess.move(san);
  }
  return chess.pgn();
}

/**
 * Isolated on purpose: `header(k, v)` is the 1.x call named in spec §2.1,
 * but some 1.x releases renamed it to `setHeader`. If the pinned version
 * disagrees, this is the one line to change.
 */
function setPgnHeader(chess: Chess, key: string, value: string): void {
  chess.header(key, value);
}
