# Website redesign: status

Last updated: 2026-10-08 (WS01, step 4: one definition for shared rules)

The brief is `docs/redesign/REDESIGN_SPEC.md`. This file records, for each workstream, where it stands, what was decided, where the work differs from the brief, what is left to do, and every `verify:` item that has been checked. It is updated in every redesign PR.

## Ordering rules

1. **The branch is pushed only after the preview database slice is committed.** Every pushed branch gets a Cloudflare Pages preview. Before `[env.preview]` existed in `wrangler.toml`, that preview was bound to the production database `lca-db`, so anyone clicking around it would have written real registrations and accounts. `redesign/ws01-design-system` stays local until the commit that adds the preview database. Before that first push, K also checks the Preview environment's secrets in the Pages dashboard and removes any live Stripe or Resend key: previews existed before this slice and may already hold the live ones.
2. **K migrates the preview database from the branch before reviewing each checkpoint's preview.** He runs `npm run db:migrate:preview` from the branch, with his own Cloudflare credentials, before he looks at the preview, not after the merge. Merging to `main` migrates production only (`.github/workflows/migrate-db.yml`); nothing migrates `lca-db-preview` automatically. Once the branch adds tables the code reads (the sections and schedules tables), a preview bound to an unmigrated database shows errors.

## WS01: Design system, themes and accessibility foundation

**Status:** in progress. Built in 32 small steps on one branch and merged in four checkpoints (A: steps 1 to 8, B: 9 to 15, C: 16 to 19, D: 20 to 32).
**Branch:** `redesign/ws01-design-system` (not pushed yet; see ordering rule 1).
**PR:** none yet.

### What each acceptance criterion and decision is proved by

AC1 to AC14 are the brief's WS01 acceptance criteria. K1a to K6 are the parts of K's October 8 structural decisions. Each item is proved in one step. "Planned" means that step has not been built yet; the entry is replaced with the passing test, or the recorded measurement, when it lands. Step 32 checks that every row ends with a passing test or a recorded result.

