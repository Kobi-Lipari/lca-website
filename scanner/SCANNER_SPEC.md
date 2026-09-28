# USCF Scoresheet Scanner — Build Specification & Month Plan

**Project:** Photo of a handwritten USCF scoresheet → validated PGN → one-tap lichess analysis link.
**Ships into:** the LCA website (louisianachess.org), repo `Kobi-Lipari/lca-website`.
**Owner:** K. **Executor:** Claude (Sonnet/Opus sessions). This document is the source of truth. When this spec and a model's instinct disagree, the spec wins. When this spec and K disagree, K wins.

---

## 0. How to use this document (read first, every session)

1. At the start of every session, K pastes (or you read) this spec's relevant week section **plus `STATUS.md`** (see §0.2). Do not start coding from memory of a previous chat — you have none.
2. **Ask before guessing.** If you are about to write code that imports from, calls into, or must match the shape of a file you have not seen in THIS conversation, stop and ask K to paste that file. This is a standing rule from K after a previous incident where a guessed handler used the wrong function-signature convention. It applies especially to anything under `functions/`.
3. **Check before building.** This codebase has had features rebuilt from scratch that already existed (a whole parallel notification system was once built and discarded). Before creating any new endpoint, table, component, or utility, ask K whether something similar exists, or ask to see `src/lib/api.ts` and the relevant directory listing.
4. **Never rewrite a previously-corrected file from scratch.** Edit the existing file. Rewriting from scratch has re-introduced the same import-depth bug twice in this repo's history.
5. End every session by updating `STATUS.md` and stating the exact commands K should run to verify (tests, typecheck, dev server).

### 0.1 Environment & repo gotchas (violating these has burned whole sessions before)

- **Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn/ui frontend; Cloudflare Pages Functions backend; D1 (SQLite) database `lca-db`; Supabase Auth (Bearer JWT); Resend email; R2 for images. Colors: Navy `#1a2744`, Gold `#c8a94a`. Font: Geist.
- **There is no Python at runtime.** Cloudflare Workers/Pages Functions run JS/TS only. All chess logic must be TypeScript (see §2.1). Python may be used only as a local dev-time scripting tool.
- **Pages Functions conventions:** handlers are `PagesFunction<Env>` exports (`onRequestGet`, `onRequestPost`, ...). Use the existing helpers from `functions/utils/response` (`jsonResponse`, `errorResponse`, `parseJsonBody`, `isResponse`, `handleOptions`) and auth from `functions/utils/auth.ts` (`requireAuthedMember`, `requireAdmin`, etc.). **Ask K for these files before writing a handler** — do not guess their signatures.
- **Import depth bugs are the #1 recurring typecheck failure** in `functions/`. Always run `npm run typecheck:functions` before declaring backend work done.
- **The full gate** before "done": unit + integration tests (`@cloudflare/vitest-pool-workers` harness — 50 integration + 62 unit tests passing at last count), `typecheck:functions`, and a build. Integration tests use an `invoke(handler, {...})` harness with seed factories (`seedMember`, `seedAdmin`, ...) — ask to see an existing test file before writing new integration tests.
- **Preview deploys share the PRODUCTION D1 database.** There is no isolated preview DB. Never treat a branch deploy as a sandbox for destructive testing.
- **Dev happens in GitHub Codespaces.** `CLOUDFLARE_API_TOKEN` must be re-exported each session. The Codespace terminal **drops short lines on multi-line paste** (confirmed repeatedly, including inside python3 patch scripts) — for any paste-based edit, use the Codespaces GUI editor, or write files via a `python3` script with triple-quoted strings. **Never use bash heredocs for TSX** (special characters break).
- **Deploy bypass** if Git integration hiccups: `npm run build && npx wrangler pages deploy dist --project-name=lca-website`. Note: local builds bake in `.env.local` values, not Cloudflare dashboard vars — a manual deploy once broke login and Maps for this reason. Prefer pushing and letting Cloudflare build.
- Client-side image resizing already exists in this repo (`src/lib/resizeImage.ts`, built for club logos). Reuse/extend the pattern rather than writing a new resizer from nothing — ask to see it first.

