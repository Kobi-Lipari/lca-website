# LCA website redesign: implementation brief

**For:** Claude Code working in `github.com/Kobi-Lipari/lca-website`
**Owner and reviewer:** K
**Version:** 1.2, October 8, 2026. Adds K's Phase 0 design decisions (sections 1.1, 1.2, 2.2, WS01–WS03) from DESIGN_REPLAN_phase0.md and K's second-round notes; D1 amended.
**Design source:** the canvas "LCA Look & Feel Options". Pages 1 to 5 carry the decided boards (copies in `docs/redesign/decided-boards`); the later pages still hold option boards until K picks. Board names in this brief, such as `Event-A` or `Clubs-B`, refer to artboards on that canvas. Open the named board before building a screen.

This brief turns the redesign options K picked from into buildable work. It sets out:
- the look,
- the pick for every section of the site,
- 15 workstreams, each with data, API, frontend and acceptance criteria,
- six phases,
- the decisions still open, with a recommendation for each.

**Changes in 1.2** (the reasoning for each is in `docs/redesign/DESIGN_REPLAN_phase0.md`, sections 1–5 and 8):
- **Looks (1.1, WS01):** Heritage Club becomes a full scope for LCA's lasting record (About, governance, Champions) with its own fonts; Bright Scholastic's fonts and rollout move to WS11; the live tag's dot is static.
- **Logo (D1 amended):** the rook mark is the header's brand mark at every width; the official logo keeps the footer, the homepage identity band and the other roomy placements.
- **Header (1.2, WS02):** H1 as one 64px row with no condensing, H4's search as a Search button and panel, H5's event strip for involved people only. Renew shows only once a membership has expired. When the row is tight, Donate moves into the About menu first, then the brand name hides.
- **Phones (1.2, WS02):** M2's bottom tab bar with M1's sheet behind Menu, and M4's banner and a docked event bar; Donate is two taps on phones.
- **Footer (1.2, WS02):** F1's four columns, rebuilt from `nav.ts`, with the Appearance control in the base line.
- **Search (WS02, WS03):** one combobox in the header panel, on the homepage and at `/search`; no Players group, no person names.
- **Home (1.2, WS03):** a ten-rung hero ladder with a 30-day window; new block order (hero, identity and search band, News, doors, upcoming, results and champions, membership); in the quiet and clubs rungs the hero carries the doors.
- **Platform (2.2, 0.2):** a per-user event-mode endpoint, `functions/utils/events.ts` moved to WS03, the Phase 0 flag list and the deviations to record.
- **WS12 AC6** follows the new Donate placement.

It is deliberately ambitious. Every workstream is meant to be built, phase by phase.

---

## 0. Read this first (working rules for Claude Code)

### 0.1 K's standing rules (non-negotiable)
1. **No AI references anywhere.** That covers commits, PR titles and descriptions, code comments, docs and changelogs:
   - no `Co-Authored-By` lines naming an AI
   - no session links
   - no "Generated with" lines

   Write commits and PRs as plain human-authored text.
2. **Read the real file before you change it,** and match the repo's existing conventions (helpers, naming, response shapes, test harness). This brief names real paths as they were on October 5, 2026. If the code has moved, follow the code and note the difference in `REDESIGN_STATUS.md`. Items marked `verify:` were not confirmed and must be checked first.
3. **Collect only what's needed.**
   - Confirm eligibility with a checkbox ("In 8th grade or below?"). Never ask for a child's grade or birthdate.
   - LCA doesn't get involved in families' finances: no fee waivers and no lunch-status or need-based questions (decision D5).
   - Results, standings, winners and recaps show players' full names, kids included, because they congratulate performance. Abbreviate to first name + last initial only on a page that lists minors and nothing else, such as a full scholastic roster (decision D3).
4. **Keep the hard-coded "300+ members" stat. Keep every Facebook link.** The Facebook feed is pulled server-side.
5. **Partner events register on the organizer's site; LCA-run events register on louisianachess.org.** Partner events are Gulf South clearinghouse listings.
6. **Accessibility target is WCAG 2.2 AA.**
   - Status is always shown as words plus colour, never colour alone.
   - Brand gold `#c8a94a` is never text on a light background (2.28:1). Use dark gold `#866a1e` (5.13:1 on white).
   - Gold text on navy `#1a2744` is fine (6.51:1).
7. **Plain language.**
   - Write "US Chess" and "US Chess ID", not USCF, in the UI.
   - Every date carries its weekday: "Sat, Oct 24".
   - Write times as "7:00 PM".
   - Write half points as ½, never 0.5 or 3.5.
   - Chess shorthand gets a plain companion the first time: "G/90+30 · 90 min each + 30 sec per move".
8. **Preview deployments share the production database.** `wrangler.toml` has one `[[d1_databases]]` block (`DB` → `lca-db`) and no preview override. Never run destructive scripts, seed data or test emails against a preview until WS01 adds a preview database.

### 0.2 How to work
- **One workstream per branch.** Name branches like `redesign/ws01-design-system` and open one PR per workstream; split large ones into numbered sub-PRs. Don't start a workstream until everything in its "Depends on" line is merged.
- **Ship behind flags.** Every user-visible change goes behind a flag in `src/lib/features.ts` (the `FEATURES` object, defaulting to `false`). K flips flags after checking the preview. Each flag gets the existing style: a short plain-English comment saying what it turns on. The Phase 0 flags are listed at the end of this section.
- **Keep `REDESIGN_STATUS.md` at the repo root (new),** in the same spirit as the scanner's STATUS.md protocol. For each workstream record:
  - status, branch and PR
  - decisions taken, deviations from this brief and follow-ups
  - any `verify:` item resolved

  Update it in every PR.
- **Gate before every commit:** `npm run lint`, `npm run build`, `npm run typecheck:functions`, `npm run test:all`. Run `npm run scanner:check` too when you touch `scanner/` or `functions/utils/scan/`. The route-audit test that checks every `fetch('/api/…')` in `src/lib/api.ts` against a handler file must stay green.
- **Migrations** continue after `migrations/0051_club_map_location.sql`. This brief names them `00xx_<name>.sql`; number them in the order they land.
  - Apply locally with `npm run db:migrate:local`; K applies remote migrations.
  - When a table must be rebuilt in SQLite, use the existing table name rather than a `_new` rename while child rows exist. This is a known D1 gotcha in this repo.
- **Tests.** Unit tests go in `test/unit`. Integration tests go in `test/integration` and use the `invoke()` harness in `harness.ts` and the seed factories in `factories.ts`. Every new endpoint gets an integration test, including a role-safety case. `role-safety.test.ts` and `club-permissions.test.ts` are the models to follow.
- **Write files directly.** TSX with special characters should be written with the editor or file-write tool, not shell heredocs.

**Phase 0 flags** (added in 1.2). Add these to `src/lib/features.ts`, all default `false`, each with a plain comment:

