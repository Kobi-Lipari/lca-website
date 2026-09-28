/**
 * SANDBOX-ONLY generator for the Week 1 test corpus.
 *
 * Spec §5.8 wants 50+ varied public-domain PGNs including promotions,
 * castling both sides, en passant, underpromotion and disambiguation-heavy
 * knight games. With no network access I can't fetch a real PGN database,
 * so this does two things:
 *   1. validates games recalled from memory against the engine, and DROPS
 *      any that don't validate (rather than shipping a wrong "famous game")
 *   2. generates seeded pseudo-random legal games, then SELECTS for the
 *      feature coverage §5.8 asks for
 *
 * Output is written to src/lib/scanner/__fixtures__/games.ts so the corpus
 * is deterministic and checked in. K should swap in real PGNs when he has
 * network - see STATUS.md.
 */
import { Chess } from 'chess.js';
import { writeFileSync } from 'node:fs';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Game {
  id: string;
  sans: string[];
  result: string;
}

function validate(sans: string[]): { ok: boolean; failedAt?: number } {
  const chess = new Chess();
  for (let i = 0; i < sans.length; i++) {
    const legal = chess.moves({ verbose: true }).map((m: any) => m.san);
    if (!legal.includes(sans[i]!)) return { ok: false, failedAt: i };
    chess.move(sans[i]!);
  }
  return { ok: true };
}

const recalled: Array<{ id: string; text: string; result: string }> = [
  {
    id: 'opera-game',
    result: '1-0',
    text: `e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6
           Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7
           Qb8+ Nxb8 Rd8#`,
  },
  {
    id: 'immortal-game',
    result: '1-0',
    text: `e4 e5 f4 exf4 Bc4 Qh4+ Kf1 b5 Bxb5 Nf6 Nf3 Qh6 d3 Nh5 Nh4 Qg5
           Nf5 c6 g4 Nf6 Rg1 cxb5 h4 Qg6 h5 Qg5 Qf3 Ng8 Bxf4 Qf6 Nc3 Bc5
           Nd5 Qxb2 Bd6 Bxg1 e5 Qxa1+ Ke2 Na6 Nxg7+ Kd8 Qf6+ Nxf6 Be7#`,
  },
  {
    id: 'evergreen-game',
    result: '1-0',
    text: `e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O d3 Qb3 Qf6
           e5 Qg6 Re1 Nge7 Ba3 b5 Qxb5 Rb8 Qa4 Bb6 Nbd2 Bb7 Ne4 Qf5
           Bxd3 Qh5 Nf6+ gxf6 exf6 Rg8 Rad1 Qxf3 Rxe7+ Nxe7 Qxd7+ Kxd7
           Bf5+ Ke8 Bd7+ Kf8 Bxe7#`,
  },
];

const games: Game[] = [];

console.log('--- validating recalled games ---');
for (const r of recalled) {
  const sans = r.text.trim().split(/\s+/);
  const v = validate(sans);
  if (v.ok) {
    console.log(`KEEP  ${r.id} (${sans.length} plies)`);
    games.push({ id: r.id, sans, result: r.result });
  } else {
    console.log(
      `DROP  ${r.id} - illegal at ply ${v.failedAt! + 1} ("${sans[v.failedAt!]}") - misremembered, not shipping it`,
    );
  }
}

/** Play a pseudo-random but not-completely-silly legal game. */
function generateGame(seed: number): Game | null {
  const rand = mulberry32(seed);
  const chess = new Chess();
  const sans: string[] = [];
  const targetPlies = 40 + Math.floor(rand() * 50);

  while (sans.length < targetPlies) {
    const moves = chess.moves({ verbose: true }) as any[];
    if (moves.length === 0) break;
    // Mild weighting so games look game-ish: favour captures/checks/development.
    const weighted = moves.map((m) => {
      let w = 1;
      if (m.captured) w += 3;
      if (m.san.includes('+')) w += 2;
      if (m.san.startsWith('O-O')) w += 6;
      if (m.promotion) w += 5;
      if (m.piece === 'n' || m.piece === 'b') w += 1;
      if (m.piece === 'k' && !m.san.startsWith('O-O')) w -= 0.7;
      if (m.piece === 'q') w -= 0.3;
      return { m, w: Math.max(0.1, w) };
    });
    const total = weighted.reduce((a, b) => a + b.w, 0);
    let pick = rand() * total;
    let chosen = weighted[0]!.m;
    for (const entry of weighted) {
      pick -= entry.w;
      if (pick <= 0) {
        chosen = entry.m;
        break;
      }
    }
    sans.push(chosen.san);
    chess.move(chosen.san);
    if (chess.isGameOver()) break;
  }

  if (sans.length < 30) return null;

  let result = '*';
  if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
  else if (chess.isDraw()) result = '1/2-1/2';
  else result = ['1-0', '0-1', '1/2-1/2'][Math.floor(mulberry32(seed * 7)() * 3)]!;

  return { id: `synth-${seed}`, sans, result };
}