| Item | What it covers | Step | Proved by |
|---|---|---|---|
| AC1 | axe finds no serious or critical issue on the listed pages in every look | 32 | Planned: axe on all nine routes in light, dark, live and heritage, plus the scholastic fixture page, with zero serious or critical issues (`npm run test:a11y`). |
| AC2 | No light-gold text on a light ground | 25 | Planned: `goldText.test.ts` fails on light-gold or raw `#c8a94a` text on a light ground and passes on the codebase. |
| AC3 | Focus ring reaches 3:1 in every look | 21 | Planned: `contrast.test.ts` (WCAG formula on the token values in `index.css`) and `tokens.spec.ts` (the measured outline on a focused button in each look). |
| AC4 | Nothing auto-advances; reduced motion stops animation | 29 | Planned: the home hero is unchanged after 60 seconds of advanced timers, no rotating timer exists outside the allowlist, and with reduced motion the page has no running animations. |
| AC5 | Every status shows its label in words | 26 | Planned: every `StatusBadge` status renders its label in words, `StatusDot` shows words under `newLook`, and every `[data-status]` element on the fixture page has text. |
| AC6 | Standings and crosstables show ½ in tabular figures | 27 | Planned: render tests with half-point scores show 3½ and ½, never 3.5 or 0.5, in Geist Mono with tabular figures. |
| AC7 | Home hero image size and mobile performance | 29 | Planned: at 390 px wide and 3x density the largest image is the hero picture at 200 KB or less (gated). The Lighthouse mobile score of 90 or more is a lab measurement recorded here, plus K's run on the preview. |
| AC8 | Switching look on a container causes no layout shift | 22 | Planned: switching the look on the fixture container changes colours while `Button`, `Input` and `StatusBadge` do not move (layout-shift observer reports 0). |
| AC9 | Branch deploys use `lca-db-preview`, never `lca-db` | 1 | Config half: `test/unit/wrangler-config.test.ts`, with `test/unit/preview-database.test.ts` proving the npm scripts stop when the guard fails. Live half: K checks a branch deploy's bindings after the first push (not done yet). |
| AC10 | Official logo and rook mark in their placements | 28 | Planned: with `newLook` on, the header shows the rook mark at 390, 768 and 1280 px and the footer and `/about` show the official logo, unrecoloured. Placements whose pages do not exist yet are recorded with the workstream that builds them. |
| AC11 | Heritage fonts stay off `/`; no layout shift from the font swap | 31 | Planned: the heritage font file never appears in the `/` network log, and layout shift on `/about` and `/governance/bylaws` stays under 0.1 across the font swap. |
| AC12 | Editors and forms never render in the heritage look | 31 | Planned: the route-to-look test fails if any workspace or admin route gets the heritage look, and the editor and the governance documents form render in the base look. |
| AC13 | Controls look identical inside heritage | 31 | Planned: `Button`, `Input`, `StatusBadge` and the focus ring match pixel for pixel inside heritage and base (screenshots from the same run). |
| AC14 | The live tag's dot does not move | 26 | Planned: the live tag's dot has no animation class, its computed animation is `none`, and it has no running animations. |
| K1a | Shared `domain/` folder and date, time and score formats | 3 | `test/unit/format.test.ts` (½ for halves and never a decimal point, a weekday on every date including both 2026 clock changes, 12-hour times with noon and midnight, the plain companion for time controls) and `test/unit/domain-boundaries.test.ts` (no file in `domain/` imports the site, the server, React or Cloudflare; ESLint reports each restricted import and `window`, `document`, `localStorage` and `navigator` in the lint fixture; the paths, includes and aliases are in place). `npm run typecheck:functions` now checks `domain/` and `workers/daily-emails/src` without the DOM library. A Pages Functions build and a worker build that import `domain/format` by relative path both bundle (recorded under step 3). |
| K1b | Shared pricing, eligibility and minor name rules | 4 | `test/unit/domain-shims.test.ts`: the nine old copies (section rules, Central time, pricing and regions in both `functions/utils` and `src/lib`, plus `src/lib/family.ts`) are each one `export *` line that hands back the very same objects as `domain/`, and `functions/utils/family.ts` re-exports the family size. A scan of `domain`, `functions`, `src`, `workers`, `scripts` and `scanner` finds `rulesFromName`, `eligibilityProblem`, `entryPrice`, `sectionBaseFee`, `lcaTimeToMs`, `hasPassed`, `REGIONS`, `isRegion`, `FAMILY_MEMBERSHIP_CHILDREN`, `MEMBERSHIP_TIER_PRICES`, `publicName` and `firstNameLastInitial` each defined in exactly one file, in `domain/`, and no `TIER_PRICES` anywhere; checkout and the membership page read the tier prices from `domain/membership/tiers.ts`. `test/unit/public-name.test.ts` proves the minor name rule (shortened only on the entrants list, for an active guardian link or an entry marked under 18; full names in results). `mirrors.test.ts` is removed. |
| K1c | Event-mode phases | 5 | Planned: unit tests of `domain/events/eventMode.ts` for every Phase 0 phase, midnight, both 2026 clock changes and multi-day events. |
| K1d | Request and response contracts | 7 | **Partial: ratchet.** Planned: the contract layer and the per-endpoint contract test exist; `contract-coverage` fails for a new handler with no contract and for a contracted route still listed as pending, and the pending list can only shrink. Endpoints get contracts as later steps and workstreams touch them, not all at once (see Decisions). |
| K2a | Sections and schedules tables, with the backfill | 8 | Planned: a migration test on `node:sqlite` with legacy fixtures shows the sections and schedules tables created and backfilled from the JSON columns with nothing dropped, and a second run adds nothing. |
| K2b | One writer for sections | 9 | Planned: the writer audit passes; after every write the table rows match the JSON column; renames, swaps and rotations keep each entry on its section. |
| K2c | Player registration reads the new tables | 10 | Planned: no file in the player registration path parses `tournaments.sections`; every inserted or moved registration carries its `section_id`; prices are unchanged for the same inputs. |
| K2d | Admin entry reads the new tables | 11 | Planned: walk-ins and the waitlist no longer parse `tournaments.sections`; a walk-in row carries its `section_id`; another club's rep and a plain member get 403. |
| K2e | Server display reads the new tables | 12 | Planned: `sections-reader-audit` passes, no server code reads the JSON column, and no handler returns a raw tournaments row. |
| K2f | Client display reads the new tables | 13 | Planned: every page uses the contract-derived section type; `npm run check:bundle` finds no zod in the built site. |
| K2g | Schedules | 14 | Planned: schedules are read and written only through the table and its repository (audit), and an event never has two live primary schedules. |
| K3a | Server helpers grouped by area | 16 | Planned: server helpers sit in `functions/utils/<area>/`; the move shows only renames and import-line edits, and the unit test count is unchanged. |
| K3b | Client library grouped by area | 17 | Planned: area-specific client library code sits under `src/areas/<area>/`; renames and import-line edits only; the build has the same route chunks. |
| K3c | API client split by area | 18 | Planned: client API calls live per area behind an unchanged `@/lib/api`; `api-exports.test.ts` matches the exported names from before the split, and route-audit finds the same fetch paths. |
| K3d | Components grouped by area, with boundary rules | 19 | Planned: components sit in their area folders, and `area-boundaries.test.ts` shows lint reporting an area file that imports a page. |
| K4 | Drizzle for schema and queries | 6 | Planned: the Drizzle schema matches the migrations (`schema-drift.test.ts`, both directions), `drizzle-kit generate` reports no changes right after the pull, and `split-sql.test.ts` splits all existing migrations exactly as before. |
| K5 | Browser tests | 20 | Planned: `npm run test:a11y` builds, serves seeded local data and passes the smoke spec; the family registration and round publishing end-to-end tests are written as pending specs, run only by hand against a preview. |
| K6 | No member pricing; the LCA membership requirement | 15 | Planned: a member and a non-member pay the same in every tier; `requires_lca_membership` round-trips through create, edit and read; another club's rep and an assigned director get 403 when changing it; no page mentions a member price. |

### Step 1: preview database

- `wrangler.toml` gains `[env.preview]`: `DB` bound to `lca-db-preview` (`28e13174-3a06-47a7-ab0f-b4ac7f24af6f`, region ENAM, created by K on October 8), all ten `[vars]` keys repeated with production's values, and the `CLUB_LOGOS` bucket repeated. The production binding is unchanged.
- `scripts/db/preview-guard.ts` reads `wrangler.toml` (with `smol-toml`, pinned at 1.8.0) and stops a preview command with a plain message when the preview id is missing or a placeholder, when it is production's id, when the preview block names `lca-db`, or when the command is aimed at `lca-db` or at a database the preview block does not bind.
- New npm scripts, each running the guard first and stopping if it fails: `db:migrate:preview`, `db:migrate:status:preview`, `db:seed:preview`. The seed script refuses until `scripts/seed/fixtures.sql` exists (step 20).
- `README.md` has a new "Safe previews" section.
- Nothing in a development container or CI targets the preview database. Only K runs the preview scripts.
- Checks: `npm run build`, `npm run typecheck:functions` and `npm run test:all` pass (unit 406, up from 326 with 80 new tests in `test/unit/wrangler-config.test.ts` and `test/unit/preview-database.test.ts`; integration 267). `npm run lint` is at 36 errors and 4 warnings, the same as before the change, none in the files this step touches.

### Step 2: switches and component test setup

