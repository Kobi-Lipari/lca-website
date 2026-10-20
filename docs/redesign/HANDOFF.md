# Handoff: the LCA website redesign

Written on Mon, Oct 19, 2026, for the next working session, and brought up to date on Tue, Oct 20, 2026, after WS01 step 24, for a session that runs on K's own PC from the command line. It says where every branch and pull request stands, the rules that hold for all of the work, how a slice and a board get built, and what is waiting on K.

The brief is `docs/redesign/REDESIGN_SPEC.md`. The build record is `REDESIGN_STATUS.md` at the repository root. The design decisions are in `docs/redesign/DESIGN_REPLAN_phase0.md`, `DESIGN_REPLAN_phase1.md` and `DESIGN_REPLAN_phase2.md`.

This file, `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json`, `docs/redesign/ws01-lead-notes.md`, `docs/redesign/briefs/` and `docs/redesign/uschess-fix-brief.md` live on `redesign/docs-phase2` until PR 106 merges. From another branch, read them with `git show origin/redesign/docs-phase2:<path>`.

`<repo>` stands for the repository root, and `<scratchpad>` for any local scratch folder outside it (see "On K's PC"). A file named under `<scratchpad>` is not in the repository.

## First

1. Subscribe to activity on PRs 106 and 108.
2. Read the October 19 record: `docs/redesign/rounds/2026-10-19/README.md`, then section 7 of `docs/redesign/DESIGN_REPLAN_phase2.md`; its section 7.9 is the decision of Tue, Oct 20.
3. Then carry on with the October 19 design round, or with WS01 step 25. Both are described below.

## Branches and pull requests

Brought up to date on Tue, Oct 20, 2026, after step 24 landed. The heads of `main` and of the audit branch are as last checked on GitHub at about 3:15 AM UTC that day; the heads of the two redesign branches are from their commit logs.

**`main`**, head `7151bff`. Checkpoints A, B and C of WS01 are merged and live:
- A, steps 1 to 8: PR 105, merged Fri, Oct 9, 2026 at 3:06 AM UTC (`4f0882f`).
- B, steps 9 to 15: PR 104, merged Mon, Oct 12, 2026 at 10:29 PM UTC (`748a5ef`).
- C, steps 16 to 19: PR 107, merged Tue, Oct 13, 2026 at 2:03 AM UTC (`7151bff`).

The production database is at `0054_requires_lca_membership.sql`, as the checkpoint C record says. In the container, the clone is shallow and two refs are out of date: the local `main` points at `4c1a466` and `origin/main` at `748a5ef`. Check the real state with `git ls-remote origin` before trusting either.

**`redesign/ws01-design-system`**, draft PR 108 (WS01 checkpoint D: the design system, steps 20 to 32), head `3d80a0e`:
- Step 20, the browser tests for accessibility and end to end: `27824cf`.
- Step 21, tokens, dark mode, the focus ring and motion: `06f8dd8`.
- `aaa001b`, which lets the build workflow pass a model and an effort setting to its agents.
- Step 22, ThemeScope, the route-to-look map and the live fonts: `bb8c8a6`, committed Mon, Oct 19, 2026 at 8:21 PM UTC.
- Step 23, the pages' ink and grounds on the tokens: `4e4ad3a`.
- `b83bb23`, which lets the build workflow run its scout and recorder on a lighter model (`lightModel` and `lightEffort`; see "How a slice is built"). It changes the workflow only.
- Step 24, the status colours, greys, navy lines and tints and raw hex on the tokens: `3d80a0e`, after `b83bb23`.
- Next: step 25, the gold text pass, `ws01-25-gold-ink-codemod` in `docs/redesign/ws01-manifest.json`. Its brief is composed: `docs/redesign/briefs/ws01-25-brief.json` (see "How a slice is built").
- PR 108's description lists steps 20 to 24, with the step 24 gate line below.
- The WS01 header in `REDESIGN_STATUS.md` names the merged checkpoints and draft PR 108; steps 23 and 24 kept it.

