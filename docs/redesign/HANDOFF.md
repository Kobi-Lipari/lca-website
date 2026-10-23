# Handoff: the LCA website redesign

Written on Mon, Oct 19, 2026, for the next working session, brought up to date on Tue, Oct 20, 2026, after WS01 step 24, and refreshed on Fri, Oct 23, 2026, after WS01 finished and merged. It is for whoever picks the project up, here in the cloud or on K's own PC from the command line. It says where every branch and pull request stands, the rules that hold for all of the work, how a slice and a board get built, what brief 1.4 and WS02 are, and what is waiting on K.

The brief is `docs/redesign/REDESIGN_SPEC.md`. On `main` and on `redesign/docs-phase2` it is still version 1.3 (the docs branch adds one line to Appendix A); version 1.4 lands in WS02 slice 1 (see "Brief 1.4 and WS02"). The build record is `REDESIGN_STATUS.md` at the repository root. The design decisions are in `docs/redesign/DESIGN_REPLAN_phase0.md`, `DESIGN_REPLAN_phase1.md` and `DESIGN_REPLAN_phase2.md`.

This file, `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json`, `docs/redesign/ws01-lead-notes.md`, `docs/redesign/ws02-manifest.json`, `docs/redesign/ws02-plan-notes.md`, `docs/redesign/brief-1.4-notes.md`, `docs/redesign/briefs/` and `docs/redesign/uschess-fix-brief.md` live on `redesign/docs-phase2` until PR 106 merges. From another branch, read them with `git show origin/redesign/docs-phase2:<path>`.

`<repo>` stands for the repository root, and `<scratchpad>` for any local scratch folder outside it (see "On K's PC"). A file named under `<scratchpad>` is not in the repository.

## First

1. Check where things really stand before acting: `git ls-remote origin` shows the heads of `main` and the branches (under "Branches and pull requests" are the values of Fri, Oct 23), and the lead's check-in, which fires every three hours, reads the same state before it does anything.
2. Subscribe to activity on PR 106 (draft, documentation only). Subscribe to each WS02 checkpoint's draft pull request as it opens.
3. Read the end of `docs/redesign/ws01-lead-notes.md` (its last three sections: the focus-ring flake, the merge-safety review of checkpoint D, and the merge and the live check), then `docs/redesign/ws02-plan-notes.md`, then the WS02 lead's notes, `<scratchpad>/ws02-lead-notes.md`, which win over the manifest where they differ. "Brief 1.4 and WS02" below says what they hold.
4. Then carry on with WS02 slice 1 on `redesign/ws02-navigation`, which is being prepared and has no commits yet. The October 19 design round (the boards still to be redrawn) runs alongside and is described below.
5. K's notes of Wed, Oct 22: finish the project in this session, with no handoff to the PC needed unless it is useful, and keep going past WS01's step 32 (brief 1.4, then WS02 and on).

## Branches and pull requests

Brought up to date on Fri, Oct 23, 2026, after WS01 finished and merged. The heads are as `git ls-remote origin` showed them that day, except `redesign/ws02-navigation`, which is not pushed yet and is read from the clone.

**`main`**, head `34b721c`. WS01 is finished and merged: all 32 steps, in four checkpoints, each a pull request.
- A, steps 1 to 8: PR 105, merged Fri, Oct 9, 2026 at 3:06 AM UTC (`4f0882f`).
- B, steps 9 to 15: PR 104, merged Mon, Oct 12, 2026 at 10:29 PM UTC (`748a5ef`).
- C, steps 16 to 19: PR 107, merged Tue, Oct 13, 2026 at 2:03 AM UTC (`7151bff`).
- D, steps 20 to 32: PR 108, merged Thu, Oct 22, 2026 at about 6:53 PM UTC (`34b721c`), with `redesign/ws01-design-system` at `ffee346` as its last commit. GitHub stamps the merge at 6:52:31 PM UTC.