- `src/lib/features.ts` gains the 15 Phase 0 switches from brief 0.2 (`newLook`, `themeHeritage`, `themeScholastic`, `newNav`, `siteSearch`, `homeSearch`, `eventStrip`, `eventStripLive`, `liveMarker`, `newHome`, `homeResults`, `homeChampions`, `homeLive`, `homeWeek`, `homeRecap`), every one off, each with a short comment saying what it turns on. `clubTournaments`, `tournamentQuickFilters` and `externalTags` are unchanged. Nothing reads the new switches yet, so nothing visible changes.
- `vitest.config.ts` gains the `@` alias for `src/` (as in `vite.config.ts`), picks up `test/unit/**/*.test.tsx`, and compiles test JSX with `@vitejs/plugin-react`, the same as the site build. Tests still run in node by default; a component test asks for a browser-like DOM with a `// @vitest-environment jsdom` comment at the top of its own file, so the pairing engine, scanner and other node tests are unaffected.
- New development packages, each pinned to an exact version at least two weeks old: `jsdom` 29.1.1 (April 30), `@testing-library/react` 16.3.3 (August 27), and `@testing-library/dom` 10.4.2 (September 13), which `@testing-library/react` needs alongside it. jsdom 30 is not used because it needs Node 22.22.2 or later; this container runs 22.22.0 and CI asks only for Node 22. No runtime dependency changes.
- New tests: `test/unit/features.test.ts` (every Phase 0 switch exists, is a boolean and is off, which is the starting state, so turning one on means taking its name out of the test's list (the comment in `src/lib/features.ts` says so); the three earlier switches still exist as booleans; the object holds at least these 18, so later switches can be added without editing the test; the file runs in node with no DOM), `test/unit/render-smoke.test.tsx` (runs in jsdom, renders today's `StatusBadge` through `@/components/StatusBadge` without importing React, and checks its words and tone classes) and `test/unit/test-setup.test.ts` (the switch names match brief 0.2 and each switch has a comment; the test configuration keeps node as the default and has the `@` alias, the `.tsx` pattern and the React plugin; only `.tsx` files ask for jsdom; the test packages are exact-pinned development packages; and this record names the switches, counts, verify items and decisions in plain words). Later component tests follow the smoke test's pattern, including `afterEach(cleanup)`, because the test globals are off and Testing Library does not clean up on its own without them.
- This step proves no acceptance criterion or decision by itself; it sets up the switches and the component tests that later steps use.
- `test/unit/preview-database.test.ts` checked that only AC9 was filled in the table above, which was true after step 1. It now checks that every row names its step (1 to 32) and what proves it, that K1d says "partial: ratchet", and that AC9 keeps its step 1 entry.
- Checks: `npm run build`, `npm run typecheck:functions` and `npm run test:all` pass (unit 477, up from 406 with 71 new tests: 20 in `features.test.ts`, 3 in `render-smoke.test.tsx` and 48 in `test-setup.test.ts`; integration 267, unchanged). `npm run lint` is at 36 errors and 4 warnings, the same as before the change, none in the files this step touches.

### Step 3: shared `domain/` folder and formats

- New folder `domain/` at the repo root for pure code that the site, the server functions and the workers all use: no database access, no DOM, no Workers types and no React. This step creates `domain/format` only; the other areas (events, registration, households, membership, clubs, live, contracts) are created by the steps that fill them.
- `domain/format` holds `formatScore` (3.5 is "3½", 0.5 is "½", 0 is "0", 10 is "10"), `formatDate` ("Sat, Oct 24", or "Sat, Oct 24, 2026" with the year option), `formatTime` ("7:00 PM", with "12:00 PM" at noon and "12:00 AM" at midnight) and `formatTimeControl` ("G/90+30" becomes "G/90+30 · 90 min each + 30 sec per move"; "G/30;d5" adds "30 min each + 5 sec delay"; "G/60" adds "60 min each"; text it does not recognise comes back unchanged). `describeTimeControl` gives the plain words on their own.
- How values are read: a bare stored date or datetime-local value ("2026-10-24", "2026-10-24T19:00") is Louisiana wall-clock time and is shown as written; a Date, epoch milliseconds or an ISO string with a zone is an instant and is shown in Central time. Columns filled by SQLite's `datetime('now')` (`created_at`, `updated_at`, `sent_at`, `recorded_at` and the like) look like wall-clock text ("2026-10-24 02:30:00") but hold UTC, as the admin audit log, board seats and board inbox already assume by appending `Z`; `formatDate` and `formatTime` read them as UTC when passed `{ stored: 'utc' }` (that example is "Fri, Oct 23" at "9:30 PM"), and the `date.ts` header says those columns must be passed that way. The default stays wall-clock because announcement start and end times are stored as Louisiana time in the same text form. Weekday and month names, and the "7:00 PM" text, are built from fixed tables rather than by `Intl`, so the text is identical in browsers, Node and Workers (newer locale data puts a narrow no-break space before "PM"). A string a helper cannot read is returned as given, so a bad value shows up rather than vanishing.
- `src/lib/format.ts` is one line, `export * from '@domain/format'`, so the brief's path works. Nothing in the site uses the helpers yet, so nothing visible changes and no switch is needed; pages adopt them behind `newLook` in later steps.
- Wiring: `tsconfig.app.json` gains the `@domain/*` path and includes `domain`; `vite.config.ts` and `vitest.config.ts` gain the matching `@domain` alias; `tsconfig.functions.json` now includes `functions`, `domain` and `workers/daily-emails/src`; `workers/daily-emails/tsconfig.json` includes `../../domain`. The server functions and the workers import `domain/` by relative path, as the worker already does with `functions/utils`.
- Two checks keep `domain/` pure. ESLint has a block for `domain/**` that forbids importing `@/`, any path into `src/` or `functions/`, React and `cloudflare:` modules, and forbids `window`, `document`, `localStorage` and `navigator`. The type checks are the second guard: the site's check compiles `domain/` with the DOM library and without the Workers types, and `npm run typecheck:functions` compiles it with the Workers types and without the DOM, so code that leans on either one fails one of them. Each guard was tried with a planted file: `window` fails `typecheck:functions`, `D1Database` fails the site's check, and an import from `src/` fails the boundary test and lint.
- The lint fixture `test/unit/fixtures/lint/domain-violations.ts` breaks every rule on purpose. `eslint.config.js` ignores its folder, so `npm run lint` never counts it; the test lints its text as if it were a file in `domain/`, with the real config.
- Bundling: `npx wrangler pages functions build` succeeds before and after the change. With a temporary handler under `functions/api/` importing `../../domain/format`, the Pages Functions build bundled all five format files, and `wrangler deploy --dry-run` of a temporary daily-emails entry importing `../../../domain/format` did the same. Both temporary files were removed.
- Checks: `npm run build`, `npm run typecheck:functions` and `npm run test:all` pass (unit 578, up from 477 with 101 new tests: 52 in `test/unit/format.test.ts`, 30 in `test/unit/format-edges.test.ts` and 19 in `test/unit/domain-boundaries.test.ts`; integration 274, up from 267 with 7 in `test/integration/domain-format.test.ts`, which runs the helpers inside the Workers runtime). `npm run lint` is at 36 errors and 4 warnings, the same as before the change, none in the files this step touches.

