# Handoff: the LCA website redesign

Written on Mon, Oct 19, 2026, for the next working session. It says where every branch and pull request stands, the rules that hold for all of the work, how a slice and a board get built, and what is waiting on K.

The brief is `docs/redesign/REDESIGN_SPEC.md`. The build record is `REDESIGN_STATUS.md` at the repository root. The design decisions are in `docs/redesign/DESIGN_REPLAN_phase0.md`, `DESIGN_REPLAN_phase1.md` and `DESIGN_REPLAN_phase2.md`.

This file, `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json` and `docs/redesign/uschess-fix-brief.md` live on `redesign/docs-phase2` until PR 106 merges. From another branch, read them with `git show origin/redesign/docs-phase2:<path>`.

`<repo>` stands for the repository root, and `<scratchpad>` for the scratch folder outside it that the last session worked in. A file named under `<scratchpad>` is not in the repository.

## First

1. Subscribe to activity on PRs 106 and 108.
2. Read the October 19 record: `docs/redesign/rounds/2026-10-19/README.md`, then section 7 of `docs/redesign/DESIGN_REPLAN_phase2.md`.
3. Then carry on with the October 19 design round, or with WS01 step 23. Both are described below.

## Branches and pull requests

Checked on Mon, Oct 19, 2026, at about 8:45 PM UTC.

**`main`**, head `7151bff`. Checkpoints A, B and C of WS01 are merged and live:
- A, steps 1 to 8: PR 105, merged Fri, Oct 9, 2026 at 3:06 AM UTC (`4f0882f`).
- B, steps 9 to 15: PR 104, merged Mon, Oct 12, 2026 at 10:29 PM UTC (`748a5ef`).
- C, steps 16 to 19: PR 107, merged Tue, Oct 13, 2026 at 2:03 AM UTC (`7151bff`).

The production database is at `0054_requires_lca_membership.sql`, as the checkpoint C record says. In the container, the clone is shallow and two refs are out of date: the local `main` points at `4c1a466` and `origin/main` at `748a5ef`. Check the real state with `git ls-remote origin` before trusting either.

**`redesign/ws01-design-system`**, draft PR 108 (WS01 checkpoint D: the design system, steps 20 to 32), head `bb8c8a6`, pushed:
- Step 20, the browser tests for accessibility and end to end: `27824cf`.
- Step 21, tokens, dark mode, the focus ring and motion: `06f8dd8`.
- `aaa001b`, which lets the build workflow pass a model and an effort setting to its agents.
- Step 22, ThemeScope, the route-to-look map and the live fonts: `bb8c8a6`, committed Mon, Oct 19, 2026 at 8:21 PM UTC.
- Next: step 23, `ws01-23-semantic-colours-ink-surface` in `docs/redesign/ws01-manifest.json`.
- Still to do on PR 108: its description lists steps 20 and 21 only, and its gate line is from step 21. Add step 22, with the step 22 gate figures from `REDESIGN_STATUS.md`.
- Still to do in `REDESIGN_STATUS.md`: the WS01 header still says the branch is not pushed and has no PR.

The gate at step 22: `npm run lint` at 34 errors and 13 warnings; `npm run build`, `npm run typecheck:functions` and `npm run check:bundle` (no zod in 125 files) pass; `npm run test:all` passes with 2236 unit tests in 94 files and 790 integration tests in 58; `npm run test:a11y` passes 111 tests with 18 skipped.

**`redesign/docs-phase2`**, draft PR 106 (the phase 2 design replan and the October 13 round records). Its head was `448ea12` when this was written: the replan (`6e19b91`, `cc1ce47`) and the October 13 round records with the repository's copy of the canvas (`448ea12`). Written after `448ea12`, and not committed when this was written:
- Section 7 of `DESIGN_REPLAN_phase2.md` and `docs/redesign/rounds/2026-10-19/`: K's picks and answers.
- `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json`, `docs/redesign/uschess-fix-brief.md`, this file, and the renderer line in `.claude/agents/designer.md`.

PR 106's description still lists pages 8, 9 and 13 to 16 as waiting for K's picks. Once the October 19 record is committed, it needs the picks.

