# Louisiana Chess Association — Website

The official website and tournament management platform for the **Louisiana Chess
Association** (LCA), the state's USCF-affiliated chess organization. Replaces a
patchwork of a Google Sites page and a third-party registration tool
(KingRegistration.com) with a single system for tournament registration, USCF
rating reporting, club management, membership, and governance.

**Live site:** [louisianachess.org](https://louisianachess.org)
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

### Testing

```bash
npm test                    # unit tests
npm run test:integration    # integration tests (real Workers runtime + D1)
npm run typecheck:functions # typecheck the Pages Functions backend
npm run build                # production build
```

---

*Built and maintained for the Louisiana Chess Association. Not affiliated with
or endorsed by the United States Chess Federation (USCF) beyond LCA's official
state affiliate status.*