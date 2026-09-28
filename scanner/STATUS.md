# Scoresheet scanner: status

Last updated: 2026-09-27

## Where things stand

Week 1 (the decoder core) is complete and was recovered from the August work sessions into this `scanner/` workspace. Every check was re-run after the recovery, and the numbers match the originals exactly.

| Check | Result |
|---|---|
| Move generator perft | 17/17 positions |
| `normalize` cases | 52/52 |
| `candidates` cases | 34/34 |
| S3 decoder scenarios | 10/10 |
| Metrics: clean sheets | 100% game accuracy |
| Metrics: typical noise | 87.2% (1st-divergence recall 95.0%, flag recall 71.0%, flag precision 46.0%) |
| Metrics: time pressure | 52.1% |
| S5: skipped move pair | 0/60 recovered (26.7% flagged) |
| S5: half-move shift | 6/60 recovered |

## Layout

- `src/lib/scanner/`: types, confusion matrix, SAN normalization, candidate generation, chess.js adapter, beam-search decoder, synthetic sheet generator, metrics, unit tests, fixtures.
- `sandbox/`: offline scripts (perft, fixture generator, S3/S5 checks, metrics, profiling) plus a small perft-validated move generator (`chess-shim`) used only when the real chess.js isn't installed.
- `SCANNER_SPEC.md`: the full design spec.

This lives in its own workspace so it doesn't touch the site's build (`tsconfig.app.json` only includes `src/`). It will move into the app when the upload UI is built.

## Running it

With dependencies installed (the normal way):

```
cd scanner
npm install
npm test
npm run typecheck
npm run check:s3
npm run metrics
```

Without installing anything (Node 22+, uses the shim instead of chess.js):

```
npm run offline -- sandbox/verify_s3.ts
```

## Known gaps

- **Skipped move pairs.** When a player skips writing a whole move pair, the decoder can't realign and falls back to flagging. Fixing this needs game-level alignment hypotheses (try "a pair is missing here" as a branch in the beam) rather than per-cell repairs.
- **Flag precision (46%)** is low: too many correct moves are flagged for review. Tune after real scans are available, since the synthetic noise model is the main guess here.
- The confusion matrix is hand-built. Replace it with counts from real transcriptions once there are some.

## Week 2

### S1: `POST /api/scan` (written, waiting on K's test run)

- `functions/api/scan/index.ts`: members only (`requireAuthedMember`), takes the photo as the raw request body (JPEG, PNG or WebP, max 3.5MB, same style as the club-logo upload), returns `{ scan: RawScan, scansLeftToday }`. Photo is never stored.
- `functions/utils/scan/extract.ts`: the model call and the extraction prompt (verbatim rule stated twice, per §6.2). Model is the `SCAN_MODEL` constant, currently `claude-sonnet-5`, temperature 0.
- `functions/utils/scan/rawScan.ts`: turns the model's reply into a `RawScan`. Forgiving about shape (fences, chatter, numbers where strings belong, bare-string cells), strict only about having rows. Never touches the move text.
- Daily limit: 20 scans per member per UTC day, in D1 (`migrations/0035_scan_usage.sql`). Claimed with one upsert so parallel scans can't slip past it; handed back when the model fails or answers with junk.
- Errors: 401 anonymous, 415 wrong type, 400 empty, 413 too big, 429 over the limit, 502 model failed or unreadable reply, 503 model busy or key not set.
- Client: `downscaleImage()` in `src/lib/resizeImage.ts` (1568px long edge, JPEG 0.8, honours phone rotation) and `scanScoresheet()` in `src/lib/api.ts`.
- Tests: `test/unit/scan-raw.test.ts` (23 cases; passed here with a stand-in runner) and `test/integration/scan.test.ts` (auth, input checks, prompt contents, recovery, refunds, limit). The harness now mocks `api.anthropic.com`.

**K to run** (the real vitest and Workers runtime can't be installed in Claude's workspace):

```
npm test && npm run test:integration && npm run typecheck:functions && npm run build
```

**Before it works live:**

1. `npm run db:migrate:remote` for the new `scan_usage` table.
2. Add `ANTHROPIC_API_KEY` as a secret in the Cloudflare Pages dashboard (production), and in `.dev.vars` for local dev (already gitignored).

Run the migration first. Without the key, `/api/scan` answers 503; with the key but no table, it would fail with a 500. Nothing else on the site is affected either way.

### Decisions made (defaults from the spec, change if K prefers)

- Rate limit lives in D1, not KV: one tiny table, no new binding.
- Limit resets at midnight UTC (7pm Central in winter, 6pm in summer).
- The `RawScan` type is written out in three places for now (scanner, functions, api.ts). One shared definition once the scanner moves into `src/`.

### Next

- **S2:** run the decoder in the browser on the returned scan.
- **S3:** review screen for flagged moves, then PGN export and lichess import (`POST /api/scan/lichess`).
- Week 3 S1 needs `App.tsx` routes, `Navbar.tsx` and a `PageHero` usage example, plus K's call on the route (`/scanner`?) and nav placement.
