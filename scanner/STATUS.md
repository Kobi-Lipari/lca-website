# Scoresheet scanner: status

Last updated: 2026-10-04 (unwritten moves, branch `feat/scanner-skipped-pairs`: held-out check added, not ready to merge, see below)

## Where things stand

Week 1 (the decoder core) is complete and was recovered from the August work sessions and now lives in `src/lib/scanner/`. Every check was re-run after the recovery, and the numbers match the originals exactly.

| Check | Result |
|---|---|
| Move generator perft | 17/17 positions |
| `normalize` cases | 52/52 |
| `candidates` cases | 34/34 |
| S3 decoder scenarios | 10/10 |
| Metrics: clean sheets | 100% game accuracy |
| Metrics: typical noise | 96.4% (1st-divergence recall 94.1%, flag recall 83.3%, flag precision 19.1%); was 87.5% (95.2%, 73.9%, 46.6%) |
| Metrics: time pressure | 61.8% (1st-divergence recall 86.4%, flag recall 74.2%, flag precision 63.2%); was 53.3% (88.3%, 77.0%, 72.0%) |
| S5: skipped move pair | 44/60 recovered, 48/60 first divergence flagged; was 0/60 and 17/60 |
| S5: half-move shift | 52/60 recovered, 58/60 first divergence flagged; was 6/60 and 23/60 |

The "was" figures are main at 4c1a466 measured on 2026-10-04 with the real chess.js, same machine and commands as the new ones. They differ a little from the figures this table carried before (87.2%, 52.0%, 40.0% flagged). The reason is the move generator: with `CHESS_SHIM=1` main gives exactly the old figures (typical 87.2% / 95.0% / 71.0% / 46.0%, time pressure 52.0%, S5 half-shift 24/60 = 40.0% flagged). The shim lists legal moves in a different order from chess.js, and the decoder breaks cost ties by that order. The old table was taken with the shim; the browser runs chess.js, so the chess.js figures are the ones to use. All of the above is the development set (the 60-game corpus). The held-out figures are in "Unwritten moves" below and are lower.

## Layout

- `src/lib/scanner/`: the decoder, now part of the app. Types, confusion matrix, SAN normalization, candidate generation, chess.js adapter, beam-search decoder, synthetic sheet generator, metrics, unit tests, fixtures.
  - `decodeInBackground.ts` + `decode.worker.ts`: how the app runs it, in a Web Worker so the page stays responsive.
- `scanner/sandbox/`: offline scripts (perft, fixture generator, S3/S5 checks, metrics, benchmark, output snapshot) plus a small perft-validated move generator (`chess-shim`) used only when chess.js isn't installed.
- `scanner/SCANNER_SPEC.md`: the full design spec.
- The `RawScan` type is defined once, in `src/lib/scanner/types.ts`, and imported by the API client and by `functions/utils/scan/rawScan.ts`.

## Running it

From the repo root:

```
npm test                 # includes the scanner's unit tests
npm run scanner:check    # S3 and S5 decoder checks
npm run scanner:metrics  # accuracy table across noise profiles
npm run scanner:bench    # decode time per game (real chess.js)
npm run scanner:snapshot # hash of 60 decodes; must not change on a pure refactor/speed-up
npm run scanner:heldout  # fresh games, gaps dropped anywhere, noise profiles; --seed N, --decoder path, --set dev
```

In a workspace without chess.js installed, prefix with `CHESS_SHIM=1` to use the sandbox move generator. Shim timings are meaningless for the browser.

## Speed

Measured with the real chess.js 1.4, per game (desktop, Node 22):

| profile | before | after |
|---|---|---|
| clean | 5.7s | 0.7s |
| typical | 6.8s | 0.75s |
| time pressure | 18.4s | 1.1s |

Three changes, output identical (snapshot hash) apart from one tie in 60 sheets: plain `moves()` instead of verbose (16x cheaper per position); inserted-ply lookahead skipped when its lower-bound cost can't survive the prune; prune ties broken by the survivor's own position. Remaining time is split between chess.js move generation/application and edit-distance scoring. If phones turn out too slow, next idea: key beam deduplication on parent FEN + SAN so a move's resulting FEN is only computed for survivors (applyMove is ~45% of the rest).

## Fixed since recovery

