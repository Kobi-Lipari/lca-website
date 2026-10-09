# Design replan, phase 2: Tournament day, clubs, scholastic, news and about (canvas pages 7 to 12)

**For:** K (owner) and the engineers building WS07, WS08's TD console, WS09, WS10, WS11 and WS14
**Status:** K's notes on canvas pages 7 to 12 came in on Fri, Oct 9, 2026. Pages 10, 11 and 12 are decided and drawn. Page 7 is decided from K's first notes, with more notes welcome, and its six decided boards are drawn. Pages 8 and 9 have round 2 options on the canvas for K to pick from. Section 1 has the detail.
**Date:** Fri, Oct 9, 2026
**Companion:** `REDESIGN_SPEC.md` v1.3. Section 4 of this document holds the text that replaces parts of the brief when version 1.4 is cut. Until then this document wins over WS02, WS03, WS04, WS07, WS08, WS09, WS10, WS11, WS13 and WS14 where they disagree. For pages 8 and 9 only the rules K stated in words land now; the layouts wait for K's pick.

The decided boards for pages 10 to 12 are on canvas pages 10 ("10 · Scholastic & parents"), 11 ("11 · News & stories") and 12 ("12 · About, board & history"): `Schol-Final`, `Schol-Final-2`, `News-Final`, `News-Final-2`, `About-Final` and `About-Final-2`. They replace `Schol-A`, `Schol-C`, `Schol-Phones`, `News-A` to `News-D` and `About-A` to `About-D`, and are copied into `docs/redesign/decided-boards` when version 1.4 is cut, together with the six decided page 7 boards listed in section 2.1. The round 2 options for pages 8 and 9 are listed in section 2.2 and are not copied until K picks. Every board carries a title strip ("Built from", "Replaces", "K's feedback applied"), a numbered legend and a "K's feedback, and where it landed" checklist, as on pages 4 and 5.

The page 7 boards follow Round 3 of the 2027 Paul Morphy Open on Sat, Jun 12, 2027 (the round starts at 7:00 PM), with sample players; the hall TV's small-field frame uses The Baton Rouge Classic on Sat, Oct 24, 2026. The clubs boards are shown on Mon, Oct 5, 2026; the scholastic, news and about pages on Fri, Oct 9, 2026.

---

## 1. Status of each page

| Page | Status | Boards | What happens next |
|---|---|---|---|
| 7 · Tournament day | Decided from K's first notes (Fri, Oct 9, 2026); more notes welcome | `Live-Final-Phones`, `Live-Final-Pairings` and `Live-Final-Pairings-2`, `Live-Final-Standings`, `Live-Final-TV`, `Live-Final-Print`; they are on canvas page 7 beside `Live-A` to `Live-E`, which they replace | K looks at the boards; anything further becomes a second round (question 1) |
| 8 · Clubs directory | Round 2 options out | `Clubs-E`, `Clubs-F`, `Clubs-G` | K picks one, or a mix (question 11) |
| 9 · Club page | Round 2 options out | `Club-D`, `Club-E`, `Club-F`, each with a part 2 | K picks one (question 17) and answers the representative proposals (questions 18 to 20) |
| 10 · Scholastic & parents | Decided | `Schol-Final`, `Schol-Final-2` | Built in WS11 (Phase 3) |
| 11 · News & stories | Decided | `News-Final`, `News-Final-2` | Built in WS10 (Phase 3) |
| 12 · About, board & history | Decided | `About-Final`, `About-Final-2` | Built in WS14 (Phase 4), with the Champions tab's data from WS10 |

WS09 is Phase 3, after the event day work in Phase 2, so the clubs pick holds up nothing being built now. Pages 1 to 6 stay as decided in the phase 0 and phase 1 replans; pages 13 to 16 still hold their option boards.

---

## 2. The pages

### 2.1 Page 7: Tournament day (live mode)

K's note, Fri, Oct 9, 2026. K had written "7. incoming" first, so more may follow (question 1).

> "My board phone: I like the find your board screen for when people are not signed in or are not registered into the tournment (not playing). Also, I think it is nice to have your board pinned when actually playing so they get that info right up, but I dont know what the A, A+, A++ thing is at the top right of the your board visual and i dont think i like it. I like the report your result thing for players who are registered for the round and are signed in. Makes it a nice feature, but the TD should be able to see that report even when both players have not gotten done reporting it (usually its just the winner who reports), but ofcourse this should not determine the match result, this should help steer the td, but they should be able to easily check this and override if necessary. I love the Hall TV mode! Great idea for throwing it up on a tv or just for players to get the general sense of things on, good inclusion. Be sure to have it be able to show all sections on the same screen if the td wants to (this should be an option) since alot of times there will not be enough players to warrent splitting it like this. on B, do not show the text results of the search on the side of the search bar, too small and looks weirdly placed. Also, I now see the point of the A, A+, A++ thing, its text size. We should include this, but have it take up a smaller footprint by being in a drop down or something, especially on mobile. On C, the different download link types should all be under a download button drop down to save footprint. On the prints, on the pairings page, make it much bigger which round it is and the section, instead of being in the header that stufff should be where that pariings a-z text is, that text is useless. maybe like Pairings -  Round 3  - Open , or something like that, etc. It is very importatnt that the download us chess report works with importing into the official us chess rating report system thing so our tournaments can be rated, i will ofcourse try to test this before doing it on a real tournament, but getting it right first would build trust."

**How the ambiguous phrases were read**
- "When people are not signed in or are not registered into the tournment (not playing)" was read as everyone with no board to pin this round: signed out, signed in but not entered (spectators, parents, players not entered), or entered but not paired this round (a bye or a withdrawal). They get Find your board first. A signed-in guardian gets My players, with each registered child followed automatically, as WS07 already has it.
- "Your board pinned when actually playing" was read as a signed-in player paired in the current round. The pinned card is "Your game": board, colour, opponent with rating, start time, the minutes left and "Updated N min ago". On phones the first tab reads My board.
- "I now see the point of the A, A+, A++ thing, its text size ... in a drop down or something, especially on mobile" was read as one small "Aa" menu on every tournament day page that has the three buttons today, at every width, not a phone-only change (section 3.2).
- "The TD should be able to see that report even when both players have not gotten done reporting it" was read as: one report puts the board in the TD's queue at once. The opponent can agree or report something else, but nothing waits for that.
- "This should not determine the match result, this should help steer the td ... easily check this and override" was read as: nothing a player reports reaches public pairings, standings, the hall TV, the results archive, round alerts or the rating report. The TD confirms a report in one tap or enters something else; the TD's entry is final, and every report stays on the record under it (section 3.1).
- "Show all sections on the same screen if the td wants to (this should be an option)" was read as a TD setting on the hall TV, with All on one screen suggested for small fields; the screen changes layout only when the TD picks (question 7).
- "On B, do not show the text results of the search on the side of the search bar" was read as: the highlighted, scrolled-to row is the whole answer. Live-C had the same kind of text beside its find box ("Devin Batiste · 2nd–4th"), so it goes there too (assumed, question 44).
- "On the prints, on the pairings page" was read as the printed pairings sheets in the print kit (Live-E), both the A–Z sheet and the by-board sheet, not the live pairings page.
- "Pairings -  Round 3  - Open , or something like that" was read as the large title "Pairings · Round 3 · Open", with the order ("Alphabetical by player", "By board") as a small line under it. Keeping the order as a small line is the replan's call, since K called the old text useless (question 1).
- "Getting it right first would build trust" was read as making the rating report's correctness an acceptance criterion with its own test plan, ahead of the Phase 2 pilot, not a polish item (section 3.8).