### 0.2 STATUS.md protocol (create in Week 1, Session 1)

A file at repo root (or `docs/scanner/STATUS.md`) with: current week/session, what is DONE (with test evidence), what is IN PROGRESS, open questions for K, and any decisions made that deviate from this spec (with one-line rationale). Keep it under ~150 lines; prune aggressively. This file is the memory between sessions — write it for a model with zero context.

---

## 1. Product definition

### 1.1 What it does (v1)

1. Member opens **Scan a scoresheet** on the LCA site (mobile-first — this will be used at a tournament table).
2. Takes photo(s) of a USCF scoresheet (multiple images allowed: long games continue onto a second sheet; also allow one photo per sheet-half if the user prefers).
3. Server extracts a raw transcription grid via a vision LLM call (§6).
4. A deterministic TypeScript decoder (§5) snaps fuzzy transcriptions to legal moves, producing a move list with per-move confidence.
5. User lands on a **review screen**: full move list, low-confidence moves flagged, tap a flagged move to see alternatives and a board preview at that position, fix by picking an alternative or typing/tapping the move. Unresolvable moves can truncate the game there ("import first N moves").
6. Output: PGN with headers (Event/Round/White/Black/Result etc. from the scoresheet header block when legible), with actions: **Analyze on lichess** (server-side import → redirect to returned URL), **Copy PGN**, **Download .pgn**.

### 1.2 Explicit non-goals (v1) — do not let scope creep in

- No chess.com integration (no public import API exists — do not burn time looking).
- No custom/trained OCR models. Vision LLM + constraint decoding only.
- No perfection on disastrous handwriting. Target: ~90% of moves auto-correct on typical sheets; the fix-up UI is the product answer for the rest. **Flagging honestly beats guessing confidently.**
- No descriptive notation (P-K4 style) support. Detect it (§5.7) and show a friendly "algebraic notation only" message.
- No persistent storage of scoresheet images or scans in v1 (privacy + simplicity). Process in memory. A `scans` history table is a v2 idea only.
- No in-app engine analysis (that is what the lichess link is for).

### 1.3 Access & cost model (decide with K in Week 3, default below)

- **Default: members-only** (auth already exists), because each scan makes a paid Anthropic API call from LCA's own API key (a Cloudflare secret, e.g. `ANTHROPIC_API_KEY`). This is **real per-scan money, separate from K's chat subscription** — roughly a few cents per scan depending on model/image count. Add a simple per-member daily rate limit (e.g. 20 scans/day) enforced server-side. Revisit public access later.

---

## 2. Pinned architecture decisions (do not relitigate without K)

### 2.1 Language & chess library

