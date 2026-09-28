# Scoresheet scanner: status

Last updated: 2026-09-28 (scanner page)

## Where things stand

Week 1 (the decoder core) is complete and was recovered from the August work sessions and now lives in `src/lib/scanner/`. Every check was re-run after the recovery, and the numbers match the originals exactly.

| Check | Result |
|---|---|
| Move generator perft | 17/17 positions |
| `normalize` cases | 52/52 |
| `candidates` cases | 34/34 |
| S3 decoder scenarios | 10/10 |
| Metrics: clean sheets | 100% game accuracy |
| Metrics: typical noise | 87.2% (1st-divergence recall 95.0%, flag recall 71.0%, flag precision 46.0%) |
| Metrics: time pressure | 52.0% (52.1% before the prune tie-break change) |
| S5: skipped move pair | 0/60 recovered (40.0% flagged; was 26.7% before the tail-truncation fix below) |
| S5: half-move shift | 6/60 recovered |

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

## Known gaps

- **Skipped move pairs.** When a player skips writing a whole move pair, the decoder can't realign and falls back to flagging. Fixing this needs game-level alignment hypotheses (try "a pair is missing here" as a branch in the beam) rather than per-cell repairs.
- **Flag precision (46%)** is low: too many correct moves are flagged for review. Tune after real scans are available, since the synthetic noise model is the main guess here.
- The confusion matrix is hand-built. Replace it with counts from real transcriptions once there are some.

## Week 2

### S1: `POST /api/scan` (done, merged in #56)

- `functions/api/scan/index.ts`: members only (`requireAuthedMember`), takes the photo as the raw request body (JPEG, PNG or WebP, max 3.5MB, same style as the club-logo upload), returns `{ scan: RawScan, scansLeftToday }`. Photo is never stored.
- `functions/utils/scan/extract.ts`: the model call and the extraction prompt (verbatim rule stated twice, per §6.2). Model is the `SCAN_MODEL` constant, currently `claude-sonnet-5`. No `temperature` parameter: the model rejects it (found on the first live scan).
- `functions/utils/scan/rawScan.ts`: turns the model's reply into a `RawScan`. Forgiving about shape (fences, chatter, numbers where strings belong, bare-string cells), strict only about having rows. Never touches the move text.
- Daily limit: now 5 **games** per member per day (Central time), up to 3 pages each; see Week 3 S5. Originally 20 photos per UTC day in `scan_usage` (0035), replaced by `scan_games` (0036).
- Errors: 401 anonymous, 415 wrong type, 400 empty, 413 too big, 429 over the limit, 502 model failed or unreadable reply, 503 model busy or key not set.
- Client: `downscaleImage()` in `src/lib/resizeImage.ts` (1568px long edge, JPEG 0.8, honours phone rotation) and `scanScoresheet()` in `src/lib/api.ts`.
- Tests: `test/unit/scan-raw.test.ts` (23 cases; passed here with a stand-in runner) and `test/integration/scan.test.ts` (auth, input checks, prompt contents, recovery, refunds, limit). The harness now mocks `api.anthropic.com`.

**Before it works live:**

1. `npm run db:migrate:remote` for the new `scan_usage` table.
2. Add `ANTHROPIC_API_KEY` as a secret in the Cloudflare Pages dashboard (production), and in `.dev.vars` for local dev (already gitignored).

Run the migration first. Without the key, `/api/scan` answers 503; with the key but no table, it would fail with a 500. Nothing else on the site is affected either way.

### Decisions made (defaults from the spec, change if K prefers)

- Rate limit lives in D1, not KV: one tiny table, no new binding.
- Limit resets at midnight Central (was midnight UTC, i.e. 7pm CDT / 6pm CST, until Week 3 S5).
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

### S5: limit by games, not photos (this branch)

- K's call: 5 games per member per day, each up to 3 pages. `migrations/0036_scan_games.sql` replaces `scan_usage` with `scan_games(member_id, game_id, day, pages)`; the page sends one `X-Scan-Game` id (a random UUID) with every page of a game.
- One SQL statement claims a page: a new game needs a free slot today, a started game just takes another page (the `OR EXISTS` lets the last game of the day finish its pages), and pages are capped at 3. Tested against SQLite directly and in the integration suite. A failed page is handed back; a game with no successful page is deleted so it doesn't count.
- The day is the America/Chicago date (`functions/utils/scan/day.ts`), so the allowance resets at local midnight.
- `GET /api/scan` returns `{ gamesLeftToday, dailyGameLimit, maxPagesPerGame }`; the page shows games left before a scan and hides the picker at 0. "Try again" re-sends only the pages that failed.

### Next

- Real-sheet evaluation (§6.3): 20–40 real scoresheets, dev/holdout split.
