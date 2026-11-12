# WS16 part two, the page half: the newsletter's own page

Written on Thursday, November 12, 2026, for the lead and the builders, and revised the same day after two reviews. K's own copy, in plain words, is the last section of this file and is kept beside it as `ws16-p2-summary.md`. The rest of this file uses file and function names where a builder needs them. One plan made from two proposals and three scouts' reports. Facts were checked again in the code at `1cf41c2` and in the plan's documents. Nothing was built.

## In short

1. Building starts now, on the page's own branch, in the days that opened when checkpoint M merged five days early.
2. Nothing of it merges into `main` until the switch-on, the cutover, the first newsletter and checkpoint N are done, so none of them moves.
3. Steps 1 to 5 are built by about Sunday, November 15, 2026 (estimate; range Saturday, November 14 to Tuesday, November 17, 2026). K can have pictures of the real page then.
4. Checkpoint P, the page, is ready for K's look about Tuesday, November 24, 2026, the day after checkpoint N merges (estimate; range Tuesday, November 24 to Friday, November 27, 2026).
5. K can switch the page on about Wednesday, November 25, 2026 (estimate; range Tuesday, November 24 to Wednesday, December 2, 2026), in time for December's newsletter.
6. Sending later follows as checkpoint Q about Monday, November 30, 2026 (estimate; range Friday, November 27 to Friday, December 4, 2026).
7. The email takes the navy look, board Newsletter-Email-6 (decision 53), as a second layout beside today's, so no other email changes.
8. WS09 starts about Thursday, November 26, 2026 (estimate; range Wednesday, November 25 to Monday, November 30, 2026) in place of Tuesday, November 24, 2026: about 2 days later. Checkpoint O keeps its day.
9. K has eight choices in section 7. Adding people, each issue's page on the site, and the photo wait as checkpoint R until after checkpoint O.

## 1. The slot

### The answer

Build now. Merge after checkpoint N. That is the earliest place whose safety holds on the facts.

### The facts it rests on

- **The lead's queue is empty until K's switch-on day.** Checkpoint M was planned to merge on Tuesday, November 17, 2026. It merged on Thursday, November 12, 2026. Step 9's own entry says it is written against `main` after the switch-on change has merged. So checkpoint N cannot start before K's day, and until then the queue holds only the small fix of the five rough spots.
- **Checkpoint N cannot wait.** From the switch-on, "Groups of members" is not drawn in Group email until step 11 ships. N is what brings it back. So N goes before any page work that is left.
- **The page is new files at a new address.** It is `/admin/newsletter`, as the approved board draws it. It needs migration 0061, and steps 9 to 12 name no migration, so 0061 is free.
- **It shares few files with checkpoint N.** Nine files, a few added lines in each: `src/lib/features.ts`, `functions/utils/mail/switches.ts`, `test/unit/features.test.ts`, `test/unit/mail-switches.test.ts`, `test/unit/redesign-status-ws02-step2.test.ts`, `domain/contracts/registry.ts`, `domain/contracts/index.ts`, `src/areas/admin/api.ts` and `test/unit/fixtures/api-added-since-split.json`. The record, `REDESIGN_STATUS.md`, is the tenth.
- **Any merge of it redeploys the worker.** `deploy-worker.yml` runs on every merge that touches `functions/utils/` or `domain/`. That worker's five-minute run carries the newsletter. `migrate-db.yml` runs apart from it. So no page merge goes near K's days.
- **The page can do nothing for a member before the cutover.** The newsletter goes out only through Amazon SES.
- **Merging the page before N would throw N off, even though its first steps fit in the free days.** N's three entries are written against `main` as the switch-on leaves it (step 9 reads 44 switches). The switch-on patch, gated green today, changes the same two switch files and `features.test.ts`. A page merge would put a worker redeploy and a migration in the week of K's own days. And N would have to start over on a changed base while "Groups of members" stays hidden.

### The pace the dates rest on

- **Measured, not guessed.** Part one's eight steps were committed between about 6:00 AM UTC on Wednesday, November 11, 2026 and 8:25 AM UTC on Thursday, November 12, 2026: 3 to 5 hours each, the lead building through K's night. Checkpoint M's review, fix round and pictures took about 7 hours more before K's word.
- **Sizes in hours.** Small is about 3 hours (range 2 to 5). Medium is about 4 hours (range 3 to 7). Large is about 8 hours (range 6 to 14). A checkpoint's close (the draft pull request, the merge-safety review, the fix round, the pictures) is about 7 hours for six steps (range 5 to 14) and about 6 hours for three (range 4 to 12).
- **The late end of every range** is the redesign's long-run pace of 1.2 steps a calendar day with its idle days, the handoff's own figure.
- **What the dates count.** The lead builds through K's nights and through Thanksgiving, on the page's own branch, as decision 42 allows. Nothing merges and no switch goes on without K's own word. Each of K's words is put on the next day K is likely there. Thursday, November 26 to Sunday, November 29, 2026 are counted as days K may be away.
- **An earlier draft of this plan said WS09 moved 8 days.** It had read each step as a calendar day. The measured hours give 2.

### Five fences

- **F1. Merge order.** Nothing of the page half merges into `main` until the switch-on change, the cutover change and checkpoint N have merged and the first newsletter has finished sending. No page merge, no page switch-on change and no rollback of one is merged while a newsletter is sending.
- **F2. K's days and all of N come first.** On the switch-on day, the cutover day and the first newsletter's day, and while N's steps, N's merge-safety review or N's fix round are under way, no page step is started, and one under way is parked at its last green commit. The page is built on its own branch, `redesign/ws16-page`, in its own working copy, so a change K is waiting for never sits behind unfinished page work.
- **F3. Four files wait until checkpoint N has merged.** Until then the page branch does not touch `src/pages/AdminEmailPage.tsx`, `src/pages/AdminPage.tsx`, `functions/utils/mail/lists.ts` or `functions/utils/admin/campaigns.ts`. The five-spot fix and steps 9 to 11 change the first three. A checkpoint's fix round changed the fourth in checkpoint M, after its last step was committed, so step 11's commit is not the end of N's changes. Page steps 6 and 7 are the page steps that touch them, and both come after N's merge. Steps 4 and 5 may go on from the old base until then.
- **F4. One rebase, at the page's cost.** N starts on its day from `main`, whatever the page's state. The page branch is rebased once, onto `main` at N's merge commit. N never rebases for the page. Step 9's switch count reads 44, as its entry says. The page's own pair then reads 45 and checkpoint Q's 46.
- **F5. Checkpoint O keeps its day, and its step is read again.** WS16 step 12 was planned before the page half. It changes `functions/utils/admin/campaigns.ts`, `functions/utils/mail/switches.ts` and the worker, and it deletes `test/unit/mail-seam-bytes.test.ts`. So its entry is scouted again on `main` after checkpoint Q has merged, and its figures are live. It must keep `listMessage`'s look branch and the worker's "newsletter send later" phase. Step 6 keeps its own proof that the plain tab's email is unchanged in a test file of its own, which step 12 leaves in place. The order after WS16 stays: WS09, WS10, WS14, WS08's admin home. Only dates move.

