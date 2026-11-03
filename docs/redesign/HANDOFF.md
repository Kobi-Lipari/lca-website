# Handoff: the LCA website redesign

Written on Mon, Oct 19, 2026, for the next working session, brought up to date on Tue, Oct 20, 2026, after WS01 step 24, refreshed on Fri, Oct 23, 2026, after WS01 finished and merged, and brought up to date again on Tue, Nov 3, 2026, after WS02 step 9 and the Phase 0 trim merged. It is for whoever picks the project up, here in the cloud or on K's own PC from the command line. It says where every branch and pull request stands, the rules that hold for all of the work, how a slice and a board get built, what brief 1.4 and WS02 are, and what is waiting on K.

The brief is `docs/redesign/REDESIGN_SPEC.md`. On `main` it is version 1.4, which landed in WS02 slice 1 (see "Brief 1.4 and WS02"); on `redesign/docs-phase2` it is still version 1.3 (the docs branch adds one line to Appendix A). The build record is `REDESIGN_STATUS.md` at the repository root. The design decisions are in `docs/redesign/DESIGN_REPLAN_phase0.md`, `DESIGN_REPLAN_phase1.md` and `DESIGN_REPLAN_phase2.md`.

This file, `docs/redesign/tools/`, `docs/redesign/ws01-manifest.json`, `docs/redesign/ws01-lead-notes.md`, `docs/redesign/ws02-manifest.json`, `docs/redesign/ws02-plan-notes.md`, `docs/redesign/ws08-manifest.json`, `docs/redesign/ws08-plan-notes.md`, `docs/redesign/brief-1.4-notes.md`, `docs/redesign/briefs/` and `docs/redesign/uschess-fix-brief.md` live on `redesign/docs-phase2` until PR 106 merges. From another branch, read them with `git show origin/redesign/docs-phase2:<path>`.

`<repo>` stands for the repository root, and `<scratchpad>` for any local scratch folder outside it (see "On K's PC"). A file named under `<scratchpad>` is not in the repository.

## First

1. Check where things really stand before acting: `git ls-remote origin` shows the heads of `main` and the branches (under "Branches and pull requests" are the values of Tue, Nov 3, 2026), and the lead's check-in, which fires every three hours, reads the same state before it does anything.
2. Subscribe to activity on PR 106 (draft, documentation only). Subscribe to each WS02 checkpoint's draft pull request as it opens.
3. Read the end of `docs/redesign/ws01-lead-notes.md` (its last three sections: the focus-ring flake, the merge-safety review of checkpoint D, and the merge and the live check), then `docs/redesign/ws02-plan-notes.md`, then the WS02 lead's notes, `<scratchpad>/ws02-lead-notes.md`, which win over the manifest where they differ. "Brief 1.4 and WS02" below says what they hold.
4. Then carry on with WS02 on `redesign/ws02-navigation`: checkpoints E and F (slices 1 to 8) and slice 9, the first part of checkpoint G, are merged (see "Checkpoint E merged", "Checkpoint F merged" and "Step 9 and the trim merged" below). K reordered what follows on Tue, Nov 3, 2026: slices 10 to 19 wait behind WS08's creation part, WS09, WS10, WS14 and WS08's admin home (see "What comes next"). The October 19 design round (the boards still to be redrawn) runs alongside and is described below.
5. K's notes of Wed, Oct 22: finish the project in this session, with no handoff to the PC needed unless it is useful, and keep going past WS01's step 32 (brief 1.4, then WS02 and on).

## Branches and pull requests

Brought up to date on Fri, Oct 23, 2026, after WS01 finished and merged, again on Fri, Oct 30, 2026, after checkpoint E merged, and again on Sun, Nov 1, 2026, after checkpoint F merged, and again on Tue, Nov 3, 2026, after WS02 step 9 and the Phase 0 trim merged. The heads are as the lead last read them on Tue, Nov 3, 2026; `git ls-remote origin` shows the real ones.

**`main`**, head `0018039` (Tue, Nov 3, 2026). WS01 is finished and merged (all 32 steps, in four checkpoints), the live fixes of Oct 23 and 24 (pull requests 111 to 117) are merged, WS02's checkpoints E (steps 1 to 5) and F (steps 6 to 8) are merged, and so are WS02 step 9 and the Phase 0 trim; each is a pull request.
- A, steps 1 to 8: PR 105, merged Fri, Oct 9, 2026 at 3:06 AM UTC (`4f0882f`).
- B, steps 9 to 15: PR 104, merged Mon, Oct 12, 2026 at 10:29 PM UTC (`748a5ef`).
- C, steps 16 to 19: PR 107, merged Tue, Oct 13, 2026 at 2:03 AM UTC (`7151bff`).
- D, steps 20 to 32: PR 108, merged Thu, Oct 22, 2026 at about 6:53 PM UTC (`34b721c`), with `redesign/ws01-design-system` at `ffee346` as its last commit. GitHub stamps the merge at 6:52:31 PM UTC.
- E, WS02 steps 1 to 5: PR 110, merged Fri, Oct 30, 2026 at about 3:20 PM UTC (`8d7df98`), with `redesign/ws02-navigation` at `c0e17fc` as its last commit.
- F, WS02 steps 6 to 8: PR 118, merged Sun, Nov 1, 2026 at 11:23 AM UTC (`ed03823`), with `redesign/ws02-navigation` at `80839da` as its last commit.
- G, first part, WS02 step 9 alone: PR 119, merged Tue, Nov 3, 2026 at 11:46 AM UTC (5:46 AM Central) (`27fe278`), with `e58891c` as its last commit.
- The Phase 0 public-answer trim: PR 120, merged Tue, Nov 3, 2026 at about 6:35 PM UTC (12:35 PM Central) (`0018039`), with `13ed298` as its last commit. It sits on `27fe278`.

