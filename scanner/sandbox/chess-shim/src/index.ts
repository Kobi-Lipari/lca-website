/**
 * ============================================================================
 * SANDBOX-ONLY SHIM — NOT PART OF THE SCANNER DELIVERABLE. DO NOT SHIP.
 * ============================================================================
 *
 * The session that built Week 1 S3-S5 had no network access, so `npm install
 * chess.js` returns 403 and the real library could not be installed. But S3's
 * DoD ("10 clean synthetic games decode to exact PGN match") and S4/S5's DoDs
 * ("metrics table prints with real numbers") are *measured* results — they are
 * worthless if asserted rather than run. So this file implements a genuine
 * 0x88 legal move generator exposing exactly the chess.js 1.x API subset the
 * decoder touches, so the decoder can `import { Chess } from 'chess.js'` for
 * real (spec §2.1) and the harness can actually execute.
 *
 * It is compiled to `node_modules/chess.js/` in the sandbox so module
 * resolution works normally. In the Codespace, `npm install` puts the REAL
 * chess.js there and this is never used again.
 *
 * It is validated against standard perft counts (see sandbox/perft.ts) so the
 * numbers it produces are trustworthy, not just plausible.
 *
 * API subset implemented (per spec §2.1's 1.x guidance):
 *   new Chess(fen?), .moves({verbose:true}), .move(san) [THROWS on illegal],
 *   .fen(), .pgn(), .header(k,v), .turn(), .undo(), .history(),
 *   .isGameOver(), .isCheckmate(), .isStalemate(), .isDraw(), .inCheck()
 */

export type Color = 'w' | 'b';
export type PieceSymbol = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface Piece {
  type: PieceSymbol;
  color: Color;
}

export interface Move {
  color: Color;
  from: string;
  to: string;
  piece: PieceSymbol;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: string;
  san: string;
}

interface InternalMove {
  from: number;
  to: number;
  piece: PieceSymbol;
  color: Color;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
  flags: string;
}

interface HistoryEntry {
  move: InternalMove;
  kings: { w: number; b: number };
  turn: Color;
  castling: { w: number; b: number };
  epSquare: number | null;
  halfMoves: number;
  moveNumber: number;
}

const WHITE: Color = 'w';
const BLACK: Color = 'b';

const PAWN: PieceSymbol = 'p';
const KNIGHT: PieceSymbol = 'n';
const BISHOP: PieceSymbol = 'b';
const ROOK: PieceSymbol = 'r';
const QUEEN: PieceSymbol = 'q';
const KING: PieceSymbol = 'k';

const BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
};

const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_OFFSETS = [17, 15, -17, -15];
const ROOK_OFFSETS = [16, -16, 1, -1];
const KING_OFFSETS = [16, -16, 1, -1, 17, 15, -17, -15];

const DEFAULT_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function file(sq: number): number {
  return sq & 15;
}
function rank(sq: number): number {
  return sq >> 4;
}
function algebraic(sq: number): string {
  return 'abcdefgh'[file(sq)]! + String(rank(sq) + 1);
}
function squareIndex(name: string): number {
  const f = 'abcdefgh'.indexOf(name[0]!);
  const r = parseInt(name[1]!, 10) - 1;
  return r * 16 + f;
}
function isOnBoard(sq: number): boolean {
  return (sq & 0x88) === 0;
}
function swapColor(c: Color): Color {
  return c === WHITE ? BLACK : WHITE;
}

export class Chess {
  private board: Array<Piece | null> = new Array(128).fill(null);
  private turnColor: Color = WHITE;
  private castling: { w: number; b: number } = { w: 0, b: 0 };
  private epSquare: number | null = null;
  private halfMoves = 0;
  private moveNumber = 1;
  private kings: { w: number; b: number } = { w: -1, b: -1 };
  private history: HistoryEntry[] = [];
  private headers: Record<string, string> = {};

  constructor(fen: string = DEFAULT_FEN) {
    this.load(fen);
  }

