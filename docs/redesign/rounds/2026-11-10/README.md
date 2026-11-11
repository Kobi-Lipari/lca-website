# The newsletter, rounds 1 to 7 (Tuesday, November 10 and Wednesday, November 11, 2026)

Three rounds on one day for LCA's monthly newsletter. Rounds 1 and 2 are on canvas page "18 · Newsletter"; round 3, ten options for the president, is on page "19 · Newsletter options for the president" (canvas version 25). Round 1 drew four fuller directions (canvas version 23). Round 2 drew the simple version K then asked for, with a board of K's picks (canvas version 24). K picked on Tue, Nov 10, 2026: the simple version first; the page reads left to right as Your picks, Newsletter-E and its part 2, then round 1's A to D as ideas for later.

- `feedback.md`: K's words, verbatim.
- `newsletter-specs.json`: what every designer was given. `fb` is K's words and how they were read, `flow` is what the four options share (the moment drawn, the five frames, the managing facts, the email's footer, the sample issue, the checked weekdays, the open questions), and `boards` holds each option's spec.
- `results/newsletter-results.json`: the draw and review results, in the shape `docs/redesign/tools/publish-pages.py` reads.
- `results/newsletter-fix-results.json`: the fix pass before publishing, with its checks.
- `newsletter2-specs.json` and `results/newsletter2-results.json`: round 2's spec, with its `revision` after K's picks, and its results, the first-time volunteer's walkthrough among them.

The boards are in `../../canvas/boards` as `Newsletter-A` to `Newsletter-D`, each with a part 2, and the canvas layout is `../../canvas/canvas.json`.

## What K asked for

A monthly newsletter that LCA's leaders write together on the site and that goes out by email on the same date and time each month to LCA's members (Fri, Oct 23, 2026). On Tue, Nov 10, 2026 K asked for designs "for the page that hosts their creation and management (what ever that needs to be), and how they look when received by the receipient". So each option is two boards: the page in the admin area where the newsletter is made and managed, and the email as a member receives it.

## The four options

