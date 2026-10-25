/**
 * SANDBOX-ONLY held-out check for unwritten moves (skipped pair, half-shift)
 * and for the three noise profiles.
 *
 * verify_s5.ts and scanner:metrics run on the 60-game corpus the decoder was
 * developed on, with one fixed drop point per game. A mechanism that was
 * shaped on those sheets can look better on them than it is. This runner
 * makes sheets nobody looked at while writing the decoder:
 *
 *   - fresh games from seeds outside 1..900 (the corpus was drawn from
 *     those), taken as they come, not selected for features;
 *   - a drop point drawn per game from the whole game, the first rows and
 *     the last ten plies included (verify_s5 never drops before ply 9 or in
 *     the last 12);
 *   - the three noise profiles on the same fresh games, with noise seeds the
 *     corpus runs never use.
 *
 * RULE: this set is for reporting, not for tuning. If the decoder is changed
 * after looking at a held-out result, report the final numbers on another
 * fresh set (--seed with a number not used before) and say so.
 *
 * Usage:
 *   heldout.ts [--seed N] [--games N] [--set heldout|dev]
 *              [--decoder path/to/decoder.ts] [--out file.json]
 *
 * --set dev runs the same report on the development corpus with verify_s5's
 * drop points and scanner:metrics' noise seeds, so both sets come out of one
 * tool in one format. --decoder points at another build of the decoder (a
 * copy of main's, say) for a before/after on identical sheets.
 */
import { Chess } from 'chess.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CORPUS } from '../../src/lib/scanner/__fixtures__/games';
import { aggregate, scoreGame, type GameScore } from '../../src/lib/scanner/metrics';
import { corrupt, makeRng, renderScan, type ProfileName } from '../../src/lib/scanner/synthetic';
import type { DecodedGame, RawScan } from '../../src/lib/scanner/types';