- **Silent tail truncation (2026-09-27).** When the last written cells were unreadable, the decoder skipped them and returned a shorter game with no warning and no `truncatedAtPly`, so it looked complete. It now reports truncation there. Found because the real vitest run failed `truncates rather than inventing moves`: that test had never run under vitest before (the August checks used the sandbox scripts), and it passed vacuously on an empty tail. Accuracy numbers are unchanged.

## Unwritten moves (branch `feat/scanner-skipped-pairs`, not ready to merge)

- `src/lib/scanner/gaps.ts`: at a cell with no clean legal reading, the decoder asks whether one or two unwritten moves at or before it make that cell and the ones after it read exactly as written. The unknown moves are worked out from what the later cells need. A plan needs three exact cells behind it, goes at the earliest cell that fits, and joins the beam as one hypothesis with one price (pair 2.0, single ply 2.5).
- The stand-in moves are `guessed` with `sourceRaw: null` and `unwritten: true`. `DecodedGame.gaps` says where each gap is, how many plies, how late it could be, and carries a sentence for the page ("A move pair seems to be missing after move 14. ...").
- A blank cell's guess is taken from what later cells need. When the later cells cannot tell two guesses apart, the ordinary order decides (next cell, then recapture, check, capture). When a later cell contradicts the guess it is revised: the cell that needed the revision must then read exactly, and whatever the revision costs the cells in between is charged.
- The page says "not on the sheet" for a move that has no cell (`unwritten`), and "blank on the sheet" only for a guess in an empty cell. Wording and the needs-a-look count are in `src/lib/scanner/moveSource.ts`.
- `forcedSans` holds inside and around a gap (tested).
- Tests: `src/lib/scanner/__tests__/gaps.test.ts`, `moveSource.test.ts`.

### Held-out check

`npm run scanner:heldout` makes 60 fresh games from seeds the corpus never used (not selected for features), drops a pair or a single ply anywhere from the second row to the last written cell, and runs the three noise profiles on the same games. `--seed N` picks the set, `--decoder path` runs another build of the decoder on identical sheets, `--set dev` prints the development set in the same format. The set is for reporting, not tuning: after a decoder change made with held-out numbers in view, report on a seed not used before.

Two sets were used. Set A (seed 31001) was run on main and on the branch before this stage changed the decoder. The decoder was then changed (blank-cell guesses only, traced on development sheets), so the final figures are on set B (seed 47001), which nothing was tuned on.

| | dev: main | dev: branch | held-out A: main | A: branch before | held-out B: main | B: branch now | aim |
|---|---|---|---|---|---|---|---|
| Skipped pair: tail recovered | 0/60 | 44/60 | 3/60 | 32/60 | 6/60 | 36/60 | 48/60 |
| ... and room made for the missing moves | 0/60 | 44/60 | 0/60 | 29/60 | 0/60 | 30/60 | |
| Skipped pair: first divergence flagged | 17/60 | 48/60 | 24/60 | 40/60 | 22/60 | 36/60 | 54/60 |
| Half-shift: tail recovered | 6/60 | 52/60 | 6/60 | 42/60 | 3/60 | 41/60 | 48/60 |
| Half-shift: first divergence flagged | 23/60 | 58/60 | 30/60 | 47/60 | 18/60 | 46/60 | 54/60 |
| Clean per-move accuracy | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| Typical: accuracy / flag recall / 1st-div recall / flag precision | 87.5 / 73.9 / 95.2 / 46.6 | 96.4 / 83.3 / 94.1 / 19.1 | 86.6 / 76.4 / 94.9 / 51.8 | 93.1 / 74.4 / 82.9 / 28.8 | 85.9 / 69.8 / 85.0 / 53.3 | 91.4 / 60.1 / 82.9 / 34.1 | not worse |
| Typical: flagged in all / correct moves flagged / wrong moves not flagged | 584 / 312 / 96 | 446 / 361 / 17 | 620 / 299 / 99 | 465 / 331 / 46 | 662 / 309 / 153 | 549 / 362 / 124 | |
| Time pressure: same four | 53.3 / 77.0 / 88.3 / 72.0 | 61.8 / 74.2 / 86.4 / 63.2 | 47.2 / 74.1 / 89.7 / 74.2 | 53.2 / 68.2 / 87.7 / 66.4 | 46.9 / 74.3 / 83.1 / 73.5 | 57.4 / 70.1 / 83.1 / 63.1 | not worse |
| Time pressure: flagged in all / correct moves flagged / wrong moves not flagged | 1583 / 444 / 340 | 1457 / 536 / 321 | 1650 / 425 / 429 | 1521 / 511 / 471 | 1584 / 420 / 402 | 1475 / 544 / 398 | |
| Gap reported on a noisy sheet that has none (typical; time pressure) | 0; 0 | 1 of 60; 1 of 40 | 0; 0 | 1 of 60; 6 of 33 | 0; 0 | 2 of 60; 3 of 32 | 0 |

