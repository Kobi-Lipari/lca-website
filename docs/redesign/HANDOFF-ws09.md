# Handoff: the clubs stream (WS09, clubs as living listings)

Written on Friday, November 13, 2026, for whoever takes this stream over. The whole project's handoff is `HANDOFF.md`; the rules where the two streams meet are `STREAMS.md`. This file holds only what is the clubs stream's own.

## Where it stands (Friday, November 13, 2026, about 12:15 AM UTC)

- **The plan is written and waits for K's answers. Nothing is built.** The plan is `ws09-plan.md`, its 38 steps `ws09-manifest.json`, K's copy `ws09-summary.md`. K has eight numbered choices (plan section 9); choices 1 to 4 are wanted by Monday, November 16, 2026, for a start on Tuesday, November 17, 2026.
- **How the plan was made.** Five read-only reports (the clubs code on `main` at `af4a21c`; the brief's WS09 section with every "verify:" item; K's decisions; the decided boards; what WS09 leans on in other workstreams), two outlines from different angles (staff first; risk first), one joined plan, two reviews that tried to break it (does it throw anything off; is it what the brief and K's decisions ask), one revision. The reviews found seven blocking problems between them, all mended in the revision; plan section 14 lists what changed.
- **The build branch does not exist yet.** `redesign/ws09-clubs` is cut from `main` only after K answers.
- **No production read, no preview write and no merge has been made by this stream.**

## The plan in short

- 38 steps in eight checkpoints, S to Z. Staff half: S (the ground, no page), T (the one editor), U (My region and the monthly check), V (representatives' club events with approval). Public half: W (the club page), X (the contact relay and the forms), Y (the directory), Z (photos, players not tied to clubs, the browser matrix).
- Switches: the brief's `newClubs`, and two more asked of K, `clubKeepers` and `regionEvents`. A test holds the order they go on in: K's `clubEmailHidden` first, then `clubKeepers`, then `regionEvents`, then `newClubs` with `newLook`.
- Migrations 0065 to 0071. The repository allows the gap after 0060 (files apply by name). The generator gains a number option in step 2.
- Built early under other workstreams' names, because they do not exist yet: signed links (`functions/utils/tokens.ts`), the record of timed runs (`automation_runs`, `recordRun`), the rate limit (`functions/utils/rateLimit.ts`, `rate_limits`).
- Left out until their bases exist: Follow and follower emails, Add to calendar, road miles and address lookup.

## Where this stream meets the mail stream

Each of these is in plan section 7. None is agreed yet; they are said to the mail stream's session and to K with the plan.

1. **Numbers.** WS09 takes 0065 to 0071; the mail stream holds 0061 to 0064. Once checkpoint S is on `main`, the generator would hand anyone 0072 next, so step 2 adds a number option and the README says who holds which numbers.
2. **Order of the first merges.** Checkpoint S merges after the mail stream's checkpoint P, so the clubs stream is the second to merge and does the regenerating of the schema snapshot and the re-pinning of the tests that pin the migrations folder.
3. **Three single lines in held files.** Two in `workers/daily-emails/` (the monthly check's call, step 15; the 14-day clock's call, step 29) and one in `test/a11y/builds.spec.ts` (the browser build turns `newClubs` on, step 24). Each has a way to go on if the answer is late: an LCA admin's button for the two timed calls, and pictures from a local run for the browser build.
4. **The preview's picture bucket.** Once `CLUB_LOGOS` is bound to `lca-club-logos-preview` under `[env.preview]`, every preview, the newsletter's included, shows no logo, post picture or officer photo until one is uploaded there.
5. **Deferred to the mail stream:** the "by club" audience in Group email and the members' club column in Admin (the parts of P2.18 that sit in held files), after its checkpoint O.
6. **Not built here:** a club's own sending, a representative's sending and a club's tournament send-out. Plan section 8 says where each goes on the club's page in My region and on Your club's page.
7. **Found on the way:** deleting a club that owns a mail list fails today, since `mail_lists.club_id` has no delete action; whoever makes clubs' lists mends that delete.

## K's standing rules, security and method

As in `HANDOFF.md` ("Standing rules", "Security", "How a slice is built") and `STREAMS.md`. In short, for this stream: no line anywhere about how a text was made, commits as K; everything behind a switch that is off; a merge into `main` only on K's own word, one at a time with the mail stream's, never on its fence days; the production database read-only and no read without need; the one preview write is the guarded migrate script, at this stream's own checkpoint, after saying so to K; every choice put to K numbered, with options, the recommended one first with its reason, and where to look.

## The stream's working files

- The lead's notes: `ws09-lead-notes.md` in the session's scratch folder (a log; read from the last entry backwards).
- The reports the plan was made from, the two outlines and the manifest's generator: the scratch folder's `ws09/` (the generator is `ws09/gen/build_manifest.py`; the manifest here is its output). They are not in the repository; if the scratch folder is lost, the plan and the manifest here are enough to build from, since each step's own scout checks its facts again.
- The first lead's kit (the lean build run, the record check, the gate and commit scripts, launch notes, review runs) is a private page of K's, "LCA Lead Kit". Its scripts name the mail work and the first lead's folder, and are adapted before use.

## Next

1. K answers the eight choices; the answers are written into the manifest's `k_answers` and a decisions file for this stream, `ws09-k-decisions.md`, in the form of `ws16-k-decisions.md`.
2. The mail stream answers the meeting points above.
3. Cut `redesign/ws09-clubs` from `main` at that moment and build step 1.
