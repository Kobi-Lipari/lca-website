# WS16 part one in one page, for K

Tuesday, November 10, 2026. The full plan is in four files beside this one: `ws16-plan-notes.md` (the design, each question's options with the one recommended, and the reviews' and checks' findings), `ws16-manifest.json` (the steps), `ws16-brief-section.md` (the brief's section) and `ws16-k-checklist.md` (your list, in order). Every address and domain form the site will use is in `ws16-address-map.md`, for you to decide at once.

## What part one builds

- **One door for every email**, so the sending service can change in one place. Amazon SES replaces Resend; Resend keeps carrying receipts and confirmations until SES has run cleanly for about 30 days, and is then removed.
- **The LCA newsletter list**: every address on an account with an active membership, once per family (your rule: you need to be active to get it), written in today's Group email text box with links pasted by hand, and sent from that page. It goes out only through Amazon SES.
- **Opt-outs that belong to LCA**: an unsubscribe link and one-click unsubscribe in every newsletter, a preferences page with "Stop all optional email from LCA", and our own records of who left which list, of dead addresses and of spam reports, so they survive any change of service. No postal address in any email, as you decided.
- **Amazon's bounce and spam reports reach the site** and act at once: a dead address gets no more mail; a spam report stops the list it was made on.
- **A media manager** who can send the newsletter from switch-on, and from the second checkpoint post News, set the site banner and send to groups of members; not Specific people, which takes typed-in addresses and hand-picked members and so reads members' records beyond what sending needs (question 4).
- **Every address in one place**, so the forms you decide from the address map are written once.
- **Safety**: no newsletter or group email is ever sent twice (a director's announcement sends as it does today), previews never send, and everything waits behind switches you turn on.

## The steps and the checkpoints

**Checkpoint M, steps 1 to 8, merging about Tuesday, November 17, 2026: what next week needs.**
1. One door for all mail, every address in one place, the switches and the record, with every email byte for byte as today.
2. The new tables, the do-not-send check on every email, and the daily reminders made safe on the free plan.
3. The signed unsubscribe and preferences links, the footer and the one-click headers.
4. The newsletter list, the rules against double sends, and Send, Test and Stop.
5. The newsletter tab in Group email, and the two pages a member's link opens.
6. The media manager, as a board seat, signed in with two factors.
7. The Amazon SES sender, a test through it from the site, and the newsletter's sends proved through it.
8. The receiver for Amazon's reports, and the switch-on and cutover changes, each proved first.

**Checkpoint N, steps 9 to 11, about Monday, November 23, 2026.** 9: the Not delivered list and the record of the cutover. 10: the media manager's News posts and site banners. 11: Group email's member groups back, on their own list, "LCA tournament email".

**Checkpoint O, step 12, about 30 days after the cutover.** Resend removed.

## What you do, and when

- **Now:** your checklist's sections 1 to 10: the AWS account (Amazon's advanced sign-up, the Paid account plan, Basic support), the domain and its three DKIM records, the configuration set and topic, the suppression setting, a first console test, the sending key (for noreply@ only, for now), the Cloudflare secrets, the request for real sending (with your own words on how membership has included the newsletter), and Workers Paid ($5 a month).
- **By about Saturday, November 14, 2026:** decide the address map, then your checklist's section 11 (the return path, any sending domain of the lists' own, and the key's senders), so Amazon's checks finish before switch-on day.
- **Before checkpoint M merges:** the name of step 11's list (question 7); look at the preview, and give your go.
- **Switch-on day, about Wednesday, November 18, 2026:** check the merge went through, the bot setting and two counts; add the Media manager seat; merge the switch-on change; test with your own address. Then connect Amazon's reports to the site, turn off Amazon's report emails, send the site's own test through Amazon SES, from the newsletter's address, to yourself and to Amazon's two test addresses, and set three alarms.
- **When Amazon approves and Workers Paid is on:** copy Resend's bounced addresses to Amazon's list, merge the cutover change, test once more and have a short note sent to you from Specific people; then the first newsletter goes.
- **About 30 days later:** tell the lead SES ran cleanly; a week after step 12 merges, delete Resend's key and records.