### The order from today

The dates below take K's switch-on day as Wednesday, November 18, 2026 and checkpoint N's merge as Monday, November 23, 2026, part one's planned days. Every later date moves with those two. Each estimate has its range.

1. **Thursday, November 12, 2026.** This plan goes to K. Documents only.
2. **Friday, November 13, 2026.** The small fix of the five rough spots. First and unchanged.
3. **Friday, November 13 to about Sunday, November 15, 2026.** Page steps 1 to 5, about 23 hours of building (estimate; range 16 to 40). They are done by about Sunday, November 15, 2026 (estimate; range Saturday, November 14 to Tuesday, November 17, 2026; at the late end step 5 is finished after N). K can have a picture of the real navy email about Saturday, November 14, 2026 (estimate; range Friday, November 13 to Monday, November 16, 2026) and pictures of the real page about Sunday, November 15, 2026 (estimate; range Saturday, November 14 to Tuesday, November 17, 2026). K does not need to look that week. What K notes is built before checkpoint P opens.
4. **The spare free days are not filled with more page work.** Steps 6, 7 and 8 change one of the four waiting files or rest on a step that does. Step 9 touches none of them, but it ships under checkpoint Q's switch, which step 7 adds, so it keeps its place. The spare days go to the pictures and to the rough spots they show.
5. **K's switch-on day, the cutover, the first newsletter from the plain tab.** Unchanged. Page work is parked.
6. **Checkpoint N**, on part one's planned days, Thursday, November 19 to Monday, November 23, 2026, with its review, its fix round and K's word. Page work gives way to all of it.
7. **After checkpoint N has merged.** The page branch is rebased once onto `main`, about 2 hours with its gate (estimate; range 1 to 4). Then step 6, about 4 hours (estimate; range 3 to 7). Then checkpoint P's close, about 7 hours (estimate; range 5 to 14).
8. **Checkpoint P is ready for K's look** about Tuesday, November 24, 2026 (estimate; range Tuesday, November 24 to Friday, November 27, 2026). K looks at pictures of the real page, taken from the checkpoint's code with the switches on and a stand-in sign-in, as for checkpoint M. A preview cannot be signed into, so P's preview shows only that the site is unchanged with every switch off.
9. **Checkpoint P merges on K's word** about Wednesday, November 25, 2026 (estimate; range Tuesday, November 24 to Tuesday, December 1, 2026). **K switches the page on** that day or on K's next day at the desk: about Wednesday, November 25, 2026 (estimate; range Tuesday, November 24 to Wednesday, December 2, 2026). Thanksgiving is Thursday, November 26, 2026. If K would rather switch nothing on that week, Monday, November 30, 2026 loses nothing: December's newsletter is still written on the page. If the page is not on when December's newsletter is due, that newsletter goes from the plain tab, as November's did. Nothing waits for the page.
10. **Checkpoint Q**, steps 7 to 9, is built on P's head while P waits for K's word: about 11 hours of steps (estimate; range 8 to 19) and about 6 hours to close (estimate; range 4 to 12). It is ready for K's look about Wednesday, November 25, 2026 (estimate; range Wednesday, November 25 to Monday, November 30, 2026). It opens once P has merged and merges on K's word about Monday, November 30, 2026 (estimate; range Friday, November 27 to Friday, December 4, 2026).
11. **WS09 starts** once Q is ready for K's look: about Thursday, November 26, 2026 (estimate; range Wednesday, November 25 to Monday, November 30, 2026).
12. **Checkpoint O**, about Friday, December 18, 2026 if the cutover is Wednesday, November 18, 2026. Its day is unchanged. Its one step is scouted again first (F5).
13. **Checkpoint R**, steps 10 to 12, after checkpoint O, at WS09's next checkpoint boundary: about 16 hours of steps (estimate; range 12 to 30) and about 6 hours to close (estimate; range 4 to 12), after a board for each issue's page and a board for the photo and the plain top.

If N merges sooner than Monday, November 23, 2026, every date after it comes sooner by the same days.

### If Amazon's answer is late

Parts A and B of K's switch-on list still go, and N still goes, as part one planned. The first newsletter waits for the cutover. Then checkpoint P may merge after N on any day that is not the cutover day and has no newsletter sending. The cutover change is run green again on a throwaway branch after that merge, about an hour (estimate; range ½ hour to 2 hours). The page's own switch still waits for the cutover and the first newsletter.

### What it moves

- **Nothing K has dated.** The fix, the switch-on, the cutover, the first newsletter, checkpoint N and checkpoint O keep their days.
- **Nothing is given up by using the free days.** N waits for K's day, so nothing could have pulled it forward.
- **WS09 and all after it, by about 2 days** (estimate; range 1 to 6). That is the lead's time on the page after N merges: about 30 hours (estimate; range 21 to 56) for the rebase, step 6, checkpoint P's close, steps 7 to 9 and checkpoint Q's close, plus the rounds K's looks bring. WS09 starts about Thursday, November 26, 2026 in place of Tuesday, November 24, 2026, and ends about Thursday, December 24, 2026 (estimate; range Wednesday, December 23 to Monday, December 28, 2026) in place of Tuesday, December 22, 2026. WS10 moves from Monday, January 11, 2027 to about Wednesday, January 13, 2027, WS14 from Sunday, January 24, 2027 to about Tuesday, January 26, 2027, and the admin home from Tuesday, February 2, 2027 to about Thursday, February 4, 2027 (each an estimate; range 1 to 6 days later).
- **The December board meeting.** K's reorder was made for it, and the documents hold no date for it. Choice 2 asks K for the date.
- **Building in the free days saves about 1 of those days** (estimate; range 1 to 4): the 23 hours of steps 1 to 5.
- **Checkpoint O's step is read again** on `main` after Q has merged (F5). Its day does not move.

