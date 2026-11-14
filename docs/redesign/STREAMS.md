# Two streams of work, side by side

Decided by K on Thursday, November 12, 2026 (decision 58 in `ws16-k-decisions.md`, then K's answer "lets do A"): one more stream of work runs beside the mail work, each in its own session, on its own machine, with its own copy of the code and its own branch. A third stream is added only after each of the two has merged a checkpoint cleanly. This file is the one place both streams read for who holds what. Either stream may add to its own part; a change to the shared rules is put to K first.

## The streams

- **The mail stream** (the first session, the redesign's lead since the start). WS16: K's switch-on day and the cutover; checkpoint N (steps 9 to 11) and checkpoint O (step 12); the newsletter's own page, checkpoints P and Q, on `redesign/ws16-page`, and later R. Its documents: `HANDOFF.md`, every `ws16-*` file, the roadmap page, K's checklist, the address map and the design canvas.
- **The clubs stream** (the second session, "LCA website: WS09 clubs (second stream)", `session_017anKV5HapmWPwfjiGCLc7c`, opened on Thursday, November 12, 2026 at 10:41 PM UTC; the first session is `session_017M4TWw4V9pP7JmpbcTUmSi`). WS09, clubs as living listings: its plan first, then its build on `redesign/ws09-clubs`, cut from `main` when the build starts. Its documents: `HANDOFF-ws09.md` and every `ws09-*` file.

## What cannot be done side by side

- **K's looks and words.** Every checkpoint is a draft pull request with pictures for K, and merges on K's own word. Each stream asks K in its own session and keeps its asks short.
- **Merges into `main`.** One at a time. Before a stream opens a checkpoint's pull request it brings `main` into its branch and runs its full gate again. No merge on K's switch-on day, on the cutover day, on the first newsletter's day, or while a newsletter is sending (the mail plan's fence F1); the mail stream's `HANDOFF.md` says where those days stand.
- **The preview's database.** There is one. A stream runs the guarded `npm run db:migrate:preview` only at its own checkpoint and says so to K first.

## Files both streams change, and the rule for each

- **`REDESIGN_STATUS.md`.** Each workstream writes only inside its own section. A figure that counts the whole repository (the number of switches, of contracted methods, of migrations) is written as it stands on the stream's own branch; the stream that merges second brings its figures up after it has brought `main` in.
- **`src/lib/features.ts` and the tests that count its switches.** Each stream adds its own switches at the end of its own group. The second to merge moves the counts.
- **Migration numbers.** The mail stream holds 0061 to 0064. The clubs stream starts at 0065, if the repository's own rules allow a gap in the numbers; its plan checks that first and says what it found.
- **`domain/contracts/registry.ts`, `test/unit/contracts-pending.ts`, `test/unit/fixtures/api-added-since-split.json`, `src/App.tsx`, `src/areas/admin/api.ts`.** Each stream adds its own lines; the second to merge resolves the meeting of the two and runs its gate again.
- **Files one stream holds for now.** The mail stream holds `src/pages/AdminEmailPage.tsx`, `src/pages/AdminPage.tsx`, `src/components/layout/Navbar.tsx`, everything under `functions/utils/mail/` and `domain/mail/`, `functions/utils/admin/campaigns.ts`, `workers/daily-emails/`, `test/a11y/builds.spec.ts` and `test/a11y/signedIn.ts`. If the clubs stream needs a change in one of them, it says which and why in `HANDOFF-ws09.md` and to K, and the two agree on who makes it and when.
- **The docs branch, `redesign/docs-phase2`.** Each stream edits only its own files (above) and brings the branch up to date before each push.

## Where the two meet in the work itself

- A club's own sending, a representative's sending and a club's tournament send-out are the mail work's later part and are built with WS09's club pages: the clubs stream plans where they go and does not build them without the mail stream's word on the engine's side.
- WS08's admin home, which comes after both, moves Group email and the clubs work's queues into one place; neither stream rebuilds Admin's frame before it.