## Decided by you on Tuesday, November 10, 2026

- **1 (Q40).** Who gets the newsletter: accounts with an active membership, as a rule, not widened unless you say so. Your two counts are a check on switch-on day, not a condition.
- **2 (Q41).** No month of Resend for the newsletter: it waits for Amazon SES.
- **3 (Q42).** Workers Paid before Amazon SES sends. Why: on the free plan a request gets 10 ms of processor time, and signing each message for Amazon could cut a director's announcement part way and then send it twice when the director presses Send again.
- **4 (Q43, first half).** The media manager is a board seat, Media manager, shown on the Board page like every seat.
- **6 (Q45).** Group email's "Groups of members" is hidden from switch-on until step 11 gives it its own unsubscribe; "Specific people" stays, for a note about a person's own membership, entry or request.

## Still open: the recommended answer first, then the other option

- **4 (Q43, second half).** The media manager and Specific people: not theirs, because it takes typed-in addresses and hand-picked members, which reads members' records beyond what sending needs; or Specific people for them too, with members picked by name, addresses masked and no typed-in addresses.
- **5 (Q44).** The addresses: the address map's recommendations, all at once, because one decision made once means no address members have seen changes later; or the map's choices one by one. By about Saturday, November 14, 2026.
- **7 (Q46).** Step 11's list: named "LCA tournament email", your words; for accounts with an active membership, your newsletter rule applied the same way; names and masked addresses for the media manager, since reviewing who gets it needs no addresses. Or a wider name, active and lapsed members, or full addresses. The name is needed before checkpoint M merges.
- **8 (Q47).** Spam reports: a report stops the list it was made on, and clubs' and representatives' mail, but not LCA's other main mailers, because a newsletter that kept coming after a spam report would keep mailing someone who called it spam; or a report never stops one of LCA's main mailers, even the one it was made on.
- **9 (Q48).** Amazon's region: US East (N. Virginia), because every value in your checklist is written for it, with Amazon's own list holding bounces only, so a spam report never makes Amazon drop a family's receipts; or another region, or Amazon's default.
- **10.** The two old launch scripts: their sending removed with Resend, because they skip the do-not-send list and the opt-outs; or rewritten for Amazon SES.
- **11.** Timing: switch on the day after the merge, cut over when Amazon approves, then the first newsletter, because each change can be undone on its own; or all in one day.
- **12 (Q49).** The newsletter page's open points: asked in part two, because part one depends on none of them; or some now.

## What part two will need from you

Decided already: the simple version first; LCA admins, the president and the media manager write and send it; it goes to accounts with an active membership; a person presses Send after a test and one confirm step, with "Send later" for a day and time; a new month starts from the usual six headings; tournaments typed, with a pasted King Registration link; no photo by default, with a photo and an "Add an event" form under an "Add" menu; the plain top of the email, the other two ways to start a month, the inbox preview line, the reply address and who gets it in a "More options" section that is closed when the page opens; a small preview always at the side on a computer, one press away on a phone; a page on the site for each issue right after the first version.

Still open: the president's pick of the page's look and the email's look, the navy band included, from the options you send on Wednesday, November 11, 2026; the addresses (the address map); one person writing at a time, as the picks board draws it, or live co-editing; how it grows later; who is on a club's list and who may send for clubs and regions; and whether DMARC moves from p=none to quarantine after a clean season.

## Still unverified

- Amazon's answer and when it comes; whether Amazon's signature covers the one-click headers, and whether it takes the display name and a half sign in the subject as the site sends them (the site's own test shows both).
- Processor time on Cloudflare, measured only on the build machine: the reason Amazon SES waits for Workers Paid.
- The exact words Cloudflare uses when a run uses up its outside calls; whether the test setup can run the daily worker and check SNS's older signatures.
- Whether production still holds the sample accounts at example.com (your count shows it), and whether Bot Fight Mode is on.
- Two console details Amazon's and Cloudflare's pages leave open: whether the failed-delivery metric is listed before a first failure, and how Cloudflare's DNS Name field treats a pasted full name (your checklist says what to do either way).
- Which navigation tests pin the account menu for a seat holder, and the seat screens' exact controls.
