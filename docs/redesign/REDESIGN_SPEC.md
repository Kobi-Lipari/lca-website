# LCA website redesign: implementation brief

**For:** Claude Code working in `github.com/Kobi-Lipari/lca-website`
**Owner and reviewer:** K
**Version:** 1.3, October 8, 2026. Adds K's Phase 1 decisions (the Tournaments list and Tournament page boards, one entry price with the LCA membership requirement, the one-player-one-profile family model, and the Reg-C household checkout with one receipt system) from DESIGN_REPLAN_phase1.md.
**Design source:** the canvas "LCA Look & Feel Options". Pages 1 to 5 carry the decided boards (copies in `docs/redesign/decided-boards`). Page 6 (Registration) is decided as the Reg-C household checkout with the family model; its decided board is drawn when WS06 starts. The later pages still hold option boards until K picks. Board names in this brief, such as `Event-Final-1` or `Clubs-B`, refer to artboards on that canvas. Open the named board before building a screen.

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
- **Home (1.2, WS03):** a ten-rung hero ladder with a 30-day window (eleven rungs from 1.3, with the Featured rung); new block order (hero, identity and search band, News, doors, upcoming, results and champions, membership); in the quiet and clubs rungs the hero carries the doors.
- **Platform (2.2, 0.2):** a per-user event-mode endpoint, `functions/utils/events.ts` moved to WS03, the Phase 0 flag list and the deviations to record.
- **WS12 AC6** follows the new Donate placement.

**Changes in 1.3** (the reasoning for each is in `docs/redesign/DESIGN_REPLAN_phase1.md`, sections 1–12):
- **Tournaments list (1.2, WS04):** one list with List, Calendar, Map and Table views from the decided page 4 boards; one filter-and-sort line (When, Type, Region, Sort) with an info note; a preview pane that replaces the rail; reminders by bell (week before, day before, early price, opens, and "If this listing changes" on partner pages); a public entrants endpoint; partner pages with human-error rules.
- **Tournament page (1.2, WS05):** one unified page for every LCA-run and club-run event (the `layout` column is not added); `EventSubNav` replaces `ChampionshipTabs`; entry limits overall or by section; fee tiers only when set; one or two schedules with a merge round; side events; Venue & travel as one block; round alerts by email for registered viewers; festivals as an admin-created page under WS05 with a Featured rung on the home hero (WS03, `homeFeatured`).
- **Registration and family (WS06):** the one-player-one-profile family model (`member_guardians`, logins from 13 with recorded consent, no `dependents` table); the Reg-C household checkout with the "Who's playing?" picker; one receipt system for every payment with `stripe_events` idempotency.
- **One entry price (WS05, WS06, WS08, WS12):** no member price or discount anywhere; `member_discount` is retired; an LCA membership is required to enter LCA events, with the per-tournament `requires_lca_membership` switch and a planned site-wide override.
- **Live mode (WS07):** round alerts are email only, to registered players who have not switched off, routed through `recipientsFor`.
- **Director tools (WS08):** setup steps for the tagline and championship title, the entry-limit mode and caps, the fee ladder and membership switch, Schedules, Side events and Venue & travel; the `listing_report` queue source; `/admin/festivals`; long forms scroll in their own container; check-in search by name, US Chess ID or parent's name.
- **Champions (WS10):** `tournaments.championship_title` links the event page to the honour roll.
- **Membership and My LCA (WS12, WS13):** Family coverage chosen by ticks, no child emails, one card and QR per player profile, the TD membership desk; the family section's cards, guardians panel and claimed teen's dashboard; `uscf_expires_on` replaced by the existing `members.uscf_expiration`.
- **Decisions:** D11 to D16 added; D15 supersedes the abbreviation mechanism in D3. The replan's open questions are carried at the end of section 5 with their defaults as working assumptions.

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
- **Migrations** continue after the highest-numbered file on the branch the PR lands on. The brief's October 5 check ended at `migrations/0051_club_map_location.sql`; `0052_sections_schedules.sql` and `0053_sections_schedules_backfill.sql` are committed on `redesign/ws01-design-system` since then: they add `tournament_sections` (with `cap` and the fee tiers `fee_early`, `fee_regular` and `fee_late`), `tournament_schedules` (`label`, `time_control`, `is_primary`, `merge_round`), `tournament_schedule_rounds`, and `registrations.section_id` and `schedule_id`, with triggers that keep the tables filled from the `sections` and `round_schedule` JSON. This brief names migrations `00xx_<name>.sql`; the replan's `0052_player_profiles.sql` takes the next free number instead. Number them in the order they land.
  - Apply locally with `npm run db:migrate:local`; K applies remote migrations.
  - When a table must be rebuilt in SQLite, use the existing table name rather than a `_new` rename while child rows exist. This is a known D1 gotcha in this repo.
  - `tournaments.id`, `registrations.id` and `members.id` are TEXT (migrations 0001 and 0046): every `tournament_id`, `parent_event_id`, `registration_id`, `cloned_from_id` or member id sketched as INTEGER in this brief, and any other column that references one of those three tables, is TEXT when built.
- **Tests.** Unit tests go in `test/unit`. Integration tests go in `test/integration` and use the `invoke()` harness in `harness.ts` and the seed factories in `factories.ts`. Every new endpoint gets an integration test, including a role-safety case. `role-safety.test.ts` and `club-permissions.test.ts` are the models to follow.
- **Write files directly.** TSX with special characters should be written with the editor or file-write tool, not shell heredocs.

**Phase 0 and Phase 1 flags** (the Phase 0 rows were added in 1.2, the Phase 1 rows in 1.3; the replan names only `homeFeatured`, and the other Phase 1 rows follow the rule above so every Phase 1 PR uses the same names). Add these to `src/lib/features.ts`, all default `false`, each with a plain comment:

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
| `homeFeatured` | the admin-pinned Featured festival rung in the home hero (the WS03 amendment in WS05's festivals) | WS05 festivals |
| `newTournaments` | WS04's list with its four views, the filter-and-sort line and info note, the preview pane, the bell reminders and the partner pages | WS04 |
| `newEventPage` | WS05's unified event page: `EventSubNav`, the registration card with the membership line, entry limits by section, schedules, side events and the Venue & travel block | WS05 |
| `festivals` | the public festival page and `/admin/festivals` | WS05 |
| `householdCheckout` | WS06's Reg-C household checkout, the "Who's playing?" picker, Register my family, and the family surfaces in My LCA (WS13) | WS06 |

**Deviations from v1.1 to record in `REDESIGN_STATUS.md`** when the matching PR lands:
- WS01: Heritage loads Libre Caslon Display and Source Serif 4 instead of reusing Instrument Serif. Baloo 2 and Nunito move to WS11.
- WS02: the public event bar becomes a personal strip; `EventBar.tsx` becomes `EventStrip.tsx`; the "/" shortcut is dropped; the mobile layout is M2 under 768px; the header uses the rook mark at every width and no longer condenses (D1 amended); Renew shows only once a membership has expired; when the row is tight, Donate moves into the About menu, then the brand name hides; WS02 AC6 and WS12 AC6 follow that and the phone exception (Donate is two taps on phones); the footer column list changes.
- WS03: three hero modes become ten (eleven from 1.3, with the Featured rung); the window moves from 21 to 30 days with a 14-day last-call tier; results and champions ship before WS10; `functions/utils/events.ts` moves from WS04 to WS03; the blocks below the hero follow K's October 8 order; the quiet and clubs rungs carry the doors in the hero and omit the doors band.
- WS12: AC6 reworded.

**Deviations from v1.2 to record in `REDESIGN_STATUS.md`** when the matching PR lands (added in 1.3):
- WS03: the hero ladder gains the Featured rung (eleven rungs); `memberSaving` leaves `RegisterHero` (D11).
- WS04: `Tourn-A` to `Tourn-E` and `Tourn-Phones` are replaced by the decided boards (`Tourn-List-Final`, `Tourn-List-States`, `Tourn-Calendar-Final`, `Tourn-Map-Final`, `Tourn-Table-Final`, `Tourn-Phones-Final`); the Rated and Source chips, "Copy link to this view" and saved table views are dropped; `FilterChips.tsx` becomes `FilterBar.tsx`; `AgendaList.tsx` becomes the List view; partner-listing problem reports feed the `listing_report` queue source.
- WS05: `Event-A` to `Event-E` and `Event-Phones` are replaced by the decided boards; the `layout` column is not added (the multi-schedule form is derived from the count of non-archived `tournament_schedules` rows); `public_minor_names` is not added (the entrants rule, D15, replaces it); `ChampionshipTabs` becomes `EventSubNav`; `EntriesList` becomes `WhosComing`; the festival layout moves out of Phase 5 into WS05's festivals; `parent_event_id` is TEXT, since `tournaments.id` is TEXT.
- WS06: no `dependents` table; `member_discount` is retired from pricing; the replan's `migrations/0052_player_profiles.sql` is numbered in landing order; `MembershipAddOn.tsx` becomes `MembershipStep.tsx`.
- WS07: "opted-in players" becomes "registered players who have not switched off".
- WS13: the `uscf_expires_on` column is replaced by the existing `members.uscf_expiration` plus a new `uscf_checked_at`; there are no columns on separate dependents rows because there are none.

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
| Home | `Home-A` next-event hero with an eleven-rung ladder (live, event day, featured, last call, results, register, announced, week, this week in Louisiana, quiet, clubs), personalised on the client for involved people; the quiet and clubs rungs carry the three doors in the hero | `Home-C` this-week strip (kept for WS09, when club schedules exist), `Home-E` doors band, `Home-D` champions band and recap card, `Home-B` search box in the identity and search band directly under the hero in every mode (and the header trigger everywhere else). Below the band: News, doors, upcoming six, results and champions, membership |
| Tournaments list | `Tourn-List-Final` List view (default) with the rail and the preview pane | `Tourn-Calendar-Final` calendar, `Tourn-Map-Final` map, `Tourn-Table-Final` table, `Tourn-Phones-Final` phones, `Tourn-List-States` the Results tab and the bell's states |
| Tournament page | `Event-Final-1` and `Event-Final-2`, the one unified page (two schedules that merge; one schedule with limits by section) | `Event-Final-States` lifecycle and card states, `Event-Final-Family` the family picker, `Event-Final-Setup` the setup panel, `Event-Partner-Final` partner pages, `Event-Festival-Final-1` and `-2` festivals, `Event-Phones-Final` phones |
| Registration | `Reg-C` household checkout with the family model, decided (the decided board is drawn when WS06 starts) | `Reg-A` in-card flow on desktop, `Reg-B` one-question sheet on phones and `Reg-D` guest entry, as the same engine's other presentations |
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
| 1 · Events core | WS04 event discovery & sharing · WS05 event page and festivals · WS06 registration & households · WS13 (member and parent sections) | Find, decide, register |
| 2 · Event day | WS07 live mode · WS08 TD console, setup checklist, QR check-in | Pilot at one LCA event before switching alerts on site-wide |
| 3 · Community | WS09 clubs · WS10 results archive, news & recaps · WS11 scholastic | Where to play, what happened, how kids start |
| 4 · Membership, governance, admin | WS12 membership & giving · WS14 governance & board · WS08 admin home & queues · WS13 (club rep, TD and board sections) | Trust and operations |
| 5 · Extras | WS15 scanner 2.0 · Wallet passes · Web Push · Grand Prix series · hall TV polish | Delight |

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
- D1 binding `DB` (`lca-db`), with migrations `0001`…`0051` at the October 5 check; `0052_sections_schedules.sql` and `0053_sections_schedules_backfill.sql` (`tournament_sections` with `cap` and the fee tiers, `tournament_schedules` with `label`, `time_control`, `is_primary` and `merge_round`, `tournament_schedule_rounds`, and `registrations.section_id` and `schedule_id`) are committed on `redesign/ws01-design-system` as of October 8.
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
| Per-user involvement endpoint `GET /api/me/event-mode` (private, no-store, ETag) with `functions/utils/eventMode.ts` (pure phase machine) and `src/lib/eventModeCopy.ts` (one copy builder) | WS02 | WS02 strip, dock and banner; WS03 hero personalisation; WS07 (round phases via `round_publications`); WS13 event-day view (`players[]` read from `member_guardians` once WS06 lands) |
| Unified event query `functions/utils/events.ts` over `tournaments` + `clearinghouse` (moved out of `functions/api/clearinghouse.ts`) | WS03 | WS03 `/api/home`, WS04 `/api/events`, WS11, WS13 |
| Unified event listing `GET /api/events` over `tournaments` + `clearinghouse`, built on `functions/utils/events.ts` from WS03 | WS04 | WS04, WS11, WS13 |
| Server-rendered share previews (OG/Twitter meta and image) | WS04 | WS05, WS09, WS10, WS15 |
| Player profiles and guardians (`members` + `member_guardians`): one profile per person for life, logins through `members.auth_user_id`, owner and guardian links | WS06 | WS06, WS07, WS08, WS11, WS12, WS13 |
| `recipientsFor(db, memberId)` in `functions/utils/recipients.ts` (new): who gets each email for a player (her own login email plus every guardian with copies on), grouped per address | WS06 | Registration confirmations, reminders, WS07 round alerts, waitlist offers, US Chess expiry warnings, WS12 renewals |
| `sendPaymentReceipt` in `functions/utils/receipts.ts` (new): one receipt to the payer for every completed payment, behind the `stripe_events` idempotency check | WS06 | Registration orders, WS12 memberships and donations, WS08 walk-in card payments |
| One pricing helper, `entryPrice` in `domain/registration/pricing.ts` (`functions/utils/pricing.ts` and `src/lib/pricing.ts` are one-line re-exports of it on `redesign/ws01-design-system`), taking the section, its tier dates and the date, nothing about the viewer: the `isLcaMember` option and the "LCA member discount" line go (D11) | WS05 | WS04 preview, WS05 card, WS06 checkout, WS08 fee ladder preview |
| Signed tokens: `functions/utils/tokens.ts` (new), an HMAC over JSON with expiry, secret `SIGNING_SECRET` | WS06 | Guest manage links, waitlist claims, club confirm links, digest unsubscribe, QR check-in |
| Notifications outbox (`notifications` table + a sender with retries) | WS07 | WS07, WS09, WS10, WS12, WS13 |
| Live state endpoint with `ETag` | WS07 | WS02 event strip, WS03 hero, WS05, WS13 |
| `follows` table (player, club, event) | WS07 | WS07, WS09, WS13 |
| Club schedule model and occurrence expansion | WS09 | WS03 strip, WS09, WS11, WS13 |
| `event_results` (results archive; no player pages, D9) | WS10 | WS10, WS11 series, WS13, WS15 |
| Merged admin "Needs attention" queue | WS08 | Admin and board |

### 2.3 New tables at a glance (full DDL sketches live in each workstream)
- **WS04:** `saved_searches`, `clearinghouse_history`
- **WS05:** `festivals`, `festival_events`
- **WS06:** `registration_orders`, `waitlist_offers`, `member_guardians`, `profile_invites`, `profile_moves`, `stripe_events`
- **WS07:** `round_publications`, `follows`, `notifications`, `push_subscriptions` (Phase 5)
- **WS08:** `queue_assignments`
- **WS09:** `club_schedules`, `club_schedule_exceptions`, `club_reports`
- **WS10:** `event_results`, `digest_subscriptions`
- **WS11:** `series`, `series_events`, `team_entries`
- **WS12:** `donation_funds`
- **WS14:** `governance_doc_versions`, `governance_changes`, `meetings`, `zip_regions`
- **WS15:** `scanned_games`, plus a new R2 bucket binding `SCANS`
- New columns live in each workstream's DDL (`tournaments.requires_lca_membership`, `tagline`, `championship_title`, `entry_limit_mode`, `parent_event_id`, `kind`, `members.auth_user_id` and `claimed_at`, `tournament_reminders.kind`, and the rest). Already on `redesign/ws01-design-system` from `0052_sections_schedules.sql` and `0053_sections_schedules_backfill.sql`, so no workstream adds them: `tournament_sections` (with `cap` and the fee tiers `fee_early`, `fee_regular` and `fee_late`), `tournament_schedules` (`label`, `time_control`, `is_primary`, `merge_round`), `tournament_schedule_rounds`, and `registrations.section_id` and `schedule_id`. `site_settings` gets a `membership_required_for_all` row (verify: no migration in this repo creates a `site_settings` table yet; WS05's migration creates it as a key-value table if it is still absent).

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