interface Game {
  id: string;
  pgn: string;
  sans: string[];
  result: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const SET = (arg('set') ?? 'heldout') as 'heldout' | 'dev';
const SEED = Number(arg('seed') ?? 20001);
const GAMES = Number(arg('games') ?? 60);
const DECODER = arg('decoder') ?? 'src/lib/scanner/decoder.ts';
const OUT = arg('out');

if (SET === 'heldout' && SEED <= 900) {
  throw new Error('held-out game seeds must be above 900: the corpus was drawn from 1..900');
}

const { decodeScan } = (await import(pathToFileURL(resolve(DECODER)).href)) as {
  decodeScan: (scan: RawScan) => DecodedGame;
};

/** Same generator as genGames.ts: a seeded, legal, not completely silly game. */
function generateGame(seed: number): Game | null {
  const rand = makeRng(seed);
  const chess = new Chess();
  const sans: string[] = [];
  const targetPlies = 40 + Math.floor(rand() * 50);
  while (sans.length < targetPlies) {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) break;
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
  let result: string;
  if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0';
  else if (chess.isDraw()) result = '1/2-1/2';
  else result = ['1-0', '0-1', '1/2-1/2'][Math.floor(makeRng(seed * 7)() * 3)]!;
  const parts: string[] = [];
  sans.forEach((san, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(san);
  });
  parts.push(result);
  return { id: `fresh-${seed}`, pgn: parts.join(' '), sans, result };
}

function freshGames(): Game[] {
  const games: Game[] = [];
  for (let seed = SEED; games.length < GAMES && seed < SEED + GAMES * 4; seed++) {
    const g = generateGame(seed);
    if (g) games.push(g);
  }
  return games;
}

const games: Game[] =
  SET === 'dev' ? CORPUS.filter((g) => g.sans.length >= 30) : freshGames();

/** 0-based index of the first dropped ply. */
function dropPoint(game: Game, index: number, drop: 1 | 2): number {
  const n = game.sans.length;
  if (SET === 'dev') {
    // verify_s5.ts, unchanged (index is the game's place in the corpus)
    let at = 8 + ((index * 7) % (n - 20));
    if (drop === 2 && at % 2 === 1) at++;
    return at;
  }
  const rand = makeRng(SEED * 1009 + index * 2 + drop);
  if (drop === 2) {
    // a whole row: even index, from the second row to the last row that
    // still leaves a written cell after it
    const rows = Math.floor((n - 3) / 2); // starts 2, 4, ..., 2 * rows
    return 2 * (1 + Math.floor(rand() * rows));
  }
  return 2 + Math.floor(rand() * (n - 3)); // 2 .. n - 2
}

type Region = 'opening' | 'middle' | 'ending';
function regionOf(at: number, n: number): Region {
  if (at < 8) return 'opening';
  if (at >= n - 12) return 'ending';
  return 'middle';
}

interface GapRow {
  id: string;
  at: number;
  plies: number;
  region: Region;
  recovered: boolean;
  aligned: boolean;
  firstDivFlagged: boolean;
  gaps: string[];
}

function gapCheck(drop: 1 | 2): GapRow[] {
  const rows: GapRow[] = [];
  const corpusIndex = new Map(CORPUS.map((g, i) => [g.id, i]));
  games.forEach((game, i) => {
    const { sans, result } = game;
    const at = dropPoint(game, SET === 'dev' ? corpusIndex.get(game.id)! : i, drop);
    const kept = [...sans.slice(0, at), ...sans.slice(at + drop)];
    const decoded = decodeScan(renderScan(kept, result));
    const got = decoded.moves.map((m) => m.san);

    // verify_s5's definition: the moves after the gap are back on the true
    // game. The dropped moves cannot be known from the sheet.
    const tail = sans.slice(at + drop);
    const gotTail = got.slice(got.length - tail.length);
    const recovered = tail.length > 0 && gotTail.every((s, j) => s === tail[j]);
    // Stricter: the tail is right AND the decoder made room for the moves
    // that were not written, so every later move sits at its true ply. Near
    // the end of a game the tail can read as written with no room made;
    // "recovered" counts that, this does not.
    const aligned = recovered && got.length === sans.length;

    const firstDiv = sans.findIndex((s, j) => got[j] !== s);
    const m = firstDiv === -1 ? undefined : decoded.moves[firstDiv];
    const firstDivFlagged =
      firstDiv === -1 || (m !== undefined && (m.status === 'flagged' || m.status === 'guessed'));

    rows.push({
      id: game.id,
      at,
      plies: sans.length,
      region: regionOf(at, sans.length),
      recovered,
      aligned,
      firstDivFlagged,
      gaps: gapsOf(decoded),
    });
  });
  return rows;
}

function gapsOf(decoded: DecodedGame): string[] {
  const gaps = (decoded as { gaps?: Array<{ ply: number; plies: number }> }).gaps ?? [];
  return gaps.map((g) => `${g.plies}@${g.ply}`);
}

function printGapCheck(label: string, rows: GapRow[]) {
  const n = rows.length;
  const count = (fn: (r: GapRow) => boolean, of: GapRow[] = rows) => of.filter(fn).length;
  console.log(`\n${label} (${n} sheets, clean but for the gap)`);
  console.log(`  tail recovered:                 ${count((r) => r.recovered)}/${n}`);
  console.log(`  tail recovered and room made:   ${count((r) => r.aligned)}/${n}`);
  console.log(`  first divergence flagged:       ${count((r) => r.firstDivFlagged)}/${n}`);
  console.log(`  a gap is reported:              ${count((r) => r.gaps.length > 0)}/${n}`);
  for (const region of ['opening', 'middle', 'ending'] as const) {
    const of = rows.filter((r) => r.region === region);
    if (of.length === 0) continue;
    console.log(
      `  ${region.padEnd(8)} (${String(of.length).padStart(2)} sheets): recovered ${count((r) => r.recovered, of)}, room made ${count((r) => r.aligned, of)}, flagged ${count((r) => r.firstDivFlagged, of)}`,
    );
  }
}

interface NoiseRow extends GameScore {
  gaps: string[];
  ms: number;
}

function noiseCheck(profile: ProfileName): NoiseRow[] {
  // scanner:metrics seeds the corpus sheets 1000 + index
  const seedBase = SET === 'dev' ? 1000 : SEED * 7 + 100000;
  const corpusIndex = new Map(CORPUS.map((g, i) => [g.id, i]));
  return games.map((game, i) => {
    const index = SET === 'dev' ? corpusIndex.get(game.id)! : i;
    const { scan, truth, truthPlies, applied } = corrupt(game.pgn, seedBase + index, profile);
    const t = performance.now();
    const decoded = decodeScan(scan);
    const ms = performance.now() - t;
    return { ...scoreGame(game.id, decoded, truth, truthPlies, applied), gaps: gapsOf(decoded), ms };
  });
}

function printNoise(profile: ProfileName, rows: NoiseRow[]) {
  const m = aggregate(profile, rows);
  const sum = (fn: (r: NoiseRow) => number) => rows.reduce((a, r) => a + fn(r), 0);
  const pct = (x: number) => (100 * x).toFixed(1) + '%';
  const correct = sum((r) => r.correct);
  const flaggedWrong = sum((r) => r.flaggedAndWrong);
  const injected = (r: NoiseRow) =>
    r.applied.some((a) => a.startsWith('skipped-pair') || a.startsWith('half-shift'));
  const withGap = rows.filter(injected);
  const without = rows.filter((r) => !injected(r));
  const times = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`\n${profile} (${rows.length} sheets)`);
  console.log(
    `  per-move acc ${pct(m.perMoveAccuracy)} | flag recall ${pct(m.flagRecall)} | 1st-div recall ${pct(m.firstDivergenceFlagRecall)} (${m.divergedGames} diverged) | flag precision ${pct(m.flagPrecision)} | exact ${pct(m.gameExactMatch)} | truncation ${pct(m.truncationRate)} | coverage ${pct(m.coverage)}`,
  );
  console.log(
    `  correct ${correct} | wrong ${m.totalWrong} | missing ${sum((r) => r.missing)} | flagged ${m.totalFlagged} | wrong and flagged ${flaggedWrong} | correct moves flagged ${m.totalFlagged - flaggedWrong}`,
  );
  console.log(
    `  gap reported: on ${withGap.filter((r) => r.gaps.length > 0).length} of ${withGap.length} sheets with a skipped pair or half-shift, on ${without.filter((r) => r.gaps.length > 0).length} of ${without.length} without`,
  );
  console.log(
    `  decode time: median ${times[Math.floor(times.length / 2)]!.toFixed(0)} ms, max ${times[times.length - 1]!.toFixed(0)} ms (one pass, not interleaved: indicative only)`,
  );
}

console.log(
  SET === 'dev'
    ? `DEVELOPMENT SET: ${games.length} corpus games, verify_s5 drop points, noise seeds 1000+`
    : `HELD-OUT SET: ${games.length} fresh games from seed ${SEED}, drop points drawn across the whole game`,
);
console.log(`decoder: ${DECODER}`);

const pair = gapCheck(2);
printGapCheck('SKIPPED MOVE PAIR (2 plies not written)', pair);
const single = gapCheck(1);
printGapCheck('HALF-SHIFT (1 ply not written)', single);

const noise: Record<string, NoiseRow[]> = {};
for (const profile of ['clean', 'typical', 'timepressure'] as const) {
  noise[profile] = noiseCheck(profile);
  printNoise(profile, noise[profile]!);
}

if (OUT) {
  writeFileSync(OUT, JSON.stringify({ set: SET, seed: SEED, decoder: DECODER, pair, single, noise }));
  console.log(`\nper-sheet detail written to ${OUT}`);
}