- **Everything in TypeScript.** The decoder is a pure, dependency-light TS module in `src/lib/scanner/` (or a shared location importable by both `src/` and `functions/` — check the repo's existing convention for shared code first; if none exists, decoder runs client-side only, see §2.2).
- **Chess library: `chess.js` v1.x** (pin an exact version in package.json).
  - ⚠️ **API landmine:** chess.js changed majorly between 0.x and 1.x. In **1.x**, `chess.move()` **throws** on an illegal move (0.x returned `null`). Models constantly mix the two eras. Use 1.x style: `import { Chess } from 'chess.js'`; get legal moves via `chess.moves({ verbose: true })` (returns objects with `.san`, `.from`, `.to`, `.piece`, `.captured`, `.promotion`); prefer checking membership in the legal-move list over try/catch-driven flow; produce PGN via `chess.pgn()` and headers via `chess.header('White', ...)` etc.
  - If `chess.js` proves awkward for anything, the approved fallback is `chessops` — but try chess.js first; do not use both.
- **Board UI component:** `react-chessboard` (works with chess.js FENs, simple API). Only needed for the review screen's position preview.

### 2.2 Where each stage runs

- **Vision extraction:** server-side, in a Pages Function (`functions/api/scan.ts` or similar path agreed with K), because the Anthropic key is a server secret. Auth via `requireAuthedMember`.
- **Decoding:** client-side in the browser. It is pure TS, fast, and keeping it client-side gives instant re-decode when the user fixes a move (fix one move → downstream moves re-decode live without another server call). This is a deliberate architectural feature, not laziness.
- **Lichess import:** server-side Pages Function (`functions/api/scan/lichess.ts` or similar) that receives final PGN and calls lichess (§8), avoiding any CORS questions and keeping one place to add rate limiting.

### 2.3 The two-stage contract (the load-bearing design decision)

Extraction and decoding are **strictly separated** by a JSON contract (§3). The vision model transcribes *what is written*, verbatim, wrong moves and all. The decoder is the only thing that applies chess knowledge. **Never let the vision model "fix" moves** — if it does, the eval harness can no longer distinguish extraction errors from decoding errors, and the accuracy story (raw vs. corrected) that makes this resume-worthy is destroyed. The extraction prompt must explicitly forbid correction (§6.2).

---

## 3. Data contracts

### 3.1 RawScan (vision output → decoder input)

```ts
interface RawScan {
  header: {
    event?: string; date?: string; round?: string; board?: string;
    whiteName?: string; blackName?: string;
    whiteRating?: string; blackRating?: string;
    result?: string;            // verbatim, e.g. "1-0", "½-½", "1/2-1/2", "0-1"
    timeControl?: string;
    legibility: 'clear' | 'partial' | 'unreadable';
  };
  rows: Array<{
    n: number;                  // printed move number on the sheet
    white: RawCell | null;      // null = cell is blank
    black: RawCell | null;
  }>;
  sheetNotes?: string[];        // anything odd: crossed-out moves, arrows, ink blots, "continued on back"
}

interface RawCell {
  raw: string;                  // best-effort verbatim transcription, e.g. "Nf3", "R1e2", "0-0", "e8=Q"
  alts?: string[];              // plausible alternative readings, e.g. raw "Nf3" alts ["Hf3","Kf3"]
  confidence: 'high' | 'medium' | 'low';
  struck?: boolean;             // move appears crossed out / rewritten
}
```

Multiple images for one game: extract each, then concatenate `rows` in user-specified order before decoding (dedupe overlapping printed move numbers by preferring the later sheet's rows only when the earlier sheet's cell is blank).

### 3.2 DecodedGame (decoder output → UI + PGN)

```ts
interface DecodedGame {
  moves: Array<{
    ply: number;                     // 1-based half-move index
    san: string;                     // chosen legal SAN
    sourceRaw: string | null;        // the RawCell.raw this came from (null = inserted hypothesis)
    confidence: number;              // 0..1
    status: 'matched' | 'corrected' | 'guessed' | 'flagged' | 'user-fixed';
    alternatives: Array<{ san: string; score: number }>;  // top candidates for the fix-up UI
    fenBefore: string;               // position before this move (for board preview)
  }>;
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  truncatedAtPly?: number;           // set if decoding gave up partway
  warnings: string[];                // e.g. "rows 24–26 could not be aligned; two interpretations shown"
  notation: 'algebraic' | 'descriptive' | 'unknown';
}
```

`status` semantics: `matched` = raw string was exactly a legal SAN (after normalization §5.2); `corrected` = fuzzy-matched within threshold; `guessed` = filled an illegible/blank slot from context (always ≤ some low confidence, always shown flagged); `flagged` = below confidence floor, needs user attention.

---

## 4. Domain knowledge the executor must not skip

### 4.1 The physical artifact

USCF scoresheets are printed grids: a header block (event, round, board, player names/ratings, result), then numbered rows, each with a **White column and a Black column**, typically 1–50 or 1–60 moves, sometimes continuing on the back or a second sheet. Many are carbonless duplicates (slightly fainter). Handwriting degrades sharply in time pressure — the last 10–15 moves of a sheet are routinely the worst, and players sometimes stop recording entirely under 5 minutes (legal under USCF rules) — so **trailing blank cells with a recorded result are normal, not an error.**

### 4.2 Notation variants that WILL appear (decoder must normalize all of these)

- Castling: `O-O`, `0-0`, `oo`, `O-O-O`, `0-0-0` (letter O vs digit zero interchangeably).
- Captures: `x` present or absent (`Nxf3` vs `Nf3` when a capture occurred); occasionally `:` instead of `x`.
- Check/mate marks: `+`, `#`, `++` — often omitted, often wrongly added. **Treat check/mate symbols as zero-weight decoration:** never use their presence/absence to reject a candidate, at most as a tiny tiebreaker.
- Promotion: `e8=Q`, `e8Q`, `e8(Q)`, `e8/Q`.
- Disambiguation: `Nbd2`, `N1d2`, `Rae1`, occasionally full `Ng1f3`.
- Pawn moves as bare squares (`e4`), sometimes with file prefix for captures (`ed`, `exd`, `ed5` — old habits; `ed5` means the pawn capture landing on d5).
- En passant sometimes annotated `e.p.` — strip it.
- Knight written `N`, but occasionally `Kt` (older players).
- Annotations to strip entirely: `!`, `?`, `!?`, `=` (draw offer mark), circles/underlines (invisible in transcription anyway), clock times scribbled in margins (instruct vision model to ignore digits that are clearly clock times, and put oddities in `sheetNotes`).
- Result written in the last used cell or the header: `1-0`, `0-1`, `½-½`, `1/2`, `draw`, `res.` (resigns). Stop decoding at a result token.

### 4.3 Handwriting confusion matrix (seed for fuzzy costs AND synthetic corruption)

Constrain the alphabet first — this is the biggest win. A normalized SAN token can only contain: `K Q R B N O a b c d e f g h 1 2 3 4 5 6 7 8 x + # = -`. Map everything the vision model produces into this alphabet before matching.

Low-cost confusions (treat as near-free substitutions):
`0↔O`, `1↔l↔I`, `1↔7`, `4↔9`, `6↔b`, `8↔B`, `5↔S(→ no valid target: S maps to 5)`, `2↔Z(→2)`, `9↔g↔q(→g)`, `a↔o(→a or O by position)`, `a↔d`, `c↔e`, `e↔l(→e)`, `x↔+`, `x↔t(→x)`, `N↔H(→N)`, `K↔R` (rare but happens), `B↔D(→B)`, `f↔t(→f)`, `h↔b`, `n↔h(→h or N by position)`.
Positional priors: first char uppercase piece letter or a–h file; last chars are rank digits or decoration. Use position in token to disambiguate (e.g. a leading `H` is almost certainly `N`; a trailing `9` is almost certainly `4`... no — trailing digit must be 1–8, so `9→4` and `0→8 or O`).

### 4.4 Structural errors (the hard 10%)

- **Skipped move pair:** a player forgets to write a move for both sides → every subsequent row is shifted by one full move. Symptom: decoding suddenly fails for many consecutive rows that individually look clean.
- **Half-shift:** one player's single move missing → White's column contains Black's moves thereafter (rarer, uglier). Symptom: systematic "illegal but legal-for-the-other-side" pattern.
- **Duplicated move:** same move written twice (player re-wrote after a draw offer, etc.).
- **Crossed-out + rewritten cells:** prefer the non-struck reading; vision model marks `struck`.
The decoder must handle these via alignment operations (§5.5), not per-cell matching alone.

---

## 5. Decoder specification (Week 1's centerpiece)

### 5.1 Overview

A beam search over game states. State = (board position via chess.js instance or FEN, cell cursor, accumulated moves, accumulated cost, pending-structural-op bookkeeping). Advance cell by cell (White then Black per row); at each cell, generate candidate interpretations, extend beam, prune. Beam width: start at 12, make it a constant, tune in Week 2.

### 5.2 Token normalization (pure function, heavily unit-tested)

`normalizeToken(raw: string): string[]` → returns the cleaned token plus positional-prior variants (e.g. `"Hf3"` → `["Nf3"]`, `"0-0"` → `["O-O"]`, `"ed5"` → `["exd5"]`, `"e8Q"` → `["e8=Q"]`). Strip decoration (`+ # ! ? e.p.` etc.) into flags, don't discard the fact a `+` existed (usable as a feather-weight tiebreaker only). This function embodies §4.2 + §4.3 and is where most iteration will happen — keep it pure and table-driven.

### 5.3 Candidate generation per cell

For the current position: `legal = chess.moves({verbose:true})`, take each legal move's canonical SAN, also compute its decoration-stripped and common-variant forms. Score each legal move against each normalized reading of the cell (raw + alts) with **confusion-weighted edit distance** (substitution costs from §4.3's matrix; insert/delete cost ~1; missing/extra `x` cost ~0.2; missing check mark cost 0). Keep candidates with cost ≤ threshold (tune; start 2.0), plus always keep the single best even if above threshold (marked low-confidence).