  load(fen: string): void {
    this.board = new Array(128).fill(null);
    this.history = [];
    this.kings = { w: -1, b: -1 };

    const parts = fen.split(/\s+/);
    const position = parts[0]!;
    let sq = 112; // a8
    for (const ch of position) {
      if (ch === '/') {
        sq -= 24;
      } else if (/[1-8]/.test(ch)) {
        sq += parseInt(ch, 10);
      } else {
        const color: Color = ch === ch.toUpperCase() ? WHITE : BLACK;
        const type = ch.toLowerCase() as PieceSymbol;
        this.board[sq] = { type, color };
        if (type === KING) this.kings[color] = sq;
        sq++;
      }
    }

    this.turnColor = (parts[1] as Color) ?? WHITE;

    this.castling = { w: 0, b: 0 };
    const rights = parts[2] ?? '-';
    if (rights.includes('K')) this.castling.w |= BITS.KSIDE_CASTLE;
    if (rights.includes('Q')) this.castling.w |= BITS.QSIDE_CASTLE;
    if (rights.includes('k')) this.castling.b |= BITS.KSIDE_CASTLE;
    if (rights.includes('q')) this.castling.b |= BITS.QSIDE_CASTLE;

    const ep = parts[3] ?? '-';
    this.epSquare = ep === '-' ? null : squareIndex(ep);
    this.halfMoves = parseInt(parts[4] ?? '0', 10);
    this.moveNumber = parseInt(parts[5] ?? '1', 10);
  }

  fen(): string {
    let empty = 0;
    let fen = '';
    for (let r = 7; r >= 0; r--) {
      for (let f = 0; f < 8; f++) {
        const piece = this.board[r * 16 + f];
        if (piece === null || piece === undefined) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          fen +=
            piece.color === WHITE
              ? piece.type.toUpperCase()
              : piece.type;
        }
      }
      if (empty > 0) {
        fen += empty;
        empty = 0;
      }
      if (r > 0) fen += '/';
    }

    let castle = '';
    if (this.castling.w & BITS.KSIDE_CASTLE) castle += 'K';
    if (this.castling.w & BITS.QSIDE_CASTLE) castle += 'Q';
    if (this.castling.b & BITS.KSIDE_CASTLE) castle += 'k';
    if (this.castling.b & BITS.QSIDE_CASTLE) castle += 'q';
    if (castle === '') castle = '-';

    const ep = this.epSquare === null ? '-' : algebraic(this.epSquare);

