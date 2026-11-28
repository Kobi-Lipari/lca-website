# WS02 lead notes

These notes win over the WS02 manifest and the brief where they differ. The standing rules in docs/redesign/HANDOFF.md (branch redesign/docs-phase2) and the gate still bind every slice.

## How brief 1.4 lands (Fri, Oct 23)

Brief 1.4 was cut on Thu, Oct 22 from the decisions K made after 1.3 and sits at <scratchpad>/brief14/REDESIGN_SPEC.1.4.md (3,550 lines; the untouched 1.3 copy is beside it as REDESIGN_SPEC.before-1.4.md, and the assembly notes, with the questions for K and their defaults, are in <scratchpad>/brief14/assembly-notes.md). It does not land through the docs branch: fourteen unit tests on main read docs/redesign/REDESIGN_SPEC.md, so a docs-only merge would turn main red. It lands in WS02 slice 1, on the WS02 branch cut from main at 34b721c, together with what keeps those tests green:

1. The WS01 deviation bullet (the single long "- WS01:" line under "Deviations from v1.1", line 112 of 1.3) stays byte for byte as it is in 1.3. The step 21 to 32 record tests and the K3c test pin its sentences and their order. The 1.4 copy above already has it restored; do not reflow, split or reword it, and do not touch the "Deviations from v1.2" list either. With that line in place, 13 of the 14 spec-reading test files pass against 1.4 as measured on Fri, Oct 23 at 00:30 UTC.
2. The three tests that still fail read the flag table in section 0 and expect the 1.3 count (20 switches, 15 from 1.2 and 5 from 1.3) and expect src/lib/features.ts to hold every switch the table names: test/unit/test-setup.test.ts ("finds the 20 switches in the brief", "FEATURES holds each switch from the brief, plus the earlier three, as booleans") and the step 2 record test ("names all 20 switches from the brief and the earlier three in the step 2 record"). Slice 1 adds every switch 1.4's table names to src/lib/features.ts, each false with a plain one-line comment in the file's own style, moves the two table tests to 1.4's table (the count and the names it holds, read from the table as today), and makes the step 2 record test compare the step 2 record against the frozen list of the 20 switches brief 1.3 named (write the list into the test), since that record is history and names what existed at step 2. Keep test/unit/features.test.ts's PHASE_0 list as the subset check it is, and add the new switches to it only where they are Phase 0 switches.
3. REDESIGN_STATUS.md: the Checkpoint D section says the merge is pending. Record the merge (34b721c, Thursday, October 22, 2026, after the merge-safety review and a green CI run on ffee346; the live deploy verified at 19:10 UTC with the switches off), update the step 32 record test that pins the pending wording, open the WS02 section (Status, Decisions, Deviations, Follow-ups, Verify items), and move the date line and the WS01 header to say WS01 is merged and live. Every record sentence follows the record tests' rules: no dash, no banned words, no tool names.
4. The commit message and the record say brief 1.4 lands in this slice and name the version line.

## Branches and pull requests

- redesign/ws02-navigation is cut from main at 34b721c. Each WS02 checkpoint is a draft pull request against main, merged after the merge-safety review as for WS01.
- redesign/docs-phase2 (pull request 106) stays documentation only: the phase 2 replan, the October 19 round, the WS01 and WS02 manifests and briefs, the handoff sheet, the tools and the canvas. Its copy of REDESIGN_SPEC.md stays at 1.3 plus the Zextaos line so that it merges cleanly before or after any WS02 checkpoint. Never put the 1.4 spec on that branch.
- The scratchpad briefs are copied to docs/redesign/briefs/ws02-NN-brief.json on the docs branch when each slice launches, as in WS01.

## Models and the gate

Heavy stages (build, test, review, fix) run on the strongest model at the highest effort; scouts and recorders on the lighter model at high effort (K approved on Tue, Oct 21). The gate before every commit is unchanged: lint with the error count never above 13 and none in a touched file, build, typecheck:functions, check:bundle, test:all, and test:a11y with test/a11y/baseline.json unchanged; every visible change behind newNav, siteSearch, eventStrip or eventStripLive (or the switch 1.4's table names for it), all false.

## Stale tabs after a deploy (Fri, Oct 23; add to WS02 slice 1)

On Thu, Oct 22 K's admin tab of /governance/minutes, open since before the checkpoint D deploy, fell into the "Something went wrong" screen on "Add document": the tab's index named the editor's lazy file under its old content hash, which the new deployment no longer serves, so the import failed. A hard refresh fixed it. With a deploy per checkpoint from now on this will recur for any open tab. Slice 1 adds the small guard the site lacks: in src/main.tsx, listen for the "vite:preloadError" event the build's loader fires when a lazy file fails to load, prevent its default, and reload the page once (a sessionStorage mark keeps it from looping; if the mark is set, let the error reach the boundary as today). No switch, since it changes nothing a visitor sees except that a stale tab recovers on its own; a unit test pins the listener and the once-only rule, and the record says why. Plain words only; the event name is the loader's own.

## Support in the More menu (Fri, Oct 23, K's request)

K asked for the Support entry back in the header's More menu on the live site. It lands as a one-line change on branch fix/more-menu-support from main (src/components/layout/Navbar.tsx, moreLinks: Governance, Membership, Support), with the gate, a pull request and a merge once CI is green. WS02's nav model and its header, menu sheet and drawer must carry Support under More (or wherever brief 1.4's WS02 section places support), and the WS02 branch merges main after the fix lands so its header tests start from the live menu.

## Small correction to carry (Fri, Oct 23)

The comment above the Support entry in src/components/layout/Navbar.tsx (from main, fc8109d) says "Thursday, October 23, 2026"; October 23, 2026 is a Friday. The next slice that edits Navbar.tsx (slice 5, the desktop header) corrects the weekday; no slice touches the file only for that.

## K's yes on the stale-tab reload (Fri, Oct 23)

K said yes on Friday, October 23, 2026 to the once-only reload shipping without a switch ("The reload idea sounds good. You can do it."). The next slice's recorder closes the WS02 follow-up and the Q34 item that said the reload waits for K's yes (one sentence each, with the date and weekday), and the pull request 110 text drops its "Before the merge: K's yes" section in favour of one line saying K agreed on that date. Checkpoint E merges after slice 5 with the merge-safety review only.