interface Features {
  castleK: boolean;
  castleQ: boolean;
  promotion: boolean;
  underpromotion: boolean;
  enPassant: boolean;
  disambiguation: boolean;
}

function featuresOf(sans: string[]): Features {
  const chess = new Chess();
  let enPassant = false;
  for (const san of sans) {
    const move = chess.move(san) as any;
    if (move.flags.includes('e')) enPassant = true;
  }
  return {
    castleK: sans.includes('O-O') || sans.some((s) => s.startsWith('O-O') && !s.startsWith('O-O-O')),
    castleQ: sans.some((s) => s.startsWith('O-O-O')),
    promotion: sans.some((s) => s.includes('=')),
    underpromotion: sans.some((s) => /=[RBN]/.test(s)),
    enPassant,
    disambiguation: sans.some((s) => /^[KQRBN][a-h1-8][a-h][1-8]/.test(s)),
  };
}

console.log('\n--- generating synthetic games ---');
const pool: Array<Game & { f: Features }> = [];
for (let seed = 1; seed <= 900 && pool.length < 400; seed++) {
  const g = generateGame(seed);
  if (!g) continue;
  const v = validate(g.sans);
  if (!v.ok) continue;
  pool.push({ ...g, f: featuresOf(g.sans) });
}
console.log(`generated ${pool.length} valid games`);

// Select for feature coverage first, then top up to 60 total.
const selected: Game[] = [...games];
const need: Array<keyof Features> = [
  'castleQ',
  'promotion',
  'underpromotion',
  'enPassant',
  'disambiguation',
  'castleK',
];
for (const feature of need) {
  const have = pool.filter((g) => g.f[feature] && !selected.some((s) => s.id === g.id));
  for (const g of have.slice(0, 5)) {
    selected.push({ id: g.id, sans: g.sans, result: g.result });
  }
  console.log(`${feature}: ${have.length} available, took ${Math.min(5, have.length)}`);
}
for (const g of pool) {
  if (selected.length >= 60) break;
  if (!selected.some((s) => s.id === g.id)) {
    selected.push({ id: g.id, sans: g.sans, result: g.result });
  }
}

console.log(`\nfinal corpus: ${selected.length} games`);
const coverage = selected.map((g) => featuresOf(g.sans));
for (const feature of need) {
  console.log(`  ${feature}: ${coverage.filter((c) => c[feature]).length} games`);
}

function toPgn(g: Game): string {
  const parts: string[] = [];
  for (let i = 0; i < g.sans.length; i++) {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(g.sans[i]!);
  }
  parts.push(g.result);
  return parts.join(' ');
}

const out = `/**
 * Week 1 test corpus. GENERATED by sandbox/genGames.ts - do not hand-edit.
 *
 * Spec §5.8 asks for 50+ varied public-domain games. The famous games here
 * were recalled and then VALIDATED against the engine (anything that did
 * not validate was dropped rather than shipped wrong). The rest are seeded
 * pseudo-random legal games, selected for the feature coverage §5.8 names:
 * castling both sides, promotion, underpromotion, en passant, and
 * disambiguation.
 *
 * These are stand-ins. When network is available, replacing the synth-*
 * entries with real classical games is a drop-in change - nothing else
 * depends on their provenance.
 */

export interface CorpusGame {
  id: string;
  pgn: string;
  sans: string[];
  result: string;
}

export const CORPUS: CorpusGame[] = ${JSON.stringify(
  selected.map((g) => ({ id: g.id, pgn: toPgn(g), sans: g.sans, result: g.result })),
  null,
  2,
)};
`;

writeFileSync(
  new URL('../../src/lib/scanner/__fixtures__/games.ts', import.meta.url),
  out,
);
console.log('\nwrote src/lib/scanner/__fixtures__/games.ts');