### 5.4 Confidence

Per-move confidence = softmax-style margin between best and second-best candidate cost, scaled by the cell's vision confidence. Calibrate in Week 2 against labeled data so that "flagged" (below floor, start at 0.65) has high recall on actually-wrong moves. **The metric that matters for user trust is flag recall: of the moves the decoder got wrong, what fraction did it flag?** Target ≥95% flag recall even at the cost of flagging some correct moves.

### 5.5 Structural/alignment operations (make these explicit beam ops)

- `SKIP_CELL` (cost ~1.5): cell is noise/duplicate; don't consume a ply.
- `BLANK_PLY` (cost ~2.5): consume a ply with an inserted hypothesis move when a cell is blank/illegible mid-game — branch only on the top-k (k≈5) legal moves ranked by simple priors (recaptures > checks > captures > others), and only when the beam would otherwise die. Mark resulting move `guessed`.
- `SHIFT` (cost ~3): begin interpreting White-column cells as Black's moves (half-shift recovery).
Re-synchronization test: after any structural op, require the next 3 cells to match with average cost < 1.0, else prune that branch. This lookahead is what keeps the search from exploding.
- If the beam still dies: truncate. Set `truncatedAtPly`, decode nothing further, tell the user honestly. **Truncation is a feature (per K), not a failure.**