How checkpoint D was merged:
- A merge-safety review came first: three read-only judges, one lens each (what a visitor sees with every switch off; the infrastructure and the deploy; the owner's rules and the record), and three refuters for each blocking finding.
- The review's fixes went into one commit, `ffee346` ("Put right what the merge review of checkpoint D found"): six older record tests now spell their forbidden words in pieces, eight tests write the em dash by its code, `src/index.css` gives `--focus` a plain fallback for browsers without colour mixing, and the record is corrected.
- CI was green on that last commit. The CI run for the push to `main` passed, and the migration job and the worker deploy did not run, since nothing under `migrations/`, `workers/`, `functions/utils/` or `domain/` changed.
- The live deploy was checked at 7:10 PM UTC that evening: the live site's stylesheet, switches chunk and utilities chunk carry the same content hashes as a local build of the merged tree. All 24 switches in `src/lib/features.ts` are off in production, so nothing a visitor sees has changed.
- The details are in the last three sections of `docs/redesign/ws01-lead-notes.md` and in the Checkpoint D section of `REDESIGN_STATUS.md`. On `main` that section still says the merge is pending; WS02 slice 1 corrects it.

The final WS01 gate figures: `npm run lint` 13 errors and 13 warnings (the count never rises above 13); 4473 unit tests in 167 files; 790 integration tests in 58; 657 browser tests, of which 463 run and 194 are skipped, with the baseline unchanged (`test/a11y/baseline.json`, sha256 `ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`).

The production database is at `0058_state_champion_2026.sql`, and `0059` is the next number (WS08's step 2 takes it). In the container, the local `main` ref points at `4c1a466` and is 38 commits behind `origin/main`, so check the real state with `git ls-remote origin` before trusting either.

**`redesign/ws01-design-system`**, head `ffee346`. Merged as PR 108 and kept for now; it can be deleted once nobody needs its history.

**`redesign/docs-phase2`**, draft PR 106 (documentation only), head `f7a62e8` before the commit that carries this refresh (Tue, Nov 3, 2026), pushed up to `f7a62e8`:
- It holds `DESIGN_REPLAN_phase2.md`, the October 13 and October 19 round records, the canvas and its boards, the tools, the WS01 briefs (`docs/redesign/briefs/ws01-22-brief.json` to `ws01-32-brief.json`) and `ws01-manifest.json` with `ws01-lead-notes.md`, the US Chess upload brief, this file, and since Fri, Oct 23 `ws02-manifest.json`, `ws02-plan-notes.md` and `brief-1.4-notes.md`, and since Tue, Nov 3 `ws08-manifest.json` and `ws08-plan-notes.md` (the WS08 creation-roles plan, `a513c8d` and `f7a62e8`).
- It merged `main` in (`0ffefa5`), so its copy of `docs/redesign/REDESIGN_SPEC.md` is 1.3 plus the Zextaos line in Appendix A.
- **It must never carry the 1.4 spec.** Fourteen unit tests on `main` read that file and would turn `main` red (see "Brief 1.4 and WS02"). Kept like this, PR 106 merged cleanly before or after any WS02 checkpoint, until brief 1.4 reached `main`.
- **It is open and dirty.** Since brief 1.4 landed on `main`, GitHub shows PR 106 as conflicting with `main` (the two copies of `docs/redesign/REDESIGN_SPEC.md` differ: 1.3 here, 1.4 there). It needs `main` merged in, with the spec taken from `main` and this branch's Appendix A line carried over by hand, before it can merge. Nothing is waiting on it. When the lead merges `main` in, it commits the merge as the owner (see "Workflow gotchas").
- Its description is out of date: it still says the design-system briefs are steps 22 to 25 and that version 1.4 is yet to be cut. Bring it up to date before K reads it.

**`preview-new-look`**, head `676b987`, a throwaway branch. It is `main` with only `newLook` and `themeHeritage` turned on in `src/lib/features.ts`, pushed on Fri, Oct 23, 2026 for K's board meeting demo at `https://preview-new-look.lca-website.pages.dev`. It is never merged, and it is deleted after the meeting.

**`redesign/ws02-navigation`**, cut from `main` at `34b721c` on Fri, Oct 23, 2026; at `0018039` on Tue, Nov 3, 2026 (fast-forwarded onto the trim's merge commit, after `27fe278`, the merge of step 9), with steps 1 to 9 merged and step 10 next, deferred (see "What comes next"). Before that it stood at `ed03823` on Sun, Nov 1, 2026, on checkpoint F's merge commit, and at `8d7df98` on Fri, Oct 30, 2026, on checkpoint E's merge commit. Each WS02 checkpoint is a draft pull request from it against `main`.

**`phase0/public-answer-trim`**, the trim's branch (PR 120, merged). It ended at `13ed298` after a force-push with lease on Tue, Nov 3, 2026, and can be deleted.

**`ops/memberships-2026-11`**, cut from `27fe278` on Tue, Nov 3, 2026: the membership script `scripts/apply-memberships.mjs` with its unit and integration tests, for the 19 membership adds and the one email change K sent. **Not yet pushed**, and no pull request: it is gated in its own worktree, then committed as the owner, pushed and opened as a draft. The people's details are in a plan file outside the repository, never in a commit.

**`fix/renew-default`**, cut from `27fe278` on Tue, Nov 3, 2026: the renewal change (adult preselected on a signed-in member's Renew panel, the price beside each tier). **Not yet pushed**, and no pull request. It goes live with K's yes and no switch; its gate runs in the main checkout after `main` is merged into it, as the owner.

**`redesign/ws08-creation-roles`** is planned and has not been created: it is cut from `main` when WS08's step 1 starts (see "What comes next").

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

**Where it stands (Tue, Nov 3, 2026).** Checkpoints E (slices 1 to 5) and F (slices 6 to 8) are merged into `main`, as `8d7df98` and `ed03823`, and so is slice 9, checkpoint G's first part, as `27fe278`; the record's WS02 line reads "checkpoints E and F and step 9 are merged". Slices 10 to 19 are deferred behind other workstreams (see "What comes next"), with the three switches `newNav`, `siteSearch` and `eventStrip` off until about checkpoint I. PR 106 is open and dirty against `main` (see "Branches and pull requests").

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
- **Never `git add -A` in a worktree whose `node_modules` is a symlink; stage by path.** Commit `e58891c` (the step 9 merge-review fix, made in the WS02 worktree) tracked the link, because `.gitignore`'s `node_modules/` matches a directory only, not a symlink. It reached `main` in PR 119's merge. Two harms followed. GitHub's own Pages build (`pages-build-deployment`) failed on `main` at `27fe278` because of it; CI itself stayed green because `npm ci` replaces the link. And checking a commit that tracks the link out over a real `node_modules` replaces the modules with a link to itself, a loop: at about 3:23 PM UTC (9:23 AM Central) on Tue, Nov 3, 2026, merging `main` into the trim's branch did exactly that to the main checkout, which broke every worktree's linked modules while two other builds were running, and `npm ci` rebuilt them. `main` now has a plain `node_modules` line in `.gitignore` and no tracked link (the trim's PR removed it). A revert of that merge or of the trim would put the link back, so a rollback is "revert the revert". Check any build that ran during an outage for failures the outage caused.
- **Every git command that writes a commit takes the owner's `-c user.name` and `-c user.email` pair**, not only `git commit`: merge, cherry-pick, revert and rebase too. The container's own git config names the session's tool, so a bare `git merge` records a tool's name and a no-reply address as author and committer. That happened to the trim's merge of `main` (`9caac92`); the merge-safety review found it, and it was the one finding upheld, because a merge commit on a branch that merges with a merge commit stays in `main`'s history for good. The branch was rebuilt before the merge: reset to `2da1513`, the merge redone as the owner (`157ecd2`), and the repair cherry-picked on top (`190e118`), with an identical tree, then force-pushed with lease.
- **A live check compares the stylesheet and the switches chunk, never the main script's hash.** A Pages build gives the main script a different name from a local build's (checkpoint F, step 9 and the trim all showed it, and the live name even changed between two tries on the trim's check, from `index-e6206m2e.js` to `index-BL1DefRR.js`, as the Pages build landed). A loop that waits for the local main script's name never ends. Wait on `index-BP5ORuyk.css` (or whatever the local stylesheet is) and `features--b6t5tBm.js`, then read the rest.

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

**Added Tuesday, November 3, 2026** (none blocks the work already planned; the first four gate WS08's switch, not its build):
- **Two production reads for WS08, read by K alone** with K's own credentials, one read-only statement each, never a write (brief 0.2: every read of production is K's). The lead cannot run them and does not guess their answers. (1) The members who hold the `tournament_director` role: K takes the role from anyone who should not create events, and reports names back, never emails. (2) The President seat: K checks that the seat with the slug `president` is active with one current assignment, that it is the right member, and that the holder's role is `lca_observer` or `lca_officer` (a holder whose role is `member` or `lca_auditor` has no page to create from, so K sets it before the switch goes on). The two statements are in `docs/redesign/ws08-plan-notes.md`, "Questions for K".
- **When `standingDirectors` goes on.** Default: after checkpoint L has merged and K has looked at the pages on a throwaway preview with the switch and `CREATION_ROLES_ON` on together, after the preview migration from the branch, and after the two reads above.
- **The trim's two preview looks,** and the two questions the roster rule leaves (the US Chess ID beside a shortened name; the standings before the first result), under "Step 9 and the trim merged". Q14 (the club email) and Q38 (the roster) are K's to settle there.
- **Confirming the refined order,** and the change to brief 1.5: creation roles before WS09, WS14 after WS10, and WS02 steps 10 to 19 deferred. K agreed on Tuesday, November 3, 2026; the written confirmation of the dates and the brief change are still open. Also still open from the same reorder: WS14's entry screens, which week the board meeting is, and the actions (the director role holders on production, the Turnstile keys, `SIGNING_SECRET`, the Facebook token and id, the logo preview bucket, the map price, and the 25 clubs' basics).
- **The renewal exception.** K asked that a renewing member start on Adult. A member whose last tier was Family, who renews as Adult, has `membership_type` changed to adult, so their children's family coverage stops extending. Recommendation: preselect Family for an active Family member (an exception to K's rule). Until K says yes, the change as built starts everyone on Adult.
- **The Supabase values for the membership script.** K added the project address and a secret key to the environment; they are not written anywhere in the repository or in this file. A new session reads them. Until then the script's dry run and apply wait, or K runs the script on their own PC.

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

## Live fixes while WS02 is paused (Friday, October 23, 2026)

K paused the redesign after WS02 slice 2 (PR 110 stays a draft at 9be3e7c; slice 3's partial build is parked, uncommitted, with its patch in the session scratchpad) and asked for two live-site changes, built on branches off main with the full gate each:

- **Membership "pending" explained and checkable** (PR 111, merged as main 135f584 and verified live). Checkout goes to Stripe in the same tab; the profile and the membership page say what pending means and offer "Check my last payment"; the page after checkout reports the real payment state (paid, processing, open with a "Finish paying" link, expired, unknown, none); a lapsed checkout is recorded as failed; activation is one D1 batch. New helper `src/areas/membership/paymentState.ts`. Production counts that day: 22 pending accounts, 15 of them children or walk-ins, 4 adults who started a payment and never finished, nobody charged and stuck.
- **State and scholastic champions** (PR 112, merged as main 759928a on Friday, October 23, 2026; migrations 0055 and 0056 applied to production first time; live page verified). Migration 0055 adds `kind` and `photo_url` to `state_champions` (schema drift pin 316 columns; next migration 0057); migration 0056 imports 87 state rows (1915 to 2025) and 75 scholastic rows (2009 to 2021) with fixed ids `lca-<kind>-<year>-<title-slug>-<name-slug>` and 31 photos under `public/champions/photos`. `/champions` lists each person once, ordered by their latest win so the reigning champion is first (K's rule), with a "Winner of a year" select per list; 87 state rows and 75 scholastic rows (162), 31 photos; the grouping lives in `src/areas/events/champions.ts` (groupByPerson, winnersOfYear, yearsWon) for WS10's `/about/champions` to reuse. Brief 1.4's WS10 note "no ALTER needed on state_champions" is now out of date: the two columns exist.
- K's answers on the champions: the unidentified 2014 K-8 U800 photo stays out; Jim and James Rousselle are two people; the old site's Blitz and quick-chess lists are not imported. On "pending": it is every new account's default; the explanation was fixed, the word was not; K was offered a label-only change now or the status change in the membership workstream, no decision yet.
- Repo lessons: `api-exports.test.ts`, `api-split-modules.test.ts` and `api-split-tool.test.ts` pin the `@/lib/api` barrel to exactly 182 names and restrict what an area's `api.ts` may import, so new types go beside their helpers; adding a migration means moving the pins in `db-generate-guard.test.ts`, `db-generate-real-kit.test.ts`, `drizzle-baseline.test.ts`, `seed-fixtures.test.ts`, `migration-0054-requirement.test.ts`, `schema-drift.test.ts` and the README's "next number" line; the heritage layout fixture (`test/unit/fixtures/heritage-pages-today.ts`) holds each heritage page's markup by length and sha256 and is redrawn from the test's failure output when a page changes on purpose.
- Also noted for later: K wants a one-click test-data seeder for directors when the tournament creation and management work is built (sample entries named for the quirk each exercises), on preview and test databases only.

### Further live fixes (Friday, October 23 and Saturday, October 24, 2026)

Five more changes, each built on a branch off main with the full gate and merged when CI was green:

- **State champions in the More menu** (PR 113, merged as main 92843dd on Friday, October 23, 2026; live index carries the entry). The header's More menu gains a "State champions" entry linking to `/champions`, between Membership and Support; the mobile drawer draws the same list. A weekday in the Support entry's comment was corrected.
- **"Pending" retired as a membership status** (PR 114, merged as main 68cf246 on Friday, October 23, 2026). K's answer to the question recorded above: "Membership default should be none"; "Keep it succinct ... Just no membership is fine. And on the children thing maybe not family membership is better wording". The stored value for an account with no membership is now `none`. The dashboard badge says "No membership", children say "No family membership", and the admin members table and the admin email page offer none. Migration 0057 replaced the member role triggers to allow none, moved every pending row to none, and added two triggers (`members_status_none_insert` and `members_status_none_update`) that turn a pending write into none, so the old default and old code cannot bring it back. The column's stored default stays `pending` on purpose, because changing a default in SQLite rebuilds `members`, which other tables cascade from. Whether a payment is in flight is answered by `POST /api/membership/confirm`, not by the member row. Production after the merge: active 126, expired 78, none 22. Lessons: the backfill must come after the check triggers are replaced or the old check rejects none; the gold guard's badge allowlist lost the members table's Pending tag; the migration pins moved to 58 files with 0058 next.
- **Reigning champion card** (PR 115, merged as main 4620cc8 on Friday, October 23, 2026). The top of `/champions` shows a gold-edged featured card with the champion's latest photo, their note, their record and an "Every title" link. K asked: "be sure to include their latest photo. Make it look nice. It should be special." A shared title draws each holder side by side; with no photo the trophy mark stands in. The heritage layout fixture for the champions page was redrawn and the gold guard's line pins moved.
- **2026 state champion** (PR 116, merged as main bd031b9 on Friday, October 23, 2026; migration 0058 applied to production). Dr. Robert Forney is added as the 2026 Louisiana State Champion with his photo at `public/champions/photos/state-2026-dr-robert-forney.jpg`, cropped at K's request to centre him with the board. The champion's note (for example "FIDE Master") moved to the right of the name on the reigning card. Production: 88 state rows. The uncropped original is not in the repository; K has it.
- **One title, quieter card** (PR 117, merged as main 39e35e8 on Saturday, October 24, 2026). A champion with a single state title no longer gets the "First state title." line or the "Every title" link on the reigning card; both show only with more than one title, and "Shared this year." still shows for a shared title. The 2026 photo was replaced by the trophy presentation with the tournament director, cropped to the two of them and the trophy (the uncropped original is not in the repository; K has it). Live: the new photo serves and the page no longer carries "First state title".

The standing notes above stay as they are: the tournament test-data seeder for directors, the newsletter waiting on K's answers, "300+ members" stays, and the demo walkthrough last.

WS02 resumed on Thursday, October 29, 2026 after K's weekly limit reset. Step 3 (the page frame, the chrome's rings, the browser bar colour and the loading line) was finished from the parked tree and committed to `redesign/ws02-navigation` as 519b2c2, and pull request 110's description now covers steps 1 to 3. Main's seven merges (pull requests 111 to 117) were merged into the branch with the gate before step 4 started (42289d4); what followed is under "Checkpoint E merged" below.

## Checkpoint E merged (Friday, October 30, 2026)

WS02 steps 1 to 5 went to `main` as pull request 110. What happened after the resumption on Thursday, October 29, 2026:

- **Step 3** was committed as `519b2c2` (Thursday, October 29, 2026).
- **Main's seven live fixes** (pull requests 111 to 117) were merged into the branch as `42289d4`, with the full gate. One command-line test per run timed out at its 5 second limit and passed alone; integration was 810 tests in 59 files.
- **Step 4** was committed as `7568680` (Friday, October 30, 2026, 00:26 UTC). The browser tests now read the header and footer through one helper, `test/a11y/chrome.ts`. The `stripComments` fix went in with it, and two gold-ink tests have 20 second limits.
- **Step 5** was committed as `350fe48` (Friday, October 30, 2026, 12:55 UTC). It holds the new desktop header, the About and My LCA menus, the Donate dialog in the same tab, the squeeze, the header height variable, the WS02 gold, and the Checkpoint E section of the record.

How checkpoint E was merged, as checkpoint D was:
- A merge-safety review came first: three read-only judges, one lens each, and three refuters for each blocking finding. The infrastructure judge said merge; the visitor judge and the rules judge said fix first.
- Upheld (3 to 0): the record and the pull request text said both new dialog files load only when Donate is pressed. The dialog parts that the donation dialog shares with the scanner page are fetched on every visit to `/scanner` with every switch off (27 files where there were 26, 509 bytes more, nothing drawn differently).
- Refuted (3 to 0) as wording rather than blocking: the same point in the pull request text, and the subject of merge commit `42289d4`, which names two dates without weekdays. It is left in history. The lesson: merge subjects carry weekdays.
- The fixes went into one commit, `c0e17fc` ("Put right what the merge review of checkpoint E found"). It corrected the record: the dialog files, the migration job does not start, and the rollback's sentence on bringing the checkpoint back. It corrected the pull request text: the error screen's instant on a stale tab, tabs opened before the deploy still need one refresh, the banners' `data-ring-ground` markup with every switch off, `aria-current` marks the section's link, the banners' ring change shows in dark mode, and the scroll padding rule is 0 until the new header writes its height. The pull request was retitled to name all five steps.
- CI was green on `c0e17fc` (Build and test, Accessibility, and the Pages build). Pull request 110 merged into `main` as `8d7df98` on Friday, October 30, 2026 at about 3:20 PM UTC (GitHub stamps it 15:20:44 UTC). The merge commit's message names the day.
- On the push to `main` the Pages build and CI ran. The migration job and the worker deploy did not start, since nothing under `migrations/`, `workers/`, `functions/` or `domain/` changed.
- The live check at 15:21 UTC that day: the live site's stylesheet (`index-CeRsG6FF.css`) and switches chunk (`features--b6t5tBm.js`) carry the same content hashes as a local production build of the merged tree. The main script's name differs, as the Pages build sets its own build-time values. All 42 switches are off in production, so nothing a visitor sees has changed.
- `redesign/ws02-navigation` was fast-forwarded to `8d7df98`. Checkpoint F (steps 6 to 8) starts from it with step 6, the Menu sheet, the tablet header and the phone's app bar, and gets a new draft pull request after step 6's commit.

Left for later by the review:
- `test/unit/e2e-preview-guard.test.ts`: its command-line test keeps the 5 second default and timed out once under load. Give it 20 seconds in a later step.
- `test/unit/source-not-lines.test.ts` imports `@tailwindcss/oxide`, which `package.json` does not declare. Declare it at 4.3.3, pinned, in a later step.
- Two step 1 record tests spell the banned working words as plain text inside their own patterns. Build them from pieces, as steps 2 to 5 do.

Two nits from step 5's review carry into step 6:
- The lazy donation dialog's Suspense in `SiteHeader.tsx` has no error boundary of its own.
- Log in passes the page as "from" on `/forgot-password` and `/reset-password` too.

## Checkpoint F merged (Sunday, November 1, 2026)

WS02 steps 6 to 8 went to `main` as pull request 118. What happened after checkpoint E merged:

- **Step 6** was committed as `19fd34f` (Saturday, October 31, 2026, 02:52 UTC). It built the Menu sheet, the tablet header and the phone's app bar. The sheet is a modal dialog on the dialog parts the donation dialog already uses: it covers a phone's window down to the tab bar and is a drawer 400 pixels wide on a tablet. The tablet header is one navy row 64 pixels high; the app bar is one navy row 56 pixels high. The bars got an error boundary of their own around what they fetch on demand, and Log in on `/forgot-password` and `/reset-password` hands `/login` the page it was handed. Both came from step 5's review. Pull request 118 was opened as a draft after this commit.
- **Step 7** was committed as `7683c68` (Saturday, October 31, 2026, 14:44 UTC). It built the tab bar and the dock, which holds the tab bar and leaves places for a page's own bar and the event bar. With the chrome on, the built page's viewport tag carries `viewport-fit=cover`; with either switch off it is today's. A second code-splitting group, the `utils` chunk, holds the small helper library the packages share. It also built the three items checkpoint E's review left for later: the 20 second limits on the command line tests, `@tailwindcss/oxide` declared as a development package, and the step 1 record tests built from pieces.
- **Step 8** was committed as `e76858c` (Sunday, November 1, 2026, 08:52 UTC). It built the new footer at every width: the logo from two sized files with no plate, four columns that fold under heading buttons below 768 pixels, and a base line with the trust line and the build's date. The date is a `build-date` meta that the plugin writing the viewport tag puts into the built page only with the chrome on, so the built page holds none with every switch off. The dock now comes before the footer. Two pages changed: the contact page fills its subject from the footer's links, and the clubs page brings its map into view for Club map.

The reviews, one line each:
- Step 6: two focus losses in the bars' failure path (blocking, fixed); the page-count rise from the helper library's split was taken as the build gives it and step 7 measured again; nits carried to step 7.
- Step 7: two blocking (a focus loss when a phone's window jumped straight to 1024 pixels with the sheet open; the record stale after the tester), fixed; a should-fix on the judgement calls, fixed; nits carried to step 8 (the dock's width under the scroll lock, a slot on the Menu buttons, letter case in the current tab).
- Step 8: one blocking (the record and the browser runs predated the tester's files), fixed; a should-fix (the footer's layout followed the stylesheet's own breakpoints while its fold followed the window, so the two parted at another default font size), fixed; nits carried to step 9 (the failure notice at the footer's top, the brand block's empty cell, the contact page's seat, the trust line's dots at 768 to 1023 pixels, the fold keeping the focus).

How checkpoint F was merged, as checkpoint E was:
- A merge-safety review came first: three read-only judges, one lens each (visitor, infrastructure, and rules and record), and three refuters for each blocking finding. The visitor and infrastructure judges said merge; the rules and record judge said fix first.
- The one blocking finding (the record said integration tests were among the changed files; none was) was refuted 3 to 0 as not blocking, and the fact was confirmed. The should-fix items were all text, and they went into one commit, `80839da`: the per-page fetch counts completed for eleven pages, the helper library's move from the main script into `utils-*.js` stated, three footer comment dashes (not two) named, the grep check counts re-measured, 35 renamed files (`index.html` keeps its name), the "other files" line without integration tests, the newLook-alone clause for two rules that compute to 0, K's lists completed, the date line saying checkpoint E is merged, the clubs page's comment dash at line 38 made a comma, and the gold codemod's two command line tests given 20 seconds.
- Nits left for later: three WS01 record tests spell their banned words as plain text (rebuild them from pieces when next touched); `index.html`'s description holds an em dash, which is K's word, recorded since step 3.
- CI was green on `80839da` (Build and test, Accessibility with Playwright and axe, and the Pages preview, Sunday, November 1, 2026, 11:05 to 11:22 UTC). Pull request 118 merged into `main` as `ed03823` on Sunday, November 1, 2026 at 11:23 AM UTC (5:23 AM Central), with a merge commit. `main` had not moved from `8d7df98`, so the merge commit's tree is `80839da`'s.
- On the push to `main` Pages rebuilt the site. The migration job did not start and the worker was not deployed, since nothing under `migrations/`, `workers/`, `functions/utils/` or `domain/` changed. The production database is unchanged.
- The live check at 11:25 UTC that day: the live site's stylesheet (`index-BP5ORuyk.css`) and switches chunk (`features--b6t5tBm.js`) carry the same names as a local production build of the merged tree, and the switches chunk is byte for byte the one checkpoint E shipped. It holds 42 entries, all off. The live page's viewport tag is today's and the page holds no `build-date` meta. The local build also holds `MobileMenu-QkI59fPU.js`, `utils-DmiqQ2Hc.js`, `lca-logo-56-CcKcDPdg.webp` and `lca-logo-112-rAGZeUR0.webp`, which no page fetches with every switch off.
- `redesign/ws02-navigation` was fast-forwarded to `ed03823`.

The figures at the close of step 8, measured on the tree that merged:
- `npm run lint`: 13 errors and 13 warnings.
- Unit tests: 6,329 in 234 files. Integration tests: 821 in 60.
- Browser tests: 995, of which 659 run and 336 are skipped, three runs in a row. The baseline is unchanged (`test/a11y/baseline.json`, sha256 `ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`).
- `dist/assets` holds 189 files. Every page still fetches 7 files, and no page fetches more than before.

Lessons the review of checkpoint F added, beside checkpoint E's (merge subjects carry weekdays):
- A per-page fetch list covers every page whose chunks changed, not only the pages the step named. Nine more pages than the record named fetched fewer files, because three small icons moved into the main script.
- A claim that a library "stays" somewhere is measured against the merge base, not the previous step. The record said the helper library stayed in the main script; against the merge base it moved into `utils-*.js`.
- Record counts are re-measured after every late edit. The grep check counts in the record went stale after late edits.
- The record's "other files" line lists only kinds that changed. It named integration tests, and none changed.

For K, before the switches go on: nothing is needed for the merge. On a throwaway preview with `newNav` and `newLook` both on, K looks at the Checkpoint F list in `REDESIGN_STATUS.md`: the tablet header, the app bar and the sheet; the tab bar on a phone; the new footer at its widths, with its folds, the logo and the date; and each judgement call of steps 6 to 8. With `newLook` alone, K looks at today's chrome under the new look, today's footer among it, since no test build draws it any more.

## Checkpoint G opens (Sunday, November 1, 2026)

Checkpoint G is steps 9 to 11, search, on the same branch from `ed03823`. Its draft pull request is opened after step 9's commit, and step 10 names its number in the record. Step 9 is the first of the three. Its shape, from the lead's corrections:
- **The listing rule.** `functions/utils/events/listing.ts` (new) exports `listedWhere(alias)`, today's rule `<alias>.is_visible = 1` as a fragment for the handlers' prepared-statement style. A unit test fails when a public query of tournaments in a listed file names `is_visible` itself instead of calling it. The seven inline uses that exist today are not rewritten here; the record lists them, with file and line, for WS03's shared event query.
- **The search endpoint.** A new public endpoint returns five groups: tournaments, clubs, news, results and champions. Partner events sit inside the tournaments group, with the organizer's link and the state, never a count and never a Register affordance. "Upcoming" and "completed within 3 years" are decided by the Central calendar day, worked out once per request. A normaliser in `domain/` (lowercase, accents stripped, "&" to "and", "saint" to "st") is applied in code, with a bounded query ahead of it. The answer is cached for 60 seconds, and the endpoint answers from the database alone where the edge cache does not exist. It is live from the merge while `siteSearch` stays off, holds no member, registration, email or player-name field, and has no rate limit until WS07's helper. Because the merge changes `functions/utils/` and `domain/`, it redeploys the daily-emails worker, which bundles nothing the step adds.
- **The footer items carried from step 8's reviews.** The failure notice is brought into view; the brand block uses two columns only when a join slot is drawn; the contact page resets its seat when the address changes; the trust line's dots are drawn only from 1024 pixels if the row still wraps between 768 and 1023; and the fold keeps the focus as the window crosses 768 pixels.

Step 9 was built and merged on Tue, Nov 3, 2026 as checkpoint G's first part, alone; see "Step 9 and the trim merged". Steps 10 and 11 are deferred.

## Step 9 and the trim merged (Tuesday, November 3, 2026)

WS02 step 9 went to `main` as pull request 119 and the Phase 0 trim as pull request 120, on the same day, in that order. K's reorder of the day (under "What comes next") put both ahead of everything else.

**Step 9: the listing rule and the search endpoint** (checkpoint G, first part, on its own).
- It was built in a lean run (about 3.6 hours) and committed as `b7c11e6` (Tuesday, November 3, 2026, 10:46 AM UTC, 4:46 AM Central). The lead's gate: lint 13 errors and 13 warnings; unit tests 6,685 in 247 files; integration tests 868 in 63; browser tests 659 run and 336 skipped, baseline unchanged. The brief's own review rounds had found two blocking issues and two should-fix items, all fixed (a helper that let a caller's header join its own when the names differed in case; the record predating the tester's ten files; the PR text had to describe step 9 alone; "saint" to "st" now matches a whole word only), and one nit went to the next slice: a multi-day partner event under way shows only its first day in its second line (`partnerItem` should write the range as `upcomingItem` does).
- Draft pull request 119 opened with `b7c11e6` as head. The merge-safety review was lean (three judges: visitor, infrastructure, rules and record). All three said merge, and no blocking finding stood. The should-fix items were text and went into one commit, `e58891c` ("Put right what the merge review of step 9 found"): the CI end time of the checkpoint F run (11:20 AM UTC, not 11:22), the footer follow-up gaining step 9's five items, the rollback gaining "revert the revert", and the stale-tab sentence (a tab that has already used its one automatic reload shows the error screen at the next deploy, carried as a follow-up for WS02 step 18). Nits went to the record. That commit also tracked the `node_modules` symlink by mistake (see "Workflow gotchas"), which nobody caught until the trim's merge of `main`.
- CI was green on `e58891c` at 11:44 AM UTC (5:44 AM Central): Build and test, Accessibility, and the Pages build. Pull request 119 merged into `main` as `27fe278` on Tuesday, November 3, 2026 at 11:46 AM UTC (5:46 AM Central), with a merge commit. The daily-emails worker redeployed (run 41630254243, success, 11:46 to 11:48 AM UTC), because the merge changes `functions/utils/` and `domain/`; it bundles nothing step 9 adds. The migration job did not start.
- The live check, from 11:47 AM to 12:00 PM UTC (5:47 AM to 6:00 AM Central): the Pages build landed at 11:48 AM UTC. The live stylesheet (`index-BP5ORuyk.css`) and switches chunk (`features--b6t5tBm.js`) match a local build of `27fe278`; all 42 switches are off (42 false, 0 true); the viewport tag is today's; the page holds no `build-date` meta. `/api/search?q=chess` answers 200 with JSON, `Cache-Control: public, max-age=60` and the Tournaments group first, partner rows marked external; `/api/search` with no `q` answers 400. The main script's name differed from the local one, so the loop that waited for it timed out and the rest ran as a second pass (the third lesson under "Workflow gotchas").
- `redesign/ws02-navigation` was fast-forwarded to `27fe278`. Step 9's merge was not written into `REDESIGN_STATUS.md` at the time; the trim's record change carried it (below).

**The trim: Phase 0 public-answer trim** (brief 1.4 section 4, D29, with D15, Q14 and Q38).
- **What was built,** by a lean run on `phase0/public-answer-trim` (8 agents, about 4.4 hours, two fix rounds), with no composed brief (11 lead corrections and a facts file instead). Committed as `2da1513` ("Trim personal and internal fields from public answers").
  - With no switch: each officer's email leaves `GET /api/clubs/:id`, and `created_by`, `keep_apart` and `report_settings` leave the public tournament answers for anyone who does not manage the event. No public page read them. The admin and manage answers are untouched.
  - Behind `clubEmailHidden` (constant `CLUB_EMAIL_HIDDEN`): the club's `contact_email` and the club page's contact lines, which become a link to the contact form.
  - Behind `rosterShortNames` (constant `ROSTER_SHORT_NAMES`): the event page's roster writes an entrant under 18 as first name and last initial, for anyone who does not manage the event.
  - The record gained a Phase 0 section after WS15, and the two WS01 follow-ups on public responses and name suffixes are closed.
- **The standings rule that was taken out.** A fixer had added a rule that also shortened names in the standings before the first result. That went against ruling 5 (standings and prizes keep full names for everyone) and Q38, and the second fix round took it out. The roster is shortened; the standings, prizes and pairings are worked out from full names and stay full. What is left of it is a question for K (below).
- **Main was merged into the branch** after step 9 merged, as the owner's commit on the rebuilt branch (see the identity lesson). The merge brought in the tracked symlink and the incident described under "Workflow gotchas"; the repair is in the trim's PR (the link removed, a plain `node_modules` line in `.gitignore`).
- **Gate on the merged tree** (`43ff9e2`, 3:26 to 3:58 PM UTC): lint 13 and 13, build, typecheck of the functions and the bundle check passing; unit tests 6,772 in 254 files; integration tests 897 in 65; browser tests 659 run and 336 skipped in 23.8 minutes; baseline `ce04ac06...` unchanged. Draft pull request 120 opened at 4:00 PM UTC (10:00 AM Central), 29 files, 2,527 lines added and 65 removed, and CI went green on it that afternoon.
- **The review** (three judges and the refuters, 9 agents, about an hour). The visitor judge and the infrastructure judge said merge. The rules and record judge said fix first, with three blocking findings. One was upheld: the merge commit named the session's tool as author and committer (rebuilt as `157ecd2`, trees identical). Two were refuted as not blocking (the facts were right): the record said its test held every line the trim wrote outside its section, but the follow-up on minor names at line 1763 was not held; and the PR text called `27fe278` "the step 9 merge-review fix" when it is PR 119's merge commit (the fix is `e58891c`). Both were fixed in the fix round anyway. The visitor judge's should-fix was that the PR text left out what the renamed files mean for a tab open across the deploy (all 36 on-demand files and the main script get new names, so such a tab reloads once, and a tab that has already used its reload, as one open across step 9's deploy may have, shows the error screen until Refresh).
- **The fix round's record changes** (a builder and a checker, about 43 minutes): the Phase 0 section's status, its pull request number and its two questions for K; step 9's merge recorded in the WS02 PR line; a new bullet in the step 9 block and the date line's WS02 part reading "checkpoints E and F and step 9 are merged"; step 9's follow-up closed; the one-reload follow-up for WS02 step 18 added (a tab that already reloaded once stays on the error screen; clear the `sessionStorage` mark after a successful load); line 1763 held by the Phase 0 record test. The PR text gained the stale-tab sentence, the rollback's "revert the revert" for the trim, the point that GitHub's own Pages build failed on `main` at `27fe278` and that removing the link ends that, and the correct account of `27fe278`. The checker verified all of it, and three small wording items were applied by the lead.
- **Gate 2** (on `190e118` plus the record fix, 5:41 to 6:15 PM UTC): lint 13 and 13, build, typecheck and bundle check passing, browser tests 659 run and 336 skipped with the baseline unchanged; integration tests 897 in 65; five unit tests timed out under load (four in the API split tool's tests, one in the step 25 test) and all passed alone (56 passed). The fix was committed as the owner (`13ed298`) and the rebuilt branch force-pushed with lease.
- **The merge.** CI was green on `13ed298` at 6:32 PM UTC (Build and test 6:23, Accessibility 6:32, and the Pages preview). Pull request 120 merged into `main` as `0018039` on Tuesday, November 3, 2026 at about 6:35 PM UTC (12:35 PM Central), with a merge commit. `redesign/ws02-navigation` was fast-forwarded to `0018039` and pushed; the fast-forward removed the tracked link from the branch, and the worktree's modules were linked again.
- **The live check,** 6:34 to 6:35 PM UTC (12:34 to 12:35 PM Central): the live stylesheet (`index-BP5ORuyk.css`) and switches chunk (`features--b6t5tBm.js`) match a local build; all 42 switches are off; no `build-date` meta. The main script's name differed again (`index-e6206m2e.js` on the first two tries, then `index-BL1DefRR.js` once the Pages build landed), as the lesson says it will. On the public answers: signed out, `GET /api/tournaments` returned no rows (production holds no listed event right now), so the three removed keys could not be seen absent on a row; and the one club read (`baton-rouge`) returned no officers, so the officers' emails could not be seen absent either. The check shows the shapes carry none of the keys, not that a row with them was cleaned. The integration tests and the review's side-by-side read of both trees on a seeded database are the proof of the change itself. No migration came with the trim; the lead's notes do not record whether the daily-emails worker redeployed for it, so check the Actions list.

**What K does after the merge.** Nothing is needed for the merge itself. Then two looks on a throwaway preview, with its database migrated from the branch first:
1. `clubEmailHidden` with `CLUB_EMAIL_HIDDEN`: a club's page with the two contact links in place of the address, and the contact form they open. If it reads right, turn the switch and the constant on in one change (Q14).
2. `rosterShortNames` with `ROSTER_SHORT_NAMES`: an event's entrants list, signed out, as a parent and as the event's director: the under-18 entrants shortened for the first two and in full for the director.
Before turning the roster rule on, two questions are left for K (Q38 is the second):
- Whether a shortened entrant's US Chess ID, which the list still shows and which finds the full name on US Chess's own member search, is left out as well.
- Whether the event's standings before its first result (which list every entrant at no score, in full, and which the print page draws) follow the roster's names for anyone who does not manage the event.

## What comes next

Written on Tuesday, November 3, 2026.

**K's reorder for the December board meeting.** K wants, for a board meeting in December 2026, a presentation of the current workflows for board members and regional representatives on the website, and asked that WS09, WS10, WS14 and WS08 come after WS02's first part to bring usable things to staff. K agreed the refined order the reorder analysis gave (no lasting harm, five adjustments):
1. WS02 step 9, merged (Tuesday, November 3, 2026).
2. The Phase 0 trim, merged the same day.
3. WS08's creation part first, about 10 steps, needing only WS01.
4. WS09 (about 33 steps), then WS10 (about 22), then WS14 (about 15).
5. WS08's admin home and Needs attention (about 10 steps) after those four.
6. WS02 steps 10 to 19 deferred: the rest of checkpoint G (10 and 11), then H and I. `newNav`, `siteSearch` and `eventStrip` stay off until about checkpoint I.
7. WS03 onward after that. The TD console and the setup checklist, QR check-in and the rating report (WS08's other parts) wait for WS05 to WS07.

The reorder's central dates (Central time, 1.2 slices a calendar day with the measured idle days) are: creation roles Thu, Nov 12, 2026; WS09 Thu, Dec 10, 2026 (its staff half about Fri, Nov 27, 2026); WS10 Wed, Dec 30, 2026; WS14 Tue, Jan 12, 2027; WS08's admin home Thu, Jan 21, 2027; WS02 checkpoint I about Sat, Jan 30, 2027. With WS14 first instead, WS14 would land Thu, Nov 26, 2026 and WS09 Fri, Dec 25, 2026. Three shared pieces are built early inside WS09 under the brief's names (`functions/utils/tokens.ts`, `rateLimit.ts` with its `rate_limits` table, and `automation_runs` with `recordRun`). Follow, follower emails, the weekly digest and the bylaws watch list wait for WS07's outbox. The new order is to be written into the brief as 1.5 (rule 0.2); that is not done yet. A roadmap page for K to share with the board was published as a private artifact (its link is in the lead's notes); it shows step 9 merged and the trim in progress, and needs the trim marked merged next.

**The WS08 creation-roles plan.** It is in `docs/redesign/ws08-manifest.json` and `docs/redesign/ws08-plan-notes.md` on `redesign/docs-phase2` (`a513c8d`, `f7a62e8`), written in the WS02 format. Where the build's own notes later differ, they win.
- **Ten steps in three checkpoints,** on `redesign/ws08-creation-roles`, cut from `main` (now `0018039`, so the trim is already in):
  - J, steps 1 to 3: the record and the creation rules (`domain/events/creation.ts` and its server side), migration `0059` (nullable columns only: `support_tickets.kind` and `about_id`, `tournaments.review_notified_at`), and the wider create with the first director row.
  - K, steps 4 to 6: the entry-fee rule on save (a save that raises what an entrant pays is refused for anyone not on D24's list), the president naming directors and a creator deleting an unpublished draft, and the email to every LCA admin when a standing director first publishes.
  - L, steps 7 to 10: the two `/api/me` endpoints (tournament creation and the payout request), "New tournament" on today's pages and the "Standing director" label, the manage page for the creator, and the fee notices (G1 and G2) with the close-out.
- **Planned days** run about two steps a day from Wed, Nov 4, 2026 (checkpoint J merging about Fri, Nov 6, K about Sat, Nov 7, L about Mon, Nov 9); the reorder's central date for the whole part is Thu, Nov 12, 2026, with Mon, Nov 16, 2026 as the slower bound.
- **Switches.** The existing `standingDirectors` switch plus a server constant `CREATION_ROLES_ON`; every change is dead until both are on. Member-created events are Phase 4. `publish_at`, the scheduled publish and the setup checklist belong to the console part, not this one.
- **The lead's corrections** for the builders (seven items from the plan's third review, which left one blocking finding and four should-fix items) are kept outside the repository, in `ws08-lead-corrections.txt` in the lead's scratchpad. They win over the manifest where they differ.
- **Before step 1:** the trim has merged, so no merge of it into the branch is needed; the builders stage by path and commit as the owner.

**In flight, outside the workstreams (Tuesday, November 3, 2026).**
- **The membership script,** on `ops/memberships-2026-11` (not yet pushed): `scripts/apply-memberships.mjs` (about 1,660 lines), 116 unit cases and 32 integration cases with invented people, and `member_created` added to the audit action type. It does a dry run by default and writes only with `--apply`. It needs Node 22.18 or later (it imports `domain/households/family.ts`). Its review (two rounds, then a third fix round) left nothing blocking; the third round's two small items (the duplicate check not counting a family's existing children; the missing-audit file written only at the run's end) went to a single builder. Its gate runs in its own worktree (the four `heritage-edges` cases fail there because the modules are a link, expected), then it is committed as the owner, pushed and opened as a draft. The dry run and the apply need the two Supabase values, which K has added to the environment; a new session reads them, so the dry run goes through a helper session once the script is pushed, or K runs the script on their own PC. Decisions already taken: Anindya Biswas confirmed; Hattier renamed Zackary, expiry Sun, Jun 20, 2027 kept; the Morgan Allison row becomes AJ's account with Morgan and Alexander as child profiles, and AJ's row keeps its later expiry (never shorten a paid membership); Josh Richert gets a new account under the purchase email; every individual is an adult. The plan file holds the people's details and stays outside the repository.
- **The renewal change,** on `fix/renew-default` (not yet pushed), built and reviewed ("ready"): on renewal, Adult is preselected, the price of each tier sits beside it, and Scholastic, Senior and Family are visible choices to switch to, in a Renew panel for a signed-in member (the cards stay for visitors). It changes `src/pages/MembershipPage.tsx` and adds `test/unit/membership-renew.test.tsx` (45 cases); a one-off browser check passed signed out and signed in. It ships live on K's yes, with no switch. The record is untouched, as for earlier live fixes. Its gate runs in the main checkout after `main` is merged into it as the owner. The open exception is under "Waiting on K".

**The lean process K approved on Tuesday, November 3, 2026,** after asking whether the progress was worth the usage limits (the build and review half is: real defects were found in each slice; the late rounds of brief checking mostly polished text). From slice 10 on, and already in use for the trim, the WS08 plan and the two ops builds:
- No composed brief for a slice under about eight files: the builder works from the manifest entry and the lead's corrections. Where a brief is composed, its checks stop at three rounds and verify what would mislead a builder, not every count.
- No fourth re-measuring scout when the previous slice touched nothing the next one reads.
- At most two review rounds in a build (`build-slice-lean.js` in the lead's scratchpad, with `maxReviewRounds`).
- Two refuters, not three, for each blocking finding in a merge-safety review.
- One browser run per slice, three at a checkpoint's close.
- Record counts measured once, at the end.
