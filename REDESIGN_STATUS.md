# Website redesign: status

Last updated: 2026-10-08 (WS01, preview database)

The brief is `docs/redesign/REDESIGN_SPEC.md`. This file records, for each workstream, where it stands, what was decided, where the work differs from the brief, what is left to do, and every `verify:` item that has been checked. It is updated in every redesign PR.

## Ordering rules

1. **The branch is pushed only after the preview database slice is committed.** Every pushed branch gets a Cloudflare Pages preview. Before `[env.preview]` existed in `wrangler.toml`, that preview was bound to the production database `lca-db`, so anyone clicking around it would have written real registrations and accounts. `redesign/ws01-design-system` stays local until the commit that adds the preview database. Before that first push, K also checks the Preview environment's secrets in the Pages dashboard and removes any live Stripe or Resend key: previews existed before this slice and may already hold the live ones.
2. **K migrates the preview database from the branch before reviewing each checkpoint's preview.** He runs `npm run db:migrate:preview` from the branch, with his own Cloudflare credentials, before he looks at the preview, not after the merge. Merging to `main` migrates production only (`.github/workflows/migrate-db.yml`); nothing migrates `lca-db-preview` automatically. Once the branch adds tables the code reads (the sections and schedules tables), a preview bound to an unmigrated database shows errors.

## WS01: Design system, themes and accessibility foundation

**Status:** in progress. Built in 32 small steps on one branch and merged in four checkpoints (A: steps 1 to 8, B: 9 to 15, C: 16 to 19, D: 20 to 32).
**Branch:** `redesign/ws01-design-system` (not pushed yet; see ordering rule 1).
**PR:** none yet.

### What each acceptance criterion and decision is proved by

AC1 to AC14 are the brief's WS01 acceptance criteria. K1a to K6 are the parts of K's October 8 structural decisions.

| Item | What it covers | Step | Proved by |
|---|---|---|---|
| AC1 | axe finds no serious or critical issue on the listed pages in every look | | |
| AC2 | No light-gold text on a light ground | | |
| AC3 | Focus ring reaches 3:1 in every look | | |
| AC4 | Nothing auto-advances; reduced motion stops animation | | |
| AC5 | Every status shows its label in words | | |
| AC6 | Standings and crosstables show ½ in tabular figures | | |
| AC7 | Home hero image size and mobile performance | | |
| AC8 | Switching look on a container causes no layout shift | | |
| AC9 | Branch deploys use `lca-db-preview`, never `lca-db` | 1 | Config half: `test/unit/wrangler-config.test.ts`, with `test/unit/preview-database.test.ts` proving the npm scripts stop when the guard fails. Live half: K checks a branch deploy's bindings after the first push (not done yet). |
| AC10 | Official logo and rook mark in their placements | | |
| AC11 | Heritage fonts stay off `/`; no layout shift from the font swap | | |
| AC12 | Editors and forms never render in the heritage look | | |
| AC13 | Controls look identical inside heritage | | |
| AC14 | The live tag's dot does not move | | |
| K1a | Shared `domain/` folder and date, time and score formats | | |
| K1b | Shared pricing, eligibility and minor name rules | | |
| K1c | Event-mode phases | | |
| K1d | Request and response contracts | | |
| K2a | Sections and schedules tables, with the backfill | | |
| K2b | One writer for sections | | |
| K2c | Player registration reads the new tables | | |
| K2d | Admin entry reads the new tables | | |
| K2e | Server display reads the new tables | | |
| K2f | Client display reads the new tables | | |
| K2g | Schedules | | |
| K3a | Server helpers grouped by area | | |
| K3b | Client library grouped by area | | |
| K3c | API client split by area | | |
| K3d | Components grouped by area, with boundary rules | | |
| K4 | Drizzle for schema and queries | | |
| K5 | Browser tests | | |
| K6 | No member pricing; the LCA membership requirement | | |

### Step 1: preview database

- `wrangler.toml` gains `[env.preview]`: `DB` bound to `lca-db-preview` (`28e13174-3a06-47a7-ab0f-b4ac7f24af6f`, region ENAM, created by K on October 8), all ten `[vars]` keys repeated with production's values, and the `CLUB_LOGOS` bucket repeated. The production binding is unchanged.
- `scripts/db/preview-guard.ts` reads `wrangler.toml` (with `smol-toml`, pinned at 1.8.0) and stops a preview command with a plain message when the preview id is missing or a placeholder, when it is production's id, when the preview block names `lca-db`, or when the command is aimed at `lca-db` or at a database the preview block does not bind.
- New npm scripts, each running the guard first and stopping if it fails: `db:migrate:preview`, `db:migrate:status:preview`, `db:seed:preview`. The seed script refuses until `scripts/seed/fixtures.sql` exists (step 20).
- `README.md` has a new "Safe previews" section.
- Nothing in a development container or CI targets the preview database. Only K runs the preview scripts.
- Checks: `npm run build`, `npm run typecheck:functions` and `npm run test:all` pass (unit 406, up from 326 with 80 new tests in `test/unit/wrangler-config.test.ts` and `test/unit/preview-database.test.ts`; integration 267). `npm run lint` is at 36 errors and 4 warnings, the same as before the change, none in the files this step touches.