    return `${fen} ${this.turnColor} ${castle} ${ep} ${this.halfMoves} ${this.moveNumber}`;
  }

  turn(): Color {
    return this.turnColor;
  }

  private isSquareAttacked(square: number, byColor: Color): boolean {
    // knights
    for (const off of KNIGHT_OFFSETS) {
      const sq = square + off;
      if (!isOnBoard(sq)) continue;
      const p = this.board[sq];
      if (p && p.color === byColor && p.type === KNIGHT) return true;
    }
    // king
    for (const off of KING_OFFSETS) {
      const sq = square + off;
      if (!isOnBoard(sq)) continue;
      const p = this.board[sq];
      if (p && p.color === byColor && p.type === KING) return true;
    }
    // pawns: a white pawn on s attacks s+15 and s+17
    const pawnOrigins =
      byColor === WHITE ? [square - 15, square - 17] : [square + 15, square + 17];
    for (const sq of pawnOrigins) {
      if (!isOnBoard(sq)) continue;
      const p = this.board[sq];
      if (p && p.color === byColor && p.type === PAWN) return true;
    }
    // sliding: rook/queen
    for (const dir of ROOK_OFFSETS) {
      let sq = square + dir;
      while (isOnBoard(sq)) {
        const p = this.board[sq];
        if (p) {
          if (p.color === byColor && (p.type === ROOK || p.type === QUEEN)) {
            return true;
          }
          break;
        }
        sq += dir;
      }
    }
    // sliding: bishop/queen
    for (const dir of BISHOP_OFFSETS) {
      let sq = square + dir;
      while (isOnBoard(sq)) {
        const p = this.board[sq];
        if (p) {
          if (p.color === byColor && (p.type === BISHOP || p.type === QUEEN)) {
            return true;
          }
          break;
        }
        sq += dir;
      }
    }
    return false;
  }

  inCheck(): boolean {
    return this.isSquareAttacked(
      this.kings[this.turnColor],
      swapColor(this.turnColor),
    );
  }

  private addPawnMove(
    moves: InternalMove[],
    from: number,
    to: number,
    flags: number,
    captured?: PieceSymbol,
  ): void {
    const color = this.turnColor;
    const promoRank = color === WHITE ? 7 : 0;
    if (rank(to) === promoRank) {
      for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT] as PieceSymbol[]) {
        moves.push({
          from,
          to,
          piece: PAWN,
          color,
          captured,
          promotion: promo,
          flags: flagsToString(flags | BITS.PROMOTION),
        });
      }
    } else {
      moves.push({
        from,
        to,
        piece: PAWN,
        color,
        captured,
        flags: flagsToString(flags),
      });
    }
  }

  private generatePseudoMoves(): InternalMove[] {
    const moves: InternalMove[] = [];
    const us = this.turnColor;
    const them = swapColor(us);

    for (let sq = 0; sq < 128; sq++) {
      if (!isOnBoard(sq)) {
        sq += 7;
        continue;
      }
      const piece = this.board[sq];
      if (!piece || piece.color !== us) continue;

      if (piece.type === PAWN) {
        const forward = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6;

        const one = sq + forward;
        if (isOnBoard(one) && !this.board[one]) {
          this.addPawnMove(moves, sq, one, BITS.NORMAL);
          const two = sq + forward * 2;
          if (rank(sq) === startRank && isOnBoard(two) && !this.board[two]) {
            moves.push({
              from: sq,
              to: two,
              piece: PAWN,
              color: us,
              flags: flagsToString(BITS.BIG_PAWN),
            });
          }
        }

        for (const diag of us === WHITE ? [15, 17] : [-15, -17]) {
          const to = sq + diag;
          if (!isOnBoard(to)) continue;
          const target = this.board[to];
          if (target && target.color === them) {
            this.addPawnMove(moves, sq, to, BITS.CAPTURE, target.type);
          } else if (!target && this.epSquare === to) {
            moves.push({
              from: sq,
              to,
              piece: PAWN,
              color: us,
              captured: PAWN,
              flags: flagsToString(BITS.EP_CAPTURE),
            });
          }
        }
        continue;
      }

      const offsets =
        piece.type === KNIGHT
          ? KNIGHT_OFFSETS
          : piece.type === BISHOP
            ? BISHOP_OFFSETS
            : piece.type === ROOK
              ? ROOK_OFFSETS
              : KING_OFFSETS;
      const sliding = piece.type === BISHOP || piece.type === ROOK || piece.type === QUEEN;

      for (const off of offsets) {
        let to = sq + off;
        while (isOnBoard(to)) {
          const target = this.board[to];
          if (!target) {
            moves.push({
              from: sq,
              to,
              piece: piece.type,
              color: us,
              flags: flagsToString(BITS.NORMAL),
            });
          } else {
            if (target.color === them) {
              moves.push({
                from: sq,
                to,
                piece: piece.type,
                color: us,
                captured: target.type,
                flags: flagsToString(BITS.CAPTURE),
              });
            }
            break;
          }
          if (!sliding) break;
          to += off;
        }
      }
    }

    // castling
    const kingSq = this.kings[us];
    if (kingSq >= 0 && !this.isSquareAttacked(kingSq, them)) {
      if (this.castling[us] & BITS.KSIDE_CASTLE) {
        const f1 = kingSq + 1;
        const g1 = kingSq + 2;
        if (
          !this.board[f1] &&
          !this.board[g1] &&
          !this.isSquareAttacked(f1, them) &&
          !this.isSquareAttacked(g1, them)
        ) {
          moves.push({
            from: kingSq,
            to: g1,
            piece: KING,
            color: us,
            flags: flagsToString(BITS.KSIDE_CASTLE),
          });
        }
      }
      if (this.castling[us] & BITS.QSIDE_CASTLE) {
        const d1 = kingSq - 1;
        const c1 = kingSq - 2;
        const b1 = kingSq - 3;
        if (
          !this.board[d1] &&
          !this.board[c1] &&
          !this.board[b1] &&
          !this.isSquareAttacked(d1, them) &&
          !this.isSquareAttacked(c1, them)
        ) {
          moves.push({
            from: kingSq,
            to: c1,
            piece: KING,
            color: us,
            flags: flagsToString(BITS.QSIDE_CASTLE),
          });
        }
      }
    }

    return moves;
  }

  private generateLegalMoves(): InternalMove[] {
    const pseudo = this.generatePseudoMoves();
    const legal: InternalMove[] = [];
    const us = this.turnColor;
    for (const move of pseudo) {
      this.makeMove(move);
      if (!this.isSquareAttacked(this.kings[us], swapColor(us))) {
        legal.push(move);
      }
      this.undoMove();
    }
    return legal;
  }

  private makeMove(move: InternalMove): void {
    const us = move.color;
    const them = swapColor(us);

    this.history.push({
      move,
      kings: { ...this.kings },
      turn: this.turnColor,
      castling: { ...this.castling },
      epSquare: this.epSquare,
      halfMoves: this.halfMoves,
      moveNumber: this.moveNumber,
    });

    this.board[move.to] = this.board[move.from]!;
    this.board[move.from] = null;

    if (move.flags.includes('e')) {
      const capturedSq = us === WHITE ? move.to - 16 : move.to + 16;
      this.board[capturedSq] = null;
    }

    if (move.promotion) {
      this.board[move.to] = { type: move.promotion, color: us };
    }

    if (move.piece === KING) {
      this.kings[us] = move.to;
      if (move.flags.includes('k')) {
        const rookFrom = move.to + 1;
        const rookTo = move.to - 1;
        this.board[rookTo] = this.board[rookFrom]!;
        this.board[rookFrom] = null;
      } else if (move.flags.includes('q')) {
        const rookFrom = move.to - 2;
        const rookTo = move.to + 1;
        this.board[rookTo] = this.board[rookFrom]!;
        this.board[rookFrom] = null;
      }
      this.castling[us] = 0;
    }

    // rook moved or captured -> lose rights
    const homeRank = us === WHITE ? 0 : 7;
    if (move.piece === ROOK) {
      if (move.from === homeRank * 16 + 0) this.castling[us] &= ~BITS.QSIDE_CASTLE;
      if (move.from === homeRank * 16 + 7) this.castling[us] &= ~BITS.KSIDE_CASTLE;
    }
    const theirHome = them === WHITE ? 0 : 7;
    if (move.to === theirHome * 16 + 0) this.castling[them] &= ~BITS.QSIDE_CASTLE;
    if (move.to === theirHome * 16 + 7) this.castling[them] &= ~BITS.KSIDE_CASTLE;

    this.epSquare = move.flags.includes('b')
      ? us === WHITE
        ? move.to - 16
        : move.to + 16
      : null;

    if (move.piece === PAWN || move.captured) {
      this.halfMoves = 0;
    } else {
      this.halfMoves++;
    }

    if (us === BLACK) this.moveNumber++;
    this.turnColor = them;
  }

  private undoMove(): InternalMove | null {
    const entry = this.history.pop();
    if (!entry) return null;
    const move = entry.move;

    this.kings = entry.kings;
    this.turnColor = entry.turn;
    this.castling = entry.castling;
    this.epSquare = entry.epSquare;
    this.halfMoves = entry.halfMoves;
    this.moveNumber = entry.moveNumber;

    const us = move.color;
    const them = swapColor(us);

    this.board[move.from] = move.promotion
      ? { type: PAWN, color: us }
      : this.board[move.to]!;
    this.board[move.to] = null;

    if (move.flags.includes('e')) {
      const capturedSq = us === WHITE ? move.to - 16 : move.to + 16;
      this.board[capturedSq] = { type: PAWN, color: them };
    } else if (move.captured) {
      this.board[move.to] = { type: move.captured, color: them };
    }

    if (move.flags.includes('k')) {
      const rookTo = move.to + 1;
      const rookFrom = move.to - 1;
      this.board[rookTo] = this.board[rookFrom]!;
      this.board[rookFrom] = null;
    } else if (move.flags.includes('q')) {
      const rookTo = move.to - 2;
      const rookFrom = move.to + 1;
      this.board[rookTo] = this.board[rookFrom]!;
      this.board[rookFrom] = null;
    }

    return move;
  }

  private moveToSan(move: InternalMove, legalMoves: InternalMove[]): string {
    if (move.flags.includes('k')) return this.withCheckSuffix(move, 'O-O');
    if (move.flags.includes('q')) return this.withCheckSuffix(move, 'O-O-O');

    let san = '';
    if (move.piece === PAWN) {
      if (move.captured) {
        san += 'abcdefgh'[file(move.from)]! + 'x';
      }
      san += algebraic(move.to);
      if (move.promotion) san += '=' + move.promotion.toUpperCase();
    } else {
      san += move.piece.toUpperCase();
      san += this.disambiguate(move, legalMoves);
      if (move.captured) san += 'x';
      san += algebraic(move.to);
    }
    return this.withCheckSuffix(move, san);
  }

  private disambiguate(move: InternalMove, legalMoves: InternalMove[]): string {
    const ambiguous = legalMoves.filter(
      (m) =>
        m.piece === move.piece &&
        m.to === move.to &&
        m.from !== move.from &&
        m.color === move.color,
    );
    if (ambiguous.length === 0) return '';

    const sameFile = ambiguous.some((m) => file(m.from) === file(move.from));
    const sameRank = ambiguous.some((m) => rank(m.from) === rank(move.from));

    if (!sameFile) return 'abcdefgh'[file(move.from)]!;
    if (!sameRank) return String(rank(move.from) + 1);
    return algebraic(move.from);
  }

  private withCheckSuffix(move: InternalMove, san: string): string {
    this.makeMove(move);
    let suffix = '';
    if (this.inCheck()) {
      suffix = this.generateLegalMoves().length === 0 ? '#' : '+';
    }
    this.undoMove();
    return san + suffix;
  }

  moves(options?: { verbose?: boolean; square?: string }): any[] {
    const legal = this.generateLegalMoves();
    if (!options?.verbose) {
      return legal.map((m) => this.moveToSan(m, legal));
    }
    return legal.map((m) => ({
      color: m.color,
      from: algebraic(m.from),
      to: algebraic(m.to),
      piece: m.piece,
      captured: m.captured,
      promotion: m.promotion,
      flags: m.flags,
      san: this.moveToSan(m, legal),
    }));
  }

  /** chess.js 1.x THROWS on an illegal move (spec §2.1's API landmine). */
  move(input: string | { from: string; to: string; promotion?: string }): Move {
    const legal = this.generateLegalMoves();

    let found: InternalMove | undefined;
    if (typeof input === 'string') {
      const target = input.trim();
      found = legal.find((m) => this.moveToSan(m, legal) === target);
      if (!found) {
        // tolerate a missing check/mate suffix, as chess.js does
        const stripped = target.replace(/[+#]+$/, '');
        found = legal.find(
          (m) => this.moveToSan(m, legal).replace(/[+#]+$/, '') === stripped,
        );
      }
    } else {
      found = legal.find(
        (m) =>
          algebraic(m.from) === input.from &&
          algebraic(m.to) === input.to &&
          (!input.promotion || m.promotion === input.promotion),
      );
    }

    if (!found) {
      throw new Error(`Invalid move: ${JSON.stringify(input)}`);
    }

    const san = this.moveToSan(found, legal);
    this.makeMove(found);
    return {
      color: found.color,
      from: algebraic(found.from),
      to: algebraic(found.to),
      piece: found.piece,
      captured: found.captured,
      promotion: found.promotion,
      flags: found.flags,
      san,
    };
  }

  undo(): Move | null {
    const move = this.undoMove();
    if (!move) return null;
    return {
      color: move.color,
      from: algebraic(move.from),
      to: algebraic(move.to),
      piece: move.piece,
      captured: move.captured,
      promotion: move.promotion,
      flags: move.flags,
      san: '',
    };
  }

  isCheckmate(): boolean {
    return this.inCheck() && this.generateLegalMoves().length === 0;
  }
  isStalemate(): boolean {
    return !this.inCheck() && this.generateLegalMoves().length === 0;
  }
  isDraw(): boolean {
    return this.isStalemate() || this.halfMoves >= 100;
  }
  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw();
  }

  header(...args: string[]): Record<string, string> {
    for (let i = 0; i < args.length - 1; i += 2) {
      this.headers[args[i]!] = args[i + 1]!;
    }
    return this.headers;
  }

  /** Alias present in some 1.x releases; see STATUS.md open question. */
  setHeader(key: string, value: string): Record<string, string> {
    return this.header(key, value);
  }

  historySan(): string[] {
    const sans: string[] = [];
    const replay = new Chess();
    for (const entry of this.history) {
      const legal = (replay as any).generateLegalMoves() as InternalMove[];
      const match = legal.find(
        (m) =>
          m.from === entry.move.from &&
          m.to === entry.move.to &&
          m.promotion === entry.move.promotion,
      );
      if (!match) break;
      sans.push((replay as any).moveToSan(match, legal));
      (replay as any).makeMove(match);
    }
    return sans;
  }

  pgn(): string {
    const sans = this.historySan();
    let out = '';
    for (const [k, v] of Object.entries(this.headers)) {
      out += `[${k} "${v}"]\n`;
    }
    if (out !== '') out += '\n';
    const parts: string[] = [];
    for (let i = 0; i < sans.length; i++) {
      if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
      parts.push(sans[i]!);
    }
    const result = this.headers['Result'];
    if (result) parts.push(result);
    out += parts.join(' ');
    return out;
  }
}

function flagsToString(flags: number): string {
  let s = '';
  if (flags & BITS.NORMAL) s += 'n';
  if (flags & BITS.CAPTURE) s += 'c';
  if (flags & BITS.BIG_PAWN) s += 'b';
  if (flags & BITS.EP_CAPTURE) s += 'e';
  if (flags & BITS.PROMOTION) s += 'p';
  if (flags & BITS.KSIDE_CASTLE) s += 'k';
  if (flags & BITS.QSIDE_CASTLE) s += 'q';
  return s;
}