### At once, outside the build queue

K's answers to section 7. The page half's brief section, manifest and decisions on the docs branch. The words for the states no board draws. The rook cut from the approved board as an image. Step 1's read-only scout.

## 2. The first version

### What each checkpoint holds, in plain words

- **Checkpoint P, the page.** The whole approved page on a computer, a tablet and a phone: the head with its state in words, From and Subject, the tools, the letter you click and type on with its live "In this issue" list, the side preview, the bar at the foot with its three numbered steps, the chooser with a blank letter, LCA's three starters and your last newsletters, More options, Help, "Add an event", a test to yourself, and Send with one confirm. On a phone the test and Send sit at the foot of the "See the email" sheet. The email in the navy look. The count card reads "155 people will get it": members only, as today.
- **Checkpoint Q, sending later.** The arrow on Send, "Send later", the scheduled state, changing the time, "Send now", "Do not send it", on a phone too. Pinning a sent letter as a template.
- **Checkpoint R, people, issue pages and the photo.** "Add or review people", with typing, pasting and importing addresses. A page on the site for each issue, with the "Read this issue on the website" link under the list. A photo under the Add menu, and the plain top of the email.

### Options the approved page holds, and where each goes

Decision 27 says an extra is an option that is off until a sender asks for it. It does not say the option is left out. So each has a step or a reason.

- **"Add an event"** under the Add menu: built in step 5. Its line is already drawn on the approved email, under "Coming up".
- **The photo** under the Add menu, and **the plain top of the email** in More options: step 12, after a board for each, since a member would see them and no board draws either. Until then the Add menu reads "Add an event or line", so it names only what it holds. This is K's choice 5.
- **The opened From list (P3) and "Manage senders and where replies go":** outside the page half until there is a second sender and a place where senders are managed. Today there is one sender, and the sender and the reply address are lines of `domain/mail/addresses.ts`, so decision 37's link has nowhere to lead. "LCA Tournaments" can join the list once checkpoint N's list is on. The club group and the senders page come with clubs' sending in WS09. The page shows the one sender, with no list to open. K is told, and it is recorded as a deviation.
- **The starter "LCA tournament announcement":** it needs the LCA Tournaments sender, so it waits with the From list.

### Outside the page half

- P17, the club template with its "Choose a club first" rule: with WS09.
- Look E7, the club's tournament send-out (Newsletter-Tournament-6): with WS09. By decision 53 the navy pick holds for it too.
- D3, clubs' and representatives' own sending: with WS09.
- Sign-ups for people without an account, and other lists: with their own workstreams, as part one's notes say.

### The open points and the board notes, and where each goes

- D1, one writer or live co-writing: K's choice 3.
- D2, where replies go: open with K, blocks nothing. The page shows today's reply address.
- D5, how the newsletter grows later: not decided now, and nothing is built for it.
- D6, the DMARC setting: open with K, not part of the page.
- D7, the states no board draws: built in words, listed below. Decision 44 settles it: no design round for a state only senders meet. K sees them in checkpoint P's pictures.
- D8, the president's look: answered as navy. Decision 53 settles the board: Newsletter-Email-6.
- D9, the five rough spots: the small fix before the switch-on, not this half.
- Board note E1, explaining sentences still on the board: behind Help. Decision 40 settles it as a standing rule. K is told in one line that the approved board still showed them.
- Board note E2, the dark bronze "IN THIS ISSUE" label on cream: kept as approved. It is the site's own dark gold for text, and it reads at 4.66 to 1 on the cream. The bright gold stays off light grounds.
- Board note E3, small controls on a phone: measured in the browser run of steps 4, 5, 6 and 8. Each is at least 44px, and 48px on the phone's sheet, or the step is not done.
- Board note E4, the "they asked" line: already off. Nothing to do.
- Board note E5, no postal address: holds. A test in step 2 keeps it so.
- Board note E6, the website link the board lacks: comes with each issue's page in checkpoint R.
- Board note E7, More options has no picture: built from decision 27's list, in words (decision 44). The "Send the test through Amazon SES" tick stays on the plain tab only, since the page is switched on after the cutover.
- Board note E8, the confirm has no picture: one plain question, listed below.
- Board note E9, sample words: every fixture and test uses plainly made up words, by decision 39.
- Board note E10, From and Subject side by side: decision 48 stands.

### The states no board draws, in words

"Saving". "Saved automatically at 2:15 PM". "Could not save", with "Try again". "Player Two changed this letter at 2:17 PM", with "Show their letter". "Test sent to your address". "The test could not be sent", with the reason. "Send a test of this letter first", beside an inactive Send. "Send to 155 people?", with "Send" and "Not now". "Sending, 40 of 155", with "Stop sending". "Sent to 155 people". "Stopped. 40 of 155 were sent." "Changed since the last test", on a scheduled letter. "Sending now", from a scheduled letter's time until a run has picked it up, with the reason when it waits. "Not sent", with the reason, for a scheduled letter that was held. Each refusal keeps today's words: Resend still sends, no link key, nobody to send to, one already sending.

On a phone, "Send a test to me" sits with Send at the foot of the "See the email" sheet. The sending-later board draws Send there and no test.

## 3. The steps

Twelve steps in three checkpoints. The step split is the finer one: files that nothing imports come first, and one step of checkpoint P alone changes the live send path. Sizes are in hours, from part one's measured pace (section 1): small about 3 (range 2 to 5), medium about 4 (range 3 to 7), large about 8 (range 6 to 14).

### Checkpoint P: the page. Switch `mailPage` with `MAIL_PAGE_ON`

