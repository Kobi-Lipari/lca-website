import assert from 'node:assert/strict';
import { normalizeToken, isResultToken } from '../../src/lib/scanner/normalize';

let passed = 0;
let failed = 0;

function check(label: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`FAIL: ${label}`);
    console.error('  ' + (e as Error).message);
  }
}

const primary = (raw: string) => normalizeToken(raw)[0];

// Castling
check('O-O stays O-O', () => assert.equal(primary('O-O'), 'O-O'));
check('0-0 -> O-O', () => assert.equal(primary('0-0'), 'O-O'));
check('oo -> O-O', () => assert.equal(primary('oo'), 'O-O'));
check('O-O-O stays O-O-O', () => assert.equal(primary('O-O-O'), 'O-O-O'));
check('0-0-0 -> O-O-O', () => assert.equal(primary('0-0-0'), 'O-O-O'));
check('ooo -> O-O-O', () => assert.equal(primary('ooo'), 'O-O-O'));

// Captures
check('Nxf3 unchanged', () => assert.equal(primary('Nxf3'), 'Nxf3'));
check('Nf3 unchanged (no capture written)', () => assert.equal(primary('Nf3'), 'Nf3'));
check('N:f3 -> Nxf3', () => assert.equal(primary('N:f3'), 'Nxf3'));
check('e:d5 -> exd5', () => assert.equal(primary('e:d5'), 'exd5'));

// Check/mate
check('Nf3+ -> Nf3', () => assert.equal(primary('Nf3+'), 'Nf3'));
check('Qh5# -> Qh5', () => assert.equal(primary('Qh5#'), 'Qh5'));
check('Rd8++ -> Rd8', () => assert.equal(primary('Rd8++'), 'Rd8'));

// Promotion
check('e8=Q stays e8=Q', () => assert.equal(primary('e8=Q'), 'e8=Q'));
check('e8Q -> e8=Q', () => assert.equal(primary('e8Q'), 'e8=Q'));
check('e8(Q) -> e8=Q', () => assert.equal(primary('e8(Q)'), 'e8=Q'));
check('e8/Q -> e8=Q', () => assert.equal(primary('e8/Q'), 'e8=Q'));
check('exd8Q -> exd8=Q', () => assert.equal(primary('exd8Q'), 'exd8=Q'));
check('a1N -> a1=N', () => assert.equal(primary('a1N'), 'a1=N'));

// Disambiguation passthrough
check('Nbd2 unchanged', () => assert.equal(primary('Nbd2'), 'Nbd2'));
check('N1d2 unchanged', () => assert.equal(primary('N1d2'), 'N1d2'));
check('Rae1 unchanged', () => assert.equal(primary('Rae1'), 'Rae1'));
check('Ng1f3 unchanged', () => assert.equal(primary('Ng1f3'), 'Ng1f3'));

// Pawn moves / old-style captures
check('e4 unchanged', () => assert.equal(primary('e4'), 'e4'));
check('exd unchanged', () => assert.equal(primary('exd'), 'exd'));
check('ed unchanged (no rank, left alone)', () => assert.equal(primary('ed'), 'ed'));
check('ed5 -> exd5', () => assert.equal(primary('ed5'), 'exd5'));
check('gf6 -> gxf6', () => assert.equal(primary('gf6'), 'gxf6'));

// En passant
check('exd6e.p. -> exd6', () => assert.equal(primary('exd6e.p.'), 'exd6'));
check('exd6 e.p. -> exd6', () => assert.equal(primary('exd6 e.p.'), 'exd6'));

// Kt for knight
check('Ktf3 -> Nf3', () => assert.equal(primary('Ktf3'), 'Nf3'));
check('Ktc3 -> Nc3', () => assert.equal(primary('Ktc3'), 'Nc3'));

// Stripped annotations
check('Nf3! -> Nf3', () => assert.equal(primary('Nf3!'), 'Nf3'));
check('Nf3? -> Nf3', () => assert.equal(primary('Nf3?'), 'Nf3'));
check('Nf3!? -> Nf3', () => assert.equal(primary('Nf3!?'), 'Nf3'));
check('e4= -> e4', () => assert.equal(primary('e4='), 'e4'));

// Confusion-table variants
check('Hf3 contains Nf3', () => assert.ok(normalizeToken('Hf3').includes('Nf3')));
check('Dc4 contains Bc4', () => assert.ok(normalizeToken('Dc4').includes('Bc4')));
check('e9 contains e4', () => assert.ok(normalizeToken('e9').includes('e4')));
check('Nf1+ -> Nf1', () => assert.equal(primary('Nf1+'), 'Nf1'));
check('N+f3 contains Nxf3', () => assert.ok(normalizeToken('N+f3').includes('Nxf3')));

// Misc
check('empty string -> ["" ]', () => assert.deepEqual(normalizeToken(''), ['']));
check('whitespace-only -> [""]', () => assert.deepEqual(normalizeToken('   '), ['']));
check('trims whitespace', () => assert.equal(primary('  Nf3  '), 'Nf3'));
check('Hf3 primary is Hf3, Nf3 is a variant', () => {
  const v = normalizeToken('Hf3');
  assert.equal(v[0], 'Hf3');
  assert.ok(v.includes('Nf3'));
});
check('isResultToken 1-0 true', () => assert.equal(isResultToken('1-0'), true));

// isResultToken suite
check('isResultToken 0-1', () => assert.equal(isResultToken('0-1'), true));
check('isResultToken 1/2-1/2', () => assert.equal(isResultToken('1/2-1/2'), true));
check('isResultToken ½-½', () => assert.equal(isResultToken('½-½'), true));
check('isResultToken draw', () => assert.equal(isResultToken('draw'), true));
check('isResultToken res.', () => assert.equal(isResultToken('res.'), true));
check('isResultToken Nf3 false', () => assert.equal(isResultToken('Nf3'), false));

console.log(`\n${passed} passed, ${failed} failed (of ${passed + failed})`);
if (failed > 0) process.exit(1);
