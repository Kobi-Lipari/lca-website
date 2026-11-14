# Handoff: the clubs stream (WS09, clubs as living listings)

Written on Friday, November 13, 2026, for whoever takes this stream over. The whole project's handoff is `HANDOFF.md`; the rules where the two streams meet are `STREAMS.md`. This file holds only what is the clubs stream's own.

## Where it stands (Friday, November 13, 2026, about 6:45 PM UTC)

- **K answered the plan: "All recommendations are good"** (decision 1 in `ws09-k-decisions.md`): option (a) of all nine choices. The manifest's `k_answers` holds them, with two amendments (choice 9 moves the preview bucket's binding from step 2 to step 36).
- **Steps 1 to 5 of checkpoint S are built, gated, committed (as K) and pushed on `redesign/ws09-clubs`**, which was cut from `main` at `af4a21c` on Friday, November 13, 2026. Each passed its gate and two review rounds at most:
  - Step 1, `0fec98b`: the record and a named public answer. One pin outside the step's list moved (`test/unit/contracts-status.test.ts` now holds the K1d row's 110 as history).
  - Step 2, `42e232a`: the switches `clubKeepers` and `regionEvents`, three constants, the test that holds the switch order, and the generator's number option.
  - Step 3, `391796d`: the regions fill, migration 0065. Review added a 403 on POST officers for a region-alone holder.
  - Step 4, `535b6a9`: the club tables, migration 0066 (40 tables), and the slug rule. Review fixed a club delete that lost rows when the club's own delete failed.
  - Step 5, `c37ba11`: the seed on today's clubs, migration 0067. A reviewer checked the last fix alone and said ready.