- `GET /api/me/event-mode` (new; `requireAuthedMember`; `Cache-Control: private, no-store`; ETag with 304). Computed by `functions/utils/eventMode.ts` from `registrations`, `members.guardian_id` (then `member_guardians` once WS06 lands), `tournament_directors`, `tournaments` and, after WS07, `round_publications` and `live_state`. The client calls it only when `/api/me` shows an involvement inside a window; polls every `pollSeconds` while visible, never while hidden. Or 204.

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
  players: EventModePlayer[]   // own entry, or one row per child the viewer guards (members.guardian_id in Phase 0, member_guardians after WS06)
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
1. **Hero ladder**, picked by data on the server in this order, first match wins (full table in `DESIGN_REPLAN_phase0.md` section 4, with the quiet and clubs rungs as amended in its section 8): **Live** (WS07; live colour tokens on the hero only, no live fonts on `/`; round row in words, never "R3") · **Event day** (today is between an LCA event's `date` and `eventEnd`) · **Featured** (WS05 festivals, `homeFeatured`: an admin pins one festival from `/admin/festivals`, only while its page is live and until its end date, cleared by Take offline; the festival's name, dates with weekdays, city and tagline, one primary "Choose your event" and a plain "See the schedule" link; when the live or event-day event belongs to the featured festival, the festival hero stays and carries the live line; the doors band keeps its lower position) · **Register, last call** (an `isOpen` or `isClosedOnline` LCA event starts within 14 days or early entry ends within 7) · **Results** (an LCA event with `eventEnd` within 7 days, `status = 'completed'` and a non-null result in every section's last scheduled round, else fall through; Heritage accent, winners by full name with ½; WS10's `event_results` once it exists) · **Register** (within 30 days or early entry within 14; Home-A's card with the primary by state: Register when `isOpen`, Join the waitlist when `isFull`, Event details when `isClosedOnline`, and a "You're entered" variant) · **Announced** (`isAnnounced`, within 60 days; "Email me when registration opens" signed in, Event details signed out) · **Week** (WS09) · **This week in Louisiana** (LCA and partner rows within 14 days, Louisiana only; partner rows only while the sync is fresh, LCA rows always) · **Quiet** (the hero itself carries Home-E's three doors on the usual navy hero ground with the a–h / 8–1 grid motif, headed "Find your next game in Louisiana", with the Next LCA event line beneath and the region select; the soonest Louisiana events are in the upcoming six further down; primary: Find a club near you) · **Clubs** (the floor when nothing matches or `/api/home` fails: the same doors hero, with the seven region chips from `regions.ts` in place of the select; primary: Find a club). In these two rungs the doors band lower on the page is omitted, so the doors never appear twice; every other rung keeps the doors band in its lower position. The doors' links are plain links, never a second primary. Registration state comes from `isOpen`, `isFull`, `isClosedOnline` and `isAnnounced` in `functions/utils/events.ts` (`DESIGN_REPLAN_phase0.md` section 2, Q4), one unit test each. Exactly one primary action per mode. Every non-LCA mode ends with a "Next LCA event" line when one is announced within 180 days ("Registration open ›", "Registration opens Fri, Jan 15 ›" or "Details ›"). Partner rows carry "Partner event · Registers on the organizer's site ↗", never Register, never a count, never the LCA hall photo; a single `EventAction` component enforces this, and any `tournaments` row with a `registration_url` counts as organizer-registered; the "Also this weekend" partner line links to the organizer's site until WS04 ships the internal partner page. Personal lines are added on the client: "You're entered" and "You finished 4th" from `/api/me`, boards and colours from `useEventMode()`. While `/api/home` loads the hero reserves 360px at 390px and 440px at 1280px with a neutral skeleton; if it fails, the hero renders the Clubs floor from `regions.ts` with no error chrome. Below the hero in every mode is the **identity and search band**: the official logo, "Louisiana's chess community since 1915 · 300+ members · 25+ clubs · 7 regions" (each stat a link), a CSS thick–thin rule, and the Home-B search box (the WS02 combobox inline, visible label, quick-pick chips hidden until WS04 and WS09 ship their filters).
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
  priceFrom?: number; registered?: number; maxPlayers?: number   // priceFrom is the lowest entry price across sections (D11)
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
interface FeaturedFestival { id: number; slug: string; name: string; href: string; city?: string; dates: string; tagline?: string; heroPhotoUrl?: string; events: HeroEvent[] }
interface FeaturedHero { mode: 'featured'; festival: FeaturedFestival
  live?: { event: HeroEvent; round: number; roundsTotal: number; publishedAt: string } }   // when the live or event-day event belongs to the festival
interface NextLca { event: HeroEvent; status: 'open' | 'opensAt' | 'details'; opensAt?: string }

interface HomeResponse {
  hero: (LiveHero | EventDayHero | FeaturedHero | RegisterHero | ResultsHero | AnnouncedHero | WeekHero | NearbyHero | QuietHero | ClubsHero)
    & { reason: string; nextLca?: NextLca }
  week: WeekHero | null                       // WS09
  upcoming: HeroEvent[]                       // Louisiana only in Phase 0, hero events excluded
  recap: { title: string; href: string; date: string } | null   // WS10
  champions: Array<{ year: number; title: string; name: string }> | null
  news: Array<{ id: string; title: string; date: string; href: string }>
  featured_festival: FeaturedFestival | null  // WS05 festivals, homeFeatured; null until an admin pins one
}
```

No field in `HomeResponse` is personal. Mode selection is `selectHeroMode(now, data)` in `functions/utils/homeHero.ts`, in America/Chicago time, with the window constants `LAST_CALL_DAYS = 14`, `LAST_CALL_EARLY_DAYS = 7`, `REGISTER_DAYS = 30`, `REGISTER_EARLY_DAYS = 14`, `RESULTS_DAYS = 7`, `ANNOUNCED_DAYS = 60`, `NEARBY_DAYS = 14`, `NEXT_LCA_DAYS = 180`, `SYNC_STALE_DAYS = 3`. Events come from `functions/utils/events.ts` (the LCA + clearinghouse union moved out of `functions/api/clearinghouse.ts`). Partner rows are dropped when the newest `synced_at` is more than 3 days old or the start date has passed, and an admin alert is raised; LCA rows never depend on the sync. `eventEnd(t) = (t.end_date ?? t.date) 23:59` Central anchors every window. Edge cache 60 s, dropping to 15 s in the live and event-day modes. The Featured rung reads `festivals` where `featured = 1`, `status = 'live'` and today is on or before `end_date`; it sits after Live and Event day, except that when the live or event-day event belongs to the featured festival the festival hero stays and carries the live line (assumed, see section 5). Every block degrades to `null` when its source isn't built yet.

**Frontend**
- Rewrite: `src/pages/HomePage.tsx`.
- New: `src/components/home/HomeHero.tsx` (one subcomponent per mode, each with a skeleton at the reserved height), `HeroEventCard.tsx` (lca, partner, compact), `NextLcaCard.tsx`, `EventAction.tsx`, `IdentitySearchBand.tsx`, `ThisWeekStrip.tsx`, `UpcomingList.tsx` (`excludeIds`), `DoorsBand.tsx` (`variant="band"` lower on the page; `variant="hero"` on the navy hero ground in the quiet and clubs rungs), `RecapCard.tsx`, `ChampionsBand.tsx`, `MembershipBand.tsx`, `src/lib/addToCalendar.ts`, `functions/utils/homeHero.ts`, `functions/utils/events.ts` (with `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`), `functions/api/home.ts`. The hero photo is `src/assets/LCA_Slide_1.jpg` through the WS01 pipeline, alt "Players at long tables in a tournament hall", unless K supplies another.
- Reuse: `FacebookFeed variant="compact"`, `StatusBadge`, `DateBlock`, `ThickThinRule`, `Seal`, `RegistrationReminderButton`, `SearchCombobox`.

**Jobs & integrations:** none.

**Acceptance criteria**
1. Mode selection is unit-tested for every rung, at every window boundary, for ties (earliest event), at midnight and across DST, for `end_date` NULL, for a stale sync with an LCA row in range, for a closed-online and an announced LCA event inside 30 days, for a completed event with no results, for a last round finishing after midnight, and for the Featured rung (a pinned festival; the live or event-day event belonging to it; a draft or offline festival that is never featured). A mode missing its data falls to the next rung, and no mode renders an empty frame.
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
- Unit `test/unit/homeHero.test.ts`: every rung and boundary from AC1, ties, the Next LCA line's three statuses, the "Also this weekend" line, the registration-state primary per rung, the Featured rung and its live-line case.
- Unit `test/unit/events.test.ts`: `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`, one case per clause.
- Integration `test/integration/home.test.ts`: a partner-only fixture renders no "Register" text and no count; no personal field; `null` blocks for unbuilt sources; cache headers per mode; out-of-state rows never in the hero; the Results rung with a completed, resultless event falls through.
- a11y and visual `test/a11y/home.spec.ts` (Playwright): a snapshot of each mode at 390 and 1280px; the page order at 390 and 1280px; the doors rendered once in every mode, inside the hero for quiet and clubs; the heritage and live font chunks absent from the `/` network log; the skeleton height and CLS; the fetch-failure Clubs floor; Pause updates in the live hero; the inline search overlay's open and focus rules.

**Depends on:** WS01 and WS02. The strip needs WS09 and is flagged off until then (`homeWeek`). Live mode needs WS07 (`homeLive`). The results hero (`homeResults`) and the Champions band (`homeChampions`) ship in Phase 0 from existing standings and `state_champions`; only the recap card waits for WS10 (`homeRecap`). WS03 no longer waits for WS04: it builds `functions/utils/events.ts`, which WS04 adopts. The Featured rung waits for WS05's festivals (`homeFeatured`).
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
- `Tourn-List-Final` is the default List view with the rail and the preview pane; `Tourn-List-States` holds the Results tab and the bell's signed-out, partner and saved states.
- `Tourn-Calendar-Final` is the calendar view (month beside the list).
- `Tourn-Map-Final` is the map view (map first, list drawer).
- `Tourn-Table-Final` is the table view (compact table, side panel).
- `Tourn-Phones-Final` covers every phone layout.
- `Event-Partner-Final` is the partner page (page 5 is decided; WS05 lists it too).

**User-facing scope**
- **One list, four views.** `/tournaments?view=list|calendar|map|table`; `list` is the default and is omitted from the URL. The page band holds Upcoming · Results at the left, the view switcher in the centre and the tournament search box at the right, on every view. On the Results tab the centre holds the season switcher instead (2026 · 2025 · 2024 · Earlier); Calendar, Map and Table do not apply to past results, and the chrome is otherwise identical.
  - **List:** month-grouped rows, each with a weekday date block, name, city and organizer, type, "23 of 60 registered" with a fill bar and the next price step on LCA rows, status in words; partner rows are lighter and say "Registers on the organizer's site ↗". On hover or focus a row shows the Remind me bell; a partner row's popover offers only the two date reminders. At 1280px and wider the right column is the rail (New to tournaments?, Latest results, For organizers) until a row is selected; the rail and the preview share one 400px column and are never shown together. On desktop each row carries a source tag; the tag and the register wording mark the source now that there is no Source filter.
  - **Calendar:** a small Monday-first month beside the week-grouped list; LCA days filled, partner days hollow, today ringed, multi-day events as one bar; tapping a day scrolls the list; the grid works with arrow keys and has a text alternative. There is no season strip.
  - **Map:** `LCAMap` across the full width with filled pins for LCA events, hollow pins for partners, clusters with counts and region labels, and a list drawer below kept in sync with the pins; selecting a pin highlights the row and the other way round. "Update the list as I move the map" starts ticked; the map opens on the Gulf South when Region is at its default and zooms to Louisiana when a Louisiana region is picked (assumed, see section 5). Distance from a city or ZIP comes later.
  - **Table:** dense 13px rows with the columns Date, Event, City, Type, Source, Entries and Status; sortable column headers; Date and Event frozen when the table scrolls sideways; Entries as "23 of 60" with a mini bar; Status in words; no bell column (Remind me lives in the panel); a picked row carries a gold ring and opens the preview as a side panel with the List's button row at the bottom; below 1280px the panel becomes a 400px drawer over the right edge. There are no saved table views: the URL holds every view, and a weekly saved search covers the recurring case (assumed, see section 5).
  - **Results tab:** the State champions card at the top, then the season's results. "Your first tournament, step by step" lives in the rail's New to tournaments card; the two links that sat under the page title are gone.
- **One filter-and-sort line,** 44px, on every view: the live count ("16 tournaments"), then **When** (This weekend · Next 30 days · Next 3 months · Any time · Pick dates) · **Type** (Classical · Quick · Blitz · Scholastic · FIDE) · **Region** (Louisiana and nearby states by default; Louisiana's seven regions; Mississippi, Texas, Alabama), then the applied chips (removable), Clear all, and Sort at the far right ("Sort: Soonest first", also Name A to Z, and Closest to me once a region or city is set). The Rated and Source chips are dropped. All state lives in the URL, so back and forward restore it and the address bar is the link; there is no "Copy link to this view" control (Share stays per event, in the preview). Under the line sits one muted info note with the info icon saying what is showing and how each source registers: "Showing Thu, Oct 8 to Wed, Jan 6 · 3 register on LCA · 13 partner listings. LCA events register here. Partner events come from the Gulf South Tournament Clearinghouse and register on the organizer's site, opens in a new tab." The `.ics` "Subscribe to this list" link sits at the end of the note (assumed, see section 5). On phones the chips become a Filters button with the applied count beside the live count; it opens a bottom sheet (When, Type, Region with counts, Clear all, "Show 16 events") with the info note folded into it.
- **Preview pane** (at 1280px and wider on List and Calendar; inside the drawer on Map; the side panel on Table): the facts, sections and fees, See who's registered (public: under-18s as first name and last initial, adults in full, grouped by section with counts; TDs and admins in full), then Register (gold, with the current price) · Remind me · Add to calendar · Share · Full event page. Partner events show "Registers on the organizer's site ↗" in navy, never Register, never a count and no sections table. An LCA event not yet open leads with "Remind me when it opens", then Add to calendar, Share and Full event page, and gains Register when registration opens. The preview replaces the rail; Close brings the rail back.
- **Phones:** one toolbar on every view, two rows: Upcoming · Results on the first row; on the second a **Display** dropdown at the left (a select-style button with a sheet of four options and a tick on the current one, not a segmented control), the live count beside it, and a **Filters** button with the applied count ("Filters · 2") at the right. Search stays in the app bar; there is no chip row. List B rows with a sticky month band and the live count carry no LCA or Partner tag text and no bell (the navy date block and the status words mark LCA events; partner rows read "Registers on the organizer's site ↗"). One preview sheet for all four views: "‹ Back to list" (or map, table, calendar) as a 44px pill at the top left, Close at the top right, the same facts, sections and fees as desktop, See who's registered with minors abbreviated, and the full button row pinned at the bottom; the bell lives only in the sheet's Remind me. Map A: the map on top, a list sheet below that drags up, the pin preview rising over the lower half with "‹ Back to map" first under the thumb. Table A: Date and Event frozen, swipe for the rest, no bell column and no tag text; partner rows read "Organizer's site ↗"; the phone table takes the desktop notes (no copy link, the info note folded into the Filters sheet, minors abbreviated, the preview's buttons). Calendar A (the month grid over the selected day's agenda) by default (assumed, see section 5).
- **Partner pages** at `/tournaments/p/:slug` (`Event-Partner-Final`), with rules for every way a hand-kept spreadsheet can be wrong or late:
  - a fixed facts card using the feed's fields (organizer, city and state, venue, rating system, eligibility, contact) that never hides a row: a blank row reads "Not in the listing yet"
  - buttons: "Registers on the organizer's site ↗" (navy), Add to calendar (disabled with "Date to be confirmed" when the date is unconfirmed) and Remind me (the two date reminders plus "If this listing changes", kind `listing_changed`, sent when the sync's diff touches the date, venue, link or cancellation)
  - the source line "Listed from the Gulf South Tournament Clearinghouse · updated <weekday date>"
  - a map; a missing venue uses the city for the map and the drive times ("from the city centre"); a missing city hides both
  - "Also near <city>"
  - a TBA, month-only, unparseable or impossible date reads "Date to be confirmed by the organizer"; a missing link makes "Contact the organizer" the main action; a bare link gets https:// and is checked before the button shows; a stale sync and a listing that has left the feed are stated in words and the page is kept; a changed date adds a history row with weekdays (`clearinghouse_history`); a probable duplicate is merged under one page with an admin-only tag
  - "Report a problem with this listing", which creates a support ticket tagged `listing_report` with the clearinghouse id; the admin queue's `listing_report` source (WS08) lists those tickets
- **Sharing:** server-rendered OG and Twitter meta (title, a date line with weekday, city, entries, image) on `/tournaments/:id`, `/tournaments/p/:slug`, `/clubs/:id` and `/news/:slug`, plus a generated preview image.
- **Calendar feeds:** a "Subscribe to this list" link (`webcal://`) for the current filters at the end of the info note on every view (assumed, see section 5), and "Add to calendar" for each event and in every preview.
- **JSON-LD:** `Event` markup on both detail page types (eventStatus, location, organizer, offers for LCA events).
- **Reminders** (`tournament_reminders`, extended): the bell on a row, and Remind me in every preview, open a popover (a sheet on phones) with "One week before" and "One day before" ticked by default, plus "Before the early price ends" and "When registration opens" where they apply; partner events offer only the two date reminders and, on the partner page, "If this listing changes". Signed out, the bell still appears on hover and opens a small "Log in to set reminders" card, so the feature is discoverable and nothing is saved without an account. Saved reminders show a filled bell with "Reminders on · 2" and a saved toast. Reminders go by email to the account's address, which can be changed in My LCA, where reminders can also be changed or stopped. Keep today's "Notify me when registration opens" (`functions/api/tournaments/[id]/remind.ts`) as the "When registration opens" option. Saved searches stay: "Email me when new events match these filters" (weekly).
- This replaces the `FEATURES.tournamentQuickFilters` and `FEATURES.externalTags` stubs with the When, Type and Region filter line and the per-row source tag on desktop; there is no Source or Rated chip any more.

**Data model**
```sql
-- 00xx_event_discovery.sql
ALTER TABLE clearinghouse ADD COLUMN slug TEXT;          -- verify: existing columns first; backfill, then unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_clearinghouse_slug ON clearinghouse(slug);
ALTER TABLE clearinghouse ADD COLUMN last_seen_at TEXT;
ALTER TABLE tournaments ADD COLUMN slug TEXT;             -- verify: tournaments may already have one
ALTER TABLE tournament_reminders ADD COLUMN kind TEXT NOT NULL DEFAULT 'opens'
  CHECK (kind IN ('opens','early_price','week_before','day_before','listing_changed'));
ALTER TABLE tournament_reminders ADD COLUMN sent_at TEXT;   -- one per row, in place of today's two flags and the notified_at column
-- verify: today's table (migrations 0005, 0022 and 0046) has UNIQUE (member_id, tournament_id), the flags sent_registration_open and sent_week_before,
-- and 0022's registration_opened_notified_at.
-- Today's one row carries two sends: the registration-open email (sent_registration_open, registration_opened_notified_at) and the
-- week-before email to subscribers not yet registered (sent_week_before; workers/daily-emails phase 3). The migration writes two rows per
-- existing row, kind 'opens' and kind 'week_before', carrying each flag as that row's sent_at (the notified_at timestamp where there is one,
-- else the migration's own time for a set flag, else NULL). Today's id is reminder-<member>-<tournament> (functions/api/tournaments/[id]/remind.ts),
-- so the second row needs the kind in its id; the DEFAULT only keeps that insert working and is not the backfill. The unique constraint
-- becomes (member_id, tournament_id, kind), which in SQLite means a rebuild under the existing table name (0.2). tournament_id is TEXT and
-- references tournaments(id), so partner reminders need either a nullable clearinghouse_id column or a source column: verify which, and
-- keep one row per (member, event, kind).
CREATE TABLE clearinghouse_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clearinghouse_id TEXT NOT NULL REFERENCES clearinghouse(id),   -- verify: clearinghouse's id type
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  field TEXT NOT NULL, "from" TEXT, "to" TEXT
);
CREATE TABLE saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  query_json TEXT NOT NULL,          -- the URL filter state
  cadence TEXT NOT NULL DEFAULT 'weekly' CHECK (cadence IN ('weekly')),
  last_sent_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**API**
- `GET /api/events` (new, public): accepts the `from`, `to`, `when`, `type`, `state` and `region` filters and `sort=soonest|name|distance`; `rated` and `source` are not public filters (the merge keeps `source` in every row), and `view` is client state that is never sent. It merges the two sources into one shape, `{id, source:'lca'|'partner', slug, name, start_date, end_date, city, state, venue, type, rating_system, eligibility, organizer, status, registered_count?, capacity?, price_now?, price_next?, next_price_change?, external_url?}`; `price_now` is the lowest `fee_now` across sections (WS05's "From $X") and `price_next` the fee after `next_price_change`, so a List row can show the next price step. Counts and prices appear only for `lca` rows. Edge cache 60 s.
- `GET /api/events/partner/:slug` (new, public), including the listing's `clearinghouse_history` rows.
- `GET /api/events/:id/entrants` (new, public): per-section entrant names for an LCA event with counts per section; under-18s as first name and last initial, adults by full name, where under 18 means a player with an active guardian link (`members.guardian_id` until WS06 lands, then `member_guardians`) or an entry with a ticked eligibility box (a missing `eligibility_json` column counts as unticked); `full=1` returns full names only for `requireTournamentView`. Returns an empty list for partner events.
- On selection the preview loads `GET /api/tournaments/:id` (the existing endpoint; WS05 adds per-section `fee_now`, the one entry price for the date under D11) for the sections and fees, with Register showing the lowest `fee_now` across sections ("From $X", WS05), and `GET /api/events/:id/entrants` for See who's registered. The `/api/events` row alone carries no sections and no fee.
- `GET`, `POST` and `DELETE /api/me/reminders` (new; `requireAuthedMember`): list, save and remove a member's reminders per event; the popover saves all ticked kinds in one call; partner events accept only the two date kinds and `listing_changed`.
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
  - `src/components/tournaments/MiniCalendar.tsx` (replace or refactor) and `AgendaList.tsx` (it becomes the List view, renamed `ListView.tsx`)
  - `src/lib/clearinghouse.ts`, `src/lib/api.ts`
- New, in `src/components/events/`:
  - `EventRow.tsx` (no tag text or bell under 768px), `FilterBar.tsx` (the one line: count, dropdowns, chips, Clear all, Sort), `FilterSheet.tsx` (the phone sheet), `InfoNote.tsx`, `ViewSwitcher.tsx` (the centre segmented control on desktop, handing off to `DisplayMenu.tsx` under 768px), `DisplayMenu.tsx`, `Rail.tsx` (New to tournaments?, Latest results, For organizers), `CalendarNavigator.tsx`, `EventsMap.tsx`, `EventsTable.tsx`, `PreviewPane.tsx` (renders as the pane, the drawer, the side panel or the phone sheet from one component, fetches `GET /api/tournaments/:id` and `GET /api/events/:id/entrants` on selection, and owns the button row so the partner and not-open variants cannot show Register), `RemindMePopover.tsx` (popover on desktop, sheet on phones), `EntrantsList.tsx`
  - `src/pages/PartnerEventPage.tsx`
  - `src/lib/eventFilters.ts` (URL ↔ state, including `sort` and `view`)

**Jobs & integrations**
- `workers/clearinghouse-sync` keeps `slug` and `last_seen_at` up to date, flags rows that vanish from the feed, writes a `clearinghouse_history` row for every changed field, and queues the `listing_changed` reminders when the diff touches the date, venue, link or cancellation.
- `workers/daily-emails` reworks its existing week-before phase to the `week_before` kind (today it sends only to subscribers not yet registered; the kind sends to everyone who ticked it) and adds the day-before reminder, the early-price reminder the day before `next_price_change` and the weekly saved-search email (Monday run); the existing opens-reminder paths (phase 2 and `functions/utils/registrationOpenNotify.ts`) handle `opens`, reading `sent_at` in place of the two flags. Recipients come from `recipientsFor` (WS06) once it exists.
- Google Geocoding (cached) is optional, for map pins on partner events that lack coordinates.

**Acceptance criteria**
1. `/tournaments` opens in List view, grouped by month, with weekday dates; the page band shows Upcoming · Results, the view switcher and the search box in that order; every filter, sort and view change updates the URL and back/forward restores it. There is no Copy link control.
2. The filter-and-sort line reads count, When, Type, Region, applied chips, Clear all, Sort, in that order, on all four views, at 1024px and 1440px; "Clear all" restores the full list; the info note under it names the date range and the count by source.
3. Calendar view:
   - tapping a day scrolls the list
   - multi-day events render as one bar
   - the grid works with arrow keys and has a text alternative
4. Map pins and list rows stay in sync with filters, and selecting either one highlights the other.
5. No partner event shows an LCA Register button or counts. Every clearinghouse row has an internal page, and its exit link opens the organizer's site (`rel="noopener"`).
6. The Facebook Sharing Debugger shows the title, the weekday date line, the city and an image for a tournament URL, with no "Loading…".
7. The `.ics` subscription imports into Google Calendar and Apple Calendar and picks up new events on refresh.
8. JSON-LD passes Google's Rich Results Test for both detail types.
9. Selecting a row at 1280px replaces the rail with the preview pane and Close restores the rail; the pane's buttons read Register · Remind me · Add to calendar · Share · Full event page for an open LCA event, lead with "Remind me when it opens" for one not yet open, and show "Registers on the organizer's site ↗" with no count for a partner event.
10. The bell appears on hover and focus of a row (and never on phones), opens the Remind me popover with one week and one day before ticked, asks for a log in when signed out, offers only the two date reminders on a partner row (the partner page's Remind me adds "If this listing changes"), and shows "Reminders on · N" once saved. Saved reminders appear in My LCA.
11. The public entrants list shows under-18s as first name and last initial and adults in full, grouped by section with counts; a TD or admin sees full names; a partner event has no entrants list.
12. Under 768px the toolbar shows Upcoming · Results, then Display, the live count and Filters · N; Display lists the four views with the current one ticked; Filters opens the sheet with counts and "Show N events"; rows show no tag text and no bell; the preview sheet opens from a row, a pin, a table row and a calendar day with "‹ Back to <view>" at the top left and the button row pinned at the bottom.
13. Table view has no bell column; Date and Event stay frozen when the table scrolls sideways; a picked row carries a gold ring and opens the side panel; below 1280px the panel is a drawer that Esc or Close shuts.
14. A partner page never hides a facts row, reads "Date to be confirmed by the organizer" for an unconfirmed date, shows "Contact the organizer" as the main action when the feed has no link, and keeps the page when the sync is stale or the listing has left the feed.

**Tests:**
- Integration: `/api/events` (merge, filters, sort, no counts on partner rows).
- Integration: `/api/me/reminders` (save all kinds, partner events accept only the date kinds and `listing_changed`, signed out is 401).
- Integration: the `tournament_reminders` migration writes an `opens` and a `week_before` row per existing row and carries each sent flag into that row's `sent_at`.
- Integration: `/api/events/:id/entrants` (minors abbreviated, `full=1` only for `requireTournamentView`, partner events empty).
- Integration: `.ics` output, and middleware HTML containing meta tags.
- Integration: `clearinghouse-sync` writes `clearinghouse_history` and queues `listing_changed` only for the date, venue, link and cancellation fields.
- Unit: `eventFilters` round-trip including `when`, `type`, `region`, `sort` and `view`.
- Unit: the entrant display-name helper (under 18 gives first name and last initial).
- Extend `public-feed.test.ts`.

**Depends on:** WS01 and WS02. WS06 widens the entrants rule to `member_guardians`.
**Risks & open decisions:** OG image rendering may exceed Pages Functions size limits; the fallback is images pre-rendered into R2. Drive-time estimates need a routing API, so they're deferred. CSV export for directors moves to the TD tools (WS08, the entrants list), off the public table view (assumed, see section 5).

---

## WS05 · Event page template & lifecycle
**Why:**
- On phones, the Register card currently renders after the entire player list.
- US Chess-style shorthand ("TLA") confuses newcomers.
- Information missing at the moment of decision causes abandonment (Baymard).
- The same page has to serve three moments: before an event, during it, and after.

**Canvas boards:**
- `Event-Final-1`: the unified page with two schedules that merge (signed out, travel details on, side events on, overall limit).
- `Event-Final-2`: the unified page with one schedule and limits by section (signed-in member, plus the club-run inset).
- `Event-Final-States`: six card variants, the family row, the button strips, the during and after tops, the registered sidebar.
- `Event-Final-Family`: the "Who's playing?" picker, the signed-out explainer and the phone picker (WS06).
- `Event-Final-Setup`: the TD setup panel with the new options (feeds WS08).
- `Event-Partner-Final`: the partner page and its eight human-error states (WS04).
- `Event-Festival-Final-1` and `Event-Festival-Final-2`: the public festival page; the admin panel and the home hero in festival mode (the replan's sections 8.1 and 8.5 call them `Event-Festival-Final` frames A and B; the two names here are the ones in `docs/redesign/decided-boards`).
- `Event-Phones-Final`: the phone frames.

**User-facing scope**
- **One page for every LCA-run and club-run event** (`Event-Final-1`, `Event-Final-2`; the reasoning is in `DESIGN_REPLAN_phase1.md` sections 5 and 6). Its blocks and forms follow the event's setup, never a layout choice:
  - **Top band (from B):** the navy band with the title, dates with weekdays and city, and the key-facts card: days to Round 1 (a plain days figure that changes once a day; nothing ticks), the fill bar, "Register · from $X" and Remind me. For events LCA does not run the tag reads "Club event" and the organizer line names the club or organizer and its TD.
  - **Sticky sub nav** (`EventSubNav`, from B, on every event): Overview · Sections & prizes · Schedule · Who's coming · Venue & travel · Good to know · Past champions ↗ · Pairings · Standings, addressed by hash (`#overview #sections #schedule #whos-coming #venue #good-to-know #pairings #standings`). Past champions is a link to the honour roll for the event's `championship_title` (WS10), never a block at the bottom, and is absent when the title is empty.
  - **Fact tiles in plain language:** "US Chess rated" · "5 rounds" · "G/90+30 · 90 min each + 30 sec per move" · "½-point byes available" · "Check-in closes 9:30 AM".
  - **Sections and schedule in the form the setup gives them:** with one schedule, A's section cards (rating band, current fee and the date of the next increase, the fullness bar, eligibility in plain words), then schedule and prizes side by side; with two schedules that merge, B's day-by-day schedule (rows tagged 3-day or 2-day, the merge row), then B's sections and prizes. Rounds carry weekday and time. Prizes read "based on N entries".
  - **Entry limits** are overall (the default) or by section. By section, the overall shown is the TD's number if entered, else the sum of the caps; a section with a blank cap is uncapped ("N entered") and counts toward no sum, so with any blank cap and no overall number the page shows the entered total with no cap; with no limit at all the page shows "38 registered" and no bar; a picked section shows its own count and cap with the overall in a smaller second line. Both limits are enforced at checkout (WS06), and the waitlist is per section when limits are by section.
  - **Side events** (child rows of kind `side` or `meeting`, a setup option on or off per event and editable after creation): listed with their own sections, fees, caps and counts and chosen from the same picker as the main sections. The State Championship's business meeting is a side event of kind `meeting` with an RSVP (assumed, see section 5; the brief's WS14 has no RSVP yet, so it is added there when the meeting lands).
  - **Who's coming** (from A): one table sorted by rating with section chips as filters and per-section counts, and no club column anywhere; under-18s show as first name and last initial publicly, as in the page 4 preview (D15); TDs and admins see full names.
  - **Venue & travel,** one block (`#venue`): the venue (name, address, map, parking, getting in, food), then "Getting here" when the setup's travel details are on (airport, drive times, between rounds), then an optional hotel at the bottom (host hotel, LCA rate, block deadline, booking link).
  - **"Good to know" strip:** rules, byes, refunds, the US Chess membership requirement, a Membership item ("LCA membership required to enter", or "No LCA membership needed" when the event has switched the requirement off; the second wording assumed, see section 5), what to bring.
  - Organizer and TD, share, and add to calendar.