"Tail recovered" is verify_s5's measure: the moves after the gap are the true moves. Near the end of a game the few cells after a missing pair can read as written with no room made, which that measure counts; the row under it does not.

What the held-out sets show that the development set did not:

- **A skipped pair recovers on 32 and 36 of 60 fresh sheets, not 44,** and the first divergence is flagged on 40 and 36, not 48. Both aims are missed by a wide margin. The half-shift recovers on 42 and 41 of 60 (aim 48) and is flagged on 47 and 46 (aim 54); on the development set it met both.
- **Typical first-divergence recall fell on set A (94.9% to 82.9%)** although wrong moves that are not flagged fell from 99 to 46. On the one development sheet traced (synth-35) the newly unflagged first divergence is a misread that happens to be a legal move as written ("Kc8" for Rc8); main gets the same move wrong and unflagged, but an earlier flagged error came first. Whether that explains all of the set A sheets was not checked (the held-out set is not to be traced).
- **Flag recall is below main under noise on the held-out sets:** typical 76.4% to 74.4% (A) and 69.8% to 60.1% (B); time pressure 74.1% to 68.2% (A) and 74.3% to 70.1% (B). On set A the number of wrong time-pressure moves with no flag rose (429 to 471); on set B it is level (402 to 398). A gap reported where none was dropped moves every later move to the wrong move number with nothing to flag it; that happened on 6 of 33 set A sheets before this stage's changes and on 3 of 32 set B sheets after them. The two sets are different sheets, so that is not a before and after.

### Flag precision, and what tells the review burden

Flag precision is wrong-and-flagged over all flagged, so it falls when fewer moves are wrong, even if no flag was added. On the development set (typical) main flags 584 moves and the branch 446. Of the branch's 361 correct-but-flagged moves, 297 are the same moves main flags, 60 are moves main got wrong (most of them flagged there too), and 4 are newly flagged; 7 that main flagged are now clear. Time pressure: 1583 flagged against 1457; of 536 correct-but-flagged, 411 the same as main, 114 moves main had wrong or missing, 7 newly flagged, 8 cleared. So the count of correct moves flagged rose (312 to 361, 444 to 536) because moves moved from wrong-and-flagged to right-and-flagged, and it cannot come back to main's count without unflagging moves the decoder now gets right from a noisy cell. What a member has to look at, the flagged total, went down in every set measured.

### Not done, and known regressions

