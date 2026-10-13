# Louisiana Chess Association — Website

The official website and tournament management platform for the **Louisiana Chess
Association** (LCA), the state's USCF-affiliated chess organization. Replaces a
patchwork of a Google Sites page and a third-party registration tool
(KingRegistration.com) with a single system for tournament registration, USCF
rating reporting, club management, membership, and governance.

**Live site:** [louisianachess.org](https://www.louisianachess.org) — the apex redirects here.
*(custom domain pending: louisianachess.org)*

---

## What it does

- **Tournament registration & management** — public registration with Stripe
  payment, USCF-rated sections with entry fees and prize funds, half-point bye
  rounds, round scheduling, and a full tournament-director console (roster,
  check-in, walk-ins, pairings, results, standings).
- **Automated pairings** — a from-scratch **FIDE Dutch pairing system**
  implementation, driven by live USCF ratings.
- **USCF rating report generation** — produces the section-by-section report
  format required for US Chess tournament rating submission, with built-in
  validation (missing USCF IDs, etc.) before a director submits it.
- **Club network** — 25+ affiliated clubs across Louisiana with their own pages,
  officers, news, meeting info, and a statewide interactive map.
- **Membership & payments** — tiered membership (adult/scholastic/family/senior)
  via Stripe Checkout, with webhook-driven confirmation.
- **Role-based access** — admin, club representative (scoped to their own club),
  tournament director (scoped to assigned tournaments), and member roles enforced
  at the API layer, not just the UI.
- **Scholastic chess & governance** — K-12 tournament visibility, bylaws/rules/
  meeting-minutes publishing, and board member management.
- **Transactional email** — registration confirmations, tournament reminders,
  and support notifications via Resend.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router v7 |
| Backend | Cloudflare Pages Functions (serverless API), Cloudflare D1 (SQLite at the edge) |
| Scheduled jobs | Standalone Cloudflare Worker (cron) for reminder emails and auto open/close of registration |
| Auth | Supabase Auth |
| Payments | Stripe (Checkout + webhooks) |
| Email | Resend |
| Testing | Vitest, `@cloudflare/vitest-pool-workers` (integration tests run against a real Workers runtime + in-memory D1) |

**Brand:** Navy `#1a2744` / Gold `#c8a94a`, Geist typeface.

## Engineering notes

A few things about how this was built that might be of interest to other
developers or reviewers:

- **Integration tests run in the actual Workers runtime**, not a mocked Node
  environment — `cloudflareTest()` spins up real D1 against the on-disk migration
  chain, so the test suite enforces that migrations and schema stay in sync with
  the code that depends on them.
- **A route-audit unit test** parses every `fetch('/api/...')` call in the
  frontend API client and asserts a matching backend handler file exists,
  catching dead or mistyped routes automatically.
- **Custom pairing engine** — no third-party pairing library; Swiss/Dutch pairing
  logic, bye handling, and standings computation are implemented and unit-tested
  in-house.
- Permission checks (`requireAdmin`, `requireClubRep`, `requireTournamentManager`)
  are enforced server-side on every handler, independent of what the UI shows —
  verified by dedicated auth tests (e.g., a tournament director assigned to one
  event cannot touch a different one).

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run db:migrate:local     # build the local database
npm run pages:dev            # frontend + Pages Functions + local D1
```

`npm run dev` runs Vite alone, which is fine for pure UI work but serves no
backend — anything hitting `/api/...` 404s. Use `pages:dev` for the full stack.

### Environment files

Two files, both gitignored, both required for a working local stack:

- **`.env.local`** — frontend values, inlined by Vite at build time. Copy
  `.env.example` and fill it in. Because they are baked in at build time,
  changing them means rebuilding, not just reloading.
- **`.dev.vars`** — backend secrets, read by `wrangler pages dev`. Needs at
  least `SUPABASE_SERVICE_ROLE_KEY`, from Cloudflare → Workers & Pages →
  lca-website → Settings → Variables and Secrets. Without it every
  authenticated endpoint fails with `supabaseKey is required`, which surfaces
  in the browser as a generic 500 rather than anything that names the cause.

### Database

Migrations are applied through wrangler, which records what it has already
run in a `d1_migrations` table, so re-running only applies what is pending:

```bash
npm run db:migrate:local           # apply pending migrations locally
npm run db:migrate:status          # show applied vs pending (local)
npm run db:migrate:remote          # production — apply deliberately
npm run db:migrate:status:remote   # show applied vs pending (production)
```

A fresh local database needs every migration, which `db:migrate:local`
handles. Applying a migration by hand with `wrangler d1 execute --file=...`
works but records nothing, leaving wrangler convinced the migration is still
pending — `scripts/bootstrap-d1-migrations.sql` repairs that if it happens.

If you belong to more than one Cloudflare account, wrangler cannot work out
which to use and every command fails with *"More than one account available"*.
Set `CLOUDFLARE_ACCOUNT_ID` in your environment to fix it.

Set it in the environment rather than adding `account_id` to `wrangler.toml`:
that key is valid for Workers but the Pages build pipeline rejects the file
outright, failing the deploy with `unable to read the Wrangler configuration
file`.

### Safe previews

Every branch pushed to GitHub gets a Cloudflare Pages preview. Previews have
their own database, `lca-db-preview`, bound as `DB` under `[env.preview]` in
`wrangler.toml`, so the same code runs against it and a preview can never
write to production's `lca-db`. Pages does not carry `[vars]`, D1 or R2
bindings over into an environment, so that block repeats every one of them;
`test/unit/wrangler-config.test.ts` fails if they drift apart or if the
preview ever points at production.

```bash
npm run db:migrate:preview          # apply pending migrations to lca-db-preview
npm run db:migrate:status:preview   # show applied vs pending (preview)
npm run db:seed:preview             # load the synthetic sample data in scripts/seed/fixtures.sql
```

Each of these runs `scripts/db/preview-guard.ts` first. The guard reads
`wrangler.toml` and stops the command, before wrangler is called, if the
preview id is missing or a placeholder, if it is production's id, or if the
command would act on `lca-db`.

- **Migrate the preview before reviewing it.** K runs
  `npm run db:migrate:preview` from the branch, with his own Cloudflare
  credentials, before reviewing each checkpoint's preview, not after the
  merge. Once a branch adds tables the code reads, a preview bound to an
  unmigrated database shows errors. Merging to `main` applies migrations to
  production only (`.github/workflows/migrate-db.yml`); nothing migrates the
  preview database automatically. The first run on the new, empty database
  applies every migration from `0001` on.
- **Logins are shared.** Previews use the production Supabase project, so
  signing in on a preview uses a real account.
- **Secrets are separate.** Set preview secrets in the Pages dashboard under
  the Preview environment: Stripe test keys, never the live ones. Leave the
  Resend key off previews until test mail is wanted; without it every send
  fails and is logged, and the page that triggered it carries on. Previews
  existed before this setup and may already hold live keys, so before the
  first push of a redesign branch K checks the Preview environment's secrets
  and removes any live Stripe or Resend key.
- **Club logos are shared.** Previews still use the production
  `lca-club-logos` bucket, so a logo uploaded on a preview shows on the live
  site.
- One preview database serves every branch, so a migration applied from one
  branch is there for all of them.
- Development containers and automated checks never target the preview
  database: tests use a local in-memory D1, and only K runs the preview
  scripts.

### Testing

```bash
npm test                    # unit tests
npm run test:integration    # integration tests (real Workers runtime + D1)
npm run typecheck:functions # typecheck the Pages Functions backend
npm run build                # production build
```

#### Browser tests (not part of `npm test`)

```bash
npm run test:a11y   # accessibility suite: two local builds, axe and the colour baseline
npm run test:e2e    # end-to-end tests against a branch preview (E2E_BASE_URL)
```

`npm run test:a11y` needs nothing but `npm ci` and a Playwright Chromium
(`npx playwright install chromium` once; set `PW_CHROMIUM_PATH` to use a
Chromium you already have). It builds the site twice with
`vite build --mode a11y`, into `dist-a11y-on` (with the `newLook` and
`themeHeritage` switches on) and `dist-a11y-off` (none on), builds a local
database in `.wrangler/a11y` from the migrations and
`scripts/seed/fixtures.sql` (synthetic data only), and serves each build with
`wrangler pages dev` on ports 8801 and 8802 using the fake values in
`.dev.vars.a11y`, with the Stripe, Resend, Facebook and scanning keys bound
empty, so your own `.dev.vars` is overridden. Nothing it runs touches a
remote database. With every key empty, a call to a real service is refused,
but a checkout or an email can still send that refused request to Stripe or
Resend. The specs are in `test/a11y`: `smoke.spec.ts` runs axe on the
homepage of both builds (issues the site already has are listed in
`known-violations.json` until the full sweep fixes them), and `baseline.ts`
checks that today's colours and fonts still match `baseline.json`
(`A11Y_BASELINE=record npm run test:a11y` rewrites it, on purpose only).
Pull requests run it in CI's Accessibility job.

`VITE_FLAGS` (a comma-separated list of switch names) is read only by that
`--mode a11y` build. Every other build uses the values in
`src/lib/features.ts` as written, and the `/__fixtures/:name` test page
exists only in the `a11y` build.

`npm run test:e2e` runs `test/e2e` against the preview named by
`E2E_BASE_URL`; it refuses an empty address and any `louisianachess.org`
address. The specs wait (as `test.fixme`) for the household checkout and
round publishing. `.github/workflows/e2e-preview.yml` runs them only when
started by hand, after its form confirms that the preview is migrated and
seeded, holds Stripe test keys, and has those features.

---

*Built and maintained for the Louisiana Chess Association. Not affiliated with
or endorsed by the United States Chess Federation (USCF) beyond LCA's official
state affiliate status.*