### 5.6 Termination

Stop at a result token, at the last non-blank cell, or at truncation. Trailing blanks after the last decoded move + a header result = normal (see §4.1); attach header result.

### 5.7 Descriptive-notation detection

Before decoding: if >25% of non-blank cells match descriptive patterns (`P-K4`, `N-KB3`, `PxP`, `B-N5` — pattern: piece letter(s), hyphen, piece-or-square-in-letters), set `notation:'descriptive'` and bail with the friendly message. Do not attempt to decode descriptive in v1.

### 5.8 Testing strategy for Week 1 (no images exist yet — that's the point)

Build `corrupt(pgn, seed, profile)`: takes a real PGN, renders it into a synthetic `RawScan`, then applies seeded corruption — character substitutions drawn from §4.3, decoration add/strip, cell blanking, struck cells, skipped move pairs, half-shifts — at configurable rates (`profile`: 'clean' | 'typical' | 'timepressure'). Source PGNs: any public-domain classical games (pull 50+ varied games; include promotions, castling both sides, en passant, underpromotion if findable, disambiguation-heavy knight games). Metric harness reports: per-move accuracy, flag precision/recall, game exact-match, truncation rate — per profile. **Every Week-1 session ends with these numbers printed.**

---

## 6. Vision extraction specification (Week 2)

### 6.1 Mechanics

- Pages Function receives image(s) (base64 or multipart — match how the repo already handles uploads in the club-logo R2 endpoint; ask to see it). Client resizes before upload: longest edge ~1568px, JPEG quality ~0.8 (extend the existing `resizeImage.ts` contain-fit approach — but for scans use plain downscale, no padding). ⚠️ iPhone HEIC: the canvas-based resize pipeline outputs JPEG regardless, which sidesteps HEIC — verify on a real iPhone in Week 3.
- Calls Anthropic Messages API with the image + extraction prompt, `ANTHROPIC_API_KEY` as a Cloudflare secret (set in dashboard for prod AND in `.dev.vars` locally — `.dev.vars` is gitignored; confirm before adding).
- Model: make it a config constant. Start with the current mid-tier vision-capable model; test the small model in Week 4 for cost (only downgrade if eval numbers hold).
- Response must be JSON-only (instruct: no markdown fences, no preamble); strip fences defensively anyway; validate against §3.1's shape with a hand-rolled validator (don't add zod unless it's already in the repo — check).