### Step 4: one definition for shared rules

- The rules the site and the server each kept a copy of now live once in `domain/`: section eligibility in `domain/events/sectionRules.ts`, the Central wall-clock conversion in `domain/format/centralTime.ts`, entry pricing in `domain/registration/pricing.ts`, club regions in `domain/clubs/regions.ts` and the family size (3 children) in `domain/households/family.ts`. Each old file (`functions/utils/sectionRules.ts`, `time.ts`, `pricing.ts`, `regions.ts`; `src/lib/sectionRules.ts`, `lcaTime.ts`, `pricing.ts`, `regions.ts`, `family.ts`) is now one `export *` line, by relative path on the server and through `@domain/` in the site, so no importer changed. The daily-emails worker still imports `functions/utils/time`. `functions/utils/family.ts` keeps `listChildren`, `canActFor` and `syncFamilyCoverage`, which use the database, and imports and re-exports the family size. `src/lib/family.ts` stays as a re-export for good.
- Behaviour is unchanged. The rule bodies moved word for word; only `centralTime.ts` changed inside. It takes the zone from `domain/format/date.ts` (`LCA_TIME_ZONE` is now `CENTRAL_TIME_ZONE`, so `'America/Chicago'` is written once in `domain/`) and reads a moment's Central clock through the same `zonedParts` the date formats use, so there is one place that asks `Intl` for Central time. Its results were compared with the old file's for about 80,000 inputs (wall-clock, date-only and zoned values every 97 minutes from 2025 to 2027, across every clock change) and for unreadable values, and every one matched.
- New `domain/membership/tiers.ts` holds the membership prices (adult $15, scholastic $5, family $25, senior $10) that were written into `functions/api/membership/checkout.ts`. Checkout now imports them, and `isMembershipTier` checks the tier, so names inherited from every object (such as `toString`) are refused with the same 400 as any other unknown tier. `src/pages/MembershipPage.tsx` shows the same constants and writes "up to 3 children" from the family size, so the page reads exactly as before.
- New `domain/households/publicName.ts`: `publicName({ fullName, hasActiveGuardianLink, entryMarkedMinor }, context)`. On the entrants list (`'entrants'`) a player with an active guardian link, or whose entry is marked under 18, shows as first name and last initial ("Leo R."); in `'results'` (pairings, standings, results, winners and recaps) the full name is always shown (D3). Being in a household is not the trigger by itself. A single name is left as it is; a hyphenated surname gives its first letter ("Maya F."); a surname that starts with a particle such as "de la", "Le", "Van" or "St." is kept together ("Ana D.", "Remy L."); a middle name or initial and Jr., Sr. or a numeral are skipped ("Leo James Robichaux" is "Leo R."); "Robichaux, Leo" reads as "Leo R.". Nothing calls it yet: the inputs it needs (guardian links and the under-18 mark on an entry) arrive with the household work in WS06.
- `.github/workflows/deploy-worker.yml` also runs on changes to `domain/**`, since the worker now reaches `domain/format/centralTime.ts` through `functions/utils/time.ts`.
- Bundling: `npx wrangler deploy --dry-run --outdir <scratch>/w --config workers/daily-emails/wrangler.toml` bundles (31.96 KiB, with `domain/format/centralTime.ts` and `date.ts` inside), and `npx wrangler pages functions build --outdir <scratch>/fn2` compiles, with the seven `domain/` files the functions reach.
- Nothing visible changes, so no switch is needed.
- Checks: `npm run build`, `npm run typecheck:functions` and `npm run test:all` pass (unit 662, up from 578; integration 311, up from 274). Builder tests: `mirrors.test.ts` and its 5 tests are gone, `test/unit/domain-shims.test.ts` adds 42 and `test/unit/public-name.test.ts` 14, `domain-boundaries.test.ts` checks the 7 new `domain/` files and `format-edges.test.ts` the new format file. Tester tests: `test/unit/central-time-legacy.test.ts` compares `lcaTimeToMs` with a copy of the old implementation across the 2026 and 2027 clock changes; `test/unit/domain-wiring.test.ts` checks the workflow triggers, the worker's import of the time shim, the removal of `mirrors.test.ts` and this section; `test/unit/public-name-edges.test.ts` covers the name rule's edge shapes; `test/integration/domain-shared-rules.test.ts` runs the time, pricing, section, region and family rules through the old server paths in the Workers runtime; `test/integration/membership-tiers.test.ts` checks that checkout charges each tier's price and refuses inherited names such as `toString` with a 400. The pricing, section rules, Central time and renewal expiry tests are unchanged and pass. `npm run lint` is at 36 errors and 4 warnings, the same as before the change, none in the files this step touches.

