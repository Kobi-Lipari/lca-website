# Brief 1.4 assembly notes (Thu, Oct 22, 2026)

## What was done

- Copy of the untouched 1.3 spec: `brief14/REDESIGN_SPEC.before-1.4.md` (2,131 lines; equals the docs worktree's HEAD, which is main plus the Zextaos line, checked by diff).
- Script: `brief14-tools/apply_blocks.py` reads the copy, finds each heading exactly once, replaces from it to the line before the next heading of the same or a higher level, and writes `docs2-wt/docs/redesign/REDESIGN_SPEC.md`. All 21 blocks applied (header; sections 0, 1, 2, 4, 5; WS02 to WS15; Appendix B). Not replaced: section 3's intro, WS01, Appendix A, Appendix C.
- Consistency edits on top: `brief14-tools/edits1.py` (105 exact replacements, each checked to occur exactly once, plus SC1 to SC7 renumbered) and a few small follow-up replacements. Scanners: `brief14-tools/scan.py` and `brief14-tools/dates.py`.
- Result: 3,359 lines. No en, em, figure or minus dash; no block marker; no AI name; none of "the lead", "agent", "subagent", "workflow", "manifest"; every date has its weekday. "USCF" is left once, in K's rule 0.1.7 itself ("not USCF, in the UI").
- Nothing committed. Only `docs/redesign/REDESIGN_SPEC.md` changed in the docs worktree. Nothing under /home/user/lca-website was written.

## Conflicts between parts, and how they were resolved

1. **My LCA rail switch.** WS02 tied the short My LCA menu, the sheet's role rows, search's "Your tools", AC17 and its tests to `newDashboard`. WS13 splits that switch: `newDashboard` is the one page (Phase 1), `myLcaRail` the rail (Phase 4). Keyed to `newDashboard`, volunteers would lose their role rows in Phase 1 with no rail to replace them. Resolved: WS02 now keys all of these to `myLcaRail` (scope, AC17, nav and a11y tests, Depends on). The flag table splits the row, 1.2's header row and 1.3's WS13 rows name the split, and section 4 has a My LCA note.
2. **`POST /api/contact` targets.** The parts disagreed on who adds what:
   - frame 2.2: whole board WS11, region WS14;
   - WS11: whole board plus the rate limit and contract;
   - WS14: adds the region target;
   - WS09: adds the region target, which WS14 reuses;
   - WS10: adds the whole board if it lands first.
   Resolved by phase order (WS09, then WS10, then WS11; WS14 in Phase 4):
   - WS09 adds the region target, with the endpoint's contract and its missing rate limit (through its new `rateLimit.ts`);
   - the whole-board target comes with whichever of WS10 and WS11 lands first;
   - WS14 reuses both, and sends to the whole board while a seat is open.
   Edited: 2.2's row, WS09, WS10, WS11 (scope and Depends on), WS14 (API and Depends on), and a section 4 note.
3. **Officer emails on today's club page.** Frame 2.2 said the page shows each officer's email; WS09 said no page shows them. Checked on main: `ClubDetailPage.tsx` shows officers' names and roles only, while `functions/api/clubs/[id].ts` returns `m.email`. 2.2 is corrected to match WS09 and Q14.
4. **`clubTextOnDark`.** WS10 cited it as "WS09's rule". WS09 now uses neither colour helper (a club's colour is never words). WS10's line now states WS09's rule instead.
5. **Entrants list before WS06.** WS04 counted a missing `eligibility_json` as unticked. WS06 (and migration 0043, checked) keeps the ticked range in `registrations.grade`. So until WS06 lands, a guest child with a ticked box would have shown in full, against K's rule for under-18s. WS04 now reads `registrations.grade` until WS06 adds and backfills `eligibility_json`, and its entrants test covers the case.
6. **`support_tickets.kind`.** WS04 files tagged tickets but adds no column; WS08 adds `kind` and `about_id` "unless WS04's migration has". WS04 now says whichever of the two lands first adds them.
7. **The household optimizer.** WS06 (Phase 1) priced memberships with "the WS12 household optimizer", but WS12 is Phase 4 and no optimizer exists on main. Resolved: WS06 builds the pricing rule beside `domain/membership/tiers.ts`, and WS12's page reads the same rule. Edited WS06 step 3, WS12's "Inside the checkout" line and a section 4 note.
8. **P2.21 against the bare club page.** The frame's row still described brackets inside blocks, as `Club-G` draws. WS09 follows `Club-Final-Bare` (approved as drawn): no brackets, no "not listed", no Suggest an update on a block. The row is aligned with WS09.
9. **Sheets in the director's queue.** WS08 said results "from a paper sheet skip the queue"; WS15 puts scanned sheets in the queue as "Scoresheet says". WS08 now says that a scanned sheet is not an entry and joins the queue (Q30).
10. **Flag table against the sections.**
    - `memberEvents` named a key that no section uses. The row is renamed to the setting's real key, `member_events_enabled`, in the header, the table intro and section 4's Phase 4 row. It is still marked "not a build switch".
    - `homeWeek`'s "Can go on in" changes from WS09 to "only if K keeps the strip (P2.14)".
    - `myLcaRail` row added.
    - `scanner2` row extended, as WS15 asked.
    - `newClubs`, `householdCheckout` and `standingDirectors` name their server constants; `newMembership` names `/give` and gift memberships.
    - Rows added for the three older switches WS04 names (`clubTournaments`, `tournamentQuickFilters`, `externalTags`).
    - `siteSearch` was in the table but named in no section (as in 1.3). WS02 gained a Switches bullet naming it, with `newNav`, `eventStrip`, `eventStripLive`, `liveMarker` and `homeSearch`.
11. **Open question numbering.** The parts proposed:
    - Q14 and Q15 (WS02 to WS04);
    - Q14 to Q17 (WS09 to WS13);
    - a to f (WS05, WS06, WS08);
    - SC1 to SC7 (WS15).
    Final numbering:
    - Q14 to Q17: WS09 to WS13;
    - Q18: WS02's event-strip question; WS04's link-preview question is folded into Q12, since it is the same question;
    - Q19 to Q24: WS05/06/08's a to f;
    - Q25 to Q31: WS15's SC1 to SC7.
    Every "(assumed, see section 5)" marker now cites its row. 1.3's carried markers map to S7.8, S7.12 and S9.4.
12. **Section 4 sequencing notes.**
    - WS03's note no longer says WS09 lights a block (the strip waits for P2.14) and adds WS05's Featured rung.
    - New notes: WS05 and WS06 lean on each other; WS05's during state waits for WS07; the household optimizer; QR check-in made explicit (built in Phase 2, scans cards from Phase 4); My LCA; public forms in Phase 3.
13. **Requests from one part to another, applied:**
    - WS07: the live pages carry Report this event (scope and AC14);
    - WS10: the Facebook sync and digest record runs through `recordRun`;
    - WS13: renders the "Run your own tournament" line (Q19) and reads `GET /api/me/tournament-creation`;
    - WS02: the footer's "List or update your club" opens Suggest a club once `newClubs` is on;
    - WS11: names the columns it reads (`how_we_meet_text`, `club_distances`, `clubs.scholastic_friendly`);
    - Phase 2's "Done when" leaves followers out during the pilot.
14. **Frame edits for consistency:**
    - Header "Changes in 1.4": WS02, WS12 and WS13 lines filled out; new lines for WS01 and for Appendix A (Zextaos); Architecture and Phases lines extended; Decisions now says Q1 to Q31.
    - 0.2: "The flags are listed in the table below"; the table intro names the older rows.
    - 1.1: `/give` (today's `/donate`).
    - 1.2's header row: "State champions", as `Nav-IA-Final` and WS02 label it.
    - 2.2: rows for the rate-limit and spam helpers and for automation runs; extra users on the signed tokens, `recipientsFor` and outbox rows; `listedWhere` on the unified query row.
    - 2.3: the WS05, WS08, WS09, WS12, WS13 (new) and WS15 lines, and the columns line.
    - 2.4: `/api/clubs` in place of `/api/clubs/this-week`.
15. **Wording fixes outside the blocks:**
    - section 0's four dates without a weekday gained one, one of them inside WS01's long deviation bullet;
    - WS01's one en dash range is now ".06 to .08em";
    - three `.github/workflows/...` paths now read "the GitHub Actions job in `migrate-db.yml`" or "`e2e-preview.yml`", so the word does not appear;
    - "USCF" in WS01's record bullet and in WS14's AC9 and its test is now "the old initials", leaving only K's rule;
    - WS02's "the board's Q9" (the board's own question on the logo plate) is now said in words, so it cannot be read as section 5's Q9.

## Open questions for K (deduplicated, as section 5 carries them, each with its default)

- **Q1** When the regional representatives start creating: from WS09's My region in Phase 3.
- **Q2** Does a club rep create the club's events: nothing changes; today's `club_rep` path for its own club stands.
- **Q3** Stripe's fee, refunds and disputes on connected accounts: nothing built or routed until K answers; every payment goes into LCA's account.
- **Q4** How a standing director is named: today's `tournament_director` role, granted by an LCA admin; K decides who holds it.
- **Q5** What "active member" means (creating, scanner): `hasActiveMembershipOn` for today; Family coverage counts; creating also needs the 18-or-older tick.
- **Q6** Give-A: as drawn, with no goals or progress bars.
- **Q7** S3.1 to S11.2 and P2.1 to P2.44 stand as written.
- **Q8** US Chess fix brief: no Grand Prix; warnings list yes; no known-good files assumed (a SwissSys practice set); member delete refused for a member with games.
- **Q9** Official logo: hall poster and final report in the kit (the other sheets carry only the event name and date; QR centres take the rook mark); certificates unplaced; D1's history pages are the About and Champions tabs only.
- **Q10** Walkthrough: a reminder row after Phase 5.
- **Q11** Creation's first phase: first in Phase 1, on today's pages.
- **Q12** A member-created event's live pages, kit and link preview: the "Organized by <name>. Not an LCA event." line on every live page, every printed sheet and at the end of the preview's description; no LCA marks. WS04's link-preview question is folded in here.
- **Q13** Recap for a member-created event: none; its results page works by link.
- **Q14** Club contact email on today's page: officers' emails leave the API in WS09's first PR; the club's address stays until `newClubs` is on.
- **Q15** A representative's club event: hidden draft until an LCA admin approves, as `Work-H` draws.
- **Q16** Membership card's look: on screen as `Account-D`, logo on a cream plate; printable card in Heritage.
- **Q17** Refund rule and check mailing address: neither line shows until the board writes it.
- **Q18** Event strip on a member-created event: for its players, guardians and directors; not for an LCA admin who does not direct it.
- **Q19** Where a member starts one: a line on My LCA's You section while the setting is on; then Events you direct.
- **Q20** Closing a member-created event: answers only to organizer, entrants and admins with a plain line; registration stops; others get not-found.
- **Q21** `Work-K`'s two Publish boxes: not built.
- **Q22** `membership_required_for_all` covers member-created events: yes.
- **Q23** The words of the paused notes and the registration notice: as written in WS05, WS06 and WS08.
- **Q24** `public/lca-logo.jpg` stays as the logo's source: yes.
- **Q25** A lapsed member keeps My games: yes; only scanning needs an active membership.
- **Q26** The event's allowance for director scoresheets: two per game in the published pairings, the same for member-created events; an admin can raise it.
- **Q27** Opponent's consent to a crosstable link: not needed; told afterwards, can hide it from their own row.
- **Q28** Juniors' names on shared or linked games and printed scoresheets: full names (D3).
- **Q29** Guardian's OK to share a junior's games: once per child, in Family.
- **Q30** Scanned sheet results in the director's queue: yes, as "Scoresheet says", never posting by itself.
- **Q31** Keeping a scoresheet photo past 30 days: yes, by an unticked-by-default choice, kept with the game.

P2.1 to P2.44 and the S-series are carried with their defaults; P2.11, P2.17, P2.19, P2.20, P2.21 and P2.29 are marked answered, P2.18 partly answered, and P2.23 settled.

## What a part asked for that could not be placed

- **Deviations from v1.3 entries.** WS02 to WS04 (G), WS05/06/08 (F), WS07/10/11/14 (G), WS09/12/13 and WS15 each offered entries. They are not in the spec: the task keeps that list at its one line, and each workstream records its own when its PR lands. The entries stay in each part's NOTES block for those PRs.
- **Copying the decided boards.** The phase 2 replan's preamble copies the decided boards for pages 7 and 10 to 12 into `docs/redesign/decided-boards` when 1.4 is cut. Not done (outside the spec). The design-source line and Appendix B say pages 7 to 16 are in `docs/redesign/canvas/boards`, which is true today (checked); if the boards are copied, both lines change.
- **0.1 rule 3.** D15 asks K to rewrite the third bullet of 0.1 rule 3 "when 0.1 is next revised". Left word for word, since it is K's rule.
- **One label for one fact.** WS09 labels the club tick "Scholastic friendly"; WS11's Find a club near you shows "Kids welcome" for the same column. WS11 now names the column, but the two labels stay; unifying them is a design call.
- **WS15's alternative.** WS15 judgement 1 lists what to delete if "Anyone with the link" should also go. Not applied: K's words keep L's share section and drop only Public.
- **Records outside the spec.** The inventory notes that `REDESIGN_STATUS.md` lines 15 and 17 and `HANDOFF.md` are stale after the checkpoint D merge. Not touched.

## Second pass (Thu, Oct 22, 2026, 9:25 PM)

- **Two runs at once.** This assembly step ran twice at the same time on the same files. The second run saw the first run's edits land in the spec at 9:19 PM and stopped writing to it. One second later its own draft of consistency edits went to the same path the notes above name, `brief14-tools/edits1.py`, replacing the first run's 105-edit script there; the draft was never applied (its count check refused every edit, since the first run's edits had changed those lines). The draft is now `brief14-tools/second-pass-edits-unapplied.py`. The first run's script is gone, and the spec itself is the record of what it applied. The plain assembly can be rebuilt with `brief14-tools/apply_blocks.py` from `brief14/REDESIGN_SPEC.before-1.4.md`; it is in `brief14-tools/assembled-mine.md`.
- **Review.** Every edit of the first run was read against the plain assembly (`brief14-tools/review-wdiff.txt`). None was undone.
- **Nine more edits** (`brief14-tools/second-pass-final-edits.py`, applied with `brief14-tools/second-pass-apply.py`, each string checked to occur exactly once):
  1. "Changes in 1.4", Architecture: "(2.1 to 2.4)", naming 2.4's change (`/api/clubs` in place of `/api/clubs/this-week`, which is not built).
  2. "Changes in 1.4", Working rules: names the start rule in item 3.
  3. 0.2: "Don't start a workstream until everything in its Depends on line is merged" now ends "apart from a part that waits for a later workstream or phase, as that line or section 4 says". Read strictly, the old rule held WS05 (Phase 1) until WS08's Phase 4 parts, and WS13's one page (Phase 1) until WS07.
  4. P2.14: the working assumption read "Keep it" while WS03, WS09, the flag table and section 4 build no strip, and the brief says the text follows each default. It now reads "Not built for now, and `homeWeek` stays off", gives the phase 2 replan's old default and K's picks as the reason, and leaves a schedule model for later if K keeps the strip. Section 7 of the phase 2 replan wins over its section 4.
  5. S9.6: "the brief's WS14 has no RSVP yet" is now "WS14's `/meeting` links to that side event for its RSVP", as WS14 does.
  6. Q9: names the LCA scoresheet WS15 adds to the kit, which carries the logo as `Scan-S` (K's pick) draws it.
  7. WS05's Depends on: WS09's spam check for Report this event (WS08's already named it).
  8. 1.3's walkthrough row cites Q10, the one open question no section cited.
  9. "Changes in 1.4", Decisions: says P2.14, P2.21 and S9.6 now follow the picked club boards and WS14.
- **Checks on the finished file** (3,359 lines): no en, em, figure or minus dash; no block marker; no assistant, vendor or model name; none of "the lead", "agent", "subagent", "workflow" or "manifest"; "USCF" once, in K's rule 0.1.7; every date has its weekday; D1 to D30, Q1 to Q31, P2.1 to P2.44 and the S-series are unique and in order, and every D, Q, P2 and S reference resolves (S7.1, S7.11 and S9.1 are the three section 5 lists as answered, with no row of their own); each of the 40 flag rows is named in a workstream, and every switch a workstream names has a row; every board the 1.2 table names is in Appendix B (some through a range such as `Reg-A` to `Reg-D`, or "each with its -2"); WS01 to WS15 keep the sub-order, with acceptance criteria numbered from 1 without a gap; no id that names a tournament, member, registration, club or game is INTEGER; "Deviations from v1.3" holds its one line.
- **Open question changed in this pass:** P2.14, now "not built for now; `homeWeek` stays off" (assumed, K to confirm). Q1 to Q31 stand as listed above.

## Review round 1 (Thu, Oct 22, 2026)

Three reviews (completeness, consistency, rules) sent 55 items: 1 blocking, 33 should-fix and 21 nits. All are applied to `docs2-wt/docs/redesign/REDESIGN_SPEC.md` except the parts listed under "Not done, or done another way" below. Nothing was committed, and nothing under `/home/user/lca-website` was written.

**Files.** The spec before this round: `brief14/REDESIGN_SPEC.before-review1.md`. The edits: `brief14-tools/review1/b1_front.py` to `b31_ws02_risk.py`, run in order through `brief14-tools/review1/r1lib.py`, which applies exact replacements, refuses any whose old text does not occur exactly once, and writes nothing when one fails. The whole change: `brief14-tools/review1/review1.diff`. The spec grew from 3,359 to 3,442 lines.

### What changed, item by item

**Blocking**
- **The event answer and today's event page (WS05).** `GET /api/tournaments/[id]` keeps today's `roster` and `myRegistration` while `EVENT_PAGE_ON` (`functions/utils/events/eventPage.ts`) is unset, and adds `myPeople[]` beside them. The change that turns `newEventPage` on sets the constant, with a unit test that the two agree; from then the answer drops both, and the new page reads its entrants from WS04's endpoint under D15. Standings and prizes keep full names either way (D3). Added WS05 criterion 21 and `test/integration/tournament-detail.test.ts`; reworded WS06's entrants bullet, its API line and its code-change line so the abbreviation is the entrants endpoint's job; the flag table's `newEventPage` row names the constant.

**Personal data in public answers** (the officer-email item, the list-endpoint item and the rules item on personal data)
- A new small PR of its own before WS02, "the public-answer trim" (section 4's first sequencing note, the 1.3 and section 4 Phase 0 rows): `GET /api/clubs/[id]` stops answering officers' emails, and `GET /api/tournaments` and `GET /api/tournaments/[id]` stop answering `keep_apart`, `created_by` and `report_settings` to anyone who does not manage the event, each with its contract and a role-safety contract case, no switch, since no page shows them (checked on main: today's club page lists officers by name and role only, and only the manage page reads `keep_apart`, from its own endpoint).
- WS04 gains an API bullet for `GET /api/tournaments`, criterion 16's clause and `test/integration/public-feed.test.ts`'s case; WS05's bullet now says the trim did it and WS05 keeps it; WS09's API line, the 2.2 relay row and Q14's default ("in the next PR") follow. The club's own `contact_email` stays with Q14.

**Should-fix**
- **0.1 rule 8:** both preview scripts (`db:migrate:preview` and `db:seed:preview`, each through the guard); and no logo or photo uploaded on a preview until WS09 binds `CLUB_LOGOS` to `lca-club-logos-preview` (WS09's photos bullet, its risk and `test/unit/wrangler-config.test.ts`).
- **0.1 rule 3:** rewritten in D15's settled words; D15 no longer says K rewrites it later; D3 says its per-event setting is replaced by D15. The task's own statement of K's rules says the same (under-18s as first name and last initial on pre-event lists).
- **What ships with every switch off (0.2, new Q34):** three kinds only: WS03's slideshow removal, plain words in what the server answers (WS06's messages, WS08's rating report refusal), and state a screen reader hears and nobody sees. Every other visible item the reviews named now waits for a switch: WS08's check-in toggle (the console, `tdConsole`, as WS09 already leaves its two contrast misses for `newClubs`), the neutral category tags (`newLook`, where the clash is), WS10's weekday post dates (`newNews`), `/about`'s and `/meeting`'s words, dates and RSVP link (`newAbout`, and its flag row), the board inbox's and the results entry's chosen look (`newLook`, with `aria-pressed` in every look), and WS09's P2.18 removals (`newClubs`, `CLUB_PAGES_ON`). The email preview's logo is the same picture at the same size, so WS08 now says it needs no switch.
- **Server constants (0.2, new bullet):** `EVENT_PAGE_ON`, `NEWS_MIRROR_ON` (the Facebook sync runs only while it is set; WS10 criterion 21 and two tests) and `ADMIN_HOME_ON` (every "until Needs attention exists" path: the D22 notice, payout requests, a representative's club event to approve, club reports at 14 days, rep requests; WS08, WS09's jobs and section 4), beside the existing three. `CLUB_PAGES_ON` now covers the representatives' grants, with WS09 criterion 14 and `club-events.test.ts` checking them with the constant unset.
- **Every branch of `GET /api/tournaments` through `listedWhere`:** the signed-out branch listed events only; a signed-in member's adds their own (created, directed, entered, and a club rep's own club's drafts); the admin and view-only branch keeps every event, and from WS08 shows member-created events to LCA admins only. WS02's and WS04's `listing-rule.test.ts` bullets, WS04 criterion 16 and WS08 criterion 17 follow.
- **Member-created events in Admin (new Q35):** default LCA admins only, as WS08 builds it; the queue's `event_report` rows and the admin branch's member-created events go to LCA admins only; the sidebar row is for LCA admins; WS08 criterion 19 and `member-events.test.ts` add an officer who is also a representative, and the president. Cited at the endpoint and at criterion 19.
- **Q1:** its question now says that the hub boards K passed on the evening of Mon, Oct 19 ("everything else looks good", `rounds/2026-10-19/README.md`) draw representatives drafting and naming one-event directors now (`Account-Final-Hub-2` rule 1 and inset G1, the Bunkie Scholastic Quads, Sat, Dec 12, 2026). The Phase 3 default stands.
- **Deviations from v1.3:** filled with section 4.8's list as section 7 amends it (WS03's strip not built; WS09's club rep kept, `Clubs-H` and `Club-G`, no schedule tables or Tonight, My region and Your club; WS13's one page or rail), plus bullets for WS04, WS05, WS06, WS08, WS12 and WS15 and this round's own changes. The closing line says each PR records its own departures from 1.4 in `REDESIGN_STATUS.md`. This replaces the first assembly's choice to leave the list at one line.
- **Today's print page and half scores of 10 and more (new Q33):** default left until `newLook` is on; WS07's kit bullet says every score goes through `formatScore` in every look; `test/unit/print-kit.test.tsx` checks 10½; the Q row names `test/unit/chess-data-edges.test.tsx`.
- **A representative's club event (Q15) now has state:** WS09's migration adds `tournaments.needs_lca_approval`, `approval_requested_at`, `approved_at` and `approved_by`; the PATCH refuses `isVisible = 1` on such an event until an LCA admin's Approve and publish, whoever saves; Ask for changes clears the request; the queue's approvals source is "requested and not approved"; WS09 criterion 14 and `club-events.test.ts` follow.
- **WS07's tables before WS08's console:** a sequencing note (WS07's migration as a schema-only PR first, then WS08's console and setup, then WS07's pages), the Phase 2 rows in 1.3 and section 4, and both Depends on lines.
- **A member-created event's membership switch:** the forced-on rule and its 400 apply only while `member_event = 0`, `MembershipRequirementTournament` gains `member_event`, WS08 criterion 16 and `member-events.test.ts` check a later save.
- **A member-created event's fees:** $0 whoever saves, an LCA admin included, until a connected account exists; `canChargeFees(person, event)`; criterion 15 and `entry-fees.test.ts`.
- **One table of who may do what on an event (WS08):** create, set a fee above $0, the membership switch, naming directors, publish and delete, by grant. The one-event director's line, the Directors step, WS13's Events you direct, the PATCH and directors API lines and WS09's representative grants point to it. A representative names directors and changes the switch on the club events they drafted (WS08's wording and K's "similarly"), and WS09's API line now says so.
- **Three open events:** an event's creator may delete it while it is unpublished and has no entries (once `CREATION_ROLES_ON` is set), and the refusal says so ("Mark one as completed, or delete a draft you no longer need, to start another.").
- **The D22 notice:** `tournaments.review_notified_at` in WS08's Phase 1 migration, the notice sent only while it is empty; a `published_review` row is "notified and not reviewed"; the Phase 4 migration starts every event already emailed as reviewed; criterion 13 and `published-review.test.ts`.
- **`GET /api/live/now`** answers `{ events: [...] }`, one entry per live event, or 204; the Live tag is named by the count; "only" is gone; WS04's rows and previews read it; WS07's API line and `live-now.test.ts` follow. It reads rounds through `schedulesRepo`, never `round_schedule` (with WS02's event-mode inputs and the `checkin` wording).
- **The JSON-column drop** is named as WS05's `00xx_event_page.sql`, whatever WS04 or WS08 adds to `tournaments` first (WS05's DDL comment and section 4).
- **Named test files** for every criterion the consistency review listed, and file names for the six unnamed bullets (WS05's two, WS06's two, WS09's worker bullet, WS10's picture-shift check). WS08 criterion 24 is split into four (24 to 27; the old 25 is now 28), each with a test.
- **The `/workspace/tournaments/*` routes:** the setup routes admit whoever `GET /api/me/tournament-creation` grants, and `/:id/setup`, `/:id/live` and `/:id/recap` the event's managers, with `test/unit/app-routes.test.tsx` cases.
- **Appendix C:** a builder runs `club_regions.sql` with `--local` only; production gets the assignments from WS09's numbered migration, `00xx_club_regions.sql`, which fills only a blank region so K's corrections stand; K runs the check query as a read; D10 and WS09 follow.
- **WS11's "What LCA keeps about your child":** lists the scholastic emergency contact whenever WS06 collects it (P2.28's default changed to say so), and criterion 2 compares the card with the fields actually collected.
- **The relay's reply-to (new Q36):** the visitor stays the reply-to only on the copy to the club's own address; the copy to the representative or the admins says replying shows their address and offers Reply through LCA (a signed link and a sign-in, the answer sent from LCA's address, nothing stored), with a new endpoint, criterion 8's clause and test cases.
- **"Expired Wed, Sep 30, 2026"** (Sep 30, 2026 is a Wednesday).

**Nits**
- 0.2's migrations line: `npm run db:migrate:remote` is not used, and the preview is the only other remote database; a production read the brief asks for is K's.
- WS12's risk ("which K picked, with Member-F's dues section, draws them in its fourth panel"); WS12's placeholders read `{weekday date}`.
- D30 keeps K's words, and the phase 2 replan's reading is marked as a reading (also in the 1.3 and section 4 walkthrough rows).
- WS15 criterion 28 (Keep this game in My games starts ticked), with `games.test.ts` and `finish-card.test.tsx`.
- WS08's test run stops before US Chess's final submit and fee payment.
- The directors lines in WS08's Directors step and WS13's Events you direct are built from the table, with the club rep, and representatives only from their phase.
- WS02: a club rep in `nav.test.ts` and in criterion 17.
- `Member-D` has no copy in `canvas/boards`: the header, 1.2, WS12 and Appendix B say it is opened on the canvas.
- WS05 adds `roundAlerts`; `site_settings` is WS05's alone; WS07 builds the rate-limit helper and its table (2.2, 2.3, WS07, WS08, WS09 and section 4), which its report endpoint uses.
- The sitemap is WS09's: it lists club pages and listed events through `listedWhere` and joins `listing-rule.test.ts`; section 4 moves the exclusion from WS04 to WS09.
- Cross-references: Content › News and Tournaments › Season schedule in the header; `/recap` is WS10's; club reps' room is `/my/club/:slug` (1.2 and WS08's Why); WS07's TD view is for the event's TDs and LCA admins (P2.6); the header gives the walkthrough's date (section 7's range itself was right).
- Small gaps: `members.scholastic_emergency_contact_json` in `00xx_player_profiles.sql`; Clubs you follow waits for WS07 and WS09; the Family section's WS06 controls need `householdCheckout` (flag row and WS13); WS09's selected pin is a gold-ink ring, never brand gold on the light map; K runs the production reads (the president's seat, the guardians backfill, the uscf preflight).
- Wording: "P2.14 and P2.21 now follow the picked club boards, and S9.6 follows WS14"; the flag table's introduction in short sentences; the footer plate is K's call with no plate as the default (new Q32); WS11's first-year discount; "Show 4 more"; who edits which club page; "Each workstream they touch" with WS09, WS07 and WS15 named; "never changing layout by itself"; "1.3 named ..." for the six "the brief's" asides; "anyone not on D24's list"; "(the pending list only shrinks, 0.2)" for "WS01's ratchet"; "the phase 0 replan's question 4"; "gold-ink bar" twice; "noon UTC (7:00 AM Central in summer, 6:00 AM in winter)".

**Found while fixing (not in the reviews)**
- The preview seed, `scripts/seed/fixtures.sql`, writes both JSON columns and relies on the 0053 triggers, so WS05's drop would break `npm run db:seed:preview`, which WS06's and WS07's browser runs need. WS05's verify list, criterion 20 and `test/unit/seed-fixtures.test.ts` now cover it.
- WS08's dependency line had lost its comma once WS07's migration was named; fixed.

### Not done, or done another way
- **HANDOFF.md line 211** (part of the Q1 item): not changed. This round changes only the spec. Suggested line for whoever updates the handoff: "When the regional representatives start creating tournaments: open, Q1 in the brief's section 5 (default: from WS09's My region in Phase 3)."
- **The blocking item** offered two ways; this round takes the constant (`EVENT_PAGE_ON`) rather than waiting for today's page to be removed, so minors' full names leave the public answer the moment the new page is on, while today's page keeps working until then.
- **The visible changes** offered two ways; this round names a switch for each page change and keeps an exception list only for what no switch can reach (server messages) and what nobody sees (screen-reader state), plus the slideshow WS03 already had. `/about`'s words wait for `newAbout` rather than going into the list. The email preview's logo is judged not a visible change (same picture, same size), so it is stated as needing no switch rather than switched.
- **Three open events** offered two ways; this round lets a creator delete an unpublished event with no entries rather than counting only published events, so the limit K agreed to keeps its meaning and nobody is stuck with abandoned drafts.
- **WS07's tables** offered two ways; this round keeps the DDL in WS07 and lands its migration first, rather than moving columns into WS08.
- **The report endpoint's rate limit** offered two ways; WS07 builds the shared helper rather than the endpoint dropping its limit.
- **Q15's columns** are named `needs_lca_approval`, `approval_requested_at`, `approved_at` and `approved_by`, not `review_requested_at` and `review_approved_*`, so they cannot be confused with D22's `review_notified_at` and `reviewed_at`; `needs_lca_approval` lets the server tell a representative's event without working out grants again.
- **The relay's reply** is written as the review's first fix and also carried as Q36 with that default, since K has not said how a representative answers.
- **The header's decision dates:** "Thu, Oct 15 to Tue, Oct 20" is section 7's own range and stands; the walkthrough's date was added, section 5's heading (D1 to D30) stands, and Zextaos (Thu, Oct 22) is not a decision.

### Left outside the spec (for whoever updates those files)
- `docs/redesign/club_regions.sql`'s header still says to run it locally and then remotely.
- `HANDOFF.md`'s Security and On K's PC sections still say the only write to the preview database is `npm run db:migrate:preview`, and that K applies other remote migrations.

### Checks on the finished file (3,442 lines)
No en, em, figure or minus dash; no block marker; no assistant, vendor or model name; none of "the lead", "agent", "workflow" or "manifest"; "USCF" once, in K's rule 0.1.7; every date has its weekday; D1 to D30, Q1 to Q36, P2.1 to P2.44 and the S-series unique and in order, every reference resolves, and every new Q row is cited outside section 5; 40 flag rows, each named in a workstream; WS01 to WS15 keep the sub-order, with acceptance criteria numbered without a gap (WS05 21, WS08 28, WS10 21, WS15 28); no INTEGER id that names a tournament, member, registration, club or game.

## Review round 2 (Thu, Oct 22, 2026)

Three reviews (completeness, consistency, rules) sent 46 items: 2 blocking, 26 should-fix and 18 nits. Every blocking and should-fix item is applied, and every nit, since each was a plain correction. None is declined; seven are done another way than the review's first suggestion, listed under "Done another way" below. Nothing was committed, and nothing under `/home/user/lca-website` was written.

**Files.** The spec before this round: `brief14/REDESIGN_SPEC.before-review2.md` (3,442 lines). The edits: `brief14-tools/review2/c01_changes14.py` to `c37_appb_date.py`, run in order through `brief14-tools/review2/r2lib.py`, which applies exact replacements, refuses any whose old text does not occur exactly once, and writes nothing when one fails (`c05_ws01_split.py` splits one line and checks the words are unchanged; `c32_s5.py` inserts Q37 to Q39 after Q36). The whole change: `brief14-tools/review2/review2.diff`. The spec is now 3,575 lines.

### What changed, item by item

**Blocking**
- **Every visible change waits for its switch (rules).** 0.2's "What ships with every switch off" is gone; in its place, "Every visible change waits for its switch": words on a page wait for its switch, a new-look fix for `newLook`, and a change in what the server answers or sends that a visitor would see for the constant set with its switch. Only screen-reader state ships with every switch off. Anything else needs K's yes before its PR merges, and Q34 now asks that, with "nothing a visitor sees" as its default.
  - WS03: the slideshow is deleted only once K has turned `newLook` on (the still hero is then what every visitor sees, since `newLook` already draws it, `HomePage.tsx` line 229, checked on main); if the rest of WS03 is ready first, the deletion follows in a small PR. The bullet, criterion 17, the home spec line, the risk line, Depends on and Phase 0's "Done when" follow.
  - WS06: the registration endpoints' plain words and Stripe line names follow `HOUSEHOLD_CHECKOUT_ON` (criterion 21 and `registration-plain-language.test.ts` with the constant set and unset).
  - WS08: the rating report's new checks and its refusal's words follow a new constant, `TD_CONSOLE_ON` (`functions/utils/events/console.ts`, set with `tdConsole`), with criterion 30, `td-console-switch.test.ts` and the unset case in `rating-upload.test.ts`; 0.2's list and the `tdConsole` row name it.
  - "which no switch reaches" is gone from 0.2, WS06 and Q34.
- **The creator and `canManageTournament` (consistency).** `canManageTournament` gains no `created_by` branch. A standing director, the president or a member organizer who creates an event is written as its first director in `tournament_directors`, which today's check already admits (checked on main: a director assignment opens the event). Today's creators (admins and club reps) have no director row, so a former admin or club rep keeps nothing. Deleting a draft also needs the grant still held. Criteria 12 and 14 and `tournament-create.test.ts` gain the former club rep and former admin cases; the API's creation line, the "On today's pages" line and the organizer line follow.

**Should-fix**
- **A standing director's event (new Q37).** The table cell and the Fees step say "(assumed, Q37)"; Q37 asks LCA-run or the director's own, cites K's note of Thu, Oct 8, 2026 and D20, names the event page's tag (WS05) and D23's affiliate ID as what the answer also settles, and keeps LCA-run as the default.
- **WS09 criterion 2:** a typed club name narrows the list ("1 club matches kni · Show all 25"), a place never removes a club, filters narrow list and pins; `club-order.test.ts` gains the name case.
- **Q31:** names the conflict (`Scan-L` draws the box ticked; the 30-day rule K confirmed on Mon, Oct 19, 2026 reads as unticked), keeps unticked until K says, and WS15's part 5 canvas note and its finish-card line say so.
- **Q14 (both reviews):** the default flips. The Phase 0 trim takes `contact_email` off today's club page and out of `GET /api/clubs/:id` behind a new switch, `clubEmailHidden` (server half `CLUB_EMAIL_HIDDEN`), which K turns on after the trim merges; today's page then offers "Contact this club through LCA" (the contact form). The 2.2 relay row, WS09's API line, section 4's trim note, the flag table and 0.2's constants follow.
- **The organizer's line on every email (D27).** One helper, `markMemberEventEmail` (`functions/utils/events/memberEventEmail.ts`, WS08, Phase 4), a new 2.2 row; WS04's reminders, WS06, WS07, WS08's announcement email and WS15 call it; section 4's Phase 4 list names WS04's reminder senders and WS08's helper and announcement; WS08 criterion 29 and `member-event-emails.test.ts` walk every email kind through the outbox.
- **Scheduled publish and Q15:** a `publish_at` date is refused on a representative's club event until approved (PATCH, the Publish step, WS09), and the scheduled publish skips an event with `needs_lca_approval = 1` and no `approved_at`; `club-events.test.ts`, `published-review.test.ts` and WS09 criterion 14 gain the case.
- **The representative and club events:** the table gains a "Run the event" row; the representative's cell is every club event in the region, a club rep's own included (WS09's existing grant, and K's "manage their regions clubs and their tournaments"), while the switch, directors and publishing stay with the events they drafted; the Fees step reads "on a club event they drafted"; WS09's grants line, criterion 14 and `club-events.test.ts` follow.
- **Receipts (WS06):** LCA's receipts and the confirmation without its Paid total follow `HOUSEHOLD_CHECKOUT_ON`; K turns Stripe's receipts off the day that change deploys; criteria 9 and 10, `receipts.test.ts` (the unset case), the Jobs line, the flag row and WS12's webhook line follow.
- **Donations' return addresses (WS12):** today's `/donate/success` and `/` stay unless the request names `/give`'s (only `GivePage` sends it); `donations-checkout.test.ts` is new (checked on main: lines 48 and 49).
- **WS05's JSON drop fallback:** "WS08's next migration that changes tournaments (00xx_console.sql, Phase 2)", here and in section 4.
- **WS15's kit PDFs:** the PDFs live on `/scanner/kit`, and WS15 adds one line to the Scholastic page itself (behind `scanner2`, new page only), since `Scan-S`, K's pick, puts them there and WS11's page has no resources block; WS11 leaves Frontend's changed-elsewhere list and Depends on; `scanner-switch.test.tsx` checks the line.
- **WS14's Champions tab:** it and the `/champions` and `/state-champions` redirects exist only with `newNews` on; criterion 6 and `about-tabs.test.tsx` cover the `/governance/*` redirects and the tab with `newNews` on and off; WS10's `heritage-app-routes.test.tsx` checks its redirects (WS10 criterion 15); the flag row says so.
- **Round emails:** the publish endpoint enqueues only on `notify: true`, which only the console sends while `roundAlerts` is on; followers wait for a new switch, `followerAlerts` (server half `FOLLOWER_ALERTS_ON`), which K turns on after the pilot review. WS07 criterion 4, WS08 criterion 3, the console's Publish round, the flag table, 0.2, the risk line and Phase 2's "Done when" follow, with `round-alerts.test.ts` and `follower-alerts-switch.test.ts`.
- **D24 and `CREATION_ROLES_ON`:** the fee refusal follows the constant; criterion 15 and `entry-fees.test.ts` gain the unset case.
- **WS04's week-before reminder:** a new column, `tournament_reminders.unregistered_only`, marks the rows the migration writes and the rows today's Remind me still writes, which keep today's rule; `reminders-migration.test.ts` covers it.
- **WS13 before the rail:** until `myLcaRail` is on, everyone gets the one page and Today carries only You's and Family's items; criterion 1 is qualified, and `my-lca-frame.test.tsx` gains the case; the `newDashboard` row says so.
- **Scheduled runs, settled once in 2.2:** `workers/daily-emails` already has a `*/5` cron (the campaign sweep, checked on main), so no workstream adds a cron or a worker: WS06's expiry, WS08's scheduled publish, WS07's outbox sender, WS15's sweep and WS10's Facebook sync (the runs at :00 and :30) are phases of the five-minute run, and the timed jobs (WS13's nightly check, WS08's 7:00 AM queue email, WS09's monthly check, WS10's digest) act in the first run at or after their Louisiana time. WS06, WS07, WS08 (with the `automation_runs` job names), WS09 and WS10 follow.
- **R2 buckets:** WS04's stored link previews go in `CLUB_LOGOS` under `og/`, and the PR that stores them binds the preview bucket first; WS10's mirrored and recap photos go under `news/` (WS09 binds the preview bucket earlier in Phase 3); 0.1 rule 8, 2.2 and WS09's photos line follow.
- **The a11y-on build:** WS02 (`newNav`, `siteSearch`), WS04 (`newTournaments`), WS05 (`newEventPage`, `festivals`), WS07 (`newLive`), WS10 (`newNews`), WS11 (`newScholastic`, `themeScholastic`) and WS14 (`newAbout`) each say the build turns its switches on, with `test/a11y/baseline.json` unchanged (checked on main: the build's flags are `newLook,themeHeritage` today).
- **Untested criteria:** named files for WS05 1, 2, 6, 9, 11 and 12; WS07 2 and 5; WS03 19; WS08 7; WS10 4; WS11 1 and 3; WS12 6 and 8; and "By hand, recorded in `REDESIGN_STATUS.md`" lines for WS04 6 to 8 and WS07 1.
- **Under-18s in today's roster (new Q38):** the Phase 0 trim shortens them behind a new switch, `rosterShortNames` (server half `ROSTER_SHORT_NAMES`), with standings and prizes keeping full names, since `computeStandings` reads the names from the same rows (checked on main); WS05's switch bullet, API and criterion 21, section 4 and the flag table follow.
- **"Who may do what" heading:** now a bullet of WS08's scope, with the table and its paragraph indented under it.
- **A member-created event's marks:** the rule covers the event's own content only (the band, the cards, the phone bar, the sheets), and the site's header and footer stay as D1 sets them; its QR codes have a plain centre; WS05's bullet and criterion 18, WS07's kit and criterion 16, both Phase 4 tests and Q12's default follow.
- **"Changes in 1.4":** one short sub-bullet per change, with code names left to the workstreams (113 lines in place of 21).

**Nits**
- D28 says the gate takes effect with `scanner2` (Phase 5), and new Q39 asks about the timing, with an earlier switch as K's other choice; WS15 cites it.
- Appendix B's "brief wins" list gains `Account-Final-Hub-2` section G rule 1; Q1 notes `HANDOFF.md` reads it as answered.
- Section 4's Phase 4 list no longer names WS15, which builds the parts in from the start.
- 1.1's Heritage row, 0.1 rule 2's date, 0.2's migrations line and the `membershipRequirementSwitch` row are current.
- "Playing today?" is `newLive`'s alone (the `eventStripLive` row and WS02); the board cards join `resultReports`' row; `viewport-fit=cover` is written at build time only with `newNav` on (`vite.config.ts`, as its `prepaintPlugin` reads `newLook`, checked on main), with `prepaint-gate.test.ts` extended.
- 2.2's outbox row loses WS12 and WS13, and the live state row says who reads what.
- The hedges are gone: `automation_runs` and `rate_limits` each have one creator (WS09's DDL and 2.3 drop `rate_limits`), and the ticket kinds come from WS08's Phase 1 migration, which WS04 now depends on.
- WS07's Report this event is on the pairings and standings pages; WS08's Depends on says WS07's pages land after the console.
- WS03 criterion 8 reads "Updated 7:42 PM" through `formatTime`.
- Plain words: two-step sign-in, a one-way scrambled form of the network address, a small label above the heading, breadcrumb trail, and noindex glossed at its first use and in D26.
- 0.2's line on writing TSX; 1's "a club that meets near them"; WS09's Sent message; Appendix A's Zextaos line; WS07's highlight edge in the gold-ink token.
- WS01's deviation record has one sub-bullet per step, its words unchanged (checked by joining them back).

**Found while fixing (not in the reviews)**
- The flag table's introduction says the trim PR adds `clubEmailHidden` and `rosterShortNames`.
- The scheduled runs also settle two jobs no review named: WS08's weekday 7:00 AM queue email and WS13's nightly US Chess check had no run to ride.
- "Deviations from v1.3" gains this round's changes for WS02, WS03, WS04, WS06, WS07, WS08, WS09, WS13, WS14 and WS15.

### Done another way
- **Scheduled runs:** the review suggested a Monday cron added by WS09; the worker's existing five-minute cron carries every job instead, with the timed jobs checking the Louisiana time, so no cron trigger is added and WS08's 7:00 AM email has a run too.
- **Followers during the pilot:** a switch, `followerAlerts`, with its constant, rather than a `site_settings` row, since a setting has no Admin control before Phase 4 and K's rule puts a visible change behind a switch.
- **The representative's "Run the event" cell:** every club event in the region, from WS09's existing grant and K's words, rather than only the ones they drafted.
- **Q37's default:** LCA-run, as 1.4 was written (D22 lists those events and D23 gives them LCA's affiliate ID), marked assumed and asked.
- **WS15's kit PDFs:** WS15 adds the one line to the Scholastic page, as `Scan-S` (K's pick) draws, rather than keeping them only on `/scanner/kit`.
- **WS04's stored previews:** the PR that stores them binds `CLUB_LOGOS`' preview bucket first, rather than detecting a preview and not running.
- **Q34:** kept as a question, with "nothing a visitor sees" as its default and an exception needing K's yes before its PR merges, rather than removed, so the numbers stay as K has seen them.

### Left outside the spec (for whoever updates those files)
- `HANDOFF.md` line 211 still records Q1 as answered; Q1 now names that reading for K.
- The earlier round's notes stand: `club_regions.sql`'s header, and `HANDOFF.md`'s Security and On K's PC sections.

### Checks on the finished file (3,575 lines)
No en, em, figure or minus dash; no block marker; no assistant, vendor or model name; none of "the lead", "agent", "workflow" or "manifest"; "USCF" once, in K's rule 0.1.7; every date has its weekday; D1 to D30, Q1 to Q39, P2.1 to P2.44 and the S-series unique and in order, and every reference resolves (Q37, Q38 and Q39 are each cited outside section 5); 43 flag rows, each named in a workstream, and every switch a workstream names has a row; WS01 to WS15 keep the sub-order, with acceptance criteria numbered without a gap (WS03 22, WS05 21, WS06 21, WS07 21, WS08 30, WS09 16, WS10 21, WS15 28); no INTEGER id that names a tournament, member, registration, club or game; the boards the 1.2 table and the workstreams name are in Appendix B as before this round.