### 6.2 Extraction prompt — required elements (iterate wording, keep all of these)

1. Role: transcriber of a handwritten chess scoresheet, USCF grid layout described (header block, numbered rows, White/Black columns).
2. **Verbatim rule, stated forcefully and twice:** transcribe exactly what is written character-by-character; do NOT correct chess errors, do NOT infer what move was "meant", do NOT convert notation styles; a wrong or illegal-looking move must be transcribed as-is. (Vision models are strongly biased to helpfully output legal chess — this instruction is the whole ballgame.)
3. Alternatives: when a character is ambiguous, give the literal best reading in `raw` and other plausible readings in `alts` (whole-token variants), with honest `confidence`.
4. Blank cells → null. Crossed-out → `struck:true` with best reading of the final (non-struck) text if any.
5. Ignore marginalia: clock times, doodles, tournament stamps — mention notable ones in `sheetNotes`.
6. Output: JSON only, exact schema, no commentary.

### 6.3 Real-data collection & labeling (K's unique asset — schedule it early in Week 2)

- Collect 20–40 real scoresheets from LCA events (K's own games first — zero permission friction; for others' sheets, get the player's OK and **crop or mask the header names** before the sheet enters the repo).
- Ground truth per sheet: the correct PGN (K replays the game), stored as `eval/data/<id>.pgn` + the photo `eval/data/<id>.jpg` + optional per-cell verbatim transcript for extraction-stage scoring `<id>.raw.json` (do this for at least 10 sheets — it's what separates extraction accuracy from decoding accuracy).
- ⚠️ **Privacy/repo:** the repo is PUBLIC. Real scoresheet photos with names/ratings must not be committed unmasked. Default: keep `eval/data/` gitignored, commit only the harness + synthetic data; K keeps the real set local.
- Split: ~1/3 dev (iterate freely), ~2/3 holdout (touch only for reported numbers). Small, but keeps the README numbers honest.

### 6.4 End-to-end eval (extends Week 1's harness)

Reported table (this goes in the README verbatim): per profile/dataset → raw extraction accuracy, post-decoder accuracy, flag recall, flag precision, game exact-match. The **raw → corrected delta** is the headline resume number.

---

## 7. Product & integration (Week 3)

### 7.1 UI flow (mobile-first; Hybrid-2 design language)

- Route: `/scanner` (or under tools — ask K), page built with `PageHero` (existing shared component) + navy/gold. Nav placement: ask K (likely under a members/tools area; remember the navbar has a hybrid mid-width tier — adding a link means deciding which tier).
- Screen 1 — capture: `<input type="file" accept="image/*" capture="environment">` + add-another-photo for continuation sheets; thumbnails, reorder, remove. Show a "photo tips" hint (flat, well-lit, whole sheet in frame).
- Screen 2 — processing: single call per image; progress state; graceful errors (rate limit, oversized, non-scoresheet image → vision model should return a distinguishable "not a scoresheet" signal; add that to §6.2's prompt and schema as `header.legibility:'unreadable'` + a sheetNote).
- Screen 3 — review: move list in two-column White/Black layout mirroring a scoresheet; confidence coloring (subtle — gold underline for corrected, red-ish flag for flagged; keep palette navy/gold-compatible); tap any move → side panel/bottom sheet with `react-chessboard` showing `fenBefore`, the raw transcription, candidate alternatives as tap targets, and a text input fallback (accept any legal SAN/UCI, validate live). Fixing a move re-decodes downstream client-side immediately. Truncation shown as an honest banner with "import first N moves".
- Screen 4 — done: PGN preview (collapsed), buttons: Analyze on lichess / Copy PGN / Download .pgn. Header fields editable before export (names often illegible).

### 7.2 Backend endpoints (final shapes negotiated against real files — ask first)

- `POST /api/scan` — auth `requireAuthedMember`, body {image}, returns `RawScan`. Per-member daily rate limit (simple D1 counter table or KV — ask K's preference; a tiny migration is acceptable if D1: `scan_usage(member_id, day, count)`).
- `POST /api/scan/lichess` — auth, body {pgn}, calls lichess import (§8), returns {url}.
- No image persistence (§1.2).

### 7.3 Integration tests

Extraction endpoint: mock the Anthropic fetch (do NOT call the real API in tests — follow however the repo mocks Resend/Stripe; ask to see one such test). Test auth required, rate limit, oversize rejection, malformed-JSON-from-model recovery. Decoder: already unit-tested from Week 1; add a route-audit entry if the repo's route-audit test requires it (it parses `src/lib/api.ts` fetch calls — new API wrappers must have matching handler files or that test fails).

---

## 8. Lichess integration (small, but get the details right)

- `POST https://lichess.org/api/import`, `Content-Type: application/x-www-form-urlencoded`, body `pgn=<urlencoded pgn>`. No auth token needed for anonymous import. Response JSON includes `id` and `url` — redirect user to `url` (it's the game page; lichess offers analysis from there; appending `/analysis` also works — verify once manually).
- ⚠️ Anonymous imports are **public** on lichess. Say so in the UI copy ("creates a public lichess game page").
- Respect failures: lichess rate-limits; on 429 back off and surface "try again in a minute". Include a proper `User-Agent` identifying the LCA site (lichess asks API users to do this).
- PGN sent must include `Result` tag and the movetext result token, else import may reject or show `*`.

---

## 9. Week-by-week plan

Each session lists a Definition of Done (DoD). If a session's DoD isn't met, the next session continues it — do not skip ahead leaving broken foundations. Sessions assume ~1 focused block/day; splitting one session across two days is fine.

### Week 1 — Decoder core (pure TS, no images, no repo integration yet)
Work in a `scanner/` workspace inside the repo (or a scratch package — ask K; being in-repo from day one avoids a painful port, recommended) with its own vitest unit tests.

- **S1:** Project skeleton, `STATUS.md`, pin chess.js 1.x, types from §3, `normalizeToken` v1 + ~40 unit tests covering every §4.2 variant. DoD: tests green, K has run them.
- **S2:** Candidate generation (§5.3) + confusion-cost edit distance (table-driven from §4.3) + tests including nasty pairs (`Hf3→Nf3`, `0-0`, `ed5→exd5`, `e89→e84? no: trailing 9→4 ⇒ e84 invalid ⇒ demonstrate rank-constraint mapping`). DoD: given a position + fuzzy token, correct candidate ranks #1 on a 30-case fixture.
- **S3:** Beam search happy path (no structural ops): decode a clean synthetic RawScan end-to-end to PGN; confidence scoring v1. DoD: 10 clean synthetic games decode to exact PGN match.
- **S4:** `corrupt()` harness + metrics printer (§5.8), profiles clean/typical. DoD: metrics table prints; typical-profile per-move accuracy measured (whatever it is — this is the baseline number).
- **S5:** Structural ops (§5.5) + timepressure profile + truncation behavior + descriptive detection (§5.7). DoD: skipped-move-pair games recover; metrics across all 3 profiles recorded in STATUS.md as the Week-1 baseline.

### Week 2 — Vision + real-data eval
- **S1:** `POST /api/scan` function w/ mocked-model integration tests; client resize pipeline. (Ask for: response utils, auth.ts, an existing upload endpoint, an existing mocked-external-API test.) DoD: gate green incl. typecheck:functions.
- **S2:** Extraction prompt v1 (§6.2) + JSON validator + live test against 2–3 of K's real photos (manual, via the dev server). DoD: valid RawScan from a real photo.
- **S3:** Labeling kit: `eval/` layout, gitignore rules (§6.3), a tiny local labeling helper (even a CLI that steps through rows is fine), K labels first 10 sheets. DoD: 10 labeled sheets in the local set.
- **S4:** End-to-end eval runner (photo → extraction → decode → score vs ground truth); first real-data numbers; start a confusion log (actual misread pairs observed → feed back into §4.3 table). DoD: the §6.4 table exists with real numbers.
- **S5:** Iteration day: prompt tweaks + confusion-table/threshold tuning against dev split ONLY; re-measure. DoD: improved dev numbers, holdout untouched, decisions logged in STATUS.md.

### Week 3 — Product build & site integration
- **S1:** `/scanner` route, capture screen, wiring to /api/scan, processing states. (Ask for: App.tsx routes, Navbar.tsx, PageHero usage example.) DoD: photo → raw decode result renders (ugly is fine).
- **S2:** Review screen: move list, confidence coloring, flagged-move panel w/ board preview + alternatives + manual entry, client-side re-decode on fix. DoD: end-to-end fix-up of a real flagged sheet works on desktop.
- **S3:** Export screen + lichess endpoint (§8) + copy/download; editable headers. DoD: real scoresheet → lichess analysis page in one flow.
- **S4:** Mobile pass on K's actual iPhone (Brave + Safari): camera capture, HEIC/resize verification, layout, touch targets; rate limiting + members-only gating + nav placement per K. DoD: full flow works on phone; gate green.
- **S5:** Polish + multi-sheet games + error states (not-a-scoresheet, descriptive, truncation) + integration tests for new endpoints. DoD: full gate green; feature deployed behind whatever visibility K wants (it can ship silently before announcement).

### Week 4 — Hardening, measurement, and the write-up
- **S1:** Label remaining sheets (holdout complete); run the frozen pipeline on holdout ONCE; record official numbers. DoD: the README table, final.
- **S2:** Worst-sheet clinic: pick the 3 worst holdout sheets, fix *classes* of failure (normalization gaps, prompt issues) — no per-sheet hacks; re-run dev split to confirm no regressions. DoD: documented improvements or documented "this class is out of scope".
- **S3:** Cost & model study: measure per-scan token cost; trial the smaller vision model on dev split; pick prod model on numbers. Rate-limit sanity. DoD: cost per scan documented; model pinned with rationale.
- **S4:** README + architecture diagram (pipeline: capture → vision transcription → constraint decoder → review → PGN/lichess; call out the two-stage contract and the raw→corrected delta). DoD: README that a hiring manager can skim in 3 minutes.
- **S5:** Portfolio case study (separate doc/post): problem, why chess makes OCR tractable (legality constraints), the beam/alignment design, honest numbers, screenshots, what you'd do next. Plus resume bullet drafts. DoD: case study drafted; STATUS.md closed out with a v2 ideas list (scans history table, both-scoresheets cross-check, public access, chess.com watch).

---

## 10. Known ways models mess this up (executor: re-read weekly)

1. Mixing chess.js 0.x and 1.x APIs (§2.1). Pin and verify against the installed version's types, not memory.
2. Writing Python for anything that must run on Cloudflare (§0.1).
3. Guessing `functions/` conventions instead of asking for the real files (§0, hard rule from K).
4. Rebuilding something that exists — check `api.ts` and ask (§0.3).
5. Letting the vision model correct moves, silently destroying the eval story (§2.3, §6.2).
6. Bash heredocs for TSX / multi-line terminal pastes in the Codespace (§0.1) — GUI editor or python3 script.
7. Skipping `typecheck:functions` (import-depth bugs) before "done".
8. Treating a branch deploy as a safe sandbox — preview shares prod D1.
9. Calling real external APIs (Anthropic, lichess) inside the test suite.
10. Committing real scoresheet photos / labels to the public repo (§6.3).
11. Tuning on the holdout set. Dev split only until Week 4 S1.
12. Chasing the worst handwriting to 99% — truncate-and-flag is the designed behavior (§1.2, K's explicit product stance).
13. Forgetting the route-audit test when adding `api.ts` wrappers (§7.3).
14. Using check/mate marks as matching evidence (§4.2 — decoration only).
15. Ending a session without updating STATUS.md and giving K verification commands.
