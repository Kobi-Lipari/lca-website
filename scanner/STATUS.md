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

## Next: Week 2

1. **S1: `POST /api/scan`.** Pages Function that takes a resized image, sends it to the vision model with the verbatim-transcription prompt, and returns the raw cells. Follow the patterns in `functions/utils/response.ts`, `functions/utils/auth.ts` and the club-logo endpoints; resize client-side with `src/lib/resizeImage.ts`. Integration test with the external API mocked, like the existing ones.
2. **S2:** run the decoder in the browser on the returned cells.
3. **S3:** review screen for flagged moves, then PGN export and lichess import.