**Decisions**
- **Find your board stays** for anyone with no board to pin: type a few letters and see board, colour and opponent across every section, with a line offering Log in so a player's own board is pinned.
- **Your game is pinned** at the top for a signed-in player paired in the current round: board in big type, colour in words and by shape, opponent with rating, start time, minutes left, where the board is in the room (the section's room note from setup, left out when there is none; assumed, question 44), and "Updated 2 min ago".
- **Text size stays as one "Aa" menu** (Small · Medium · Large, each shown in its own size), remembered on the device, on phones and desktop. The three-button A, A+, A++ row goes everywhere.
- **Report your result** is for a signed-in player in that game, once the round has started: I won · Draw ½–½ · I lost. One report is enough. The TD sees it at once in a Reported results queue, usually from the winner alone, with no wait for the opponent.
- **A report never sets the result.** It steers the TD: one tap confirms it, or the TD enters something else. The TD's entry is final and overrides any report; a second report that disagrees is flagged "Reports disagree" and moves to the top of the queue. Public pairings, standings and the hall TV show only results a TD has confirmed or entered (assumed, question 4); until then the reporter's card reads "Reported, awaiting TD".
- **Hall TV stays** and gains a TD setting to show every section on one screen instead of cycling one section every 15 seconds, for fields too small to split. The settings mark it "Suggested" at 30 players or fewer, and the screen changes layout only when the TD picks (assumed, question 7).
- **Pairings page (Live-B):** the "1 match · U1800, board 7" text beside the search box goes; the highlighted, scrolled-to row is the answer.
- **Standings (Live-C):** CSV, PDF, Print wall chart and the US Chess report move under one Download button with a menu; the US Chess item shows only to the people who manage the event, the same people who see player reports (section 3.1; assumed, question 9).
- **Print kit (Live-E):** on each pairings sheet, A–Z and by board, the round and section become the large title, "Pairings · Round 3 · Open", in place of "Pairings A–Z: find your name"; the order stays as a small line under it, and the board's how-to words go (assumed, question 1); the running header keeps only the event name and the date. Standings and the wall chart take the same title pattern ("Standings · after Round 2 · U1800"), and the kit's own file links move under one Download menu too (assumed, question 44).
- **The US Chess rating report must import cleanly** into US Chess's rating report system so LCA events get rated. Correctness comes first, and K tests it before using it at a real event (section 3.8).
- **Standing rules the boards carry over:** round alerts by email only (D8, and WS07's rule that no alerts surface shows an SMS or phone-notification control); the boards also drop the "Phone notifications come later" line (the replan's call); no player page or rating-history link on Live-C's found-player card (D9).

**Boards** (drawn from this note on Fri, Oct 9, 2026, to replace `Live-A` to `Live-E` on canvas page 7)
- `Live-Final-Phones`: Find your board signed out or not playing, Your game pinned with the Aa menu, Report your result and what the TD sees, and a parent's My players, each with its round email.
- `Live-Final-Pairings`: the pairings page as a signed-in player in Round 3, with no text beside the search box, the Aa menu, and one report seen by the reporter, the opponent and the public.
- `Live-Final-Pairings-2`: the same page in the TD view, with the Reported results queue, counts in words, a Status column and the override sheet that keeps every report.
- `Live-Final-Standings`: standings and crosstable with one Download menu (public and TD versions), the Aa menu, and the TD's close-out panel for the US Chess rating report with its test box.
- `Live-Final-TV`: one section at a time at a 96-player event, every section on one screen at a 26-player event, and the TD's Hall TV settings.
- `Live-Final-Print`: the print kit with "Pairings · Round 3 · U1800" as the large title on the pairings sheets, one Download menu and a new printed US Chess rating report checklist.

### 2.2 Pages 8 and 9: Clubs directory and Club page (round 2)

K's notes, Fri, Oct 9, 2026.

Page 8:

> "I am leaning toward C or D since  I dont like a calendar for this. And I like having a map for this, to better help what clubs are nearby you. maybe we go to another design step for this focusing on this feedback so i can see the new options and have a better idea of how to help further"

Page 9:

> "I like the club mini site vision for this best, but take into mind i dont think we will do a leaderboard, because like previously stated, normally players are not associated with a club, that was there in the admin page to give the club managaers access to editing the club page when we were doing it that way (maybe we can retire this type of designation in the admin page now since only regional reps will have access to editing their clubs now). Lets get anotehr stage of design options focusing on these points."

**How the ambiguous phrases were read**
- "Leaning toward C or D since  I dont like a calendar for this" was read as two rules: no calendar, timetable or week grid anywhere in the directory, and round 2 grows from Clubs-C and Clubs-D only; as their title strips say, nothing comes from Clubs-A or Clubs-B.
- "I like having a map for this, to better help what clubs are nearby you" was read as the map being central to the page's main question, "which clubs are near me", not a side panel. Location is read once, on tap, and kept only in the address; a typed city or ZIP is sent only to look up a point, and is never stored or logged.
- "Another design step ... so i can see the new options" was read as three new options for each page, with nothing decided between them yet.
- "I like the club mini site vision for this best" was read as Club-B's direction winning: the club's own colour, logo, next meeting, events and news on one page. All three round 2 options are takes on it.
- "Normally players are not associated with a club" was read as: no leaderboard, no roster, no member count and no "LCA members · 14 list this as their club" on any public page. The admin page's roster goes with the proposal in question 18.
- "That was there in the admin page to give the club managaers access" was read as the member's club setting on the admin page (`members.club_id`, set through `functions/api/admin/members/[id]/club.ts`) together with the `club_rep` role.
- "Only regional reps will have access to editing their clubs now" was read as K's rule, settled: a club page is edited by the representative whose board seat covers the club's region, and by LCA admins, who can do anything. "Maybe we can retire this type of designation" was read as a proposal, so retiring `club_rep` and `members.club_id` is drawn for K to confirm (question 18). The code already supports the rule: `isRegionalRepFor` in `functions/utils/permissions.ts` gives a representative every club in the regions their seat covers (`seat_regions`, migration 0050), and `canManageClub` also lets a `club_rep` with a matching `members.club_id` in, which is the path that closes.

**Decisions** (the first six from K's notes, as read above; the last two carried into every option)
- **No calendar for clubs.** No calendar, timetable or week grid; the Clubs-B this-week view leaves the directory.
- **The map is central** and answers which clubs are near you. Location is read once, on tap, and kept only in the address; a typed city or ZIP is sent only to look up a point, and is never stored or logged.
- **Round 2 grows from Clubs-C and Clubs-D,** with nothing from Clubs-A or Clubs-B. Three options are on the canvas for K's pick: Clubs-E (the map is the page, with a drawer), Clubs-F (a sticky map beside the seven regions) and Clubs-G (cards nearest first beside a "your area" map).
- **The club mini-site direction (Club-B) wins.** Three options are on the canvas, each with a second board for the thin club and the phone: Club-D (tabbed, About · Visit · Events · News · Contact, with Visit in place of the Leaderboard), Club-E (the next meeting as the headline, read top to bottom in first-visit order) and Club-F (the club's front page with a sticky fact card and Fix on every line).
- **No leaderboard, no roster, no member count.** Players are normally not associated with clubs.
- **Only regional representatives and LCA admins edit club pages.** No club manager edits a club page: no "Club rep? Edit this page" link, no claim card and no "I run this club" path; a club that wants a change tells its representative (section 3.3). Retiring the club-manager designation itself is question 18, and whether a club keeps a named contact who posts its news is question 20.
- **Carried into all six options:** every listing names the representative who keeps it (question 41). Suggest an update and Report outdated info go to that representative and the admin queue; an open seat's listings fall to LCA admins; the monthly one-tap freshness email goes to each representative once, listing every club in the regions their seat covers, not one email per club.
- **Kept from round 1 in every directory option:** honest gaps for the 7 clubs with no schedule ("Schedule not listed · Tell us"), a "Checked" month on each listing that turns amber after 90 days, Suggest a club, Start a club, and filters in the address.

**Proposals on every board, for K to confirm**
- Retire `club_rep`, `members.club_id` and the admin page's "club members" designation (question 18). `Work-B` is not redrawn yet. Until it is, My region is built from the text in section 4.2 (no members list; a club's events are created there by the representative, assumed, question 19), and Work-B's club rep framing does not apply; question 18 covers only retiring `club_rep`, `members.club_id` and the admin page's designation.
- The representative or an LCA admin creates a club's event and names its tournament director, who runs it from the TD console (question 19).
- The representative posts the club's news; the club's contact form relays to the club's listed contact, else the representative (questions 20 and 29).

Nothing is decided between the three directory options or the three club page options.

**Boards** (round 2, on canvas pages 8 and 9)
- `Clubs-E`: the Louisiana map fills the first screen, with a 460px drawer listing exactly what the map shows; Near me from 70808 on Mon, Oct 5, 2026 at 4:40 PM, pins numbered to cards, the seven representative tiles, Start a club, two phones.
- `Clubs-F`: a sticky map cut into the seven regions on the left, clubs under seven region headers naming each representative, "Also near you, outside your region" for border towns, two phones.
- `Clubs-G`: a where-bar, then all 25 clubs ranked by road distance in 15, 30 and 60 mile rings beside a 520 × 480 "your area" map; the unlocated state and two phones.
- `Club-D` and `Club-D-2`: the tabbed mini-site for Baton Rouge Chess Club; part 2 has the thin Gonzales Chess Club (About and Contact only), the Suggest an update form, a phone and the states.
- `Club-E` and `Club-E-2`: the next-meeting mini-site, headline "Next: Wed, Oct 7 · 6:00 PM", fact tiles and a jump strip; part 2 has the thin club whose headline states the gap, a phone, and the Tonight and Off tonight states.
- `Club-F` and `Club-F-2`: the club's front page with a newest-first feed beside a sticky Visit card ("Visiting · 7 of 8 facts listed"); part 2 has the thin club, a phone and Suggest an update opened from Fix.
- Round 1's `Clubs-A` to `Clubs-D`, `Clubs-Phones` and `Club-A` to `Club-C` stay until K picks, then K's pick replaces them.

Clubs-G's "Youth program" chip and the "clubs and programs" counts on Clubs-E to Clubs-G are not built. Every listing is a club, with no `clubs.kind` (section 4.4).

### 2.3 Page 10: Scholastic & parents

K's note, Fri, Oct 9, 2026:

> "looking at A, I like the before your first event, upcoming scholastic events, still unsure ask a person, sections. i like hte find a program near you section in C, but make it minimal and maybe the club blocks that pop up are the ones geographically closest (also, these will just have to be clubs since we have no real youth programs associated, so the filters you include wont be usable). and i like the honor roll showing the scholastic champions, great idea. Also, there isnt a set in stone one published yet, but we will want to have a space to advertise the LCA scholastic tournament schedule (yearly), and also the same thing for the regular tournamnets, the regular LCA tournament schedule (this ofcourse isnt for the scholastic section, just saying). No  notes on mobile, just take into account the changes for desktop accordingly and maybe make changes to it to save space on the small screen and readability, etc."

**How the ambiguous phrases were read**
- "Looking at A, I like the before your first event, upcoming scholastic events, still unsure ask a person, sections" names Schol-A's last two sections by their headings: section 7, "Before your first event" (the questions parents ask, from "My child has never played in a tournament. Is that OK?" to "When do results and ratings appear?"), which ends with "Still unsure? Ask a person", and section 8, "Upcoming scholastic events". Those are K's pick, on one page for parents. Schol-A's guide above them (the day from check-in to awards, what to bring, chess words, sections, costs, safety and "What LCA keeps about your child") was not named; the boards keep it, ahead of K's sections (assumed, question 43). Schol-A's hero, doors and share card, and Schol-C's audience switch and its coach and school resources, were not named, so the boards leave them out (assumed, question 43).
- "Make it minimal" was read as one small block of three club cards and one line, with C's map and program list gone.
- "The club blocks that pop up are the ones geographically closest" was read as the three clubs nearest the visitor's place (a typed city or ZIP, or location read once on tap), nearest first, with "Change".
- "These will just have to be clubs ... the filters you include wont be usable" was read as: the block is titled "Find a club near you", it has no program-type filters, and no "youth program" kind is added to clubs. The five listings the brief's program finder named as youth programs (Knight Light Chess, Strategic Thoughts NOLA, Metairie Chess Academy, Beauregard Parish Youth Chess and Pineville Homeschool Chess Club) are clubs among the 25 in Appendix C, and show like any other club when they are nearest. "Kids welcome" shows on a card only when the club lists it.
- "A space to advertise the LCA scholastic tournament schedule (yearly)" with "there isnt a set in stone one published yet" was read as a new block that says so honestly today and fills from an admin-entered season once there is one (section 3.7).
- "The same thing for the regular tournamnets ... this ofcourse isnt for the scholastic section" was read as: not on this page. The same kind of space goes on the Tournaments page as "Season at a glance" (assumed, question 22), and one line on the Scholastic page points to it.
- "No  notes on mobile ... save space on the small screen and readability" was read as the same page in the same order on phones, tightened, with nothing removed that parents need.

**Decisions**
- **One Scholastic page for parents**, built from Schol-A. Schol-A's hero and doors and Schol-C's audience switch are left out as drawn (assumed, question 43).
- **Schol-A's guide leads** (assumed, question 43): the day from check-in to awards (marked Sample times, with "~" for rounds that start when the last ends, and the event's real times when opened from an event), what to bring, chess words in plain English, sections by grade band with one yes or no eligibility box, costs, safety, and "What LCA keeps about your child".
- **Before your first event** (Schol-A's questions parents ask, K's pick): the questions as Schol-A drew them, ahead of Upcoming scholastic events.
- **Upcoming scholastic events** (Schol-A): the real events. LCA rows show status in words, places and one fee; partner rows say "Registers on the organizer's site ↗" with no Register and no count; the New Orleans Youth Chess Grand Prix is one line above the list.
- **New block, This season's scholastic schedule:** nothing is published yet, so an honest placeholder ("The 2026 to 2027 scholastic schedule is being set.") with one email field (assumed, question 44); once an admin enters the season, dated rows with weekdays, each linking to its event.
- **Find a club near you** (from Schol-C), minimal: the three clubs geographically closest to the visitor, nearest first, with when they meet and "Near you: Baton Rouge 70808 · Change"; clubs only, since LCA has no youth programs; no program-type filters; "LCA lists clubs; it doesn't vet or certify them".
- **Honor roll** (Schol-C): the latest State Scholastic champions by grade band, names in plain text, "Show all years".
- **Still unsure? Ask a person** (Schol-A): writes to the board's Scholastic Director seat, or to the whole board while the seat has no holder (assumed, question 24); no personal email on the page.
- **Costs show only real prices:** Scholastic $5 and Family $25 a year, and each event's one entry fee; no member price, no sibling or lunch discount (D5, D11). LCA-run events need an LCA membership, added at checkout (D12).
- **The regular LCA tournament schedule is not on this page;** one line points to a "Season at a glance" strip on the Tournaments page (assumed, question 22).
- **Phones**, with no separate notes: the same page and order, tightened. The timeline becomes a list; what parents read once (what to bring, chess words, safety, privacy) folds into accordions; sections and costs stay open; one club at a time with "1 of 3"; the honor roll as a chip-filtered list.
- **Dropped:** program-type filters (K's note). **Left out as drawn** (assumed, question 43): the hero and doors, the share card, the audience switch, coach and school resources and host requests. Team entry moves to Phase 5 (assumed, question 26); Schol-B's pathway and series stay parked for Phase 5.

**Boards** (decided, on canvas page 10)
- `Schol-Final`: Scholastic, decided: `/scholastic` at 1440px on Fri, Oct 9, 2026, signed out, near Baton Rouge 70808, with the season inset and the 10.1 to 10.10 feedback checklist.
- `Schol-Final-2`: the same page on phones, in two long 390 × 844 frames.
- Both replace `Schol-A`, `Schol-C` and `Schol-Phones`; `Schol-B` stays parked for Phase 5.
- As drawn, both head Schol-A's guide "Before your first event" and leave out Schol-A's questions, and Schol-Final's checklist line 10.1 reads K's words as the guide. Before version 1.4 is cut they gain the questions under that heading, the guide is retitled "Your child's first tournament", and line 10.1 is corrected; until then the page is built from section 4.4.

### 2.4 Page 11: News & stories

K's note, Fri, Oct 9, 2026:

> "I like A best, but take into mind that we do have results pages for tournaments so i dont want to turn this into that, just highlights of recent ones maybe, and maybe tournaments can have some sort of admin tab, etc to allow to ease the use of this after its complete, it would allow to add the headline and etc. Do take into account on this that the bulk of posting will likely be done from the facebook since that is our predominant community outreach, it would be smart to make this work well with that. With that primary consideration in mind, Also, I like the latest section of A. And I like the from the clubs section that C has, maybe we integrate that in, becuase I would like for each club in theri page management thing, to be able to post their own news onto the site, and that section is a great way to push and feature for that."

**How the ambiguous phrases were read**
- "I like A best" was read as News-A being the base. A's big featured story goes, with Recent tournaments and the one pin doing its job (assumed, question 39). K's "just highlights of recent ones" was about tournament results, so dropping the featured story is the replan's call, not K's.
- "We do have results pages for tournaments so i dont want to turn this into that" was read as: no standings, crosstables or key games on News. Each highlight links to the event's existing results page, and News-D's full recap page is dropped.
- "Some sort of admin tab ... after its complete ... add the headline and etc." was read as a Recap tab on the tournament in Workspace that opens once the director finalizes standings, pre-filled from them, used by the event's TDs and LCA admins (the people who run the event), and usable on a phone at the venue (section 3.6).
- "The bulk of posting will likely be done from the facebook ... make this work well with that" was read as Facebook first: the site mirrors the LCA Facebook page's posts into Latest with a link back, an admin can promote one to a story, and every site story gets a share-ready card for posting back to Facebook (section 3.5).
- "I like the latest section of A" was read as Latest staying at the top of the page, as A drew it.
- "Each club in theri page management thing, to be able to post their own news" was read alongside page 9's rule that only regional representatives edit clubs: news is posted from the club page's management side by whoever keeps the club page, which is the region's representative or an LCA admin (assumed, question 29). It shows in From the clubs, on the club page and in the weekly email (section 3.4).

**Decisions**
- **News-A is the base.** Latest: one dated list grouped by month, category chips with counts, a From switch (All · Facebook · LCA), one pin with an end date, "Load 10 more" and Browse by year. A's big featured story goes; Recent tournaments and the one pin do that job (assumed, question 39).
- **Facebook comes first.** Posts on the LCA Facebook page are pulled in by the server (no Facebook plugin) and listed in Latest with their own text and photo, marked "From our Facebook page ↗"; site stories are marked LCA (assumed, question 42).
- **Promote to story:** an LCA admin (assumed, question 32) turns a mirrored post into a site story with a headline and its own page, keeping "First posted on our Facebook page ↗". Hide takes a post off the site and leaves Facebook alone.
- **Share-ready cards:** every story and recap gets a share card (image, title, one line) when published, with Share to Facebook; Follow on Facebook sits in the rail.
- **Recent tournaments: highlights only, never a results page.** Three cards, newest finished LCA event first: headline, one line of section winners, one photo, and Full results to the event's existing results page. No standings or crosstables on News.
- **A Recap tab on the tournament in Workspace** opens once the director finalizes standings ("Opens when standings are final" until then). It is pre-filled with a suggested headline, which the director can change, and the section winners (read-only); the director adds up to 400 characters and up to four photos, from a phone or from the LCA Facebook page's recent posts, with the consent box ticked. It works on a phone at the venue.
- **Publish recap** fills the Recent tournaments card, adds a Results row to Latest and "Read the recap" to the results page, makes the share card and goes in the next email; Facebook's share window is offered straight after.
- **From the clubs** (News-C) is its own section under Recent tournaments, with club colour dots, fed by news posted from a club page's management side; each post also shows on its club page and in the weekly email. "Post your club's news" speaks to whoever keeps the club page.
- **The email digest** goes out Mondays at 8:00 AM (assumed, question 44): new stories and recaps, upcoming LCA events and club news, with one-click unsubscribe.
- **Dropped:** News-B's mixed stream, News-C's five fixed sections, and News-D's full recap page with standings and the key game (those stay on the results page).

**Boards** (decided, on canvas page 11)
- `News-Final`: frame A, `/news` signed out on Fri, Oct 9, 2026; frame B, the tournament's Recap tab in Workspace on Mon, Sep 7, 2026 at 9:20 PM.
- `News-Final-2`: frame C, Workspace › News promoting a Facebook post on Mon, Sep 28, 2026; frame D, two phones (Latest, and the Recap tab).
- Both replace `News-A` to `News-D`.

### 2.5 Page 12: About, board & history

K's note, Fri, Oct 9, 2026:

> "Overall I like the layout of B the best, but i dont like that who represents me thing at the top right, its unrealistic to how things work. Also, I like how C shos the bylaws and minutes, maybe we take that knid of layout (like the change log and contents sidebars, etc), and yeah it would be nice to have the champions displayed on a tab here."

**How the ambiguous phrases were read**
- "Overall I like the layout of B the best" was read as About-B's Board & regions being the frame of one About page, with the other pieces as its tabs.
- "I dont like that who represents me thing at the top right, its unrealistic to how things work" was read as removing the About page's lookup and its routing, not only the card: on the About page nobody types a club, city or ZIP to find a person. The clubs directory's own ZIP lookup, which shows a representative by name on all three round 2 options, is put to K in question 41. People reach a region through its row's Message button, or the whole board through "Not sure who to ask?".
- "I like how C shos the bylaws and minutes, maybe we take that knid of layout (like the change log and contents sidebars, etc)" was read as the Bylaws tab being About-C's reader (contents rail on the left, change log on the right) and the Minutes tab being C's searchable archive. C's document chip bar and its Decisions register section go, since the tabs do that job.
- "It would be nice to have the champions displayed on a tab here" was read as a Champions tab holding About-D's reigning champions and the honor roll, which then lives at `/about/champions`. D's player pages go under D9; its Opera Game board was not named and goes, and its submissions form gives way to the Missing years card (assumed, question 36). D's history timeline (1837, 1857, 1858, 1915), which v1.3's WS10 scopes, was not named either; it is dropped as drawn (assumed, question 40).

**Decisions**
- **One About page built on About-B's layout, with five tabs:** About · Board & regions · Bylaws · Minutes · Champions, each with its own address (`/about`, `/about/board`, `/about/bylaws`, `/about/minutes`, `/about/champions`) and "Last updated" under its title. The Bylaws tab may be named "Bylaws & rules" (question 38).
- **"Who represents me?" is gone,** lookup and routing both. The top right holds About-A's next board meeting card (Tue, Nov 10, 2026, 7:00 PM, online, the agenda, Add to calendar, the last minutes; assumed, question 44). People reach a region through its row's Message button, or the whole board through "Not sure who to ask?".
- **Board & regions keeps About-B:** officer cards (role, term, one-line duties, Message to the role), the numbered map with seat status in words, the seven region rows with the representative, clubs and next events from live data, shared seats showing both people, and open seats as invitations to the board inbox.
- **The Bylaws tab is About-C's reader:** the web page is the official text, a sticky contents rail on the left, the change log per vote on the right (Added, Changed, Removed, with the vote's weekday and date), optional "In plain words" boxes labelled as summaries, redlines in place, compare any two versions, PDF as a download, and "Email me when this changes". On phones the contents rail becomes a sheet.
- **The Minutes tab is About-C's searchable archive:** one search over minutes, bylaws and the tournament rules with the matching sentence in the row, status in words (Draft, with when it goes for approval, or Approved), year chips and a meeting-type filter, and "Last updated" on every row.
- **The Champions tab is About-D's reigning champions** (one card per title, feeding the homepage band) and the honor roll by title with "Show all N years"; co-champions share a row; no player pages.
- **Dropped:** About-C's document chip bar and Decisions register section; About-D's player pages, ratings column and Opera Game board; About-D's submissions form (assumed, question 36); About-D's history timeline (assumed, question 40).
- **No youth programs on the Board tab.** About-Final's New Orleans Metro row says "... and 3 youth programs". Under K's page 10 note it names all eight as clubs (with Metairie Chess Academy, Knight Light Chess and Strategic Thoughts NOLA); there are no youth programs.

**Boards** (decided, on canvas page 12)
- `About-Final`: frame 1, Board & regions with the next meeting card at the top right; frame 2, the Bylaws reader; signed out on Fri, Oct 9, 2026.
- `About-Final-2`: frame 3, Minutes searching "scholastic"; frame 4, Champions; frame 5, two phones (the Board tab, and the Bylaws reader with its contents as a sheet).
- Both replace `About-A` to `About-D`.

---

## 3. Cross-page decisions

### 3.1 Player reports steer the TD and never set a result (WS07, WS08)
- **Who reports:** the signed-in White or Black player of a game, from the "Your game" card, once the round has started and until a TD result exists; not a guardian (assumed, question 3). The sheet offers I won (1–0 or 0–1) · Draw (½–½) · I lost, names the opponent and says "Your TD confirms every result".
- **One report is enough.** It reaches the TD's Reported results queue at once. The opponent's card shows the report with "That's right" and "Report something else"; agreeing tells the TD both players say the same thing, and a different answer flags the board "Reports disagree". Either player can change their report until the TD confirms.
- **Who sees a report:** the two players and the people who manage the event, which is everyone `requireTournamentManager` admits: its TDs and LCA admins, and for a club's event the club's `club_rep` until WS09 gives that grant to the region's representative (section 4.2). Nobody else sees any sign of it (assumed, question 4).
- **What a report never touches:** `tournament_games.result`, the results archive (`event_results`), round alerts and the rating report (K: a report "should not determine the match result"), and public pairings, standings, the crosstable and the hall TV (assumed, question 4). All of those read TD-entered results only.
- **What the TD does:** "Confirm 1–0" in one tap, or "Enter a different result". The TD's entry is final and overrides any report; both players' reports stay on the record with names and times, under the TD's entry. Disagreements sit at the top of the queue, then the oldest. One tap is still needed when both players agree; nothing posts by itself (assumed, question 5). When the TD confirms, both cards read "Confirmed by TD" and the public pages update within a minute.
- **Knock-on rules:** standings during a round say "after Round 3 · 8 of 13 results confirmed"; pairing the next round waits until every result of the round is confirmed; the rating report will not build while any report waits.
- **D6 changes:** player reporting was "piloted later". K's note likes the feature and has the TD see one-sided reports; the boards put it in the first build, as a steer, with no opponent confirmation (assumed, question 2; section 4.8).

### 3.2 The text-size menu, everywhere it appears
- One 44px "Aa" button opens Text size: Small · Medium · Large, each shown in its own size. Medium (today's A+) is the default; the choice is remembered on the device and never sent to the server.
- It appears on the pairings page, the standings and crosstable page, and My board on phones, at every width: at the end of the first controls line on desktop, and in the app bar on phones, as `Live-Final-Phones` draws it. (The pairings and standings boards also show it beside Refresh and Download; build it at the end of the first controls line on desktop and in the app bar on phones, on every page.)
- Large sets the pairings table to 21px with board numbers at 24px, and the standings table to 17px.
- It does not appear on the hall TV, which is sized for reading across a room (28px or larger), or in the print kit, whose Letter sheets have fixed sizes.
- It replaces the A, A+, A++ button row everywhere it was drawn, and WS07's "a text-size toggle".

### 3.3 Who keeps club listings
- **The region's representative and LCA admins** keep every club listing and club page. A representative is whoever holds a board seat in the `regional_rep` category whose `seat_regions` cover the club's region (Appendix C); the grant follows the seat, so it starts and ends with the term. The "Baton Rouge / East Central Representative" seat maps to South Central Louisiana, as Appendix C already asks. Each listing names the representative who keeps it (assumed, question 41).
- **What the representative does for each club in the region:** the schedule and its exceptions, the Tonight switch, the first-visit text and getting-in notes, the club's news (section 3.4), answering Suggest an update and Report outdated info, and the monthly one-tap confirm. The representative or an LCA admin also creates a club's event and names its tournament director, who runs it from the TD console (assumed, question 19).
- **Open seats:** a region whose `regional_rep` seat has no current holder in `board_seat_assignments`; LCA admins keep its listings until it is filled (assumed, question 16). The clubs boards show Central Louisiana and Southwest Louisiana open and About-Final shows Central Louisiana and the Bayou Region; both are sample data, and the live seat list decides. A visitor report with no answer in 14 days is flagged to LCA admins.
- **No club manager edits a club page:** no "Club rep? Edit this page", no claim card, no "I run this club". A club that wants a change tells its representative. Retiring `club_rep` and `members.club_id` is the proposal in question 18, followed as assumed; the column stays in the table, unread. Since K's rule is that only regional representatives edit clubs, the `club_rep` path to editing is removed in WS09's first PR, together with `/workspace/region` and the `/workspace` admission change, so no club is left without an editor in between (check how many members hold `club_rep` first).
- **The club-contact question is open:** does a club keep one named contact who can post the club's news and create the club's events? The boards assume not: the club's contact is an address the relay form writes to, and news and events go through the region's representative (assumed, question 20).

### 3.4 Club news: who posts it, and where it shows
- **Who posts:** the region's representative and LCA admins (assumed, question 29), from the club's page in the representative's workspace (My region › the club › News). A club sends its news to its representative.
- **Where it shows:** on the club's own page, in News › From the clubs (with the club's colour dot and name) and in the Monday digest. Not in Latest (assumed, question 31). Every published club post shows in From the clubs; there is no separate tick to send it to News.
- **The prompt:** From the clubs ends with "Post your club's news", which speaks to whoever keeps the club page and tells a club member to send it to the representative.
- **Storage:** the existing `club_news` table (migration 0001), extended with a body, a photo, who posted it and a status (section 4.3).

### 3.5 Facebook first for news
- **Posting stays on Facebook,** where the community already is. The site picks every post up by itself; an editor steps in only to promote a post that deserves a headline, or to hide one that only mattered on the day.
- **The mirror** (assumed, question 42): the server pulls the LCA Facebook page's posts on a schedule and stores each as a row; Latest lists them with their own text and photo, marked "From our Facebook page ↗", linking back to the post. No Facebook plugin or script loads on the site, which keeps standing rule 4 ("The Facebook feed is pulled server-side").
- **Promote to story** (LCA admins; assumed, question 32): a headline suggested from the first sentence, a category, the post's photo, then Publish as story. The story gets its own page and keeps "First posted on our Facebook page ↗".
- **Hide** takes a post off the site and leaves Facebook alone; a hidden post stays hidden through later syncs.
- **Back to Facebook:** every site story and recap gets a share-ready card (image, title, one line) when published, and Share to Facebook opens Facebook's share window. The site does not post to Facebook by itself, which would need Facebook page permissions LCA has not set up (assumed, question 30).
- **Recap photos** can be picked from the LCA Facebook page's recent posts, as well as uploaded from a phone.

### 3.6 Tournament recaps: a Recap tab after completion, never a results page
- **Where:** a Recap tab on the tournament in Workspace (`/workspace/tournaments/:id/recap`), for the event's TDs and LCA admins. It is greyed with "Opens when standings are final" until the director finalizes standings.
- **What is filled in:** a suggested headline, which the director can change freely, and the section winners, read from the final standings (`event_results`) and read-only here. A result corrected after finalizing reaches the recap only through WS10's audited admin correction of the snapshot, since the snapshot is immutable (News-Final's note 13, "a correction made in Pairings & results flows through", gives way to this).
- **What the director adds:** up to 400 characters and up to four photos (one marked for the card), from a phone's camera roll or the LCA Facebook page's recent posts, with the photo consent box ticked. Save draft and Publish recap stay fixed above the tab bar on a phone.
- **What Publish recap does:** fills the event's card in Recent tournaments, adds a Results row to Latest and "Read the recap" to the results page, makes the share card, puts it in the next Monday email, and offers Facebook's share window.
- **Never a results page:** News shows three highlight cards with Full results to the event's results page. The standings snippet and key-game slot leave the recap; standings, crosstables and the key game stay on the results page.