Each main board has frame A, creating, and frame B, managing. Each part 2 has frame C, received on a computer, frame D, received on a phone (one phone in the mail app's dark setting), and frame E, the page after "Unsubscribe from the newsletter".

- **A · The monthly letter.** The page is the letter itself, typed into directly at the email's own width: the president's note, then five short sections. The email is mostly words, with one photo at most. The least design and the most voice.
- **B · The issue, with a cover.** A builder: the pieces on the left, the piece being written in the middle, the email as members get it on the right. Each issue has a navy cover with the month set large, one photo and three cover lines. The most visual, and the most to supply each month; a cover with the rook mark stands in when there is no photo.
- **C · The month, built from the site.** The issue fills itself from the calendar, finished events, club posts and News, and the leaders add a note on top. The page is a checklist of those blocks. The least work, and it can never go out late or empty; the least voice.
- **D · The bulletin, with chess in it.** A front page with a masthead ("Louisiana Chess Bulletin" is a working name), a lead story, Dates to know, a Position of the month to solve and a short item of Louisiana chess history. The page where it is made is that front page: click a place and write it. The first position is Morphy's, from Paris in 1858 (`4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 1 16`); its answer is printed on no board. The strongest identity, and the most to prepare; a queue of positions prepared ahead spreads the work.

The options differ on purpose on the send rule. A, B and D go out on the day only once someone has marked the issue ready, with a reminder to the editors the day before; otherwise the issue waits and nothing is sent. C goes out by itself as it stands, "Hold this issue" stops one month, and a month with nothing in it is not sent.

## Drawn the same on all four, from K's decisions

- LCA admins, the president and the media manager write and send it.
- Every LCA member with an email address gets it, one email per address, and new members are added when they join. The count drawn, 243 addresses, was the real count on Tue, Nov 10, 2026.
- Each email ends with why the person got it and three links: "Unsubscribe from the newsletter" (one click, this list only), "Choose which LCA emails you get" and "LCA on Facebook".
- No postal address in any email, and no setting for one (K, Tue, Nov 10, 2026).
- The report after a send counts sent, delivered, bounced, unsubscribed and spam reports. Opens and clicks are not tracked.

## Open for K

1. The send rule: marked ready by a person (A, B, D), or going out by itself (C).
2. Writing together: drawn as turn-taking, one person in a part at a time, with history. The other choice is everyone typing at once.
3. The day and time. Drawn: the 1st of each month at 8:00 AM Central.
4. Whether each issue is also readable on the site by anyone, behind the email's "Read this issue on the site" link. Drawn: yes.
5. The decided News page has a weekly "News by email" on Mondays at 8:00 AM. Does the newsletter replace it, or do both run?
6. Opens and clicks are not tracked, as drawn.
7. For D, the name: "Louisiana Chess Bulletin" or "LCA Newsletter".

## Fixed before publishing

After the boards were drawn and reviewed, one fix pass ran on all eight, each fix checked by a second designer:
- The postal address came out everywhere: the dashed slot in every email footer, the "Mailing address" row in every Settings panel, and every note about one. K decided that day that no email carries one. The specs in `newsletter-specs.json` were written before that and still describe the slot.
- Option D's boards show chess piece figures, not lettered discs, as K asked of the scanner boards on Mon, Oct 19, 2026. They are the solid chess characters, drawn white with a navy outline for White.
- "Unsubscribed" is one whole word in every report, and a checklist's link count is true or reads "Every link works".

## How the round was run

The specs were written by hand from K's words. `docs/redesign/tools/draw-boards.js` drew and reviewed the four options, one designer drawing and a second reviewing each. The published `project/canvas.json` was read first and matched this repository's copy. The boards were placed with `publish-pages.py` on a new page, id `newsletter`, starting at x 640, with a title note and a note for the page, and published with the eight new boards as the files map.

## Round 2: the simple version, and K's picks

After seeing round 1, K asked for the newsletter to be "much easier to use for now", since the site does not yet hold tournaments or results and LCA's tournaments are linked by hand to King Registration for a couple more months, and asked to be shown where to make picks, with a recommendation for each.

**Newsletter-E, "The simple one, for now"** (with part 2, as it arrives). One page, three numbered steps: write it, check it, send it. It is today's Group email page grown a little: a subject, the site's text box, "Send a test to me", one confirm step. Nothing on it reads from the site's calendar, results, club pages or News; a tournament is a typed line with a pasted King Registration link.

**Newsletter-Picks, "Your picks"**. Eight picks, each with its options, the answer K picked, why, where to look, and where the other answer still lives. K's answer was "all recommended":

1. Build the simple version first.
2. A person presses Send, after a test and one confirm step. "Send later" lets them pick a day and time. Going out by itself every month is not built for now.
3. A new month starts from the usual six headings.
4. Tournaments are typed, with a pasted King Registration link.
5. The email opens with a navy band holding the rook and the month.
6. No photo by default.
7. A page on the site for each issue is not in the first version and is added right after.
8. How it grows later is not decided. The lead's suggestion: keep the simple letter, let the site fill in Coming up and Results as round 1's option C does once it holds them, and add option D's Position of the month if someone wants to keep it up.

**K's design rule, given with the picks: simple by default, with choice kept.** In K's words: "allowing for choice, like having the image thing as an option but not default", and "we can have alot of stuff there but it doesnt necessarily all need to be shown all at teh same time. use of drop downs, other components, etc are nice." So the page opens with the three steps only, and the extras wait behind three closed controls, each shown opened in frame B:
- "Add a photo, event or line", at the end of the writing tools: a photo (never required), an event line written from four boxes, a dividing line.
- The arrow on the Send button: send later, and send the test to someone else.
- "More options", a closed row under step 3: the top of the email (dark blue with the month, or plain), who gets it, the words shown in the inbox, and where replies go.

Drawn this way unless K says otherwise: one person writes at a time and the others can read; opens and clicks are not tracked; the weekly Monday "News by email" on the decided News page waits, so the newsletter is the only regular email for now.

**How round 2 was checked.** Before the second designer's review, a first-time volunteer walked the page through from the drawing alone: write the issue, add a tournament with its link, send a test, send it, then find each extra. They finished without being shown, and their fourteen stalls were fixed by plainer words and order, among them: the how-to for a link and a tournament line moved right under the writing tools; "Add" became "Add a photo, event or line"; the count reads "243 members will get it"; the page says "Saved automatically"; "Past issues" became "Past newsletters"; the event form gained "Add this line" and "Cancel". Five of their points were not taken. Three keep K's rule: More options stays a closed row under step 3, "Send the test to someone else" stays under the arrow, and the "Optional" chips stay on the board. Two were for room: "Who is here" stays in the drawn moment, now saying it shows only while someone else has the page open, and no extra panel shows the untouched page, which frame B5 and a note on frame A cover.

**Where it is built.** The first newsletter, the week of Monday, November 16, 2026, goes out from today's Group email page (the mail plan's part one). Newsletter-E is the page the newsletter part builds after it.