### Decisions

- The real preview id is in `wrangler.toml`, not a placeholder (K confirmed it on October 8). The guard still refuses a placeholder, production's id and production's name.
- Previews keep `SITE_URL` (and `VITE_SITE_URL`) on the production origin. Previews are not meant to send mail.
- Preview secrets are set by K in the Pages dashboard: Stripe test keys only, and no Resend key until K wants test mail. Without a Resend key every send fails, is logged, and the request carries on.
- Previews keep the production `lca-club-logos` bucket for now.
- The binding name stays `DB` in both places, so the code reads `env.DB` everywhere.
- **Contracts are a ratchet** (decided October 8, before step 7). Every endpoint a WS01 step touches gets a zod contract and a contract test; a coverage test blocks any new endpoint without one; the list of endpoints still waiting for a contract can only shrink. There is no step that converts every endpoint at once, so K1d is marked "partial: ratchet" in the table above. The two page routes that serve HTML (`functions/tournaments/[id].ts` and `functions/clubs/[id].ts`) are left out of the contract list, with that reason.
- **Dark mode** follows the device setting as soon as `newLook` is on, with the Appearance control (System, Light, Dark). There is no separate dark mode switch.
- **Member discount** is retired in step 15. The member-discount input and the "LCA members save" line are removed without a switch, an exception to the brief's rule that visible changes ship behind one, because keeping them would advertise a price that is not charged (see Deviations). Before checkpoint B merges, K runs `SELECT id, name, member_discount FROM tournaments WHERE member_discount > 0 AND status != 'completed'` on production; the result is recorded here. The step does not wait on it.
- **LCA membership requirement.** `requires_lca_membership` defaults to on for LCA-run events (no `club_id`). Club-run events, existing and new, start with it off, because clubs get tournament creation first, free of charge. Only the owning club's rep or an LCA admin may change it; an assigned tournament director cannot. In WS01 the column exists and the setup form shows the switch; turning a non-member away or adding the membership at checkout is WS06's, because today's registration has no way to add a membership inline, and enforcing it now would leave non-members with no way forward.
- **Removing a section that has entries** is refused with a plain message ("3 entries are in this section. Move them to another section first."). Only an empty section can be archived.
- **Checkpoints.** Each checkpoint is a draft PR that K merges; `migrate-db.yml` then applies its migrations to production. K runs `npm run db:migrate:preview` from the branch before reviewing each checkpoint's preview.

### Deviations from the brief

Every deviation planned for WS01 is listed here now, so a checkpoint review sees them all in one place. A line for a step not yet built names that step; when the step lands it confirms or corrects its line.

Recorded in steps 1 to 4:

- **Remote migrations.** The brief (0.2) says K applies remote migrations. In fact `.github/workflows/migrate-db.yml` applies `migrations/**` to `lca-db --remote` on every push to `main` that touches migrations, so merging a checkpoint applies its migrations to production. The preview database is migrated only by K's `db:migrate:preview`, run from the branch before review.
- **Preview id.** The plan was a placeholder for K to paste over; the real id went in directly on K's confirmation.
- **Base branch.** The branch was created from the docs branch that carries the brief and the decided boards, not from `main`. It is rebased onto `main` once that docs PR merges; the content is the same.
- **Mail on previews.** The brief has the Resend key set separately for previews; the decision is no Resend key on previews until K asks for test mail.
- **Brief 0.1, rule 8** ("Preview deployments share the production database") is no longer true once this step merges. The brief's text should be updated with the next brief revision.
- **Seed script.** The brief asks for a seed script with the preview database; it exists but refuses until the sample data is written in step 20.
- **Heritage fonts (brief 0.2).** Heritage loads Libre Caslon Display and Source Serif 4 instead of reusing Instrument Serif. Baloo 2 and Nunito, the Bright Scholastic fonts, move to WS11. WS01 ships the scholastic colour tokens and a fixture page only; `themeScholastic` stays off until WS11.
- **Structural work first.** The brief's WS01 says "Data model: none" and "API: none". K's October 8 structural decisions put steps 3 to 19 (the shared `domain/` folder, Drizzle, contracts, the sections and schedules tables, member pricing, and the folder moves) ahead of the design tokens, so WS01 adds migrations and changes endpoints.
- **Contracts.** K1d is met as a ratchet rather than a contract for all 88 endpoints at once (see Decisions).
- **Event-mode phases** are a pure module at `domain/events/eventMode.ts` built in WS01 (step 5), not `functions/utils/eventMode.ts` in WS02. WS02 still builds the endpoint and the strip on top of it.
- **Shared folder and formats (step 3).** Brief 2.2 puts the format helpers in `src/lib/format.ts`. They live in `domain/format` instead, imported as `@domain/format` in the site and by relative path in the server functions and workers, and `src/lib/format.ts` re-exports them, so the brief's path still works. zod is allowed only in `domain/contracts` (step 7), so nothing the browser imports from `domain/` brings zod into the site bundle.
- **The daily-emails worker is type checked from step 3,** one step earlier than planned: `npm run typecheck:functions` now includes `workers/daily-emails/src`, so a broken import into the worker fails the checks. It had no type errors. Adding `domain/**` to the paths that trigger `deploy-worker.yml` stays with step 4, when the worker first imports from `domain/`.
- **One definition for shared rules (step 4)** landed as planned: section rules, Central time, pricing, regions and the family size moved into `domain/`, with one-line re-exports at the old paths, and `mirrors.test.ts` is replaced by `domain-shims.test.ts`. `deploy-worker.yml` now also runs on `domain/**`.
- **The zone constant goes the other way (step 4).** The step 3 follow-up planned for `date.ts` to import the moved time module. Instead the moved `centralTime.ts` imports `CENTRAL_TIME_ZONE` and `zonedParts` from `date.ts`, which already held the Central logic, and keeps `LCA_TIME_ZONE` as the same value under its old name. `date.ts` is unchanged.
- **The membership page reads the tier prices (step 4).** The plan allowed `src/pages/MembershipPage.tsx` to keep its own prices unless the change was one line. It is an import plus the four `price:` values, and it is the only way the prices have one definition, so the page now uses `MEMBERSHIP_TIER_PRICES`; its family line also takes "3" from the family size. The page renders the same text.
- **Where the minor name rule is written (step 4).** The plan cited `DESIGN_REPLAN_phase1.md` lines 210, 256, 352 and 394. Lines 210, 256 and 352 state the rule; line 394 is the 8.1 data-model list, whose last sentence repeats it for page 4 ("dependent profiles and members who ticked 'I'm under 18'") and drops `public_minor_names`. Line 36 (4.4) states it too. The file header cites lines 36, 210, 256, 352 and 394, and reads "dependent profile" in line 394 as a player with an active guardian link, which is how lines 210, 256 and 352 put it.
- **Minor display names (step 4)** follow `DESIGN_REPLAN_phase1`: a name is shortened when there is an active guardian link or the entry is marked under 18, not whenever the player is a household dependent.
- **`format-edges.test.ts` lists the new format file (step 4).** Its check that `domain/format` holds exactly the step 3 files now includes `centralTime.ts`.