**`audit/integrity-and-tests`**, PR 102 (integrity fixes: payments, registration races, member delete, times). Open since Sun, Oct 4, 2026, and it cannot merge. It was cut from `4c1a466` (Fri, Oct 2, 2026), and `main` is 42 commits ahead of that. Since then `main` has changed at least four of the files it edits (`functions/api/registrations.ts`, `functions/api/registrations/[id].ts`, `functions/api/registrations/batch.ts` and `functions/api/admin/tournaments/[id]/walk-ins.ts`) and moved two of them (`functions/utils/membershipActivation.ts` into `functions/utils/membership/`, and `src/components/AdminAnnouncementPanel.tsx` into `src/areas/admin/components/`). What waits on K is under "Waiting on K".

**`fix/uschess-2c-upload`** is planned in `docs/redesign/uschess-fix-brief.md` and has not been created.

## Standing rules

From section 0.1 of the brief, with what the work has added since. They bind every commit, pull request, file and board.

1. **No AI references anywhere.** Not in commits, pull request titles or descriptions, code, comments, tests, docs, changelogs or boards. No co-author lines, no session links, no "Generated with" lines. Commits and pull requests read as plain text written by a person.
2. **Read the real file before you change it,** and match the repository's conventions (helpers, naming, response shapes, the test harness). The brief names paths as they were on Mon, Oct 5, 2026. If the code has moved, follow the code and note the difference in `REDESIGN_STATUS.md`; checkpoint C's moves are mapped from old path to new in `scripts/moves/*.json`. Items marked `verify:` are checked first.
3. **Collect only what is needed.**
   - Eligibility is confirmed with a checkbox ("In 8th grade or below?"). Never ask for a child's grade or birthdate.
   - LCA does not get involved in families' finances: no fee waivers, and no lunch-status or need-based questions.
   - Results, standings, winners and recaps show players' full names, children included. Only a page that lists minors and nothing else, such as a full scholastic roster, shortens them to first name and last initial.
4. **Keep the hard-coded "300+ members" figure, and keep every Facebook link.** The Facebook feed is pulled on the server.
5. **Partner events register on the organizer's site; LCA-run events register on louisianachess.org.** Partner events are the Gulf South clearinghouse listings. They never get a Register button or an entry count, and they say "Registers on the organizer's site ↗".
6. **WCAG 2.2 AA.**
   - Status is always shown in words beside its colour, never by colour alone.
   - Brand gold `#c8a94a` is never text on a light ground (2.28:1). Gold text is `#866a1e` (5.13:1 on white).
   - Gold text on navy `#1a2744` is fine (6.51:1).
7. **Plain language.**
   - "US Chess" and "US Chess ID", never USCF, in anything a person reads.
   - Every date carries its weekday: "Sat, Oct 24".
   - Times are written "7:00 PM".
   - Half points are ½, never 0.5 or 3.5.
   - Chess shorthand gets a plain companion the first time: "G/90+30 · 90 min each + 30 sec per move".
   - No em dashes anywhere: copy, board notes, docs, commits and pull request text.
8. **Previews never touch production.** Since WS01 step 1, a preview is bound to `lca-db-preview` through `[env.preview]` in `wrangler.toml`. Nothing run for a preview may reach `lca-db`, the live site, a Pages production address, or a single deployment's own address (`<8 hex characters>.lca-website.pages.dev`), which can run on production data. K migrates the preview database from the branch before he reviews a checkpoint's preview (ordering rule 2 in `REDESIGN_STATUS.md`).

## Security

- Never print or write the Cloudflare token or account values: not in a command, a log, a record, a commit or a pull request. The Pages bot's comments on pull requests carry account values in their dashboard links, so never copy those links.
- The production database `lca-db` is read-only: one `SELECT` per command, and never a migration. Merging to `main` migrates production (`.github/workflows/migrate-db.yml`), and K applies any other remote migration. Locally, migrations run with `npm run db:migrate:local`.
- The only write to the preview database is `npm run db:migrate:preview`.

## How a slice is built

WS01 is built one slice at a time on `redesign/ws01-design-system`, from the 32 slices in `docs/redesign/ws01-manifest.json`. Each entry holds the slice's name, brief, files, acceptance criteria, `verify:` items, switches, migrations, tests and risks. Steps 1 to 22 are done and step 23 is next. The lead, the session that runs the work, kept notes on the manifest's open questions (`docs/redesign/ws01-lead-notes.md`). They win over the manifest where the two differ, and their decisions are recorded under WS01's Decisions in `REDESIGN_STATUS.md`, which is where to read them.