- **Sidebar (from A):**
  - **Registration card** (sticky on desktop): the section picker (a segmented control up to four sections and a select above that; assumed, see section 5), the schedule picker where there are two schedules, the fee ladder with dates showing only the tiers the setup has (one line "Entry fee $50" when only Regular exists; no member price anywhere, D11), the count line by limit mode, the membership line by viewer state ("LCA membership required to enter · $15 a year, added at checkout if you don't have one"; an active member sees their expiry instead; the line is absent when `requires_lca_membership` is off), "You pay today", **Register** and **Register my family** (WS06), then Calendar · Share · Ask the TD. "From $X" on viewer-neutral surfaces (the top card signed out, the link preview, the phone bar signed out) is the lowest entry price across sections; a signed-in member's surfaces show the price for the picked section.
  - **Register my family** shows to a signed-out viewer (it opens the explainer sheet "How family registration works", which advertises the Family membership) and to a signed-in member with an active Family membership. Signed-in Adult, Scholastic and Senior members and an expired Family membership do not see it, except a member who co-guards a child covered by another guardian's active Family plan (WS06's rule, S7.1b, assumed, see section 5); a Family member with no children saved yet sees "Add your family first ›".
  - **Venue & travel summary card:** venue, city, Open in Maps, one parking line, the hotel line when set, and a link to the full block.
  - **Round alerts card** (`RoundAlertsCard`): only for a registered viewer or the guardian of a registered player, by email only, with one switch per registered person; no SMS and no phone-notification toggle (D8, WS07).
  - **Link preview card:** the event's own link (never a filtered view) with Copy link, Share to Facebook and QR code under it.