How checkpoint D was merged:
- A merge-safety review came first: three read-only judges, one lens each (what a visitor sees with every switch off; the infrastructure and the deploy; the owner's rules and the record), and three refuters for each blocking finding.
- The review's fixes went into one commit, `ffee346` ("Put right what the merge review of checkpoint D found"): six older record tests now spell their forbidden words in pieces, eight tests write the em dash by its code, `src/index.css` gives `--focus` a plain fallback for browsers without colour mixing, and the record is corrected.
- CI was green on that last commit. The CI run for the push to `main` passed, and the migration job and the worker deploy did not run, since nothing under `migrations/`, `workers/`, `functions/utils/` or `domain/` changed.
- The live deploy was checked at 7:10 PM UTC that evening: the live site's stylesheet, switches chunk and utilities chunk carry the same content hashes as a local build of the merged tree. All 24 switches in `src/lib/features.ts` are off in production, so nothing a visitor sees has changed.
- The details are in the last three sections of `docs/redesign/ws01-lead-notes.md` and in the Checkpoint D section of `REDESIGN_STATUS.md`. On `main` that section still says the merge is pending; WS02 slice 1 corrects it.

The final WS01 gate figures: `npm run lint` 13 errors and 13 warnings (the count never rises above 13); 4473 unit tests in 167 files; 790 integration tests in 58; 657 browser tests, of which 463 run and 194 are skipped, with the baseline unchanged (`test/a11y/baseline.json`, sha256 `ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`).

The production database is at `0054_requires_lca_membership.sql`. In the container, the local `main` ref points at `4c1a466` and is 38 commits behind `origin/main`, so check the real state with `git ls-remote origin` before trusting either.

**`redesign/ws01-design-system`**, head `ffee346`. Merged as PR 108 and kept for now; it can be deleted once nobody needs its history.

**`redesign/docs-phase2`**, draft PR 106 (documentation only), head `13a2903`, pushed:
- It holds `DESIGN_REPLAN_phase2.md`, the October 13 and October 19 round records, the canvas and its boards, the tools, the WS01 briefs (`docs/redesign/briefs/ws01-22-brief.json` to `ws01-32-brief.json`) and `ws01-manifest.json` with `ws01-lead-notes.md`, the US Chess upload brief, this file, and since Fri, Oct 23 `ws02-manifest.json`, `ws02-plan-notes.md` and `brief-1.4-notes.md`.
- It merged `main` in (`0ffefa5`), so its copy of `docs/redesign/REDESIGN_SPEC.md` is 1.3 plus the Zextaos line in Appendix A.
- **It must never carry the 1.4 spec.** Fourteen unit tests on `main` read that file and would turn `main` red (see "Brief 1.4 and WS02"). Kept like this, PR 106 merges cleanly before or after any WS02 checkpoint.
- Its description is out of date: it still says the design-system briefs are steps 22 to 25 and that version 1.4 is yet to be cut. Bring it up to date before K reads it.

**`preview-new-look`**, head `676b987`, a throwaway branch. It is `main` with only `newLook` and `themeHeritage` turned on in `src/lib/features.ts`, pushed on Fri, Oct 23, 2026 for K's board meeting demo at `https://preview-new-look.lca-website.pages.dev`. It is never merged, and it is deleted after the meeting.

**`redesign/ws02-navigation`**, cut from `main` at `34b721c` on Fri, Oct 23, 2026, with no commits yet. WS02 slice 1 is being prepared on it. Each WS02 checkpoint is a draft pull request from it against `main`.

**`audit/integrity-and-tests`**, PR 102 (integrity fixes: payments, registration races, member delete, times). Open since Sun, Oct 4, 2026, and it cannot merge. It was cut from `4c1a466` (Fri, Oct 2, 2026), and `main` is 38 commits ahead of that (counted on Fri, Oct 23). Since then `main` has changed at least four of the files it edits (`functions/api/registrations.ts`, `functions/api/registrations/[id].ts`, `functions/api/registrations/batch.ts` and `functions/api/admin/tournaments/[id]/walk-ins.ts`) and moved two of them (`functions/utils/membershipActivation.ts` into `functions/utils/membership/`, and `src/components/AdminAnnouncementPanel.tsx` into `src/areas/admin/components/`). What waits on K is under "Waiting on K".

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

K's note of Wed, Oct 22, 2026: the project is finished in the cloud session, and no handoff to the PC is needed unless it is useful. This section is for when it is.

- **Chromium.** `PW_CHROMIUM_PATH` and the ban on `playwright install` belong to the container and are not needed. Run `npx playwright install chromium` once, on `redesign/ws02-navigation` (or any branch) after `npm install`, so it fetches the Chromium the pinned Playwright 1.63.0 expects. Then run `npm run test:a11y` with nothing in front of it: `playwright.config.ts` uses `PW_CHROMIUM_PATH` only when it is set.
- **The renderer.** `docs/redesign/tools/render.mjs` needs that Chromium too, but it does not read `PW_CHROMIUM_PATH` or any other setting: it launches `/opt/pw-browsers/chromium`, a path written into the script (its `chromium.launch` line), which does not exist on the PC. Before the first render, change that line to point at the Chromium `npx playwright install chromium` fetched, or drop its `executablePath` option so `playwright-core` (the same 1.63.0) finds that browser itself, and say so in the commit. The script has only been run on Linux, and it builds its `file://` links from the machine's own paths, so check the first render on another system by eye.
- **Wrangler and secrets.** `WRANGLER_SEND_METRICS=false` still goes on every wrangler command. Secrets come from K's own `wrangler login` and a local `.dev.vars`, which git ignores; it is never pasted into chat or committed. `npm run test:a11y` brings its own `.dev.vars.a11y` with the keys empty, so it never reads K's. The session never prints or writes the Cloudflare token or account values. The production `lca-db` stays read-only: `SELECT` only, one statement per command, never a migration or a write. The only write to the preview database is `npm run db:migrate:preview`.
- **Git.** Commits are made as the repository owner, with no co-author or session lines: `git -c user.name="Kobi Lipari" -c user.email="kobiclipari@gmail.com" commit`. Push with `git push -u origin <branch>`. Pull requests are opened as drafts. The tooling may append a footer to a pull request body; remove it afterwards. The PC's clone has refs of its own, so check `git ls-remote origin` before trusting `main` there too.
- **The canvas.** Publishing boards needs the artifact tool. A session in the web app has it; a plain command-line session may not. To tell, look for the tool in the session's list of tools, or try `/artifacts`. When it is missing, boards are drawn, rendered, reviewed and committed under `docs/redesign/canvas/boards/`, with their placement in `docs/redesign/canvas/canvas.json`, and the publish waits for a session that has the tool. Until then the repository's `canvas.json` is ahead of the published one, so that session diffs the two before it publishes (step 1 under "How boards reach the canvas").
- **The scratchpad.** `<scratchpad>` in the tools means any local scratch folder outside the repository: set `S` in `draw-boards.js` to it, and create `canvas-out/project` and `render/out` inside it. The lead's notes, the manifest, the tools and the October 19 specs are in the repository now, so no work depends on the old folder. Only the two files the US Chess brief cites were never added (under "Waiting on K").
- **Concurrency.** The workflow runner caps how many agents run at once by the machine's CPUs, so a PC with more cores runs more at once. That speeds up `draw-boards.js`, which draws its boards side by side; `build-slice.js` runs its agents one after another whatever the cap, because they share one working tree.

## How a slice is built

The method is unchanged from WS01. WS02 is built one slice at a time on `redesign/ws02-navigation`, from the 19 slices in `docs/redesign/ws02-manifest.json`, in the same format as `ws01-manifest.json`. Each entry holds the slice's name, brief, files, acceptance criteria, `verify:` items, switches, migrations, tests and risks. The lead, the session that runs the work, keeps notes on the manifest's open questions; the WS02 notes are `<scratchpad>/ws02-lead-notes.md`, and they win over the manifest where the two differ. Their decisions are recorded in `REDESIGN_STATUS.md`, which is where to read them. WS01's 32 slices are history now; their briefs are in `docs/redesign/briefs/`, and `docs/redesign/ws01-lead-notes.md` holds that workstream's notes.

- **The workflow** is `.claude/workflows/build-slice.js`. It takes `{ slices: [{ name, brief, files, acceptance }], base }`, and also `model` and `effort` for its agents, and `lightModel` and `lightEffort` for the scout and the recorder, which read and write prose. The heavy stages (builder, tester and reviewer, and the fix rounds) keep `model` and `effort`; when `lightModel` is not passed, every stage uses `model`, and when `lightEffort` is not passed the light stages use `effort`.
- **Models.** Heavy stages run on the strongest model at the highest effort. Scouts and recorders run on the lighter model at high effort. K approved this on Tue, Oct 21, 2026.
- **The brief files.** The brief for each slice is composed by a read-only scout from the previous brief, the manifest entry and the tree. It is written to `<scratchpad>/ws02-NN-brief.json`, with `base` set to the previous slice's commit (slice 1's base is `34b721c`), and copied to `docs/redesign/briefs/ws02-NN-brief.json` on `redesign/docs-phase2` when the slice launches. A brief file is the exact args object for the workflow, so a slice runs as `workflow('build-slice', <the parsed file>)`: `base`, `model` and `effort`, `lightModel` and `lightEffort`, and `slices` with the one slice's brief, files and acceptance criteria. Pass `base` as the previous slice's commit: the local `main` ref is out of date, so a diff against it shows far more than the slice. The `verify:` items in a brief are checked again by the build's own scout, so a wrong guess in the brief is caught before the builder starts. Paths written as `<scratchpad>` in a brief are any local scratch folder (see "On K's PC"); the manifests and notes a brief names are in the repository, under `docs/redesign/`.
- **The agents** are in `.claude/agents/`. The scout finds the facts and answers the `verify:` items. The builder builds the slice and runs the gate. The tester covers each acceptance criterion with new tests. The reviewer reviews the working tree against the base, with up to three rounds of fixes by the builder; anything left after the third goes to the lead. The recorder updates `REDESIGN_STATUS.md` and any switch comments and drafts the commit text. The designer draws boards (see "How boards reach the canvas").
- **Switches.** Every change a visitor would see sits behind a switch in `src/lib/features.ts` (`FEATURES`, default `false`), each with a short plain comment saying what it turns on. K turns switches on after checking a preview. For WS02 the switches are `newNav`, `siteSearch`, `eventStrip` and `eventStripLive` (or the one brief 1.4's table names for a given change), and nothing `newNav` turns on shows unless `newLook` is on too.
- **The gate**, before every commit:
  - `npm run lint`: the error count never rises from 13, and every error in a file the slice touches is fixed.
  - `npm run build`, `npm run typecheck:functions` and `npm run check:bundle`.
  - `npm run test:all`. If one file fails as a whole (it does not load, or times out while other heavy work runs), it may be rerun once on its own, and the record says so.
  - `npm run test:a11y`; in the container it ran as `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:a11y` (see "On K's PC"). The switched-off baseline, `test/a11y/baseline.json`, stays unchanged.
  - `npm run scanner:check` as well when a slice touches `scanner/` or `functions/utils/scan/`.
- **Environment facts**, for the container ("On K's PC" says which hold on the PC): never run `playwright install` (the pinned version expects a Chromium the container does not have, which is why `PW_CHROMIUM_PATH` is set); set `WRANGLER_SEND_METRICS=false` on every wrangler command; new dependencies are pinned exactly (no caret), at versions at least two weeks old, with `package-lock.json` updated by `npm install`.
- **Commits.** Agents never commit, push, stash, reset or check out anything; the working tree is the only copy. The lead runs the gate first, then commits each slice as the repository owner, with the recorder's text. When a pull request description is written through the tooling, it may append a footer; remove it afterwards.
- **The lead's check-in** is a scheduled task on the lead's side that fires every three hours. It reads the state (the branches, the pull requests, the record) before it acts.
- **Migrations** take the next number after the highest file on the branch they land on (`0054` is the highest today). WS02 plans none.

## Brief 1.4 and WS02

**Brief 1.4** was cut on Thu, Oct 22 and Fri, Oct 23, 2026 from K's decisions after 1.3: canvas pages 7 to 16, tournament creation in three phases, the Stripe rule, the admin switch for member-created events, the scanner, the club contact relay, the walkthrough last, and Zextaos (zextaos.com, which joins Chess67 in the spec's peer list for the later optimisation pass). Six drafters wrote it, an assembler joined the parts, and two review rounds fixed it; a final verification review is running. The text is at `<scratchpad>/brief14/REDESIGN_SPEC.1.4.md` (about 3,550 lines; the untouched 1.3 copy is beside it as `REDESIGN_SPEC.before-1.4.md`). `docs/redesign/brief-1.4-notes.md` holds the assembly record and the open questions for K, each with its default. Section 5 of the spec carries them as Q1 to Q39.