- **The workflow** is `.claude/workflows/build-slice.js`. It takes `{ slices: [{ name, brief, files, acceptance }], base }`, and on `redesign/ws01-design-system` also `model` and `effort` for its agents (`aaa001b`). Step 22 ran through a small wrapper that called it as `workflow('build-slice', ARGS)`. The brief it was given was the manifest entry, plus the branch's head and the base for diffs, the files to read first, the environment facts below and where to find the lead's notes. Pass `base` as the previous step's commit: the local `main` ref is out of date, so a diff against it shows far more than the slice.
- **The agents** are in `.claude/agents/`. The scout finds the facts and answers the `verify:` items. The builder builds the slice and runs the gate. The tester covers each acceptance criterion with new tests. The reviewer reviews the working tree against the base, with up to three rounds of fixes by the builder; anything left after the third goes to the lead. The recorder updates `REDESIGN_STATUS.md` and any switch comments and drafts the commit text. The designer draws boards (next section).
- **Switches.** Every change a visitor would see sits behind a switch in `src/lib/features.ts` (`FEATURES`, default `false`), each with a short plain comment saying what it turns on. K turns switches on after checking the preview.
- **The gate**, before every commit:
  - `npm run lint`: the error count never rises from 34 (13 warnings at step 22), and every error in a file the slice touches is fixed.
  - `npm run build`, `npm run typecheck:functions` and `npm run check:bundle`.
  - `npm run test:all`. If one file fails as a whole (it does not load, or times out while other heavy work runs), it may be rerun once on its own, and the record says so.
  - For the checkpoint D slices, `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:a11y`. The switched-off baseline, `test/a11y/baseline.json`, stays unchanged.
  - `npm run scanner:check` as well when a slice touches `scanner/` or `functions/utils/scan/`.
- **Environment facts** from the step 22 brief: never run `playwright install` (the pinned version expects a Chromium the container does not have, which is why `PW_CHROMIUM_PATH` is set); set `WRANGLER_SEND_METRICS=false` on every wrangler command; new dependencies are pinned exactly (no caret), at versions at least two weeks old, with `package-lock.json` updated by `npm install`.
- **Commits.** Agents never commit, push, stash, reset or check out anything; the working tree is the only copy. The lead commits each slice as the repository owner, with the recorder's text. When a pull request description is written through the tooling, it appends a footer line; remove the footer afterwards.
- **Migrations** take the next number after the highest file on the branch they land on (`0054` is the highest today).

## How boards reach the canvas

The canvas is "LCA Look & Feel Options". Its layout is `project/canvas.json`: every board's page, position, size and title, every note, and the page order. Each board is a `.dc.html` file beside it. The repository's copy, as published on Tue, Oct 13, 2026 (version 20), is `docs/redesign/canvas/`. `docs/redesign/tools/README.md` says how each tool runs, and `.claude/agents/designer.md` now points the designer at `docs/redesign/tools/render.mjs`, with the Playwright fallback kept.

1. Read the published `project/canvas.json` first, and diff it against the local copy before editing.
2. Draw with `docs/redesign/tools/draw-boards.js` into `<scratchpad>/canvas-out/project/`. Each designer checks its board with `docs/redesign/tools/render.mjs`.
3. Edit `canvas.json` with `publish-pages.py`, or the older `publish-page.py`:
   - each board at y 0, with x stepping along the page by the board's width plus 80;
   - its note at the board's x, at y equal to the board's height plus 60;
   - the round's note at the page's start x, at y minus 300.
4. Publish with the root (`<scratchpad>/canvas-out`), the file path (`project/canvas.json`) and a files map of the new boards only. Never list `canvas.json` in the files map.

## Workflow gotchas

- Resuming a workflow replays only the longest unchanged prefix of its agent calls, in call order. A changed call, and every call after it, runs again.
- An agent that returns more than 64k output tokens fails. Critics and reviewers return compact corrections, never a rewritten document.
- An interrupt kills the agents in flight.

## The October 19 design round