- **Phones:** every desktop change applies: the registration card inline under the title, chips for sections and schedules, the single-fee bar, no club lines, the registered sheet with the email switch only, Register my family on a phone. A **sticky bottom bar** ("From $40 · Register": the lowest entry price signed out, the picked section's price signed in) opens the registration sheet; once registered it changes to "Registered · Change section or byes". Padding keeps it from covering content, and the sheet scrolls inside itself (D16).
- **Lifecycle (`Event-Final-States`), computed automatically from dates and live state:**
  - *Before:* the registration focus.
  - *During:* round status, My board, Pairings and Standings in the sub nav (WS07).
  - *After:* final standings, prize winners, recap link, crosstable and photos (WS10).
  - A TD override (`display_state`) covers late sections and edge cases.
- **Layouts:** there is one. The `layout` column is not added; the multi-schedule form is derived from the count of non-archived `tournament_schedules` rows; festivals are their own table (below); `display_state` stays as the TD override.
- **Festivals (new):** an admin-created page for big events (`Event-Festival-Final-1` and `-2`), LCA-run events only: a hero photo, tagline and intro, the festival's events with their dates and Register links, a visiting note, blocks, partners and FAQ. Public page `/festivals/:slug`, live only. Admin panel `/admin/festivals/new` and `/:id` (admin only, under WS08's Content group) with Go live, Take offline and Feature on the home page (disabled while draft; one featured festival at a time; cleared by Take offline or the end date). Featuring pins the Featured rung in the home hero (WS03, `homeFeatured`). No bundle pricing: each event keeps its own fees (assumed, see section 5). Behind `festivals`.

**Data model**
```sql
-- 00xx_event_page.sql  (verify each column is not already present; 0052_sections_schedules.sql and 0053 on redesign/ws01-design-system
-- added tournament_sections, tournament_schedules, tournament_schedule_rounds and registrations.section_id and schedule_id, which
-- this migration reuses rather than duplicates)
ALTER TABLE tournaments ADD COLUMN tagline TEXT;
ALTER TABLE tournaments ADD COLUMN championship_title TEXT;                 -- a slug matching state_champions.title (WS10)
ALTER TABLE tournaments ADD COLUMN entry_limit_mode TEXT NOT NULL DEFAULT 'overall' CHECK (entry_limit_mode IN ('overall','by_section'));
-- second schedule, time control, rounds and merge_round live in tournament_schedules and tournament_schedule_rounds (0052); registrations.schedule_id exists since 0052; no ALTER needed
ALTER TABLE tournaments ADD COLUMN parent_event_id TEXT REFERENCES tournaments(id);   -- TEXT, not INTEGER: tournaments.id is TEXT (migration 0001)
ALTER TABLE tournaments ADD COLUMN kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main','side','meeting'));
ALTER TABLE tournaments ADD COLUMN display_state TEXT NOT NULL DEFAULT 'auto' CHECK (display_state IN ('auto','before','during','after'));
ALTER TABLE tournaments ADD COLUMN venue_notes TEXT;
ALTER TABLE tournaments ADD COLUMN good_to_know_json TEXT;
ALTER TABLE tournaments ADD COLUMN travel_json TEXT;                        -- "Getting here" and the hotel, inside Venue & travel
ALTER TABLE tournaments ADD COLUMN requires_lca_membership INTEGER NOT NULL DEFAULT 1;   -- the Fees step's "LCA membership: Required to enter (default) · Not required" (D12)
-- Per-section caps live in tournament_sections.cap (0052); the 0053 sync never touches cap, so the setup writes it to the table, not to the sections JSON. max_players stays as the overall limit.
-- site_settings row membership_required_for_all (admin only, default off; D12): verify first, no migration creates a site_settings
-- table yet; create it here as a key-value table if it is still absent; flipped from the /admin Site group (WS08).
-- Not added: layout; public_minor_names (the entrants rule in WS04 and D15 replaces it).
```
Existing fields to reuse are `round_schedule` (JSON), `time_control`, `registration_status`, `registration_closes_at`, `is_visible`, `end_date`, the section, entry-fee and prize-fund data (the `tournaments.sections` JSON, which the 0053 triggers sync into `tournament_sections`; `cap`, `fee_early` and `fee_late` live only on the table) and the pricing inputs read by `entryPrice` in `domain/registration/pricing.ts` (`functions/utils/pricing.ts` and `src/lib/pricing.ts` re-export it), which no longer reads `member_discount` (retired, D11): the helper takes the section, its tier dates and the date, nothing about the viewer, so `entryPrice` loses its `isLcaMember` option and its "LCA member discount" line.

```sql
-- 00xx_festivals.sql
CREATE TABLE festivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, city TEXT, venue TEXT, hero_photo_url TEXT,
  tagline TEXT, intro TEXT, visiting_note TEXT, blocks_json TEXT, visit_json TEXT, partners_json TEXT, faq_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','offline')),
  featured INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES members(id), created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT
);
CREATE TABLE festival_events (
  festival_id INTEGER NOT NULL REFERENCES festivals(id), tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  position INTEGER NOT NULL, PRIMARY KEY (festival_id, tournament_id)
);
```

**API**
- Extend `GET /api/tournaments/[id]` (`functions/api/tournaments/[id].ts`) with these computed fields:
  - `state` (before/during/after)
  - `entry_limit_mode`, and per-section `entered` / `cap` / `fee_now` / `next_fee_change`
  - `schedules` and `merge_round` (read from `tournament_schedules` and `tournament_schedule_rounds`, 0052), `side_events[]` (child rows with their own counts and caps), `travel`, `tagline`, `championship_title`, `requires_lca_membership`
  - `myPeople[]` in place of `myRegistration`: everyone the viewer acts for, with each one's entry (WS06)
  - It no longer returns the public roster with full names: `GET /api/events/:id/entrants` (WS04) does that, under the D15 rule.
- The pricing helper, `entryPrice` in `domain/registration/pricing.ts` (`functions/utils/pricing.ts` and `src/lib/pricing.ts` re-export it), takes the section, its tier dates and the date, nothing about the viewer; `member_discount` is no longer read and the `isLcaMember` option goes (D11). Its callers follow: `functions/api/registrations/batch.ts` and `functions/api/registrations.ts` (WS06) and the admin PATCH (WS08).
- Festivals: `GET /api/festivals/:slug` (public, live only); `GET`, `POST` and `PATCH /api/admin/festivals` and `/:id`, `POST /api/admin/festivals/:id/go-live`, `/take-offline` and `/feature` (`requireAdmin`, audited); `/api/home` reads the featured festival (WS03).
- Admin writes go through the existing `functions/api/admin/tournaments/[id].ts`, using the dirty-diff PATCH pattern from the TournamentManagePage redesign, with `requireTournamentManager`.

**Frontend**
- Change: `src/pages/TournamentDetailPage.tsx`, splitting it into components; its "LCA members save $X on entry" line goes with the rewrite (D11).
- Reuse: `PrizeWinners`, `PreviewBanner`, `RegistrationReminderButton`, `StatusBadge`.
- New: `src/components/event/FactTiles.tsx`, `EventSubNav.tsx` (in place of the planned `ChampionshipTabs`), `RegistrationCard.tsx` (the section and schedule pickers, the fee block, the count line by limit mode, the membership line), `RegisterFamilyButton.tsx` (with the explainer sheet), `MobileRegisterBar.tsx`, `SectionsGrid.tsx` and `SectionsAndPrizes.tsx` (the two forms), `ScheduleList.tsx` (one or many schedules, the merge row), `SideEvents.tsx`, `PrizeTable.tsx`, `WhosComing.tsx` (the rating-sorted table with section chips, fed by the entrants endpoint; in place of the planned `EntriesList`), `VenueTravelBlock.tsx` (the Venue & travel block) with `TravelBlock.tsx` (the "Getting here" and hotel parts), `VenueTravelCard.tsx` (the sidebar summary), `GoodToKnow.tsx`, `RoundAlertsCard.tsx`, `LinkPreviewCard.tsx`, `LifecycleSwitch.tsx`; `src/pages/FestivalPage.tsx` and `src/components/admin/FestivalsPanel.tsx`. `FestivalSchedule.tsx` and `ChampionshipTabs.tsx` are not built.

**Jobs & integrations:** none new. The featured festival is cleared by its end date in the `daily-emails` run (or computed on read).

**Acceptance criteria**
1. At 390 px, the price and a Register control are visible without scrolling past the entries list, and the sticky bar never hides content.
2. Every time control shows its plain-language companion.
3. With limits by section, each capped section shows "N of cap" and the date of the next price change; with an overall limit the section cards show "N entered" and no bar; with no limit the page shows the entered count and no bar.
4. Who's coming shows under-18s (an active guardian link, or a ticked eligibility box on the entry) as first name and last initial and adults in full, from `GET /api/events/:id/entrants`; TD, admin and US Chess report views keep full names; results, standings and winners keep full names (D3, D15).
5. The state switches automatically from before to during to after, and the TD override wins.
6. The sub nav is deep-linkable and keyboard accessible on every event; Pairings and Standings are `aria-disabled` before the event.
7. JSON-LD and OG meta (WS04) are present on every event page.
8. The card's fee block shows only the tiers the setup has; with Regular alone it shows one line. No surface shows a member price (D11).
9. Register my family renders only for a signed-out viewer or a viewer who meets WS06's Family rule (own active Family membership, or one held by another guardian that covers a child they guard; assumed, see section 5); the explainer sheet opens signed out.
10. With two schedules the card and the family picker require a schedule choice and store it on the registration.
11. No club name renders in Who's coming.
12. Round alerts render only for a registered viewer or the guardian of one, with one email switch per registered person and no SMS or phone option.
13. The membership line reads "LCA membership required to enter · $15 a year, added at checkout if you don't have one" signed out or without an active membership, shows the expiry for an active member, and is absent when `requires_lca_membership` is 0; Good to know's Membership item follows the same switch, and `membership_required_for_all` overrides it.
14. A festival page renders only while `status = 'live'`; Feature on the home page is disabled while draft, pins one festival at a time, and is cleared by Take offline or the end date.