- **Checkpoint S is under way.** `main` (`f914d8f`, two news fixes) is being brought in, merged without committing and clean; the gate is running on it, and the merge commit is made by hand once it is green. Then come the draft pull request (no footer), the merge-safety review, its fix round, the check sheet of the 25 clubs for K, and the pictures for K (the admin club page's words for a roster kept back).
- **Owed before checkpoint S merges:** (1) the production read, on K's go (asked, awaiting); (2) K's mapping of the Baton Rouge seat; (3) K shown the admin club page's words ("No members assigned") for a roster kept back from a region holder; (4) the preview rehearsal said to K first (asked, awaiting) and to the mail stream, after the review's fixes; (5) the Apply database migrations run seen green; (6) the mail stream's checkpoint P merged, or Tuesday, December 1, 2026 reached; (7) K's own word for the merge.
- **Numbers:** this stream holds migrations 0065 to 0071; 0065, 0066 and 0067 are made. The next clubs file is 0068, made with `--number`. The drizzle snapshot (0010 and 0011) and journal entries now on the branch collide with the mail stream's; whichever merges second regenerates them.
- **The plan** is `ws09-plan.md`, its 38 steps `ws09-manifest.json`, K's copy `ws09-summary.md`. It was made from five read-only reports, two outlines from different angles, one joined plan, two reviews that tried to break it and one revision (plan section 14 lists what the reviews changed).
- **No production read, no preview write and no merge has been made by this stream.** The one production read (which clubs hold a region, which seats cover one) is wanted before checkpoint S merges and is asked of K then.

## The plan in short

- 38 steps in eight checkpoints, S to Z. Staff half: S (the ground, no page), T (the one editor), U (My region and the monthly check), V (representatives' club events with approval). Public half: W (the club page), X (the contact relay and the forms), Y (the directory), Z (photos, players not tied to clubs, the browser matrix).
- Switches: the brief's `newClubs`, and two more asked of K, `clubKeepers` and `regionEvents`. A test holds the order they go on in: K's `clubEmailHidden` first, then `clubKeepers`, then `regionEvents`, then `newClubs` with `newLook`.
- Migrations 0065 to 0071. The repository allows the gap after 0060 (files apply by name). The generator's number option is built (step 2).
- Built early under other workstreams' names, because they do not exist yet: signed links (`functions/utils/tokens.ts`), the record of timed runs (`automation_runs`, `recordRun`), the rate limit (`functions/utils/rateLimit.ts`, `rate_limits`).
- Left out until their bases exist: Follow and follower emails, Add to calendar, road miles and address lookup.

## Where this stream meets the mail stream

Each of these is in plan section 7. The mail stream's session answered on Friday, November 13, 2026 (a peer's word, not K's):

- Points 1 and 2 agreed, with one rule on the order: if its checkpoint P has not merged by Tuesday, December 1, 2026, checkpoint S goes first on K's word and the mail stream catches up. It makes 0061 on `redesign/ws16-page` and keeps 0062 to 0064 for its checkpoints Q and R.
- Point 3 agreed in principle, each line confirmed when reached. For the worker: the two calls go after the mail phases; measure the worker's dry-run upload before and after steps 15 and 29 and give both figures (76.61 KiB, gzip 20.53 KiB on Thursday, November 12, 2026, against a ceiling of 96 KiB, gzip 28 KiB); its checkpoint O rewrites parts of the worker about Friday, December 18, 2026, so name the step and the day to it before adding each line. For `test/a11y/builds.spec.ts`: add the line after bringing `main` in, and say so to it first.
- Point 4 is K's to decide, not the streams': it is choice 9 in plan section 9, with a copy of today's pictures into the preview bucket as the mail stream asked.
- Points 5 and 7 are in its follow-ups. Production holds no club's mail list today.
- A small fix to the News posts' cleaner (`fix/news-posts-cleaner`) merges on K's word ahead of both streams' checkpoints; it adds a short section at the end of `REDESIGN_STATUS.md` and touches no clubs file.

The points as put:

1. **Numbers.** WS09 takes 0065 to 0071; the mail stream holds 0061 to 0064. Once checkpoint S is on `main`, the generator does not know which numbers are held, so step 2 added a number option and the README says who holds which numbers. The next clubs file is 0068, made with `--number` (an earlier line here said 0072, which was wrong).
2. **Order of the first merges.** Checkpoint S merges after the mail stream's checkpoint P, so the clubs stream is the second to merge and does the regenerating of the schema snapshot and the re-pinning of the tests that pin the migrations folder.
3. **Three single lines in held files.** Two in `workers/daily-emails/` (the monthly check's call, step 15; the 14-day clock's call, step 29) and one in `test/a11y/builds.spec.ts` (the browser build turns `newClubs` on, step 24). Each has a way to go on if the answer is late: an LCA admin's button for the two timed calls, and pictures from a local run for the browser build.
4. **The preview's picture bucket.** Once `CLUB_LOGOS` is bound to `lca-club-logos-preview` under `[env.preview]`, every preview, the newsletter's included, shows no logo, post picture or officer photo until one is uploaded there.
5. **Deferred to the mail stream:** the "by club" audience in Group email and the members' club column in Admin (the parts of P2.18 that sit in held files), after its checkpoint O.
6. **Not built here:** a club's own sending, a representative's sending and a club's tournament send-out. Plan section 8 says where each goes on the club's page in My region and on Your club's page.
7. **Found on the way:** deleting a club that owns a mail list fails today, since `mail_lists.club_id` has no delete action; whoever makes clubs' lists mends that delete.

Told to the mail stream on Friday, November 13, 2026, at about 6:50 PM UTC, before the pull request (it was also told that the member delete, a file both streams touch, gained the clubs stream's own lines only, that migration 0065 fills clubs.region at merge, and that a go was asked of K to rehearse 0065 to 0067 on the preview database after the review):

- The pin that moved outside step 1's list (`test/unit/contracts-status.test.ts`), and the migration snapshot and journal collision above, with who regenerates.
- The numbers: this stream's 0065 to 0071, and the generator's number option.
- One flaky failure in its `test/unit/email-choice-pages.test.tsx` ("Saved ... takes the focus") during step 3's first full run; the file passed three of three alone and the full rerun was green.
- Deleting a club that owns a mail list still fails (step 4 left it as a follow-up for that stream).

## K's words since the plan, and how the lead works now

K's words, all on Friday, November 13, 2026:

- About 2:30 AM UTC: "All recommendations are good" (decision 1).
- About 5:10 PM UTC, K turned the wider-run setting off and asked to hear later whether the session's extra effort helps or hurts. Owed to K: a plain comparison, extra against medium, at checkpoint S (muddied by step 5's restart) and properly after two or three of checkpoint T's steps. The numbers kept per step: run time, helpers' tokens, tool uses, first-review findings, review at which it was ready, gate run that was green.
- About 5:40 PM UTC: K turned the wider-run setting on again and said the lead may override what it needs. Read as: the lead chooses the helper settings per stage and what to hand off, aiming at the usage limit. Every standing and security rule stands; merges, production reads, preview migrations and switches still need K's own word.
- About 5:55 PM UTC: "1 b is fine": the session's effort stays at extra. Settled; do not raise it again unless the usage limit forces it.

What the lead found: the helper types' own definitions in the repository's helper folder set which helper and how much effort they use (the builder and reviewer on the heavier helper at high effort, the tester and others on the lighter helper), so the session's effort reaches only the lead. Most of the usage is the heavier helper's, and what a helper reads in costs as much as what it re-reads.

How the lead works now:

- Tools in the scratchpad's `tools/`: `gate.sh` (the full gate in a folder), `close.py` (checks the gate log against the tree, the record and the message, then commits as K by path and pushes), `mklaunch.py` (makes a step's launch files from its note and the manifest), `build-slice-lean.js` and its second version `build-slice-v2.js` (per-stage settings, reading rules, a short digest in place of the full reports, which stay in the run's journal). The last-fix check is one reviewer on the last fix alone when both fix rounds were used.
- While any long run is going, an hourly check-in that resumes a killed run: after a restart during step 5, a build sat stopped for nearly seven hours. Re-arm it at each check.
- Both review rounds stay full. In steps 3 and 4 the full second review found the real problems the first missed (the roster inferred through POST officers; the club delete losing rows). The mail stream's session advised the same, and K there chose the best output over saving.
- Trials one at a time, each said to K first and measured: first, a lighter helper as builder on a plain step with the heavier helper reviewing, dropped at the first sign it lowers what the reviews find; then the record written by the recorder before review. Measured usage is reported to K at each checkpoint.

## K's standing rules, security and method

As in `HANDOFF.md` ("Standing rules", "Security", "How a slice is built") and `STREAMS.md`. In short, for this stream: no line anywhere about how a text was made, commits as K; everything behind a switch that is off; a merge into `main` only on K's own word, one at a time with the mail stream's, never on its fence days; the production database read-only and no read without need; the one preview write is the guarded migrate script, at this stream's own checkpoint, after saying so to K; every choice put to K numbered, with options, the recommended one first with its reason, and where to look.

## The stream's working files

- The lead's notes: `ws09-lead-notes.md` in the session's scratch folder (a log; read from the last entry backwards).
- The reports the plan was made from, the two outlines and the manifest's generator: the scratch folder's `ws09/` (the generator is `ws09/gen/build_manifest.py`; the manifest here is its output). They are not in the repository; if the scratch folder is lost, the plan and the manifest here are enough to build from, since each step's own scout checks its facts again.
- The first lead's kit (the lean build run, the record check, the gate and commit scripts, launch notes, review runs) is a private page of K's, "LCA Lead Kit". Its scripts name the mail work and the first lead's folder, and are adapted before use.

## Next

1. Finish checkpoint S: the gate on the merge with `main`, the merge commit, the draft pull request (no footer), the merge-safety review, a fix round, the check sheet of the 25 clubs and the pictures for K, then the items owed above, and K's word before the merge, after the mail stream's checkpoint P or on Tuesday, December 1, 2026, whichever comes first.
2. Then checkpoint T, from step 6, with the second build tool and the trials above.