**Why 1.4 does not land through PR 106.** Fourteen unit tests on `main` read `docs/redesign/REDESIGN_SPEC.md`:
- Twelve of them pin the single long `- WS01:` bullet under "Deviations from v1.1" byte for byte (the 1.4 copy keeps it as it is).
- Three, all in `test/unit/test-setup.test.ts` (two read the flag table; the third compares the step 2 record), pin the 1.3 flag table at 20 switches and expect each to be in `src/lib/features.ts`.

So 1.4 lands in WS02 slice 1, on `redesign/ws02-navigation`, together with:
- the new switches in `src/lib/features.ts`, all `false`, each with a plain comment;
- the three tests moved to the 1.4 table (the step 2 record test compares against a frozen list of the 20 switches 1.3 named);
- the record of checkpoint D's merge in `REDESIGN_STATUS.md`, whose Checkpoint D section still says the merge is pending;
- a once-only page reload on the build loader's `vite:preloadError` event. On Thu, Oct 22 K's admin tab, open since before the deploy, fell into the error screen on "Add document", because the tab asked for a lazy file under its old hash, which the new deployment no longer serves; a hard refresh fixed it. With a deploy per checkpoint this will recur, so `src/main.tsx` listens for the event, prevents its default and reloads the page once (a mark in `sessionStorage` stops a loop; if the mark is set, the error reaches the boundary as today).