**Tests:**
- Unit: state computation, the fee ladder and next-change logic (no viewer input), and the entry-limit arithmetic (the TD's overall number, the sum of caps, blank caps).
- Integration: `/api/tournaments/[id]` returns no full names for players with an active guardian link; the entrants endpoint rule and `full=1` gating (WS04 tests).
- Integration: `requires_lca_membership` on and off, and `membership_required_for_all` overriding it.
- Integration: festivals (a draft page is 404 publicly; one featured at a time; Take offline clears featured).
- Extend `lifecycle.test.ts`.

**Depends on:** WS01, WS04 (share meta), WS06 (the sheet opened by Register and the family model behind Register my family) and WS07 (the during state). The festival page and `/admin/festivals` ship with WS05 and feed WS03's Featured rung (`homeFeatured`).
**Risks & open decisions:** TDs have to enter more data per event (caps, price dates, venue notes); WS08's setup checklist makes this a one-page job.

---

## WS06 · Registration & households
**Why:** Baymard puts average checkout abandonment at about 70%:
- Unexpected extra costs cause 40% of it.
- Forced account creation causes 18% (24% in Baymard's 2022 survey).
- The average checkout has 11.3 fields where 8 are enough.

GOV.UK's pattern is to ask eligibility first, end with "check your answers", and confirm with "what happens next". One checkout for a whole family is LCA's edge over KingRegistration. A parent registering children without logins is a real need K has named.

**Canvas boards:**
- `Reg-C`: the household checkout, the core model, decided with the family model below; its decided board is drawn when WS06 starts, so until then build from `Reg-C`, `Event-Final-Family` (the picker) and the picker content below.
- `Reg-A`: the in-card flow on desktop, the same engine's second presentation.
- `Reg-B`: one question per screen on phones, the third presentation.
- `Reg-D`: guest entry.
- `Event-Final-Family`: the "Who's playing?" picker, the signed-out explainer and the phone picker.
- `Account-B`: the family parts, as amended by WS13's family section.

**User-facing scope**
- **Household model:** a household is a guardian plus the player profiles they guard. Each child is a `members` row (`child-<uuid>`, kept for life) linked through `member_guardians` (an owner plus any number of guardians, each with their own login). Links end with `ended_at` and `ended_reason` and are never deleted. Children need no email or login. A login can be attached later with `members.auth_user_id`, from age 13, with recorded guardian consent. A second guardian is in scope now, not later. Build on today's children (`functions/api/me/children.ts`, `children/[id].ts`, `functions/utils/family.ts`, `src/components/family/FamilyRegistrationPanel.tsx`, `FamilyCard.tsx`); the model is set out under "Family accounts: one player, one profile" below.
- **One registration engine, three presentations:** the household checkout `/tournaments/:id/register` (Reg-C, the core), the in-card flow on the event page on desktop (Reg-A) and the full-height one-question sheet on phones (Reg-B). The guest path (Reg-D), the waitlist, holds and refunds stand.
- **"Register my family" visibility:** the button shows to signed-out visitors, where it opens "How family registration works" with a sample picker and a one-form path that creates the parent's login and first child, and to signed-in people with an active Family membership, their own or one held by another guardian that covers a child they guard (the co-guardian case is S7.1b, assumed, see section 5). Everyone else sees "Register", whose "Who's playing?" step still lists saved children, so no parent is stranded.
- **Who's playing picker** (step 1; the picker's full content is set out below, after the family flows): tick players, pick an eligible section or side event per player (each option shows its fee and entered count only, never a member price), choose a schedule per player where there are two, check each name (the entrants-list form and the results form), and tick a required "These names are spelled the way they should appear on pairings and results". A running total updates live. A child already entered by another guardian is locked with "Already registered by Marc R. for K-8". Edit name locks once the child is checked in to a running event. More than 9 players gets a plain second-order message. One `registration_orders` row spans the main event and its side events.
- **Steps:**
  1. **Who's playing?** the picker above: me, saved children, add a family member inline (first name, last name, optional US Chess ID; no email), or someone else (guest); a section or side event per person, the eligibility checkbox before any scholastic section, a schedule per person where there are two.
     - **Section rules, per player:** only eligible sections are selectable, using `sectionRules.ts`, ratings and playing-up rules. A "Which section fits me?" helper is available.
     - **Eligibility per entry:** "In 8th grade or below?" is asked on each entry and saved in `registrations.eligibility_json`, never on the profile; the checkbox leaves the Add-a-child form.
  2. **Byes and US Chess IDs:**
     - **Byes:** checkboxes per round, up to rounds − 1, respecting the half-point bye rules.
     - **US Chess:** inline lookup (`uscf/lookup`) autofills name, rating and expiry. If the membership expires before the event: "Your US Chess membership ends Nov 30, before this event. Renew →".
  3. **LCA membership:** required when the event requires it (`requires_lca_membership`, D12) and any player in the order lacks an active membership; skipped otherwise. For each such person the step offers the tier that applies (Adult, Scholastic for a K–12 player, Senior at 65 or older, or Family when it covers the household more cheaply), using the WS12 household optimizer to pick the cheapest valid combination: Family covers the guardian and up to 3 children, and a 4th child is added with a Scholastic membership ($5) in the same payment. The membership is paid in the same payment as the entries. Which tier fits is derived without asking for age or grade, since LCA stores no age, grade or birthdate: a player with an active guardian link (a child profile) gets Scholastic; an adult is asked whether they are 65 or older, as `/membership` asks; Family is offered when it covers the household more cheaply (the WS12 optimizer).
  4. **Check your answers:** one line per player at the price paid, one total. The price shown is the price paid, with no separate card-fee line (D2); the Reg-C board's "Card processing" line is dropped.
  5. **Pay:** Stripe Checkout in the same tab.
  6. **Confirmation:**
     - One confirmation card per player with its own Withdraw link.
     - What happens next: check-in time, add to calendar, a manage link, how to request a bye change.
     - One receipt to the payer and one confirmation email per player, through the receipt system below.
- **Teen self-entry:** a child with her own login can choose "Ask my guardian to pay" at Check your answers, which creates an unpaid held entry that shows as rank 1 in each guardian's Needs attention (WS13); a guardian pays in one tap. If a guardian has already entered her, her own attempt is blocked with "Already registered by Danielle R. for U1400".
- **Guest entry (Reg-D):**
  - No account needed, at most 8 fields, and a US Chess ID autofill.
  - The manage link is emailed with a signed token.
  - After payment: "Save these details, create an account", prefilled. Accepting it turns guest child rows into managed profiles under the new login, so results stay attached and no merge is needed. A US Chess ID typed in Add a child converts a guest row only when the guest entry's payer email is the signed-in parent's.
- **Entrants list:** first name and last initial while the player has an active guardian link or the entry's `eligibility_json` is set. Pairings, standings, results and winners show full names (D3, D15).
- **Emails:** every sender uses `recipientsFor(memberId)` (`functions/utils/recipients.ts`), grouped per address. Receipts go to the payer only.
- **Receipts, one system for every payment** (D14): today no LCA receipt exists (the only post-payment email is "You're registered", memberships and donations send nothing, and Stripe's own receipt goes out separately). For every completed payment (registration orders, memberships, donations, walk-in card payments) the site sends **one receipt to the payer** ("Receipt: 2027 Paul Morphy Open, 3 players · $87.00": one line per player or item with its amount, the date with weekday, the last four digits of the card, the Stripe reference, a link to the order in My LCA, and the refund rule in one line) plus **one confirmation per player** ("You're registered: …", the existing template, grouped per recipient as today, without the Paid total, which the receipt carries). Stripe's email receipts are turned off in the Stripe dashboard so nobody gets two. The confirmation for a mixed order (free and paid entries) is sent once, when the order completes, not once for the free entries and again at the webhook. Receipts can be re-sent from My LCA ("Send me this receipt again") and from the admin's payment row.
- **Waitlist:**
  - When a section is full, join the waitlist; the waitlist is per section when the event's limits are by section (WS05).
  - When a spot opens, the next person gets a claim link valid for 24 hours. If it expires, the offer moves to the next person automatically.
- **Holds:** starting checkout holds the seats for 15 minutes so they can't be oversold.
- **Duplicate guard:** the same US Chess ID or name in the same event and section, and an entry already made for the same `member_id` by another guardian.
- **Limits:** one order holds up to 9 players (`MAX_ENTRIES` in `functions/api/registrations/batch.ts`): "One order holds up to 9 players. Pay for these 9, then start a second order for the rest." A family list holds up to 8 profiles (`MAX_CHILDREN`, today in `functions/api/me/children.ts`): the add link is disabled with "Your family list is full (8)". The server refuses a 9th profile and a 10th player.
- **Scholastic emergency contact** (assumed, see section 5): asked once on the owner's account (`Account-B`; verify: the board's field, and add a column on the owner's `members` row if none exists), reused on each child's scholastic entry (`registrations.emergency_contact_json`), shown only to that event's TD and never on public pages.
- **No financial questions (D5):** LCA doesn't run fee waivers or ask about need or lunch status. Drop the lunch-status discount shown on the Event-A and Schol-A option boards.
- **Refunds:** per player, even when several players were paid in one order.

**Family accounts: one player, one profile** (the model behind WS06, WS07, WS08, WS12 and WS13; `DESIGN_REPLAN_phase1.md` section 7 has the reasoning)
- **Identity.** Each person who plays has exactly one player profile, a `members` row whose id never changes: children keep `child-<uuid>`, adults keep their Supabase id. Registrations, payments, pairings, rating at entry, results, reminders and the card QR all point at that id, so nothing moves when a login is added or a guardian changes. A profile is identified by its US Chess ID when it has one (unique across non-guest profiles), then by its full name plus its household (TDs see "Robichaux family · Danielle Robichaux"), then by the per-profile QR on the digital card. Email is not part of a player's identity; it belongs to a login.
- **Logins.** A login is attached to a profile through `members.auth_user_id`. Adults need no change: when `auth_user_id` is empty, sign-in falls back to today's rule, where the member id equals the Supabase id. A child has no login until a guardian gives her one, offered only after the guardian ticks "Maya is 13 or older" and a consent checkbox, both saved with a timestamp (assumed, see section 5); she sets her own password from the invite and her existing row gets the login. A guardian can remove the login while she is under 18, and her history stays.
- **Guardians.** `member_guardians` links a profile to every adult who can act for it. One link is the owner, also kept in `members.guardian_id` so today's queries keep working; the others are guardians with their own logins. Links are never deleted; they end with a date and a reason (`left`, `removed`, `handed_over`, `turned_18`), so there is a record if households disagree. The owner can invite or remove guardians and hand ownership to another guardian (only the owner removes; co-guardians can only leave; assumed, see section 5). A guardian can leave. The last active guardian of a child with no login cannot leave. Co-guardians see each other as first name and last initial.
- **Duplicates, with no volunteer work.** A request to be added as a guardian never confirms that a named child exists: it answers "Request sent", goes to the owner and is never granted automatically. A US Chess ID already on LCA blocks a second profile and offers the request instead. History moves between two rows only when they are provably the same person (the names match, the US Chess IDs do not conflict, the row being absorbed has no children and no staff roles, and the two rows are not both entered in the same event); every move is written to `profile_moves` so a developer can reverse it; an empty self-made row is simply absorbed; anything else is refused with a plain message and never goes into a volunteer queue (assumed, see section 5).
- **Family plan.** On each guardian link the guardian ticks which children their plan covers (`family_covered`), up to 3, chosen at purchase and at renewal; an open spot can be filled at any time, and the ticks otherwise change at renewal (assumed, see section 5). With two households each guardian's plan can cover the child, and the later expiry wins. A fourth child is offered Scholastic $5 in the same checkout (WS12).
- **Notifications.** `recipientsFor(db, memberId)` decides who gets each email: the player's own login email if she has one, plus every active guardian with copies on; a guardian's address is read live from their own row; while a child has no login at least one guardian keeps copies on; mail is grouped per address, so a parent of three gets one email per send; receipts go only to the payer; if a teen's address bounces, her mail goes to her guardians and her card shows "Maya's email isn't receiving mail · Update". Texts follow the same rule when SMS exists (D8).
- **Display and data minimum.** On the pre-event entrants list a player shows as first name and last initial while any guardian link is active or the entry ticks a scholastic eligibility box; pairings, standings, results and winners show full names (D15). LCA stores no birthdate, grade or age, and no child email unless the child takes a login at 13 or older.

**Family flows** (`DESIGN_REPLAN_phase1.md` section 7.3 has the full copy)
- **Add a child** (My LCA > Family > "Add a family member", also inline in step 1 of the checkout): first name, last name, US Chess ID (optional) with "Look up by name" (`/api/uscf/lookup`, which shows the US Chess spelling: "US Chess has: ROBICHAUX, LEO · Use this spelling"); no email, grade or birthday; helper "Leo gets his own player profile. He doesn't need an email. You can give him his own login when he is 13 or older."; button "Add to the family"; the line under it shows the plan spot ("Your Family plan covers 3 children · 1 spot left", or that a 4th child is added with a Scholastic membership). `POST /api/me/children` inserts the `members` row as today plus one `member_guardians` row (kind `owner`, `family_covered` 1 if a spot is open). A name already in this family returns 409 as today ("You already have a Leo Robichaux in your family"). A US Chess ID already on a non-guest profile creates nothing and says "This US Chess ID is already on an LCA player profile. If this is your child, ask to be added as a guardian. The family that added it can approve you." with the button "Send request"; after sending, the parent sees only "Request sent", and a matching name with no ID reveals nothing. A US Chess ID matching a walk-in guest row becomes this child only when that guest entry's payer email is the parent's signed-in email. The child card appears with "No login · emails come to you".
- **Buy a Family membership** (WS12): the "Who's covered?" screen, the 4th child as Scholastic $5 in the same payment, no child email, and the success page listing who is covered.
- **Register my family from an event page:** the picker, then Byes, US Chess, LCA membership (only if someone needs one), Check your answers and Pay. One `registration_orders` row with `payer_member_id` set to the signed-in guardian and one `registrations` row per player (`player_kind` `dependent` for children) with `eligibility_json` saved per entry. One confirmation card per player with its own Withdraw link, and one grouped email per recipient.
- **A parent's view of a child:** no account switching. My LCA > Family shows one card per child and the filter chips "Everyone · Maya · Leo"; "Open Maya's page" goes to `/me/players/:memberId`, the same component Maya sees on her own login (entries, byes, pairings, results history, reminders, card QR) with the strip "Maya Robichaux · you manage this profile". On event days the Family day view shows each child's round, board, colour, opponent and result side by side, from `GET /api/me/event-mode` `players[]` read from `member_guardians` (WS02, WS13). On the event page the WS07 "My players" strip reads "Maya: Board 4, White · Leo: Board 12, Black", and `myPeople[]` covers everyone the viewer acts for. Reminder and round-alert choices are set per child on the child's page and owned by the parent.
- **A child later gets her own login:** "Give Maya her own login" asks for her email, a required "Maya is 13 or older" checkbox and a required "I'm Maya's parent or guardian and I agree she can have her own LCA login" checkbox (both saved with a timestamp; no age stored), then "Send Maya an invite" (single use, valid 14 days) or "Copy invite link". Maya gets "Danielle set up your LCA login" with "Set my password". On accept: a new login sets `auth_user_id` on her existing row; an existing login with no registrations or payments is absorbed; one with history passes the same-person check and offers "Move your 4 past events onto this profile" with a Confirm button (logged in `profile_moves`), or is refused with "This email already belongs to a different LCA player. Use another email" and nothing changes. `members.email` becomes her address and `claimed_at` is set. The card then reads "Maya has her own login · since Sat, Oct 10" with a "Send me copies" toggle (on by default) and "Remove Maya's login".
- **A teen with her own login:** her own My LCA with her entries, pairings, results, reminders and card; she can register herself and choose "Pay now" or "Ask my guardian to pay"; she cannot add children, remove guardians or see guardians' receipts, card details or siblings' profiles. Each guardian can turn off their own copies; she cannot turn guardians' copies off before she manages her own profile (assumed, see section 5).
- **A second guardian and two households:** Family > Guardians > "Invite a guardian" (their email, the children ticked, all by default); accepting adds a `member_guardians` row (kind `guardian`) per child, and they can register, pay with their own card, see the day view, get their own copies and tick their own Family plan to cover the child. The other route in is "Send request" from Add a child: the owner gets "A parent or guardian asks to be added for Leo. Approve / Decline", and on approval a duplicate profile the requester made passes the same-person check and offers "Move Leo's 2 entries onto this profile". The owner can remove a guardian (`removed`) or hand over ownership; a guardian can leave; the last active guardian of a child with no login is blocked with "Invite another guardian or give Leo his own login first."; if the owner closes their login, the longest-standing guardian becomes owner. The pairing engine's `keep_apart` 'family' means sharing any active guardian.
- **Turning 18:** LCA never stores a birthday, so a person makes the change. The owner's "Maya is 18: hand over her profile" takes effect at once (`handed_over`). Maya's own "I'm 18 or older: manage my profile myself" in Settings takes effect after 7 days; her guardians are emailed at once with a "This isn't right" link, and if any guardian cancels, a second request needs the owner's approval (assumed, see section 5). Either route needs her own login first, so the button reads "Give Maya her own login first" until she has one. On release every guardian link gets an `ended_at`, `guardian_id` becomes NULL, paid coverage runs to its expiry, and her Family spot opens at the next renewal ("Maya now manages her own profile · Adult $15"); guardians get one email, "Maya now manages her own LCA profile." From then on her full name shows on entrants lists and email goes only to her.
- **A TD looking up a child** and **a walk-in child becoming a profile** are in WS08's check-in.

**The "Who's playing?" picker, content** (`Event-Final-Family`; the replan's section 7.5 as amended by its sections 11 and 12)
- **Event page action area.** Signed out: button "Register my family" with the line "One checkout for you and your children. See how it works", opening the sheet "How family registration works" with the picker filled with the sample Robichaux family and the buttons "Get a Family membership · $25 a year" (the explainer line under it reads exactly "Everyone on the plan gets a LCA membership"), "Start: create your login" and the link "I already have a login: sign in". Signed in and meeting the Family rule above: "Register my family". Everyone else signed in: "Register", whose first step is the same picker.
- **Page** `/tournaments/:id/register`. Heading "Who's playing?"; subheading with the event, dates with weekdays and city ("2027 Paul Morphy Open and Morphy Scholastic · Sat–Sun, Jun 12–13, 2027 · New Orleans"); intro "Tick everyone who is playing, choose a section for each, and check each name. Names appear on pairings and results exactly as shown here."
- **One row per person the viewer can register,** everyone unticked at first. A row shows the name, a detail line ("Rating 1102 · US Chess ID ending 7731 · On your Family plan"), the public-name line ("Entrants list before the event: Maya R. · Pairings and results: Maya Robichaux"), Edit name, and once ticked the required Section select, whose options show the fee and the entered count only ("Morphy Scholastic K–8 · Sat only · $25 · 9 of 48 entered"; side events in the same select, so a child can be placed in the Scholastic from the picker). A hint under the select names the sections not shown and why ("Not shown: U1000 (1102 is over 1000). Show K–5, K–3, U1800 and Open"). When a scholastic section is chosen its eligibility checkbox appears ("Maya is in 8th grade or below (required for this section)") with the help "One yes or no. We never ask for a grade or a birthdate." With two schedules, a Schedule choice follows the section.
- **Row states.** Locked: "Already registered by Marc R. for K-8" (the checkbox is disabled). Edit name locked: "Checked in. Ask the director to fix the name." Not covered: "Not on your Family plan. An LCA membership (Scholastic $5) is added in step 3." (shown only when the event requires a membership; wording assumed, see section 5). 10th person: "One order holds up to 9 players. Register the rest in a second order."
- **Under the list:** the link "Add a family member" (first name, last name, US Chess ID optional; no email), with the plan line ("Your Family plan covers 3 children · 1 spot left"; when the plan is full, that a 4th child is added with a Scholastic membership, still allowing the add; disabled at 8 profiles with "Your family list is full (8)"). Note under it: "Only the Family membership is shared. Each player pays their own section's entry fee."
- **Name confirmation** (required): "These names are spelled the way they should appear on pairings and results." Error if left unticked: "Check the names, then tick the box to confirm them."
- **Running total** (sticky on phones, a side panel on desktop; updates live): one line per player ("Maya · Morphy Scholastic K–8 · $25"), the count and total ("2 players · $50"), and the footer "Entry fees only. Anyone without an LCA membership gets one added in step 3. No card fees are added at payment."
- **Continue:** "Continue with 2 players · $50", disabled until each ticked player has a section, any eligibility box their section needs and a schedule where there are two, and the names box is ticked; helper "Choose a section for Leo to continue." Next: byes, the US Chess check, LCA membership when someone needs one, then Check your answers.
- **Phones:** the options show no price or count under the selector (they are in the sheet that opens); the detail line under each name is gone and the one essential sits beside the name ("Maya Robichaux · 1102", "Leo Robichaux · unrated"); the public-name line lives in the Edit name sheet; the picker scrolls inside the sheet and the sticky total never covers a focused control (D16).

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
ALTER TABLE registrations ADD COLUMN eligibility_json TEXT;   -- e.g. {"grade_8_or_below": true}; asked per entry, never on the profile
ALTER TABLE registrations ADD COLUMN emergency_contact_json TEXT;   -- the scholastic emergency contact, copied from the owner's account on a child's scholastic entry (assumed, see section 5)
CREATE TABLE waitlist_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  registration_id INTEGER NOT NULL REFERENCES registrations(id),
  offered_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','expired'))
);
CREATE TABLE stripe_events (
  event_id TEXT PRIMARY KEY,                      -- Stripe's event id, inserted before any email is sent (D14)
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

```sql
-- 00xx_player_profiles.sql  (the replan's 0052_player_profiles.sql, numbered in landing order; all additive, no members rebuild)
ALTER TABLE members ADD COLUMN auth_user_id TEXT;
CREATE UNIQUE INDEX idx_members_auth_user ON members(auth_user_id) WHERE auth_user_id IS NOT NULL;   -- no backfill for adults
ALTER TABLE members ADD COLUMN claimed_at TEXT;
CREATE TABLE member_guardians (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL REFERENCES members(id),
  guardian_member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL DEFAULT 'guardian' CHECK (kind IN ('owner','guardian')),
  send_copies INTEGER NOT NULL DEFAULT 1,
  family_covered INTEGER NOT NULL DEFAULT 0,
  added_by TEXT REFERENCES members(id),
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  ended_reason TEXT CHECK (ended_reason IN ('left','removed','handed_over','turned_18'))
);
CREATE UNIQUE INDEX idx_member_guardians_active ON member_guardians(member_id, guardian_member_id) WHERE ended_at IS NULL;
CREATE INDEX idx_member_guardians_guardian ON member_guardians(guardian_member_id);
-- Backfill, written in one db.batch: one 'owner' row per members row whose guardian_id IS NOT NULL; family_covered = 1 where fewer
-- than 3 siblings (same guardian_id) have an earlier created_at (ties broken by rowid), which matches today's syncFamilyCoverage.
-- members.guardian_id stays and always equals the active owner.
CREATE TABLE profile_invites (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('claim','guardian','guardian_request','release')),
  member_ids TEXT NOT NULL, invited_email TEXT,
  invited_by TEXT NOT NULL REFERENCES members(id),
  token_hash TEXT UNIQUE,
  confirmed_13_plus INTEGER NOT NULL DEFAULT 0, consent_at TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined','cancelled','expired')),
  expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE profile_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_member_id TEXT NOT NULL, to_member_id TEXT NOT NULL REFERENCES members(id),
  moved_json TEXT NOT NULL, moved_by TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('claim','guardian_request')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Preflight against production before the index:
--   SELECT uscf_id, COUNT(*) FROM members WHERE uscf_id IS NOT NULL AND role != 'guest' GROUP BY 1 HAVING COUNT(*) > 1;
CREATE UNIQUE INDEX idx_members_uscf_unique ON members(uscf_id) WHERE uscf_id IS NOT NULL AND role != 'guest';
```
No birthdate, grade or child-email columns. `members.email` stays NOT NULL and holds the owner's address for unclaimed children, but nothing reads it for sending. There is no `dependents` table: today's children rows are the player profiles, and `registrations.player_kind` keeps `dependent`.

**API**
- `POST /api/registrations/orders` (new): creates an order plus held registrations. It checks the section cap and the overall limit by `entry_limit_mode`, holds seats per section and waitlists per section when limits are by section; it rejects an entry already made for the same `member_id` by another guardian and refuses more than 9 players with the plain second-order message. Extend `functions/api/registrations/batch.ts` (it already handles family batches and holds `MAX_ENTRIES = 9`) rather than duplicate it.
- `POST /api/registrations/orders/:id/checkout` (new): creates a Stripe Checkout Session with one line item per player, plus the membership lines from step 3, and `metadata.order_id`.
- `functions/api/stripe/webhook.ts`: handles `checkout.session.completed` for orders. It inserts the Stripe event id into `stripe_events` first and stops on a duplicate, so it is idempotent before any email is sent (replacing today's read-then-write guard, which can double-send under concurrent deliveries); then it marks every registration in the order paid, activates any membership in the order, and calls `sendRegistrationConfirmations(orderId)` and `sendPaymentReceipt(orderId)` from that one place; a membership bought inside an order is a line on the order's receipt and sends no second receipt.
- `GET /api/registrations/manage/:token` and `POST .../withdraw` (new; signed token): guest self-service.
- `POST /api/registrations/:id/waitlist-claim/:token` (new).
- `POST /api/admin/registrations/:id/refund` (new; `requireTournamentManager`): refunds one line.
- `GET /api/uscf/lookup` (existing): reused inline.
- Family (new): `GET /api/me/family`; `POST /api/me/children/:id/invite-login` `{email, is13Plus, consent}`; `DELETE /api/me/children/:id/login`; `POST /api/me/family/guardians/invite` `{email, memberIds[]}`; `POST /api/me/children/guardian-request` `{uscfId or fullName}`; `POST /api/profile-invites/:token/accept` and `/decline`; `PATCH /api/me/children/:id/guardians/me` `{send_copies}`; `DELETE /api/me/children/:id/guardians/:guardianId` (the owner removes, or a guardian leaves); `POST /api/me/children/:id/release` (owner); `POST /api/me/release` and `POST /api/profile-invites/:id/cancel-release`; `GET /api/admin/tournaments/:id/checkin-search?q=` (WS08).
- `GET /api/me/event-mode` (WS02) reads `players[]` from `member_guardians`; `GET /api/tournaments/[id]` (WS05) returns `myPeople[]` in place of `myRegistration`.

**Code changes** (the family model)
- `functions/utils/auth.ts` `requireAuthedMember` and `optionalAuthedMember`: select by `auth_user_id = user.id`, else by `id = user.id AND auth_user_id IS NULL`.
- `functions/utils/members.ts` `upsertMemberFromAuth`: resolve the same way and update the email on the resolved row; refuse a signup US Chess ID that is on a managed profile with "Ask your parent or guardian to give you your own login from My LCA".
- The places that use `user.id` as a member id switch to `member.id` (the replan counts 17; verify: count them).
- `functions/utils/family.ts`: `canActFor` and `listChildren` read active `member_guardians`; `syncFamilyCoverage(db, guardianId)` covers that guardian's links where `family_covered = 1`, at most 3, keeping the later expiry; `MAX_CHILDREN` (8; today in `functions/api/me/children.ts`) counts active links.
- `functions/api/me/children/[id].ts`: PATCH name is refused once the child is checked in to a running event; DELETE only by the sole active guardian, and only with no registrations or payments.
- `functions/api/registrations/batch.ts` keeps its shape, uses the new `canActFor`, rejects an entry already made for the same `member_id` by another guardian, and returns the plain over-9 message.
- `functions/api/registrations/batch.ts` and `functions/api/registrations.ts` stop passing `isLcaMember` to `entryPrice` (D11; the helper itself changes in WS05).
- The public event endpoint abbreviates names under the entrants rule and returns `myPeople[]` in place of `myRegistration`.
- `generate-pairings` `familyOf`: any shared active guardian.
- `functions/api/admin/impersonate/[memberId].ts` allows a child only when `auth_user_id` is set.
- New `functions/utils/recipients.ts`, used by `registrationEmails.ts`, the reminder senders and `workers/daily-emails`; new `functions/utils/receipts.ts`.

**Frontend**
- Change:
  - `src/pages/RegisterPage.tsx`
  - `src/components/family/FamilyRegistrationPanel.tsx`, `FamilyCard.tsx`
  - `src/components/uscf/UscfSearchInput.tsx`, `UsChessMembership.tsx`
  - `src/lib/pricing.ts` (a re-export of `domain/registration/pricing.ts`, which WS05 changes: no viewer input, D11), `src/lib/family.ts`
- New: `src/components/registration/RegistrationFlow.tsx` (the engine), `WhoStep.tsx` (the picker), `SectionStep.tsx`, `ByesStep.tsx`, `UsChessStep.tsx`, `MembershipStep.tsx` (required when the event requires it; in place of the planned `MembershipAddOn.tsx`), `ReviewStep.tsx`, `ConfirmStep.tsx`, `RegistrationSheet.tsx`, `FamilyExplainerSheet.tsx`; `src/pages/PlayerPage.tsx` (`/me/players/:memberId`); `src/components/family/AddFamilyMemberForm.tsx`, `InviteLoginSheet.tsx`, `GuardiansPanel.tsx` (WS13 renders it).

**Jobs & integrations**
- Stripe Checkout and refunds. Stripe's own email receipts are turned off in the Stripe dashboard.
- Resend for receipts, confirmations, manage links and waitlist offers: `sendRegistrationConfirmations` in `functions/utils/registrationEmails.ts` stays as the player-confirmation sender, extended to take an order id; the new `sendPaymentReceipt(orderOrPaymentId)` in `functions/utils/receipts.ts` sends the receipt through the branded email layout; both are called from the webhook's order completion and from the free-order path. Membership activation and donations (WS12) and walk-in card payments (WS08) call `sendPaymentReceipt` too. Recipients come from `recipientsFor`.
- A cron in `daily-emails`, or a short-interval job, expires holds, waitlist offers and the 14-day profile invites.

**Acceptance criteria**
1. A guardian registers herself and two children in different sections with one payment. The result is three registrations under one order, and replaying the webhook changes nothing.
2. Only eligible sections can be selected. Eligibility is asked as a checkbox on each entry, never as a grade or birthdate, and never stored on the profile.
3. The total on "Check your answers" equals the amount Stripe charges, and no card-fee line appears anywhere; the Reg-C board's "Card processing" line is gone (D2).
4. A guest completes registration in 8 fields or fewer, receives a manage link, and can withdraw.
5. A US Chess membership that expires before the event is flagged inline with a renewal link.
6. Waitlist offers expire after 24 hours and move to the next person automatically.
7. Holds release after 15 minutes. Under concurrent checkouts a section is never oversold (race test), with the section cap and the overall limit both enforced by `entry_limit_mode`.
8. A partial refund of one player in a three-player order succeeds, and the order shows `partially_refunded`.
9. Every completed payment, including an order that carries a membership line, produces exactly one receipt to the payer and one confirmation per player, verified by the integration harness's email outbox under a replayed and a concurrent webhook delivery.
10. Memberships and donations produce a receipt.
11. A mixed free-and-paid order produces one confirmation per player, not two.
12. An order of 10 players is refused with the second-order message and 9 is accepted; a 9th profile is refused with "Your family list is full (8)"; a child already entered by another guardian is locked in the picker and refused by the server.
13. When the event requires a membership, an order with a player who lacks an active one cannot reach Pay without the membership step, and the membership is a line in the same Stripe session; when `requires_lca_membership` is 0 the step is skipped.
14. Register my family renders for a signed-out visitor and for an active Family member (own, or held by another guardian covering a child the viewer guards), and for nobody else; the explainer sheet's one-form path creates the login and the first child and lands on the picker.

**Tests:**
- Extend `test/integration/family.test.ts` (`member_guardians`, invites, guardian requests, release) and `registration-rules.test.ts`.
- New `orders.test.ts` (holds, the oversell race per section, webhook idempotency through `stripe_events`, partial refund).
- New `receipts.test.ts`: the email outbox under a replayed and a concurrent webhook delivery; memberships and donations; an order that carries a membership line (one receipt); the mixed free-and-paid order.
- New `waitlist.test.ts` and `guest.test.ts` (guest rows convert to managed profiles only for the payer's email).
- Role-safety cases for the refund endpoint; `role-safety.test.ts` gains: a claimed child cannot act for siblings or read guardian receipts, and adult sign-in is unchanged.
- A test that enumerates every foreign key to `members` and fails if profile moves skip one.
- The `family_covered` backfill checked against a copy of production.

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
- **My board and My players:** a pinned card with board, colour, opponent and rating, start time and "updated" time. A follow star on any player feeds a "My players" strip. The children a guardian acts for (every active `member_guardians` link) are followed automatically.
- **Round-ready alerts (email only):**
  - When the TD publishes a round (WS08), registered players who have not switched off, their guardians and followers get an email through Resend. A registered player is opted in at registration and can switch off from the event page's round alerts card or My LCA; a guardian gets one switch per registered child, sent to the guardian's address (assumed default, see section 5). Recipients come from `recipientsFor` (WS06), grouped per address: a parent of two gets one email per round, subject "Round 3 pairings: Maya, Leo", each line starting with the child's name.
  - Web Push comes in Phase 5.
  - Text messages are out of scope for now (D8). Each text costs money and US business texting needs carrier registration, while email and web push are free. No alerts surface shows an SMS or phone-notification toggle; "Text me" stays hidden until SMS exists.
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
4. Publishing a round enqueues exactly one email per recipient who has not switched off (dedupe key `round:{id}:{n}:{member}`), grouped per address through `recipientsFor`. Failed sends retry up to 3 times.
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
- `Event-Final-Setup`: the TD setup panel with the Phase 1 options.

**User-facing scope**
- **TD event-day console** (`/workspace/tournaments/:id/live`), tablet-first:
  - A status band with the event, round and countdown.
  - A round rail: Check-in · R1…Rn · Prizes · Rating report.
  - A "Next step" card, e.g. "Round 3: 11 of 13 results in → Enter results".
  - **Check-in:** one search field, "Name, US Chess ID or parent's name" (`GET /api/admin/tournaments/:id/checkin-search?q=`). Rows show full name, section, rating, the US Chess ID ending, the household ("Williams family · Keisha Williams", the owner, shown only here behind `requireTournamentManager`) and club; searching a parent's name lists their children (assumed, see section 5). Big buttons, counts by section, late arrivals and byes; "Check in all 3 from this family" when siblings are in the event and not checked in; QR check-in from the per-profile member card (WS12) finds the exact row with no typing; "Email guardian" sends through LCA without showing the address; "Add a player" at the door asks for the US Chess ID first, so an existing profile is found and not created twice; name fixes after check-in are made here, because a parent's Edit name locks once the child is checked in to a running event. A walk-in child is added as a guest as today, and the payer gets "Save these details, create an account"; the TD membership desk (WS12) sells Family for card or cash and turns walk-in guest children of the paying adult into managed profiles on the spot (assumed, see section 5).
  - **Walk-in card payments:** taken at the desk, these complete through the same webhook path and call `sendPaymentReceipt` (D14); the admin's payment row carries "Send this receipt again".
  - **Entrants list and CSV export:** the TD's entrants list with full names, and the CSV export for directors (moved here from the public table view; assumed, see section 5).
  - **Pair next round:** runs the existing engine in `functions/utils/swiss/` and shows a preview before anything is published.
  - **Results grid:** board list with W/D/L/F buttons, keyboard entry, undo, and visible conflicts when two devices edit the same board (server wins and the diff is shown).
  - **Publish round:** a "notify players" toggle, connected to WS07.
  - **Print/QR:** links to the WS07 kit.
  - **Announcements:** a banner on the event page, with an optional email.
  - **Offline tolerance:** a queue of pending writes with retry and a visible "offline · 3 changes waiting" badge.
  - **Admin backstop (D6):** LCA admins can open any event's console and do everything its TDs can, so an event never stalls if a TD can't.
- **Setup checklist** (`/workspace/tournaments/new` and `/:id/setup`, board `Event-Final-Setup`): one page that refactors or replaces `TournamentWizard`. The form scrolls inside its own container with the steps rail and the page preview sticky beside it, and a sticky bar never covers a focused control (`scroll-margin`, `--bottom-chrome-h`; D16). Every option is editable after creation. Steps, in this order (the replan calls Venue & travel step 6; this order keeps that):
  1. Basics, with the tagline and the championship title (a slug matching `state_champions.title`, WS10).
  2. Sections, with presets (Open/U1800/U1400/U1000, or K–12/K–8/K–5/K–3), the entry-limit mode (overall, the default, or by section) and per-section caps.
  3. Fees: the fee ladder with Regular required and Early and Late optional, shown as a timeline with a preview of the price on any date; no member discount (D11): the admin PATCH (`functions/api/admin/tournaments/[id].ts`) drops `memberDiscount` and the setup drops the member discount input that `TournamentManagePage.tsx` has today; "LCA membership: Required to enter (default) · Not required" (`requires_lca_membership`, D12).
  4. Schedule, with checks for overlapping rounds and for finishing before the venue closes; a **Schedules** option, off by default, adds a second schedule with its rounds and time control and the merge round; the step writes `tournament_schedules` rows, with the rounds in `tournament_schedule_rounds` (0052).
  5. Byes and rules, using `SectionRulesEditor`.
  6. Venue & travel: the venue fields always (name, address, parking, getting in, food; `venue_notes`), a "Travel details" switch (airport, drive times, between rounds) and "Add a hotel" (host hotel, LCA rate, block deadline, booking link), together `travel_json`; and "good to know".
  7. Prizes, using `PrizesEditor`.
  8. Side events, off by default: child events of kind `side` or `meeting`, each with its own sections, fees and caps.
  9. Directors.
  10. Publish, with the display override (`display_state`), a full preview and the share-preview card (WS04).
  - **Clone from last year:** copies sections, fees and text, and shifts dates by a year onto the same weekday.
- **Admin home** (`/admin`, admin-only):
  - A grouped sidebar: Needs attention · Members · Tournaments · Clubs · Content · Board · Email · Site · Audit. Content holds posts, the site banner and Festivals (`/admin/festivals`, admin only, WS05). Site holds the `membership_required_for_all` switch (D12).
  - One merged **Needs attention** queue drawing on:
    - open support tickets (other than those tagged `listing_report`)
    - board inbox tickets
    - pending approvals: club-run tournaments, champion submissions
    - failed emails: campaign recipients and the notifications outbox
    - club listing reports (WS09)
    - partner-listing problem reports (`listing_report`, the support tickets WS04's partner pages create)
  - Each row shows owner, waiting time and quick actions. Admins can assign and reassign.
  - The existing tools stay but move under the groups: group email, site banner, members table/export, board seats, champions, posts, audit log and impersonation.

**Data model**
```sql
-- 00xx_admin_queue.sql
CREATE TABLE queue_assignments (
  item_kind TEXT NOT NULL CHECK (item_kind IN ('support','board_ticket','approval','email_failure','club_report','listing_report')),
  item_id TEXT NOT NULL, assignee_member_id TEXT REFERENCES members(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (item_kind, item_id)
);
ALTER TABLE tournaments ADD COLUMN cloned_from_id INTEGER REFERENCES tournaments(id);
-- verify: check-in timestamp already exists on registrations (checked_in_at) — reuse it
```

**API**
- `GET /api/admin/queue` (new; `requireAdminView`): aggregates the six sources into one list; a `listing_report` ticket counts once, under its own source.
- `POST /api/admin/queue/assign` (new; `requireAdmin`).
- `GET` and `PATCH /api/admin/site-settings` (new; `requireAdmin`, audited): the Site group's `membership_required_for_all` switch, read from and written to WS05's `site_settings` row (D12).
- `POST /api/admin/tournaments/:id/rounds/:n/pair` and `.../publish`. Verify the existing pairing and round endpoints under `functions/api/admin/tournaments/[id]/` and `functions/utils/tournament-manage.ts`, then extend them.
- `POST /api/admin/tournaments/:id/checkin`: takes a registration id or a signed member-card token.
- `GET /api/admin/tournaments/:id/checkin-search?q=` (new; `requireTournamentManager`): the one check-in search over name, US Chess ID and the owner's name, returning the household line only here.
- `POST /api/admin/tournaments/:id/clone` (new).
- All of these use `requireTournamentManager` or `requireAdmin` as appropriate, and every write goes through `functions/utils/audit.ts`.

**Frontend**
- Change:
  - `src/pages/TournamentManagePage.tsx`: split into the setup checklist and the live console.
  - `src/components/admin/TournamentWizard.tsx`: becomes the setup checklist, with the scrolling form container and the sticky steps rail and preview (D16).
  - `src/components/tournaments/ResultsEntry.tsx`, `SectionRulesEditor.tsx`, `PrizesEditor.tsx`, `UsChessUploadPanel.tsx`.
  - `src/pages/AdminPage.tsx`: sidebar and queue.
  - `src/pages/WorkspacePage.tsx`.
- New:
  - `src/components/workspace/ConsoleStatusBand.tsx`, `RoundRail.tsx`, `NextStepCard.tsx`, `CheckInList.tsx`, `QrCheckIn.tsx`, `ResultsGrid.tsx`, `PublishRoundDialog.tsx`, `OfflineQueue.tsx`
  - `src/components/admin/AdminSidebar.tsx`, `NeedsAttentionQueue.tsx`

**Jobs & integrations:** QR scanning through the camera, using `BarcodeDetector` with a JS fallback library; `sendPaymentReceipt` for walk-in card payments (WS06, D14).

**Acceptance criteria**
1. The console works at 1024×768 without horizontal scrolling, and every tap target is at least 44 px.
2. Checking in any of 100 players takes at most 2 taps from search. QR check-in marks the correct registration and rejects forged or expired tokens.
3. Publishing a round makes the pairings public and enqueues alerts exactly once.
4. Results entry supports keyboard and undo, and shows a conflict when two devices edit the same board.
5. Cloning produces an event that matches last year's sections and fees, with dates on the same weekdays.
6. The admin queue shows items from all six sources with owner and age. Assigning an item updates it immediately and writes an audit entry.
7. An LCA admin who isn't a TD of the event can pair, enter results and publish rounds on it (D6).

**Tests:**
- Integration:
  - queue aggregation and assignment
  - pair/publish
  - check-in by token
  - clone
  - the site-settings switch, with a role-safety case
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
  - `tournaments.championship_title` (WS05) is a slug matching `state_champions.title`; the honour roll accepts `?title=` and the event page's "Past champions ↗" sub nav link opens it there. Its relation to the existing `is_state_championship` flag is not settled: verify, and keep both until the flag can be derived from a non-empty title.
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
-- state_champions.tournament_id exists since 0049 (TEXT); no ALTER needed
-- tournaments.championship_title (added in WS05's migration) is the slug joined to state_champions.title for the ?title= roll
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
- `GET /api/champions` (exists; extend with links to archived event results, and `?title=` for one title's roll, which the event page's Past champions link uses).
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
  - Real tiers: Adult $15/yr (18+), Scholastic $5/yr (K–12), Family $25/yr (you + up to 3 children), Senior $10/yr (65+). Benefits: entry to LCA-run tournaments (an LCA membership is required to enter them unless the event switches the requirement off, D12), member profile, voting rights, online registration. There is no member price on entry fees (D11).
  - **Family coverage is chosen, not by date:** at purchase and renewal the guardian ticks up to 3 children per plan (`member_guardians.family_covered`) on a "Who's covered?" screen: the parent's own line fixed, each saved child with "Covered by this plan" (the first 3 ticked, a 4th tick disabled with "Family covers you and 3 children"), and an inline "Add a family member". An open spot can be filled at any time; the ticks otherwise change at renewal (assumed, see section 5). A 4th child is offered Scholastic $5 as a line in the same payment ("Not covered · Add Scholastic for $5") and is never silently left out. In two-household families each guardian's plan can cover the child, and the later expiry wins. Family's one-line description everywhere is "Everyone on the plan gets a LCA membership".
  - **No child emails at purchase:** "Children don't need an email. Everything comes to you. Each child can get their own login at 13 or older from My LCA."
  - **Success page:** "Covered through Sun, Oct 10, 2027: Danielle, Maya, Leo. One open spot.", each name as it will print on entry lists with "Fix a spelling", and the buttons "Register my family for an event" and "Go to My LCA".
  - **Renewal reminder:** lists the covered children and flags anyone who now manages their own profile ("Maya now manages her own profile · Adult $15").
  - **Inside the checkout:** the household optimizer runs in WS06's membership step when the event requires a membership and someone in the order lacks one (D12).
  - **TD membership desk:** sells Family for card or cash at the venue; walk-in guest children of the paying adult become managed profiles on the spot (assumed, see section 5).
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
  - In My LCA: name, member ID, tier, expiry and a QR code; one card and signed QR per player profile (`member_id`), so a parent sees one per child, and WS08 check-in uses it to find the exact row.
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
-- member_guardians.family_covered (WS06's migration) replaces the by-date rule in syncFamilyCoverage; the webhook writes it from the ticks
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
- The webhook (`functions/api/stripe/webhook.ts`) records fund totals and subscription renewals, activates memberships through `functions/utils/membershipActivation.ts` (writing `family_covered` on the ticked links and running `syncFamilyCoverage`) and calls `sendPaymentReceipt` (WS06, `functions/utils/receipts.ts`) for every standalone membership and donation payment (a membership inside a registration order is on that order's receipt, WS06), after the `stripe_events` idempotency check. Reuse `membershipExpiry.ts`.

**Frontend**
- Change: `src/pages/MembershipPage.tsx`, `MembershipSuccessPage.tsx`, `DonationSuccessPage.tsx`, `src/components/DonateButton.tsx`.
- New: `src/pages/DonatePage.tsx` and `src/components/membership/FitQuiz.tsx`, `HouseholdOptimizer.tsx`, `TierCards.tsx`, `RenewPanel.tsx`, `MemberLookup.tsx`, `MemberCard.tsx`, `PrintableCard.tsx`, `FundPicker.tsx`.

**Jobs & integrations**
- Stripe subscriptions for auto-renew and monthly gifts.
- Resend for renewal reminders (listing the covered children), reusing the expiry logic in `daily-emails`; receipts through `sendPaymentReceipt` (D14), never a second receipt from Stripe.

**Acceptance criteria**
1. The optimizer always recommends the cheapest valid combination. Unit tests cover 0–5 children, seniors, ties and children-only households.
2. Renewal extends from the current expiry date, and the one receipt (`sendPaymentReceipt`, D14) shows the new date.
3. The lookup reveals only status and expiry month, and rate limiting kicks in after 10 lookups per IP per hour.
4. A donation's fund metadata shows up in that fund's total after the webhook runs.
5. A valid QR token checks a member in; forged or expired tokens are rejected.
6. Donate is one click from every page on tablet, and on desktop wherever the header row has room for it; when the desktop row is tight it is the About menu's last item, one click after opening About. On phones it is the first of the three buttons after the section list in the Menu sheet (two taps).
7. A membership or donation payment produces exactly one receipt to the payer (WS06 AC10), and "Send me this receipt again" in My LCA re-sends it.
8. The "Who's covered?" screen never ticks more than 3 children, offers the 4th as Scholastic $5 in the same payment, asks for no child email, and the success page lists who is covered with the expiry's weekday.

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
  1. Unpaid entry before its deadline, including a teen's "Ask my guardian to pay" ("Unpaid entry: Maya, The Baton Rouge Classic, U1400, $20 · Pay").
  2. US Chess membership expiring before an entered event.
  3. LCA membership expiring within 30 days.
  4. Open waitlist offer, with countdown.
  5. Bye request pending.
  6. Club listing not confirmed in 90 days (reps).
  7. Queue items (admins and board).
- **Next up:** one date-ordered timeline of entries, followed clubs' next meetings and saved events.
- **Reminders and receipts:** the member section lists saved event reminders (WS04) with change and stop, and past payments with "Send me this receipt again" (WS06, D14).
- **Family:** "Children don't need an email or a login. You register and pay for them and get their emails. From 13 you can give one their own login, and they keep all their history." One card per child showing next event, section, paid status, US Chess ID status and expiry, Family plan coverage, last result and a login status ("No login · emails come to you", "Invite sent Tue, Oct 13 · Resend", "Has her own login"); filter chips "Everyone · Maya · Leo"; each card has "Open Maya's page" (`/me/players/:memberId`, the same view Maya would see, with the strip "you manage this profile"), "Give Maya her own login" (the 13-or-older and consent checkboxes), "Remove Maya's login" and "Maya is 18: hand over her profile". Add a family member (first name, last name, optional US Chess ID only; the eighth-grade checkbox moved to each entry, WS06), plus **Register all** into the WS06 household flow.
- **Guardians panel:** "Invite a guardian", requests to Approve or Decline, Remove (owner only), Leave, and a "Send me copies" toggle per child (the last one is disabled while the child has no login: "Someone has to get Leo's emails until he has his own login."). Co-guardians are shown as first name and last initial.
- **Event-day view:** "who's playing where", showing each child's board, colour, round and an "updated" time (WS07), from `GET /api/me/event-mode` `players[]` read from `member_guardians`. Round alerts arrive as one grouped email per guardian per round, each line starting with the child's name; the "Text me" control stays hidden until SMS exists (D8).
- **A claimed teen's dashboard:** her own My LCA with her entries, pairings, results, reminders and card, and in Settings "I'm 18 or older: manage my profile myself" (takes effect after 7 days, and her guardians are told at once).
- **Role sections:**
  - Club rep: freshness, Tonight switch, news → `/workspace/clubs/:id`.
  - TD: events I direct, next steps → console.
  - Board: seat, inbox.
  - Auditor/observer: read-only links.
- **Nightly US Chess check:** for entrants of upcoming events, refresh membership expiry through `functions/utils/uscf.ts`. It is throttled, cached, and capped at N lookups per run.

**Data model**
```sql
-- 00xx_dashboard.sql  (verify existing columns on members/children before adding)
-- members.uscf_expiration already exists (migration 0042) and carries the US Chess expiry for every profile, children included;
-- it replaces the uscf_expires_on column planned in 1.2.
ALTER TABLE members ADD COLUMN uscf_checked_at TEXT;   -- verify: absent as of October 8, 2026
```

**API:** `GET /api/me/dashboard` (new; `requireAuthedMember`). It's role-aware and returns only the sections the person's roles allow. Reuse `GET /api/me`, `/api/me/children` and `/api/me/family` (WS06).

**Frontend**
- Rewrite: `src/pages/DashboardPage.tsx`.
- New: `src/components/dashboard/RoleChips.tsx`, `NeedsAttention.tsx`, `NextUpTimeline.tsx`, `FamilyCards.tsx`, `EventDayView.tsx`, `RoleSection.tsx`; renders WS06's `GuardiansPanel.tsx` and links to `src/pages/PlayerPage.tsx`.

**Jobs & integrations:** the nightly US Chess expiry refresh in `workers/daily-emails`, with its own isolated phase.

**Acceptance criteria**
1. A person who is member, parent, club rep and TD sees all four sections without switching modes, and the chips jump to each one.
2. Needs-attention ordering follows the ranking above. A unit test covers it.
3. A US Chess expiry earlier than an entered event's date shows at least 7 days before the event, with a renewal link.
4. "Register all" from the family section opens the household flow prefilled with every child the viewer guards.
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
| **1 · Events core** | WS04, WS05 (with festivals), WS06, plus WS13's member and parent sections | A family can find an event by filter, map or calendar, read a plain-language event page, and register three players in one payment with one receipt; partner pages and share previews work; a festival page can go live |
| **2 · Event day** | WS08 (console, setup checklist, QR check-in), then WS07 | **Pilot at one LCA event** (for example the Paul Morphy Open) with alerts limited to registered players who have not switched off; switch alerts on site-wide after the pilot review |
| **3 · Community** | WS09, then WS10, then WS11 | All 25 clubs have schedules and confirm emails; the this-week strip turns on; first results archived; recaps drafting; scholastic hub live |
| **4 · Membership, governance, admin** | WS12, WS14, WS08's admin home and queues, WS13's remaining sections | Join/renew/donate/card live; bylaws reader and Who-represents-me live; one admin queue |
| **5 · Extras** | WS15, Wallet passes (D4), Web Push, Grand Prix series, hall TV polish | as each item's acceptance criteria say |

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
| D11 | One entry price | **No member price and no member discount anywhere** (settled by K, October 8, 2026). `member_discount` is retired from pricing; a section has one fee per tier, and only the tiers the setup has (Early, Regular, Late, with Regular required). Every board and the WS04, WS05, WS06, WS08 and WS12 text follow. |
| D12 | LCA membership to enter | **Required for LCA-run events** (settled by K, October 8, 2026). The checkout adds the right membership for anyone in the order without an active one, in the same payment: the Family plan covers the guardian and up to 3 children, a 4th child is added with a Scholastic membership ($5), an adult joins at the Adult, Senior or Family tier. The per-tournament `requires_lca_membership` (default on) lets a club running its own event switch it off; a site-wide override, `membership_required_for_all` (admin only, default off), is planned so the board can force it on every event later without a code change. |
| D13 | One player, one profile | **Children are player profiles linked to guardians, not accounts** (settled by K, October 8, 2026). A profile is a `members` row for life, linked through `member_guardians`; it needs no email; a login is optional from 13 with the guardian's recorded consent; no birthdate, grade or age is stored; a second guardian is in scope now. |
| D14 | Receipts | **One receipt system for every payment** (settled by K, October 8, 2026). Every completed payment sends one receipt to the payer and one confirmation per player; Stripe's own receipts are turned off; `stripe_events` makes the webhook idempotent before any email is sent, so nobody gets two. |
| D15 | Names on pre-event lists | **First name and last initial for under-18s on pre-event entrants lists** (settled by K, October 8, 2026): a player with an active guardian link, or an entry with a ticked eligibility box, shows as "Priya S." on See who's registered and Who's coming; no club is shown beside a player; TDs and admins see full names; results, standings, winners and recaps keep full names, as D3 says. This replaces the per-event `public_minor_names` mechanism and the "minors-only page" trigger in D3 and in 0.1 rule 3, which K rewrites when 0.1 is next revised. |
| D16 | Long forms and pages | **Scroll in their own container with sticky chrome** (settled by K, October 8, 2026: "same with any other page"). The setup form scrolls inside a container with the steps rail and the page preview sticky beside it; phone sheets and the family picker scroll inside the sheet; a sticky bar never covers a focused control (`scroll-margin`, `--bottom-chrome-h`). |

**Open questions carried from the phase 1 replan** (`DESIGN_REPLAN_phase1.md` sections 3, 7.7 and 9, plus two wordings this brief proposes for the replan's section 11 decisions, S11.1 and S11.2). K answered three, and the brief applies them: S7.1 (Register my family shows only signed out or with an active Family membership; everyone else's Register button lists their children in the same picker; the co-guardian case is S7.1b below), S7.11 (round alerts are email only until SMS is built, consistent with D8) and S9.1 (Who's coming keeps A's rating-sorted table with section chips on the event page while the page 4 preview groups by section). The rest are not decided in this brief. Each default below is the working assumption, marked "assumed, K to confirm", and the text above follows it until K says otherwise.

| Ref | Question | Working assumption |
|---|---|---|
| S3.1 | Phone calendar: keep Calendar A (the month grid over the day's agenda), or B or C? | Keep Calendar A (assumed, K to confirm). |
| S3.2 | CSV export for directors: moves to the TD tools (WS08), or returns as a table-footer link for `requireTournamentView` only? | Moves to the TD tools, where the entrants list already lives (assumed, K to confirm). |
| S3.3 | Map defaults: does "Update the list as I move the map" start ticked, and where does the map open? | Starts ticked; opens on the Gulf South; zooms to Louisiana when a Louisiana region is picked (assumed, K to confirm). |
| S3.4 | Saved table views for signed-in users: drop them from WS04? | Dropped; the URL holds every view and a weekly saved search covers the recurring case (assumed, K to confirm). |
| S3.5 | The `.ics` Subscribe link for the current filters: where does it go? | At the end of the info note ("Subscribe to this list") on every view (assumed, K to confirm). |
| S3.6 | The not-yet-open LCA preview leads with "Remind me when it opens" and gains Register when registration opens, departing from the Register-first order. | Keep (assumed, K to confirm). |
| S7.1b | Does a co-guardian whose child is covered by another guardian's Family plan see Register my family? | Yes (replan 7.3); K's quote covers only the viewer's own membership (assumed, K to confirm). |
| S7.2 | Is 13 the right age for a child's own login, and are the 13-or-older checkbox plus the recorded consent checkbox enough? | Yes: 13 or older with both checkboxes recorded; under 13, no login and no child email (assumed, K to confirm). |
| S7.3 | After a teen gets her own login, can guardians and the teen turn off copies? | Each guardian can turn off their own copies; the teen cannot turn guardians' copies off before she manages her own profile (assumed, K to confirm). |
| S7.4 | Should a self-declared "I'm 18 or older" take effect at once? | After 7 days; guardians are emailed at once and any guardian can cancel; a second request needs the owner's approval (assumed, K to confirm). |
| S7.5 | Is moving history from a duplicate profile acceptable without an admin when the same-person check passes? | Yes, with every move logged in `profile_moves`; anything failing the check is refused with a plain message, not queued for volunteers (assumed, K to confirm). |
| S7.6 | In a separation, who can remove a co-guardian? | Only the owner; co-guardians can only leave; LCA takes no role in custody disputes beyond following the owner (assumed, K to confirm). |
| S7.7 | In the TD console, does a guardian show as a full name, and can TDs search by a parent's name? | Full name and searchable, inside the TD console only (`requireTournamentManager`), never on public pages (assumed, K to confirm). |
| S7.8 | Can a parent with 4 or more children change which 3 the Family plan covers mid-year? | No; the ticks change at renewal, an empty spot can be filled any time, and paid entries keep their price (assumed, K to confirm). |
| S7.9 | Where does the scholastic emergency contact from `Account-B` live? | Once on the owner's account, reused on each child's scholastic entry and shown only to that event's TD; WS06's emergency contact bullet and `registrations.emergency_contact_json` follow this (assumed, K to confirm). |
| S7.10 | Should a short public LCA member number be added? | No; the US Chess ID, the parent's name in the TD console and the per-profile card QR are enough (assumed, K to confirm). |
| S7.12 | Can the TD membership desk sell a Family plan for cash and turn walk-in guest children into the payer's profiles on the spot? | Yes, because the TD sees the family in person; otherwise through the emailed "Save these details, create an account" link (assumed, K to confirm). |
| S9.2 | Section picker with many sections: above four sections the card's segmented picker becomes a select. | Keep (assumed, K to confirm). |
| S9.3 | A featured festival and a live event on the home page: does Live outrank the featured festival, or does the festival always lead? | Live outranks it, except that when the live or event-day event belongs to the featured festival the festival hero stays and carries the live line (assumed, K to confirm). |
| S9.4 | Round alerts default: registered players opted in at registration with a switch off, or opt-in? | Opted in at registration with a switch off; WS07 carries this default (assumed, K to confirm). |
| S9.5 | Festival bundle price ("Open + Blitz") dropped because pricing cannot express it. | Dropped; no bundle pricing (assumed, K to confirm). |
| S9.6 | The State Championship's business meeting is a side event of kind `meeting` with an RSVP. | Keep; the brief's WS14 has no RSVP yet, so it is added there when the meeting lands (assumed, K to confirm). |
| S11.1 | Good to know's Membership item when the event has switched the requirement off (WS05). | "No LCA membership needed" (assumed, K to confirm). |
| S11.2 | The picker's Not covered row state under D11 (WS06). | "Not on your Family plan. An LCA membership (Scholastic $5) is added in step 3.", shown only when the event requires a membership (assumed, K to confirm). |

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
- **Tournaments:** `Tourn-List-Final`, `Tourn-List-States`, `Tourn-Calendar-Final`, `Tourn-Map-Final`, `Tourn-Table-Final`, `Tourn-Phones-Final` (decided; they replace `Tourn-A`…`Tourn-E` and `Tourn-Phones`).
- **Event page:** `Event-Final-1`, `Event-Final-2`, `Event-Final-States`, `Event-Final-Family`, `Event-Final-Setup`, `Event-Partner-Final`, `Event-Festival-Final-1`, `Event-Festival-Final-2`, `Event-Phones-Final` (decided; they replace `Event-A`…`Event-E` and `Event-Phones`).
- **Registration:** `Reg-A`…`Reg-D`; `Reg-C` is decided as the household checkout with the family model, and its decided board is drawn when WS06 starts.
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

Every option board carries a grey note with What / Borrowed from / Trade-off. The decided boards live in `docs/redesign/decided-boards` and carry a title strip ("Built from", "Replaces", "K's feedback applied"), a numbered legend and a "K's feedback, and where it landed" checklist (items 4.1 to 4.7 on page 4). Invented details on the boards are badged "Sample data" (on the decided boards: entry and section counts, which events register on LCA, type counts, entrant names); everything else is real LCA data, with event names, dates, cities and organizers from the Gulf South feed.

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