**Step 1, the letter's rules and its cleaner (small).**
- Builds: `domain/mail/letter.ts`: the parts list made from the letter's headings, a name for each part's jump link, and LCA's starters, which hold headings only. `functions/utils/mail/letterClean.ts`: the cleaner, by the method that already cleans News posts, kept to what the editor makes (p, br, strong, em, h2, h3, ul, ol, li, hr and safe links) and with that method's blind spot closed.
- The blind spot: the News posts' cleaner removes only script, style, iframe, object and embed with what they hold, and unwraps every other unknown tag (`functions/utils/posts.ts` lines 68 to 75). The inside of a textarea, title, noscript, xmp, noembed, noframes or plaintext tag is handed on as raw text, so unwrapping one could leave live markup behind. The letter's cleaner removes those, and template, svg, math and img, with what they hold. It drops a link whose address holds a quote mark. Last, it cleans its own result once more and refuses a letter that the second pass would change.
- Covers: P7.
- Switch off: no switch and no migration. Nothing imports either file.
- Proof: script, style, img, iframe, onclick and `javascript:` links are gone; one case for each raw-text tag, holding an img with an onerror; a single-quoted link that holds a double quote; cleaning twice changes nothing; two same headings get different names. The cleaner's test runs in the integration suite, which runs inside the Workers runtime.
- Follow-up, outside this half: the scout runs the same inputs once through the News posts' cleaner, without changing it, and the record says what it lets through. Mending it is a small change of its own, put to K. After checkpoint N the media manager writes News posts.
- Depends on: K's yes.

**Step 2, the navy look (medium).**
- Builds: `domain/mail/newsletterLayout.ts`, one pure function for the server and the page: the band, the "In this issue" strip with a named anchor before each part, the body, and the footer passed in whole, in light and dark. `public/email-rook.png`. One new constant in `domain/mail/footer.ts`, the "LCA on Facebook" line, so the footer's words stay in their one place (only if K's choice 6 keeps the line). `functions/utils/emailLayout.ts` is not touched. The line that names LCA and the site, which today's layout writes under every email, is not on the board and is not drawn.
- Covers: look E2, look E3, look E4, look E5, look E6.
- Switch off: nothing imports the layout, and nothing else reads the constant. Every email's bytes are today's.
- Proof: bytes held in a fixture; the footer comes out as it went in, with the one line after it and nothing after that; month and subject escaped; no postal address; the whole email under 102,000 bytes with the letter at its cap of 80,000 bytes; `test/unit/mail-seam-bytes.test.ts` unchanged; the worker's upload equal to the base.
- Depends on: step 1.

**Step 3, the letter's storage and saving (medium).**
- Builds: migration 0061, one new table, `newsletter_issues`, with no CHECK and no rebuild. It holds the letter, its version, who saved it, the mark of its last test, and the columns checkpoint Q reads. Four methods behind `requireListMailer`: read the open letter, save it, start a new one, list the last ones. Contracts in a new `domain/contracts/newsletter.ts`. The switch pair. The page half's own part of the record, kept inside the WS16 section, since a test holds one block for each workstream.
- Switch off: the four methods answer 404. The table is empty. Nothing a visitor or a member meets.
- Proof: migrations 0001 to 0060 with rows, then 0061, on real SQLite, run twice; who may and who may not, an officer without the seat and a media manager without a second factor among them; a save with an old version is refused with the other person's name and time, and loses nothing; saved text is cleaned, and a letter the cleaner cannot make clean is refused in words; a save empties the test's mark; starting a new letter sets the old one aside and deletes nothing.
- Depends on: step 1.

**Step 4, the page: writing and the side preview (large; the build may split it in two, the computer first, then tablet and phone).**
- Builds: the route `/admin/newsletter` in `src/App.tsx`, registered only with the switch on. `src/pages/AdminNewsletterPage.tsx` with its parts under `src/areas/admin/newsletter/`. Saving by itself about two seconds after a pause. The side preview is the same function the server sends with, drawn in a closed frame that runs no script. The editor kit's extensions package is listed at the exact version the lock already holds, so no other package moves.
- Covers: P1, P2, P4, P5, P6, P8, P9, P19, P20, P21.
- Switch off: the route is not registered and no link leads to it. `test/a11y/baseline.json` is unchanged. With the package listed and nothing importing it yet, every built file equals the base.
- Proof: each state in words; every control reached by keyboard and at least 44px on a phone; each thing that opens takes focus and gives it back to the control that opened it; no focused control is hidden under the bar at the foot (WCAG 2.2, Focus Not Obscured), checked at a computer's, a tablet's and a phone's width; a reload keeps the letter; no "View only" badge for an officer who holds the seat; the bundle check; one browser accessibility run on a build with the switch on.
- Depends on: steps 2 and 3.

**Step 5, the bar, the chooser, Help and More options (medium).**
- Builds: the bar at the foot; the chooser, which asks before it replaces a written letter and keeps the old one under "Your last newsletters"; the wiggle; More options, closed when the page opens, with the inbox preview line, who gets it and where replies go; the six-step Help, which holds every explaining sentence (decision 40); and "Add an event", a small form that writes one line in the form the approved email draws, with a weekday on its day.
- Covers: P11, P12, P13, P14, P18.
- Switch off: as step 4.
- Proof: the wiggle only on an empty letter, and a ring in its place with reduced motion; Help opens by itself once; the chooser, More options, Help and the event form each take focus and give it back, and none hides a focused control under the bar; a newsletter sent from the plain tab shows under "Your last newsletters" and is cleaned when copied.
- Depends on: step 4.

**Step 6, test and send from the page, and the ways in (medium; after checkpoint N has merged).**
- Builds: the one change of checkpoint P to the live send path. `listMessage` takes an optional look and calls the navy layout. `createListCampaign` takes an optional letter: the look, the month and the preview line ride in `filter_json`, the insert also requires the letter open, unsent, at the version the page read and tested as it stands, and one more statement in the same batch marks it sent. Those statements are added only when a letter is given, and the letter's mark carries the batch's own condition that the campaign was made. The send and the test read a letter only with `MAIL_PAGE_ON`. A test that has gone marks the letter as tested at that version. On the page: the test's result, one confirm, Sending with Stop sending, Sent, Stopped. On a phone: "Send a test to me" and "Send to 155 people" at the foot of the "See the email" sheet, each at least 48px. The ways in: Newsletter in Admin and in the media manager's menu, and in Group email the tab's writing box gives way to one link, "Write the newsletter".
- Covers: P15, P16, look E1.
- Switch off: both endpoints ignore a letter. A plain send's batch is today's four statements and names no new table, so it works on a database 0061 has not reached. A plain send's bytes are today's. No row, no link, and the tab as today.
- Proof: a letter is never sent twice (two presses, two tabs, a plain send under way); another newsletter is sending, and the letter stays open; today's refusals in today's order; Send is refused until a test of the letter as it stands has gone; the test carries the navy look, "[TEST]", the real footer and both headers; a save after the send is refused and offered as a new letter; with the switch on, a body sent without a saved letter is refused; a message with no look is today's bytes, in a test file of its own that outlives `mail-seam-bytes`; the confirm takes focus and gives it back; the phone's sheet in the browser run; the worker's upload against its ceiling.
- Depends on: steps 2 to 5, and checkpoint N's merge.