**The WS02 plan** is `docs/redesign/ws02-manifest.json` and `docs/redesign/ws02-plan-notes.md`:
- 19 steps in five checkpoints, each a draft pull request against `main`, merged after a merge-safety review as WS01's were: E is steps 1 to 5, F is 6 to 8, G is 9 to 11, H is 12 to 16 and I is 17 to 19.
- No migrations.
- Every visible change sits behind `newNav`, `siteSearch`, `eventStrip` or `eventStripLive`, and nothing `newNav` turns on shows unless `newLook` is on too.
- The plan notes hold the questions for K with their defaults, and a Review section that maps the reviewer's items to steps.
- Where the lead's notes and the plan differ, the notes win. For instance, the plan notes allow that PR 106 might already carry 1.4's test changes; it will not, and slice 1 makes them.

**Where it stands (Fri, Oct 23, 2026).** Nothing is committed on `redesign/ws02-navigation`; slice 1 is being prepared. The order in which K's other branches merge does not matter: PR 106 merges cleanly before or after any WS02 checkpoint.

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

None of these blocks the work; silence keeps each default.

**Remember for the very end:** K wants a demo or LCA board walkthrough that shows every built part of the site and every role's screens from one place, since no single person ever sees them all. Not to be planned or built until the last workstream has landed; section 8 of the phase 2 replan holds K's words, and brief 1.4 puts the walkthrough last.

