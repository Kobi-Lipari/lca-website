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
 * Per-decode memo of position -> legal SANs. The beam search revisits the
 * same position across many beams, and move generation dominates decode
 * cost, so this matters. Deliberately created per decode call rather than
 * as a module singleton: a long-lived browser session would otherwise grow
 * this map without bound (the decoder runs client-side per §2.2).
 */
export interface ChessCache {
  legalSans(fen: string): string[];
  legalInfo(fen: string): LegalMoveInfo[];
  applyMove(fen: string, san: string): string;
  startingFen(): string;
}

export function createChessCache(): ChessCache {
  const legalCache = new Map<string, string[]>();
  const infoCache = new Map<string, LegalMoveInfo[]>();
  const applyCache = new Map<string, string>();

  return {
    legalSans(fen: string): string[] {
      const hit = legalCache.get(fen);
      if (hit) return hit;
      const chess = new Chess(fen);
      const sans = chess
        .moves({ verbose: true })
        .map((m: { san: string }) => m.san);
      legalCache.set(fen, sans);
      return sans;
    },

    legalInfo(fen: string): LegalMoveInfo[] {
      const hit = infoCache.get(fen);
      if (hit) return hit;
      const info = legalMoveInfo(fen);
      infoCache.set(fen, info);
      return info;
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
 * Verbose legal move info, for the §5.5 BLANK_PLY priors (recaptures >
 * checks > captures > others) which need to know what a move DOES, not
 * just its SAN.
 */
export interface LegalMoveInfo {
  san: string;
  from: string;
  to: string;
  piece: string;
  captured?: string;
  promotion?: string;
}

export function legalMoveInfo(fen: string): LegalMoveInfo[] {
  const chess = new Chess(fen);
  return chess.moves({ verbose: true }).map((m: LegalMoveInfo) => ({
    san: m.san,
    from: m.from,
    to: m.to,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
  }));
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