Planned for later steps:

- **Member pricing ships without a switch (step 15).** This is an exception to brief 0.2's rule that every visible change ships behind a switch. The member-discount input on the tournament setup form and the "LCA members save" line are removed outright, because keeping them would advertise a price that is not charged. `tournaments.member_discount` stays in the database but is neither read nor written.
- **Drizzle (step 6).** Drizzle writes into a staging folder, `drizzle/`, and a small script numbers each file into `migrations/`, so wrangler and the test runner are unchanged. `migration-safety.test.ts` learns drizzle-kit's quoted names, `ON UPDATE` clauses and `ADD` without `COLUMN`, and the SQL splitter tracks `BEGIN`, `CASE` and `END` so triggers with `CASE` split correctly.
- **Old queries move to Drizzle only when changed (steps 6 to 19).** A query is converted when a step changes its SQL or the values it binds. A query whose rows are only handled differently afterwards stays as plain D1. When a converted statement shares a batch, the whole batch moves to Drizzle's `db.batch`.
- **Sections and schedules tables (step 8).** `tournament_sections` (with `fee_regular`, optional `fee_early` and `fee_late`, and a cap), `tournament_schedules`, `tournament_schedule_rounds`, and `section_id` and `schedule_id` on registrations replace `DESIGN_REPLAN_phase1` 8.1's schedules JSON column, `tournaments.merge_round` and the cap inside the JSON. Early and late prices are worked out when read, from the tournament's own deadline and fee columns, unless a section sets its own. The `sections` and `schedules` JSON columns are kept, in today's exact shape, as copies of the tables, and nothing is dropped. `tournament_games` keeps section names in WS01; a `section_id` there is left for WS07.
- **The sync trigger stays past checkpoint B (step 8).** Migration 0053 adds a trigger on `tournaments` that copies sections and rounds from the JSON columns into the tables. It stays after checkpoint B instead of being dropped there, because dropping it at a merge would reopen the window during a deploy when old code still writes only the JSON. It never touches caps or ids, agrees with the single writer (which writes the table first and the JSON last), and is removed together with the JSON columns.
- **Folder moves (steps 16 to 19).** Files under `functions/api` do not move, because their paths are the URLs. Server helpers are grouped under `functions/utils/<area>/` and site code under `src/areas/<area>/`, using K's seven areas plus governance; shared platform files stay where they are. The scanner code (`functions/utils/scan`, `src/lib/scanner`) stays put so its own release checks are not set off.
- **API client (step 18).** `src/lib/api.ts` is split by area but keeps re-exporting every name, so no importer changes in WS01. The route audit is widened to every area's `api.ts`.
- **Big pages are not broken up in WS01 (step 19).** WS01 moves components and library code and adds lint rules for the area boundaries (imports across areas warn rather than fail). The large existing pages are broken up when WS05, WS06, WS08 and WS15 rebuild them.
- **Browser tests (step 20).** The accessibility suite runs against a local build on seeded local data, with switches turned on through `VITE_FLAGS` only in that mode; the live site ignores the override, and a test proves it. The colours and fonts of the build with every switch off are recorded once, and later steps must not change them. The family registration and round publishing end-to-end tests are written as pending specs with a preview workflow started by hand; they can run only once WS06 and WS07 exist and the preview database is migrated and seeded.
- **Mono figures and the focus ring (step 21).** Geist Mono applies only under the new look; with `newLook` off, monospace text keeps the device's own font, and the old focus token draws today's ring exactly.
- **Appearance control and the rook mark (steps 21 and 28).** Until WS02 rebuilds the footer, the Appearance control (System, Light, Dark) sits in the current footer behind `newLook`, and the script that applies the choice before the page paints is included only when `newLook` is on. The current header shows the rook mark under `newLook`. The full-colour logo goes on `/about`; the AC10 placements whose pages do not exist yet (the identity band, membership card, certificates, the print kit cover and the Champions page) wait for WS03, WS10 and WS12.
- **ScrollPanel (step 26).** Added from K's October 8 feedback: a scroll panel and a bounded table scroll area, so long screens such as tournament setup stay together. Each page adopts them when its own workstream rebuilds it.
- **White and Black markers (step 27)** in result cells are drawn as small images, because the Geist Mono file has no ○ or ● characters.
- **Homepage hero (step 29).** With `newLook` on, the homepage hero shows one still, responsive picture instead of the slideshow. WS03 replaces the hero entirely.
- **`hero.png` is left out of the image pipeline (step 29)**, because nothing uses it.
- **AC7's Lighthouse score is recorded, not enforced (step 29).** The mobile score of 90 or more is a lab measurement (`npm run perf:home`, plus K's run on the preview) written down here. The 200 KB limit on the largest image is enforced by a test.
- **Small caps (step 30)** use uppercase at 0.85em, because the Source Serif 4 and Libre Caslon Display files have no true small capitals. Source Serif 4 uses its weight-only file (51 KB) rather than the optical-size one (122 KB), to stay under the 110 KB font budget.
- **AC13 compares screenshots from the same run (step 31)**, base against heritage, rather than against stored reference images.
- **AC1's live and heritage runs (step 32)** set the look on each page's `<main>` inside the test, since few routes use those looks in WS01.
- **Role-safety tests (steps 9 to 15).** WS01 adds no new endpoints, so no new-endpoint role-safety tests are needed. The endpoints it changes gain role-safety cases instead: the admin tournament create and edit (sections and `requires_lca_membership`, including the assigned director), walk-ins and the waitlist.

