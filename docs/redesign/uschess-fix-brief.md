# Brief: make the US Chess rating upload files import (draft, not launched)

Source: `<scratchpad>/uschess-report-audit.md` (the audit, written for K). Every gap id below (USC-nn) refers to a section of that report, which holds the official field tables, the exact fix and the test for each one. Read the gap's section before changing anything. Three claims in the audit did not hold up (USC-13, USC-20, USC-21) and are out of scope.

## Why

The site's three files (THEXPORT.DBF, TSEXPORT.DBF, TDEXPORT.DBF) mix the 1990 "version 1" layout with the 2006 "2C" layout and never declare H_FORMAT "2C". Several number fields are numeric, but the September 2025 correction to 2C makes them left-aligned text. The time control sits under the wrong field name. Byes and forfeits lack opponent 0. MUIR will most likely refuse the files, or flag every section on import. K's page 7 feedback requires that the US Chess report imports.

## Where it is built

- Branch `fix/uschess-2c-upload`, cut from `redesign/ws01-design-system` at or after e7985e1, because checkpoint B changed `functions/api/admin/tournaments/[id]/rating-report.ts` and took migration 0054.
- PR to `main` after PR 104 (checkpoint B) merges. It fixes a live feature, so it ships without a switch: today's files do not import anyway.
- The usual gate before every commit (lint count never rises, build, typecheck:functions, check:bundle, test:all) and the usual review.

## Slice U1: the 2C layout, per-section time control, checks before download

Gaps: USC-01, 02, 03, 04, 05, 06, 07, 08, 09, 11, 12, 14, 15, 16, 17, 18, 19. Do the layout part (USC-01, 02, 03, 05, 09, 11, 12, 14 to 18) as one change: a file that says "2C" but still carries version 1 fields is no better than today's.

Files:
- `src/lib/uschessUpload.ts`: the three layouts in 2C order, Char for every number field the 2C correction marks red, row objects updated in the same change, `buildUploadFiles(report, s, today = new Date())`.
- `src/components/tournaments/UsChessUploadPanel.tsx`: a per-section time control box and "Players" choice (Non-scholastic, Scholastic, JTP Primary, JTP K-12), the derived rating system shown read-only, the optional "Other assistant TDs' IDs" box, the crosstable select removed, warnings shown apart from blocking problems.
- `functions/api/admin/tournaments/[id]/rating-report.ts`: the checks in USC-06 and USC-07 (8-digit IDs, sections with no played game dropped, nothing-to-report, bad dates, end before start; end date in the future as a non-blocking warning), the result checks in USC-08, `gradeMin` and `gradeMax` per section, the other directors' IDs.
- `functions/api/admin/tournaments/[id]/games/[gameId].ts`: refuse a bye on a two-player board and a played result on a bye board (USC-08), 400 with a plain message.
- `functions/api/admin/tournaments/[id]/walk-ins.ts` and `functions/utils/members.ts`: refuse or drop a US Chess ID that is not 8 digits (USC-07 step 6).
- `domain/contracts/events.ts`, `src/lib/api.ts`: the report answer gains `warnings`, `gradeMin`, `gradeMax` and the other directors' IDs.
- Time control normaliser (USC-04): a tested prototype with 20 cases is at `<scratchpad>/usc04/tc2.ts` with `tc2-test.ts`. Move it to `domain/` (no zod) so the card and any later server check share it.

Acceptance:
1. THEXPORT starts with H_FORMAT "2C" and H_PROGRAM, has H_SENDCROS "N" and H_OTHER_TD, and has no H_RECVD or H_SCHOLAST.
2. Every field the 2C correction marks red is type C and left-aligned in the raw bytes (for example S_SEC_NUM `'1 '`, D_RATING `'0   '` for an unrated player). No descriptor is type N.
3. TSEXPORT has S_TIMECTL right after S_R_SYSTEM, in US Chess shorthand with the delay or increment stated, per section. S_SCH_LVL, S_GR_PRIX "N" and S_GP_PTS `'0  '` follow S_END_DATE.
4. Every bye, forfeit and unplayed round carries opponent 0, with the codes in the audit's round-result table.
5. Rounds after 20 are not silently dropped (USC-12).
6. The pre-download checks in USC-06, 07 and 08 block with the audit's plain messages. The future end date is a warning that does not block.
7. Two builds with the same report, settings and date give identical bytes.
8. Plain-language rules hold in every message and on the card: "US Chess" in prose, never USCF.

Tests: the unit and integration tests listed under each gap in the audit, plus a raw (untrimmed) DBF reader helper for the byte checks.

## Slice U2: the player's state (USC-10)

- Migration `0055_uscf_state.sql` through `npm run db:generate -- uscf state`: `members.uscf_state` text, nullable.
- `functions/utils/uscf.ts` keeps two capital letters from `stateRep`, else `jurisdiction`, else null. The nightly rating check and `refreshMemberUscfRating` store it, with no COALESCE, so a changed ID does not keep an old state.
- The report answer carries each player's `state`, and D_STATE writes it. Never fall back to the event's state.
- Existing members fill in through the nightly check (up to 500 a night, oldest first).
- Production gets 0055 through `migrate-db.yml` on the merge. It only adds a nullable column.

## Slice U3 (separate fix, found by the audit): member delete half-completes

Deleting a member who has played games removes their registrations, then fails because games still refer to the member. The opponent is left with a loss and no opponent number. Make the delete all-or-nothing: either refuse it with a plain message when the member has games, or run it in one batch. This is its own PR and needs K's choice between refusing and anonymising.

## Slice U4 (after K's practice upload): wording (USC-22)

Rewrite the note at the top of `uschessUpload.ts` and the card's wording once the practice upload has passed.

## Needs K

1. **Grand Prix.** Does LCA run real US Chess Grand Prix events? If not, S_GR_PRIX is always "N" and the card gets no Grand Prix choice. A local series called "Grand Prix" does not count. Default: no.
2. **Warnings on the card.** The audit proposes a separate, non-blocking warnings list, so a TD can make the trial upload US Chess encourages before the event ends. Default: yes.
3. **Known-good files.** Files exported by SwissSys or WinTD for a past LCA event would let a test compare bytes with a program MUIR already accepts. Does K, or a TD K knows, have any? The audit's testing section describes the practice event to run if not.
4. **Practice upload.** After U1 deploys, K follows the 20 steps in the audit's "Your practice upload" section: upload and validate, never submit or pay. That settles the "B" rating code, the participant coding and the round spacing.
5. **Member delete (U3).** Refuse the delete of a member with games, or keep the games and anonymise the member?