## Round 3: ten options for the president

K asked for the message preview to be easy to see on the page ("a mini thing on the side on desktop", and something to press on a phone), and for "refined images of options for how the page and sending templates (what the receipients see) for the president to pick", about five of each, which K cuts to three before sending them on Wednesday, November 11, 2026.

The ten are presentation boards: one option each, a label strip with the option's name and one plain sentence, and no working notes. `newsletter3-specs.json` holds what the designers were given, and `results/newsletter3-page-results.json` and `results/newsletter3-email-results.json` hold the draw, the review and the side-by-side check of each set.

**The page, five options** (`Newsletter-Page-1` to `Newsletter-Page-5`). Every one keeps K's picks and rule: three steps, links pasted by hand, the extras behind closed controls, and the email shown small at the side on a computer and behind one button, "See the email", on a phone.
1. Steps down the page: three numbered cards down the page, the email in a phone-shaped frame at the side.
2. Write beside the email: the letter on the left, the email on the right at a readable size, the steps in one slim bar.
3. One step at a time: one card for the current step, with Next and Back.
4. The letter on the desk: you type onto the letter sheet itself, in the email's own type, with Test and Send in a bar at the foot.
5. Everything on one screen: one strip for subject, test and send, and a tabbed panel with the preview first.

**The email, five options** (`Newsletter-Email-1` to `Newsletter-Email-5`). Every one carries the same December 2026 issue word for word, in one column, with no photo and the same footer, drawn on a computer, on a phone and on a phone in the dark setting.
1. The navy band: a dark blue band with the rook and the month, then a clean letter.
2. The plain letter: no colour block, all serif, like a personal letter.
3. The card: a cream ground with the newsletter on a white rounded card.
4. The bulletin: a classic masthead between rules.
5. The big month: the month in huge letters on dark blue, with a list of what is inside.

No option shows a sender address: K decides the addresses together, from the address map, before any is fixed.

**The lead's suggestion for K's three of each.** Pages 1, 2 and 4: 1 is the safest for a first-time sender, 2 answers "easy to see" best, and 4 is the most striking; 3 competes with 1 and adds clicks, and 5 has the smallest preview. Emails 1, 3 and 4: one that looks like the site, one modern, one traditional; 5 is close to 1, and the plain look of 2 stays available anyway as the "Plain" top under More options.

**The images.** Each board is rendered for sending with `node docs/redesign/tools/render.mjs <board> <out> 1440 2`, which gives a picture 2,880 pixels wide. The images are not kept in the repository.

## Round 4: K's six, revised to K's notes

K kept page options 2, 4 and 5 and email options 1, 4 and 5 (the lead had suggested pages 1, 2 and 4 and emails 1, 3 and 4), and gave four notes. The six boards were revised in place; `newsletter3-specs.json` now carries the `revision`, and `results/newsletter4-page-results.json` and `results/newsletter4-email-results.json` the revision, review and side-by-side check. Canvas version 26: on page 19 the kept six come first in each row, and the four not kept sit further right.