### 3.7 Season at a glance: the yearly LCA schedules
- K asked for "a space to advertise the LCA scholastic tournament schedule (yearly), and also the same thing for the regular tournamnets". Neither is published yet.
- **One admin-entered season list with two kinds:** scholastic, shown on the Scholastic page as "This season's scholastic schedule", and open, shown on the Tournaments page as "Season at a glance" (assumed, question 22).
- **Before a season is published:** an honest placeholder ("The 2026 to 2027 scholastic schedule is being set.") with one email field, "Email me when it's out" (assumed, question 44). One email goes to each address when the season is published, and the addresses are then deleted: the page promises "we store your email and nothing else".
- **Once published:** dated rows with weekdays (for example "Sat, Nov 14, 2026 · New Orleans Youth Chess November Meet · New Orleans"), each linking to its event page once the event exists; rows for events not yet created show the date, name and city, with no link.
- **Who sets it:** LCA admins, from the Tournaments group in `/admin` (the boards label it Workspace › Scholastic season; assumed, question 33). WS11 builds the season screen in Phase 3, in today's `/admin` page, and WS08 files it under Tournaments › Season schedule when the grouped sidebar lands in Phase 4 (section 4.4).

### 3.8 The US Chess rating report imports without hand edits
- **The bar:** the files the site produces must import into US Chess's rating report system so LCA events get rated, with no editing by hand. K tests this before using it at a real event; getting it right first builds trust.
- **The files:** the three dBase files US Chess's upload takes, in US Chess's 2C layout (the header declares H_FORMAT "2C"), as SwissSys and WinTD write them: the header file (`THEXPORT.DBF`, one record for the event: name, dates, affiliate, Chief TD, city, state and ZIP), the section file (`TSEXPORT.DBF`, one record per section: rating system, time control (S_TIMECTL), total rounds, the last pairing number, dates and the scholastic and Grand Prix coding) and the detail file (`TDEXPORT.DBF`, one record per player per section: pairing number, name, US Chess ID, rating, and every round's result, colour and opponent). dBase takes plain letters only, so accents are dropped.
- **The test plan, in order:**
  1. The audit of today's export (`functions/api/admin/tournaments/[id]/rating-report.ts`, `src/lib/uschessUpload.ts` and `UsChessUploadPanel.tsx`) against US Chess's published file layout is done. Today's files would very likely be refused: they mix the 1990 layout with the 2006 "2C" layout that SwissSys and WinTD write, never declare H_FORMAT "2C", store counts as numbers where the September 2025 correction to 2C wants left-aligned text, and leave opponent 0 off byes, forfeits and unplayed rounds. If US Chess did take them, every section would still need its time control typed in by hand (the files name it S_TIME_CTL where 2C reads S_TIMECTL), and every player would set off an out-of-state alert, since each player's state is blank. The fix is its own change to the existing export, ahead of WS08. Two points in it are put to K in question 10, and the fix follows their defaults until K answers: every section is coded as not Grand Prix (S_GR_PRIX "N", S_GP_PTS "0"), and checks that should not stop a download, such as an end date after today, are listed on the card as warnings. The audit's findings go in `REDESIGN_STATUS.md`, and WS08's Rating report step builds on the fixed writer.
  2. An automated test that writes the three files for a fixture event and checks every field's name, type and width against the layout, each section's round count (S_TOT_RNDS) and last pairing number (S_LST_PAIR) matching its detail records, and opponent 0 on every bye, forfeit and unplayed round; then compares the files field by field with a reference set made by SwissSys for the same event.
  3. The close-out panel's checks before any file is built: every result confirmed by a TD with no reports waiting; every result entered, with forfeits marked and left out of rating; US Chess IDs on file and memberships current; bye limits respected; the affiliate ID, the Chief TD's US Chess ID, city, state and ZIP filled in.
  4. K's own test upload of a small finished event, one also run in SwissSys or a practice event set up on the site. The panel compares the site's files with SwissSys's, and records "US Chess accepted the files" or "US Chess rejected a file" with US Chess's exact message. Until an accepted upload is recorded for the current version of the file writer, the panel reads "Not yet tested with US Chess". The test upload stops before US Chess's final submit and fee payment, so no event is rated twice and a practice event is never submitted.
  5. The Phase 2 pilot waits until a test upload imports cleanly (assumed, question 10).
  6. After a real event: "Mark as submitted to US Chess" (due within 7 days of the last round) and "Send the one-page final report to the LCA board".
- **Who sees it:** the people who manage the event, the same people who see player reports (section 3.1), in the Download menu and the console's Rating report step (assumed, question 9).

---

## 4. Where it lands in the brief (version 1.4)

These are the changes to `REDESIGN_SPEC.md`, ready to paste when version 1.4 is cut. References are to v1.3. The open questions travel into the brief as P2.1 to P2.44, numbered as in section 5. Every default from section 5 is written "(assumed, P2.N)": a builder follows it as a working assumption until K answers, never as K's decision. K's two open picks, the directory layout and the club page layout, read "(P2.11)" and "(P2.17)". Where this text gives a `requireTournamentManager` check to "the event's TDs and LCA admins", it means everyone that check admits (section 3.1). Ids follow 0.2's rule: `tournaments.id`, `registrations.id` and `members.id` are TEXT, and so is `clubs.id` (migration 0001), so every column that references one of them is TEXT.

### 4.1 WS07 · Live mode

**Canvas boards (replaces the list):**
- `Live-Final-Phones`: My board on phones, with Find your board, the pinned "Your game" card, the text-size menu, Report your result, a parent's My players and the round emails.
- `Live-Final-Pairings` and `Live-Final-Pairings-2`: the pairings page as a player and in the TD view, with the Reported results queue.
- `Live-Final-Standings`: standings and crosstable with the Download menu, and the TD close-out panel (WS08).
- `Live-Final-TV`: the hall TV, cycling or every section on one screen.
- `Live-Final-Print`: the print and QR kit with the large pairings titles and the rating report checklist.

**User-facing scope (replaces the Pairings and Results reporting bullets; adds to the Standings and crosstable, Round-ready alerts, Hall TV and Print and QR kit bullets; adds Who sees what first, Text size and Report your result; "My board and My players" and Theme stand):**
- **Pairings** (`/tournaments/:id/pairings`): round tabs and section chips with counts; By board or A–Z; each choice in the address. Type-to-find highlights the matching rows (a gold edge, the typed letters marked), opens a collapsed section that holds a match and scrolls to the first; Enter moves to the next. No result text sits beside the box. The text-size menu (below). "Updated 1 min ago" with Refresh; the page checks every 20 seconds while visible (D7). Byes in words, with the standings' result codes: "H · requested bye, ½ point", "B · pairing bye, 1 point" and "U · not paired". Results show only once a TD has confirmed them (assumed, P2.4); until then the cell is blank, whether the game is in play or has been reported. The "Round 3 pairings are ready" banner and the links to print and QR stand.
- **Who sees what first:** a signed-in player paired in the current round gets "Your game" pinned at the top (board, colour in words and by shape, opponent with rating, start time, minutes left, where the board is in the room when the section's `room_note` is set ("Boards 1 to 20, main hall"; assumed, P2.44), "Updated N min ago"). A signed-in guardian gets My players. Everyone else, signed out, not entered, or not paired this round, gets Find your board: the first tab on phones and the find box on desktop, finding board, colour and opponent across every section, with "Playing today? Log in and your own board is pinned here."
- **Text size:** one 44px "Aa" menu, Small · Medium · Large, each shown in its own size, Medium by default, remembered on the device (local storage, read safely, with Medium when it is blocked), on the pairings, standings and My board pages at every width. No A / A+ / A++ button row anywhere. The hall TV and the print kit have none.
- **Report your result:** on the "Your game" card, for the signed-in White or Black player of that game and not a guardian (assumed, P2.3), once the round has started and until a TD result exists. A sheet with I won · Draw ½–½ · I lost, naming the opponent, "Your TD confirms every result" and one Send button. After sending, the card reads "Reported, awaiting TD" and "You reported: 1–0 · Waiting for the TD"; the opponent's card shows the report with "That's right" and "Report something else". Either player can change their report until the TD confirms. Only the two players and everyone `requireTournamentManager` admits for the event (its TDs and LCA admins, and for a club's event the club's `club_rep`, or the region's representative once WS09 lands) see a report (assumed, P2.4). Nothing posts by itself: one tap confirms, also when both players agree (assumed, P2.5). When the TD confirms or enters the result, both cards read "Confirmed by TD".
- **Standings and crosstable, add:** one Download button where Live-C's links were, opening a menu (a sheet on phones) of Standings as PDF, Crosstable as CSV and Wall chart PDF for the section on screen; everyone `requireTournamentManager` admits for the event also sees "US Chess rating report" under "Tournament directors only" (assumed, P2.9), which opens the close-out panel (WS08) before anything downloads. Find a player highlights the row and opens the found-player card, with no text beside the box (assumed, P2.44); the card has no player page or rating-history link (D9). Standings count TD-confirmed results only (assumed, P2.4), and during a round the line reads "after Round 3 · 8 of 13 results confirmed".
- **Round-ready alerts, add:** no alerts surface shows a "Phone notifications come later" line.
- **Hall TV, add:** a TD setting, Show sections: "One at a time, cycling every 15 seconds" (the stored default) or "All on one screen" (every section at once, two across, each with its own header, names at 30px, no cycling). K asked for an option the TD picks, so the screen never changes layout by itself. The settings mark All on one screen "Suggested" at 30 players or fewer and unavailable above 16 boards, each with the reason in words (assumed, P2.7). The TD can pick either at any time and the TV follows within 20 seconds. In All on one screen, with "Show standings after results come in" on, the default, the screen alternates pairings and standings every 15 seconds once results are confirmed (assumed, P2.8). Only TD-confirmed results reach the TV (assumed, P2.4).
- **Print and QR kit, add:** each pairings sheet, A–Z and by board, carries the round and section as its large title ("Pairings · Round 3 · Open") where "Pairings A–Z: find your name" was, with the order as a small line under it ("Alphabetical by player", "By board"); the board's how-to words on the A–Z sheet, "find your name, then go to your board", are dropped, and the round start and the "Pts" key stay on that small line (assumed, P2.1); the page header carries only the event name and the date. Standings and the wall chart take the same title pattern (assumed, P2.44). White and Black are marked by shape as well as word. The kit's file links move under one Download menu (assumed, P2.44), with "Print Round 3 set" as the one primary action; TDs also get a printed US Chess rating report checklist (sheet 7). The by-board sheet's foot line reads "A result reported on a phone counts only once the TD confirms it."
- **Results reporting (D6, amended):** the event's TDs enter and confirm results through the WS08 console; LCA admins can do anything a TD can on any event. Signed-in players report their own game as a steer for the TD, in the first build (assumed, P2.2): one report reaches the TD at once, with no opponent confirmation, and a report never sets a result.

**Data (additions):**
```sql
-- 00xx_result_reports.sql
-- verify: tournament_games first (round, board, section, white_member_id, black_member_id, result;
-- the result CHECK since 0019 is '1-0','0-1','1/2-1/2','1-0 F','0-1 F','0-0 F','bye','bye-half','pending')
CREATE TABLE result_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES tournament_games(id) ON DELETE CASCADE,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  round INTEGER NOT NULL,
  reporter_member_id TEXT NOT NULL REFERENCES members(id),
  reporter_side TEXT NOT NULL CHECK (reporter_side IN ('white','black')),
  result TEXT NOT NULL CHECK (result IN ('1-0','0-1','1/2-1/2')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','overridden','replaced')),
  reported_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_by TEXT REFERENCES members(id),   -- the TD or admin who confirmed or overrode
  resolved_at TEXT
);
CREATE UNIQUE INDEX idx_result_reports_open ON result_reports(game_id, reporter_member_id) WHERE status = 'open';
CREATE INDEX idx_result_reports_queue ON result_reports(tournament_id, round, status);
ALTER TABLE tournament_games ADD COLUMN result_confirmed_by TEXT REFERENCES members(id);
ALTER TABLE tournament_games ADD COLUMN result_confirmed_at TEXT;
ALTER TABLE tournaments ADD COLUMN tv_layout TEXT NOT NULL DEFAULT 'cycle' CHECK (tv_layout IN ('cycle','all'));
ALTER TABLE tournaments ADD COLUMN tv_show_standings INTEGER NOT NULL DEFAULT 1;
-- verify: tournament_sections first (migration 0052)
ALTER TABLE tournament_sections ADD COLUMN room_note TEXT;   -- 'Boards 1 to 20, main hall', set in setup; the card leaves the line out when it is empty (assumed, P2.44)
```
`tournament_games.result` stays the only result, and only the TD and admin paths write it. Changing a report marks the earlier row `replaced` and adds a new one, so every report is kept. Confirming or entering a result marks the game's open reports `accepted` where they match and `overridden` where they do not. A result entered with no report touches no report rows. The text size is a device preference and is not stored on the server.

**API (additions):**
- `POST /api/tournaments/:id/games/:gameId/report` (new; `requireAuthedMember`): the caller must be the White or Black player of that game, the round published and started, and no TD-confirmed result yet; body `{ result }`; a second call replaces the caller's open report. A guardian acting for a child is refused (assumed, P2.3). Rate-limited, audited.
- `GET /api/me/event-mode` (WS02) adds the viewer's own report for the current game (`myReport`: result, status, time, and the opponent's report if any). It stays private and no-store; no public endpoint reads `result_reports` (assumed, P2.4).
- `GET /api/tournaments/:id/live` and the pairings and standings endpoints read `tournament_games.result` only, so a report changes neither their data nor their `version`.
- The TD's queue, confirm and TV settings are in WS08.

**Frontend (changes to the lists):**
- New: `src/components/live/TextSizeMenu.tsx` (in place of a toggle), `DownloadMenu.tsx`, `ReportResultSheet.tsx`, `ReportStatus.tsx` (the card's reported states for both players), `FindYourBoard.tsx` (in place of `FindMyName.tsx`).
- `MyBoardCard.tsx` carries Report your result and its states; `TournamentTvPage.tsx` renders the cycling and all-sections layouts from `tv_layout`; `TournamentPrintPage.tsx` takes the large sheet titles and the Download menu.

**Acceptance criteria (changes and additions):**
2. Typing 3 letters of a name highlights and scrolls to that row, and nothing is written beside the box. A signed-in player paired in the current round sees "Your game" pinned; a viewer who is signed out, not entered or not paired this round sees Find your board first on phones.
5. The TV page is readable from 3 m (body text 28 px or larger). It cycles through sections by default, or shows every section on one screen when the TD picks it (marked "Suggested" at 30 players or fewer and unavailable above 16 boards; assumed, P2.7), never switching by itself, and its QR code opens the phone view.
6. Every print sheet fits on Letter at 100% and its QR code scans. Each pairings sheet, A–Z and by board, carries "Pairings · Round N · Section" as its large title, and its page header carries only the event name and the date.
9. A player's report changes no public result: after a report, `/live` answers with the same `version`, and the pairings, standings, hall TV, `event_results` and the rating report are unchanged until a TD confirms or enters the result (for the public pages, assumed, P2.4).
10. Only the signed-in White or Black player of a game can report it, after the round starts and before a TD result exists; anyone else signed in gets 403, and a signed-out request 401. The report is visible to those two players and to everyone `requireTournamentManager` admits for the event (its TDs and LCA admins, and for a club's event the club's `club_rep`, or the region's representative once WS09 lands), and to nobody else (assumed, P2.4).
11. Text size is one "Aa" menu with three sizes on the pairings, standings and My board pages at 390 px and 1440 px, remembered on the device; no A / A+ / A++ button row renders.
12. The standings page shows one Download button; its menu lists the PDF, CSV and wall chart for everyone, and the US Chess rating report only for everyone `requireTournamentManager` admits for the event (assumed, P2.9).

Criteria 1, 3, 4, 7 and 8 stand.

**Tests (additions):**
- Integration: the report endpoint (each side can report; a third player and a guardian get 403; signed out gets 401; before the round starts and after a TD result it answers 409; a second report replaces the first and keeps it as `replaced`); a report leaves `/live`'s ETag and the public pairings unchanged; the Download menu's rating report item is absent for a player.
- Unit: the text-size preference (read, write, and Medium when storage is blocked); the pairings sheet title builder.

### 4.2 WS09 · Clubs as living listings

K has not picked between the round 2 options. What K settled in words lands now; the layout waits for the pick.

**Canvas boards (replaces the list, until K picks):**
- Directory, round 2: `Clubs-E` (map is the page), `Clubs-F` (map beside regions), `Clubs-G` (cards, nearest first).
- Club page, round 2: `Club-D` (tabbed), `Club-E` (next meeting first), `Club-F` (front page with a fact card), each with a part 2 (`-2`) for the thin club, a phone and the states.
- `Work-B` is not redrawn yet. Until it is, My region is built from the My region text below (no members list; a club's events are created there by the representative, assumed, P2.19), and Work-B's club rep framing does not apply; P2.18 covers only retiring `club_rep`, `members.club_id` and the admin page's designation.
- Round 1's `Clubs-A` to `Clubs-D`, `Clubs-Phones` and `Club-A` to `Club-C` stay for comparison until K picks.

**User-facing scope, lands now:**
- **No calendar (replaces the "This-week view (Clubs-B)" bullet):** the directory has no calendar, timetable or week grid. `GET /api/clubs/this-week` stays for the home page's this-week strip (WS03, `homeWeek`), where a day opens the directory filtered to clubs meeting that day (`/clubs?day=wed`), since `/clubs?view=week` no longer exists (assumed, P2.14).
- **Directory (replaces the "Directory (Clubs-A)" bullet):** the map is central and answers "which clubs are near me". Location is read once, on tap, and kept only in the address (`?near=70808`); a typed city or ZIP is sent only to look up a point, and is never stored or logged (this is what the boards' "a typed city stays on the device" means here); a denied location says "We couldn't get your location. Type a city or ZIP." Pins are numbered to match the listings, and selecting either highlights the other. Each listing shows when the club meets next; the order of a card's lines follows K's pick (P2.11). The 7 clubs with no schedule keep honest gaps ("Schedule not listed · Tell us") and sink to the end under Meets soonest. Each listing shows its "Checked" month, amber after 90 days. Suggest a club, Start a club, filters in the address, and no "Copy link to this list" control (assumed, P2.13). The layout is K's pick (P2.11).
- **Club page (replaces the "Club page" bullet):** Club-B's mini-site is the base of the page, not a branding layer: the club's colour band and logo (`clubColors.ts`, R2), the next meeting, where it is and how to get in, cost, games in plain words, the first visit, the club's events, club news, Follow, Add to calendar (an .ics with RRULEs) and a relayed Contact, which writes to the club's listed contact, else the representative (assumed, P2.20). No leaderboard, no roster, no member count and no "LCA members · N list this as their club". No officers list: today's officers block, with its personal emails, goes with the roster, and `club_officers` stays in the table, unread (assumed, P2.18). A thin club shows its unanswered facts as brackets with "Suggest an update" (assumed, P2.21); how the page scales down for a thin club is part of K's pick, and Club-C's separate compact profile is not built. The layout is K's pick (P2.17).
- **Who keeps listings (replaces the Freshness loop's "Club reps get a monthly one-tap email" and "Visitor reports go to the rep" sub-bullets):** every club is kept by the representative whose seat covers its region (`seat_regions`; Appendix C as it stands, border clubs included, assumed, P2.15) and by LCA admins, and each listing names that representative (assumed, P2.41). No club manager edits a club page: there is no "Club rep? Edit this page" link, no claim card and no "I run this club" path (retiring the `club_rep` role itself is assumed, P2.18, and so is a club having no named contact who posts its news, P2.20). An open seat's clubs fall to LCA admins until it is filled (assumed, P2.16). Suggest an update and Report outdated info write `club_reports` and reach the region's representative and the admin queue; a report with no answer in 14 days is flagged to LCA admins. The monthly one-tap email goes to each representative once, listing the region's clubs, each with "Still accurate" and "Update" (signed link, no login, valid 30 days).
- **Freshness loop, after 90 days (replaces the sub-bullet on the "Not confirmed recently" badge):** after 90 days without confirmation, the listing's "Checked" month turns amber and reads "Not checked since" and the month, as in "Not checked since Jun 2026".
- **Tonight switch (replaces the whole bullet):** the region's representative or an LCA admin sets tonight as on, moved or cancelled; it updates the club page and emails followers.
- **My region (replaces "Club rep workspace"):** `/workspace/region`, built from this text until `Work-B` is redrawn (Work-B's club rep framing, members list and club tournaments do not apply): the region's clubs, each with the freshness card, the schedule editor, the Tonight switch and club news (`DESIGN_REPLAN_phase2.md` section 3.4; assumed, P2.29), and the club's events, which the representative creates, naming the tournament director (assumed, P2.19). No members list.

**Data (changes):**
- Every `club_id` in the WS09 sketch is TEXT, since `clubs.id` is TEXT.
- `ALTER TABLE clubs ADD COLUMN confirmed_by TEXT REFERENCES members(id);` beside `last_confirmed_at`.
- `club_reports` gains `kind TEXT NOT NULL DEFAULT 'outdated' CHECK (kind IN ('outdated','suggestion','new_club'))` and `proposed_json TEXT`, beside the sketch's `field`, so the monthly email can list the questioned lines beside the one-tap confirm. Its `club_id` (TEXT) is nullable, with `CHECK ((kind = 'new_club') = (club_id IS NULL))`: a Suggest a club report has no club yet and carries the suggested club's name, city or ZIP and meeting details in `proposed_json`.
- `club_news` gains its posting columns in WS10's migration (WS10, Data); WS09 adds none. Until WS10 lands, My region posts club news through today's `functions/api/admin/clubs/[id]/news.ts` fields (title, date and excerpt).
- Whatever K picks, WS09 ships a ZIP or city to point lookup and a distance helper, used by WS09 and WS11: road miles, worked out once per club and cached in `club_distances` (club, hub, road miles, minutes), shown as "about N mi" (assumed, P2.12). Clubs already have `latitude` and `longitude` (migration 0051), but nothing yet turns a ZIP or a city into a point.
- `zip_regions` (moved from WS14), for the ZIP to region lookup and the city or ZIP routing of Start a club, is drawn by all three directory options, so WS09 builds it whichever option K picks. `region_subscriptions` for "Get updates" per region and a parish to region outline file for the shaded map, which the options also draw, are added with K's pick.

**API (changes):**
- In the Workspace endpoints line, replace "(all `requireClubRep`, scoped to the rep's own club)" with "(all `requireClubRep`: an LCA admin or the representative for the club's region)".
- The workspace endpoints keep `requireClubRep`, whose check is `canManageClub` in `functions/utils/permissions.ts`: an LCA admin, or the representative for the club's region (`isRegionalRepFor`). Since only regional representatives edit clubs, the `club_rep` branch in `canManageClub` and the matching one in `src/lib/roles.ts`'s client-side check are removed in WS09's first PR, together with `/workspace/region` and the `/workspace` admission change, so no club is left without an editor in between (check how many members hold `club_rep` first, and verify every caller). The `club_rep` branch in `canManageTournament`, which lets a club's rep manage the club's events, gives way to the representative for the club's region (`isRegionalRepFor` on `tournaments.club_id`), and `POST /api/admin/tournaments` (`functions/api/admin/tournaments.ts`) admits that representative for a club in their region in place of a `club_rep` (assumed, P2.18 and P2.19). Two checks test `club_rep` and `members.club_id` directly rather than through `canManageTournament`, and they give way to the same representative: `requireCanAssign` in `functions/api/admin/tournaments/[id]/directors.ts` (who may name and remove an event's directors) and the `requiresLcaMembership` check in `functions/api/admin/tournaments/[id].ts` (who may change the membership switch). An assigned TD still may not change that switch, as today. The named TD runs the event through a director assignment, as today.
- `POST /api/clubs/reports` (new; public, rate-limited): Suggest a club, written as a `club_reports` row with `kind = 'new_club'` and no `club_id`, routed by its city or ZIP (`zip_regions`) to the region's representative, or to LCA admins while the seat is open. `POST /api/clubs/:id/reports` stays for reports on an existing club.
- `GET /api/workspace/region` (new): the clubs a member keeps through their seats (`getRegionalClubIds`), or every club for an admin.
- The `/workspace` route admits any member who holds an active regional seat (`getRegionalClubIds` is not empty), whatever their role. verify: today `/workspace` admits only `WORKSPACE_ROLES` (`lca_auditor`, `club_rep`, `tournament_director`) or a director assignment (`src/App.tsx`, `RoleProtectedRoute.tsx`, and the Workspace link in `Navbar.tsx`), so a representative whose role is `member` or `lca_officer` cannot open `/workspace/region`.
- The monthly confirm email is sent per representative, not per club; `GET /api/clubs/confirm/:token` confirms one club and sets `last_confirmed_at` and `confirmed_by`.

**Retiring the club-member designation (assumed, P2.18; nothing is removed until every reader is verified):**
- `club_rep` leaves `src/lib/roles.ts` (the role list, its label and `WORKSPACE_ROLES`), `functions/utils/permissions.ts` and the member directory roles in `functions/utils/auth.ts`; the role triggers from migrations 0046 and 0050 are recreated without it after every member holding it is moved to `member` (verify the count first).
- `members.club_id` stops being read. Verify every reader first, at least `functions/api/admin/members/[id]/club.ts` (the admin page's club setting), `functions/api/admin/clubs/[id]/roster.ts` (the roster), `functions/api/admin/clubs/[id].ts` (the club's member list, and clearing `club_id` when a club is deleted), `functions/api/admin/clubs/[id]/officers.ts` and `officers/[officerId].ts` (an officer must be on the club's roster), `functions/api/clubs/[id].ts` with `src/pages/ClubDetailPage.tsx` (the public officers block, with each officer's email), `functions/api/admin/members.ts`, `functions/api/admin/members/export.ts`, `functions/api/me/children.ts`, `functions/utils/campaigns.ts` with `src/pages/AdminEmailPage.tsx` (the group email's "by club" audience), `functions/utils/members.ts` and `functions/utils/supabase.ts` (`club_id` copied into the login's metadata), `functions/api/admin/tournaments.ts` and `functions/api/admin/tournaments/[id]/directors.ts` (a `club_rep` creating its club's events and naming their directors), `functions/api/tournaments.ts` (a club rep's list of its club's events), `functions/api/admin/tournaments/[id]/generate-pairings.ts` (the "keep families and clubmates apart" pairing option), `src/components/auth/RoleProtectedRoute.tsx`, `src/components/admin/MembersTable.tsx`, and `src/pages/AdminPage.tsx`, `WorkspacePage.tsx`, `ManageClubPage.tsx` and `DashboardPage.tsx`. The column stays in the table, unread, since dropping it would rebuild `members`.
- The admin page's "club members" designation and the roster go, and so do the club page's officers list (with the admin officer tools), the group email's "by club" audience and the "keep families and clubmates apart" option (assumed, P2.18); an event set to it keeps families apart.

**Acceptance criteria (changes and additions):**
3. Stands for the picked layout: the map mirrors the filtered list, and selecting a listing highlights its pin and the reverse.
4. A club with unanswered key facts shows them as brackets with "Suggest an update" (assumed, P2.21), in the thin-club form K's pick draws (replaces the compact-profile switch).
6. A visitor report creates an item visible to the representative for the club's region and in the admin queue; while the seat is open it goes to the admin queue only (assumed, P2.16).
8. No calendar, timetable or week grid renders under `/clubs`, and no leaderboard, roster, member count or "list this as their club" renders on any club page.
9. Only an LCA admin or the representative for the club's region can change a club, post its news (assumed, P2.29) or flip Tonight; a representative of another region, and a `club_rep`, get 403.
10. The freshness email goes to each representative once a month, listing the region's clubs, and its one-tap confirm sets `last_confirmed_at` and `confirmed_by` for that club only.
11. A member who holds an active regional seat opens `/workspace/region` whatever their role, and sees the region's clubs and no others.

Criteria 1, 2, 5 and 7 stand.

**Frontend (changes to the lists):** `LCAMap.tsx` numbers its pins to match the listings, in place of the letter labels v1.3 names. Not built: `ThisWeekGrid.tsx`, `TonightPanel.tsx`, `CompactProfile.tsx`, and any youth-program tag or count. `ClubRow.tsx` and the club page follow K's pick (P2.11, P2.17).

**Tests (additions):** `club-permissions.test.ts` cases for the region's representative, a representative of another region, an open seat (admins only) and a `club_rep` (403); the `/workspace` route for a representative whose role is `member`; a representative names a director for a club event in their region and changes its membership switch, and a representative of another region gets 403 on both; the per-representative monthly email in the `workers/daily-emails` tests.

### 4.3 WS10 · Results archive, champions, news & recaps

**Canvas boards (replaces the list):**
- `News-Final`: the News page, and the tournament's Recap tab.
- `News-Final-2`: Promote to story in Workspace › News, and the phones.
- `About-Final-2` frame 4: the Champions tab.
- `Live-Final-Standings`: the results view.
- They replace `News-A`, `News-C`, `News-D` and `About-D`.

**User-facing scope (replaces the matching bullets):**
- **Recap drafts become the Recap tab** (`/workspace/tournaments/:id/recap`), for the event's TDs and LCA admins: greyed with "Opens when standings are final" until the event is finalized; then pre-filled with a suggested headline, which the director can change, and the section winners from `event_results` (read-only); the director adds up to 400 characters and up to four photos (one marked for the card) from a phone or from the LCA Facebook page's recent posts; Publish recap needs the consent box ticked when there are photos, and a take-down contact shows on the recap. The standings snippet, the US Chess report link and the key-game slot leave the recap. Standings, the crosstable and the key game stay on the results page; the US Chess rating report stays in the standings Download menu for the people who manage the event and in the console's Rating report step (assumed, P2.9).
- **News page (News-Final):**
  - **Latest**, at the top: one dated list grouped by month, each row with its weekday date, category and source mark; category chips with counts (Results · Announcements · Clubs · Scholastic · Board) and a From switch (All · Facebook · LCA), both in the address; one pin with an end date ("Pinned until Sun, Oct 11"), which drops off by itself; "Load 10 more"; Browse by year (`/news/2026`, `/news/2025`, older years pointing to the old site). No featured story (assumed, P2.39). Club posts are not in Latest (assumed, P2.31).
  - **Facebook first:** posts from the LCA Facebook page sit in Latest with their own text and photo, marked "From our Facebook page ↗" (`DESIGN_REPLAN_phase2.md` section 3.5; assumed, P2.42). An LCA admin can promote one to a story or hide it (assumed, P2.32).
  - **Recent tournaments:** three cards, newest finished LCA event first: headline, one line of section winners, one photo (or the event name on navy before a recap is published), and Full results, which opens the event's results page. No standings or crosstables on `/news`.
  - **From the clubs:** its own section under Recent tournaments, with club colour dots, listing news posted from club pages by the region's representative or an LCA admin (`DESIGN_REPLAN_phase2.md` section 3.4; assumed, P2.29), ending with "Post your club's news".
  - **The rail:** Follow on Facebook and the email digest sign-up.
  - **Share cards:** every story and recap gets WS04's share-preview card when published, and Share to Facebook opens Facebook's share window; the site does not post to Facebook by itself (assumed, P2.30).
- **Digest and RSS:** the weekly email goes out Mondays at 8:00 AM, Louisiana time (assumed, P2.44): new stories and recaps, upcoming LCA events and club news, with one-click unsubscribe. `/news/rss.xml` stands.
- **Champions (replaces the `About-D` timeline sub-bullet; the other sub-bullets stand; add):** WS10 builds `/about/champions` as its own page in Phase 3, under `newNews`; WS14 wraps it as the Champions tab in Phase 4. The honor roll lives there and accepts `?title=`; the event page's "Past champions ↗" and the Scholastic page's "Show all years" point there; `/champions` and `/state-champions` redirect. Reigning champions show one card per title and feed the homepage band; co-champions share a row; a missing year says so in words, and a "Missing years" card writes to the board inbox (assumed, P2.36). Names are plain text, and the year or event links to its archived results (assumed, P2.37). The About-D timeline is not built (assumed, P2.40).
- Finalize and the results index stand.

**Data (replaces the `lca_posts` lines in the sketch):**
```sql
-- verify lca_posts first (0037: id, slug, title, summary, body_html, image_url, link_url, link_label,
-- status 'draft'|'published', pinned, published_at, created_by, updated_by, created_at, updated_at)
ALTER TABLE lca_posts ADD COLUMN kind TEXT NOT NULL DEFAULT 'news' CHECK (kind IN ('news','recap'));
ALTER TABLE lca_posts ADD COLUMN category TEXT CHECK (category IN ('results','announcements','clubs','scholastic','board'));
ALTER TABLE lca_posts ADD COLUMN source TEXT NOT NULL DEFAULT 'lca' CHECK (source IN ('lca','facebook'));
ALTER TABLE lca_posts ADD COLUMN facebook_post_id TEXT;
ALTER TABLE lca_posts ADD COLUMN facebook_url TEXT;
ALTER TABLE lca_posts ADD COLUMN promoted_at TEXT;      -- a mirrored post given a headline and its own page
ALTER TABLE lca_posts ADD COLUMN promoted_by TEXT REFERENCES members(id);
ALTER TABLE lca_posts ADD COLUMN hidden_at TEXT;        -- taken off the site; Facebook is untouched
ALTER TABLE lca_posts ADD COLUMN hidden_by TEXT REFERENCES members(id);
ALTER TABLE lca_posts ADD COLUMN tournament_id TEXT REFERENCES tournaments(id);
ALTER TABLE lca_posts ADD COLUMN photos_json TEXT;      -- a recap's photos, up to four: {url, caption, on_card}
ALTER TABLE lca_posts ADD COLUMN photo_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lca_posts ADD COLUMN pinned_until TEXT;
CREATE UNIQUE INDEX idx_lca_posts_facebook ON lca_posts(facebook_post_id) WHERE facebook_post_id IS NOT NULL;
CREATE UNIQUE INDEX idx_lca_posts_recap ON lca_posts(tournament_id) WHERE kind = 'recap';
-- lca_posts.featured is not added: the featured story is dropped (assumed, P2.39)

-- verify club_news first (0001 and 0003: id, club_id, title, news_date, excerpt, created_at)
ALTER TABLE club_news ADD COLUMN body_html TEXT;
ALTER TABLE club_news ADD COLUMN image_url TEXT;
ALTER TABLE club_news ADD COLUMN posted_by TEXT REFERENCES members(id);
ALTER TABLE club_news ADD COLUMN status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published'));
ALTER TABLE club_news ADD COLUMN updated_at TEXT;
```
A mirrored post is one `lca_posts` row with `source = 'facebook'`, `status = 'published'`, a `slug` of `fb-` plus the Facebook id, its first sentence as `title`, its text in `body_html` and its first photo, copied to R2, in `image_url`. It has no page of its own until promoted and links out to `facebook_url` (every public reader enforces this; see the API below); promoting it sets the headline, a new slug, the category and `promoted_at`. Only one post is pinned at a time. A recap is a row with `kind = 'recap'` and its `tournament_id`, one per event. `category` drives the chips; the Clubs chip lists LCA stories about clubs, and club posts stay in From the clubs.

**API (changes):**
- `GET /api/news` (extend, after the check below): `source=all|facebook|lca`, `category=`, `year=` and a cursor for Load 10 more; returns Latest (hidden rows and club news left out; assumed, P2.31), Recent tournaments (the three newest finalized LCA events, with the published recap or the suggested headline and winners) and From the clubs (the latest published club news).
- verify: today `GET /api/news` (`functions/api/news.ts`) returns club news only, and `GET /api/posts` lists LCA posts. Every public reader of `lca_posts` (`functions/api/posts.ts`, `functions/api/posts/[slug].ts`, `functions/news/[slug].ts`, and once they exist WS02's `GET /api/search` (its news group), `/api/home`'s news (WS03) and `/news/rss.xml`) leaves out rows with `hidden_at` set, and serves a page only for `source = 'lca'` or `promoted_at IS NOT NULL`; `/news/fb-<id>` answers 404. Search links an unpromoted mirrored post to its `facebook_url`, never to `/news/fb-<id>`.
- `GET /api/admin/news` (new; `requireAdminView`): every post with its source and state. `POST /api/admin/news/:id/promote` `{ title, category, image }`, `POST /api/admin/news/:id/hide` and `/unhide` (new; `requireAdmin`, audited; LCA admins only, assumed, P2.32).
- `GET` and `PUT /api/admin/tournaments/:id/recap` (new; `requireTournamentManager`): the draft, pre-filled from `event_results`; 409 until `finalized_at` is set. `POST /api/admin/tournaments/:id/recap/publish`: refuses photos without consent, writes the post once, queues the digest entry and returns the share link.
- Club news keeps `functions/api/admin/clubs/[id]/news.ts` behind `requireClubRep` (an admin or the region's representative, WS09; assumed, P2.29), extended to the new columns.

**Jobs & integrations (changes):**
- **Facebook sync** (new): a scheduled job, every 30 minutes, pulls the LCA page's recent posts through the Graph API with the page settings `functions/api/facebook-posts.ts` uses today (verify: today that function calls the Graph API on each request and falls back to the single-row `facebook_feed_cache`). It upserts by `facebook_post_id` and updates edited text. It treats a post as removed, and takes it off the site, only when a fetch whose `since`/`until` range covers that post's `created_time` no longer returns it; posts older than the fetch window are left alone. A post an admin hid stays hidden. On first sync each post's first photo is copied to R2, since Graph API photo URLs expire, and `image_url` holds the copy (recap photos picked from Facebook are copied the same way). The worker gets `FACEBOOK_PAGE_TOKEN` and `FACEBOOK_PAGE_ID` as its own secrets. It runs in `workers/daily-emails` on its own cron with the worker's per-phase isolation, or in a new `workers/facebook-sync`. The site reads only the table; `facebook_feed_cache` and the `FacebookFeed.tsx` rail variant retire once it is filled, and the home page's compact Facebook rail (WS03) reads the same rows.
- **Digest:** in `workers/daily-emails`, a Monday cron that fires at 1:00 PM and 2:00 PM UTC (`0 13,14 * * 1`) and sends only in the run where it is 8:00 AM in America/Chicago (`functions/utils/time.ts`), deduped per week, since 8:00 AM Central is 1:00 PM UTC in summer and 2:00 PM UTC in winter.

**Frontend (changes to the lists):**
- Change: `NewsPage.tsx` (Latest, Recent tournaments, From the clubs), `NewsPostPage.tsx` ("First posted on our Facebook page ↗" on promoted posts), `ChampionsPage.tsx` (served at `/about/champions` in Phase 3; WS14 renders it as the Champions tab), `PostsPanel.tsx` (the Content group's News list with Promote to story and Hide).
- New: `src/components/news/LatestList.tsx`, `SourceFilter.tsx`, `RecentTournaments.tsx`, `FromTheClubs.tsx`, `PromoteSheet.tsx`; `src/components/workspace/RecapTab.tsx` with `RecapEditor.tsx` and `WinnerCards.tsx`.
- Not built: `FeaturedStory.tsx` (assumed, P2.39).

**Acceptance criteria (changes and additions):**
1. Changed: finalizing creates an immutable snapshot and a recap draft in the Recap tab with the winners filled in; running it twice does nothing.
4. News shows the one pin until its end date, filters by category and by source with both in the address, dates every row with its weekday, and loads 10 more at a time.
7. A post on the LCA Facebook page shows in Latest after the next sync, marked "From our Facebook page ↗", with no Facebook script on the page; Hide removes it from the site, leaves Facebook alone, and survives later syncs.
8. Promote to story gives a mirrored post a headline and its own page that keeps "First posted on our Facebook page ↗"; only LCA admins can promote or hide (assumed, P2.32).
9. Recent tournaments shows at most three finished LCA events, newest first, each with Full results to the event's results page; no standings table or crosstable renders on `/news`.
10. The Recap tab is disabled with "Opens when standings are final" until the event is finalized. Publishing fills the card, adds the Results row to Latest and "Read the recap" to the results page, makes the share card and adds the recap to the next digest, exactly once.
11. A published club post shows on its club page, in From the clubs and in the digest, and not in Latest (assumed, P2.31).
12. The digest goes out on Mondays at 8:00 AM, Louisiana time (assumed, P2.44), with new stories and recaps, upcoming LCA events and club news.
13. An unpromoted mirrored post has no page (`/news/fb-<id>` answers 404), search never links to one, and a hidden post is absent from `/api/posts`, `/api/home`, `/api/search`, `/news/<slug>` and the RSS feed.

Criteria 2, 3, 5 and 6 stand.

**Tests (additions):**
- Integration: the Facebook sync (insert, edit, a post leaving the page, a post older than the fetch window staying visible, a hidden post staying hidden, a second run changing nothing); the public readers (an unpromoted mirrored post answers 404 at `/news/fb-<id>`, and a hidden post is absent from every public reader); promote and hide (admin only, with a role-safety case); the recap draft and publish (409 before finalize, refused photos without consent, publishing twice changes nothing); club news posting (the region's representative and an admin can post; a representative of another region gets 403).
- Unit: the headline suggestion and the digest builder.

### 4.4 WS11 · Scholastic hub & series

**Canvas boards (replaces the list):** `Schol-Final` (the page at 1440px) and `Schol-Final-2` (phones), with `Looks-6-*` for the theme. They replace `Schol-A`, `Schol-C` and `Schol-Phones`; `Schol-B` stays parked for Phase 5. Until they are redrawn with Schol-A's questions, the text below wins where they head the guide "Before your first event" and leave the questions out.

**User-facing scope (replaces "Hub" and "First tournament guide"):**
- **One page for parents** (`/scholastic`): no hero, no doors and no audience switch (assumed, P2.43). The heading "Scholastic chess", the line "For parents of K–12 players", and seven jump links in page order: Your child's first tournament · Before your first event · Upcoming events · This season's schedule · Clubs near you · Honor roll · Ask a person. Coach and school tools come later (assumed, P2.43).
- **Your child's first tournament**, first (Schol-A's guide; assumed, P2.43): the day from check-in to awards (times marked Sample, "~" for a round that starts when the one before ends; opened from an event, `/scholastic?event=<id>`, the event's own times); what to bring (ticks saved on the device only, with Print); chess words in plain English (G/30+5 with "30 minutes each, plus 5 seconds per move", section, bye, rated, touch-move, notation); sections by grade band, with eligibility as one yes or no box; costs (Scholastic $5 and Family $25 a year, and each event's one entry fee; LCA-run events need an LCA membership, added at checkout; no member price, no sibling or lunch discount, D5 and D11); safety, with Report a concern; and "What LCA keeps about your child". There is no separate `/scholastic/first-tournament` page (it is not a route today).
- **Before your first event:** Schol-A's questions parents ask, as Schol-A drew them, kept as K picked them.
- **Upcoming scholastic events:** LCA and partner, from `GET /api/events` (WS04). LCA rows show status in words, places left and one fee; partner rows say "Registers on the organizer's site ↗" with no Register and no count. The New Orleans Youth Chess Grand Prix is one line above the list; its Sat, Nov 14, 2026 and Sat, Dec 5, 2026 meets list as LCA events, and its Sat, Mar 20, 2027 and Sat, May 8, 2027 meets as partner events (assumed, P2.25). Nearby-state events sit behind "Show nearby-state events". The iCal link stays.
- **This season's scholastic schedule** (new): the placeholder "The 2026 to 2027 scholastic schedule is being set." with one email field, "Email me when it's out" (assumed, P2.44), until an admin publishes the season; then dated rows with weekdays, each linking to its event page once the event exists; rows for events not yet created show the date, name and city, with no link. One line points to "Season at a glance" on the Tournaments page for open events (assumed, P2.22).
- **Find a club near you** (replaces the youth program finder): the three clubs nearest the visitor's place, nearest first, each with when it meets and how far; "Near you: Baton Rouge 70808 · Change" above them; until a place is given, the block shows the city or ZIP field and "Use my location". The place is read once; a typed city or ZIP is sent only to look up a point, and is never stored or logged. Clubs only, no program-type filters, and "LCA lists clubs; it doesn't vet or certify them". "Kids welcome" shows on a card only when the club lists it.
- **Honor roll:** the latest State Scholastic champions by grade band, names in plain text, and "Show all years" to `/about/champions?title=` for the scholastic titles.
- **Still unsure? Ask a person:** a short form that writes to the board's Scholastic Director seat (`scholastic-director`), or to the whole board while the seat has no holder (assumed, P2.24). It uses `POST /api/contact` (`functions/api/contact.ts`), which already opens a ticket routed to a seat by its slug through `createTicket`; WS11 extends it with a whole-board target (below). `functions/api/board/tickets.ts` is the board's own side, behind `requireSeatAccess`. Report a concern routes the same way. No personal email appears on the page.
- **Phones:** the same page and order; the timeline as a list; what to bring, chess words, safety and privacy as accordions with 52px rows; sections and costs open; four event rows, then "Show 3 more"; one club at a time with "1 of 3", Previous and Next (44px) and a swipe; the honor roll as a chip-filtered list, one chip per grade band.
- **Team and coach entries** move out of Phase 3 to wait with Schol-B in Phase 5 (assumed, P2.26); the coach role is not added now.
- Pathway and series stand (Phase 5). The theme stands.

**Data (replaces the Phase 3 part of `00xx_scholastic.sql`):**
```sql
-- 00xx_season_schedule.sql
CREATE TABLE season_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season TEXT NOT NULL,                            -- '2026-27'
  kind TEXT NOT NULL CHECK (kind IN ('scholastic','open')),
  event_date TEXT NOT NULL,                        -- first day, YYYY-MM-DD; shown with its weekday
  end_date TEXT,
  name TEXT NOT NULL,
  city TEXT,
  tournament_id TEXT REFERENCES tournaments(id),   -- set once the event exists; the row then links to it
  published_at TEXT,                               -- a season shows only once published
  created_by TEXT REFERENCES members(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_season_schedule ON season_schedule(kind, season, event_date);
CREATE TABLE season_notify (
  email TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scholastic','open')),
  season TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (email, kind, season)
);
-- clubs.kind ('youth_program') is not added: LCA has no youth programs, only clubs.
-- team_entries and registrations.team_entry_id move to Phase 5 with the coach role (assumed, P2.26).
```
Publishing a season sends one email to each address in `season_notify` for that kind and season, through the WS07 outbox, then deletes those rows. Nothing else is kept.

**API (changes):**
- `GET /api/scholastic` (new): the upcoming scholastic events, the published scholastic season (or none), the three nearest clubs for `near=` (a ZIP, a city or a rounded point, sent only to look up a point and never stored or logged; distances from WS09's helper), and the latest scholastic champions.
- `GET /api/season?kind=scholastic|open` (new; public, cached) for this page and WS04's strip.
- `POST /api/season/notify` (new; public, rate-limited) `{ email, kind }`.
- WS11 builds the admin writes in Phase 3: `GET` and `PUT /api/admin/season` and `POST /api/admin/season/publish` (new; `requireAdmin`, audited) and `src/components/admin/SeasonSchedulePanel.tsx`, shown in today's `/admin` page. WS08 files it under Tournaments › Season schedule when the grouped sidebar lands in Phase 4.
- Ask a person and Report a concern use `POST /api/contact` (`functions/api/contact.ts`), which already opens a ticket routed to a seat by its slug through `createTicket` (`functions/utils/tickets.ts`; tickets carry `seat_id`). WS11 extends it with a whole-board target and adds the rate limit it lacks today; WS14 adds a region target, routed to the region's seat. No new board endpoint is built. verify: how an unknown or unheld seat falls back today (as read, an unknown slug becomes a general inquiry with no seat, and a seat with no holder still gets the ticket, with only the staff notice to `CONTACT_EMAIL` sent).
- `POST /api/teams` and `POST /api/teams/:id/confirm/:token` move to Phase 5 (assumed, P2.26).

**Frontend (changes to the lists):**
- Change: `src/pages/ScholasticPage.tsx` becomes the whole page.
- New: `src/components/scholastic/DayTimeline.tsx`, `WhatToBring.tsx`, `Glossary.tsx`, `SeasonSchedule.tsx` (shared with WS04's strip), `NearestClubs.tsx` (in place of `ProgramFinder.tsx`), `HonorRollByBand.tsx`, `AskAPerson.tsx`; `src/components/admin/SeasonSchedulePanel.tsx` (the season list and Publish season, for LCA admins).
- Not built in Phase 3: `FirstTournamentPage.tsx` (folded into `ScholasticPage.tsx`), `AudienceSwitch.tsx` (assumed, P2.43), `ProgramFinder.tsx`; `TeamEntryForm.tsx` moves to Phase 5 (assumed, P2.26).

**Acceptance criteria (changes and additions):**
2. Stands, and the privacy card reads "Kids under 13 get no login" (assumed, P2.27); the scholastic emergency contact joins the card once S7.9 is confirmed (assumed, P2.28).
3. Find a club near you shows the three clubs nearest the visitor's place, nearest first, each with when it meets; changing the place re-ranks them; there are no filters; on phones one club shows at a time with "1 of 3".
5. Moves to Phase 5 with team entries (assumed, P2.26).
6. With no published scholastic season, the schedule block shows the placeholder and one email field. Publishing the season shows dated rows with weekdays, each linking to its event page when one exists, and sends exactly one email to each address on the list, after which the list is empty.
7. Ask a person and Report a concern create a ticket, through `POST /api/contact`, for the Scholastic Director seat, or for the whole board while the seat has no holder (assumed, P2.24); no personal email appears in the HTML.
8. No member price, sibling discount or lunch discount renders anywhere under `/scholastic` (D5, D11).

Criteria 1 and 4 stand.

**Tests (changes):** integration for publishing a season and its one email (admins only, with a role-safety case), the notify list emptying after the send, the Ask a person routing (seat held and seat open), and the nearest-clubs order with fixture clubs; the field-list guard for criterion 2 stays; the team entry tests move to Phase 5.

### 4.5 WS14 · Governance & board

**Canvas boards (replaces the list):** `About-Final` (frame 1, Board & regions; frame 2, the Bylaws reader) and `About-Final-2` (frame 3, Minutes; frame 4, Champions; frame 5, phones). They replace `About-A` to `About-D`.

**User-facing scope (replaces the four bullets):**
- **One About page with five tabs:** About · Board & regions · Bylaws & rules (assumed, P2.38) · Minutes · Champions, at `/about`, `/about/board`, `/about/bylaws`, `/about/minutes` and `/about/champions`. Each tab has its own address and "Last updated" under its title. Today's `/governance`, `/governance/board`, `/governance/bylaws`, `/governance/rules` and `/governance/minutes` redirect to the matching tab, and `/meeting` stays (verify each in `src/App.tsx`). `/about/champions` already exists as WS10's page from Phase 3, with `/champions` and `/state-champions` redirecting to it; WS14 wraps it as the Champions tab. WS02's About menu rows point at the tabs. The Heritage scope covers every tab.
- **About:** About-A's hub as WS14 already scopes it (assumed, P2.34), with no history timeline (assumed, P2.40): who LCA is with real figures, the records list with status and "Last updated", the yearly financial summary entered by the treasurer, elections, and contact the board.
- **Board & regions:** About-B's officer cards (role, term, one-line duties, and Message addressed to the role, not the person); the numbered map with seat status in words beside the colour; the seven region rows with the representative, the region's clubs and its next events from live data (partner events say "Registers on the organizer's site ↗"); shared seats showing both people; and open seats as invitations, sending interest to the board inbox tagged with the seat. The top right holds the next board meeting card (weekday, date, 7:00 PM, online, the agenda, Add to calendar, the last meeting's minutes; assumed, P2.44). "Not sure who to ask?" writes to the whole board. There is no "Who represents me?" lookup or routing.
- **Bylaws & rules:** About-C's reader. The web page is the official text; a sticky contents rail on the left marks the article on screen with a bar as well as a fill and links to the change log, the tournament rules and the PDF; the change log per vote on the right lists Added, Changed and Removed with the vote's weekday and date and its motions; optional "In plain words" boxes, written by the Secretary and labelled as a summary (assumed, P2.35); redlines in place showing Removed and Added with the motion, the vote and a link to the minutes; view any version and compare two; a generated PDF beside Print; and "Email me when this changes". On phones the contents rail becomes a pinned bar that opens a sheet holding the change log and the PDF. The tournament rules (today `/governance/rules`) read in the same reader.
- **Minutes:** About-C's archive. One search over minutes, bylaws and the tournament rules, with the matching sentence in each row and the word marked, and a line saying how many matched in each kind; status in words ("Draft", with the meeting it goes to for approval, or "Approved", with the meeting that approved it); year chips with counts and a meeting-type filter (Board, Annual, Special); "Last updated" on every row. The rail keeps the next meeting, the annual meeting and the email sign-up.
- **Champions:** WS10's `/about/champions` page as a tab (WS10, Champions).

**Data (changes):**
- `zip_regions` leaves WS14, since it served only the lookup. It moves to WS09, since all three directory options (`Clubs-E`, `Clubs-F` and `Clubs-G`) draw a ZIP to region lookup.
- The `meetings` sketch gains `minutes_status TEXT CHECK (minutes_status IN ('draft','approved'))` and `minutes_approved_meeting_id INTEGER REFERENCES meetings(id)`. `agenda_document_id` and `minutes_document_id` are TEXT, since `governance_documents.id` is TEXT (migration 0011).
- `governance_changes.change_kind` keeps `'amended'`, shown as "Changed".
- New, for "Email me when this changes":
```sql
CREATE TABLE governance_watch (
  email TEXT NOT NULL,
  doc_key TEXT NOT NULL CHECK (doc_key IN ('bylaws','rules')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (email, doc_key)
);
```
One email goes out per new version, with a signed unsubscribe link (`functions/utils/tokens.ts`).

**API (changes):**
- `GET /api/board/represent` is removed, and v1.3's `POST /api/board/contact` is not built. WS14 reuses `POST /api/contact` (`functions/api/contact.ts`), as WS11 extends it in Phase 3, for the region rows' Message, the officer cards' Message, open-seat interest and "Not sure who to ask?", and adds a region as a target, routed to the region's seat through `createTicket`.
- `GET /api/governance/search?q=&year=&type=` (new; replaces `GET /api/governance/minutes?q=&year=`): one search over minutes, bylaws and rules, returning the matching sentence and counts per kind. FTS5 if D1 supports it here (verify), otherwise LIKE over extracted text, as before.
- `POST /api/governance/watch` and `GET /api/governance/watch/unsubscribe/:token` (new).
- The rest stands.

**Frontend (changes to the lists):**
- Change: `AboutPage.tsx` becomes the tabbed page under `GovLayout.tsx`; `BoardPage.tsx`, `BylawsPage.tsx`, `MinutesPage.tsx` and `ChampionsPage.tsx` render as its tabs.
- New: `AboutTabs.tsx`, `ContentsRail.tsx` (a sheet on phones), `ChangeLog.tsx`, `PlainWords.tsx`, `GovernanceSearch.tsx` (in place of `MinutesSearch.tsx`). `NextMeetingCard.tsx`, `VersionTimeline.tsx`, `Redline.tsx`, `SeatCard.tsx` and `RecordsList.tsx` stand.
- Removed: `WhoRepresentsMe.tsx`.

**Acceptance criteria (changes and additions):**
3. One search finds keyword matches across minutes, bylaws and rules, filters by year and meeting type, and shows the matching sentence and each row's status in words.
4. Each region row's Message reaches its seat through the board inbox, or the whole board while the seat is open; "Not sure who to ask?" reaches the whole board; no lookup by club, city or ZIP exists on the About page; no personal email appears in the HTML.
6. Each tab has its own address, back and forward move between tabs, and the old `/governance/*`, `/champions` and `/state-champions` routes redirect to their tab.
7. On a phone the bylaws contents open as a sheet with the change log and the PDF in it.

Criteria 1, 2 and 5 stand.

**Tests (changes):** the represent lookup's tests are dropped; added are the search across three kinds, the redirects, the open-seat routing, and "Email me when this changes" (one email per new version, unsubscribe by token).

### 4.6 WS08 · Director & admin tools

**Canvas boards (adds):** `Live-Final-Pairings-2` (the Reported results queue, which the console uses too), `Live-Final-Standings` frame B (the close-out panel), `Live-Final-TV` inset B1 (Hall TV settings), `Live-Final-Print` sheet 7 (the printed checklist), and `News-Final` frame B (the Recap tab).

**TD event-day console (changes):**
- **Results grid:** a Reported results queue above the board list for the round. Each row shows the board, the players, the result reported, by whom and when, and the other side in words ("Opponent has not reported", "Opponent agrees", "Reports disagree"), with a matching tint. Disagreements first, then oldest first. "Confirm 1–0" in one tap, also when both players agree (assumed, P2.5), or "Enter a different result" (the existing W/D/L/F entry). The TD's entry is final and overrides any report; every report stays on the record with names and times, under the TD's entry, with an optional note, and nothing is deleted. A Status column in words on every board (Confirmed by TD · Reported by White · Reported by Black · Both agree · Reports disagree · Not reported), with Edit on confirmed rows. Counts in words: "8 of 13 confirmed · 3 reported, waiting · 2 not reported". Results entered in the console or from a paper sheet skip the queue. Pair next round waits until every result of the round is confirmed. The "Next step" card counts reports waiting.
- **TD view on the public pages:** the event's TDs and LCA admins get a "TD view | Public view" switch on the pairings and standings pages, with the same queue and the close-out panel (assumed, P2.6).
- **Hall TV settings:** Show sections (One at a time, cycling every 15 seconds, the stored default · All on one screen, as WS07 describes, marked "Suggested" with the reason in words at 30 players or fewer; assumed, P2.7), "Show standings after results come in", on by default (assumed, P2.8), and the keys for the laptop driving the TV. All on one screen is greyed with the reason in words above 16 boards. The screen changes layout only when the TD picks.
- **Rating report** (the round rail's last step, and the standings page's TD view): the checks before files are built (every result confirmed by a TD with no reports waiting; every result entered, with forfeits marked and left out of rating; US Chess IDs on file and memberships current; bye limits respected; the affiliate ID, the Chief TD's US Chess ID, city, state and ZIP filled in), each with "Passed" in words or what to fix; the three files by name, each with what it holds and a record count, one at a time for US Chess's three upload boxes (a .zip of all three as a backup copy); a read-back preview of the detail file; "Test this file before a real event", with its status in words, the steps for a test run, a box that takes SwissSys's three files and compares them field by field, and "US Chess accepted the files" or "US Chess rejected a file" with US Chess's exact message; then "Mark as submitted to US Chess", due within 7 days of the last round and shown with its weekday date, and "Send the one-page final report to the LCA board". Built on `UsChessUploadPanel.tsx`, `src/lib/uschessUpload.ts` and `functions/api/admin/tournaments/[id]/rating-report.ts` (built on the export once the 2C fix in `DESIGN_REPLAN_phase2.md` section 3.8 lands).
- **Recap tab** after Finalize (WS10), for the event's TDs and LCA admins.
- **Check-in rows** show full name, section, rating, the US Chess ID ending and the household, and no club, since players are normally not associated with clubs (D17; replaces "and club").

**Setup checklist (changes):** the Sections step gains "Where in the room" per section (`tournament_sections.room_note`, WS07; assumed, P2.44), shown on the pinned "Your game" card. The region's representative or an LCA admin creates a club's event and names its TD (assumed, P2.19); `canManageTournament` grants the representative for the club's region (WS09).

**Admin home (changes):**
- **Content › News** (`/admin/news`; WS10 extends today's `PostsPanel.tsx` in Phase 3): every post with its source (Facebook post, Story, Hidden), Promote to story and Hide on mirrored posts, and New story. Club news is posted from each club page by its representative (assumed, P2.29) and only listed here; recaps are edited from their tournament's Recap tab.
- **Tournaments › Season schedule** (`/admin/season`; built by WS11 in Phase 3): the scholastic and open seasons as dated rows (date, name, city, optional event), and Publish season, which sends the one "it's out" email (WS11). The boards label this Workspace › Scholastic season; it sits in `/admin` because only LCA admins set the season (assumed, P2.33).
- **Needs attention:** club listing reports reach the region's representative and the queue (WS09); the champion submissions approval source goes, since About-D's submissions form is not built (assumed, P2.36); the Champions tab's "Missing years" card reaches the queue as a board inbox ticket (assumed, P2.36); the "club-run tournaments" approval stands, now for the club events a representative creates (assumed, P2.19).

**Data (additions):**
```sql
-- 00xx_rating_report.sql
CREATE TABLE rating_report_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  export_version TEXT NOT NULL,      -- changes whenever the file writer changes
  outcome TEXT NOT NULL CHECK (outcome IN ('accepted','rejected')),
  message TEXT,                      -- US Chess's exact words on a rejection
  recorded_by TEXT NOT NULL REFERENCES members(id),
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE tournaments ADD COLUMN rating_submitted_at TEXT;
ALTER TABLE tournaments ADD COLUMN rating_submitted_by TEXT REFERENCES members(id);
```
The panel reads "Not yet tested with US Chess" until a row with `outcome = 'accepted'` exists for the current `export_version`, so a change to the file writer asks for a fresh test.

**API (additions):**
- `GET /api/admin/tournaments/:id/reports?round=` (new; `requireTournamentManager`): the queue, disagreements first, then oldest first.
- `POST /api/admin/tournaments/:id/reports/:reportId/confirm` (new; `requireTournamentManager`, audited): writes `tournament_games.result`, `result_confirmed_by` and `result_confirmed_at` through the same path as the results grid, and marks the game's reports. The results grid's existing write marks open reports `accepted` or `overridden` and sets the two confirmation columns.
- `PATCH /api/admin/tournaments/:id/tv` (new; `requireTournamentManager`): `tv_layout` and `tv_show_standings`.
- `GET /api/admin/tournaments/:id/rating-report` (exists; verify its shape): adds the checks, and answers 409 with the failing checks while a result is unconfirmed or a report waits. The three files are still built in the browser from its answer by `buildUploadFiles` in `src/lib/uschessUpload.ts`, the writer the 2C fix and its SwissSys comparison test cover; the step's file names, contents and record counts come from that build. It is for everyone `requireTournamentManager` admits for the event (section 3.1; assumed, P2.9); today it uses `requireTournamentView`, which also lets the view-only roles read it (verify whether they should keep that).
- `POST /api/admin/tournaments/:id/rating-report/tests` and `POST .../rating-report/submitted` (new; `requireTournamentManager`, audited).
- WS10's News endpoints sit under the Content group, and WS11's season endpoints under the Tournaments group.

**Frontend (changes to the lists):**
- New: `src/components/workspace/ReportedResultsQueue.tsx`, `HallTvSettings.tsx`, `RatingReportStep.tsx` (built on `UsChessUploadPanel.tsx`).
- Change: `ResultsGrid.tsx` (new in v1.3; it gains the Status column and marks open reports on every write), `WorkspacePage.tsx` (the way into the TD console; the My region link for representatives is WS09's, added with `/workspace/region`).

**Acceptance criteria (additions):**
8. A player's report never writes `tournament_games.result`. Confirm writes the reported result once; Enter a different result writes the TD's result and marks every open report for that game `accepted` or `overridden`; a second report that disagrees flags the board "Reports disagree" and moves it to the top of the queue.
9. The rating report's three files match US Chess's published file layout for the header, section and detail files (field names, types and widths, each section's round count (S_TOT_RNDS) and last pairing number (S_LST_PAIR) matching its detail records, and opponent 0 on every bye, forfeit and unplayed round), checked by an automated test on a fixture event and compared field by field with a SwissSys reference set for the same event; the files import into US Chess's rating report system without hand edits. Until a TD records an accepted test upload for the current file writer, the step reads "Not yet tested with US Chess".
10. The rating report step builds no file while any result is unconfirmed or any report waits, and names what to fix.
11. Only those `requireTournamentManager` admits for the event can change the hall TV setting, and the TV follows it within 20 seconds.

**Tests (additions):**
- Unit: the dBase writer with fixtures covering a full-point bye, a half-point bye, a forfeit, a withdrawal, an unrated player, two sections and a name with accents; a golden-file comparison with a SwissSys reference set.
- Integration: the queue (confirm, override, the disagreement order, and role-safety: a player and a TD of another event get 403); the rating-report endpoint (a player and a TD of another event get 403; 409 while reports wait); the test and submitted records.

**Section 4, Phase 2 "Done when" (amended):** "... switch alerts on site-wide after the pilot review. Before the pilot, a test upload of the rating report from a finished event has been accepted by US Chess and recorded in the console." (assumed, P2.10)

### 4.7 WS04 · Season at a glance (assumed, P2.22)

- **Season at a glance** (new bullet; not drawn yet, drawn once K confirms): on the Tournaments page's Upcoming tab, one strip under the page band and above the filter-and-sort line, closed by default: "2026 to 2027 LCA season · N events · Show all", opening to dated rows with weekdays (date, name, city), each linking to its event page once the event exists; rows for events not yet created show the date, name and city, with no link. With no open season published, the strip says "The 2026 to 2027 LCA tournament schedule is being set." with one email field (`season_notify`, kind `open`; assumed, P2.44). On phones it sits under the two-row toolbar, closed. It reads WS11's `season_schedule` (kind `open`) through `GET /api/season?kind=open`; `SeasonSchedule.tsx` is shared with WS11.
- **When it is built:** with WS11 in Phase 3, behind `seasonSchedule`. WS04's Phase 1 PRs do not wait for it, and criterion 15 is checked when WS11 lands.
- **Acceptance criterion (added):** 15. With a published open season, the Tournaments page shows Season at a glance with dated rows and weekdays, each linking to its event page where one exists; with none published, it shows the placeholder and one email field; the Scholastic page's line links to it.

### 4.8 Brief-wide changes

**Header:**
- The "Version" line reads: "**Version:** 1.4, Fri, Oct 9, 2026. Adds K's decisions on canvas pages 7 and 10 to 12, and the rules K set for pages 8 and 9, from DESIGN_REPLAN_phase2.md."
- The "Design source" line reads: "**Design source:** the canvas "LCA Look & Feel Options". Pages 1 to 5, 7 and 10 to 12 carry the decided boards (copies in `docs/redesign/decided-boards`). Page 6 (Registration) is decided as the Reg-C household checkout with the family model; its decided board is drawn when WS06 starts. Pages 8 and 9 hold round 2 options until K picks. The later pages still hold option boards. Board names in this brief, such as `Event-Final-1` or `Clubs-E`, refer to artboards on that canvas. Open the named board before building a screen."
- After "Changes in 1.3", a new list:

**Changes in 1.4** (the reasoning for each is in `docs/redesign/DESIGN_REPLAN_phase2.md`, sections 1 to 3):
- **Live mode (WS07):** the Live-Final boards replace `Live-A` to `Live-E`; Find your board for anyone with no board to pin, and "Your game" pinned for a paired player, with where the board is in the room (assumed, P2.44); one "Aa" text-size menu in place of the A, A+, A++ row; Report your result as a steer the TD confirms (D6 amended); one Download menu on standings; the hall TV shows every section on one screen when the TD picks it, suggested at 30 players or fewer; the round and section as the large title on the printed pairings.
- **Director tools (WS08):** the Reported results queue and a Status column in the results grid; Hall TV settings; the Rating report step with its checks, the three named files, the test record and the submission mark (D19); the Recap tab; `/admin/news` (built by WS10) and `/admin/season` (built by WS11) filed in the grouped sidebar; "Where in the room" per section in setup (assumed, P2.44); check-in rows without a club; no champion submissions in pending approvals (assumed, P2.36).
- **Clubs (WS09):** no calendar for clubs; the map central to "near me"; listings kept by the regional representative and LCA admins (D17), with My region at `/workspace/region`; no leaderboard, roster or member count; a place lookup and distance helper; the directory and club page layouts wait for K's round 2 picks (P2.11, P2.17).
- **News and champions (WS10):** Latest with the Facebook mirror, Promote to story and Hide (D18); Recent tournaments as highlights that link to each event's results page; From the clubs fed from club pages; the Recap tab after Finalize; `/about/champions` as its own page in Phase 3.
- **Scholastic (WS11):** one page for parents from `Schol-Final`, with Schol-A's "Before your first event" questions kept, and without the hero, doors, audience switch or coach and school resources (assumed, P2.43); the season schedule block, with its admin screen and endpoints in Phase 3; Find a club near you with the three nearest clubs; `POST /api/contact` extended with a whole-board target for Ask a person and Report a concern; team entries and the coach role move to Phase 5 (assumed, P2.26).
- **Governance (WS14):** one About page with five tabs on About-B's layout, which WS02's About menu rows point at; no "Who represents me?"; About-C's bylaws reader and searchable minutes; Champions as a tab; `zip_regions` leaves WS14.
- **Tournaments list (WS04):** Season at a glance on the Upcoming tab (assumed, P2.22), with acceptance criterion 15.
- **Homepage (WS03):** a day on the this-week strip opens `/clubs?day=` (assumed, P2.14); the compact Facebook rail reads the mirror.
- **My LCA (WS13):** the club rep section becomes the regional representative's, linking to My region.
- **Decisions:** D6 amended; D17 to D19 added. The replan's open questions are carried at the end of section 5 as P2.1 to P2.44.

**Section 0.2, the id rule:** "`tournaments.id`, `registrations.id`, `members.id` and `clubs.id` are TEXT (migrations 0001 and 0046): every `tournament_id`, `parent_event_id`, `registration_id`, `cloned_from_id`, `club_id` or member id sketched as INTEGER in this brief, and any other column that references one of those four tables, is TEXT when built; so is any column that references another existing TEXT id (`tournament_games`, `governance_documents`, `lca_posts`, `club_news` among them)."

**Section 1.1, Heritage row:** the full-scope pages read "`/about` and its tabs (`/about/board`, `/about/bylaws`, `/about/minutes`, `/about/champions`), `/meeting`, and, until `newAbout` and `newNews` redirect them, `/governance/board`, `/governance/bylaws`, `/governance/minutes` and `/champions`" in place of "`/about` (with the history timeline), `/governance/board`, `/governance/bylaws` and `/governance/minutes` ... `/meeting` and `/champions`" (the history timeline is not built; assumed, P2.40); the reset to base for the editors and forms inside them stands.

**Section 1.2, the pick for each section (rows replaced):**

| Section | Build from | Borrow |
|---|---|---|
| Tournament day | `Live-Final-Phones`, `Live-Final-Pairings` and `-2`, `Live-Final-Standings`, `Live-Final-TV` and `Live-Final-Print` as one live-mode system | Phased: pairings, standings and My board first (with player reports and the TD's queue), then print & QR, then TV |
| Clubs | K's round 2 pick among `Clubs-E`, `Clubs-F` and `Clubs-G`: no calendar, the map central to "near me" | Listings kept by the regional representatives and LCA admins |
| Club page | K's round 2 pick among `Club-D`, `Club-E` and `Club-F`: Club-B's mini-site | No leaderboard, roster or member count; thin clubs show their gaps with Suggest an update |
| Scholastic | `Schol-Final`, one page for parents | `Schol-Final-2` phones; `Schol-B` pathway and Grand Prix series in Phase 5 |
| News | `News-Final`: Latest with Facebook first, Recent tournaments, From the clubs | `News-Final-2` Promote to story and phones; the tournament's Recap tab |
| About | `About-Final`: one About page with five tabs | `About-Final-2` Minutes, Champions and phones |
| Workspace & admin | `Work-A` TD console, `Work-B` (to be redrawn as the representative's My region; build from WS09's My region text until then), `Work-C` admin home & queues, `Work-D` setup checklist | Keeps K's split: admin-only `/admin` with a grouped sidebar, and `/workspace` for regional representatives, TDs and auditors |

**Section 1.3, phase 4 row:** "WS13 (regional representative, TD and board sections)" in place of "WS13 (club rep, TD and board sections)".

**Section 2.2, shared platform pieces (rows added):**

| Piece | Built in | Used by |
|---|---|---|
| The Facebook mirror (`lca_posts` rows with `source = 'facebook'`, first photos copied to R2) | WS10 | WS10 News, WS03 compact Facebook rail |
| The season list (`season_schedule`) | WS11 | WS11 Scholastic page, WS04 Season at a glance |
| A ZIP or city to point lookup and a distance helper (road miles cached in `club_distances`; assumed, P2.12) | WS09 | WS09 Near me, WS11 Find a club near you |
| Board contact, `POST /api/contact` extended (public, rate-limited from WS11 on; the existing ticket routed to a seat by its slug through `createTicket`, plus the whole board (WS11) and a region (WS14) as targets) | WS11 | WS11 Ask a person and Report a concern, WS14 Message buttons |

**Section 2.3, new tables at a glance (changed lines):**
- **WS07:** `round_publications`, `follows`, `notifications`, `result_reports`, `push_subscriptions` (Phase 5)
- **WS08:** `queue_assignments`, `rating_report_tests`
- **WS09:** `club_schedules`, `club_schedule_exceptions`, `club_reports`, `club_distances` (assumed, P2.12), `zip_regions` (moved from WS14), plus the tables K's pick needs
- **WS10:** `event_results`, `digest_subscriptions` (and new columns on `lca_posts` and `club_news`)
- **WS11:** `season_schedule`, `season_notify`; `team_entries` (assumed, P2.26), `series` and `series_events` in Phase 5
- **WS14:** `governance_doc_versions`, `governance_changes`, `meetings`, `governance_watch` (`zip_regions` removed)

**WS02, Routes:** the About menu rows Board & regions, Bylaws & rules, Minutes and Champions point at `/about/board`, `/about/bylaws`, `/about/minutes` and `/about/champions` once `newAbout` is on (Champions once `newNews` is on); `/governance/*`, `/champions` and `/state-champions` redirect to them.

**WS03:** item 2, a tap on a day opens `/clubs?day=<mon…sun>` (assumed, P2.14) in place of `/clubs?view=week`, and the closing sentence reads "K kept this strip on Thu, Oct 8, 2026 for when the club information is richer."; item 3, the compact Facebook rail reads the mirrored `lca_posts` rows (WS10).

**WS08 Why:** the last line ends "/workspace for regional representatives, TDs and auditors".

**WS13:** under Role sections, "Club rep" becomes "Regional representative: the region's clubs not confirmed in 90 days, the Tonight switch and club news → `/workspace/region`"; the Why line and AC 1 say "regional representative" in place of "club rep"; attention item 6 reads "(regional representatives)".

**Section 4, phases (changes):**
- Phase 2, "Done when": adds the accepted test upload before the pilot (section 4.6; assumed, P2.10).
- Phase 3, "Done when": "All 25 clubs have a structured schedule or an explicit "Schedule not listed", and each representative gets the monthly confirm email; the this-week strip turns on (assumed, P2.14); first results archived; recaps written in the Recap tab; the Scholastic page live with the season block".
- Phase 4, "Done when": "bylaws reader and Who-represents-me live" becomes "the tabbed About page with the bylaws reader live".
- Phase 5, "Ships": adds team and coach entries (assumed, P2.26).
- Sequencing notes, added: "WS04's Season at a glance strip is built with WS11 in Phase 3, behind `seasonSchedule`; WS04's Phase 1 PRs do not wait for it, and WS04's criterion 15 is checked when WS11 lands (assumed, P2.22)."

**Section 5, decisions:** the heading reads "## 5. Decisions (settled by K, Thu, Oct 8 and Fri, Oct 9, 2026)".

| ID | Decision | Settled |
|---|---|---|
| D6 | Who enters results | **The event's TDs, plus LCA admins** on any event as a backstop, enter and confirm every result. **Players report their own game as a steer** (amended from K's note of Fri, Oct 9, 2026: the TD sees a report "even when both players have not gotten done reporting it", and a report "should not determine the match result"; in the first build, assumed, P2.2): one report reaches the TD at once, with no opponent confirmation; a report never sets a result; the TD confirms it in one tap or enters something else, and the TD's entry is final. |
| D17 | Who keeps club listings | **The regional representative for the club's region, and LCA admins** (settled by K, Fri, Oct 9, 2026: "only regional reps will have access to editing their clubs now"). Players are normally not associated with clubs ("normally players are not associated with a club"): no public roster, leaderboard or member count. Retiring `club_rep` and `members.club_id` is proposed (assumed, P2.18). |
| D18 | News and Facebook | **Facebook first, highlights not results** (settled by K, Fri, Oct 9, 2026). Most posting happens on the LCA Facebook page, so News is built to work with it: the site mirrors those posts into News with a link back (the way this replan meets K's note; assumed, P2.42), and admins can promote one to a story (admins only, assumed, P2.32). News carries tournament highlights that link to each event's results page, never a results page of its own. |
| D19 | US Chess rating report | **Imports cleanly, tested first** (settled by K, Fri, Oct 9, 2026). The export must import into US Chess's rating report system without hand edits, and K test-uploads it before any real event. This replan adds an automated check against US Chess's file layout and holds the Phase 2 pilot until a test upload imports cleanly (assumed, P2.10). |

**Open questions carried from the phase 2 replan:** section 5 of this document, as P2.1 to P2.44 in the table at the end of the brief's section 5, each with its default as the working assumption, marked "assumed, K to confirm". In the workstream text a default reads "(assumed, P2.N)", and K's two open picks read "(P2.11)" and "(P2.17)". P2.23 is carried as "Settled by D5 and D11; not open", with no assumption.

**Flags (rows added to the table in 0.2, all default `false`, each with a plain comment).** The table's introduction reads "**Phase 0 and Phase 1 flags, and the rows added in 1.4** (the Phase 0 rows were added in 1.2, the Phase 1 rows in 1.3, and the rows from `resultReports` on in 1.4; the replan names only `homeFeatured`, and the other Phase 1 rows follow the rule above so every Phase 1 PR uses the same names)." The rows:

| Flag | Turns on | Can go on in |
|---|---|---|
| `resultReports` | Report your result on the pinned card and the TD's Reported results queue | WS07 |
| `seasonSchedule` | the scholastic season block on `/scholastic` and Season at a glance on the Tournaments page | WS11 (and WS04's strip) |
| `newScholastic` | WS11's one page for parents | WS11 |
| `newNews` | WS10's News page: Latest with the Facebook mirror, Recent tournaments, From the clubs, and the Recap tab; and `/about/champions`, with `/champions` and `/state-champions` redirecting to it | WS10 |
| `newAbout` | WS14's tabbed About page and the redirects from `/governance/*` | WS14 |

**Deviations from v1.3 to record in `REDESIGN_STATUS.md`** (added in 1.4) when the matching PR lands:
- WS02: the About menu rows Board & regions, Bylaws & rules, Minutes and Champions point at the `/about` tabs, and `/governance/*`, `/champions` and `/state-champions` redirect to them, in place of keeping every `/governance/*` URL.
- WS03: the this-week strip opens `/clubs?day=` in place of `/clubs?view=week` (assumed, P2.14); the compact `FacebookFeed` reads the mirror.
- WS07: `Live-A` to `Live-E` are replaced by the Live-Final boards; the text-size toggle becomes `TextSizeMenu`; `FindMyName.tsx` becomes `FindYourBoard.tsx`; player reports are in the first build (D6 amended; assumed, P2.2); `tournament_sections.room_note` is added (assumed, P2.44).
- WS08: the Rating report step gains the checks, the three named files, the test record and the submission mark; check-in rows show no club; pending approvals lose champion submissions (assumed, P2.36).
- WS09: the this-week view, `ThisWeekGrid.tsx` and `TonightPanel.tsx` leave the directory; the club rep workspace becomes the representative's My region, and `/workspace` admits any member with an active regional seat; Club-C's compact profile gives way to the thin-club form of K's pick; club ids are TEXT.
- WS10: `lca_posts.featured` and `FeaturedStory.tsx` are not built (assumed, P2.39); the About-D timeline is not built (assumed, P2.40); `lca_posts.kind` drops `'announcement'`, which `category` covers; recap drafts become the Recap tab without the standings snippet or the key game; the `FacebookFeed` rail variant gives way to the mirror; `lca_posts.tournament_id` is TEXT; `/about/champions` is built in Phase 3.
- WS11: the program finder and `clubs.kind` are not built, nor are the hero, the doors, the audience switch and the resources for coaches and schools (assumed, P2.43); `FirstTournamentPage.tsx` folds into `ScholasticPage.tsx`; team entries and the coach role move to Phase 5 (assumed, P2.26); Ask a person and Report a concern use `POST /api/contact`, extended with a whole-board target, in place of the `POST /api/board/contact` v1.3 planned in WS14.
- WS13: the club rep section becomes the regional representative's, linking to `/workspace/region`.
- WS14: "Who represents me?", `GET /api/board/represent` and `WhoRepresentsMe.tsx` are dropped, and `zip_regions` moves to WS09; v1.3's `POST /api/board/contact` is not built, and the Message buttons use `POST /api/contact`; `meetings.agenda_document_id` and `minutes_document_id` are TEXT; the governance pages become tabs under `/about`.

**Appendix B, canvas board index (rows replaced):**
- **Live mode:** `Live-Final-Phones`, `Live-Final-Pairings`, `Live-Final-Pairings-2`, `Live-Final-Standings`, `Live-Final-TV`, `Live-Final-Print` (decided; they replace `Live-A`…`Live-E`).
- **Clubs:** round 2 options `Clubs-E`, `Clubs-F`, `Clubs-G` and `Club-D`, `Club-E`, `Club-F` (each with `-2`); round 1's `Clubs-A`…`Clubs-D`, `Clubs-Phones` and `Club-A`…`Club-C` until K picks.
- **Scholastic:** `Schol-Final`, `Schol-Final-2` (decided; they replace `Schol-A`, `Schol-C` and `Schol-Phones`); `Schol-B` parked for Phase 5.
- **News:** `News-Final`, `News-Final-2` (decided; they replace `News-A`…`News-D`).
- **About:** `About-Final`, `About-Final-2` (decided; they replace `About-A`…`About-D`).

---

## 5. Questions for K

Each has the default the boards assume, in bold; silence keeps the default.

### Page 7: Tournament day
1. **More notes.** You wrote "7. incoming" before this note. Is more coming for page 7? **Default: this note is the page 7 feedback; the six boards are drawn from it, and anything later becomes a second round.** One detail to look at while you do: the A–Z sheet keeps one small line, "Alphabetical by player", though you called the old "Pairings A–Z: find your name" text useless, and the board also keeps "find your name, then go to your board" under it. **Default: keep the order line and drop the how-to words; the round start and the "Pts" key stay on that small line.**
2. **D6.** The brief left player reporting for a later pilot with opponent confirmation. Your note likes the feature and has the TD see one-sided reports; the boards put it in the first build. **Default: record it as a change to D6 (section 4.8): players report as a steer, with no opponent confirmation, and the TD decides.**
3. **Who may report a result?** **Default: the two signed-in players in that game, as the boards draw.** The other way is to let the guardian of a registered child report for that child's game too, which matters at scholastic events, where a child under 13 has no login of her own (D13); say so if you want it, and My players gains the button.
4. **Are reported results shown publicly before the TD confirms them?** **Default: no. Public pairings, standings and the TV show only TD-entered results; the reporter sees "Reported, awaiting TD".**
5. **When both players report the same result,** does the TD still tap Confirm, or may it post by itself? **Default: the TD still taps Confirm, as drawn; nothing posts by itself.**
6. **The TD view:** on the public pairings and standings pages behind a "TD view | Public view" switch, as well as in the TD console, or only in the console? **Default: both, as drawn, for the event's TDs and LCA admins.**
7. **Hall TV: which view does the screen open on?** **Default: One at a time, cycling one section every 15 seconds, until the TD picks. The settings mark All on one screen "Suggested" at 30 players or fewer; the TD can pick either at any time, and the screen never switches by itself.** The board draws a suggestion the TD accepts, not an Auto setting; an Auto setting would change the screen without the TD choosing, which goes further than your "if the td wants to". Say so if you want Auto instead. Above 16 boards, All on one screen cannot show names at TV size. **Default: unavailable above 16 boards, as drawn, with the reason in words; say so if the TD should be able to pick it at any size.**
8. **Standings on the TV.** In All on one screen, once results are confirmed, the screen alternates pairings and standings every 15 seconds. **Default: keep it, with "Show standings after results come in" on by default and a switch to turn it off.**
9. **Who sees the US Chess rating report in the Download menu?** **Default: only the people who manage the event: its TDs, LCA admins and, for a club's event, the club's rep until the region's representative takes that over with the clubs work (section 3.1); everyone else sees the PDF, CSV and wall chart. The report is also the console's Rating report step.**
10. **How is the rating report proven before a real event?** **Default: an automated check of the export against US Chess's published file layout, then your own test upload of a finished event; the Phase 2 pilot waits until that test imports cleanly.** Two smaller points for the file fix: does LCA run real US Chess Grand Prix events? A local series called "Grand Prix" does not count. **Default: no; every section is coded as not Grand Prix.** And should checks that do not stop a download, such as an end date after today, still be listed on the card as warnings? **Default: yes.**

### Pages 8 and 9: Clubs directory and Club page
11. **Which directory option: Clubs-E, Clubs-F or Clubs-G?** **Default: no pick assumed. Silence means WS09's directory screens wait for your pick and the rest of WS09 proceeds; WS09 is Phase 3, so nothing being built now waits.**
12. **Near me distance: road miles or straight line?** **Default: road miles, worked out once per club and cached, shown as "about N mi", as Clubs-G draws.** Straight line would put North Kenner and Metairie inside 75 miles of Baton Rouge.
13. **Keep "Copy link to this list"?** **Default: no, as on the Tournaments list (4.1): the filters live in the address, so the address bar is the link.**
14. **The home page's this-week strip,** which you kept on Thu, Oct 8, 2026 for WS09, opened `/clubs?view=week`, which no longer exists. Keep the strip? The strip is a Mon to Sun row of club meeting counts; your page 8 note says "I dont like a calendar for this", so say drop it if that covers the strip too. **Default: keep it; a day opens the directory filtered to clubs meeting that day.**
15. **Border clubs** (Picayune, Morgan City, the Hammond area): are the Appendix C regions right? **Default: Appendix C as it stands; you correct any on the admin club page.**
16. **When a region's representative seat is open, who keeps its listings?** **Default: LCA admins until the seat is filled.**
17. **Which club page option: Club-D, Club-E or Club-F?** **Default: no pick assumed. Silence means WS09's club page screens wait for your pick and the rest of WS09 proceeds (Phase 3).**
18. **Retire `club_rep`, `members.club_id` and the admin page's "club members" designation?** `Work-B` will be redrawn as the representative's My region under your rule; this question covers only the retirement. Retiring `members.club_id` also removes the group email's "by club" audience, which selects members by `members.club_id` today, and the "keep families and clubmates apart" pairing option, which reads it too. Retiring `club_rep` also ends a club creating its own events (see question 19). It also ends the club page's officers list (names and personal emails today), which none of the three options draws. **Default: yes, as you suggested; the "by club" audience and the clubmates option go with it, and nothing is removed until every reader of `members.club_id` is checked.**
19. **Who creates a club's tournament on the site?** Phase 1 planned to roll event creation out to clubs through `requires_lca_membership` (D12): a club creates, tests and runs its own event, and today its `club_rep` does that. Under this default the representative or an LCA admin creates the event and sets its membership switch, the club's named TD runs it (an assigned TD may not change that switch, as today), and the club itself no longer creates events. Your phase 1 note wanted people "to be able to run their own tournaments with it not forcing their members to have LCA memberships", and your page 9 rule speaks of editing club pages, not events; this default goes further than either. **Default: the region's representative or an LCA admin creates it and names the tournament director, who runs it from the TD console.**
20. **Does a club keep one named contact who can post the club's news and create the club's events?** **Default: no. The club's contact is an address the relay form writes to; news and events go through the region's representative.**
21. **Thin clubs:** show unanswered facts as brackets with "Suggest an update", or hide them until filled? **Default: show them, as all three options do, so the gap invites a fix.**

### Page 10: Scholastic & parents
22. **The regular LCA tournament schedule:** a "Season at a glance" strip on the Tournaments page? **Default: yes, fed by the same admin-entered season list as the scholastic block.**
23. **Sibling or lunch pricing on scholastic events.** Settled by D5 and D11; no question. One entry fee per event, and the Family plan is the household saving.
24. **Where do Ask a person and Report a concern go?** The board has a Scholastic Director seat (migration 0011, with the slug `scholastic-director` from migration 0025, so `/contact?to=scholastic-director` reaches it today). **Default: Ask a person and Report a concern go to that seat, and to the whole board while it has no holder.**
25. **The Sat, Nov 14, 2026 and Sat, Dec 5, 2026 New Orleans Youth Chess meets:** LCA events (as the decided Tournaments boards show) or partner events (as Schol-A drew them)? **Default: LCA events; the Sat, Mar 20, 2027 and Sat, May 8, 2027 meets stay partner events, so one series shows two ways to register.**
26. **Team entries and the coach role** (WS11, Phase 3): keep or move? **Default: move them out of Phase 3 to wait with Schol-B in Phase 5; the decided page has no coach or school tools.**
27. **The privacy card says "Kids get no login",** but D13 allows a child's own login from 13 with the guardian's consent. **Default: reword it to "Kids under 13 get no login".**
28. **"What LCA keeps" must match the registration form** (WS11 criterion 2), and the scholastic emergency contact (S7.9) is not on the card. **Default: add it to the card once S7.9 is confirmed.**

One more on this page, numbered after the rest:

43. **The parts of Schol-A and Schol-C you did not name.** You named Schol-A's "Before your first event" (the questions parents ask), "Still unsure? Ask a person" and "Upcoming scholastic events", and those stay. You did not name Schol-A's guide above them (the day from check-in to awards, what to bring, chess words, sections, costs, safety and "What LCA keeps about your child"), its hero and doors, or its share card. You also did not name Schol-C's Parents · Coaches · Schools switch or its coach and school resources, with "Host a scholastic event at your school". v1.3's WS11 scopes the switch and the resources. **Default: keep the guide, ahead of your three sections; leave the rest out.**

### Page 11: News & stories
29. **Who posts a club's news?** Your page 11 note says "I would like for each club in theri page management thing, to be able to post their own news onto the site"; this default routes that through the representative. **Default: the representative for the club's region, and LCA admins, since on page 9 you said only regional reps will edit their clubs.** Whether a club keeps a named contact who posts is question 20.
30. **Should Publish recap also post to the LCA Facebook page by itself?** **Default: no. Facebook's share window opens after publishing; posting by itself would need Facebook page permissions LCA has not set up.**
31. **Should club posts also appear in Latest?** **Default: no: every published club post shows in From the clubs, on the club page and in the weekly email, and none in Latest.**
32. **Who may promote a Facebook post to a story, or hide one?** **Default: LCA admins only.**
33. **Where do the News tools and the season list live?** The boards draw Workspace › News and Workspace › Scholastic season, while WS08 puts posts under `/admin`'s Content group. **Default: `/admin` › Content › News and `/admin` › Tournaments › Season schedule, for LCA admins; a representative posts club news from My region.**

### Page 12: About, board & history
34. **What does the About tab hold?** **Default: About-A's hub as WS14 already scopes it: who LCA is with real figures, the records list, the yearly financial summary, elections and contact the board.**
35. **Who writes the "In plain words" boxes?** **Default: the Secretary, labelled as a summary of the official text; no board vote is needed for a summary.**
36. **Keep a "Missing years" card on Champions, in place of About-D's submissions form?** v1.3's WS08 lists champion submissions among the admin queue's pending approvals. **Default: keep the card, which writes to the board inbox; the submissions form and the queue's "champion submissions" approval source are not built.**
37. **Champion names:** `About-Final-2` links each champion's name to the event's results, while `Tourn-List-Final` and `Home-Final` keep names as plain text. Which rule? **Default: one rule everywhere: names stay plain text, and the year or event links to its archived results (WS10 criterion 3).**
38. **Tab name:** "Bylaws" or the About menu's "Bylaws & rules"? **Default: "Bylaws & rules", matching the menu; the tournament rules sit in the same reader.**

### Pages 7 to 12: five more
39. **News-A's featured story:** dropped, with Recent tournaments and the one pin doing its job? Your "just highlights of recent ones" was about tournament results, so this one is the replan's call. **Default: dropped, as drawn.**
40. **About-D's history timeline** (1837, 1857, 1858, 1915), which v1.3 scopes for WS10: dropped, or kept on the About tab? **Default: dropped, as drawn; say keep and it goes on the About tab.**
41. **The representative's name on each listing.** Each club listing names the representative who keeps it, and all three directory options find your region from your location or a ZIP and then show its representative by name (Clubs-E and Clubs-G mark that representative's tile "Your region"; Clubs-F opens your region with "Camille Broussard represents you"), the same kind of lookup you called unrealistic on page 12. Given that note on "Who represents me", keep the name, or show only the region and route Suggest an update to the representative behind the scenes? **Default: as drawn, the name shown.**
42. **The Facebook mirror.** Pull every post on the LCA Facebook page into Latest automatically, with Hide for the ones that don't belong? Your page 11 note says "it would be smart to make this work well with that"; the mirror is the replan's way to do that. **Default: yes.**

The last one covers small additions across pages 7, 10, 11 and 12:

44. **Additions the boards make that your notes did not ask for:** where the board is in the room on the Your game card (a "Where in the room" line per section in setup); the same large title on the printed standings and wall chart, and one Download menu in the print kit; no text beside the standings find box either; an "Email me when it's out" field on both schedule blocks; the email digest on Mondays at 8:00 AM; the next board meeting card in About's top right. **Default: keep them, as drawn.**

---

## 6. Board index for pages 7 to 12

| Board | Size | What it shows | Replaces |
|---|---|---|---|
| `Live-Final-Phones` | 2400 × 3300 | Four phone frames through one Saturday evening: Find your board signed out or not playing, Your game pinned with the Aa menu, Report your result and what the TD sees, a parent's My players, each with its round email | `Live-A` |
| `Live-Final-Pairings` | 1440 × 4750 | The pairings page signed in as a player in Round 3: search with nothing beside the box, the Aa menu, and one report seen by the reporter, the opponent and the public. Its note 4 says the page checks every 60 seconds; D7's 20 seconds stands, as on the phones board | `Live-B` (with part 2) |
| `Live-Final-Pairings-2` | 1440 × 4000 | The same page in the TD view: the Reported results queue, counts in words, the Status column, the override sheet with every report kept | (continues the above) |
| `Live-Final-Standings` | 1440 × 6150 | Final standings with the Download menu (public and TD), the Aa menu, and the TD's close-out panel: checks, the three US Chess files, the read-back preview and the test box | `Live-C` |
| `Live-Final-TV` | 1920 × 4450 | Frame A, one section at a time at a 96-player event; frame B, every section on one screen at a 26-player event; the TD's Hall TV settings, with All on one screen marked "Suggested" at 30 players or fewer and unavailable above 16 boards. Frame A's "This is the default above 30 players" is read as the suggestion: the stored default is One at a time until the TD picks (question 7) | `Live-D` |
| `Live-Final-Print` | 3600 × 2950 | The print kit: "Pairings · Round 3 · U1800" as the large title, a header with only the event and date, one Download menu, and sheet 7, the printed US Chess rating report checklist. Its note 3 keeps "find your name, then go to your board" under the order line; those how-to words are dropped, and the round start and the "Pts" key stay (question 1) | `Live-E` |
| `Clubs-E` | 1440 × 3400 | Round 2: the map is the page, with a drawer listing what the map shows; Near me from 70808; two phones. Its "clubs and programs" counts are not built; every listing is a club, with no `clubs.kind` (section 4.4) | `Clubs-A` to `Clubs-D` and `Clubs-Phones`, if picked |
| `Clubs-F` | 1440 × 7200 | Round 2: a sticky map cut into the seven regions beside the clubs under region headers naming each representative; two phones. Its "clubs and programs" counts are not built; every listing is a club, with no `clubs.kind` (section 4.4) | (as above) |
| `Clubs-G` | 1440 × 4500 | Round 2: all 25 clubs as cards ranked by road distance in 15, 30 and 60 mile rings beside a "your area" map; two phones. Its "Youth program" chip and "clubs and programs" counts are not built; every listing is a club, with no `clubs.kind` (section 4.4) | (as above) |
| `Club-D`, `Club-D-2` | 1440 × 3350 and 1440 × 2750 | Round 2: the tabbed mini-site (About · Visit · Events · News · Contact); the thin club, a phone and the states | `Club-A` to `Club-C`, if picked |
| `Club-E`, `Club-E-2` | 1440 × 3400 and 1440 × 2500 | Round 2: the next meeting as the headline, read in first-visit order; the thin club, a phone, Tonight and Off tonight | (as above) |
| `Club-F`, `Club-F-2` | 1440 × 3000 and 1440 × 2600 | Round 2: the club's front page with a feed and a sticky Visit card with Fix on every line; the thin club, a phone, Suggest an update | (as above) |
| `Schol-Final` | 1440 × 6350 | The decided Scholastic page for parents, signed out near Baton Rouge 70808, with the season inset | `Schol-A`, `Schol-C` |
| `Schol-Final-2` | 1440 × 3850 | The same page on phones, in two long 390 × 844 frames | `Schol-Phones` |
| `News-Final` | 1440 × 6800 | Frame A, `/news` with Latest, Recent tournaments and From the clubs; frame B, the tournament's Recap tab | `News-A` to `News-D` |
| `News-Final-2` | 1440 × 3000 | Frame C, Workspace › News promoting a Facebook post; frame D, Latest and the Recap tab on phones | (with the above) |
| `About-Final` | 1440 × 6950 | Frame 1, Board & regions with the next meeting card at the top right; frame 2, the Bylaws reader. About-Final's New Orleans Metro row says "... and 3 youth programs". Under K's page 10 note it names all eight as clubs (with Metairie Chess Academy, Knight Light Chess and Strategic Thoughts NOLA); there are no youth programs | `About-A` to `About-D` |
| `About-Final-2` | 1440 × 5350 | Frame 3, Minutes searching "scholastic"; frame 4, Champions; frame 5, the Board tab and the Bylaws reader on phones | (with the above) |

Sample data on every board is badged (on page 7: players, ratings, pairings, results, times and IDs; on pages 8 and 9: representative names, Checked months, club colours, logos and distances; on page 10: the day's times, fees, champions' names and the admin-entered season; on page 11: story and Facebook post text, winners, captions and counts; on page 12: officer and representative names, terms, bylaw wording, motions and vote counts). Club names, meeting times and venues, event names, dates, cities and organizers are real.