### Verify items resolved

- **wrangler.toml has no preview override.** Confirmed before the change: one `[[d1_databases]]` (`DB` to `lca-db`, `e891b93f-e7fe-48d0-9afc-8570d805ef08`), `[vars]` with ten keys (`SITE_URL`, `SUPABASE_URL`, `FROM_EMAIL`, `CONTACT_EMAIL`, `SUPPORT_EMAIL`, `REPLY_TO_EMAIL`, `VITE_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`), `[[r2_buckets]]` `CLUB_LOGOS` to `lca-club-logos`, and no `[env.*]` block. No workflow deploys the Pages site (only the daily-emails worker has a deploy job), which fits Pages deploying through its Git integration with `wrangler.toml` as the binding source; that part cannot be confirmed from the repo.
- **Pages environment inheritance.** Per Cloudflare's Pages configuration docs, `vars`, `d1_databases` and `r2_buckets` are not inherited by an environment, so `[env.preview]` restates all of them. This is from the docs, not checkable in the repo; `test/unit/wrangler-config.test.ts` holds the restatement in place. wrangler 4.112 accepts the block: against a scratch copy of the config with `--local`, `--env preview` finds `lca-db-preview` and cannot find `lca-db` at all.
- **Does the preview database exist.** K created it on October 8 and confirmed the id. This container is not logged in to Cloudflare and cannot check it.
- **Who applies remote migrations.** `.github/workflows/migrate-db.yml` (push to `main` touching `migrations/**`, or manual run) lists and then applies migrations to `lca-db --remote`. Recorded as a deviation above. Nothing in any workflow targets `lca-db-preview`.
- **Workers.** `workers/daily-emails` binds production `lca-db` and deploys only from `main` (`.github/workflows/deploy-worker.yml`). `workers/clearinghouse-sync` binds production `lca-db` and imports nothing from `functions/`. Neither is affected by the preview block.
- **Phase 0 switch list (step 2).** Brief 0.2 lists 15 switches to add, all off, and the names match the list in step 2 exactly. Before the change `src/lib/features.ts` held `clubTournaments`, `tournamentQuickFilters` and `externalTags`, all off, and only `src/pages/TournamentsPage.tsx` reads them.
- **Unit tests and the `@` alias (step 2).** Confirmed: `vitest.config.ts` had no alias and collected only `functions/utils/swiss/**/*.test.ts`, `src/lib/scanner/**/*.test.ts` and `test/unit/**/*.test.ts`, so no `.tsx` test could run, and the unit tests reached `src/` by relative paths (for example `mirrors.test.ts`). The alias and the `.tsx` pattern are added; existing tests keep their relative imports.
- **JSX in test files (step 2).** Confirmed: the root `tsconfig.json` holds only references, `tsconfig.app.json` includes only `src`, and `tsconfig.functions.json` includes only `functions`, so `test/` is in no tsconfig and nothing there sets the JSX runtime. In practice, with vite 8 and vitest 4.1.10, the smoke test also passes without the React plugin, because the default compiler already uses the automatic runtime. The plugin is added anyway, so tests compile JSX the same way the site build does rather than relying on a default.
- **Shared folder wiring (step 3).** Confirmed before the change: only `@/*` to `src/` existed (`tsconfig.app.json`, `vite.config.ts` and `vitest.config.ts`); `tsconfig.functions.json` included only `functions`, with no `paths` and no DOM library; `workers/daily-emails/src/index.ts` already imports `../../../functions/utils/*` by relative path, and its tsconfig included `src/**/*.ts` (the worker's whole source) plus `../../functions/utils/email.ts`. `eslint.config.js` was one block giving every TypeScript file the browser globals. No gate command checked the worker's types before; with it included, `npm run typecheck:functions` still passes.
- **ESLint and browser globals (step 3).** Confirmed: typescript-eslint's recommended config turns `no-undef` off for TypeScript, and flat-config globals merge rather than replace, so taking the browser globals away from `domain/` would never fail. `no-restricted-globals` is what fails on `window` and `document`, and the boundary test proves it.
- **`src/lib/format.ts` (step 3).** Confirmed it did not exist, and no `formatScore`, `formatTime` or `formatTimeControl` existed anywhere. The only `formatDate` was in `src/lib/clearinghouse.ts` (month, day and year, no weekday), used only by `src/pages/HomePage.tsx`; it is left alone (see Follow-ups).
- **Which helpers were copied (step 4).** Confirmed: `test/unit/mirrors.test.ts` compared, as text past each header, `functions/utils/sectionRules.ts` with `src/lib/sectionRules.ts`, `functions/utils/time.ts` with `src/lib/lcaTime.ts`, and `functions/utils/pricing.ts` with `src/lib/pricing.ts` (with `'./lcaTime'` read as `'./time'`), and compared the values of `REGIONS` and `FAMILY_MEMBERSHIP_CHILDREN`. Each pair differed only in its header comments (and the pricing import line). `src/lib/family.ts` was five lines holding only `FAMILY_MEMBERSHIP_CHILDREN = 3`.
- **Membership prices (step 4).** Confirmed: `functions/api/membership/checkout.ts` held `TIER_PRICES` (adult 15, scholastic 5, family 25, senior 10) as a `Record<string, number>`, and `src/pages/MembershipPage.tsx` wrote the same four numbers into its tier list. No other copy exists in `src`, `functions` or `workers`.
- **Minor display-name trigger (step 4).** Confirmed in `DESIGN_REPLAN_phase1.md` lines 210, 256 and 352: an active guardian link or the entry's `eligibility_json`, and full names in pairings, standings, results and winners. Neither input exists in the code yet: there is no `eligibility_json`, no under-18 mark and no `member_guardians` table (only `members.guardian_id`, from `migrations/0036_family_accounts.sql`), so `publicName` takes the two facts as plain true or false values for WS06 to supply.
- **Worker deploy paths (step 4).** Confirmed: `deploy-worker.yml` ran only on `workers/**` and `functions/utils/**`; `domain/**` is added. `workers/daily-emails/tsconfig.json` already included `../../domain` from step 3.
- **jsdom and Node (step 2).** This container runs Node 22.22.0 and CI asks for Node `'22'`. jsdom 30.0.0 to 30.1.2 require Node 22.22.2 or later; jsdom 29.1.1 accepts 22.13 and later, so 29.1.1 is the pin. Installing the three packages added no new `npm audit` findings.

### Follow-ups

- **AC9 live check.** After the first push, K opens the branch deploy in the Pages dashboard and confirms its D1 binding shows `lca-db-preview`. Record the result here.
- **First preview migration.** K runs `npm run db:migrate:preview` once before reviewing the first preview; on the new, empty database it applies every migration from `0001`.
- **Preview secrets.** Before the first push, K checks the Preview environment's secrets in the Pages dashboard and removes any live Stripe or Resend key left from before this slice, then sets Stripe test keys before anyone pays on a preview.
- **Club logos.** Previews write to the production `lca-club-logos` bucket. A separate preview bucket would need creating and binding under `[env.preview]`.
- **Logins.** Previews use the production Supabase project, so a sign-in on a preview is a real account.
- **One preview database for every branch.** A migration applied from one branch is there for all of them; only the redesign branch migrates it today.
- **Brief text.** Update brief 0.1 rule 8 and the 0.2 line "K applies remote migrations" in the next brief revision.
- **Member discount query.** K runs the production query under Decisions before checkpoint B merges; record the result here.
- **Clearinghouse dates.** `src/lib/clearinghouse.ts` keeps its own `formatDate` ("Oct 24, 2026", no weekday), used only by `src/pages/HomePage.tsx` for partner events. It should move to `formatDate` from `@domain/format` (with the year option) when the homepage is rebuilt behind `newHome` in WS03, and then be removed.
- **Reading stored timestamps (step 3).** Any later step that shows a `datetime('now')` column (`created_at`, `updated_at`, `sent_at`, `recorded_at` and the like) with `formatDate` or `formatTime` must pass `{ stored: 'utc' }`; the default reads wall-clock text and would show those times 5 to 6 hours early. Reviewers of those steps check for it.
- **One time-zone definition (step 3).** Done in step 4: `domain/format/centralTime.ts` takes `LCA_TIME_ZONE` from `CENTRAL_TIME_ZONE` in `date.ts`. `src/pages/AnnualMeetingPage.tsx` still writes `'America/Chicago'` in its own date formatter; it should use `formatDate` and `formatTime` when that page moves to the heritage look.
- **Minor names on the entrants list (step 4).** `publicName` is ready but unused. WS06 calls it from the public event endpoint once guardian links and the under-18 mark on an entry exist, with `'entrants'` for the pre-event list and `'results'` everywhere else.
- **Name suffixes (step 4, from review).** `publicName` skips Jr., Sr., II, III and IV but not a trailing "V" or "3rd", so "Leo Robichaux V" shows as "Leo V." on the entrants list. The result is shorter, not a leak. Add `v`, `2nd` and `3rd` to the suffix list with a test when `publicName` is wired in WS06.
- **Zero increment or delay (step 3).** `formatTimeControl("G/90+0")` reads "... + 0 sec per move". Minor; drop the clause when the value is 0 when a page first shows time controls.
- **Dynamic imports (step 3).** ESLint's `no-restricted-imports` does not see `import()` or `require()` inside `domain/`; `test/unit/domain-boundaries.test.ts` scans for both.
- **jsdom 30.** Moving to jsdom 30 needs Node 22.22.2 or later in development and in CI (`.github/workflows/ci.yml` asks for `'22'`). Not needed for WS01.

## WS02: Information architecture and navigation

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS03: Homepage

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS04: Event discovery and sharing

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS05: Event page template and lifecycle

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS06: Registration and households

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS07: Live mode (pairings, standings, My board, alerts, TV, print)

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS09: Clubs as living listings

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS10: Results archive, champions, news and recaps

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS11: Scholastic hub and series

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS12: Membership, giving and digital card

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS13: My LCA dashboard

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS14: Governance and board

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.

## WS15: Scanner 2.0

**Status:** not started. **Branch:** none. **PR:** none.

- Decisions: none yet.
- Deviations from the brief: none yet.
- Follow-ups: none yet.
- Verify items resolved: none yet.