Step 23 in short (the full record is under "Step 23" in `REDESIGN_STATUS.md`):
- The colour pass for the pages' ink and grounds: navy text, white grounds and navy bands now use the token utilities. With `newLook` off every class paints the colour it replaced, so nothing visible changes.
- `scripts/codemods/semantic-colours.ts` made the change from a reviewed map, `scripts/codemods/semantic-colours.map.json`, in which every rule, site and keep entry gives its reason. It rewrote 487 classes in 75 files and kept 39; a second run rewrites none.
- A new token, `--color-brand-navy`, stays navy in every look. The rule that turns the focus ring gold now names `.bg-brand-navy` as well as `.bg-lca-navy`, and a rule after it gives a light menu drawn inside a navy band the look's own ring back.
- `data-ground="dark"` now marks the homepage hero, the `urgent` and `info` announcement tones, and the heroes of the club page and the club's admin page.
- The three navy Buttons on the support pages ("Create ticket", "Send reply" and "Send reply & mark answered") gained `dark:text-white`.
- The lint fixes moved the club map helpers into `src/areas/clubs/clubMap.ts`, the US Chess membership state into `src/areas/membership/usChess.ts` and the view-only hook into `src/hooks/useViewOnly.ts`.
- Follow-ups: navy borders and tints were not dark-aware yet (step 24 did them); a selected navy control is hard to tell from an unselected one in dark mode (step 26's `FilterChip` and the workstreams that rebuild those controls); the script read a line of comment prose with two apostrophes as a quoted string (step 24 fixed it); and `newLook` stays off until steps 24 and 25 are done.

The gate at step 23 was `npm run lint` at 16 errors and 13 warnings, down from 34, `npm run build`, `npm run typecheck:functions` and `npm run check:bundle` passing, 2426 unit tests in 103 files, 790 integration tests in 58, and `npm run test:a11y` passing 122 tests with 27 skipped. Step 24's gate below replaces it.

Step 24 in short (the full record is under "Step 24" in `REDESIGN_STATUS.md`):
- The second half of the colour pass. The status colours (emerald, green, red, amber, yellow, blue and purple), the grey and slate classes, the navy borders and faint tints, and raw hex colours now use token utilities. With `newLook` off every class paints the colour it replaced, so nothing visible changes and `test/a11y/baseline.json` is unchanged.
- The same script, `scripts/codemods/semantic-colours.ts`, made the change from a second reviewed map, `scripts/codemods/semantic-colours.status.map.json`, in which every entry gives its reason. It rewrote 339 classes in 49 files and kept 33; a second run rewrites none. Tailwind palette colours went from 273 in 37 files to the 32 kept in 5, `border-lca-navy` (73) and `ring-lca-navy` (1) to none, the 17 faint navy tints to the ink, and hex colours from 51 in 30 files to 44 in 27.
- 51 new tokens in `src/index.css`: 44 tone shades (`text-ok-700`, `bg-warn-50` and the rest, one for each Tailwind shade a page used), the info banner's blue, the Facebook link, two scanner mark colours, the check-in toggle's fill and two for a light island. Each is exactly the old colour with `newLook` off. Under the new look each takes its tone's words or tint. A block for browsers that cannot mix colours gives the token classes with an opacity modifier the tint their old classes drew.
- The ratchet test `test/unit/raw-colours.test.ts` fails on any Tailwind palette colour, `lca-navy` class, `bg-white` in any form or hex colour in a TSX class string that no keep entry names and the allowlist, `test/unit/fixtures/raw-colours-allowlist.json`, does not count. The allowlist holds 91 uses in 33 files, each with a reason, and its counts only go down.
- The contrast test `test/unit/contrast.test.ts` now covers every pair the map writes, in every look and in dark mode, at 4.5:1 for words and 3:1 for an icon's fill, and the map's proof of identity in `test/unit/semantic-map.test.ts` covers every form it writes.
- The dark look, the live look and heritage in dark mode now apply on screens only (inside `@media screen`), so a printed page takes the light look.
- The script's map grammar accepts hex classes and keep entries for a whole file, and its comment search no longer reads the apostrophes of "don't" and "it's" as a string.
- By hand: the three lint errors in `GradeConfirm.tsx` were fixed by moving `NO_TICKS`, `asksGrade`, `confirmedRange` and `GradeTicks` into `src/areas/events/gradeConfirm.ts`, and the club map's loading note now takes `text-muted-on-light` and `bg-veil-on-light/30`, since the map's paper stays light in every look.
- Follow-ups (all in the step 24 block of the record): K reviews the step 24 judgement calls with step 23's before `newLook` is turned on; all 34 gold hex text uses wait for step 25; StatusBadge's tones and dot wait for step 26; heritage's ok and bad words read 4.33:1 and 4.36:1 on its muted inset, which K settles before step 31; the check-in toggle (3.67:1) and the club map's loading note (4.12:1) are below 4.5:1 with `newLook` off and are left for WS08 and WS09; categories (the audit log, the support badges) took the tone of their colour and WS08 and WS13 decide whether they get a look of their own; printing leaves a few things (the print page's black heading rule on the dark screen, `dark:` utilities on controls no print page shows, and live pages, which print the base light look until WS07's print kit); `@source not` for classes only docs and tests name (about 5,300 bytes of the CSS) waits for step 32; and `semantic-map-cascade.test.ts` keeps its own copy of the rule reader that `test/unit/helpers/tailwindRules.ts` also holds, to be merged the next time either changes.

The gate at step 24: `npm run lint` at 13 errors and 13 warnings, down from 16 errors; the 13 left are in `functions/` and `scanner/`, none in a file step 24 touched, and from here on the error count never rises from 13. `npm run build`, `npm run typecheck:functions` and `npm run check:bundle` (no zod in 127 files) pass. `npm run test:all` passes with 2770 unit tests in 107 files and 790 integration tests in 58. `npm run test:a11y` passes 125 tests with 30 skipped, and the baseline is unchanged. `scanner:check` was not run; nothing under `scanner/` or `functions/utils/scan/` changed.

**`redesign/docs-phase2`**, draft PR 106 (the phase 2 design replan and the round records), head `7d8f03f`, pushed:
- The replan (`6e19b91`, `cc1ce47`) and the October 13 round records with the repository's copy of the canvas (`448ea12`).
- The October 19 picks and answers (section 7 of `DESIGN_REPLAN_phase2.md` and `docs/redesign/rounds/2026-10-19/`), the four decided frame boards, `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json`, `docs/redesign/uschess-fix-brief.md`, this file and the renderer line in `.claude/agents/designer.md` (`0fa78cc`).
- `docs/redesign/ws01-lead-notes.md` (`b49f09f`).
- K's decisions on the two decided boards and the club contact flow (`3c629a6`).
- The handoff brought up to date after step 23 (`b2ae06b`).
- K's decisions of Tue, Oct 20 on member-created tournaments (section 7.9 of the replan) and the scanner's membership gate, with the round record (`7d8f03f`).
- `docs/redesign/briefs/`, the build briefs for steps 22 to 25, and this update of the handoff were not committed when it was written.

PR 106's description lists K's picks. It still says the affiliate ID is open for K; it needs the decisions made later on Mon, Oct 19 and on Tue, Oct 20 (under "The October 19 design round").

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
8. **Previews never touch production.** Since WS01 step 1, a preview is bound to `lca-db-preview` through `[env.preview]` in `wrangler.toml`. Nothing run for a preview may reach `lca-db`, the live site, a Pages production address, or a single deployment's own address (`<8 hex characters>.lca-website.pages.dev`), which can run on production data. K migrates the preview database from the branch before reviewing a checkpoint's preview (ordering rule 2 in `REDESIGN_STATUS.md`).

## Security

- Never print or write the Cloudflare token or account values: not in a command, a log, a record, a commit or a pull request. The Pages bot's comments on pull requests carry account values in their dashboard links, so never copy those links.
- The production database `lca-db` is read-only: one `SELECT` per command, and never a migration. Merging to `main` migrates production (`.github/workflows/migrate-db.yml`), and K applies any other remote migration. Locally, migrations run with `npm run db:migrate:local`.
- The only write to the preview database is `npm run db:migrate:preview`.

## On K's PC

The environment facts under "How a slice is built" were written for the cloud container the earlier sessions ran in. On K's own PC, from the command line, some change and some do not.

- **Chromium.** `PW_CHROMIUM_PATH` and the ban on `playwright install` belong to the container and are not needed. Run `npx playwright install chromium` once, on `redesign/ws01-design-system` after `npm install`, so it fetches the Chromium the pinned Playwright 1.63.0 expects. Then run `npm run test:a11y` with nothing in front of it: `playwright.config.ts` uses `PW_CHROMIUM_PATH` only when it is set.
- **The renderer.** `docs/redesign/tools/render.mjs` needs that Chromium too, but it does not read `PW_CHROMIUM_PATH` or any other setting: it launches `/opt/pw-browsers/chromium`, a path written into the script (its `chromium.launch` line), which does not exist on the PC. Before the first render, change that line to point at the Chromium `npx playwright install chromium` fetched, or drop its `executablePath` option so `playwright-core` (the same 1.63.0) finds that browser itself, and say so in the commit. The script has only been run on Linux, and it builds its `file://` links from the machine's own paths, so check the first render on another system by eye.
- **Wrangler and secrets.** `WRANGLER_SEND_METRICS=false` still goes on every wrangler command. Secrets come from K's own `wrangler login` and a local `.dev.vars`, which git ignores; it is never pasted into chat or committed. `npm run test:a11y` brings its own `.dev.vars.a11y` with the keys empty, so it never reads K's. The session never prints or writes the Cloudflare token or account values. The production `lca-db` stays read-only: `SELECT` only, one statement per command, never a migration or a write. The only write to the preview database is `npm run db:migrate:preview`.
- **Git.** Commits are made as the repository owner, with no co-author or session lines: `git -c user.name="Kobi Lipari" -c user.email="kobiclipari@gmail.com" commit`. Push with `git push -u origin <branch>`. Pull requests are opened as drafts. The tooling may append a footer to a pull request body; remove it afterwards. The PC's clone has refs of its own, so check `git ls-remote origin` before trusting `main` there too.
- **The canvas.** Publishing boards needs the artifact tool. A session in the web app has it; a plain command-line session may not. To tell, look for the tool in the session's list of tools, or try `/artifacts`. When it is missing, boards are drawn, rendered, reviewed and committed under `docs/redesign/canvas/boards/`, with their placement in `docs/redesign/canvas/canvas.json`, and the publish waits for a session that has the tool. Until then the repository's `canvas.json` is ahead of the published one, so that session diffs the two before it publishes (step 1 under "How boards reach the canvas").
- **The scratchpad.** `<scratchpad>` in the tools means any local scratch folder outside the repository: set `S` in `draw-boards.js` to it, and create `canvas-out/project` and `render/out` inside it. The lead's notes, the manifest, the tools and the October 19 specs are in the repository now, so no work depends on the old folder. Only the two files the US Chess brief cites were never added (under "Waiting on K").
- **Concurrency.** The workflow runner caps how many agents run at once by the machine's CPUs, so a PC with more cores runs more at once. That speeds up `draw-boards.js`, which draws its boards side by side; `build-slice.js` runs its agents one after another whatever the cap, because they share one working tree.

## How a slice is built

WS01 is built one slice at a time on `redesign/ws01-design-system`, from the 32 slices in `docs/redesign/ws01-manifest.json`. Each entry holds the slice's name, brief, files, acceptance criteria, `verify:` items, switches, migrations, tests and risks. Steps 1 to 24 are done and step 25 is next. The lead, the session that runs the work, kept notes on the manifest's open questions (`docs/redesign/ws01-lead-notes.md`). They win over the manifest where the two differ, and their decisions are recorded under WS01's Decisions in `REDESIGN_STATUS.md`, which is where to read them.

- **The workflow** is `.claude/workflows/build-slice.js`. It takes `{ slices: [{ name, brief, files, acceptance }], base }`, and on `redesign/ws01-design-system` also `model` and `effort` for its agents (`aaa001b`), and `lightModel` and `lightEffort` for the scout and the recorder, which read and write prose (`b83bb23`). The heavy stages (builder, tester and reviewer) keep `model` and `effort`; when `lightModel` is not passed, every stage uses `model`, and when `lightEffort` is not passed the light stages use `effort`. Step 22 ran through a small wrapper that called it as `workflow('build-slice', ARGS)`. The brief it was given was the manifest entry, plus the branch's head and the base for diffs, the files to read first, the environment facts below and where to find the lead's notes. Pass `base` as the previous step's commit: the local `main` ref is out of date, so a diff against it shows far more than the slice.
- **The brief files.** `docs/redesign/briefs/` holds the brief for each step from 22 on (`ws01-22-brief.json` to `ws01-25-brief.json`). A brief file is the exact args object for the workflow, so step 25 runs as `workflow('build-slice', <the parsed file>)`: `base` is `3d80a0e`, `model` and `effort` are for the heavy stages, `lightModel` and `lightEffort` for the scout and the recorder, and `slices` holds the one slice with its brief, files and acceptance criteria. Paths written as `<scratchpad>` in a brief are any local scratch folder (see "On K's PC"). The manifest and the lead's notes that the brief names as `<scratchpad>/ws01-manifest.json` and `<scratchpad>/ws01-lead-notes.md` are in the repository, at `docs/redesign/ws01-manifest.json` and `docs/redesign/ws01-lead-notes.md`, so read them there. Each later step's brief is composed the same way: a read-only scout reads the previous brief, the manifest entry for the step and the tree, and writes the next brief file beside it, with the `base` set to the previous step's commit. The `verify:` items in a brief are checked again by the build's own scout, so a wrong guess in the brief is caught before the builder starts.
- **The agents** are in `.claude/agents/`. The scout finds the facts and answers the `verify:` items. The builder builds the slice and runs the gate. The tester covers each acceptance criterion with new tests. The reviewer reviews the working tree against the base, with up to three rounds of fixes by the builder; anything left after the third goes to the lead. The recorder updates `REDESIGN_STATUS.md` and any switch comments and drafts the commit text. The designer draws boards (next section).
- **Switches.** Every change a visitor would see sits behind a switch in `src/lib/features.ts` (`FEATURES`, default `false`), each with a short plain comment saying what it turns on. K turns switches on after checking the preview.
- **The gate**, before every commit:
  - `npm run lint`: the error count never rises from 13 (13 warnings at step 24), and every error in a file the slice touches is fixed.
  - `npm run build`, `npm run typecheck:functions` and `npm run check:bundle`.
  - `npm run test:all`. If one file fails as a whole (it does not load, or times out while other heavy work runs), it may be rerun once on its own, and the record says so.
  - For the checkpoint D slices, `npm run test:a11y`; in the container it ran as `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:a11y` (see "On K's PC"). The switched-off baseline, `test/a11y/baseline.json`, stays unchanged.
  - `npm run scanner:check` as well when a slice touches `scanner/` or `functions/utils/scan/`.
- **Environment facts** from the step 22 brief, for the container ("On K's PC" says which hold on the PC): never run `playwright install` (the pinned version expects a Chromium the container does not have, which is why `PW_CHROMIUM_PATH` is set); set `WRANGLER_SEND_METRICS=false` on every wrangler command; new dependencies are pinned exactly (no caret), at versions at least two weeks old, with `package-lock.json` updated by `npm install`.
- **Commits.** Agents never commit, push, stash, reset or check out anything; the working tree is the only copy. The lead commits each slice as the repository owner, with the recorder's text. When a pull request description is written through the tooling, it appends a footer line; remove the footer afterwards.
- **Migrations** take the next number after the highest file on the branch they land on (`0054` is the highest today).

## How boards reach the canvas

The canvas is "LCA Look & Feel Options". Its layout is `project/canvas.json`: every board's page, position, size and title, every note, and the page order. Each board is a `.dc.html` file beside it. The repository's copy, as published on Mon, Oct 19, 2026 (version 22), is `docs/redesign/canvas/`. `docs/redesign/tools/README.md` says how each tool runs, and `.claude/agents/designer.md` now points the designer at `docs/redesign/tools/render.mjs`, with the Playwright fallback kept.

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

Drawn and published: `Account-Final-Hub` and `Account-Final-Hub-2` (the hub), and `Club-Final-Bare` and `Club-Final-Bare-2` (Club-G's bare state), in version 22 of the canvas layout, with copies in `docs/redesign/canvas/boards/` and their specs in `docs/redesign/rounds/2026-10-19/final-specs.json`. The other redraws in the list are still to be drawn.

### Decided later on Mon, Oct 19

K looked at the two decided boards, Account-Final-Hub and Club-Final-Bare, and wrote "everything else looks good". K's words are in the round record ("Later on Mon, Oct 19: the two boards, in K's words") and in section 7.8 of `DESIGN_REPLAN_phase2.md`.
- **Three questions took their defaults.** The affiliate stamp: LCA's affiliate number only on listed events and on events run by standing directors, the president, admins and representatives. A standing director's fees wait in LCA's account until LCA has set up a connected account for them. The regional representative approves a request to be named a club's rep, with the admins as the backstop.
- **The club contact flow.** A club's contact email is never shown on its page. The contact form sends to the club's own email when the club has given one, and clubs are encouraged to give one, which lightens the representative's load. Otherwise it sends to the regional representative, with a line saying the club has no connected email yet. The messages are relayed to the club, not stored in LCA's database the way support tickets are; LCA only makes sure the connection exists.
- The bare club boards are approved as drawn.

### Decided on Tue, Oct 20

K's words and the reading are in the round record ("Tue, Oct 20: member-created tournaments, in K's words") and in section 7.9 of `DESIGN_REPLAN_phase2.md`, which decides member-created tournaments in full.
- **Who may create.** Any active LCA member, once an LCA admin turns the site setting on. The setting is in Admin, is off until K has tested, needs no deploy to change, and when turned off stops new creation only: events already created keep running, and their organizers and entrants see a short plain note with a direct way to reach the LCA admins.
- **Never listed, shared by link.** A member-created event is not on the tournaments pages, the home page, the news digest, the monthly results, the champions archive, the sitemap or the structured data, and its pages carry noindex. It has every other function: registration, pairings, standings, event day, the scanner, the results page and the rating report.
- **Not an LCA event.** The event page, the checkout, every email and the printed kit say "Organized by <name>. Not an LCA event." Emails go out with the organizer as the reply-to. The registration form tells entrants that the event is not run or rated by LCA and that their name, US Chess ID and email go to the organizer (for a child, the guardian's email). Under-18s show as first name and last initial on any pre-event list.
- **The organizer.** At creation the organizer ticks one eligibility box, 18 or older and responsible for an event LCA does not run; no birthdate is asked. An entry fee above $0 needs the organizer's connected account inside LCA's Stripe account, and until it exists the organizer is told so in plain words with a direct way to reach the LCA admins. The organizer may require LCA membership of entrants.
- **The rating report.** For a member-created event it carries only the affiliate ID and director IDs the organizer enters as their own. The site refuses LCA's affiliate ID and never fills in LCA's director IDs, so US Chess has nothing to bill LCA for. This is the reason K asked to be told about, and it answers K's question on restricting rating reports (see "Waiting on K").
- **Abuse.** At most three open events per organizer. Every member-created event page carries "Report this event", which lands in the admin queue. An admin can close an event or remove a member's ability to create. Admins see every member-created event in Admin, with how often the service is used and by whom; representatives do not. Adopting a member's event into the listed set is left for later.
- **The scanner is for active LCA members only,** replacing today's gate of any signed-in account. The scanner record in section 7.6 and WS15 read with this change.

### Cross-board slips to fix on the picked boards

Checked against the boards in `docs/redesign/canvas/boards/`:
1. **Lafayette Open 2026 shown with a count.** `Account-N` (picked) and `Account-M` show it as "Published" with "31 registered". On About-Final, Club-D-2 and Account-E, F and G it is a partner event, which never gets a count or a Register button and says "Registers on the organizer's site ↗".
2. **Two names for the signed-in LCA admin.** `Account-R` (picked) and `Account-Q` are signed in as Rachel Boudreaux, and `Work-J` (picked) and `Work-I` as Denise Fontenot; Work-I's assign picker lists both as admins. Make the picked boards agree.
3. **"8 PM" in the Houma visitor report.** `Work-H-2` already reads "closes at 8:00 PM ... until 8:30 PM?". The old wording, "closes at 8 PM ... until 8:30?", survives only on `Account-M` and `Account-M-2`, which K did not pick. Check the published `Work-H-2` against the repository's copy; on the picked boards nothing else needs this fix.

## Waiting on K

Silence keeps each default.

**Answered later on Mon, Oct 19**, and no longer waiting: whose affiliate a rating report carries and how a standing director reaches entry fees took their defaults, as did who approves a named-rep request, and K decided the club page's contact flow. All four are under "Decided later on Mon, Oct 19" above.

**Answered on Tue, Oct 20**, and no longer waiting: K's rating reports for every event, with K's request to be told of any reason to restrict them. Member-created events get a report that carries only the organizer's own affiliate and director IDs, and the site refuses LCA's, so that reason is settled (under "Decided on Tue, Oct 20" above). The same decisions settle that the scanner is for active LCA members only.

**From the October 19 record** (`docs/redesign/rounds/2026-10-19/README.md`, "Still open, with their defaults", less the two answered that evening):
- When the regional representatives start creating tournaments: answered on Mon, Oct 19. K named the president, the admins and the regional representatives together for the first phase (section 7.7), so representatives create and assign one-event directors from the start.
- Whether a club rep also creates the club's events. Default: none assumed. WS09 is Phase 3, so nothing being built now waits.
- Give-A, the plain Give page, which K did not name. Default: Give-A as drawn.

**The US Chess fix brief's four answers** (`docs/redesign/uschess-fix-brief.md`, "Needs K"):
1. Grand Prix: does LCA run real US Chess Grand Prix events? Default: no.
2. A separate, non-blocking list of warnings on the report card. Default: yes.
3. Known-good upload files from a past LCA event, to compare the bytes with.
4. Member delete: refuse it for a member with games, or keep the games and anonymise the member? This is the brief's item 5. Its item 4 is not a question but K's practice upload after slice U1 deploys.

The brief was written before checkpoint C, so several of its paths have moved: `src/lib/uschessUpload.ts` is now `src/areas/events/uschessUpload.ts`, `src/components/tournaments/UsChessUploadPanel.tsx` is `src/areas/events/components/UsChessUploadPanel.tsx`, `functions/utils/members.ts` is `functions/utils/admin/members.ts`, and `src/lib/api.ts` is a barrel over the `src/areas/<area>/api.ts` modules. It was also written before PR 104 and PR 107 merged; both are now on `main`. The audit it cites, `<scratchpad>/uschess-report-audit.md`, and the prototype `<scratchpad>/usc04/tc2.ts` are not in the repository.

**PR 102**: what to do about its conflicts with `main` (under "Branches and pull requests"), and the eleven items in its own "For K to decide" list. Its member delete change, which refuses with 409 to delete a member with games or activity-log actions, is the same question as the US Chess brief's member delete answer.
