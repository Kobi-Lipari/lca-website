# The newsletter, rounds 1 and 2 (Tuesday, November 10, 2026)

Two rounds on one day for LCA's monthly newsletter, both on canvas page "18 · Newsletter". Round 1 drew four fuller directions (canvas version 23). Round 2 drew the simple version K then asked for, with a board of K's picks (canvas version 24). K picked on Tue, Nov 10, 2026: the simple version first; the page reads left to right as Your picks, Newsletter-E and its part 2, then round 1's A to D as ideas for later.

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
