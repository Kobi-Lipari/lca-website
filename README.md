# Louisiana Chess Association — Website

The official website and tournament management platform for the **Louisiana Chess
Association** (LCA), the state's USCF-affiliated chess organization. Replaces a
patchwork of a Google Sites page and a third-party registration tool
(KingRegistration.com) with a single system for tournament registration, USCF
rating reporting, club management, membership, and governance.

**Live site:** [lca-website.pages.dev](https://lca-website.pages.dev)
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
npm run dev              # Vite dev server (frontend)
npx wrangler pages dev    # Pages Functions + local D1 (backend)
```

Requires a `.env.local` with Supabase, Stripe, and Resend keys (see
`.env.example`) — not included in this repo.

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