- **Not ready to merge.** Held-out recovery is well short of the aims, time-pressure flag recall is below main, and gaps are still reported on noisy sheets that have none.
- **Sheets that decode worse than on main** (development set, fewer correct plies): typical 3 (synth-90 41 to 40, synth-141 46 to 44, synth-40 70 to 69) against 24 better; time pressure 6 (synth-18 40 to 31, synth-13 30 to 20, synth-111 51 to 48, synth-151 50 to 48, synth-39 21 to 19, synth-7 29 to 28) against 32 better. Two of the typical ones were traced to a blank cell where main's guess happened to be the played move (a capture) and the new guess is another move that reads the later cells as well. The tie rule was written for that and did not change them, so the trace is incomplete. Snapshot: typical synth-42 (5 wrong to 8) and time-pressure synth-43 (66+9 to 69+7) are still worse and untraced.
- **Gaps that are not there.** Fixed: the snapshot sheet that reported a pair at move 3 (a wrong blank guess; it is now revised). Remaining on the development set: typical synth-23 (a garbled cell after a wrong blank guess is skipped and a single stand-in put in its place: the tail comes back, 41 of 44 plies right against 5 on main, but the sentence says a move is missing when the cell is there and unreadable) and time-pressure synth-18 (a pair after a wrong blank guess; 31 plies right against 40 on main).
- **Time-pressure truncation** rose from 3 sheets to 6 of 60 (development set).
- **Speed.** Time pressure was 1.40x to 1.43x main's median on a quiet machine before this stage; nothing here was aimed at it except one memo. The one interleaved run of the final code (3 rounds) was taken while other runs loaded the machine: clean 0.98x, typical 1.19x (worst sheet 1.65x), time pressure 1.19x at the median with per-round medians of 1.47x, 0.97x and 1.33x, worst sheet 2.24x, 5 of 8 sheets over 1.3x. Treat the aim of 1.3x as not met until it is measured quietly. Lowering the work cap from 4000 to 2500 was tried: time-pressure accuracy 61.8% to 59.1% and one S5 pair lost, speed not measured. Left at 4000.
- **Skipped pairs: no change to the mechanism.** Still 44/60 and 48/60 on the development set. The 8 sheets where the gap is found and loses on price were not worked on.
- **Snapshot hash changed.** 24 of its 60 sheets decode differently from main: no clean sheet, 11 typical, 13 time pressure. By wrong and missing plies: 13 better, 2 worse, 5 equal with different moves, 4 with the same moves (alternatives, confidence, or the `unwritten` mark on a ply main also inserted). Every changed sheet has a blank cell or a structural corruption.

## Known gaps

- **Skipped move pairs** recover on 44 of 60 development sheets and 32 to 36 of 60 fresh ones, and rarely under time-pressure noise. See above.
- **Flag precision** is low: about 10% of correct moves are flagged on typical noise, before and after. See "Flag precision" above for why the percentage fell.
- The confusion matrix is hand-built. Replace it with counts from real transcriptions once there are some.

## Week 2

### S1: `POST /api/scan` (done, merged in #56)

- `functions/api/scan/index.ts`: members only (`requireAuthedMember`), takes the photo as the raw request body (JPEG, PNG or WebP, max 3.5MB, same style as the club-logo upload), returns `{ scan: RawScan, scansLeftToday }`. Photo is never stored.
- `functions/utils/scan/extract.ts`: the model call and the extraction prompt (verbatim rule stated twice, per §6.2). Model is the `SCAN_MODEL` constant, currently `claude-sonnet-5`. No `temperature` parameter: the model rejects it (found on the first live scan).
- `functions/utils/scan/rawScan.ts`: turns the model's reply into a `RawScan`. Forgiving about shape (fences, chatter, numbers where strings belong, bare-string cells), strict only about having rows. Never touches the move text.
- Daily limit: 20 scans per member per UTC day, in D1 (`migrations/0035_scan_usage.sql`). Claimed with one upsert so parallel scans can't slip past it; handed back when the model fails or answers with junk.
- Errors: 401 anonymous, 415 wrong type, 400 empty, 413 too big, 429 over the limit, 502 model failed or unreadable reply, 503 model busy or key not set.
- Client: `downscaleImage()` in `src/lib/resizeImage.ts` (1568px long edge, JPEG 0.8, honours phone rotation) and `scanScoresheet()` in `src/lib/api.ts`.
- Tests: `test/unit/scan-raw.test.ts` (23 cases; passed here with a stand-in runner) and `test/integration/scan.test.ts` (auth, input checks, prompt contents, recovery, refunds, limit). The harness now mocks `api.anthropic.com`.

**Before it works live:**

1. `npm run db:migrate:remote` for the new `scan_usage` table.
2. Add `ANTHROPIC_API_KEY` as a secret in the Cloudflare Pages dashboard (production), and in `.dev.vars` for local dev (already gitignored).

Run the migration first. Without the key, `/api/scan` answers 503; with the key but no table, it would fail with a 500. Nothing else on the site is affected either way.

### Decisions made (defaults from the spec, change if K prefers)

- Rate limit lives in D1, not KV: one tiny table, no new binding.
- Limit resets at midnight UTC (7pm Central in winter, 6pm in summer).
- The `RawScan` type lives in `src/lib/scanner/types.ts`; the Functions side imports it type-only.