**To read and decide:**
- **PR 106.** Read it and say whether the lead may merge it. It is documentation only and merges cleanly before or after any WS02 checkpoint.
- **WS01's checks before the switches go on.** The switch-by-switch preview checks listed in the Checkpoint D section of `REDESIGN_STATUS.md` ("For K, on a preview, switch by switch"), and the judgement calls of steps 23 to 32 (each step's "K reviews the step N judgement calls"). Turning `newLook` and `themeHeritage` on is K's call after those; until then the site is today's. The throwaway branch `preview-new-look` shows both on, at the address above.
- **Brief 1.4's open questions** (Q1 to Q39 in section 5 of the spec, with their defaults in `docs/redesign/brief-1.4-notes.md`). One correction to the older list below: when the regional representatives start creating tournaments is Q1 and is open, not answered. K's words of Mon, Oct 19 named the president, the admins and the representatives together, the replan's section 7.7 keeps K's phases, and the default is from WS09's My region in Phase 3. All three readings are set out in Q1 for K.
- **The WS02 plan's questions**, in `docs/redesign/ws02-plan-notes.md` ("Questions for K, with defaults").
- **The US Chess upload fix brief's four questions**, below.
- **The newsletter questions**, below.

**The newsletter.** On Fri, Oct 23, 2026 K asked for a monthly newsletter hosted on the site, edited by the leaders, sent automatically on a fixed date and time unless edited, to an initial member list plus every new member, with opt-out. It is feasible with the mail service, the database, the scheduled-jobs worker and the existing editor. It is a candidate WS16 for brief 1.5, once K answers:
1. Turn-taking edits with history, or live co-editing?
2. A fully automatic send, or a confirm step?
3. The day and time.
4. Who may edit and who may send.
5. The sender address and the legal footer.
6. Consent for the first list.