P lets K see, by pictures of the real page with the switches on: the whole page, writing, saving, the starters, the side preview, the test, the confirm and the sending states, on a computer and a phone. P's preview shows only that the site is unchanged with every switch off. No email leaves a preview, since a preview holds no keys.

### Checkpoint Q: sending later. Switch `mailLater` with `MAIL_LATER_ON`

**Step 7, sending later, the engine side (medium).**
- Builds: set, change and clear a letter's day and time, each moving the letter's version; `domain/mail/sendLater.ts`, Central time to an instant; the phase in the worker's five-minute run, which asks at the letter's time whether its scheduler may still send; a save refused from the letter's time on; four activity log actions with their labels; the pair. No migration.
- Covers: S7, S8.
- Switch off: the methods answer 404, the phase returns at its first line and reads nothing, and a save is today's.
- Proof: each edge in section 6 is a test.
- Depends on: step 6. It is built on P's head while P waits for K's word, and checkpoint Q opens once P has merged.

**Step 8, sending later on the page (medium).**
- Builds: the arrow and its menu, the "Send later" panel, the scheduled state, "Changed since the last test", "Sending now", the three-row menu, and "Send later" beside Send on the phone's sheet.
- Covers: S1, S2, S3, S4, S5, S6, S9, S10.
- Switch off: Send has no arrow, and the phone's sheet is as checkpoint P left it.
- Proof: a past day cannot be chosen and is told apart in words; rows at least 44px; each menu and the panel take focus and give it back, and the calendar works by keyboard; nothing is shown before the letter's time that is not true; the state survives a reload; a second person sees it.
- Depends on: step 7.

**Step 9, pinned templates (small).**
- Builds: "Pin as a template" on a sent letter, and the pinned ones in the chooser under "Pinned templates". No migration.
- Switch off: no pin control, and the chooser as checkpoint P left it.
- Proof: everyone who may send sees a pinned letter and may unpin it; "Use this" on one asks before it replaces a written letter.
- Depends on: step 5, and step 7 for its switch.

Q lets K see scheduling by pictures of the real page, up to the scheduled state.

### Checkpoint R: people, issue pages and the photo. After checkpoint O

**Step 10, add or review people (large). Switch `mailPeople` with `MAIL_PEOPLE_ON`.**
- Builds: the people panel. An added person is a contact with an "in" choice on the newsletter, source "added", in part one's tables, so no new table. The newsletter's audience learns those people. Duplicates, and anyone who unsubscribed, bounced or reported spam, are left out.
- Covers: P10.
- Switch off: the count card shows members only, and the audience is today's.
- Proof: the count shown equals the rows a send makes; a member, a person who unsubscribed and a dead address are each left out and counted in words; the media manager sees every address masked.
- Depends on: checkpoint O, and K's word that the clean days went well.

**Step 11, each issue's page on the site (medium). Switch `mailIssues` with `MAIL_ISSUES_ON`.**
- Builds: a page on the site for each sent issue, with the same part names, and the "Read this issue on the website" link under the email's list. Visitors meet it, so it gets a board first (decision 44). The public read cleans the stored words once more before it answers.
- Covers: D4.
- Switch off: no page and no link.
- Proof: the page shows only cleaned words; each line of the list jumps to its part on the page; an issue that was stopped has no page.
- Depends on: its board, approved by K.

**Step 12, the Add menu's photo and the plain top (medium). Switch `mailPhoto` with `MAIL_PHOTO_ON`.**
- Builds: a photo under the Add menu, which then takes the board's own name, "Add a photo, event or line". The picture is shrunk in the browser and stored in the site's own bucket, as a News post's picture is today. It cannot be added without words that describe it. The cleaner keeps one more form, an img from the site's own picture read. The plain top of the email, a choice for one issue in More options. Members meet both, so each gets a board first (decision 44).
- Switch off: the menu holds an event and a line, the upload answers 404, and the email's bytes are checkpoint P's.
- Proof: an img from anywhere else is still removed; an issue with no photo and the navy band has checkpoint P's bytes; the email stays under 102,000 bytes.
- Depends on: its boards, approved by K. It needs no clean days, so K can ask for it sooner once the boards are approved.

## 4. The switches and the switch-on

- **Five pairs: one each for P and Q, and one for each step of R.** Each is held equal by `test/unit/mail-switches.test.ts`. A test also holds that each is on only with `mailLists` on.
- **`mailPage` with `MAIL_PAGE_ON` shows:** Newsletter in Admin for LCA admins, the president and the media manager; the page; Send now.
- **K's look before the merge:** pictures of the real page, taken from checkpoint P's code with the switches on and a stand-in sign-in, as for checkpoint M. A preview cannot be signed into while the Preview environment holds no sign-in key, and a sign-in there would be a real account. P's preview is looked at only to see today's site with every switch off.
- **What K does first:** nothing new at Amazon or Cloudflare, and no new secret. The cutover is done, the first newsletter has gone, N has merged, and K has looked at P's pictures.
- **K's checks before the page's switch-on,** as before part one's: (1) checkpoint P's two runs are green, "Apply database migrations" and "Deploy scheduled-jobs worker"; (2) the worker's deployment is checkpoint P's or later; (3) no newsletter is sending. If the worker's run had failed, a page send's first rows would go in the navy look from the site and the rest in today's look from the old worker. Then K merges the small switch-on change, run green beforehand. Neither that change nor its rollback is merged while a newsletter is sending.
- **K's first act with it on:** a test to K's own address, tapped on a real iPhone in the Gmail app and in Apple Mail, opened in Gmail on a computer, and in Outlook's reading pane and full screen, as part one's build notes ask. Both footer links are pressed and each line of "In this issue" is tried. With the switch off the test cannot carry the navy look, so this comes after the switch, as K's first test did in part one. If the look is wrong, the switch goes off again the same day and no member has seen it.
- **If the Gmail app on an iPhone does nothing on a tap:** the list still reads as a contents list. The build notes' fallback, each line pointing at the issue's page on the site, needs step 11. K can then ask for step 11 sooner, after its board.
- **The plain tab while the page is on:** with `mailPage` on, Group email's newsletter tab keeps its count, its recent sends and Stop sending, and its writing box becomes one link. Turning `mailPage` off brings the plain box back. That is the rollback. A send's look is read from its own row, never from the switch, so everyone on one send gets one look.
- **When the plain box goes for good:** with WS08's admin home, which already rebuilds that page.
- **`mailLater` with `MAIL_LATER_ON` shows:** the arrow on Send and all of section 6, and pinning. When it goes on is K's choice 7. Before it: checkpoint Q's worker run is green and no newsletter is sending. The first scheduled send is a real one, and the lead watches that run.
- **The clean days and checkpoint O.** The page's and Q's switch-ons fall inside the 30 clean days. What K checks before O does not change: Amazon's bounce and complaint figures and K's alarms. One thing is added: K reads them once more after the first newsletter in the navy look, since a new look can change how many people report an email. The cutover's fallback still works with the page on: Send says it waits for Amazon SES, and a scheduled letter stays scheduled with that reason.