1. **The header's small text.** "LCA NEWSLETTER" above the month is 17 px on a computer and 15 px on a phone, bold, in a light gold, on email options 1 and 5; option 4's masthead line is 13.5 px in full navy. The page options' previews follow.
2. **Starting from something, very apparent.** A wide bar at the top of the writing area, "Start from a template or a past newsletter", opens a chooser: four pinned templates (Monthly newsletter, Tournament announcement, Results and thanks, Short notice) and the last newsletters, each with "Use this". A newsletter can be pinned as a template. If something is already written, the page asks before replacing it and keeps the words in History.
3. **A big writing area, made for fingers.** On each page option it is the largest thing on the page: at least 62 percent of the width and at least 520 px tall, with "Make bigger", a "Pull to make taller" handle, and "Hide" on the preview. Tools are at least 44 px tall, the letter's text is 17 px, and each board adds a tablet at a true 820 wide.
4. **Adding people.** The count reads "167 people will get it: 155 members and 12 you added", with "Add or review people": the members, the people added (typed, pasted or imported from a list, each with where it came from), anyone left out and the total; a tick that the added people asked to get email from LCA; kept in LCA's email bank for next time.

The counts are examples. The newsletter goes to accounts with an active membership (K's decision 28), about 155; the boards first said 243, the number of addresses on all accounts, and the lead corrected the three kept page boards.

For K to decide, raised by note 4: people added by hand only when they asked to get email from LCA (recommended, as drawn), or anyone.

## Round 5: tournament send-outs, and choosing the sender

Two more asks from K the same evening: "template trouanment registration send outs that my president can see to solve the problem of helping clubs advertise their tournamnets", and "how we can select which email handle to use for the send (like selecting which club it is being sent on behalf of) making sure this is selected when using a club oriented template". `newsletter3-specs.json` carries them as `revision5`; `results/newsletter5-tournament-results.json` and `results/newsletter5-page-results.json` hold the runs. Canvas version 27: page 19 has three rows, the kept pages, the kept emails, and the tournament send-outs.

**A club's tournament send-out** (`Newsletter-Tournament-1`, `-4` and `-5`), one in each kept email look. The sender is the club, "through the Louisiana Chess Association". The header names the club and the event; then two sentences from the club; the facts (when, where, sections, rounds and time control, entry fee, registration); one button, "Register on King Registration", with the same link as text under it; "Good to know"; who runs it, with replies reaching the club; and LCA's footer for tournament email with its one-click unsubscribe and the line "Sent through the Louisiana Chess Association for" the club. The tournament drawn, Baton Rouge Winter Open on Sat, Jan 9, 2027, is an example.

**Choosing the sender**, on page options 2, 4 and 5. A "From" row under the Start from bar and above Subject, closed, reading "Louisiana Chess Association · LCA Newsletter". Opened, it lists LCA's own senders (LCA Newsletter, LCA Tournaments) and, under "On behalf of a club", a search and the clubs. Members see the club's name as the sender and their replies go to the club; LCA's footer and unsubscribe stay. The pinned templates are now five, two of them for tournaments: "Club tournament announcement", which asks which club, and "LCA tournament announcement". Choosing the club template outlines the From row with "Choose the club this is sent for", fills the letter with bracketed prompts, and keeps Send inactive ("Choose a club first") until a club is chosen.

No address is shown for any sender: the address forms are the address map's choices, which K has not decided.

For K to decide, with the lead's recommendation first: a club's tournament send-out goes to every member who gets LCA tournament email, on behalf of the club (or only to that club's own list); and for now LCA admins, the president and the media manager send on behalf of any club (a club's own representative later, for their club only).

Page option 5's one sentence was changed by the lead: it no longer says the page fits one screen with no scrolling, since the writing area is now at least 520 px tall.

## Round 6: K's choices (Wednesday, November 11, 2026)

K chose (K's decisions 36 to 38 in `docs/redesign/ws16-k-decisions.md`; K's words are in `feedback.md`). `newsletter3-specs.json` carries the round as `revision6`, and the page's second pass as `revision6b`; `results/newsletter6-results.json` and `results/newsletter6b-page-results.json` hold the runs. Canvas version 28: on page 19 each row now starts with what is kept, and the rest is marked "not kept".

**The page is option 4, The letter on the desk** (`Newsletter-Page-4`, revised in place), with K's four notes:

- From and Subject are a stacked pair of boxed fields at the top, each with its label in a grey cell, like the head of a mail program, as option 5 drew them. The Subject row inside the letter is gone.
- The Subject is plainly a field to type in: a white field with a pencil mark and the words "The line people see in their inbox. Click to change it." A small picture shows it in focus with the count "30 of 60 letters".
- The letter is plainly typed on: the line beside "Write it" reads "Click anywhere on the letter and type. It saves by itself."; the paragraph being written sits in an outlined box with the caret and an "Editing" tag; a hovered part shows a dashed outline and "Click to edit"; the month in the band carries the same chip; the letter's end has a dashed empty part, "Click here to write the next part"; and a small picture shows the letter before anything is written, as three dashed prompts.
- The space is used on purpose. The right column holds what goes out and to whom: the preview with a Phone and Computer switch, then "167 people will get it" with "Add or review people". The bar at the foot keeps the saved line, More options, Send a test to me and Send to 167 people. The main picture is drawn in a 1140px window with the letter at its top, and the visible sheet is 525px tall and about two thirds of the row.

The lead's second pass on the page (`revision6b`): the first pass drew the main picture at 962px with the letter scrolled past its navy band and a sheet of about 350px, which lost the look K chose and the big writing area K asked for earlier, so the frame was made taller and the letter shown from its top. The letter sheet now shows the "In this issue" strip under the band, with the grey words "Made from your headings. Updates by itself.", so the sheet matches what members get. The line "These people asked to get email from LCA." is gone from "Add or review people" (decision 36: people added by hand need no tick). The opened From list ends with a link, "Manage senders and where replies go", and the club template's picture has "Club not in the list, or its reply address missing? Manage senders" (decision 37: nobody should have to hunt for where a sender is set).

**The email the president chooses between is two looks.** `Newsletter-Email-6`, new: option 1's navy band at option 1's height with the rook on the left, option 1's type and styling, and one addition from option 5, an "In this issue" strip under the band on a light ground whose six links jump to each part. A third phone picture shows the email after pressing "Results". `Newsletter-Email-4`, The bulletin, is kept as it is.

**A club's tournament send-out follows the same.** `Newsletter-Tournament-6`, new: send-out 1's band and styling, then an "At a glance" strip with the four facts (rounds, sections, entry, closes) and one row of links that jump to The details, Register, Good to know and Who runs it. `Newsletter-Tournament-4` is kept as it is.

Not kept, and further right in each row: page options 2, 5, 1 and 3; email options 1, 5, 2 and 3; send-outs 1 and 5.

**For the build, from the reviews and from a check of mail apps' behaviour on Wednesday, November 11, 2026.** A jump link inside an email works in Gmail on the web and on Android, Apple Mail on a Mac and on an iPhone (iOS 15 and later), classic Outlook, Outlook.com and the Outlook phone apps. The Gmail app on an iPhone is not known: its last public test, from August 2019, says a tap does nothing. So the list must read well as a plain contents list where a tap does nothing; each target is built as an empty named anchor just before its part, since a target with only an id fails in Gmail and classic Outlook; the email stays under about 102 KB so Gmail does not cut it; the phone's two-column list drops to one column under about 340px; and the first test send is tapped on a real iPhone. The strip is made from the letter's headings by the page and is not typed.

**What goes to the president:** the page (the main picture, and the whole board), the two email looks side by side, and the two send-outs side by side. The pictures are not kept in the repository.

## Round 7: made-up example words, and the explaining words behind Help (Wednesday, November 11, 2026)

Two notes from K after seeing round 6 (K's decisions 39, 40 and 43; K's words are in `feedback.md`). `newsletter3-specs.json` carries them as `revision7` and `revision8`; `results/newsletter7-results.json` holds the run. Canvas version 29.

**The example words are plainly made up** (decision 39), on the five boards the president sees: `Newsletter-Email-6`, `Newsletter-Email-4`, `Newsletter-Tournament-6`, `Newsletter-Tournament-4` and `Newsletter-Page-4`. The earlier words read like facts about LCA and were wrong: a State Championship weekend in a named town, real events and clubs with invented details, winners' names, and on the bulletin's masthead a founding year and an issue number. Now the president's note is a general thank-you for the year and a look ahead, with no event, place or name; the events are "Sample Winter Open", "Example Memorial" and "Sample Spring Scholastic", in "Sample City" and "Anytown"; the result is "Player One wins the Sample Fall Open"; the clubs are "Example Chess Club", "Sample City Chess Club", "Anytown Chess Club", "Demo Town Chess Club" and "Test Valley Chess Club"; the bulletin's masthead reads "December 2026 · Example issue"; and the tournament send-out is the "Sample Winter Open" from "Example Chess Club". Nothing in the design changed. What is true of the site stays: the association's name, "LCA Newsletter", "LCA President", King Registration, and the count of 155 members. This is a standing rule for every design from now on: sample content is plainly made up, never a plausible fact about LCA, its clubs, its events or its people.

**The explaining words are off the page and behind Help** (decisions 40 and 43), on `Newsletter-Page-4`. Six sentences that only explain a control are gone from the page: "Click anywhere on the letter and type. It saves by itself.", "Who members see as the sender.", "The line people see in their inbox. Click to change it.", "It changes as you type.", and the two of the same kind, "Saves time: pick one, then change the words." and "How members will see it." What shows a control without words stays: the Subject's pencil mark, the outlined paragraph with its "Editing" tag, the "Click to edit" chip, the dashed empty next part. A Help button (a question mark) in the page's head row opens a walkthrough of six steps that holds those sentences; it opens by itself once, the first time a person uses the page, and from Help after that. A new picture, "After pressing Help", shows step 3 of 6 on the Subject field, with the six steps listed under it. The rows above the letter went from five to four: "Write it", the Start from bar and Make bigger share one row; From and Subject run the column's full width; the toolbar sits on the sheet. In the same 1140px window the visible sheet grew from 525px to 587px. This too is a standing rule for the redesign's pages: explaining words go behind Help, never beside the control.

**The president's pictures** were made again from these boards: the two email looks on a computer, side by side, as A and B; the page on a computer with the same page on a phone; and the two send-outs side by side. Each says in its subtitle that the names, dates and results are made up to show the layout. The boards not kept, further right on pages 18 and 19, still carry the earlier example words.

## Round 9: Start from at the foot, Make bigger under the letter, and pictures split for a phone (Wednesday, November 11, 2026)

One note from K on the page picture made for the president (K's decision 45; K's words are in `feedback.md`). `newsletter3-specs.json` carries it as `revision9`; `results/newsletter9-results.json` holds the run. Canvas version 30. (There is no round 8 of its own: `revision8` was made in round 7.)

**The row above From is gone** on `Newsletter-Page-4`, so the letter starts one row higher: in the main picture the visible sheet is 637px where it was 587px, in the same 1140px window. The Start from control is now a button at the left of the bar at the foot, with More options, Send a test to me and Send, and reads "Start from a template, a past newsletter or blank"; its chooser's first row is "Blank letter", above the pinned templates. "Saved automatically at 2:15 PM" moved from that bar to the head line. Make bigger is at the right end of the strip under the letter, beside "Pull to make taller", and Make smaller sits in the same place in the bigger picture. The step mark "1 Write it" is at the left end of the letter's toolbar, and Undo there is its mark alone. The tablet and the phone follow: on the phone, Start from sits beside "See the email" at the foot. The Help picture's first step names the bar at the foot and a blank letter; its other five steps are as they were.

**The president's pictures are one to a file**, since the president will look on a phone: each email look alone (newsletter A and B, send-out A and B), cut to the email itself without the mail program's window, 660 wide with a short heading; the page on a computer; and the page on a phone beside the email it shows. The side-by-side sheets of round 7 are kept for a computer. The pictures are not kept in the repository.

**Left as it is:** two bare patches a little over the 120px guide on the board (under the people picture and under the Subject picture), and the people picture 40px narrower so the chooser can hold the blank row without lone words.

## Round 10: "Registration is open" leads the send-out's registration box (Wednesday, November 11, 2026)

One note from K on the two tournament send-out pictures (K's decision 46; K's words are in `feedback.md`). `newsletter3-specs.json` carries it as `revision10`; `results/newsletter10-results.json` holds the run. Canvas version 31.

On `Newsletter-Tournament-6` (the navy band) and `Newsletter-Tournament-4` (the bulletin), the registration box now reads, top to bottom: "Registration is open", the button, and the fallback line. The open line is the box's heading: 20px bold navy on the navy band, which had no such line before, and 18.5px bold navy capitals on the bulletin, where it was a 12.5px label. "If the button does not show, use this link:" and its link are 12px to 12.5px in muted grey, where they were 15px to 16px; the link is still underlined on a 24px line, and the contrast is 6 to 1 or more. The dark phone pictures show the same, in their own inks, each moved a little so the new line clears the bar above it. Nothing else on either board changed, and both heights are as they were.

The president's two send-out pictures were made again from these boards, one look to a picture.

## Round 11: "Pick a template to start from", larger, with a wiggle on an empty letter (Wednesday, November 11, 2026)

One more note from K on the page picture (K's decision 47; K's words are in `feedback.md`). `newsletter3-specs.json` carries it as `revision11`; `results/newsletter11-results.json` holds the run. Canvas version 32.

On `Newsletter-Page-4` the button at the left of the bar at the foot reads "Pick a template to start from", where round 9 had "Start from a template, a past newsletter or blank", which K found wordy and confusing. Its words are 17.5px at weight 600 and the button is 52px tall with a navy border, so it reads as the place to start and stays quieter than the gold Send. The narrower bars and the phone read "Pick a template". A blank letter is still the chooser's first row. The Help picture's first step, the chooser's heading and caption, and the tablet's and phones' words follow.

K asked that the button jiggle a little when the page first opens, so nobody is lost. A board is a still picture, so one small picture, "When the page opens on an empty letter", shows the button mid-wiggle with motion marks. K chose that it wiggles only while the letter is still empty. For the build: once, about a second, a few pixels, never repeated while the page stays open, and for a device that asks for reduced motion no wiggle but a gold ring for a moment.

The board is 5500 tall (5350 before), so the two rows under it on canvas page 19 moved down by 150. The president's two page pictures were made again.

## Round 12: three ways to lay out the top of the page, for K to pick (Wednesday, November 11, 2026)

K's note after round 11 (K's words are in `feedback.md`): "1 Write it" takes space where it is and the 1 belongs on the button that picks a template; From and Subject are needlessly wide, and More options or the like could sit at their right; three options to pick from. `newsletter3-specs.json` carries it as `revision12`; `results/newsletter12-results.json` holds the run. Canvas version 33: the three boards sit on page 19 right after `Newsletter-Page-4`, under the title "Three ways to lay out the top of the page · K picks one". `Newsletter-Page-4` itself is not changed in this round.

In all three the bar at the foot reads 1 Pick a template to start from, 2 Send a test to me, 3 Send to 167 people, with nothing else in it; "Write it" is off the toolbar and Undo has its word back; and More options has moved up beside From and Subject.

- `Newsletter-Page-4-Top-A`, One row: From, Subject and More options share one row. The letter shows 684px (630px on the page as it is). The sender's name is cut short with an ellipsis to fit.
- `Newsletter-Page-4-Top-B`, Fields left, options right: From and Subject stay stacked at about three fifths of the width, with More options and Make bigger as two buttons at their right. The letter shows 638px.
- `Newsletter-Page-4-Top-C`, The letter's own header: From and Subject are two slim lines at the top of the letter's frame, each as wide as its words, with More options at the right of the From line. The letter shows 650px. The designers recommend this one; its open point is that unboxed lines may not read at once as things to press.

K's pick is applied to `Newsletter-Page-4` (every picture) and to the president's page pictures in the round that follows.