K's answers of Mon, Oct 19 are kept word for word in `<scratchpad>/k-answers-2026-10-19.md`.

**Answered**, and no longer waiting:
- On Mon, Oct 19: whose affiliate a rating report carries and how a standing director reaches entry fees took their defaults, as did who approves a named-rep request, and K decided the club page's contact flow (all four under "Decided later on Mon, Oct 19" below).
- On Tue, Oct 20: K's rating reports for every event, with the request to be told of any reason to restrict them. Member-created events get a report that carries only the organizer's own affiliate and director IDs, and the site refuses LCA's, so that reason is settled (under "Decided on Tue, Oct 20" below). The same decisions settle that the scanner is for active LCA members only.
- On Wed, Oct 22: finish the project in this session, and keep going past step 32; Zextaos joins Chess67 in the spec's peer list.

**From the October 19 record** (`docs/redesign/rounds/2026-10-19/README.md`, "Still open, with their defaults", less the two answered that evening):
- Whether a club rep also creates the club's events. Default: none assumed (Q2 in brief 1.4). WS09 is Phase 3, so nothing being built now waits.
- Give-A, the plain Give page, which K did not name. Default: Give-A as drawn.

**The US Chess fix brief's four answers** (`docs/redesign/uschess-fix-brief.md`, "Needs K"):
1. Grand Prix: does LCA run real US Chess Grand Prix events? Default: no.
2. A separate, non-blocking list of warnings on the report card. Default: yes.
3. Known-good upload files from a past LCA event, to compare the bytes with.
4. Member delete: refuse it for a member with games, or keep the games and anonymise the member? This is the brief's item 5. Its item 4 is not a question but K's practice upload after slice U1 deploys.

The brief was written before checkpoint C, so several of its paths have moved: `src/lib/uschessUpload.ts` is now `src/areas/events/uschessUpload.ts`, `src/components/tournaments/UsChessUploadPanel.tsx` is `src/areas/events/components/UsChessUploadPanel.tsx`, `functions/utils/members.ts` is `functions/utils/admin/members.ts`, and `src/lib/api.ts` is a barrel over the `src/areas/<area>/api.ts` modules. It was also written before PR 104 and PR 107 merged; both are now on `main`. The audit it cites, `<scratchpad>/uschess-report-audit.md`, and the prototype `<scratchpad>/usc04/tc2.ts` are not in the repository.

**PR 102**: what to do about its conflicts with `main` (under "Branches and pull requests"), and the eleven items in its own "For K to decide" list. Its member delete change, which refuses with 409 to delete a member with games or activity-log actions, is the same question as the US Chess brief's member delete answer.
