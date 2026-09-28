import { describe, it, expect } from 'vitest';
import { normalizeToken, isResultToken } from '../normalize';

/** Convenience: assert the primary (first) reading. */
function primary(raw: string): string {
  return normalizeToken(raw)[0]!;
}

describe('normalizeToken - castling (§4.2)', () => {
  it('O-O stays O-O', () => expect(primary('O-O')).toBe('O-O'));
  it('0-0 (digit zero) -> O-O', () => expect(primary('0-0')).toBe('O-O'));
  it('oo (lowercase, no hyphen) -> O-O', () => expect(primary('oo')).toBe('O-O'));
  it('O-O-O stays O-O-O', () => expect(primary('O-O-O')).toBe('O-O-O'));
  it('0-0-0 -> O-O-O', () => expect(primary('0-0-0')).toBe('O-O-O'));
  it('ooo -> O-O-O', () => expect(primary('ooo')).toBe('O-O-O'));
});

describe('normalizeToken - captures (§4.2)', () => {
  it('Nxf3 unchanged (x already present)', () => expect(primary('Nxf3')).toBe('Nxf3'));
  it('Nf3 left as-is when no x written (candidate scorer resolves)', () =>
    expect(primary('Nf3')).toBe('Nf3'));
  it('colon instead of x: N:f3 -> Nxf3', () => expect(primary('N:f3')).toBe('Nxf3'));
  it('colon instead of x: e:d5 -> exd5', () => expect(primary('e:d5')).toBe('exd5'));
});

describe('normalizeToken - check/mate decoration (§4.2)', () => {
  it('Nf3+ -> Nf3 (check stripped)', () => expect(primary('Nf3+')).toBe('Nf3'));
  it('Qh5# -> Qh5 (mate stripped)', () => expect(primary('Qh5#')).toBe('Qh5'));
  it('Rd8++ -> Rd8 (double-plus stripped)', () => expect(primary('Rd8++')).toBe('Rd8'));
});

describe('normalizeToken - promotion (§4.2)', () => {
  it('e8=Q stays e8=Q', () => expect(primary('e8=Q')).toBe('e8=Q'));
  it('e8Q -> e8=Q', () => expect(primary('e8Q')).toBe('e8=Q'));
  it('e8(Q) -> e8=Q', () => expect(primary('e8(Q)')).toBe('e8=Q'));
  it('e8/Q -> e8=Q', () => expect(primary('e8/Q')).toBe('e8=Q'));
  it('capture-promotion exd8Q -> exd8=Q', () => expect(primary('exd8Q')).toBe('exd8=Q'));
  it('underpromotion a1N -> a1=N', () => expect(primary('a1N')).toBe('a1=N'));
});

describe('normalizeToken - disambiguation passthrough (§4.2)', () => {
  it('Nbd2 unchanged', () => expect(primary('Nbd2')).toBe('Nbd2'));
  it('N1d2 unchanged', () => expect(primary('N1d2')).toBe('N1d2'));
  it('Rae1 unchanged', () => expect(primary('Rae1')).toBe('Rae1'));
  it('Ng1f3 (full disambiguation) unchanged', () => expect(primary('Ng1f3')).toBe('Ng1f3'));
});

describe('normalizeToken - pawn moves / old-style captures (§4.2)', () => {
  it('bare square e4 unchanged', () => expect(primary('e4')).toBe('e4'));
  it('exd already has x, unchanged shape (no rank to fix)', () =>
    expect(primary('exd')).toBe('exd'));
  it('ed (no rank visible) left alone, not guessed', () => expect(primary('ed')).toBe('ed'));
  it('ed5 (old-style capture, rank visible) -> exd5', () => expect(primary('ed5')).toBe('exd5'));
  it('gf6 (old-style capture) -> gxf6', () => expect(primary('gf6')).toBe('gxf6'));
});

describe('normalizeToken - en passant (§4.2)', () => {
  it('exd6e.p. -> exd6', () => expect(primary('exd6e.p.')).toBe('exd6'));
  it('exd6 e.p. (with space) -> exd6', () => expect(primary('exd6 e.p.')).toBe('exd6'));
});

describe('normalizeToken - "Kt" for knight (§4.2)', () => {
  it('Ktf3 -> Nf3', () => expect(primary('Ktf3')).toBe('Nf3'));
  it('Ktc3 -> Nc3', () => expect(primary('Ktc3')).toBe('Nc3'));
});

describe('normalizeToken - stripped annotations (§4.2)', () => {
  it('Nf3! -> Nf3', () => expect(primary('Nf3!')).toBe('Nf3'));
  it('Nf3? -> Nf3', () => expect(primary('Nf3?')).toBe('Nf3'));
  it('Nf3!? -> Nf3', () => expect(primary('Nf3!?')).toBe('Nf3'));
  it('e4= (draw-offer mark, not promotion) -> e4', () => expect(primary('e4=')).toBe('e4'));
});

describe('normalizeToken - confusion-table variants (§4.3)', () => {
  it('Hf3 offers Nf3 as a variant (leading H->N)', () => {
    expect(normalizeToken('Hf3')).toContain('Nf3');
  });
  it('Dc4 offers Bc4 as a variant (leading D->B)', () => {
    expect(normalizeToken('Dc4')).toContain('Bc4');
  });
  it('e9 offers e4 as a variant (trailing 9->4 rank fix)', () => {
    expect(normalizeToken('e9')).toContain('e4');
  });
  it('Nf1+ variant Nf1 already primary; + already stripped, no stray +/x confusion needed', () => {
    expect(primary('Nf1+')).toBe('Nf1');
  });
  it('N+f3 mid-token +/x confusion offers Nxf3 as a variant', () => {
    expect(normalizeToken('N+f3')).toContain('Nxf3');
  });
});

describe('normalizeToken - misc / stability', () => {
  it('empty string returns [""]', () => expect(normalizeToken('')).toEqual(['']));
  it('whitespace-only returns [""]', () => expect(normalizeToken('   ')).toEqual(['']));
  it('leading/trailing whitespace trimmed', () => expect(primary('  Nf3  ')).toBe('Nf3'));
  it('primary reading is the cleaned literal token, variants come after', () => {
    const variants = normalizeToken('Hf3');
    // "Hf3" has no deterministic cleanup rule (unlike castling/promotion/etc),
    // so the cleaned token is unchanged and comes first; "Nf3" is offered as
    // a confusion-table variant, not promoted to primary.
    expect(variants[0]).toBe('Hf3');
    expect(variants).toContain('Nf3');
  });
  it('result token 1-0 is not treated as a move by isResultToken', () => {
    expect(isResultToken('1-0')).toBe(true);
  });
});

describe('isResultToken (§4.2)', () => {
  it('1-0', () => expect(isResultToken('1-0')).toBe(true));
  it('0-1', () => expect(isResultToken('0-1')).toBe(true));
  it('1/2-1/2', () => expect(isResultToken('1/2-1/2')).toBe(true));
  it('½-½', () => expect(isResultToken('½-½')).toBe(true));
  it('draw', () => expect(isResultToken('draw')).toBe(true));
  it('res.', () => expect(isResultToken('res.')).toBe(true));
  it('a normal move is not a result token', () => expect(isResultToken('Nf3')).toBe(false));
});