| Flag | Turns on | Can go on in |
|---|---|---|
| `newLook` | WS01 base tokens, dark mode, focus ring, formats | Phase 0 |
| `themeHeritage` | About, Board, Bylaws, Minutes, Annual meeting and Champions in the Heritage Club look | Phase 0 |
| `themeScholastic` | Scholastic pages in the Bright Scholastic look | WS11 |
| `newNav` | the six-section header, My LCA menu, footer, tablet hybrid, and on phones the app bar, tab bar and sheet (one flag, so no combination leaves a phone without navigation) | Phase 0 |
| `siteSearch` | the header Search button, ⌘K panel and `/search` | Phase 0 |
| `homeSearch` | the search box in the homepage band | Phase 0 |
| `eventStrip` | the personal event strip on desktop and tablet in the week, day before, check-in, event day, final and after states (`final` = `status = 'completed'` or a non-null result in every section's last scheduled round) and, from check-in on day 1, the phone event bar and banner | Phase 0, after a preview check with a real registration |
| `eventStripLive` | the round posted, in progress and between states (board, colour, opponent), the public "Playing today" line on pairings and standings pages, and the admin "not marked completed" nudge | WS07 |
| `liveMarker` | the public "Live" tag on Tournaments | WS07 |
| `newHome` | the hero ladder (event day, last call, register, announced, this week in Louisiana, quiet, clubs), the doors in the quiet and clubs heroes, and the lower blocks in the 1.2 order | Phase 0 |
| `homeResults` | the final-standings hero for 7 days after an LCA event | Phase 0 |
| `homeChampions` | the current champions band | Phase 0 |
| `homeLive` | the live round hero | WS07 |
| `homeWeek` | the week view hero and the this-week strip, which sits directly under the identity and search band | WS09 |
| `homeRecap` | the recap card | WS10 |

**Deviations from v1.1 to record in `REDESIGN_STATUS.md`** when the matching PR lands:
- WS01: Heritage loads Libre Caslon Display and Source Serif 4 instead of reusing Instrument Serif. Baloo 2 and Nunito move to WS11. The event-mode phase machine lives in `domain/events/eventMode.ts`, not `functions/utils/eventMode.ts` (recorded in step 5). Step 7 records three page routes outside `functions/api`, not two (`functions/news/[slug].ts` as well), and that the client API types move to the contracts in step 13 (recorded in step 7). Step 8 replaces the planned schedules JSON column with the existing `round_schedule` column (kept, with `sections`), and adds archived section rows, the revive-on-return rule and a sync trigger that outlives checkpoint B (recorded in step 8).
- WS02: the public event bar becomes a personal strip; `EventBar.tsx` becomes `EventStrip.tsx`; the "/" shortcut is dropped; the mobile layout is M2 under 768px; the header uses the rook mark at every width and no longer condenses (D1 amended); Renew shows only once a membership has expired; when the row is tight, Donate moves into the About menu, then the brand name hides; WS02 AC6 and WS12 AC6 follow that and the phone exception (Donate is two taps on phones); the footer column list changes.
- WS03: three hero modes become ten; the window moves from 21 to 30 days with a 14-day last-call tier; results and champions ship before WS10; `functions/utils/events.ts` moves from WS04 to WS03; the blocks below the hero follow K's October 8 order; the quiet and clubs rungs carry the doors in the hero and omit the doors band.
- WS12: AC6 reworded.

---

## 1. The picture

louisianachess.org becomes the place Louisiana chess runs on. A visitor finds a game in seconds, whether a tournament this weekend or a club meeting tonight. A parent registers a whole family in one checkout. Players follow a round live from their phones. Results build up into history. Volunteers keep it all current with tools that do the remembering for them.

### 1.1 The look (canvas page 1)
| Scope | Look | How it's applied |
|---|---|---|
| Site-wide base | **Modern Tech-Minimal** (`Looks-3-Minimal-Tile`, `Looks-3-Minimal-Page`) | Geist and Geist Mono, with one Instrument Serif accent. Navy ink and white/near-white grounds. Gold is a fill or accent only, plus `#866a1e` for gold-toned text on light grounds. Chess character comes from coordinates (the a–h / 8–1 grid motif), notation and real data. It's the closest to today's site, since Geist is already loaded, and the most data-friendly. |
| Event-day surfaces | **Broadcast Night** (`Looks-7-*`) | Scoped dark theme via `data-theme="live"` on pairings, standings, My board, hall TV and the event page while a round is live, plus a "Night" toggle, the homepage hero's live mode (colour tokens only, no live fonts on `/`), and the header event strip's colour tokens while a round is live (Geist stays; Barlow loads only on the live routes). Never the site default. The live tag's dot is static; the word "Live" carries the meaning. |
| Scholastic pages | **Bright Scholastic** (`Looks-6-*`) | Scoped via `data-theme="scholastic"` on `/scholastic/*` only, never on registration, checkout, shared event pages, pairings or standings (those show a grade-band chip with its words, "K–5"). Navy carries all text and buttons. Colour only ever means a grade-band section, always beside the band's words; status tags use the base status tokens. WS01 ships the token block and an axe fixture; the Baloo 2 and Nunito chunk and the rollout ship in WS11 behind `themeScholastic`, after K previews it. |
| Heritage pages | **Heritage Club** (`Looks-1-*`) as a scope | **Rule: Minimal is for doing, Heritage is for the lasting record, Broadcast is for what is live now.** Full scope (`data-theme="heritage"` on `<main>`, heritage fonts load) on `/about` (with the history timeline), `/governance/board`, `/governance/bylaws` and `/governance/minutes` (the editors and forms inside them reset to base through `ThemeScope scope="base"`, the one permitted nesting), `/meeting` and `/champions`; later on the membership card, certificates and the final-report cover; and as a component scope for the `HonorBoard` above final standings of events with `is_state_championship = 1` and status completed. Accent only (base scope, Geist, no heritage fonts) on the homepage identity band, Champions band and Results-mode winners block, using `ThickThinRule` and `Seal`. Heritage changes headings, body type, rules, seal, grounds and gold-ink only; it never restyles `Button`, `Input`, chips, nav, `StatusBadge`, the focus ring, control radius, or date and score formats. The header and footer are always base. Everything else, including `/membership`, `/donate`, every form, the print kit and all email, stays Minimal. |
| Logo and mark | The board-voted full-colour LCA logo, plus the one-colour rook-shaped Louisiana mark (today's favicon) | **Decided (D1, amended in 1.2).** The rook mark is the header's brand mark at every width, desktop, tablet and phone, and also goes on the favicon, small badges, QR centres and social avatars. The official logo keeps the footer brand block, homepage identity band, About and history pages, emails, print kit, certificates and the membership card. Never recolour the logo; set it on white or cream. |

`Looks-Compare` shows all seven looks side by side. Editorial Sports, Swiss Grid and Louisiana Rooted are not recommended as the base:
- **Editorial Sports** needs a writer after every event.
- **Swiss Grid** is cold and effectively a rebrand.
- **Louisiana Rooted** needs parish data that doesn't exist yet.

Louisiana Rooted's region and parish chips are worth revisiting once region data exists (D10).

### 1.2 The pick for each section
| Section | Build from | Borrow |
|---|---|---|
| Site structure | `Nav-IA` structure 1, task and topic: Tournaments · Clubs · Scholastic · News · Membership · About | Scanner moves under Tournaments ("Scoresheet scanner") and into the footer |
| Header | `Nav-Header` H1 Refined, one 64px navy row led by the rook mark and the two-line name (D1), with no condensing on scroll. When the row is tight, Donate moves into the About menu first, then the name hides | H4's search as a field-shaped "Search" button (the word visible at every desktop width, ⌘K / Ctrl K from 1280px) opening the search panel; the full box lives on the homepage. H5's event strip, personalised to involved people (registered players, guardians, the event's TDs, LCA admins) with H2's "same line, other moments" lifecycle; light gold tint before and after the event, the live tokens while a round is live. No public bar; the public gets a worded "Live" tag on Tournaments. "LCA on Facebook ↗" in the About menu's footer row. |
| Mobile nav | `Nav-Mobile` M2 bottom tab bar under 768px: Tournaments · Clubs · Log in / My LCA (to-do count) · Menu | M1's sheet behind the Menu tab, ending with Donate · Log in · Join LCA in the desktop order. M4's pill as a 56px event bar docked above the tab bar inside one `BottomDock`, and M4's banner as an in-flow `role="status"` card. 768–1023px keeps the hybrid header (with a Donate text link) and no tab bar. |
| Footer | `Nav-Footer` F1, the board's four columns minus links to pages that do not exist (WS02, Footer) | F3's trust line and the Appearance control in the base line; columns fold to tap-to-open groups under 768px |
| Home | `Home-A` next-event hero with a ten-rung ladder (live, event day, last call, results, register, announced, week, this week in Louisiana, quiet, clubs), personalised on the client for involved people; the quiet and clubs rungs carry the three doors in the hero | `Home-C` this-week strip (kept for WS09, when club schedules exist), `Home-E` doors band, `Home-D` champions band and recap card, `Home-B` search box in the identity and search band directly under the hero in every mode (and the header trigger everywhere else). Below the band: News, doors, upcoming six, results and champions, membership |
| Tournaments list | `Tourn-A` agenda + chips (default) | `Tourn-C` calendar navigator, `Tourn-D` map, `Tourn-E` table behind a toggle, `Tourn-B` preview pane on wide screens |
| Tournament page | `Event-A` sticky registration card | `Event-C` lifecycle states, `Event-B` championship layout, `Event-D` festival layout, `Event-E` partner pages |
| Registration | `Reg-C` household checkout (core model) | `Reg-A` in-card flow on desktop, `Reg-B` one-question sheet on phones, `Reg-D` guest entry |
| Tournament day | `Live-A`…`Live-E` as one live-mode system | Phased: pairings, standings and My board first, then print & QR, then TV |
| Clubs | `Clubs-A` list + map, meeting-first | `Clubs-B` this-week view, `Clubs-C` regions as filter and headers |
| Club page | `Club-A` visit-first | `Club-C` compact fallback, `Club-B` branding |
| Scholastic | `Schol-A` first-tournament guide + `Schol-C` hub | `Schol-B` pathway and Grand Prix series later |
| News | `News-A` feature + list | `News-D` auto-drafted recaps, `News-C` digest and RSS |
| About | `About-A` transparency hub | `About-B` board & regions, `About-C` bylaws & minutes reader, `About-D` champions & heritage |
| Membership | `Member-A` "Which one fits you?" | `Member-B` tier cards, `Member-C` donate page, `Member-D` digital card |
| My LCA | `Account-C` one account, many roles | `Account-A` needs-attention and next-up sections, `Account-B` family section |
| Workspace & admin | `Work-A` TD console, `Work-B` club rep workspace, `Work-C` admin home & queues, `Work-D` setup checklist | Keeps K's split: admin-only `/admin` with a grouped sidebar, and `/workspace` for club reps, TDs and auditors |
| Scanner | `Scan-A` side-by-side review + `Scan-B` phone flow | "My games" library, share links, `Scan-C` notation kit |

### 1.3 Workstreams and phases
| Phase | Workstreams | Theme |
|---|---|---|
| 0 · Foundation | WS01 design system & accessibility · WS02 navigation · WS03 homepage | Everything else builds on the tokens, themes and nav |
| 1 · Events core | WS04 event discovery & sharing · WS05 event page · WS06 registration & households · WS13 (member and parent sections) | Find, decide, register |
| 2 · Event day | WS07 live mode · WS08 TD console, setup checklist, QR check-in | Pilot at one LCA event before switching alerts on site-wide |
| 3 · Community | WS09 clubs · WS10 results archive, news & recaps · WS11 scholastic | Where to play, what happened, how kids start |
| 4 · Membership, governance, admin | WS12 membership & giving · WS14 governance & board · WS08 admin home & queues · WS13 (club rep, TD and board sections) | Trust and operations |
| 5 · Extras | WS15 scanner 2.0 · Wallet passes · Web Push · Grand Prix series · festival layout · hall TV polish | Delight |

---

## 2. Architecture and conventions

### 2.1 Repo map (verified October 5, 2026)
**Frontend**
- React 19, TypeScript, Vite, Tailwind v4 and shadcn/ui.
- Tailwind v4 is configured through `@theme` / `@theme inline` blocks in `src/index.css`, which also holds the shadcn tokens and a `.dark` block that uses stock greys today.
- Pages are `src/pages/*Page.tsx`; route definitions live in `src/App.tsx`.
- Library code: API wrappers in `src/lib/api.ts`, flags in `src/lib/features.ts`, time helpers in `src/lib/lcaTime.ts`, plus `brand.ts`, `pricing.ts`, `family.ts`, `roles.ts`, `regions.ts`, `clubColors.ts`, `clearinghouse.ts`, `champions.ts` and `tournamentStatus.ts`.
- Components: `src/components/` contains `PageHero`, `StatusBadge`, `FacebookFeed`, `DonateButton`, `AnnouncementBanner` and `ImpersonationBanner`, plus the `layout/` (`Navbar`, `Footer`), `tournaments/`, `admin/`, `family/`, `uscf/`, `maps/`, `governance/` and `ui/` folders.

**Functions**
- Cloudflare Pages Functions with file routing under `functions/api/**`.
- Auth helpers in `functions/utils/auth.ts`: `requireUser`, `requireAuthedMember`, `optionalAuthedMember`, `requireRole`, `requireAdmin`, `requireAdminView`, `requireClubRep`, `requireClubView`, `requireTournamentManager`, `requireTournamentView`, `requireGovernanceEditor`, `requireMailer`, `requireMemberDirectory`, `requireSeatAccess` and `isObserver`.
- Response helpers in `functions/utils/response.ts`: `jsonResponse`, `errorResponse`, `parseJsonBody`, `handleOptions` and `isResponse`.
- Domain helpers in `functions/utils/`: `pricing`, `sectionRules`, `family`, `prizes`, `swiss/` (the pairing engine), `ratingSnapshots`, `membershipExpiry`, `membershipActivation`, `registrationEmails`, `registrationOpenNotify`, `email` + `emailLayout` (Resend), `stripe`, `uscf`, `linkPreview`, `audit`, `tickets`, `campaigns`, `regions`, `time`, `permissions`, `tournament-manage` and `scan/`.

**Data**
- D1 binding `DB` (`lca-db`), with migrations `0001`…`0051`.
- Main tables: `tournaments`, `registrations`, `tournament_games`, `tournament_directors`, `tournament_reminders`, `tournament_attendee_reminders`, `members`, `payments`, `clubs`, `club_news`, `club_officers`, `clearinghouse`, `lca_posts`, `governance_documents`, `board_members`, `board_seat_assignments`, `seat_regions`, `state_champions`, `support_tickets`, `support_messages`, `scan_usage`, `uscf_rating_history`, `email_campaigns`, `email_campaign_recipients`, `admin_audit_log`, `impersonation_log`, `site_announcement(s)`, `facebook_feed_cache` and `contact_messages`.
- Storage is the R2 binding `CLUB_LOGOS`.

**Workers**
- `workers/clearinghouse-sync` syncs the Gulf South feed.
- `workers/daily-emails` runs a cron at 12:00 UTC with a per-phase isolation pattern and marks a send done only once it succeeds.

**Integrations**
- Supabase Auth: password sign-in, with the Bearer JWT verified server-side.
- Stripe: Checkout plus `functions/api/stripe/webhook.ts`. Endpoints include `registrations/[id]/pay.ts`, `registrations/batch.ts`, `membership/checkout.ts`, `membership/confirm.ts` and `donations/checkout.ts`.
- Resend, Google Maps JS (`LCAMap`) and the US Chess lookup (`uscf/lookup.ts`, `uscf/search.ts`).

**Tests:** unit tests and integration tests (`foundation`, `family`, `pairing-flow`, `registration-rules`, `role-safety`, `club-permissions`, `coverage`, `prizes`, `rating-upload`, `public-feed`, `lifecycle`, …).

### 2.2 Shared platform pieces (built once, used by several workstreams)
| Piece | Built in | Used by |
|---|---|---|
| Theme scopes (`data-theme` = base / `heritage` / `live` / `scholastic`, plus `.dark`) and token layer; scope token blocks in `index.css`, only `@font-face` chunks lazy | WS01 | All |
| `src/lib/format.ts` (new): `formatScore` (½), `formatDate` (with weekday), `formatTime`, `formatTimeControl` (plain-language companion) | WS01 | WS04–WS15 |
| Navigation config `src/lib/nav.ts` (new): single source for header, mobile menu and footer | WS02 | WS02, WS03 |
| Per-user involvement endpoint `GET /api/me/event-mode` (private, no-store, ETag) with `functions/utils/eventMode.ts` (pure phase machine) and `src/lib/eventModeCopy.ts` (one copy builder) | WS02 | WS02 strip, dock and banner; WS03 hero personalisation; WS07 (round phases via `round_publications`); WS13 event-day view |
| Unified event query `functions/utils/events.ts` over `tournaments` + `clearinghouse` (moved out of `functions/api/clearinghouse.ts`) | WS03 | WS03 `/api/home`, WS04 `/api/events`, WS11, WS13 |
| Unified event listing `GET /api/events` over `tournaments` + `clearinghouse`, built on `functions/utils/events.ts` from WS03 | WS04 | WS04, WS11, WS13 |
| Server-rendered share previews (OG/Twitter meta and image) | WS04 | WS05, WS09, WS10, WS15 |
| Household model (guardian and dependents) on top of today's children | WS06 | WS06, WS11, WS12, WS13 |
| Signed tokens: `functions/utils/tokens.ts` (new), an HMAC over JSON with expiry, secret `SIGNING_SECRET` | WS06 | Guest manage links, waitlist claims, club confirm links, digest unsubscribe, QR check-in |
| Notifications outbox (`notifications` table + a sender with retries) | WS07 | WS07, WS09, WS10, WS12, WS13 |
| Live state endpoint with `ETag` | WS07 | WS02 event strip, WS03 hero, WS05, WS13 |
| `follows` table (player, club, event) | WS07 | WS07, WS09, WS13 |
| Club schedule model and occurrence expansion | WS09 | WS03 strip, WS09, WS11, WS13 |
| `event_results` (results archive; no player pages, D9) | WS10 | WS10, WS11 series, WS13, WS15 |
| Merged admin "Needs attention" queue | WS08 | Admin and board |

### 2.3 New tables at a glance (full DDL sketches live in each workstream)
- **WS04:** `saved_searches`
- **WS06:** `registration_orders`, `waitlist_offers` (and `dependents` only if today's children model can't carry it)
- **WS07:** `round_publications`, `follows`, `notifications`, `push_subscriptions` (Phase 5)
- **WS08:** `queue_assignments`
- **WS09:** `club_schedules`, `club_schedule_exceptions`, `club_reports`
- **WS10:** `event_results`, `digest_subscriptions`
- **WS11:** `series`, `series_events`, `team_entries`
- **WS12:** `donation_funds`
- **WS14:** `governance_doc_versions`, `governance_changes`, `meetings`, `zip_regions`
- **WS15:** `scanned_games`, plus a new R2 bucket binding `SCANS`

### 2.4 Performance and quality budgets (site-wide)
- **Mobile pages:** LCP ≤ 2.5 s, CLS < 0.1, INP ≤ 200 ms (lab, mid-tier mobile on 4G).
- **Images:** the hero image on mobile is ≤ 200 KB, and every image has width and height set.
- **Accessibility:** zero serious or critical axe violations on the key routes in every theme scope.
- **Live endpoint:** pages that poll it must make no request while the tab is hidden.
- **Caching:** public GET endpoints set `Cache-Control`.
- **Edge caching:** use the Cache API for aggregates (`/api/home`, `/api/events`, `/api/clubs/this-week`), short-lived on live data.

## 3. Workstreams

Every workstream uses the same order: Why · Canvas boards · User-facing scope · Data model · API · Frontend · Jobs & integrations · Acceptance criteria · Tests · Depends on · Risks & open decisions.

---

## WS01 · Design system, themes & accessibility foundation
**Why:** Today's site has five problems in this area.
- The homepage `HeroSlideshow` auto-advances every 5 s with no pause control and ignores reduced-motion settings. That fails WCAG 2.2.2, which is Level A.
- The focus ring measures 1.54:1.
- Gold is used as text on white at 2.28:1, in about 135 uses of `text-lca-gold`.
- Status is shown by coloured dots alone, and there is faint white text on navy.
- The five hero JPEGs weigh about 2.1 MB, roughly a whole median mobile page. `.dark` uses stock shadcn greys. No mono font is set, so `Crosstable` falls back to the OS default and prints "3.5" instead of "3½".

**Canvas boards:**
- Base: `Looks-3-Minimal-Tile`, `Looks-3-Minimal-Page`.
- Live: `Looks-7-Broadcast-Tile`, `Looks-7-Broadcast-Page`.
- Scholastic: `Looks-6-Scholastic-Tile`, `Looks-6-Scholastic-Page`.
- Heritage scope: `Looks-1-Heritage-Tile`.
- `Looks-Compare`, `Start-Audit` (the full fix list) and `Start-Principles` (the review checklist).

**User-facing scope**
- One token system. The **base** look comes from Looks-3: navy `#1a2744` ink, white and `#f7f8fa` surfaces, borders `#e5e7ed`, muted text `#5b6478`, ok `#047857`, bad `#c0362c`, gold `#c8a94a` as a fill, gold-ink `#866a1e`.
- A real **dark** mode from the Looks-3 dark palette: `#0b1220` ground, `#111a2c` surface, `#1a2744` raised, ink `#e8ecf4`, muted `#9aa6bf`, gold `#c8a94a`. It is toggleable and respects `prefers-color-scheme`.
- **`[data-theme="live"]`** (Looks-7): `#070b14` ground, `#0e1526` panel, `#1a2744` raised, ink `#f3f5f9`, muted `#8e9ab2`, gold `#c8a94a`, gold-hi `#e5c768`, live `#ff4757` (dark text only, since white on it is only 3.34:1), win `#34d399`, loss `#ff6b6b`, draw `#a7b0c2`.
- **`[data-theme="scholastic"]`** (Looks-6): `#fffaf1` ground, navy ink, and section hues with their tiles:
  - coral `#c2471f` / `#ffe4da`
  - mint `#1f7a55` / `#dcf5e9`
  - sky `#2f6fde` / `#e3eeff`
  - grape `#6a3fc1` / `#eee6ff`
  - gold tile `#fdf1cc`
- **Heritage tokens** (`[data-theme="heritage"]`): paper `#f7f3e8`, card `#fffdf8`, inset `#ece4d0`, ink `#1a2744`, muted `#5e5a52`, hairline `#d8cdb4` (decorative only), field border `#857d6b`, gold-ink `#705718` (`--gold-ink` resolves to this inside the scope and to `#866a1e` in base), baize `#2d5a45`, claret `#8a2b38`. Brand gold is rules, seals and text on navy only (2.05:1 on paper). The 2px radius applies to cards, tables and hero mats; controls keep the base radius. Under `.dark`, heritage keeps type, rules and seal on the Minimal dark grounds. Scopes nest one level only, base-inside-heritage being the one permitted nesting (`ThemeScope scope="base"` around editors and forms); heritage never renders inside live.
- Take the exact values, contrast pairs and component shapes from the tile boards. Where a tile and this list disagree, the tile wins.
- **Typography**:
  - Geist for UI.
  - Geist Mono for chess data in every scope, with tabular figures and ligatures off. It is the only mono face on the site.
  - Instrument Serif as a single display accent in the base look. It never appears inside a heritage scope.
  - Live scope adds Barlow Condensed and Barlow; JetBrains Mono only if the Looks-7 tile requires it.
  - Heritage scope adds Libre Caslon Display 400 (h1 and h2 at 32px and up, and display numerals; never ratings, scores or tables) and Source Serif 4 variable (body at 18px / 1.6 in the readers with a 70ch measure, true small-caps labels with `font-variant-caps: all-small-caps` on labels of 15px or more, lining and tabular figures). The italic face is declared but fetched only when used. Budget ≤ 110 KB woff2, latin subset. A Georgia fallback with `size-adjust` and `ascent-override` keeps CLS under 0.1. If the Fontsource subset lacks `smcp` / `c2sc`, use uppercase at 0.85em with .06–.08em tracking, never synthesised small caps.
  - Scholastic scope adds Baloo 2 and Nunito in WS11, not here.
  - Scope fonts load only inside their scope, through a lazily imported CSS module. All scope token blocks live in `src/index.css`, so a scope switch never flashes base colours.
- **Chess data**:
  - `formatScore` returns "3½".
  - Ratings and scores use tabular figures.
  - New `ResultCell` shows letter, tint and colour marker: hollow ○ for White, filled ● for Black, e.g. "W ○ 17". Never colour alone.
- **Components**:
  - `StatusBadge` always renders a text label. Its tones map to status tokens: open, soon, full/waitlist, closed, live, partner, LCA.
  - Buttons: gold fill with navy text; never white on gold.
  - New `FilterChip` (removable, with count), `DateBlock` (weekday + date), `LcaMark` (one-colour rook-Louisiana SVG, for the header at every width and other tight spaces) and `LcaLogo` (the board-voted full-colour logo, for roomy placements). Decision D1 lists where each one goes.
  - Table primitives with a sticky first column and real `<th scope>`.
  - `PageHero` without any slideshow.
- **Focus ring:** 2 px navy plus a 2 px offset on light grounds and gold on dark or live grounds. It must reach ≥ 3:1 in every scope.
- **Motion:**
  - Delete the auto-advance.
  - Add a global `prefers-reduced-motion` rule that zeroes transitions and animations.
  - Any ticker or rotating element must have a visible pause control.
  - The live tag's dot is static. Nothing pulses.
- **Gold text clean-up:** codemod `text-lca-gold` on light grounds to `text-gold-ink`. Review icons that carry meaning, such as the NewsPage "Pinned" pin and the reminder bell.
- **Image pipeline:**
  - Generate AVIF and WebP at 640/1024/1600 widths for `src/assets/LCA_Slide_*.jpg` and `hero.png`.
  - Serve them through `<picture>` with `sizes`, explicit `width` and `height`, `fetchpriority="high"` on the LCP image and `loading="lazy"` below the fold.
- **Safe previews:** add `[env.preview]` with its own D1 database (`lca-db-preview`) in `wrangler.toml`, plus scripts `db:migrate:preview` and seed. Document it in `README.md`.

**Data model:** none, apart from the preview D1 database.

**API:** none.

**Frontend**
- Change `src/index.css` (tokens, scopes, `.dark`, reduced motion, focus):
  - `src/components/StatusBadge.tsx`
  - `src/components/PageHero.tsx`
  - `src/components/ui/button.tsx`, `src/components/ui/table.tsx`, `src/components/ui/badge.tsx`
  - `src/components/tournaments/Crosstable.tsx` and `StandingsTable.tsx` (mono, ½, colour markers)
  - `src/pages/HomePage.tsx` (remove `HeroSlideshow`)
  - `src/lib/brand.ts`
  - every `text-lca-gold` call site
- New:
  - `src/lib/format.ts`
  - `src/components/ui/filter-chip.tsx`
  - `src/components/DateBlock.tsx`
  - `src/components/LcaMark.tsx` and `src/components/LcaLogo.tsx` (wraps the existing logo file; verify which of `src/assets/lca-logo.webp` and `public/lca-logo.jpg` is current)
  - `src/components/ThemeScope.tsx` (sets `data-theme` and lazily loads scope fonts)
  - `src/components/ResultCell.tsx`
  - `scripts/images.mjs` (sharp-based generator, or `vite-imagetools`)
  - `test/a11y/*.spec.ts` (Playwright + `@axe-core/playwright`)
- New for the heritage scope: `src/styles/themes/heritage.css`, `live.css` (font imports only), `src/layouts/HeritageLayout.tsx` (lazy layout route wrapping `AboutPage`, `BoardPage`, `BylawsPage`, `MinutesPage`, `AnnualMeetingPage` and `ChampionsPage`, with `GovLayout` kept inside), `src/components/ThickThinRule.tsx`, `src/components/Seal.tsx` (SVG built from `LcaMark`), a `.small-caps` utility. `ThemeScope.tsx` accepts `heritage` and `base` (a `data-theme=""` reset, used by `GovernanceDocuments` around its form and `RichTextEditor`).
- The gold-text guard becomes scope-aware: `#c8a94a` is never text on `#f7f3e8` or any light ground, including the phone tab bar; `#705718` is allowed inside heritage and as the About menu's "You are here" label; `#866a1e` is allowed as text at 13px or more on `#fbfaf6` and as the tab bar's current-tab bar. The allowlist is a test fixture.

**Jobs & integrations:** Fontsource packages: `@fontsource-variable/geist-mono`, `@fontsource/instrument-serif`, `@fontsource/barlow-condensed`, `@fontsource/barlow`, `@fontsource/libre-caslon-display`, `@fontsource-variable/source-serif-4`. Verify each package name on npm, and verify the latin subset keeps `smcp` / `c2sc`. `@fontsource-variable/baloo-2` and `@fontsource-variable/nunito` move to WS11. Also Playwright with axe.

**Acceptance criteria**
1. axe reports zero serious or critical violations on `/`, `/tournaments`, a tournament detail page, `/clubs`, `/membership`, `/scholastic`, `/about`, `/governance/minutes` and `/champions` in the light, dark, live and heritage scopes, plus the scholastic token fixture page.
2. A unit test fails if `text-lca-gold` or a raw `#c8a94a` text colour appears in TSX outside an allowlist of navy/dark contexts.
3. The focus ring reaches ≥ 3:1 against its ground in every scope.
4. Nothing on the site auto-advances. With `prefers-reduced-motion: reduce`, no animation runs.
5. Every status is readable without colour: each `StatusBadge` renders its label.
6. Standings and crosstables show "3½", never "3.5", with figures in tabular alignment.
7. The home LCP image is ≤ 200 KB at a 390 px viewport, and Lighthouse mobile performance is ≥ 90 on `/` (lab).
8. Switching `data-theme` on a container swaps tokens with no layout shift.
9. `wrangler pages deploy` on a branch uses `lca-db-preview`, never `lca-db`.
10. The official logo appears in every roomy placement listed under D1 and the rook mark in every placement D1 gives it, including the header at every width. The logo is never recoloured.
11. The heritage font chunk never appears in the `/` network log. CLS on `/about` and `/governance/bylaws` stays under 0.1 across the font swap.
12. A unit test over the route-to-scope map fails if any workspace or admin route resolves to heritage, and a render test mounts `RichTextEditor` and the `GovernanceDocuments` form inside `HeritageLayout` and asserts that the closest `data-theme` above each is `""` (their `ThemeScope scope="base"` boundary), never `heritage`. No Instrument Serif renders inside `[data-theme="heritage"]`, and Caslon is bound only to the `--font-display` token used by h1 and h2 inside the scope.
13. Inside the heritage scope, `Button`, `Input`, `StatusBadge` and the focus ring render pixel-identical to base (visual test).
14. The live tag's dot does not animate.

**Tests:**
- Unit: `format.ts` (scores, dates with weekday across DST, time controls).
- `StatusBadge` label rendering.
- Unit `test/unit/themeScopes.test.ts`: the route-to-scope map (no workspace or admin route is heritage); `--gold-ink` resolves to `#705718` inside heritage and `#866a1e` in base.
- Unit `test/unit/governanceEditors.test.tsx`: `RichTextEditor` and the `GovernanceDocuments` form rendered inside `HeritageLayout` have no heritage ancestor inside their base boundary.
- Unit `test/unit/goldText.test.ts`: the scope-aware gold guard with its allowlist fixture (`#705718` in heritage and the "You are here" label, `#866a1e` at 13px+ on `#fbfaf6` and the tab bar's current-tab bar; `#c8a94a` never text on a light ground).
- a11y `test/a11y/scopes.spec.ts` (Playwright + axe): AC1's pages in light, dark, live and heritage plus the scholastic fixture; CLS under 0.1 on `/about` and `/governance/bylaws` across the font swap; the heritage chunk absent from the `/` network log; the live tag's dot static; `Button`, `Input`, `StatusBadge` and the focus ring pixel-identical inside heritage (visual test).
- Playwright and axe suite (new `npm run test:a11y`).

**Depends on:** nothing. This goes first.
**Risks & open decisions:** Font weight could grow, so keep scope fonts lazy. The codemod needs a human pass on meaningful icons.

---

## WS02 · Information architecture & navigation
**Why:**
- On desktop, a hamburger menu was used 27% of the time against about 50% for visible or combo navigation, was at least 39% slower, and cut discoverability by more than 20% (NN/g).
- Audience-based navigation fails because people choose by task (NN/g, GOV.UK).
- Today, Scanner occupies a top slot while Membership hides under "More", and there is no visible Donate entry point anywhere.

**Canvas boards:**
- `Nav-IA`, structure 1 (task and topic).
- `Nav-Header` H1, with H4's search and H5's event strip.
- `Nav-Mobile` M2 tab bar, with M1's sheet behind Menu and M4's banner and docked event bar.
- `Nav-Footer` F1, with F3's trust line.

**User-facing scope**
- **Desktop (≥ 1024 px):** one navy row, 64px, sticky, with no condensing on scroll (the `--header-h` scroll padding below keeps a focused control clear of it, WCAG 2.4.11). The brand link leads with the rook mark (`LcaMark`, D1) beside the two-line name "Louisiana Chess / Association", with no cream plate; it is always `aria-label="Louisiana Chess Association, home"` and its image is `aria-hidden`. Then **Tournaments · Clubs · Scholastic · News · Membership · About ▾**. "About" opens on click, with a caret. Its items: About LCA, Board & regions, Bylaws & rules, Minutes, Annual meeting, Champions, Contact (the current row: `#f3eedc` tint, title navy 600, "You are here" at 13px/600 in `#705718`); footer row "LCA on Facebook ↗". One label per destination from `nav.ts`: "Board & regions", "Bylaws & rules" and "Minutes" read the same in the header, sheet, footer, trust line and search. A field-shaped **Search** button sits left of the utilities (icon plus the visible word at 1024–1279px; 220px with a ⌘K / Ctrl K hint from 1280px; an `<a href="/search">` underneath). Top right, in this order on every page: **Donate · Log in** (or **My LCA ▾** when signed in) **· Join LCA** (gold). A member whose membership is active sees neither Join LCA nor Renew; once a membership has expired, **Renew** (gold fill, navy text) takes the Join slot. The "Renew membership" to-do inside My LCA may still appear within 30 days of expiry (see the to-do count below). The My LCA trigger carries the to-do count from `src/lib/todo.ts` (accessible name "My LCA, 2 things to do"); the menu holds the to-do items first, then My LCA, the active event line while event mode is on, Family, then Workspace / Admin / Board inbox / My region's clubs by role, then Log out. **When the row is tight** it gives way in a fixed order, measured by a `ResizeObserver` on the row rather than set by breakpoint (in practice from 1024 to 1279px, or wherever Renew and the Live tag both show): first Donate leaves the bar and becomes the About menu's last item, directly above the "LCA on Facebook ↗" footer row (the same `nav.ts` entry); then the two-line name hides, leaving the rook mark. Section padding stays 12px, and the six sections, Search, Log in or My LCA ▾, and Join LCA or Renew never leave the bar. The current section is marked with `aria-current="page"` plus a visible underline. A `--header-h` variable from a `ResizeObserver` over every sticky element in the top stack (`AnnouncementBanner` when sticky, the header, the strip in round states) feeds `scroll-padding-top`; z-order top to bottom is the search panel and menus, the header, the strip, `AnnouncementBanner`. A "Skip to content" link is the first focusable element on every page. Log in links at every width pass `state={{ from }}` to `/login`, which is what `LoginPage.tsx` reads.
- **Tablet (768–1023 px):** the same header component: the rook mark and the two-line name, Tournaments and Clubs visible, Search, a Donate text link, Log in or My LCA ▾ (with the to-do count), and a bordered "Menu" button opening the mobile sheet as a right drawer. No tab bar. The event strip renders as one 48px line: status tag · event name · the viewer's sentence (truncated, full text in `title` and in My LCA) · primary button · the 44×44 Hide button; secondary links and the "Players see:" echo move into My LCA ▾.
- **Phones (< 768 px):** a 56px navy app bar (rook mark and the two-line name; a 44×44 "Search" button to `/search`; the current section name when the Menu tab is current) and a bottom tab bar in `<nav aria-label="Main">`, 56px plus `env(safe-area-inset-bottom)`: **Tournaments · Clubs · Log in / My LCA (to-do count) · Menu**. Labels come from `nav.ts` and always show; the current tab is bold navy with a 3px top bar in gold-ink `#866a1e` and `aria-current="page"`. Menu opens the full-height sheet (sections with the current one expanded as "You are here"; Scoresheet scanner under Tournaments, with "This weekend" and "Results" added only when WS04 and WS10 ship their routes; Donate · Log in · Join LCA in the desktop order, with the same Join and Renew rule; role tools; Facebook · Contact · Website help; the theme switch, a shortcut to the footer's; "Hide event bar until the next update" while event mode is on, writing the same `event:phase:round` key as the bar's Hide button). One `BottomDock` holds the page action bar, the event bar and the tabs, writes `--bottom-chrome-h` from a `ResizeObserver`, and drives `<main>` padding-bottom and `scroll-padding-bottom`. The dock hides while the on-screen keyboard is open, on routes that declare `hideTabBar` (registration, checkout, success, the Stripe hand-off, scanner capture, TV, print), and under 480px of height or at high zoom, where the app bar shows the bordered Menu button instead. The to-do count is computed on the client from `/api/me` (unpaid entries for self or children for events not yet ended; an `active` membership expiring within 30 days or an `expired` one, never `pending`; a US Chess membership ending before an entered event), fetched on load and focus, never polled; volunteer queues and event-day items never count. DOM order: app bar, "Skip to content" link, `<main>`, `BottomDock`, then the portalled sheet. `index.html` gains `viewport-fit=cover`. There is no separate phone flag: `newNav` ships the app bar, tab bar and sheet with the header.
- **Event mode:** a personal strip for LCA-run events only, shown to a signed-in registered player (including waitlisted), the guardian of a registered dependent, the event's TDs and `lca_admin`, from 6 days before day 1 until `eventEnd` + 48 hours, where `eventEnd = (end_date ?? date) 23:59` Central. Phases (`functions/utils/eventMode.ts`): `week`, `dayBefore`, `checkin` (6:00 AM until the day's first `round_schedule` time), `eventDay` (Phase 0 only, the rest of the day: "Today · event · Round 2 at 2:30 PM"), `roundPosted` / `roundInProgress` / `between` (WS07), `final` (`status = 'completed'`, or a non-null result in every section's last scheduled round) and `after` (48 hours; the TD's rating-report line until completed; the admin "not marked completed" nudge is WS07). Light gold tint `#fbf7e9` before the event, during check-in and after the final (scrolls away); `data-theme="live"` tokens with a 2px gold top rule while a round is posted, in progress or between rounds (sticky, Geist type). One line per person: status tag in words · event name · the viewer's own sentence · primary button · secondary links · a 44×44 "Hide until the next update" button. Absolute times, no countdown. TD and admin lines end with "Players see: <the public line>" and may carry one fix-it ("Round times missing: players see 'time to be announced'" → Add round times). Precedence TD > admin > player > guardian; exactly one strip, and with two events the one whose next moment is sooner; the rest in My LCA ▾. Hidden state is keyed `event:phase:round` in `localStorage` inside try/catch, with one label ("Hide until the next update") and one key for the strip, the phone bar and the sheet item, and the event stays listed in My LCA ▾. On a failed poll the strip keeps its last payload and "Updated" time, retries with backoff and hides only after three consecutive failures in a round phase; it never shows an error. A persistent visually hidden `role="status"` node announces state changes only. Buttons: "TD console" on the strip and bar for TDs and admins alike, "Open TD console" on banners, "Open check-in" only when the console deep-links to its check-in step; no "R3"-style shorthand anywhere. On phones the same data renders, from check-in on day 1, as a 56px two-line event bar docked above the tab bar (hidden on that event's own pairings and standings pages) and an in-flow `role="status"` banner inserted only on page load or at the top of the page; otherwise the bar shows a "New" tag and the dock's status node speaks (it stays silent when a banner is inserted). "Something wrong? Tell the TD" opens the support form prefilled with the event and the person's name and email, tagged with the tournament id; no personal email is shown. The public sees no strip: while `/api/live/now` returns an LCA event, the Tournaments nav item carries a text tag "Live" and (WS07, `eventStripLive`) the event's own pairings and standings pages show "Playing today, or is your child? Find your name in the pairings below, or log in to see the board." above the Find-your-name field, for LCA-run events only. It never appears for partner events or on checkout pages. The round-alert bell is hidden until WS07's email alerts exist.
- **Search:** ⌘K / Ctrl+K and the header Search button open a search panel over tournaments (LCA and partner), clubs and regions, pages, news, results (finished LCA events) and champions (title and year only), with a role-gated "Your tools" group for signed-in volunteers and a "Look up a rating on US Chess ↗" row for name-like or ID-like queries. There is no Players group and no person name is ever matched (D9). The "/" shortcut is not bound (WCAG 2.1.4). On phones the button goes to `/search?q=`. The same combobox renders inline on the homepage (WS03). `/search?q=&type=` offers a chip per group in group order (Champions included; Your tools when signed in).
- **Footer (F1):** four columns, every link a `nav.ts` entry by id: Play (Tournaments, Scholastic chess, State champions, Scoresheet scanner; Calendar and Results join when WS04 and WS10 ship their routes) · Community (Clubs, Club map (`/clubs`, the map section), List or update your club (the contact form with the club subject preselected), News, LCA on Facebook ↗) · About LCA (About LCA, Board & regions, Bylaws & rules, Minutes, Annual meeting) · Contact (LouisianaChess@gmail.com as a mailto link, Contact form, Membership help, Website help, Donate). The brand block keeps the official logo, Join LCA and Donate. The base line holds the F3 trust line ("US Chess state affiliate · Louisiana's chess community since 1915 · Bylaws & rules · Minutes · Site last updated <build date>") and the Appearance control ("Appearance: System · Light · Dark", a three-button radio group stored in `localStorage` inside try/catch, default System, the one theme switch that exists at every width). No Privacy or Accessibility links until those static pages exist. Under 768px each column heading becomes `<h2><button aria-expanded aria-controls>` toggling its list; all collapsed by default except Contact; the brand block and base line are always visible; no animation under reduced motion.
- **Routes:** keep every existing URL, including `/governance/*` (the menu label "About" maps onto them) and the `/governance/rules` → `/governance/bylaws` redirect. Add `/search` and `/results` (WS10). Verify the route list in `src/App.tsx`.
- **Under `.dark`** (every value is a WS01 token; nothing is invented in WS02):

| Surface | Light | Dark |
|---|---|---|
| Header, app bar | `#1a2744` | `#1a2744` |
| Tab bar, event bar | white, 1px `#d9d8d1` top border, labels navy, current-tab bar `#866a1e` | `#111a2c`, `rgba(255,255,255,.08)` top border, labels `#9aa6bf`, current `#e8ecf4` with a 3px `#c8a94a` bar |
| Event strip, pre and post states | `#fbf7e9`, navy text, 1px `#866a1e` rule | `#1a2744`, `#e8ecf4` text, 1px `#c8a94a` rule |
| Event strip, round states | live tokens (`#0e1526` / `#f3f5f9`) | unchanged |
| Banner card | white card, border token | `#111a2c`, border token |
| About and My LCA menus, Menu sheet, search panel | `--popover` white, current row `#f3eedc` | `--popover #1a2744`, `#e8ecf4` text, current and active rows `rgba(255,255,255,.1)` plus a 2px `#c8a94a` ring on the active search row |

**Data model:** none.

**API:** Contracts live in `functions/utils/apiTypes.ts` and are imported by both the Worker and `src/lib/api.ts`.
- `GET /api/search?q=` (new, public): `q` of 2–64 characters, normalised (lowercase, NFD with diacritics stripped, "&" → "and", "saint" → "st", whitespace collapsed); bounded `LIKE` queries over `tournaments` (visible; upcoming for the Tournaments group, completed within 3 years for the Results group, never both), `clearinghouse` (upcoming, Louisiana first, then Gulf South with the state), `clubs` (with regions from `regions.ts`), `lca_posts` (published, 24 months) and `state_champions` (title and year, displayed as title and year). Static pages are matched on the client. At most 20 results, 5 per group, edge cache 60 s under the key `search:v1:${normalised}`. The response is identical signed in and out and contains no member, registration, email or player-name fields.

```ts
interface SearchResponse {
  q: string
  groups: Array<{
    type: 'tournaments' | 'clubs' | 'news' | 'results' | 'champions'
    label: string
    items: Array<{
      id: string; title: string; meta?: string; href: string
      tag?: { label: string; tone: 'open' | 'soon' | 'closed' | 'partner' | 'lca' | 'final' }
      external?: boolean
    }>
  }>
}
```

- `GET /api/me/event-mode` (new; `requireAuthedMember`; `Cache-Control: private, no-store`; ETag with 304). Computed by `functions/utils/eventMode.ts` from `registrations`, `members.guardian_id`, `tournament_directors`, `tournaments` and, after WS07, `round_publications` and `live_state`. The client calls it only when `/api/me` shows an involvement inside a window; polls every `pollSeconds` while visible, never while hidden. Or 204.

```ts
type EventPhase =
  | 'week' | 'dayBefore' | 'checkin' | 'eventDay'
  | 'roundPosted' | 'roundInProgress' | 'between' | 'final' | 'after'

interface EventModePlayer {
  memberId: string; firstName: string; section: string; paid: boolean
  waitlistPosition?: number
  bye?: { round: number; points: '½' | '1' | '0' }
  checkedInAt?: string
  board?: number; color?: 'white' | 'black'; opponent?: string; opponentRating?: number
  result?: 'won' | 'lost' | 'draw'; score?: string   // "2½", a string so ½ survives
}

interface EventModeTd {
  registered: number; unpaid: number; waitlisted: number; checkedIn: number
  resultsIn?: number; resultsTotal?: number; missingBoards?: number[]
  fixits: Array<{ code: 'round_times_missing'; text: string; href: string }>
}

interface EventModeItem {
  tournamentId: string; name: string; href: string
  viewer: 'player' | 'guardian' | 'td' | 'admin'
  phase: EventPhase; round?: number; roundsTotal: number
  nextRoundStart?: string   // ISO-8601 with the America/Chicago offset
  updatedAt: string         // same format
  players: EventModePlayer[]   // own entry, or one row per dependent
  td?: EventModeTd
  playersSee: string
  key: string               // `${tournamentId}:${phase}:${round ?? 0}`
}

interface EventModeResponse { items: EventModeItem[]; pollSeconds: 20 | 300 }
```

  `pollSeconds` is 20 in `checkin`, `eventDay`, `roundPosted`, `roundInProgress` and `between`, and 300 otherwise. Phase predicates, Phase 0: `eventEnd = (end_date ?? date) 23:59` Central; `week` = 6 days before day 1 at 6:00 AM until the day before; `dayBefore` = the calendar day before `date`; `checkin` = an event day from 6:00 AM until that day's first `round_schedule` time; `eventDay` = the rest of that day (Phase 0 only); `final` = `status = 'completed'` OR a non-null result in every section's last scheduled round; `after` = `final` until `eventEnd + 48 h`. After WS07: `checkin` ends at the round's `round_publications` row; `roundPosted`, `roundInProgress` and `between` come from `round_publications` and `live_state`; `eventDay` is never produced. Items are sorted so the event whose next moment is sooner comes first; the client renders only the first.
- `GET /api/live/now` (new, WS07; public, edge-cached 30 s): `{ tournamentId: string; name: string; href: string; round: number; roundsTotal: number; publishedAt: string }` or 204. Live while `live_state = 'live'` and the next round in `round_schedule` starts today (America/Chicago); off from the last published round's results-complete time until the next round's day. Drives the `LiveTag`, the Popular list's "Live now" row and the homepage live hero only.
- `GET /api/me` (change): the registrations query also selects `t.end_date, t.registration_url, t.is_visible, t.registration_status`, and `directedTournaments` also selects `end_date, registration_url`. The new fields are documented in the response so the client-side window gate and `todo.ts` can place multi-day events and exclude partner rows.

**Frontend**
- Change: `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, `src/App.tsx`, `index.html`, `functions/api/me.ts` (the four registration fields and two directed-event fields above).
- New: `src/lib/nav.ts` (sections, sheet, tabs with icons, `hideTabBar` routes, pages and synonyms for search), `src/lib/eventModeCopy.ts`, `src/lib/todo.ts`, `src/hooks/useEventMode.ts`, `src/components/layout/SearchTrigger.tsx`, `AboutMenu.tsx`, `MyLcaMenu.tsx`, `EventStrip.tsx`, `LiveTag.tsx`, `MobileAppBar.tsx`, `BottomTabs.tsx`, `BottomDock.tsx`, `MobileMenu.tsx`, `EventDock.tsx`, `EventBanner.tsx`, `src/components/search/SearchCombobox.tsx`, `SearchPanel.tsx`, `SearchResults.tsx`, `src/pages/SearchPage.tsx`, `functions/api/me/event-mode.ts`, `functions/utils/eventMode.ts`, `functions/utils/apiTypes.ts`.
- `AnnouncementBanner` keeps its place above the nav, and the event strip stacks below the header; `--header-h` measures all three when sticky.

**Jobs & integrations:** none.

**Acceptance criteria**
1. At 1024, 1280 and 1440 px the rook mark, all six sections, the Search button (icon plus the word "Search" at 1024 px) and the utilities are visible with nothing overlapping and nothing wrapping: Donate · Log in · Join LCA signed out, Donate · My LCA ▾ for an active member, and Donate · My LCA ▾ · Renew once a membership has expired. Where the row is tight the squeeze runs in order (Donate into the About menu first, then the brand name hides), section padding stays 12px, and no section, Search, Log in or My LCA ▾, Join LCA or Renew ever leaves the bar. The test includes the widest case, Renew plus the Live tag at 1024 px.
2. The About menu works with mouse and keyboard (Enter, Space, Esc, arrow keys), sets `aria-expanded` and closes on an outside click.
3. The mobile sheet opened from the Menu tab traps focus, returns focus to the Menu tab on close, and closes on Esc.
4. The event strip renders only for a signed-in registered player, guardian, TD or `lca_admin` of an LCA-run event inside its window; never for partner events, never for the public, never on checkout pages. Hiding it keys on `event:phase:round`, and a new round brings it back. The public Live tag renders only while `/api/live/now` returns an LCA event. Role-safety tests cover a guardian (own dependents only), a TD of another event, a plain member (204) and partner events (never returned).
5. Search returns grouped results in under 300 ms (p95, warm) for queries of 2 or more characters, can be driven entirely from the keyboard in the panel, the homepage box and `/search`, and never returns a person name.
6. Donate is one click on tablet, and on desktop wherever the row has room for it; when the desktop row is tight it is the About menu's last item, above "LCA on Facebook ↗", one click after opening About. On phones it is the first of the three buttons after the section list in the Menu sheet (two taps). WS12 AC6 is amended to match.
7. The footer shows the contact email and a build-time "Site last updated" date.
8. All nav labels come from `src/lib/nav.ts`; a test asserts the header and sheet render the same sections and every footer link resolves to a `nav.ts` entry (see AC11).
9. No fixed element overlaps `<main>` content at 320, 360, 390, 768 and 1023px with the tab bar, the event bar and the Register bar in every combination; a focused control is never hidden under the header or the dock.
10. Posting a new round while a test page is scrolled mid-page causes no layout shift; the event bar gains a "New" tag and the status region announces once.
11. Every label rendered by the header, sheet, tabs and footer comes from `nav.ts`; the header and sheet render the same six sections in the same order; the first two tabs reuse the Tournaments and Clubs entries unchanged; the footer's links resolve to `nav.ts` entries by id; one label per destination holds across all of them ("Board & regions", "Bylaws & rules", "Minutes"); and the first tab reads "Tournaments".
12. The strip, the event bar and the banner show no countdown, no auto-updating visible text, no pulsing element, and no "R3" or "Bd 6" shorthand.
13. Tab from page load reaches "Skip to content" first; the tab bar is reachable after `<main>`; every footer link is reachable by keyboard at 390px with the folded columns.
14. axe reports zero serious or critical violations in light and dark on `/`, `/tournaments` and `/search` with the event strip and the tab bar mounted.
15. The brand link is named "Louisiana Chess Association, home" at every width, including when the two-line name is hidden.
16. Log in from the tab, the sheet and the desktop header returns the person to the page they were on.

**Tests:**
- Unit `test/unit/eventMode.test.ts`: every phase in Phase 0 and after WS07; midnight, DST, multi-day events, `end_date` NULL; the `checkin` → `eventDay` switch each day; `final` for a completed event, for last-round results without completion, and for a completed event with no results; two events and the sooner-first rule; the `key` format.
- Unit `test/unit/eventModeCopy.test.ts`: every role × phase line in `DESIGN_REPLAN_phase0.md` section 3 verbatim, ½, weekday dates, "7:00 PM", the "Players see:" echo equal to the player line, the button labels, no shorthand.
- Unit `test/unit/todo.test.ts`: one case per `membership_status`, unpaid entries for ended and upcoming events, children, US Chess expiry before an entered event, the "9+" cap.
- Unit `test/unit/nav.test.ts`: one label per destination; header and sheet sections in order; tabs reuse entries; footer links resolve by id; `hideTabBar` routes.
- Unit `test/unit/search.test.ts`: normalisation and the cache key; the synonym table; the name-like and ID-like query rule.
- Integration `test/integration/event-mode.test.ts`: role safety (a guardian sees only own dependents; a TD of another event sees nothing; a plain member, `lca_observer`, `lca_officer` and `lca_auditor` get 204; partner events never returned; TD counts never reach a player); ETag 304; items sorted sooner-first.
- Integration `test/integration/search.test.ts`: grouping and caps, no event in two groups, no member, registration, email or player-name field, champions rows with no name, identical output signed in and out.
- Integration `test/integration/me.test.ts`: the new registration and directed-event fields.
- a11y `test/a11y/nav.spec.ts`: AC1 at three widths, including each squeeze step and Renew plus the Live tag at 1024 px; the Join and Renew slot signed out, for an active member, within 30 days of expiry (no Renew in the bar) and once expired; Donate as the About menu's last item when squeezed; About menu by keyboard; sheet focus trap; skip link first; brand link name with the name hidden and shown; axe light and dark on `/`, `/tournaments` and `/search` with the strip and tab bar mounted; footer links by keyboard at 390px and the fold's `aria-expanded`.
- a11y `test/a11y/dock.spec.ts`: no fixed element overlaps `<main>` at 320, 360, 390, 768 and 1023px with every bar combination; no layout shift when a round is posted mid-scroll, "New" tag and a single announcement; the dock hides with the keyboard open and on `hideTabBar` routes; the landscape reflow fallback.

**Depends on:** WS01. `eventStrip` (week, day before, check-in, event day, final and after states) can ship in Phase 0 on today's data; `final` is `status = 'completed'` or a non-null result in every section's last scheduled round. `eventStripLive` and `liveMarker` stay off until WS07 provides `round_publications`, `live_state` and `/api/live/now`.
**Risks & open decisions:** moving Scanner out of the top bar should be confirmed with usage data if available; the Nav-IA board recommends a quick first-click test with parents. The search index must stay small.

---

## WS03 · Homepage
**Why:** a homepage must:
- say who you are,
- give the top three or four tasks a clear start,
- show real, dated content,
- keep motion to a minimum (NN/g).

Carousels draw about 1% of clicks, mostly on slide 1, and the current slideshow fails WCAG 2.2.2. The site already has the live data to be useful every day: events, club meetings and results.

**Canvas boards:**
- `Home-A`: structure and hero.
- `Home-C`: this-week strip (kept for WS09, K's October 8 note).
- `Home-E`: doors band.
- `Home-D`: champions band and recap card.
- `Home-B`: search, now the box in the identity and search band.
- `Home-Phones`: the phone layout (the block order now follows K's October 8 order below, not the board's).

**User-facing scope** (in page order, K's October 8 order, the same on desktop and phones)
1. **Hero ladder**, picked by data on the server in this order, first match wins (full table in `DESIGN_REPLAN_phase0.md` section 4, with the quiet and clubs rungs as amended in its section 8): **Live** (WS07; live colour tokens on the hero only, no live fonts on `/`; round row in words, never "R3") · **Event day** (today is between an LCA event's `date` and `eventEnd`) · **Register, last call** (an `isOpen` or `isClosedOnline` LCA event starts within 14 days or early entry ends within 7) · **Results** (an LCA event with `eventEnd` within 7 days, `status = 'completed'` and a non-null result in every section's last scheduled round, else fall through; Heritage accent, winners by full name with ½; WS10's `event_results` once it exists) · **Register** (within 30 days or early entry within 14; Home-A's card with the primary by state: Register when `isOpen`, Join the waitlist when `isFull`, Event details when `isClosedOnline`, and a "You're entered" variant) · **Announced** (`isAnnounced`, within 60 days; "Email me when registration opens" signed in, Event details signed out) · **Week** (WS09) · **This week in Louisiana** (LCA and partner rows within 14 days, Louisiana only; partner rows only while the sync is fresh, LCA rows always) · **Quiet** (the hero itself carries Home-E's three doors on the usual navy hero ground with the a–h / 8–1 grid motif, headed "Find your next game in Louisiana", with the Next LCA event line beneath and the region select; the soonest Louisiana events are in the upcoming six further down; primary: Find a club near you) · **Clubs** (the floor when nothing matches or `/api/home` fails: the same doors hero, with the seven region chips from `regions.ts` in place of the select; primary: Find a club). In these two rungs the doors band lower on the page is omitted, so the doors never appear twice; every other rung keeps the doors band in its lower position. The doors' links are plain links, never a second primary. Registration state comes from `isOpen`, `isFull`, `isClosedOnline` and `isAnnounced` in `functions/utils/events.ts` (`DESIGN_REPLAN_phase0.md` section 2, Q4), one unit test each. Exactly one primary action per mode. Every non-LCA mode ends with a "Next LCA event" line when one is announced within 180 days ("Registration open ›", "Registration opens Fri, Jan 15 ›" or "Details ›"). Partner rows carry "Partner event · Registers on the organizer's site ↗", never Register, never a count, never the LCA hall photo; a single `EventAction` component enforces this, and any `tournaments` row with a `registration_url` counts as organizer-registered; the "Also this weekend" partner line links to the organizer's site until WS04 ships the internal partner page. Personal lines are added on the client: "You're entered" and "You finished 4th" from `/api/me`, boards and colours from `useEventMode()`. While `/api/home` loads the hero reserves 360px at 390px and 440px at 1280px with a neutral skeleton; if it fails, the hero renders the Clubs floor from `regions.ts` with no error chrome. Below the hero in every mode is the **identity and search band**: the official logo, "Louisiana's chess community since 1915 · 300+ members · 25+ clubs · 7 regions" (each stat a link), a CSS thick–thin rule, and the Home-B search box (the WS02 combobox inline, visible label, quick-pick chips hidden until WS04 and WS09 ship their filters).
2. **This-week strip** (Home-C): Mon–Sun day chips with meeting counts, today highlighted, and the weekend's tournaments (LCA and partner, labelled). It is computed from WS09 schedules; a tap opens `/clubs?view=week`. Flagged off (`homeWeek`) until WS09 ships club schedules; when it ships it sits directly under the identity and search band. K wants this clubs view kept for when the club information is richer.
3. **News:** three latest items, dated, plus the compact `FacebookFeed`.
4. **Doors band** (Home-E), headed "Where do you want to start?": three doors, "I want to play", "My child plays" and "I run a club or tournament". Each has three links into shared pages, using pre-filtered URLs such as `/tournaments?type=scholastic`. It is a band, not navigation, and sits below the fold. In the quiet and clubs rungs the hero carries the three doors instead (item 1) and this band is omitted.
5. **Upcoming tournaments:** the next six as dated rows, with LCA / Partner tags, status in words and counts on LCA rows only. Links to `/tournaments`.
6. **Results & champions** (Home-D): the "Current champions" band ships in Phase 0 from `state_champions` with the Heritage accent, hidden when the newest title is more than 13 months old. The recap card waits for WS10.
7. **Membership band:** Adult $15 · Scholastic $5 · Family $25 · Senior $10, then **Join LCA**.

Removed: `HeroSlideshow` and the three equal columns.

**Data model:** none of its own. It consumes WS04, WS07, WS09 and WS10.

**API:** `GET /api/home` (new, public). Its contract is `HomeResponse` in `functions/utils/apiTypes.ts`:

```ts
interface HeroEvent {
  id: string; name: string; href: string; city: string
  date: string; endDate?: string; dates: string   // "Sat–Sun, Jun 12–13"
  organizer?: string; format?: string; sections?: string[]
  tag: 'lca' | 'partner'; external?: boolean         // partner rows: organizer's site, new tab
}
interface LiveHero { mode: 'live'; event: HeroEvent; round: number; roundsTotal: number; publishedAt: string; nextRoundStart?: string
  rounds: Array<{ round: number; state: 'final' | 'live' | 'scheduled'; startsAt?: string }> }
interface EventDayHero { mode: 'eventDay'; event: HeroEvent; nextRound?: { round: number; startsAt: string } }
interface RegisterHero { mode: 'register' | 'lastCall'; event: HeroEvent
  registration: 'open' | 'full' | 'closedOnline'
  priceFrom?: number; memberSaving?: number; registered?: number; maxPlayers?: number
  earlyDeadline?: string; checkIn?: string; round1?: string; startsIn?: string; alsoThisWeekend?: HeroEvent }
interface ResultsHero { mode: 'results'; event: HeroEvent; isStateChampionship: boolean
  winners: Array<{ section: string; names: string[]; score: string }>; moreSections: number
  facebookHref: string; recapHref?: string; photosHref?: string }
interface AnnouncedHero { mode: 'announced'; event: HeroEvent; registrationOpensAt?: string; alsoThisWeekend?: HeroEvent }
interface WeekHero { mode: 'week'; range: string; meetings: number; clubs: number
  tonight: Array<{ time: string; club: string; place: string; href: string }>; weekend: HeroEvent[] }
interface NearbyHero { mode: 'nearby'; heading: 'This weekend in Louisiana' | 'Coming up in Louisiana'; events: HeroEvent[] }
interface QuietHero { mode: 'quiet'; regions: Array<{ slug: string; name: string }> }   // doors are static; events stay in upcoming
interface ClubsHero { mode: 'clubs'; regions: Array<{ slug: string; name: string }> }
interface NextLca { event: HeroEvent; status: 'open' | 'opensAt' | 'details'; opensAt?: string }

interface HomeResponse {
  hero: (LiveHero | EventDayHero | RegisterHero | ResultsHero | AnnouncedHero | WeekHero | NearbyHero | QuietHero | ClubsHero)
    & { reason: string; nextLca?: NextLca }
  week: WeekHero | null                       // WS09
  upcoming: HeroEvent[]                       // Louisiana only in Phase 0, hero events excluded
  recap: { title: string; href: string; date: string } | null   // WS10
  champions: Array<{ year: number; title: string; name: string }> | null
  news: Array<{ id: string; title: string; date: string; href: string }>
}
```

No field in `HomeResponse` is personal. Mode selection is `selectHeroMode(now, data)` in `functions/utils/homeHero.ts`, in America/Chicago time, with the window constants `LAST_CALL_DAYS = 14`, `LAST_CALL_EARLY_DAYS = 7`, `REGISTER_DAYS = 30`, `REGISTER_EARLY_DAYS = 14`, `RESULTS_DAYS = 7`, `ANNOUNCED_DAYS = 60`, `NEARBY_DAYS = 14`, `NEXT_LCA_DAYS = 180`, `SYNC_STALE_DAYS = 3`. Events come from `functions/utils/events.ts` (the LCA + clearinghouse union moved out of `functions/api/clearinghouse.ts`). Partner rows are dropped when the newest `synced_at` is more than 3 days old or the start date has passed, and an admin alert is raised; LCA rows never depend on the sync. `eventEnd(t) = (t.end_date ?? t.date) 23:59` Central anchors every window. Edge cache 60 s, dropping to 15 s in the live and event-day modes. Every block degrades to `null` when its source isn't built yet.

**Frontend**
- Rewrite: `src/pages/HomePage.tsx`.
- New: `src/components/home/HomeHero.tsx` (one subcomponent per mode, each with a skeleton at the reserved height), `HeroEventCard.tsx` (lca, partner, compact), `NextLcaCard.tsx`, `EventAction.tsx`, `IdentitySearchBand.tsx`, `ThisWeekStrip.tsx`, `UpcomingList.tsx` (`excludeIds`), `DoorsBand.tsx` (`variant="band"` lower on the page; `variant="hero"` on the navy hero ground in the quiet and clubs rungs), `RecapCard.tsx`, `ChampionsBand.tsx`, `MembershipBand.tsx`, `src/lib/addToCalendar.ts`, `functions/utils/homeHero.ts`, `functions/utils/events.ts` (with `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`), `functions/api/home.ts`. The hero photo is `src/assets/LCA_Slide_1.jpg` through the WS01 pipeline, alt "Players at long tables in a tournament hall", unless K supplies another.
- Reuse: `FacebookFeed variant="compact"`, `StatusBadge`, `DateBlock`, `ThickThinRule`, `Seal`, `RegistrationReminderButton`, `SearchCombobox`.

**Jobs & integrations:** none.

**Acceptance criteria**
1. Mode selection is unit-tested for every rung, at every window boundary, for ties (earliest event), at midnight and across DST, for `end_date` NULL, for a stale sync with an LCA row in range, for a closed-online and an announced LCA event inside 30 days, for a completed event with no results, and for a last round finishing after midnight. A mode missing its data falls to the next rung, and no mode renders an empty frame.
2. Nothing auto-advances, and the hero has exactly one primary action.
3. Every date shows its weekday and every status is in words.
4. Partner events never show Register buttons or counts in any mode; a partner-only fixture renders no "Register" text and no count. Out-of-state events never take the hero.
5. On a 390 px phone, as on desktop, the order is hero, identity and search band, news, doors, upcoming, results and champions, membership (K's October 8 order), with the this-week strip directly under the identity and search band once WS09 ships. In the quiet and clubs rungs the doors render inside the hero and the doors band is omitted; nothing else is hidden by hero mode.
6. LCP ≤ 2.5 s and CLS < 0.1 (lab, mobile).
7. If WS07, WS09 or WS10 data is missing, those blocks are absent; no empty frames or placeholder text reach production. Partner rows are absent when the clearinghouse sync is more than 3 days old.
8. The live hero has a visible "Pause updates" control, polls every 20 s only while the tab is visible, and shows "Updated hh:mm".
9. Personal lines ("You're entered", "Board 6 · White", "You finished 4th") never appear in the cached `/api/home` response.
10. The heritage font chunk never loads on `/`.
11. The live font chunk never appears in the `/` network log, in any mode, including the live hero.
12. While `/api/home` loads, the hero holds its reserved height and CLS stays under 0.1; when the request fails, the Clubs floor renders with no error text, and the lower blocks keep their error states.
13. The live hero's round row and every strip, bar and banner line carry no "R3"-style shorthand; the round row reads in words with every label in the DOM.
14. The inline search box opens its list only on click or Tab focus, never on page load, and the open list never shifts the page.
15. The three doors render exactly once on the page in every rung: inside the hero in the quiet and clubs rungs (including the fetch-failure Clubs floor), and in the doors band in every other rung. The doors hero keeps exactly one primary action.

**Tests:**
- Unit `test/unit/homeHero.test.ts`: every rung and boundary from AC1, ties, the Next LCA line's three statuses, the "Also this weekend" line, the registration-state primary per rung.
- Unit `test/unit/events.test.ts`: `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`, one case per clause.
- Integration `test/integration/home.test.ts`: a partner-only fixture renders no "Register" text and no count; no personal field; `null` blocks for unbuilt sources; cache headers per mode; out-of-state rows never in the hero; the Results rung with a completed, resultless event falls through.
- a11y and visual `test/a11y/home.spec.ts` (Playwright): a snapshot of each mode at 390 and 1280px; the page order at 390 and 1280px; the doors rendered once in every mode, inside the hero for quiet and clubs; the heritage and live font chunks absent from the `/` network log; the skeleton height and CLS; the fetch-failure Clubs floor; Pause updates in the live hero; the inline search overlay's open and focus rules.

**Depends on:** WS01 and WS02. The strip needs WS09 and is flagged off until then (`homeWeek`). Live mode needs WS07 (`homeLive`). The results hero (`homeResults`) and the Champions band (`homeChampions`) ship in Phase 0 from existing standings and `state_champions`; only the recap card waits for WS10 (`homeRecap`). WS03 no longer waits for WS04: it builds `functions/utils/events.ts`, which WS04 adopts.
**Risks & open decisions:** the hero is thin between LCA events; that is exactly why the ladder's lower rungs (this week in Louisiana, quiet with the doors, clubs) exist, and why the week view returns with WS09. Review the windows after one season using hero clicks per mode.

---

## WS04 · Event discovery & sharing
**Why:**
- For finding dates across month breaks, a dated list beat a month grid (Hund, Dowell & Mueller 2014), so the calendar should navigate the list, not replace it.
- Applied filters belong in removable chips with a result count, and filter state belongs in the URL (Baymard, NN/g).
- A count line such as Luma's "N going" answers "should I hurry?".
- NC gives every clearinghouse event an internal page.
- Chess67's pages preview as "Loading…" on Facebook.
- K asked for chips, counts and link previews.

**Canvas boards:**
- `Tourn-A` is the default view.
- `Tourn-C` is the calendar view.
- `Tourn-D` is the map view.
- `Tourn-E` is the table view.
- `Tourn-B` provides the preview pane on wide screens.
- `Tourn-Phones` covers phone layouts.
- `Event-E` is the partner page.

**User-facing scope**
- **One list, many views.** `/tournaments?view=agenda|calendar|map|table`, with agenda as the default.
  - **Agenda:** month-grouped rows, each with a date block, name, city, type, sections, status in words, "X of Y registered" with a fill bar and the next deadline on LCA rows. Partner rows are lighter and say where entry happens.
  - **Calendar:** a season strip with counts split into LCA and partner events, a clean Monday-first month grid beside a week-grouped agenda, multi-day events drawn as one bar, today marked, and tapping a day scrolling the list.
  - **Map:** `LCAMap`, with filled pins for LCA events, hollow pins for partners, clusters, and a list kept in sync. Distance from a city or ZIP is optional and comes later.
  - **Table:** sortable, with Date and Event frozen, mini bars for entries, and saved views for signed-in users.
- **Filter chips,** one row: When (This weekend · Next 30 days · month) · Type (Classical · Quick · Blitz · Scholastic) · Where (Louisiana · Gulf South · region) · Rated · Source (LCA-run · Partner). Applied chips are removable and show a live count ("11 events"). All state lives in the URL, so back and forward restore it. On phones the chips open a bottom sheet with "Show 11 events".
- **Preview pane** (≥ 1280 px, agenda view): selecting a row opens a sticky pane with the facts, sections and fees, and the Register button or "Register on organizer site ↗".
- **Partner pages** at `/tournaments/p/:slug` (Event-E):
  - a facts card using the feed's fields: organizer, city/state, venue, rating system, eligibility, contact
  - one gold exit, "Register on organizer site ↗"
  - the source line "Listed from the Gulf South Tournament Clearinghouse · updated <date>"
  - a map
  - "Also near <city>"
  - "Report a problem with this listing", which creates a support ticket
- **Sharing:** server-rendered OG and Twitter meta (title, a date line with weekday, city, entries, image) on `/tournaments/:id`, `/tournaments/p/:slug`, `/clubs/:id` and `/news/:slug`, plus a generated preview image.
- **Calendar feeds:** a "Subscribe" link (`webcal://`) for the current filters and "Add to calendar" for each event.
- **JSON-LD:** `Event` markup on both detail page types (eventStatus, location, organizer, offers for LCA events).
- **Alerts:** keep today's "Notify me when registration opens" (`tournament_reminders`, `functions/api/tournaments/[id]/remind.ts`). Add saved searches: "Email me when new events match these filters" (weekly).
- This replaces the `FEATURES.tournamentQuickFilters` and `FEATURES.externalTags` stubs with the real chips and source tags.

**Data model**
```sql
-- 00xx_event_discovery.sql
ALTER TABLE clearinghouse ADD COLUMN slug TEXT;          -- verify: existing columns first; backfill, then unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_clearinghouse_slug ON clearinghouse(slug);
ALTER TABLE clearinghouse ADD COLUMN last_seen_at TEXT;
ALTER TABLE tournaments ADD COLUMN slug TEXT;             -- verify: tournaments may already have one
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  query_json TEXT NOT NULL,          -- the URL filter state
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly')),
  last_sent_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**API**
- `GET /api/events` (new, public): accepts `from`, `to`, `type`, `state`, `region`, `rated` and `source` filters. It merges the two sources into one shape, `{id, source:'lca'|'partner', slug, name, start_date, end_date, city, state, venue, type, rating_system, eligibility, organizer, status, registered_count?, capacity?, next_price_change?, external_url?}`. Counts and prices appear only for `lca` rows. Edge cache 60 s.
- `GET /api/events/partner/:slug` (new, public).
- `GET /api/calendar.ics` with the same filters, plus `GET /api/tournaments/:id/calendar.ics` (new).
- `GET`, `POST` and `DELETE /api/me/saved-searches` (new; `requireAuthedMember`).
- `GET /og/tournament/:id.png` and `/og/club/:id.png` (new): generated images.

**Share previews (how)**
- Add `functions/_middleware.ts` (new), or per-route functions, that fetches `index.html` from `env.ASSETS` and injects the `<meta>` tags with `HTMLRewriter` for crawler user agents and all requests. The HTML stays identical for users.
- Generate images with a Workers-compatible renderer. If bundle limits bite, render at publish time and store the PNG in R2.
- Verify: `functions/utils/linkPreview.ts` already exists. Read it first and reuse or extend it if it builds preview metadata.

**Frontend**
- Change:
  - `src/pages/TournamentsPage.tsx` (split into view components)
  - `src/components/tournaments/MiniCalendar.tsx` and `AgendaList.tsx` (replace or refactor)
  - `src/lib/clearinghouse.ts`, `src/lib/api.ts`
- New:
  - `src/components/events/EventRow.tsx`, `FilterChips.tsx`, `FilterSheet.tsx`, `ViewSwitcher.tsx`, `CalendarNavigator.tsx`, `EventsMap.tsx`, `EventsTable.tsx`, `PreviewPane.tsx`
  - `src/pages/PartnerEventPage.tsx`
  - `src/lib/eventFilters.ts` (URL ↔ state)

**Jobs & integrations**
- `workers/clearinghouse-sync` keeps `slug` and `last_seen_at` up to date and flags rows that vanish from the feed.
- The weekly saved-search email goes through `workers/daily-emails` (Monday run).
- Google Geocoding (cached) is optional, for map pins on partner events that lack coordinates.

**Acceptance criteria**
1. `/tournaments` opens in agenda view, grouped by month, with weekday dates. Every filter change updates the URL, and back/forward restores the view.
2. Applied filters show as removable chips with an accurate count. "Clear all" restores the full list.
3. Calendar view:
   - tapping a day scrolls the agenda
   - multi-day events render as one bar
   - the grid works with arrow keys and has a text alternative
4. Map pins and list rows stay in sync with filters, and selecting either one highlights the other.
5. No partner event shows an LCA Register button or counts. Every clearinghouse row has an internal page, and its exit link opens the organizer's site (`rel="noopener"`).
6. The Facebook Sharing Debugger shows the title, the weekday date line, the city and an image for a tournament URL, with no "Loading…".
7. The `.ics` subscription imports into Google Calendar and Apple Calendar and picks up new events on refresh.
8. JSON-LD passes Google's Rich Results Test for both detail types.

**Tests:**
- Integration: `/api/events` (merge, filters, no counts on partner rows).
- Integration: `.ics` output, and middleware HTML containing meta tags.
- Unit: `eventFilters` round-trip.
- Extend `public-feed.test.ts`.

**Depends on:** WS01 and WS02.
**Risks & open decisions:** OG image rendering may exceed Pages Functions size limits; the fallback is images pre-rendered into R2. Drive-time estimates need a routing API, so they're deferred.

---

## WS05 · Event page template & lifecycle
**Why:**
- On phones, the Register card currently renders after the entire player list.
- US Chess-style shorthand ("TLA") confuses newcomers.
- Information missing at the moment of decision causes abandonment (Baymard).
- The same page has to serve three moments: before an event, during it, and after.

**Canvas boards:**
- `Event-A`: the standard template.
- `Event-C`: the lifecycle states.
- `Event-B`: the championship layout.
- `Event-D`: the festival layout.
- `Event-Phones`: the phone layout.

**User-facing scope**
- **Template (Event-A):**
  - Title, dates with weekdays, city.
  - **Fact tiles in plain language:** "US Chess rated" · "5 rounds" · "G/90+30 · 90 min each + 30 sec per move" · "½-point byes available" · "Check-in closes 9:30 AM".
  - **Sticky registration card** (desktop, right column): price today, early/regular/late ladder with dates, member price, "38 of 60 registered", **Register** and **Register my family** (WS06).
  - **Sections grid:** rating band, current fee and the date of the next increase, a fullness bar ("12 of 16"), and eligibility in plain words.
  - **Schedule:** rounds with weekday and time.
  - **Prizes:** "based on N entries".
  - **Who's coming:** sorted by rating, with section counts and full names (D3).
  - **Venue:** map, plus parking and access notes.
  - **"Good to know" strip:** rules, byes, refunds, US Chess membership requirement, what to bring.
  - Organizer and TD, share, and add to calendar.
- **Phones:** content order is title, facts, price and Register, sections & fees, schedule, prizes, entries, venue, rules. A **sticky bottom bar** ("From $40 · Register") opens the registration sheet; once registered it changes to "Registered · Change section or byes". Padding keeps it from covering content.
- **Lifecycle (Event-C), computed automatically from dates and live state:**
  - *Before:* the registration focus.
  - *During:* round status, My board, Pairings and Standings tabs (WS07).
  - *After:* final standings, prize winners, recap link, crosstable and photos (WS10).
  - A TD override (`display_state`) covers late sections and edge cases.
- **Layouts:**
  - `standard` (Event-A).
  - `championship` (Event-B): banner with a countdown and "23 of 160 registered"; sticky tabs (Overview · Sections & prizes · Entries · Pairings · Standings · Hotel & travel · Past champions) addressed by URL hash; side events; and the annual business meeting notice for the State Championship.
  - `festival` (Event-D): a parent event grouping child tournaments (Open + Scholastic + Friday Blitz) under one microsite with a day-by-day schedule and one shared Register button that opens per-event choices.

**Data model**
```sql
-- 00xx_event_page.sql  (verify each column is not already present)
ALTER TABLE tournaments ADD COLUMN layout TEXT NOT NULL DEFAULT 'standard' CHECK (layout IN ('standard','championship','festival'));
ALTER TABLE tournaments ADD COLUMN display_state TEXT NOT NULL DEFAULT 'auto' CHECK (display_state IN ('auto','before','during','after'));
ALTER TABLE tournaments ADD COLUMN parent_event_id INTEGER REFERENCES tournaments(id);
ALTER TABLE tournaments ADD COLUMN venue_notes TEXT;
ALTER TABLE tournaments ADD COLUMN good_to_know_json TEXT;
ALTER TABLE tournaments ADD COLUMN travel_json TEXT;            -- hotel block, parking, meeting room (championship)
ALTER TABLE tournaments ADD COLUMN public_minor_names TEXT NOT NULL DEFAULT 'full' CHECK (public_minor_names IN ('full','initial'));   -- 'initial' only for a minors-only roster (D3)
```
Existing fields to reuse are `round_schedule` (JSON), `time_control`, `registration_status`, `registration_closes_at`, `is_visible`, `end_date`, the section, entry-fee and prize-fund data (verify: where sections live, a JSON column or a separate table) and the pricing inputs read by `functions/utils/pricing.ts`.

**API**
- Extend `GET /api/tournaments/[id]` (`functions/api/tournaments/[id].ts`) with these computed fields:
  - `state` (before/during/after)
  - per-section `registered` / `capacity` / `fee_now` / `next_fee_change`
  - `entries` (full names unless the event is set to `initial`, D3)
  - `parent` / `children` for festivals
- Admin writes go through the existing `functions/api/admin/tournaments/[id].ts`, using the dirty-diff PATCH pattern from the TournamentManagePage redesign, with `requireTournamentManager`.

**Frontend**
- Change: `src/pages/TournamentDetailPage.tsx`, splitting it into components.
- Reuse: `PrizeWinners`, `PreviewBanner`, `RegistrationReminderButton`, `StatusBadge`.
- New: `src/components/event/FactTiles.tsx`, `RegistrationCard.tsx`, `MobileRegisterBar.tsx`, `SectionsGrid.tsx`, `ScheduleList.tsx`, `PrizeTable.tsx`, `EntriesList.tsx`, `VenueBlock.tsx`, `GoodToKnow.tsx`, `ChampionshipTabs.tsx`, `FestivalSchedule.tsx`, `LifecycleSwitch.tsx`.

**Jobs & integrations:** none new.

**Acceptance criteria**
1. At 390 px, the price and a Register control are visible without scrolling past the entries list, and the sticky bar never hides content.
2. Every time control shows its plain-language companion.
3. Section cards show "N of cap" and the date of the next price change when one is set.
4. Public entries show full names by default. When an event is set to `initial` (a minors-only roster), minors show as first name + last initial publicly, while TD, admin and US Chess report views keep full names.
5. The state switches automatically from before to during to after, and the TD override wins.
6. Championship tabs are deep-linkable (`#entries`) and keyboard accessible.
7. JSON-LD and OG meta (WS04) are present on every event page.

**Tests:**
- Unit: state computation, fee ladder and next-change logic.
- Integration: the `public_minor_names` setting (full by default, initials when set).
- Extend `lifecycle.test.ts`.

**Depends on:** WS01, WS04 (share meta), WS06 (the sheet opened by Register) and WS07 (the during state).
**Risks & open decisions:** TDs have to enter more data per event (caps, price dates, venue notes); WS08's setup checklist makes this a one-page job.

---

## WS06 · Registration & households
**Why:** Baymard puts average checkout abandonment at about 70%:
- Unexpected extra costs cause 40% of it.
- Forced account creation causes 18% (24% in Baymard's 2022 survey).
- The average checkout has 11.3 fields where 8 are enough.

GOV.UK's pattern is to ask eligibility first, end with "check your answers", and confirm with "what happens next". One checkout for a whole family is LCA's edge over KingRegistration. A parent registering children without logins is a real need K has named.

**Canvas boards:**
- `Reg-C`: household checkout, the core model.
- `Reg-A`: in-card flow on desktop.
- `Reg-B`: one question per screen on phones.
- `Reg-D`: guest entry.
- `Account-B`: the family parts.

**User-facing scope**
- **Household model:** a guardian member plus dependents who have no logins. Build on today's children (`functions/api/me/children.ts`, `children/[id].ts`, `functions/utils/family.ts`, `src/components/family/FamilyRegistrationPanel.tsx`, `FamilyCard.tsx`). Verify how children are stored before designing anything new. A second guardian can come later.
- **One registration engine, three presentations:** the in-card flow on the event page (desktop), a full-height sheet (phones), and the household page `/tournaments/:id/register` (families).
- **Steps:**
  1. **Who's playing:** me, saved dependents, add a child (first and last name, optional US Chess ID), or someone else (guest).
  2. **Section, per player:**
     - Only eligible sections are selectable, using `sectionRules.ts`, ratings and playing-up rules.
     - Eligibility is a checkbox ("In 8th grade or below?"). A "Which section fits me?" helper is available.
  3. **Byes:** checkboxes per round, up to rounds − 1, respecting the half-point bye rules.
  4. **US Chess:**
     - Inline lookup (`uscf/lookup`) autofills name, rating and expiry.
     - If the membership expires before the event: "Your US Chess membership ends Nov 30, before this event. Renew →".
  5. **LCA membership (optional add-on):** shows the household math (Family $25 vs individual tiers, WS12).
  6. **Check your answers:** every line plus the full total, with member discounts. The price shown is the price paid, with no separate card-fee line (D2).
  7. **Pay:** Stripe Checkout in the same tab.
  8. **Confirmation:**
     - What happens next: check-in time, add to calendar, a manage link, how to request a bye change.
     - Receipts per player.
- **Guest entry (Reg-D):**
  - No account needed, at most 8 fields, and a US Chess ID autofill.
  - The manage link is emailed with a signed token.
  - After payment: "Save these details — create an account", prefilled.
- **Waitlist:**
  - When a section is full, join the waitlist.
  - When a spot opens, the next person gets a claim link valid for 24 hours. If it expires, the offer moves to the next person automatically.
- **Holds:** starting checkout holds the seats for 15 minutes so they can't be oversold.
- **Duplicate guard:** the same US Chess ID or name in the same event and section.
- **No financial questions (D5):** LCA doesn't run fee waivers or ask about need or lunch status. Drop the lunch-status discount shown on the Event-A and Schol-A boards.
- **Refunds:** per player, even when several players were paid in one order.

**Data model**
```sql
-- 00xx_registration_orders.sql  (verify registrations' current columns first: bye requests, waitlist, check-in, withdrawn_at exist)
CREATE TABLE registration_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  payer_member_id TEXT REFERENCES members(id),      -- null for guests
  payer_email TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','refunded','partially_refunded')),
  subtotal_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL,   -- all-in pricing, no card-fee line (D2)
  hold_expires_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE registrations ADD COLUMN order_id INTEGER REFERENCES registration_orders(id);
ALTER TABLE registrations ADD COLUMN player_kind TEXT CHECK (player_kind IN ('member','dependent','guest'));
ALTER TABLE registrations ADD COLUMN guest_name TEXT;
ALTER TABLE registrations ADD COLUMN guest_email TEXT;
ALTER TABLE registrations ADD COLUMN eligibility_json TEXT;   -- e.g. {"grade_8_or_below": true}
CREATE TABLE waitlist_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL REFERENCES registrations(id),
  offered_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','expired'))
);
```
If today's children aren't representable as dependents, add a `dependents` table (`id`, `guardian_member_id`, `first_name`, `last_name`, `uscf_id`, `created_at`) and migrate existing rows. Prefer extending the current model.

**API**
- `POST /api/registrations/orders` (new): creates an order plus held registrations. Verify `functions/api/registrations/batch.ts` first; it likely already handles family batches, so extend it rather than duplicate it.
- `POST /api/registrations/orders/:id/checkout` (new): creates a Stripe Checkout Session with one line item per player and `metadata.order_id`.
- `functions/api/stripe/webhook.ts`: handles `checkout.session.completed` for orders. It must be idempotent and mark every registration in the order paid.
- `GET /api/registrations/manage/:token` and `POST .../withdraw` (new; signed token): guest self-service.
- `POST /api/registrations/:id/waitlist-claim/:token` (new).
- `POST /api/admin/registrations/:id/refund` (new; `requireTournamentManager`): refunds one line.
- `GET /api/uscf/lookup` (existing): reused inline.

**Frontend**
- Change:
  - `src/pages/RegisterPage.tsx`
  - `src/components/family/FamilyRegistrationPanel.tsx`, `FamilyCard.tsx`
  - `src/components/uscf/UscfSearchInput.tsx`, `UsChessMembership.tsx`
  - `src/lib/pricing.ts`, `src/lib/family.ts`
- New: `src/components/registration/RegistrationFlow.tsx` (the engine), `WhoStep.tsx`, `SectionStep.tsx`, `ByesStep.tsx`, `UsChessStep.tsx`, `MembershipAddOn.tsx`, `ReviewStep.tsx`, `ConfirmStep.tsx`, `RegistrationSheet.tsx`.

**Jobs & integrations**
- Stripe Checkout and refunds.
- Resend for receipts, manage links and waitlist offers. Reuse `functions/utils/registrationEmails.ts` and the branded email layout.
- A cron in `daily-emails`, or a short-interval job, expires holds and waitlist offers.

**Acceptance criteria**
1. A guardian registers herself and two dependents in different sections with one payment. The result is three registrations under one order, and replaying the webhook changes nothing.
2. Only eligible sections can be selected. Eligibility is asked as a checkbox, never as a grade or birthdate.
3. The total on "Check your answers" equals the amount Stripe charges, and no card-fee line appears anywhere (D2).
4. A guest completes registration in 8 fields or fewer, receives a manage link, and can withdraw.
5. A US Chess membership that expires before the event is flagged inline with a renewal link.
6. Waitlist offers expire after 24 hours and move to the next person automatically.
7. Holds release after 15 minutes. Under concurrent checkouts a section is never oversold (race test).
8. A partial refund of one player in a three-player order succeeds, and the order shows `partially_refunded`.

**Tests:**
- Extend `test/integration/family.test.ts` and `registration-rules.test.ts`.
- New `orders.test.ts` (holds, oversell race, webhook idempotency, partial refund).
- New `waitlist.test.ts` and `guest.test.ts`.
- Role-safety cases for the refund endpoint.

**Depends on:** WS01 and WS05.
**Risks & open decisions:**
- D2: with all-in pricing LCA absorbs Stripe's card fee. If that matters, nudge entry fees up rather than adding a fee line.
- Stripe Checkout supports per-line refunds only through the PaymentIntent and amount, so store the per-line amounts.

---

## WS07 · Live mode (pairings, standings, My board, alerts, TV, print)
**Why:**
- At the venue, players check pairings on phones in a crowd. The evidence calls for:
  - find-my-name
  - the player's own game pinned
  - an "updated N minutes ago" time
  - bigger text on demand
  - real tables with a frozen Player column
  - results as letter plus colour
- QR posters replaced piles of printouts in Chess67's Campbell story.
- Today, `Crosstable` prints "3.5" and marks colour with a faint 10px "w/b".

**Canvas boards:**
- `Live-A`: My board on phones, follows, alerts.
- `Live-B`: pairings page.
- `Live-C`: standings and crosstable.
- `Live-D`: hall TV.
- `Live-E`: print and QR kit.

**User-facing scope**
- **Pairings** (`/tournaments/:id/pairings`):
  - round tabs and section chips with counts
  - type-to-find with a highlighted row, plus a "Your game" card pinned when signed in
  - views by board or A–Z
  - a text-size toggle
  - "Updated 2 min ago" and a "Round 3 pairings are ready" banner
  - byes spelled out ("H · ½-point bye", "U · not paired")
  - links to print and QR
- **Standings and crosstable** (`/tournaments/:id/standings`): one place-ordered table, as on Live-C.
  - Columns: Place, Player (frozen), Rating, Score (½), round cells, tiebreaks, Prize.
  - Round cells read like "W ○ 17": result letter, tint, then a hollow ○ for White or a filled ● for Black, then the opponent's number. Tapping a cell jumps to that opponent.
  - Tiebreaks are labelled with US Chess names (Modified Median, Solkoff, Cumulative, Cumulative of Opposition), with a legend.
  - Phones get a column chooser and a player card.
  - Result codes: W/L/D, H (half-point bye), B (full-point bye), U (unplayed), X/F (forfeit win/loss).
- **My board and My players:** a pinned card with board, colour, opponent and rating, start time and "updated" time. A follow star on any player feeds a "My players" strip. A parent's dependents are followed automatically.
- **Round-ready alerts:**
  - When the TD publishes a round (WS08), opted-in players, guardians and followers get an email through Resend.
  - Web Push comes in Phase 5.
  - Text messages are out of scope for now (D8). Each text costs money and US business texting needs carrier registration, while email and web push are free.
- **Hall TV** (`/tournaments/:id/tv`):
  - built for 1080p
  - two big pairing columns per section, cycling sections every 15 seconds
  - the round start time and a countdown
  - a QR code to the phone view
  - the live theme
- **Print and QR kit:** extends `TournamentPrintPage` with:
  - a hall poster with a QR code and short link
  - pairings A–Z and by board
  - standings
  - a wall chart or crosstable
  - a one-page final report

  All Letter size, with QR codes generated in the browser.
- **Results reporting (D6):** the event's TDs enter results through the WS08 console. LCA admins can do anything a TD can on any event (pair, enter or correct results, publish) as a backstop. Player reporting with opponent confirmation can be piloted later.
- **Theme:** live surfaces use `data-theme="live"`, with a "Night" toggle remembered per device.

**Data model**
```sql
-- 00xx_live_mode.sql  (verify tournament_games columns: round, board, white/black registration ids, result)
ALTER TABLE tournaments ADD COLUMN live_state TEXT NOT NULL DEFAULT 'idle' CHECK (live_state IN ('idle','live','finished'));
ALTER TABLE tournaments ADD COLUMN current_round INTEGER;
CREATE TABLE round_publications (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id), round INTEGER NOT NULL, section TEXT NOT NULL,
  published_at TEXT NOT NULL, published_by TEXT REFERENCES members(id), version INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (tournament_id, round, section)
);
CREATE TABLE follows (
  member_id TEXT NOT NULL REFERENCES members(id),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('player','club','event')),
  target_key TEXT NOT NULL,          -- uscf id / registration id / club id / tournament id
  created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (member_id, target_kind, target_key)
);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'email',
  member_id TEXT, email TEXT, dedupe_key TEXT UNIQUE, payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')), sent_at TEXT
);
-- Phase 5: push_subscriptions (member_id, endpoint, p256dh, auth, created_at)
```

**API**
- `GET /api/tournaments/:id/live` (new, public): compact pairings, standings and progress plus a `version`. Returns an `ETag` and honours `If-None-Match` with 304. Edge cache 10 seconds.
- `GET /api/live/now` (new; contract in WS02): feeds the public "Live" tag on Tournaments (WS02) and the homepage live hero (WS03). The personal event strip reads `/api/me/event-mode`, not this endpoint.
- `GET /api/tournaments/:id/pairings?round=&section=` and `/standings`: verify whether these exist today, under `tournaments/[id]` or as part of `TournamentPairingsPage`'s data source, and extend rather than duplicate.
- `GET`, `POST` and `DELETE /api/me/follows` (new).
- The publish endpoint lives in WS08.

**Transport (D7):** in plain terms, each open pairings page quietly asks the server "anything new?" every 20 seconds. Clients poll `/live` every 20 seconds while the page is visible and stop when it's hidden (Page Visibility API). If D1 load ever becomes a problem, upgrade to a Durable Object per event broadcasting over WebSocket.

**Frontend**
- Change:
  - `src/pages/TournamentPairingsPage.tsx`, `src/pages/TournamentPrintPage.tsx`
  - `src/components/tournaments/Crosstable.tsx`, `StandingsTable.tsx`: merge into one combined table component.
  - `PrizeWinners.tsx`
- New:
  - `src/pages/TournamentStandingsPage.tsx`, `src/pages/TournamentTvPage.tsx`
  - `src/components/live/RoundTabs.tsx`, `SectionChips.tsx`, `FindMyName.tsx`, `MyBoardCard.tsx`, `MyPlayersStrip.tsx`, `LiveStatus.tsx`, `ResultsTable.tsx`, `ColumnChooser.tsx`, `QrCode.tsx`
  - `src/hooks/useLivePoll.ts`

**Jobs & integrations**
- The notifications sender gets an outbox processor. Choose either:
  - a `*/5 * * * *` cron added to `workers/daily-emails`, keeping its per-phase isolation and mark-only-on-success pattern, or
  - a new `workers/notifications`.
- At publish time, send immediately with `context.waitUntil` and let the cron retry failures.
- Resend handles delivery.

**Acceptance criteria**
1. For 100 players in 5 sections, the pairings page loads in under 1.5 seconds on simulated 4G and reflects a newly published round within 30 seconds, without a reload.
2. Typing 3 letters of a name highlights and scrolls to that row. Signed-in players see "Your game" pinned.
3. Standings show ½ glyphs, labelled tiebreaks with a legend, and colour markers that don't rely on colour alone.
4. Publishing a round enqueues exactly one email per opted-in recipient (dedupe key `round:{id}:{n}:{member}`). Failed sends retry up to 3 times.
5. The TV page is readable from 3 m (body text 28 px or larger), cycles through sections, and its QR code opens the phone view.
6. Every print sheet fits on Letter at 100% and its QR code scans.
7. The live theme applies only inside live surfaces.
8. `/live` answers 304 when nothing has changed, and hidden tabs send no requests.

**Tests:**
- Unit: the results table formatter (½, codes, colour markers, tiebreak labels).
- Integration:
  - `/live` ETag/304 behaviour
  - publish → outbox → sender with idempotency
  - follows
- Extend `pairing-flow.test.ts`.

**Depends on:** WS01, WS05, WS08 (publish).
**Risks & open decisions:**
- Resend volume and plan limits.
- D6–D8 are settled; see section 5.
- TDs must publish on the site, so pilot at one LCA event first.

---

## WS08 · Director & admin tools (TD console, setup checklist, admin home & queues)
**Why:**
- At the venue, directors work on laptops and tablets. Their priorities are speed at check-in, pairing, results entry, publishing and printing.
- Today's `TournamentManagePage` has 5 tabs and about 11 cards, and its tables need 640–840px, so they scroll sideways on a tablet.
- Admin tabs were added one after another. K chose an admin-only `/admin` with a grouped sidebar, plus a separate `/workspace` for club reps, TDs and auditors.

**Canvas boards:**
- `Work-A`: TD console.
- `Work-D`: setup checklist.
- `Work-C`: admin home and queues.

**User-facing scope**
- **TD event-day console** (`/workspace/tournaments/:id/live`), tablet-first:
  - A status band with the event, round and countdown.
  - A round rail: Check-in · R1…Rn · Prizes · Rating report.
  - A "Next step" card, e.g. "Round 3: 11 of 13 results in → Enter results".
  - **Check-in:** search, big buttons, counts by section, late arrivals and byes, and QR check-in from the member card (WS12).
  - **Pair next round:** runs the existing engine in `functions/utils/swiss/` and shows a preview before anything is published.
  - **Results grid:** board list with W/D/L/F buttons, keyboard entry, undo, and visible conflicts when two devices edit the same board (server wins and the diff is shown).
  - **Publish round:** a "notify players" toggle, connected to WS07.
  - **Print/QR:** links to the WS07 kit.
  - **Announcements:** a banner on the event page, with an optional email.
  - **Offline tolerance:** a queue of pending writes with retry and a visible "offline · 3 changes waiting" badge.
  - **Admin backstop (D6):** LCA admins can open any event's console and do everything its TDs can, so an event never stalls if a TD can't.
- **Setup checklist** (`/workspace/tournaments/new` and `/:id/setup`): one page that refactors or replaces `TournamentWizard`, with these steps:
  - Basics.
  - Sections, with presets: Open/U1800/U1400/U1000, or K–12/K–8/K–5/K–3.
  - Fee ladder: early/regular/late plus a member discount, shown as a timeline with a preview of the price on any date.
  - Schedule, with checks for overlapping rounds and for finishing before the venue closes.
  - Byes and rules, using `SectionRulesEditor`.
  - Prizes, using `PrizesEditor`.
  - Venue and "good to know".
  - Directors.
  - Publish, with a full preview and the share-preview card (WS04).
  - **Clone from last year:** copies sections, fees and text, and shifts dates by a year onto the same weekday.
- **Admin home** (`/admin`, admin-only):
  - A grouped sidebar: Needs attention · Members · Tournaments · Clubs · Content · Board · Email · Site · Audit.
  - One merged **Needs attention** queue drawing on:
    - open support tickets
    - board inbox tickets
    - pending approvals: club-run tournaments, champion submissions
    - failed emails: campaign recipients and the notifications outbox
    - club listing reports (WS09)
  - Each row shows owner, waiting time and quick actions. Admins can assign and reassign.
  - The existing tools stay but move under the groups: group email, site banner, members table/export, board seats, champions, posts, audit log and impersonation.

**Data model**
```sql
-- 00xx_admin_queue.sql
CREATE TABLE queue_assignments (
  item_kind TEXT NOT NULL CHECK (item_kind IN ('support','board_ticket','approval','email_failure','club_report')),
  item_id TEXT NOT NULL, assignee_member_id TEXT REFERENCES members(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (item_kind, item_id)
);
ALTER TABLE tournaments ADD COLUMN cloned_from_id INTEGER REFERENCES tournaments(id);
-- verify: check-in timestamp already exists on registrations (checked_in_at) — reuse it
```

**API**
- `GET /api/admin/queue` (new; `requireAdminView`): aggregates the five sources into one list.
- `POST /api/admin/queue/assign` (new; `requireAdmin`).
- `POST /api/admin/tournaments/:id/rounds/:n/pair` and `.../publish`. Verify the existing pairing and round endpoints under `functions/api/admin/tournaments/[id]/` and `functions/utils/tournament-manage.ts`, then extend them.
- `POST /api/admin/tournaments/:id/checkin`: takes a registration id or a signed member-card token.
- `POST /api/admin/tournaments/:id/clone` (new).
- All of these use `requireTournamentManager` or `requireAdmin` as appropriate, and every write goes through `functions/utils/audit.ts`.

**Frontend**
- Change:
  - `src/pages/TournamentManagePage.tsx`: split into the setup checklist and the live console.
  - `src/components/admin/TournamentWizard.tsx`: becomes the setup checklist.
  - `src/components/tournaments/ResultsEntry.tsx`, `SectionRulesEditor.tsx`, `PrizesEditor.tsx`, `UsChessUploadPanel.tsx`.
  - `src/pages/AdminPage.tsx`: sidebar and queue.
  - `src/pages/WorkspacePage.tsx`.
- New:
  - `src/components/workspace/ConsoleStatusBand.tsx`, `RoundRail.tsx`, `NextStepCard.tsx`, `CheckInList.tsx`, `QrCheckIn.tsx`, `ResultsGrid.tsx`, `PublishRoundDialog.tsx`, `OfflineQueue.tsx`
  - `src/components/admin/AdminSidebar.tsx`, `NeedsAttentionQueue.tsx`

**Jobs & integrations:** QR scanning through the camera, using `BarcodeDetector` with a JS fallback library.

**Acceptance criteria**
1. The console works at 1024×768 without horizontal scrolling, and every tap target is at least 44 px.
2. Checking in any of 100 players takes at most 2 taps from search. QR check-in marks the correct registration and rejects forged or expired tokens.
3. Publishing a round makes the pairings public and enqueues alerts exactly once.
4. Results entry supports keyboard and undo, and shows a conflict when two devices edit the same board.
5. Cloning produces an event that matches last year's sections and fees, with dates on the same weekdays.
6. The admin queue shows items from all five sources with owner and age. Assigning an item updates it immediately and writes an audit entry.
7. An LCA admin who isn't a TD of the event can pair, enter results and publish rounds on it (D6).

**Tests:**
- Integration:
  - queue aggregation and assignment
  - pair/publish
  - check-in by token
  - clone
- Extend `role-safety.test.ts` and `directors.test.ts`.

**Depends on:** WS01, WS05, WS06, WS07. QR check-in also needs WS12.
**Risks & open decisions:**
- Offline editing on two tablets needs conflict rules; keep it simple, with server-wins and a visible diff.
- With only 2–3 admins, the owner column may go unused; it's still worth it for accountability.

---

## WS09 · Clubs as living listings
**Why:**
- With the map beside the list, 95% of testers used it. On list-only sites, 65% never found the map (Baymard).
- 7 of the 25 clubs show no schedule today.
- NC's freshness loop puts "when they meet" first, then a "last confirmed" stamp and a "report outdated info" link.
- parkrun answers a newcomer's two questions first: when, and what happens on a first visit.
- For most Louisiana clubs, their LCA page is their only web presence.

**Canvas boards:**
- `Clubs-A` (default directory); `Clubs-B` (this-week view); `Clubs-C` (regions as filter and group headers).
- `Clubs-Phones`.
- `Club-A` (visit-first page); `Club-C` (compact fallback); `Club-B` (branding).
- `Work-B` (club rep workspace).

**User-facing scope**
- **Structured schedules.** These patterns must be supported:
  - weekly, on one or more days with start and end times
  - nth weekday of the month (Bluebonnet: 1st & 3rd Sunday; Morgan City: 1st, 3rd & 5th Tuesday; Picayune: quick-rated on the 1st Monday)
  - monthly
  - seasonal (Beauregard Parish Youth: Wednesdays in summer)
  - "schedule not listed"

  Exceptions cover cancelled, moved and one-off extra meetings. All times are America/Chicago (`src/lib/lcaTime.ts`, `functions/utils/time.ts`). Seed all 25 clubs from today's club data.
- **Directory (Clubs-A).** Shows the list and map side by side, with lettered pins linked to rows.
  - Each row leads with *when*: "Tonight 7:00 PM", or the next date.
  - Then come name, venue and tags (Rated · Casual · Kids welcome · Free).
  - Filters by day, region and "Good for" act on the list and the pins together.
  - "Confirmed Sep 2026" stamps sit on each row; "Report outdated info" sits on each row and on the club page.
  - Rows sort by next meeting, and clubs without a schedule sink to the end.
- **This-week view (Clubs-B).** A statewide Mon–Sun timetable with days as columns, a Tonight panel and region pills with counts. The WS03 homepage strip uses the same data.
- **Regions (Clubs-C).** Regions are a filter and group headers. All 25 clubs now have a region (Appendix C); K corrects any that are off.
- **Club page.**
  - Club-A content: the next meeting as the headline; where it is, with a map and access notes; cost; time control in plain words; a "Your first visit" box; contact (routed, no personal emails shown); the club's events; club news; photos; **Follow**; **Add to calendar** (an .ics file with RRULEs).
  - Club-C fallback: when fewer than four key facts exist, the page switches to the compact profile with "Help us complete this listing".
  - Club-B branding: a club colour band (`clubColors.ts`) and the logo from R2.
- **Freshness loop.**
  - Each club has a `last_confirmed_at`.
  - Club reps get a monthly one-tap email: "Still accurate" / "Update". It uses a signed link with no login needed and expires after 30 days.
  - Visitor reports go to the rep and into the admin queue.
  - After 90 days without confirmation, the club shows a "Not confirmed recently" badge.
- **Tonight switch.** The rep sets tonight as on, moved or cancelled. It updates the club page and emails followers.
- **Club rep workspace** (`/workspace/clubs/:id`, Work-B):
  - freshness card, structured schedule editor and the Tonight switch
  - club news (exists today)
  - club tournaments (behind `FEATURES.clubTournaments`)
  - a members list, showing names only; renewal status needs board approval (privacy)

**Data model**
```sql
-- 00xx_club_schedules.sql
CREATE TABLE club_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, club_id INTEGER NOT NULL REFERENCES clubs(id),
  kind TEXT NOT NULL CHECK (kind IN ('weekly','monthly_nth','monthly_date','seasonal_weekly')),
  weekdays TEXT,              -- 'MO,TH'
  nth TEXT,                   -- '1,3,5' (monthly_nth)
  month_day INTEGER,          -- monthly_date
  start_time TEXT NOT NULL,   -- 'HH:MM' local
  end_time TEXT,
  valid_from TEXT, valid_to TEXT,   -- seasonal ranges (MM-DD or dates)
  label TEXT,                 -- 'Rated night', 'Casual'
  venue_override TEXT, notes TEXT
);
CREATE TABLE club_schedule_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, club_id INTEGER NOT NULL REFERENCES clubs(id),
  date TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('cancelled','moved','extra')),
  new_start TEXT, new_end TEXT, new_venue TEXT, note TEXT,
  created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE club_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, club_id INTEGER NOT NULL REFERENCES clubs(id),
  reporter_email TEXT, field TEXT, message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by TEXT REFERENCES members(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE clubs ADD COLUMN last_confirmed_at TEXT;
ALTER TABLE clubs ADD COLUMN schedule_status TEXT NOT NULL DEFAULT 'listed' CHECK (schedule_status IN ('listed','not_listed'));
ALTER TABLE clubs ADD COLUMN first_visit_text TEXT;
ALTER TABLE clubs ADD COLUMN access_notes TEXT;
ALTER TABLE clubs ADD COLUMN cost_text TEXT;
ALTER TABLE clubs ADD COLUMN good_for_json TEXT;     -- ["kids","rated","casual","free"]
-- clubs.region exists (migration 0012) but is blank in live data → apply Appendix C (club_regions.sql) first
```

**API**
- `GET /api/clubs` (extend `functions/api/clubs.ts`): add `next_meeting`, a schedule summary, `last_confirmed_at` and `good_for`.
- `GET /api/clubs/this-week` (new): occurrences for the next 7 days, with exceptions applied. Edge cache 5 minutes.
- `GET /api/clubs/:id/calendar.ics` (new).
- `POST /api/clubs/:id/reports` (new; public, rate-limited).
- Workspace endpoints (all `requireClubRep`, scoped to the rep's own club):
  - `PUT /api/admin/clubs/:id/schedules`
  - `POST /api/admin/clubs/:id/exceptions`
  - `POST /api/admin/clubs/:id/tonight`
- `GET /api/clubs/confirm/:token` (new; signed): one-tap confirm, which sets `last_confirmed_at`.

**Frontend**
- Change:
  - `src/pages/ClubsPage.tsx`, `ClubDetailPage.tsx`, `ManageClubPage.tsx`, `AdminClubPage.tsx`
  - `src/components/maps/LCAMap.tsx` (pin ↔ row linking, letter labels)
  - `src/lib/regions.ts`, `clubMapData.ts`
- New:
  - `src/lib/clubSchedule.ts`: occurrence expansion, mirrored in `functions/utils/clubSchedule.ts`, with one shared test fixture set
  - `src/components/clubs/` components: `ClubRow.tsx`, `ThisWeekGrid.tsx`, `TonightPanel.tsx`, `ScheduleEditor.tsx`, `FirstVisitBox.tsx`, `FreshnessBadge.tsx`, `ReportOutdatedDialog.tsx`, `CompactProfile.tsx`, `TonightSwitch.tsx`

**Jobs & integrations** (in `workers/daily-emails`): monthly confirm emails, 90-day stale detection with a notice to the admin queue, and follower emails when the Tonight switch changes (through the WS07 outbox).

**Acceptance criteria**
1. All 25 clubs have either structured schedules or an explicit "not listed". Occurrence expansion is correct for:
   - Morgan City's 5th-Tuesday months
   - Bluebonnet's 1st and 3rd Sundays
   - Picayune's 1st-Monday quick-rated night
   - seasonal ranges
   - the 2026–27 DST changes
2. "Tonight" is computed correctly in America/Chicago around midnight.
3. Map pins mirror the filtered list, and selecting a row highlights its pin and the reverse.
4. A club with fewer than four key facts renders the compact profile with the suggestion form.
5. The confirm link updates `last_confirmed_at` without a login and rejects expired or forged tokens.
6. A visitor report creates an item visible to that club's rep and in the admin queue.
7. The per-club `.ics` imports with correct RRULEs.

**Tests**
- Unit: `clubSchedule` with real club fixtures and DST edges.
- Integration: this-week, reports, confirm and Tonight switch.
- Extend `club-permissions.test.ts`.

**Depends on:** WS01, WS02, and Appendix C's region assignment.
**Risks & open decisions:** volunteer engagement, so the one-tap email has to do the work; entering all 25 schedules, so seed them in the migration.

---

## WS10 · Results archive, champions, news & recaps
**Why:**
- Recaps with named winners turn events into community stories, and champions and history give people a reason to share the site.
- For chronological feeds, rows scan faster than cards (NN/g), and every item needs a date.
- The site already computes standings. It just doesn't keep them as history.

**Canvas boards:**
- `News-A`: the feature + list base.
- `News-C`: the digest and RSS ideas.
- `News-D`: the recap template.
- `About-D`: champions and heritage.
- `Live-C`: the archive view.

**User-facing scope**
- **Finalize → archive:** when a TD finalizes an event (WS08), the site snapshots final standings per section into `event_results`: place, player, pre-event rating (and post-event once US Chess publishes it), score, tiebreaks and prize. Snapshots are immutable; an admin correction is audited.
- **Results index** (`/results`): past LCA events, filterable by year and type. Each event links to its standings, crosstable and recap.
- **No player pages (D9):** LCA is community-focused, not player-focused. Results live on event pages, the results index, recaps and the champions page, with names shown in full (D3) and not linked to profiles.
- **Champions:**
  - `state_champions` (migration 0049) links each title to the event it was won at, when that event is in the archive.
  - The honour roll is grouped by title, with "Show all N years".
  - A reigning-champions band appears on the homepage (WS03).
  - The `About-D` timeline covers Morphy's birth in 1837, the 1857 First American Chess Congress, the 1858 Opera Game, and LCA's founding in 1915.
- **Recap drafts:** finalizing an event creates a draft post: a headline suggestion, section winner cards, a standings snippet, links to the crosstable and the US Chess report, photo slots and a "key game" slot (a PGN from WS15, or pasted). A TD or editor finishes it and publishes. A photo consent checkbox must be ticked, and a take-down contact is shown on the post.
- **News page (News-A):**
  - A featured story.
  - Pinned items with an expiry date.
  - Dated rows grouped by month, with category chips and counts (Results · Announcements · From the clubs · Scholastic · Board).
  - "From our Facebook page" (existing `FacebookFeed`).
  - The merged "From the clubs" feed (`club_news`), which is switched off today, comes back on with club colour dots.
- **Digest and RSS:** an opt-in weekly email (new results, upcoming events, club news) with one-click unsubscribe, and `/news/rss.xml`.

**Data model**
```sql
-- 00xx_results_archive.sql
CREATE TABLE event_results (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id), section TEXT NOT NULL, place INTEGER NOT NULL,
  registration_id INTEGER REFERENCES registrations(id), player_name TEXT NOT NULL, uscf_id TEXT,
  rating_pre INTEGER, rating_post INTEGER, score_halves INTEGER NOT NULL, tiebreaks_json TEXT,
  prize_cents INTEGER, prize_label TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tournament_id, section, place, player_name)
);
ALTER TABLE tournaments ADD COLUMN finalized_at TEXT;
ALTER TABLE state_champions ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id);   -- verify the table's shape first
ALTER TABLE lca_posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'news' CHECK (kind IN ('news','recap','announcement'));
ALTER TABLE lca_posts ADD COLUMN tournament_id INTEGER REFERENCES tournaments(id);
ALTER TABLE lca_posts ADD COLUMN pinned_until TEXT;
ALTER TABLE lca_posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lca_posts ADD COLUMN photo_consent INTEGER NOT NULL DEFAULT 0;
CREATE TABLE digest_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT REFERENCES members(id), email TEXT NOT NULL UNIQUE,
  frequency TEXT NOT NULL DEFAULT 'weekly', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- verify: lca_posts' existing columns (pinned flag may already exist) and state_champions' shape before altering
```

**API**
- `POST /api/admin/tournaments/:id/finalize` (new; `requireTournamentManager`): writes the snapshot and the draft recap.
- `GET /api/results`, `GET /api/results/:tournamentId` (new).
- `GET /api/champions` (exists; extend with links to archived event results).
- `GET /api/news` (exists; extend with kinds, pinned, featured and the merged club feed).
- `GET /news/rss.xml` (new function).
- `POST /api/digest/subscribe` and `GET /api/digest/unsubscribe/:token` (new).

**Frontend**
- Change:
  - `src/pages/NewsPage.tsx`, `NewsPostPage.tsx`, `ChampionsPage.tsx`
  - `src/components/admin/PostsPanel.tsx` (recap editor), `ChampionsPanel.tsx`
  - `src/components/FacebookFeed.tsx` (rail variant)
- New:
  - `src/pages/ResultsPage.tsx`, `ResultsEventPage.tsx`
  - `src/components/news/FeaturedStory.tsx`, `NewsRow.tsx`, `PinnedItems.tsx`, `CategoryChips.tsx`, `RecapEditor.tsx`, `WinnerCards.tsx`

**Jobs & integrations:**
- A weekly digest send in `workers/daily-emails`.
- Optionally, a nightly job that backfills `rating_post` from US Chess once official ratings appear, rate-limited.

**Acceptance criteria**
1. Finalizing an event creates an immutable snapshot and a draft recap with the winners filled in. Running finalize twice does nothing.
2. No player profile pages exist (D9); names in results and recaps are plain text, in full (D3).
3. Champions show the reigning holders and a full honour roll with "Show all N years". Each title links to its archived event results when they exist.
4. News shows pinned items until they expire, filters by category, and dates every row.
5. The RSS feed validates, and unsubscribing from the digest takes one click.
6. A recap can't be published with photos until the consent box is ticked.

**Tests**
- Integration: finalize/snapshot idempotency, RSS and the digest token.
- Unit: recap draft generation.

**Depends on:** WS01, WS07, WS08 (finalize button).
**Risks & open decisions:** digitising historical champion records is volunteer work; photos of minors need the consent routine.

---

## WS11 · Scholastic hub & series
**Why:** Scholastic families are LCA's biggest group of newcomers. Most of them aren't chess players, and most are on phones. Peers walk families through a first tournament:
- grade-band sections
- a safeguarding link
- a first-year discount

(New South Wales, Virginia, Ireland, England.) No Gulf South peer does this. Jargon needs explaining inline, and the site should say plainly how little it collects about children.

**Canvas boards:** `Schol-A` (first-tournament guide) · `Schol-C` (hub) · `Schol-B` (pathway and series, later) · `Schol-Phones` · `Looks-6-*` (theme).

**User-facing scope**
- **Hub** (`/scholastic`, Schol-C):
  - An audience switch: Parents · Coaches · Schools.
  - Upcoming scholastic events, LCA and partner, with an iCal link.
    - Real feed events include the New Orleans Youth Chess meets (Nov 14, Dec 5, Mar 20, and the May 8 Grand Prix Final), the SWLA Regional (Apr 17, 2027), the Ken Ferguson Memorial Scholastic (Jan 17, 2027) and the LCA State Scholastic (April).
  - A youth program finder (map + list) covering Knight Light Chess, Strategic Thoughts NOLA, Metairie Chess Academy, Beauregard Parish Youth Chess, Pineville Homeschool Chess Club, and clubs tagged "Kids welcome".
  - Resources for coaches and schools.
  - Scholastic state champions.
- **First tournament guide** (`/scholastic/first-tournament`, Schol-A):
  - A tournament-day timeline from check-in to awards. When opened from an event, it uses that event's real times.
  - A what-to-bring checklist.
  - A glossary with inline definitions: G/30+5, section, bye, rated, touch-move, notation.
  - Sections by grade band and what each costs.
  - **"What we collect about your child":** first and last name, an optional US Chess ID, and eligibility confirmations. Nothing else.
  - A FAQ.
- **Team and coach entries** (later in Phase 3):
  1. A coach role registers a team: players plus sections.
  2. Each parent gets a confirmation link and confirms, then pays or marks it "school pays" (invoice).
  3. Players whose parents haven't confirmed are not registered.
- **Pathway and series** (Schol-B, Phase 5):
  - A staircase: club night → first meet → NOLA Youth Chess Grand Prix → State Scholastic → Nationals.
  - Its rungs list the real upcoming events.
  - Series standings are computed from `event_results` (WS10). Partner-run meets count only when organizers run them in LCA's tools or upload final standings.
- **Theme:** `data-theme="scholastic"` covers all of `/scholastic/*` and the scholastic event layout.

**Data model**
```sql
-- 00xx_scholastic.sql
ALTER TABLE clubs ADD COLUMN kind TEXT NOT NULL DEFAULT 'club' CHECK (kind IN ('club','youth_program'));   -- programs live beside clubs
CREATE TABLE team_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
  coach_member_id TEXT NOT NULL REFERENCES members(id), school_name TEXT NOT NULL,
  payment_mode TEXT NOT NULL DEFAULT 'parents' CHECK (payment_mode IN ('parents','school_invoice')),
  status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE registrations ADD COLUMN team_entry_id INTEGER REFERENCES team_entries(id);
-- Phase 5:
CREATE TABLE series (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, season TEXT NOT NULL, scoring_json TEXT NOT NULL);
CREATE TABLE series_events (series_id INTEGER NOT NULL REFERENCES series(id), tournament_id INTEGER REFERENCES tournaments(id),
  clearinghouse_slug TEXT, PRIMARY KEY (series_id, tournament_id, clearinghouse_slug));
```
Add a `coach` role to `src/lib/roles.ts` and to the server-side role checks, after verifying how roles are stored (`members.role` and its CHECK constraint).

**API**
- `GET /api/scholastic` (new): events, programs and champions in one response.
- `POST /api/teams` (new; coach).
- `POST /api/teams/:id/confirm/:token` (new; parent, signed token).
- `GET /api/series/:id/standings` (Phase 5).

**Frontend**
- Change: `src/pages/ScholasticPage.tsx`, which becomes the hub.
- New: `src/pages/FirstTournamentPage.tsx` and `src/components/scholastic/AudienceSwitch.tsx`, `DayTimeline.tsx`, `WhatToBring.tsx`, `Glossary.tsx`, `ProgramFinder.tsx`, `TeamEntryForm.tsx`, `SeriesStandings.tsx`.

**Jobs & integrations:** Resend handles parent confirmations and reminders.

**Acceptance criteria**
1. The guide is readable at 390 px, and glossary terms open inline without leaving the page.
2. The "What we collect" list matches the registration form's fields exactly. A test compares the two.
3. The program finder filters by region and day, and its map and list stay in sync.
4. The scholastic theme applies only under `/scholastic/*` and on scholastic event layouts.
5. Team entry registers no player until that player's parent has confirmed through the signed link.

**Tests**
- Integration: team entry and parent confirmation, role-safety for the coach role, and the field-list guard.
- Unit (Phase 5): series scoring.

**Depends on:** WS01, WS04, WS06 and WS09. The series also needs WS10.
**Risks & open decisions:** partner organizers have to cooperate for series points. A new coach role means more volunteer support.

---

## WS12 · Membership, giving & digital card
**Why:** Membership tiers depend on who you are, not on upgrading:
- Family ($25) equals Adult plus two Scholastic, so it only saves money with three children.
- Only 4% of nonprofit sites say where donations go (NN/g), and today there is no visible Donate link anywhere.
- 19% of people abandon a payment because they don't trust the form (Baymard).
- The old system emailed PDF cards. A card with a QR code also speeds up check-in.

**Canvas boards:** `Member-A` (join flow) · `Member-B` (tier cards) · `Member-C` (donate) · `Member-D` (digital card).

**User-facing scope**
- **`/membership` — "Which one fits you?"**
  - Two questions: who's joining (just me / me + children / children only) and whether anyone is 65 or older.
  - A household optimizer prices every valid combination (Adult or Senior plus Scholastic × n, or Family), recommends the cheapest, and shows the math ("Family only saves with three children").
  - The plain tier cards (Member-B) stay one click away.
  - Real tiers: Adult $15/yr (18+), Scholastic $5/yr (K–12), Family $25/yr (you + up to 3 children), Senior $10/yr (65+). Benefits: LCA tournament entry discounts, member profile, voting rights, online registration.
- **Join vs Renew.** These are separate paths. Renew shows current status and expiry, and extends from the current expiry, not from today. Auto-renew is optional (yearly Stripe subscription), with a reminder before each charge.
- **"Am I a member?"** Look up by name plus US Chess ID, or by email. It returns only status and expiry month, and it's rate-limited.
- **Donate** (`/donate`, linked in the header from WS02):
  - Purpose funds: "Send a Louisiana kid to Nationals", "Club equipment", "General fund". Each shows a goal and progress entered by the treasurer.
  - Once or monthly.
  - Amount buttons plus "Other".
  - A "Where money goes" annual summary.
  - Trust facts. Verify LCA's tax status before claiming any tax deductibility, and don't claim it unless it's confirmed.
  - Payment through Stripe Checkout with fund metadata.
- **Digital card:**
  - In My LCA: name, member ID, tier, expiry and a QR code, plus one card per dependent.
  - A printable card (print CSS or PDF).
  - The QR is a signed token (`member_id`, `exp`) that WS08 verifies at check-in.
  - Apple and Google Wallet passes come in Phase 5 (D4).

**Data model**
```sql
-- 00xx_membership_giving.sql  (verify how memberships are stored today: members.* columns vs payments rows; payments.type includes 'donation' since an earlier fix)
CREATE TABLE donation_funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, description TEXT,
  goal_cents INTEGER, raised_offline_cents INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE payments ADD COLUMN fund_id INTEGER REFERENCES donation_funds(id);
ALTER TABLE payments ADD COLUMN recurring INTEGER NOT NULL DEFAULT 0;
ALTER TABLE members ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0;              -- verify placement
ALTER TABLE members ADD COLUMN stripe_subscription_id TEXT;
```

**API**
- `GET /api/membership/options` (new): tiers and prices.
- `POST /api/membership/checkout` (exists, in `functions/api/membership/checkout.ts`): extend for households and renew.
- `POST /api/membership/confirm` (exists).
- `GET /api/membership/lookup` (new; public, rate-limited).
- `GET /api/donations/funds` (new).
- `POST /api/donations/checkout` (exists): add `fund_id` and recurring payments.
- `GET /api/me/card` (new): card data plus a signed QR token.
- Admin fund management: `POST`/`PATCH /api/admin/donations/funds` (new; `requireAdmin`).
- The webhook (`functions/api/stripe/webhook.ts`) records fund totals and subscription renewals. Reuse `functions/utils/membershipActivation.ts` and `membershipExpiry.ts`.

**Frontend**
- Change: `src/pages/MembershipPage.tsx`, `MembershipSuccessPage.tsx`, `DonationSuccessPage.tsx`, `src/components/DonateButton.tsx`.
- New: `src/pages/DonatePage.tsx` and `src/components/membership/FitQuiz.tsx`, `HouseholdOptimizer.tsx`, `TierCards.tsx`, `RenewPanel.tsx`, `MemberLookup.tsx`, `MemberCard.tsx`, `PrintableCard.tsx`, `FundPicker.tsx`.

**Jobs & integrations**
- Stripe subscriptions for auto-renew and monthly gifts.
- Resend for renewal reminders, reusing the expiry logic in `daily-emails`.

**Acceptance criteria**
1. The optimizer always recommends the cheapest valid combination. Unit tests cover 0–5 children, seniors, ties and children-only households.
2. Renewal extends from the current expiry date, and the receipt shows the new date.
3. The lookup reveals only status and expiry month, and rate limiting kicks in after 10 lookups per IP per hour.
4. A donation's fund metadata shows up in that fund's total after the webhook runs.
5. A valid QR token checks a member in; forged or expired tokens are rejected.
6. Donate is one click from every page on tablet, and on desktop wherever the header row has room for it; when the desktop row is tight it is the About menu's last item, one click after opening About. On phones it is the first of the three buttons after the section list in the Menu sheet (two taps).

**Tests**
- Unit: the optimizer.
- Integration: checkout metadata, the webhook (membership, donation, subscription renewal), token verification and lookup rate limits.

**Depends on:** WS01 and WS02. WS08 uses the card QR.
**Risks & open decisions:**
- D4 (wallet passes).
- Fund accounting needs the treasurer to keep entering progress.
- Tax-status wording.

---

## WS13 · My LCA dashboard
**Why:**
- Dashboards should show status and the next action by default (NN/g, Baymard).
- One login can be member, parent, club rep, TD and board member at once.
- KingRegistration flags a US Chess membership that expires before an entered event.
- Today's `DashboardPage` doesn't bring these together.

**Canvas boards:** `Account-C` (frame: one account, many roles) · `Account-A` (member section) · `Account-B` (parent section).

**User-facing scope**
- **`/dashboard`, labelled "My LCA".** Role chips at the top name every role the person holds and jump to its section. There is no mode switch.
- **Needs attention**, ranked in this order:
  1. Unpaid entry before its deadline.
  2. US Chess membership expiring before an entered event.
  3. LCA membership expiring within 30 days.
  4. Open waitlist offer, with countdown.
  5. Bye request pending.
  6. Club listing not confirmed in 90 days (reps).
  7. Queue items (admins and board).
- **Next up:** one date-ordered timeline of entries, followed clubs' next meetings and saved events.
- **Family:** one card per dependent showing next event, section, membership and US Chess ID status. Add a child (first name, last name, optional US Chess ID), plus **Register all** into the WS06 household flow.
- **Event-day view:** "who's playing where", showing each family member's board, colour, round and an "updated" time (WS07).
- **Role sections:**
  - Club rep: freshness, Tonight switch, news → `/workspace/clubs/:id`.
  - TD: events I direct, next steps → console.
  - Board: seat, inbox.
  - Auditor/observer: read-only links.
- **Nightly US Chess check:** for entrants of upcoming events, refresh membership expiry through `functions/utils/uscf.ts`. It is throttled, cached, and capped at N lookups per run.

**Data model**
```sql
-- 00xx_dashboard.sql  (verify existing columns on members/children before adding)
ALTER TABLE members ADD COLUMN uscf_expires_on TEXT;
ALTER TABLE members ADD COLUMN uscf_checked_at TEXT;
-- same two columns on dependents/children rows (wherever WS06 settles dependents)
```

**API:** `GET /api/me/dashboard` (new; `requireAuthedMember`). It's role-aware and returns only the sections the person's roles allow. Reuse `GET /api/me` and `/api/me/children`.

**Frontend**
- Rewrite: `src/pages/DashboardPage.tsx`.
- New: `src/components/dashboard/RoleChips.tsx`, `NeedsAttention.tsx`, `NextUpTimeline.tsx`, `FamilyCards.tsx`, `EventDayView.tsx`, `RoleSection.tsx`.

**Jobs & integrations:** the nightly US Chess expiry refresh in `workers/daily-emails`, with its own isolated phase.

**Acceptance criteria**
1. A person who is member, parent, club rep and TD sees all four sections without switching modes, and the chips jump to each one.
2. Needs-attention ordering follows the ranking above. A unit test covers it.
3. A US Chess expiry earlier than an entered event's date shows at least 7 days before the event, with a renewal link.
4. "Register all" from the family section opens the household flow prefilled with every dependent.
5. The dashboard never shows data the person's roles don't allow. Role-safety tests cover this.

**Tests:** unit ranking tests; integration tests for `/api/me/dashboard` per role combination; extend `role-safety.test.ts`.

**Depends on:** WS06 and WS07, with sections lighting up as WS09 and WS12 land.
**Risks & open decisions:** the page gets long for heavy volunteers, so make sections collapsible and remember collapsed state per device. US Chess lookup rate limits.

---

## WS14 · Governance & board
**Why:**
- A volunteer board earns trust by being visibly current: next meeting, minutes, bylaws as web pages, "last updated" stamps, a yearly financial summary.
- PDFs read badly, especially on phones (NN/g).
- Councilmatic and Keep a Changelog show how to make change history readable.

**Canvas boards:** `About-A` (transparency hub) · `About-B` (board & regions) · `About-C` (bylaws & minutes reader).

**User-facing scope**
- **About hub** (About-A):
  - who LCA is, with real stats
  - the next board meeting card: date, agenda link, `.ics`
  - latest minutes
  - bylaws as a web page, with "Changed" flags by article
  - a records list where each item has a status and "Last updated"
  - the yearly financial summary, entered by the treasurer (`[Amount]` placeholders never ship to production)
  - elections
  - contact the board
- **Bylaws reader** (About-C):
  - the official structured web text, with a sticky table of contents
  - optional "In plain words" summaries, entered by an editor
  - versions, each with an effective date and the motion that adopted it
  - a changelog
  - a redline view between any two versions
  - a generated PDF download, not the default view
- **Minutes archive:** by year, searchable by keyword, each meeting with its motions.
- **Board & regions** (About-B):
  - Officers and regional representatives grouped by region (`seat_regions` exists).
  - Vacant seats appear as "This seat is open — interested?" with a contact form.
  - **"Who represents me?"**: enter a club, city or ZIP → region → rep. If the seat is open, the message goes to the whole board.
  - Messages route through the existing board inbox (`functions/api/board/tickets.ts`), so no personal email address is ever exposed.

**Data model**
```sql
-- 00xx_governance.sql  (governance_documents stays for uploaded files and categories)
CREATE TABLE governance_doc_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, doc_key TEXT NOT NULL CHECK (doc_key IN ('bylaws','rules')),
  version TEXT NOT NULL, effective_on TEXT NOT NULL, motion_ref TEXT,
  body_json TEXT NOT NULL,            -- articles/sections tree with stable section ids
  plain_summary_json TEXT, created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (doc_key, version)
);
CREATE TABLE governance_changes (
  version_id INTEGER NOT NULL REFERENCES governance_doc_versions(id), section_id TEXT NOT NULL,
  change_kind TEXT NOT NULL CHECK (change_kind IN ('added','amended','removed')), summary TEXT
);
CREATE TABLE meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK (kind IN ('board','annual','special')),
  starts_at TEXT NOT NULL, location TEXT, agenda_document_id INTEGER REFERENCES governance_documents(id),
  minutes_document_id INTEGER REFERENCES governance_documents(id), motions_json TEXT, status TEXT NOT NULL DEFAULT 'scheduled'
);
CREATE TABLE zip_regions (zip TEXT PRIMARY KEY, region TEXT NOT NULL);   -- seeded from parish→region mapping (verify src/lib/regions.ts)
```

**API**
- `GET /api/governance/bylaws?version=` and `GET /api/governance/bylaws/diff?from=&to=` (new).
- `GET /api/governance/minutes?q=&year=` (new). Use FTS5 if D1 supports it here (verify); otherwise LIKE over extracted text.
- `GET /api/governance/meetings/next` and `.ics` (new).
- `GET /api/board/represent?club=|zip=|city=` (new).
- `POST /api/board/contact` (new), which creates a board ticket.
- Writes go through `requireGovernanceEditor`. Reuse `functions/api/governance/documents*.ts`, `governance/board*.ts`, `board/seats.ts` and `board/my-seats.ts`.

**Frontend**
- Change: `src/pages/AboutPage.tsx`, `BoardPage.tsx`, `BylawsPage.tsx`, `MinutesPage.tsx`, `AnnualMeetingPage.tsx`, and `src/components/governance/GovLayout.tsx`, `GovernanceDocuments.tsx`, `RichTextEditor.tsx`.
- New: `src/components/governance/NextMeetingCard.tsx`, `VersionTimeline.tsx`, `Redline.tsx`, `MinutesSearch.tsx`, `WhoRepresentsMe.tsx`, `SeatCard.tsx`, `RecordsList.tsx`.

**Jobs & integrations:** none.

**Acceptance criteria**
1. Bylaws render as accessible web text with a table of contents. A version picker works, and the diff highlights additions and removals with a text cue as well as colour.
2. The next-meeting card provides an `.ics`, and past meetings link to their minutes.
3. Minutes search finds matches by keyword and year.
4. "Who represents me?" routes to the right seat, or to the whole board when the seat is vacant. No personal email appears in the HTML.
5. Every governance page shows "Last updated".

**Tests:** integration tests for versions and diff, minutes search, represent lookup, board contact (creates a ticket) and editor-only writes.

**Depends on:** WS01, WS02; regions from Appendix C.
**Risks & open decisions:** it builds trust only if the secretary and treasurer keep it current. The structured bylaws need a one-time conversion of today's document.

---

## WS15 · Scanner 2.0
**Why:** The scanner is live (photo → moves → lichess), but it has gaps:
- nothing is saved
- there's no board while correcting
- the photo can't be seen next to the moves

Chess67 now sells a scanner that shows photo and moves side by side. K asked for save and share PGN.

**Canvas boards:** `Scan-A` (desktop review) · `Scan-B` (phone flow) · `Scan-C` (notation kit).

**User-facing scope**
- **Save and share:**
  - A "My games" library: PGN, event, round, board, opponent, result, and an optional source photo.
  - Share links (private, unlisted or public) with a board preview image.
  - PGN download and Open in lichess (both exist).
- **Review (Scan-A):**
  - The scoresheet photo, with the move under review highlighted on the sheet.
  - A move list that labels moves "fixed automatically" separately from "needs your check".
  - The board at the selected move, rendered with chess.js.
  - Each flagged move lists the alternatives and the reason each fails.
  - Save and Export unlock once every flag is resolved.
- **Phone flow (Scan-B):**
  - Camera capture with a guide frame that auto-captures when the phone is steady (`getUserMedia`), with upload as a fallback, plus the back side of the sheet and the daily scan count.
  - Reading runs as an async job with staged progress: grid, handwriting, legality.
  - The player then fixes one flag per screen, and the done screen offers PGN, lichess and Save.
- **TD bulk scan (Phase 5):** attach scans to pairings by round and board, cross-check them against results, and attach the games to the crosstable (WS10).
- **Notation kit (Scan-C):**
  - A printable, scan-ready LCA scoresheet: corner marks, boxed cells, and an event/round/board header with a QR code when printed from pairings.
  - A notation cheat sheet for kids.
  - A how-to-scan card.
- **Privacy:**
  - Juniors' games are private by default; publishing needs the guardian's consent.
  - Source photos are deleted after 30 days unless saved.
- **Unchanged contract:** the vision model transcribes verbatim and never corrects moves; the TypeScript chess.js decoder alone applies legality. The scan stays members-only, with the daily limit in `scan_usage`.

**Data model**
```sql
-- 00xx_scanned_games.sql
CREATE TABLE scanned_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT NOT NULL REFERENCES members(id),
  pgn TEXT NOT NULL, white_name TEXT, black_name TEXT, event_name TEXT, round INTEGER, board INTEGER,
  result TEXT, tournament_id INTEGER REFERENCES tournaments(id),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  share_slug TEXT UNIQUE, photo_key TEXT,             -- R2 key in SCANS
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
Add the R2 binding `SCANS` (new bucket) in `wrangler.toml`.

**API**
- Split today's `functions/api/scan/index.ts` into:
  - `POST /api/scan/jobs` (create; members-only; checks the daily limit)
  - `GET /api/scan/jobs/:id` (progress and result)
- New game endpoints:
  - `POST /api/games` (save)
  - `GET /api/games/:slug` (visibility rules apply)
  - `GET /api/me/games`
  - `PATCH` and `DELETE /api/games/:id`
- `GET /og/game/:slug.png` (board preview, WS04 renderer).

**Frontend**
- Change: `src/pages/ScannerPage.tsx`. The `scanner/` decoder package stays under its existing contract.
- New pages: `src/pages/MyGamesPage.tsx` and `src/pages/ScannerKitPage.tsx` (`/scanner/kit`, print).
- New components in `src/components/scanner/`: `PhotoPane.tsx`, `MoveList.tsx`, `BoardAtMove.tsx`, `FlagResolver.tsx`, `CaptureCamera.tsx`, `JobProgress.tsx`, `ShareDialog.tsx`.

**Jobs & integrations**
- Async scan jobs: run them in the request with `waitUntil` and store progress in D1 (simplest), or use a Queue if limits require it.
- R2 lifecycle, or a cron, to delete photos after 30 days.

**Acceptance criteria**
1. Saved games persist and are listed in My games.
   - Share links render a board preview.
   - Minors' games are private by default.
2. Selecting a move updates the board and highlights its cell on the photo.
3. Save and Export stay disabled until every flagged move is resolved.
4. Capture works in iOS Safari and Android Chrome, and upload works everywhere.
5. The daily limit is still enforced.
6. `npm run scanner:check` passes and the decoder contract is unchanged.
7. Photos older than 30 days that aren't attached to a saved game are deleted.

**Tests:**
- Existing scanner sandbox checks.
- Integration tests for the jobs and games endpoints, covering the visibility and consent rules.
- A unit test for share-slug generation.

**Depends on:** WS01; WS04 (preview renderer); WS10 (attaching games to results).
**Risks & open decisions:** storing and publishing games of minors needs the consent rules above. Auto-capture adds a camera code path to maintain.

---

## 4. Phases in detail

| Phase | Ships | Done when |
|---|---|---|
| **0 · Foundation** | WS01 → WS02 → WS03 (strip, live and recap blocks flagged off) | axe is clean on key routes; no Level-A failures; new nav live; homepage rebuilt with the hero ladder; preview DB in place |
| **1 · Events core** | WS04, WS05, WS06, plus WS13's member and parent sections | A family can find an event by chip, map or calendar, read a plain-language event page, and register three players in one payment; partner pages and share previews work |
| **2 · Event day** | WS08 (console, setup checklist, QR check-in), then WS07 | **Pilot at one LCA event** (for example the Paul Morphy Open) with alerts limited to opted-in players; switch alerts on site-wide after the pilot review |
| **3 · Community** | WS09, then WS10, then WS11 | All 25 clubs have schedules and confirm emails; the this-week strip turns on; first results archived; recaps drafting; scholastic hub live |
| **4 · Membership, governance, admin** | WS12, WS14, WS08's admin home and queues, WS13's remaining sections | Join/renew/donate/card live; bylaws reader and Who-represents-me live; one admin queue |
| **5 · Extras** | WS15, Wallet passes (D4), Web Push, Grand Prix series, festival layout, hall TV polish | as each item's acceptance criteria say |

Sequencing notes:
- WS03's blocks light up as WS07, WS09 and WS10 land, each behind a flag.
- WS06 needs WS05's page to host the flow.
- WS07 needs WS08's publish action, so build that piece of WS08 first.
- QR check-in needs WS12's token, but `functions/utils/tokens.ts` comes earlier, in WS06.

## 5. Decisions (settled by K, October 8, 2026)

| ID | Decision | Settled |
|---|---|---|
| D1 | Logo and mark | **Both, chosen by place (amended October 8, 2026).** The rook-shaped Louisiana mark is the header's brand mark at every width (desktop, tablet and phone, with no cream plate and no swap on scroll), and also goes on the favicon, small badges, QR centres and social avatars. The board-voted full-colour LCA logo goes to the footer brand block, homepage identity band, About and history pages, emails, print kit, certificates and the membership card. Never recolour the logo; set it on white or cream. |
| D2 | Card processing fee | **All-in pricing (default).** The price shown is the price paid, with no separate card-fee line. LCA absorbs Stripe's fee of roughly 2.9% + 30¢ per payment. If that matters, nudge entry fees up instead of adding a line. K confirms with the board. |
| D3 | Names of minors | **Full names.** Results, standings, winners and recaps congratulate kids by name. Only a page that lists minors and nothing else, such as a full scholastic roster, abbreviates to first name + last initial, using the per-event `public_minor_names` setting. |
| D4 | Wallet passes | **Phase 5.** Start with the in-account card, the printable card and the QR. |
| D5 | Financial need | **LCA doesn't get involved.** No fee waivers and no lunch-status or need questions anywhere. Remove the lunch-discount line shown on the Event-A and Schol-A boards. |
| D6 | Who enters results | **The event's TDs, plus LCA admins** on any event as a backstop. Player reporting with opponent confirmation may be piloted later. |
| D7 | How live pages update | **Polling.** Each open page checks for changes about every 20 seconds. It's simple, free, and plenty for 100 players. Use a push connection (Durable Objects) only if ever needed. |
| D8 | Text-message alerts | **Not now.** Email and web push are free. Texts cost money per message and need US carrier registration; revisit if LCA decides to pay for them. |
| D9 | Player pages | **None.** LCA is community-focused, not player-focused, so results stay on event pages, recaps and the champions page. |
| D10 | Club regions | **Assigned** in Appendix C and applied with `club_regions.sql`. K corrects any that are off. |

---

## Appendix A · Evidence cheat sheet (sources for the "why" lines)
- **Hidden navigation.** Desktop hamburger menus were used 27% of the time against ~50% for visible or combo nav. They were ≥39% slower and cut discoverability by >20%. On mobile, combo nav was used 86% of the time against 57% for hidden menus. (NN/g)
- **Audience-based navigation** fails because people approach by task, not job title. (NN/g; GOV.UK)
- **Carousels.** About 1% of homepage visitors click one, and 84% of those clicks land on slide 1 (Notre Dame data). Auto-advance without a pause control fails WCAG 2.2.2 (Level A).
- **List vs grid.** A dated list beat a month grid for finding dates across month breaks. (Hund, Dowell & Mueller 2014)
- **Checkout abandonment** averages ~70%:
  - Extra costs cause 40%.
  - Forced accounts cause 18% (24% in 2022).
  - The average checkout has 11.3 fields where 8 would do.
  - 62% of sites don't make guest checkout prominent.
  - 19% of people abandon over card-form distrust. (Baymard)
- **Map beside list.** 95% used the map when it sat beside the list; 65% never found it on list-only sites. (Baymard)
- **Donations.** Only 4% of nonprofit sites said where donations go. (NN/g)
- **Contrast.**
  - Gold `#c8a94a` on white: 2.28:1.
  - Gold on navy `#1a2744`: 6.51:1.
  - Dark gold `#866a1e` on white: 5.13:1, and 4.7:1 on `#f5f5f2`.
  - White on live red `#ff4757`: 3.34:1, so use dark text on it.
- **Peer patterns:**
  - NC Chess: internal pages for clearinghouse events, a club freshness loop, clickable stats.
  - KingRegistration: ID-first entry and expiry flags.
  - Chess67: QR posters (the Campbell story); its link previews show "Loading…".
  - parkrun: club "when + first visit".
  - Luma: count line.
  - Councilmatic and Keep a Changelog: governance history.
  - USA Pickleball, AMNH and Patreon: membership cards.
  - Wikimedia and GiveDirectly: donation framing.
- **Full source list:** the canvas board `Sources` (~236 entries) and `Start-Audit` (current-site findings with file names).

## Appendix B · Canvas board index
- **Start:** `Main` (overview), `Start-Picks` (these recommendations on one page), `Start-Audit`, `Start-Principles`.
- **Looks:** `Looks-Compare`; `Looks-1`…`Looks-7` as `-Tile` and `-Page`.
- **Navigation:** `Nav-IA`, `Nav-Header`, `Nav-Mobile`, `Nav-Footer`.
- **Home:** `Home-A`…`Home-F`, `Home-Phones`.
- **Tournaments:** `Tourn-A`…`Tourn-E`, `Tourn-Phones`.
- **Event page:** `Event-A`…`Event-E`, `Event-Phones`.
- **Registration:** `Reg-A`…`Reg-D`.
- **Live mode:** `Live-A`…`Live-E`.
- **Clubs:** `Clubs-A`…`Clubs-D`, `Clubs-Phones`, `Club-A`…`Club-C`.
- **Scholastic:** `Schol-A`…`Schol-C`, `Schol-Phones`.
- **News:** `News-A`…`News-D`.
- **About:** `About-A`…`About-D`.
- **Membership:** `Member-A`…`Member-D`.
- **Account:** `Account-A`…`Account-C`.
- **Work:** `Work-A`…`Work-D`.
- **Scanner:** `Scan-A`…`Scan-C`.
- **Sources:** `Sources`.

Every option board carries a grey note with What / Borrowed from / Trade-off. Invented details on the boards are badged "Sample data"; everything else is real LCA data.

## Appendix C · Club regions (D10)

All 25 clubs are assigned by geography to the seven official regions in `src/lib/regions.ts`. K corrects any that are off. To apply, run `club_regions.sql` (it ships beside this brief) locally and then remotely. Afterward, `SELECT id, name, region FROM clubs WHERE region IS NULL OR region = ''` must return no rows; any row it does return is a club whose stored name differs from the list below.

| Region | Clubs |
|---|---|
| New Orleans Metro | Downriver Chess Club · Greater New Orleans Chess Club · New Orleans Westbank Chess Club (Gretna) · Marrero Chess Organization · North Kenner Library Chess Club · Metairie Chess Academy · Knight Light Chess · Strategic Thoughts NOLA |
| North of Lake Pontchartrain | Mandeville Chess Club · Slidell Chess Club · Picayune Chess Club (Picayune, MS; the nearest region for this border club) |
| South Central Louisiana | Baton Rouge Chess Club · Bluebonnet Chess Club (Baton Rouge) · Gonzales Chess Club · Lafayette Chess Club · Heart of Worship Church Chess (Opelousas) |
| Bayou Region | Houma Chess Club · Morgan City Chess Club |
| Southwest Louisiana | Casa de Ajedrez (Sulphur) · Beauregard Parish Youth Chess (DeRidder) |
| Central Louisiana | Bunkie Chess Club · Pineville Homeschool Chess Club |
| North Louisiana | Shreveport-Bossier Chess Club · Monroe Chess Club · Ruston Knights Chess Club |

Judgment calls worth a second look:
- **Lafayette and Opelousas** sit in Acadiana. They're in South Central rather than Southwest, which is kept for the Lake Charles side.
- **Morgan City** (St. Mary Parish) is in the Bayou Region with Houma rather than in South Central.
- **Picayune** is in Mississippi, about 20 miles from Slidell.
- **The "Baton Rouge / East Central Representative" board seat** wasn't matched to a region by migration 0050's seat seeding. Map it to South Central Louisiana in the Board seats admin so the Baton Rouge clubs have a rep.