## 5. The email's look

- **The board:** Newsletter-Email-6, "The navy band, with In this issue". Decision 53 settles it.
- **How it reaches real email:** a second layout beside today's, chosen for each send by a key in `filter_json`, which the engine already reads. Today's layout file is not edited, so event and account email keep their bytes.
- **What must not change:** the footer still comes from the same place as today: the same words, the same two signed links, the same two headers, the same From, no postal address and no slot for one. The navy layout sets that footer on its cream ground. The board's "LCA on Facebook" line is one more of the footer's own words, in `domain/mail/footer.ts`, and nothing is drawn after it (K's choice 6).
- **"In this issue":** built from the cleaned letter's headings, with an empty named anchor before each part. Some phone mail apps ignore jump links. The list still reads as a contents list.
- **A test:** one function builds a test and a real send, so "Send a test to me" shows the navy look with "[TEST]", working footer links and the headers.
- **The side preview:** the same function, in a closed frame. No hand-copied copy of the layout.
- **Email from the plain tab:** a send with no look key gets today's layout, byte for byte, held by a test of its own. That covers the first newsletter. Such a newsletter shows under "Your last newsletters", and "Use this" brings its words into a new letter in the navy look.
- **The page's chrome:** the board draws the page under the new site menu. Until that menu's own switch is on, the page sits under today's menu.

## 6. Sending later

- **Data:** the letter's row holds the instant, who scheduled it and when, and the check of the site's link key made at that moment. No new status, no new cron, no change to the campaign tables. A campaign row is made only when the time comes, so the sweep, the one-at-a-time rule and the recent list never see a waiting letter.
- **The phase:** in the five-minute run, before the sweep, in its own `phase()`. It reads the one due letter with its version and calls `createListCampaign` with it. The sweep in the same run starts the sending. People are counted then.
- **No `automation_runs` row:** that table does not exist yet. The letter's own row is the check. WS09 builds the table and wraps this phase. This differs from part one's notes and is in the manifest's list of deviations.
- **It cannot send twice:** the campaign's insert and the letter's mark are one batch, which the database runs as one transaction.
- **A stop or a change always wins.** Every write to the schedule moves the letter's version by one: setting a time, changing it, "Do not send it", and the worker's own write when it holds a letter. The phase's insert requires, in the same statement, the version it read and a time that is still set and has come. So a "Do not send it" or a new time that lands between the phase's read and its batch means nothing is sent. The worker's own held write requires that version too, so it never overwrites a time a person has just changed.
- **The link key:** the campaign carries the site's key check, written when the person scheduled. A worker whose key differs sends nothing and says so, as part one built it.
- **Two people:** every save and schedule action carries the letter's version. A stale one is refused, and the page shows the newer letter and who scheduled it.
- **Writing on a scheduled letter:** it can be written on and tested until its time, as decision 51 says, and nothing extra is shown before then, since a change saved before the time always goes out. From its time on a save is refused and the head reads "Sending now", with the reason if it waits. So what goes out is the letter as it stood at its time, whichever run picks it up. To write on it again a person picks "Change the day or time" or "Do not send it".
- **A test before Send (K's choice 4):** "Schedule it" and "Send now" need a test of the letter as it stands, like Send. A scheduled letter changed later still goes at its time. The head then reads "Changed since the last test", and the log names who saved it last beside who scheduled it.
- **Who may still send:** at the letter's time the phase reads the scheduler's member row. If that person is no longer an LCA admin, the president or a holder of the Media manager seat, the letter is held, back as a draft, with "Not sent: the person who scheduled it may no longer send the newsletter" and a log row. A second factor cannot be checked from the worker, and the record says so.
- **A stop:** before the time, "Do not send it" makes it a draft again and deletes nothing. After it, today's Stop sending. The letter then reads "Stopped" with its counts and is not sent again by itself.
- **Another newsletter still sending, Resend sending, or no link key:** the letter stays scheduled, the page shows the reason, and the phase tries again each run.
- **Very late:** more than 6 hours past its time, it is not sent. It goes back to a draft, the head says so, and the log holds a row (K's choice 8).
- **Daylight saving:** the typed Central time becomes an instant once, on the server. A time that does not exist (2:00 AM to 2:59 AM on Sunday, March 14, 2027) is refused in words. A time that comes twice (1:00 AM to 1:59 AM on Sunday, November 7, 2027) means the first.
- **Activity log:** scheduled, time changed, "Do not send it", not sent (too late, or the scheduler may no longer send), sent by the schedule (in the scheduler's name, with the last person to save), and today's sent and stopped. Each row carries the month and the day and time.

## 7. What K must decide

Decided already, so not asked. K is told each in one line.

- The navy look is board Newsletter-Email-6 (decision 53, which says the plan names the board).
- Explaining sentences go behind Help (decision 40, a standing rule). The approved board still showed some beside their controls: "Made from your headings. Updates by itself.", the two lines under the chooser, the two club sentences in the From list, and the people panel's sentences.
- The states no board draws are built in plain words, with no design round (decision 44). K sees them in checkpoint P's pictures.
- The opened From list and "Manage senders" wait for a second sender and a senders page, with WS09.

The eight choices:

1. **Start now?**
   - (a) Recommended: yes, on the page's own branch, with nothing merged until checkpoint N has. The days are otherwise empty and nothing K has dated is touched.
   - (b) Build nothing until N merges. The page and WS09 each come about 1 day later (estimate; range 1 to 4).
   - Look at: section 1.
2. **How much goes ahead of WS09?** And one fact: the date of December's board meeting, which the documents do not hold.
   - (a) Recommended: the page and sending later, checkpoints P and Q. It is the page K approved, with the scheduling K asked for by name. WS09 starts about Thursday, November 26, 2026 (estimate; range Wednesday, November 25 to Monday, November 30, 2026), about 2 days later than planned.
   - (b) The page only. WS09 starts about Wednesday, November 25, 2026 (estimate; range Tuesday, November 24 to Friday, November 27, 2026). Sending later then comes at WS09's first checkpoint boundary. Pick this if the board meeting needs every day of WS09.
   - (c) All three checkpoints. WS09 starts about Friday, November 27, 2026 (estimate; range Thursday, November 26 to Friday, December 4, 2026), and two boards are needed first. Adding people would still stay off until the clean days end.
   - Look at: sections 1 and 3.
3. **One writer at a time, or live co-writing?**
   - (a) Recommended: one at a time. Nothing is overwritten silently, and the other person is named. The board draws it, and it needs no new service.
   - (b) Live co-writing. A much larger build, not in this half.
   - Look at: "The states no board draws" in section 2.
4. **A test before Send.** K's pick in decision 26 was Send "after a test and one confirm step".
   - (a) Recommended: Send, "Send now" and "Schedule it" stay inactive, with the reason "Send a test of this letter first", until a test of the letter as it stands has gone. A scheduled letter changed later still goes at its time, as decision 51 says. The head then reads "Changed since the last test" and the log names who saved it last. This holds K's pick at the press and never holds a scheduled newsletter back by surprise.
   - (b) The same, and a scheduled letter changed after its last test is not sent at its time. It goes back to a draft and says why.
   - (c) The three numbers are a guide only. Nothing is refused.
   - Look at: the bar on Newsletter-Page-4 on the canvas, and section 6.
5. **The "Add a photo, event or line" menu, and the plain top of the email.**
   - (a) Recommended: a line and "Add an event" now, in checkpoint P, with the button reading "Add an event or line". The photo and the plain top come in step 12, after a board for each. The event line is already drawn on the approved email and costs about 2 hours in the free days. A member would see a photo or a plain top, and no board draws either.
   - (b) All of it in checkpoint P. The photo and the plain top are built from words, and K first sees them in the pictures. About 6 more hours in the free days, and no date moves.
   - (c) A line only now, with the button reading "Add a line". The rest in step 12.
   - Look at: the tools row on Newsletter-Page-4, and "Coming up" on Newsletter-Email-6, on the canvas.
6. **The footer's words.**
   - (a) Recommended: today's words and both links, with the board's "LCA on Facebook" line under them. Today's words were reviewed and are true for a family's shared address. The Facebook line is on the look the president picked, and the site's own footer already links that page.
   - (b) Today's words and links, with no Facebook line.
   - (c) The board's words throughout: "You get this newsletter because you are an LCA member.", "Unsubscribe from the newsletter", "Choose which LCA emails you get".
   - Look at: the footer on Newsletter-Email-6 on the canvas.
7. **When sending later is switched on.**
   - (a) Recommended: after one newsletter has gone out from the page. The page's send is then proven on real members before a timed send rests on it. December's issue is sent by a press.
   - (b) As soon as checkpoint Q has merged, about Monday, November 30, 2026 (estimate; range Friday, November 27 to Friday, December 4, 2026), so December's issue can be scheduled. The first timed send is then also the first send from the page, and the lead watches that run.
   - Look at: section 4, and Newsletter-Page-4-Schedule on the canvas.
8. **A scheduled newsletter that cannot go at its time.**
   - (a) Recommended: it keeps trying for 6 hours, then goes back to a draft and says so. A short outage does not lose the send, and a long one does not send it at an odd hour much later.
   - (b) The same, with 1 hour.
   - (c) It sends however late.
   - Look at: Newsletter-Page-4-Schedule on the canvas, and section 6.

Open and not blocking: where replies go (the address map's choice 6); what an officer who holds the Media manager seat reads in place of "View only" on the plain tab (with the five-spot fix); whether each issue's page is open to everyone or to members, and how long a letter's pictures are kept (asked with their boards); whether the News posts' cleaner needs the mending step 1 looks into.

## 8. The risks

1. **K's days and N meet page work.** Fences F1 and F2. The page gives way. The switch-on, the cutover, the first newsletter, N's steps, N's review and N's fix round never do.
2. **The free days are fewer than planned.** If K switches on sooner, less is built before N. Only the page slips, by up to 1 day (estimate; range 0 to 3).
3. **The rebase onto `main` after N.** Nine shared files, a few lines each, at the page's cost. If it takes more than ½ day, the steps built before N are replayed one at a time on `main`.
4. **The live send path changes in step 6.** One optional argument on each of two functions, and the letter's statements join the batch only when a letter is given. A plain message's bytes are held by a test of their own. It ships off. It lands after the first newsletter and after N has merged.
5. **The site and the worker deploy apart.** A failed worker run could send one newsletter in two looks. K checks both runs and the worker's deployment before the page's switch-on, and no switch-on or rollback is merged while a newsletter is sending.
6. **The email in real inboxes.** Jump links ignored, a long email cut by Gmail, dark mode. The letter's cap, the size test, and K's inbox checks on the named mail apps as the first act after the switch.
7. **A newsletter sent twice, sent after a stop, or not at all.** One batch makes the campaign and marks the letter. Every schedule write moves the version, and the phase's insert requires the version it read and a time that is set and has come. A held letter says why. The first scheduled send is watched.
8. **A newsletter sent in the name of someone who may no longer send.** The phase asks at the letter's time and holds the letter if not.
9. **Words nobody tested go out.** Send needs a test of the letter as it stands (K's choice 4). A scheduled letter changed later says so in its head, and the log names who saved it last.
10. **Unsafe pasted HTML.** Cleaned on every save and copy, with the raw-text tags removed whole and a result the cleaner would itself change refused. The preview is a closed frame. With the switch on, the send takes a saved letter only. Each issue's public page cleans again when it reads. The plain box stays as it is until the switch is on.
11. **A keyboard user loses their place.** A bar fixed at the foot, a chooser that opens upward, a confirm, Help, a sheet and a panel. Each takes focus and gives it back, and no focused control is hidden under the bar. Steps 4, 5, 6 and 8 each prove it.
12. **The worker's size.** Its upload is 76.61 KiB against part one's ceiling of 96 KiB. The navy layout joins it in step 6. Step 2 measures the layout alone first, so the answer is known before anything imports it.
13. **Checkpoint O meets the page's changes.** Step 12's entry is scouted again on `main` after Q has merged (F5).
14. **WS09's dates and the December board meeting.** About 2 days. Choice 2 asks K for the meeting's date and gives the shorter option.

## What was not chosen and why

- **Merging the page before checkpoint N, or in the switch-on week.** Not chosen: N's entries and the switch-on patch are written against `main` as it stands, any merge redeploys the worker that carries the first newsletter, and N must not rebase for the page.
- **Lifting the four files' wait at step 11's commit.** Not chosen: N's review and fix round come after step 11, and checkpoint M's fix round changed two of those four files. Step 6 would be built on a moving base, and the lead would be split between N's fix round and page work.
- **Building only files that nothing imports until N merges.** Not chosen: it leaves steps 3 to 5 for after N and moves WS09 about ½ day more (estimate; range ½ to 1½). The shared files are nine, with a few added lines each, and the rebase is the page's own cost. The four files N changes most are still left alone (F3).
- **Filling the spare free days with steps 7 to 9.** Not chosen: steps 7 and 8 rest on step 6, which waits for N. Step 9 could go, but it ships under a switch step 7 adds.
- **K seeing the page on a preview.** Not possible: a preview cannot be signed into. K sees pictures of the real page, as for checkpoint M.
- **The News posts' cleaner as it is.** Not chosen: it unwraps tags whose inside is raw text. The letter's cleaner removes them whole.
- **A hand-written cleaner.** Not chosen: the integration suite runs inside the Workers runtime, so the method that already cleans News posts can be tested there, with its blind spot closed.
- **A claim column on the letter and a ten-minute check for a failed run.** Not chosen: one batch makes the campaign and marks the letter, so there is no half-done state to recover.
- **A second table for a letter's versions.** Not chosen: a replaced letter is set aside in the same table and shows under "Your last newsletters". One table is less to keep.
- **The plain tab and the page both writing, side by side.** Not chosen: two places to write the same newsletter confuse, and K's own remark was that the tab is not the page K approved. The tab's box becomes a link, and the switch is the rollback.
- **A preview fetched from the server.** Not chosen: the layout is one pure function the page can call, so the preview changes as you type and is the same HTML.
- **K's inbox test before the switch.** Not possible: with the switch off, a test cannot carry the navy look. It is K's first act after the switch, as in part one.
- **A "Sending soon" line in the last five minutes.** Not chosen: a change saved before the time always goes out, so the line would be untrue when shown. The page says "Sending now" from the letter's time, when it is true.
- **Sending a scheduled letter whatever its scheduler's rights are by then.** Not chosen: the guard reads the seat at every request because it can change.
- **Leaving the photo and the event form out as "extras".** Not chosen: decision 27 makes them options, not things to leave out. Each now has a step, and K has choice 5.
- **One hour as the limit for a late scheduled send.** Not recommended: a short outage would drop the send without anyone being told. It stays as K's option.
- **Adding people straight after sending later.** Not recommended: it would be built during the clean days and could not safely be switched on before they end. It stays as K's option.
- **The first newsletter from the page.** Not chosen: part one plans it from the plain tab (decision 52), and nothing waits for the page.
- **Waiting for `automation_runs`.** Not chosen: it would tie the page to WS09. The letter's own row does the job.
- **Sizes read as calendar days.** Not kept: part one's own hours are the measure.

## K's copy, in plain words

This is the whole text of `ws16-p2-summary.md`. Nothing below this line is for the builders.

### The newsletter's own page

**Where it goes.** Building starts now. Nothing goes live until your switch-on, the cutover, the first newsletter and checkpoint N are done. Merging sooner would make N start over.

**What you get.** Dates are estimates: up to 3 days sooner or a week later. All move with your switch-on day.

1. About Sunday, November 15, 2026: pictures of the real page and the navy email.
2. Week of Monday, November 16, 2026: your switch-on, the cutover, the first newsletter, checkpoint N. Unchanged.
3. About Tuesday, November 24, 2026: the page, in pictures, for your word.
4. About Wednesday, November 25, 2026: you switch it on. December's newsletter is written on it.
5. About Monday, November 30, 2026: sending later.
6. After Friday, December 18, 2026: adding people, issue pages, photos.

**What it moves.** WS09 starts about Thursday, November 26, 2026, not Tuesday, November 24, 2026: 2 days later (range 1 to 6). Everything after WS09 moves the same. Nothing else moves.

**Your choices.** "All recommended" works as an answer.

1. Start now? (a) Recommended: yes. The days are otherwise empty. (b) Wait for N: 1 day later. Look at: the dates.
2. How much before WS09? (a) Recommended: the page and sending later, as you approved. (b) The page only: 1 day sooner. (c) All of it: 1 day later. Also: what date is December's board meeting? Look at: the dates.
3. Writers. (a) Recommended: one at a time, nothing overwritten. (b) Live co-writing: far larger. Look at: Newsletter-Page-4.
4. A test before Send. (a) Recommended: Send waits for a test of the letter as it stands, your earlier pick. (b) Also hold a scheduled letter changed after its test. (c) A guide only. Look at: Newsletter-Page-4.
5. The "Add a photo, event or line" menu. (a) Recommended: line and event now. The photo after its picture, since members see it. (b) All now. (c) Line only. Look at: Newsletter-Page-4.
6. The footer. (a) Recommended: today's checked words, plus "LCA on Facebook". (b) No Facebook line. (c) The board's words. Look at: Newsletter-Email-6.
7. When sending later goes on. (a) Recommended: after one newsletter from the page, so sending is proven first. (b) Once it merges, to schedule December's. Look at: Newsletter-Page-4-Schedule.
8. A late scheduled newsletter. (a) Recommended: it tries 6 hours, then returns to a draft and says so. Short outages lose nothing. (b) 1 hour. (c) However late. Look at: Newsletter-Page-4-Schedule.

**Settled already.** The look is Newsletter-Email-6. Explaining sentences sit behind Help.

**What you do.** Nothing new at Amazon or Cloudflare. Before switching on, check the merge's two runs are green.