### Decisions

- The real preview id is in `wrangler.toml`, not a placeholder (K confirmed it on October 8). The guard still refuses a placeholder, production's id and production's name.
- Previews keep `SITE_URL` (and `VITE_SITE_URL`) on the production origin. Previews are not meant to send mail.
- Preview secrets are set by K in the Pages dashboard: Stripe test keys only, and no Resend key until K wants test mail. Without a Resend key every send fails, is logged, and the request carries on.
- Previews keep the production `lca-club-logos` bucket for now.
- The binding name stays `DB` in both places, so the code reads `env.DB` everywhere.

### Deviations from the brief

- **Remote migrations.** The brief (0.2) says K applies remote migrations. In fact `.github/workflows/migrate-db.yml` applies `migrations/**` to `lca-db --remote` on every push to `main` that touches migrations, so merging a checkpoint applies its migrations to production. The preview database is migrated only by K's `db:migrate:preview`, run from the branch before review.
- **Preview id.** The plan was a placeholder for K to paste over; the real id went in directly on K's confirmation.
- **Base branch.** The branch was created from the docs branch that carries the brief and the decided boards, not from `main`. It is rebased onto `main` once that docs PR merges; the content is the same.
- **Mail on previews.** The brief has the Resend key set separately for previews; the decision is no Resend key on previews until K asks for test mail.
- **Brief 0.1, rule 8** ("Preview deployments share the production database") is no longer true once this step merges. The brief's text should be updated with the next brief revision.
- **Seed script.** The brief asks for a seed script with the preview database; it exists but refuses until the sample data is written in step 20.

### Verify items resolved

- **wrangler.toml has no preview override.** Confirmed before the change: one `[[d1_databases]]` (`DB` to `lca-db`, `e891b93f-e7fe-48d0-9afc-8570d805ef08`), `[vars]` with ten keys (`SITE_URL`, `SUPABASE_URL`, `FROM_EMAIL`, `CONTACT_EMAIL`, `SUPPORT_EMAIL`, `REPLY_TO_EMAIL`, `VITE_SITE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`), `[[r2_buckets]]` `CLUB_LOGOS` to `lca-club-logos`, and no `[env.*]` block. No workflow deploys the Pages site (only the daily-emails worker has a deploy job), which fits Pages deploying through its Git integration with `wrangler.toml` as the binding source; that part cannot be confirmed from the repo.
- **Pages environment inheritance.** Per Cloudflare's Pages configuration docs, `vars`, `d1_databases` and `r2_buckets` are not inherited by an environment, so `[env.preview]` restates all of them. This is from the docs, not checkable in the repo; `test/unit/wrangler-config.test.ts` holds the restatement in place. wrangler 4.112 accepts the block: against a scratch copy of the config with `--local`, `--env preview` finds `lca-db-preview` and cannot find `lca-db` at all.
- **Does the preview database exist.** K created it on October 8 and confirmed the id. This container is not logged in to Cloudflare and cannot check it.
- **Who applies remote migrations.** `.github/workflows/migrate-db.yml` (push to `main` touching `migrations/**`, or manual run) lists and then applies migrations to `lca-db --remote`. Recorded as a deviation above. Nothing in any workflow targets `lca-db-preview`.
- **Workers.** `workers/daily-emails` binds production `lca-db` and deploys only from `main` (`.github/workflows/deploy-worker.yml`). `workers/clearinghouse-sync` binds production `lca-db` and imports nothing from `functions/`. Neither is affected by the preview block.

### Follow-ups

- **AC9 live check.** After the first push, K opens the branch deploy in the Pages dashboard and confirms its D1 binding shows `lca-db-preview`. Record the result here.
- **First preview migration.** K runs `npm run db:migrate:preview` once before reviewing the first preview; on the new, empty database it applies every migration from `0001`.
- **Preview secrets.** Before the first push, K checks the Preview environment's secrets in the Pages dashboard and removes any live Stripe or Resend key left from before this slice, then sets Stripe test keys before anyone pays on a preview.
- **Club logos.** Previews write to the production `lca-club-logos` bucket. A separate preview bucket would need creating and binding under `[env.preview]`.
- **Logins.** Previews use the production Supabase project, so a sign-in on a preview is a real account.
- **One preview database for every branch.** A migration applied from one branch is there for all of them; only the redesign branch migrates it today.
- **Brief text.** Update brief 0.1 rule 8 and the 0.2 line "K applies remote migrations" in the next brief revision.

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