### S2: decoder in the browser (done, merged in #57)

- Decoder moved from the `scanner/` workspace into `src/lib/scanner/`; `chess.js ^1.4.0` added to the app's dependencies.
- `decodeInBackground(scan)` runs it in a Web Worker (fresh per decode), falling back to the main thread where workers don't exist.
- Decoder made 8-16x faster (see Speed).

## Week 3

### S1: `/scanner` page (this branch)

- `src/pages/ScannerPage.tsx`, public route `/scanner`, in the navbar (after News) and the footer's Play column. K's call: visible to everyone; signed-out visitors get a "Log in to scan" prompt that returns them to the page after login.
- Flow: take or choose a photo → preview → "Reading the handwriting…" (`/api/scan`) → "Checking the moves…" (Web Worker) → results. Unreadable sheets, daily limit, expired session and network failures each get their own message.
- Results: players, result, move count, and how many moves need a look; move table with flagged/guessed moves in amber (what was written, and the next-best readings) and fuzzy-corrected moves outlined; "Open in lichess" (analysis board via `lichess.org/analysis/pgn/<moves>`, no API call), "Copy & open chess.com", "Copy PGN", "Scan another"; scans left today.
- `src/lib/scanner/export.ts`: PGN headers from the scan (dates and ratings only when PGN-valid) and the lichess link. Tested.
- Same branch, K's navbar requests: player links inline (Tournaments, Scholastic, Clubs, News, Scanner); a "More" menu holds Governance and Membership, plus Admin panel / Board inbox for the accounts that get them. Governance is a plain link that opens Board members; the old `/governance` landing page redirects there, and governance pages now show their section links as tabs on phones (the sidebar only shows on wide screens).

### Decisions made

- lichess analysis link instead of the import API (§8): no server call, no rate limit, and the member can fix moves on the board. The import API (permanent game URL) can come later if wanted.
- chess.com: no link format or API can open a game there (its Published-Data API is read-only), so "Copy & open chess.com" copies the PGN and opens its analysis board for the member to paste. Worth re-checking if chess.com ever documents a PGN-in-URL option.

### S2: fixing moves on the page (this branch)

- Tap any move → picker with what was written, the likeliest readings ("Keep X" confirms the current one), every legal move in that position, and a search box ("nf3" finds Nxf3+).
- Picking a move re-decodes the rest of the game with every move up to and including it forced (`DecodeOptions.forcedSans`, respected by matches and inserted plies alike, so a forced move can still align with a blank cell). Moves the member fixed show green and stop counting as needing a look; fixes after the changed move are dropped, since their position may no longer arise. Undo steps back one change.
- Decoder output is unchanged when nothing is forced (snapshot hash identical). Tests: a forced move is played and the prefix kept; forcing the true move after a legal misread (Nc3 for Nf3) makes the whole rest of the game decode exactly.
- The "Noticed on the sheet" notes under the results were removed at K's request (they still explain an unreadable sheet).

### S3: save and share (this branch)

- Results actions grouped as **Analyze** (lichess, chess.com) and **Keep**: **Share** (device share sheet with the PGN file attached and the lichess link; only shown where `navigator.share` exists), or **Email** where there's no share sheet (`mailto:` with the lichess link, plus the PGN text when the link stays under ~1,900 characters; browsers can't attach files to mailto), **Save PGN** (download named `White-vs-Black-YYYY-MM-DD.pgn` from surnames, falling back to `scanned-game-<date>.pgn`), **Copy PGN**, Scan another. All use the corrected game.

### S4: games on more than one page (this branch)

- Up to 3 pages per game (front, back, continuation sheet), added in order on the preview screen, each removable. Pages are scanned in parallel (one daily scan each) and joined by `src/lib/scanner/mergePages.ts` before decoding.
- Joining rules: where printed move numbers overlap, the earlier page wins and a later page only fills its blanks (§3.1); a later page that restarts at 1 after moves were already written is renumbered to follow on (continuation sheets restart their printed numbers). Header from page 1, gaps filled from later pages, worst legibility reported.
- Tests: seven cases, including a game split across a sheet and a renumbered continuation sheet decoding exactly as the one-page original.

### Next

- Real-sheet evaluation (§6.3): 20–40 real scoresheets, dev/holdout split.