K's picks are recorded. The boards K asked to have redrawn are listed under "Redrawn to K's words" in `docs/redesign/rounds/2026-10-19/README.md`:
- Club-G in its bare state.
- Member-E with Member-F's "What your dues do" section.
- The My LCA hub joining Int-A and Int-B.
- Account-D on phones, with an empty Today folded to one line.
- Account-H with its empty state.
- Work-L without the jump list.
- Scan-E with Scan-D's states.
- Scan-H and Scan-S with piece images.
- Scan-L with the immediate private save and no Public option.
- Scan-O with games outside tournaments.
- Scan-Q with scanning optional.

Being drawn when this was written, in `<scratchpad>/canvas-out/project/` from `<scratchpad>/final-specs.json`, and not yet placed in the working copy of `canvas.json`: `Account-Final-Hub` and `Account-Final-Hub-2` (the hub), and `Club-Final-Bare` and `Club-Final-Bare-2` (Club-G's bare state). Look for them on the published canvas before drawing them again.

### Cross-board slips to fix on the picked boards

Checked against the boards in `docs/redesign/canvas/boards/`:
1. **Lafayette Open 2026 shown with a count.** `Account-N` (picked) and `Account-M` show it as "Published" with "31 registered". On About-Final, Club-D-2 and Account-E, F and G it is a partner event, which never gets a count or a Register button and says "Registers on the organizer's site ↗".
2. **Two names for the signed-in LCA admin.** `Account-R` (picked) and `Account-Q` are signed in as Rachel Boudreaux, and `Work-J` (picked) and `Work-I` as Denise Fontenot; Work-I's assign picker lists both as admins. Make the picked boards agree.
3. **"8 PM" in the Houma visitor report.** `Work-H-2` already reads "closes at 8:00 PM ... until 8:30 PM?". The old wording, "closes at 8 PM ... until 8:30?", survives only on `Account-M` and `Account-M-2`, which K did not pick. Check the published `Work-H-2` against the repository's copy; on the picked boards nothing else needs this fix.

## Waiting on K

Silence keeps each default.

**From the October 19 record** (`docs/redesign/rounds/2026-10-19/README.md`, "Still open, with their defaults"):
- When the regional representatives start creating tournaments. Default: from WS09's My region in Phase 3 (P2.19); until then the people in the first phase create tournaments.
- Whose affiliate an unlisted event's rating report carries. Default: the director's own, as today; LCA's only on events LCA lists.
- How a standing director reaches entry fees before LCA has set up a connected account for them. Default: the fees are paid into LCA's account and LCA passes them on, and the director is told so before setting a fee.
- Whether a club rep also creates the club's events. Default: none assumed. WS09 is Phase 3, so nothing being built now waits.
- Give-A, the plain Give page, which K did not name. Default: Give-A as drawn.
- K made US Chess rating reports available for every event and asked to be told of any reason to restrict them. No reply is recorded.

**The US Chess fix brief's four answers** (`docs/redesign/uschess-fix-brief.md`, "Needs K"):
1. Grand Prix: does LCA run real US Chess Grand Prix events? Default: no.
2. A separate, non-blocking list of warnings on the report card. Default: yes.
3. Known-good upload files from a past LCA event, to compare the bytes with.
4. Member delete: refuse it for a member with games, or keep the games and anonymise the member? This is the brief's item 5. Its item 4 is not a question but K's practice upload after slice U1 deploys.

The brief was written before checkpoint C, so several of its paths have moved: `src/lib/uschessUpload.ts` is now `src/areas/events/uschessUpload.ts`, `src/components/tournaments/UsChessUploadPanel.tsx` is `src/areas/events/components/UsChessUploadPanel.tsx`, `functions/utils/members.ts` is `functions/utils/admin/members.ts`, and `src/lib/api.ts` is a barrel over the `src/areas/<area>/api.ts` modules. It was also written before PR 104 and PR 107 merged; both are now on `main`. The audit it cites, `<scratchpad>/uschess-report-audit.md`, and the prototype `<scratchpad>/usc04/tc2.ts` are not in the repository.

**PR 102**: what to do about its conflicts with `main` (under "Branches and pull requests"), and the eleven items in its own "For K to decide" list. Its member delete change, which refuses with 409 to delete a member with games or activity-log actions, is the same question as the US Chess brief's member delete answer.
